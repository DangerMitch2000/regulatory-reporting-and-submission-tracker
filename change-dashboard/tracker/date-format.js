(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.regulatoryDateFormat=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const months=Object.freeze(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']);
 // Dates in source strings are calendar dates: an offset must not move the day.
 // This formatter never writes back to the source or participates in sorting.
 function parse(value){
  if(value===null||value===undefined||value==='')return null;
  if(value instanceof Date)return Number.isFinite(value.valueOf())?value.valueOf():NaN;
  if(typeof value==='number')return Number.isFinite(value)&&Number.isFinite(new Date(value).valueOf())?value:NaN;
  if(typeof value!=='string')return NaN;
  const text=value.trim();if(!text)return null;
  let year,month,day,match=text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):?(\d{2}))?)?$/);
  if(match){
   if(+match[4]>23||+match[5]>59||+match[6]>59||+match[7]>23||+match[8]>59)return NaN;
   year=+match[1];month=+match[2]-1;day=+match[3];
  }
  else {match=text.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);if(!match)return NaN;day=+match[1];month=months.findIndex(m=>m.toLowerCase()===match[2].toLowerCase());year=+match[3];}
  if(year<1||year>9999||month<0||month>11||day<1||day>31)return NaN;
  const date=new Date(0);date.setUTCFullYear(year,month,day);date.setUTCHours(0,0,0,0);
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month&&date.getUTCDate()===day?date.valueOf():NaN;
 }
 function format(value,missing='Not recorded'){
  const parsed=parse(value);if(parsed===null||!Number.isFinite(parsed))return missing;
  const date=new Date(parsed),year=date.getUTCFullYear();if(year<1||year>9999)return missing;
  return String(date.getUTCDate()).padStart(2,'0')+' '+months[date.getUTCMonth()]+' '+String(year).padStart(4,'0');
 }
 function recorded(value,missing='Not recorded'){
  if(value===null||value===undefined||String(value).trim()==='')return missing;
  return format(value,value instanceof Date?'Invalid Date':String(value));
 }
 return {months,parse,format,recorded};
});
