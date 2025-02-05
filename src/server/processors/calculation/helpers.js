'use strict';

const { json } = require("body-parser");

module.exports = (log) => {

    var transform = require("node-json-transform").transform;
    
    const rules  = require("../../utils/rules.js");
    const fs = require('fs');
    const p = require( './provincial_constants.json' );
    const ph = require( './provincial_constants.js' );
    const g = require( './global_constants.json' );
    const gh = require( './global_constants.js' );
    const common = require( './common.js' );
    const bisections = require( './bisections.js' )(log);
    const bisections_couple = require( './bisections_couple.js' )(log);
    const joint_last_to_die = require( './joint_last_to_die.js' );
    
    
    let MAX_DISPOSABLE_INC_TRIES = 30;
    let semiRetTargets = {};
    
    // from original VB code
    const paTol = 5;
    const paTolCouple = 10;
    const maxYrsProj = 100;
    const cplRrifDepTol = 5;
    
    return{
        getProjections(user_supplied_vars, targetDisposableIncome, strategy)
        {
            let isCouple = user_supplied_vars.c2 != null && user_supplied_vars.c2.ProvinceCode != null;
            let solveTolerance = isCouple ? 0.05 : 0.01;
            let solveToleranceAdditional = 0;
        
            let responseObj = {};
            responseObj.detailedIncomeProjection = [];
            responseObj.detailedSavingsProjection = [];
            responseObj.detailedEstateProjection = [];
            responseObj.startYear = (new Date()).getFullYear();
        
            // calculate even level withdrawals for Registered Funds First strategy
            if (isCouple) {
                responseObj.planEndAge = gh.getLifeExpectancyObject(user_supplied_vars.c1.Age)["Planning_Age_"+user_supplied_vars.c1.Sex];
                if (user_supplied_vars.c1.Sex == "Female") {
                    responseObj.numPlanYears = Math.min(this.getPaCouple(user_supplied_vars.c1.Age, user_supplied_vars.c2.Age), maxYrsProj);
                    responseObj.MortalityYear = responseObj.startYear + this.getLastToDie(user_supplied_vars.c1.Age, user_supplied_vars.c2.Age);
                } else {
                    responseObj.numPlanYears = Math.min(this.getPaCouple(user_supplied_vars.c2.Age, user_supplied_vars.c1.Age), maxYrsProj);
                    responseObj.MortalityYear = responseObj.startYear + this.getLastToDie(user_supplied_vars.c2.Age, user_supplied_vars.c1.Age);
                }
                responseObj.endYear = responseObj.startYear + responseObj.numPlanYears;
                this.populateRRIFAndLIFIndexesCouple(strategy, user_supplied_vars, responseObj.numPlanYears);
                // log.debug("============================= We have a couple to project! plan end: " + strategy + " " + responseObj.endYear + " " + targetDisposableIncome + " | " + user_supplied_vars.c1.LIRATransferAge + " | " + user_supplied_vars.c2.LIRATransferAge);
            }
            else {
                responseObj.planEndAge = gh.getLifeExpectancyObject(user_supplied_vars.c1.Age)["Planning_Age_"+user_supplied_vars.c1.Sex];
                responseObj.MortalityYear = responseObj.startYear + gh.getLifeExpectancyObject(user_supplied_vars.c1.Age)["Expectancy_"+user_supplied_vars.c1.Sex] - user_supplied_vars.c1.Age;
                responseObj.numPlanYears = responseObj.planEndAge - user_supplied_vars.c1.Age;
                responseObj.endYear = responseObj.startYear + responseObj.numPlanYears;
                this.populateRRIFAndLIFIndexes(strategy, user_supplied_vars.c1, responseObj.numPlanYears);
            }
        
            //if (strategy == 0) log.debug("Mortality year: " + responseObj.MortalityYear);
        
        
            responseObj.RRSPTransferAge = user_supplied_vars.c1.RRSPTransferAge;
            responseObj.LIRATransferAge = user_supplied_vars.c1.LIRATransferAge;
            responseObj.EndRRIFAge = user_supplied_vars.c1.endRRIFIndex + user_supplied_vars.c1.Age;
            responseObj.EndLIFAge = user_supplied_vars.c1.endLIFIndex + user_supplied_vars.c1.Age;
            // log.debug(strategy + " initial C1 Ages - RRSPTrans: " + responseObj.RRSPTransferAge + " LIRATrans: " + responseObj.LIRATransferAge + " EndRRIF: " + responseObj.EndRRIFAge + " EndLIF: " + responseObj.EndLIFAge);
            if (isCouple) {
                responseObj.RRSPTransferAgeSpouse = user_supplied_vars.c2.RRSPTransferAge;
                responseObj.LIRATransferAgeSpouse = user_supplied_vars.c2.LIRATransferAge;
                responseObj.EndRRIFAgeSpouse = user_supplied_vars.c2.endRRIFIndex + user_supplied_vars.c2.Age;
                responseObj.EndLIFAgeSpouse = user_supplied_vars.c2.endLIFIndex + user_supplied_vars.c2.Age;
                // log.debug(strategy + " initial C2 Ages - RRSPTrans: " + responseObj.RRSPTransferAgeSpouse + " LIRATrans: " + responseObj.LIRATransferAgeSpouse + " EndRRIF: " + responseObj.EndRRIFAgeSpouse + " EndLIF: " + responseObj.EndLIFAgeSpouse);
            }
        
            let maxcount = 0;
            for (let i = 0; i <= responseObj.numPlanYears; i++)
            {
                let dip = { TotalDisposableIncome: 0, TotalDisposableIncomeCouple: 0 };
                let dsp = { TFSADeposit: 0, DepositToNonRegSavings: 0, DepositToLoan: 0, JointDepositToNonRegSavingsSpouse1: 0, JointDepositToNonRegSavingsSpouse2: 0 };
                let pivotVars = common.getEmptyPivotVars();
        
                // for singles these can stay at 0 defaults
                dip.spouse = { TotalDisposableIncome: 0 };
                dsp.spouse = { TFSADeposit: 0, DepositToNonRegSavings: 0, DepositToLoan: 0, JointDepositToNonRegSavingsSpouse1: 0, JointDepositToNonRegSavingsSpouse2: 0 };
                pivotVars.spouse = common.getEmptyPivotVars();
        
                // Some global fields are filled out here
                dip.Year = responseObj.startYear+i;
                dip.Age = user_supplied_vars.c1.Age + i;
                dsp.Year = responseObj.startYear+i;
                dsp.Age = user_supplied_vars.c1.Age + i;
                dip.InflationFactor = Math.pow(1+user_supplied_vars.Inflation, i);
                dsp.InflationFactor = dip.InflationFactor;
                // log.debug(i + " " + dip.Year + " " + dip.Age + " :: " + dip.InflationFactor);
                let isNeitherRetired = dip.Age < user_supplied_vars.c1.RetirementAge;
                let isSemiRetired = false;
                if (isCouple) {
                    dip.spouse.Year = responseObj.startYear+i;
                    dip.spouse.Age = user_supplied_vars.c2.Age + i;
                    dsp.spouse.Year = responseObj.startYear+i;
                    dsp.spouse.Age = user_supplied_vars.c2.Age + i;
                    dip.spouse.InflationFactor = Math.pow(1+user_supplied_vars.Inflation, i);
                    dsp.spouse.InflationFactor = Math.pow(1+user_supplied_vars.Inflation, i);
                    isSemiRetired = dip.Age < user_supplied_vars.c1.RetirementAge != dip.spouse.Age < user_supplied_vars.c2.RetirementAge
                    isNeitherRetired = dip.Age < user_supplied_vars.c1.RetirementAge && dip.spouse.Age < user_supplied_vars.c2.RetirementAge;
                }
        
                let customAdditionalDisposableIncome = 0;
                if (user_supplied_vars.CustomWithdrawals[dsp.Age] != null && !isSemiRetired) {
                    customAdditionalDisposableIncome = user_supplied_vars.CustomWithdrawals[dsp.Age]*dsp.InflationFactor;
                    // log.debug("custom wd for additional income at age " + dsp.Age + " " + customAdditionalDisposableIncome);
                }
        
        
                // our target income level which is key for the pivots
                let nominalDisposableIncomeTarget;
                if (isSemiRetired) {
                    nominalDisposableIncomeTarget = semiRetTargets[dip.Year];
                    if (nominalDisposableIncomeTarget == null) nominalDisposableIncomeTarget = -1;
                }
                else {
                    nominalDisposableIncomeTarget = isNeitherRetired ? -1 : targetDisposableIncome*dsp.InflationFactor + customAdditionalDisposableIncome;
                }
        
                let count = 0;
                let isResolved = false;
                while (!isResolved)
                {
                    // post-retirement income target is diferent for singles vs couples
                    let responseIncome = isCouple ? dip.TotalDisposableIncomeCouple : dip.TotalDisposableIncome;
        
                    //if (dip.Year == 2040 && strategy == 0) log.debug(i + " " + count + " not resolved " + responseIncome + " " + nominalDisposableIncomeTarget);
        
        
                    // for large incomes we need to be less exact or else pivots won't resolve.
                    if (nominalDisposableIncomeTarget > 300000) solveToleranceAdditional = Math.log(nominalDisposableIncomeTarget);
        
                    // if retired or semi-retired we loop until our set post-retirement income is reached
                    if (count > 1 && nominalDisposableIncomeTarget != -1 && Math.abs(responseIncome - nominalDisposableIncomeTarget) < solveTolerance + solveToleranceAdditional) {
                        // log.debug(dsp.Year + " " + count + " solved! " + nominalDisposableIncomeTarget);
                        isResolved = true;
                    }
        
                    //if we are not retired we do at most one bisection if there was a TFSA transfer and then we are done
                    if (isNeitherRetired && count > 0) {
                        isResolved = true;
                    }
        
                    if (count > MAX_DISPOSABLE_INC_TRIES) {
                        let details = strategy + ": " + dsp.Year + " " + i + " pivot round " + count + ": " + responseIncome + " " + nominalDisposableIncomeTarget;
                        log.error(details);
                        throw { "err": "disposible income is not resolving!", "details": details };
                    }
                    count++;
        
                    if (isCouple)
                    {
                        common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, user_supplied_vars, dsp, dip, pivotVars);
                        common.populateSavingsAndIncomeProjections(true, responseObj, strategy, i, user_supplied_vars, dsp, dip, pivotVars);
                        bisections_couple.getCouplePivotVars(responseObj, i, count, strategy, nominalDisposableIncomeTarget, dip.TotalDisposableIncomeCouple, user_supplied_vars, dip, dsp, pivotVars);
                        if (strategy == 0 && isSemiRetired) {
                            semiRetTargets[dip.Year] = dip.TotalDisposableIncomeCouple + customAdditionalDisposableIncome;
                            nominalDisposableIncomeTarget = semiRetTargets[dip.Year];
                            // log.debug(dsp.Year + " " + count + " semiRet target now: " + nominalDisposableIncomeTarget);
                        }
                    }
                    else
                    {
                        common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, user_supplied_vars, dsp, dip, pivotVars);
                        bisections.getSinglePivotVars(responseObj, i, count, strategy, nominalDisposableIncomeTarget, dip.TotalDisposableIncome, user_supplied_vars, dip, dsp, pivotVars);
                    }
                }
                if (count > maxcount) maxcount = count;
        
                responseObj.detailedIncomeProjection.push(dip);
                responseObj.detailedSavingsProjection.push(dsp);
                let dep = this.getEstateProjection(user_supplied_vars, false, null, dip, dsp);
                if (isCouple) {
                    dep = this.getEstateProjection(user_supplied_vars, true, dep, dip, dsp);
                }
                responseObj.detailedEstateProjection.push(dep);
        
                /////////////////////////
                //dip.adjTaxes = (dip.TotalTaxes + dip.spouse.TotalTaxes) / dsp.InflationFactor;
        
                //if (dsp.Year == 2018) log.debug(dsp);
                //if (dsp.Year == 2040 && strategy == 0) log.debug(dip);
                //if (dsp.Year == 2037) log.debug(dep);
        
                // if (dsp.Year == responseObj.MortalityYear) log.debug(dsp.Age + " " + strategy + "---------------------------------- EstateValue " + Math.round(dsp.EstateValue / dsp.InflationFactor) + " " + Math.round(dep.NetEstate / dsp.InflationFactor));
            }
        
            // log.debug(strategy + " max count: " + maxcount);
        
            /*
            for (let k = 0; k < responseObj.detailedIncomeProjection.length; k++)
            {
                let taxes = responseObj.detailedIncomeProjection[k].TotalTaxes;
                if (isCouple) taxes += responseObj.detailedIncomeProjection[k].spouse.TotalTaxes;
                if (strategy == 1) log.debug(strategy + ": " + responseObj.detailedIncomeProjection[k].Year + " net est. " + Math.round(responseObj.detailedEstateProjection[k].NetEstate / responseObj.detailedIncomeProjection[k].InflationFactor) + " gross est: " +  Math.round(responseObj.detailedSavingsProjection[k].EstateValue) + " taxes: " + Math.round(taxes / responseObj.detailedIncomeProjection[k].InflationFactor));
            }
            */
        
            /*
            let totalTaxesPaid = 0;
            let at83 = detailedIncomeProjection.length - 15;
            for (let i = 0; i < at83; i++)
            {
                totalTaxesPaid += (detailedIncomeProjection[i].TotalTaxes/detailedIncomeProjection[i].InflationFactor) + (detailedIncomeProjection[i].OASClawback/detailedIncomeProjection[i].InflationFactor);
            }
            log.debug(strategy + "Total Taxes + Clawback: " + Math.round(totalTaxesPaid));
            */
        
            responseObj.FinalEstateValue = responseObj.detailedSavingsProjection[responseObj.detailedSavingsProjection.length - 1].EstateValue;
            if (strategy == 0) log.debug("----------------- income target is: " + Math.round(targetDisposableIncome) + " results in " + Math.round(responseObj.FinalEstateValue));
            return responseObj;
        },
        
        
        getEstateTax(prov, dep, dsp, dip, grossIncome)
        {
            dep.FederalTaxPayable = gh.getFedTax(grossIncome, dip.InflationFactor);
            dep.FederalPersonalAmount = dip.FederalPersonalAmount;
            if (dip.Age < 65) {
                dep.FederalAgeAmount = 0;
            } else {
                if (grossIncome < g.FEDERAL_AA_CLAWBACK_THRESHOLD*dip.InflationFactor) {
                    dep.FederalAgeAmount = g.FED_TAX_RATES[0]*g.FEDERAL_AGE_AMOUNT_BASE_CREDITS*dip.InflationFactor;
                } else {
                    dep.FederalAgeAmount = g.FED_TAX_RATES[0]*Math.max(0, g.FEDERAL_AGE_AMOUNT_BASE_CREDITS*dip.InflationFactor - g.FED_TAX_RATES[0]*(grossIncome - g.FEDERAL_AA_CLAWBACK_THRESHOLD*dip.InflationFactor));
                }
            }
            dep.FederalPensionCredits = dip.FederalPensionCredits;
            dep.FederalEligibleDividendDeduction = dip.FederalEligibleDividendDeduction;
            dep.FederalIneligibleDividendDeduction = dip.FederalIneligibleDividendDeduction;
            let netFedTax = Math.max(dep.FederalTaxPayable - (dep.FederalPersonalAmount+dep.FederalAgeAmount+dep.FederalPensionCredits+dep.FederalEligibleDividendDeduction+dep.FederalIneligibleDividendDeduction), 0);
        
            dep.ProvinceTaxPayable = ph.getProvTax(prov, grossIncome, dip.InflationFactor);
            dep.ProvincePersonalAmount = dip.ProvincePersonalAmount;
        
        
        
            let baseAgeCredits = 0;
            let basePensionCredits = Math.min(p.provinces[prov].MAX_PENSION_CREDITS*dip.InflationFactor, p.provinces[prov].PENSION_INCOME_GROSS_UP*dip.pensionIncomeForCredits);
            let aa_clawback = p.provinces[prov].AA_CLAWBACK_THRESHOLD*dip.InflationFactor;
            let clawbackOnAgeAndPension = 0;
            if (dip.Age < 65) {
                dep.ProvinceAgeAmount = 0;
            } else {
                baseAgeCredits = p.provinces[prov].AGE_AMOUNT_BASE_CREDITS*dip.InflationFactor;
                if (prov == "QC")
                {
                    clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(grossIncome - aa_clawback, 0));
                    dep.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*(baseAgeCredits - (baseAgeCredits/(baseAgeCredits+basePensionCredits))*clawbackOnAgeAndPension);
                }
                else
                {
                    if (grossIncome < aa_clawback) {
                        dep.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*baseAgeCredits;
                    } else {
                        dep.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*Math.max(0, baseAgeCredits - g.FED_TAX_RATES[0]*(grossIncome - aa_clawback));
                    }
                }
            }
        
        
            if (prov == "QC")
            {
                if (basePensionCredits == 0) {
                    dep.ProvincePensionCredits = 0;
                } else {
                    dep.ProvincePensionCredits = p.provinces[prov].TAX_RATES[0]*(basePensionCredits - (basePensionCredits/(baseAgeCredits+basePensionCredits))*clawbackOnAgeAndPension);
                }
            }
            else
            {
                dep.ProvincePensionCredits = dip.ProvincePensionCredits;
            }
        
            if (prov == "QC") {
                dep.FederalTaxAbatement = p.provinces[prov].FED_TAX_ABATEMENT_RATE*netFedTax;
            } else {
                dep.FederalTaxAbatement = 0;
            }
        
            let taxPayableForSurtax = Math.max(dep.ProvinceTaxPayable - (dep.ProvincePersonalAmount+dep.ProvinceAgeAmount+dep.ProvincePensionCredits), 0);
            dep.ProvinceSurTax = ph.getProvSurTax(prov, taxPayableForSurtax, dip.InflationFactor);
            dep.ProvinceEligibleDividendCredit = dip.ProvinceEligibleDividendCredit;
            dep.ProvinceIneligibleDividendCredit = dip.ProvinceIneligibleDividendCredit;
        
            return netFedTax + Math.max(taxPayableForSurtax+dep.ProvinceSurTax-dep.ProvinceEligibleDividendCredit-dep.ProvinceIneligibleDividendCredit-dep.FederalTaxAbatement, 0);
        },
        
        
        getEstateProjection(parent_user_supplied_vars, isC2, parentDEP, parentDIP, parentDSP)
        {
            let prov = parent_user_supplied_vars.c1.ProvinceCode;
            let dep, dip, dsp, user_supplied_vars;
            if (isC2) {
                parentDEP.spouse = {};
                dep = parentDEP.spouse;
                dsp = parentDSP.spouse;
                dip = parentDIP.spouse;
                user_supplied_vars = parent_user_supplied_vars.c2;
            } else {
                parentDEP = {};
                dep = parentDEP;
                dsp = parentDSP;
                dip = parentDIP;
                user_supplied_vars = parent_user_supplied_vars.c1;
            }
        
            dep.Year = dip.Year;
            dep.Age = dip.Age;
        
            // get taxes from liquidating registered accounts
            dep.AdditionalIncomeForRegLiquidation = dsp.RRSPMarketValueEnd - dsp.RRIFNew + dsp.RRIFMarketValueEnd + dsp.DCPlanMarketValueEnd - dsp.LIRANew + dsp.LIRAMarketValueEnd - dsp.LIFNew  + dsp.LIFMarketValueEnd;
            dep.AdjustedGrossIncome = dip.TotalTaxableIncome + dep.AdditionalIncomeForRegLiquidation;
            dep.TaxesAfterRegLiquidation = this.getEstateTax(prov, dep, dsp, dip, dep.AdjustedGrossIncome);
            dep.ResultantDisposableIncomeOnRegLiquidation = dep.AdjustedGrossIncome - dip.RetainedReturnsNonRegSavings + dip.WithdrawalFromSavingsAccounts - dip.ContributionsToSavingsAccounts
                + dip.LineOfCreditLoanTaken - dip.LineOfCreditLoanRepayment - dep.TaxesAfterRegLiquidation - dip.BusinessDividendGrossDown
                + common.getCustomIncome(dip, user_supplied_vars, "TaxFreeAmount", false);
            dep.ChangeInDisposableIncomeDueToRegLiquidation = dep.ResultantDisposableIncomeOnRegLiquidation - dip.TotalDisposableIncome;
        
            // get taxes from realized captial gains in non-reg accounts
            dep.NonRegCapGain = 0.5 * (dsp.NonRegisteredSavingsEnd - dsp.NonRegisteredSavingsEndACB + 0.5*(parentDSP.JointNonRegisteredSavingsEnd - parentDSP.JointNonRegisteredSavingsEndACB));
            dep.GrossIncomeAfterNonRegCapGain = dep.AdjustedGrossIncome + dep.NonRegCapGain;
            dep.TaxesAfterCapGain = this.getEstateTax(prov, dep, dsp, dip, dep.GrossIncomeAfterNonRegCapGain);
            dep.NetNonRegisteredSavings = dsp.NonRegisteredSavingsEnd + 0.5*parentDSP.JointNonRegisteredSavingsEnd - (dep.TaxesAfterCapGain - dep.TaxesAfterRegLiquidation);
            dep.TaxOnNonRegCapGains = dsp.NonRegisteredSavingsEnd + 0.5*parentDSP.JointNonRegisteredSavingsEnd - dep.NetNonRegisteredSavings;
        
            // Global fields for both singles and couples
            if (isC2)
            {
                parentDEP.DeltaDIForRegLiquidationCouple = parentDEP.ChangeInDisposableIncomeDueToRegLiquidation + parentDEP.spouse.ChangeInDisposableIncomeDueToRegLiquidation;
                parentDEP.NonRegisteredSavings = parentDSP.NonRegisteredSavingsEnd + parentDSP.spouse.NonRegisteredSavingsEnd + parentDSP.JointNonRegisteredSavingsEnd;
        
                parentDEP.NetNonRegisteredSavings = parentDEP.NetNonRegisteredSavings + parentDEP.spouse.NetNonRegisteredSavings;
                parentDEP.TaxOnNonRegCapGains = parentDEP.TaxOnNonRegCapGains + parentDEP.spouse.TaxOnNonRegCapGains;
        
                parentDEP.TaxFreeSavings = parentDSP.TFSAHoldingsEnd + parentDSP.spouse.TFSAHoldingsEnd + parentDIP.CorporateEndMarketValue + parentDIP.spouse.CorporateEndMarketValue;
                parentDEP.GrossEstate = parentDEP.AdditionalIncomeForRegLiquidation + parentDEP.spouse.AdditionalIncomeForRegLiquidation + parentDEP.NonRegisteredSavings + parentDEP.TaxFreeSavings - parentDSP.LineOfCreditEndBalance;
        
                if (parentDEP.GrossEstate < 0) parentDEP.DeltaDIForRegLiquidationCouple = 0;
                parentDEP.AfterTaxEstate = parentDEP.GrossEstate - parentDEP.AdditionalIncomeForRegLiquidation - parentDEP.spouse.AdditionalIncomeForRegLiquidation + parentDEP.DeltaDIForRegLiquidationCouple - parentDEP.TaxOnNonRegCapGains;
        
                parentDEP.NetTaxOnRegLiquidationInEstate = parentDEP.GrossEstate - parentDEP.AfterTaxEstate - parentDEP.TaxOnNonRegCapGains;
                if (parentDEP.NetTaxOnRegLiquidationInEstate < 0) parentDEP.NetTaxOnRegLiquidationInEstate = 0;
        
                if (p.provinces[prov].PROBATE_FLAT_FEE != null)
                    parentDEP.ProbateTax = p.provinces[prov].PROBATE_FLAT_FEE;
                else
                    parentDEP.ProbateTax = parentDEP.GrossEstate <= 0 ? 0 : Math.min(parentDEP.GrossEstate,p.provinces[prov].PROBATE_LEVELS[0])*p.provinces[prov].PROBATE_RATES[0] + Math.max(parentDEP.GrossEstate-p.provinces[prov].PROBATE_LEVELS[0],0)*p.provinces[prov].PROBATE_RATES[1];
        
                const grossEstateLessCorp = parentDEP.GrossEstate - parentDIP.CorporateEndMarketValue;
                parentDEP.LegalAndAccountingFees = grossEstateLessCorp < 0 ? 0 : grossEstateLessCorp*0.03;
                parentDEP.TotalOfEstateDeductions = parentDEP.NetTaxOnRegLiquidationInEstate + parentDEP.ProbateTax + parentDEP.LegalAndAccountingFees + parentDEP.TaxOnNonRegCapGains;
                parentDEP.NetEstate = parentDEP.AfterTaxEstate - parentDEP.ProbateTax - parentDEP.LegalAndAccountingFees;
                parentDEP.NetEstatePlusLifeInsuranceDeathBenefit = parentDEP.NetEstate + 0;
        
                // log.debug(parentDEP.Age + " " + Math.round(parentDEP.AdjustedGrossIncome) + " " + Math.round(parentDEP.GrossEstate) + " " + Math.round(parentDEP.NetEstate));
            }
            else
            {
                dep.NonRegisteredSavings = dsp.NonRegisteredSavingsEnd;
                dep.TaxFreeSavings = dsp.TFSAHoldingsEnd + dip.CorporateEndMarketValue;
                dep.GrossEstate = dep.AdditionalIncomeForRegLiquidation + dep.NonRegisteredSavings + dep.TaxFreeSavings - dsp.LineOfCreditEndBalance;
                dep.AfterTaxEstate = dep.GrossEstate - dep.AdditionalIncomeForRegLiquidation + dep.ChangeInDisposableIncomeDueToRegLiquidation - dep.TaxOnNonRegCapGains;
                dep.NetTaxOnRegLiquidationInEstate = dep.GrossEstate - dep.AfterTaxEstate - dep.TaxOnNonRegCapGains;
        
                if (p.provinces[prov].PROBATE_FLAT_FEE != null)
                    dep.ProbateTax = p.provinces[prov].PROBATE_FLAT_FEE;
                else
                    dep.ProbateTax = dep.GrossEstate < 0 ? 0 : Math.min(dep.GrossEstate,p.provinces[prov].PROBATE_LEVELS[0])*p.provinces[prov].PROBATE_RATES[0] + Math.max(dep.GrossEstate-p.provinces[prov].PROBATE_LEVELS[0],0)*p.provinces[prov].PROBATE_RATES[1];
        
                const grossEstateLessCorp = dep.GrossEstate - dip.CorporateEndMarketValue;
                dep.LegalAndAccountingFees = grossEstateLessCorp < 0 ? 0 : grossEstateLessCorp*0.03;
                dep.TotalOfEstateDeductions = dep.NetTaxOnRegLiquidationInEstate + dep.ProbateTax + dep.LegalAndAccountingFees + dep.TaxOnNonRegCapGains;
                dep.NetEstate = dep.AfterTaxEstate - dep.ProbateTax - dep.LegalAndAccountingFees;
                dep.NetEstatePlusLifeInsuranceDeathBenefit = dep.NetEstate + 0;
            }
        
            return parentDEP;
        },
        
        
        populateRRIFAndLIFIndexes(strategy, user_supplied_vars, planEndIndex)
        {
            // to ensure LIRA/LIF and RRSP/RRIF growth isn't double counted in the case where it is forced in the first year
            // set Retirement age to be no less then current age
            user_supplied_vars.RetirementAge = Math.max(user_supplied_vars.RetirementAge, user_supplied_vars.Age);
        
            // Pivoting LIF and RIFF transfer ages
            // for most strategies set to max and we will pivot down if needed
            user_supplied_vars.RRSPTransferAge = 71;
            user_supplied_vars.LIRATransferAge = 71;
            if (strategy == common.STRATEGY_REGISTERED_FUNDS_FIRST) {
                user_supplied_vars.RRSPTransferAge = Math.min(user_supplied_vars.RetirementAge, 71);                  // E12
                user_supplied_vars.LIRATransferAge = Math.min(Math.max(user_supplied_vars.RetirementAge, 55), 71);    // N4
            }
        
            // Reg-first Level vars final drawdown values
            user_supplied_vars.evenRRIFDrawdown = 0;
            user_supplied_vars.evenLIFDrawdown = 0;
        
            // calculation indexes
            user_supplied_vars.startIndex = user_supplied_vars.RetirementAge - user_supplied_vars.Age;
            user_supplied_vars.initLIFIndex = Math.max( Math.min( Math.max(user_supplied_vars.RetirementAge, 55), 71) - user_supplied_vars.Age, 0 );
            user_supplied_vars.initRRIFIndex = Math.max( Math.min(user_supplied_vars.RetirementAge, 71) - user_supplied_vars.Age, 0 );
        
            // want to deplete 3*paTol years before pa but we must take at least (paTol) payments (index is (paTol-1) as yr 0 is pmt 1)
            let depletionTargetAge = gh.getLifeExpectancyObject(user_supplied_vars.RetirementAge)["RRIF_Depletion_Target_" + user_supplied_vars.Sex];
            user_supplied_vars.endRRIFIndex = Math.max( Math.max(planEndIndex - 3 * paTol, depletionTargetAge - user_supplied_vars.Age), user_supplied_vars.startIndex + paTol - 1);
            user_supplied_vars.endLIFIndex = Math.max( g.EARLIEST_LIF_DEPLETION_AGE - user_supplied_vars.Age, user_supplied_vars.startIndex + paTol - 1);
        
            //if (strategy == 0) log.debug("rrif indexes: " + user_supplied_vars.initRRIFIndex + " " + user_supplied_vars.startIndex + " " + user_supplied_vars.endRRIFIndex);
            //if (strategy == 0) log.debug("lif indexes: " + user_supplied_vars.initLIFIndex + " " + user_supplied_vars.startIndex + " " + user_supplied_vars.endLIFIndex);
        },
        
        populateRRIFAndLIFIndexesCouple(strategy, user_supplied_vars, planEndIndex)
        {
            // to ensure LIRA/LIF and RRSP/RRIF growth isn't double counted in the case where it is forced in the first year
            // set Retirement age to be no less then current age
            user_supplied_vars.c1.RetirementAge = Math.max(user_supplied_vars.c1.RetirementAge, user_supplied_vars.c1.Age);
            user_supplied_vars.c2.RetirementAge = Math.max(user_supplied_vars.c2.RetirementAge, user_supplied_vars.c2.Age);
        
            // Pivoting LIF and RIFF transfer ages
            // for most strategies set to max and we will pivot down if needed
            user_supplied_vars.c1.RRSPTransferAge = 71;
            user_supplied_vars.c1.LIRATransferAge = 71;
            user_supplied_vars.c2.RRSPTransferAge = 71;
            user_supplied_vars.c2.LIRATransferAge = 71;
            if (strategy == common.STRATEGY_REGISTERED_FUNDS_FIRST) {
                user_supplied_vars.c1.RRSPTransferAge = Math.min(user_supplied_vars.c1.RetirementAge, 71);                  // E12
                user_supplied_vars.c1.LIRATransferAge = Math.min(Math.max(user_supplied_vars.c1.RetirementAge, 55), 71);    // N4
                user_supplied_vars.c2.RRSPTransferAge = Math.min(user_supplied_vars.c2.RetirementAge, 71);                  // E12
                user_supplied_vars.c2.LIRATransferAge = Math.min(Math.max(user_supplied_vars.c2.RetirementAge, 55), 71);    // N4
            }
        
            // Reg-first Level vars final drawdown values
            user_supplied_vars.c1.evenRRIFDrawdown = 0;
            user_supplied_vars.c1.evenLIFDrawdown = 0;
            user_supplied_vars.c2.evenRRIFDrawdown = 0;
            user_supplied_vars.c2.evenLIFDrawdown = 0;
        
            // calculation indexes
            user_supplied_vars.c1.startIndex = user_supplied_vars.c1.RetirementAge - user_supplied_vars.c1.Age;
            user_supplied_vars.c1.initLIFIndex = Math.max( Math.min( Math.max(user_supplied_vars.c1.RetirementAge, 55), 71) - user_supplied_vars.c1.Age, 0 );
            user_supplied_vars.c1.initRRIFIndex = Math.max( Math.min(user_supplied_vars.c1.RetirementAge, 71) - user_supplied_vars.c1.Age, 0 );
            user_supplied_vars.c2.startIndex = user_supplied_vars.c2.RetirementAge - user_supplied_vars.c2.Age;
            user_supplied_vars.c2.initLIFIndex = Math.max( Math.min( Math.max(user_supplied_vars.c2.RetirementAge, 55), 71) - user_supplied_vars.c2.Age, 0 );
            user_supplied_vars.c2.initRRIFIndex = Math.max( Math.min(user_supplied_vars.c2.RetirementAge, 71) - user_supplied_vars.c2.Age, 0 );
        
        
            let maxStartIndex = Math.max(user_supplied_vars.c1.startIndex, user_supplied_vars.c2.startIndex);
            user_supplied_vars.c1.endRRIFIndex = Math.max(planEndIndex - paTolCouple - cplRrifDepTol, maxStartIndex + cplRrifDepTol - 1)
            user_supplied_vars.c2.endRRIFIndex = Math.max(planEndIndex - paTolCouple - cplRrifDepTol, maxStartIndex + cplRrifDepTol - 1)
            user_supplied_vars.c1.endLIFIndex = Math.max(g.EARLIEST_LIF_DEPLETION_AGE - user_supplied_vars.c1.Age, maxStartIndex + cplRrifDepTol - 1)
            user_supplied_vars.c2.endLIFIndex = Math.max(g.EARLIEST_LIF_DEPLETION_AGE - user_supplied_vars.c2.Age, maxStartIndex + cplRrifDepTol - 1)
        
        
            //if (strategy == 0) log.debug("rrif indexes couple: " + user_supplied_vars.c1.initRRIFIndex + " " + user_supplied_vars.c1.startIndex + " " + user_supplied_vars.c1.endRRIFIndex);
            //if (strategy == 0) log.debug("lif indexes couple: " + user_supplied_vars.c1.initLIFIndex + " " + user_supplied_vars.c1.startIndex + " " + user_supplied_vars.c1.endLIFIndex);
        },
        
        getPaCouple(ageF, ageM)
        {
            // [ceiling of lookup table value for Joint Last to Die LE] + [tolerance on LE] + [correction for any spouse under 30 as table only goes 30-100]
            let jltd = this.getLastToDie(ageF, ageM);
            return  Math.ceil(jltd + paTolCouple + Math.max(30 - Math.min(ageF, ageM), 0));
        },
        
        getLastToDie(ageF, ageM)
        {
            let coF = ageF - 30;
            if (coF < 0) coF = 0;
            if (coF >= joint_last_to_die.joint_last_to_die.length) coF = joint_last_to_die.joint_last_to_die.length - 1;
        
            let coM = ageM - 30;
            if (coM < 0) coM = 0;
            if (coM >= joint_last_to_die.joint_last_to_die.length) coM = joint_last_to_die.joint_last_to_die.length - 1;
        
        
            let jltd = joint_last_to_die.joint_last_to_die[coF][coM];
            //log.debug("joint last to die: " + jltd + " " + coF + "," + coM);
            return  Math.ceil(jltd);
        },

        getRulesTransform(obj){
            var map = {
                item: {
                    id: "id",
                    title: "title",
                    content: "content"
                }
            };
            return transform(obj,map);
        },
        
        getTransform(obj){
            var map = {
                item: {
                    //detailedIncomeProjection: "detailedIncomeProjection",
                    detailedIncomeProjection: "detailedIncomeProjection",
                    detailedSavingsProjection: "detailedSavingsProjection",
                    detailedEstateProjection: "detailedEstateProjection",
                    startYear: "startYear",
                    endYear: "endYear",
                    MortalityYear: "MortalityYear",
                    EndRRIFAge: "EndRRIFAge",
                    EndLIFAge: "EndLIFAge"
                },
                operate: [
                  {
                    run: function(ary) { 
                      return transform(ary, detailedIncomeProjectionMap);
                    }, 
                    on: "detailedIncomeProjection"
                  },
                  {
                    run: function(ary) { 
                      return transform(ary, detailedSavingsProjectionMap);
                    }, 
                    on: "detailedSavingsProjection"
                  },
                  {
                    run: function(ary) { 
                      return transform(ary, detailedEstateProjectionMap);
                    }, 
                    on: "detailedEstateProjection"
                  }
                ]
            };

            var detailedIncomeProjectionMap = {
                "item" : {
                    TotalTaxes: "TotalTaxes",
                    RRIFPaymentWithdrawn: "RRIFPaymentWithdrawn",
                    LIFPaymentReceived: "LIFPaymentReceived",
                    CanadaPensionPlan: "CanadaPensionPlan",
                    OldAgeSecurity: "OldAgeSecurity",
                    PensionIncome: "PensionIncome",
                    Year: "Year",
                    Age: "Age",
                    InflationFactor: "InflationFactor"
                }
            };

            var detailedSavingsProjectionMap = {
                "item" : {
                    TFSAWithdrawal: "TFSAWithdrawal",
                    WithdrawalFromNonRegSavings: "WithdrawalFromNonRegSavings",
                    LIFPaymTFSAContributionentReceived: "TFSAContribution",
                    Year: "Year",
                    Age: "Age",
                    RRIFMarketValueEnd: "RRIFMarketValueEnd"
                }
            };

            var detailedEstateProjectionMap = {
                "item" : {
                    NetEstate: "NetEstate",
                    GrossEstate: "GrossEstate",
                    TotalOfEstateDeductions: "TotalOfEstateDeductions",
                    Year: "Year",
                    Age: "Age"
                }
            };

            return transform(obj,map);
        },

        getConsiderations(object, strategy = "default", filterBy = []){
            var file = `src/server/considerations/${strategy}.json`;
            if(!fs.existsSync(file)){
                throw new Error(`Unable to load ${strategy} considerations file.`);
            }
            let data = fs.readFileSync(file, 'utf8');
            let json = JSON.parse(data);
            
            //https://jsonpath-plus.github.io/JSONPath/docs/ts/
            return json.filter(function(consideration){
                return (filterBy.length === 0 || filterBy.includes(consideration.id)) &&
                    rules.evaluateRules(log, object, consideration.rules)
            });

            return rules;
        }
    }
}
