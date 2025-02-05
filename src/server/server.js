// .env support
require('dotenv').config();

const services = require('./servicelayer')('./services');
const router = require('./router.js')("./routes/",services);;

// use express as the server
const express = require('express');

// support for http behaviours
const cors = require('cors');
const bodyParser = require('body-parser');

// instantiate express app
const app = express();

const Errors = require('./utils/Errors');

// disable some headers for express
app.disable('x-powered-by');

// server port comes from node environment or 8080 if not available in the environemnt variables.
let port = process.env.CASCADES_PORT || 8090;

// initialize http server variable
let httpServer = undefined;

// set cors middleware on all routes
app.use(
    cors({
        origin: function (origin, callback) {
            return callback(null, true);
        },
        optionsSuccessStatus: 200,
        credentials: true,
    })
);

// need to put the bodyParser middleware AFTER the proxy middleware, otherwise the POST requests will not be sent correctly to the proxied servers
app.use(bodyParser.json({}));
app.use(bodyParser.urlencoded({ extended: false }));


// wildcard route to ensure authentication is in play
app.post('/svc/*', (req, res, next) => {
    handleAuthenticationToken(req, res, next);
});

app.use('/svc/v1/calc', router);

function handleAuthenticationToken(req, res, next) {
    // TODO: add token handling here
    next();
}

// Catch 404 and forward to error handler
app.use((req, res, next) => {
    next(Errors.notFound());
});

// Error handler doesn't send stack trace in production or other environment
app.use((err, req, res, next) => {
    const body = Errors.responseBody(err);
    const status = body.status;
    res.status(status);
    res.send(body);
});

// Export app, start(), and stop() for use by other scripts.
const server = { app };
module.exports = server;

server.start = (port, callback) => {
    httpServer = app.listen(port, callback);
};

server.stop = (callback) => {
    if (httpServer) {
        httpServer.close(callback);
    }
    httpServer = undefined;
};

// When this script is run directly (not required by another), start the server.
if (require.main === module) {
    server.start(port, () => {
        console.log('server started on port: ' + port);
    });
}
