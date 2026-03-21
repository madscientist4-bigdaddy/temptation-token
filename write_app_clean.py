import urllib.request
url = "https://temptation-token.vercel.app"
print("Writing App.jsx directly...")

app = open('src/App.jsx', 'r').read()

# Font fixes
app = app.replace("font-size: 2rem; font-weight: 300; letter-spacing: .06em; font-style: italic;", "font-size: 1.7rem; font-weight: 700; letter-spacing: .03em;")
app = app.replace("font-size: .66rem; color: var(--muted); letter-spacing: .08em; margin-top: 6px;", "font-size: .76rem; color: var(--muted); letter-spacing: .04em; margin-top: 6px; line-height: 1.65;")
app = app.replace("font-size: 1.3rem; font-style: italic; margin-bottom: 5px;", "font-size: 1.2rem; font-weight: 700; letter-spacing: .02em; margin-bottom: 6px;")
app = app.replace("font-size: .6rem; letter-spacing: .1em; cursor:pointer; transition:all .2s; white-space:nowrap;", "font-size: .65rem; letter-spacing: .08em; font-weight: 700; cursor:pointer; transition:all .2s; white-space:nowrap;")

# Rename rules tab
app = app.replace("{ k:'rules', l:'Rules' }", "{ k:'howto', l:'How to Win' }")
app = app.replace("{tab==='rules'        && <RulesScreen />}", "{tab==='howto'        && <HowToWinScreen />}")

# Add HowToWin before RulesScreen
howto = """
function HowToWinScreen() {
  const steps = [
    { icon:"🎟️", title:"Sign Up — Get 100 Free $TTS", body:"Every new user gets 100 $TTS automatically on signup. No purchase needed. Use them to vote right away." },
    { icon:"📸", title:"Browse the Photos", body:"Swipe left or right through this week's profiles. Photos are in random order so everyone gets a fair shot." },
    { icon:"🏆", title:"Pick Your Winner", body:"Find the profile you think will get the most votes by Sunday night. That is your bet." },
    { icon:"💰", title:"Vote $TTS on That Profile", body:"Minimum 5 $TTS per vote. No maximum. The more you put on the winning profile, the bigger your edge. Votes cannot be removed." },
    { icon:"👑", title:"Be the Top Voter on the Winning Profile", body:"The player who put the MOST $TTS specifically on the winning profile is the Top Voter." },
    { icon:"💸", title:"Collect Your Prize", body:"Top Voter wins 40% of the winning profile's vote pool PLUS gets every $TTS they wagered returned. Goes straight to your wallet." },
  ]
  const tips = [
    { t:"Vote Early, Vote Big", b:"Lock in a large vote early. Other players see the total — they will have to outspend you to take the top spot." },
    { t:"Watch the Leaderboard", b:"Check live standings constantly. If your profile is climbing fast, top up your vote to protect your position." },
    { t:"Stake for an Edge", b:"Stake $TTS in the Buy/Sell tab. Higher tiers multiply your vote weight 1.1x up to 2x — same TTS, more power." },
    { t:"Focus Your TTS", b:"Only the winning profile pays out. TTS you put on losing profiles is burned. Pick one and go all in." },
  ]
  return (
    <div>
      <div className="shead">
        <div style={{display:'inline-block',background:'rgba(212,175,55,.1)',border:'1px solid rgba(212,175,55,.3)',borderRadius:20,padding:'6px 16px',fontSize:'.72rem',letterSpacing:'.1em',color:'var(--gold)',textTransform:'uppercase',fontWeight:700,marginBottom:10}}>
          📖 How to Play · How to Win
        </div>
        <h2>Simple. Strategic. Real Money.</h2>
        <div className="grule"/>
        <p>Read this once. Win $TTS every week.</p>
      </div>
      <div style={{padding:'0 16px',marginBottom:24}}>
        <div style={{fontSize:'.65rem',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)',fontWeight:700,marginBottom:14,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>The 6 Steps</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {steps.map((s,i) => (
            <div key={i} style={{display:'flex',gap:14,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,alignItems:'flex-start'}}>
              <div style={{fontSize:'1.6rem',flexShrink:0,width:36,textAlign:'center'}}>{s.icon}</div>
              <div>
                <div style={{fontSize:'.84rem',fontWeight:700,color:'var(--text)',marginBottom:5,lineHeight:1.4}}>Step {i+1} — {s.title}</div>
                <div style={{fontSize:'.76rem',color:'var(--muted)',lineHeight:1.78}}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px',marginBottom:24}}>
        <div style={{fontSize:'.65rem',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)',fontWeight:700,marginBottom:14,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>Winning Tips</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {tips.map((t,i) => (
            <div key={i} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:15}}>
              <div style={{fontSize:'.82rem',fontWeight:700,color:'var(--gold-light)',marginBottom:6}}>⚡ {t.t}</div>
              <div style={{fontSize:'.76rem',color:'var(--muted)',lineHeight:1.78}}>{t.b}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px 32px'}}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
          <div style={{fontSize:'.84rem',fontWeight:700,color:'var(--text)',marginBottom:14}}>💰 Prize Breakdown — Every Week</div>
          {[
            ["🥇 Top Voter","40% of winning votes + full wager returned","var(--gold-light)"],
            ["📸 Winning Profile","40% of winning votes","var(--gold-light)"],
            ["🏢 Blockchain Ent.","10% to company wallet","var(--muted)"],
            ["💙 Polaris Project","10% to nonprofit","var(--muted)"],
            ["🔥 Losing votes","Burned — maintains token value","var(--muted)"],
          ].map(([l,v,c]) => (
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'11px 0',borderBottom:'1px solid var(--border2)',gap:12}}>
              <span style={{fontSize:'.78rem',fontWeight:600,color:'var(--text)',flexShrink:0}}>{l}</span>
              <span style={{fontSize:'.74rem',color:c,textAlign:'right',lineHeight:1.5}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
"""

