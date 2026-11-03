// solo pruebas: los onces confirmados de la J11 (ya jugada) con la previa de siempre, tratando la J11 como si fuera la actual
import { generar } from '../tipos/previa.mjs';
import { jugadores } from '../lib/laliga.mjs';
import { validar } from '../lib/validar.mjs';
const js = await jugadores();
const out = await generar({ semana: { weekNumber: 11, nextWeek: 11 }, jugadores: js, ventanas: false, forzar: true, probarAcabados: true, log: () => {} });
for (const t of out.filter((x) => x.tipo === 'onces')) { const v = validar(t.texto, { numeros: t.numeros }); console.log(`--- ${t.clave} · ${v.peso} · ${v.ok ? 'válido' : 'FALLA ' + v.errores}\n${t.texto}\n`); }
