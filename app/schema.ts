import {Chapter, Page} from './data.js';
import {Hexstring} from './util.js';

export class Schema {
  pages: Page[] = [];
  chapters: Chapter[] = [];
  config = {
    format: 'C/PP',
    startDate: <Date|void>void(0),
    chapterStartAt: 1,
    pageStartAt: 1,
    dir: '',
    imgpostbuffer: 5,
    imgprebuffer: 5,
    startPage: 0,
    back: new Hexstring(0)
  };
  loading = {
    diameter: 250,
    lines: 16,
    rate: 1000 / 30,
    back: new Hexstring('#FFF'),
    color: new Hexstring('#373737')
  };
  private pageChapterMap = new Map<number, number>();

  constructor(script?: any) {
    try {
      let raw;
      if (typeof script === 'string') {
        raw = JSON.parse(script);
      } else if (script.length) {
        const pageWriter = (typeof script[0] === 'string') ? (link: string) => {
          return {url: link};
        } : (data: any) => {
          return {
            ...data, url: [data.link], link: undefined
          }
        };
        raw = {pages: script.map(pageWriter)};
      } else {
        raw = (script && script.length === undefined) ? script : {};
      }

      if (raw.pages && raw.pages.length) {
        raw.pages = raw.pages.map((e: any) => {
          if (e.url) {
            return new Page(null, e);
          }
          return new Page(e);
        });
      }
      if (raw.chapters && raw.chapters.length) {
        raw.chapters = (<any[]>raw.chapters)
                           .map((e: any) => new Chapter(e.start, e.title, e.description))
                           .sort((a: Chapter, b: Chapter) => a.start - b.start);
      }
      if (raw.config && raw.config.startDate) {
        // TODO: make more robust
        raw.config.startDate = new Date(raw.config.startDate);
      }
      Object.assign(this, raw);
    } catch (e) {
      const error = 'Failed to create script\n';
      throw error + e;
    }
  }
  exportPages(ids: number[] = []) {
    if (ids.length) {
      let idMap = new Map<number, boolean>();
      ids.reduce((map, key) => map.set(key, true), new Map<number, boolean>());
      return this.pages.filter((page, id) => idMap.set(id, true))
          .map((page: Page) => page.collapse());
    }
    return this.pages.map((page: Page) => page.collapse());
  }
  mapPageChapter(indicies?: number[]) {
    this.chapters = this.chapters.sort((a, b) => a.start - b.start);
    const chapters = this.chapters.filter((e, index) => !indicies || indicies.includes(index));
    chapters.forEach((chapter, chapterID, chapters) => {
      const next = chapters[chapterID + 1];
      const start = chapter.start;
      const end = (next) ? next.start : this.pages.length;
      if (start >= end) return;
      for (let pageID = start; pageID < end; pageID++) {
        this.pageChapterMap.set(pageID, chapterID);
      }
    });
  }
  pageToChapter(id: number = 0) {
    return this.pageChapterMap.get(id) || 0;
  }
  chapterToPage(id: number = 0) {
    const chapter = this.chapters[id];
    return (chapter) ? chapter.start : 0;
  }
}