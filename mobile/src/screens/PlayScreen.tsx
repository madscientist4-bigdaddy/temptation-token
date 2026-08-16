// Play / Vote board — the heart of the game. A swipeable carousel of vote cards (paging
// FlatList = the web's swipe carousel), a live round countdown, and a live pool figure
// from community-stats. Profiles come from the public API; per-profile on-chain vote
// tallies are read in the full/dev build (Expo Go shows the live round pool + honest
// zeros until then). Offline → tasteful placeholder profiles so the layout still shows.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native'
import { SectionHead } from '../components/SectionHead'
import { VoteCard, VoteProfile } from '../components/VoteCard'
import { ProfileDetail } from '../components/ProfileDetail'
import { useCountdown } from '../lib/round'
import { api } from '../api/client'
import { PLACEHOLDER_PROFILES } from '../lib/placeholder'
import { colors, sans, MAX_WIDTH } from '../theme'
import { useWallet } from '../lib/wallet'
import { useTopUp } from '../lib/topup'
import { readTtsBalance, formatTTS } from '../lib/chain'
import { ScrollView } from 'react-native'

/** MIN_VOTE on TTSVotingV3d — 5 $TTS, enforced on-chain. */
const MIN_VOTE_TTS = 5n

export function PlayScreen({ onConnect }: { onConnect: () => void }) {
  const { width: screenW } = useWindowDimensions()
  const cardW = Math.min(screenW, MAX_WIDTH) - 32
  const { label: cd, settling } = useCountdown()

  const [profiles, setProfiles] = useState<VoteProfile[]>([])
  const [pool, setPool] = useState(0)
  const [roundId, setRoundId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [idx, setIdx] = useState(0)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [detail, setDetail] = useState<{ p: VoteProfile; rank: number } | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)
  const { address, canTransact } = useWallet()
  const { requireBalance } = useTopUp()
  const [balance, setBalance] = useState<bigint | null>(null)

  useEffect(() => {
    let live = true
    if (!address) { setBalance(null); return }
    readTtsBalance(address).then((b) => { if (live && b != null) setBalance(b) }).catch(() => {})
    return () => { live = false }
  }, [address])

  /**
   * The vote gate. Previously this was `onVote={onConnect}` for everyone, so a funded
   * player tapping Vote got the connect sheet and no explanation.
   *
   * Order matters: identity, then the on-chain minimum, then funds. Checking funds first
   * would tell someone they are short when the real problem is a 2 $TTS entry.
   */
  const handleVote = (p: VoteProfile) => {
    setNote(null)
    if (!address) { onConnect(); return }
    const raw = (amounts[p.profileId] || '').trim()
    const n = Number(raw)
    if (!raw || !isFinite(n) || n <= 0) { setNote('Enter how much $TTS to place first.'); return }
    const wei = BigInt(Math.round(n * 1e6)) * 10n ** 12n
    if (wei < MIN_VOTE_TTS * 10n ** 18n) {
      setNote(`The minimum vote is ${MIN_VOTE_TTS} $TTS — that floor is enforced on-chain.`)
      return
    }
    // Opens the Get-$TTS sheet naming the exact shortfall, and returns false.
    if (!requireBalance({ need: wei, have: balance, action: `Voting ${formatTTS(wei, 0)} $TTS` })) return
    if (!canTransact) {
      setNote(
        `Your ${formatTTS(wei, 0)} $TTS vote is ready, but casting it needs a wallet signature this ` +
        `build cannot make. Finish in the full app — nothing has been charged.`
      )
      return
    }
    setNote('Confirm the vote in your wallet.')
  }

  const load = useCallback(async () => {
    try {
      const [pr, stats] = await Promise.all([
        api.listProfiles(),
        api.communityStats().catch(() => null),
      ])
      const list = Array.isArray(pr.profiles) ? pr.profiles : []
      setProfiles(list.map((p) => ({ ...p, votes: 0 })))
      setOffline(false)
      if (stats) {
        setPool(stats.votes_this_round || 0)
        setRoundId(stats.round_id ?? null)
      }
    } catch {
      // Degrade gracefully — show the layout with clearly-fictional placeholder data.
      setProfiles(PLACEHOLDER_PROFILES)
      setPool(PLACEHOLDER_PROFILES.reduce((s, p) => s + p.votes, 0))
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const maxVotes = useMemo(() => Math.max(1, ...profiles.map((p) => p.votes)), [profiles])

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / cardW)
    if (i !== idx) setIdx(i)
  }

  return (
    <View style={{ flex: 1 }}>
      {/* The whole board scrolls VERTICALLY. Without this the page was exactly one screen
          tall: header (~370pt) + a 3:4 card image (~477pt) already exceeds a 6.1" screen's
          844pt, so the card's own vote section — total votes, the amount field and the
          Vote button — sat below the fold with no way to reach it. Voting was unreachable
          from the Play screen entirely; the only route was photo → detail → Vote.
          A horizontal FlatList nested in a vertical ScrollView is the supported
          combination (perpendicular axes), unlike two lists sharing an axis. */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
      {/* The header sits ABOVE the carousel, not in ListHeaderComponent.
          On a horizontal FlatList the header is laid out along the horizontal axis —
          i.e. beside the cards, at its natural unconstrained width — which pushed the
          title/countdown off the right edge and shoved every profile card off-screen.
          A plain sibling in the vertical parent lays out correctly. */}
      <View>
        <SectionHead
          eyebrow="Live on Base Blockchain"
          title="Vote & Win"
          subtitle="Swipe through profiles · Place $TTS to win 35% of the pool"
        />
        <View style={st.timer}>
          <View style={{ flexShrink: 1 }}>
            <Text style={st.tl}>Round Ends{roundId != null ? ` · Round ${roundId}` : ''}</Text>
            <Text style={st.tv}>{settling ? 'Settling…' : cd}</Text>
          </View>
          <View style={st.liveRow}>
            <View style={st.dot} />
            <Text style={st.liveTxt}>Live</Text>
          </View>
        </View>
        {pool > 0 ? (
          <Text style={st.pool}>Pool this round · {pool.toLocaleString()} $TTS</Text>
        ) : null}
        {offline ? <Text style={st.offline}>Offline preview — showing sample profiles</Text> : null}
      </View>

      <FlatList
        data={loading ? [] : profiles}
        keyExtractor={(p) => p.profileId}
        renderItem={({ item, index }) => (
          <View style={{ width: cardW, paddingHorizontal: 0 }}>
            <VoteCard
              profile={item}
              rank={index + 1}
              total={profiles.length}
              maxVotes={maxVotes}
              amount={amounts[item.profileId] || ''}
              onAmountChange={(v) => setAmounts((a) => ({ ...a, [item.profileId]: v }))}
              onVote={() => handleVote(item)}
              onOpenPhoto={() => setDetail({ p: item, rank: index + 1 })}
              width={cardW}
            />
          </View>
        )}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardW}
        decelerationRate="fast"
        onMomentumScrollEnd={onScrollEnd}
        ref={listRef}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: 40, width: cardW }} />
          ) : (
            <Text style={[st.empty, { width: cardW }]}>No approved profiles in this round yet.</Text>
          )
        }
      />

      {/* The pager lives OUTSIDE the list. As ListFooterComponent it inherited the list's
          horizontal axis and was laid out to the right of the last card — permanently
          off-screen, the same trap the header fell into. */}
      {!loading && profiles.length > 0 ? (
        <View style={st.footer}>
          <Text style={st.count}>{idx + 1} of {profiles.length}</Text>
          <View style={st.dots}>
            {profiles.map((_, i) => (
              <View key={i} style={[st.pageDot, i === idx && st.pageDotActive]} />
            ))}
          </View>
          <Text style={[st.count, { textAlign: 'right' }]}>
            {maxVotes > 1 ? `${Math.round((profiles[idx]?.votes / maxVotes) * 100)}% votes` : '—'}
          </Text>
        </View>
      ) : null}

      {note ? <Text style={st.note}>{note}</Text> : null}
      </ScrollView>

      <ProfileDetail
        profile={detail?.p ?? null}
        rank={detail?.rank ?? 0}
        totalPool={pool}
        onVote={() => { setDetail(null); onConnect() }}
        onClose={() => setDetail(null)}
      />
    </View>
  )
}

