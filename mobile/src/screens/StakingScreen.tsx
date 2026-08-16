// Staking — live on-chain numbers, read directly from the deployed TTSStaking proxy.
//
// Reads need no wallet, so Expo Go shows the REAL contract state: the funded reward pool,
// total staked, tier thresholds and APRs straight off Base mainnet rather than a table
// copied into the app that can drift from the contract. With an address set, it also
// shows that wallet's position, pending rewards and the 7-day multiplier clock.
//
// stake / unstake / claim are the only wallet-signing actions and stay behind the seam.
//
// The screen also respects STAKING_LIVE. The contracts are deployed and funded, but the
// public launch is a business decision (the announcement is held), and the web app still
// shows "Coming Soon". Mobile must not front-run that — so unless STAKING_LIVE is set,
// this renders the same honest coming-soon state, with the on-chain facts available for
// anyone who wants them.
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl, ActivityIndicator, Linking } from 'react-native'
import { SectionHead } from '../components/SectionHead'
import { Card, Label, Btn, Note, Row } from '../components/Form'
import { AddressGate, AddressChip } from '../components/AddressGate'
import { useWallet } from '../lib/wallet'
import { useTopUp } from '../lib/topup'
import { STAKING_LIVE, FULL_APP_URL } from '../config/features'
import {
  readStakingStats, readStakePosition, readTtsBalance, StakingStats, StakePosition,
  formatTTS, compactTTS, STAKING_ADDRESS,
} from '../lib/chain'
import { colors, sans, serif } from '../theme'

const TIERS = ['Bronze', 'Silver', 'Gold', 'Diamond', 'VIP']
const BOOSTS = ['1.1×', '1.25×', '1.5×', '2×', '3×']
const ELIGIBILITY_DAYS = 7

