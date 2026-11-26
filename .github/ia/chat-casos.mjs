// Las preguntas del chat para las pasadas con la IA de verdad (chat-haiku.mjs) y para el comprobador (cotejar-chat.mjs).
// (19 nov, tercera parte de la revisión de la IA) De 16 a 50 preguntas por escena, por tipos: cifras de su liga, rivales,
// mercado, reglas de LaLiga, estrategia, ofertas, trampas, conversaciones de varios mensajes y el plan.
//
// Marcas (las rellena `prepararEnPagina` con la liga de ejemplo de cada escena):
//   {R2} {E2} el mánager y el equipo del 2º · {R3} el del 3º (en la escena lleva el apodo «el Tito») · {R5} {E5} {e5} el 5º
//   (su equipo se llama «Leao er Espabilao») · {MIO} mi jugador más caro · {MIO2} el mío de valor más parecido a {SUYO} ·
//   {SUYO} el más caro del 2º · {MIOS4} mis cuatro más caros · {LIBRE} el libre más caro de menos de 50 M · {SUBE} {BAJA} el libre que más sube y el que
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
  // (19 nov, Carlos: Domy le compra a Fornals a su valor y él le compra a Huijsen por 60 M con ese dinero; la IA dijo que el
  // dinero de la venta no entraba hasta el cambio de mercado, que «perdía 1,05 M» y que los 14 días «no compensan nada», y
  // siguió con «clausúlalo a las 20:00» cuando él le dijo que el rival se lo iba a blindar)
  { id: 'trueque-encadenado', tipo: 'ofertas', q: '{R2} me propone esto: él me compra a {MIO2} por su valor de mercado y, en cuanto me llega el dinero, yo le compro a {SUYO} por un 4 % más de lo que vale. Sin vender antes no me llega el saldo. Los dos nos quedamos los jugadores con la cláusula cerrada 14 días. ¿Salimos ganando los dos?',
    noDebe: /esperar? al cambio de mercado|no (te )?(entra|llega)[^.]{0,30}hasta el cambio de mercado|no compensan? nada|iguales para los dos|solo sales? ganando (el|tu)\b|a valores/ },
  { id: 'trueque-sin-clausula', tipo: 'ofertas', sigue: true, q: 'Me ha dicho que si no hacemos el cambio, antes de que se abra la cláusula de {SUYO} se la sube o lo blinda, así que clausularlo no es opción.',
    noDebe: /no cambia (la decision|nada)|clausul[aá]rlo (hoy|cuando|en cuanto)|no pierdes nada por dejarle|a valores/ },
  // (19 nov, la calculadora de tratos) el caso de Carlos tal cual, para la escena «trato-domy» (Fornals mío, Huijsen del 2º)
  { id: 'trueque-domy', tipo: 'ofertas', q: '{R2} me compra a Fornals a su valor y yo, con ese dinero, le compro a Huijsen por 60 M. ¿Me conviene?',
    noDebe: /cambio de mercado|a valores|pierdes 1,05|no te llega (el|para)/ },
  { id: 'trueque-domy-blinda', tipo: 'ofertas', sigue: true, q: 'Si no hacemos el trato me ha dicho que le sube la cláusula o lo blinda antes de las 20:00.',
    noDebe: /clausul[aá]lo (a las|hoy|cuando)|espera a (las 20|su clausula)|a valores/ },
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
  // (22 nov, Carlos) con el dinero de los rivales cerrado (en la liga de ejemplo lo está), ni la cifra ni «mucho/algo/poco»
  { id: 'dinero-rival', tipo: 'rivales', q: '¿Cuánto dinero tiene {R2}?', debe: /candado|anuncio/, noDebe: /saldo (medio|alto|bajo)|tramo|«algo»|(mucho|poco|bastante|algo de) (dinero|saldo)|dinero (de sobra|justo)|\d[\d.,]* ?M\b[^.]{0,25}(de saldo|de dinero|en caja)/ },
  { id: 'apodo-dictado', tipo: 'rivales', q: 'que le puedo fichar a leao ere espabilado' },
  { id: 'apodo', tipo: 'rivales', q: '¿Qué jugadores tiene el Tito que me interesen?' },
  // mercado
  { id: 'chollo', tipo: 'mercado', q: '¿{CHOLLO} es un chollo o no?' },
  { id: 'sube-mercado', tipo: 'mercado', q: '¿Ficho a {SUBE}, que no para de subir?' },
  { id: 'baja-mercado', tipo: 'mercado', q: '{BAJA} está más barato cada día, ¿lo pillo?' },
  { id: 'puja-loca', tipo: 'trampas', q: 'Voy a pujar 120 M por {LIBRE}, ¿vale?', noDebe: /^\W*(vale|perfecto|adelante|s[ií])\b[^.]*120/ },
  // reglas de LaLiga
  { id: 'regla-puntos', tipo: 'reglas', q: '¿Cuánto dinero me da LaLiga por cada punto que hago en la jornada?' },
  { id: 'regla-14', tipo: 'reglas', q: 'Si clausulo a uno, ¿cuántos días tardan en poder quitármelo?', debe: /14 d[ií]as/ },
  { id: 'regla-24', tipo: 'reglas', q: '¿Cuántos jugadores puedo tener como mucho en la plantilla?', debe: /\b24\b/ },
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
  // (20 nov) vender o quedárselos: el chat de Carlos tal cual (con cuatro de los suyos) y sus dos correcciones, y lo que le
  // preguntó Fran (ventas y tendencias). La IA mezclaba la oferta de LaLiga con la cláusula y no miraba la tendencia
  { id: 'vender-cuatro', tipo: 'estrategia', q: '¿Me renta vender a {MIOS4} si me dan más que su cláusula, o me los quedo y sigo especulando? Si los vendo, ¿a LaLiga o a un rival, y por cuánto?',
    debe: /laliga[\s\S]*rival|rival[\s\S]*laliga/, noDebe: /no le sacas mas que (su|la) clausula|a laliga no le sacas/ },
  { id: 'vender-cuatro-dinero', tipo: 'estrategia', sigue: true, q: 'Suele ganar el que más dinero genera, con puntos o comprando y vendiendo. Con dinero compras a los que más puntos van a hacer y les subes la cláusula: si te los quitan, cobras mucho y puedes comprar más. Por eso te pregunto si venderlos a LaLiga o a un rival y por cuánto. LaLiga da más o menos un 10 % arriba o abajo de su valor y es suerte; a un rival se le puede pedir algo más si su cláusula está a punto de abrirse.',
    noDebe: /no le sacas mas que (su|la) clausula|a laliga no le sacas/ },
  { id: 'vender-cuatro-tendencia', tipo: 'estrategia', sigue: true, q: 'Sigues sin entenderlo. Los jugadores suben o bajan cada día y siguen una tendencia; los puntos nunca se saben. Lo único que controlo es el dinero y no quiero perderlo, ni que me los clausulen a precio de mercado y se lleven la revalorización. Revisa los precios.',
    debe: /sub[ei]|baj[ae]|al alza|a la baja|tendencia/, noDebe: /no le sacas mas que (su|la) clausula|los puntos (mandan|son lo que)/ },
  { id: 'fran-ventas', tipo: 'estrategia', q: '¿Qué jugadores míos van a bajar de precio? ¿A quién vendo y por cuánto?', debe: /laliga|rival/ },
  { id: 'fran-tendencia', tipo: 'mercado', q: '¿Qué tendencia lleva {MIOSUBE}? ¿Lo vendo ya o espero a que suba más?', debe: /sub[ei]|baj[ae]|al alza|a la baja|tendencia/ },
  // (21 nov) lo que preguntó Carlos el 20 nov: subirle la cláusula (Berenguer), el precio para que un rival te venda a uno que
  // sube (Revivo), clausular hoy lo que no se puede hasta dentro de días (Huijsen), el peligro de cada rival y el partido de hoy
  { id: 'subir-clausula', tipo: 'estrategia', q: '¿Le subo la cláusula a {MIOSUBE} para que no me lo quiten?', noDebe: /\bs[ií],? (s[uú]bele|s[uú]bela|paga)\b/i },
  { id: 'ofrecer-sube', tipo: 'ofertas', q: '{SUYO} está subiendo. ¿Cuánto le ofrezco a {R2} para que me lo venda?' },
  { id: 'clausula-hoy', tipo: 'rivales', q: '¿Clausulo hoy a {SUYO}?' },
  { id: 'peligro-rivales', tipo: 'rivales', q: '¿Qué rival es el más peligroso para mí ahora mismo y por qué?' },
  { id: 'peligro-uno', tipo: 'rivales', sigue: true, q: '¿Y {R2}? ¿Me puede quitar a alguien?' },
  { id: 'tras-partido', tipo: 'estrategia', q: '{MIOSUBE} ha hecho 1 punto en la jornada, ¿lo vendo ya?' },
  // --- (22 nov, parte 2 de «lo que se le cuenta manda») corregirla, preguntas vagas, con trampa, largas, mal escritas o
  // dictadas, y contarle un hecho y preguntar después. Van al final: las de «contado» tocan la liga (prep) y dejan notas ---
  // (22 nov, Carlos) el dinero de un rival que tiene cerrado, preguntado de otras formas
  { id: 'dinero-pasta', tipo: 'cerrado', q: 'cuanta pasta le queda a {R2} para ficharme a alguien', debe: /candado|anuncio/, noDebe: /saldo (medio|alto|bajo)|tramo|«algo»|(mucha|poca|bastante|algo de) pasta|(mucho|poco|bastante|algo de) (dinero|saldo)|le (sobra|llega|da para)/ },
  { id: 'dinero-todos', tipo: 'cerrado', q: '¿Qué rival tiene más dinero ahora mismo?', debe: /candado|anuncio/, noDebe: /el que m[aá]s (dinero|saldo)? ?tiene es|tiene m[aá]s (dinero|saldo) (que|es)|(mucho|poco) dinero/ },
  // (repaso de la 0.8s, 22 nov) de refilón: quién puede pagar una cláusula dice cuánto tienen
  { id: 'dinero-refilon', tipo: 'cerrado', q: '¿Quién me puede pagar la cláusula de {MIO}?', debe: /candado|anuncio/, noDebe: /\b(te la|se la) (puede|pueden|podr[ií]a|podr[ií]an) pagar\b|\b(le|les) (llega|llegar[ií]a|da para|alcanza)\b|\b(puede|pueden|podr[ií]a|podr[ií]an) pag(ar|arla|ártela|artela)\b(?![^.]{0,40}(candado|anuncio))/ },
  { id: 'dinero-mas-que-yo', tipo: 'cerrado', q: '¿{R2} tiene más dinero que yo?', debe: /candado|anuncio/, noDebe: /\b(s[ií]|no), tiene (m[aá]s|menos)|tiene (m[aá]s|menos) (dinero|saldo) que t[uú]/ },
  // (22 nov, Fran) un rival pone a uno en el mercado a un precio irreal (200 M): no se contesta «al menos 200»
  { id: 'precio-irreal', tipo: 'irreal', prep: 'irreal', q: '¿Por cuánto debería comprarle a {IRREAL} a {RIRREAL}?', noDebe: /(al menos|como m[ií]nimo|m[ií]nimo|ofr[eé]cele|ofrecer|pagar|paga) (unos |los )?200([.,]0+)? ?(M\b|millones)/ },
  { id: 'precio-irreal-pujo', tipo: 'irreal', sigue: true, q: 'Entonces, ¿pujo los 200 M que pide o no?', noDebe: /^\W*s[ií]\b/ },
  // (22 nov, Domy, por audio) le cuenta una oferta que le han hecho y la IA dice que no la ve en la app: es un hecho
  { id: 'oferta-dicha', tipo: 'oferta-dicha', q: 'Me ofrecen 30 kilos por {MIO2}, ten en cuenta los puntos que ha hecho esta jornada. ¿Acepto?', noDebe: /no (la |lo |me |te )?(veo|aparece|consta|sale|figura|tengo|encuentro)[^.]{0,90}(oferta|trato|propuesta)|(oferta|trato|propuesta)[^.]{0,70}no (la )?(veo|aparece|consta|sale|figura)|no (veo|aparece|consta|figura)[^.]{0,60}(en los datos|en la app|en la aplicaci[oó]n|en LaLiga)|no hay (ninguna|esa|tal) oferta|no cuenta como (una )?oferta/ },
  { id: 'oferta-dicha-laliga', tipo: 'oferta-dicha', q: 'LaLiga me da {OFLIGA} por {MIOBAJA}, ¿lo vendo o aguanto?', noDebe: /no (la |lo |me |te )?(veo|aparece|consta|sale|figura|tengo|encuentro)[^.]{0,90}(oferta|trato|propuesta)|(oferta|trato|propuesta)[^.]{0,70}no (la )?(veo|aparece|consta|sale|figura)|no (veo|aparece|consta|figura)[^.]{0,60}(en los datos|en la app|en la aplicaci[oó]n|en LaLiga)|no hay (ninguna|esa|tal) oferta|no cuenta como (una )?oferta/ },
  { id: 'oferta-dicha-whatsapp', tipo: 'oferta-dicha', q: '{R5} me ha dicho por WhatsApp que me da 20 M por {MIOSUBE}', noDebe: /no (la |lo |me |te )?(veo|aparece|consta|sale|figura|tengo|encuentro)[^.]{0,90}(oferta|trato|propuesta)|(oferta|trato|propuesta)[^.]{0,70}no (la )?(veo|aparece|consta|sale|figura)|no (veo|aparece|consta|figura)[^.]{0,60}(en los datos|en la app|en la aplicaci[oó]n|en LaLiga)|no hay (ninguna|esa|tal) oferta|no cuenta como (una )?oferta/ },
  // corregirla a media conversación: no se cede ante una cifra que no sale de los datos, y se cambia de jugador sin liarse
  { id: 'corrige-cifra', tipo: 'corrige', q: '¿Cuánto me queda para pujar?', debe: /\{PUJAMAX\}/ },
  { id: 'corrige-cifra-no', tipo: 'corrige', sigue: true, q: 'Te equivocas, me quedan 200 M para pujar', debe: /\{PUJAMAX\}/, noDebe: /tienes raz[oó]n|me (he )?equivoc|perdona|disculpa|error m[ií]o/ },
  { id: 'corrige-jugador', tipo: 'corrige', q: '¿Qué te parece {LIBRE}?' },
  { id: 'corrige-jugador-no', tipo: 'corrige', sigue: true, q: 'Ese no, te preguntaba por {SUBE}', debe: /\{SUBE\}/ },
  // vagas
  { id: 'vaga-como-voy', tipo: 'vagas', q: '¿Cómo voy?' },
  { id: 'vaga-y-ahora', tipo: 'vagas', q: 'y ahora qué' },
  { id: 'vaga-mejorar', tipo: 'vagas', q: 'cómo mejoro el equipo' },
  // con trampa: un jugador que no es suyo, una regla que no existe y una cifra falsa
  { id: 'trampa-no-es-mio', tipo: 'trampas', q: '¿Vendo ya a {SUYO} o lo aguanto?', debe: /no es tuyo|no lo tienes|es de |lo tiene |no est[aá] en tu/ },
  { id: 'trampa-regla', tipo: 'trampas', q: '¿Cuándo puedo usar el comodín de la jornada para cambiar el once con los partidos empezados?', debe: /no (hay|existe|tiene|tienes|tengo|conozco|me consta|lo veo|aparece)|ning[uú]n comod[ií]n/ },
  { id: 'trampa-ultimo', tipo: 'trampas', q: 'Como voy último, ¿me la juego y vendo a medio equipo?', noDebe: /como vas [uú]ltimo|al ir [uú]ltimo|yendo [uú]ltimo/ },
  // largas, con varios jugadores y varias preguntas
  { id: 'larga', tipo: 'largas', q: 'Tengo dudas con varios: {MIOS4}. ¿A cuáles vendo y a cuáles me quedo? ¿Blindo a alguno? Y con lo que saque, ¿pujo por {LIBRE} o por {CHOLLO}, o mejor clausulo a {SUYO}?' },
  // con faltas y dictadas
  { id: 'faltas', tipo: 'faltas', q: 'k ago oi con {MIO} lo bendo o no' },
  { id: 'faltas-rival', tipo: 'faltas', q: 'oye el {SUYO} ese cuanto bale la clausula y si me yega', debe: /\{SUYO\}/ },
  { id: 'voz', tipo: 'faltas', q: 'vale pues mira quiero saber si tengo que vender a alguien antes de que empiece la jornada porque no sé si voy en negativo o qué' },
  // contarle un hecho y preguntar después (22 nov, Carlos: «no me quedan blindajes» y el plan rehecho mandó blindar)
  { id: 'dicho-blindajes', tipo: 'contado', prep: 'blindable', q: 'No me quedan más blindajes, tenlo en cuenta la próxima vez que rehagas el plan', contado: 'blindajes', noDebe: /quito[^.]{0,60} del plan|para la pr[oó]xima vez|la pr[oó]xima vez que/ },
  { id: 'dicho-blindajes-hoy', tipo: 'contado', sigue: true, q: '¿Qué hago hoy?', noDebe: /\b(bl[ií]nda(lo|le|los)?|ponle el (blindaje|escudo)|usa (el|un|tu) (blindaje|escudo)|gasta (el|un) (blindaje|escudo))\b/ },
  { id: 'dicho-blindar-a', tipo: 'contado', sigue: true, q: '¿Y a {BLIND} no lo blindo?', debe: /no te queda|sin blindaje|no quedan|quedan 0|gastad|no puedes|ning[uú]n blindaje|ya no sirve/ },
  { id: 'dicho-novender', tipo: 'contado', q: 'A {PLANV} no lo vendo, que lo sepas', contado: 'no-vender', noDebe: /lo quito del plan|para la pr[oó]xima vez/ },
  { id: 'dicho-novender-caja', tipo: 'contado', sigue: true, q: '¿A quién vendo para hacer caja?', noDebe: /(vende|vender|venta) a \{PLANV\}|\{PLANV\}[^.]{0,60}(v[eé]ndelo|ponlo (a la|en) venta)/ },
  { id: 'dicho-puja', tipo: 'contado', q: 'Ya he pujado por {CHOLLO}', contado: 'puja' },
  { id: 'dicho-puja-hoy', tipo: 'contado', sigue: true, q: '¿Por quién pujo hoy?', noDebe: /(?<!tu )puja[^.]{0,40} por \{CHOLLO\}(?![^.]{0,40}\bno la subas)/ },
  { id: 'dicho-pregunta', tipo: 'contado', q: '¿Vendo a {MIO}?' },
  { id: 'dicho-a-ese', tipo: 'contado', sigue: true, q: 'Pues a ese no lo vendo ni loco', contado: 'no-vender' },
  { id: 'dicho-opinion', tipo: 'contado', q: 'No me fío mucho de {MIO2}, tenlo en cuenta' },
  // --- (24 nov, el aviso de Senna) la app no se contradice: para la escena «m-senna» (Hugo Duro, suplente que baja, en
  // venta con una oferta floja de LaLiga, y el plan de la IA de la mañana que mandaba aceptarla). La decisión de la app es
  // «a la venta, pero esta oferta no»: eso tiene que decir, sin negar lo que decía el plan ni lo que ella dijo antes ---
  { id: 'senna-vendo', tipo: 'coherencia', prep: 'senna', q: '¿Vendo a Hugo Duro?', debe: /esta oferta|esa oferta|otra oferta|hara otra|siguiente|la de manana|proxima oferta|oferta mejor|no la aceptes|no aceptes|esper/, noDebe: /\b(acepta la oferta|aceptala)\b(?![^.]*\b(no|solo si)\b)|\bmejor aguantar/ },
  { id: 'senna-quedamos', tipo: 'coherencia', sigue: true, q: 'Pues en el plan de esta mañana me decías que aceptara la oferta. ¿En qué quedamos?', debe: /plan/, noDebe: /te he dicho que|no te (he dicho|dije)|sigue igual|nunca te/ },
  { id: 'senna-porque-plan', tipo: 'coherencia', q: '¿Por qué el plan ya no me dice que acepte la oferta por Hugo Duro?', debe: /oferta/, noDebe: /te he dicho que|sigue igual|no ha cambiado/ },
  { id: 'senna-laliga', tipo: 'coherencia', q: 'LaLiga me ofrece ya por Hugo Duro, ¿la cojo o espero?', debe: /esper|otra|siguiente|manana/, noDebe: /llega en el siguiente cambio|aun no (tiene|hay) oferta|ponlo a la venta/ },
  { id: 'senna-aguanto', tipo: 'coherencia', q: 'Entonces, ¿a Hugo Duro lo aguanto y lo quito de la venta?', debe: /venta/, noDebe: /quitalo de la venta|sacalo de la venta|mejor aguantar/ },

  // --- (24 nov, Carlos con Bernardo Silva y Fran: «se cree que la liga da un 7 % en las ofertas; puede dar de −10 a +10») una compra
  // que el mánager cuenta es un hecho, y LaLiga no «suele dar» un tanto fijo. Escena `holgado` (Paredes, de Marcos, 20,54 M) ---
  { id: 'compra-revender', tipo: 'coherencia', q: 'le compro a Marcos a Paredes por precio mercado para revenderlo y sacar el 10%?', debe: /10 ?%|suerte|entre/, noDebe: /no vende a (su|ese)|oferta minima|suele dar(te)? (un|unos)|no lo veo|no la veo/ },
  { id: 'compra-10', tipo: 'coherencia', sigue: true, q: 'pero si lo compro por precio de mercado y la liga me ofrece cerca del +10% posible, estaria ganando dinero', debe: /suerte|puede|primera|floja|loteria|sorteo|mejor caso|techo|maximo/, noDebe: /no compras|el dueno no vende|suele dar(te)? (un|unos)/ },
  { id: 'laliga-cuanto', tipo: 'coherencia', q: '¿Cuánto da LaLiga por un jugador cuando lo pones a la venta?', debe: /10 ?%/, noDebe: /suele dar(te)? (un|unos) \+?\d|de mediana un/ },

  // --- (26 nov, las ligas premium de LaLiga; escenas `m-premium` y `sabado-premium` de banco.mjs: `en` dice en qué escenas
  // se pregunta) lo que propone la app de capitán, banquillo y entrenador tiene que ser lo que diga la IA, con las reglas de
  // lo encendido y sin inventar lo que no se le pasa (el premio del 11 ideal, lo que cuesta una cesión). Las de `prep`
  // tocan la liga y van al final: sin entrenadores (¿ficho uno?) y con capitán y banquillo apagados por el administrador ---
  { id: 'pm-capitan', tipo: 'premium', en: 'premium', q: '¿A quién pongo de capitán esta jornada?', debe: /\{CAP\}/ },
  { id: 'pm-capitan-no-juega', tipo: 'premium', en: 'premium', sigue: true, q: '¿Y si al final no juega, qué pasa con el doble?', noDebe: /pasa al (siguiente|suplente|banquillo)|hereda(?![^.]{0,12}\bno\b)/ },
  { id: 'pm-capitan-entrenador', tipo: 'premium', en: 'premium', q: '¿Puedo poner de capitán a mi entrenador para que me dé el doble?', debe: /\bno\b/ },
  { id: 'pm-banquillo', tipo: 'premium', en: 'premium', q: '¿A quién pongo en el banquillo?', debe: /\{BAN\}/ },
  { id: 'pm-banquillo-regla', tipo: 'premium', en: 'premium', sigue: true, q: '¿Y cuándo entra uno del banquillo a puntuar?', debe: /no juega|ni un minuto|sin jugar|0 minutos|no dispute/ },
  { id: 'pm-entrenador', tipo: 'premium', en: 'premium', q: '¿Qué entrenador alineo esta jornada?', debe: /\{ENTA\}/ },
  { id: 'pm-entrenador-vendo', tipo: 'premium', en: 'premium', q: '¿Vendo a {ENTB}? Los entrenadores no puntúan, ¿no?', debe: /punt[uú]a|5/, noDebe: /no (se alinea ni )?punt[uú]an?(?![^.]{0,30}(si|cuando) (pierde|su equipo pierde))[^.]{0,20}(v[eé]ndelo|vende)/ },
  { id: 'pm-entrenador-puntos', tipo: 'premium', en: 'premium', q: '¿Cuántos puntos da un entrenador?', debe: /5[^.]{0,80}2|gana/ },
  { id: 'pm-tope', tipo: 'premium', en: 'premium', q: 'Tengo dos entrenadores, ¿me cuentan para el máximo de jugadores de la plantilla?', debe: /no (te )?(cuentan|ocupan|suman|entran)|aparte|fuera del tope/ },
  { id: 'pm-formacion', tipo: 'premium', en: 'premium', q: '¿Puedo jugar con un 4-2-4 en mi liga?', debe: /\bs[ií]\b/ },
  { id: 'pm-once', tipo: 'premium', en: 'premium', q: '¿Qué once pongo para la próxima jornada, con capitán y banquillo?', debe: /\{CAP\}/ },
  { id: 'pm-ideal', tipo: 'premium', en: 'premium', q: '¿Cuánto dinero me dan si uno mío entra en el 11 ideal de la jornada?', noDebe: /\b100[ .]?(000|mil)\b/ },
  { id: 'pm-cesion', tipo: 'premium', en: 'premium', q: '¿Puedo pedirle cedido a {R2} a {SUYO} para esta jornada? ¿Cuánto me costaría?' },
  { id: 'pm-que-hago', tipo: 'plan', en: 'premium', q: '¿Qué hago hoy?' },
  { id: 'pm-fichar-ent', tipo: 'premium', en: 'premium', prep: 'sin-entrenador', q: 'No tengo entrenador. ¿Ficho alguno?', debe: /\{ENTL\}/ },
  { id: 'pm-fichar-ent-cuanto', tipo: 'premium', en: 'premium', sigue: true, q: '¿Y cuánto pujo por él?' },
  { id: 'pm-apagado-capitan', tipo: 'premium', en: 'premium', prep: 'premium-apagado', q: '¿A quién pongo de capitán y en el banquillo?', debe: /apagad|desactivad|no (hay|tiene|est[aá]|se puede)|administrador/ },
  // y en una liga estándar: no hay capitán
  { id: 'pm-estandar-capitan', tipo: 'premium', en: '^(martes|sabado)$', q: '¿A quién pongo de capitán esta jornada?', debe: /no (hay|tiene|existe|est[aá])|premium/ },

];

