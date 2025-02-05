'use strict';

module.exports = (log) => {

	const g = require( './global_constants.json' );
	const common = require( './common.js' );

	return {

		getSinglePivotVars(responseObj, i, count, strategy, desiredIncome, currentDisposableIncome, parent_user_supplied_vars, dip, dsp, pivotVars)
		{
			//only care about first user c1 here
			let user_supplied_vars = parent_user_supplied_vars.c1;

			let tfsaRoom = dsp.TFSAContributionRoomStart + dsp.TFSAContributionRoomGained - pivotVars.TFSAContribution - dsp.TFSADeposit;
			// if (strategy == 0 && dsp.Age < 65) log.debug(dsp.Age + " " + count + " initial room: " + dsp.TFSAContributionRoomStart + " " + tfsaRoom + " " + dsp.TFSAContributionRoomGained + " " + pivotVars.TFSAContribution);

			// special single year deposit - follows same rules as other savings
			let customDeposit = 0;
			if (user_supplied_vars.CustomDeposits[dsp.Age] != null)
			{
				log.debug(i + " " + count + " got custom deposit for " + dsp.Age + " " + user_supplied_vars.CustomDeposits[dsp.Age]);
				customDeposit = user_supplied_vars.CustomDeposits[dsp.Age];
				customDeposit = customDeposit - dsp.TFSADeposit - dsp.DepositToNonRegSavings - dsp.DepositToLoan;

				// 1st priority pay off Line of Credit
				if (dsp.LineOfCreditStartBalance > 0) {
					const locReduction = Math.min(customDeposit, dsp.LineOfCreditStartBalance - pivotVars.LineOfCreditLoanRepayment - dsp.DepositToLoan);
					dsp.DepositToLoan += locReduction;
					customDeposit -= locReduction;
				}

				// 2nd priority save to TSFA
				if (customDeposit > 0) {
					const additionalTFSA = Math.min(customDeposit, tfsaRoom);
					dsp.TFSADeposit += additionalTFSA
					customDeposit -= additionalTFSA;
					tfsaRoom -= additionalTFSA;
				}

				// 3rd priority save to non-reg savings
				if (customDeposit > 0) {
					dsp.DepositToNonRegSavings += customDeposit;
				}
			}


			const endRRIFAge = user_supplied_vars.Age+user_supplied_vars.endRRIFIndex;
			const minRRIFWithdrawl = common.getMinRRIF(dsp.Age, dsp.RRIFMarketValueStart, dsp.RRIFNew);
			const minLIFWithdrawl = common.getMinLIF(dsp.Age, dsp.LIFMarketValueStart, dsp.LIFNew);

			//if they are retired we need to come up with a disposable income == desiredIncome
			if (dsp.Age >= user_supplied_vars.RetirementAge)
			{
				let estimatedNeededIncome = desiredIncome - currentDisposableIncome;
				// if (strategy == 0 && dsp.Year == 2039) log.debug(count + " estimatedNeededIncome " + Math.round(currentDisposableIncome) + " " + Math.round(desiredIncome) + " " + Math.round(estimatedNeededIncome));
				
				const maxRRIFWithdrawl = dsp.RRIFMarketValueStart;
				const maxLIFWithdrawl = common.getMaxLIF(dsp.Age, dsp.LIFMarketValueStart);

				const imposedCorpWithdrawal = Math.min(user_supplied_vars.CorporateWithdrawalAmount * dip.InflationFactor, dip.CorporateStartMarketValue);
				const additionalCorpWithdrawal = imposedCorpWithdrawal - pivotVars.CorporateWithdrawalAmount;
				if (additionalCorpWithdrawal > 0) {
					pivotVars.CorporateWithdrawalAmount += additionalCorpWithdrawal;
					estimatedNeededIncome -= additionalCorpWithdrawal;
				}

				if (strategy == common.STRATEGY_REGISTERED_FUNDS_FIRST)
				{
					// Imposed LIF
					let imposedLIFWithdrawl;
					if (dsp.Age > g.EARLIEST_LIF_DEPLETION_AGE) {
						// only enough LIF to max pension credits, it is mostly gone by now.
						imposedLIFWithdrawl = Math.min( Math.max(Math.max(g.FEDERAL_MAX_PENSION_CREDITS - dip.PensionIncome, 0), minLIFWithdrawl), maxLIFWithdrawl );
					}
					else {
						imposedLIFWithdrawl = Math.min(Math.max(minLIFWithdrawl, user_supplied_vars.evenLIFDrawdown*dsp.InflationFactor), maxLIFWithdrawl);
					}
					// log.debug("imposed LIF: " + imposedLIFWithdrawl + " " + Math.round(user_supplied_vars.evenLIFDrawdown*dsp.InflationFactor));
					const additionalLIFWithdrawl = imposedLIFWithdrawl - pivotVars.LIFPaymentWithdrawn;
					if (additionalLIFWithdrawl > 0) {
						pivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						estimatedNeededIncome -= additionalLIFWithdrawl;
					}

					// Imposed RRIF
					let imposedRRIFWithdrawl;
					if (dsp.Age > endRRIFAge) {
						// only enough RRIF to max pension credits, it is mostly gone by now.
						imposedRRIFWithdrawl = Math.min( Math.max(Math.max(g.FEDERAL_MAX_PENSION_CREDITS - dip.PensionIncome - pivotVars.LIFPaymentWithdrawn, 0), minRRIFWithdrawl), maxRRIFWithdrawl );
					}
					else {
						imposedRRIFWithdrawl = Math.min(Math.max(minRRIFWithdrawl, user_supplied_vars.evenRRIFDrawdown*dsp.InflationFactor), maxRRIFWithdrawl);
					}
					//log.debug(dsp.Year + " " + count + " " + dsp.Age + " " + endRRIFAge + " total imposed RIFF: " + imposedRRIFWithdrawl + " " + Math.round(user_supplied_vars.evenRRIFDrawdown*dsp.InflationFactor));
					const additionalRRIFWithdrawl = imposedRRIFWithdrawl - pivotVars.RRIFPaymentWithdrawn;
					if (additionalRRIFWithdrawl > 0) {
						pivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						estimatedNeededIncome -= additionalRRIFWithdrawl;
						//log.debug(dsp.Year + " " + count + " additional imposed RIFF: " + additionalRRIFWithdrawl);
					}
				}
				else
				{
					// Minimum LIF and RIFF
					const additionalLIFWithdrawl = minLIFWithdrawl - pivotVars.LIFPaymentWithdrawn;
					if (additionalLIFWithdrawl > 0)
					{
						pivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						estimatedNeededIncome -= additionalLIFWithdrawl;
					}

					const additionalRRIFWithdrawl = minRRIFWithdrawl - pivotVars.RRIFPaymentWithdrawn;
					if (additionalRRIFWithdrawl > 0)
					{
						pivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
						estimatedNeededIncome -= additionalRRIFWithdrawl;
					}

					//if (strategy == 1 && dsp.Age > 66 && dsp.Age < 73) log.debug(count + " " + strategy + " " + dsp.Age + " " + Math.round(minRRIFWithdrawl) + " " + Math.round(pivotVars.RRIFPaymentWithdrawn));
				}


				//if (dsp.Year == 2018) log.debug(dsp.Year + " " + count + " " + strategy + " " + dsp.Age + " " + Math.round(desiredIncome) + " estimatedNeededIncome after mandatory: " + estimatedNeededIncome);

				if (estimatedNeededIncome > 0)
				{
					//decrease savings to increase income for this pivot step
					///////////////////////////////////////////////////////

					//if (dsp.Year == 2018) log.debug(dsp.Year + " " + count + " WD needed income: " + estimatedNeededIncome);

					//first reduce any savings pivots that might be in place then go in priority withdrawal order
					if (pivotVars.LineOfCreditLoanRepayment > 0) {
						const locReduction = Math.min(estimatedNeededIncome, pivotVars.LineOfCreditLoanRepayment);
						pivotVars.LineOfCreditLoanRepayment -= locReduction;
						estimatedNeededIncome -= locReduction;
						//if (dsp.Year == 2018) log.debug(dsp.Year + " " + count + " pivotVars.LineOfCreditLoanRepayment: " + pivotVars.LineOfCreditLoanRepayment + " " + locReduction);
					}
					if (pivotVars.ContributionToNonRegSavings > 0) {
						const additionalNonReg = Math.min(estimatedNeededIncome, pivotVars.ContributionToNonRegSavings);
						pivotVars.ContributionToNonRegSavings -= additionalNonReg;
						estimatedNeededIncome -= additionalNonReg;
						// if (strategy == 2) log.debug("pivotVars.ContributionToNonRegSavings: " + pivotVars.ContributionToNonRegSavings);
					}
					if (pivotVars.TFSAContribution > 0) {
						const additional = Math.min(estimatedNeededIncome, pivotVars.TFSAContribution);
						pivotVars.TFSAContribution -= additional;
						estimatedNeededIncome -= additional;
						tfsaRoom += additional;
						//if (strategy == 1) log.debug(dsp.Age + " TFSAContribution dec to: " + pivotVars.TFSAContribution);
					}


					// 1st priority Non-Reg Withrawls
					const additionalNonReg = Math.min(estimatedNeededIncome, dsp.NonRegisteredSavingsStart - pivotVars.WithdrawalFromNonRegSavings + dsp.DepositToNonRegSavings);
					pivotVars.WithdrawalFromNonRegSavings += additionalNonReg;
					estimatedNeededIncome -= additionalNonReg;
					// if (strategy == 0 && dsp.Age == 58) log.debug(Math.round(dsp.NonRegisteredSavingsStart) + " WithdrawalFromNonRegSavings: " + Math.round(pivotVars.WithdrawalFromNonRegSavings));

					// under some strategies TFSA is in priority before LIF/RRIF and if some strategies it is after.
					if (estimatedNeededIncome > 0)
					{
						if (strategy != common.STRATEGY_NONREGISTERED_FUNDS_FIRST)
						{
							// then TFSA Withdrawls
							const additionalTFSA = Math.min(estimatedNeededIncome, dsp.TFSAHoldingsStart - pivotVars.TFSAWithdrawal + dsp.TFSADeposit);
							pivotVars.TFSAWithdrawal += additionalTFSA;
							estimatedNeededIncome -= additionalTFSA;
							// if (strategy == 1) log.debug(dsp.Age + " TFSAWithdrawal inc to: " + pivotVars.TFSAWithdrawal);
						}
					}
					
					// then LIF up to Max
					if (estimatedNeededIncome > 0)
					{
						const lifMax = common.getMaxLIF(dsp.Age, dsp.LIFMarketValueStart);
						const lifAvailable = lifMax - pivotVars.LIFPaymentWithdrawn;
						const additionalLIFWithdrawl = Math.min(estimatedNeededIncome, lifAvailable);
						estimatedNeededIncome -= additionalLIFWithdrawl;
						pivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
						// if (strategy == 2) log.debug("additionalLIFWithdrawl: " + additionalLIFWithdrawl);
					}

					// then RIF
					if (estimatedNeededIncome > 0)
					{
						const rrifMax = dsp.RRIFMarketValueStart;
						const rrifAvailable = rrifMax - pivotVars.RRIFPaymentWithdrawn;
						const additionalRRIFWithdrawl = Math.min(estimatedNeededIncome, rrifAvailable);
						estimatedNeededIncome -= additionalRRIFWithdrawl;
						pivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
					}


					// then try an early transfer of LIRA to LIF
					if (estimatedNeededIncome > 0)
					{
						if (dsp.Age <= user_supplied_vars.LIRATransferAge && dsp.Age >= 55)
						{
							user_supplied_vars.LIRATransferAge = dsp.Age;
							dsp.LIFNew = dsp.LIRAMarketValueEnd;
							dsp.LIFMarketValueStart = dsp.LIRAMarketValueEnd;
							const lifMax = common.getMaxLIF(dsp.Age, dsp.LIFMarketValueStart);
							const lifAvailable = lifMax - pivotVars.LIFPaymentWithdrawn;
							const additionalLIFWithdrawl = Math.min(estimatedNeededIncome, lifAvailable);
							estimatedNeededIncome -= additionalLIFWithdrawl;
							pivotVars.LIFPaymentWithdrawn += additionalLIFWithdrawl;
							log.debug("had to move up LIRATransferAge to " + user_supplied_vars.LIRATransferAge);
						}
					}

					// then try an early transfer of RRSP to RRIF
					if (estimatedNeededIncome > 0)
					{
						if (dsp.Age <= user_supplied_vars.RRSPTransferAge)
						{
							user_supplied_vars.RRSPTransferAge = dsp.Age;
							dsp.RRIFNew = dsp.RRSPMarketValueEnd;
							dsp.RRIFMarketValueStart = dsp.RRSPMarketValueEnd;
							const rrifMax = dsp.RRIFMarketValueStart;
							const rrifAvailable = rrifMax - pivotVars.RRIFPaymentWithdrawn;
							const additionalRRIFWithdrawl = Math.min(estimatedNeededIncome, rrifAvailable);
							estimatedNeededIncome -= additionalRRIFWithdrawl;
							pivotVars.RRIFPaymentWithdrawn += additionalRRIFWithdrawl;
							log.debug("had to move up RRSPTransferAge to " + user_supplied_vars.RRSPTransferAge + " " + Math.round(pivotVars.RRIFPaymentWithdrawn));
						}
					}

					// under some strategies TFSA is in priority before LIF/RRIF, here is the case it is after.
					if (estimatedNeededIncome > 0)
					{
						if (strategy == common.STRATEGY_NONREGISTERED_FUNDS_FIRST)
						{
							// then TFSA Withdrawls
							const additionalTFSA = Math.min(estimatedNeededIncome, dsp.TFSAHoldingsStart - pivotVars.TFSAWithdrawal + dsp.TFSADeposit);
							pivotVars.TFSAWithdrawal += additionalTFSA;
							estimatedNeededIncome -= additionalTFSA;
							// if (strategy == 1) log.debug(dsp.Age + " TFSAWithdrawal inc to: " + pivotVars.TFSAWithdrawal);
						}
					}

					// second last resort withdraw more corporate
					if (estimatedNeededIncome > 0)
					{
						const additionalCorp = Math.min(dip.CorporateStartMarketValue - pivotVars.CorporateWithdrawalAmount, estimatedNeededIncome);
						pivotVars.CorporateWithdrawalAmount += additionalCorp;
						estimatedNeededIncome -= additionalCorp;
					}

					// last resort make up difference with line of credit
					if (estimatedNeededIncome > 0)
					{
						// if (strategy == 0 && dsp.Year == 2039) log.debug("LOC: " + count + " " + estimatedNeededIncome);
						pivotVars.LineOfCreditLoanTaken += estimatedNeededIncome;
						estimatedNeededIncome = 0;
						// if (strategy == 0 && dsp.Year == 2039) log.debug(dsp.Year + " " + count + " last resort LOC: " + pivotVars.LineOfCreditLoanTaken + " " + pivotVars.RRIFPaymentWithdrawn);
					}

				}
				else if (estimatedNeededIncome < 0)
				{
					//increase savings to reduce income for this pivot step
					///////////////////////////////////////////////////////
					
					let desiredSavings = -estimatedNeededIncome;
					//if (dsp.Year == 2018) log.debug(dsp.Year + " " + count + " SAVE desired savings: " + desiredSavings);

					// first reduce any withdrawal pivots that might be in place then go in priority savings order
					if (pivotVars.LineOfCreditLoanTaken > 0) {
						const locReduction = Math.min(desiredSavings, pivotVars.LineOfCreditLoanTaken);
						pivotVars.LineOfCreditLoanTaken -= locReduction;
						desiredSavings -= locReduction;
						//if (dsp.Year == 2018) log.debug(dsp.Year + " " + count + " pivotVars.LineOfCreditLoanTaken: " + pivotVars.LineOfCreditLoanTaken + " " + locReduction);
					}
					if (pivotVars.TFSAWithdrawal > 0) {
						const withdrawlReduction = Math.min(pivotVars.TFSAWithdrawal, desiredSavings);
						pivotVars.TFSAWithdrawal  -= withdrawlReduction;
						desiredSavings -= withdrawlReduction;
						tfsaRoom += withdrawlReduction;
					}
					if (pivotVars.WithdrawalFromNonRegSavings > 0) {
						const withdrawlReduction = Math.min(pivotVars.WithdrawalFromNonRegSavings, desiredSavings);
						pivotVars.WithdrawalFromNonRegSavings -= withdrawlReduction;
						desiredSavings -= withdrawlReduction;
					}
					
					// 1st priority pay off Line of Credit
					if (dsp.LineOfCreditStartBalance > 0) {
						const locReduction = Math.min(desiredSavings, dsp.LineOfCreditStartBalance - pivotVars.LineOfCreditLoanRepayment);
						pivotVars.LineOfCreditLoanRepayment += locReduction;
						desiredSavings -= locReduction;
						//if (dsp.Year == 2018) log.debug(dsp.Year + " " + count + " pivotVars.LineOfCreditLoanRepayment2: " + pivotVars.LineOfCreditLoanRepayment + " " + locReduction);
					}

					// 2nd priority save to TSFA
					if (desiredSavings > 0) {
						const additionalTFSA = Math.min(desiredSavings, tfsaRoom);
						pivotVars.TFSAContribution += additionalTFSA
						// if (strategy == 1 && dsp.Age > 66 && dsp.Age < 73) log.debug(count + " " + strategy + " " + dsp.Age + " too much income so increase TSFA " + additionalTFSA + " " + Math.round(pivotVars.TFSAContribution));
						desiredSavings -= additionalTFSA;
						tfsaRoom -= additionalTFSA;
					}

					// 3rd priority save to non-reg savings
					if (desiredSavings > 0) {
						pivotVars.ContributionToNonRegSavings += desiredSavings;
						// if (strategy == 0 && dsp.Age == 58) log.debug("ContributionToNonRegSavings " + pivotVars.ContributionToNonRegSavings);
					}
				}
				else
				{
					// log.debug("We are exactly matching desired income of " + Math.round(desiredIncome));
				}
			}
			else
			{
				// if they are not retired yet we have no targets, fill in pivots with user supplied values or leave as default 0
				// we will pivot once to calc some DC, TFSA etc vars.
				/////////////////////////////////////////////////////////////////////////////////////////////////////////////////
				pivotVars.CorporateWithdrawalAmount = 0;

				//mandatory minimum withdrawls
				pivotVars.LIFPaymentWithdrawn = minLIFWithdrawl;
				pivotVars.RRIFPaymentWithdrawn = minRRIFWithdrawl;

				// only fill an RRSP con in pre-retirement if we're also pre-transfer age
				// this mainly applies to the cases where ret age > 71 = max transfer age
				if (dsp.Age < user_supplied_vars.RRSPTransferAge) {
					let rrspContribRoom = dsp.RRSPContributionRoomStart + dsp.RRSPContributionRoomGained;
					pivotVars.DCEmployeeContribution = Math.min(user_supplied_vars.DCEmployeeContribution*dsp.InflationFactor, rrspContribRoom);
					pivotVars.DCEmployerContribution = Math.min(user_supplied_vars.DCEmployerContribution*dsp.InflationFactor, rrspContribRoom);
					rrspContribRoom -= (pivotVars.DCEmployeeContribution + pivotVars.DCEmployerContribution);

					pivotVars.RRSPContribution = Math.min(user_supplied_vars.RRSPContributionPayment*dsp.InflationFactor, rrspContribRoom);
				}

				let runningSavings = user_supplied_vars.AnnualSavings*dsp.InflationFactor - pivotVars.TFSAContribution - pivotVars.ContributionToNonRegSavings; // non-RRSP savings
				runningSavings += pivotVars.LIFPaymentWithdrawn + pivotVars.RRIFPaymentWithdrawn;

				if (runningSavings > 0)
				{
					const additionalTSFA = Math.min(runningSavings, tfsaRoom);
					pivotVars.TFSAContribution = pivotVars.TFSAContribution + additionalTSFA;
					tfsaRoom -= additionalTSFA;
					runningSavings -= additionalTSFA;
					pivotVars.ContributionToNonRegSavings += runningSavings;
				}

				//if (strategy == 0) log.debug(count + " " + strategy + " " + dsp.Age + " " + Math.round(pivotVars.ContributionToNonRegSavings) + " " + pivotVars.TFSAContribution);
			}


			// always contribute max TFSA if possible under most strategies
			// we only do it after the first pivot in order to get our base income level
			// which is our target in pre-retirement years
			let doTransferTargetCount = 1;
			if (dsp.Age >= user_supplied_vars.RetirementAge) {
				doTransferTargetCount = 0;
			}

			if (strategy != common.STRATEGY_TAXFREE_FUNDS_FIRST && tfsaRoom > 0 && count > doTransferTargetCount) {
				const amountLeftInNonRegSavings = dsp.NonRegisteredSavingsStart - pivotVars.WithdrawalFromNonRegSavings + pivotVars.ContributionToNonRegSavings;
				const additionalTFSA = Math.min(amountLeftInNonRegSavings, tfsaRoom);
				pivotVars.TFSAContribution += additionalTFSA;

				if (desiredIncome == -1) {
					// this is the one spot where our income target can change
					// pre-retirement we want it to match our pre-TFSA transfer income level
					// so bisect up here to match our currentDisposableIncome
					const reCalc = function() {
						common.populateSavingsAndIncomeProjections(false, responseObj, strategy, i, parent_user_supplied_vars, dsp, dip, pivotVars);
					}
					common.bisectUp(reCalc, pivotVars, "WithdrawalFromNonRegSavings", pivotVars.WithdrawalFromNonRegSavings, pivotVars.WithdrawalFromNonRegSavings+additionalTFSA, dip, "TotalDisposableIncome", currentDisposableIncome);
				} else {
					pivotVars.WithdrawalFromNonRegSavings += additionalTFSA;
				}

				if (strategy == 0 && dsp.Age == 58) log.debug(count + " " + strategy + " " + dsp.Age + " " + Math.round(dsp.NonRegisteredSavingsStart) + " " + pivotVars.WithdrawalFromNonRegSavings + " " + Math.round(tfsaRoom) + " shifted " + additionalTFSA + " from non-reg to TFSA");
			}

			if (pivotVars.WithdrawalFromNonRegSavings != 0 && pivotVars.ContributionToNonRegSavings != 0) {
				log.warn(count + " " + strategy + " " + dsp.Age + " ----------Warning doing both for NonRegSavings! " + Math.round(pivotVars.WithdrawalFromNonRegSavings) + " " + Math.round(pivotVars.ContributionToNonRegSavings));
			}
			if (pivotVars.TFSAWithdrawal != 0 && pivotVars.TFSAContribution != 0) {
				log.warn(count + " " + strategy + " " + dsp.Age + " ----------Warning doing both for TFSA! " + Math.round(pivotVars.TFSAWithdrawal) + " " + Math.round(pivotVars.TFSAContribution));
			}
			if (pivotVars.ContributionToNonRegSavings > 0 && pivotVars.TFSAContribution == 0) {
				log.warn(count + " " + strategy + " " + dsp.Age + " ----------Non-reg contrib with no TFSA contrib?" + Math.round(pivotVars.TFSAContribution) + " " + Math.round(pivotVars.ContributionToNonRegSavings));
			}

			//if (strategy == 1 && dsp.Age > 65 && dsp.Age < 72) log.debug(dsp.Age + " " + Math.round(pivotVars.TFSAContribution) + " " + Math.round(dsp.RRSPMarketValueEnd) + " " + Math.round(dsp.RRIFMarketValueStart) + " RRIFPaymentWithdrawn: " + Math.round(pivotVars.RRIFPaymentWithdrawn));


			return pivotVars;
		}
	}
}


