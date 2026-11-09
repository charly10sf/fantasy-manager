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

// el país (la selección) en castellano, por el código de FotMob: lo usan los tuits del parón (tipos/selecciones.mjs). Lo que no está
// aquí sale con el nombre que da FotMob (en inglés), así que conviene ir añadiendo los que salgan.
const PAISES = {
  ESP: 'España', FRA: 'Francia', ARG: 'Argentina', BRA: 'Brasil', URU: 'Uruguay', ENG: 'Inglaterra', SCO: 'Escocia', WAL: 'Gales', IRL: 'Irlanda',
  NIR: 'Irlanda del Norte', GER: 'Alemania', POR: 'Portugal', ITA: 'Italia', NED: 'Países Bajos', BEL: 'Bélgica', CRO: 'Croacia', SRB: 'Serbia',
  TUR: 'Turquía', MAR: 'Marruecos', SEN: 'Senegal', NGA: 'Nigeria', GHA: 'Ghana', COL: 'Colombia', CHI: 'Chile', MEX: 'México', USA: 'Estados Unidos',
  CAN: 'Canadá', JPN: 'Japón', KOR: 'Corea del Sur', GEO: 'Georgia', ISL: 'Islandia', NOR: 'Noruega', SWE: 'Suecia', DEN: 'Dinamarca', FIN: 'Finlandia',
  SUI: 'Suiza', AUT: 'Austria', POL: 'Polonia', UKR: 'Ucrania', CZE: 'Chequia', SVK: 'Eslovaquia', SVN: 'Eslovenia', HUN: 'Hungría', ROU: 'Rumanía',
  BUL: 'Bulgaria', GRE: 'Grecia', ISR: 'Israel', MKD: 'Macedonia del Norte', BIH: 'Bosnia', MNE: 'Montenegro', ALB: 'Albania', KVX: 'Kosovo', ALG: 'Argelia',
  TUN: 'Túnez', EGY: 'Egipto', CIV: 'Costa de Marfil', CMR: 'Camerún', MLI: 'Malí', GUI: 'Guinea', GNB: 'Guinea-Bisáu', GAM: 'Gambia', LBR: 'Liberia',
  COD: 'RD del Congo', ANG: 'Angola', CPV: 'Cabo Verde', GAB: 'Gabón', BFA: 'Burkina Faso', TOG: 'Togo', BEN: 'Benín', ECU: 'Ecuador', PAR: 'Paraguay',
  PER: 'Perú', VEN: 'Venezuela', BOL: 'Bolivia', DOM: 'República Dominicana', CUB: 'Cuba', PAN: 'Panamá', CRC: 'Costa Rica', HON: 'Honduras',
  AUS: 'Australia', NZL: 'Nueva Zelanda', IRN: 'Irán', CHN: 'China', LUX: 'Luxemburgo', EQG: 'Guinea Ecuatorial', ARM: 'Armenia', AZE: 'Azerbaiyán',
  KAZ: 'Kazajistán', LVA: 'Letonia', LTU: 'Lituania', EST: 'Estonia', CYP: 'Chipre', MLT: 'Malta', AND: 'Andorra', FRO: 'Islas Feroe', MDA: 'Moldavia',
  BLR: 'Bielorrusia', JAM: 'Jamaica', HAI: 'Haití', SLV: 'El Salvador', GUA: 'Guatemala', KSA: 'Arabia Saudí', QAT: 'Catar', IRQ: 'Irak', RSA: 'Sudáfrica',
  ZAM: 'Zambia', MTN: 'Mauritania', SUR: 'Surinam', CUW: 'Curazao',
};
/** «España», «Francia»… o null */
export const pais = (codigo) => PAISES[String(codigo || '').trim().toUpperCase()] || null;

