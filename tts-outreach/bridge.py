"""Proton Mail Bridge plumbing — one implementation, used by sender, watcher and status.

Proton has no public SMTP/IMAP. Mail goes through **Proton Mail Bridge**, a desktop app
that decrypts locally and exposes ordinary mail servers on loopback:

    SMTP  127.0.0.1:1025   STARTTLS
    IMAP  127.0.0.1:1143   STARTTLS

Two things about this that bite people:

1. **The password is not your Proton password.** Bridge generates a per-app password and
   shows it in its UI (Settings → the account → "Mailbox details"/password). Your real
   account password will simply fail to authenticate here, which looks like a typo.

2. **Bridge presents a self-signed certificate.** Python's default SSL context verifies
   the chain and will refuse it with CERTIFICATE_VERIFY_FAILED. We therefore use an
   unverified context for these connections — acceptable *only* because the socket never
   leaves the loopback interface, so there is no network path for a man in the middle.
   `loopback_tls_context()` refuses to build that context for any non-loopback host, so
   this exemption cannot quietly follow the config to a real server.

If Bridge is not running, nothing is listening on those ports and every send fails. That
is what `preflight()` exists to catch, loudly, before a run pretends to work.
"""

from __future__ import annotations

import socket
import ssl

import config

LOOPBACK = {"127.0.0.1", "::1", "localhost"}

RED = "\033[31m"
BOLD = "\033[1m"
OFF = "\033[0m"

BRIDGE_DOWN_MESSAGE = (
    "Proton Bridge isn't running — open the Proton Mail Bridge app, then re-run."
)


def is_loopback(host: str) -> bool:
    return (host or "").strip().lower() in LOOPBACK


def loopback_tls_context(host: str) -> ssl.SSLContext:
    """
    TLS context for talking to Bridge. Verification is disabled because Bridge signs its
    own certificate — and ONLY for loopback, enforced here so the exemption can never be
    inherited by a real remote host through a config change.
    """
    ctx = ssl.create_default_context()
    if is_loopback(host):
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def port_open(host: str, port: int, timeout: float = 3.0) -> tuple[bool, str]:
    """Plain TCP reachability check. No credentials, no mail traffic."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, "listening"
    except ConnectionRefusedError:
        return False, "connection refused (nothing listening)"
    except socket.timeout:
        return False, "timed out"
    except OSError as e:
        return False, f"{type(e).__name__}: {e}"


def check() -> tuple[bool, list[str]]:
    """
    Test both Bridge ports. Returns (ok, detail_lines) — used by preflight and status so
    the two can never disagree about what "up" means.
    """
    lines, ok = [], True
    for label, host, port in (
        ("SMTP", config.SMTP_HOST, config.SMTP_PORT),
        ("IMAP", config.IMAP_HOST, config.IMAP_PORT),
    ):
        up, why = port_open(host, port)
        ok = ok and up
        lines.append(f"{label} {host}:{port}  {'OK' if up else 'DOWN — ' + why}")
    return ok, lines


def preflight(verbose: bool = True) -> bool:
    """
    Call before any live send or IMAP poll. Prints the failure in red and returns False —
    the caller must abort. Never let a run continue and fail per-message: that spreads one
    obvious problem across dozens of confusing errors.
    """
    ok, lines = check()
    if ok:
        if verbose:
            for ln in lines:
                print(f"  bridge   {ln}")
        return True

    print(f"\n{RED}{BOLD}  {BRIDGE_DOWN_MESSAGE}{OFF}")
    for ln in lines:
        print(f"{RED}    {ln}{OFF}")
    print(f"{RED}    Bridge must stay open while this runs, and should be set to launch")
    print(f"    at login (Bridge → Settings → Start on login) or scheduled jobs will")
    print(f"    fail whenever the Mac reboots.{OFF}\n")
    return False


def credentials_problem() -> str | None:
    """Human-readable reason the Bridge credentials are unusable, or None."""
    if not config.SMTP_USER:
        return "PROTON_SMTP_USER is not set in .env (your Proton sending address)"
    if not config.SMTP_PASS:
        return ("PROTON_BRIDGE_PW is not set in .env — this is the password Proton Bridge "
                "GENERATES, not your Proton account password")
    return None
