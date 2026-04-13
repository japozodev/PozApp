const DIAS       = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIAS_LABEL = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const API        = 'api.php';
const HOLD_MS    = 700;

// ── CAMPOS FICHA (ampliar aquí para añadir campos futuros) ──
const CAMPOS_FICHA = [
  { key: 'nombre',  label: 'Nombre y apellidos' },
  { key: 'dni',     label: 'DNI' },
  { key: 'nss',     label: 'N.º Astursalud' },
  { key: 'tarjeta', label: 'Tarjeta ciudadana' },
];


// ── TEMA (claro/oscuro) ──
function temaActual() {
  const guardado = localStorage.getItem('pozoapp_theme');
  if (guardado === 'dark' || guardado === 'light') return guardado;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function aplicarIconoTema() {
  const esOscuro = temaActual() === 'dark';
  const sun = document.getElementById('themeIconSun');
  const moon = document.getElementById('themeIconMoon');
  if (sun)  sun.style.display  = esOscuro ? 'none'  : 'block';
  if (moon) moon.style.display = esOscuro ? 'block' : 'none';
}

function aplicarThemeColorMeta() {
  const color = temaActual() === 'dark' ? '#1a1a2e' : '#f7f4ef';
  let meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', color);
}

function toggleTheme() {
  const nuevo = temaActual() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('pozoapp_theme', nuevo);
  document.documentElement.setAttribute('data-theme', nuevo);
  aplicarIconoTema();
  aplicarThemeColorMeta();
}

// ── AUTENTICACION ──
let APP_TOKEN = localStorage.getItem('pozoapp_token') || '';

function pedirToken() {
  const t = prompt('Introduce la clave de acceso:');
  if (t) { APP_TOKEN = t; localStorage.setItem('pozoapp_token', t); }
  return !!t;
}

function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', 'X-App-Token': APP_TOKEN, ...extra };
}

async function apiFetch(url, opts = {}) {
  opts.headers = authHeaders(opts.headers);
  const r = await fetch(url, opts);
  if (r.status === 401) {
    localStorage.removeItem('pozoapp_token');
    APP_TOKEN = '';
    if (pedirToken()) return apiFetch(url, opts);
    throw new Error('No autorizado');
  }
  return r;
}

// ── SEMANA ISO (YYYY-Www) ──
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

function semanaActual() { return isoWeek(new Date()); }

// Primer lunes de una semana ISO
function lunesDeSemana(isoStr) {
  const [year, w] = isoStr.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (w - 1) * 7);
  return monday;
}

