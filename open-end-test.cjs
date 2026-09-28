const assert=require('node:assert/strict');
const fs=require('fs');
const vega=require('./vega.js');
const {analyze}=require('./quality.js');
const base={AppID:'A',ROID:'R',SubID:'S',RegistrationStart:'2026-01-01'};
async function check(ends, expected, bad=0){
 const rows=ends.map(RegistrationEnd=>({...base,RegistrationEnd}));
 const original=JSON.stringify(rows);
 const view=new vega.View(vega.parse(JSON.parse(fs.readFileSync('timeline.json','utf8'))),{renderer:'none'}).initialize();
 await view.change('dataset',vega.changeset().remove(()=>true).insert(rows)).runAsync();
 const sub=view.data('sub')[0];
 assert.equal(sub.RegistrationEnd,expected);
 assert.equal(sub.RegistrationEndBad,bad);
 assert.equal(JSON.stringify(rows),original);
 view.finalize();
 return analyze(rows,{now:'2026-09-28'}).issues;
}
(async()=>{
 for(const end of ['8900-12-31','9999-12-31','2101-01-01',null]) assert.equal((await check([end],null)).length,0);
 assert.equal((await check(['2100-12-31'],Date.parse('2100-12-31'))).length,0);
 assert.equal((await check(['9999-12-31','8900-01-01'],null)).length,0);
 assert.equal((await check(['9999-12-31','2030-01-01'],Date.parse('2030-01-01'))).length,0);
 assert.equal((await check(['9999-12-31','nonsense'],null,1))[0].rule,'invalid_date');
 assert.equal((await check(['2025-12-31'],Date.parse('2025-12-31')))[0].rule,'reversed_dates');
 console.log('PASS: placeholder years, 2100 boundary, duplicate rows, invalid and reversed dates, source preservation, Vega and data quality.');
})().catch(error=>{console.error(error);process.exitCode=1});
