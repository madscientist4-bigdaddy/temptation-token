import os, json, urllib.request, urllib.parse, hashlib, time, sqlite3, threading
from datetime import datetime, timezone

TOKEN     = os.environ.get("BOT_TOKEN", "")
BOT2_TOKEN = os.environ.get("BOT2_TOKEN", "")
BASE      = f"https://api.telegram.org/bot{TOKEN}"
BASE2     = f"https://api.telegram.org/bot{BOT2_TOKEN}"
APP       = "https://app.temptationtoken.io"
CHANNEL   = "@temptationtoken"
COMMUNITY = "@TTSCommunityChat"
VIP_LINK  = "https://t.me/+F2lyVRf92n4xMDRh"
ADMIN_IDS = set()

VIP_TIERS = {
    "bronze":  {"stars": 350,  "label": "Bronze",  "tts": 500,   "desc": "Early previews · 1.5x votes"},
    "silver":  {"stars": 1400, "label": "Silver",  "tts": 2000,  "desc": "Full gallery · 1.75x votes"},
    "gold":    {"stars": 3500, "label": "Gold",    "tts": 5000,  "desc": "Creator access · 2x votes · NFT drops"},
    "diamond": {"stars": 7000, "label": "Diamond", "tts": 10000, "desc": "Kingmaker · 3x votes · weekly AMA"},
}

