#!/usr/bin/env python3
"""Live metric reads for the TTS sale digest.

Stdlib only, on purpose: this runs from launchd on a Mac that may have no virtualenv
active, so it must not depend on `requests` or anything pip-installed.

CONTRACT WITH THE CALLER: nothing in here may raise. Every metric is independently
guarded, because a digest that fails to send is worse than a digest with one line
reading "(unavailable)". `collect()` is the only public entry point.

Sources
  chain     JSON-RPC eth_call against BASE_RPC_URL (Alchemy). Never the public
            mainnet.base.org endpoint — it rate-limits from anywhere but a laptop and
            has already caused one silent-stale-data outage (see CLAUDE.md, 2026-09-03).
  supabase  the Management API SQL endpoint, using SUPABASE_ACCESS_TOKEN. The digest
            runs on Jim's Mac, which has no service_role key; the management token is
            what is actually available here.
  app       app.temptationtoken.io public read-only endpoints (no auth, no writes).
  status    ops/sale/status.json — the human-maintained facts (SolidProof, Play,
            listings). These have no API; a file that someone edits is the honest
            representation, and a stale one shows its own `as_of` date.
"""
from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
STATUS_JSON = ROOT / "status.json"

TTS_TOKEN = "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"
VOTING_V3D = "0x783b8cd80b586b723188c93ef94ee1beede617b4"
TROPHY_NFT = "0x02DDd0e63DC2A5F66Fdb5a46F5981191959AC9A5"
V2_PAIR = "0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68"
WETH = "0x4200000000000000000000000000000000000006"
TREASURY = "0xC3A3858A3777E4C9B542e60298c3161086c5Faae"

SEL_CURRENT_ROUND = "0x9cbe5efd"   # currentRoundId()
SEL_GET_ROUND = "0x8f1327c0"       # getRound(uint256)
SEL_GET_RESERVES = "0x0902f1ac"    # getReserves()
SEL_TOKEN0 = "0x0dfe1681"          # token0()
SEL_TOTAL_SUPPLY = "0x18160ddd"    # totalSupply()

KEEPER_STATUS_URL = "https://app.temptationtoken.io/api/scheduler?action=keeper-status"
PUBLIC_PROFILES_URL = "https://app.temptationtoken.io/api/public-profiles"
HTTP_TIMEOUT = 20

# Buy sizes the card on-ramp has to survive, in USD. The sale hinges on the top two.
CARD_SIZES_USD = (30, 50, 100, 250, 500, 1000)


# macOS ships python.org builds that trust nothing until someone runs
# "Install Certificates.command" — every HTTPS call then dies with
# CERTIFICATE_VERIFY_FAILED. launchd will not have run that for us, so resolve a CA
# bundle explicitly instead of hoping the default context is usable.
_CTX: ssl.SSLContext | None = None


def _ctx() -> ssl.SSLContext:
    global _CTX
    if _CTX is not None:
        return _CTX
    for cafile in _ca_candidates():
        try:
            _CTX = ssl.create_default_context(cafile=cafile)
            return _CTX
        except Exception:
            continue
    _CTX = ssl.create_default_context()
    return _CTX


def _ca_candidates():
    env = os.environ.get("SSL_CERT_FILE")
    if env:
        yield env
    try:
        import certifi
        yield certifi.where()
    except Exception:
        pass
    yield "/etc/ssl/cert.pem"          # macOS system bundle
    yield "/usr/local/etc/openssl/cert.pem"



# ── plumbing ──────────────────────────────────────────────────────────────

def _post_json(url: str, payload: dict, headers: dict) -> dict | list:
    body = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    for k, v in headers.items():
        req.add_header(k, v)
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT, context=_ctx()) as r:
        return json.loads(r.read().decode())


def _get_json(url: str) -> dict | list:
    req = urllib.request.Request(url, headers={"User-Agent": "tts-digest/1.0"})
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT, context=_ctx()) as r:
        return json.loads(r.read().decode())


def _rpc(to: str, data: str) -> str:
    url = os.environ.get("BASE_RPC_URL", "").strip()
    if not url:
        raise RuntimeError("BASE_RPC_URL not set")
    out = _post_json(url, {"jsonrpc": "2.0", "id": 1, "method": "eth_call",
                           "params": [{"to": to, "data": data}, "latest"]}, {})
    if "error" in out:
        raise RuntimeError(str(out["error"])[:120])
    return out["result"]


def _words(hexstr: str) -> list[int]:
    h = hexstr[2:] if hexstr.startswith("0x") else hexstr
    return [int(h[i:i + 64], 16) for i in range(0, len(h) - 63, 64)]


def _enc_uint(n: int) -> str:
    return f"{n:064x}"


