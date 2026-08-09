// Referrals — your invite link, the honest rules, and the one-tap share.
//
// The whole flow is API-backed with no signing, so it works fully in Expo Go:
//   • the link is just app.temptationtoken.io/?ref=<your address>
//   • Share is React Native core — no extra dependency, no native config
//   • entering someone else's link calls refer-capture, the same endpoint the web uses
//
// The payout rules are stated plainly rather than sold, because the anti-abuse rules on
// the server WILL reject a chunk of well-meaning referrals (self-referral, wallets funded
// from program wallets, a referee who already has a referrer). Someone who learns those
// rules after inviting ten friends feels cheated; someone who reads them first does not.
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, Share, Linking, Platform } from 'react-native'
import { SectionHead } from '../components/SectionHead'
import { Card, Label, Btn, Note, Field, Row } from '../components/Form'
import { AddressGate, AddressChip } from '../components/AddressGate'
import { useWallet } from '../lib/wallet'
import { api } from '../api/client'
import { isAddress, readTtsBalance, formatTTS } from '../lib/chain'
import { FULL_APP_URL } from '../config/features'
import { colors, sans } from '../theme'

const QUALIFY_TTS = 500

export function ReferralScreen({ onConnect }: { onConnect: () => void }) {
  const { address } = useWallet()
  const [referrer, setReferrer] = useState('')
  const [msg, setMsg] = useState<{ t: string; tone: 'ok' | 'warn' | 'gold' } | null>(null)
  const [busy, setBusy] = useState(false)
  const [bal, setBal] = useState<bigint | null>(null)

  const link = address ? `${FULL_APP_URL}/?ref=${address}` : ''

  const load = useCallback(async () => {
    if (!address) return
    setBal(await readTtsBalance(address))
  }, [address])
  useEffect(() => { load() }, [load])

  if (!address) {
    return (
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <SectionHead eyebrow="Invite" title="Referrals" subtitle="Bring friends into the game" />
        <AddressGate purpose="Your referral link is built from your wallet address — it is how a payout finds you." onConnect={onConnect} />
      </ScrollView>
    )
  }

  const share = async () => {
    try {
      await Share.share({
        message: `Play Temptation Token with me — vote on Base and earn $TTS. ${link}`,
        ...(Platform.OS === 'ios' ? { url: link } : {}),
      })
    } catch { /* user dismissed the sheet */ }
  }

  const submitReferrer = async () => {
    setMsg(null)
    const r = referrer.trim()
    if (!isAddress(r)) { setMsg({ t: 'That is not a valid 0x… address.', tone: 'warn' }); return }
    if (r.toLowerCase() === address.toLowerCase()) {
      setMsg({ t: 'You cannot refer yourself — the server rejects this too.', tone: 'warn' })
      return
    }
    setBusy(true)
    try {
      const res = await api.referCapture(r, address)
      setMsg(
        res?.ok
          ? { t: 'Referrer recorded. They are paid once you cast a qualifying vote.', tone: 'ok' }
          : { t: 'That referral was not accepted — most often because this wallet already has a referrer.', tone: 'warn' }
      )
    } catch {
      setMsg({ t: 'Could not record the referral. Check your connection and retry.', tone: 'warn' })
    } finally { setBusy(false) }
  }

  return (
    <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
      <SectionHead eyebrow="Invite" title="Referrals" subtitle="Bring friends into the game" />
      <AddressChip />

      <Card>
        <Label>Your link</Label>
        <View style={st.linkBox}>
          <Text style={st.link} selectable numberOfLines={2}>{link}</Text>
        </View>
        <Btn onPress={share}>Share my link</Btn>
        <Btn kind="quiet" onPress={() => Linking.openURL(link)}>Open it in a browser</Btn>
      </Card>

      <Card>
        <Label>How it pays</Label>
        <Row k="Your friend must vote at least" v={`${QUALIFY_TTS} $TTS`} />
        <Row k="Your balance" v={bal != null ? `${formatTTS(bal)} $TTS` : '—'} />
        <Note>
          A referral pays out after the person you invited casts a qualifying vote of at least{' '}
          {QUALIFY_TTS} $TTS. Payouts come from a dedicated referral wallet.
        </Note>
        <Note tone="gold">
          What gets rejected, so nothing is a surprise: referring yourself; a wallet that already has
          a referrer; and wallets funded from the project&apos;s own program wallets. These checks run
          on the server and cannot be worked around from the app.
        </Note>
      </Card>

      <Card>
        <Label hint="optional">Were you invited?</Label>
        <Note>Paste the address of whoever invited you. This can only be set once per wallet.</Note>
        <Field value={referrer} onChangeText={setReferrer} placeholder="0x… their wallet" />
        {msg ? <Note tone={msg.tone}>{msg.t}</Note> : null}
        <Btn kind="ghost" onPress={submitReferrer} busy={busy} style={{ marginTop: 10 }}>
          Record my referrer
        </Btn>
      </Card>
    </ScrollView>
  )
}

const st = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 60 },
  linkBox: {
    backgroundColor: colors.void, borderWidth: 1, borderColor: colors.border2,
    borderRadius: 6, padding: 12, marginBottom: 12,
  },
  link: { fontFamily: sans, fontSize: 12, color: colors.goldLight, lineHeight: 18 },
})
