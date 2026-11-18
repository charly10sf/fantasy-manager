// (0.8a, Carlos 17 nov) los nombres de los rivales aproximados (lo que escribe el dictado: «leao ere espabilado» por
// «Leao er Espabilao») y los apodos que pone cada uno: la pregunta llega a la IA tapada con el alias bueno y, si el
// nombre venía aproximado, con la nota para que diga a quién entiende. Lo que no es un rival (jugadores, palabras) no se toca.
// Uso: node .github/ia/caso-apodos.mjs   (PW_MODULO como en prueba-web.mjs). Sale con 1 si algo falla.
import { pagina, cerrar } from './banco.mjs';

const P = await pagina('martes');
let mal = 0;
try {
  const r = await P.page.evaluate(async () => {
    const I = await import('./js/ia.js'), A = await import('./js/apodos.js');
    const D = JSON.parse(JSON.stringify(window.S.D));
    D.clasif.find((e) => e.teamId === '510').nombre = 'Leao er Espabilao';
    A.ponerApodo('508', 'el Tito, Titón');
    const sd = I.seudonimos(D);
    const t = (c) => sd.taparPregunta(c);
    const o = {
      dictado: t('¿Qué ha fichado leao ere espabilado esta semana?'),
      otraForma: t('que tiene leao el espabilao'),
      apodo: t('¿Cuánto dinero le queda al Tito?'),
      apodo2: t('y titón qué?'),
      jugadores: t('¿Vendo a Oyarzabal o a Camello?'),
      sinDel: t('hercules de henares'),
      palabra: t('el portero es espabilado'),
      destapa: sd.destapar('Rival 2 anda por 12 M. Rival 2 no llega. Equipo 5 sí.'),
      json: sd.destapar('{"x":"Rival 2"}', { json: true }),
      // (19 nov) «de el Tito» y «a el Tito», contraídos
      contrae: sd.destapar('Los de Rival 2 no. Ofrécele a Rival 2 unos 20 M. Del Rival 2, nada.'),
    };
    A.ponerApodo('508', '');
    o.sinApodo = I.seudonimos(D).taparPregunta('¿Cuánto dinero le queda al Tito?');
    return o;
  });
  const ok = (c, txt) => { console.log(`${c ? 'BIEN' : 'MAL '} ${txt}`); if (!c) mal++; };
  ok(/Equipo 5/.test(r.dictado.t) && /aproximada: se refiere a Equipo 5/.test(r.dictado.nota), `el dictado «leao ere espabilado» es Equipo 5, con la nota (${r.dictado.t})`);
  ok(/Equipo 5/.test(r.otraForma.t), `«leao el espabilao» también (${r.otraForma.t})`);
  ok(/Rival 2/.test(r.apodo.t) && !r.apodo.nota, `el apodo «el Tito» vale como «al Tito» (${r.apodo.t})`);
  ok(/Rival 2/.test(r.apodo2.t), `los apodos van separados por comas: «Titón» (${r.apodo2.t})`);
  ok(r.jugadores.t === '¿Vendo a Oyarzabal o a Camello?' && !r.jugadores.nota, 'los jugadores no se tocan');
  ok(/Equipo 2/.test(r.sinDel.t), `«hercules de henares» es Hércules del Henares (${r.sinDel.t})`);
  ok(r.palabra.t === 'el portero es espabilado' && !r.palabra.nota, 'una palabra suelta del nombre no se toca');
  ok(r.destapa === 'el Tito (Marcos) anda por 12 M. el Tito no llega. Leao er Espabilao sí.', `la respuesta sale con el apodo (${r.destapa})`);
  ok(r.json === '{"x":"Marcos"}', 'en el plan (JSON), el nombre de LaLiga');
  ok(r.contrae === 'Los del Tito (Marcos) no. Ofrécele al Tito unos 20 M. Del Tito, nada.', `«del Tito» y «al Tito», no «de el» ni «a el» (${r.contrae})`);
  ok(!/Rival 2/.test(r.sinApodo.t), 'sin el apodo, «el Tito» ya no es nadie');
  ok(!P.errores.length, `sin errores en la página${P.errores.length ? `: ${P.errores[0]}` : ''}`);
} finally { await P.cerrar(); await cerrar(); }
console.log(mal ? `${mal} MAL` : 'Todo BIEN');
process.exit(mal ? 1 : 0);
