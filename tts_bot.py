
import os, json, urllib.request, urllib.parse, hashlib, time

TOKEN = os.environ.get("BOT_TOKEN", "")
BASE = f"https://api.telegram.org/bot{TOKEN}"
APP = "https://app.temptationtoken.io"

def api(method, data=None):
    url = f"{BASE}/{method}"
    payload = json.dumps(data).encode() if data else b""
    req = urllib.request.Request(url, payload or None, {"Content-Type":"application/json"})
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

def back_kb():
    return {"inline_keyboard":[[{"text":"⬅️ Back","callback_data":"back"}]]}

def on_start(cid, name):
    send(cid, f"🔥 *Welcome to Temptation Token, {name}!*\n\nThe world\'s first crypto Hot or Not voting game on Base blockchain.\n\n🗳 Vote $TTS on profiles\n🏆 Top voter wins 40% of weekly pot\n🔥 Losing votes burned\n💎 Stake to multiply vote power up to 3x\n\n*New user bonus:* 100 $TTS free!\n\nTap *Play TTS Now* 👇", main_kb())

def on_cb(cid, mid, cbid, data, uid):
    api("answerCallbackQuery",{"callback_query_id":cbid})
    if data=="earn":
        edit(cid,mid,"💰 *Ways to Earn $TTS*\n\n*Vote & Win:* Most TTS on winning profile → 40% of pot\n\n*Stake:*\n• Bronze $50+ → 8% APR 1.1x\n• Gold $250+ → 18% APR 1.5x\n• VIP $5000+ → 45% APR 3x 🔥\n\n*Refer:* 10 TTS per friend",{"inline_keyboard":[[{"text":"🎮 Play Now","web_app":{"url":APP}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="stats":
        edit(cid,mid,"📊 *TTS Stats*\n\n🪙 $TTS on Base Mainnet\n📍 `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`\n🔥 Deflationary — losing votes burned\n💧 Uniswap v3 ETH/TTS pool\n\nBuy: app.uniswap.org",{"inline_keyboard":[[{"text":"🎮 Play Now","web_app":{"url":APP}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="vip":
        edit(cid,mid,"⭐ *TTS VIP Vault*\n\n🥉 500 TTS/mo → Early previews\n🥈 2,000 TTS/mo → Full gallery\n🥇 5,000 TTS/mo → Creator access\n💎 10,000 TTS/mo → 3x votes + AMA",{"inline_keyboard":[[{"text":"🎮 Stake Now","web_app":{"url":APP}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="lb":
        edit(cid,mid,"🏆 *Leaderboard*\n\nWeekly round live! Top voter wins 40% of pot.\nRound closes Sunday 23:59 UTC",{"inline_keyboard":[[{"text":"📊 View Live","web_app":{"url":APP}}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="ref":
        code=hashlib.md5(str(uid).encode()).hexdigest()[:8]
        link=f"https://t.me/TTSGameBot?start=ref_{code}"
        edit(cid,mid,f"🔗 *Your Referral Link*\n\nEarn 10 TTS per friend!\n\n`{link}`\n\nThey get 100+10 TTS bonus. You get 10 TTS automatically.",{"inline_keyboard":[[{"text":"📤 Share","url":f"https://t.me/share/url?url={urllib.parse.quote(link)}&text=Join+TTS+free+🔥"}],[{"text":"⬅️ Back","callback_data":"back"}]]})
    elif data=="back":
        edit(cid,mid,"🔥 *Temptation Token*\n\nVote. Stake. Win real $TTS every week.",main_kb())

def run():
    offset=0
    print(f"Bot starting... token={TOKEN[:8]}...")
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
