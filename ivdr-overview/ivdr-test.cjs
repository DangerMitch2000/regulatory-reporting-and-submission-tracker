const assert=require('node:assert/strict');
(async()=>{
 const {compare,isIVDR,mapTable}=await import('./ivdr-comparison.logic.js');
 const today=Date.UTC(2026,8,24), row=(SubID,extra={})=>({SubID,LatestDispatch:'2026-10-12',Site:'North',BusinessUnit:'ID',...extra});
 for(const v of ['IVDR','ivdr and rebranding','UDI; IVDR',['UDI','IVDR'],'Non-IVDR; IVDR'])assert.equal(isIVDR(v),true,String(v));
 for(const v of [null,'','UDI','rebranding and UDI','Non-IVDR','non ivdr','Non_IVDR'])assert.equal(isIVDR(v),false,String(v));
 const rows=[row('A',{Project:'IVDR',ActualDispatch:'2026-01-03'}),row('A',{Project:'UDI',ActualDispatch:'2026-01-03'}),row('B',{Project:null}),row('C',{Project:'UDI; IVDR',ActualSubmission:'2026-02-01'}),row('D',{Site:'South',BusinessUnit:null}),row('E',{Site:'South',Project:'IVDR'}),row('E',{Site:'West',Project:'IVDR'}),row('F',{LatestDispatch:null,ActualApproval:'2026-03-01'}),row('OLD',{ActualDispatch:'2025-01-01'}),row('',{})];
 let r=compare(rows,today);assert.equal(r.total,5);assert.equal(r.ivdr,3);assert.equal(r.non,2);assert.deepEqual(r.missing,['F']);assert.equal(r.missingIdRows,1);
 const reconcile=r=>{assert.equal(r.ivdr+r.non,r.total);assert.equal(r.sites.reduce((n,s)=>n+s.total,0),r.total);assert.equal(r.progress.reduce((n,p)=>n+p.total,0),r.total);for(const s of r.sites){assert.equal(s.ivdr+s.non,s.total);assert.equal(s.progress.reduce((n,p)=>n+p.total,0),s.total);}};
 for(const state of [{},{month:0},{month:9},{classification:'ivdr'},{classification:'non'},{businessUnit:null},{businessUnit:'ID'},{site:'ambiguous'},{includeInferred:true}])reconcile(compare(rows,today,state));
 assert.equal(compare(rows,today,{businessUnit:null}).total,1);
 assert.equal(compare(rows,today,{month:0}).total,1);assert.equal(compare(rows,today,{month:9}).total,4);
 assert.equal(compare(rows,today,{site:'ambiguous'}).total,1);assert.equal(compare(rows,today,{site:'site:South'}).total,1);
 r=compare(rows,today,{includeInferred:true});assert.equal(r.progress[3].total,1);assert.equal(r.total,5);assert.deepEqual(r.missing,['F']);assert.deepEqual(r.undatedInferred,['F']);assert.deepEqual(compare(rows,today,{month:0}).missing,['F']);
 assert.equal(compare([row('X',{LatestDispatch:'invalid'})],today).excluded.length,1);
 assert.equal(mapTable({columns:[{roles:{SubID:true}}],rows:[['a']]}).missingProject,true);
 assert.equal(mapTable({columns:[{roles:{SubID:true}},{roles:{Project:true}}],rows:[['a',null]]}).missingProject,false);
 assert.throws(()=>mapTable({columns:[{roles:{Project:true}},{roles:{Project:true}}]}),/one column/);
 r=compare(Array.from({length:30000},(_,i)=>row('S'+Math.floor(i/3),{Project:i%3===1?'IVDR':null})),today);assert.equal(r.total,10000);assert.equal(r.ivdr,10000);reconcile(r);
 const dispatchRows=[
  row('TRUE',{DispatchRequired:true,LatestDispatch:'2026-01-02',Project:'IVDR'}),
  row('FALSE',{DispatchRequired:false,LatestDispatch:'2026-02-02',ActualSubmission:'2026-02-20',Project:'IVDR'}),
  row('FALSE',{DispatchRequired:' FALSE ',LatestDispatch:'2026-02-02',ActualSubmission:'2026-02-20',Project:'UDI'}),
  row('BLANK',{DispatchRequired:null,LatestDispatch:'2026-03-02'}),
  row('CONFLICT',{DispatchRequired:false,LatestDispatch:'2026-04-02'}),
  row('CONFLICT',{DispatchRequired:true,LatestDispatch:'2026-04-02',BusinessUnit:'CMI'}),
  row('INVALID',{DispatchRequired:'maybe',LatestDispatch:'2026-04-02'}),
  row('UNDATED_FALSE',{DispatchRequired:false,LatestDispatch:null,ActualSubmission:'2026-05-01',Project:'IVDR'}),
  row('UNDATED_OLD',{DispatchRequired:false,LatestDispatch:null,ActualApproval:'2025-05-01'}),
  row('UNDATED_BLANK',{DispatchRequired:null,LatestDispatch:null,ActualSubmission:'2026-05-01'}),
  row('ACTUAL_FALSE',{DispatchRequired:false,ActualDispatch:'2026-06-01',Project:'IVDR'}),
 ];
 for(const state of [{},{includeInferred:true},{dispatchRequired:'false'},{dispatchRequired:'true'},{dispatchRequired:'blank'},{dispatchRequired:'review'},{month:1},{businessUnit:'ID',dispatchRequired:'review'}])reconcile(compare(dispatchRows,today,state));
 r=compare(dispatchRows,today,{includeInferred:true});assert.equal(r.total,6);assert.equal(r.progress[4].total,2);assert.equal(r.progress[3].total,0);assert.equal(r.progress[2].total,4);assert.deepEqual(r.missing,['UNDATED_BLANK']);assert.deepEqual(r.notRequiredOutside,['UNDATED_FALSE']);assert.equal(r.notRequiredOutsideIVDR,1);assert.equal(r.notRequiredOutsideNon,0);assert.ok(!r.undatedInferred.includes('UNDATED_FALSE'));assert.equal(r.records.find(x=>x.id==='ACTUAL_FALSE').actualDay,Date.UTC(2026,5,1));
 assert.equal(compare(dispatchRows,today,{dispatchRequired:'false'}).total,2);assert.equal(compare(dispatchRows,today,{dispatchRequired:'blank'}).total,1);assert.equal(compare(dispatchRows,today,{dispatchRequired:'review',businessUnit:'ID'}).total,2);assert.equal(compare(dispatchRows,today,{dispatchRequired:'true'}).total,1);
 r=compare(dispatchRows,today,{month:1,dispatchRequired:'false'});assert.equal(r.total,1);assert.deepEqual(r.notRequiredOutside,['UNDATED_FALSE']);assert.equal(r.notRequiredOutsideIVDR,1);
 r=compare(dispatchRows,today,{dispatchRequiredMapped:false});assert.equal(r.total,6);assert.equal(r.progress[4].total,0);assert.deepEqual(r.missing,['UNDATED_FALSE','UNDATED_BLANK']);assert.equal(r.notRequiredOutside.length,0);assert.equal(compare(dispatchRows,today,{dispatchRequiredMapped:false,dispatchRequired:'false'}).total,0);assert.equal(compare(dispatchRows,today,{dispatchRequiredMapped:false,dispatchRequired:'unmapped'}).total,6);
 assert.equal(mapTable({columns:[{roles:{SubID:true}},{roles:{DispatchRequired:true}},{roles:{Project:true}}],rows:[['A',false,null]]}).rows[0].DispatchRequired,false);assert.deepEqual(mapTable({columns:[{roles:{SubID:true}}],rows:[['a']]}).mappedRoles,['SubID']);
 console.log('PASS: Dispatch required True/False/Blank, preserved IVDR totals, full-ID conflict resolution before BU filters, unmapped role, inferred exclusion, year scope and separate undated non-dispatch records.');
 console.log('PASS: IVDR labels, duplicate memberships, 30,000 rows, all filter combinations, inference, month priority, missing dates, unmapped Project guard and reconciliation.');
})().catch(e=>{console.error(e);process.exit(1)});
