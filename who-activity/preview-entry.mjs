import {render} from './ui.mjs';
import {defaultState, ROLES} from './logic.mjs';
import {sample, sixSiteSample, DEMO_NOW} from './demo.mjs';

const root = document.getElementById('host');
let state = defaultState(new Date(DEMO_NOW));
let rows = sample();
function draw() {
  render(root, rows, {
    state, now: new Date(DEMO_NOW), mapped: Object.fromEntries(ROLES.map(role => [role,true])), missing: [],
    width: root.clientWidth, height: root.clientHeight,
    onChange(patch) {state = {...state, ...patch}; draw();},
    onCopy: async text => {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
    },
    onLaunchUrl: url => window.open(url, '_blank', 'noopener,noreferrer')
  });
}
document.getElementById('three').onclick = () => {rows=sample(); state=defaultState(new Date(DEMO_NOW)); draw();};
document.getElementById('six').onclick = () => {rows=sixSiteSample(); state=defaultState(new Date(DEMO_NOW)); draw();};
document.getElementById('wide').onclick = () => {root.style.maxWidth='1440px'; root.style.height='820px'; draw();};
document.getElementById('small').onclick = () => {root.style.maxWidth='700px'; root.style.height='700px'; draw();};
new ResizeObserver(draw).observe(root);
draw();
