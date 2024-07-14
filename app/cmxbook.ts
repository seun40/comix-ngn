import direction from '../lib/directionx.js';
import pegasus from '../lib/pegasus.min.js';

import {CmxCtrl} from './cmxctrl.js';
import {Comixngn, comixngn} from './comixngn_core.js';
import {Chapter, Page} from './data.js';
import {Schema} from './schema.js';

export class CmxBook extends HTMLElement {
  [key: string]: any;
  controller?: CmxCtrl;
  private _schema?: Schema;
  private _uid: string;
  private _cid: string;
  private _core: Comixngn;
  private _active = false;
  get core() {
    return this._core;
  };
  shadow: ShadowRoot;
  constructor() {
    super();
    this._core = comixngn();
    const {core} = this;

    let uid = this.getAttribute('uid');
    if (!uid) {
      let j = 0;
      uid = `STG${j}`;
      while (core.bookMap.get(uid)) {
        uid = `STG${++j}`;
      }
    }
    this._uid = uid!;
    core.bookMap.set(uid!, this);

    this._cid = window.location.host;
    this.shadow = this.attachShadow({mode: 'open'});

    console.log('construct cmxbook');
  }
  private convertToDirectionSetting() {
    const {_schema, _core} = this;
    const setting = _core.setting;
    const {config, loading} = _schema!;
    const {dir, imgprebuffer, imgpostbuffer, startPage} = config;
    const {diameter, lines, rate} = loading;
    const back = (config.back) ? config.back.toString() : undefined;
    const loaderback = (loading.back) ? loading.back.toString() : undefined;
    const color = (loading.color) ? loading.color.toString() : undefined;
    const overwrite = startPage;

    return {
      overwrite,
      dir,
      imgprebuffer,
      imgpostbuffer,
      diameter,
      lines,
      rate,
      back,
      loaderback,
      color,
      ...setting
    };
  }
  private initializeDisplay() {
    // DIRECTION specific
    const {shadow} = this;
    // call custom constructor
    const pages = this._schema ? this._schema.exportPages() : [];
    const settings = this._schema ? this.convertToDirectionSetting() : {};
    const base = new (<any>direction)(pages, {...settings, anchor: shadow});
    this.defineMethods(base);
    console.log('Intialize Display');
    this._active = true;
    const ctrlPath = this.getAttribute('controller');
    if (ctrlPath) {
      (<any>pegasus)(ctrlPath).then(this.initializeControls.bind(this));
    } else {
      /*this.controller = <CmxCtrl>document.createElement('comix-ctrl');
      this.insertAdjacentElement('afterend', this.controller);*/
      this.initializeControls();
    }
  }
  private initializeControls(data?: any) {
    this.controller = new CmxCtrl(this, data);
    this.insertAdjacentElement('afterend', this.controller);
  }
  private defineMethods(base: any) {
    // DIRECTION specific
    let options = {...this._core.setting};
    let pageToChapter = (a: any) => 0;
    let chapterToPage = (a: any) => 0;
    if (this._schema) {
      pageToChapter = this._schema.pageToChapter;
      chapterToPage = this._schema.chapterToPage;
      options = {...options, ...this._schema};
    }
    this.rand = base.rand;
    this.go = base.go;
    this.prev = base.prev;
    this.next = base.next;
    this.frst = base.frst;
    this.last = base.last;
    this.ch_go = (to?: number) => pageToChapter(this.go(pageToChapter(to)));
    this.ch_prev = () => pageToChapter(this.go(chapterToPage((<number>this.ch_current()) - 1)));
    this.ch_next = () => pageToChapter(this.go(chapterToPage((<number>this.ch_current()) + 1)));
    this.ch_frst = () => pageToChapter(this.go(chapterToPage(0)));
    this.ch_last = () =>
        pageToChapter(this.go(chapterToPage(this._schema ? this._schema.chapters.length : 0)));
    this.update = () => {
      const swap = <(arr: string[], opts: any, start?: number) => void>base.swap;
      const pages = this._schema ? this._schema.exportPages() : [];
      const settings = this._schema ? this.convertToDirectionSetting() : {};
      swap(pages, {...settings, anchor: this.shadow});
      base.setupShaders(settings);
    };
    this.resize = base.resize;
    this.current = base.current;
    this.ch_current = () => {
      pageToChapter(this.current())
    };
    this.rawData = base.data;
    this.pg_data = (to?: number) => {
      if (this._schema && this._schema.pages.length) {
        return this._schema.pages[to || this.current() || 0];
      }
    };
    this.ch_data = (to?: number) => {
      if (this._schema && this._schema.chapters.length) {
        return this._schema.chapters[to || this.ch_current() || 0];
      }
    };
    base.callback(1, () => {
      const currentPageId = <number>this.current();
      const currentPage = this._schema!.pages[currentPageId];
      if (localStorage && options.pageSave) {
        const {_cid, _uid} = this;
        localStorage.setItem(`${_cid}|${_uid}|current`, currentPageId.toString());
      }
      if (options.pagePush) {
        /* FORMAT STRING
        Numbers form fill, that is, a number will fill as many spots as it needs
        if the template is bigger than that it is zero padded
        Y - Year (defaults to two form year, until 3 digits)
        M - Month (#)
        D - Day
        H - Hour
        U - Minute
        S - Second
        //Standard
        N - Month (Name full)/n - Month (Name acroynm)
        C - Chapter (#)/c - Chapter (Title), fallback to number
        P - Page (#)/p - Page (Title), fallback to number
        F - Filename
        ex: 2017//05/04
        YYY/MM/DD
         */
        let state = '';
        if (options.config.format) {
          const {format, chapterStartAt, pageStartAt, startDate} = options.config;
          const releaseDate = currentPage.release;
          const pageName = currentPage.title;
          const pageURL = currentPage.url[0];
          const pageNum = currentPageId + pageStartAt;
          const chpNum = this._schema!.pageToChapter(currentPageId) + chapterStartAt;
          const chpName = this.ch_data() ? (<Chapter>this.ch_data()).title : '';
          const calendar = [
            'january', 'febuary', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
            'october', 'november', 'december'
          ];
          const evaluate = (cmd: string|undefined, size: number) => {
            if (!cmd) return '';
            const uppercase = cmd === cmd.toUpperCase();
            cmd = cmd.toLowerCase();
            const rs = () => size = 0;
            const dateProc = (action: Function) => () => {
              if (!releaseDate) throw new Error(`Date required for format of ${format}`);
              // TODO: fallback calculate release date by startdate if consecutive release is set
              return action();
            };
            const raw: {[key: string]: () => string | void} = {
              'y': dateProc(() => {
                let year = releaseDate!.getFullYear().toString();
                return (size < 3) ? year.slice(2) : year
              }),
              'm': dateProc(() => releaseDate!.getMonth().toString()),
              'd': dateProc(() => releaseDate!.getDay().toString()),
              'h': dateProc(() => releaseDate!.getHours().toString()),
              'u': dateProc(() => releaseDate!.getMinutes().toString()),
              's': dateProc(() => releaseDate!.getSeconds().toString()),
              'n': dateProc(() => {
                rs();
                let month = calendar[releaseDate!.getMonth()];
                return uppercase ? month : month.slice(0, 3)
              }),
              'c': () => {
                rs();
                return (!uppercase && chpName) ? chpName : chpNum.toString()
              },
              'p': () => {
                rs();
                return (!uppercase && pageName) ? pageName : pageNum.toString()
              },
              'f': () => {
                rs();
                return pageURL.slice(pageURL.lastIndexOf('/') + 1)
              },
              '': () => ''
            };
            const short = <string>(raw[cmd] || raw[''])();
            if (!short.length) return cmd;
            return short.padStart(size - short.length, '0');
          };
          let command: string[] = [];
          let result: string[] = [];

          for (let i = 0; i < format.length; i++) {
            if (command[0] !== format[i]) {
              try {
                result.push(evaluate(command[0], command.length));
              } catch (e) {
                console.log(e);
                return '';
              }
              command = [format[i]];
            } else {
              command.push(format[i]);
            }
          }
          result.push(evaluate(command[0], command.length));
          state = result.join('');
        }

        console.log(`Pushing state: ${state}`);
        history.pushState({}, '', `#/${state}`);
      }
    });
  }
  exportSchema() {
    return JSON.stringify(this._schema);
  }
  changeId(key: string, value: string) {
    const {_cid, _uid} = this;
    const oldKey = `${_cid}|${_uid}|current`;
    this[key] = value;
    const newKey = `${_cid}|${_uid}|current`;
    const data = localStorage.getItem(oldKey);
    if (data) {
      localStorage.removeItem(oldKey);
      localStorage.setItem(newKey, data);
    }
  }
  set uid(val: string) {
    if (this.core.bookMap.has(val)) {
      console.error(`CmxBook with uid ${val} already exists.`);
    } else {
      this.core.bookMap.set(val, this);
      this.core.bookMap.delete(this._uid);
      this.changeId('_uid', val);
      if (this.getAttribute('uid') !== val) this.setAttribute('uid', val);
    }
  }
  set cid(val: string) {
    this.changeId('_cid', val)
    if (this.getAttribute('cid') !== val) this.setAttribute('cid', val);
  }
  set schema(input: any) {
    const setUpdate = (data: any) => {
      if (!(data instanceof Schema)) {
        data = new Schema(data);
      }
      this._schema = data;
      if (this._active) {
        this.update();
      } else {
        this.initializeDisplay();
      }
    };
    if (typeof input === 'string') {
      try {
        setUpdate(JSON.parse(input));
      } catch {
        (<any>pegasus)(input).then(setUpdate);
      }
      // if (this.getAttribute('schema') !== input) this.setAttribute('schema', input);
    } else {
      setUpdate(input);
      // if (this.getAttribute('schema') !== JSON.stringify(input)) this.setAttribute('schema',
      // JSON.stringify(input));
    }
  }
  set config(configPath: string|null) {
    const setUpdate = (data: any) => {
      this.core.config(data);
      if (this._active) {
        this.update();
      }
    };
    if (configPath) {
      try {
        setUpdate(JSON.parse(configPath));
      } catch {
        (<any>pegasus)(configPath).then(setUpdate);
      }
      if (this.getAttribute('config') !== configPath) this.setAttribute('config', configPath);
    }
  }
  get uid() {
    return this._uid;
  };
  get cid() {
    return this._cid;
  };
  get config() {
    return this.getAttribute('config');
  }
  get schema() {
    return this._schema;
  };
  static get observedAttributes() {
    return ['cid', 'uid', 'schema', 'config'];
  }
  attributeChangedCallback(name: string, oldVal: string, newVal: string) {
    if (this[name] !== newVal) this[name] = newVal;
  }

  rand(): number|void{};
  go(to?: number): number|void{};
  prev(): number|void{};
  next(): number|void{};
  frst(): number|void{};
  last(): number|void{};
  ch_go(to?: number): number|void{};
  ch_prev(): number|void{};
  ch_next(): number|void{};
  ch_frst(): number|void{};
  ch_last(): number|void{};
  update(): void{};
  current(): number|void{};
  ch_current(): number|void{};
  rawData(to?: number): any|void{};
  pg_data(to?: number): Page|void{};
  ch_data(to?: number): Chapter|void{};
  setupShaders(options?: number): void{};
  resize(
      sz?: {w?: number, h?: number, s2w?: boolean, s2h?: boolean, s2g?: boolean, s2l?: boolean}|0,
      redraw: boolean = true, reset: boolean = false): void{};
}