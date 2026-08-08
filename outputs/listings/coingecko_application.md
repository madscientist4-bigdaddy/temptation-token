# CoinGecko listing application — every field, filled

**Where:** https://www.coingecko.com/en/coins/new (the "Request Form" — you must be signed
into a CoinGecko account). Choose **"New Cryptoasset Request"**.

Everything below is copy-paste ready. Values verified on-chain 2026-08-07.

---

## Section 1 — Basic information

| Field | Answer |
|---|---|
| Coin/Token Name | `Temptation Token` |
| Symbol/Ticker | `TTS` |
| Is this a token or a coin? | Token |
| Blockchain / Platform | `Base` |
| Contract Address | `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| Decimals | `18` |
| Launch Date | `2026-05-05` (Uniswap V2 pool live; LP locked to 2027-05-05) |
| Category | Gaming (GameFi) · SocialFi |
| Is it a stablecoin? | No |
| Is it a fork? | No |

**Description (short, ~200 chars):**
> Temptation Token ($TTS) powers a weekly on-chain "Hot or Not" voting game on Base.
> Players vote with $TTS, winners split the pool, losing votes are burned, and 10% of every
> pool goes to an anti-trafficking charity.

**Description (long):**
> Temptation Token ($TTS) is the utility token of a weekly voting contest on Base. Each
> week, approved entrants compete; players vote real $TTS on their favourites. At
> settlement a Chainlink VRF draw picks the winning profile weighted by votes, and the pool
> is split 35% to the winning profile, 35% to the top voter on it, 10% to the Polaris
> Project (a 501(c)(3) fighting human trafficking), and 20% to the operator. Only the
> winning profile's pool is distributed — every $TTS voted on a losing profile is burned to
> the dead address, making the token structurally deflationary. Holders can stake $TTS for
> 8–45% APR and vote multipliers up to 3×. Rounds are calendar-pinned and settled
> automatically by Chainlink Automation. Total supply is fixed at 69,000,000,000 with no
> mint function.

---

## Section 2 — Supply

| Field | Answer |
|---|---|
| Total Supply | `69,000,000,000` |
| Max Supply | `69,000,000,000` (fixed — **no mint function exists**) |
| Circulating Supply | See note below — compute the day you submit |
| Is supply verifiable on-chain? | Yes — `totalSupply()` on the token contract |

**Circulating supply note.** CoinGecko will check this. Be honest and show your working;
they accept a documented methodology far more readily than a round number.
Excluded from circulating (locked/treasury/team, all publicly identifiable):

| Wallet | Address | Held |
|---|---|---|
| TTS Treasury | `0xC3A3858A3777E4C9B542e60298c3161086c5Faae` | 20,000,000,000 |
| Gnosis Safe (2/2 admin) | `0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86` | 10,000,000,000 |
| Founder | `0xe5c3b6480164c20253c21928c699ab7fdb8a60e5` | 10,000,000,000 |
| Staking reward pool | `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d` | 10,000,000,000 |
| Ecosystem | `0xc17c1b5f653d66dc3324a0dc09d5500500f24ade` | 6,000,000,000 |
| Development | `0x95607DcF6c815e6A7cb79eb6199174DFADC78758` | 5,000,000,000 |
| Team | `0xb1c9868d4bfb10d2d7e51cd625889f2b9e1d4887` | 2,000,000,000 |

> Run `node outputs/listings/circulating.mjs` to produce the exact figure and a
> per-wallet breakdown on submission day. Paste that output into the form's notes field.

---

## Section 3 — Links

| Field | Value |
|---|---|
| Official Website | `https://temptationtoken.io` |
| Web App | `https://app.temptationtoken.io` |
| Block Explorer | `https://basescan.org/token/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| X (Twitter) | `https://x.com/temptationtoken` |
| Telegram (channel) | `https://t.me/temptationtoken` |
| Telegram (chat) | `https://t.me/TTSCommunityChat` |
| Smart Contract Audit | `https://temptationtoken.io/audit` |
| Audit (auditor's portal) | `https://app.solidproof.io/projects/temptation-token` |
| Trust & Security | `https://temptationtoken.io/trust` |
| Privacy Policy | `https://temptationtoken.io/wp-content/uploads/2024/06/Privacy-Policy-TTS.pdf` |
| Terms of Use | `https://temptationtoken.io/wp-content/uploads/2024/06/Terms-of-Use-TTS.pdf` |
| GitHub | *(leave blank — the app repo is private; do not link a 404)* |
| Whitepaper | *(leave blank unless one is published — a dead link hurts more than an empty field)* |

---

## Section 4 — Market / trading

| Field | Answer |
|---|---|
| Is it trading? | Yes |
| Exchange | Uniswap V2 (Base) |
| Pair | TTS / WETH |
| Pair contract | `0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68` |
| Trading URL | `https://app.uniswap.org/explore/tokens/base/0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` |
| Is liquidity locked? | Yes — LP locked until **2027-05-05** |

> **Be ready for this one.** The pool is thin and its last swap was 2026-04-02. CoinGecko
> weights liquidity and trade frequency heavily and may defer a listing on that basis
> alone. If you want the best odds, add liquidity and get organic volume going *before*
> submitting; a rejection puts you in a cooldown.

---

## Section 5 — Logo

- **Requirement:** 200×200 px PNG, square, transparent background, under 100 KB.
- **Source file:** `public/tts_logo.webp` in the repo — convert to PNG at 200×200:
  ```bash
  # macOS, no extra installs
  sips -s format png --resampleHeightWidth 200 200 public/tts_logo.webp --out /tmp/tts_200.png
  ```
  Then check it is under 100 KB and the background is genuinely transparent, not white.

---

## Section 6 — Free-text fields

**"What makes your project unique?"**
> The prize pool is funded entirely by player votes, and every vote on a losing entry is
> burned — so the token gets structurally scarcer every week that people play, without any
> emissions schedule or buyback treasury. The winner draw uses Chainlink VRF, so the
> operator cannot pick the winner. And 10% of every single pool is paid on-chain to the
> Polaris Project at settlement, in the same transaction as the prizes.

**"Anti-bot / anti-whale measures?"**
> A single profile cannot hold more than 40% of a round's total votes, and per-wallet vote
> caps scale with staking tier (500 $TTS unstaked, up to uncapped at VIP). Entrants pass an
> 18+ check and a one-time ID review before appearing.

**"Team — anonymous or public?"**
> Operated by Blockchain Entertainment LLC. Admin keys are held in a 2-of-2 Gnosis Safe
> (`0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86`); contract upgrades additionally pass
> through a 2-day TimelockController, so no single key can change the contracts.

---

## Your exact submission steps

1. Sign in at **https://www.coingecko.com** (create an account if needed — requests from
   signed-out users are not tracked and you cannot follow up).
2. Go to **https://www.coingecko.com/en/coins/new**.
3. Pick **"New Cryptoasset Request"**.
4. Paste the fields above section by section.
5. Generate the circulating-supply figure the same day (`node outputs/listings/circulating.mjs`)
   and paste the breakdown into the notes/comments box.
6. Upload the 200×200 PNG logo.
7. Submit. You get an automated confirmation email; there is **no public queue** and
   CoinGecko does not give ETAs. Typical turnaround is 2–8 weeks.
8. Do **not** submit twice — duplicate requests get deprioritised. If you need to correct
   something, reply to the confirmation email instead.

**Before you hit submit, sanity-check the two links that reviewers actually click:**
`https://temptationtoken.io/audit` and the Uniswap trading URL. A broken audit link is the
single most common reason a GameFi listing gets bounced.
