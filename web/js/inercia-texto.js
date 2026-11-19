/* El texto de la inercia de un jugador (cómo se mueve su valor estos días), aparte de las cuentas (19 nov, sesión larga):
   motor.js (M.inercia) calcula la fase, lo que sube o baja cada día y lo que se espera; aquí solo se dice con palabras.
   Lo leen la ficha del jugador, Hoy, el plan y lo que se le pasa a la IA (x.texto). */
import { eur, pct } from './util.js';

/**
 * x: { fase, Rs (lo que cambió cada día, los últimos), ult, subida (los días de subida de antes), baja (días seguidos
 * bajando), giroEn, rebote, quieto, hastaJ, perdidaJ (lo que se espera que cambie hasta la jornada, en negativo si baja),
 * vu (el que vuelve: { max, racha, ritmo }), frenaba }
 */
export function textoInercia(x) {
  const { fase, Rs, ult, subida, baja, giroEn, rebote, quieto, hastaJ, perdidaJ, vu, frenaba } = x;
  const fmt = (v) => eur(v, { signo: true });
  const dias = (n) => `${n} día${n > 1 ? 's' : ''}`;
  let texto = '';
  if (fase === 'giro') texto = `Ha girado a la baja: venía subiendo (${subida.slice(-4).map(fmt).join(', ')} al día) y ${baja >= 2 ? `ya lleva ${baja} días bajando (hoy ${fmt(ult)})` : `hoy ${fmt(ult)}`}. Si sigue así, en ${dias(hastaJ)} pierde unos ${eur(-perdidaJ)}.`;
  else if (fase === 'rebote') texto = `Viene de bajar un ${Math.round(rebote.caida * 100)} % en el último mes (de ${eur(rebote.max)} a ${eur(rebote.min)}) y estos días ha rebotado un poco (${subida.slice(-4).map(fmt).join(', ')}${Math.abs(ult) <= quieto ? `; hoy ${fmt(ult)}, se ha parado` : ', cada vez menos'}). Es un rebote pequeño después de mucho bajar, no una subida que se vaya a dar la vuelta: puede estar tocando fondo o seguir bajando, así que esto solo no es motivo para venderlo.`;
  else if (fase === 'parado') texto = `Se ha estancado después de subir (${subida.slice(-4).map(fmt).join(', ')} y hoy ${fmt(ult)}): lo normal es que ahora empiece a bajar.`;
  else if (fase === 'frena') texto = `Sube cada vez menos (${Rs.slice(-3).map(fmt).join(', ')} al día): a este ritmo deja de subir en unos ${Math.max(1, Math.round(giroEn))} día${Math.round(giroEn) > 1 ? 's' : ''} y luego bajará.`;
  else if (fase === 'baja') texto = `Baja ${fmt(ult)} al día${baja >= 2 ? ` (${baja} días seguidos)` : ''}: en ${dias(hastaJ)} perdería unos ${eur(-perdidaJ)}.`;
  else if (fase === 'acelera') texto = `Sube cada vez más (${Rs.slice(-3).map(fmt).join(', ')} al día).`;
  else if (fase === 'sube') texto = `Sube ${fmt(ult)} al día.`;
  if (vu && (fase === 'sube' || fase === 'acelera')) texto = `${texto ? `${texto} ` : ''}Llegó a valer ${eur(vu.max)} esta temporada, vuelve a jugar y lleva ${vu.racha} días subiendo (un ${pct(vu.ritmo * 100, 1, false)} al día de media los 3 últimos)${frenaba ? '; hoy algo menos que ayer, pero le queda mucho para su valor de antes' : ''}.`;
  return texto;
}
