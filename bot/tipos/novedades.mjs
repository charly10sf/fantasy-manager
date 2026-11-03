// Novedades de jugadores entre semana (Carlos, 2 nov 23:28): cambios de estado en LaLiga Fantasy de los jugadores que importan
// (media de 4 o más, o 10 M o más de valor): pasa a lesionado, sancionado, o vuelve a estar disponible. Las dudas no salen solas
// (una duda necesita una segunda fuente, regla de Carlos). Compara con el estado guardado en el registro (`estados`, en la rama
// bot-estado); la primera vez solo lo guarda. Fuera de horario (9 a 23 h) no mira nada, así los cambios se acumulan para el día.
import { corto, fmt, partes, elegir, el, del } from '../lib/texto.mjs';
import { tweet, cap, segunda, proximoPartido, paraLa } from '../lib/redactar.mjs';
import { tarjetaBajas } from '../lib/datos-tarjetas.mjs';

const IMPORTA = (j) => Number(j.positionId) >= 1 && Number(j.positionId) <= 4 && (Number(j.averagePoints) >= 4 || Number(j.marketValue) >= 10e6);
const horaMadrid = (t) => Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Madrid' }).format(new Date(t)));
const diaMadrid = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date(t));

export async function generar({ jugadores, equipos, jornada, stats = null, semana = null, config = {}, registro = null, ventanas = true, forzar = false, previos = null, ahora = Date.now(), log = console.log, proximo = proximoPartido }) {
  const [hD, hH] = config.horasNovedades || [9, 23];
  if (ventanas && !forzar && (horaMadrid(ahora) < hD || horaMadrid(ahora) >= hH)) return [];
  const actual = {};
  for (const j of jugadores || []) actual[j.id] = j.playerStatus || 'ok';
  const antes = previos || (registro && registro.datos && registro.datos.estados) || null;
  if (registro && registro.datos) { registro.datos.estados = actual; registro.guardar(); }
  if (!antes) { log('  (novedades) primera vez: guardo los estados y no publico nada'); return []; }
  const escudos = {};
  for (const m of stats || []) for (const lado of [m.local, m.visitor]) if (lado && lado.id != null && lado.badgeColor) escudos[String(lado.id)] = lado.badgeColor;
  const eventos = [];
  for (const j of (jugadores || []).filter(IMPORTA)) {
    const a = antes[j.id], b = actual[j.id];
    if (!a || a === b) continue;
    let que = null;
    if (b === 'injured' && a !== 'injured') que = 'lesion';
    else if (b === 'suspended' && a !== 'suspended') que = 'sancion';
    else if (b === 'ok' && ['injured', 'suspended', 'doubtful'].includes(a)) que = 'vuelve';
    if (!que) continue;
    eventos.push({ id: j.id, nombre: j.nickname, teamId: j.teamId, pos: j.positionId, equipo: corto(equipos[String(j.teamId)] || '?'), club: equipos[String(j.teamId)] || '', caraUrl: j.image || null, escudoUrl: escudos[String(j.teamId)] || null,
      estado: que === 'lesion' ? 'lesionado' : que === 'sancion' ? 'sancionado' : 'disponible', media: Number(j.averagePoints) || 0, que, antes: a });
  }
  if (!eventos.length) return [];
  log(`  (novedades) ${eventos.length} cambios: ${eventos.map((e) => `${e.nombre} ${e.antes}→${e.que}`).join(', ')}`);
  eventos.sort((a, b) => b.media - a.media);
  // Cómo se escriben (guía de estilo del 3 nov, formato de @JoseCarrasco_98): con pocos cambios, un tweet por jugador con la noticia
  // arriba, el detalle por su puesto y la etiqueta final con la jornada y el rival; con más de 4, en lista (máximo 4 tweets por ejecución).
  for (const e of eventos) e.pp = await proximo(e.teamId, { stats, semana, jornada }).catch(() => null);
  const numDe = (e) => [...(e.media >= 3 ? partes(e.media) : []), ...(e.pp ? [e.pp.jornada] : [])];
  const out = [];
  const dia = diaMadrid(ahora);
  if (eventos.length <= 4) {
    for (const e of eventos) {
      const media = e.media >= 3 ? `, con ${fmt(e.media)} puntos de media` : '';
      const quien = `${cap(segunda(e.pos, e.nombre))} ${del(e.equipo)}`;
      let cab, ideas;
      if (e.que === 'lesion') {
        cab = elegir([`🚨 ${e.nombre} aparece como lesionado en LaLiga Fantasy`, `🚨 Saltan las alarmas con ${e.nombre}: lesionado en LaLiga Fantasy`], `nl${e.id}${dia}`);
        ideas = [e.media >= 3 ? { t: `⚠️ ${quien} suma ${fmt(e.media)} puntos de media`, prio: 6 } : null, { t: `❌ En principio, baja ${paraLa(e.pp, null)}`, prio: 9 }];
      } else if (e.que === 'sancion') {
        cab = `🚨 ${e.nombre} aparece como sancionado en LaLiga Fantasy`;
        ideas = [{ t: `⚠️ ${quien} se pierde el próximo partido${e.media >= 3 ? ` y suma ${fmt(e.media)} puntos de media` : ''}`, prio: 6 }, { t: `❌ Baja confirmada ${paraLa(e.pp, null)}`, prio: 9 }];
      } else {
        const tras = e.antes === 'injured' ? ' ya está recuperado' : e.antes === 'suspended' ? ' ya ha cumplido la sanción' : ' deja de estar en duda';
        cab = `✅ ${e.nombre} vuelve a estar disponible en LaLiga Fantasy`;
        ideas = [{ t: `‼️ ${quien}${tras}${media}`, prio: 6 }, { t: `✅ Disponible ${paraLa(e.pp, null)}`, prio: 9 }];
      }
      const { usadas, texto } = tweet(cab, ideas);
      if (!usadas.length) continue;
      const clave = `novedades|${e.id}:${e.que}|${dia}`;
      out.push({ tipo: 'novedades', clave, jornada, texto, numeros: numDe(e), tarjeta: tarjetaBajas({ jornada, filas: [e], pp: e.pp, clave }) });
    }
    return out;
  }
  const linea = (e) => {
    const m = e.media >= 3 ? ` (${fmt(e.media)} de media)` : '';
    if (e.que === 'lesion') return `❌ ${e.nombre} (${e.equipo}), lesionado${m}`;
    if (e.que === 'sancion') return `🟥 ${e.nombre} (${e.equipo}), sancionado${m}`;
    return `✅ ${e.nombre} (${e.equipo}), disponible otra vez${m}`;
  };
  let i = 0, k = 0;
  while (i < eventos.length && out.length < 4) {
    const cab = elegir(['🚨 Novedades en LaLiga Fantasy', '🚨 Cambios de última hora en LaLiga Fantasy'], `nov${dia}${k}`);
    const resto = eventos.slice(i, i + 5);
    let n = resto.length, texto = null;
    for (; n >= 1; n--) { const r = tweet(cab, [resto.slice(0, n).map(linea).join('\n'), { t: '👀 Revisa tu once antes de la jornada', prio: 3 }]); if (r.usadas.length) { texto = r.texto; break; } }
    if (!texto) break;
    const quienes = resto.slice(0, n);
    const clave = `novedades|${quienes.map((e) => `${e.id}:${e.que}`).join(',')}|${dia}`;
    out.push({ tipo: 'novedades', clave, jornada, texto, numeros: quienes.flatMap((e) => (e.media >= 3 ? partes(e.media) : [])),
      tarjeta: tarjetaBajas({ jornada, filas: quienes, pp: quienes.every((e) => String(e.teamId) === String(quienes[0].teamId)) ? quienes[0].pp : null, clave }) });
    i += n; k++;
  }
  return out;
}
