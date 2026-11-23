// Maquetas de la tarjeta de horarios de una jornada (23 nov): cuatro diseños con la J16 de verdad. node maqueta.mjs <salida>
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const BOT = '/home/claude/fantasy-manager/bot/lib/';
const E = await import(BOT + 'estilo.mjs');
const { aPng } = await import(BOT + 'tarjetas.mjs');
const LL = await import(BOT + 'laliga.mjs');
const { ANCHO, texto, escudo, fondo, dorado, titular, marca, panel, marco, medir, B, TINTA, TENUE, ROJO, VERDE, AMBAR, uri, lineal, id } = E;
const ORO = '#f2cf6b';
const salida = process.argv[2] || '/tmp/horarios'; mkdirSync(salida, { recursive: true });

const cache = '/tmp/escudos-cache'; mkdirSync(cache, { recursive: true });
const img = async (u) => { const f = `${cache}/${createHash('md5').update(u).digest('hex')}.png`; if (existsSync(f)) return readFileSync(f); const b = await LL.imagen(u); writeFileSync(f, b); return b; };
const st = await LL.statsSemana(16);
const CL = [['elche', 'Elche', 'ELC'], ['sevilla', 'Sevilla', 'SEV'], ['levante', 'Levante', 'LEV'], ['alav', 'Alavés', 'ALA'], ['villarreal', 'Villarreal', 'VIL'],
  ['rayo', 'Rayo', 'RAY'], ['málaga', 'Málaga', 'MAL'], ['barcelona', 'Barça', 'BAR'], ['betis', 'Betis', 'BET'], ['racing', 'Racing', 'RAC'], ['atlético', 'Atlético', 'ATM'],
  ['valencia', 'Valencia', 'VAL'], ['deportivo', 'Dépor', 'DEP'], ['athletic', 'Athletic', 'ATH'], ['sociedad', 'Real Sociedad', 'RSO'], ['getafe', 'Getafe', 'GET'],
  ['real madrid', 'Real Madrid', 'RMA'], ['osasuna', 'Osasuna', 'OSA'], ['espanyol', 'Espanyol', 'ESP'], ['celta', 'Celta', 'CEL']];
const club = {};
for (const m of st) for (const l of [m.local, m.visitor]) {
  const n = l.mainName.toLowerCase(); const c = CL.find(([k]) => n.includes(k) && !(k === 'deportivo' && n.includes('alav')));
  club[c[1]] = { corto: c[1], sig: c[2], esc: await img(l.badgeColor) };
}
// los horarios que hizo oficiales LaLiga el 23 nov
const DIAS = [['VIERNES', 11], ['SÁBADO', 12], ['DOMINGO', 13], ['LUNES', 14]];
const P = [[0, '21:00', 'Elche', 'Sevilla'], [1, '14:00', 'Levante', 'Alavés'], [1, '16:15', 'Villarreal', 'Rayo'], [1, '18:30', 'Málaga', 'Barça'], [1, '21:00', 'Betis', 'Racing'],
  [2, '14:00', 'Atlético', 'Valencia'], [2, '16:15', 'Dépor', 'Athletic'], [2, '18:30', 'Real Sociedad', 'Getafe'], [2, '21:00', 'Real Madrid', 'Osasuna'], [3, '21:00', 'Espanyol', 'Celta']]
  .map(([d, h, a, b]) => ({ d, h, L: club[a], V: club[b] }));
const M = (s) => s.toUpperCase();
const SUB = 'JORNADA 16 · LALIGA EA SPORTS', SUB2 = 'DEL VIERNES 11 AL LUNES 14 DE DICIEMBRE';

