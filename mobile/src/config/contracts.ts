// Canonical Base-mainnet addresses — mirror of the web app's top-of-file constants
// and CLAUDE.md. Keep in lockstep; ideally promote to a shared @tts/core package so
// web + mobile import ONE source of truth (see PHASE1_PLAN.md §1).
export const CHAIN_ID = 8453 as const // Base mainnet — the ONLY chain (no testnet)

export const ADDRESSES = {
  ttsToken: '0x5570eA97d53A53170e973894A9Fa7feb5785d3b9',
  votingV3d: '0x783b8cd80b586b723188c93ef94ee1beede617b4',
  roundNFT: '0x0768e862D3AB14d85213BfeF8f1D012E77721da2',
} as const

// Minimal ABIs the mobile app needs (read balance, current round, vote). Full ABIs
// live with the shared core; these are the Phase-1 read/vote subset.
export const TTS_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const

export const VOTING_ABI = [
  { type: 'function', name: 'currentRoundId', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'vote', stateMutability: 'nonpayable', inputs: [{ type: 'string' }, { type: 'uint256' }], outputs: [] },
] as const

// Backend base — the SAME serverless API the web app uses. Mobile is API-compatible;
// no new backend needed for Phase 1.
export const API_BASE = 'https://app.temptationtoken.io'
