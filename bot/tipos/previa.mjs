// Previa de cada partido (Carlos, 2 nov 23:28): «posibles onces» con el % de titularidad de la app (desde 36 h antes del partido, de 9
// a 23 h) y «onces confirmados» en cuanto ESPN publica las alineaciones (suelen salir ~1 h antes). Cada uno lleva su tarjeta con los
// dos onces. En el confirmado se cuentan las sorpresas: titulares habituales que se quedan fuera y los que entran sin esperarlo.
import { json } from '../lib/http.mjs';
import { statsSemana } from '../lib/laliga.mjs';
import { corto, elegir, el, del, fmt, partes, largo, hash } from '../lib/texto.mjs';
import { lista, mayus } from '../lib/agrupar.mjs';
import { tweet, enPalabras, cuando, aparte, cap } from '../lib/redactar.mjs';
import { ESPN, partidoEspn } from '../lib/relato.mjs';
import { casarJugador } from './directo.mjs';
import { probabilidades, elegirOnce } from '../lib/onces.mjs';
import { enElAire } from '../lib/aire.mjs';

const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)).replace(/-/g, '');
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const POS_ESPN = (a) => (/^G/.test(a) ? 'POR' : /^(CD|LB|RB|D|CB|LWB|RWB|SW)/.test(a) ? 'DEF' : /^(F|CF|ST|LF|RF|LW|RW)/.test(a) ? 'DEL' : 'MED');
const ORDEN = { POR: 0, DEF: 1, MED: 2, DEL: 3 };
const pct = (p) => Math.round(p * 100);

