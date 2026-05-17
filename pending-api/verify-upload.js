// POST /api/verify-upload
// Receives age verification submission: ID doc (base64), personal info, canvas signature.
// Uploads ID to private Supabase storage, upserts wallet_verifications record, notifies admin via Telegram.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { walletAddress, idDocBase64, idFileName, fullName, dob, signatureBase64 } = req.body || {}
  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return res.status(400).json({ ok: false, error: 'Invalid walletAddress' })
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

  // Upload ID document to private storage bucket
  let idDocPath = null
  if (idDocBase64) {
    try {
      const base64Data = idDocBase64.replace(/^data:[^;]+;base64,/, '')
      const buf = Buffer.from(base64Data, 'base64')
      const ext = (idFileName || 'id.jpg').split('.').pop().toLowerCase()
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      const path = `${walletAddress.toLowerCase()}/id.${ext}`

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/wallet-verifications/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY,
            'Content-Type': mime,
            'x-upsert': 'true',
          },
          body: buf,
        }
      )
      if (uploadRes.ok) idDocPath = path
    } catch (_) {}
  }

  // Upsert verification record (merge on wallet_address unique constraint)
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/wallet_verifications`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      wallet_address:  walletAddress,
      status:          'pending',
      is_verified:     false,
      full_name:       fullName || null,
      date_of_birth:   dob || null,
      id_doc_path:     idDocPath,
      signature_img:   signatureBase64 || null,
      submitted_at:    new Date().toISOString(),
    }),
  })

  if (!upsertRes.ok) {
    const errText = await upsertRes.text()
    return res.status(500).json({ ok: false, error: errText })
  }

  // Admin Telegram notification (admin chat -5273368658)
  const botToken = process.env.BROADCAST_BOT_TOKEN
  if (botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: '-5273368658',
        text: `🪪 Age verification submitted\nWallet: ${walletAddress}\nName: ${fullName || '—'}\nDOB: ${dob || '—'}\n\nReview: Admin Dashboard → Verifications`,
      }),
    }).catch(() => {})
  }

  return res.json({ ok: true })
}
