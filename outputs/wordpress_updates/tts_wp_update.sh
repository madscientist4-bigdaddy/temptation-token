#!/usr/bin/env bash
# ============================================================
# TTS WordPress Updates — using custom tts-api-auth plugin
# ============================================================
#
# Prerequisites:
#   1. Upload outputs/wordpress_updates/tts-api-auth.php to wp-admin
#      → Plugins → Add New → Upload Plugin → Activate
#   2. Run this script from the repo root:
#      chmod +x outputs/wordpress_updates/tts_wp_update.sh
#      ./outputs/wordpress_updates/tts_wp_update.sh
#
# No username or Application Password needed.
# Auth is the secret token below.
# ============================================================

WP_URL="https://temptationtoken.io"
TTS_TOKEN="TTS2026Admin!"
API="$WP_URL/wp-json/tts/v1/update"

# Page IDs (verified May 2026)
FAQ_ID=538
HOMEPAGE_ID=52

# File paths (relative to repo root)
AUDIT_FILE="outputs/seo/audit_page.html"
TRUST_FILE="outputs/trust_page.html"
FAQ_FILE="outputs/seo/faq_page_complete_v3.html"

echo "========================================"
echo " TTS WordPress Update (Token Auth)"
echo "========================================"
echo ""

# ── STEP 1: Test connectivity ──────────────────────────────
echo "1. Testing plugin endpoint..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "X-TTS-Token: $TTS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API" \
  -d '{"action":"update_meta","id":52,"meta":{"rank_math_focus_keyword":"test"}}')
if [ "$STATUS" != "200" ]; then
  echo "   ❌ Plugin not responding (HTTP $STATUS)"
  echo "   → Make sure tts-api-auth.php is uploaded and activated in wp-admin"
  exit 1
fi
echo "   ✅ Plugin active and responding"
echo ""

# ── STEP 2: Create /audit page ────────────────────────────
echo "2. Creating /audit page..."
AUDIT_JSON=$(python3 -c "import sys,json; print(json.dumps(open('$AUDIT_FILE').read()))")
RESULT=$(curl -s -X POST \
  -H "X-TTS-Token: $TTS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API" \
  -d "{\"action\":\"create_page\",\"title\":\"Smart Contract Audit\",\"slug\":\"audit\",\"content\":$AUDIT_JSON}")
echo "   $RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  if d.get('ok'):
    print(f'   ✅ {d[\"action\"]} — ID: {d[\"id\"]} — URL: {d.get(\"url\",\"\")}')
  else:
    print(f'   ❌ Error: {d}')
except Exception as e:
  print(f'   ❌ Parse error: {e}')
" 2>/dev/null || echo "   Result: $RESULT"
echo ""

# ── STEP 3: Create /trust page ────────────────────────────
echo "3. Creating /trust page..."
TRUST_JSON=$(python3 -c "import sys,json; print(json.dumps(open('$TRUST_FILE').read()))")
RESULT=$(curl -s -X POST \
  -H "X-TTS-Token: $TTS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API" \
  -d "{\"action\":\"create_page\",\"title\":\"Trust & Security\",\"slug\":\"trust\",\"content\":$TRUST_JSON}")
echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  if d.get('ok'):
    print(f'   ✅ {d[\"action\"]} — ID: {d[\"id\"]} — URL: {d.get(\"url\",\"\")}')
  else:
    print(f'   ❌ Error: {d}')
except Exception as e:
  print(f'   ❌ Parse error: {e}')
" 2>/dev/null || echo "   Result: $RESULT"
echo ""

# ── STEP 4: Update /faq/ page content ─────────────────────
echo "4. Updating /faq/ content (ID $FAQ_ID)..."
FAQ_JSON=$(python3 -c "import sys,json; print(json.dumps(open('$FAQ_FILE').read()))")
RESULT=$(curl -s -X POST \
  -H "X-TTS-Token: $TTS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API" \
  -d "{\"action\":\"update_content\",\"id\":$FAQ_ID,\"content\":$FAQ_JSON}")
echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  if d.get('ok'):
    print(f'   ✅ content_updated — ID: {d[\"id\"]} — URL: {d.get(\"url\",\"\")}')
  else:
    print(f'   ❌ Error: {d}')
except Exception as e:
  print(f'   ❌ Parse error: {e}')
" 2>/dev/null || echo "   Result: $RESULT"
echo ""

# ── STEP 5: Rank Math SEO — Homepage ──────────────────────
echo "5. Updating homepage Rank Math SEO (ID $HOMEPAGE_ID)..."
RESULT=$(curl -s -X POST \
  -H "X-TTS-Token: $TTS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API" \
  -d '{
    "action": "update_meta",
    "id": '"$HOMEPAGE_ID"',
    "meta": {
      "rank_math_title": "Temptation Token ($TTS) — Vote to Earn Crypto Game on Base",
      "rank_math_description": "The first provably fair vote-to-earn crypto game on Base. Vote $TTS, win 35% of the weekly prize pool. Audited by Solidproof. Free bonus on signup.",
      "rank_math_focus_keyword": "temptation token"
    }
  }')
echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  if d.get('ok'):
    print(f'   ✅ meta updated — keys: {d.get(\"updated\",[])}')
  else:
    print(f'   ❌ Error: {d}')
except Exception as e:
  print(f'   ❌ Parse error: {e}')
" 2>/dev/null || echo "   Result: $RESULT"
echo ""

# ── STEP 6: Rank Math SEO — FAQ ──────────────────────────
echo "6. Updating FAQ Rank Math SEO (ID $FAQ_ID)..."
RESULT=$(curl -s -X POST \
  -H "X-TTS-Token: $TTS_TOKEN" \
  -H "Content-Type: application/json" \
  "$API" \
  -d '{
    "action": "update_meta",
    "id": '"$FAQ_ID"',
    "meta": {
      "rank_math_title": "Temptation Token FAQ — How to Vote, Win and Stake $TTS on Base",
      "rank_math_description": "Everything about Temptation Token. Voting, prize splits, staking tiers, Chainlink VRF, and how to buy $TTS on Base blockchain.",
      "rank_math_focus_keyword": "temptation token FAQ"
    }
  }')
echo "$RESULT" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  if d.get('ok'):
    print(f'   ✅ meta updated — keys: {d.get(\"updated\",[])}')
  else:
    print(f'   ❌ Error: {d}')
except Exception as e:
  print(f'   ❌ Parse error: {e}')
" 2>/dev/null || echo "   Result: $RESULT"
echo ""

# ── STEP 7: Summary ───────────────────────────────────────
echo "========================================"
echo " Done!"
echo "========================================"
echo ""
echo "  Pages created/updated:"
echo "    • temptationtoken.io/audit    (Smart Contract Audit)"
echo "    • temptationtoken.io/trust    (Trust & Security)"
echo "    • temptationtoken.io/faq/     (FAQ — content updated)"
echo "    • temptationtoken.io          (Homepage Rank Math updated)"
echo ""
echo "  ⚠️  Note: /faq/ and Homepage are Elementor pages."
echo "     Content update writes to post_content — visible only if"
echo "     Elementor is NOT controlling that page, or if you add an"
echo "     HTML widget in Elementor that pulls from post_content."
echo "     Rank Math meta updates work regardless of Elementor."
echo ""
echo "  Manual steps still needed (Elementor — wp-admin):"
echo "    • Change '40%' top voter prize → '35%' in hero section"
echo "    • Change 'Copyright© 2024' → 'Copyright© 2026 Blockchain Entertainment LLC'"
echo "    • Change 'Polygon 2.0' → 'Base blockchain'"
echo "    • Change old contract 0x51C73bc → 0x5570eA97"
echo ""
