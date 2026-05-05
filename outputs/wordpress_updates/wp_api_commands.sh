#!/bin/bash
# ══════════════════════════════════════════════════════════════════
# Temptation Token — WordPress REST API Commands
# ══════════════════════════════════════════════════════════════════
#
# BEFORE RUNNING: You need a WordPress Application Password
#
# Steps:
# 1. Log in to https://temptationtoken.io/wp-admin
# 2. Go to Users → Profile
# 3. Scroll to "Application Passwords" section
# 4. Create new password — name it "ClaudeCode"
# 5. Copy the generated password (looks like: XXXX XXXX XXXX XXXX XXXX XXXX)
# 6. Set it below (remove spaces from the password):
#
WP_USER="jgoetz@functionised.com"
WP_APP_PASS="REPLACE_WITH_YOUR_APP_PASSWORD"
# Example: WP_APP_PASS="AbCd1234EfGh5678IjKl9012"
#
# Run this entire script, or copy/paste individual commands
# ══════════════════════════════════════════════════════════════════

BASE_URL="https://temptationtoken.io/wp-json/wp/v2"
AUTH="-u \"${WP_USER}:${WP_APP_PASS}\""
CONTENT_DIR="$(dirname "$0")/../.."

echo "=== Testing authentication ==="
curl -s "${BASE_URL}/users/me?_fields=id,name,roles" \
  -u "${WP_USER}:${WP_APP_PASS}" | python3 -m json.tool
echo ""

# ──────────────────────────────────────────────────────────────────
# 2B. UPDATE FAQ PAGE (id: 538)
# ──────────────────────────────────────────────────────────────────
echo "=== Updating FAQ page (id:538) ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/pages/538" \
  -u "${WP_USER}:${WP_APP_PASS}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/faq_payload.json
echo ""

# ──────────────────────────────────────────────────────────────────
# 2C. CREATE /audit PAGE (check if exists first, then create or update)
# ──────────────────────────────────────────────────────────────────
echo "=== Checking for existing /audit page ==="
AUDIT_EXISTING=$(curl -s "${BASE_URL}/pages?slug=audit&_fields=id,slug" \
  -u "${WP_USER}:${WP_APP_PASS}")
echo "Existing: ${AUDIT_EXISTING}"

# Create new /audit page
echo "=== Creating /audit page ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/pages" \
  -u "${WP_USER}:${WP_APP_PASS}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/audit_payload.json
echo ""

# ──────────────────────────────────────────────────────────────────
# 2D. CREATE /trust PAGE
# ──────────────────────────────────────────────────────────────────
echo "=== Checking for existing /trust page ==="
TRUST_EXISTING=$(curl -s "${BASE_URL}/pages?slug=trust&_fields=id,slug" \
  -u "${WP_USER}:${WP_APP_PASS}")
echo "Existing: ${TRUST_EXISTING}"

echo "=== Creating /trust page ==="
curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "${BASE_URL}/pages" \
  -u "${WP_USER}:${WP_APP_PASS}" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/trust_payload.json
echo ""

# ──────────────────────────────────────────────────────────────────
# 2E. GET HOMEPAGE CONTENT (for review before updating)
# ──────────────────────────────────────────────────────────────────
echo "=== Getting homepage content preview (id:52) ==="
curl -s "${BASE_URL}/pages/52?_fields=id,slug,title,content" \
  -u "${WP_USER}:${WP_APP_PASS}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
content = d.get('content', {}).get('rendered', '')
print('Title:', d.get('title', {}).get('rendered', ''))
print('Content length:', len(content))
print('Contains 40%:', '40%' in content)
print('Contains Polygon:', 'Polygon' in content or 'polygon' in content)
print('Contains 0x51C7:', '0x51C7' in content)
print('Contains 2024:', '2024' in content)
print('Contains In Progress:', 'In Progress' in content or 'in progress' in content.lower())
"
echo ""

# ──────────────────────────────────────────────────────────────────
# 2F. GET ALL BLOG POSTS (for prize split update)
# ──────────────────────────────────────────────────────────────────
echo "=== Getting all blog posts ==="
curl -s "${BASE_URL}/posts?per_page=20&_fields=id,slug,title" \
  -u "${WP_USER}:${WP_APP_PASS}" | python3 -m json.tool
echo ""

echo "=== DONE ==="
echo ""
echo "After running, verify at:"
echo "  https://temptationtoken.io/faq/"
echo "  https://temptationtoken.io/audit/"
echo "  https://temptationtoken.io/trust/"
echo ""
echo "For the homepage content updates (2E) and blog post updates (2F),"
echo "use the Python script below or update manually in WordPress editor."
