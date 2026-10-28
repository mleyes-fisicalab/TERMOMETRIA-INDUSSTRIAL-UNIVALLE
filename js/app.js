
/* ====================================================================
   Motor del libro: BOOK_DATA + goToPage
   ==================================================================== */
const PAGES = $$('.page');
const BOOK_DATA = PAGES.map((el, i) => ({ i, id: el.id, title: el.dataset.title, sec: el.dataset.sec, el }));
const MOUNT = {};
let cur = -1;
const mounted = new Set(), typed = new Set();
let mjChain = Promise.resolve();
function typeset(el) {
  if (typed.has(el.id) || !(window.MathJax && MathJax.typesetPromise)) return;
  typed.add(el.id);
  mjChain = mjChain.then(() => MathJax.typesetPromise([el])).catch(err => console.warn('MathJax', err));
}
window.__onMathJax = () => { if (cur >= 0) typeset(BOOK_DATA[cur].el); };

function buildToc() {
  const toc = $('#toc'); let last = '';
  BOOK_DATA.forEach(p => {
    if (p.sec !== last) { const h = document.createElement('h4'); h.textContent = p.sec; toc.appendChild(h); last = p.sec; }
    const b = document.createElement('button'); b.dataset.i = p.i;
    b.innerHTML = `<span>${String(p.i + 1).padStart(2, '0')}</span>${p.title}`;
    b.onclick = () => goToPage(p.i); toc.appendChild(b);
  });
  const route = $('#route'), seen = new Set();
  BOOK_DATA.forEach(p => { if (seen.has(p.sec) || p.i === 0) return; seen.add(p.sec);
    const b = document.createElement('button'); b.innerHTML = `<small>${p.sec}</small>${p.title}`; b.onclick = () => goToPage(p.i); route.appendChild(b); });
}
function goToPage(i, push = true) {
  i = clamp(i, 0, BOOK_DATA.length - 1); const p = BOOK_DATA[i];
  BOOK_DATA.forEach(q => q.el.hidden = q.i !== i);
  cur = i;
  $('#secName').textContent = p.sec; $('#pageName').textContent = p.title;
  $('#count').textContent = `${i + 1} / ${BOOK_DATA.length}`;
  $('#prog').style.width = ((i + 1) / BOOK_DATA.length * 100) + '%';
  $$('#toc button').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
  const on = $('#toc button.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  $('#prevBtn').disabled = i === 0; $('#nextBtn').disabled = i === BOOK_DATA.length - 1;
  const pv = BOOK_DATA[i - 1], nx = BOOK_DATA[i + 1];
  $('#pager').innerHTML = (pv ? `<button class="pv" data-go="${i - 1}"><small>Anterior</small><span>${pv.title}</span></button>` : '') + (nx ? `<button class="nx" data-go="${i + 1}"><small>Siguiente</small><span>${nx.title}</span></button>` : '');
  store.set('page', i);
  if (push) try { history.replaceState(null, '', '#' + p.id); } catch (e) {}
  window.scrollTo(0, 0);
  if (!mounted.has(p.id)) { mounted.add(p.id); try { MOUNT[p.id] && MOUNT[p.id](p.el); } catch (err) { console.error(p.id, err); } }
  typeset(p.el);
  closeDrawer();
}
function openDrawer() { $('#side').classList.add('open'); $('#scrim').hidden = false; }
function closeDrawer() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }

function initTheme() {
  const t = store.get('theme', null); if (t) document.documentElement.setAttribute('data-theme', t);
  $('#themeBtn').onclick = () => {
    const now = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = now === 'dark' ? 'light' : 'dark'; document.documentElement.setAttribute('data-theme', nx); store.set('theme', nx); redrawAll();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redrawAll);
}

/* ---------- utilidades de interfaz ---------- */
function seg(id, cb) { const el = $(id); el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; $$('button', el).forEach(x => x.classList.toggle('on', x === b)); cb(b.dataset.v ?? b.dataset.t); }); return () => $('button.on', el)?.dataset.v; }
const nc = s => String(s).replace(/([\u0370-\u03ffµ]+)/g, '<span class="nc">$1</span>');
function kpis(el, items) { el.innerHTML = items.map(k => `<div class="kpi ${k.c || ''}"><small>${nc(k.l)}</small><b>${k.v}${k.u ? `<i>${k.u}</i>` : ''}</b></div>`).join(''); }
function bindOut(inp, out, f) { const u = () => $(out).textContent = f(+$(inp).value); $(inp).addEventListener('input', u); u(); }

/* ====================================================================
   I · Cadena de medición
   ==================================================================== */
MOUNT.cadena = () => {
  const desc = [
    'El proceso: agua calentada en un tanque. La temperatura es la variable de proceso (PV) que queremos conocer y controlar.',
    'Elemento primario TE: la resistencia de platino cambia unos 0,385 Ω por cada grado. Es una magnitud física, todavía no una señal.',
    'Un puente de Wheatstone excitado con 2,5 V convierte el cambio de resistencia en milivoltios; un amplificador de instrumentación con ganancia 50 lleva la señal a voltios.',
    'El transmisor TT escala la medición calibrada de 0 a 200 °C a 4–20 mA. La corriente no se degrada con la resistencia del cable.',
    'El indicador-controlador TIC recibe la corriente, la convierte de nuevo a °C, la muestra y la compara con el punto de consigna.'
  ];
  const up = () => {
    const t = +$('#ch-T').value; $('#ch-To').textContent = fmt(t, 1) + ' °C';
    const R = ptR(t), vo = 2.5 * (R / (R + 100) - 0.5) * 1000, va = vo * 50 / 1000, I = 4 + 16 * t / 200;
    $('#ch-v0').innerHTML = `${fmt(t, 1)}<i> °C</i>`;
    $('#ch-v1').innerHTML = `${fmt(R, 2)}<i> Ω</i>`;
    $('#ch-v2').innerHTML = `${fmt(vo, 1)}<i> mV</i> → ${fmt(va, 2)}<i> V</i>`;
    $('#ch-v3').innerHTML = `${fmt(I, 2)}<i> mA</i>`;
    $('#ch-v4').innerHTML = `${fmt((I - 4) / 16 * 200, 1)}<i> °C</i>`;
  };
  const show = i => { $$('#chain .node').forEach((n, k) => n.classList.toggle('on', k === i)); $('#ch-desc').textContent = desc[i]; };
  $('#chain').addEventListener('click', e => { const n = e.target.closest('.node'); if (n) show(+n.dataset.i); });
  $('#ch-T').addEventListener('input', up); up(); show(0);
};

/* ---------- respuesta dinámica ---------- */
MOUNT.caract = () => {
  const pl = new Plane($('#dy-plot'), { xmin: -5, xmax: 70, ymin: 0, ymax: 110, xlabel: 't (s)', ylabel: 'T (°C)', title: 'Respuesta al escalón', xd: 1, yd: 2 });
  const up = (rehome) => {
    const tau = +$('#dy-tau').value, ti = +$('#dy-ti').value, tf = +$('#dy-tf').value;
    $('#dy-tauo').textContent = tau + ' s'; $('#dy-tio').textContent = ti + ' °C'; $('#dy-tfo').textContent = tf + ' °C';
    $('#dy-k1').textContent = fmt(tau, 1) + ' s'; $('#dy-k2').textContent = fmt(3 * tau, 1) + ' s'; $('#dy-k3').textContent = fmt(5 * tau, 1) + ' s';
    const xmax = Math.max(20, 6 * tau), lo = Math.min(ti, tf), hi = Math.max(ti, tf), pad = Math.max(8, (hi - lo) * .15);
    if (rehome) pl.setHome({ xmin: -xmax * .08, xmax, ymin: Math.min(0, lo - pad), ymax: hi + pad });
    const f = t => t < 0 ? ti : tf + (ti - tf) * Math.exp(-t / tau);
    pl.set([
      { id: 'pr', type: 'line', label: 'Temperatura del proceso', color: 'var(--c-ref)', dash: 'dash', pts: [[-1e4, ti], [0, ti], [0, tf], [1e4, tf]] },
      { id: 'se', type: 'fn', label: 'Lectura del sensor', color: 'var(--gold)', width: 2.6, fn: f },
      { id: 'h63', type: 'hline', y: ti + .632 * (tf - ti), color: 'var(--tick)', tag: '63,2 %' },
      { id: 'h95', type: 'hline', y: ti + .95 * (tf - ti), color: 'var(--tick)', tag: '95 %' },
      { id: 'v1', type: 'vline', x: tau, color: 'var(--c-rtd)', tag: 'τ' },
      { id: 'v3', type: 'vline', x: 3 * tau, color: 'var(--c-rtd)', tag: '3τ' },
      { id: 'p', type: 'point', x: tau, y: f(tau), color: 'var(--gold)' }
    ]);
  };
  ['#dy-tau', '#dy-ti', '#dy-tf'].forEach(s => $(s).addEventListener('input', () => up(true)));
  seg('#dy-pre', v => { $('#dy-tau').value = v; up(true); });
  up(true);
};

/* ====================================================================
   II · Simulador Pt100
   ==================================================================== */
