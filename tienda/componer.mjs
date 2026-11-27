// Las tarjetas de las tiendas: titular, línea, degradado con luz y la pantalla dentro de un móvil de cristal.
//   node componer.mjs <pantallas> <salida> <ancho> <alto> [WEB=ruta de web/ para las fuentes y el icono]
// Tamaños: App Store 1320×2868 (6,9") y 1206×2622 (6,3"); Google Play 1080×1920.
import fs from 'node:fs';
const pw = await import(process.env.PW_MODULO || '/opt/npm-tools/node_modules/playwright/index.mjs');
const [, , ent, sal, Wa, Ha] = process.argv;
const W = +Wa, H = +Ha;
const WEB = process.env.WEB || '/home/claude/maqueta/web';
fs.mkdirSync(sal, { recursive: true });
const b64 = (f) => fs.readFileSync(f).toString('base64');
const F = { c7: b64(`${WEB}/fonts/barlow-condensed-700.woff2`), r4: b64(`${WEB}/fonts/barlow-400.woff2`), r5: b64(`${WEB}/fonts/barlow-500.woff2`), r6: b64(`${WEB}/fonts/barlow-600.woff2`) };
const ICONO = b64(`${WEB}/img/icono-180.png`);

// [archivo, titular (lo de <em>, en rojo), línea]
export const TARJETAS = [
  ['hoy', 'Tu plan<br>de <em>hoy</em>', 'Qué fichar, vender y alinear, paso a paso'],
  ['mercado', 'Los que<br>más <em>suben</em>', 'Ficha antes de que se revaloricen', 'Los que más <em>suben</em>'],
  ['ficha', 'Cada jugador,<br><em>a fondo</em>', 'Valor, cláusula, rival y qué hacer con él'],
  ['parte', 'El parte de<br>tus <em>rivales</em>', 'Quién va corto, sin blindajes o en negativo'],
  ['equipo', 'Tu mejor<br><em>once</em>', 'El que más puntúa, con el % de ser titular'],
  ['rival', 'El dinero de<br>cada <em>rival</em>', 'Quién puede pagar tus cláusulas'],
  ['chat', 'Pregúntale a<br>tu <em>míster IA</em>', 'Cualquier duda de tu liga, con cifras', 'Tu <em>míster IA</em>', 'Pregúntale cualquier duda de tu liga, con cifras'],
  ['clubes', 'Club<br>a <em>club</em>', 'Clasificación, calendario y bajas'],
];

