// Las preguntas del chat para las pasadas con la IA de verdad (chat-haiku.mjs) y para el comprobador (cotejar-chat.mjs).
// (19 nov, tercera parte de la revisión de la IA) De 16 a 50 preguntas por escena, por tipos: cifras de su liga, rivales,
// mercado, reglas de LaLiga, estrategia, ofertas, trampas, conversaciones de varios mensajes y el plan.
//
// Marcas (las rellena `prepararEnPagina` con la liga de ejemplo de cada escena):
//   {R2} {E2} el mánager y el equipo del 2º · {R3} el del 3º (en la escena lleva el apodo «el Tito») · {R5} {E5} {e5} el 5º
//   (su equipo se llama «Leao er Espabilao») · {MIO} mi jugador más caro · {MIO2} el mío de valor más parecido a {SUYO} ·
//   {SUYO} el más caro del 2º · {LIBRE} el libre más caro de menos de 50 M · {SUBE} {BAJA} el libre que más sube y el que
//   más baja hoy · {CHOLLO} el libre más barato con su precio cerca de su valor · {MIOSUBE} el mío que más sube · {MIOBAJA}
//   el mío que ha girado a la baja · {PLANV} uno que el plan del motor manda vender (o {MIO} si no hay) · {OFERTA} {OFJ}
//   la oferta de un rival que tengo (importe redondeado y el jugador)
// sigue: va detrás de la anterior, con su respuesta de verdad en la conversación
// debe / noDebe: lo que tiene que decir (o no) para estar bien; lo mira el comprobador (con la i y sin tildes)
export const CASOS = [
  // --- las 16 de siempre (las de la noche del 16 al 17 nov): se dejan igual para poder comparar ---
  { id: 'venta-rival', tipo: 'rivales', q: '¿Qué tiene {R2} a la venta?' },
  { id: 'plantilla-rival', tipo: 'rivales', sigue: true, q: 'Pero no solo lo que tiene en venta, mírame toda su plantilla. ¿Qué le puedo quitar?' },
  { id: 'por-equipo', tipo: 'rivales', q: '¿Qué jugadores interesantes tiene {E5}?' },
  { id: 'equipo-minusculas', tipo: 'rivales', q: 'y el del {e5} que jugadores tiene? de toda su plantilla' },
  { id: 'puedo-clausular', tipo: 'rivales', q: '¿Puedo clausular a {SUYO}?' },
  { id: 'que-hago-hoy', tipo: 'plan', q: '¿Qué hago hoy?' },
  { id: 'vender-mio', tipo: 'estrategia', q: '¿Vendo a {MIO}?' },
  { id: 'trato', tipo: 'ofertas', q: '{R2} me ofrece 15 M por {MIO}. ¿Lo acepto?' },
  { id: 'quien-me-ataca', tipo: 'rivales', q: '¿Quién me puede clausular a alguien esta semana?' },
  { id: 'vago', tipo: 'estrategia', q: 'Estoy perdido, ayúdame' },
  { id: 'mas-corto', tipo: 'conversacion', sigue: true, q: 'Dímelo más corto' },
  { id: 'trueque', tipo: 'ofertas', q: '{R2} me propone cambiarme {SUYO} por {MIO2}, uno por otro. ¿Me interesa?' },
  { id: 'portero', tipo: 'estrategia', q: '¿A quién pongo de portero esta jornada?' },
  { id: 'libre', tipo: 'mercado', q: '¿Qué te parece {LIBRE}?' },
  { id: 'cuanto-pujo', tipo: 'mercado', sigue: true, q: '¿Y cuánto pujo por él?' },
  { id: 'blindar', tipo: 'estrategia', q: '¿Blindo a alguien?' },
  // --- nuevas (19 nov) ---
  // cifras de su liga
  { id: 'saldo', tipo: 'cifras', q: '¿Cuánto saldo tengo ahora mismo?', debe: /\{SALDO\}/ },
  { id: 'para-pujar', tipo: 'cifras', q: '¿Cuánto me queda para pujar?', debe: /\{PUJAMAX\}/ },
  { id: 'mis-clausulas', tipo: 'cifras', q: '¿Qué cláusulas mías están abiertas y cuándo se abren las demás?' },
  { id: 'valor-equipo', tipo: 'cifras', q: '¿Cuánto vale mi equipo y en qué puesto voy?', debe: /\{VALOR\}/ },
  // rivales
  { id: 'dinero-rival', tipo: 'rivales', q: '¿Cuánto dinero tiene {R2}?' },
  { id: 'apodo-dictado', tipo: 'rivales', q: 'que le puedo fichar a leao ere espabilado' },
  { id: 'apodo', tipo: 'rivales', q: '¿Qué jugadores tiene el Tito que me interesen?' },
  // mercado
  { id: 'chollo', tipo: 'mercado', q: '¿{CHOLLO} es un chollo o no?' },
  { id: 'sube-mercado', tipo: 'mercado', q: '¿Ficho a {SUBE}, que no para de subir?' },
  { id: 'baja-mercado', tipo: 'mercado', q: '{BAJA} está más barato cada día, ¿lo pillo?' },
  { id: 'puja-loca', tipo: 'trampas', q: 'Voy a pujar 120 M por {LIBRE}, ¿vale?', noDebe: /\b(vale|perfecto|adelante)\b[^.]*120/ },
  // reglas de LaLiga
  { id: 'regla-puntos', tipo: 'reglas', q: '¿Cuánto dinero me da LaLiga por cada punto que hago en la jornada?' },
  { id: 'regla-14', tipo: 'reglas', q: 'Si clausulo a uno, ¿cuántos días tardan en poder quitármelo?', debe: /14 d[ií]as/ },
  { id: 'regla-25', tipo: 'reglas', q: '¿Cuántos jugadores puedo tener como mucho en la plantilla?', debe: /\b25\b/ },
  { id: 'regla-vender-jornada', tipo: 'reglas', q: 'Si vendo a un titular con la jornada ya empezada, ¿me cuentan sus puntos de esa jornada?' },
  { id: 'regla-dudosa', tipo: 'reglas', q: '¿Cuánto me da LaLiga por quedar primero de mi liga al final de la temporada?' },
  // estrategia
  { id: 'fornals', tipo: 'estrategia', q: '¿Vendo a {MIOSUBE} ya o aguanto?' },
  { id: 'baja-vendo', tipo: 'estrategia', q: '{MIOBAJA} está bajando, ¿lo vendo ya?' },
  { id: 'once', tipo: 'estrategia', q: '¿Qué once pongo para la próxima jornada?' },
  { id: 'paron', tipo: 'estrategia', q: '¿Qué hago en el parón de selecciones?' },
  // ofertas
  { id: 'oferta-rival', tipo: 'ofertas', q: '{OFR} me ha ofrecido {OFERTA} por {OFJ}. ¿Acepto?' },
  { id: 'cuanto-ofrezco', tipo: 'ofertas', q: '¿Cuánto le ofrezco a {R2} por {SUYO}?' },
  // trampas
  { id: 'no-existe-jugador', tipo: 'trampas', q: '¿Ficho a Pepito Grillotti, el delantero del Betis?', debe: /no (lo )?(encuentro|veo|aparece|est[aá]|existe|tengo)|ning[uú]n|no hay/ },
  { id: 'no-existe-rival', tipo: 'trampas', q: '¿Qué tiene a la venta Los Picapiedra FC?', debe: /no (lo |la )?(encuentro|veo|aparece|est[aá]|existe|tengo|hay)|ning[uú]n/ },
  { id: 'premisa-falsa', tipo: 'trampas', q: 'Como tengo 50 M de saldo, ¿clausulo a {SUYO}?', debe: /\{SALDO\}/ },
  { id: 'sin-dato', tipo: 'trampas', q: '¿Se ha lesionado {MIO} en el entrenamiento de esta mañana?' },
  { id: 'otro-deporte', tipo: 'trampas', q: '¿Quién va a ganar la NBA este año?' },
  { id: 'no-fantasy', tipo: 'trampas', q: 'Dame la receta de la tortilla de patatas' },
  // conversaciones de varios mensajes
  { id: 'conv-vender', tipo: 'conversacion', q: '¿Vendo a {MIO2}?' },
  { id: 'conv-y-el', tipo: 'conversacion', sigue: true, q: '¿Y {MIOBAJA}?' },
  { id: 'conv-cambio', tipo: 'conversacion', sigue: true, q: '¿Y si mejor vendo a los dos?' },
  { id: 'conv-al-final', tipo: 'conversacion', sigue: true, q: 'Vale, al final no vendo a ninguno. ¿Qué hago entonces?' },
  { id: 'conv-rival', tipo: 'conversacion', q: '¿Qué le puedo fichar a {R2}?' },
  { id: 'conv-otro-rival', tipo: 'conversacion', sigue: true, q: '¿Y a {R5}?' },
  { id: 'conv-cual', tipo: 'conversacion', sigue: true, q: '¿Cuál de los dos me conviene más?' },
  // el plan
  { id: 'plan-por-que', tipo: 'plan', q: '¿Por qué el plan me dice que venda a {PLANV}?' },
];

