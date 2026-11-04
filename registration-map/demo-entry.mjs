import {mount} from './ui.mjs';
import {demoRows} from './demo.mjs';
const now=new Date(),rows=demoRows(now),host=document.getElementById('map-demo');
const app=mount(host,{onExport:async(csv,name)=>{const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return true;}});
app.update(rows,{now});const resize=()=>app.resize(host.clientWidth,host.clientHeight);resize();new ResizeObserver(resize).observe(host);
window.__registrationMap=app;window.__mapRows=rows;window.__mountMap=mount;window.__mapNow=now;window.__sendMapRows=(data)=>app.update(data,{now});
