// Submit — the full entry flow, ported from the web submit tab.
//
// Steps, in the order the API enforces them:
//   1. identity     — which wallet is entering
//   2. ID + selfie  — one time per wallet; skipped entirely if already approved
//   3. the entry    — display name, photo, optional link, optional club code
//   4. consent      — 18+/rights AND the NFT/photo consent, both REQUIRED
//   5. the 5 TTS fee — the ONLY wallet-signing step, so the only thing behind the seam
//
// Steps 1–4 all run in Expo Go: they are API + storage calls scoped to the wallet, not
// signatures. Step 5 needs a real wallet, so in Expo Go the finished, validated entry
// hands off to the full app rather than pretending to submit. Submitting without the fee
// would create a row the game never charged for — worse than an honest handoff.
import React, { useCallback, useEffect, useState } from 'react'
import { View, Text, Image, ScrollView, StyleSheet, Linking, ActivityIndicator } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
// SDK 57's expo-file-system: the old FileSystem.uploadAsync/FileSystemUploadType pair
// moved to expo-file-system/legacy. UploadTask is the current API and streams the file
// natively, so a multi-MB photo never has to be held in JS memory as base64.
import { File as FsFile, UploadTask, UploadType } from 'expo-file-system'
import { SectionHead } from '../components/SectionHead'
import { Card, Field, Label, Btn, Note, Checkbox, Row } from '../components/Form'
import { AddressGate, AddressChip } from '../components/AddressGate'
import { useWallet } from '../lib/wallet'
import { api, KycStatus } from '../api/client'
import { WALLET_ENABLED, FULL_APP_URL } from '../config/features'
import { colors, sans } from '../theme'

const NAME_RE = /^[\p{L}\p{N} '_-]{1,30}$/u
const SUBMISSION_FEE = 5

type Pick = { uri: string; base64?: string | null; mime: string }

async function pickImage(opts: { square?: boolean } = {}): Promise<Pick | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: opts.square ? [1, 1] : [3, 4],
    base64: true,
  })
  if (r.canceled || !r.assets?.length) return null
  const a = r.assets[0]
  return { uri: a.uri, base64: a.base64, mime: a.mimeType || 'image/jpeg' }
}

