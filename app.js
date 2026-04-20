/**
 * ══════════════════════════════════════════════════════════
 *  DATAHUB · LÓGICA UNIFICADA
 *  Adriano Aragón · Universidad Simón Bolívar
 *
 *  API 1 — SODA (GOV.CO)
 *    Accidentalidad Barranquilla víctimas
 *    Endpoint: https://www.datos.gov.co/resource/y628-5q9a.json
 *    Columnas reales: fecha_accidente, direccion_accidente,
 *      condicion_victima, gravedad_accidente, clase_accidente,
 *      sexo_victima, edad_victima, cantidad_victimas
 *
 *  API 2 — REST (Riot / valorant-api.com)
 *    Colección VCT de skins de Valorant
 *    Endpoint: https://valorant-api.com/v1/weapons/skins
 * ══════════════════════════════════════════════════════════
 */

'use strict';

/* ══════════════════════════════════════════
   NAVEGACIÓN POR TABS
══════════════════════════════════════════ */
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`panel-${target}`).classList.add('active');

    // Si VCT no ha cargado aún, cargarlo al activar el tab
    if (target === 'vct' && !VCT.loaded) {
      cargarVCT();
    }
  });
});

/* ══════════════════════════════════════════
   ─────────────────────────────────────────
   API 1: ACCIDENTALIDAD BARRANQUILLA (SODA)
   ─────────────────────────────────────────
══════════════════════════════════════════ */

const SODA = {
  endpoint : 'https://www.datos.gov.co/resource/y628-5q9a.json',
  pageSize : 50,
  maxRows  : 5000,
  data     : [],
  page     : 1,
  sortCol  : 'fecha_accidente',
  sortDir  : 'desc',
};

const COL = {
  fecha     : 'fecha_accidente',
  dir       : 'direccion_accidente',
  condicion : 'condicion_victima',
  gravedad  : 'gravedad_accidente',
  clase     : 'clase_accidente',
  sexo      : 'sexo_victima',
  edad      : 'edad_victima',
  cantidad  : 'cantidad_victimas',
};

/* ── DOM helpers SODA ── */
const $      = id => document.getElementById(id);
const hide   = el  => { if (el) el.hidden = true;  };
const show   = el  => { if (el) el.hidden = false; };
const hideAllBaq = () => {
  [$('ldrBox'), $('errBox'), $('tCard'), $('emptyBox')].forEach(hide);
};

/* ── Cargar valores únicos desde la API ── */
async function cargarValoresUnicos() {
  const campos = [
    { col: COL.sexo,      fn: poblarSexo      },
    { col: COL.condicion, fn: poblarCondicion  },
    { col: COL.gravedad,  fn: poblarGravedad   },
    { col: COL.clase,     fn: poblarClase      },
  ];

  await Promise.allSettled(campos.map(async ({ col, fn }) => {
    try {
      const url = `${SODA.endpoint}?$select=${col}&$group=${col}&$limit=200&$where=${col}+IS+NOT+NULL`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const vals = json
        .map(r => (r[col] || '').trim())
        .filter(v => v.length > 0)
        .sort((a, b) => a.localeCompare(b, 'es'));
      console.info(`[SODA] ${col}:`, vals);
      fn(vals);
    } catch (e) {
      console.warn(`[SODA] Fallback ${col}:`, e.message);
      fn([]);
    }
  }));
}

