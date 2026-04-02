const { queryExec } = require("../db")
const { errorHandler } = require("./error.controller")

exports.sendMessage = async (req, res) => {
    const gameID = req?.params?.gameID
    const userID = res?.locals?.userID
    const message = req.body.message

    if (!gameID || !userID || !message) {
        return res.status(400).send({
            error: 'Server did not receive game ID, user ID or message'
        })
    }

    try {
        await queryExec('insert into message values(?, ?, ?)', [gameID, userID, message])
        const io = req.app.get('socketio')
        if (io) {
            io.to(`game:${gameID}`).emit('message:new', {
                gameID: Number(gameID),
                userID: Number(userID),
                message
            })
        }
        return res.send({
            'msg': 'Message sent'
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getMessages = async (req, res) => {
    const gameID = req?.params?.gameID

    if (!gameID ) {
        return res.status(400).send({
            error: 'Server did not receive game ID'
        })
    }

    try {
        const result = await queryExec('select userID, message from message where gameID=?', [gameID])
        return res.send({
            messageList: result
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.deleteMessages = async (req, res) => {
    const gameID = req?.params?.gameID

    if (!gameID ) {
        return res.status(400).send({
            error: 'Server did not receive game ID'
        })
    }

    try {
        await queryExec('delete from message where gameID=?', [gameID])
        return res.send({
            'msg': 'messages deleted'
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}
