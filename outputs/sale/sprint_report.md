# TTS Sale Sprint — final report
**2026-09-25** · Parts 0–8 · every figure below is a chain read, a database query, or a
transaction that actually executed.

---

## The thing to read first

While opening the site to crawlers I checked the audit claims, and they did not hold.
**The live site, the app, and the `/audit` trust page asserted nine things that are false
or unsupportable** — including "Zero critical findings" (the audit found 1 critical and 3
high), "supply is fixed at 69,000,000,000" (the multisig can mint — I did it on a fork,
69B → 70B), and "UUPS proxy upgrade pattern correctly implemented" (there is no proxy).

That last one has a tail that matters more than the copy: **the token is not behind a
proxy at all**, which means the M-1 zero-value-transfer fix, believed live since
2026-05-17, never took effect and cannot be applied. Mainnet still reverts on
`transfer(x, 0)`.

Every one of these was checkable by a buyer in minutes, and two were checkable from
SolidProof's own public page. All app-side instances are **fixed and deployed**. The
WordPress instances need Jim — there is no API path to them.

Full list with exact replacement strings: `outputs/site/false_claims_2026-09-25.md`.

---

## Live now (deployed and verified by loading it)
- `app.temptationtoken.io` — corrected meta, neutral trust banner, rewritten `/audit`
  stating what the audit actually found, what was remediated, and that the deployed
  contract post-dates it. Page loaded in Chrome: 21 profiles render, no console errors.
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt` — all 200, correct content
  types. `llms-full.txt` regenerates from live chain and database reads, so its numbers
  date themselves.
- Daily digest: two launchd jobs installed and loaded, metrics wired to chain + Supabase,
  dry-run renders end to end.
- `submissions.entry_type` / `consent_record_id` / `ai_provenance` live in production with
  constraints, negative-tested.

## Waiting for signatures
**Safe transaction #1 — buy-side liquidity.** `outputs/sale/safe/1_liquidity.json`
(+ plain-English summary and fork proof). 5 transactions, 1,007,851 TTS (0.0101% of the
Safe), no ETH and no cash. Raises the maximum card purchase from **~$50 to $1,000**.
The exact calldata was replayed from the Safe address on a fresh mainnet fork — all five
succeeded. **Expires 2026-10-09**; re-run the builder if the price moves.

## Jim-only actions, in the order that unblocks the most
| # | Action | Plan | Unblocks |
|---|---|---|---|
| 1 | **Fix the WordPress copy** — "Earn Up to 45% APR", the audit claims, "$0.01", "within minutes" | — | The biggest liability in the sale. A buyer reads the marketing site first. |
| 2 | Proton Bridge credentials into `.env` | — | Part 0 canary **and** all Part 7 outreach |
| 3 | Sign Safe tx #1 (with Mike) | T10 | Card on-ramp, then Transak, then routing |
| 4 | `IMAGE_API_KEY` | T10 | All of Part 3 |
| 5 | Play account type: Personal or Organization? | T05 | All of Part 6 |
| 6 | Transak production key | T07 | Card purchases (do **after** #3) |
| 7 | Send the SolidProof request (drafted) | T06 | Re-audit pinned to live addresses |
| 8 | CAN-SPAM postal address for the LLC | — | Any outreach send |
| 9 | DNS TXT for Search Console + Bing; enable Rank Math IndexNow | — | Indexing |
| 10 | `sudo pmset repeat wakeorpoweron MTWRFSU 06:55:00` | — | Digest punctuality (currently wakes 01:55) |

## Metrics, before and after
| | Before | After |
|---|---|---|
| Max card buy under the 5% guard | $50 | **$1,000** (after Safe tx #1) |
| Max card buy under 2% impact | $0 | **$500** (after Safe tx #1) |
| `app.` robots.txt | none — SPA HTML served with a 200 | real file, 11 agents named |
| `llms.txt` | 404 | live, self-updating |
| False public claims | 9 live | 0 on the app; 7 remain on WordPress |
| Consecutive unattended settlements | recorded as 1 in `CLAUDE.md` | **4** (rounds 9–12, verified from chain) |

Unchanged, and the number that should set the price: **23 registered players, 3 votes all
time, 3 Trophy NFTs.** The machine works and nobody is using it.

## Blocked, with the fastest unblock
| Part | Blocked on | Fastest unblock |
|---|---|---|
| 0 gate | Bridge password | two lines into `.env` (§Part 0 report) |
| 2 | no staging; WP write path limited to Elementor JSON | do the copy fixes in wp-admin instead — that is the part that matters |
| 3 | `IMAGE_API_KEY` | one line into `.env` |
| 4.6–4.7 | pool must exist; Transak key | Safe tx #1, then the key |
| 5 timelock | **self-imposed** — renouncing DEFAULT_ADMIN on an unupgradeable token is irreversible | fork-prove the full grant→wait→execute cycle first, as its own step |
| 6 | Play account type | one answer |
| 7 outreach | Bridge password + postal address | same as 0 |

## Parts that failed their own gate, and why that is the right outcome
**Part 5** requires "zero unresolved findings above informational." Two cannot be
resolved: supply is governed by the multisig (mitigable by timelock, not removable) and
the zero-value transfer reverts (unfixable without a token migration). The correct
response was disclosure, not a fix, and both are now stated on `/audit`, in `llms.txt`,
in the one-pager and in the SolidProof request.

**Part 7's queue** was deliberately left empty. A queue that cannot send, aimed at real
recipients, missing a legally required footer, is worse than no queue.

## One unambiguously good discovery
The `blacklisted` mapping that Blockaid and GoPlus flag **has no setter anywhere in the
contract**. No address can ever be blacklisted. That is a provable appeal argument, it
makes the planned "remove the blacklist" hardening unnecessary as well as impossible, and
combined with the token being immutable it is genuinely the strongest security story this
project has — much stronger than the audit claim it was replacing.

## Where everything is
```
outputs/sale/part_{0..7}_report.md     per-part detail
outputs/sale/sprint_report.md          this file
outputs/sale/safe/1_liquidity*         Safe tx #1 + summary + fork proof
outputs/sale/liquidity_forktest.md     full swap transcript
outputs/sale/data_room/                one-pager, round history, contracts, metrics
outputs/sale/listings/                 listing copy + outreach drafts
outputs/sale/solidproof_request.md     quote request, ready to send
outputs/audit/preaudit_2026-09-25.md   severity table + evidence
outputs/site/false_claims_2026-09-25.md  the disclosure log
outputs/site/crawl_before_after.md     crawl evidence
ops/sale/                              digest, metrics, launchd, status.json
scripts/sale/                          fork test, Safe builder, batch verifier, UA matrix
```
