(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.regulatoryHierarchyNavigation=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const ancestorFields=[['changeKey',-2],['eventKey',-1],['appKey',0],['roKey',1],['subKey',2]];
 const hasKey=key=>typeof key==='string'&&key.length>0;
 const empty=()=>({targetKeys:[],expandKeys:[],firstKey:null});

 // Resolve a real hierarchy edge, never an ID shared by another grouping.
 // An absent required parent is a broken path, not permission to skip levels.
 function parentOf(row,index){
  let field,level;
  if(row.level===3){field=row.registrationUnlinked?'appKey':'subKey';level=row.registrationUnlinked?0:2;}
  else if(row.level===2){field='roKey';level=1;}
  else if(row.level===1){field='appKey';level=0;}
  else if(row.level===0&&hasKey(row.eventKey)){field='eventKey';level=-1;}
  else if((row.level===0||row.level===-1)&&hasKey(row.changeKey)){field='changeKey';level=-2;}
  else return null;
  const parent=index.get(row[field]);
  if(!parent||parent.level!==level||parent.key===row.key)return null;
  if(row.registrationUnlinked&&!parent.registrationContainer)return null;
  if(parent.registrationContainer&&!(row.level===3&&row.registrationUnlinked))return null;
  // Defensive against stale/mixed grouping tuples: every explicit shared
  // ancestor must agree, even when the immediate parent happens to exist.
  for(const [name,ancestorLevel]of ancestorFields){
   if(ancestorLevel>=parent.level)break;
   if(hasKey(row[name])&&row[name]!==parent[name])return null;
  }
  return parent;
 }

 // Input is the current filtered hierarchy, including collapsed descendants.
 // Preserve its order for firstKey. Expansion keys are additions only; the
 // caller merges them into existing expansion state and may choose to scroll
 // to the first matching row in its current display sort after running Vega.
 function plan(rows,parentKey,targetLevel){
  if(!Array.isArray(rows)||!hasKey(parentKey)||!Number.isInteger(targetLevel)||targetLevel<-1||targetLevel>3)return empty();
  const index=new Map();
  for(const row of rows)if(row&&hasKey(row.key)&&Number.isInteger(row.level)&&row.level>=-2&&row.level<=3&&!index.has(row.key))index.set(row.key,row);
  const parent=index.get(parentKey);
  if(!parent||parent.level>=targetLevel||(parent.registrationContainer&&targetLevel!==3))return empty();
  const targetKeys=[],expandKeys=[],expanded=new Set();
  for(const row of index.values()){
   if(row.level!==targetLevel)continue;
   const path=[];let current=row;
   // Every edge has a strictly lower level; at most five edges per target.
   while(current.level>parent.level){
    current=parentOf(current,index);
    if(!current)break;
    path.push(current.key);
   }
   if(!current||current.key!==parentKey)continue;
   targetKeys.push(row.key);
   for(let i=path.length-1;i>=0;i--)if(!expanded.has(path[i])){expanded.add(path[i]);expandKeys.push(path[i]);}
  }
  return {targetKeys,expandKeys,firstKey:targetKeys[0]||null};
 }
 function counts(row){
  if(!row)return [];
  const count=value=>Number.isFinite(+value)?Math.max(0,Math.floor(+value)):0;
  const definitions=row.registrationContainer?[[3,'RegistrationCount','Reg','Regs']]
   :row.level===-2?[[-1,'EventCount','Event','Events'],[2,'n','Sub','Subs'],[3,'RegistrationCount','Reg','Regs']]
   :row.level===-1?[[0,'AppCount','App','Apps'],[2,'n','Sub','Subs'],[3,'RegistrationCount','Reg','Regs']]
   :row.level===0?[[1,'ROCount','RO','ROs'],[2,'n','Sub','Subs'],[3,'RegistrationCount','Reg','Regs']]
   :row.level===1?[[2,'n','Sub','Subs'],[3,'RegistrationCount','Reg','Regs']]
   :row.level===2&&count(row.RegistrationCount)>0?[[3,'RegistrationCount','Reg','Regs']]:[];
  return definitions.map(([level,field,singular,plural])=>{const n=count(row[field]);return {level,count:n,label:n+' '+(n===1?singular:plural)};});
 }
 return {plan,counts};
});
