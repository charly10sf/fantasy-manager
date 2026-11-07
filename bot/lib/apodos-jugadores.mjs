// Cómo se llama de verdad a un jugador (Carlos, 7 nov 15:47: «no siempre poner C. Romero sino el Cuti o los apodos que tengas, hay muchos
// jugadores en esa tesitura»). LaLiga Fantasy da a muchos un «nickname» con la inicial («B. Iglesias», «F. De Jong») y la tarjeta, si el
// nombre no cabe, también abrevia («Cuti Romero» -> «C. ROMERO»). Aquí, por el nickname de LaLiga:
//   completo: el nombre con el que sale en la prensa («Borja Iglesias»)
//   corto: la forma corta para la tarjeta cuando el nombre no cabe, en vez de la inicial («Cuti»)
//   otros: apodos que la IA puede usar alguna vez («el Panda»)
//   rasgos: cómo juega o cómo marca, a mano y SOLO con fuente (un comentario con ella al lado) y aprobado por Carlos; van a los hechos de
//     un gol como `suEstilo` y la IA puede decirlo con sus palabras («vuelve a hacer una de las suyas»). Las cifras de la temporada no van
//     aquí: se calculan (lib/rasgos.mjs).
// Solo los que se conocen sin duda: el resto de nicknames con inicial dejan además usar el apellido solo («Musso» por «J. Musso»).
// Para añadir uno: su nickname EXACTO de LaLiga (bot/prueba o la app lo enseñan) y lo que se sepa.
export const APODOS_JUGADORES = {
  'Cuti Romero': { corto: 'Cuti', otros: ['el Cuti'] },
  'B. Iglesias': { completo: 'Borja Iglesias', corto: 'Borja Iglesias', otros: ['el Panda'] },
  'B. Mayoral': { completo: 'Borja Mayoral', corto: 'Mayoral' },
  'C. Soler': { completo: 'Carlos Soler', corto: 'Soler' },
  'F. De Jong': { completo: 'Frenkie de Jong', corto: 'De Jong', otros: ['Frenkie'] },
  'E. Militão': { completo: 'Éder Militão', corto: 'Militão' },
  'F. Mendy': { completo: 'Ferland Mendy', corto: 'Mendy' },
  'Á. Carreras': { completo: 'Álvaro Carreras', corto: 'Carreras' },
  'O. Sancet': { completo: 'Oihan Sancet', corto: 'Sancet' },
  'M. Casadó': { completo: 'Marc Casadó', corto: 'Casadó' },
  'I. Romero': { completo: 'Iván Romero', corto: 'Iván Romero' },
  'R. Brugué': { completo: 'Roger Brugué', corto: 'Brugué' },
  'V. Chust': { completo: 'Víctor Chust', corto: 'Chust' },
  'J. Musso': { completo: 'Juan Musso', corto: 'Musso' },
  'Y. Zabiri': { completo: 'Yassir Zabiri', corto: 'Zabiri' },
  'Vini Jr.': { completo: 'Vinícius', corto: 'Vini', otros: ['Vinícius Júnior'] },
  // Rasgos y motes aprobados por Carlos el 7 nov (23:30). Fuentes de cada uno en claude/rasgos-propuesta.md; los motes, aquí.
  // Yamal: «O Rei», que el club publicó así en mayo de 2025 (Fox Sports); Carlos lo aprobó el 7 nov (23:33). «El Rey» no: tiene detractores.
  'Lamine Yamal': { corto: 'Lamine', otros: ['Lamine', 'O Rei'], rasgos: ['recorta hacia la zurda y dispara desde fuera del área, a segundo palo'] },
  'Álex Baena': { corto: 'Baena', rasgos: ['marca de falta directa'] },
  'Raphinha': { rasgos: ['es un buen lanzador de faltas'] },
  // Isco: «el Mago» (Vavel, 17 mar 2026; El Gol Digital: «el Mago de Arroyo de la Miel»)
  'Isco': { completo: 'Isco Alarcón', otros: ['el Mago'], rasgos: ['lanza los penaltis del Betis', 'saca las faltas del Betis'] },
  // Budimir: «el cisne de los Balcanes», que le puso la afición del Crotone (El Gol Digital, 2025)
  'Budimir': { completo: 'Ante Budimir', otros: ['el cisne de los Balcanes'], rasgos: ['es uno de los grandes rematadores de cabeza de LaLiga', 'lanza los penaltis de Osasuna'] },
  'Grimaldo': { completo: 'Alejandro Grimaldo', rasgos: ['es especialista en balón parado, con faltas directas y centros precisos', 'llega al área desde el lateral y golpea con precisión'] },
  'Bartra': { completo: 'Marc Bartra', rasgos: ['es un central que remata de cabeza a balón parado'] },
  'Fermín': { completo: 'Fermín López', corto: 'Fermín', rasgos: ['llega desde segunda línea a posiciones de remate'] },
  // Bellingham: «Bellingol», el mote de la afición en 2023 por sus goles (Fox Sports México, 7 nov 2023)
  'Bellingham': { completo: 'Jude Bellingham', otros: ['Bellingol'], rasgos: ['llega al área desde segunda línea'] },
  // Valverde (nickname «Valverde», id 2430 en LaLiga Fantasy). Fuentes (7 nov): «el Pajarito», en la prensa uruguaya (p. ej. El Observador);
  // «el Halcón», en ESPN Deportes y otros medios; en dic. 2024 dijo, tras el 4-2 al Sevilla, que siempre intenta disparar desde fuera del área
  // porque se le da bien (ESPN Deportes), y ESPN contó entonces que era el jugador de las cinco grandes ligas con más goles desde fuera
  // del área esa temporada (5).
  'Valverde': { completo: 'Federico Valverde', corto: 'Valverde', otros: ['el Pajarito', 'el Halcón'], rasgos: ['dispara muy bien desde fuera del área'] },
  // Segunda tanda (7 nov, ~00:10), pendiente del OK de Carlos. Fuentes en claude/rasgos-propuesta.md.
  // Adeyemi: 3,60 s en 30 m según Opta (Comuniate); «uno de los jugadores más rápidos de Europa», atacando espacios (El Debate, 24 jul 2026; Soccerway)
  'Adeyemi': { completo: 'Karim Adeyemi', rasgos: ['es de los futbolistas más rápidos de Europa y ataca los espacios a la espalda de la defensa'] },
  // Iñaki Williams: «uno de los jugadores más rápidos de la competición» (laliga.com, 15 sep 2021)
  'Iñaki Williams': { rasgos: ['es uno de los jugadores más rápidos de LaLiga'] },
  // Güler: zurdo que corta hacia dentro desde la derecha para chutar o dar el último pase (Wikipedia; buscabiografias.com)
  'Arda Güler': { rasgos: ['es un zurdo que corta hacia dentro para chutar o dar el último pase'] },
  // Chupe: lanza los penaltis (asesoriasfantasy.com; FotMob: 3 goles de penalti en 2025/26; Flashscore, J4 26/27: falló uno ante el Levante)
  'Chupe': { rasgos: ['lanza los penaltis del Málaga'] },
  // Giuliano: «no dar nunca un balón por perdido y luchar hasta el final» (OKDiario, 2026)
  'Giuliano': { completo: 'Giuliano Simeone', rasgos: ['no da un balón por perdido y lucha hasta el final'] },
  // Gordon: «explosivo, muy intenso sin balón y agresivo atacando espacios» (beIN Sports, 27 may 2026)
  'Gordon': { completo: 'Anthony Gordon', rasgos: ['es explosivo y ataca los espacios con mucha intensidad'] },
  // Boyé: hat-trick al Osasuna con dos disparos desde fuera del área (fichajes.net, 8 sep 2026; Misiones Online, 6 sep 2026)
  'Lucas Boyé': { rasgos: ['dispara con potencia desde fuera del área'] },
  // Roberto Fernández (nickname «Roberto», Espanyol): goles «de pícaro», estilo que recuerda a Tamudo (Ara, 3 may 2025)
  'Roberto': { completo: 'Roberto Fernández', rasgos: ['marca goles de pícaro dentro del área'] },
  // Raúl García (nickname «Raúl», Osasuna): 1,92 m (LaLiga); «cada balón en el área como una invitación al gol» (Noticias de Navarra, 18 dic 2025)
  'Raúl': { completo: 'Raúl García', rasgos: ['es un nueve de 1,92 m que vive dentro del área'] },
  // Ez Abde: así le llaman EFE y Wikipedia; el club y la prensa, «Abde» (EFE vía Infobae, 30 oct 2024: «Abde renueva hasta 2029»)
  'Ez Abde': { completo: 'Abde Ezzalzouli', otros: ['Abde'], rasgos: ['es un extremo izquierdo de pierna derecha, rápido y de mucha percusión'] },
};
// apellidos que, solos, no dicen quién es (hay varios en la liga)
const AMBIGUOS = new Set(['martínez', 'martinez', 'romero', 'rodríguez', 'rodriguez', 'gonzález', 'gonzalez', 'santiago', 'garcía', 'garcia', 'pérez', 'perez',
  'lópez', 'lopez', 'sánchez', 'sanchez', 'fernández', 'fernandez', 'gómez', 'gomez', 'díaz', 'diaz', 'hernández', 'hernandez', 'ruiz', 'moreno', 'jiménez', 'jimenez',
  'david', 'rey', 'sarr']);

/** los otros nombres con los que la IA puede llamarle (sin repetir el nickname), o [] */
export function comoLeLlaman(nickname) {
  const n = String(nickname || '').trim();
  if (!n) return [];
  const a = APODOS_JUGADORES[n] || {};
  const out = [a.completo, ...(a.otros || [])].filter(Boolean);
  // «X. Apellido»: el apellido solo, si no es de los que se repiten
  const m = n.match(/^\p{L}{1,2}\.\s+(.+)$/u);
  if (m && !AMBIGUOS.has(m[1].toLowerCase())) out.push(m[1]);
  return [...new Set(out)].filter((x) => x !== n);
}

/** los rasgos a mano de un jugador (por su nickname de LaLiga), o [] */
export const rasgosDe = (nickname) => ((APODOS_JUGADORES[String(nickname || '').trim()] || {}).rasgos || []).slice();

/** la forma corta para la tarjeta (en vez de la inicial), o null */
export const cortoTarjeta = (nombre) => { const a = APODOS_JUGADORES[String(nombre || '').trim()]; return a && a.corto ? a.corto : null; };
