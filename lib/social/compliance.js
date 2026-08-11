// Compliance rule engine for AI-generated social captions.
//
// Every caption crosses this before it can reach X or Telegram. It runs in the
// browser for live preview AND again server-side at post time — the server call is
// the one that counts, because the client can be edited. api/social-post.js must
// never publish a caption it has not itself re-evaluated.
//
// Severity:
//   'block' — refuses to post. Legal/regulatory exposure or a false factual claim.
//   'warn'  — surfaced in the UI, does not stop the post.
//
// The canonical-value rules below deliberately mirror scripts/check-prize-split.mjs.
// That guard covers source files; this covers generated text, which never touches a
// source file and so would otherwise bypass it entirely.

export const CANONICAL = {
  splitNoClub: '35% top voter / 35% winning profile / 10% charity / 20% house',
  splitClub:   '35/35/10 + 10% club + 10% house',
  signupBonus: 500,
  voteMatch:   '1:1 up to 1,000 TTS',
  transferTax: '1%',
  poolRule:    'the prize pool is the winning profile\'s votes only — losing votes burn',
  link:        'app.temptationtoken.io',
}

const RULES = [
  // ── Earnings / financial-promise claims ───────────────────────────────────
  {
    id: 'earnings_guarantee',
    severity: 'block',
    label: 'Guaranteed-earnings claim',
    test: t => /\b(guarantee(d|s)?|risk[\s-]?free|no[\s-]risk|can'?t lose|assured returns?)\b/i.test(t),
    why: 'Promising a guaranteed or risk-free return is a securities/FTC problem regardless of intent.',
  },
  {
    id: 'earnings_projection',
    severity: 'block',
    label: 'Price or return projection',
    test: t => /\b(\d+\s*x\b|\d+\s*%\s*(gain|return|apy|roi|profit)|to the moon|moon(ing|shot)?\b|price target|will (hit|reach|pump)|next 100x)/i.test(t),
    why: 'Price predictions and multiplier claims read as investment advice.',
  },
  {
    id: 'earnings_income',
    severity: 'block',
    label: 'Income promise',
    test: t => /\b(passive income|get rich|make money|earn (\$|\d)|financial freedom|life[\s-]changing money|quit your job)\b/i.test(t),
    why: 'Framing the game as an income source is an earnings claim.',
  },
  {
    id: 'financial_advice',
    severity: 'block',
    label: 'Investment advice framing',
    test: t => /\b(invest(ment)? (now|today|opportunity)|buy the dip|financial advice|not financial advice|ape in|don'?t miss out on (gains|profits))\b/i.test(t),
    why: 'Advice framing (including the "not financial advice" wink) invites regulatory reading.',
  },

  // ── Safe for work / platform ToS ──────────────────────────────────────────
  {
    id: 'nsfw_explicit',
    severity: 'block',
    label: 'Explicit / NSFW language',
    // Note the inflections: a bare \bsexy\b misses "sexiest", which is exactly
    // the form a caption reaches for. "hot" is deliberately NOT here — the game
    // is literally Hot or Not, so blocking it would block the brand.
    test: t => /\b(nude|nudes|naked|nsfw|porn(o|graphy)?|xxx|explicit|topless|onlyfans|strip(ping|per)?|lingerie|sexy|sexiest|sexier|sexual(is|iz)ed?|seductive|steamy|naughty|thirst trap)\b/i.test(t),
    why: 'X and Telegram brand channels must stay SFW; this is a "Hot or Not" game, not adult content.',
  },
  {
    id: 'minor_risk',
    severity: 'block',
    label: 'Language implying minors',
    test: t => /\b(teen(s|age|ager)?|school ?girl|school ?boy|underage|barely legal|jailbait|young girls?|young boys?)\b/i.test(t),
    why: 'Absolute red line next to any photo-based platform. Never publishable.',
  },
  {
    id: 'objectifying',
    severity: 'warn',
    label: 'Objectifying phrasing',
    test: t => /\b(smokin'? hot|babes?|hotties|eye candy|rate her|rate him|smash or pass)\b/i.test(t),
    why: 'Legal, but off-brand and a moderation risk on X.',
  },

  // ── Canonical values (mirrors scripts/check-prize-split.mjs) ──────────────
  {
    id: 'prize_split_40',
    severity: 'block',
    label: 'Wrong prize split — 40% is FORBIDDEN near prize words',
    test: t => /\b40\s*%/.test(t) && /voter|winner|winning|prize|pool|split|pot|payout/i.test(t),
    why: `Canonical split is ${CANONICAL.splitNoClub}. FORBIDDEN: that figure next to prize words.`,
  },
  {
    id: 'signup_bonus_wrong',
    severity: 'block',
    label: 'Wrong signup bonus',
    test: t => /\b(\d{2,4})\s*\$?TTS\b/i.test(t) &&
               /sign.?up|new.?user|welcome|join(ing)?|registration/i.test(t) &&
               !/referral/i.test(t) &&
               !/\b500\s*\$?TTS\b/i.test(t),
    why: `Canonical signup bonus is ${CANONICAL.signupBonus} TTS.`,
  },
  {
    id: 'pool_contamination',
    severity: 'block',
    label: 'Misstates what forms the prize pool',
    test: t => /\ball votes?\b|\btotal votes?\b|\bevery vote\b/i.test(t) &&
               /prize pool|payout|pot\b|settlement/i.test(t) &&
               !/winning/i.test(t),
    why: `Canonical: ${CANONICAL.poolRule}.`,
  },
  {
    id: 'tax_misstate',
    severity: 'warn',
    label: 'Transfer tax stated as other than 1%',
    test: t => /\btransfer tax\b/i.test(t) && !/\b1\s*%/.test(t),
    why: `Transfer tax is ${CANONICAL.transferTax}, hardcoded and permanent.`,
  },

  // ── Housekeeping ──────────────────────────────────────────────────────────
  {
    id: 'missing_link',
    severity: 'warn',
    label: 'No link to the app',
    test: t => !/app\.temptationtoken\.io|temptationtoken\.io/i.test(t),
    why: `Posts should route to ${CANONICAL.link}.`,
  },
  {
    id: 'fake_urgency',
    severity: 'warn',
    label: 'Manufactured urgency',
    test: t => /\b(last chance|final hours?|act now|hurry|don'?t miss out|only \d+ (spots?|left))\b/i.test(t),
    why: 'Pressure tactics age badly and draw scam-pattern scrutiny from security vendors.',
  },
]

// Promotional triggers — when any of these appear, the post is an inducement aimed
// at the reader and needs a disclosure tag. This is the "#ad where required" rule.
//
// Deliberately narrower than "any word about prizes". Neutrally describing the game's
// own mechanics ("the prize pool is the winning profile's votes", "Round 7 winner
// announced") is not an inducement, and tagging those #ad would be both wrong and
// noisy enough that admins would learn to ignore the whole check.
const PROMO_TRIGGERS =
  /\b(bonus|giveaway|airdrop|referrals?|refer a friend|sponsored|partnership|promo(tion)?|claim your|enter to win|win \$?\d|free\s+\$?[\d,]*\s*TTS)\b/i

const DISCLOSURE_TAGS = /#(ad|sponsored|paid|promo)\b/i

const PLATFORM_LIMITS = { x_tts: 280, x: 280, telegram: 4096, instagram: 2200 }

/**
 * Evaluate a caption.
 * @param {string} caption
 * @param {{platform?: string, forceDisclosure?: boolean}} opts
 * @returns {{ok: boolean, blocking: Array, warnings: Array, needsDisclosure: boolean, length: number, limit: number|null}}
 */
export function evaluate(caption, opts = {}) {
  const text = String(caption == null ? '' : caption)
  const { platform, forceDisclosure = false } = opts
  const findings = []

  for (const r of RULES) {
    let hit = false
    try { hit = r.test(text) } catch { hit = false }
    if (hit) findings.push({ id: r.id, severity: r.severity, label: r.label, why: r.why })
  }

  // Disclosure: required when the copy induces (or the caller says so), absent a tag.
  const needsDisclosure = forceDisclosure || PROMO_TRIGGERS.test(text)
  if (needsDisclosure && !DISCLOSURE_TAGS.test(text)) {
    findings.push({
      id: 'missing_disclosure',
      severity: 'block',
      label: 'Missing #ad disclosure',
      why: 'Caption promotes an incentive (bonus/prize/giveaway/referral), so it needs #ad.',
    })
  }

  // Empty caption is not postable.
  if (!text.trim()) {
    findings.push({ id: 'empty', severity: 'block', label: 'Empty caption', why: 'Nothing to post.' })
  }

  // Platform length.
  const limit = PLATFORM_LIMITS[platform] ?? null
  if (limit && text.length > limit) {
    findings.push({
      id: 'too_long',
      severity: 'block',
      label: `Over ${platform} limit`,
      why: `${text.length} chars, limit ${limit}.`,
    })
  }

  const blocking = findings.filter(f => f.severity === 'block')
  const warnings = findings.filter(f => f.severity === 'warn')
  return { ok: blocking.length === 0, blocking, warnings, needsDisclosure, length: text.length, limit }
}

/** Convenience for server guards: throws with a readable reason when blocked. */
export function assertPostable(caption, opts = {}) {
  const v = evaluate(caption, opts)
  if (!v.ok) {
    const err = new Error('Caption blocked by compliance: ' + v.blocking.map(b => b.label).join('; '))
    err.compliance = v
    throw err
  }
  return v
}

/** Append a disclosure tag if the caption needs one and lacks it. Explicit, never silent. */
export function withDisclosure(caption, tag = '#ad') {
  const text = String(caption || '')
  if (!PROMO_TRIGGERS.test(text) || DISCLOSURE_TAGS.test(text)) return text
  return `${text.trimEnd()} ${tag}`
}

export const _internals = { RULES, PROMO_TRIGGERS, DISCLOSURE_TAGS, PLATFORM_LIMITS }
