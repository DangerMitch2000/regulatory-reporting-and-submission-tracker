(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.regulatoryDispatchRequired=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const options=[{key:'all',label:'All'},{key:'true',label:'True — required'},{key:'false',label:'False — not required'},{key:'blank',label:'Blank — not recorded'},{key:'review',label:'Conflicting / invalid'},{key:'unmapped',label:'Field not mapped'}];
 function parse(value){
  if(value===null||value===undefined||typeof value==='string'&&!value.trim())return {kind:'blank',value:null};
  if(value===true||typeof value==='string'&&value.trim().toLowerCase()==='true')return {kind:'value',value:true};
  if(value===false||typeof value==='string'&&value.trim().toLowerCase()==='false')return {kind:'value',value:false};
  return {kind:'invalid',value:null};
 }
 function resolve(values=[],mapped=true){
  if(!mapped)return {key:'unmapped',kind:'unmapped',value:null,label:'Field not mapped',values:[],hasBlank:false};
  const known=new Set(),source=new Set();let invalid=false,hasBlank=false;
  for(const raw of values){const item=parse(raw);if(item.kind==='blank'){hasBlank=true;continue;}source.add(String(raw).trim());if(item.kind==='invalid')invalid=true;else known.add(item.value);}
  const rawValues=[...source].sort();
  if(known.size>1)return {key:'review',kind:'conflict',value:null,label:'Conflicting values',values:rawValues,hasBlank};
  if(invalid)return {key:'review',kind:'invalid',value:null,label:'Unrecognised value',values:rawValues,hasBlank};
  if(!known.size)return {key:'blank',kind:'blank',value:null,label:'Blank — not recorded',values:[],hasBlank};
  const value=[...known][0];return {key:String(value),kind:'value',value,label:value?'True — dispatch required':'False — dispatch not required',values:rawValues,hasBlank};
 }
 function bySubmission(rows,mapped=true){
  const groups=new Map();for(const row of rows){const id=String(row.SubID??'').trim();if(!id)continue;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(row.DispatchRequired);}
  return new Map([...groups].map(([id,values])=>[id,resolve(values,mapped)]));
 }
 function matches(flag,key='all'){return key==='all'||flag?.key===key;}
 // Resolve against every received row for an ID before applying local filters.
 // A product, site or BU filter must never hide conflicting Boolean evidence.
 function filterRows(rows,key='all',mapped=true){const index=bySubmission(rows,mapped);return rows.filter(row=>matches(index.get(String(row.SubID??'').trim())||resolve([row.DispatchRequired],mapped),key));}
 return {options,parse,resolve,bySubmission,matches,filterRows};
});