function countdown(toUnix: number): string {
  const s = Math.max(0, toUnix - Math.floor(Date.now() / 1000))
  if (s === 0) return 'now'
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function StakingScreen({ onConnect }: { onConnect: () => void }) {
  const { address, canTransact } = useWallet()
  const { requireBalance } = useTopUp()
  const [stats, setStats] = useState<StakingStats | null>(null)
  const [pos, setPos] = useState<StakePosition | null>(null)
  const [bal, setBal] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    const s = await readStakingStats()
    if (!s) setFailed(true)
    setStats(s)
    if (address) {
      const [p, b] = await Promise.all([readStakePosition(address), readTtsBalance(address)])
      setPos(p)
      setBal(b)
    } else {
      setPos(null); setBal(null)
    }
    setLoading(false)
    setRefreshing(false)
  }, [address])

  useEffect(() => { load() }, [load])

  const body = (
    <>
      {/* ── Contract-wide facts (no wallet needed) ────────────────────────── */}
      <Card>
        <Label hint="live from Base mainnet">The pool</Label>
        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginVertical: 16 }} />
        ) : failed ? (
          <Note tone="warn">Could not reach Base right now. Pull down to retry.</Note>
        ) : stats ? (
          <>
            <View style={st.bigWrap}>
              <Text style={st.big}>{compactTTS(stats.rewardPool)}</Text>
              <Text style={st.bigUnit}>$TTS reward pool</Text>
            </View>
            <Row k="Total staked" v={`${formatTTS(stats.totalStaked, 0)} $TTS`} />
            <Row k="Status" v={stats.paused ? 'Paused' : 'Open'} vStyle={{ color: stats.paused ? colors.rose : colors.green }} />
            <Note>
              The reward pool is funded, not minted — $TTS has no mint function. Staked principal is
              tracked separately from the reward surplus, so it can never be paid out to anyone else.
            </Note>
          </>
        ) : null}
      </Card>

      {/* ── Tiers, straight off the contract ──────────────────────────────── */}
      <Card>
        <Label hint="on-chain values">Tiers</Label>
        {stats ? (
          stats.thresholds.map((th, i) => {
            const reached = pos ? pos.principal >= th : false
            return (
              <View key={TIERS[i]} style={[st.tier, reached && st.tierOn]}>
                <View style={st.tierHead}>
                  <Text style={[st.tierName, reached && { color: colors.gold }]}>{TIERS[i]}</Text>
                  <Text style={st.tierApr}>{(stats.aprBps[i] / 100).toFixed(0)}% APR</Text>
                </View>
                <View style={st.tierHead}>
                  <Text style={st.tierMeta}>{formatTTS(th, 0)} $TTS</Text>
                  <Text style={st.tierBoost}>{BOOSTS[i]} votes</Text>
                </View>
              </View>
            )
          })
        ) : (
          <Note>Tier data unavailable offline.</Note>
        )}
        <Note>
          Rewards start the moment you stake. The vote multiplier unlocks after {ELIGIBILITY_DAYS} days
          at that amount — adding more restarts the clock. Your principal is never locked.
        </Note>
      </Card>

      {/* ── Your position ─────────────────────────────────────────────────── */}
      {!address ? (
        <AddressGate purpose="Enter your wallet to see your stake, rewards and tier." onConnect={onConnect} />
      ) : (
        <Card>
          <Label>Your position</Label>
          {pos ? (
            <>
              <Row k="Staked" v={`${formatTTS(pos.principal)} $TTS`} />
              <Row k="Wallet balance" v={bal != null ? `${formatTTS(bal)} $TTS` : '—'} />
              <Row
                k="Tier"
                v={pos.tierByAmount >= 0 ? `${TIERS[pos.tierByAmount]} · ${BOOSTS[pos.tierByAmount]}` : 'Below Bronze'}
                vStyle={pos.tierByAmount >= 0 ? { color: colors.gold } : undefined}
              />
              <Row k="APR" v={pos.aprBps ? `${(pos.aprBps / 100).toFixed(0)}%` : '—'} />
              <Row k="Pending rewards" v={`${formatTTS(pos.pending, 4)} $TTS`} />
              {pos.principal > 0n && (
                <Row
                  k="Multiplier unlocks"
                  v={pos.eligibleNow ? 'active' : `in ${countdown(pos.eligibleAt)}`}
                  vStyle={{ color: pos.eligibleNow ? colors.green : colors.goldDim }}
                />
              )}
              {pos.principal === 0n && <Note>Nothing staked from this wallet yet.</Note>}
            </>
          ) : (
            <Note tone="warn">Could not read this wallet&apos;s position. Pull down to retry.</Note>
          )}

          {canTransact ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              {/* Bronze is the entry tier, so it is the floor worth checking against —
                  below it, staking earns the base rate and the user should know they are
                  short before they are bounced by the contract. */}
              <Btn
                onPress={() => {
                  const floor = stats?.thresholds?.[0] ?? 0n
                  if (floor > 0n && !requireBalance({ need: floor, have: bal, action: 'Staking at Bronze' })) return
                  Linking.openURL(FULL_APP_URL)
                }}
              >
                Stake
              </Btn>
              <Btn kind="ghost" onPress={() => Linking.openURL(FULL_APP_URL)}>Unstake</Btn>
              <Btn kind="ghost" onPress={() => Linking.openURL(FULL_APP_URL)}>Claim rewards</Btn>
            </View>
          ) : (
            <>
              <Note tone="gold">
                Staking, unstaking and claiming each need a wallet signature, which this build cannot
                make. Everything above is the real on-chain state for this wallet.
              </Note>
              <Btn kind="ghost" onPress={() => Linking.openURL(FULL_APP_URL)}>Stake in the full app →</Btn>
            </>
          )}
        </Card>
      )}

      <Card>
        <Label>Contract</Label>
        <Text style={st.addr} selectable>{STAKING_ADDRESS}</Text>
        <Btn kind="quiet" onPress={() => Linking.openURL(`https://basescan.org/address/${STAKING_ADDRESS}`)}>
          View on BaseScan →
        </Btn>
      </Card>
    </>
  )

  return (
    <ScrollView
      contentContainerStyle={st.wrap}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load() }} tintColor={colors.gold} />}
    >
      <SectionHead
        eyebrow="Earn"
        title="Staking"
        subtitle={STAKING_LIVE ? 'Stake $TTS, earn $TTS, vote harder' : 'Contracts are live — public launch pending'}
      />
      <AddressChip />
      {!STAKING_LIVE && (
        <Card style={st.soon}>
          <Text style={st.soonTitle}>Coming soon</Text>
          <Text style={st.soonTxt}>
            The staking contracts are deployed, verified and funded on Base — the numbers below are read
            live from them. Staking opens to everyone when the team announces it; nothing here is a
            promise of a date.
          </Text>
        </Card>
      )}
      {body}
    </ScrollView>
  )
}

const st = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 60 },
  bigWrap: { alignItems: 'center', paddingVertical: 10 },
  big: { fontFamily: sans, fontSize: 38, fontWeight: '800', color: colors.goldLight, letterSpacing: -0.5 },
  bigUnit: { fontFamily: sans, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.muted, marginTop: 2 },
  tier: { borderWidth: 1, borderColor: colors.border2, borderRadius: 8, padding: 12, marginBottom: 8 },
  tierOn: { borderColor: colors.gold, backgroundColor: 'rgba(212,175,55,0.06)' },
  tierHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tierName: { fontFamily: serif, fontStyle: 'italic', fontSize: 18, color: colors.text },
  tierApr: { fontFamily: sans, fontSize: 14, fontWeight: '800', color: colors.goldLight },
  tierMeta: { fontFamily: sans, fontSize: 11.5, color: colors.muted, marginTop: 3 },
  tierBoost: { fontFamily: sans, fontSize: 11.5, color: colors.goldDim, marginTop: 3, fontWeight: '700' },
  soon: { borderColor: colors.goldDim, backgroundColor: 'rgba(212,175,55,0.07)' },
  soonTitle: { fontFamily: sans, fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color: colors.gold, fontWeight: '800', marginBottom: 6 },
  soonTxt: { fontFamily: sans, fontSize: 12.5, lineHeight: 19, color: colors.text },
  addr: { fontFamily: sans, fontSize: 11.5, color: colors.goldDim, marginBottom: 4 },
})
