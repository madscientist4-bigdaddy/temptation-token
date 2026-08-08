// Single mount point for everything PWA: service-worker registration, the
// "new version available" notice, and the install prompt. Rendered as a sibling of
// <App /> so it overlays the game without threading state through the monolith.
//
// Deliberately NOT rendered on /admin (see registerSW, which also refuses there).
import React, { useEffect, useState } from 'react'
import InstallPrompt from './InstallPrompt.jsx'
import { registerSW } from './register.js'

export default function PwaLayer() {
  const [activate, setActivate] = useState(null)

  useEffect(() => {
    // Store the callback itself, not the result of calling it — the functional form of
    // setState would otherwise invoke it and reload the page on the spot.
    registerSW((fn) => setActivate(() => fn))
  }, [])

  return (
    <>
      {activate && (
        <>
          <style>{UPDATE_CSS}</style>
          <div className="ttup" role="status">
            <span>A new version of Temptation Token is ready.</span>
            <button onClick={activate}>Refresh</button>
            <button className="ttup-x" onClick={() => setActivate(null)} aria-label="Dismiss">×</button>
          </div>
        </>
      )}
      <InstallPrompt />
    </>
  )
}

const UPDATE_CSS = `
.ttup {
  position: fixed; left: 12px; right: 12px; z-index: 9200;
  top: calc(12px + env(safe-area-inset-top, 0px));
  max-width: 520px; margin: 0 auto;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px;
  background: var(--surface, #12121e);
  border: 1px solid var(--border, rgba(212,175,55,0.18));
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0,0,0,.55);
  font-size: .72rem; color: var(--text, #f0e8d8);
}
.ttup span { flex: 1; line-height: 1.4; }
.ttup button {
  background: none; border: 1px solid var(--gold, #d4af37); color: var(--gold, #d4af37);
  border-radius: 5px; padding: 9px 13px; min-height: 40px; cursor: pointer;
  font-family: inherit; font-size: .68rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
}
.ttup .ttup-x { border: none; color: var(--muted, rgba(240,232,216,.5)); font-size: 1.2rem; padding: 4px 8px; min-width: 32px; }
`
