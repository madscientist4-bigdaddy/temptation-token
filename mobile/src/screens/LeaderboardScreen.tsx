// Leaderboard — a faithful port of the web `.lb-list` + prize box: ranked rows with
// medal/rank, thumbnail, name, vote total + share, a crimson→rose progress bar, then the
// 35/35/20/10 prize-split panel. Live profiles from the public API; the round pool comes
// from community-stats. Per-profile on-chain tallies land in the full/dev build.
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, View, Text, Image, RefreshControl, StyleSheet } from 'react-native'
import { SectionHead } from '../components/SectionHead'
import { api } from '../api/client'
import { PLACEHOLDER_PROFILES } from '../lib/placeholder'
import { VoteProfile } from '../components/VoteCard'
import { colors, serif, sans } from '../theme'

const PRIZE = [
  ['🏆 Top Voter', '35% of pool'],
  ['📸 Winning Profile', '35% of pool'],
  ['🏢 Blockchain Ent.', '20% of pool'],
  ['💙 Polaris Project', '10% donation'],
]
const MEDALS = ['🥇', '🥈', '🥉']
const RANK_COLOR = [colors.gold, '#c0c0c0', '#cd7f32']

export function LeaderboardScreen() {
  const [items, setItems] = useState<VoteProfile[]>([])
  const [pool, setPool] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)

  const load = useCallback(async () => {
    try {
      const [pr, stats] = await Promise.all([api.listProfiles(), api.communityStats().catch(() => null)])
      const list = (Array.isArray(pr.profiles) ? pr.profiles : []).map((p) => ({ ...p, votes: 0 }))
      list.sort((a, b) => b.votes - a.votes)
      setItems(list)
      setOffline(false)
      if (stats) setPool(stats.votes_this_round || 0)
    } catch {
      const ph = [...PLACEHOLDER_PROFILES].sort((a, b) => b.votes - a.votes)
      setItems(ph)
      setPool(ph.reduce((s, p) => s + p.votes, 0))
      setOffline(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const maxV = useMemo(() => Math.max(1, ...items.map((p) => p.votes)), [items])

  // Medals are a claim about standings, and until a single vote is cast there are no
  // standings — the order is just whatever the API returned. Awarding gold/silver/bronze
  // to three profiles all sitting on 0 $TTS invents a result the round has not produced.
  const ranked = useMemo(() => items.some((p) => p.votes > 0), [items])

  return (
    <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.gold} />}>
      {/* "Live rankings" flatly contradicted the no-votes-yet line directly beneath it. */}
      <SectionHead
        title="Leaderboard"
        subtitle={ranked ? 'Live rankings · Auto-refreshes every 30s' : 'Auto-refreshes every 30s'}
      />
      <View style={st.colHead}>
        <Text style={st.colTxt}>Profile</Text>
        <Text style={st.colTxt}>Total $TTS</Text>
      </View>
      {offline ? <Text style={st.offline}>Offline preview — showing sample standings</Text> : null}
      {!offline && !loading && items.length > 0 && !ranked ? (
        <Text style={st.offline}>No votes cast yet this round — this is the line-up, not a ranking.</Text>
      ) : null}

      {loading && items.length === 0 ? (
        <Text style={st.msg}>Loading rankings…</Text>
      ) : items.length === 0 ? (
        <Text style={st.msg}>No approved profiles in this round yet.</Text>
      ) : (
        <View style={st.list}>
          {items.map((p, i) => (
            <View key={p.profileId} style={st.row}>
              <Text
                style={[
                  st.rank,
                  {
                    color: ranked && i < 3 && p.votes > 0 ? RANK_COLOR[i] : colors.muted,
                    fontSize: ranked && i < 3 && p.votes > 0 ? 20 : 16,
                  },
                ]}
              >
                {ranked && i < 3 && p.votes > 0 ? MEDALS[i] : i + 1}
              </Text>
              {p.image_url ? (
                <Image source={{ uri: p.image_url }} style={st.thumb} resizeMode="cover" />
              ) : (
                <View style={[st.thumb, st.thumbEmpty]}><Text style={{ fontSize: 20 }}>📸</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={st.name} numberOfLines={1}>{p.display_name || 'Anonymous'}</Text>
                <Text style={st.votes}>
                  <Text style={st.votesNum}>{p.votes.toLocaleString()}</Text> $TTS
                  {pool > 0 && p.votes > 0 ? <Text style={st.share}>  · {Math.round((p.votes / pool) * 100)}%</Text> : null}
                </Text>
                <View style={st.barWrap}>
                  <View style={[st.bar, { width: `${(p.votes / maxV) * 100}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={st.prizeBox}>
        <Text style={st.prizeTitle}>Prize Pool — Current Round{pool > 0 ? ` · ${pool.toLocaleString()} $TTS` : ''}</Text>
        <View style={st.prizeGrid}>
          {PRIZE.map(([l, v]) => (
            <View key={l} style={st.prizeCell}>
              <Text style={st.prizeLabel}>{l}</Text>
              <Text style={st.prizeVal}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const st = StyleSheet.create({
  colHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 13 },
  colTxt: { fontFamily: sans, fontSize: 10, color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  offline: { fontFamily: sans, fontSize: 11, color: colors.muted, textAlign: 'center', marginBottom: 10, fontStyle: 'italic' },
  msg: { color: colors.muted, textAlign: 'center', paddingVertical: 40, fontSize: 13, fontFamily: sans },
  list: { paddingHorizontal: 16, gap: 10 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12,
  },
  rank: { fontFamily: serif, fontWeight: '600', width: 28, textAlign: 'center' },
  thumb: { width: 50, height: 50, borderRadius: 7, borderWidth: 1, borderColor: colors.border },
  thumbEmpty: { backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: sans, fontSize: 15, fontWeight: '700', color: colors.text },
  votes: { fontFamily: sans, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  votesNum: { color: colors.goldLight, fontWeight: '700', fontSize: 13.5 },
  share: { color: colors.muted, fontSize: 11.5 },
  barWrap: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 2, height: 3, marginTop: 6, overflow: 'hidden' },
  bar: { height: 3, backgroundColor: colors.rose, borderRadius: 2 },
  prizeBox: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    marginHorizontal: 16, marginTop: 18, padding: 18,
  },
  prizeTitle: { fontFamily: serif, fontStyle: 'italic', fontSize: 17, color: colors.text, marginBottom: 12 },
  prizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  prizeCell: {
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 7,
    padding: 12, width: '47.5%', flexGrow: 1,
  },
  prizeLabel: { fontFamily: sans, fontSize: 11.5, color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  prizeVal: { fontFamily: sans, fontSize: 14, color: colors.gold, marginTop: 4, fontWeight: '600' },
})