MOUNT.simrtd = () => {
  let w = 3, cl = 'A';
  const p1 = new Plane($('#r-plot1'), { xmin: -60, xmax: 420, ymin: 70, ymax: 260, xlabel: 'T (°C)', ylabel: 'R (Ω)', title: 'Curva R–T de la Pt100', xd: 1, yd: 2 });
  const p2 = new Plane($('#r-plot2'), { xmin: -60, xmax: 420, ymin: -3, ymax: 6, xlabel: 'T (°C)', ylabel: 'Error (°C)', title: 'Error frente a tolerancia', xd: 1, yd: 2, h: 300 });
  const cfg = () => ({ L: +$('#r-L').value, awg: +$('#r-awg').value, I: +$('#r-I').value, d: +$('#r-d').value });
  const model = (T, c) => {
    const rl = c.L * c.awg, dT = c.I * c.I * ptR(T) / 1000 / c.d, lead = w === 2 ? 2 * rl : w === 3 ? 0.02 * rl : 0;
    const Rs = ptR(T + dT), Rm = Rs + lead;
    return { rl, dT, lead, Rs, Rm, Tind: ptT(Rm), eLead: ptT(ptR(T) + lead) - T };
  };
  const up = (rehome) => {
    const T = +$('#r-T').value, c = cfg(), m = model(T, c), err = m.Tind - T, tol = tolPt(cl, T), ok = Math.abs(err) <= tol;
    $('#r-To').textContent = fmt(T, 1) + ' °C'; $('#r-Lo').textContent = c.L + ' m'; $('#r-Io').textContent = fmt(c.I, 1) + ' mA'; $('#r-do').textContent = fmt(c.d, 1) + ' mW/°C';
    kpis($('#r-kpis'), [
      { l: 'R del sensor', v: fmt(m.Rs, 3), u: 'Ω' }, { l: 'R que ve el instrumento', v: fmt(m.Rm, 3), u: 'Ω' },
      { l: 'T indicada', v: fmt(m.Tind, 2), u: '°C' }, { l: 'Error total', v: (err >= 0 ? '+' : '') + fmt(err, 2), u: '°C', c: ok ? 'ok' : 'bad' },
      { l: 'Por cables', v: fmt(m.eLead, 2), u: '°C' }, { l: 'Por autocalentamiento', v: fmt(m.dT, 3), u: '°C' },
      { l: 'Tolerancia clase ' + cl, v: '±' + fmt(tol, 2), u: '°C' }, { l: 'Estado', v: ok ? 'Cumple' : 'Fuera de clase', c: ok ? 'ok' : 'bad' }
    ]);
    p1.set([
      { id: 'cvd', type: 'fn', label: 'Callendar–Van Dusen', color: 'var(--c-rtd)', width: 2.6, fn: t => ptR(t), dom: [-200, 850] },
      { id: 'lin', type: 'fn', label: 'Lineal, α = 0,00385', color: 'var(--c-ref)', dash: 'dash', width: 1.8, fn: t => 100 * (1 + 0.00385 * t), dom: [-200, 850] },
      { id: 'op', type: 'point', x: T, y: m.Rm, color: 'var(--gold)', tag: `${fmt(m.Rm, 2)} Ω` }
    ]);
    const ef = t => model(t, c).Tind - t;
    if (rehome) {
      let mx = 0, mn = 0; for (let t = -50; t <= 400; t += 10) { const e = ef(t); mx = Math.max(mx, e, tolPt(cl, t)); mn = Math.min(mn, e, -tolPt(cl, t)); }
      const pad = (mx - mn) * .15 + .2; p2.setHome({ xmin: -70, xmax: 420, ymin: mn - pad, ymax: mx + pad });
    }
    p2.set([
      { id: 'tol', type: 'band', label: 'Tolerancia clase ' + cl, color: 'var(--ok)', alpha: .18, fn: t => tolPt(cl, t), fn2: t => -tolPt(cl, t), dom: [-200, 850] },
      { id: 'err', type: 'fn', label: `Error, ${w} hilos`, color: 'var(--c-tc)', width: 2.4, fn: ef, dom: [-200, 850] },
      { id: 'p', type: 'point', x: T, y: err, color: ok ? 'var(--ok)' : 'var(--bad)', tag: `${err >= 0 ? '+' : ''}${fmt(err, 2)} °C` }
    ]);
  };
  seg('#r-w', v => { w = +v; up(true); }); seg('#r-cl', v => { cl = v; up(true); });
  $('#r-T').addEventListener('input', () => up(false));
  ['#r-L', '#r-I', '#r-d', '#r-awg'].forEach(s => $(s).addEventListener('input', () => up(true)));
  up(true);
};

/* ====================================================================
   III · Simulador de termocupla
   ==================================================================== */
MOUNT.simtc = () => {
  let type = 'K', cab = 'ext';
  const CL = { K: 'var(--c-tc)', J: 'var(--c-ref)', T: 'var(--c-rtd)' };
  const pl = new Plane($('#t-plot'), { xmin: -250, xmax: 1300, ymin: -10, ymax: 56, xlabel: 'T (°C)', ylabel: 'E (mV)', title: 'f.e.m. NIST ITS-90 (referencia a 0 °C)', xd: 1, yd: 3 });
  const up = () => {
    const d = TCDATA[type], s = $('#t-Th'); s.min = d.use[0]; s.max = d.use[1];
    const Th = clamp(+s.value, d.use[0], d.use[1]), Ta = +$('#t-Ta').value, Tc = +$('#t-Tc').value, cjc = $('#t-cjc').checked;
    s.value = Th; $('#t-Tc').disabled = cab !== 'cu'; $('#t-Tc').closest('.ctrl').style.opacity = cab === 'cu' ? 1 : .45;
    $('#t-Tho').textContent = fmt(Th, 0) + ' °C'; $('#t-Tao').textContent = fmt(Ta, 1) + ' °C'; $('#t-Tco').textContent = fmt(Tc, 0) + ' °C';
    const Eh = tcE(type, Th), Vm = Eh - tcE(type, cab === 'ext' ? Ta : Tc), Ecj = tcE(type, Ta);
    const Tind = tcT(type, cjc ? Vm + Ecj : Vm), err = Tind - Th, ok = Math.abs(err) <= Math.max(2.5, 0.0075 * Math.abs(Th));
    kpis($('#t-kpis'), [
      { l: 'E(Tₕ) tabla', v: fmt(Eh, 3), u: 'mV' }, { l: 'Tensión en bornes', v: fmt(Vm, 3), u: 'mV' },
      { l: 'Compensación E(Tamb)', v: cjc ? fmt(Ecj, 3) : 'apagada', u: cjc ? 'mV' : '' },
      { l: 'T indicada', v: fmt(Tind, 1), u: '°C' }, { l: 'Error', v: (err >= 0 ? '+' : '') + fmt(err, 1), u: '°C', c: ok ? 'ok' : 'bad' },
      { l: 'Sensibilidad local', v: fmt(tcS(type, Th), 1), u: 'µV/°C' }
    ]);
    const L = ['K', 'J', 'T'].map(k => ({ id: k, type: 'fn', label: 'Tipo ' + k, color: CL[k], width: k === type ? 2.8 : 1.6, dash: k === type ? 'solid' : 'dash', fn: t => tcE(k, t), dom: TCDATA[k].use }));
    L.push({ id: 'pt', type: 'point', x: Th, y: Eh, color: 'var(--gold)', tag: `${fmt(Eh, 3)} mV` });
    if (Math.abs(Vm - Eh) > 0.01) L.push({ id: 'pm', type: 'point', x: Th, y: Vm, color: 'var(--bad)', tag: 'en bornes' });
    pl.set(L);
    $('#t-tab').innerHTML = ['K', 'J', 'T'].map(k => { const u = TCDATA[k].use, inr = Th >= u[0] && Th <= u[1];
      return `<tr><td><span class="sw" style="background:${CL[k]}"></span>Tipo ${k}</td><td class="num">${inr || (Th >= TCDATA[k].lo && Th <= TCDATA[k].hi) ? fmt(tcE(k, Th), 3) : '—'}</td><td class="num">${inr ? fmt(tcS(k, Th), 1) : '—'}</td><td>${inr ? '<span class="pill ok">Sí</span>' : '<span class="pill bad">No</span>'}</td></tr>`; }).join('');
  };
  seg('#t-type', v => { type = v; up(); }); seg('#t-cab', v => { cab = v; up(); });
  ['#t-Th', '#t-Ta', '#t-Tc'].forEach(s => $(s).addEventListener('input', up)); $('#t-cjc').addEventListener('change', up);
  up();
};

/* ====================================================================
   IV · Simulador NTC
   ==================================================================== */
