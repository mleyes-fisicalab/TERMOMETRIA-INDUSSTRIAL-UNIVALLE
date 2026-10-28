'use strict';
/* ====================================================================
   Termometría Industrial Interactiva — núcleo
   Autor: Dra. María Elena Leyes
   ==================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k, d) { try { const v = localStorage.getItem('termo-ii:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('termo-ii:' + k, JSON.stringify(v)); } catch (e) {} }
};
const fmt = (v, d = 2) => (v == null || !isFinite(v)) ? '—' : Number(v).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtc = (v, d = 2) => (v == null || !isFinite(v)) ? '' : Number(v).toFixed(d).replace('.', ',');
const num = s => { const v = parseFloat(String(s).trim().replace(/\s/g, '').replace(',', '.')); return isFinite(v) ? v : NaN; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); setTimeout(() => t.remove(), 2400);
}
async function copyText(txt, okMsg) {
  try { await navigator.clipboard.writeText(txt); toast(okMsg); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove(); toast(ok ? okMsg : 'No se pudo copiar automáticamente. Selecciona el texto del borrador y cópialo.');
  }
}
function solveInc(f, lo, hi, y) { let a = lo, b = hi; for (let i = 0; i < 90; i++) { const m = (a + b) / 2; if (f(m) < y) a = m; else b = m; } return (a + b) / 2; }

/* ---------- aleatoriedad reproducible por código estudiantil ---------- */
function hashStr(s) { let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); return h1 >>> 0; }
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const noise = s => s * gauss(Math.random);

/* ---------- modelos de sensores ---------- */
const CVD = { A: 3.9083e-3, B: -5.775e-7, C: -4.183e-12 };
function ptR(t, R0 = 100, s = 1) { let r = 1 + CVD.A * s * t + CVD.B * t * t; if (t < 0) r += CVD.C * (t - 100) * t * t * t; return R0 * r; }
function ptT(R, R0 = 100) { return solveInc(t => ptR(t, R0), -200, 850, R); }
const CLASES = { AA: [0.10, 0.0017], A: [0.15, 0.002], B: [0.30, 0.005], C: [0.60, 0.010] };
const tolPt = (cl, t) => CLASES[cl][0] + CLASES[cl][1] * Math.abs(t);

const TCDATA = {
  K: { lo: -270, hi: 1372, use: [-200, 1260], r: [
    { hi: 0, c: [0, 0.394501280250E-01, 0.236223735980E-04, -0.328589067840E-06, -0.499048287770E-08, -0.675090591730E-10, -0.574103274280E-12, -0.310888728940E-14, -0.104516093650E-16, -0.198892668780E-19, -0.163226974860E-22] },
    { hi: 1372, c: [-0.176004136860E-01, 0.389212049750E-01, 0.185587700320E-04, -0.994575928740E-07, 0.318409457190E-09, -0.560728448890E-12, 0.560750590590E-15, -0.320207200030E-18, 0.971511471520E-22, -0.121047212750E-25], a: [0.1185976, -0.1183432E-03, 126.9686] }] },
  J: { lo: -210, hi: 760, use: [0, 760], r: [
    { hi: 760, c: [0, 0.503811878150E-01, 0.304758369300E-04, -0.856810657200E-07, 0.132281952950E-09, -0.170529583370E-12, 0.209480906970E-15, -0.125383953360E-18, 0.156317256970E-22] }] },
  T: { lo: -270, hi: 400, use: [-200, 370], r: [
    { hi: 0, c: [0, 0.387481063640E-01, 0.441944343470E-04, 0.118443231050E-06, 0.200329735540E-07, 0.901380195590E-09, 0.226511565930E-10, 0.360711542050E-12, 0.384939398830E-14, 0.282135219250E-16, 0.142515947790E-18, 0.487686622860E-21, 0.107955392700E-23, 0.394736195700E-27] },
    { hi: 400, c: [0, 0.387481063640E-01, 0.332922278800E-04, 0.206182434040E-06, -0.218822568460E-08, 0.109968809280E-10, -0.308157587720E-13, 0.454791352900E-16, -0.275129016730E-19] }] }
};
function tcE(type, t) {
  const d = TCDATA[type]; t = clamp(t, d.lo, d.hi);
  const r = d.r.find(x => t <= x.hi) || d.r[d.r.length - 1];
  let s = 0, p = 1; for (const c of r.c) { s += c * p; p *= t; }
  if (r.a) s += r.a[0] * Math.exp(r.a[1] * (t - r.a[2]) ** 2);
  return s;
}
function tcT(type, E) { const d = TCDATA[type]; return solveInc(t => tcE(type, t), d.lo, d.hi, E); }
const tcS = (type, t) => (tcE(type, t + 0.5) - tcE(type, t - 0.5)) * 1000; // µV/°C

