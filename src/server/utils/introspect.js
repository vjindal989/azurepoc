'use strict';

//https://github.com/pmcdowell-okta/nodejs-oidc-introspect
var atob = require('atob');
var validator = require('validator');
var https = require("https");

async function isValid(client_id, client_secret, log, config, remoteService, token, callback){
    log.debug(client_id);
    log.debug(client_secret);
    var result = decodeToken(token) 
    if (result != 0) {
        var tokenType = result.payload.scp ? "id_token" : "token";
        log.debug("Token type: " + tokenType);
        await Promise.resolve(checkOktaIntrospect(log, remoteService, result.payload.iss, token, tokenType, client_id, client_secret, callback).then(response => {
            callback(null, response);
        })
        .catch(error => { 
            log.error(error);
            callback(error, null);
        }))
    } else {
        log.debug("Unable to decode token " + token);
        callback(new Error("Unable to decode token " + token), null)
    }
    }

function decodeToken(token) {
    var segments = token.split('.');

    if (segments.length !== 3) {
        return 0
    }

    // All segment should be base64
    var headerSeg = segments[0];
    var payloadSeg = segments[1];
    var signatureSeg = segments[2];


    var header = base64urlDecode(headerSeg);
    var payload = base64urlDecode(payloadSeg);

    if (!validator.isJSON(header) ||
        !validator.isJSON(payload)) {
        return ( 0 )
    }
    return {
        header: JSON.parse(header),
        payload: JSON.parse(payload),
        signature: signatureSeg
    }
}

async function checkOktaIntrospect (log, remoteService, iss, token, token_type, client_id, client_secret, callback ) {

    var oktaOrg = iss;
    var OktaIntrospectUrl = ""
    var host = iss;
    iss = iss.replace('https:\/\/', '')

    //check to see if this is from OIDC server or Authorization Server

    if (  ((iss.match(/\//g) || []).length) == 0 )  {
        //This is an OIDC id_token of access_token
        OktaIntrospectUrl = "/oauth2/v1/introspect"

    } else { //This came from the Authorization Server
        var temp = iss.split("/")
        OktaIntrospectUrl = "/"+temp[1]+"/"+temp[2]+"/v1/introspect"
        iss = temp[0]
    }

    //End check for OIDC or Authorization Server

    //setup basic authentication
    var username = client_id
    var password = client_secret
    var auth = 'Basic ' + new Buffer.from(username + ':' + password).toString('base64');

    const urlObject = new URL(host);
    log.debug("Making introspect call to " + urlObject.protocol + '//' + urlObject.host + OktaIntrospectUrl);
    //throw new Error("dd");
    //return null;
    const promises = await Promise.resolve(
        remoteService.callApi(urlObject.protocol + '//' + urlObject.host, OktaIntrospectUrl+"?token="+token+"&token_type_hint=id_token&grant_type=",
            'POST', 
            {},                       
            {
                "content-type": "application/x-www-form-urlencoded",
                "accept": "application/json",
                "authorization": auth,
                "cache-control": "no-cache",
            }
        )
        ).then((resp, i) => {
            return resp.data;
        })
    return promises;     
}

function base64urlDecode(str) {
    return new Buffer.from(base64urlUnescape(str), 'base64').toString();
}

function base64urlUnescape(str) {
        str += Array(5 - str.length % 4).join('=');
    return str.replace(/\-/g, '+').replace(/_/g, '/');
}

module.exports = { isValid }