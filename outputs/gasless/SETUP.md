# Gasless onboarding — what's built, and what needs YOUR accounts/keys

Status: **built, deployed, and OFF.** `GASLESS_ENABLED` is unset everywhere, so production
behaves exactly as before. Nothing below changes user experience until you do step 3.

---

## What works right now (no accounts needed)

| Piece | Where | State |
|---|---|---|
| Coinbase Smart Wallet connector (passkey / Face ID / email) | `src/config/wallet.js` | built, added to the connector list only when the flag is on |
| Sponsored-send helper with automatic fallback | `src/lib/gasless.js` | built |
| Vote flow: approve+vote as ONE sponsored batch | `src/App.jsx` (`PlayScreen.castVote`) | built |
| ERC-7677 paymaster proxy | `api/rpc.js` → `?action=paymaster`, rewritten as `/api/paymaster` | deployed, returns "disabled" until configured |
| Contract allowlist (decodes `execute`/`executeBatch` targets) | `api/rpc.js` | built + unit-tested, see below |
| Per-wallet/day + global/day caps | `api/rpc.js` | built, fail-closed |
| Feature flag | `src/config/gasless.js` (`VITE_GASLESS_ENABLED`) | off |

**Allowlist test results** (a batch mixing one allowed + one disallowed target must be
denied — this is the whole ballgame for not being used as a free relay):

```
single_ok     TTS token                          SPONSOR ✓
single_bad    0x…dEaD                            DENY    ✓
batch_ok      TTS + V3d                          SPONSOR ✓
batch_mixed   TTS + 0x…dEaD                      DENY    ✓
garbage       0xdeadbeef                         DENY    ✓
empty         0x                                 DENY    ✓
```

Only these may ever be sponsored: TTS `0x5570eA97…`, V3d voting `0x783b8cd8…`,
staking `0x7848cceE…`. Anything else is declined before it reaches the paymaster.

---

## What I CANNOT do without you

### 1. Coinbase Developer Platform paymaster (the actual gas money) — **required**
This is the only true blocker. It needs an account with a funded balance, which I can't create.

1. Sign in at **https://portal.cdp.coinbase.com** with the Coinbase account you want to
   own the gas budget.
2. **Onchain Tools → Paymaster & Bundler** → select network **Base Mainnet**.
3. Copy the **Paymaster & Bundler RPC URL**. It looks like
   `https://api.developer.coinbase.com/rpc/v1/base/<SECRET>`.
   **Treat it as a secret** — anyone with it can spend your gas budget. It goes in a Vercel
   env var, never in the frontend (our proxy is what the browser talks to).
4. In the same screen, set:
   - **Allowlisted contracts**: add `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9` (TTS),
     `0x783b8cd80b586b723188c93ef94ee1beede617b4` (V3d), and — if you want sponsored
     staking — `0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d`.
     Belt and braces: our proxy already enforces the same list.
   - **Per-user limit** and **global limit**: mirror whatever you set here in the Vercel
     env vars in step 3 so the UI's promise matches reality.
5. **Fund it.** Base gas is cheap — a vote costs well under a cent — but the budget is
   real money and it is what caps your exposure. Start small (e.g. $25) and watch it.

### 2. Supabase table for the daily caps — **required**
Run this in the Supabase SQL editor (project `gmlikdxykgviyprqtqwz`). Until it exists the
proxy fails **closed** — it declines sponsorship rather than running uncapped.

```sql
create table if not exists public.gasless_sponsorships (
  day        date        not null,
  wallet     text        not null,
  ops        integer     not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, wallet)
);

-- Server-only, like every other PII/accounting table here.
alter table public.gasless_sponsorships enable row level security;
revoke all on public.gasless_sponsorships from anon, authenticated;

create index if not exists gasless_sponsorships_day_idx
  on public.gasless_sponsorships (day);
```

### 3. Vercel env vars — **required to turn it on**
```
CDP_PAYMASTER_URL=https://api.developer.coinbase.com/rpc/v1/base/<SECRET>   # from step 1
GASLESS_ENABLED=true                        # server side: lets the proxy sponsor
VITE_GASLESS_ENABLED=true                   # client side: offers smart-wallet login
GASLESS_MAX_OPS_PER_WALLET_PER_DAY=10       # optional, default 10
GASLESS_MAX_OPS_GLOBAL_PER_DAY=2000         # optional, default 2000
VITE_GASLESS_OPS_PER_DAY=10                 # optional, keeps UI copy honest — match the above
```
Then redeploy (`npx vercel --prod`). **Both** flags must be true: the client one alone
offers smart-wallet login with no sponsorship; the server one alone sponsors a login
option nobody is shown.

---

## Privy fallback — not built, and I don't think you want it

The brief said "Privy fallback if blocked." Nothing is blocking us: Coinbase Smart Wallet
works through our existing AppKit/wagmi stack with one connector, and Base's own paymaster
is the cheapest sponsorship path. Privy would add a second auth vendor, a second SDK, its
own pricing, and a migration story for anyone who onboarded under it.

I'd only reach for it if you specifically want **social logins beyond passkey/email**
(Google/Twitter/Discord) or a **non-Coinbase-branded** flow. Say the word and I'll add it
behind the same flag — it's a contained change, roughly a day.

---

## Honest caveats

- **Untested against a real paymaster.** Every layer is exercised except the CDP round
  trip, because that needs step 1. The proxy correctly returns
  `{"error":{"code":-32001,"message":"gasless sponsorship is disabled"}}` today.
- **The batch→tx-hash resolution** (`waitForCallsTxHash`) is how sponsored votes still get
  recorded server-side and still earn the vote-match bonus. It's the piece most likely to
  need a tweak against real CDP behaviour — first thing to check if sponsored votes land
  on-chain but don't show up in the dashboard.
- **Caps are per calendar day, UTC**, counted on grant (`pm_getPaymasterData`), not on the
  stub call. A user who is granted sponsorship and then abandons the tx still burns one of
  their 10 — the alternative (count on confirmation) is gameable.
- **Sponsored ≠ free for us.** Every sponsored vote costs the CDP balance. The per-wallet
  cap is your abuse ceiling; the global cap is your daily spend ceiling. Set both.
