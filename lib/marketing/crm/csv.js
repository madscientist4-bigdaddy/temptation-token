// Minimal CSV parse (quoted fields) + dedupe on lowercased handle (ported from csv.ts).
const REQUIRED = ['type', 'name', 'handle', 'platform']

export function parseProspectsCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return { rows: [], skipped: 0, deduped: 0 }
  const parseLine = (l) => {
    const out = []; let cur = '', q = false
    for (let i = 0; i < l.length; i++) {
      const c = l[i]
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++ } else if (c === '"') q = false; else cur += c }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = '' } else cur += c
    }
    out.push(cur); return out.map((s) => s.trim())
  }
  const header = parseLine(lines[0]).map((h) => h.toLowerCase())
  const idx = (k) => header.indexOf(k)
  if (REQUIRED.some((k) => idx(k) < 0)) throw new Error(`CSV must include: ${REQUIRED.join(',')}`)
  const seen = new Set(); let skipped = 0, deduped = 0; const rows = []
  for (const line of lines.slice(1)) {
    const c = parseLine(line)
    const handle = (c[idx('handle')] ?? '').toLowerCase()
    if (!handle || !c[idx('name')]) { skipped++; continue }
    if (seen.has(handle)) { deduped++; continue }
    seen.add(handle)
    rows.push({ type: c[idx('type')] || 'contestant', name: c[idx('name')], handle,
      platform: c[idx('platform')] || 'instagram',
      followers: +(c[idx('followers')] ?? 0) || 0,
      engagement_pct: +(c[idx('engagement_pct')] ?? 0) || 0,
      source: c[idx('source')] || 'import' })
  }
  return { rows, skipped, deduped }
}
