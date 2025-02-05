'use strict';

module.exports = (log, config, calculatorSingleProcessor) => {
    return{
        calc: async(req, lightReport) =>{
            log.debug('calling calcService.calc with ' + lightReport);
            return await calculatorSingleProcessor.calc(req, lightReport);
        }
    }
}