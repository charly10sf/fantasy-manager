// Colores de cada club para las tarjetas del bot. Copia de la tabla COLORES de web/js/comunes.js (revisada el 30 oct);
// si se cambia allí, cambiarla aquí. [clave del nombre sin tildes, color 1 (camiseta), color 2, dibujo, color 3 opcional].
import { norm } from './texto.mjs';

const COLORES = [
  ['real madrid', '#FFFFFF', '#5E2B97', 'liso'], ['barcelona', '#A50044', '#004D98', 'rayas'], ['atletico', '#CB3524', '#FFFFFF', 'rayas', '#272E61'],
  ['athletic', '#EE2523', '#FFFFFF', 'rayas', '#111111'], ['real sociedad', '#0067B1', '#FFFFFF', 'rayas'], ['betis', '#00954C', '#FFFFFF', 'rayas'],
  ['sevilla', '#FFFFFF', '#D81E05', 'liso'], ['valencia', '#FFFFFF', '#111111', 'liso', '#F18E00'], ['villarreal', '#FFE135', '#005187', 'liso'],
  ['celta', '#8AC3EE', '#FFFFFF', 'liso', '#E1261C'], ['espanyol', '#007FC8', '#FFFFFF', 'rayas'], ['getafe', '#005999', '#FFFFFF', 'liso'],
  ['girona', '#CD2534', '#FFFFFF', 'rayas'], ['levante', '#B4053F', '#005B9E', 'rayas'], ['mallorca', '#E20613', '#111111', 'liso'],
  ['osasuna', '#D91A21', '#0A346F', 'liso'], ['alaves', '#0057B8', '#FFFFFF', 'rayas'], ['elche', '#FFFFFF', '#05642C', 'franja'],
  ['rayo', '#FFFFFF', '#E53027', 'banda'], ['oviedo', '#0047AB', '#FFFFFF', 'liso'], ['las palmas', '#FFE400', '#0057A8', 'liso'],
  ['valladolid', '#FFFFFF', '#6A1B7E', 'rayas'], ['leganes', '#0B4DA2', '#FFFFFF', 'rayas'], ['deportivo', '#00529F', '#FFFFFF', 'rayas'],
  ['racing', '#00843D', '#FFFFFF', 'liso'], ['zaragoza', '#FFFFFF', '#1C3F94', 'liso'], ['sporting', '#D2001F', '#FFFFFF', 'rayas'],
  ['malaga', '#3EA7E0', '#FFFFFF', 'rayas'], ['almeria', '#EE1119', '#FFFFFF', 'rayas'], ['granada', '#C8102E', '#FFFFFF', 'aros'],
  ['cadiz', '#FDE100', '#0045A5', 'liso'], ['eibar', '#A6192E', '#003DA5', 'rayas'], ['huesca', '#A6192E', '#003DA5', 'rayas'],
  ['tenerife', '#FFFFFF', '#004A99', 'liso'], ['cordoba', '#00965E', '#FFFFFF', 'rayas'], ['mirandes', '#D10A11', '#111111', 'liso'],
  ['burgos', '#FFFFFF', '#111111', 'liso'], ['castellon', '#111111', '#FFFFFF', 'rayas'],
];

export const luz = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

/** { c1, c2, c3, vivo, fondo, tinta }: vivo, el primero que no es casi blanco ni casi negro (para brillos); fondo, el que
    pinta la mitad del club en la tarjeta; tinta, el color del texto encima de ese fondo. Sin datos, grises. */
export function coloresClub(nombre = '') {
  const n = ` ${norm(nombre)} `;
  const f = COLORES.find(([clave]) => n.includes(` ${clave} `) || n.includes(` ${clave}`));
  if (!f) return { c1: '#3a3a44', c2: '#ffffff', c3: '#ffffff', vivo: '#6b6b78', fondo: '#3a3a44', tinta: '#ffffff' };
  const [, c1, c2, , c3 = null] = f;
  const vivo = [c1, c2, c3].filter(Boolean).find((c) => { const l = luz(c); return l < 0.8 && l > 0.1; }) || '#6b6b78';
  const fondo = luz(c1) > 0.92 ? vivo : c1;
  return { c1, c2, c3: c3 || c2, vivo, fondo, tinta: luz(fondo) > 0.6 ? '#111114' : '#ffffff' };
}
