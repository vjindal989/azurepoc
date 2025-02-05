'use strict';

const express = require('express');
const router = require('express').Router();
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwksRsa = require('jwks-rsa');

module.exports = (dir,services) => {
    
    const app = express();
    const okta = require('./utils/introspect.js');

    var oktaAuthenticate = function (strategy, req, res, next) {
        var parts = req.header('authorization') && req.header('authorization').split(' ');
        if (!parts || parts.length !== 2) {
            throw new Error("Invalid authorization header.");
        }
        var token = parts[1];
        var creds = services.config.okta.getCreds(strategy);
        console.log(creds);
        
        return okta.isValid(creds.client_id, creds.client_secret, services.log, services.config, services.remoteService, token, (err, user) => {
            if (err) {
                services.log.error('error raised');
                services.log.error(err);
                return next(err);
            }
            if (!user || !user.active) {
                return res.status(401).json({error: "Unauthorized user."});
            }
            // Forward user information to the next middleware
            req['authInfo'] = user; 
            next();
        })
        .catch(error => { 
            services.log.error('error caught');
            services.log.error(error);
            return res.status(401).json({error: error.message});
        });
    };
  
    //https://stackoverflow.com/a/43634455
    var passportAuthenticate = function (req, res, next) {
        return passport.authenticate("jwt", {
            session: false
        }, (err, user, info) => {
            if (err) {
                services.log.error(err);
                return next(err);
            }
            if (!user) {
                return res.status(401).json({error: "Unauthorized user."});
            }
            // Forward user information to the next middleware
            req['authInfo'] = user; 
            next();
        })(req, res, next);
    }

    var jwtVerify = function(jwt_payload, done) {
        if(jwt_payload.scope.includes(services.config.identityserver.scope)){
            return done(null, jwt_payload);
        } else {
            return done(new Error("Invalid scope."), false);
        }
    };

    //https://www.npmjs.com/package/passport-jwt#include-the-jwt-in-requests
    passport.use(
        new JwtStrategy({
          // Dynamically provide a signing key based on the kid in the header and the signing keys provided by the JWKS endpoint.
          secretOrKeyProvider: jwksRsa.passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 5,
            jwksUri: services.config.identityserver.jwks_uri
          }),
          jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
          // Validate the audience and the issuer.
            audience: services.config.identityserver.audience,
            issuer: services.config.identityserver.issuer,
            algorithms: [ services.config.identityserver.algorithm ]
        },
        jwtVerify)
    );
      
    app.use(passport.initialize());

    router.get(`/`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : passportAuthenticate(req, res, next)
    }, require(dir + 'health.js')(services.log, services.config.disableBearerCheck));

    router.get(`/pf/whoami`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : passportAuthenticate(req, res, next)
    }, require(dir + 'whoami.js')(services.log, services.config.disableBearerCheck));

    router.post(`/pf/single_report`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : passportAuthenticate(req, res, next)
    }, require(dir + 'calc.js')(services.log, services.calculator, services.config.disableBearerCheck));

    router.post(`/pf/single_report_light`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : passportAuthenticate(req, res, next)
    }, require(dir + 'calc.js')(services.log, services.calculator, services.config.disableBearerCheck, true));

    /*
    router.get(`/provinces`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : passportAuthenticate(req, res, next)
    }, require(dir + 'provinces.js')(services.log, services.prov, services.config.disableBearerCheck));
    */
   
    router.get(`/chp/whoami`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : oktaAuthenticate('chp', req, res, next)
    }, require(dir + 'whoami.js')(services.log, services.config.disableBearerCheck));

    router.post(`/chp/single_report`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : oktaAuthenticate('chp', req, res, next)
    }, require(dir + 'calc.js')(services.log, services.calculator, services.config.disableBearerCheck));

    router.post(`/chp/single_report_light`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : oktaAuthenticate('chp', req, res, next)
    }, require(dir + 'calc.js')(services.log, services.calculator, services.config.disableBearerCheck, true));

    router.get(`/ppi/whoami`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : oktaAuthenticate('ppi', req, res, next)
    }, require(dir + 'whoami.js')(services.log, services.config.disableBearerCheck));

    router.post(`/ppi/single_report`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : oktaAuthenticate('ppi', req, res, next)
    }, require(dir + 'calc.js')(services.log, services.calculator, services.config.disableBearerCheck));

    router.post(`/ppi/single_report_light`, (req, res, next) => {
        services.config.disableBearerCheck ? next() : oktaAuthenticate('ppi', req, res, next)
    }, require(dir + 'calc.js')(services.log, services.calculator, services.config.disableBearerCheck, true));

    return router;    
}