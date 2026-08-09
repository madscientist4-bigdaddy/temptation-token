// WordPress REST client for temptationtoken.io
//
// Two transports, because the host matters here:
//   A) appPassword — core /wp/v2/* with Basic auth. Standard, but Hostinger's
//      edge strips the Authorization header before PHP sees it, so it 401s with
//      `rest_not_logged_in` regardless of the credentials supplied.
//   B) apiKey — the tts-api-auth plugin's /tts/v1/* routes, authenticated with
//      an X-TTS-API-Key header. The custom header survives the strip; that is
//      the entire reason the plugin exists.
//
// Always run preflight() before a write so a failure reports the real cause
// instead of "wrong password".
//
// Usage:  node scripts/wp/client.mjs --preflight

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Node 20.6+ has process.loadEnvFile; parse by hand so this works if that
// changes and so .env.local can override .env without adding a dependency.
export function loadEnv (files = ['.env', '.env.local']) {
  for (const f of files) {
    const p = resolve(ROOT, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
      if (!m) continue
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      process.env[m[1]] = v
    }
  }
}

// The caller pasted `<your admin username>` verbatim once. Treat anything still
// wearing angle brackets, or obvious filler, as absent rather than as a secret.
const PLACEHOLDER = /^\s*$|^<.*>$|^(your|the|xxx+|changeme|placeholder|todo)\b/i
export const isPlaceholder = v => v == null || PLACEHOLDER.test(String(v))

export class WPClient {
  constructor (opts = {}) {
    loadEnv()
    this.base = (opts.base || process.env.WP_BASE || 'https://temptationtoken.io').replace(/\/+$/, '')
    this.user = opts.user ?? process.env.WP_USER
    this.appPassword = opts.appPassword ?? process.env.WP_APP_PASSWORD
    this.apiKey = opts.apiKey ?? process.env.TTS_WP_API_KEY
    this.timeout = opts.timeout ?? 30_000
  }

  get hasAppPassword () { return !isPlaceholder(this.user) && !isPlaceholder(this.appPassword) }
  get hasApiKey () { return !isPlaceholder(this.apiKey) }

