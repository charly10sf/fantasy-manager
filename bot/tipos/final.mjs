// Resumen al acabar cada partido, en lenguaje de persona: el marcador, quién se lo ha llevado, cuánto por encima de su media,
// quién lo ha pasado mal. Todo sale de los datos de LaLiga (puntos de la jornada, media y racha de la lista de jugadores).
import { cierre, quepa, armar, corto, elegir, fmt, partes } from '../lib/texto.mjs';
import { rachaDe } from '../lib/laliga.mjs';

export async function generar({ stats, jornada, jugadores }) {
  const porId = new Map(jugadores.map((j) => [String(j.id), j]));
  const out = [];
  for (const m of stats.filter((x) => x.matchState === 7)) {
    const filas = [];
    for (const lado of [m.local, m.visitor]) for (const p of lado.players || []) {
      if (p.weekPoints == null) continue;
      const j = porId.get(String(p.id));
      filas.push({ id: p.id, nombre: p.nickname || p.name, equipo: corto(lado.mainName), pts: Number(p.weekPoints), media: j ? Number(j.averagePoints) : null });
    }
    if (filas.length < 10) continue;
    const ord = [...filas].sort((a, b) => b.pts - a.pts);
    const top = ord[0];
    const empate = ord[1].pts === top.pts ? ord[1] : null;
    const peor = ord[ord.length - 1].pts < 0 ? ord[ord.length - 1] : null;
    const gl = Number(m.localScore), gv = Number(m.visitorScore);
    const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
    const marcador = `${L} ${gl}-${gv} ${V}`;
    const dif = Math.abs(gl - gv);
    const emoji = dif >= 3 ? '🔥' : gl === gv ? '🤝' : '🏁';
    const cab = `${emoji} ${marcador} · LaLiga Fantasy J${jornada}`;
    const pie = cierre(`final${m.id}`);
    const num = [jornada, gl, gv];
    const lineas = [];
    // 1) el mejor (o los dos mejores, si empatan)
    if (empate) {
      lineas.push(`⭐ ${top.nombre} (${top.equipo}) y ${empate.nombre} (${empate.equipo}) se reparten el trono: ${top.pts} puntos cada uno.`);
      num.push(top.pts);
    } else {
      lineas.push(`⭐ ${elegir([`${top.nombre} (${top.equipo}) manda con ${top.pts} puntos.`, `${top.nombre} (${top.equipo}) lo borda: ${top.pts} puntos.`, `El MVP fantasy: ${top.nombre} (${top.equipo}), ${top.pts} puntos.`], `mvp${m.id}`)}`);
      num.push(top.pts);
    }
    // 2) un dato con miga: el doble de su media, una racha, o el podio
    const t2 = empate ? ord[2] : ord[1], t3 = empate ? ord[3] : ord[2];
    const racha = (() => { const j = porId.get(String(top.id)); const r = j ? rachaDe(j, 3) : []; return r.length === 3 && r.every(([, p]) => p >= 8) ? r.map(([, p]) => p) : null; })();
    if (top.media && top.media >= 3 && top.pts >= 2 * top.media) {
      lineas.push(`📈 Ojo: suele sacar ${fmt(top.media)} de media y hoy más del doble.`);
      num.push(...partes(top.media), 2);
    } else if (racha) {
      lineas.push(`🔁 Y van 3 jornadas seguidas con 8 puntos o más: ${racha.join(', ')}.`);
      num.push(3, 8, ...racha);
    }
    lineas.push(`🥈 ${t2.nombre} ${t2.pts} · 🥉 ${t3.nombre} ${t3.pts}`);
    num.push(t2.pts, t3.pts);
    // 3) quién lo ha pasado peor
    if (peor) {
      const encajo = peor.equipo === L ? gv : gl;
      lineas.push(`🔻 Para olvidar: ${peor.nombre} (${peor.equipo}), ${peor.pts}.${encajo >= 3 ? ` Su equipo encajó ${encajo}.` : ''}`);
      num.push(peor.pts); if (encajo >= 3) num.push(encajo);
    }
    const usadas = quepa(cab, lineas, pie);
    if (usadas.length < 1) continue;
    out.push({ tipo: 'final', clave: `final|${m.id}`, jornada, texto: armar(cab, usadas, pie), numeros: num });
  }
  return out;
}
