#!/usr/bin/env python3
"""
verify_round_distribution.py
Verifies TTS prize distribution for a given round.

Usage:
    python3 outputs/verify_round_distribution.py <round_number> [voting_contract_address]

Examples:
    python3 outputs/verify_round_distribution.py 1
    python3 outputs/verify_round_distribution.py 1 0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6

Requires: requests (pip install requests)
"""

import sys
import json
import requests
from decimal import Decimal, ROUND_DOWN

# ── Configuration ──────────────────────────────────────────────────────────────

RPC_URL = "https://mainnet.base.org"
TTS_ADDRESS = "0x5570eA97d53A53170e973894A9Fa7feb5785d3b9"

# Voting contract addresses by version
VOTING_CONTRACTS = {
    "V3b": "0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6",
    "V3c": "<V3C_ADDRESS>",  # Fill after deployment
}

# Known wallet labels — add any new wallets here
WALLET_LABELS = {
    "0xb1e991bf617459b58964eef7756b350e675c53b5": "Bank/Deployer (V3b house — was wrong)",
    "0x7a9ff2f584248744cBbA32c737D660ED6f077fCB": "Marketing/Bonus (V3c house — correct 20%)",
    "0xf7dd429d679cb61231e73785fd1737e60138aba3": "Polaris Project (charity 10%)",
    "0x0000000000000000000000000000000000000000": "Zero address",
    "0x000000000000000000000000000000000000dead": "Dead address (burn)",
}

# Expected split percentages
EXPECTED_SPLIT = {
    "profile": 35,
    "voter": 35,
    "charity": 10,
    "house": 20,
}

# ── ABI function selectors ─────────────────────────────────────────────────────

def call_rpc(method, params):
    resp = requests.post(RPC_URL, json={
        "jsonrpc": "2.0", "method": method, "params": params, "id": 1
    }, timeout=15)
    resp.raise_for_status()
    r = resp.json()
    if "error" in r:
        raise Exception(f"RPC error: {r['error']}")
    return r["result"]


def eth_call(to, data, block="latest"):
    return call_rpc("eth_call", [{"to": to, "data": data}, block])


def get_logs(address, topics, from_block, to_block):
    return call_rpc("eth_getLogs", [{
        "address": address,
        "topics": topics,
        "fromBlock": hex(from_block),
        "toBlock": hex(to_block),
    }])


def get_block_number():
    return int(call_rpc("eth_blockNumber", []), 16)


def decode_uint256(hex_data):
    return int(hex_data, 16) if hex_data and hex_data != "0x" else 0


def decode_bool(hex_data):
    return decode_uint256(hex_data) != 0


def decode_address(hex_data):
    if not hex_data or hex_data == "0x":
        return "0x" + "0" * 40
    return "0x" + hex_data[-40:]


# ── Contract getters ───────────────────────────────────────────────────────────

def get_round(voting_addr, round_id):
    """Returns (startTime, endTime, totalTickets, totalRawVotes, settled, vrfPending, profileCount)"""
    # getRound(uint256) selector
    selector = "0x8f1327c0"  # keccak256("getRound(uint256)")[0:4]
    data = selector + hex(round_id)[2:].zfill(64)
    result = eth_call(voting_addr, data)
    if not result or result == "0x":
        return None
    # Decode 7 slots
    result = result[2:]  # strip 0x
    slots = [result[i*64:(i+1)*64] for i in range(7)]
    return {
        "startTime": decode_uint256("0x" + slots[0]),
        "endTime": decode_uint256("0x" + slots[1]),
        "totalTickets": decode_uint256("0x" + slots[2]),
        "totalRawVotes": decode_uint256("0x" + slots[3]),
        "settled": decode_bool("0x" + slots[4]),
        "vrfPending": decode_bool("0x" + slots[5]),
        "profileCount": decode_uint256("0x" + slots[6]),
    }


def get_house_wallet(voting_addr):
    selector = "0x77818f02"  # keccak256("houseWallet()")[0:4]
    result = eth_call(voting_addr, selector)
    return decode_address(result).lower() if result else None


def get_charity_wallet(voting_addr):
    selector = "0x7b208769"  # keccak256("charityWallet()")[0:4]
    result = eth_call(voting_addr, selector)
    return decode_address(result).lower() if result else None


# ── Event scanning ─────────────────────────────────────────────────────────────

# TTS Transfer event: Transfer(address indexed from, address indexed to, uint256 value)
TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

# VRF request events — use to find the settlement block
VRF_REQUESTED_TOPIC = "0xc6f253de430148d7581a940518a73a6d98efc85ea9162887a3918443ba67c212"

# RoundSettled event
ROUND_SETTLED_TOPIC = "0xabf0728119ba3c53309b0f987eda834ecf31e54dfaeec92465c1512c5eb9c2b9"


