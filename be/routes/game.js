var express = require('express');
var router = express.Router();

var { getUserGames, createGame } = require('../controller/finishedGame.controller')
var { verifyToken } = require('../controller/auth.controller');
const { sendMessage, getMessages, deleteMessages } = require('../controller/message.controller');
const { createActiveGame, getActiveGame, getLastMove, updateActiveGame, updateDrawOffer, getDrawOffer } = require('../controller/activeGame.controller');
const { getReceiverRequestList, getRequest, createRequest, requestResponse, getUserRequest, acceptRequestAndCreateGame } = require('../controller/request.controller');
const { createRateLimiter } = require('../middleware/rateLimit')

const moveLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 180, keyPrefix: 'move' })
const inviteLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 40, keyPrefix: 'invite' })
const messageLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 120, keyPrefix: 'message' })

router.post('/', getUserGames);
router.post('/new', createGame);

router.get('/new/active', verifyToken, getActiveGame)
router.post('/new/active', verifyToken, moveLimiter, createActiveGame)
router.get('/new/active/:gameID', verifyToken, getLastMove)
router.post('/new/active/:gameID', verifyToken, moveLimiter, updateActiveGame)
router.post('/new/active/draw/:gameID', verifyToken, moveLimiter, updateDrawOffer)
router.get('/new/active/draw/:gameID/', verifyToken, getDrawOffer)

router.get('/request/receive', verifyToken, getReceiverRequestList)
router.get('/request/send', verifyToken, getUserRequest)
router.get('/request/:reqID', verifyToken, getRequest)
router.post('/request', verifyToken, inviteLimiter, createRequest)
router.post('/request/res', verifyToken, inviteLimiter, requestResponse)
router.post('/request/:reqID/accept', verifyToken, inviteLimiter, acceptRequestAndCreateGame)

router.post('/message/:gameID', verifyToken, messageLimiter, sendMessage)
router.get('/message/:gameID', verifyToken, getMessages)
router.delete('/message/:gameID', verifyToken, deleteMessages)

module.exports = router;
