'use strict';
const errors = {};
module.exports = errors;

errors.error = (status, message, detail, cause) => {
    if (detail) {
        message += ': ' + detail;
    }
    const error = new Error(message);
    error.status = status;
    if (cause) {
        error.cause = cause;
    }
    return error;
};

errors.badRequest = (detail, cause) => {
    return errors.error(400, 'Bad request', detail, cause);
};

errors.unauthorized = (cause) => {
    return errors.error(401, 'Unauthorized', undefined, cause);
};

errors.notFound = (cause) => {
    return errors.error(404, 'Not found', undefined, cause);
};

errors.methodNotAllowed = (cause) => {
    return errors.error(405, 'Method not allowed', undefined, cause);
};

errors.conflict = (detail, cause) => {
    return errors.error(409, 'Conflict', detail, cause);
};

errors.internalServerError = (cause) => {
    return errors.error(500, 'Internal server error', undefined, cause);
};

errors.responseBody = (error) => {
    const status = error.status || 500;
    const body = { status: status };
    if (error.message) {
        body.message = error.message;
    }
    return body;
};

errors.stackWithCause = (error) => {
    let result = error.stack;
    for (let i = 0; error.cause && i < 4; i++) {
        error = error.cause;
        if (error) {
            result += '\nCaused by ' + (error.stack || util.inspect(error));
        }
    }
    return result;
};