function poblarSexo(vals = []) {
  const c = $('sexoRadios'); if (!c) return;
  const v = vals.length ? vals : ['Masculino','Femenino','No reporta'];
  c.innerHTML = `
    <label class="radio-item"><input type="radio" name="sx" value="" checked /><span class="rb-dot"></span><span>TODOS</span></label>
    ${v.map(x => `<label class="radio-item"><input type="radio" name="sx" value="${attr(x)}" /><span class="rb-dot"></span><span>${x.toUpperCase()}</span></label>`).join('')}
  `;
}
function poblarCondicion(vals = []) {
  const s = $('fCond'); if (!s) return;
  const v = vals.length ? vals : ['Conductor','Pasajero','Peaton','Ciclista','Motociclista'];
  s.innerHTML = `<option value="">-- todas --</option>` + v.map(x => `<option value="${attr(x)}">${x.toUpperCase()}</option>`).join('');
}
function poblarGravedad(vals = []) {
  const c = $('cgrav'); if (!c) return;
  const v = vals.length ? vals : ['Muerto','Herido','Ileso'];
  const cls = x => { const u=x.toUpperCase(); return u.includes('MUERT')?'badge-m':u.includes('HERID')?'badge-h':u.includes('ILES')?'badge-i':'badge-d'; };
  c.innerHTML = v.map(x => `
    <label class="check-item">
      <input type="checkbox" value="${attr(x)}" />
      <span class="cb-box"></span>
      <span class="badge ${cls(x)}">${x.toUpperCase()}</span>
    </label>`).join('');
}
function poblarClase(vals = []) {
  const s = $('fClase'); if (!s) return;
  const v = vals.length ? vals : ['Choque','Atropello','Caida ocupante','Volcamiento','Incendio','Otro'];
  s.innerHTML = `<option value="">-- todas --</option>` + v.map(x => `<option value="${attr(x)}">${x.toUpperCase()}</option>`).join('');
}

/* ── Construir URL SODA ── */
function buildURL() {
  const W = [];
  const desde = $('fDesde').value, hasta = $('fHasta').value;
  if (desde) W.push(`${COL.fecha} >= '${desde}T00:00:00.000'`);
  if (hasta) W.push(`${COL.fecha} <= '${hasta}T23:59:59.000'`);

  const cond = $('fCond').value.trim();
  if (cond) W.push(`${COL.condicion} = '${soql(cond)}'`);

  const gravs = [...document.querySelectorAll('#cgrav input:checked')];
  if (gravs.length) {
    W.push(`(${gravs.map(cb => `${COL.gravedad} = '${soql(cb.value)}'`).join(' OR ')})`);
  }

  const clase = $('fClase').value.trim();
  if (clase) W.push(`${COL.clase} = '${soql(clase)}'`);

  const sexo = document.querySelector('input[name="sx"]:checked')?.value || '';
  if (sexo) W.push(`${COL.sexo} = '${soql(sexo)}'`);

  const eMin = parseInt($('eMin').value, 10), eMax = parseInt($('eMax').value, 10);
  if (!isNaN(eMin)) W.push(`${COL.edad} >= ${eMin}`);
  if (!isNaN(eMax)) W.push(`${COL.edad} <= ${eMax}`);

  const p = new URLSearchParams({ $limit: SODA.maxRows, $order: `${SODA.sortCol} ${SODA.sortDir}` });
  if (W.length) p.set('$where', W.join(' AND '));
  return `${SODA.endpoint}?${p}`;
}

/* ── Fetch SODA ── */
async function fetchData() {
  const url = buildURL();
  console.info('[SODA] ▶', url);

  hideAllBaq();
  $('ldrMsg').textContent = 'EJECUTANDO QUERY SODA…';
  $('ldrUrl').textContent = url;
  show($('ldrBox'));

  const btn = $('btnQuery');
  btn.classList.add('loading');
  $('bqSpin').textContent = '⟳';
  $('bqLabel').textContent = 'LOADING…';

  try {
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) {
      let d = `HTTP ${res.status}`;
      try { const j = await res.json(); d += ` — ${j.message || ''}`; } catch(_){}
      throw new Error(d);
    }
    const json = await res.json();
    SODA.data = Array.isArray(json) ? json : [];
    SODA.page = 1;
    updateKPIsBaq();
    renderTable();
  } catch (err) {
    showErrBaq(err.message);
    console.error('[SODA]', err);
  } finally {
    btn.classList.remove('loading');
    $('bqSpin').textContent = '▶';
    $('bqLabel').textContent = 'EXECUTE_QUERY';
  }
}

