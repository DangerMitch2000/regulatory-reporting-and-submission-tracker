import {summarize, DEFAULT_SITES, STATE_FIELDS, IDENTIFIER_FIELDS, SUBMITTED_STATES, normalizeSites, siteKey, formatDate, stateLabel, formatStates, attentionFor} from './submissions.logic.mjs';
const el = (tag, text, cls) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n;};
const svgEl = (tag, attrs = {}, text) => {const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n;};
const dateText = day => formatDate({kind: 'date', day});
const submittedStatesText = SUBMITTED_STATES.join(', ');
const overdueLabels = {all:'All overdue work', internal:'Internal dispatch overdue', authority:'Late authority submissions', unclassified:'Check dispatch data'};
const metricLabels = {planned:'Planned submissions',inProcess:'In process',submitted:'Submitted',review:'Check date',completion:'Submitted percentage',overdue:'Overdue within the three-month plan'};
const evidenceLabels = {actual:'Actual submission date',state:'Submission state',registration:'Registration approval'};
const coverageLabels = {outsideSites:'Submissions outside selected sites',outsideMonths:'Submissions outside the month plan and backlog',missingIds:'Source rows without a submission ID'};
const matchesMetric = (record,metric) => metric==='overdue'?record.overdue:metric==='inProcess'?record.status==='In process':metric==='submitted'||metric==='completion'?record.status==='Submitted':metric==='review'?record.status==='Check date':true;
const dispatchStages = ['Pending internal dispatch', 'Awaiting authority submission', 'Check dispatch data', 'Submitted', 'RO approved', 'Check submission date'];
const requiredText = required => required?.values?.length ? required.values.join(' / ') : required?.kind === 'unmapped' ? 'Not mapped' : 'Not recorded';
const labels = {SubID: 'Submission ID', Site: 'Site (legal manufacturer)', PlannedSubmission: 'Planned submission date', ActualSubmission: 'Actual submission date'};
export function render(root, rows, options = {}) {
  const {state = {}, onChange = () => {}, missing = [], notice = '', unitMapped = true, synthetic = false, now = new Date(), highContrast = null} = options;
  const dark = state.theme !== 'light',width=options.width||root.clientWidth||1280;
  root.replaceChildren(); root.className = 'siteSubmissions' + (dark ? ' dark' : '') + (state.capture ? ' capture' : '') + (width<=900?' ssCompact':'') + (width<=550?' ssNarrow':''); root.tabIndex = 0;
  root.onkeydown = e => {if (e.key === 'Escape') {onChange({capture: false, detail: null}); root.focus();}};
  if (missing.length) {
    const setup = el('section', undefined, 'ssSetup'); setup.append(el('h2', 'Site Submission Outlook'), el('p', 'Map these four fields to show last month, this month and next month for your main six sites:'));
    const list = el('ul'); missing.forEach(role => list.append(el('li', labels[role] || role))); setup.append(list, el('p', 'Use raw date columns, not date hierarchies. Use the initial planned submission date to match the reference slide. An actual-date column may contain blanks.')); root.append(setup); return;
  }
  const sites = normalizeSites(state.sites), unit = unitMapped ? state.unit ?? '*' : '*', r = summarize(rows, {sites, unit, product:state.product??'*', region:state.region??'*', country:state.country??'*', scopeMapped:options.scopeMapped, reference:'previousDay', now, stateFilters: state.stateFilters, stateMapped: options.stateMapped, dispatchMapped: options.dispatchMapped, registrationMapped:options.registrationMapped, fallbackCountryMapped:options.fallbackCountryMapped, identifierMapped:options.identifierMapped});
  const asOf = r.asOf;
  function openDetails(detail) {
    onChange({detail,query:'',status:'all',dispatchStage:'all',detailSite:'*',columnFilters:{},detailSort:null,expandedRecords:[],page:0,sitesOpen:false,stateOpen:null,capture:false});
    const section=root.querySelector('.ssDetails');
    section?.scrollIntoView({block:'nearest'});
    section?.querySelector('h3')?.focus({preventScroll:true});
  }
  const controls = el('div', undefined, 'ssControls');
  const siteControl = el('details', undefined, 'ssSites'); siteControl.open = Boolean(state.sitesOpen);
  siteControl.append(el('summary', `Sites · ${sites.length}`));
  const panel = el('div', undefined, 'ssSitePanel'); panel.append(el('p', 'Choose up to six sites.'));
  const choices = [...new Map([...sites, ...r.availableSites].map(name => [siteKey(name), name])).values()];
  choices.forEach(name => {
    const label = el('label'), box = el('input'); box.type = 'checkbox'; box.checked = sites.some(s => siteKey(s) === siteKey(name)); box.setAttribute('aria-label', `Include ${name}`);
    box.disabled = !box.checked && sites.length >= 6;
    box.onchange = () => onChange({sites: box.checked ? [...sites, name] : sites.filter(s => siteKey(s) !== siteKey(name)), sitesOpen: true, detail: null});
    label.append(box, el('span', name)); if (!r.availableSites.some(s => siteKey(s) === siteKey(name))) label.append(el('small', 'No delivered rows')); panel.append(label);
  });
  const reset = el('button', 'Use main six sites'); reset.onclick = () => onChange({sites: [...DEFAULT_SITES], sitesOpen: true, detail: null}); panel.append(reset); siteControl.append(panel); controls.append(siteControl);
  function select(label, value, opts, key, disabled = false) {
    const wrap = el('label', label), input = el('select'); input.setAttribute('aria-label', label);
    if (!opts.some(o => o.value === value)) opts.push({value, label: `${value || 'Blank'} (no records)`});
    for (const o of opts) {const opt = el('option', o.label); opt.value = o.value; input.append(opt);} input.value = value; input.disabled = disabled;
    if (disabled) input.title = `Map the ${label} field to enable this filter.`;
    input.onchange = () => onChange({[key]: input.value, detail: null, stateOpen: null}); wrap.append(input); controls.append(wrap);
  }
  if (unitMapped) select('Business unit', state.unit ?? '*', [{value: '*', label: 'All'}, ...r.units.map(value => ({value, label: value || 'Not recorded'}))], 'unit');
  else select('Business unit', '*', [{value: '*', label: 'Map Business unit field'}], 'unit', true);
  for(const [label,key,mapped,choices] of [['Product','product',r.scopeMapped?.Product,r.products||[]],['Commercial region','region',r.scopeMapped?.CommercialRegion,r.regions||[]],['Country','country',r.countryEnabled,r.countries||[]]]) select(label,mapped?state[key]??'*':'*',[{value:'*',label:mapped?'All':'Map field'},...choices.map(value=>({value,label:value||'Not recorded'}))],key,!mapped);
  select('Theme', state.theme || 'dark', [{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}], 'theme');
  const capture = el('button', 'Screenshot mode', 'ssPush'); capture.title = 'Hide controls; press Escape to return.'; capture.onclick = () => {onChange({capture: true, sitesOpen: false, stateOpen: null}); root.focus();}; controls.append(capture); root.append(controls);
  const stateControls = el('div', undefined, 'ssStateControls');
  STATE_FIELDS.forEach(({role,label}) => {
    if (!r.stateMapped[role]) {
      const button = el('button', `${label} · Map field`); button.disabled = true; button.dataset.role = role; button.title = `Map ${label} (optional) to enable this filter.`; stateControls.append(button); return;
    }
    const values = r.stateFilters[role], menu = el('details', undefined, 'ssStateFilter'); menu.dataset.role = role; menu.open = state.stateOpen === role;
    menu.append(el('summary', `${label} · ${values === null ? 'All' : values.length ? values.length + ' selected' : 'None'}`));
    const list = el('div', undefined, 'ssSitePanel ssStatePanel'), buttons = el('div', undefined, 'ssStateActions');
    const update = selection => onChange({stateFilters:{...r.stateFilters,[role]:selection},stateOpen:role,sitesOpen:false,detail:null,query:'',page:0});
    const all = el('button','All'), none = el('button','None'); all.setAttribute('aria-label',`All ${label} values`); none.setAttribute('aria-label',`Clear ${label} values`); all.onclick=()=>update(null); none.onclick=()=>update([]); buttons.append(all,none);list.append(buttons);
    const options = [...new Set([...r.stateChoices[role],...(values||[])])].sort((a,b)=>stateLabel(a).localeCompare(stateLabel(b)));
    if(!options.length)list.append(el('p','No states delivered.'));
    options.forEach(value=>{
      const line=el('label'),box=el('input');box.type='checkbox';box.checked=values===null||values.includes(value);box.setAttribute('aria-label',`Include ${stateLabel(value)} in ${label}`);
      box.onchange=()=>{const selected=values===null?[...options]:[...values];update(box.checked?[...new Set([...selected,value])]:selected.filter(v=>v!==value));};
      line.append(box,el('span',stateLabel(value)));if(!r.stateChoices[role].includes(value))line.append(el('small','No delivered rows'));list.append(line);
    });
    menu.append(list);stateControls.append(menu);
  });root.append(stateControls);
  if (notice) root.append(el('p', notice, 'ssNotice'));
  const colors = {bg: dark ? '#101319' : '#ffffff', ink: dark ? '#dbe3ef' : '#17324d', muted: dark ? '#98a9bf' : '#536a80',
    border: dark ? '#3d4b60' : '#dce6ef', panel: dark ? '#1d2633' : '#f3f7fa', inProcess: dark ? '#78a9d0' : '#176eb0', submitted: dark ? '#8dc7b0' : '#31977d', review: '#d7b777', backlog: dark ? '#d7ad8d' : '#a5450a', backlogBg: dark ? '#302923' : '#fff2e7', internal: dark ? '#b5a6ce' : '#6346a4', authority: dark ? '#d7ad8d' : '#a5450a', unclassified: dark ? '#98a9bf' : '#536a80'};
  if (highContrast) {
    Object.assign(colors, {bg:highContrast.background,ink:highContrast.foreground,muted:highContrast.foreground,border:highContrast.foreground,panel:highContrast.background,inProcess:highContrast.foreground,submitted:highContrast.background,review:highContrast.background,backlog:highContrast.foreground,backlogBg:highContrast.background});
    for (const key of ['internal','authority','unclassified']) colors[key]=colors.ink;
    for(const [key,value] of Object.entries({ink:colors.ink,muted:colors.muted,border:colors.border,surface:colors.bg,bg:colors.panel})) root.style.setProperty('--'+key,value);
  } else for(const key of ['ink','muted','border','surface','bg']) root.style.removeProperty('--'+key);
  const title = el('div', undefined, 'ssTitle'), heading=el('div'); heading.append(el('h2','Site Submission Outlook'),el('p',`${r.label} · Planned-month progress`));title.append(heading);
  const legend=el('div',undefined,'ssLegend');
  for(const [key,label] of [['inProcess','In process'],['submitted','Submitted'],...(r.totals.review?[['review','Check date']]:[])]) {const item=el('span'),swatch=el('i');swatch.style.background=colors[key];item.append(swatch,document.createTextNode(label));legend.append(item);}title.append(legend);root.append(title);
  const addButton=(parent,label,count,detail,cls='ssMetricHit')=>{
    const button=el('button',undefined,cls);button.dataset.metric=detail.metric||detail.kind;button.dataset.scope=detail.kind||'month';
    if(detail.group)button.dataset.group=detail.group;if(detail.site)button.dataset.site=detail.site;if(detail.source)button.dataset.evidence=detail.source;
    button.setAttribute('aria-label',`${label}: ${count}. View matching details.`);button.setAttribute('aria-pressed',String(JSON.stringify(detail)===JSON.stringify(state.detail)));button.title=`${label}: ${count}. View records and copy IDs.`;
    button.append(el('strong',String(count)),el('span',label));button.onclick=()=>openDetails(detail);parent.append(button);return button;
  };
  const summary=el('div',undefined,'ssSummary');
  for(const [metric,label,count] of [['planned','Planned',r.totals.planned],['inProcess','In process',r.totals.inProcess],['submitted','Submitted',r.totals.submitted],['completion','Submitted',`${r.completion}%`],['overdue','Overdue in plan',r.totals.overdue],...(r.totals.review?[['review','Check date',r.totals.review]]:[])])addButton(summary,label,count,{kind:'plan',metric});
  root.append(summary);
  const evidence=el('div',undefined,'ssEvidenceStrip');evidence.append(el('span','Submitted evidence:'));
  for(const source of ['actual','state','registration']) {const b=addButton(evidence,evidenceLabels[source],r.evidenceCounts?.[source]||0,{kind:'evidence',source},'ssEvidenceHit');b.title='One evidence group per submitted record: actual date first, then submission state, then registration approval.';}root.append(evidence);
  const W=Math.max(1000,Math.min(1800,options.width||root.clientWidth||1200));
  const stage=el('div',undefined,'ssStage'),svg=svgEl('svg',{viewBox:`0 0 ${W} 416`,role:'img','aria-label':`Submissions planned for ${r.label}: ${r.totals.planned} planned, ${r.totals.inProcess} in process, ${r.totals.submitted} submitted, ${r.totals.review} check date. Earlier overdue backlog: ${r.backlog.count}.`});stage.append(svg);root.append(stage);
  function drawChart(H) {
  const left=54,right=W-24,top=39,bottom=H-123,chartHeight=bottom-top;
  svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.append(svgEl('rect',{width:W,height:H,fill:colors.bg}));
  const text=(x,y,value,size=16,fill=colors.ink,extra={})=>{const n=svgEl('text',{x,y,'font-size':size,fill,...extra},value);svg.append(n);return n;};
  const bold={'font-weight':650},centered={'text-anchor':'middle'};
  function metricHit(x,y,width,height,detail,count,label,cls='ssMetricHit') {
    const hit=svgEl('rect',{x,y,width,height,rx:4,fill:'transparent',stroke:JSON.stringify(state.detail)===JSON.stringify(detail)?colors.ink:'none','stroke-width':2,tabindex:0,role:'button',class:cls,'data-metric':detail.metric||detail.kind,'data-scope':detail.kind||'month',...(detail.site?{'data-site':detail.site}:{}),...(detail.month?{'data-month':detail.month}:{}),'aria-label':`${label}: ${count}. View matching details.`});
    hit.append(svgEl('title',{},`${label}: ${count}\nClick to view records and copy IDs.`));hit.onclick=()=>openDetails(detail);hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetails(detail);}};svg.append(hit);return hit;
  }
  const ticks=Array.from({length:Math.floor(r.axisMax/r.step)+1},(_,i)=>i*r.step);
  for(const tick of ticks){const y=bottom-tick/r.axisMax*chartHeight;svg.append(svgEl('line',{x1:left,x2:right,y1:y,y2:y,stroke:colors.border,'stroke-width':tick?1:1.5}));text(left-12,y+5,String(tick),15,colors.muted,{'text-anchor':'end'});}
  text(left,20,'Submissions',14,colors.muted);
  const groupWidth=(right-left)/Math.max(sites.length,1),barGap=8,barWidth=Math.min(42,(groupWidth-36)/3),currentKey=r.currentMonth;
  r.buckets.forEach((site,i)=>{
    const cx=left+groupWidth*(i+.5),start=cx-(site.months.length*barWidth+(site.months.length-1)*barGap)/2;
    if(i)svg.append(svgEl('line',{x1:left+groupWidth*i,x2:left+groupWidth*i,y1:bottom+12,y2:bottom+66,stroke:colors.border}));
    site.months.forEach((month,mi)=>{
      const x=start+mi*(barWidth+barGap),segments=[];let y=bottom;
      for(const [key,count] of [['inProcess',month.inProcess],['submitted',month.submitted],['review',month.review]]) {
        const height=count/r.axisMax*chartHeight;y-=height;
        if(count)svg.append(svgEl('rect',{x,y,width:barWidth,height,fill:colors[key],stroke:highContrast?colors.ink:'none','stroke-width':2}));
        if(height>=23)text(x+barWidth/2,y+height/2+5,String(count),16,highContrast?(key==='inProcess'?colors.bg:colors.ink):key==='inProcess'?(dark?'#152335':'#fff'):'#173a35',{...centered,...bold});
        if(count)segments.push({key,count,y,height});
      }
      text(x+barWidth/2,y-10,String(month.planned),18,colors.ink,{...centered,...bold});
      text(x+barWidth/2,bottom+27,month.short,15,month.key===currentKey?colors.ink:colors.muted,{...centered,...(month.key===currentKey?bold:{})});
      if(month.key===currentKey)svg.append(svgEl('line',{x1:x+4,x2:x+barWidth-4,y1:bottom+33,y2:bottom+33,stroke:colors.muted,'stroke-width':2}));
      const hit=metricHit(x-4,y-31,barWidth+8,28,{site:site.key,month:month.key},month.planned,`${site.site}, ${month.label}: ${month.planned} planned, ${month.inProcess} in process, ${month.submitted} submitted`,'ssHit');
      hit.querySelector('title').textContent=`${site.site} · ${month.label}\nPlanned: ${month.planned}\nIn process: ${month.inProcess}\nSubmitted: ${month.submitted}\nOverdue: ${month.overdue}\nGrouped by planned submission month; actual submission may be in another month.`;
      for(const segment of segments)metricHit(x,segment.y,barWidth,segment.height,{site:site.key,month:month.key,metric:segment.key},segment.count,`${site.site} · ${month.label} · ${metricLabels[segment.key]}`,'ssSegmentHit');
    });
    text(cx,bottom+57,site.site.length>14?site.site.slice(0,13)+'…':site.site,18,colors.ink,{...centered,...bold}).append(svgEl('title',{},site.site));
    const width=Math.min(groupWidth-16,150),x=cx-width/2,y=bottom+80;
    svg.append(svgEl('rect',{x,y,width,height:32,rx:5,fill:colors.backlogBg,stroke:highContrast?colors.ink:'none'}));
    text(cx,y+22,String(site.backlog.count),18,colors.backlog,{...centered,...bold});metricHit(x,y,width,32,{kind:'backlog',site:site.key},site.backlog.count,`${site.site} · Earlier overdue backlog`,'ssBacklogHit');
  });
  text(left,bottom+76,`Earlier backlog · before ${dateText(r.backlog.cutoff)}`,13,colors.muted);
  if(!sites.length)text((left+right)/2,top+100,'Choose up to six sites to start.',20,colors.muted,centered);
  else if(!r.totals.planned)text((left+right)/2,top+100,'No planned submissions in these three months',20,colors.muted,centered);
  }
  drawChart(416);
  const overdue=el('div',undefined,'ssOverdueStrip');
  const backlog=addButton(overdue,'Earlier backlog',r.backlog.count,{kind:'backlog'},'ssBacklogHit');backlog.dataset.site='*';backlog.title=`Overdue work planned before ${dateText(r.backlog.cutoff)}. Included in all overdue work.`;
  for(const [group,label] of [['all','All overdue'],['internal','Internal dispatch'],['authority','Authority submission'],['unclassified','Check dispatch']]) {const b=addButton(overdue,label,group==='all'?r.overdue.count:r.overdue[group],{kind:'overdue',group},'ssOverdueHit');b.title=`${overdueLabels[group]}. All delivered dates; each submission appears in one next-action group.`;if(group!=='all')b.style.setProperty('--accent',colors[group]);}root.append(overdue);
  const footer=el('div',undefined,'ssFooter'),scope=el('span',undefined,'ssScopeSummary');
  const mappedScopes={product:r.scopeMapped?.Product,region:r.scopeMapped?.CommercialRegion,country:r.countryEnabled};
  const active=[unit!=='*'?`BU: ${unit||'Not recorded'}`:'',...['product','region','country'].filter(key=>mappedScopes[key]&&state[key]!==undefined&&state[key]!=='*').map(key=>`${key==='region'?'Region':key[0].toUpperCase()+key.slice(1)}: ${state[key]||'Not recorded'}`)].filter(Boolean);
  const activeStates=STATE_FIELDS.filter(({role})=>r.stateMapped[role]&&r.stateFilters[role]!==null);
  if(activeStates.length)active.push(`${activeStates.length} state filters`);
  scope.textContent=`${synthetic?'ILLUSTRATIVE DATA · ':''}As of ${dateText(asOf)} (previous day) · ${sites.length} sites${active.length?' · '+active.join(' · '):' · All products, regions & countries'}`;
  scope.title=[...active, ...STATE_FIELDS.map(({role,label})=>`${label}: ${!r.stateMapped[role]?'Not mapped':r.stateFilters[role]===null?'All':r.stateFilters[role].map(stateLabel).join(', ')||'None'}`)].join('\n');footer.append(scope);
  const checks=el('div',undefined,'ssChecks'),review=el('button',`Data checks · ${r.issueCount}`);review.onclick=()=>openDetails({kind:'issues'});checks.append(review);
  for(const [key,label] of [['outsideSites','Other sites'],['outsideMonths','Outside plan/backlog'],['missingIds','Missing submission IDs']]){const b=el('button',`${label} · ${r.checks[key]}`,'ssCoverageCount');b.dataset.group=key;b.title=coverageLabels[key];b.onclick=()=>openDetails({kind:'coverage',group:key});checks.append(b);}footer.append(checks);root.append(footer);
  const help=el('details',undefined,'ssCountHelp');help.append(el('summary','How counts work'));const rules=el('div',undefined,'ssRules');
  for(const [title,body] of [
    ['Plan and submitted',`Each distinct Submission ID belongs to its planned month. The chart shows last month, this month and next month. Submitted means a valid actual submission date on or before ${dateText(asOf)}, or Submission state ${submittedStatesText}, or a linked Registration ID whose state is Approved or Conditionally Approved. No actual date is invented. Distributed means internal distribution; Rejected means rejected by the health authority after filing.`],
    ['Submitted evidence','Each Submitted record appears in one evidence group only: actual submission date first, then qualifying submission state, then registration approval. The three counts add up to Submitted for the displayed plan. Registration ID, country or dates alone do not establish completion.'],
    ['Overdue and backlog',`Date checks use ${dateText(asOf)}, the previous day. Required internal dispatch uses planned dispatch date; dispatched or not-required work uses planned submission date. Incomplete dispatch information with a past-due submission plan stays in Check dispatch data. Submitted records and Health Authority Approved ROs are excluded. Earlier backlog is planned before ${dateText(r.backlog.cutoff)}; it and overdue in the plan are subsets of All overdue, not extra counts to add.`],
    ['Scope and missing records','Filters apply to delivered Power BI records. Country uses registration country first, with the mapped fallback country when absent. A missing Submission ID remains available under Data checks and Missing submission IDs, with its RO/application IDs, but cannot count as a distinct submission. Keep earlier dates in report filters to include backlog.'],
    ['Optional mappings',`${Object.values(r.dispatchMapped).every(Boolean)?'Dispatch fields are mapped.':'Map Dispatch required, Planned dispatch date and Actual dispatch date to distinguish internal dispatch from authority submission.'} ${r.registrationMapped.RegistrationID&&r.registrationMapped.RegistrationStatus?'Registration completion evidence is enabled.':'Map both Registration ID and Registration state to use registration approval as completion evidence.'} Product and Commercial region are optional source fields; they are not inferred from registration region.`]
  ]){const item=el('div');item.append(el('h4',title),el('p',body));rules.append(item);}help.append(rules);root.append(help);
  // Give the plot the remaining viewport height without scaling down its text.
  // Small frames retain a useful plot and can scroll instead of hiding counts.
  // Re-measure after the first fit in case removing vertical overflow releases
  // the scrollbar width and changes a wrapped control/footer line.
  for(let pass=0;pass<2;pass++){
    const end=state.capture?footer:help,nonChartHeight=end.offsetTop+end.offsetHeight+(state.capture?0:10)-stage.offsetHeight,scale=svg.getBoundingClientRect().width/W;
    if(root.clientHeight&&scale)drawChart(Math.max(280,Math.min(416,(root.clientHeight-nonChartHeight-3)/scale)));
  }
  if (state.detail) renderDetails(root, r, state, onChange);
  return r;
}