function formatSemana(isoStr) {
  const lunes = lunesDeSemana(isoStr);
  const domingo = new Date(lunes);
  domingo.setUTCDate(lunes.getUTCDate() + 6);
  const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(lunes)} – ${fmt(domingo)}`;
}

function sumarSemanas(isoStr, n) {
  const lunes = lunesDeSemana(isoStr);
  lunes.setUTCDate(lunes.getUTCDate() + n * 7);
  return isoWeek(lunes);
}

function diaHoyIdx() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

// ── ESTADO ──
let semanaSeleccionada = semanaActual();
let menuActual = {};
let compra = { items: [] };
let nextItemId = 1;
const SUPERS = ['alimerka', 'mercadona', 'lidl'];
let pelis = { items: [] };
let tareas = { pendiente: [], eliminados: [] };

// ── NAVEGACIÓN ──
let vistaActual = 'home';

const BTN_VIEW_MAP = { menu: '.menu-btn', compra: '.compra-btn', pelis: '.pelis-btn', tareas: '.tareas-btn', datos: '.datos-btn' };

function goTo(view) {
  if (vistaActual === 'datos' && view !== 'datos') {
    datosPlaintext = null;
    datosPinActual = '';
  }
  const fromHome = vistaActual === 'home' && view !== 'home';
  if (fromHome) {
    const btn = document.querySelector(BTN_VIEW_MAP[view]);
    if (btn) { animateButtonToHeader(btn, view); return; }
  }
  completeNavigation(view);
}

function completeNavigation(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(view).classList.add('active');
  window.scrollTo(0, 0);
  document.body.style.overflow = view === 'home' ? 'hidden' : '';
  if (view !== 'home' && vistaActual === 'home') {
    history.pushState({ view }, '', '');
  }
  vistaActual = view;
  actualizarHomeBadges();
  if (view === 'home') {
    document.querySelectorAll('.home-btn').forEach(b => { b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; });
  }
}

function animateButtonToHeader(btn, view) {
  const btnRect = btn.getBoundingClientRect();

  // Fase 1: desvanecer hermanos y logo
  const logo = document.querySelector('.home-topbar');
  logo.style.transition = 'opacity .2s ease';
  logo.style.opacity = '0';
  document.querySelectorAll('.home-btn').forEach(b => {
    if (b !== btn) {
      b.style.transition = 'opacity .2s ease';
      b.style.opacity = '0';
    }
  });

  // Crear clon fijo del botón pulsado
  const clone = btn.cloneNode(true);
  clone.className = 'home-btn btn-clone-animating';
  clone.style.cssText = `position:fixed;left:${btnRect.left}px;top:${btnRect.top}px;width:${btnRect.width}px;height:${btnRect.height}px;z-index:200;margin:0;pointer-events:none;opacity:1;animation:none;`;
  document.body.appendChild(clone);
  btn.style.opacity = '0';

  // Fase 2: tras fade de hermanos, subir el botón arriba
  setTimeout(() => {
    clone.style.transition = 'top .4s cubic-bezier(.4,0,.15,1), left .4s cubic-bezier(.4,0,.15,1), width .4s cubic-bezier(.4,0,.15,1), height .4s cubic-bezier(.4,0,.15,1), border-radius .4s ease, border-top-width .3s ease, padding .4s ease';
    clone.style.top = '0px';
    clone.style.left = '0px';
    clone.style.width = '100vw';
    clone.style.borderRadius = '0';
    clone.style.borderTopWidth = '0';
    clone.style.boxShadow = 'none';
  }, 180);

  // Fase 3: mostrar sección real, eliminar clon
  setTimeout(() => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const targetView = document.getElementById(view);
    targetView.classList.add('active');
    targetView.querySelector('.inner-header').style.opacity = '0';

    // Fade clon → header real
    clone.style.transition = 'opacity .15s ease';
    clone.style.opacity = '0';

    setTimeout(() => {
      targetView.querySelector('.inner-header').style.transition = 'opacity .15s ease';
      targetView.querySelector('.inner-header').style.opacity = '1';
      setTimeout(() => {
        targetView.querySelector('.inner-header').style.transition = '';
        targetView.querySelector('.inner-header').style.opacity = '';
      }, 150);
    }, 80);

    // Contenido aparece desde abajo
    const content = targetView.querySelector('.scroll-content');
    if (content) {
      content.style.opacity = '0';
      content.style.transform = 'translateY(20px)';
      content.style.transition = 'opacity .25s ease, transform .25s ease';
      requestAnimationFrame(() => {
        content.style.opacity = '1';
        content.style.transform = 'translateY(0)';
      });
      setTimeout(() => { content.style.transition = ''; content.style.transform = ''; content.style.opacity = ''; }, 300);
    }

    setTimeout(() => {
      clone.remove();
      // Reset home elements
      logo.style.transition = ''; logo.style.opacity = '';
      document.querySelectorAll('.home-btn').forEach(b => { b.style.transition = ''; b.style.opacity = ''; });
      window.scrollTo(0, 0);
      document.body.style.overflow = '';
      if (vistaActual === 'home') history.pushState({ view }, '', '');
      vistaActual = view;
      actualizarHomeBadges();
    }, 200);
  }, 580);
}

window.addEventListener('popstate', () => {
  if (vistaActual !== 'home') {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('home').classList.add('active');
    document.body.style.overflow = 'hidden';
    vistaActual = 'home';
    actualizarHomeBadges();
    document.querySelectorAll('.home-btn').forEach(b => { b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; });
  }
});


const pozoAudio = new Audio('audio/pozo.mp3');
pozoAudio.preload = 'auto';

function pozoTap() {
  try { pozoAudio.currentTime = 0; pozoAudio.play(); } catch (e) {}
  toast('PozApp v1.3');
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function confetti(e) {
  const colors = ['#c84b31','#2d6a4f','#6c63ff','#e6a817','#0d9488','#ff6b6b','#ffd93d'];
  const x = e.clientX, y = e.clientY;
  for (let i = 0; i < 28; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    const size = 5 + Math.random() * 7;
    p.style.width = size + 'px';
    p.style.height = (Math.random() > 0.5 ? size : size * 0.5) + 'px';
    p.style.borderRadius = Math.random() > 0.4 ? '50%' : '2px';
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 120;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 60;
    const rot = Math.floor(Math.random() * 360);
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--dy', dy + 'px');
    p.style.setProperty('--rot', rot + 'deg');
    p.style.animationDuration = (0.7 + Math.random() * 0.4) + 's';
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}


function bigConfetti() {
  const colors = ['#c84b31','#2d6a4f','#6c63ff','#e6a817','#0d9488','#ff6b6b','#ffd93d'];
  const w = window.innerWidth, h = window.innerHeight;
  const origins = [
    [w * 0.5, h * 0.45],
    [w * 0.15, h * 0.2],
    [w * 0.85, h * 0.2],
    [w * 0.25, h * 0.7],
    [w * 0.75, h * 0.7]
  ];
  origins.forEach(([ox, oy]) => {
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.className = 'confetti-particle';
      p.style.left = ox + 'px';
      p.style.top = oy + 'px';
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      const size = 8 + Math.random() * 8;
      p.style.width = size + 'px';
      p.style.height = (Math.random() > 0.5 ? size : size * 0.5) + 'px';
      p.style.borderRadius = Math.random() > 0.4 ? '50%' : '2px';
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 150;
      p.style.setProperty('--dx', Math.cos(angle) * speed + 'px');
      p.style.setProperty('--dy', (Math.sin(angle) * speed - 80) + 'px');
      p.style.setProperty('--rot', Math.floor(Math.random() * 360) + 'deg');
      p.style.animationDuration = (1 + Math.random() * 0.5) + 's';
      document.body.appendChild(p);
      p.addEventListener('animationend', () => p.remove());
    }
  });
  const overlay = document.createElement('div');
  overlay.className = 'compra-done-overlay';
  overlay.innerHTML = '<span>¡Compra completada!</span>';
  document.body.appendChild(overlay);
  overlay.addEventListener('animationend', () => overlay.remove());
}

let scrollStartY = null, wasScrolling = false;
(function initScrollGuard() {
  const sc = document.querySelector('#compra .scroll-content');
  if (!sc) return;
  sc.addEventListener('touchstart', e => { scrollStartY = e.touches[0].clientY; wasScrolling = false; }, { passive: true });
  sc.addEventListener('touchmove', e => { if (scrollStartY !== null && Math.abs(e.touches[0].clientY - scrollStartY) > 10) wasScrolling = true; }, { passive: true });
})();

function resizeFoto(file, maxSize = 96) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function cambiarFoto(fi) {
  const input = document.getElementById('fotoInput');
  input.onchange = async () => {
    if (!input.files[0]) return;
    datosPlaintext.fichas[fi].foto = await resizeFoto(input.files[0], 96);
    renderDatos();
    await guardarDatosApi();
    input.value = '';
  };
  input.click();
}

// ── API ──
async function cargarMenu(week) {
  try {
    const r = await apiFetch(`${API}?action=menu&week=${week}`);
    menuActual = await r.json();
  } catch(e) { menuActual = {}; }
  renderMenu();
}

let _ultimoCompraHash = null;

function _hashCompra(c) {
  const items = ((c && c.items) || []).slice().sort((a, b) => a.id - b.id);
  return JSON.stringify(items.map(x => [x.id, x.name, x.super, x.comprado ? 1 : 0]));
}

async function cargarCompra() {
  let data = null;
  try {
    const r = await apiFetch(`${API}?action=compra`);
    data = await r.json();
  } catch(e) {}
  let migrated = false;
  if (data && (Array.isArray(data.pendiente) || Array.isArray(data.eliminados))) {
    // Migración del formato viejo (arrays de strings) a items[].
    const items = [];
    (data.pendiente || []).forEach(n => items.push({ id: nextItemId++, name: n, super: 'general', comprado: false }));
    (data.eliminados || []).forEach(n => items.push({ id: nextItemId++, name: n, super: 'general', comprado: true }));
    compra = { items };
    migrated = true;
  } else if (data && Array.isArray(data.items)) {
    compra = { items: data.items };
    // Asegurar ids únicos
    compra.items.forEach(it => {
      if (typeof it.id !== 'number') it.id = nextItemId++;
      else if (it.id >= nextItemId) nextItemId = it.id + 1;
    });
  } else {
    compra = { items: [] };
  }
  if (migrated) {
    try { await guardarCompraApi(); } catch(e) {}
  }
  _ultimoCompraHash = _hashCompra(compra);
  renderCompra();
  actualizarHomeBadges();
}

async function guardarMenuApi() {
  await apiFetch(`${API}?action=menu&week=${semanaSeleccionada}`, {
    method: 'POST',
    body: JSON.stringify(menuActual)
  });
}

async function guardarCompraApi() {
  await apiFetch(`${API}?action=compra`, {
    method: 'POST',
    body: JSON.stringify(compra)
  });
  _ultimoCompraHash = _hashCompra(compra);
}

async function cargarPelis() {
  try { const r = await apiFetch(`${API}?action=pelis`); pelis = await r.json(); } catch(e) {}
  renderPelis();
  actualizarHomeBadges();
}

async function guardarPelisApi() {
  await apiFetch(`${API}?action=pelis`, { method: 'POST', body: JSON.stringify(pelis) });
}

async function cargarTareas() {
  try { const r = await apiFetch(`${API}?action=tareas`); tareas = await r.json(); } catch(e) {}
  renderTareas();
  actualizarHomeBadges();
}

async function guardarTareasApi() {
  await apiFetch(`${API}?action=tareas`, { method: 'POST', body: JSON.stringify(tareas) });
}

// ── SEMANA ──
function cambiarSemana(n) {
  semanaSeleccionada = sumarSemanas(semanaSeleccionada, n);
  cargarMenu(semanaSeleccionada);
  actualizarHomeBadges();
}

function irSemanaActual() {
  semanaSeleccionada = semanaActual();
  cargarMenu(semanaSeleccionada);
  actualizarHomeBadges();
}

// ── MENÚ ──
function renderMenu() {
  const esEstaSemana = semanaSeleccionada === semanaActual();
  const hoy = diaHoyIdx();

  document.getElementById('semanaDisplay').textContent = formatSemana(semanaSeleccionada);

  const container = document.getElementById('diasList');
  container.innerHTML = '';

  DIAS.forEach((dia, i) => {
    const datos = menuActual[dia] || { comida: '', cena: '' };
    const esHoy = esEstaSemana && i === hoy;
    const card = document.createElement('div');
    card.className = 'dia-card' + (esHoy ? ' hoy' : '');
    card.innerHTML = `
      <div class="dia-nombre">
        ${DIAS_LABEL[i]}
        ${esHoy ? '<span class="hoy-pill">Hoy</span>' : ''}
      </div>
      <div>
        <div class="comida-row">
          <span class="comida-tipo">Comida</span>
          <input class="comida-input" data-dia="${dia}" data-tipo="comida" value="${escHtml(datos.comida||'')}" placeholder="¿Qué hay?" />
        </div>
        <div class="comida-row">
          <span class="comida-tipo">Cena</span>
          <input class="comida-input" data-dia="${dia}" data-tipo="cena" value="${escHtml(datos.cena||'')}" placeholder="¿Qué hay?" />
        </div>
      </div>`;
    container.appendChild(card);
    if (esHoy) setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250);
  });

  container.querySelectorAll('.comida-input').forEach(input => {
    input.addEventListener('input', e => {
      const { dia, tipo } = e.target.dataset;
      if (!menuActual[dia]) menuActual[dia] = { comida: '', cena: '' };
      menuActual[dia][tipo] = e.target.value;
    });
  });
}

async function guardarMenu() {
  await guardarMenuApi();
  actualizarHomeBadges();
  const btn = document.getElementById('saveMenuBtn');
  btn.classList.add('saved');
  setTimeout(() => btn.classList.remove('saved'), 1800);
}

async function limpiarMenu() {
  if (!confirm('¿Limpiar todos los campos de esta semana?')) return;
  DIAS.forEach(dia => { menuActual[dia] = { comida: '', cena: '' }; });
  renderMenu();
  await guardarMenuApi();
  toast('Menú limpiado ✓');
}

// ── BADGES ──
function actualizarHomeBadges() {
  const p = (compra.items || []).filter(it => !it.comprado).length;
  document.getElementById('homePendientes').textContent = p > 0 ? `${p} pendiente${p > 1 ? 's' : ''}` : '';
  const esHoy = semanaSeleccionada === semanaActual();
  document.getElementById('homeSemana').textContent = esHoy ? 'Semana actual' : formatSemana(semanaSeleccionada);
  const np = pelis.items?.length || 0;
  document.getElementById('homePelis').textContent = np > 0 ? `${np} titulo${np > 1 ? 's' : ''}` : '';
  const nt = tareas.pendiente?.length || 0;
  document.getElementById('homeTareas').textContent = nt > 0 ? `${nt} pendiente${nt > 1 ? 's' : ''}` : '';
  const el = document.getElementById('homeDatos');
  if (el) {
    const nd = datosPlaintext?.fichas?.length || 0;
    el.textContent = nd > 0 ? `${nd} ficha${nd > 1 ? 's' : ''}` : '🔒';
  }
}

// ── COMPRA ──
function itemsForSuper(superId) {
  // Pendientes del super: los exclusivos de ese super + los generales.
  return (compra.items || []).filter(it => it.super === superId || it.super === 'general');
}

function renderCompra() {
  // Badge total = todos los pendientes (sin duplicar generales).
  const totalPend = (compra.items || []).filter(it => !it.comprado).length;
  document.getElementById('badgePendientes').textContent = totalPend > 0 ? `${totalPend}` : '';

  // Badges de cada super en la pantalla principal de compra.
  SUPERS.forEach(s => {
    const pend = itemsForSuper(s).filter(it => !it.comprado).length;
    const el = document.getElementById('badge' + s.charAt(0).toUpperCase() + s.slice(1));
    if (el) el.textContent = pend > 0 ? `${pend} pendiente${pend > 1 ? 's' : ''}` : '';
  });

  // Renderizar las 3 vistas de super.
  SUPERS.forEach(renderSuper);
  renderCompraGlobal();
}

function renderSuper(superId) {
  const all = itemsForSuper(superId);
  const pendiente  = all.filter(it => !it.comprado).slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const eliminados = all.filter(it =>  it.comprado);

  const cap = superId.charAt(0).toUpperCase() + superId.slice(1);
  const badgeHdr = document.getElementById('badgePendientes' + cap);
  if (badgeHdr) badgeHdr.textContent = pendiente.length > 0 ? `${pendiente.length}` : '';

  const lp = document.getElementById('listaPendiente_' + superId);
  const le = document.getElementById('listaEliminados_' + superId);
  if (!lp || !le) return;

  lp.innerHTML = pendiente.length === 0
    ? '<div class="empty-msg">La lista está vacía</div>'
    : pendiente.map(it => `
        <div class="item" data-id="${it.id}" onclick="eliminarItem(${it.id}, event)">
          <span class="item-check"></span>
          <span class="item-name">${escHtml(it.name)}</span>
          ${it.super !== 'general' ? `<span class="super-dot super-dot-${it.super}"></span>` : ''}
        </div>`).join('');

  le.innerHTML = eliminados.length === 0
    ? '<div class="empty-msg">Nada comprado aún</div>'
    : eliminados.map(it => `
        <div class="item eliminado" data-id="${it.id}">
          <span class="item-check">✓</span>
          <span class="item-name">${escHtml(it.name)}</span>
          ${it.super !== 'general' ? `<span class="super-dot super-dot-${it.super}"></span>` : ''}
          <span class="item-hint">mantén p. borrar</span>
        </div>`).join('');

  const view = document.getElementById('super' + cap);
  if (view) {
    if (pendiente.length > 8) view.classList.add('compact');
    else view.classList.remove('compact');
  }

  le.querySelectorAll('.item.eliminado').forEach(el => {
    let timer = null, fired = false;
    const id = parseInt(el.dataset.id);
    const start = () => { fired = false; el.classList.add('holding'); timer = setTimeout(() => { fired = true; borrarDefinitivo(id); }, HOLD_MS); };
    const cancel = () => { clearTimeout(timer); el.classList.remove('holding'); };
    el.addEventListener('click', () => { if (!fired) recuperarItem(id); });
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
  });
}

function renderCompraGlobal() {
  const all = compra.items || [];
  const pendiente  = all.filter(it => !it.comprado).slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const eliminados = all.filter(it =>  it.comprado);

  const lp = document.getElementById('listaPendiente_global');
  const le = document.getElementById('listaEliminados_global');
  if (!lp || !le) return;

  lp.innerHTML = pendiente.length === 0
    ? '<div class="empty-msg">La lista está vacía</div>'
    : pendiente.map(it => `
        <div class="item" data-id="${it.id}" onclick="eliminarItem(${it.id}, event)">
          <span class="item-check"></span>
          <span class="item-name">${escHtml(it.name)}</span>
          ${it.super !== 'general' ? `<span class="super-dot super-dot-${it.super}"></span>` : ''}
        </div>`).join('');

  le.innerHTML = eliminados.length === 0
    ? '<div class="empty-msg">Nada comprado aún</div>'
    : eliminados.map(it => `
        <div class="item eliminado" data-id="${it.id}">
          <span class="item-check">✓</span>
          <span class="item-name">${escHtml(it.name)}</span>
          ${it.super !== 'general' ? `<span class="super-dot super-dot-${it.super}"></span>` : ''}
          <span class="item-hint">mantén p. borrar</span>
        </div>`).join('');

  const view = document.getElementById('compra');
  if (view) {
    if (pendiente.length > 8) view.classList.add('compact');
    else view.classList.remove('compact');
  }

  le.querySelectorAll('.item.eliminado').forEach(el => {
    let timer = null, fired = false;
    const id = parseInt(el.dataset.id);
    const start = () => { fired = false; el.classList.add('holding'); timer = setTimeout(() => { fired = true; borrarDefinitivo(id); }, HOLD_MS); };
    const cancel = () => { clearTimeout(timer); el.classList.remove('holding'); };
    el.addEventListener('click', () => { if (!fired) recuperarItem(id); });
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
  });
}

async function anyadirItem() {
  const input = document.getElementById('nuevoItem');
  const sel   = document.getElementById('superSelect');
  const val   = input.value.trim();
  const sup   = sel ? sel.value : 'general';
  if (!val) return;

  const lower = val.toLowerCase();
  // Detectar duplicados:
  // - Si añades general → no debe existir ya en NINGÚN super (general ni exclusivo).
  // - Si añades a un super → no debe existir como general ni como exclusivo del mismo super.
  const dup = (compra.items || []).find(it => {
    if (it.name.toLowerCase() !== lower) return false;
    if (sup === 'general') return true;
    return it.super === 'general' || it.super === sup;
  });
  if (dup) {
    const dupSup = dup.super === 'general' ? 'general' : dup.super;
    toast(`"${dup.name}" ya está en la lista (${dupSup})`);
    return;
  }

  compra.items.push({ id: nextItemId++, name: val, super: sup, comprado: false });
  input.value = '';
  if (sel) sel.value = 'general';

  renderCompra();
  actualizarHomeBadges();
  await guardarCompraApi();
}

async function eliminarItem(id, e) {
  if (wasScrolling) { wasScrolling = false; return; }
  const it = (compra.items || []).find(x => x.id === id);
  if (!it) return;
  if (e) confetti(e);

  // Snapshot ANTES del cambio: pendientes por super
  const pendBefore = {};
  SUPERS.forEach(s => { pendBefore[s] = itemsForSuper(s).filter(x => !x.comprado).length; });

  it.comprado = true;

  // Detectar transición >0 → 0 en cualquier super y disparar bigConfetti
  let algunoCompletado = false;
  SUPERS.forEach(s => {
    const after = itemsForSuper(s).filter(x => !x.comprado).length;
    if (pendBefore[s] > 0 && after === 0) {
      bigConfetti();
      algunoCompletado = true;
    }
  });

  // Final épico: si tras este cambio TODOS los supers están a 0 y al menos uno se acaba de completar
  const totalPend = compra.items.filter(x => !x.comprado).length;
  if (totalPend === 0 && algunoCompletado) {
    setTimeout(() => bigConfetti(), 600);
  }

  renderCompra();
  actualizarHomeBadges();
  await guardarCompraApi();
}

async function recuperarItem(id) {
  const it = (compra.items || []).find(x => x.id === id);
  if (!it) return;
  it.comprado = false;
  renderCompra();
  actualizarHomeBadges();
  await guardarCompraApi();
  toast(`"${it.name}" recuperado ✓`);
}

async function borrarDefinitivo(id) {
  const idx = (compra.items || []).findIndex(x => x.id === id);
  if (idx < 0) return;
  const it = compra.items.splice(idx, 1)[0];

  renderCompra();
  actualizarHomeBadges();
  await guardarCompraApi();
  toast(`"${it.name}" borrado definitivamente`);
}

document.getElementById('nuevoItem').addEventListener('keydown', e => { if (e.key === 'Enter') anyadirItem(); });

// ── SYNC COMPRA (polling ligero entre dispositivos) ──
let _compraPollTimer = null;

function _enPantallaCompra() {
  return vistaActual === 'compra' || (typeof vistaActual === 'string' && vistaActual.startsWith('super'));
}

async function pollCompra() {
  if (document.visibilityState !== 'visible') return;
  if (!_enPantallaCompra()) return;
  let remoto = null;
  try {
    const r = await apiFetch(`${API}?action=compra`);
    remoto = await r.json();
  } catch(e) { return; }
  if (!remoto || !Array.isArray(remoto.items)) return;
  const hashRemoto = _hashCompra(remoto);
  if (hashRemoto === _ultimoCompraHash) return;
  compra = { items: remoto.items };
  compra.items.forEach(it => {
    if (typeof it.id !== 'number') it.id = nextItemId++;
    else if (it.id >= nextItemId) nextItemId = it.id + 1;
  });
  _ultimoCompraHash = hashRemoto;
  renderCompra();
  actualizarHomeBadges();
}

function startCompraPolling() {
  if (_compraPollTimer) return;
  _compraPollTimer = setInterval(pollCompra, 3000);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') pollCompra();
});

// ── PELIS ──
let peliEditando = -1;
let peliBackup = null;

function renderPelis() {
  const list = document.getElementById('listaPelis');
  const items = pelis.items || [];
  document.getElementById('badgePelis').textContent = items.length > 0 ? items.length : '';
  if (items.length === 0) {
    list.innerHTML = '<div class="empty-msg">Sin pelis todavia</div>';
    return;
  }
  list.innerHTML = items.map((p, i) => {
    if (i === peliEditando) {
      return `<div class="item peli-editing">
        <div class="peli-edit-fields">
          <input class="compra-field peli-field" data-key="titulo" value="${escHtml(p.titulo)}" placeholder="Titulo..." />
          <div class="peli-edit-row">
            <input class="compra-field peli-field" data-key="nota" value="${escHtml(p.nota || '')}" placeholder="Nota" />
            <input class="compra-field peli-field" data-key="plataforma" value="${escHtml(p.plataforma || '')}" placeholder="Plataforma" />
          </div>
          <div class="peli-edit-actions">
            <button class="ficha-save-btn" style="background:#6c63ff" onclick="guardarPeli(${i})">Guardar</button>
            <button class="ficha-cancel-btn" onclick="cancelarEdicionPeli()">Cancelar</button>
          </div>
        </div>
      </div>`;
    }
    const badges = [
      p.plataforma ? `<span class="item-plat">${escHtml(p.plataforma)}</span>` : '',
      p.nota ? `<span class="item-nota">${escHtml(p.nota)}</span>` : ''
    ].filter(Boolean).join(' ');
    return `<div class="item peli-item">
      <div class="peli-top">
        <span class="item-name">${escHtml(p.titulo)}</span>
        <button class="ficha-edit-btn" onclick="editarPeli(${i})">&#9998;</button>
        <button class="ficha-del-btn" onclick="borrarPeli(${i})">&#10005;</button>
      </div>
      ${badges ? `<div class="peli-badges">${badges}</div>` : ''}
    </div>`;
  }).join('');
}

function editarPeli(i) {
  peliBackup = JSON.parse(JSON.stringify(pelis.items[i]));
  peliEditando = i;
  renderPelis();
}

async function guardarPeli(i) {
  const card = document.querySelectorAll('#listaPelis .item')[i];
  card.querySelectorAll('.peli-field').forEach(input => {
    pelis.items[i][input.dataset.key] = input.value.trim();
  });
  peliEditando = -1;
  peliBackup = null;
  renderPelis(); actualizarHomeBadges();
  await guardarPelisApi();
}

function cancelarEdicionPeli() {
  if (peliBackup !== null && peliEditando >= 0) {
    pelis.items[peliEditando] = peliBackup;
  }
  peliEditando = -1;
  peliBackup = null;
  renderPelis();
}

async function anyadirPeli() {
  const tInput = document.getElementById('nuevaPeli');
  const nInput = document.getElementById('nuevaNota');
  const pInput = document.getElementById('nuevaPlataforma');
  const titulo = tInput.value.trim();
  if (!titulo) return;
  pelis.items.push({ titulo, nota: nInput.value.trim(), plataforma: pInput.value.trim() });
  tInput.value = ''; nInput.value = ''; pInput.value = '';

  renderPelis(); actualizarHomeBadges();
  await guardarPelisApi();
}

async function borrarPeli(i) {
  const nombre = pelis.items[i].titulo;
  if (!confirm(`Borrar "${nombre}"?`)) return;
  pelis.items.splice(i, 1);
  if (peliEditando === i) { peliEditando = -1; peliBackup = null; }
  else if (peliEditando > i) peliEditando--;
  renderPelis(); actualizarHomeBadges();
  await guardarPelisApi();
  toast(`"${nombre}" borrado`);
}

document.getElementById('nuevaPeli').addEventListener('keydown', e => { if (e.key === 'Enter') anyadirPeli(); });

// ── TAREAS ──
function formatFecha(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function renderTareas() {
  const pend = tareas.pendiente || [];
  const elim = tareas.eliminados || [];
  document.getElementById('badgeTareas').textContent = pend.length > 0 ? pend.length : '';

  const lp = document.getElementById('listaTareasPend');
  const le = document.getElementById('listaTareasHechas');

  lp.innerHTML = pend.length === 0
    ? '<div class="empty-msg">Sin tareas pendientes</div>'
    : pend.map((t, i) => `
        <div class="item" onclick="completarTarea(${i}, event)">
          <span class="urgencia-dot urgencia-${t.urgencia || 'ninguna'}"></span>
          <span class="item-name">${escHtml(t.texto)}</span>
          ${t.fecha ? `<span class="item-fecha">${formatFecha(t.fecha)}</span>` : ''}
        </div>`).join('');

  le.innerHTML = elim.length === 0
    ? '<div class="empty-msg">Nada hecho aun</div>'
    : elim.map((t, i) => `
        <div class="item eliminado" data-idx="${i}">
          <span class="item-check">✓</span>
          <span class="item-name">${escHtml(t.texto)}</span>
          ${t.fecha ? `<span class="item-fecha">${formatFecha(t.fecha)}</span>` : ''}
          <span class="item-hint">manten p. borrar</span>
        </div>`).join('');

  le.querySelectorAll('.item.eliminado').forEach(el => {
    let timer = null, fired = false;
    const start = () => { fired = false; el.classList.add('holding'); timer = setTimeout(() => { fired = true; borrarTareaDefinitivo(parseInt(el.dataset.idx)); }, HOLD_MS); };
    const cancel = () => { clearTimeout(timer); el.classList.remove('holding'); };
    el.addEventListener('click', () => { if (!fired) recuperarTarea(parseInt(el.dataset.idx)); });
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchcancel', cancel);
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', cancel);
    el.addEventListener('mouseleave', cancel);
  });
}

async function anyadirTarea() {
  const tInput = document.getElementById('nuevaTarea');
  const fInput = document.getElementById('nuevaFecha');
  const uSelect = document.getElementById('nuevaUrgencia');
  const texto = tInput.value.trim();
  if (!texto) return;
  tareas.pendiente.push({ texto, fecha: fInput.value, urgencia: uSelect.value });
  tInput.value = ''; fInput.value = ''; uSelect.value = 'ninguna';

  renderTareas(); actualizarHomeBadges();
  await guardarTareasApi();
}

async function completarTarea(i, e) {
  if (e) confetti(e);
  tareas.eliminados.unshift(tareas.pendiente.splice(i, 1)[0]);

  renderTareas(); actualizarHomeBadges();
  await guardarTareasApi();
}

async function recuperarTarea(i) {
  const t = tareas.eliminados.splice(i, 1)[0];
  tareas.pendiente.push(t);
  renderTareas(); actualizarHomeBadges();
  await guardarTareasApi();
  toast(`"${t.texto}" recuperado`);
}

async function borrarTareaDefinitivo(i) {
  const t = tareas.eliminados.splice(i, 1)[0];

  renderTareas(); actualizarHomeBadges();
  await guardarTareasApi();
  toast(`"${t.texto}" borrado definitivamente`);
}

document.getElementById('nuevaTarea').addEventListener('keydown', e => { if (e.key === 'Enter') anyadirTarea(); });

// ── DATOS PERSONALES (cifrado client-side) ──
let datosPlaintext = null;
let datosEnvelope = null;
let datosPinActual = '';
let pinBuffer = '';
let pinMode = 'unlock';
let pinFirst = '';
let fichaEditando = -1;
let fichaBackup = null;

// Crypto helpers
async function derivarClave(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function cifrarDatos(pin, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derivarClave(pin, salt);
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return {
    cifrado: btoa(String.fromCharCode(...new Uint8Array(cifrado))),
    salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''),
    iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
  };
}

async function descifrarDatos(pin, envelope) {
  const salt = new Uint8Array(envelope.salt.match(/.{2}/g).map(h => parseInt(h, 16)));
  const iv = new Uint8Array(envelope.iv.match(/.{2}/g).map(h => parseInt(h, 16)));
  const cifrado = Uint8Array.from(atob(envelope.cifrado), c => c.charCodeAt(0));
  const key = await derivarClave(pin, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cifrado);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// PIN UI
function pinActualizarDots() {
  const dots = document.querySelectorAll('#pinDots .pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
}

function pinMostrarError(msg) {
  document.getElementById('pinError').textContent = msg;
  const dots = document.getElementById('pinDots');
  dots.classList.add('shake');
  setTimeout(() => dots.classList.remove('shake'), 400);
}

function pinReset() {
  pinBuffer = '';
  document.getElementById('pinError').textContent = '';
  pinActualizarDots();
}

function pinDigit(d) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += d;

  pinActualizarDots();
  if (pinBuffer.length === 6) {
    setTimeout(() => pinSubmit(), 150);
  }
}

function pinBorrar() {
  if (pinBuffer.length === 0) return;
  pinBuffer = pinBuffer.slice(0, -1);
  pinActualizarDots();
  document.getElementById('pinError').textContent = '';
}

function pinCancelar() {
  document.getElementById('pinOverlay').style.display = 'none';
  pinReset();
}

async function pinSubmit() {
  if (pinMode === 'set') {
    pinFirst = pinBuffer;
    pinMode = 'confirm';
    document.getElementById('pinTitle').textContent = 'Confirma tu PIN';
    document.getElementById('pinSubtitle').textContent = '';
    pinReset();
  } else if (pinMode === 'confirm') {
    if (pinBuffer === pinFirst) {
      datosPinActual = pinBuffer;
      datosPlaintext = { fichas: [] };
      const envelope = await cifrarDatos(datosPinActual, datosPlaintext);
      await apiFetch(`${API}?action=datos`, { method: 'POST', body: JSON.stringify(envelope) });
      document.getElementById('pinOverlay').style.display = 'none';
      pinReset();
      goTo('datos');
      renderDatos();
    } else {
      pinMostrarError('Los PIN no coinciden');
      pinMode = 'set';
      document.getElementById('pinTitle').textContent = 'Crea un PIN de 6 dígitos';
      document.getElementById('pinSubtitle').textContent = 'Si lo olvidas, los datos no se pueden recuperar';
      pinFirst = '';
      setTimeout(() => pinReset(), 400);
    }
  } else {
    try {
      datosPlaintext = await descifrarDatos(pinBuffer, datosEnvelope);
      datosPinActual = pinBuffer;
      document.getElementById('pinOverlay').style.display = 'none';
      pinReset();
      goTo('datos');
      renderDatos();
    } catch (e) {
      pinMostrarError('PIN incorrecto');
      setTimeout(() => pinReset(), 400);
    }
  }
}

async function abrirDatos() {
  try {
    const r = await apiFetch(`${API}?action=datos`);
    const data = await r.json();
    if (data && data.cifrado) {
      datosEnvelope = data;
      pinMode = 'unlock';
      document.getElementById('pinTitle').textContent = 'Introduce tu PIN';
      document.getElementById('pinSubtitle').textContent = '';
    } else {
      datosEnvelope = null;
      pinMode = 'set';
      document.getElementById('pinTitle').textContent = 'Crea un PIN de 6 dígitos';
      document.getElementById('pinSubtitle').textContent = 'Si lo olvidas, los datos no se pueden recuperar';
    }
  } catch (e) {
    datosEnvelope = null;
    pinMode = 'set';
    document.getElementById('pinTitle').textContent = 'Crea un PIN de 6 dígitos';
    document.getElementById('pinSubtitle').textContent = 'Si lo olvidas, los datos no se pueden recuperar';
  }
  pinReset();
  document.getElementById('pinOverlay').style.display = '';
}

function cerrarDatos() {
  datosPlaintext = null;
  datosPinActual = '';
  goTo('home');
}

// Datos CRUD
function renderDatos() {
  if (!datosPlaintext) return;
  const fichas = datosPlaintext.fichas || [];
  const badge = document.getElementById('badgeDatos');
  badge.textContent = fichas.length > 0 ? fichas.length : '';
  const container = document.getElementById('listaFichas');
  if (fichas.length === 0) {
    container.innerHTML = '<div class="empty-msg">Sin fichas guardadas</div>';
    return;
  }
  container.innerHTML = fichas.map((ficha, fi) => {
    const editing = fi === fichaEditando;
    const fotoHtml = `<div class="ficha-foto" onclick="cambiarFoto(${fi})">${ficha.foto ? `<img src="${ficha.foto}" class="ficha-foto-img" />` : `<span class="ficha-foto-placeholder">\u{1F4F7}</span>`}</div>`;
    if (editing) {
      return `<div class="ficha-card ficha-editing">
        <div class="ficha-header">
          ${fotoHtml}
          <span class="ficha-nombre">${escHtml(ficha.nombre || 'Sin nombre')}</span>
        </div>
        ${CAMPOS_FICHA.map(c => `
          <div class="ficha-campo">
            <span class="ficha-label">${escHtml(c.label)}</span>
            <input class="ficha-input" data-fi="${fi}" data-key="${c.key}" value="${escHtml(ficha[c.key] || '')}" placeholder="..." />
          </div>`).join('')}
        <div class="ficha-actions">
          <button class="ficha-save-btn" onclick="guardarFicha(${fi})">Guardar</button>
          <button class="ficha-cancel-btn" onclick="cancelarEdicion()">Cancelar</button>
        </div>
      </div>`;
    }
    return `<div class="ficha-card">
      <div class="ficha-header">
        ${fotoHtml}
        <span class="ficha-nombre">${escHtml(ficha.nombre || 'Sin nombre')}</span>
        <button class="ficha-edit-btn" onclick="editarFicha(${fi})">&#9998;</button>
        <button class="ficha-del-btn" onclick="borrarFicha(${fi})">&#10005;</button>
      </div>
      ${CAMPOS_FICHA.map(c => `
        <div class="ficha-campo">
          <span class="ficha-label">${escHtml(c.label)}</span>
          <span class="ficha-value">${escHtml(ficha[c.key] || '\u2014')}</span>
        </div>`).join('')}
    </div>`;
  }).join('');

  if (fichaEditando >= 0) {
    container.querySelectorAll('.ficha-editing .ficha-input').forEach(input => {
      input.addEventListener('input', e => {
        if (e.target.dataset.key === 'nombre') {
          e.target.closest('.ficha-card').querySelector('.ficha-nombre').textContent = e.target.value || 'Sin nombre';
        }
      });
    });
  }
}

function editarFicha(fi) {
  fichaBackup = JSON.parse(JSON.stringify(datosPlaintext.fichas[fi]));
  fichaEditando = fi;
  renderDatos();
}

async function guardarFicha(fi) {
  const card = document.querySelectorAll('.ficha-card')[fi];
  card.querySelectorAll('.ficha-input').forEach(input => {
    datosPlaintext.fichas[fi][input.dataset.key] = input.value;
  });
  fichaEditando = -1;
  fichaBackup = null;

  renderDatos();
  await guardarDatosApi();
}

function cancelarEdicion() {
  if (fichaBackup !== null && fichaEditando >= 0) {
    datosPlaintext.fichas[fichaEditando] = fichaBackup;
  }
  fichaEditando = -1;
  fichaBackup = null;
  renderDatos();
}

async function anyadirFicha() {
  if (!datosPlaintext) return;
  const ficha = {};
  CAMPOS_FICHA.forEach(c => ficha[c.key] = '');
  datosPlaintext.fichas.push(ficha);
  fichaEditando = datosPlaintext.fichas.length - 1;
  fichaBackup = JSON.parse(JSON.stringify(ficha));

  renderDatos();
  await guardarDatosApi();
}

async function borrarFicha(idx) {
  if (!datosPlaintext) return;
  const nombre = datosPlaintext.fichas[idx].nombre || 'esta ficha';
  if (!confirm(`\u00BFBorrar "${nombre}"?`)) return;
  datosPlaintext.fichas.splice(idx, 1);
  if (fichaEditando === idx) { fichaEditando = -1; fichaBackup = null; }
  else if (fichaEditando > idx) fichaEditando--;

  renderDatos();
  await guardarDatosApi();
}

async function guardarDatosApi() {
  if (!datosPlaintext || !datosPinActual) return;
  const envelope = await cifrarDatos(datosPinActual, datosPlaintext);
  await apiFetch(`${API}?action=datos`, { method: 'POST', body: JSON.stringify(envelope) });
}

// ── INIT ──
document.body.style.overflow = 'hidden';
aplicarIconoTema();
aplicarThemeColorMeta();
if (!APP_TOKEN) pedirToken();

(async function init() {
  await Promise.all([
    cargarMenu(semanaSeleccionada),
    cargarCompra(),
    cargarPelis(),
    cargarTareas()
  ]);
  actualizarHomeBadges();
  startCompraPolling();
  // Mínimo 1.4s de splash para que se vea la animación completa
  const elapsed = performance.now();
  const minSplash = 1400;
  if (elapsed < minSplash) await new Promise(r => setTimeout(r, minSplash - elapsed));


  document.getElementById('splash').classList.add('hide');
})();
