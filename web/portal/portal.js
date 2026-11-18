// El JS ligero de las páginas públicas (lo carga cada página que genera .github/paginas.py). Todo se lee sin él:
// 1. el buscador del menú es un formulario normal que lleva a jugadores/?q=; con JS sugiere fichas de jugadores y equipos
//    (jugadores/indice.json, lo escribe bot/portal-web.mjs cada noche);
// 2. en jugadores/, la tabla con todos va entera y ordenada por valor; con JS se filtra por puesto, equipo y nombre, se ordena
//    por valor, puntos, media o subida y se enseña por tandas.
(function () {
  'use strict';
  var plano = function (s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); };
  var POS = { 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' };

  // ---------------------------------------------------------------- la cabecera fija (16 nov): los saltos de la página van
  // justo debajo (sin JS, con el alto de siempre del CSS)
  var cab = document.querySelector('.cab');
  if (cab) {
    var alto = function () { document.documentElement.style.setProperty('--cab-h', (cab.offsetHeight - 1) + 'px'); };
    alto();
    window.addEventListener('resize', alto, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(alto).observe(cab);
  }

  // ---------------------------------------------------------------- el buscador
  var form = document.querySelector('form.busca');
  if (form) {
    var raiz = form.getAttribute('data-raiz') || '';
    var input = form.querySelector('input');
    var lista = form.querySelector('.busca-r');
    var indice = null, pidiendo = null, resultados = [], activo = -1;
    var cargar = function () {
      if (indice || pidiendo) return pidiendo;
      pidiendo = fetch(raiz + 'jugadores/indice.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          indice = [];
          if (!d) return;
          (d.e || []).forEach(function (q) { indice.push({ t: q[0], s: 'Equipo', r: q[2], k: plano(q[0] + ' ' + q[1]) }); });
          (d.j || []).forEach(function (x) { indice.push({ t: x[0], s: (POS[x[4]] || '') + ' · ' + x[3], r: x[2], k: plano(x[0] + ' ' + x[1]) }); });
        }).catch(function () { indice = []; });
      return pidiendo;
    };
    var pintar = function () {
      var q = plano(input.value);
      lista.textContent = '';
      activo = -1;
      if (q.length < 2 || !indice) { lista.hidden = true; resultados = []; return; }
      var pal = q.split(/\s+/);
      resultados = indice.filter(function (x) { return pal.every(function (p) { return x.k.indexOf(p) >= 0; }); })
        .sort(function (a, b) { return (a.k.indexOf(q) === 0 ? 0 : 1) - (b.k.indexOf(q) === 0 ? 0 : 1); }).slice(0, 8);
      resultados.forEach(function (x, i) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = raiz + x.r;
        a.id = 'busca-' + i;
        var b = document.createElement('b'); b.textContent = x.t;
        var s = document.createElement('small'); s.textContent = x.s;
        a.appendChild(b); a.appendChild(s); li.appendChild(a); lista.appendChild(li);
      });
      if (!resultados.length) {
        var li2 = document.createElement('li');
        li2.className = 'nada';
        li2.textContent = 'Sin ficha con ese nombre: Enter para buscar en todos';
        lista.appendChild(li2);
      }
      lista.hidden = false;
    };
    var marcar = function (i) {
      var as = lista.querySelectorAll('a');
      if (!as.length) return;
      activo = (i + as.length) % as.length;
      as.forEach(function (a, k) { a.classList.toggle('activo', k === activo); });
      input.setAttribute('aria-activedescendant', as[activo].id);
    };
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    lista.id = 'busca-lista';
    lista.setAttribute('role', 'listbox');
    input.setAttribute('aria-controls', 'busca-lista');
    input.addEventListener('focus', cargar);
    input.addEventListener('input', function () { (cargar() || Promise.resolve()).then(function () { pintar(); input.setAttribute('aria-expanded', String(!lista.hidden)); }); });
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); marcar(activo + 1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); marcar(activo - 1); }
      else if (ev.key === 'Escape') { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); }
    });
    form.addEventListener('submit', function (ev) {
      var r = resultados[activo >= 0 ? activo : 0];
      // con una sugerencia (o una sola coincidencia), a su ficha; si no, a la tabla de todos filtrada
      if (r && (activo >= 0 || resultados.length === 1)) { ev.preventDefault(); location.href = raiz + r.r; }
    });
    document.addEventListener('click', function (ev) { if (!form.contains(ev.target)) { lista.hidden = true; input.setAttribute('aria-expanded', 'false'); } });
    // en el móvil, al abrir la lupa, el cursor al cuadro
    var t = document.getElementById('busca-t');
    if (t) t.addEventListener('change', function () { if (t.checked) setTimeout(function () { input.focus(); }, 30); });
  }

  // ---------------------------------------------------------------- la tabla de todos los jugadores
  var tabla = document.getElementById('todos');
  var filtros = document.getElementById('filtros');
  if (!tabla || !filtros) return;
  var cuerpo = tabla.tBodies[0];
  var filas = Array.prototype.slice.call(cuerpo.rows);
  // (16 nov) sin JS la tabla va por páginas de 150 y sin caras; con JS se rehace con todos (jugadores/todos.json) y sus caras
  var hazFila = function (x) {
    var tr = document.createElement('tr');
    var d = tr.dataset;
    d.p = String(x[3]); d.e = x[4]; d.v = String(x[5]); d.pt = String(x[6]); d.m = String(x[7]); d.d = String(x[8]); d.d7 = String(x[9]); d.n = x[10];
    var td = function (cls, hijo) { var c = document.createElement('td'); c.className = cls; if (typeof hijo === 'string') c.textContent = hijo; else if (hijo) c.appendChild(hijo); tr.appendChild(c); return c; };
    var cambio = function (n, t) { var s = document.createElement('span'); s.className = n > 0 ? 'sube' : n < 0 ? 'baja' : 'igual'; s.textContent = (n > 0 ? '▲ ' : n < 0 ? '▼ ' : '= ') + t; return s; };
    var div = document.createElement('div'); div.className = 'tjug';
    var w = document.createElement('span'); w.className = 'ava-w ava-p';
    var a = document.createElement('span'); a.className = 'ava p' + x[3];
    var ini = document.createElement('span'); ini.className = 'ini'; ini.setAttribute('aria-hidden', 'true');
    ini.textContent = String(x[1] || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase();
    a.appendChild(ini);
    if (x[15]) {
      var im = document.createElement('img'); im.className = 'cara' + (x[16] ? ' enc' : ''); im.src = x[15]; im.alt = ''; im.width = 36; im.height = 36;
      if (x[16]) im.setAttribute('style', x[16]);
      im.loading = 'lazy'; im.decoding = 'async'; im.referrerPolicy = 'no-referrer'; a.appendChild(im);
    }
    w.appendChild(a);
    if (x[17]) { var es = document.createElement('img'); es.className = 'esc'; es.src = x[17]; es.alt = x[18]; es.width = 20; es.height = 20; es.loading = 'lazy'; es.decoding = 'async'; es.referrerPolicy = 'no-referrer'; w.appendChild(es); }
    var t = document.createElement('span'); t.className = 'tjug-t';
    var b = document.createElement('b');
    if (x[0]) { var en = document.createElement('a'); en.href = x[0]; en.textContent = x[1]; b.appendChild(en); } else b.textContent = x[1];
    var sm = document.createElement('small'); sm.textContent = x[2];
    t.appendChild(b); t.appendChild(sm); div.appendChild(w); div.appendChild(t);
    td('c-j', div); td('n', x[11]); td('n c-d', cambio(x[8], x[12])); td('n m c-d7', cambio(x[9], x[13])); td('n c-pt', String(x[6])); td('n c-me', x[14]);
    return tr;
  };
  var cargarTodos = function () {
    var u = tabla.getAttribute('data-todos');
    if (!u || !window.fetch) return Promise.resolve();
    return fetch(u, { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (xs) {
      if (!Array.isArray(xs) || !xs.length) return;
      var nuevas = xs.map(hazFila);
      cuerpo.textContent = '';
      nuevas.forEach(function (f) { cuerpo.appendChild(f); });
      filas = nuevas;
      var pg = document.getElementById('paginas');
      if (pg) pg.hidden = true;
    }).catch(function () { /* sin la lista, la tabla de esta página */ });
  };
  var cuenta = document.getElementById('cuenta');
  var mas = document.getElementById('ver-mas');
  var TANDA = 60;
  var visibles = TANDA;
  var est = { p: '', e: '', o: 'v', q: '' };
  var params = new URLSearchParams(location.search);
  est.q = params.get('q') || '';
  est.p = params.get('p') || '';
  est.e = params.get('e') || '';
  if (['v', 'pt', 'm', 'd', 'd7'].indexOf(params.get('o')) >= 0) est.o = params.get('o');
  var q = filtros.elements.q, sel = filtros.elements.e, ord = filtros.elements.o;
  q.value = est.q; sel.value = est.e; ord.value = est.o;
  var botones = filtros.querySelectorAll('.f-pos button');
  filtros.hidden = false;
  document.documentElement.classList.add('con-js');

  var aplicar = function (reiniciar) {
    if (reiniciar) visibles = TANDA;
    var pq = plano(est.q).split(/\s+/).filter(Boolean);
    var ok = filas.filter(function (f) {
      var d = f.dataset;
      return (!est.p || d.p === est.p) && (!est.e || d.e === est.e) && pq.every(function (p) { return d.n.indexOf(p) >= 0; });
    });
    var k = est.o;
    ok.sort(function (a, b) { return Number(b.dataset[k]) - Number(a.dataset[k]); });
    var frag = document.createDocumentFragment();
    filas.forEach(function (f) { f.hidden = true; });
    ok.forEach(function (f, i) { f.hidden = i >= visibles; frag.appendChild(f); });
    cuerpo.appendChild(frag);
    tabla.className = tabla.className.replace(/\s*ord-\w+/g, '') + ' ord-' + k;
    botones.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-p') === est.p)); });
    cuenta.textContent = ok.length === 1 ? '1 jugador' : ok.length + ' jugadores' + (ok.length > visibles ? ' (se ven ' + visibles + ')' : '');
    mas.hidden = ok.length <= visibles;
    // la dirección guarda los filtros (para volver atrás o compartirlos)
    var u = new URLSearchParams();
    if (est.q) u.set('q', est.q); if (est.p) u.set('p', est.p); if (est.e) u.set('e', est.e); if (est.o !== 'v') u.set('o', est.o);
    var s = u.toString();
    history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
  };
  botones.forEach(function (b) { b.addEventListener('click', function () { est.p = b.getAttribute('data-p'); aplicar(true); }); });
  sel.addEventListener('change', function () { est.e = sel.value; aplicar(true); });
  ord.addEventListener('change', function () { est.o = ord.value; aplicar(true); });
  q.addEventListener('input', function () { est.q = q.value; aplicar(true); });
  filtros.addEventListener('submit', function (ev) { ev.preventDefault(); });
  mas.addEventListener('click', function () { visibles += TANDA; aplicar(false); });
  cargarTodos().then(function () { aplicar(true); });
})();