const SH0 = { A: 1.130278567e-3, B: 2.339481978e-4, C: 8.830650541e-8 }; // NTC 10 kΩ, B25/100 ≈ 3950 K
function shR(tc, co = SH0) { const T = tc + 273.15, y = (co.A - 1 / T) / co.C, x = Math.sqrt(Math.pow(co.B / (3 * co.C), 3) + y * y / 4); return Math.exp(Math.cbrt(x - y / 2) - Math.cbrt(x + y / 2)); }
function shT(R, co) { const L = Math.log(R); return 1 / (co.A + co.B * L + co.C * L * L * L) - 273.15; }
const SH_NORM = 10000 / shR(25);
function betaR(tc, R25, b) { return R25 * Math.exp(b * (1 / (tc + 273.15) - 1 / 298.15)); }
function betaT(R, R25, b) { return 1 / (1 / 298.15 + Math.log(R / R25) / b) - 273.15; }

/* ---------- regresiones ---------- */
function linfit(x, y) {
  const n = x.length; let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxx += x[i] * x[i]; sxy += x[i] * y[i]; syy += y[i] * y[i]; }
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx), b = (sy - m * sx) / n;
  const ym = sy / n; let ssr = 0, sst = 0;
  for (let i = 0; i < n; i++) { ssr += (y[i] - (m * x[i] + b)) ** 2; sst += (y[i] - ym) ** 2; }
  return { m, b, r2: 1 - ssr / sst };
}
function lsq(X, y) {
  const k = X[0].length, M = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  X.forEach((row, i) => { for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) M[a][b] += row[a] * row[b]; M[a][k] += row[a] * y[i]; } });
  for (let c = 0; c < k; c++) {
    let p = c; for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let j = c; j <= k; j++) M[r][j] -= f * M[c][j]; }
  }
  return M.map((r, i) => r[k] / r[i]);
}

/* ---------- banco de medición del estudiante ---------- */
function bench(code) {
  const r = mulberry(hashStr('banco|' + String(code || 'demo').trim()));
  const n = () => gauss(r), u = () => r();
  const b = {
    id: 'B-' + String(1 + Math.floor(u() * 24)).padStart(2, '0'),
    pt: { R0: 100 + 0.05 * n(), s: 1 + 0.0012 * n(), rl: 0.30 + 0.45 * u() },
    tc: { off: 0.010 * n(), g: 1 + 0.004 * n(), tamb: 21 + 7 * u() },
    ntc: { k: 1 + 0.012 * n(), Rf: 10000, vcc: 3.3 }
  };
  b.pt.R = t => ptR(t, b.pt.R0, b.pt.s);
  b.tc.E = (th, ta) => b.tc.g * (tcE('K', th) - tcE('K', ta)) + b.tc.off;
  b.ntc.R = t => b.ntc.k * SH_NORM * shR(t);
  return b;
}

/* ====================================================================
   Plano cartesiano estilo GeoGebra (canvas)
   ==================================================================== */
