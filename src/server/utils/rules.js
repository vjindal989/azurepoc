'use strict';

//const jp = require('jsonpath');
const JSONPath = require('jsonpath-plus');

function evaluateRule(log, a, b, comparison){
    var aIsArray = Array.isArray(a);
    var bIsArray = Array.isArray(b);
    var aVal = (aIsArray ? a.length : a);
    var bVal = (bIsArray ? b.length : b);

    log.debug(`Comparing ${JSON.stringify(a)} (${aIsArray ? aVal : "Not array"}) ${comparison} ${JSON.stringify(b)} (${bIsArray ? bVal : "Not array"})`);
    switch (comparison)
    {
        case "<":
            return aVal < bVal;
        case ">":
            return aVal > bVal;
        case "==":
            return aVal == bVal;
        case "contains":
            return b.includes(a[0]);
        default:
            throw new Error(`Unknown comparison: ${comparison}.`);
    }
}

function evaluateRules(log, object, rules) {
    if(rules == null || rules.length == 0) return false;
    
    for (var i = 0; i < rules.length; i++) 
    {
        log.debug(`Testing ${rules[i].a} ${rules[i].comparison} ${rules[i].b}`);
        var result = this.evaluateRule(
            log,
            //rules[i].a.toString().substring(0,1) == "$" ? jp.query(object, rules[i].a) : rules[i].a,
            //rules[i].b.toString().substring(0,1) == "$" ? jp.query(object, rules[i].b) : rules[i].b,
            rules[i].a.toString().substring(0,1) == "$" ? JSONPath.JSONPath({path: rules[i].a, json: object}) : rules[i].a,
            rules[i].b.toString().substring(0,1) == "$" ? JSONPath.JSONPath({path: rules[i].b, json: object}) : rules[i].b,
            rules[i].comparison
        )
        if (!result) return false;
    }
    return true;
}

module.exports = {evaluateRules, evaluateRule}