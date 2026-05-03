# Jim's Daily Operations Playbook — Temptation Token
*Last updated: April 30, 2026*

---

## CHAINLINK CRON UPDATE — DO THIS FIRST (one-time)

**Go to: https://automation.chain.link/base**

Connect MetaMask (deployer wallet: 0xb1e991bf617459b58964eef7756b350e675c53b5)

**Update "TTS Start Round" upkeep:**
1. Find "TTS Start Round" → click it
2. Click "Edit" or the gear/settings icon
3. Change cron to: `0 4 * * 1`
4. Confirm in MetaMask
5. This sets rounds to start Monday 12:00 AM EDT (04:00 UTC)

**Update "TTS Settle Or Rollover" upkeep:**
1. Find "TTS Settle Or Rollover" → click it
2. Click "Edit" or the gear/settings icon
3. Change cron to: `59 3 * * 1`
4. Confirm in MetaMask
5. This sets rounds to end Sunday 11:59 PM EDT (Monday 03:59 UTC)

Note: During EST (winter), rounds will be 1 hour off — unavoidable with Chainlink UTC-only crons.

---

## EVERY DAY — 10 minutes total

### Morning Check (9am)

1. Open https://app.temptationtoken.io/admin (password: TTS2026Admin!)
2. Click **Command Center** — check the 4 health indicators (all should be green)
3. If any red alerts appear → click them → they navigate you directly to the fix
4. Click **Daily Priorities** → complete any overdue items (checked items auto-reset next day)
5. Click **Photo Review** → approve any pending submissions (one click per photo)
6. Click **Content Calendar** → approve any posts scheduled for today (one click → Approve)

### Instagram (5 minutes)

- Open Instagram → @temptationtoken
- The pre-approved image hint is in Admin → Content Calendar → today's Instagram post
- Post today's image using caption from the Content Calendar (copy button available)
- After posting: add 3 story frames → swipe-up link to https://app.temptationtoken.io
- Copy the exact caption — it's already written and approved

### Instagram DMs — 3 per day (10 minutes)

**Target:** Female content creators, 10k–500k followers

**Daily hashtag rotation (search these):**
| Day | Hashtags to Search |
|-----|-------------------|
| Monday | #onlyfanscreator #fanslymodel |
| Tuesday | #contentcreatorlife #adultmodel |
| Wednesday | #exoticdancer #stripclub |
| Thursday | #camgirl #adultcontentcreator |
| Friday | #models #influencer |
| Saturday | #fitness #gymgirl |
| Sunday | #crypto #web3women |

**DM Template (copy → customize the name):**
```
Hey [Name] 👋

I built a crypto voting game called Temptation Token where men vote real cryptocurrency on women's profiles weekly.

Top voted profile wins 35% of the prize pool — paid automatically to your crypto wallet. No exclusivity. No fees. You keep everything. Prize distribution: 35% to the top voter, 35% to the winning profile, 10% to Polaris Project charity, and 20% to Blockchain Entertainment LLC. When a profile was submitted through a club partner, the split adjusts to 35/35/10/10/10 — the club receives 10% and the house receives 10%.

Beta launching now — personally selecting founding profiles. With your following you'd be a top contender.

Takes 2 min: app.temptationtoken.io

Interested? 🔥
```

Track outreach in Admin → Social Media → DM Outreach section.

---

## MONDAY ONLY — 15 minutes total

1. **Content Calendar** → Generate This Week → review all 7 posts → Approve All
2. **BaseScan check**: Go to https://basescan.org/address/0xEC339baD1900447833C9fe905C4A768D1f0cA912#events → look for "RoundSettled" event
3. **After May 5**: Deploy NFT-enabled V3b — red HIGH PRIORITY alert will appear in Daily Priorities
4. **System Health** tab → check all 4 Chainlink LINK balances → all should show ≥3 LINK (green)
5. **Wallets** tab → quick sanity check on Marketing wallet balance (needs TTS for bonuses)

---

## FRIDAY WEEKLY — 30 minutes

### Club Partnership Outreach (send to 3 clubs)

**Email Subject:** New Revenue Stream for Your Dancers — Crypto Voting Partnership

```
Subject: New Revenue Stream for Your Dancers — Crypto Voting Partnership

Hi,

I run Temptation Token — a weekly cryptocurrency voting game launching now on Base blockchain.

Your dancers submit profiles using your club's referral code. Every vote their profiles receive, your club automatically earns 10% — paid weekly in crypto directly to your wallet.

We are audited, liquidity locked, and built on Base blockchain (Ethereum L2). Takes less than 5 minutes to set up.

Beta launching with 10 founding clubs — spots are limited.

Worth a 10-minute call?

Jim Goetz
Blockchain Entertainment LLC
support@temptationtoken.io
app.temptationtoken.io
```

### Weekly Reviews (15 minutes)
- Admin → Referrals → check referral stats and top referrers
- Admin → KPI Dashboard → screenshot or note key metrics
- Admin → Staking → check active stakers and total locked
- Personally text 5 women about submitting profiles this week

---

## MONTHLY — 1st of month (45 minutes)

1. Export KPI report: Admin → KPI Dashboard → screenshot all metrics
2. Review token price at https://dexscreener.com/base/0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68
3. Pay vendors:
   - Railway: railway.app → proud-unity → $5/month (Hobby)
   - Vercel: vercel.com → check usage
   - Supabase: supabase.com → Pro plan
4. Check Solidproof audit status at solidproof.io
5. Submit to one new exchange listing (see outputs/exchange_submissions/ folder)
6. Review and update marketing wallet balance — refill if below 1M TTS

---

## EMERGENCY PROCEDURES

| Issue | Fix |
|-------|-----|
| Round didn't start Monday 12am EDT | Admin → System Health → Manual Round Control → Start Round |
| Round didn't settle Sunday 11:59pm EDT | BaseScan → TTSKeeper2 (0xB17b…) → Write → manualExecute(3) |
| Low LINK balance | automation.chain.link/base → fund upkeeps (keep >5 LINK each) |
| Railway bot offline | railway.app → proud-unity → check status → restart if needed |
| Vercel down | vercel.com → cryptofitjims-projects → check status |
| Bot hasn't posted | Admin → Content Calendar → check approved posts → Post Now manually |

---

## KEY LINKS (bookmark all of these)

| Platform | URL |
|----------|-----|
| Admin Dashboard | https://app.temptationtoken.io/admin |
| BaseScan Voting Contract | https://basescan.org/address/0xEC339baD1900447833C9fe905C4A768D1f0cA912 |
| Chainlink Automation | https://automation.chain.link/base |
| Chainlink VRF | https://vrf.chain.link/base |
| Railway Bot | https://railway.app |
| Supabase | https://supabase.com/dashboard/project/gmlikdxykgviyprqtqwz |
| Vercel | https://vercel.com/cryptofitjims-projects |
| DexScreener | https://dexscreener.com/base/0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68 |
| Gnosis Safe | https://app.safe.global/home?safe=base:0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86 |