  async #fetch (url, { headers = {}, ...init } = {}) {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), this.timeout)
    try {
      const res = await fetch(url, { ...init, headers, signal: ac.signal })
      const text = await res.text()
      let json = null
      try { json = JSON.parse(text) } catch { /* non-JSON (HTML error page, WAF block) */ }
      return { ok: res.ok, status: res.status, json, text, headers: res.headers }
    } finally {
      clearTimeout(t)
    }
  }

  #basicHeader () {
    // App passwords are displayed with spaces; WP accepts them either way, but
    // strip to be safe against a copy-paste that mangled the spacing.
    const pw = String(this.appPassword).replace(/\s+/g, ' ').trim()
    return 'Basic ' + Buffer.from(`${this.user}:${pw}`).toString('base64')
  }

  core (path, init = {}) {
    const headers = { ...(init.headers || {}) }
    if (this.hasAppPassword) headers.Authorization = this.#basicHeader()
    // The plugin hooks `determine_current_user`, so a valid X-TTS-API-Key
    // promotes the request to administrator for *core* routes too — not just
    // /tts/v1. That makes wp/v2 the preferred write path even under the
    // plugin, since the plugin's own /elementor route runs post_content
    // through wp_kses_post, which can strip the inline style attributes this
    // page's table depends on.
    if (this.hasApiKey) headers['X-TTS-API-Key'] = this.apiKey
    return this.#fetch(`${this.base}/wp-json/wp/v2${path}`, { ...init, headers })
  }

  plugin (path, init = {}) {
    const headers = { ...(init.headers || {}) }
    if (this.hasApiKey) headers['X-TTS-API-Key'] = this.apiKey
    return this.#fetch(`${this.base}/wp-json/tts/v1${path}`, { ...init, headers })
  }

  /**
   * Determine what this host will actually let us do. Returns a report rather
   * than throwing, so callers can print a real diagnosis.
   */
  async preflight () {
    const r = {
      base: this.base,
      credentials: {
        appPassword: this.hasAppPassword ? 'set' : (isPlaceholder(this.user) ? 'WP_USER missing/placeholder' : 'WP_APP_PASSWORD missing/placeholder'),
        apiKey: this.hasApiKey ? 'set' : 'TTS_WP_API_KEY missing/placeholder',
      },
    }

    const root = await this.#fetch(`${this.base}/wp-json/?_fields=name,authentication`)
    r.coreRestReachable = root.ok
    r.siteName = root.json?.name ?? null
    // WP advertises `application-passwords` here when the feature is available.
    // An empty array means app passwords are off at the WordPress level.
    r.advertisedAuth = root.json?.authentication ?? null
    r.appPasswordsAdvertised = !!(root.json?.authentication && Object.keys(root.json.authentication).length)

    // Header-strip probe: send deliberately bogus Basic credentials. A host that
    // forwards the header yields `incorrect_password`/`invalid_username`; one
    // that strips it yields the same `rest_not_logged_in` as sending nothing.
    const bogus = 'Basic ' + Buffer.from('__probe__:aaaa bbbb cccc dddd').toString('base64')
    const withHdr = await this.#fetch(`${this.base}/wp-json/wp/v2/users/me`, { headers: { Authorization: bogus } })
    const noHdr = await this.#fetch(`${this.base}/wp-json/wp/v2/users/me`)
    const codeWith = withHdr.json?.code ?? null
    const codeNo = noHdr.json?.code ?? null
    r.probe = { withHeader: codeWith, withoutHeader: codeNo }
    r.authHeaderReachesPHP = codeWith !== codeNo || /incorrect_password|invalid_username/.test(String(codeWith))

    const plug = await this.#fetch(`${this.base}/wp-json/tts/v1/status`)
    r.pluginInstalled = !(plug.json?.code === 'rest_no_route')

    r.canWriteVia = r.pluginInstalled && this.hasApiKey ? 'apiKey'
      : r.authHeaderReachesPHP && this.hasAppPassword ? 'appPassword'
        : null

    r.blockedBecause = r.canWriteVia ? null : [
      !r.authHeaderReachesPHP && 'Authorization header is stripped before PHP (host edge) — Basic auth cannot work',
      !r.appPasswordsAdvertised && 'WordPress reports no available authentication schemes (Application Passwords unavailable)',
      !r.pluginInstalled && 'tts-api-auth plugin is not installed (no /tts/v1 routes)',
      !this.hasAppPassword && 'WP_USER / WP_APP_PASSWORD not set in .env',
      !this.hasApiKey && 'TTS_WP_API_KEY not set in .env',
    ].filter(Boolean)

    return r
  }

  /** Fetch a page. `edit` context returns content.raw, and requires auth. */
  async getPage (id, { context = 'edit' } = {}) {
    const res = await this.core(`/pages/${id}?context=${context}`)
    if (!res.ok) {
      throw new Error(`GET /pages/${id} (context=${context}) -> ${res.status} ${res.json?.code || ''} ${res.json?.message || res.text.slice(0, 200)}`)
    }
    return res.json
  }

  async updatePageContent (id, content) {
    const res = await this.core(`/pages/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    if (res.ok) return res.json

    // Fall back to the plugin route only if core is refused outright. It is
    // second choice because wp_kses_post may rewrite inline styles — the
    // caller's live verify is what catches that.
    if (this.hasApiKey && (res.status === 401 || res.status === 403)) {
      const alt = await this.plugin(`/elementor/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_content: content }),
      })
      if (alt.ok) return alt.json
      throw new Error(`core POST /pages/${id} -> ${res.status} ${res.json?.code || ''}; plugin fallback -> ${alt.status} ${alt.json?.code || ''} ${alt.json?.message || ''}`)
    }
    throw new Error(`POST /pages/${id} -> ${res.status} ${res.json?.code || ''} ${res.json?.message || res.text.slice(0, 200)}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = await new WPClient().preflight()
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.canWriteVia ? 0 : 1)
}
