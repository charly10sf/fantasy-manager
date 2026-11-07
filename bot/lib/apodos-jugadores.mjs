// Cómo se llama de verdad a un jugador (Carlos, 7 nov 15:47: «no siempre poner C. Romero sino el Cuti o los apodos que tengas, hay muchos
// jugadores en esa tesitura»). LaLiga Fantasy da a muchos un «nickname» con la inicial («B. Iglesias», «F. De Jong») y la tarjeta, si el
// nombre no cabe, también abrevia («Cuti Romero» -> «C. ROMERO»). Aquí, por el nickname de LaLiga:
//   completo: el nombre con el que sale en la prensa («Borja Iglesias»)
//   corto: la forma corta para la tarjeta cuando el nombre no cabe, en vez de la inicial («Cuti»)
//   otros: apodos que la IA puede usar alguna vez («el Panda»)
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
  'Lamine Yamal': { corto: 'Lamine', otros: ['Lamine'] },
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

/** la forma corta para la tarjeta (en vez de la inicial), o null */
export const cortoTarjeta = (nombre) => { const a = APODOS_JUGADORES[String(nombre || '').trim()]; return a && a.corto ? a.corto : null; };
