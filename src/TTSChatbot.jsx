import { useState, useRef, useEffect } from 'react'
import { ASKTTS_SYSTEM_PROMPT } from './lib/asktts-prompt.js'

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
      : `Hey! I'm the TTS assistant. Ask me about the game, how to win, wallet setup, staking, or anything TTS.`
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

    const historyMsgs = newMsgs.filter(m => m.role !== 'assistant' || newMsgs.indexOf(m) > 0)
    saveHistory(historyMsgs.slice(-MAX_STORED))

    try {
      setSearching(false)
      const apiMsgs = newMsgs.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: ASKTTS_SYSTEM_PROMPT,
          messages: apiMsgs
        })
      })

      const data = await res.json()

      const toolUse = data.content?.find(b => b.type === 'tool_use')
      if (toolUse) {
        setSearching(true)
        const finalText = data.content?.filter(b => b.type === 'text').map(b => b.text).join(' ')
        if (finalText) {
          const assistantMsg = { role: 'assistant', content: finalText, searched: true }
          const finalMsgs = [...newMsgs, assistantMsg]
          setMsgs(finalMsgs)
          saveHistory(finalMsgs.slice(1).slice(-MAX_STORED))
        } else {
          const followRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system: ASKTTS_SYSTEM_PROMPT,
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
    setMsgs([{ role: 'assistant', content: "History cleared. How can I help?" }])
  }

  const onKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  const S = `
    .tts-fab{position:fixed;bottom:24px;right:24px;z-index:99999;height:48px;padding:0 20px;border-radius:24px;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(192,37,58,.4);transition:transform .2s;font-size:14px;font-weight:800;color:#fff;letter-spacing:.04em;font-family:inherit;white-space:nowrap}
    .tts-fab:hover{transform:scale(1.05)}
    .tts-panel{position:fixed;bottom:84px;right:24px;z-index:99998;width:340px;max-width:calc(100vw - 32px);background:#0c0c14;border:1px solid rgba(212,175,55,.2);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.6);max-height:500px}
    .tts-head{background:linear-gradient(135deg,#1a0a0e,#0c0c14);border-bottom:1px solid rgba(212,175,55,.15);padding:12px 14px;display:flex;align-items:center;gap:10px}
    .tts-avatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#c0253a,#8b1a2a);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
    .tts-title{font-size:.8rem;font-weight:700;color:#f0d060;letter-spacing:.04em}
    .tts-sub{font-size:.65rem;color:rgba(240,208,96,.5);margin-top:1px}
    .tts-head-btns{margin-left:auto;display:flex;gap:6px;align-items:center}
    .tts-icon-btn{background:none;border:none;cursor:pointer;color:rgba(255,255,255,.35);font-size:14px;padding:4px;line-height:1;transition:color .2s}
    .tts-icon-btn:hover{color:#fff}
    .tts-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
    .tts-msg{max-width:88%;font-size:13px;line-height:1.6;padding:9px 12px;border-radius:12px;word-wrap:break-word}
    .tts-user{align-self:flex-end;background:rgba(192,37,58,.25);color:#f5ede0;border-bottom-right-radius:3px}
    .tts-bot{align-self:flex-start;background:rgba(255,255,255,.06);color:#d8d0c8;border-bottom-left-radius:3px}
    .tts-search-badge{font-size:10px;color:rgba(240,208,96,.55);margin-top:3px;display:block}
    .tts-typing{align-self:flex-start;background:rgba(255,255,255,.06);padding:9px 13px;border-radius:12px;border-bottom-left-radius:3px}
    .tts-typing span{display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(240,208,96,.5);margin:0 2px;animation:tts-b .9s infinite}
    .tts-typing span:nth-child(2){animation-delay:.15s}
    .tts-typing span:nth-child(3){animation-delay:.3s}
    @keyframes tts-b{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    .tts-bar{border-top:1px solid rgba(255,255,255,.07);padding:9px 11px;display:flex;gap:7px;align-items:flex-end}
    .tts-input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:8px 11px;color:#f5ede0;font-size:13px;resize:none;outline:none;font-family:inherit;line-height:1.5;max-height:80px;min-height:34px}
    .tts-input::placeholder{color:rgba(255,255,255,.22)}
    .tts-input:focus{border-color:rgba(212,175,55,.4)}
    .tts-send{height:36px;padding:0 14px;border-radius:9px;flex-shrink:0;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;font-size:.75rem;font-weight:700;color:#fff;letter-spacing:.04em;white-space:nowrap;font-family:inherit}
    .tts-send:disabled{opacity:.4;cursor:not-allowed}
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
              <div className="tts-sub">AI · web search · remembers you</div>
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
                {m.searched && <span className="tts-search-badge">🔍 searched web</span>}
              </div>
            ))}
            {loading && (
              <div className="tts-typing">
                <span/><span/><span/>
                {searching && <span style={{fontSize:'10px',color:'rgba(240,208,96,.5)',marginLeft:6}}>searching...</span>}
              </div>
            )}
            <div ref={bottomRef}/>
          </div>
          <div className="tts-bar">
            <textarea ref={inputRef} className="tts-input" placeholder="Ask anything about TTS..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}/>
            <button className="tts-send" onClick={send} disabled={loading || !input.trim()}>Submit</button>
          </div>
        </div>
      )}
      <button className="tts-fab" onClick={() => setOpen(o => !o)} aria-label="Open TTS support">
        {open ? '✕ Close' : '🔥 Ask TTS'}
      </button>
    </>
  )
}