const LIVE = new Set();
const cssv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const colorOf = c => (c && c.startsWith('var(')) ? cssv(c.slice(4, -1)) : c;
const ICON = {
  select: '<svg viewBox="0 0 24 24"><path d="M5 3l14 8.2-6.3 1.9L9.8 20z" fill="currentColor" stroke="none"/></svg>',
  pan: '<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-2.6 2.6M12 3l2.6 2.6M12 21l-2.6-2.6M12 21l2.6-2.6M3 12l2.6-2.6M3 12l2.6 2.6M21 12l-2.6-2.6M21 12l-2.6 2.6"/></svg>',
  zin: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L21 21M7.8 10.5h5.4M10.5 7.8v5.4"/></svg>',
  zout: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.3 15.3L21 21M7.8 10.5h5.4"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 11.5L12 4l9 7.5M6 9.6V20h12V9.6"/></svg>',
  pal: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.3 0 1.8-.8 1.8-1.7 0-1.2-1-1.5-1-2.5 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="14.5" cy="7" r="1.2"/></svg>'
};
const LIGHT_TOK = { '--plot-bg': '#ffffff', '--grid-minor': 'rgba(60,40,50,.07)', '--grid-major': 'rgba(60,40,50,.18)', '--axis': '#2a2329', '--tick': '#5e5a63', '--fg': '#1d1a1f', '--fg-2': '#463f47',
  '--panel-solid': '#ffffff', '--line': 'rgba(60,30,40,.18)', '--gold': '#b5121b', '--c-rtd': '#1f6fd6', '--c-tc': '#b86e00', '--c-ntc': '#12905a', '--c-ref': '#7a45d1', '--ok': '#178a4a', '--bad': '#c62f2f' };
