// El tuit con el enlace a la previa de la jornada en la web (guias/jornada-N.html, bot/previa-web.mjs; prompt de AdSense del 15 nov:
// «que el bot tuitee el enlace»). Uno por jornada, cuando la página ya está publicada con los datos de la semana (generada desde 80 h
// antes del primer partido) y antes de que empiece la jornada, de 9 a 23 h. El texto lleva lo que trae la página (cierre de
// cláusulas, sancionados y apercibidos, el que más sube) y el enlace va aparte (`enlace`, lib/x.mjs): el validador no deja enlaces
// en el texto.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { horaMadrid, horas } from '../lib/horario.mjs';
import { tweet, aparte } from '../lib/redactar.mjs';
import { enMadrid, dinero, dif } from '../web/vista.mjs';
import { hash } from '../lib/texto.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOMINIO = 'https://fantasymanagerapp.com/';
const HORA = 36e5;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const cuando = (t) => { const d = enMadrid(t); return { txt: `el ${DIAS[d.sem]} a las ${d.hora}`, numeros: d.hora.split(':').map(Number) }; };
/** los números de una cifra escrita («19,4 M» → 19 y 4) */
const nums = (s) => (String(s).match(/\d+/g) || []).map(Number);

export async function generar({ jornada, semana = null, config = {}, registro = null, ventanas = true, forzar = false, ahora = Date.now(), log = console.log, pedir = fetch, leer = null }) {
  const cand = [...new Set([jornada, semana && semana.nextWeek].filter(Boolean))];
  let P = null;
  for (const J of cand) {
    const f = path.join(RAIZ, '.github', 'previas', `${J}.json`);
    const d = leer ? leer(J) : (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null);
    if (d && d.hechos && ahora < d.hechos.primero) { P = d; break; }
  }
  if (!P) { log('  (previaweb) no hay previa de la jornada que viene'); return []; }
  const h = P.hechos, J = h.jornada, clave = `previaweb|${J}`;
  if (registro && registro.claves && registro.claves.has(clave)) return [];
  if (ventanas && !forzar) {
    const [d, hh] = horas(config, 'horasNoticias', [9, 23], ahora);
    if (horaMadrid(ahora) < d || horaMadrid(ahora) >= hh) { log(`  (previaweb) fuera de horario (${d} a ${hh} h)`); return []; }
    if (h.generada < h.primero - 80 * HORA) { log('  (previaweb) la previa aún es la de antes de la semana: espero a que se ponga al día'); return []; }
  }
  const ruta = `guias/jornada-${J}.html`;
  // que ya esté publicada (Pages tarda un par de minutos después del push)
  try {
    const r = await pedir(`${DOMINIO}${ruta}`, { headers: { 'Cache-Control': 'no-cache' } });
    const t = r.ok ? await r.text() : '';
    if (!t.includes(`Jornada ${J} de`)) { log(`  (previaweb) ${ruta} aún no está publicada (HTTP ${r.status})`); return []; }
  } catch (e) { log(`  (previaweb) no he podido mirar ${ruta}: ${e.message || e}`); return []; }

  const ci = cuando(h.cierre), re = cuando(h.reapertura);
  const numeros = [J, ...ci.numeros, ...re.numeros];
  const V = (xs, k) => xs[hash(`pw${J}${k}`) % xs.length];
  const cab = V([`📋 La previa de la jornada ${J}, ya en la web`, `📋 Todo lo de la jornada ${J} para el fantasy, en una página`, `📋 Previa de la jornada ${J}: lo que tienes que mirar antes del cierre`], 'cab');
  const ideas = [{ t: `🔒 Las cláusulas se cierran ${ci.txt} y se reabren ${re.txt}`, prio: 9 }];
  const san = h.sancionados.length, ap = h.apercibidos.length;
  if (san || ap) {
    const top = h.apercibidos[0];
    const partes = [san ? `${san} ${san === 1 ? 'sancionado' : 'sancionados'}` : null, ap ? `${ap} ${ap === 1 ? 'titular apercibido' : 'titulares apercibidos'}` : null].filter(Boolean).join(' y ');
    ideas.push({ t: `🟨 ${partes}${top ? `, con ${top.nombre} como el que más pesa` : ''}`, prio: 7 });
    numeros.push(san, ap);
  }
  const s = h.suben[0];
  if (s) { ideas.push({ t: aparte(`📈 ${s.nombre} es el que más sube en la semana: ${dif(s.dif7)}`), prio: 6 }); numeros.push(...nums(dif(s.dif7))); }
  const b = h.bajas[0];
  if (b) ideas.push({ t: `🚑 Bajas, dudas y los que vuelven, con su parte`, prio: 4 });
  const { texto } = tweet(cab, ideas, { max: Math.max(200, (config.tweetMax || 280) - 30) });
  const hechos = { tipo: 'previaweb', noticia: `la previa de la jornada ${J} ya está en la web de Fantasy Manager: cierre y reapertura de cláusulas, sancionados, apercibidos, bajas y los que más suben`,
    cierre: ci.txt, reapertura: re.txt, sancionados: san, apercibidos: ap, ...(s ? { queMasSube: `${s.nombre} (${s.equipo}), ${dif(s.dif7)} en 7 días hasta ${dinero(s.valor)}` } : {}),
    aviso: 'el enlace a la página va aparte, al final del tuit: no lo escribas' };
  return [{ tipo: 'previaweb', clave, jornada: J, texto, hechos, numeros, enlace: `${DOMINIO}${ruta}`, partido: null }];
}
