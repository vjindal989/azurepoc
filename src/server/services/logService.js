'use strict';
module.exports = (config) => {
    const log4js = require('log4js');
    log4js.configure({
      appenders: {
        out: { type: 'console' }
      },
      categories: {
        default: { appenders: [ 'out' ], level: 'debug' }
      }
    });
    var logger = log4js.getLogger();
    logger.level = config.logLevel;
    const _logLevels = {
        debug: 0,
        info: 1,
        error: 2,
        warn: 3
    };
    function _write(logLevel, msg){
        switch (logLevel){
            case _logLevels.debug:
                logger.debug(msg);
                break;
            case _logLevels.info:
                logger.info(msg);
                break;
            case _logLevels.warn:
                logger.warn(msg);
                break;
            case _logLevels.error:
                logger.error(msg);
                break; 
        }
    }
    return {
        debug: (msg) => { _write(_logLevels['debug'], msg) },  
        info: (msg) => { _write(_logLevels['info'], msg) },  
        warn: (msg) => { _write(_logLevels['warn'], msg) },  
        error: (msg) => { _write(_logLevels['error'], msg) }  
    }
}

