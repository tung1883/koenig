const { queryExec, checkOkPacket } = require("../db")
const { errorHandler } = require("./error.controller")

const emitUsersEventByApp = (app, userIDs, event, payload) => {
    const io = app?.get('socketio')
    if (!io) return
    const unique = [...new Set((userIDs || []).map((id) => Number(id)).filter(Boolean))]
    unique.forEach((id) => {
        io.to(`user:${id}`).emit(event, payload)
    })
}

const emitUsersEvent = (req, userIDs, event, payload) => {
    emitUsersEventByApp(req?.app, userIDs, event, payload)
}

const clearRequest = async ({ reqID, app, counter = 0, emitExpired = true }) => {
    if (counter > 5) return

    const requestRows = await queryExec('select receiver, wp, wu, bp, bu, timer, gameID from request where reqID=?', [reqID])
    const requestRow = requestRows?.[0]
    const deleted = await queryExec('delete from request where reqID=?', [reqID])
    if (!checkOkPacket(deleted)) {
        setTimeout(() => clearRequest({ reqID, app, counter: counter + 1, emitExpired }), 1000)
        return
    }

    if (!emitExpired || !requestRow || requestRow.gameID || Number(deleted.affectedRows || 0) === 0) {
        return
    }

    emitUsersEventByApp(app, [requestRow.wp, requestRow.bp], 'invite:expired', {
        reqID: Number(reqID),
        receiver: Number(requestRow.receiver),
        wp: Number(requestRow.wp),
        wu: requestRow.wu,
        bp: Number(requestRow.bp),
        bu: requestRow.bu,
        timer: requestRow.timer
    })
}

const acceptRequest = async (req, res, reqID, gameID) => {
    if (!gameID) {
        return res.status(400).send({
            message: "Need to provide game ID to accept the request"
        })
    }

    const row = await queryExec('select receiver, wp, wu, bp, bu, timer from request where reqID=?', [reqID])
    await queryExec('update request set gameID=? where reqID=?', [gameID, reqID])
    const startedTime = await queryExec('select started_time from active_game where gameID=?', [gameID])

    if (row?.[0]) {
        emitUsersEvent(req, [row[0].wp, row[0].bp], 'invite:accepted', {
            reqID: Number(reqID),
            gameID: Number(gameID),
            receiver: Number(row[0].receiver),
            wp: Number(row[0].wp),
            wu: row[0].wu,
            bp: Number(row[0].bp),
            bu: row[0].bu,
            timer: row[0].timer,
            startedTime: Number(startedTime?.[0]?.started_time || Date.now())
        })
    }

    res.status(200).send({
        message: 'Game request is accepted',
        gameID
    })

    setTimeout(() => clearRequest({ reqID, app: req.app, emitExpired: false }), 20 * 1000)
}

const declineRequest = async (req, res, reqID) => {
    const row = await queryExec('select receiver, wp, wu, bp, bu, timer from request where reqID=?', [reqID])
    await queryExec('delete from request where reqID=?', [reqID])

    if (row?.[0]) {
        emitUsersEvent(req, [row[0].wp, row[0].bp], 'invite:declined', {
            reqID: Number(reqID),
            receiver: Number(row[0].receiver),
            wp: Number(row[0].wp),
            wu: row[0].wu,
            bp: Number(row[0].bp),
            bu: row[0].bu,
            timer: row[0].timer
        })
    }

    res.status(200).send({
        msg: 'Request is deleted'
    })

    setTimeout(() => clearRequest({ reqID, app: req.app, emitExpired: false }), 20 * 1000)
}

exports.getRequest = async (req, res) => {
    const { reqID } = req.params

    try {
        const result = await queryExec('select gameID from request where reqID=?', [reqID])
        if (result.length === 0) {
            return res.status(200).send({ requestDeleted: true })
        }

        const gameID = result[0]?.gameID
        if (!gameID) {
            return res.status(200).send({
                gameID: null
            })
        }

        const startedTimeQuery = await queryExec('select started_time from active_game where gameID=?', [gameID])
        if (startedTimeQuery.length === 0) {
            throw Error("Game ID is not in the active game table")
        }

        return res.status(200).send({
            gameID,
            startedTime: startedTimeQuery[0]?.started_time
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.createRequest = async (req, res) => {
    const userID = res.locals.userID
    const { wp, wu, bp, bu, timer } = req.body
    const oppID = userID == wp ? bp : wp

    if (!wp || !bp || !wu || !bu || !timer) {
        return res.status(400).send({
            error: 'need to provide ID and username of both players and the time format'
        })
    }

    if (wp == bp) {
        return res.status(400).send({
            error: 'user and opponent have the same ID'
        })
    }

    if (userID != wp && userID != bp) {
        return res.status(400).send({
            error: 'User is not authenticated'
        })
    }

    try {
        const result = await queryExec(
            'insert into request(receiver, wp, wu, bp, bu, timer) values(?, ?, ?, ?, ?, ?)',
            [oppID, wp, wu, bp, bu, timer]
        )

        emitUsersEvent(req, [oppID, wp, bp], 'invite:new', {
            reqID: Number(result.insertId),
            receiver: Number(oppID),
            wp: Number(wp),
            wu,
            bp: Number(bp),
            bu,
            timer
        })

        res.status(200).send({
            reqID: result.insertId
        })

        setTimeout(() => {
            clearRequest({ reqID: result.insertId, app: req.app, emitExpired: true })
        }, 60 * 1000)
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.requestResponse = async (req, res) => {
    const userID = res.locals.userID
    const { reqID, action, gameID } = req.body // 0: decline, 1: accept

    if (!reqID || (action !== 0 && action !== 1)) {
        return res.status(400).send({
            msg: 'Request ID and action data is required'
        })
    }

    try {
        const result = await queryExec('select receiver, wp, bp from request where reqID=?', [reqID])
        if (!result || result.length === 0) {
            return res.send("Request is deleted")
        }

        if (userID != result[0]?.wp && userID != result[0]?.bp) {
            return res.status(403).send({
                error: "User is not authorized to update the request"
            })
        }

        if (action === 1) {
            return acceptRequest(req, res, reqID, gameID)
        }
        return declineRequest(req, res, reqID)
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getReceiverRequestList = async (req, res) => {
    const userID = res.locals?.userID
    try {
        const result = await queryExec(
            'select reqID, receiver, wp, wu, bp, bu, timer from request where receiver=? and gameID is null',
            [userID]
        )

        return res.send({
            requestList: result
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getUserRequest = async (req, res) => {
    const userID = res.locals?.userID
    try {
        const result = await queryExec(
            'select reqID, receiver, wp, wu, bp, bu, timer from request where wp=? or bp=?',
            [userID, userID]
        )

        res.send({
            request: result[result.length - 1]
        })

        for (let i = 0; i < result.length - 1; i++) {
            await queryExec('delete from request where reqID=?', [result[i].reqID])
        }
    } catch (err) {
        return errorHandler(err, res)
    }
}