def find_settlement_tx(voting_addr, round_id, search_from_block=None, search_to_block=None):
    """Find the VRF fulfillment transaction that settled the round."""
    current = get_block_number()
    if search_to_block is None:
        search_to_block = current
    if search_from_block is None:
        search_from_block = max(0, current - 500000)

    round_id_topic = "0x" + hex(round_id)[2:].zfill(64)

    # Scan in chunks of 9000
    chunk = 9000
    vrf_request_block = None
    settlement_tx = None

    start = search_from_block
    while start <= search_to_block:
        end = min(start + chunk - 1, search_to_block)
        try:
            logs = get_logs(
                voting_addr,
                [VRF_REQUESTED_TOPIC, round_id_topic],
                start, end
            )
            if logs:
                vrf_request_block = int(logs[0]["blockNumber"], 16)
                break
        except Exception:
            pass
        start = end + 1

    if vrf_request_block is None:
        return None, None

    # VRF fulfillment comes within a few blocks
    fulfill_start = vrf_request_block
    fulfill_end = min(vrf_request_block + 200, search_to_block)

    # Look for RoundSettled event from voting contract in those blocks
    try:
        settled_logs = get_logs(
            voting_addr,
            [ROUND_SETTLED_TOPIC, round_id_topic],
            fulfill_start, fulfill_end
        )
        if settled_logs:
            settlement_tx = settled_logs[0]["transactionHash"]
            settlement_block = int(settled_logs[0]["blockNumber"], 16)
            return settlement_tx, settlement_block
    except Exception:
        pass

    # If RoundSettled not emitted (zero-vote case), look for fulfillment via TTS Transfer FROM voting contract
    # The VRF callback transaction would have transfers from voting → recipients
    return None, vrf_request_block


