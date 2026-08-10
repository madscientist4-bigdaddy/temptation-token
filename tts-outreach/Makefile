PY      := .venv/bin/python
PLISTS  := $(wildcard launchd/*.plist)
AGENTS  := $(HOME)/Library/LaunchAgents

.PHONY: help setup harvest send brief copilot replies claims sunbiz api status install uninstall clean

help:
	@echo "  make setup      first-run wizard (writes .env, seeds SQLite)"
	@echo "  make harvest    crawl agency sites for contact points"
	@echo "  make send       run the sender (DRY_RUN unless .env says otherwise)"
	@echo "  make brief      write TODAY.md + dm_copilot.html and open them"
	@echo "  make replies    poll IMAP once for replies"
	@echo "  make claims     check outbound copy against the deployed contract"
	@echo "  make sunbiz     FL/CA registry lookup -> data/fedex_list.csv"
	@echo "  make api        serve the dashboard API on 127.0.0.1:8787 (foreground)"
	@echo "  make status     what the system thinks right now"
	@echo "  make install    load the five launchd jobs"
	@echo "  make uninstall  unload them"

setup:      ; $(PY) setup_wizard.py
harvest:    ; $(PY) harvest.py --all
send:       ; $(PY) sender.py
brief:      ; $(PY) daily_brief.py --for today --open
copilot:    ; $(PY) daily_brief.py --for tomorrow && open dm_copilot.html
replies:    ; $(PY) reply_watcher.py
claims:     ; $(PY) claims_guard.py
sunbiz:     ; $(PY) sunbiz.py --urls-only
api:        ; $(PY) api.py

status:
	@$(PY) status.py

install: $(PLISTS)
	@mkdir -p $(AGENTS)
	@for p in $(PLISTS); do \
	  cp $$p $(AGENTS)/ ; \
	  launchctl unload $(AGENTS)/$$(basename $$p) 2>/dev/null || true ; \
	  launchctl load  $(AGENTS)/$$(basename $$p) && echo "  loaded $$(basename $$p)" ; \
	done

uninstall:
	@for p in $(PLISTS); do \
	  launchctl unload $(AGENTS)/$$(basename $$p) 2>/dev/null && echo "  unloaded $$(basename $$p)" ; \
	  rm -f $(AGENTS)/$$(basename $$p) ; \
	done

clean:
	@rm -f outbox/*.eml && echo "  outbox cleared"
