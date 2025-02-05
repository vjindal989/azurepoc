module.exports = (log, config) => {
    
    const form_vars = require( '../processors/calculation/form_vars.js' );
    const common = require( '../processors/calculation/common.js' );
    const helpers = require('../processors/calculation/helpers.js')(log);
    
    return{
        calc: async(event, lightReport) => {
            try {
                log.debug('calling calcSingleProcessor.calc with ' + lightReport)
                if (!event.body.highTarget) log.debug(JSON.stringify(event.body));
                if (event.body.c2 != null)
                {
                    if (!event.body.c2.FirstName) throw { "err": "Missing FirstName" };
                    if (!event.body.c2.LastName) throw { "err": "Missing LastName" };
                    if (!event.body.c2.DOB) throw { "err": "Missing Date of Birth" };
                    if (!event.body.c2.Sex) throw { "err": "Missing Sex" };
                }
                let user_supplied_vars = form_vars.getUserSuppliedVars(event.body);


                // event.body.DesiredRetirementIncome = 87304.68; //87478.62812500002;
                if (event.body.DesiredRetirementIncome)
                {
                    // we've been given a targetDisposableIncome so just use it
                    const responseTest = helpers.getProjections(user_supplied_vars, event.body.DesiredRetirementIncome, common.STRATEGY_REGISTERED_FUNDS_FIRST);
                    const nonRegisteredFirst = helpers.getProjections(user_supplied_vars, event.body.DesiredRetirementIncome, common.STRATEGY_NONREGISTERED_FUNDS_FIRST);
                    const taxFreeFirst = helpers.getProjections(user_supplied_vars, event.body.DesiredRetirementIncome, common.STRATEGY_TAXFREE_FUNDS_FIRST);
                    //return { "success": true, "registeredFundsFirst": responseTest, nonRegisteredFirst, taxFreeFirst, user_supplied_vars, "original_request": event.body };
                    
                    if (!lightReport){
                        var json = { "success": true, 
                        "registeredFundsFirst": responseTest, 
                        "nonRegisteredFirst" : nonRegisteredFirst,
                        "taxFreeFirst": taxFreeFirst, 
                        "user_supplied_vars": user_supplied_vars, "original_request": event.body };
                        json["considerations"] = helpers.getRulesTransform(helpers.getConsiderations(json));
                        return json;
                    }else{
                        var json = { "success": true, 
                        "registeredFundsFirst": helpers.getTransform(responseTest), 
                        "nonRegisteredFirst": helpers.getTransform(nonRegisteredFirst), 
                        "taxFreeFirst": helpers.getTransform(taxFreeFirst), 
                        "user_supplied_vars": user_supplied_vars, "original_request": event.body };
                        json["considerations"] = helpers.getRulesTransform(helpers.getConsiderations(json));
                        return json;
                    }
                }
                else
                {
                    // we need to calculate a max disposable income using the STRATEGY_REGISTERED_FUNDS_FIRST
                    const startTimestsamp = Date.now();
                    let maxIncomeCounter = 0;
                    let THRESHOLD = 10000;
                    let TIME_LIMIT = 20000;

                    let lowTarget = event.body.lowTarget || 0;
                    let highTarget = event.body.highTarget || 91406.24;
                    let midTarget = event.body.midTarget || (highTarget - lowTarget) / 2;
                    let responseTest = helpers.getProjections(user_supplied_vars, midTarget, common.STRATEGY_REGISTERED_FUNDS_FIRST);

                    // determine upper bound if first pass
                    if (!event.body.midTarget)
                    {
                        while ( responseTest.FinalEstateValue > THRESHOLD ) {
                            midTarget = highTarget;
                            highTarget *= 2;
                            if (Date.now() - startTimestsamp > TIME_LIMIT) {
                                // we are taking too long even in determining ceiling, omit the lowTarget in client response
                                log.debug(`-- timeout on ceiling ${ Math.round(lowTarget)} ${ Math.round(midTarget)} ${ Math.round(highTarget)}`);
                                return { "success": false, midTarget, highTarget };
                            }

                            log.debug(`-- upper limit testing ${ Math.round(lowTarget)} ${ Math.round(midTarget)} ${ Math.round(highTarget)}`);
                            responseTest = helpers.getProjections(user_supplied_vars, midTarget, common.STRATEGY_REGISTERED_FUNDS_FIRST);
                            maxIncomeCounter++;
                        }
                    }

                    // bisect until target THRESHOLD reached
                    while (responseTest.FinalEstateValue < 0 || responseTest.FinalEstateValue > THRESHOLD)
                    {
                        if (responseTest.FinalEstateValue < 0)
                        {
                            highTarget = midTarget;
                            midTarget = (highTarget + lowTarget) / 2;
                        }
                        else
                        {
                            lowTarget = midTarget;
                            midTarget = (highTarget + lowTarget) / 2;
                        }

                        if (highTarget < 200)
                        {
                            log.debug("target income approaching zero, accept that projection will be negative at end");
                            break;
                        }
                        else
                        {
                            if (Date.now() - startTimestsamp > TIME_LIMIT) {
                                // if we are taking too long then return the best income estimate we have so far
                                // and the client will decide whether to refine it more with another call
                                // or just make a final call with midTarget as the DesiredRetirementIncome
                                log.debug(`-- timeout ${ Math.round(lowTarget)} ${ Math.round(midTarget)} ${ Math.round(highTarget)}`);
                                return { "success": false, lowTarget, midTarget, highTarget };
                            } else {
                                log.debug(maxIncomeCounter + " getProjections for new midtarget: " + Math.round(midTarget) + " [" + Math.round(lowTarget) + "," + Math.round(highTarget) + "] --> " + Math.round(responseTest.FinalEstateValue));
                                responseTest = helpers.getProjections(user_supplied_vars, midTarget, common.STRATEGY_REGISTERED_FUNDS_FIRST);
                                maxIncomeCounter++;
                            }
                        }
                    }

                    if (Date.now() - startTimestsamp > TIME_LIMIT) {
                        // we are cutting it close to make the final report, force the client to make a new request
                        log.debug(`-- timeout on final ${ Math.round(lowTarget)} ${ Math.round(midTarget)} ${ Math.round(highTarget)}`);
                        return { "success": false, lowTarget, midTarget, highTarget };
                    }

                    let retirementIndex = user_supplied_vars.c1.Age < user_supplied_vars.c1.RetirementAge ? user_supplied_vars.c1.RetirementAge - user_supplied_vars.c1.Age : 0;
                    let di = responseTest.detailedIncomeProjection[retirementIndex].TotalDisposableIncome;
                    let infl = responseTest.detailedIncomeProjection[retirementIndex].InflationFactor;
                    log.debug("------------------------------ final c1 disposible income in retirement year " + Math.round(di) + " (" + Math.round(di/infl) + ") " + responseTest.FinalEstateValue + " at time " + (Date.now() - startTimestsamp));

                    let nonRegisteredFirst = helpers.getProjections(user_supplied_vars, midTarget, common.STRATEGY_NONREGISTERED_FUNDS_FIRST);
                    let taxFreeFirst = helpers.getProjections(user_supplied_vars, midTarget, common.STRATEGY_TAXFREE_FUNDS_FIRST);

                    // log.debug(responseTest);
                    if (!lightReport){
                        var json = { "success": true, midTarget, 
                        "registeredFundsFirst": responseTest, 
                        "nonRegisteredFirst": nonRegisteredFirst, 
                        "taxFreeFirst": taxFreeFirst, 
                        "user_supplied_vars": user_supplied_vars, "original_request": event.body };
                        json["considerations"] = helpers.getRulesTransform(helpers.getConsiderations(json));
                        return json;
                    }else{
                        var json = { "success": true, midTarget, 
                        "registeredFundsFirst": helpers.getTransform(responseTest), 
                        "nonRegisteredFirst": helpers.getTransform(nonRegisteredFirst), 
                        "taxFreeFirst": helpers.getTransform(taxFreeFirst), 
                        "user_supplied_vars": user_supplied_vars, "original_request": event.body };
                        json["considerations"] = helpers.getRulesTransform(helpers.getConsiderations(json));
                        return json;
                    }
                }
            }
            catch(error)
            {
                throw new Error(error);
            }
       } 
    }
}
