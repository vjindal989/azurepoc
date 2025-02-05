const p = require("./provincial_constants.json");

exports.getProvTax = function(prov, income, inflation)
{
  if (income < p.provinces[prov].TAX_LEVELS[0]*inflation) {
      return p.provinces[prov].TAX_RATES[0]*income;
  } else if (income < p.provinces[prov].TAX_LEVELS[1]*inflation) {
      return p.provinces[prov].TAX_RATES[0]*p.provinces[prov].TAX_LEVELS[0]*inflation +
             p.provinces[prov].TAX_RATES[1]*(income - p.provinces[prov].TAX_LEVELS[0]*inflation);
  } else if (income < p.provinces[prov].TAX_LEVELS[2]*inflation) {
      return p.provinces[prov].TAX_RATES[0]*p.provinces[prov].TAX_LEVELS[0]*inflation + 
             p.provinces[prov].TAX_RATES[1]*(p.provinces[prov].TAX_LEVELS[1]*inflation - p.provinces[prov].TAX_LEVELS[0]*inflation) + 
             p.provinces[prov].TAX_RATES[2]*(income - p.provinces[prov].TAX_LEVELS[1]*inflation);
  } else if (income < p.provinces[prov].TAX_LEVELS[3]*inflation) {
      return p.provinces[prov].TAX_RATES[0]*p.provinces[prov].TAX_LEVELS[0]*inflation + 
             p.provinces[prov].TAX_RATES[1]*(p.provinces[prov].TAX_LEVELS[1]*inflation - p.provinces[prov].TAX_LEVELS[0]*inflation) + 
             p.provinces[prov].TAX_RATES[2]*(p.provinces[prov].TAX_LEVELS[2]*inflation - p.provinces[prov].TAX_LEVELS[1]*inflation) +
             p.provinces[prov].TAX_RATES[3]*(income - p.provinces[prov].TAX_LEVELS[2]*inflation);
  } 
  else if (income < p.provinces[prov].TAX_LEVELS[4]*inflation) {
      return p.provinces[prov].TAX_RATES[0]*p.provinces[prov].TAX_LEVELS[0]*inflation + 
             p.provinces[prov].TAX_RATES[1]*(p.provinces[prov].TAX_LEVELS[1]*inflation - p.provinces[prov].TAX_LEVELS[0]*inflation) + 
             p.provinces[prov].TAX_RATES[2]*(p.provinces[prov].TAX_LEVELS[2]*inflation - p.provinces[prov].TAX_LEVELS[1]*inflation) +
             p.provinces[prov].TAX_RATES[3]*(p.provinces[prov].TAX_LEVELS[3]*inflation - p.provinces[prov].TAX_LEVELS[2]*inflation) + 
             p.provinces[prov].TAX_RATES[4]*(income - p.provinces[prov].TAX_LEVELS[3]*inflation);
  }
  else if (income < p.provinces[prov].TAX_LEVELS[5]*inflation) {
      return p.provinces[prov].TAX_RATES[0]*p.provinces[prov].TAX_LEVELS[0]*inflation + 
             p.provinces[prov].TAX_RATES[1]*(p.provinces[prov].TAX_LEVELS[1]*inflation - p.provinces[prov].TAX_LEVELS[0]*inflation) + 
             p.provinces[prov].TAX_RATES[2]*(p.provinces[prov].TAX_LEVELS[2]*inflation - p.provinces[prov].TAX_LEVELS[1]*inflation) +
             p.provinces[prov].TAX_RATES[3]*(p.provinces[prov].TAX_LEVELS[3]*inflation - p.provinces[prov].TAX_LEVELS[2]*inflation) + 
             p.provinces[prov].TAX_RATES[4]*(p.provinces[prov].TAX_LEVELS[4]*inflation - p.provinces[prov].TAX_LEVELS[3]*inflation) + 
             p.provinces[prov].TAX_RATES[5]*(income - p.provinces[prov].TAX_LEVELS[4]*inflation);
  }
  else {
      return p.provinces[prov].TAX_RATES[0]*p.provinces[prov].TAX_LEVELS[0]*inflation +
             p.provinces[prov].TAX_RATES[1]*(p.provinces[prov].TAX_LEVELS[1]*inflation - p.provinces[prov].TAX_LEVELS[0]*inflation) +
             p.provinces[prov].TAX_RATES[2]*(p.provinces[prov].TAX_LEVELS[2]*inflation - p.provinces[prov].TAX_LEVELS[1]*inflation) +
             p.provinces[prov].TAX_RATES[3]*(p.provinces[prov].TAX_LEVELS[3]*inflation - p.provinces[prov].TAX_LEVELS[2]*inflation) +
             p.provinces[prov].TAX_RATES[4]*(p.provinces[prov].TAX_LEVELS[4]*inflation - p.provinces[prov].TAX_LEVELS[3]*inflation) +
             p.provinces[prov].TAX_RATES[5]*(p.provinces[prov].TAX_LEVELS[5]*inflation - p.provinces[prov].TAX_LEVELS[4]*inflation) +
             p.provinces[prov].TAX_RATES[6]*(income - p.provinces[prov].TAX_LEVELS[5]*inflation);
  }
}

exports.getProvSurTax = function(prov, provTaxPayable, inflation)
{
  if (p.provinces[prov].SUR_TAX_LEVELS != null)
  {
    if (provTaxPayable < p.provinces[prov].SUR_TAX_LEVELS[0]*inflation) {
        return p.provinces[prov].SUR_TAX_RATES[0]*provTaxPayable*inflation;
    } else if (provTaxPayable < p.provinces[prov].SUR_TAX_LEVELS[1]*inflation) {
        return p.provinces[prov].SUR_TAX_RATES[0]*(p.provinces[prov].SUR_TAX_LEVELS[0]*inflation) + 
               p.provinces[prov].SUR_TAX_RATES[1]*(provTaxPayable - p.provinces[prov].SUR_TAX_LEVELS[0]*inflation);
    } else {
        return p.provinces[prov].SUR_TAX_RATES[0]*p.provinces[prov].SUR_TAX_LEVELS[0]*inflation + 
               p.provinces[prov].SUR_TAX_RATES[1]*(p.provinces[prov].SUR_TAX_LEVELS[1]*inflation-p.provinces[prov].SUR_TAX_LEVELS[0]*inflation) + 
               p.provinces[prov].SUR_TAX_RATES[2]*(provTaxPayable - p.provinces[prov].SUR_TAX_LEVELS[1]*inflation);
    }
  }
  return 0;
}