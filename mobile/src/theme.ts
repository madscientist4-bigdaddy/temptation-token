// Brand tokens — mirrored 1:1 from the web game (src/App.jsx :root CSS variables).
// The live game uses a crimson + antique-gold + cream palette on near-black, with a
// Cormorant Garamond italic serif for display headings and Montserrat for body.
// Expo Go has no bundled Cormorant/Montserrat, so we approximate the serif with the
// platform serif (Georgia on iOS, Noto "serif" on Android) — same italic-serif feel —
// and use the system sans for body. Swapping in the real Google Fonts is a one-liner
// once @expo-google-fonts/* is added in the dev build (see FEATURES / EAS notes).
import { Platform } from 'react-native'

export const colors = {
  void: '#05050a',
  deep: '#0c0c14',
  surface: '#12121e',
  surface2: '#1a1a2a',
  border: 'rgba(212,175,55,0.18)',
  border2: 'rgba(255,255,255,0.06)',
  gold: '#d4af37',
  goldLight: '#f0d060',
  goldDim: 'rgba(212,175,55,0.6)',
  crimson: '#8b1a2a',
  crimsonGlow: '#c0253a',
  rose: '#e8405a',
  green: '#2ecc71',
  text: '#f0e8d8',
  muted: 'rgba(240,232,216,0.5)',
} as const

// Display serif (italic) — matches the web's Cormorant Garamond headings.
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }) as string

// Body sans — matches the web's Montserrat. System sans reads clean and is bundled.
export const sans = Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) as string

// The web app centers everything in a 520px column; mirror that max content width.
export const MAX_WIDTH = 520
