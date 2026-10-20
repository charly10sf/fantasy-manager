/* Una liga de ejemplo para ver la app sin entrar (y para probarla fuera del móvil). Los jugadores son de
   LaLiga, pero los valores, cláusulas, puntos y movimientos son inventados. */
import { DIA, HORA, diaDe } from './util.js';

const EQUIPOS = {
  15: ['Real Madrid', 'RMA'], 3: ['Barcelona', 'BAR'], 2: ['Atlético', 'ATM'], 1: ['Athletic', 'ATH'], 22: ['Villarreal', 'VIL'],
  4: ['Betis', 'BET'], 16: ['Real Sociedad', 'RSO'], 5: ['Celta', 'CEL'], 13: ['Osasuna', 'OSA'], 30: ['Girona', 'GIR'],
  14: ['Rayo', 'RAY'], 17: ['Sevilla', 'SEV'], 18: ['Valencia', 'VAL'], 12: ['Mallorca', 'MLL'], 7: ['Espanyol', 'ESP'],
  8: ['Getafe', 'GET'], 28: ['Alavés', 'ALA'], 21: ['Elche', 'ELC'], 10: ['Levante', 'LEV'], 43: ['Real Oviedo', 'OVI'],
};
// [nombre, equipo, posición, valor en M, media]
const J = [
  ['Courtois', 15, 1, 32, 6.1], ['Carvajal', 15, 2, 14, 4.2], ['Militão', 15, 2, 22, 4.8], ['Huijsen', 15, 2, 28, 5.6], ['Valverde', 15, 3, 54, 6.4], ['Bellingham', 15, 3, 78, 7.1], ['Güler', 15, 3, 36, 5.9], ['Vinícius', 15, 4, 82, 7.6], ['Mbappé', 15, 4, 120, 9.4], ['Rodrygo', 15, 4, 38, 4.9],
  ['Joan García', 3, 1, 30, 6.6], ['Koundé', 3, 2, 34, 5.8], ['Cubarsí', 3, 2, 31, 5.4], ['Balde', 3, 2, 22, 4.6], ['Pedri', 3, 3, 72, 7.4], ['De Jong', 3, 3, 30, 5.1], ['Fermín', 3, 3, 26, 5.8], ['Yamal', 3, 4, 118, 9.1], ['Raphinha', 3, 4, 74, 8.2], ['Lewandowski', 3, 4, 40, 6.3], ['Ferran', 3, 4, 18, 5.0],
  ['Oblak', 2, 1, 26, 5.9], ['Le Normand', 2, 2, 12, 4.4], ['Hancko', 2, 2, 14, 4.7], ['Llorente', 2, 2, 20, 5.5], ['Koke', 2, 3, 9, 4.1], ['Barrios', 2, 3, 22, 5.2], ['Baena', 2, 3, 30, 5.7], ['Álvarez', 2, 4, 64, 7.3], ['Sørloth', 2, 4, 30, 6.0], ['Griezmann', 2, 4, 24, 5.6],
  ['Unai Simón', 1, 1, 20, 5.6], ['Vivian', 1, 2, 10, 4.3], ['Yeray', 1, 2, 7, 3.9], ['Jauregizar', 1, 3, 14, 4.9], ['Sancet', 1, 3, 26, 6.2], ['N. Williams', 1, 4, 44, 6.4], ['I. Williams', 1, 4, 24, 5.4], ['Berenguer', 1, 4, 9, 4.2],
  ['Júnior R.', 22, 1, 12, 5.1], ['Mouriño', 22, 2, 9, 4.6], ['Pedraza', 22, 2, 7, 4.2], ['Parejo', 22, 3, 6, 4.4], ['Comesaña', 22, 3, 11, 4.8], ['Moleiro', 22, 3, 24, 6.0], ['Buchanan', 22, 4, 16, 5.0], ['Mikautadze', 22, 4, 21, 5.5], ['Moreno', 22, 4, 18, 5.3],
  ['Álex Remiro', 16, 1, 15, 5.4], ['Zubeldia', 16, 2, 11, 4.5], ['Aramburu', 16, 2, 9, 4.3], ['Zubimendi', 16, 3, 13, 4.6], ['Brais Méndez', 16, 3, 16, 5.3], ['Kubo', 16, 4, 28, 5.9], ['Oyarzabal', 16, 4, 32, 6.6], ['Barrenetxea', 16, 4, 14, 5.0],
  ['Isco', 4, 3, 18, 6.1], ['Fornals', 4, 3, 12, 5.0], ['Lo Celso', 4, 3, 14, 5.4], ['Antony', 4, 4, 26, 6.2], ['Bakambu', 4, 4, 6, 3.8], ['Bartra', 4, 2, 4, 3.6], ['Natan', 4, 2, 9, 4.4], ['Vallés', 4, 1, 6, 4.5],
  ['Radu', 5, 1, 6, 4.5], ['Mingueza', 5, 2, 10, 4.8], ['Javi Rodríguez', 5, 2, 8, 4.5], ['Ilaix', 5, 3, 10, 4.7], ['Iago Aspas', 5, 4, 12, 5.5], ['Borja Iglesias', 5, 4, 15, 5.7], ['Williot', 5, 4, 10, 4.9],
  ['Herrera', 13, 1, 9, 5.0], ['Catena', 13, 2, 8, 4.6], ['Bretones', 13, 2, 6, 4.1], ['Iker Muñoz', 13, 3, 8, 4.4], ['Moncayola', 13, 3, 9, 4.5], ['Aimar Oroz', 13, 3, 12, 5.0], ['Budimir', 13, 4, 22, 6.4], ['Rubén García', 13, 4, 7, 4.2],
  ['Gazzaniga', 30, 1, 8, 4.8], ['Arnau', 30, 2, 6, 4.0], ['Stuani', 30, 4, 5, 4.4], ['Tsygankov', 30, 4, 12, 4.9], ['Iván Martín', 30, 3, 9, 4.6], ['Abel Ruiz', 30, 4, 9, 4.3],
  ['Batalla', 14, 1, 8, 5.1], ['Ratiu', 14, 2, 9, 4.7], ['Lejeune', 14, 2, 7, 4.5], ['Isi', 14, 4, 14, 5.6], ['De Frutos', 14, 4, 12, 5.4], ['Álvaro García', 14, 4, 10, 5.0], ['Unai López', 14, 3, 6, 4.1],
  ['Nyland', 17, 1, 6, 4.4], ['Azpilicueta', 17, 2, 4, 3.8], ['Juanlu', 17, 2, 11, 4.9], ['Agoumé', 17, 3, 8, 4.3], ['Vargas', 17, 4, 12, 5.0], ['Isaac Romero', 17, 4, 10, 4.7],
  ['Dimitrievski', 18, 1, 6, 4.6], ['Gayà', 18, 2, 8, 4.3], ['Tárrega', 18, 2, 9, 4.4], ['Pepelu', 18, 3, 9, 4.5], ['Javi Guerra', 18, 3, 18, 5.4], ['Hugo Duro', 18, 4, 11, 5.0], ['Diego López', 18, 4, 14, 5.2],
  ['Leo Román', 12, 1, 5, 4.3], ['Maffeo', 12, 2, 7, 4.4], ['Valjent', 12, 2, 5, 4.0], ['Darder', 12, 3, 9, 4.6], ['Muriqi', 12, 4, 14, 5.5], ['Asano', 12, 4, 8, 4.4],
  ['Dmitrović', 7, 1, 7, 4.9], ['Romero', 7, 2, 6, 4.2], ['Expósito', 7, 3, 10, 5.0], ['Puado', 7, 4, 14, 5.6], ['Roberto Fernández', 7, 4, 8, 4.5],
  ['Soria', 8, 1, 6, 4.8], ['Djené', 8, 2, 6, 4.2], ['Arambarri', 8, 3, 6, 4.1], ['Uche', 8, 4, 5, 3.9], ['Mayoral', 8, 4, 7, 4.3],
  ['Sivera', 28, 1, 6, 4.7], ['Tenaglia', 28, 2, 5, 4.0], ['Guridi', 28, 3, 7, 4.3], ['Kike García', 28, 4, 8, 4.8], ['Carlos Vicente', 28, 4, 9, 4.9],
  ['Dituro', 21, 1, 4, 4.2], ['Affengruber', 21, 2, 7, 4.5], ['Febas', 21, 3, 6, 4.3], ['Rafa Mir', 21, 4, 9, 4.9], ['André Silva', 21, 4, 8, 4.6],
  ['Ryan', 10, 1, 4, 4.1], ['Elgezabal', 10, 2, 4, 3.9], ['Pablo Martínez', 10, 3, 6, 4.4], ['Etta Eyong', 10, 4, 11, 5.1], ['Morales', 10, 4, 7, 4.6],
  ['Escandell', 43, 1, 4, 4.3], ['Calvo', 43, 2, 4, 3.8], ['Colombatto', 43, 3, 5, 4.0], ['Rondón', 43, 4, 6, 4.4], ['Ilyas Chaira', 43, 4, 7, 4.6],
];
const RIVALES = [
  ['U.D. Carlista', 'Carlos'], ['Los Galácticos de Vallecas', 'Rubén'], ['Patatas Bravas FC', 'Sergio'], ['Real Sociedad Anónima', 'Javi'],
  ['Atlético Cuñados', 'Dani'], ['Sporting de Sofá', 'Álex'], ['Inter de Mesón', 'Pablo'], ['Rayo Vallekano', 'Iván'],
  ['Hércules del Henares', 'Marcos'], ['Deportivo La Caña', 'Adri'], ['Fantasmas FC', 'Hugo'], ['Club Clausulazo', 'Mario'],
];

