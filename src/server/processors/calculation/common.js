const g = require( './global_constants.json' );
const gh = require( './global_constants.js' );
const p = require( './provincial_constants.json' );
const ph = require( './provincial_constants.js' );


//couples
exports.bsTolGolden = 0.1;
const bsMaxLoopsGolden = 30;

const gblAssumedLifReturn = 0.06;
const bsMaxLoops = 30;
const bsTol = 0.01;
const gldRt = 0.61803;

/*
Imposed RIFF - even draw down of RIFF from retirement to 5 years prior to (life expectancy at retirement)
Imposed LIF - even draw down to age 90
1. Imposed RRIF and LIF payments
2. Non-Registered Savings (joint first for a couple)
3. TFSA
4. Remaining LIF up to LIF Max
5. Remaining RRIF money
6. Line of Credit
*/
exports.STRATEGY_REGISTERED_FUNDS_FIRST = 0;


/*
1. Minimum RRIF and LIF payments
2. Non-Registered Savings (joint first for a couple)
3. Remaining LIF up to LIF Max
4. Remaining RRIF money
5. TFSA
6. Line of Credit
*/
exports.STRATEGY_NONREGISTERED_FUNDS_FIRST = 1;


/*
1. Minimum RRIF and LIF payments
2. Non-Registered Savings (joint first for a couple)
3. TFSA
4. Remaining LIF up to LIF Max
5. Remaining RRIF money
6. Line of Credit
*/
exports.STRATEGY_TAXFREE_FUNDS_FIRST = 2;


/* This is 10^(-10) and is used as a tolerance to correct double variables that should
'be 0 back to 0 when floating point multiplication occurs. For instance we sometimes
'see things like Dbl(0)*0.02323525 =~ 0.0 * 0.02323525 =~ 0.0000000000000104 so if we do
'dblMax(Dbl(0)*0.02323525 - gblEps,0) =~ dblMax(0.0*0.02323525 - gblEps,0)
'=~ dblMax(0.0000000000000104 - 0.0000000001,0.0) =~ dblMax(-0.000000000099896,0.0) =~ 0.0
' we get 0.0 returned as desired rather than a floating point value =~ 10E-14
*/
const gblEps = 0.0000000001;


