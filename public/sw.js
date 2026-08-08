/* Temptation Token — service worker.
 *
 * DESIGN RULE, non-negotiable: this worker must never sit between the user and money.
 * A stale balance, a replayed vote, a cached KYC status or a cached admin payload is far
 * worse than a slow load. So the ONLY things that ever touch a cache are same-origin,
 * GET, static, public assets. Everything else is passed straight through to the network
 * untouched — the SW does not even call respondWith(), so the browser handles it exactly
 * as if no worker were installed.
 *
 * NEVER CACHED (hard deny, checked first):
 *   • /api/*            — all 12 serverless functions: votes, bonuses, KYC, profiles,
 *                         referrals, admin. Includes /api/rpc (the Base RPC proxy).
 *   • /admin*           — the password-gated dashboard shell and its data.
 *   • any cross-origin request — WalletConnect/Reown relays, RPC nodes, wallet deep
 *                         links, Supabase storage, analytics. Wallet traffic is all
 *                         cross-origin, so this one rule covers every wallet call.
 *   • any non-GET       — POST/PUT/DELETE are writes by definition.
 *   • requests with a Range header (media seeking) or ?no-sw.
 *
 * CACHED:
 *   • /assets/<hash>.js|css — content-hashed by Vite, immutable ⇒ cache-first forever.
 *   • icons/splash/images   — stale-while-revalidate.
 *   • navigations           — network-first with a cached-shell fallback, so a user who
 *                             opens the installed app offline still gets the UI (which
 *                             then shows its own offline states) instead of a Chrome
 *                             dinosaur. Fresh HTML always wins when the network is up,
 *                             which is what keeps hashed-asset references current.
 *
 * Because navigations are network-first and assets are content-hashed, a deploy can
 * never leave a user pinned to old code: the next online navigation fetches new HTML
 * that points at new hashes. CACHE_VERSION is only a manual nuke switch.
 */

const CACHE_VERSION = 'v1'
const SHELL_CACHE = `tts-shell-${CACHE_VERSION}`
const ASSET_CACHE = `tts-assets-${CACHE_VERSION}`
const IMAGE_CACHE = `tts-images-${CACHE_VERSION}`
const CURRENT = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE])

const OFFLINE_URL = '/index.html'
const IMAGE_CACHE_MAX = 60

// ── Hard deny list ──────────────────────────────────────────────────────────
// Anything matching is passed through to the network with no SW involvement.
function isNeverCacheable(request, url) {
  if (request.method !== 'GET') return true
  if (url.origin !== self.location.origin) return true
  if (url.pathname.startsWith('/api/')) return true
  if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) return true
  if (url.searchParams.has('no-sw')) return true
  if (request.headers.has('range')) return true
  return false
}

const isHashedAsset = (url) =>
  url.pathname.startsWith('/assets/') && /\.[a-f0-9]{8,}\.(js|css|woff2?)$/i.test(url.pathname)

const isImage = (request, url) =>
  request.destination === 'image' || /\.(png|jpe?g|webp|svg|gif|ico|avif)$/i.test(url.pathname)

// ── Install: warm the shell so the first offline open works ─────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .catch(() => {}) // a failed warm-up must never block installation
  )
})

// ── Activate: drop caches from older versions, take over open tabs ──────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('tts-') && !CURRENT.has(k)).map((k) => caches.delete(k)))
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {})
      }
      await self.clients.claim()
    })()
  )
})

// The page asks us to activate a waiting update (see src/pwa/register.js).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

/** Keep an image cache from growing without bound (oldest-first eviction). */
async function trim(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  if (keys.length <= max) return
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Not ours to touch — let the browser do exactly what it would without a SW.
  if (isNeverCacheable(request, url)) return

  // 1. Navigations — network-first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse
          if (preloaded) return preloaded
          return await fetch(request)
        } catch {
          const cached = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE })
          return (
            cached ||
            new Response('<h1>Offline</h1><p>Reconnect to load Temptation Token.</p>', {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            })
          )
        }
      })()
    )
    return
  }

  // 2. Content-hashed build assets — immutable, so cache-first is always correct.
  if (isHashedAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request, { cacheName: ASSET_CACHE })
        if (cached) return cached
        const res = await fetch(request)
        if (res.ok) (await caches.open(ASSET_CACHE)).put(request, res.clone())
        return res
      })()
    )
    return
  }

  // 3. Images — stale-while-revalidate: instant paint, refreshed in the background.
  if (isImage(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(IMAGE_CACHE)
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone()).then(() => trim(IMAGE_CACHE, IMAGE_CACHE_MAX))
            return res
          })
          .catch(() => cached)
        return cached || network
      })()
    )
    return
  }

  // 4. Everything else same-origin and static (manifest, robots, /pwa/*) —
  //    network-first so it stays fresh, with a cache fallback for offline.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request)
        if (res.ok) (await caches.open(SHELL_CACHE)).put(request, res.clone())
        return res
      } catch {
        const cached = await caches.match(request)
        if (cached) return cached
        throw new Error('offline and uncached')
      }
    })()
  )
})
