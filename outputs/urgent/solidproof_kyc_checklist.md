# Solidproof KYC Checklist — $600 Verification
**Complete to unlock full Solidproof trust badge and KYC-verified status**

---

## What KYC Unlocks

- "KYC Verified" badge on Solidproof profile (app.solidproof.io/projects/temptation-token)
- Higher trust score on TrustNet (currently 17.92 — KYC adds points)
- Required for CoinGecko trust rating
- Required by many exchanges before listing (Gate.io, MEXC standard requirement)
- Reduces MetaMask/Blockaid warnings

---

## Documents to Prepare

### 1. Government-Issued Photo ID (Passport preferred)
- [ ] **Passport front page** — clear photo, all text readable, no glare
- [ ] **Passport back page** (if it contains any information)
- Alternatively: National ID card (front + back) or Driver's license (front + back)
- Must not be expired
- Must match the name on your company registration

### 2. Self-Portrait / Liveness Check
- [ ] **Photo of yourself holding your ID** next to your face
  - Hold the passport open to your photo page
  - Both your face and the ID text must be clearly visible
  - No filters, no cropping
- [ ] Some KYC providers also require a **selfie video** (5–10 seconds, turning head left/right)
- Good lighting required — natural daylight or well-lit room

### 3. Proof of Address
- [ ] **Utility bill** issued within the last 3 months (electricity, gas, water, internet)
  - Must show your full legal name and home address
  - Must show the billing date
- Alternatively: Bank statement (last 3 months), government-issued letter, or lease agreement
- Screenshots are not accepted — must be original document or high-quality scan

### 4. Company Documents (if registering as Blockchain Entertainment LLC)
- [ ] **Certificate of Formation / Articles of Organization** — the LLC registration document
- [ ] **EIN confirmation letter** (IRS Form CP-575 or 147C)
- [ ] **Operating Agreement** (if Solidproof requests it)
- Note: If KYC is for an individual (not LLC), skip these

---

## Before the Zoom Call (if required)

Some KYC providers require a live verification call:

- [ ] Schedule the call through the Solidproof portal
- [ ] Have all documents open and ready to show on screen
- [ ] Use a device with a working camera
- [ ] Stable internet connection required
- [ ] Prepare to state: full legal name, company name, role, and wallet address used for deployment
- Typical duration: 10–15 minutes
- Language: English

---

## Phone / SMS Verification

- [ ] Have your **mobile phone** ready for SMS
- [ ] The phone number must be in a country supported by Solidproof
- [ ] Do not use VoIP numbers (Twilio, Google Voice) — these are often rejected

---

## Wallet Verification

- [ ] Be prepared to sign a message with the **deployer wallet** `0xb1e991bf617459b58964eef7756b350e675c53b5` to prove ownership
  - This is done in MetaMask: "Sign message" (no gas required)
  - The message will be provided by the Solidproof portal
- [ ] Alternatively: send a small test transaction from the deployer wallet

---

## Steps to Complete on Solidproof Portal

1. Go to: **https://app.solidproof.io/projects/temptation-token**
2. Click "Complete KYC" or "Verify Project"
3. Upload documents in the order listed above
4. Complete liveness check (selfie or video)
5. Pay the $600 KYC fee (usually via credit card or crypto)
6. Wait for review: typically 1–3 business days

---

## After KYC Completes

- [ ] Screenshot the KYC badge on the Solidproof page
- [ ] Update `outputs/trust_page.html` to add "KYC Verified" badge
- [ ] Tell Claude: "Solidproof KYC complete — update trust page and CLAUDE.md"
- [ ] Add KYC badge link to CoinGecko and CMC submissions

---

## Pending Items to Do BEFORE KYC

1. **Acknowledge Medium findings** on the Solidproof portal (they flag unacknowledged findings)
   - Log into Solidproof → Project dashboard → Findings → click Acknowledge on M-1, M-2, M-3
2. **Complete LP lock** (see `outputs/urgent/lp_lock_instructions.md`)
   - Solidproof may ask for LP lock proof during KYC
3. Have the audit report URL ready: `https://app.solidproof.io/projects/temptation-token`

---

## Cost Summary

| Item | Cost |
|------|------|
| KYC Verification | $600 USD |
| Payment method | Credit card or crypto (check portal for accepted currencies) |
| Timing | 1–3 business days after submission |
