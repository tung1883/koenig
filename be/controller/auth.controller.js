require('dotenv').config()

const db = require('../db')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')

const queryExec = db.queryExec
const { errorHandler } = require('./error.controller')

const SESSION_TIME = 2 * 60 * 60 * 1000
const JWT_SECRET = process.env.JWT_SECRET || process.env.API_KEY

exports.signin = async (req, res) => {
    const user = req.body?.user
    const pwd = req.body?.pwd

    try {
        const result = await queryExec('select userID, pwd from user where user=?', [user])
        if (result.length === 0 || !bcrypt.compareSync(pwd, result[0].pwd)) {
            return res.status(401).send("Invalid username or password")
        }

        const userID = result[0].userID
        if (!JWT_SECRET) {
            return res.status(500).send('Server auth secret is not configured')
        }

        const token = jwt.sign({
            user: user,
            userID: userID
        }, JWT_SECRET, {
            expiresIn: 5 * 60 * 1000
        })
        const tokenPayload = token.substr(0, token.lastIndexOf('.') + 1)
        const tokenSignature = token.substr(token.lastIndexOf('.') + 1)

        res.status(200)
        res.cookie('token_signature', tokenSignature, {
            httpOnly: true, 
            secure: true, 
            sameSite: 'None',
            maxAge: SESSION_TIME
        })
        res.cookie('token_payload', tokenPayload, {
            secure: true, 
            sameSite: 'None',
            maxAge: SESSION_TIME
        })
        res.cookie('user', user, {
            secure: true,
            sameSite: 'None',
            maxAge: SESSION_TIME
        })
        res.cookie('userID', userID, {
            secure: true, 
            sameSite: 'None',
            maxAge: SESSION_TIME
        })

        return res.send({
            message: "Login sucessfully", tokenPayload, tokenSignature, userID, user, maxAge: SESSION_TIME
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.signup = async (req, res) => {
    const user = req.body?.user
    const pwd = req.body?.pwd

    if (!user || !pwd) return res.status(400).send('user or pwd is not specified')

    const hashedPwd = bcrypt.hashSync(pwd, 8)

    try {
        const result = await queryExec('select user from user where user=?', [user])
        if (result.length !== 0) {
            throw Error('User is already taken')
        }

        await queryExec('insert into user(user, pwd) values(?, ?)', [user, hashedPwd])
        return res.send({
            message: "Sign up sucessfully"           
        })
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.resetPassword = async (req, res) => {
    const user = req.body?.user
    const pwd = req.body?.pwd

    if (!user || !pwd) return res.status(400).send('user or pwd is not specified')

    const hashedPwd = bcrypt.hashSync(pwd, 8)
    try {
        const result = await queryExec('select user from user where user=?', [user])
        if (result.length === 0) {
            throw Error('User does not exist')
        }

        await queryExec('update user set pwd=? where user=?', [hashedPwd, user])
        return res.send({
            message: "Reset password sucessfully"           
        })
    } catch (err) { 
        return errorHandler(err, res)
    }
}

exports.verifyToken = (req, res, next) => {
    const tokenPayload = req.cookies?.token_payload
    const tokenSignature = req.cookies?.token_signature
    const token = tokenPayload && tokenSignature ? `${tokenPayload}${tokenSignature}` : null

    if (!token) {
        return res.status(403).send({
            message: 'No token provided'
        })
    }

    try {
        if (!JWT_SECRET) {
            return res.status(500).send({
                message: 'Server auth secret is not configured'
            })
        }

        const decoded = jwt.verify(token, JWT_SECRET)
        if (!decoded?.userID) return res.status(403).send({
            message: 'Can not grab username after verifying token'
        })
        res.locals.userID = decoded.userID
        next()
    } catch (e) {
        res.status(403).send({
            message: 'Error when verifying authentication token...'
        })
    }
}
