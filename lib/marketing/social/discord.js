// Discord webhook post (ported from discord.ts). Webhook optional; DRY_RUN logs.
import { cfg } from '../config.js'

export async function discordPost(content, png) {
  if (!cfg.discordWebhook) return true // webhook optional
  if (cfg.dryRun) { console.log(`[DRY] Discord: ${content.slice(0, 80)}…`); return true }
  let r
  if (png) {
    const form = new FormData()
    form.append('payload_json', JSON.stringify({ content }))
    form.append('files[0]', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'card.png')
    r = await fetch(cfg.discordWebhook, { method: 'POST', body: form })
  } else {
    r = await fetch(cfg.discordWebhook, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
  }
  if (!r.ok) console.error('Discord failed', r.status)
  return r.ok
}
