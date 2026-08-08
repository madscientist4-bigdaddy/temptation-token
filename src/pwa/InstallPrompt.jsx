// "Add to Home Screen" surface — two very different platforms behind one component.
//
// Android/Chromium fires `beforeinstallprompt`, which we stash and replay on a tap; the
// browser then shows its own native install dialog. iOS Safari has no such event and no
// programmatic install at all — the only route is Share ▸ Add to Home Screen — so there
// we show the steps instead of a button that cannot work.
//
// Restraint matters more than reach here: this is a money app, and a nagging banner over
// a vote form is worse than a missed install. So the bar (a) never appears when already
// installed, (b) waits until the user has actually been in the app a moment, (c) is
// dismissible, and (d) stays gone for 30 days after a dismissal.
import React, { useEffect, useState } from 'react'
import { isStandalone, safeStore } from './register.js'

const DISMISS_KEY = 'tts_install_dismissed_at'
const DISMISS_DAYS = 30
const SHOW_AFTER_MS = 12000 // let someone look at the game before asking anything

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS 13+ reports as a Mac; the touch-point count gives it away.
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// Only Safari can add to the home screen on iOS. Chrome/Firefox/Edge on iOS are Safari
// under the hood but expose no Add-to-Home-Screen item, so telling their users to look
// for one sends them hunting for a menu entry that isn't there.
const isIOSSafari = () =>
  isIOS() && !/crios|fxios|edgios|opios|brave/i.test(navigator.userAgent)

function recentlyDismissed() {
  const raw = safeStore.get(DISMISS_KEY)
  if (!raw) return false
  const at = Number(raw)
  if (!Number.isFinite(at)) return false
  return Date.now() - at < DISMISS_DAYS * 864e5
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null) // Android BeforeInstallPromptEvent
  const [mode, setMode] = useState(null) // 'android' | 'ios' | null
  const [iosSheet, setIosSheet] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    const onBIP = (e) => {
      // Suppress Chrome's own mini-infobar so we control the timing and the styling.
      e.preventDefault()
      setDeferred(e)
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    // Chrome fires this if the user installs by any route — drop the bar immediately.
    const onInstalled = () => { setMode(null); setDeferred(null) }
    window.addEventListener('appinstalled', onInstalled)

    // iOS gets no event, so surface the hint on a timer instead.
    let t
    if (isIOSSafari()) t = setTimeout(() => setMode((m) => m || 'ios'), SHOW_AFTER_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
      clearTimeout(t)
    }
  }, [])

  // Body class drives the FAB-hiding rule in CSS below, and is always cleaned up on
  // unmount so the chatbot can never be left permanently hidden.
  useEffect(() => {
    document.body.classList.toggle('ttip-modal', iosSheet)
    return () => document.body.classList.remove('ttip-modal')
  }, [iosSheet])

  const dismiss = () => {
    safeStore.set(DISMISS_KEY, String(Date.now()))
    setMode(null)
    setIosSheet(false)
  }

  const install = async () => {
    if (!deferred) return
    try {
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      // A dismissal here is a real "no" — respect it for the full cooldown.
      if (outcome !== 'accepted') safeStore.set(DISMISS_KEY, String(Date.now()))
    } catch {
      /* the event can only be used once; if it is spent, just hide the bar */
    }
    setDeferred(null)
    setMode(null)
  }

  if (!mode) return null

  return (
    <>
      <style>{CSS}</style>

      <div className="ttip" role="region" aria-label="Install Temptation Token">
        <img className="ttip-icon" src="/pwa/icon-192.png" alt="" width="42" height="42" />
        <div className="ttip-copy">
          <strong>Install Temptation Token</strong>
          <span>Full-screen play, no browser bar, one tap from your home screen.</span>
        </div>
        {mode === 'android' ? (
          <button className="ttip-cta" onClick={install}>Install</button>
        ) : (
          <button className="ttip-cta" onClick={() => setIosSheet(true)}>How</button>
        )}
        <button className="ttip-x" onClick={dismiss} aria-label="Dismiss install prompt">×</button>
      </div>

      {iosSheet && (
        <div className="ttip-back" onClick={() => setIosSheet(false)}>
          <div className="ttip-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="ttip-handle" />
            <h3>Add to Home Screen</h3>
            <p className="ttip-lead">
              iOS installs apps from the Safari share menu — it takes two taps.
            </p>
            {/* The step text is wrapped in a single <span>: the <li> is a flex row, and
                flex treats every bare text node and <strong> as its OWN item — which
                shreds the sentence into separately-wrapping fragments. */}
            <ol className="ttip-steps">
              <li>
                <span className="ttip-n">1</span>
                <span className="ttip-t">Tap the <strong>Share</strong> icon in Safari&apos;s bottom bar — the square with an arrow pointing up.</span>
              </li>
              <li>
                <span className="ttip-n">2</span>
                <span className="ttip-t">Scroll down and choose <strong>Add to Home Screen</strong>.</span>
              </li>
              <li>
                <span className="ttip-n">3</span>
                <span className="ttip-t">Tap <strong>Add</strong>. Temptation Token now opens full-screen, like a native app.</span>
              </li>
            </ol>
            <button className="ttip-done" onClick={() => setIosSheet(false)}>Got it</button>
            <button className="ttip-never" onClick={dismiss}>Don&apos;t show this again</button>
          </div>
        </div>
      )}
    </>
  )
}

