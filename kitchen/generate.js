#!/usr/bin/env node
// Cooks the kitchen scene for the profile README.
// The microwave's LED display shows the total number of commits authored on
// GitHub ("commits cooked"); the fridge runs the build. Compiled hot, served cold.
//
// Usage:
//   node kitchen/generate.js              # fetch count (GH_TOKEN optional) and render
//   node kitchen/generate.js --count=123  # render with a fixed count (no network)
//
// Env:
//   GH_TOKEN  — optional token; with a personal PAT the count includes private
//               commits, with the default Actions token it counts public only.
//   GH_LOGIN  — GitHub login to count commits for (default: AkinchanKushwaha)

const fs = require('fs');
const path = require('path');

const LOGIN = process.env.GH_LOGIN || 'AkinchanKushwaha';

async function fetchCommitCount() {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'kitchen-cook' };
  if (process.env.GH_TOKEN) headers.authorization = `Bearer ${process.env.GH_TOKEN}`;
  const res = await fetch(
    `https://api.github.com/search/commits?q=author%3A${LOGIN}&per_page=1`,
    { headers }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const n = data.total_count;
  if (!Number.isFinite(n) || n <= 0) throw new Error(`suspicious commit count: ${n}`);
  return n;
}

// ---------------------------------------------------------------------------
// palettes
// ---------------------------------------------------------------------------

const DARK = {
  stroke: '#3d4654', bodyA: '#2b333e', bodyB: '#232a33', panel: '#1c232c',
  keyFill: '#2b333e', keyText: '#9fb0c0', keyStroke: '#3d4654',
  bezel: '#0a0e13', bezelStroke: '#161d25',
  digit: '#41e58a', digitGlow: 'rgba(65,229,138,.55)', labelGreen: '#63c583',
  glass: '#0d1117', glassStroke: '#39424e',
  warm: '#ffa657', turntable: '#242b34', bowl: '#3a4351', bowlRim: '#4a5567',
  counterTop: '#333c47', counterBody: '#272e37', counterStroke: '#3d4654', knob: '#4a5567',
  termBg: '#0b0f14', termGreen: '#56d364', termOut: '#9db1c3', termBlue: '#79c0ff',
  screenBezel: '#1c232c', muted: '#8b949e',
  cable: '#434c59', pulse: '#3fb950',
  magnets: ['#4c8dee', '#e5534b', '#e3b341', '#57ab5a'], magnetText: '#ffffff',
  sticky: '#e6c65c', stickyText: '#4a3b09', tape: 'rgba(255,255,255,.25)',
  ding: '#ffd257', ship: '#238636', shipText: '#eafff1', shipStroke: '#2ea043',
  hot: '#ffa657', led: '#3fd47f', handle: '#4a5567', tagline: '#7d8894',
  shadow: 'rgba(0,0,0,.35)', feet: '#1c232c', frost: '#a5d6ff',
  dogA: '#b08a63', dogB: '#8a6a48', dogNose: '#231a12', eyeWhite: '#f6f8fa',
  pupil: '#1f2328', tongue: '#ef8e7d', collar: '#e5534b', tagFill: '#e3b341', tagText: '#3b2f00',
};

const LIGHT = {
  stroke: '#7a8794', bodyA: '#f3f5f7', bodyB: '#e2e7ec', panel: '#dbe1e8',
  keyFill: '#eef1f4', keyText: '#4b5663', keyStroke: '#9aa6b2',
  bezel: '#171c22', bezelStroke: '#0a0d10',
  digit: '#3fd47f', digitGlow: 'rgba(46,160,67,.45)', labelGreen: '#1a7f37',
  glass: '#1b2129', glassStroke: '#5b6773',
  warm: '#ffa657', turntable: '#2b333e', bowl: '#8b99a8', bowlRim: '#a5b2c0',
  counterTop: '#c9d2da', counterBody: '#e8edf1', counterStroke: '#8c98a4', knob: '#8c98a4',
  termBg: '#14181d', termGreen: '#56d364', termOut: '#aebfce', termBlue: '#79c0ff',
  screenBezel: '#c4cdd6', muted: '#59636e',
  cable: '#9aa6b2', pulse: '#1f883d',
  magnets: ['#0969da', '#cf222e', '#bf8700', '#1a7f37'], magnetText: '#ffffff',
  sticky: '#f2d05c', stickyText: '#4a3b09', tape: 'rgba(0,0,0,.12)',
  ding: '#b58a00', ship: '#1f883d', shipText: '#ffffff', shipStroke: '#1a7f37',
  hot: '#d4681e', led: '#1f883d', handle: '#8c98a4', tagline: '#59636e',
  shadow: 'rgba(31,35,40,.16)', feet: '#b3bec8', frost: '#54aeff',
  dogA: '#a97e53', dogB: '#7d5c3a', dogNose: '#241a10', eyeWhite: '#ffffff',
  pupil: '#1f2328', tongue: '#e0765f', collar: '#cf222e', tagFill: '#d4a72c', tagText: '#3b2f00',
};