def _sb(sql: str) -> list[dict]:
    ref = os.environ.get("SUPABASE_PROJECT_REF", "").strip()
    tok = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
    if not (ref and tok):
        raise RuntimeError("SUPABASE_PROJECT_REF / SUPABASE_ACCESS_TOKEN not set")
    return _post_json(f"https://api.supabase.com/v1/projects/{ref}/database/query",
                      {"query": sql}, {"Authorization": f"Bearer {tok}"})


def _status_file() -> dict:
    try:
        return json.loads(STATUS_JSON.read_text())
    except Exception:
        return {}


def _fmt_eth(wei: int, dp: int = 4) -> str:
    return f"{wei / 1e18:,.{dp}f}"


def _ago(seconds: float) -> str:
    s = int(seconds)
    if s < 3600:
        return f"{s // 60}m ago"
    if s < 86400:
        return f"{s // 3600}h ago"
    return f"{s // 86400}d ago"


# ── individual metrics ────────────────────────────────────────────────────
# Each returns a list[str]. Each is wrapped by collect(); none is trusted to behave.

def m_round() -> list[str]:
    cur = _words(_rpc(VOTING_V3D, SEL_CURRENT_ROUND))[0]
    w = _words(_rpc(VOTING_V3D, SEL_GET_ROUND + _enc_uint(cur)))
    start, end, tickets, raw, settled, vrf_pending, profiles = w[:7]
    now = datetime.now(timezone.utc).timestamp()
    closes = datetime.fromtimestamp(end, timezone.utc)
    left = end - now
    when = (f"closes in {int(left // 86400)}d {int(left % 86400 // 3600)}h"
            if left > 0 else f"CLOSED {_ago(-left)} — settlement due")
    lines = [f"Round {cur}: {profiles} profiles, {_fmt_eth(raw, 2)} TTS voted, "
             f"{when} ({closes:%a %b %-d %H:%M} UTC)"]
    if settled:
        lines.append(f"Round {cur} is already settled=true while current — unexpected, check the contract")
    if vrf_pending:
        lines.append("!! vrfPending=true — settlement is mid-draw; do not touch, see the VRF-stall runbook")
    return lines


def m_settlement() -> list[str]:
    """Last settlement, and how many consecutive rounds closed themselves.

    'Automatic' is an earned claim: keeper-status only reports automatic=true for an
    audit row that actually moved chain state. We additionally derive the streak from
    the chain itself, because the audit table is known to miss rows (CLAUDE.md P1) and
    a buyer will check the chain, not our table.
    """
    lines = []
    try:
        ks = _get_json(KEEPER_STATUS_URL)
        last = ks.get("lastSettlement") or {}
        if last.get("roundId") is not None:
            who = "autopilot" if last.get("automatic") else "manual / unproven"
            tx = (last.get("txHash") or "")[:12]
            lines.append(f"Last logged settlement: round {last['roundId']} by {who} "
                         f"{_ago(last.get('ageSec') or 0)} {tx}")
        if ks.get("enabled") is not True:
            lines.append("!! keeper autopilot is DISARMED (keeper_autopilot_enabled != 'true')")
        # The contradiction that hid a 37h outage in August: work is due but the
        # keeper could not decode what to do. Assert it every single morning.
        if ks.get("upkeepNeeded") and ks.get("action") in (None, "", "null"):
            lines.append("!! upkeepNeeded=true but action=null — the performData decode is broken again")
    except Exception as exc:
        lines.append(f"keeper-status unavailable: {type(exc).__name__}")

    try:
        cur = _words(_rpc(VOTING_V3D, SEL_CURRENT_ROUND))[0]
        streak, r = 0, cur - 1
        while r >= 1:
            w = _words(_rpc(VOTING_V3D, SEL_GET_ROUND + _enc_uint(r)))
            if not w[4]:                      # settled
                break
            # A round that closed itself starts the next one within the hour; the
            # hand-rescued rounds in Aug started 17-38h late. That gap is the tell.
            nxt = _words(_rpc(VOTING_V3D, SEL_GET_ROUND + _enc_uint(r + 1)))
            if nxt[0] and (nxt[0] - w[1]) > 3 * 3600:
                break
            streak += 1
            r -= 1
        lines.append(f"Consecutive clean self-settlements (from chain): {streak}")
        if streak >= 3:
            lines.append("   -> 3+ clean: the retired Chainlink upkeep's 43.97 LINK is now reclaimable (Part 4.8)")
    except Exception as exc:
        lines.append(f"settlement streak unavailable: {type(exc).__name__}")
    return lines


