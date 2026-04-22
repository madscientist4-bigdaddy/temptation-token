import { createPublicClient, http, parseAbi } from '../node_modules/viem/_esm/index.js'

const client = createPublicClient({
  chain: { id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } } },
  transport: http('https://mainnet.base.org')
})

const KEEPER  = '0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48'
const STAKING = '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc'

// Read slots 7-20 to find keyHash, subscriptionId, callbackGasLimit
const slots = await Promise.all(Array.from({length:20},(_, i) => i+7).map(i =>
  client.getStorageAt({ address: KEEPER, slot: `0x${i.toString(16).padStart(64,'0')}` })
))
console.log('Keeper storage slots 7-26:')
slots.forEach((v,i) => console.log(`  [${i+7}]: ${v}`))

// Try common staking function names
const DEPLOYER = '0xb1e991bf617459b58964eef7756b350e675c53b5'
const tryFns = ['getTier', 'tierOf', 'stakingTier', 'userTier', 'getUserTier', 'getMultiplier']
for (const fn of tryFns) {
  const r = await client.readContract({
    address: STAKING,
    abi: parseAbi([`function ${fn}(address) view returns (uint256)`]),
    functionName: fn,
    args: [DEPLOYER]
  }).catch(() => null)
  if (r !== null) console.log(`staking.${fn}(deployer) = ${r}`)
}
console.log('done probing staking')
