/**
 * Apply the remaining false-claim fixes to temptationtoken.io. Revision-safe, additive,
 * anchored on exact strings with asserted occurrence counts.
 *
 * The Aug 16 rule, restated: NEVER bulk find/replace. A global chain-name swap is what
 * produced "Temptation Token is on Base mainnet … It is not on Base". Every edit here
 * names the exact string it expects and how many times it expects to see it. If a page
 * has drifted, the edit FAILS LOUDLY rather than half-applying.
 *
 * Two write paths, because two layers render:
 *   post_content  -> core wp/v2 REST (works with the plugin key; WP stores a revision)
 *   _elementor_data -> tts/v1/elementor/{id}, which slashes correctly and rolls back on
 *                      a failed read-back. Elementor is NOT covered by WP revisions, so
 *                      we back up to outputs/wp_backups/ first and verify after.
 *
 * Usage: node scripts/sale/wp_fix_false_claims.mjs [--apply]
 */
import fs from 'node:fs';

const KEY=process.env.TTS_WP_API_KEY;
if(!KEY){ console.error('TTS_WP_API_KEY not set'); process.exit(1); }
const APPLY=process.argv.includes('--apply');
const BASE='https://temptationtoken.io/wp-json';
const H={'X-TTS-API-Key':KEY,'Content-Type':'application/json','User-Agent':'tts-fixer/1'};
const BK='outputs/wp_backups/2026-09-25';

// Each edit: [exactStringToFind, replacement, expectedOccurrences]
// Replacements state what is true. Where a claim cannot be made true, it is removed.
const EDITS={
  52:[
    ['✓ Zero Critical Findings',
     '✓ 1 critical and 3 high findings were raised — all four remediated in a later contract version',1],
    ['✓ Zero High Findings',
     '✓ Re-verified against the deployed bytecode on 2026-09-25 — see the audit page',1],
    ['TrustNet Score: <strong style="color:#c9a84c">17.92</strong>.',
     'TrustNet Score: <strong style="color:#c9a84c">0.01</strong> — KYC has not been completed, which is most of that gap.',1],
    ['Audited by <strong>Solidproof</strong> — a professional blockchain security firm based in Germany (April 2026).',
     'An <strong>earlier version</strong> of the voting contract was audited by <strong>Solidproof</strong> (Germany, 2026). The contract running today was deployed after that audit and has not itself been audited; a re-audit pinned to the live addresses is being arranged.',1],
    ['Three medium-severity findings were identified and acknowledged — fixes are queued for the next contract upgrade.',
     'Three medium-severity findings were acknowledged rather than patched. Note the token contract is <strong>not upgradeable</strong> — it is deployed directly, with no proxy — so what is deployed is permanent.',1],
    // The Elementor layer carries this FAQ block twice (duplicated section); post_content once.
    ['is the first vote-to-earn cryptocurrency game on','is a weekly fan-voting game on',{post_content:1,elementor:2}],
    ['Settlement via Chainlink VRF happens automatically within minutes of round close.',
     'Chainlink VRF selects the winner. Rounds are closed by our own keeper service, typically 17–25 minutes after close; Chainlink Automation has not been the mechanism since August 2026.',1],
    ['Prizes are automatically paid by the smart contract with zero human involvement.',
     'Prizes are paid by the smart contract. Settlement is triggered automatically by our keeper service — rounds 9 through 12 each closed unattended.',1],
    ['Uniswap v2 pool created at $0.01.','Uniswap v2 pool created.',1],
    ['Launch Price: <strong>$0.01 </strong>USD Target Price: <strong>$0.10</strong> USD ','',1],
    ['<p>New users receive $5 in free TTS on signup</p>','<p>New users receive 500 $TTS free on signup — enough for 100 minimum votes</p>',1],
    // FAQPage JSON-LD copies — structured data, read by search and answer engines.
    ['Yes. Audited by Solidproof (April 2026). Zero critical findings. Zero high findings. TrustNet score 17.92. Full report at app.solidproof.io',
     'An earlier version of the voting contract was audited by Solidproof (2026). It raised one critical and three high findings, all remediated in a later version. The contract running today was deployed after that audit and has not itself been audited. Every original finding has been re-tested against the deployed bytecode; results at app.temptationtoken.io/audit. Report at app.solidproof.io',
     {post_content:0,elementor:1}],
    ['Settlement via Chainlink VRF happens automatically within minutes of round close, and a new round begins immediately.',
     'Chainlink VRF selects the winner. Rounds are closed by our own keeper service, typically 17 to 25 minutes after close, and a new round begins immediately.',
     {post_content:0,elementor:1}],
  ],
  1766:[
    ['The contract is audited by Solidproof, the LP is locked for 12 months',
     'An earlier version of the voting contract was audited by Solidproof and the contract running today post-dates that audit, the LP is locked for 12 months',1],
  ],
  1698:[
    ['Solidproof, a recognized smart contract auditor, completed the audit on the TTS token contract with zero critical or high findings. The V3b voting contract audit is in progress and will be published on the same trust page when delivered.',
     'Solidproof audited an earlier version of the voting contract and raised one critical and three high findings, all of which were remediated in a later version. The contract running today was deployed after that audit and has not itself been audited. Every original finding has since been re-tested against the deployed bytecode; the results are published on the audit page.',1],
  ],
  1657:[
    ['Combined with the Solidproof audit on the TTS token contract (zero critical findings), every holder can verify on-chain that no human ever touches the prize money.',
     'Solidproof audited an earlier version of the voting contract; its findings and their status against the code deployed today are published on the audit page. Every holder can verify on-chain that no human hand picks the winner.',1],
  ],
};

