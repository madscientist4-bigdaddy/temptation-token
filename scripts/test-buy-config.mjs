#!/usr/bin/env node
/**
 * Config-layer tests for the Get-$TTS feature: the gate, the Transak URL, and the
 * card window. Pure functions, so no network and no wallet.
 *
 *   node scripts/test-buy-config.mjs
 */
let pass = 0, fail = 0
const ok = (c, m) => { console.log((c ? '  \x1b[32mPASS\x1b[0m  ' : '  \x1b[31mFAIL\x1b[0m  ') + m); c ? pass++ : fail++ }

// The module reads import.meta.env, which does not exist under plain node — shim it by
// loading the source and evaluating it with a stubbed env per scenario.
import { readFileSync } from 'node:fs'
const SRC = readFileSync(new URL('../src/config/buy.js', import.meta.url), 'utf8')

async function load(env) {
  const js = SRC.replace('const env = import.meta.env || {}', `const env = ${JSON.stringify(env)}`)
  const b64 = Buffer.from(js).toString('base64')
  return import(`data:text/javascript;base64,${b64}`)
}

const STAGING_KEY = '2dcc50ae-8877-4945-88d7-63f6e2d93ae6'
globalThis.window = { location: { origin: 'https://app.temptationtoken.io' } }

console.log('\n\x1b[1mGET $TTS — config layer\x1b[0m\n')

// ── the gate ────────────────────────────────────────────────────────────────
console.log('1. BUY_ENABLED gate (flag AND key)')
ok((await load({})).BUY_ENABLED === false, 'no flag, no key -> off')
ok((await load({ VITE_BUY_ENABLED: 'true' })).BUY_ENABLED === false, 'flag alone -> off (no key)')
ok((await load({ VITE_TRANSAK_API_KEY: STAGING_KEY })).BUY_ENABLED === false, 'key alone -> off (no flag)')
ok((await load({ VITE_BUY_ENABLED: 'true', VITE_TRANSAK_API_KEY: STAGING_KEY })).BUY_ENABLED === true,
   'flag + key -> ON')
ok((await load({ VITE_BUY_ENABLED: 'TRUE', VITE_TRANSAK_API_KEY: STAGING_KEY })).BUY_ENABLED === false,
   'only exact "true" arms it (no fuzzy truthiness)')

// ── environment defaults to staging ─────────────────────────────────────────
console.log('\n2. environment')
const dflt = await load({ VITE_BUY_ENABLED: 'true', VITE_TRANSAK_API_KEY: STAGING_KEY })
ok(dflt.TRANSAK_ENV === 'STAGING', 'unset VITE_TRANSAK_ENV defaults to STAGING (fail safe)')
ok(dflt.TRANSAK_HOST.includes('global-stg.transak.com'), 'staging host selected')
const prod = await load({ VITE_BUY_ENABLED: 'true', VITE_TRANSAK_API_KEY: 'k', VITE_TRANSAK_ENV: 'PRODUCTION' })
ok(prod.TRANSAK_HOST === 'https://global.transak.com', 'production host selected')
ok((await load({ VITE_BUY_ENABLED: 'true', VITE_TRANSAK_API_KEY: STAGING_KEY, PROD: true })).assertBuyConfigured() === false,
   'staging key in a PROD build refuses to render')

// ── the widget URL ──────────────────────────────────────────────────────────
console.log('\n3. Transak URL')
const W = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const url = dflt.transakUrl({ walletAddress: W, fiatAmount: 40, cryptoCurrency: 'USDC' })
const u = new URL(url)
ok(u.origin === 'https://global-stg.transak.com', 'points at staging')
ok(u.searchParams.get('apiKey') === STAGING_KEY, 'carries the staging api key')
ok(u.searchParams.get('walletAddress') === W, 'wallet pinned')
ok(u.searchParams.get('disableWalletAddressForm') === 'true', 'user cannot retype the destination address')
ok(u.searchParams.get('network') === 'base', 'network = base')
ok(u.searchParams.get('cryptoCurrencyCode') === 'USDC', 'buys USDC, not TTS')
ok(u.searchParams.get('productsAvailed') === 'BUY', 'buy-only (no off-ramp)')
ok(u.searchParams.get('fiatAmount') === '40', 'amount passed through')
ok(!/TTS/i.test(u.searchParams.get('cryptoCurrencyCode') || ''), 'never asks Transak for TTS (it is unlisted)')
let threw = false
try { (await load({})).transakUrl({ walletAddress: W }) } catch { threw = true }
ok(threw, 'transakUrl refuses to build while BUY_ENABLED is false')
threw = false
try { dflt.transakUrl({}) } catch { threw = true }
ok(threw, 'transakUrl refuses without a wallet address')

// ── the card window, which is the safety-critical bit ───────────────────────
console.log('\n4. card window vs pool depth')
let w = dflt.buyWindowUsd({ maxSpendWethUsd: 46.8 }) // today's real depth
ok(w.open === true && w.maxUsd === 46, `today ($47 cap): OPEN, $${w.minUsd}–$${w.maxUsd}`)
w = dflt.buyWindowUsd({ maxSpendWethUsd: 12 })
ok(w.open === false, 'thin pool ($12 cap): CLOSED — below Transak minimum')
ok(/aren't willing to charge you/.test(w.reason), 'closed reason explains it in plain English')
w = dflt.buyWindowUsd({ maxSpendWethUsd: 0 })
ok(w.open === false, 'zero depth: CLOSED (safe default when the read fails)')
w = dflt.buyWindowUsd({ maxSpendWethUsd: 5000 })
ok(w.open === true && w.maxUsd === 5000, 'deep pool: OPEN up to the cap')

console.log(`\n${fail ? '\x1b[31m' : '\x1b[32m'}${pass} passed, ${fail} failed\x1b[0m\n`)
process.exit(fail ? 1 : 0)
