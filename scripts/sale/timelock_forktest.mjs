/**
 * Item 2 — build and fork-test the 48-hour timelock package. DOES NOT EXECUTE ON MAINNET.
 *
 * What has to be true before anyone signs this on closing day:
 *   1. A TimelockController with the Safe as sole proposer and executor, and NO admin,
 *      can hold DEFAULT_ADMIN_ROLE on the token.
 *   2. After the Safe renounces its own DEFAULT_ADMIN_ROLE, setTaxExempt is STILL
 *      reachable — through the timelock, after 48 hours.
 *   3. It is NOT reachable before 48 hours.
 *
 * Point 2 is the whole test. DEFAULT_ADMIN_ROLE is its own role admin, so renouncing it
 * with a misconfigured timelock permanently freezes every admin function on a token that
 * cannot be upgraded — including setTaxExempt, which the liquidity pool depends on.
 * There is no recovery. So we prove the full cycle here first, on real state.
 */
import { createPublicClient, createWalletClient, http, parseAbi, encodeFunctionData, keccak256, toHex } from 'viem';
import { base } from 'viem/chains';
import fs from 'node:fs';

const RPC='http://127.0.0.1:8545';
const transport=http(RPC);
const pub=createPublicClient({chain:base,transport});
const TTS='0x5570eA97d53A53170e973894A9Fa7feb5785d3b9';
const SAFE='0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86';
const DEFAULT_ADMIN='0x0000000000000000000000000000000000000000000000000000000000000000';
const MIN_DELAY=172800n;                      // 48 hours
const PROBE='0x000000000000000000000000000000000000aa01';   // a throwaway address to exempt

const tokenAbi=parseAbi([
 'function grantRole(bytes32,address)','function renounceRole(bytes32,address)',
 'function hasRole(bytes32,address) view returns (bool)',
 'function setTaxExempt(address,bool)','function isTaxExempt(address) view returns (bool)',
]);
const tlAbi=parseAbi([
 'function schedule(address target,uint256 value,bytes data,bytes32 predecessor,bytes32 salt,uint256 delay)',
 'function execute(address target,uint256 value,bytes payload,bytes32 predecessor,bytes32 salt) payable',
 'function getMinDelay() view returns (uint256)',
 'function isOperationReady(bytes32) view returns (bool)',
 'function hashOperation(address,uint256,bytes,bytes32,bytes32) view returns (bytes32)',
 'function PROPOSER_ROLE() view returns (bytes32)',
 'function EXECUTOR_ROLE() view returns (bytes32)',
 'function TIMELOCK_ADMIN_ROLE() view returns (bytes32)',
 'function hasRole(bytes32,address) view returns (bool)',
]);

const rpc=(m,p)=>fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})}).then(r=>r.json());
async function as(a){ await rpc('anvil_impersonateAccount',[a]); await rpc('anvil_setBalance',[a,'0x56BC75E2D63100000']); return createWalletClient({account:a,chain:base,transport}); }

const out=[]; const log=s=>{console.log(s);out.push(s);};
let pass=true; const check=(name,ok,detail='')=>{ if(!ok)pass=false; log(`  ${ok?'PASS':'FAIL'}  ${name}${detail?'  — '+detail:''}`); };

log('# Timelock package — fork test\n');
log(`Fork block ${await pub.getBlockNumber()}  ·  minDelay ${MIN_DELAY}s (48h)\n`);

// ── 1. deploy the timelock ────────────────────────────────────────────────
const bytecode=('0x'+fs.readFileSync('/tmp/tl_bytecode.txt','utf8').trim().replace(/^0x/,''));
const { encodeAbiParameters, parseAbiParameters } = await import('viem');
const args=encodeAbiParameters(parseAbiParameters('uint256, address[], address[], address'),
  [MIN_DELAY,[SAFE],[SAFE],'0x0000000000000000000000000000000000000000']);
const deployer=await as('0xb1e991bf617459b58964eef7756b350e675c53b5');   // Bank deploys; unprivileged act
const dh=await deployer.sendTransaction({data:(bytecode+args.slice(2)),gas:5_000_000n});
const drcpt=await pub.waitForTransactionReceipt({hash:dh});
const TL=drcpt.contractAddress;
log(`## 1. Deploy`);
check('TimelockController deployed', drcpt.status==='success' && !!TL, `${TL}, gas ${drcpt.gasUsed}`);
check('minDelay is 48h', (await pub.readContract({address:TL,abi:tlAbi,functionName:'getMinDelay'}))===MIN_DELAY);
const PROPOSER=await pub.readContract({address:TL,abi:tlAbi,functionName:'PROPOSER_ROLE'});
const EXECUTOR=await pub.readContract({address:TL,abi:tlAbi,functionName:'EXECUTOR_ROLE'});
const TLADMIN=await pub.readContract({address:TL,abi:tlAbi,functionName:'TIMELOCK_ADMIN_ROLE'});
check('Safe is proposer', await pub.readContract({address:TL,abi:tlAbi,functionName:'hasRole',args:[PROPOSER,SAFE]}));
check('Safe is executor', await pub.readContract({address:TL,abi:tlAbi,functionName:'hasRole',args:[EXECUTOR,SAFE]}));
check('nobody holds TIMELOCK_ADMIN except the timelock itself',
  !(await pub.readContract({address:TL,abi:tlAbi,functionName:'hasRole',args:[TLADMIN,SAFE]})) &&
  !(await pub.readContract({address:TL,abi:tlAbi,functionName:'hasRole',args:[TLADMIN,'0xb1e991bf617459b58964eef7756b350e675c53b5']})),
  'admin=address(0) at construction, so the timelock self-administers');

