// Telegram send (ported from telegram.ts). DRY_RUN logs instead of posting.
import { cfg } from '../config.js'
const api = (t, m) => `https://api.telegram.org/bot${t}/${m}`

export async function tgMessage(chatId, text, useBroadcast = true) {
  const token = useBroadcast && cfg.tg.broadcastToken ? cfg.tg.broadcastToken : cfg.tg.botToken
  if (cfg.dryRun) { console.log(`[DRY] TG -> ${chatId}: ${text.slice(0, 80)}…`); return true }
  const r = await fetch(api(token, 'sendMessage'), { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: false }) })
  if (!r.ok) console.error('TG send failed', r.status, await r.text())
  return r.ok
}

export async function tgPhoto(chatId, png, caption) {
  if (cfg.dryRun) { console.log(`[DRY] TG photo -> ${chatId} (${png.length}b): ${caption.slice(0, 60)}…`); return true }
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', caption)
  form.append('parse_mode', 'HTML')
  form.append('photo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'card.png')
  const r = await fetch(api(cfg.tg.broadcastToken || cfg.tg.botToken, 'sendPhoto'), { method: 'POST', body: form })
  if (!r.ok) console.error('TG photo failed', r.status, await r.text())
  return r.ok
}
