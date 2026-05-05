# Temptation Token — Urgency & FOMO HTML Elements
## Add to homepage to drive immediate action

---

## LIVE ROUND COUNTDOWN TIMER

Paste into Elementor HTML widget near hero section.
Fetches round end time from the on-chain contract via app.temptationtoken.io API.

```html
<div id="tts-countdown-wrap" style="
  background:linear-gradient(135deg,rgba(13,13,13,0.95),rgba(26,13,5,0.95));
  border:1.5px solid rgba(201,168,76,0.4);border-radius:12px;
  padding:18px 22px;margin:16px 0;max-width:500px;
  font-family:'Montserrat',sans-serif;
">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
    <span style="width:8px;height:8px;border-radius:50%;background:#e8405a;display:inline-block;
                 animation:tts-pulse 1.4s infinite;"></span>
    <span style="font-size:.65rem;letter-spacing:.2em;text-transform:uppercase;color:#e8405a;font-weight:700;">
      Round 1 Live
    </span>
  </div>
  <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
    <div style="text-align:center;">
      <div id="tts-days" style="font-size:2rem;font-weight:800;color:#f0d060;font-family:'Cormorant Garamond',serif;line-height:1;">--</div>
      <div style="font-size:.58rem;color:#888;letter-spacing:.1em;text-transform:uppercase;">Days</div>
    </div>
    <div style="text-align:center;">
      <div id="tts-hours" style="font-size:2rem;font-weight:800;color:#f0d060;font-family:'Cormorant Garamond',serif;line-height:1;">--</div>
      <div style="font-size:.58rem;color:#888;letter-spacing:.1em;text-transform:uppercase;">Hours</div>
    </div>
    <div style="text-align:center;">
      <div id="tts-mins" style="font-size:2rem;font-weight:800;color:#f0d060;font-family:'Cormorant Garamond',serif;line-height:1;">--</div>
      <div style="font-size:.58rem;color:#888;letter-spacing:.1em;text-transform:uppercase;">Mins</div>
    </div>
    <div style="text-align:center;">
      <div id="tts-secs" style="font-size:2rem;font-weight:800;color:#f0d060;font-family:'Cormorant Garamond',serif;line-height:1;">--</div>
      <div style="font-size:.58rem;color:#888;letter-spacing:.1em;text-transform:uppercase;">Secs</div>
    </div>
  </div>
  <p style="text-align:center;font-size:.78rem;color:#888;margin-top:10px;">
    Round closes Sunday 11:59 PM EDT · <a href="https://app.temptationtoken.io" style="color:#c9a84c;">Vote now →</a>
  </p>
</div>

<style>
@keyframes tts-pulse {
  0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(232,64,90,.5);}
  50%{opacity:.7;box-shadow:0 0 0 5px rgba(232,64,90,0);}
}
</style>

<script>
(function() {
  // Round ends Sunday 11:59 PM EDT = Monday 03:59 UTC
  // Find next Monday 03:59 UTC
  function getNextRoundEnd() {
    var now = new Date();
    var d = new Date(now);
    var day = d.getUTCDay(); // 0=Sun, 1=Mon...
    var daysToMon = day === 1 ? 7 : (8 - day) % 7 || 7;
    d.setUTCDate(d.getUTCDate() + daysToMon);
    d.setUTCHours(3, 59, 0, 0);
    return d.getTime();
  }

  var endTime = getNextRoundEnd();

  function tick() {
    var now = Date.now();
    var diff = endTime - now;
    if (diff <= 0) {
      document.getElementById('tts-days').textContent = '0';
      document.getElementById('tts-hours').textContent = '00';
      document.getElementById('tts-mins').textContent = '00';
      document.getElementById('tts-secs').textContent = '00';
      return;
    }
    var days = Math.floor(diff / 86400000);
    var hrs = Math.floor((diff % 86400000) / 3600000);
    var mins = Math.floor((diff % 3600000) / 60000);
    var secs = Math.floor((diff % 60000) / 1000);
    document.getElementById('tts-days').textContent = days;
    document.getElementById('tts-hours').textContent = String(hrs).padStart(2,'0');
    document.getElementById('tts-mins').textContent = String(mins).padStart(2,'0');
    document.getElementById('tts-secs').textContent = String(secs).padStart(2,'0');
  }

  tick();
  setInterval(tick, 1000);
})();
</script>
```