MOUNT.simntc = () => {
  let R25 = 10000;
  const p1 = new Plane($('#n-plot1'), { xmin: -25, xmax: 125, ymin: 0, ymax: 50, xlabel: 'T (°C)', ylabel: 'R (kΩ)', title: 'Curva R–T del termistor', xd: 1, yd: 3 });
  const p2 = new Plane($('#n-plot2'), { xmin: -25, xmax: 125, ymin: 0, ymax: 3.5, xlabel: 'T (°C)', ylabel: 'Vo (V)', title: 'Salida del divisor', xd: 1, yd: 3, h: 300 });
  const ohm = r => r >= 1000 ? fmt(r / 1000, r >= 100000 ? 1 : 2) + ' kΩ' : fmt(r, 0) + ' Ω';
  const up = (rehome) => {
    const T = +$('#n-T').value, b = +$('#n-b').value, Rf = Math.pow(10, +$('#n-Rf').value), vcc = +$('#n-vcc').value, bits = +$('#n-bits').value;
    const c1 = num($('#n-c1').value), c2 = num($('#n-c2').value), full = Math.pow(2, bits) - 1;
    $('#n-To').textContent = fmt(T, 1) + ' °C'; $('#n-bo').textContent = b + ' K'; $('#n-Rfo').textContent = ohm(Rf); $('#n-co').textContent = `${c1} a ${c2} °C`;
    const R = t => betaR(t, R25, b), Vo = t => vcc * R(t) / (R(t) + Rf);
    const v = Vo(T), N = Math.round(v / vcc * full), Vq = N / full * vcc, Rq = Rf * Vq / (vcc - Vq), Tr = betaT(Rq, R25, b);
    const dVdT = (Vo(T + .5) - Vo(T - .5)), res = (vcc / full) / Math.abs(dVdT), sens = -b / Math.pow(T + 273.15, 2) * 100, P = v * v / R(T) * 1000;
    let nl = NaN; if (isFinite(c1) && isFinite(c2) && c2 > c1) { const a = Vo(c1), z = Vo(c2); let mx = 0; for (let t = c1; t <= c2; t += (c2 - c1) / 200) mx = Math.max(mx, Math.abs(Vo(t) - (a + (z - a) * (t - c1) / (c2 - c1)))); nl = mx / Math.abs(z - a) * 100; }
    kpis($('#n-kpis'), [
      { l: 'R del NTC', v: ohm(R(T)) }, { l: 'Tensión Vo', v: fmt(v, 4), u: 'V' }, { l: 'Cuenta ADC', v: N.toLocaleString('es-CO') },
      { l: 'T reconstruida', v: fmt(Tr, 2), u: '°C' }, { l: 'Resolución', v: fmt(res, 3), u: '°C/LSB' },
      { l: 'Sensibilidad', v: fmt(sens, 2), u: '%/°C' }, { l: 'No linealidad', v: fmt(nl, 2), u: '% FS', c: nl < 1 ? 'ok' : nl > 5 ? 'bad' : 'warn' },
      { l: 'Potencia en NTC', v: fmt(P, 3), u: 'mW' }
    ]);
    if (rehome) { p1.setHome({ xmin: -25, xmax: 125, ymin: -R25 / 1000 * .2, ymax: R25 / 1000 * 4.2 }); p2.setHome({ xmin: -25, xmax: 125, ymin: -vcc * .06, ymax: vcc * 1.08 }); }
    p1.set([
      { id: 'r', type: 'fn', label: `NTC ${ohm(R25)}, β = ${b} K`, color: 'var(--c-ntc)', width: 2.6, fn: t => R(t) / 1000, dom: [-55, 150] },
      { id: 'rf', type: 'hline', y: Rf / 1000, color: 'var(--c-ref)', tag: 'R_f = ' + ohm(Rf) },
      { id: 'p', type: 'point', x: T, y: R(T) / 1000, color: 'var(--gold)', tag: ohm(R(T)) }
    ]);
    const L = [{ id: 'vo', type: 'fn', label: 'Vo(T)', color: 'var(--c-ntc)', width: 2.6, fn: Vo, dom: [-55, 150] }];
    if (isFinite(nl)) L.push({ id: 'ln', type: 'line', label: 'Recta del rango', color: 'var(--c-ref)', dash: 'dash', width: 1.8, pts: [[c1, Vo(c1)], [c2, Vo(c2)]] });
    L.push({ id: 'p', type: 'point', x: T, y: v, color: 'var(--gold)', tag: fmt(v, 3) + ' V' });
    p2.set(L);
  };
  seg('#n-R25', v => { R25 = +v; $('#n-Rf').value = Math.log10(R25).toFixed(2); up(true); });
  $('#n-T').addEventListener('input', () => up(false));
  ['#n-b', '#n-Rf', '#n-c1', '#n-c2'].forEach(s => $(s).addEventListener('input', () => up(false)));
  ['#n-vcc', '#n-bits'].forEach(s => $(s).addEventListener('change', () => up(true)));
  $('#n-opt').onclick = () => {
    const c1 = num($('#n-c1').value), c2 = num($('#n-c2').value), b = +$('#n-b').value; if (!(c2 > c1)) { toast('Escribe un rango válido: la temperatura máxima debe ser mayor que la mínima.'); return; }
    const tc = (c1 + c2) / 2, Tk = tc + 273.15, rf = betaR(tc, R25, b) * (b - 2 * Tk) / (b + 2 * Tk);
    $('#n-Rf').value = clamp(Math.log10(rf), 2.7, 5.7).toFixed(2); up(false); toast('R_f ajustada a ' + ohm(rf) + ' (inflexión en ' + fmt(tc, 1) + ' °C)');
  };
  up(true);
};

/* ====================================================================
   V · Acondicionamiento y 4–20 mA
   ==================================================================== */
MOUNT.acond = () => {
  let s = 'pt';
  const pl = new Plane($('#a-plot'), { xmin: -30, xmax: 180, ymin: 0, ymax: 24, xlabel: 'T (°C)', ylabel: 'I (mA)', title: 'Característica del transmisor', xd: 1, yd: 2 });
  const curr = (T, lrv, urv) => clamp(4 + 16 * (T - lrv) / (urv - lrv), 3.8, 20.5);
  const up = (rehome) => {
    const T = +$('#a-T').value, lrv = num($('#a-lrv').value), urv = num($('#a-urv').value), vx = +$('#a-vx').value, rg = +$('#a-rg').value, brk = $('#a-brk').checked;
    const G = 1 + 49400 / rg;
    $('#a-To').textContent = fmt(T, 1) + ' °C'; $('#a-vxo').textContent = fmt(vx, 1) + ' V'; $('#a-rgo').textContent = fmt(rg, 0) + ' Ω · G = ' + fmt(G, 1);
    if (!(urv > lrv)) { kpis($('#a-kpis'), [{ l: 'Rango', v: 'URV debe ser mayor que LRV', c: 'bad' }]); return; }
    let sig, out;
    if (s === 'pt') { const R = ptR(T), vo = vx * (R / (R + 100) - .5); sig = { l: 'R Pt100', v: fmt(R, 2), u: 'Ω' }; out = vo * G; sig.b = { l: 'Salida del puente', v: fmt(vo * 1000, 2), u: 'mV' }; }
    else if (s === 'tc') { const E = tcE('K', T); sig = { l: 'f.e.m. tipo K', v: fmt(E, 3), u: 'mV' }; out = E / 1000 * G; sig.b = { l: 'Con CJC a 0 °C', v: 'ref. 0 °C', u: '' }; }
    else { const R = betaR(T, 10000, 3950), vo = 3.3 * R / (R + 10000); sig = { l: 'R NTC 10 kΩ', v: fmt(R / 1000, 3), u: 'kΩ' }; out = vo; sig.b = { l: 'Divisor 3,3 V', v: fmt(vo, 3), u: 'V' }; }
    const pct = (T - lrv) / (urv - lrv) * 100;
    let I = curr(T, lrv, urv), st = 'Normal', c = 'ok';
    if (brk) { I = 3.6; st = 'Falla (≤ 3,6 mA)'; c = 'bad'; }
    else if (pct < -1.25 || pct > 103.1) { st = 'Saturado fuera de rango'; c = 'warn'; }
    kpis($('#a-kpis'), [sig, sig.b, { l: s === 'ntc' ? 'Señal al ADC' : 'Salida del INA128', v: fmt(out, 3), u: 'V', c: (s !== 'ntc' && Math.abs(out) > 4.9) ? 'bad' : '' },
      { l: '% del alcance', v: brk ? '—' : fmt(pct, 1), u: '%' }, { l: 'Corriente del lazo', v: fmt(I, 2), u: 'mA', c }, { l: 'V en 250 Ω', v: fmt(I * .25, 3), u: 'V' }, { l: 'Estado NAMUR NE 43', v: st, c }]);
    if (rehome) { const sp = urv - lrv; pl.setHome({ xmin: lrv - .2 * sp, xmax: urv + .2 * sp, ymin: 0, ymax: 24 }); }
    pl.set([
      { id: 'i', type: 'fn', label: 'I(T)', color: 'var(--gold)', width: 2.6, fn: t => curr(t, lrv, urv) },
      { id: 'h4', type: 'hline', y: 4, color: 'var(--tick)', tag: '4 mA · LRV' }, { id: 'h20', type: 'hline', y: 20, color: 'var(--tick)', tag: '20 mA · URV' },
      { id: 'f1', type: 'hline', y: 3.6, color: 'var(--bad)', tag: '3,6 mA falla' }, { id: 'f2', type: 'hline', y: 21, color: 'var(--bad)', tag: '21 mA falla' },
      { id: 'p', type: 'point', x: T, y: I, color: brk ? 'var(--bad)' : 'var(--c-rtd)', tag: fmt(I, 2) + ' mA' }
    ]);
  };
  seg('#a-s', v => { s = v; up(false); });
  $('#a-T').addEventListener('input', () => up(false)); ['#a-vx', '#a-rg'].forEach(x => $(x).addEventListener('input', () => up(false)));
  ['#a-lrv', '#a-urv'].forEach(x => $(x).addEventListener('input', () => up(true))); $('#a-brk').addEventListener('change', () => up(false));
  up(true);
};

/* ---------- comparativa ---------- */
MOUNT.compara = () => {
  const pl = new Plane($('#c-plot'), { xmin: -8, xmax: 165, ymin: -8, ymax: 112, xlabel: 'T (°C)', ylabel: 'Salida (%)', title: 'Salida normalizada entre 0 y 150 °C', xd: 1, yd: 2 });
  const norm = f => t => (f(t) - f(0)) / (f(150) - f(0)) * 100;
  pl.set([
    { id: 'id', type: 'line', label: 'Lineal ideal', color: 'var(--tick)', dash: 'dot', width: 1.6, pts: [[0, 0], [150, 100]] },
    { id: 'pt', type: 'fn', label: 'Pt100', color: 'var(--c-rtd)', width: 2.6, fn: norm(t => ptR(t)), dom: [0, 150] },
    { id: 'tc', type: 'fn', label: 'Termocupla K', color: 'var(--c-tc)', width: 2.6, fn: norm(t => tcE('K', t)), dom: [0, 150] },
    { id: 'ntc', type: 'fn', label: 'NTC 10 kΩ', color: 'var(--c-ntc)', width: 2.6, fn: norm(t => betaR(t, 10000, 3950)), dom: [0, 150] }
  ]);
  const S = [
    { q: 'Horno de tratamiento térmico de piezas de acero que opera a 950 °C.', a: 'Termocupla', why: 'Solo la termocupla cubre esa temperatura a bajo costo. Una tipo K o, mejor, tipo N por su estabilidad, con vaina cerámica.' },
    { q: 'Reactor farmacéutico que debe mantenerse a 37,0 ± 0,2 °C con trazabilidad metrológica.', a: 'Pt100', why: 'Se necesita exactitud y estabilidad a largo plazo: Pt100 clase AA o A a 4 hilos, calibrable contra un patrón.' },
    { q: 'Protección térmica de bajo costo para el paquete de baterías de un cargador (0 a 60 °C).', a: 'NTC', why: 'Rango estrecho, gran sensibilidad y costo mínimo. El NTC se lee directo con el ADC del microcontrolador.' },
    { q: 'Cuarto frío de alimentos a −20 °C con el PLC a 80 m del punto de medición.', a: 'Pt100', why: 'Buena exactitud en ese rango. Con transmisor de cabezal 4–20 mA el cable largo deja de ser un problema; sin transmisor, mínimo 3 hilos.' }
  ];
  $('#scen').innerHTML = S.map((s, i) => `<div class="card"><p style="margin:0">${s.q}</p><div class="opts">${['Pt100', 'Termocupla', 'NTC'].map(o => `<button class="btn sm" data-i="${i}" data-o="${o}">${o}</button>`).join('')}</div><p class="fb" hidden></p></div>`).join('');
  $('#scen').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const s = S[+b.dataset.i], card = b.closest('.card'), fb = $('.fb', card), ok = b.dataset.o === s.a;
    fb.hidden = false; fb.className = 'fb ' + (ok ? 'ok' : 'bad'); fb.style.marginTop = '10px'; fb.textContent = (ok ? 'Correcto. ' : `Mejor opción: ${s.a}. `) + s.why; });
};

