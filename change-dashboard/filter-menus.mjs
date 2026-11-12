// Keep filter menus in the visual's coordinate system. The original select
// remains the value store, labelled control and source of change events.
let nextMenuID=0;
export function mountFilterMenus(root){
 const doc=root.ownerDocument,win=doc.defaultView,selector='.cd-filters select';
 const menuID='cd-filter-menu-'+(++nextMenuID);
 let trigger=null,menu=null,list=null,search=null,options=[],shown=[],active=-1,destroyed=false;
 const insideSelect=target=>target?.closest?.(selector);
 const eligible=target=>{const el=insideSelect(target);return el&&root.contains(el)&&!el.disabled?el:null;};
 function enhance(){for(const el of root.querySelectorAll(selector)){el.setAttribute('aria-haspopup','listbox');el.setAttribute('aria-expanded',String(el===trigger));}}
 function close({restoreFocus=false}={}){
  const previous=trigger;
  if(previous){previous.setAttribute('aria-expanded','false');previous.removeAttribute('aria-controls');}
  menu?.remove();trigger=null;menu=null;list=null;search=null;options=[];shown=[];active=-1;
  if(restoreFocus&&previous?.isConnected&&!previous.disabled)previous.focus({preventScroll:true});
 }
 function clippingBounds(parent){
  const bounds={left:0,top:0,right:win.innerWidth,bottom:win.innerHeight};
  for(let el=parent;el&&el!==doc.documentElement;el=el.parentElement){
   const style=win.getComputedStyle(el),rect=el.getBoundingClientRect();
   const sx=el.offsetWidth?rect.width/el.offsetWidth:1,sy=el.offsetHeight?rect.height/el.offsetHeight:1;
   if(/auto|scroll|hidden|clip/.test(style.overflowX)){bounds.left=Math.max(bounds.left,rect.left+el.clientLeft*sx);bounds.right=Math.min(bounds.right,rect.left+(el.clientLeft+el.clientWidth)*sx);}
   if(/auto|scroll|hidden|clip/.test(style.overflowY)){bounds.top=Math.max(bounds.top,rect.top+el.clientTop*sy);bounds.bottom=Math.min(bounds.bottom,rect.top+(el.clientTop+el.clientHeight)*sy);}
  }
  return bounds;
 }
 function position(){
  if(!trigger?.isConnected||!menu)return close();
  const parent=menu.parentElement,p=parent.getBoundingClientRect(),a=trigger.getBoundingClientRect();
  const sx=p.width/parent.offsetWidth||1,sy=p.height/parent.offsetHeight||1,b=clippingBounds(parent);
  const insetX=4*sx,gap=4*sy;
  if(a.bottom<=b.top||a.top>=b.bottom||b.right-b.left<30||b.bottom-b.top<30)return close();
  const w=Math.min(Math.max(trigger.offsetWidth,280),(b.right-b.left-2*insetX)/sx);
  const left=Math.max(b.left+insetX,Math.min(a.left,b.right-insetX-w*sx));
  const below=Math.max(0,(b.bottom-a.bottom-gap)/sy),above=Math.max(0,(a.top-b.top-gap)/sy);
  const upwards=below<180&&above>below,available=upwards?above:below,maxHeight=Math.max(0,Math.min(360,available));
  menu.style.width=w+'px';menu.style.maxHeight=maxHeight+'px';
  menu.style.left=((left-p.left)/sx-parent.clientLeft+parent.scrollLeft)+'px';
  menu.style.top=((upwards?a.top-gap:a.bottom+gap)-p.top)/sy-parent.clientTop+parent.scrollTop+'px';
  menu.style.transform=upwards?'translateY(-100%)':'';
  menu.dataset.direction=upwards?'up':'down';
 }
 function setActive(index){
  active=shown.length?Math.max(0,Math.min(index,shown.length-1)):-1;
  for(const item of list?.querySelectorAll('[role=option]')||[])item.dataset.active=String(Number(item.dataset.index)===active);
  const item=active>=0?list?.querySelector('[data-index="'+active+'"]'):null;
  if(item){search.setAttribute('aria-activedescendant',item.id);const top=item.offsetTop-list.offsetTop,bottom=top+item.offsetHeight;if(top<list.scrollTop)list.scrollTop=top;else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=bottom-list.clientHeight;}
  else search?.removeAttribute('aria-activedescendant');
 }
 function draw(){
  const query=search.value.trim().toLocaleLowerCase();
  shown=options.filter(o=>!query||o.text.toLocaleLowerCase().includes(query));
  list.replaceChildren();
  for(const [index,option] of shown.entries()){
   const item=doc.createElement('div');item.className='cd-filter-option';item.id=menuID+'-option-'+index;
   item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.value===trigger.value));
   item.dataset.index=String(index);item.textContent=option.text;list.append(item);
  }
  if(!shown.length){const empty=doc.createElement('div');empty.className='cd-filter-empty';empty.setAttribute('role','status');empty.textContent='No matching values';list.append(empty);}
  // Constrain width/height before revealing the active option: on a fresh menu
  // the unconstrained list would otherwise appear to fit every option.
  position();if(menu)setActive(Math.max(0,shown.findIndex(o=>o.value===trigger.value)));
 }
 function choose(index){
  const option=shown[index],el=trigger;if(!option||!el)return;
  const changed=el.value!==option.value;el.value=option.value;close({restoreFocus:true});
  if(changed)el.dispatchEvent(new win.Event('change',{bubbles:true}));
 }
 function open(el,typed=''){
  close();if(destroyed||el.disabled)return;
  trigger=el;options=[...el.options].filter(o=>!o.disabled&&!o.hidden).map(o=>({value:o.value,text:o.label||o.textContent||o.value}));
  const label=el.getAttribute('aria-label')||el.labels?.[0]?.firstChild?.textContent?.trim()||'Filter';
  menu=doc.createElement('div');menu.className='cd-filter-menu';menu.dataset.filterMenu=el.dataset.filter||'group';
  search=doc.createElement('input');search.type='text';search.className='cd-filter-search';search.placeholder='Search values…';search.autocomplete='off';
  search.setAttribute('role','combobox');search.setAttribute('aria-label','Search '+label);search.setAttribute('aria-expanded','true');search.setAttribute('aria-autocomplete','list');search.setAttribute('aria-controls',menuID);
  list=doc.createElement('div');list.className='cd-filter-options';list.id=menuID;list.setAttribute('role','listbox');list.setAttribute('aria-label',label);
  menu.append(search,list);el.closest('.cd-filters').append(menu);el.setAttribute('aria-expanded','true');el.setAttribute('aria-controls',menuID);
  search.value=typed;draw();search?.focus({preventScroll:true});
 }
 function pointer(event){
  const el=eligible(event.target);if(!el)return;
  if(event.button!==undefined&&event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  // Prevent the browser's select popup on both pointerdown and mousedown.
  // The click handler opens exactly one in-visual menu.
  el.focus({preventScroll:true});
 }
 function click(event){
  const el=eligible(event.target);
  if(el){event.preventDefault();event.stopPropagation();if(trigger===el)close({restoreFocus:true});else open(el);return;}
  if(menu?.contains(event.target)){
   event.stopPropagation();const option=event.target.closest('[role=option]');if(option){event.preventDefault();choose(Number(option.dataset.index));}
  }
 }
 function key(event){
  const el=eligible(event.target);
  if(el){
   if(event.key==='Tab')return;
   if(event.key==='Escape'){event.preventDefault();close({restoreFocus:true});return;}
   if(['ArrowDown','ArrowUp','Home','End','Enter',' ','F4','PageDown','PageUp'].includes(event.key)||(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.length===1)){
    event.preventDefault();event.stopPropagation();const typed=event.key.length===1&&event.key!==' '?event.key:'';open(el,typed);
    if(event.key==='Home')setActive(0);else if(event.key==='End')setActive(shown.length-1);return;
   }
  }
  if(!menu?.contains(event.target))return;
  if(event.key==='Tab'){close({restoreFocus:true});return;}
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close({restoreFocus:true});return;}
  if(['ArrowDown','ArrowUp','Home','End','PageDown','PageUp','Enter'].includes(event.key)){
   event.preventDefault();event.stopPropagation();
   if(event.key==='Enter')choose(active);
   else setActive(event.key==='Home'?0:event.key==='End'?shown.length-1:active+(event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:event.key==='PageDown'?10:-10));
  }
 }
 function input(event){if(event.target===search){event.stopPropagation();draw();}}
 function outside(event){if(menu&&!menu.contains(event.target)&&event.target!==trigger)close();}
 function focus(event){if(menu&&!menu.contains(event.target)&&event.target!==trigger)close();}
 function scroll(event){if(menu&&!menu.contains(event.target))close();}
 function nativeChange(event){if(event.target===search)event.stopPropagation();else if(event.target===trigger)close();}
 const observer=new win.MutationObserver(()=>{if(trigger&&!trigger.isConnected)close();enhance();});observer.observe(root,{childList:true,subtree:true});enhance();
 root.addEventListener('pointerdown',pointer,true);root.addEventListener('mousedown',pointer,true);root.addEventListener('click',click,true);root.addEventListener('keydown',key,true);root.addEventListener('input',input,true);root.addEventListener('change',nativeChange,true);
 doc.addEventListener('pointerdown',outside,true);doc.addEventListener('focusin',focus,true);doc.addEventListener('scroll',scroll,true);win.addEventListener('resize',close);
 return {close,destroy(){if(destroyed)return;destroyed=true;close();observer.disconnect();root.removeEventListener('pointerdown',pointer,true);root.removeEventListener('mousedown',pointer,true);root.removeEventListener('click',click,true);root.removeEventListener('keydown',key,true);root.removeEventListener('input',input,true);root.removeEventListener('change',nativeChange,true);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('focusin',focus,true);doc.removeEventListener('scroll',scroll,true);win.removeEventListener('resize',close);for(const el of root.querySelectorAll(selector)){el.removeAttribute('aria-haspopup');el.removeAttribute('aria-expanded');el.removeAttribute('aria-controls');}}};
}
