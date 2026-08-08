// Mirrors the web `.shead`: optional uppercase eyebrow, a Cormorant-italic serif title,
// a centered gold hairline rule, and a muted subtitle.
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, serif, sans } from '../theme'

export function SectionHead({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={st.wrap}>
      {eyebrow ? <Text style={st.eyebrow}>{eyebrow}</Text> : null}
      <Text style={st.title}>{title}</Text>
      <View style={st.rule} />
      {subtitle ? <Text style={st.sub}>{subtitle}</Text> : null}
    </View>
  )
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 12, alignItems: 'center' },
  eyebrow: { fontFamily: sans, fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase', color: colors.muted, marginBottom: 6 },
  title: { fontFamily: serif, fontStyle: 'italic', fontSize: 34, fontWeight: '300', color: colors.text, letterSpacing: 1, textAlign: 'center' },
  rule: { width: 46, height: 1, backgroundColor: colors.gold, marginVertical: 8, opacity: 0.8 },
  sub: { fontFamily: sans, fontSize: 12.5, color: colors.muted, letterSpacing: 0.8, textAlign: 'center', marginTop: 2 },
})
