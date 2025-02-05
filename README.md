# RESTful API Node Server for PureWealth's Cascade application

## Quick Start
Download the code and from the root of the project simply run:

```bash
npm install
```

Once the installation is over run the node server as 
```bash
npm start
```

The api is now available at http://localhost:8080

## Configuration Settings for Azure
The API uses many environment variables in order to access different systems. It is possible to load these settings as a JSON representation into Azure. The JSON below, shows the settings for the development environment (note that secret values have been marked with XXX).

The database values are not being used for now.

```json
[
  {
    "name": "CASCADES_PORT",
    "value": "8080",
    "slotSetting": false
  },
  {
    "name": "CASCADES_LOG_LEVEL",
    "value": "debug",
    "slotSetting": false
  },
  {
    "name": "CASCADES_DISABLE_BEARER_CHECK",
    "value": "true",
    "slotSetting": false
  },
  {
    "name": "CASCADES_IDENTITY_SERVER_JWKS_URI",
    "value": "https://reportingngisdev.azurewebsites.net/.well-known/openid-configuration/jwks",
    "slotSetting": false
  },
  {
    "name": "CASCADES_IDENTITY_SERVER_AUDIENCE",
    "value": "https://reportingngisdev.azurewebsites.net/resources",
    "slotSetting": false
  },
  {
    "name": "CASCADES_IDENTITY_SERVER_ISSUER",
    "value": "https://reportingngisdev.azurewebsites.net",
    "slotSetting": false
  },
  {
    "name": "CASCADES_IDENTITY_SERVER_ALGORITHM",
    "value": "RS256",
    "slotSetting": false
  },
  {
    "name": "CASCADES_IDENTITY_SERVER_SCOPE",
    "value": "cascades-api",
    "slotSetting": false
  },
  {
    "name": "CASCADES_DB_HOST",
    "value": "localhost",
    "slotSetting": false
  },
  {
    "name": "CASCADES_DB_USER",
    "value": "cascadesuser",
    "slotSetting": false
  },
  {
    "name": "CASCADES_DB_PASSWORD",
    "value": "XXX",
    "slotSetting": false
  },
  {
    "name": "CASCADES_DB_PORT",
    "value": "3306",
    "slotSetting": false
  },
  {
    "name": "CASCADES_DB_CONNECTION_LIMIT",
    "value": "10",
    "slotSetting": false
  },
  {
    "name": "WEBSITE_HTTPLOGGING_RETENTION_DAYS",
    "value": "7",
    "slotSetting": false
  }
]
```

## Configuration Setting Definition

Name | Definition
---- | ----------
CASCADES_PORT | the port of the node express application8080
CASCADES_LOG_LEVEL | the level of logging (debug|info|warn|error)
CASCADES_DISABLE_BEARER_CHECK | whether to disable bearer token checks
CASCADES_IDENTITY_SERVER_JWKS_URI | the JWT keys URI that is available on the identity server https://reportingngisdev.azurewebsites.net/.well-known/openid-configuration
CASCADES_IDENTITY_SERVER_AUDIENCE | the audience set in the JWT token by the identity server
CASCADES_IDENTITY_SERVER_ISSUER | the issuer set in the JWT token by the identity server
CASCADES_IDENTITY_SERVER_ALGORITHM | the JWT key signing algorithm
CASCADES_IDENTITY_SERVER_SCOPE | the scope that is set in the JWT token and what we validate for
CASCADES_DB_HOST | database host name
CASCADES_DB_USER | database user
CASCADES_DB_PASSWORD | database password
CASCADES_DB_PORT | database port
CASCADES_DB_DB | database name
CASCADES_DB_CONNECTION_LIMIT | database connection pool limit
WEBSITE_HTTPLOGGING_RETENTION_DAYS | set to 7 days for retention of application logs
