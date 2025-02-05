const axios = require('axios');
const FormData = require('form-data');
const qs = require("qs");
const https = require('https');
const Agent = require('agentkeepalive');

module.exports = (log, config) => {
    const agent = new https.Agent({
        maxSockets: 100,
        maxFreeSockets: 10,
        timeout: 60000, // active socket keepalive for 60 seconds
        freeSocketTimeout: 30000, // free socket keepalive for 30 seconds
        rejectUnauthorized: config.rejectUnauthorizedCerts
      }); 

    const axiosInstance = axios.create({httpsAgent: agent});

    return {
        callApi: async (host, url, method, data, headers) => {
            var isJson = headers['Content-Type'] && headers['Content-Type'] == 'application/json';
            log.debug(isJson ? data : qs.stringify(data));
            if(method == 'GET'){
                return axiosInstance.get(`${host}${url}`, 
                    {
                        params: data,
                        headers: headers
                    })
                .then(response => {
                    //log.debug(response.data);
                    return response;
                })
                .catch(error => { 
                   // log.error(error);
                    throw error
                })
            }else if(method == 'POST'){
                return axiosInstance({
                    url: url,
                    method: method,
                    baseURL: host,
                    data: isJson ? data : qs.stringify(data),
                    headers: headers
                })
                .then(response => {
                    //log.debug(response.data);
                    return response;
                })
                .catch(error => { 
                    //log.error(error);
                    throw error
                })
            }else if(method == 'PATCH' || method == 'DELETE'){
                return axiosInstance({
                    url: url,
                    method: method,
                    baseURL: host,
                    data: data,
                    headers: headers
                })
                .then(response => response)
                .catch(error => { 
                    //log.error(error);
                    throw error
                })
            }
        }
    }
};