// A small DOM good enough to run js/lava/index.mjs in node:test.
//
// The frontend defects this round (a close button that never hung up, an
// appointment window stranded behind the overlay, a URL that opened a mic
// session with no click) all lived in wiring that source-grep assertions
// cannot see. This exercises the real module.
//
// It implements only what the client touches. The LAVA markup is pre-created so
// ensureMarkup() short-circuits and no HTML parsing is needed.

class FakeClassList {
  constructor(el) {
    this.el = el;
  }
  get set() {
    return new Set(this.el.className.split(/\s+/).filter(Boolean));
  }
  _write(set) {
    this.el.className = [...set].join(' ');
  }
  add(...names) {
    const s = this.set;
    names.forEach((n) => s.add(n));
    this._write(s);
  }
  remove(...names) {
    const s = this.set;
    names.forEach((n) => s.delete(n));
    this._write(s);
  }
  contains(name) {
    return this.set.has(name);
  }
  toggle(name, force) {
    const on = force === undefined ? !this.contains(name) : Boolean(force);
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }
}

class FakeElement {
  constructor(tag, doc) {
    this.tagName = String(tag).toUpperCase();
    this.ownerDocument = doc;
    this.id = '';
    this.className = '';
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.textContent = '';
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this.onclick = null;
  }
  appendChild(child) {
    if (child.parentElement) child.parentElement.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
    if (child.id) this.ownerDocument._byId.set(child.id, child);
    return child;
  }
  removeChild(child) {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentElement = null;
    return child;
  }
  remove() {
    if (this.parentElement) this.parentElement.removeChild(this);
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((c) => c.contains(node));
  }
  get firstElementChild() {
    return this.children[0] || null;
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  /** Fires the handlers a real click would, including an inline onclick. */
  click() {
    const event = { type: 'click', target: this, preventDefault() {} };
    for (const fn of this.listeners.get('click') || []) fn(event);
    if (typeof this.onclick === 'function') this.onclick(event);
  }
  _match(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('[') && selector.endsWith(']')) {
      const key = selector.slice(1, -1).split('=')[0];
      const prop = key.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return Object.prototype.hasOwnProperty.call(this.dataset, prop);
    }
    return this.tagName === selector.toUpperCase();
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  querySelectorAll(selector) {
    const out = [];
    for (const child of this.children) {
      if (child._match(selector)) out.push(child);
      out.push(...child.querySelectorAll(selector));
    }
    return out;
  }
  get innerHTML() {
    return '';
  }
  set innerHTML(_value) {
    // Never exercised: the fixture pre-creates every element the client looks
    // for, so ensureMarkup() takes its short-circuit branches.
    this.children = [];
  }
}

class FakeDocument {
  constructor() {
    this._byId = new Map();
    this.readyState = 'complete';
    this.body = new FakeElement('body', this);
    this.listeners = new Map();
  }
  createElement(tag) {
    return new FakeElement(tag, this);
  }
  getElementById(id) {
    return this._byId.get(id) || null;
  }
  querySelector(selector) {
    return this.body.querySelector(selector);
  }
  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
}

const LAVA_IDS = [
  ['lava-window', 'win-window hidden lava-window'],
  ['lava-notes-window', 'win-window hidden lava-notes-window'],
  ['lava-appointment-window', 'win-window hidden lava-appointment-window'],
];

const CHILD_IDS = [
  ['lava-orb', 'lava-orb'],
  ['lava-meter', 'lava-meter'],
  ['lava-line', 'lava-line'],
  ['lava-status', 'lava-status'],
  ['lava-start', 'win-btn'],
  ['lava-pause', 'win-btn'],
  ['lava-end', 'win-btn'],
  ['lava-notes-understood', 'lava-notes-text'],
  ['lava-notes-open', 'lava-notes-text'],
  ['lava-notes-wrong', 'win-btn'],
  ['lava-appointment-label', 'lava-appointment-label'],
  ['lava-appointment-download', 'win-btn'],
];

/**
 * Installs globals for one test and returns them plus a restore function.
 * @param {{ width?: number, pathname?: string, search?: string, inFrame?: boolean }} opts
 */
export function installFakeDom(opts = {}) {
  const { width = 1440, pathname = '/', search = '', inFrame = false } = opts;
  const saved = {
    document: globalThis.document,
    window: globalThis.window,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    Blob: globalThis.Blob,
    URL: globalThis.URL,
  };

  const doc = new FakeDocument();

  for (const [id, className] of LAVA_IDS) {
    const el = doc.createElement('div');
    el.id = id;
    el.className = className;
    // Each window carries the Win98 close button index.html ships.
    const bar = doc.createElement('div');
    bar.className = 'win-titlebar';
    const close = doc.createElement('button');
    close.className = 'win-titlebar-btn close-btn';
    bar.appendChild(close);
    el.appendChild(bar);
    doc.body.appendChild(el);
  }
  for (const [id, className] of CHILD_IDS) {
    const el = doc.createElement('div');
    el.id = id;
    el.className = className;
    doc.getElementById(id.startsWith('lava-notes') || id === 'lava-notes-wrong'
      ? 'lava-notes-window'
      : id.startsWith('lava-appointment')
        ? 'lava-appointment-window'
        : 'lava-window').appendChild(el);
  }
  const overlay = doc.createElement('div');
  overlay.id = 'lava-overlay';
  overlay.className = 'lava-overlay';
  const panel = doc.createElement('div');
  panel.className = 'lava-overlay-panel';
  overlay.appendChild(panel);
  doc.body.appendChild(overlay);

  const win = {
    innerWidth: width,
    location: { pathname, search, href: `https://mnrv.nl${pathname}${search}` },
    document: doc,
    opened: [],
    posted: [],
    open(...args) {
      win.opened.push(args);
      return null;
    },
    addEventListener() {},
    setTimeout: (fn) => fn,
    navigator: { userActivation: { hasBeenActive: false } },
  };
  win.self = win;
  win.top = inFrame ? { postMessage() {} } : win;
  win.parent = inFrame
    ? { postMessage: (...args) => win.posted.push(args) }
    : win;

  globalThis.document = doc;
  globalThis.window = win;
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};

  return {
    doc,
    win,
    restore() {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    },
  };
}
