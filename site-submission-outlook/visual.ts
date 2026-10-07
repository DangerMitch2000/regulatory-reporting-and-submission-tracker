import powerbi from 'powerbi-visuals-api';
import {mapTable, normalizeSites, DEFAULT_SITES} from './submissions.logic.mjs';
import {render} from './submissions.ui.mjs';
import '../style/visual.less';

export class Visual implements powerbi.extensibility.visual.IVisual {
  private root: HTMLElement;
  private host: powerbi.extensibility.visual.IVisualHost;
  private rows: any[] = [];
  private missing = ['SubID', 'Site', 'PlannedSubmission', 'ActualSubmission'];
  private unitMapped = false;
  private notice = '';
  private state: any = {sites: [...DEFAULT_SITES], unit: '*', theme: 'light', capture: false};
  private preferenceText: string | undefined;
  private timer: ReturnType<typeof setInterval>;
  private day = new Date().toDateString();
  private width = 1280;
  private highContrast: any = null;
  constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
    this.host = options.host;
    this.root = document.createElement('div');
    options.element.appendChild(this.root);
    this.timer = setInterval(() => {
      const day = new Date().toDateString();
      if (day !== this.day) {this.day = day; this.draw();}
    }, 60000);
  }
  private draw() {
    render(this.root, this.rows, {state: this.state, width: this.width, missing: this.missing, unitMapped: this.unitMapped,
      notice: this.notice, highContrast: this.highContrast, onChange: (patch: any) => {
        this.state = {...this.state, ...patch};
        if (['sites', 'unit', 'theme'].some(k => k in patch)) {
          const value = JSON.stringify({sites: this.state.sites, unit: this.state.unit, theme: this.state.theme});
          this.host.persistProperties?.({merge: [{objectName: 'preferences', selector: null, properties: {state: value}}]});
        }
        this.draw();
      }});
  }
  public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
    this.host.eventService?.renderingStarted(options);
    try {
      this.width = options.viewport.width;
      this.root.style.width = options.viewport.width + 'px';
      this.root.style.height = options.viewport.height + 'px';
      const palette = this.host.colorPalette;
      this.highContrast = palette?.isHighContrast ? {foreground: palette.foreground.value, background: palette.background.value} : null;
      if (options.dataViews?.[0] || (options.type & 2)) {
        const view = options.dataViews?.[0], mapped = mapTable(view?.table);
        this.rows = mapped.rows; this.missing = mapped.missing; this.unitMapped = mapped.unitMapped;
        const saved = view?.metadata?.objects?.preferences?.state;
        if (typeof saved === 'string' && saved !== this.preferenceText) {
          this.preferenceText = saved;
          try {
            const parsed = JSON.parse(saved);
            this.state = {...this.state, sites: normalizeSites(parsed.sites), unit: typeof parsed.unit === 'string' ? parsed.unit : '*', theme: parsed.theme === 'dark' ? 'dark' : 'light'};
          } catch { /* Keep the existing selections if report preferences are malformed. */ }
        }
        this.notice = '';
        if (view?.metadata?.segment) {
          this.notice = 'Loading more records — counts are partial.';
          if (!this.host.fetchMoreData(true)) this.notice = 'Power BI limited the delivered records. Counts are partial; narrow report filters.';
        }
      }
      this.draw(); this.host.eventService?.renderingFinished(options);
    } catch (error: any) {
      this.root.textContent = 'Unable to display submission counts: ' + error.message;
      this.host.eventService?.renderingFailed(options, error.message);
    }
  }
  public getFormattingModel(): powerbi.visuals.FormattingModel {return {cards: []};}
  public destroy() {clearInterval(this.timer); this.root.remove();}
}