// La bandera de cada selección (Carlos, 9 nov 10:13: «añadir banderas de los países… y las selecciones también»), solo en los tuits de
// selecciones (tipos/selecciones.mjs y tipos/selecciones-dia.mjs). Código de FotMob (FIFA) -> código ISO de dos letras, que es lo que forma
// el emoji (dos letras regionales: 🇪🇸). Inglaterra, Escocia y Gales tienen su propia bandera (una secuencia con etiquetas); Irlanda del Norte
// no tiene emoji oficial y va sin bandera. Lo que no está aquí, sin bandera.
const ISO2 = {
  ESP: 'ES', FRA: 'FR', ARG: 'AR', BRA: 'BR', URU: 'UY', IRL: 'IE', GER: 'DE', POR: 'PT', ITA: 'IT', NED: 'NL', BEL: 'BE', CRO: 'HR', SRB: 'RS',
  TUR: 'TR', MAR: 'MA', SEN: 'SN', NGA: 'NG', GHA: 'GH', COL: 'CO', CHI: 'CL', MEX: 'MX', USA: 'US', CAN: 'CA', JPN: 'JP', KOR: 'KR', GEO: 'GE',
  ISL: 'IS', NOR: 'NO', SWE: 'SE', DEN: 'DK', FIN: 'FI', SUI: 'CH', AUT: 'AT', POL: 'PL', UKR: 'UA', CZE: 'CZ', SVK: 'SK', SVN: 'SI', HUN: 'HU',
  ROU: 'RO', BUL: 'BG', GRE: 'GR', ISR: 'IL', MKD: 'MK', BIH: 'BA', MNE: 'ME', ALB: 'AL', KVX: 'XK', ALG: 'DZ', TUN: 'TN', EGY: 'EG', CIV: 'CI',
  CMR: 'CM', MLI: 'ML', GUI: 'GN', GNB: 'GW', GAM: 'GM', LBR: 'LR', COD: 'CD', ANG: 'AO', CPV: 'CV', GAB: 'GA', BFA: 'BF', TOG: 'TG', BEN: 'BJ',
  ECU: 'EC', PAR: 'PY', PER: 'PE', VEN: 'VE', BOL: 'BO', DOM: 'DO', CUB: 'CU', PAN: 'PA', CRC: 'CR', HON: 'HN', AUS: 'AU', NZL: 'NZ', IRN: 'IR',
  CHN: 'CN', LUX: 'LU', EQG: 'GQ', ARM: 'AM', AZE: 'AZ', KAZ: 'KZ', LVA: 'LV', LTU: 'LT', EST: 'EE', CYP: 'CY', MLT: 'MT', AND: 'AD', FRO: 'FO',
  MDA: 'MD', BLR: 'BY', JAM: 'JM', HAI: 'HT', SLV: 'SV', GUA: 'GT', KSA: 'SA', QAT: 'QA', IRQ: 'IQ', RSA: 'ZA', ZAM: 'ZM', MTN: 'MR', SUR: 'SR', CUW: 'CW',
};
const BRITANICAS = { ENG: 'gbeng', SCO: 'gbsct', WAL: 'gbwls' };
const etiquetas = (s) => `\u{1F3F4}${[...s].map((c) => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join('')}\u{E007F}`;
/** «🇪🇸», «🇫🇷», «🏴󠁧󠁢󠁥󠁮󠁧󠁿»… o null */
export function bandera(codigo) {
  const c = String(codigo || '').trim().toUpperCase();
  if (BRITANICAS[c]) return etiquetas(BRITANICAS[c]);
  const iso = ISO2[c];
  return iso ? [...iso].map((l) => String.fromCodePoint(0x1F1E6 + l.charCodeAt(0) - 65)).join('') : null;
}
/** todas las banderas que pueden salir (para el validador: lib/redaccion.mjs) */
export const BANDERAS = new Set([...Object.keys(ISO2), ...Object.keys(BRITANICAS)].map(bandera));
/** las banderas de un texto, enteras (las dos letras regionales, o la negra con sus etiquetas) */
export const banderasEn = (s) => [...String(s).matchAll(/[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}[\u{E0061}-\u{E007A}]+\u{E007F}/gu)].map((m) => m[0]);
/** el escudo de una selección en FotMob es su bandera, redonda (192 x 192; comprobado el 9 nov con España, id 6720) */
export const banderaUrl = (idFm) => (idFm != null && /^\d+$/.test(String(idFm)) ? `https://images.fotmob.com/image_resources/logo/teamlogo/${idFm}.png` : null);