/* ── Render tabla ── */
function renderTable() {
  hideAllBaq();
  const total = SODA.data.length;
  if (!total) { show($('emptyBox')); return; }

  show($('tCard'));
  const pages = Math.ceil(total / SODA.pageSize);
  const s = (SODA.page - 1) * SODA.pageSize, e = Math.min(s + SODA.pageSize, total);
  const slice = SODA.data.slice(s, e);

  $('resCount').textContent = total.toLocaleString('es-CO');
  $('resRange').textContent = `REGISTROS · ${s+1}–${e}`;
  $('pgLabel').textContent  = `${pad(SODA.page)} / ${pad(pages)}`;
  $('btnPrev').disabled = SODA.page <= 1;
  $('btnNext').disabled = SODA.page >= pages;

  $('tbody').innerHTML = slice.map((row, i) => `
    <tr style="animation-delay:${Math.min(i,30)*13}ms">
      <td>${fmtF(row[COL.fecha])}</td>
      <td>${(row[COL.condicion]||'—').toUpperCase()}</td>
      <td>${gravBadge(row[COL.gravedad])}</td>
      <td>${(row[COL.clase]||'—').toUpperCase()}</td>
      <td>${(row[COL.sexo]||'—').toUpperCase()}</td>
      <td class="is-num">${row[COL.edad]??'—'}</td>
      <td class="is-num">${row[COL.cantidad]??'—'}</td>
      <td class="is-dir" title="${attr(row[COL.dir]||'')}">${truncate(row[COL.dir]||'—',33)}</td>
    </tr>`).join('');

  hlSort();
}

/* ── KPIs Barranquilla ── */
function updateKPIsBaq() {
  const d = SODA.data, n = d.length;
  const mu = d.filter(r => (r[COL.gravedad]||'').toUpperCase().includes('MUERT')).length;
  const he = d.filter(r => (r[COL.gravedad]||'').toUpperCase().includes('HERID')).length;
  const pe = d.filter(r => (r[COL.condicion]||'').toUpperCase().includes('PEAT')).length;
  countUp($('kT'), n); countUp($('kM'), mu); countUp($('kH'), he); countUp($('kP'), pe);
  const pct = (v,t) => t ? `${((v/t)*100).toFixed(1)}% DEL TOTAL` : '—';
  $('kTs').textContent = `${n.toLocaleString('es-CO')} REGISTROS CARGADOS`;
  $('kMp').textContent = pct(mu,n);
  $('kHp').textContent = pct(he,n);
  $('kPp').textContent = pct(pe,n);
}

/* ── Ordenamiento ── */
document.querySelectorAll('.dtable th[data-c]').forEach(th => {
  th.addEventListener('click', () => {
    const c = th.dataset.c;
    SODA.sortDir = (SODA.sortCol === c && SODA.sortDir === 'asc') ? 'desc' : 'asc';
    SODA.sortCol = c;
    SODA.data.sort((a,b) => {
      const va=a[c]??'', vb=b[c]??'';
      return (SODA.sortDir==='asc'?1:-1) * String(va).localeCompare(String(vb),'es',{numeric:true});
    });
    SODA.page = 1; renderTable();
  });
});
function hlSort() {
  document.querySelectorAll('.dtable th').forEach(th => {
    th.classList.remove('sa','sd');
    if (th.dataset.c === SODA.sortCol) th.classList.add(SODA.sortDir==='asc'?'sa':'sd');
  });
}

/* ── Paginación ── */
$('btnPrev').addEventListener('click', () => { SODA.page--; renderTable(); $('tCard').scrollIntoView({behavior:'smooth',block:'start'}); });
$('btnNext').addEventListener('click', () => { SODA.page++; renderTable(); $('tCard').scrollIntoView({behavior:'smooth',block:'start'}); });

