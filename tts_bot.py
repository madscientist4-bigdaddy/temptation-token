import os, json, urllib.request, urllib.parse, hashlib, time

TOKEN = os.environ.get("BOT_TOKEN", "")
BASE = f"https://api.telegram.org/bot{TOKEN}"
APP = "https://app.temptationtoken.io"

def api(method, data=None):
    url = f"{BASE}/{method}"
    payload = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, payload, {"Content-Type":"application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"API error {method}: {e}"); return None

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
        [{"text":"⭐ VIP","callback_data":"vip"},{"text":"🏆 Leaderboard","callback_data":"lb"}],
        [{"text":"🔗 My Referral Link","callback_data":"ref"}],
    ]}

def on_start(cid, name):
    send(cid,
        f"🔥 *Welcome to Temptation Token, {name}!*\n\n"
        "The world\'s first crypto Hot or Not voting game on Base blockchain.\n\n"
        "🗳 Vote $TTS on profiles\n"
        "🏆 Top voter wins 40% of weekly pot\n"
        "🔥 Losing votes burned — deflationary\n"
        "💎 Stake to multiply vote power up to 3x\n\n"
        "*New user bonus:* 100 $TTS free!\n\nTap *Play TTS Now* 👇",
        main_kb())

def on_cb(cid, mid, cbid, data, uid):
    api("answerCallbackQuery",{"callback_query_id":cbid})
    if data=="earn":
        edit(cid,mid,
            "💰 *Ways to Earn $TTS*\n\n"
            "*Vote & Win:* Most TTS on winning profile → 40% of pot\n\n"
            "*Stake Your TTS:*\n"
            "• Bronze $50+ → 8% APR 1.1x votes\n"
            "• Silver $100+ → 12% APR 1.25x votes\n"
            "• Gold $250+ → 18% APR 1.5x votes\n"
            "• Diamond $1000+ → 32% APR 2x votes\n"
            "• VIP $5000+ → 45% APR 3x votes 🔥\n\n"
            "*Refer Friends:* Earn 100 TTS per referral",
            {"inline_keyboard":[[{"text":"🎮 Play Now","web_app":{"url":APP}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="stats":
        edit(cid,mid,
            "📊 *TTS Stats*\n\n"
            "🪙 $TTS on Base Mainnet\n"
            "📍 `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`\n"
            "🔥 Deflationary — losing votes burned\n"
            "💧 Uniswap v3 ETH/TTS pool\n\n"
            "Buy: app.uniswap.org",
            {"inline_keyboard":[[{"text":"🎮 Play Now","web_app":{"url":APP}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="vip":
        edit(cid,mid,
            "⭐ *TTS VIP Vault*\n\n"
            "*Exclusive access for serious players.*\n\n"
            "🥉 *Bronze* — 500 TTS/mo\n"
            "→ Early previews 24hr before voting\n"
            "→ 1.5x vote multiplier\n\n"
            "🥈 *Silver* — 2,000 TTS/mo\n"
            "→ Full gallery + strategy hints\n"
            "→ 1.75x vote multiplier\n\n"
            "🥇 *Gold* — 5,000 TTS/mo\n"
            "→ Creator interaction + NFT drops\n"
            "→ 2x vote multiplier\n\n"
            "💎 *Diamond* — 10,000 TTS/mo\n"
            "→ Kingmaker badge + weekly AMA\n"
            "→ 3x vote multiplier + priority payouts\n\n"
            "Stake TTS in app to earn up to 45% APR.",
            {"inline_keyboard":[[{"text":"💎 Open Staking","web_app":{"url":APP+"#stake"}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="lb":
        edit(cid,mid,
            "🏆 *TTS Leaderboard*\n\n"
            "Weekly round live! Top voter wins 40% of pot.\n"
            "Round closes Sunday 23:59 UTC\n\n"
            "Tap below to see live standings 👇",
            {"inline_keyboard":[[{"text":"📊 View Leaderboard","web_app":{"url":APP+"#leaderboard"}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="ref":
        code=hashlib.md5(str(uid).encode()).hexdigest()[:8]
        link=f"https://t.me/TTSGameBot?start=ref_{code}"
        edit(cid,mid,
            f"🔗 *Your Referral Link*\n\n"
            f"Share and earn *100 TTS* per friend who joins!\n\n"
            f"`{link}`\n\n"
            "Your friend gets 10 TTS signup bonus.\n"
            "You earn 100 TTS automatically! 🔥\n\n"
            "High-profile influencer? Email support@temptationtoken.io for custom rates.",
            {"inline_keyboard":[[{"text":"📤 Share","url":f"https://t.me/share/url?url={urllib.parse.quote(link)}&text=Join+TTS+%26+get+100+TTS+free+%F0%9F%94%A5"}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="back":
        edit(cid,mid,"🔥 *Temptation Token*\n\nVote. Stake. Win real $TTS every week.",main_kb())

def run():
    offset=0
    print(f"TTS Bot starting... token={TOKEN[:8]}...")
    while True:
        try:
            r=api("getUpdates",{"offset":offset,"timeout":30,"limit":100})
            if not r or not r.get("ok"): time.sleep(2); continue
            for u in r.get("result",[]):
                offset=u["update_id"]+1
                try:
                    if "message" in u:
                        m=u["message"]; cid=m["chat"]["id"]; name=m["from"].get("first_name","Friend"); txt=m.get("text","")
                        if txt.startswith("/start"): on_start(cid,name)
                        else: send(cid,"Use the menu buttons 👇",main_kb())
                    elif "callback_query" in u:
                        cb=u["callback_query"]; cid=cb["message"]["chat"]["id"]; mid=cb["message"]["message_id"]
                        on_cb(cid,mid,cb["id"],cb.get("data",""),cb["from"]["id"])
                except Exception as e: print(f"Update error: {e}")
        except Exception as e: print(f"Poll error: {e}"); time.sleep(5)

run()
