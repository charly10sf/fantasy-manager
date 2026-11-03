// Sondeo de feeds candidatos (solo cuenta y fechas; no imprime titulares)
import { get } from '../lib/http.mjs';
import { leerRss } from '../lib/prensa.mjs';
const M = 'https://e00-marca.uecdn.es/rss/futbol/';
const clubesMarca = ['sevilla','betis','valencia','athletic','real-sociedad','villarreal','celta','osasuna','deportivo','racing-santander','getafe','rayo-vallecano','alaves','espanyol','levante','elche','malaga'];
const L = [
  ...clubesMarca.map((c) => ['MARCA', M + c + '.xml']),
  ['Relevo','https://www.relevo.com/rss/futbol/primera-division.xml'],
  ['Relevo','https://www.relevo.com/rss/portada.xml'],
  ['Relevo','https://www.relevo.com/rss/futbol.xml'],
  ['COPE','https://www.cope.es/api/es/deportes/futbol/rss.xml'],
  ['COPE','https://www.cope.es/deportes/futbol/rss'],
  ['COPE','https://www.cope.es/rss/deportes.xml'],
  ['Cadena SER','https://cadenaser.com/arc/outboundfeeds/rss/category/deportes/futbol/?outputType=xml'],
  ['Cadena SER','https://cadenaser.com/arc/outboundfeeds/rss/?outputType=xml'],
  ['Europa Press','https://www.europapress.es/rss/rss.aspx?ch=00067'],
  ['Europa Press','https://www.europapress.es/rss/rss.aspx?ch=00110'],
  ['El Desmarque','https://www.eldesmarque.com/rss'],
  ['El Desmarque','https://www.eldesmarque.com/rss/futbol'],
  ['Estadio Deportivo','https://www.estadiodeportivo.com/rss/'],
  ['Estadio Deportivo','https://www.estadiodeportivo.com/rss/futbol/'],
  ['Superdeporte','https://www.superdeporte.es/rss/section/valencia-cf'],
  ['Superdeporte','https://www.superdeporte.es/rss/'],
  ['20minutos','https://www.20minutos.es/rss/deportes/futbol/'],
  ['20minutos','https://www.20minutos.es/rss/deportes/'],
  ['ABC','https://www.abc.es/rss/2.0/deportes/futbol/'],
  ['El País','https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/subsection/futbol'],
  ['El Mundo','https://e00-elmundo.uecdn.es/elmundodeporte/rss/futbol.xml'],
  ['La Vanguardia','https://www.lavanguardia.com/rss/deportes/futbol.xml'],
  ['Diario AS','https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/'],
  ['AS','https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/primera/tag/lesiones/'],
  ['Mundo Deportivo','https://www.mundodeportivo.com/rss/futbol/atletico-madrid'],
  ['Mundo Deportivo','https://www.mundodeportivo.com/rss/futbol/real-madrid'],
  ['Mundo Deportivo','https://www.mundodeportivo.com/rss/futbol/fc-barcelona'],
  ['SPORT','https://www.sport.es/es/rss/futbol/rss.xml'],
  ['SPORT','https://www.sport.es/es/rss/laliga/rss.xml'],
  ['El Correo','https://www.elcorreo.com/rss/2.0/?section=athletic'],
  ['Noticias de Gipuzkoa','https://www.noticiasdegipuzkoa.eus/rss/real-sociedad.xml'],
  ['Diario de Sevilla','https://www.diariodesevilla.es/rss/deportes/'],
  ['Faro de Vigo','https://www.farodevigo.es/rss/section/2421'],
  ['Diario de Navarra','https://www.diariodenavarra.es/rss/osasuna'],
  ['La Voz de Galicia','https://www.lavozdegalicia.es/deportes/index.xml'],
  ['Diario Montañés','https://www.eldiariomontanes.es/rss/2.0/?section=racing'],
  ['Diario Sur','https://www.diariosur.es/rss/2.0/?section=malagacf'],
  ['futbolfantasy','https://www.futbolfantasy.com/feed'],
  ['futbolfantasy','https://www.futbolfantasy.com/rss'],
  ['futbolfantasy','https://www.futbolfantasy.com/laliga/noticias/rss'],
  ['LaLiga','https://www.laliga.com/rss'],
  ['Real Madrid','https://www.realmadrid.com/es-ES/rss'],
  ['FC Barcelona','https://www.fcbarcelona.es/es/rss'],
  ['Atlético','https://www.atleticodemadrid.com/rss'],
  ['Sevilla','https://sevillafc.es/rss.xml'],
  ['Deportivo','https://www.rcdeportivo.es/feed'],
  ['Getafe','https://www.getafecf.com/feed'],
  ['Rayo','https://www.rayovallecano.es/feed'],
  ['Alavés','https://www.deportivoalaves.com/feed'],
  ['Levante','https://www.levanteud.com/feed'],
  ['Elche','https://www.elchecf.es/feed'],
  ['Racing','https://realracingclub.es/feed'],
  ['Osasuna','https://www.osasuna.es/feed'],
];
const ahora = Date.now();
const R = await Promise.all(L.map(async ([m, u]) => {
  try { const r = await get(u, { headers: { Accept: 'application/rss+xml, application/xml, text/xml' }, reintentos: 0, tiempo: 15000 });
    const it = r.s === 200 ? leerRss(r.b, m) : [];
    const ts = it.map((x) => x.t).filter(Boolean).sort((a, b) => b - a);
    const h24 = ts.filter((t) => ahora - t < 864e5).length;
    const ent = it.filter((x) => x.entradilla.length > 40).length;
    return `@@ ${r.s} ${String(it.length).padStart(3)} items ${String(h24).padStart(3)} en 24h ${String(ent).padStart(3)} con entradilla ultima=${ts[0] ? new Date(ts[0]).toISOString().slice(5, 16) : '-'} ${m} ${u}`;
  } catch (e) { return `@@ ERR ${m} ${u} ${String(e.message || e).slice(0, 60)}`; }
}));
console.log(R.join('\n'));
