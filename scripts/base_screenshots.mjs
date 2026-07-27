// Three 1284x2778 portrait screenshots of the LIVE app (vote / standings / winner).
// 428x926 CSS viewport @ deviceScaleFactor 3 = 1284x2778.
import { chromium } from 'playwright'
const APP = process.env.APP_URL || 'https://app.temptationtoken.io'
const shots = [
  { tab: 'play',        out: 'marketing/base-dev/screen-1-vote.png' },
  { tab: 'leaderboard', out: 'marketing/base-dev/screen-2-standings.png' },
  { tab: 'nfts',        out: 'marketing/base-dev/screen-3-winners.png' },
]
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 428, height: 926 }, deviceScaleFactor: 3, isMobile: true })
for (const s of shots) {
  const p = await ctx.newPage()
  try {
    await p.goto(APP, { waitUntil: 'networkidle', timeout: 45000 })
    // Dismiss the welcome overlay (blocks the nav) — "Let's Go" or "Skip intro".
    for (const t of ["Let's Go", 'Start Playing', 'Skip intro']) {
      const w = p.locator(`text=${t}`).first()
      if (await w.count()) { await w.click({ timeout: 3000 }).catch(() => {}); break }
    }
    await p.waitForTimeout(1200)
    // Click the nav tab by label (SPA tabs)
    const label = { play: 'Play', leaderboard: 'Leaderboard', nfts: 'NFTs' }[s.tab]
    const btn = p.locator(`button:has-text("${label}")`).first()
    if (await btn.count()) { await btn.click().catch(() => {}) }
    await p.waitForTimeout(3000)
    await p.screenshot({ path: s.out })
    console.log(`wrote ${s.out}`)
  } catch (e) {
    console.log(`SKIP ${s.out}: ${String(e.message || e).slice(0, 100)}`)
  }
  await p.close()
}
await b.close()
