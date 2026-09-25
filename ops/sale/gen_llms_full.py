#!/usr/bin/env python3
"""Regenerate public/llms-full.txt from public/llms.txt plus live public numbers.

Run after any change to llms.txt, and on a cadence so the published figures do not go
stale. Uses tts_metrics.public_lines(), NOT collect(): see the docstring there for why
the distinction is load-bearing.
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ops" / "sale"))
import tts_metrics as M  # noqa: E402

base = (ROOT / "public" / "llms.txt").read_text()
body = "\n".join("- " + l for l in M.public_lines())
out = base + f"""

## Live operating numbers (generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC})
Regenerated from the chain and the production database by `ops/sale/gen_llms_full.py`.
These are the real numbers, including the unflattering ones.

{body}

## Verifying any of this yourself
- Round state: call `getRound(uint256)` on 0x783b8cd80b586b723188c93ef94ee1beede617b4
- Trophy count: `totalSupply()` on 0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5
- Settlement history: contract events on BaseScan, or the public read-only endpoint
  https://app.temptationtoken.io/api/scheduler?action=keeper-status
"""
(ROOT / "public" / "llms-full.txt").write_text(out)
print(f"public/llms-full.txt regenerated ({len(out)} bytes)")
