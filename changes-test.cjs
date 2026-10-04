const assert=require('node:assert/strict'),c=require('./changes');
assert.deepEqual(c.duration('6–8 months'),{low:180,high:240});assert.equal(c.duration('6 to 2 months'),null);assert.equal(c.duration('Depends on approval'),null);
const base={ChangeID:'C1',EventName:'E1',EventQMS:'CR1',ChangeQMS:'cr1',AssessmentCountry:'Hungary',Country:'Hungary',AssessmentTimeline:'6–8 months',LatestDispatch:'2027-01-01'};
assert.equal(c.linked(base),true);assert.equal(c.linked({...base,ChangeQMS:'CR2'}),false);
let p=c.survey([base])[0];assert.equal(p.start,Date.UTC(2027,0,1)+180*86400000);assert.equal(p.end,Date.UTC(2027,0,1)+240*86400000);
assert.match(c.survey([base,{...base,AssessmentTimeline:'3 months'}])[0].reason,/conflicting/);
assert.match(c.survey([{...base,Country:'Mexico'}])[0].reason,/country/);
assert.match(c.survey([{...base,ActualDispatch:'bad'}])[0].reason,/Invalid/);
console.log('PASS: change links, surveyed ranges, mismatched country, conflicting durations and invalid dispatch anchors.');
