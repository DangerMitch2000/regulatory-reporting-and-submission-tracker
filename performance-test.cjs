const assert=require('node:assert/strict'),c=require('./changes');
const rows=Array.from({length:10000},(_,i)=>({AppID:'A'+(i%20),ROID:'R'+(i%100),SubID:'S'+i,EventName:'E'+(i%50),ChangeID:'C'+(i%10),ChangeQMS:'CR'+(i%10),EventQMS:'CR'+(i%10)}));
const index=c.index(rows);
for(const i of [0,19,500,9999])for(const level of [-2,-1,0,1,2]){const row={...rows[i],level};assert.deepEqual(c.related(row,index),c.related(row,rows));}
const order=c.order(rows.map(r=>({...r,key:r.SubID,level:2,orderInfo:{unneeded:'previous record'}})),true);
assert.ok(order.every(r=>Object.keys(r).length===4&&!('orderInfo' in r)));
assert.equal(order.find(r=>r.key==='S9999').rankSub,1);
assert.equal(c.order(rows.map(r=>({...r,key:r.SubID,level:2})),false).find(r=>r.key==='S0').rankSub,1);
console.log('PASS: 10,000-row indexed evidence matches source scan; numeric sort records contain only keys and ranks.');
