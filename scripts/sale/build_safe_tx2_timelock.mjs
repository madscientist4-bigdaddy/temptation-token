/**
 * Emit the two Safe batches for the timelock handover. PARKED — closing-day option.
 *
 * Deliberately TWO files, not one. The grant is reversible while the Safe still holds
 * DEFAULT_ADMIN_ROLE; the renounce is not, and on a token that cannot be upgraded a
 * mistake there freezes setTaxExempt forever. Sign #2, verify the timelock works against
 * live mainnet with a harmless operation, and only then sign #3.
 *
 * Usage: node scripts/sale/build_safe_tx2_timelock.mjs [deployedTimelockAddress]
 */
import { encodeFunctionData, parseAbi, isAddress, getAddress } from 'viem';
import fs from 'node:fs';

const TTS='0x5570eA97d53A53170e973894A9Fa7feb5785d3b9';
const SAFE='0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86';
const DEFAULT_ADMIN='0x0000000000000000000000000000000000000000000000000000000000000000';
// Refuse to emit without the real deployed address. A Safe batch file with a
// placeholder target is a signable artifact pointing at the wrong contract, and
// "I'll fix it before signing" is exactly the assumption that produces a bad signature.
const raw=process.argv[2];
if(!raw || !isAddress(raw)){
  console.error('Usage: node scripts/sale/build_safe_tx2_timelock.mjs <deployedTimelockAddress>');
  console.error('Refusing to emit: a batch file with a placeholder target is signable and wrong.');
  console.error('Deploy the timelock first (see outputs/sale/safe/timelock/README.md), then re-run.');
  process.exit(1);
}
const TL=getAddress(raw);

const abi=parseAbi(['function grantRole(bytes32,address)','function renounceRole(bytes32,address)']);
const batch=(name,desc,txs)=>({version:'1.0',chainId:'8453',createdAt:Date.now(),
  meta:{name,description:desc,txBuilderVersion:'1.16.5',createdFromSafeAddress:SAFE},transactions:txs});

fs.mkdirSync('outputs/sale/safe',{recursive:true});
fs.writeFileSync('outputs/sale/safe/2_timelock_grant.json',JSON.stringify(
  batch('TTS Safe tx #2 — give the timelock token admin',
        'Grants DEFAULT_ADMIN_ROLE on the $TTS token to the 48-hour TimelockController. The Safe keeps its own admin role, so this step is reversible.',
        [{to:TTS,value:'0',data:encodeFunctionData({abi,functionName:'grantRole',args:[DEFAULT_ADMIN,TL]})}]),null,2));

fs.writeFileSync('outputs/sale/safe/3_timelock_renounce.json',JSON.stringify(
  batch('TTS Safe tx #3 — Safe renounces token admin (IRREVERSIBLE)',
        'The Safe gives up DEFAULT_ADMIN_ROLE on the $TTS token. After this, every admin action on the token must go through the 48-hour timelock. This cannot be undone: DEFAULT_ADMIN_ROLE is its own role admin and the token is not upgradeable.',
        [{to:TTS,value:'0',data:encodeFunctionData({abi,functionName:'renounceRole',args:[DEFAULT_ADMIN,SAFE]})}]),null,2));

console.log(`wrote 2_timelock_grant.json and 3_timelock_renounce.json  (timelock ${TL})`);