def m_board() -> list[str]:
    """Verified creators vs AI Models.

    entry_type ships in Part 3. Until the column exists this reports the real split
    it can see and says so, rather than inventing a zero.
    """
    rows = _sb("""
        select coalesce(entry_type,'unclassified') as kind, count(*) as n
        from submissions where status='approved' group by 1 order by 1
    """) if _has_column("submissions", "entry_type") else None
    if rows is None:
        n = _sb("select count(*) n from submissions where status='approved'")[0]["n"]
        return [f"Board: {n} approved profiles (entry_type not deployed yet — "
                f"creator/AI split unavailable until Part 3 ships)"]
    return ["Board: " + ", ".join(f"{r['n']} {r['kind']}" for r in rows)]


def _has_column(table: str, column: str) -> bool:
    try:
        r = _sb(f"""select 1 from information_schema.columns
                    where table_name='{table}' and column_name='{column}' limit 1""")
        return bool(r)
    except Exception:
        return False


def m_funnel() -> list[str]:
    # public.users, explicitly: Supabase also has auth.users, and an unqualified
    # `users` resolves differently depending on search_path. The vote table's wallet
    # column is voter_wallet, not wallet_address — submissions uses the latter.
    r = _sb("""
      select
        (select count(*) from public.users) as users_all,
        (select count(*) from public.users where created_at > now() - interval '7 days') as users_7d,
        (select count(*) from votes) as votes_all,
        (select count(*) from votes where created_at > now() - interval '7 days') as votes_7d,
        (select count(distinct voter_wallet) from votes
           where created_at > now() - interval '7 days') as voters_7d,
        (select count(*) from submissions where status='approved') as approved,
        (select count(*) from verified_submitters where status='approved') as verified
    """)[0]
    return [
        f"Signups: {r['users_all']} total, {r['users_7d']} in 7d",
        f"Votes: {r['votes_all']} all-time, {r['votes_7d']} in 7d "
        f"from {r['voters_7d']} unique wallets",
        f"Creators: {r['approved']} approved profiles, {r['verified']} KYC-verified",
    ]


def m_card_buys() -> list[str]:
    """Card purchases in the last 7 days.

    There is no purchases table yet — Transak is still on a sandbox key (Part 4.7), so
    the honest answer is that nothing can have been bought, not that zero were.
    """
    if _has_column("project_income", "source"):
        try:
            r = _sb("""select count(*) n, coalesce(sum(amount_usd),0) usd
                       from project_income where source ilike '%transak%'
                         and created_at > now() - interval '7 days'""")[0]
            note = "" if r["n"] else "  (Transak still on a sandbox key — zero is expected, not a drop)"
            return [f"Card buys (7d): {r['n']} for ${float(r['usd']):,.2f}{note}"]
        except Exception:
            pass
    return ["Card buys (7d): not measurable — Transak is not on a production key yet (Part 4.7)"]


def m_liquidity() -> list[str]:
    """Pool depth and the real card-buy ceiling.

    The number that matters for the sale is not TVL, it is the largest card purchase a
    buyer can make before the app's own 5% impact guard refuses the trade. On 2026-08-12
    that ceiling was roughly $30-48, which is why Part 4 exists.
    """
    w = _words(_rpc(V2_PAIR, SEL_GET_RESERVES))
    token0 = "0x" + _rpc(V2_PAIR, SEL_TOKEN0)[-40:]
    r0, r1 = w[0], w[1]
    weth_res, tts_res = (r0, r1) if token0.lower() == WETH.lower() else (r1, r0)
    eth_usd = _eth_usd()
    lines = [f"V2 pool depth: {_fmt_eth(weth_res)} WETH / {_fmt_eth(tts_res, 0)} TTS"
             + (f"  (~${weth_res / 1e18 * eth_usd:,.0f} a side)" if eth_usd else "")]
    if not eth_usd:
        return lines + ["Card-buy ceiling: unavailable (no ETH price)"]

    def impact(usd: float) -> float:
        """Constant-product impact incl. the 0.3% LP fee. The 1% transfer tax does not
        apply here: the pair is isTaxExempt=true on the token (verified on-chain)."""
        dx = usd / eth_usd * 1e18
        dx_fee = dx * 0.997
        out = tts_res * dx_fee / (weth_res + dx_fee)
        if out <= 0:
            return float("inf")
        eff = dx / out
        spot = weth_res / tts_res
        return (eff / spot - 1) * 100

    tbl = [(s, impact(s)) for s in CARD_SIZES_USD]
    lines.append("Buy impact: " + "  ".join(f"${s}={i:.1f}%" for s, i in tbl))
    under2 = [s for s, i in tbl if i < 2]
    under5 = [s for s, i in tbl if i < 5]
    lines.append(f"Max card buy under 2% impact: ${max(under2) if under2 else 0} "
                 f"| under the app's 5% guard: ${max(under5) if under5 else 0}")
    if not under5:
        lines.append("!! every tested size trips the 5% guard — the card on-ramp is effectively shut")
    return lines


