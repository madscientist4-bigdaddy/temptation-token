import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { wagmiConfig, queryClient } from './config/wallet.js'
import './config/wallet.js'
import App from './App.jsx'
import AdminDashboard from './TTAdminDashboard.jsx'
import ClubsScreen from './ClubsScreen.jsx'
import ClubKitScreen from './ClubKitScreen.jsx'
import PwaLayer from './pwa/PwaLayer.jsx'
import './index.css'

// The admin dashboard is password-gated and must have no offline shell, no cached
// surface and no install prompt — so the PWA layer mounts on the game only.
const isAdmin = window.location.pathname.startsWith('/admin')

// Plain pathname routing rather than a router dependency — there are four routes, and
// vercel.json already sends every unknown path to index.html.
//
// /clubs and /clubs/kit/<code> DO get the PWA layer: a club owner opens these on a phone,
// often from a printed QR, and "add to home screen" is exactly the behaviour we want.
function route() {
  const p = window.location.pathname.replace(/\/+$/, '') || '/'
  if (isAdmin) return <AdminDashboard />
  const kit = p.match(/^\/clubs\/kit\/([a-z0-9_-]{2,32})$/i)
  if (kit) return <ClubKitScreen code={kit[1].toLowerCase()} />
  if (p === '/clubs') return <ClubsScreen />
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {route()}
        {!isAdmin && <PwaLayer />}
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
)
