import {render} from './submissions.ui.mjs';
import {sample} from './demo.mjs';
const root = document.getElementById('host'); let state = {}, rows = sample();
function draw() {render(root, rows, {state, synthetic: true, width: root.clientWidth, onChange: patch => {state = {...state,...patch}; draw();}});}
draw();
new ResizeObserver(() => draw()).observe(root);
document.getElementById('wide').onclick = () => {root.style.width='min(1440px,100%)';root.style.height='800px';draw();};
document.getElementById('small').onclick = () => {root.style.width='760px';root.style.height='720px';draw();};
document.getElementById('clean').onclick = () => {rows=sample();state={};draw();};
document.getElementById('review').onclick = () => {rows=sample();const pending=rows.find(r=>!r.ActualSubmission&&r.SubStatus==='In Progress'&&!r.SubID.includes('CLOSED-BY'));pending.ActualSubmission='invalid';rows.push({...rows[2], SubID:'DEMO-SITE-CHECK', Site:'ABO'}, {...rows[2],SubID:'DEMO-SITE-CHECK',Site:'SCR'});state={};draw();};
document.getElementById('missing').onclick = () => {rows=sample();const source={...rows[1],SubID:null,ActualSubmission:null,SubStatus:'Planned',ROStatus:'Planned',AppStatus:'Active',RegistrationID:null,RegistrationCountry:null,RegistrationStatus:null,RegistrationStart:null,RegistrationEnd:null,ROID:'DEMO-RO-AWAITING-SUBMISSION',AppID:'DEMO-APP-ABO'};rows.push(source,{...source},{...source,ROID:null,AppID:'DEMO-APP-AWAITING-RO',FallbackCountry:'Germany'});state={detail:{kind:'coverage',group:'missingIds'}};draw();};
