const g = require( './global_constants.json' );

exports.getUserSuppliedVars = function(body) {

	var result = {c1:{},c2:{}};
	if (body.c2 == null)
	{
		//if single then zero out some values not present in the missing second person
		//result.c2 = {};
		//result.c2.RetirementAge = 0;
		//result.c2.Age = 0;
		//result.c2.IndividualAllPensionsIndex = 0;
		//result.c2.CorporateMarketValue = 0;
		body.JointNRMarketValue = 0;
		result.c1 = processBodyData(body.c1);
	}
	else
	{
		result.c1 = processBodyData(body.c1);
		result.c2 = processBodyData(body.c2);
	}

	//shared fields
	result.Inflation = body.Inflation;
	if (result.Inflation == null) result.Inflation = 0.02;
	result.c1.Inflation = result.Inflation; 
	if (body.c2 != null) result.c2.Inflation = result.Inflation;
	
	result.InvestmentRiskProfile = body.InvestmentRiskProfile;	// B39
	result.c1.InvestmentRiskProfile = body.InvestmentRiskProfile;	// B39
	if (body.c2 != null) result.c2.InvestmentRiskProfile = body.InvestmentRiskProfile;	// B39

	// Financial Advisor Details  Assumed to be from http request
	result.AdvisorName = body.c1.AdvisorName;		// K50
	result.CompanyName = body.c1.CompanyName;		// K51
	result.ProfessionalDesignation = body.c1.ProfessionalDesignation;		// K52
	result.Address = body.c1.Address;		// K53
	result.City = body.c1.City;		// K54

	result.PostalCode = body.c1.PostalCode; // K56
	result.PhoneNumber = body.c1.PhoneNumber;		// K57
	result.Email = body.c1.Email;		// K58
	result.ScenarioName = body.c1.ScenarioName;		// K59

	//These shouldn’t be required as there is only singles plans in Cascades Standard. 
	//Everything involving retirement age can use the Retirement Age field
	/*
	//calculated couple fields.
	result.c1.CoupleRetirementIndex = Math.max(result.c1.RetirementAge - result.c1.Age, result.c2.RetirementAge - result.c2.Age, 0); // B11
	result.c1.CoupleRetirementAge = result.c1.Age + result.c1.CoupleRetirementIndex; 											  // B12
	if (body.c2 != null) result.c2.CoupleRetirementIndex = result.c1.CoupleRetirementIndex;		 // B11
	if (body.c2 != null) result.c2.CoupleRetirementAge = result.c2.Age + result.c2.CoupleRetirementIndex; 											  // B12
	*/
	
	//All Pensions Index field not relevant here as the chart that referred to it is not included in the report output
	/*
	//calculated client1 fields
	result.c1.IndividualAllPensionsIndex = Math.max(...calculateAges(result.c1)); 													// B13
	if (body.c2 != null) result.c2.IndividualAllPensionsIndex = Math.max(...calculateAges(result.c2)); 													// B13
	result.c1.CoupleAllPensionsIndex = Math.max(result.c1.IndividualAllPensionsIndex, result.c2.IndividualAllPensionsIndex);	// B14
	if (body.c2 != null) result.c2.CoupleAllPensionsIndex = Math.max(result.c1.IndividualAllPensionsIndex, result.c2.IndividualAllPensionsIndex);	// B14
	*/

	//No couples and thus no joint accounts in cascades standard
	
	//basic couple fields.
	result.c1.JointNRMarketValue = body.JointNRMarketValue || 0;	// N10
	result.c1.JointNRMarketValueACB = body.JointNRMarketValueACB ? body.JointNRMarketValueACB : result.c1.JointNRMarketValue;
	if (body.c2 != null) result.c2.JointNRMarketValue = result.c1.JointNRMarketValue;
	if (body.c2 != null) result.c2.JointNRMarketValueACB = result.c1.JointNRMarketValueACB;
	

	// special one time withdrawals
	
	result.CustomWithdrawals = {};
	if (body.CustomWithdrawals != null) {
		body.CustomWithdrawals.forEach((wd,index)=> {

			if (result.CustomWithdrawals[wd.StartAge] == null)
				result.CustomWithdrawals[wd.StartAge] = Number(wd.Amount);
			else
				result.CustomWithdrawals[wd.StartAge] += Number(wd.Amount);

			if (wd.EndAge != null && wd.EndAge > wd.StartAge) {
				for (var i = wd.EndAge; i > wd.StartAge; i--) {
					if (result.CustomWithdrawals[i] == null)
						result.CustomWithdrawals[i] = Number(wd.Amount);
					else
						result.CustomWithdrawals[i] += Number(wd.Amount);
				}
			}
		});
	}
	
	return result;
}

