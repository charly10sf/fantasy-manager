// (rediseño «Liquid», maqueta) las caras y los escudos de la liga de ejemplo, para que las capturas los lleven sin
// depender de que la página llegue a LaLiga: node .github/liquid/caras.mjs <jugadores.json> <equipos.json> > caras.json
// (los dos JSON, bajados antes con curl de /api/v1/competition/1/players y /api/v3/teams-master)
import fs from 'node:fs';
const [, , fj, fe] = process.argv;
const CD = await import('../../web/js/caras-demo.js');
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { jugadoresDemo } = await import('../../web/js/demo.js');
const http = async (m, url) => ({ s: 200, b: fs.readFileSync(/players/.test(url) ? fj : fe, 'utf8') });
const g = await CD.traer(http, jugadoresDemo());
process.stderr.write(`casados ${g.casados} de ${g.total}\n`);
process.stdout.write(JSON.stringify(g));