exports.populateSavingsAndIncomeProjections = function(isC2, responseObj, strategy, i, parent_user_supplied_vars, parentDSP, parentDIP, parentPivotVars)
{
  let isCouple = parent_user_supplied_vars.c2 != null && parent_user_supplied_vars.c2.ProvinceCode != null;
  let dsp = parentDSP;
  let dip = parentDIP;
  let pivotVars = parentPivotVars;
  let user_supplied_vars = parent_user_supplied_vars.c1;
  let prevDSP;
  let prevDIP;
  if (isC2) {
    dsp = parentDSP.spouse;
    dip = parentDIP.spouse;
    pivotVars = pivotVars.spouse;
    user_supplied_vars = parent_user_supplied_vars.c2;
    if (i > 0)
    {
      prevDSP = responseObj.detailedSavingsProjection[i-1].spouse;
      prevDIP = responseObj.detailedIncomeProjection[i-1].spouse;
    }
  }
  else
  {
    prevDSP = responseObj.detailedSavingsProjection[i-1];
    prevDIP = responseObj.detailedIncomeProjection[i-1];
  }

  const  prov = user_supplied_vars.ProvinceCode;
  const  investorReturn = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].AnnualReturn;
  const  investorInterestPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].InterestPortion;
  const  investorRCGPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].RCGPortion;
  const  investorUCGPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].UCGPortion;
  const  investorEdivPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].EdivPortion;
  const  investorIdivPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].IdivPortion;

  // dsp depends on this one dip field so do it first
  let isNotRetired = dip.Age < user_supplied_vars.RetirementAge;
  if (isNotRetired) {
    dip.EmploymentIncome = user_supplied_vars.EmploymentIncome * dip.InflationFactor;
  }
  else {
    dip.EmploymentIncome = 0;
  }

  // DSP Defined Contribution Section
  let lowerRetireAge = Math.min(user_supplied_vars.RetirementAge, g.MAX_RRSP_AGE);
  if (i == 0) {
    dsp.DCPlanMarketValueStart = user_supplied_vars.DCPlanMarketValue;
  } else {
    let isDCEnded = (dsp.Age-1) >= lowerRetireAge;
    dsp.DCPlanMarketValueStart = isDCEnded ? 0 : prevDSP.DCPlanMarketValueEnd;
  }
  dsp.DCEmployeeContribution = pivotVars.DCEmployeeContribution;
  dsp.DCEmployerContribution = pivotVars.DCEmployerContribution;
  dsp.DCPlanGrowth = dsp.Age >= lowerRetireAge ? 0 : (dsp.DCPlanMarketValueStart + dsp.DCEmployeeContribution + dsp.DCEmployerContribution)*investorReturn;
  dsp.DCPlanMarketValueEnd = dsp.DCPlanMarketValueStart + dsp.DCEmployeeContribution + dsp.DCEmployerContribution + dsp.DCPlanGrowth;

  // DSP RRSP Section
  if (i == 0) {
    dsp.RRSPMarketValueStart = user_supplied_vars.RRSPMarketValue;
    dsp.RRSPContributionRoomStart = user_supplied_vars.RRSPContributionLimitCarried;
  } else {
    if ((dsp.Age-1) >= user_supplied_vars.RRSPTransferAge) {
      dsp.RRSPMarketValueStart = 0;
    } else {
      dsp.RRSPMarketValueStart = prevDSP.RRSPMarketValueEnd;
    }
    dsp.RRSPContributionRoomStart = prevDSP.RRSPContributionRoomEnd;
  }

  if (i == 0) {
    dsp.RRSPContributionRoomGained = 0;
  } else {
    const incomeForRRSP = prevDIP.EmploymentIncome + this.getCustomIncome(prevDIP, user_supplied_vars, "IncomeForRRSPRoom", false);
    dsp.RRSPContributionRoomGained = Math.min(incomeForRRSP*g.RRSP_CONTRIBUTION_RATE, g.RRSP_CONTRIBUTION_LIMIT*dsp.InflationFactor);
  }

  dsp.RRSPContribution = pivotVars.RRSPContribution;
  dsp.SpousalRRSPContribution = pivotVars.SpousalRRSPContribution;

  // a contribution to your spouse reduces YOUR contribution room
  let contribToSpouse = isC2 ? parentPivotVars.SpousalRRSPContribution : parentPivotVars.spouse.SpousalRRSPContribution;

  dsp.RRSPContributionRoomEnd = dsp.RRSPContributionRoomStart + dsp.RRSPContributionRoomGained - dsp.RRSPContribution - dsp.DCEmployeeContribution - dsp.DCEmployerContribution - contribToSpouse;
  dsp.RRSPWithdrawal = pivotVars.RRSPWithdrawal;
  if (dsp.Age == user_supplied_vars.RRSPTransferAge) {
    dsp.RRSPGrowth = 0;
  } else {
    dsp.RRSPGrowth = (dsp.RRSPMarketValueStart + dsp.RRSPContribution + dsp.SpousalRRSPContribution - dsp.RRSPWithdrawal)*investorReturn;
  }
  dsp.RRSPMarketValueEnd = dsp.RRSPMarketValueStart + dsp.RRSPContribution + dsp.SpousalRRSPContribution - dsp.RRSPWithdrawal + dsp.RRSPGrowth;


  // DSP LIRA Section
  let LIRAStartOfYear = user_supplied_vars.LIRAMarketValue;
  if (i > 0) {
    LIRAStartOfYear = ((dsp.Age-1) >= user_supplied_vars.LIRATransferAge) ? 0 : prevDSP.LIRAMarketValueEnd;
  }
  dsp.LIRANew = (dsp.Age >= lowerRetireAge) ? dsp.DCPlanMarketValueEnd : 0;
  dsp.LIRAMarketValueStart = LIRAStartOfYear + dsp.LIRANew;
  dsp.LIRAGrowth = (dsp.Age == user_supplied_vars.LIRATransferAge) ? 0 : dsp.LIRAMarketValueStart * investorReturn;
  dsp.LIRAMarketValueEnd = dsp.LIRAMarketValueStart + dsp.LIRAGrowth;

  // DSP LIF Section
  let LIFStartOfYear = (i > 0) ? prevDSP.LIFMarketValueEnd : user_supplied_vars.ExistingLIFMarketValue;
  dsp.LIFNew = 0;
  if (dsp.Age == user_supplied_vars.LIRATransferAge || (i == 0 && dsp.Age > user_supplied_vars.LIRATransferAge)) {
    dsp.LIFNew = dsp.LIRAMarketValueEnd;
    dsp.LIFMarketValueStart = dsp.LIFNew + LIFStartOfYear;
    
    // one time even draw down calc is only needed for STRATEGY_REGISTERED_FUNDS_FIRST
    if (strategy == this.STRATEGY_REGISTERED_FUNDS_FIRST && dsp.LIFMarketValueStart > 0) {
      let lifRemain = 0;
      if (!isCouple) {
        for (let j = 1; j <= (responseObj.planEndAge - user_supplied_vars.Age - user_supplied_vars.endLIFIndex); j++) {
            let pensionAmountAfterLIFEndYear = Math.max(user_supplied_vars.PensionPaymentAnnual,user_supplied_vars.PensionPaymentAnnual2)*dsp.InflationFactor; // dip.Cells(22, endLifIndex + j + 2).Value
            lifRemain += Math.max(g.FEDERAL_MAX_PENSION_CREDITS - pensionAmountAfterLIFEndYear, 0) / Math.pow(1 + investorReturn, j - 1);
        }
      }

      // console.log("lifRemain: " + lifRemain);
      let mv = dsp.LIFMarketValueStart;
      let xMv = dsp.LIRAMarketValueEnd;
      user_supplied_vars.evenLIFDrawdown = this.getLifLvl(user_supplied_vars.Age, user_supplied_vars.Age+user_supplied_vars.initLIFIndex, user_supplied_vars.Age+user_supplied_vars.endLIFIndex, user_supplied_vars.RetirementAge, mv, xMv, investorReturn, lifRemain, user_supplied_vars.Inflation);
      if (user_supplied_vars.evenLIFDrawdown < 0) {
        //same call as before with lifRemain set to 0 as we cannot get the trailing credits out of the account
        user_supplied_vars.evenLIFDrawdown = this.getLifLvl(user_supplied_vars.Age, user_supplied_vars.Age+user_supplied_vars.initLIFIndex, user_supplied_vars.Age+user_supplied_vars.endLIFIndex, user_supplied_vars.RetirementAge, mv, xMv, investorReturn, 0, user_supplied_vars.Inflation);
      }
    }
  } else {
    dsp.LIFMarketValueStart = LIFStartOfYear;
  }

  // DSP RRIF Section - Can have dependency on LIF for STRATEGY_REGISTERED_FUNDS_FIRST
  let RRIFStartOfYear = (i > 0) ? prevDSP.RRIFMarketValueEnd : user_supplied_vars.RRIFMarketValue;
  dsp.RRIFNew = 0;

  if (dsp.Age == user_supplied_vars.RRSPTransferAge || (i == 0 && dsp.Age > user_supplied_vars.RRSPTransferAge)) {
    dsp.RRIFNew = dsp.RRSPMarketValueEnd;
    dsp.RRIFMarketValueStart = dsp.RRIFNew + RRIFStartOfYear;
    
    // one time even draw down calc is only needed for STRATEGY_REGISTERED_FUNDS_FIRST
    if (strategy == this.STRATEGY_REGISTERED_FUNDS_FIRST && dsp.RRIFMarketValueStart) {
      let rrifRemain = 0;
      if (!isCouple) {
        if (user_supplied_vars.evenLIFDrawdown == 0) {
          // calculate rrifRemain as evenLIFDrawdown did not count for pension credits
          for (let j = 1; j <= (responseObj.planEndAge - user_supplied_vars.Age - user_supplied_vars.endRRIFIndex); j++) {
              let pensionAmountAfterRRIFEndYear = Math.max(user_supplied_vars.PensionPaymentAnnual,user_supplied_vars.PensionPaymentAnnual2)*dsp.InflationFactor; // dip.Cells(22, endRrifIndex + j + 2).Value
              rrifRemain += Math.max(g.FEDERAL_MAX_PENSION_CREDITS - pensionAmountAfterRRIFEndYear, 0) / Math.pow(1 + investorReturn, j - 1);
          }
        }
      }
      
      let mv = dsp.RRIFMarketValueStart;
      let xMv = dsp.RRSPMarketValueEnd;

      user_supplied_vars.evenRRIFDrawdown = this.getRrifLvl(user_supplied_vars.Age, user_supplied_vars.Age+user_supplied_vars.initRRIFIndex, user_supplied_vars.Age+user_supplied_vars.endRRIFIndex, user_supplied_vars.RetirementAge, mv, xMv, investorReturn, rrifRemain, user_supplied_vars.Inflation);
      if (user_supplied_vars.evenRRIFDrawdown < 0) {
        // same call as before with rrifRemain set to 0 as we cannot get the trailing credits out of the account
        user_supplied_vars.evenRRIFDrawdown = this.getRrifLvl(user_supplied_vars.Age, user_supplied_vars.Age+user_supplied_vars.initRRIFIndex, user_supplied_vars.Age+user_supplied_vars.endRRIFIndex, user_supplied_vars.RetirementAge, mv, xMv, investorReturn, 0, user_supplied_vars.Inflation);
      }
    }
  } else {
    dsp.RRIFMarketValueStart = RRIFStartOfYear;
  }

  dsp.RRIFPaymentWithdrawn = pivotVars.RRIFPaymentWithdrawn;
  dsp.RRIFGrowth = (dsp.RRIFMarketValueStart - dsp.RRIFPaymentWithdrawn)*investorReturn;
  dsp.RRIFMarketValueEnd = dsp.RRIFMarketValueStart - dsp.RRIFPaymentWithdrawn + dsp.RRIFGrowth;


  dsp.LIFPaymentWithdrawn = pivotVars.LIFPaymentWithdrawn;
  dsp.LIFGrowth = (dsp.LIFMarketValueStart - dsp.LIFPaymentWithdrawn)*investorReturn;
  dsp.LIFMarketValueEnd = dsp.LIFMarketValueStart - dsp.LIFPaymentWithdrawn + dsp.LIFGrowth;

  // DSP Tax-Free Savings Account Section
  dsp.TFSAHoldingsStart = i == 0 ? user_supplied_vars.TFSAHoldings : prevDSP.TFSAHoldingsEnd;
  dsp.TFSAContributionRoomStart = i == 0 ? user_supplied_vars.TFSAContributionRoom : prevDSP.TFSAContributionRoomEnd;
  dsp.TFSAContributionRoomGained = i == 0 ? 0 : gh.roundTSFA(g.TFSA_ANNUAL_LIMIT*dsp.InflationFactor);
  dsp.TFSAContribution = pivotVars.TFSAContribution;
  dsp.SpousalTFSAContribution = pivotVars.SpousalTFSAContribution;
  dsp.TFSAContributionRoomEnd = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - dsp.TFSAContribution - dsp.SpousalTFSAContribution - dsp.TFSADeposit;
  dsp.TFSAWithdrawal = pivotVars.TFSAWithdrawal;
  dsp.TFSAGrowth = (dsp.TFSAHoldingsStart + dsp.TFSAContribution + dsp.SpousalTFSAContribution - dsp.TFSAWithdrawal + dsp.TFSADeposit)*investorReturn;
  dsp.TFSAHoldingsEnd = dsp.TFSAHoldingsStart + dsp.TFSAContribution + dsp.SpousalTFSAContribution - dsp.TFSAWithdrawal + dsp.TFSAGrowth + dsp.TFSADeposit;

  // DSP Non-Registered Savings Section
  dsp.NonRegisteredSavingsStart = i == 0 ? user_supplied_vars.NRAccountValue : prevDSP.NonRegisteredSavingsEnd;
  dsp.NonRegisteredSavingsStartACB = i == 0 ? user_supplied_vars.NRAccountValueACB : prevDSP.NonRegisteredSavingsEndACB;
  dsp.ContributionToNonRegSavings = pivotVars.ContributionToNonRegSavings; 
  dsp.WithdrawalFromNonRegSavings = pivotVars.WithdrawalFromNonRegSavings;
  let dep = dsp.ContributionToNonRegSavings + dsp.DepositToNonRegSavings;
  let net = dep - dsp.WithdrawalFromNonRegSavings;
  let interimAmount = dsp.NonRegisteredSavingsStart + net;
  let preWD = dsp.NonRegisteredSavingsStart + dep;
  dsp.NonRegInterestIncome = interimAmount*investorReturn*investorInterestPortion;
  dsp.NonRegRealizedCapitalGains = interimAmount*investorReturn*investorRCGPortion;
  dsp.NonRegNonRealizedCapitalGains = interimAmount*investorReturn*investorUCGPortion;
  dsp.NonRegPastCapitalGainsRealized = preWD > 0 ? (dsp.WithdrawalFromNonRegSavings / preWD) * (dsp.NonRegisteredSavingsStart - dsp.NonRegisteredSavingsStartACB) : 0;
  dsp.NonRegEligibleDividends = interimAmount*investorReturn*investorEdivPortion;
  dsp.NonRegIneligibleDividends = interimAmount*investorReturn*investorIdivPortion;
  dsp.NonRegisteredSavingsEnd = interimAmount + dsp.NonRegInterestIncome + dsp.NonRegRealizedCapitalGains + dsp.NonRegNonRealizedCapitalGains + dsp.NonRegEligibleDividends + dsp.NonRegIneligibleDividends;
  dsp.NonRegisteredSavingsEndACB = Math.max(0, dsp.NonRegisteredSavingsStartACB + net + dsp.NonRegInterestIncome + dsp.NonRegRealizedCapitalGains + dsp.NonRegPastCapitalGainsRealized + dsp.NonRegEligibleDividends + dsp.NonRegIneligibleDividends);

  // Joint Non-Registered Savings - (Global, Couples only)
  if (!isC2) {
    parentDSP.JointNonRegisteredSavingsStart = i == 0 ? user_supplied_vars.JointNRMarketValue : responseObj.detailedSavingsProjection[i-1].JointNonRegisteredSavingsEnd;
    parentDSP.JointNonRegisteredSavingsStartACB = i == 0 ? user_supplied_vars.JointNRMarketValueACB : responseObj.detailedSavingsProjection[i-1].JointNonRegisteredSavingsEndACB;
    parentDSP.JointContributionToNonRegSavingsSpouse1 = parentPivotVars.JointContributionToNonRegSavingsSpouse1;
    parentDSP.JointContributionToNonRegSavingsSpouse2 = parentPivotVars.JointContributionToNonRegSavingsSpouse2;
    parentDSP.JointWithdrawalFromNonRegSavingsSpouse1 = parentPivotVars.JointWithdrawalFromNonRegSavingsSpouse1;
    parentDSP.JointWithdrawalFromNonRegSavingsSpouse2 = parentPivotVars.JointWithdrawalFromNonRegSavingsSpouse2;
    let jointWD = parentDSP.JointWithdrawalFromNonRegSavingsSpouse1 + parentDSP.JointWithdrawalFromNonRegSavingsSpouse2
    let jointDEP = parentDSP.JointContributionToNonRegSavingsSpouse1 + parentDSP.JointContributionToNonRegSavingsSpouse2 + parentDSP.JointDepositToNonRegSavingsSpouse1 + parentDSP.JointDepositToNonRegSavingsSpouse2;
    let jointPreWD = parentDSP.JointNonRegisteredSavingsStart + jointDEP;
    let jointNet = jointDEP - jointWD;
    interimAmount = parentDSP.JointNonRegisteredSavingsStart + jointNet;
    parentDSP.JointNonRegInterestIncome = interimAmount*investorReturn*investorInterestPortion;
    parentDSP.JointNonRegRealizedCapitalGains = interimAmount*investorReturn*investorRCGPortion;
    parentDSP.JointNonRegNonRealizedCapitalGains = interimAmount*investorReturn*investorUCGPortion;
    parentDSP.JointNonRegPastCapitalGainsRealized = jointPreWD > 0 ? (jointWD / jointPreWD) * (parentDSP.JointNonRegisteredSavingsStart - parentDSP.JointNonRegisteredSavingsStartACB) : 0;
    parentDSP.JointNonRegEligibleDividends = interimAmount*investorReturn*investorEdivPortion;
    parentDSP.JointNonRegIneligibleDividends = interimAmount*investorReturn*investorIdivPortion;
    parentDSP.JointNonRegisteredSavingsEnd = interimAmount + parentDSP.JointNonRegInterestIncome + parentDSP.JointNonRegRealizedCapitalGains + parentDSP.JointNonRegNonRealizedCapitalGains + parentDSP.JointNonRegEligibleDividends + parentDSP.JointNonRegIneligibleDividends;
    parentDSP.JointNonRegisteredSavingsEndACB = Math.max(0, parentDSP.JointNonRegisteredSavingsStartACB + jointNet + parentDSP.JointNonRegInterestIncome + parentDSP.JointNonRegRealizedCapitalGains + parentDSP.JointNonRegPastCapitalGainsRealized + parentDSP.JointNonRegEligibleDividends + parentDSP.JointNonRegIneligibleDividends);
  }

  // DSP Line Of Credit (Global)
  parentDSP.LineOfCreditStartBalance = i == 0 ? 0 : responseObj.detailedSavingsProjection[i-1].LineOfCreditEndBalance;
  parentDSP.LineOfCreditLoanTaken = parentPivotVars.LineOfCreditLoanTaken;
  parentDSP.LineOfCreditLoanRepayment = parentPivotVars.LineOfCreditLoanRepayment + parentDSP.DepositToLoan;
  parentDSP.LineOfCreditLoanInterest = (parentDSP.LineOfCreditStartBalance+parentDSP.LineOfCreditLoanTaken-parentDSP.LineOfCreditLoanRepayment)*g.CANADA_PRIME_BUSINESS_RATE
  parentDSP.LineOfCreditEndBalance = parentDSP.LineOfCreditStartBalance + parentDSP.LineOfCreditLoanTaken - parentDSP.LineOfCreditLoanRepayment + parentDSP.LineOfCreditLoanInterest;

  // Net Estate Value used for Maximum Disposable Income pivot target
  parentDSP.EstateValue = parentDSP.DCPlanMarketValueEnd + parentDSP.RRSPMarketValueEnd + parentDSP.RRIFMarketValueEnd - parentDSP.RRIFNew + parentDSP.LIRAMarketValueEnd + parentDSP.LIFMarketValueEnd - parentDSP.LIFNew - parentDSP.LIRANew + parentDSP.TFSAHoldingsEnd + parentDSP.NonRegisteredSavingsEnd - parentDSP.LineOfCreditEndBalance + parentDSP.CorporateEndMarketValue;
  if (isCouple) {
    parentDSP.EstateValue += parentDSP.spouse.DCPlanMarketValueEnd + parentDSP.spouse.RRSPMarketValueEnd + parentDSP.spouse.RRIFMarketValueEnd - parentDSP.spouse.RRIFNew + parentDSP.spouse.LIRAMarketValueEnd + parentDSP.spouse.LIFMarketValueEnd - parentDSP.spouse.LIFNew - parentDSP.spouse.LIRANew + parentDSP.spouse.TFSAHoldingsEnd + parentDSP.spouse.NonRegisteredSavingsEnd + parentDSP.JointNonRegisteredSavingsEnd + parentDSP.spouse.CorporateEndMarketValue;
  }

  // Corporate Investment
  this.calculateCorporate(isC2, responseObj, i == 0, user_supplied_vars, dip, prevDIP, pivotVars);
  dsp.CorporateEndMarketValue = dip.CorporateEndMarketValue;

  // new way of adding in grossed up corporate dividends
  dip.EligibleBusinessDividends = dip.CorporateEligibleDividendsPaid*g.ELIGIBLE_DIV_INCOME_FACTOR;
  dip.IneligibleBusinessDividends = dip.CorporateIneligibleDividendsPaid*g.INELIGIBLE_DIV_INCOME_FACTOR;

  if (user_supplied_vars.EligibleBusinessDividends || user_supplied_vars.IneligibleBusinessDividends) {
      // deprecated, but support for old reports
      let getsEligibleDividends = dip.Age >= user_supplied_vars.EligibleBusinessDividendsStartAge && dip.Age <= user_supplied_vars.EligibleBusinessDividendsEndAge;
      let getsIneligibleDividends = dip.Age >= user_supplied_vars.IneligibleBusinessDividendsStartAge && dip.Age <= user_supplied_vars.IneligibleBusinessDividendsEndAge;
      dip.EligibleBusinessDividends = getsEligibleDividends ? user_supplied_vars.EligibleBusinessDividends*dip.InflationFactor*g.ELIGIBLE_DIV_INCOME_FACTOR : 0;
      dip.IneligibleBusinessDividends = getsIneligibleDividends ? user_supplied_vars.IneligibleBusinessDividends*dip.InflationFactor*g.INELIGIBLE_DIV_INCOME_FACTOR : 0;
  }

  // DIP Taxable Income Breakdown
  dip.RRSPWithdrawal = dsp.RRSPWithdrawal;
  dip.RRSPContribution = dsp.RRSPContribution + contribToSpouse;
  dip.DCEmployeeContribution = dsp.DCEmployeeContribution;
  dip.InterestIncomeReturn = dsp.NonRegInterestIncome + 0.5*parentDSP.JointNonRegInterestIncome;
  dip.EligibleDividendReturn = g.ELIGIBLE_DIV_INCOME_FACTOR*(dsp.NonRegEligibleDividends+0.5*parentDSP.JointNonRegEligibleDividends);

  // now that this relates to foreign dividends don't multiply by INELIGIBLE_DIV_INCOME_FACTOR
  dip.IneligibleDividendReturn = (dsp.NonRegIneligibleDividends+0.5*parentDSP.JointNonRegIneligibleDividends); // deprecated - remove soon
  dip.ForeignDividendReturn = (dsp.NonRegIneligibleDividends+0.5*parentDSP.JointNonRegIneligibleDividends);

  dip.CapitalGainsReturn = 0.5 * (dsp.NonRegRealizedCapitalGains+dsp.NonRegPastCapitalGainsRealized + 0.5*(parentDSP.JointNonRegRealizedCapitalGains+parentDSP.JointNonRegPastCapitalGainsRealized));


  
  let pensionIndexFactor = user_supplied_vars.IndexedPension ? dip.InflationFactor : 1;
  dip.PensionIncome = dip.Age < user_supplied_vars.PensionStartAge ? 0 : 
                      dip.Age < user_supplied_vars.PensionChangeAge ? user_supplied_vars.PensionPaymentAnnual : user_supplied_vars.PensionPaymentAnnual2;
  dip.PensionIncome = dip.PensionIncome * pensionIndexFactor;                   
  dip.PensionIncomeSplitToSpouse = pivotVars.PensionIncomeSplitToSpouse;
  dip.PensionIncomeSplitFromSpouse = isC2 ? parentPivotVars.PensionIncomeSplitToSpouse : parentPivotVars.spouse.PensionIncomeSplitToSpouse;

  dip.OldAgeSecurity = dip.Age >= user_supplied_vars.OASStartAge ? user_supplied_vars.OASAnnualPayment*dip.InflationFactor : 0;
  if (i == 0 || dip.Age < user_supplied_vars.OASStartAge || prevDIP.TotalTaxableIncome <= g.OAS_CLAWBACK_THRESHOLD*dip.InflationFactor) {
    dip.OASClawback = 0;
  } else {
    dip.OASClawback = Math.min(0.15*(prevDIP.TotalTaxableIncome - g.OAS_CLAWBACK_THRESHOLD*dip.InflationFactor), dip.OldAgeSecurity);
  }
  dip.CanadaPensionPlan = dip.Age >= user_supplied_vars.CPPStartAge ? user_supplied_vars.CPPAnnualPayment*dip.InflationFactor : 0;

  dip.CPPSplitToSpouse = pivotVars.CPPSplitToSpouse;
  dip.CPPSplitFromSpouse = isC2 ? parentPivotVars.CPPSplitToSpouse : parentPivotVars.spouse.CPPSplitToSpouse;
  dip.RRIFPaymentWithdrawn = dsp.RRIFPaymentWithdrawn;
  dip.RRIFSplitToSpouse  = pivotVars.RRIFSplitToSpouse;
  dip.RRIFSplitFromSpouse = isC2 ? parentPivotVars.RRIFSplitToSpouse : parentPivotVars.spouse.RRIFSplitToSpouse;
  dip.LIFPaymentReceived = dsp.LIFPaymentWithdrawn;
  dip.LIFSplitToSpouse = pivotVars.LIFSplitToSpouse;
  dip.LIFSplitFromSpouse = isC2 ? parentPivotVars.LIFSplitToSpouse : parentPivotVars.spouse.LIFSplitToSpouse;
  dip.RegisteredAnnuitySplitToSpouse = pivotVars.RegisteredAnnuitySplitToSpouse;
  dip.RegisteredAnnuitySplitFromSpouse = isC2 ? parentPivotVars.RegisteredAnnuitySplitToSpouse : parentPivotVars.spouse.RegisteredAnnuitySplitToSpouse;

  dip.TotalTaxableIncome = dip.EmploymentIncome + dip.RRSPWithdrawal - dip.RRSPContribution - dip.DCEmployeeContribution + 
  dip.InterestIncomeReturn + dip.EligibleDividendReturn + dip.ForeignDividendReturn + dip.CapitalGainsReturn + 
  dip.EligibleBusinessDividends + dip.IneligibleBusinessDividends +
  dip.PensionIncome - dip.PensionIncomeSplitToSpouse + dip.PensionIncomeSplitFromSpouse + dip.OldAgeSecurity - dip.OASClawback + dip.CanadaPensionPlan - 
  dip.CPPSplitToSpouse + dip.CPPSplitFromSpouse + dip.RRIFPaymentWithdrawn - dip.RRIFSplitToSpouse + dip.RRIFSplitFromSpouse + 
  dip.LIFPaymentReceived - dip.LIFSplitToSpouse + dip.LIFSplitFromSpouse;

  // sum all the incomes that count for pension credits starting with Pension,LIF,RRIF
  let pensionIncomeForCredits = dip.PensionIncome - dip.PensionIncomeSplitToSpouse + dip.PensionIncomeSplitFromSpouse;
  if (dip.Age >= 65) {
    pensionIncomeForCredits += dip.RRIFPaymentWithdrawn - dip.RRIFSplitToSpouse + dip.LIFPaymentReceived - dip.LIFSplitToSpouse;
  }
  if (isC2) {
    if (parentDIP.Age >= 65) pensionIncomeForCredits += dip.RRIFSplitFromSpouse + dip.LIFSplitFromSpouse;
  } else {
    if (parentDIP.spouse.Age >= 65) pensionIncomeForCredits += dip.RRIFSplitFromSpouse + dip.LIFSplitFromSpouse;
  }

  // add in other taxable custom incomes to total and write the baseline taxable amounts used below
  dip.TotalTaxableIncome += this.getCustomIncome(dip, user_supplied_vars, "TaxableAmount", true);

  // add in the taxable amount of all custom incomes that are annuities
  const origAnnuityIncome = this.getCustomIncome(dip, user_supplied_vars, "AnnuityAmount", true, "TaxableAmount");
  const adjAnnuityIncome = origAnnuityIncome - dip.RegisteredAnnuitySplitToSpouse + dip.RegisteredAnnuitySplitFromSpouse;
  dip.TotalTaxableIncome += adjAnnuityIncome;
  if (dip.Age >= 65) {
    pensionIncomeForCredits += adjAnnuityIncome;

    // new feature July 2020 add in amounts from non-registered annuities
    pensionIncomeForCredits += this.getCustomIncome(dip, user_supplied_vars, "IncomeForPensionCredit", false);
  }
  dip.pensionIncomeForCredits = pensionIncomeForCredits;

  //DIP Taxes Section - lowest tax rate FED_TAX_RATES[0] is currently 0.15 and matches credit factor
  dip.FederalTaxPayable = gh.getFedTax(dip.TotalTaxableIncome, dip.InflationFactor);
  dip.FederalPersonalAmount = g.FEDERAL_PERSONAL_CREDITS*g.FED_TAX_RATES[0]*dip.InflationFactor;
  
  if (dip.Age < 65) {
    dip.FederalAgeAmount = 0;
  } else {
    if (dip.TotalTaxableIncome < g.FEDERAL_AA_CLAWBACK_THRESHOLD*dip.InflationFactor) {
      dip.FederalAgeAmount = g.FED_TAX_RATES[0]*g.FEDERAL_AGE_AMOUNT_BASE_CREDITS*dip.InflationFactor;
    } else {
      dip.FederalAgeAmount = g.FED_TAX_RATES[0]*Math.max(0, g.FEDERAL_AGE_AMOUNT_BASE_CREDITS*dip.InflationFactor - g.FED_TAX_RATES[0]*(dip.TotalTaxableIncome - g.FEDERAL_AA_CLAWBACK_THRESHOLD*dip.InflationFactor));
    }
  }

  dip.FederalPensionCredits = g.FED_TAX_RATES[0]*Math.min(g.FEDERAL_MAX_PENSION_CREDITS, pensionIncomeForCredits); 
  dip.FederalEligibleDividendDeduction = g.ELIGIBLE_DIV_DEDUCTION_FACTOR * (dip.EligibleDividendReturn + dip.EligibleBusinessDividends);
  dip.FederalIneligibleDividendDeduction = g.INELIGIBLE_DIV_DEDUCTION_FACTOR * dip.IneligibleBusinessDividends;
  dip.netFedTax = Math.max(dip.FederalTaxPayable - (dip.FederalPersonalAmount+dip.FederalAgeAmount+dip.FederalPensionCredits+dip.FederalEligibleDividendDeduction+dip.FederalIneligibleDividendDeduction), 0);
  
  // Provincial Taxes
  dip.ProvinceTaxPayable = ph.getProvTax(prov, dip.TotalTaxableIncome, dip.InflationFactor);
  dip.ProvincePersonalAmount = p.provinces[prov].PERSONAL_CREDITS*p.provinces[prov].TAX_RATES[0]*dip.InflationFactor;

  // Province Age Amount
  let baseAgeCredits = 0;
  let basePensionCredits = Math.min(p.provinces[prov].MAX_PENSION_CREDITS*dip.InflationFactor, p.provinces[prov].PENSION_INCOME_GROSS_UP*pensionIncomeForCredits);
  let aa_clawback = p.provinces[prov].AA_CLAWBACK_THRESHOLD*dip.InflationFactor;
  let clawbackOnAgeAndPension = 0; 
  if (dip.Age < 65) {
    dip.ProvinceAgeAmount = 0;
    clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(dip.TotalTaxableIncome - aa_clawback, 0));
  } else {
    baseAgeCredits = p.provinces[prov].AGE_AMOUNT_BASE_CREDITS*dip.InflationFactor;
    if (prov == "QC")
    {
      clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(dip.TotalTaxableIncome - aa_clawback, 0));
      dip.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*(baseAgeCredits - (baseAgeCredits/(baseAgeCredits+basePensionCredits))*clawbackOnAgeAndPension);
    }
    else
    {
      if (dip.TotalTaxableIncome < aa_clawback) {
        dip.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*baseAgeCredits;
      } else {
        dip.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*Math.max(0, baseAgeCredits - g.FED_TAX_RATES[0]*(dip.TotalTaxableIncome - aa_clawback));
      }
    }
  }

  // Province Pension Credits
  if (prov == "QC")
  {
    if (basePensionCredits == 0) {
      dip.ProvincePensionCredits = 0;
    } else {
      dip.ProvincePensionCredits = p.provinces[prov].TAX_RATES[0]*(basePensionCredits - (basePensionCredits/(baseAgeCredits+basePensionCredits))*clawbackOnAgeAndPension);
    }
  }
  else
  {
    dip.ProvincePensionCredits = p.provinces[prov].TAX_RATES[0]*Math.min(p.provinces[prov].MAX_PENSION_CREDITS, pensionIncomeForCredits);
  }

  let taxPayableForSurtax = Math.max(dip.ProvinceTaxPayable - (dip.ProvincePersonalAmount+dip.ProvinceAgeAmount+dip.ProvincePensionCredits), 0);
  dip.ProvinceSurTax = ph.getProvSurTax(prov, taxPayableForSurtax, dip.InflationFactor);

  if (prov == "QC") {
    dip.FederalTaxAbatement = p.provinces[prov].FED_TAX_ABATEMENT_RATE*dip.netFedTax;
    // if (strategy == 1 && dip.Year < 2021) console.log(dip.Year + " FederalTaxAbatement: " + dip.FederalTaxAbatement);
  } else {
    dip.FederalTaxAbatement = 0;
  }

  dip.ProvinceEligibleDividendCredit = p.provinces[prov].ELIGIBLE_DIV_DEDUCTION_FACTOR * (dip.EligibleDividendReturn + dip.EligibleBusinessDividends);
  dip.ProvinceIneligibleDividendCredit = p.provinces[prov].INELIGIBLE_DIV_DEDUCTION_FACTOR * dip.IneligibleBusinessDividends;
  dip.TotalTaxes = dip.CorporateTaxOwing + dip.netFedTax + Math.max(taxPayableForSurtax+dip.ProvinceSurTax-dip.ProvinceEligibleDividendCredit-dip.ProvinceIneligibleDividendCredit-dip.FederalTaxAbatement, 0);

  
  // Disposable Income Breakdown Section
  let jointWithdrawalAmount = isC2 ? parentDSP.JointWithdrawalFromNonRegSavingsSpouse2 : parentDSP.JointWithdrawalFromNonRegSavingsSpouse1;
  let jointContribAmount = isC2 ? parentDSP.JointContributionToNonRegSavingsSpouse2 : parentDSP.JointContributionToNonRegSavingsSpouse1;
  
  let contribToTSFAForSpouse = 0;
  if (isCouple) {
    contribToTSFAForSpouse = isC2 ? parentDSP.SpousalTFSAContribution : parentDSP.spouse.SpousalTFSAContribution;
  }

  dip.RetainedReturnsNonRegSavings = dip.InterestIncomeReturn + dip.EligibleDividendReturn + dip.ForeignDividendReturn + dip.CapitalGainsReturn;
  dip.WithdrawalFromSavingsAccounts = dsp.TFSAWithdrawal + dsp.WithdrawalFromNonRegSavings + jointWithdrawalAmount;
  dip.ContributionsToSavingsAccounts = dsp.TFSAContribution + dsp.ContributionToNonRegSavings + contribToTSFAForSpouse + jointContribAmount;
  if (isCouple) {
    dip.LineOfCreditLoanTaken = parentDSP.LineOfCreditLoanTaken / 2;
    dip.LineOfCreditLoanRepayment = parentDSP.LineOfCreditLoanRepayment / 2;
  } else {
    dip.LineOfCreditLoanTaken = parentDSP.LineOfCreditLoanTaken;
    dip.LineOfCreditLoanRepayment = parentDSP.LineOfCreditLoanRepayment;
  }
  dip.BusinessDividendGrossDown = dip.EligibleBusinessDividends*(1-1/g.ELIGIBLE_DIV_INCOME_FACTOR) + dip.IneligibleBusinessDividends*(1-1/g.INELIGIBLE_DIV_INCOME_FACTOR);

  dip.TotalDisposableIncome = dip.TotalTaxableIncome - dip.RetainedReturnsNonRegSavings + dip.WithdrawalFromSavingsAccounts - dip.ContributionsToSavingsAccounts - dip.TotalTaxes - dip.BusinessDividendGrossDown;
  dip.TotalDisposableIncome += this.getCustomIncome(dip, user_supplied_vars, "TaxFreeAmount", true);
  dip.TotalDisposableIncome += dip.CorporateCapitalDividends;


  if (isCouple && isC2 && prov == "QC") {
    this.calculateSpecialQuebecCoupleCredits(prov, parent_user_supplied_vars, parentDIP);
  }

  if (isCouple) {
    dip.TotalDisposableIncome += dip.LineOfCreditLoanTaken - dip.LineOfCreditLoanRepayment + parentDSP.DepositToLoan/2;
  } else {
    dip.TotalDisposableIncome += dip.LineOfCreditLoanTaken - dip.LineOfCreditLoanRepayment + parentDSP.DepositToLoan;
  }

  if (isCouple && isC2) {
    parentDIP.TotalDisposableIncomeCouple = parentDIP.TotalDisposableIncome + parentDIP.spouse.TotalDisposableIncome;
  }
}

