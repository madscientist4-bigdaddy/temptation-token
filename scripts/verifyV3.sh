#!/usr/bin/env bash
# Verify TTSVotingV3 on BaseScan (Etherscan V2 API)
# Usage: ETHERSCAN_API_KEY=yourkey bash scripts/verifyV3.sh
#
# Get a free key at: https://etherscan.io/myapikey (works for all chains via V2)
# One key covers Base (chainid 8453) via the unified Etherscan V2 endpoint.
#
# The deployed contract was compiled from git commit 574a36e
# (before NFT changes, before via_ir was added to foundry.toml)

set -e

if [ -z "$ETHERSCAN_API_KEY" ]; then
  echo "ERROR: Set ETHERSCAN_API_KEY first"
  echo "  export ETHERSCAN_API_KEY=your_key_here"
  echo "  Get a free key at https://etherscan.io/myapikey"
  exit 1
fi

DEPLOYED_ADDR="0x49385909a23C97142c600f8d28D11Ba63410b65C"
ORIGINAL_COMMIT="574a36e"

echo "==> Extracting original deployed source from git $ORIGINAL_COMMIT..."
git show "$ORIGINAL_COMMIT:TTSVotingV3.sol" > /tmp/TTSVotingV3_verify.sol

echo "==> Backing up current files..."
cp TTSVotingV3.sol /tmp/TTSVotingV3_current.sol
cp foundry.toml /tmp/foundry_current.toml

echo "==> Restoring original source and removing via_ir (not present at deploy time)..."
cp /tmp/TTSVotingV3_verify.sol TTSVotingV3.sol
grep -v "via_ir" /tmp/foundry_current.toml > foundry.toml

echo "==> Running forge verify-contract..."
forge verify-contract \
  "$DEPLOYED_ADDR" \
  TTSVotingV3 \
  --chain 8453 \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=8453&" \
  --constructor-args "0000000000000000000000005570ea97d53a53170e973894a9fa7feb5785d3b9000000000000000000000000d5d517abe5cf79b7e95ec98db0f0277788aff634dc2f87677b01473c763cb0aee938ed3341512f6057324a584e5944e786144d7080b87e0e50c0bc21e9456d9a9302194a84e2495d668b81c32fa4753b850384aa000000000000000000000000aa12b889ebcc32037bb8684b18df7ed09b2b30fc000000000000000000000000f7dd429d679cb61231e73785fd1737e60138aba3000000000000000000000000b1e991bf617459b58964eef7756b350e675c53b5" \
  --watch

VERIFY_STATUS=$?

echo "==> Restoring current source and foundry.toml..."
cp /tmp/TTSVotingV3_current.sol TTSVotingV3.sol
cp /tmp/foundry_current.toml foundry.toml

if [ $VERIFY_STATUS -eq 0 ]; then
  echo ""
  echo "SUCCESS: https://basescan.org/address/$DEPLOYED_ADDR#code"
else
  echo ""
  echo "If bytecode mismatch error, the deployment used different settings."
  echo "Try adding --via-ir flag to the forge verify-contract command."
fi
