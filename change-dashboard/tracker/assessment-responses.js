(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./events.js'):root.regulatoryEvents);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.regulatoryAssessmentResponses=api;
})(typeof globalThis==='object'?globalThis:this,function(events){
 'use strict';
 const text=v=>v==null?'':String(v).trim(),norm=v=>text(v).toLowerCase(),unique=a=>[...new Set(a)],key=(...a)=>JSON.stringify(a),DAY=86400000;
 const payload=['AssessmentResponseID','AssessmentCountry','AssessmentTimeline','AssessmentMOHFiling','AssessmentDocumentation'];
 const values=(rs,f)=>unique(rs.map(r=>text(r[f])).filter(Boolean));
 const distinct=rs=>[...new Map(rs.map(r=>[key(...payload.map(f=>text(r[f]))),r])).values()];
 function add(map,id,r){if(!map.has(id))map.set(id,[]);map.get(id).push(r);}
 function resolve(records){
  const byChange=new Map(),result=[];for(const r of records)if(text(r.ChangeID))add(byChange,text(r.ChangeID),r);
  for(const [change,rs]of byChange){
   const keyed=rs.some(r=>text(r.ExpectedResponseID)||text(r.AssessmentResponseID));
   const expected=new Map(),responses=new Map();
   for(const r of rs){
    if(keyed){
     if(text(r.ExpectedResponseID)||text(r.ExpectedResponseCountry))add(expected,text(r.ExpectedResponseID)?norm(r.ExpectedResponseID):key('missing',norm(r.ExpectedResponseCountry)),r);
     if(text(r.AssessmentResponseID))add(responses,norm(r.AssessmentResponseID),r);
     else if(text(r.AssessmentCountry)&&payload.slice(2).some(f=>text(r[f])))add(responses,key('missing',norm(r.AssessmentCountry)),r);
    }else{
     if(text(r.ExpectedResponseCountry))add(expected,norm(r.ExpectedResponseCountry),r);
     if(text(r.AssessmentCountry))add(responses,norm(r.AssessmentCountry),r);
    }
   }
   const emit=(id,expect,answer)=>{
    const expectedNames=values(expect,'ExpectedResponseCountry'),responseNames=values(answer,'AssessmentCountry');
    const names=expectedNames.length?expectedNames:responseNames,countryKeys=unique(names.map(norm));
    const expectedID=values(expect,'ExpectedResponseID')[0]||'',responseID=values(answer,'AssessmentResponseID')[0]||'';
    let issue='';
    if(keyed&&!expect.length)issue='No matching expected response ID delivered';
    else if(keyed&&!expectedID)issue='Expected response ID not recorded';
    else if(keyed&&expect.length&&answer.length&&!responseID)issue='Response ID not recorded';
    if(countryKeys.length!==1)issue=countryKeys.length?'Conflicting expected countries for this ID':'Country not recorded';
    const matched=answer.length>0&&!issue;
    result.push({key:key(change,keyed?'id':'country',id),change,country:names.join(' / ')||'Country not recorded',countryKey:countryKeys.length===1?countryKeys[0]:'',expectedID,responseID,hasExpected:expect.length>0,returned:matched,issue,mode:keyed?'identifier':'country',responses:distinct(answer),records:rs});
   };
   for(const [id,expect]of expected)emit(id,expect,responses.get(id)||[]);
   for(const [id,answer]of responses)if(!expected.has(id)){
    // Old reports retain their country-based mapping; keyed reports never silently fall back.
    emit(id,[],answer);
   }
  }
  return result;
 }
 function evidence(entry,base){
  if(!entry.returned)return [];
  return entry.responses.map(r=>({...base,...Object.fromEntries(payload.map(f=>[f,r[f]])),ChangeID:entry.change,AssessmentCountry:entry.country,ExpectedResponseID:entry.expectedID,ExpectedResponseCountry:entry.country,__assessmentKey:entry.key}));
 }
 const linked=r=>text(r.ChangeID)&&text(r.EventName)&&norm(r.EventQMS)&&norm(r.EventQMS)===norm(r.ChangeQMS);
 function progress(records,options={}){
  const now=new Date(options.now||Date.now()),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const entries=options.entries||resolve(records),bySub=new Map();
  for(const r of records)if(linked(r)&&text(r.SubID))add(bySub,key(text(r.ChangeID),text(r.SubID)),r);
  const byCountry=new Map();for(const rs of bySub.values()){
   const countryKeys=unique(rs.map(r=>norm(r.Country)).filter(Boolean)),states=values(rs,'SubStatus'),d=events.dateField(rs,'ActualDispatch');
   const dispatched=countryKeys.length===1&&d.value!==null&&d.value<=today;
   const dispatchIssue=d.value!==null&&d.value>today?'Actual dispatch date is in the future':d.value===null&&d.label!=='Not recorded'?d.label:'';
   const sub={id:text(rs[0].SubID),change:text(rs[0].ChangeID),countries:countryKeys,dispatched,dispatchIssue,stage:dispatched?'Dispatched':dispatchIssue?'Check dispatch date':'No actual dispatch recorded',status:states.join(' / ')||'Not recorded',date:dispatched?d.label:'',ambiguous:countryKeys.length!==1};
   for(const country of countryKeys)add(byCountry,key(sub.change,country),sub);
  }
  return entries.map(e=>{
   const submissions=byCountry.get(key(e.change,e.countryKey))||[],dispatched=submissions.filter(s=>s.dispatched).length,allDispatched=submissions.length>0&&dispatched===submissions.length;
   const due=events.dateField(e.records,'ChangeResponseDue'),states=values(e.records,'ChangeStatus'),closed=states.length===1&&/^(completed|closed|cancelled|canceled)$/i.test(states[0]);
   const overdue=submissions.filter(s=>!s.dispatched).map(s=>options.dispatchSummaries?.get(s.id)).filter(d=>d&&d.days<0&&d.timing.includes('past dispatch target'));
   let attention=allDispatched?'All linked submissions dispatched':'No dated follow-up identified',priority=5;
   if(e.issue){attention=e.issue;priority=0;}
   else if(submissions.some(s=>s.ambiguous)){attention='Check submission country assignment';priority=0;}
   else if(submissions.some(s=>s.dispatchIssue)){attention='Check actual dispatch dates';priority=0;}
   else if(overdue.length){attention=overdue.length+' submission'+(overdue.length===1?'':'s')+' past dispatch target';priority=1;}
   else if(e.hasExpected&&!e.returned&&!allDispatched){
    if(closed){attention='Change closed; response not delivered';priority=2;}
    else if(due.value!==null&&due.value<today){attention='Response '+Math.round((today-due.value)/DAY)+' days past due';priority=1;}
    else {attention=due.value!==null?'Awaiting response · due '+due.label:'Awaiting response · '+(due.label==='Not recorded'?'due date not recorded':due.label.toLowerCase());priority=2;}
   }else{
    if(!submissions.length){attention='No linked submission delivered';priority=3;}
    else if(!allDispatched){attention=(submissions.length-dispatched)+' without actual dispatch recorded';priority=4;}
   }
   const docs=values(e.responses,'AssessmentDocumentation'),filing=values(e.responses,'AssessmentMOHFiling'),timelines=values(e.responses,'AssessmentTimeline');
   return {...e,submissions,dispatched,attention,priority,response:e.issue?'Check response link':e.returned?'Response received':e.hasExpected?'Awaiting response':'Not recorded',due:due.label,docs,filing,timelines};
  }).sort((a,b)=>a.priority-b.priority||a.country.localeCompare(b.country,undefined,{numeric:true})||a.change.localeCompare(b.change));
 }
 return {resolve,evidence,progress};
});
