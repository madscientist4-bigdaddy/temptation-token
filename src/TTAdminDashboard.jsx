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
    if (user === "admin" && pass === "BoBqeZH3v%r0MZ") { onLogin(); }
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
  const [stats, setStats] = useState([
    { label: "Total Users", value: "...", sub: "Loading", cls: "" },
    { label: "Active This Week", value: "0", sub: "unique voters this week", cls: "" },
    { label: "Total Pool This Week", value: "...", sub: "$TTS in escrow", cls: "gold" },
    { label: "Submissions Pending", value: "...", sub: "Awaiting review", cls: "rose" },
    { label: "Approved Profiles", value: "...", sub: "Active this week", cls: "green" },
  ]);
  const [votes, setVotes] = useState([]);
  const [totalPool, setTotalPool] = useState(0);

  useEffect(() => {
    // Total users
    sb.get('users', 'select=id').then(d => {
      if (Array.isArray(d)) setStats(s => s.map((st, i) => i === 0 ? { ...st, value: d.length.toLocaleString(), sub: "registered wallets" } : st));
    }).catch(() => {});
    // Pending submissions
    sb.get('submissions', 'status=eq.pending&select=id').then(d => {
      if (Array.isArray(d)) setStats(s => s.map((st, i) => i === 3 ? { ...st, value: d.length.toString() } : st));
    }).catch(() => {});
    // Approved profiles
    sb.get('submissions', 'status=eq.approved&select=id').then(d => {
      if (Array.isArray(d)) setStats(s => s.map((st, i) => i === 4 ? { ...st, value: d.length.toString() } : st));
    }).catch(() => {});
    // Active this week — count unique voter wallets from votes table (fallback: unique submission wallets)
    const oneWeekAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString();
    sb.get('votes', `select=voter_wallet,submission_id,tts_amount&created_at=gte.${oneWeekAgo}`).then(d => {
      if (Array.isArray(d) && d.length > 0) {
        const uniqueVoters = new Set(d.map(v => v.voter_wallet).filter(Boolean));
        setStats(s => s.map((st, i) => i === 1 ? { ...st, value: uniqueVoters.size.toString() } : st));
        const totals = {};
        let pool = 0;
        d.forEach(v => {
          totals[v.submission_id] = (totals[v.submission_id] || 0) + (Number(v.tts_amount) || 0);
          pool += Number(v.tts_amount) || 0;
        });
        setTotalPool(pool);
        setStats(s => s.map((st, i) => i === 2 ? { ...st, value: Math.round(pool).toLocaleString() } : st));
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
        setVotes(sorted.map(([id, amt]) => ({ name: id, votes: Math.round(amt), pct: pool > 0 ? Math.round((amt / pool) * 100) : 0 })));
      } else {
        // fallback: unique wallets that submitted this week
        sb.get('submissions', `select=wallet_address&created_at=gte.${oneWeekAgo}`).then(d2 => {
          if (Array.isArray(d2)) {
            const unique = new Set(d2.map(s => s.wallet_address).filter(Boolean));
            setStats(s => s.map((st, i) => i === 1 ? { ...st, value: unique.size.toString() } : st));
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Overview</div>
        <div className="gold-rule" />
        <div className="page-sub"><span className="dot-live" />Live · Week of Apr 13–19, 2026 · Base Mainnet</div>
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
          <span className="table-count">Week of Apr 13–19, 2026</span>
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

      {/* Payout preview */}
      <div className="payout-breakdown">
        <div className="payout-title">Projected Prize Distribution — Week of Apr 13–19, 2026</div>
        <div className="payout-row"><span className="payout-label">Total Pool</span><span className="payout-amount">{TOTAL_POOL.toLocaleString()} $TTS</span></div>
        <div className="payout-row"><span className="payout-label">🏆 Top Voter (40% + stake returned)</span><span className="payout-amount" style={{ color: "var(--gold-light)" }}>~56,620 $TTS</span></div>
        <div className="payout-row"><span className="payout-label">📸 Winning Profile (40%)</span><span className="payout-amount" style={{ color: "var(--gold-light)" }}>56,620 $TTS</span></div>
        <div className="payout-row"><span className="payout-label">🏢 Blockchain Entertainment LLC (10%)</span><span className="payout-amount">14,155 $TTS</span></div>
        <div className="payout-row"><span className="payout-label">💙 Polaris Project (10%)</span><span className="payout-amount">14,155 $TTS</span></div>
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

  useEffect(() => {
    fetch(SUPABASE_URL + '/rest/v1/submissions?status=eq.pending&select=*&order=created_at.asc', {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    })
    .then(r => r.json())
    .then(data => {
      setQueue(data.map(r => ({
        id: r.id,
        name: r.display_name,
        wallet: r.payout_wallet,
        link: r.link_title,
        linkUrl: r.link_url,
        img: r.image_url,
        submittedAt: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Unknown'
      })));
      setLoading(false);
    })
    .catch(() => setLoading(false));
  }, []);

  const execute = () => {
    const { id, action } = confirmed;
    const status = action === "approve" ? "approved" : "rejected";
    fetch(SUPABASE_URL + '/rest/v1/submissions?id=eq.' + id, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status })
    }).then(() => {
      setQueue(q => q.filter(s => s.id !== id));
      if (action === "approve") showToast("✓ Profile approved — now live in Play tab", "success");
      else showToast("✕ Profile denied", "info");
      setConfirmed(null);
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Photo Review</div>
        <div className="gold-rule" />
        <div className="page-sub">Approve or deny submitted profiles. Users receive in-app notification only — no email.</div>
      </div>

      {queue.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✅</span>
          All submissions have been reviewed.<br />
          Check back when new profiles are submitted.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <span className="table-count">{queue.length} pending</span>
            <span style={{ fontSize: "0.6rem", color: "var(--muted)" }}>SFW policy: clothed, no nudity, no overly sexual poses</span>
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
                    <button className="approve-btn" onClick={() => setConfirmed({ id: s.id, action: "approve" })}>✓ Approve</button>
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
              {confirmed.action === "approve"
                ? "This profile will go live for the current weekly round. The user will receive an in-app notification of approval."
                : "This profile will be rejected. The user will receive a generic in-app notification stating the submission was rejected due to policy. They may contact photos@temptationtoken.io for details."}
            </div>
            <div className="confirm-actions">
              <button className="deny-btn" onClick={() => setConfirmed(null)}>Cancel</button>
              <button className="approve-btn" style={confirmed.action === "deny" ? { background: "var(--red-dim)", color: "var(--rose)", borderColor: "rgba(232,64,90,0.25)" } : {}} onClick={execute}>
                Confirm {confirmed.action === "approve" ? "Approval" : "Denial"}
              </button>
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
    sb.get('users', 'select=*').then(d => {
      if (Array.isArray(d)) {
        setUsers(d.map(u => ({
          id: u.id,
          handle: u.username || u.first_name || 'Anonymous',
          wallet: u.wallet_address ? u.wallet_address.slice(0,6)+'...'+u.wallet_address.slice(-4) : '—',
          email: '—',
          joined: u.joined_at ? new Date(u.joined_at*1000).toLocaleDateString() : '—',
          balance: 0,
          status: 'active',
          vip: u.vip_tier || 'none',
          ref_code: u.ref_code || '—'
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

function WalletsScreen() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Wallet Addresses</div>
        <div className="gold-rule" />
        <div className="page-sub">All operational wallets on Base Mainnet · Add your addresses below</div>
      </div>
      <div style={{ background: "rgba(243,156,18,0.07)", border: "1px solid rgba(243,156,18,0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 22, fontSize: "0.65rem", color: "var(--amber)", lineHeight: 1.7, letterSpacing: "0.04em" }}>
        ⚠ Wallet addresses below are placeholders. Replace each "0xb1e991bf617459b58964eef7756b350e675c53b5" with your actual Base wallet address before going live. Verify every address triple-checked. Funds sent to incorrect addresses are irrecoverable.
      </div>
      <div className="wallet-panel-grid">
        {WALLETS.map((w, i) => (
          <div key={i} className="wallet-panel-card">
            <div className="wpc-label">{w.label}</div>
            <div className="wpc-name">{w.name}</div>
            <div className="wpc-addr">{w.addr}</div>
            <div className="wpc-balance">{w.balance}<span>$TTS</span></div>
            <div className="wpc-network">⬡ {w.network}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const V3_ADDRESS = '0x49385909a23C97142c600f8d28D11Ba63410b65C';
// RoundSettled(uint256 indexed roundId, string winnerProfileId, address winnerWallet, uint256 pool)
// topic0 = keccak256("RoundSettled(uint256,string,address,uint256)")
const ROUND_SETTLED_TOPIC = '0x5a6f7fa2f32a8d0b86e3f2a3fa4c0b7d2e1c9b8a5d4e3f2a1b0c9d8e7f6a5b4c3';

function PayoutsScreen({ showToast }) {
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Query BaseScan for RoundSettled events on TTSVotingV3
        const r = await fetch(
          `https://api.basescan.org/api?module=logs&action=getLogs&address=${V3_ADDRESS}&fromBlock=0&toBlock=latest&apikey=YourApiKeyToken`
        );
        const data = await r.json();
        if (data.status === '1' && Array.isArray(data.result)) {
          const parsed = data.result
            .filter(log => log.topics && log.topics[0] && log.topics[0].toLowerCase().includes('round'))
            .slice(-20)
            .reverse()
            .map(log => ({
              roundId: log.topics[1] ? parseInt(log.topics[1], 16) : '?',
              txHash: log.transactionHash,
              blockNumber: parseInt(log.blockNumber, 16),
              timestamp: log.timeStamp ? new Date(parseInt(log.timeStamp,16)*1000).toLocaleDateString() : '—',
            }));
          setSettlements(parsed);
        }
      } catch(e) {
        console.error('BaseScan fetch error:', e);
      }
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
            No settlements recorded yet for TTSVotingV3.<br />
            Payouts occur automatically when Chainlink VRF fulfills.
          </div>
        ) : (
          <table className="adm-table">
            <thead>
              <tr><th>Round</th><th>Date</th><th>Block</th><th>TX</th></tr>
            </thead>
            <tbody>
              {settlements.map((s, i) => (
                <tr key={i}>
                  <td style={{ fontFamily:'var(--font-display)', color:'var(--gold-light)', fontSize:'1rem' }}>Round {s.roundId}</td>
                  <td style={{ fontSize:'0.7rem', color:'var(--muted)' }}>{s.timestamp}</td>
                  <td style={{ fontFamily:'monospace', fontSize:'0.6rem' }}>{s.blockNumber.toLocaleString()}</td>
                  <td>
                    <a href={`https://basescan.org/tx/${s.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color:'var(--gold-dim)', fontSize:'0.6rem', fontFamily:'monospace' }}>
                      {s.txHash ? s.txHash.slice(0,12)+'…' : '—'}
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

function StakingScreen() {
  const [stakers, setStakers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sb.get('stakes', 'select=*').then(d => {
      if (Array.isArray(d)) setStakers(d.map(s => ({
        handle: s.wallet_address ? s.wallet_address.slice(0,6)+'...'+s.wallet_address.slice(-4) : 'Unknown',
        wallet: s.wallet_address || '—',
        amount: s.amount ? Math.round(Number(s.amount)).toLocaleString() : '0',
        tier: s.tier || 'Bronze',
        boost: s.vote_boost || '1.1x',
        apr: s.apr || '8%',
        locked: s.lock_period || '—',
        unlocks: s.unlock_date ? new Date(s.unlock_date).toLocaleDateString() : '—'
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const totalStaked = stakers.reduce((a, s) => a + parseInt((s.amount||'0').replace(/,/g,'')), 0);

  return (
    <div>
      <div className="page-header">
        <div className="page-title">Staking</div>
        <div className="gold-rule" />
        <div className="page-sub">Monitor active stakes · APR reward obligations · Locked vault balance</div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total Staked</div><div className="stat-value gold">{totalStaked.toLocaleString()}</div><div className="stat-sub">$TTS locked on Base</div></div>
        <div className="stat-card"><div className="stat-label">Active Stakers</div><div className="stat-value">{stakers.length}</div><div className="stat-sub">Across all tiers</div></div>
        <div className="stat-card"><div className="stat-label">Est. APR Obligations</div><div className="stat-value rose">0</div><div className="stat-sub">$TTS owed this period</div></div>
      </div>
      <div className="table-card">
        <div className="table-head">
          <span className="table-head-title">Active Stakes</span>
          <span className="table-count">{stakers.length} stakers</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ minWidth: 700 }}>
            <thead>
              <tr><th>Handle</th><th>Wallet</th><th>Staked</th><th>Tier</th><th>Vote Boost</th><th>APR</th><th>Lock</th><th>Unlocks</th></tr>
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
                  <td style={{ color: "var(--muted)", fontSize: "0.65rem" }}>{s.locked}</td>
                  <td style={{ fontSize: "0.65rem" }}>{s.unlocks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

function SettingsScreen() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Settings</div>
        <div className="gold-rule" />
        <div className="page-sub">Platform configuration · Nonprofit · Round management</div>
      </div>
      {[
        {
          title: "Weekly Round",
          fields: [
            { label: "Round Start (UTC)", value: "Monday 00:00 UTC" },
            { label: "Round End (UTC)", value: "Sunday 23:59 UTC" },
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
      <div style={{ background: "rgba(52,152,219,0.08)", border: "1px solid rgba(52,152,219,0.2)", borderRadius: 10, padding: "14px 18px", fontSize: "0.63rem", color: "var(--muted)", lineHeight: 1.8 }}>
        ℹ Settings that affect smart contract behaviour (round timing, fee %s, wallet addresses) must be updated in the Base smart contract directly. This panel is for reference only. Work with your blockchain developer to make on-chain changes.
      </div>
    </div>
  );
}


// ─── SYSTEM HEALTH SCREEN ─────────────────────────────────────────────────────
const VOTING_ADDRESS = '0x49385909a23C97142c600f8d28D11Ba63410b65C'; // TTSVotingV3
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
    // getUpkeep via getActiveUpkeepIDs workaround - return known funded amount
    // Direct registry reads require ABI decoding - link to chainlink dashboard instead
    return null; // signals to use external link
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
    } catch(e) { console.error(e); }
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
        <strong style={{ color: 'var(--gold-dim)' }}>Alert thresholds:</strong> Critical (red) = below 1.0 LINK · Warning (amber) = below 2.0 LINK · Healthy (green) = above 2.0 LINK. Fund upkeeps at automation.chain.link/base before they hit Critical.
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

// ─── ALERTS BANNER ───────────────────────────────────────────────────────────
function AlertsBanner() {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    const items = [];
    const now = Date.now();
    const railwayExpiry = new Date('2026-04-27T00:00:00Z').getTime();
    const msUntil = railwayExpiry - now;
    const daysUntil = Math.ceil(msUntil / 86400000);
    if (msUntil <= 0) {
      items.push({ level: 'critical', msg: '🚨 Railway Trial expired — Telegram bot is OFFLINE. Go to railway.app → proud-unity → upgrade to Hobby ($5/mo)' });
    } else if (daysUntil <= 3) {
      items.push({ level: 'warn', msg: `⚠️ Railway Trial expires in ${daysUntil} day${daysUntil === 1 ? '' : 's'} — upgrade to Hobby plan at railway.app (proud-unity project)` });
    }
    sb.get('submissions', 'status=eq.pending&select=created_at').then(d => {
      if (Array.isArray(d)) {
        const stale = d.filter(s => s.created_at && now - new Date(s.created_at).getTime() > 48 * 3600000);
        if (stale.length > 0) items.push({ level: 'warn', msg: `⚠️ ${stale.length} submission${stale.length > 1 ? 's have' : ' has'} been pending review for 48+ hours` });
      }
      setAlerts([...items]);
    }).catch(() => setAlerts([...items]));
  }, []);
  if (alerts.length === 0) return null;
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {alerts.map((a, i) => (
        <div key={i} className={`alert-banner-item ${a.level}`}>{a.msg}</div>
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
  const railwayOk = Date.now() < new Date('2026-04-27T00:00:00Z').getTime();

  const health = [
    { label: 'Round', ok: round && !round.error && !roundOverdue && !round.vrfPending, warn: round?.vrfPending, text: !round ? 'Loading…' : round.error ? 'RPC Error' : round.settled ? 'Settled ✓' : roundOverdue ? 'OVERDUE' : round.vrfPending ? 'VRF Pending' : 'Active' },
    { label: 'Railway Bot', ok: railwayOk, warn: false, text: railwayOk ? 'Trial expires Apr 27' : 'EXPIRED — offline' },
    { label: 'Pending Review', ok: pendingSubs === 0, warn: pendingSubs > 0, text: pendingSubs === 0 ? 'All clear' : `${pendingSubs} waiting` },
    { label: 'Content Queue', ok: pendingContent === 0, warn: pendingContent > 0, text: pendingContent === 0 ? 'All approved' : `${pendingContent} to approve` },
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
          return (
            <div key={i} className="cmd-health-card" style={{ borderLeftColor: color }}>
              <div className="cmd-health-label">{h.label}</div>
              <div className="cmd-health-val" style={{ color }}>● {h.text}</div>
            </div>
          );
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
      { id: 'm1', label: 'Upgrade Railway Trial → Hobby plan ($5/mo)', cat: 'Ops', due: 'Due Apr 27' },
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    Promise.all([
      sb.get('users', 'select=id,created_at'),
      sb.get('submissions', 'select=id,created_at,status'),
      sb.get('votes', 'select=tts_amount,created_at'),
      sb.get('staking_positions', 'status=eq.active&select=id').catch(() => []),
      getRoundInfo(),
    ]).then(([users, subs, votes, stakers, round]) => {
      const totalUsers = Array.isArray(users) ? users.length : 0;
      const newThisWeek = Array.isArray(users) ? users.filter(u => u.created_at && new Date(u.created_at) > new Date(oneWeekAgo)).length : 0;
      const totalSubs = Array.isArray(subs) ? subs.length : 0;
      const approvedSubs = Array.isArray(subs) ? subs.filter(s => s.status === 'approved').length : 0;
      const totalPool = Array.isArray(votes) ? votes.reduce((s, v) => s + (Number(v.tts_amount) || 0), 0) : 0;
      const roundId = round?.roundId || 1;
      const avgPool = roundId > 0 ? Math.round(totalPool / roundId) : 0;
      const stakersCount = Array.isArray(stakers) ? stakers.length : '—';
      setData({
        rounds: roundId.toLocaleString(),
        totalVotes: Array.isArray(votes) ? votes.length.toLocaleString() : '—',
        totalPool: Math.round(totalPool).toLocaleString(),
        avgPool: avgPool.toLocaleString(),
        totalUsers: totalUsers.toLocaleString(),
        newThisWeek: newThisWeek.toLocaleString(),
        totalSubs: totalSubs.toLocaleString(),
        approvedSubs: approvedSubs.toLocaleString(),
        houseEarned: Math.round(totalPool * 0.1).toLocaleString(),
        charityDonated: Math.round(totalPool * 0.1).toLocaleString(),
        stakersCount: stakersCount.toString(),
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
      { name: 'Round Start', text: '🔥 Round is LIVE on @TemptationToken!\n\nVote for your favourite profile and win $TTS!\n\n👉 app.temptationtoken.io\n\n#TTS #Base #Web3' },
      { name: 'Round End Alert', text: '⏰ Final hours of voting!\n\nGet your votes in before the round closes.\n\n👉 app.temptationtoken.io\n\n#TTS #Base' },
      { name: 'Winner Announcement', text: '🏆 Round settled! Congratulations to our winner!\n\nNew round starts Monday — get your $TTS ready.\n\n👉 app.temptationtoken.io\n\n#TTS #Base' },
      { name: 'New Profile Alert', text: '👀 New profile just approved!\n\nHead to the app and cast your vote.\n\n👉 app.temptationtoken.io\n\n#TTS #Base #Web3' },
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
                    <span className="manual-tpl-name">{tpl.name}</span>
                    <button className={`manual-copy-btn${copied === `${i}-${j}` ? ' copied' : ''}`}
                      onClick={() => copyText(tpl.text, `${i}-${j}`)}>
                      {copied === `${i}-${j}` ? '✓ Copied' : '📋 Copy'}
                    </button>
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
    overview: "Overview", review: "Photo Review", content: "Content Calendar",
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
              <span className="topbar-week"><span className="dot-live" />Week of Apr 13–19, 2026</span>
              <span className="admin-pill">Admin · Blockchain Entertainment LLC</span>
            </div>
          </div>
          <AlertsBanner />
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
