#!/usr/bin/env node
// Unit test for lib/social/compliance.js — run: node scripts/test-compliance.mjs
// Exits 1 on any failure. The composer refuses to post on a `block`, so a false
// negative here is a caption that reaches X unchecked.

import { evaluate, withDisclosure } from '../lib/social/compliance.js'

const LINK = 'app.temptationtoken.io'
let pass = 0, fail = 0

// expect: 'ok' | rule id that must be among blocking | '!'+id that must NOT block
function t(name, caption, expect, opts = {}) {
  const v = evaluate(caption, opts)
  const ids = v.blocking.map(b => b.id)
  let good
  if (expect === 'ok') good = v.ok
  else if (expect.startsWith('!')) good = !ids.includes(expect.slice(1))
  else good = ids.includes(expect)
  if (good) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}\n      expected ${expect}, got blocking=[${ids.join(', ')}]`) }
}

console.log('\nEarnings claims —')
t('guaranteed returns blocked', `Vote and win, guaranteed returns! ${LINK}`, 'earnings_guarantee')
t('risk-free blocked',          `Risk-free voting on ${LINK}`, 'earnings_guarantee')
t('100x blocked',               `$TTS next 100x on Base ${LINK}`, 'earnings_projection')
t('to the moon blocked',        `$TTS to the moon 🚀 ${LINK}`, 'earnings_projection')
t('passive income blocked',     `Passive income with $TTS staking ${LINK}`, 'earnings_income')
t('make money blocked',         `Make money voting on ${LINK}`, 'earnings_income')
t('not-financial-advice wink',  `Buy the dip, not financial advice ${LINK}`, 'financial_advice')

console.log('\nSFW —')
t('nsfw blocked',   `Hottest nudes on ${LINK}`, 'nsfw_explicit')
t('sexy blocked',   `Vote for the sexy winner ${LINK}`, 'nsfw_explicit')
t('minor blocked',  `Teen contestants this week ${LINK}`, 'minor_risk')
t('objectifying is warn only', `Smash or pass? ${LINK}`, '!objectifying')

console.log('\nCanonical values —')
t('40% split blocked',   `Top voter takes 40% of the prize pool ${LINK}`, 'prize_split_40')
t('35% split ok',        `Top voter takes 35% of the prize pool. ${LINK}`, 'ok')
t('100 TTS signup blocked', `Sign up and get 100 TTS free ${LINK} #ad`, 'signup_bonus_wrong')
t('500 TTS signup ok',      `Sign up and get 500 TTS #ad ${LINK}`, 'ok')
t('all-votes pool blocked', `All votes go into the prize pool ${LINK}`, 'pool_contamination')
t('winning-votes pool ok',  `Only the winning profile's votes form the pool. ${LINK}`, 'ok')

console.log('\nDisclosure (#ad where required) —')
t('bonus without #ad blocked', `Claim your signup bonus of 500 TTS at ${LINK}`, 'missing_disclosure')
t('bonus with #ad ok',         `Claim your signup bonus of 500 TTS at ${LINK} #ad`, 'ok')
t('giveaway needs #ad',        `Giveaway this week! ${LINK}`, 'missing_disclosure')
t('#sponsored counts',         `Giveaway this week! ${LINK} #sponsored`, 'ok')
t('forceDisclosure honored',   `Round 7 is live. ${LINK}`, 'missing_disclosure', { forceDisclosure: true })
t('plain round post needs none', `Round 7 is live. Vote now at ${LINK}`, 'ok')
// Describing mechanics must NOT demand #ad — over-triggering trains admins to ignore it.
t('prize-split description needs none', `Top voter takes 35% of the prize pool. ${LINK}`, 'ok')
t('winner announcement needs none',     `Round 6 winner announced — paid on-chain. ${LINK}`, 'ok')
t('contest wording needs none',         `The weekly contest closes Sunday 11:59 PM ET. ${LINK}`, 'ok')
t('referral offer still needs #ad',     `Refer a friend and both get TTS ${LINK}`, 'missing_disclosure')
t('free TTS still needs #ad',           `Get free 500 TTS when you join ${LINK}`, 'missing_disclosure')

console.log('\nPlatform limits —')
t('X over 280 blocked', 'a'.repeat(300) + ` ${LINK}`, 'too_long', { platform: 'x_tts' })
t('X under 280 ok',     `Round 7 is live. Vote now at ${LINK}`, 'ok', { platform: 'x_tts' })
t('telegram 300 ok',    'a'.repeat(300) + ` ${LINK}`, 'ok', { platform: 'telegram' })
t('empty blocked',      '', 'empty')

console.log('\nwithDisclosure helper —')
{
  const got = withDisclosure(`Signup bonus of 500 TTS at ${LINK}`)
  const good = /#ad$/.test(got)
  good ? (pass++, console.log('  ✓ appends #ad when needed'))
       : (fail++, console.log(`  ✗ appends #ad when needed — got "${got}"`))
  const plain = `Round 7 is live. ${LINK}`
  const same = withDisclosure(plain) === plain
  same ? (pass++, console.log('  ✓ leaves non-promo copy alone'))
       : (fail++, console.log('  ✗ leaves non-promo copy alone'))
}

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail ? 1 : 0)
