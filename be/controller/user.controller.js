const db = require('../db')
const fs = require('fs')
const path = require('path')
const queryExec = db.queryExec
const { errorHandler } = require('./error.controller')

const ensureColumn = async (sql) => {
    try {
        await queryExec(sql)
    } catch (err) {
        if (err?.code === 'ER_DUP_FIELDNAME') return
        throw err
    }
}

exports.ensureUserProfileColumns = async () => {
    await ensureColumn('ALTER TABLE user ADD COLUMN displayName VARCHAR(80) NULL')
    await ensureColumn('ALTER TABLE user ADD COLUMN bio VARCHAR(280) NULL')
    await ensureColumn('ALTER TABLE user ADD COLUMN avatarUrl VARCHAR(500) NULL')
}

exports.getUserList = async (req, res) => {
    try {
        const result = await queryExec('select userID, user, displayName, avatarUrl from user')
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
        const result = await queryExec('select user, displayName, avatarUrl from user where userID=?', [userID])
        return res.send(result[0])
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getMyProfile = async (req, res) => {
    const userID = Number(res.locals?.userID)
    if (!userID) {
        return res.status(403).send({ error: 'unauthorized' })
    }

    try {
        const result = await queryExec(
            'select userID, user, displayName, bio, avatarUrl from user where userID=?',
            [userID]
        )
        if (!result?.length) {
            return res.status(404).send({ error: 'user not found' })
        }
        return res.send(result[0])
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.getPublicProfile = async (req, res) => {
    const userID = Number(req.params?.userID)
    if (!userID) {
        return res.status(400).send({ error: 'invalid userID' })
    }
    try {
        const result = await queryExec(
            'select userID, user, displayName, bio, avatarUrl from user where userID=?',
            [userID]
        )
        if (!result?.length) {
            return res.status(404).send({ error: 'user not found' })
        }
        return res.send(result[0])
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.updateMyProfile = async (req, res) => {
    const userID = Number(res.locals?.userID)
    if (!userID) {
        return res.status(403).send({ error: 'unauthorized' })
    }

    const displayNameRaw = req.body?.displayName
    const bioRaw = req.body?.bio
    const avatarUrlRaw = req.body?.avatarUrl

    const displayName = typeof displayNameRaw === 'string' ? displayNameRaw.trim() : null
    const bio = typeof bioRaw === 'string' ? bioRaw.trim() : null
    const avatarUrl = typeof avatarUrlRaw === 'string' ? avatarUrlRaw.trim() : null

    if (displayName && displayName.length > 80) {
        return res.status(400).send({ error: 'displayName max length is 80' })
    }
    if (bio && bio.length > 280) {
        return res.status(400).send({ error: 'bio max length is 280' })
    }
    if (avatarUrl && avatarUrl.length > 500) {
        return res.status(400).send({ error: 'avatarUrl max length is 500' })
    }
    if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
        return res.status(400).send({ error: 'avatarUrl must start with http:// or https://' })
    }

    try {
        await queryExec(
            'update user set displayName=?, bio=?, avatarUrl=? where userID=?',
            [displayName || null, bio || null, avatarUrl || null, userID]
        )

        const result = await queryExec(
            'select userID, user, displayName, bio, avatarUrl from user where userID=?',
            [userID]
        )
        return res.send(result[0] || null)
    } catch (err) {
        return errorHandler(err, res)
    }
}

exports.uploadMyAvatar = async (req, res) => {
    const userID = Number(res.locals?.userID)
    if (!userID) {
        return res.status(403).send({ error: 'unauthorized' })
    }

    const imageData = String(req.body?.imageData || '')
    const match = imageData.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i)
    if (!match) {
        return res.status(400).send({ error: 'Invalid image format. Use PNG, JPEG or WEBP.' })
    }

    try {
        const mimeExt = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase()
        const binary = Buffer.from(match[2], 'base64')
        const maxBytes = 2 * 1024 * 1024
        if (binary.length > maxBytes) {
            return res.status(400).send({ error: 'Image too large. Max 2MB.' })
        }

        const avatarsDir = path.join(__dirname, '..', 'public', 'uploads', 'avatars')
        fs.mkdirSync(avatarsDir, { recursive: true })
        const fileName = `u${userID}-${Date.now()}.${mimeExt}`
        const filePath = path.join(avatarsDir, fileName)
        fs.writeFileSync(filePath, binary)

        const origin = `${req.protocol}://${req.get('host')}`
        const avatarUrl = `${origin}/uploads/avatars/${fileName}`

        await queryExec('update user set avatarUrl=? where userID=?', [avatarUrl, userID])
        const result = await queryExec(
            'select userID, user, displayName, bio, avatarUrl from user where userID=?',
            [userID]
        )
        return res.send(result[0] || null)
    } catch (err) {
        return errorHandler(err, res)
    }
}
