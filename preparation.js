(function(root,factory){
 const api=factory(typeof module==='object'&&module.exports?require('./dispatch-details.js'):root.regulatoryDispatchDetails);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.regulatoryPreparation=api;
})(typeof globalThis==='object'?globalThis:this,function(dispatchDetails){
 'use strict';
 const DAY=86400000,text=v=>v==null?'':String(v).trim();
 function parseDuration(value){
  if(value==null||typeof value==='string'&&!value.trim())return {state:'blank'};
  if(typeof value!=='string')return {state:'invalid'};
  const match=/^(\d+)\s*(months?|mos?|days?|weeks?|wks?)$/i.exec(value.trim());
  if(!match)return {state:'invalid'};
  const count=Number(match[1]),unit=/^mo/i.test(match[2])?'month':/^w/i.test(match[2])?'week':'day';
  if(!Number.isSafeInteger(count)||count<=0||count>100000)return {state:'invalid'};
  return {state:'valid',count,unit,key:unit+':'+count,label:count+' '+unit+(count===1?'':'s')};
 }
 function subtract(end,duration){
  return end-duration.count*(duration.unit==='month'?30:duration.unit==='week'?7:1)*DAY;
 }
 function analyze(rows,options={}){
  const mapped=new Set(options.mappedFields||rows.flatMap(r=>Object.keys(r))),applications=new Map(),submissions=new Map(),result=new Map();
  const dispatch=options.dispatchSummaries||dispatchDetails.analyze(rows,options);
  // Read all delivered rows before local filters. A child cannot pick a different
  // country duration merely because its destination/product was filtered.
  for(const row of rows){
   const app=text(row.AppID),sub=text(row.SubID);
   if(app){if(!applications.has(app))applications.set(app,{values:new Map(),invalid:false});const bucket=applications.get(app),parsed=parseDuration(row.LMPrepDuration);if(parsed.state==='invalid')bucket.invalid=true;else if(parsed.state==='valid')bucket.values.set(parsed.key,parsed);}
   if(sub){if(!submissions.has(sub))submissions.set(sub,new Set());submissions.get(sub).add(app);}
  }
  for(const [id,apps]of submissions){
   const record={status:'unavailable',reason:'',start:null,end:null,duration:'',application:'',anchor:'',calendarDays:null};
   const fail=reason=>{record.reason=reason;result.set(id,record);};
   if(!mapped.has('LMPrepDuration')){fail('Map LM Dossier Preparation Timeline to enable the estimate.');continue;}
   if(apps.size!==1||apps.has('')){fail('Application is missing or conflicting; preparation estimate withheld.');continue;}
   record.application=[...apps][0];const bucket=applications.get(record.application);
   if(bucket.invalid){fail('Unrecognised preparation duration. Use a positive whole number with months, weeks or days.');continue;}
   if(bucket.values.size!==1){fail(bucket.values.size?'Conflicting preparation durations within this application; check the lead-market relationship.':'No preparation duration recorded for this application.');continue;}
   const duration=[...bucket.values.values()][0];record.duration=duration.label;
   const summary=dispatch.get(id);
   if(summary?.required.key==='false'){record.status='not-required';fail('Dispatch is not required; no pre-dispatch preparation window is drawn.');continue;}
   if(summary?.required.key==='review'){fail('Dispatch requirement is invalid or conflicting; preparation estimate withheld.');continue;}
   if(summary?.target.state!=='valid'){fail('No usable dispatch plan. Map the latest or original dispatch plan and check missing, invalid or conflicting values.');continue;}
   const end=summary.target.day,start=subtract(end,duration);
   if(!Number.isFinite(start)||start<Date.UTC(1900,0,1)||start>=end){fail('Estimated preparation start is outside the supported date range.');continue;}
   Object.assign(record,{status:'estimated',reason:'Country standard supplied through the application relationship; not actual preparation activity.',start,end,anchor:summary.targetLabel,calendarDays:Math.round((end-start)/DAY)});result.set(id,record);
  }
  return result;
 }
 return {parseDuration,subtract,analyze};
});
