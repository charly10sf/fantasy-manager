// Previa de cada partido (Carlos, 2 nov 23:28): «posibles onces» con el % de titularidad de la app (desde 36 h antes del partido, de 9
// a 23 h) y «onces confirmados» en cuanto ESPN publica las alineaciones (suelen salir ~1 h antes). Cada uno lleva su tarjeta con los
// dos onces. En el confirmado se cuentan las sorpresas: titulares habituales que se quedan fuera y los que entran sin esperarlo.
import { json } from '../lib/http.mjs';
import { statsSemana } from '../lib/laliga.mjs';
import { corto, elegir, el } from '../lib/texto.mjs';
import { tweet, enPalabras } from '../lib/redactar.mjs';
import { ESPN, partidoEspn } from '../lib/relato.mjs';
import { casarJugador } from './directo.mjs';
import { probabilidades, elegirOnce } from '../lib/onces.mjs';

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
      const probs = { L: await probabilidades(m.local.id, jugadores, jornada - 1), V: await probabilidades(m.visitor.id, jugadores, jornada - 1) };
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
          const nombres = (xs) => { const n = xs.slice(0, 3).map((x) => x.nombre); return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0]; };
          for (const [k, eq] of [['L', L], ['V', V]]) {
            const c = conf[k];
            if (c.fuera.length) ideas.push({ t: `❌ ${nombres(c.fuera)} ${c.fuera.length > 1 ? 'se quedan' : 'se queda'} fuera del once en ${el(eq)}`, prio: 9 });
            if (c.sorpresa.length) ideas.push({ t: `‼️ ${nombres(c.sorpresa)} ${c.sorpresa.length > 1 ? 'son titulares' : 'es titular'} en ${el(eq)}`, prio: 8 });
          }
          if (!ideas.length) ideas.push(elegir(['✅ Sin sorpresas: salen los onces que se esperaban', '✅ Ni un cambio raro en los dos onces'], sem));
          ideas.push({ t: '👀 Revisa tu once fantasy antes del pitido', prio: 7 });
          const { usadas, texto } = tweet(cab, ideas);
          const fm = (f) => (f || '').match(/\d/g) || [];
          out.push({ tipo: 'onces', clave: `onces|${m.id}`, jornada, texto, numeros: [], partido: null,
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
          if (alt) { fuera.add(String(alt.id)); x.alt = { id: alt.id, nombre: alt.nombre, pct: pct(alt.p), duda: alt.duda }; }
        }
        return { nombre: mm.mainName, corto: corto(mm.mainName), escudoUrl: mm.badgeColor, formacion: pos[k].formacion, once: once.map(({ p, ...x }) => x) };
      };
      const d = { jornada, confirmados: false, local: lado('L', m.local), visitante: lado('V', m.visitor) };
      // el texto: las dudas del once (titulares con menos del 65 %) y las bajas de titulares habituales
      const dudas = [...pos.L.once.map((x) => ({ ...x, eq: L })), ...pos.V.once.map((x) => ({ ...x, eq: V }))].filter((x) => x.p < 0.65 && x.p >= 0.1).sort((a, b) => a.p - b.p).slice(0, 3);
      const bajas = [...Object.values(probs.L).map((x) => ({ ...x, eq: L })), ...Object.values(probs.V).map((x) => ({ ...x, eq: V }))].filter((x) => (x.estado === 'injured' || x.estado === 'suspended')).slice(0, 4);
      // las dudas con palabras y el % al lado (regla 4 de la guía de estilo del 3 nov)
      const cab = `🗓️ Posibles onces fantasy del ${L}-${V} (jornada ${jornada})`;
      const ideas = [];
      const num = [jornada];
      if (dudas.length) { ideas.push({ t: dudas.map((x) => `⁉️ ${x.nombre} (${x.eq}), ${enPalabras(x.p)}: ${pct(x.p)} %`).join('\n'), prio: 9 }); num.push(...dudas.map((x) => pct(x.p))); }
      if (bajas.length) {
        const de = (eq) => bajas.filter((x) => x.eq === eq).map((x) => x.nombre);
        const partes = [[L, de(L)], [V, de(V)]].filter(([, xs]) => xs.length).map(([eq, xs]) => `${xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]} en ${el(eq)}`);
        ideas.push({ t: `❌ No estarán ${partes.join('; ')}`, prio: 8 });
      }
      if (!dudas.length && !bajas.length) ideas.push({ t: '✅ Sin dudas ni bajas entre los habituales', prio: 8 });
      ideas.push({ t: elegir(['📊 Los % de titularidad son de Fantasy Manager', '📊 % de titularidad de Fantasy Manager, con los minutos y el estado de cada uno'], sem), prio: 5 });
      const { usadas, texto } = tweet(cab, ideas);
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
