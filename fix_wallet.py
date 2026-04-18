import re

with open('src/App.jsx', 'r') as f:
    c = f.read()

# Find and replace connectMetaMask using regex
start = c.find('const connectMetaMask = async')
if start == -1:
    start = c.find('const connectMetaMask =')

end = c.find('const connectWalletConnect', start)

if start > 0 and end > 0:
    c = c[:start] + '''const connectMetaMask = () => {
    onClose()
    open()
  }
  ''' + c[end:]
    print("connectMetaMask fixed")
else:
    print("connectMetaMask not found - already fixed?")

# Fix wallet descriptions
c = c.replace(
    "window.ethereum?.isMetaMask ? 'Detected — ready to connect' : 'Install extension or open in MetaMask browser'",
    "'Tap to connect — desktop & mobile'"
)
c = c.replace(
    "action:() => { showToast('Open this URL inside Trust Wallet app browser', 'e'); onClose() }, live:false",
    "action:connectWalletConnect, live:true"
)
c = c.replace(
    "window.coinbaseWalletExtension ? 'Detected — ready to connect' : 'Install extension or open in Coinbase browser'",
    "'Desktop extension & Coinbase mobile app'"
)

# Wire real contracts
contracts = """
// CONTRACT ADDRESSES
const TTS_ADDRESS     = '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
const VOTING_ADDRESS  = '0x08CEDe65eb4A6DbB6586E59Ff57CdE78e940Eb2D'
const AIRDROP_ADDRESS = '0x214f482ae7DC1C48A4761759Dc70B6545ff36f0f'
const TTS_ABI = ['function balanceOf(address) view returns (uint256)','function approve(address spender, uint256 amount) returns (bool)','function allowance(address owner, address spender) view returns (uint256)']
const AIRDROP_ABI = ['function claim() returns ()','function claimWithReferral(address referrer) returns ()','function hasClaimed(address) view returns (bool)']

async function readContract(address, abi, fn, args) {
  try {
    const { createPublicClient, http, parseAbi } = await import('https://esm.sh/viem@2.21.19')
    const client = createPublicClient({ chain: { id: 8453, name: 'Base', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.base.org'] } } }, transport: http() })
    return await client.readContract({ address, abi: parseAbi(abi), functionName: fn, args: args || [] })
  } catch(e) { console.error('readContract:', e); return null }
}

async function writeContract(walletClient, address, abi, fn, args) {
  const { parseAbi } = await import('https://esm.sh/viem@2.21.19')
  return await walletClient.writeContract({ address, abi: parseAbi(abi), functionName: fn, args: args || [] })
}

"""

if 'TTS_ADDRESS' not in c:
    c = contracts + c
    print("Contracts added")
else:
    print("Contracts already present")

# Real balance
c = c.replace("const [balance, setBalance] = useState(100)", "const [balance, setBalance] = useState(0)")

# Add useWalletClient
if 'useWalletClient' not in c:
    c = c.replace(
        "import { useAccount, useDisconnect } from 'wagmi'",
        "import { useAccount, useDisconnect, useWalletClient } from 'wagmi'"
    )
    print("useWalletClient added")

# Add walletClient to App
if "useWalletClient()" not in c:
    c = c.replace(
        "const [balance, setBalance] = useState(0)",
        "const [balance, setBalance] = useState(0)\n  const { data: walletClient } = useWalletClient()"
    )
    print("walletClient hook added")

# Fetch real balance
if 'readContract(TTS_ADDRESS' not in c:
    effect = "\n  useEffect(() => {\n    if (!isConnected || !address) { setBalance(0); return }\n    readContract(TTS_ADDRESS, TTS_ABI, 'balanceOf', [address]).then(raw => { if (raw != null) setBalance(Math.floor(Number(raw) / 1e18)) })\n  }, [isConnected, address])\n"
    c = c.replace(
        "  useEffect(() => {\n    const style = document.createElement('style')",
        effect + "  useEffect(() => {\n    const style = document.createElement('style')"
    )
    print("Real balance fetch added")

# Pass walletClient via sp
c = c.replace(
    "const sp = { balance, setBalance, showToast, connected: isConnected }",
    "const sp = { balance, setBalance, showToast, connected: isConnected, address, walletClient }"
)

with open('src/App.jsx', 'w') as f:
    f.write(c)

print("DONE")
print("window.ethereum in connect:", 'window.ethereum' in c[c.find('const connectMetaMask'):c.find('const connectMetaMask')+200])
print("TTS_ADDRESS:", 'TTS_ADDRESS' in c)
print("walletClient:", 'walletClient' in c)
print("real balance:", 'readContract(TTS_ADDRESS' in c)
