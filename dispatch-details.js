(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./quality.js'):root.regulatoryQuality,typeof module==='object'&&module.exports?require('./dispatch-required.js'):root.regulatoryDispatchRequired);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.regulatoryDispatchDetails=api;
})(typeof globalThis==='object'?globalThis:this,function(quality,dispatchRequired){
 'use strict';
 const DAY=86400000,FIELDS=['OriginalDispatch','LatestDispatch','ActualDispatch','ActualSubmission','ActualApproval'];
 const blank=v=>v==null||typeof v==='string'&&!v.trim();
 const text=v=>v==null?'':String(v).trim();
 const format=day=>new Date(day).toISOString().slice(0,10);
 function resolve(rows,field,mapped){
  if(!mapped.has(field))return {state:'unmapped',day:null,label:'Not mapped'};
  const values=rows.map(r=>r[field]).filter(v=>!blank(v)),parsed=values.map(v=>quality.parseDate(v));
  if(parsed.some(p=>p.state!=='valid'||p.day<Date.UTC(1900,0,1)||p.day>=Date.UTC(2101,0,1)))return {state:'invalid',day:null,label:'Withheld — invalid or out-of-range date'};
  const days=[...new Set(parsed.map(p=>p.day))];
  if(days.length>1)return {state:'conflict',day:null,label:'Withheld — conflicting dates'};
  return days.length?{state:'valid',day:days[0],label:format(days[0])}:{state:'blank',day:null,label:'Not recorded'};
 }
 function analyze(rows,options={}){
  const mapped=new Set(options.mappedFields||rows.flatMap(r=>Object.keys(r))),groups=new Map(),result=new Map();
  const now=new Date(options.now||Date.now()),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  for(const row of rows){const id=text(row.SubID);if(!id)continue;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row);}
  for(const [id,records]of groups){
   const dates=Object.fromEntries(FIELDS.map(f=>[f,resolve(records,f,mapped)]));
   const required=dispatchRequired.resolve(records.map(r=>r.DispatchRequired),mapped.has('DispatchRequired'));
   const states=[...new Set(records.map(r=>text(r.SubStatus)).filter(Boolean))];
   const status=!mapped.has('SubStatus')?'Not mapped':states.length>1?'Conflicting values':states[0]||'Not recorded';
   const latest=dates.LatestDispatch,original=dates.OriginalDispatch,actual=dates.ActualDispatch;
   // A bad latest plan is not silently replaced by an earlier baseline.
   const target=latest.state==='valid'?latest:['blank','unmapped'].includes(latest.state)?original:latest;
   const targetLabel=latest.state==='valid'?'Latest dispatch plan':'Original dispatch plan';
   const closed=states.length===1&&/^(completed|inactive|withdrawn|rejected|archived|cancelled|canceled)$/i.test(states[0]);
   let timing,note='',days=null;
   if(required.key==='false')timing='Not applicable — dispatch not required';
   else if(['invalid','conflict'].includes(actual.state))timing='Withheld — check actual dispatch date';
   else if(actual.state==='valid'){
    if(actual.day>today)timing='Withheld — actual dispatch date is in the future';
    else {timing='Dispatched · '+actual.label;if(target.state==='valid'){days=Math.round((actual.day-target.day)/DAY);note=days===0?'Dispatched on the target date.':Math.abs(days)+' calendar days '+(days>0?'after':'before')+' the '+targetLabel.toLowerCase()+'.';}}
   }else if(required.key!=='true'){timing='Confirm whether dispatch is required';note='No pending-dispatch count until the requirement is confirmed.';}
   else if(actual.state==='unmapped')timing='Unavailable — actual dispatch field not mapped';
   else if(closed){timing='Confirm dispatch record';note='Submission state is '+status+'; a missing actual date does not establish pending dispatch.';}
   else if(states.length>1){timing='Confirm submission state';note='Conflicting states; pending dispatch cannot be established.';}
   else if(['ActualSubmission','ActualApproval'].some(f=>dates[f].state==='valid')){timing='Confirm dispatch record';note='A later milestone is recorded. Check whether the actual dispatch date needs updating.';}
   else if(['ActualSubmission','ActualApproval'].some(f=>['invalid','conflict'].includes(dates[f].state))){timing='Confirm dispatch record';note='Check invalid or conflicting later milestones before treating dispatch as pending.';}
   else if(target.state==='valid'){
    days=Math.round((target.day-today)/DAY);timing=days===0?'Dispatch target is today':Math.abs(days)+' calendar days '+(days>0?'until dispatch target':'past dispatch target');
    note=targetLabel+' · '+target.label+'. No actual dispatch recorded; confirm dispatch status.';
   }else timing=['invalid','conflict'].includes(target.state)?'Withheld — check dispatch plan':'Unavailable — no dispatch target recorded';
   result.set(id,{dates,status,required,timing,note,days,asOf:format(today),targetLabel,target});
  }
  return result;
 }
 return {analyze};
});
