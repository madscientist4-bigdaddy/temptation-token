import { useState, useRef, useEffect } from "react"
const SYS=`You are the TTS support bot for Temptation Token ($TTS) — a crypto Hot or Not voting game on Base blockchain. Keep answers short. TTS contract: 0x5570eA97d53A53170e973894A9Fa7feb5785d3b9. App: app.temptationtoken.io. Players vote TTS on profiles weekly — 40% prize to winner, 40% top voter, 10% treasury, 10% Polaris nonprofit. 100 TTS signup bonus. Staking boosts votes. Use web search for current price/news. No financial advice.`
const KEY="tts_v2"
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||"[]")}catch{return[]}}
const save=m=>{try{localStorage.setItem(KEY,JSON.stringify(m.slice(-20)))}catch{}}
export default function TTSChatbot(){
  const prior=load()
  const[open,setOpen]=useState(false)
  const[msgs,setMsgs]=useState([{role:"assistant",content:prior.length?"Welcome back! How can I help with TTS?":"Hey! I am the TTS AI assistant. Ask me anything about the game, staking, wallets, or current prices."},...prior])
  const[input,setInput]=useState("")
  const[loading,setLoading]=useState(false)
  const bottom=useRef(null)
  const inp=useRef(null)
  useEffect(()=>{if(open&&bottom.current)bottom.current.scrollIntoView({behavior:"smooth"})},[msgs,open])
  useEffect(()=>{if(open&&inp.current)inp.current.focus()},[open])
  const send=async()=>{
    const t=input.trim();if(!t||loading)return
    setInput("")
    const next=[...msgs,{role:"user",content:t}]
    setMsgs(next);setLoading(true)
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:600,system:SYS,tools:[{type:"web_search_20250305",name:"web_search"}],messages:next.map(m=>({role:m.role,content:m.content}))})})
      const d=await r.json()
      let reply="",searched=false
      const tu=d.content?.find(b=>b.type==="tool_use")
      if(tu){
        searched=true
        const r2=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:600,system:SYS,tools:[{type:"web_search_20250305",name:"web_search"}],messages:[...next.map(m=>({role:m.role,content:m.content})),{role:"assistant",content:d.content}]})})
        const d2=await r2.json()
        reply=d2.content?.filter(b=>b.type==="text").map(b=>b.text).join(" ")||"Try again."
      }else{reply=d.content?.filter(b=>b.type==="text").map(b=>b.text).join(" ")||"Try again."}
      const fin=[...next,{role:"assistant",content:reply,searched}]
      setMsgs(fin);save(fin.slice(1))
    }catch{setMsgs(m=>[...m,{role:"assistant",content:"Connection error."}])}
    setLoading(false)
  }
  const S=`.tf{position:fixed;bottom:24px;right:24px;z-index:9999;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(192,37,58,.4)}.tf svg{width:26px;height:26px;fill:#fff}.tp{position:fixed;bottom:92px;right:24px;z-index:9998;width:330px;max-width:calc(100vw - 32px);background:#0c0c14;border:1px solid rgba(212,175,55,.2);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,.6);max-height:480px}.th{background:#1a0a0e;border-bottom:1px solid rgba(212,175,55,.15);padding:12px 14px;display:flex;align-items:center;gap:10px}.tav{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#c0253a,#8b1a2a);display:flex;align-items:center;justify-content:center;font-size:15px}.ttl{font-size:.78rem;font-weight:700;color:#f0d060}.tst{font-size:.62rem;color:rgba(240,208,96,.5)}.tcl{margin-left:auto;background:none;border:none;cursor:pointer;color:rgba(255,255,255,.4);font-size:18px}.tm{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px}.tmsg{max-width:88%;font-size:.78rem;line-height:1.6;padding:8px 11px;border-radius:11px}.tu{align-self:flex-end;background:rgba(192,37,58,.25);color:#f5ede0;border-bottom-right-radius:3px}.ta{align-self:flex-start;background:rgba(255,255,255,.06);color:#d8d0c8;border-bottom-left-radius:3px}.ts{font-size:.58rem;color:rgba(240,208,96,.55);margin-top:3px;display:block}.tbar{border-top:1px solid rgba(255,255,255,.07);padding:9px 11px;display:flex;gap:7px;align-items:flex-end}.tin{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:8px 11px;color:#f5ede0;font-size:.77rem;resize:none;outline:none;font-family:inherit;line-height:1.5;max-height:80px;min-height:34px}.tin:focus{border-color:rgba(212,175,55,.4)}.tsb{width:34px;height:34px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#c0253a,#8b1a2a);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center}.tsb:disabled{opacity:.4}.tsb svg{width:14px;height:14px;fill:#fff}`
  return(<><style>{S}</style>{open&&(<div className="tp"><div className="th"><div className="tav">🔥</div><div><div className="ttl">TTS Support</div><div className="tst">AI · web search · remembers you</div></div><button className="tcl" onClick={()=>setOpen(false)}>×</button></div><div className="tm">{msgs.map((m,i)=>(<div key={i} className={`tmsg ${m.role==="user"?"tu":"ta"}`}>{m.content}{m.searched&&<span className="ts">🔍 searched web</span>}</div>))}{loading&&<div className="ta tmsg">...</div>}<div ref={bottom}/></div><div className="tbar"><textarea ref={inp} className="tin" placeholder="Ask anything about TTS..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} rows={1}/><button className="tsb" onClick={send} disabled={loading||!input.trim()}><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button></div></div>)}<button className="tf" onClick={()=>setOpen(o=>!o)}><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg></button></>)
}
