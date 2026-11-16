// La página de la previa (web/guias/jornada-N.html): el contenido que va entre las marcas de .github/paginas.py, que pone la
// cabecera, el menú, el pie y las metas. HTML de verdad, sin JavaScript. Cada apartado: el análisis (si ha pasado la revisión) y
// los datos en una tabla corta.
import { apartadoPrevia } from './onces.mjs';
import { vista, fechaHora, fecha, diaCorto, hora, dinero, dif, pct, criterioChollos, quePasa } from './vista.mjs';

const e = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const coma = (x) => String(Math.round(Number(x) * 10) / 10).replace('.', ',');
const parrafo = (t) => (t ? `  <p>${e(t)}</p>\n` : '');
const tabla = (cab, filas, clase = '') => filas.length
  ? `  <div class="tabla-scroll"><table${clase ? ` class="${clase}"` : ''}>\n    <thead><tr>${cab.map((c) => `<th>${e(c)}</th>`).join('')}</tr></thead>\n    <tbody>\n${filas.map((f) => `      <tr>${f.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}\n    </tbody>\n  </table></div>\n`
  : '';
const w = (t) => (t ? `<span class="w">${e(t)}</span>` : '');
const rival = (x) => (x.rival ? `${x.casa ? 'vs' : 'en'} ${e(x.rival)}` : '');

/** «domingo 15, lunes 16 y martes 17 de noviembre» (el mes, solo cuando cambia o al final) */
function noches(ts) {
  const fs = ts.map((x) => fecha(x - 36e5).split(' de '));   // ['domingo 15', 'noviembre']
  const partes = fs.map(([d, m], i) => (i < fs.length - 1 && fs[i + 1][1] === m ? d : `${d} de ${m}`));
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}` : partes[0];
}

/** el título, el h1 y la descripción de la página (para paginas.json) */
export function metas(h) {
  const J = h.jornada;
  return {
    titulo: `Jornada ${J} de LaLiga Fantasy: chollos, cláusulas, bajas y mercado`,
    h1: `Jornada ${J} de LaLiga Fantasy`,
    corto: `Previa de la jornada ${J}`,
    descripcion: `Previa de la jornada ${J} de LaLiga Fantasy: los chollos baratos y titulares, a qué hora se cierran las cláusulas, onces probables, sancionados, apercibidos, lesionados y quién sube de valor.`,
  };
}

/**
 * El HTML del contenido. `textos`: { intro, clausulas, sancionados, apercibidos, bajas, vuelven, mercado } (null = sin análisis).
 * `siguiente`: la ruta de la previa siguiente si ya existe (las viejas avisan de que la jornada ya se jugó).
 */
