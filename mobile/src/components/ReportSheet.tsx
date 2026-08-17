// Report a profile. App Store Guideline 1.2 requires an app hosting user-generated
// content to give users a way to flag what they see, plus a published contact.
//
// Every entry is admin-approved before it appears, which is stronger than an automated
// filter — but pre-moderation is not a reporting mechanism. A reviewer looking for a
// report button will not accept "we check them first", and a user who spots a stolen
// photo has nowhere to go.
//
// Reporting deliberately does NOT require a wallet. Making people identify themselves
// before they can report a non-consensual image would suppress exactly the reports that
// matter most. Abuse is bounded server-side instead (one report per wallet per profile,
// short reason allowlist).
import React, { useEffect, useState } from 'react'
import { Modal, View, Text, Pressable, TextInput, StyleSheet, ScrollView, Linking, ActivityIndicator } from 'react-native'
import { colors, serif, sans } from '../theme'
import { api } from '../api/client'
import { useWallet } from '../lib/wallet'

const FALLBACK_CONTACT = 'support@temptationtoken.io'

export function ReportSheet({
  profileId,
  profileName,
  visible,
  onClose,
}: {
  profileId: string | null
  profileName?: string
  visible: boolean
  onClose: () => void
}) {
  const { address } = useWallet()
  const [reasons, setReasons] = useState<Record<string, string> | null>(null)
  const [contact, setContact] = useState(FALLBACK_CONTACT)
  const [chosen, setChosen] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!visible) return
    setChosen(null); setDetails(''); setDone(null); setErr(null)
    api.reportReasons()
      .then((r) => { setReasons(r.reasons); if (r.contact) setContact(r.contact) })
      .catch(() => setReasons(null))
  }, [visible])

  const submit = async () => {
    if (!profileId || !chosen) return
    setBusy(true); setErr(null)
    try {
      const r = await api.reportProfile({
        profileId,
        reason: chosen,
        details: details.trim() || undefined,
        reporterWallet: address || undefined,
      })
      setDone(
        r.alreadyReported
          ? 'You have already reported this entry — it is on file with our moderators.'
          : 'Report received. A moderator reviews every report, and we may remove the entry while we do.'
      )
    } catch {
      setErr(`Could not send the report. Please email ${contact} and we will act on it.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose}>
        <Pressable style={st.sheet} onPress={() => {}}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={st.handle} />
            <Text style={st.title}>Report this entry</Text>
            {profileName ? <Text style={st.sub}>{profileName}</Text> : null}

            {done ? (
              <>
                <View style={st.ok}><Text style={st.okTxt}>{done}</Text></View>
                <Pressable style={st.primary} onPress={onClose}>
                  <Text style={st.primaryTxt}>Done</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={st.body}>What is wrong with it? Pick the closest match.</Text>

                {reasons === null ? (
                  <ActivityIndicator color={colors.gold} style={{ marginVertical: 18 }} />
                ) : (
                  Object.entries(reasons).map(([key, label]) => (
                    <Pressable
                      key={key}
                      style={[st.opt, chosen === key && st.optOn]}
                      onPress={() => setChosen(key)}
                    >
                      <View style={[st.radio, chosen === key && st.radioOn]} />
                      <Text style={[st.optTxt, chosen === key && { color: colors.text }]}>{label}</Text>
                    </Pressable>
                  ))
                )}

                <Text style={st.label}>Anything else? (optional)</Text>
                <TextInput
                  style={st.input}
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Tell us what you saw"
                  placeholderTextColor="rgba(240,232,216,0.3)"
                  multiline
                  maxLength={2000}
                />

                {err ? <Text style={st.err}>{err}</Text> : null}

                <Pressable
                  style={[st.primary, (!chosen || busy) && st.primaryOff]}
                  disabled={!chosen || busy}
                  onPress={submit}
                >
                  <Text style={st.primaryTxt}>{busy ? 'Sending…' : 'Send report'}</Text>
                </Pressable>

                <Pressable onPress={() => Linking.openURL(`mailto:${contact}`)} style={st.cancel}>
                  <Text style={st.cancelTxt}>Or email {contact}</Text>
                </Pressable>
              </>
            )}

            <Pressable style={st.cancel} onPress={onClose}>
              <Text style={st.cancelTxt}>Close</Text>
            </Pressable>
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
  title: { fontFamily: serif, fontStyle: 'italic', fontSize: 25, color: colors.text, textAlign: 'center' },
  sub: { fontFamily: sans, fontSize: 13, color: colors.goldDim, textAlign: 'center', marginTop: 4 },
  body: { fontFamily: sans, fontSize: 13.5, color: colors.muted, lineHeight: 20, marginTop: 14, marginBottom: 10 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.border2, borderRadius: 8, marginBottom: 8,
  },
  optOn: { borderColor: colors.gold, backgroundColor: 'rgba(212,175,55,0.06)' },
  optTxt: { fontFamily: sans, fontSize: 13.5, color: colors.muted, flex: 1 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  radioOn: { borderColor: colors.gold, backgroundColor: colors.gold },
  label: { fontFamily: sans, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: colors.void, borderWidth: 1, borderColor: colors.border2, borderRadius: 6,
    paddingHorizontal: 13, paddingVertical: 12, minHeight: 76, textAlignVertical: 'top',
    color: colors.text, fontFamily: sans, fontSize: 14,
  },
  ok: {
    backgroundColor: 'rgba(46,204,113,0.08)', borderLeftWidth: 3, borderLeftColor: colors.green,
    borderRadius: 6, padding: 12, marginTop: 16,
  },
  okTxt: { fontFamily: sans, fontSize: 13.5, color: colors.text, lineHeight: 20 },
  err: { color: colors.rose, fontFamily: sans, fontSize: 12, marginTop: 10, lineHeight: 18 },
  primary: {
    backgroundColor: colors.crimsonGlow, borderRadius: 10, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: colors.rose, marginTop: 16,
  },
  primaryOff: { opacity: 0.4 },
  primaryTxt: { color: '#fff', fontFamily: sans, fontWeight: '700', fontSize: 14, letterSpacing: 0.6 },
  cancel: { marginTop: 14, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  cancelTxt: { color: colors.muted, fontSize: 12, textDecorationLine: 'underline', fontFamily: sans },
})
