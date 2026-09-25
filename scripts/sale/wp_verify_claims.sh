#!/bin/bash
# Verify the nine corrected claims are gone from the live site. Read-only, cache-busted,
# follows redirects. Checks the RENDERED page, not the API response — a 200 from WP says
# nothing about what visitors see, and Elementor pages are not covered by WP revisions.
FAIL=0
PAGES=(
"https://temptationtoken.io/|homepage"
"https://temptationtoken.io/2026/05/01/what-is-temptation-token/|what-is-tts"
"https://temptationtoken.io/2026/05/05/provablyfairvoting/|provably-fair"
"https://temptationtoken.io/2026/05/05/ttsstaking/|staking"
"https://temptationtoken.io/2026/09/15/vote-to-earn-round-mechanics-explained-from-first/|round-mechanics"
)
PATTERNS=(
"Zero critical findings" "Zero high findings" "Zero Critical Findings" "17.92"
"within minutes of round close" "zero human involvement" "vote-to-earn cryptocurrency"
"pool created at \$0.01" "Target Price" "\$5 in free TTS" "Up to 45% APR"
"audited by Solidproof, the LP" "zero critical or high findings" "audit is in progress"
"Stake Temptation Token on Base today"
)
for e in "${PAGES[@]}"; do
  u="${e%%|*}"; n="${e##*|}"; f=$(mktemp)
  code=$(curl -sL -o "$f" -w "%{http_code}" --max-time 30 -A "Mozilla/5.0" "${u}?cb=$RANDOM")
  size=$(wc -c <"$f" | tr -d ' ')
  status="ok"
  [ "$code" != "200" ] && { status="HTTP $code"; FAIL=1; }
  # A page that shrinks to almost nothing is the Aug-16 blanking failure.
  [ "$size" -lt 20000 ] && { status="SUSPICIOUSLY SMALL"; FAIL=1; }
  printf "  %-17s %-20s %sB\n" "$n" "$status" "$size"
  for p in "${PATTERNS[@]}"; do
    c=$(grep -o -i -- "$p" "$f" 2>/dev/null | wc -l | tr -d ' ')
    [ "$c" != "0" ] && { echo "      STILL PRESENT (${c}x): $p"; FAIL=1; }
  done
  rm -f "$f"
done
echo
[ $FAIL -eq 0 ] && echo "PASS — all corrected claims absent, all pages render" || echo "FAIL — see above"
exit $FAIL