// A · por días: una lista con la hora a la izquierda, agrupada por día
function A() {
  const oro = dorado(), FILA = 84, CAB = 64, y0 = 200;
  const H = y0 + DIAS.length * CAB + P.length * FILA + 30 + 80;
  let s = oro.defs + fondo([[600, 40, 760, ORO, 0.12]], H) + titular('HORARIOS', oro.g, SUB, { px: 96, sub2: SUB2 });
  let y = y0;
  s += panel(22, y - 10, 1156, H - y0 - 70, ORO, { brillo: 0.12 });
  DIAS.forEach(([dia, n], k) => {
    const ps = P.filter((p) => p.d === k);
    const tt = `${dia} ${n}`, w = medir(tt, 28, B, 3) + 40;
    s += `<rect x="52" y="${y + 14}" width="${w}" height="42" rx="21" fill="${ORO}"/>` + texto(72, y + 46, tt, { px: 28, peso: 900, color: '#2a1c04', espacio: 3 });
    y += CAB;
    ps.forEach((p, i) => {
      const cy = y + FILA / 2;
      if (i) s += `<rect x="60" y="${y}" width="1080" height="1" fill="#fff" fill-opacity="0.08"/>`;
      s += texto(70, cy + 15, p.h, { px: 44, peso: 800, color: ORO })
        + escudo(p.L.esc, 600 - 46, cy, 56) + texto(600 - 86, cy + 13, M(p.L.corto), { px: 38, peso: 800, ancla: 'end', max: 300 })
        + texto(600, cy + 11, '–', { px: 34, peso: 700, color: TENUE, ancla: 'middle' })
        + escudo(p.V.esc, 600 + 46, cy, 56) + texto(600 + 86, cy + 13, M(p.V.corto), { px: 38, peso: 800, max: 300 });
      if (k === 0 && i === 0) s += texto(1130, cy + 9, 'ABRE', { px: 22, peso: 800, color: VERDE, ancla: 'end', espacio: 2 });
      if (k === DIAS.length - 1 && i === ps.length - 1) s += texto(1130, cy + 9, 'CIERRA', { px: 22, peso: 800, color: ROJO, ancla: 'end', espacio: 2 });
      y += FILA;
    });
  });
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// B · parrilla: los días en columnas y las franjas en filas, con los dos escudos en cada hueco
function Bp() {
  const oro = dorado(), FR = ['14:00', '16:15', '18:30', '21:00'], y0 = 230, x0 = 150, cw = (1178 - x0) / 4, ch = 196;
  const H = y0 + FR.length * ch + 40 + 80;
  let s = oro.defs + fondo([[600, 40, 760, ORO, 0.12]], H) + titular('HORARIOS', oro.g, SUB, { px: 96, sub2: SUB2 });
  DIAS.forEach(([dia, n], k) => { const cx = x0 + cw * (k + 0.5); s += texto(cx, y0 - 12, `${dia.slice(0, 3)} ${n}`, { px: 34, peso: 900, color: ORO, ancla: 'middle', espacio: 3 }); });
  FR.forEach((f, r) => {
    const y = y0 + r * ch;
    s += texto(x0 - 22, y + ch / 2 + 14, f, { px: 40, peso: 800, color: TINTA, ancla: 'end' });
    DIAS.forEach((_, k) => {
      const x = x0 + k * cw, p = P.find((q) => q.d === k && q.h === f);
      if (!p) { s += `<rect x="${x + 8}" y="${y + 8}" width="${cw - 16}" height="${ch - 16}" rx="22" fill="#fff" fill-opacity="0.025" stroke="#fff" stroke-opacity="0.06" stroke-dasharray="6 8"/>`; return; }
      s += panel(x + 8, y + 8, cw - 16, ch - 16, ORO, { rx: 22, brillo: 0.18 });
      const cx = x + cw / 2, cy = y + 8 + 74;
      s += escudo(p.L.esc, cx - 52, cy, 82) + escudo(p.V.esc, cx + 52, cy, 82)
        + texto(cx, y + ch - 30, `${p.L.sig} · ${p.V.sig}`, { px: 30, peso: 800, ancla: 'middle', espacio: 2 });
    });
  });
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// C · fichas: una por partido, en dos columnas, con los escudos grandes y la hora en el centro
function C() {
  const oro = dorado(), y0 = 210, fw = 565, fh = 214, gap = 18;
  const H = y0 + 5 * (fh + gap) - gap + 30 + 80;
  let s = oro.defs + fondo([[300, 40, 700, ORO, 0.1], [900, 40, 700, ROJO, 0.1]], H) + titular('HORARIOS', oro.g, SUB, { px: 96, sub2: SUB2 });
  P.forEach((p, i) => {
    const x = 26 + (i % 2) * (fw + 18), y = y0 + Math.floor(i / 2) * (fh + gap), cx = x + fw / 2;
    s += panel(x, y, fw, fh, ORO, { rx: 26, brillo: 0.2 });
    const tt = `${DIAS[p.d][0].slice(0, 3)} ${DIAS[p.d][1]} · ${p.h}`, w = medir(tt, 28, B, 2) + 36;
    s += `<rect x="${cx - w / 2}" y="${y + 16}" width="${w}" height="40" rx="20" fill="${ORO}"/>` + texto(cx, y + 46, tt, { px: 28, peso: 900, color: '#2a1c04', ancla: 'middle', espacio: 2 });
    s += escudo(p.L.esc, cx - 150, y + 118, 84) + escudo(p.V.esc, cx + 150, y + 118, 84)
      + texto(cx, y + 130, 'VS', { px: 36, peso: 800, italica: true, color: TENUE, ancla: 'middle' })
      + texto(cx - 150, y + 190, M(p.L.corto), { px: 30, peso: 800, ancla: 'middle', max: 230 }) + texto(cx + 150, y + 190, M(p.V.corto), { px: 30, peso: 800, ancla: 'middle', max: 230 });
  });
  return marco(s + marca(600, H - 30, { ancla: 'middle' }), H);
}

// D · compacta 16:9 (cabe entera en el timeline de X sin recorte): dos columnas de cinco con siglas
function D() {
  const oro = dorado(), H = 675, y0 = 150, FILA = 86;
  let s = oro.defs + fondo([[600, 0, 700, ORO, 0.12]], H)
    + texto(44, 92, 'HORARIOS', { px: 84, peso: 800, italica: true, color: `url(#${oro.g})` })
    + texto(1156, 64, 'JORNADA 16', { px: 38, peso: 800, ancla: 'end', espacio: 2 }) + texto(1156, 98, '11-14 DE DICIEMBRE', { px: 24, peso: 700, color: TENUE, ancla: 'end', espacio: 3 });
  P.forEach((p, i) => {
    const col = i < 5 ? 0 : 1, x = 26 + col * 583, y = y0 + (i % 5) * FILA, w = 565;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${FILA - 12}" rx="18" fill="#fff" fill-opacity="0.045" stroke="#fff" stroke-opacity="0.08"/>`;
    const cy = y + (FILA - 12) / 2;
    s += texto(x + 22, cy - 9, DIAS[p.d][0].slice(0, 3) + ' ' + DIAS[p.d][1], { px: 19, peso: 800, color: TENUE, espacio: 2 })
      + texto(x + 22, cy + 25, p.h, { px: 32, peso: 800, color: ORO })
      + escudo(p.L.esc, x + 196, cy, 50) + texto(x + 230, cy + 12, p.L.sig, { px: 36, peso: 800, espacio: 1 })
      + texto(x + 340, cy + 10, '–', { px: 30, peso: 700, color: TENUE, ancla: 'middle' })
      + texto(x + 450, cy + 12, p.V.sig, { px: 36, peso: 800, ancla: 'end', espacio: 1 }) + escudo(p.V.esc, x + 486, cy, 50);
  });
  return marco(s + marca(600, H - 24, { ancla: 'middle' }), H);
}

const out = {};
for (const [k, f] of [['A', A], ['B', Bp], ['C', C], ['D', D]]) {
  const svg = f(); const png = await aPng(svg, { escalas: [1] });
  writeFileSync(`${salida}/horarios-${k}.png`, png); writeFileSync(`${salida}/horarios-${k}.svg`, svg);
  out[k] = { png, h: Number(svg.match(/height="(\d+)"/)[1]) };
}
// la hoja con las cuatro, rotulada
const R = { A: 'A · POR DÍAS', B: 'B · PARRILLA', C: 'C · FICHAS', D: 'D · COMPACTA 16:9' };
const esc = 0.5, cw = 600, pad = 40, lab = 70;
const filas = [['A', 'B'], ['C', 'D']];
let y = 30, cuerpo = '';
for (const fila of filas) {
  const hmax = Math.max(...fila.map((k) => out[k].h * esc));
  fila.forEach((k, i) => {
    const x = pad + i * (cw + pad);
    cuerpo += `<text x="${x}" y="${y + 44}" font-family="Barlow Condensed" font-weight="800" font-size="40" fill="${ORO}" letter-spacing="2">${R[k]}</text>`
      + `<image href="${uri(out[k].png)}" x="${x}" y="${y + lab}" width="${cw}" height="${out[k].h * esc}"/>`;
  });
  y += lab + hmax + pad;
}
const W = pad * 3 + cw * 2;
const hoja = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${y}" viewBox="0 0 ${W} ${y}"><rect width="${W}" height="${y}" fill="#141218"/>${cuerpo}</svg>`;
writeFileSync(`${salida}/horarios-variantes.png`, await aPng(hoja, { escalas: [1.6] }));
console.log('ok', Object.entries(out).map(([k, v]) => `${k}:${v.h}`).join(' '));
