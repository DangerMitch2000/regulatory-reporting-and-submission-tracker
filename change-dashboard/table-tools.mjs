export function compare(a,b,direction='asc'){
 const empty=v=>v===null||v===undefined||v==='';
 if(empty(a)||empty(b))return Number(empty(a))-Number(empty(b));
 const n=typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),undefined,{numeric:true,sensitivity:'base'});
 return direction==='desc'?-n:n;
}
export function filterRows(rows,columns,filters={}){return rows.filter(r=>columns.every(c=>!String(filters[c.key]||'').trim()||String((c.search||c.value)(r)??'').toLowerCase().includes(String(filters[c.key]).trim().toLowerCase())));}
export function tableRows(rows,columns,state){const column=columns.find(c=>c.key===state.key)||columns[0];return filterRows(rows,columns,state.filters).slice().sort((a,b)=>compare(column.value(a),column.value(b),state.direction));}
export function dueOrder(a,b,direction='desc'){
 const rank=x=>x.due==null?2:x.overdue?0:1;
 return rank(a)-rank(b)||compare(a.due,b.due,rank(a)===0?direction:'asc');
}
