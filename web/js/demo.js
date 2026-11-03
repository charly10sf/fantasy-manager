/* Una liga de ejemplo para ver la app sin entrar (y para probarla fuera del móvil). Los jugadores son de
   LaLiga, pero los valores, cláusulas, puntos y movimientos son inventados. */
import { DIA, HORA, diaDe } from './util.js';

const EQUIPOS = {
  15: ['Real Madrid', 'RMA'], 4: ['Barcelona', 'BAR'], 2: ['Atlético', 'ATM'], 3: ['Athletic', 'ATH'], 20: ['Villarreal', 'VIL'],
  5: ['Betis', 'BET'], 16: ['Real Sociedad', 'RSO'], 6: ['Celta', 'CEL'], 13: ['Osasuna', 'OSA'], 21: ['Alavés', 'ALA'],
  14: ['Rayo', 'RAY'], 17: ['Sevilla', 'SEV'], 18: ['Valencia', 'VAL'], 12: ['Málaga', 'MGA'], 8: ['Espanyol', 'ESP'],
  9: ['Getafe', 'GET'], 7: ['Elche', 'ELC'], 11: ['Levante', 'LEV'], 26: ['Deportivo', 'RCD'], 49: ['Racing', 'RAC'],
};
// [nombre, equipo, posición, valor en M, media, id en LaLiga]. Los equipos y sus ids son los de LaLiga en la 26/27 y los
// jugadores, los 7 de más valor de cada uno (portero, 2 defensas, 2 medios y 2 delanteros) el 2 nov 2026; el valor va a
// 2/3 del real para que cuadre con el dinero de la demo y la media es la suya, con tope 10. El id sirve para ponerles la
// cara (caras-demo.js); la foto no se guarda aquí.
const J = [
  ['Oblak', 2, 1, 33, 8.2, 2322], ['Grimaldo', 2, 2, 61, 8.6, 3155], ['Marcos Llorente', 2, 2, 40, 6.2, 67], ['Álex Baena', 2, 3, 65, 8.0, 2534], ['Kang-In Lee', 2, 3, 50, 6.8, 3193], ['J. David', 2, 4, 45, 6.6, 3255], ['Julián Alvarez', 2, 4, 36, 5.9, 3088],
  ['Unai Simón', 3, 1, 27, 7.5, 68], ['Laporte', 3, 2, 24, 5.2, 3065], ['Paredes', 3, 2, 20, 5.6, 2315], ['Navarro', 3, 3, 18, 5.1, 2549], ['O. Sancet', 3, 3, 13, 4.4, 2318], ['Nico Williams', 3, 4, 30, 5.9, 3083], ['Iñaki Williams', 3, 4, 18, 5.5, 91],
  ['Joan García', 4, 1, 39, 7.4, 2634], ['Cubarsí', 4, 2, 44, 4.2, 1775], ['Xavi Espart', 4, 2, 35, 6.2, 2843], ['Fermín', 4, 3, 67, 8.5, 1715], ['Rodri', 4, 3, 60, 6.1, 3208], ['Lamine Yamal', 4, 4, 125, 10.0, 3104], ['Raphinha', 4, 4, 115, 10.0, 2522],
  ['Á. Valles', 5, 1, 37, 9.0, 2541], ['Natan', 5, 2, 34, 5.7, 2543], ['Fran García', 5, 2, 14, 2.8, 2429], ['Isco', 5, 3, 41, 6.1, 3090], ['Fornals', 5, 3, 27, 5.5, 3099], ['Ez Abde', 5, 4, 50, 6.1, 3089], ['Antony', 5, 4, 29, 4.7, 2770],
  ['Ionut Radu', 6, 1, 32, 8.8, 2713], ['Yoel Lago', 6, 2, 18, 6.0, 2206], ['Marcos Alonso', 6, 2, 16, 5.0, 3123], ['Ilaix Moriba', 6, 3, 21, 4.5, 2607], ['M. Román', 6, 3, 7, 7.1, 2639], ['Ferran Jutglà', 6, 4, 9, 4.2, 2603], ['B. Iglesias', 6, 4, 3, 2.0, 3071],
  ['M. Dituro', 7, 1, 9, 6.0, 2613], ['Revivo', 7, 2, 4, 5.8, 3263], ['V. Chust', 7, 2, 4, 4.1, 2596], ['Germán V.', 7, 3, 13, 4.7, 3074], ['G. Villar', 7, 3, 6, 4.1, 2939], ['Fer Niño', 7, 4, 32, 6.0, 3147], ['T. Morente', 7, 4, 3, 3.6, 2941],
  ['Dmitrovic', 8, 1, 14, 4.4, 2507], ['El Hilali', 8, 2, 10, 4.7, 1930], ['Cabrera', 8, 2, 7, 6.1, 3068], ['Edu Expósito', 8, 3, 25, 6.0, 3077], ['Javi Hernández', 8, 3, 15, 5.2, 3161], ['Roberto', 8, 4, 30, 5.2, 2520], ['Bryan', 8, 4, 9, 4.6, 3237],
  ['David Soria', 9, 1, 22, 6.4, 184], ['Zaid Romero', 9, 2, 15, 5.9, 2924], ['Djene', 9, 2, 12, 3.9, 2661], ['R. Terrats', 9, 3, 12, 5.3, 2511], ['Mangala', 9, 3, 3, 4.1, 3133], ['Satriano', 9, 4, 11, 5.9, 3137], ['Enes Ünal', 9, 4, 5, 3.5, 3154],
  ['Ryan', 11, 1, 13, 6.1, 2755], ['Dela', 11, 2, 9, 4.4, 2300], ['Mandi', 11, 2, 3, 3.0, 3174], ['Olasagasti', 11, 3, 4, 3.9, 2445], ['Bardeli', 11, 3, 3, 4.1, 3164], ['I. Romero', 11, 4, 5, 4.4, 2303], ['R. Brugué', 11, 4, 5, 5.9, 2302],
  ['A. Herrero', 12, 1, 11, 4.7, 3040], ['Rafita', 12, 2, 5, 3.7, 3041], ['Recio', 12, 2, 3, 3.4, 3054], ['Larrubia', 12, 3, 8, 2.9, 3072], ['Dani Lorenzo', 12, 3, 6, 3.9, 3036], ['Chupe', 12, 4, 6, 2.0, 3070], ['Niño', 12, 4, 1, 6.1, 3045],
  ['Sergio Herrera', 13, 1, 8, 2.2, 644], ['Catena', 13, 2, 15, 4.2, 1033], ['Boyomo', 13, 2, 5, 2.0, 1890], ['Rubén García', 13, 3, 9, 4.6, 652], ['Moncayola', 13, 3, 3, 2.9, 637], ['Budimir', 13, 4, 46, 7.2, 3084], ['Del Castillo', 13, 4, 2, 2.0, 3252],
  ['A. Batalla', 14, 1, 3, 6.5, 2519], ['Lejeune', 14, 2, 9, 2.5, 3082], ['Ratiu', 14, 2, 7, 4.0, 3081], ['Unai Lopez', 14, 3, 15, 5.5, 2384], ['Pathé I. Ciss', 14, 3, 9, 3.2, 2383], ['Camello', 14, 4, 34, 6.4, 2387], ['De Frutos', 14, 4, 8, 4.7, 886],
  ['Courtois', 15, 1, 34, 7.1, 230], ['Cucurella', 15, 2, 24, 3.8, 3106], ['Huijsen', 15, 2, 22, 4.9, 2530], ['Bellingham', 15, 3, 87, 10.0, 3101], ['Arda Güler', 15, 3, 81, 9.6, 1674], ['Mbappé', 15, 4, 119, 10.0, 3103], ['Diomande', 15, 4, 75, 6.6, 3143],
  ['Remiro', 16, 1, 15, 4.3, 274], ['Jon Martin', 16, 2, 15, 4.0, 2656], ['Sergio Gómez', 16, 2, 7, 2.9, 1989], ['C. Soler', 16, 3, 34, 5.7, 2772], ['Sucic', 16, 3, 20, 5.2, 2444], ['Oyarzabal', 16, 4, 37, 4.8, 3091], ['Guedes', 16, 4, 18, 4.8, 3085],
  ['Vlachodimos', 17, 1, 17, 5.7, 2759], ['Juan Iglesias', 17, 2, 15, 4.1, 1147], ['Kike Salas', 17, 2, 11, 5.8, 2479], ['Fofana', 17, 3, 26, 6.8, 3265], ['Agoumé', 17, 3, 14, 4.2, 2453], ['Miguel Sierra', 17, 4, 7, 6.1, 2746], ['Robbie Ure', 17, 4, 5, 2.9, 3145],
  ['Dimitrievski', 18, 1, 12, 5.9, 2457], ['Gayá', 18, 2, 4, 3.5, 302], ['De Haas', 18, 2, 3, 4.1, 3120], ['Pepelu', 18, 3, 25, 6.0, 2464], ['Javi Guerra', 18, 3, 16, 4.9, 3075], ['Danjuma', 18, 4, 3, 3.9, 2588], ['Hugo Duro', 18, 4, 2, 2.0, 1191],
  ['Gulácsi', 20, 1, 10, 4.2, 3130], ['Renato Veiga', 20, 2, 15, 3.5, 2728], ['Foyth', 20, 2, 8, 4.3, 2470], ['Moleiro', 20, 3, 59, 7.0, 3086], ['Gueye', 20, 3, 16, 4.5, 2473], ['Mikautadze', 20, 4, 26, 5.8, 2771], ['Ayoze', 20, 4, 21, 4.5, 2504],
  ['Sivera', 21, 1, 24, 6.7, 988], ['Koski', 21, 2, 30, 5.2, 2938], ['Tenaglia', 21, 2, 15, 4.0, 1337], ['Ángel Pérez', 21, 3, 25, 6.0, 2932], ['Ibañez', 21, 3, 15, 4.7, 2569], ['Lucas Boyé', 21, 4, 25, 5.0, 2768], ['Mariano', 21, 4, 11, 5.5, 2600],
  ['Leo Román', 26, 1, 15, 4.9, 3109], ['Giménez', 26, 2, 18, 3.7, 2324], ['Noubi', 26, 2, 4, 2.0, 2985], ['Mario Soriano', 26, 3, 28, 6.1, 2995], ['Amatucci', 26, 3, 5, 3.3, 3119], ['Aubameyang', 26, 4, 28, 9.3, 3108], ['Yeremay', 26, 4, 24, 5.2, 3076],
  ['Agirrezabala', 49, 1, 16, 5.3, 1219], ['Jorge Salinas', 49, 2, 2, 2.2, 3011], ['Pablo Ramón', 49, 2, 1, 2.7, 3026], ['Canales', 49, 3, 9, 3.5, 3125], ['Iván Martín', 49, 3, 3, 3.5, 3205], ['Y. Zabiri', 49, 4, 30, 6.0, 3152], ['Iñigo Vicente', 49, 4, 16, 4.8, 3002],
];
const RIVALES = [
  ['Unión Clausulera', 'Lucas'], ['Los Galácticos de Vallecas', 'Rubén'], ['Patatas Bravas FC', 'Sergio'], ['Real Sociedad Anónima', 'Javi'],
  ['Atlético Cuñados', 'Dani'], ['Sporting de Sofá', 'Álex'], ['Inter de Mesón', 'Pablo'], ['Rayo Vallekano', 'Iván'],
  ['Hércules del Henares', 'Marcos'], ['Deportivo La Caña', 'Adri'], ['Fantasmas FC', 'Hugo'], ['Club Clausulazo', 'Mario'],
];

