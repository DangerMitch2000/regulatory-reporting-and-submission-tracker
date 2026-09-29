/* Calendar-day regressions exercised through the real Power BI Visual adapter,
   Data quality view and CSV export. All fixtures are fictional. */
const assert=require('node:assert/strict'),path=require('node:path');

function parseCsv(content){
 const text=content.replace(/^\uFEFF/,''),rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(!quoted&&c===','){row.push(cell);cell='';}
  else if(!quoted&&c==='\n'){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
 return rows;
}

module.exports=async function verifyCalendarDays(page,{outputDir}={}){
 await page.goto('http://127.0.0.1:8771/index.html');
 await page.locator('#host #filter-status').filter({hasText:'60 submissions'}).waitFor();
 const revision=await page.evaluate(()=>window.__qualityRevision);
 await page.evaluate(()=>{
  const base={...window.__dispatchRows[0],AppID:'CALENDAR-APP',ROID:'CALENDAR-RO',BusinessUnit:'ID',Manufacturer:'Calendar test site',Country:'France',Product:'Calendar test product',SubmissionType:'Renewal',DispatchRequired:true,AppStatus:'Active',ROStatus:'Health Authority Approved',SubStatus:'Completed',AppCreated:'2023-01-01',ROCreated:'2023-02-01',SubCreated:'2023-03-01',OriginalDispatch:'2024-04-01',LatestDispatch:'2024-04-01',ActualDispatch:'2024-04-14',OriginalSubmission:'2024-04-15',LatestSubmission:'2024-04-15',ActualSubmission:'2024-04-15',OriginalApproval:'2024-04-17',LatestApproval:'2024-04-17',ActualApproval:'2024-04-17',RegistrationStart:'2024-05-14',RegistrationEnd:'2024-05-17'};
  const record=(SubID,patch={})=>({...base,SubID,...patch});
  const rows=[
   // Later timestamps are harmless when every event has the same calendar day.
   record('DAY-SAME-Z',{ActualDispatch:'2024-04-15T23:50:00Z',ActualSubmission:'2024-04-15T00:10:00Z',ActualApproval:'2024-04-15T00:00:00Z',RegistrationStart:'2024-05-15T23:50:00Z',RegistrationEnd:'2024-05-15T00:10:00Z'}),
   // The UTC days are reversed by two days, but the ISO strings say the same day.
   record('DAY-SAME-OFFSETS',{ActualDispatch:'2024-04-15T23:45:00-12:00',ActualSubmission:'2024-04-15T00:15:00+14:00',ActualApproval:'2024-04-15T00:00:00+14:00'}),
   record('DAY-DUPLICATE-SAME',{ActualSubmission:'2024-04-15T00:15:00+14:00'}),
   record('DAY-DUPLICATE-SAME',{ActualSubmission:'2024-04-15T23:45:00-12:00',Product:'Additional calendar product'}),
   // Written-day errors must still be found when the UTC instants look ordered.
   record('DAY-EARLIER-SUBMISSION',{ActualDispatch:'2024-04-16T00:15:00+14:00',ActualSubmission:'2024-04-15T23:45:00-12:00'}),
   record('DAY-EARLIER-APPROVAL',{ActualSubmission:'2024-04-16T00:15:00+14:00',ActualApproval:'2024-04-15T23:45:00-12:00'}),
   // Registration dates retain their existing UTC convention; this plain-date
   // reversal checks that the milestone change does not remove an existing flag.
   record('DAY-EARLIER-REGISTRATION-END',{RegistrationStart:'2024-05-16',RegistrationEnd:'2024-05-15'}),
   // These share one UTC day but represent different written plan dates.
   record('DAY-DUPLICATE-DIFFERENT',{LatestSubmission:'2024-04-15T23:45:00-02:00'}),
   record('DAY-DUPLICATE-DIFFERENT',{LatestSubmission:'2024-04-16T00:15:00Z',Product:'Additional calendar product'}),
   // Create genuine Date objects in the browser so they cross the actual host
   // adapter, whose ISO normalization must keep the object's UTC calendar day.
   record('DAY-DATE-UTC-SAME',{ActualDispatch:new Date('2024-04-16T00:30:00+02:00'),ActualSubmission:new Date('2024-04-15T23:00:00Z')}),
   record('DAY-DATE-UTC-EARLIER',{ActualDispatch:new Date('2024-04-16T00:30:00Z'),ActualSubmission:new Date('2024-04-16T00:15:00+02:00')})
  ];
  window.__dispatchSend(rows,true);
 });
 await page.waitForFunction(previous=>window.__qualityRevision>previous,revision);
 await page.locator('#host #quality-tab').click();
 await page.locator('#host #quality-table').filter({hasText:'DAY-EARLIER-SUBMISSION'}).waitFor();
 const expectedIDs=['DAY-DATE-UTC-EARLIER','DAY-DUPLICATE-DIFFERENT','DAY-EARLIER-APPROVAL','DAY-EARLIER-REGISTRATION-END','DAY-EARLIER-SUBMISSION'].sort();
 const actualIDs=(await page.locator('#host #quality-table tbody tr[data-issue-id] .quality-record').allTextContents()).sort();
 assert.deepEqual(actualIDs,expectedIDs,'Only genuine calendar-day errors appear in the worklist');
 assert.deepEqual((await page.locator('#host #quality-counts strong').allTextContents()).map(Number),[5,5,5,0,0],'Same-day records and equivalent duplicate dates add no issues');
 const issueIDs=await page.locator('#host #quality-table tbody tr[data-issue-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.issueId));
 assert.equal(issueIDs.filter(id=>id.includes('reversed_dates')).length,4);
 assert.equal(issueIDs.filter(id=>id.includes('conflicting_dates')).length,1);

 // A correct flagged record retains the original ISO string for investigation.
 await page.locator('#host .quality-record').filter({hasText:/^DAY-EARLIER-SUBMISSION$/}).click();
 const detail=await page.locator('#host #quality-detail').innerText();
 assert.match(detail,/Actual submission is before actual dispatch/);
 assert.ok(detail.includes('2024-04-15T23:45:00-12:00'));
 assert.ok(detail.includes('2024-04-16T00:15:00+14:00'));

 const exportCount=await page.evaluate(()=>window.__qualityExports.length);
 await page.locator('#host #quality-export').click();
 await page.waitForFunction(previous=>window.__qualityExports.length>previous,exportCount);
 const exported=await page.evaluate(()=>window.__qualityExports.at(-1));
 assert.equal(exported.fileType,'csv');
 const [headers,...entries]=parseCsv(exported.content),idColumn=headers.indexOf('Submission ID'),reasonColumn=headers.indexOf('Reason'),fieldColumn=headers.indexOf('Field'),valueColumn=headers.indexOf('Recorded value');
 assert.ok(idColumn>=0&&reasonColumn>=0&&fieldColumn>=0&&valueColumn>=0);
 assert.deepEqual(entries.map(row=>row[idColumn]).sort(),expectedIDs,'CSV excludes the same false positives as the worklist');
 assert.ok(entries.every(row=>row.length===headers.length));
 assert.match(entries.find(row=>row[idColumn]==='DAY-DUPLICATE-DIFFERENT')[reasonColumn],/Different nonblank latest submission plan dates/);
 assert.equal(entries.find(row=>row[idColumn]==='DAY-DUPLICATE-DIFFERENT')[fieldColumn],'Latest submission plan');
 assert.ok(entries.find(row=>row[idColumn]==='DAY-DATE-UTC-EARLIER')[valueColumn].includes('2024-04-15T22:15:00.000Z'),'Date objects retain the adapter-normalized UTC day in exported evidence');
 assert.ok(!/DAY-SAME-Z|DAY-SAME-OFFSETS|DAY-DUPLICATE-SAME|DAY-DATE-UTC-SAME/.test(exported.content));
 if(outputDir){await page.locator('#host #theme-select').selectOption('light');await page.waitForFunction(()=>document.querySelector('#host .regulatory-timeline').dataset.theme==='light');await page.locator('#host').screenshot({path:path.join(outputDir,'calendar-day-quality.png')});}
 console.log('PASS: Data Quality compares written dispatch/submission/approval ISO calendar days, normalizes Date objects through the host adapter, ignores same-day milestone time/offset differences, preserves genuine reversals/conflicts and the existing registration check, and exports only genuine errors.');
};
