var express = require('express');
var router = express.Router();

var { signup, signin, resetPassword, requestPasswordReset, verifyToken } = require('../controller/auth.controller')
var { getUserList, getUsername, getMyProfile, updateMyProfile, getPublicProfile, uploadMyAvatar } = require('../controller/user.controller')
const { createRateLimiter } = require('../middleware/rateLimit')

const authLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: 'auth' })
const resetLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, keyPrefix: 'reset' })
const profileLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20, keyPrefix: 'profile' })

router.post('/sign_in', authLimiter, signin);
router.post('/sign_up', authLimiter, signup);
router.post('/reset_pwd/request', resetLimiter, requestPasswordReset);
router.post('/reset_pwd', resetLimiter, resetPassword);
router.get('/me/profile', verifyToken, getMyProfile)
router.put('/me/profile', verifyToken, profileLimiter, updateMyProfile)
router.post('/me/avatar', verifyToken, profileLimiter, uploadMyAvatar)
router.get('/profile/:userID', getPublicProfile)
router.get('/', getUserList)
router.post('/', getUsername)

module.exports = router;
