'use strict';
let Validator = require('validatorjs');

module.exports = (log, calculator, disableBearerCheck, lightReport = false) => {
    return (req, res) => {
        log.debug('calling route single_report with ' + lightReport);
        let data = req && req.body ? req.body : {};

        // validate the object
        let rules = {
            InvestmentRiskProfile: 'required|string',
            c1: {
                FirstName: 'required|string|min:1|max:40',
                LastName: 'required|string|min:1|max:40',
                DOB: 'required|string|min:10|max:10',
                Sex: 'required|string',
                RetirementAge: 'required|numeric|min:0|max:999',
                EmploymentIncome: 'required|numeric|min:0',
                PensionPaymentAnnual: 'required|numeric|min:0',
                PensionStartAge: 'required|numeric|min:0',
                PensionPaymentAnnual2: 'required|numeric|min:0',
                PensionChangeAge: 'required|numeric|min:0',
                IndexedPension: 'required|string|min:2|max:3',
                CPPAnnualPayment: 'required|numeric|min:0',
                CPPStartAge: 'required|numeric|min:0',
                OASAnnualPayment: 'required|numeric|min:0',
                RRSPMarketValue: 'required|numeric|min:0',
                RRSPContributionPayment: 'required|numeric|min:0',
                RRSPContributionLimitCarried: 'required|numeric|min:0',
                DCPlanMarketValue: 'required|numeric|min:0',
                DCEmployeeContribution: 'required|numeric|min:0',
                DCEmployerContribution: 'required|numeric|min:0',
                LIRAMarketValue: 'required|numeric|min:0',
                RRIFMarketValue: 'required|numeric|min:0',
                ExistingLIFMarketValue: 'required|numeric|min:0',
                TFSAHoldings: 'required|numeric|min:0',
                TFSAContributionRoom: 'required|numeric|min:0',
                NRAccountValue: 'required|numeric|min:0',
                CustomIncomeSources: 'required|array',
            }
        }

        let validation = new Validator(data, rules);
        let validationErrors = validation.fails();
        if (validationErrors) {
            const result = {
                status: {
                    statusCode: 100,
                    statusMessage: 'fail'
                },
                errors: validation.errors.all(),
            };
            res.json(result);
        }
        else {

            // calc
            calculator.calc(req, lightReport).then(calcResponse => {
                // const result = {
                //     status: {
                //         statusCode: 0,
                //         statusMessage: 'success'
                //     },
                //     calcResponse: calcResponse
                // };
                res.json(calcResponse);
            }).catch(error => {
                res.status(500).json(
                    {error: error.message}
                );
            });
        }
    }
};