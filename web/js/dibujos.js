/* Los dibujos de las novedades (viewBox 0 0 160 120). Clases: d-l línea clara, d-al línea del color de la
   novedad, d-a relleno del color, d-s relleno suave, d-w línea blanca (sobre el color), d-t texto. */
export const DIBUJOS = {
  directo: `<rect class="d-s" x="18" y="34" width="124" height="62" rx="12"/><rect class="d-l" x="18" y="34" width="124" height="62" rx="12"/>
    <path class="d-l" d="M32 56l8-3 8 3v9c0 6-4 9-8 11-4-2-8-5-8-11z"/><path class="d-l" d="M112 56l8-3 8 3v9c0 6-4 9-8 11-4-2-8-5-8-11z"/><path class="d-l" style="stroke-width:4" d="M65 59a6 6 0 0 1 12 0c0 5-12 9-12 16h12M81 66h6M91 57l6-5v23"/>
    <circle class="d-a" cx="80" cy="16" r="5"/><path class="d-al" d="M68 7a15 15 0 0 0 0 18M92 7a15 15 0 0 1 0 18"/><path class="d-l" d="M52 108h56"/>`,
  foto: `<rect class="d-l" x="22" y="8" width="58" height="104" rx="11"/><rect class="d-s" x="30" y="22" width="42" height="56" rx="5"/>
    <circle class="d-a" cx="42" cy="36" r="5"/><path class="d-a" d="M30 70l14-16 10 10 6-6 12 12v6a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4z"/><path class="d-l" d="M44 96h14"/>
    <path class="d-l" d="M92 30h46a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8h-26l-14 12V76h-6a8 8 0 0 1-8-8V38a8 8 0 0 1 8-8z"/><path class="d-al" d="M115 42l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/><path class="d-al" d="M84 54h-6"/>`,
  voz: `<rect class="d-s" x="60" y="12" width="40" height="64" rx="20"/><rect class="d-l" x="60" y="12" width="40" height="64" rx="20"/>
    <path class="d-l" d="M46 56a34 34 0 0 0 68 0M80 90v14M64 104h32"/><path class="d-al" d="M24 46v20M34 38v36M126 38v36M136 46v20"/>`,
  nota: `<rect class="d-s" x="38" y="12" width="70" height="94" rx="8"/><rect class="d-l" x="38" y="12" width="70" height="94" rx="8"/>
    <path class="d-l" d="M52 36h42M52 52h42M52 68h24"/><path class="d-a" d="M100 70l22-22 10 10-22 22-14 4z"/><path class="d-w" d="M118 52l10 10"/>`,
  lupa: `<path class="d-l" d="M18 104h124"/><rect class="d-s" x="26" y="66" width="16" height="38" rx="3"/><rect class="d-s" x="48" y="50" width="16" height="54" rx="3"/>
    <circle class="d-s" cx="100" cy="48" r="26"/><circle class="d-l" cx="100" cy="48" r="26"/><path class="d-l" d="M119 67l20 20"/><path class="d-al" d="M86 56l9-10 8 7 11-12"/>`,
  plan: `<rect class="d-l" x="34" y="10" width="92" height="100" rx="10"/><circle class="d-a" cx="56" cy="34" r="9"/><circle class="d-a" cx="56" cy="60" r="9"/><circle class="d-s" cx="56" cy="86" r="9"/>
    <path class="d-l" d="M74 34h36M74 60h30M74 86h24"/><path class="d-w" d="M52 34l3 3 6-6M52 60l3 3 6-6"/>`,
  scroll: `<rect class="d-l" x="48" y="6" width="62" height="108" rx="12"/><rect class="d-s" x="58" y="20" width="42" height="22" rx="5"/><rect class="d-a" x="58" y="48" width="42" height="24" rx="5"/>
    <rect class="d-s" x="58" y="78" width="42" height="22" rx="5"/><path class="d-al" d="M132 34v46M122 70l10 10 10-10"/>`,
  versiones: `<rect class="d-a" x="34" y="22" width="92" height="54" rx="12"/><text class="d-t" x="80" y="61" style="font-size:34px">0.1</text>
    <rect class="d-s" x="22" y="88" width="34" height="14" rx="7"/><rect class="d-s" x="63" y="88" width="34" height="14" rx="7"/><rect class="d-s" x="104" y="88" width="34" height="14" rx="7"/>`,
  noche: `<rect class="d-l" x="28" y="12" width="58" height="98" rx="12"/><path class="d-l" d="M44 34h26M44 46h18"/><circle class="d-s" cx="57" cy="80" r="15"/><path class="d-al" d="M50 80l5 5 9-10"/>
    <path class="d-a" d="M128 18a22 22 0 1 0 16 34 18 18 0 0 1-16-34z"/><path class="d-l" d="M104 76h12l-12 14h12"/>`,
  campana: `<path class="d-s" d="M80 18c-18 0-30 14-30 32v20l-10 14h80l-10-14V50c0-18-12-32-30-32z"/><path class="d-l" d="M80 18c-18 0-30 14-30 32v20l-10 14h80l-10-14V50c0-18-12-32-30-32zM70 92a10 10 0 0 0 20 0"/>
    <circle class="d-a" cx="110" cy="26" r="11"/><path class="d-al" d="M28 40c-4 8-4 18 0 26M132 40c4 8 4 18 0 26"/>`,
  ajustes: `<rect class="d-l" x="30" y="22" width="100" height="32" rx="16"/><circle class="d-a" cx="114" cy="38" r="11"/><rect class="d-l" x="30" y="68" width="100" height="32" rx="16"/><circle class="d-l" cx="46" cy="84" r="11"/>`,
  grafica: `<path class="d-l" d="M18 104h126M18 104V14"/><path class="d-s" d="M22 92l24-18 22 10 26-30 22 8 22-30v62H22z"/><path class="d-al" d="M22 92l24-18 22 10 26-30 22 8 22-30"/><circle class="d-a" cx="138" cy="32" r="6"/>`,
  arreglo: `<path class="d-l" d="M46 94l34-34a20 20 0 0 1 26-26l-12 12 4 10 10 4 12-12a20 20 0 0 1-26 26L60 108a10 10 0 0 1-14-14z"/><circle class="d-a" cx="120" cy="88" r="18"/><path class="d-w" d="M112 88l6 6 11-12"/>`,
  campo: `<rect class="d-s" x="22" y="8" width="116" height="104" rx="8"/><rect class="d-l" x="22" y="8" width="116" height="104" rx="8"/><path class="d-l" d="M22 60h116"/><circle class="d-l" cx="80" cy="60" r="14"/>
    <path class="d-l" d="M56 8v14h48V8M56 112V98h48v14"/><circle class="d-a" cx="52" cy="36" r="7"/><circle class="d-a" cx="80" cy="30" r="7"/><circle class="d-a" cx="108" cy="36" r="7"/><circle class="d-a" cx="62" cy="80" r="7"/><circle class="d-a" cx="98" cy="80" r="7"/>`,
  semaforo: `<rect class="d-l" x="58" y="6" width="44" height="108" rx="14"/><circle cx="80" cy="30" r="12" fill="#cf2537"/><circle cx="80" cy="60" r="12" fill="#b98314"/><circle cx="80" cy="90" r="12" fill="#1d9a63"/>
    <text class="d-t d-tl" x="30" y="68" style="font-size:22px">VS</text><text class="d-t d-tl" x="130" y="68" style="font-size:22px">VS</text>`,
  conexion: `<path class="d-l" d="M28 54a62 62 0 0 1 84 0M42 70a40 40 0 0 1 56 0M56 86a18 18 0 0 1 28 0"/><circle class="d-a" cx="70" cy="100" r="7"/>
    <path class="d-al" d="M142 92a16 16 0 1 1-5-12M138 70v10h10"/>`,
  dinero: `<path class="d-l" d="M24 84v12c0 6 14 10 30 10s30-4 30-10V84M24 84c0-6 14-10 30-10s30 4 30 10c0 6-14 10-30 10s-30-4-30-10zM24 66v12M84 66v12M24 66c0-6 14-10 30-10s30 4 30 10c0 6-14 10-30 10s-30-4-30-10z"/>
    <circle class="d-a" cx="112" cy="44" r="28"/><path class="d-w" d="M121 33a13 13 0 1 0 0 22M100 40h17M100 48h17"/>`,
  ia: `<path class="d-a" d="M70 16l8 24 24 8-24 8-8 24-8-24-24-8 24-8z"/><path class="d-al" d="M118 58l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/><path class="d-l" d="M38 84l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>`,
  periodico: `<rect class="d-s" x="24" y="18" width="100" height="86" rx="6"/><rect class="d-l" x="24" y="18" width="100" height="86" rx="6"/><rect class="d-a" x="36" y="30" width="44" height="30" rx="3"/>
    <path class="d-l" d="M90 32h22M90 44h22M90 56h22M36 74h76M36 88h54M124 34h10v64a6 6 0 0 1-6 6"/>`,
  oferta: `<path class="d-s" d="M26 62l42-42h52v52l-42 42z"/><path class="d-l" d="M26 62l42-42h52v52l-42 42z"/><circle class="d-a" cx="104" cy="36" r="8"/><text class="d-t d-tl" x="74" y="84" style="font-size:36px">€</text>`,
  cara: `<circle class="d-s" cx="80" cy="60" r="40"/><circle class="d-l" cx="80" cy="50" r="16"/><path class="d-l" d="M52 92c6-14 16-20 28-20s22 6 28 20"/><path class="d-al" d="M30 30V14h16M130 30V14h-16M30 90v16h16M130 90v16h-16"/>`,
  escudo: `<path class="d-a" d="M80 8l40 13v34c0 27-17 45-40 55-23-10-40-28-40-55V21z"/><path class="d-w" d="M58 72l15-15 11 10 18-21M90 46h12v12"/>`,
  camiseta: `<path class="d-s" d="M58 14L28 28l10 24 12-6v58h60V46l12 6 10-24-30-14c-2 10-10 16-22 16s-20-6-22-16z"/><path class="d-l" d="M58 14L28 28l10 24 12-6v58h60V46l12 6 10-24-30-14c-2 10-10 16-22 16s-20-6-22-16z"/>
    <text class="d-t" x="80" y="82" style="fill:var(--acc);font-size:30px">11</text>`,
  especular: `<path class="d-l" d="M20 104h120"/><path class="d-al" d="M28 88l30-30 18 14 40-42"/><path class="d-al" d="M100 30h16v16"/><circle class="d-a" cx="28" cy="88" r="6"/>
    <text class="d-t d-tl" x="128" y="92" style="font-size:26px">€</text>`,
};
