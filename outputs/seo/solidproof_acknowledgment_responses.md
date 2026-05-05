# Solidproof Finding Acknowledgment Responses
*Copy-paste into each finding's acknowledgment field on the Solidproof portal*
*Go to: app.solidproof.io/projects/temptation-token → Your Findings → Acknowledge*

---

## Medium Findings

### M-1: ERC-20 Zero-Value Transfer / Tax on Zero Amount

**Acknowledgment response:**
```
Acknowledged. We confirm this finding is valid. The transfer() and transferFrom() functions in TTS.sol do not guard against amount == 0 before applying tax logic, which violates EIP-20 compliance requirements.

Fix: We will add `if (amount == 0) return true;` as the first statement in both transfer() and transferFrom(), before any tax calculation. This fix is staged in the pending implementation contract (0xb995b63cdf848b7884cdc51da82e4a80ad02395a). Deployment requires 2/2 Gnosis Safe multisig approval.

Timeline: Next UUPS proxy upgrade cycle — estimated Q3 2026.

Current risk: Low in practice. No external integrations currently send zero-value transfers to TTS. The fix is a correctness improvement.
```

---

### M-2: Centralization Risk — Owner Can Update Wallet Addresses

**Acknowledgment response:**
```
Acknowledged. The owner wallet can update the charityWallet and houseWallet addresses without a timelock. We accept this as a known design decision.

Mitigation in place: The deployer/owner wallet is a Gnosis Safe 2/2 multisig (0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86). Any wallet address change requires both signers. The charity wallet (Polaris Project) and house wallet addresses are publicly visible on BaseScan, providing transparency.

Planned improvement: We will explore adding a 48-hour timelock on wallet address changes in the next contract upgrade to further reduce centralization risk.

Timeline: Considered for Q3–Q4 2026 upgrade.
```

---

### M-3: Integer Division Rounding in Prize Distribution

**Acknowledgment response:**
```
Acknowledged. Integer division in the prize distribution calculation may leave dust amounts (fractions of TTS token) in the contract due to Solidity's floor division behavior.

Assessment: We have verified that the maximum dust per round is less than 1 TTS token — a negligible amount relative to prize pools. No user funds are at risk. The dust accumulates in the contract and is not accessible to any party.

Planned fix: We will implement a "collect remainder" pattern in the distribution logic that assigns any remainder to the house allocation, ensuring the full prize pool is always distributed. This will be included in the next contract upgrade.

Timeline: Next TTSVotingV3b redeployment — estimated after Round 1 settlement.
```

---

## Low Findings

*(Check your specific Solidproof report for exact finding titles — template responses below)*

### L-1: Missing Event Emission

**Acknowledgment response:**
```
Acknowledged. We will add the missing event emission to improve on-chain observability and indexer compatibility. This is a low-risk improvement with no impact on contract functionality or user funds. Will be included in the next deployment.
```

### L-2: Unlocked Pragma / Floating Pragma

**Acknowledgment response:**
```
Acknowledged. We will pin the Solidity compiler version to a fixed release in the next deployment. The current floating pragma does not affect deployed bytecode functionality but is a best practice we will follow going forward.
```

### L-3: Missing Zero-Address Check

**Acknowledgment response:**
```
Acknowledged. We will add zero-address validation for all admin-settable address parameters in the next contract upgrade. While the deployer multisig prevents accidental zero-address assignment in practice, the explicit check improves robustness.
```

### L-4 / L-5: (Generic low finding template)

**Acknowledgment response:**
```
Acknowledged. This is a valid low-severity observation. We have reviewed the finding and confirmed it does not affect current user funds, prize distribution, or contract security. The improvement will be incorporated into the next contract upgrade cycle (estimated Q3 2026).
```

---

## Informational Findings

*(Generic template for all informational findings)*

**Acknowledgment response:**
```
Acknowledged. Thank you for noting this informational item. We have reviewed it and agree it is a code quality or documentation improvement. We will address this in our ongoing codebase maintenance. No immediate security risk.
```

---

## After Acknowledging All Findings

1. Take a screenshot of the acknowledgment confirmation page
2. Save to outputs/legal/ for your records
3. Update trust_page.html "Audit" section to reflect "All findings acknowledged" status
4. Resubmit trust page to Blockaid: blockaid.io → Developer Portal → submit contract + audit URL

---

## KYC Verification (separate from findings)

The Solidproof portal may require KYC (Know Your Customer) for the project founder to complete the full trust certification.

Required documents typically:
- Government-issued photo ID (passport or driver's license)
- Proof of address (utility bill or bank statement, within 3 months)
- Photo of yourself holding the ID (selfie KYC)

Submit via the Solidproof portal under: Your Projects → KYC Verification

This is separate from the audit and does not affect the published audit report. KYC adds a "KYC Verified" badge on the Solidproof listing.
