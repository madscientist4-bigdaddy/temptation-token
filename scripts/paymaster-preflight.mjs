// Verify the CDP paymaster policy allowlist with a userOp that actually SIMULATES.
// A synthetic sender fails at simulation before policy is evaluated, which makes
// allowlisted and non-allowlisted look identical — i.e. proves nothing.
import { createPublicClient, http, encodeFunctionData, encodeAbiParameters, parseAbi } from 'viem'
import { base } from 'viem/chains'

const URL = process.env.CDP_PAYMASTER_URL
const RPC = process.env.BASE_RPC_URL
const ENTRY = '0x0000000071727De22E5E9d8BAf0edAc6f37da032'   // EntryPoint v0.7
const FACTORY = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a' // Coinbase Smart Wallet factory
const TTS  = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const V3D  = '0x783b8cd80b586b723188c93ef94ee1beede617b4'
const STK  = '0x7848cceEb8613375D36BA3f50dD577B4E6BCfc0d'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const OWNER = '0x000000000000000000000000000000000000bEEF'

const pc = createPublicClient({ chain: base, transport: http(RPC) })
const factoryAbi = parseAbi([
  'function getAddress(bytes[] owners, uint256 nonce) view returns (address)',
  'function createAccount(bytes[] owners, uint256 nonce) returns (address)',
])
const erc20 = parseAbi(['function approve(address spender, uint256 amount)'])
const exec  = parseAbi(['function execute(address target, uint256 value, bytes data)'])

const owners = [encodeAbiParameters([{ type: 'address' }], [OWNER])]
const sender = await pc.readContract({ address: FACTORY, abi: factoryAbi, functionName: 'getAddress', args: [owners, 0n] })
const factoryData = encodeFunctionData({ abi: factoryAbi, functionName: 'createAccount', args: [owners, 0n] })
const code = await pc.getCode({ address: sender })
console.log(`counterfactual sender ${sender}  (deployed: ${code && code !== '0x' ? 'yes' : 'no — using factory/factoryData'})\n`)

const callData = target => encodeFunctionData({
  abi: exec, functionName: 'execute',
  args: [target, 0n, encodeFunctionData({ abi: erc20, functionName: 'approve', args: [V3D, 10n ** 21n] })],
})

async function probe(label, target) {
  const op = {
    sender, nonce: '0x0', callData: callData(target),
    callGasLimit: '0x186a0', verificationGasLimit: '0x7a120', preVerificationGas: '0x11170',
    maxFeePerGas: '0x5f5e100', maxPriorityFeePerGas: '0x5f5e100',
  }
  if (!code || code === '0x') { op.factory = FACTORY; op.factoryData = factoryData }
  const r = await fetch(URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'pm_getPaymasterStubData', params: [op, ENTRY, '0x2105', {}] }),
  })
  const j = await r.json()
  console.log(`  ${label.padEnd(32)} ${j.error ? `DENIED  ${j.error.message}`.slice(0, 110) : `SPONSORED  keys=${Object.keys(j.result || {})}`}`)
}

await probe('ALLOWLISTED  TTS', TTS)
await probe('ALLOWLISTED  V3d', V3D)
await probe('ALLOWLISTED  Staking', STK)
await probe('NOT ALLOWLISTED  USDC', USDC)
