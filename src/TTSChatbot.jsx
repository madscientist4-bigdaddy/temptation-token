import { useState, useRef, useEffect } from 'react'

const TTS_SYSTEM_PROMPT = `You are the official Temptation Token ($TTS) support assistant. Friendly, direct, punchy — users are on mobile.

PERSONALITY: If someone is sexually crude or inappropriate, shut it down with a witty one-liner then redirect. Examples: "Nice try Romeo — I only get hot about token prices." or "This is a crypto game not a dating app. Though you CAN compete on here..." Never mean, always clever. One line max, then back to being helpful. If someone is rude, match their confidence: "Bold strategy. Now try staking some TTS." Always stay classy.

CORE KNOWLEDGE:
- Temptation Token ($TTS) is a crypto-powered "Hot or Not" voting game on Base blockchain
- Players vote real $TTS tokens on profiles each week. Winners split prize pool: 40% winning profile, 40% top voter, 10% treasury, 10% Polaris Project (anti-trafficking nonprofit)
- Losing votes are burned — TTS is deflationary
- New users receive 100 TTS sign-up bonus
- App: app.temptationtoken.io | Website: temptationtoken.io

CONTRACT ADDRESSES (Base Mainnet):
- TTS Token: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9
- Voting: 0x08CEDe65eb4A6DbB6586E59Ff57CdE78e940Eb2D
- Staking: 0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc
- Airdrop: 0x214f482ae7DC1C48A4761759Dc70B6545ff36f0f
- NFT: 0x8b1EFa595a9c6b670078701069EADC5ae857091f

SUBMISSION TIERS: Standard 1 TTS, Featured 50 TTS (gold border, first 5 slots), Spotlight 200 TTS (pinned #1, one per week)
STAKING: Bronze $50 1.1x 8% APR → VIP $5000+ 3x votes 45% APR
REFERRALS: 10 TTS per referral. Friend gets 10 TTS bonus on top of 100 TTS signup.
BUY TTS: Uniswap on Base — app.uniswap.org — contract 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9

You have access to a web search tool. Use it to:
1. Answer questions about current TTS price, trading volume, or market data
2. Look up current crypto/Base network news if relevant
3. Fetch latest info from temptationtoken.io if asked about website content
4. Answer wallet or MetaMask troubleshooting questions with current info

Do NOT give financial advice or price predictions. If unsure, suggest support@temptationtoken.io.`

const STORAGE_KEY = 'tts_chat_history'
const MAX_STORED = 20

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : []
  } catch { return [] }
}

