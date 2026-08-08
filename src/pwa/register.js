// Service-worker registration + update plumbing.
//
// The worker itself lives at /public/sw.js (served from the origin root so its scope is
// the whole app). Registration is deliberately late and failure-tolerant: a browser with
// no SW support, a blocked registration, or an outright error must leave the app working
// exactly as before. Nothing here is on the critical path.

const SW_URL = '/sw.js'

/** Safe storage — iOS Safari in Private mode throws on localStorage access. */
export const safeStore = {
  get(key) {
    try { return window.localStorage.getItem(key) } catch { return null }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); return true } catch { return false }
  },
}

/** True when the app is running as an installed PWA rather than a browser tab. */
export function isStandalone() {
  try {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.navigator.standalone === true // iOS Safari's own flag
    )
  } catch {
    return false
  }
}

/**
 * Register the worker.
 * @param {(activate: () => void) => void} [onUpdateReady] called when a NEW worker has
 *        installed and is waiting; the callback receives an `activate` fn that swaps to
 *        it and reloads. We never auto-reload — that would nuke a half-typed vote amount
 *        or an in-flight wallet signature.
 */
export function registerSW(onUpdateReady) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  // Never register on the admin dashboard — it is password-gated and must not have an
  // offline shell or any cached surface at all.
  if (window.location.pathname.startsWith('/admin')) return

  // Registration is deferred to `load` so it never competes with first paint — but this
  // runs from a React effect, which on a warm/cached load fires AFTER `load` has already
  // gone. Listening unconditionally would mean the event never arrives and the worker is
  // never registered. So: run now if the page is already loaded, otherwise wait.
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })

  function start() {
    navigator.serviceWorker
      .register(SW_URL, { scope: '/' })
      .then((reg) => {
        // A worker already waiting from a previous visit.
        if (reg.waiting && navigator.serviceWorker.controller) {
          onUpdateReady?.(() => activate(reg))
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            // `controller` is null on the very first install — that is a fresh cache
            // warm-up, not an update, and must not show an "update available" prompt.
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              onUpdateReady?.(() => activate(reg))
            }
          })
        })
        // Check for a new deploy when the app is brought back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {})
        })
      })
      .catch((e) => console.warn('[pwa] service worker registration failed', e))

    // Reload when a NEW worker takes control — but only when the user asked for it.
    //
    // `clients.claim()` in the worker's activate step also fires controllerchange, on the
    // very first visit, when there was no previous controller at all. Reloading there
    // would bounce every first-time visitor for no reason and could wipe a half-filled
    // vote or submit form. So the reload is gated on `userRequestedUpdate`, set only by
    // activate() below, and fires at most once.
    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading || !userRequestedUpdate) return
      reloading = true
      window.location.reload()
    })
  }
}

// Set when the page explicitly asks a waiting worker to take over (the "Refresh" button
// on the update notice). Module-scoped so the controllerchange listener can read it.
let userRequestedUpdate = false

function activate(reg) {
  userRequestedUpdate = true
  reg.waiting?.postMessage('SKIP_WAITING')
  // If the worker is already gone from `waiting` (raced past us), reload directly so the
  // Refresh button is never a no-op.
  if (!reg.waiting) window.location.reload()
}