exports.calculateCorporate = function(isC2, responseObj, firstYear, user_supplied_vars, dip, prevDIP, pivotVars) {

  const investorReturn = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].AnnualReturn;
  const investorInterestPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].InterestPortion;
  const investorRCGPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].RCGPortion;
  const investorUCGPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].UCGPortion;
  const investorEdivPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].EdivPortion;
  const investorIdivPortion = g.INVESTMENT_RETURNS[user_supplied_vars.InvestmentRiskProfile].IdivPortion;

  if (firstYear) {
    dip.CorporateStartMarketValue = user_supplied_vars.CorporateMarketValue; // c9
    dip.CorporateStartAdjustedCostBaseStart = user_supplied_vars.CorporateAdjustedCostBase; // c10
  } else {
    dip.CorporateStartMarketValue = Math.max(prevDIP.CorporateEndMarketValue, 0); // c9
    dip.CorporateStartAdjustedCostBaseStart = Math.max(prevDIP.CorporateEndAdjustedCostBase, 0); // c10
  }
  if (firstYear) {
    dip.CorporateGRIPStart = user_supplied_vars.CorporateGRIP; // c95
    dip.CorporateCDAStart = user_supplied_vars.CorporateCDA; // c19
  } else {
    dip.CorporateGRIPStart = prevDIP.CorporateGRIPBalanceEnd; // c95
    dip.CorporateCDAStart = prevDIP.CorporateCDAEnd; // c19
  }
  dip.CorporateDividendsPaid = user_supplied_vars.CorporateDividendsPaid*dip.InflationFactor; // c6
  dip.CorporateDividendsRetainedForHolding = user_supplied_vars.CorporateDividendsRetainedForInvestment*dip.InflationFactor; // c7
  if (dip.Age >= user_supplied_vars.RetirementAge) {
    dip.CorporateDividendsPaid = 0;
    dip.CorporateDividendsRetainedForHolding = 0; // c7
  }
  dip.CorporateDividendFromOpCo = dip.CorporateDividendsPaid + dip.CorporateDividendsRetainedForHolding; // c5
  
  let sumCorporateExpenses = 0;
  if (user_supplied_vars.CorporateExpenses) {
    for (let j = 0; j < 10; j++) {
      if (!user_supplied_vars.CorporateExpenses[j]) {
        dip[`CorporateExpense${j+1}Payout`] = 0; // c13-22
        continue;
      }
      const {annualCost, beginAge, endAge} = user_supplied_vars.CorporateExpenses[j];
      if (dip.Age >= beginAge && dip.Age <= endAge) {
        dip[`CorporateExpense${j+1}Payout`] = Math.min(annualCost, dip.CorporateStartMarketValue) * dip.InflationFactor; // c13-22
      } else {
        dip[`CorporateExpense${j+1}Payout`] = 0; // c13-22
      }
      sumCorporateExpenses += dip[`CorporateExpense${j+1}Payout`];
    }
  }

  // one time calculation to get the level corporate withdrawal
  if (responseObj) {
    if (dip.Age == user_supplied_vars.RetirementAge) {
      if (user_supplied_vars.CorporateWithdrawalType != 'ANNUAL' && !responseObj[`hasCalculatedCorpWd${isC2}`]) {
        const remain = 0;
        const userPlanEndAge = user_supplied_vars.Age + responseObj.numPlanYears;
        const endAge = user_supplied_vars.CorporateWithdrawalType === 'BY_AGE' ? user_supplied_vars.CorporateWithdrawalAge : userPlanEndAge;
        user_supplied_vars.CorporateWithdrawalAmount = this.getCorpLvl(user_supplied_vars, dip, prevDIP, user_supplied_vars.RetirementAge, endAge, remain);
        responseObj[`hasCalculatedCorpWd${isC2}`] = true;
        // console.log(dip.Year + " ----------end age: " + endAge + " " + user_supplied_vars.RetirementAge + " " + user_supplied_vars.CorporateWithdrawalAmount + " " + user_supplied_vars.CorporateWithdrawalType + " " + pivotVars.CorporateWithdrawalAmount);
      }
    }
    dip.CorporateDividendsWithdrawn = Math.min(pivotVars.CorporateWithdrawalAmount, Math.max(dip.CorporateStartMarketValue - sumCorporateExpenses, 0)); // c12
  } else {
    // this branch is taken when called from getCorpLvl()
    dip.CorporateDividendsWithdrawn = Math.min(user_supplied_vars.CorporateWithdrawalAmount*dip.InflationFactor, Math.max(dip.CorporateStartMarketValue - sumCorporateExpenses, 0)); // c12
  }

  dip.CorporateTotalExpensesAndDividends = sumCorporateExpenses + dip.CorporateDividendsWithdrawn; // c23

  // corporate investment returns have two differing eras for before and after retirement
  if (dip.Age >= user_supplied_vars.RetirementAge) {
    dip.CorporateCapitalDividends = Math.min(dip.CorporateCDAStart, dip.CorporateDividendsWithdrawn); // c27
    dip.CorporateDividendsFromGRIP = Math.min(dip.CorporateDividendsWithdrawn - dip.CorporateCapitalDividends, dip.CorporateGRIPStart); // c26
    dip.CorporateDividendsFromLRIP = dip.CorporateDividendsWithdrawn - (dip.CorporateCapitalDividends + dip.CorporateDividendsFromGRIP); // c25
  } else {
    dip.CorporateCapitalDividends = 0; // c27
    dip.CorporateDividendsFromGRIP = 0; // c26
    dip.CorporateDividendsFromLRIP = 0; // c25
  }
  dip.CorporateInterest = (dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends)*investorReturn*investorInterestPortion; // c34
  dip.CorporateEligibleDividend = (dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends)*investorReturn*investorEdivPortion; //c35
  dip.CorporateForeignDividend = (dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends)*investorReturn*investorIdivPortion; // c36
  dip.CorporateRealizedCapitalGains = (dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends)*investorReturn*investorRCGPortion; // c37
  dip.CorporateUnrealizedCapitalGains = (dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends)*investorReturn*investorUCGPortion; // c38

  if ((dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding)*(dip.CorporateStartMarketValue-dip.CorporateStartAdjustedCostBaseStart) > 0) {
    dip.CorporatePastGainsRealized = dip.CorporateTotalExpensesAndDividends/(dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding)*(dip.CorporateStartMarketValue-dip.CorporateStartAdjustedCostBaseStart); // c40
  } else {
    dip.CorporatePastGainsRealized = 0; // c40
  }

  dip.CorporateNetIncomeForTaxPurposes = dip.CorporateDividendsRetainedForHolding+dip.CorporateInterest+dip.CorporateEligibleDividend+dip.CorporateForeignDividend+dip.CorporateRealizedCapitalGains/2+dip.CorporatePastGainsRealized/2; // c47
  dip.CorporateDivisionCDeductions = dip.CorporateDividendsRetainedForHolding+dip.CorporateEligibleDividend; // c48
  dip.CorporateTaxableIncome = dip.CorporateNetIncomeForTaxPurposes-dip.CorporateDivisionCDeductions; // c49
  
  dip.CorporateFederalTax = dip.CorporateTaxableIncome*g.CORPORATE_MARKET_RETURNS.FederalTax; // c51
  dip.CorporateAbatement = -dip.CorporateTaxableIncome*g.CORPORATE_MARKET_RETURNS.Abatement; // c52
  dip.CorporateAdditionalRefundableTax = (dip.CorporateForeignDividend+dip.CorporateInterest+dip.CorporateRealizedCapitalGains/2+dip.CorporatePastGainsRealized/2)*g.CORPORATE_MARKET_RETURNS.AdditionalRefundableTax; // c53
  dip.CorporatePart1TaxPayable = dip.CorporateFederalTax+dip.CorporateAbatement+dip.CorporateAdditionalRefundableTax; // c54

  dip.CorporateDividendsFromNonConnectedCorps = dip.CorporateEligibleDividend; // c56
  dip.CorporatePart4TaxPayable = dip.CorporateDividendsFromNonConnectedCorps*g.CORPORATE_MARKET_RETURNS.part4TaxPayable; // c57
  dip.CorporatePart4TaxOnDividendsFromNonConnectedCorp = dip.CorporatePart4TaxPayable; // c66

  dip.Corporate3023OfAll = (dip.CorporateInterest+dip.CorporateForeignDividend+dip.CorporateRealizedCapitalGains/2+dip.CorporatePastGainsRealized/2)*g.CORPORATE_MARKET_RETURNS['302/3']; // c61

  dip.CorporateTaxableIncomeLessSBD = dip.CorporateTaxableIncome; // c62
  dip.CorporateRefundablePortionOfPart1Tax = Math.min(dip.Corporate3023OfAll, dip.CorporateTaxableIncomeLessSBD, dip.CorporatePart1TaxPayable); // c64 / c90

  if (firstYear) {
    dip.CorporateLRIPBalanceStart = user_supplied_vars.CorporateLRIP; // c85
    dip.CorporateNERDTOHBalanceStart = user_supplied_vars.CorporateNERDTOH; // c89
    dip.CorporateNERDDividendRefundFromPreviousYear = 0; // c91
    dip.CorporateAdditionalNERDRefundFromPreviousYear = 0; // c92
  } else {
    dip.CorporateLRIPBalanceStart = prevDIP.CorporateLRIPBalanceEnd; // c85
    dip.CorporateNERDTOHBalanceStart = prevDIP.CorporateNERDTOHBalanceEnd; // c89
    dip.CorporateNERDDividendRefundFromPreviousYear = prevDIP.CorporateAmount2; // c91
    dip.CorporateAdditionalNERDRefundFromPreviousYear = prevDIP.CorporateAmount3; // c92
  }
  dip.CorporateNERDTOHBalanceEnd = Math.max(dip.CorporateNERDTOHBalanceStart+dip.CorporateRefundablePortionOfPart1Tax-dip.CorporateNERDDividendRefundFromPreviousYear-dip.CorporateAdditionalNERDRefundFromPreviousYear, 0); // c93
    
  if (firstYear) {
    dip.CorporateERDTOHStart = user_supplied_vars.CorporateERDTOH; // c99
    dip.CorporateERDDividendRefundFromPreviousYear = 0;// c102
  } else {
    dip.CorporateERDTOHStart = prevDIP.CorporateERDTOHEnd; // c99
    dip.CorporateERDDividendRefundFromPreviousYear = prevDIP.CorporateAmount1;// c102
  }
  dip.CorporateERDPaidInTheYear = Math.min(dip.CorporateDividendsFromGRIP*g.CORPORATE_MARKET_RETURNS['381/3'], dip.CorporateERDTOHStart); // c100
  dip.CorporatePart4TaxOnPortfolioDividends = dip.CorporatePart4TaxOnDividendsFromNonConnectedCorp; // c101
  dip.CorporateERDTOHEnd = Math.max(dip.CorporateERDTOHStart+dip.CorporatePart4TaxOnPortfolioDividends-dip.CorporateERDDividendRefundFromPreviousYear); // c103
  
  dip.Corporate3813OfAllEligibleDividendsPaid = g.CORPORATE_MARKET_RETURNS['381/3']*dip.CorporateDividendsFromGRIP; // c72
  dip.CorporateERDBalance = dip.CorporateERDTOHEnd; // c73
  dip.CorporateAmount1 = Math.min(dip.Corporate3813OfAllEligibleDividendsPaid, dip.CorporateERDBalance); // c74
  
  dip.Corporate3813OfAllNonEligibleDividendsPaid = g.CORPORATE_MARKET_RETURNS['381/3']*dip.CorporateDividendsFromLRIP; // c76
  dip.CorporateNERDBalance = dip.CorporateNERDTOHBalanceEnd; // c77
  dip.CorporateAmount2 = Math.min(dip.Corporate3813OfAllNonEligibleDividendsPaid, dip.CorporateNERDBalance); // c78

  dip.CorporateDiffAmount2Accounts = Math.max(dip.Corporate3813OfAllNonEligibleDividendsPaid-dip.CorporateNERDBalance, 0); // c80
  dip.CorporateClosingErdBalanceAmount1 = Math.max(dip.CorporateERDBalance-dip.CorporateAmount1, 0); // c81
  dip.CorporateAmount3 = Math.min(dip.CorporateDiffAmount2Accounts, dip.CorporateClosingErdBalanceAmount1);// c82

  dip.CorporateTotalDividendRefund = dip.CorporateAmount1+dip.CorporateAmount2+dip.CorporateAmount3; // c83

  dip.CorporateTotalPart4Tax = dip.CorporatePart4TaxOnDividendsFromNonConnectedCorp; // c67
  dip.CorporateLessDividendRefund = dip.CorporateTotalDividendRefund; // c68
  dip.CorporateProvincialTaxRate = dip.CorporateTaxableIncome*g.CORPORATE_MARKET_RETURNS.provincialTaxRate; // c69
  dip.CorporateTotalTaxesPayable = dip.CorporatePart1TaxPayable+dip.CorporateTotalPart4Tax-dip.CorporateLessDividendRefund+dip.CorporateProvincialTaxRate; // c70

  dip.CorporateCDAEnd = dip.CorporateCDAStart-dip.CorporateCapitalDividends+dip.CorporateRealizedCapitalGains/2+dip.CorporatePastGainsRealized/2;

  //if (prevDIP) console.log(i + " ***** " + dip.CorporateERDTOHStart+" " + dip.CorporatePart4TaxOnPortfolioDividends+ " " + dip.CorporateERDDividendRefundFromPreviousYear);

  dip.CorporateTaxOwing = 0;
  dip.CorporateEndMarketValue = dip.CorporateStartMarketValue+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends+dip.CorporateInterest+dip.CorporateEligibleDividend+dip.CorporateForeignDividend+dip.CorporateRealizedCapitalGains+dip.CorporateUnrealizedCapitalGains-dip.CorporateTotalTaxesPayable; // c42
  dip.CorporateEndAdjustedCostBase = dip.CorporateStartAdjustedCostBaseStart+dip.CorporateDividendsRetainedForHolding-dip.CorporateTotalExpensesAndDividends+dip.CorporateInterest+dip.CorporateEligibleDividend+dip.CorporateForeignDividend+dip.CorporateRealizedCapitalGains+dip.CorporatePastGainsRealized-dip.CorporateTotalTaxesPayable; // c43
  if (dip.CorporateEndMarketValue < 0) {
    dip.CorporateTaxOwing = -dip.CorporateEndMarketValue;
    // console.log("****************************** " + dip.Year + " " + dip.CorporateTaxOwing);
  }


  if (dip.CorporateDividendFromOpCo <= g.CORPORATE_MARKET_RETURNS.LowRateUpperThreshold*(1-g.CORPORATE_MARKET_RETURNS.lowRateCorporateTax)) {
    dip.CorporateGrossIncomeToGenerateDividend = dip.CorporateDividendFromOpCo/(1-g.CORPORATE_MARKET_RETURNS.lowRateCorporateTax); // c3
  } else {
    dip.CorporateGrossIncomeToGenerateDividend = (dip.CorporateDividendFromOpCo-g.CORPORATE_MARKET_RETURNS.LowRateUpperThreshold*(g.CORPORATE_MARKET_RETURNS.highRateCorporateTax-g.CORPORATE_MARKET_RETURNS.lowRateCorporateTax))/(1-g.CORPORATE_MARKET_RETURNS.highRateCorporateTax); // c3
  }
  dip.CorporateLRIPBalanceEnd = Math.max(dip.CorporateLRIPBalanceStart+dip.CorporateDividendsRetainedForHolding*(dip.CorporateGrossIncomeToGenerateDividend === 0 ? 0 : Math.min(g.CORPORATE_MARKET_RETURNS.LowRateUpperThreshold, dip.CorporateGrossIncomeToGenerateDividend)/dip.CorporateGrossIncomeToGenerateDividend)-dip.CorporateDividendsFromLRIP, 0); //c86
  dip.CorporateGRIPBalanceEnd = dip.CorporateGRIPStart+dip.CorporateDividendsRetainedForHolding*(dip.CorporateGrossIncomeToGenerateDividend === 0 ? 0 : 1-Math.min(g.CORPORATE_MARKET_RETURNS.LowRateUpperThreshold, dip.CorporateGrossIncomeToGenerateDividend)/dip.CorporateGrossIncomeToGenerateDividend)+dip.CorporateEligibleDividend-dip.CorporateDividendsFromGRIP; // c96
  
  dip.CorporateIneligibleDividendsPaid = dip.CorporateDividendsPaid*(dip.CorporateGrossIncomeToGenerateDividend === 0 ? 0 : Math.min(g.CORPORATE_MARKET_RETURNS.LowRateUpperThreshold, dip.CorporateGrossIncomeToGenerateDividend)/dip.CorporateGrossIncomeToGenerateDividend)+dip.CorporateDividendsFromLRIP; // c110
  dip.CorporateEligibleDividendsPaid = dip.CorporateDividendsPaid*(dip.CorporateGrossIncomeToGenerateDividend === 0 ? 0 : 1-Math.min(g.CORPORATE_MARKET_RETURNS.LowRateUpperThreshold, dip.CorporateGrossIncomeToGenerateDividend)/dip.CorporateGrossIncomeToGenerateDividend)+dip.CorporateDividendsFromGRIP; // c111
}


