// Shared form + surface primitives, styled to match the web game's chrome (gold hairline
// borders on near-black, crimson primary buttons, uppercase micro-labels). Every tappable
// element is at least 44pt so it clears the iOS/Android minimum touch target.
import React from 'react'
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, TextStyle } from 'react-native'
import { colors, serif, sans } from '../theme'

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[st.card, style]}>{children}</View>
}

export function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={st.labelRow}>
      <Text style={st.label}>{children}</Text>
      {hint ? <Text style={st.hint}>{hint}</Text> : null}
    </View>
  )
}

export function Field({
  value, onChangeText, placeholder, error, keyboardType, autoCapitalize, multiline, maxLength, editable = true,
}: {
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  error?: string | null
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'url' | 'email-address'
  autoCapitalize?: 'none' | 'sentences' | 'words'
  multiline?: boolean
  maxLength?: number
  editable?: boolean
}) {
  return (
    <>
      <TextInput
        style={[st.input, multiline && st.inputMulti, !!error && st.inputErr, !editable && st.inputOff]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(240,232,216,0.3)"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        multiline={multiline}
        maxLength={maxLength}
        editable={editable}
      />
      {error ? <Text style={st.err}>{error}</Text> : null}
    </>
  )
}

/** Consent checkbox. `required` paints the gold callout the web submit form uses. */
export function Checkbox({
  checked, onToggle, children, required,
}: { checked: boolean; onToggle: () => void; children: React.ReactNode; required?: boolean }) {
  return (
    <Pressable
      style={[st.cbRow, required && st.cbRequired]}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View style={[st.cbBox, checked && st.cbBoxOn]}>
        {checked ? <Text style={st.cbTick}>✓</Text> : null}
      </View>
      <Text style={st.cbTxt}>{children}</Text>
    </Pressable>
  )
}

export function Btn({
  children, onPress, kind = 'primary', disabled, busy, style,
}: {
  children: React.ReactNode
  onPress: () => void
  kind?: 'primary' | 'ghost' | 'quiet'
  disabled?: boolean
  busy?: boolean
  style?: object
}) {
  const off = disabled || busy
  return (
    <Pressable
      style={[st.btn, kind === 'primary' && st.btnP, kind === 'ghost' && st.btnG, kind === 'quiet' && st.btnQ, off && st.btnOff, style]}
      onPress={off ? () => {} : onPress}
      disabled={off}
    >
      {busy ? <ActivityIndicator color={colors.text} size="small" /> : (
        <Text style={[st.btnTxt, kind === 'ghost' && st.btnTxtG, kind === 'quiet' && st.btnTxtQ]}>{children}</Text>
      )}
    </Pressable>
  )
}

/** Inline status/explanation block. tone drives the accent colour. */
export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' | 'ok' | 'gold' }) {
  const accent =
    tone === 'ok' ? colors.green : tone === 'warn' ? colors.rose : tone === 'gold' ? colors.gold : colors.muted
  return (
    <View style={[st.note, { borderLeftColor: accent }]}>
      <Text style={[st.noteTxt, tone !== 'info' && { color: accent }]}>{children}</Text>
    </View>
  )
}

export function Row({ k, v, vStyle }: { k: string; v: string; vStyle?: TextStyle }) {
  return (
    <View style={st.row}>
      <Text style={st.rowK}>{k}</Text>
      <Text style={[st.rowV, vStyle]}>{v}</Text>
    </View>
  )
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={st.h}>{children}</Text>
}

const st = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, marginBottom: 14,
  },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6, marginTop: 4 },
  label: { fontFamily: sans, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.muted, fontWeight: '700' },
  hint: { fontFamily: sans, fontSize: 10, color: colors.goldDim },
  input: {
    backgroundColor: colors.void, borderWidth: 1, borderColor: colors.border2, borderRadius: 6,
    paddingHorizontal: 13, paddingVertical: 13, minHeight: 48,
    color: colors.text, fontFamily: sans, fontSize: 14,
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  inputErr: { borderColor: colors.rose },
  inputOff: { opacity: 0.5 },
  err: { color: colors.rose, fontFamily: sans, fontSize: 11, marginTop: 5 },
  cbRow: { flexDirection: 'row', gap: 11, alignItems: 'flex-start', paddingVertical: 11, minHeight: 44 },
  cbRequired: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(212,175,55,0.06)',
    borderRadius: 8, padding: 12, marginVertical: 4,
  },
  cbBox: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 1.5, borderColor: colors.goldDim,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  cbBoxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  cbTick: { color: colors.void, fontSize: 14, fontWeight: '900', lineHeight: 17 },
  cbTxt: { flex: 1, fontFamily: sans, fontSize: 12.5, lineHeight: 19, color: colors.text },
  btn: { borderRadius: 6, paddingVertical: 15, paddingHorizontal: 18, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  btnP: { backgroundColor: colors.crimsonGlow },
  btnG: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.gold },
  btnQ: { backgroundColor: 'transparent', paddingVertical: 12, minHeight: 44 },
  btnOff: { opacity: 0.45 },
  btnTxt: { fontFamily: sans, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', color: colors.text },
  btnTxtG: { color: colors.gold },
  btnTxtQ: { color: colors.muted, textTransform: 'none', letterSpacing: 0.2, fontWeight: '500' },
  note: { borderLeftWidth: 2, paddingLeft: 11, paddingVertical: 7, marginVertical: 8 },
  noteTxt: { fontFamily: sans, fontSize: 11.5, lineHeight: 18, color: colors.muted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.border2 },
  rowK: { fontFamily: sans, fontSize: 12, color: colors.muted, flexShrink: 1 },
  rowV: { fontFamily: sans, fontSize: 13, fontWeight: '700', color: colors.text },
  h: { fontFamily: serif, fontStyle: 'italic', fontSize: 21, color: colors.text, marginBottom: 10 },
})

export { st as formStyles }
