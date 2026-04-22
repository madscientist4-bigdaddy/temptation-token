
// ── CONTRACT ADDRESSES (Base Mainnet) ────────────────────────────────────────
const TTS_ADDRESS     = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const VOTING_ADDRESS  = '0x49385909a23C97142c600f8d28D11Ba63410b65C'
const STAKING_ADDRESS = '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc'
const AIRDROP_ADDRESS = '0x214f482ae7DC1C48A4761759Dc70B6545ff36f0f'
const NFT_ADDRESS     = '0x8b1EFa595a9c6b670078701069EADC5ae857091f'
const BASE_CHAIN_ID   = 8453

const TTS_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]
const HOUSE_WALLET = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const SUBMISSION_FEE = 5n * 10n ** 18n
const VOTING_ABI = [
  'function vote(string profileId, uint256 amount) returns ()',
  'function getProfile(uint256 roundId, string profileId) view returns (address wallet, uint256 totalTickets, uint256 rawVotes, address topVoter, bool approved)',
  'function getRound(uint256 roundId) view returns (uint256 startTime, uint256 endTime, uint256 totalTickets, uint256 totalRawVotes, bool settled, bool vrfPending, uint256 profileCount)',
  'function currentRoundId() view returns (uint256)',
]
const AIRDROP_ABI = [
  'function claim() returns ()',
  'function claimWithReferral(address referrer) returns ()',
  'function hasClaimed(address) view returns (bool)',
]

const _baseClient = createPublicClient({
  chain: { id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } } },
  transport: http('https://mainnet.base.org')
})

async function readContract(address, abi, fn, args = []) {
  try {
    return await _baseClient.readContract({ address, abi: parseAbi(abi), functionName: fn, args })
  } catch(e) { console.error('readContract:', e); return null }
}

async function writeContract(walletClient, address, abi, fn, args = []) {
  return await walletClient.writeContract({ address, abi: parseAbi(abi), functionName: fn, args })
}

async function waitForReceipt(hash) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch('https://mainnet.base.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionReceipt', params: [hash] })
    })
    const { result } = await res.json()
    if (result) {
      if (result.status === '0x0') throw new Error('Transaction reverted on-chain')
      return result
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  throw new Error('Receipt timeout after 120s')
}

import { useState, useEffect, useCallback, useRef } from 'react'
import TTSChatbot from './TTSChatbot.jsx'
import { useAccount, useDisconnect, useWalletClient } from 'wagmi'
import { useAppKit } from '@reown/appkit/react'
import { createPublicClient, http, parseAbi } from 'viem'

// ── CONSTANTS ──────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k'

// Hardcoded fallback — renders at frame 1 before Supabase loads, swapped immediately on fetch
const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='534'%3E%3Crect width='400' height='534' fill='%231a1a2e'/%3E%3Ctext x='200' y='290' font-family='sans-serif' font-size='48' fill='%23d4af3740' text-anchor='middle'%3E%E2%8F%B3%3C/text%3E%3C/svg%3E"
const FALLBACK_PHOTOS = [
  { id:1, username:'Dance TTS', profileId:'fafaae5c-8e42-4674-b120-5501880d1b8b', link:'Get TTS', link_url:'https://temptationtoken.io', votes:0, myVotes:0, img:PLACEHOLDER_IMG, wallet:'0xB1E991bF617459B58964eEf7756B350e675C53b5', payout_wallet:'0xB1E991bF617459B58964eEf7756B350e675C53b5' },
  { id:2, username:'Bunny Butt', profileId:'4df8fee6-3da3-49d2-8cc3-200e7c767ba3', link:'Play TTS', link_url:'https://app.temptationtoken.io', votes:0, myVotes:0, img:PLACEHOLDER_IMG, wallet:'0xB1E991bF617459B58964eEf7756B350e675C53b5', payout_wallet:'0xB1E991bF617459B58964eEf7756B350e675C53b5' },
]

const TIERS = [
  { label:'Bronze',   min:50,   max:99,       boost:'1.1×',  apr:'8%'  },
  { label:'Silver',   min:100,  max:249,      boost:'1.25×', apr:'12%' },
  { label:'Gold',     min:250,  max:499,      boost:'1.5×',  apr:'18%' },
  { label:'Platinum', min:500,  max:999,      boost:'1.75×', apr:'24%' },
  { label:'Diamond',  min:1000, max:4999,     boost:'2×',    apr:'32%' },
  { label:'VIP',      min:5000, max:Infinity, boost:'3×',    apr:'45%' },
]

const CONTRACT_TEXT = `IRREVOCABLE RIGHTS GRANT AND SUBMISSION AGREEMENT ("Agreement")

THIS AGREEMENT is entered into as of the date of electronic acceptance between the individual executing this Agreement ("Submitter") and Blockchain Entertainment LLC ("Company").

1. IRREVOCABLE GRANT OF RIGHTS. Submitter hereby irrevocably, unconditionally, perpetually, and globally grants to the Company its exclusive, royalty-free right and license to use, reproduce, modify, distribute, display, perform, broadcast, publish, and create derivative works of the submitted photograph and profile ("Content") in any medium, format, or technology now known or hereafter developed, for any and all purposes, without limitation of time, geography, or compensation to Submitter. This grant is perpetual and shall survive termination of any relationship between the parties.

2. WAIVER OF MORAL RIGHTS. Submitter expressly and irrevocably waives all moral rights, rights of attribution, integrity rights, or similar rights in any jurisdiction worldwide.

3. NO REVOCATION. This grant is irrevocable and may not be rescinded, withdrawn, or modified at any time for any reason. Submitter permanently relinquishes any right to demand removal, alteration, or cessation of use of the Content.

4. REPRESENTATIONS & WARRANTIES. Submitter warrants that: (a) Submitter is the sole author and owner of the Content; (b) Submitter is at least 18 years of age; (c) the Content does not infringe any third-party rights; (d) the Content complies with SFW standards as defined by the laws of all applicable jurisdictions, currently in effect and as amended in the future; (e) all persons depicted have provided written consent.

5. WALLET ADDRESS. Payment of prizes shall be made solely to the wallet address provided. The Company bears NO obligation to verify the accuracy of any wallet address. Any error results in permanent, irrecoverable loss of funds. Transactions on the Base blockchain are irreversible.

6. EXTERNAL LINKS. The Company has no affiliation with, endorsement of, or responsibility for any external website linked from Submitter's profile. The Company expressly disclaims all liability arising from such links.

7. CONTENT MODERATION. The Company reserves the sole and absolute right to approve, reject, or remove any Content at any time without liability.

8. GOVERNING LAW. This Agreement shall be governed by the laws of the State of Florida, United States, and enforced in accordance with applicable EU law where required.

9. BINDING EFFECT. This Agreement is legally binding upon electronic acceptance and submission of 1 $TTS as a cryptographic signing mechanism on the Base blockchain, constituting a legal signature under the U.S. ESIGN Act and EU eIDAS Regulation.

BY PROCEEDING, SUBMITTER ACKNOWLEDGES HAVING READ, UNDERSTOOD, AND AGREED TO BE LEGALLY BOUND BY THIS AGREEMENT IN ITS ENTIRETY.`

