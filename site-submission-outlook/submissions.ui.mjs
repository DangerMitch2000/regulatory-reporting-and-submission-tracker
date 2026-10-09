import {summarize, DEFAULT_SITES, STATE_FIELDS, IDENTIFIER_FIELDS, SUBMITTED_STATES, normalizeSites, siteKey, formatDate, stateLabel, formatStates, attentionFor} from './submissions.logic.mjs';
const el = (tag, text, cls) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n;};
const svgEl = (tag, attrs = {}, text) => {const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n;};
const dateText = day => formatDate({kind: 'date', day});
const submittedStatesText = SUBMITTED_STATES.join(', ');
const overdueLabels = {all:'All overdue work', internal:'Internal dispatch overdue', authority:'Late authority submissions', unclassified:'Check dispatch data'};
const metricLabels = {planned:'Planned submissions',inProcess:'In process',submitted:'Submitted',review:'Check date',completion:'Submitted percentage',overdue:'Overdue within the two-month plan'};
const coverageLabels = {outsideSites:'Submissions outside selected sites',outsideMonths:'Submissions outside the month plan and backlog',missingIds:'Source rows without a submission ID'};
const matchesMetric = (record,metric) => metric==='overdue'?record.overdue:metric==='inProcess'?record.status==='In process':metric==='submitted'||metric==='completion'?record.status==='Submitted':metric==='review'?record.status==='Check date':true;
const dispatchStages = ['Pending internal dispatch', 'Awaiting authority submission', 'Check dispatch data', 'Submitted', 'RO approved', 'Check submission date'];
const requiredText = required => required?.values?.length ? required.values.join(' / ') : required?.kind === 'unmapped' ? 'Not mapped' : 'Not recorded';
const labels = {SubID: 'Submission ID', Site: 'Site (legal manufacturer)', PlannedSubmission: 'Planned submission date', ActualSubmission: 'Actual submission date'};
export function render(root, rows, options = {}) {
  const {state = {}, onChange = () => {}, missing = [], notice = '', unitMapped = true, synthetic = false, now = new Date(), highContrast = null} = options;
  const dark = state.theme === 'dark', compact = (options.width || root.clientWidth || 1280) < 900;
  root.replaceChildren(); root.className = 'siteSubmissions' + (dark ? ' dark' : '') + (state.capture ? ' capture' : ''); root.tabIndex = 0;
  root.onkeydown = e => {if (e.key === 'Escape') {onChange({capture: false, detail: null}); root.focus();}};
  if (missing.length) {
    const setup = el('section', undefined, 'ssSetup'); setup.append(el('h2', 'Site Submission Outlook'), el('p', 'Map these four fields to show this month and next month for your main six sites:'));
    const list = el('ul'); missing.forEach(role => list.append(el('li', labels[role] || role))); setup.append(list, el('p', 'Use raw date columns, not date hierarchies. Use the initial planned submission date to match the reference slide. An actual-date column may contain blanks.')); root.append(setup); return;
  }
  const sites = normalizeSites(state.sites), unit = unitMapped ? state.unit ?? '*' : '*', r = summarize(rows, {sites, unit, now, stateFilters: state.stateFilters, stateMapped: options.stateMapped, dispatchMapped: options.dispatchMapped, registrationMapped:options.registrationMapped, fallbackCountryMapped:options.fallbackCountryMapped, identifierMapped:options.identifierMapped});
  const asOf = r.today - 24 * 60 * 60 * 1000;
  function openDetails(detail) {
    onChange({detail,query:'',status:'all',dispatchStage:'all',detailSite:'*',page:0,sitesOpen:false,stateOpen:null,capture:false});
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
    if (disabled) input.title = 'Add your business-unit column to the Business unit (optional) field to enable this filter.';
    input.onchange = () => onChange({[key]: input.value, detail: null, stateOpen: null}); wrap.append(input); controls.append(wrap);
  }
  if (unitMapped) select('Business unit', state.unit ?? '*', [{value: '*', label: 'All'}, ...r.units.map(value => ({value, label: value || 'Not recorded'}))], 'unit');
  else select('Business unit', '*', [{value: '*', label: 'Map Business unit field'}], 'unit', true);
  select('Theme', state.theme || 'light', [{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}], 'theme');
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
  const W = compact ? 820 : 1280, H = compact ? 840 : 800;
  const colors = {bg: dark ? '#152133' : '#ffffff', ink: dark ? '#e7edf7' : '#17324d', muted: dark ? '#acbed3' : '#536a80',
    border: dark ? '#35455a' : '#dce6ef', panel: dark ? '#1d2d42' : '#f3f7fa', inProcess: dark ? '#479fe7' : '#176eb0', submitted: '#61cdb4', review: '#f6c66a', backlog: dark ? '#ffb783' : '#a5450a', backlogBg: dark ? '#432d23' : '#fff2e7', internal: dark ? '#c5b2ff' : '#6346a4', authority: dark ? '#ffb783' : '#a5450a', unclassified: dark ? '#acbed3' : '#536a80'};
  if (highContrast) Object.assign(colors, {bg: highContrast.background, ink: highContrast.foreground, muted: highContrast.foreground, border: highContrast.foreground, panel: highContrast.background, inProcess: highContrast.foreground, submitted: highContrast.background, review: highContrast.background, backlog: highContrast.foreground, backlogBg: highContrast.background});
  if (highContrast) for (const key of ['internal','authority','unclassified']) colors[key] = colors.ink;
  const stage = el('div', undefined, 'ssStage'), svg = svgEl('svg', {viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Submissions planned for ${r.label}: ${r.totals.planned} planned, ${r.totals.inProcess} in process, ${r.totals.submitted} submitted, ${r.totals.review} in Check date. ${r.backlog.count} overdue backlog, planned before ${dateText(r.backlog.cutoff)} and still not submitted.`});
  stage.append(svg); root.append(stage);
  svg.setAttribute('aria-label', svg.getAttribute('aria-label') + ` All overdue work: ${r.overdue.count}, including ${r.overdue.internal} internal dispatch, ${r.overdue.authority} late authority submissions and ${r.overdue.unclassified} needing dispatch checks.`);
  svg.append(svgEl('rect', {width: W, height: H, fill: colors.bg}));
  const text = (x, y, value, size = 18, fill = colors.ink, extra = {}) => {const node = svgEl('text', {x, y, 'font-size': size, fill, ...extra}, value); svg.append(node); return node;};
  const bold = {'font-weight': 650}, centered = {'text-anchor': 'middle'};
  function metricHit(x,y,width,height,detail,count,label,cls='ssMetricHit') {
    const selected=JSON.stringify(state.detail)===JSON.stringify(detail);
    const hit=svgEl('rect',{x,y,width,height,rx:4,fill:'transparent',stroke:selected?colors.ink:'none','stroke-width':2,tabindex:0,role:'button',class:cls,'data-metric':detail.metric||detail.kind,'data-scope':detail.kind||'month',...(detail.site?{'data-site':detail.site}:{}),...(detail.month?{'data-month':detail.month}:{}),'aria-label':`${label}: ${count}. View matching details.`});
    hit.append(svgEl('title',{},`${label}: ${count}\nClick to view the matching records and copy their submission IDs.`));
    hit.onclick=()=>openDetails(detail);hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openDetails(detail);}};svg.append(hit);return hit;
  }
  function clickableText(node,detail,count,label) {
    const b=node.getBBox();metricHit(b.x-4,b.y-3,b.width+8,b.height+6,detail,count,label);return node;
  }
  function backlogHit(x, y, width, height, site = null) {
    const count = site ? site.backlog.count : r.backlog.count, scope = site ? site.site : 'All selected sites';
    const selected = state.detail?.kind === 'backlog' && (state.detail.site || '*') === (site?.key || '*');
    const hit = svgEl('rect', {x, y, width, height, rx: 7, fill: 'transparent', stroke: selected ? colors.backlog : 'none', 'stroke-width': 2, tabindex: 0, role: 'button', class: 'ssBacklogHit', 'data-site': site?.key || '*', 'aria-label': `${scope}: ${count} overdue backlog. Planned before ${dateText(r.backlog.cutoff)} and the next action is overdue. Excludes Submission states ${submittedStatesText}, or RO state Health Authority Approved. View submissions.`});
    hit.append(svgEl('title', {}, `${scope} · Overdue backlog: ${count}\nPlanned before ${dateText(r.backlog.cutoff)} and the next action is overdue.\nExcludes Submission states ${submittedStatesText}, or RO state Health Authority Approved, using mapped states.\nCounted separately from the two-month plan. Click to view oldest first.`));
    const activate = () => openDetails({kind: 'backlog', ...(site ? {site: site.key} : {})});
    hit.onclick = activate; hit.onkeydown = e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); activate();}}; svg.append(hit);
  }
  text(34, 48, 'Site Submission Outlook', compact ? 29 : 32, colors.ink, bold);
  text(35, 82, `${r.label} · Planned-month progress`, compact ? 19 : 21, colors.muted);
  if (!compact) text(1238, 45, 'CURRENT + NEXT MONTH', 15, colors.muted, {'text-anchor': 'end', 'letter-spacing': 1});
  const legend = [['inProcess', 'In process'], ['submitted', 'Submitted'], ...(r.totals.review ? [['review', 'Check date']] : [])];
  legend.forEach(([key, label], i) => {const x = 36 + i * 177; svg.append(svgEl('rect', {x, y: 106, width: 15, height: 15, rx: 3, fill: colors[key], stroke: highContrast ? colors.ink : 'none'})); text(x + 24, 120, label, 17);});
  if (compact) {
    [['Planned', r.totals.planned,'planned'], ['In process', r.totals.inProcess,'inProcess'], ['Submitted', r.totals.submitted,'submitted']].forEach(([label, value,metric], i) => {
      const x = 36 + i * 259; svg.append(svgEl('rect', {x, y: 143, width: 239, height: 75, rx: 9, fill: colors.panel})); text(x + 15, 169, label, 16, colors.muted); text(x + 15, 201, String(value), 29, colors.ink, bold);
      metricHit(x,143,239,75,{kind:'plan',metric},value,`Two-month plan · ${label}`);
    });
  }
  const left = compact ? 57 : 72, right = compact ? W - 22 : 966, bottom = compact ? 554 : 548, top = compact ? 266 : 197, chartHeight = bottom - top;
  const ticks = Array.from({length: Math.floor(r.axisMax / r.step) + 1}, (_, i) => i * r.step);
  ticks.forEach(tick => {const y = bottom - tick / r.axisMax * chartHeight; svg.append(svgEl('line', {x1: left, x2: right, y1: y, y2: y, stroke: colors.border, 'stroke-width': tick ? 1 : 1.5})); text(left - 13, y + 6, String(tick), 16, colors.muted, {'text-anchor': 'end'});});
  text(left, top - 29, 'Submissions', 15, colors.muted);
  const groupWidth = (right - left) / Math.max(sites.length, 1), barWidth = Math.min(compact ? 40 : 45, groupWidth * .29), barGap = 11;
  r.buckets.forEach((site, i) => {
    const cx = left + groupWidth * (i + .5), start = cx - barWidth - barGap / 2;
    if (i) svg.append(svgEl('line', {x1: left + groupWidth * i, x2: left + groupWidth * i, y1: bottom + 20, y2: bottom + 65, stroke: colors.border}));
    site.months.forEach((month, mi) => {
      const x = start + mi * (barWidth + barGap), segments=[]; let y = bottom;
      [['inProcess', month.inProcess], ['submitted', month.submitted], ['review', month.review]].forEach(([key, count]) => {
        const height = count / r.axisMax * chartHeight; y -= height;
        if (count) svg.append(svgEl('rect', {x, y, width: barWidth, height, fill: colors[key], stroke: highContrast ? colors.ink : 'none', 'stroke-width': 2}));
        if (height >= 25) text(x + barWidth / 2, y + height / 2 + 6, String(count), 18, highContrast ? (key === 'inProcess' ? colors.bg : colors.ink) : key === 'inProcess' ? (dark ? '#10253b' : '#ffffff') : '#173a35', {...centered, ...bold});
        if(count)segments.push({key,count,y,height});
      });
      text(x + barWidth / 2, y - 11, String(month.planned), 20, colors.ink, {...centered, ...bold});
      text(x + barWidth / 2, bottom + 31, month.short, 17, colors.muted, centered);
      const isSelected = state.detail?.site === site.key && state.detail?.month === month.key;
      const hit = svgEl('rect', {x: x - 5, y: y - 32, width: barWidth + 10, height: 28, rx:4, fill: 'transparent', stroke: isSelected && !state.detail?.metric ? colors.ink : 'none', 'stroke-width': 2,
        tabindex: 0, role: 'button', class: 'ssHit', 'data-site': site.key, 'data-month': month.key, 'aria-label': `${site.site}, ${month.label}: ${month.planned} planned, ${month.inProcess} in process, ${month.submitted} submitted${month.review ? `, ${month.review} check date` : ''}. View submissions.`});
      hit.append(svgEl('title', {}, `${site.site} · ${month.label}\nPlanned: ${month.planned}\nIn process: ${month.inProcess}\nPending internal dispatch: ${month.rows.filter(r=>r.dispatchStage==='Pending internal dispatch').length}\nAwaiting authority submission: ${month.rows.filter(r=>r.dispatchStage==='Awaiting authority submission').length}\nSubmitted: ${month.submitted}\nOverdue and still in process: ${month.overdue}${month.review ? `\nCheck actual date: ${month.review}` : ''}\nGrouped by planned submission month. Submitted may have occurred in another month.\nClick to view the submissions.`));
      const activate = () => openDetails({site: site.key, month: month.key}); hit.onclick = activate;
      hit.onkeydown = e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); activate();}}; svg.append(hit);
      segments.forEach(segment=>metricHit(x,segment.y,barWidth,segment.height,{site:site.key,month:month.key,metric:segment.key},segment.count,`${site.site} · ${month.label} · ${metricLabels[segment.key]}`,'ssSegmentHit'));
    });
    text(cx, bottom + 64, site.site.length > 12 ? `${site.site.slice(0, 11)}…` : site.site, 20, colors.ink, {...centered, ...bold}).append(svgEl('title', {}, site.site));
    const width = Math.min(groupWidth - 12, 144), x = cx - width / 2, y = bottom + 114;
    svg.append(svgEl('rect', {x, y, width, height: 42, rx: 7, fill: colors.backlogBg, stroke: highContrast ? colors.ink : 'none'}));
    text(cx, y + 29, String(site.backlog.count), 24, colors.backlog, {...centered, ...bold});
    backlogHit(x, y, width, 42, site);
  });
  text(left, bottom + 100, 'Overdue backlog', 18, colors.backlog, bold);
  text(left + 163, bottom + 100, `Planned before ${dateText(r.backlog.cutoff)}`, 15, colors.muted);
  if (compact) {
    const x = right - 148, y = bottom + 77;
    svg.append(svgEl('rect', {x, y, width: 148, height: 31, rx: 6, fill: colors.backlogBg}));
    text(x + 74, y + 22, `Total: ${r.backlog.count}`, 18, colors.backlog, {...centered, ...bold}); backlogHit(x, y, 148, 31);
  }
  if (!compact) {
    const x = 1006, width = 242; svg.append(svgEl('rect', {x, y: 157, width, height: 549, rx: 13, fill: colors.panel, stroke: colors.border}));
    text(x + 20, 190, 'Two-month plan', 20, colors.ink, bold); text(x + 20, 246, String(r.totals.planned), 47, colors.ink, bold); text(x + 20, 271, 'distinct submissions', 16, colors.muted);
    metricHit(x+14,199,width-28,83,{kind:'plan',metric:'planned'},r.totals.planned,'Two-month plan · Planned submissions');
    const stat = (y, label, value,metric) => {text(x + 20, y, label, 17); text(x + width - 20, y, String(value), 21, colors.ink, {...bold, 'text-anchor': 'end'});metricHit(x+14,y-23,width-28,31,{kind:'plan',metric},value,`Two-month plan · ${label}`);};
    stat(317, 'In process', r.totals.inProcess,'inProcess'); stat(350, 'Submitted', r.totals.submitted,'submitted'); if (r.totals.review) stat(383, 'Check date', r.totals.review,'review');
    text(x + 20, 418, `${r.completion}% submitted`, 20, colors.ink, bold);
    svg.append(svgEl('rect', {x: x + 20, y: 433, width: width - 40, height: 9, rx: 4, fill: colors.border}));
    svg.append(svgEl('rect', {x: x + 20, y: 433, width: (width - 40) * r.completion / 100, height: 9, rx: 4, fill: colors.submitted}));
    metricHit(x+14,397,width-28,52,{kind:'plan',metric:'completion'},`${r.completion}% (${r.totals.submitted} of ${r.totals.planned})`,'Two-month plan · Submitted percentage');
    text(x + 20, 480, `${r.totals.overdue} overdue`, 22, colors.ink, bold); text(x + 20, 504, 'within the two-month plan', 15, colors.muted);
    metricHit(x+14,458,width-28,55,{kind:'plan',metric:'overdue'},r.totals.overdue,'Overdue within the two-month plan');
    svg.append(svgEl('rect', {x: x + 14, y: 527, width: width - 28, height: 97, rx: 8, fill: colors.backlogBg, stroke: highContrast ? colors.ink : 'none'}));
    text(x + 26, 552, 'Overdue backlog', 18, colors.backlog, bold); text(x + 26, 589, String(r.backlog.count), 31, colors.backlog, bold);
    text(x + 26, 611, `Before ${dateText(r.backlog.cutoff)}`, 14, colors.backlog); backlogHit(x + 14, 527, width - 28, 97);
    text(x + 20, 655, `As of ${dateText(asOf)}`, 15, colors.muted); text(x + 20, 683, 'Click counts for details', 15, colors.muted);
  }
  if (!sites.length) text((left + right) / 2, top + 100, 'Choose up to six sites to start.', 22, colors.muted, centered);
  else if (!r.totals.planned) text((left + right) / 2, top + 110, 'No planned submissions in these two months', 21, colors.muted, centered);
  // One mutually exclusive next-action group per ID, including due dispatches whose
  // submission month is later than the chart. Historical backlog above is a subset.
  text(35, 748, 'Overdue by next action', 23, colors.ink, bold);
  text(35, 776, 'All delivered dates · Includes the backlog above · Each submission counted once', compact ? 15 : 17, colors.muted);
  function overdueHit(x,y,width,height,group,count) {
    const hit=svgEl('rect',{x,y,width,height,rx:8,fill:'transparent',stroke:state.detail?.kind==='overdue'&&state.detail.group===group?colors.ink:'none','stroke-width':2,tabindex:0,role:'button',class:'ssOverdueHit','data-group':group,'aria-label':`${overdueLabels[group]}: ${count}. View submissions.`});
    hit.append(svgEl('title',{},`${overdueLabels[group]}: ${count}\nInternal dispatch uses its planned dispatch date. Authority submission uses its planned submission date.\nUnknown dispatch stages with a past-due submission plan remain in Check dispatch data.\nSubmitted records and Health Authority Approved ROs are excluded.`));
    const activate=()=>openDetails({kind:'overdue',group});hit.onclick=activate;hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};svg.append(hit);
  }
  const totalWidth=compact?174:208;
  text(W-35,748,`Total overdue: ${r.overdue.count}`,compact?19:22,colors.ink,{...bold,'text-anchor':'end'});overdueHit(W-35-totalWidth,724,totalWidth,34,'all',r.overdue.count);
  const gap=16, cardWidth=(W-70-2*gap)/3;
  [['internal','Internal dispatch','Past planned dispatch date'],['authority','Authority submission','Past planned submission date'],['unclassified','Check dispatch data','Submission plan is past due']].forEach(([key,label,caption],i)=>{
    const x=35+i*(cardWidth+gap),y=796;
    svg.append(svgEl('rect',{x,y,width:cardWidth,height:108,rx:9,fill:colors.panel,stroke:colors.border}));
    svg.append(svgEl('rect',{x,y:y+12,width:4,height:84,rx:2,fill:colors[key]}));
    text(x+16,y+27,label,compact?17:20,colors[key],bold);text(x+16,y+65,String(r.overdue[key]),32,colors[key],bold);text(x+16,y+91,caption,compact?13:15,colors.muted);
    overdueHit(x,y,cardWidth,108,key,r.overdue[key]);
  });
  let footerY = 936;
  function footer(value, size = 14, attrs = {}) {
    let line = '', node = text(35, footerY, '', size, colors.muted, attrs);
    for (const word of value.split(' ')) {
      const candidate = line ? line + ' ' + word : word; node.textContent = candidate;
      if (node.getComputedTextLength() > W - 70 && line) {node.textContent = line; footerY += 18; line = word; node = text(35, footerY, line, size, colors.muted, attrs);} else line = candidate;
    }
    footerY += 23;
  }
  footer(`${synthetic ? 'ILLUSTRATIVE DATA · ' : ''}${sites.length} sites · ${unit === '*' ? 'All business units' : unit || 'Not recorded'}`, 15);
  footer(`Submitted: actual date on/before today or Submission state ${submittedStatesText}.`);
  if(r.registrationEnabled)footer('Also Submitted: a linked Registration ID with state Approved or Conditionally Approved.');
  if(r.registrationEnabled&&(!r.registrationMapped.RegistrationID||!r.registrationMapped.RegistrationStatus))footer('Map both Registration ID and Registration state to use registration approval as completion evidence.');
  footer('Backlog excludes Submitted records and Health Authority Approved ROs.');
  footer('Overdue: required internal dispatch uses its planned dispatch date; dispatched/not-required items use their planned submission date.');
  if (!Object.values(r.dispatchMapped).every(Boolean)) footer('Map Dispatch required, Planned dispatch date and Actual dispatch date to classify internal dispatch separately.');
  if (r.issueCount) {clickableText(text(35,footerY,`${r.issueCount} data checks — click for details.`,14,colors.muted),{kind:'issues'},r.issueCount,'Data checks');footerY+=23;}
  if (compact) {
    const completion=clickableText(text(35,footerY,`${r.completion}% submitted`,15,colors.muted),{kind:'plan',metric:'completion'},`${r.completion}% (${r.totals.submitted} of ${r.totals.planned})`,'Two-month plan · Submitted percentage');
    const overdue=clickableText(text(55+completion.getBBox().width,footerY,`${r.totals.overdue} overdue in the two-month plan`,15,colors.muted),{kind:'plan',metric:'overdue'},r.totals.overdue,'Overdue within the two-month plan');
    const end=overdue.getBBox().x+overdue.getBBox().width;
    if(end+185>W-35)footerY+=23;
    text(end+185>W-35?35:end+20,footerY,`As of ${dateText(asOf)}`,15,colors.muted);footerY+=23;
  }
  const filterText = STATE_FIELDS.map(({role,label})=>`${label}: ${!r.stateMapped[role]?'Not mapped':r.stateFilters[role]===null?'All':r.stateFilters[role].length?r.stateFilters[role].map(stateLabel).join(', '):'None'}`).join(' · ');
  footer(filterText, 13, {'data-state-scope':'true'});
  const finalHeight=Math.max(H,footerY);svg.setAttribute('viewBox',`0 0 ${W} ${finalHeight}`);svg.firstElementChild.setAttribute('height',String(finalHeight));
  const checks = el('div', undefined, 'ssChecks'), review = el('button', `Data checks · ${r.issueCount}`);
  review.onclick = () => openDetails({kind:'issues'});checks.append(review);
  for(const key of ['outsideSites','outsideMonths','missingIds']) {
    const button=el('button',`${r.checks[key]} ${coverageLabels[key].toLowerCase()}`,'ssCoverageCount');button.dataset.group=key;button.onclick=()=>openDetails({kind:'coverage',group:key});checks.append(button);
  }
  root.append(checks);
  if (state.detail) renderDetails(root, r, state, onChange);
  return r;
}

function renderDetails(root, result, state, onChange) {
  const issues = state.detail.kind === 'issues', isBacklog = state.detail.kind === 'backlog', isOverdue=state.detail.kind==='overdue', isPlan=state.detail.kind==='plan', isCoverage=state.detail.kind==='coverage', site = result.buckets.find(b => b.key === state.detail.site);
  const month = issues || isBacklog || isOverdue || isPlan || isCoverage ? null : site?.months.find(m => m.key === state.detail.month);
  const records = issues ? [...result.issues,...result.coverage.missingIds] : isCoverage ? result.coverage[state.detail.group] || [] : isPlan ? result.buckets.flatMap(b=>b.months.flatMap(m=>m.rows)).filter(r=>matchesMetric(r,state.detail.metric)).sort((a,b)=>(state.detail.metric==='overdue'?a.overdueDate-b.overdueDate:a.plan.day-b.plan.day)||a.id.localeCompare(b.id,undefined,{numeric:true})) : isOverdue ? result.overdue.rows.filter(r=>state.detail.group==='all'||r.overdueStage===state.detail.group) : isBacklog ? (state.detail.site ? site?.backlog.rows || [] : result.backlog.rows) : (month?.rows || []).filter(r=>matchesMetric(r,state.detail.metric)), query = String(state.query || '').toLowerCase();
  const filtered = records.map(r=>({...r,attention:attentionFor(r)})).filter(r => (!query || `${r.id} ${r.site} ${IDENTIFIER_FIELDS.flatMap(({role})=>r.relatedIds?.[role]||[]).join(' ')} ${(r.country?.values||[]).join(' ')} ${r.country?.source||''} ${r.reason} ${r.dispatchStage} ${r.attention.title} ${r.attention.reason} ${r.attention.action} ${STATE_FIELDS.map(f=>formatStates(r.states?.[f.role])).join(' ')} ${(r.registration?.records||[]).map(reg=>[reg.id,reg.country,reg.state,reg.rawStart,reg.rawEnd,formatDate(reg.start),formatDate(reg.end)].join(' ')).join(' ')}`.toLowerCase().includes(query)) && (issues || isCoverage || !state.status || state.status === 'all' || r.status === state.status) && (issues || isCoverage || !state.dispatchStage || state.dispatchStage==='all'||r.dispatchStage===state.dispatchStage) && (!(isOverdue||isPlan)||!state.detailSite||state.detailSite==='*'||siteKey(r.site)===state.detailSite));
  const pageSize = 50, page = Math.min(Math.max(0, state.page || 0), Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const section = el('section', undefined, 'ssDetails');
  const heading=el('h3', issues ? 'Data checks' : isCoverage ? coverageLabels[state.detail.group] : isPlan ? `Two-month plan · ${metricLabels[state.detail.metric]}` : isOverdue ? overdueLabels[state.detail.group] : isBacklog ? `${site?.site || (state.detail.site ? state.detail.site : 'All selected sites')} · Overdue backlog` : `${month?.site || state.detail.site} · ${month?.label || state.detail.month}${state.detail.metric?' · '+metricLabels[state.detail.metric]:''}`);heading.tabIndex=-1;section.append(heading);
  if (issues) section.append(el('p', `Checks respect the selected business unit and lifecycle states. Site checks cover all delivered sites; date checks cover selected sites across all dates. Source rows without a submission ID are also listed, but cannot be counted as distinct submissions. Recorded RO and application IDs can be copied separately. Submission states ${submittedStatesText} still count as Submitted; recorded date problems remain here for review.`));
  else if(isCoverage) section.append(el('p',state.detail.group==='missingIds'?'These are delivered source rows without a submission ID, respecting business-unit and state filters. Every delivered row is retained, including repeated rows, across all sites and dates. They are not counted as distinct submissions. Use the related RO/application IDs for follow-up, search or copying. No replacement Submission ID is invented.':state.detail.group==='outsideSites'?'These distinct submissions match the business-unit and state filters but belong to sites outside your selection. Their records are shown here without changing the six-site chart totals.':'These distinct submissions match your selected sites, business unit and states but sit outside the two-month submission plan and earlier-plan backlog. They may already be submitted or have later plans. An overdue internal dispatch for a later plan may still appear in All overdue work.'));
  else if(isPlan) {
    section.append(el('p',`Only submissions planned for ${result.label}, within your selected sites, business unit and lifecycle states. ${state.detail.metric==='overdue'?'This list contains only overdue records from those two planned months, using the dispatch/submission due-date rules. Earlier backlog and later submission plans are excluded.':state.detail.metric==='completion'?`${result.totals.submitted} of ${result.totals.planned} planned submissions are Submitted (${result.completion}%). This list shows the Submitted records behind that percentage.`:state.detail.metric==='planned'?'All records in the two monthly columns are included.':`Only records counted as ${metricLabels[state.detail.metric]} are included.`}`));
  }
  else if (isOverdue) section.append(el('p','All delivered dates, oldest due date first, including earlier plans and dispatches due ahead of a later submission month. Internal dispatch is overdue after its planned dispatch date. Once dispatched, or when dispatch is not required, authority submission is overdue after its planned submission date. Past-due submission plans with incomplete dispatch information stay in Check dispatch data. Each ID counts once; Submitted records and Health Authority Approved ROs are excluded.'));
  else if (isBacklog) section.append(el('p', `Submission planned before ${dateText(result.backlog.cutoff)} and its next action is overdue, oldest submission plan first. Required internal dispatch uses its planned dispatch date; authority submission uses its planned submission date. Unknown dispatch stages with past-due submission plans remain included for review. Submission states ${submittedStatesText}, or RO state Health Authority Approved, exclude a record from backlog. Any one is sufficient, using all delivered values from the mapped fields. These records are separate from the two-month plan and included in All overdue work. Only records delivered by Power BI can appear; keep earlier dates in report filters.`));
  else section.append(el('p', `These submissions belong to the selected planned month. Submitted means a valid actual submission date on or before today, or Submission state ${submittedStatesText}. These states can establish progress without an actual date; no date is invented. Rejected means filed and rejected by the health authority, not approved. Distributed means internal distribution and does not establish Submitted by itself.`));
  section.append(el('p','Recorded submission, RO and application states are shown alongside progress. Click a submission ID to select it, then press Ctrl+C (Cmd+C on Mac). Copy IDs includes all matching submission IDs across every page, one per line. Copy RO IDs and Copy application IDs provide separate lists when those fields are mapped.'));
  section.append(el('p','Main issue / next action highlights the clearest signal from recorded dates and states. Missing or conflicting evidence is marked for review.'));
  if(result.registrationEnabled)section.append(el('p','A Registration ID with state Approved or Conditionally Approved, linked through this submission’s RO, also establishes Submitted and excludes overdue work. ID, country or dates alone do not establish completion. Registration dates describe the registration; they do not replace the actual submission date. Other registration states are retained as recorded.'));
  const controls = el('div', undefined, 'ssDetailTools'), search = el('input'); search.placeholder = 'Find submission'; search.setAttribute('aria-label', 'Find submission'); search.value = state.query || '';
  search.onchange = () => onChange({query: search.value, page: 0}); controls.append(search);
  if (!issues && !isCoverage && !isBacklog && !isOverdue && (!state.detail.metric||state.detail.metric==='planned')) {
    const statuses = el('select'); statuses.setAttribute('aria-label', 'Submission progress');
    ['all', 'In process', 'Submitted', 'Check date'].forEach(s => {const o = el('option', s === 'all' ? 'All progress' : s); o.value = s; statuses.append(o);}); statuses.value = state.status || 'all'; statuses.onchange = () => onChange({status: statuses.value, page: 0}); controls.append(statuses);
  }
  if (!issues && !isCoverage) {
    const stages=el('select');stages.setAttribute('aria-label','Dispatch stage');
    ['all',...dispatchStages].forEach(s=>{const o=el('option',s==='all'?'All dispatch stages':s);o.value=s;stages.append(o);});stages.value=state.dispatchStage||'all';stages.onchange=()=>onChange({dispatchStage:stages.value,page:0});controls.append(stages);
  }
  if (isOverdue||isPlan) {
    const sites=el('select');sites.setAttribute('aria-label','Details site');
    [{key:'*',site:'All selected sites'},...result.buckets].forEach(s=>{const o=el('option',s.site);o.value=s.key;sites.append(o);});sites.value=state.detailSite||'*';sites.onchange=()=>onChange({detailSite:sites.value,page:0});controls.append(sites);
  }
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
    // Commit a just-typed search before copying so the table and the copied list agree.
    if (search.value !== String(state.query || '')) {
      search.onchange = null;
      onChange({query: search.value, page: 0});
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
  if (filtered.length) {
    const wrap = el('div', undefined, 'ssTableWrap'), table = el('table'), head = el('thead'), header = el('tr');
    ['Submission ID', 'Main issue / next action', ...(result.identifiersEnabled?['Related records']:[]), 'Site', 'Planned submission', 'Actual submission', issues ? 'Check' : 'Progress', ...STATE_FIELDS.map(f=>f.label), 'Dispatch stage', 'Dispatch required', 'Planned dispatch', 'Actual dispatch', 'Overdue basis / dispatch notes', ...(result.countryEnabled?['Country']:[]), ...(result.registrationEnabled?['Linked registrations']:[])].forEach(label => header.append(el('th', label))); head.append(header); table.append(head);
    const body = el('tbody'); filtered.slice(page * pageSize, (page + 1) * pageSize).forEach(r => {const row = el('tr'); [r.id, r.site, formatDate(r.plan), formatDate(r.actual), issues ? r.reason : r.status + (r.submittedByState ? ` · ${r.submittedStates.join(' / ')} state` : r.submittedByRegistration ? ' · Registration approval' : '') + (r.overdue ? ' · Overdue' : ''), ...STATE_FIELDS.map(f=>formatStates(r.states?.[f.role])), r.dispatchStage || 'Check record', requiredText(r.dispatch?.required), formatDate(r.dispatch?.planned), formatDate(r.dispatch?.actual), [r.overdue ? `${overdueLabels[r.overdueStage]} · Due ${dateText(r.overdueDate)}` : '',r.dispatchNotes].filter(Boolean).join('; ') || '—'].forEach((value,i) => {
      const cell = el('td', i===0&&!value?'Not recorded':value, i===0&&value?'ssSubmissionId':i>=5?'ssRecordedState':undefined);
      if (i===0&&value) {
        cell.tabIndex = 0; cell.title = 'Click to select this submission ID, then press Ctrl+C (Cmd+C on Mac).';
        const selectId = () => {const range = document.createRange(); range.selectNodeContents(cell); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);};
        cell.onclick = selectId; cell.onfocus = selectId;
      }
      row.append(cell);
      if(i===0) {
        const attention=el('td',undefined,'ssAttention');attention.dataset.tone=r.attention.tone;attention.dataset.attention=r.attention.key;
        attention.append(el('strong',r.attention.title,'ssAttentionBadge'),el('span',r.attention.reason,'ssAttentionReason'),el('span',`Next action: ${r.attention.action}`,'ssAttentionAction'));row.append(attention);
        if(result.identifiersEnabled){
          const related=el('td',undefined,'ssRelatedRecords');
          if(!r.relatedRecords?.length)related.textContent='Not recorded';
          for(const pair of r.relatedRecords||[]){
            const group=el('div',undefined,'ssRelatedRecord');
            for(const {role,label} of IDENTIFIER_FIELDS){
              if(!result.identifierMapped[role])continue;
              const line=el('div'),value=role==='ROID'?pair.roId:pair.appId;line.append(el('span',label+': '));
              const identifier=el('span',value||'Not recorded',value?'ssRelatedId':undefined);identifier.dataset.role=role;
              if(value){identifier.tabIndex=0;identifier.title='Select this '+label+' and press Ctrl+C (Cmd+C on Mac).';const select=()=>{const range=document.createRange();range.selectNodeContents(identifier);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);};identifier.onclick=select;identifier.onfocus=select;}
              line.append(identifier);group.append(line);
            }
            related.append(group);
          }
          row.append(related);
        }
      }
    });
      if(result.countryEnabled){const cell=el('td',undefined,'ssCountry');cell.append(el('span',r.country?.values?.length?r.country.values.join(' / '):'Not recorded'));if(r.country?.values?.length)cell.append(el('small',r.country.source));row.append(cell);}
      if(result.registrationEnabled){
        const cell=el('td',undefined,'ssRegistrations'), registrations=r.registration?.records||[];
        if(!registrations.length)cell.textContent='Not recorded';
        for(const registration of registrations){
          const item=el('div',undefined,'ssRegistration');item.dataset.complete=String(registration.complete);
          item.append(el('strong',registration.id||(!result.registrationMapped.RegistrationID?'Registration ID not mapped':'Registration ID not recorded')));
          item.append(el('span',`Country: ${registration.country||(!result.registrationMapped.RegistrationCountry?'Not mapped':'Not recorded')}`));
          item.append(el('span',`State: ${registration.state||(!result.registrationMapped.RegistrationStatus?'Not mapped':'Not recorded')}`));
          for(const [label,key,raw] of [['Start','start','rawStart'],['End','end','rawEnd']])item.append(el('span',`${label}: ${formatDate(registration[key])}${registration[key].kind==='issue'?' · '+registration[raw]:''}`));
          if(registration.complete)item.append(el('span','Confirms Submitted','ssRegistrationEvidence'));
          if(registration.notes.length)item.append(el('span',registration.notes.join('; '),'ssRegistrationNote'));
          cell.append(item);
        }
        row.append(cell);
      }
      body.append(row);}); table.append(body); wrap.append(table); section.append(wrap);
    const pagination = el('div', undefined, 'ssPager'); pagination.append(el('span', `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}`));
    const prev = el('button', 'Previous'), next = el('button', 'Next'); prev.disabled = page === 0; next.disabled = (page + 1) * pageSize >= filtered.length; prev.onclick = () => onChange({page: page - 1}); next.onclick = () => onChange({page: page + 1}); pagination.append(prev, next); section.append(pagination);
  } else section.append(el('p', issues && result.checks.missingIds ? `${result.checks.missingIds} rows have no submission ID and cannot be counted. No other matching checks.` : 'No matching submissions.'));
  root.append(section);
}
