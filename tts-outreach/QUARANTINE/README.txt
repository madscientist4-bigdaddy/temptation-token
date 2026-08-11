QUARANTINED 2026-08-11 — DO NOT SEND ANY OF THESE.

These 27 files were written on 2026-08-09 by a DRY_RUN of the superseded
tts-outreach/sender.py. They are campaign first-touch emails addressed to real
agencies, and every one of them contains copy that is now known to be false:

  * "$2,500 funded prize pool"            — not substantiated
  * "keeps 50% of every vote"             — the winning creator gets 35% of the votes
                                            cast on her; losing creators get nothing
  * "paid weekly in USDC"                 — settlement is in $TTS, on-chain
  * "https://calendly.com/REPLACE-ME"     — dead link
  * footer "...LLC · REPLACE-ME"          — no postal address, i.e. CAN-SPAM violation

They were renamed from .eml to .eml.txt because macOS binds .eml to Mail.app: opening
one launches a Mail compose window pre-addressed to the agency, which looks exactly
like a draft waiting to be sent. That is almost certainly the source of the
mail-compose windows that appeared on this Mac. Nothing in either tree opens them
programmatically — no AppleScript, no `open -a Mail`, no mailto: handoff — so the
trigger was a human or Finder opening a file that should never have existed.

The live campaign is outreach/, which sends unattended over Proton Bridge SMTP and
writes no .eml for campaign mail. Corrected copy lives in outreach/templates/.
