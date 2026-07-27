// Outbid watcher (ported from worker/outbid.ts) — the retention weapon. Poll
// standings; when a watched wallet loses its #1 top-voter spot, DM via the bot
// (1/hr rate cap). Deps wired to real integration in runOutbid().
import { cfg } from '../config.js'
import { tgMessage } from '../social/telegram.js'
import { getStandings, getWatchers, saveWatcher } from '../integration.js'

const HOUR = 3600_000

export async function runOutbidCheck(deps, now = new Date()) {
  const standings = new Map((await deps.getStandings()).map((s) => [s.profileId, s]))
  let notified = 0
  for (const w of await deps.getWatchers()) {
    const s = standings.get(w.profileId); if (!s) continue
    const rank = s.topWallet.toLowerCase() === w.wallet.toLowerCase() ? 1 : 2
    const dethroned = w.lastRank === 1 && rank !== 1
    const rateOk = !w.lastNotified || now.getTime() - w.lastNotified.getTime() >= HOUR
    if (dethroned && rateOk) {
      await tgMessage(w.tgChatId, `⚔️ You've been outbid on <b>${s.profileName}</b> — reclaim #1 before Sunday: ${cfg.appUrl}`, false)
      w.lastNotified = now; notified++
    }
    w.lastRank = rank; await deps.saveWatcher(w)
  }
  return notified
}

// Real-deps entry (called by the Railway worker tick alongside the dispatcher).
export function runOutbid(now = new Date()) {
  return runOutbidCheck({ getStandings, getWatchers, saveWatcher }, now)
}
