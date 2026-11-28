/* Los dibujos de las novedades (viewBox 0 0 160 120). Clases: d-l línea clara, d-al línea del color de la
   novedad, d-a relleno del color, d-s relleno suave, d-w línea blanca (sobre el color), d-t texto. */
export const DIBUJOS = {
  // (0.8) chat: la pregunta y la respuesta al momento (el rayo)
  chat: `<path class="d-s" d="M22 22h70a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12H54l-18 16V80H22a12 12 0 0 1-12-12V34a12 12 0 0 1 12-12z"/><path class="d-l" d="M22 22h70a12 12 0 0 1 12 12v34a12 12 0 0 1-12 12H54l-18 16V80H22a12 12 0 0 1-12-12V34a12 12 0 0 1 12-12z"/>
    <circle class="d-a" cx="36" cy="51" r="5"/><circle class="d-a" cx="57" cy="51" r="5"/><circle class="d-a" cx="78" cy="51" r="5"/>
    <path class="d-a" d="M120 36h22a8 8 0 0 1 8 8v30a8 8 0 0 1-8 8h-4v12l-12-12h-6a8 8 0 0 1-8-8V44a8 8 0 0 1 8-8z"/><path class="d-w" d="M135 44l-9 15h9l-5 14"/>`,
  // (0.8) aviso: el móvil con la notificación de la respuesta bajando por arriba
  aviso: `<rect class="d-l" x="50" y="8" width="60" height="104" rx="12"/><rect class="d-s" x="58" y="48" width="44" height="8" rx="4"/><rect class="d-s" x="58" y="62" width="34" height="8" rx="4"/><rect class="d-s" x="58" y="76" width="40" height="8" rx="4"/>
    <rect class="d-a" x="22" y="18" width="116" height="24" rx="12"/><circle class="d-w" cx="35" cy="30" r="5"/><path class="d-w" d="M48 26h44M48 34h28"/><path class="d-al" d="M144 14l8-6M146 30h10M144 46l8 6"/><path class="d-l" d="M72 102h16"/>`,
  // (0.8) pantalla: el móvil que se estira a las cuatro esquinas, y el banner de abajo tachado
  pantalla: `<rect class="d-s" x="46" y="8" width="68" height="104" rx="12"/><rect class="d-l" x="46" y="8" width="68" height="104" rx="12"/>
    <path class="d-al" d="M58 36V22h14M102 36V22H88M58 84v14h14M102 84v14H88M60 24l14 14M100 24L86 38M60 96l14-14M100 96L86 82"/>
    <rect class="d-l" x="122" y="92" width="30" height="12" rx="3" style="opacity:.55"/><path class="d-al" d="M118 108l38-20"/>`,
  // (0.8) ruta: el plan como un camino con sus paradas hasta la bandera
  ruta: `<path class="d-l" style="stroke-dasharray:6 7" d="M26 100c30 0 28-34 56-34s26-34 52-34"/><circle class="d-a" cx="26" cy="100" r="8"/><circle class="d-s" cx="82" cy="66" r="10"/><circle class="d-l" cx="82" cy="66" r="10"/>
    <path class="d-al" d="M77 66l4 4 7-8"/><path class="d-l" d="M134 34V8"/><path class="d-a" d="M134 8h20l-7 8 7 8h-20z"/>`,
  // (0.8) peligro: el marcador del riesgo de una cláusula, con la aguja casi en rojo
  peligro: `<path class="d-s" d="M22 94a58 58 0 0 1 116 0z"/><path class="d-l" d="M22 94a58 58 0 0 1 116 0"/><path class="d-al" style="stroke-width:8" d="M103 54a46 46 0 0 1 23 40"/>
    <path class="d-l" d="M80 42v8M43 57l6 6M117 57l-6 6M34 94h8M118 94h8"/><path class="d-al" d="M80 94l28-34"/><circle class="d-a" cx="80" cy="94" r="8"/><path class="d-l" d="M50 110h60"/>`,
  atardecer: `<path class="d-l" d="M14 92h132"/><path class="d-s" d="M46 92a32 32 0 0 1 64 0z"/><path class="d-l" d="M46 92a32 32 0 0 1 64 0"/><path class="d-al" d="M52 80h52M58 70h40M66 61h24"/>
    <path class="d-l" d="M126 92c0-16 2-30 6-42M132 50c-8-6-18-6-24 0M132 50c8-7 18-7 24-1M132 50c-3-8-9-12-16-13M132 50c3-8 9-12 16-12M132 50c-6 3-9 9-10 15M132 50c6 3 9 9 10 14"/><path class="d-l" d="M28 104h30M72 104h44"/>`,
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
  tarjeta: `<rect class="d-s" x="30" y="12" width="74" height="96" rx="10"/><rect class="d-l" x="30" y="12" width="74" height="96" rx="10"/><circle class="d-a" cx="49" cy="33" r="9"/><path class="d-l" d="M64 29h28M64 38h18M42 60h50M42 71h42M42 82h46"/>
    <path class="d-al" d="M114 58l32-16-12 34-7-12z"/><path class="d-al" d="M127 64l19-22"/>`,
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
  balon: `<circle class="d-s" cx="80" cy="60" r="46"/><circle class="d-l" cx="80" cy="60" r="46"/><path class="d-a" d="M80 41l17 12-6 19H69l-6-19z"/>
    <path class="d-l" d="M80 41V15M97 53l26-9M91 72l17 21M69 72L52 93M63 53L37 44"/>`,
  trofeo: `<path class="d-s" d="M52 16h56v30c0 17-12 28-28 28S52 63 52 46z"/><path class="d-l" d="M52 16h56v30c0 17-12 28-28 28S52 63 52 46zM52 26H34c0 18 8 27 20 29M108 26h18c0 18-8 27-20 29M80 74v16M66 90h28v18H66zM56 108h48"/>
    <path class="d-a" d="M80 28l4 9 10 1-7.500 6.500 2.500 10-9-5.500-9 5.500 2.500-10L66 38l10-1z"/>`,
  reloj: `<circle class="d-s" cx="80" cy="66" r="42"/><circle class="d-l" cx="80" cy="66" r="42"/><path class="d-l" d="M68 14h24M80 14v10M80 30v6M80 96v6M42 66h6M112 66h6"/>
    <path class="d-al" d="M80 66V42M80 66l17 10"/><circle class="d-a" cx="80" cy="66" r="5"/><path class="d-al" d="M120 28l8-8M40 28l-8-8"/>`,
  calendario: `<rect class="d-s" x="26" y="24" width="108" height="86" rx="10"/><rect class="d-l" x="26" y="24" width="108" height="86" rx="10"/><path class="d-a" d="M26 36a12 12 0 0 1 12-12h84a12 12 0 0 1 12 12v12H26z"/>
    <path class="d-l" d="M54 14v18M106 14v18M42 66h8M66 66h8M90 66h8M114 66h8M42 82h8M66 82h8M114 82h8M42 98h8M66 98h8"/><circle class="d-a" cx="94" cy="82" r="10"/>`,
  candado: `<path class="d-l" d="M52 54V42a28 28 0 0 1 56 0v12"/><rect class="d-a" x="38" y="54" width="84" height="58" rx="12"/><circle class="d-w" cx="80" cy="78" r="8"/><path class="d-w" d="M80 86v14"/>`,
  estrella: `<path class="d-s" d="M80 12L93 44L128 47L101 69L109 102L80 84L51 102L59 69L32 47L67 44z"/><path class="d-l" d="M80 12L93 44L128 47L101 69L109 102L80 84L51 102L59 69L32 47L67 44z"/><path class="d-al" d="M132 20l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM26 90l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>`,
  porteria: `<rect class="d-s" x="24" y="30" width="112" height="76"/><path class="d-l" d="M24 106V30h112v76"/><path class="d-l" style="stroke-width:1.5;opacity:.5" d="M24 49h112M24 68h112M24 87h112M52 30v76M80 30v76M108 30v76"/>
    <circle class="d-a" cx="104" cy="88" r="13"/><path class="d-w" d="M104 81l5 4-2 6h-6l-2-6z"/><path class="d-l" d="M12 106h136"/>`,
  pizarra: `<rect class="d-s" x="18" y="12" width="124" height="88" rx="8"/><rect class="d-l" x="18" y="12" width="124" height="88" rx="8"/><path class="d-al" d="M40 34l14 14M54 34L40 48M98 70l14 14M112 70L98 84"/>
    <circle class="d-l" cx="112" cy="40" r="8"/><circle class="d-l" cx="46" cy="76" r="8"/><path class="d-al" style="stroke-dasharray:5 6" d="M60 40c20-10 34 0 38 22"/><path class="d-l" d="M56 112h48"/>`,
  regalo: `<rect class="d-s" x="32" y="56" width="96" height="54" rx="6"/><rect class="d-l" x="32" y="56" width="96" height="54" rx="6"/><rect class="d-a" x="26" y="40" width="108" height="20" rx="5"/><path class="d-l" d="M80 40v70"/>
    <path class="d-al" d="M80 40c-6-18-32-20-30-6 2 8 18 6 30 6zM80 40c6-18 32-20 30-6-2 8-18 6-30 6z"/>`,
  cohete: `<path class="d-a" d="M80 8c20 14 26 40 19 68H61C54 48 60 22 80 8z"/><circle class="d-w" cx="80" cy="42" r="9"/><path class="d-l" d="M62 58L44 76l4 18 16-8M98 58l18 18-4 18-16-8"/><path class="d-al" d="M71 86v18M80 86v26M89 86v18"/>`,
  movil: `<rect class="d-l" x="44" y="6" width="72" height="108" rx="14"/><rect class="d-s" x="55" y="20" width="16" height="16" rx="5"/><rect class="d-s" x="78" y="20" width="16" height="16" rx="5"/><rect class="d-s" x="55" y="44" width="16" height="16" rx="5"/>
    <rect class="d-a" x="78" y="44" width="16" height="16" rx="5"/><rect class="d-s" x="55" y="68" width="16" height="16" rx="5"/><rect class="d-s" x="78" y="68" width="16" height="16" rx="5"/><path class="d-l" d="M68 102h24"/>
    <circle class="d-a" cx="122" cy="28" r="15"/><path class="d-w" d="M122 20v16M114 28h16"/>`,
  // (0.9) el diseño nuevo: un móvil con las dos cápsulas de arriba, tarjetas y la barra de abajo en cápsula con su gota
  // (0.9c) la pantalla nueva entra desde el lado al que vas
  deslizar: `<rect class="d-s" x="24" y="18" width="46" height="84" rx="10"/><rect class="d-l" x="58" y="6" width="72" height="108" rx="14"/>
    <rect class="d-s" x="68" y="20" width="52" height="20" rx="6"/><rect class="d-a" x="68" y="46" width="52" height="14" rx="6"/><rect class="d-s" x="68" y="66" width="52" height="14" rx="6"/>
    <rect class="d-l" x="70" y="92" width="48" height="12" rx="6"/><path class="d-al" d="M150 60h-26M132 52l-8 8 8 8"/>`,
  cristal: `<rect class="d-l" x="42" y="6" width="76" height="108" rx="16"/><rect class="d-s" x="50" y="15" width="34" height="11" rx="5.5"/><rect class="d-s" x="88" y="15" width="22" height="11" rx="5.5"/>
    <rect class="d-s" x="50" y="33" width="60" height="22" rx="7"/><path class="d-l" d="M56 41h22M56 48h34"/><rect class="d-s" x="50" y="60" width="60" height="14" rx="6"/>
    <rect class="d-l" x="48" y="88" width="64" height="18" rx="9"/><rect class="d-a" x="51" y="91" width="18" height="12" rx="6"/><circle class="d-s" cx="79" cy="97" r="3"/><circle class="d-s" cx="90" cy="97" r="3"/><circle class="d-s" cx="101" cy="97" r="3"/>
    <path class="d-al" d="M132 22v14M125 29h14M24 76v10M19 81h10"/>`,
  compartir: `<path class="d-l" d="M56 54H44a6 6 0 0 0-6 6v46a6 6 0 0 0 6 6h72a6 6 0 0 0 6-6V60a6 6 0 0 0-6-6h-12"/><rect class="d-s" x="38" y="54" width="84" height="58" rx="6"/><path class="d-al" d="M80 82V12M62 30l18-18 18 18"/>`,
  balanza: `<path class="d-l" d="M80 14v86M50 104h60M30 34h100"/><path class="d-s" d="M30 34L12 70a18 11 0 0 0 36 0z"/><path class="d-l" d="M30 34L12 70a18 11 0 0 0 36 0zM130 34l-18 36a18 11 0 0 0 36 0z"/><path class="d-a" d="M130 34l-18 36a18 11 0 0 0 36 0z"/><circle class="d-a" cx="80" cy="14" r="6"/>`,
  bandera: `<path class="d-l" d="M42 8v104"/><path class="d-s" d="M42 18h74l-16 26 16 26H42z"/><path class="d-a" d="M42 18h74l-16 26 16 26H42z" style="opacity:.9"/><circle class="d-w" cx="68" cy="44" r="8"/>`,
  rayo: `<path class="d-s" d="M94 8L42 72h34l-8 40 52-66H84z"/><path class="d-l" d="M94 8L42 72h34l-8 40 52-66H84z"/><path class="d-al" d="M26 34h14M18 52h12M126 86h14M132 70h12"/>`,
  portatil: `<rect class="d-s" x="28" y="16" width="104" height="70" rx="8"/><rect class="d-l" x="28" y="16" width="104" height="70" rx="8"/><path class="d-l" d="M14 102h132M58 102l4-16h36l4 16"/>
    <path class="d-al" d="M46 68l20-18 16 10 28-28"/><circle class="d-a" cx="110" cy="32" r="6"/>`,
  corona: `<path class="d-s" d="M24 92l-6-56 34 28 28-46 28 46 34-28-6 56z"/><path class="d-l" d="M24 92l-6-56 34 28 28-46 28 46 34-28-6 56zM24 104h112"/><circle class="d-a" cx="80" cy="30" r="7"/><circle class="d-a" cx="18" cy="34" r="5"/><circle class="d-a" cx="142" cy="34" r="5"/>`,
  tarjetas: `<rect x="40" y="20" width="52" height="74" rx="7" fill="#d9a21b" transform="rotate(-10 66 57)"/><rect class="d-l" x="40" y="20" width="52" height="74" rx="7" transform="rotate(-10 66 57)"/>
    <rect x="76" y="26" width="52" height="74" rx="7" fill="#cf2537" transform="rotate(9 102 63)"/><rect class="d-l" x="76" y="26" width="52" height="74" rx="7" transform="rotate(9 102 63)"/>`,
  hucha: `<ellipse class="d-s" cx="78" cy="70" rx="46" ry="34"/><ellipse class="d-l" cx="78" cy="70" rx="46" ry="34"/><path class="d-l" d="M54 98v12h14V100M88 100v10h14V96M124 62h10l4-8M100 38l4-14 14 12"/>
    <path class="d-l" d="M64 54h22"/><circle class="d-l" cx="106" cy="62" r="2"/><path class="d-l" d="M32 66c-10-4-16 4-10 12"/><circle class="d-a" cx="76" cy="14" r="11"/>`,
  // (22 nov) las bajas de la jornada: el botiquín con su cruz
  botiquin: `<path class="d-l" d="M64 30v-8a6 6 0 0 1 6-6h20a6 6 0 0 1 6 6v8"/><rect class="d-s" x="26" y="30" width="108" height="78" rx="14"/><rect class="d-l" x="26" y="30" width="108" height="78" rx="14"/>
    <path class="d-a" d="M72 46h16v15h15v16H88v15H72V77H57V61h15z"/>`,
};
