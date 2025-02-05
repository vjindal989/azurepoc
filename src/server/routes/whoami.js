'use strict';
module.exports = (log, disableBearerCheck) => {
    return async (req,res) => {
        try {
            log.debug('calling route whoami');
            const claimCheckNeeded = !disableBearerCheck;
            const claimValue = !disableBearerCheck && req.authInfo ? req.authInfo['email'] : Date.now();
            if(claimCheckNeeded){
                // Service relies on the name claim.  
                res.status(200).json({'email': claimValue, 'sub': req.authInfo['sub'], 'given_name' : req.authInfo['given_name'], 'family_name': req.authInfo['family_name'] });
            }else{
                res.status(401).json({error: "Claim checks are not enabled"});
            }
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