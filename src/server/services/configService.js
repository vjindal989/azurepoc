'use strict';
module.exports = () => {
    return {
        disableBearerCheck: process.env.CASCADES_DISABLE_BEARER_CHECK == 'true' ? true : false,
        logLevel: process.env.CASCADES_LOG_LEVEL,
        database: {
            host: process.env.CASCADES_DB_HOST,
            user: process.env.CASCADES_DB_USER,
            password: process.env.CASCADES_DB_PASSWORD,
            port: process.env.CASCADES_DB_PORT,
            db: process.env.CASCADES_DB_DB,
            connectionlimit: process.env.CASCADES_DB_CONNECTION_LIMIT
        },
        identityserver:{
            jwks_uri: process.env.CASCADES_IDENTITY_SERVER_JWKS_URI,
            audience: process.env.CASCADES_IDENTITY_SERVER_AUDIENCE,
            issuer: process.env.CASCADES_IDENTITY_SERVER_ISSUER,
            algorithm: process.env.CASCADES_IDENTITY_SERVER_ALGORITHM,
            scope: process.env.CASCADES_IDENTITY_SERVER_SCOPE
        },
        okta: { 
            getCreds: (app) => {
                switch(app.toUpperCase()){
                    case "CHP":
                        return {
                            "client_id" :process.env.OKTA_CHP_CLIENT_ID,
                            "client_secret" : process.env.OKTA_CHP_CLIENT_SECRET_ID
                        }
                    case "PPI":
                        return {
                            "client_id" :process.env.OKTA_PPI_CLIENT_ID,
                            "client_secret" : process.env.OKTA_PPI_CLIENT_SECRET_ID
                        }
                    default:
                        throw new Error(`Invalid app of ${app.toUpperCase()}`);
                }
            }
        }
    }
}