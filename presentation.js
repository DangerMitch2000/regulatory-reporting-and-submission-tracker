(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.regulatoryPresentation=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const text=v=>v==null?'':String(v).trim(),key=(...v)=>JSON.stringify(v),natural=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'}).compare;
 const urlFields={ApplicationURL:'AppID',RegulatoryObjectiveURL:'ROID',SubmissionURL:'SubID',RegistrationURL:'RegistrationID'};
 function safeURL(value){
  if(typeof value!=='string')return null;const raw=value.trim();
  if(!/^https?:\/\//i.test(raw)||/[\u0000-\u0020\u007f\\]/.test(raw))return null;
  try{const u=new URL(raw);return (u.protocol==='https:'||u.protocol==='http:')&&u.hostname&&!u.username&&!u.password?u.href:null;}catch{return null;}
 }
 function resolveURL(values){
  const raw=[...new Set(values.map(text).filter(Boolean))];
  if(!raw.length)return {url:null,issue:'Source URL not recorded.',values:[]};
  const valid=raw.map(safeURL),urls=[...new Set(valid.filter(Boolean))];
  if(valid.some(v=>!v))return {url:null,issue:'Invalid source URL — only absolute HTTP or HTTPS links without credentials are allowed.',values:raw};
  if(urls.length!==1)return {url:null,issue:'Conflicting source URLs for this record — link withheld.',values:raw};
  return {url:urls[0],issue:'',values:raw};
 }
 // Invoke only from an explicit user click. A supplied Power BI callback owns
 // navigation; its failure must not silently fall back to a browser popup.
 async function launchURL(value,launcher){const url=safeURL(value);if(!url)return {opened:false,reason:'This record has no valid HTTP or HTTPS source link.'};try{if(typeof launcher==='function'){const result=await launcher(url);return result===false?{opened:false,reason:'The host could not open this source link.'}:{opened:true,reason:''};}if(typeof window!=='undefined'&&typeof window.open==='function'){window.open(url,'_blank','noopener,noreferrer');return {opened:true,reason:''};}return {opened:false,reason:'Opening source links is unavailable in this environment.'};}catch{return {opened:false,reason:'The host could not open this source link.'};}}
 const linked=r=>!!(text(r.ChangeID)&&text(r.EventName)&&text(r.EventQMS)&&text(r.EventQMS).toLowerCase()===text(r.ChangeQMS).toLowerCase());
 function scope(mode,change,event,level,app='',ro='',sub=''){return key(mode,change,event,level,level>=0?app:'',level>=1?ro:'',level>=2?sub:'');}
 function recordScope(r){if(r.level===3)return key('registration',text(r.RegistrationID));const mode=r.changeKey?'Change initiation':r.eventKey?'Regulatory event':'Application',change=mode==='Change initiation'?(r.changeOther?'':text(r.ChangeID)):'',event=mode!=='Application'&&r.level>=-1?(r.unlinked?'':text(r.EventName)):'';return scope(mode,change,event,r.level,text(r.AppID),text(r.ROID),text(r.SubID));}
 function siteBucket(){return {legal:new Set(),registration:new Set()};}
 function addSites(bucket,row){const legal=text(row.Manufacturer),registration=text(row.RegistrationManufacturingSite);if(legal)bucket.legal.add(legal);if(registration)bucket.registration.add(registration);}
 function mergeSites(target,source){if(!source)return;for(const site of source.legal)target.legal.add(site);for(const site of source.registration)target.registration.add(site);}
 function analyze(source,allSource=source){
  const sites=new Map(),urls=Object.fromEntries(Object.keys(urlFields).map(f=>[f,new Map()]));
  for(const r of allSource)for(const [field,idField]of Object.entries(urlFields)){const id=text(r[idField]);if(!id)continue;let values=urls[field].get(id);if(!values){values=new Set();urls[field].set(id,values);}const value=text(r[field]);if(value)values.add(value);}
  for(const map of Object.values(urls))for(const [id,values]of map)map.set(id,resolveURL([...values]));
  for(const r of source){const app=text(r.AppID),ro=text(r.ROID),sub=text(r.SubID),event=text(r.EventName),change=text(r.ChangeID),registration=text(r.RegistrationID),keys=[];
   if(registration)keys.push(key('registration',registration));
   if(change)keys.push(scope('Change initiation',change,'',-2));
   const realLink=linked(r),groupChange=realLink?change:'';
   if(!realLink&&(event||app||ro||sub))keys.push(scope('Change initiation','','',-2));
   if(event||app||ro||sub){keys.push(scope('Regulatory event','',event,-1),scope('Change initiation',groupChange,event,-1));}
   if(app||ro||sub)for(const [mode,c,e]of [['Application','',''],['Regulatory event','',event],['Change initiation',groupChange,event]]){keys.push(scope(mode,c,e,0,app));if(ro||sub)keys.push(scope(mode,c,e,1,app,ro));if(sub)keys.push(scope(mode,c,e,2,app,ro,sub));}
   for(const k of new Set(keys)){let bucket=sites.get(k);if(!bucket){bucket=siteBucket();sites.set(k,bucket);}addSites(bucket,r);}
  }
  return {sites,urls};
 }
 function preview(label,values){return label+': '+values.slice(0,2).join(', ')+(values.length>2?' (+'+(values.length-2)+' more)':'');}
 function enrich(rows,analysis){
  const counts=new Map(),containerSites=new Map();
  for(const r of rows){if(r.level!==3||!text(r.RegistrationID))continue;const id=text(r.RegistrationID),parents=r.registrationUnlinked?[r.key,r.appKey]:[r.key,r.subKey,r.roKey,r.appKey,r.eventKey,r.changeKey];for(const k of new Set(parents.filter(Boolean))){if(!counts.has(k))counts.set(k,new Set());counts.get(k).add(id);}if(r.registrationUnlinked&&r.appKey){if(!containerSites.has(r.appKey))containerSites.set(r.appKey,siteBucket());mergeSites(containerSites.get(r.appKey),analysis.sites.get(recordScope(r)));}}
  return rows.map(r=>{const b=r.registrationContainer?containerSites.get(r.key):analysis.sites.get(recordScope(r)),legal=[...(b?.legal||[])].sort(natural),registration=[...(b?.registration||[])].sort(natural),siteLabels=[];if(legal.length)siteLabels.push(preview('Legal',legal));if(registration.length)siteLabels.push(preview('Registration',registration));if(!siteLabels.length)siteLabels.push('Not recorded');let field=null,id='';if(!r.registrationContainer){if(r.level===0){field='ApplicationURL';id=text(r.AppID);}else if(r.level===1){field='RegulatoryObjectiveURL';id=text(r.ROID);}else if(r.level===2){field='SubmissionURL';id=text(r.SubID);}else if(r.level===3){field='RegistrationURL';id=text(r.RegistrationID);}}const resolved=field&&id?analysis.urls[field].get(id)||resolveURL([]):{url:null,issue:'',values:[]};return {key:r.key,RegistrationCount:counts.get(r.key)?.size||0,SiteLabels:siteLabels,LegalSites:legal,RegistrationSites:registration,RecordURL:resolved.url,RecordURLIssue:resolved.issue,RecordURLValues:resolved.values};});
 }
 return {safeURL,resolveURL,launchURL,analyze,enrich};
});