---

## PROFILES COMPETING THIS WEEK

Static counter — update manually each Monday, or replace with API call.

```html
<div style="display:inline-flex;align-items:center;gap:10px;
            background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);
            border-radius:50px;padding:10px 20px;margin:8px 0;
            font-family:'Montserrat',sans-serif;">
  <span style="font-size:1.3rem;font-weight:800;color:#c9a84c;">14</span>
  <span style="font-size:.78rem;color:#888;letter-spacing:.06em;">profiles competing this week</span>
</div>
```

---

## POOL GROWING DISPLAY

Links to app for live data. Static fallback with "growing" messaging.

```html
<div style="display:inline-flex;align-items:center;gap:12px;
            background:rgba(46,204,113,0.06);border:1px solid rgba(46,204,113,0.2);
            border-radius:10px;padding:14px 20px;margin:10px 0;
            font-family:'Montserrat',sans-serif;flex-wrap:wrap;">
  <div>
    <div style="font-size:.58rem;letter-spacing:.18em;text-transform:uppercase;color:#888;margin-bottom:2px;">
      Prize Pool
    </div>
    <div style="font-size:1.2rem;font-weight:800;color:#2ecc71;">Growing in $TTS</div>
  </div>
  <a href="https://app.temptationtoken.io"
     style="background:rgba(46,204,113,0.15);border:1px solid rgba(46,204,113,0.3);
            color:#2ecc71;border-radius:6px;padding:8px 16px;font-size:.72rem;
            font-weight:700;text-decoration:none;letter-spacing:.06em;white-space:nowrap;">
    View Live →
  </a>
</div>
```

---

## SOCIAL PROOF LINE

Add near the hero or CTA buttons.

```html
<p style="font-size:.82rem;color:#888;font-family:'Montserrat',sans-serif;
          text-align:center;margin:12px 0;letter-spacing:.04em;">
  🔥 <strong style="color:#c9a84c;">14 profiles</strong> competing this round ·
  Round closes <strong style="color:#f0d060;">Sunday 11:59 PM EDT</strong>
</p>
```

---

## STICKY MOBILE BANNER (optional — bottom of screen on mobile)

Add to homepage. Dismissible. Shows on mobile only.

```html
<div id="tts-sticky-banner" style="
  position:fixed;bottom:0;left:0;right:0;z-index:9999;
  background:linear-gradient(135deg,#1a1000,#0d0d0d);
  border-top:1.5px solid rgba(201,168,76,0.5);
  padding:12px 16px;
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  font-family:'Montserrat',sans-serif;
">
  <div>
    <div style="font-size:.62rem;color:#c9a84c;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">
      🔥 Round Live Now
    </div>
    <div style="font-size:.78rem;color:#e8e8e8;font-weight:600;">Free bonus on signup</div>
  </div>
  <a href="https://app.temptationtoken.io"
     style="background:linear-gradient(135deg,#c9a84c,#a07020);color:#0d0d0d;
            font-weight:800;font-size:.82rem;padding:12px 20px;border-radius:50px;
            text-decoration:none;white-space:nowrap;min-height:44px;
            display:flex;align-items:center;">
    Play Now →
  </a>
  <button onclick="document.getElementById('tts-sticky-banner').style.display='none'"
          style="background:transparent;border:none;color:#888;font-size:1.2rem;
                 cursor:pointer;padding:6px;min-width:32px;min-height:32px;">
    ×
  </button>
</div>
```