const CSS = `
.ttip {
  position: fixed; left: 12px; right: 12px; z-index: 9000;
  /* Sits ABOVE the support chatbot FAB (.tts-fab: bottom 24px, 48px tall, z-index
     99999). Overlapping it would put the FAB on top of this bar's Install button and
     swallow the tap — the FAB out-ranks us on z-index and should keep doing so, since
     support has to stay reachable. 24 + 48 + 12 gutter = 84px, plus the home indicator. */
  bottom: calc(84px + env(safe-area-inset-bottom, 0px));
  max-width: 520px; margin: 0 auto;
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #12121e, #0c0c14);
  border: 1px solid var(--border, rgba(212,175,55,0.18));
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.6);
  animation: ttip-in .32s cubic-bezier(.2,.9,.3,1);
}
@keyframes ttip-in { from { transform: translateY(120%); opacity: 0 } to { transform: none; opacity: 1 } }
.ttip-icon { border-radius: 9px; flex-shrink: 0; width: 42px; height: 42px; }
.ttip-copy { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.ttip-copy strong { font-size: .78rem; color: var(--text, #f0e8d8); font-weight: 700; letter-spacing: .02em; }
.ttip-copy span { font-size: .66rem; color: var(--muted, rgba(240,232,216,.5)); line-height: 1.4; }
.ttip-cta {
  flex-shrink: 0; background: var(--crimson-glow, #c0253a); color: var(--text, #f0e8d8);
  border: none; border-radius: 6px; padding: 11px 16px; min-height: 44px;
  font-family: inherit; font-size: .72rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; cursor: pointer;
}
.ttip-x {
  flex-shrink: 0; background: none; border: none; color: var(--muted, rgba(240,232,216,.5));
  font-size: 1.4rem; line-height: 1; cursor: pointer; padding: 4px 6px; min-height: 44px; min-width: 32px;
}
.ttip-back {
  position: fixed; inset: 0; z-index: 9100; background: rgba(0,0,0,.72);
  display: flex; align-items: flex-end; justify-content: center;
}
.ttip-sheet {
  width: 100%; max-width: 520px; background: var(--surface, #12121e);
  border: 1px solid var(--border, rgba(212,175,55,0.18)); border-bottom: none;
  border-radius: 18px 18px 0 0; padding: 10px 22px calc(26px + env(safe-area-inset-bottom, 0px));
  animation: ttip-up .3s cubic-bezier(.2,.9,.3,1);
}
@keyframes ttip-up { from { transform: translateY(100%) } to { transform: none } }
.ttip-handle { width: 40px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.18); margin: 0 auto 16px; }
.ttip-sheet h3 {
  font-family: var(--font-d, 'Cormorant Garamond', serif); font-style: italic; font-weight: 400;
  font-size: 1.6rem; color: var(--text, #f0e8d8); text-align: center; margin-bottom: 6px;
}
.ttip-lead { font-size: .72rem; color: var(--muted, rgba(240,232,216,.5)); text-align: center; margin-bottom: 18px; }
.ttip-steps { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.ttip-steps li { display: flex; gap: 11px; align-items: flex-start; }
.ttip-t { flex: 1; font-size: .74rem; line-height: 1.55; color: var(--text, #f0e8d8); }
.ttip-steps strong { color: var(--gold-light, #f0d060); font-weight: 700; }
.ttip-n {
  flex-shrink: 0; width: 21px; height: 21px; border-radius: 50%;
  border: 1px solid var(--border, rgba(212,175,55,0.18)); color: var(--gold, #d4af37);
  font-size: .62rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
}
.ttip-done {
  width: 100%; background: var(--crimson-glow, #c0253a); color: var(--text, #f0e8d8);
  border: none; border-radius: 6px; padding: 15px; min-height: 48px;
  font-family: inherit; font-size: .76rem; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; cursor: pointer;
}
.ttip-never {
  width: 100%; background: none; border: none; color: var(--muted, rgba(240,232,216,.5));
  font-family: inherit; font-size: .68rem; padding: 14px; min-height: 44px; cursor: pointer;
}
/* The support chatbot FAB is pinned bottom-right at z-index 99999 and would sit on top
   of this sheet's dismiss link. Hide it for as long as the sheet is up — support is one
   tap away again the moment the sheet closes. */
body.ttip-modal .tts-fab { display: none !important; }
`
