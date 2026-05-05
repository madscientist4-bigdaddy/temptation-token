#!/bin/bash
# WordPress Schema Markup — REST API Update Script
# Adds BlogPosting JSON-LD schema to all 5 published blog posts via Rank Math post meta
#
# Prerequisites:
#   1. Generate WordPress Application Password:
#      WP Admin → Users → Profile → Application Passwords → "Add New"
#   2. Set WP_USER and WP_APP_PASSWORD below
#   3. Run: bash add_schema_rest_api.sh

WP_URL="https://temptationtoken.io"
WP_USER="jim"   # Your WordPress username
WP_APP_PASSWORD=""  # Paste Application Password here (spaces are OK, they're stripped)

BASE64_AUTH=$(echo -n "$WP_USER:$WP_APP_PASSWORD" | base64)
AUTH_HEADER="Authorization: Basic $BASE64_AUTH"

add_schema() {
  local POST_ID="$1"
  local SLUG="$2"
  local TITLE="$3"
  local DATE="$4"
  local DESCRIPTION="$5"

  local SCHEMA=$(cat <<EOF
{"@context":"https://schema.org","@type":"BlogPosting","headline":"${TITLE}","description":"${DESCRIPTION}","author":{"@type":"Person","name":"Jim Goetz","url":"https://temptationtoken.io"},"publisher":{"@type":"Organization","name":"Blockchain Entertainment LLC","url":"https://temptationtoken.io","logo":{"@type":"ImageObject","url":"https://temptationtoken.io/wp-content/uploads/2024/06/Copy-of-Temptation-Token-Coin-1024x1024.webp"}},"datePublished":"${DATE}","dateModified":"${DATE}","mainEntityOfPage":{"@type":"WebPage","@id":"${WP_URL}/2026/05/05/${SLUG}/"},"image":{"@type":"ImageObject","url":"https://temptationtoken.io/wp-content/uploads/2024/11/Temptation-Token-Coin6.webp","width":1080,"height":1080}}
EOF
)

  echo "Updating post $POST_ID ($SLUG)..."
  curl -s -X POST "$WP_URL/wp-json/wp/v2/posts/$POST_ID" \
    -H "$AUTH_HEADER" \
    -H "Content-Type: application/json" \
    -d "{\"meta\":{\"rank_math_schema_BlogPosting\":$(echo $SCHEMA | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('OK' if 'id' in d else 'ERROR: ' + str(d))"
}

# Post 1: What is Temptation Token?
add_schema 1657 "what-is-temptation-token" \
  "What is Temptation Token? The Web3 Hot or Not Game on Base Explained" \
  "2026-05-01T20:38:20+00:00" \
  "What is Temptation Token (\$TTS)? The first vote-to-earn crypto game on Base blockchain — vote for profiles with real TTS tokens and win 35% of the weekly prize pool."

# Post 2: How to Win Crypto Prizes
add_schema 1692 "wincryptoprizes" \
  "How to Win Crypto Prizes Every Week with \$TTS" \
  "2026-05-05T00:13:33+00:00" \
  "Complete guide to winning TTS crypto prizes in Temptation Token weekly voting rounds. Strategy, staking boosts, and how the 35% top voter prize is won."

# Post 3: Provably Fair Voting
add_schema 1698 "provablyfairvoting" \
  "Provably Fair Voting: How Temptation Token Guarantees No One Can Rig the Pool" \
  "2026-05-05T00:21:23+00:00" \
  "Temptation Token uses Chainlink VRF for provably fair winner selection. Every result is cryptographically verified on-chain — not even the developers can manipulate outcomes."

# Post 4: TTS Staking
add_schema 1704 "ttsstaking" \
  "TTS Staking Explained: Earn Up to 45% APR Plus 3x Vote Multipliers" \
  "2026-05-05T00:27:36+00:00" \
  "Stake \$TTS to earn up to 45% APR and multiply your voting power up to 3x. Full tier breakdown, weekly yield calculations, and compound growth examples."

# Post 5: Crypto for Charity
add_schema 1710 "cryptoforcharity" \
  "Crypto for Charity: How Temptation Token Funds Polaris Project Every Week" \
  "2026-05-05T00:33:19+00:00" \
  "Every Temptation Token round automatically sends 10% of the prize pool to Polaris Project anti-trafficking charity. Fully on-chain, zero discretion required."

echo ""
echo "Done. Verify schema at https://search.google.com/test/rich-results?url=https://temptationtoken.io/..."
