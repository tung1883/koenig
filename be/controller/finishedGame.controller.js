const db = require('../db')
const { errorHandler } = require('./error.controller')

const queryExec = db.queryExec

// functions work primarily on the game table
// see active_game file if you want functions on the active_game table
exports.getUserGames = async (req, res) => {
    const { gameID, p1, p2 } = req.body

    if (!gameID && !p1 && !p2) {
        return res.status(200).send({
            message: 'Invalid input!'
        })
    }

    try {
        let result = null
        if (gameID) {
            result = await queryExec('select * from game where gameID = ?', [gameID])
        } else {
            result = await queryExec('select * from game where wp = ? and bp = ?', [p1, p2])
        }
        return res.status(200).send(result)
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.createGame = async (req, res) => {
    let { wp, bp, date, result, record, timer } = req.body

    if (!record) {
        return res.status(400).send({
            message: 'No game record is provided'
        })
    }

    if (!date) date = null
    else date = date.slice(0, date.lastIndexOf('T'))

    try {
        await queryExec('insert into game(wp, bp, date, result, record, timer) values(?, ?, ?, ?, ?, ?)', 
            [wp, bp, date, result, record, timer])
        return res.sendStatus(200)
    } catch (err) {
        return errorHandler(err, res)
    }
}