// ── STYLES ─────────────────────────────────────────────────────────────────
const S = `
  html { font-size: 18px; }
  :root {
    --void:#05050a; --deep:#0c0c14; --surface:#12121e; --surface2:#1a1a2a;
    --border:rgba(212,175,55,0.18); --border2:rgba(255,255,255,0.06);
    --gold:#d4af37; --gold-light:#f0d060; --gold-dim:rgba(212,175,55,0.6);
    --crimson:#8b1a2a; --crimson-glow:#c0253a; --rose:#e8405a;
    --green:#2ecc71; --text:#f0e8d8; --muted:rgba(240,232,216,0.5);
    --font-d:'Cormorant Garamond',serif; --font-b:'Montserrat',sans-serif;
  }
  .app { min-height:100vh; background:var(--void); overflow-x:hidden; font-family:var(--font-b); }

  /* WALLET BAR */
  .wbar { background:linear-gradient(135deg,#0e0e1a,#141424); border-bottom:1px solid var(--border);
    padding:12px 18px; position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); }
  .wbar-inner { max-width:520px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .wlogo img { width:46px; height:46px; object-fit:contain; display:block; }
  .wbal { display:flex; flex-direction:column; align-items:center; }
  .wlabel { font-size:.72rem; letter-spacing:.1em; color:var(--muted); text-transform:uppercase; }
  .wamt { font-family:var(--font-b); font-size:1.5rem; font-weight:800; color:var(--gold-light); line-height:1.1; }
  .wamt span { font-size:.75rem; font-family:var(--font-b); color:var(--gold-dim); margin-left:3px; font-weight:700; }
  .waddr { font-size:.7rem; color:var(--muted); letter-spacing:.04em; margin-top:1px; }
  .wbtns { display:flex; gap:6px; }
  .btn-t { font-family:var(--font-b); font-size:.72rem; letter-spacing:.1em; text-transform:uppercase;
    padding:6px 10px; border-radius:4px; border:1px solid var(--border); background:transparent;
    color:var(--gold); cursor:pointer; transition:all .2s; }
  .btn-t:hover { background:rgba(212,175,55,.1); border-color:var(--gold); }
  .btn-conn { font-family:var(--font-b); font-size:.78rem; letter-spacing:.08em; text-transform:uppercase;
    padding:9px 14px; border-radius:5px; border:1px solid var(--crimson-glow);
    background:linear-gradient(135deg,var(--crimson),#a0203a); color:var(--text); cursor:pointer; transition:all .25s; }
  .btn-conn:hover { background:linear-gradient(135deg,var(--crimson-glow),var(--rose)); box-shadow:0 0 18px rgba(192,37,58,.4); }

  /* NAV */
  .nav { background:var(--deep); border-bottom:1px solid var(--border); overflow-x:auto; scrollbar-width:none; }
  .nav::-webkit-scrollbar { display:none; }
  .nav-inner { display:flex; max-width:520px; margin:0 auto; padding:0 6px; }
  .ni { flex-shrink:0; padding:13px 12px; font-size:.68rem; letter-spacing:.1em; text-transform:uppercase;
    font-weight:700; color:rgba(240,232,216,0.75); cursor:pointer; border-bottom:2px solid transparent;
    transition:all .2s; white-space:nowrap; background:none; border-top:none; border-left:none;
    border-right:none; font-family:var(--font-b); }
  .ni:hover { color:var(--text); }
  .ni.active { color:var(--gold); border-bottom-color:var(--gold); }

  /* MAIN */
  .main { max-width:520px; margin:0 auto; padding-bottom:60px; }

  /* SECTION HEAD */
  .shead { padding:26px 20px 12px; text-align:center; }
  .shead h2 { font-family:var(--font-d); font-size:2rem; font-weight:300; letter-spacing:.06em; font-style:italic; }
  .shead p { font-size:.82rem; color:var(--muted); letter-spacing:.08em; margin-top:6px; }
  .grule { width:46px; height:1px; background:linear-gradient(90deg,transparent,var(--gold),transparent); margin:8px auto; }

  /* TIMER */
  .wtimer { background:var(--surface); border:1px solid var(--border); border-radius:10px;
    padding:13px 16px; margin:0 16px 18px; display:flex; align-items:center; justify-content:space-between; }
  .tl { font-size:.76rem; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); }
  .tv { font-family:var(--font-b); font-size:1.2rem; font-weight:800; color:var(--gold-light); letter-spacing:.04em; }
  .ldot { width:7px; height:7px; border-radius:50%; background:var(--rose); animation:pulse 1.5s infinite; }
  .live-row { display:flex; align-items:center; gap:6px; }
  .live-txt { font-size:.74rem; color:var(--rose); letter-spacing:.1em; text-transform:uppercase; }
  @keyframes pulse { 0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(232,64,90,.5);}50%{opacity:.7;box-shadow:0 0 0 5px rgba(232,64,90,0);} }

  /* CAROUSEL */
  .car-outer { padding:0 16px; }
  .car-wrap { position:relative; overflow:hidden; border-radius:12px; touch-action:pan-y; }
  .car-track { display:flex; transition:transform .38s cubic-bezier(.25,.46,.45,.94); will-change:transform; }
  .car-track .pcard { min-width:100%; width:100%; flex-shrink:0; }
  .car-arrow { position:absolute; top:38%; transform:translateY(-50%); z-index:20;
    width:40px; height:70px; display:flex; align-items:center; justify-content:center;
    background:rgba(5,5,10,.6); backdrop-filter:blur(6px);
    border:1px solid rgba(212,175,55,.22); cursor:pointer; transition:all .22s;
    color:var(--gold); font-size:1.6rem; line-height:1; user-select:none;
    -webkit-tap-highlight-color:transparent; }
  .car-arrow:hover { background:rgba(139,26,42,.7); border-color:var(--gold); }
  .car-arrow:active { transform:translateY(-50%) scale(.93); }
  .car-arrow.left { left:0; border-radius:0 8px 8px 0; border-left:none; }
  .car-arrow.right { right:0; border-radius:8px 0 0 8px; border-right:none; }
  .car-arrow.hidden { opacity:0; pointer-events:none; }
  .car-footer { display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 0 4px; }
  .car-dots { display:flex; gap:6px; align-items:center; }
  .car-dot { width:6px; height:6px; border-radius:50%; background:rgba(212,175,55,.22); transition:all .25s; cursor:pointer; }
  .car-dot.active { background:var(--gold); width:20px; border-radius:3px; }
  .car-count { font-size:.92rem; font-weight:800; color:var(--gold-light); letter-spacing:.06em; min-width:60px; text-align:center; }

  /* PHOTO CARD */
  .pcard { background:var(--surface); border:1px solid var(--border); overflow:hidden; }
  .pimg-wrap { position:relative; aspect-ratio:3/4; overflow:hidden; user-select:none; }
  .pimg-wrap img { width:100%; height:100%; object-fit:cover; pointer-events:none; display:block; transition:transform .6s ease; }
  .pcard:hover .pimg-wrap img { transform:scale(1.03); }
  .prank { position:absolute; top:12px; left:12px; background:rgba(0,0,0,.72);
    border:1px solid var(--gold); color:var(--gold); font-family:var(--font-d); font-size:1.05rem;
    padding:3px 10px; border-radius:4px; backdrop-filter:blur(8px); }
  .pcounter { position:absolute; top:12px; right:12px; background:rgba(0,0,0,.7);
    border:1px solid rgba(212,175,55,.3); color:var(--muted); font-size:.54rem;
    padding:3px 9px; border-radius:4px; backdrop-filter:blur(8px); letter-spacing:.08em; }
  .pno-dl { position:absolute; inset:0; z-index:10; cursor:default; }
  .pinfo { padding:14px 16px; }
  .pname { font-family:var(--font-b); font-size:1.25rem; font-weight:800; margin-bottom:5px; }
  .plink { display:flex; align-items:center; justify-content:center; gap:8px; font-size:.85rem; letter-spacing:.12em; text-transform:uppercase; color:#fff; border:none; padding:16px 24px; border-radius:10px; cursor:pointer; transition:all .25s; background:linear-gradient(135deg,#FF6B00,#FF8C00); font-family:var(--font-b); font-weight:700; width:100%; box-shadow:0 4px 20px rgba(255,107,0,.45); }
  .plink:hover { color:var(--gold); border-color:var(--gold); }

  /* VOTE SECTION */
  .vsec { padding:14px 16px; background:var(--surface2); border-top:1px solid var(--border); }
  .vtotal { display:flex; justify-content:space-between; align-items:center; margin-bottom:9px; }
  .vtl { font-size:.76rem; font-weight:700; letter-spacing:.1em; color:var(--muted); text-transform:uppercase; }
  .vta { font-family:var(--font-b); font-size:1.15rem; font-weight:800; color:var(--gold-light); }
  .vta span { font-size:.76rem; color:var(--muted); font-family:var(--font-b); }
  .vbar-wrap { background:rgba(255,255,255,.04); border-radius:3px; height:3px; margin-bottom:12px; }
  .vbar { height:3px; background:linear-gradient(90deg,var(--crimson),var(--rose)); border-radius:3px; transition:width .6s ease; }
  .vinput-row { display:flex; gap:8px; align-items:center; }
  .vinput { flex:1; background:var(--surface); border:1px solid var(--border); border-radius:6px;
    color:var(--text); font-family:var(--font-b); font-size:1rem; padding:12px 14px;
    outline:none; transition:border-color .2s; }
  .vinput:focus { border-color:var(--gold); }
  .vinput::placeholder { color:var(--muted); font-size:.85rem; }
  .vbtn { background:linear-gradient(135deg,#a0203a,var(--crimson-glow)); color:#fff; border:none;
    border-radius:10px; padding:16px 24px; font-family:var(--font-b); font-size:.82rem;
    letter-spacing:.1em; text-transform:uppercase; font-weight:600; cursor:pointer; transition:all .2s; white-space:nowrap; }
  .vbtn:hover { background:linear-gradient(135deg,var(--crimson-glow),var(--rose)); box-shadow:0 4px 16px rgba(192,37,58,.4); }
  .vbtn:disabled { opacity:.5; cursor:not-allowed; }
  .myvotes { font-size:.76rem; color:var(--gold-dim); margin-top:7px; letter-spacing:.06em; }

  /* LEADERBOARD */
  .lb-list { padding:0 16px; display:flex; flex-direction:column; gap:10px; }
  .lbc { display:flex; align-items:center; gap:13px; background:var(--surface); border:1px solid var(--border);
    border-radius:10px; padding:13px; animation:cardIn .4s ease forwards; opacity:0; }
  .lbc:nth-child(1){animation-delay:.05s;border-color:rgba(212,175,55,.4);}
  .lbc:nth-child(2){animation-delay:.1s;}.lbc:nth-child(3){animation-delay:.15s;}
  .lbc:nth-child(4){animation-delay:.2s;}.lbc:nth-child(5){animation-delay:.25s;}
  @keyframes cardIn { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
  .lbrank { font-family:var(--font-d); font-size:1.5rem; font-weight:600; width:28px; text-align:center; flex-shrink:0; }
  .r1{color:var(--gold);}.r2{color:#c0c0c0;}.r3{color:#cd7f32;}.r4,.r5{color:var(--muted);font-size:1.1rem;}
  .lbthumb { width:50px; height:50px; border-radius:7px; object-fit:cover; flex-shrink:0; border:1px solid var(--border); pointer-events:none; }
  .lbinfo { flex:1; min-width:0; }
  .lbname { font-family:var(--font-b); font-size:1rem; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .lbvotes { font-size:.76rem; color:var(--muted); letter-spacing:.06em; margin-top:2px; }
  .lbvotes strong { color:var(--gold-light); font-family:var(--font-b); font-size:.92rem; font-weight:700; }
  .lb-bar-w { background:rgba(255,255,255,.05); border-radius:2px; height:3px; margin-top:6px; }
  .lb-bar { height:3px; background:linear-gradient(90deg,var(--crimson),var(--rose)); border-radius:2px; transition:width .8s ease; }
  .prize-box { background:var(--surface); border:1px solid var(--border); border-radius:10px; margin:18px 16px; padding:18px; }
  .prize-title { font-family:var(--font-d); font-size:1rem; font-style:italic; margin-bottom:12px; }
  .prize-grid { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .prize-cell { background:var(--surface2); border-radius:7px; padding:10px 12px; border:1px solid var(--border); }
  .prize-cl { font-size:.72rem; color:var(--muted); letter-spacing:.1em; text-transform:uppercase; }
  .prize-cv { font-size:.86rem; color:var(--gold); margin-top:3px; }

  /* BUY/SELL/STAKE */
  .bs-wrap { padding:0 16px; }
  .bs-tabs { display:flex; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:4px; margin-bottom:18px; }
  .bs-tab { flex:1; padding:10px; border:none; background:transparent; color:var(--muted);
    font-family:var(--font-b); font-size:.78rem; letter-spacing:.08em; text-transform:uppercase; cursor:pointer; border-radius:6px; transition:all .2s; }
  .bs-tab.active { background:linear-gradient(135deg,var(--crimson),#a0203a); color:var(--text); }
  .flabel { font-size:.76rem; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:5px; display:block; }
  .finput { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
    color:var(--text); font-family:var(--font-b); font-size:.88rem; padding:12px 14px;
    outline:none; transition:border-color .2s; margin-bottom:13px; }
  .finput:focus { border-color:var(--gold); }
  .fselect { width:100%; background:var(--surface); border:1px solid var(--border); border-radius:8px;
    color:var(--text); font-family:var(--font-b); font-size:.82rem; padding:12px 14px;
    outline:none; cursor:pointer; margin-bottom:13px; }
  .fselect option { background:var(--deep); }
  .rate-box { background:var(--surface2); border:1px solid var(--border); border-radius:8px;
    padding:12px; display:flex; justify-content:space-between; align-items:center; margin-bottom:13px; }
  .rate-l { font-size:.74rem; color:var(--muted); letter-spacing:.08em; text-transform:uppercase; }
  .rate-v { font-family:var(--font-d); font-size:1rem; color:var(--gold-light); }
  .stk-info { background:var(--surface2); border:1px solid var(--border); border-radius:8px; padding:15px; margin-bottom:14px; }
  .stk-title { font-family:var(--font-d); font-size:1rem; font-style:italic; margin-bottom:11px; }
  .stk-tiers { display:flex; flex-direction:column; gap:7px; }
  .stk-tier { display:flex; justify-content:space-between; align-items:center; padding:10px 12px;
    background:var(--surface); border-radius:6px; border:1px solid var(--border); cursor:pointer; transition:border-color .2s; }
  .stk-tier.sel { border-color:var(--gold); }
  .tn { font-size:.82rem; font-weight:700; letter-spacing:.06em; }
  .tn.Bronze{color:#cd7f32;}.tn.Silver{color:#c0c0c0;}.tn.Gold{color:var(--gold);}
  .tn.Platinum{color:#e5e4e2;}.tn.Diamond{color:#b9f2ff;}
  .tr2 { font-size:.74rem; color:var(--muted); }
  .tboost { font-size:.78rem; color:var(--rose); font-weight:700; }
  .tapr { font-size:.78rem; color:var(--gold-dim); }
  .warn-box { background:rgba(192,37,58,.08); border:1px solid rgba(192,37,58,.25); border-radius:8px;
    padding:12px; font-size:.78rem; color:var(--muted); line-height:1.7; margin-bottom:13px; }
  .pbtn { background:linear-gradient(135deg,var(--crimson),#a0203a); color:var(--text); border:none;
    border-radius:8px; padding:14px; font-family:var(--font-b); font-size:.66rem;
    letter-spacing:.14em; text-transform:uppercase; font-weight:600; cursor:pointer; transition:all .25s; width:100%; }
  .pbtn:hover { background:linear-gradient(135deg,var(--crimson-glow),var(--rose)); box-shadow:0 6px 24px rgba(192,37,58,.4); }
  .sub-note { font-size:.74rem; color:var(--muted); text-align:center; line-height:1.6; margin-top:10px; }

  /* SUBMIT */
  .sub-wrap { padding:0 16px; }
  .upbox { background:var(--surface); border:2px dashed var(--border); border-radius:12px;
    padding:36px 20px; text-align:center; cursor:pointer; transition:all .25s; margin-bottom:18px; }
  .upbox:hover { border-color:var(--gold-dim); background:var(--surface2); }
  .upicon { font-size:2.2rem; display:block; margin-bottom:10px; opacity:.5; }
  .uptxt { font-size:.82rem; color:var(--muted); letter-spacing:.08em; line-height:1.65; }
  .uppreview { width:100%; border-radius:8px; max-height:260px; object-fit:cover; margin-bottom:13px; pointer-events:none; }
  .cbox { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:15px;
    margin:16px 0; max-height:180px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--crimson) transparent; }
  .cbox::-webkit-scrollbar{width:3px;}.cbox::-webkit-scrollbar-track{background:transparent;}
  .cbox::-webkit-scrollbar-thumb{background:var(--crimson);border-radius:2px;}
  .ctxt { font-size:.74rem; color:var(--muted); line-height:1.85; white-space:pre-wrap; }
  .chk-row { display:flex; align-items:flex-start; gap:11px; margin:13px 0; cursor:pointer; }
  .chk-row input[type=checkbox] { width:17px; height:17px; flex-shrink:0; accent-color:var(--crimson-glow); cursor:pointer; margin-top:1px; }
  .chk-lbl { font-size:.58rem; color:var(--muted); letter-spacing:.04em; line-height:1.65; }
  .chk-lbl strong { color:var(--gold-dim); }
  .cost-note { display:flex; align-items:center; justify-content:center; gap:8px;
    background:rgba(212,175,55,.06); border:1px solid rgba(212,175,55,.2); border-radius:8px;
    padding:11px; font-size:.62rem; color:var(--gold-dim); letter-spacing:.08em; margin-bottom:12px; }
  .addr-warn { font-size:.56rem; color:var(--crimson-glow); letter-spacing:.04em; line-height:1.65; margin-bottom:16px; }
  .support-note { font-size:.58rem; color:var(--muted); letter-spacing:.04em; line-height:1.7;
    margin-bottom:13px; background:var(--surface2); border-radius:7px; padding:11px; border:1px solid var(--border); }
  .mclose { background:transparent; border:1px solid var(--border); color:var(--muted); border-radius:6px;
    padding:10px; width:100%; cursor:pointer; font-family:var(--font-b); font-size:.62rem;
    letter-spacing:.1em; text-transform:uppercase; margin-top:7px; transition:all .2s; }
  .mclose:hover { color:var(--text); border-color:var(--muted); }

  /* RULES */
  .rules-wrap { padding:0 16px; display:flex; flex-direction:column; gap:11px; }
  .rcard { background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:17px; animation:cardIn .4s ease forwards; opacity:0; }
  .rcard:nth-child(1){animation-delay:.05s;}.rcard:nth-child(2){animation-delay:.1s;}
  .rcard:nth-child(3){animation-delay:.15s;}.rcard:nth-child(4){animation-delay:.2s;}
  .rcard:nth-child(5){animation-delay:.25s;}.rcard:nth-child(6){animation-delay:.3s;}
  .rnum { font-family:var(--font-d); font-size:1.5rem; color:rgba(212,175,55,.2); font-weight:300; line-height:1; margin-bottom:5px; }
  .rtitle { font-size:.66rem; letter-spacing:.1em; text-transform:uppercase; color:var(--text); font-weight:600; margin-bottom:5px; }
  .rbody { font-size:.65rem; color:var(--muted); line-height:1.75; }

  /* FAQ */
  .faq-wrap { padding:0 16px; display:flex; flex-direction:column; gap:9px; }
  .faq-item { background:var(--surface); border:1px solid var(--border); border-radius:10px; overflow:hidden; animation:cardIn .4s ease forwards; opacity:0; }
  .faq-q { padding:15px 17px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; gap:12px; }
  .faq-qt { font-size:.66rem; letter-spacing:.06em; color:var(--text); font-weight:500; }
  .faq-ch { color:var(--gold-dim); font-size:.78rem; flex-shrink:0; transition:transform .25s; }
  .faq-ch.open { transform:rotate(180deg); }
  .faq-a { padding:0 17px 14px; font-size:.63rem; color:var(--muted); line-height:1.78; border-top:1px solid var(--border); padding-top:12px; }

  /* LOADING SKELETON */
  .skel-card { background:var(--surface); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
  .skel-img { aspect-ratio:3/4; background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  .skel-line { height:14px; border-radius:4px; margin:12px 16px 6px; background:linear-gradient(90deg,var(--surface) 25%,var(--surface2) 50%,var(--surface) 75%); background-size:200% 100%; animation:shimmer 1.4s infinite; }
  .skel-line.short { width:55%; height:10px; margin-top:4px; }
  @keyframes shimmer { to { background-position:-200% 0; } }

  /* VOTE CELEBRATION */
  .cel-overlay { position:fixed; inset:0; z-index:9000; pointer-events:none; overflow:hidden; }
  .cel-particle { position:absolute; bottom:-5%; font-size:3rem; animation:flyUp var(--dur,1.2s) cubic-bezier(.1,.9,.3,1) forwards; opacity:0; }
  @keyframes flyUp { 0%{opacity:1;transform:translateY(0) scale(.8) rotate(0deg);} 60%{opacity:1;} 100%{opacity:0;transform:translateY(-115vh) scale(2) rotate(var(--rot,45deg));} }
  .cel-banner { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:9001; text-align:center; animation:bannerPop .4s cubic-bezier(.34,1.56,.64,1) forwards; }
  @keyframes bannerPop { from{opacity:0;transform:translate(-50%,-50%) scale(.5);} to{opacity:1;transform:translate(-50%,-50%) scale(1);} }
  .cel-title { font-family:var(--font-b); font-size:1.6rem; font-weight:900; color:#fff; text-shadow:0 0 30px rgba(255,200,0,.9),0 2px 8px rgba(0,0,0,.8); line-height:1.2; }
  .cel-sub { font-size:.75rem; color:var(--gold-light); letter-spacing:.1em; margin-top:6px; text-shadow:0 1px 4px rgba(0,0,0,.8); }
  .cel-share { margin-top:14px; padding:10px 22px; border-radius:8px; border:none; background:linear-gradient(135deg,#1da1f2,#0d8fd9); color:#fff; font-family:var(--font-b); font-size:.76rem; font-weight:700; letter-spacing:.08em; cursor:pointer; pointer-events:all; box-shadow:0 4px 16px rgba(29,161,242,.5); }
  @keyframes share-pulse { 0%,100%{box-shadow:0 0 18px 4px rgba(255,200,0,.55),0 4px 24px rgba(0,0,0,.7);} 50%{box-shadow:0 0 32px 10px rgba(255,200,0,.85),0 4px 32px rgba(0,0,0,.8);} }
  .share-float { position:fixed; bottom:80px; left:50%; transform:translateX(-50%); z-index:99999; padding:15px 32px; border-radius:14px; border:2.5px solid #ffd700; background:linear-gradient(135deg,#1a1a00,#2d2600,#1a1a00); color:#ffd700; font-family:var(--font-b); font-size:1rem; font-weight:900; letter-spacing:.12em; cursor:pointer; white-space:nowrap; animation:share-pulse 1.4s ease-in-out infinite; transition:opacity 0.5s ease; }
  .share-float.fadeout { opacity:0; pointer-events:none; }
  @keyframes vflash { 0%,100%{color:var(--gold-light);} 50%{color:#fff;text-shadow:0 0 20px #fff,0 0 40px var(--gold);} }
  .vta.flash { animation:vflash .6s ease 3; }

  /* MODAL */
  .moverlay { position:fixed; inset:0; background:rgba(0,0,0,.86); z-index:500;
    display:flex; align-items:flex-end; justify-content:center; backdrop-filter:blur(6px); animation:fadeIn .2s ease; }
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  .msheet { background:var(--deep); border:1px solid var(--border); border-radius:20px 20px 0 0;
    width:100%; max-width:520px; padding:24px 20px 36px; animation:slideUp .3s cubic-bezier(.34,1.56,.64,1); max-height:85vh; overflow-y:auto; }
  @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
  .mhandle { width:34px; height:4px; background:var(--border); border-radius:2px; margin:0 auto 17px; }
  .mtitle { font-family:var(--font-d); font-size:1.5rem; font-style:italic; margin-bottom:5px; }
  .msub { font-size:.62rem; color:var(--muted); letter-spacing:.08em; margin-bottom:16px; }
  .wopt { display:flex; align-items:center; gap:13px; background:var(--surface); border:1px solid var(--border);
    border-radius:10px; padding:14px; margin-bottom:9px; cursor:pointer; transition:all .2s; }
  .wopt:hover { border-color:var(--gold-dim); background:var(--surface2); }
  .wopt-icon { width:40px; height:40px; border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0; }
  .wopt-name { font-size:.76rem; font-weight:600; letter-spacing:.04em; display:flex; align-items:center; gap:7px; }
  .wopt-desc { font-size:.56rem; color:var(--muted); margin-top:2px; }
  .live-pill { font-size:.46rem; background:rgba(46,204,113,.13); color:#2ecc71; border:1px solid rgba(46,204,113,.3); border-radius:3px; padding:1px 5px; letter-spacing:.08em; }
  .hosted-pill { font-size:.46rem; background:rgba(255,255,255,.05); color:var(--muted); border:1px solid rgba(255,255,255,.08); border-radius:3px; padding:1px 5px; letter-spacing:.08em; }
  .pid-box { background:rgba(212,175,55,.06); border:1px solid rgba(212,175,55,.18); border-radius:8px; padding:9px 12px; margin-bottom:13px; font-size:.56rem; color:var(--gold-dim); letter-spacing:.04em; line-height:1.65; }

  /* TRANSFER MODAL */
  .base-l { font-size:.56rem; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin-bottom:5px; display:block; }
  .base-addr { background:var(--surface2); border:1px solid var(--border); border-radius:7px; padding:11px; margin-bottom:13px; font-size:.66rem; color:var(--gold); font-family:monospace; word-break:break-all; }
  .irrev { font-size:.56rem; color:var(--crimson-glow); letter-spacing:.04em; line-height:1.65; margin-bottom:13px; }

  /* TOAST */
  .toast { position:fixed; bottom:18px; left:50%; transform:translateX(-50%) translateY(70px);
    background:var(--surface2); border:1px solid var(--border); border-radius:10px;
    padding:12px 20px; font-size:.66rem; letter-spacing:.06em; color:var(--text); z-index:1000;
    white-space:nowrap; transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .3s;
    opacity:0; max-width:90vw; text-align:center; }
  .toast.show { transform:translateX(-50%) translateY(0); opacity:1; }
  .toast.s { border-color:rgba(212,175,55,.5); }
  .toast.e { border-color:rgba(232,64,90,.5); }

  /* NFT EMPTY */
  .nft-empty { text-align:center; padding:50px 20px; color:var(--muted); font-size:.7rem; letter-spacing:.08em; line-height:1.9; margin:0 16px; background:var(--surface); border:1px solid var(--border); border-radius:12px; }
  .nft-ei { font-size:2.5rem; display:block; margin-bottom:12px; opacity:.35; }

  /* VOTING PENDING */
  .vote-pending { font-size:.72rem; color:var(--gold-dim); margin-top:7px; letter-spacing:.06em; text-align:center; }

  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:var(--surface2);border-radius:2px;}

  @media(min-width:700px){
    .wbar-inner,.nav-inner,.main{max-width:640px;}
    .car-outer{max-width:580px;margin:0 auto;}
  }
`