function renderDetails(root, result, state, onChange) {
  const issues=state.detail.kind==='issues',isBacklog=state.detail.kind==='backlog',isOverdue=state.detail.kind==='overdue',isPlan=state.detail.kind==='plan',isCoverage=state.detail.kind==='coverage',isEvidence=state.detail.kind==='evidence',site=result.buckets.find(b=>b.key===state.detail.site);
  const month=issues||isBacklog||isOverdue||isPlan||isCoverage||isEvidence?null:site?.months.find(m=>m.key===state.detail.month);
  const planRecords=result.buckets.flatMap(b=>b.months.flatMap(m=>m.rows));
  const records=issues?[...result.issues,...result.coverage.missingIds]:isCoverage?result.coverage[state.detail.group]||[]:isEvidence?planRecords.filter(r=>r.evidenceSource===state.detail.source):isPlan?planRecords.filter(r=>matchesMetric(r,state.detail.metric)):isOverdue?result.overdue.rows.filter(r=>state.detail.group==='all'||r.overdueStage===state.detail.group):isBacklog?(state.detail.site?site?.backlog.rows||[]:result.backlog.rows):(month?.rows||[]).filter(r=>matchesMetric(r,state.detail.metric));
  const query=String(state.query||'').toLowerCase(),columnFilters=state.columnFilters||{};
  const dueFor=record=>Number.isFinite(record.overdueDate)?record.overdueDate:record.dispatchStage==='Pending internal dispatch'?(record.dispatch?.planned?.kind==='date'?record.dispatch.planned.day:null):['Awaiting authority submission','Check dispatch data'].includes(record.dispatchStage)&&record.plan?.kind==='date'?record.plan.day:null;
  const columns=[
    {key:'id',label:'Submission ID',value:r=>r.id||'Not recorded'},
    {key:'issue',label:'Issue / next action',value:r=>`${r.attention.title} ${r.attention.reason} ${r.attention.action}`},
    {key:'site',label:'Site',value:r=>r.site},
    ...(result.countryEnabled?[{key:'country',label:'Country',value:r=>r.country?.values?.join(' / ')||'Not recorded'}]:[]),
    {key:'plan',label:'Planned submission',value:r=>formatDate(r.plan),sort:r=>r.plan?.kind==='date'?r.plan.day:null},
    {key:'progress',label:issues?'Check / progress':'Progress',value:r=>`${r.status}${r.evidenceSource?' · '+(r.evidenceLabel||evidenceLabels[r.evidenceSource]):''}${r.overdue?' · Overdue':''}${issues?' · '+r.reason:''}`},
    {key:'due',label:'Due date',value:r=>Number.isFinite(r.detailDue)?dateText(r.detailDue):'—',sort:r=>r.detailDue},
    {key:'days',label:'Days overdue',value:r=>r.daysOverdue===null?'—':String(r.daysOverdue),sort:r=>r.daysOverdue}
  ];
  const overdueContext=isBacklog||isOverdue||isPlan&&state.detail.metric==='overdue';
  const detailSort=state.detailSort||{key:overdueContext?'due':'plan',direction:overdueContext?'desc':'asc'};
  const compareText=(a,b)=>String(a??'').localeCompare(String(b??''),undefined,{numeric:true,sensitivity:'base'});
  const filtered=records.map((r,i)=>{const detailDue=dueFor(r);return {...r,recordKey:r.id||`missing-row-${i}`,attention:attentionFor(r),detailDue,daysOverdue:r.overdue&&Number.isFinite(r.overdueDate)?Math.max(0,Math.floor((result.asOf-r.overdueDate)/86400000)):null};}).filter(r=>{
    const haystack=`${r.id} ${r.site} ${IDENTIFIER_FIELDS.flatMap(({role})=>r.relatedIds?.[role]||[]).join(' ')} ${(r.country?.values||[]).join(' ')} ${r.country?.source||''} ${r.reason} ${r.dispatchStage} ${r.attention.title} ${r.attention.reason} ${r.attention.action} ${STATE_FIELDS.map(f=>formatStates(r.states?.[f.role])).join(' ')} ${(r.registration?.records||[]).map(reg=>[reg.id,reg.country,reg.state,reg.rawStart,reg.rawEnd,formatDate(reg.start),formatDate(reg.end)].join(' ')).join(' ')}`.toLowerCase();
    return (!query||haystack.includes(query))&&(issues||isCoverage||!state.status||state.status==='all'||r.status===state.status)&&(issues||isCoverage||!state.dispatchStage||state.dispatchStage==='all'||r.dispatchStage===state.dispatchStage)&&(!(isOverdue||isPlan||isEvidence)||!state.detailSite||state.detailSite==='*'||siteKey(r.site)===state.detailSite)&&columns.every(column=>!columnFilters[column.key]||String(column.value(r)).toLowerCase().includes(String(columnFilters[column.key]).toLowerCase()));
  }).sort((a,b)=>{const column=columns.find(c=>c.key===detailSort.key)||columns[0],av=(column.sort||column.value)(a),bv=(column.sort||column.value)(b);if(av===null||av===undefined)return bv===null||bv===undefined?compareText(a.recordKey,b.recordKey):1;if(bv===null||bv===undefined)return -1;return (typeof av==='number'&&typeof bv==='number'?av-bv:compareText(av,bv))*(detailSort.direction==='desc'?-1:1)||compareText(a.recordKey,b.recordKey);});
  const pageSize=50,page=Math.min(Math.max(0,state.page||0),Math.max(0,Math.ceil(filtered.length/pageSize)-1));
  const section=el('section',undefined,'ssDetails');
  const heading=el('h3',issues?'Data checks':isCoverage?coverageLabels[state.detail.group]:isEvidence?`Submitted · ${evidenceLabels[state.detail.source]}`:isPlan?`Three-month plan · ${metricLabels[state.detail.metric]}`:isOverdue?overdueLabels[state.detail.group]:isBacklog?`${site?.site||(state.detail.site?state.detail.site:'All selected sites')} · Earlier overdue backlog`:`${month?.site||state.detail.site} · ${month?.label||state.detail.month}${state.detail.metric?' · '+metricLabels[state.detail.metric]:''}`);heading.tabIndex=-1;section.append(heading);
  const scopeNote=issues?'Includes missing-ID source rows, which are not counted as distinct submissions.':isCoverage?(state.detail.group==='missingIds'?'Every delivered missing-ID row is retained; use RO or application IDs to follow up.':state.detail.group==='outsideSites'?'Outside the selected sites, across all delivered dates matching your filters.':'Outside the three-month plan and earlier backlog, within the selected sites and filters.'):isEvidence?'Exclusive evidence group within the displayed plan. Actual date takes precedence, then state, then registration.':isOverdue?'All delivered dates. Internal dispatch and authority submission use their own planned dates.':isBacklog?`Planned before ${dateText(result.backlog.cutoff)} and still overdue; included in All overdue.`:`Planned-month scope: ${isPlan?result.label:month?.label||result.label}.`;
  section.append(el('p',`${scopeNote} Select an ID to copy it; expand a row for its recorded evidence.`,'ssDetailNote'));
  const controls=el('div',undefined,'ssDetailTools'),search=el('input');search.type='search';search.placeholder='Find submission';search.setAttribute('aria-label','Find submission');search.value=state.query||'';search.onchange=()=>onChange({query:search.value,page:0});controls.append(search);
  if(!issues&&!isCoverage&&!isEvidence&&!isBacklog&&!isOverdue&&(!state.detail.metric||state.detail.metric==='planned')) {
    const statuses=el('select');statuses.setAttribute('aria-label','Submission progress');for(const value of ['all','In process','Submitted','Check date']){const option=el('option',value==='all'?'All progress':value);option.value=value;statuses.append(option);}statuses.value=state.status||'all';statuses.onchange=()=>onChange({status:statuses.value,page:0});controls.append(statuses);
  }
  if(!issues&&!isCoverage){const stages=el('select');stages.setAttribute('aria-label','Dispatch stage');for(const value of ['all',...dispatchStages]){const option=el('option',value==='all'?'All dispatch stages':value);option.value=value;stages.append(option);}stages.value=state.dispatchStage||'all';stages.onchange=()=>onChange({dispatchStage:stages.value,page:0});controls.append(stages);}
  if(isOverdue||isPlan||isEvidence){const sites=el('select');sites.setAttribute('aria-label','Details site');for(const item of [{key:'*',site:'All selected sites'},...result.buckets]){const option=el('option',item.site);option.value=item.key;sites.append(option);}sites.value=state.detailSite||'*';sites.onchange=()=>onChange({detailSite:sites.value,page:0});controls.append(sites);}
  const order=el('select');order.setAttribute('aria-label','Details order');
  for(const [value,label] of [['due:desc','Newest due first'],['due:asc','Oldest due first'],['plan:asc','Earliest plan first'],['plan:desc','Latest plan first'],['id:asc','Submission ID A–Z']]){const option=el('option',label);option.value=value;order.append(option);}
  const orderValue=detailSort.key+':'+detailSort.direction;if(![...order.options].some(o=>o.value===orderValue)){const option=el('option','Sorted by '+(columns.find(c=>c.key===detailSort.key)?.label||detailSort.key));option.value=orderValue;order.append(option);}order.value=orderValue;order.onchange=()=>{const [key,direction]=order.value.split(':');onChange({detailSort:{key,direction},page:0});};controls.append(order);
  const resetTable=el('button','Reset table');resetTable.title='Clear search, column filters and sorting in Details.';resetTable.onclick=()=>onChange({query:'',status:'all',dispatchStage:'all',detailSite:'*',columnFilters:{},detailSort:null,page:0});controls.append(resetTable);
  const copy = el('button', 'Copy IDs', 'ssCopyIDs');
  const copies=[{button:copy,role:'SubID',noun:'submission',className:'ssCopyIDs',textbox:'Submission IDs to copy'},
    ...(result.identifierMapped.ROID?[{button:el('button','Copy RO IDs','ssCopyROIDs'),role:'ROID',noun:'RO',className:'ssCopyROIDs',textbox:'RO IDs to copy'}]:[]),
    ...(result.identifierMapped.AppID?[{button:el('button','Copy application IDs','ssCopyAppIDs'),role:'AppID',noun:'application',className:'ssCopyAppIDs',textbox:'Application IDs to copy'}]:[])];
  let activeCopyButton=copy;
  const copyPanel = el('div', undefined, 'ssCopyPanel'); copyPanel.hidden = true;
  const copyStatus = el('p', '', 'ssCopyStatus'); copyStatus.setAttribute('role', 'status');
  const copyText = el('textarea'); copyText.readOnly = true; copyText.spellcheck = false; copyText.rows = 5; copyText.wrap = 'off'; copyText.setAttribute('aria-label', 'Submission IDs to copy');
  const selectCopyText = () => {copyText.focus({preventScroll:true}); copyText.select();};
  const selectAll = el('button', 'Select all IDs'); selectAll.onclick = selectCopyText;
  const hideCopy = el('button', 'Hide ID list'); hideCopy.onclick = () => {copyPanel.hidden = true; activeCopyButton.focus();};
  const copyActions = el('div', undefined, 'ssCopyActions'); copyActions.append(selectAll, hideCopy);
  copyPanel.append(copyStatus, copyText, copyActions);
  for(const spec of copies){
   const matchingIds=()=>[...new Set(filtered.flatMap(record=>spec.role==='SubID'?[record.id]:record.relatedIds?.[spec.role]||[]).filter(Boolean))];
   spec.button.disabled=!matchingIds().length;
   spec.button.title=`Copy every distinct matching ${spec.noun} ID across all pages, one per line.`;
   spec.button.onclick = async () => {
    // Commit pending search/header filters before copying, including pointer clicks
    // that deliberately keep focus so a redraw cannot swallow the click.
    const pendingFilters={...columnFilters};let filterChanged=false;
    for(const input of section.querySelectorAll('.ssColumnFilter')) {
      if(input.value!==String(columnFilters[input.dataset.column]||'')){pendingFilters[input.dataset.column]=input.value;filterChanged=true;input.onchange=null;}
    }
    if (search.value !== String(state.query || '')||filterChanged) {
      search.onchange = null;
      onChange({query: search.value, columnFilters:pendingFilters, page: 0});
      root.querySelector('.'+spec.className)?.click();
      return;
    }
    const ids = matchingIds(), value = ids.join('\n');
    activeCopyButton=spec.button;copyText.setAttribute('aria-label',spec.textbox);
    copyPanel.hidden = false; copyText.value = value; selectCopyText();
    if (!ids.length) {copyStatus.textContent = `No matching ${spec.noun} IDs to copy.`; return;}
    copyStatus.textContent = `${ids.length} matching ${spec.noun} ${ids.length === 1 ? 'ID' : 'IDs'} selected across all pages. Press Ctrl+C (Cmd+C on Mac) to copy.`;
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') return;
      await navigator.clipboard.writeText(value);
      if (copyPanel.isConnected) copyStatus.textContent = `Copied ${ids.length} ${spec.noun} ${ids.length === 1 ? 'ID' : 'IDs'}, one per line. Paste with Ctrl+V (Cmd+V on Mac).`;
    } catch { /* The selected text remains available for native keyboard copying in restricted hosts. */ }
  };
  // Keep a pointer click from blurring the search box and replacing this button before it fires.
   spec.button.onmousedown = event => event.preventDefault();
   controls.append(spec.button);
  }
  const close = el('button', 'Close details', 'ssClose'); close.onclick = () => onChange({detail: null}); controls.append(close); section.append(controls, copyPanel);
  section.addEventListener('keydown', event => {if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase()==='c' || event.target===copyText && event.key.toLowerCase()==='a') && (event.target === copyText || event.target.classList?.contains('ssSubmissionId') || event.target.classList?.contains('ssRelatedId'))) event.stopPropagation();});
  if (filtered.length||Object.values(columnFilters).some(Boolean)) {
    const wrap=el('div',undefined,'ssTableWrap'),table=el('table'),head=el('thead'),header=el('tr');
    for(const column of columns) {
      const cell=el('th');cell.scope='col';cell.setAttribute('aria-sort',detailSort.key===column.key?(detailSort.direction==='desc'?'descending':'ascending'):'none');
      const sort=el('button',column.label+(detailSort.key===column.key?(detailSort.direction==='desc'?' ↓':' ↑'):''),'ssSort');sort.dataset.column=column.key;sort.title='Sort '+column.label;sort.onclick=()=>onChange({detailSort:{key:column.key,direction:detailSort.key===column.key&&detailSort.direction==='asc'?'desc':'asc'},page:0});
      const filter=el('input');filter.className='ssColumnFilter';filter.type='search';filter.dataset.column=column.key;filter.setAttribute('aria-label','Filter '+column.label);filter.placeholder='Filter';filter.value=columnFilters[column.key]||'';filter.onchange=()=>onChange({columnFilters:{...columnFilters,[column.key]:filter.value},page:0});cell.append(sort,filter);header.append(cell);
    }head.append(header);table.append(head);
    const body=el('tbody');
    const selectIdentifier=node=>{node.tabIndex=0;node.title='Select this ID, then press Ctrl+C (Cmd+C on Mac).';const select=()=>{const range=document.createRange();range.selectNodeContents(node);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);};node.onclick=select;node.onfocus=select;};
    const field=(parent,label,value,cls)=>{const item=el('div',undefined,cls);item.append(el('dt',label),el('dd',value||'Not recorded'));parent.append(item);return item;};
    filtered.slice(page*pageSize,(page+1)*pageSize).forEach(r=>{
      const row=el('tr',undefined,'ssRecordRow');row.dataset.record=r.recordKey;const expanded=(state.expandedRecords||[]).includes(r.recordKey);
      for(const column of columns) {
        const cell=el('td');cell.dataset.column=column.key;
        if(column.key==='id'){
          const line=el('div',undefined,'ssRecordIdentity'),toggle=el('button',expanded?'−':'+','ssExpandRecord');toggle.dataset.record=r.recordKey;toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label',`${expanded?'Collapse':'Expand'} evidence for ${r.id||'source row without a submission ID'}`);toggle.onclick=()=>{const old=wrap.scrollTop;onChange({expandedRecords:expanded?(state.expandedRecords||[]).filter(key=>key!==r.recordKey):[...(state.expandedRecords||[]),r.recordKey]});const current=root.querySelector('.ssTableWrap');if(current)current.scrollTop=old;};
          const id=el('span',r.id||'Not recorded','ssSubmissionId');if(r.id)selectIdentifier(id);line.append(toggle,id);cell.append(line);
        }else if(column.key==='issue'){
          cell.className='ssAttention';cell.dataset.tone=r.attention.tone;cell.dataset.attention=r.attention.key;cell.title=`${r.attention.reason}\nNext action: ${r.attention.action}`;cell.append(el('strong',r.attention.title,'ssAttentionBadge'),el('span',r.attention.action,'ssAttentionAction'));
        }else if(column.key==='country'){cell.className='ssCountry';cell.textContent=column.value(r);cell.title=r.country?.source||'Country not recorded';}
        else if(column.key==='progress'){cell.append(el('strong',r.status,'ssStatus'));if(r.evidenceSource)cell.append(el('small',r.evidenceLabel||evidenceLabels[r.evidenceSource]));if(r.overdue)cell.append(el('small','Overdue'));if(issues){cell.title=r.reason;cell.append(el('small',r.reason,'ssCheckReason'));}}
        else cell.textContent=column.value(r);
        row.append(cell);
      }body.append(row);
      if(expanded){
        const detailRow=el('tr',undefined,'ssRecordDetail');detailRow.dataset.record=r.recordKey;const cell=el('td');cell.colSpan=columns.length;cell.append(el('h4',`${r.id||'Source row without a submission ID'} · Recorded evidence`,'ssEvidenceHeading'));
        const detail=el('div',undefined,'ssRecordGrid');
        const assessment=el('section');assessment.append(el('h4','Issue & next action'));const attention=el('div',undefined,'ssAttention');attention.dataset.tone=r.attention.tone;attention.dataset.attention=r.attention.key;attention.append(el('strong',r.attention.title,'ssAttentionBadge'),el('span',r.attention.reason,'ssAttentionReason'),el('span',`Next action: ${r.attention.action}`,'ssAttentionAction'));assessment.append(attention);
        if(r.reason)assessment.append(el('p',r.reason,'ssRecordReason'));if(r.evidenceSource)assessment.append(el('p',`Submitted evidence: ${r.evidenceLabel||evidenceLabels[r.evidenceSource]}`));detail.append(assessment);
        const progress=el('section');progress.append(el('h4','Dates & recorded states'));const dates=el('dl');field(dates,'Planned submission',formatDate(r.plan));field(dates,'Actual submission',formatDate(r.actual));for(const f of STATE_FIELDS)field(dates,f.label,formatStates(r.states?.[f.role]),'ssRecordedState');if(r.submittedStates?.length)field(dates,'Qualifying submission states',r.submittedStates.join(' / '));progress.append(dates);detail.append(progress);
        const dispatch=el('section');dispatch.append(el('h4','Dispatch & overdue'));const dispatchFields=el('dl');field(dispatchFields,'Dispatch stage',r.dispatchStage||'Check record');field(dispatchFields,'Dispatch required',requiredText(r.dispatch?.required));field(dispatchFields,'Planned dispatch',formatDate(r.dispatch?.planned));field(dispatchFields,'Actual dispatch',formatDate(r.dispatch?.actual));field(dispatchFields,'Overdue basis',r.overdue?`${overdueLabels[r.overdueStage]} · Due ${dateText(r.overdueDate)} · ${r.daysOverdue} ${r.daysOverdue===1?'day':'days'} overdue`:'Not overdue');field(dispatchFields,'Dispatch notes',r.dispatchNotes);dispatch.append(dispatchFields);detail.append(dispatch);
        if(result.identifiersEnabled||result.countryEnabled){
          const related=el('section',undefined,'ssRelatedRecords');related.append(el('h4','Related records & country'));
          if(result.countryEnabled){const country=el('p',undefined,'ssCountry');country.append(el('span',r.country?.values?.join(' / ')||'Not recorded'),el('small',r.country?.source||'Country not recorded'));related.append(country);}
          if(result.identifiersEnabled&&!r.relatedRecords?.length)related.append(el('p','No related IDs recorded.'));
          for(const pair of r.relatedRecords||[]){const group=el('div',undefined,'ssRelatedRecord');for(const {role,label} of IDENTIFIER_FIELDS){if(!result.identifierMapped[role])continue;const line=el('div'),value=role==='ROID'?pair.roId:pair.appId;line.append(el('span',label+': '));const identifier=el('span',value||'Not recorded',value?'ssRelatedId':undefined);identifier.dataset.role=role;if(value)selectIdentifier(identifier);line.append(identifier);group.append(line);}related.append(group);}detail.append(related);
        }
        if(result.registrationEnabled){
          const registrations=el('section',undefined,'ssRegistrations');registrations.append(el('h4','Linked registrations'));if(!r.registration?.records?.length)registrations.append(el('p','Not recorded'));
          for(const registration of r.registration?.records||[]){
            const item=el('div',undefined,'ssRegistration');item.dataset.complete=String(registration.complete);const identifier=el('strong',registration.id||(!result.registrationMapped.RegistrationID?'Registration ID not mapped':'Registration ID not recorded'),registration.id?'ssRelatedId':undefined);if(registration.id){identifier.dataset.role='RegistrationID';selectIdentifier(identifier);}item.append(identifier);
            item.append(el('span',`Country: ${registration.country||(!result.registrationMapped.RegistrationCountry?'Not mapped':'Not recorded')}`),el('span',`State: ${registration.state||(!result.registrationMapped.RegistrationStatus?'Not mapped':'Not recorded')}`));
            for(const [label,key,raw] of [['Start','start','rawStart'],['End','end','rawEnd']])item.append(el('span',`${label}: ${formatDate(registration[key])}${registration[key]?.kind==='issue'?' · '+registration[raw]:''}`));if(registration.complete)item.append(el('span','Confirms Submitted','ssRegistrationEvidence'));if(registration.notes?.length)item.append(el('span',registration.notes.join('; '),'ssRegistrationNote'));registrations.append(item);
          }detail.append(registrations);
        }
        cell.append(detail);detailRow.append(cell);body.append(detailRow);
      }
    });
    if(!filtered.length){const empty=el('tr'),cell=el('td','No matching submissions. Clear a column filter or use Reset table.');cell.colSpan=columns.length;empty.append(cell);body.append(empty);}table.append(body);wrap.append(table);section.append(wrap);
    const pagination = el('div', undefined, 'ssPager'); pagination.append(el('span', `Showing ${filtered.length?page * pageSize + 1:0}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}`));
    const prev = el('button', 'Previous'), next = el('button', 'Next'); prev.disabled = page === 0; next.disabled = (page + 1) * pageSize >= filtered.length; prev.onclick = () => onChange({page: page - 1}); next.onclick = () => onChange({page: page + 1}); pagination.append(prev, next); section.append(pagination);
  } else section.append(el('p', issues && result.checks.missingIds ? `${result.checks.missingIds} rows have no submission ID and cannot be counted. No other matching checks.` : 'No matching submissions.'));
  root.append(section);
}
