// Round-trip test for the tts-api-auth slash handling.
//
// THE BUG IT PROVES OR DISPROVES. update_post_meta() runs wp_unslash() on its value, so a
// write that does not wp_slash() first loses every backslash. For _elementor_data — a JSON
// string full of escaped quotes — that means the stored value stops being JSON and the page
// renders BLANK. It blanked a third of page 52 on 2026-08-16.
//
// WHY THIS PROBES A SCRATCH META KEY AND NOT A PAGE. Every wp/v2 core route on this host
// returns 404 rest_no_route — core REST is disabled and only tts/v1 exists — so there is no
// way to create a throwaway page to experiment on. Writing _elementor_data on a real page
// to test it is exactly the thing that broke production.
//
// So it exercises the SAME mechanism on a harmless custom meta key that nothing reads:
// round-trip a string containing backslashes and quotes through /meta/{id}. If the slash
// handling is wrong the backslashes come back stripped; if it is right they survive. The key
// is blanked afterwards. Nothing Elementor or WordPress renders is touched.
//
//   node scripts/wp-verify-elementor-roundtrip.mjs            # default probe post
//   node scripts/wp-verify-elementor-roundtrip.mjs --post 52  # any post id; still harmless
//
// Exit 0 = slashes survive a round trip. Exit 1 = this plugin build corrupts backslashes,
// and therefore will corrupt _elementor_data.
import { WPClient } from './wp/client.mjs'

const wp = new WPClient()
const argPost = process.argv.indexOf('--post')
const POST_ID = argPost > -1 ? Number(process.argv[argPost + 1]) : 52
const PROBE_KEY = '_tts_slash_probe'

// The shapes that unslashing destroys: escaped quotes (Elementor JSON) and literal
// backslashes (Windows paths, regexes).
const PROBE_VALUE = JSON.stringify({ title: 'He said "hello"', path: 'C:\\dir\\file' })

const fail = (m) => { console.error(`\nFAIL  ${m}`); process.exit(1) }

const status = await wp.plugin('/status')
if (!status.ok) fail(`/status -> ${status.status} ${JSON.stringify(status.json).slice(0, 160)}`)
const version = status.json?.version || '(unknown)'
console.log(`plugin version : ${version}`)
console.log(`probe          : post ${POST_ID}, meta key ${PROBE_KEY} (nothing reads this)`)

let exitCode = 0
try {
  const wrote = await wp.plugin(`/meta/${POST_ID}`, {
    method: 'POST',
    body: JSON.stringify({ [PROBE_KEY]: PROBE_VALUE }),
  })
  if (!wrote.ok) fail(`write -> ${wrote.status} ${JSON.stringify(wrote.json).slice(0, 160)}`)

  const back = await wp.plugin(`/meta/${POST_ID}?key=${PROBE_KEY}`)
  if (!back.ok) fail(`read-back -> ${back.status}`)
  const got = back.json?.value

  const survived = got === PROBE_VALUE
  console.log(`sent           : ${PROBE_VALUE}`)
  console.log(`got back       : ${typeof got === 'string' ? got : JSON.stringify(got)}`)
  console.log(`slashes survive: ${survived}`)

  if (!survived) {
    exitCode = 1
  } else {
    // A value that survives must also still parse — the actual property _elementor_data needs.
    try { JSON.parse(got) } catch (e) { console.error(`stored value no longer parses: ${e.message}`); exitCode = 1 }
  }
} finally {
  // Blank the probe key. /meta has no delete, and an empty custom key is inert.
  const cleaned = await wp.plugin(`/meta/${POST_ID}`, {
    method: 'POST',
    body: JSON.stringify({ [PROBE_KEY]: '' }),
  })
  console.log(`probe cleared  : ${cleaned.status}`)
}

if (exitCode === 0) console.log(`\nPASS  plugin ${version} preserves backslashes — _elementor_data writes are safe.`)
else console.error(`\nFAIL  plugin ${version} did not round-trip backslashes — it WILL corrupt _elementor_data.`
  + (version.startsWith('1.0')
      ? ' This build predates the wp_slash() fix; install wp-plugins/tts-api-auth-1.1.0.zip.'
      : ` This build already claims the fix, so do NOT just reinstall ${version}. Read the value back directly first`
        + ' — GET /meta/{id} with no ?key= and a cache-buster — because LiteSpeed serves stale REST GETs on this host'
        + ' and a cached empty read looks exactly like a stripped backslash.'))
process.exit(exitCode)
