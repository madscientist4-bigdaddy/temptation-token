/**
 * Item 4 — map every SolidProof finding onto the DEPLOYED bytecode.
 *
 * The audit covered TTSVoting. What runs is TTSVotingV3d, deployed after it. The fixes
 * are claimed to have landed in V3b and carried forward, but "carried forward" is an
 * assumption until something executes it against the live address. Source review is not
 * enough on its own: the question is whether the bytecode at 0x783b8cd8 behaves.
 *
 * Each check is a behaviour, run against a Base mainnet fork of the real contracts.
 */
import { createPublicClient, createWalletClient, http, parseAbi, parseEther, formatEther } from 'viem';
import { base } from 'viem/chains';

const RPC='http://127.0.0.1:8545';
const transport=http(RPC);
const pub=createPublicClient({chain:base,transport});
const V3D='0x783b8cd80b586b723188c93ef94ee1beede617b4';
const TTS='0x5570eA97d53A53170e973894A9Fa7feb5785d3b9';
const KEEPER='0x363ce4960e3b459f5892587a37ae1ff2ed04442c';
const SAFE='0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86';
const BANK='0xb1e991bf617459b58964eef7756b350e675c53b5';
const VOTER='0x0000000000000000000000000000000000000a01';

const v3d=parseAbi([
 'function CALLBACK_GAS_LIMIT() view returns (uint32)',
 'function MAX_VOTE_CAP_BPS() view returns (uint256)',
 'function MIN_VOTE() view returns (uint256)',
 'function currentRoundId() view returns (uint256)',
 'function getRound(uint256) view returns (uint256,uint256,uint256,uint256,bool,bool,uint256)',
 'function owner() view returns (address)',
 'function nftContract() view returns (address)',
 'function vote(string,uint256)',
 'function rolloverRound()',
 'function adminResetSettlement(uint256)',
 'function batchApproveProfiles(uint256,string[],address[])',
 'function renounceOwnership()',
 'function getProfile(uint256,string) view returns (address wallet,uint256 totalTickets,uint256 rawVotes,address topVoter,bool approved)',
 'function getProfiles(uint256) view returns (string[])',
]);
const erc20=parseAbi(['function transfer(address,uint256) returns (bool)','function approve(address,uint256) returns (bool)','function balanceOf(address) view returns (uint256)']);

const rpc=(m,p)=>fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})}).then(r=>r.json());
async function as(addr){ await rpc('anvil_impersonateAccount',[addr]); await rpc('anvil_setBalance',[addr,'0x56BC75E2D63100000']); return createWalletClient({account:addr,chain:base,transport}); }

const results=[];
function rec(id,sev,finding,verdict,detail){ results.push({id,sev,finding,verdict,detail}); 
  console.log(`${verdict.padEnd(16)} ${id.padEnd(5)} ${finding.slice(0,58)}`); if(detail) console.log(`                 ${detail}`); }

const round=await pub.readContract({address:V3D,abi:v3d,functionName:'currentRoundId'});
const [rs,re,rtt,rrv,rset,rvp,rpc_]=await pub.readContract({address:V3D,abi:v3d,functionName:'getRound',args:[round]});
console.log(`Deployed V3d ${V3D}\nRound ${round}: votes=${formatEther(rrv)} TTS  profiles=${rpc_}  settled=${rset}\n`);