const get=async u=>{ const r=await fetch(u,{headers:H}); if(!r.ok) throw new Error(`${r.status} ${u} ${(await r.text()).slice(0,140)}`); return r.json(); };

// _elementor_data is stored as a JSON string, so HTML inside it carries escaped quotes
// (style=\"…\"). A literal with plain quotes silently misses those, which is how the
// first dry run appeared to cover page 52 while leaving the RENDERED page untouched —
// page 52 renders from Elementor, not post_content. Try both spellings explicitly.
const esc=s=>s.replace(/"/g,'\\"');

function applyEdits(text,edits,label){
  const report=[]; let out=text; let fatal=false;
  for(const [find,repl,expectRaw] of edits){
    const expect = (expectRaw && typeof expectRaw==='object') ? (expectRaw[label] ?? 0) : expectRaw;
    // Prefer whichever spelling is actually present; never apply both.
    const variants = [[find,repl],[esc(find),esc(repl)]];
    const hit = variants.find(([f])=>out.includes(f));
    if(!hit){
      // Distinguish "already applied" from "drifted". If the replacement text is present
      // and the original is not, this edit is simply done — which makes the script safe
      // to re-run as a verifier. Treating that as a mismatch is how you end up unable to
      // tell a successful edit from a broken anchor.
      const done = out.includes(repl) || out.includes(esc(repl));
      if(done){ report.push(`  already applied ${label}: "${find.slice(0,44)}…"`); continue; }
      report.push(`  MISMATCH ${label}: 0 occurrences of "${find.slice(0,54)}…" (expected ${expect})`); if(expect) fatal=true; continue;
    }
    const [f,r]=hit;
    const n=out.split(f).length-1;
    if(n!==expect){ report.push(`  MISMATCH ${label}: expected ${expect} occurrence(s) of "${find.slice(0,50)}…", found ${n}`); fatal=true; continue; }
    out=out.split(f).join(r);
    report.push(`  ok ${label}: ${n}x "${find.slice(0,48)}…"${f!==find?' (escaped form)':''}`);
  }
  return {out,report,fatal};
}

let anyFatal=false;
for(const [id,edits] of Object.entries(EDITS)){
  console.log(`\n=== ${id} ===`);
  const core=await get(`${BASE}/wp/v2/${id==='52'?'pages':'posts'}/${id}?context=edit`);
  const el=await get(`${BASE}/tts/v1/elementor/${id}`);
  let elData=el.elementor_data||'';
  if(typeof elData!=='string') elData=JSON.stringify(elData);
  const renders = el.elementor_status==='builder' ? 'elementor' : 'post_content';
  console.log(`  renders from: ${renders}`);

  // Apply to whichever layers actually contain each string. Both are updated when both
  // contain it, so the editor view and the rendered page never disagree.
  const present=(hay,f,r)=>hay.includes(f)||hay.includes(esc(f))||hay.includes(r)||hay.includes(esc(r));
  const c=applyEdits(core.content.raw,edits.filter(([f,r])=>present(core.content.raw,f,r)),'post_content');
  const e=applyEdits(elData,edits.filter(([f,r])=>present(elData,f,r)),'elementor');
  [...c.report,...e.report].forEach(l=>console.log(l));
  const covered=new Set([...edits.filter(([f,r])=>present(core.content.raw,f,r)).map(([f])=>f),
                         ...edits.filter(([f,r])=>present(elData,f,r)).map(([f])=>f)]);
  for(const [f] of edits) if(!covered.has(f)) { console.log(`  NOT FOUND in either layer: "${f.slice(0,64)}…"`); anyFatal=true; }
  if(c.fatal||e.fatal) anyFatal=true;

  if(!APPLY){ console.log('  (dry run — nothing written)'); continue; }
  if(c.fatal||e.fatal){ console.log('  SKIPPING WRITE — mismatch above'); continue; }

  fs.mkdirSync(BK,{recursive:true});
  if(c.out!==core.content.raw){
    fs.writeFileSync(`${BK}/${id}_post_content_BEFORE.html`,core.content.raw);
    const r=await fetch(`${BASE}/wp/v2/${id==='52'?'pages':'posts'}/${id}`,{method:'POST',headers:H,body:JSON.stringify({content:c.out})});
    console.log(`  post_content write: ${r.status}`);
  }
  if(e.out!==elData && elData){
    fs.writeFileSync(`${BK}/${id}_elementor_BEFORE.json`,elData);
    const r=await fetch(`${BASE}/tts/v1/elementor/${id}`,{method:'POST',headers:H,body:JSON.stringify({elementor_data:e.out})});
    const body=await r.text();
    console.log(`  elementor write: ${r.status} ${body.slice(0,120)}`);
  }
}
console.log(anyFatal?'\nSOME EDITS DID NOT MATCH — review before applying':'\nall anchors matched');
process.exit(anyFatal&&!APPLY?1:0);
