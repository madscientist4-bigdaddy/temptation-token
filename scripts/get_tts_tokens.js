#!/usr/bin/env node
/**
 * OAuth 1.0a PIN flow — generates fresh TTS_X_ACCESS_TOKEN + TTS_X_ACCESS_SECRET
 * for @temptationtoken and updates Vercel production env automatically.
 *
 * Usage: node scripts/get_tts_tokens.js
 * Requires: .env.local with X_API_KEY and X_API_SECRET (run: vercel env pull --environment production)
 */

import crypto from 'crypto';
import readline from 'readline';
import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dir, '..');

// ── Load env from .env.local ────────────────────────────────────────────────
function loadDotEnv() {
  const p = resolve(ROOT, '.env.local');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  }
}
loadDotEnv();

const API_KEY    = process.env.X_API_KEY;
const API_SECRET = process.env.X_API_SECRET;

if (!API_KEY || !API_SECRET) {
  console.error('\n❌  X_API_KEY or X_API_SECRET missing from .env.local');
  console.error('    Run: vercel env pull .env.local --environment production\n');
  process.exit(1);
}

// ── OAuth 1.0a helpers ───────────────────────────────────────────────────────
function pct(s) { return encodeURIComponent(String(s)); }

function sign(method, url, params, consumerSecret, tokenSecret = '') {
  const base = Object.keys(params).sort()
    .map(k => `${pct(k)}=${pct(params[k])}`).join('&');
  const sigBase = `${method.toUpperCase()}&${pct(url)}&${pct(base)}`;
  const key = `${pct(consumerSecret)}&${pct(tokenSecret)}`;
  return crypto.createHmac('sha1', key).update(sigBase).digest('base64');
}

function authHeader(method, url, extra = {}, tokenSecret = '', token = '') {
  const p = {
    oauth_consumer_key:     API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_version:          '1.0',
    ...extra,
  };
  if (token) p.oauth_token = token;
  p.oauth_signature = sign(method, url, p, API_SECRET, tokenSecret);
  return 'OAuth ' + Object.keys(p).sort()
    .map(k => `${pct(k)}="${pct(p[k])}"`)
    .join(', ');
}

// ── Twitter API calls ────────────────────────────────────────────────────────
async function getRequestToken() {
  const url = 'https://api.twitter.com/oauth/request_token';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url, { oauth_callback: 'oob' }) },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body}`);
  return Object.fromEntries(new URLSearchParams(body));
}

async function exchangePin(reqToken, pin) {
  const url = 'https://api.twitter.com/oauth/access_token';
  const p = {
    oauth_consumer_key:     API_KEY,
    oauth_nonce:            crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp:        String(Math.floor(Date.now() / 1000)),
    oauth_token:            reqToken,
    oauth_verifier:         pin,
    oauth_version:          '1.0',
  };
  p.oauth_signature = sign('POST', url, p, API_SECRET, '');
  const header = 'OAuth ' + Object.keys(p).sort()
    .map(k => `${pct(k)}="${pct(p[k])}"`)
    .join(', ');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: header, 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body}`);
  return Object.fromEntries(new URLSearchParams(body));
}

async function verifyCredentials(token, secret) {
  const url = 'https://api.twitter.com/2/users/me';
  const res = await fetch(url, {
    headers: { Authorization: authHeader('GET', url, {}, secret, token) },
  });
  return { status: res.status, body: await res.json() };
}

async function postTweet(token, secret, text) {
  const url = 'https://api.twitter.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader('POST', url, {}, secret, token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  return { status: res.status, body: await res.json() };
}