exports.calculateSpecialQuebecCoupleCredits = function(prov, parent_user_supplied_vars, parentDIP)
{
  // Province Age Amount
  let baseAgeCredits = 0;
  let basePensionCredits = Math.min(p.provinces[prov].MAX_PENSION_CREDITS*parentDIP.InflationFactor, p.provinces[prov].PENSION_INCOME_GROSS_UP*parentDIP.pensionIncomeForCredits);
  
  let baseAgeCreditsSpouse = 0;
  let basePensionCreditsSpouse = Math.min(p.provinces[prov].MAX_PENSION_CREDITS*parentDIP.InflationFactor, p.provinces[prov].PENSION_INCOME_GROSS_UP*parentDIP.spouse.pensionIncomeForCredits);

  let aa_clawback = p.provinces[prov].AA_CLAWBACK_THRESHOLD*parentDIP.InflationFactor;
  let clawbackOnAgeAndPension = 0; 
  
  if (parentDIP.Age < 65) {
    parentDIP.ProvinceAgeAmount = 0;
    clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(parentDIP.TotalTaxableIncome + parentDIP.spouse.TotalTaxableIncome - aa_clawback, 0));
  } else {
    baseAgeCredits = p.provinces[prov].AGE_AMOUNT_BASE_CREDITS*parentDIP.InflationFactor;
    clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(parentDIP.TotalTaxableIncome + parentDIP.spouse.TotalTaxableIncome - aa_clawback, 0));
    parentDIP.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*(baseAgeCredits - (baseAgeCredits/(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse))*clawbackOnAgeAndPension);
  }
  if (basePensionCredits == 0) {
    parentDIP.ProvincePensionCredits = 0;
  } else {
    parentDIP.ProvincePensionCredits = p.provinces[prov].TAX_RATES[0]*(basePensionCredits - (basePensionCredits/(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse))*clawbackOnAgeAndPension);
  }

  if (parentDIP.spouse.Age < 65) {
    parentDIP.spouse.ProvinceAgeAmount = 0;
    clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(parentDIP.TotalTaxableIncome + parentDIP.spouse.TotalTaxableIncome - aa_clawback, 0));
  } else {
    baseAgeCredits = p.provinces[prov].AGE_AMOUNT_BASE_CREDITS*parentDIP.InflationFactor;
    clawbackOnAgeAndPension = Math.min(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse, p.provinces[prov].AA_PENSION_CB_RATE*Math.max(parentDIP.TotalTaxableIncome + parentDIP.spouse.TotalTaxableIncome - aa_clawback, 0));
    parentDIP.spouse.ProvinceAgeAmount = p.provinces[prov].TAX_RATES[0]*(baseAgeCreditsSpouse - (baseAgeCreditsSpouse/(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse))*clawbackOnAgeAndPension);
  }
  if (basePensionCreditsSpouse == 0) {
    parentDIP.spouse.ProvincePensionCredits = 0;
  } else {
    parentDIP.spouse.ProvincePensionCredits = p.provinces[prov].TAX_RATES[0]*(basePensionCreditsSpouse - (basePensionCreditsSpouse/(baseAgeCredits+basePensionCredits+baseAgeCreditsSpouse+basePensionCreditsSpouse))*clawbackOnAgeAndPension);
  }

  // Tax Totals
  let taxPayableForSurtax = Math.max(parentDIP.ProvinceTaxPayable - (parentDIP.ProvincePersonalAmount+parentDIP.ProvinceAgeAmount+parentDIP.ProvincePensionCredits), 0);
  parentDIP.TotalTaxes = parentDIP.netFedTax + Math.max(taxPayableForSurtax+parentDIP.ProvinceSurTax-parentDIP.ProvinceEligibleDividendCredit-parentDIP.ProvinceIneligibleDividendCredit-parentDIP.FederalTaxAbatement, 0);

  let taxPayableForSurtaxSpouse = Math.max(parentDIP.spouse.ProvinceTaxPayable - (parentDIP.spouse.ProvincePersonalAmount+parentDIP.spouse.ProvinceAgeAmount+parentDIP.spouse.ProvincePensionCredits), 0);
  parentDIP.spouse.TotalTaxes = parentDIP.spouse.netFedTax + Math.max(taxPayableForSurtaxSpouse+parentDIP.spouse.ProvinceSurTax-parentDIP.spouse.ProvinceEligibleDividendCredit-parentDIP.spouse.ProvinceIneligibleDividendCredit-parentDIP.spouse.FederalTaxAbatement, 0);

  parentDIP.TotalDisposableIncome = parentDIP.TotalTaxableIncome - parentDIP.RetainedReturnsNonRegSavings + parentDIP.WithdrawalFromSavingsAccounts - parentDIP.ContributionsToSavingsAccounts - parentDIP.TotalTaxes - parentDIP.BusinessDividendGrossDown;
  parentDIP.TotalDisposableIncome += this.getCustomIncome(parentDIP, parent_user_supplied_vars.c1, "TaxFreeAmount", true);

  parentDIP.spouse.TotalDisposableIncome = parentDIP.spouse.TotalTaxableIncome - parentDIP.spouse.RetainedReturnsNonRegSavings + parentDIP.spouse.WithdrawalFromSavingsAccounts - parentDIP.spouse.ContributionsToSavingsAccounts - parentDIP.spouse.TotalTaxes - parentDIP.spouse.BusinessDividendGrossDown;
  parentDIP.spouse.TotalDisposableIncome += this.getCustomIncome(parentDIP.spouse, parent_user_supplied_vars.c1, "TaxFreeAmount", true);
}



