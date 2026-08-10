"""Configuration, loaded from outreach/.env. No secret is ever hardcoded here."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT / ".env"
DATA_DIR = ROOT / "data"
TEMPLATE_DIR = ROOT / "templates"
DRAFTS_DIR = ROOT / "drafts"
OUTBOX_DIR = ROOT / "outbox"
PACKS_DIR = ROOT / "packs"
LOGS_DIR = ROOT / "logs"
DB_PATH = DATA_DIR / "outreach.db"


def _load_env(path: Path = ENV_PATH) -> None:
    """
    Minimal .env reader. os.environ wins, so a shell export can override a file value
    without editing it — useful for `DRY_RUN=false make send` one-off live runs.
    """
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip().strip('"').strip("'")
        os.environ.setdefault(k, v)


_load_env()


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Config:
    from_email: str
    gmail_app_pw: str
    calendly_url: str
    loom_url: str
    mail_addr: str
    hunter_api_key: str
    tts_api_url: str
    tts_api_key: str
    onepager_url: str
    # DRY_RUN defaults TRUE and must be turned off deliberately. Every accidental path —
    # unset variable, typo, missing .env — lands on "print, don't send".
    dry_run: bool

    @property
    def configured(self) -> bool:
        return bool(self.from_email and self.gmail_app_pw and self.mail_addr)

    def missing(self) -> list[str]:
        out = []
        if not self.from_email:
            out.append("FROM_EMAIL")
        if not self.gmail_app_pw:
            out.append("GMAIL_APP_PW")
        if not self.mail_addr:
            out.append("MAIL_ADDR")
        if not self.calendly_url:
            out.append("CALENDLY_URL")
        return out


def load() -> Config:
    return Config(
        from_email=os.environ.get("FROM_EMAIL", "").strip(),
        gmail_app_pw=os.environ.get("GMAIL_APP_PW", "").replace(" ", "").strip(),
        calendly_url=os.environ.get("CALENDLY_URL", "").strip(),
        loom_url=os.environ.get("LOOM_URL", "").strip(),
        mail_addr=os.environ.get("MAIL_ADDR", "").strip(),
        hunter_api_key=os.environ.get("HUNTER_API_KEY", "").strip(),
        tts_api_url=os.environ.get("TTS_API_URL", "").strip(),
        tts_api_key=os.environ.get("TTS_API_KEY", "").strip(),
        onepager_url=os.environ.get("ONEPAGER_URL", "https://temptationtoken.io/partners").strip(),
        dry_run=_bool("DRY_RUN", True),
    )


for _d in (DATA_DIR, DRAFTS_DIR, OUTBOX_DIR, PACKS_DIR, LOGS_DIR):
    _d.mkdir(parents=True, exist_ok=True)
