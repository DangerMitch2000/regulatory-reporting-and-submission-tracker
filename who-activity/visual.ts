import powerbi from 'powerbi-visuals-api';
import {mapTable, defaultState, normalizeState} from './logic.mjs';
import {render} from './ui.mjs';
import '../style/visual.less';

export class Visual implements powerbi.extensibility.visual.IVisual {
  private root: HTMLElement;
  private host: powerbi.extensibility.visual.IVisualHost;
  private rows: any[] = [];
  private missing: string[] = ['CommercialRegion','Site'];
  private mapped: any = {};
  private labels: any = {};
  private state: any = defaultState();
  private preferenceText: string | undefined;
  private pendingPreferences = new Set<string>();
  private latestPreference: string | undefined;
  private width = 1280;
  private height = 800;
  private notice = '';
  private highContrast: any = null;
  private day = new Date().toDateString();
  private timer: ReturnType<typeof setInterval>;
  private destroyed = false;
  constructor(options: powerbi.extensibility.visual.VisualConstructorOptions) {
    this.host = options.host;
    this.root = document.createElement('div');
    options.element.appendChild(this.root);
    this.timer = setInterval(() => {
      const day = new Date().toDateString();
      if (day !== this.day && !this.destroyed) {this.day = day; this.draw();}
    }, 60000);
  }
  private draw() {
    if(this.destroyed) return;
    render(this.root,this.rows,{state:this.state,width:this.width,height:this.height,missing:this.missing,mapped:this.mapped,labels:this.labels,notice:this.notice,highContrast:this.highContrast,
      onLaunchUrl:(url:string)=>{if(/^https:\/\//i.test(url))this.host.launchUrl?.(url);},
      onChange:(patch:any)=>{
        this.state = {...this.state,...patch};
        const savedKeys = ['sites','unit','product','region','whoValue','submissionType','years','groupBy','theme','capture'];
        if(savedKeys.some(key=>key in patch)) {
          const value = JSON.stringify(Object.fromEntries(savedKeys.map(key=>[key,this.state[key]])));
          this.pendingPreferences.add(value);
          this.latestPreference = value;
          this.host.persistProperties?.({merge:[{objectName:'preferences',selector:null,properties:{state:value}}]});
        }
        this.draw();
      }});
  }
  public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
    if(this.destroyed)return;
    this.host.eventService?.renderingStarted(options);
    try {
      this.width=Math.max(1,options.viewport.width); this.height=Math.max(1,options.viewport.height);
      this.root.style.width=this.width+'px'; this.root.style.height=this.height+'px';
      const palette=this.host.colorPalette;
      this.highContrast=palette?.isHighContrast?{foreground:palette.foreground.value,background:palette.background.value}:null;
      let pending=false;
      if(options.dataViews?.[0] || (options.type&2)) {
        const view=options.dataViews?.[0], mapped=mapTable(view?.table);
        this.rows=mapped.rows; this.missing=mapped.missing; this.mapped=mapped.mapped; this.labels=mapped.labels;
        const saved=view?.metadata?.objects?.preferences?.state;
        if(typeof saved==='string' && saved!==this.preferenceText) {
          this.preferenceText=saved;
          if(this.pendingPreferences.has(saved)) {
            // Host echoes acknowledge writes; older echoes must not undo newer clicks.
            if(saved===this.latestPreference)this.pendingPreferences.clear();
          } else {
            try {this.state={...this.state,...normalizeState(JSON.parse(saved))};this.pendingPreferences.clear();} catch { /* Keep current selections for malformed report preferences. */ }
          }
        }
        pending=!!view?.metadata?.segment;
        this.notice=pending?'Loading more records — counts are partial.':'';
      }
      this.draw();
      // Show the delivered batch before asking Power BI to append more data.
      if(pending) {
        let accepted=false;
        try {accepted=this.host.fetchMoreData?.(true)===true;} catch { /* Display the partial-data notice below. */ }
        if(!accepted){this.notice='Power BI limited the delivered records. Counts are partial; narrow report filters.';this.draw();}
      }
      this.host.eventService?.renderingFinished(options);
    } catch(error:any) {
      this.root.textContent='Unable to display submissions and approvals: '+error.message;
      this.host.eventService?.renderingFailed(options,error.message);
    }
  }
  public getFormattingModel(): powerbi.visuals.FormattingModel {return {cards:[]};}
  public destroy() {this.destroyed=true;clearInterval(this.timer);this.root.remove();}
}