exports.getCustomIncome = function(dip, user_supplied_vars, incomeType, writeLedger, incomeCategory)
{
  let total = 0;
  if (dip["Custom"+incomeType] == null) dip["Custom"+incomeType] = [];
  if (user_supplied_vars.CustomIncomeSources != null)
  {
    for (let i = 0; i < user_supplied_vars.CustomIncomeSources.length; i++) {
        let customIncome = user_supplied_vars.CustomIncomeSources[i];
        let customAmount = 0;
        if (dip.Age >= customIncome.StartAge && dip.Age <= customIncome.DeterminedEndAge) {
          let infl = customIncome.IsIndexed ? dip.InflationFactor : 1.0;
          customAmount = customIncome[incomeType]*infl;
        }

        // awkward but only record ledger entries for main incomeCategory types
        // it is also awkward that we are writing the ledger entry here in a get call...
        if (writeLedger) {
          if (incomeCategory != null && customAmount != 0)
            dip["Custom"+incomeCategory][i] = { label: customIncome.DeterminedLabel, amount: customAmount };
          else
            dip["Custom"+incomeType][i] = { label: customIncome.DeterminedLabel, amount: customAmount };
        }
        
        total += customAmount;
    }
  }
  return total;
}

exports.getCorpLvl = function(user_supplied_vars, di, prevDI, initAge, endAge, remain) {

  let dip = {...di};

  // prevDI is null if the user is already retired.
  let firstYear = false;
  if (!prevDI) {
    prevDI = {...di};
    prevDI.CorporateEndMarketValue = prevDI.CorporateStartMarketValue;
    firstYear = true;
  }
  let prevDIP = {...prevDI};
  let origPrevDIP = {...prevDIP};
  let origDIP = {...dip};

  let loLvl = 0;
  let hiLvl = dip.CorporateStartMarketValue;
  let i = 0;
  let rlCode = 1;

  while (rlCode != 0 && i < bsMaxLoops)
  {
      user_supplied_vars.CorporateWithdrawalAmount = (hiLvl + loLvl) / 2;
      // console.log(i + " ==== trying " + hiLvl + " " + loLvl + " " + user_supplied_vars.CorporateWithdrawalAmount + " " + dip.CorporateStartMarketValue);
      rlCode = this.tryCorpLvl(user_supplied_vars, dip, prevDIP, initAge, endAge, remain, firstYear);
      if (rlCode == 1) {
          hiLvl = user_supplied_vars.CorporateWithdrawalAmount;
      }
      if (rlCode == -1) {
          loLvl = user_supplied_vars.CorporateWithdrawalAmount;
      }
      i = i + 1;
      prevDIP = {...origPrevDIP};
      dip = {...origDIP};
  }
  return user_supplied_vars.CorporateWithdrawalAmount;
}

