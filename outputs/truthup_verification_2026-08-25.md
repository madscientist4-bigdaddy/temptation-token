# Truth-Up Run — Deployment Verification

**Verified:** 2026-08-25  
**Commit under test:** `2c90580` — *truth-up: dashboard, content generator and post queue now match reality*  
**Deployment:** `dpl_HZcouvZXkRnj3EPuKoZb6GNYm9Ts` · production · READY · built 2026-08-22 14:22:41 EDT  
**Aliases:** app.temptationtoken.io · temptationtoken.io · www.temptationtoken.io

Verdict: **2 of 3 claims confirmed. The third is false — and larger than described.**

---

## Summary

| Claim | Status |
|---|---|
| Dashboard shows keeper autopilot as primary | ✅ Confirmed in the live bundle |
| Chainlink marked as outage | ✅ Confirmed in the live bundle |
| Content-generator claim removed | ✅ Confirmed in the deployed commit |
| False X post removed | ❌ **Not removed. Not one post — 9 on X, 23 on Telegram, all still live.** |

## 1. Deployment provenance

The running production deployment is built from the truth-up commit itself, not a later or earlier tree:

```
commit sha : 2c90580a1001cc0770b6cd9fc98d3df492b15a3b
commit msg : truth-up: dashboard, content generator and post queue now match reality
branch     : main
readyState : READY
target     : production
```

The build started 39 seconds after the commit. `main` is level with `origin/main`; the only commit since is
`7e294ab`, which adds a single markdown file and changes nothing that deploys.

## 2. Dashboard — verified against the deployed artifact

Checked by downloading the live JS bundle from `app.temptationtoken.io`, not by reading source. Bundle:
`/assets/index-Aoi3WAWS.js`.

**Present:**

| String | Occurrences |
|---|---|
| `Keeper Autopilot` | 2 |
| `OUTAGE since 2026-08-05` | 2 |
| `43.97 LINK recoverable` | 2 |
| `driverAlive` | 2 |
| `replaced by the keeper autopilot` | 1 |

**Gone — every pre-truth-up assertion returns zero hits:**

| String | Occurrences |
|---|---|
| `Chainlink crons confirmed` | 0 |
| `crons confirmed` | 0 |
| `Cron Schedule` | 0 |
| `Chainlink Automation settles` | 0 |
| `settled by Chainlink` | 0 |
| `Automation confirmed` | 0 |

**Ordering — autopilot really is primary.** In bundle byte order, the Keeper Autopilot card is emitted
at offset 1,696,296 and the Chainlink outage card at 1,700,316. Autopilot renders first.

The Chainlink card now reads: *OUTAGE since 2026-08-05, registry-wide (all ~191 upkeeps). Superseded by
the keeper autopilot; 43.97 LINK recoverable later.*

## 3. Content generator — confirmed

`api/content-generator.js` shipped in the deployed commit. The canonical schedule line changed from
attributing settlement to Chainlink, to:

> Settlement: triggered automatically by our own keeper shortly after close, then Chainlink VRF selects the winner on-chain

CRITICAL RULE 2b is in place, drawing the distinction the whole cleanup depends on: **Chainlink VRF is live
and true and stays sayable; Chainlink Automation is dead.** The CI rule in `check-prize-split.mjs` encodes
this as seven specific claim shapes rather than a blanket "chainlink near settlement" heuristic, so it
cannot condemn correct VRF copy.

## 4. The post queue — where it diverges

### Pending queue: clean

33 pending posts mention Chainlink. **Zero** match a banned claim shape when the CI regexes are applied to
them directly. They are VRF copy, which is true and meant to stay. Nothing to do here.

### Published posts: never touched

The truth-up run skipped **pending** posts. It never had anything to say about posts already sent. Applying
the same CI claim shapes to `status = 'posted'`:

| Cohort | Count |
|---|---|
| Published posts matching a banned claim shape | 49 |
| — sent **before** 2026-08-05, when the claim was true | 17 |
| — sent **on or after** 2026-08-05, when it was false | **32** |
| &nbsp;&nbsp;&nbsp;&nbsp;on X (`x_tts`) | 9 |
| &nbsp;&nbsp;&nbsp;&nbsp;on Telegram | 23 |

The 17 pre-outage posts are not errors — Chainlink Automation genuinely fired settlement then. Only the 32
post-outage ones asserted something untrue at the moment they were sent.

The newest, `4b28080f`, went out 2026-08-17 00:20 — twelve days into the outage, while rounds were being
closed by hand roughly 17.7 hours late:

> Round 6 closes tonight at 11:59 PM EDT. Chainlink fires settlement within minutes. Losing votes burn.

All 32 remain `status = 'posted'`. **Changing that column would accomplish nothing** — the row is a record of
a send, not the post. The posts themselves are live on X and Telegram until someone deletes them there.

### Complication: no post IDs were ever recorded

`scheduled_posts` has no `tweet_id`, `message_id`, or URL column:

```
id · platform · post_type · day_of_week · scheduled_at · content · instagram_captions
selected_caption · image_hint · status · week_start · posted_at · error · created_at · media_asset_id
```

