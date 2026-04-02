var express = require('express');
var router = express.Router();

var { signup, signin, resetPassword } = require('../controller/auth.controller')
var { getUserList, getUsername } = require('../controller/user.controller')

router.post('/sign_in', signin);
router.post('/sign_up', signup);
router.post('/reset_pwd', resetPassword);
router.get('/', getUserList)
router.post('/', getUsername)

module.exports = router;
