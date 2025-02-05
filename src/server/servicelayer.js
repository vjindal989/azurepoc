'use strict';
module.exports = (dir) => {
    const config = require(dir + '/configService')();
    const log = require(dir + '/logService')(config);
    const remoteService = require(dir + '/httpHelper')(log, config);
    const database = require(dir + '/dbService')(log, config);
    const prov = require(dir + '/provService')(log, config, database);
    const calculatorSingleProcessor = require(dir + '/calcSingleProcessor')(log, config);
    const calculator = require(dir + '/calcService')(log, config, calculatorSingleProcessor);
    return {
        config,
        log,
        prov,
        calculator,
        calculatorSingleProcessor,
        database,
        remoteService
    };
}