The publisher never stored where anything landed. These have to be located by hand on the timeline, matched
by timestamp and opening text. The worklist below is ordered by send time to make that scan linear.

---

## 5. Worklist — 32 posts to delete or correct

Sorted oldest first. `posted_at` is UTC, as stored.

### X — @temptationtoken (9)

**1. `a8bf87d1-71e4-42fc-bef5-2e8a3f2b1500`** — posted 2026-08-08 00:45 UTC

> Round 6. Top voter gets 35%. Winning profile gets 35%. @PolarisProject gets 10%. Chainlink settles it Sunday at 11:59 PM EDT. $TTS app.temptationtoken.io

**2. `fac8e6e8-4372-41e1-8158-75aefe5f9cff`** — posted 2026-08-09 13:31 UTC

> Final day. Round 6 closes tonight — Sunday, August 9, 11:59 PM EDT. Chainlink settles automatically. Losing votes burn. One shot left to get on the right side. $TTS app.temptationtoken.io

**3. `ee355043-58f4-4db1-aea3-199e45cecfa4`** — posted 2026-08-10 00:10 UTC

> Round 6 is live. Settlement fires automatically via Chainlink the moment the round closes Sunday 11:59 PM EDT. No manual trigger. No delay. $TTS app.temptationtoken.io

**4. `43b70609-3c05-4827-ae06-9106147026c5`** — posted 2026-08-10 00:10 UTC

> Hours left in Round 6. Top voter wins 35% of the prize pool. Only winning-side votes count. Chainlink settles tonight at 11:59 PM EDT. Move now. $TTS app.temptationtoken.io

**5. `e2648951-0d47-4c00-99fb-99e512ecd207`** — posted 2026-08-10 00:10 UTC

> Round 6 closes at 11:59 PM EDT tonight. Settlement fires via Chainlink within minutes. Last votes. Last chance. Losing votes burn at close. $TTS app.temptationtoken.io

**6. `bb7ec164-caee-465e-8b59-aa2596faa1a7`** — posted 2026-08-11 19:20 UTC

> Chainlink automation fires settlement within minutes of round close — no waiting, no admin, no trust required. On-chain, verifiable, final. $TTS on Base mainnet. app.temptationtoken.io

**7. `1c0ff9bb-9d64-4b03-bd36-b7894f49b50a`** — posted 2026-08-15 13:57 UTC

> Tomorrow night. Round 6 closes Sunday, August 16 at 11:59 PM EDT. Settlement fires via Chainlink automatically. Losing votes burn. Last chance to vote right. app.temptationtoken.io $TTS

**8. `e380bd81-a655-47ac-b696-2c32b39940ff`** — posted 2026-08-16 13:57 UTC

> Final day. Round 6 closes tonight — Sunday, August 16 at 11:59 PM EDT. Settlement fires automatically via Chainlink. Vote now or watch it close. app.temptationtoken.io $TTS

**9. `4b28080f-c5c2-472a-af7b-e8b0ddc72437`** — posted 2026-08-17 00:20 UTC

> Round 6 closes tonight at 11:59 PM EDT. Chainlink fires settlement within minutes. Losing votes burn. Round 7 opens Monday 12:00 AM EDT. $TTS app.temptationtoken.io

### Telegram (23)

**1. `33165719-13ee-4426-ba8c-35e973e26f4b`** — posted 2026-08-05 00:08 UTC

> Settlement fires automatically via Chainlink within minutes of Sunday, August 9, 11:59 PM EDT.

**2. `ebef8ba3-600e-44ff-9011-2c604b18b6aa`** — posted 2026-08-05 00:08 UTC

> Temptation Token uses <i>Chainlink</i> to fire settlement automatically within minutes of round close. No admin can delay or alter it.

**3. `9cbda86b-c683-4763-9a35-00c9c3da4a09`** — posted 2026-08-05 13:18 UTC

> Round closes Sunday, August 9, 11:59 PM EDT — Chainlink fires settlement automatically.

**4. `2917f214-5c70-4f41-9e10-0f012f6fa791`** — posted 2026-08-07 13:18 UTC

> Settlement fires automatically via Chainlink at close — Sunday, August 9, 11:59 PM EDT.

**5. `5484cad3-eea8-40dd-a0d2-d0748fb8abe1`** — posted 2026-08-08 00:45 UTC

> When Chainlink fires settlement on Sunday, August 9, 11:59 PM EDT:

**6. `e035f6b0-4e98-4488-98d9-af0fd9f706dc`** — posted 2026-08-08 13:05 UTC

> This is not a drill. Settlement fires automatically via Chainlink at Sunday, August 9, 11:59 PM EDT — and it is irreversible.

**7. `96f99151-6cff-4b6a-9998-e1e4bb6b31be`** — posted 2026-08-10 00:10 UTC

> When Round 6 closes Sunday, August 9 at 11:59 PM EDT, settlement fires automatically via Chainlink within minutes. No admin, no manual trigger, no delay.

**8. `fcae04fb-0bee-48f8-aa75-a6f0adf2cf9e`** — posted 2026-08-10 00:10 UTC