/* ── CSV export ── */
$('btnCsv').addEventListener('click', () => {
  if (!SODA.data.length) return;
  const cols=[COL.fecha,COL.condicion,COL.gravedad,COL.clase,COL.sexo,COL.edad,COL.cantidad,COL.dir];
  const hdrs=['Fecha','Condición','Gravedad','Clase','Sexo','Edad','Víctimas','Dirección'];
  const esc=v=>`"${(v??'').toString().replace(/"/g,'""')}"`;
  const csv=[hdrs,...SODA.data.map(r=>cols.map(c=>esc(r[c])))].map(r=>r.join(',')).join('\n');
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})),download:`accidentalidad_baq_${new Date().toISOString().slice(0,10)}.csv`});
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
});

/* ── Controles filtros ── */
$('btnQuery').addEventListener('click', fetchData);
$('btnRetry').addEventListener('click', fetchData);
$('btnClear').addEventListener('click', () => {
  const hoy=new Date(), ay=new Date(hoy); ay.setFullYear(hoy.getFullYear()-1);
  $('fDesde').value=ay.toISOString().slice(0,10);
  $('fHasta').value=hoy.toISOString().slice(0,10);
  $('fCond').value=''; $('fClase').value=''; $('eMin').value=''; $('eMax').value='';
  document.querySelectorAll('#cgrav input').forEach(c=>c.checked=false);
  const todo=document.querySelector('input[name="sx"][value=""]'); if(todo) todo.checked=true;
});
document.querySelectorAll('.fi').forEach(el=>el.addEventListener('keydown',e=>{if(e.key==='Enter')fetchData();}));

function showErrBaq(msg) { hideAllBaq(); $('errMsg').textContent=msg; show($('errBox')); }

/* ══════════════════════════════════════════
   ─────────────────────────────────────────
   API 2: VCT COLLECTION (valorant-api.com)
   ─────────────────────────────────────────
══════════════════════════════════════════ */

const VCT = {
  all      : [],   // todos los skins VCT cargados
  filtered : [],   // después de buscar/filtrar
  filter   : 'all',
  query    : '',
  loaded   : false,
};

async function cargarVCT() {
  const ldr = $('vctLdr'), err = $('vctErr'), grid = $('vctGrid'), empty = $('vctEmpty');
  show(ldr); hide(err); hide(grid); hide(empty);

  try {
    const res  = await fetch('https://valorant-api.com/v1/weapons/skins');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    VCT.all = data.data.filter(skin =>
      skin.displayName.toUpperCase().includes('VCT') &&
      skin.displayIcon !== null
    );

    VCT.loaded = true;
    console.info(`[VCT] ${VCT.all.length} skins cargadas`);

    actualizarVCT();

  } catch (err2) {
    hide(ldr);
    $('vctErrMsg').textContent = err2.message;
    show(err);
    console.error('[VCT]', err2);
  }
}

/* ── Filtrar y renderizar skins ── */
function actualizarVCT() {
  const ldr=$('vctLdr'), errEl=$('vctErr'), grid=$('vctGrid'), empty=$('vctEmpty');
  hide(ldr); hide(errEl);

  const q = VCT.query.toUpperCase().trim();
  const f = VCT.filter;

  VCT.filtered = VCT.all.filter(skin => {
    const name = skin.displayName.toUpperCase();
    const esMelee = name.includes('MELEE') || name.includes('MISERICORD') || name.includes('KNIFE') || name.includes('NAVAJA');
    const matchQuery = !q || name.includes(q);
    const matchFilter = f === 'all' || (f === 'melee' && esMelee) || (f === 'classic' && !esMelee);
    return matchQuery && matchFilter;
  });

  updateKPIsVCT();

  if (!VCT.filtered.length) {
    hide(grid); show(empty); return;
  }

  hide(empty); show(grid);

  grid.innerHTML = VCT.filtered.map((skin, i) => {
    const name    = skin.displayName.toUpperCase();
    const esMelee = name.includes('MELEE') || name.includes('MISERICORD') || name.includes('KNIFE') || name.includes('NAVAJA');
    const tierTxt = esMelee ? 'MELEE TIER' : 'CLASSIC TIER';
    const tierCls = esMelee ? 'tier-melee' : 'tier-classic';
    const delay   = Math.min(i, 40) * 18;

    return `<div class="skin-card" style="animation-delay:${delay}ms">
      <div class="skin-img-wrap">
        <img src="${skin.displayIcon}" loading="lazy" alt="${skin.displayName}" />
      </div>
      <div class="skin-info">
        <p class="skin-tier ${tierCls}">${tierTxt}</p>
        <h3 class="skin-name">${skin.displayName}</h3>
      </div>
    </div>`;
  }).join('');
}