const st = StyleSheet.create({
  timer: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 13, marginHorizontal: 16, marginBottom: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  tl: { fontFamily: sans, fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  tv: { fontFamily: sans, fontSize: 20, fontWeight: '800', color: colors.goldLight, letterSpacing: 0.6, marginTop: 2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.rose },
  liveTxt: { fontFamily: sans, fontSize: 11.5, color: colors.rose, letterSpacing: 1, textTransform: 'uppercase' },
  pool: { fontFamily: sans, fontSize: 12, color: colors.goldDim, textAlign: 'center', marginBottom: 10, letterSpacing: 0.6 },
  offline: { fontFamily: sans, fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 10, fontStyle: 'italic' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 40, fontFamily: sans },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  count: { fontFamily: sans, fontSize: 12.5, fontWeight: '800', color: colors.goldLight, letterSpacing: 0.6, minWidth: 66 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(212,175,55,0.22)' },
  pageDotActive: { width: 20, borderRadius: 3, backgroundColor: colors.gold },
  note: {
    fontFamily: sans, fontSize: 12.5, color: colors.goldLight, lineHeight: 19,
    marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: 8,
    backgroundColor: 'rgba(212,175,55,0.08)', borderLeftWidth: 3, borderLeftColor: colors.gold,
  },
})