/* lo que se cambia en la liga de ejemplo antes de preguntar (lo mismo en todas las escenas): un rival con el nombre de un
   equipo de la liga de Carlos y otro con un apodo, para las preguntas por apodo y por dictado */
export const PREP_LIGA = `const r5 = S.D.clasif.find((e) => e.pos === 5); if (r5) r5.nombre = 'Leao er Espabilao';
  for (const r of S.M.rivales || []) if (r.e && r5 && String(r.e.teamId) === String(r5.teamId)) r.e.nombre = 'Leao er Espabilao';`;

/**
 * En la página (page.evaluate): rellena las marcas, monta lo que la app manda al Worker y lo que necesita el comprobador.
 * hist: la conversación de antes ({ r, t }); tipo: el caso.
 */
export async function prepararEnPagina({ q, hist }) {
  const I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js'), A = await import('./js/apodos.js');
  const Pl = await import('./js/plan.js');
  const { D, M } = window.S;
  if (!window.__marcas) {
    const r3 = M.rivales.find((x) => x.e.pos === 3);
    if (r3) A.ponerApodo(r3.e.teamId, 'el Tito');
    const rv = (n) => M.rivales.find((x) => x.e.pos === n) || M.rivales[Math.min(n - 1, M.rivales.length - 1)];
    const caro = (l) => [...l].sort((a, b) => (b.j.valor || 0) - (a.j.valor || 0))[0];
    const mias = (M.mias || []).filter((x) => x.j && x.j.pos !== 5);
    const mio = caro(mias), suyo = caro((rv(2).fichas || []).filter((x) => x.j && x.j.pos !== 5));
    const mio2 = mias.filter((x) => x.j.id !== mio.j.id).sort((a, b) => Math.abs(a.j.valor - suyo.j.valor) - Math.abs(b.j.valor - suyo.j.valor))[0];
    const d1 = (j) => { const t = M.tend ? M.tend(j.id) : null; return t && t.d1 != null ? t.d1 : 0; };
    const libres = (M.mercado || []).filter((m) => m.tipo !== 'manager').map((m) => ({ m, j: M.J(m.pid) })).filter((x) => x.j && x.j.pos !== 5);
    const libre = libres.filter((x) => x.j.valor < 50e6).sort((a, b) => b.j.valor - a.j.valor)[0];
    const sube = [...libres].filter((x) => !libre || x.j.id !== libre.j.id).sort((a, b) => d1(b.j) - d1(a.j))[0];
    const baja = [...libres].filter((x) => x.j.id !== (sube && sube.j.id)).sort((a, b) => d1(a.j) - d1(b.j))[0];
    const chollo = [...libres].filter((x) => x.j.id !== (sube && sube.j.id) && x.j.id !== (baja && baja.j.id)).sort((a, b) => ((a.m.precio || a.j.valor) / a.j.valor) - ((b.m.precio || b.j.valor) / b.j.valor) || a.j.valor - b.j.valor)[0];
    const ine = (j) => (M.inercia ? M.inercia(j.id) : null) || {};
    const mioSube = [...mias].filter((x) => x.j.id !== mio.j.id).sort((a, b) => d1(b.j) - d1(a.j))[0];
    const mioBaja = mias.find((x) => /gir|baj/.test(String(ine(x.j).fase || '')) && x.j.id !== mio2.j.id) || [...mias].filter((x) => x.j.id !== mio2.j.id).sort((a, b) => d1(a.j) - d1(b.j))[0];
    let planv = null;
    try { const P = Pl.planDeHoy(D, M, Dt.cfg()); const o = (P.ops || []).find((x) => !x.descartada && x.accion === 'vender' && x.j); planv = o ? o.j.nombre : null; } catch (e) { planv = null; }
    // una oferta de otro mánager por uno mío (la de la liga de ejemplo), redondeada como la diría él
    const of = (D.misVentas || []).map((v) => ({ v, o: (v.ofertas || []).find((o) => !o.deLiga && o.importe) })).find((x) => x.o);
    const ofR = of ? (M.rivales.find((r) => String(r.e.teamId) === String(of.o.deTeamId || '')) || null) : null;
    const eurM = (x) => `${Math.round(x / 1e6)} M`;
    const sinM = (x) => U.eur(x).replace(/\s+/g, ' ');
    window.__marcas = {
      R2: rv(2).e.manager, E2: rv(2).e.nombre, R3: rv(3).e.manager, R5: rv(5).e.manager, E5: rv(5).e.nombre, e5: rv(5).e.nombre.toLowerCase(),
      MIO: mio.j.nombre, MIO2: mio2.j.nombre, SUYO: suyo.j.nombre, LIBRE: libre ? libre.j.nombre : 'Cubarsí', SUBE: sube ? sube.j.nombre : 'Cubarsí',
      BAJA: baja ? baja.j.nombre : 'Cubarsí', CHOLLO: chollo ? chollo.j.nombre : 'Cubarsí', MIOSUBE: mioSube.j.nombre, MIOBAJA: mioBaja.j.nombre,
      PLANV: planv || mio.j.nombre, OFERTA: of ? eurM(of.o.importe) : '20 M', OFJ: of ? M.J(of.v.pid).nombre : mio2.j.nombre,
      OFR: ofR ? ofR.e.manager : (of && of.o.de) || rv(5).e.manager,
      SALDO: sinM(D.dinero), VALOR: sinM(M.yo ? M.yo.valor || M.yo.valorEquipo || 0 : 0), PUJAMAX: M.pujaMax != null ? sinM(M.pujaMax) : '',
    };
  }
  const mk = window.__marcas;
  const poner = (s) => String(s).replace(/\{([A-Za-z0-9]+)\}/g, (a, k) => (mk[k] != null ? mk[k] : a));
  const pre = poner(q);
  U.LS.set(Dt.K('chat'), [...hist, { r: 'yo', t: pre, ts: Date.now() }]);
  const h = I.conversacion();
  const cuerpo = I.pedidoChat(pre, D, M, Dt.cfg(), h, [], { rid: 'pruebahaiku01' });
  // lo del comprobador: los datos sin alias, los nombres de la liga y el plan de la app
  const datos = I.datosChat(pre, D, M, Dt.cfg(), { hist: h });
  const nombres = Object.values(D.maestro || {}).map((j) => j.nombre).filter(Boolean);
  const clubes = [...new Set(Object.values(D.maestro || {}).map((j) => j.equipo).filter(Boolean))];
  const equipos = (D.clasif || []).flatMap((e) => [e.nombre, e.manager]).filter(Boolean);
  let plan = [];
  try {
    const p = I.ultimoPlan && I.ultimoPlan();
    const P = p && p.dia === U.diaDe() ? I.cuadrarPlan(p, D, M) : Pl.planDeHoy(D, M, Dt.cfg());
    plan = (P.ops || []).filter((o) => !o.descartada).map((o) => ({ accion: o.accion, jugador: (o.j && o.j.nombre) || o.jugador || '' }));
  } catch (e) { plan = []; }
  return {
    pre, cuerpo, datos, nombres, clubes, equipos, plan,
    apodos: ['el Tito', 'Tito', 'Leao er Espabilao'], marcas: mk,
  };
}

/** En la página: lo que acaba viendo el mánager con una respuesta (alias de vuelta, notas y la revisión de la app) */
export async function vistaEnPagina({ texto, pre, hist }) {
  const I = await import('./js/ia.js');
  const { D, M } = window.S;
  const sd = I.seudonimos(D);
  const t = sd.n ? sd.destapar(texto) : texto;
  const n = I.aplicarNotas(t, D, pre);
  let rev = { texto: n.texto, notas: [] };
  try { rev = I.revisarChat(n.texto, pre, D, M, { rec: n.recomiendo, hist }); } catch (e) { /* como en la app */ }
  return { texto: rev.texto, revisadas: rev.notas.length, revision: rev.notas, apuntadas: n.apuntadas.map((x) => x.texto), recomiendo: (n.recomiendo || []).map((r) => ({ accion: r.accion, jugador: r.jugador })) };
}

/** un «debe»/«noDebe» con las marcas puestas (las cifras, tal cual) */
export function conMarcas(re, mk) {
  if (!re) return null;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(re.source.replace(/\\?\{([A-Za-z0-9]+)\\?\}/g, (a, k) => (mk[k] != null ? esc(mk[k]) : a)), 'i');
}