const MONO = `ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace`;

// ---------------------------------------------------------------------------
// odometer digits — each digit is a strip of 0-9,0-9 that rolls up to its
// final value (a full extra revolution for drama). Static transform holds the
// final state, the animation replays the roll from zero on every load.
// ---------------------------------------------------------------------------

function odometer(count, p) {
  const s = count.toLocaleString('en-US');
  const DIGIT_W = 13.5, COMMA_W = 7, ROW_H = 24, BASE_Y = 203, CX = 373;
  const widths = [...s].map(c => (c === ',' ? COMMA_W : DIGIT_W));
  const total = widths.reduce((a, b) => a + b, 0);
  let x = CX - total / 2;
  let out = '';
  let idx = 0;
  for (const ch of s) {
    if (ch === ',') {
      out += `<text x="${(x + COMMA_W / 2).toFixed(1)}" y="${BASE_Y}" class="dg">,</text>`;
      x += COMMA_W;
      continue;
    }
    const d = +ch;
    const finalY = -(10 + d) * ROW_H;
    const delay = (0.5 + idx * 0.13).toFixed(2);
    let glyphs = '';
    for (let i = 0; i < 20; i++) {
      glyphs += `<text x="${(x + DIGIT_W / 2).toFixed(1)}" y="${BASE_Y + i * ROW_H}" class="dg">${i % 10}</text>`;
    }
    out += `<g style="transform:translateY(${finalY}px);animation:rollin 1.6s cubic-bezier(.19,.68,.26,1) ${delay}s both">${glyphs}</g>`;
    x += DIGIT_W;
    idx++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// fridge terminal — typewriter reveal via covers that slide off each line
// ---------------------------------------------------------------------------

function terminal(p) {
  const lines = [
    { t: '$ cold-boot', fill: p.termGreen, y: 220, delay: 0.7, dur: 0.7 },
    { t: 'fridgeOS ready ❄', fill: p.termOut, y: 238, delay: 1.9, dur: 0.9 },
    { t: '$ run brace_soup.bin', fill: p.termGreen, y: 256, delay: 3.2, dur: 1.1 },
    { t: 'exit 0 · served cold', fill: p.termOut, y: 274, delay: 4.7, dur: 1.0 },
  ];
  let txt = '', covers = '';
  for (const l of lines) {
    const shown = l.t.replace('❄', `<tspan fill="${p.termBlue}">❄</tspan>`);
    txt += `<text x="612" y="${l.y}" class="tm" fill="${l.fill}">${shown}</text>`;
    covers += `<rect x="608" y="${l.y - 11}" width="142" height="15" fill="${p.termBg}"
      style="transform:translateX(148px);animation:typeslide ${l.dur}s steps(${l.t.length}) ${l.delay}s both"/>`;
  }
  return txt + covers +
    `<rect x="724" y="265" width="6" height="10" fill="${p.termGreen}" opacity="0"
       style="animation:blink 1.1s step-end infinite 5.9s"/>`;
}

// ---------------------------------------------------------------------------
// the QA department — sits in front of the microwave, drools over every build
// before approving it. tail wag = test suite passing.
// ---------------------------------------------------------------------------

function dog(p) {
  return `
  <!-- QA -->
  <g transform="translate(430,320)">
    <ellipse cx="38" cy="117" rx="46" ry="5" fill="${p.shadow}"/>
    <ellipse cx="6" cy="114.5" rx="8" ry="2" fill="${p.frost}" opacity=".3"/>
    <ellipse cx="5" cy="113" rx="3.5" ry="1.2" fill="${p.frost}" opacity="0" class="splash"/>
    <g class="dogbreathe">
      <rect x="68" y="97" width="24" height="7" rx="3.5" fill="${p.dogA}" stroke="${p.dogB}" stroke-width="1.2" class="wag"/>
      <rect x="27" y="78" width="7" height="36" rx="3.5" fill="${p.dogB}"/>
      <path d="M28,46 C18,62 15,86 17,112 L68,112 C75,104 78,94 77,84 C74,64 60,50 42,46 Z" fill="${p.dogA}" stroke="${p.dogB}" stroke-width="1.5"/>
      <path d="M44,74 C56,72 66,80 68,94" fill="none" stroke="${p.dogB}" stroke-width="1.2" opacity=".6"/>
      <rect x="17" y="74" width="7" height="40" rx="3.5" fill="${p.dogA}" stroke="${p.dogB}" stroke-width="1.2"/>
      <ellipse cx="20" cy="113" rx="5.5" ry="3" fill="${p.dogA}" stroke="${p.dogB}" stroke-width="1.2"/>
      <ellipse cx="30" cy="113.5" rx="5" ry="2.8" fill="${p.dogB}"/>
      <ellipse cx="34" cy="25" rx="6" ry="11" transform="rotate(18 34 25)" fill="${p.dogB}"/>
      <circle cx="24" cy="32" r="17" fill="${p.dogA}" stroke="${p.dogB}" stroke-width="1.5"/>
      <ellipse cx="9" cy="27" rx="10" ry="7" transform="rotate(-25 9 27)" fill="${p.dogA}" stroke="${p.dogB}" stroke-width="1.2"/>
      <circle cx="1.5" cy="20.5" r="2.8" fill="${p.dogNose}"/>
      <path d="M3,32 Q6,35 10,34" fill="none" stroke="${p.dogB}" stroke-width="1.2"/>
      <ellipse cx="6" cy="38" rx="2.6" ry="4.5" transform="rotate(-12 6 38)" fill="${p.tongue}"/>
      <circle cx="20" cy="25" r="4.5" fill="${p.eyeWhite}"/>
      <circle cx="18.6" cy="23.6" r="2.2" fill="${p.pupil}"/>
      <circle cx="17.9" cy="22.9" r=".8" fill="${p.eyeWhite}"/>
      <rect x="11" y="41" width="27" height="6" rx="3" transform="rotate(-14 24 44)" fill="${p.collar}"/>
      <g class="tagswing">
        <circle cx="22" cy="48.5" r="1.6" fill="none" stroke="${p.tagFill}" stroke-width="1.2"/>
        <circle cx="22" cy="56" r="7.5" fill="${p.tagFill}" stroke="${p.tagText}" stroke-width=".8"/>
        <text x="22" y="58.6" text-anchor="middle" font-size="6.5" font-weight="700" fill="${p.tagText}">QA</text>
      </g>
      <path d="M5,41.5 q-.6,2.5 .2,4" fill="none" stroke="${p.frost}" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>
      <circle cx="5" cy="45.5" r="2.3" fill="${p.frost}" class="drip"/>
    </g>
  </g>`;
}

// ---------------------------------------------------------------------------
// the scene
// ---------------------------------------------------------------------------

function svg(p, count) {
  const magnetLetters = ['S', 'U', 'D', 'O'];
  const magnetRot = [-7, 5, -4, 8];
  const magnets = magnetLetters.map((ch, i) => {
    const mx = 612 + i * 30;
    return `<g transform="translate(${mx},98) rotate(${magnetRot[i]},11,11)">
      <g${i === 3 ? ' class="slip"' : ''}>
        <rect width="22" height="22" rx="5" fill="${p.magnets[i]}"/>
        <text x="11" y="15.5" text-anchor="middle" font-family="${MONO}" font-size="12.5" font-weight="700" fill="${p.magnetText}">${ch}</text>
      </g>
    </g>`;
  }).join('');

  const keys = [
    { x: 326, label: 'PUSH' }, { x: 358.5, label: 'PULL' }, { x: 391, label: 'SYNC' },
  ].map(k => `
      <rect x="${k.x}" y="234" width="29" height="13" rx="3" fill="${p.keyFill}" stroke="${p.keyStroke}" stroke-width="1"/>
      <text x="${k.x + 14.5}" y="243" text-anchor="middle" font-family="${MONO}" font-size="5.8" letter-spacing=".5" fill="${p.keyText}">${k.label}</text>`
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 880 470" width="880" role="img"
  aria-label="Akinchan's kitchen: the microwave has cooked ${count.toLocaleString('en-US')} commits; the fridge runs the build; a dog wearing a QA tag sits in front of the microwave, drooling over the next release. Compiled hot, served cold.">
  <title>compiled hot · served cold</title>
  <style>
    text { font-family: ${MONO}; }
    .dg { font-size: 21px; font-weight: 700; fill: ${p.digit}; text-anchor: middle; }
    .tm { font-size: 9px; }
    @keyframes rollin { from { transform: translateY(0); } }
    @keyframes typeslide { from { transform: translateX(0); } }
    @keyframes blink { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
    @keyframes breathe { 0%, 100% { opacity: .45; } 50% { opacity: .9; } }
    @keyframes warmpulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
    @keyframes floaty {
      0% { opacity: 0; transform: translateY(0); }
      18% { opacity: .95; }
      75%, 100% { opacity: 0; transform: translateY(-26px); }
    }
    @keyframes steam {
      0% { opacity: 0; transform: translateY(4px); }
      30% { opacity: .6; }
      75%, 100% { opacity: 0; transform: translateY(-18px); }
    }
    @keyframes blip { 0%, 70% { opacity: 1; } 75%, 95% { opacity: .15; } 100% { opacity: 1; } }
    @keyframes flow { to { stroke-dashoffset: -14; } }
    @keyframes ding {
      0% { opacity: 0; transform: scale(.5); }
      3% { opacity: 1; transform: scale(1.18); }
      6% { transform: scale(1); }
      20% { opacity: 1; transform: scale(1); }
      27%, 100% { opacity: 0; transform: translateY(-8px); }
    }
    .pop { transform-box: fill-box; transform-origin: center; }
    @keyframes rumble {
      0%, 24%, 50%, 70%, 100% { transform: translate(0,0); }
      4% { transform: translate(-.7px,.4px); } 8% { transform: translate(.6px,-.3px); }
      12% { transform: translate(-.5px,.5px); } 16% { transform: translate(.7px,.2px); }
      20% { transform: translate(-.4px,-.4px); }
      54% { transform: translate(.6px,-.4px); } 58% { transform: translate(-.6px,.3px); }
      62% { transform: translate(.5px,.4px); } 66% { transform: translate(-.7px,-.2px); }
    }
    .rumble { animation: rumble 3.6s linear infinite; }
    @keyframes sway { 0%, 100% { transform: translateX(-8px); } 50% { transform: translateX(8px); } }
    .sway { animation: sway 6.5s ease-in-out infinite; }
    @keyframes slip {
      0%, 58% { transform: translate(0,0) rotate(0); }
      61% { transform: translate(0,6px) rotate(15deg); }
      63%, 88% { transform: translate(0,5px) rotate(13deg); }
      92% { transform: translate(0,-1.5px) rotate(-3deg); }
      95%, 100% { transform: translate(0,0) rotate(0); }
    }
    .slip { animation: slip 12s ease-in-out 5s infinite; transform-box: fill-box; transform-origin: 30% 15%; }
    @keyframes flutter { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(2.6deg); } }
    .flutter { animation: flutter 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 0%; }
    @keyframes rattle {
      0%, 70%, 82%, 100% { transform: rotate(0); }
      72% { transform: rotate(-4deg); } 75% { transform: rotate(3.2deg); }
      78% { transform: rotate(-2.4deg); } 80% { transform: rotate(1.6deg); }
    }
    .rattle { animation: rattle 8.5s linear 1.2s infinite; transform-box: fill-box; transform-origin: 50% 100%; }
    @keyframes puff {
      0%, 100% { opacity: 0; transform: translate(0,0) scale(.6); }
      6% { opacity: .55; }
      22% { opacity: 0; transform: translate(-16px,7px) scale(1.7); }
      23% { transform: translate(0,0) scale(.6); }
    }
    .puff { transform-box: fill-box; transform-origin: center; }
    @keyframes wag { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(16deg); } }
    .wag { animation: wag .8s ease-in-out infinite; transform-box: fill-box; transform-origin: 0% 50%; }
    @keyframes drip {
      0% { opacity: 0; transform: translate(0,0) scale(.4); }
      10% { opacity: .9; transform: translate(0,1px) scale(.75); }
      32% { transform: translate(0,3px) scale(1); }
      40% { transform: translate(0,10px) scale(1); }
      54% { transform: translate(0,68px) scale(1); }
      56%, 100% { opacity: 0; transform: translate(0,68px) scale(1); }
    }
    .drip { animation: drip 3.2s linear infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes splashy { 0%, 52% { opacity: 0; transform: scaleX(.4); } 57% { opacity: .7; transform: scaleX(1); } 66%, 100% { opacity: 0; transform: scaleX(1.5); } }
    .splash { animation: splashy 3.2s linear infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes tagswing { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
    .tagswing { animation: tagswing 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 0%; }
    @keyframes dogbreathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.015); } }
    .dogbreathe { animation: dogbreathe 3.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
    /* reduce-motion: stop all movement, keep gentle opacity fades (glow, LED, cursor) */
    @media (prefers-reduced-motion: reduce) { [style*="rollin"], [style*="typeslide"], [style*="floaty"], [style*="steam"], [style*="ding"], [style*="puff"], [style*="flow"], .rumble, .sway, .slip, .flutter, .rattle, .wag, .drip, .splash, .tagswing, .dogbreathe { animation: none !important; } }
  </style>

  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.bodyA}"/><stop offset="1" stop-color="${p.bodyB}"/>
    </linearGradient>
    <radialGradient id="heat" cx=".5" cy=".55" r=".65">
      <stop offset="0" stop-color="${p.warm}" stop-opacity=".85"/>
      <stop offset=".55" stop-color="${p.warm}" stop-opacity=".28"/>
      <stop offset="1" stop-color="${p.warm}" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="glassClip"><rect x="122" y="180" width="176" height="92" rx="6"/></clipPath>
    <clipPath id="displayClip"><rect x="329" y="183" width="88" height="28"/></clipPath>
    <clipPath id="termClip"><rect x="604" y="202" width="144" height="94" rx="5"/></clipPath>
  </defs>

  <!-- floor -->
  <line x1="48" y1="436" x2="832" y2="436" stroke="${p.stroke}" stroke-width="1.5" opacity=".5"/>
  <ellipse cx="272" cy="437" rx="205" ry="6" fill="${p.shadow}"/>
  <ellipse cx="667" cy="437" rx="118" ry="6" fill="${p.shadow}"/>

  <!-- cable: microwave output piped into the fridge (runs behind the QA department) -->
  <path d="M440,262 C462,262 468,278 470,300 C471,348 473,398 488,414 C505,430 536,421 558,416"
    fill="none" stroke="${p.cable}" stroke-width="4" stroke-linecap="round"/>
  <path d="M440,262 C462,262 468,278 470,300 C471,348 473,398 488,414 C505,430 536,421 558,416"
    fill="none" stroke="${p.pulse}" stroke-width="2" stroke-linecap="round"
    stroke-dasharray="5 9" style="animation:flow .8s linear infinite"/>

  <!-- counter -->
  <rect x="84" y="307" width="376" height="123" fill="${p.counterBody}" stroke="${p.counterStroke}" stroke-width="1.5"/>
  <rect x="72" y="294" width="400" height="13" rx="3" fill="${p.counterTop}" stroke="${p.counterStroke}" stroke-width="1.5"/>
  <line x1="84" y1="348" x2="460" y2="348" stroke="${p.counterStroke}" stroke-width="1.2"/>
  <rect x="248" y="325" width="48" height="5" rx="2.5" fill="${p.knob}"/>
  <line x1="272" y1="348" x2="272" y2="430" stroke="${p.counterStroke}" stroke-width="1.2"/>
  <circle cx="258" cy="388" r="4" fill="${p.knob}"/>
  <circle cx="286" cy="388" r="4" fill="${p.knob}"/>

  <!-- spice shelf: syntax seasonings -->
  <rect x="148" y="116" width="180" height="8" rx="2" fill="${p.counterTop}" stroke="${p.counterStroke}" stroke-width="1"/>
  <path d="M166,124 v9 l9,-9 z" fill="${p.counterStroke}"/>
  <path d="M310,124 v9 l-9,-9 z" fill="${p.counterStroke}"/>
  ${[
    { x: 178, glyph: ';' },
    { x: 218, glyph: '{ }', cls: ' class="rattle"' },
    { x: 258, glyph: '#' },
  ].map(j => `
  <g${j.cls || ''}>
    <rect x="${j.x + 2}" y="84" width="18" height="7" rx="2" fill="${p.handle}"/>
    <rect x="${j.x}" y="90" width="22" height="26" rx="3" fill="${p.keyFill}" stroke="${p.keyStroke}" stroke-width="1"/>
    <text x="${j.x + 11}" y="107" text-anchor="middle" font-size="${j.glyph.length > 1 ? 7.5 : 10}" font-weight="700" fill="${p.keyText}">${j.glyph}</text>
  </g>`).join('')}

  <!-- ==================== microwave (it's running) ==================== -->
  <g class="rumble">
  <rect x="100" y="158" width="340" height="136" rx="14" fill="url(#body)" stroke="${p.stroke}" stroke-width="2"/>

  <!-- door -->
  <rect x="114" y="172" width="192" height="108" rx="9" fill="${p.bodyB}" stroke="${p.stroke}" stroke-width="1.5"/>
  <rect x="122" y="180" width="176" height="92" rx="6" fill="${p.glass}" stroke="${p.glassStroke}" stroke-width="1.5"/>
  <g clip-path="url(#glassClip)">
    <ellipse cx="210" cy="248" rx="85" ry="48" fill="url(#heat)" style="animation:breathe 3.8s ease-in-out infinite"/>
    <ellipse cx="210" cy="262" rx="62" ry="7" fill="${p.turntable}" stroke="${p.glassStroke}" stroke-width="1"/>
    <g class="sway">
      <path d="M182,244 Q182,262 210,262 Q238,262 238,244 Z" fill="${p.bowl}"/>
      <ellipse cx="210" cy="244" rx="28" ry="4.5" fill="${p.bowlRim}"/>
      <!-- brace soup -->
      <text x="196" y="238" font-size="13" font-weight="700" fill="${p.warm}" opacity="0" style="animation:floaty 4.2s ease-out infinite">{</text>
      <text x="224" y="238" font-size="13" font-weight="700" fill="${p.warm}" opacity="0" style="animation:floaty 4.2s ease-out 1.4s infinite">}</text>
      <text x="211" y="238" font-size="13" font-weight="700" fill="${p.warm}" opacity="0" style="animation:floaty 4.2s ease-out 2.8s infinite">;</text>
      <path d="M198,230 q-4,-7 0,-13 q4,-6 0,-12" fill="none" stroke="${p.warm}" stroke-width="1.8" stroke-linecap="round" opacity="0" style="animation:steam 3.6s ease-out .5s infinite"/>
      <path d="M223,230 q4,-7 0,-13 q-4,-6 0,-12" fill="none" stroke="${p.warm}" stroke-width="1.8" stroke-linecap="round" opacity="0" style="animation:steam 3.6s ease-out 2.2s infinite"/>
    </g>
  </g>
  <rect x="299" y="180" width="6" height="92" rx="3" fill="${p.handle}"/>

  <!-- control panel -->
  <rect x="318" y="172" width="110" height="110" rx="8" fill="${p.panel}" stroke="${p.stroke}" stroke-width="1.5"/>
  <rect x="326" y="180" width="94" height="34" rx="5" fill="${p.bezel}" stroke="${p.bezelStroke}" stroke-width="1.5"/>
  <g clip-path="url(#displayClip)" style="filter:drop-shadow(0 0 5px ${p.digitGlow})">
    ${odometer(count, p)}
  </g>
  <text x="373" y="226" text-anchor="middle" font-size="7" letter-spacing="1.8" fill="${p.labelGreen}">COMMITS COOKED</text>
  ${keys}
  <rect x="326" y="252" width="94" height="13" rx="3" fill="none" stroke="${p.hot}" stroke-width="1.2" style="animation:warmpulse 3s ease-in-out infinite"/>
  <text x="373" y="261.5" text-anchor="middle" font-size="6.8" letter-spacing="1.6" fill="${p.hot}" style="animation:warmpulse 3s ease-in-out infinite">HOT RELOAD</text>
  <rect x="326" y="269" width="94" height="13" rx="3" fill="${p.ship}" stroke="${p.shipStroke}" stroke-width="1"/>
  <text x="373" y="278.5" text-anchor="middle" font-size="6.8" letter-spacing="2" fill="${p.shipText}">SHIP IT</text>
  </g>

  <!-- ding! (it will not stop dinging) -->
  <g transform="translate(452,144) rotate(-8)">
    <text x="0" y="0" font-size="13" font-weight="700" fill="${p.ding}" opacity="0" class="pop" style="animation:ding 9s ease-out 2.6s infinite">✦ ding!</text>
  </g>

  <!-- ==================== fridge ==================== -->
  <rect x="576" y="426" width="20" height="8" rx="2" fill="${p.feet}"/>
  <rect x="738" y="426" width="20" height="8" rx="2" fill="${p.feet}"/>
  <rect x="560" y="76" width="214" height="350" rx="16" fill="url(#body)" stroke="${p.stroke}" stroke-width="2"/>
  <line x1="561" y1="168" x2="773" y2="168" stroke="${p.stroke}" stroke-width="2"/>
  <rect x="574" y="94" width="8" height="56" rx="4" fill="${p.handle}"/>
  <rect x="574" y="184" width="8" height="116" rx="4" fill="${p.handle}"/>

  ${magnets}
  <text x="666" y="152" text-anchor="middle" font-size="7" letter-spacing="2" fill="${p.muted}">❄ COLD STORAGE</text>

  <!-- smart screen: the fridge runs the build -->
  <rect x="598" y="196" width="156" height="106" rx="9" fill="${p.screenBezel}" stroke="${p.stroke}" stroke-width="1.5"/>
  <rect x="604" y="202" width="144" height="94" rx="5" fill="${p.termBg}"/>
  <g clip-path="url(#termClip)">
    ${terminal(p)}
  </g>

  <!-- sticky note -->
  <g transform="translate(640,318) rotate(-5)">
    <g class="flutter">
      <rect width="66" height="50" rx="2" fill="${p.sticky}"/>
      <rect x="18" y="-5" width="30" height="9" fill="${p.tape}"/>
      <text x="8" y="18" font-size="8.5" font-weight="700" fill="${p.stickyText}">TODO:</text>
      <text x="8" y="31" font-size="8.5" fill="${p.stickyText}">defrost</text>
      <text x="8" y="42" font-size="8.5" fill="${p.stickyText}">prod</text>
    </g>
  </g>

  <!-- the freezer leaks a little cold -->
  <g class="puff" opacity="0" style="animation:puff 7.4s linear infinite">
    <circle cx="563" cy="168" r="3.5" fill="${p.frost}"/>
    <circle cx="557" cy="171" r="2.5" fill="${p.frost}"/>
    <circle cx="568" cy="172" r="2" fill="${p.frost}"/>
  </g>
  <g class="puff" opacity="0" style="animation:puff 7.4s linear 3.7s infinite">
    <circle cx="564" cy="165" r="2.5" fill="${p.frost}"/>
    <circle cx="558" cy="168" r="3" fill="${p.frost}"/>
  </g>

  <circle cx="752" cy="408" r="3" fill="${p.led}" style="animation:blip 2.4s linear infinite"/>

  ${dog(p)}

  <!-- tagline -->
  <text x="440" y="464" text-anchor="middle" font-size="11" letter-spacing="4" fill="${p.tagline}">COMPILED HOT · SERVED COLD</text>
</svg>
`;
}

// ---------------------------------------------------------------------------

async function main() {
  const arg = process.argv.find(a => a.startsWith('--count='));
  const count = arg ? parseInt(arg.split('=')[1], 10) : await fetchCommitCount();
  console.log(`commits cooked: ${count}`);
  const dir = __dirname;
  fs.writeFileSync(path.join(dir, 'kitchen-dark.svg'), svg(DARK, count));
  fs.writeFileSync(path.join(dir, 'kitchen-light.svg'), svg(LIGHT, count));
  console.log('wrote kitchen-dark.svg + kitchen-light.svg');
}

main().catch(e => { console.error(e); process.exit(1); });