/* ====================================================================
   VI · Laboratorio virtual
   ==================================================================== */
const getId = () => store.get('id', {});
const getBench = () => { const id = getId(); return id.code ? bench(id.code) : null; };
MOUNT.labid = () => {
  const id = getId(), f = ['name', 'code', 'mates', 'group', 'date'];
  f.forEach(k => { const el = $('#id-' + k); el.value = id[k] || (k === 'date' ? new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''); el.addEventListener('input', () => { const o = getId(); if (k !== 'code') { o[k] = el.value; store.set('id', o); } }); });
  const show = () => { const b = getBench(), o = getId(); if (!b) return;
    $('#id-bench').className = ''; $('#id-bench').innerHTML = `<div class="row" style="margin-bottom:10px"><span class="pill ok">Banco ${b.id} asignado</span><span class="tag">código ${o.code}</span></div>
      <ul style="margin:0"><li>Pt100 clase A en baño termostático, con cable de longitud desconocida.</li><li>Termocupla tipo K en horno de pozo seco y voltímetro sin compensación.</li><li>NTC de 10 kΩ en divisor con ESP32 (ADC de 12 bits, 3,3 V).</li></ul>`; };
  $('#id-go').onclick = () => {
    const code = $('#id-code').value.trim(); if (!code) { toast('Escribe tu código estudiantil.'); return; }
    const o = getId(); if (o.code && o.code !== code) ['lab1', 'lab2', 'lab3'].forEach(k => store.set('lab:' + k, []));
    f.forEach(k => o[k] = $('#id-' + k).value.trim()); store.set('id', o); show(); toast('Banco asignado. Ya puedes ir a la práctica 1.');
  };
  show();
};

