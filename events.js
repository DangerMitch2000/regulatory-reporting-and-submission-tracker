(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./states.js'):root.regulatoryStates);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.regulatoryEvents=api;})(typeof globalThis==='object'?globalThis:this,function(states){
 'use strict';
 const text=v=>v==null?'':String(v).trim(),key=(...v)=>JSON.stringify(v),unique=v=>[...new Set(v)],finite=v=>v!=null&&Number.isFinite(v);
 function day(v){if(v==null||v==='')return null;const s=v instanceof Date?v.toISOString():String(v),m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(!m)return NaN;const n=Date.UTC(+m[1],+m[2]-1,+m[3]),d=new Date(n);return +m[1]>=1900&&+m[1]<=2100&&d.getUTCFullYear()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[3]?n:NaN;}
 function dateField(rows,f){const v=rows.map(r=>day(r[f])).filter(v=>v!==null);return v.some(Number.isNaN)?{value:null,label:'Invalid date — withheld'}:unique(v).length>1?{value:null,label:'Conflicting dates — withheld'}:v.length?{value:v[0],label:new Date(v[0]).toISOString().slice(0,10)}:{value:null,label:'Not recorded'};}
 const colour=states.colour;
 function membership(rows,field){const values=unique(rows.map(r=>text(r[field])).filter(Boolean)).sort(),members=values.map(label=>({label}));return {members,count:values.length,missing:rows.some(r=>!text(r[field])),label:values.length===1?values[0]:values.length+' values',detail:values.join(' · ')};}
 function decorate(row,source){for(const f of ['Manufacturer','Country','Product'])row[f+'Info']=membership(source,f);row.SiteLabel=row.ManufacturerInfo.label;row.ProductLabel=row.ProductInfo.label;row.ProductCountLabel=row.ProductInfo.count+' products';row.CountryCountLabel=row.CountryInfo.count===1?row.CountryInfo.detail:row.CountryInfo.count+' countries';row.shortTip={Record:row.EventName||row.AppID,State:row.State,Action:row.level<2?'Click label to expand; subtitle for details':'Select for details'};return row;}
 function prepare(submissions,applications,objectives){return {base:new Map(submissions.map(s=>[key(s.AppID,s.ROID,s.SubID),s])),apps:new Map(applications.map(a=>[a.AppID,a])),ros:new Map(objectives.map(r=>[key(r.AppID,r.ROID),r]))};}
 const natural=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}).compare;
 function partition(rows,field){const groups=new Map();for(const row of rows){const k=text(row[field]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}return groups;}
 function build(source,submissions,applications,objectives,prepared=prepare(submissions,applications,objectives)){
  const {base,apps,ros}=prepared,groups=new Map();
  for(const r of source){const k=key(text(r.AppID),text(r.ROID),text(r.SubID));if(!base.has(k))continue;const name=text(r.EventName);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(r);}
  const names=[...groups.keys()].filter(Boolean).sort(natural),result=[];
  for(const [name,records]of groups){const eventKey=key('event',name),common={EventName:name||'No linked event',eventKey,eventRank:names.indexOf(name),unlinked:name?0:1};const linked=new Map();for(const r of records){const k=key(text(r.AppID),text(r.ROID),text(r.SubID));if(!linked.has(k))linked.set(k,[]);linked.get(k).push(r);}
   const children=[...linked].map(([k,rs])=>{const s=base.get(k);return decorate({...s,...common,key:key(eventKey,s.key),appKey:key(eventKey,s.appKey),roKey:key(eventKey,s.roKey),baseKey:s.key},rs)});
   const parent=(template,children,rs,level,k)=>decorate({...template,...common,baseKey:template.key,key:k,level,n:unique(children.map(s=>s.SubID)).length,ROCount:unique(children.map(s=>s.ROID)).length,AppCount:unique(children.map(s=>s.AppID)).length,start:Math.min(...children.map(s=>s.start).filter(finite)),end:Math.max(...children.map(s=>s.end).filter(finite)),issues:children.reduce((n,s)=>n+(s.issues||0),0),Breakdown:{label:unique(children.map(s=>s.State)).join(' · ')},sortDate:0},rs);
   const states=unique(records.map(r=>text(r.EventState)).filter(Boolean)),state=!name?'Not applicable':states.length>1?'Conflicting values':states[0]||'Not recorded',start=dateField(records,'EventPlannedStart'),end=dateField(records,'EventPlannedCompletion');
   const event=parent({AppID:'',ROID:'',sortRO:''},children,records,-1,eventKey);Object.assign(event,{State:state,StateColor:colour(state),start:null,end:null,EventStartLabel:start.label,EventEndLabel:end.label,EventPlanNote:'Both event planned dates are needed to draw a span.'});
   if(name&&start.value!==null&&end.value!==null){if(end.value>=start.value)Object.assign(event,{start:start.value,end:end.value,EventPlanNote:'Event plan; independent of submission milestone dates.'});else event.EventPlanNote='Planned completion is before planned start — span withheld.';}
   result.push(event);
   const appRecords=partition(records,'AppID');for(const [appId,ac]of partition(children,'AppID')){const ar=appRecords.get(appId),app=parent(apps.get(appId),ac,ar,0,ac[0].appKey);app.appKey=app.key;result.push(app);
    const roRecords=partition(ar,'ROID');for(const [roId,rc]of partition(ac,'ROID')){const rr=roRecords.get(roId),ro=parent(ros.get(key(appId,roId)),rc,rr,1,rc[0].roKey);ro.appKey=app.key;ro.roKey=ro.key;result.push(ro,...rc);}
   }
  }return result.map(row=>Object.fromEntries(Object.entries(row)));
 }
 return {build,dateField,prepare};
});