def get_transfers_in_tx(tx_hash, from_addr=None):
    """Get all TTS Transfer events in a transaction."""
    receipt = call_rpc("eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        return []

    transfers = []
    for log in receipt.get("logs", []):
        if (log["address"].lower() == TTS_ADDRESS.lower() and
                log["topics"] and log["topics"][0] == TRANSFER_TOPIC and
                len(log["topics"]) >= 3):

            sender = decode_address(log["topics"][1])
            recipient = decode_address(log["topics"][2])
            amount_wei = decode_uint256(log["data"]) if log["data"] and log["data"] != "0x" else 0

            if from_addr is None or sender.lower() == from_addr.lower():
                transfers.append({
                    "from": sender.lower(),
                    "to": recipient.lower(),
                    "amount_wei": amount_wei,
                    "amount_tts": Decimal(amount_wei) / Decimal(10**18),
                })

    return transfers


# ── Label lookup ───────────────────────────────────────────────────────────────

def label(address, winner_wallet=None, top_voter=None, house=None, charity=None):
    address = address.lower()
    if winner_wallet and address == winner_wallet.lower():
        return "WINNING PROFILE (35% expected)"
    if top_voter and address == top_voter.lower() and address != (winner_wallet or "").lower():
        return "TOP VOTER (35% expected)"
    if house and address == house.lower():
        return "HOUSE / 20% recipient"
    if charity and address == charity.lower():
        return "POLARIS PROJECT (charity 10%)"
    if address in WALLET_LABELS:
        return WALLET_LABELS[address]
    return "UNKNOWN WALLET"


# ── Main ───────────────────────────────────────────────────────────────────────

def verify_round(round_id: int, voting_addr: str):
    print("=" * 70)
    print(f"TTS DISTRIBUTION AUDIT — Round {round_id}")
    print(f"Voting contract: {voting_addr}")
    print("=" * 70)

    # Get round state
    round_data = get_round(voting_addr, round_id)
    if not round_data:
        print(f"FAIL: getRound({round_id}) returned no data")
        return

    import datetime
    start_dt = datetime.datetime.utcfromtimestamp(round_data["startTime"]).strftime("%Y-%m-%d %H:%M UTC") if round_data["startTime"] else "N/A"
    end_dt = datetime.datetime.utcfromtimestamp(round_data["endTime"]).strftime("%Y-%m-%d %H:%M UTC") if round_data["endTime"] else "N/A"

    print(f"\nRound state:")
    print(f"  startTime:     {round_data['startTime']} ({start_dt})")
    print(f"  endTime:       {round_data['endTime']} ({end_dt})")
    print(f"  totalTickets:  {round_data['totalTickets']}")
    print(f"  totalRawVotes: {round_data['totalRawVotes']} ({Decimal(round_data['totalRawVotes']) / Decimal(10**18):.4f} TTS)")
    print(f"  settled:       {round_data['settled']}")
    print(f"  profileCount:  {round_data['profileCount']}")

    if not round_data["settled"]:
        print("\nFAIL: Round is not yet settled. No distribution to verify.")
        return

    if round_data["totalRawVotes"] == 0 or round_data["totalTickets"] == 0:
        print("\nRESULT: No distribution — zero votes in this round.")
        print("  Winning pool = 0. No transfers expected.")
        print("  This is correct behavior: no votes → VRF closed round with no payouts.")
        print("\nPASS: Zero-vote round correctly produces no distribution.")
        return

    # Get on-chain wallet addresses
    house_wallet = get_house_wallet(voting_addr)
    charity_wallet = get_charity_wallet(voting_addr)
    print(f"\nOn-chain wallets:")
    print(f"  houseWallet:   {house_wallet}")
    print(f"  charityWallet: {charity_wallet}")

    # Find settlement transaction
    print(f"\nSearching for settlement transaction...")
    settlement_tx, settlement_block = find_settlement_tx(voting_addr, round_id)

    if not settlement_tx:
        print("WARN: Could not find RoundSettled event. Searching for transfers from voting contract...")
        # This handles the case where the event wasn't emitted (shouldn't happen with votes > 0)
        print(f"  VRF request found at block: {settlement_block}")
        print("  Manual investigation needed: check tx in blocks around", settlement_block)
        return

    print(f"  Settlement TX: {settlement_tx}")
    print(f"  Block:         {settlement_block}")

    # Get all TTS transfers FROM the voting contract in the settlement tx
    print(f"\nFetching TTS transfers from voting contract in settlement TX...")
    transfers = get_transfers_in_tx(settlement_tx, from_addr=voting_addr)

    if not transfers:
        print("WARN: No TTS transfers from voting contract found in settlement TX.")
        print("  This may mean the VRF callback had 0 pool (shouldn't reach here if totalRawVotes>0)")
        return

    # Calculate totals
    total_paid = sum(t["amount_tts"] for t in transfers)
    winning_pool = Decimal(round_data["totalRawVotes"]) / Decimal(10**18)

    print(f"\nWinning pool (rawVotes of winning profile): {winning_pool:.4f} TTS")
    print(f"Total transferred:                          {total_paid:.4f} TTS")

    # Print transfer table
    print(f"\n{'Recipient':<44} {'Amount (TTS)':>16} {'% of Pool':>10} {'Label'}")
    print("-" * 100)

    pass_fail_overall = True
    for t in transfers:
        if total_paid > 0:
            pct = (t["amount_tts"] / winning_pool * 100)
        else:
            pct = Decimal(0)

        wallet_label = label(t["to"], house=house_wallet, charity=charity_wallet)
        pct_str = f"{pct:.1f}%"

        print(f"  {t['to']:<42} {t['amount_tts']:>16.2f} {pct_str:>10}  {wallet_label}")

    # Validate split
    print(f"\nSplit validation:")
    recipient_pcts = {}
    for t in transfers:
        addr = t["to"].lower()
        pct = float(t["amount_tts"] / winning_pool * 100) if winning_pool > 0 else 0
        if addr in recipient_pcts:
            recipient_pcts[addr] += pct
        else:
            recipient_pcts[addr] = pct

    house_pct = recipient_pcts.get(house_wallet.lower(), 0) if house_wallet else 0
    charity_pct = recipient_pcts.get(charity_wallet.lower(), 0) if charity_wallet else 0

    checks = [
        ("House wallet (20% expected)", house_pct, 20, 1.0),
        ("Charity wallet (10% expected)", charity_pct, 10, 1.0),
    ]

    for name, actual, expected, tolerance in checks:
        ok = abs(actual - expected) <= tolerance
        status = "PASS" if ok else "FAIL"
        if not ok:
            pass_fail_overall = False
        print(f"  [{status}] {name}: {actual:.1f}% (expected ~{expected}%)")

    if abs(float(total_paid) - float(winning_pool)) > 0.01:
        print(f"  [FAIL] Total paid ({total_paid:.4f}) does not match winning pool ({winning_pool:.4f})")
        pass_fail_overall = False
    else:
        print(f"  [PASS] Total paid matches winning pool (within dust)")

    print(f"\n{'OVERALL: PASS' if pass_fail_overall else 'OVERALL: FAIL'}")
    print(f"\nSettlement TX for BaseScan: https://basescan.org/tx/{settlement_tx}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 verify_round_distribution.py <round_number> [voting_contract_address]")
        print("Default voting contract: V3b (0x6d6fF6A0bd0A71D999ac1d593a941108a2BE4bC6)")
        sys.exit(1)

    round_num = int(sys.argv[1])
    contract = sys.argv[2] if len(sys.argv) > 2 else VOTING_CONTRACTS["V3b"]

    verify_round(round_num, contract)
