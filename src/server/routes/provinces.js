'use strict';

module.exports = (log, prov, disableBearerCheck) => {
    return async (req, res) => {
        try {
            log.debug('calling route provinces');
            var data = await prov.rates(req);
            res.status(200).json(data);
        }
        catch(error){
            res.status(500).json(
                {error: error.message, stack: error.stack}
            );
        }
    }
}