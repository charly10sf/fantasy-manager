// De qué país es un jugador, para que la IA pueda decir «el francés» o «el uruguayo» en vez de repetir el nombre (Carlos, 7 nov, 23:40).
// El dato sale de las alineaciones de FotMob (`countryCode` de cada jugador; lib/fotmob.mjs, `leerDetalle` → `paises`): la API de LaLiga no
// lo trae. Solo se usa en el directo, donde ya se pide ese partido a FotMob. Los españoles no llevan: en LaLiga «el español» no distingue a nadie.
import { norm } from './texto.mjs';

// código de FotMob (FIFA) -> gentilicio en masculino. Lo que no está aquí no se dice (mejor sin nacionalidad que mal dicha).
const GENTILICIOS = {
  FRA: 'francés', ARG: 'argentino', BRA: 'brasileño', URU: 'uruguayo', ENG: 'inglés', SCO: 'escocés', WAL: 'galés', IRL: 'irlandés', NIR: 'norirlandés',
  GER: 'alemán', POR: 'portugués', ITA: 'italiano', NED: 'holandés', BEL: 'belga', CRO: 'croata', SRB: 'serbio', TUR: 'turco', MAR: 'marroquí',
  SEN: 'senegalés', NGA: 'nigeriano', GHA: 'ghanés', COL: 'colombiano', CHI: 'chileno', MEX: 'mexicano', USA: 'estadounidense', CAN: 'canadiense',
  JPN: 'japonés', KOR: 'coreano', GEO: 'georgiano', ISL: 'islandés', NOR: 'noruego', SWE: 'sueco', DEN: 'danés', FIN: 'finlandés', SUI: 'suizo',
  AUT: 'austríaco', POL: 'polaco', UKR: 'ucraniano', CZE: 'checo', SVK: 'eslovaco', SVN: 'esloveno', HUN: 'húngaro', ROU: 'rumano', BUL: 'búlgaro',
  GRE: 'griego', ISR: 'israelí', MKD: 'macedonio', BIH: 'bosnio', MNE: 'montenegrino', ALB: 'albanés', KVX: 'kosovar', RUS: 'ruso', ALG: 'argelino',
  TUN: 'tunecino', EGY: 'egipcio', CIV: 'marfileño', CMR: 'camerunés', MLI: 'maliense', GUI: 'guineano', GNB: 'bisauguineano', GAM: 'gambiano',
  LBR: 'liberiano', COD: 'congoleño', ANG: 'angoleño', CPV: 'caboverdiano', GAB: 'gabonés', BFA: 'burkinés', TOG: 'togolés', BEN: 'beninés',
  ECU: 'ecuatoriano', PAR: 'paraguayo', PER: 'peruano', VEN: 'venezolano', BOL: 'boliviano', DOM: 'dominicano', CUB: 'cubano', PAN: 'panameño',
  CRC: 'costarricense', HON: 'hondureño', AUS: 'australiano', NZL: 'neozelandés', IRN: 'iraní', CHN: 'chino', LUX: 'luxemburgués', EQG: 'ecuatoguineano',
};

/** «francés», «uruguayo»… o null (España y lo que no conocemos) */
export const gentilicio = (codigo) => GENTILICIOS[String(codigo || '').trim().toUpperCase()] || null;

/**
 * La nacionalidad (gentilicio) de un jugador del detalle de FotMob: por su id y, si no, por su nombre (el de ESPN, para el asistente), solo si
 * el nombre apunta a un único jugador de las dos plantillas y mejor con el nombre completo igual que con un apellido en común.
 */
export function nacionalidadFm(det, { id = null, nombre = '' } = {}) {
  const xs = (det && det.paises) || [];
  if (!xs.length) return null;
  let p = id != null ? xs.find((x) => String(x.id) === String(id)) : null;
  if (!p && nombre) {
    const n = norm(nombre);
    const iguales = xs.filter((x) => norm(x.nombre) === n);
    if (iguales.length === 1) p = iguales[0];
    else if (!iguales.length) {
      const t = n.split(' ').filter((w) => w.length >= 3), ult = t[t.length - 1];
      const c = xs.filter((x) => { const u = norm(x.nombre).split(' ').filter((w) => w.length >= 3); return ult && u[u.length - 1] === ult; });
      if (c.length === 1) p = c[0];
    }
  }
  return p ? gentilicio(p.codigo) : null;
}

/** si dos jugadores del mismo tuit son de la misma nacionalidad, «el francés» no distingue: ninguno la lleva */
export const sinRepetidas = (a, b) => (a && b && a === b ? [null, null] : [a, b]);