> Sunday, August 9 at 11:59 PM EDT — that is when Chainlink triggers settlement. Within minutes, prizes distribute, losing votes burn, and Round 7 clock resets.

**9. `17ba762c-237f-4282-965c-78a9fe01823a`** — posted 2026-08-10 00:10 UTC

> <i>Both splits are exact and hardcoded.</i> Settlement is automatic via Chainlink within minutes of Sunday, August 9 at 11:59 PM EDT.

**10. `d635bec5-3268-424a-a1fc-e57a290bd183`** — posted 2026-08-10 00:10 UTC

> • Chainlink automation: settlement fires within minutes of close

**11. `1428ac95-bbed-4dcc-b202-659a481a3d3c`** — posted 2026-08-10 00:10 UTC

> <i>Within minutes of close, Chainlink fires settlement automatically.</i>

**12. `3783cffd-8147-4e7a-80a8-2daea39f9f16`** — posted 2026-08-10 00:10 UTC

> This is the last window. After 11:59 PM EDT tonight, Chainlink fires settlement automatically within minutes. Prizes go out. Losing votes burn. Round 6 is sealed.

**13. `818c2a99-4681-4b7a-b1f8-2961634524fb`** — posted 2026-08-11 17:46 UTC

> Round 6 is open right now. Settlement fires automatically via Chainlink the moment the round closes Sunday night. No manual intervention. No delay.

**14. `030a5b0d-781f-47b7-a61a-b7330a34acb3`** — posted 2026-08-11 17:46 UTC

> The top voter in that pool takes <b>35%</b>. The winning profile earns <b>35%</b>. <b>10%</b> goes to <i>@PolarisProject</i>. Settlement fires automatically via Chainlink within minutes of round close.

**15. `31db45f1-1946-4fbb-a08e-050e3b26d950`** — posted 2026-08-11 19:20 UTC

> When Round 6 closes Sunday, August 16 at 11:59 PM EDT, Chainlink fires the settlement contract automatically within minutes. No admin button. No delay. No trust required.

**16. `52222d34-b498-4a40-8451-040936a39edd`** — posted 2026-08-12 18:32 UTC

> When you vote in Round 6, part of that prize pool goes to a cause that matters. Settlement fires automatically via Chainlink — charity payout included.

**17. `6430b200-d72e-4e56-8956-41fafe213427`** — posted 2026-08-13 13:57 UTC

> • <b>Chainlink automation</b> — settlement fires without manual intervention

**18. `dc81797d-2da2-4aa1-9faa-813352b769dc`** — posted 2026-08-13 18:37 UTC

> The window is narrowing. Round 6 closes <i>Sunday, August 16 at 11:59 PM EDT</i>. Settlement fires automatically via Chainlink within minutes.

**19. `0d068529-c32c-4657-8902-1057528f6bbd`** — posted 2026-08-14 18:37 UTC

> Round 6 closes <i>Sunday, August 16 at 11:59 PM EDT</i>. Settlement fires via Chainlink automatically. Prize split: <b>35% top voter · 35% winning profile · 10% @PolarisProject · 20% house</b>.

**20. `f6266ee5-cf5c-47b1-b71e-3aef0b6fc2ad`** — posted 2026-08-15 13:57 UTC

> At close, Chainlink fires settlement automatically. Votes on the winning profile form the prize pool. Every other vote is burned to the dead address — permanently. There is no partial credit, no consolation, no refund.

**21. `0d5d1b2b-994d-42cb-9355-78b705a3e177`** — posted 2026-08-16 13:57 UTC

> This is it. Round 6 closes <i>Sunday, August 16 at 11:59 PM EDT</i>. Chainlink fires settlement within minutes of that timestamp. Prizes are distributed automatically.

**22. `b74d663a-277e-4fbc-85b2-0f70c7fe9f9b`** — posted 2026-08-16 18:53 UTC

> Round 6 closes tonight at <i>11:59 PM EDT</i>. There are no extensions, no exceptions, and no manual overrides — Chainlink fires settlement automatically the moment the round closes.

**23. `b2916e17-cdc1-4418-8104-3885aa786bc8`** — posted 2026-08-17 00:20 UTC

> Round 6 closes at <i>11:59 PM EDT tonight</i>. Chainlink automation fires settlement within minutes — prizes distribute, losing votes burn, the round is sealed.

---

## 6. What is actually left to do

1. **Delete or correct the 9 X posts.** These are the public-facing ones and the reason this matters.
2. **Delete or correct the 23 Telegram messages.** Telegram permits editing in place, which may be preferable
   to deleting — an edited message keeps the thread intact.
3. **Decide on a correction notice.** Nine posts over ten days told followers settlement was automatic while
   it was manual and late. Silent deletion is an option; so is one post saying what happened. That is a call
   about the audience, not a technical one.
4. **Consider recording post IDs going forward.** Adding a `platform_post_id` column to `scheduled_posts`
   would make the next retraction a query instead of a manual timeline scan.

Items 1–3 are outside what the truth-up commit set out to do. It fixed everything that generates *future*
copy — dashboard, generator, CI guard, pending queue — and that part is genuinely done and deployed. What
it did not do, and did not claim to do, is reach back to what had already been sent.
