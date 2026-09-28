const assert=require('node:assert/strict'),quality=require('./quality'),ui=require('./quality-ui');
const rows=[{SubID:'S1',AppID:'A1',ROID:'R1',BusinessUnit:'ID',Manufacturer:'Site B',Product:'Alpha',Country:'France',RegistrationEnd:'invalid-date'},{SubID:'S1',AppID:'A1',ROID:'R1',BusinessUnit:'ID',Manufacturer:'Site B',Product:'Beta',Country:'Spain',RegistrationEnd:'2030-01-01'},{SubID:'S1',AppID:'A1',ROID:'R1',BusinessUnit:'ID',Manufacturer:'Site C',Product:'Gamma',Country:'Spain',RegistrationEnd:'2030-01-01'}];
const analysis=quality.analyze(rows,{now:'2026-09-28'});
const all=ui.worklist(analysis,rows);assert.equal(all.length,2);assert.equal(new Set(all.map(e=>e.issue.id)).size,1);assert.deepEqual(all.map(e=>e.site),['Site B','Site C']);
const betaRows=rows.filter(r=>r.Product==='Beta');const beta=ui.worklist(analysis,betaRows);assert.equal(beta.length,1);assert.match(beta[0].issue.value,/invalid-date/);assert.equal(beta[0].site,'Site B');
assert.equal(ui.worklist(analysis,rows.filter(r=>r.Product==='Beta'&&r.Manufacturer==='Site C')).length,0);
assert.equal(ui.worklist(analysis,rows,{category:'missing'}).length,0);assert.equal(ui.worklist(analysis,rows,{query:'unrelated'}).length,0);assert.equal(ui.worklist(analysis,rows,{query:'R1'}).length,2);
assert.equal(ui.worklist(analysis,Array(30000).fill(rows[0])).length,1);
const repaired=rows.map(r=>({...r,RegistrationEnd:'2030-01-01'}));assert.equal(ui.worklist(quality.analyze(repaired),repaired).length,0);
const dangerous=structuredClone(beta[0]);dangerous.site='=1+1';dangerous.issue.value='  +2';dangerous.issue.reason='A "quote", followed by\na second line';dangerous.issue.suggestion='\tunsafe';const csv=ui.toCsv([dangerous]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"\'  +2"'));assert.ok(csv.includes('"A ""quote"", followed by\na second line"'));assert.ok(csv.includes('"\'\tunsafe"'));assert.ok(csv.includes('\r\n'));assert.match(ui.toCsv(all),/Site C/);
console.log('PASS: site grouping, whole-record evidence under membership filters, deduplicated joins, repaired records and safe complete CSV.');

