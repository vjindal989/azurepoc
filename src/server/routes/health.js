'use strict';
module.exports = (log, disableBearerCheck) => {
    return async (req,res) => {
        try {
            log.debug('calling route health');
            res.status(200).json({'status': 'OK', datetime: new Date(new Date().toUTCString()) });
        }
        catch(error){
            res.status(error.response!=null ? error.response.status : 500).json(
                {error: (error.response != null && error.response.data!=null && error.response.data.error!=null) ? 
                    error.response.data.error : 
                    (error.response != null && error.response.data!=null ? error.response.data : error.message)}
            );
        }
    }
};