app = app.replace("// ── RULES", howto + "// ── RULES")

# Welcome screen state
app = app.replace(
    "  const [tab, setTab] = useState('play')",
    "  const [tab, setTab] = useState('play')\n  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem('tt_seen'))\n  const dismissWelcome = () => { sessionStorage.setItem('tt_seen','1'); setShowWelcome(false) }"
)

# Welcome overlay in JSX
app = app.replace(
    "      {/* TOAST */}\n      <div className={`toast ${toast.type}${toast.show?' show':''}`}>{toast.msg}</div>\n    </div>\n  )\n}",
    """      {/* TOAST */}
      <div className={`toast ${toast.type}${toast.show?' show':''}`}>{toast.msg}</div>
      {showWelcome && (
        <div style={{position:'fixed',inset:0,background:'var(--void)',zIndex:800,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px'}}>
          <img src="/tts_logo.webp" alt="TTS" style={{width:88,height:88,objectFit:'contain',marginBottom:20}} draggable="false"/>
          <div style={{fontFamily:'var(--font-body)',fontSize:'1.7rem',fontWeight:800,color:'var(--text)',marginBottom:8,textAlign:'center'}}>Temptation Token</div>
          <div style={{fontSize:'.82rem',color:'var(--muted)',textAlign:'center',lineHeight:1.7,marginBottom:28,maxWidth:320}}>Vote on profiles. Pick the winner. Earn $TTS every week.</div>
          <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:12,marginBottom:28}}>
            {[["1","Browse & Pick Your Winner","Swipe through photos. Find the one you think wins."],["2","Vote $TTS on That Profile","Minimum 5 $TTS. No limit. Votes are final."],["3","Win Big on Sunday Night","Top voter on the winning profile takes 40% + wager back."]].map(([n,t,b]) => (
              <div key={n} style={{display:'flex',alignItems:'flex-start',gap:14,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
                <div style={{fontSize:'1.2rem',fontWeight:800,color:'var(--gold)',flexShrink:0,width:28}}>{n}</div>
                <div style={{fontSize:'.78rem',color:'var(--text)',lineHeight:1.6}}><strong style={{color:'var(--gold-light)',display:'block',marginBottom:3}}>{t}</strong>{b}</div>
              </div>
            ))}
          </div>
          <button onClick={dismissWelcome} style={{background:'linear-gradient(135deg,var(--crimson),#a0203a)',color:'var(--text)',border:'none',borderRadius:10,padding:'18px 40px',fontFamily:'var(--font-body)',fontSize:'.86rem',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:700,cursor:'pointer',width:'100%',maxWidth:340}}>
            Let's Go — Start Playing
          </button>
          <div onClick={dismissWelcome} style={{fontSize:'.68rem',color:'var(--muted)',marginTop:14,cursor:'pointer',textDecoration:'underline'}}>Skip intro</div>
        </div>
      )}
    </div>
  )
}"""
)

open('src/App.jsx', 'w').write(app)
print('App.jsx written OK')
