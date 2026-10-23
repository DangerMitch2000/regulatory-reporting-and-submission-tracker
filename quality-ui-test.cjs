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
{
 const source=[{SubID:'S-date',AppID:'A',ROID:'R',Manufacturer:'ABO',ActualDispatch:'2026-09-05T23:00:00-12:00',ActualSubmission:'2026-09-04T23:00:00Z',RegistrationEnd:'2026-02-30'}],review=quality.analyze(source,{now:'2026-09-01'}),before=JSON.stringify(review),entries=ui.worklist(review,source);
 const reversed=review.issues.find(i=>i.rule==='reversed_dates');assert.equal(ui.displayedValue(reversed),'Actual submission: 04 Sep 2026; Actual dispatch: 05 Sep 2026');
 const invalid=review.issues.find(i=>i.rule==='invalid_date');assert.equal(ui.displayedValue(invalid),'2026-02-30','Invalid calendar dates remain verbatim for repair');
 assert.ok(ui.worklist(review,source,{query:'05 Sep 2026'}).length);assert.ok(ui.worklist(review,source,{query:'2026-09-05T23:00:00-12:00'}).length,'Raw timestamp evidence stays searchable');
 const exported=ui.toCsv(entries);assert.match(exported,/"Recorded value","Raw source value"/);assert.match(exported,/05 Sep 2026/);assert.match(exported,/2026-09-05T23:00:00-12:00/);assert.equal(JSON.stringify(review),before,'UI/export formatting never mutates diagnostic source evidence');
 assert.equal(ui.displayedValue({...reversed,field:'Country',value:'2026-09-05'}),'2026-09-05','Date-looking text in non-date fields is unchanged');
}
console.log('PASS: site grouping, whole-record evidence under membership filters, deduplicated joins, repaired records and safe complete CSV.');

