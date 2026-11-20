import { summarize, defaultState, DEFAULT_SITES, formatDate } from './logic.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const METRICS = { submissions: 'Submissions', approvals: 'Approvals' };
const PAGE_SIZE = 20;
const NOT_RECORDED = 'Not recorded';
const number = value => new Intl.NumberFormat('en-GB').format(value || 0);
const list = value => Array.isArray(value) ? value : value == null || value === '' ? [] : [value];
const textList = value => list(value).filter(Boolean).join(', ') || NOT_RECORDED;
const safeUrl = value => {
  try { const url = new URL(String(value)); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
};
const niceMaximum = value => {
  if (value <= 4) return 4;
  const desiredStep = value / 4;
  const power = 10 ** Math.floor(Math.log10(desiredStep));
  const multiple = [1, 2, 5, 10].find(candidate => candidate * power >= desiredStep);
  return multiple * power * 4;
};

/** All record values are written as text. The host owns persisted state and external actions. */
export function render(root, rows, options = {}) {
  const doc = root.ownerDocument;
  const node = (tag, text, className) => {
    const result = doc.createElement(tag);
    if (text !== undefined && text !== null) result.textContent = String(text);
    if (className) result.className = className;
    return result;
  };
  const svg = (tag, attrs = {}, text) => {
    const result = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, String(value));
    if (text !== undefined) result.textContent = String(text);
    return result;
  };
  const state = { ...defaultState(options.now), ...options.state };
  const result = summarize(rows, { ...state, now: options.now, mapped: options.mapped });
  const width = options.width || root.clientWidth || 1200;
  const active = doc.activeElement;
  const focused = root.contains(active) ? active?.getAttribute?.('data-focus-key') : null;
  const selection = focused && /^(INPUT|TEXTAREA)$/.test(active.tagName)
    ? { start: active.selectionStart, end: active.selectionEnd } : null;
  const rootScroll = root.scrollTop;
  const oldDetails = root.querySelector('.who-detail-scroll');
  const detailsScroll = oldDetails?.scrollTop || 0;
  const oldSitesOpen = !!root.querySelector('.who-sites')?.open;
  const oldMoreOpen = !!root.querySelector('.who-more')?.open;
  const previousDetail = root.getAttribute('data-detail');
  const detailSignature = JSON.stringify(state.detail || null);
  const change = patch => options.onChange?.(patch);
  const filterChange = patch => change({ ...patch, detail: null, detailSearch: '', page: 0 });
  const isMapped = role => result.mapped ? result.mapped[role] !== false : !options.mapped || options.mapped[role] !== false;
  const focusKey = (element, key) => { element.setAttribute('data-focus-key', key); return element; };
  const button = (text, action, className = '', aria) => {
    const item = node('button', text, className);
    item.type = 'button';
    if (aria) item.setAttribute('aria-label', aria);
    item.addEventListener('click', action);
    return item;
  };
  const choose = (metric, year, groupKey = null) => change({ ...(state.capture ? { capture: false } : {}), detail: { metric, year, groupKey }, detailSearch: '', page: 0 });

  root.replaceChildren();
  root.className = `who-activity ${state.theme === 'light' ? 'who-light' : 'who-dark'}${state.capture ? ' who-capture' : ''}${width <= 950 ? ' who-compact' : ''}${width <= 540 ? ' who-narrow' : ''}`;
  root.tabIndex = 0;
  root.setAttribute('data-detail', detailSignature);
  root.setAttribute('aria-label', 'WHO submissions and approvals');
  root.onkeydown = event => {
    if (event.key === 'Escape' && (state.capture || state.detail)) {
      event.preventDefault();
      change({ capture: false, detail: null });
    }
  };
  root.style.setProperty('--who-font-size', `${Math.max(14, Math.min(16, width / 100))}px`);
  if (options.highContrast) {
    const hc = options.highContrast;
    for (const [key, value] of Object.entries({ '--who-bg': hc.background, '--who-panel': hc.background, '--who-text': hc.foreground, '--who-muted': hc.foreground, '--who-border': hc.foreground, '--who-older': hc.foreground, '--who-newer': hc.foreground })) {
      if (typeof value === 'string') root.style.setProperty(key, value);
    }
    root.classList.add('who-high-contrast');
  } else {
    for (const key of ['--who-bg', '--who-panel', '--who-text', '--who-muted', '--who-border', '--who-older', '--who-newer']) root.style.removeProperty(key);
  }

  const header = node('header', null, 'who-header');
  const heading = node('div');
  const scopeLabel = result.scopeLabel || (state.whoValue === '@who' ? 'WHO' : state.whoValue === '*' ? 'All commercial regions' : state.whoValue || 'Commercial region not recorded');
  heading.append(node('h1', `${scopeLabel} Submissions & Approvals`));
  const years = result.years;
  const currentYear = new Date(result.asOf).getUTCFullYear();
  const yearLabel = year => `${year}${year === currentYear ? ' YTD' : ''}`;
  heading.append(node('p', `${yearLabel(years[0])} / ${yearLabel(years[1])} · Actual milestones · ${!isMapped('BusinessUnit') ? 'All delivered business units' : state.unit === '*' ? 'All business units' : state.unit}`, 'who-subtitle'));
  header.append(heading);
  const actions = node('div', null, 'who-actions');
  const captureButton = focusKey(button(state.capture ? 'Interactive mode' : 'Screenshot mode', () => change({ capture: !state.capture }), 'who-button', state.capture ? 'Return to interactive mode' : 'Use screenshot layout'), 'capture');
  captureButton.title = 'Simplifies the layout for screen capture. Power BI native PDF and PowerPoint export support is unchanged.';
  actions.append(captureButton);
  if (!state.capture) {
    const theme = focusKey(button(state.theme === 'light' ? 'Dark' : 'Light', () => change({ theme: state.theme === 'light' ? 'dark' : 'light' }), 'who-button', `Use ${state.theme === 'light' ? 'dark' : 'light'} theme`), 'theme');
    actions.append(theme);
  }
  header.append(actions);
  root.append(header);

  const notices = new Set([...(result.notices || []), ...list(options.notice)].filter(Boolean));
  if (options.missing?.length) notices.add(`Map required fields: ${options.missing.map(value => options.labels?.[value] || value).join(', ')}.`);
  if (notices.size) {
    const region = node('div', null, 'who-notices');
    region.setAttribute('role', 'status');
    region.setAttribute('data-testid', 'notices');
    for (const message of notices) region.append(node('p', message));
    root.append(region);
  }

  const choices = result.choices || {};
  const makeSelect = (parent, label, name, value, values, callback, { all = true, disabled = false, display = item => item === '' ? NOT_RECORDED : String(item), extra = [] } = {}) => {
    const wrapper = node('label', null, 'who-field');
    wrapper.append(node('span', label));
    const select = focusKey(node('select'), name);
    select.setAttribute('aria-label', label);
    select.setAttribute('data-testid', `filter-${name}`);
    if (all) {
      const option = node('option', 'All'); option.value = '*'; select.append(option);
    }
    const seen = new Set(all ? ['*'] : []);
    for (const item of [...extra, ...list(values)]) {
      const key = typeof item === 'object' ? item.key : item;
      if (seen.has(String(key))) continue;
      seen.add(String(key));
      const option = node('option', typeof item === 'object' ? item.label : display(item));
      option.value = String(key); select.append(option);
    }
    if (!seen.has(String(value))) {
      const option = node('option', `${display(value)} (not in delivered data)`); option.value = String(value); select.append(option);
    }
    select.value = String(value);
    select.disabled = disabled;
    if (disabled) select.title = `${label} field is not mapped`;
    select.addEventListener('change', () => callback(select.value));
    wrapper.append(select); parent.append(wrapper);
    return select;
  };

  if (!state.capture) {
    const filters = node('div', null, 'who-filters');
    makeSelect(filters, 'Business unit', 'unit', state.unit, choices.units, value => filterChange({ unit: value }), { disabled: !isMapped('BusinessUnit') });
    const siteField = node('div', null, 'who-field who-site-field');
    siteField.append(node('span', 'Sites'));
    const sites = node('details', null, 'who-sites'); sites.open = oldSitesOpen;
    const selectedSites = state.sites === '*' ? null : new Set(list(state.sites));
    const siteSummary = focusKey(node('summary', selectedSites === null ? 'All sites' : `${[...selectedSites].filter(Boolean).length} sites${selectedSites.has('') ? ' + unassigned' : ''}`), 'sites');
    siteSummary.setAttribute('aria-label', 'Select sites'); siteSummary.setAttribute('data-testid', 'filter-sites'); sites.append(siteSummary);
    const siteOptions = node('div', null, 'who-site-options');
    const siteCommands = node('div', null, 'who-site-commands');
    siteCommands.append(button('All', () => filterChange({ sites: '*' })), button('Clear', () => filterChange({ sites: [] })), button('Reset', () => filterChange({ sites: [...DEFAULT_SITES, ''] }), '', 'Reset to six sites and Unassigned site'));
    sites.append(siteCommands);
    const siteSearch = focusKey(node('input'), 'site-search');
    siteSearch.type = 'search'; siteSearch.placeholder = 'Find site'; siteSearch.setAttribute('aria-label', 'Find site');
    sites.append(siteSearch);
    const allSites = [...new Set([...DEFAULT_SITES, '', ...list(choices.sites), ...list(state.sites === '*' ? [] : state.sites)])];
    for (const site of allSites) {
      const option = node('label', null, 'who-site-option');
      const input = focusKey(node('input'), `site-${site}`); input.type = 'checkbox'; input.checked = selectedSites === null || selectedSites.has(site);
      input.setAttribute('aria-label', site || 'Unassigned site');
      input.addEventListener('change', () => {
        const selected = selectedSites === null ? new Set(allSites) : new Set(selectedSites);
        if (input.checked) selected.add(site); else selected.delete(site);
        filterChange({ sites: [...selected] });
      });
      option.append(input, node('span', site || 'Unassigned site')); option.dataset.search = (site || 'Unassigned site').toLowerCase(); siteOptions.append(option);
    }
    siteSearch.addEventListener('input', () => { for (const label of siteOptions.children) label.hidden = !label.dataset.search.includes(siteSearch.value.toLowerCase()); });
    sites.append(siteOptions); siteField.append(sites); filters.append(siteField);
    makeSelect(filters, 'Product', 'product', state.product, choices.products, value => filterChange({ product: value }), { disabled: !isMapped('Product') });
    makeSelect(filters, 'Commercial region', 'region', state.whoValue, list(choices.regions).filter(value => value === state.whoValue || String(value).trim().toLowerCase() !== 'who'), value => filterChange({ whoValue: value, region: '*' }), { disabled: !isMapped('CommercialRegion'), extra: [{ key: '@who', label: 'WHO' }] });
    const availableYears = [...new Set([...list(choices.years), ...years])].sort((a, b) => a - b);
    makeSelect(filters, 'Earlier year', 'older-year', years[0], availableYears.filter(value => value !== years[1]), value => filterChange({ years: [Number(value), years[1]].sort((a, b) => a - b) }), { all: false });
    makeSelect(filters, 'Later year', 'newer-year', years[1], availableYears.filter(value => value !== years[0]), value => filterChange({ years: [years[0], Number(value)].sort((a, b) => a - b) }), { all: false });
    root.append(filters);
    const more = node('details', null, 'who-more'); more.open = oldMoreOpen;
    more.append(focusKey(node('summary', 'More options'), 'more-options'));
    const moreFields = node('div', null, 'who-more-fields');
    makeSelect(moreFields, 'Submission type', 'submission-type', state.submissionType, choices.submissionTypes, value => filterChange({ submissionType: value }), { disabled: !isMapped('SubmissionType') });
    more.append(moreFields, node('p', 'WHO is identified by the Commercial region value. Blank regions are available in Data checks; they are not assumed to be WHO.', 'who-note'));
    root.append(more);
  }

  const cards = node('section', null, 'who-cards'); cards.setAttribute('aria-label', 'Milestone totals');
  years.forEach((year, yearIndex) => {
    for (const metric of ['submissions', 'approvals']) {
      const unavailable = !!result.scopeUnavailable || !!result.unavailableMetrics?.[metric];
      const count = result.totals?.[metric]?.[yearIndex] || 0;
      const card = button('', () => choose(metric, year), `who-card who-year-${yearIndex}`, `${yearLabel(year)} ${METRICS[metric]}: ${unavailable ? 'Unavailable' : number(count)}. Show records.`);
      card.setAttribute('data-testid', 'metric-card'); card.dataset.metric = metric; card.dataset.year = year;
      card.setAttribute('aria-pressed', String(state.detail?.metric === metric && state.detail?.year === year && state.detail?.groupKey == null));
      card.disabled = unavailable;
      card.append(node('span', `${yearLabel(year)} ${METRICS[metric]}`, 'who-card-label'), node('strong', unavailable ? '—' : number(count), 'who-card-value'));
      if (unavailable) card.append(node('span', result.scopeUnavailable ? 'Map required fields' : 'Map ID and actual date', 'who-note'));
      cards.append(card);
    }
  });
  root.append(cards);

  const chartTop = node('div', null, 'who-chart-top');
  const groupButtons = node('div', null, 'who-segment'); groupButtons.setAttribute('role', 'group'); groupButtons.setAttribute('aria-label', 'Group charts by');
  for (const [key, label] of [['site', 'Site'], ['region', 'Commercial region']]) {
    const item = focusKey(button(label, () => filterChange({ groupBy: key }), state.groupBy === key ? 'is-active' : ''), `group-${key}`);
    item.setAttribute('aria-pressed', String(state.groupBy === key)); groupButtons.append(item);
  }
  chartTop.append(state.capture ? node('span', state.groupBy === 'site' ? 'By site' : 'By commercial region', 'who-chart-grouping-label') : groupButtons);
  const legend = node('div', null, 'who-legend'); legend.setAttribute('aria-label', 'Year colours');
  years.forEach((year, index) => { const item = node('span', null, `who-legend-item who-year-${index}`); item.append(node('i'), doc.createTextNode(yearLabel(year))); legend.append(item); });
  chartTop.append(legend); root.append(chartTop);

  const groups = result.groups || [];
  const max = niceMaximum(Math.max(0, ...groups.flatMap(group => [...group.submissions, ...group.approvals])));
  const charts = node('section', null, 'who-charts'); charts.setAttribute('aria-label', 'Milestones by group');
  for (const metric of ['submissions', 'approvals']) {
    const panel = node('section', null, 'who-chart-panel'); panel.dataset.metric = metric;
    panel.setAttribute('data-testid', `chart-${metric}`);
    panel.append(node('h2', METRICS[metric]));
    if (result.scopeUnavailable) {
      panel.append(node('p', 'Map Commercial region and Site to identify the records in this view.', 'who-empty'));
    } else if (result.unavailableMetrics?.[metric]) {
      const empty = node('p', `Map the ${metric === 'submissions' ? 'Submission ID and Actual submission date' : `${result.approvalBasisLabel || 'approval record ID'} and Actual approval date`} fields to show this chart.`, 'who-empty');
      panel.append(empty);
    } else if (!groups.length) {
      panel.append(node('p', 'No matching actual activity in the selected years. Check the filters and Commercial region mapping.', 'who-empty'));
    } else {
      const axisRow = node('div', null, 'who-chart-axis'); axisRow.append(node('span'));
      const axis = svg('svg', { 'aria-hidden': 'true' });
      for (let tick = 0; tick <= 4; tick++) axis.append(svg('text', { x: `${1 + tick * 21}%`, y: 18, 'text-anchor': tick === 0 ? 'start' : 'middle' }, number(max * tick / 4)));
      axisRow.append(axis); panel.append(axisRow);
      const groupList = node('div', null, 'who-chart-groups');
      for (const group of groups) {
        const row = node('div', null, 'who-chart-group'); row.dataset.group = group.key; row.setAttribute('data-testid', 'chart-group');
        const label = node('span', group.label, 'who-group-label'); label.title = group.label; row.append(label);
        const graph = svg('svg', { class: 'who-bars', role: 'group', 'aria-label': `${group.label} ${METRICS[metric]}` });
        for (let tick = 0; tick <= 4; tick++) graph.append(svg('line', { x1: `${1 + tick * 21}%`, x2: `${1 + tick * 21}%`, y1: 0, y2: 58, class: 'who-gridline' }));
        years.forEach((year, index) => {
          const count = group[metric]?.[index] || 0;
          const barWidth = 84 * count / max;
          const y = index * 25 + 5;
          const bar = svg('g', { class: `who-bar who-year-${index}`, tabindex: '0', role: 'button', 'aria-label': `${group.label}, ${yearLabel(year)} ${METRICS[metric]}: ${number(count)}. Show records.`, 'data-metric': metric, 'data-year': year, 'data-group': group.key, 'data-testid': 'chart-bar', 'data-focus-key': `bar-${metric}-${year}-${group.key}` });
          bar.setAttribute('aria-pressed', String(state.detail?.metric === metric && state.detail?.year === year && state.detail?.groupKey === group.key));
          bar.append(svg('title', {}, `${group.label} · ${yearLabel(year)} · ${number(count)} ${METRICS[metric].toLowerCase()}\nSelect to review IDs and actual dates.`));
          bar.append(svg('rect', { x: '1%', y, width: '99%', height: 21, class: 'who-bar-target' }));
          if (count) bar.append(svg('rect', { x: '1%', y: y + 2, width: `${barWidth}%`, height: 17, rx: 2, class: 'who-bar-fill' }));
          bar.append(svg('text', { x: `${1 + barWidth}%`, dx: 6, y: y + 15, class: 'who-bar-value' }, number(count)));
          const selectBar = () => choose(metric, year, group.key);
          bar.addEventListener('click', selectBar);
          bar.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectBar(); } });
          graph.append(bar);
        });
        row.append(graph); groupList.append(row);
      }
      panel.append(groupList);
    }
    charts.append(panel);
  }
  root.append(charts);

  const footer = node('div', null, 'who-footer');
  const scope = node('div', null, 'who-scope');
  scope.append(node('span', `${number(result.visibleSites)} of ${result.totalDefaultSites || 6} sites with actual activity · Unassigned sites shown separately.`));
  scope.append(node('span', `Approvals: ${result.approvalBasisLabel || 'distinct ROs with actual approval dates'}.`));
  scope.append(node('span', `As of ${result.asOfLabel} · ${result.referenceSource || 'Reference date; not a source refresh timestamp'}.`));
  footer.append(scope);
  const checks = focusKey(button(`Data checks · ${number(result.issues?.length)}`, () => change({ ...(state.capture ? { capture: false } : {}), detail: { type: 'issues' }, detailSearch: '', page: 0 }), 'who-checks'), 'checks');
  checks.setAttribute('data-testid', 'data-checks'); footer.append(checks); root.append(footer);

  if (state.capture) {
    const selections = [];
    if (state.product !== '*') selections.push(`Product: ${state.product}`);
    selections.push(`Commercial region: ${scopeLabel}`);
    if (state.submissionType !== '*') selections.push(`Type: ${state.submissionType}`);
    if (state.sites !== '*') selections.push(`Selected sites: ${list(state.sites).map(site => site || 'Unassigned site').join(', ') || 'None'}`);
    if (selections.length) root.append(node('p', selections.join(' · '), 'who-capture-filters'));
  }

  if (state.detail && !state.capture) {
    const detail = state.detail;
    const isIssues = detail.type === 'issues';
    const panel = node('section', null, 'who-details'); panel.setAttribute('data-testid', 'details');
    const group = groups.find(item => item.key === detail.groupKey);
    const title = isIssues ? 'Data checks' : `${detail.year} ${METRICS[detail.metric] || 'Records'}${group ? ` · ${group.label}` : ''}`;
    const top = node('div', null, 'who-details-top'); top.append(node('h2', title));
    const detailActions = node('div', null, 'who-actions');
    const search = focusKey(node('input'), 'detail-search'); search.type = 'search'; search.value = state.detailSearch || ''; search.placeholder = 'Search IDs, products or sites'; search.setAttribute('aria-label', 'Search details');
    search.addEventListener('input', () => change({ detailSearch: search.value, page: 0 })); detailActions.append(search);
    const query = String(state.detailSearch || '').trim().toLowerCase();
    let records = isIssues ? [...(result.issues || [])] : (result.events || []).filter(event => event.metric === detail.metric && event.year === detail.year && (detail.groupKey == null || event.groupKey === detail.groupKey));
    if (query) records = records.filter(record => Object.values(record).flat().filter(value => typeof value !== 'object').join(' ').toLowerCase().includes(query));
    const sort = state.sort || { field: isIssues ? 'id' : 'date', direction: 'desc' };
    records.sort((a, b) => {
      const av = sort.field === 'date' ? (typeof a.date === 'number' ? a.date : a.date?.day || 0) : String(a[sort.field] || '');
      const bv = sort.field === 'date' ? (typeof b.date === 'number' ? b.date : b.date?.day || 0) : String(b[sort.field] || '');
      return (typeof av === 'number' ? av - bv : av.localeCompare(bv, undefined, { numeric: true })) * (sort.direction === 'asc' ? 1 : -1);
    });
    const ids = [...new Set(records.map(record => record.id).filter(Boolean))];
    const copyStatus = node('span', '', 'who-copy-status'); copyStatus.setAttribute('role', 'status');
    const copyFallback = node('textarea', ids.join('\n'), 'who-copy-fallback'); copyFallback.hidden = true; copyFallback.readOnly = true; copyFallback.setAttribute('aria-label', 'IDs to copy');
    detailActions.append(button('Copy IDs', async () => {
      try {
        if (options.onCopy) { const outcome = await options.onCopy(ids.join('\n')); if (outcome === false) throw new Error('Clipboard unavailable'); }
        else if (doc.defaultView?.navigator?.clipboard?.writeText) await doc.defaultView.navigator.clipboard.writeText(ids.join('\n'));
        else throw new Error('Clipboard unavailable');
        copyStatus.textContent = `${number(ids.length)} IDs copied`;
      } catch { copyFallback.hidden = false; copyFallback.focus(); copyFallback.select(); copyStatus.textContent = 'Select and copy the IDs below'; }
    }, 'who-button'), button('Close', () => change({ detail: null, page: 0 }), 'who-button', 'Close details'));
    top.append(detailActions); panel.append(top, copyStatus, copyFallback);
    const scroll = node('div', null, 'who-detail-scroll');
    const table = node('table', null, 'who-table');
    const head = node('thead'); const headingRow = node('tr');
    const columns = isIssues ? [['id', 'Record ID'], ['kind', 'Check'], ['metric', 'Metric'], ['message', 'Details']] : [['date', 'Actual date'], ['id', 'Record ID'], ['site', 'Site'], ['region', 'Commercial region'], [null, 'Related records'], ['products', 'Product'], ['source', 'Source'], [null, 'Platform']];
    for (const [field, label] of columns) {
      const th = node('th'); th.scope = 'col';
      if (field) {
        const selected = sort.field === field;
        th.setAttribute('aria-sort', selected ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
        th.append(focusKey(button(`${label}${selected ? sort.direction === 'asc' ? ' ↑' : ' ↓' : ''}`, () => change({ sort: { field, direction: selected && sort.direction === 'asc' ? 'desc' : 'asc' }, page: 0 }), '', `Sort by ${label}`), `sort-${field}`));
      } else th.textContent = label;
      headingRow.append(th);
    }
    head.append(headingRow); table.append(head);
    const body = node('tbody');
    const maxPage = Math.max(0, Math.ceil(records.length / PAGE_SIZE) - 1);
    const page = Math.max(0, Math.min(maxPage, state.page || 0));
    for (const record of records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)) {
      const tr = node('tr'); tr.dataset.recordId = record.id || '';
      if (isIssues) {
        for (const field of ['id', 'kind', 'metric']) tr.append(node('td', record[field] || '—'));
        const message = node('td'); message.append(node('div', record.message || '—'));
        const evidence = node('details', null, 'who-source-evidence');
        evidence.setAttribute('data-testid', 'source-evidence');
        evidence.append(node('summary', 'Source evidence'));
        const evidenceBody = node('div', null, 'who-source-fields');
        const evidenceField = (label, values, total) => {
          const all = list(values);
          const bounded = all.slice(0, 20).map(value => {
            const text = String(value ?? '');
            return text === '' ? '(blank)' : text.length > 512 ? `${text.slice(0, 512)}… (truncated)` : text;
          });
          const count = total ?? all.length;
          const line = node('p'); line.append(node('strong', `${label}: `), doc.createTextNode(bounded.join(', ') || '(blank)'));
          if (count > bounded.length) line.append(doc.createTextNode(` · ${number(count - bounded.length)} more values`));
          evidenceBody.append(line);
        };
        if (record.field || record.rawValues) {
          if (record.field) evidenceField('Source field', record.field);
          evidenceField('Raw date values', record.rawValues || [], record.rawValueCount);
        }
        for (const [label, values] of [['Submission IDs', record.subIds], ['RO IDs', record.roIds], ['Application IDs', record.appIds], ['Registration IDs', record.registrationIds]]) {
          if (list(values).length) evidenceField(label, values);
        }
        if (Object.hasOwn(record, 'rawSite')) evidenceField('Raw site', record.rawSite);
        else if (record.sites) evidenceField('Site values', record.sites);
        if (Object.hasOwn(record, 'rawCommercialRegion')) evidenceField('Raw commercial region', record.rawCommercialRegion);
        else if (record.regions) evidenceField('Commercial region values', record.regions);
        if (record.sourceRows > 1) evidenceBody.append(node('p', `${number(record.sourceRows)} delivered join rows reference these IDs; these are source rows, not ${number(record.sourceRows)} distinct records.`));
        if (evidenceBody.childNodes.length) { evidence.append(evidenceBody); message.append(evidence); }
        tr.append(message);
      } else {
        const date = formatDate(record.date);
        tr.append(node('td', date, 'who-date'), node('td', record.id, 'who-record-id'), node('td', record.site || NOT_RECORDED), node('td', record.region || NOT_RECORDED));
        const related = node('td');
        for (const [label, values] of [['App', record.appIds], ['RO', record.roIds], ['Sub', record.subIds], ['Reg', record.registrationIds]]) if (list(values).length) related.append(node('div', `${label}: ${textList(values)}`));
        if (!related.childNodes.length) related.textContent = NOT_RECORDED;
        const source = node('td', record.source || 'Velocity');
        source.title = `Submission: ${formatDate(record.submissionDate)}\nApproval: ${formatDate(record.approvalDate)}`;
        tr.append(related, node('td', textList(record.products)), source);
        const link = node('td'); const url = safeUrl(record.url);
        if (url && options.onLaunchUrl) { const open = button('Open ↗', () => options.onLaunchUrl(url), 'who-text-button', `Open ${record.id} in platform`); open.title = url; link.append(open); }
        else link.textContent = '—';
        tr.append(link);
      }
      body.append(tr);
    }
    if (!records.length) { const row = node('tr'); const cell = node('td', isIssues ? 'No matching data checks.' : 'No matching records.'); cell.colSpan = columns.length; row.append(cell); body.append(row); }
    table.append(body); scroll.append(table); panel.append(scroll);
    const paging = node('div', null, 'who-paging');
    paging.append(node('span', records.length ? `${number(page * PAGE_SIZE + 1)}–${number(Math.min((page + 1) * PAGE_SIZE, records.length))} of ${number(records.length)} records` : '0 records'));
    const previous = focusKey(button('Previous', () => change({ page: page - 1 })), 'previous-page'); previous.disabled = page === 0;
    const next = focusKey(button('Next', () => change({ page: page + 1 })), 'next-page'); next.disabled = page === maxPage;
    paging.append(previous, next); panel.append(paging); root.append(panel);
    if (previousDetail === detailSignature) scroll.scrollTop = detailsScroll;
  }

  root.scrollTop = rootScroll;
  if (state.detail && !state.capture && previousDetail !== detailSignature) {
    const details = root.querySelector('.who-details');
    const bounds = root.getBoundingClientRect();
    const target = details?.getBoundingClientRect();
    if (target && (target.top > bounds.bottom - 120 || target.top < bounds.top)) {
      // Only scroll inside this visual. scrollIntoView can move the entire report page.
      root.scrollTop = Math.max(0, rootScroll + target.top - bounds.top - 12);
    }
  }
  if (focused) {
    const target = [...root.querySelectorAll('[data-focus-key]')].find(item => item.getAttribute('data-focus-key') === focused);
    if (target && !target.disabled) {
      target.focus({ preventScroll: true });
      if (selection && typeof target.setSelectionRange === 'function' && selection.start != null) target.setSelectionRange(selection.start, selection.end);
    }
  }
  return result;
}
