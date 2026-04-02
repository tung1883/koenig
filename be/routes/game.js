var express = require('express');
var router = express.Router();

var { getUserGames, createGame } = require('../controller/finishedGame.controller')
var { verifyToken } = require('../controller/auth.controller');
const { sendMessage, getMessages, deleteMessages } = require('../controller/message.controller');
const { createActiveGame, getActiveGame, getLastMove, updateActiveGame, updateDrawOffer, getDrawOffer } = require('../controller/activeGame.controller');
const { getReceiverRequestList, getRequest, createRequest, requestResponse, getUserRequest} = require('../controller/request.controller');

router.post('/', getUserGames);
router.post('/new', createGame);

router.get('/new/active', verifyToken, getActiveGame)
router.post('/new/active', verifyToken, createActiveGame)
router.get('/new/active/:gameID', verifyToken, getLastMove)
router.post('/new/active/:gameID', verifyToken, updateActiveGame)
router.post('/new/active/draw/:gameID', verifyToken, updateDrawOffer)
router.get('/new/active/draw/:gameID/', verifyToken, getDrawOffer)

router.get('/request/receive', verifyToken, getReceiverRequestList)
router.get('/request/send', verifyToken, getUserRequest)
router.get('/request/:reqID', verifyToken, getRequest)
router.post('/request', verifyToken, createRequest)
router.post('/request/res', verifyToken, requestResponse)

router.post('/message/:gameID', verifyToken, sendMessage)
router.get('/message/:gameID', verifyToken, getMessages)
router.delete('/message/:gameID', verifyToken, deleteMessages)

module.exports = router;