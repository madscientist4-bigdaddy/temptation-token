# INTERNAL BRIEFING — NOT LEGAL ADVICE

**Re:** Temptation Token / $TTS legal-risk map (privileged & confidential; work product for outside-counsel intake)
**Date:** 2026-08-04
**Product:** "Hot or Not" photo-voting game on Base mainnet (chain 8453). Paid voting in $TTS; weekly rounds settled by Chainlink VRF; vote-weighted random prize draw; staking program (8–45% APR) about to launch; commemorative NFTs of submitted likenesses; gov-ID + selfie retained for every submitter; AI-agent-driven marketing.

> This memo flags issues and frames questions. It is not a legal opinion and does not create an attorney-client privilege by itself. Do not distribute outside the company. Several mechanics below (paid votes → VRF draw → payout; fixed-APR staking; likeness NFTs) sit on top of the highest-risk fact patterns in current U.S. crypto enforcement and should be treated as launch-blocking until counsel clears them.

---

## 1. Lottery / Illegal-Gambling Analysis — Paid Votes + VRF Draw + Prize Pool

### The mechanic, mapped to the three elements
A promotion is an illegal lottery/gambling scheme in nearly every state when it combines **(1) consideration, (2) chance, and (3) prize** ([US Sweeps – Prize/Chance/Consideration](https://ussweeps.com/about-us/blog/sweepstakes-law/sweepstakes-101/); [Sweeppea state guide](https://www.sweeppeasweeps.com/sweepstakes-and-contest-rules-by-state.html)). Our mechanic hits all three cleanly:

- **Consideration — PRESENT and strong.** Voters spend $TTS (min 5 TTS/vote) to participate, and losing-profile votes are **burned**. That is payment plus risk of loss — the textbook definition of consideration for gambling purposes, which specifically contemplates "payment and risk of loss" ([Klein Moynihan Turco / Lexology](https://www.lexology.com/library/detail.aspx?g=0a16536c-4f6f-48ed-966f-a8d43b676f10)). Because tokens are destroyed on a losing bet, this looks more like a **wager** than a sweepstakes entry fee. Note also **indirect/"digital" consideration**: even non-cash effort or value can count ([tecpinion AMOE](https://www.tecpinion.com/knowledge-hub/no-purchase-necessary-amoe-sweepstakes/)).
- **Chance — PRESENT.** The winner is drawn by **Chainlink VRF**, a verifiable *random* function. Randomness is the core of "chance." Our draw is **vote-weighted** (more votes/tickets = higher probability), which does **not** cure chance — it is exactly the structure of a raffle/lottery (buy more tickets, better odds, still random). The weighting blends *participation* with *chance* but the dispositive event is still a random draw.
- **Prize — PRESENT.** $TTS payouts to Top Voter (35%) and Winning Profile (35%); economic value regardless of token-vs-cash form.

**Bottom line:** As currently designed, the core loop looks like an **unlicensed lottery/illegal gambling** in most states. This is the single highest-severity finding in this memo.

### Why "it's a skill contest / Hot-or-Not judging" probably fails
States apply one of three tests to separate skill from chance ([Wikipedia – Dominant Factor Test](https://en.wikipedia.org/wiki/Dominant_Factor_Test); [Thompson Coburn](https://www.thompsoncoburn.com/insights/is-it-a-game-of-chance-or-a-game-of-skill/)):
- **Dominant/Predominant Factor Test** (majority of states): is skill or chance the controlling factor?
- **Material Element Test** (e.g., NY-type analysis): does chance have more than an incidental effect?
- **Any Chance Test** (strictest, minority): *any* chance taints it.

Under **all three**, our winner-selection is problematic because the *final winner* is chosen by a random VRF draw, not by which photo objectively "won." Even if voting has a skill/judgment flavor, the payout event is random → fails the Material Element and Any-Chance tests outright, and likely the Dominant Factor test too because chance *determines the winner*.

### State-by-state themes (grouped, not all 50)
- **Strictest / "any chance" + aggressive AGs (avoid or geofence):** These states treat consideration + any chance as gambling and are actively policing crypto "dual-currency" and sweepstakes-coin models. **NY** is the leading example: in June 2025 the AG forced 26 platforms to stop selling sweepstakes coins and NY enacted **Racing, Pari-Mutuel Wagering and Breeding Law §912** banning covered online dual-currency casino-style games ([Ifrah Law](https://www.ifrahlaw.com/ftc-beat/new-federal-court-decision-counsels-clear-and-conspicuous-advertisement-of-alternative-means-of-sweepstakes-entry-coinbase-suit-proceeds/); [Arrowhead 2026 guide](https://arrowheadpromotion.com/sweepstakes-legal-compliance-guide/)). **LA AG Opinion 25-0083 (July 2025)** found comparable platforms violate existing gambling law ([Arrowhead](https://arrowheadpromotion.com/sweepstakes-legal-compliance-guide/)). Treat WA, MI, MT, and similar sweepstakes-hostile states in this bucket.
- **Registration/bonding states for prize promotions:** e.g., FL, NY, RI require registration/bonding above prize thresholds for legitimate no-purchase sweeps ([Arrowhead](https://arrowheadpromotion.com/sweepstakes-legal-compliance-guide/)).
- **More permissive skill-contest states:** allow bona fide skill contests, but only if chance is truly removed — which our VRF draw defeats ([Walters Law Group – skill gaming by state](https://www.firstamendment.com/list-states-skill-gaming-allowed-prohibited/)).

### The standard cures — mapped concretely to OUR mechanics
| Cure | How it works | Fit to Temptation Token |
|---|---|---|
| **AMOE (free alternate entry)** | Remove *consideration* by offering a **free, equal-dignity** path to the same prize odds. The free method must be **truly equal** — not harder, slower, or less visible than paid; "equal dignity" is the recurring failure point, and a 2025 federal decision (Coinbase sweepstakes suit) requires the free entry be advertised **clearly and conspicuously** ([Ifrah Law](https://www.ifrahlaw.com/ftc-beat/new-federal-court-decision-counsels-clear-and-conspicuous-advertisement-of-alternative-means-of-sweepstakes-entry-coinbase-suit-proceeds/); [Fasthoff – equal dignity](https://fasthofflawfirm.com/blog/sweepstakes-alternate-method-of-entry-equal-dignity)). | **POOR fit as built.** Our prize *is the pool of paid, burned votes*. A free entrant would have to receive the same odds and payout **without spending/burning TTS**, which breaks the economic model (pool = winning profile's raw *paid* votes). Retrofitting a genuinely equal free entry likely guts the tokenomics. Feasible only with a redesign (e.g., house-funded prize pool decoupled from paid votes + free-entry tickets). |
| **Skill-based judging (remove chance)** | Winner determined by *objective skill/judging criteria*, not a random draw. | **POOR fit as built** because the VRF random draw is the whole settlement mechanic. Would require replacing VRF selection with deterministic, criteria-based scoring — a fundamental architecture change and arguably not our product. |
| **Geo-fencing / excluded states** | Block ineligible states (and non-U.S. sanctioned jurisdictions) at the wallet/UI + on-chain level. | **PARTIAL fit / necessary but insufficient.** Reduces exposure in the strictest states but (a) is hard to enforce for a permissionless on-chain contract (users bypass the web UI), (b) does not fix the base characterization in the ~40+ remaining states, and (c) crypto geofencing is easily evaded → weak defense. Combine with the above, not as a standalone cure. |

**Recommendation:** Do not treat any single cure as sufficient. The cleanest de-risk is to **decouple the prize pool from paid/burned votes** (house-funded prize + genuine free AMOE) **or** convert to true skill-judged selection (no VRF winner draw). Absent one of those, assume material illegal-gambling exposure.

---

## 2. Howey / Securities Analysis — 8–45% APR Staking Program

### The mechanic
Advertised tiers: Bronze $50+ **8%** / Silver $100+ **12%** / Gold $250+ **18%** / Diamond $1,000+ **32%** / VIP $5,000+ **45% APR**, plus 1.1x–3x vote multipliers, "rewards paid from a balance-based reward surplus."

### Howey applied
- **Investment of money — YES.** Users lock/stake $TTS (value) to earn returns.
- **Common enterprise — LIKELY.** Rewards funded from a shared "reward surplus"/treasury; pooled fortunes tied to the program's economics.
- **Expectation of profit — STRONGLY YES.** We **advertise fixed APR percentages**. A promised percentage yield is the paradigmatic "expectation of profit." The tiered, dollar-denominated, fixed-rate presentation reads like a fixed-income product.
- **From the efforts of others — YES.** Returns depend on the company managing the token, funding the surplus, and running the program — not the staker's own work.

**All four prongs are met on the current framing → high securities risk.** This is the second launch-blocking item.

### Current SEC posture — cuts both ways, read carefully
- **Enforcement precedent still on the books (the risk).** SEC's **Feb 2023 Kraken settlement ($30M)** treated *staking-as-a-service* as an unregistered securities offering and shut the program for U.S. customers; the **June 2023 Coinbase** suit attacked staking on the same theory ([DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/06/sec-staff-concludes-protocol-staking-activities); [HOGE Wire enforcement](https://hoge.gg/sec-crypto-enforcement-2026-what-changed/)).
- **2025 staff relief — narrow, and it does NOT obviously cover us.** In **May 2025** SEC staff said **protocol staking** (solo/delegated/custodial on a proof-of-stake network) is *not* a securities offering because rewards pay for **"ministerial," mechanical validation work — not anyone's entrepreneurial judgment**; on **Aug 5, 2025** staff extended this to certain **liquid staking** receipt tokens as mere evidence of deposited assets ([DLA Piper](https://www.dlapiper.com/en/insights/publications/2025/06/sec-staff-concludes-protocol-staking-activities); [Everstake summary](https://everstake.one/resources/blog/sec-staking-guidance-explained)).
  - **Why the relief likely does NOT save us:** Our program is **not protocol/consensus staking**. There is no proof-of-stake validation — TTS is an ERC-20 on Base and "staking" here is a **promotional yield/rewards program funded by a company-controlled surplus**. That is precisely the *entrepreneurial-effort* return the staff carved OUT, not the ministerial-validation return it blessed. The fixed 8–45% APR makes it look even more like a yield product than the Kraken program.
  - The relief is **staff-level, non-binding, and contested**: **Commissioner Crenshaw dissented**, noting a court had already found staking fits "comfortably within" 80 years of securities precedent ([SEC – Crenshaw statement](https://www.sec.gov/newsroom/speeches-statements/crenshaw-statement-protocol-staking-052925)). Staff no-action posture can reverse with administration change; only **Congress** can durably settle it ([Astraea Counsel](https://astraea.law/insights/ethereum-staking-regulation-institutions-2026)).

### Lower-risk restructures (in order of protectiveness)
1. **Kill fixed APR promises.** Remove all advertised percentages ("8%…45%"). Fixed, dollar-tier yield is the single most damaging fact. Replace with **variable, discretionary, non-guaranteed** rewards.
2. **Reframe as utility, not yield.** Position "staking" as **locking for in-game benefits** (vote multipliers, access, cosmetic tiers) rather than a return *on investment*. The multiplier utility is a better story than APR.
3. **Sever returns from "efforts of others."** Avoid language implying the company grows the pool through its managerial/entrepreneurial effort; avoid a company-funded "surplus" narrative.
4. **Rename.** "Staking" now carries securities baggage even post-2025 relief; consider "rewards," "loyalty tiers," or "boost."
5. **Do not launch the APR tiers as advertised** without counsel sign-off. Treat the current tier sheet as marketing that itself creates securities-offering evidence.

---

## 3. Right of Publicity + Biometric Privacy (BIPA / CUBI / Washington)

### (a) NFT likenesses of submitted people
Right of publicity requires **(1) use of a person's name/likeness, (2) for commercial purposes, (3) without consent** ([Traverse Legal](https://www.traverselegal.com/blog/what-is-right-of-publicity/)). California adds a fourth (resulting injury) and recognizes **both statutory and common-law** claims. Minting commemorative NFTs **depicting the winning submitted photo/likeness** is a commercial use of that person's likeness — squarely within the tort. NFT likeness suits are already live (e.g., **Lil Yachty v. Opulous**, right-of-publicity + trademark over NFT use of name/likeness) ([The Fashion Law](https://www.thefashionlaw.com/lil-yachty-is-suing-nft-co-over-unauthorized-use-of-his-name-likeness/); [Gamma Law](https://gammalaw.com/star-power-nfts-and-the-right-of-publicity/)).
- **Consent posture:** Submitter consent at submission helps **only if** the consent scope **expressly covers NFT minting, sale, on-chain permanence, and commercial exploitation of likeness** — and only for the *submitter's own* likeness. **Third-party photos** (submitter uploads someone else's face) create direct, unconsented exposure. **Photo-mode being OFF pending legal is the correct posture — keep it off until consent scope is nailed down and third-party-image risk is controlled.**
- **On-chain permanence problem:** NFTs are effectively **irrevocable**; a later consent withdrawal or a wrongly-approved third-party image cannot be un-minted. Right-of-publicity/privacy consent that can't be honored (no deletion) is a structural risk.

### (b) Storing/matching gov ID + dated selfie = biometric identifier risk
Face-geometry from a selfie, and **face-matching a selfie against the ID photo**, is collection/use of a **biometric identifier**. This triggers state biometric statutes:
- **Illinois BIPA (740 ILCS 14):** requires **written consent before** collecting face scans; **$1,000–$5,000 per violation**; has a **private right of action** (the reason it drives most litigation) ([Recording Law – BIPA](https://www.recordinglaw.com/us-laws/data-privacy-laws/bipa/)). Recent developments: the **Aug 2024 amendment** limits repeated same-method collection to a **single violation**, and the **Seventh Circuit (Apr 1, 2026)** held that limit applies **retroactively** to pending cases ([Hunton](https://www.hunton.com/privacy-and-cybersecurity-law-blog/illinois-damages-limitation-for-biometric-privacy-violations-applies-retroactively); [GT / DWT](https://www.gtlaw.com/en/insights/2024/8/bipa-update-illinois-limits-liability-and-clarifies-electronic-consent-for-biometric-data-collection)). Exposure is reduced but **not eliminated** — **100+ new BIPA class actions were filed in 2025**, with courts specifically targeting **AI/facial-recognition** defendants ([WilmerHale 2024 review](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20250219-year-in-review-2024-bipa-litigation-takeaways)).
- **Texas CUBI:** notice + consent **before** capturing biometric identifiers (incl. face geometry) for commercial purposes; **no private right of action** but **AG-enforced**, and the AG is aggressive — **$1.4B Meta** and **$1.375B Google** CUBI settlements in 2024–2025 ([Bracewell](https://www.bracewell.com/resources/billion-dollar-liability-understanding-your-obligations-under-the-texas-capture-or-use-of-biometric-identifier-act/); [Zwillgen](https://www.zwillgen.com/privacy/texas-cubi-law-and-biometric-privacy/)).
- **Washington:** **HB 1493 (2017)** biometric law (no private right of action) plus **My Health My Data Act (2024)** — the latter has a **private right of action** and broad consent/deletion duties that can reach biometric data ([OGC](https://outsidegc.com/blog/biometric-data-protection-a-growing-trend-in-state-privacy-legislation/); [Recording Law – state biometric](https://www.recordinglaw.com/us-laws/data-privacy-laws/biometric-privacy-laws/)).

**Consent posture / cures:** Whether we run true face-*matching* (biometric) vs. mere document *retention* (not biometric) is dispositive. If we run 1:1 face match, we need: **standalone written biometric consent** (separate from ToS, pre-collection), a **published retention + destruction schedule**, a **vendor DPA** (many providers use a face-match SaaS — the SaaS may also be a collector), and **geofencing IL/TX/WA** as a fallback. Access-logged private storage helps but does not satisfy the *consent-before-collection* and *retention-schedule* mandates on its own.

---

## 4. 18 U.S.C. § 2257 — Records-Keeping Adjacency

- **When § 2257 actually bites:** it applies to producers of visual depictions of **actual sexually explicit conduct** (and **§ 2257A** to **simulated** sexually explicit conduct), requiring age verification via ID exam, indexed records, and a records-custodian/location label on each depiction ([Cornell LII – 18 USC 2257](https://www.law.cornell.edu/uscode/text/18/2257); [EFF Internet Law Treatise](https://ilt.eff.org/2257_Reporting_Requirements.html); [DOJ certifications](https://www.justice.gov/criminal/criminal-ceos/18-usc-2257-2257a-certifications)). Non-compliance is criminal — **up to 5 years (first offense), 10 (subsequent)**.
- **Our posture:** If content stays **non-explicit** ("Hot or Not" photos, no sexual conduct/simulation), **§ 2257 does not apply on its face** — the statute is triggered by explicit or simulated-explicit conduct, not attractiveness or suggestiveness.
- **Why our gov-ID-on-file practice is a genuine asset:** we already **ascertain age by ID examination and retain records** for every submitter — i.e., we are voluntarily doing the *core* thing § 2257 demands. That materially blunts the worst-case (an image slips over the explicit line), and it addresses the **child-protection floor** that applies regardless of § 2257.
- **Where the line is (watch it):** the risk is **content drift**. If user submissions become sexually explicit or simulated, we cross into § 2257/2257A **producer** obligations (indexed records, labeling, custodian statement) — and the far more serious **18 U.S.C. § 2252/§ 2251 (CSAM)** exposure if any minor slips through. **Cures:** enforce a **no-explicit-content policy** with active moderation, keep the age-verified ID records **indexed and cross-referenced** (2257-style even though not strictly required — cheap insurance), and adopt a **written records-retention + custodian** protocol now so that if the content line moves we are already compliant. Note **18 U.S.C. § 2255** (civil remedy for victims) as downstream civil exposure if moderation fails.

---

## 5. Money Transmission / AML / KYC — Paying Winners in $TTS

### FinCEN / MSB analysis
- Under FinCEN's 2013/2019 CVC guidance, **virtual-currency exchangers and administrators are money transmitters** subject to full BSA obligations; but a project that merely **issues/distributes its own pre-mined token as payment** for goods/services or obligations is generally **not** an MSB for that act ([Hodder Law](https://hodder.law/fincen-crypto-guidance/); [terms.law MSB guide](https://terms.law/Trading-Legal/guides/msb-registration.html)).
- **Where we likely stay outside MSB status:** paying **prize winners in our own $TTS** from the contract looks like distributing our own token, not transmitting third-party value → probably not money transmission *standing alone*.
- **Where we likely tip INTO it:** if we (a) let users **exchange TTS↔fiat or TTS↔other crypto**, (b) run a **custodial wallet / hold user funds**, or (c) operate the **staking pool as an omnibus** taking and returning others' value, we start to look like an **exchanger/administrator/custodian** → **FinCEN MSB registration within 180 days** (free, Form 107, renew biennially) **plus a full AML program** ([terms.law](https://terms.law/Trading-Legal/guides/msb-registration.html); [LegalClarity](https://legalclarity.org/fincen-msb-registration-requirements-and-how-to-file/)).

### State money-transmitter licenses (MTLs)
Federal MSB registration **does not** satisfy state law — most states require **separate MTLs**, and you need **both** ([Wolters Kluwer](https://www.wolterskluwer.com/en/expert-insights/money-transmitter-business-license-requirements)). State MTL themes: bonding, minimum net worth, per-state application/exam. Crypto-inclusive states (e.g., NY BitLicense) are the harshest. This is a large, expensive workstream **if** we cross into transmission — another reason to keep payouts strictly to our own token and avoid custody.

### Sanctions / OFAC — applies regardless of MSB status
OFAC screening obligations attach to **any** U.S. person facilitating crypto transfers. Enforcement expects **lifetime-of-relationship screening against the SDN list**, **in-process geolocation checks**, and a documented program — not just onboarding ([ABA – OFAC crypto settlements](https://www.americanbar.org/groups/business_law/resources/business-law-today/2023-march/fair-warnings-from-ofacs-settlements/); [Sanctions Lawyers – OFAC screening 2026](https://sanctionslawyers.net/ofac-lawyers/ofac-screening-guide/)). Concrete needs for us:
- **Wallet screening** of participants/winners against SDN/blocked-address lists before payout.
- **Geo-blocking** sanctioned jurisdictions (Cuba, Iran, N. Korea, Syria, Crimea/DNR/LNR) — overlaps with our gambling geofence.
- **KYC we already collect** (gov ID + selfie for submitters) helps sanctions/age screening — but **voters are currently not KYC'd**, and voters are the ones spending money and receiving the Top-Voter prize. **Prize payouts to un-screened wallets are the AML/OFAC gap.**

---

## 6. Marketing-Claims Rules — Automated / AI Agents

- **FTC Endorsement Guides (2025 update) now cover AI/synthetic media.** AI-generated testimonials/personas/endorsements must be **disclosed as AI**, and AI-generated claims must be **truthful and substantiated** to the same standard as human claims ([ppl.studio](https://ppl.studio/blog/ai-generated-content-disclosure-ftc-guidelines); [Promise Legal – 16 CFR 255 checklist](https://blog.promise.legal/startup-central/updating-your-ftc-endorsement-compliance-program-for-ai-enabled-fake-reviews-16-cfr-part-255-a-startup-checklist/)). The FTC is moving **from guidance to consent orders** in 2025–2026, specifically on **unsubstantiated income/earnings claims for AI-powered products** ([EFROS tracker](https://efros.com/blog/ftc-ai-enforcement-actions-2025-tracker/); [TechJack](https://techjacksolutions.com/ai-brief/ftc-consent-orders-signal-ai-marketing-deception-is-now-a-se/)).
- **Deception standard (FTC Act §5):** AI content is deceptive if it creates a false impression material to a purchase decision. Our automated X/Telegram posts are **first-party ads** — everything they say is attributable to us.
- **APR/yield claims are the danger zone.** Automated posts touting **"8–45% APR," "earn," or price/return** are (a) forward-looking earnings claims requiring substantiation, and (b) may be treated as **securities-offering communications** (see §2) and fall under **FTC + CFTC** crypto-fraud attention. Frame any yield reference as **not guaranteed, variable, and not financial advice**; better, **suppress APR claims in automated marketing entirely** until §2 is resolved.
- **Agent hallucination risk — specific to us:** an AI agent that autonomously drafts/posts can invent numbers, promise features ("guaranteed returns," non-existent partnerships), or omit disclosures — and **we are liable for what the agent posts**. Controls needed: **human-in-the-loop approval** for any post touching price/APR/returns, a **hard-coded claims allowlist/denylist** in the agent prompt (this repo already guards prize-split strings via `scripts/check-prize-split.mjs` — extend the same pattern to APR/earnings/guarantee language), mandatory **"#Ad / AI-generated"** and **"not financial advice"** disclaimers, and a **post log** for substantiation.
- **"Not financial advice" is not a shield.** It mitigates but does not cure a deceptive or unsubstantiated claim, and does not exempt a security from registration.

---

## Questions for Outside Counsel (decision list)

**Gambling / lottery (Section 1)**
1. As structured (paid TTS votes, losing votes burned, vote-weighted VRF random draw, prize = pool of paid votes), is the core loop an illegal lottery/gambling offering under the majority of state tests — and can *any* combination of AMOE + geofencing cure it **without** decoupling the prize pool from paid/burned votes?
2. If we must decouple: what is the minimum viable redesign (house-funded prize + genuine equal-dignity free entry, or deterministic skill-judged winner and no VRF draw) you would bless?
3. Which states must we geofence at launch (NY, LA, WA, MI, MT, others), and does geofencing the *web UI* provide any defense given the contract is permissionless on-chain?
4. Do we need prize-promotion **registration/bonding** (FL/NY/RI) for any compliant version?

**Securities / staking (Section 2)**
5. Does the 8–45% fixed-APR staking program, funded from a company-controlled reward surplus, constitute an unregistered securities offering under Howey — and does the May/Aug 2025 SEC staff staking relief reach it, or is it excluded as non-protocol entrepreneurial yield?
6. Which restructure clears launch: (a) remove fixed APR + variable discretionary rewards, (b) pure utility/vote-multiplier framing with no yield, or (c) do not launch? What exact marketing language is safe?

**Publicity / biometric (Section 3)**
7. What consent scope must submitter consent contain to permit likeness **NFT minting/sale/on-chain permanence**, and how do we handle **third-party images** and the **no-deletion** problem before turning photo-mode ON?
8. Does our selfie-vs-ID **face-matching** trigger BIPA/CUBI/WA obligations, and what standalone consent + retention/destruction schedule + vendor DPA do we need? Must we geofence IL/TX/WA if we can't fully comply?

**2257 / content (Section 4)**
9. Confirm §2257/2257A do not apply while content is non-explicit, and approve a content-moderation + records-retention/custodian protocol that keeps us compliant if the content line ever moves.

**Money transmission / AML / OFAC (Section 5)**
10. Do TTS prize payouts, plus the staking pool mechanics, keep us **outside** FinCEN MSB status and state MTLs — and what specifically (custody, fiat/crypto exchange, omnibus pooling) would tip us in?
11. What OFAC/sanctions program is mandatory before paying prizes — must we **wallet-screen and KYC voters/winners** (not just submitters) and geo-block sanctioned jurisdictions?

**Marketing / AI agents (Section 6)**
12. What disclosure + substantiation + human-review controls must govern the automated X/Telegram agents, and may they reference **any** APR/yield/return figure before Section 2 is resolved? Approve required disclaimers and the claims allow/deny list.

**Cross-cutting**
13. Given Sections 1 and 2 are launch-blocking, sequence the go/no-go: what must be fixed **before** any public launch vs. what can follow, and what corporate/entity/insurance structure (e.g., LLC, D&O, jurisdiction) best isolates the gambling and securities risk?

---
*Prepared for internal use only. Grounded in public sources current as of Aug 2026; verify all statutes/enforcement status with counsel before acting. Not legal advice.*
