// Ask TTS chatbot widget — temptationtoken.io (WordPress)
// Canonical prompt must match src/lib/asktts-prompt.js in the React repo.
// Deploy: upload this file to Hostinger public_html/tts-chat.js (replaces existing).
(function(){
const PROXY='https://app.temptationtoken.io/api/chat'
const SYS=`You are the official Temptation Token ($TTS) support assistant. Friendly, direct, punchy — users are on mobile.

PERSONALITY: If someone is sexually crude or inappropriate, shut it down with a witty one-liner then redirect. Examples: "Nice try Romeo — I only get hot about token prices." or "This is a crypto game not a dating app. Though you CAN compete on here..." Never mean, always clever. One line max, then back to being helpful. If someone is rude, match their confidence: "Bold strategy. Now try staking some TTS." Always stay classy.

CORE KNOWLEDGE:
- Temptation Token ($TTS) is a crypto-powered "Hot or Not" voting game on Base blockchain
- Players vote real $TTS tokens on profiles each week. Winners split prize pool: 35% winning profile, 35% top voter, 10% Polaris Project (anti-trafficking nonprofit), 20% house (Blockchain Entertainment LLC)
- Losing votes (on non-winning profiles) are burned to 0x000...dEaD at settlement — TTS is deflationary
- Only the winning profile's vote pool is distributed as prizes. Losing-profile votes burn entirely.
- New users receive 500 TTS sign-up bonus (admin-configurable)
- First vote is matched 1:1 up to 1,000 TTS from the marketing wallet
- Submission fee: 5 TTS per profile submitted
- App: app.temptationtoken.io | Website: temptationtoken.io

CONTRACT ADDRESSES (Base Mainnet):
- TTS Token: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
- Voting (active): 0x783b8cd80b586b723188c93ef94ee1beede617b4
- Staking: 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc
- NFT: 0x0768e862D3AB14d85213BfeF8f1D012E77721da2

STAKING TIERS: Bronze $50+ (8% APR, 1.1x vote boost) | Silver $100+ (12% APR, 1.25x) | Gold $250+ (18% APR, 1.5x) | Diamond $1,000+ (32% APR, 2x) | VIP $5,000+ (45% APR, 3x). Live TTS equivalent shown in app based on current price.
REFERRALS: Referrer earns a bonus (admin-configurable amount) when they bring a new user who connects a wallet.
BUY TTS: Uniswap on Base — app.uniswap.org — contract 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9

You have access to a web search tool. Use it to:
1. Answer questions about current TTS price, trading volume, or market data
2. Look up current crypto/Base network news if relevant
3. Fetch latest info from temptationtoken.io if asked about website content
4. Answer wallet or MetaMask troubleshooting questions with current info

Do NOT give financial advice or price predictions. If unsure, suggest support@temptationtoken.io.`

const KEY='tts_web_v1'
function load(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function save(m){try{localStorage.setItem(KEY,JSON.stringify(m.slice(-20)))}catch{}}

let msgs=[],open=false,busy=false
const prior=load()
const greeting=prior.length>0?'Welcome back! How can I help with Temptation Token today?':'Hey! I\'m the TTS assistant. Ask me about the game, how to win, wallet setup, staking, or anything TTS.'
msgs.push({role:'assistant',content:greeting})
prior.forEach(m=>msgs.push(m))

const css=`
#tts-f{position:fixed;bottom:24px;right:24px;z-index:99999;height:48px;padding:0 20px;border-radius:24px;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(192,37,58,.4);transition:transform .2s;font-size:14px;font-weight:800;color:#fff;letter-spacing:.04em;font-family:sans-serif;white-space:nowrap}
#tts-f:hover{transform:scale(1.05)}
#tts-w{position:fixed;bottom:84px;right:24px;z-index:99998;width:340px;max-width:calc(100vw - 32px);background:#0c0c14;border:1px solid rgba(212,175,55,.2);border-radius:16px;overflow:hidden;display:none;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.6);max-height:500px;font-family:sans-serif}
#tts-w.on{display:flex}
#tts-h{background:linear-gradient(135deg,#1a0a0e,#0c0c14);border-bottom:1px solid rgba(212,175,55,.15);padding:12px 14px;display:flex;align-items:center;gap:10px}
#tts-av{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#c0253a,#8b1a2a);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.tts-tt{font-size:13px;font-weight:700;color:#f0d060;letter-spacing:.04em}
.tts-st{font-size:11px;color:rgba(240,208,96,.5);margin-top:1px}
#tts-hb{margin-left:auto;display:flex;gap:6px}
.tts-ib{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.35);font-size:14px;padding:4px;line-height:1}
.tts-ib:hover{color:#fff}
#tts-m{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
.tts-b{max-width:88%;font-size:13px;line-height:1.6;padding:9px 12px;border-radius:12px;word-wrap:break-word}
.tts-u{align-self:flex-end;background:rgba(192,37,58,.25);color:#f5ede0;border-bottom-right-radius:3px}
.tts-a{align-self:flex-start;background:rgba(255,255,255,.06);color:#d8d0c8;border-bottom-left-radius:3px}
.tts-srch{font-size:10px;color:rgba(240,208,96,.55);margin-top:3px;display:block}
#tts-t{align-self:flex-start;background:rgba(255,255,255,.06);padding:9px 13px;border-radius:12px;border-bottom-left-radius:3px;display:none}
#tts-t span{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(240,208,96,.5);margin:0 2px;animation:ttsb .9s infinite}
#tts-t span:nth-child(2){animation-delay:.15s}#tts-t span:nth-child(3){animation-delay:.3s}
@keyframes ttsb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
#tts-bar{border-top:1px solid rgba(255,255,255,.07);padding:9px 11px;display:flex;gap:7px;align-items:flex-end}
#tts-in{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:8px 11px;color:#f5ede0;font-size:13px;resize:none;outline:none;font-family:sans-serif;line-height:1.5;max-height:80px;min-height:34px}
#tts-in::placeholder{color:rgba(255,255,255,.22)}
#tts-in:focus{border-color:rgba(212,175,55,.4)}
#tts-s{height:36px;padding:0 14px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;font-size:12px;font-weight:700;color:#fff;font-family:sans-serif;letter-spacing:.04em;white-space:nowrap}
#tts-s:disabled{opacity:.4;cursor:not-allowed}
`

const st=document.createElement('style');st.textContent=css;document.head.appendChild(st)
document.body.insertAdjacentHTML('beforeend',`
<button id="tts-f" aria-label="TTS Support Chat">🔥 Ask TTS</button>
<div id="tts-w">
  <div id="tts-h">
    <div id="tts-av">🔥</div>
    <div><div class="tts-tt">TTS Support</div><div class="tts-st">AI · web search · remembers you</div></div>
    <div id="tts-hb">
      <button class="tts-ib" id="tts-clr" title="Clear history">🗑</button>
      <button class="tts-ib" id="tts-cl">✕</button>
    </div>
  </div>
  <div id="tts-m">
    <div class="tts-b tts-a">${greeting}</div>
    <div id="tts-t"><span></span><span></span><span></span></div>
  </div>
  <div id="tts-bar">
    <textarea id="tts-in" placeholder="Ask anything about TTS..." rows="1"></textarea>
    <button id="tts-s">Submit</button>
  </div>
</div>`)

const fab=document.getElementById('tts-f')
const win=document.getElementById('tts-w')
const msgsEl=document.getElementById('tts-m')
const inp=document.getElementById('tts-in')
const sendBtn=document.getElementById('tts-s')
const typing=document.getElementById('tts-t')

function scroll(){setTimeout(()=>msgsEl.scrollTop=msgsEl.scrollHeight,50)}
function addMsg(role,text,searched){
  const d=document.createElement('div')
  d.className='tts-b '+(role==='user'?'tts-u':'tts-a')
  d.textContent=text
  if(searched){const s=document.createElement('span');s.className='tts-srch';s.textContent='🔍 searched web';d.appendChild(s)}
  msgsEl.insertBefore(d,typing);scroll()
}

fab.addEventListener('click',()=>{
  open=!open
  win.classList.toggle('on',open)
  fab.textContent=open?'✕ Close':'🔥 Ask TTS'
  if(open){inp.focus();scroll()}
})
document.getElementById('tts-cl').addEventListener('click',()=>{
  open=false;win.classList.remove('on');fab.textContent='🔥 Ask TTS'
})
document.getElementById('tts-clr').addEventListener('click',()=>{
  localStorage.removeItem(KEY)
  msgs=[{role:'assistant',content:'History cleared. How can I help?'}]
  msgsEl.innerHTML='<div class="tts-b tts-a">History cleared. How can I help?</div><div id="tts-t" style="display:none"><span></span><span></span><span></span></div>'
})

async function send(){
  const text=inp.value.trim();if(!text||busy)return
  inp.value='';msgs.push({role:'user',content:text});addMsg('user',text)
  busy=true;sendBtn.disabled=true;typing.style.display='block';scroll()
  try{
    const r=await fetch(PROXY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({system:SYS,messages:msgs.map(m=>({role:m.role,content:m.content}))})})
    const d=await r.json()
    const reply=d.content?.filter(b=>b.type==='text').map(b=>b.text).join(' ')||'Try again or email support@temptationtoken.io'
    msgs.push({role:'assistant',content:reply});save(msgs.slice(1))
    typing.style.display='none';addMsg('assistant',reply,d.searched)
  }catch(e){
    typing.style.display='none';addMsg('assistant','Connection error. Please try again.')
  }
  busy=false;sendBtn.disabled=false
}

sendBtn.addEventListener('click',send)
inp.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}})
})()