/* ── KPIs VCT ── */
function updateKPIsVCT() {
  const all    = VCT.all;
  const melees = all.filter(s => {
    const n = s.displayName.toUpperCase();
    return n.includes('MELEE') || n.includes('MISERICORD') || n.includes('KNIFE') || n.includes('NAVAJA');
  });
  const classics = all.length - melees.length;

  countUp($('vKTotal'),   all.length);
  countUp($('vKMelee'),   melees.length);
  countUp($('vKClassic'), classics);
  countUp($('vKShowing'), VCT.filtered.length);
}

/* ── Búsqueda y filtros ── */
$('vctSearch').addEventListener('input', e => {
  VCT.query = e.target.value;
  if (VCT.loaded) actualizarVCT();
});

document.querySelectorAll('.vct-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.vct-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    VCT.filter = btn.dataset.filter;
    if (VCT.loaded) actualizarVCT();
  });
});

$('vctRetry').addEventListener('click', () => { VCT.loaded = false; cargarVCT(); });

/* ══════════════════════════════════════════
   HELPERS COMPARTIDOS
══════════════════════════════════════════ */
function countUp(el, target) {
  if (!el) return;
  const dur = 750, t0 = performance.now();
  (function frame(now) {
    const t = Math.min((now-t0)/dur, 1), ease = 1-Math.pow(1-t,4);
    el.textContent = Math.round(target*ease).toLocaleString('es-CO');
    if (t < 1) requestAnimationFrame(frame);
  })(t0);
}

function fmtF(raw) {
  if (!raw) return '—';
  const d = new Date(raw);
  return isNaN(d) ? raw : d.toLocaleDateString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric'});
}

const truncate = (s, n) => s && s.length > n ? s.slice(0,n)+'…' : s;
const attr     = s => (s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const soql     = s => s.replace(/'/g, "''");
const pad      = n => String(n).padStart(2,'0');

function gravBadge(g) {
  const v = (g||'').toUpperCase();
  let cls = 'badge-d';
  if (v.includes('MUERT')) cls = 'badge-m';
  else if (v.includes('HERID')) cls = 'badge-h';
  else if (v.includes('ILES')) cls = 'badge-i';
  return `<span class="badge ${cls}">${v||'—'}</span>`;
}

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */
(async function init() {
  // Fecha default: último año
  const hoy = new Date(), ay = new Date(hoy);
  ay.setFullYear(hoy.getFullYear() - 1);
  $('fDesde').value = ay.toISOString().slice(0,10);
  $('fHasta').value = hoy.toISOString().slice(0,10);

  // Mostrar loader
  hideAllBaq();
  $('ldrMsg').textContent = 'CARGANDO CATÁLOGOS…';
  $('ldrUrl').textContent = 'Consultando valores únicos de la API SODA…';
  show($('ldrBox'));

  // Paso 1: cargar valores reales para filtros
  await cargarValoresUnicos();

  // Paso 2: primera consulta de datos
  await fetchData();

  // VCT carga al activar su tab (lazy loading)
})();
