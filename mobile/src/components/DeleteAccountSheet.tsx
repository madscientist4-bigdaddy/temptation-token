// Account deletion. App Store Guideline 5.1.1(v): any app with account creation must let
// the user start deletion from inside the app — not by emailing support and hoping.
//
// Two things this screen refuses to fudge:
//
//  1. IT NEVER CLAIMS TO ERASE THE CHAIN. Votes, payouts and trophies are public
//     blockchain records. The server returns the keep-list with reasons and this renders
//     it verbatim, so nobody taps "delete everything" believing their on-chain history
//     disappeared. Bonus claims are likewise kept, because the published retention policy
//     says they are kept indefinitely for fraud prevention.
//  2. IT REQUIRES A SIGNATURE. A wallet address is public information, so accepting one as
//     proof of ownership would let anyone delete anyone's profile and ID documents. The
//     wallet signs a dated message; the server recovers it. Builds with no signer fall
//     back to the email route rather than pretending to offer a button that cannot work.
import React, { useCallback, useState } from 'react'
import { Modal, View, Text, Pressable, StyleSheet, ScrollView, Linking, ActivityIndicator } from 'react-native'
import { colors, serif, sans } from '../theme'
import { api } from '../api/client'
import { useWallet } from '../lib/wallet'
import { useSignPlainMessage } from '../wallet/appkit'

const CONTACT = 'support@temptationtoken.io'

type Preview = Awaited<ReturnType<typeof api.deletionPreview>>

export function DeleteAccountSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { address, canTransact, setAddress } = useWallet()
  const sign = useSignPlainMessage()

  const [preview, setPreview] = useState<Preview | null>(null)
  const [stage, setStage] = useState<'intro' | 'confirm' | 'done'>('intro')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!address) return
    setBusy(true); setErr(null)
    try {
      setPreview(await api.deletionPreview(address))
      setStage('confirm')
    } catch {
      setErr('Could not load what would be deleted. Try again in a moment.')
    } finally { setBusy(false) }
  }, [address])

  const confirm = async () => {
    if (!address || !preview) return
    setBusy(true); setErr(null)
    try {
      const signature = await sign(preview.message)
      const r = await api.deleteAccount({ walletAddress: address, signature, issuedAt: preview.issuedAt })
      setResult(r.message)
      setStage('done')
      // Only clear the locally stored address when the server actually deleted the data.
      // Clearing it on a partial failure would hide the problem from the person who most
      // needs to chase it.
      if (r.ok) await setAddress(null)
    } catch (e) {
      const m = (e as Error).message || ''
      setErr(
        /cannot sign/i.test(m)
          ? `This build cannot sign messages, so deletion cannot be authorised here. Email ${CONTACT} from any address and we will delete it manually.`
          : `Deletion was not completed: ${m}. Nothing has been removed.`
      )
    } finally { setBusy(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={st.handle} />
            <Text style={st.title}>Delete my account</Text>

            {stage === 'done' ? (
              <>
                <View style={st.ok}><Text style={st.okTxt}>{result}</Text></View>
                <Pressable style={st.primary} onPress={onClose}>
                  <Text style={st.primaryTxt}>Done</Text>
                </Pressable>
              </>
            ) : !address ? (
              <>
                <Text style={st.body}>Set your wallet first — deletion is scoped to one wallet.</Text>
                <Pressable style={st.cancel} onPress={onClose}><Text style={st.cancelTxt}>Close</Text></Pressable>
              </>
            ) : stage === 'intro' ? (
              <>
                <Text style={st.body}>
                  This permanently deletes the off-chain data we hold for {address.slice(0, 6)}…{address.slice(-4)},
                  including your entries and your ID documents. Some records cannot be deleted — you will see
                  exactly which before anything happens.
                </Text>
                {err ? <Text style={st.err}>{err}</Text> : null}
                <Pressable style={[st.primary, busy && st.primaryOff]} disabled={busy} onPress={load}>
                  <Text style={st.primaryTxt}>{busy ? 'Checking…' : 'Show me what gets deleted'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={st.h}>Will be deleted</Text>
                {preview?.willDelete.map((d) => (
                  <Text key={d} style={st.li}>· {d}</Text>
                ))}

                <Text style={st.h}>Cannot be deleted</Text>
                {preview?.willKeep.map((k) => (
                  <View key={k.what} style={st.keep}>
                    <Text style={st.keepWhat}>{k.what}</Text>
                    <Text style={st.keepWhy}>{k.why}</Text>
                  </View>
                ))}

                {!canTransact ? (
                  <Text style={st.warn}>
                    Deleting requires a signature from this wallet, which this build cannot produce.
                    Email {CONTACT} from any address and we will do it manually.
                  </Text>
                ) : (
                  <Text style={st.warn}>
                    You will be asked to sign a message proving you control this wallet. Signing costs
                    no gas and moves no funds.
                  </Text>
                )}

                {err ? <Text style={st.err}>{err}</Text> : null}
                {busy ? <ActivityIndicator color={colors.gold} style={{ marginTop: 14 }} /> : null}

                <Pressable
                  style={[st.danger, (busy || !canTransact) && st.primaryOff]}
                  disabled={busy || !canTransact}
                  onPress={confirm}
                >
                  <Text style={st.primaryTxt}>Permanently delete my data</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL(`mailto:${CONTACT}`)} style={st.cancel}>
                  <Text style={st.cancelTxt}>Email {CONTACT} instead</Text>
                </Pressable>
              </>
            )}

            {stage !== 'done' ? (
              <Pressable style={st.cancel} onPress={onClose}>
                <Text style={st.cancelTxt}>Keep my account</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.deep, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderWidth: 1, borderColor: colors.border, padding: 24, paddingBottom: 34, maxHeight: '88%',
  },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16, alignSelf: 'center' },
  title: { fontFamily: serif, fontStyle: 'italic', fontSize: 25, color: colors.text, textAlign: 'center', marginBottom: 10 },
  body: { fontFamily: sans, fontSize: 13.5, color: colors.muted, lineHeight: 21, marginBottom: 6 },
  h: { fontFamily: sans, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.gold, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  li: { fontFamily: sans, fontSize: 13, color: colors.text, lineHeight: 21 },
  keep: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border2, borderRadius: 8, padding: 11, marginBottom: 7 },
  keepWhat: { fontFamily: sans, fontSize: 13, color: colors.text, fontWeight: '700' },
  keepWhy: { fontFamily: sans, fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 3 },
  warn: { fontFamily: sans, fontSize: 12, color: colors.goldDim, lineHeight: 18, marginTop: 14 },
  err: { color: colors.rose, fontFamily: sans, fontSize: 12, marginTop: 10, lineHeight: 18 },
  ok: {
    backgroundColor: 'rgba(46,204,113,0.08)', borderLeftWidth: 3, borderLeftColor: colors.green,
    borderRadius: 6, padding: 12, marginTop: 10,
  },
  okTxt: { fontFamily: sans, fontSize: 13.5, color: colors.text, lineHeight: 20 },
  primary: {
    backgroundColor: colors.crimsonGlow, borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.rose, marginTop: 16,
  },
  danger: {
    backgroundColor: '#8b1a2a', borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.rose, marginTop: 16,
  },
  primaryOff: { opacity: 0.4 },
  primaryTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 14, letterSpacing: 0.6 },
  cancel: { marginTop: 14, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline', fontFamily: sans },
})
