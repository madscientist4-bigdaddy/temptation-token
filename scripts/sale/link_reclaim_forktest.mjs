/**
 * Item 5 — reclaim the 43.97 LINK stranded in the retired Chainlink upkeep.
 *
 * The gate was 3+ consecutive clean autopilot settlements. There are four (rounds 9-12,
 * settled 19.6 / 22.4 / 17.3 / 18.3 minutes after close). Chainlink Automation has not
 * performed for ANY upkeep on this registry since 2026-08-05, so the upkeep is dead
 * weight holding a real asset.
 *
 * NOTE: the upkeep admin is the BANK wallet, not the Safe. So this is NOT a Safe batch —
 * it is two Bank transactions, which per CLAUDE.md need Jim's explicit confirmation, and
 * cancelling an upkeep is irreversible. Built and proven here; NOT sent.
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatEther, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';
import fs from 'node:fs';

const RPC='http://127.0.0.1:8545';
const transport=http(RPC);
const pub=createPublicClient({chain:base,transport});
const REG='0xf4bAb6A129164aBa9B113cB96BA4266dF49f8743';
const ID=113446314522587151772280129999432062856069985411437977877707978564657748455208n;
const LINK='0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196';
const BANK='0xb1e991bf617459b58964eef7756b350e675c53b5';
const VRF='0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634';
const SUB=58222014484560539249027457203866883376041731162442592604288474822166186263722n;
const MIN_VRF_LINK=25n*10n**18n;

const reg=parseAbi([
 'function cancelUpkeep(uint256 id)',
 'function withdrawFunds(uint256 id, address to)',
 'function getBalance(uint256) view returns (uint96)',
 'function getUpkeep(uint256) view returns ((address,uint32,bytes,uint96,address,uint64,uint32,uint96,bool,bytes))',
]);
const link=parseAbi(['function balanceOf(address) view returns (uint256)','function transferAndCall(address,uint256,bytes) returns (bool)']);
const vrf=parseAbi(['function getSubscription(uint256) view returns (uint96,uint96,uint64,address,address[])']);

const rpc=(m,p)=>fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})}).then(r=>r.json());
async function as(a){ await rpc('anvil_impersonateAccount',[a]); await rpc('anvil_setBalance',[a,'0x56BC75E2D63100000']); return createWalletClient({account:a,chain:base,transport}); }

const out=[]; const log=s=>{console.log(s);out.push(s);};
let pass=true; const chk=(n,ok,d='')=>{ if(!ok)pass=false; log(`  ${ok?'PASS':'FAIL'}  ${n}${d?'  — '+d:''}`); };

const info=await pub.readContract({address:REG,abi:reg,functionName:'getUpkeep',args:[ID]});
const [target,performGas,,balance,admin,maxValid,lastPerf,,paused]=info;
const [vrfBal]=await pub.readContract({address:VRF,abi:vrf,functionName:'getSubscription',args:[SUB]});
const bankBefore=await pub.readContract({address:LINK,abi:link,functionName:'balanceOf',args:[BANK]});

log('# LINK reclaim — fork test\n');
log(`Upkeep ${ID.toString().slice(0,18)}…`);
log(`  target ${target} (Keeper3)   performGas ${performGas}`);
log(`  balance **${formatEther(balance)} LINK**   admin ${admin}`);
log(`  paused ${paused}   cancelled ${maxValid!==4294967295n}   lastPerformedBlock ${lastPerf}`);
log(`\nVRF subscription: ${formatEther(vrfBal)} LINK   Bank: ${formatEther(bankBefore)} LINK\n`);

log('## Preconditions');
chk('upkeep admin is the Bank wallet', admin.toLowerCase()===BANK.toLowerCase(), 'so this is a Bank tx, not a Safe batch');
// An ACTIVE upkeep reads maxValidBlocknumber = UINT32_MAX (4294967295). Automation
// stores it as a uint32 internally even though getUpkeep returns uint64, so comparing
// against UINT64_MAX reports every live upkeep as already cancelled.
chk('not already cancelled', maxValid===4294967295n, `maxValidBlocknumber ${maxValid} = UINT32_MAX means active`);
chk('VRF subscription already at or above 25 LINK', vrfBal>=MIN_VRF_LINK,
  `${formatEther(vrfBal)} LINK — no top-up needed before withdrawing`);

log('\n## Step 1 — cancelUpkeep (from Bank)');
const w=await as(BANK);
const c=await pub.waitForTransactionReceipt({hash:await w.writeContract({address:REG,abi:reg,functionName:'cancelUpkeep',args:[ID]})});
chk('cancelUpkeep succeeded', c.status==='success', `gas ${c.gasUsed}`);
const after1=await pub.readContract({address:REG,abi:reg,functionName:'getUpkeep',args:[ID]});
const newMaxValid=after1[5];
log(`  maxValidBlocknumber is now ${newMaxValid} (current block ${await pub.getBlockNumber()})`);

log('\n## Step 2 — withdrawFunds must be blocked until the cancellation delay passes');
let blocked=false;
try{ await pub.simulateContract({account:BANK,address:REG,abi:reg,functionName:'withdrawFunds',args:[ID,BANK]}); }
catch(e){ blocked=true; }
chk('withdraw blocked immediately after cancel', blocked, 'Automation enforces a cancellation delay');

const cur=await pub.getBlockNumber();
const need=Number(newMaxValid-cur)+2;
log(`  mining ${need} blocks to pass the delay…`);
await rpc('anvil_mine',['0x'+need.toString(16)]);

log('\n## Step 3 — withdrawFunds (from Bank)');
const wr=await pub.waitForTransactionReceipt({hash:await w.writeContract({address:REG,abi:reg,functionName:'withdrawFunds',args:[ID,BANK]})});
chk('withdrawFunds succeeded', wr.status==='success', `gas ${wr.gasUsed}`);
const bankAfter=await pub.readContract({address:LINK,abi:link,functionName:'balanceOf',args:[BANK]});
const gained=bankAfter-bankBefore;
chk('LINK actually arrived at the Bank', gained>0n, `+${formatEther(gained)} LINK  (Bank ${formatEther(bankBefore)} -> ${formatEther(bankAfter)})`);
chk('recovered the full upkeep balance', gained>=balance-10n**15n, `expected ~${formatEther(balance)}`);
chk('registry balance now zero', (await pub.readContract({address:REG,abi:reg,functionName:'getBalance',args:[ID]}))===0n);

log('\n## What is then available');
const RESERVE=5n*10n**18n;   // the operational floor CLAUDE.md keeps in the Bank
const spendable=bankAfter>RESERVE?bankAfter-RESERVE:0n;
log(`  Bank after withdraw: ${formatEther(bankAfter)} LINK`);
log(`  VRF subscription:    ${formatEther(vrfBal)} LINK (already >= 25, no top-up)`);
log(`  Keeping a ${formatEther(RESERVE)} LINK operational floor leaves **${formatEther(spendable)} LINK** to swap to ETH`);
log(`  A VRF draw costs ~0.000476 LINK, so ${formatEther(vrfBal)} LINK is roughly ${(Number(formatEther(vrfBal))/0.000476/1000).toFixed(0)}k draws — fuel is not the constraint.`);

log(`\n${'='.repeat(64)}`);
log(pass?'ALL CHECKS PASSED — the cancel/withdraw sequence works':'FAILED');
fs.writeFileSync('outputs/sale/safe/5_link_reclaim_forkproof.txt',out.join('\n')+'\n');

// Emit the two Bank transactions as raw calldata — NOT a Safe batch, since the admin is an EOA.
const txs={
  note:'Bank wallet transactions. The upkeep admin is the Bank EOA, not the Safe, so these cannot be executed from the Safe Transaction Builder. Jim signs these directly. cancelUpkeep is IRREVERSIBLE.',
  chainId:8453,
  from:'0xb1e991bf617459b58964eef7756b350e675c53b5 (Bank)',
  transactions:[
    {step:1,to:REG,value:'0',data:encodeFunctionData({abi:reg,functionName:'cancelUpkeep',args:[ID]}),
     description:`Cancel Chainlink upkeep ${ID}. IRREVERSIBLE. The upkeep has not performed since 2026-08-05 and neither has any other upkeep on this registry.`},
    {step:2,to:REG,value:'0',data:encodeFunctionData({abi:reg,functionName:'withdrawFunds',args:[ID,BANK]}),
     description:`Withdraw ${formatEther(balance)} LINK to the Bank wallet. Must wait for the cancellation delay after step 1 — proven on fork to revert if sent too early.`,
     waitBlocksAfterStep1:Number(newMaxValid-cur)}
  ]};
fs.writeFileSync('outputs/sale/safe/5_link_reclaim_bank_txs.json',JSON.stringify(txs,null,2));
console.log('\nwrote outputs/sale/safe/5_link_reclaim_bank_txs.json + forkproof');
process.exit(pass?0:1);