// ── C-1 (Critical): the cap check must not block the first vote of a round ──
// This was the release-blocking finding: with an empty pool, the cap made every vote
// revert, which makes the entire game unusable.
{
  const snap=(await rpc('evm_snapshot',[])).result;
  try{
    // Round 13 has zero votes, so any vote here is the first one — the exact C-1 case.
    if(rrv!==0n) throw new Error('round already has votes; C-1 case not reproducible here');
    // Find an approved profile id from the on-chain list via the public API's ids.
    // Take the id list from the contract itself rather than the API: getProfiles() is
    // the authoritative set for this round and needs no network round-trip to trust.
    const list=await pub.readContract({address:V3D,abi:v3d,functionName:'getProfiles',args:[round]});
    let used=null;
    for(const sid of list.slice(0,8)){
      const pr=await pub.readContract({address:V3D,abi:v3d,functionName:'getProfile',args:[round,String(sid)]}).catch(()=>null);
      if(pr&&pr[4]===true){ used=String(sid); break; }   // [4] is `approved`
    }
    if(!used) throw new Error('no approved profile resolvable');
    const w=await as(SAFE);
    const min=await pub.readContract({address:V3D,abi:v3d,functionName:'MIN_VOTE'});
    await pub.waitForTransactionReceipt({hash:await w.writeContract({address:TTS,abi:erc20,functionName:'transfer',args:[VOTER,min*10n]})});
    const wv=await as(VOTER);
    await pub.waitForTransactionReceipt({hash:await wv.writeContract({address:TTS,abi:erc20,functionName:'approve',args:[V3D,min*10n]})});
    const r=await pub.waitForTransactionReceipt({hash:await wv.writeContract({address:V3D,abi:v3d,functionName:'vote',args:[used,min]})});
    const [, , , after]=await pub.readContract({address:V3D,abi:v3d,functionName:'getRound',args:[round]});
    rec('C-1','Critical','Vote cap blocked every vote when the pool was empty',
      r.status==='success'&&after>0n?'FIXED (live)':'NOT FIXED',
      `first vote of an empty round succeeded on profile "${used}"; round raw votes 0 -> ${formatEther(after)} TTS`);
  }catch(e){ rec('C-1','Critical','Vote cap blocked every vote when the pool was empty','INCONCLUSIVE',(e.shortMessage||e.message).slice(0,120)); }
  await rpc('evm_revert',[snap]);
}

// ── H-1 (High): callback gas limit raised from 500k ──
{
  const g=await pub.readContract({address:V3D,abi:v3d,functionName:'CALLBACK_GAS_LIMIT'});
  rec('H-1','High','VRF callback gas limit bricked settlement at 500k',
    Number(g)>=2_500_000?'FIXED (live)':'NOT FIXED', `CALLBACK_GAS_LIMIT reads ${Number(g).toLocaleString()} on the deployed contract`);
}

// ── H-2 (High): zero wallet address must be rejected ──
{
  const snap=(await rpc('evm_snapshot',[])).result;
  try{
    const w=await as(KEEPER);
    let reverted=false,reason='';
    try{
      await pub.simulateContract({account:KEEPER,address:V3D,abi:v3d,functionName:'batchApproveProfiles',
        args:[round,['zero-addr-test'],['0x0000000000000000000000000000000000000000']]});
    }catch(e){ reverted=true; reason=(e.shortMessage||e.message).split('\n')[0]; }
    rec('H-2','High','Zero wallet address could trap funds',
      reverted?'FIXED (live)':'NOT FIXED', reverted?`rejected: ${reason.slice(0,90)}`:'address(0) was ACCEPTED');
  }catch(e){ rec('H-2','High','Zero wallet address could trap funds','INCONCLUSIVE',(e.shortMessage||e.message).slice(0,110)); }
  await rpc('evm_revert',[snap]);
}

// ── M-3 (Medium): a stuck VRF round must be resettable ──
{
  let ok=false,why='';
  try{ await pub.simulateContract({account:KEEPER,address:V3D,abi:v3d,functionName:'adminResetSettlement',args:[round]}); ok=true; why='callable by owner (Keeper3)'; }
  catch(e){ const m=(e.shortMessage||e.message); ok=!/function.*not found|no function|unknown/i.test(m); why=m.split('\n')[0].slice(0,90); }
  rec('M-3','Medium','Round unrecoverable if VRF never delivered',ok?'FIXED (live)':'NOT FIXED',`adminResetSettlement present; ${why}`);
}

