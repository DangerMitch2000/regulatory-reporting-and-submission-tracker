import powerbi from 'powerbi-visuals-api';
import {mapTable, safeURL} from './logic.mjs';
import {mount} from './ui.mjs';
import '../style/visual.less';

/** Only explicit user actions may use the host's optional export/URL services. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return safeURL(value);
}

export async function exportContent(host: any, csv: string, fileName: string): Promise<boolean> {
  const service = host?.downloadService;
  if (typeof service?.exportVisualsContent !== 'function') return false;
  try {
    // API 5.11 PrivilegeStatus.Allowed is zero.
    if (typeof service.exportStatus === 'function' && await service.exportStatus() !== 0) return false;
    return !!(await service.exportVisualsContent(csv, fileName, 'csv', 'Registration Coverage Map filtered records'));
  } catch { return false; }
}

export class Visual implements powerbi.extensibility.visual.IVisual {
  private host: powerbi.extensibility.visual.IVisualHost;
  private root: HTMLElement;
  private content: HTMLElement;
  private notice: HTMLElement;
  private app: any;
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;
  private seenData = false;
  private dataRevision = 0;
  private viewport = {width: 0, height: 0};

  constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
    this.host = options.host;
    this.root = document.createElement('div');
    this.root.className = 'registration-map-host';
    this.root.style.cssText = 'width:100%;height:100%;overflow:auto;position:relative;display:flex;flex-direction:column;';
    this.notice = document.createElement('div');
    this.notice.className = 'host-notice';
    this.notice.setAttribute('role', 'status');
    this.notice.style.cssText = 'flex:none;padding:8px 14px;font:12px/1.5 Segoe UI,sans-serif;';
    this.notice.hidden = true;
    this.content = document.createElement('div');
    this.content.className = 'registration-map-content';
    this.content.style.cssText = 'flex:1;min-height:0;';
    this.root.append(this.notice, this.content);
    options.element.appendChild(this.root);
  }

  private showNotice(text: string): void {
    this.notice.textContent = text;
    this.notice.hidden = !text;
  }

  public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
    if (this.destroyed) return;
    const dataView = options.dataViews?.[0];
    const isData = !!(options.type & 2) || (!this.seenData && !!dataView);
    if (isData) this.seenData = true;
    const revision = isData ? ++this.dataRevision : this.dataRevision;
    this.viewport = options.viewport;
    this.root.style.width = Math.max(0, options.viewport.width) + 'px';
    this.root.style.height = Math.max(0, options.viewport.height) + 'px';
    const palette = this.host.colorPalette;
    const highContrast = palette?.isHighContrast ? {
      foreground: palette.foreground.value, background: palette.background.value,
      selected: palette.foregroundSelected?.value || palette.foreground.value,
      hyperlink: palette.hyperlink?.value || palette.foreground.value
    } : null;
    this.root.style.background = highContrast?.background || '';
    this.root.style.color = highContrast?.foreground || '';
    this.host.eventService?.renderingStarted(options);
    this.queue = this.queue.then(async () => {
      let failed = false;
      try {
        if (this.destroyed || revision !== this.dataRevision) return;
        if (!this.app) this.app = await mount(this.content, {
          onExport: (csv: string, fileName: string) => this.destroyed ? Promise.resolve(false) : exportContent(this.host, csv, fileName),
          onLaunchUrl: (value: string) => {
            const url = safeUrl(value);
            if (this.destroyed || !url || typeof this.host.launchUrl !== 'function') return false;
            this.host.launchUrl(url);
            return true;
          },
          onCopy: async (text: string) => {
            if (this.destroyed || !navigator.clipboard?.writeText) return false;
            try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
          }
        });
        if (this.destroyed || revision !== this.dataRevision) return;
        await this.app.resize(this.viewport.width, this.viewport.height);
        if (this.destroyed || revision !== this.dataRevision) return;
        if (isData) {
          // fetchMoreData(true) delivers accumulated tables. Replace, never concatenate.
          const mapped = mapTable(dataView?.table);
          const partial = !!dataView?.metadata?.segment;
          const loading = partial ? `Loading additional data — ${(dataView?.table?.rows?.length || 0).toLocaleString()} rows received. Counts reflect loaded rows only.` : '';
          const missing = mapped.missing.length ? 'Add fields: ' + mapped.missing.join(', ') + '.' : '';
          this.showNotice([missing, loading].filter(Boolean).join(' '));
          this.root.setAttribute('aria-busy', 'false');
          await this.app.update(mapped.rows, {missing: mapped.missing, mappedFields: mapped.mappedFields, notice: '', highContrast});
          if (this.destroyed || revision !== this.dataRevision) return;
          // The actual partial UI is interactive before requesting another batch.
          if (partial) {
            let accepted = false;
            try { accepted = this.host.fetchMoreData(true); } catch { /* Keep delivered records visible. */ }
            this.root.setAttribute('aria-busy', accepted ? 'true' : 'false');
            if (!accepted) this.showNotice([missing, 'Power BI limited the delivered rows. Counts reflect loaded rows only; narrow report filters.'].filter(Boolean).join(' '));
          }
        } else {
          // Theme/high-contrast updates never remap or request data, and preserve selections.
          await this.app.setHighContrast?.(highContrast);
        }
      } catch (error: any) {
        if (!this.destroyed && revision === this.dataRevision) {
          failed = true;
          this.root.setAttribute('aria-busy', 'false');
          this.showNotice('Unable to display registration coverage: ' + (error?.message || String(error)));
          this.host.eventService?.renderingFailed(options, error?.message || String(error));
        }
      } finally {
        if (!this.destroyed && !failed) this.host.eventService?.renderingFinished(options);
      }
    });
  }

  public getFormattingModel(): powerbi.visuals.FormattingModel { return {cards: []}; }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.dataRevision++;
    this.queue.finally(() => { this.app?.destroy(); this.root.remove(); });
  }
}
