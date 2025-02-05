'use strict';

module.exports = (log, config, database) => {
    return{
        rates: async() =>{
            log.debug('calling provService.rates');
            return new Promise((resolve, reject)=>{
                database.getPool().query(`
                    WITH CTE_Data as
                    (
                    select pr.provid, pr.setting, pr.rate, 0 as isarray from provincial_rate pr 
                    UNION 
                    select tl.provid, "TAX_LEVELS", JSON_ARRAY(GROUP_CONCAT(rate)), 1 from tax_level tl
                    group by tl.provid
                    order by 2, 3
                    )
                    select 
                        json_object(
                            p.prov,
                            json_objectagg(pr.setting, pr.rate) 
                            ) as data
                    from province p
                    inner join cte_data pr on pr.provid = p.id
                    inner join tax_level tl on tl.provid = p.id
                    group by p.prov
                `
                ,  (error, rows)=>{
                    if(error){
                        log.error(error);
                        return reject(error);
                    }
                    
                    return resolve(rows[0]['data']);
                    
                });
            });
        }
    }
}