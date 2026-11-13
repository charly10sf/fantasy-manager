// Prueba sin red del tuit de mercado (bot/tipos/mercado.mjs): el chollo no repite en los días siguientes (Carlos, 13 nov: Redondo
// salía de chollo cada noche), vale también con lo publicado antes de la huella (por el nombre en los últimos tuits), y las rachas.
//   node bot/prueba/mercado-ejemplo.mjs
import { chollo, cholloVetados, nombreEn, DIAS_SIN_REPETIR_CHOLLO } from '../tipos/mercado.mjs';

let fallos = 0;
const falla = (m) => { fallos++; console.log(`FALLA: ${m}`); };
const ahora = Date.parse('2026-11-13T23:16:00Z');
const hace = (d) => new Date(ahora - d * 864e5).toISOString();

const f = (id, nombre, nuevo, media) => ({ id, nombre, nuevo, media, puntos: 40, ok: true, pct: 3 });
const suben = [f(1, 'Redondo', 2.3e6, 4.5), f(2, 'Niño', 4.2e6, 6.4), f(3, 'Pol Sanz', 6e6, 5)];

// sin nada publicado, el de más media por millón
if ((chollo(suben) || {}).nombre !== 'Redondo') falla('sin registro, el chollo tendría que ser Redondo');

// por el nombre en los tuits de antes de la huella
const reg = (enviados, recientes) => ({ datos: { enviados, recientes: { mercado: recientes } } });
let v = cholloVetados(reg([], [{ t: hace(1), texto: 'Para quien busque barato, Redondo, del Elche 🌴, cuesta 2,3 M' }]), ahora);
if ((chollo(suben, v) || {}).nombre !== 'Niño') falla('Redondo salió ayer: hoy tendría que ser Niño');

// por la huella (aunque el texto lo llame de otra forma)
v = cholloVetados(reg([{ tipo: 'mercado', t: hace(2), huella: { clase: 'mercado', chollo: '1' } }, { tipo: 'mercado', t: hace(1), huella: { clase: 'mercado', chollo: '2' } }], []), ahora);
if ((chollo(suben, v) || {}).nombre !== 'Pol Sanz') falla('con Redondo y Niño en la huella, tendría que ser Pol Sanz');

// pasados los días, puede volver
v = cholloVetados(reg([{ tipo: 'mercado', t: hace(DIAS_SIN_REPETIR_CHOLLO + 1), huella: { clase: 'mercado', chollo: '1' } }],
  [{ t: hace(DIAS_SIN_REPETIR_CHOLLO + 1), texto: 'Redondo, chollo' }]), ahora);
if ((chollo(suben, v) || {}).nombre !== 'Redondo') falla(`a los ${DIAS_SIN_REPETIR_CHOLLO + 1} días Redondo tendría que poder volver`);

// todos vetados: sin chollo
v = cholloVetados(reg([], [{ t: hace(1), texto: 'Redondo, Niño y Pol Sanz' }]), ahora);
if (chollo(suben, v) !== null) falla('con todos vetados no tiene que haber chollo');

// el nombre, como palabra y sin tildes; «redondo» en minúscula dentro de otra palabra no cuenta
if (!nombreEn('Niño', 'el chollo es NINO hoy')) falla('Niño sin tilde y en mayúsculas');
if (nombreEn('Rodri', 'Rodrigo sube')) falla('Rodri no es Rodrigo');
if (nombreEn('Ez', 'Ez Abde')) falla('nombres de menos de 3 letras no cuentan');

// la tarjeta de huella se guarda con el registro: marcar la copia entera
const { Registro } = await import('../lib/registro.mjs');
const r = new Registro({ topes: {} });
r.marcar({ clave: 'mercado|2026-11-14', tipo: 'mercado', jornada: 13, huella: { clase: 'mercado', chollo: '2' } }, '1');
if (!cholloVetados(r, Date.now()).ids.has('2')) falla('la huella del chollo no queda en el registro');

if (fallos) { console.log(`${fallos} MAL`); process.exit(1); }
console.log('Todo BIEN');
