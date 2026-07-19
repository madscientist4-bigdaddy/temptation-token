#!/usr/bin/env bash
# Reproduce the pinned OpenZeppelin 4.9.6 dependency set used to build, test,
# flatten, Slither, and BaseScan-verify TTSStaking. Run once from staking/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p vendor
if [ ! -d vendor/openzeppelin-contracts-upgradeable ]; then
  git clone --depth 1 --branch v4.9.6 \
    https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable.git \
    vendor/openzeppelin-contracts-upgradeable
fi
if [ ! -d vendor/openzeppelin-contracts ]; then
  git clone --depth 1 --branch v4.9.6 \
    https://github.com/OpenZeppelin/openzeppelin-contracts.git \
    vendor/openzeppelin-contracts
fi
rm -rf vendor/openzeppelin-contracts-upgradeable/.git \
       vendor/openzeppelin-contracts/.git \
       vendor/openzeppelin-contracts-upgradeable/lib \
       vendor/openzeppelin-contracts/lib
echo "vendor/ ready. Now: forge test"
