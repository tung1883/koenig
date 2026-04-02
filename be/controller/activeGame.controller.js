const { queryExec, checkOkPacket } = require("../db")
const { errorHandler } = require("./error.controller")

// Result method: 0 - Checkmate, 1 - Time, 2 - Stalemate, 3 - Resign, 4 - Draw by agreement
const CLEANUP_RETRY_DELAY_MS = 500
const FINALIZE_CLEANUP_DELAY_MS = 600
const MAX_CLEANUP_RETRIES = 8

const clearGame = async ({ gameID, counter = 0 }) => {
    if (counter > MAX_CLEANUP_RETRIES) return

    const activeGameDeletion = await queryExec('delete from active_game where gameID=?', [gameID])
    const drawOfferDeletion = await queryExec('delete from drawOffers where gameID=?', [gameID])

    if (!checkOkPacket(activeGameDeletion) || !checkOkPacket(drawOfferDeletion)) {
        setTimeout(() => clearGame({ gameID, counter: counter + 1 }), CLEANUP_RETRY_DELAY_MS)
    }
}

const handleGameFinished = async ({ gameID, gameResult, record, timer }) => {
    await queryExec('update active_game set result=? where gameID=?', [gameResult, gameID])
    await queryExec('update game set result=?, record=?, timer=? where gameID=?', [gameResult, record, timer, gameID])
    setTimeout(() => clearGame({ gameID }), FINALIZE_CLEANUP_DELAY_MS)
}

const emitGameEvent = (req, gameID, event, payload) => {
    const io = req.app.get('socketio')
    if (!io) return
    io.to(`game:${gameID}`).emit(event, {
        gameID: Number(gameID),
        ...payload
    })
}

const emitUsersEvent = (req, userIDs, event, payload) => {
    const io = req.app.get('socketio')
    if (!io) return
    const unique = [...new Set((userIDs || []).map((id) => Number(id)).filter(Boolean))]
    unique.forEach((id) => {
        io.to(`user:${id}`).emit(event, payload)
    })
}

