// GET /api/kyc-status?wallet=0x...
// Returns current KYC verification status for a wallet.
// Checks verified_submitters (Persona KYC), wallet_verifications (legacy manual),
// and verified_wallet_links (linked wallets sharing a primary verification).

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

function sbFetch(path) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  }).then(r => r.json())
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const wallet = (req.query.wallet || '').toLowerCase()
  if (!wallet || !/^0x[0-9a-fA-F]{40}$/i.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' })
  }

  const [vsRows, wvRows, wlRows] = await Promise.all([
    sbFetch(`/verified_submitters?wallet_address=eq.${wallet}&select=status,reference_id,verified_at`).catch(() => []),
    sbFetch(`/wallet_verifications?wallet_address=eq.${wallet}&is_verified=eq.true&select=id`).catch(() => []),
    sbFetch(`/verified_wallet_links?linked_wallet=eq.${wallet}&select=primary_wallet`).catch(() => []),
  ])

  // Legacy manual approval
  if (Array.isArray(wvRows) && wvRows.length > 0) {
    return res.status(200).json({ status: 'approved', source: 'legacy' })
  }

  // Linked wallet inheriting primary wallet's KYC
  if (Array.isArray(wlRows) && wlRows.length > 0) {
    return res.status(200).json({ status: 'approved', source: 'linked', primaryWallet: wlRows[0].primary_wallet })
  }

  // Persona KYC record
  if (Array.isArray(vsRows) && vsRows.length > 0) {
    const row = vsRows[0]
    return res.status(200).json({
      status: row.status,
      reference_id: row.reference_id,
      verified_at: row.verified_at,
      source: 'persona',
    })
  }

  return res.status(200).json({ status: 'not_started' })
}
