#!/usr/bin/env node
// Automated CI check: scan all source files for legacy "40%" prize-split references.
// Exits 1 (fail) if any match found outside the whitelist.
// Run: node scripts/check-prize-split.mjs

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = new URL('..', import.meta.url).pathname
const EXTENSIONS = new Set(['.py', '.js', '.jsx', '.ts', '.tsx'])
const PRIZE_WORDS = /voter|winner|prize|pool|split|pot/i
const FORTY_PCT   = /\b40\s*%/

// Files where "40%" is expected to appear in non-prize context (e.g. vote cap, old scaffolding)
const WHITELIST_FILES = new Set([
  'CLAUDE.md',
  'check-prize-split.mjs',
  'deploy_bot.py',   // old scaffolding scripts — not live code
  'write_app.py',
  'write_bot.py',
  'fix_chatbot.py',
])

// Lines that explicitly describe what is forbidden (not an actual violation)
const EXEMPT_PHRASES = ['FORBIDDEN', 'previously used', 'wrong and has been removed']

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue
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
    if (FORTY_PCT.test(line) && PRIZE_WORDS.test(line) && !EXEMPT_PHRASES.some(p => line.includes(p))) {
      console.error(`FAIL  ${rel}:${i + 1}  →  ${line.trim()}`)
      failures++
    }
  }
}

if (failures === 0) {
  console.log('PASS  No legacy 40% prize-split references found.')
  process.exit(0)
} else {
  console.error(`\n${failures} violation(s) found. Canonical split: 35/35/10/20 (no club) or 35/35/10/10/10 (with club).`)
  process.exit(1)
}
