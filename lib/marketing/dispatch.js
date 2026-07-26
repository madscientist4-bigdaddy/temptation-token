// Single dispatcher (ported from api/cron/dispatch.ts). Exactly-once via
// posted_events insert (claimEvent); DST-safe via schedule/postPlan.
import { dueEvents } from './schedule/postPlan.js'
import { cfg } from './config.js'
import { tweet, uploadMedia } from './social/x.js'
import { tgPhoto, tgMessage } from './social/telegram.js'
import { discordPost } from './social/discord.js'

// deps: { claimEvent, fetchRoundState, renderCard, weeklyReportText }
export async function runDispatch(deps, now = new Date()) {
  const fired = []
  for (const { event, eventKey } of dueEvents(now)) {
    if (!(await deps.claimEvent(eventKey))) continue // already posted this week
    const s = await deps.fetchRoundState()
    const post = async (text, cardKind) => {
      const png = cardKind ? await deps.renderCard(cardKind, s) : undefined
      const mediaId = png ? await uploadMedia(png) : undefined
      await tweet(text, mediaId)
      if (png) await tgPhoto(cfg.tg.mainChannel, png, text)
      else await tgMessage(cfg.tg.mainChannel, text)
      await discordPost(text, png)
    }
    switch (event.id) {
      case 'round_open':
        await post(`🔔 Round ${s.round} is LIVE. ${s.profiles} profiles. Pool: ${s.poolUsd} and growing. Free vote for every player → ${cfg.appUrl}`, 'roundOpen'); break
      case 'midpoint':
        await post(`⚡ HALFTIME: ${s.leader} leads with ${s.leaderVotes} votes. 4 days left. Flip it → ${cfg.appUrl}`, 'midpoint'); break
      case 'friday_push':
        await post(`🍸 Weekend rule: vote before you go out. Pool sits at ${s.poolUsd}. Closes Sunday 11:59 PM ET → ${cfg.appUrl}`); break
      case 'final_hours':
        await post(`⏳ FINAL HOURS. Top voter takes 35% of ${s.poolUsd}. Round settles at midnight → ${cfg.appUrl}`); break
      case 'winner':
        if (s.winner) await post(`👑 ${s.winner} wins Round ${s.round} — ${s.prizeUsd} paid on-chain. ${s.burned} $TTS burned forever. New round is already live → ${cfg.appUrl}`, 'winner'); break
      case 'weekly_report':
        await tgMessage(cfg.tg.adminChat, await deps.weeklyReportText(), false); break
    }
    fired.push(event.id)
  }
  return fired
}
