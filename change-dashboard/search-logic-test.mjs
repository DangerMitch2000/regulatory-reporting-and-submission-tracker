import assert from 'node:assert/strict';
import {analyze,derive} from './logic.mjs';
import {demoAsOf,largeRows} from './demo-data.mjs';

// Exercise repeated typing against a full delivered model; the query must not
// alter parent/country identities or inherit text cached before a refresh.
const rows=largeRows(10000),model=analyze(rows,{asOf:demoAsOf,groupBy:'event'});
const state={groupBy:'event',unit:'ID',view:'all'};
const start=performance.now();
for(const query of ['DEMO-SUB-9999','demo-sub-9999','  DEMO-SUB-9999   france ','[literal-regex]']){
 const result=derive(model,{...state,search:query});
 assert.deepEqual(result.shown.map(c=>c.id),query==='[literal-regex]'?[]:['LOAD-EVT-2499']);
 if(result.shown.length){assert.equal(result.shown[0].countries.length,1);assert.equal(result.visibleCoverage.submission,4,'A filing match retains the complete parent context');}
}
const elapsed=performance.now()-start;
assert(elapsed<5000,`Search across 10,000 rows took ${Math.round(elapsed)}ms for four queries`);
rows[9999].SubID='CHANGED-SUBMISSION';
const refreshed=analyze(rows,{asOf:demoAsOf,groupBy:'event'});
assert.equal(derive(refreshed,{...state,search:'DEMO-SUB-9999'}).shown.length,0,'New data cannot reuse stale search text');
assert.deepEqual(derive(refreshed,{...state,search:'CHANGED-SUBMISSION'}).shown.map(c=>c.id),['LOAD-EVT-2499']);
console.log(`PASS search logic: scoped full-parent matches, literal queries, refreshed data and four searches over 10,000 rows in ${Math.round(elapsed)}ms.`);
