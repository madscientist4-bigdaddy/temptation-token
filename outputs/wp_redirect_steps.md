# WP 301 — retire the stale `/audit` page

**Why:** `temptationtoken.io/audit` still lists `TTSVotingV3b 0x6d6fF6A0…` and the retired
staking proxy `0xaA12B889…` (drained to zero 2026-08-07). A CoinGecko/Blockaid reviewer who
checks those finds they don't match the deployment — worse than a 404. Direct edits are
blocked: the host strips the `Authorization` header and WP reports `authentication: []`,
so a 301 is the fastest correct fix.

**Destination:** `https://app.temptationtoken.io/audit` — verified correct (V3d, live
staking proxy, Trophy NFT). Substitute your own path if you'd rather keep it on the WP domain.

---

## Option A — Hostinger hPanel (preferred: no plugin, survives theme changes)

1. `hpanel.hostinger.com` → log in.
2. **Websites** → `temptationtoken.io` → **Dashboard**.
3. Sidebar → **Advanced** → **Redirects**.
4. **Redirect type:** `301 (Permanent)`.
5. **Redirect from:** domain `temptationtoken.io`, path box → `/audit`
   *(path only — no `https://`, no trailing slash).*
6. **Redirect to:** `https://app.temptationtoken.io/audit`
7. **Create.** It appears in the list within ~30 seconds.
8. Purge cache: **Advanced → Cache Manager → Purge All**. LiteSpeed will otherwise keep
   serving the old `200` for up to an hour and you'll think the rule failed.

## Option B — Redirection plugin (only if hPanel Redirects is unavailable)

1. `temptationtoken.io/wp-admin` → log in.
2. **Plugins → Add New** → search **Redirection** (John Godley) → Install → Activate.
3. **Tools → Redirection** → run the setup wizard, accept defaults.
4. **Add new redirection:**
   - Source URL: `/audit`
   - Target URL: `https://app.temptationtoken.io/audit`
   - Group: `Redirections`
   - ⚙ gear → **HTTP code: 301 — Moved Permanently**
5. **Add Redirect**, then purge cache as above.

## Verify (both forms — WordPress canonicalises `/audit` → `/audit/`)

```bash
curl -sI https://temptationtoken.io/audit  | head -3
curl -sI https://temptationtoken.io/audit/ | head -3
```

Want: `HTTP/2 301` plus a `location:` header pointing at the destination.
`HTTP/2 200` means WordPress served the old page — the rule didn't take, or cache is stale.

One-liner that passes only when both forms redirect:

```bash
for u in https://temptationtoken.io/audit https://temptationtoken.io/audit/; do
  printf "%s -> " "$u"; curl -sI "$u" | awk 'NR==1{print $2}'
done
```

## Gotchas that actually bite

- **Cache.** Purge after creating the rule, or you'll debug a rule that already works.
- **Trailing slash.** Create the rule for `/audit`; verify both forms.
- **Do not delete the old page** until the 301 is confirmed. Deleting first yields a 404,
  which is worse for scanner review than a stale page.
- **Not 302.** A temporary redirect won't transfer link equity and scanners may keep the
  old content cached against you.
