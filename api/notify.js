// POST /api/notify — sends Telegram message to admin when a new submission arrives
// Requires env vars: TELEGRAM_BOT_TOKEN, ADMIN_CHAT_ID
// Set these in Railway and in Vercel (Settings → Environment Variables)
//
// HOW TO GET ADMIN_CHAT_ID:
//   1. Add @TTSGameBot to your admin Telegram group
//   2. Send any message in the group
//   3. Open: https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
//   4. Find "chat":{"id": ...} — that number is your ADMIN_CHAT_ID (negative for groups)
//   5. Set it as ADMIN_CHAT_ID in Railway and Vercel env vars

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { name, wallet, link_url } = req.body || {}
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.ADMIN_CHAT_ID

  if (!token || !chatId) {
    console.warn('Telegram not configured — set TELEGRAM_BOT_TOKEN and ADMIN_CHAT_ID')
    return res.status(200).json({ ok: true, skipped: true })
  }

  const text = [
    '🔔 <b>New Submission for Review</b>',
    '',
    `👤 <b>Name:</b> ${escHtml(name || '—')}`,
    `💰 <b>Wallet:</b> <code>${escHtml(wallet || '—')}</code>`,
    `🔗 <b>Link:</b> ${escHtml(link_url || '—')}`,
    '',
    '📋 <a href="https://app.temptationtoken.io/admin">Open Admin Dashboard →</a>',
  ].join('\n')

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
    })
    const data = await r.json()
    if (!data.ok) console.error('Telegram error:', data)
    return res.status(200).json({ ok: data.ok })
  } catch (e) {
    console.error('notify error:', e)
    return res.status(500).json({ error: e.message })
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}
