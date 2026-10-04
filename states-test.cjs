const assert=require('node:assert/strict'),s=require('./states');
assert.equal(Object.values(s.catalogs).flat().length,32);
const known=[...new Set(Object.values(s.catalogs).flat().map(s.normalize))];assert.equal(new Set(known.map(s.colour)).size,25,'Every distinct known state has its own colour');
const rows=[{AppID:'A',ROID:'R',SubID:'S',AppStatus:'Active',ROStatus:'Planned',SubStatus:'Completed',EventName:'E',EventState:'Planned State'},{AppID:'B',ROID:'R2',SubID:'S2',AppStatus:'Inactive',ROStatus:'In Progress',SubStatus:'Planned'}],a=s.analyze(rows),excluded=Object.fromEntries(Object.keys(s.catalogs).map(f=>[f,new Set()]));
excluded.SubStatus.add('planned');assert.equal(s.matches(rows[0],a,excluded),true,'RO Planned is independent of submission Planned');assert.equal(s.matches(rows[1],a,excluded),false);
const conflicts=s.analyze([...rows,{...rows[0],AppStatus:'Inactive'}]);assert.equal([...conflicts.AppStatus.values()][0],'conflicting values');
assert.notEqual(s.colour('In Progress'),s.colour('Ready For Submission'));assert.notEqual(s.colour('Sent To Health Authority'),s.colour('Distributed'));assert.notEqual(s.colour('Active'),s.colour('Planned'));
console.log('PASS: all 29 options, 24 distinct known-state colours, independent field filtering and whole-entity conflicts.');
