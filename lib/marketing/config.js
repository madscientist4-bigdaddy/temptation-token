// Central env config (ported from tts-marketing-engine/lib/config.ts → JS ESM).
// DRY_RUN defaults to true — nothing posts live until DRY_RUN=false is set deliberately.
export const cfg = {
  dryRun: (process.env.DRY_RUN ?? 'true').toLowerCase() !== 'false',
  appUrl: process.env.APP_URL ?? 'https://app.temptationtoken.io',
  canonBonus: process.env.CANON_BONUS ?? '$5 in free TTS',
  x: {
    apiKey: process.env.X_API_KEY ?? '',
    apiSecret: process.env.X_API_SECRET ?? '',
    // engine expects X_ACCESS_TOKEN/SECRET; this repo already uses TTS_X_ACCESS_* — accept both.
    accessToken: process.env.X_ACCESS_TOKEN ?? process.env.TTS_X_ACCESS_TOKEN ?? '',
    accessSecret: process.env.X_ACCESS_SECRET ?? process.env.TTS_X_ACCESS_SECRET ?? '',
  },
  tg: {
    botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
    broadcastToken: process.env.BROADCAST_BOT_TOKEN ?? '',
    mainChannel: process.env.MAIN_CHANNEL_ID ?? '',
    communityChat: process.env.COMMUNITY_CHAT_ID ?? '',
    adminChat: process.env.ADMIN_CHAT_ID ?? '',
  },
  discordWebhook: process.env.DISCORD_WEBHOOK_URL ?? '',
  resendKey: process.env.RESEND_API_KEY ?? '',
  supabase: {
    url: process.env.SUPABASE_URL ?? 'https://gmlikdxykgviyprqtqwz.supabase.co',
    serviceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  },
  cronSecret: process.env.CRON_SECRET ?? '',
  // TTS→USD for pool/prize display. Tunable; documented as a stand-in until a
  // price oracle is wired (see GO-LIVE-REPORT "needs human").
  ttsUsd: Number(process.env.TTS_USD ?? '0.0001'),
}
