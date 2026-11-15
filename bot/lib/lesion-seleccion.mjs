// Una lesión con la selección (Carlos, 16 nov 00:07, con el tuit de Pubill: «se ha lesionado hoy durante el partido contra Inglaterra:
// debería decir eso y no que arrastra molestias desde el 15 de noviembre»). En el parón, cuando un jugador pasa a lesionado con un parte
// de hoy o de ayer (o sin parte), se mira en las actas de FotMob (lib/actas-selecciones.mjs) si jugó con su selección ese día o el
// anterior: si FotMob marca que se retiró lesionado, el minuto; si no lo marca pero jugó el mismo día del parte, que se lesionó jugando.
// También vale con el partido aún en juego (el tuit de Pubill salió a las 21:21 y el España-Inglaterra acabó pasadas las 22:30).
import { actasDe, porJugador, aaaammdd, diaSemana, fechaTxt } from './actas-selecciones.mjs';
import { diaDelParte, diasDelParte } from './partes.mjs';
import { corto } from './texto.mjs';
import { json } from './http.mjs';

const DIA = 864e5;

/** «hoy», «ayer» o «el viernes 13 de noviembre», de un día AAAAMMDD */
export function cuandoDia(d, ahora = Date.now()) {
  const hoy = aaaammdd(ahora);
  if (d === hoy) return 'hoy';
  if (d === aaaammdd(ahora - DIA)) return 'ayer';
  return `el ${diaSemana(d)} ${fechaTxt(d)}`;
}

/**
 * Lo que se cuenta de la lesión con la selección de un jugador, o null. r: su entrada de porJugador; diaParte: AAAAMMDD o null.
 * { txt: «se retiró lesionado en el minuto 21 del partido de España contra Inglaterra», cuando, numeros, hechos }
 */
export function lesionEnSeleccion(r, diaParte, ahora = Date.now()) {
  if (!r) return null;
  const dias = diaParte ? [diaParte, aaaammdd(Date.parse(`${diaParte.slice(0, 4)}-${diaParte.slice(4, 6)}-${diaParte.slice(6)}T12:00:00Z`) - DIA)] : [aaaammdd(ahora), aaaammdd(ahora - DIA)];
  const cand = r.partidos.filter((p) => dias.includes(p.fecha) && p.min > 0);
  // primero el que FotMob marca como cambio por lesión; si no, el que jugó el mismo día del parte (sin parte, no se da por hecho)
  const p = cand.find((x) => x.lesion != null) || (diaParte ? cand.find((x) => x.fecha === diaParte) : null);
  if (!p) return null;
  const sel = r.sel.nombre, rival = p.rival.nombre;
  const cuando = cuandoDia(p.fecha, ahora);
  const partido = `el partido de ${sel} contra ${rival}`;
  const txt = p.lesion != null ? `se retiró lesionado en el minuto ${p.lesion} del partido de ${sel} contra ${rival}` : `se lesionó jugando con ${sel} contra ${rival}`;
  const numeros = [p.lesion, Number(p.fecha.slice(6)), ...(p.marcador && !p.vivo ? p.marcador.split('-').map(Number) : [])].filter((x) => x != null);
  const hechos = {
    dondeSeLesiono: `con su selección: ${partido} (${cuando}${cuando === 'hoy' || cuando === 'ayer' ? `, ${diaSemana(p.fecha)} ${fechaTxt(p.fecha)}` : ''})`,
    ...(p.lesion != null ? { seRetiroLesionadoEnElMinuto: p.lesion } : {}),
    ...(p.vivo ? { elPartidoDeLaSeleccion: 'se está jugando todavía' } : p.marcador ? { resultadoDeSuSeleccion: `${p.resultado} ${p.marcador}` } : {}),
  };
  return { txt, cuando, numeros, hechos, vivo: !!p.vivo };
}

/**
 * Marca en cada evento de lesión (novedades) su lesión con la selección: e.seleccion = lesionEnSeleccion(…). Solo en el parón y solo si
 * el parte es de hoy o de ayer (o no hay parte). Una sola consulta a FotMob para todos (dos días; los ya pasados salen de la caché).
 */
export async function marcarSeleccion(eventos, { jugadores = [], equipos = {}, paron = null, ahora = Date.now(), registro = null, pedir = json, log = () => {} } = {}) {
  if (!paron || !paron.activo) return;
  const frescos = eventos.filter((e) => e.que === 'lesion' && (!e.parte || !e.parte.dia || (diasDelParte(e.parte, ahora) ?? 9) <= 1));
  if (!frescos.length) return;
  const dias = [...new Set(frescos.flatMap((e) => {
    const d = e.parte ? diaDelParte(e.parte, ahora) : null;
    const t = d ? Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}T12:00:00Z`) : ahora;
    return [aaaammdd(t - DIA), aaaammdd(t)];
  }))].sort();
  const clubesLiga = new Set(Object.values(equipos).map((n) => corto(n)));
  const actas = await actasDe(dias, { clubesLiga, pedir, registro, ahora, log, enJuego: true }).catch((err) => { log(`  (lesión con selección) ${err.message || err}`); return []; });
  if (!actas.length) return;
  const por = porJugador(actas, jugadores, equipos);
  for (const e of frescos) {
    const s = lesionEnSeleccion(por.get(String(e.id)), e.parte ? diaDelParte(e.parte, ahora) : null, ahora);
    if (s) { e.seleccion = s; log(`  (lesión con selección) ${e.nombre}: ${s.txt} (${s.cuando}${s.vivo ? ', en juego' : ''})`); }
  }
}
