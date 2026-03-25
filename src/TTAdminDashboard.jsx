import { useState, useEffect } from "react";

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
  { label: "Master Wallet", name: "Blockchain Entertainment LLC", addr: "0x — ADD ADDRESS", balance: "2,400,000", network: "Base Mainnet" },
  { label: "Weekly Voting Pool", name: "Escrow — Weekly Votes", addr: "0x — ADD ADDRESS", balance: "141,550", network: "Base Mainnet" },
  { label: "Staking Lock", name: "Locked Staking Vault", addr: "0x — ADD ADDRESS", balance: "890,000", network: "Base Mainnet" },
  { label: "Sign-Up Bonus", name: "New User Airdrop Wallet", addr: "0x — ADD ADDRESS", balance: "690,000", network: "Base Mainnet" },
  { label: "Company Revenue", name: "Blockchain Entertainment LLC — Revenue", addr: "0x — ADD ADDRESS", balance: "48,200", network: "Base Mainnet" },
  { label: "Nonprofit", name: "Polaris Project Donations", addr: "0x — ADD ADDRESS", balance: "9,640", network: "Base Mainnet" },
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
    if (user === "admin" && pass === "TTS2026!") { onLogin(); }
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
  const stats = [
    { label: "Total Users", value: "1,284", sub: "↑ 48 this week", cls: "" },
    { label: "Active This Week", value: "891", sub: "69% engagement", cls: "" },
    { label: "Total Pool This Week", value: "141,550", sub: "$TTS in escrow", cls: "gold" },
    { label: "Submissions Pending", value: "6", sub: "Awaiting review", cls: "rose" },
    { label: "Approved Profiles", value: "38", sub: "Active this week", cls: "green" },
  ];
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Overview</div>
        <div className="gold-rule" />
        <div className="page-sub"><span className="dot-live" />Live · Week of March 3–9, 2026 · Base Mainnet</div>
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
          <span className="table-count">Week of Mar 3–9</span>
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
            {WEEK_VOTES.map((v, i) => (
              <tr key={i}>
                <td style={{ color: i === 0 ? "var(--gold)" : "var(--muted)", fontFamily: "var(--font-display)", fontSize: "1rem" }}>{i + 1}</td>
                <td style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", fontStyle: "italic" }}>{v.name}</td>
                <td style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem", color: "var(--gold-light)" }}>{v.votes.toLocaleString()}</td>
                <td style={{ width: 140 }}>
                  <div style={{ fontSize: "0.6rem", color: "var(--muted)", marginBottom: 3 }}>{Math.round((v.votes / TOTAL_POOL) * 100)}% of pool</div>
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
        <div className="payout-title">Projected Prize Distribution — Week of Mar 3–9</div>
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

function ReviewScreen({ showToast }) {
  const [queue, setQueue] = useState(PENDING_SUBMISSIONS);
  const [confirmed, setConfirmed] = useState(null); // { id, action }

  const execute = () => {
    const { id, action } = confirmed;
    setQueue(q => q.filter(s => s.id !== id));
    if (action === "approve") showToast("✓ Profile approved — user notified in-app", "success");
    else showToast("✕ Profile denied — user notified in-app per policy", "info");
    setConfirmed(null);
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
                  <a className="review-link" href={s.linkUrl} target="_blank" rel="noopener noreferrer">🔗 {s.link}</a>
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
  const [users, setUsers] = useState(ALL_USERS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

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
        ⚠ Wallet addresses below are placeholders. Replace each "0x — ADD ADDRESS" with your actual Base wallet address before going live. Verify every address triple-checked. Funds sent to incorrect addresses are irrecoverable.
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

function PayoutsScreen({ showToast }) {
  const [week, setWeek] = useState("Mar 3–9, 2026");
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Payouts</div>
        <div className="gold-rule" />
        <div className="page-sub">Review prize distributions before executing on Base smart contract</div>
      </div>
      <div className="week-select-row">
        <span className="week-select-label">Week:</span>
        <select className="filter-select" value={week} onChange={e => setWeek(e.target.value)}>
          <option>Mar 3–9, 2026</option>
          <option>Feb 24 – Mar 2, 2026</option>
          <option>Feb 17–23, 2026</option>
        </select>
      </div>

      <div className="table-card" style={{ marginBottom: 20 }}>
        <div className="table-head">
          <span className="table-head-title">🏆 Winning Summary — {week}</span>
        </div>
        <table className="adm-table">
          <thead>
            <tr><th>Recipient</th><th>Role</th><th>Amount</th><th>Wallet</th><th>Status</th></tr>
          </thead>
          <tbody>
            {[
              { r: "VoterKing99", role: "Top Voter", amt: "56,620 + stake", wallet: "0x11aa...2233", status: "pending" },
              { r: "Scarlett_V", role: "Winning Profile", amt: "56,620", wallet: "0x4a3b...c291", status: "pending" },
              { r: "Blockchain Ent. LLC", role: "Company (10%)", amt: "14,155", wallet: "0x — MASTER", status: "pending" },
              { r: "Polaris Project", role: "Nonprofit (10%)", amt: "14,155", wallet: "0x — POLARIS", status: "pending" },
            ].map((row, i) => (
              <tr key={i}>
                <td style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: "0.95rem" }}>{row.r}</td>
                <td style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{row.role}</td>
                <td style={{ fontFamily: "var(--font-display)", color: "var(--gold-light)" }}>{row.amt} $TTS</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "var(--gold-dim)" }}>{row.wallet}</td>
                <td><span className="badge badge-pending">{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="login-btn" style={{ flex: 1, minWidth: 200 }} onClick={() => showToast("Payout transaction broadcast on Base — TX pending confirmation", "success")}>
          Execute Payouts on Base
        </button>
        <button className="login-btn" style={{ flex: 1, minWidth: 200, background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }} onClick={() => showToast("Payout report exported", "info")}>
          Export Report
        </button>
      </div>
      <div style={{ marginTop: 12, fontSize: "0.6rem", color: "var(--muted)", lineHeight: 1.7 }}>
        Executing payouts triggers the Base smart contract to distribute funds atomically. Ensure all wallet addresses are verified before proceeding. This action cannot be reversed once confirmed on-chain.
      </div>
    </div>
  );
}

function StakingScreen() {
  const stakers = [
    { handle: "CryptoQueen", wallet: "0x22bb...3344", amount: "8,750", tier: "Gold", boost: "1.5×", apr: "18%", locked: "6 months", unlocks: "Aug 3, 2026" },
    { handle: "FlameVoter", wallet: "0x55ee...6677", amount: "5,100", tier: "Silver", boost: "1.25×", apr: "12%", locked: "3 months", unlocks: "Jun 3, 2026" },
    { handle: "TokenHunter", wallet: "0x33cc...4455", amount: "350", tier: "Bronze", boost: "1.1×", apr: "8%", locked: "3 months", unlocks: "Jun 8, 2026" },
  ];
  const totalStaked = stakers.reduce((a, s) => a + parseInt(s.amount.replace(",", "")), 0);

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
        <div className="stat-card"><div className="stat-label">Est. APR Obligations</div><div className="stat-value rose">~1,840</div><div className="stat-sub">$TTS owed this period</div></div>
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
            { label: "Profile Submission Cost", value: "1 $TTS" },
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

// ─── SIDEBAR NAV CONFIG ───────────────────────────────────────────────────────
const NAV = [
  { section: "Dashboard", items: [
    { key: "overview",    icon: "📊", label: "Overview" },
    { key: "review",      icon: "📸", label: "Photo Review", badge: 6 },
    { key: "users",       icon: "👤", label: "Users" },
    { key: "payouts",     icon: "💸", label: "Payouts" },
    { key: "staking",     icon: "🔒", label: "Staking" },
    { key: "wallets",     icon: "💼", label: "Wallets" },
    { key: "referral",    icon: "🔗", label: "Referrals" },
    { key: "settings",    icon: "⚙️", label: "Settings" },
  ]},
];

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function AdminApp() {
  useEffect(() => { injectStyles(); }, []);
  const [loggedIn, setLoggedIn] = useState(false);
  const [active, setActive] = useState("overview");
  const [toast, showToast] = useToast();

  if (!loggedIn) return <div className="adm-app"><LoginScreen onLogin={() => setLoggedIn(true)} /></div>;

  const screenProps = { showToast };
  const screens = {
    overview: <OverviewScreen />,
    review:   <ReviewScreen {...screenProps} />,
    users:    <UsersScreen {...screenProps} />,
    wallets:  <WalletsScreen />,
    payouts:  <PayoutsScreen {...screenProps} />,
    staking:  <StakingScreen />,
    referral: <ReferralScreen showToast={showToast} />,
    settings: <SettingsScreen />,
  };

  const titles = {
    overview: "Overview", review: "Photo Review", users: "User Management",
    wallets: "Wallets", payouts: "Payouts", staking: "Staking", settings: "Settings"
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
              <span className="topbar-week"><span className="dot-live" />Week of Mar 3–9, 2026</span>
              <span className="admin-pill">Admin · Blockchain Entertainment LLC</span>
            </div>
          </div>
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
