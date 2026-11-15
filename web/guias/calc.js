// Las calculadoras de las guías (subir-clausula.html y cuanto-pujar.html): sin cuenta y sin datos de nadie, todo en el navegador.
// Las mismas reglas que la app (web/js/motor.js) y que la calculadora de la portada (web/js/portada.js):
//  - cláusula: subirla X cuesta X/2 y solo con saldo; el objetivo es pasar un 3 % lo que puede gastar el rival más rico, sin pasar
//    de lo más que se paga en tu liga por una cláusula (+5 %); no compensa si cuesta más de 1/4 de lo que vale;
//  - clausular: el sobreprecio (cláusula − valor) frente a lo que sube al día; la cláusula se paga entera con saldo;
//  - puja: el margen de la app (2 % + lo que suman las pujas que lleva + lo que sube al día) mezclado con lo que se paga en tu liga
//    (un 80 % de peso), redondeada hacia arriba a 10.000 € y con una cola de 3.000 € para no coincidir con las cifras redondas; el
//    límite es el saldo más el margen de deuda menos lo ya pujado.
(() => {
  'use strict';
  const NF = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const NE = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });
  const M = (v) => `${NF.format(v)} M`;
  const E = (v) => `${NE.format(Math.round(v))} €`;
  const num = (el) => { if (!el) return null; const s = String(el.value || '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  /** la cláusula: hasta dónde subirla y lo que cuesta (en M) */
  function clausula({ valor, clausula: c, rico, pagaPct = 50, saldo = null, corto = false, blindaje = false }) {
    const hasta = (x) => Math.ceil(Math.max(x, 0) * 1.03 * 10 - 1e-6) / 10;   // a 100.000 €, como motor.js y la portada
    const techo = hasta(valor * (1 + pagaPct / 100 + 0.05));
    const T0 = hasta(rico), T = Math.min(T0, techo);
    const tope = valor / 4;
    const out = { techo, tope };
    if (c >= techo) return { ...out, clase: 'bien', cifra: 'Ya está a salvo', txt: `Su cláusula pasa de lo más que se paga en tu liga por una cláusula (${M(techo)}). No gastes en ella.` };
    if (T <= c) return { ...out, clase: 'bien', cifra: 'Ya está a salvo', txt: rico > 0 ? `Al rival más rico no le llega: tiene ${M(rico)} y la cláusula está en ${M(c)}. Vigila si vende a alguien: con un 3 % más de lo que tiene ya podría.` : 'Ningún rival tiene saldo para pagarla ahora mismo.' };
    const coste = Math.ceil(((T - c) / 2) * 100 - 1e-6) / 100;
    const caro = coste > tope;
    const lineas = [`Súbela de ${M(c)} a ${M(T)}: la subes ${M(T - c)} y pagas la mitad, ${M(coste)}.`,
      T < T0 ? `No hace falta llegar a lo que tiene el más rico (${M(rico)}): en tu liga nadie paga más de un ${NE.format(pagaPct)} % sobre el valor por una cláusula, y con ${M(T)} ya está por encima.` : `Con ${M(T)} ya no le llega al más rico, que tiene ${M(rico)} (se deja un 3 % de margen por si vende algo).`,
      `El tope para que compense es una cuarta parte de lo que vale: ${M(tope)}.`];
    if (saldo != null && saldo < coste) lineas.push(`Ahora no te llega: tienes ${M(saldo)} y subirla solo se puede pagar con saldo, sin deuda.`);
    if (caro) {
      const alt = [corto && blindaje ? 'Si el peligro es solo hasta mañana, usa el blindaje: es gratis y lo cubre 24 horas.' : null,
        `Si te lo clausulan, te llevas ${M(c)}, que es ${M(c - valor)} ${c >= valor ? 'más' : 'menos'} de lo que vale. Con ese dinero puedes fichar a otro.`,
        'Si está bajando, venderlo puede ser mejor que protegerlo.'].filter(Boolean);
      return { ...out, clase: 'mal', cifra: `No compensa: ${M(coste)}`, txt: `Dejarlo fuera del alcance de todos exige subirla de ${M(c)} a ${M(T)}, y eso cuesta ${M(coste)}.`, lista: [lineas[1], `Es más de una cuarta parte de lo que vale (${M(tope)}).`, ...alt] };
    }
    if (corto && blindaje) return { ...out, clase: 'bien', cifra: 'Blíndalo hoy, gratis', txt: `El peligro es de un día y te queda un blindaje: úsalo y deja la subida para después. Si al final hay que pagar, súbela a ${M(T)} por ${M(coste)}.`, lista: lineas.slice(1) };
    return { ...out, clase: saldo != null && saldo < coste ? 'mal' : 'bien', cifra: `Súbela a ${M(T)} · te cuesta ${M(coste)}`, txt: lineas[0], lista: lineas.slice(1) };
  }

  /** ¿compensa clausular? (valor, cláusula, saldo y pujado en M; subida en € al día) */
  function clausular({ valor, clausula: c, subida = 0, saldo = null, pujado = 0 }) {
    const sobre = c - valor, pct = valor > 0 ? (sobre / valor) * 100 : 0;
    const dias = subida > 0 ? Math.ceil((sobre * 1e6) / subida) : null;
    const lista = [`Pagas ${M(sobre)} por encima de lo que vale (${NE.format(pct)} % más).`];
    if (subida > 0) lista.push(`A ${E(subida)} al día, su valor llega a lo que pagas en ${dias} ${dias === 1 ? 'día' : 'días'}, si la racha sigue.`);
    else lista.push('Si no sube, ese sobreprecio lo pierdes el mismo día: venderlo te daría algo cerca de su valor, no de su cláusula.');
    if (saldo != null) {
      const queda = saldo - c - (pujado || 0);
      if (saldo < c) return { clase: 'mal', cifra: 'No te llega', txt: `La cláusula se paga entera con saldo, sin deuda: tienes ${M(saldo)} y cuesta ${M(c)}.`, lista };
      lista.push(queda >= 0 ? `Te quedan ${M(queda)}${pujado ? ' contando lo que ya tienes pujado' : ''}: llegas a la jornada en positivo.` : `Te quedarías en ${M(queda)} si ganas lo que tienes pujado: tendrías que vender antes de la jornada o no puntúas.`);
    }
    if (sobre <= valor * 0.02) return { clase: 'bien', cifra: 'Compensa: es como comprarlo', txt: 'La cláusula está prácticamente en su valor: es como ficharlo en el mercado, pero sin que nadie te lo pueda quitar con una puja.', lista };
    if (dias != null && dias <= 7) return { clase: 'bien', cifra: `Compensa si sigue subiendo (${dias} ${dias === 1 ? 'día' : 'días'})`, txt: 'Recuperas el sobreprecio en una semana o menos. Comprueba antes que es titular y que no está tocado.', lista };
    if (dias != null && dias <= 14) return { clase: '', cifra: `Depende: ${dias} días para recuperarlo`, txt: 'Más de una semana de racha es mucho pedir. Compensa si entra en tu once y te da puntos mientras tanto.', lista };
    return { clase: 'mal', cifra: 'Solo si cambia tu once', txt: dias ? `Necesitaría ${dias} días seguidos subiendo para cubrir lo que pagas de más, y las rachas rara vez duran tanto.` : 'Sin subida, solo compensa si es un jugador que de verdad cambia tu once y no hay otro parecido en el mercado.', lista };
  }

  /** la puja (valor, saldo, equipo y pujado en M; subida en € al día; liga en % sobre el valor) */
  function puja({ valor, subida = 0, cambios = 1, ligaMin = null, ligaMax = null, buscado = 'normal', pujas = 0, saldo = null, equipo = null, deudaPct = 20, pujado = 0, para = 'once' }) {
    const v = valor * 1e6;
    const porPuja = Math.max(0.025, 100000 / v);
    const p1 = v > 0 ? (subida / v) * 100 : 0;
    let margen = 0.02 + Math.min(pujas, 5) * porPuja + (p1 > 0 ? Math.min(p1, 4) / 100 : 0) + (buscado === 'mucho' ? 0.03 : 0);
    let liga = null;
    if (ligaMin != null || ligaMax != null) {
      const a = (ligaMin ?? ligaMax) / 100, b = (ligaMax ?? ligaMin) / 100;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      // como la app: más arriba cuanto más lo buscan y cuantas más pujas lleva (cada una, 5 puntos más de cuantil, hasta el 90 %)
      const nivel = Math.min(0.9, ({ poco: 0.25, normal: 0.5, mucho: 0.75 }[buscado] ?? 0.5) + Math.min(pujas, 5) * 0.05);
      liga = lo + (hi - lo) * nivel;
      margen = 0.2 * margen + 0.8 * liga;
    }
    const base = Math.ceil((v * (1 + margen)) / 10000) * 10000;
    const p = base + 3000;
    const valorJ = v + Math.max(0, subida) * Math.max(0, cambios);
    const lista = [`Es un ${NE.format(((p - v) / v) * 100)} % sobre su valor (${E(p - v)} más).`];
    if (liga != null) lista.push(`En tu liga se paga entre un ${NE.format(Math.min(ligaMin ?? ligaMax, ligaMax ?? ligaMin))} y un ${NE.format(Math.max(ligaMin ?? ligaMax, ligaMax ?? ligaMin))} %; para uno ${buscado === 'mucho' ? 'muy buscado' : buscado === 'poco' ? 'que busca poca gente' : 'normal'}${pujas ? ` y con ${pujas} ${pujas === 1 ? 'puja' : 'pujas'}` : ''}, la app apunta a un ${NE.format(liga * 100)} %.`);
    if (subida > 0 && cambios > 0) lista.push(`Con ${cambios} ${cambios === 1 ? 'cambio' : 'cambios'} de mercado hasta la jornada y ${E(subida)} al día, valdrá unos ${E(valorJ)} cuando lo alinees: pagas ${E(p - valorJ)} por encima de eso${p - valorJ <= 0 ? ' (nada: la subida lo cubre)' : ''}.`);
    lista.push('La cola de 3.000 € es para no coincidir con los que pujan una cifra redonda: cuesta casi lo mismo y gana el empate.');
    if (para === 'revender' && p - valorJ > 0) lista.push(`Para revenderlo no sale: pagas más de lo que va a subir hasta la jornada (${E(Math.max(0, valorJ - v))}).`);
    let clase = 'bien', aviso = '';
    if (saldo != null) {
      const deuda = equipo != null ? (equipo * (deudaPct || 0)) / 100 : 0;
      const max = (saldo + deuda - (pujado || 0)) * 1e6;
      const queda = (saldo - (pujado || 0)) * 1e6 - p;
      if (p > max) { clase = 'mal'; aviso = `No te llega: con tu saldo${equipo != null ? ' y el margen de deuda' : ''}${pujado ? ', quitando lo ya pujado,' : ''} puedes pujar hasta ${E(Math.max(0, max))}.`; }
      else if (queda < 0) aviso = `Si la ganas, te quedas en ${E(queda)}${pujado ? ' (contando todo lo que tienes pujado, por si ganas todas)' : ''}: tendrás que vender antes de que empiece la jornada o no puntúas.`;
      else lista.push(`Si la ganas, te quedan ${E(queda)}${pujado ? ' contando todo lo que tienes pujado' : ''}.`);
    }
    return { clase, cifra: `Puja ${E(p)}`, txt: aviso || `La puja mínima es su valor, ${E(v)}.`, lista };
  }

  const CALC = { clausula, clausular, puja };
  const leer = (f) => {
    const o = {};
    for (const el of f.querySelectorAll('[data-k]')) o[el.dataset.k] = el.tagName === 'SELECT' ? el.value : num(el);
    return o;
  };
  const REQ = { clausula: ['valor', 'clausula', 'rico'], clausular: ['valor', 'clausula'], puja: ['valor'] };
  function pintar(f) {
    const tipo = f.dataset.calc, o = leer(f), res = f.querySelector('.calc-res');
    const falta = REQ[tipo].filter((k) => o[k] == null);
    const mal = Object.entries(o).filter(([, x]) => typeof x === 'number' && (Number.isNaN(x) || x < 0)).map(([k]) => k);
    if (mal.length) { res.innerHTML = '<p class="peq">Revisa las cifras: solo números (con coma para los decimales) y sin negativos.</p>'; return; }
    if (falta.length) { res.innerHTML = '<p class="peq">Rellena las casillas de arriba y verás el resultado aquí.</p>'; return; }
    for (const k of Object.keys(o)) if (o[k] === null) delete o[k];
    if (tipo === 'clausula') { o.corto = o.corto === 'si'; o.blindaje = o.blindaje === 'si'; }
    const r = CALC[tipo](o);
    res.innerHTML = `<p class="cifra${r.clase === 'mal' ? ' mal' : ''}">${esc(r.cifra)}</p><p>${esc(r.txt)}</p>${r.lista && r.lista.length ? `<ul>${r.lista.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}`;
  }
  for (const f of document.querySelectorAll('form.calc[data-calc]')) {
    f.addEventListener('input', () => pintar(f));
    f.addEventListener('change', () => pintar(f));
    f.addEventListener('submit', (ev) => { ev.preventDefault(); pintar(f); });
    pintar(f);
  }
  if (typeof window !== 'undefined') window.calcFM = CALC;   // para las pruebas
})();