function saveHistory(msgs) {
  try {
    const toSave = msgs.slice(-MAX_STORED)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {}
}

export default function TTSChatbot() {
  const [open, setOpen] = useState(false)
  const history = loadHistory()
  const [msgs, setMsgs] = useState([
    { role: 'assistant', content: history.length > 0
      ? `Welcome back! I remember our previous conversation. How can I help you with Temptation Token today?`
      : `Hey! I'm the TTS support bot. I can search for real-time info, answer questions about the game, wallet setup, staking, and more.`
    },
    ...history
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, open])

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    const newMsgs = [...msgs, userMsg]
    setMsgs(newMsgs)
    setLoading(true)

    // Save user message to history
    const historyMsgs = newMsgs.filter(m => m.role !== 'assistant' || newMsgs.indexOf(m) > 0)
    saveHistory(historyMsgs.slice(-MAX_STORED))

    try {
      // First call with web search tool
      setSearching(false)
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: TTS_SYSTEM_PROMPT,
          messages: apiMsgs
        })
      })

      const data = await res.json()

      // Check if tool use happened
      const toolUse = data.content?.find(b => b.type === 'tool_use')
      if (toolUse) {
        setSearching(true)
        // Continue conversation with tool result
        const toolResult = data.content?.find(b => b.type === 'tool_result' || b.type === 'text')
        const finalText = data.content?.filter(b => b.type === 'text').map(b => b.text).join(' ')
        if (finalText) {
          const assistantMsg = { role: 'assistant', content: finalText, searched: true }
          const finalMsgs = [...newMsgs, assistantMsg]
          setMsgs(finalMsgs)
          saveHistory(finalMsgs.slice(1).slice(-MAX_STORED))
        } else {
          // Need second call with tool results
          const followRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system: TTS_SYSTEM_PROMPT,
              messages: [...apiMsgs, { role: 'assistant', content: data.content }]
            })
          })
          const followData = await followRes.json()
          const reply = followData.content?.filter(b => b.type === 'text').map(b => b.text).join(' ') || 'Sorry, try again or email support@temptationtoken.io'
          const assistantMsg = { role: 'assistant', content: reply, searched: true }
          const finalMsgs = [...newMsgs, assistantMsg]
          setMsgs(finalMsgs)
          saveHistory(finalMsgs.slice(1).slice(-MAX_STORED))
        }
      } else {
        const reply = data.content?.filter(b => b.type === 'text').map(b => b.text).join(' ') || 'Sorry, try again or email support@temptationtoken.io'
        const assistantMsg = { role: 'assistant', content: reply }
        const finalMsgs = [...newMsgs, assistantMsg]
        setMsgs(finalMsgs)
        saveHistory(finalMsgs.slice(1).slice(-MAX_STORED))
      }
    } catch(e) {
      console.error(e)
      setMsgs(m => [...m, { role: 'assistant', content: 'Connection error. Please try again.' }])
    }
    setLoading(false)
    setSearching(false)
  }

  const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY)
    setMsgs([{ role: 'assistant', content: "Chat history cleared. How can I help you?" }])
  }

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const S = `
    .tts-fab{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(192,37,58,.4);transition:transform .2s}
    .tts-fab:hover{transform:scale(1.08)}
    .tts-fab svg{width:26px;height:26px;fill:#fff}
    .tts-panel{position:fixed;bottom:92px;right:24px;z-index:9998;width:340px;max-width:calc(100vw - 32px);background:#0c0c14;border:1px solid rgba(212,175,55,.2);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.6);max-height:500px}
    .tts-head{background:linear-gradient(135deg,#1a0a0e,#0c0c14);border-bottom:1px solid rgba(212,175,55,.15);padding:12px 14px;display:flex;align-items:center;gap:10px}
    .tts-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#c0253a,#8b1a2a);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
    .tts-title{font-size:.8rem;font-weight:700;color:#f0d060;letter-spacing:.04em}
    .tts-sub{font-size:.65rem;color:rgba(240,208,96,.5);margin-top:1px}
    .tts-head-btns{margin-left:auto;display:flex;gap:6px;align-items:center}
    .tts-icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.35);font-size:14px;padding:4px;line-height:1;transition:color .2s}
    .tts-icon-btn:hover{color:#fff}
    .tts-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
    .tts-msg{max-width:88%;font-size:.8rem;line-height:1.6;padding:9px 12px;border-radius:12px}
    .tts-user{align-self:flex-end;background:rgba(192,37,58,.25);color:#f5ede0;border-bottom-right-radius:4px}
    .tts-bot{align-self:flex-start;background:rgba(255,255,255,.06);color:#d8d0c8;border-bottom-left-radius:4px}
    .tts-search-badge{font-size:.6rem;color:rgba(240,208,96,.6);margin-top:4px;display:block}
    .tts-typing{align-self:flex-start;background:rgba(255,255,255,.06);padding:9px 13px;border-radius:12px;border-bottom-left-radius:4px}
    .tts-typing span{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(240,208,96,.5);margin:0 2px;animation:tts-b .9s infinite}
    .tts-typing span:nth-child(2){animation-delay:.15s}
    .tts-typing span:nth-child(3){animation-delay:.3s}
    @keyframes tts-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    .tts-bar{border-top:1px solid rgba(255,255,255,.07);padding:9px 11px;display:flex;gap:8px;align-items:flex-end}
    .tts-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:8px 11px;color:#f5ede0;font-size:.78rem;resize:none;outline:none;font-family:inherit;line-height:1.5;max-height:100px;min-height:36px}
    .tts-input::placeholder{color:rgba(255,255,255,.22)}
    .tts-input:focus{border-color:rgba(212,175,55,.4)}
    .tts-send{width:34px;height:34px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s}
    .tts-send:disabled{opacity:.4;cursor:not-allowed}
    .tts-send svg{width:15px;height:15px;fill:#fff}
  `

  return (
    <>
      <style>{S}</style>
      {open && (
        <div className="tts-panel">
          <div className="tts-head">
            <div className="tts-avatar">🔥</div>
            <div>
              <div className="tts-title">TTS Support</div>
              <div className="tts-sub">AI · Web search · Remembers you</div>
            </div>
            <div className="tts-head-btns">
              <button className="tts-icon-btn" title="Clear history" onClick={clearHistory}>🗑</button>
              <button className="tts-icon-btn" onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>
          <div className="tts-msgs">
            {msgs.map((m,i) => (
              <div key={i} className={`tts-msg ${m.role === 'user' ? 'tts-user' : 'tts-bot'}`}>
                {m.content}
                {m.searched && <span className="tts-search-badge">🔍 Searched the web</span>}
              </div>
            ))}
            {loading && (
              <div className="tts-typing">
                <span/><span/><span/>
                {searching && <span style={{fontSize:'.65rem',color:'rgba(240,208,96,.5)',marginLeft:6}}>searching...</span>}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div className="tts-bar">
            <textarea ref={inputRef} className="tts-input" placeholder="Ask anything about TTS..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}/>
            <button className="tts-send" onClick={send} disabled={loading || !input.trim()}>
              <svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
            </button>
          </div>
        </div>
      )}
      <button className="tts-fab" onClick={() => setOpen(o => !o)} aria-label="Open TTS support">
        {open
          ? <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          : <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
        }
      </button>
    </>
  )
}
