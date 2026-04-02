const db = require('../db')
const queryExec = db.queryExec
const { errorHandler } = require('./error.controller')

exports.getUserList = async (req, res) => {
    try {
        const result = await queryExec('select userID, user from user')
        return res.send(result)
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getUsername = async (req, res) => {
    const { userID } = req.body

    if (!userID) {
        return res.status(400).send({
            error: 'not providing userID'
        })
    }

    try {
        const result = await queryExec('select user from user where userID=?', [userID])
        return res.send(result[0])
    } catch (err) {
        return errorHandler(err, res)
    }
}