/** los jugadores de la demo con su id de LaLiga, para casarlos con sus caras (caras-demo.js) */
export const jugadoresDemo = () => J.map(([nombre, eq, , , , lid], i) => ({ id: String(1000 + i), nombre, equipoId: String(eq), lid: String(lid) }));

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function demo() {
  const r = azar(20261020);
  const ahora = Date.now();
  const equipos = Object.fromEntries(Object.entries(EQUIPOS).map(([id, [n, c]]) => [id, { nombre: n, corto: c, escudo: null }]));
  const maestro = {};
  J.forEach(([nombre, eq, pos, v, media, lid], i) => {
    const id = String(1000 + i);
    const valor = Math.round((v * (0.92 + r() * 0.16)) * 1e6 / 1000) * 1000;
    const estado = r() < 0.05 ? 'injured' : r() < 0.05 ? 'doubtful' : 'ok';
    // (los puntos de cada jornada de la 1 a la 9, alrededor de su media: Equipo → Jornadas los lee de aquí)
    const semanas = Array.from({ length: 9 }, (_, w) => ({ n: w + 1, pts: Math.max(-2, Math.round(media + (r() - 0.5) * 2.4 * media)) }));
    maestro[id] = { id, nombre, largo: nombre, equipoId: String(eq), equipo: EQUIPOS[eq][0], pos, valor, puntos: semanas.reduce((t, x) => t + x.pts, 0), media, estado, img: null, lid: String(lid), temporadaPasada: Math.round(media * 34), semanas };
  });
  // un entrenador por equipo (también puntúa en LaLiga Fantasy)
  const ids = Object.keys(maestro).sort(() => r() - 0.5);
  const clasif = RIVALES.map(([nombre, manager], i) => ({ teamId: String(500 + i), nombre, manager, userId: String(900 + i), puntos: 0, valor: 0, puntosJornada: Math.round(30 + r() * 50), pos: 0, esYo: i === 0, avatar: null }));
  const plantillas = {};
  const cupo = { 1: 2, 2: 5, 3: 5, 4: 3 };
  const mios = [];
  for (const pid of ids) if (cupo[maestro[pid].pos] > 0) { cupo[maestro[pid].pos]--; mios.push(pid); }
  const resto = ids.filter((pid) => !mios.includes(pid));
  ids.length = 0; ids.push(...mios, ...resto);
  let k = 0;
  for (const e of clasif) {
    const n = e.esYo ? mios.length : 8 + Math.floor(r() * 4);
    plantillas[e.teamId] = ids.slice(k, k + n).map((pid) => {
      const j = maestro[pid];
      const prot = r();
      return {
        pid, ptId: 'pt' + pid,
        clausula: Math.round(j.valor * (1 + (r() < 0.35 ? r() * 0.12 : 0.2 + r() * 0.9)) / 1000) * 1000,
        protegidoHasta: prot < 0.45 ? null : prot < 0.62 ? ahora + (0.5 + r() * 30) * HORA : ahora + (1.5 + r() * 12) * DIA,
        compra: e.esYo ? Math.round(j.valor * (0.7 + r() * 0.45) / 1000) * 1000 : null,
      };
    });
    k += n;
    e.valor = plantillas[e.teamId].reduce((s, f) => s + maestro[f.pid].valor, 0);
    e.puntos = Math.round(plantillas[e.teamId].reduce((s, f) => s + maestro[f.pid].media, 0) * 9 * (0.7 + r() * 0.5));
  }
  [...clasif].sort((a, b) => b.puntos - a.puntos).forEach((e, i) => { e.pos = i + 1; });
  clasif.sort((a, b) => a.pos - b.pos);
  const yo = clasif.find((e) => e.esYo);

  const libres = ids.slice(k);
  const fin = ahora + (6 + r() * 10) * HORA;
  const mercado = libres.slice(0, 12).map((pid, i) => ({
    id: 'm' + i, pid, tipo: 'liga', precio: maestro[pid].valor, cierra: fin, pujas: Math.floor(r() * 4), ofertas: 0,
    vendedorTeamId: '', vendedor: '', miPuja: i === 2 ? Math.round(maestro[pid].valor * 1.05) : null, clausula: null,
  }));
  clasif.filter((e) => !e.esYo).slice(0, 3).forEach((e, i) => {
    const f = plantillas[e.teamId][i];
    mercado.push({ id: 'mm' + i, pid: f.pid, tipo: 'manager', precio: Math.round(maestro[f.pid].valor * (1.05 + r() * 0.3)), cierra: fin, pujas: Math.floor(r() * 2), ofertas: 0, vendedorTeamId: e.teamId, vendedor: e.manager, miPuja: null, clausula: f.clausula });
  });

  // dos de los tuyos en venta: uno con la oferta de LaLiga y la de un rival, otro sin ofertas
  const misF = plantillas[yo.teamId];
  const v1 = maestro[misF[3].pid], v2 = maestro[misF[9].pid];
  const misVentas = [
    { marketId: 'v1', pid: v1.id, ptId: 'pt' + v1.id, precio: Math.round(v1.valor * 1.1 / 1000) * 1000, cierra: fin, ofertas: [
      { id: 'o1', importe: Math.round(v1.valor * 1.04 / 1000) * 1000, estado: 'pending', caduca: fin, de: clasif[4].manager, deLiga: false, deTeamId: clasif[4].teamId },
      { id: 'o2', importe: Math.round(v1.valor * 0.98 / 1000) * 1000, estado: 'pending', caduca: fin, de: 'LaLiga', deLiga: true },
    ] },
    { marketId: 'v2', pid: v2.id, ptId: 'pt' + v2.id, precio: Math.round(v2.valor * 1.25 / 1000) * 1000, cierra: fin, ofertas: [] },
  ];
  for (const v of misVentas) mercado.push({ id: v.marketId, pid: v.pid, tipo: 'manager', precio: v.precio, cierra: fin, pujas: 0, ofertas: v.ofertas.length, vendedorTeamId: yo.teamId, vendedor: yo.manager, miPuja: null, clausula: null });

  const tendencias = {};
  for (const pid of Object.keys(maestro)) {
    const p1 = (r() - 0.45) * 6;
    tendencias[pid] = { d1: Math.round(maestro[pid].valor * p1 / 100), p1, d7: null, p7: null, ffValor: maestro[pid].valor };
  }

  // jornadas 9 a 15 (con un parón entre la 12 y la 13). La 10 empieza siempre el próximo sábado a las 14:00 (hora de
  // Madrid): con una fecha fija, la liga de ejemplo se quedaba vieja en una semana (jornada ya jugada, sin la siguiente)
  const base = proximoSabado(ahora);
  const ordenEq = Object.keys(EQUIPOS);
  const partidos = [];
  const fechasJ = { 9: base - 7 * DIA, 10: base, 11: base + 7 * DIA, 12: base + 14 * DIA, 13: base + 28 * DIA, 14: base + 35 * DIA, 15: base + 42 * DIA };
  for (const [n, f0] of Object.entries(fechasJ)) {
    const rot = (+n * 3) % ordenEq.length;
    const lista = [...ordenEq.slice(rot), ...ordenEq.slice(0, rot)];
    for (let i = 0; i < 10; i++) {
      const fecha = f0 + Math.floor(i / 3) * DIA + (i % 3) * 2.25 * HORA;
      // los que ya han empezado, con su marcador y su estado (7 acabado, 2 o 4 jugándose), como los da LaLiga: si no, la
      // jornada en juego salía con partidos de ayer «por jugar» (revisión del 25 oct)
      let gl = null, gv = null, st = null;
      if (fecha <= ahora) {
        const pasado = ahora - fecha;
        const g = () => Math.max(0, Math.round(0.4 + r() * 2.2 - 0.6));
        gl = g(); gv = g(); st = pasado > 2 * HORA ? 7 : pasado > HORA ? 4 : 2;
        if (st !== 7) { gl = Math.min(gl, 1); gv = Math.min(gv, 1); }
      }
      partidos.push({ id: `p${n}-${i}`, jornada: +n, fecha, localId: lista[i], visitanteId: lista[19 - i], local: EQUIPOS[lista[i]][0], visitante: EQUIPOS[lista[19 - i]][0], gl, gv, st, estado: st });
    }
  }

  // resultados de las jornadas 1 a 8, con equipos más fuertes que otros; los de la 9 son sus partidos ya acabados
  // (antes salía también una J9 inventada con otros cruces: Clubes y la ficha de un club no cuadraban con Directo)
  const fuerza = Object.fromEntries(ordenEq.map((id, i) => [id, 0.6 + ((i * 7) % 20) / 14]));
  fuerza['15'] = 2.1; fuerza['3'] = 2.2; fuerza['2'] = 1.7; fuerza['43'] = 0.5; fuerza['10'] = 0.6;
  const resultados = [];
  for (let n = 1; n <= 8; n++) {
    const rot = (n * 5) % ordenEq.length;
    const lista = [...ordenEq.slice(rot), ...ordenEq.slice(0, rot)];
    for (let i = 0; i < 10; i++) {
      const a = lista[i], b = lista[19 - i];
      const gol = (f) => Math.max(0, Math.round(f * (0.4 + r() * 1.3) - 0.3));
      resultados.push({ jornada: n, localId: a, visitanteId: b, gl: gol(fuerza[a] * 1.1), gv: gol(fuerza[b]) });
    }
  }
  for (const p of partidos) if (p.st === 7) resultados.push({ jornada: p.jornada, localId: p.localId, visitanteId: p.visitanteId, gl: p.gl, gv: p.gv });

  const actividad = [];
  const nombres = clasif.map((e) => e.manager);
  // (que cuadren con las plantillas: lo que uno fichó, clausuló o blindó es suyo ahora; lo que vendió a LaLiga está libre)
  const duenoDemo = {};
  for (const [tid, fs] of Object.entries(plantillas)) for (const f of fs) duenoDemo[f.pid] = tid;
  const libresDemo = ids.filter((pid) => !duenoDemo[pid]);
  for (let i = 0; i < 26; i++) {
    const quien = clasif[Math.floor(r() * clasif.length)];
    const tipo = [31, 31, 33, 32, 31, 4, 33][Math.floor(r() * 7)];
    const suyos = plantillas[quien.teamId] || [];
    const pid = tipo === 33 || !suyos.length ? libresDemo[Math.floor(r() * libresDemo.length)] : suyos[Math.floor(r() * suyos.length)].pid;
    // (nadie se clausula a sí mismo)
    const otros = clasif.filter((e) => e !== quien);
    const otro = tipo === 32 ? otros[Math.floor(r() * otros.length)] : null;
    actividad.push({
      id: 'a' + i, t: ahora - i * 5.3 * HORA - r() * 3 * HORA, tipo,
      clase: { 31: 'compra', 32: 'clausula', 33: 'venta', 4: 'blindaje' }[tipo],
      quien: quien.manager, quienId: quien.userId, otro: otro ? otro.manager : '', otroId: otro ? otro.userId : '',
      pid, jugador: maestro[pid].nombre, importe: Math.round(maestro[pid].valor * (1 + r() * 0.3)), texto: '',
    });
  }
  void nombres;
  // lo que cobra cada uno por las dos últimas jornadas (en el Fantasy sale como «ha ganado X por jornada»)
  clasif.forEach((e, i) => {
    for (const k of [1, 2]) actividad.push({ id: `pr${i}-${k}`, t: ahora - k * 7 * DIA + 2 * HORA, tipo: 6, clase: 'premio', quien: e.manager, quienId: e.userId, otro: '', otroId: '', pid: '', jugador: '', importe: Math.round((1.2 + r() * 2.5) * 1e6 / 1000) * 1000, texto: '' });
  });
  actividad.sort((a, b) => b.t - a.t);
  // el saldo de algunos rivales se sabe (en tu liga real depende de lo que dé LaLiga); el del resto se estima
  const dineros = { [yo.teamId]: { v: 6430000, fuente: 'tu cuenta' } };
  clasif.filter((e) => !e.esYo).slice(0, 4).forEach((e) => { dineros[e.teamId] = { v: Math.round((2 + r() * 22) * 1e6 / 10000) * 10000, fuente: 'ejemplo' }; });

  const D = {
    t: ahora, demo: true,
    yo: { userId: yo.userId, nombre: yo.manager, teamId: yo.teamId },
    liga: { id: 'demo', nombre: 'Liga de ejemplo' }, ligas: [{ id: 'demo', nombre: 'Liga de ejemplo' }],
    equipos, equiposT: ahora, clasif, plantillas, maestro, mercado, actividad,
    dinero: 6430000, dineros, valorEquipo: yo.valor, jornada: 10, partidos, resultados, tendencias, avisos: [], misVentas,
  };

  // un histórico de 21 días para que haya gráficos
  const H = { v: {}, eq: {}, yo: [], mov: [] };
  for (const j of Object.values(maestro)) {
    const s = []; let v = j.valor * (0.85 + r() * 0.25);
    for (let d = 21; d >= 1; d--) { s.push([diaDe(ahora - d * DIA), Math.round(v)]); v = v * (1 + (j.valor - v) / j.valor * 0.15 + (r() - 0.5) * 0.04); }
    H.v[j.id] = s;
  }
  for (const e of clasif) {
    const s = []; let v = e.valor * (0.9 + r() * 0.15), p = e.puntos * 0.7;
    for (let d = 21; d >= 1; d--) { s.push([diaDe(ahora - d * DIA), Math.round(v), Math.round(p), e.pos]); v *= 1 + (r() - 0.45) * 0.03; p += r() < 0.15 ? 40 + r() * 30 : 0; }
    H.eq[e.teamId] = s;
  }
  for (let d = 21; d >= 1; d--) H.yo.push([diaDe(ahora - d * DIA), 4e6 + r() * 5e6, yo.valor * (0.88 + (21 - d) * 0.006)]);
  // unos cuantos del mercado en racha (para que se vea lo de especular)
  mercado.filter((m) => m.tipo === 'liga').slice(3, 7).forEach((m, i) => {
    const sube = 0.022 + i * 0.006;
    const j = maestro[m.pid];
    H.v[m.pid] = Array.from({ length: 21 }, (_, k) => [diaDe(ahora - (21 - k) * DIA), Math.round(j.valor / Math.pow(1 + sube, 21 - k))]);
    tendencias[m.pid] = { d1: Math.round(j.valor * sube), p1: sube * 100, d7: null, p7: null, ffValor: j.valor };
    m.pujas = i % 2;
  });
  H.mov.push({ t: ahora - 9 * HORA, teamId: clasif[3].teamId, tipo: 'blinda', pid: plantillas[clasif[3].teamId][0].pid, de: 14e6, a: 21e6 });
  return { D, H };
}

/** el próximo sábado a las 14:00 en Madrid (si ya ha pasado la de esta semana, el de la siguiente) */
function proximoSabado(ahora) {
  for (let k = 0; k < 9; k++) {
    const t = ahora + k * 864e5;
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', timeZoneName: 'shortOffset' });
    const p = Object.fromEntries(f.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    if (p.weekday !== 'Sat') continue;
    const m = String(p.timeZoneName || '').match(/GMT([+-]\d+)(?::(\d+))?/);
    const off = m ? `${m[1].startsWith('-') ? '-' : '+'}${String(Math.abs(+m[1])).padStart(2, '0')}:${m[2] || '00'}` : '+01:00';
    const sab = Date.parse(`${p.year}-${p.month}-${p.day}T14:00:00${off}`);
    if (sab > ahora + 3600e3) return sab;
  }
  return ahora + 3 * 864e5;
}
