// ═══════════════════════════════════════════════
//  i18n.js
//  Minimal translation helper — no framework, matches the rest of the app.
//  Spanish is the base language; English is a toggle. getLang()/setLang()
//  persist the choice in localStorage; onLangChange() lets any already-mounted
//  DOM (container rows, static page text) re-render without a reload.
// ═══════════════════════════════════════════════

const STORAGE_KEY = 'lang';

const translations = {
  es: {
    titleHtml: 'SORTEO NEUMÁTICO DE <span>LOTERÍA</span>',
    subtitle: 'Un simulador de sorteo de lotería neumático — sopla aire, abre la compuerta y elige un ganador.',
    aboutSummary: 'Sobre este proyecto',
    aboutBody: 'Bolas numeradas son impulsadas por un chorro de aire dentro de una cámara con forma de florero; al abrir la compuerta, una bola sale disparada por el tubo de salida y queda registrada como el sorteo ganador. Hecho con módulos ES puros y la API Canvas 2D — sin dependencias ni proceso de build.',
    aboutLink: 'Ver el código en GitHub →',
    btnBlow: '▶ SOPLAR AIRE',
    btnGate: '⊙ ABRIR COMPUERTA',
    btnReset: 'Reiniciar historial',
    airLabel: 'Aire',
    statusReady: 'Listo',
    statusRamping: 'Aumentando aire…',
    statusRampingPct: 'Aumentando aire… {pct}%',
    statusGateTriggered: 'Compuerta activada…',
    statusTumbling: 'Bolas girando — abre la compuerta cuando quieras',
    statusGateWait: 'Compuerta activada — abriendo en {s}s',
    statusGateOpening: 'Abriendo compuerta…',
    statusCapturing: 'Capturando…',
    statusSettling: 'Asentando…',
    noDraws: 'Sin sorteos aún',
    vaseName: 'BOMBO {n}',
    serieName: 'SERIE',
  },
  en: {
    titleHtml: 'PNEUMATIC <span>LOTTERY</span> DRAW',
    subtitle: 'A browser-based pneumatic lottery draw simulator — blow air, open the gate, and draw a winner.',
    aboutSummary: 'About this project',
    aboutBody: 'Numbered balls are blown around a vase-shaped glass chamber by an air jet; when you open the gate, one ball is launched up the exit tube and recorded as the winning draw. Built with plain ES modules and the Canvas 2D API — no dependencies or build step.',
    aboutLink: 'View source on GitHub →',
    btnBlow: '▶ BLOW AIR',
    btnGate: '⊙ OPEN GATE',
    btnReset: 'Reset history',
    airLabel: 'Air',
    statusReady: 'Ready',
    statusRamping: 'Air ramping…',
    statusRampingPct: 'Air ramping… {pct}%',
    statusGateTriggered: 'Gate triggered…',
    statusTumbling: 'Balls tumbling — open gate when ready',
    statusGateWait: 'Gate triggered — opening in {s}s',
    statusGateOpening: 'Gate opening…',
    statusCapturing: 'Capturing…',
    statusSettling: 'Settling…',
    noDraws: 'No draws yet',
    vaseName: 'VASE {n}',
    serieName: 'SERIE',
  },
};

function detectInitialLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'es' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

let lang = detectInitialLang();
const listeners = new Set();

export function getLang() { return lang; }

export function setLang(l) {
  if (l !== 'es' && l !== 'en') return;
  lang = l;
  localStorage.setItem(STORAGE_KEY, l);
  listeners.forEach(fn => fn(l));
}

export function onLangChange(fn) { listeners.add(fn); }

// t('statusRampingPct', {pct: 62}) → 'Air ramping… 62%'
export function t(key, vars) {
  let str = translations[lang][key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}
