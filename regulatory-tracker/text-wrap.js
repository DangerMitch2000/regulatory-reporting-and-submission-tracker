(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.regulatoryTextWrap=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const FONT='Segoe UI',ELLIPSIS='…';
 let context=null,contextChecked=false,currentFont='';
 function canvasContext(){
  if(contextChecked)return context;
  if(typeof document==='undefined'||typeof document.createElement!=='function')return null;
  contextChecked=true;
  try{context=document.createElement('canvas').getContext('2d');}catch{context=null;}
  return context;
 }
 function fallbackWidth(text,fontSize){return Array.from(text).length*fontSize*.8;}
 function measureText(text,fontSize,fontWeight=400){
  const ctx=canvasContext();if(!ctx)return fallbackWidth(text,fontSize);
  const font=fontWeight+' '+fontSize+'px "'+FONT+'"';if(font!==currentFont){ctx.font=font;currentFont=font;}
  return ctx.measureText(text).width;
 }
 function bounded(value,fallback,maximum){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(maximum,Math.floor(n))):fallback;}
 function cacheRead(cache,key){if(!cache.has(key))return undefined;const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;}
 function cacheWrite(cache,key,value,limit){if(!limit)return;cache.delete(key);cache.set(key,value);if(cache.size>limit)cache.delete(cache.keys().next().value);}
 function createWrapper(measure=measureText,options={}){
  if(typeof measure!=='function')throw new TypeError('Text measurement must be a function.');
  const layoutLimit=bounded(options.cacheSize,512,4096),measurementLimit=bounded(options.measurementCacheSize,2048,8192),cacheTextLimit=bounded(options.maxCacheTextLength,512,4096);
  const layouts=new Map(),measurements=new Map();
  function measured(text,size,weight=400){
   const key=text.length<=cacheTextLimit?size+'\n'+weight+'\n'+text:null,cached=key===null?undefined:cacheRead(measurements,key);if(cached!==undefined)return cached;
   let width;try{width=measure(text,size,weight);}catch{width=NaN;}
   if(!Number.isFinite(width)||width<0)width=fallbackWidth(text,size);
   if(key!==null)cacheWrite(measurements,key,width,measurementLimit);return width;
  }
  function wrap(value,width,fontSize=14,maxLines=1){
   const text=value==null?'':String(value).replace(/\s+/gu,' ').trim(),available=Number(width),size=Number(fontSize),limit=Math.floor(Number(maxLines));
   if(!text||!Number.isFinite(available)||available<=0||!Number.isFinite(size)||size<=0||!Number.isFinite(limit)||limit<=0)return [];
   const cacheKey=text.length<=cacheTextLimit?JSON.stringify([text,available,size,limit]):null,cached=cacheKey===null?undefined:cacheRead(layouts,cacheKey);if(cached!==undefined)return cached.slice();
   const chars=Array.from(text),lines=[];let start=0;
   const fragment=end=>chars.slice(start,end).join('');
   const fit=suffix=>{let lo=start,hi=chars.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(measured(fragment(mid).trimEnd()+suffix,size)<=available)lo=mid;else hi=mid-1;}return lo;};
   const boundary=end=>{if(end<chars.length&&chars[end]!==' '&&chars[end-1]!==' '){for(let i=end-1;i>start;i--)if(chars[i]===' ')return i;}return end;};
   while(start<chars.length&&lines.length<limit){
    const remaining=fragment(chars.length);if(measured(remaining,size)<=available){lines.push(remaining);break;}
    const last=lines.length===limit-1;
    if(last){
     if(measured(ELLIPSIS,size)>available)break;
     const end=boundary(fit(ELLIPSIS));lines.push(fragment(end).trimEnd()+ELLIPSIS);break;
    }
    const fitted=fit('');if(fitted===start){if(measured(ELLIPSIS,size)<=available)lines.push(ELLIPSIS);break;}
    const end=boundary(fitted);lines.push(fragment(end).trimEnd());start=end;while(chars[start]===' ')start++;
   }
   if(cacheKey!==null)cacheWrite(layouts,cacheKey,lines.slice(),layoutLimit);return lines;
  }
  // Retained text is bounded by both entry count and string length. Expose a
  // reset for font-loading changes without exposing mutable cache contents.
  wrap.measure=(value,fontSize=14,fontWeight=400)=>{const text=value==null?'':String(value),size=Number(fontSize),weight=Number(fontWeight);return text&&Number.isFinite(size)&&size>0?measured(text,size,Number.isFinite(weight)&&weight>=1&&weight<=1000?weight:400):0;};
  wrap.clearCache=()=>{layouts.clear();measurements.clear();};
  return wrap;
 }
 const wrap=createWrapper();
 function pointerScale(event){
  let svg;
  try{
   const target=event&&event.target;
   svg=target&&(target.ownerSVGElement||(String(target.localName||target.nodeName).toLowerCase()==='svg'?target:null));
   while(svg&&svg.ownerSVGElement)svg=svg.ownerSVGElement;
  }catch{return 1;}
  if(!svg)return 1;
  // The outer SVG's screen transform includes Power BI report scaling. It
  // needs no global SVG/DOM constructor, so synthetic/headless events are safe.
  try{const matrix=svg.getScreenCTM(),scale=matrix&&Math.hypot(matrix.a,matrix.b);if(Number.isFinite(scale)&&scale>0)return scale;}catch{}
  try{const width=svg.width.baseVal.value,screen=svg.getBoundingClientRect().width,scale=screen/width;if(width>0&&Number.isFinite(scale)&&scale>0)return scale;}catch{}
  return 1;
 }
 function register(vega){
  if(!vega||typeof vega.expressionFunction!=='function')throw new TypeError('A Vega expression registry is required.');
  const fn=canvasContext()||!vega.textMetrics||typeof vega.textMetrics.width!=='function'?wrap:createWrapper((text,fontSize,fontWeight)=>vega.textMetrics.width({font:FONT,fontSize,fontWeight},text));
  vega.expressionFunction('trackerWrapText',fn);
  vega.expressionFunction('trackerTextWidth',fn.measure);
  vega.expressionFunction('trackerPointerScale',pointerScale);return fn;
 }
 return {wrap,measure:wrap.measure,createWrapper,pointerScale,register};
});
