#!/usr/bin/env bash
# Gate C/D live-fire E2E against the Base Sepolia deployment.
# Robust against Alchemy read-replica lag: explicit gas limits on sends + polling
# reads that wait until the just-mined state is visible before asserting.
set -uo pipefail
cd "$(dirname "$0")"

ALCHEMY_KEY=$(grep '^BASE_RPC_URL=' ../.env | sed -E 's#.*/v2/##')
RPC="https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}"
PK=$(grep -i 'Private key:' .sepolia-deployer.txt | sed -E 's/.*(0x[0-9a-fA-F]+).*/\1/')
ME=0x767651E74c290122Dd8CC934e471fCE091BbC5c2
TTS=0x63892c3f4c3c68Fb00F3C42E608101181Cc775DF
STK=0xaAebcaBb5B0A22A39123b76Ef5f6bD7C985E1765
STUB=0x27E6463E5376f309a20418dFd8307b5b0cFFAd5a
E18=000000000000000000

pass=0; fail=0
ok(){ if [ "$2" = "$3" ]; then echo "✅ PASS  $1 ($2)"; pass=$((pass+1)); else echo "❌ FAIL  $1 — got '$2' want '$3'"; fail=$((fail+1)); fi; }
send(){ cast send --rpc-url "$RPC" --private-key "$PK" --gas-limit 400000 --json "$@" 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);console.log(j.transactionHash+" status="+j.status)}catch{console.log("SEND_ERR")}})'; }
call(){ cast call --rpc-url "$RPC" "$@" 2>&1; }
principal(){ call $STK "getStakeInfo(address)(uint256,uint256)" $ME | sed -n '1p' | sed -E 's/ .*//'; }
# poll getStakeInfo principal until it equals $1 (replica caught up), up to ~40s
wait_principal(){ for i in $(seq 1 20); do [ "$(principal)" = "$1" ] && return 0; sleep 2; done; return 1; }

echo "════════ STEP 0: clean slate check ════════"
echo "starting principal: $(principal)  (expect 0 from prior emergencyWithdraw)"

echo "════════ STEP 1: approve + STEP 2: stake 5,000,000 TTS (VIP by amount) ════════"
send $TTS "approve(address,uint256)" $STK "1000000000$E18"
TX=$(send $STK "stake(uint256)" "5000000$E18"); echo "stake tx: $TX"
wait_principal "5000000$E18" && echo "(state visible)"

echo "════════ STEP 3: getStakeDetails snapshot ════════"
DET=$(call $STK "getStakeDetails(address)(uint256,uint256,bool,int256,uint16,uint256,uint256)" $ME); echo "$DET"
ok "principal = 5,000,000e18"                 "$(echo "$DET"|sed -n '1p'|sed -E 's/ .*//')" "5000000$E18"
ok "eligibleNow = false (7-day gate closed)"  "$(echo "$DET"|sed -n '3p')" "false"
ok "tierByAmount = 4 (VIP)"                    "$(echo "$DET"|sed -n '4p')" "4"
ok "aprBps = 4500 (45% VIP)"                   "$(echo "$DET"|sed -n '5p')" "4500"

echo "════════ STEP 4: getStakingTier reverts 'not eligible' (7-day gate) ════════"
GT=$(call $STK "getStakingTier(address)(uint256)" $ME)
if echo "$GT" | grep -qi "not eligible"; then echo "✅ PASS  getStakingTier reverts 'not eligible'"; pass=$((pass+1)); else echo "❌ FAIL  getStakingTier — $GT"; fail=$((fail+1)); fi

echo "════════ STEP 5: getMultiplier = 1x while gated ════════"
ok "getMultiplier = 1e18 (base)" "$(call $STK "getMultiplier(address)(uint256)" $ME | sed -E 's/ .*//')" "1000000000000000000"

echo "════════ STEP 6: Gate D seam — StubVotingV3d reads through the gate ════════"
ok "tierVoteCap = 500e18 (unstaked fallback via seam)" "$(call $STUB "tierVoteCap(address)(uint256)" $ME | sed -E 's/ .*//')" "500$E18"
ok "multiplierApplied(1000)=1000e18 (1x via seam)"     "$(call $STUB "multiplierApplied(address,uint256)(uint256)" $ME "1000$E18" | sed -E 's/ .*//')" "1000$E18"

echo "════════ STEP 7: reward accrual (~30s) ════════"
sleep 30
PEND=$(call $STK "pendingRewards(address)(uint256)" $ME | sed -E 's/ .*//'); echo "pendingRewards: $PEND"
if [ -n "$PEND" ] && [ "$PEND" != "0" ]; then echo "✅ PASS  rewards accrue (>0)"; pass=$((pass+1)); else echo "❌ FAIL  pendingRewards=0"; fail=$((fail+1)); fi

echo "════════ STEP 8: claim() pays real reward from 10B pool ════════"
BAL0=$(call $TTS "balanceOf(address)(uint256)" $ME | sed -E 's/ .*//')
TX=$(send $STK "claim()"); echo "claim tx: $TX"
for i in $(seq 1 20); do BAL1=$(call $TTS "balanceOf(address)(uint256)" $ME | sed -E 's/ .*//'); [ "$BAL1" != "$BAL0" ] && break; sleep 2; done
if [ "$BAL1" != "$BAL0" ]; then echo "✅ PASS  claim increased balance ($BAL0 → $BAL1)"; pass=$((pass+1)); else echo "❌ FAIL  balance unchanged"; fail=$((fail+1)); fi

echo "════════ STEP 9: partial unstake 1,000,000 → tier drops VIP→Diamond ════════"
TX=$(send $STK "unstake(uint256)" "1000000$E18"); echo "unstake tx: $TX"
wait_principal "4000000$E18" && echo "(state visible)"
DET=$(call $STK "getStakeDetails(address)(uint256,uint256,bool,int256,uint16,uint256,uint256)" $ME)
ok "principal = 4,000,000e18"          "$(echo "$DET"|sed -n '1p'|sed -E 's/ .*//')" "4000000$E18"
ok "tierByAmount = 3 (Diamond)"        "$(echo "$DET"|sed -n '4p')" "3"
ok "aprBps = 3200 (32% Diamond)"       "$(echo "$DET"|sed -n '5p')" "3200"

echo "════════ STEP 10: full unstake remaining 4,000,000 ════════"
TX=$(send $STK "unstake(uint256)" "4000000$E18"); echo "unstake tx: $TX"
wait_principal "0" && echo "(state visible)"
ok "principal = 0 after full unstake" "$(principal)" "0"

echo "════════ STEP 11: emergencyWithdraw — always-open principal exit ════════"
send $STK "stake(uint256)" "100000$E18" >/dev/null
wait_principal "100000$E18" >/dev/null
echo "re-staked principal: $(principal)"
TX=$(send $STK "emergencyWithdraw()"); echo "emergencyWithdraw tx: $TX"
wait_principal "0" >/dev/null
ok "principal = 0 after emergencyWithdraw" "$(principal)" "0"

echo ""
echo "════════ RESULT: $pass passed, $fail failed ════════"
echo "deployer ETH left: $(cast balance $ME --rpc-url "$RPC")"