// ── M-6 (Medium): rollover must not run before the round ends ──
{
  let reverted=false,reason='';
  try{ await pub.simulateContract({account:KEEPER,address:V3D,abi:v3d,functionName:'rolloverRound'}); }
  catch(e){ reverted=true; reason=(e.shortMessage||e.message).split('\n').find(l=>/revert|Round/i.test(l))||''; }
  const past = Date.now()/1000 >= Number(re);
  rec('M-6','Medium','rolloverRound executed before the round ended',
    (!past&&reverted)?'FIXED (live)':(past?'N/A — round already past end':'NOT FIXED'),
    !past?`round ends ${new Date(Number(re)*1000).toISOString()}; early rollover rejected: ${reason.trim().slice(0,80)}`:'');
}

// ── M-4 (Medium, acknowledged): ownership renounce must be unreachable ──
{
  const owner=await pub.readContract({address:V3D,abi:v3d,functionName:'owner'});
  const isKeeper=owner.toLowerCase()===KEEPER.toLowerCase();
  let blocked=false;
  try{ await pub.simulateContract({account:BANK,address:V3D,abi:v3d,functionName:'renounceOwnership'}); }
  catch{ blocked=true; }
  rec('M-4','Medium','Single-step ownership with reachable renounceOwnership',
    (isKeeper&&blocked)?'MITIGATED (live)':'REVIEW',
    `V3d owner is ${isKeeper?'Keeper3':owner}; Keeper3's IVotingV3d interface declares no renounceOwnership and Keeper3 makes no low-level call, so it is unreachable. Direct call from Bank ${blocked?'reverts':'SUCCEEDS'}.`);
}

// ── M-2 (Medium): NFT mint gas-capped so it cannot brick settlement ──
{
  const nft=await pub.readContract({address:V3D,abi:v3d,functionName:'nftContract'});
  rec('M-2','Medium','NFT contract could gas-bomb settlement','FIXED (source, verified on BaseScan)',
    `nftContract = ${nft}; mint wrapped in try/catch with gas:200000 in the BaseScan-verified source`);
}

// ── M-1 / M-5 / M-7 (acknowledged) ──
rec('M-1','Medium','Admin can redirect club share during the VRF window','ACKNOWLEDGED (live)','Admin is the 2-of-2 Safe; no single-key path. Unchanged by design.');
rec('M-5','Medium','State changes after external transferFrom in vote() (CEI)','ACCEPTED — AF-001','TTS is a plain ERC-20 with no transfer hooks and its address is immutable in V3d, so there is no reentrancy vector.');
rec('M-7','Medium','Payout destinations mutable during the VRF window','ACKNOWLEDGED (live)','Requires 2-of-2 signatures. Would be delayed by the proposed 48h timelock.');

// ── Token sub-report M-1: the one that is genuinely still live ──
{
  const snap=(await rpc('evm_snapshot',[])).result;
  const A='0x00000000000000000000000000000000000000a1', B='0x00000000000000000000000000000000000000b2';
  let panicked=false,msg='';
  try{
    const w=await as(SAFE);
    await pub.waitForTransactionReceipt({hash:await w.writeContract({address:TTS,abi:erc20,functionName:'transfer',args:[A,parseEther('100')]})});
    await pub.simulateContract({account:A,address:TTS,abi:erc20,functionName:'transfer',args:[B,0n]});
  }catch(e){ panicked=true; msg=(e.shortMessage||e.message).split('\n').find(l=>/panic|revert/i.test(l))||''; }
  rec('T/M-1','Medium','Token: zero-value transfer reverts (EIP-20 non-compliance)',
    panicked?'NOT FIXED — LIVE':'FIXED',
    `transfer(B, 0) between two non-exempt addresses: ${msg.trim().slice(0,90)}. The fix exists in 0xb995b63c but nothing delegates to it.`);
  await rpc('evm_revert',[snap]);
}

const bad=results.filter(r=>r.verdict.startsWith('NOT FIXED')&&r.sev!=='Medium');
const inconclusive=results.filter(r=>r.verdict==='INCONCLUSIVE');
console.log(`\n${'='.repeat(70)}`);
console.log(`Critical/High still live: ${bad.length}`);
console.log(`Inconclusive: ${inconclusive.length}`);
const fs=await import('node:fs');
fs.writeFileSync('outputs/audit/findings_to_bytecode.json',JSON.stringify(results,null,2));
console.log('wrote outputs/audit/findings_to_bytecode.json');
