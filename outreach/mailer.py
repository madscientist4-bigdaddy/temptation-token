#!/usr/bin/env python3
"""Outbound mail for replies sent from the dashboard.

Two transports, chosen by what is actually configured:

  proton  — Proton Mail Bridge on loopback (SMTP 127.0.0.1:1025, STARTTLS).
            Proton exposes no public SMTP; the Bridge desktop app decrypts locally
            and serves ordinary mail protocols. The password is the one BRIDGE
            GENERATES, not the Proton account password, and Bridge presents a
            self-signed certificate — see loopback_tls_context() for why
            verification is disabled for loopback and nowhere else.

  gmail   — smtp.gmail.com:587, the transport this tree has actually been sending
            on (13 agencies contacted from it).

Proton wins when configured. The default is Gmail on purpose: a reply must come
from the same mailbox as the cold email that provoked it, or it breaks threading
and reaches the agency as a message from a stranger. Switching transports is
therefore a decision about the whole campaign, not about one reply — which is why
it is driven by .env rather than by a per-call argument.
"""

from __future__ import annotations

import os
import smtplib
import socket
import ssl
import sys
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tts_outreach import config, guardrails  # noqa: E402

LOOPBACK = {"127.0.0.1", "::1", "localhost"}

PROTON_SMTP_HOST = os.environ.get("PROTON_SMTP_HOST", "127.0.0.1")
PROTON_SMTP_PORT = int(os.environ.get("PROTON_SMTP_PORT", "1025"))
PROTON_IMAP_HOST = os.environ.get("PROTON_IMAP_HOST", "127.0.0.1")
PROTON_IMAP_PORT = int(os.environ.get("PROTON_IMAP_PORT", "1143"))

BRIDGE_DOWN = "Proton Bridge isn't running — open the Proton Mail Bridge app, then retry."


def proton_user() -> str:
    return (os.environ.get("PROTON_SMTP_USER") or "").strip()


def proton_pass() -> str:
    return (os.environ.get("PROTON_BRIDGE_PW") or "").strip()


def transport() -> str:
    """Which transport this tree will actually use. 'none' means nothing is configured."""
    if proton_user() and proton_pass():
        return "proton"
    cfg = config.load()
    if cfg.from_email and cfg.gmail_app_pw:
        return "gmail"
    return "none"


def from_address(cfg: config.Config | None = None) -> str:
    if transport() == "proton":
        return proton_user()
    return (cfg or config.load()).from_email


def is_loopback(host: str) -> bool:
    return (host or "").strip().lower() in LOOPBACK


def loopback_tls_context(host: str) -> ssl.SSLContext:
    """TLS for Bridge. Verification is relaxed ONLY for loopback, enforced here so
    the exemption can never be inherited by a real remote host through a config change."""
    ctx = ssl.create_default_context()
    if is_loopback(host):
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return ctx


def port_open(host: str, port: int, timeout: float = 3.0) -> tuple[bool, str]:
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
    """Is the configured transport usable right now?

    Gmail is a remote host, so there is nothing meaningful to probe without
    authenticating — reporting 'up' for it means 'credentials are present', and the
    real answer arrives at send time. Bridge, by contrast, is a local process that
    is genuinely often closed, which is worth catching before a send.
    """
    t = transport()
    if t == "proton":
        lines, ok = [], True
        for label, host, port in (("SMTP", PROTON_SMTP_HOST, PROTON_SMTP_PORT),
                                  ("IMAP", PROTON_IMAP_HOST, PROTON_IMAP_PORT)):
            up, why = port_open(host, port)
            ok = ok and up
            lines.append(f"{label} {host}:{port}  {'OK' if up else 'DOWN — ' + why}")
        return ok, lines
    if t == "gmail":
        return True, [f"gmail smtp.gmail.com:587  credentials present ({config.load().from_email})"]
    return False, ["no transport configured — set PROTON_BRIDGE_PW or GMAIL_APP_PW in .env"]


def build(cfg: config.Config, to: str, subject: str, body: str,
          in_reply_to: str = "", unsubscribe: bool = True) -> EmailMessage:
    sender = from_address(cfg)
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = to
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=sender.partition("@")[2] or "localhost")
    if in_reply_to:
        # Keeps the answer inside the thread the agency already has open.
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = in_reply_to
    # List-Unsubscribe belongs on BULK COMMERCIAL mail. Putting it on a reply to your
    # own attorney, or on a correction letter to a security vendor, is both wrong and a
    # tell that the message was machine-generated. send_one.py passes unsubscribe=False.
    if unsubscribe:
        for k, v in guardrails.unsubscribe_headers(sender).items():
            msg[k] = v
    msg.set_content(body)
    return msg


def deliver(cfg: config.Config, to: str, subject: str, body: str,
            in_reply_to: str = "", unsubscribe: bool = True) -> str:
    """Send and return the Message-ID. Raises on any failure — never returns a
    fake success, because a reply the operator believes was sent is worse than an error."""
    t = transport()
    if t == "none":
        raise PermissionError("No mail transport configured (set PROTON_BRIDGE_PW or GMAIL_APP_PW)")

    msg = build(cfg, to, subject, body, in_reply_to, unsubscribe=unsubscribe)

    if t == "proton":
        ok, _ = check()
        if not ok:
            raise ConnectionError(BRIDGE_DOWN)
        ctx = loopback_tls_context(PROTON_SMTP_HOST)
        with smtplib.SMTP(PROTON_SMTP_HOST, PROTON_SMTP_PORT, timeout=30) as s:
            s.ehlo()
            s.starttls(context=ctx)
            s.login(proton_user(), proton_pass())
            s.send_message(msg)
    else:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as s:
            s.starttls()
            s.login(cfg.from_email, cfg.gmail_app_pw)
            s.send_message(msg)

    return msg["Message-ID"]


if __name__ == "__main__":
    ok, lines = check()
    print(f"  transport   {transport()}")
    print(f"  from        {from_address() or '(unset)'}")
    print(f"  reachable   {'yes' if ok else 'NO'}")
    for ln in lines:
        print(f"              {ln}")
