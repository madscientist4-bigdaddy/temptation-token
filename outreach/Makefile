# Temptation Token — B2B outreach. All state in data/outreach.db.
PY := /usr/local/bin/python3
DIR := /Users/functionisedproductions/Projects/temptation-token

.PHONY: send-one help setup verify harvest owners schedule send brief posts card pack test api mail-check status live-check install install-schedule uninstall uninstall-schedule

help:
	@awk -F':.*##' '/^[a-z-]+:.*##/ {printf "  \033[1m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup:            ## interactive credential wizard (validates SMTP for real)
	@$(PY) setup_wizard.py
verify:           ## re-test the saved Gmail credentials
	@$(PY) setup_wizard.py --verify
harvest:          ## crawl agency sites for contacts (1 req/s, robots.txt obeyed)
	@$(PY) harvest.py
owners:           ## Sunbiz / CA bizfile owner + address lookup
	@$(PY) sunbiz.py
schedule:         ## build the sequence in SQLite, send nothing
	@$(PY) sender.py --schedule
send-one:         ## one-off correspondence email (TO= SUBJECT= BODY=file)
	@test -n "$(TO)"   || (echo "usage: make send-one TO=x@y.com SUBJECT='...' BODY=path/to/body.txt"; exit 1)
	@test -n "$(BODY)" || (echo "usage: make send-one TO=x@y.com SUBJECT='...' BODY=path/to/body.txt"; exit 1)
	@$(PY) send_one.py --to "$(TO)" --subject "$(SUBJECT)" --body-file "$(BODY)" $(if $(DRY),--dry-run,)

send:             ## run due sends (DRY_RUN from .env)
	@$(PY) sender.py
brief:            ## write + open TODAY.md and dm_copilot.html
	@$(PY) daily_brief.py
posts:            ## generate today's 5 @CryptoFITJim posts
	@$(PY) promo/my_daily_posts.py
card:             ## render the leaderboard PNG
	@$(PY) promo/image_cards.py
test:             ## run the guardrail suite
	@$(PY) tests/test_guardrails.py
replies:          ## poll IMAP once for inbound replies
	@$(PY) reply_watcher.py
api:              ## serve the dashboard API on 127.0.0.1:8787 (foreground)
	@$(PY) api.py
mail-check:       ## which transport is configured, and is it reachable
	@$(PY) mailer.py

status:           ## board, mail transport, unread replies, API + launchd health
	@$(PY) status.py

live-check:       ## show whether you are armed
	@grep -q '^DRY_RUN=true' .env && echo "DRY_RUN=true — safe, nothing sends" || echo "*** LIVE — emails will actually go out ***"

install:          ## load every launchd job (sender, harvest, brief, replies, api)
	@for f in launchd/*.plist; do cp $$f ~/Library/LaunchAgents/; launchctl unload ~/Library/LaunchAgents/$$(basename $$f) 2>/dev/null; launchctl load ~/Library/LaunchAgents/$$(basename $$f); echo "loaded $$(basename $$f)"; done
uninstall:        ## unload them all
	@for f in launchd/*.plist; do launchctl unload ~/Library/LaunchAgents/$$(basename $$f) 2>/dev/null; rm -f ~/Library/LaunchAgents/$$(basename $$f); echo "removed $$(basename $$f)"; done

# Kept as aliases so muscle memory and the README both keep working.
install-schedule: install
uninstall-schedule: uninstall
