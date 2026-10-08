import {summarize, DEFAULT_SITES, STATE_FIELDS, SUBMITTED_STATES, normalizeSites, siteKey, formatDate, stateLabel, formatStates} from './submissions.logic.mjs';
const el = (tag, text, cls) => {const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n;};
const svgEl = (tag, attrs = {}, text) => {const n = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k,v] of Object.entries(attrs)) n.setAttribute(k, String(v)); if (text !== undefined) n.textContent = text; return n;};
const dateText = day => formatDate({kind: 'date', day});
const submittedStatesText = SUBMITTED_STATES.join(', ');
const overdueLabels = {all:'All overdue work', internal:'Internal dispatch overdue', authority:'Late authority submissions', unclassified:'Check dispatch data'};
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
  const sites = normalizeSites(state.sites), unit = unitMapped ? state.unit ?? '*' : '*', r = summarize(rows, {sites, unit, now, stateFilters: state.stateFilters, stateMapped: options.stateMapped, dispatchMapped: options.dispatchMapped});
  const asOf = r.today - 24 * 60 * 60 * 1000;
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
  function backlogHit(x, y, width, height, site = null) {
    const count = site ? site.backlog.count : r.backlog.count, scope = site ? site.site : 'All selected sites';
    const selected = state.detail?.kind === 'backlog' && (state.detail.site || '*') === (site?.key || '*');
    const hit = svgEl('rect', {x, y, width, height, rx: 7, fill: 'transparent', stroke: selected ? colors.backlog : 'none', 'stroke-width': 2, tabindex: 0, role: 'button', class: 'ssBacklogHit', 'data-site': site?.key || '*', 'aria-label': `${scope}: ${count} overdue backlog. Planned before ${dateText(r.backlog.cutoff)} and the next action is overdue. Excludes Submission states ${submittedStatesText}, or RO state Health Authority Approved. View submissions.`});
    hit.append(svgEl('title', {}, `${scope} · Overdue backlog: ${count}\nPlanned before ${dateText(r.backlog.cutoff)} and the next action is overdue.\nExcludes Submission states ${submittedStatesText}, or RO state Health Authority Approved, using mapped states.\nCounted separately from the two-month plan. Click to view oldest first.`));
    const activate = () => onChange({detail: {kind: 'backlog', ...(site ? {site: site.key} : {})}, query: '', status: 'all', dispatchStage: 'all', detailSite:'*', page: 0, sitesOpen: false});
    hit.onclick = activate; hit.onkeydown = e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); activate();}}; svg.append(hit);
  }
  text(34, 48, 'Site Submission Outlook', compact ? 29 : 32, colors.ink, bold);
  text(35, 82, `${r.label} · Planned-month progress`, compact ? 19 : 21, colors.muted);
  if (!compact) text(1238, 45, 'CURRENT + NEXT MONTH', 15, colors.muted, {'text-anchor': 'end', 'letter-spacing': 1});
  const legend = [['inProcess', 'In process'], ['submitted', 'Submitted'], ...(r.totals.review ? [['review', 'Check date']] : [])];
  legend.forEach(([key, label], i) => {const x = 36 + i * 177; svg.append(svgEl('rect', {x, y: 106, width: 15, height: 15, rx: 3, fill: colors[key], stroke: highContrast ? colors.ink : 'none'})); text(x + 24, 120, label, 17);});
  if (compact) {
    [['Planned', r.totals.planned], ['In process', r.totals.inProcess], ['Submitted', r.totals.submitted]].forEach(([label, value], i) => {
      const x = 36 + i * 259; svg.append(svgEl('rect', {x, y: 143, width: 239, height: 75, rx: 9, fill: colors.panel})); text(x + 15, 169, label, 16, colors.muted); text(x + 15, 201, String(value), 29, colors.ink, bold);
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
      const x = start + mi * (barWidth + barGap); let y = bottom;
      [['inProcess', month.inProcess], ['submitted', month.submitted], ['review', month.review]].forEach(([key, count]) => {
        const height = count / r.axisMax * chartHeight; y -= height;
        if (count) svg.append(svgEl('rect', {x, y, width: barWidth, height, fill: colors[key], stroke: highContrast ? colors.ink : 'none', 'stroke-width': 2}));
        if (height >= 25) text(x + barWidth / 2, y + height / 2 + 6, String(count), 18, highContrast ? (key === 'inProcess' ? colors.bg : colors.ink) : key === 'inProcess' ? (dark ? '#10253b' : '#ffffff') : '#173a35', {...centered, ...bold});
      });
      text(x + barWidth / 2, y - 11, String(month.planned), 20, colors.ink, {...centered, ...bold});
      text(x + barWidth / 2, bottom + 31, month.short, 17, colors.muted, centered);
      const isSelected = state.detail?.site === site.key && state.detail?.month === month.key;
      const hit = svgEl('rect', {x: x - 3, y: Math.min(y - 32, bottom - 40), width: barWidth + 6, height: Math.max(bottom - y + 74, 82), fill: 'transparent', stroke: isSelected ? colors.ink : 'none', 'stroke-width': 2,
        tabindex: 0, role: 'button', class: 'ssHit', 'data-site': site.key, 'data-month': month.key, 'aria-label': `${site.site}, ${month.label}: ${month.planned} planned, ${month.inProcess} in process, ${month.submitted} submitted${month.review ? `, ${month.review} check date` : ''}. View submissions.`});
      hit.append(svgEl('title', {}, `${site.site} · ${month.label}\nPlanned: ${month.planned}\nIn process: ${month.inProcess}\nPending internal dispatch: ${month.rows.filter(r=>r.dispatchStage==='Pending internal dispatch').length}\nAwaiting authority submission: ${month.rows.filter(r=>r.dispatchStage==='Awaiting authority submission').length}\nSubmitted: ${month.submitted}\nOverdue and still in process: ${month.overdue}${month.review ? `\nCheck actual date: ${month.review}` : ''}\nGrouped by planned submission month. Submitted may have occurred in another month.\nClick to view the submissions.`));
      const activate = () => onChange({detail: {site: site.key, month: month.key}, query: '', status: 'all', dispatchStage:'all', detailSite:'*', page: 0, sitesOpen: false}); hit.onclick = activate;
      hit.onkeydown = e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); activate();}}; svg.append(hit);
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
    const stat = (y, label, value) => {text(x + 20, y, label, 17); text(x + width - 20, y, String(value), 21, colors.ink, {...bold, 'text-anchor': 'end'});};
    stat(317, 'In process', r.totals.inProcess); stat(350, 'Submitted', r.totals.submitted); if (r.totals.review) stat(383, 'Check date', r.totals.review);
    text(x + 20, 418, `${r.completion}% submitted`, 20, colors.ink, bold);
    svg.append(svgEl('rect', {x: x + 20, y: 433, width: width - 40, height: 9, rx: 4, fill: colors.border}));
    svg.append(svgEl('rect', {x: x + 20, y: 433, width: (width - 40) * r.completion / 100, height: 9, rx: 4, fill: colors.submitted}));
    text(x + 20, 480, `${r.totals.overdue} overdue`, 22, colors.ink, bold); text(x + 20, 504, 'within the two-month plan', 15, colors.muted);
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
    const activate=()=>onChange({detail:{kind:'overdue',group},query:'',status:'all',dispatchStage:'all',detailSite:'*',page:0,sitesOpen:false});hit.onclick=activate;hit.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}};svg.append(hit);
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
  footer('Backlog excludes Submitted records and Health Authority Approved ROs.');
  footer('Overdue: required internal dispatch uses its planned dispatch date; dispatched/not-required items use their planned submission date.');
  if (!Object.values(r.dispatchMapped).every(Boolean)) footer('Map Dispatch required, Planned dispatch date and Actual dispatch date to classify internal dispatch separately.');
  if (r.issueCount) footer(`${r.issueCount} data checks — review below.`);
  if (compact) footer(`${r.completion}% submitted · ${r.totals.overdue} overdue in the two-month plan · As of ${dateText(asOf)}`);
  const filterText = STATE_FIELDS.map(({role,label})=>`${label}: ${!r.stateMapped[role]?'Not mapped':r.stateFilters[role]===null?'All':r.stateFilters[role].length?r.stateFilters[role].map(stateLabel).join(', '):'None'}`).join(' · ');
  footer(filterText, 13, {'data-state-scope':'true'});
  const finalHeight=Math.max(H,footerY);svg.setAttribute('viewBox',`0 0 ${W} ${finalHeight}`);svg.firstElementChild.setAttribute('height',String(finalHeight));
  const checks = el('div', undefined, 'ssChecks'), review = el('button', `Data checks · ${r.issueCount}`);
  review.onclick = () => onChange({detail: {kind: 'issues'}, query: '', status: 'all', dispatchStage:'all', detailSite:'*', page: 0}); checks.append(review, el('span', `${r.checks.outsideSites} submissions outside selected sites · ${r.checks.outsideMonths} outside the month plan and backlog · ${r.checks.missingIds} rows without an ID`)); root.append(checks);
  if (state.detail) renderDetails(root, r, state, onChange);
  return r;
}