const SWATCHES = ['var(--c-rtd)', 'var(--c-tc)', 'var(--c-ntc)', 'var(--c-ref)', 'var(--gold)', 'var(--bad)', 'var(--fg-2)', '#22c3d6'];
function niceStep(range, px) { const t = range / Math.max(2, px / 88), p = Math.pow(10, Math.floor(Math.log10(t))), f = t / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

class Plane {
  constructor(host, o) {
    this.o = Object.assign({ xmin: 0, xmax: 10, ymin: 0, ymax: 10, xlabel: 'x', ylabel: 'y', h: 330, title: '', xd: null, yd: null }, o);
    this.home = { xmin: this.o.xmin, xmax: this.o.xmax, ymin: this.o.ymin, ymax: this.o.ymax };
    this.v = { ...this.home }; this.layers = []; this.style = {}; this.mode = 'pan'; this.sel = null; this.probe = null; this.ptrs = new Map(); this.drag = null;
    host.classList.add('plane');
    host.innerHTML = `<div class="pl-bar" role="toolbar" aria-label="Herramientas del plano">
      <button data-a="select" title="Seleccionar objetos" aria-label="Seleccionar objetos">${ICON.select}</button>
      <button data-a="pan" class="on" title="Arrastrar el lienzo" aria-label="Arrastrar el lienzo">${ICON.pan}</button>
      <span class="sep"></span>
      <button data-a="zin" title="Acercar" aria-label="Acercar">${ICON.zin}</button>
      <button data-a="zout" title="Alejar" aria-label="Alejar">${ICON.zout}</button>
      <button data-a="home" title="Restablecer vista" aria-label="Restablecer vista">${ICON.home}</button>
      <span class="sep"></span>
      <button data-a="pal" title="Estilo de las curvas" aria-label="Estilo de las curvas">${ICON.pal}</button>
      <span class="ttl">${this.o.title}</span></div>
      <div class="pl-stage"><canvas role="img" aria-label="${this.o.title || 'Gráfica'}"></canvas><div class="pl-read" hidden></div><div class="pl-pal" hidden></div></div>
      <div class="pl-hint">Arrastra sobre un eje para reescalarlo · rueda o pellizco para acercar · usa la flecha para leer coordenadas</div>`;
    this.host = host; this.stage = $('.pl-stage', host); this.cv = $('canvas', host); this.ctx = this.cv.getContext('2d');
    this.read = $('.pl-read', host); this.pal = $('.pl-pal', host);
    $('.pl-bar', host).addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.action(b.dataset.a, b); });
    this.bind();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.stage);
    LIVE.add(this);
  }
  action(a, b) {
    if (a === 'select' || a === 'pan') { this.mode = a; $$('.pl-bar button[data-a=select],.pl-bar button[data-a=pan]', this.host).forEach(x => x.classList.toggle('on', x === b)); if (a === 'pan') { this.probe = null; this.read.hidden = true; this.draw(); } }
    else if (a === 'zin') this.zoom(1 / 1.25);
    else if (a === 'zout') this.zoom(1.25);
    else if (a === 'home') { this.v = { ...this.home }; this.probe = null; this.read.hidden = true; this.draw(); }
    else if (a === 'pal') this.togglePal();
  }
  zoom(f, cx, cy) {
    const v = this.v; cx = cx ?? (v.xmin + v.xmax) / 2; cy = cy ?? (v.ymin + v.ymax) / 2;
    this.v = { xmin: cx - (cx - v.xmin) * f, xmax: cx + (v.xmax - cx) * f, ymin: cy - (cy - v.ymin) * f, ymax: cy + (v.ymax - cy) * f }; this.draw();
  }
  tok(n) { return this.o.fixed ? (LIGHT_TOK[n] || '#1d1a1f') : cssv(n); }
  col(c) { return (c && c.startsWith('var(')) ? this.tok(c.slice(4, -1)) : c; }
  setHome(h) { this.home = { ...h }; this.v = { ...h }; this.draw(); }
  togglePal() {
    if (!this.pal.hidden) { this.pal.hidden = true; return; }
    const ls = this.layers.filter(l => l.label && l.id);
    if (!ls.length) return;
    if (!this.sel || !ls.find(l => l.id === this.sel)) this.sel = ls[0].id;
    const cur = () => ({ ...ls.find(l => l.id === this.sel), ...(this.style[this.sel] || {}) });
    const c = cur();
    this.pal.innerHTML = `<label for="${this.uid('ps')}">Objeto</label><select id="${this.uid('ps')}">${ls.map(l => `<option value="${l.id}" ${l.id === this.sel ? 'selected' : ''}>${l.label}</option>`).join('')}</select>
      <label>Color</label><div class="sws">${SWATCHES.map(s => `<button data-c="${s}" style="background:${colorOf(s)}" aria-label="Color" class="${s === c.color ? 'on' : ''}"></button>`).join('')}</div>
      <label for="${this.uid('pw')}">Grosor</label><input type="range" id="${this.uid('pw')}" min="1" max="7" step="0.5" value="${c.width || 2.2}">
      <label>Tipo de línea</label><div class="seg"><button data-d="solid">Continua</button><button data-d="dash">Trazos</button><button data-d="dot">Puntos</button></div>`;
    this.pal.hidden = false;
    const sync = () => { const cc = cur(); $$('.sws button', this.pal).forEach(b => b.classList.toggle('on', b.dataset.c === cc.color)); $$('.seg button', this.pal).forEach(b => b.classList.toggle('on', (cc.dash || 'solid') === b.dataset.d)); $('input[type=range]', this.pal).value = cc.width || 2.2; };
    sync();
    const st = () => (this.style[this.sel] = this.style[this.sel] || {});
    $('select', this.pal).onchange = e => { this.sel = e.target.value; sync(); this.draw(); };
    $$('.sws button', this.pal).forEach(b => b.onclick = () => { st().color = b.dataset.c; sync(); this.draw(); });
    $('input[type=range]', this.pal).oninput = e => { st().width = +e.target.value; this.draw(); };
    $$('.seg button', this.pal).forEach(b => b.onclick = () => { st().dash = b.dataset.d; sync(); this.draw(); });
    this.draw();
  }
  uid(p) { this._u = this._u || Math.random().toString(36).slice(2, 7); return p + this._u; }
  bind() {
    const cv = this.cv, pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); this.ptrs.set(e.pointerId, pos(e));
      if (this.ptrs.size === 2) { const [a, b] = [...this.ptrs.values()]; this.drag = { t: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), v0: { ...this.v }, c: { x: this.ix((a.x + b.x) / 2), y: this.iy((a.y + b.y) / 2) } }; return; }
      const p = pos(e), ax = this.axisHit(p);
      if (ax) { this.drag = { t: ax, p0: p, v0: { ...this.v } }; return; }
      if (this.mode === 'select') { this.pick(p); this.drag = { t: 'probe' }; return; }
      this.drag = { t: 'pan', p0: p, v0: { ...this.v } }; cv.style.cursor = 'grabbing';
    });
    cv.addEventListener('pointermove', e => {
      const p = pos(e); if (this.ptrs.has(e.pointerId)) this.ptrs.set(e.pointerId, p);
      const d = this.drag;
      if (!d) { const ax = this.axisHit(p); cv.style.cursor = ax === 'sx' ? 'ew-resize' : ax === 'sy' ? 'ns-resize' : this.mode === 'select' ? 'crosshair' : 'grab'; return; }
      const v0 = d.v0, W = this.W, H = this.H;
      if (d.t === 'pinch' && this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.values()], f = d.d0 / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), c = d.c;
        this.v = { xmin: c.x - (c.x - v0.xmin) * f, xmax: c.x + (v0.xmax - c.x) * f, ymin: c.y - (c.y - v0.ymin) * f, ymax: c.y + (v0.ymax - c.y) * f };
      } else if (d.t === 'pan') {
        const dx = (p.x - d.p0.x) / W * (v0.xmax - v0.xmin), dy = (p.y - d.p0.y) / H * (v0.ymax - v0.ymin);
        this.v = { xmin: v0.xmin - dx, xmax: v0.xmax - dx, ymin: v0.ymin + dy, ymax: v0.ymax + dy };
      } else if (d.t === 'sx') {
        const f = Math.exp(-(p.x - d.p0.x) / 140), c = (v0.xmin + v0.xmax) / 2;
        this.v = { ...this.v, xmin: c - (c - v0.xmin) * f, xmax: c + (v0.xmax - c) * f };
      } else if (d.t === 'sy') {
        const f = Math.exp((p.y - d.p0.y) / 140), c = (v0.ymin + v0.ymax) / 2;
        this.v = { ...this.v, ymin: c - (c - v0.ymin) * f, ymax: c + (v0.ymax - c) * f };
      } else if (d.t === 'probe') { this.pick(p); return; }
      this.draw();
    });
    const up = e => { this.ptrs.delete(e.pointerId); if (this.ptrs.size < 2 && this.drag && this.drag.t === 'pinch') this.drag = null; if (!this.ptrs.size) { this.drag = null; cv.style.cursor = this.mode === 'select' ? 'crosshair' : 'grab'; } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', e => { e.preventDefault(); const p = pos(e); this.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, this.ix(p.x), this.iy(p.y)); }, { passive: false });
  }
  axisHit(p) { if (this.axY != null && Math.abs(p.y - this.axY) < 8) return 'sx'; if (this.axX != null && Math.abs(p.x - this.axX) < 8) return 'sy'; return null; }
  X(x) { return (x - this.v.xmin) / (this.v.xmax - this.v.xmin) * this.W; }
  Y(y) { return this.H - (y - this.v.ymin) / (this.v.ymax - this.v.ymin) * this.H; }
  ix(px) { return this.v.xmin + px / this.W * (this.v.xmax - this.v.xmin); }
  iy(py) { return this.v.ymin + (this.H - py) / this.H * (this.v.ymax - this.v.ymin); }
  resize() {
    const w = Math.round(this.stage.getBoundingClientRect().width); if (w < 20) return;
    const h = (!this.o.fixed && window.innerWidth < 560) ? Math.min(this.o.h, 280) : this.o.h, dpr = this.o.scale || window.devicePixelRatio || 1;
    this.W = w; this.H = h; this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.draw();
  }
  set(layers) { this.layers = layers; if (this.probe) this.probe = null, this.read.hidden = true; this.draw(); }
  pick(p) {
    let best = null;
    for (const L of this.layers) {
      if (!L.label || L.type === 'band') continue;
      if (L.type === 'fn') { const x = this.ix(p.x); if (L.dom && (x < L.dom[0] || x > L.dom[1])) continue; const y = L.fn(x); if (!isFinite(y)) continue; const d = Math.abs(this.Y(y) - p.y); if (!best || d < best.d) best = { d, x, y, L }; }
      else if (L.pts) for (const q of L.pts) { const d = Math.hypot(this.X(q[0]) - p.x, this.Y(q[1]) - p.y); if (!best || d < best.d) best = { d, x: q[0], y: q[1], L }; }
    }
    if (best && best.d < 40) {
      this.probe = best; this.sel = best.L.id || this.sel;
      const xd = this.o.xd ?? 2, yd = this.o.yd ?? 3;
      this.read.textContent = `${best.L.label} · ${this.o.xlabel.split(' ')[0]} = ${fmt(best.x, xd)} · ${this.o.ylabel.split(' ')[0]} = ${fmt(best.y, yd)}`;
      this.read.hidden = false;
    } else { this.probe = null; this.read.hidden = true; }
    this.draw();
  }
  draw() {
    const c = this.ctx, W = this.W, H = this.H, v = this.v; if (!W) return;
    const col = { bg: this.tok('--plot-bg'), gmi: this.tok('--grid-minor'), gma: this.tok('--grid-major'), ax: this.tok('--axis'), tk: this.tok('--tick'), fg: this.tok('--fg'), panel: this.tok('--panel-solid'), line: this.tok('--line') };
    c.clearRect(0, 0, W, H); c.fillStyle = col.bg; c.fillRect(0, 0, W, H);
    const sx = niceStep(v.xmax - v.xmin, W), sy = niceStep(v.ymax - v.ymin, H);
    const grid = (step, color) => {
      c.strokeStyle = color; c.lineWidth = 1; c.beginPath();
      for (let x = Math.ceil(v.xmin / step) * step; x <= v.xmax; x += step) { const px = Math.round(this.X(x)) + .5; c.moveTo(px, 0); c.lineTo(px, H); }
      for (let y = Math.ceil(v.ymin / step) * step; y <= v.ymax; y += step) { const py = Math.round(this.Y(y)) + .5; c.moveTo(0, py); c.lineTo(W, py); }
      c.stroke();
    };
    const gx = (step) => { c.beginPath(); for (let x = Math.ceil(v.xmin / step) * step; x <= v.xmax; x += step) { const px = Math.round(this.X(x)) + .5; c.moveTo(px, 0); c.lineTo(px, H); } };
    c.strokeStyle = col.gmi; c.lineWidth = 1; gx(sx / 5); c.stroke();
    c.beginPath(); for (let y = Math.ceil(v.ymin / (sy / 5)) * (sy / 5); y <= v.ymax; y += sy / 5) { const py = Math.round(this.Y(y)) + .5; c.moveTo(0, py); c.lineTo(W, py); } c.stroke();
    grid(sx, col.gma); grid(sy, col.gma);
    const axY = clamp(this.Y(0), 6, H - 20), axX = clamp(this.X(0), 44, W - 6); this.axY = axY; this.axX = axX;
    c.strokeStyle = col.ax; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, axY); c.lineTo(W - 2, axY); c.moveTo(axX, H); c.lineTo(axX, 2); c.stroke();
    c.fillStyle = col.ax; c.beginPath(); c.moveTo(W - 1, axY); c.lineTo(W - 9, axY - 4); c.lineTo(W - 9, axY + 4); c.fill();
    c.beginPath(); c.moveTo(axX, 1); c.lineTo(axX - 4, 9); c.lineTo(axX + 4, 9); c.fill();
    const dx = Math.max(0, -Math.floor(Math.log10(sx) + 1e-9)), dy = Math.max(0, -Math.floor(Math.log10(sy) + 1e-9));
    c.font = '500 11px "JetBrains Mono", ui-monospace, monospace'; c.fillStyle = col.tk;
    c.textAlign = 'center'; c.textBaseline = 'top';
    for (let x = Math.ceil(v.xmin / sx) * sx; x <= v.xmax; x += sx) { const px = this.X(x); if (Math.abs(px - axX) < 4 && Math.abs(x) < sx / 2) continue; if (px < 14 || px > W - 26) continue; c.strokeStyle = col.ax; c.beginPath(); c.moveTo(px, axY - 4); c.lineTo(px, axY + 4); c.stroke(); c.fillText(fmt(x, dx), px, axY + 5); }
    c.textAlign = 'right'; c.textBaseline = 'middle';
    for (let y = Math.ceil(v.ymin / sy) * sy; y <= v.ymax; y += sy) { const py = this.Y(y); if (Math.abs(py - axY) < 4 && Math.abs(y) < sy / 2) continue; if (py < 18 || py > H - 8) continue; c.strokeStyle = col.ax; c.beginPath(); c.moveTo(axX - 4, py); c.lineTo(axX + 4, py); c.stroke(); c.fillText(fmt(y, dy), axX - 6, py); }
    c.font = '600 11.5px Manrope, system-ui, sans-serif'; c.fillStyle = col.fg;
    c.textAlign = 'right'; c.textBaseline = 'bottom'; c.fillText(this.o.xlabel, W - 12, axY - 6);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText(this.o.ylabel, axX + 9, 6);
    for (const L0 of this.layers) {
      const L = { ...L0, ...(this.style[L0.id] || {}) }, color = this.col(L.color || 'var(--gold)');
      const w = L.width || 2.2, dash = L.dash === 'dash' ? [8, 6] : L.dash === 'dot' ? [2, 5] : [];
      const strokeIt = () => { if (this.sel === L.id && this.mode === 'select') { c.save(); c.globalAlpha = .25; c.lineWidth = w + 6; c.setLineDash([]); c.stroke(); c.restore(); } c.stroke(); };
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = w; c.setLineDash(dash); c.lineJoin = 'round'; c.lineCap = 'round';
      if (L.type === 'fn') {
        c.beginPath(); let pen = false;
        for (let px = 0; px <= W; px += 1.5) { const x = this.ix(px); if (L.dom && (x < L.dom[0] || x > L.dom[1])) { pen = false; continue; } const y = L.fn(x), py = this.Y(y); if (!isFinite(py) || Math.abs(py) > 1e5) { pen = false; continue; } pen ? c.lineTo(px, py) : c.moveTo(px, py); pen = true; }
        strokeIt();
      } else if (L.type === 'band') {
        const xs = []; for (let px = 0; px <= W; px += 2) { const x = this.ix(px); if (!L.dom || (x >= L.dom[0] && x <= L.dom[1])) xs.push(x); }
        if (xs.length > 1) { c.beginPath(); xs.forEach((x, i) => i ? c.lineTo(this.X(x), this.Y(L.fn(x))) : c.moveTo(this.X(x), this.Y(L.fn(x)))); for (let i = xs.length - 1; i >= 0; i--) c.lineTo(this.X(xs[i]), this.Y(L.fn2(xs[i]))); c.closePath(); c.globalAlpha = L.alpha ?? .16; c.fill(); c.globalAlpha = 1; }
      } else if (L.type === 'line') {
        c.beginPath(); L.pts.forEach((q, i) => i ? c.lineTo(this.X(q[0]), this.Y(q[1])) : c.moveTo(this.X(q[0]), this.Y(q[1]))); strokeIt();
      } else if (L.type === 'scatter') {
        c.setLineDash([]); c.lineWidth = 1.5; c.strokeStyle = col.bg;
        for (const q of L.pts) { c.beginPath(); c.arc(this.X(q[0]), this.Y(q[1]), L.r || 4.5, 0, 7); c.fill(); c.stroke(); }
      } else if (L.type === 'vline' || L.type === 'hline') {
        c.lineWidth = L.width || 1.2; c.setLineDash(L.dash === 'solid' ? [] : [5, 5]); c.beginPath();
        if (L.type === 'vline') { const px = this.X(L.x); c.moveTo(px, 0); c.lineTo(px, H); } else { const py = this.Y(L.y); c.moveTo(0, py); c.lineTo(W, py); }
        c.stroke();
        if (L.tag) { c.setLineDash([]); c.font = '600 11px Manrope, system-ui, sans-serif'; c.textBaseline = 'bottom'; c.textAlign = 'left'; if (L.type === 'vline') c.fillText(L.tag, this.X(L.x) + 4, H - 6); else c.fillText(L.tag, 50, this.Y(L.y) - 3); }
      } else if (L.type === 'point') {
        const px = this.X(L.x), py = this.Y(L.y); c.setLineDash([]);
        c.globalAlpha = .22; c.beginPath(); c.arc(px, py, 10, 0, 7); c.fill(); c.globalAlpha = 1;
        c.beginPath(); c.arc(px, py, 5, 0, 7); c.fill(); c.strokeStyle = col.bg; c.lineWidth = 2; c.stroke();
        if (L.tag) { c.font = '600 11.5px "JetBrains Mono", monospace'; c.fillStyle = col.fg; c.textBaseline = 'bottom'; c.textAlign = px > W - 150 ? 'right' : 'left'; c.fillText(L.tag, px + (px > W - 150 ? -10 : 10), py - 8); }
      }
      c.setLineDash([]);
    }
    if (this.probe) { const p = this.probe; c.fillStyle = col.fg; c.strokeStyle = col.bg; c.lineWidth = 2; c.beginPath(); c.arc(this.X(p.x), this.Y(p.y), 5.5, 0, 7); c.fill(); c.stroke(); }
    const leg = this.layers.filter(l => l.label && !l.noLegend);
    if (leg.length) {
      c.font = '600 11.5px Manrope, system-ui, sans-serif'; const lw = Math.max(...leg.map(l => c.measureText(l.label).width)) + 44, lh = 18;
      const x0 = axX < 140 ? W - lw - 10 : 10, y0 = 10;
      c.fillStyle = col.panel; c.globalAlpha = .88; c.fillRect(x0, y0, lw, leg.length * lh + 10); c.globalAlpha = 1; c.strokeStyle = col.line; c.lineWidth = 1; c.strokeRect(x0 + .5, y0 + .5, lw, leg.length * lh + 10);
      leg.forEach((l0, i) => { const l = { ...l0, ...(this.style[l0.id] || {}) }, cy = y0 + 14 + i * lh, cc = this.col(l.color || 'var(--gold)'); c.strokeStyle = cc; c.fillStyle = cc;
        if (l.type === 'scatter' || l.type === 'point') { c.beginPath(); c.arc(x0 + 20, cy, 4, 0, 7); c.fill(); } else if (l.type === 'band') { c.globalAlpha = .3; c.fillRect(x0 + 10, cy - 5, 22, 10); c.globalAlpha = 1; } else { c.lineWidth = Math.min(3, l.width || 2.2); c.setLineDash(l.dash === 'dash' ? [6, 4] : l.dash === 'dot' ? [2, 4] : []); c.beginPath(); c.moveTo(x0 + 10, cy); c.lineTo(x0 + 32, cy); c.stroke(); c.setLineDash([]); }
        c.fillStyle = col.fg; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(l.label, x0 + 38, cy); });
    }
  }
}
function redrawAll() { LIVE.forEach(p => { if (p.host.isConnected) p.draw(); }); }
