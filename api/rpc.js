const cache = {};
const CACHE_TTL = 30000; // 30 seconds

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const key = JSON.stringify(req.body);
    const now = Date.now();
    if (cache[key] && now - cache[key].ts < CACHE_TTL) {
      return res.status(200).json(cache[key].data);
    }
    const response = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    cache[key] = { data, ts: now };
    res.status(200).json(data);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
