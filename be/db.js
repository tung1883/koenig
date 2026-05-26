let mysql
try {
  mysql = require('mysql2')
} catch (_) {
  mysql = require('mysql')
}
const env = require('dotenv').config().parsed

const db = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PWD,
  database: 'chess_web',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
})

db.queryExec = (query, values) => {
  return new Promise((res, rej) => {
    db.query(query, values, (err, result) => {
      if (err) rej(err)
      else res(result)
    })
  })
}

db.ping = () => {
  return new Promise((res, rej) => {
    db.getConnection((err, connection) => {
      if (err) return rej(err)
      connection.ping((pingErr) => {
        connection.release()
        if (pingErr) return rej(pingErr)
        return res(true)
      })
    })
  })
}

//check if query result is ok packet
db.checkOkPacket = (result) => {
  return result && typeof result === 'object' &&
    'fieldCount' in result &&
    'affectedRows' in result &&
    'insertId' in result &&
    'serverStatus' in result &&
    'warningCount' in result
}

module.exports = db;