function renderDetails(root, result, state, onChange) {
  const issues = state.detail.kind === 'issues', isBacklog = state.detail.kind === 'backlog', isOverdue=state.detail.kind==='overdue', site = result.buckets.find(b => b.key === state.detail.site);
  const month = issues || isBacklog || isOverdue ? null : site?.months.find(m => m.key === state.detail.month);
  const records = issues ? result.issues : isOverdue ? result.overdue.rows.filter(r=>state.detail.group==='all'||r.overdueStage===state.detail.group) : isBacklog ? (state.detail.site ? site?.backlog.rows || [] : result.backlog.rows) : month?.rows || [], query = String(state.query || '').toLowerCase();
  const filtered = records.filter(r => (!query || `${r.id} ${r.site} ${r.reason} ${r.dispatchStage} ${STATE_FIELDS.map(f=>formatStates(r.states?.[f.role])).join(' ')}`.toLowerCase().includes(query)) && (issues || !state.status || state.status === 'all' || r.status === state.status) && (issues || !state.dispatchStage || state.dispatchStage==='all'||r.dispatchStage===state.dispatchStage) && (!isOverdue||!state.detailSite||state.detailSite==='*'||siteKey(r.site)===state.detailSite));
  const pageSize = 50, page = Math.min(Math.max(0, state.page || 0), Math.max(0, Math.ceil(filtered.length / pageSize) - 1));
  const section = el('section', undefined, 'ssDetails');
  section.append(el('h3', issues ? 'Data checks' : isOverdue ? overdueLabels[state.detail.group] : isBacklog ? `${site?.site || (state.detail.site ? state.detail.site : 'All selected sites')} · Overdue backlog` : `${month?.site || state.detail.site} · ${month?.label || state.detail.month}`));
  if (issues) section.append(el('p', `Checks respect the selected business unit and lifecycle states. Site checks cover all delivered sites; date checks cover selected sites across all dates. Submission states ${submittedStatesText} still count as Submitted; recorded date problems remain here for review.`));
  else if (isOverdue) section.append(el('p','All delivered dates, oldest due date first, including earlier plans and dispatches due ahead of a later submission month. Internal dispatch is overdue after its planned dispatch date. Once dispatched, or when dispatch is not required, authority submission is overdue after its planned submission date. Past-due submission plans with incomplete dispatch information stay in Check dispatch data. Each ID counts once; Submitted records and Health Authority Approved ROs are excluded.'));
  else if (isBacklog) section.append(el('p', `Submission planned before ${dateText(result.backlog.cutoff)} and its next action is overdue, oldest submission plan first. Required internal dispatch uses its planned dispatch date; authority submission uses its planned submission date. Unknown dispatch stages with past-due submission plans remain included for review. Submission states ${submittedStatesText}, or RO state Health Authority Approved, exclude a record from backlog. Any one is sufficient, using all delivered values from the mapped fields. These records are separate from the two-month plan and included in All overdue work. Only records delivered by Power BI can appear; keep earlier dates in report filters.`));
  else section.append(el('p', `These submissions belong to the selected planned month. Submitted means a valid actual submission date on or before today, or Submission state ${submittedStatesText}. These states can establish progress without an actual date; no date is invented. Rejected means filed and rejected by the health authority, not approved. Distributed means internal distribution and does not establish Submitted by itself.`));
  section.append(el('p','Recorded submission, RO and application states are shown alongside progress. Click a submission ID to select it, then press Ctrl+C (Cmd+C on Mac). Copy IDs includes all matching pages, one ID per line.'));
  const controls = el('div', undefined, 'ssDetailTools'), search = el('input'); search.placeholder = 'Find submission'; search.setAttribute('aria-label', 'Find submission'); search.value = state.query || '';
  search.onchange = () => onChange({query: search.value, page: 0}); controls.append(search);
  if (!issues && !isBacklog && !isOverdue) {
    const statuses = el('select'); statuses.setAttribute('aria-label', 'Submission progress');
    ['all', 'In process', 'Submitted', 'Check date'].forEach(s => {const o = el('option', s === 'all' ? 'All progress' : s); o.value = s; statuses.append(o);}); statuses.value = state.status || 'all'; statuses.onchange = () => onChange({status: statuses.value, page: 0}); controls.append(statuses);
  }
  if (!issues) {
    const stages=el('select');stages.setAttribute('aria-label','Dispatch stage');
    ['all',...dispatchStages].forEach(s=>{const o=el('option',s==='all'?'All dispatch stages':s);o.value=s;stages.append(o);});stages.value=state.dispatchStage||'all';stages.onchange=()=>onChange({dispatchStage:stages.value,page:0});controls.append(stages);
  }
  if (isOverdue) {
    const sites=el('select');sites.setAttribute('aria-label','Details site');
    [{key:'*',site:'All selected sites'},...result.buckets].forEach(s=>{const o=el('option',s.site);o.value=s.key;sites.append(o);});sites.value=state.detailSite||'*';sites.onchange=()=>onChange({detailSite:sites.value,page:0});controls.append(sites);
  }
  const copy = el('button', 'Copy IDs', 'ssCopyIDs'); copy.disabled = !filtered.length;
  copy.title = 'Copy every matching submission ID across all pages, one per line.';
  const copyPanel = el('div', undefined, 'ssCopyPanel'); copyPanel.hidden = true;
  const copyStatus = el('p', '', 'ssCopyStatus'); copyStatus.setAttribute('role', 'status');
  const copyText = el('textarea'); copyText.readOnly = true; copyText.spellcheck = false; copyText.rows = 5; copyText.wrap = 'off'; copyText.setAttribute('aria-label', 'Submission IDs to copy');
  const selectCopyText = () => {copyText.focus({preventScroll:true}); copyText.select();};
  const selectAll = el('button', 'Select all IDs'); selectAll.onclick = selectCopyText;
  const hideCopy = el('button', 'Hide ID list'); hideCopy.onclick = () => {copyPanel.hidden = true; copy.focus();};
  const copyActions = el('div', undefined, 'ssCopyActions'); copyActions.append(selectAll, hideCopy);
  copyPanel.append(copyStatus, copyText, copyActions);
  copy.onclick = async () => {
    // Commit a just-typed search before copying so the table and the copied list agree.
    if (search.value !== String(state.query || '')) {
      search.onchange = null;
      onChange({query: search.value, page: 0});
      root.querySelector('.ssCopyIDs')?.click();
      return;
    }
    const ids = [...new Set(filtered.map(r=>r.id).filter(Boolean))], value = ids.join('\n');
    copyPanel.hidden = false; copyText.value = value; selectCopyText();
    if (!ids.length) {copyStatus.textContent = 'No matching submission IDs to copy.'; return;}
    copyStatus.textContent = `${ids.length} matching submission ${ids.length === 1 ? 'ID' : 'IDs'} selected across all pages. Press Ctrl+C (Cmd+C on Mac) to copy.`;
    try {
      if (typeof navigator.clipboard?.writeText !== 'function') return;
      await navigator.clipboard.writeText(value);
      if (copyPanel.isConnected) copyStatus.textContent = `Copied ${ids.length} submission ${ids.length === 1 ? 'ID' : 'IDs'}, one per line. Paste with Ctrl+V (Cmd+V on Mac).`;
    } catch { /* The selected text remains available for native keyboard copying in restricted hosts. */ }
  };
  // Keep a pointer click from blurring the search box and replacing this button before it fires.
  copy.onmousedown = event => event.preventDefault();
  controls.append(copy);
  const close = el('button', 'Close details', 'ssClose'); close.onclick = () => onChange({detail: null}); controls.append(close); section.append(controls, copyPanel);
  section.addEventListener('keydown', event => {if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase()==='c' || event.target===copyText && event.key.toLowerCase()==='a') && (event.target === copyText || event.target.classList?.contains('ssSubmissionId'))) event.stopPropagation();});
  if (filtered.length) {
    const wrap = el('div', undefined, 'ssTableWrap'), table = el('table'), head = el('thead'), header = el('tr');
    ['Submission ID', 'Site', 'Planned submission', 'Actual submission', issues ? 'Check' : 'Progress', ...STATE_FIELDS.map(f=>f.label), 'Dispatch stage', 'Dispatch required', 'Planned dispatch', 'Actual dispatch', 'Overdue basis / dispatch notes'].forEach(label => header.append(el('th', label))); head.append(header); table.append(head);
    const body = el('tbody'); filtered.slice(page * pageSize, (page + 1) * pageSize).forEach(r => {const row = el('tr'); [r.id, r.site, formatDate(r.plan), formatDate(r.actual), issues ? r.reason : r.status + (r.submittedByState ? ` · ${r.submittedStates.join(' / ')} state` : '') + (r.overdue ? ' · Overdue' : ''), ...STATE_FIELDS.map(f=>formatStates(r.states?.[f.role])), r.dispatchStage || 'Check record', requiredText(r.dispatch?.required), formatDate(r.dispatch?.planned), formatDate(r.dispatch?.actual), [r.overdue ? `${overdueLabels[r.overdueStage]} · Due ${dateText(r.overdueDate)}` : '',r.dispatchNotes].filter(Boolean).join('; ') || '—'].forEach((value,i) => {
      const cell = el('td', value, i===0?'ssSubmissionId':i>=5?'ssRecordedState':undefined);
      if (i===0) {
        cell.tabIndex = 0; cell.title = 'Click to select this submission ID, then press Ctrl+C (Cmd+C on Mac).';
        const selectId = () => {const range = document.createRange(); range.selectNodeContents(cell); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);};
        cell.onclick = selectId; cell.onfocus = selectId;
      }
      row.append(cell);
    }); body.append(row);}); table.append(body); wrap.append(table); section.append(wrap);
    const pagination = el('div', undefined, 'ssPager'); pagination.append(el('span', `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, filtered.length)} of ${filtered.length}`));
    const prev = el('button', 'Previous'), next = el('button', 'Next'); prev.disabled = page === 0; next.disabled = (page + 1) * pageSize >= filtered.length; prev.onclick = () => onChange({page: page - 1}); next.onclick = () => onChange({page: page + 1}); pagination.append(prev, next); section.append(pagination);
  } else section.append(el('p', issues && result.checks.missingIds ? `${result.checks.missingIds} rows have no submission ID and cannot be counted. No other matching checks.` : 'No matching submissions.'));
  root.append(section);
}