const PLAY = H / W < 2; // en Play (9:16) el titular va en una línea y más pequeño, para que el móvil se vea grande
const pag = (img, tit, sub) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face { font-family: BC; src: url(data:font/woff2;base64,${F.c7}); font-weight: 700; }
  @font-face { font-family: B; src: url(data:font/woff2;base64,${F.r4}); font-weight: 400; }
  @font-face { font-family: B; src: url(data:font/woff2;base64,${F.r5}); font-weight: 500; }
  @font-face { font-family: B; src: url(data:font/woff2;base64,${F.r6}); font-weight: 600; }
  :root { --u: ${W / 100}px; --rojo: #ff3b4e; }
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { position: relative; color: #f6f3f4; font-family: B, sans-serif; text-align: center; display: flex; flex-direction: column; align-items: center;
    padding-top: calc(var(--u) * ${PLAY ? 4.6 : 6});
    background:
      radial-gradient(75% 34% at 50% 58%, rgba(255, 45, 70, .40), transparent 70%),
      radial-gradient(60% 26% at 0% 6%, rgba(255, 80, 60, .22), transparent 70%),
      radial-gradient(55% 28% at 100% 20%, rgba(150, 20, 60, .35), transparent 70%),
      linear-gradient(180deg, #2a070f 0%, #14050a 45%, #08070a 100%); }
  body::before { content: ''; position: absolute; inset: -20%; background:
      linear-gradient(115deg, transparent 38%, rgba(255,255,255,.05) 44%, transparent 52%),
      linear-gradient(115deg, transparent 58%, rgba(255,255,255,.035) 62%, transparent 68%); pointer-events: none; }
  .marca { display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 1.8);
    font: 600 calc(var(--u) * 3.1) B; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.72); }
  .marca img { width: calc(var(--u) * 6.2); height: calc(var(--u) * 6.2); border-radius: calc(var(--u) * 1.5); box-shadow: 0 0 0 1px rgba(255,255,255,.12); }
  h1 { margin: calc(var(--u) * ${PLAY ? 3 : 4.2}) calc(var(--u) * 4) 0; font: 700 calc(var(--u) * ${PLAY ? 9.4 : 11.5}) / .94 BC, sans-serif; text-transform: uppercase; letter-spacing: .005em; text-wrap: balance;
    text-shadow: 0 calc(var(--u) * .6) calc(var(--u) * 3) rgba(0,0,0,.45); }
  h1 em { font-style: normal; color: var(--rojo); text-shadow: 0 0 calc(var(--u) * 4) rgba(255, 59, 78, .45); }
  p { margin: calc(var(--u) * ${PLAY ? 1.8 : 2.6}) calc(var(--u) * 6) 0; font: 500 calc(var(--u) * ${PLAY ? 4 : 4.4}) / 1.25 B; color: rgba(246, 243, 244, .84); text-wrap: balance; }
  .tel { position: relative; margin-top: calc(var(--u) * ${PLAY ? 4.2 : 5.5}); flex: none;
    padding: calc(var(--u) * 1.55); border-radius: calc(var(--u) * 9.5);
    background: linear-gradient(150deg, rgba(255,255,255,.34), rgba(255,255,255,.08) 30%, rgba(255,255,255,.04) 65%, rgba(255,255,255,.22));
    box-shadow: 0 calc(var(--u) * 4) calc(var(--u) * 12) rgba(0,0,0,.65), 0 0 calc(var(--u) * 14) rgba(255, 40, 70, .22), inset 0 0 0 1px rgba(255,255,255,.18); }
  .tel::before { content: ''; position: absolute; inset: calc(var(--u) * .55); border-radius: calc(var(--u) * 9); background: #0b0b0e; }
  .tel img { position: relative; display: block; width: 100%; border-radius: calc(var(--u) * 8); }
  .tel::after { content: ''; position: absolute; inset: calc(var(--u) * 1.55); border-radius: calc(var(--u) * 8); pointer-events: none;
    background: linear-gradient(160deg, rgba(255,255,255,.07), transparent 22%); }
  .pie { position: absolute; bottom: calc(var(--u) * 2.3); left: 0; right: 0; font: 400 calc(var(--u) * 2.15) B; color: rgba(255,255,255,.5); letter-spacing: .02em; }
  </style></head><body>
  <div class="marca"><img src="data:image/png;base64,${ICONO}">Fantasy Manager</div>
  <h1>${PLAY ? tit.replace(/<br>/g, ' ') : tit}</h1>
  <p>${sub}</p>
  <div class="tel"><img src="data:image/png;base64,${img}"></div>
  <div class="pie">Liga de ejemplo con datos inventados · App no oficial, sin relación con LaLiga</div>
  </body></html>`;

// el móvil, lo más grande que quepa entero entre la línea y el pie (y como mucho el 82 % del ancho)
const ajustar = () => {
  const t = document.querySelector('.tel'), i = t.querySelector('img');
  const u = innerWidth / 100, pad = 1.55 * u * 2;
  const libre = innerHeight - t.getBoundingClientRect().top - 7.5 * u;
  const asp = i.naturalWidth / i.naturalHeight;
  const w = Math.min(innerWidth * 0.8, (libre - pad) * asp + pad);
  t.style.width = `${w}px`;
  return { w: Math.round(w), libre: Math.round(libre), h1: Math.round(document.querySelector('h1').getBoundingClientRect().height / u) };
};

const nav = await pw.chromium.launch();
const pg = await nav.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
let n = 0;
for (const [arch, tit0, sub0, titP, subP] of TARJETAS) {
  const tit = (PLAY && titP) || tit0, sub = (PLAY && subP) || sub0;
  const f = `${ent}/${arch}.png`;
  if (!fs.existsSync(f)) { console.log('falta', f); continue; }
  n++;
  await pg.setContent(pag(b64(f), tit, sub));
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForFunction(() => document.querySelector('.tel img').complete);
  const m = await pg.evaluate(ajustar);
  if (process.env.VER) console.log(arch, JSON.stringify(m));
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${sal}/${String(n).padStart(2, '0')}-${arch}.png` });
}
console.log('hechas', n, `${W}×${H}`);
await nav.close();
