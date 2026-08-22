#!/usr/bin/env node
// Automated CI check: scan all source files for stale canonical-value violations.
// Exits 1 (fail) if any match found outside the whitelist.
// Run: node scripts/check-prize-split.mjs

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const EXTENSIONS = new Set(['.py', '.js', '.jsx', '.ts', '.tsx'])

// Files where violations are expected / not live code
const WHITELIST_FILES = new Set([
  'CLAUDE.md',
  'check-prize-split.mjs',
  'deploy_bot.py',   // old scaffolding scripts — not live code
  'write_app.py',
  'write_bot.py',
  'fix_chatbot.py',
])

// Lines that explicitly describe what is forbidden (not an actual violation)
const EXEMPT_PHRASES = ['FORBIDDEN', 'previously used', 'wrong and has been removed', 'never use', 'NEVER write',
  'Banned phrasings', 'is DEAD', 'Automation is dead', 'no longer triggers', 'stopped performing',
  // Accurately DESCRIBING the dead product is the opposite of claiming it works.
  'performed NO upkeep', 'performed no upkeep', 'Automation replacement', 'OUTAGE',
  'AutomationReceiver', 'Keeper / Automation', 'DEAD SINCE', 'replaced by autopilot',
  'Automation upkeep', 'is NOT a fallback', 'dark registry-wide', 'OUTAGE since']

// Rule definitions: { name, test(line) => bool }
const RULES = [
  {
    name: '40% prize split',
    test: line => /\b40\s*%/.test(line) && /voter|winner|prize|pool|split|pot/i.test(line),
    note: 'Canonical: 35/35/10/20 (no club) or 35/35/10/10/10 (with club)',
  },
  {
    name: '100 TTS signup bonus',
    // Match "100 TTS" near signup/welcome/new-user context — but NOT referral bonus lines
    test: line => /\b100\s*\$?TTS\b/i.test(line) &&
                  /sign.?up|new.?user|welcome|registration/i.test(line) &&
                  !/referral/i.test(line),
    note: 'Canonical signup bonus is 500 TTS',
  },
  {
    name: 'Chainlink triggers settlement (Automation is DEAD since 2026-08-05)',
    // Chainlink runs two products for us and only VRF survives. VRF still picks the winner
    // on-chain — that is TRUE and must stay sayable. Chainlink AUTOMATION, which used to
    // trigger settleRound(), stopped performing for every upkeep on its Base registry on
    // 2026-08-05; our own keeper autopilot triggers settlement now. So flag any line that
    // makes Chainlink the thing that FIRES/SETTLES/SCHEDULES, and leave "VRF picks the
    // winner" alone. An automated poster claiming "Chainlink fires settlement within
    // minutes" was live on @temptationtoken while settlement was actually being done by
    // hand ~17.7h late.
    // Targets the false CLAIM SHAPES specifically. A broad "chainlink near settlement"
    // heuristic also condemns true sentences like "the winner is being selected on-chain
    // via Chainlink VRF", and a guard that cries wolf on correct copy gets switched off.
    test: line => [
      /chainlink[^.]{0,40}\b(fires?|triggers?|schedules?|kicks off)\b[^.]{0,20}settl/i,
      /settl[^.]{0,40}\b(fires?|triggered|happens|runs)\b[^.]{0,30}via chainlink/i,
      /settlement[^.]{0,25}automatic[^.]{0,25}via chainlink/i,
      /chainlink\s+vrf\s+settl/i,
      /chainlink[^.]{0,20}\bsettles\b/i,
      /chainlink\s+(automation|crons?|keeper)/i,
      /\bsettlement:\s*chainlink/i,
    ].some(re => re.test(line)),
    note: 'Chainlink Automation is dead. Settlement is triggered by our keeper autopilot; attribute only WINNER SELECTION to Chainlink VRF.',
  },
  {
    name: '"all votes" prize pool contamination (Mechanic B)',
    // Flag if "all votes" or "total votes" appears near "prize pool" without "winning"
    test: line => /\ball\s+votes?\b|\btotal\s+votes?\b/i.test(line) &&
                  /prize\s+pool|payout|settlement/i.test(line) &&
                  !/winning/i.test(line),
    note: 'Prize pool = winning-profile votes only. Losing votes burn. Never imply all votes form the pool.',
  },
]

// Pods/ and .venv/ hold vendored dependency source, never our copy. Pods in particular
// accumulates iCloud-duplicated entries ("Foo 2.h") that are frequently BROKEN symlinks —
// statSync on one throws ENOENT and killed this entire check, so the guard was exiting
// with a stack trace instead of a verdict. A canonical-value guard that crashes reads,
// at a glance, a lot like one that passed.
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'out', '.vercel', 'build',
  'coverage', '.next', 'Pods', '.venv', '__pycache__'])

function walk(dir, files = []) {
  let entries
  try { entries = readdirSync(dir) } catch { return files }  // unreadable dir: skip, don't die
  for (const entry of entries) {
    // Generated output is skipped, never scanned. `.vercel/output` is written by
    // `vercel build` — which the pre-deploy guard itself runs — and contains MINIFIED
    // bundles where minification collapses unrelated tokens next to each other. That
    // produced a "40% prize split" FAIL against a stale artifact while every source
    // file was clean, blocking commits on this tool's own leftovers.
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }   // broken symlink / vanished file
    if (st.isDirectory()) { walk(full, files); continue }
    if (EXTENSIONS.has(extname(entry))) files.push(full)
  }
  return files
}

let failures = 0
for (const file of walk(ROOT)) {
  const rel = file.replace(ROOT, '')
  if ([...WHITELIST_FILES].some(w => rel.endsWith(w))) continue
  const lines = readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (EXEMPT_PHRASES.some(p => line.includes(p))) continue
    for (const rule of RULES) {
      if (rule.test(line)) {
        console.error(`FAIL [${rule.name}]  ${rel}:${i + 1}  →  ${line.trim()}`)
        console.error(`     Fix: ${rule.note}`)
        failures++
      }
    }
  }
}

if (failures === 0) {
  console.log('PASS  No canonical-value violations found.')
  process.exit(0)
} else {
  console.error(`\n${failures} violation(s) found.`)
  process.exit(1)
}