// ── HELPERS ─────────────────────────────────────────────────────────────────
function shortAddr(a) {
  if (!a) return ''
  return a.slice(0,6) + '…' + a.slice(-4)
}

function useCountdown(endTime) {
  const [t, setT] = useState('...')
  useEffect(() => {
    const tick = () => {
      if (!endTime) { setT('...'); return }
      const d = endTime * 1000 - Date.now()
      if (d <= 0) { setT('Round ended'); return }
      const da = Math.floor(d/86400000)
      const h = Math.floor((d%86400000)/3600000)
      const m = Math.floor((d%3600000)/60000)
      const s = Math.floor((d%60000)/1000)
      setT(`${da}d ${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endTime])
  return t
}

function useToast() {
  const [t, setT] = useState({ msg:'', type:'s', show:false })
  const show = useCallback((msg, type='s') => {
    setT({ msg, type, show:true })
    setTimeout(() => setT(x => ({ ...x, show:false })), 3200)
  }, [])
  return [t, show]
}

// ── WALLET MODAL ─────────────────────────────────────────────────────────────
function WalletModal({ onClose, showToast }) {
  const { open } = useAppKit()

  const connectWallet = () => {
    onClose()
    open()
  }

  const wallets = [
    { name:'MetaMask', desc: 'Tap to connect — desktop & mobile', icon:'🦊', bg:'#f6851b22', action:connectWallet, live:true },
    { name:'WalletConnect', desc:'Scan QR code with any mobile wallet', icon:'🔗', bg:'#3b99fc22', action:connectWallet, live:true },
    { name:'Trust Wallet', desc:'Open this page inside the Trust Wallet browser', icon:'🛡️', bg:'#3375bb22', action:connectWallet, live:true },
    { name:'Coinbase Wallet', desc: 'Desktop extension & Coinbase mobile app', icon:'🔵', bg:'#0052ff22', action:connectWallet, live:true },
  ]

  return (
    <div className="moverlay" onClick={onClose}>
      <div className="msheet" onClick={e => e.stopPropagation()}>
        <div className="mhandle" />
        <div className="mtitle">Connect Wallet</div>
        <div className="msub">Connect to Base network to use $TTS</div>
        <div className="pid-box">⬡ Base Mainnet · Chain ID 8453 · Reown Project Active</div>
        {wallets.map(w => (
          <div key={w.name} className="wopt" onClick={w.action}>
            <div className="wopt-icon" style={{ background:w.bg }}>{w.icon}</div>
            <div style={{ flex:1 }}>
              <div className="wopt-name">
                {w.name}
                {w.live
                  ? <span className="live-pill">LIVE</span>
                  : <span className="hosted-pill">IN BROWSER</span>
                }
              </div>
              <div className="wopt-desc">{w.desc}</div>
            </div>
          </div>
        ))}
        <button className="mclose" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// ── TRANSFER MODAL ────────────────────────────────────────────────────────────
function TransferModal({ dir, onClose, showToast, address, walletClient }) {
  const [amt, setAmt] = useState('')
  const [toAddr, setToAddr] = useState('')
  const [sending, setSending] = useState(false)

  const go = async () => {
    if (dir === 'in') {
      window.open(`https://app.uniswap.org/swap?outputCurrency=${TTS_ADDRESS}&chain=base`, '_blank')
      onClose()
      return
    }
    if (!amt || isNaN(amt) || Number(amt) <= 0) { showToast('Enter a valid amount', 'e'); return }
    if (!toAddr || !/^0x[0-9a-fA-F]{40}$/.test(toAddr)) { showToast('Enter a valid Base wallet address', 'e'); return }
    if (!walletClient) { showToast('Wallet not ready', 'e'); return }
    setSending(true)
    try {
      const amountWei = BigInt(Math.floor(Number(amt) * 1e18))
      showToast('Confirm transfer in wallet…', 's')
      const tx = await writeContract(walletClient, TTS_ADDRESS, TTS_ABI, 'transfer', [toAddr, amountWei])
      showToast('Waiting for confirmation…', 's')
      await waitForReceipt(tx)
      showToast(`Sent ${amt} $TTS to ${toAddr.slice(0,8)}…`, 's')
      onClose()
    } catch(e) {
      showToast('Transfer failed: ' + (e.shortMessage || e.message || '').slice(0,50), 'e')
    }
    setSending(false)
  }

  return (
    <div className="moverlay" onClick={onClose}>
      <div className="msheet" onClick={e => e.stopPropagation()}>
        <div className="mhandle" />
        <div className="mtitle">{dir === 'in' ? 'Get $TTS' : 'Send $TTS'}</div>
        <div className="msub">{dir === 'in' ? 'Buy TTS on Uniswap and receive it at your wallet.' : 'Send TTS to any Base wallet address.'}</div>
        {dir === 'in' && address && (
          <>
            <span className="base-l">Your Wallet Address (receive TTS here)</span>
            <div className="base-addr">{address}</div>
          </>
        )}
        {dir === 'out' && (
          <>
            <label className="flabel">Amount ($TTS)</label>
            <input className="finput" type="number" min="1" placeholder="Enter amount" value={amt} onChange={e => setAmt(e.target.value)} />
            <label className="flabel">Destination Wallet Address (Base)</label>
            <input className="finput" type="text" placeholder="0x…" value={toAddr} onChange={e => setToAddr(e.target.value)} />
            <div className="irrev">⚠ Verify your address carefully. Transactions on Base are irreversible. Blockchain Entertainment LLC bears no responsibility for funds sent to incorrect addresses.</div>
          </>
        )}
        <button className="pbtn" onClick={go} disabled={sending}>
          {sending ? '⏳ Sending…' : dir === 'in' ? 'Buy $TTS on Uniswap →' : 'Send $TTS'}
        </button>
        <button className="mclose" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// Module-level cache — survives re-renders and navigation within the same session
let photoCache = null

// ── PLAY SCREEN ───────────────────────────────────────────────────────────────
function PlayScreen({ balance, setBalance, showToast, connected, address, walletClient }) {
  const [photos, setPhotos] = useState(() => photoCache || FALLBACK_PHOTOS)
  const [photosLoading, setPhotosLoading] = useState(false)
  const [roundEndTime, setRoundEndTime] = useState(null)

  useEffect(() => {
    if (photoCache && photoCache.length > 0) {
      setPhotos(photoCache)
      if (photoCache[0]?.img && !photoCache[0].img.startsWith('data:image/svg')) {
        const p = new Image(); p.src = photoCache[0].img
      }
    }

    async function loadPhotos() {
      const roundId = await readContract(VOTING_ADDRESS, VOTING_ABI, 'currentRoundId').catch(() => null)
      const currentRound = roundId != null ? Number(roundId) : 1

      // Fetch on-chain round end time for accurate countdown
      if (roundId != null) {
        readContract(VOTING_ADDRESS, VOTING_ABI, 'getRound', [roundId]).then(round => {
          if (round) setRoundEndTime(Number(round[1]))
        }).catch(() => {})
      }

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/submissions?status=eq.approved&round_id=eq.${currentRound}&select=*`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
      )
      const data = await res.json()

      if (!data || data.length < 1) { setPhotosLoading(false); return }

      const mapped = data.map((r, i) => ({
        id: i + 1,
        username: r.display_name || 'Anonymous',
        profileId: r.id,
        link: r.link_title || 'Profile',
        link_url: r.link_url || '',
        votes: 0,
        myVotes: 0,
        img: r.image_url || 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80',
        wallet: r.wallet_address,
        payout_wallet: r.payout_wallet
      }))
      const sorted = mapped.sort((a, b) => String(a.profileId).localeCompare(String(b.profileId)))
      photoCache = sorted
      setPhotos(sorted)
      setPhotosLoading(false)
      if (sorted[0]?.img) { const p = new Image(); p.src = sorted[0].img }

      if (roundId != null) {
        const withVotes = await Promise.all(sorted.map(async p => {
          try {
            const profile = await readContract(VOTING_ADDRESS, VOTING_ABI, 'getProfile', [roundId, p.profileId])
            if (profile) return { ...p, votes: Math.floor(Number(profile[2]) / 1e18) }
          } catch(_) {}
          return p
        }))
        photoCache = withVotes
        setPhotos(withVotes)
      }
    }
    loadPhotos().catch(e => { console.error('Photo fetch error:', e); setPhotosLoading(false) })
  }, [])
  const [va, setVa] = useState({})
  const [voting, setVoting] = useState({})
  const [flashId, setFlashId] = useState(null)
  const [celebrate, setCelebrate] = useState(null)
  const [shareVote, setShareVote] = useState(null)
  const [shareFading, setShareFading] = useState(false)
  const shareTimerRef = useRef(null)
  const [idx, setIdx] = useState(0)
  const cd = useCountdown(roundEndTime)
  const max = Math.max(...photos.map(p => p.votes), 1)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const goTo = n => {
    setIdx(Math.max(0, Math.min(photos.length - 1, n)))
    // Clear share button when swiping
    if (shareTimerRef.current) { clearTimeout(shareTimerRef.current[0]); clearTimeout(shareTimerRef.current[1]) }
    setShareVote(null); setShareFading(false)
  }

  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchEnd = e => {
    if (touchStartX.current === null) return
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY)
    if (Math.abs(dx) > 44 && Math.abs(dx) > dy * 1.5) { dx > 0 ? goTo(idx+1) : goTo(idx-1) }
    touchStartX.current = null
    touchStartY.current = null
  }

  const castVote = async (photo) => {
    if (!connected) { showToast('Connect your wallet to vote', 'e'); return }
    if (!walletClient) { showToast('Wallet not ready', 'e'); return }
    const a = Number(va[photo.id] || 0)
    if (a < 5) { showToast('Minimum vote is 5 $TTS', 'e'); return }
    if (a > balance) { showToast('Insufficient $TTS balance', 'e'); return }

    setVoting(v => ({ ...v, [photo.id]: true }))
    try {
      // Verify an active round exists before touching the wallet
      const roundId = await readContract(VOTING_ADDRESS, VOTING_ABI, 'currentRoundId')
      const round = roundId != null ? await readContract(VOTING_ADDRESS, VOTING_ABI, 'getRound', [roundId]) : null
      const now = Math.floor(Date.now() / 1000)
      if (!round || Number(round[0]) > now || now > Number(round[1])) {
        showToast('No active voting round right now — check back soon', 'e')
        return
      }

      const amountWei = BigInt(Math.floor(a * 1e18))

      // Check current allowance
      const allowance = await readContract(TTS_ADDRESS, TTS_ABI, 'allowance', [address, VOTING_ADDRESS])
      if (!allowance || BigInt(allowance.toString()) < amountWei) {
        showToast('Approving $TTS... confirm in wallet', 's')
        const approveTx = await writeContract(walletClient, TTS_ADDRESS, TTS_ABI, 'approve', [VOTING_ADDRESS, 2n ** 256n - 1n])
        showToast('Waiting for approval...', 's')
        await waitForReceipt(approveTx)
        showToast('Approved! Casting vote...', 's')
      } else {
        showToast('Casting vote on-chain...', 's')
      }

      // Cast the vote
      const voteTx = await writeContract(walletClient, VOTING_ADDRESS, VOTING_ABI, 'vote', [photo.profileId, amountWei])
      await waitForReceipt(voteTx)

      // Update UI
      setBalance(b => b - a)
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, votes: p.votes + a, myVotes: p.myVotes + a } : p))
      setVa(v => ({ ...v, [photo.id]: '' }))
      setFlashId(photo.id)
      setTimeout(() => setFlashId(null), 2000)
      setCelebrate({ amount: a, name: photo.username })
      setTimeout(() => setCelebrate(null), 4500)
      if (shareTimerRef.current) { clearTimeout(shareTimerRef.current[0]); clearTimeout(shareTimerRef.current[1]) }
      setShareFading(false)
      setShareVote({ amount: a, name: photo.username })
      const t1 = setTimeout(() => setShareFading(true), 4500)
      const t2 = setTimeout(() => { setShareVote(null); setShareFading(false) }, 5000)
      shareTimerRef.current = [t1, t2]
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.setValueAtTime(523, ctx.currentTime)
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1)
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2)
        gain.gain.setValueAtTime(0.15, ctx.currentTime)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
        osc.start(); osc.stop(ctx.currentTime + 0.5)
      } catch(_) {}
    } catch(e) {
      console.error('Vote error:', e)
      const msg = e.shortMessage || e.message || 'Unknown error'
      showToast('Vote failed: ' + msg.slice(0, 60), 'e')
    } finally {
      setVoting(v => ({ ...v, [photo.id]: false }))
    }
  }

  const EMOJIS = ['🔥','💎','💸','🏆','🍑','🏎️','💵','🎰','⚡','🔥']
  const particles = celebrate ? Array.from({length:30}, (_,i) => ({
    id: i,
    emoji: EMOJIS[i % EMOJIS.length],
    left: `${5 + Math.random()*90}%`,
    dur: `${0.8 + Math.random()*0.6}s`,
    delay: `${Math.random()*0.35}s`,
    rot: `${-60 + Math.random()*120}deg`,
  })) : []

  return (
    <div>
      {celebrate && (
        <>
          <div className="cel-overlay">
            {particles.map(p => (
              <span key={p.id} className="cel-particle" style={{ left:p.left, '--dur':p.dur, '--rot':p.rot, animationDelay:p.delay }}>{p.emoji}</span>
            ))}
          </div>
          <div className="cel-banner">
            <div className="cel-title">🔥 {celebrate.amount.toLocaleString()} $TTS VOTED!</div>
            <div className="cel-sub">YOU'RE IN THE GAME · {celebrate.name.toUpperCase()}</div>
          </div>
        </>
      )}
      {shareVote && (
        <button className={`share-float${shareFading ? ' fadeout' : ''}`} onClick={() => {
          const txt = encodeURIComponent(`I just voted $TTS on Temptation Token - the crypto Hot or Not where winners get PAID 🔥 app.temptationtoken.io #TTS #Base #Crypto`)
          window.open(`https://twitter.com/intent/tweet?text=${txt}`, '_blank')
        }}>𝕏 &nbsp;SHARE YOUR VOTE</button>
      )}

      <div className="shead">
        <div style={{ fontSize:'.54rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', marginBottom:5 }}>Live on Base Blockchain</div>
        <h2>Vote &amp; Win</h2>
        <div className="grule" />
        <p>Swipe or use arrows · Place $TTS to win 40% of the pool</p>
      </div>

      <div className="wtimer">
        <div><div className="tl">Round Ends</div><div className="tv">{cd}</div></div>
        <div className="live-row"><div className="ldot" /><span className="live-txt">Live</span></div>
      </div>

      <div className="car-outer">
        {photosLoading ? (
          <div className="car-wrap">
            <div className="car-track">
              <div className="pcard skel-card">
                <div className="skel-img" />
                <div style={{ padding:'12px 0 8px' }}>
                  <div className="skel-line" />
                  <div className="skel-line short" />
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="car-wrap" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className={`car-arrow left${idx === 0 ? ' hidden' : ''}`} onClick={() => goTo(idx-1)}>‹</div>
          <div className="car-track" style={{ transform:`translateX(-${idx*100}%)` }}>
            {photos.map((ph, i) => (
              <div key={ph.id} className="pcard">
                <div className="pimg-wrap">
                  <div className="pno-dl" onContextMenu={e => e.preventDefault()} />
                  <img src={ph.img} alt="" draggable="false" onContextMenu={e => e.preventDefault()} />
                  <div className="prank">#{i+1}</div>
                  <div className="pcounter">{i+1} / {photos.length}</div>
                </div>
                <div className="pinfo">
                  <div className="pname">{ph.username}</div>
                  <button className="plink" onClick={() => { const raw = ph.link_url || ''; const url = raw.startsWith('http') ? raw : raw.includes('.') ? 'https://' + raw : 'https://app.temptationtoken.io'; window.open(url, '_blank') }}>🔗 {ph.link || 'Profile'}</button>
                </div>
                <div className="vsec">
                  <div className="vtotal">
                    <span className="vtl">Total Votes</span>
                    <span className={`vta${flashId === ph.id ? ' flash' : ''}`}>{ph.votes.toLocaleString()} <span>$TTS</span></span>
                  </div>
                  <div className="vbar-wrap">
                    <div className="vbar" style={{ width:`${Math.round((ph.votes/max)*100)}%` }} />
                  </div>
                  <div className="vinput-row">
                    <input
                      className="vinput"
                      type="number"
                      min="5"
                      placeholder="Min 5 $TTS"
                      value={va[ph.id] || ''}
                      onChange={e => setVa(v => ({ ...v, [ph.id]:e.target.value }))}
                      disabled={voting[ph.id]}
                    />
                    <button
                      className="vbtn"
                      onClick={() => castVote(ph)}
                      disabled={voting[ph.id]}
                    >
                      {voting[ph.id] ? '⏳' : 'Vote'}
                    </button>
                  </div>
                  {voting[ph.id] && <div className="vote-pending">⏳ Confirming on Base...</div>}
                  {ph.myVotes > 0 && <div className="myvotes">✦ Your votes this round: {ph.myVotes.toLocaleString()} $TTS</div>}
                </div>
              </div>
            ))}
          </div>
          <div className={`car-arrow right${idx === photos.length-1 ? ' hidden' : ''}`} onClick={() => goTo(idx+1)}>›</div>
        </div>
        )}
        {!photosLoading && photos.length > 0 && (
        <div className="car-footer">
          <div className="car-count">{idx+1} of {photos.length}</div>
          <div className="car-dots">
            {photos.map((_, i) => (
              <div key={i} className={`car-dot${i === idx ? ' active' : ''}`} onClick={() => goTo(i)} />
            ))}
          </div>
          <div className="car-count" style={{ textAlign:'right' }}>{Math.round((photos[idx].votes/max)*100)}% votes</div>
        </div>
        )}
      </div>
    </div>
  )
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────────
function LeaderboardScreen() {
  const [items, setItems] = useState(() => {
    if (photoCache && photoCache.length > 0) return [...photoCache].sort((a,b) => b.votes - a.votes)
    return []
  })
  const [loading, setLoading] = useState(!photoCache || photoCache.length === 0)
  const [totalPool, setTotalPool] = useState(0)

  useEffect(() => {
    async function load() {
      const roundId = await readContract(VOTING_ADDRESS, VOTING_ABI, 'currentRoundId').catch(() => null)
      const currentRound = roundId != null ? Number(roundId) : 1
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/submissions?status=eq.approved&round_id=eq.${currentRound}&select=id,display_name,image_url`,
        { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
      )
      const data = await res.json()
      if (!data || data.length < 1) { setLoading(false); return }
      const withVotes = await Promise.all(data.map(async (r, i) => {
        let votes = 0
        try {
          const profile = await readContract(VOTING_ADDRESS, VOTING_ABI, 'getProfile', [roundId || 1n, r.id])
          if (profile) votes = Math.floor(Number(profile[2]) / 1e18)
        } catch(_) {}
        return { id: i+1, username: r.display_name || 'Anonymous', profileId: r.id, img: r.image_url || '', votes, myVotes: 0, link_url: '', link: '' }
      }))
      const sorted = withVotes.sort((a,b) => b.votes - a.votes)
      setItems(sorted)
      setTotalPool(sorted.reduce((s,p) => s + p.votes, 0))
      setLoading(false)
    }
    load().catch(() => setLoading(false))
    const interval = setInterval(() => load().catch(() => {}), 30000)
    return () => clearInterval(interval)
  }, [])

  const maxV = Math.max(...items.map(p => p.votes), 1)
  const medals = ['🥇','🥈','🥉','4','5','6','7','8','9','10']
  const rcs = ['r1','r2','r3','r4','r5']

  return (
    <div>
      <div className="shead"><h2>Leaderboard</h2><div className="grule" /><p>Live on-chain rankings · Auto-refreshes every 30s</p></div>
      <div style={{ padding:'0 16px 13px', display:'flex', justifyContent:'space-between', fontSize:'.56rem', color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase' }}>
        <span>Profile</span><span>Total $TTS</span>
      </div>
      {loading && items.length === 0 ? (
        <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>Loading rankings from Base...</div>
      ) : items.length === 0 ? (
        <div style={{ padding:'40px 16px', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>No approved profiles in this round yet.</div>
      ) : (
        <div className="lb-list">
          {items.map((p,i) => (
            <div key={p.id} className="lbc">
              <div className={`lbrank ${rcs[Math.min(i,4)]}`}>{medals[i] ?? i+1}</div>
              {p.img
                ? <img className="lbthumb" src={p.img} alt="" draggable="false" onContextMenu={e => e.preventDefault()} />
                : <div className="lbthumb" style={{ background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem' }}>📸</div>
              }
              <div className="lbinfo">
                <div className="lbname">{p.username}</div>
                <div className="lbvotes"><strong>{p.votes.toLocaleString()}</strong> $TTS {totalPool > 0 && <span style={{ color:'var(--muted)', fontSize:'.7rem' }}>· {Math.round((p.votes/totalPool)*100)}%</span>}</div>
                <div className="lb-bar-w"><div className="lb-bar" style={{ width:`${(p.votes/maxV)*100}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="prize-box">
        <div className="prize-title">Prize Pool — Current Round{totalPool > 0 && ` · ${totalPool.toLocaleString()} $TTS`}</div>
        <div className="prize-grid">
          {[['🏆 Top Voter','40% of pool'],['📸 Winning Profile','40% of pool'],['🏢 Blockchain Ent.','10% of pool'],['💙 Polaris Project','10% donation']].map(([l,v]) => (
            <div key={l} className="prize-cell"><div className="prize-cl">{l}</div><div className="prize-cv">{v}</div></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── NFT SCREEN ────────────────────────────────────────────────────────────────
function NFTScreen() {
  return (
    <div>
      <div className="shead"><h2>NFT Trophies</h2><div className="grule" /><p>Weekly round winners earn exclusive on-chain NFTs</p></div>
      <div className="nft-empty">
        <span className="nft-ei">💎</span>
        <div style={{ fontWeight:700, color:'var(--text)', marginBottom:8 }}>No NFTs yet</div>
        Win a weekly round to receive your exclusive NFT trophy.<br />
        NFTs are minted on Base and held permanently in your wallet.
      </div>
      <div style={{ margin:'0 16px 24px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:20 }}>
        <div style={{ fontSize:'.72rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--gold)', fontWeight:700, marginBottom:12 }}>How NFT Trophies Work</div>
        {[
          ['🏆','Win a round','Be the top voter on the winning profile — or be the winning profile'],
          ['💎','Get minted','Your NFT is minted automatically on Base when the round settles'],
          ['🔗','Yours forever','The NFT lives in your wallet permanently — verifiable on Base'],
        ].map(([icon,title,body]) => (
          <div key={title} style={{ display:'flex', gap:12, marginBottom:14, alignItems:'flex-start' }}>
            <div style={{ fontSize:'1.4rem', flexShrink:0, width:32, textAlign:'center' }}>{icon}</div>
            <div>
              <div style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text)', marginBottom:3 }}>{title}</div>
              <div style={{ fontSize:'.76rem', color:'var(--muted)', lineHeight:1.6 }}>{body}</div>
            </div>
          </div>
        ))}
        <a href={`https://basescan.org/address/${NFT_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ display:'block', marginTop:16, textAlign:'center', fontSize:'.72rem', color:'var(--gold-dim)', textDecoration:'none' }}>
          View NFT Contract on BaseScan →
        </a>
      </div>
    </div>
  )
}

// ── BUY/SELL/STAKE ────────────────────────────────────────────────────────────
function BuySellScreen({ showToast, connected }) {
  const [tab, setTab] = useState('buy')
  const [amt, setAmt] = useState('')
  const [cur, setCur] = useState('ETH')
  const [selTier, setSelTier] = useState(null)
  const [lockPd, setLockPd] = useState('3 months')
  const rate = 1200
  const recv = amt ? (Number(amt) * rate).toLocaleString() : '—'

  return (
    <div>
      <div className="shead"><h2>Buy · Sell · Stake</h2><div className="grule" /><p>Trade $TTS on Base · Stake to boost your votes</p></div>
      <div className="bs-wrap">
        <div className="bs-tabs">
          {['buy','sell','stake'].map(t => (
            <button key={t} className={`bs-tab${tab===t?' active':''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {(tab === 'buy' || tab === 'sell') && (
          <>
            <label className="flabel">{tab === 'buy' ? 'You Pay' : 'You Send'}</label>
            <input className="finput" type="number" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} />
            <label className="flabel">Currency</label>
            <select className="fselect" value={cur} onChange={e => setCur(e.target.value)}>
              <option>ETH</option><option>USDC</option><option>DAI</option>
            </select>
            <div className="rate-box">
              <span className="rate-l">You Receive</span>
              <span className="rate-v">{tab === 'buy' ? recv + ' $TTS' : (amt ? (Number(amt)/rate).toFixed(4)+' '+cur : '—')}</span>
            </div>
            <div className="rate-box">
              <span className="rate-l">Rate</span>
              <span className="rate-v" style={{ fontSize:'.82rem' }}>1 ETH = {rate.toLocaleString()} $TTS</span>
            </div>
            <a href={`https://app.uniswap.org/swap?outputCurrency=${TTS_ADDRESS}&chain=base`} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block' }}>
              <button className="pbtn">
                {tab === 'buy' ? 'Buy $TTS on Uniswap' : 'Sell $TTS on Uniswap'}
              </button>
            </a>
            <div className="sub-note">Powered by Uniswap V2 on Base · Contract: {TTS_ADDRESS.slice(0,10)}…</div>
          </>
        )}

        {tab === 'stake' && (
          <>
            <div className="stk-info">
              <div className="stk-title">Staking Tiers</div>
              <div style={{ fontSize:'.58rem', color:'var(--muted)', marginBottom:12, lineHeight:1.65 }}>
                Lock $TTS to earn APR + boosted votes. No early unlock.
              </div>
              <div className="stk-tiers">
                {TIERS.map(t => (
                  <div key={t.label} className={`stk-tier${selTier===t.label?' sel':''}`} onClick={() => setSelTier(t.label)}>
                    <div>
                      <div className={`tn ${t.label}`}>{t.label}</div>
                      <div className="tr2">${t.min}–{t.max===Infinity?'1,000+':t.max} USD eq.</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div className="tboost">{t.boost} Votes</div>
                      <div className="tapr">{t.apr} APR</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <label className="flabel">Amount to Stake ($TTS)</label>
            <input className="finput" type="number" placeholder="Min equivalent of $50 USD" value={amt} onChange={e => setAmt(e.target.value)} />
            <label className="flabel">Lock Period</label>
            <select className="fselect" value={lockPd} onChange={e => setLockPd(e.target.value)}>
              <option>3 months</option><option>6 months</option><option>12 months</option>
            </select>
            <div className="warn-box">⚠ Once staked, funds are locked for the full selected period and cannot be unlocked early under any circumstances whatsoever.</div>
            <a href={`https://basescan.org/address/${STAKING_ADDRESS}#writeContract`} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none', display:'block' }}>
              <button className="pbtn">Stake via BaseScan →</button>
            </a>
            <div className="sub-note">Contract: {STAKING_ADDRESS.slice(0,10)}… · Opens BaseScan Write Contract</div>
          </>
        )}
      </div>
    </div>
  )
}

// ── SUBMIT SCREEN ─────────────────────────────────────────────────────────────
function SubmitScreen({ balance, setBalance, showToast, connected, address, walletClient }) {
  const [prev, setPrev] = useState(null)
  const [name, setName] = useState('')
  const [lt, setLt] = useState('')
  const [lu, setLu] = useState('')
  const [wallet, setWallet] = useState(address || '')
  const [a1, setA1] = useState(false)
  const [a2, setA2] = useState(false)
  const fRef = useRef()

  const [subRemaining, setSubRemaining] = useState(null)
  useEffect(() => {
    if (!address) return
    const ago = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    fetch(`${SUPABASE_URL}/rest/v1/submissions?wallet_address=eq.${address}&created_at=gte.${ago}&select=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(r => r.json()).then(d => { if (Array.isArray(d)) setSubRemaining(3 - d.length) }).catch(() => {})
  }, [address])

  const [nameErr, setNameErr] = useState('')
  const [luErr, setLuErr] = useState('')
  const [walletErr, setWalletErr] = useState('')

  const handleFile = e => {
    const f = e.target.files[0]
    if (!f) return
    if (!['image/jpeg','image/jpg','image/png'].includes(f.type)) { showToast('Only JPEG and PNG accepted','e'); return }
    if (f.size > 10 * 1024 * 1024) { showToast('Image must be under 10MB','e'); return }
    const img = new window.Image()
    const url = URL.createObjectURL(f)
    img.onload = () => {
      URL.revokeObjectURL(url)
      if (img.width < 400 || img.height < 400) { showToast('Minimum image size: 400×400 pixels','e'); return }
      const r = new FileReader()
      r.onload = ev => setPrev(ev.target.result)
      r.readAsDataURL(f)
    }
    img.src = url
  }

  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!connected) { showToast('Connect your wallet first','e'); return }
    if (!walletClient) { showToast('Wallet not ready','e'); return }
    if (!prev) { showToast('Please upload a photo','e'); return }
    if (!name.trim()) { showToast('Enter your display name','e'); return }

    // Input sanitization
    setNameErr(''); setLuErr(''); setWalletErr('')
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(name.trim())) {
      setNameErr('Letters, numbers, underscore only · max 30 chars')
      showToast('Display name: letters, numbers, underscore only (max 30 chars)','e'); return
    }
    if (lu.trim() && !/^https?:\/\/.+/.test(lu.trim())) {
      setLuErr('Must start with http:// or https://')
      showToast('Link URL must start with http:// or https://','e'); return
    }
    if (!wallet.trim() || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) {
      setWalletErr('Must be a valid 0x wallet address')
      showToast('Enter a valid 0x wallet address','e'); return
    }
    if (!a1 || !a2) { showToast('You must agree to all terms','e'); return }
    if (balance < 5) { showToast('Insufficient $TTS — 5 TTS required','e'); return }

    // Rate limiting: max 3 per wallet per week
    const ago = new Date(Date.now() - 7*24*60*60*1000).toISOString()
    const prevSubs = await fetch(`${SUPABASE_URL}/rest/v1/submissions?wallet_address=eq.${address}&created_at=gte.${ago}&select=id`, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }
    }).then(r => r.json()).catch(() => [])
    const used = Array.isArray(prevSubs) ? prevSubs.length : 0
    if (used >= 3) { showToast('You have reached the 3 submissions per week limit','e'); return }

    setSubmitting(true)
    try {
      showToast('Confirm 5 TTS submission fee in wallet…', 's')
      const feeTx = await writeContract(walletClient, TTS_ADDRESS, TTS_ABI, 'transfer', [HOUSE_WALLET, SUBMISSION_FEE])
      showToast('Waiting for fee confirmation…', 's')
      await waitForReceipt(feeTx)
    } catch(e) {
      const msg = e.shortMessage || e.message || 'unknown error'
      showToast('Fee transfer failed: ' + msg.slice(0, 50), 'e')
      setSubmitting(false)
      return
    }

    setBalance(b => b - 5)
    const currentRoundId = await readContract(VOTING_ADDRESS, VOTING_ABI, 'currentRoundId').then(r => r != null ? Number(r) : 1).catch(() => 1)
    try {
      const r = await fetch(SUPABASE_URL + '/rest/v1/submissions', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ round_id: currentRoundId, wallet_address: wallet.trim(), payout_wallet: wallet.trim(), display_name: name.trim(), link_title: lt.trim(), link_url: lu.trim(), image_url: prev, status: 'pending' })
      })
      if (r.ok) {
        showToast('Submission sent for review!', 's')
        setSubRemaining(s => s !== null ? s - 1 : null)
        // Notify admin via Telegram
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), wallet: wallet.trim(), link_url: lu.trim() })
        }).catch(() => {})
      } else showToast('Fee paid — submission queued for review.', 's')
    } catch {
      showToast('Fee paid — submission queued for review.', 's')
    }

    setPrev(null); setName(''); setLt(''); setLu(''); setWallet(''); setA1(false); setA2(false)
    setSubmitting(false)
  }

  return (
    <div>
      <div className="shead"><h2>Submit Profile</h2><div className="grule" /><p>Be voted on · Win $TTS · Promote yourself · 3 per week max</p></div>
      <div className="sub-wrap">
        <input ref={fRef} type="file" accept=".jpg,.jpeg,.png" style={{ display:'none' }} onChange={handleFile} />
        {prev
          ? <>
              <img className="uppreview" src={prev} alt="" draggable="false" onContextMenu={e => e.preventDefault()} />
              <button className="mclose" style={{ marginBottom:13 }} onClick={() => setPrev(null)}>Remove Photo</button>
            </>
          : <div className="upbox" onClick={() => fRef.current?.click()}>
              <span className="upicon">📸</span>
              <div className="uptxt">Tap to upload<br /><strong style={{ color:'var(--gold-dim)' }}>JPEG or PNG only</strong><br />High resolution · SFW required</div>
            </div>
        }
        {subRemaining !== null && (
          <div style={{ background: subRemaining > 0 ? 'rgba(46,204,113,.08)' : 'rgba(232,64,90,.08)', border: `1px solid ${subRemaining > 0 ? 'rgba(46,204,113,.25)' : 'rgba(232,64,90,.25)'}`, borderRadius: 8, padding:'10px 14px', fontSize:'.76rem', color: subRemaining > 0 ? 'var(--green)' : 'var(--rose)', marginBottom:14 }}>
            {subRemaining > 0 ? `✓ ${subRemaining} submission${subRemaining===1?'':'s'} remaining this week` : '✗ Submission limit reached — resets next week'}
          </div>
        )}
        <label className="flabel">Display Name / Handle</label>
        <input className="finput" type="text" placeholder="e.g. Scarlett_V (letters, numbers, _ only)" value={name} onChange={e => { setName(e.target.value); setNameErr('') }} />
        {nameErr && <div style={{ color:'var(--rose)', fontSize:'.7rem', marginTop:-8, marginBottom:8 }}>⚠ {nameErr}</div>}
        <label className="flabel">Link Button Title</label>
        <input className="finput" type="text" placeholder='e.g. "Follow Me on Instagram"' value={lt} onChange={e => setLt(e.target.value)} />
        <label className="flabel">External Link URL</label>
        <input className="finput" type="url" placeholder="https://yourlink.com" value={lu} onChange={e => { setLu(e.target.value); setLuErr('') }} />
        {luErr && <div style={{ color:'var(--rose)', fontSize:'.7rem', marginTop:-8, marginBottom:8 }}>⚠ {luErr}</div>}
        <label className="flabel">Your Base Wallet Address (prize payouts)</label>
        <input className="finput" type="text" placeholder="0x…" value={wallet} onChange={e => { setWallet(e.target.value); setWalletErr('') }} />
        {walletErr && <div style={{ color:'var(--rose)', fontSize:'.7rem', marginTop:-8, marginBottom:8 }}>⚠ {walletErr}</div>}
        <div className="addr-warn">⚠ Double-check this address. Prizes sent to an incorrect address are permanently lost. We cannot recover misdirected funds.</div>
        <div style={{ fontFamily:'var(--font-d)', fontSize:'1rem', fontStyle:'italic', marginBottom:9 }}>Legal Agreement</div>
        <div className="cbox"><div className="ctxt">{CONTRACT_TEXT}</div></div>
        <label className="chk-row">
          <input type="checkbox" checked={a1} onChange={e => setA1(e.target.checked)} />
          <span className="chk-lbl">I have read and <strong>irrevocably agree</strong> to the Rights Grant and Submission Agreement. I understand this grant is permanent, global, and cannot be revoked.</span>
        </label>
        <label className="chk-row">
          <input type="checkbox" checked={a2} onChange={e => setA2(e.target.checked)} />
          <span className="chk-lbl">I confirm I am 18+ years of age, the Content is SFW compliant, I own all rights to this photo, and I <strong>accept sole responsibility</strong> for the accuracy of my wallet address.</span>
        </label>
        <div className="cost-note"><span>💳</span><span>Submission costs <strong>5 $TTS</strong> — signed on Base blockchain</span></div>
        <div className="support-note">📩 Rejection questions? Contact: <strong style={{ color:'var(--gold-dim)' }}>photos@temptationtoken.io</strong></div>
        <button className="pbtn" onClick={submit} disabled={submitting}>{submitting ? 'Processing…' : 'Sign Contract & Submit (5 $TTS)'}</button>
      </div>
    </div>
  )
}

function ReferScreen({ showToast, connected }) {
  const { address } = useAccount()
  const [copied, setCopied] = useState(false)
  const referralLink = address
    ? `https://app.temptationtoken.io?ref=${address.slice(2,10)}`
    : 'Connect wallet to get your link'

  const copy = () => {
    if (!connected) { showToast('Connect your wallet first','e'); return }
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true)
      showToast('Referral link copied!','s')
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const shareTwitter = () => {
    if (!connected) { showToast('Connect your wallet first','e'); return }
    const txt = encodeURIComponent('Playing Temptation Token — vote on profiles and win $TTS every week. Join with my link and we both get bonus tokens 🔥')
    const url = encodeURIComponent(referralLink)
    window.open(`https://twitter.com/intent/tweet?text=${txt}&url=${url}`, '_blank')
  }

  const shareTelegram = () => {
    if (!connected) { showToast('Connect your wallet first','e'); return }
    const txt = encodeURIComponent('Vote on profiles and win $TTS every week. Join with my link and we both get bonus tokens 🔥')
    const url = encodeURIComponent(referralLink)
    window.open(`https://t.me/share/url?url=${url}&text=${txt}`, '_blank')
  }

  return (
    <div>
      <div className="shead"><h2>Refer & Earn</h2><div className="grule"/><p>Earn $TTS for every friend you bring in. They get a bonus too.</p></div>
      <div style={{padding:'0 16px 32px',display:'flex',flexDirection:'column',gap:20}}>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {[
            {icon:'🔗',title:'Share Your Link',body:'Copy your unique referral link and send it to anyone.'},
            {icon:'👤',title:'Friend Signs Up',body:'They register, connect their wallet, and claim their 100 $TTS sign-up bonus.'},
            {icon:'💰',title:'You Both Earn',body:'You receive 10 $TTS. Your friend gets an extra 10 $TTS on top of their sign-up bonus.'},
            {icon:'♾️',title:'No Limit',body:'Refer as many people as you want. Every successful referral pays.'},
          ].map((s,i) => (
            <div key={i} style={{display:'flex',gap:14,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,alignItems:'flex-start'}}>
              <div style={{fontSize:'1.5rem',flexShrink:0,width:32,textAlign:'center'}}>{s.icon}</div>
              <div>
                <div style={{fontSize:'.88rem',fontWeight:700,color:'var(--text)',marginBottom:4}}>{s.title}</div>
                <div style={{fontSize:'.8rem',color:'var(--muted)',lineHeight:1.7}}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{background:'linear-gradient(135deg,rgba(212,175,55,.08),rgba(192,37,58,.06))',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
          <div style={{fontSize:'.72rem',letterSpacing:'.14em',textTransform:'uppercase',color:'var(--gold)',fontWeight:700,marginBottom:14}}>Bonus Breakdown</div>
          {[
            ['You (referrer)','+10 $TTS per referral','var(--gold-light)'],
            ['Your friend (new user)','+10 $TTS on top of sign-up bonus','var(--gold-light)'],
            ["Friend's sign-up bonus",'100 $TTS (all new users)','var(--muted)'],
            ['Total your friend receives','110 $TTS on day one','var(--green)'],
          ].map(([l,v,col]) => (
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'10px 0',borderBottom:'1px solid var(--border2)',gap:12}}>
              <span style={{fontSize:'.8rem',color:'var(--muted)',flexShrink:0}}>{l}</span>
              <span style={{fontSize:'.8rem',color:col,fontWeight:600,textAlign:'right'}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
          <div style={{fontSize:'.72rem',letterSpacing:'.14em',textTransform:'uppercase',color:'var(--gold)',fontWeight:700,marginBottom:12}}>Your Referral Link</div>
          <div style={{background:'var(--deep)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',fontSize:'.78rem',color:connected?'var(--text)':'var(--muted)',marginBottom:14,wordBreak:'break-all',lineHeight:1.6}}>
            {referralLink}
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={copy} className="pbtn" style={{flex:1,minWidth:120,padding:'13px 16px',fontSize:'.78rem'}}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
            <button onClick={shareTwitter} style={{flex:1,minWidth:100,padding:'13px 16px',background:'rgba(29,161,242,.15)',border:'1px solid rgba(29,161,242,.3)',color:'#1da1f2',borderRadius:8,fontSize:'.78rem',fontWeight:700,cursor:'pointer'}}>
              𝕏 Share
            </button>
            <button onClick={shareTelegram} style={{flex:1,minWidth:100,padding:'13px 16px',background:'rgba(0,136,204,.15)',border:'1px solid rgba(0,136,204,.3)',color:'#08c',borderRadius:8,fontSize:'.78rem',fontWeight:700,cursor:'pointer'}}>
              ✈️ Telegram
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function HowToWinScreen() {
  const steps = [
    { icon:"🎟️", title:"Sign Up — Get 100 Free $TTS", body:"Every new user gets 100 $TTS automatically on signup. No purchase needed. Use them to vote right away." },
    { icon:"📸", title:"Browse the Photos", body:"Swipe left or right through this week's profiles. Photos are in random order so everyone gets a fair shot." },
    { icon:"🏆", title:"Pick Your Winner", body:"Find the profile you think will get the most votes by Sunday night. That is your bet." },
    { icon:"💰", title:"Vote $TTS on That Profile", body:"Minimum 5 $TTS per vote. No maximum. The more you put on the winning profile, the bigger your edge. Votes cannot be removed." },
    { icon:"👑", title:"Be the Top Voter on the Winning Profile", body:"The player who put the MOST $TTS specifically on the winning profile is the Top Voter." },
    { icon:"💸", title:"Collect Your Prize", body:"Top Voter wins 40% of the winning profile's vote pool. Goes straight to your wallet." },
  ]
  const tips = [
    { t:"Vote Early, Vote Big", b:"Lock in a large vote early. Other players see the total — they will have to outspend you to take the top spot." },
    { t:"Watch the Leaderboard", b:"Check live standings constantly. If your profile is climbing fast, top up your vote to protect your position." },
    { t:"Stake for an Edge", b:"Stake $TTS in the Buy/Sell tab. Higher tiers multiply your vote weight 1.1x up to 3x — same TTS, more power." },
    { t:"Focus Your TTS", b:"Only the winning profile pays out. TTS you put on losing profiles is burned. Pick one and go all in." },
  ]
  return (
    <div>
      <div className="shead">
        <div style={{display:'inline-block',background:'rgba(212,175,55,.1)',border:'1px solid rgba(212,175,55,.3)',borderRadius:20,padding:'6px 16px',fontSize:'.72rem',letterSpacing:'.1em',color:'var(--gold)',textTransform:'uppercase',fontWeight:700,marginBottom:10}}>
          📖 How to Play · How to Win
        </div>
        <h2>Simple. Strategic. Real Money.</h2>
        <div className="grule"/>
        <p>Read this once. Win $TTS every week.</p>
      </div>
      <div style={{padding:'0 16px',marginBottom:24}}>
        <div style={{fontSize:'.65rem',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)',fontWeight:700,marginBottom:14,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>The 6 Steps</div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {steps.map((s,i) => (
            <div key={i} style={{display:'flex',gap:14,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16,alignItems:'flex-start'}}>
              <div style={{fontSize:'1.6rem',flexShrink:0,width:36,textAlign:'center'}}>{s.icon}</div>
              <div>
                <div style={{fontSize:'.84rem',fontWeight:700,color:'var(--text)',marginBottom:5,lineHeight:1.4}}>Step {i+1} — {s.title}</div>
                <div style={{fontSize:'.76rem',color:'var(--muted)',lineHeight:1.78}}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px',marginBottom:24}}>
        <div style={{fontSize:'.65rem',letterSpacing:'.16em',textTransform:'uppercase',color:'var(--muted)',fontWeight:700,marginBottom:14,paddingBottom:8,borderBottom:'1px solid var(--border)'}}>Winning Tips</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {tips.map((t,i) => (
            <div key={i} style={{background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:15}}>
              <div style={{fontSize:'.82rem',fontWeight:700,color:'var(--gold-light)',marginBottom:6}}>⚡ {t.t}</div>
              <div style={{fontSize:'.76rem',color:'var(--muted)',lineHeight:1.78}}>{t.b}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:'0 16px 32px'}}>
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:20}}>
          <div style={{fontSize:'.84rem',fontWeight:700,color:'var(--text)',marginBottom:14}}>💰 Prize Breakdown — Every Week</div>
          {[
            ["🥇 Top Voter","40% of winning votes","var(--gold-light)"],
            ["📸 Winning Profile","40% of winning votes","var(--gold-light)"],
            ["🏢 Blockchain Ent.","10% to company wallet","var(--muted)"],
            ["💙 Polaris Project","10% to nonprofit","var(--muted)"],
            ["🔥 Losing votes","Burned — maintains token value","var(--muted)"],
          ].map(([l,v,c]) => (
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'11px 0',borderBottom:'1px solid var(--border2)',gap:12}}>
              <span style={{fontSize:'.78rem',fontWeight:600,color:'var(--text)',flexShrink:0}}>{l}</span>
              <span style={{fontSize:'.74rem',color:c,textAlign:'right',lineHeight:1.5}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RulesScreen() {
  const rules = [
    { t:'Weekly Voting Cycle', b:'Each week begins Monday 00:00 UTC and ends Sunday 23:59 UTC. Up to 50 approved profiles compete each week. Display order is randomized to prevent bias.' },
    { t:'Voting', b:'Minimum 5 $TTS per vote with no upper limit. You may add more votes at any time during the week but may never remove votes once placed. You may vote on multiple profiles.' },
    { t:'Photo Submissions', b:'Up to 3 submissions per wallet per week. All photos must be SFW — clothed, no nudity, no explicit content. Costs 1 $TTS per submission. Accepted: JPEG, PNG. Photos become property of Blockchain Entertainment LLC upon submission.' },
    { t:'Prize Distribution', b:'Top Voter: 40% of winning pool.\nWinning Profile: 40% of pool.\nBlockchain Entertainment LLC: 10%.\nPolaris Project (501c3): 10%.\nLosing votes are burned permanently.' },
    { t:'Staking', b:'Lock $TTS to earn APR rewards and vote multipliers up to 3x. Once locked, funds cannot be accessed early under any circumstances.' },
    { t:'Fairness & Privacy', b:'Voting is provably fair via Chainlink VRF on Base blockchain. Only your chosen username appears publicly. Blockchain Entertainment LLC reserves the right to disqualify any submission for policy violations without prior notice.' },
  ]
  return (
    <div>
      <div className="shead"><h2>Rules of the Game</h2><div className="grule" /><p>Understand the game · Play with confidence</p></div>
      <div className="rules-wrap">
        {rules.map((r,i) => (
          <div key={i} className="rcard" style={{ animationDelay:`${i*.05}s` }}>
            <div className="rnum">0{i+1}</div>
            <div className="rtitle">{r.t}</div>
            <div className="rbody" style={{ whiteSpace:'pre-line' }}>{r.b}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FAQScreen() {
  const faqs = [
    { q:'What is Temptation Token ($TTS)?', a:'$TTS is the native cryptocurrency of the Temptation Token platform on the Base blockchain. Use it to vote on profiles, submit your own, stake for rewards, and win prizes.' },
    { q:'How do I get $TTS?', a:'New users receive 100 $TTS as a sign-up bonus. You can also buy $TTS via Uniswap on Base. You need ETH on the Base network.' },
    { q:'How do I connect my wallet?', a:'Tap Connect at the top of the app. We support MetaMask, WalletConnect, Trust Wallet, and Coinbase Wallet. Ensure you are on the Base network.' },
    { q:'Can I download the photos?', a:'No. All submitted photos are the exclusive property of Blockchain Entertainment LLC. Right-click saving, drag-saving, and downloading are prohibited by our Terms of Service.' },
    { q:'Can I remove my votes once placed?', a:'No. Votes are final and cannot be removed or reduced once placed. You may add additional votes to any profile at any time during the active round.' },
    { q:'How are winners determined?', a:'A Chainlink VRF provably fair random draw selects the winning profile, weighted by ticket count. Every TTS voted equals one lottery ticket — more votes means better odds but anyone can win.' },
    { q:'What happens to losing votes?', a:'Losing votes are permanently burned on-chain, reducing the total TTS supply every single week.' },
    { q:'When are prizes paid out?', a:'Prizes are distributed automatically via Base smart contract immediately after the round settles. Funds go directly to wallet addresses on file.' },
    { q:'Who is the Polaris Project?', a:'The Polaris Project is a 501(c)(3) nonprofit dedicated to disrupting human trafficking globally. 10% of every weekly prize pool is donated to them.' },
    { q:'Who do I contact for support?', a:'For photo or submission questions email photos@temptationtoken.io. All gameplay notifications are delivered in-app only.' },
  ]
  const [open, setOpen] = useState(null)
  return (
    <div>
      <div className="shead"><h2>FAQ</h2><div className="grule" /><p>Frequently asked questions</p></div>
      <div className="faq-wrap">
        {faqs.map((f,i) => (
          <div key={i} className="faq-item" style={{ animationDelay:`${i*.04}s` }}>
            <div className="faq-q" onClick={() => setOpen(open===i?null:i)}>
              <span className="faq-qt">{f.q}</span>
              <span className={`faq-ch${open===i?' open':''}`}>▾</span>
            </div>
            {open===i && <div className="faq-a">{f.a}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const { address, isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const [tab, setTab] = useState('play')
  const [showWelcome, setShowWelcome] = useState(() => !sessionStorage.getItem('tt_seen'))
  const dismissWelcome = () => { sessionStorage.setItem('tt_seen','1'); setShowWelcome(false) }
  const [balance, setBalance] = useState(0)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const { data: walletClient } = useWalletClient()
  const [showW, setShowW] = useState(false)
  const [transDir, setTransDir] = useState(null)
  const [toast, showToast] = useToast()

  const tabs = [
    { k:'buysell', l:'Buy/Sell' }, { k:'play', l:'Play' }, { k:'leaderboard', l:'Leaderboard' },
    { k:'nfts', l:'NFTs' }, { k:'submit', l:'Submit' }, { k:'refer', l:'Refer' }, { k:'howto', l:'How to Win' }, { k:'faqs', l:'FAQs' },
  ]

  const sp = { balance, setBalance, showToast, connected: isConnected, address, walletClient }

  useEffect(() => {
    if (!isConnected || !address) { setBalance(0); return }
    setBalanceLoading(true)
    readContract(TTS_ADDRESS, TTS_ABI, 'balanceOf', [address])
      .then(raw => { if (raw != null) setBalance(Math.floor(Number(raw) / 1e18)) })
      .finally(() => setBalanceLoading(false))
  }, [isConnected, address])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = S
    document.head.appendChild(style)
    return () => document.head.removeChild(style)
  }, [])

  return (
    <div className="app">
      <div className="wbar">
        <div className="wbar-inner">
          <div className="wlogo">
            <img src="/tts_logo.webp" alt="TTS" />
          </div>
          <div className="wbal">
            <div className="wlabel">Balance</div>
            <div className="wamt">{balanceLoading ? '…' : balance.toLocaleString()}<span>$TTS</span></div>
            {isConnected && <div className="waddr">{shortAddr(address)} · Base</div>}
          </div>
          {isConnected
            ? <div className="wbtns">
                <button className="btn-t" onClick={() => setTransDir('in')}>↓ In</button>
                <button className="btn-t" onClick={() => setTransDir('out')}>↑ Out</button>
              </div>
            : <button className="btn-conn" onClick={() => setShowW(true)}>Connect</button>
          }
        </div>
      </div>

      <div className="nav">
        <div className="nav-inner">
          {tabs.map(t => (
            <button key={t.k} className={`ni${tab===t.k?' active':''}`} onClick={() => setTab(t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      <div className="main">
        {tab==='play'        && <PlayScreen {...sp} />}
        {tab==='leaderboard' && <LeaderboardScreen />}
        {tab==='nfts'        && <NFTScreen />}
        {tab==='buysell'     && <BuySellScreen {...sp} />}
        {tab==='submit'      && <SubmitScreen {...sp} />}
        {tab==='refer'       && <ReferScreen {...sp} />}
        {tab==='rules'       && <RulesScreen />}
        {tab==='howto'       && <HowToWinScreen />}
        {tab==='faqs'        && <FAQScreen />}
      </div>

      {showW && <WalletModal onClose={() => setShowW(false)} showToast={showToast} />}
      {transDir && <TransferModal dir={transDir} onClose={() => setTransDir(null)} showToast={showToast} address={address} walletClient={walletClient} />}

      <TTSChatbot />
      <div className={`toast ${toast.type}${toast.show?' show':''}`}>{toast.msg}</div>

      {showWelcome && (
        <div style={{position:'fixed',inset:0,background:'var(--void)',zIndex:800,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px'}}>
          <img src="/tts_logo.webp" alt="TTS" style={{width:88,height:88,objectFit:'contain',marginBottom:20}} draggable="false"/>
          <div style={{fontFamily:'var(--font-b)',fontSize:'1.7rem',fontWeight:800,color:'var(--text)',marginBottom:8,textAlign:'center'}}>Temptation Token</div>
          <div style={{fontSize:'.82rem',color:'var(--muted)',textAlign:'center',lineHeight:1.7,marginBottom:28,maxWidth:320}}>Vote on profiles. Pick the winner. Earn $TTS every week.</div>
          <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:12,marginBottom:28}}>
            {[["1","Browse & Pick Your Winner","Swipe through photos. Find the one you think wins."],["2","Vote $TTS on That Profile","Minimum 5 $TTS. No limit. Votes are final."],["3","Anyone Can Win","Provably fair Chainlink VRF lottery. More votes = better odds, but anyone can win."]].map(([n,t,b]) => (
              <div key={n} style={{display:'flex',alignItems:'flex-start',gap:14,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:16}}>
                <div style={{fontSize:'1.2rem',fontWeight:800,color:'var(--gold)',flexShrink:0,width:28}}>{n}</div>
                <div style={{fontSize:'.78rem',color:'var(--text)',lineHeight:1.6}}><strong style={{color:'var(--gold-light)',display:'block',marginBottom:3}}>{t}</strong>{b}</div>
              </div>
            ))}
          </div>
          <button onClick={dismissWelcome} style={{background:'linear-gradient(135deg,var(--crimson),#a0203a)',color:'var(--text)',border:'none',borderRadius:10,padding:'18px 40px',fontFamily:'var(--font-b)',fontSize:'.86rem',letterSpacing:'.1em',textTransform:'uppercase',fontWeight:700,cursor:'pointer',width:'100%',maxWidth:340}}>
            Let's Go — Start Playing
          </button>
          <div onClick={dismissWelcome} style={{fontSize:'.68rem',color:'var(--muted)',marginTop:14,cursor:'pointer',textDecoration:'underline'}}>Skip intro</div>
        </div>
      )}
    </div>
  )
}
