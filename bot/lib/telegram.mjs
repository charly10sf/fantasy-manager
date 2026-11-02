// Telegram: mandar un mensaje a Carlos con la API de bots (sendMessage). Sin dependencias.
// El token y el chat llegan por variables de entorno desde los secretos de GitHub (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID):
// nunca en el repo ni en el chat. El token va en la URL de la API, así que se borra de cualquier texto que salga a un log o a un error.

export function telegramDelEntorno(env = process.env) {
  const token = (env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (env.TELEGRAM_CHAT_ID || '').trim();
  const faltan = [['TELEGRAM_BOT_TOKEN', token], ['TELEGRAM_CHAT_ID', chatId]].filter(([, v]) => !v).map(([k]) => k);
  return { token, chatId, faltan };
}

/** escapa el texto para parse_mode HTML de Telegram */
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sinToken = (s, token) => (token ? String(s).split(token).join('***') : String(s));

/** Manda un mensaje (HTML) sin vista previa de enlaces. Devuelve { ok, estado, id, cuerpo }. No reintenta y no lanza: el cuerpo
 *  del error nunca lleva el token. */
export async function enviar(html, { token, chatId }, { base = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org' } = {}) {
  if (!html) throw new Error('mensaje vacío');
  let r, cuerpo;
  try {
    r = await fetch(`${base}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(20000),
    });
    cuerpo = await r.text();
  } catch (e) {
    const causa = e && e.cause && (e.cause.code || e.cause.message);
    return { ok: false, estado: 0, id: null, cuerpo: sinToken(`${e && e.message ? e.message : e}${causa ? ` (${causa})` : ''}`, token).slice(0, 300) };
  }
  let j = null; try { j = JSON.parse(cuerpo); } catch { /* texto */ }
  return { ok: r.status === 200 && !!(j && j.ok), estado: r.status, id: j && j.result && j.result.message_id, cuerpo: sinToken(cuerpo, token).slice(0, 300) };
}
