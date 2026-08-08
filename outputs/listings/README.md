# Listings package — 2026-08-08

| File | What it is |
|---|---|
| `coingecko_application.md` | Every CoinGecko form field, filled + your exact submission steps |
| `blockaid_appeal.md` | Ready-to-send re-appeal for ticket #1263614 + your exact steps |
| `circulating.mjs` | Run on submission day for a defensible circulating-supply figure |

## The /audit situation — read this first

The brief said /audit is a 404. **It isn't any more** — `https://temptationtoken.io/audit`
and `/trust` are both live on WordPress and return real pages.

The real problem was worse than a 404: **the live audit page lists the wrong contracts.**
It shows `TTSVotingV3b 0x6d6fF6A0…` as "Active" (superseded months ago — the live voting
contract is V3d `0x783b8cd8…`) and `TTSStaking 0xaA12B889…` (the old proxy, which was
drained to zero and retired on 2026-08-07; the live one is `0x7848cceE…`).

A reviewer at CoinGecko or Blockaid who clicks that page and checks the addresses will find
they don't match the live deployment. That is a worse outcome than a 404, because it looks
like the audit doesn't cover what's actually running.

**What I did:** published a corrected page at **https://app.temptationtoken.io/audit**
(served from `public/audit.html`, which I can deploy — the WordPress site I cannot, since
the `tts-api-auth` plugin still isn't installed). It lists V3d and the live staking proxy,
and links the Solidproof portal. The listing docs point at `temptationtoken.io/audit`
because that is the address you'll want long-term.

**What you need to do** — pick one:
- **Fast (5 min):** in WordPress, edit the /audit page's contract table: replace the V3b
  row with `TTSVotingV3d — 0x783b8cd80b586b723188c93ef94ee1beede617b4`, and replace the
  staking row with `TTSStaking — 0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d`. Nothing else
  on the page is wrong.
- **Or:** point `temptationtoken.io/audit` at `app.temptationtoken.io/audit` with a 301.
- **Or:** install the `tts-api-auth` plugin (`wp-plugins/tts-api-auth/`) and I can do it.

Until one of those happens, use `https://app.temptationtoken.io/audit` in the submissions —
it is correct today. Both are given in the docs so you can swap without re-editing.

## Suggested order

1. Fix the WP audit page (above) — both applications lean on it.
2. Send the **Blockaid appeal**. It costs nothing and a clean security reputation helps the
   CoinGecko review.
3. **CoinGecko last**, and only once there's some real liquidity/volume — see the warning
   in that doc. A rejection puts you in a cooldown, so it is worth waiting for a stronger
   pool than the current one (last swap 2026-04-02).