export async function generar({ semana, jugadores, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), log = console.log, probarAcabados = false }) {
  const out = [];
  const jornadas = [...new Set([semana.weekNumber, semana.nextWeek].filter(Boolean))];
  const [hD, hH] = config.horasPrevia || [9, 23];
  const enHora = !ventanas || forzar || (horaMadrid(ahora) >= hD && horaMadrid(ahora) < hH);
  for (const jornada of jornadas) {
    const stats = await statsSemana(jornada).catch(() => []);
    // probarAcabados (solo pruebas, --previa-acabados=1): trata los partidos ya jugados como si fueran a empezar, para ver los onces de ESPN
    for (const m of stats.filter((x) => x.matchState === 1 || (probarAcabados && x.matchState === 7))) {
      const saque = Date.parse(m.date);
      const falta = saque - ahora;
      const quiereConf = !ventanas || forzar ? true : falta > 0 && falta < 3 * 3600e3;
      const quierePos = !ventanas || forzar ? true : enHora && falta > 3 * 3600e3 && falta < 36 * 3600e3;
      const yaConf = registro && registro.claves.has(`onces|${m.id}`), yaPos = registro && registro.claves.has(`previa|${m.id}`);
      if (!(quiereConf && !yaConf) && !(quierePos && !yaPos)) continue;
      const L = corto(m.local.mainName), V = corto(m.visitor.mainName);
      // si se estudia suspender o aplazar la jornada o el partido (o ya se ha decidido y aún no hay fecha nueva), la previa espera
      const aire = enElAire(registro, { jornada, m, ahora });
      if (aire.espera) { log(`  (previa) ${L}-${V}: ${aire.motivo}`); continue; }
      const sem = `previa${m.id}`;
      // las alineaciones de ESPN, primero: si aún no están y no toca la previa, no se piden las fichas de nadie
      let rl = null, rv = null;
      const tit = (r) => (r && r.roster ? r.roster.filter((x) => x.starter) : []);
      if (quiereConf && !yaConf) {
        const e = await partidoEspn(m, diaMadrid(saque)).catch(() => null);
        const sum = e ? await json(`${ESPN}/summary?event=${e.ev.id}`).catch(() => null) : null;
        const ros = sum && sum.rosters ? sum.rosters : [];
        rl = ros.find((r) => r.homeAway === 'home'); rv = ros.find((r) => r.homeAway === 'away');
      }
      const hayConf = tit(rl).length === 11 && tit(rv).length === 11;
      if (!hayConf && !(quierePos && !yaPos)) { if (quiereConf && !yaConf) log(`  (previa) ${L}-${V}: ESPN aún no tiene las alineaciones`); continue; }
      const conOnce = config.onceProbable !== false;
      const probs = { L: await probabilidades(m.local.id, jugadores, jornada - 1, { equipo: m.local.mainName, conOnce, log }), V: await probabilidades(m.visitor.id, jugadores, jornada - 1, { equipo: m.visitor.mainName, conOnce, log }) };
      const pos = { L: elegirOnce(probs.L), V: elegirOnce(probs.V) };
      if (!pos.L || !pos.V) { log(`  (previa) ${L}-${V}: sin datos para el once`); continue; }
      // --- onces confirmados (ESPN) ---
      if (hayConf) {
          const conf = {};
          const palabras = [];
          for (const [k, r, eqId] of [['L', rl, m.local.id], ['V', rv, m.visitor.id]]) {
            const plantilla = { players: jugadores.filter((j) => String(j.teamId) === String(eqId) && Number(j.positionId) >= 1 && Number(j.positionId) <= 4).map((j) => ({ ...j, name: j.nickname })) };
            const once = tit(r).map((x) => {
              const nom = x.athlete && x.athlete.displayName;
              const p = casarJugador(nom, plantilla);
              palabras.push(nom);
              return { id: p ? p.id : null, nombre: p ? p.nickname : nom, pos: (p && ({ 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' })[p.positionId]) || POS_ESPN((x.position && x.position.abbreviation) || ''), pct: null, duda: false };
            }).sort((a, b) => ORDEN[a.pos] - ORDEN[b.pos]);
            const dentro = new Set(once.map((x) => String(x.id)));
            // si alguno de los 11 de ESPN no casa con LaLiga, no se dice quién se queda fuera (podría ser ese mismo con otro nombre)
            const todosCasan = once.every((x) => x.id);
            const fuera = todosCasan ? Object.values(probs[k]).filter((x) => x.p >= 0.7 && !dentro.has(String(x.id))).sort((a, b) => b.p - a.p) : [];
            // sorpresa: menos del 25 % (con el 40 % salían titulares de siempre, como Julián Alvarez, porque el % solo lleva minutos de LaLiga)
            const sorpresa = once.filter((x) => x.id && probs[k][x.id] && probs[k][x.id].p < 0.25);
            // la formación, contada con las posiciones de LaLiga de la lista (la de ESPN, «4-2-3-1», no cuadraba con las filas)
            const cuenta = (q) => once.filter((x) => x.pos === q).length;
            conf[k] = { once, formacion: `${cuenta('DEF')}-${cuenta('MED')}-${cuenta('DEL')}`, fuera, sorpresa };
          }
          // como los cuenta @JoseCarrasco_98 (guía de estilo del 3 nov): el partido arriba y una línea por cada sorpresa
          const cab = `ℹ️ Onces confirmados del ${L}-${V}`;
          const ideas = [];
          const nombres = (xs) => { const n = xs.slice(0, largo() ? 5 : 3).map((x) => x.nombre); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0]; };
          for (const [k, eq] of [['L', L], ['V', V]]) {
            const c = conf[k];
            if (c.fuera.length) ideas.push({ t: `❌ ${nombres(c.fuera)} ${c.fuera.length > 1 ? 'se quedan' : 'se queda'} fuera del once en ${el(eq)}`, prio: 9 });
            if (c.sorpresa.length) ideas.push({ t: `‼️ ${nombres(c.sorpresa)} ${c.sorpresa.length > 1 ? 'son titulares' : 'es titular'} en ${el(eq)}`, prio: 8 });
          }
          if (!ideas.length) ideas.push(elegir(['✅ Sin sorpresas: salen los onces que se esperaban', '✅ Ni un cambio raro en los dos onces'], sem));
          // con tweets largos (X Premium): con qué dibujo sale cada uno y cuándo empieza
          const numConf = [];
          if (largo()) {
            const c = cuando(m.date, ahora);
            ideas.push({ t: `📋 ${mayus(el(L))} sale con ${conf.L.formacion} y ${el(V)} con ${conf.V.formacion}${c ? `. Empieza ${c.t}` : ''}`, prio: 2 });
            numConf.push(...(conf.L.formacion.match(/\d/g) || []), ...(conf.V.formacion.match(/\d/g) || []), ...(c ? c.numeros : []));
          }
          ideas.push({ t: '👀 Revisa tu once fantasy antes del pitido', prio: 7 });
          const { usadas, texto } = tweet(cab, ideas);
          const fm = (f) => (f || '').match(/\d/g) || [];
          out.push({ tipo: 'onces', clave: `onces|${m.id}`, jornada, texto, numeros: numConf.map(Number), partido: null,
            tarjeta: { tipo: 'onces', nombre: `onces-${m.id}`,
              d: { jornada, confirmados: true, local: { nombre: m.local.mainName, corto: L, escudoUrl: m.local.badgeColor, formacion: conf.L.formacion, once: conf.L.once }, visitante: { nombre: m.visitor.mainName, corto: V, escudoUrl: m.visitor.badgeColor, formacion: conf.V.formacion, once: conf.V.once } },
              permitidos: { numeros: [jornada, ...fm(conf.L.formacion), ...fm(conf.V.formacion)].map(String), palabras: [L, V, m.local.mainName, m.visitor.mainName, ...conf.L.once.map((x) => x.nombre), ...conf.V.once.map((x) => x.nombre), ...palabras] } } });
          if (usadas.length) continue;
      }
      // --- posibles onces ---
      if (!(quierePos && !yaPos)) continue;
      // en los puestos con más duda (menos del 60 %), también el otro que se lo puede jugar, con su % (Carlos, 3 nov 11:52: «como
      // dos opciones y poner el porcentaje de cada uno»): el mejor del mismo puesto que no está en el once y tiene 25 % o más,
      // hasta 3 por equipo
      const lado = (k, mm) => {
        const once = pos[k].once.map((x) => ({ id: x.id, nombre: x.nombre, pos: x.pos, pct: pct(x.p), duda: x.duda, p: x.p }));
        const fuera = new Set(once.map((x) => String(x.id)));
        for (const x of [...once].filter((y) => y.p < 0.6).sort((a, b) => a.p - b.p).slice(0, 3)) {
          const alt = Object.values(probs[k]).filter((y) => y.pos === x.pos && !fuera.has(String(y.id)) && y.p >= 0.25 && y.estado !== 'injured' && y.estado !== 'suspended')
            .sort((a, b) => b.p - a.p)[0];
          if (!alt) continue;
          fuera.add(String(alt.id));
          // arriba, el de más % (el titular de la web puede quedar por debajo del otro con los minutos de LaLiga)
          if (alt.p > x.p) { const yo = { id: x.id, nombre: x.nombre, pct: x.pct, duda: x.duda }; Object.assign(x, { id: alt.id, nombre: alt.nombre, pct: pct(alt.p), duda: alt.duda, p: alt.p }); x.alt = yo; }
          else x.alt = { id: alt.id, nombre: alt.nombre, pct: pct(alt.p), duda: alt.duda };
        }
        return { nombre: mm.mainName, corto: corto(mm.mainName), escudoUrl: mm.badgeColor, formacion: pos[k].formacion, once: once.map(({ p, ...x }) => x) };
      };
      const d = { jornada, confirmados: false, local: lado('L', m.local), visitante: lado('V', m.visitor) };
      // el texto: las dudas del once (titulares con menos del 65 %) y las bajas de titulares habituales
      const dudas = [...pos.L.once.map((x) => ({ ...x, eq: L })), ...pos.V.once.map((x) => ({ ...x, eq: V }))].filter((x) => x.p < 0.65 && x.p >= 0.1).sort((a, b) => a.p - b.p).slice(0, 3);
      const bajas = [...Object.values(probs.L).map((x) => ({ ...x, eq: L })), ...Object.values(probs.V).map((x) => ({ ...x, eq: V }))].filter((x) => (x.estado === 'injured' || x.estado === 'suspended')).slice(0, 4);
      // el texto, con frases y no en lista (Carlos, 3 nov 19:29, «sigue aquí»; antes «⁉️ Youssef (Alavés), en el aire: 33 %» una línea
      // por jugador): las dudas agrupadas por equipo y tramo con el % al lado, y las bajas de cada equipo en su línea
      const cab = elegir([`🗓️ ${L}-${V}: posibles onces fantasy para la jornada ${jornada}`,
        `🗓️ Así pueden salir ${el(L)} y ${el(V)} en la jornada ${jornada} de LaLiga Fantasy`], sem);
      const ideas = [];
      const num = [jornada];
      const tramos = new Map();
      for (const x of dudas) { const k = `${x.eq}|${enPalabras(x.p)}`; if (!tramos.has(k)) tramos.set(k, []); tramos.get(k).push(x); }
      let prio = 9.5;
      for (const xs of tramos.values()) {
        const varios = xs.length > 1, eq = el(xs[0].eq), p = xs[0].p;
        const quien = lista(xs.map((x) => x.nombre));
        const ps = xs.map((x) => String(pct(x.p)));
        const pcts = `(${new Set(ps).size === 1 ? ps[0] : lista(ps)} %)`;
        const frase = p >= 0.45 ? `${quien} ${varios ? 'apuntan' : 'apunta'} a titular en ${eq}, pero no ${varios ? 'son fijos' : 'es fijo'}`
          : p >= 0.25 ? `${quien} ${varios ? 'tienen' : 'tiene'} el puesto en el aire en ${eq}`
            : `${quien} lo ${varios ? 'tienen' : 'tiene'} complicado para salir de inicio en ${eq}`;
        // la primera duda, lo primero; las bajas, antes que el resto de dudas (en la prueba del 3 nov se quedaban fuera por largo)
        ideas.push({ t: `⁉️ ${frase} ${pcts}`, prio: prio });
        prio = prio === 9.5 ? 8.5 : prio - 0.1;
        num.push(...xs.map((x) => pct(x.p)));
      }
      if (bajas.length) {
        for (const eq of [L, V]) {
          const xs = bajas.filter((x) => x.eq === eq).map((x) => x.nombre);
          if (!xs.length) continue;
          const nombres = xs.length > 1 ? `${xs.slice(0, -1).join(', ')} ni ${xs[xs.length - 1]}` : xs[0];
          ideas.push({ t: `❌ ${mayus(el(eq))} no podrá contar con ${nombres}`, prio: 9 - (eq === V ? 0.1 : 0) });
        }
      }
      if (!dudas.length && !bajas.length) ideas.push({ t: '✅ Sin dudas ni bajas entre los habituales', prio: 8 });
      ideas.push({ t: elegir(['📊 Los % de titularidad son de Fantasy Manager', '📊 % de titularidad de Fantasy Manager, con los minutos y el estado de cada uno'], sem), prio: 5 });
      // con tweets largos (X Premium), un párrafo por equipo (lib/redactar.mjs, `aparte`): sus dudas, sus bajas y el fijo que más da
      const r = largo() ? previaLarga({ L, V, m, pos, probs, jugadores, jornada, ahora, sem }) : null;
      const { usadas, texto } = r ? tweet(r.cab, r.ideas) : tweet(cab, ideas);
      if (r) num.push(...r.num);
      if (!usadas.length) continue;
      const fm = (f) => f.match(/\d/g);
      out.push({ tipo: 'previa', clave: `previa|${m.id}`, jornada, texto, numeros: num, partido: null,
        tarjeta: { tipo: 'onces', nombre: `previa-${m.id}`, d,
          permitidos: { numeros: [jornada, ...fm(d.local.formacion), ...fm(d.visitante.formacion), ...[...d.local.once, ...d.visitante.once].flatMap((x) => [x.pct, x.alt ? x.alt.pct : null]).filter((x) => x != null)].map(String),
            palabras: [L, V, m.local.mainName, m.visitor.mainName, ...[...d.local.once, ...d.visitante.once].flatMap((x) => [x.nombre, x.alt ? x.alt.nombre : null]).filter(Boolean)] } } });
    }
  }
  return out;
}

/**
 * La previa en un tweet largo (X Premium). Carlos, 4 nov 23:39: el primer intento («En el Valencia, … No estarán … El que más puntos
 * da …» y el mismo párrafo para el Madrid con otros nombres) «es muy robótico»: no puede notarse que es automático. Así que se
 * escribe como lo haría una persona que lo ha mirado:
 *   - arriba, lo más llamativo del partido (una baja gorda, un fijo de mucha media o un equipo lleno de dudas), con su contraste
 *     en la misma frase («llega sin Vini Jr., sancionado, pero con Mbappé como fijo…»);
 *   - el segundo equipo, más corto y con otra forma (no el mismo esqueleto con otros nombres);
 *   - se escoge: 3 bajas y 3 dudas como mucho por equipo, las dudas en un rango («entre el 51 y el 58 %») y, si son del mismo puesto,
 *     dónde están («en el centro del campo»).
 * Solo con datos de la app (los %) y de LaLiga; cada cifra va a `num` para el validador.
 */
export function previaLarga({ L, V, m, pos, probs, jugadores, jornada, ahora = Date.now(), sem = '' }) {
  const media = new Map(jugadores.map((j) => [String(j.id), Number(j.averagePoints) || 0]));
  const med = (x) => media.get(String(x.id)) || 0;
  const num = [jornada];
  const h = hash(sem);
  const pick = (xs, k = 0) => xs[(h + k) % xs.length];
  const cu = cuando(m.date, ahora);
  if (cu) num.push(...cu.numeros);
  const datos = (k, eq) => ({
    k, eq,
    dudas: pos[k].once.filter((x) => x.p < 0.65 && x.p >= 0.1).sort((a, b) => a.p - b.p).slice(0, 3),
    bajas: Object.values(probs[k]).filter((x) => x.estado === 'injured' || x.estado === 'suspended').sort((a, b) => med(b) - med(a)).slice(0, 3),
    fijo: pos[k].once.filter((x) => x.p >= 0.8 && med(x) >= 4).sort((a, b) => med(b) - med(a))[0] || null,
  });
  const eqs = [datos('L', L), datos('V', V)];
  const cands = [];
  for (const d of eqs) {
    if (d.bajas[0] && med(d.bajas[0]) >= 5) cands.push({ d, que: 'baja', x: d.bajas[0], peso: med(d.bajas[0]) + 1 });
    if (d.fijo && med(d.fijo) >= 7) cands.push({ d, que: 'fijo', x: d.fijo, peso: med(d.fijo) });
    if (d.dudas.length >= 3) cands.push({ d, que: 'dudas', x: null, peso: 5.5 });
  }
  const lead = cands.sort((a, b) => b.peso - a.peso)[0] || null;
  const [A, B] = lead && lead.d === eqs[1] ? [eqs[1], eqs[0]] : eqs;
  const P = (x) => { const v = pct(x.p); num.push(v); return v; };
  const M = (x) => { num.push(...partes(med(x))); return fmt(med(x)); };
  const pl = (n, uno, varios) => (n > 1 ? varios : uno);

  // «Vini Jr., sancionado, ni Rodrygo y Asencio, lesionados» (para «llega sin…») o con «y» (para «le faltan…»)
  const bajasDe = (xs, une = 'ni') => {
    const les = xs.filter((x) => x.estado === 'injured').map((x) => x.nombre), san = xs.filter((x) => x.estado === 'suspended').map((x) => x.nombre);
    const g = [...(san.length ? [`${lista(san)}, ${pl(san.length, 'sancionado', 'sancionados')}`] : []), ...(les.length ? [`${lista(les)}, ${pl(les.length, 'lesionado', 'lesionados')}`] : [])];
    return g.length > 1 ? `${g[0]}, ${une} ${g[1]}` : g[0] || '';
  };
  // las dudas: «Sadiq (38 %) y Mayol (45 %)» o, con tres, «Bernardo Silva, Arda Güler y Tchouaméni, entre el 51 y el 58 %»
  const ZONA = { POR: 'en la portería', DEF: 'en defensa', MED: 'en el centro del campo', DEL: 'arriba' };
  const zona = (xs) => (xs.length > 1 && xs.every((x) => x.pos === xs[0].pos) ? ZONA[xs[0].pos] : null);
  // (sigue = va un verbo detrás: con tres, el rango lleva coma de cierre)
  const rango = (xs, sigue = false) => {
    const ps = xs.map(P);
    if (xs.length <= 2) return new Set(ps).size === 1 && xs.length === 2 ? `${lista(xs.map((x) => x.nombre))} (${ps[0]} %)` : lista(xs.map((x, i) => `${x.nombre} (${ps[i]} %)`));
    const a = Math.min(...ps), b = Math.max(...ps);
    return `${lista(xs.map((x) => x.nombre))}, ${a === b ? `al ${a} %` : `entre el ${a} y el ${b} %`}${sigue ? ',' : ''}`;
  };
  const verboDudas = (xs) => (xs.every((x) => x.p < 0.45) ? pl(xs.length, 'se juega el puesto', 'se juegan el puesto')
    : xs.every((x) => x.p >= 0.45) ? pl(xs.length, 'apunta a titular, pero sin garantías', 'apuntan a titular, pero sin garantías')
      : pl(xs.length, 'no tiene el sitio asegurado', 'no tienen el sitio asegurado'));

  // el primer equipo: el titular con su contraste, y sus dudas
  const fa = [];
  let usadoFijo = false;
  if (lead && lead.que === 'baja') {
    const x = lead.x, otras = A.bajas.filter((y) => y !== x), san = x.estado === 'suspended';
    if (h % 2 === 0) {
      fa.push(`${mayus(el(A.eq))} llega sin ${bajasDe([x, ...otras], 'ni')}${A.fijo ? `, pero con ${A.fijo.nombre} como fijo: ${P(A.fijo)} % y ${M(A.fijo)} de media` : ''}`);
      usadoFijo = !!A.fijo;
    } else {
      fa.push(`La baja que más se va a notar en ${el(A.eq)} es la de ${x.nombre}, ${san ? 'sancionado' : 'lesionado'}: ${M(x)} puntos de media`);
      if (otras.length) fa.push(`Tampoco ${pl(otras.length, 'estará', 'estarán')} ${bajasDe(otras)}`);
    }
  } else if (lead && lead.que === 'fijo') {
    const F = lead.x;
    fa.push(h % 2 === 0
      ? `${F.nombre} es fijo en ${el(A.eq)}: ${P(F)} % y ${M(F)} puntos de media${A.bajas.length ? `, aunque al equipo le ${pl(A.bajas.length, 'falta', 'faltan')} ${bajasDe(A.bajas, 'y')}` : ''}`
      : `En ${el(A.eq)} hay una fija: ${F.nombre}, con ${M(F)} de media y un ${P(F)} % de titularidad${A.bajas.length ? `. No ${pl(A.bajas.length, 'estará', 'estarán')} ${bajasDe(A.bajas)}` : ''}`);
    usadoFijo = true;
  } else if (lead && lead.que === 'dudas') {
    fa.push(`${mayus(el(A.eq))} llega con el once muy abierto${A.bajas.length ? `, y sin ${bajasDe(A.bajas, 'ni')}` : ''}`);
  } else {
    // sin nada llamativo: el local, con lo que tenga
    fa.push(A.bajas.length ? `${mayus(el(A.eq))} no podrá contar con ${bajasDe(A.bajas)}` : `${mayus(el(A.eq))} llega sin bajas entre los habituales`);
  }
  if (A.dudas.length) {
    const z = zona(A.dudas);
    fa.push(z ? `Las dudas están ${z}: ${rango(A.dudas)}` : `${cap(rango(A.dudas, true))} ${verboDudas(A.dudas)}`);
  }
  if (A.fijo && !usadoFijo && !(lead && lead.que === 'fijo')) fa.push(pick([`Lo más seguro es ${A.fijo.nombre}, al ${P(A.fijo)} %`, `Con ${A.fijo.nombre} se puede contar: ${P(A.fijo)} % y ${M(A.fijo)} de media`]));

  // el segundo, más corto y con otra forma
  // (el orden de sus frases y la forma de cada una cambian de un partido a otro: que diez previas no se lean igual)
  // el equipo se nombra solo en la primera frase (nada de «El Valencia no tendrá a… El Valencia tiene sus dudas…»)
  const bD = (conEq) => {
    const z = zona(B.dudas), n = B.dudas.length;
    if (!n) return conEq ? pick([`En ${el(B.eq)}, el once está bastante claro`, `${mayus(el(B.eq))} no tiene dudas entre los que suelen jugar`, `Lo ${del(B.eq)} está más claro`], 1)
      : pick(['No hay dudas entre los que suelen jugar', 'El once, bastante claro'], 1);
    if (!conEq) return z ? `Las dudas están ${z}: ${rango(B.dudas)}` : pick([`${cap(rango(B.dudas, true))} ${verboDudas(B.dudas)}`, `Hay dudas con ${rango(B.dudas)}`], 1);
    return pick([
      `En ${el(B.eq)} hay ${n > 1 ? 'más incógnitas' : 'una duda'}${z ? ` ${z}` : ''}: ${rango(B.dudas, true)} ${verboDudas(B.dudas)}`,
      `${mayus(el(B.eq))} tiene sus dudas${z ? ` ${z}` : ''}: ${rango(B.dudas, true)} ${verboDudas(B.dudas)}`,
      `Más dudas en ${el(B.eq)}${z ? `, ${z}` : ''}: ${rango(B.dudas, true)} ${verboDudas(B.dudas)}`,
      `En ${el(B.eq)}, ${rango(B.dudas, true)} ${verboDudas(B.dudas)}`,
    ], 1);
  };
  const bB = (conEq) => (!B.bajas.length ? '' : conEq ? `${mayus(el(B.eq))} no tendrá a ${bajasDe(B.bajas)}`
    : pick([`${pl(B.bajas.length, 'Le falta', 'Le faltan')} ${bajasDe(B.bajas, 'y')}`, `No ${pl(B.bajas.length, 'estará', 'estarán')} ${bajasDe(B.bajas)}`,
      `Se ${pl(B.bajas.length, 'pierde', 'pierden')} el partido ${bajasDe(B.bajas, 'y')}`], 2));
  const bF = () => (B.fijo ? pick([`${B.fijo.nombre}, al ${P(B.fijo)} %, es lo más seguro`, `Lo fijo es ${B.fijo.nombre}: ${P(B.fijo)} % y ${M(B.fijo)} de media`,
    `Donde no hay duda es con ${B.fijo.nombre}, al ${P(B.fijo)} %`, `${B.fijo.nombre} sale seguro: ${P(B.fijo)} % y ${M(B.fijo)} puntos de media`], 3) : '');
  // el orden de sus frases y la forma de cada una cambian de un partido a otro (que diez previas no se lean igual)
  const ordenB = B.bajas.length ? pick([['d', 'b', 'f'], ['d', 'f', 'b'], ['b', 'd', 'f']], 4) : ['d', 'f'];
  const fb = ordenB.map((q, i) => (q === 'd' ? bD(i === 0) : q === 'b' ? bB(i === 0) : bF())).filter(Boolean);

  const cab = cu ? pick([`🗓️ ${L}-${V}, ${cu.t}: posibles onces fantasy para la jornada ${jornada}`,
    `🗓️ ${cap(cu.t)} juegan ${el(L)} y ${el(V)}: posibles onces fantasy de la jornada ${jornada}`,
    `🗓️ Jornada ${jornada} de LaLiga Fantasy: ${L}-${V}, ${cu.t}`])
    : `🗓️ ${L}-${V}: posibles onces fantasy para la jornada ${jornada}`;
  const ideas = [
    { t: aparte(fa.join('. ')), prio: 9 },
    { t: aparte(fb.join('. ')), prio: 9 },
    { t: pick(['📊 Los % de titularidad son de Fantasy Manager', '📊 % de titularidad de Fantasy Manager', '📊 Porcentajes de Fantasy Manager, con los minutos y el estado de cada uno'], 2), prio: 5 },
  ];
  return { cab, ideas, num };
}