REF_REFERRER_BONUS = 100
REF_NEW_USER_BONUS = 10
SIGNUP_BONUS       = 100
DB_PATH = os.environ.get("DB_PATH", "/tmp/tts.db")

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            uid INTEGER PRIMARY KEY, username TEXT, first_name TEXT,
            ref_code TEXT UNIQUE, referred_by TEXT, vip_tier TEXT DEFAULT "none",
            vip_expiry INTEGER DEFAULT 0, joined_at INTEGER, age_verified INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT, referrer_code TEXT,
            new_uid INTEGER, bonus_paid INTEGER DEFAULT 0, created_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS referral_settings (
            id INTEGER PRIMARY KEY DEFAULT 1, referrer_bonus INTEGER DEFAULT 100,
            new_user_bonus INTEGER DEFAULT 10, signup_bonus INTEGER DEFAULT 100,
            program_active INTEGER DEFAULT 1
        );
        INSERT OR IGNORE INTO referral_settings (id) VALUES (1);
    """)
    con.commit(); con.close()

def db(): return sqlite3.connect(DB_PATH)

def get_user(uid):
    with db() as con:
        cur = con.execute("SELECT * FROM users WHERE uid=?", (uid,))
        row = cur.fetchone()
        if row: return dict(zip([d[0] for d in cur.description], row))
    return None

def upsert_user(uid, username, first_name, ref_code, referred_by=None):
    with db() as con:
        con.execute("""INSERT INTO users (uid,username,first_name,ref_code,referred_by,joined_at)
            VALUES (?,?,?,?,?,?) ON CONFLICT(uid) DO UPDATE SET
            username=excluded.username, first_name=excluded.first_name""",
            (uid, username or "", first_name or "Friend", ref_code, referred_by, int(time.time())))
        con.commit()

def set_age_verified(uid):
    with db() as con:
        con.execute("UPDATE users SET age_verified=1 WHERE uid=?", (uid,)); con.commit()

def record_referral(referrer_code, new_uid):
    with db() as con:
        if not con.execute("SELECT id FROM referrals WHERE new_uid=?", (new_uid,)).fetchone():
            con.execute("INSERT INTO referrals (referrer_code,new_uid,created_at) VALUES (?,?,?)",
                        (referrer_code, new_uid, int(time.time()))); con.commit(); return True
    return False

def get_stats():
    with db() as con:
        total = con.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        vip   = con.execute("SELECT COUNT(*) FROM users WHERE vip_tier != \"none\"").fetchone()[0]
        refs  = con.execute("SELECT COUNT(*) FROM referrals").fetchone()[0]
        new_today = con.execute("SELECT COUNT(*) FROM users WHERE joined_at > ?",
                                (int(time.time())-86400,)).fetchone()[0]
    return {"total":total,"vip":vip,"refs":refs,"new_today":new_today}

def _call(base_url, method, data=None):
    url = f"{base_url}/{method}"
    payload = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, payload, {"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read())
    except Exception as e: print(f"API error {method}: {e}"); return None

def api(method, data=None):  return _call(BASE,  method, data)
def api2(method, data=None): return _call(BASE2, method, data)

def send(cid, text, kb=None):
    d = {"chat_id":cid,"text":text,"parse_mode":"Markdown"}
    if kb: d["reply_markup"] = json.dumps(kb)
    return api("sendMessage", d)

def edit(cid, mid, text, kb=None):
    d = {"chat_id":cid,"message_id":mid,"text":text,"parse_mode":"Markdown"}
    if kb: d["reply_markup"] = json.dumps(kb)
    return api("editMessageText", d)

def main_kb():
    return {"inline_keyboard":[
        [{"text":"🎮 Play TTS Now","web_app":{"url":APP}}],
        [{"text":"💰 How to Earn","callback_data":"earn"},{"text":"📊 Stats","callback_data":"stats"}],
        [{"text":"⭐ VIP Access","callback_data":"vip"},{"text":"🏆 Leaderboard","callback_data":"lb"}],
        [{"text":"🔗 My Referral Link","callback_data":"ref"}],
    ]}

def on_start(cid, uid, name, uname, args):
    ref_code = hashlib.md5(str(uid).encode()).hexdigest()[:8]
    referred_by = None
    if args.startswith("ref_"):
        referred_by = args[4:]
        record_referral(referred_by, uid)
    upsert_user(uid, uname, name, ref_code, referred_by)
    user = get_user(uid)
    if not user or not user["age_verified"]:
        send(cid, "🔞 *Age Verification Required*\n\nTemptation Token contains adult content.\n\nBy tapping confirm you verify you are 18+ and agree to our terms.",
            {"inline_keyboard":[[{"text":"✅ I am 18+ — Continue","callback_data":"age_ok"}],
                                 [{"text":"❌ Exit","callback_data":"age_no"}]]})
        return
    send(cid,
        f"🔥 *Welcome back, {name}!*\n\n"
        "The world\'s first crypto Hot or Not voting game on Base.\n\n"
        "🗳 Vote $TTS on profiles\n"
        "🏆 Top voter wins 40% of weekly pot\n"
        "🔥 Losing votes burned\n"
        "💎 Stake for up to 3x vote power\n\n"
        f"*Your signup bonus:* {SIGNUP_BONUS} $TTS 🎁",
        main_kb())
    try:
        api("inviteChatMember", {"chat_id": CHANNEL, "user_id": uid})
    except: pass

def on_callback(cid, mid, cbid, data, uid, name):
    api("answerCallbackQuery", {"callback_query_id": cbid})
    if data == "age_ok":
        set_age_verified(uid)
        edit(cid, mid,
            f"🔥 *Welcome to Temptation Token, {name}!*\n\n"
            "Vote $TTS on profiles every week.\n"
            "Top voter wins 40% of the prize pool.\n\n"
            f"*New user bonus:* {SIGNUP_BONUS} $TTS free!\n\n"
            "Tap *Play TTS Now* to start 👇", main_kb())
        send(cid, f"💬 Join our community: https://t.me/TTSCommunityChat")
    elif data == "age_no":
        edit(cid, mid, "You must be 18+ to use Temptation Token. Goodbye.")
    elif data == "earn":
        edit(cid, mid,
            "💰 *Ways to Earn $TTS*\n\n"
            "*Vote & Win:* Put the most TTS on the winning profile → earn 40% of that profile\'s vote pool\n\n"
            "*Stake Your TTS:*\n"
            "• Bronze $50+ → 8% APR · 1.1x votes\n"
            "• Silver $100+ → 12% APR · 1.25x votes\n"
            "• Gold $250+ → 18% APR · 1.5x votes\n"
            "• Diamond $1,000+ → 32% APR · 2x votes\n"
            "• VIP $5,000+ → 45% APR · 3x votes 🔥\n\n"
            "*Refer Friends:* Earn 100 TTS per referral",
            {"inline_keyboard":[[{"text":"🎮 Play Now","web_app":{"url":APP}}],
                                 [{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data == "stats":
        edit(cid, mid,
            "📊 *$TTS Live Stats*\n\n"
            "🪙 Contract: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`\n"
            "⛓ Network: Base Mainnet\n"
            "🔥 Deflationary — losing votes burned weekly\n"
            "💧 Trading on Uniswap V2 Base\n\n"
            "Buy $TTS:\nhttps://app.uniswap.org/swap?outputCurrency=0x5570eA97d53A53170e973894A9Fa7feb5785d3b9&chain=base",
            {"inline_keyboard":[[{"text":"📈 View Chart","url":"https://dexscreener.com/base/0x77Fe188379BEaAd3BCFb26c965c812CEa721ce68"}],
                                 [{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data == "vip":
        tiers_text = "\n".join([
            f"{'🥉' if k=='bronze' else '🥈' if k=='silver' else '🥇' if k=='gold' else '💎'} "
            f"*{v['label']}* — {v['stars']} ⭐ Stars/mo\n   → {v['desc']}"
            for k,v in VIP_TIERS.items()])
        edit(cid, mid,
            f"⭐ *TTS VIP Vault*\n\nExclusive access for serious players.\n\n{tiers_text}\n\n"
            "Pay with Telegram Stars — no crypto wallet needed.\nInstant access, no chargebacks.",
            {"inline_keyboard":[
                [{"text":"🥉 Bronze — 350 Stars","callback_data":"buy_vip_bronze"}],
                [{"text":"🥈 Silver — 1,400 Stars","callback_data":"buy_vip_silver"}],
                [{"text":"🥇 Gold — 3,500 Stars","callback_data":"buy_vip_gold"}],
                [{"text":"💎 Diamond — 7,000 Stars","callback_data":"buy_vip_diamond"}],
                [{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data.startswith("buy_vip_"):
        tier_key = data[8:]
        tier = VIP_TIERS.get(tier_key)
        if tier:
            api("sendInvoice", {
                "chat_id": cid, "title": f"TTS VIP {tier['label']}",
                "description": f"30-day VIP access: {tier['desc']}",
                "payload": f"vip_{tier_key}", "currency": "XTR",
                "prices": [{"label": f"VIP {tier['label']}", "amount": tier["stars"]}]})
    elif data == "lb":
        edit(cid, mid,
            "🏆 *TTS Leaderboard*\n\nWeekly round is live!\nTop voter on the winning profile wins 40% of that profile\'s pool + wager returned.\n\nRound closes Sunday 23:59 UTC.",
            {"inline_keyboard":[[{"text":"📊 View Live Leaderboard","web_app":{"url":APP}}],
                                 [{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data == "ref":
        ref_code = hashlib.md5(str(uid).encode()).hexdigest()[:8]
        link = f"https://t.me/TTSGameBot?start=ref_{ref_code}"
        encoded = urllib.parse.quote(link)
        share_text = urllib.parse.quote("Join Temptation Token — vote on profiles, win $TTS every week! Use my link for a bonus 🔥")
        edit(cid, mid,
            f"🔗 *Your Referral Link*\n\n"
            f"Share and earn *100 $TTS* for every friend who joins!\n\n"
            f"`{link}`\n\n"
            "Your friend also gets a bonus on signup.\n"
            "High-profile influencer? Email support@temptationtoken.io for custom rates.",
            {"inline_keyboard":[
                [{"text":"📤 Share Link","url":f"https://t.me/share/url?url={encoded}&text={share_text}"}],
                [{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data == "back":
        edit(cid, mid, "🔥 *Temptation Token*\n\nVote. Stake. Win real $TTS every week.", main_kb())

def on_payment(cid, uid, payload):
    parts = payload.split("_")
    if len(parts) >= 2 and parts[0] == "vip":
        tier_key = parts[1]
        tier = VIP_TIERS.get(tier_key)
        if tier:
            expiry = int(time.time()) + (30*24*3600)
            with db() as con:
                con.execute("UPDATE users SET vip_tier=?, vip_expiry=? WHERE uid=?",
                            (tier_key, expiry, uid)); con.commit()
            send(cid,
                f"✅ *VIP {tier['label']} Access Granted!*\n\n{tier['desc']}\n\nJoin your vault:",
                {"inline_keyboard":[[{"text":"💎 Enter VIP Vault","url":VIP_LINK}],
                                     [{"text":"🎮 Play Now","web_app":{"url":APP}}]]})

DAILY_POSTS = [
    "🏆 *Weekly voting is LIVE!* Top voter wins 40% of the pot.\n\nVote now 👉 t.me/TTSGameBot",
    "💰 Staking $TTS gives you up to 3x vote power AND 45% APR.\n\nStart staking 👉 t.me/TTSGameBot",
    "🔗 Refer a friend — earn *100 $TTS* per referral!\n\nGet your link 👉 t.me/TTSGameBot",
    "🔥 $TTS is deflationary — every losing vote gets BURNED forever.\n\nBuy $TTS 👉 t.me/TTSGameBot",
    "⭐ VIP Vault is open — early previews, vote multipliers, NFT drops.\n\nJoin 👉 t.me/TTSGameBot",
    "🤝 10% of every weekly prize pool goes to the Polaris Project — fighting human trafficking.\n\nLearn more 👉 polarisproject.org",
    "📊 Check the live leaderboard — who\'s winning this week\'s vote?\n\nView 👉 t.me/TTSGameBot",
]

def broadcaster():
    if not BOT2_TOKEN: print("BOT2_TOKEN not set — broadcasts disabled"); return
    day = 0
    while True:
        time.sleep(86400)
        msg = DAILY_POSTS[day % len(DAILY_POSTS)]
        api2("sendMessage", {"chat_id":CHANNEL,   "text":msg,"parse_mode":"Markdown"})
        api2("sendMessage", {"chat_id":COMMUNITY, "text":msg,"parse_mode":"Markdown"})
        print(f"Broadcast sent day {day}"); day += 1

def run():
    init_db()
    print(f"TTS Bot v2 starting... token={TOKEN[:8]}...")
    threading.Thread(target=broadcaster, daemon=True).start()
    offset = 0
    while True:
        try:
            r = api("getUpdates", {"offset":offset,"timeout":30,"limit":100})
            if not r or not r.get("ok"): time.sleep(2); continue
            for u in r.get("result", []):
                offset = u["update_id"] + 1
                try:
                    if "message" in u:
                        m = u["message"]; cid = m["chat"]["id"]; uid = m["from"]["id"]
                        name = m["from"].get("first_name","Friend")
                        uname = m["from"].get("username","")
                        txt = m.get("text","")
                        if "successful_payment" in m:
                            on_payment(cid, uid, m["successful_payment"]["invoice_payload"]); continue
                        if txt.startswith("/start"):
                            on_start(cid, uid, name, uname, txt[7:].strip())
                        elif uid in ADMIN_IDS and txt.startswith("/adminstats"):
                            s = get_stats()
                            send(cid, '📊 *Admin Stats*\n\nUsers: ' + str(s['total']) + '\nVIP: ' + str(s['vip']) + '\nReferrals: ' + str(s['refs']) + '\nNew today: ' + str(s['new_today']))
                        elif uid in ADMIN_IDS and txt.startswith("/broadcast "):
                            msg = txt[11:]
                            api("sendMessage",{"chat_id":CHANNEL,"text":msg,"parse_mode":"Markdown"})
                            api("sendMessage",{"chat_id":COMMUNITY,"text":msg,"parse_mode":"Markdown"})
                            send(cid, "✅ Broadcast sent.")
                        else:
                            user = get_user(uid)
                            if user and user["age_verified"]: send(cid,"Use the menu buttons 👇",main_kb())
                            else: on_start(cid, uid, name, uname, "")
                    elif "pre_checkout_query" in u:
                        api("answerPreCheckoutQuery",{"pre_checkout_query_id":u["pre_checkout_query"]["id"],"ok":True})
                    elif "callback_query" in u:
                        cb = u["callback_query"]; cid = cb["message"]["chat"]["id"]
                        mid = cb["message"]["message_id"]; uid = cb["from"]["id"]
                        on_callback(cid, mid, cb["id"], cb.get("data",""), uid, cb["from"].get("first_name","Friend"))
                except Exception as e: print(f"Update error: {e}")
        except Exception as e: print(f"Poll error: {e}"); time.sleep(5)

run()
