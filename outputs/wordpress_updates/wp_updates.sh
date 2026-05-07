#!/usr/bin/env bash
# ============================================================
# TTS WordPress Updates — run after generating Application Password
# ============================================================
#
# Prerequisites:
#   1. Go to temptationtoken.io/wp-admin
#   2. Users → Your Profile → scroll to "Application Passwords"
#   3. Enter name "ClaudeCode" → click "Add New Application Password"
#   4. Copy the generated password (looks like: xxxx xxxx xxxx xxxx xxxx xxxx)
#   5. Replace APP_PASS below (remove spaces from the generated password)
#
# Usage:
#   chmod +x wp_updates.sh && ./wp_updates.sh
# ============================================================

WP_URL="https://temptationtoken.io"
WP_USER="jgoetz@functionised.com"
APP_PASS="REPLACE_WITH_APP_PASSWORD"   # no spaces — e.g. "AbCdEfGhIjKl12345678mnop"

# Page IDs (verified May 6 2026)
FAQ_ID=538
HOMEPAGE_ID=52

AUTH=$(echo -n "$WP_USER:$APP_PASS" | base64)

echo "========================================"
echo " TTS WordPress Update Script"
echo "========================================"
echo ""

# ── STEP 1: Verify auth works ──────────────────────────────
echo "1. Testing authentication..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Basic $AUTH" \
  "$WP_URL/wp-json/wp/v2/users/me")
if [ "$STATUS" != "200" ]; then
  echo "   ❌ Auth failed (HTTP $STATUS) — check APP_PASS value"
  exit 1
fi
echo "   ✅ Auth OK"
echo ""

# ── STEP 2: Create /audit page ────────────────────────────
echo "2. Creating /audit page..."
AUDIT_CONTENT=$(cat "$(dirname "$0")/../../seo/audit_page.html" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
RESULT=$(curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  "$WP_URL/wp-json/wp/v2/pages" \
  -d "{\"title\":\"Smart Contract Audit\",\"slug\":\"audit\",\"status\":\"publish\",\"content\":$AUDIT_CONTENT}")
AUDIT_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','ERROR: '+str(d.get('message',d))))")
echo "   Created audit page ID: $AUDIT_ID"
echo ""

# ── STEP 3: Create /trust page ────────────────────────────
echo "3. Creating /trust page..."
TRUST_CONTENT=$(cat "$(dirname "$0")/../../trust_page.html" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
RESULT=$(curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  "$WP_URL/wp-json/wp/v2/pages" \
  -d "{\"title\":\"Trust & Security\",\"slug\":\"trust\",\"status\":\"publish\",\"content\":$TRUST_CONTENT}")
TRUST_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','ERROR: '+str(d.get('message',d))))")
echo "   Created trust page ID: $TRUST_ID"
echo ""

# ── STEP 4: Update /faq/ page content ─────────────────────
echo "4. Updating /faq/ page (ID $FAQ_ID)..."
FAQ_CONTENT=$(cat "$(dirname "$0")/../../seo/faq_page_complete_v3.html" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))")
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  "$WP_URL/wp-json/wp/v2/pages/$FAQ_ID" \
  -d "{\"content\":$FAQ_CONTENT}")
echo "   HTTP $STATUS"
echo ""

# ── STEP 5: Update Rank Math SEO on homepage ──────────────
echo "5. Updating homepage Rank Math SEO (ID $HOMEPAGE_ID)..."
curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  "$WP_URL/wp-json/wp/v2/pages/$HOMEPAGE_ID" \
  -d '{
    "meta": {
      "rank_math_title": "Temptation Token ($TTS) — Vote to Earn Crypto Game on Base",
      "rank_math_description": "The first provably fair vote-to-earn crypto game on Base. Vote $TTS, win 35% of the weekly prize pool. Audited by Solidproof. Free bonus on signup.",
      "rank_math_focus_keyword": "temptation token"
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   Updated:', d.get('id'), 'meta keys:', list(d.get('meta',{}).keys())[:4])"
echo ""

# ── STEP 6: Update Rank Math SEO on /faq/ ─────────────────
echo "6. Updating FAQ Rank Math SEO (ID $FAQ_ID)..."
curl -s -X POST \
  -H "Authorization: Basic $AUTH" \
  -H "Content-Type: application/json" \
  "$WP_URL/wp-json/wp/v2/pages/$FAQ_ID" \
  -d '{
    "meta": {
      "rank_math_title": "Temptation Token FAQ — How to Vote, Win and Stake $TTS on Base",
      "rank_math_description": "Everything about Temptation Token. Voting, prize splits, staking tiers, Chainlink VRF, and how to buy $TTS on Base blockchain.",
      "rank_math_focus_keyword": "temptation token FAQ"
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('   Updated:', d.get('id'))"
echo ""

# ── STEP 7: Summary ───────────────────────────────────────
echo "========================================"
echo " Done! Manual steps still needed:"
echo "========================================"
echo ""
echo "  Homepage text fixes (Elementor — must be done in wp-admin):"
echo "    • Change '40%' top voter prize → '35%' in hero section"
echo "    • Change 'In Progress' → '✓ Complete' on any roadmap items"
echo "    • Change 'Copyright© 2024' → 'Copyright© 2026 Blockchain Entertainment LLC'"
echo "    • Change 'June 5th, 2024' → 'April 2026'"
echo "    • Change 'Polygon 2.0' → 'Base blockchain'"
echo "    • Change old contract 0x51C73bc → 0x5570eA97"
echo ""
echo "  WordPress Admin → Elementor → edit Homepage → make text changes above"
echo ""
echo "  Add footer links to ToS and Privacy Policy:"
echo "    • Terms of Service: outputs/legal/terms_of_service.html"
echo "    • Privacy Policy: outputs/legal/privacy_policy.html"
echo "    • DMCA Policy: outputs/legal/dmca_policy.html"
echo ""
