/**
 * Replay a Safe Transaction Builder batch, exactly as written, from the Safe address on
 * a Base mainnet fork.
 *
 * The fork test proved the *design*. This proves the *artifact*: the literal calldata in
 * the JSON Jim and Mike will sign. Those are different claims, and only the second one
 * rules out a builder bug — a wrong selector, a stale address, arguments in the wrong
 * order. Run it against a freshly restarted anvil.
 */
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from 'viem';
import { base } from 'viem/chains';
import fs from 'node:fs';

const RPC='http://127.0.0.1:8545';
const transport=http(RPC);
const pub=createPublicClient({chain:base,transport});
const file=process.argv[2]||'outputs/sale/safe/1_liquidity.json';
const batch=JSON.parse(fs.readFileSync(file,'utf8'));
const SAFE=batch.meta.createdFromSafeAddress;
const TTS='0x5570eA97d53A53170e973894A9Fa7feb5785d3b9';
const POOL='0x09E7a7A90b1C4E8Ad69b26417fE88FE30Af31cC8';
const erc20=parseAbi(['function balanceOf(address) view returns (uint256)','function isTaxExempt(address) view returns (bool)']);

const rpc=(m,p)=>fetch(RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:m,params:p})}).then(r=>r.json());

await rpc('anvil_impersonateAccount',[SAFE]);
await rpc('anvil_setBalance',[SAFE,'0x56BC75E2D63100000']);
const w=createWalletClient({account:SAFE,chain:base,transport});

const before=await pub.readContract({address:TTS,abi:erc20,functionName:'balanceOf',args:[SAFE]});
console.log(`Replaying ${batch.transactions.length} transactions from ${SAFE}`);
console.log(`Safe TTS before: ${formatEther(before)}\n`);

let allOk=true;
for(const[i,t]of batch.transactions.entries()){
  let line=`  ${i+1}. to=${t.to.slice(0,10)}… selector=${t.data.slice(0,10)} `;
  try{
    // A plain call to an address with NO CODE succeeds and burns 21k gas. Without this
    // check, an initialize() aimed at a pool that was never deployed reports "ok" and
    // the batch looks healthy while doing nothing. That is exactly what happened on the
    // first run of this verifier.
    const code=await pub.getCode({address:t.to});
    if(!code||code==='0x'){allOk=false;line+=`NO CODE AT TARGET — call would be a silent no-op`;console.log(line);continue;}
    const hash=await w.sendTransaction({to:t.to,data:t.data,value:BigInt(t.value||'0'),gas:10_000_000n});
    const r=await pub.waitForTransactionReceipt({hash});
    if(r.status!=='success'){allOk=false;line+=`REVERTED (gas ${r.gasUsed})`;}
    else line+=`ok (gas ${r.gasUsed})`;
  }catch(e){allOk=false;line+=`THREW: ${(e.shortMessage||e.message).split('\n')[0].slice(0,90)}`;}
  console.log(line);
}

const after=await pub.readContract({address:TTS,abi:erc20,functionName:'balanceOf',args:[SAFE]});
const poolTts=await pub.readContract({address:TTS,abi:erc20,functionName:'balanceOf',args:[POOL]});
const exempt=await pub.readContract({address:TTS,abi:erc20,functionName:'isTaxExempt',args:[POOL]});
console.log(`\nSafe TTS after:  ${formatEther(after)}`);
console.log(`Safe TTS spent:  ${formatEther(before-after)}`);
console.log(`Pool holds:      ${formatEther(poolTts)} TTS`);
console.log(`Pool taxExempt:  ${exempt}`);
console.log(`\n${allOk&&poolTts>0n&&exempt?'BATCH VERIFIED — every transaction succeeded and the pool is funded and tax-exempt':'BATCH FAILED'}`);
process.exit(allOk&&poolTts>0n&&exempt?0:1);