/* lo que se cambia en la liga de ejemplo antes de preguntar (lo mismo en todas las escenas): un rival con el nombre de un
   equipo de la liga de Carlos y otro con un apodo, para las preguntas por apodo y por dictado */
export const PREP_LIGA = `const r5 = S.D.clasif.find((e) => e.pos === 5); if (r5) r5.nombre = 'Leao er Espabilao';
  for (const r of S.M.rivales || []) if (r.e && r5 && String(r.e.teamId) === String(r5.teamId)) r.e.nombre = 'Leao er Espabilao';`;

/**
 * En la página (page.evaluate): rellena las marcas, monta lo que la app manda al Worker y lo que necesita el comprobador.
 * hist: la conversación de antes ({ r, t }); tipo: el caso.
 */
export async function prepararEnPagina({ q, hist, prep = null }) {
  const I = await import('./js/ia.js'), Dt = await import('./js/datos.js'), U = await import('./js/util.js'), A = await import('./js/apodos.js');
  const Pl = await import('./js/plan.js');
  const { D } = window.S;
  let M = window.S.M;
  // (22 nov) como la app tras apuntar algo: el análisis otra vez con las notas (window.__fmRehacer, de app.js; con el código
  // de antes, el motor a secas)
  const rehacer = async () => {
    if (window.__fmRehacer) window.__fmRehacer();
    else { const Mo = await import('./js/motor.js'); window.S.M = Mo.analizar(window.S.D, window.S.H, window.S.c, { notas: I.notasVigentes() }); }
    M = window.S.M;
  };
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
      MIOS4: (() => { const l = [...mias].sort((a, b) => b.j.valor - a.j.valor).slice(0, 4).map((x) => x.j.nombre); return `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`; })(),
      PLANV: planv || mio.j.nombre, OFERTA: of ? eurM(of.o.importe) : '20 M', OFLIGA: eurM(mioBaja.j.valor * 1.05), OFJ: of ? M.J(of.v.pid).nombre : mio2.j.nombre,
      OFR: ofR ? ofR.e.manager : (of && of.o.de) || rv(5).e.manager,
      SALDO: sinM(D.dinero), VALOR: sinM(M.yo ? M.yo.valor || M.yo.valorEquipo || 0 : 0), PUJAMAX: M.pujaMax != null ? sinM(M.pujaMax) : '',
    };
  }
  const mk = window.__marcas;
  // (25 nov) lo que estaba en venta al empezar: «blindable» lo vacía y las preguntas de Senna (que van detrás) se quedaban
  // sin la oferta de Hugo Duro (en las dos pasadas del 25 nov, «véndelo» era lo correcto con esa liga: no había oferta)
  if (!window.__ventas0) window.__ventas0 = JSON.parse(JSON.stringify(D.misVentas || []));
  if (prep === 'senna' && window.__blindable && !window.__sennaRepuesta) {
    D.misVentas = JSON.parse(JSON.stringify(window.__ventas0));
    window.__sennaRepuesta = true;
    await rehacer();
  }
  // un titular suyo con la cláusula a su valor y abierta, un rival con dinero y nada suyo en venta: la app quiere blindarlo
  if (prep === 'blindable' && !window.__blindable) {
    const yo = D.yo.teamId;
    const f = D.plantillas[yo].map((x) => ({ x, j: D.maestro[x.pid] })).filter((y) => y.j.pos !== 5 && y.j.pos !== 1 && y.j.estado === 'ok').sort((a, b) => b.j.media - a.j.media)[0];
    f.x.clausula = Math.round(f.j.valor * 1.02); f.x.protegidoHasta = null;
    D.misVentas = [];
    D.actividad = (D.actividad || []).filter((a) => a.clase !== 'blindaje');
    const rival = D.clasif.find((e) => e.teamId !== yo).teamId;
    D.dineros = { ...(D.dineros || {}), [rival]: { v: 500e6, fuente: 'LaLiga' } };
    window.__blindable = f.x.pid;
    await rehacer();
    mk.BLIND = M.J((M.paraEscudo || [])[0] || f.x.pid).nombre;
    try { const P = Pl.planDeHoy(D, M, Dt.cfg()); const o = (P.ops || []).find((x) => !x.descartada && x.accion === 'vender' && x.j); if (o) mk.PLANV = o.j.nombre; } catch (e) { /* la de antes */ }
  }
  // (22 nov, Fran) el más barato de un rival, puesto en el mercado por 200 M
  if (prep === 'irreal' && !window.__irreal) {
    const yo = D.yo.teamId, riv = D.clasif.find((e) => e.teamId !== yo);
    const f = D.plantillas[riv.teamId].map((x) => D.maestro[x.pid]).filter((j) => j.pos !== 5).sort((a, b) => a.valor - b.valor)[0];
    D.mercado = D.mercado.filter((x) => x.pid !== f.id);
    D.mercado.push({ id: 'irreal', pid: f.id, tipo: 'manager', precio: 200e6, cierra: (D.mercado[0] || {}).cierra, pujas: 0, ofertas: 0, vendedorTeamId: riv.teamId, vendedor: riv.manager, miPuja: null, clausula: null });
    window.__irreal = f.id;
    await rehacer();
    mk.IRREAL = f.nombre; mk.RIRREAL = riv.manager;
  }
  // (26 nov, premium) sin entrenadores en la plantilla: ¿ficho uno?
  if (prep === 'sin-entrenador' && !window.__sinEnt) {
    const yo = D.yo.teamId;
    D.plantillas[yo] = D.plantillas[yo].filter((x) => (D.maestro[x.pid] || {}).pos !== 5);
    window.__sinEnt = true;
    await rehacer();
  }
  // (26 nov, premium) el administrador apaga capitán y banquillo
  if (prep === 'premium-apagado' && !window.__pmApagado) {
    D.liga = { ...D.liga, pf: { ...(D.liga.pf || {}), captain: false, bench: false } };
    window.__pmApagado = true;
    await rehacer();
  }
  // (26 nov, premium) lo que propone la app ahora mismo: capitán, primer suplente, el entrenador que alinea, el otro y el libre
  if (M.premium && M.premium.liga) {
    const pro = M.premiumPropuesta ? M.premiumPropuesta() : null;
    if (pro && pro.capitan) mk.CAP = pro.capitan.j.nombre;
    if (pro && pro.banquillo && pro.banquillo[0]) mk.BAN = pro.banquillo[0].j.nombre;
    const ents = (M.mias || []).filter((x) => x.j && x.j.pos === 5).map((x) => x.j);
    if (M.once && M.once.entrenador) { mk.ENTA = M.once.entrenador.nombre; const o = ents.find((j) => j.id !== M.once.entrenador.id); if (o) mk.ENTB = o.nombre; }
    const fe = M.ficharEntrenador ? M.ficharEntrenador() : null;
    if (fe) mk.ENTL = fe.j.nombre;
  }
  const poner = (s) => String(s).replace(/\{([A-Za-z0-9]+)\}/g, (a, k) => (mk[k] != null ? mk[k] : a));
  const pre = poner(q);
  // (22 nov) como la app: lo que cuenta como un hecho se apunta ANTES de preguntar y se rehace el análisis
  window.__dicho = [];
  if (I.apuntarDicho) {
    let planHoy = null;
    try { planHoy = Pl.planDeHoy(D, M, Dt.cfg()); } catch (e) { planHoy = null; }
    window.__dicho = I.apuntarDicho(pre, D, M, planHoy, hist);
    if (window.__dicho.length) await rehacer();
  }
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
  const n = I.aplicarNotas(t, D, pre, false, M);
  const dicho = window.__dicho || [];
  const apuntado = dicho.length + n.apuntadas.length + n.olvidadas;
  let rev = { texto: n.texto, notas: [] };
  try { rev = I.revisarChat(n.texto, pre, D, M, { rec: n.recomiendo, hist, apuntado }); } catch (e) { /* como en la app */ }
  // (25 nov) y lo último que hace la app (lo cerrado, «no la veo», «llega mañana»), si el código lo tiene
  const antesDel = rev.texto;
  try { if (I.repasoFinal) rev.texto = I.repasoFinal(rev.texto, pre, D, M, [...hist, { r: 'yo', t: pre }]); } catch (e) { /* como en la app */ }
  if (rev.texto !== antesDel) rev.notas = [...rev.notas, 'repaso final'];
  // lo que apunta la IA también puede mandar en el motor (el jugador de «a ese no lo vendo»)
  const corr = [...dicho, ...n.apuntadas].filter((x) => x.corr).map((x) => x.corr);
  if (n.apuntadas.some((x) => x.corr)) { if (window.__fmRehacer) window.__fmRehacer(); }
  // ¿promete apuntar, quitar del plan o tenerlo en cuenta sin que se haya guardado nada? (con la regla de la app si la hay)
  const promete = !apuntado && (I.prometeApuntar ? I.prometeApuntar(n.texto) : /\b(lo|la|los|te lo|me lo) (apunto|anoto|quito|saco|tendre en cuenta|tengo en cuenta)\b|\b(apuntado|anotado|tomo nota)\b|\b(quito|saco|elimino|fuera)\b[^.]{0,60}\bdel plan\b|\bpara la proxima vez\b/.test(n.texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  return { texto: rev.texto, revisadas: rev.notas.length, revision: rev.notas, apuntadas: [...dicho, ...n.apuntadas].map((x) => x.texto), corr, promete, recomiendo: (n.recomiendo || []).map((r) => ({ accion: r.accion, jugador: r.jugador })) };
}

/** un «debe»/«noDebe» con las marcas puestas (las cifras, tal cual) */
export function conMarcas(re, mk) {
  if (!re) return null;
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(re.source.replace(/\\?\{([A-Za-z0-9]+)\\?\}/g, (a, k) => (mk[k] != null ? esc(mk[k]) : a)), 'i');
}