def _eth_usd() -> float | None:
    for url, path in (
        ("https://api.coinbase.com/v2/prices/ETH-USD/spot", ("data", "amount")),
        ("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
         ("ethereum", "usd")),
    ):
        try:
            d = _get_json(url)
            for k in path:
                d = d[k]
            return float(d)
        except Exception:
            continue
    return None


def m_trophies() -> list[str]:
    n = _words(_rpc(TROPHY_NFT, SEL_TOTAL_SUPPLY))[0]
    return [f"Trophy NFTs minted: {n}"]


def m_manual_status() -> list[str]:
    """Facts with no API: audit, store, listings, scanner labels."""
    st = _status_file()
    if not st:
        return ["Status file ops/sale/status.json missing — SolidProof/Play/listing "
                "statuses unavailable"]
    out = []
    asof = st.get("as_of")
    for key, label in (("solidproof", "SolidProof"), ("blockaid", "Blockaid"),
                       ("play", "Google Play"), ("listings", "Sale listings")):
        v = st.get(key)
        if isinstance(v, dict):
            v = v.get("state") or json.dumps(v)
        if v:
            out.append(f"{label}: {v}")
    if asof:
        age = (datetime.now(timezone.utc).date() - datetime.fromisoformat(asof).date()).days
        out.append(f"(statuses hand-maintained, as of {asof}"
                   + (f" — {age}d stale, refresh it" if age > 7 else "") + ")")
    return out


METRICS = [
    ("round", m_round),
    ("settlement", m_settlement),
    ("board", m_board),
    ("funnel", m_funnel),
    ("card", m_card_buys),
    ("liquidity", m_liquidity),
    ("trophies", m_trophies),
    ("status", m_manual_status),
]


def collect() -> list[str]:
    """Every metric, each independently guarded. Never raises."""
    out: list[str] = []
    for name, fn in METRICS:
        try:
            out.extend(fn() or [])
        except Exception as exc:
            # Name the metric and the exception type. Never the message: a Supabase or
            # RPC error can echo a URL that carries a key.
            out.append(f"({name} unavailable: {type(exc).__name__})")
    return out


if __name__ == "__main__":
    for line in collect():
        print(" ", line)


# ── public surface ────────────────────────────────────────────────────────

def public_lines() -> list[str]:
    """The subset of the numbers that may appear on a public page (llms-full.txt).

    Deliberately NOT `collect()`. The digest is an internal email and its lines carry
    sprint task ids, repo paths, sale-listing status and operational to-dos. Piping
    that straight into a public file published "how we're doing" alongside "which sale
    listings we haven't posted yet" — which is how the first draft of llms-full.txt
    came out. Publishing is opt-in, per fact, here.

    Unflattering numbers stay. An answer engine that quotes 3 lifetime votes is quoting
    us correctly, and a buyer who finds a number here that contradicts the data room
    walks away. Only internal *process* is withheld, never a bad result.
    """
    out: list[str] = []

    def add(fn):
        try:
            out.extend(fn() or [])
        except Exception as exc:
            out.append(f"({fn.__name__[2:]} unavailable: {type(exc).__name__})")

    add(m_round)
    add(m_trophies)
    try:
        r = _sb("""
          select (select count(*) from public.users) u,
                 (select count(*) from votes) v,
                 (select count(*) from submissions where status='approved') p,
                 (select count(*) from verified_submitters where status='approved') k
        """)[0]
        out += [f"Registered players: {r['u']}",
                f"Votes cast, all time: {r['v']}",
                f"Approved profiles on the board: {r['p']} ({r['k']} KYC-verified)"]
    except Exception as exc:
        out.append(f"(funnel unavailable: {type(exc).__name__})")
    try:
        cur = _words(_rpc(VOTING_V3D, SEL_CURRENT_ROUND))[0]
        out.append(f"Rounds run to date: {cur} ({cur - 1} settled onchain)")
    except Exception:
        pass
    try:
        w = _words(_rpc(V2_PAIR, SEL_GET_RESERVES))
        t0 = "0x" + _rpc(V2_PAIR, SEL_TOKEN0)[-40:]
        weth, tts = (w[0], w[1]) if t0.lower() == WETH.lower() else (w[1], w[0])
        out.append(f"Uniswap v2 liquidity: {_fmt_eth(weth)} WETH / {_fmt_eth(tts, 0)} TTS "
                   f"(shallow — large purchases move the price significantly)")
    except Exception:
        pass
    return out
