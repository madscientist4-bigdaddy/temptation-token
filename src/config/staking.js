// ── Staking feature config ────────────────────────────────────────────────────
// Production stays "Coming Soon" until BOTH an address is configured AND
// VITE_STAKING_ENABLED=true. Flipping the real UI live is therefore an ENV +
// redeploy change (Jim's explicit deploy approval) — NOT a code rebuild.
//
// Env (Vercel / .env):
//   VITE_STAKING_ENABLED   "true" to show the live UI (default: off)
//   VITE_STAKING_ADDRESS   deployed TTSStaking proxy (mainnet or a test net)
//   VITE_STAKING_TTS       TTS token to approve (default: mainnet TTS)
//   VITE_STAKING_CHAIN_ID  chain the staking contract lives on (default: 8453)
//   VITE_STAKING_RPC       read RPC for staking (default: Base mainnet)
//   VITE_STAKING_EXPLORER  explorer base (default: basescan.org)

const env = import.meta.env || {}

export const STAKING_ADDRESS  = env.VITE_STAKING_ADDRESS  || null
export const STAKING_TTS      = env.VITE_STAKING_TTS      || '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9'
export const STAKING_CHAIN_ID = Number(env.VITE_STAKING_CHAIN_ID || 8453)
export const STAKING_RPC      = env.VITE_STAKING_RPC      || 'https://mainnet.base.org'
export const STAKING_EXPLORER = env.VITE_STAKING_EXPLORER || 'https://basescan.org'

// The single gate. Everything falls back to the honest "Coming Soon" when false.
export const STAKING_ENABLED  = env.VITE_STAKING_ENABLED === 'true' && !!STAKING_ADDRESS

// Constant on-chain params (mirror the contract).
export const MULTIPLIER_ELIGIBILITY_SECONDS = 7 * 24 * 60 * 60 // 7 days

// Human-readable ABI (viem parseAbi) — only what the UI + admin need.
export const STAKING_ABI = [
  // user actions
  'function stake(uint256 amount)',
  'function unstake(uint256 amount)',
  'function claim()',
  'function emergencyWithdraw()',
  // views
  'function getStakeDetails(address user) view returns (uint256 principal, uint256 eligibleAt, bool eligibleNow, int256 tierByAmount, uint16 aprBps, uint256 pending, uint256 claimableNow)',
  'function getStakingTier(address user) view returns (uint256)',
  'function getMultiplier(address user) view returns (uint256)',
  'function pendingRewards(address user) view returns (uint256)',
  'function rewardSurplus() view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function paused() view returns (bool)',
  'function tierThresholdBronze() view returns (uint256)',
  'function tierThresholdSilver() view returns (uint256)',
  'function tierThresholdGold() view returns (uint256)',
  'function tierThresholdDiamond() view returns (uint256)',
  'function tierThresholdVIP() view returns (uint256)',
  'function aprBronze() view returns (uint16)',
  'function aprSilver() view returns (uint16)',
  'function aprGold() view returns (uint16)',
  'function aprDiamond() view returns (uint16)',
  'function aprVip() view returns (uint16)',
  // admin (MANAGER_ROLE — connected wallet must hold it, else use Safe calldata)
  'function setTierThresholds(uint256 bronze, uint256 silver, uint256 gold, uint256 diamond, uint256 vip)',
  'function setAprBps(uint16 bronze, uint16 silver, uint16 gold, uint16 diamond, uint16 vip)',
  'function pause()',
  'function unpause()',
  'function refresh(address user)',
  'function hasRole(bytes32 role, address account) view returns (bool)',
]

// keccak256("MANAGER_ROLE")
export const MANAGER_ROLE = '0x241ecf16d79d0f8dbfb92cbc07fe17840425976cf0667f022fe9877caa831b08'

export const TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Diamond', 'VIP']
export const TIER_BOOSTS = ['1.1×', '1.25×', '1.5×', '2×', '3×']