export function contenido(h, textos = {}, { siguiente = null, rutas = null, onces = null } = {}) {
  const J = h.jornada, t = textos || {}, v = vista(h);
  // el nombre del jugador, enlazado a su ficha del portal si la tiene (rutas: { jugador(id) } desde la raíz de la web)
  const jn = (x) => { const r = rutas && x.id != null ? rutas.jugador(x.id) : null; return r ? `<b><a href="../${e(r)}">${e(x.nombre)}</a></b>` : `<b>${e(x.nombre)}</b>`; };
  const o = [];
  o.push(`  <h1>Jornada ${J} de <span>LaLiga Fantasy</span></h1>`);
  if (siguiente) o.push(`  <p class="aviso">Esta jornada ya se ha jugado. La previa de la siguiente está en <a href="${e(siguiente.split('/').pop())}">${e(siguiente.split('/').pop().replace('.html', '').replace('jornada-', 'jornada '))}</a>.</p>`);
  o.push(`  <p class="lead">Empieza el ${e(fechaHora(h.primero))} con el ${e(h.primerPartido.local)}-${e(h.primerPartido.visitante)} y acaba el ${e(fechaHora(h.ultimo))}. Lo que cambia para tu equipo: cuándo se cierran las cláusulas, quién no juega, quién está a una amarilla y qué jugadores se están moviendo en el mercado.</p>`);
  o.push(parrafo(t.intro).trimEnd());
  o.push(`  <p class="peq">Datos del ${e(fechaHora(h.generada))}. Se ponen al día antes del cierre de cláusulas.</p>`);

  // cláusulas y calendario
  const cambios = h.cambiosAntesDelCierre || [];
  o.push(`\n  <h2>Cierre y reapertura de cláusulas</h2>`);
  o.push(`  <p>Las cláusulas se cierran el <b>${e(fechaHora(h.cierre))}</b>, 24 horas antes del primer partido, y se reabren el <b>${e(fechaHora(h.reapertura))}</b>, cuando empieza. ${cambios.length ? `Hasta el cierre quedan ${cambios.length === 1 ? 'un cambio de mercado' : `${cambios.length} cambios de mercado`}: ${e(cambios.length === 1 ? `la noche del ${fecha(cambios[0] - 36e5)}` : `las noches del ${noches(cambios)}`)}, hacia las 00:15.` : 'Ya no queda ningún cambio de mercado antes del cierre.'}</p>`);
  o.push(parrafo(t.clausulas).trimEnd());
  o.push(tabla(['Día', 'Hora', 'Partido'], h.partidos.map((p) => [e(diaCorto(p.t)), e(hora(p.t)), `${e(p.local)} - ${e(p.visitante)}`])).trimEnd());
  o.push(`  <p class="peq">Cómo funciona el cierre, en <a href="clausulas-laliga-fantasy.html">cláusulas en LaLiga Fantasy</a>; cuándo proteger a los tuyos, en <a href="blindaje-laliga-fantasy.html">el blindaje</a> y <a href="subir-clausula.html">la calculadora de cláusula</a>.</p>`);

  // (sesión 3 de AdSense, idea 6) los chollos de la jornada, con el criterio a la vista
  if (h.chollos) {
    const c = h.chollos;
    o.push(`\n  <h2 id="chollos">Chollos de la jornada ${J}</h2>`);
    o.push(`  <p>Entran los jugadores que ${e(criterioChollos(c.criterio))}. Debajo de cada uno, lo que ha pasado esta temporada con las rachas como la suya.</p>`);
    if (c.lista.length) {
      o.push(parrafo(t.chollos).trimEnd());
      o.push(tabla(['Jugador', 'Equipo', 'Valor', 'Media', 'Rival', 'Sube desde hace'], c.lista.map((x) => [jn(x), e(x.equipo), e(dinero(x.valor)), coma(x.media), `${rival(x)} <small>(${e(x.nivelRival)})</small>`, `${x.diasSubiendo} días`])).trimEnd());
      // lo que suele pasar, agrupado por tipo de racha (una frase por grupo, no la misma frase con cada nombre)
      const grupos = new Map();
      for (const x of c.lista) grupos.set(x.por, [...(grupos.get(x.por) || []), x]);
      const ys = (xs) => (xs.length === 1 ? jn(xs[0]) : `${xs.slice(0, -1).map(jn).join(', ')} y ${jn(xs[xs.length - 1])}`);
      const frases = [...grupos.values()].map((xs) => `${ys(xs)}: ${e(quePasa(xs[0]))}.`);
      const largas = c.lista.filter((x) => x.diasSubiendo >= 10);
      if (largas.length) frases.push(`${ys(largas)} ${largas.length > 1 ? 'llevan' : 'lleva'} diez días o más: de las rachas que llegan a tres días, solo el 42,2 % llega a diez, así que ${largas.length > 1 ? 'ya están' : 'ya está'} en lo raro.`);
      o.push(`  <p class="peq">${frases.join(' ')}</p>`);
    } else o.push(`  <p>${e(c.mirados ? `Esta semana ninguno cumple todo: ${c.mirados === 1 ? 'el único barato que sube con un rival asequible no es' : `de los ${c.mirados} baratos que suben con un rival asequible, ninguno es`} titular fijo en sus últimos partidos.` : 'Esta semana ningún jugador barato con buena media sube de valor con un rival asequible.')}</p>`);
    o.push(`  <p class="peq">Por qué esas cifras, en <a href="valor-de-mercado.html">cómo se mueve el valor de mercado</a>; cómo medimos la dificultad del rival, en <a href="../metodo.html#rivales">el método</a>.</p>`);
  }

  // sancionados
  o.push(`\n  <h2>Sancionados</h2>`);
  if (h.sancionados.length) {
    o.push(parrafo(t.sancionados || `No juegan la jornada ${J}: ${h.sancionados.length === 1 ? 'un jugador que pesa en el fantasy' : `${h.sancionados.length} jugadores que pesan en el fantasy`}.`).trimEnd());
    o.push(tabla(['Jugador', 'Equipo', 'Motivo', 'Media'], h.sancionados.map((x) => [jn(x), e(x.equipo), w(x.motivo), coma(x.media)])).trimEnd());
  } else o.push(`  <p>LaLiga no tiene a ningún jugador importante sancionado para esta jornada.</p>`);

  // apercibidos
  o.push(`\n  <h2>Apercibidos</h2>`);
  if (h.apercibidos.length) {
    o.push(parrafo(t.apercibidos || `Juegan la jornada ${J}, pero con una amarilla más se pierden la ${J + 1}.`).trimEnd());
    o.push(tabla(['Jugador', 'Equipo', `Jornada ${J}`, `Se perdería (J${J + 1})`], h.apercibidos.map((x) => [jn(x), e(x.equipo), rival(x), x.rivalSiguiente ? e(x.rivalSiguiente) : '']), 'tabla-pos').trimEnd());
    o.push(`  <p class="peq">Solo titulares habituales con cuatro amarillas en su ficha de LaLiga. Qué hacer con ellos, en <a href="apercibidos-laliga.html">apercibidos en LaLiga Fantasy</a>.</p>`);
  } else o.push(`  <p>Ningún titular habitual está a una amarilla de la sanción.</p>`);

  // bajas y dudas
  o.push(`\n  <h2>Lesionados y dudas</h2>`);
  const filasBaja = [...h.bajas.map((x) => [x, 'Baja']), ...h.dudas.map((x) => [x, 'Duda'])];
  if (filasBaja.length) {
    o.push(parrafo(t.bajas || 'Las bajas y dudas que más pesan en el fantasy, por valor de mercado.').trimEnd());
    o.push(tabla(['Jugador', 'Equipo', 'Estado', 'Parte', 'Vuelta prevista'], filasBaja.map(([x, est]) => [jn(x), e(x.equipo), est, w(x.lesion), e(x.hasta || '')])).trimEnd());
    o.push(`  <p class="peq">La lista entera, con el valor de cada uno y lo que lleva bajando, en <a href="../bajas/">las bajas de la jornada</a>. Vender o aguantar a un lesionado, en <a href="cuando-vender.html">cuándo vender en LaLiga Fantasy</a>.</p>`);
  } else o.push(`  <p>No hay bajas importantes.</p>`);

  // vuelven
  if (h.vuelven.length) {
    o.push(`\n  <h2>Los que vuelven</h2>`);
    o.push(parrafo(t.vuelven || 'Disponibles para esta jornada después de diez días o más fuera.').trimEnd());
    o.push(tabla(['Jugador', 'Equipo', 'Tenía', 'Días fuera', 'Media'], h.vuelven.map((x) => [jn(x), e(x.equipo), w(x.lesion), String(x.diasFuera), coma(x.media)])).trimEnd());
  }

  // (sesión 3, idea 12) los onces probables: el enlace a jornada/onces.html y las dudas más igualadas (con reglas, sin IA)
  o.push(apartadoPrevia(onces, J));

  // mercado
  o.push(`\n  <h2>Los que más suben y bajan esta semana</h2>`);
  o.push(parrafo(t.mercado || 'Los cambios de valor más grandes de los últimos siete cambios de mercado.').trimEnd());
  const fm = (x, k) => [jn(x), e(x.equipo), e(dinero(x.valor)), e(dif(x.dif7)), e(pct(x.pct7)), String(k)];
  o.push(`  <h3>Suben</h3>`);
  o.push(tabla(['Jugador', 'Equipo', 'Valor', '7 días', '%', 'Días seguidos'], h.suben.map((x) => fm(x, x.diasSubiendo))).trimEnd());
  o.push(`  <h3>Bajan</h3>`);
  o.push(tabla(['Jugador', 'Equipo', 'Valor', '7 días', '%', 'Días seguidos'], h.bajan.map((x) => fm(x, x.diasBajando))).trimEnd());
  o.push(`  <p class="peq">Qué mueve el valor y cuánto suelen durar las rachas, en <a href="valor-de-mercado.html">valor de mercado en LaLiga Fantasy</a>. Para pujar por uno que sube, <a href="cuanto-pujar.html">la calculadora de puja</a>.</p>`);

  // (sesión 3) lo que antes iba en «De dónde salen los datos» y «Con Fantasy Manager», igual en todas las previas, está en metodo.html
  o.push(`\n  <p class="peq">${e(`Los datos son de LaLiga Fantasy, entre los ${h.jugadoresMirados} jugadores que valen 1 M o más.`)} De dónde sale cada lista y cómo se escribe el texto, en <a href="../metodo.html#previas">cómo hacemos las previas</a>.</p>`);
  return o.filter(Boolean).join('\n');
}