// level the corporate withdrawal to a tolerance of 1 dollar
exports.tryCorpLvl = function(user_supplied_vars, dip, prevDIP, initAge, endAge, remain, firstYear)
{
  let i = initAge;
  while (i <= endAge && prevDIP.CorporateEndMarketValue > 1.0)
  {
    this.calculateCorporate(false, null, firstYear && i == initAge, user_supplied_vars, dip, prevDIP, null);
    prevDIP = {...dip};
    i = i + 1;
    dip.InflationFactor = Math.pow(1+user_supplied_vars.Inflation, i - user_supplied_vars.Age);
    dip.Year++;
    dip.Age++;
    // console.log("-- " + i + " " + prevDIP.CorporateEndMarketValue + " "+ user_supplied_vars.CorporateWithdrawalAmount + " " + prevDIP.CorporateDividendsWithdrawn);
  }
  
  if (i <= endAge) {
    return 1;
    //signal lvl is too high as we didn't make it to endAge before depleting
  } else {
    if (Math.abs(prevDIP.CorporateEndMarketValue - remain) < 1.0) {
        return 0;
        // signal lvl is ideal as we're within bsTol of desired remainder in the correct year
    } else {
        if (prevDIP.CorporateEndMarketValue - remain > 0) {
            return -1;
            //signal lvl is too low as we're outside bsTol in correct year and mv > remain
        } else {
            return 1;
            //signal lvl is too high as we're outside bsTol in correct year and remain > mv
        }
    }
  }
}

