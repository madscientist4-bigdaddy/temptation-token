#!/usr/bin/env node
// Gate E — 10B TTS reward-pool depletion-runway model.
// Runway = time until cumulative claimed rewards == the funded pool.
// Annual reward outflow = Σ (staked_tier × APR_tier). With ~constant TVL this
// is linear, so runway_years = POOL / annualOutflow.

const POOL = 10_000_000_000; // 10B TTS reward budget
const SUPPLY = 69_000_000_000; // total TTS supply (context: max stakeable)

const APR = { Bronze: 0.08, Silver: 0.12, Gold: 0.18, Diamond: 0.32, VIP: 0.45 };

function outflow(mix) {
  // mix: { Bronze: tts, Silver: tts, ... }  → annual TTS paid
  return Object.entries(mix).reduce((s, [t, amt]) => s + amt * APR[t], 0);
}
function tvl(mix) { return Object.values(mix).reduce((a, b) => a + b, 0); }
function runway(mix) {
  const out = outflow(mix);
  return { tvl: tvl(mix), annualOut: out, blended: out / tvl(mix), years: POOL / out };
}

const B = 1_000_000_000, M = 1_000_000;

const scenarios = {
  'A. Conservative launch (0.5B, Bronze/Silver heavy)':
    { Bronze: 300 * M, Silver: 150 * M, Gold: 50 * M, Diamond: 0, VIP: 0 },
  'B. Moderate (2B, balanced)':
    { Bronze: 0.6 * B, Silver: 0.6 * B, Gold: 0.5 * B, Diamond: 0.25 * B, VIP: 0.05 * B },
  'C. Popular (5B, mid-tier heavy)':
    { Bronze: 1 * B, Silver: 1.5 * B, Gold: 1.5 * B, Diamond: 0.8 * B, VIP: 0.2 * B },
  'D. Heavy VIP (5B all VIP)':
    { Bronze: 0, Silver: 0, Gold: 0, Diamond: 0, VIP: 5 * B },
  'E. Whale-dominated (10B, high tiers)':
    { Bronze: 0.5 * B, Silver: 1 * B, Gold: 2 * B, Diamond: 3.5 * B, VIP: 3 * B },
  'F. Adversarial max (15B all VIP)':
    { Bronze: 0, Silver: 0, Gold: 0, Diamond: 0, VIP: 15 * B },
};

const fmt = (n) => n >= B ? (n / B).toFixed(2) + 'B' : n >= M ? (n / M).toFixed(0) + 'M' : n.toFixed(0);

console.log('═'.repeat(96));
console.log('10B TTS STAKING REWARD-POOL DEPLETION RUNWAY');
console.log('Pool =', fmt(POOL), 'TTS  |  Supply =', fmt(SUPPLY), 'TTS  |  APRs: 8/12/18/32/45% (Bronze→VIP)');
console.log('═'.repeat(96));
console.log(
  'Scenario'.padEnd(46),
  'TVL'.padStart(8), 'Blended'.padStart(9), 'Annual out'.padStart(12), 'Runway'.padStart(9)
);
console.log('─'.repeat(96));
for (const [name, mix] of Object.entries(scenarios)) {
  const r = runway(mix);
  const yrs = r.years >= 100 ? '>100 yr' : r.years.toFixed(1) + ' yr';
  console.log(
    name.padEnd(46),
    fmt(r.tvl).padStart(8),
    (r.blended * 100).toFixed(1).padStart(8) + '%',
    (fmt(r.annualOut) + '/yr').padStart(12),
    yrs.padStart(9)
  );
}
console.log('─'.repeat(96));

// Break-even: max TVL that keeps a target runway, at a given blended APR.
console.log('\nMAX TVL to hold a target runway (POOL / (blendedAPR × years)):');
for (const yrsTarget of [3, 5, 10]) {
  const row = [15, 20, 30, 45].map((aprPct) => {
    const maxTvl = POOL / (aprPct / 100 * yrsTarget);
    return `${aprPct}%→${fmt(maxTvl)}`;
  });
  console.log(`  ${yrsTarget}-yr runway:`.padEnd(16), row.join('   '));
}

console.log('\nThrottle lever (setAprBps): halving all APRs doubles every runway above.');
console.log('═'.repeat(96));
