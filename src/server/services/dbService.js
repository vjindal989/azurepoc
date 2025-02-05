'use strict';

module.exports = (log, config) => {
  return {
    getPool(){
      const util = require('util')
      const mysql = require('mysql')
      const pool = mysql.createPool({
        connectionLimit: config.database.connectionlimit,
        host: config.database.host,
        port: config.database.port,
        user: config.database.user,
        password: config.database.password,
        database: config.database.db,
        typeCast: function (field, next) {
          if (field.type == 'JSON') {
            return (JSON.parse(field.string())); 
          }
          return next();
        }
      })
      
      // Ping database to check for common exception errors.
      pool.getConnection((err, connection) => {
        if (err) {
          if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            log.error('Database connection was closed.')
          }
          if (err.code === 'ER_CON_COUNT_ERROR') {
            log.error('Database has too many connections.')
          }
          if (err.code === 'ECONNREFUSED') {
            log.error('Database connection was refused.')
          }
        }
      
        if (connection) connection.release()
      
        return
      })
      
      // Promisify for Node.js async/await.
      pool.query = util.promisify(pool.query)
      
      return pool;
      
    }
  }
}