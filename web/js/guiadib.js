// El dibujo del paso 2 de entrar en la web (0.8l): dónde está la dirección que hay que copiar en la página final de LaLiga.
// Uno por plataforma, porque se copia distinto: en el iPhone se mantiene pulsada la barra, en Android se toca y sale el icono
// de copiar, y en el ordenador se hace clic y Ctrl + C. Son esquemas pequeños (no capturas) con su texto alternativo; el aro
// rojo late con la clase .pulso (app.css) y se queda quieto con «reducir movimiento».
// (Los cinco dibujos grandes del método con F12 que había aquí se han quitado: el método a mano queda en texto, plegado.)
const marco = (alt, dentro) => `<svg class="dib" viewBox="0 0 320 112" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${alt}" font-family="Barlow, system-ui, sans-serif"><rect x="0.5" y="0.5" width="319" height="111" rx="12" fill="#17171c" stroke="#34343c"/>${dentro}</svg>`;
const candado = (x, y) => `<g fill="none" stroke="#bdb8c0" stroke-width="1.4" stroke-linecap="round"><rect x="${x}" y="${y + 4}" width="9" height="7" rx="1.5"/><path d="M${x + 2} ${y + 4}v-2a2.5 2.5 0 0 1 5 0v2"/></g>`;

const IPHONE = marco(
  'La barra de direcciones de Safari, donde pone jwt.ms. Al mantenerla pulsada sale un menú con la opción Copiar.',
  `<rect x="96" y="12" width="128" height="34" rx="10" fill="#33333b"/><path d="M152 46h16l-8 8z" fill="#33333b"/>
  <text x="160" y="34" font-size="14" font-weight="700" fill="#f4f2f3" text-anchor="middle">Copiar</text>
  <rect x="28" y="62" width="264" height="36" rx="18" fill="#26262d"/>${candado(126, 71)}
  <text x="142" y="85" font-size="14" font-weight="600" fill="#f4f2f3">jwt.ms</text>
  <rect class="pulso" x="24" y="58" width="272" height="44" rx="22" fill="none" stroke="#ee1c3c" stroke-width="3"/>
  <circle cx="228" cy="80" r="11" fill="#f4f2f3" opacity="0.28"/><circle cx="228" cy="80" r="5" fill="#f4f2f3" opacity="0.6"/>`,
);

const ANDROID = marco(
  'La barra de direcciones del navegador, donde pone jwt.ms. Al tocarla sale a su derecha el icono de copiar.',
  `<text x="28" y="34" font-size="12.5" font-weight="500" fill="#bdb8c0">Toca la barra y pulsa copiar</text>
  <rect x="20" y="54" width="280" height="40" rx="20" fill="#26262d"/>${candado(36, 65)}
  <text x="54" y="79" font-size="13.5" font-weight="600" fill="#f4f2f3">jwt.ms/?state=…</text>
  <g fill="none" stroke="#f4f2f3" stroke-width="1.6" stroke-linejoin="round"><rect x="263" y="68" width="12" height="13" rx="2"/><path d="M259 77v-10a2 2 0 0 1 2-2h8"/></g>
  <circle class="pulso" cx="268" cy="74" r="17" fill="none" stroke="#ee1c3c" stroke-width="3"/>`,
);

const pc = (mac) => marco(
  `La ventana del navegador en la página final. La barra de direcciones, arriba, empieza por jwt.ms: se hace clic en ella y se copia con ${mac ? 'Comando' : 'Control'} y C.`,
  `<path d="M1 12.5A11.5 11.5 0 0 1 12.5 1h295A11.5 11.5 0 0 1 319 12.5V46H1z" fill="#26262d"/>
  <circle cx="18" cy="23" r="4.5" fill="#ff5f57"/><circle cx="32" cy="23" r="4.5" fill="#febc2e"/><circle cx="46" cy="23" r="4.5" fill="#28c840"/>
  <rect x="62" y="10" width="244" height="26" rx="13" fill="#17171c"/>
  <rect x="72" y="14" width="224" height="18" rx="3" fill="#2b5fb8"/>
  <text x="76" y="27.500" font-size="11.5" font-weight="600" fill="#ffffff">jwt.ms/?state=copia-esta-direccion…</text>
  <rect class="pulso" x="58" y="6" width="252" height="34" rx="17" fill="none" stroke="#ee1c3c" stroke-width="3"/>
  <text x="20" y="76" font-size="12.5" font-weight="500" fill="#bdb8c0">Página casi vacía: es lo normal</text>
  <g font-size="12" font-weight="700" fill="#f4f2f3" text-anchor="middle"><rect x="212" y="60" width="44" height="26" rx="6" fill="#33333b" stroke="#4a4a55"/><text x="234" y="77.500">${mac ? '⌘' : 'Ctrl'}</text><text x="266" y="77.500" fill="#bdb8c0">+</text><rect x="276" y="60" width="26" height="26" rx="6" fill="#33333b" stroke="#4a4a55"/><text x="289" y="77.500">C</text></g>`,
);

/** el dibujo de «copia la dirección de la página final» para 'iphone', 'android' o 'pc' (mac: con la tecla ⌘ en vez de Ctrl) */
export const dibCopiar = (plat, mac = false) => (plat === 'iphone' ? IPHONE : plat === 'android' ? ANDROID : pc(mac));
