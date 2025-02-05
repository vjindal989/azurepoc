'use strict';

module.exports = (log) => {

	const g = require( './global_constants.json' );
	const common = require( './common.js' );

	return {
		getCouplePivotVars(responseObj, i, count, strategy, desiredIncome, currentDisposableIncome, parent_user_supplied_vars, dip, dsp, pivotVars)
		{
			var endRRIFAge = parent_user_supplied_vars.c1.Age+parent_user_supplied_vars.c1.endRRIFIndex;
			var minRRIFWithdrawl = common.getMinRRIF(dsp.Age, dsp.RRIFMarketValueStart, dsp.RRIFNew);
			var minLIFWithdrawl = common.getMinLIF(dsp.Age, dsp.LIFMarketValueStart, dsp.LIFNew);
		
			var endRRIFAgeSpouse = parent_user_supplied_vars.c2.Age+parent_user_supplied_vars.c2.endRRIFIndex;
			var minRRIFWithdrawlSpouse = common.getMinRRIF(dsp.spouse.Age, dsp.spouse.RRIFMarketValueStart, dsp.spouse.RRIFNew);
			var minLIFWithdrawlSpouse = common.getMinLIF(dsp.spouse.Age, dsp.spouse.LIFMarketValueStart, dsp.spouse.LIFNew);
		
		
			// special single year deposit - follows same rules as other savings
			var customDeposit = 0;
			if (parent_user_supplied_vars.c1.CustomDeposits[dsp.Age] != null)
			{
				log.debug(i + " " + count + " got custom deposit for " + dsp.Age + " " + parent_user_supplied_vars.c1.CustomDeposits[dsp.Age]);
				customDeposit = parent_user_supplied_vars.c1.CustomDeposits[dsp.Age];
				customDeposit = customDeposit - dsp.TFSADeposit - dsp.spouse.TFSADeposit - dsp.JointDepositToNonRegSavingsSpouse1 - dsp.JointDepositToNonRegSavingsSpouse2 - dsp.DepositToLoan;
		
				// 1st priority pay off Line of Credit
				if (dsp.LineOfCreditStartBalance > 0) {
					var locReduction = Math.min(customDeposit, dsp.LineOfCreditStartBalance - pivotVars.LineOfCreditLoanRepayment - dsp.DepositToLoan);
					dsp.DepositToLoan += locReduction;
					customDeposit -= locReduction;
				}
		
				// 2nd priority save to TSFA
				if (customDeposit > 0) {
					var tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution - pivotVars.SpousalTFSAContribution - dsp.TFSADeposit;
					var additionalTFSA = Math.min(customDeposit, tfsaRoom);
					dsp.TFSADeposit += additionalTFSA;
					customDeposit -= additionalTFSA;
		
					var tfsaRoomSpouse = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - pivotVars.spouse.TFSAContribution - pivotVars.spouse.SpousalTFSAContribution - dsp.spouse.TFSADeposit;
					var additionalTFSA = Math.min(customDeposit, tfsaRoomSpouse);
					dsp.spouse.TFSADeposit += additionalTFSA;
					customDeposit -= additionalTFSA;
				}
		
				// 3rd priority save to non-reg savings
				if (customDeposit > 0) {
					dsp.JointDepositToNonRegSavingsSpouse1 += customDeposit;
					log.debug(i + " " + count + " joint dep " + dsp.JointDepositToNonRegSavingsSpouse1);
				}
			}
			if (parent_user_supplied_vars.c2.CustomDeposits[dsp.spouse.Age] != null)
			{
				log.debug(i + " " + count + " got custom deposit for " + dsp.spouse.Age + " " + parent_user_supplied_vars.c2.CustomDeposits[dsp.spouse.Age]);
				customDeposit = parent_user_supplied_vars.c2.CustomDeposits[dsp.spouse.Age];
				if (parent_user_supplied_vars.c1.CustomDeposits[dsp.Age] != null) customDeposit += parent_user_supplied_vars.c1.CustomDeposits[dsp.Age];
				customDeposit = customDeposit - dsp.TFSADeposit - dsp.spouse.TFSADeposit - dsp.JointDepositToNonRegSavingsSpouse1 - dsp.JointDepositToNonRegSavingsSpouse2 - dsp.DepositToLoan;
		
				// 1st priority pay off Line of Credit
				if (dsp.LineOfCreditStartBalance > 0) {
					var locReduction = Math.min(customDeposit, dsp.LineOfCreditStartBalance - pivotVars.LineOfCreditLoanRepayment);
					pivotVars.LineOfCreditLoanRepayment += locReduction;
					dsp.DepositToLoan += locReduction;
					customDeposit -= locReduction;
				}
		
				// 2nd priority save to TSFA
				if (customDeposit > 0) {
					var tfsaRoomSpouse = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - pivotVars.spouse.TFSAContribution - pivotVars.spouse.SpousalTFSAContribution - dsp.spouse.TFSADeposit;
					var additionalTFSA = Math.min(customDeposit, tfsaRoomSpouse);
					dsp.spouse.TFSADeposit += additionalTFSA;
					customDeposit -= additionalTFSA;
		
					var tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution - pivotVars.SpousalTFSAContribution - dsp.TFSADeposit;
					var additionalTFSA = Math.min(customDeposit, tfsaRoom);
					dsp.TFSADeposit += additionalTFSA;
					customDeposit -= additionalTFSA;
				}
		
				// 3rd priority save to non-reg savings
				if (customDeposit > 0) {
					dsp.JointDepositToNonRegSavingsSpouse2 += customDeposit;
					log.debug(i + " " + count + " joint dep " + dsp.JointDepositToNonRegSavingsSpouse2);
				}
			}
		
		
			// if both spouses are retired we need to come up with a disposable income == desiredIncome
			// if one spouse retired we need to come up with a disposable income == value from semiRetDi array
			if (dsp.Age >= parent_user_supplied_vars.c1.RetirementAge || dsp.spouse.Age >= parent_user_supplied_vars.c2.RetirementAge)
			{
				var estimatedNeededIncome = desiredIncome - currentDisposableIncome;
				var isSemiRetired = dip.Age < parent_user_supplied_vars.c1.RetirementAge != dip.spouse.Age < parent_user_supplied_vars.c2.RetirementAge;
				//if (strategy == 1 && dsp.Year > 2064) log.debug(i + " " + count + " target: " + desiredIncome + " " + currentDisposableIncome + " -- " + estimatedNeededIncome);
		
				// corporate wd amounts
				if (dsp.Age >= parent_user_supplied_vars.c1.RetirementAge) {
					const imposedCorpWithdrawal = Math.min(parent_user_supplied_vars.c1.CorporateWithdrawalAmount * dip.InflationFactor, dip.CorporateStartMarketValue);
					const additionalCorpWithdrawal = imposedCorpWithdrawal - pivotVars.CorporateWithdrawalAmount;
					if (additionalCorpWithdrawal > 0) {
						pivotVars.CorporateWithdrawalAmount += additionalCorpWithdrawal;
						estimatedNeededIncome -= additionalCorpWithdrawal;
					}
				} else {
					pivotVars.CorporateWithdrawalAmount = 0;
				}
		
				if (dsp.spouse.Age >= parent_user_supplied_vars.c2.RetirementAge) {
					const imposedCorpWithdrawal = Math.min(parent_user_supplied_vars.c2.CorporateWithdrawalAmount * dip.InflationFactor, dip.spouse.CorporateStartMarketValue);
					const additionalCorpWithdrawal = imposedCorpWithdrawal - pivotVars.spouse.CorporateWithdrawalAmount;
					if (additionalCorpWithdrawal > 0) {
						pivotVars.spouse.CorporateWithdrawalAmount += additionalCorpWithdrawal;
						estimatedNeededIncome -= additionalCorpWithdrawal;
					}
				} else {
					pivotVars.spouse.CorporateWithdrawalAmount = 0;
				}
		
				// mandatory withdrawals are below
				var maxRRIFWithdrawl = dsp.RRIFMarketValueStart;
				var maxRRIFWithdrawlSpouse = dsp.spouse.RRIFMarketValueStart;
				var maxLIFWithdrawl = common.getMaxLIF(dsp.Age, dsp.LIFMarketValueStart);
				var maxLIFWithdrawlSpouse = common.getMaxLIF(dsp.spouse.Age, dsp.spouse.LIFMarketValueStart);
				if (strategy == common.STRATEGY_REGISTERED_FUNDS_FIRST)
				{
					// Imposed LIF
					var imposedLIFWithdrawl;
					if (dsp.Age > g.EARLIEST_LIF_DEPLETION_AGE) {
						// only enough LIF to max pension credits, it is mostly gone by now.
						imposedLIFWithdrawl = Math.min( Math.max(Math.max(g.FEDERAL_MAX_PENSION_CREDITS - dip.PensionIncome, 0), minLIFWithdrawl), maxLIFWithdrawl );
					}
					else {
						imposedLIFWithdrawl = Math.min(Math.max(minLIFWithdrawl, parent_user_supplied_vars.c1.evenLIFDrawdown*dsp.InflationFactor), maxLIFWithdrawl);
					}
					var additionalLIFWithdrawl = imposedLIFWithdrawl - pivotVars.LIFPaymentWithdrawn;
					if (additionalLIFWithdrawl > 0) {
						pivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						estimatedNeededIncome -= additionalLIFWithdrawl;
					}
		
					// log.debug("C1 IMPOSED LIF: " + pivotVars.LIFPaymentWithdrawn);
		
					// Imposed RRIF
					var imposedRRIFWithdrawl;
					if (dsp.Age > endRRIFAge) {
						// only enough RRIF to max pension credits, it is mostly gone by now.
						imposedRRIFWithdrawl = Math.min( Math.max(Math.max(g.FEDERAL_MAX_PENSION_CREDITS - dip.PensionIncome - pivotVars.LIFPaymentWithdrawn, 0), minRRIFWithdrawl), maxRRIFWithdrawl );
					}
					else {
						imposedRRIFWithdrawl = Math.min(Math.max(minRRIFWithdrawl, parent_user_supplied_vars.c1.evenRRIFDrawdown*dsp.InflationFactor), maxRRIFWithdrawl);
					}
					var additionalRRIFWithdrawl = imposedRRIFWithdrawl - pivotVars.RRIFPaymentWithdrawn;
					if (additionalRRIFWithdrawl > 0) {
						pivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						estimatedNeededIncome -= additionalRRIFWithdrawl;
					}
					// log.debug("C1 IMPOSED RIF: " + imposedRRIFWithdrawl + " " + parent_user_supplied_vars.c1.evenRRIFDrawdown + " " + minRRIFWithdrawl);
		
					// Spouse Imposed LIF
					if (dsp.spouse.Age > g.EARLIEST_LIF_DEPLETION_AGE) {
						// only enough LIF to max pension credits, it is mostly gone by now.
						imposedLIFWithdrawl = Math.min( Math.max(Math.max(g.FEDERAL_MAX_PENSION_CREDITS - dip.spouse.PensionIncome, 0), minLIFWithdrawlSpouse), maxLIFWithdrawlSpouse );
					}
					else {
						imposedLIFWithdrawl = Math.min(Math.max(minLIFWithdrawlSpouse, parent_user_supplied_vars.c2.evenLIFDrawdown*dsp.InflationFactor), maxLIFWithdrawlSpouse);
					}
					additionalLIFWithdrawl = imposedLIFWithdrawl - pivotVars.spouse.LIFPaymentWithdrawn;
					if (additionalLIFWithdrawl > 0) {
						pivotVars.spouse.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						estimatedNeededIncome -= additionalLIFWithdrawl;
					}
		
					// Spouse Imposed RRIF
					if (dsp.Age > endRRIFAge) {
						// only enough RRIF to max pension credits, it is mostly gone by now.
						imposedRRIFWithdrawl = Math.min( Math.max(Math.max(g.FEDERAL_MAX_PENSION_CREDITS - dip.spouse.PensionIncome - pivotVars.spouse.LIFPaymentWithdrawn, 0), minRRIFWithdrawlSpouse), maxRRIFWithdrawlSpouse );
					}
					else {
						imposedRRIFWithdrawl = Math.min(Math.max(minRRIFWithdrawlSpouse, parent_user_supplied_vars.c2.evenRRIFDrawdown*dsp.InflationFactor), maxRRIFWithdrawlSpouse);
					}
					additionalRRIFWithdrawl = imposedRRIFWithdrawl - pivotVars.spouse.RRIFPaymentWithdrawn;
					if (additionalRRIFWithdrawl > 0) {
						pivotVars.spouse.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						estimatedNeededIncome -= additionalRRIFWithdrawl;
					}
					//log.debug("C2 IMPOSED RIF: " + imposedRRIFWithdrawl + " " + estimatedNeededIncome);
				}
				else
				{
					// Minimum LIF and RIFF Spouse 1
					var additionalLIFWithdrawl = minLIFWithdrawl - pivotVars.LIFPaymentWithdrawn;
					if (additionalLIFWithdrawl > 0) {
						pivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						estimatedNeededIncome -= additionalLIFWithdrawl;
					}
		
					var additionalRRIFWithdrawl = minRRIFWithdrawl - pivotVars.RRIFPaymentWithdrawn;
					if (additionalRRIFWithdrawl > 0) {
						pivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						estimatedNeededIncome -= additionalRRIFWithdrawl;
					}
		
					// Minimum LIF and RIFF Spouse 2
					additionalLIFWithdrawl = minLIFWithdrawlSpouse - pivotVars.spouse.LIFPaymentWithdrawn;
					if (additionalLIFWithdrawl > 0) {
						pivotVars.spouse.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						estimatedNeededIncome -= additionalLIFWithdrawl;
					}
		
					additionalRRIFWithdrawl = minRRIFWithdrawlSpouse - pivotVars.spouse.RRIFPaymentWithdrawn;
					if (additionalRRIFWithdrawl > 0) {
						pivotVars.spouse.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						estimatedNeededIncome -= additionalRRIFWithdrawl;
					}
				}
		
		
				// determine which spouse is the older / retired one
				// for semi-retirement retired spouse goes first
				// for full retirement the older spouse goes first.
				var isC1OlderOrRetired;
				if (isSemiRetired) {
					var empExp1 = parent_user_supplied_vars.c1.RetirementAge - parent_user_supplied_vars.c1.Age;
					var empExp2 = parent_user_supplied_vars.c2.RetirementAge - parent_user_supplied_vars.c2.Age;
					isC1OlderOrRetired = empExp1 < empExp2;
				} else {
					isC1OlderOrRetired = dsp.Age >= dsp.spouse.Age;
				}
		
				var olderDSP, youngerDSP, olderPivotVars, youngerPivotVars, older_user_supplied_vars, younger_user_supplied_vars;
				if (isC1OlderOrRetired)
				{
					olderDSP = dsp;
					olderPivotVars = pivotVars;
					older_user_supplied_vars = parent_user_supplied_vars.c1;
					youngerDSP = dsp.spouse;
					youngerPivotVars = pivotVars.spouse;
					younger_user_supplied_vars = parent_user_supplied_vars.c2;
		
				}
				else
				{
					olderDSP = dsp.spouse;
					olderPivotVars = pivotVars.spouse;
					older_user_supplied_vars = parent_user_supplied_vars.c2;
					youngerDSP = dsp;
					youngerPivotVars = pivotVars;
					younger_user_supplied_vars = parent_user_supplied_vars.c1;
				}
		
		
				// here we handle the split retirement case contributions
				if (isSemiRetired) 
				{
					// the natural Registered Funds First Income (dip.TotalDisposableIncomeCouple) will be used as the target income level
					// for all subsequent strategies
					if (strategy == 0) estimatedNeededIncome = 0;
					
					// Working DC and RRSP Contribs (referred here as younger)
					///////////////////////////////////////
					if (count == 1) //only do the below once
					{
						var inflRate = youngerDSP.InflationFactor;
						var rrspContributionRoom = youngerDSP.RRSPContributionRoomStart + youngerDSP.RRSPContributionRoomGained;
						// log.debug(youngerDSP.Year + " working spouse Ages " + youngerDSP.Age + " " + younger_user_supplied_vars.RRSPTransferAge);
						if (youngerDSP.Age < younger_user_supplied_vars.RRSPTransferAge) {
							var totalDC = younger_user_supplied_vars.DCEmployeeContribution + younger_user_supplied_vars.DCEmployerContribution;
							if (totalDC > 0) {
								var propDCEmployee = younger_user_supplied_vars.DCEmployeeContribution / totalDC;
								var propDCEmployer = younger_user_supplied_vars.DCEmployerContribution / totalDC;
								youngerPivotVars.DCEmployeeContribution = Math.min(totalDC*youngerDSP.InflationFactor, youngerDSP.RRSPContributionRoomStart + youngerDSP.RRSPContributionRoomGained)*propDCEmployee;
								youngerPivotVars.DCEmployerContribution = Math.min(totalDC*youngerDSP.InflationFactor, youngerDSP.RRSPContributionRoomStart + youngerDSP.RRSPContributionRoomGained)*propDCEmployer;
							}
							else {
								youngerPivotVars.DCEmployeeContribution = 0;
								youngerPivotVars.DCEmployerContribution = 0;
							}
		
							// Q for JK: Should a Spousal RRSP Con turn into a self RRSP Con when the spouse retires but you continue working?
							// We're going with a 'Yes' on this until deciding otherwise
							rrspContributionRoom -= (youngerPivotVars.DCEmployeeContribution + youngerPivotVars.DCEmployerContribution);
							youngerPivotVars.RRSPContribution = Math.min((younger_user_supplied_vars.RRSPContributionPayment+older_user_supplied_vars.ContributionBySpouseRRSP) * inflRate, rrspContributionRoom);
							//log.debug(youngerDSP.Year + " youngerPivotVars.RRSPContribution " + youngerPivotVars.RRSPContribution + " " + rrspContributionRoom);
						}
		
						// Working TFSA and JointSavings Contribs
						///////////////////////////////////////
						var wrkCon, wrkCap, retCap;
						wrkCon = younger_user_supplied_vars.AnnualSavings * inflRate;
						wrkCap = youngerDSP.TFSAContributionRoomStart + youngerDSP.TFSAContributionRoomGained - youngerDSP.TFSADeposit;
						retCap = olderDSP.TFSAContributionRoomStart + olderDSP.TFSAContributionRoomGained - olderDSP.TFSADeposit;
		
						if (wrkCon > (wrkCap + retCap)) {
							youngerPivotVars.TFSAContribution = wrkCap;
							olderPivotVars.SpousalTFSAContribution = retCap;
		
							if (isC1OlderOrRetired)
								pivotVars.JointContributionToNonRegSavingsSpouse2 = wrkCon - (wrkCap + retCap);
							else
								pivotVars.JointContributionToNonRegSavingsSpouse1 = wrkCon - (wrkCap + retCap);
		
						} else {
							if (wrkCon > wrkCap) {
								youngerPivotVars.TFSAContribution = wrkCap;
								olderPivotVars.SpousalTFSAContribution = wrkCon - wrkCap;
							} else {
								youngerPivotVars.TFSAContribution = wrkCon;
								olderPivotVars.SpousalTFSAContribution = 0;
							}
							//.Cells(142 + wrkJntOs, i + 2) = 0
						}
						// log.debug(count + " working TFSA + " + youngerPivotVars.TFSAContribution + " " + olderPivotVars.SpousalTFSAContribution + " " + wrkCon + " " + wrkCap + " " + retCap);
					}
				}
		
				// NEED TO SPLIT HERE BEFORE OBSERVING DI vs incLvl AS
				// SPLIT COULD AFFECT WHERE DI FALLS RELATIVE TO incLvl
				if (strategy != common.STRATEGY_TAXFREE_FUNDS_FIRST  && count > 1) {
					this.transferNrTfsaCouple(responseObj, strategy, i, count, parent_user_supplied_vars, dip, dsp, pivotVars, currentDisposableIncome);
				}
				this.splitCouple(responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
				
		
				//if (strategy == 0) log.debug(i + " after mandatory " + count + " target: " + desiredIncome + " " + estimatedNeededIncome + " -- " + minLIFWithdrawlSpouse + " " + dsp.spouse.LIFMarketValueStart);
				if (estimatedNeededIncome > 0)
				{
					//decrease savings to reduce income for this pivot step
					///////////////////////////////////////////////////////
		
					//if (dsp.Year == 2058 && strategy == 0) log.debug(i + " " + count + " WD *********** " + estimatedNeededIncome);
		
					//first reduce any savings pivots that might be in place then go in priority withdrawal order
					if (pivotVars.LineOfCreditLoanRepayment > 0) {
						var locReduction = Math.min(estimatedNeededIncome, pivotVars.LineOfCreditLoanRepayment);
						pivotVars.LineOfCreditLoanRepayment -= locReduction;
						estimatedNeededIncome -= locReduction;
					}
					if (pivotVars.JointContributionToNonRegSavingsSpouse1 > 0) {
						var additionalNonReg = Math.min(estimatedNeededIncome, pivotVars.JointContributionToNonRegSavingsSpouse1);
						pivotVars.JointContributionToNonRegSavingsSpouse1 -= additionalNonReg;
						estimatedNeededIncome -= additionalNonReg;
						//if (strategy == 1 && dsp.Year == 2050) log.debug("rm JointContributionToNonRegSavingsSpouse1: " + pivotVars.JointContributionToNonRegSavingsSpouse1);
					}
					if (pivotVars.JointContributionToNonRegSavingsSpouse2 > 0) {
						var additionalNonReg = Math.min(estimatedNeededIncome, pivotVars.JointContributionToNonRegSavingsSpouse2);
						pivotVars.JointContributionToNonRegSavingsSpouse2 -= additionalNonReg;
						estimatedNeededIncome -= additionalNonReg;
						//if (strategy == 1 && dsp.Year == 2050) log.debug("rm JointContributionToNonRegSavingsSpouse2: " + pivotVars.JointContributionToNonRegSavingsSpouse2);
					}
					var evenAmt = (pivotVars.JointContributionToNonRegSavingsSpouse1+pivotVars.JointContributionToNonRegSavingsSpouse2)/2;
					pivotVars.JointContributionToNonRegSavingsSpouse1 = evenAmt;
					pivotVars.JointContributionToNonRegSavingsSpouse2 = evenAmt;
		
					// reduce tsfa savings
					if (pivotVars.TFSAContribution > 0 || pivotVars.spouse.TFSAContribution > 0) {
						var contribToRemove = estimatedNeededIncome;
						var removedContrib1 = Math.min(contribToRemove, pivotVars.TFSAContribution);
						contribToRemove = contribToRemove - removedContrib1;
						var removedContrib2 = Math.min(contribToRemove, pivotVars.spouse.TFSAContribution);
						pivotVars.TFSAContribution -= removedContrib1;
						pivotVars.spouse.TFSAContribution -= removedContrib2;
						estimatedNeededIncome -= (removedContrib1 + removedContrib2);
		
						//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " TFSAContrib removed: " + Math.round(pivotVars.TFSAContribution) + " " + Math.round(pivotVars.spouse.TFSAContribution) + " " + removedContrib1 + " " + removedContrib2);
					}
		
					// 1st priority Joint Non-Reg Withrawls then Single Non-Reg
					if (estimatedNeededIncome > 0)
					{
						var amountLeftInJoint = dsp.JointNonRegisteredSavingsStart - pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 - pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 + pivotVars.JointContributionToNonRegSavingsSpouse1 + pivotVars.JointContributionToNonRegSavingsSpouse2 + dsp.JointDepositToNonRegSavingsSpouse1 + dsp.JointDepositToNonRegSavingsSpouse2;
						var additionalNonReg = Math.min(estimatedNeededIncome, amountLeftInJoint);
						
						pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 += additionalNonReg / 2;
						pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 += additionalNonReg / 2;
						estimatedNeededIncome -= additionalNonReg;
		
						//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " 1st priority Joint Non-Reg Withrawls " + estimatedNeededIncome + " " + (additionalNonReg / 2) + " " + pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 + " " + pivotVars.JointWithdrawalFromNonRegSavingsSpouse2);
		
						if (dsp.NonRegisteredSavingsStart > 0 || dsp.spouse.NonRegisteredSavingsStart > 0)
						{
							var propNonRegWd = dsp.NonRegisteredSavingsStart / (dsp.NonRegisteredSavingsStart + dsp.spouse.NonRegisteredSavingsStart);
							var portionPrimary = propNonRegWd * estimatedNeededIncome;
							var portionSpouse = (1 - propNonRegWd) * estimatedNeededIncome;
							if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " " + portionPrimary + " " + portionSpouse);
		
		
							//// Attempt 1 at splitting optimal wd amount using bisect
							// var oldWD = pivotVars.WithdrawalFromNonRegSavings + pivotVars.spouse.WithdrawalFromNonRegSavings;
							// var arg = "WithdrawalFromNonRegSavings";
							// var lo1 = pivotVars.WithdrawalFromNonRegSavings;
							// var lo2 = pivotVars.spouse.WithdrawalFromNonRegSavings;
							// var reCalc = function() {
							// 	common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
							// 	common.populateSavingsAndIncomeProjections(true, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
							// }
							// var target = desiredIncome
							// common.propBisectUpSpouse(reCalc, pivotVars, arg, 0, 0, estimatedNeededIncome, estimatedNeededIncome, dip, "TotalDisposableIncomeCouple", target, propNonRegWd);
							
							// var newWD = pivotVars.WithdrawalFromNonRegSavings + pivotVars.spouse.WithdrawalFromNonRegSavings;
							// estimatedNeededIncome -= (newWD - oldWD);
		
		
							//// Attempt 2 split by simple proportion first then fill as much as possible
							additionalNonReg = Math.min(portionPrimary, dsp.NonRegisteredSavingsStart - pivotVars.WithdrawalFromNonRegSavings);
							if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " ------------" + additionalNonReg);
							pivotVars.WithdrawalFromNonRegSavings += additionalNonReg;
							estimatedNeededIncome -= additionalNonReg;
							additionalNonReg = Math.min(portionSpouse, dsp.spouse.NonRegisteredSavingsStart - pivotVars.spouse.WithdrawalFromNonRegSavings);
							if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " ------------" + additionalNonReg);
							pivotVars.spouse.WithdrawalFromNonRegSavings += additionalNonReg;
							estimatedNeededIncome -= additionalNonReg;
		
							additionalNonReg = Math.min(estimatedNeededIncome, dsp.NonRegisteredSavingsStart - pivotVars.WithdrawalFromNonRegSavings);
							pivotVars.WithdrawalFromNonRegSavings += additionalNonReg;
							estimatedNeededIncome -= additionalNonReg;
							additionalNonReg = Math.min(estimatedNeededIncome, dsp.spouse.NonRegisteredSavingsStart - pivotVars.spouse.WithdrawalFromNonRegSavings);
							pivotVars.spouse.WithdrawalFromNonRegSavings += additionalNonReg;
							estimatedNeededIncome -= additionalNonReg;
						}
		
					}
		
		
					// under some strategies TFSA is in priority before LIF/RRIF and if some strategies it is after.
					if (estimatedNeededIncome > 0)
					{
						if (strategy != common.STRATEGY_NONREGISTERED_FUNDS_FIRST)
						{
							// then TFSA Withdrawls
							var additionalTFSA = Math.min(estimatedNeededIncome, dsp.TFSAHoldingsStart - pivotVars.TFSAWithdrawal + dsp.TFSADeposit);
							pivotVars.TFSAWithdrawal += additionalTFSA;
							estimatedNeededIncome -= additionalTFSA;
		
							additionalTFSA = Math.min(estimatedNeededIncome, dsp.spouse.TFSAHoldingsStart - pivotVars.spouse.TFSAWithdrawal + dsp.spouse.TFSADeposit);
							pivotVars.spouse.TFSAWithdrawal += additionalTFSA;
							estimatedNeededIncome -= additionalTFSA;
							//if (dsp.Year == 2058 && strategy == 0) log.debug(dsp.Year + " TFSAWithdrawal inc to: " + pivotVars.TFSAWithdrawal + " " + pivotVars.spouse.TFSAWithdrawal);
						}
					}
		
		
					// then older spouse LIF up to Max
					if (estimatedNeededIncome > 0)
					{
						var lifMax = common.getMaxLIF(olderDSP.Age, olderDSP.LIFMarketValueStart);
						var lifAvailable = lifMax - olderPivotVars.LIFPaymentWithdrawn;
						var additionalLIFWithdrawl = Math.min(estimatedNeededIncome, lifAvailable);
						estimatedNeededIncome -= additionalLIFWithdrawl;
						olderPivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						// if (strategy == 2) log.debug("additionalLIFWithdrawl: " + additionalLIFWithdrawl);
					}
					// then younger spouse LIF up to Max
					if (estimatedNeededIncome > 0)
					{
						var lifMax = common.getMaxLIF(youngerDSP.Age, youngerDSP.LIFMarketValueStart);
						var lifAvailable = lifMax - youngerPivotVars.LIFPaymentWithdrawn;
						var additionalLIFWithdrawl = Math.min(estimatedNeededIncome, lifAvailable);
						estimatedNeededIncome -= additionalLIFWithdrawl;
						youngerPivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						// if (strategy == 2) log.debug("additionalLIFWithdrawl: " + additionalLIFWithdrawl);
					}
		
		
					// then older RIF
					if (estimatedNeededIncome > 0)
					{
						var rrifMax = olderDSP.RRIFMarketValueStart;
						var rrifAvailable = rrifMax - olderPivotVars.RRIFPaymentWithdrawn;
						var additionalRRIFWithdrawl = Math.min(estimatedNeededIncome, rrifAvailable);
						estimatedNeededIncome -= additionalRRIFWithdrawl;
						olderPivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						//if (strategy == 2 && dsp.Year > 2029) log.debug("------- additional older RRIF: " + olderPivotVars.RRIFPaymentWithdrawn);
					}
					// then younger RIF
					if (estimatedNeededIncome > 0)
					{
						var rrifMax = youngerDSP.RRIFMarketValueStart;
						var rrifAvailable = rrifMax - youngerPivotVars.RRIFPaymentWithdrawn;
						var additionalRRIFWithdrawl = Math.min(estimatedNeededIncome, rrifAvailable);
						estimatedNeededIncome -= additionalRRIFWithdrawl;
						youngerPivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						//if (strategy == 2 && dsp.Year > 2029) log.debug("------- additional younger RRIF: " + youngerPivotVars.RRIFPaymentWithdrawn);
					}
		
		
					// then try an early transfer of LIRA to LIF, older then younger
					if (estimatedNeededIncome > 0)
					{
						if (olderDSP.Age <= older_user_supplied_vars.LIRATransferAge)
						{
							older_user_supplied_vars.LIRATransferAge = olderDSP.Age;
							olderDSP.LIFNew = olderDSP.LIRAMarketValueEnd;
							olderDSP.LIFMarketValueStart = olderDSP.LIRAMarketValueEnd;
							var lifMax = common.getMaxLIF(olderDSP.Age, olderDSP.LIFMarketValueStart);
							var lifAvailable = lifMax - olderPivotVars.LIFPaymentWithdrawn;
							var additionalLIFWithdrawl = Math.min(estimatedNeededIncome, lifAvailable);
							estimatedNeededIncome -= additionalLIFWithdrawl;
							olderPivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
							// log.debug(olderDSP.Year + " had to move up older LIRATransferAge to " + older_user_supplied_vars.LIRATransferAge + " " + Math.round(olderPivotVars.LIFPaymentWithdrawn));
						}
					}
					if (estimatedNeededIncome > 0)
					{
						if (youngerDSP.Age <= younger_user_supplied_vars.LIRATransferAge)
						{
							younger_user_supplied_vars.LIRATransferAge = youngerDSP.Age;
							youngerDSP.LIFNew = youngerDSP.LIRAMarketValueEnd;
							youngerDSP.LIFMarketValueStart = youngerDSP.LIRAMarketValueEnd;
							var lifMax = common.getMaxLIF(youngerDSP.Age, youngerDSP.LIFMarketValueStart);
							var lifAvailable = lifMax - youngerPivotVars.LIFPaymentWithdrawn;
							var additionalLIFWithdrawl = Math.min(estimatedNeededIncome, lifAvailable);
							estimatedNeededIncome -= additionalLIFWithdrawl;
							youngerPivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
							// log.debug(youngerDSP.Year + " had to move up younger LIRATransferAge to " + younger_user_supplied_vars.LIRATransferAge + " " + Math.round(youngerPivotVars.LIFPaymentWithdrawn));
						}
					}
		
					// then try an early transfer of RRSP to RRIF, older then younger
					if (estimatedNeededIncome > 0)
					{
						if (olderDSP.Age <= older_user_supplied_vars.RRSPTransferAge)
						{
							older_user_supplied_vars.RRSPTransferAge = olderDSP.Age;
							olderDSP.RRIFNew = olderDSP.RRSPMarketValueEnd;
							olderDSP.RRIFMarketValueStart = olderDSP.RRSPMarketValueEnd;
							const rrifMax = olderDSP.RRIFMarketValueStart;
							const rrifAvailable = rrifMax - olderPivotVars.RRIFPaymentWithdrawn;
							const additionalRRIFWithdrawl = Math.min(estimatedNeededIncome, rrifAvailable);
							estimatedNeededIncome -= additionalRRIFWithdrawl;
							olderPivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
							// log.debug(olderDSP.Year + " had to move up older RRSPTransferAge to " + older_user_supplied_vars.RRSPTransferAge + " " + Math.round(olderPivotVars.RRIFPaymentWithdrawn));
						}
					}
					if (estimatedNeededIncome > 0)
					{
						if (youngerDSP.Age <= younger_user_supplied_vars.RRSPTransferAge)
						{
							younger_user_supplied_vars.RRSPTransferAge = youngerDSP.Age;
							youngerDSP.RRIFNew = youngerDSP.RRSPMarketValueEnd;
							youngerDSP.RRIFMarketValueStart = youngerDSP.RRSPMarketValueEnd;
							const rrifMax = youngerDSP.RRIFMarketValueStart;
							const rrifAvailable = rrifMax - youngerPivotVars.RRIFPaymentWithdrawn;
							const additionalRRIFWithdrawl = Math.min(estimatedNeededIncome, rrifAvailable);
							estimatedNeededIncome -= additionalRRIFWithdrawl;
							youngerPivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
							// log.debug(olderDSP.Year + " had to move up younger RRSPTransferAge to " + younger_user_supplied_vars.RRSPTransferAge + " " + Math.round(youngerPivotVars.RRIFPaymentWithdrawn));
						}
					}
		
					// under some strategies TFSA is in priority before LIF/RRIF, here is the case it is after.
					if (estimatedNeededIncome > 0)
					{
						if (strategy == common.STRATEGY_NONREGISTERED_FUNDS_FIRST)
						{
							// then TFSA Withdrawls
							let additionalTFSA = Math.min(estimatedNeededIncome, dsp.TFSAHoldingsStart - pivotVars.TFSAWithdrawal + dsp.TFSADeposit);
							pivotVars.TFSAWithdrawal += additionalTFSA;
							estimatedNeededIncome -= additionalTFSA;
		
							additionalTFSA = Math.min(estimatedNeededIncome, dsp.spouse.TFSAHoldingsStart - pivotVars.spouse.TFSAWithdrawal + dsp.spouse.TFSADeposit);
							pivotVars.spouse.TFSAWithdrawal += additionalTFSA;
							estimatedNeededIncome -= additionalTFSA;
							//if (dsp.Year == 2030) log.debug(dsp.Year + " " + count + " TFSAWithdrawals inc to: " + pivotVars.TFSAWithdrawal + " " + pivotVars.spouse.TFSAWithdrawal);
						}
					}
		
					// second last resort withdraw more corporate
					if (estimatedNeededIncome > 0)
					{
						let additionalCorp = Math.min(dip.CorporateStartMarketValue - pivotVars.CorporateWithdrawalAmount, estimatedNeededIncome);
						pivotVars.CorporateWithdrawalAmount += additionalCorp;
						estimatedNeededIncome -= additionalCorp;
		
						additionalCorp = Math.min(dip.spouse.CorporateStartMarketValue - pivotVars.spouse.CorporateWithdrawalAmount, estimatedNeededIncome);
						pivotVars.spouse.CorporateWithdrawalAmount += additionalCorp;
						estimatedNeededIncome -= additionalCorp;
					}
		
					// last resort make up difference with line of credit
					if (estimatedNeededIncome > 0)
					{
						//if (dsp.Year == 2058 && strategy == 0) log.debug("LOC: " + estimatedNeededIncome);
						pivotVars.LineOfCreditLoanTaken += estimatedNeededIncome;
						estimatedNeededIncome = 0;
					}
		
				}
				else if (estimatedNeededIncome < 0)
				{
					//increase savings to reduce income for this pivot step
					///////////////////////////////////////////////////////
					var desiredSavings = -estimatedNeededIncome;
		
					if (dsp.Year == 2020 && strategy == 1) log.debug(i + " " + count + " SAV *********** " + desiredSavings + " " + Math.round(pivotVars.TFSAContribution) + " " + Math.round(pivotVars.spouse.TFSAContribution));
		
					// first reduce any withdrawal pivots that might be in place then go in priority savings order
					if (pivotVars.LineOfCreditLoanTaken > 0) {
						var locReduction = Math.min(desiredSavings, pivotVars.LineOfCreditLoanTaken);
						pivotVars.LineOfCreditLoanTaken -= locReduction;
						desiredSavings -= locReduction;
						//if (strategy == 1 && dsp.Year == 2050) log.debug("LOC undone: " + pivotVars.LineOfCreditLoanTaken);
					}
					if (pivotVars.TFSAWithdrawal > 0 || pivotVars.spouse.TFSAWithdrawal > 0) {
						var withdrawlToRemove = desiredSavings;
						var removedWithdrawl1 = Math.min(withdrawlToRemove, pivotVars.TFSAWithdrawal);
						withdrawlToRemove = withdrawlToRemove  - removedWithdrawl1;
						var removedWithdrawl2 = Math.min(withdrawlToRemove, pivotVars.spouse.TFSAWithdrawal);
		
						// this is a bit of a hack temporary fix
						// what was happening was that adjusting an existing tfsa withdrawl 
						// by a large amount in one step would overshoot and the next pivot round we would have a tfsa deposit 
						// and the target income would oscillate between these two tfsa values and never resolve.
						if (removedWithdrawl1 > 1000) removedWithdrawl1 = 500 + Math.random()*500;
		
						pivotVars.TFSAWithdrawal -= removedWithdrawl1;
						pivotVars.spouse.TFSAWithdrawal -= removedWithdrawl2;
						desiredSavings -= (removedWithdrawl1 + removedWithdrawl2);
						if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " tfsa removed " + pivotVars.TFSAWithdrawal + " " + pivotVars.spouse.TFSAWithdrawal);
					}
					if (desiredSavings > 0)
					{
						if (pivotVars.WithdrawalFromNonRegSavings > 0 || pivotVars.spouse.WithdrawalFromNonRegSavings) {
							var withdrawReduction = Math.min(desiredSavings, pivotVars.WithdrawalFromNonRegSavings);
							pivotVars.WithdrawalFromNonRegSavings -= withdrawReduction;
							if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " wd reduced " + withdrawReduction + " " + pivotVars.WithdrawalFromNonRegSavings);
							desiredSavings -= withdrawReduction;
		
							withdrawReduction = Math.min(desiredSavings, pivotVars.spouse.WithdrawalFromNonRegSavings);
							pivotVars.spouse.WithdrawalFromNonRegSavings -= withdrawReduction;
							if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " wd reduced " + withdrawReduction + " " + pivotVars.spouse.WithdrawalFromNonRegSavings);
							desiredSavings -= withdrawReduction;
						}
					}
					if (desiredSavings > 0)
					{
						if (pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 > 0) {
							var withdrawReduction = Math.min(desiredSavings, pivotVars.JointWithdrawalFromNonRegSavingsSpouse1);
							pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 -= withdrawReduction;
							desiredSavings -= withdrawReduction;
							//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " joint reg1 wd reduc " + withdrawReduction + " " + pivotVars.JointWithdrawalFromNonRegSavingsSpouse1);
						}
						if (pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 > 0) {
							var withdrawReduction = Math.min(desiredSavings, pivotVars.JointWithdrawalFromNonRegSavingsSpouse2);
							pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 -= withdrawReduction;
							desiredSavings -= withdrawReduction;
							//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " joint reg2 wd reduc " + withdrawReduction + " " + pivotVars.JointWithdrawalFromNonRegSavingsSpouse2);
						}
						var evenAmt = (pivotVars.JointWithdrawalFromNonRegSavingsSpouse1+pivotVars.JointWithdrawalFromNonRegSavingsSpouse2)/2;
						pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 = evenAmt;
						pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 = evenAmt;
						//if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " joint reg wd even " + evenAmt);
					}
		
					// 1st priority pay off Line of Credit
					if (dsp.LineOfCreditStartBalance > 0) {
						var locReduction = Math.min(desiredSavings, dsp.LineOfCreditStartBalance - pivotVars.LineOfCreditLoanRepayment);
						pivotVars.LineOfCreditLoanRepayment += locReduction;
						desiredSavings -= locReduction;
					}
		
					// 2nd priority save to TSFA then any remainder to Joint NR savings
					if (desiredSavings > 0) {
		
						var tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution - pivotVars.SpousalTFSAContribution - dsp.TFSADeposit;
						var tfsaRoomSpouse = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - pivotVars.spouse.TFSAContribution - pivotVars.spouse.SpousalTFSAContribution - dsp.spouse.TFSADeposit;
						//if (strategy == 1 && dsp.Year == 2020) log.debug(dsp.Year + " " + count + " tfsa room " + tfsaRoom + " " + pivotVars.TFSAContribution + " " + pivotVars.SpousalTFSAContribution);
		
						if (desiredSavings < tfsaRoom + tfsaRoomSpouse)
						{
							// All excess can be placed in TFSAs. Try 50/50 split first
							var split50 = desiredSavings/2;
							if (split50 <= tfsaRoom && split50 <= tfsaRoomSpouse)
							{
								pivotVars.TFSAContribution += split50;
								pivotVars.spouse.TFSAContribution += split50;
								//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " tfsa split " + Math.round(pivotVars.TFSAContribution) + " " + Math.round(pivotVars.spouse.TFSAContribution));
							}
							else
							{
								// 50/50 split won't work so fill lower capacity TFSA then higher cap TFSA with surplus over lower cap
								//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " no 5050 tsfa split");
								if (tfsaRoom > tfsaRoomSpouse)
								{
									pivotVars.TFSAContribution += desiredSavings - tfsaRoomSpouse;
									pivotVars.spouse.TFSAContribution += tfsaRoomSpouse;
								}
								else
								{
									pivotVars.spouse.TFSAContribution += desiredSavings - tfsaRoom;
									pivotVars.TFSAContribution += tfsaRoom;
								}
							}
						}
						else
						{
							// Fill both TFSAs and put new excess (above TFSA limits) in Joint Non-Reg
							pivotVars.TFSAContribution += tfsaRoom;
							pivotVars.spouse.TFSAContribution += tfsaRoomSpouse;
							desiredSavings = desiredSavings - (tfsaRoom + tfsaRoomSpouse);
		
							if (desiredSavings > 0)
							{
								var halfJoint = desiredSavings / 2;
		
								//var origSP1 = pivotVars.JointContributionToNonRegSavingsSpouse1;
								//var origSP2 = pivotVars.JointContributionToNonRegSavingsSpouse2;
								//if (dsp.Year == 2020 && strategy == 0) log.debug(dsp.Year + " " + count + " ds3 " + desiredSavings + " " + origSP1);
		
								var arg1 = "JointContributionToNonRegSavingsSpouse1";
								var arg2 = "JointContributionToNonRegSavingsSpouse2";
								var lo1 = pivotVars.JointContributionToNonRegSavingsSpouse1;
								var lo2 = pivotVars.JointContributionToNonRegSavingsSpouse2;
								var reCalc = function() {
									common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
									common.populateSavingsAndIncomeProjections(true, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
								}
								var target = desiredIncome
								common.propBisectDown(reCalc, pivotVars, arg1, arg2, lo1, lo2, lo1+halfJoint, lo2+halfJoint, dip, "TotalDisposableIncomeCouple", target, 0.5);
								//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " " + desiredSavings + " " + Math.round(desiredIncome) + " " + halfJoint + " maxed TFSAs with joint deposit " + (origSP1+halfJoint) + " " + (origSP2+halfJoint) + " " + pivotVars.JointContributionToNonRegSavingsSpouse1 + " " + pivotVars.JointContributionToNonRegSavingsSpouse2);
							}
						}
					}
				}
				else
				{
					// if (strategy == 2) log.debug(i + " " + count + " We are exactly matching desired income of " + Math.round(desiredIncome) + " " + Math.round(dip.TotalDisposableIncomeCouple));
				}
			}
			else
			{
				// if neither are retired yet we have no targets, fill in pivots with user supplied values or leave as default 0
				// we will pivot once to calc some DC, TFSA etc vars.
				/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
				this.fillWorkingYear(responseObj, strategy, i, count, parent_user_supplied_vars, dip, dsp, pivotVars, minLIFWithdrawl, minRRIFWithdrawl, minLIFWithdrawlSpouse, minRRIFWithdrawlSpouse, currentDisposableIncome);
			}
		
		
			if (pivotVars.WithdrawalFromNonRegSavings != 0 && pivotVars.ContributionToNonRegSavings != 0) {
				log.warn(count + " " + strategy + " " + dsp.Year + " ----------Warning doing both for NonRegSavings! " + pivotVars.WithdrawalFromNonRegSavings + " " + pivotVars.ContributionToNonRegSavings);
			}
			if (pivotVars.TFSAWithdrawal != 0 && pivotVars.TFSAContribution != 0) {
				log.warn(count + " " + strategy + " " + dsp.Year + " ----------Warning doing both for TFSA! " + pivotVars.TFSAWithdrawal + " " + pivotVars.TFSAContribution);	
			}
			
			if (pivotVars.spouse.TFSAWithdrawal != 0 && pivotVars.spouse.TFSAContribution != 0) {
				log.warn(count + " " + strategy + " " + dsp.Year + " ----------Warning doing both for spouse TFSA! " + pivotVars.spouse.TFSAWithdrawal + " " + pivotVars.spouse.TFSAContribution);
			}
			
			if (pivotVars.ContributionToNonRegSavings > 0 && pivotVars.TFSAContribution == 0) {
				log.warn(count + " " + strategy + " " + dsp.Year + " ----------Non-reg contrib with no TFSA contrib??" + pivotVars.TFSAContribution + " " + pivotVars.ContributionToNonRegSavings);
			}
		
			//if (strategy == 2 && dsp.Year > 2029) log.debug(i + " " + Math.round(pivotVars.TFSAContribution) + " end of pivots " + Math.round(dip.TotalDisposableIncomeCouple));
		
		
			return pivotVars;
		},
		
		fillWorkingYear(responseObj, strategy, i, count, parent_user_supplied_vars, dip, dsp, pivotVars, minLIFWithdrawl, minRRIFWithdrawl, minLIFWithdrawlSpouse, minRRIFWithdrawlSpouse, currentDisposableIncome)
		{
			var inflRate = dsp.InflationFactor;
		
			   pivotVars.CorporateWithdrawalAmount = 0;
			pivotVars.spouse.CorporateWithdrawalAmount = 0;
		
			//fill wd amounts first - all minimal as both are pre-retirement
			//spouse1
			pivotVars.LIFPaymentWithdrawn = minLIFWithdrawl;
			pivotVars.RRIFPaymentWithdrawn = minRRIFWithdrawl;
		
			//spouse2
			pivotVars.spouse.LIFPaymentWithdrawn = minLIFWithdrawlSpouse;
			pivotVars.spouse.RRIFPaymentWithdrawn = minRRIFWithdrawlSpouse;
		
			// fill contributions now based on provided data for pre-retirement saving
			// spouse1
			var rrspContributionRoom = dsp.RRSPContributionRoomStart + dsp.RRSPContributionRoomGained;
			if (dsp.Age < parent_user_supplied_vars.c1.RRSPTransferAge) {
				var totalDC = parent_user_supplied_vars.c1.DCEmployeeContribution + parent_user_supplied_vars.c1.DCEmployerContribution;
				if (totalDC > 0)
				{
					var propDCEmployee = parent_user_supplied_vars.c1.DCEmployeeContribution / totalDC;
					var propDCEmployer = parent_user_supplied_vars.c1.DCEmployerContribution / totalDC;
					pivotVars.DCEmployeeContribution = Math.min(totalDC*dsp.InflationFactor, dsp.RRSPContributionRoomStart + dsp.RRSPContributionRoomGained)*propDCEmployee;
					pivotVars.DCEmployerContribution = Math.min(totalDC*dsp.InflationFactor, dsp.RRSPContributionRoomStart + dsp.RRSPContributionRoomGained)*propDCEmployer;
				}
				else
				{
					pivotVars.DCEmployeeContribution = 0;
					pivotVars.DCEmployerContribution = 0;
				}
				rrspContributionRoom -= (pivotVars.DCEmployeeContribution + pivotVars.DCEmployerContribution);
		
				var totalRRSPContribution = parent_user_supplied_vars.c1.RRSPContributionPayment + parent_user_supplied_vars.c2.ContributionBySpouseRRSP;
				if ( totalRRSPContribution*inflRate > rrspContributionRoom) {
					// evenly split RRSP contribution between self and spouse
					pivotVars.RRSPContribution = rrspContributionRoom * (parent_user_supplied_vars.c1.RRSPContributionPayment / totalRRSPContribution);
					pivotVars.spouse.SpousalRRSPContribution = rrspContributionRoom * (parent_user_supplied_vars.c2.ContributionBySpouseRRSP / totalRRSPContribution);
				} else {
					pivotVars.RRSPContribution = parent_user_supplied_vars.c1.RRSPContributionPayment * inflRate;
					pivotVars.spouse.SpousalRRSPContribution = parent_user_supplied_vars.c2.ContributionBySpouseRRSP * inflRate;
				}
			} else {
				//We'll continue rendering our spousal RRSP Con if the spouse is still pre-ret
				if (dsp.spouse.Age < parent_user_supplied_vars.c2.RRSPTransferAge) {
					pivotVars.spouse.SpousalRRSPContribution = Math.min(parent_user_supplied_vars.c2.ContributionBySpouseRRSP * inflRate, rrspContributionRoom);
				} else {
					pivotVars.spouse.SpousalRRSPContribution = 0;
				}
			}
		
			// spouse2
			rrspContributionRoom = dsp.spouse.RRSPContributionRoomStart + dsp.spouse.RRSPContributionRoomGained;
			if (dsp.spouse.Age < parent_user_supplied_vars.c2.RRSPTransferAge) {
		
				var totalDC = parent_user_supplied_vars.c2.DCEmployeeContribution + parent_user_supplied_vars.c2.DCEmployerContribution;
				if (totalDC > 0)
				{
					var propDCEmployee = parent_user_supplied_vars.c2.DCEmployeeContribution / totalDC;
					var propDCEmployer = parent_user_supplied_vars.c2.DCEmployerContribution / totalDC;
					pivotVars.spouse.DCEmployeeContribution = Math.min(totalDC*dsp.InflationFactor, dsp.spouse.RRSPContributionRoomStart + dsp.spouse.RRSPContributionRoomGained)*propDCEmployee;
					pivotVars.spouse.DCEmployerContribution = Math.min(totalDC*dsp.InflationFactor, dsp.spouse.RRSPContributionRoomStart + dsp.spouse.RRSPContributionRoomGained)*propDCEmployer;
				}
				else
				{
					pivotVars.spouse.DCEmployeeContribution = 0;
					pivotVars.spouse.DCEmployerContribution = 0;
				}
				rrspContributionRoom -= (pivotVars.spouse.DCEmployeeContribution + pivotVars.spouse.DCEmployerContribution);
				
				var totalRRSPContribution = parent_user_supplied_vars.c2.RRSPContributionPayment + parent_user_supplied_vars.c1.ContributionBySpouseRRSP;
				if ( totalRRSPContribution*inflRate > rrspContributionRoom) {
					// evenly split RRSP contribution between self and spouse
					pivotVars.spouse.RRSPContribution = rrspContributionRoom * (parent_user_supplied_vars.c2.RRSPContributionPayment / totalRRSPContribution);
					pivotVars.SpousalRRSPContribution = rrspContributionRoom * (parent_user_supplied_vars.c1.ContributionBySpouseRRSP / totalRRSPContribution);
				} else {
					pivotVars.spouse.RRSPContribution = parent_user_supplied_vars.c2.RRSPContributionPayment * inflRate;
					pivotVars.SpousalRRSPContribution = parent_user_supplied_vars.c1.ContributionBySpouseRRSP * inflRate;
				}
			} else {
				//We'll continue rendering our spousal RRSP Con if the spouse is still pre-ret
				if (dsp.Age < parent_user_supplied_vars.c1.RRSPTransferAge) {
					pivotVars.SpousalRRSPContribution = Math.min(parent_user_supplied_vars.c1.ContributionBySpouseRRSP * inflRate, rrspContributionRoom);
				} else {
					pivotVars.SpousalRRSPContribution = 0;
				}
			}
		
			var tfCon1 = parent_user_supplied_vars.c1.AnnualSavings * inflRate;
			var tfCon2 = parent_user_supplied_vars.c2.AnnualSavings * inflRate;
			var tfCap1 = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - dsp.TFSADeposit;
			var tfCap2 = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - dsp.spouse.TFSADeposit;
		
			if ( tfCon1 > tfCap1 && tfCon2 > tfCap2) {
				pivotVars.TFSAContribution = tfCap1;
				pivotVars.spouse.TFSAContribution = tfCap2;
				pivotVars.SpousalTFSAContribution = 0;
				pivotVars.spouse.SpousalTFSAContribution = 0;
				pivotVars.JointContributionToNonRegSavingsSpouse1 = tfCon1 - tfCap1;
				pivotVars.JointContributionToNonRegSavingsSpouse2 = tfCon2 - tfCap2;
				// if (dsp.Year < 2025) log.debug("working year tfsa contrib above caps" + pivotVars.TFSAContribution + " " + pivotVars.spouse.TFSAContribution);
			} else {
				if ((tfCon1 + tfCon2) > (tfCap1 + tfCap2)) {
					if (tfCon1 > tfCap1) {
						pivotVars.TFSAContribution = tfCap1;
						pivotVars.spouse.TFSAContribution = tfCon2;
						pivotVars.SpousalTFSAContribution = 0;
						pivotVars.spouse.SpousalTFSAContribution = tfCap2 - tfCon2;
						pivotVars.JointContributionToNonRegSavingsSpouse1 = tfCon1 + tfCon2 - (tfCap1 + tfCap2);
						pivotVars.JointContributionToNonRegSavingsSpouse2 = 0;
					} else {
						// we must have tfCon2 > tfCap2 here
						pivotVars.TFSAContribution = tfCon1;
						pivotVars.spouse.TFSAContribution = tfCap2;
						pivotVars.SpousalTFSAContribution = tfCap1 - tfCon1;
						pivotVars.spouse.SpousalTFSAContribution = 0;
						pivotVars.JointContributionToNonRegSavingsSpouse1 = 0;
						pivotVars.JointContributionToNonRegSavingsSpouse2 = tfCon1 + tfCon2 - (tfCap1 + tfCap2);
					}
				} else {
					if (tfCon1 > tfCap1) {
						pivotVars.TFSAContribution = tfCap1;
						pivotVars.spouse.TFSAContribution = tfCon2;
						pivotVars.SpousalTFSAContribution = 0;
						pivotVars.spouse.SpousalTFSAContribution = tfCon1 - tfCap1;
						pivotVars.JointContributionToNonRegSavingsSpouse1 = 0;
						pivotVars.JointContributionToNonRegSavingsSpouse2 = 0;
					} else {
						if (tfCon2 > tfCap2) {
							pivotVars.TFSAContribution = tfCon1;
							pivotVars.spouse.TFSAContribution = tfCap2;
							pivotVars.SpousalTFSAContribution = tfCon2 - tfCap2;
							pivotVars.spouse.SpousalTFSAContribution = 0;
							pivotVars.JointContributionToNonRegSavingsSpouse1 = 0;
							pivotVars.JointContributionToNonRegSavingsSpouse2 = 0;
						} else {
							pivotVars.TFSAContribution = tfCon1;
							pivotVars.spouse.TFSAContribution = tfCon2;
							pivotVars.SpousalTFSAContribution = 0;
							pivotVars.spouse.SpousalTFSAContribution = 0;
							pivotVars.JointContributionToNonRegSavingsSpouse1 = 0;
							pivotVars.JointContributionToNonRegSavingsSpouse2 = 0;
							// if (dsp.Year < 2021) log.debug(tfCon1 + " " + tfCap1 + " working year tfsa contrib <= caps" + pivotVars.TFSAContribution + " " + pivotVars.spouse.TFSAContribution);
						}
					}
				}
			}
		
			// always contribute max TFSA if possible under most strategies
			// we only do it after the first pivot in order to get our base disposable income target if needed
			// log.debug(dsp.Year + " " + count + " transfer? " + pivotVars.TFSAContribution + " " + pivotVars.spouse.TFSAContribution);
			if (strategy != common.STRATEGY_TAXFREE_FUNDS_FIRST && count > 1) {
				this.transferNrTfsaCouple(responseObj, strategy, i, count, parent_user_supplied_vars, dip, dsp, pivotVars, currentDisposableIncome);
			}
		
			//split
			this.splitCouple(responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
		},
		
		
		splitCouple(responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars)
		{
			//if (strategy == 2 && dsp.Year > 2029) log.debug("splitCouple: " + pivotVars.RRIFPaymentWithdrawn + " " + pivotVars.spouse.RRIFPaymentWithdrawn + " " + dip.TotalDisposableIncomeCouple);
			var reCalc = function() {
				common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
				common.populateSavingsAndIncomeProjections(true, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
				//log.debug("recalc " + Math.round(dip.TotalDisposableIncome) + " " + Math.round(dip.spouse.TotalDisposableIncome) + " " + Math.round(dip.TotalDisposableIncomeCouple));
			}
		
			// (I) Check DB Pensions first since can be split at any age
			let origIncomeLevel = dip.TotalDisposableIncomeCouple;
			let origSplit1 = pivotVars.PensionIncomeSplitToSpouse;
			let origSplit2 = pivotVars.spouse.PensionIncomeSplitToSpouse;
			// log.debug(i + " splitCouple " + origSplit1 + " " + origSplit2);
			if (dip.PensionIncome > 0 && dip.spouse.PensionIncome > 0) {
		
				var obsLvl1 = common.goldenMax(reCalc, pivotVars, "PensionIncomeSplitToSpouse", 0, dip.PensionIncome/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl1 = pivotVars.PensionIncomeSplitToSpouse;
				pivotVars.PensionIncomeSplitToSpouse = origSplit1;
				reCalc();
		
				var obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "PensionIncomeSplitToSpouse", 0, dip.spouse.PensionIncome/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl2 = pivotVars.spouse.PensionIncomeSplitToSpouse;
				pivotVars.spouse.PensionIncomeSplitToSpouse = origSplit2;
				reCalc();
		
				if (obsLvl1 - common.bsTolGolden > origIncomeLevel || obsLvl2 - common.bsTolGolden > origIncomeLevel) {
					if (obsLvl1 > obsLvl2) {
						pivotVars.PensionIncomeSplitToSpouse = splitLvl1;
						pivotVars.spouse.PensionIncomeSplitToSpouse = origSplit2;
					} else {
						pivotVars.PensionIncomeSplitToSpouse = origSplit1;
						pivotVars.spouse.PensionIncomeSplitToSpouse = splitLvl2;
					}
					reCalc();
				}
			} else {
				if (dip.PensionIncome > 0) {
					obsLvl1 = common.goldenMax(reCalc, pivotVars, "PensionIncomeSplitToSpouse", 0, dip.PensionIncome/2, dip, "TotalDisposableIncomeCouple");
					if (origIncomeLevel > obsLvl1 - common.bsTolGolden) {
						pivotVars.PensionIncomeSplitToSpouse = origSplit1;
					}
					reCalc();
				} else {
					if (dip.spouse.PensionIncome > 0) {
						obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "PensionIncomeSplitToSpouse", 0, dip.spouse.PensionIncome/2, dip, "TotalDisposableIncomeCouple");
						if (origIncomeLevel > obsLvl2 - common.bsTolGolden) {
							pivotVars.spouse.PensionIncomeSplitToSpouse = origSplit2;
						}
						reCalc();
					} 
				}
			}
		
		 
			 // (II) Check LIFs second
			origIncomeLevel = dip.TotalDisposableIncomeCouple;
			origSplit1 = pivotVars.LIFSplitToSpouse;
			origSplit2 = pivotVars.spouse.LIFSplitToSpouse;
			if ( (pivotVars.LIFPaymentWithdrawn > 0 && dip.Age >= 65) && (pivotVars.spouse.LIFPaymentWithdrawn > 0 && dip.spouse.Age >= 65)) {
				var obsLvl1 = common.goldenMax(reCalc, pivotVars, "LIFSplitToSpouse", 0, pivotVars.LIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl1 = pivotVars.LIFSplitToSpouse;
				pivotVars.LIFSplitToSpouse = origSplit1;
				reCalc();
		
				var obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "LIFSplitToSpouse", 0, pivotVars.spouse.LIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl2 = pivotVars.spouse.LIFSplitToSpouse;
				pivotVars.spouse.LIFSplitToSpouse = origSplit2;
				reCalc();
		
				if (obsLvl1 - common.bsTolGolden > origIncomeLevel || obsLvl2 - common.bsTolGolden > origIncomeLevel) {
					if (obsLvl1 > obsLvl2) {
						pivotVars.LIFSplitToSpouse = splitLvl1;
						pivotVars.spouse.LIFSplitToSpouse = origSplit2;
					} else {
						pivotVars.LIFSplitToSpouse = origSplit1;
						pivotVars.spouse.LIFSplitToSpouse = splitLvl2;
					}
					reCalc();
				}
				//if (strategy == 1) log.debug("both ================================ pivotVars.spouse.LIFSplitToSpouse " + Math.round(pivotVars.spouse.LIFSplitToSpouse));
			} else {
				if (pivotVars.LIFPaymentWithdrawn > 0 && dip.Age >= 65) {
					obsLvl1 = common.goldenMax(reCalc, pivotVars, "LIFSplitToSpouse", 0, pivotVars.LIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
					if (origIncomeLevel > obsLvl1 - common.bsTolGolden) {
						pivotVars.LIFSplitToSpouse = origSplit1;
					}
					reCalc();
				} else {
					if (pivotVars.spouse.LIFPaymentWithdrawn > 0 && dip.spouse.Age >= 65) {
						obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "LIFSplitToSpouse", 0, pivotVars.spouse.LIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
						if (origIncomeLevel > obsLvl2 - common.bsTolGolden) {
							pivotVars.spouse.LIFSplitToSpouse = origSplit2;
						}
						//if (strategy == 1) log.debug("==================================== pivotVars.spouse.LIFSplitToSpouse " + Math.round(pivotVars.spouse.LIFSplitToSpouse));
						reCalc();
					}   
				}
			}
		
		
			// (III) Check RRIFs third
			origIncomeLevel = dip.TotalDisposableIncomeCouple;
			origSplit1 = pivotVars.RRIFSplitToSpouse;
			origSplit2 = pivotVars.spouse.RRIFSplitToSpouse;
			//if (strategy == 0 && dsp.Year == 2058) log.debug(i + " splitCouple RRIF " + origSplit1 + " " + origSplit2 + " " + origIncomeLevel);
			if ( (pivotVars.RRIFPaymentWithdrawn > 0 && dip.Age >= 65) && (pivotVars.spouse.RRIFPaymentWithdrawn > 0 && dip.spouse.Age >= 65)) {
				const obsLvl1 = common.goldenMax(reCalc, pivotVars, "RRIFSplitToSpouse", 0, pivotVars.RRIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl1 = pivotVars.RRIFSplitToSpouse;
				pivotVars.RRIFSplitToSpouse = origSplit1;
				reCalc();
		
				const obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "RRIFSplitToSpouse", 0, pivotVars.spouse.RRIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl2 = pivotVars.spouse.RRIFSplitToSpouse;
				pivotVars.spouse.RRIFSplitToSpouse = origSplit2;
				reCalc();
		
				if (obsLvl1 - common.bsTolGolden > origIncomeLevel || obsLvl2 - common.bsTolGolden > origIncomeLevel) {
					if (obsLvl1 > obsLvl2) {
						pivotVars.RRIFSplitToSpouse = splitLvl1;
						pivotVars.spouse.RRIFSplitToSpouse = origSplit2;
					} else {
						pivotVars.RRIFSplitToSpouse = origSplit1;
						pivotVars.spouse.RRIFSplitToSpouse = splitLvl2;
					}
					reCalc();
				}
				//if (dip.Year == 2029) log.debug("both ================================ pivotVars.spouse.RRIFSplitToSpouse " + Math.round(pivotVars.spouse.RRIFSplitToSpouse) + " " + pivotVars.RRIFSplitToSpouse);
			} else {
				if (pivotVars.RRIFPaymentWithdrawn > 0 && dip.Age >= 65) {
					obsLvl1 = common.goldenMax(reCalc, pivotVars, "RRIFSplitToSpouse", 0, pivotVars.RRIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
					if (origIncomeLevel > obsLvl1 - common.bsTolGolden) {
						pivotVars.RRIFSplitToSpouse = origSplit1;
					}
					reCalc();
				} else {
					if (pivotVars.spouse.RRIFPaymentWithdrawn > 0 && dip.spouse.Age >= 65) {
						obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "RRIFSplitToSpouse", 0, pivotVars.spouse.RRIFPaymentWithdrawn/2, dip, "TotalDisposableIncomeCouple");
						if (origIncomeLevel > obsLvl2 - common.bsTolGolden) {
							pivotVars.spouse.RRIFSplitToSpouse = origSplit2;
						}
						//if (dip.Year == 2029) log.debug("==================================== pivotVars.spouse.RRIFSplitToSpouse " + Math.round(pivotVars.spouse.RRIFSplitToSpouse) + " " + pivotVars.RRIFSplitToSpouse);
						reCalc();
					}
				} 
			}
		
		
			// (IV) Check Custom Reg Annuities fourth
			let splittableRegAnn1, splittableRegAnn2;
			if (dip.Age >= 65) {
				splittableRegAnn1 = common.getCustomIncome(dip, parent_user_supplied_vars.c1, "AnnuityAmount", false);
			} else {
				splittableRegAnn1 = 0;
			}
			if (dip.spouse.Age >= 65) {
				splittableRegAnn2 = common.getCustomIncome(dip.spouse, parent_user_supplied_vars.c2, "AnnuityAmount", false);
			} else {
				splittableRegAnn2 = 0;
			}
		
			origIncomeLevel = dip.TotalDisposableIncomeCouple;
			origSplit1 = pivotVars.RegisteredAnnuitySplitToSpouse;
			origSplit2 = pivotVars.spouse.RegisteredAnnuitySplitToSpouse;
		
			if ((splittableRegAnn1 > 0) && (splittableRegAnn2 > 0)) {
				//if (dip.Year > 2020 && strategy == 0) log.debug(dip.Year + " ------- can split c1 & c2 " + splittableRegAnn1 + " " + splittableRegAnn2);
				const obsLvl1 = common.goldenMax(reCalc, pivotVars, "RegisteredAnnuitySplitToSpouse", 0, splittableRegAnn1/2, dip, "TotalDisposableIncomeCouple");
				const splitLvl1 = pivotVars.RegisteredAnnuitySplitToSpouse;
				pivotVars.RegisteredAnnuitySplitToSpouse = origSplit1;
				reCalc();
		
				const obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "RegisteredAnnuitySplitToSpouse", 0, splittableRegAnn2/2, dip, "TotalDisposableIncomeCouple");
				   const splitLvl2 = pivotVars.spouse.RegisteredAnnuitySplitToSpouse;
				pivotVars.spouse.RegisteredAnnuitySplitToSpouse = origSplit2;
				reCalc();
		
				if (obsLvl1 - common.bsTolGolden > origIncomeLevel || obsLvl2 - common.bsTolGolden > origIncomeLevel)
				{
					if (obsLvl1 > obsLvl2) {
						pivotVars.RegisteredAnnuitySplitToSpouse = splitLvl1;
						pivotVars.spouse.RegisteredAnnuitySplitToSpouse = origSplit2;
					} else {
						pivotVars.RegisteredAnnuitySplitToSpouse = origSplit1;
						pivotVars.spouse.RegisteredAnnuitySplitToSpouse = splitLvl2;
					}
					reCalc();
				}
			} else {
				if (splittableRegAnn1 > 0) {
					//if (dip.Year > 2020 && strategy == 0) log.debug(dip.Year + " ------- can split c1 " + splittableRegAnn1);
					obsLvl1 = common.goldenMax(reCalc, pivotVars, "RegisteredAnnuitySplitToSpouse", 0, splittableRegAnn1/2, dip, "TotalDisposableIncomeCouple");
					if (origIncomeLevel > obsLvl1 - common.bsTolGolden) {
						pivotVars.RegisteredAnnuitySplitToSpouse = origSplit1;
					}
					reCalc();
				} else {
					if (splittableRegAnn2 > 0) {
						obsLvl2 = common.goldenMax(reCalc, pivotVars.spouse, "RegisteredAnnuitySplitToSpouse", 0, splittableRegAnn2/2, dip, "TotalDisposableIncomeCouple");
						if (origIncomeLevel > obsLvl2 - common.bsTolGolden) {
							pivotVars.spouse.RegisteredAnnuitySplitToSpouse = origSplit2;
						}
						reCalc();
					}
				} 
			}
		
			//if (dip.Year > 2020 && strategy == 0) log.debug(dip.Year + " -------- " + pivotVars.RegisteredAnnuitySplitToSpouse + " " + splittableRegAnn1 + " " + splittableRegAnn2);
		},		
		
		transferNrTfsaCouple(responseObj, strategy, i, count, parent_user_supplied_vars, dip, dsp, pivotVars, currentDisposableIncome)
		{
			var reCalc = function() {
				common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
				common.populateSavingsAndIncomeProjections(true, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
			}
		
		
			//// Joint NR -> TFSAs
			var tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution  - pivotVars.SpousalTFSAContribution - dsp.TFSADeposit;
			var tfsaRoomSpouse = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - pivotVars.spouse.TFSAContribution - pivotVars.spouse.SpousalTFSAContribution - dsp.spouse.TFSADeposit;
			//if (strategy == 1 && dsp.Year == 2050) log.debug(strategy + " " + dsp.Year + " " + count + " transferNrTfsaCouple initial TFSA room: " + tfsaRoom + " " + tfsaRoomSpouse);
		
			var amountLeftInNonRegSavings = dsp.JointNonRegisteredSavingsStart - pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 - pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 + pivotVars.JointContributionToNonRegSavingsSpouse1 + pivotVars.JointContributionToNonRegSavingsSpouse2;
			if (amountLeftInNonRegSavings < 0)
			{
				log.warn(strategy + " " + dsp.Year + " " + count + " =============Warning joint non-reg is below 0!!! " + amountLeftInNonRegSavings);
			}
		
			if (tfsaRoom < 0 || tfsaRoomSpouse < 0)
			{
				log.warn(strategy + " " + dsp.Year + " " + count + " =============Warning tfsaroom is below 0!!! " + tfsaRoom + " " + tfsaRoomSpouse);
				return;
			}
		
			var additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoom);
			if (additionalTFSA > 0) {
				pivotVars.TFSAContribution += additionalTFSA;
				//if (strategy == 0 && dsp.Year == 2058) log.debug(dsp.Year + " " + count + " *transferNrTfsaCouple " + additionalTFSA + " " + Math.round(pivotVars.JointWithdrawalFromNonRegSavingsSpouse1) + " " + Math.round(pivotVars.TFSAContribution));
				common.bisectUp(reCalc, pivotVars, "JointWithdrawalFromNonRegSavingsSpouse1", pivotVars.JointWithdrawalFromNonRegSavingsSpouse1, pivotVars.JointWithdrawalFromNonRegSavingsSpouse1+additionalTFSA, dip, "TotalDisposableIncomeCouple", currentDisposableIncome);
				//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " **transferNrTfsaCouple " + additionalTFSA + " " + Math.round(pivotVars.JointWithdrawalFromNonRegSavingsSpouse1) + " " + Math.round(pivotVars.TFSAContribution));
			}
		
			amountLeftInNonRegSavings = dsp.JointNonRegisteredSavingsStart - pivotVars.JointWithdrawalFromNonRegSavingsSpouse1 - pivotVars.JointWithdrawalFromNonRegSavingsSpouse2 + pivotVars.JointContributionToNonRegSavingsSpouse1 + pivotVars.JointContributionToNonRegSavingsSpouse2;
			additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoomSpouse);
			if (additionalTFSA > 0) {
				pivotVars.spouse.TFSAContribution += additionalTFSA;
				//if (strategy == 0 && dsp.Year == 2058) log.debug(dsp.Year + " " + count + " transferNrTfsaCouple spouse " + additionalTFSA + " " + Math.round(pivotVars.JointWithdrawalFromNonRegSavingsSpouse2) + " " + Math.round(pivotVars.spouse.TFSAContribution));
				common.bisectUp(reCalc, pivotVars, "JointWithdrawalFromNonRegSavingsSpouse2", pivotVars.JointWithdrawalFromNonRegSavingsSpouse2, pivotVars.JointWithdrawalFromNonRegSavingsSpouse2+additionalTFSA, dip, "TotalDisposableIncomeCouple", currentDisposableIncome);
				//if (strategy == 1 && dsp.Year == 2050) log.debug(dsp.Year + " " + count + " transferNrTfsaCouple spouse " + additionalTFSA + " " + Math.round(pivotVars.JointWithdrawalFromNonRegSavingsSpouse2) + " " + Math.round(pivotVars.spouse.TFSAContribution));
			}
		
		
			//// Individual NR -> Own TFSA
			tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution  - pivotVars.SpousalTFSAContribution - dsp.TFSADeposit;
			amountLeftInNonRegSavings = dsp.NonRegisteredSavingsStart - pivotVars.WithdrawalFromNonRegSavings + pivotVars.ContributionToNonRegSavings;
			additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoom);
			if (additionalTFSA > 0) {
				pivotVars.TFSAContribution += additionalTFSA;
				common.bisectUp(reCalc, pivotVars, "WithdrawalFromNonRegSavings", pivotVars.WithdrawalFromNonRegSavings, pivotVars.WithdrawalFromNonRegSavings+additionalTFSA, dip, "TotalDisposableIncomeCouple", currentDisposableIncome);
			}
		
			tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution  - pivotVars.SpousalTFSAContribution - dsp.TFSADeposit;
			amountLeftInNonRegSavings = dsp.spouse.NonRegisteredSavingsStart - pivotVars.spouse.WithdrawalFromNonRegSavings + pivotVars.spouse.ContributionToNonRegSavings;
			additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoom);
			if (additionalTFSA > 0) {
				pivotVars.TFSAContribution += additionalTFSA;
				common.bisectUp(reCalc, pivotVars.spouse, "WithdrawalFromNonRegSavings", pivotVars.spouse.WithdrawalFromNonRegSavings, pivotVars.spouse.WithdrawalFromNonRegSavings+additionalTFSA, dip, "TotalDisposableIncomeCouple", currentDisposableIncome);
			}
		
		
			//// Individual NR -> Spouse's TFSA
			tfsaRoomSpouse = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - pivotVars.spouse.TFSAContribution - pivotVars.spouse.SpousalTFSAContribution - dsp.spouse.TFSADeposit;
			amountLeftInNonRegSavings = dsp.NonRegisteredSavingsStart - pivotVars.WithdrawalFromNonRegSavings + pivotVars.ContributionToNonRegSavings;
			additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoomSpouse);
			if (additionalTFSA > 0) {
				pivotVars.spouse.TFSAContribution += additionalTFSA;
				common.bisectUp(reCalc, pivotVars, "WithdrawalFromNonRegSavings", pivotVars.WithdrawalFromNonRegSavings, pivotVars.WithdrawalFromNonRegSavings+additionalTFSA, dip, "TotalDisposableIncomeCouple", currentDisposableIncome);
			}
		
			tfsaRoomSpouse = dsp.spouse.TFSAContributionRoomStart + dsp.spouse.TFSAContributionRoomGained - pivotVars.spouse.TFSAContribution - pivotVars.spouse.SpousalTFSAContribution - dsp.spouse.TFSADeposit;
			amountLeftInNonRegSavings = dsp.spouse.NonRegisteredSavingsStart - pivotVars.spouse.WithdrawalFromNonRegSavings + pivotVars.spouse.ContributionToNonRegSavings;
			additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoomSpouse);
			if (additionalTFSA > 0) {
				pivotVars.spouse.TFSAContribution += additionalTFSA;
				common.bisectUp(reCalc, pivotVars.spouse, "WithdrawalFromNonRegSavings", pivotVars.spouse.WithdrawalFromNonRegSavings, pivotVars.spouse.WithdrawalFromNonRegSavings+additionalTFSA, dip, "TotalDisposableIncomeCouple", currentDisposableIncome);
			}
		}
	}
}