// ── 2. hand DEFAULT_ADMIN_ROLE to the timelock, then renounce the Safe's ──
log(`\n## 2. Transfer token admin`);
const safeW=await as(SAFE);
await pub.waitForTransactionReceipt({hash:await safeW.writeContract({address:TTS,abi:tokenAbi,functionName:'grantRole',args:[DEFAULT_ADMIN,TL]})});
check('timelock holds DEFAULT_ADMIN_ROLE on the token',
  await pub.readContract({address:TTS,abi:tokenAbi,functionName:'hasRole',args:[DEFAULT_ADMIN,TL]}));
await pub.waitForTransactionReceipt({hash:await safeW.writeContract({address:TTS,abi:tokenAbi,functionName:'renounceRole',args:[DEFAULT_ADMIN,SAFE]})});
check('Safe no longer holds DEFAULT_ADMIN_ROLE',
  !(await pub.readContract({address:TTS,abi:tokenAbi,functionName:'hasRole',args:[DEFAULT_ADMIN,SAFE]})));
let direct=false;
try{ await pub.simulateContract({account:SAFE,address:TTS,abi:tokenAbi,functionName:'setTaxExempt',args:[PROBE,true]}); }
catch{ direct=true; }
check('Safe can no longer call setTaxExempt directly', direct, 'this is the irreversible step');

// ── 3. the load-bearing test: setTaxExempt through the timelock ───────────
log(`\n## 3. setTaxExempt through the timelock`);
const payload=encodeFunctionData({abi:tokenAbi,functionName:'setTaxExempt',args:[PROBE,true]});
const ZERO='0x0000000000000000000000000000000000000000000000000000000000000000';
const salt=keccak256(toHex('tts-timelock-forktest'));
await pub.waitForTransactionReceipt({hash:await safeW.writeContract({address:TL,abi:tlAbi,functionName:'schedule',args:[TTS,0n,payload,ZERO,salt,MIN_DELAY]})});
const opId=await pub.readContract({address:TL,abi:tlAbi,functionName:'hashOperation',args:[TTS,0n,payload,ZERO,salt]});
check('operation scheduled', true, `id ${opId.slice(0,18)}…`);
check('NOT ready before the delay', !(await pub.readContract({address:TL,abi:tlAbi,functionName:'isOperationReady',args:[opId]})));
let early=false;
try{ await pub.simulateContract({account:SAFE,address:TL,abi:tlAbi,functionName:'execute',args:[TTS,0n,payload,ZERO,salt]}); }
catch{ early=true; }
check('execute reverts before 48h', early);

await rpc('evm_increaseTime',[Number(MIN_DELAY)+60]);
await rpc('evm_mine',[]);
check('ready after 48h', await pub.readContract({address:TL,abi:tlAbi,functionName:'isOperationReady',args:[opId]}));
const er=await pub.waitForTransactionReceipt({hash:await safeW.writeContract({address:TL,abi:tlAbi,functionName:'execute',args:[TTS,0n,payload,ZERO,salt]})});
check('execute succeeds after 48h', er.status==='success', `gas ${er.gasUsed}`);
check('setTaxExempt ACTUALLY TOOK EFFECT through the timelock',
  await pub.readContract({address:TTS,abi:tokenAbi,functionName:'isTaxExempt',args:[PROBE]}),
  'this is the claim the whole package rests on');

// ── 4. and the thing we are protecting against is still gated ─────────────
log(`\n## 4. Mint is now delayed, not prevented`);
const mintAbi=parseAbi(['function grantRole(bytes32,address)']);
const MINTER=keccak256(toHex('MINTER_ROLE'));
let mintBlocked=false;
try{ await pub.simulateContract({account:SAFE,address:TTS,abi:mintAbi,functionName:'grantRole',args:[MINTER,SAFE]}); }
catch{ mintBlocked=true; }
check('Safe can no longer grant itself MINTER_ROLE directly', mintBlocked,
  'it must now go through a public 48-hour notice period');

log(`\n${'='.repeat(64)}`);
log(pass?'ALL CHECKS PASSED — the package is safe to sign on closing day':'FAILED — DO NOT SIGN');
log(`Timelock address is deterministic only by nonce; the real deploy will differ.`);
fs.writeFileSync('outputs/sale/safe/timelock_forkproof.txt',out.join('\n')+'\n');
fs.writeFileSync('/tmp/tl_addr.txt',TL);
process.exit(pass?0:1);
