import React, { useState, useEffect } from "react";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const SB_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k';
const sb = {
  get: (table, query='') => fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
  }).then(r => r.json()),
  patch: (table, query, body) => fetch(`${SB_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(body)
  }),
  post: (table, body) => fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify(body)
  })
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const RAILWAY_PLAN   = 'HOBBY'; // Upgraded April 24, 2026 — paid plan, no expiry concern
const HOUSE_WALLET   = '0xb1e991bf617459b58964eef7756b350e675c53b5';
const CHARITY_WALLET = '0xf7dd429d679cb61231e73785fd1737e60138aba3';
const DEPLOYER       = '0xb1e991bf617459b58964eef7756b350e675c53b5';
const MAIN_CHANNEL_ID   = '-1002207667493';
const COMMUNITY_CHAT_ID = '-1003930752060';
const ROUND_SETTLED_TOPIC = '0xabf0728119ba3c53309b0f987eda834ecf31e54dfaeec92465c1512c5eb9c2b9';

function getCurrentWeekLabel() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d); mon.setUTCDate(d.getUTCDate() + diff); mon.setUTCHours(0,0,0,0);
  const sun = new Date(mon); sun.setUTCDate(mon.getUTCDate() + 6);
  const fmt = dt => dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getUTCFullYear()}`;
}
function useCurrentWeek() {
  const [label, setLabel] = useState(getCurrentWeekLabel);
  useEffect(() => { const t = setInterval(() => setLabel(getCurrentWeekLabel()), 60000); return () => clearInterval(t); }, []);
  return label;
}
function useLiveClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const injectStyles = () => {
  if (document.getElementById("tt-admin-styles")) return;
  const s = document.createElement("style");
  s.id = "tt-admin-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Montserrat:wght@300;400;500;600;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --void: #f5f5f5;
      --deep: #ffffff;
      --surface: #ffffff;
      --surface2: #f0f0f0;
      --surface3: #e8e8e8;
      --border: rgba(0,0,0,0.12);
      --border2: rgba(0,0,0,0.07);
      --gold: #8b6914;
      --gold-light: #6b4f0a;
      --gold-dim: rgba(212,175,55,0.55);
      --crimson: #8b1a2a;
      --crimson-glow: #c0253a;
      --rose: #e8405a;
      --green: #1a7a3c;
      --green-dim: rgba(46,204,113,0.15);
      --red-dim: rgba(232,64,90,0.15);
      --amber: #f39c12;
      --amber-dim: rgba(243,156,18,0.15);
      --text: #1a1a1a;
      --muted: #555555;
      --font-display: 'Cormorant Garamond', serif;
      --font-body: 'Montserrat', sans-serif;
      --sidebar-w: 220px;
    }

    html, body, #root {
      height: 100%;
      background: var(--void);
      color: var(--text);
      font-family: var(--font-body);
      font-size: 16px;
    }

    /* GRAIN */
    .adm-app::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 9999;
      opacity: 0;
    }

    /* LOGIN */
    .login-screen {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ececec;
      padding: 24px;
    }
    .login-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 44px 36px;
      width: 100%;
      max-width: 400px;
      text-align: center;
      animation: fadeUp 0.5s ease;
    }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .login-logo {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-style: italic;
      color: var(--gold);
      letter-spacing: 0.1em;
      margin-bottom: 4px;
    }
    .login-sub {
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 36px;
    }
    .login-field {
      width: 100%;
      background: var(--surface2);
      border: 1px solid var(--border2);
      border-radius: 8px;
      padding: 13px 16px;
      color: var(--text);
      font-family: var(--font-body);
      font-size: 0.85rem;
      outline: none;
      margin-bottom: 12px;
      transition: border-color 0.2s;
    }
    .login-field:focus { border-color: var(--gold-dim); }
    .login-field::placeholder { color: var(--muted); font-size: 0.75rem; }
    .login-btn {
      width: 100%;
      background: linear-gradient(135deg, var(--crimson), #a0203a);
      color: var(--text);
      border: none;
      border-radius: 8px;
      padding: 14px;
      font-family: var(--font-body);
      font-size: 0.7rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: all 0.25s;
    }
    .login-btn:hover { background: linear-gradient(135deg, var(--crimson-glow), var(--rose)); box-shadow: 0 6px 24px rgba(192,37,58,0.4); }
    .login-err { font-size: 0.65rem; color: var(--rose); margin-top: 10px; letter-spacing: 0.04em; }

    /* LAYOUT */
    .adm-layout {
      display: flex;
      min-height: 100vh;
    }

    /* SIDEBAR */
    .sidebar {
      width: var(--sidebar-w);
      background: var(--deep);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0; bottom: 0;
      z-index: 50;
      transition: transform 0.3s;
    }
    .sidebar-logo {
      padding: 22px 20px 18px;
      border-bottom: 1px solid var(--border);
    }
    .sidebar-logo-text {
      font-family: var(--font-display);
      font-size: 1.1rem;
      font-style: italic;
      color: var(--gold);
      letter-spacing: 0.08em;
    }
    .sidebar-badge {
      font-size: 0.5rem;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--muted);
      display: block;
      margin-top: 2px;
    }
    .sidebar-nav { flex: 1; padding: 14px 10px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
    .nav-section-label {
      font-size: 0.5rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--muted);
      padding: 12px 10px 6px;
      opacity: 0.6;
    }
    .nav-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: none;
      background: transparent;
      color: var(--muted);
      font-family: var(--font-body);
      font-size: 0.68rem;
      letter-spacing: 0.05em;
      cursor: pointer;
      transition: all 0.18s;
      text-align: left;
      width: 100%;
    }
    .nav-btn:hover { background: var(--surface); color: var(--text); }
    .nav-btn.active { background: var(--surface); color: var(--gold); }
    .nav-btn .icon { font-size: 1rem; flex-shrink: 0; width: 20px; text-align: center; }
    .nav-badge {
      margin-left: auto;
      background: var(--crimson);
      color: var(--text);
      font-size: 0.5rem;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .sidebar-footer {
      padding: 14px 10px;
      border-top: 1px solid var(--border);
    }
    .logout-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(192,37,58,0.25);
      background: transparent;
      color: var(--rose);
      font-family: var(--font-body);
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
    }
    .logout-btn:hover { background: var(--red-dim); }

    /* MAIN */
    .adm-main {
      margin-left: var(--sidebar-w);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    /* TOP BAR */
    .topbar {
      background: var(--deep);
      border-bottom: 1px solid var(--border);
      padding: 0 28px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 40;
    }
    .topbar-title {
      font-family: var(--font-display);
      font-size: 1.2rem;
      font-style: italic;
      color: var(--text);
    }
    .topbar-right { display: flex; align-items: center; gap: 16px; }
    .topbar-week {
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      color: var(--muted);
      text-transform: uppercase;
    }
    .admin-pill {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 6px 12px;
      font-size: 0.6rem;
      letter-spacing: 0.08em;
      color: var(--gold-dim);
    }

    /* PAGE */
    .adm-page { padding: 28px; flex: 1; }
    .page-header { margin-bottom: 24px; }
    .page-title {
      font-family: var(--font-display);
      font-size: 1.8rem;
      font-style: italic;
      font-weight: 300;
      color: var(--text);
    }
    .page-sub { font-size: 0.65rem; color: var(--muted); margin-top: 4px; letter-spacing: 0.06em; }
    .gold-rule { width: 40px; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); margin: 8px 0; }

    /* STAT CARDS */
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 14px; margin-bottom: 28px; }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      animation: fadeUp 0.4s ease forwards;
      opacity: 0;
    }
    .stat-card:nth-child(1) { animation-delay: 0.05s; }
    .stat-card:nth-child(2) { animation-delay: 0.1s; }
    .stat-card:nth-child(3) { animation-delay: 0.15s; }
    .stat-card:nth-child(4) { animation-delay: 0.2s; }
    .stat-card:nth-child(5) { animation-delay: 0.25s; }
    .stat-label { font-size: 0.55rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
    .stat-value {
      font-family: var(--font-display);
      font-size: 2rem;
      font-weight: 300;
      color: var(--text);
      line-height: 1;
    }
    .stat-value.gold { color: var(--gold-light); }
    .stat-value.green { color: var(--green); }
    .stat-value.rose { color: var(--rose); }
    .stat-sub { font-size: 0.6rem; color: var(--muted); margin-top: 4px; }

    /* TABLES */
    .table-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
      animation: fadeUp 0.4s ease forwards;
      opacity: 0;
      animation-delay: 0.1s;
    }
    .table-head {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .table-head-title { font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; font-weight: 600; }
    .table-count {
      font-size: 0.6rem;
      color: var(--muted);
      background: var(--surface2);
      border: 1px solid var(--border2);
      padding: 3px 10px;
      border-radius: 20px;
    }
    .adm-table { width: 100%; border-collapse: collapse; }
    .adm-table th {
      padding: 10px 16px;
      font-size: 0.55rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      text-align: left;
      border-bottom: 1px solid var(--border);
      background: var(--surface2);
    }
    .adm-table td {
      padding: 14px 16px;
      font-size: 0.7rem;
      border-bottom: 1px solid var(--border2);
      color: var(--text);
      vertical-align: middle;
    }
    .adm-table tr:last-child td { border-bottom: none; }
    .adm-table tr:hover td { background: rgba(212,175,55,0.03); }

    /* REVIEW CARDS */
    .review-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
    .review-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      animation: fadeUp 0.4s ease forwards;
      opacity: 0;
    }
    .review-card:nth-child(1) { animation-delay: 0.05s; }
    .review-card:nth-child(2) { animation-delay: 0.1s; }
    .review-card:nth-child(3) { animation-delay: 0.15s; }
    .review-card:nth-child(4) { animation-delay: 0.2s; }
    .review-card:nth-child(5) { animation-delay: 0.25s; }
    .review-card:nth-child(6) { animation-delay: 0.3s; }
    .review-img-wrap {
      aspect-ratio: 3/4;
      overflow: hidden;
      position: relative;
      background: var(--surface2);
    }
    .review-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      pointer-events: none;
      -webkit-user-drag: none;
      display: block;
    }
    .review-img-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      opacity: 0.2;
    }
    .review-submitted-at {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0,0,0,0.75);
      font-size: 0.55rem;
      padding: 3px 8px;
      border-radius: 4px;
      color: var(--muted);
      letter-spacing: 0.06em;
      backdrop-filter: blur(6px);
    }
    .review-info { padding: 14px; }
    .review-name { font-family: var(--font-display); font-size: 1.1rem; font-style: italic; margin-bottom: 4px; }
    .review-wallet { font-size: 0.58rem; color: var(--muted); font-family: monospace; margin-bottom: 6px; word-break: break-all; }
    .review-link {
      font-size: 0.6rem;
      color: var(--gold-dim);
      letter-spacing: 0.06em;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid rgba(212,175,55,0.2);
      padding: 3px 8px;
      border-radius: 20px;
      margin-bottom: 12px;
    }
    .review-actions { display: flex; gap: 8px; }
    .approve-btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 7px;
      background: var(--green-dim);
      color: var(--green);
      font-family: var(--font-body);
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(46,204,113,0.25);
      transition: all 0.2s;
    }
    .approve-btn:hover { background: rgba(46,204,113,0.25); }
    .deny-btn {
      flex: 1;
      padding: 10px;
      border: none;
      border-radius: 7px;
      background: var(--red-dim);
      color: var(--rose);
      font-family: var(--font-body);
      font-size: 0.6rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(232,64,90,0.25);
      transition: all 0.2s;
    }
    .deny-btn:hover { background: rgba(232,64,90,0.25); }

    /* BADGES */
    .badge {
      display: inline-block;
      font-size: 0.55rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 600;
    }
    .badge-pending { background: var(--amber-dim); color: var(--amber); border: 1px solid rgba(243,156,18,0.25); }
    .badge-approved { background: var(--green-dim); color: var(--green); border: 1px solid rgba(46,204,113,0.25); }
    .badge-denied { background: var(--red-dim); color: var(--rose); border: 1px solid rgba(232,64,90,0.25); }
    .badge-active { background: rgba(52,152,219,0.15); color: #3498db; border: 1px solid rgba(52,152,219,0.25); }

    /* WALLET PANEL */
    .wallet-panel-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 14px; }
    .wallet-panel-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      animation: fadeUp 0.4s ease forwards;
      opacity: 0;
    }
    .wallet-panel-card:nth-child(1) { animation-delay: 0.05s; }
    .wallet-panel-card:nth-child(2) { animation-delay: 0.1s; }
    .wallet-panel-card:nth-child(3) { animation-delay: 0.15s; }
    .wallet-panel-card:nth-child(4) { animation-delay: 0.2s; }
    .wallet-panel-card:nth-child(5) { animation-delay: 0.25s; }
    .wpc-label { font-size: 0.55rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
    .wpc-name { font-family: var(--font-display); font-size: 1.1rem; font-style: italic; color: var(--text); margin-bottom: 6px; }
    .wpc-addr {
      font-size: 0.6rem;
      font-family: monospace;
      color: var(--gold-dim);
      background: var(--surface2);
      padding: 8px 10px;
      border-radius: 6px;
      word-break: break-all;
      border: 1px solid var(--border2);
      margin-bottom: 10px;
      letter-spacing: 0.03em;
    }
    .wpc-balance { font-family: var(--font-display); font-size: 1.5rem; color: var(--gold-light); }
    .wpc-balance span { font-size: 0.65rem; color: var(--muted); font-family: var(--font-body); margin-left: 4px; }
    .wpc-network { font-size: 0.55rem; color: var(--muted); margin-top: 4px; letter-spacing: 0.08em; }

    /* SEARCH / FILTER */
    .filter-row { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; }
    .filter-input {
      flex: 1;
      min-width: 200px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: var(--font-body);
      font-size: 0.75rem;
      padding: 10px 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .filter-input:focus { border-color: var(--gold-dim); }
    .filter-input::placeholder { color: var(--muted); font-size: 0.7rem; }
    .filter-select {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      font-family: var(--font-body);
      font-size: 0.7rem;
      padding: 10px 14px;
      outline: none;
      cursor: pointer;
    }
    .filter-select option { background: var(--deep); }

    /* PAYOUT TABLE */
    .payout-breakdown {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 18px;
      margin-bottom: 20px;
    }
    .payout-title { font-family: var(--font-display); font-size: 1rem; font-style: italic; margin-bottom: 14px; }
    .payout-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border2); }
    .payout-row:last-child { border-bottom: none; }
    .payout-label { font-size: 0.65rem; color: var(--muted); letter-spacing: 0.06em; }
    .payout-amount { font-family: var(--font-display); font-size: 1rem; color: var(--gold-light); }

    /* TOAST */
    .adm-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 20px;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      color: var(--text);
      z-index: 1000;
      transform: translateY(60px);
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s;
      max-width: 320px;
    }
    .adm-toast.show { transform: translateY(0); opacity: 1; }
    .adm-toast.success { border-color: rgba(46,204,113,0.4); }
    .adm-toast.error { border-color: rgba(232,64,90,0.4); }
    .adm-toast.info { border-color: rgba(212,175,55,0.4); }

    /* CONFIRM MODAL */
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      z-index: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(6px);
      animation: fadeUp 0.2s ease;
      padding: 24px;
    }
    .confirm-card {
      background: var(--deep);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 32px 28px;
      width: 100%;
      max-width: 380px;
      text-align: center;
    }
    .confirm-icon { font-size: 2.5rem; margin-bottom: 14px; }
    .confirm-title { font-family: var(--font-display); font-size: 1.4rem; font-style: italic; margin-bottom: 8px; }
    .confirm-body { font-size: 0.68rem; color: var(--muted); line-height: 1.7; margin-bottom: 22px; }
    .confirm-actions { display: flex; gap: 10px; }

    /* SCROLLBAR */
    ::-webkit-scrollbar { width: 4px; height: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: var(--surface2); border-radius: 2px; }

    /* RESPONSIVE */
    @media (max-width: 768px) {
      :root { --sidebar-w: 0px; }
      .sidebar { transform: translateX(-220px); }
      .sidebar.open { transform: translateX(0); width: 220px; }
      .adm-main { margin-left: 0; }
      .adm-page { padding: 16px; }
      .stat-grid { grid-template-columns: 1fr 1fr; }
    }

    .dot-live {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--green);
      animation: pulse 1.8s infinite;
      margin-right: 5px;
      vertical-align: middle;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(46,204,113,0.5); }
      50% { opacity: 0.6; box-shadow: 0 0 0 5px rgba(46,204,113,0); }
    }

    .empty-state {
      text-align: center;
      padding: 56px 20px;
      color: var(--muted);
      font-size: 0.72rem;
      letter-spacing: 0.08em;
      line-height: 2;
    }
    .empty-icon { font-size: 2.5rem; display: block; margin-bottom: 12px; opacity: 0.3; }

    .action-link {
      background: none;
      border: none;
      color: var(--gold-dim);
      font-family: var(--font-body);
      font-size: 0.65rem;
      cursor: pointer;
      letter-spacing: 0.06em;
      padding: 4px 0;
      transition: color 0.2s;
    }
    .action-link:hover { color: var(--gold); }
    .action-link.red { color: rgba(232,64,90,0.6); }
    .action-link.red:hover { color: var(--rose); }

    .week-select-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .week-select-label { font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }

    .progress-bar-wrap { background: rgba(255,255,255,0.05); border-radius: 2px; height: 3px; margin-top: 5px; min-width: 80px; }
    .progress-bar { height: 3px; background: linear-gradient(90deg, var(--crimson), var(--rose)); border-radius: 2px; }

    /* ── CONTENT CALENDAR ── */
    .cal-toolbar { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; flex-wrap:wrap; gap:10px; }
    .cal-week-label { font-size:0.7rem; color:var(--muted); font-weight:600; letter-spacing:0.08em; text-transform:uppercase; }
    .cal-gen-btn { background:linear-gradient(135deg,var(--crimson),var(--rose)); color:#fff; border:none; padding:9px 18px; border-radius:6px; font-size:0.65rem; font-weight:700; letter-spacing:0.08em; cursor:pointer; }
    .cal-gen-btn:disabled { opacity:0.5; cursor:not-allowed; }
    .cal-day-group { margin-bottom:18px; }
    .cal-day-label { font-size:0.62rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--gold); padding:6px 0; border-bottom:1px solid var(--border); margin-bottom:10px; }
    .cal-post-card { background:var(--surface2); border:1px solid var(--border); border-radius:10px; padding:14px 16px; margin-bottom:8px; display:flex; gap:14px; align-items:flex-start; }
    .cal-post-card.posted { opacity:0.55; }
    .cal-platform-icon { font-size:1.4rem; flex-shrink:0; margin-top:2px; }
    .cal-post-body { flex:1; min-width:0; }
    .cal-post-meta { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; }
    .cal-post-type { font-size:0.58rem; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:var(--muted); }
    .cal-post-time { font-size:0.58rem; color:var(--muted); }
    .cal-status-badge { font-size:0.55rem; font-weight:700; letter-spacing:0.08em; padding:2px 7px; border-radius:20px; text-transform:uppercase; }
    .cal-status-pending  { background:rgba(243,156,18,0.15); color:var(--amber); }
    .cal-status-approved { background:rgba(33,150,243,0.15); color:#2196f3; }
    .cal-status-posted   { background:var(--green-dim); color:var(--green); }
    .cal-status-failed   { background:var(--red-dim); color:var(--rose); }
    .cal-post-content { font-size:0.72rem; color:var(--text); line-height:1.6; margin-bottom:10px; white-space:pre-wrap; word-break:break-word; }
    .cal-image-hint { font-size:0.62rem; color:var(--muted); font-style:italic; margin-bottom:10px; padding:6px 10px; background:rgba(212,175,55,0.05); border-left:2px solid var(--gold-dim); }
    .cal-captions { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
    .cal-caption-opt { display:flex; gap:8px; align-items:flex-start; cursor:pointer; }
    .cal-caption-opt input[type=radio] { margin-top:3px; flex-shrink:0; accent-color:var(--crimson); }
    .cal-caption-text { font-size:0.7rem; color:var(--text); line-height:1.5; }
    .cal-caption-text.selected { color:var(--crimson); }
    .cal-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .cal-approve-btn { background:var(--crimson); color:#fff; border:none; padding:7px 16px; border-radius:6px; font-size:0.63rem; font-weight:700; cursor:pointer; letter-spacing:0.06em; }
    .cal-approve-btn:disabled { opacity:0.5; cursor:not-allowed; }
    .cal-copy-btn { background:transparent; border:1px solid var(--border); color:var(--muted); padding:7px 14px; border-radius:6px; font-size:0.63rem; cursor:pointer; }
    .cal-insta-note { font-size:0.6rem; color:var(--muted); font-style:italic; padding:6px 10px; background:var(--surface2); border-radius:6px; border:1px dashed var(--border); }
    .cal-empty { text-align:center; padding:40px 20px; color:var(--muted); font-size:0.75rem; }

    /* ── ALERTS BANNER ── */
    .alert-banner-item {
      padding: 10px 28px;
      font-size: .72rem;
      font-weight: 600;
      letter-spacing: .02em;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .alert-banner-item.critical { background: rgba(232,64,90,0.1); color: var(--rose); border-bottom: 1px solid rgba(232,64,90,0.2); }
    .alert-banner-item.warn { background: rgba(243,156,18,0.1); color: var(--amber); border-bottom: 1px solid rgba(243,156,18,0.2); }

    /* ── COMMAND CENTER ── */
    .cmd-countdown {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px 28px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 28px;
      flex-wrap: wrap;
    }
    .cmd-time { font-family: var(--font-display); font-size: 2.8rem; letter-spacing: .05em; line-height: 1; }
    .cmd-time.ok { color: var(--text); }
    .cmd-time.warn { color: var(--amber); }
    .cmd-time.danger { color: var(--rose); }
    .cmd-metric-label { font-size: .55rem; letter-spacing: .16em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
    .cmd-metric-value { font-family: var(--font-display); font-size: 1.8rem; }
    .cmd-divider { border-left: 1px solid var(--border); padding-left: 28px; display: flex; gap: 24px; flex-wrap: wrap; }
    .cmd-health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .cmd-health-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; border-left-width: 3px; border-left-style: solid; }
    .cmd-health-label { font-size: .55rem; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
    .cmd-health-val { font-size: .82rem; font-weight: 700; }
    .cmd-actions { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; margin-bottom: 20px; }
    .cmd-action-title { font-size: .65rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; }
    .cmd-btn { background: var(--surface2); border: 1px solid var(--border); color: var(--text); padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: .68rem; font-family: var(--font-body); font-weight: 600; text-decoration: none; display: inline-block; transition: all .15s; }
    .cmd-btn:hover { border-color: var(--gold-dim); color: var(--gold); }

    /* ── PRIORITIES ── */
    .pri-task-row { padding: 13px 18px; border-bottom: 1px solid var(--border2); display: flex; align-items: center; gap: 12px; cursor: pointer; transition: background .15s; }
    .pri-task-row:hover { background: rgba(212,175,55,0.03); }
    .pri-task-row.done { background: rgba(46,204,113,0.03); }
    .pri-task-row:last-child { border-bottom: none; }
    .pri-check { width: 18px; height: 18px; border-radius: 4px; border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .15s; }
    .pri-check.checked { background: var(--green); border-color: var(--green); }
    .pri-task-text { font-size: .72rem; flex: 1; line-height: 1.5; }
    .pri-task-text.done { color: var(--muted); text-decoration: line-through; }

    /* ── KPI ── */
    .kpi-section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
    .kpi-section-head { padding: 14px 18px; border-bottom: 1px solid var(--border); font-size: .7rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
    .kpi-cell { padding: 18px 20px; border-right: 1px solid var(--border2); border-bottom: 1px solid var(--border2); }
    .kpi-cell-label { font-size: .55rem; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
    .kpi-cell-value { font-family: var(--font-display); font-size: 1.8rem; color: var(--gold-light); }
    .kpi-cell-sub { font-size: .6rem; color: var(--muted); margin-top: 3px; }

    /* ── MANUAL ── */
    .manual-section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
    .manual-toggle { width: 100%; background: none; border: none; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; text-align: left; }
    .manual-toggle-title { font-size: .75rem; font-weight: 700; letter-spacing: .08em; color: var(--text); }
    .manual-arrow { color: var(--muted); font-size: .8rem; transition: transform .2s; }
    .manual-arrow.open { transform: rotate(180deg); }
    .manual-body { padding: 0 20px 18px; }
    .manual-step { display: flex; gap: 12px; padding: 10px 0; border-top: 1px solid var(--border2); }
    .manual-step-num { color: var(--gold); font-weight: 700; font-size: .75rem; flex-shrink: 0; width: 20px; }
    .manual-step-text { font-size: .72rem; color: var(--text); line-height: 1.6; }
    .manual-tpl { margin-top: 10px; padding: 12px 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; }
    .manual-tpl-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .manual-tpl-name { font-size: .65rem; font-weight: 700; color: var(--muted); letter-spacing: .08em; text-transform: uppercase; }
    .manual-copy-btn { background: var(--surface); border: 1px solid var(--border); color: var(--muted); padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: .6rem; font-family: var(--font-body); transition: all .15s; }
    .manual-copy-btn.copied { background: var(--green-dim); border-color: rgba(46,204,113,.3); color: var(--green); }
    .manual-tpl-text { font-size: .68rem; color: var(--text); font-family: var(--font-body); line-height: 1.6; white-space: pre-wrap; word-break: break-word; margin: 0; }
  `;
  document.head.appendChild(s);
};

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const PENDING_SUBMISSIONS = [
  { id: 1, name: "Scarlett_V", wallet: "0x4a3b...c291", link: "OnlyFans", linkUrl: "https://onlyfans.com", submittedAt: "Mar 3, 2026 · 9:14 AM", img: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80" },
  { id: 2, name: "Luna_Rose", wallet: "0x77f2...a001", link: "Instagram", linkUrl: "https://instagram.com", submittedAt: "Mar 3, 2026 · 11:02 AM", img: "https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=400&q=80" },
  { id: 3, name: "Mia_Noir", wallet: "0x19cc...bb45", link: "Twitter/X", linkUrl: "https://x.com", submittedAt: "Mar 4, 2026 · 2:30 PM", img: "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80" },
  { id: 4, name: "Jade_Storm", wallet: "0xef01...3344", link: "Linktree", linkUrl: "https://linktr.ee", submittedAt: "Mar 4, 2026 · 4:18 PM", img: "https://images.unsplash.com/photo-1500917293891-ef795e70e1f6?w=400&q=80" },
  { id: 5, name: "Aria_Blaze", wallet: "0x2d88...7f10", link: "Website", linkUrl: "https://example.com", submittedAt: "Mar 5, 2026 · 8:55 AM", img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80" },
  { id: 6, name: "Celeste_D", wallet: "0xabc1...9988", link: "Patreon", linkUrl: "https://patreon.com", submittedAt: "Mar 5, 2026 · 12:01 PM", img: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80" },
];

const ALL_USERS = [
  { id: 1, handle: "VoterKing99", wallet: "0x11aa...2233", email: "k***@gmail.com", phone: "+1 (***) ***-4521", joined: "Feb 1, 2026", balance: 14200, status: "active" },
  { id: 2, handle: "CryptoQueen", wallet: "0x22bb...3344", email: "q***@yahoo.com", phone: "+1 (***) ***-0099", joined: "Feb 3, 2026", balance: 8750, status: "active" },
  { id: 3, handle: "TokenHunter", wallet: "0x33cc...4455", email: "h***@pm.me", phone: "+44 *** *** 7821", joined: "Feb 8, 2026", balance: 350, status: "active" },
  { id: 4, handle: "BaseMaxi", wallet: "0x44dd...5566", email: "b***@outlook.com", phone: "+1 (***) ***-3312", joined: "Feb 10, 2026", balance: 0, status: "suspended" },
  { id: 5, handle: "FlameVoter", wallet: "0x55ee...6677", email: "f***@icloud.com", phone: "+61 *** *** 2201", joined: "Feb 14, 2026", balance: 5100, status: "active" },
];

const WEEK_VOTES = [
  { name: "Scarlett_V", votes: 48200, pct: 100 },
  { name: "Luna_Rose", votes: 31750, pct: 66 },
  { name: "Mia_Noir", votes: 27400, pct: 57 },
  { name: "Jade_Storm", votes: 19880, pct: 41 },
  { name: "Aria_Blaze", votes: 14320, pct: 30 },
];

const WALLETS = [
  { label: "Master Wallet", name: "Blockchain Entertainment LLC", addr: "0xb1e991bf617459b58964eef7756b350e675c53b5", balance: "2,400,000", network: "Base Mainnet" },
  { label: "Weekly Voting Pool", name: "Escrow — Weekly Votes", addr: "0xb1e991bf617459b58964eef7756b350e675c53b5", balance: "141,550", network: "Base Mainnet" },
  { label: "Staking Lock", name: "Locked Staking Vault", addr: "0xb1e991bf617459b58964eef7756b350e675c53b5", balance: "890,000", network: "Base Mainnet" },
  { label: "Sign-Up Bonus", name: "New User Airdrop Wallet", addr: "0xb1e991bf617459b58964eef7756b350e675c53b5", balance: "690,000", network: "Base Mainnet" },
  { label: "Company Revenue", name: "Blockchain Entertainment LLC — Revenue", addr: "0xb1e991bf617459b58964eef7756b350e675c53b5", balance: "48,200", network: "Base Mainnet" },
  { label: "Nonprofit", name: "Polaris Project Donations", addr: "0xf7dd429d679cb61231e73785fd1737e60138aba3", balance: "9,640", network: "Base Mainnet" },
];

const TOTAL_POOL = 141550;

// ─── HOOKS ────────────────────────────────────────────────────────────────────
function useToast() {
  const [t, setT] = useState({ msg: "", type: "info", show: false });
  const show = (msg, type = "info") => {
    setT({ msg, type, show: true });
    setTimeout(() => setT(x => ({ ...x, show: false })), 3500);
  };
  return [t, show];
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const handle = () => {
    if (user === "admin" && pass === "TTS2026Admin!") { onLogin(); }
    else { setErr("Invalid credentials. Contact your system administrator."); }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">✦ Temptation Token</div>
        <div className="login-sub">Admin Portal · Blockchain Entertainment LLC</div>
        <input className="login-field" type="text" placeholder="Username" value={user} onChange={e => setUser(e.target.value)} autoComplete="off" />
        <input className="login-field" type="password" placeholder="Password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handle()} />
        <button className="login-btn" onClick={handle}>Access Dashboard</button>
        {err && <div className="login-err">{err}</div>}
        <div style={{ marginTop: 20, fontSize: "0.58rem", color: "var(--muted)", lineHeight: 1.7 }}>
          This portal is restricted to authorized personnel only.<br />
          Unauthorized access is prohibited and may be prosecuted.
        </div>
      </div>
    </div>
  );
}

// ─── SCREENS ──────────────────────────────────────────────────────────────────

function OverviewScreen() {
  const weekLabel = useCurrentWeek();
  const [stats, setStats] = useState([
    { label: "Total Users", value: "...", sub: "Loading", cls: "" },
    { label: "Active This Week", value: "0", sub: "unique voters this week", cls: "" },
    { label: "Total Pool This Week", value: "...", sub: "$TTS in escrow", cls: "gold" },
    { label: "Submissions Pending", value: "...", sub: "Awaiting review", cls: "rose" },
    { label: "Approved Profiles", value: "...", sub: "Active this week", cls: "green" },
  ]);
  const [votes, setVotes] = useState([]);
  const [totalPool, setTotalPool] = useState(0);
  const [livePool, setLivePool] = useState(null);

  useEffect(() => {
    // Total users — count distinct voter_wallet from votes table
    sb.get('votes', 'select=voter_wallet').then(d => {
      if (Array.isArray(d)) {
        const distinct = new Set(d.map(v => v.voter_wallet).filter(Boolean));
        setStats(s => s.map((st, i) => i === 0 ? { ...st, value: distinct.size.toLocaleString(), sub: "unique voters" } : st));
      }
    }).catch(() => {});
    // Pending submissions
    sb.get('submissions', 'status=eq.pending&select=id').then(d => {
      if (Array.isArray(d)) setStats(s => s.map((st, i) => i === 3 ? { ...st, value: d.length.toString() } : st));
    }).catch(() => {});
    // Approved profiles
    sb.get('submissions', 'status=eq.approved&select=id').then(d => {
      if (Array.isArray(d)) setStats(s => s.map((st, i) => i === 4 ? { ...st, value: d.length.toString() } : st));
    }).catch(() => {});
    // Active this week + vote rankings from on-chain
    const oneWeekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    sb.get('votes', `select=voter_wallet,tts_amount&created_at=gte.${oneWeekAgo}`).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        const uniqueVoters = new Set(d.map(v => v.voter_wallet).filter(Boolean));
        setStats(s => s.map((st, i) => i === 1 ? { ...st, value: uniqueVoters.size.toString() } : st));
        let pool = 0;
        d.forEach(v => { pool += Number(v.tts_amount) || 0; });
        setTotalPool(pool);
      }
    }).catch(() => {});
    // Live on-chain pool + rankings from on-chain getProfile
    getRoundInfo().then(async info => {
      if (!info || info.error) return;
      const enc = '0x8f1327c0' + info.roundId.toString(16).padStart(64, '0');
      const res = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data: enc }, 'latest']).catch(() => null);
      if (res && res !== '0x') {
        const rawVotes = Number(BigInt('0x' + res.slice(2 + 3 * 64, 2 + 4 * 64))) / 1e18;
        setLivePool(rawVotes);
        setStats(s => s.map((st, i) => i === 2 ? { ...st, value: Math.round(rawVotes).toLocaleString() } : st));
      }
      // Fetch on-chain vote counts per profile
      try {
        const approved = await sb.get('submissions', `status=eq.approved&round_id=eq.${info.roundId}&select=id,display_name`);
        if (Array.isArray(approved) && approved.length > 0) {
          const profileVotes = await Promise.all(approved.map(async p => {
            const padRound = info.roundId.toString(16).padStart(64,'0');
            const padId = [...new TextEncoder().encode(p.id)].map(b=>b.toString(16).padStart(2,'0')).join('');
            const offset = '40'.padStart(64,'0');
            const len = p.id.length.toString(16).padStart(64,'0');
            const padded = padId.padEnd(64,'0');
            const data = '0x76c2c389' + padRound + offset + len + padded;
            const r = await rpcCall('eth_call', [{ to: VOTING_ADDRESS, data }, 'latest']).catch(() => null);
            let votes = 0;
            if (r && r !== '0x' && r.length >= 2 + 5*64) {
              votes = Number(BigInt('0x' + r.slice(2 + 2*64, 2 + 3*64))) / 1e18;
            }
            return { name: p.display_name || p.id.slice(0,8)+'…', votes };
          }));
          const sorted = profileVotes.sort((a,b) => b.votes - a.votes);
          const total = sorted.reduce((s,p) => s+p.votes, 0);
          if (total > 0) {
            setVotes(sorted.map(p => ({ name: p.name, votes: Math.round(p.votes), pct: total > 0 ? Math.round((p.votes/total)*100) : 0 })));
            setTotalPool(total);
          }
        }
      } catch(_) {}
    }).catch(() => {});
  }, []);
  const pool = livePool !== null ? livePool : totalPool;
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Overview</div>
        <div className="gold-rule" />
        <div className="page-sub"><span className="dot-live" />Live · Week of {weekLabel} · Base Mainnet</div>
      </div>
      <div className="stat-grid">
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className={`stat-value ${s.cls}`}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Live vote rankings */}
      <div className="table-card">
        <div className="table-head">
          <span className="table-head-title">📊 Live Vote Rankings</span>
          <span className="table-count">Week of {weekLabel}</span>
        </div>
        <table className="adm-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Profile</th>
              <th>$TTS Votes</th>
              <th>Share</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            {votes.map((v, i) => (
              <tr key={i}>
                <td style={{ color: i === 0 ? "var(--gold)" : "var(--muted)", fontFamily: "var(--font-display)", fontSize: "1rem" }}>{i + 1}</td>
                <td style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontStyle: "italic" }}>{v.name}</td>
                <td style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "var(--gold-light)" }}>{v.votes.toLocaleString()}</td>
                <td style={{ width: 140 }}>
                  <div style={{ fontSize: "0.6rem", color: "var(--muted)", marginBottom: 3 }}>{Math.round((v.votes / (totalPool || 1)) * 100)}% of pool</div>
                  <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${v.pct}%` }} /></div>
                </td>
                <td style={{ color: "var(--green)", fontSize: "0.65rem" }}>↑ Live</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payout preview — live on-chain data */}
      <div className="payout-breakdown">
        <div className="payout-title">
          Projected Prize Distribution — Week of {weekLabel}
          {livePool !== null && <span style={{ fontSize:'.6rem', color:'var(--green)', marginLeft:8 }}>● Live</span>}
        </div>
        <div className="payout-row"><span className="payout-label">Total Pool (on-chain)</span><span className="payout-amount">{Math.round(pool).toLocaleString()} $TTS</span></div>
        <div className="payout-row"><span className="payout-label">🏆 Top Voter (40%)</span><span className="payout-amount" style={{ color: "var(--gold-light)" }}>{Math.round(pool * 0.4).toLocaleString()} $TTS</span></div>
        <div className="payout-row"><span className="payout-label">📸 Winning Profile (40%)</span><span className="payout-amount" style={{ color: "var(--gold-light)" }}>{Math.round(pool * 0.4).toLocaleString()} $TTS</span></div>
        <div className="payout-row"><span className="payout-label">🏢 Blockchain Entertainment LLC (10%)</span><span className="payout-amount">{Math.round(pool * 0.1).toLocaleString()} $TTS</span></div>
        <div className="payout-row"><span className="payout-label">💙 Polaris Project (10%)</span><span className="payout-amount">{Math.round(pool * 0.1).toLocaleString()} $TTS</span></div>
        <div className="payout-row"><span className="payout-label">🔥 Losing votes burned</span><span className="payout-amount" style={{ color: "var(--muted)" }}>Remainder</span></div>
      </div>
    </div>
  );
}

const SUPABASE_URL = 'https://gmlikdxykgviyprqtqwz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdtbGlrZHh5a2d2aXlwcnF0cXd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE0MzQsImV4cCI6MjA4OTc2NzQzNH0.wdP_IpWbt_2HxI2a7Msu_oySnwhsVT9KR-J7eTe4T3k';

function ReviewScreen({ showToast }) {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(null);
  const [onchainModal, setOnchainModal] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');

  const loadQueue = (status = filterStatus) => {
    setLoading(true);
    // Show pending OR approved (for on-chain registration)
    const query = status === 'all'
      ? 'status=in.(pending,approved)&select=*&order=created_at.asc'
      : `status=eq.${status}&select=*&order=created_at.asc`;
    fetch(SUPABASE_URL + '/rest/v1/submissions?' + query, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
    .then(r => r.json())
    .then(data => {
      setQueue(Array.isArray(data) ? data.map(r => ({
        id: r.id,
        name: r.display_name,
        wallet: r.payout_wallet || r.wallet_address,
        link: r.link_title,
        linkUrl: r.link_url,
        img: r.image_url,
        status: r.status,
        submittedAt: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Unknown'
      })) : []);
      setLoading(false);
    })
    .catch(() => setLoading(false));
  };

  useEffect(() => { loadQueue(); }, [filterStatus]);

  const generateOnchainCalldata = async () => {
    const approved = await fetch(SUPABASE_URL + '/rest/v1/submissions?status=eq.approved&select=id,display_name,payout_wallet,wallet_address', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    }).then(r => r.json()).catch(() => []);
    if (!Array.isArray(approved) || approved.length === 0) { showToast('No approved profiles found', 'e'); return; }
    const ids = approved.map(s => s.id || s.display_name);
    const wallets = approved.map(s => s.payout_wallet || s.wallet_address || DEPLOYER);
    const calldata = {
      function: 'batchApproveProfiles(string[],address[])',
      profileIds: ids,
      wallets: wallets,
      to: V3_ADDRESS,
      note: 'Paste into BaseScan → TTSVotingV3 → Write Contract → batchApproveProfiles',
    };
    setOnchainModal(calldata);
  };

  const execute = async () => {
    const { id, action, wallet } = confirmed;
    if (action === "approve") {
      showToast("Approving on-chain...", "info");
      try {
        const r = await fetch('/api/approve-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId: id, walletAddress: wallet }),
        });
        const d = await r.json();
        if (d.ok) {
          setQueue(q => q.filter(s => s.id !== id));
          showToast(`✓ Approved on-chain · ${d.txHash ? d.txHash.slice(0, 10) + '…' : ''}`, "success");
        } else {
          showToast(`Error: ${d.error}`, "error");
        }
      } catch (e) {
        showToast(`Error: ${e.message}`, "error");
      }
    } else {
      await fetch(SUPABASE_URL + '/rest/v1/submissions?id=eq.' + id, {
        method: 'PATCH',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'rejected' })
      });
      setQueue(q => q.filter(s => s.id !== id));
      showToast("✕ Profile denied", "info");
    }
    setConfirmed(null);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Photo Review</div>
        <div className="gold-rule" />
        <div className="page-sub">Approve or deny submitted profiles · SFW policy: clothed, no nudity</div>
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        {['pending','approved','all'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ background: filterStatus===s ? 'var(--crimson)' : 'var(--surface2)', color: filterStatus===s ? '#fff' : 'var(--muted)', border:'1px solid var(--border)', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:'.65rem', fontFamily:'var(--font-body)', fontWeight:600 }}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
        <button onClick={generateOnchainCalldata} style={{ marginLeft:'auto', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--gold)', padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:'.65rem', fontFamily:'var(--font-body)', fontWeight:600 }}>
          ⛓ Register On-Chain
        </button>
      </div>

      {loading ? <div className="empty-state"><span className="empty-icon">⏳</span>Loading…</div> : queue.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✅</span>
          No {filterStatus} submissions found.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span className="table-count">{queue.length} {filterStatus}</span>
          </div>
          <div className="review-grid">
            {queue.map(s => (
              <div key={s.id} className="review-card">
                <div className="review-img-wrap">
                  {s.img
                    ? <img className="review-img" src={s.img} alt="" draggable="false" onContextMenu={e => e.preventDefault()} />
                    : <div className="review-img-placeholder">📷</div>
                  }
                  <div className="review-submitted-at">{s.submittedAt}</div>
                </div>
                <div className="review-info">
                  <div className="review-name">{s.name}</div>
                  <div className="review-wallet">{s.wallet}</div>
                  <a className="review-link" href={/^https?:\/\//.test(s.linkUrl || '') ? s.linkUrl : '#'} target="_blank" rel="noopener noreferrer">🔗 {s.link}</a>
                  <div className="review-actions">
                    <button className="approve-btn" onClick={() => setConfirmed({ id: s.id, action: "approve", wallet: s.wallet })}>✓ Approve</button>
                    <button className="deny-btn" onClick={() => setConfirmed({ id: s.id, action: "deny" })}>✕ Deny</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmed && (
        <div className="confirm-overlay" onClick={() => setConfirmed(null)}>
          <div className="confirm-card" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">{confirmed.action === "approve" ? "✅" : "🚫"}</div>
            <div className="confirm-title">{confirmed.action === "approve" ? "Approve Profile?" : "Deny Profile?"}</div>
            <div className="confirm-body">
              {confirmed.action === "approve" ? "Profile goes live for the current round." : "Profile rejected. User notified via in-app message."}
            </div>
            <div className="confirm-actions">
              <button className="deny-btn" onClick={() => setConfirmed(null)}>Cancel</button>
              <button className="approve-btn" onClick={execute}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {onchainModal && (
        <div className="confirm-overlay" onClick={() => setOnchainModal(null)}>
          <div className="confirm-card" style={{ maxWidth:560, textAlign:'left' }} onClick={e => e.stopPropagation()}>
            <div className="confirm-title" style={{ fontSize:'1rem', marginBottom:10 }}>⛓ Register On-Chain</div>
            <div style={{ fontSize:'.65rem', color:'var(--muted)', marginBottom:12, lineHeight:1.7 }}>
              Go to <a href={`https://basescan.org/address/${V3_ADDRESS}#writeContract`} target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)' }}>BaseScan → TTSVotingV3 → Write Contract → batchApproveProfiles</a> and paste:
            </div>
            <div style={{ fontSize:'.6rem', color:'var(--muted)', marginBottom:6 }}>profileIds ({onchainModal.profileIds.length} profiles):</div>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', fontFamily:'monospace', fontSize:'.62rem', color:'var(--text)', marginBottom:10, wordBreak:'break-all', maxHeight:120, overflowY:'auto' }}>
              [{onchainModal.profileIds.map(id => `"${id}"`).join(', ')}]
            </div>
            <div style={{ fontSize:'.6rem', color:'var(--muted)', marginBottom:6 }}>wallets:</div>
            <div style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', fontFamily:'monospace', fontSize:'.62rem', color:'var(--text)', marginBottom:12, wordBreak:'break-all', maxHeight:120, overflowY:'auto' }}>
              [{onchainModal.wallets.map(w => `"${w}"`).join(', ')}]
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="approve-btn" onClick={() => { navigator.clipboard.writeText(JSON.stringify(onchainModal, null, 2)); showToast('Calldata copied!', 's'); }}>📋 Copy All</button>
              <button className="deny-btn" onClick={() => setOnchainModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UsersScreen({ showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    sb.get('users', 'select=id,wallet_address,display_name,email,created_at,referred_by').then(d => {
      if (Array.isArray(d)) {
        setUsers(d.map(u => ({
          id: u.id,
          handle: u.display_name || (u.wallet_address ? u.wallet_address.slice(0,6)+'…' : 'Anonymous'),
          wallet: u.wallet_address ? u.wallet_address.slice(0,6)+'...'+u.wallet_address.slice(-4) : '—',
          email: u.email || '—',
          joined: u.created_at ? new Date(u.created_at).toLocaleDateString() : '—',
          balance: 0,
          status: 'active',
          referred_by: u.referred_by || '—'
        })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const match = u.handle.toLowerCase().includes(q) || u.wallet.toLowerCase().includes(q);
    const st = filter === "all" || u.status === filter;
    return match && st;
  });

  const toggleStatus = (id) => {
    setUsers(us => us.map(u => u.id === id ? { ...u, status: u.status === "active" ? "suspended" : "active" } : u));
    showToast("User status updated", "info");
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">User Management</div>
        <div className="gold-rule" />
        <div className="page-sub">View registrations · Manage accounts · Monitor balances</div>
      </div>
      <div className="filter-row">
        <input className="filter-input" placeholder="Search by handle or wallet…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Users</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="table-card">
        <div className="table-head">
          <span className="table-head-title">Registered Users</span>
          <span className="table-count">{filtered.length} shown</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Handle</th>
                <th>Wallet</th>
                <th>Email</th>
                <th>Balance</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontStyle: "italic" }}>{u.handle}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "var(--gold-dim)" }}>{u.wallet}</td>
                  <td style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{u.email}</td>
                  <td style={{ fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>{u.balance.toLocaleString()} $TTS</td>
                  <td style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{u.joined}</td>
                  <td><span className={`badge badge-${u.status}`}>{u.status}</span></td>
                  <td>
                    <button className={`action-link${u.status === "active" ? " red" : ""}`} onClick={() => toggleStatus(u.id)}>
                      {u.status === "active" ? "Suspend" : "Reinstate"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: "32px", fontSize: "0.68rem" }}>No users match your search.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const WALLETS_CONFIG = [
  { label: "House / Revenue", name: "Blockchain Entertainment LLC", addr: HOUSE_WALLET, role: "House cut (10%), deployer, admin" },
  { label: "Charity", name: "Polaris Project Donations", addr: CHARITY_WALLET, role: "Charity cut (10%) per round" },
  { label: "Voting Contract", name: "TTSVotingV3 — Escrow", addr: '0xEC339baD1900447833C9fe905C4A768D1f0cA912', role: "Holds votes during active round" },
  { label: "Deployer / Admin", name: "Blockchain Entertainment LLC", addr: DEPLOYER, role: "Profile approvals, admin calls" },
];
function WalletsScreen() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Wallet Addresses</div>
        <div className="gold-rule" />
        <div className="page-sub">All operational wallets on Base Mainnet · Verified on-chain</div>
      </div>
      <div className="wallet-panel-grid">
        {WALLETS_CONFIG.map((w, i) => (
          <div key={i} className="wallet-panel-card">
            <div className="wpc-label">{w.label}</div>
            <div className="wpc-name">{w.name}</div>
            <div className="wpc-addr" style={{ cursor:'pointer' }} onClick={() => navigator.clipboard.writeText(w.addr)}>{w.addr}</div>
            <div className="wpc-network" style={{ marginTop:6, fontSize:'.62rem', color:'var(--muted)' }}>{w.role}</div>
            <div style={{ marginTop:8 }}>
              <a href={`https://basescan.org/address/${w.addr}`} target="_blank" rel="noopener noreferrer" style={{ fontSize:'.6rem', color:'var(--gold-dim)', textDecoration:'none' }}>View on BaseScan →</a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const V3_ADDRESS = '0xEC339baD1900447833C9fe905C4A768D1f0cA912';

function PayoutsScreen({ showToast }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roundInfo, setRoundInfo] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        // Use eth_getLogs via our RPC proxy — no API key needed
        const logs = await rpcCall('eth_getLogs', [{
          address: V3_ADDRESS,
          topics: [ROUND_SETTLED_TOPIC],
          fromBlock: '0x0',
          toBlock: 'latest',
        }]);
        if (Array.isArray(logs) && logs.length > 0) {
          const parsed = [...logs].reverse().slice(0, 20).map(log => ({
            roundId: log.topics[1] ? parseInt(log.topics[1], 16) : '?',
            txHash: log.transactionHash,
            blockNumber: parseInt(log.blockNumber, 16),
            // pool is last 32 bytes of non-indexed data
            pool: log.data && log.data.length >= 66
              ? (Number(BigInt('0x' + log.data.slice(-64))) / 1e18).toFixed(0)
              : '—',
            timestamp: '—',
          }));
          // Fetch block timestamps
          await Promise.all(parsed.map(async (s) => {
            try {
              const blk = await rpcCall('eth_getBlockByNumber', ['0x' + s.blockNumber.toString(16), false]);
              if (blk?.timestamp) s.timestamp = new Date(parseInt(blk.timestamp, 16) * 1000).toLocaleDateString();
            } catch {}
          }));
          setSettlements(parsed);
        }
      } catch(e) {}
      const info = await getRoundInfo().catch(() => null);
      setRoundInfo(info);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settlement History</div>
        <div className="gold-rule" />
        <div className="page-sub">On-chain RoundSettled events from TTSVotingV3 — payouts execute automatically via smart contract</div>
      </div>

      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-head">
          <span className="table-head-title">🏆 RoundSettled Events — Base Mainnet</span>
          <a href={`https://basescan.org/address/${V3_ADDRESS}#events`} target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)', fontSize:'0.65rem' }}>View all on BaseScan →</a>
        </div>
        {loading ? (
          <div style={{ padding: 20, color: 'var(--muted)', fontSize: '.8rem' }}>Loading from BaseScan...</div>
        ) : settlements.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📋</span>
            No rounds settled yet on TTSVotingV3.<br />
            {roundInfo && !roundInfo.error
              ? `Round ${roundInfo.roundId} ends ${new Date(roundInfo.endTime * 1000).toLocaleDateString()}.`
              : 'Round 1 ends soon — settlement fires automatically via Chainlink.'
            }
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr><th>Round</th><th>Date</th><th>Pool</th><th>Block</th><th>TX</th></tr>
            </thead>
            <tbody>
              {settlements.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontFamily:'var(--font-display)', color:'var(--gold-light)', fontSize:'1rem' }}>Round {s.roundId}</td>
                  <td style={{ fontSize:'0.7rem', color:'var(--muted)' }}>{s.timestamp}</td>
                  <td style={{ fontFamily:'var(--font-display)', color:'var(--gold)', fontSize:'.9rem' }}>{Number(s.pool).toLocaleString()} $TTS</td>
                  <td style={{ fontFamily:'monospace', fontSize:'0.6rem' }}>{s.blockNumber.toLocaleString()}</td>
                  <td>
                    <a href={`https://basescan.org/tx/${s.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)', fontSize:'0.6rem', fontFamily:'monospace' }}>
                      {s.txHash ? s.txHash.slice(0,10)+'…' : '—'}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ background:'rgba(46,204,113,0.06)', border:'1px solid rgba(46,204,113,0.2)', borderRadius:10, padding:'14px 18px', fontSize:'0.65rem', color:'var(--muted)', lineHeight:1.8 }}>
        ✅ <strong style={{ color:'var(--green)' }}>Payouts are fully automatic.</strong> When each round settles via Chainlink VRF, the smart contract distributes funds instantly: 40% to top voter, 40% to winning profile, 10% to Blockchain Entertainment LLC, 10% to Polaris Project. No manual action required.
      </div>
    </div>
  );
}

const STAKING_ADDRESS = '0xaA12B889Ebcc32037bb8684B18DF7ED09b2B30fc';
const STAKING_TIERS = [
  { name: 'Bronze', min: 0,       max: 9999,    apr: '8%',  boost: '1.1x' },
  { name: 'Silver', min: 10000,   max: 49999,   apr: '12%', boost: '1.25x' },
  { name: 'Gold',   min: 50000,   max: 199999,  apr: '18%', boost: '1.5x' },
  { name: 'Platinum', min: 200000, max: Infinity, apr: '25%', boost: '2.0x' },
];

function StakingScreen() {
  const [stakers, setStakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contractInfo, setContractInfo] = useState(null); // {totalStaked, abiAvailable}

  useEffect(() => {
    // Try to get on-chain totalStaked via direct RPC call (selector 0x817b1cd2)
    rpcCall('eth_call', [{ to: STAKING_ADDRESS, data: '0x817b1cd2' }, 'latest']).then(r => {
      if (r && r !== '0x') {
        const totalStaked = Number(BigInt('0x' + r.slice(2))) / 1e18;
        setContractInfo({ totalStaked: Math.round(totalStaked) });
      } else {
        setContractInfo({ totalStaked: null });
      }
    }).catch(() => setContractInfo({ totalStaked: null }));

    // Load stakers from Supabase (stakes or staking_positions table)
    const loadStakers = (table) => sb.get(table, 'select=id,wallet_address,tts_amount,tier,created_at').then(d => {
      if (Array.isArray(d) && d.length > 0) {
        setStakers(d.map(s => {
          const amt = Math.round(Number(s.tts_amount || 0));
          const tier = STAKING_TIERS.find(t => amt >= t.min && amt <= t.max) || STAKING_TIERS[0];
          return {
            handle: s.wallet_address ? s.wallet_address.slice(0,6)+'...'+s.wallet_address.slice(-4) : 'Unknown',
            wallet: s.wallet_address || '—',
            amount: amt.toLocaleString(),
            tier: s.tier || tier.name,
            boost: tier.boost,
            apr: tier.apr,
            locked: '—',
            unlocks: '—'
          };
        }));
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    loadStakers('stakes').catch(() => setLoading(false));
  }, []);

  const dbTotalStaked = stakers.reduce((a, s) => a + parseInt((s.amount||'0').replace(/,/g,'')), 0);
  const displayTotal = contractInfo?.totalStaked ?? dbTotalStaked;

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Staking</div>
        <div className="gold-rule" />
        <div className="page-sub">Monitor active stakes · APR reward obligations · Staking contract: <code style={{fontSize:'.6rem',fontFamily:'monospace',color:'var(--gold-dim)'}}>{STAKING_ADDRESS.slice(0,10)}…</code></div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total Staked (On-Chain)</div><div className="stat-value gold">{contractInfo === null ? '…' : displayTotal.toLocaleString()}</div><div className="stat-sub">$TTS locked in contract</div></div>
        <div className="stat-card"><div className="stat-label">Active Stakers (DB)</div><div className="stat-value">{stakers.length}</div><div className="stat-sub">Across all tiers</div></div>
        <div className="stat-card"><div className="stat-label">Contract</div><div className="stat-value" style={{fontSize:'1rem',paddingTop:4}}>
          <a href={`https://basescan.org/address/${STAKING_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{color:'var(--gold-dim)',fontSize:'.65rem'}}>View on BaseScan →</a>
        </div><div className="stat-sub">TTSStaking @ Base</div></div>
      </div>

      {/* Tier Benefits */}
      <div className="table-card" style={{marginBottom:20}}>
        <div className="table-head"><span className="table-head-title">⭐ Tier Benefits</span></div>
        <table className="adm-table">
          <thead><tr><th>Tier</th><th>Min Stake</th><th>APR</th><th>Vote Boost</th></tr></thead>
          <tbody>
            {STAKING_TIERS.map(t => (
              <tr key={t.name}>
                <td><span className="badge" style={{background:'rgba(212,175,55,0.1)',color:'var(--gold)',border:'1px solid rgba(212,175,55,0.25)'}}>{t.name}</span></td>
                <td style={{fontFamily:'var(--font-display)',color:'var(--gold-light)'}}>{t.min.toLocaleString()} $TTS</td>
                <td style={{color:'var(--green)',fontWeight:700}}>{t.apr}</td>
                <td style={{color:'var(--rose)',fontWeight:700}}>{t.boost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-card">
        <div className="table-head">
          <span className="table-head-title">Active Stakes (Supabase)</span>
          <span className="table-count">{stakers.length} stakers</span>
        </div>
        {loading ? (
          <div style={{padding:20,color:'var(--muted)',fontSize:'.8rem'}}>Loading…</div>
        ) : stakers.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">🔒</span>No stakers in database yet.<br/><span style={{fontSize:'.65rem'}}>Stakes will appear here after users stake via the app.</span></div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="adm-table" style={{ minWidth: 700 }}>
              <thead>
                <tr><th>Handle</th><th>Wallet</th><th>Staked</th><th>Tier</th><th>Vote Boost</th><th>APR</th><th>Unlocks</th></tr>
              </thead>
              <tbody>
                {stakers.map((s, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}>{s.handle}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "var(--gold-dim)" }}>{s.wallet}</td>
                    <td style={{ fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>{s.amount} $TTS</td>
                    <td><span className="badge" style={{ background: "rgba(212,175,55,0.1)", color: "var(--gold)", border: "1px solid rgba(212,175,55,0.25)" }}>{s.tier}</span></td>
                    <td style={{ color: "var(--rose)", fontWeight: 600, fontSize: "0.7rem" }}>{s.boost}</td>
                    <td style={{ color: "var(--green)", fontSize: "0.7rem" }}>{s.apr}</td>
                    <td style={{ fontSize: "0.65rem" }}>{s.unlocks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralScreen({ showToast }) {
  const [settings, setSettings] = React.useState({ signup_bonus:100, referrer_bonus:10, new_user_bonus:10, referral_enabled:true })
  const [saving, setSaving] = React.useState(false)
  const [referrers, setReferrers] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    sb.get('referral_settings','id=eq.1&select=*').then(d => { if(Array.isArray(d)&&d.length>0) setSettings(d[0]) }).catch(()=>{})
    sb.get('users','select=referred_by').then(d => {
      if(Array.isArray(d)) {
        const counts = {}
        d.forEach(u => { if(u.referred_by) counts[u.referred_by]=(counts[u.referred_by]||0)+1 })
        setReferrers(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([code,count])=>({code,count,earned:count*settings.referrer_bonus})))
      }
      setLoading(false)
    }).catch(()=>setLoading(false))
  },[])

  const save = async () => {
    setSaving(true)
    try {
      await sb.patch('referral_settings','id=eq.1',settings)
      showToast('Settings saved','success')
    } catch(e){ showToast('Save failed','error') }
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Referral Program</div>
        <div className="gold-rule"/>
        <div className="page-sub">Adjust bonuses and view top referrers. Changes take effect immediately.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:28}}>
        <div className="stat-card" style={{gridColumn:"1/-1",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:".8rem",fontWeight:700,color:"var(--text)",marginBottom:4}}>PROGRAM STATUS</div>
            <div style={{fontSize:".75rem",color:"var(--muted)"}}>Toggle the referral program on or off globally</div>
          </div>
          <div onClick={()=>setSettings(s=>({...s,referral_enabled:!s.referral_enabled}))}
            style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",
              background:settings.referral_enabled?"rgba(46,204,113,.12)":"rgba(232,64,90,.12)",
              border:`1px solid ${settings.referral_enabled?"rgba(46,204,113,.3)":"rgba(232,64,90,.3)"}`,
              borderRadius:20,padding:"10px 20px"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:settings.referral_enabled?"#2ecc71":"var(--rose)"}}/>
            <span style={{fontSize:".85rem",fontWeight:700,color:settings.referral_enabled?"#2ecc71":"var(--rose)"}}>
              {settings.referral_enabled?"ACTIVE":"PAUSED"}
            </span>
          </div>
        </div>
        {[
          {key:"signup_bonus",label:"Sign-Up Bonus",sub:"Every new user on registration",icon:"🎁"},
          {key:"referrer_bonus",label:"Referrer Bonus",sub:"Paid to person who shared the link",icon:"👤"},
          {key:"new_user_bonus",label:"New User Referral Bonus",sub:"Extra bonus for referred users only",icon:"⭐"},
        ].map(({key,label,sub,icon})=>(
          <div key={key} className="stat-card">
            <div style={{fontSize:"1.4rem",marginBottom:8}}>{icon}</div>
            <div style={{fontSize:".75rem",letterSpacing:".08em",textTransform:"uppercase",color:"var(--muted)",marginBottom:4}}>{label}</div>
            <div style={{fontSize:".72rem",color:"var(--muted)",marginBottom:12,lineHeight:1.6}}>{sub}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" min="0" max="100000" value={settings[key]}
                onChange={e=>setSettings(s=>({...s,[key]:parseInt(e.target.value)||0}))}
                style={{flex:1,background:"rgba(255,255,255,.05)",border:"1px solid var(--border-gold)",borderRadius:6,
                  color:"var(--text)",padding:"10px 12px",fontSize:"1.1rem",fontWeight:800}}/>
              <span style={{fontSize:".82rem",color:"var(--gold)",fontWeight:700}}>$TTS</span>
            </div>
          </div>
        ))}
      </div>
      <button className="login-btn" onClick={save} disabled={saving} style={{marginBottom:36,minWidth:220}}>
        {saving?"Saving...":"Save Referral Settings"}
      </button>
      <div style={{fontSize:".82rem",fontWeight:700,color:"var(--text)",marginBottom:12,textTransform:"uppercase",letterSpacing:".08em"}}>Top Referrers</div>
      {loading?<div style={{color:"var(--muted)",fontSize:".85rem",padding:"20px 0"}}>Loading...</div>
      :referrers.length===0?<div className="empty-state"><span className="empty-icon">🔗</span>No referrals yet.</div>
      :<table className="data-table" style={{width:"100%"}}>
        <thead><tr><th>#</th><th>Referral Code</th><th>Users Referred</th><th>$TTS Earned</th></tr></thead>
        <tbody>{referrers.map((r,i)=>(
          <tr key={r.code}>
            <td style={{color:"var(--muted)"}}>#{i+1}</td>
            <td><span style={{fontFamily:"monospace",fontSize:".82rem"}}>{r.code}</span></td>
            <td><span className="badge badge-success">{r.count}</span></td>
            <td style={{color:"var(--gold)",fontWeight:700}}>{r.earned.toLocaleString()} $TTS</td>
          </tr>
        ))}</tbody>
      </table>}
    </div>
  )
}

const NFT_ADDRESS = '0x0768e862D3AB14d85213BfeF8f1D012E77721da2';
// Pre-computed 4-byte selectors
const SEL = {
  charityWallet:    '0x7b208769',
  houseWallet:      '0x77818f02',
  stakingContract:  '0xee99205c',
  minter:           '0x07546172',
  setCharityWallet: '0x30563bd7',
  setHouseWallet:   '0x35d4de51',
  setStaking:       '0x9dd373b9',
  setMinter:        '0xfca3b5aa',
};

function encodeAddressCall(selector, addr) {
  const clean = addr.toLowerCase().replace('0x','').padStart(64,'0');
  return selector + clean;
}

function decodeAddress(hex) {
  if (!hex || hex === '0x' || hex.length < 66) return null;
  return '0x' + hex.slice(-40);
}

function ContractSettingsSection() {
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [currentValues, setCurrentValues] = useState({ charityWallet: '…', houseWallet: '…', stakingContract: '…', minter: '…' });
  const [inputs, setInputs] = useState({ charityWallet: '', houseWallet: '', stakingContract: '', minter: '' });
  const [pending, setPending] = useState({});
  const [, showToast] = useToast();

  const loadCurrentValues = async () => {
    const [cw, hw, sc, mn] = await Promise.all([
      rpcCall('eth_call', [{ to: V3_ADDRESS, data: SEL.charityWallet }, 'latest']).catch(() => null),
      rpcCall('eth_call', [{ to: V3_ADDRESS, data: SEL.houseWallet }, 'latest']).catch(() => null),
      rpcCall('eth_call', [{ to: V3_ADDRESS, data: SEL.stakingContract }, 'latest']).catch(() => null),
      rpcCall('eth_call', [{ to: NFT_ADDRESS, data: SEL.minter }, 'latest']).catch(() => null),
    ]);
    setCurrentValues({
      charityWallet: decodeAddress(cw) || '(read failed)',
      houseWallet: decodeAddress(hw) || '(read failed)',
      stakingContract: decodeAddress(sc) || '(read failed)',
      minter: decodeAddress(mn) || '(read failed)',
    });
  };

  useEffect(() => { loadCurrentValues(); }, []);

  const connectWallet = async () => {
    if (!window.ethereum) { alert('MetaMask not found. Install MetaMask to use contract settings.'); return; }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setConnectedWallet(accounts[0]);
      // Ensure Base network
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] }).catch(() => {});
    } catch(e) { alert('Connection failed: ' + e.message); }
  };

  const disconnect = () => setConnectedWallet(null);

  const sendTx = async (to, data, label) => {
    if (!connectedWallet) { alert('Connect wallet first'); return; }
    setPending(p => ({ ...p, [label]: true }));
    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{ from: connectedWallet, to, data, gas: '0x30D40' }]
      });
      alert(`✓ ${label} transaction sent!\n\nTx: ${txHash}\n\nWaiting for confirmation on BaseScan.`);
      setTimeout(loadCurrentValues, 5000);
    } catch(e) {
      alert(`Transaction failed: ${e.message}`);
    }
    setPending(p => ({ ...p, [label]: false }));
  };

  const settings = [
    { key: 'charityWallet', label: 'Charity Wallet', contract: V3_ADDRESS, sel: SEL.setCharityWallet, note: 'TTSVotingV3 · onlyAdmin (deployer)' },
    { key: 'houseWallet',   label: 'House Wallet',   contract: V3_ADDRESS, sel: SEL.setHouseWallet,   note: 'TTSVotingV3 · onlyAdmin (deployer)' },
    { key: 'stakingContract', label: 'Staking Contract', contract: V3_ADDRESS, sel: SEL.setStaking,  note: 'TTSVotingV3 · onlyAdmin (deployer)' },
    { key: 'minter',        label: 'NFT Minter',     contract: NFT_ADDRESS, sel: SEL.setMinter,       note: 'TTSRoundNFT · owner only' },
  ];

  return (
    <div className="table-card" style={{marginBottom:16}}>
      <div className="table-head">
        <span className="table-head-title">⚙️ Contract Settings</span>
        {connectedWallet ? (
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:'.6rem',color:'var(--green)',fontFamily:'monospace'}}>✓ {connectedWallet.slice(0,6)}…{connectedWallet.slice(-4)}</span>
            <button onClick={disconnect} style={{background:'none',border:'1px solid var(--border)',color:'var(--muted)',padding:'3px 10px',borderRadius:5,cursor:'pointer',fontSize:'.6rem',fontFamily:'var(--font-body)'}}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connectWallet}
            style={{background:'var(--crimson)',color:'#fff',border:'none',padding:'7px 16px',borderRadius:6,cursor:'pointer',fontSize:'.65rem',fontWeight:700,fontFamily:'var(--font-body)',letterSpacing:'.06em'}}>
            🦊 Connect Admin Wallet
          </button>
        )}
      </div>
      {!connectedWallet && (
        <div style={{padding:'12px 20px',fontSize:'.68rem',color:'var(--muted)',background:'rgba(243,156,18,0.06)',borderBottom:'1px solid var(--border)'}}>
          ⚠️ Connect the deployer wallet (<code style={{fontFamily:'monospace',color:'var(--gold-dim)'}}>{DEPLOYER.slice(0,10)}…</code>) via MetaMask to update on-chain settings.
        </div>
      )}
      <div style={{padding:'8px 0'}}>
        {settings.map(s => (
          <div key={s.key} style={{padding:'14px 20px',borderBottom:'1px solid var(--border2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:8}}>
              <div>
                <div style={{fontSize:'.7rem',fontWeight:700,color:'var(--text)',marginBottom:2}}>{s.label}</div>
                <div style={{fontSize:'.55rem',color:'var(--muted)',letterSpacing:'.06em'}}>{s.note}</div>
              </div>
              <div style={{fontFamily:'monospace',fontSize:'.6rem',color:'var(--gold-dim)',background:'var(--surface2)',padding:'4px 10px',borderRadius:5,border:'1px solid var(--border2)'}}>
                Current: {currentValues[s.key]}
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <input
                value={inputs[s.key]}
                onChange={e=>setInputs(i=>({...i,[s.key]:e.target.value}))}
                placeholder="New address (0x...)"
                style={{flex:1,background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:6,padding:'9px 12px',color:'var(--text)',fontFamily:'monospace',fontSize:'.72rem',outline:'none'}}
              />
              <button
                disabled={!connectedWallet || pending[s.key] || !inputs[s.key] || !/^0x[0-9a-fA-F]{40}$/.test(inputs[s.key])}
                onClick={() => sendTx(s.contract, encodeAddressCall(s.sel, inputs[s.key]), s.label)}
                style={{background:'var(--crimson)',color:'#fff',border:'none',padding:'9px 18px',borderRadius:6,cursor:'pointer',fontSize:'.65rem',fontWeight:700,fontFamily:'var(--font-body)',opacity:(!connectedWallet||pending[s.key])?0.5:1,whiteSpace:'nowrap'}}>
                {pending[s.key] ? 'Sending…' : 'Update On-Chain'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsScreen() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="gold-rule" />
        <div className="page-sub">Platform configuration · Nonprofit · Round management · Contract settings</div>
      </div>
      {[
        {
          title: "Weekly Round",
          fields: [
            { label: "Round Start (UTC)", value: "Monday 00:00 UTC (cron: 0 0 * * 1)" },
            { label: "Round End (UTC)", value: "Sunday 23:59 UTC (cron: 59 23 * * 0)" },
            { label: "Round Duration", value: "604800 seconds (7 days exactly)" },
            { label: "Max Profiles Per Week", value: "50" },
            { label: "Max Submissions Per Wallet", value: "3 per week" },
            { label: "Minimum Vote Amount", value: "5 $TTS" },
            { label: "Profile Submission Cost", value: "5 $TTS" },
          ]
        },
        {
          title: "Nonprofit",
          fields: [
            { label: "Current Nonprofit", value: "Polaris Project" },
            { label: "Contact Email", value: "photos@temptationtoken.io" },
            { label: "Donation %", value: "10% of weekly prize pool" },
          ]
        },
        {
          title: "Sign-Up Bonus",
          fields: [
            { label: "Bonus Amount", value: "100 $TTS per new user" },
            { label: "Funded From", value: "Sign-Up Bonus Wallet" },
          ]
        },
      ].map((section, i) => (
        <div key={i} className="table-card" style={{ marginBottom: 16 }}>
          <div className="table-head">
            <span className="table-head-title">{section.title}</span>
          </div>
          <div style={{ padding: "4px 0" }}>
            {section.fields.map((f, j) => (
              <div key={j} className="payout-row" style={{ padding: "12px 20px" }}>
                <span className="payout-label">{f.label}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text)", letterSpacing: "0.04em" }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <ContractSettingsSection />

      <div style={{ background: "rgba(52,152,219,0.08)", border: "1px solid rgba(52,152,219,0.2)", borderRadius: 10, padding: "14px 18px", fontSize: "0.63rem", color: "var(--muted)", lineHeight: 1.8 }}>
        ℹ Contract Settings above require the admin wallet (deployer) connected via MetaMask. All other settings are for reference only.
      </div>
    </div>
  );
}


// ─── SYSTEM HEALTH SCREEN ─────────────────────────────────────────────────────
const VOTING_ADDRESS = '0xEC339baD1900447833C9fe905C4A768D1f0cA912'; // TTSVotingV3
const CHAINLINK_REGISTRY = '0xf4bAb6A129164aBa9B113cB96BA4266dF49f8743';
const UPKEEPS = [
  { name: 'TTS Link Reserve Monitor', known: 7.11, id: '43621180820595228289765408559964550834819164637810952818427682374779443797241' },
  { name: 'TTS Settle Or Rollover',   known: 6.2, id: '37237305312459454425630512539791531504862369275836338221195918127936604287744' },
  { name: 'TTS Midpoint Snapshot',    known: 8.2, id: '25040729748274160188348520481105222267210028754192981237136808224459792109720' },
  { name: 'TTS Start Round',          known: 5.9, id: '33942747581357005304782281231482493992400590377678296430206822813246412566551' },
];
const BASE_RPC = '/api/rpc';

async function rpcCall(method, params) {
  const r = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const d = await r.json();
  if (d.error) { console.error('RPC error:', d.error); return null; }
  return d.result;
}

async function ethCall(to, data) {
  return rpcCall('eth_call', [{ to, data }, 'latest']);
}

async function getRoundInfo() {
  try {
    // currentRoundId() - selector: keccak256("currentRoundId()")[0:4]
    const idHex = await ethCall(VOTING_ADDRESS, '0x9cbe5efd');
    if (!idHex || idHex === '0x') return { error: true };
    const roundId = parseInt(idHex.slice(2, 66), 16);
    // getRound(uint256) - selector: keccak256("getRound(uint256)")[0:4]  
    const encoded = '0x8f1327c0' + roundId.toString(16).padStart(64, '0');
    const result = await ethCall(VOTING_ADDRESS, encoded);
    if (!result || result === '0x') return { roundId, error: true };
    const vals = [];
    for (let i = 0; i < 7; i++) {
      vals.push(result.slice(2 + i*64, 2 + (i+1)*64));
    }
    return {
      roundId,
      startTime: parseInt(vals[0], 16),
      endTime: parseInt(vals[1], 16),
      settled: parseInt(vals[4], 16) === 1,
      vrfPending: parseInt(vals[5], 16) === 1,
      profileCount: parseInt(vals[6], 16),
      error: false
    };
  } catch(e) {
    console.error('getRoundInfo error:', e);
    return { error: true };
  }
}

async function getLinkBalance(upkeepId) {
  try {
    const idHex = BigInt(upkeepId).toString(16).padStart(64, '0');
    const result = await rpcCall('eth_call', [{ to: CHAINLINK_REGISTRY, data: '0xc7c3a19a' + idHex }, 'latest']);
    // balance (uint96) is slot 3 inside the returned tuple — at chars 258–321 of the hex result
    if (!result || result.length < 322) return null;
    return Number(BigInt('0x' + result.slice(258, 322))) / 1e18;
  } catch(e) { return null; }
}

function StatusBadge({ status }) {
  const colors = { ok: '#2ecc71', warn: '#f39c12', critical: '#e84040', unknown: '#666' };
  const labels = { ok: '● Healthy', warn: '● Warning', critical: '● Critical', unknown: '● Unknown' };
  return <span style={{ color: colors[status], fontSize: '.72rem', fontWeight: 700, letterSpacing: '.06em' }}>{labels[status]}</span>;
}

function SystemScreen() {
  const [round, setRound] = React.useState(null);
  const [links, setLinks] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(null);
  const [referralStats, setReferralStats] = React.useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [roundInfo, ...linkBals] = await Promise.all([
        getRoundInfo(),
        ...UPKEEPS.map(u => getLinkBalance(u.id))
      ]);
      setRound(roundInfo);
      setLinks(UPKEEPS.map((u, i) => ({ ...u, balance: linkBals[i] ?? u.known })));
      setLastRefresh(new Date().toLocaleTimeString());
    } catch(e) {}
    // Referral stats — count users with referred_by set
    try {
      const [referred, settings] = await Promise.all([
        sb.get('users', 'select=referred_by&referred_by=not.is.null'),
        sb.get('referral_settings', 'id=eq.1&select=referrer_bonus'),
      ]);
      const count = Array.isArray(referred) ? referred.length : 0;
      const bonus = Array.isArray(settings) && settings[0] ? (settings[0].referrer_bonus || 100) : 100;
      setReferralStats({ count, totalTTS: count * bonus, lastDate: count > 0 ? 'Active' : 'None yet' });
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);

  const now = Math.floor(Date.now() / 1000);
  const roundOverdue = round && !round.settled && now > round.endTime;
  const roundEndsIn = round ? Math.max(0, round.endTime - now) : 0;
  const days = Math.floor(roundEndsIn / 86400);
  const hrs = Math.floor((roundEndsIn % 86400) / 3600);
  const mins = Math.floor((roundEndsIn % 3600) / 60);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">System Health</div>
        <div className="gold-rule" />
        <div className="page-sub" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Live monitoring — auto-refreshes every 60 seconds</span>
          <button onClick={load} style={{ background:'none', border:'1px solid rgba(212,175,55,.3)', color:'var(--gold-dim)', padding:'4px 12px', borderRadius:6, cursor:'pointer', fontSize:'.7rem' }}>
            {loading ? '⟳ Refreshing...' : '⟳ Refresh Now'}
          </button>
        </div>
        {lastRefresh && <div style={{ fontSize:'.65rem', color:'var(--muted)', marginTop:4 }}>Last updated: {lastRefresh}</div>}
      </div>

      {/* ROUND STATUS */}
      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-head">
          <div className="table-head-title">🔄 Round Status</div>
          {round && <StatusBadge status={round.error ? 'unknown' : round.vrfPending ? 'warn' : roundOverdue ? 'critical' : 'ok'} />}
        </div>
        {loading && !round ? <div style={{ padding: 20, color: 'var(--muted)', fontSize: '.8rem' }}>Loading round data...</div> : round && !round.error ? (
          <table className="adm-table">
            <tbody>
              <tr><td style={{ color:'var(--muted)' }}>Round ID</td><td><strong>{round.roundId}</strong></td></tr>
              <tr><td style={{ color:'var(--muted)' }}>Status</td><td>
                {round.settled ? <span style={{ color:'#2ecc71' }}>✅ Settled</span>
                  : roundOverdue ? <span style={{ color:'#e84040' }}>⚠️ OVERDUE — needs settlement</span>
                  : round.vrfPending ? <span style={{ color:'#f39c12' }}>⏳ VRF Pending — awaiting randomness</span>
                  : <span style={{ color:'#2ecc71' }}>🟢 Active</span>}
              </td></tr>
              <tr><td style={{ color:'var(--muted)' }}>Time Remaining</td><td>
                {roundOverdue ? <span style={{ color:'#e84040' }}>Round ended — awaiting Chainlink</span>
                  : <strong>{days}d {hrs}h {mins}m</strong>}
              </td></tr>
              <tr><td style={{ color:'var(--muted)' }}>End Time</td><td>{new Date(round.endTime * 1000).toLocaleString()}</td></tr>
              <tr><td style={{ color:'var(--muted)' }}>Profiles</td><td>{round.profileCount}</td></tr>
              <tr><td style={{ color:'var(--muted)' }}>Settled</td><td>{round.settled ? '✅ Yes' : '❌ No'}</td></tr>
              <tr><td style={{ color:'var(--muted)' }}>VRF Pending</td><td>{round.vrfPending ? '⏳ Yes' : '✅ No'}</td></tr>
            </tbody>
          </table>
        ) : <div style={{ padding: 20, color: '#e84040', fontSize: '.8rem' }}>Failed to load round data</div>}
      </div>

      {/* CHAINLINK UPKEEP BALANCES */}
      <div className="table-card">
        <div className="table-head">
          <div className="table-head-title">⛓ Chainlink Upkeep Balances</div>
          <StatusBadge status={links.some(l => l.balance < 1) ? 'critical' : links.some(l => l.balance < 2) ? 'warn' : 'ok'} />
        </div>
        {links.length === 0 ? <div style={{ padding: 20, color: 'var(--muted)', fontSize: '.8rem' }}>Loading balances...</div> : (
          <table className="adm-table">
            <thead><tr><th>Upkeep</th><th>LINK Balance</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {links.map(u => (
                <tr key={u.name}>
                  <td style={{ fontSize: '.75rem' }}>{u.name}</td>
                  <td><strong style={{ color: u.balance < 1 ? '#e84040' : u.balance < 2 ? '#f39c12' : '#2ecc71' }}>{u.balance.toFixed(3)} LINK</strong></td>
                  <td><StatusBadge status={u.balance < 1 ? 'critical' : u.balance < 2 ? 'warn' : 'ok'} /></td>
                  <td><a href="https://automation.chain.link/base" target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)', fontSize:'.7rem' }}>Fund →</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ALERT THRESHOLDS */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: 8, fontSize: '.72rem', color: 'var(--muted)' }}>
        <strong style={{ color: 'var(--gold-dim)' }}>Alert thresholds:</strong> Critical = below 1.0 LINK · Warning = below 2.0 LINK · Healthy = above 2.0 LINK.{' '}
        <a href="https://automation.chain.link/base" target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)' }}>Fund upkeeps →</a>
      </div>

      {/* RAILWAY STATUS */}
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-head">
          <div className="table-head-title">🚂 Railway Bot Status</div>
          <StatusBadge status="ok" />
        </div>
        <table className="adm-table">
          <tbody>
            <tr><td style={{ color:'var(--muted)' }}>Plan</td><td><strong style={{ color:'var(--green)' }}>{RAILWAY_PLAN} (paid April 24, 2026)</strong></td></tr>
            <tr><td style={{ color:'var(--muted)' }}>Project</td><td>proud-unity</td></tr>
            <tr><td style={{ color:'var(--muted)' }}>Bots</td><td>@TTSGameBot · @TTSBroadcastBot</td></tr>
            <tr><td style={{ color:'var(--muted)' }}>Dashboard</td><td><a href="https://railway.app" target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)', fontSize:'.7rem' }}>railway.app →</a></td></tr>
          </tbody>
        </table>
      </div>

      {/* REFERRAL SYSTEM */}
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-head">
          <div className="table-head-title">🔗 Referral System</div>
          <StatusBadge status="ok" />
        </div>
        {referralStats ? (
          <table className="adm-table">
            <tbody>
              <tr><td style={{ color:'var(--muted)' }}>Referred Users</td><td><strong>{referralStats.count}</strong></td></tr>
              <tr><td style={{ color:'var(--muted)' }}>Est. $TTS Credited</td><td><strong style={{ color:'var(--gold-light)' }}>{referralStats.totalTTS.toLocaleString()} $TTS</strong></td></tr>
              <tr><td style={{ color:'var(--muted)' }}>Status</td><td>{referralStats.lastDate}</td></tr>
              <tr><td style={{ color:'var(--muted)' }}>API Endpoint</td><td><code style={{ fontSize:'.6rem', color:'var(--muted)' }}>POST /api/referral-credit</code></td></tr>
            </tbody>
          </table>
        ) : <div style={{ padding: 16, color: 'var(--muted)', fontSize: '.8rem' }}>Loading referral data…</div>}
      </div>

      {/* ROUND SCHEDULE */}
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-head">
          <div className="table-head-title">📅 Round Schedule (Chainlink Automation)</div>
          <StatusBadge status="ok" />
        </div>
        <table className="adm-table">
          <thead><tr><th>Upkeep</th><th>Cron</th><th>When</th><th>Duration</th></tr></thead>
          <tbody>
            <tr>
              <td style={{fontSize:'.75rem'}}>TTS Start Round</td>
              <td><code style={{fontFamily:'monospace',fontSize:'.7rem',color:'var(--gold-dim)'}}>0 0 * * 1</code></td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>Every Monday 00:00 UTC</td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>604800s (7 days)</td>
            </tr>
            <tr>
              <td style={{fontSize:'.75rem'}}>TTS Settle Or Rollover</td>
              <td><code style={{fontFamily:'monospace',fontSize:'.7rem',color:'var(--gold-dim)'}}>59 23 * * 0</code></td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>Every Sunday 23:59 UTC</td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>—</td>
            </tr>
            <tr>
              <td style={{fontSize:'.75rem'}}>TTS Midpoint Snapshot</td>
              <td><code style={{fontFamily:'monospace',fontSize:'.7rem',color:'var(--gold-dim)'}}>0 12 * * 3</code></td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>Every Wednesday 12:00 UTC</td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>—</td>
            </tr>
            <tr>
              <td style={{fontSize:'.75rem'}}>TTS Link Reserve Monitor</td>
              <td><code style={{fontFamily:'monospace',fontSize:'.7rem',color:'var(--gold-dim)'}}>0 * * * *</code></td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>Every hour</td>
              <td style={{fontSize:'.72rem',color:'var(--muted)'}}>—</td>
            </tr>
          </tbody>
        </table>
        <div style={{padding:'10px 16px',fontSize:'.62rem',color:'var(--muted)',lineHeight:1.7}}>
          ⚠️ TTSVotingV3 does NOT auto-start the next round after settlement — the <strong>TTS Start Round</strong> keeper must fire on Monday. If it misses, use Manual Round Control below to start manually.
          {' '}<a href="https://automation.chain.link/base" target="_blank" rel="noopener noreferrer" style={{color:'var(--gold-dim)'}}>Verify schedules at automation.chain.link →</a>
        </div>
      </div>

      {/* MANUAL ROUND CONTROL */}
      <div className="table-card" style={{ marginTop: 20 }}>
        <div className="table-head">
          <div className="table-head-title">🎮 Manual Round Control</div>
          <span style={{ fontSize:'0.6rem', color:'var(--muted)' }}>Via TTSKeeper2 · Requires owner wallet</span>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ fontSize:'0.65rem', color:'var(--muted)', lineHeight:1.8, marginBottom:16 }}>
            These actions call TTSKeeper2 (<code style={{ fontFamily:'monospace', color:'var(--gold-dim)' }}>0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48</code>) using the owner wallet (deployer). Click a button to open the BaseScan write contract page pre-filled.
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[
              { label:'▶ Start New Round', desc:'Calls manualExecute(1) — starts Round on TTSVotingV3', fn:'manualExecute', arg:'1', color:'var(--green)' },
              { label:'⏩ Force Settle', desc:'Calls manualExecute(3) — triggers round settlement', fn:'manualExecute', arg:'3', color:'var(--amber)' },
              { label:'📋 Approve All Pending', desc:'Copy calldata for batchApproveProfiles — paste into BaseScan', fn:'batchApproveProfiles', arg:null, color:'var(--gold)' },
            ].map((a, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 16px', gap:12 }}>
                <div>
                  <div style={{ fontSize:'0.78rem', fontWeight:700, color:a.color, marginBottom:3 }}>{a.label}</div>
                  <div style={{ fontSize:'0.62rem', color:'var(--muted)' }}>{a.desc}</div>
                </div>
                <a
                  href={a.fn === 'batchApproveProfiles'
                    ? `https://basescan.org/address/${V3_ADDRESS}#writeContract`
                    : `https://basescan.org/address/0xB17b3842E2CFf594d8886e77277f4B6fC7C61A48#writeContract`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ textDecoration:'none', flexShrink:0 }}>
                  <button style={{ background:'transparent', border:`1px solid ${a.color}`, color:a.color, padding:'8px 16px', borderRadius:6, cursor:'pointer', fontSize:'0.65rem', fontWeight:700, letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
                    Open BaseScan →
                  </button>
                </a>
              </div>
            ))}
          </div>
          <div style={{ marginTop:14, fontSize:'0.6rem', color:'var(--muted)', lineHeight:1.7 }}>
            ℹ Connect the TTSKeeper2 owner wallet in MetaMask on BaseScan. For <strong>Start New Round</strong> and <strong>Force Settle</strong>, call <code style={{ fontFamily:'monospace' }}>manualExecute(1)</code> or <code style={{ fontFamily:'monospace' }}>manualExecute(3)</code>. For <strong>Approve All Pending</strong>, open TTSVotingV3 write contract and call <code style={{ fontFamily:'monospace' }}>batchApproveProfiles</code> with the profile IDs and wallet addresses from the Review tab.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CONTENT CALENDAR ─────────────────────────────────────────────────────────

const PLATFORM_ICON = { x: '𝕏', telegram: '📨', instagram: '📸' }
const PLATFORM_LABEL = { x: 'X / Twitter', telegram: 'Telegram', instagram: 'Instagram' }
const DAY_NAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const POST_TYPE_LABEL = {
  round_start: 'Round Start', leaderboard: 'Leaderboard', midpoint: 'Midpoint',
  spotlight: 'Spotlight', weekend_push: 'Weekend Push', community: 'Community', round_end: 'Round End'
}

function getWeekStartStr(from = new Date()) {
  const d = new Date(from)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().split('T')[0]
}

function ContentCalendarScreen({ showToast }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState({})
  const [firing, setFiring] = useState({})
  const weekStart = getWeekStartStr()

  const fetchPosts = () => {
    setLoading(true)
    sb.get('scheduled_posts', `week_start=eq.${weekStart}&order=scheduled_at.asc&select=*`)
      .then(d => { if (Array.isArray(d)) setPosts(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchPosts() }, [])

  const generate = async (force = false) => {
    setGenerating(true)
    try {
      const r = await fetch('/api/content-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force })
      })
      const d = await r.json()
      if (d.skipped) showToast('Already generated this week. Use "Regenerate" to overwrite.', 'i')
      else if (d.ok) { showToast(`Generated ${d.generated} posts for week of ${weekStart}`, 's'); fetchPosts() }
      else showToast(d.error || 'Generation failed', 'e')
    } catch (e) {
      showToast('Network error', 'e')
    }
    setGenerating(false)
  }

  const approve = async (post) => {
    setApproving(a => ({ ...a, [post.id]: true }))
    await sb.patch('scheduled_posts', `id=eq.${post.id}`, { status: 'approved' })
    setPosts(p => p.map(x => x.id === post.id ? { ...x, status: 'approved' } : x))
    showToast(`Approved: ${PLATFORM_LABEL[post.platform]} ${DAY_NAMES[post.day_of_week]}`, 's')
    setApproving(a => ({ ...a, [post.id]: false }))
  }

  const unapprove = async (post) => {
    await sb.patch('scheduled_posts', `id=eq.${post.id}`, { status: 'pending' })
    setPosts(p => p.map(x => x.id === post.id ? { ...x, status: 'pending' } : x))
  }

  const selectCaption = async (post, idx) => {
    const captions = post.instagram_captions || []
    const newContent = captions[idx] || post.content
    await sb.patch('scheduled_posts', `id=eq.${post.id}`, { selected_caption: idx, content: newContent })
    setPosts(p => p.map(x => x.id === post.id ? { ...x, selected_caption: idx, content: newContent } : x))
  }

  const copyCaption = (text) => {
    navigator.clipboard.writeText(text).then(() => showToast('Caption copied!', 's')).catch(() => {})
  }

  const postNow = async (post) => {
    setFiring(f => ({ ...f, [post.id]: true }))
    try {
      const r = await fetch(`/api/scheduler?action=fire&id=${post.id}`, { method: 'POST' })
      const d = await r.json()
      if (d.ok) {
        showToast(`Posted: ${PLATFORM_LABEL[post.platform]}`, 's')
        setPosts(p => p.map(x => x.id === post.id ? { ...x, status: 'posted' } : x))
      } else {
        showToast(d.error || 'Post failed', 'e')
        setPosts(p => p.map(x => x.id === post.id ? { ...x, status: 'failed', error: d.error } : x))
      }
    } catch (e) {
      showToast('Network error', 'e')
    }
    setFiring(f => ({ ...f, [post.id]: false }))
  }

  // Group posts by day_of_week
  const byDay = Array.from({ length: 7 }, (_, i) =>
    posts.filter(p => p.day_of_week === i)
  )

  const weekLabel = (() => {
    const d = new Date(weekStart + 'T00:00:00Z')
    const end = new Date(d); end.setUTCDate(d.getUTCDate() + 6)
    return `${d.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})} – ${end.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'})}, ${end.getUTCFullYear()}`
  })()

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Content Calendar</div>
        <div className="gold-rule" />
        <div className="page-sub">Approve posts before their scheduled time · Auto-generated every Monday 8am UTC</div>
      </div>

      <div className="cal-toolbar">
        <div className="cal-week-label">Week of {weekLabel}</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="cal-gen-btn" style={{ background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)' }}
            onClick={() => generate(true)} disabled={generating}>
            {generating ? 'Regenerating…' : '↺ Regenerate'}
          </button>
          <button className="cal-gen-btn" onClick={() => generate(false)} disabled={generating || posts.length > 0}>
            {generating ? 'Generating…' : posts.length > 0 ? '✓ Generated' : '✦ Generate This Week'}
          </button>
        </div>
      </div>

      {loading && <div className="cal-empty">Loading posts…</div>}

      {!loading && posts.length === 0 && (
        <div className="cal-empty">
          <div style={{ fontSize:'2rem', marginBottom:10 }}>📅</div>
          <div>No content generated yet for this week.</div>
          <div style={{ marginTop:8 }}>Click <strong>Generate This Week</strong> to create 7 days of content.</div>
        </div>
      )}

      {!loading && byDay.map((dayPosts, dayIdx) => {
        if (dayPosts.length === 0) return null
        return (
          <div key={dayIdx} className="cal-day-group">
            <div className="cal-day-label">{DAY_NAMES[dayIdx]}</div>
            {dayPosts.map(post => {
              const isPosted   = post.status === 'posted'
              const isApproved = post.status === 'approved'
              const isFailed   = post.status === 'failed'
              const schedTime  = new Date(post.scheduled_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'UTC', hour12:true }) + ' UTC'
              const captions   = post.instagram_captions || []
              const selIdx     = post.selected_caption ?? 0

              return (
                <div key={post.id} className={`cal-post-card${isPosted ? ' posted' : ''}`}>
                  <div className="cal-platform-icon">{PLATFORM_ICON[post.platform]}</div>
                  <div className="cal-post-body">
                    <div className="cal-post-meta">
                      <span className="cal-post-type">{PLATFORM_LABEL[post.platform]} · {POST_TYPE_LABEL[post.post_type] || post.post_type}</span>
                      <span className="cal-post-time">{schedTime}</span>
                      <span className={`cal-status-badge cal-status-${post.status}`}>{post.status}</span>
                      {isFailed && post.error && <span style={{ fontSize:'0.55rem', color:'var(--rose)' }}>{post.error}</span>}
                    </div>

                    {/* Instagram: show caption picker */}
                    {post.platform === 'instagram' && captions.length > 0 ? (
                      <>
                        {post.image_hint && <div className="cal-image-hint">📷 Use: {post.image_hint}</div>}
                        <div className="cal-captions">
                          {captions.map((cap, ci) => (
                            <label key={ci} className="cal-caption-opt">
                              <input type="radio" name={`cap-${post.id}`} checked={selIdx === ci}
                                onChange={() => !isPosted && selectCaption(post, ci)} disabled={isPosted} />
                              <span className={`cal-caption-text${selIdx === ci ? ' selected' : ''}`}>{cap}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="cal-post-content">{post.content}</div>
                    )}

                    <div className="cal-actions">
                      {!isPosted && !isApproved && (
                        <button className="cal-approve-btn"
                          disabled={!!approving[post.id]}
                          onClick={() => approve(post)}>
                          {approving[post.id] ? '…' : '✓ Approve & Schedule'}
                        </button>
                      )}
                      {isApproved && !isPosted && (
                        <>
                          <span style={{ fontSize:'0.62rem', color:'#2196f3', fontWeight:700 }}>✓ Scheduled</span>
                          <button className="cal-approve-btn" style={{ background:'var(--green)' }}
                            disabled={!!firing[post.id]} onClick={() => postNow(post)}>
                            {firing[post.id] ? 'Posting…' : '▶ Post Now'}
                          </button>
                          <button className="cal-copy-btn" onClick={() => unapprove(post)}>Unschedule</button>
                        </>
                      )}
                      {isPosted && <span style={{ fontSize:'0.62rem', color:'var(--green)', fontWeight:700 }}>✓ Posted</span>}
                      {isFailed && (
                        <button className="cal-approve-btn" onClick={() => approve(post)}>↺ Retry</button>
                      )}
                      {post.platform === 'instagram' && (
                        <button className="cal-copy-btn" onClick={() => copyCaption(post.content)}>📋 Copy Caption</button>
                      )}
                      {post.platform === 'instagram' && isPosted && (
                        <span className="cal-insta-note">📲 Post manually on Instagram</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── SOCIAL MEDIA SCREEN ─────────────────────────────────────────────────────
const DM_TEMPLATES = [
  { name: 'Cold Outreach — Club Performer', text: `Hey! We run a crypto voting game called Temptation Token — think Hot or Not meets Web3. Top creators earn real $TTS crypto rewards weekly.\n\nWould love to feature you. Check us out: app.temptationtoken.io\n\nNo commitment, totally free to apply. 🔥` },
  { name: 'Follow-Up DM', text: `Hey, just following up on my last message about Temptation Token! Voting Round {roundId} is live right now with {pool} $TTS up for grabs.\n\nWould love to get you in — app.temptationtoken.io` },
  { name: 'Club Partnership Pitch', text: `Hi! We're building a Web3 creator voting platform and would love to partner with your venue. We run weekly contests where performers earn crypto — great promo for your talent.\n\nOpen to a quick chat? 🤝` },
  { name: 'OnlyFans Creator Pitch', text: `Hey! Temptation Token is a Web3 "Hot or Not" where fans vote for creators with crypto, and winners earn real money weekly. It's free to enter and could be great extra income.\n\nLink: app.temptationtoken.io — apply now! 💰` },
  { name: 'Instagram Creator (post-comment)', text: `Love your content! 🔥 We run a crypto voting game called Temptation Token where creators earn real $TTS weekly. Would love to feature you — check it out: app.temptationtoken.io` },
];

function SocialScreen({ showToast }) {
  const weekLabel = useCurrentWeek();
  // Stats (localStorage)
  const [stats, setStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tt_social_stats') || '{}'); } catch { return {}; }
  });
  const [tgMembers, setTgMembers] = useState('—');
  const [dmLog, setDmLog] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tt_dm_log') || '[]'); } catch { return []; }
  });
  const [dmModal, setDmModal] = useState(false);
  const [newDm, setNewDm] = useState({ name:'', platform:'Instagram', dateSent: new Date().toISOString().split('T')[0], status:'pending' });
  const [copiedTpl, setCopiedTpl] = useState(null);
  const [tgMsg, setTgMsg] = useState('');
  const [tgSending, setTgSending] = useState(false);
  const [roundInfo, setRoundInfo] = useState(null);
  // Calendar preview
  const [calPosts, setCalPosts] = useState([]);

  useEffect(() => {
    // Fetch Telegram member count via community-stats API
    fetch('/api/community-stats').then(r=>r.json()).then(d=>{
      if(d.members) setTgMembers(d.members.toLocaleString());
    }).catch(()=>{});
    // Round info for templates
    getRoundInfo().then(setRoundInfo).catch(()=>{});
    // Calendar posts this week
    const ws = (() => { const d=new Date(); const day=d.getUTCDay(); const diff=day===0?-6:1-day; d.setUTCDate(d.getUTCDate()+diff); return d.toISOString().split('T')[0]; })();
    sb.get('scheduled_posts', `week_start=eq.${ws}&status=in.(pending,approved)&order=scheduled_at.asc&select=*`).then(d => {
      if(Array.isArray(d)) setCalPosts(d.slice(0,6));
    }).catch(()=>{});
  }, []);

  const saveStats = (newStats) => { setStats(newStats); localStorage.setItem('tt_social_stats', JSON.stringify(newStats)); };
  const saveDmLog = (log) => { setDmLog(log); localStorage.setItem('tt_dm_log', JSON.stringify(log)); };

  const copyTpl = (text, name) => {
    const filled = text
      .replace('{roundId}', roundInfo?.roundId || '—')
      .replace('{pool}', roundInfo ? '(live pool)' : '—');
    navigator.clipboard.writeText(filled).then(() => {
      setCopiedTpl(name); setTimeout(()=>setCopiedTpl(null), 2000);
      showToast('Template copied!', 's');
    }).catch(()=>{});
  };

  const sendTelegram = async (chatId, label) => {
    if (!tgMsg.trim()) { showToast('Enter a message first', 'e'); return; }
    setTgSending(true);
    try {
      const r = await fetch('/api/social-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: 'telegram', content: tgMsg, chatId })
      });
      const d = await r.json();
      if (d.ok || d.telegram) showToast(`Posted to ${label}!`, 's');
      else showToast(d.error || 'Post failed', 'e');
    } catch { showToast('Network error', 'e'); }
    setTgSending(false);
  };

  const addDm = () => {
    if (!newDm.name) { showToast('Enter a name', 'e'); return; }
    const log = [{ ...newDm, id: Date.now() }, ...dmLog];
    saveDmLog(log);
    setDmModal(false);
    setNewDm({ name:'', platform:'Instagram', dateSent: new Date().toISOString().split('T')[0], status:'pending' });
    showToast('DM logged', 's');
  };

  const dmStats = { sent: dmLog.length, replied: dmLog.filter(d=>d.status==='replied').length, converted: dmLog.filter(d=>d.status==='converted').length };
  const platforms = [
    { key:'ig', label:'Instagram', icon:'📸', href:'https://instagram.com' },
    { key:'x', label:'X / Twitter', icon:'𝕏', href:'https://x.com/compose/tweet' },
    { key:'tg', label:'Telegram Channel', icon:'📨', href:'https://t.me/temptationtoken' },
    { key:'tgc', label:'Telegram Community', icon:'💬', href:'https://t.me/TTSCommunityChat' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Social Media</div>
        <div className="gold-rule" />
        <div className="page-sub"><span className="dot-live" />Live stats · outreach tracker · post directly · Week of {weekLabel}</div>
      </div>

      {/* LIVE STATS */}
      <div className="table-card" style={{ marginBottom:20 }}>
        <div className="table-head"><div className="table-head-title">📊 Platform Stats</div><span style={{fontSize:'.6rem',color:'var(--muted)'}}>Manual fields save to localStorage</span></div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:0 }}>
          {[
            { label:'Instagram Followers', key:'ig_followers', placeholder:'e.g. 1200', auto:null },
            { label:'X Followers', key:'x_followers', placeholder:'e.g. 840', auto:null },
            { label:'Telegram Members', key:'tg_members', placeholder:'Auto-fetched', auto:tgMembers },
            { label:'Engagement Rate', key:'engagement', placeholder:'e.g. 4.2%', auto:null },
            { label:'Last IG Post', key:'last_ig', placeholder:'e.g. Apr 26', auto:null },
            { label:'Last X Post', key:'last_x', placeholder:'e.g. Apr 25', auto:null },
          ].map(f => (
            <div key={f.key} style={{ padding:'14px 16px', borderRight:'1px solid var(--border2)', borderBottom:'1px solid var(--border2)' }}>
              <div style={{ fontSize:'.55rem', letterSpacing:'.14em', textTransform:'uppercase', color:'var(--muted)', marginBottom:6 }}>{f.label}</div>
              {f.auto ? (
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', color:'var(--gold-light)' }}>{f.auto}</div>
              ) : (
                <input value={stats[f.key]||''} onChange={e=>saveStats({...stats,[f.key]:e.target.value})}
                  placeholder={f.placeholder}
                  style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'8px 10px', color:'var(--text)', fontFamily:'var(--font-body)', fontSize:'.8rem', outline:'none' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* POST NOW */}
      <div className="table-card" style={{ marginBottom:20 }}>
        <div className="table-head"><div className="table-head-title">📤 Post Now</div></div>
        <div style={{ padding:'16px 20px' }}>
          <textarea value={tgMsg} onChange={e=>setTgMsg(e.target.value)}
            placeholder="Type your message…"
            style={{ width:'100%', minHeight:80, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 12px', color:'var(--text)', fontFamily:'var(--font-body)', fontSize:'.8rem', resize:'vertical', outline:'none', marginBottom:12 }} />
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={()=>sendTelegram(MAIN_CHANNEL_ID,'Main Channel')} disabled={tgSending}
              style={{ background:'var(--crimson)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:7, cursor:'pointer', fontSize:'.68rem', fontWeight:700, fontFamily:'var(--font-body)' }}>
              {tgSending?'Sending…':'📢 Post to Main Channel'}
            </button>
            <button onClick={()=>sendTelegram(COMMUNITY_CHAT_ID,'Community Chat')} disabled={tgSending}
              style={{ background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', padding:'9px 18px', borderRadius:7, cursor:'pointer', fontSize:'.68rem', fontWeight:600, fontFamily:'var(--font-body)' }}>
              {tgSending?'Sending…':'💬 Post to Community'}
            </button>
            {platforms.map(p => (
              <a key={p.key} href={p.href} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration:'none' }}>
                <button style={{ background:'var(--surface2)', color:'var(--text)', border:'1px solid var(--border)', padding:'9px 18px', borderRadius:7, cursor:'pointer', fontSize:'.68rem', fontWeight:600, fontFamily:'var(--font-body)' }}>
                  {p.icon} Open {p.label}
                </button>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT CALENDAR PREVIEW */}
      <div className="table-card" style={{ marginBottom:20 }}>
        <div className="table-head"><div className="table-head-title">📅 This Week's Content</div><span style={{fontSize:'.6rem',color:'var(--muted)'}}>Week of {weekLabel}</span></div>
        {calPosts.length === 0 ? (
          <div style={{ padding:'16px 20px', fontSize:'.75rem', color:'var(--muted)' }}>No posts generated yet — go to Content Calendar tab to generate.</div>
        ) : (
          <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
            {calPosts.map(post => {
              const icon = { x:'𝕏', telegram:'📨', instagram:'📸' }[post.platform] || '📄';
              const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][post.day_of_week] || '';
              const statusColor = post.status==='approved'?'#2196f3':post.status==='posted'?'var(--green)':post.status==='failed'?'var(--rose)':'var(--amber)';
              return (
                <div key={post.id} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'10px 14px', display:'flex', gap:12, alignItems:'flex-start' }}>
                  <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', gap:8, marginBottom:4, flexWrap:'wrap', alignItems:'center' }}>
                      <span style={{ fontSize:'.6rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>{day} · {post.post_type}</span>
                      <span style={{ fontSize:'.55rem', fontWeight:700, color:statusColor, background:`${statusColor}22`, padding:'1px 6px', borderRadius:4 }}>{post.status}</span>
                    </div>
                    <div style={{ fontSize:'.7rem', color:'var(--text)', lineHeight:1.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{post.content?.slice(0,120)}{post.content?.length>120?'…':''}</div>
                    {post.image_hint && <div style={{ fontSize:'.62rem', color:'var(--muted)', fontStyle:'italic', marginTop:3 }}>📷 {post.image_hint}</div>}
                  </div>
                  <button onClick={()=>navigator.clipboard.writeText(post.content).then(()=>showToast('Copied!','s'))}
                    style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', padding:'4px 10px', borderRadius:5, cursor:'pointer', fontSize:'.6rem', flexShrink:0, fontFamily:'var(--font-body)' }}>Copy</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DM OUTREACH TRACKER */}
      <div className="table-card" style={{ marginBottom:20 }}>
        <div className="table-head">
          <div className="table-head-title">📩 DM Outreach Tracker</div>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <span style={{ fontSize:'.6rem', color:'var(--muted)' }}>{dmStats.sent} sent · {dmStats.replied} replied · {dmStats.converted} converted</span>
            <button onClick={()=>setDmModal(true)}
              style={{ background:'var(--crimson)', color:'#fff', border:'none', padding:'5px 12px', borderRadius:5, cursor:'pointer', fontSize:'.62rem', fontWeight:700, fontFamily:'var(--font-body)' }}>
              + Log DM
            </button>
          </div>
        </div>
        {dmLog.length === 0 ? (
          <div style={{ padding:'20px', fontSize:'.75rem', color:'var(--muted)' }}>No DMs logged yet. Click "+ Log DM" to track outreach.</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="adm-table" style={{ minWidth:500 }}>
              <thead><tr><th>Name</th><th>Platform</th><th>Date Sent</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {dmLog.slice(0,50).map(d => (
                  <tr key={d.id}>
                    <td style={{ fontFamily:'var(--font-display)', fontStyle:'italic' }}>{d.name}</td>
                    <td style={{ fontSize:'.7rem' }}>{d.platform}</td>
                    <td style={{ fontSize:'.7rem', color:'var(--muted)' }}>{d.dateSent}</td>
                    <td>
                      <select value={d.status} onChange={e=>{const l=dmLog.map(x=>x.id===d.id?{...x,status:e.target.value}:x);saveDmLog(l);}}
                        style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', borderRadius:4, padding:'3px 6px', fontSize:'.65rem', fontFamily:'var(--font-body)' }}>
                        <option value="pending">Pending</option>
                        <option value="replied">Replied</option>
                        <option value="converted">Converted</option>
                        <option value="no-reply">No Reply</option>
                      </select>
                    </td>
                    <td><button onClick={()=>saveDmLog(dmLog.filter(x=>x.id!==d.id))} className="action-link red">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SOCIAL TEMPLATES */}
      <div className="table-card" style={{ marginBottom:20 }}>
        <div className="table-head"><div className="table-head-title">📝 DM Templates</div></div>
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
          {DM_TEMPLATES.map((tpl, i) => (
            <div key={i} style={{ background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:'.65rem', fontWeight:700, color:'var(--muted)', letterSpacing:'.08em', textTransform:'uppercase' }}>{tpl.name}</span>
                <button onClick={()=>copyTpl(tpl.text, tpl.name)}
                  style={{ background: copiedTpl===tpl.name?'var(--green-dim)':'var(--surface)', border:'1px solid var(--border)', color: copiedTpl===tpl.name?'var(--green)':'var(--muted)', padding:'4px 12px', borderRadius:5, cursor:'pointer', fontSize:'.6rem', fontFamily:'var(--font-body)', transition:'all .15s' }}>
                  {copiedTpl===tpl.name?'✓ Copied':'📋 Copy'}
                </button>
              </div>
              <pre style={{ fontSize:'.68rem', color:'var(--text)', fontFamily:'var(--font-body)', lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>{tpl.text}</pre>
            </div>
          ))}
        </div>
      </div>

      {/* LOG DM MODAL */}
      {dmModal && (
        <div className="confirm-overlay" onClick={()=>setDmModal(false)}>
          <div className="confirm-card" style={{ maxWidth:420, textAlign:'left' }} onClick={e=>e.stopPropagation()}>
            <div className="confirm-title" style={{ fontSize:'1rem', marginBottom:14 }}>📩 Log New DM</div>
            {[
              { label:'Name / Handle', field:'name', type:'text', placeholder:'@username or Name' },
              { label:'Date Sent', field:'dateSent', type:'date', placeholder:'' },
            ].map(f => (
              <div key={f.field} style={{ marginBottom:10 }}>
                <div style={{ fontSize:'.6rem', color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:4 }}>{f.label}</div>
                <input type={f.type} value={newDm[f.field]} onChange={e=>setNewDm(n=>({...n,[f.field]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'var(--font-body)', fontSize:'.8rem', outline:'none' }} />
              </div>
            ))}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:'.6rem', color:'var(--muted)', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:4 }}>Platform</div>
              <select value={newDm.platform} onChange={e=>setNewDm(n=>({...n,platform:e.target.value}))}
                style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:6, padding:'9px 12px', color:'var(--text)', fontFamily:'var(--font-body)', fontSize:'.8rem', outline:'none' }}>
                {['Instagram','X / Twitter','TikTok','Email','Other'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="approve-btn" onClick={addDm}>Save DM</button>
              <button className="deny-btn" onClick={()=>setDmModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ALERTS BANNER ───────────────────────────────────────────────────────────
function AlertsBanner({ setActive }) {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    const items = [];
    // RAILWAY_PLAN is HOBBY — no expiry warning needed
    sb.get('submissions', 'status=eq.pending&select=created_at,id').then(d => {
      if (Array.isArray(d)) {
        const stale = d.filter(s => s.created_at && Date.now() - new Date(s.created_at).getTime() > 48 * 3600000);
        if (stale.length > 0) items.push({
          level: 'warn',
          msg: `⚠️ ${stale.length} submission${stale.length > 1 ? 's have' : ' has'} been pending 48+ hours — click to review`,
          action: () => setActive('review'),
        });
      }
      setAlerts([...items]);
    }).catch(() => setAlerts([...items]));
  }, []);
  if (alerts.length === 0) return null;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {alerts.map((a, i) => (
        <div key={i} className={`alert-banner-item ${a.level}`}
          onClick={a.action}
          style={{ cursor: a.action ? 'pointer' : 'default' }}>
          {a.msg}{a.action && ' →'}
        </div>
      ))}
    </div>
  );
}

// ─── COMMAND CENTER ───────────────────────────────────────────────────────────
function CommandScreen({ setActive }) {
  const [round, setRound] = useState(null);
  const [pool, setPool] = useState(0);
  const [pendingSubs, setPendingSubs] = useState(0);
  const [pendingContent, setPendingContent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [, setTick] = useState(0);

  const load = async () => {
    setLoading(true);
    try {
      const roundInfo = await getRoundInfo();
      setRound(roundInfo);
      if (roundInfo && !roundInfo.error) {
        const encoded = '0x8f1327c0' + roundInfo.roundId.toString(16).padStart(64, '0');
        const result = await ethCall(VOTING_ADDRESS, encoded);
        if (result && result !== '0x') {
          const raw = result.slice(2);
          const rawVotesBig = BigInt('0x' + raw.slice(3 * 64, 4 * 64));
          setPool(Number(rawVotesBig) / 1e18);
        }
      }
      const [subs, posts] = await Promise.all([
        sb.get('submissions', 'status=eq.pending&select=id'),
        sb.get('scheduled_posts', 'status=eq.pending&select=id'),
      ]);
      if (Array.isArray(subs)) setPendingSubs(subs.length);
      if (Array.isArray(posts)) setPendingContent(posts.length);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (e) {}
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 1000); return () => clearInterval(t); }, []);

  const now = Math.floor(Date.now() / 1000);
  const roundOverdue = round && !round.settled && now > (round?.endTime || 0);
  const timeLeft = round && !round.settled ? Math.max(0, round.endTime - now) : 0;
  const days = Math.floor(timeLeft / 86400);
  const hrs = Math.floor((timeLeft % 86400) / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  const timeClass = round?.settled ? '' : roundOverdue ? 'danger' : timeLeft < 3600 ? 'danger' : timeLeft < 86400 ? 'warn' : 'ok';

  const health = [
    { label: 'Round Status', ok: round && !round.error && !roundOverdue && !round.vrfPending, warn: round?.vrfPending, text: !round ? 'Loading…' : round.error ? 'RPC Error' : round.settled ? 'Settled ✓' : roundOverdue ? 'OVERDUE' : round.vrfPending ? 'VRF Pending' : 'Active', href: null, nav: 'system' },
    { label: 'Railway Bot', ok: true, warn: false, text: `${RAILWAY_PLAN} Plan · Online`, href: 'https://railway.app', nav: null },
    { label: 'Pending Review', ok: pendingSubs === 0, warn: pendingSubs > 0, text: pendingSubs === 0 ? 'All clear' : `${pendingSubs} waiting`, href: null, nav: 'review' },
    { label: 'Content Queue', ok: pendingContent === 0, warn: pendingContent > 0, text: pendingContent === 0 ? 'All approved' : `${pendingContent} to approve`, href: null, nav: 'content' },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Command Center</div>
        <div className="gold-rule" />
        <div className="page-sub" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><span className="dot-live" />Live · auto-refreshes every 60s</span>
          <button onClick={load} style={{ background: 'none', border: '1px solid rgba(212,175,55,.3)', color: 'var(--gold-dim)', padding: '4px 12px', borderRadius: 6, cursor: 'pointer', fontSize: '.7rem' }}>
            {loading ? '⟳ Refreshing…' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      <div className="cmd-countdown">
        <div>
          <div className="cmd-metric-label">Round {round?.roundId || '—'} — Time Remaining</div>
          {round?.settled ? (
            <div className="cmd-time ok">Settled ✓</div>
          ) : roundOverdue ? (
            <div className="cmd-time danger">OVERDUE</div>
          ) : (
            <div className={`cmd-time ${timeClass}`}>
              {days > 0 && `${days}d `}{String(hrs).padStart(2, '0')}:{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>
          )}
          <div style={{ fontSize: '.62rem', color: 'var(--muted)', marginTop: 4 }}>
            {round && !round.error ? `Ends ${new Date(round.endTime * 1000).toLocaleString()}` : 'Loading round…'}
          </div>
        </div>
        <div className="cmd-divider">
          {[
            { label: 'Pool', value: pool > 0 ? `${Math.round(pool).toLocaleString()} TTS` : '—', color: 'var(--gold-light)' },
            { label: 'Profiles', value: round?.profileCount ?? '—', color: 'var(--text)' },
            { label: 'Pending Review', value: pendingSubs, color: pendingSubs > 0 ? 'var(--rose)' : 'var(--green)' },
            { label: 'Pending Content', value: pendingContent, color: pendingContent > 0 ? 'var(--amber)' : 'var(--text)' },
          ].map((m, i) => (
            <div key={i}>
              <div className="cmd-metric-label">{m.label}</div>
              <div className="cmd-metric-value" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="cmd-health-grid">
        {health.map((h, i) => {
          const color = h.ok ? 'var(--green)' : h.warn ? 'var(--amber)' : 'var(--rose)';
          const clickable = h.href || h.nav;
          const inner = (
            <div className="cmd-health-card" style={{ borderLeftColor: color, cursor: clickable ? 'pointer' : 'default' }}
              onClick={() => { if (h.nav) setActive(h.nav); else if (h.href) window.open(h.href, '_blank'); }}>
              <div className="cmd-health-label">{h.label}</div>
              <div className="cmd-health-val" style={{ color }}>● {h.text}{clickable ? ' →' : ''}</div>
            </div>
          );
          return <div key={i}>{inner}</div>;
        })}
      </div>

      <div className="cmd-actions">
        <div className="cmd-action-title">Quick Links</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="cmd-btn" onClick={() => setActive('review')}>📸 Review Submissions</button>
          <button className="cmd-btn" onClick={() => setActive('content')}>📅 Content Calendar</button>
          <button className="cmd-btn" onClick={() => setActive('system')}>🛡 System Health</button>
          <a className="cmd-btn" href="https://automation.chain.link/base" target="_blank" rel="noopener noreferrer">⛓ Fund Chainlink</a>
          <a className="cmd-btn" href={`https://basescan.org/address/${VOTING_ADDRESS}`} target="_blank" rel="noopener noreferrer">📊 BaseScan</a>
          <a className="cmd-btn" href="https://railway.app" target="_blank" rel="noopener noreferrer">🚂 Railway</a>
        </div>
      </div>

      {lastRefresh && <div style={{ fontSize: '.6rem', color: 'var(--muted)', textAlign: 'right' }}>Last updated: {lastRefresh}</div>}
    </div>
  );
}

// ─── DAILY PRIORITIES ─────────────────────────────────────────────────────────
const PRIORITY_GROUPS = [
  {
    key: 'daily', title: "Today's Tasks", emoji: '☀️', reset: 'daily',
    tasks: [
      { id: 'd1', label: 'Check round health (System Health tab)', cat: 'Ops' },
      { id: 'd2', label: 'Review pending photo submissions', cat: 'Ops' },
      { id: 'd3', label: 'Check LINK balances at automation.chain.link/base', cat: 'Ops' },
      { id: 'd4', label: 'Scan X + Telegram for community questions', cat: 'Growth' },
    ]
  },
  {
    key: 'weekly', title: 'This Week', emoji: '📅', reset: 'weekly',
    tasks: [
      { id: 'w1', label: 'Generate + approve content calendar posts', cat: 'Content' },
      { id: 'w2', label: 'Review staking APR obligations', cat: 'Finance' },
      { id: 'w3', label: 'Export vote data for weekly report', cat: 'Finance' },
      { id: 'w4', label: 'Confirm round will settle Sunday 23:59 UTC', cat: 'Ops' },
    ]
  },
  {
    key: 'monthly', title: 'This Month', emoji: '📆', reset: 'monthly',
    tasks: [
      { id: 'm1', label: '✅ Railway upgraded to Hobby plan (paid Apr 24)', cat: 'Ops' },
      { id: 'm2', label: 'CoinGecko resubmission', cat: 'Growth', due: 'Due Apr 17' },
      { id: 'm3', label: 'Blockaid false-positive portal re-check', cat: 'Ops' },
      { id: 'm4', label: 'Check Vercel usage and billing', cat: 'Ops' },
      { id: 'm5', label: 'Supabase Pro renewal review', cat: 'Ops' },
    ]
  },
];

function PrioritiesScreen() {
  const today = new Date().toDateString();
  const thisWeek = (() => { const d = new Date(); d.setUTCHours(0,0,0,0); return `w${d.getUTCFullYear()}${Math.floor((d.getTime() - new Date('2026-01-05').getTime()) / 604800000)}`; })();
  const thisMonth = `m${new Date().getUTCFullYear()}${new Date().getUTCMonth()}`;

  const [checks, setChecks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('tt_priorities_v2') || '{}');
      const out = {};
      PRIORITY_GROUPS.forEach(g => {
        g.tasks.forEach(t => {
          if (g.reset === 'daily') out[t.id] = saved._date === today ? (saved[t.id] || false) : false;
          else if (g.reset === 'weekly') out[t.id] = saved._week === thisWeek ? (saved[t.id] || false) : false;
          else out[t.id] = saved._month === thisMonth ? (saved[t.id] || false) : false;
        });
      });
      out._date = today; out._week = thisWeek; out._month = thisMonth;
      return out;
    } catch { return { _date: today, _week: thisWeek, _month: thisMonth }; }
  });

  useEffect(() => {
    localStorage.setItem('tt_priorities_v2', JSON.stringify(checks));
  }, [checks]);

  const toggle = id => setChecks(c => ({ ...c, [id]: !c[id] }));

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Daily Priorities</div>
        <div className="gold-rule" />
        <div className="page-sub">Daily tasks reset each morning · weekly/monthly tasks persist · click to check off</div>
      </div>
      {PRIORITY_GROUPS.map(g => {
        const done = g.tasks.filter(t => checks[t.id]).length;
        return (
          <div key={g.key} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '.7rem', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase' }}>{g.emoji} {g.title}</span>
              <span style={{ fontSize: '.6rem', color: done === g.tasks.length ? 'var(--green)' : 'var(--muted)' }}>{done}/{g.tasks.length} done</span>
            </div>
            {g.tasks.map(t => (
              <div key={t.id} className={`pri-task-row${checks[t.id] ? ' done' : ''}`} onClick={() => toggle(t.id)}>
                <div className={`pri-check${checks[t.id] ? ' checked' : ''}`}>
                  {checks[t.id] && <span style={{ color: '#fff', fontSize: '.7rem', lineHeight: 1 }}>✓</span>}
                </div>
                <span className={`pri-task-text${checks[t.id] ? ' done' : ''}`}>{t.label}</span>
                {t.due && <span style={{ fontSize: '.58rem', background: 'var(--red-dim)', color: 'var(--rose)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{t.due}</span>}
                <span style={{ fontSize: '.55rem', color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 7px', borderRadius: 4, flexShrink: 0 }}>{t.cat}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── KPI DASHBOARD ────────────────────────────────────────────────────────────
function KPIScreen() {
  const [data, setData] = useState({
    rounds: '—', totalVotes: '—', totalPool: '—', avgPool: '—',
    totalUsers: '—', newThisWeek: '—', totalSubs: '—', approvedSubs: '—',
    houseEarned: '—', charityDonated: '—', stakersCount: '—',
    signupBonusCount: '—', signupBonusTTS: '—',
    voteMatchCount: '—', voteMatchTTS: '—',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      sb.get('votes', 'select=voter_wallet,tts_amount,created_at'),
      sb.get('submissions', 'select=id,created_at,status'),
      sb.get('staking_positions', 'status=eq.active&select=id').catch(() => sb.get('stakes', 'select=id').catch(() => [])),
      getRoundInfo(),
      sb.get('bonus_claims', 'bonus_type=eq.signup&select=tts_amount').catch(() => []),
      sb.get('bonus_claims', 'bonus_type=eq.vote_match&select=tts_amount').catch(() => []),
    ]).then(([votes, subs, stakers, round, signupBonuses, voteMatches]) => {
      // Distinct voters = "total users"
      const distinctVoters = new Set(Array.isArray(votes) ? votes.map(v => v.voter_wallet).filter(Boolean) : []);
      const totalUsers = distinctVoters.size;
      const newThisWeek = Array.isArray(votes) ? new Set(votes.filter(v => v.created_at && new Date(v.created_at) > new Date(oneWeekAgo)).map(v => v.voter_wallet).filter(Boolean)).size : 0;
      const totalSubs = Array.isArray(subs) ? subs.length : 0;
      const approvedSubs = Array.isArray(subs) ? subs.filter(s => s.status === 'approved').length : 0;
      const totalPool = Array.isArray(votes) ? votes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0) : 0;
      const roundId = round?.roundId || 1;
      const avgPool = roundId > 0 ? Math.round(totalPool / roundId) : 0;
      const stakersCount = Array.isArray(stakers) ? stakers.length : 0;
      const signupBonusTTS = Array.isArray(signupBonuses) ? Math.round(signupBonuses.reduce((s, b) => s + (Number(b.tts_amount) || 0), 0)) : 0;
      const voteMatchTTS  = Array.isArray(voteMatches)  ? Math.round(voteMatches.reduce((s, b)  => s + (Number(b.tts_amount) || 0), 0)) : 0;
      setData({
        rounds: roundId.toLocaleString(),
        totalVotes: Array.isArray(votes) ? votes.length.toLocaleString() : '0',
        totalPool: Math.round(totalPool).toLocaleString(),
        avgPool: avgPool.toLocaleString(),
        totalUsers: totalUsers.toLocaleString(),
        newThisWeek: newThisWeek.toLocaleString(),
        totalSubs: totalSubs.toLocaleString(),
        approvedSubs: approvedSubs.toLocaleString(),
        houseEarned: Math.round(totalPool * 0.1).toLocaleString(),
        charityDonated: Math.round(totalPool * 0.1).toLocaleString(),
        stakersCount: stakersCount.toString(),
        signupBonusCount: Array.isArray(signupBonuses) ? signupBonuses.length.toLocaleString() : '0',
        signupBonusTTS: signupBonusTTS.toLocaleString(),
        voteMatchCount: Array.isArray(voteMatches) ? voteMatches.length.toLocaleString() : '0',
        voteMatchTTS: voteMatchTTS.toLocaleString(),
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const Section = ({ title, emoji, cells }) => (
    <div className="kpi-section">
      <div className="kpi-section-head">{emoji} {title}</div>
      <div className="kpi-grid">
        {cells.map(([label, value, sub], i) => (
          <div key={i} className="kpi-cell">
            <div className="kpi-cell-label">{label}</div>
            <div className="kpi-cell-value">{loading ? '…' : value}</div>
            {sub && <div className="kpi-cell-sub">{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title">KPI Dashboard</div>
        <div className="gold-rule" />
        <div className="page-sub">Game, user, and financial performance metrics · refreshes on load</div>
      </div>
      <Section title="Game Metrics" emoji="🎮" cells={[
        ['Rounds Run', data.rounds, 'total rounds'],
        ['Total Votes Cast', data.totalVotes, 'across all rounds'],
        ['Cumulative Pool', data.totalPool, '$TTS voted all-time'],
        ['Avg Pool / Round', data.avgPool, '$TTS per round'],
      ]} />
      <Section title="User Metrics" emoji="👥" cells={[
        ['Total Users', data.totalUsers, 'registered wallets'],
        ['New This Week', data.newThisWeek, 'last 7 days'],
        ['Total Submissions', data.totalSubs, 'all time'],
        ['Approved Profiles', data.approvedSubs, 'ever approved'],
        ['Active Stakers', data.stakersCount, 'current positions'],
      ]} />
      <Section title="Financial (est.)" emoji="💰" cells={[
        ['House Revenue', data.houseEarned, '$TTS (10% of all pools)'],
        ['Charity Donated', data.charityDonated, '$TTS to Polaris Project'],
      ]} />
      <Section title="Bonus System" emoji="🎁" cells={[
        ['Signup Bonuses Sent', data.signupBonusCount, 'new user welcome bonuses'],
        ['Signup Bonus TTS', data.signupBonusTTS, '$TTS distributed'],
        ['Vote Matches Sent', data.voteMatchCount, 'first-vote matches'],
        ['Vote Match TTS', data.voteMatchTTS, '$TTS matched'],
      ]} />
    </div>
  );
}

// ─── OPERATIONS MANUAL ───────────────────────────────────────────────────────
const OPS_MANUAL = [
  {
    title: 'Round Start Checklist', emoji: '🚀',
    steps: [
      'TTSKeeper2 fires automatically at Monday 00:00 UTC via Chainlink Automation — verify on BaseScan',
      'If automation fails: BaseScan → TTSKeeper2 (0xB17b…C61A48) → Write → manualExecute(1)',
      'Approve pending profiles: Photo Review tab → Approve (updates Supabase; on-chain approval requires batchApproveProfiles via BaseScan)',
      'Generate + approve content calendar: Content Calendar tab → Generate This Week → approve posts',
      'Verify LINK balances > 3 LINK at automation.chain.link/base',
    ]
  },
  {
    title: 'Round Settlement', emoji: '🏆',
    steps: [
      'Keeper fires automatically at round end (Sunday 23:59 UTC) — calls settleRound → requests VRF',
      'Chainlink VRF V2.5 fulfills within ~30s (3 confirmations) — winner selected proportionally to tickets',
      'Payout split: 40% winner profile · 40% top voter · 10% house · 10% charity (Polaris Project)',
      'If keeper misses: BaseScan → TTSKeeper2 → Write → manualExecute(3)',
      'Confirm settlement: BaseScan → TTSVotingV3 → Events tab → look for RoundSettled',
    ]
  },
  {
    title: 'Emergency Procedures', emoji: '🚨',
    steps: [
      'LINK depleted: fund upkeeps immediately at automation.chain.link/base (keep > 5 LINK each)',
      'Railway bot offline: check railway.app → proud-unity project; upgrade Trial → Hobby if expired',
      'VRF stuck > 5 min: check sub balance at vrf.chain.link — sub ID starts 58222014…',
      'Exploit / wrong winner: pause via Gnosis Safe multisig (0xeFb59d88…DE6fB86) — needs 2/2 sigs',
      'Vercel down: check vercel.com → cryptofitjims-projects → temptation-token',
      'Supabase unreachable: check status.supabase.com; contact support@supabase.io',
    ]
  },
  {
    title: 'Infrastructure Reference', emoji: '🔧',
    steps: [
      'Vercel: cryptofitjims-projects · Project: temptation-token · Auto-deploys on git push to main',
      'Railway: proud-unity · Bot: @TTSGameBot · Broadcaster: @TTSBroadcastBot · Trial exp Apr 27 2026',
      'Supabase: gmlikdxykgviyprqtqwz (Pro plan) · Tables: users, submissions, votes, staking_positions, scheduled_posts',
      'Chainlink Automation Registry: 0xf4bAb6A129164aBa9B113cB96BA4266dF49f8743 · 4 upkeeps',
      'VRF Sub ID: 58222014484560539249027457203866883376041731162442592604288474822166186263722',
      'Gnosis Safe: 0xeFb59d88179edC49bDA60B43249722Ea0DE6fB86 · 2/2 multisig (deployer + partner)',
    ]
  },
  {
    title: 'Social Media Templates', emoji: '📢',
    templates: [
      { name: 'X — Round Start', href: 'https://x.com/compose/tweet', flow: 'Copy → twitter.com/compose → Paste → Post', text: '🔥 Round is LIVE on @TemptationToken!\n\nVote for your favourite profile and win $TTS!\n\n👉 app.temptationtoken.io\n\n#TTS #Base #Web3' },
      { name: 'X — Round End Alert', href: 'https://x.com/compose/tweet', flow: 'Copy → twitter.com/compose → Paste → Post', text: '⏰ Final hours of voting!\n\nGet your votes in before the round closes.\n\n👉 app.temptationtoken.io\n\n#TTS #Base' },
      { name: 'Telegram — Winner', href: 'https://t.me/TTSCommunityChat', flow: 'Copy → open @TTSCommunityChat → Paste → Send', text: '🏆 Round settled! Congratulations to our winner!\n\nNew round starts Monday — get your $TTS ready.\n\n👉 app.temptationtoken.io\n\n#TTS #Base' },
      { name: 'Instagram — New Profile', href: 'https://instagram.com', flow: 'Copy caption → Open Instagram app → + → Paste caption → Post', text: '👀 New profile just joined the voting!\n\nHead to the link in bio and cast your vote. 🗳️\n\n#TTS #Web3 #Crypto #Base #NFT #Creator' },
    ]
  },
];

function ManualScreen() {
  const [open, setOpen] = useState({ 0: true });
  const [copied, setCopied] = useState(null);

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key); setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Operations Manual</div>
        <div className="gold-rule" />
        <div className="page-sub">Playbooks, emergency procedures, and copy-paste templates · click to expand</div>
      </div>
      {OPS_MANUAL.map((section, i) => (
        <div key={i} className="manual-section">
          <button className="manual-toggle" onClick={() => setOpen(o => ({ ...o, [i]: !o[i] }))}>
            <span className="manual-toggle-title">{section.emoji} {section.title}</span>
            <span className={`manual-arrow${open[i] ? ' open' : ''}`}>▾</span>
          </button>
          {open[i] && (
            <div className="manual-body">
              {section.steps && section.steps.map((step, j) => (
                <div key={j} className="manual-step">
                  <span className="manual-step-num">{j + 1}.</span>
                  <span className="manual-step-text">{step}</span>
                </div>
              ))}
              {section.templates && section.templates.map((tpl, j) => (
                <div key={j} className="manual-tpl">
                  <div className="manual-tpl-head">
                    <div>
                      <span className="manual-tpl-name">{tpl.name}</span>
                      {tpl.flow && <div style={{ fontSize:'.6rem', color:'var(--muted)', marginTop:2, fontStyle:'italic' }}>Flow: {tpl.flow}</div>}
                    </div>
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {tpl.href && <a href={tpl.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration:'none' }}><button className="manual-copy-btn">Open →</button></a>}
                      <button className={`manual-copy-btn${copied === `${i}-${j}` ? ' copied' : ''}`}
                        onClick={() => copyText(tpl.text, `${i}-${j}`)}>
                        {copied === `${i}-${j}` ? '✓ Copied' : '📋 Copy'}
                      </button>
                    </div>
                  </div>
                  <pre className="manual-tpl-text">{tpl.text}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── SIDEBAR NAV CONFIG ───────────────────────────────────────────────────────
const NAV = [
  { section: "Command", items: [
    { key: "command",    icon: "🎯", label: "Command Center" },
    { key: "priorities", icon: "✅", label: "Daily Priorities" },
    { key: "kpi",        icon: "📈", label: "KPI Dashboard" },
    { key: "manual",     icon: "📖", label: "Operations Manual" },
  ]},
  { section: "Operations", items: [
    { key: "overview",  icon: "📊", label: "Overview" },
    { key: "review",    icon: "📸", label: "Photo Review" },
    { key: "content",   icon: "📅", label: "Content Calendar" },
    { key: "social",    icon: "📱", label: "Social Media" },
    { key: "system",    icon: "🛡️", label: "System Health" },
  ]},
  { section: "Finance", items: [
    { key: "payouts",   icon: "💸", label: "Payouts" },
    { key: "staking",   icon: "🔒", label: "Staking" },
    { key: "wallets",   icon: "💼", label: "Wallets" },
    { key: "referral",  icon: "🔗", label: "Referrals" },
  ]},
  { section: "Settings", items: [
    { key: "users",     icon: "👤", label: "Users" },
    { key: "settings",  icon: "⚙️", label: "Settings" },
  ]},
];

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function AdminApp() {
  useEffect(() => { injectStyles(); }, []);
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState("command");
  const clock = useLiveClock();
  const weekLabel = useCurrentWeek();
  const [toast, showToast] = useToast();

  if (!loggedIn) return <div className="adm-app"><LoginScreen onLogin={() => setLoggedIn(true)} /></div>;

  const screenProps = { showToast };
  const screens = {
    command:    <CommandScreen setActive={setActive} />,
    priorities: <PrioritiesScreen />,
    kpi:        <KPIScreen />,
    manual:     <ManualScreen />,
    overview:   <OverviewScreen />,
    review:     <ReviewScreen {...screenProps} />,
    content:    <ContentCalendarScreen {...screenProps} />,
    social:     <SocialScreen {...screenProps} />,
    users:      <UsersScreen {...screenProps} />,
    wallets:    <WalletsScreen />,
    payouts:    <PayoutsScreen {...screenProps} />,
    staking:    <StakingScreen />,
    referral:   <ReferralScreen showToast={showToast} />,
    settings:   <SettingsScreen />,
    system:     <SystemScreen />,
  };

  const titles = {
    command: "Command Center", priorities: "Daily Priorities", kpi: "KPI Dashboard", manual: "Operations Manual",
    overview: "Overview", review: "Photo Review", content: "Content Calendar", social: "Social Media",
    users: "User Management", wallets: "Wallets", payouts: "Payouts",
    staking: "Staking", referral: "Referrals", settings: "Settings", system: "System Health"
  };

  return (
    <div className="adm-app">
      <div className="adm-layout">
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-logo">
            <div className="sidebar-logo-text">✦ Temptation Token</div>
            <span className="sidebar-badge">Admin Portal</span>
          </div>
          <div className="sidebar-nav">
            {NAV.map(section => (
              <div key={section.section}>
                <div className="nav-section-label">{section.section}</div>
                {section.items.map(item => (
                  <button
                    key={item.key}
                    className={`nav-btn${active === item.key ? " active" : ""}`}
                    onClick={() => setActive(item.key)}
                  >
                    <span className="icon">{item.icon}</span>
                    {item.label}
                    {item.badge && <span className="nav-badge">{item.badge}</span>}
                  </button>
                ))}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <button className="logout-btn" onClick={() => setLoggedIn(false)}>
              <span>🚪</span> Log Out
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="adm-main">
          <div className="topbar">
            <div className="topbar-title">{titles[active]}</div>
            <div className="topbar-right">
              <span className="topbar-week"><span className="dot-live" />Week of {weekLabel}</span>
              <span className="topbar-week" style={{ fontFamily:'monospace', fontSize:'.65rem', color:'var(--muted)', letterSpacing:'.04em' }}>{clock}</span>
              <span className="admin-pill">Admin · Blockchain Entertainment LLC</span>
            </div>
          </div>
          <AlertsBanner setActive={setActive} />
          <div className="adm-page">
            {screens[active]}
          </div>
        </div>
      </div>

      {/* TOAST */}
      <div className={`adm-toast ${toast.type}${toast.show ? " show" : ""}`}>{toast.msg}</div>
    </div>
  );
}
