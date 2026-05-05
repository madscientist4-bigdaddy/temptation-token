# WordPress Blog Post Updates — Schema + Internal Links
*Prepared by Claude Code — ready to apply via WP admin or REST API*

## Why These Posts Can't Be Updated via REST API Content Field

All 5 posts are built with **Elementor**. Updating the `content` field via WordPress REST API would wipe Elementor's JSON metadata and break the layouts. Internal links must be added inside the **Elementor editor** manually.

---

## Action Required from Jim: Internal Links (via Elementor)

Open each post in the Elementor editor and add these links naturally into the existing body text:

### Post 1: "What is Temptation Token?" (ID 1657)
- In the security section → link "temptationtoken.io/trust" to → `https://temptationtoken.io/trust`
- In the staking section → link "TTS staking guide" or "45% APR" to → `https://temptationtoken.io/2026/05/05/ttsstaking/`
- In the intro or CTA → link "app.temptationtoken.io" to → `https://app.temptationtoken.io`

### Post 2: "How to Win Crypto Prizes Every Week with $TTS" (ID 1692)
- Mention Chainlink VRF → link "provably fair" to → `https://temptationtoken.io/2026/05/05/provablyfairvoting/`
- Mention security/trust → link "fully audited" to → `https://temptationtoken.io/trust`
- CTA → link "app.temptationtoken.io" to → `https://app.temptationtoken.io`

### Post 3: "Provably Fair Voting" (ID 1698)
- Mention staking multipliers → link "staking your TTS" to → `https://temptationtoken.io/2026/05/05/ttsstaking/`
- Mention audit → link "view our security report" to → `https://temptationtoken.io/trust`
- CTA → link "app.temptationtoken.io" to → `https://app.temptationtoken.io`

### Post 4: "TTS Staking Explained" (ID 1704)
- Mention voting game → link "weekly voting rounds" to → `https://temptationtoken.io/2026/05/01/what-is-temptation-token/`
- Mention smart contract security → link "audited contract" to → `https://temptationtoken.io/trust`
- CTA → link "app.temptationtoken.io" to → `https://app.temptationtoken.io`

### Post 5: "Crypto for Charity" (ID 1710)
- Mention prize distribution → link "how the game works" to → `https://temptationtoken.io/2026/05/01/what-is-temptation-token/`
- Mention on-chain verification → link "verify on our trust page" to → `https://temptationtoken.io/trust`
- CTA → link "app.temptationtoken.io" to → `https://app.temptationtoken.io`

---

## Schema Markup — Can Be Applied via REST API or Rank Math UI

The schema below can be added two ways:
1. **Rank Math UI**: Edit post → Rank Math sidebar → Schema → Add Schema → BlogPosting → fill in fields
2. **REST API**: Use the script below with a WordPress Application Password

### WordPress Application Password Setup
1. Go to WordPress admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Enter name "Claude Code API" → click "Add New Application Password"
4. Copy the generated password
5. Run the script below substituting YOUR_APP_PASSWORD

---