exports.getRrifLvl = function(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, inflationRate)
{
  // console.log("------ tryRrifLvl: " + initAge + " " + startAge + " " + endAge + " " + retAge + " " + Math.round(mv) + " " + Math.round(xMv) + " " + growth + " " + Math.round(remain));
  if (this.tryRrifLvl(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, 0, inflationRate) == 1)
  {
    return -1;
  }
  else
  {
    var testLvl, loLvl, hiLvl, i, rlCode;
    loLvl = 0;
    hiLvl = mv;
    i = 0;
    rlCode = 1;
    while (rlCode != 0 && i < bsMaxLoops)
    {
        testLvl = (hiLvl + loLvl) / 2;
        rlCode = this.tryRrifLvl(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, testLvl, inflationRate);
        if (rlCode == 1) {
            hiLvl = testLvl;
        }
        if (rlCode == -1) {
            loLvl = testLvl;
        }
        i = i + 1;
    }
    // console.log(i + " " + rlCode + " " + Math.round(testLvl));
    return testLvl;
  }
}



exports.tryRrifLvl = function(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, lvl, rawInflationRate)
{
    var i, realPmt, inflRate;
    var tMv = xMv;
    inflRate = 1;
    for (i = initAge; i < startAge; i++) {
        inflRate = inflRate * (1 + rawInflationRate);
    }
    i = startAge;

    while (i <= endAge && mv > bsTol)
    {
      if (i > startAge) {
          tMv = 0;
      }
      if (i < retAge) {
          realPmt = this.getMinRRIF(i, mv, tMv)
      } else {
          realPmt = Math.min(Math.max(lvl * inflRate, this.getMinRRIF(i, mv, tMv)), mv)
      }
      mv = mv - realPmt;
      mv = mv * (1 + growth);
      inflRate = inflRate * (1 + rawInflationRate);
      i = i + 1;
    }

    if (i <= endAge) {
      return 1;
      //signal lvl is too high as we didn't make it to endAge before depleting
    } else {
      if (Math.abs(mv - remain) < bsTol && Math.abs(realPmt - lvl * inflRate) < bsTol) {
          return 0;
          //signal lvl is ideal as we're within bsTol of desired remainder in the correct year
          //and we got within bsTol of a full pmt in the final year
      } else {
          if (mv - remain > 0) {
              return -1;
              //signal lvl is too low as we're outside bsTol in correct year and mv > remain
          } else {
              return 1;
              //signal lvl is too high as we're outside bsTol in correct year and remain > mv
          }
      }
    }
}


exports.getLifLvl = function(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, inflationRate)
{
  if (this.tryLifLvl(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, 0, inflationRate) == 1) {
      return -1
  } 
  else
  {
    if (growth > gblAssumedLifReturn)
    {
      //need to handle this case specially as we're illustrating with a return rate on the LIF
      //greater than the assumed rate for LIF Maxes hence there is no way to take a flat payment
      //each year so we simply need to take the Max in each year to get it as "flat" as possible
      //and depleting at 90.
      
      return -1;
    }  
    else
    {
      if (growth < gblAssumedLifReturn / 10)
      {
        //need to handle this case specially since a return below 0.6%** will force at least one
        //minimum payment to occur no matter what our level payment is in order to deplete at 90.
        
        //** the true threshold is really closer to 0.58% as I can demonstrate 0.59% being solvable
        //for a level payment while 0.58% is not. In the future we should use a bisection or similar
        //method to get a better accuracy on this breakpoint.
        
        //If the Lif Max rates change in the future the value of gblAssumedLifReturn will need to be changed
        //to reflect the CANSIM rate utilised for the given year.
        
        return  -1;
      }
      else   
      {
        var testLvl, loLvl, hiLvl, i, llCode;
        loLvl = 0;
        hiLvl = mv;
        i = 0;
        llCode = 1;
        while (llCode != 0 && i <= bsMaxLoops)
        {
            testLvl = (hiLvl + loLvl) / 2;
            llCode = this.tryLifLvl(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, testLvl, inflationRate);
            if (llCode == 1) {
                hiLvl = testLvl;
            }
            if (llCode == -1) {
                loLvl = testLvl;
            }
            i = i + 1
        }
        return testLvl;
      }
    }
  }
}

exports.tryLifLvl = function(initAge, startAge, endAge, retAge, mv, xMv, growth, remain, lvl, rawInflationRate)
{
    var i, realPmt, inflRate;
    var tMv = xMv;
    inflRate = 1
    for (var i = initAge; i < startAge; i++) {
        inflRate = inflRate * (1 + rawInflationRate);
    }
    i = startAge;
    while (i <= endAge && mv > bsTol)
    {
        if (i > startAge) {
            tMv = 0;
        }
        if (i < retAge) {
            realPmt = this.getMinLIF(i, mv, tMv);
        } else {
            realPmt = Math.min(Math.max(lvl * inflRate, this.getMinLIF(i, mv, tMv)), this.getMaxLIF(i, mv));
        }
        mv = mv - realPmt;
        mv = mv * (1 + growth);
        inflRate = inflRate * (1 + rawInflationRate);
        i = i + 1;
    }
    if (i <= endAge) {
        return 1;
        //signal lvl is too high as we didn't make it to endAge before depleting
        //If endAge is set to 90 (which it will be in 99% of cases) this will never occur
    } else {
        if (Math.abs(mv - remain) < bsTol && Math.abs(realPmt - lvl * inflRate) < bsTol) {
            return 0;
            //signal lvl is ideal as we're within bsTol of desired remainder in the correct year
            //and we got within bsTol of a full pmt in the final year
        } else {
            if ((mv - remain) > bsTol) {
                return -1;
                //signal lvl is too low as we're outside bsTol of lvl in correct year and mv > remain
            } else {
                return 1;
                //signal lvl is too high as we're outside bsTol of lvl in correct year and remain > mv
            }
        }
    }
}