// ── Vercel env update ────────────────────────────────────────────────────────
function vercelSet(key, value) {
  // Remove existing, then add
  spawnSync('vercel', ['env', 'rm', key, 'production', '--yes'], {
    stdio: 'pipe', cwd: ROOT,
  });
  const r = spawnSync('vercel', ['env', 'add', key, 'production'], {
    input: value + '\n',
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: ROOT,
  });
  if (r.status !== 0) throw new Error(r.stderr || 'vercel env add failed');
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   @temptationtoken — OAuth PIN Token Flow     ║');
  console.log('╚═══════════════════════════════════════════════╝\n');
  console.log(`  API Key: ${API_KEY.slice(0, 8)}...${API_KEY.slice(-4)}\n`);

  // Step 1 — request token
  process.stdout.write('Step 1/6  Getting request token from X... ');
  let reqToken;
  try {
    const rt = await getRequestToken();
    reqToken = rt.oauth_token;
    console.log(`✅  ${reqToken.slice(0, 12)}...`);
  } catch (e) {
    console.log('❌  FAILED');
    console.error(`\n  Error: ${e.message}`);
    console.error('\n  ► X_API_KEY/X_API_SECRET are invalid.');
    console.error('  ► Go to developer.twitter.com → your app → Keys & tokens');
    console.error('  ► Regenerate API Key & Secret, update X_API_KEY + X_API_SECRET in Vercel\n');
    process.exit(1);
  }

  // Step 2 — authorization URL
  const authUrl = `https://twitter.com/oauth/authorize?oauth_token=${reqToken}`;
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  Step 2/6  Open this URL in your browser      ║');
  console.log('║  (make sure you are logged in as              ║');
  console.log('║   @temptationtoken before clicking)           ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`\n  ${authUrl}\n`);
  console.log('  Approve the app, then copy the 7-digit PIN.\n');

  // Step 3 — PIN input
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const pin = await new Promise(resolve => {
    rl.question('Step 3/6  Paste PIN here → ', ans => { rl.close(); resolve(ans.trim()); });
  });

  if (!/^\d{7}$/.test(pin)) {
    console.error(`\n❌  Invalid PIN "${pin}" — X PINs are exactly 7 digits.\n`);
    process.exit(1);
  }

  // Step 4 — exchange for access token
  process.stdout.write('\nStep 4/6  Exchanging PIN for access token... ');
  let tokens;
  try {
    tokens = await exchangePin(reqToken, pin);
    console.log(`✅  @${tokens.screen_name} (uid ${tokens.user_id})`);
  } catch (e) {
    console.log('❌  FAILED');
    console.error(`  Error: ${e.message}\n`);
    process.exit(1);
  }

  const newToken  = tokens.oauth_token;
  const newSecret = tokens.oauth_token_secret;

  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  New tokens (saved to Vercel in next step)    ║');
  console.log('╠═══════════════════════════════════════════════╣');
  console.log(`║  TTS_X_ACCESS_TOKEN:  ${newToken.slice(0, 30)}...`);
  console.log(`║  TTS_X_ACCESS_SECRET: ${newSecret.slice(0, 30)}...`);
  console.log('╚═══════════════════════════════════════════════╝\n');

  // Step 5 — update Vercel
  process.stdout.write('Step 5/6  Updating Vercel production env... ');
  try {
    vercelSet('TTS_X_ACCESS_TOKEN',  newToken);
    vercelSet('TTS_X_ACCESS_SECRET', newSecret);
    console.log('✅');
  } catch (e) {
    console.log('⚠️   Vercel update failed — set manually:');
    console.log(`  TTS_X_ACCESS_TOKEN  = ${newToken}`);
    console.log(`  TTS_X_ACCESS_SECRET = ${newSecret}`);
    console.error(`  (${e.message})`);
  }

  // Step 6 — verify credentials
  process.stdout.write('\nStep 6/6  Verifying credentials via /2/users/me... ');
  const verify = await verifyCredentials(newToken, newSecret);
  if (verify.status === 200) {
    console.log(`✅  Confirmed: @${verify.body.data?.username}`);
  } else {
    console.log(`⚠️   ${verify.status}: ${JSON.stringify(verify.body)}`);
  }

  // Optional test post prompt
  const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
  const doPost = await new Promise(resolve => {
    rl2.question('\nSend a test tweet as @temptationtoken? (y/N) → ', ans => {
      rl2.close(); resolve(ans.trim().toLowerCase() === 'y');
    });
  });

  if (doPost) {
    process.stdout.write('Posting... ');
    const result = await postTweet(
      newToken, newSecret,
      `🎰 $TTS is live on Base — vote-to-earn with real crypto prizes. Round 1 ending soon. temptationtoken.io #TTS #Base #Web3`
    );
    if (result.status === 201) {
      console.log(`✅  Posted! Tweet ID: ${result.body.data?.id}`);
    } else {
      console.log(`⚠️   ${result.status}: ${JSON.stringify(result.body)}`);
    }
  }

  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║  COMPLETE — @temptationtoken tokens updated   ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log('\n  Next: redeploy Vercel so the new tokens take effect:');
  console.log('  npm run build && npx vercel --prod\n');
}

main().catch(e => { console.error('\n❌ Unhandled error:', e); process.exit(1); });
