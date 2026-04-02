var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors') 
const { buildCorsOptions } = require('./utils/cors')
const { metricsMiddleware, formatMetrics } = require('./observability/metrics')

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users')
var gameRouter = require('./routes/game')
const { ensureUserProfileColumns } = require('./controller/user.controller')

const db = require('./db')

db.ping()
  .then(() => console.log('connected to mysql server'))
  .catch((err) => console.error('mysql ping error: ' + err.message))

ensureUserProfileColumns()
  .then(() => console.log('user profile columns ready'))
  .catch((err) => console.error('ensure user profile columns error: ' + err.message))

var app = express()

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(metricsMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors(buildCorsOptions()))
app.get('/metrics', (req, res) => {
  res.setHeader('content-type', 'text/plain; version=0.0.4')
  res.send(formatMetrics())
})
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/game', gameRouter)

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

//handle server shutdown

module.exports = app;
