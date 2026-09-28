(function(root,factory){
  'use strict';const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.regulatorySubmissionPeriod=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  function boundary(value){
    if(!value)return null;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
    const n=Date.parse(value+'T00:00:00Z');
    return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value&&new Date(n).getUTCFullYear()<=2100?n:NaN;
  }
  function compile(selection={}){
    const mode=selection.mode||'all';
    if(mode==='all'||mode==='undated')return {mode,label:mode==='all'?'All dates':'No usable date',error:'',start:null,end:null};
    if(/^year:\d{4}$/.test(mode)){
      const year=Number(mode.slice(5));
      if(year>=100&&year<=2100)return {mode:'range',label:String(year),start:Date.UTC(year,0,1),end:Date.UTC(year,11,31),error:''};
    }
    if(mode==='custom'){
      const start=boundary(selection.from),end=boundary(selection.to);
      if(Number.isNaN(start)||Number.isNaN(end))return {mode:'invalid',label:'Check range',error:'Enter valid dates no later than 2100.'};
      if(start!==null&&end!==null&&start>end)return {mode:'invalid',label:'Check range',error:'From must be on or before To.'};
      return {mode:'range',label:'Custom range',start,end,error:''};
    }
    return {mode:'invalid',label:'Check range',error:'Choose a year or a custom date range.'};
  }
  function matches(entry,period){
    if(period.mode==='all')return true;
    const valid=entry?.state==='valid'&&Number.isFinite(entry.date);
    if(period.mode==='undated')return !valid;
    return period.mode==='range'&&valid&&(period.start===null||entry.date>=period.start)&&(period.end===null||entry.date<=period.end);
  }
  function years(entries){return [...new Set([...entries].filter(e=>e?.state==='valid'&&Number.isFinite(e.date)).map(e=>new Date(e.date).getUTCFullYear()))].filter(y=>y>=100&&y<=2100).sort((a,b)=>b-a);}
  return {compile,matches,years};
});