function processBodyData(client) {
	let clientResult = {};

	//basic client fields
	clientResult.FirstName = client.FirstName; 									// B8
	clientResult.LastName = client.LastName; 										// B9
	clientResult.FullName = client.FirstName + " " + client.LastName; 			// B17

	//calculated client Age
	let DOB = new Date(client.DOB);
	clientResult.Age = getAge(DOB); // B23
	clientResult.RetirementAge = client.RetirementAge;							// B31
	if (client.RetirementAge == null || client.RetirementAge == "" || client.RetirementAge == 0) {
		clientResult.RetirementAge = clientResult.Age - 1;
	}
	
	clientResult.Sex = client.Sex;
	clientResult.Sex = clientResult.Sex.toLowerCase() == "male" ? "Male" : "Female";  // B24

	// CPP Calc -----------------------------------------------
	// --------------------------------------------------------
	// clientResult.CPPAnnualPayment - H24
	// clientResult.CPPStartAge      - H25
	clientResult.CPPAnnualPayment = client.CPPAnnualPayment || 0;

	if(!client.CPPStartAge && !client.CPPPreferredStartAge) {
		clientResult.CPPStartAge = 0;
	} else if(client.CPPStartAge) {
		clientResult.CPPStartAge = client.CPPStartAge;
	} else {
		clientResult.CPPStartAge = client.CPPPreferredStartAge;
		if(client.CPPPreferredStartAge > 65) {
			if(clientResult.Age > 65) {
				clientResult.CPPAnnualPayment = (clientResult.CPPAnnualPayment / (1 + g.CPP_DEFERRAL_RATE * (clientResult.Age - 65))) * (1 + g.CPP_DEFERRAL_RATE * (clientResult.CPPStartAge - 65));
			} else {
				clientResult.CPPAnnualPayment = clientResult.CPPAnnualPayment * (1 + g.CPP_DEFERRAL_RATE * (clientResult.CPPStartAge - 65));
			}
		} else {
			clientResult.CPPAnnualPayment = clientResult.CPPAnnualPayment * (1 - g.CPP_EARLY_RATE * (65 - clientResult.CPPStartAge));
		}
	}
	// --------------------------------------------------------
	
	// OAS Calc -----------------------------------------------
	// clientResult.OASAnnualPayment - H29
	if(client.OASAnnualPayment) {
		clientResult.OASAnnualPayment = client.OASAnnualPayment;
	} else if(!client.OASPreferredStartAge) {
		clientResult.OASAnnualPayment = 0;
	} else {
		const yearsASCitizen = client.OASCitizen === 'Yes' ? 40 : client.OASEligYears || 0;
		if(yearsASCitizen < 10) {
			clientResult.OASAnnualPayment = 0;
		} else {
			const citizenshipRatio = yearsASCitizen / 40;
			const oasStartDelta = (client.OASPreferredStartAge || 65) - 65;
			clientResult.OASAnnualPayment = g.OAS_MAXIMUM * citizenshipRatio * (1 + g.OAS_DEFERRAL_RATE * oasStartDelta);
		}
	}
	clientResult.OASStartAge = client.OASPreferredStartAge || 65;
	// --------------------------------------------------------

	clientResult.PensionPaymentAnnual = client.PensionPaymentAnnual;				// B34
	clientResult.PensionStartAge = client.PensionStartAge;						// B35
	clientResult.PensionPaymentAnnual2 = client.PensionPaymentAnnual2;			// E45
	clientResult.PensionChangeAge = client.PensionChangeAge;						// E46
	clientResult.EmploymentIncome = client.EmploymentIncome;						// B28
	clientResult.IndexedPension = client.IndexedPension === 'Yes';								// B36
	clientResult.RRSPMarketValue = client.RRSPMarketValue;							// E3
	clientResult.RRSPContributionPayment = client.RRSPContributionPayment;	// E5
	clientResult.RRSPContributionLimitCarried = client.RRSPContributionLimitCarried;	// E9
	clientResult.RRIFMarketValue = client.RRIFMarketValue;	// E14
	clientResult.EligibleBusinessDividends = client.EligibleBusinessDividends;	//H3
	clientResult.IneligibleBusinessDividends = client.IneligibleBusinessDividends;	//H7
	clientResult.NRAccountValue = client.NRAccountValue || 0;	// H13
	clientResult.NRAccountValueACB = client.NRAccountValueACB ? client.NRAccountValueACB : client.NRAccountValue;
	clientResult.TFSAHoldings = client.TFSAHoldings;	// H35
	clientResult.TFSAContributionRoom = client.TFSAContributionRoom;	// H36
	clientResult.AnnualSavings = client.AnnualSavings;
	clientResult.LIRAMarketValue = client.LIRAMarketValue;	// N2
	clientResult.ExistingLIFMarketValue = client.ExistingLIFMarketValue;	// N3
	clientResult.DCPlanMarketValue = client.DCPlanMarketValue;	// N6
	clientResult.DCEmployeeContribution = client.DCEmployeeContribution;	// N7
	clientResult.DCEmployerContribution = client.DCEmployerContribution;	// N8
	
	//No spouse involved in Cascades Standard plans
	//clientResult.ContributionBySpouseRRSP = client.AnnualContributionBySpouse; //N12

	// Corporate Parameters
	clientResult.CorporateMarketValue = 0;
	clientResult.CorporateAdjustedCostBase = 0;
	clientResult.CorporateGRIP = 0;
	clientResult.CorporateCDA = 0;
	clientResult.CorporateDividendsRetainedForInvestment = 0;
	clientResult.CorporateDividendsPaid = 0;
	clientResult.CorporateWithdrawalType = 'ANNUAL';
	clientResult.CorporateWithdrawalAmount = 0;
	clientResult.CorporateWithdrawalAge = 0;
	clientResult.CorporateLRIP = 0;
	clientResult.CorporateNERDTOH = 0;
	clientResult.CorporateERDTOH = 0;
	clientResult.CorporateExpenses = client.CorporateExpenses || null;
	if (clientResult.CorporateExpenses) {
		clientResult.CorporateExpenses.forEach((expense)=> {
			if (!expense.endAge) expense.endAge = expense.beginAge;
		});
	}
	if (client.CorporateIncome == "Yes") {
		clientResult.CorporateMarketValue = client.CorporateMarketValue || 0;
		clientResult.CorporateAdjustedCostBase = client.CorporateAdjustedCostBase || 0;
		clientResult.CorporateDividendsRetainedForInvestment = client.CorporateDividendsRetainedForInvestment || 0;
		clientResult.CorporateDividendsPaid = client.CorporateDividendsPaid || 0;
		clientResult.CorporateWithdrawalType = client.CorporateWithdrawalType || 'ANNUAL';
		clientResult.CorporateWithdrawalAmount = client.CorporateWithdrawalAmount || 0;
		clientResult.CorporateWithdrawalAge = client.CorporateWithdrawalAge || 0;
		if (client.CorporateAdvancedQuestions == "Yes") {
			clientResult.CorporateLRIP = client.CorporateLRIP || 0;
			clientResult.CorporateGRIP = client.CorporateGRIP || 0;
			clientResult.CorporateCDA = client.CorporateCDA || 0;
			clientResult.CorporateNERDTOH = client.CorporateNERDTOH || 0;
			clientResult.CorporateERDTOH = client.CorporateERDTOH || 0; 
		}
	}
	

	// Province of Client
	clientResult.ProvinceCode = client.ProvinceCode;
	if (clientResult.ProvinceCode == null) clientResult.ProvinceCode = "ON";

	//calculated client fields

	//Don’t need DOB fields as we simply rely on user provided Age field
	//clientResult.DOBDay = DOB.getDate();
	//clientResult.DOBMonth = DOB.getMonth() + 1;
	//clientResult.DOBYear = DOB.getFullYear();

	//Business dividends not included in our model
	//clientResult.EligibleBusinessDividendsStartAge = client.EligibleBusinessDividendsStartAge ? client.EligibleBusinessDividendsStartAge : clientResult.Age;
	//clientResult.EligibleBusinessDividendsEndAge = client.EligibleBusinessDividends ? client.EligibleBusinessDividendsEndAge ? client.EligibleBusinessDividendsEndAge : 999	: clientResult.Age	//H5
	//clientResult.IneligibleBusinessDividendsStartAge = client.IneligibleBusinessDividendsStartAge ? client.IneligibleBusinessDividendsStartAge : clientResult.Age;
	//clientResult.IneligibleBusinessDividendsEndAge = client.IneligibleBusinessDividends ? client.IneligibleBusinessDividendsEndAge ? client.IneligibleBusinessDividendsEndAge : 999 : clientResult.Age	//H9

	//client custom income sources
	let CustomIncomeSources = client.CustomIncomeSources;
	clientResult.CustomIncomeSources = [];
	CustomIncomeSources.forEach((source,index)=>{
		let { Active, Type, ProvidedLabel, DeterminedLabel, ProvidedTotalAmount, ProvidedTaxableAmount, TaxFreeAmount, StartAge, ProvidedEndAge, DeterminedEndAge, NumPrevActiveSameType, IsIndexed } = source;
		IsIndexed = IsIndexed == 'Yes';
		if (StartAge == null) StartAge = clientResult.Age;

		//label
		DeterminedLabel = Active === 'On' ? ((Type === 'Other' || Type === 'Autre') && ProvidedLabel) ?  ProvidedLabel : Type : 'Custom Income ' + (index + 1);

		//if inactive, set to default value
		if(Active === 'Off'){
			Type = '';
			ProvidedLabel = '';
			ProvidedTotalAmount = 0;
			ProvidedTaxableAmount = 0;
			TaxableAmount = 0;
			TaxFreeAmount = 0;
			AnnuityAmount = 0;
			IncomeForRRSPRoom = 0;
			IncomeForPensionCredit= 0;
			ProvidedEndAge = 0;
			DeterminedEndAge = 0;
		} else {
			// Taxable Amount -> =IF(B43="Off",0,IF(OR(B44="Registered Annuity",B44="Spousal Support (Alimony)",B44="Rental Income"),B47,IF(OR(B44="Child Tax Credit",B44="Child Support"),0,IF(OR(B44="Non-Registered Life Annuity",B44="Non-Registered Term Annuity",B44="Other"),B48,0))))

			// Defaults
			TaxFreeAmount = ProvidedTotalAmount;
			TaxableAmount = 0;
			AnnuityAmount = 0;
			IncomeForRRSPRoom = 0;
			IncomeForPensionCredit = 0;
			DeterminedEndAge = 999;
			if(['Registered Annuity', 'Rente enregistrée'].includes(Type)) {
				AnnuityAmount = ProvidedTotalAmount;
				TaxFreeAmount = 0;
				//StartAge = 65;
			}
			else if(['Spousal Support (Alimony)', 'Pension alimentaire pour époux(se)', 'Rental Income', 'Revenu locatif'].includes(Type)) {
			  IncomeForRRSPRoom = ProvidedTotalAmount;
			  TaxableAmount = ProvidedTotalAmount;
			  TaxFreeAmount = 0;
			}
			else if(['Child Tax Credit', 'Crédit d’impôt pour enfant', 'Child Support', 'Pension alimentaire pour enfant'].includes(Type)) {
			  TaxableAmount = 0;
			  TaxFreeAmount = ProvidedTotalAmount;
			}
			else if(['Other', 'Autre'].includes(Type)) {
			  TaxableAmount = ProvidedTaxableAmount;
			  TaxFreeAmount = ProvidedTotalAmount - ProvidedTaxableAmount;
			}
			else if(['Non-Registered Life Annuity', 'Rente viagère non enregistrée', 'Non-Registered Term Annuity', 'Rente à terme non-enregistrée'].includes(Type)) {
			  TaxableAmount = ProvidedTaxableAmount;
			  TaxFreeAmount = ProvidedTotalAmount - ProvidedTaxableAmount;
			  IncomeForPensionCredit = ProvidedTotalAmount;
			}

			if(ProvidedEndAge != null && ProvidedEndAge > 0 && ['Non-Registered Term Annuity','Rente à terme non-enregistrée','Child Tax Credit','Crédit d’impôt pour enfant','Child Support','Pension alimentaire pour enfant','Spousal Support (Alimony)','Pension alimentaire pour époux(se)','Rental Income','Revenu locatif','Other','Autre'].includes(Type)) {
			  DeterminedEndAge = ProvidedEndAge;
			}
		}
		clientResult.CustomIncomeSources.push({
			Active, //B43,B58,B73,B88,B103
			Type,	//B44,B59,B74,B89,B104
			ProvidedLabel, //B45,B60,B75,B90,B105
			DeterminedLabel, //B46,B61,B76,B91,B106
			ProvidedTotalAmount, //B47,B62,B77,B92,B107
			ProvidedTaxableAmount, //B48,B63,B78,B93,B108
			TaxableAmount, //B49,B64,B79,B94,B109
			TaxFreeAmount, //B50,B65,B80,B95,B110
			AnnuityAmount,
			IncomeForRRSPRoom,
			IncomeForPensionCredit,
			StartAge, //B51,B66,B81,B96,B111
			ProvidedEndAge, //B52,B67,B82,B97,B112
			DeterminedEndAge, //B53,B68,B83,B98,B113
			IsIndexed //B55,B70,B85,B100,B115
		});
	});

	// special one time deposits
	clientResult.CustomDeposits = {};
	if (client.CustomDeposits != null) {
		client.CustomDeposits.forEach((deposit,index)=> {
			if (clientResult.CustomDeposits[deposit.Age] == null)
				clientResult.CustomDeposits[deposit.Age] = Number(deposit.Amount);
			else
				clientResult.CustomDeposits[deposit.Age] += Number(deposit.Amount);
		});
	}

	return clientResult;
}

function calculateAges(client) {
	let age1 = client.CPPAnnualPayment > 0 ? Math.max(client.CPPStartAge - client.Age, 0) : client.CoupleRetirementIndex;
	let age2 = client.OASAnnualPayment > 0 ? Math.max(65 - client.Age, 0) : client.CoupleRetirementIndex;
	let age3 = client.PensionPaymentAnnual > 0 ? Math.max(client.PensionStartAge - client.Age, 0) : 0;
	let age4 = client.PensionPaymentAnnual2 > 0 ? Math.max(client.PensionChangeAge - client.Age, 0) : client.CoupleRetirementIndex;
	return [age1, age2, age3, age4];
}

function getAge(dateOfBirth) {
	let today = new Date();
	let age = today.getFullYear() - dateOfBirth.getFullYear();
	let month = today.getMonth() - dateOfBirth.getMonth();
	if(month < 0 || (month === 0 && today.getDate() < dateOfBirth.getDate())) {
		age--;
	}
	return age;
}
