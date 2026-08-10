"""Outbound claim check — the outreach-copy sibling of the repo's
scripts/check-prize-split.mjs.

Every factual promise in a cold commercial email is a representation you can be
held to. This scans rendered copy for claims that do NOT match the deployed
contract, and requires each one to be explicitly signed off in .env before the
sender will run live.

It does not block DRY_RUN. It blocks live sending until either the copy is
corrected or the claim is acknowledged with CLAIMS_ACK=<comma-separated ids>.
"""
from __future__ import annotations

import re
import sys

import config

# Canonical, from the deployed V3d contract (CLAUDE.md "Canonical Game
# Parameters", CI-guarded by scripts/check-prize-split.mjs):
#   Top Voter 35% · Winning Profile 35% · Charity 10% · House 20%
#   Pool = the winning profile's raw votes only; losing votes burn.
#   Payouts settle in $TTS on weekly VRF settlement.
CANON = {
    "winning_profile_share": 35,
    "top_voter_share": 35,
    "payout_asset": "TTS",
    "settlement": "weekly, Chainlink VRF, on-chain",
}

CHECKS = [
    {
        "id": "creator-50",
        "pattern": re.compile(r"\b50\s*%|\bkeeps?\s+half\b", re.I),
        "severity": "HIGH",
        "claim": "creator keeps 50% of every vote",
        "reality": ("The contract pays 35% to the WINNING profile only — not 50%, and not to "
                    "every creator. A creator whose profile does not win receives nothing from "
                    "the pool; losing votes burn to 0x…dEaD."),
        "fix": ("If the 50% is a separate agency rev-share you fund off-chain, say so explicitly "
                "('we fund a 50% share on top of the on-chain split') so it can't read as a "
                "description of the contract."),
    },
    {
        "id": "usdc",
        "pattern": re.compile(r"\bUSDC\b", re.I),
        "severity": "HIGH",
        "claim": "paid weekly in USDC",
        "reality": "V3d settles in $TTS, not USDC. No USDC payout path exists on-chain.",
        "fix": "Either document the TTS-to-USDC conversion you intend to run, or say 'paid weekly in $TTS'.",
    },
    {
        "id": "pool-2500",
        "pattern": re.compile(r"\$\s?2[,.]?500"),
        "severity": "MEDIUM",
        "claim": "$2,500 funded prize pool",
        "reality": ("$2,500 appears in outputs/external_income_streams.md as a projected club "
                    "sponsorship figure, not as a funded, segregated pool."),
        "fix": "Fund and ring-fence it before promising it, or drop the dollar figure.",
    },
    {
        "id": "slots-5",
        "pattern": re.compile(r"\b5\s+agency\s+slots\b", re.I),
        "severity": "LOW",
        "claim": "5 agency slots",
        "reality": "Scarcity claim. Fine if true and enforced; actionable if it isn't.",
        "fix": "Keep the cap real — don't sign a sixth.",
    },
    {
        "id": "audited",
        "pattern": re.compile(r"\baudited\b", re.I),
        "severity": "OK",
        "claim": "every vote settles on-chain, audited",
        "reality": "Supported: Solidproof audit exists, VRF settlement is on-chain.",
        "fix": "",
    },
]


def scan(text: str) -> list[dict]:
    return [c for c in CHECKS if c["severity"] != "OK" and c["pattern"].search(text)]


def acknowledged() -> set[str]:
    return {s.strip() for s in config.env("CLAIMS_ACK", "").split(",") if s.strip()}


def gate(text: str, *, live: bool, verbose: bool = True) -> bool:
    """Return True if sending may proceed."""
    hits = scan(text)
    if not hits:
        return True
    ack = acknowledged()
    unacked = [h for h in hits if h["id"] not in ack]
    if verbose:
        print("\n" + "=" * 78)
        print("  CLAIM CHECK — copy contains statements that do not match the deployed contract")
        print("=" * 78)
        for h in hits:
            mark = "ACK" if h["id"] in ack else h["severity"]
            print(f"\n  [{mark}] {h['id']}: \"{h['claim']}\"")
            print(f"        reality: {h['reality']}")
            if h["fix"]:
                print(f"        fix:     {h['fix']}")
        print("\n" + "=" * 78)
        if unacked:
            print("  To send live anyway, add to .env:")
            print(f"    CLAIMS_ACK={','.join(sorted(h['id'] for h in hits))}")
            print("=" * 78 + "\n")
    if live and unacked:
        return False
    return True


def main() -> int:
    blob = []
    for name in ("email_1.txt", "email_2.txt", "email_3.txt", "footer.txt", "dm.txt"):
        p = config.TEMPLATES / name
        if p.exists():
            blob.append(p.read_text(encoding="utf-8"))
    text = "\n".join(blob)
    ok = gate(text, live=True)
    print(f"canonical split on record: {CANON['top_voter_share']}% top voter / "
          f"{CANON['winning_profile_share']}% winning profile, paid in "
          f"{CANON['payout_asset']} ({CANON['settlement']})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
