const g = require("./global_constants.json");

exports.getFedTax = function(income, inflation)
{
  if (income < g.FED_TAX_LEVELS[0]*inflation) {
      return g.FED_TAX_RATES[0]*income;
  } else if (income < g.FED_TAX_LEVELS[1]*inflation) {
      return g.FED_TAX_RATES[0]*g.FED_TAX_LEVELS[0]*inflation +
             g.FED_TAX_RATES[1]*(income - g.FED_TAX_LEVELS[0]*inflation);
  } else if (income < g.FED_TAX_LEVELS[2]*inflation) {
      return g.FED_TAX_RATES[0]*g.FED_TAX_LEVELS[0]*inflation + 
             g.FED_TAX_RATES[1]*(g.FED_TAX_LEVELS[1]*inflation - g.FED_TAX_LEVELS[0]*inflation) + 
             g.FED_TAX_RATES[2]*(income - g.FED_TAX_LEVELS[1]*inflation);
  } else if (income < g.FED_TAX_LEVELS[3]*inflation) {
      return g.FED_TAX_RATES[0]*g.FED_TAX_LEVELS[0]*inflation + 
             g.FED_TAX_RATES[1]*(g.FED_TAX_LEVELS[1]*inflation - g.FED_TAX_LEVELS[0]*inflation) + 
             g.FED_TAX_RATES[2]*(g.FED_TAX_LEVELS[2]*inflation - g.FED_TAX_LEVELS[1]*inflation) +
             g.FED_TAX_RATES[3]*(income - g.FED_TAX_LEVELS[2]*inflation);
  } else {
      return g.FED_TAX_RATES[0]*g.FED_TAX_LEVELS[0]*inflation + 
             g.FED_TAX_RATES[1]*(g.FED_TAX_LEVELS[1]*inflation - g.FED_TAX_LEVELS[0]*inflation) + 
             g.FED_TAX_RATES[2]*(g.FED_TAX_LEVELS[2]*inflation - g.FED_TAX_LEVELS[1]*inflation) +
             g.FED_TAX_RATES[3]*(g.FED_TAX_LEVELS[3]*inflation - g.FED_TAX_LEVELS[2]*inflation) + 
             g.FED_TAX_RATES[4]*(income - g.FED_TAX_LEVELS[3]*inflation);
  }
}

exports.roundTSFA = function(inflatedAmount)
{
  var nearest500 = Math.round(inflatedAmount / g.TFSA_ROUNDING)*g.TFSA_ROUNDING;
  return nearest500;
}

exports.getLifeExpectancyObject = function(age)
{
	if (age < 30) return g.LIFE_EXPECTANCY["30"];
	if (age > 100) return g.LIFE_EXPECTANCY["100"];
	return g.LIFE_EXPECTANCY[String(age)];
}