export function SubmitScreen({ onConnect }: { onConnect: () => void }) {
  const { address, canTransact } = useWallet()

  const [kyc, setKyc] = useState<KycStatus | null>(null)
  const [kycLoading, setKycLoading] = useState(false)
  const [quota, setQuota] = useState<{ usedThisWeek: number; remaining: number } | null>(null)

  const [photo, setPhoto] = useState<Pick | null>(null)
  const [idDoc, setIdDoc] = useState<Pick | null>(null)
  const [selfie, setSelfie] = useState<Pick | null>(null)

  const [name, setName] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [club, setClub] = useState('')

  const [terms, setTerms] = useState(false)
  const [nftConsent, setNftConsent] = useState(false)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: string; tone: 'ok' | 'warn' | 'info' | 'gold' } | null>(null)
  const [errors, setErrors] = useState<Record<string, string | null>>({})

  const verified = kyc?.status === 'approved' || kyc?.verified === true
  const kycPending = kyc?.status === 'pending' || kyc?.status === 'needs_review'

  const refresh = useCallback(async () => {
    if (!address) return
    setKycLoading(true)
    const [k, q] = await Promise.all([
      api.kycStatus(address).catch(() => null),
      api.submitQuota(address).catch(() => null),
    ])
    setKyc(k)
    setQuota(q)
    setKycLoading(false)
  }, [address])

  useEffect(() => { refresh() }, [refresh])

  if (!address) {
    return (
      <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
        <SectionHead eyebrow="Enter the round" title="Submit" subtitle="Get on the board and let the community vote" />
        <AddressGate
          purpose="Entering the round is tied to a wallet — it receives the prize if you win, and verification is recorded against it."
          onConnect={onConnect}
        />
      </ScrollView>
    )
  }

  // ── ID + selfie upload (one time per wallet) ──────────────────────────────
  const uploadIdentity = async (): Promise<{ idDocPath?: string; selfiePath?: string } | null> => {
    if (verified) return {}
    if (!idDoc || !selfie) { setMsg({ t: 'Add both a government ID and a selfie first.', tone: 'warn' }); return null }
    const init = await api.idUploadInit(address).catch(() => null)
    if (!init) { setMsg({ t: 'Could not start the upload. Check your connection and retry.', tone: 'warn' }); return null }
    if (init.alreadyVerified) { await refresh(); return {} }
    if (!init.id?.url || !init.selfie?.url || !init.bucketBase) {
      setMsg({ t: init.error || 'Upload could not be prepared.', tone: 'warn' })
      return null
    }
    // Binary PUT straight to the signed storage URL — the service key never touches the
    // device, and the server chose the path, so a client cannot write outside its own
    // wallet folder.
    const put = async (target: { url: string }, file: Pick) => {
      const task = new UploadTask(new FsFile(file.uri), `${init.bucketBase}${target.url}`, {
        httpMethod: 'PUT',
        uploadType: UploadType.BINARY_CONTENT,
        mimeType: file.mime,
        headers: { 'Content-Type': file.mime, 'x-upsert': 'true' },
      })
      // uploadAsync resolves for non-2xx too, so the status must be checked explicitly.
      const res = await task.uploadAsync()
      if (res.status < 200 || res.status >= 300) throw new Error(`upload failed (${res.status})`)
    }
    await Promise.all([put(init.id, idDoc), put(init.selfie, selfie)])
    return { idDocPath: init.id.path, selfiePath: init.selfie.path }
  }

  const validate = (): boolean => {
    const e: Record<string, string | null> = {}
    if (!NAME_RE.test(name.trim())) {
      e.name = "Letters, numbers, spaces, apostrophes, underscores and hyphens only — max 30 characters"
    }
    if (linkUrl.trim() && !/^https?:\/\/.+/.test(linkUrl.trim())) e.linkUrl = 'Must start with http:// or https://'
    if (!photo) e.photo = 'Choose the photo you are entering.'
    setErrors(e)
    if (Object.keys(e).length) return false
    if (!terms) { setMsg({ t: 'You must confirm you are 18+ and own the rights to the photo.', tone: 'warn' }); return false }
    if (!nftConsent) { setMsg({ t: 'Please tick the NFT/photo consent box — it is required to submit.', tone: 'warn' }); return false }
    if (!verified && (!idDoc || !selfie)) { setMsg({ t: 'First-time entries need a government ID and a selfie.', tone: 'warn' }); return false }
    return true
  }

  const onSubmit = async () => {
    setMsg(null)
    if (!validate()) return
    setBusy(true)
    try {
      const paths = await uploadIdentity()
      if (paths === null) { setBusy(false); return }

      if (!canTransact) {
        // Honest handoff. The ID/selfie ARE now uploaded and queued for review, so the
        // trip to the web app is only the paid step — say exactly that.
        setMsg({
          t: verified
            ? `Everything checks out. The last step is the ${SUBMISSION_FEE} $TTS entry fee, which needs a wallet signature — finish in the full app.`
            : `ID and selfie uploaded and queued for review. The last step is the ${SUBMISSION_FEE} $TTS entry fee, which needs a wallet signature — finish in the full app.`,
          tone: 'gold',
        })
        await refresh()
        setBusy(false)
        return
      }

      // Dev build: the wallet path pays the fee, then the record is saved. Kept behind
      // the same dynamic seam as every other signing action.
      const { loadWallet } = await import('../wallet/loader')
      const w = await loadWallet()
      const fee = await (w as unknown as { paySubmissionFee?: () => Promise<string> })?.paySubmissionFee?.()
      if (!fee) {
        setMsg({ t: 'The entry fee was not paid, so nothing was submitted. No charge was made.', tone: 'warn' })
        setBusy(false)
        return
      }
      await api.submitProfile({
        walletAddress: address,
        displayName: name.trim(),
        linkTitle: linkTitle.trim(),
        linkUrl: linkUrl.trim(),
        imageUrl: `data:${photo!.mime};base64,${photo!.base64}`,
        referralCode: club.trim().toLowerCase() || undefined,
        nftConsent: true,
        ...paths,
      })
      setMsg({ t: 'Submitted. An admin reviews entries before they appear on the board.', tone: 'ok' })
      await refresh()
    } catch (e) {
      setMsg({ t: `Something failed: ${(e as Error).message}. Nothing was charged.`, tone: 'warn' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={st.wrap} keyboardShouldPersistTaps="handled">
      <SectionHead eyebrow="Enter the round" title="Submit" subtitle="Get on the board and let the community vote" />
      <AddressChip />

      {/* ── Verification state ─────────────────────────────────────────────── */}
      <Card>
        <Label hint={kycLoading ? 'checking…' : undefined}>Identity</Label>
        {kycLoading ? (
          <ActivityIndicator color={colors.gold} style={{ marginVertical: 12 }} />
        ) : verified ? (
          <Note tone="ok">✓ This wallet is verified. No ID needed — go straight to your entry.</Note>
        ) : kycPending ? (
          <Note tone="gold">Your documents are with an admin for review. You will be able to enter once approved.</Note>
        ) : (
          <>
            <Note>
              Entries are 18+ only, so every new wallet uploads a government ID and a selfie once.
              They go to a private store an admin reviews — never public, never on the board.
            </Note>
            <View style={st.pickRow}>
              <PickTile
                label="Government ID"
                pick={idDoc}
                onPick={async () => { const p = await pickImage(); if (p) setIdDoc(p) }}
              />
              <PickTile
                label="Selfie"
                pick={selfie}
                onPick={async () => { const p = await pickImage({ square: true }); if (p) setSelfie(p) }}
              />
            </View>
            <Btn
              kind="ghost"
              busy={busy}
              onPress={async () => {
                setMsg(null); setBusy(true)
                try {
                  const r = await uploadIdentity()
                  if (r) {
                    await api.kycRequest(address).catch(() => {})
                    setMsg({ t: 'Uploaded. An admin will review your documents shortly.', tone: 'ok' })
                    await refresh()
                  }
                } catch (e) {
                  setMsg({ t: `Upload failed: ${(e as Error).message}`, tone: 'warn' })
                } finally { setBusy(false) }
              }}
              style={{ marginTop: 10 }}
            >
              Upload for review
            </Btn>
          </>
        )}
      </Card>

      {/* ── The entry ──────────────────────────────────────────────────────── */}
      <Card>
        <Label hint={quota ? `${quota.remaining} of 3 left this week` : undefined}>Your entry</Label>

        <Label>Photo</Label>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={st.preview} resizeMode="cover" />
            <Btn kind="quiet" onPress={async () => { const p = await pickImage(); if (p) setPhoto(p) }}>Choose a different photo</Btn>
          </View>
        ) : (
          <Btn kind="ghost" onPress={async () => { const p = await pickImage(); if (p) { setPhoto(p); setErrors((x) => ({ ...x, photo: null })) } }}>
            Choose photo
          </Btn>
        )}
        {errors.photo ? <Text style={st.err}>{errors.photo}</Text> : null}

        <Label>Display name</Label>
        <Field value={name} onChangeText={setName} placeholder="How you appear on the board" error={errors.name} autoCapitalize="words" maxLength={30} />

        <Label hint="optional">Link title</Label>
        <Field value={linkTitle} onChangeText={setLinkTitle} placeholder="e.g. My Instagram" autoCapitalize="sentences" />

        <Label hint="optional">Link URL</Label>
        <Field value={linkUrl} onChangeText={setLinkUrl} placeholder="https://…" error={errors.linkUrl} keyboardType="url" />

        <Label hint="optional">Club code</Label>
        <Field value={club} onChangeText={setClub} placeholder="Your club's referral code" />
        <Note>A club code links your entry to that club, which then earns a share if you win.</Note>
      </Card>

      {/* ── Consent — both REQUIRED, matching the web gate ─────────────────── */}
      <Card>
        <Label>Consent</Label>
        <Checkbox checked={terms} onToggle={() => setTerms((v) => !v)} required>
          I am 18 or older, I own the rights to this photo, everyone shown has consented, and the
          image meets SFW standards.
        </Checkbox>
        <Checkbox checked={nftConsent} onToggle={() => setNftConsent((v) => !v)} required>
          I consent to my photo and likeness being used in a stylised commemorative NFT if my entry
          wins its round.
        </Checkbox>
        <Note tone="gold">Both boxes are required — submission is blocked without them.</Note>
      </Card>

      {/* ── Fee + submit ───────────────────────────────────────────────────── */}
      <Card>
        <Row k="Entry fee" v={`${SUBMISSION_FEE} $TTS`} />
        <Row k="Entries left this week" v={quota ? `${quota.remaining} of 3` : '—'} />
        {!canTransact && (
          <Note tone="gold">
            {WALLET_ENABLED
              ? 'Connect your wallet to pay the entry fee.'
              : `Everything above works here. Paying the ${SUBMISSION_FEE} $TTS fee needs a wallet signature, which Expo Go cannot do — you'll finish that step in the full app.`}
          </Note>
        )}
        {msg ? <Note tone={msg.tone}>{msg.t}</Note> : null}
        <Btn onPress={onSubmit} busy={busy} disabled={kycPending}>
          {canTransact ? `Pay ${SUBMISSION_FEE} $TTS and submit` : 'Check and continue'}
        </Btn>
        {!canTransact && (
          <Btn kind="quiet" onPress={() => Linking.openURL(FULL_APP_URL)}>Open the full app →</Btn>
        )}
      </Card>
    </ScrollView>
  )
}

function PickTile({ label, pick, onPick }: { label: string; pick: Pick | null; onPick: () => void }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileLabel}>{label}</Text>
      {pick ? (
        <Image source={{ uri: pick.uri }} style={st.tileImg} resizeMode="cover" />
      ) : (
        <View style={[st.tileImg, st.tileEmpty]}><Text style={st.tilePlus}>+</Text></View>
      )}
      <Btn kind="quiet" onPress={onPick}>{pick ? 'Replace' : 'Add'}</Btn>
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 60 },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8, marginBottom: 8, backgroundColor: colors.void },
  err: { color: colors.rose, fontFamily: sans, fontSize: 11, marginTop: 5 },
  pickRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  tile: { flex: 1 },
  tileLabel: { fontFamily: sans, fontSize: 10.5, letterSpacing: 1.1, textTransform: 'uppercase', color: colors.muted, marginBottom: 6, fontWeight: '700' },
  tileImg: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: colors.void },
  tileEmpty: { borderWidth: 1, borderColor: colors.border2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  tilePlus: { color: colors.goldDim, fontSize: 26 },
})