// create new game in both game and active_game table
exports.createActiveGame = async (req, res) => {
    const userID = res?.locals.userID
    const { wp, bp, timer } = req.body

    if (userID != wp && userID != bp) {
        return res.status(403).send({
            error: 'user is not one of the player',
            userID,
            wp,
            bp
        })
    }

    if (!timer) {
        return res.status(400).send({
            message: 'Need info about time format'
        })
    }

    try {
        const gameInsert = await queryExec('insert into game(wp, bp, date) values(?, ?, CURRENT_DATE())', [wp, bp])
        const gameID = gameInsert.insertId

        const serverNow = Date.now()
        await queryExec(
            'insert into active_game(gameID, wp, bp, turn, timer, started_time) values(?, ?, ?, ?, ?, ?)',
            [gameID, wp, bp, wp, timer, serverNow]
        )
        await queryExec('insert into drawOffers(gameID) values(?)', [gameID])

        emitUsersEvent(req, [wp, bp], 'game:started', {
            gameID: Number(gameID),
            wp: Number(wp),
            bp: Number(bp),
            turn: Number(wp),
            timer,
            started_time: Number(serverNow),
            record: null,
            move_number: null
        })

        return res.status(200).send({
            gameID,
            timer
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.updateActiveGame = async (req, res) => {
    const userID = res?.locals.userID
    const { gameID } = req.params
    const { result: gameResult, move, time, i1, i2 } = req.body
    const hasMovePayload = !!move && time !== undefined && i1 !== undefined && i2 !== undefined
    const hasGameResult = gameResult !== null && gameResult !== undefined

    if (!hasMovePayload && !hasGameResult) {
        return res.status(400).send({
            message: 'No enough data about move or time record'
        })
    }

    try {
        const result = await queryExec('select wp, bp, record, turn, move_number, timer, result, started_time from active_game where gameID=?', [gameID])
        if (!result?.length) {
            return res.status(404).send({ error: 'Game not found' })
        }

        if (result[0]?.result) {
            return res.status(400).send({ error: 'Game already ended' })
        }

        const isPlayer = userID == result[0].wp || userID == result[0].bp
        if (!isPlayer) {
            return res.status(403).send({ error: 'User is not one of the players' })
        }

        if (hasMovePayload && result[0]?.turn != userID) {
            return res.status(403).send({ error: 'Not the turn of the user' })
        }

        const serverNow = Date.now()
        const computedMoveTime = Math.max(1, serverNow - Number(result[0].started_time || serverNow))
        const update = {
            turn: hasMovePayload ? (userID == result[0].wp ? result[0].bp : result[0].wp) : result[0].turn,
            moveNumber: hasMovePayload ? (result[0].move_number !== null ? result[0].move_number + 1 : 0) : result[0].move_number,
            record: hasMovePayload ? (result[0].record ? `${result[0].record} ${move}` : move) : result[0].record,
            timer: hasMovePayload ? `${result[0].timer} ${computedMoveTime}` : result[0].timer
        }

        if (hasMovePayload) {
            await queryExec(
                'update active_game set record=?, turn=?, move_number=?, timer=?, time_spent=?, i1=?, i2=?, started_time=? where gameID=?',
                [update.record, update.turn, update.moveNumber, update.timer, computedMoveTime, i1, i2, serverNow, gameID]
            )
            emitGameEvent(req, gameID, 'game:move', {
                i1: Number(i1),
                i2: Number(i2),
                timeSpent: Number(computedMoveTime),
                moveNumber: Number(update.moveNumber)
            })
        }

        if (hasGameResult) {
            await handleGameFinished({ gameID, gameResult, record: update.record, timer: update.timer })
            emitGameEvent(req, gameID, 'game:end', {
                result: gameResult
            })
        }

        return res.sendStatus(200)
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getDrawOffer = async (req, res) => {
    const { gameID } = req.params

    try {
        const result = await queryExec('select state from drawOffers where gameID=?', [gameID])
        if (!result?.length || !result[0]?.state) {
            return res.status(404).send({ msg: 'Game not found' })
        }

        return res.send({
            drawOffer: result[0].state.readUInt8(0)
        })
    } catch (err) {
        return errorHandler(err, res, 404)
    }
}

exports.updateDrawOffer = async (req, res) => {
    const userID = res?.locals.userID
    const { gameID } = req.params
    const { offeringDraw, wp, bp } = req.body
    let gameResult = null

    if (offeringDraw >= 3 || (userID == wp && offeringDraw == 2) || (userID == bp && offeringDraw == 1)) {
        return res.status(400).send({
            message: 'Invalid draw offer'
        })
    }

    try {
        const game = await queryExec('select wp, bp from active_game where gameID=?', [gameID])
        if (!game?.length) {
            return res.status(404).send({ msg: 'Game not found' })
        }

        if (userID != game[0].wp && userID != game[0].bp) {
            return res.status(403).send({ msg: 'Not user game' })
        }

        const result = await queryExec('select state from drawOffers where gameID=?', [gameID])
        const state = result[0].state.readUInt8(0)

        if (state == 0 && offeringDraw > 0) {
            await queryExec('update drawOffers set state=? where gameID=?', [offeringDraw, gameID])
            emitGameEvent(req, gameID, 'game:draw', { drawOffer: Number(offeringDraw) })
            return res.send({ msg: "Draw offer updated" })
        }

        if (state == 0) {
            return res.send({ msg: "Draw offer updated" })
        }

        // accept draw
        if ((offeringDraw > 0 && userID == wp && state == 2) || (offeringDraw > 0 && userID == bp && state == 1)) {
            gameResult = '0, 4'
            await queryExec("update drawOffers set state=b'11' where gameID=?", [gameID])
            const gameData = await queryExec('select record, timer from active_game where gameID=?', [gameID])
            if (gameData?.length) {
                await handleGameFinished({ gameID, gameResult, record: gameData[0].record, timer: gameData[0].timer })
            }
            emitGameEvent(req, gameID, 'game:draw', { drawOffer: 3 })
            emitGameEvent(req, gameID, 'game:end', { result: gameResult })
            return res.send({ msg: "Draw offer updated" })
        }

        // decline offer
        if (
            (offeringDraw == 0 && userID == wp && state == 1) ||
            (offeringDraw == 0 && userID == bp && state == 2) ||
            (!offeringDraw && userID == wp && state == 2) ||
            (!offeringDraw && userID == bp && state == 1)
        ) {
            await queryExec("update drawOffers set state=b'00' where gameID=?", [gameID])
            emitGameEvent(req, gameID, 'game:draw', { drawOffer: 0 })
        }

        return res.send({
            msg: "Draw offer updated"
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getActiveGame = async (req, res) => {
    const userID = res?.locals.userID

    try {
        const result = await queryExec('select * from active_game where wp=? or bp=?', [userID, userID])
        if (!result[0]) {
            return res.send({
                msg: 'No game is found'
            })
        }

        return res.send({
            game: result[0]
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getLastMove = async (req, res) => {
    const { gameID } = req.params

    try {
        const result = await queryExec('select i1, i2, move_number, time_spent, result from active_game where gameID=?', [gameID])
        return res.send({ ...result[0] })
    } catch (err) {
        return errorHandler(err, res)
    }
}
