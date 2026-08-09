// ── Club Kit: print-ready one-pager ───────────────────────────────────────────
//
// Turns a registered club into something a venue manager can actually put on a wall:
// their QR code, their code, and a plain-English explanation of what their performers
// get and what the club gets.
//
// The QR encodes `?club=<code>` — NOT `?ref=<code>`. `?ref=` is the user-referral param
// and is validated as a 40-hex wallet, so a club code there is discarded on arrival and
// the printed QR would be a dead link. `?club=` prefills the submit form's club field,
// which is what actually routes the club's 10% at settlement.

import QRCode from 'qrcode'

export const APP_ORIGIN = 'https://app.temptationtoken.io'

export function clubLink(code) {
  return `${APP_ORIGIN}/?club=${encodeURIComponent(String(code).trim().toLowerCase())}`
}

/**
 * QR as an SVG string, embedded inline so the page needs no network at print time.
 *
 * The fixed width/height attributes are STRIPPED and the viewBox kept, so the SVG scales
 * to whatever box it is dropped into. qrcode emits width="520" height="520", which on the
 * phone-sized kit page overflowed its 460px card and forced horizontal scrolling — the
 * page is opened on a phone more often than anywhere else. The print one-pager sets its
 * own size in CSS (.qrbox svg { width: 2.5in }), so it is unaffected.
 */
export async function clubQrSvg(code) {
  const svg = await QRCode.toString(clubLink(code), {
    type: 'svg',
    errorCorrectionLevel: 'M', // survives a photocopy; 'H' makes the modules too dense to scan across a dim room
    margin: 1,
    width: 520,
    color: { dark: '#0c0c14', light: '#ffffff' },
  })
  return svg.replace(/<svg([^>]*)>/, (m, attrs) =>
    `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="100%" height="100%" style="display:block">`)
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
))

/**
 * Full standalone HTML for one club. Printed at US Letter / A4, one page, no images
 * beyond the inline QR, and black-on-white so it photocopies cleanly.
 */
export async function clubOnePagerHtml({ clubName, clubCode, walletAddress }) {
  const code = String(clubCode || '').trim().toLowerCase()
  const name = clubName?.trim() || code.toUpperCase()
  const qr = await clubQrSvg(code)
  const link = clubLink(code)

  return `<!doctype html>
<meta charset="utf-8">
<title>${esc(name)} — Temptation Token Club Kit</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
         color:#111; line-height:1.5; }
  .sheet { max-width: 7.5in; margin:0 auto; }
  h1 { font-size:30px; margin:0 0 2px; letter-spacing:-.02em; }
  h2 { font-size:15px; margin:22px 0 8px; text-transform:uppercase; letter-spacing:.08em; color:#8a6d1f; }
  .sub { color:#555; font-size:14px; margin:0 0 18px; }
  .row { display:flex; gap:26px; align-items:flex-start; }
  .qrbox { flex:0 0 2.5in; text-align:center; }
  .qrbox svg { width:2.5in; height:2.5in; display:block; }
  .code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:26px; font-weight:700;
          letter-spacing:.06em; margin-top:8px; }
  .link { font-size:11px; color:#666; word-break:break-all; margin-top:4px; }
  ol, ul { margin:6px 0 0; padding-left:20px; }
  li { margin-bottom:7px; font-size:14px; }
  .split { border:1.5px solid #d4af37; border-radius:8px; padding:12px 14px; margin-top:10px; background:#fffdf5; }
  .split b { color:#8a6d1f; }
  .foot { margin-top:26px; padding-top:12px; border-top:1px solid #ddd; font-size:11px; color:#666; }
  .wallet { font-family: ui-monospace, Menlo, monospace; font-size:10px; color:#888; word-break:break-all; }
  @media print { .noprint { display:none } }
</style>
<div class="sheet">
  <h1>${esc(name)}</h1>
  <p class="sub">Your venue's Temptation Token partner kit</p>

  <div class="row">
    <div class="qrbox">
      ${qr}
      <div class="code">${esc(code)}</div>
      <div class="link">${esc(link)}</div>
    </div>
    <div style="flex:1">
      <h2 style="margin-top:0">What this is</h2>
      <p style="font-size:14px;margin:0">
        Temptation Token runs a weekly online contest. Your performers enter a photo, the
        public votes on it with $TTS (a cryptocurrency on the Base network), and every week
        the winners get paid. It's free for your performers to be listed and free for you
        to take part.
      </p>

      <h2>What your club gets</h2>
      <div class="split">
        When a performer who used <b>your code</b> wins the week, your club is paid
        <b>10% of that week's prize pool</b>, automatically, straight to your wallet.
        No invoicing, no chasing — the contract pays you at the moment the round settles.
      </div>

      <h2>What your performers get</h2>
      <ul>
        <li><b>35%</b> of the prize pool if their photo wins the week.</li>
        <li><b>500 $TTS free</b> just for signing up.</li>
        <li>Exposure to the whole player base — every voter sees their photo and their link.</li>
      </ul>
    </div>
  </div>

  <h2>How your performers join (30 seconds)</h2>
  <ol>
    <li>Scan the QR code above, or go to <b>${esc(link)}</b></li>
    <li>Tap <b>Connect</b> and create a wallet — an email or Face ID is enough, no crypto experience needed.</li>
    <li>Go to <b>Submit</b>, upload a photo, and enter club code <b>${esc(code)}</b>
        (the QR fills this in automatically).</li>
    <li>Photos are reviewed before going live. Entries must be clothed and SFW — no nudity, no explicit content.</li>
  </ol>

  <h2>Good to know</h2>
  <ul>
    <li>Rounds run <b>Monday 12:00 AM to Sunday 11:59 PM ET</b>. Winners are picked on-chain
        using Chainlink VRF, so the draw is verifiable and nobody — including us — can rig it.</li>
    <li>Entrants must be <b>18 or older</b> and complete a one-time ID check.</li>
    <li><b>10%</b> of every weekly prize pool goes to the Polaris Project, a nonprofit
        fighting human trafficking.</li>
    <li>Questions: <b>support@temptationtoken.io</b></li>
  </ul>

  <div class="foot">
    Club code <b>${esc(code)}</b> · payouts to <span class="wallet">${esc(walletAddress || 'not set')}</span><br>
    Temptation Token is operated by Blockchain Entertainment LLC. $TTS is a digital asset;
    its value can go down as well as up. Nothing here is financial advice.
  </div>

  <p class="noprint" style="margin-top:18px">
    <button onclick="window.print()" style="padding:10px 18px;font-size:14px;cursor:pointer">Print / Save as PDF</button>
  </p>
</div>`
}

/** Open the one-pager in a new tab, ready to print. */
export async function openClubOnePager(club) {
  const html = await clubOnePagerHtml(club)
  const w = window.open('', '_blank')
  if (!w) return false // popup blocked — caller surfaces a message
  w.document.write(html)
  w.document.close()
  return true
}