exports.getEmptyPivotVars = function()
{
  //if they are retired we need to come up with a disposable income == desiredIncome
  var pivotVars = {}; 
  pivotVars.estimatedNeededIncome = 0;
  pivotVars.DCEmployeeContribution = 0;
  pivotVars.DCEmployerContribution = 0;
  pivotVars.RRSPContribution = 0;
  pivotVars.RRSPWithdrawal = 0;
  pivotVars.RRIFPaymentWithdrawn = 0;
  pivotVars.LIFPaymentWithdrawn = 0;
  pivotVars.TFSAContribution = 0;
  pivotVars.TFSAWithdrawal = 0;
  pivotVars.ContributionToNonRegSavings = 0;
  pivotVars.WithdrawalFromNonRegSavings = 0;
  pivotVars.LineOfCreditLoanTaken = 0;
  pivotVars.LineOfCreditLoanRepayment = 0;
  pivotVars.CorporateWithdrawalAmount = 0;

  //couple only
  pivotVars.SpousalRRSPContribution = 0;
  pivotVars.SpousalTFSAContribution = 0;
  pivotVars.PensionIncomeSplitToSpouse = 0;
  pivotVars.CPPSplitToSpouse = 0; 
  pivotVars.RRIFSplitToSpouse  = 0; 
  pivotVars.LIFSplitToSpouse = 0;
  pivotVars.RegisteredAnnuitySplitToSpouse = 0;
  pivotVars.JointContributionToNonRegSavingsSpouse1 = 0;
  pivotVars.JointContributionToNonRegSavingsSpouse2 = 0;
  pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 = 0;
  pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 = 0;

  return pivotVars;
}


// rrifMoved represents the amount of the rrifStart that was transfered in the year in question and is thus not subject to a rrif minimum.
exports.getMinRRIF = function(age, rrifStart, rrifMoved)
{
    var minPmtRate;

    if (age < 71)
        minPmtRate = 1.0 / (90 - age);
    else
    {
        if (age < 96) {
            minPmtRate = g.LIF_MIN_PAYMENTS[String(age)];
        } else {
            minPmtRate = g.LIF_MIN_PAYMENTS["95"];
        }
    }

    var minRRIF = Math.max((rrifStart - rrifMoved) * minPmtRate - gblEps, 0);
    //console.log("getMinRRIF " + age + " " + rrifStart + " " + minRRIF);
    return minRRIF;
}

// same minimums as RRIF
exports.getMinLIF = function(age, rrifStart, rrifMoved)
{
  return this.getMinRRIF(age, rrifStart, rrifMoved);
}

exports.getMaxLIF = function(age, lifStart)
{
  var rate;
  if (age < 41) rate = g.LIF_MAX_PAYMENTS["41"];
  else if (age > 90) rate = 1.0;
  else rate = g.LIF_MAX_PAYMENTS[String(age)];
  return Math.max(rate*lifStart - gblEps, 0);
}

// This is suitable to use for arg = wd amount and resp = resulting income
// or any other relationship in which resp is monotone UP in arg's value
exports.bisectUp = function(reCalc, argObj, arg, lo, hi, responseObj, resp, target)
{
    reCalc();
    let i = 0;
    while (i < bsMaxLoops && Math.abs(responseObj[resp] - target) > bsTol)
    {
        // console.log(argObj[arg] + " " + responseObj[resp] + " bisectUp " + target);
        argObj[arg] = (hi + lo) / 2;
        reCalc();
        if (responseObj[resp] > target) {
            hi = (hi + lo) / 2;
        } else {
            lo = (hi + lo) / 2;
        }
        i++;
    }
}

// This is suitable to use for arg = contribution amount and resp = resulting income
// or any other relationship in which resp is monotone DOWN in arg's value
exports.bisectDown = function(reCalc, argObj, arg, lo, hi, responseObj, resp, target)
{
    reCalc();
    let i = 0;
    while (i < bsMaxLoops && Math.abs(responseObj[resp] - target) > bsTol)
    {
        // console.log(argObj[arg] + " " + responseObj[resp] + " bisectUp " + target);
        argObj[arg] = (hi + lo) / 2;
        reCalc();
        if (responseObj[resp] < target) {
            hi = (hi + lo) / 2;
        } else {
            lo = (hi + lo) / 2;
        }
        i++;
    }
}

exports.goldenMax = function(reCalc, argObj, arg, lo, hi, responseObj, resp)
{
    let f1, f2;
    let i = 0;
    let x0 = lo;
    let x3 = hi;
    let x1 = x3 - gldRt * (x3 - x0);
    let x2 = x0 + gldRt * (x3 - x0);
    while ((i < bsMaxLoopsGolden) && (x3 - x0) > this.bsTolGolden) {

        argObj[arg] = x1;
        reCalc();
        f1 = responseObj[resp];

        argObj[arg] = x2;
        reCalc();
        f2 = responseObj[resp];

        if (f1 < f2) {
            // max is in second segment
            x0 = x1;
            x3 = x3;
        } else {
            // max is in first segment
            x0 = x0;
            x3 = x2;
            // revert back to first arg so we're storing our interior max
            argObj[arg] = x1;
            reCalc();
        }
        x1 = x3 - gldRt * (x3 - x0);
        x2 = x0 + gldRt * (x3 - x0);
        i++;
        // console.log("gm: " + Math.round(argObj[arg]) + " " + Math.round(responseObj[resp]));
    }
    let inrMax = argObj[arg];
    
    // Now check end-points
    argObj[arg] = lo;
    reCalc();
    f1 = responseObj[resp];

    argObj[arg] = hi;
    reCalc();
    f2 = resp.Value;

    argObj[arg] = inrMax;
    reCalc();

    if (Math.max(f1, f2) > responseObj[resp]) {
        if (f2 > f1) {
            argObj[arg] = hi;
            reCalc();
        } else {
            argObj[arg] = lo;
            reCalc();
        }
    }

    // console.log("-- goldenMax: " + responseObj[resp]);

    return responseObj[resp];
}

exports.propBisectUpSpouse = function(reCalc, argObj, arg1, lo1, lo2, hi1, hi2, responseObj, resp, target, prop)
{
    //This is suitable to use only if resp is MONOTONE UP in both arg1 and arg2
    //Examples of such relationships are arg1 and arg2 are withdrawals out of
    //rrifs and resp is the couple's Disposable Income.
    
    //To guarantee solvability if we know resp(lo1,lo2) < target and resp(hi1,hi2) > target:
    //prop should be set to (hi1-lo1)/((hi1-lo1)+(hi2-lo2)) but this is left open in case we wish to check
    //a line that doesn't necessarily pass through (lo1,lo2) and (hi1,hi2).
    
    let arg, minArg, maxArg;
    let i = 0;
    minArg = 0;
    maxArg = (hi1 - lo1) + (hi2 - lo2);
    
    while (i < bsMaxLoopsGolden && Math.abs(responseObj[resp] - target) > bsTol)
    {
        arg = (maxArg + minArg) / 2;
        
        //''''This is to ensure we stay in bounds, whole thing needs more scrutiny'''''
        //basically if arg has us on a displacement that goes out of bounds given prop value
        //we adjust prop (rotate the slope) so that we fall just in bounds. since there
        //always exists prop that gives us a solvable value falling on the line between
        //(lo1,lo2) and (hi1,hi2) as mentioned above
        if (prop * arg > hi1) {
            prop = hi1 / arg; //-eps [perhaps, need to test]
        } else {
            if ((1 - prop) * arg > hi2) {
                prop = 1 - hi2 / arg;//-eps [perhaps]
            }
        }
        
        //'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
        argObj[arg1] = prop * arg + lo1;
        argObj.spouse[arg1] = (1 - prop) * arg + lo2;
        reCalc();
        if (responseObj[resp] > target) {
            maxArg = arg;
        } else {
            minArg = arg;
        }
        i = i + 1;
    }
}


exports.propBisectDown = function(reCalc, argObj, arg1, arg2, lo1, lo2, hi1, hi2, responseObj, resp, target, prop)
{
    //This is suitable to use only if resp is MONOTONE DOWN in both arg1 and arg2
    //Examples of such relationships are arg1 and arg2 are contibutions into
    //rrsps and resp is the couple's Disposable Income.
    
    //To guarantee solvability if we know resp(lo1,lo2) < target and resp(hi1,hi2) > target:
    //prop should be set to (hi1-lo1)/((hi1-lo1)+(hi2-lo2)) but this is left open in case we wish to check
    //a line that doesn't necessarily pass through (lo1,lo2) and (hi1,hi2).
    
    let arg, minArg, maxArg;
    let i = 0;
    minArg = 0;
    maxArg = (hi1 - lo1) + (hi2 - lo2);
    
    while (i < bsMaxLoopsGolden && Math.abs(responseObj[resp] - target) > bsTol)
    {
        arg = (maxArg + minArg) / 2;
        
        //''''This is to ensure we stay in bounds, whole thing needs more scrutiny'''''
        //basically if arg has us on a displacement that goes out of bounds given prop value
        //we adjust prop (rotate the slope) so that we fall just in bounds. since there
        //always exists prop that gives us a solvable value falling on the line between
        //(lo1,lo2) and (hi1,hi2) as mentioned above
        if (prop * arg > hi1) {
            prop = hi1 / arg; //-eps [perhaps, need to test]
        } else {
            if ((1 - prop) * arg > hi2) {
                prop = 1 - hi2 / arg;//-eps [perhaps]
            }
        }
        
        //'''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''''
        argObj[arg1] = prop * arg + lo1;
        argObj[arg2] = (1 - prop) * arg + lo2;
        reCalc();
        if (responseObj[resp] < target) {
            maxArg = arg;
        } else {
            minArg = arg;
        }
        i = i + 1;
    }
}