function makeLab(o) {
  let rows = store.get('lab:' + o.key, []), Tb = null, until = 0, last = null;
  const el = $('#' + o.key);
  const P = o.p, spEl = $('#' + P + '-sp');
  const settle = () => { Tb = +spEl.value + noise(o.bathSd); until = Date.now() + 1600; };
  bindOut('#' + P + '-sp', '#' + P + '-spo', v => v + ' °C');
  spEl.addEventListener('input', settle); settle(); until = Date.now() + 700;
  const tick = () => {
    if (el.hidden) return; const b = getBench();
    if (!b) { $('#' + P + '-st').textContent = 'Sin banco asignado'; o.d.forEach(d => $('#' + d).textContent = '—'); return; }
    const settling = Date.now() < until; $('#' + P + '-st').textContent = settling ? 'Estabilizando…' : 'Estable · listo para registrar';
    const T = settling ? Tb + (Math.random() - .5) * 3 * (until - Date.now()) / 1600 : Tb;
    last = o.read(b, T); o.disp(last).forEach((s, i) => $('#' + o.d[i]).textContent = s);
  };
  setInterval(tick, 420); tick();
  const render = () => {
    $('#' + P + '-tb').innerHTML = rows.length ? rows.map((r, i) => `<tr><td class="num">${i + 1}</td>${o.cells(r).map(c => `<td class="num">${c}</td>`).join('')}<td><button class="btn sm" data-del="${i}" aria-label="Borrar lectura ${i + 1}">Quitar</button></td></tr>`).join('')
      : `<tr><td colspan="${o.ncol + 2}" class="muted">Aún no hay lecturas. Necesitas al menos ${o.min}.</td></tr>`;
  };
  $('#' + P + '-tb').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; rows.splice(+b.dataset.del, 1); store.set('lab:' + o.key, rows); render(); });
  $('#' + P + '-rec').onclick = () => {
    if (!getBench()) { toast('Primero asigna tu banco en «Ingreso al laboratorio».'); return; }
    if (Date.now() < until) { toast('Espera a que la temperatura se estabilice.'); return; }
    rows.push({ ...last }); rows.sort((a, b) => a.T - b.T); store.set('lab:' + o.key, rows); render();
  };
  $('#' + P + '-clr').onclick = () => { if (!rows.length) return; const b = $('#' + P + '-clr'); if (b.dataset.sure) { rows = []; store.set('lab:' + o.key, rows); render(); $('#' + P + '-res').innerHTML = ''; b.textContent = 'Borrar tabla'; delete b.dataset.sure; } else { b.dataset.sure = 1; b.textContent = '¿Seguro? Pulsa otra vez'; setTimeout(() => { b.textContent = 'Borrar tabla'; delete b.dataset.sure; }, 3000); } };
  $('#' + P + '-an').onclick = () => {
    if (rows.length < o.min) { toast(`Necesitas al menos ${o.min} lecturas; llevas ${rows.length}.`); return; }
    const A = o.analyze(rows), box = $('#' + P + '-res');
    box.innerHTML = `<h3>Resultados del análisis</h3><div class="kpis">${A.kpis.map(k => `<div class="kpi ${k.c || ''}"><small>${nc(k.l)}</small><b>${k.v}${k.u ? `<i>${k.u}</i>` : ''}</b></div>`).join('')}</div>
      <div class="tbl"><table><thead><tr>${A.head.map(h => `<th class="num">${nc(h)}</th>`).join('')}</tr></thead><tbody>${A.body.map(r => `<tr>${r.map(c => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${A.plots.map((_, i) => `<div id="${P}-pl${i}" style="margin-top:14px"></div>`).join('')}`;
    A.plots.forEach((pc, i) => { const pl = new Plane($(`#${P}-pl${i}`), pc.o); pl.set(pc.layers); });
  };
  const ta = $('#' + P + '-txt'); ta.value = store.get('txt:' + o.key, ''); ta.addEventListener('input', () => store.set('txt:' + o.key, ta.value));
  render();
  if (rows.length >= o.min) $('#' + P + '-an').click();
}

/* --- análisis de cada práctica (también los usa el informe) --- */
function an1(rows) {
  const T = rows.map(r => r.T), R4 = rows.map(r => r.R4), f = linfit(T, R4), R0 = f.b, al = f.m / f.b;
  const q = lsq(rows.map(r => [1, r.T, r.T * r.T]), R4), qR0 = q[0], qA = q[1] / q[0], qB = q[2] / q[0];
  const lead = rows.reduce((s, r) => s + (r.R2 - r.R4), 0) / rows.length;
  const det = rows.map(r => { const e4 = ptT(r.R4) - r.T, e2 = ptT(r.R2) - r.T, tol = tolPt('A', r.T); return { T: r.T, e4, e2, tol, ok4: Math.abs(e4) <= tol, res: r.R4 - (f.m * r.T + f.b) }; });
  const ok4 = det.every(d => d.ok4), e2m = det.reduce((s, d) => s + d.e2, 0) / det.length, rmax = Math.max(...det.map(d => Math.abs(d.res)));
  return { f, R0, al, eal: (al - 0.00385) / 0.00385 * 100, qR0, qA, qB, lead, det, ok4, e2m, rmax, S: f.m };
}
function an2(rows) {
  const det = rows.map(r => { const Ec = r.E + tcE('K', r.Ta), Tc = tcT('K', Ec), Tn = tcT('K', r.E), tol = Math.max(2.5, 0.0075 * Math.abs(r.T)); return { ...r, Ec, Tc, Tn, ec: Tc - r.T, en: Tn - r.T, tol, ok: Math.abs(Tc - r.T) <= tol }; });
  const f = linfit(rows.map(r => r.T - r.Ta), rows.map(r => r.E));
  const enm = det.reduce((s, d) => s + d.en, 0) / det.length, ecmax = Math.max(...det.map(d => Math.abs(d.ec))), tam = rows.reduce((s, r) => s + r.Ta, 0) / rows.length;
  return { det, f, S: f.m * 1000, enm, ecmax, tam, ok: det.every(d => d.ok) };
}
function an3(rows) {
  const Tk = rows.map(r => r.T + 273.15), L = rows.map(r => Math.log(r.R));
  const f = linfit(Tk.map(t => 1 / t), L), beta = f.m, R25 = Math.exp(f.b + beta / 298.15);
  const c = lsq(L.map(l => [1, l, l * l * l]), Tk.map(t => 1 / t)), co = { A: c[0], B: c[1], C: c[2] };
  const det = rows.map(r => { const eb = betaT(r.R, R25, beta) - r.T, es = shT(r.R, co) - r.T; return { ...r, eb, es }; });
  const rms = k => Math.sqrt(det.reduce((s, d) => s + d[k] * d[k], 0) / det.length);
  return { beta, R25, r2: f.r2, co, det, rmsb: rms('eb'), rmss: rms('es'), maxb: Math.max(...det.map(d => Math.abs(d.eb))), maxs: Math.max(...det.map(d => Math.abs(d.es))) };
}

const LAB1 = { key: 'lab1', p: 'l1', min: 6, ncol: 3, bathSd: .12, d: ['l1-d1', 'l1-d2', 'l1-d3'],
  read: (b, T) => { const R4 = b.pt.R(T) + noise(.012); return { T: T + noise(.02), R4, R2: R4 + 2 * b.pt.rl + noise(.012) }; },
  disp: r => [fmt(r.T, 2) + ' °C', fmt(r.R4, 3) + ' Ω', fmt(r.R2, 3) + ' Ω'],
  cells: r => [fmt(r.T, 2), fmt(r.R4, 3), fmt(r.R2, 3)],
  analyze: rows => { const a = an1(rows);
    return { kpis: [{ l: 'R₀ ajustada', v: fmt(a.R0, 3), u: 'Ω' }, { l: 'α ajustada (×10⁻³/°C)', v: fmt(a.al * 1000, 4) }, { l: 'Desviación de α', v: fmt(a.eal, 2), u: '%' },
        { l: 'R² del ajuste', v: fmt(a.f.r2, 6) }, { l: 'Sensibilidad', v: fmt(a.S, 4), u: 'Ω/°C' }, { l: 'Cables (2 hilos)', v: fmt(a.lead, 3), u: 'Ω' },
        { l: 'Error medio 2 hilos', v: fmt(a.e2m, 2), u: '°C', c: Math.abs(a.e2m) > .35 ? 'bad' : 'ok' }, { l: 'Clase A a 4 hilos', v: a.ok4 ? 'Cumple' : 'No cumple', c: a.ok4 ? 'ok' : 'bad' },
        { l: 'Ajuste CVD: A', v: fmt(a.qA * 1000, 4), u: '×10⁻³' }, { l: 'Ajuste CVD: B', v: fmt(a.qB * 1e7, 3), u: '×10⁻⁷' }],
      head: ['T patrón (°C)', 'Residuo lineal (Ω)', 'Error 4 hilos (°C)', 'Tol. clase A (°C)', 'Error 2 hilos (°C)'],
      body: a.det.map(d => [fmt(d.T, 2), fmt(d.res, 3), fmt(d.e4, 3), '±' + fmt(d.tol, 2), fmt(d.e2, 2)]),
      plots: [{ o: { xmin: -10, xmax: 165, ymin: 94, ymax: 162, xlabel: 'T (°C)', ylabel: 'R (Ω)', title: 'Datos y ajuste lineal', xd: 2, yd: 3 }, layers: [
        { id: 'cvd', type: 'fn', label: 'Pt100 nominal (CVD)', color: 'var(--c-ref)', dash: 'dash', width: 1.6, fn: t => ptR(t) },
        { id: 'fit', type: 'fn', label: `Ajuste: R = ${fmt(a.R0, 3)} + ${fmt(a.S, 4)}·T`, color: 'var(--gold)', width: 2.2, fn: t => a.f.b + a.f.m * t },
        { id: 'd2', type: 'scatter', label: 'R a 2 hilos', color: 'var(--c-tc)', pts: rows.map(r => [r.T, r.R2]) },
        { id: 'd4', type: 'scatter', label: 'R a 4 hilos', color: 'var(--c-rtd)', pts: rows.map(r => [r.T, r.R4]) }] }] }; } };
MOUNT.lab1 = () => makeLab(LAB1);

const LAB2 = { key: 'lab2', p: 'l2', min: 6, ncol: 3, bathSd: .25, d: ['l2-d1', 'l2-d2', 'l2-d3'],
  read: (b, T) => ({ T: T + noise(.05), E: b.tc.E(T, b.tc.tamb) + noise(.003), Ta: b.tc.tamb + noise(.06) }),
  disp: r => [fmt(r.T, 2) + ' °C', fmt(r.E, 3) + ' mV', fmt(r.Ta, 1) + ' °C'],
  cells: r => [fmt(r.T, 2), fmt(r.E, 3), fmt(r.Ta, 2)],
  analyze: rows => { const a = an2(rows);
    return { kpis: [{ l: 'Seebeck medio', v: fmt(a.S, 2), u: 'µV/°C' }, { l: 'R² del ajuste', v: fmt(a.f.r2, 6) }, { l: 'T ambiente media', v: fmt(a.tam, 2), u: '°C' },
        { l: 'Error medio sin CJC', v: fmt(a.enm, 2), u: '°C', c: 'bad' }, { l: 'Error máx. con CJC', v: fmt(a.ecmax, 2), u: '°C', c: a.ok ? 'ok' : 'bad' }, { l: 'Clase 2 IEC 60584', v: a.ok ? 'Cumple' : 'No cumple', c: a.ok ? 'ok' : 'bad' }],
      head: ['T patrón (°C)', 'E + E(Tamb) (mV)', 'T con CJC (°C)', 'Error CJC (°C)', 'T sin CJC (°C)', 'Error sin CJC (°C)'],
      body: a.det.map(d => [fmt(d.T, 2), fmt(d.Ec, 3), fmt(d.Tc, 2), fmt(d.ec, 2), fmt(d.Tn, 2), fmt(d.en, 2)]),
      plots: [{ o: { xmin: -20, xmax: 640, ymin: -2, ymax: 27, xlabel: 'T (°C)', ylabel: 'E (mV)', title: 'f.e.m. medida y corregida', xd: 1, yd: 3 }, layers: [
        { id: 'nist', type: 'fn', label: 'Tipo K NIST ITS-90', color: 'var(--c-ref)', dash: 'dash', width: 1.6, fn: t => tcE('K', t), dom: [-200, 1260] },
        { id: 'em', type: 'scatter', label: 'E medida (sin CJC)', color: 'var(--c-tc)', pts: rows.map(r => [r.T, r.E]) },
        { id: 'ec', type: 'scatter', label: 'E + E(Tamb)', color: 'var(--gold)', pts: a.det.map(d => [d.T, d.Ec]) }] }] }; } };
MOUNT.lab2 = () => makeLab(LAB2);

const LAB3 = { key: 'lab3', p: 'l3', min: 7, ncol: 4, bathSd: .12, d: ['l3-d1', 'l3-d2', 'l3-d3'],
  read: (b, T) => { const R = b.ntc.R(T), vcc = b.ntc.vcc, V = vcc * R / (R + b.ntc.Rf) + noise(.0015), N = clamp(Math.round(V / vcc * 4095), 1, 4094), Vq = N / 4095 * vcc; return { T: T + noise(.02), N, V: Vq, R: b.ntc.Rf * Vq / (vcc - Vq) }; },
  disp: r => [fmt(r.T, 2) + ' °C', String(r.N), fmt(r.V, 4) + ' V'],
  cells: r => [fmt(r.T, 2), String(r.N), fmt(r.V, 4), fmt(r.R, 1)],
  analyze: rows => { const a = an3(rows);
    return { kpis: [{ l: 'β ajustado', v: fmt(a.beta, 1), u: 'K' }, { l: 'R₂₅ ajustada', v: fmt(a.R25, 1), u: 'Ω' }, { l: 'R² (ln R vs 1/T)', v: fmt(a.r2, 6) },
        { l: 'S-H: A', v: a.co.A.toExponential(4).replace('.', ',') }, { l: 'S-H: B', v: a.co.B.toExponential(4).replace('.', ',') }, { l: 'S-H: C', v: a.co.C.toExponential(4).replace('.', ',') },
        { l: 'RMS modelo β', v: fmt(a.rmsb, 3), u: '°C', c: a.rmsb > .1 ? 'warn' : 'ok' }, { l: 'RMS Steinhart–Hart', v: fmt(a.rmss, 3), u: '°C', c: 'ok' }],
      head: ['T patrón (°C)', 'R_T (Ω)', 'T modelo β (°C)', 'Error β (°C)', 'T S-H (°C)', 'Error S-H (°C)'],
      body: a.det.map(d => [fmt(d.T, 2), fmt(d.R, 1), fmt(d.T + d.eb, 2), fmt(d.eb, 3), fmt(d.T + d.es, 2), fmt(d.es, 3)]),
      plots: [
        { o: { xmin: -8, xmax: 108, ymin: -2, ymax: 36, xlabel: 'T (°C)', ylabel: 'R (kΩ)', title: 'Datos y modelos ajustados', xd: 2, yd: 3 }, layers: [
          { id: 'sh', type: 'fn', label: 'Steinhart–Hart ajustado', color: 'var(--gold)', width: 2.2, fn: t => shR(t, a.co) / 1000, dom: [-20, 120] },
          { id: 'b', type: 'fn', label: 'Modelo β ajustado', color: 'var(--c-ref)', dash: 'dash', width: 1.8, fn: t => betaR(t, a.R25, a.beta) / 1000, dom: [-20, 120] },
          { id: 'd', type: 'scatter', label: 'Lecturas', color: 'var(--c-ntc)', pts: rows.map(r => [r.T, r.R / 1000]) }] },
        { o: { xmin: -8, xmax: 108, ymin: -Math.max(.3, a.maxb * 1.4), ymax: Math.max(.3, a.maxb * 1.4), xlabel: 'T (°C)', ylabel: 'Error (°C)', title: 'Residuos de cada modelo', xd: 2, yd: 3, h: 260 }, layers: [
          { id: 'eb', type: 'scatter', label: 'Error modelo β', color: 'var(--c-ref)', pts: a.det.map(d => [d.T, d.eb]) },
          { id: 'es', type: 'scatter', label: 'Error Steinhart–Hart', color: 'var(--gold)', pts: a.det.map(d => [d.T, d.es]) }] }] }; } };
MOUNT.lab3 = () => makeLab(LAB3);

/* ====================================================================
   VII · Ejercicios
   ==================================================================== */
const ANS = (() => {
  const e6 = tcT('K', 10 + tcE('K', 25)), e7b = tcT('K', 10), R60 = betaR(60, 10000, 3950), e9 = 5 * R60 / (R60 + 10000), e11 = 4 + 16 * 90 / 150;
  return { e1: [100 * (1 + .00385 * 75), 3], e2: [ptT(119.40), 2], e3: [ptT(ptR(100) + 1.59) - 100, 2], e4: [.005 * .005 * ptR(25) * 1000 / 2, 3], e5: [.3 + .005 * 200, 2],
    e6: [e6, 1], e7: [e6 - e7b, 1], e7b: [e7b, 1], e8: [R60, 0], e9: [e9, 3], e10: [Math.round(e9 / 5 * 1023), 0], e11: [e11, 2], e12: [e11 * .25, 2], e13: [8 * Math.log(12), 2] };
})();
const EX_KEYS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10', 'e11', 'e12', 'e13'];
MOUNT.ejer = el => {
  $$('.ans', el).forEach(s => { const a = ANS[s.dataset.k]; s.textContent = fmt(a[0], a[1]); });
  let st = store.get('ex', {});
  const score = () => { const n = EX_KEYS.filter(k => st[k] && st[k].ok).length; $('#ex-score').textContent = `${n} / ${EX_KEYS.length} correctos`; $('#ex-score').className = 'pill' + (n === EX_KEYS.length ? ' ok' : ''); };
  const paint = (box, k) => { const s = st[k], fb = $('.fb', box); box.classList.remove('ok', 'bad'); fb.className = 'fb'; fb.textContent = '';
    if (!s) return; box.classList.add(s.ok ? 'ok' : 'bad'); fb.classList.add(s.ok ? 'ok' : 'bad'); fb.textContent = s.ok ? 'Correcto' : 'Revisa tu cálculo'; };
  $$('.ex', el).forEach(box => {
    const k = box.dataset.k, tol = +box.dataset.tol, inp = $('input', box);
    if (st[k]) inp.value = st[k].v;
    const check = () => { const v = num(inp.value); if (!isFinite(v)) { toast('Escribe un número.'); return; } st[k] = { v: inp.value, ok: Math.abs(v - ANS[k][0]) <= tol }; store.set('ex', st); paint(box, k); score(); };
    $('button', box).onclick = check; inp.addEventListener('keydown', e => { if (e.key === 'Enter') check(); });
    paint(box, k);
  });
  $('#ex-reset').onclick = () => { st = {}; store.set('ex', st); $$('.ex', el).forEach(b => { $('input', b).value = ''; paint(b, b.dataset.k); }); score(); };
  score();
};

/* ====================================================================
   VIII · Generador del informe
   ==================================================================== */
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function reportData() {
  const id = getId(), b = getBench(), L = k => store.get('lab:' + k, []);
  const r1 = L('lab1'), r2 = L('lab2'), r3 = L('lab3'), ex = store.get('ex', {});
  return { id, b, r1, r2, r3, a1: r1.length >= 6 ? an1(r1) : null, a2: r2.length >= 6 ? an2(r2) : null, a3: r3.length >= 7 ? an3(r3) : null,
    t1: store.get('txt:lab1', ''), t2: store.get('txt:lab2', ''), t3: store.get('txt:lab3', ''), res: store.get('txt:res', ''), con: store.get('txt:con', ''),
    ex, nex: EX_KEYS.filter(k => ex[k] && ex[k].ok).length };
}
function buildReport() {
  const D = reportData(), ph = s => `<span class="pm">[${s}]</span>`, para = (t, p) => t.trim() ? t.trim().split(/\n+/).map(x => `<p>${esc(x)}</p>`).join('') : `<p>${ph(p)}</p>`;
  const tbl = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th class="num">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td class="num">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const T = []; const line = s => T.push(s); const ttab = (head, rows) => { line(head.join('\t')); rows.forEach(r => line(r.join('\t'))); line(''); };
  const id = D.id;
  let h = `<div class="cover"><p class="pm" style="margin:0 0 6px;max-width:none">Universidad del Valle · Sede Cartago · Tecnología en Electrónica</p><h1>Informe de laboratorio: medición de temperatura con RTD Pt100, termocupla tipo K y termistor NTC</h1><p class="pm" style="margin:6px 0 0;max-width:none">Instrumentación Industrial · Docente: Dra. María Elena Leyes</p>
    <div class="meta"><div><b>Estudiante:</b> ${esc(id.name) || ph('nombre')}</div><div><b>Código:</b> ${esc(id.code) || ph('código')}</div><div><b>Compañeros:</b> ${esc(id.mates) || '—'}</div><div><b>Grupo:</b> ${esc(id.group) || ph('grupo')}</div><div><b>Fecha:</b> ${esc(id.date) || ph('fecha')}</div><div><b>Banco:</b> ${D.b ? D.b.id : ph('sin asignar')}</div></div></div>`;
  line('UNIVERSIDAD DEL VALLE · SEDE CARTAGO · TECNOLOGÍA EN ELECTRÓNICA'); line('INFORME DE LABORATORIO: MEDICIÓN DE TEMPERATURA CON RTD Pt100, TERMOCUPLA TIPO K Y TERMISTOR NTC');
  line('Instrumentación Industrial · Docente: Dra. María Elena Leyes');
  line(`Estudiante: ${id.name || ''}\tCódigo: ${id.code || ''}\tGrupo: ${id.group || ''}`); line(`Compañeros: ${id.mates || '—'}\tFecha: ${id.date || ''}\tBanco: ${D.b ? D.b.id : ''}`); line('');
  h += `<h2>1. Resumen</h2>${para(D.res, 'Escribe el resumen en el generador')}`; line('1. RESUMEN'); line(D.res || '[Escribe el resumen]'); line('');
  const obj = 'Caracterizar experimentalmente una RTD Pt100, una termocupla tipo K y un termistor NTC, y relacionar sus curvas de respuesta con los modelos normalizados (IEC 60751, NIST ITS-90, Steinhart–Hart) y con la transmisión de señal de 4–20 mA.';
  h += `<h2>2. Objetivos</h2><p>${obj}</p>`; line('2. OBJETIVOS'); line(obj); line('');
  h += `<h2>3. Marco teórico</h2><p>${ph('Presenta las ecuaciones de Callendar–Van Dusen, el efecto Seebeck con la compensación de unión fría, los modelos β y Steinhart–Hart, y el escalamiento 4–20 mA, citando las referencias')}</p>`; line('3. MARCO TEÓRICO'); line('[Ecuaciones de Callendar–Van Dusen, efecto Seebeck y compensación de unión fría, modelos β y Steinhart–Hart, escalamiento 4–20 mA, con citas]'); line('');
  const proc = ['Práctica 1: la Pt100 y el termómetro patrón se sumergieron en un baño termostático entre 0 y 150 °C; la resistencia se midió a 4 hilos y a 2 hilos con un multímetro de 6½ dígitos.',
    'Práctica 2: la termocupla tipo K se ubicó en un horno de pozo seco entre 50 y 600 °C; la f.e.m. se midió con un voltímetro sin compensación interna y se registró la temperatura ambiente de los bornes.',
    'Práctica 3: el NTC se conectó en divisor con una resistencia de 10 kΩ a 3,3 V y se leyó con el ADC de 12 bits de un ESP32 en un baño entre 0 y 100 °C.'];
  h += `<h2>4. Montaje y procedimiento</h2>${proc.map(p => `<p>${p}</p>`).join('')}<p>${ph('Inserta el diagrama del montaje con simbología ISA-5.1')}</p>`; line('4. MONTAJE Y PROCEDIMIENTO'); proc.forEach(line); line('');
  h += `<h2>5. Resultados</h2>`; line('5. RESULTADOS');
  h += `<h3>5.1 Pt100</h3>`; line('5.1 Pt100');
  if (D.r1.length) { const hd = ['T patrón (°C)', 'R 4 hilos (Ω)', 'R 2 hilos (Ω)'], rw = D.r1.map(r => [fmtc(r.T, 2), fmtc(r.R4, 3), fmtc(r.R2, 3)]); h += tbl(hd, rw); ttab(hd, rw); }
  if (D.a1) { const a = D.a1, s = `Ajuste lineal: R = ${fmtc(a.R0, 3)} Ω + ${fmtc(a.S, 4)} Ω/°C · T (R² = ${fmtc(a.f.r2, 6)}). R₀ = ${fmtc(a.R0, 3)} Ω; α = ${fmtc(a.al * 1000, 5)}×10⁻³ °C⁻¹ (desviación ${fmtc(a.eal, 2)} % respecto a 0,00385). Ajuste cuadrático CVD: A = ${fmtc(a.qA * 1000, 4)}×10⁻³, B = ${fmtc(a.qB * 1e7, 3)}×10⁻⁷. Resistencia de cables en 2 hilos: ${fmtc(a.lead, 3)} Ω, error medio ${fmtc(a.e2m, 2)} °C. Clase A a 4 hilos: ${a.ok4 ? 'cumple' : 'no cumple'}.`; h += `<p>${s}</p>`; line(s); }
  else { h += `<p>${ph('Faltan lecturas: se requieren al menos 6')}</p>`; line('[Faltan lecturas de la práctica 1]'); }
  line(''); h += `<h3>5.2 Termocupla tipo K</h3>`; line('5.2 Termocupla tipo K');
  if (D.r2.length) { const hd = ['T patrón (°C)', 'E medida (mV)', 'T amb (°C)'], rw = D.r2.map(r => [fmtc(r.T, 2), fmtc(r.E, 3), fmtc(r.Ta, 2)]); h += tbl(hd, rw); ttab(hd, rw); }
  if (D.a2) { const a = D.a2, s = `Coeficiente de Seebeck medio: ${fmtc(a.S, 2)} µV/°C (R² = ${fmtc(a.f.r2, 6)}). Error medio sin compensación de unión fría: ${fmtc(a.enm, 2)} °C con temperatura ambiente media de ${fmtc(a.tam, 2)} °C. Error máximo con compensación: ${fmtc(a.ecmax, 2)} °C; clase 2 IEC 60584: ${a.ok ? 'cumple' : 'no cumple'}.`; h += `<p>${s}</p>`; line(s); }
  else { h += `<p>${ph('Faltan lecturas: se requieren al menos 6')}</p>`; line('[Faltan lecturas de la práctica 2]'); }
  line(''); h += `<h3>5.3 Termistor NTC</h3>`; line('5.3 Termistor NTC');
  if (D.r3.length) { const hd = ['T patrón (°C)', 'N ADC', 'Vo (V)', 'R_T (Ω)'], rw = D.r3.map(r => [fmtc(r.T, 2), r.N, fmtc(r.V, 4), fmtc(r.R, 1)]); h += tbl(hd, rw); ttab(hd, rw); }
  if (D.a3) { const a = D.a3, e = x => x.toExponential(5).replace('.', ','), s = `Modelo β: β = ${fmtc(a.beta, 1)} K, R₂₅ = ${fmtc(a.R25, 1)} Ω (R² = ${fmtc(a.r2, 6)}), error RMS ${fmtc(a.rmsb, 3)} °C. Steinhart–Hart: A = ${e(a.co.A)}, B = ${e(a.co.B)}, C = ${e(a.co.C)}, error RMS ${fmtc(a.rmss, 3)} °C.`; h += `<p>${s}</p>`; line(s); }
  else { h += `<p>${ph('Faltan lecturas: se requieren al menos 7')}</p>`; line('[Faltan lecturas de la práctica 3]'); }
  line(''); h += `<p>${ph('Inserta las gráficas de cada práctica con ejes rotulados y numeración de figuras')}</p>`;
  h += `<h2>6. Análisis de resultados</h2><h3>6.1 Pt100</h3>${para(D.t1, 'Escribe el análisis en la página de la práctica 1')}<h3>6.2 Termocupla</h3>${para(D.t2, 'Escribe el análisis en la página de la práctica 2')}<h3>6.3 Termistor</h3>${para(D.t3, 'Escribe el análisis en la página de la práctica 3')}`;
  line('6. ANÁLISIS DE RESULTADOS'); line('6.1 Pt100'); line(D.t1 || '[Análisis práctica 1]'); line('6.2 Termocupla'); line(D.t2 || '[Análisis práctica 2]'); line('6.3 Termistor'); line(D.t3 || '[Análisis práctica 3]'); line('');
  const exr = EX_KEYS.map((k, i) => [String(i + 1), D.ex[k] ? esc(D.ex[k].v) : '—', D.ex[k] ? (D.ex[k].ok ? 'Correcto' : 'Incorrecto') : 'Sin responder']);
  h += `<h2>7. Ejercicios</h2><p>Puntaje: <b>${D.nex} de ${EX_KEYS.length}</b> ejercicios correctos.</p>${tbl(['Ejercicio', 'Respuesta', 'Estado'], exr)}`;
  line('7. EJERCICIOS'); line(`Puntaje: ${D.nex} de ${EX_KEYS.length} correctos`); ttab(['Ejercicio', 'Respuesta', 'Estado'], exr);
  h += `<h2>8. Conclusiones</h2>${para(D.con, 'Escribe las conclusiones en el generador')}`; line('8. CONCLUSIONES'); line(D.con || '[Conclusiones]'); line('');
  const refs = ['IEC 60751:2022. Industrial platinum resistance thermometers and platinum temperature sensors.', 'IEC 60584-1:2013. Thermocouples. Part 1: EMF specifications and tolerances.', 'NIST ITS-90 Thermocouple Database, Standard Reference Database 60.', 'Steinhart, J. S., y Hart, S. R. (1968). Calibration curves for thermistors. Deep-Sea Research, 15(4), 497–503.', 'Creus Solé, A. (2010). Instrumentación industrial (8.ª ed.). Marcombo.', 'Pallás Areny, R. (2003). Sensores y acondicionadores de señal (4.ª ed.). Marcombo.'];
  h += `<h2>9. Referencias</h2><ol>${refs.map(r => `<li>${r}</li>`).join('')}</ol>`; line('9. REFERENCIAS'); refs.forEach((r, i) => line(`[${i + 1}] ${r}`));
  $('#paper').innerHTML = h;
  return T.join('\n');
}
function buildCSV() {
  const D = reportData(), o = [];
  o.push('Practica 1 - Pt100'); o.push('T_patron_C;R_4h_ohm;R_2h_ohm'); D.r1.forEach(r => o.push([fmtc(r.T, 2), fmtc(r.R4, 3), fmtc(r.R2, 3)].join(';'))); o.push('');
  o.push('Practica 2 - Termocupla K'); o.push('T_patron_C;E_mV;T_amb_C'); D.r2.forEach(r => o.push([fmtc(r.T, 2), fmtc(r.E, 3), fmtc(r.Ta, 2)].join(';'))); o.push('');
  o.push('Practica 3 - NTC'); o.push('T_patron_C;N_ADC;Vo_V;R_ohm'); D.r3.forEach(r => o.push([fmtc(r.T, 2), r.N, fmtc(r.V, 4), fmtc(r.R, 1)].join(';')));
  return o.join('\n');
}
MOUNT.informe = () => {
  [['#inf-res', 'txt:res'], ['#inf-con', 'txt:con']].forEach(([s, k]) => { const t = $(s); t.value = store.get(k, ''); t.addEventListener('input', () => store.set(k, t.value)); });
  DL_PROMISE = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
  $('#inf-pdf').onclick = e => savePDF(e.currentTarget);
  let txt = buildReport();
  $('#inf-gen').onclick = () => { txt = buildReport(); toast('Borrador actualizado.'); };
  $('#inf-copy').onclick = () => { txt = buildReport(); copyText(txt, 'Informe copiado. Pégalo en tu procesador de texto.'); };
  $('#inf-csv').onclick = () => copyText(buildCSV(), 'Datos copiados en formato CSV con separador «;».');
};


/* ====================================================================
   Informe en PDF (jsPDF + AutoTable)
   ==================================================================== */
const PDFMAP = [[/Ω/g, 'ohm'], [/α/g, 'alfa'], [/β/g, 'beta'], [/τ/g, 'tau'], [/δ/g, 'delta'], [/₂₅/g, '25'], [/₀/g, '0'], [/₂/g, '2'], [/ₕ/g, 'h'],
  [/⁻¹/g, '^-1'], [/⁻³/g, '^-3'], [/⁻⁷/g, '^-7'], [/⁻/g, '-'], [/≈/g, '~'], [/²/g, '^2'], [/³/g, '^3'], [/µ/g, 'u'], [/≤/g, '<='], [/≥/g, '>='], [/→/g, '->'], [/−/g, '-'], [/[^\x00-\xff–—‘’“”•…]/g, '']];
const pdfTxt = s => PDFMAP.reduce((t, [r, v]) => t.replace(r, v), String(s ?? ''));
function chartImage(pc) {
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-12000px;top:0;width:900px'; document.body.appendChild(host);
  const pl = new Plane(host, { ...pc.o, fixed: true, h: 430, scale: 2 }); pl.resize(); pl.set(pc.layers);
  const url = pl.cv.toDataURL('image/png'), ratio = pl.H / pl.W; pl.ro.disconnect(); LIVE.delete(pl); host.remove(); return { url, ratio };
}
const EX_TEMA = ['RTD', 'RTD', 'RTD', 'RTD', 'RTD', 'Termocupla', 'Termocupla', 'Termistor', 'Termistor', 'Termistor', 'Transmisión', 'Transmisión', 'Dinámica'];
function buildPDF() {
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const D = reportData(), id = D.id, PW = 215.9, PH = 279.4, M = 20, CW = PW - 2 * M, RED = [181, 18, 27], INK = [29, 26, 31], MUTE = [94, 90, 99];
  let y = 22, fig = 0, tab = 0;
  const need = h => { if (y + h > PH - 20) { doc.addPage(); y = 24; } };
  const H2 = t => { need(16); y += 3; doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...RED); doc.text(pdfTxt(t), M, y); y += 2; doc.setDrawColor(...RED); doc.setLineWidth(.4); doc.line(M, y, PW - M, y); y += 6.5; };
  const H3 = t => { need(32); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...INK); doc.text(pdfTxt(t), M, y); y += 5.5; };
  const P = (t, it = false, color = INK) => { doc.setFont('helvetica', it ? 'italic' : 'normal'); doc.setFontSize(10); doc.setTextColor(...color);
    String(t).split(/\n+/).filter(x => x.trim()).forEach(par => { doc.splitTextToSize(pdfTxt(par.trim()), CW).forEach(l => { need(5); doc.text(l, M, y); y += 4.8; }); y += 1.8; }); };
  const PH_ = t => P('[' + t + ']', true, MUTE);
  const TXT = (t, p) => t && t.trim() ? P(t) : PH_(p);
  const T = (cap, head, body) => { tab++; need(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.text(pdfTxt(`Tabla ${tab}. ${cap}`), M, y); y += 2;
    doc.autoTable({ startY: y, head: [head.map(pdfTxt)], body: body.map(r => r.map(c => pdfTxt(c))), margin: { left: M, right: M, top: 24, bottom: 22 }, theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.6, halign: 'right', lineColor: [221, 214, 216], lineWidth: .2, textColor: INK },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold', halign: 'center' }, alternateRowStyles: { fillColor: [250, 245, 246] } });
    y = doc.lastAutoTable.finalY + 7; };
  const F = (pc, cap) => { const im = chartImage(pc), h = CW * im.ratio; fig++; need(h + 12); doc.addImage(im.url, 'PNG', M, y, CW, h); doc.setDrawColor(221, 214, 216); doc.setLineWidth(.2); doc.rect(M, y, CW, h); y += h + 4.5;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...MUTE); doc.splitTextToSize(pdfTxt(`Figura ${fig}. ${cap}`), CW).forEach(l => { doc.text(l, M, y); y += 4.3; }); y += 4; };

  // Portada
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...RED); doc.text('INFORME DE LABORATORIO', M, y); y += 7;
  doc.setFontSize(17); doc.setTextColor(...INK); doc.splitTextToSize(pdfTxt('Medición de temperatura con RTD Pt100, termocupla tipo K y termistor NTC'), CW).forEach(l => { doc.text(l, M, y); y += 7.4; });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...MUTE); doc.text(pdfTxt('Instrumentación Industrial · Tecnología en Electrónica · Universidad del Valle, sede Cartago'), M, y); y += 5;
  doc.autoTable({ startY: y, theme: 'plain', margin: { left: M, right: M }, styles: { font: 'helvetica', fontSize: 10, cellPadding: { top: 1.4, bottom: 1.4, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { fontStyle: 'bold', textColor: RED, cellWidth: 34 } },
    body: [['Estudiante', id.name || '—'], ['Código', id.code || '—'], ['Compañeros', id.mates || '—'], ['Grupo', id.group || '—'], ['Fecha', id.date || '—'], ['Banco', D.b ? D.b.id : '—'], ['Docente', 'Dra. María Elena Leyes']].map(r => r.map(pdfTxt)) });
  y = doc.lastAutoTable.finalY + 4; doc.setDrawColor(...RED); doc.setLineWidth(.8); doc.line(M, y, PW - M, y); y += 8;

  H2('1. Resumen'); TXT(D.res, 'Escribe el resumen en el generador del informe');
  H2('2. Objetivos'); P('Caracterizar experimentalmente una RTD Pt100, una termocupla tipo K y un termistor NTC, y relacionar sus curvas de respuesta con los modelos normalizados (IEC 60751, NIST ITS-90, Steinhart–Hart) y con la transmisión de señal de 4–20 mA.');
  H2('3. Marco teórico'); PH_('Presenta las ecuaciones de Callendar–Van Dusen, el efecto Seebeck con la compensación de unión fría, los modelos beta y Steinhart–Hart y el escalamiento 4–20 mA, con citas');
  H2('4. Montaje y procedimiento');
  P('Práctica 1: la Pt100 y el termómetro patrón se sumergieron en un baño termostático entre 0 y 150 °C; la resistencia se midió a 4 hilos y a 2 hilos con un multímetro de 6½ dígitos.');
  P('Práctica 2: la termocupla tipo K se ubicó en un horno de pozo seco entre 50 y 600 °C; la f.e.m. se midió con un voltímetro sin compensación interna y se registró la temperatura ambiente de los bornes.');
  P('Práctica 3: el NTC se conectó en divisor con una resistencia de 10 kΩ a 3,3 V y se leyó con el ADC de 12 bits de un ESP32 en un baño entre 0 y 100 °C.');

  H2('5. Resultados');
  H3('5.1 RTD Pt100');
  if (D.r1.length) T('Lecturas de la Pt100 a 4 y 2 hilos.', ['T patrón (°C)', 'R 4 hilos (Ω)', 'R 2 hilos (Ω)'], D.r1.map(r => [fmt(r.T, 2), fmt(r.R4, 3), fmt(r.R2, 3)]));
  if (D.a1) { const a = D.a1;
    P(`Ajuste lineal: R = ${fmt(a.R0, 3)} Ω + ${fmt(a.S, 4)} Ω/°C · T, con R² = ${fmt(a.f.r2, 6)}. R0 = ${fmt(a.R0, 3)} Ω y α = ${fmt(a.al * 1000, 4)}×10^-3 °C^-1 (desviación de ${fmt(a.eal, 2)} % respecto a 0,00385). Ajuste cuadrático de Callendar–Van Dusen: A = ${fmt(a.qA * 1000, 4)}×10^-3 y B = ${fmt(a.qB * 1e7, 3)}×10^-7. Resistencia de cables a 2 hilos: ${fmt(a.lead, 3)} Ω, con error medio de ${fmt(a.e2m, 2)} °C. Clase A a 4 hilos: ${a.ok4 ? 'cumple' : 'no cumple'}.`);
    T('Residuos y errores de la Pt100 frente a la tolerancia clase A.', ['T patrón (°C)', 'Residuo (Ω)', 'Error 4 h (°C)', 'Tol. A (°C)', 'Error 2 h (°C)'], a.det.map(d => [fmt(d.T, 2), fmt(d.res, 3), fmt(d.e4, 3), '±' + fmt(d.tol, 2), fmt(d.e2, 2)]));
    F(LAB1.analyze(D.r1).plots[0], 'Curva R–T de la Pt100: lecturas a 4 y 2 hilos, recta de ajuste y curva nominal de Callendar–Van Dusen.');
  } else PH_('Faltan lecturas de la práctica 1: se requieren al menos 6');
  H3('5.2 Termocupla tipo K');
  if (D.r2.length) T('Lecturas de la termocupla tipo K.', ['T patrón (°C)', 'E medida (mV)', 'T amb (°C)'], D.r2.map(r => [fmt(r.T, 2), fmt(r.E, 3), fmt(r.Ta, 2)]));
  if (D.a2) { const a = D.a2;
    P(`Coeficiente de Seebeck medio: ${fmt(a.S, 2)} µV/°C (R² = ${fmt(a.f.r2, 6)}). Error medio sin compensación de unión fría: ${fmt(a.enm, 2)} °C, con temperatura ambiente media de ${fmt(a.tam, 2)} °C. Error máximo con compensación: ${fmt(a.ecmax, 2)} °C; tolerancia clase 2 de IEC 60584: ${a.ok ? 'cumple' : 'no cumple'}.`);
    T('Temperatura calculada con y sin compensación de unión fría.', ['T patrón (°C)', 'E+E(Tamb) (mV)', 'T CJC (°C)', 'Error CJC (°C)', 'T sin CJC (°C)', 'Error (°C)'], a.det.map(d => [fmt(d.T, 2), fmt(d.Ec, 3), fmt(d.Tc, 2), fmt(d.ec, 2), fmt(d.Tn, 2), fmt(d.en, 2)]));
    F(LAB2.analyze(D.r2).plots[0], 'f.e.m. medida y corregida frente a la curva de referencia NIST ITS-90 tipo K.');
  } else PH_('Faltan lecturas de la práctica 2: se requieren al menos 6');
  H3('5.3 Termistor NTC');
  if (D.r3.length) T('Lecturas del termistor NTC con el ADC de 12 bits.', ['T patrón (°C)', 'N ADC', 'Vo (V)', 'R_T (Ω)'], D.r3.map(r => [fmt(r.T, 2), String(r.N), fmt(r.V, 4), fmt(r.R, 1)]));
  if (D.a3) { const a = D.a3, e = x => x.toExponential(5).replace('.', ',');
    P(`Modelo beta: β = ${fmt(a.beta, 1)} K y R25 = ${fmt(a.R25, 1)} Ω (R² = ${fmt(a.r2, 6)}), con error RMS de ${fmt(a.rmsb, 3)} °C. Steinhart–Hart: A = ${e(a.co.A)}, B = ${e(a.co.B)}, C = ${e(a.co.C)}, con error RMS de ${fmt(a.rmss, 3)} °C.`);
    T('Error de los modelos beta y Steinhart–Hart.', ['T patrón (°C)', 'R_T (Ω)', 'Error beta (°C)', 'Error S-H (°C)'], a.det.map(d => [fmt(d.T, 2), fmt(d.R, 1), fmt(d.eb, 3), fmt(d.es, 3)]));
    const pl = LAB3.analyze(D.r3).plots; F(pl[0], 'Resistencia del NTC frente a la temperatura con los modelos ajustados.'); F(pl[1], 'Residuos de los modelos beta y Steinhart–Hart.');
  } else PH_('Faltan lecturas de la práctica 3: se requieren al menos 7');

  H2('6. Análisis de resultados');
  H3('6.1 RTD Pt100'); TXT(D.t1, 'Escribe el análisis en la página de la práctica 1');
  H3('6.2 Termocupla tipo K'); TXT(D.t2, 'Escribe el análisis en la página de la práctica 2');
  H3('6.3 Termistor NTC'); TXT(D.t3, 'Escribe el análisis en la página de la práctica 3');
  H2('7. Ejercicios'); P(`Puntaje: ${D.nex} de ${EX_KEYS.length} ejercicios correctos.`);
  T('Respuestas a los ejercicios de verificación.', ['Ejercicio', 'Tema', 'Respuesta', 'Estado'], EX_KEYS.map((k, i) => [String(i + 1), EX_TEMA[i], D.ex[k] ? D.ex[k].v : '—', D.ex[k] ? (D.ex[k].ok ? 'Correcto' : 'Incorrecto') : 'Sin responder']));
  H2('8. Conclusiones'); TXT(D.con, 'Escribe las conclusiones en el generador del informe');
  H2('9. Referencias');
  ['IEC 60751:2022. Industrial platinum resistance thermometers and platinum temperature sensors.', 'IEC 60584-1:2013. Thermocouples. Part 1: EMF specifications and tolerances.', 'NIST ITS-90 Thermocouple Database, Standard Reference Database 60.', 'Steinhart, J. S., y Hart, S. R. (1968). Calibration curves for thermistors. Deep-Sea Research, 15(4), 497–503.', 'Creus Solé, A. (2010). Instrumentación industrial (8.ª ed.). Marcombo.', 'Pallás Areny, R. (2003). Sensores y acondicionadores de señal (4.ª ed.). Marcombo.'].forEach((r, i) => P(`[${i + 1}] ${r}`));

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFillColor(...RED); doc.rect(0, 0, PW, 12, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.text('UNIVERSIDAD DEL VALLE · SEDE CARTAGO', M, 7.6);
    doc.setFont('helvetica', 'normal'); doc.text(pdfTxt('Instrumentación Industrial · Tecnología en Electrónica'), PW - M, 7.6, { align: 'right' });
    doc.setDrawColor(221, 214, 216); doc.setLineWidth(.3); doc.line(M, PH - 13, PW - M, PH - 13);
    doc.setFontSize(8); doc.setTextColor(...MUTE); doc.text(pdfTxt(`Informe de laboratorio · ${id.name || 'Estudiante'} · ${id.code || ''}`), M, PH - 8.5);
    doc.text(`Página ${i} de ${n}`, PW - M, PH - 8.5, { align: 'right' });
  }
  return doc;
}
let DL_PROMISE = null;
async function savePDF(btn) {
  if (!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable)) { toast('El generador de PDF aún está cargando. Intenta de nuevo en unos segundos.'); return; }
  btn.disabled = true; const label = btn.textContent; btn.textContent = 'Generando PDF…';
  try {
    await new Promise(r => setTimeout(r, 30));
    const id = getId(), doc = buildPDF(), blob = doc.output('blob');
    const fn = `Informe_Termometria_${String(id.code || 'estudiante').replace(/[^\w-]/g, '')}.pdf`;
    const dl = await (DL_PROMISE || Promise.resolve(null));
    if (dl) {
      try { await dl.save({ filename: fn, data: blob }); toast('Informe guardado en PDF.'); }
      catch (e) { toast(e && e.code === 'declined' ? 'Descarga cancelada.' : e && e.code === 'rate_limited' ? 'Ya hay una descarga pendiente; espera un momento.' : 'No fue posible guardar el PDF en esta vista.'); }
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000); toast('Informe descargado en PDF.');
    }
  } catch (err) { console.error(err); toast('No se pudo generar el PDF.'); }
  finally { btn.disabled = false; btn.textContent = label; }
}

/* ====================================================================
   Arranque
   ==================================================================== */
buildToc(); initTheme();
$('#prevBtn').onclick = () => goToPage(cur - 1); $('#nextBtn').onclick = () => goToPage(cur + 1);
$('#pager').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goToPage(+b.dataset.go); });
$('#menuBtn').onclick = openDrawer; $('#scrim').onclick = closeDrawer;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDrawer();
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'ArrowRight' && !e.altKey) goToPage(cur + 1); if (e.key === 'ArrowLeft' && !e.altKey) goToPage(cur - 1);
});
(function start() {
  const h = (location.hash || '').slice(1), k = BOOK_DATA.findIndex(p => p.id === h);
  goToPage(k >= 0 ? k : clamp(store.get('page', 0), 0, BOOK_DATA.length - 1), k < 0);
})();
