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
const EXEMPT_PHRASES = ['FORBIDDEN', 'previously used', 'wrong and has been removed', 'never use', 'NEVER write']

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
    name: '"all votes" prize pool contamination (Mechanic B)',
    // Flag if "all votes" or "total votes" appears near "prize pool" without "winning"
    test: line => /\ball\s+votes?\b|\btotal\s+votes?\b/i.test(line) &&
                  /prize\s+pool|payout|settlement/i.test(line) &&
                  !/winning/i.test(line),
    note: 'Prize pool = winning-profile votes only. Losing votes burn. Never imply all votes form the pool.',
  },
]

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist' || entry === 'out') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) { walk(full, files); continue }
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
