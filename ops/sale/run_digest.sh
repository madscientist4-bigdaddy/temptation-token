#!/bin/bash
# launchd wrapper for the TTS sale digest.
#
# launchd hands a job almost no environment: no PATH beyond /usr/bin:/bin, no shell
# profile, no working directory. Everything the digest needs is therefore established
# here rather than assumed.
#
# Exit codes are deliberate: 0 on a successful send AND on a deliberate skip (past the
# end date), non-zero only on a real failure, so `launchctl list` shows a last-exit of 0
# whenever the job is healthy. The round-audit job next door already uses that
# convention and it is how we noticed it was correctly failing in August.
set -uo pipefail

REPO="/Users/functionisedproductions/Projects/temptation-token"
LOG="$REPO/logs/sale-digest.log"
END_DATE="2026-11-06"     # the plan's horizon; see PART 0 of the sprint

exec >>"$LOG" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z')  mode=${DIGEST_MODE:-morning} ==="

# launchd calendar jobs cannot express an end date, so enforce it here. Without this
# the digest would keep mailing Jim about a plan that finished weeks earlier.
if [[ "$(date +%Y-%m-%d)" > "$END_DATE" ]]; then
  echo "past $END_DATE — digest retired, unloading both jobs"
  launchctl unload "$HOME/Library/LaunchAgents/com.temptationtoken.digest.morning.plist" 2>/dev/null
  launchctl unload "$HOME/Library/LaunchAgents/com.temptationtoken.digest.evening.plist" 2>/dev/null
  exit 0
fi

cd "$REPO" || { echo "repo missing at $REPO"; exit 1; }

# Load .env without echoing it. `set -a` exports every assignment; the file is the only
# place the Bridge password and Supabase token live on this machine.
if [[ -f .env ]]; then set -a; . ./.env; set +a; else echo "no .env"; exit 1; fi

export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
export TTS_TASKS_JSON="${TTS_TASKS_JSON:-$REPO/ops/sale/tasks.json}"
export DIGEST_TO="${DIGEST_TO:-jim@temptationtoken.io}"

# Proton Bridge serves SMTP on loopback only while the app is running. If it is not up,
# say so in one clear line rather than letting smtplib produce a connection traceback
# that looks like a code fault.
if ! nc -z -G 3 "${BRIDGE_HOST:-127.0.0.1}" "${BRIDGE_SMTP_PORT:-1025}" 2>/dev/null; then
  echo "FAIL: Proton Bridge is not listening on ${BRIDGE_HOST:-127.0.0.1}:${BRIDGE_SMTP_PORT:-1025}."
  echo "      Open Proton Mail Bridge and enable Settings > Start on login."
  exit 2
fi
if [[ -z "${BRIDGE_USER:-}" || -z "${BRIDGE_PASS:-}" ]]; then
  echo "FAIL: BRIDGE_USER / BRIDGE_PASS are not in .env."
  echo "      BRIDGE_PASS is the password Proton Bridge GENERATES (Bridge > account >"
  echo "      Mailbox details), not the Proton account password."
  exit 3
fi

/usr/local/bin/python3 ops/sale/tts_daily_digest.py "$@"
rc=$?
echo "exit=$rc"
exit $rc