function azar(semilla) {
  let s = semilla >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function demo() {
  const r = azar(20261020);
  const ahora = Date.now();
  const equipos = Object.fromEntries(Object.entries(EQUIPOS).map(([id, [n, c]]) => [id, { nombre: n, corto: c, escudo: null }]));
  const maestro = {};
  J.forEach(([nombre, eq, pos, v, media], i) => {
    const id = String(1000 + i);
    const valor = Math.round((v * (0.92 + r() * 0.16)) * 1e6 / 1000) * 1000;
    const estado = r() < 0.05 ? 'injured' : r() < 0.05 ? 'doubtful' : 'ok';
    maestro[id] = { id, nombre, largo: nombre, equipoId: String(eq), equipo: EQUIPOS[eq][0], pos, valor, puntos: Math.round(media * 9 * (0.8 + r() * 0.4)), media, estado, img: null, temporadaPasada: Math.round(media * 34) };
  });
  // un entrenador por equipo (también puntúa en LaLiga Fantasy)
  const ids = Object.keys(maestro).sort(() => r() - 0.5);
  const clasif = RIVALES.map(([nombre, manager], i) => ({ teamId: String(500 + i), nombre, manager, userId: String(900 + i), puntos: 0, valor: 0, puntosJornada: Math.round(30 + r() * 50), pos: 0, esYo: i === 0, avatar: null }));
  const plantillas = {};
  let k = 0;
  for (const e of clasif) {
    const n = e.esYo ? 15 : 8 + Math.floor(r() * 4);
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

  // jornadas 10 a 13 (con el parón de noviembre entre la 12 y la 13)
  const base = Date.parse('2026-10-24T14:00:00+02:00');
  const ordenEq = Object.keys(EQUIPOS);
  const partidos = [];
  const fechasJ = { 9: base - 7 * DIA, 10: base, 11: base + 7 * DIA, 12: base + 14 * DIA, 13: base + 28 * DIA };
  for (const [n, f0] of Object.entries(fechasJ)) {
    const rot = (+n * 3) % ordenEq.length;
    const lista = [...ordenEq.slice(rot), ...ordenEq.slice(0, rot)];
    for (let i = 0; i < 10; i++) {
      const fecha = f0 + Math.floor(i / 3) * DIA + (i % 3) * 2.25 * HORA;
      partidos.push({ id: `p${n}-${i}`, jornada: +n, fecha, localId: lista[i], visitanteId: lista[19 - i], local: EQUIPOS[lista[i]][0], visitante: EQUIPOS[lista[19 - i]][0], gl: null, gv: null, estado: null });
    }
  }

  const actividad = [];
  const nombres = clasif.map((e) => e.manager);
  for (let i = 0; i < 26; i++) {
    const quien = clasif[Math.floor(r() * clasif.length)];
    const pid = ids[Math.floor(r() * ids.length)];
    const tipo = [31, 31, 33, 32, 31, 4, 33][Math.floor(r() * 7)];
    const otro = tipo === 32 ? clasif[Math.floor(r() * clasif.length)] : null;
    actividad.push({
      id: 'a' + i, t: ahora - i * 5.3 * HORA - r() * 3 * HORA, tipo,
      clase: { 31: 'compra', 32: 'clausula', 33: 'venta', 4: 'blindaje' }[tipo],
      quien: quien.manager, quienId: quien.userId, otro: otro ? otro.manager : '', otroId: otro ? otro.userId : '',
      pid, jugador: maestro[pid].nombre, importe: Math.round(maestro[pid].valor * (1 + r() * 0.3)), texto: '',
    });
  }
  void nombres;

  const D = {
    t: ahora, demo: true,
    yo: { userId: yo.userId, nombre: yo.manager, teamId: yo.teamId },
    liga: { id: 'demo', nombre: 'Liga de ejemplo' }, ligas: [{ id: 'demo', nombre: 'Liga de ejemplo' }],
    equipos, equiposT: ahora, clasif, plantillas, maestro, mercado, actividad,
    dinero: 6430000, valorEquipo: yo.valor, jornada: 10, partidos, tendencias, avisos: [], misVentas,
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
  H.mov.push({ t: ahora - 9 * HORA, teamId: clasif[3].teamId, tipo: 'blinda', pid: plantillas[clasif[3].teamId][0].pid, de: 14e6, a: 21e6 });
  return { D, H };
}
