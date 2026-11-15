/* El semáforo de los servidores de LaLiga Fantasy (0.7.13i, Carlos, 15 nov: «un simbolito de está tu server de fantasy,
   en verde, amarillo o rojo»). Lo comparten el Worker (GET /estado, que lo mira cada 2 minutos para todos) y la app (si
   no llega al Worker, lo mira ella con su propia conexión). Tres cosas, ninguna con la cuenta de nadie:
     login:  la página para entrar de LaLiga. Se le pide la sesión con una llave de renovar falsa: si está viva contesta
             400 con su código de error (AADB2C…); si no, 5xx o nada.
     api:    la lista de los 20 equipos (/v3/teams-master), que LaLiga da sin sesión.
     cuenta: (solo el Worker) lo que pide sesión: sin ella tiene que decir 401 rápido; un 5xx es que eso está caído.
   Además, el Worker sabe cuántas entradas han ido bien y cuántas han fallado por LaLiga en las 2 últimas horas (lo que
   manda cada móvil a /embudo, sin cuenta): si fallan más de las que entran, amarillo aunque los servidores contesten. */

export const LENTO_MS = 3000;
const B2C = 'https://login.laliga.es/laligadspprob2c.onmicrosoft.com/oauth2/v2.0/token?p=B2C_1A_5ULAIP_PARAMETRIZED_SIGNIN';
const CLIENTE = 'af88bcff-1157-40a0-b579-030728aacf0b';
const API = 'https://fantasy-api.llt-services.com/api';

/** lo que se prueba: { url, metodo, cabeceras, cuerpo, bien(s, texto) } */
export const PRUEBAS = {
  login: {
    url: B2C, metodo: 'POST',
    cabeceras: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    cuerpo: `grant_type=refresh_token&refresh_token=x&client_id=${CLIENTE}&scope=openid%20offline_access`,
    bien: (s, t) => s === 400 && /AADB2C|invalid_/.test(t || ''),
  },
  api: { url: `${API}/v3/teams-master?x-lang=es`, metodo: 'GET', cabeceras: { Accept: 'application/json' }, cuerpo: null, bien: (s, t) => s === 200 && String(t || '').length > 200 },
  cuenta: { url: `${API}/v4/user/me?x-lang=es`, metodo: 'GET', cabeceras: { Accept: 'application/json' }, cuerpo: null, bien: (s) => s === 401 || s === 403 },
};

/** { e: 'ok' | 'lento' | 'mal', ms, s } de una respuesta */
export function resultado(prueba, s, texto, ms) {
  if (!s || !prueba.bien(s, texto)) return { e: 'mal', ms, s: s || 0 };
  return { e: ms >= LENTO_MS ? 'lento' : 'ok', ms, s };
}

/**
 * el color: rojo si no responde la página de entrar o la API; amarillo si algo va lento, si falla lo que pide sesión o si
 * en las 2 últimas horas LaLiga ha fallado en más entradas de las que han ido bien (con 3 fallos o más)
 */
export function nivelDe(p, entradas = null) {
  const cs = ['login', 'api', 'cuenta'].map((k) => p && p[k]).filter(Boolean);
  if (!cs.length) return 'gris';
  if ((p.login && p.login.e === 'mal') || (p.api && p.api.e === 'mal')) return 'rojo';
  if (cs.some((x) => x.e !== 'ok')) return 'amarillo';
  if (entradas && (entradas.x || 0) >= 3 && entradas.x > (entradas.ok || 0)) return 'amarillo';
  return 'verde';
}

/** el texto para la pantalla de entrar */
export function textoEstado(E) {
  const n = (E && E.nivel) || 'gris';
  if (n === 'verde') return { t: 'LaLiga Fantasy funciona bien', x: '' };
  if (n === 'rojo') {
    const login = E.login && E.login.e === 'mal';
    return { t: login ? 'La página para entrar de LaLiga no responde' : 'Los servidores de LaLiga Fantasy no responden', x: 'No es cosa tuya ni de la app. Suele arreglarse en un rato: vuelve a probar en unos minutos.' };
  }
  if (n === 'amarillo') {
    const fallan = E.entradas && (E.entradas.x || 0) >= 3 && E.entradas.x > (E.entradas.ok || 0);
    const lento = ['login', 'api', 'cuenta'].some((k) => E[k] && E[k].e === 'lento');
    return {
      t: fallan ? 'LaLiga está fallando al entrar' : lento ? 'LaLiga Fantasy va lenta ahora mismo' : 'LaLiga Fantasy va con fallos ahora mismo',
      x: 'Si no entras a la primera, vuelve a darle: suele ir a la segunda o en unos minutos.',
    };
  }
  return { t: 'No se ha podido comprobar cómo va LaLiga Fantasy', x: '' };
}
