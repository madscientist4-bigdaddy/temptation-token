import { createPublicClient, http, parseAbi } from '../node_modules/viem/_esm/index.js'

const client = createPublicClient({
  chain: { id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } } },
  transport: http('https://mainnet.base.org')
})

const VOTING_V2 = '0x4dE347D547C7Ae2CB38c42A8166d29049C24e9DA'
const VRF_COORD = '0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634'

// The 7th constructor arg as uint256
const subIdCandidate = BigInt('0x80b87e0e50c0bc21e9456d9a9302194a84e2495d668b81c32fa4753b850384aa')
console.log('7th arg as uint256:', subIdCandidate.toString())

const subAbi = parseAbi(['function getSubscription(uint256 subId) view returns (uint96 balance, uint64 reqCount, address owner, address[] consumers)'])

// Query with the exact uint256 value
const r = await client.readContract({
  address: VRF_COORD, abi: subAbi, functionName: 'getSubscription', args: [subIdCandidate]
}).catch(e => ({ error: e.shortMessage }))
console.log('\ngetSubscription(7th arg value):', r)

// Also try the lower 64 bits as uint64 subscriptionId
const subIdU64 = BigInt('0x' + '80b87e0e50c0bc21e9456d9a9302194a84e2495d668b81c32fa4753b850384aa'.slice(-16))
console.log('\n7th arg lower 64 bits as uint64:', subIdU64.toString())
const r2 = await client.readContract({
  address: VRF_COORD, abi: subAbi, functionName: 'getSubscription', args: [subIdU64]
}).catch(e => ({ error: e.shortMessage }))
console.log('getSubscription(lower 64 bits):', r2)

// Try the coordinator at slot-2 of keeper too
const VRF2 = '0x6593c7De001fC8542bB1703532EE1e5aA0D458fD'
const r3 = await client.readContract({
  address: VRF2, abi: subAbi, functionName: 'getSubscription', args: [subIdCandidate]
}).catch(e => ({ error: e.shortMessage }))
console.log('\ngetSubscription on 0x6593... with same value:', r3)

// Also: look for any txs TO TTSVotingV2 from known coordinators
// fulfillRandomWords(uint256 requestId, uint256[] randomWords)
console.log('\n--- Looking for fulfillRandomWords calls to V2 ---')
const latest = await client.getBlockNumber()
// Check recent blocks first
for (const fromB of [latest - 1000n, latest - 10000n, latest - 50000n]) {
  const logs = await client.getLogs({
    address: VOTING_V2,
    fromBlock: fromB,
    toBlock: latest,
  }).catch(() => [])
  if (logs.length > 0) {
    console.log(`Found ${logs.length} logs on V2 from block ${fromB}`)
    for (const l of logs.slice(0, 5)) console.log(' ', l.transactionHash, l.topics[0])
    break
  }
}
console.log('done')
