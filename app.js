/* Fretwork UI */
(function () {
'use strict';
const VER = (() => { try { return new URL(document.currentScript.src).searchParams.get('v') || '0'; } catch (e) { return '0'; } })();   // release number, set in index.html (?v=N)
const F = window.Fretwork;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sharpen = s => s.replace(/#/g, '♯').replace(/b(?=\d)/g, '♭').replace(/(?<=[A-G])b/g, '♭');
/* ---- language / notation: English (B = B natural) or Slovak (H = B natural, B = B flat, Cis, Es ...) ---- */
const LANG = (() => { try { const v = localStorage.getItem('fw.lang'); if (v === 'sk' || v === 'en') return v; } catch (e) {} return /^sk\b/i.test(navigator.language || '') ? 'sk' : 'en'; })();
F.setLocale(LANG);
const SK = LANG === 'sk';
if (SK && window.SKI) window.SKI.start();
const nn = n => F.noteLoc(n);                                    // English note name -> current notation
const cl = n => F.chordLoc(n);                                   // English chord name -> current notation
const skS = s => SK ? s.replace(/^m(?!aj|in|i|ol)/, 'mi') : s;   // chord suffix as written in Slovak (m -> mi)
const TT = s => (window.SKI && SK) ? window.SKI.tr(s) : s;       // translate an arbitrary string
/* the same chord in the other notation, in brackets: Slovak Dis (D#), Hmi (Bm); English Bb (B), B (H) */
function usualHtml(ch) {
  if (!ch || !ch.ok) return '';
  const other = SK ? 'en' : 'sk';
  const rn = ch.root.name, bn = ch.bass ? ch.bass.name : null;
  const sk = n => F.withLocale('sk', () => F.noteLoc(n));
  if (sk(rn) === rn && (!bn || sk(bn) === bn)) return '';                  // note names are spelled the same in both notations
  let name;
  if (SK) name = rn + ch.suffix.replace(/^(moll|mol|mi)(?!n)/, 'm').replace(/^dur/, '') + (bn ? '/' + bn : '');
  else name = F.withLocale('sk', () => F.chordLoc(rn + ch.suffix + (bn ? '/' + bn : '')));
  return ` <span class="usual" title="${SK ? 'Medzinárodný (anglický) zápis' : 'Slovak notation'}">(${esc(sharpen(name))})</span>`;
}
const TUN_WORDS = { 'Standard': 'Štandardné', 'Half step down': 'Pol tónu nižšie', 'Double drop D': 'Double drop D' };
const tunLabel = t => SK ? t.replace(/^(Standard|Half step down)/, m => TUN_WORDS[m]).replace(/\(([^)]*)\)/, (m, g) => '(' + g.split(' ').map(x => /^[A-G][#b]?$/.test(x) ? F.noteLoc(x) : x).join(' ') + ')') : t;
document.documentElement.lang = SK ? 'sk' : 'en';

/* ================= storage / profiles ================= */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Storage is full or blocked'); } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
const DEFAULTS = () => ({ songs: [], pref: {}, settings: { tuning: 'Standard (E A D G B E)', label: 'finger', lh: false, flats: false, sound: true, fs: 18, beginner: null } });
const A = { users: LS.get('fw.users', []), uid: LS.get('fw.session', 'guest') };
if (A.uid !== 'guest' && !A.uid.startsWith('c:') && !A.users.find(u => u.id === A.uid)) A.uid = 'guest';
const BASE_TUN = new Set(Object.keys(F.TUNINGS));
const STD = F.TUNINGS['Standard (E A D G B E)'];
let D = load(A.uid);
registerCustoms();
function registerCustoms() {
  Object.keys(F.TUNINGS).forEach(k => { if (!BASE_TUN.has(k)) delete F.TUNINGS[k]; });
  D.settings.custom = D.settings.custom || {};
  Object.entries(D.settings.custom).forEach(([k, v]) => { F.TUNINGS[k] = v; });
  if (!F.TUNINGS[D.settings.tuning]) D.settings.tuning = 'Standard (E A D G B E)';
}
function load(uid) {
  const d = LS.get('fw.data.' + uid, null) || DEFAULTS();
  d.settings = Object.assign(DEFAULTS().settings, d.settings || {});
  d.songs = d.songs || []; d.pref = d.pref || {}; d.progs = d.progs || [];
  return d;
}
const save = () => { LS.set('fw.data.' + A.uid, D); cloudPush(); tuneBar(); };
function tuneBar() {
  const el = document.getElementById('tuneBar'); if (!el) return;
  const name = D.settings.tuning, std = name.startsWith('Standard'), t = F.TUNINGS[name];
  document.body.classList.toggle('alt-tuning', !std);
  if (std || !t) { el.hidden = true; return; }
  const notes = t.map(m => F.pcLoc(((m % 12) + 12) % 12, D.settings.flats)).join(' ');
  el.hidden = false;
  el.innerHTML = '<b>Non-standard tuning</b><span class="tn">' + esc(tunLabel(name).replace(/\s*\(.*\)$/, '')) + '</span><span class="tnotes">' + esc(notes) + '</span><span class="tsub">Tune your guitar to match, diagrams are shifted for it.</span><button class="btn sm" id="tbChange">Change</button><button class="btn sm ghost" id="tbStd">Back to standard</button>';
}
const cfg = () => D.settings;
const userName = () => A.uid === 'guest' ? 'Guest' : A.uid.startsWith('c:') ? LS.get('fw.email.' + A.uid, 'Account').split('@')[0] : (A.users.find(u => u.id === A.uid) || {}).name || 'Guest';

async function hashPin(pin, salt) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) { let h = 5381; for (const c of salt + pin) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return 'x' + h; }
}

/* ================= Supabase cloud accounts ================= */
const CFG = window.FW_CONFIG || {};
const cloudOn = !!(CFG.supabaseUrl && CFG.supabaseKey);
const isCloud = () => A.uid.startsWith('c:');
let sb = null, pushTimer = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function cloudInit() {
  if (!cloudOn) return;
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
    sb.auth.onAuthStateChange(ev => { if (ev === 'PASSWORD_RECOVERY') setTimeout(recoveryModal, 0); });
    const { data } = await sb.auth.getSession();
    if (data.session) await cloudEnter(data.session.user, false);
    else if (isCloud()) switchUser('guest');
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { cloudPull(); sharedLoad(); } });
    sharedLoad();
  } catch (e) { toast('Cloud unavailable. Working on this device.'); }
}
async function cloudEnter(user, copyGuest) {
  const uid = 'c:' + user.id;
  LS.set('fw.email.' + uid, user.email || 'Account');
  const { data, error } = await sb.from('user_data').select('data').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  let merged = (data && data.data && Object.keys(data.data).length) ? data.data : load(uid);
  merged = Object.assign(DEFAULTS(), merged);
  merged.settings = Object.assign(DEFAULTS().settings, merged.settings || {});
  if (copyGuest && A.uid === 'guest') {
    const ids = new Set(merged.songs.map(s => s.id));
    D.songs.forEach(s => { if (!ids.has(s.id)) merged.songs.push(s); });
    merged.pref = Object.assign({}, D.pref, merged.pref);
    merged.progs = (merged.progs || []).concat((D.progs || []).filter(p => !(merged.progs || []).some(q => q.id === p.id)));
  }
  LS.set('fw.data.' + uid, merged);
  switchUser(uid);
  cloudPush(true);
  sharedLoad();
}
function cloudPush(now) {
  if (!sb || !isCloud()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    try {
      const { error } = await sb.from('user_data').upsert({ user_id: A.uid.slice(2), data: D, updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (e) { toast('Could not sync. Saved on this device.'); }
  }, now ? 0 : 800);
}
async function cloudPull() {
  if (!sb || !isCloud() || pushTimer) return;
  try {
    const { data } = await sb.from('user_data').select('data').eq('user_id', A.uid.slice(2)).maybeSingle();
    if (data && data.data && JSON.stringify(data.data) !== JSON.stringify(D)) {
      LS.set('fw.data.' + A.uid, Object.assign(DEFAULTS(), data.data));
      switchUser(A.uid, true);
    }
  } catch (e) { /* offline: keep local copy */ }
}

/* ================= audio ================= */
const Audio_ = { ctx: null, cache: new Map() };
function actx() {
  if (!Audio_.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; Audio_.ctx = new C(); }
  if (Audio_.ctx.state === 'suspended') Audio_.ctx.resume();
  return Audio_.ctx;
}
function pluckBuffer(c, midi) {
  if (Audio_.cache.has(midi)) return Audio_.cache.get(midi);
  // Karplus-Strong string with an all-pass fine-tuner, so every note lands exactly on pitch.
  const sr = c.sampleRate, f = 440 * Math.pow(2, (midi - 69) / 12);
  const total = sr / f - 0.5;                       // the averaging filter adds half a sample of delay
  const N = Math.floor(total), d = Math.max(0.1, total - N), ap = (1 - d) / (1 + d);
  const len = Math.floor(sr * (midi < 52 ? 3.2 : 2.6)), buf = c.createBuffer(1, len, sr), y = buf.getChannelData(0);
  // excitation: noise burst, softened for bass strings, brighter for treble strings
  const soft = midi < 52 ? 0.35 : midi < 64 ? 0.55 : 0.8;
  let prev = 0, seed = midi * 9301 + 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280 * 2 - 1; };
  for (let i = 0; i < N + 2; i++) { prev = soft * rnd() + (1 - soft) * prev; y[i] = prev; }
  const decay = Math.pow(0.5, 1 / (f * (midi < 52 ? 1.4 : midi < 64 ? 1.0 : 0.7)));  // ring time shortens up the neck
  let xPrev = 0, oPrev = 0;
  for (let i = N + 2; i < len; i++) {
    const x = 0.5 * (y[i - N] + y[i - N - 1]) * decay;
    const o = ap * (x - oPrev) + xPrev;             // first-order all-pass
    xPrev = x; oPrev = o; y[i] = o;
  }
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(y[i]));
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < len; i++) y[i] = y[i] / peak * (i > len - fade ? (len - i) / fade : 1);
  Audio_.cache.set(midi, buf);
  return buf;
}
function strum(v, only, o) {   // only = one string index (tap a string); o = { up, gap, vel, chop }
  if (!cfg().sound || !v) return;
  const c = actx(); if (!c) return;
  if (only == null && typeof say === 'function') say('strum');
  o = o || {};
  const tun = F.TUNINGS[cfg().tuning], t0 = c.currentTime + 0.02;
  const idx = []; v.frets.forEach((f, s) => { if (f >= 0 && (only == null || s === only)) idx.push(s); });
  if (only == null && !o.up) {   // a new chord damps the previous one so the tails do not smear together
    (strum.live || []).forEach(g => { try { g.gain.cancelScheduledValues(t0 - 0.02); g.gain.setValueAtTime(g.gain.value, t0 - 0.02); g.gain.linearRampToValueAtTime(0, t0 + 0.06); } catch (e) {} });
    strum.live = [];
  }
  const order = o.up && only == null ? idx.slice(-4).reverse() : idx, gap = o.gap != null ? o.gap : 0.05, vel = o.vel || 1;
  order.forEach((s, k) => {
    const src = c.createBufferSource(); src.buffer = pluckBuffer(c, tun[s] + v.frets[s]);
    const g = c.createGain(), t = t0 + k * gap; g.gain.setValueAtTime(0.2 * vel, t);
    if (o.chop) g.gain.linearRampToValueAtTime(0, t + 0.11);
    src.connect(g).connect(c.destination); src.start(t);
    (strum.live = strum.live || []).push(g);
  });
}
/* strumming patterns: eight slots per bar of four beats (1 & 2 & 3 & 4 &).  D down, U up, x muted chop, - rest; b m n h = single strings */
const PATS = [
  ['down', 'Down', 'D-D-D-D-', 'One slow hit on every beat.'],
  ['folk', 'Folk', 'D-DU-UDU', 'The campfire strum: down, down-up, up-down-up.'],
  ['pop', 'Pop', 'D-DUDUDU', 'Keeps going all the way through.'],
  ['rock', 'Rock', 'DUDUDUDU', 'Even down-up, down-up.'],
  ['punk', 'Punk', 'DDDDDDDD', 'Fast, all downstrokes.'],
  ['chug', 'Chug', 'DxDxDxDx', 'Hit, then a muted chop.'],
  ['arp', 'Picked', 'bmhnhnmn', 'One string at a time, like finger-picking.']
];
const PATD = Object.fromEntries(PATS.map(p => [p[0], p[2]]));
const patArrows = str => [...str].map(ch => ({ D: '↓', U: '↑', x: '✕', '-': '·' }[ch] || '●')).join(' ');
function playSlot(v, ch) {
  if (!v || !ch || ch === '-') return;
  if (ch === 'D') strum(v, null, { gap: 0.014 });
  else if (ch === 'U') strum(v, null, { up: true, gap: 0.011, vel: 0.65 });
  else if (ch === 'x') strum(v, null, { gap: 0.01, vel: 0.8, chop: true });
  else {
    const idx = []; v.frets.forEach((f, s) => { if (f >= 0) idx.push(s); });
    const k = { b: 0, m: Math.floor(idx.length / 2), n: idx.length - 2, h: idx.length - 1 }[ch];
    if (idx[k] != null) strum(v, idx[k], { vel: 0.9 });
  }
}
const isMark = x => typeof x === 'string' && x[0] === '#';
const isChord = x => !!x && !isMark(x);
const SECS = ['Intro', 'Verse', 'Pre-chorus', 'Chorus', 'Bridge', 'Solo', 'Outro'];

/* ================= voicing cache ================= */
const VC = new Map();
function voicingsFor(name) {
  const key = cfg().tuning + '|' + name;
  if (VC.has(key)) return VC.get(key);
  const chord = F.parseChord(name);
  const out = chord.ok ? { chord, list: F.findVoicings(chord, F.TUNINGS[cfg().tuning], { max: 12 }) } : { chord, list: [] };
  if (chord.ok && chord.bass) out.list.forEach(x => { x.slashBass = chord.bass.name; });
  VC.set(key, out); return out;
}
const canon = n => { if (!SK) return n; const c = F.convert(n, 'sk', 'en'); return c.replace(/^([A-G][#b]*)(moll|mol|mi)(?!n)/, '$1m').replace(/^([A-G][#b]*)dur/, '$1'); };
const prefKey = name => cfg().tuning + '|' + canon(name);
function preferred(name) {
  const out = voicingsFor(name), list = out.list; if (!list.length) return null;
  const k = TP.on ? (primaryKey(name) || D.pref[prefKey(name)]) : (D.pref[prefKey(name)] || primaryKey(name));   // teacher mode previews what everyone sees
  let v = k && list.find(x => F.vKey(x) === k);
  if (!v && k) { const fr = k.split('-').map(x => x === 'x' ? -1 : +x); if (fr.length === 6 && fr.every(Number.isFinite)) v = voicingFromFrets(fr, out.chord); }
  const vis = shownOnly(name, list);
  v = v || vis.find(x => x.rank === 0) || vis[0];
  if (v && out.chord.bass) v.slashBass = out.chord.bass.name;
  return v;
}

/* ================= diagram (SVG) ================= */
const SW = [2.6, 2.1, 1.7, 1.25, 1.0, 0.8];
function diagram(v, o) {
  o = o || {};
  const mode = o.mode || cfg().label, lh = cfg().lh, names = o.names;
  const W = 168, L = 38, T = 42, SP = 22, FS = 34, ROWS = 5, bw = SP * 5, bh = FS * ROWS, H = T + bh + (names ? 24 : 12);
  const X = i => L + (lh ? 5 - i : i) * SP;
  const base = v.base, cy = r => T + (r - 0.5) * FS;
  const tun = F.TUNINGS[cfg().tuning];
  const desc = 'Chord diagram, frets ' + v.frets.map(f => f < 0 ? 'muted' : f).join(' ');
  let s = `<svg class="dia" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">`;
  s += `<rect x="${L - 11}" y="${T}" width="${bw + 22}" height="${bh}" rx="2" fill="url(#rosewood)" filter="url(#grain)"/>`;
  s += `<rect x="${L - 11}" y="${T}" width="${bw + 22}" height="${bh}" rx="2" fill="none" stroke="#0009" stroke-width="1"/>`;
  // inlays
  for (let r = 1; r <= ROWS; r++) {
    const n = base + r - 1, y = cy(r);
    if ([3, 5, 7, 9, 15, 17].includes(n)) s += `<circle cx="${L + bw / 2}" cy="${y}" r="4" fill="url(#pearl)" opacity=".2"/>`;
    if (n === 12) s += `<circle cx="${L + SP * 1.5}" cy="${y}" r="4" fill="url(#pearl)" opacity=".2"/><circle cx="${L + SP * 3.5}" cy="${y}" r="4" fill="url(#pearl)" opacity=".2"/>`;
  }
  // frets
  for (let r = 1; r <= ROWS; r++) {
    const y = T + r * FS;
    s += `<rect x="${L - 11}" y="${y - 1.4}" width="${bw + 22}" height="2.8" fill="#c3c8cd"/>`;
  }
  if (base === 1) s += `<rect x="${L - 12}" y="${T - 7}" width="${bw + 24}" height="8" rx="2" fill="#efe3bb" stroke="#7d6c3f" stroke-width=".8"/>`;
  else s += `<rect x="${L - 11}" y="${T - 1.5}" width="${bw + 22}" height="2.8" fill="#c3c8cd"/>`;
  // strings
  for (let i = 0; i < 6; i++) {
    const x = X(i), w = SW[i], wound = i < 3, dim = '';
    s += `<g${dim}><line x1="${x}" y1="${T}" x2="${x}" y2="${T + bh}" stroke="${wound ? '#c28a45' : '#d5d9de'}" stroke-width="${w}"/>`
      + (wound ? `<line x1="${x}" y1="${T}" x2="${x}" y2="${T + bh}" stroke="#6a4416" stroke-opacity=".45" stroke-width="${w}" stroke-dasharray=".8 .9"/>` : '') + '</g>';
  }
  // slash chord: ring the bass note (lowest sounded string)
  const bi = v.slashBass ? v.frets.findIndex(f => f >= 0) : -1;
  if (bi >= 0) {
    const f = v.frets[bi], bx = X(bi), by = f === 0 ? T - 20 : cy(f - base + 1);
    s += `<circle cx="${bx}" cy="${by}" r="${f === 0 ? 10 : 14}" fill="none" stroke="#2a6db3" stroke-width="2.6"/>`;
  }
  // markers above nut
  v.frets.forEach((f, i) => {
    const x = X(i), y = T - 20;
    if (f < 0) s += `<g stroke="#a42b14" stroke-width="2.2" stroke-linecap="round"><line x1="${x - 4.5}" y1="${y - 4.5}" x2="${x + 4.5}" y2="${y + 4.5}"/><line x1="${x + 4.5}" y1="${y - 4.5}" x2="${x - 4.5}" y2="${y + 4.5}"/></g>`;
    else if (f === 0) {
      const root = v.notes[i] && v.notes[i].label === '1';
      s += `<circle cx="${x}" cy="${y}" r="5.6" fill="${root ? '#e2583a33' : 'none'}" stroke="${root ? '#a42b14' : '#5a4630'}" stroke-width="2"/>`;
      if (mode !== 'finger' && v.notes[i]) s += `<text x="${x}" y="${y - 9}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#5a4630">${esc(mode === 'note' ? nn(v.notes[i].name) : v.notes[i].label)}</text>`;
    }
  });
  const txt = i => mode === 'finger' ? (v.fingers[i] || '') : mode === 'note' ? (v.notes[i] ? nn(v.notes[i].name) : '') : (v.notes[i] ? v.notes[i].label : '');
  // barre
  if (v.barre) {
    const b = v.barre, r = b.fret - base + 1, xa = Math.min(X(b.from), X(b.to)), xb = Math.max(X(b.from), X(b.to));
    s += `<rect x="${xa - 9.5}" y="${cy(r) - 9.5}" width="${xb - xa + 19}" height="19" rx="9.5" fill="#f1d98a" stroke="#4a3410" stroke-width="1.2"/>`;
  }
  // dots
  v.frets.forEach((f, i) => {
    if (f <= 0) return;
    const r = f - base + 1, x = X(i), y = cy(r), inBarre = v.barre && f === v.barre.fret && i >= v.barre.from && i <= v.barre.to;
    const root = v.notes[i] && v.notes[i].label === '1';
    if (!inBarre) {
      s += `<circle cx="${x}" cy="${y}" r="9.5" fill="${root ? '#d9482b' : '#f1d98a'}" stroke="${root ? '#5b1208' : '#4a3410'}" stroke-width="1.2"/>`;
    }
    const t = txt(i);
    if (t !== '') s += `<text x="${x}" y="${y + 3.6}" text-anchor="middle" font-size="${String(t).length > 2 ? 7.5 : 10}" font-weight="800" fill="${root && !inBarre ? '#fff' : '#2b1d12'}" font-family="Georgia,serif">${esc(t)}</text>`;
  });
  for (let r = 1; r <= ROWS; r++) {
    const n = base + r - 1;
    if (r === 1 && base > 1) s += `<rect x="2" y="${cy(1) - 11}" width="24" height="22" rx="4" fill="url(#brass)" stroke="#5c4310" stroke-width=".8"/><text x="14" y="${cy(1) + 5}" text-anchor="middle" font-size="13" font-weight="800" fill="#3a2808" font-family="Georgia,serif">${n}</text>`;
    else s += `<text x="14" y="${cy(r) + 3.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#8a7658" font-family="Georgia,serif">${n}</text>`;
  }
  if (names) tun.forEach((m, i) => { s += `<text x="${X(i)}" y="${T + bh + 18}" text-anchor="middle" font-size="9" font-weight="700" fill="#6b5640">${F.pcLoc(m % 12, cfg().flats)}</text>`; });
  return s + '</svg>';
}

/* ================= toast / modal / drawer ================= */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200); }
function openModal(html, onReady) { $('#modalBody').innerHTML = html; $('#modal').hidden = false; document.body.style.overflow = 'hidden'; if (onReady) onReady($('#modalBody')); }
function closeModal() { $('#modal').hidden = true; document.body.style.overflow = ''; }
function openDrawer(html, onReady) { $('#drawerBody').innerHTML = html; $('#drawer').hidden = false; document.body.style.overflow = 'hidden'; if (onReady) onReady($('#drawerBody')); }
function closeDrawer() { $('#drawer').hidden = true; document.body.style.overflow = ''; }
document.addEventListener('click', e => {
  if (e.target.closest('#modal [data-close]')) closeModal();
  if (e.target.closest('#drawer [data-close]')) closeDrawer();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });

/* ================= chords view ================= */
const SUFFIXES = [['', 'major'], ['m', 'minor'], ['7', '7'], ['maj7', 'maj7'], ['m7', 'm7'], ['6', '6'], ['m6', 'm6'], ['9', '9'], ['m9', 'm9'], ['maj9', 'maj9'], ['add9', 'add9'],
  ['sus2', 'sus2'], ['sus4', 'sus4'], ['7sus4', '7sus4'], ['dim', 'dim'], ['dim7', 'dim7'], ['m7b5', 'm7♭5'], ['aug', 'aug'], ['5', '5'], ['11', '11'], ['13', '13'], ['69', '6/9'], ['7b9', '7♭9'], ['7#9', '7♯9'], ['7#11', '7♯11'], ['mMaj7', 'm(maj7)'], ['7alt', 'alt']];
const ROOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const isBeg = () => cfg().beginner !== false;   // null (not asked yet) counts as beginner
const isEasy = v => !v.barre && v.fingerCount <= 3 && v.pos <= 3;
const S = { showAll: false, text: isBeg() ? 'Em' : 'Am7', chord: null, list: [], sel: 0, song: null, tr: 0 };

function rootName(pc) { return F.pcLoc(pc, cfg().flats); }
function buildKeys() {
  const WH = [0, 2, 4, 5, 7, 9, 11], BL = [[1, 0], [3, 1], [6, 3], [8, 4], [10, 5]];   // black key: [pc, index of the white key to its left]
  const lab = pc => { const main = rootName(pc), alt = main === nn(F.FLAT[pc]) ? nn(F.SHARP[pc]) : nn(F.FLAT[pc]); return { main, alt }; };
  $('#rootKeys').innerHTML = WH.map(pc => { const l = lab(pc); return `<button class="key w" data-pc="${pc}" aria-label="${l.main}">${sharpen(l.main)}</button>`; }).join('')
    + BL.map(([pc, wi]) => { const l = lab(pc); return `<button class="key b" data-pc="${pc}" aria-label="${l.main}" style="left:${((wi + 1) / 7 * 100 - 4.2).toFixed(2)}%">${sharpen(l.main)}</button>`; }).join('');
  const BASIC = isBeg() ? ['', 'm', '7', '5'] : ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', '5'];
  const chip = ([v, l], cls) => `<button class="chip ${cls}" data-suf="${v}">${l === 'major' ? 'major' : sharpen(skS(l))}</button>`;
  const basic = SUFFIXES.filter(x => BASIC.includes(x[0])), more = SUFFIXES.filter(x => !BASIC.includes(x[0])), open = !!cfg().more;
  const beg = isBeg();
  $('#suffixChips').innerHTML = `<div class="chiprow">${basic.map(x => chip(x, 'basic')).join('')}${beg ? '' : `<button class="chip morebtn" id="btnMore" aria-expanded="${open}">${open ? 'Fewer ▴' : 'More chord types (' + more.length + ') ▾'}</button>`}</div>`
    + (beg ? '' : `<div class="chiprow" ${open ? '' : 'hidden'}>${more.map(x => chip(x, '')).join('')}</div>`);
  markKeys();
}
function splitText(t) {
  const r = F.parseNote(t || ''); if (!r) return { root: null, suf: '', bass: '' };
  let rest = t.slice(r.len), bass = '';
  const i = rest.lastIndexOf('/');
  if (i >= 0) { const b = F.parseNote(rest.slice(i + 1)); if (b && b.len === rest.length - i - 1) { bass = rest.slice(i); rest = rest.slice(0, i); } }
  return { root: r, suf: rest, bass };
}
function markKeys() {
  const sp = splitText($('#chordIn').value.trim());
  $$('#rootKeys .key').forEach(k => k.classList.toggle('on', !!sp.root && +k.dataset.pc === sp.root.pc));
  $$('#suffixChips .chip').forEach(c => c.classList.toggle('on', !!sp.root && c.dataset.suf !== undefined && (c.dataset.suf === sp.suf || skS(c.dataset.suf) === sp.suf)));
}
function setChordText(t, run) { $('#chordIn').value = t; S.text = t; markKeys(); if (run !== false) updateChord(); }
let chordTimer;
function updateChord() {
  const raw = $('#chordIn').value.trim(); S.text = raw; markKeys();
  const info = $('#chordInfo');
  if (!raw) { S.chord = null; S.list = []; info.className = 'status'; info.innerHTML = ''; $('#chordResult').hidden = true; $('#chordHint').textContent = 'Tap a root note and a quality above, or type any chord, however strange.'; return; }
  const out = voicingsFor(raw);
  S.chord = out.chord; S.list = shownOnly(raw, out.list.slice());
  if (!out.chord.ok) { info.className = 'status err'; info.textContent = out.chord.error; $('#chordResult').hidden = true; $('#chordHint').textContent = ''; return; }
  $('#chordHint').textContent = '';
  if (!out.list.length) { info.className = 'status err'; info.textContent = 'That chord is parsed (' + out.chord.notes.map(nn).join(' – ') + ') but I couldn’t find a playable shape in this tuning.'; $('#chordResult').hidden = true; return; }
  info.className = 'status'; info.innerHTML = '<b>' + esc(sharpen(raw)) + '</b>' + usualHtml(out.chord) + ' · ' + esc(out.chord.notes.map(n => sharpen(nn(n))).join(' – '));
  const pk = preferred(raw);
  if (pk && !S.list.includes(pk)) { S.list.push(pk); S.list.sort((x, y) => x.pos - y.pos); }
  S.fullCount = S.list.length; S.hidden = 0;
  if (isBeg() && !S.showAll) {
    const easy = S.list.filter(x => isEasy(x) || x === pk);
    if (easy.length && easy.length < S.list.length) {
      easy.sort((a, b) => (a === pk ? -1 : b === pk ? 1 : 0) || a.fingerCount - b.fingerCount || a.pos - b.pos);
      const keep = easy.slice(0, 4); if (pk && !keep.includes(pk)) keep[keep.length - 1] = pk;
      S.hidden = S.list.length - keep.length; S.list = keep;
    }
  }
  S.sel = Math.max(0, S.list.indexOf(pk));
  renderChord();
}
function posCaption(v) { return v.pos === 0 ? 'Open position' : 'Starts at fret ' + v.pos; }
function tagsFor(v, name) {
  let t = '';
  if (name && primaryKey(name) === F.vKey(v)) t += '<span class="tag gold">Recommended</span> ';
  if (TP.on && name && hiddenFor(name).includes(F.vKey(v))) t += '<span class="tag">Hidden from students</span> ';
  if (v.barre) t += '<span class="tag">Barre</span> ';
  else if (v.fingerCount <= 3 && v.pos <= 3) t += '<span class="tag">Easy</span> ';
  if (v.omits.length) t += `<span class="tag">no ${esc(v.omits.map(sharpen).join(', '))}</span>`;
  if (v.slashBass) t += ` <span class="tag bassTag">bass ${esc(sharpen(nn(v.slashBass)))}</span>`;
  return t;
}
const FIRST4 = ['Em', 'Am', 'D', 'G'];
const learned = k => !!(cfg().learned || {})[k];   // k = canonical English chord name
function toggleLearned(k) { const L = cfg().learned = cfg().learned || {}; if (L[k]) delete L[k]; else { L[k] = 1; say(FIRST4.every(learned) ? 'learned4' : 'learned1'); } save(); renderStart(); renderPlayable(); }
const HERO = ['G', 'D', 'Am'];
let heroTok = 0;
function heroStop() { heroTok++; document.querySelectorAll('#heroRow .hchip.on').forEach(x => x.classList.remove('on')); const b = $('#heroGo'); if (b) b.textContent = '▶ Play it'; }
function heroPlay() {
  const b = $('#heroGo'); if (b && b.textContent.startsWith('■')) { heroStop(); return; }
  const tok = ++heroTok, seq = [0, 1, 2, 2, 0, 1, 2, 2]; let i = 0;
  (cfg().talkSeen = cfg().talkSeen || {}).strum = 1; say('hero');
  if (b) b.textContent = '■ Stop';
  const step = () => {
    if (tok !== heroTok) return;
    document.querySelectorAll('#heroRow .hchip').forEach((x, j) => x.classList.toggle('on', j === seq[i]));
    strum(preferred(cl(HERO[seq[i]])));
    if (++i >= seq.length) { setTimeout(() => { if (tok === heroTok) heroStop(); }, 1100); return; }
    setTimeout(step, 1100);
  };
  step();
}
function renderStart() {
  const el = $('#startCard'); if (!el) return;
  if (!isBeg()) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const n = FIRST4.filter(learned).length;
  const hv = HERO.map(c => preferred(cl(c)));
  el.innerHTML = `<div class="hero"><div class="herotxt"><b>Hear what you will be able to play</b><span>Three chords are all it takes for a song everyone knows.</span></div>
    <div class="herorow" id="heroRow">${HERO.map((c, i) => `<div class="hchip" data-h="${i}"><div class="name">${esc(sharpen(cl(c)))}</div>${hv[i] ? diagram(hv[i]) : ''}</div>`).join('')}</div>
    <button class="btn primary" id="heroGo">▶ Play it</button></div>
    <h3 class="sect">Your first 4 chords <small>${n} of 4 learned</small></h3>
    <div class="grid">${FIRST4.map(c => { const nm = cl(c), v = preferred(nm); return `<div class="vcard stile ${learned(c) ? 'done' : ''}"><button class="stopen" data-st="${c}" aria-label="${esc(nm)}"><div class="name">${esc(sharpen(nm))}</div>${v ? diagram(v) : ''}<span class="hear">▶ Hear it</span></button><button class="btn sm ${learned(c) ? 'primary' : ''}" data-learn="${c}">${learned(c) ? '✓ I can play this' : 'Mark as learned'}</button></div>`; }).join('')}</div>
    <div class="actions" style="margin:10px 0"><button class="btn" id="stSongs">♪ Songs you can play with these chords</button></div>`;
}
function applyBeg() {
  const t = document.querySelector('#nav [data-view="theory"]'); if (t) t.hidden = isBeg();
  const p = $('#chordPanel');
  if (p) { p.classList.toggle('begmode', isBeg()); p.classList.toggle('collapsed', isBeg() && !S.keysOpen); $('#btnKeys').textContent = S.keysOpen ? 'Hide the keyboard ▴' : 'Show the keyboard ▾'; }
  renderStart();
}
function renderChord() {
  ED.on = false; $('#detail').classList.remove('editing');
  const raw = S.text, chord = S.chord, v = S.list[S.sel];
  $('#chordResult').hidden = false;
  const isPref = D.pref[prefKey(raw)] === F.vKey(v), isPrim = primaryKey(raw) === F.vKey(v);
  const pills = chord.tones.map(t => `<span class="pill ${t.label === '1' ? 'root' : ''}">${esc(sharpen(nn(t.name)))}<i>${esc(sharpen(t.label))}</i></span>`).join('');
  const modes = [['finger', 'Fingers'], ['note', 'Notes'], ['interval', 'Intervals']];
  $('#detail').innerHTML = `
    <div><div id="detailDia" data-play>${diagram(v, { names: true })}</div><p class="taphint">Tap or swipe across the strings to hear them</p></div>
    <div>
      <h2>${esc(sharpen(raw))}${usualHtml(chord)}</h2>
      <div class="notepills">${pills}</div>
      <div class="facts">
        ${cfg().tuning.startsWith('Standard') ? '' : `<div>Tuning <b>${esc(tunLabel(cfg().tuning))}</b></div>`}
        <div>Shape <b>${v.frets.map(f => f < 0 ? 'x' : f).join(' ')}</b> · ${posCaption(v)}</div>
        ${v.omits.length ? `<div>Leaves out ${esc(v.omits.map(sharpen).join(', '))}</div>` : ''}
        ${v.slashBass ? `<div class="bassnote"><span class="bassring"></span>Bass note <b>${esc(sharpen(nn(v.slashBass)))}</b>: the lowest string you play (blue ring). Strings below it stay muted.</div>` : ''}
      </div>
      <div class="opts" role="group" aria-label="Dot labels">${modes.map(([m, l]) => `<button class="chip ${cfg().label === m ? 'on' : ''}" data-mode="${m}">${l}</button>`).join('')}</div>
      <div class="actions">
        <button class="btn primary" id="btnPlay">▶ Strum all</button>
        <button class="btn" id="btnPin">${pinned(canon(raw)) ? '📌 Pinned (tap to unpin)' : '📌 Pin to top'}</button>
        <button class="btn" id="btnSeqAdd">＋ Add to sequence</button>
        <button class="btn" id="btnEdit">✎ Edit shape</button>
        <button class="btn" id="btnPref">${isPref ? '★ My voicing' : '☆ Use in my songs'}</button>
        ${isBeg() ? `<button class="btn" id="btnLearn">${learned(canon(raw)) ? '✓ I can play this' : 'Mark as learned'}</button>` : '<button class="btn ghost" id="btnTheory">Theory ›</button>'}
        ${TP.on ? `<button class="btn teach" id="btnPrimary">${isPrim ? '◆ Primary (tap to clear)' : '◆ Make primary'}</button>
        <button class="btn teach" id="btnHide">${hiddenFor(raw).includes(F.vKey(v)) ? '◇ Show this shape again' : '◇ Hide this shape'}</button>
        <button class="btn teach" id="btnResetChord">↺ Reset this chord</button>` : ''}
      </div>
    </div>`;
  const begView = isBeg() && (S.hidden > 0 || S.showAll);
  $('#voicingCount').textContent = begView && !S.showAll ? 'easiest first' : S.list.length + ' shapes, low to high';
  const more_ = begView ? `<button class="btn ghost sm" id="btnShapes" style="grid-column:1/-1">${S.showAll ? 'Show only easy shapes' : 'More shapes (' + S.hidden + ')'}</button>` : '';
  $('#voicings').innerHTML = S.list.map((x, i) => `
    <button class="vcard ${i === S.sel ? 'sel' : ''} ${TP.on && hiddenFor(raw).includes(F.vKey(x)) ? 'hid' : ''}" data-i="${i}">
      ${D.pref[prefKey(raw)] === F.vKey(x) ? '<span class="star">★</span>' : ''}
      ${diagram(x)}
      <div class="cap">${posCaption(x)}</div>${tagsFor(x, raw)}
    </button>`).join('') + more_;
}
function renderMine() {
  const items = Object.entries(D.pref).filter(([k]) => k.startsWith(cfg().tuning + '|')).map(([k, vk]) => ({ name: cl(k.slice(cfg().tuning.length + 1)), vk }));
  const cards = items.map(it => { const v = preferred(it.name); return v && F.vKey(v) === it.vk ? { name: it.name, v } : null; }).filter(Boolean);
  $('#mineHead').hidden = !cards.length;
  $('#mine').innerHTML = cards.map(c => `<button class="vcard" data-open="${esc(c.name)}"><div class="name">${esc(sharpen(c.name))}</div>${diagram(c.v)}</button>`).join('');
}

/* ================= songs ================= */
const SAMPLES = [
  { id: 's-weird', sample: true, title: 'Weird chord playground', artist: 'Fretwork · tap each chord', text:
`{title: Weird chord playground}
[Intro]
[Cmaj9] [A7#9b13] [Dm11] [G13b9]
[Verse]
[Fmaj7#11]Floating on a [Em7b5]minor [A7alt]thing
[Dm9]Slipping through the [G7sus4]changes [Cmaj7/E]home
[Bb6/9]Slash and [Ebmaj7#11]stretch and [Abdim7]spin
[Db13]Land on [C6/9]sixty-nine
` }
];
SAMPLES.forEach(s => { s.nt = 'en'; });
const allSongs = () => D.songs.concat(SAMPLES);
const findSong = id => allSongs().find(s => s.id === id);
const parsedCache = new Map();
const songNt = s => s.nt || 'en';
function parsed(song) { const k = song.id + '|' + song.text.length + '|' + song.text.slice(0, 40); if (!parsedCache.has(k)) parsedCache.set(k, F.withLocale(songNt(song), () => F.parseSong(song.text))); return parsedCache.get(k); }
/* a song keeps the notation it was written in; show its chords in the app's notation, transposed */
function songTc(song, c, tr, flats) { const nt = songNt(song); if (!tr) return F.convert(c, nt, LANG); return F.convert(F.withLocale(nt, () => F.transposeChord(c, tr, flats)), nt, LANG); }
function songChordsUI(song, tr, flats) { const set = new Set(); parsed(song).lines.forEach(l => l.segs && l.segs.forEach(s => { if (s.c) set.add(songTc(song, s.c, tr || 0, flats)); })); return [...set]; }
/* a song as a play-along arrangement: section marks (#Verse) and one entry per chord change */
function songArr(song, tr) {
  const out = [], flats = cfg().flats;
  parsed(song).lines.forEach(l => {
    if (l.t === 'sec') { const n = String(l.text || '').replace(/[\[\]{}:]/g, '').trim(); if (n) out.push('#' + n.slice(0, 24)); }
    else if (l.segs) { let last = null; l.segs.forEach(x => { if (!x.c) return; const c = canon(songTc(song, x.c, tr || 0, flats)); if (c !== last && pgChordOk(c)) out.push(c); last = c; }); }
  });
  return out;
}
function detectNt(text) {
  const n = l => F.withLocale(l, () => { const p = F.parseSong(text); let k = 0; p.lines.forEach(x => x.segs && x.segs.forEach(s => { if (s.c) k++; })); return k; });
  const e = n('en'), s = n('sk'); return s > e ? 'sk' : e > s ? 'en' : LANG;
}

function songCard(s) {
  const p = parsed(s), ch = songChordsUI(s, 0, cfg().flats).slice(0, 7);
  return `<button class="scard" data-song="${esc(s.id)}"><b>${esc(s.title || p.meta.title || 'Untitled')}</b><span>${esc(s.artist || p.meta.artist || '')}</span>
    <div class="mini">${ch.map(c => `<span class="pill">${esc(sharpen(c))}</span>`).join('')}</div></button>`;
}

/* Progressions only (no lyrics): main chords of well-known songs, for learning. Each row links to a web search, nothing is hosted here. */
const PLAYABLE = [
  ['Knockin’ on Heaven’s Door', 'Bob Dylan', 'rock', ['G', 'D', 'Am', 'C'], 'G D Am · G D C'],
  ['Sweet Home Alabama', 'Lynyrd Skynyrd', 'rock', ['D', 'C', 'G'], 'D C G'],
  ['Bad Moon Rising', 'Creedence Clearwater Revival', 'rock', ['D', 'A', 'G'], 'D A G D'],
  ['Brown Eyed Girl', 'Van Morrison', 'rock', ['G', 'C', 'D'], 'G C G D'],
  ['Zombie', 'The Cranberries', 'rock', ['Em', 'C', 'G', 'D'], 'Em C G D'],
  ['Good Riddance (Time of Your Life)', 'Green Day', 'rock', ['G', 'C', 'D'], 'G C D (play C lightly as Cadd9)'],
  ['Highway to Hell', 'AC/DC', 'rock', ['A', 'D', 'G'], 'A D G'],
  ['Back in Black', 'AC/DC', 'rock', ['E', 'D', 'A'], 'E D A (power chords work well)'],
  ['Hey Joe', 'Jimi Hendrix', 'rock', ['C', 'G', 'D', 'A', 'E'], 'C G D A E'],
  ['La Bamba', 'Ritchie Valens', 'rock & roll', ['C', 'F', 'G'], 'C F G'],
  ['Twist and Shout', 'The Beatles', 'rock & roll', ['D', 'G', 'A'], 'D G A'],
  ['Louie Louie', 'The Kingsmen', 'rock & roll', ['A', 'D', 'Em'], 'A D Em D'],
  ['Wild Thing', 'The Troggs', 'rock & roll', ['A', 'D', 'E'], 'A D E D'],
  ['Gloria', 'Them', 'rock & roll', ['E', 'D', 'A'], 'E D A'],
  ['Stand By Me', 'Ben E. King', 'rock & roll', ['G', 'Em', 'C', 'D'], 'G Em C D'],
  ['Blitzkrieg Bop', 'Ramones', 'punk', ['A', 'D', 'E'], 'A D E'],
  ['About a Girl', 'Nirvana', 'grunge', ['Em', 'G', 'D', 'A'], 'Em G D A'],
  ['Smells Like Teen Spirit', 'Nirvana', 'grunge · power chords', ['F5', 'Bb5', 'Ab5', 'Db5'], 'F5 B♭5 A♭5 D♭5 (riff style)'],
  ['Smoke on the Water', 'Deep Purple', 'rock · power chords', ['G5', 'Bb5', 'C5', 'Db5'], 'G5 B♭5 C5 · G5 B♭5 D♭5 C5'],
  ['Seven Nation Army', 'The White Stripes', 'rock · power chords', ['E5', 'G5', 'D5', 'C5', 'B5'], 'E5 G5 E5 D5 C5 B5 (the famous riff)'],
  ['All the Small Things', 'blink-182', 'punk · power chords', ['G5', 'C5', 'D5'], 'G5 C5 D5'],
  ['Basket Case', 'Green Day', 'punk · power chords', ['E5', 'B5', 'C#5', 'G#5', 'A5'], 'E5 B5 C♯5 G♯5 A5 B5']
];
/* strumming style and speed that suit each song: [pattern, speed 1-3] */
const SONG_STYLE = { 'Smells Like Teen Spirit': ['punk', 2], 'About a Girl': ['folk', 2], 'Basket Case': ['punk', 3], 'Good Riddance (Time of Your Life)': ['arp', 1],
  'Knockin’ on Heaven’s Door': ['folk', 1], 'Sweet Home Alabama': ['rock', 2], 'Bad Moon Rising': ['pop', 2], 'Brown Eyed Girl': ['pop', 2], 'Zombie': ['rock', 2],
  'Highway to Hell': ['chug', 2], 'Back in Black': ['chug', 2], 'Hey Joe': ['folk', 1], 'La Bamba': ['pop', 3], 'Twist and Shout': ['rock', 3], 'Louie Louie': ['rock', 2],
  'Wild Thing': ['punk', 2], 'Gloria': ['rock', 2], 'Stand By Me': ['pop', 1], 'Blitzkrieg Bop': ['punk', 3], 'Smoke on the Water': ['down', 2], 'Seven Nation Army': ['down', 2], 'All the Small Things': ['punk', 3] };
const songStyle = r => SONG_STYLE[r[0]] || ['rock', 2];
const playSeq = r => r[4].replace(/\(.*?\)/g, ' ').replace(/♭/g, 'b').replace(/♯/g, '#').split(/[\s·]+/).filter(t => /^[A-G][#b]?(m|5|7)?$/.test(t));
const FEATURED = [
  ['Smells Like Teen Spirit', 'Nirvana', 'Four power chords, all the same shape slid along the neck.', ['That is the riff? It is just one shape!', 'Yep. Slide it around. Sounds huge, plays easy.']],
  ['About a Girl', 'Nirvana', 'Four open chords and you are playing Nirvana.', ['Where is the fancy part?', 'There is none. Four chords, strum, done.']],
  ['Basket Case', 'Green Day', 'Power chords again: one shape, moved around.', ['Dude, that is way too fast.', 'Slow it down first. Speed comes later.']],
  ['Good Riddance (Time of Your Life)', 'Green Day', 'Three chords. The one everybody plays round the campfire.', ['Only three chords? Is that cheating?', 'Nope. That is the secret.']]
];
const TALK = [['Hey, this is not exactly how I know it.', 'Sure. It is simplified.'], ['Simplified? So it is not the real song?', 'It is the real chords. It should get you started though.'], ['Huh. So I can play it today?', 'Yeah. Press play, strum along. Fancy stuff comes later.']];
const bubble = (who, t) => `<div class="bub ${who ? 'b2' : 'b1'}"><i>${who ? 'D' : 'S'}</i><p>${esc(t)}</p></div>`;
function renderFeatured() {
  const el = $('#featured'); if (!el) return;
  el.innerHTML = `<h3 class="sect">Play a real song today <small>press play, strum along</small></h3>
    <div class="talk">${TALK.map(([a, b]) => bubble(0, a) + bubble(1, b)).join('')}</div>
    <div class="featgrid">${FEATURED.map(([t, a, d, cv]) => {
      const r = PLAYABLE.find(x => x[0] === t); if (!r) return '';
      const q = playSeq(r), u = [...new Set(q)];
      return `<div class="scard feat"><b>${esc(t)}</b><span>${esc(a)} · just ${u.length} chords</span>
        <div class="herorow">${u.map(c => { const v = preferred(cl(c)); return `<div class="hchip"><div class="name">${esc(sharpen(cl(c)))}</div>${v ? diagram(v) : ''}</div>`; }).join('')}</div>
        <p class="note" style="margin:4px 0">${esc(d)}</p>
        <div class="talk sm">${bubble(0, cv[0])}${bubble(1, cv[1])}</div>
        <p class="progline">${esc(q.map(c => sharpen(cl(c))).join('  ›  '))}</p>
        <div class="row"><button class="btn primary" data-playsong="${esc(t)}">▶ Play along</button><button class="btn sm" data-copysong="${esc(t)}">Edit: make my own</button></div></div>`;
    }).join('')}</div>`;
}
function renderPlayable() {
  const el = $('#playable'); if (!el) return;
  const beg = isBeg();
  const rows = PLAYABLE.map(r => ({ r, n: r[3].length, ok: r[3].every(c => learned(c)) }))
    .sort((a, b) => (b.ok - a.ok) || (a.n - b.n));
  el.innerHTML = `<h3 class="sect">Songs you can play <small>chords only, no lyrics</small></h3>
    <p class="note" style="margin:0 0 8px">Main chord progressions of well-known songs, simplest first. Chords like E5 or G5 are power chords: two or three strings, one shape you slide up and down the neck. “Find chords” opens a web search in a new tab, where you can look for the full chart.</p>
    ${rows.map(({ r, ok }) => {
      const q = encodeURIComponent(r[0] + ' ' + r[1] + ' chords');
      return `<div class="scard prow ${ok ? 'ok' : ''}"><b>${esc(r[0])}</b><span>${esc(r[1])} · ${esc(r[2])}${ok ? ' · you know these chords' : ''}</span>
        <div class="mini">${r[3].map(c => `<button class="pill" data-open="${esc(cl(c))}">${esc(sharpen(cl(c)))}</button>`).join('')}</div>
        <span class="progline">${esc(r[4])}</span>
        <button class="btn sm primary" data-playsong="${esc(r[0])}">▶ Play along</button> <button class="btn sm" data-copysong="${esc(r[0])}">Edit: make my own</button> <button class="btn sm" data-learnrow="${esc(r[3].map(canon).join(','))}" data-t="${esc(r[0])}">Learn chords</button> <a class="btn sm ghost" href="https://duckduckgo.com/?q=${q}" target="_blank" rel="noopener noreferrer">Find chords ↗</a></div>`;
    }).join('')}`;
}

/* ================= progressions: save a chord sequence and play it ================= */
const PG = { tok: 0 };
const pgChordOk = n => { const o = voicingsFor(cl(n)); return o.chord.ok && o.list.length > 0; };
function renderProgs() {
  const el = $('#progs'); if (!el) return;
  const L = D.progs || [];
  el.innerHTML = `<div class="rowbar"><h3 class="sect" style="margin:0">Progressions</h3><button class="btn sm" id="pgNew">＋ New progression</button></div>`
    + (L.length ? L.map(p => `<div class="scard prow"><b>${esc(p.name || 'Untitled')}</b>
        <div class="mini">${p.chords.map(c => isMark(c) ? `<span class="pill sec">${esc(c.slice(1))}</span>` : `<span class="pill">${c ? esc(sharpen(cl(c))) : '–'}</span>`).join('')}</div>
        <div class="row"><button class="btn sm primary" data-pgplay="${esc(p.id)}">▶ Play</button><button class="btn sm ghost" data-pgedit="${esc(p.id)}">Edit</button></div></div>`).join('')
      : '<p class="note" style="margin:6px 0 10px">Save a sequence of chords, such as Em C G D, and let the app play it for you to practise along.</p>');
}
function pgEdit(id, seed) {
  const ex = (D.progs || []).find(p => p.id === id);
  let seq = ex ? ex.chords.slice() : (seed && seed.chords ? seed.chords.slice() : []);
  const nameInit = ex ? ex.name : (seed && seed.name) || '';
  const quick = ['Em', 'Am', 'D', 'G', 'C', 'A', 'E', 'Dm'];
  openModal(`<h2>${ex ? 'Edit progression' : 'New progression'}</h2>
    <label class="field"><span>Name</span><input id="pgName" value="${esc(nameInit)}" placeholder="e.g. My first four" maxlength="50"></label>
    <div class="field"><span>Chords in order</span><div class="seqrow" id="pgSeq"></div></div>
    <div class="inputrow"><div class="engraved"><input id="pgIn" placeholder="Add a chord, e.g. Em" autocomplete="off" autocapitalize="off" spellcheck="false"></div><button class="btn" id="pgAdd">Add</button></div>
    <div class="chiprow" id="pgQuick" style="margin:8px 0">${quick.map(q => `<button class="chip" data-q="${q}">${esc(sharpen(cl(q)))}</button>`).join('')}</div>
    <div class="row">${ex ? '<button class="btn danger" id="pgDel">Delete</button>' : ''}<span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="pgSave">Save</button></div>`, b => {
    const draw = () => {
      $('#pgSeq', b).innerHTML = seq.length ? seq.map((c, i) => `<span class="seqchip"><button data-mv="${i}:-1" aria-label="Move left">‹</button><b>${esc(sharpen(cl(c)))}</b><button data-mv="${i}:1" aria-label="Move right">›</button><button data-rm="${i}" aria-label="Remove">✕</button></span>`).join('') : '<span class="note">Nothing yet. Add chords below.</span>';
    };
    const add = name => {
      name = name.trim(); if (!name) return;
      const en = canon(name);
      if (!pgChordOk(en)) { toast('I can’t find a playable shape for “' + name + '”'); return; }
      seq.push(en); draw(); $('#pgIn', b).value = '';
    };
    draw();
    $('#pgAdd', b).onclick = () => add($('#pgIn', b).value);
    $('#pgIn', b).addEventListener('keydown', e => { if (e.key === 'Enter') add($('#pgIn', b).value); });
    $('#pgQuick', b).onclick = e => { const q = e.target.closest('[data-q]'); if (q) add(cl(q.dataset.q)); };
    $('#pgSeq', b).onclick = e => {
      const m = e.target.closest('[data-mv]'), r = e.target.closest('[data-rm]');
      if (m) { const [i, d] = m.dataset.mv.split(':').map(Number), j = i + d; if (j >= 0 && j < seq.length) { [seq[i], seq[j]] = [seq[j], seq[i]]; draw(); } }
      if (r) { seq.splice(+r.dataset.rm, 1); draw(); }
    };
    $('#pgSave', b).onclick = () => {
      if (!seq.length) { toast('Add at least one chord'); return; }
      const name = $('#pgName', b).value.trim() || seq.slice(0, 4).map(c => cl(c)).join(' ');
      D.progs = D.progs || [];
      if (ex) { ex.name = name; ex.chords = seq; } else D.progs.unshift({ id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), name, chords: seq });
      save(); closeModal(); renderProgs(); toast('Progression saved');
    };
    if ($('#pgDel', b)) $('#pgDel', b).onclick = () => { if (!confirm('Delete this progression?')) return; D.progs = D.progs.filter(p => p.id !== ex.id); save(); closeModal(); renderProgs(); };
  });
}
function pgClick(strong) {
  if (!cfg().sound) return; const c = actx(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + 0.01;
  o.frequency.value = strong ? 1500 : 1000; g.gain.setValueAtTime(strong ? 0.12 : 0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.06);
}
function pgPlayer(title, chords, o) {
  o = o || {}; say('playalong');
  const c0 = cfg(); c0.pgSpeed = o.spd || c0.pgSpeed || 2; c0.pgBeats = o.bts || c0.pgBeats || 4; if (c0.pgLoop == null) c0.pgLoop = true; if (c0.pgClick == null) c0.pgClick = true;
  let pat = o.pat || c0.pgPat || 'folk';
  const tok = ++PG.tok; let running = false, timer = 0, ci = 0, slot = 0, next = 0;
  const alive = () => PG.tok === tok && !$('#modal').hidden;
  const seg = (id, opts, cur) => `<nav class="seg" id="${id}">${opts.map(([v, l]) => `<button class="seg-b ${cur === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</nav>`;
  openModal(`<h2>${esc(title)}</h2>
    <div id="plSec" class="plsec">&nbsp;</div>
    <div id="plDia" style="text-align:center;min-height:200px"></div>
    <div class="notepills" id="plSeq" style="justify-content:center">${chords.map((c, i) => isMark(c) ? `<span class="pill sec" data-i="${i}">${esc(c.slice(1))}</span>` : `<span class="pill" data-i="${i}">${c ? esc(sharpen(cl(c))) : '–'}</span>`).join('')}</div>
    <div class="row" style="justify-content:center;margin:12px 0"><button class="btn primary" id="plGo">▶ Play</button></div>
    <div class="field"><span>Strumming</span><div class="chiprow" id="plPat">${PATS.map(p => `<button class="chip ${p[0] === pat ? 'on' : ''}" data-p="${p[0]}">${p[1]}</button>`).join('')}</div><p class="note" id="plArr" style="margin:6px 0 0"></p></div>
    <div class="field"><span>Speed</span>${seg('plSpd', [[1, 'Slow'], [2, 'Medium'], [3, 'Fast']], c0.pgSpeed)}</div>
    <div class="field"><span>Beats per chord</span>${seg('plBts', [[1, '1'], [2, '2'], [4, '4']], c0.pgBeats)}</div>
    <div class="toggles"><label class="switch"><span>Loop</span><input type="checkbox" id="plLoop" ${c0.pgLoop ? 'checked' : ''}><i></i></label>
    <label class="switch"><span>Click on each beat</span><input type="checkbox" id="plClk" ${c0.pgClick ? 'checked' : ''}><i></i></label></div>
    <div class="row"><span class="grow"></span><button class="btn" data-close>Close</button></div>`, b => {
    const show = i => {
      const v = chords[i] ? preferred(cl(chords[i])) : null;
      $('#plDia', b).innerHTML = v ? diagram(v, { names: true }) : (chords[i] ? '' : '<p class="note" style="padding-top:80px">rest</p>');
      $$('#plSeq .pill', b).forEach((p, k) => p.classList.toggle('root', k === i));
    };
    const stop = () => { running = false; clearTimeout(timer); $('#plGo', b).textContent = '▶ Play'; };
    const arrows = () => { const p = PATS.find(x => x[0] === pat) || PATS[1]; $('#plArr', b).textContent = patArrows(p[2]) + '   ' + p[3]; };
    const setSec = m => { $('#plSec', b).textContent = m.slice(1); };
    const skip = () => { while (ci < chords.length && isMark(chords[ci])) { setSec(chords[ci]); ci++; } };
    const step = () => {
      if (!running || !alive()) { running = false; return; }
      if (slot === 0) {
        skip();
        if (ci >= chords.length) { if (c0.pgLoop) { ci = 0; skip(); } else { stop(); ci = 0; return; } }
        if (ci >= chords.length) { stop(); return; }
        show(ci);
      }
      const ch = chords[ci];
      if (c0.pgClick && slot % 2 === 0) pgClick(slot === 0);
      if (ch) playSlot(preferred(cl(ch)), (PATD[pat] || 'D-D-D-D-')[slot]);
      if (++slot >= c0.pgBeats * 2) { slot = 0; ci++; }
      next += [0, 900, 650, 450][c0.pgSpeed] / 2;
      timer = setTimeout(step, Math.max(0, next - performance.now()));
    };
    arrows(); show(Math.max(0, chords.findIndex(isChord)));
    $('#plGo', b).onclick = () => { if (running) { stop(); return; } running = true; ci = 0; slot = 0; next = performance.now(); $('#plGo', b).textContent = '■ Stop'; step(); };
    $('#plPat', b).onclick = e => { const x = e.target.closest('[data-p]'); if (!x) return; pat = x.dataset.p; c0.pgPat = pat; save(); $$('#plPat .chip', b).forEach(y => y.classList.toggle('on', y === x)); arrows(); };
    $('#plSpd', b).onclick = e => { const x = e.target.closest('[data-v]'); if (!x) return; c0.pgSpeed = +x.dataset.v; save(); $$('#plSpd .seg-b', b).forEach(y => y.classList.toggle('on', y === x)); };
    $('#plBts', b).onclick = e => { const x = e.target.closest('[data-v]'); if (!x) return; c0.pgBeats = +x.dataset.v; slot = 0; save(); $$('#plBts .seg-b', b).forEach(y => y.classList.toggle('on', y === x)); };
    $('#plLoop', b).onchange = e => { c0.pgLoop = e.target.checked; save(); };
    $('#plClk', b).onchange = e => { c0.pgClick = e.target.checked; save(); };
  });
}

/* ================= pinned chords (top bar) and the sequence window ================= */
const pinned = k => (cfg().pins || []).includes(k);
function togglePin(k) {
  const P = cfg().pins = cfg().pins || [];
  const i = P.indexOf(k); if (i >= 0) P.splice(i, 1); else P.push(k);
  save(); renderPins(); if (P.length) say('pin');
}
function renderPins() {
  const el = $('#pinbar'); if (!el) return;
  const P = cfg().pins || [];
  el.hidden = !P.length; document.body.classList.toggle('has-pins', !!P.length);
  el.innerHTML = P.map(k => { const nm = cl(k), v = preferred(nm); return `<div class="pin"><button class="pinplay" data-pinplay="${esc(k)}" aria-label="${esc(nm)}"><b>${esc(sharpen(nm))}</b>${v ? diagram(v) : ''}</button><button class="pinx" data-unpin="${esc(k)}" aria-label="Unpin">✕</button><button class="pinadd" data-pinadd="${esc(k)}" aria-label="Add to sequence">＋</button></div>`; }).join('');
}
const SQ = { tok: 0, running: false, sel: -1, min: false };
function seqBars() { return SQ.prog ? SQ.prog.bars : (cfg().seq = cfg().seq || ['', '', '', '']); }
function seqLoad(id, seed) {   // open the sequence window on a saved progression, a seed (song / copy) or a new one
  const p = id && (D.progs || []).find(x => x.id === id), c0 = cfg();
  if (p && p.spd) c0.pgSpeed = p.spd; if (p && p.bts) c0.pgBeats = p.bts;
  if (seed && seed.spd) c0.pgSpeed = seed.spd;
  SQ.prog = { id: p ? p.id : null, name: p ? p.name : (seed && seed.name) || '', pat: (p && p.pat) || (seed && seed.pat) || '', bars: p ? p.chords.slice() : seed ? seed.bars.slice() : (seqBars().some(isChord) ? seqBars().slice() : ['', '', '', '']) };
  if (SQ.prog.bars.length < 2) SQ.prog.bars.push('');
  SQ.sel = SQ.prog.bars.findIndex(x => !x); seqStop(); $('#seqwin').innerHTML = ''; seqOpen();
}
function seqAdd(k) {
  if (!pgChordOk(k)) { toast('I can’t find a playable shape for “' + cl(k) + '”'); return; }
  const B = seqBars(); let i = SQ.sel;
  if (!(i >= 0 && i < B.length && !B[i])) i = B.findIndex(x => !x);
  if (i < 0) { B.push(''); i = B.length - 1; }
  B[i] = k; SQ.sel = B.findIndex((x, j) => j > i && !x);
  save(); seqOpen(); strum(preferred(cl(k)));
}
function seqOpen() { say('seq'); SQ.open = true; SQ.min = false; renderSeq(); }
function seqClose() { seqStop(); SQ.prog = null; SQ.open = false; $('#seqwin').hidden = true; }
function seqStop() { SQ.tok++; SQ.running = false; const b = $('#sqPlay'); if (b) b.textContent = '▶ Play'; document.querySelectorAll('#seqwin .now').forEach(x => x.classList.remove('now')); const n = $('#sqNow'); if (n) n.textContent = ''; }
const seqPat = () => (SQ.prog && SQ.prog.pat) || cfg().pgPat || 'folk';
function seqPlay() {
  if (SQ.running) { seqStop(); return; }
  const c0 = cfg(); c0.pgSpeed = c0.pgSpeed || 2; c0.pgBeats = c0.pgBeats || 4; if (c0.pgClick == null) c0.pgClick = true;
  if (!seqBars().some(isChord)) { toast('Add a chord to a bar first'); return; }
  const tok = ++SQ.tok; SQ.running = true; $('#sqPlay').textContent = '■ Stop';
  let i = 0, slot = 0, next = performance.now();
  const step = () => {
    if (tok !== SQ.tok) return;
    const bars = seqBars(), pat = PATD[seqPat()] || PATD.folk;
    if (!bars.some(isChord)) { seqStop(); return; }
    if (slot === 0) {
      let g = 0; while (isMark(bars[i]) && g++ <= bars.length) { const n = $('#sqNow'); if (n) n.textContent = bars[i].slice(1); i = (i + 1) % bars.length; }
      document.querySelectorAll('#seqwin [data-b]').forEach(x => x.classList.toggle('now', +x.dataset.b === i));
    }
    if (c0.pgClick && slot % 2 === 0) pgClick(slot === 0);
    if (bars[i] && isChord(bars[i])) playSlot(preferred(cl(bars[i])), pat[slot]);
    if (++slot >= c0.pgBeats * 2) { slot = 0; i = (i + 1) % bars.length; }
    next += [0, 900, 650, 450][c0.pgSpeed] / 2;
    setTimeout(step, Math.max(0, next - performance.now()));
  };
  step();
}
function renderSeq() {
  const el = $('#seqwin'); if (!el) return; if (!SQ.open) { el.hidden = true; return; }
  if (SQ.prog && $('#sqName')) SQ.prog.name = $('#sqName').value;
  const B = seqBars(), c0 = cfg(); c0.pgSpeed = c0.pgSpeed || 2; c0.pgBeats = c0.pgBeats || 4;
  el.hidden = false; el.classList.toggle('min', SQ.min);
  el.innerHTML = `<div class="sqhead"><b>${SQ.prog ? (SQ.prog.id ? 'Edit progression' : 'New progression') : 'Sequence'}</b><button class="btn sm" id="sqMin" aria-label="Minimise">${SQ.min ? '▴' : '▾'}</button><button class="btn sm primary" id="sqX" aria-label="Close">✕</button></div>
  <div class="sqbody">
    ${SQ.prog ? `<label class="field"><span>Name</span><input id="sqName" value="${esc(SQ.prog.name)}" placeholder="e.g. My first four" maxlength="50"></label>` : ''}
    <div class="sqbars">${(() => { let n = 0; return B.map((k, i) => isMark(k)
      ? `<div class="sqsec ${i === SQ.sel ? 'sel' : ''}" data-b="${i}"><b>${esc(k.slice(1))}</b><button class="bx" data-bx="${i}" aria-label="Remove this section mark">✕</button></div>`
      : `<div class="sqbar ${i === SQ.sel ? 'sel' : ''} ${k ? '' : 'empty'}" data-b="${i}"><span class="n">${++n}</span>${k ? (() => { const nm = cl(k), v = preferred(nm); return `<b>${esc(sharpen(nm))}</b>${v ? diagram(v) : ''}`; })() : '<i>empty</i>'}<button class="bx" data-bx="${i}" aria-label="${k ? 'Empty this bar' : 'Remove this bar'}">✕</button></div>`).join(''); })()}
      <button class="sqaddbar" id="sqAddBar" aria-label="Add an empty bar">＋<small>bar</small></button></div>
    <div class="field"><span>Mark a section (goes before the picked bar, or at the end)</span><div class="chiprow" id="sqSecs">${SECS.map(x => `<button class="chip" data-sec="${x}">${x}</button>`).join('')}</div></div>
    <div class="inputrow"><div class="engraved"><input id="sqIn" placeholder="Type a chord, e.g. Em" autocomplete="off" autocapitalize="off" spellcheck="false"></div><button class="btn" id="sqAdd">Add</button></div>
    <div class="actions">
      <button class="btn primary" id="sqPlay">${SQ.running ? '■ Stop' : '▶ Play'}</button>
      <button class="btn sm" id="sqSpd">${['', 'Slow', 'Medium', 'Fast'][c0.pgSpeed]}</button>
      <button class="btn sm" id="sqBts">${c0.pgBeats} beats a bar</button>
      <span class="lbl">Strumming</span><button class="btn sm" id="sqPat">${(PATS.find(x => x[0] === seqPat()) || PATS[1])[1]}</button>
      ${SQ.prog ? `<button class="btn sm primary" id="sqSave">${SQ.prog.id ? 'Save changes' : 'Save progression'}</button>${SQ.prog.id ? '<button class="btn sm danger" id="sqDel">Delete</button>' : ''}` : '<button class="btn sm ghost" id="sqSave">Save as progression</button>'}
      <button class="btn sm ghost" id="sqClear">Clear all</button>
    </div>
    <p class="note" style="margin:6px 0 0"><b id="sqNow"></b> ${patArrows((PATS.find(x => x[0] === seqPat()) || PATS[1])[2])}</p>
    <p class="note" style="margin:6px 0 0">Tap a bar to pick it, then use “＋ Add to sequence” on any chord. An empty bar is a rest.</p>
  </div>`;
}
function seqInit() {
  const el = $('#seqwin');
  el.addEventListener('click', e => {
    const B = seqBars(); const t = id => e.target.closest(id);
    if (t('#sqX')) { seqClose(); return; }
    if (t('#sqMin')) { SQ.min = !SQ.min; renderSeq(); return; }
    if (SQ.prog && $('#sqName')) SQ.prog.name = $('#sqName').value;
    const sc = t('[data-sec]'); if (sc) { const at = SQ.sel >= 0 && SQ.sel < B.length ? SQ.sel : B.length; B.splice(at, 0, '#' + sc.dataset.sec); SQ.sel = at + 1 < B.length ? at + 1 : -1; save(); renderSeq(); return; }
    if (t('#sqPat')) { const cur = PATS.findIndex(x => x[0] === seqPat()), nx = PATS[(cur + 1) % PATS.length][0]; if (SQ.prog) SQ.prog.pat = nx; else cfg().pgPat = nx; save(); renderSeq(); return; }
    const bx = t('[data-bx]'); if (bx) { const i = +bx.dataset.bx; if (isMark(B[i])) { B.splice(i, 1); if (SQ.sel >= B.length) SQ.sel = -1; } else if (B[i]) B[i] = ''; else if (B.filter(x => !isMark(x)).length > 1) { B.splice(i, 1); if (SQ.sel >= B.length) SQ.sel = -1; } save(); renderSeq(); return; }
    const b = t('[data-b]'); if (b) { const i = +b.dataset.b; SQ.sel = i; if (isChord(B[i])) strum(preferred(cl(B[i]))); renderSeq(); return; }
    if (t('#sqAddBar')) { B.push(''); if (SQ.prog) SQ.prog.name = ($('#sqName') || {}).value || SQ.prog.name; SQ.sel = B.length - 1; save(); renderSeq(); return; }
    if (t('#sqAdd')) { const v = $('#sqIn').value.trim(); if (v) { seqAdd(canon(v)); } return; }
    if (t('#sqPlay')) { seqPlay(); return; }
    if (t('#sqSpd')) { const c = cfg(); c.pgSpeed = c.pgSpeed % 3 + 1; save(); renderSeq(); return; }
    if (t('#sqBts')) { const c = cfg(); c.pgBeats = c.pgBeats === 1 ? 2 : c.pgBeats === 2 ? 4 : 1; save(); renderSeq(); return; }
    if (t('#sqSave')) {
      if (!SQ.prog) { if (!B.some(isChord)) { toast('Add a chord first'); return; } seqLoad(null); return; }
      if (!B.some(isChord)) { toast('Add at least one chord'); return; }
      const ch = B.slice(); while (ch.length && !ch[ch.length - 1]) ch.pop();
      const nm = ($('#sqName').value || '').trim() || ch.filter(isChord).slice(0, 4).map(c => cl(c)).join(' ');
      const extra = { pat: seqPat(), spd: cfg().pgSpeed, bts: cfg().pgBeats };
      D.progs = D.progs || [];
      if (SQ.prog.id) { const ex = D.progs.find(x => x.id === SQ.prog.id); if (ex) { ex.name = nm; ex.chords = ch; Object.assign(ex, extra); } }
      else { SQ.prog.id = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); D.progs.unshift(Object.assign({ id: SQ.prog.id, name: nm, chords: ch }, extra)); }
      SQ.prog.name = nm; save(); renderProgs(); renderSeq(); toast('Progression saved'); return;
    }
    if (t('#sqDel')) { if (!confirm('Delete this progression?')) return; D.progs = D.progs.filter(x => x.id !== SQ.prog.id); save(); renderProgs(); seqClose(); return; }
    if (t('#sqClear')) { B.length = 0; B.push('', '', '', ''); SQ.sel = -1; seqStop(); save(); renderSeq(); }
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'sqIn') { const v = e.target.value.trim(); if (v) seqAdd(canon(v)); } });
  $('#pinbar').addEventListener('click', e => {
    const p = e.target.closest('[data-pinplay]'); if (p) { strum(preferred(cl(p.dataset.pinplay))); return; }
    const u = e.target.closest('[data-unpin]'); if (u) { togglePin(u.dataset.unpin); if (S.chord) renderChord(); return; }
    const a = e.target.closest('[data-pinadd]'); if (a) seqAdd(a.dataset.pinadd);
  });
  $('#btnSeq').onclick = () => { if (SQ.open) seqClose(); else seqOpen(); };
  const place = () => { const d = document.querySelector('.deck'); if (d) document.documentElement.style.setProperty('--deckh', (d.offsetHeight + 18) + 'px'); };
  place(); addEventListener('resize', place); setTimeout(place, 600);
  renderPins();
}

/* ================= edit a chord shape: drag the finger dots, see if it can be held, name it, save it ================= */
const ED = { on: false, frets: [], orig: [], base: 1, ni: 0, drag: null };
function edStart() {
  const v = S.list[S.sel]; if (!v) return;
  say('edit');
  Object.assign(ED, { on: true, frets: v.frets.slice(), orig: v.frets.slice(), base: v.base, ni: 0, drag: null });
  edRender();
}
function edAnalyse() {
  const fr = ED.frets, fg = F.fingering(fr), id = identify(fr), tun = F.TUNINGS[cfg().tuning], names = cfg().flats ? F.FLAT : F.SHARP;
  const r = id.res[Math.min(ED.ni, Math.max(0, id.res.length - 1))] || null;
  const v = { frets: fr.slice(), fingers: fg.fingers, barre: fg.barre, fingerCount: fg.count, base: ED.base,
    notes: fr.map((f, s) => { if (f < 0) return null; const pc = (tun[s] + f) % 12, t = r && r.chord.tones.find(x => x.pc === pc); return { name: (SK && pc === 10) ? 'Bb' : names[pc], label: t ? t.label : '' }; }) };
  const fretted = fr.filter(f => f > 0), span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0, played = fr.filter(f => f >= 0).length;
  let warn = ['ok', 'Playable: ' + fg.count + (fg.count === 1 ? ' finger' : ' fingers') + (fg.barre ? ' (one is a barre)' : '') + '.'];
  if (fg.count > 4) warn = ['red', 'This shape needs ' + fg.count + ' fingers and a hand has four. Move a dot, mute a string, or turn some of them into a barre.'];
  else if (span >= 4) warn = ['red', 'A stretch of ' + (span + 1) + ' frets is very hard to hold. Try bringing the dots closer together.'];
  else if (span === 3) warn = ['warn', 'A wide stretch (4 frets). Possible with bigger hands.'];
  if (played < 2) warn = ['warn', 'Place at least two notes.'];
  return { fg, id, r, v, warn, changed: fr.join() !== ED.orig.join() };
}
function edRender() {
  const A = edAnalyse(), box = $('#detail'); box.classList.add('editing');
  if (A.warn[0] === 'red') say('toomany');
  if (!$('#editDia')) {
    box.innerHTML = `<div><div id="editDia"></div><p class="taphint">Drag a finger dot to move it. Tap an empty spot to add a finger, or a dot to lift it. Tap ○ / ✕ above the string to open or mute it.</p>
      <div class="actions" style="justify-content:center"><button class="btn sm ghost" data-edshift="-1">‹ Lower on the neck</button><button class="btn sm ghost" data-edshift="1">Higher on the neck ›</button></div></div>
      <div><h2>Editing this shape <small class="sub">edit mode</small></h2><div id="edInfo"></div></div>`;
  }
  $('#editDia').innerHTML = diagram(A.v, { names: true });
  const names = A.id.res.slice(0, 5);
  $('#edInfo').innerHTML = `<div class="edwarn ${A.warn[0]}">${esc(A.warn[1])}</div>
    <div class="field"><span>This looks like</span>${names.length ? `<div class="chiprow">${names.map((r, i) => `<button class="chip ${i === Math.min(ED.ni, names.length - 1) ? 'on' : ''}" data-edname="${i}">${esc(sharpen(r.name))}</button>`).join('')}</div>` : '<p class="note">No standard chord matches these notes yet. Move a finger or mute a string.</p>'}</div>
    <div class="actions">
      <button class="btn primary" id="edPlay">▶ Strum all</button>
      <button class="btn" id="edSave" ${A.r ? '' : 'disabled'}>${A.r ? 'Save as my ' + esc(sharpen(A.r.name)) : 'Save as new'}</button>
      ${TP.on && A.r ? '<button class="btn teach" id="edPrimary">◆ Make the default for everyone</button>' : ''}
      <button class="btn ghost" id="edReset" ${A.changed ? '' : 'disabled'}>↺ Reset</button>
      <button class="btn ghost" id="edDone">${A.changed ? 'Discard' : 'Done'}</button>
    </div>`;
}
function edCell(e) {
  const svg = $('#editDia svg'); if (!svg) return null;
  const m = svg.getScreenCTM(); if (!m) return null;
  const x = (e.clientX - m.e) / m.a, y = (e.clientY - m.f) / m.d;
  const k = Math.round((x - 38) / 22); if (k < 0 || k > 5 || Math.abs(x - 38 - k * 22) > 13) return null;
  const s = cfg().lh ? 5 - k : k;
  if (y < 42) return y < 0 ? null : { s, top: true };
  const r = Math.floor((y - 42) / 34) + 1; if (r < 1 || r > 5) return null;
  return { s, f: ED.base + r - 1 };
}
function edClick(e) {
  if (!ED.on) { if (e.target.closest('#btnEdit')) { edStart(); return true; } return false; }
  const t = x => e.target.closest(x);
  if (t('#edPlay')) { strum(edAnalyse().v); return true; }
  if (t('#edDone')) { renderChord(); return true; }
  if (t('#edReset')) { ED.frets = ED.orig.slice(); ED.ni = 0; edRender(); return true; }
  const n = t('[data-edname]'); if (n) { ED.ni = +n.dataset.edname; edRender(); return true; }
  const sh = t('[data-edshift]');
  if (sh) {
    const nb = Math.max(1, Math.min(12, ED.base + +sh.dataset.edshift)), fr = ED.frets.filter(f => f > 0);
    if (fr.length && (Math.min(...fr) < nb || Math.max(...fr) > nb + 4)) toast('Move the dots first, they would fall off the board');
    else { ED.base = nb; edRender(); }
    return true;
  }
  if (t('#edPrimary')) {
    const A = edAnalyse(); if (!A.r) return true;
    const nm = A.r.name; TP.local[prefKey(nm)] = F.vKey(voicingFromFrets(ED.frets.slice(), A.r.chord)); LS.set('fw.teacher.primary', TP.local);
    VC.clear(); toast(nm + ': set as default. Publish it from Settings or the Defaults board.'); setChordText(nm); return true;
  }
  if (t('#edSave')) {
    const A = edAnalyse(); if (!A.r) return true;
    const v = voicingFromFrets(ED.frets.slice(), A.r.chord), nm = A.r.name;
    D.pref[prefKey(nm)] = F.vKey(v); save(); renderMine();
    toast('Saved as your ' + nm); say('saved'); setChordText(nm); return true;
  }
  return false;
}
(function edPointer() {
  document.addEventListener('pointerdown', e => {
    if (!ED.on || !e.target.closest('#editDia')) return;
    const c = edCell(e); if (!c) return; e.preventDefault();
    if (c.top) { const cur = ED.frets[c.s]; ED.frets[c.s] = cur === -1 ? 0 : -1; ED.ni = 0; edRender(); return; }
    const wasDot = ED.frets[c.s] === c.f, snap = ED.frets.slice(); if (wasDot) snap[c.s] = 0;
    ED.drag = { snap, s: c.s, f: c.f, wasDot, moved: false };
    if (!wasDot) { ED.frets[c.s] = c.f; ED.ni = 0; edRender(); strum({ frets: ED.frets.map((f, i) => i === c.s ? f : -1) }); }
  }, { passive: false });
  document.addEventListener('pointermove', e => {
    const d = ED.drag; if (!d) return; const c = edCell(e); if (!c || c.top) return;
    if (c.s === d.s && c.f === d.f && !d.moved) return;
    d.moved = true; const fr = d.snap.slice(); fr[c.s] = c.f;
    if (fr.join() !== ED.frets.join()) { ED.frets = fr; ED.ni = 0; edRender(); }
  });
  const up = () => {
    const d = ED.drag; if (!d) return; ED.drag = null;
    if (d.wasDot && !d.moved) { ED.frets = d.snap; ED.ni = 0; edRender(); }
  };
  document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
})();
const TALKS = {"welcome": [[0, "Uh, where are we?"], [1, "Fretwork. You learn chords here. Poke anything."], [0, "Anything? Cool."]], "hero": [[0, "Is that a real song?"], [1, "Close enough. Three chords, looped."]], "strum": [[0, "Whoa, it made a noise."], [1, "Yeah. Tap the strings one by one too."]], "learned1": [[1, "First chord down."], [0, "Heh. I did a thing."]], "learned4": [[0, "Wait, that is all four?"], [1, "Yep. Now go play a real song in Songs."]], "songs": [[0, "Songs! Do I know these?"], [1, "Probably. Pick one and hit Play along."]], "playalong": [[1, "Slow is fine. Go with the click."], [0, "What if I mess up?"], [1, "Everybody does. Keep going."]], "edit": [[0, "Can I break the chord?"], [1, "Sure. Drag the dots. Reset puts it back."]], "toomany": [[0, "Dude, I only have four fingers."], [1, "That is the warning. Move a dot or mute a string."]], "saved": [[1, "That one is yours now."], [0, "My own chord. Sweet."]], "seq": [[0, "What are the empty boxes?"], [1, "Bars. Fill them with chords, hit play, it loops."]], "pin": [[1, "Pinned up top, so you can keep an eye on it."]], "find": [[0, "Why am I putting fingers on a fake neck?"], [1, "Place the dots and it tells you the chord name."]], "idle": [[0, "Hey, you still there?"], [1, "Try pressing Play it at the top."]]};
const GD = { q: [], cur: null, i: 0, timer: 0, last: Date.now() };
function say(key) {
  const c = cfg(); if (c.talkOff || !TALKS[key]) return;
  c.talkSeen = c.talkSeen || {}; if (c.talkSeen[key]) return;
  c.talkSeen[key] = 1; save(); GD.q.push(TALKS[key]); if (!GD.cur) guideNext();
}
function guideNext(tries) {
  clearTimeout(GD.timer);
  const el = $('#guide'); if (!el) return;
  if (GD.cur && GD.i < GD.cur.length) { /* continue */ } else { GD.cur = GD.q.shift() || null; GD.i = 0; }
  if (!GD.cur) { el.hidden = true; return; }
  if (!$('#modal').hidden && (tries || 0) < 12) { GD.q.unshift(GD.cur); GD.cur = null; GD.timer = setTimeout(() => guideNext((tries || 0) + 1), 2000); el.hidden = true; return; }
  const [who, text] = GD.cur[GD.i++];
  el.hidden = false; el.className = 'guide ' + (who ? 'g2' : 'g1');
  el.innerHTML = `<svg class="gface" viewBox="0 0 40 40" aria-hidden="true">${who
    ? '<path d="M8 38V16C8 6 14 2 20 2s12 4 12 14v22z" fill="#6b3d22" stroke="#1b0f08" stroke-width="2.5"/><rect x="12" y="12" width="16" height="18" rx="6" fill="#f2cf9e" stroke="#1b0f08" stroke-width="2"/><path d="M14 19h4M22 19h4" stroke="#1b0f08" stroke-width="2.5" stroke-linecap="round"/><path d="M16 26q4 2 8 0" fill="none" stroke="#1b0f08" stroke-width="2" stroke-linecap="round"/>'
    : '<path d="M7 18C5 8 12 3 20 3s15 5 13 15z" fill="#e6c365" stroke="#1b0f08" stroke-width="2.5"/><circle cx="20" cy="23" r="14" fill="#f2cf9e" stroke="#1b0f08" stroke-width="2.5"/><circle cx="15" cy="21" r="3.2" fill="#fff" stroke="#1b0f08" stroke-width="1.6"/><circle cx="25" cy="21" r="3.2" fill="#fff" stroke="#1b0f08" stroke-width="1.6"/><circle cx="15.6" cy="21.4" r="1.2" fill="#1b0f08"/><circle cx="25.4" cy="21.4" r="1.2" fill="#1b0f08"/><path d="M13 29q7 6 14 0" fill="#fff" stroke="#1b0f08" stroke-width="2"/>'}</svg>
    <p>${esc(text)}</p><button class="guideX" aria-label="Shush" title="Shush">✕</button>`;
  GD.timer = setTimeout(guideNext, 2800 + text.length * 55);
}
function guideInit() {
  const el = $('#guide');
  el.addEventListener('click', e => {
    if (e.target.closest('.guideX')) { cfg().talkOff = true; save(); GD.q = []; GD.cur = null; clearTimeout(GD.timer); el.hidden = true; toast('Guides are off. Turn them back on in Settings.'); return; }
    guideNext();
  });
  ['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, () => { GD.last = Date.now(); }, true));
  setInterval(() => { if (Date.now() - GD.last > 60000 && $('#v-chords').classList.contains('on') && $('#modal').hidden) say('idle'); }, 15000);
  setTimeout(() => say('welcome'), 3000);
}
function renderSongList() {
  renderFeatured(); renderPlayable(); renderProgs();
  $('#songList').innerHTML = D.songs.length ? D.songs.map(songCard).join('') : '<div class="empty">No songs yet. Import one: paste text from any chord site, or open a ChordPro / text file.</div>';
  $('#sampleList').innerHTML = SAMPLES.map(songCard).join('');
}
function showView(v) {
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $$('#nav .seg-b').forEach(b => b.classList.toggle('on', b.dataset.view === (v === 'song' ? 'songs' : v)));
  window.scrollTo(0, 0);
  if (v === 'songs') say('songs'); if (v === 'find') say('find');
}
function openSong(id) {
  const s = findSong(id); if (!s) return;
  S.song = s; S.tr = s.tr || 0;
  showView('song'); renderSong();
}
function renderSong() {
  const s = S.song, p = parsed(s), flats = cfg().flats;
  $('#songTitle').textContent = s.title || p.meta.title || 'Untitled';
  $('#songArtist').textContent = [s.artist || p.meta.artist, p.meta.key ? 'Key ' + songTc(s, p.meta.key, S.tr, flats) : ''].filter(Boolean).join(' · ');
  $('#trVal').textContent = (S.tr > 0 ? '+' : '') + S.tr;
  $('#btnEditSong').textContent = s.sample ? 'Save a copy' : 'Edit';
  $('#sheet').style.setProperty('--fs', cfg().fs + 'px');
  const tc = c => songTc(s, c, S.tr, flats);
  let html = '';
  p.lines.forEach(l => {
    if (l.t === 'sec') html += `<div class="sec">${esc(l.text)}</div>`;
    else if (l.t === 'blank') html += '<div class="gap"></div>';
    else if (!l.segs.some(x => x.c)) html += `<div class="plain">${esc(l.segs.map(x => x.x).join('')) || '&nbsp;'}</div>`;
    else html += '<div class="ln">' + l.segs.map(x => `<span class="sg"><span class="ch" ${x.c ? `data-c="${esc(tc(x.c))}" role="button" tabindex="0"` : ''}>${x.c ? esc(sharpen(tc(x.c))) : '&nbsp;'}</span><span class="tx">${esc(x.x) || (x.c ? '&nbsp;' : '')}</span></span>`).join('') + '</div>';
  });
  $('#sheet').innerHTML = html;
  renderStrip();
}
function renderStrip() {
  const strip = $('#chartStrip');
  const on = $('#swCharts').checked; strip.hidden = !on; if (!on) return;
  const chords = songChordsUI(S.song, S.tr, cfg().flats);
  strip.innerHTML = chords.map(c => { const v = preferred(c); return `<button class="vcard" data-open="${esc(c)}"><div class="name">${esc(sharpen(c))}</div>${v ? diagram(v) : '<div class="cap">no shape</div>'}</button>`; }).join('');
}
function playChord(name) { const v = preferred(name); if (!v) { toast('No playable shape found for ' + name); return; } strum(v); }
function learnChords(title, chords) {
  const list = [...new Set(chords.map(canon))];
  openModal(`<h2>${esc(title)}</h2><p class="sub">One shape for each chord. Tap a diagram to hear it.</p>
    <div class="grid">${list.map(c => { const nm = cl(c), v = preferred(nm); return `<div class="vcard"><button class="stopen" data-hear="${esc(nm)}"><div class="name">${esc(sharpen(nm))}</div>${v ? diagram(v) : '<div class="cap">no shape</div>'}</button><div class="actions"><button class="btn sm ghost" data-ldet="${esc(nm)}">Open in Chords</button><button class="btn sm ghost" data-lpick="${esc(nm)}">Other shapes</button></div></div>`; }).join('')}</div>
    <div class="row"><span class="grow"></span><button class="btn primary" data-close>Done</button></div>`, b => {
    b.onclick = e => {
      const h = e.target.closest('[data-hear]'); if (h) { playChord(h.dataset.hear); return; }
      const d = e.target.closest('[data-ldet]'); if (d) { closeModal(); showView('chords'); setChordText(d.dataset.ldet); window.scrollTo({ top: 0 }); return; }
      const k = e.target.closest('[data-lpick]'); if (k) openPicker(k.dataset.lpick);
    };
  });
}
function openPicker(name) {
  const out = voicingsFor(name);
  if (!out.list.length) { toast('No playable shape found for ' + name); return; }
  const draw = () => {
    const cur = preferred(name);
    return `<h2>${esc(sharpen(name))} <small class="sub">· ${esc(out.chord.notes.map(sharpen).join(' – '))}</small></h2>
      <p class="sub">Pick the voicing you want to see for this chord in your songs.</p>
      <div class="grid">${out.list.map((v, i) => `<button class="vcard ${v === cur ? 'sel' : ''}" data-pick="${i}">${diagram(v)}<div class="cap">${posCaption(v)}</div>${tagsFor(v, name)}</button>`).join('')}</div>
      <div class="actions" style="justify-content:center;margin-top:16px"><button class="btn" data-close>Done</button></div>`;
  };
  openDrawer(draw(), body => {
    body.onclick = e => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      const v = out.list[+b.dataset.pick];
      D.pref[prefKey(name)] = F.vKey(v); save(); strum(v);
      body.innerHTML = draw();
      if (S.song) renderStrip(); renderMine(); if (S.text === name && S.chord) { S.sel = S.list.indexOf(v); renderChord(); }
    };
  });
}

/* ---- import / edit modal ---- */
function importModal(song) {
  const editing = !!song && !song.sample;
  const base = song || { title: '', artist: '', text: '' };
  openModal(`
    <h2>${editing ? 'Edit song' : song ? 'Save a copy' : 'Import a song'}</h2>
    <p class="note">Paste chords-over-lyrics text (the usual format on chord sites) or ChordPro with [Am] inline chords. You can also open a .txt, .cho, .crd or .pro file.</p>
    <label class="field"><span>Title</span><input id="imTitle" value="${esc(base.title || '')}" placeholder="Song title"></label>
    <label class="field"><span>Artist</span><input id="imArtist" value="${esc(base.artist || '')}" placeholder="Optional"></label>
    <p class="note"><a id="imFind" href="#" target="_blank" rel="noopener noreferrer">Find chords for this song online ↗</a> (opens a web search in a new tab; copy the chords back here)</p>
    <label class="field"><span>Song text</span><textarea id="imText" placeholder="   Am        G&#10;Paste lyrics with chords here…" spellcheck="false">${esc(base.text || '')}</textarea></label>
    <div class="detected" id="imDet"></div>
    <div class="row">
      <label class="btn ghost" style="display:inline-flex;align-items:center">Open file…<input type="file" id="imFile" accept=".txt,.cho,.crd,.chopro,.chordpro,.pro,text/plain" hidden></label>
      <button class="btn ghost" id="imPaste">Paste</button>
      <span class="grow"></span>
      ${editing ? '<button class="btn danger" id="imDel">Delete</button>' : ''}
      <button class="btn" data-close>Cancel</button>
      <button class="btn primary" id="imSave">Save</button>
    </div>`, body => {
    const ta = $('#imText', body), det = $('#imDet', body);
    const findLink = () => { const q = ($('#imTitle', body).value + ' ' + $('#imArtist', body).value).trim(); const a = $('#imFind', body); a.href = 'https://duckduckgo.com/?q=' + encodeURIComponent((q || 'guitar') + ' chords'); };
    $('#imTitle', body).addEventListener('input', findLink); $('#imArtist', body).addEventListener('input', findLink); findLink();
    const detect = () => {
      const nt = detectNt(ta.value), p = F.withLocale(nt, () => F.parseSong(ta.value)), ch = F.withLocale(nt, () => F.songChords(p)).map(c => F.convert(c, nt, LANG));
      if (!ta.value.trim()) { det.textContent = ''; return; }
      if (p.meta.title && !$('#imTitle', body).value) $('#imTitle', body).value = p.meta.title;
      if (p.meta.artist && !$('#imArtist', body).value) $('#imArtist', body).value = p.meta.artist;
      det.style.color = ch.length ? '#4b6a1e' : '#a42b14';
      det.textContent = ch.length ? `Found ${ch.length} chord${ch.length > 1 ? 's' : ''}: ${ch.slice(0, 12).map(sharpen).join(' ')}${ch.length > 12 ? ' …' : ''}` : 'No chords recognised yet. Chords must be on their own line above lyrics, or in [brackets].';
    };
    ta.addEventListener('input', detect); detect();
    $('#imFile', body).addEventListener('change', async e => {
      const f = e.target.files[0]; if (!f) return;
      ta.value = await f.text();
      if (!$('#imTitle', body).value) $('#imTitle', body).value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
      detect();
    });
    $('#imPaste', body).addEventListener('click', async () => {
      try { ta.value = await navigator.clipboard.readText(); detect(); } catch (e) { toast('Paste with long-press / Ctrl+V into the box'); ta.focus(); }
    });
    if ($('#imDel', body)) $('#imDel', body).addEventListener('click', () => {
      if (!confirm(TT('Delete “' + base.title + '”?'))) return;
      D.songs = D.songs.filter(x => x.id !== base.id); save(); closeModal(); renderSongList(); showView('songs');
    });
    $('#imSave', body).addEventListener('click', () => {
      const text = ta.value;
      if (!text.trim()) { toast('Add some song text first'); return; }
      const nt = detectNt(text), title = $('#imTitle', body).value.trim() || F.parseSong(text).meta.title || 'Untitled';
      const artist = $('#imArtist', body).value.trim();
      let s;
      if (editing) { s = D.songs.find(x => x.id === base.id); Object.assign(s, { title, artist, text, nt }); parsedCache.clear(); }
      else { s = { id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), title, artist, text, nt, tr: 0 }; D.songs.unshift(s); }
      save(); closeModal(); renderSongList(); S.song = s; S.tr = s.tr || 0; showView('song'); renderSong(); toast('Saved');
    });
  });
}

/* ================= settings & profile ================= */
function setLang(l) { if (l === LANG) return; try { localStorage.setItem('fw.lang', l); } catch (e) {} location.reload(); }
/* ================= guitar finish (wood colour) ================= */
const FINISHES = [
  { id: 'cherry', n: 'Cherry burst', hue: 0, sat: .92, bri: 1 }, { id: 'honey', n: 'Honey burst', hue: 22, sat: 1.05, bri: 1.1 },
  { id: 'tobacco', n: 'Tobacco', hue: -8, sat: .8, bri: .72 }, { id: 'moss', n: 'Moss', hue: 105, sat: .9, bri: .9 },
  { id: 'lake', n: 'Lake blue', hue: -160, sat: 1, bri: .95 }, { id: 'plum', n: 'Plum', hue: -75, sat: .95, bri: .9 },
  { id: 'ebony', n: 'Ebony', hue: 0, sat: .1, bri: .5 }];
/* ================= style lab: tweak the look live; export look.json to make it everyone's default ================= */
const LOOK_FIELDS = [
  ['--ow', 'Outline thickness', 'range', 0, 8, .5, 'px', 4], ['--so', 'Shadow offset', 'range', 0, 12, 1, 'px', 5], ['--rad', 'Roundness', 'range', 0, 30, 1, 'px', 14],
  ['wob', 'Wobble (hand-drawn)', 'range', 0, 10, .5, '', 4], ['--tilt', 'Tape crookedness', 'range', 0, 5, .1, 'deg', 1.6],
  ['--ink', 'Outline colour', 'color', 0, 0, 0, '', '#140a06'], ['--c-paper', 'Card colour', 'color', 0, 0, 0, '', '#f1e5be'], ['--c-panel', 'Panel colour', 'color', 0, 0, 0, '', '#201a17'],
  ['--c-bind', 'Binding colour', 'color', 0, 0, 0, '', '#ecdfc0'], ['--c-btn', 'Button colour', 'color', 0, 0, 0, '', '#e6c365'], ['--c-btn2', 'Main button colour', 'color', 0, 0, 0, '', '#c9503a'],
  ['--c-hot', 'Highlight colour', 'color', 0, 0, 0, '', '#dc8a3e']];
const LOOK_FONTS = [['Marker Felt', '"Marker Felt","Bradley Hand","Chalkboard SE","Segoe Print","Comic Sans MS",cursive'], ['Bradley Hand', '"Bradley Hand","Segoe Print","Comic Sans MS",cursive'],
  ['Chalkboard', '"Chalkboard SE","Comic Sans MS",cursive'], ['Comic Sans', '"Comic Sans MS","Comic Neue",cursive'], ['Plain rounded', 'ui-rounded,"Trebuchet MS",system-ui,sans-serif']];
let LOOK_SHIPPED = {};
const LOOK = { local: LS.get('fw.look', {}) };
const lookNow = () => Object.assign({}, LOOK_SHIPPED, LOOK.local);
function applyLook() {
  const L = lookNow(), r = document.documentElement.style;
  LOOK_FIELDS.forEach(([k, , t, , , , u, d]) => {
    const v = L[k] != null ? L[k] : d;
    if (k === 'wob') { const m = document.getElementById('wobbleMap'); if (m) m.setAttribute('scale', v); r.setProperty('--wobf', +v > 0 ? 'url(#wobble)' : 'none'); }
    else r.setProperty(k, v + u);
  });
  const f = LOOK_FONTS.find(x => x[0] === L.font) || LOOK_FONTS[0]; r.setProperty('--hand', f[1]);
}
function labOpen() {
  closeModal(); let el = $('#lab'); if (el) el.remove();
  el = document.createElement('div'); el.id = 'lab'; el.className = 'lab'; const L = lookNow();
  el.innerHTML = `<div class="labhead"><h3>Style lab</h3><button class="btn sm" id="labMin" aria-label="Minimise">▾</button><button class="btn sm primary" id="labX2" aria-label="Close">✕</button></div><div class="labbody">` + LOOK_FIELDS.map(([k, n, t, mi, ma, st, u, d]) => `<label><span>${n}</span>${t === 'range' ? `<output>${L[k] != null ? L[k] : d}</output>` : ''}<input data-k="${k}" type="${t}" ${t === 'range' ? `min="${mi}" max="${ma}" step="${st}"` : ''} value="${L[k] != null ? L[k] : d}"></label>`).join('')
    + `<label><span>Handwriting</span><select data-k="font">${LOOK_FONTS.map(f => `<option ${L.font === f[0] ? 'selected' : ''}>${f[0]}</option>`).join('')}</select></label>
    <div class="row"><button class="btn sm" id="labCopy">Copy look.json</button><button class="btn sm ghost" id="labDl">Download</button><button class="btn sm danger" id="labReset">Reset</button><button class="btn sm primary" id="labX">Done</button></div>
    <p style="font-size:.75rem;margin:8px 0 0">Your changes stay on this device. To make them the default for everyone, download look.json and upload it next to index.html.</p></div>`;
  document.body.appendChild(el);
  const kill = () => { el.remove(); document.removeEventListener('keydown', esc_); };
  const esc_ = e => { if (e.key === 'Escape') kill(); };
  document.addEventListener('keydown', esc_);
  $('#labX2', el).onclick = kill;
  $('#labMin', el).onclick = () => { const m = el.classList.toggle('min'); $('#labMin', el).textContent = m ? '▴' : '▾'; };
  const set = (k, v, o) => { LOOK.local[k] = v; LS.set('fw.look', LOOK.local); applyLook(); if (o) o.textContent = v; };
  el.addEventListener('input', e => { const i = e.target.closest('[data-k]'); if (i) set(i.dataset.k, i.type === 'range' ? +i.value : i.value, i.previousElementSibling && i.previousElementSibling.tagName === 'OUTPUT' ? i.previousElementSibling : null); });
  el.addEventListener('change', e => { const i = e.target.closest('select[data-k]'); if (i) set(i.dataset.k, i.value); });
  const json = () => JSON.stringify({ v: 1, look: lookNow() }, null, 1);
  $('#labCopy', el).onclick = () => { try { navigator.clipboard.writeText(json()); toast('look.json copied'); } catch (e) { toast('Could not copy; use Download'); } };
  $('#labDl', el).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json()], { type: 'application/json' })); a.download = 'look.json'; document.body.appendChild(a); a.click(); a.remove(); };
  $('#labReset', el).onclick = () => { LOOK.local = {}; LS.set('fw.look', {}); applyLook(); labOpen(); };
  $('#labX', el).onclick = kill;
}

/* ================= stickers on the guitar body (anarchy A and friends; make your own) ================= */
const STK_DEFAULT = [
  { id: 'a1', kind: 'anarchy', t: '', col: '#c9503a', tc: '#ecdfc0', x: 91, y: 16, s: 120, r: 12 },
  { id: 'a2', kind: 'burst', t: 'LOUD!', col: '#e6c365', tc: '#140a06', x: 6, y: 72, s: 130, r: -10 },
  { id: 'a3', kind: 'circle', t: 'ROCK', col: '#ecdfc0', tc: '#140a06', x: 93, y: 80, s: 96, r: 8 },
  { id: 'a4', kind: 'label', t: 'NO REGRETS', col: '#ecdfc0', tc: '#c9503a', x: 8, y: 20, s: 140, r: -14 }];
const STK_KINDS = [['circle', 'Circle'], ['burst', 'Burst'], ['star', 'Star'], ['label', 'Label'], ['anarchy', 'Anarchy']];
const stkList = () => cfg().stickers || STK_DEFAULT;
function stkSvg(st) {
  const ink = '#140a06', P = (d, fill, sw = 4) => `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  let shape = '', body = '';
  const t = (st.t || '').slice(0, 14), n = t.length;
  const fs = n <= 2 ? 40 : n <= 4 ? 26 : n <= 7 ? 19 : 14;
  const txt = (y, size) => `<text x="50" y="${y}" text-anchor="middle" font-family="var(--hand)" font-weight="900" font-size="${size || fs}" fill="${st.tc}" ${n > 8 ? 'textLength="70" lengthAdjust="spacingAndGlyphs"' : ''}>${esc(t)}</text>`;
  const poly = (k, ro, ri) => 'M' + [...Array(k * 2)].map((_, i) => { const r = i % 2 ? ri : ro, ang = Math.PI * i / k - Math.PI / 2; return (50 + r * Math.cos(ang)).toFixed(1) + ',' + (50 + r * Math.sin(ang)).toFixed(1); }).join(' L') + 'Z';
  if (st.kind === 'circle') { shape = 'M50 10 a40 40 0 1 0 0.01 0Z'; body = txt(50 + fs * .35); }
  else if (st.kind === 'burst') { shape = poly(12, 47, 34); body = txt(50 + fs * .35); }
  else if (st.kind === 'star') { shape = poly(5, 48, 20); body = txt(56 + fs * .2); }
  else if (st.kind === 'label') { shape = 'M6 30 L94 26 L92 72 L8 70Z'; body = txt(56, n > 8 ? 17 : 22); }
  else { shape = 'M50 8 a42 42 0 1 0 0.01 0Z'; }
  let inner = '';
  if (st.kind === 'anarchy') inner = `<circle cx="50" cy="50" r="33" fill="none" stroke="${st.col}" stroke-width="9"/><path d="M26 86 L50 18 L74 86 M30 62 L70 62" fill="none" stroke="${st.col}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  else inner = P(shape, st.col) + body;
  const halo = st.kind === 'anarchy' ? `<circle cx="50" cy="50" r="46" fill="${st.tc}" stroke="${ink}" stroke-width="4"/>` : `<path d="${shape}" fill="#f4efe0" stroke="#f4efe0" stroke-width="12" stroke-linejoin="round"/>`;
  return `<svg viewBox="0 0 100 100" width="${st.s}" height="${st.s}" aria-hidden="true">${halo}${inner}</svg>`;
}
let stkEdit = null;
function stkRender() {
  let L = $('#stickers'); if (!L) { L = document.createElement('div'); L.id = 'stickers'; document.body.prepend(L); }
  L.innerHTML = stkList().map(s => `<div class="stk ${stkEdit === s.id ? 'sel' : ''}" data-id="${s.id}" style="left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%) rotate(${s.r}deg)">${stkSvg(s)}</div>`).join('');
  requestAnimationFrame(() => L.classList.add('ready'));
}
function stkOpen() {
  closeModal(); const old = $('#stkPanel'); if (old) old.remove();
  if (!cfg().stickers) cfg().stickers = STK_DEFAULT.map(s => Object.assign({}, s));
  const L = $('#stickers'); L.classList.add('edit');
  const el = document.createElement('div'); el.id = 'stkPanel'; el.className = 'lab';
  const cur = () => cfg().stickers.find(s => s.id === stkEdit);
  const draw = () => {
    const s = cur(), list = cfg().stickers;
    el.innerHTML = `<h3>Stickers</h3><p style="font-size:.8rem;margin:0 0 6px">Stickers sit behind everything. Drag a visible one to move it, or use Across and Down. Tap a number to pick a sticker.</p>
      <div class="stkl">${list.map((x, i) => `<button class="${x.id === stkEdit ? 'on' : ''}" data-sel="${x.id}">${i + 1}</button>`).join('')}<button data-add="1">＋</button></div>
      ${s ? `<label><span>Text</span><input data-f="t" value="${esc(s.t)}" maxlength="14" ${s.kind === 'anarchy' ? 'disabled' : ''} style="grid-column:1/-1;padding:6px;border:3px solid var(--ink);border-radius:8px"></label>
      <label><span>Shape</span><select data-f="kind">${STK_KINDS.map(([k, n]) => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label><span>Fill colour</span><input type="color" data-f="col" value="${s.col}"></label>
      <label><span>Text colour</span><input type="color" data-f="tc" value="${s.tc}"></label>
      <label><span>Size</span><output>${s.s}</output><input type="range" data-f="s" min="40" max="240" step="2" value="${s.s}"></label>
      <label><span>Turn</span><output>${s.r}</output><input type="range" data-f="r" min="-45" max="45" step="1" value="${s.r}"></label>
      <label><span>Across</span><output>${s.x}</output><input type="range" data-f="x" min="0" max="100" step="1" value="${s.x}"></label>
      <label><span>Down</span><output>${s.y}</output><input type="range" data-f="y" min="0" max="100" step="1" value="${s.y}"></label>
      <div class="row"><button class="btn sm danger" data-del="1">Delete</button></div>` : ''}
      <div class="row"><button class="btn sm ghost" data-reset="1">Reset to default</button><button class="btn sm primary" data-done="1">Done</button></div>`;
  };
  if (!stkEdit) stkEdit = cfg().stickers[0] && cfg().stickers[0].id;
  draw(); document.body.appendChild(el); stkRender();
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sel) stkEdit = b.dataset.sel;
    else if (b.dataset.add) { const s = { id: 's' + Date.now().toString(36), kind: 'circle', t: 'YES', col: '#e6c365', tc: '#140a06', x: 50, y: 50, s: 100, r: 0 }; cfg().stickers.push(s); stkEdit = s.id; save(); }
    else if (b.dataset.del) { cfg().stickers = cfg().stickers.filter(s => s.id !== stkEdit); stkEdit = cfg().stickers[0] && cfg().stickers[0].id; save(); }
    else if (b.dataset.reset) { delete cfg().stickers; save(); stkEdit = null; el.remove(); L.classList.remove('edit'); stkRender(); return; }
    else if (b.dataset.done) { el.remove(); L.classList.remove('edit'); stkEdit = null; stkRender(); return; }
    else return;
    draw(); stkRender();
  });
  const upd = e => { const f = e.target.dataset.f, s = cur(); if (!f || !s) return; s[f] = e.target.type === 'range' ? +e.target.value : e.target.value; const o = e.target.previousElementSibling; if (o && o.tagName === 'OUTPUT') o.textContent = s[f]; stkRender(); };
  el.addEventListener('input', upd);
  el.addEventListener('change', e => { upd(e); if (e.target.dataset.f === 'kind') draw(); save(); });
  // drag stickers on the page
  let drag = null;
  L.onpointerdown = e => { const d = e.target.closest('.stk'); if (!d) return; stkEdit = d.dataset.id; drag = { id: d.dataset.id }; d.setPointerCapture(e.pointerId); draw(); stkRender(); e.preventDefault(); };
  L.onpointermove = e => { if (!drag) return; const s = cfg().stickers.find(x => x.id === drag.id); s.x = +(e.clientX / innerWidth * 100).toFixed(1); s.y = +(e.clientY / innerHeight * 100).toFixed(1); const d = L.querySelector(`[data-id="${s.id}"]`); if (d) { d.style.left = s.x + '%'; d.style.top = s.y + '%'; } };
  L.onpointerup = () => { if (drag) { drag = null; save(); stkRender(); } };
}

/* ================= add to home screen ================= */
const IS_STANDALONE = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const IS_IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let A2HS = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); A2HS = e; a2hsBar(); });
window.addEventListener('appinstalled', () => { A2HS = null; LS.set('fw.a2hsDone', 1); a2hsBar(); });
function a2hsSteps() {
  if (IS_IOS) return 'Tap the <b>Share</b> button (the square with an arrow) at the bottom of Safari, then choose <b>Add to Home Screen</b>.';
  return 'Open your browser menu (⋮) and choose <b>Install app</b> or <b>Add to Home screen</b>.';
}
function a2hsBar() {
  const el = $('#a2hs'); if (!el) return;
  const show = !IS_STANDALONE && !LS.get('fw.a2hsDone', false) && !LS.get('fw.a2hsHide', false) && (A2HS || IS_IOS || (navigator.maxTouchPoints > 0 && innerWidth < 900));
  el.hidden = !show; if (!show) return;
  el.innerHTML = '<b>Add Fretwork to your home screen</b> and open it like an app. <button class="btn sm" id="a2Go">' + (A2HS ? 'Install' : 'How?') + '</button> <button class="btn sm ghost" id="a2No" aria-label="Hide">✕</button>';
}
function a2hsAsk() {
  if (A2HS) { A2HS.prompt(); A2HS.userChoice.finally(() => { A2HS = null; a2hsBar(); }); return; }
  openModal('<h2>Add to home screen</h2><p>' + a2hsSteps() + '</p><p class="note">Fretwork then gets its own icon and opens full screen, without the browser bars.</p><div class="row"><span class="grow"></span><button class="btn primary" data-close>Got it</button></div>');
}
function applyFinish() {
  const f = Object.assign({ hue: 0, sat: .92, bri: 1 }, cfg().finish || {}), r = document.documentElement.style;
  r.setProperty('--hue', f.hue + 'deg'); r.setProperty('--wsat', f.sat); r.setProperty('--wbri', f.bri);
}
function settingsModal() {
  const c = cfg(), c0 = F.TUNINGS[c.tuning];
  openModal(`<h2>Settings</h2>
    <label class="field"><span>Tuning</span><select id="stTuning">${Object.keys(F.TUNINGS).map(t => `<option value="${esc(t)}" ${t === c.tuning ? 'selected' : ''}>${esc(tunLabel(t))}</option>`).join('')}</select></label>
    <details class="field" id="stNew"><summary>Create your own tuning</summary>
      <input id="ctName" placeholder="Name, e.g. My open D" maxlength="40" style="margin:8px 0">
      <div class="tunrow">${c0.map((m, i) => `<label><small>${i === 0 ? 'low' : i === 5 ? 'high' : '&nbsp;'}</small><select data-s="${i}">${[...Array(12).keys()].map(pc => `<option value="${pc}" ${pc === m % 12 ? 'selected' : ''}>${sharpen(F.pcLoc(pc, false))}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="row"><button class="btn sm" id="ctSave">Save tuning</button>${c.custom && c.custom[c.tuning] ? '<button class="btn sm danger" id="ctDel">Delete current tuning</button>' : ''}</div>
    </details>
    <div class="field"><span>Language</span><nav class="seg" id="stLang">${[['en', 'English'], ['sk', 'Slovenčina']].map(([l, n]) => `<button class="seg-b ${LANG === l ? 'on' : ''}" data-l="${l}">${n}</button>`).join('')}</nav></div>
    <div class="field"><span>Dot labels</span><nav class="seg" id="stLabel">${[['finger', 'Fingers'], ['note', 'Notes'], ['interval', 'Intervals']].map(([m, l]) => `<button class="seg-b ${c.label === m ? 'on' : ''}" data-m="${m}">${l}</button>`).join('')}</nav></div>
    <div class="field"><span>Guitar finish</span>
      <div class="finish" id="stFin">${FINISHES.map(p => `<button class="fin" data-f="${p.id}" aria-label="${p.n}" title="${p.n}" style="--h:${p.hue}deg;--s:${p.sat};--b:${p.bri}"></button>`).join('')}</div>
      <label class="field" style="margin:0"><span>Colour shift</span><input type="range" id="stHue" min="-180" max="180" value="${(c.finish && c.finish.hue) || 0}"></label></div>
    ${IS_STANDALONE ? '' : '<div class="field"><button class="btn sm" id="stA2">Add to home screen</button></div>'}
    <div class="field row"><button class="btn sm" id="stLab">Tweak the look (style lab)</button><button class="btn sm" id="stStk">Stickers</button></div>
    <div class="toggles">
      <label class="switch"><span>Left-handed diagrams</span><input type="checkbox" id="stLh" ${c.lh ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>Use flats (B♭) instead of sharps</span><input type="checkbox" id="stFl" ${c.flats ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>Beginner mode: easy shapes and plain chord names</span><input type="checkbox" id="stBeg" ${isBeg() ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>Show the two guides</span><input type="checkbox" id="stTalk" ${cfg().talkOff ? '' : 'checked'}><i></i></label>
      <label class="switch"><span>Sound</span><input type="checkbox" id="stSnd" ${c.sound ? 'checked' : ''}><i></i></label>
      ${(!cloudOn || TP.can !== false) ? `<label class="switch"><span>Teacher mode: pick the primary voicing</span><input type="checkbox" id="stTeach" ${TP.on ? 'checked' : ''}><i></i></label>` : ''}
    </div>
    ${TP.on ? `<div class="field"><span>Primary voicings (${Object.keys(primaryMerged()).length}) · hidden shapes (${Object.values(hiddenMerged()).reduce((n, a) => n + a.length, 0)})</span>
      <p class="note">Open a chord and press “Make primary” under its diagram, or “Hide this shape” to remove a shape for everyone else (you still see it, dimmed). “Reset this chord” clears both. Primary shapes show as Recommended and open first for everyone. Export the file and save it as <b>primary.json</b> next to index.html to publish your picks.</p>
      <div class="row" style="margin-top:6px"><button class="btn sm primary" id="tcBoard">Defaults board</button>
      ${TP.can ? '<button class="btn sm primary" id="tcPublish">Publish to everyone</button>' : ''}
      <button class="btn sm" id="tcExport">Export primary.json</button>
      <label class="btn sm ghost" style="display:inline-flex;align-items:center">Import<input type="file" id="tcImport" accept="application/json,.json" hidden></label>
      <button class="btn sm danger" id="tcClear">Clear my changes</button></div></div>` : ''}
    <div class="row"><span class="grow"></span><button class="btn primary" data-close>Done</button></div>`, b => {
    const apply = () => { VC.clear(); save(); buildKeys(); updateChord(); renderFind(); renderTheory(); renderMine(); renderSongList(); if (S.song && $('#v-song').classList.contains('on')) renderSong(); };
    $('#ctSave', b).onclick = () => {
      const name = $('#ctName', b).value.trim();
      if (!name) { toast('Give the tuning a name'); return; }
      if (F.TUNINGS[name]) { toast('That name is already used'); return; }
      const midis = $$('#stNew select', b).map((sel, i) => { let d = ((+sel.value - STD[i]) % 12 + 12) % 12; if (d > 6) d -= 12; return STD[i] + d; });
      c.custom[name] = midis; F.TUNINGS[name] = midis; c.tuning = name; apply(); settingsModal(); toast('Tuning saved. Diagrams updated.');
    };
    if ($('#ctDel', b)) $('#ctDel', b).onclick = () => {
      delete c.custom[c.tuning]; delete F.TUNINGS[c.tuning]; c.tuning = 'Standard (E A D G B E)'; apply(); settingsModal();
    };
    $('#stTuning', b).onchange = e => { c.tuning = e.target.value; apply(); settingsModal(); };
    $$('#stLabel .seg-b', b).forEach(x => x.onclick = () => { c.label = x.dataset.m; $$('#stLabel .seg-b', b).forEach(y => y.classList.toggle('on', y === x)); apply(); });
    $('#stLh', b).onchange = e => { c.lh = e.target.checked; apply(); };
    $('#stFl', b).onchange = e => { c.flats = e.target.checked; apply(); };
    $('#stLang', b).onclick = e => { const x = e.target.closest('[data-l]'); if (x) setLang(x.dataset.l); };
    const fin = () => (c.finish = Object.assign({ hue: 0, sat: .92, bri: 1 }, c.finish || {}));
    $('#stFin', b).onclick = e => { const x = e.target.closest('[data-f]'); if (!x) return; const p = FINISHES.find(q => q.id === x.dataset.f); Object.assign(fin(), { hue: p.hue, sat: p.sat, bri: p.bri }); $('#stHue', b).value = p.hue; save(); applyFinish(); };
    if ($('#stA2', b)) $('#stA2', b).onclick = a2hsAsk;
    $('#stLab', b).onclick = labOpen;
    $('#stStk', b).onclick = stkOpen;
    $('#stHue', b).oninput = e => { fin().hue = +e.target.value; applyFinish(); };
    $('#stHue', b).onchange = () => save();
    $('#stTalk', b).onchange = e => { c.talkOff = !e.target.checked; save(); if (!c.talkOff) { c.talkSeen = {}; save(); } };
    $('#stBeg', b).onchange = e => { c.beginner = e.target.checked; S.showAll = false; save(); buildKeys(); applyBeg(); updateChord(); renderFind(); };
    $('#stSnd', b).onchange = e => { c.sound = e.target.checked; save(); };
    if ($('#tcBoard', b)) $('#tcBoard', b).onclick = () => boardOpen(0);
    if ($('#tcPublish', b)) $('#tcPublish', b).onclick = async () => { await publishDefaults(); settingsModal(); };
    if ($('#stTeach', b)) $('#stTeach', b).onchange = e => { TP.on = e.target.checked; LS.set('fw.teacher.on', TP.on); teacherBody(); refreshAll(); settingsModal(); };
    if ($('#tcExport', b)) {
      $('#tcExport', b).onclick = exportPrimary;
      $('#tcImport', b).onchange = importPrimary;
      $('#tcClear', b).onclick = () => { if (!confirm('Remove all primary-voicing changes made on this device?')) return; TP.local = {}; TH.local = {}; LS.set('fw.teacher.primary', TP.local); LS.set('fw.teacher.hidden', TH.local); refreshAll(); settingsModal(); };
    }
  });
}
function updateWho() { $('#whoName').textContent = userName(); $('#avatar').textContent = userName().slice(0, 1).toUpperCase(); }
function switchUser(uid, keepView) { A.uid = uid; LS.set('fw.session', uid); D = load(uid); registerCustoms(); VC.clear(); parsedCache.clear(); updateWho(); buildKeys(); updateChord(); renderFind(); renderMine(); renderSongList(); if (!keepView) showView('chords'); }

function recoveryModal() {
  openModal(`<h2>Choose a new password</h2>
    <label class="field"><span>New password (8+ characters)</span><input id="rcPw" type="password" autocomplete="new-password"></label>
    <div class="detected" id="rcErr" style="color:#a42b14"></div>
    <div class="row"><span class="grow"></span><button class="btn primary" id="rcGo">Save password</button></div>`, b => {
    $('#rcGo', b).onclick = async () => {
      const pw = $('#rcPw', b).value, err = $('#rcErr', b);
      if (pw.length < 8) { err.textContent = 'Use at least 8 characters.'; return; }
      const { data, error } = await sb.auth.updateUser({ password: pw });
      if (error) { err.textContent = error.message; return; }
      closeModal(); history.replaceState(null, '', location.pathname);
      if (!isCloud()) await cloudEnter(data.user, false);
      toast('Password updated');
    };
  });
}
function cloudModal() {
  if (isCloud()) {
    openModal(`<h2>${esc(LS.get('fw.email.' + A.uid, 'Account'))}</h2>
      <p class="note">Signed in. Your songs and chosen voicings sync to your account and appear on every device you sign in on.</p>
      <div class="row"><button class="btn" id="pfOut">Sign out</button><button class="btn ghost" id="pfExp">Export backup</button>
      <label class="btn ghost" style="display:inline-flex;align-items:center">Import backup<input type="file" id="pfImp" accept="application/json,.json" hidden></label>
      <span class="grow"></span><button class="btn" data-close>Close</button></div>`, b => {
      $('#pfOut', b).onclick = async () => { closeModal(); await sb.auth.signOut(); switchUser('guest'); sharedLoad(); toast('Signed out'); };
      $('#pfExp', b).onclick = exportBackup;
      $('#pfImp', b).onchange = importBackup;
    });
    return;
  }
  openModal(`<h2>Your account</h2>
    <p class="note">You are using Fretwork as a guest. Everything works and stays in this browser. An account keeps your songs and voicings safe and in sync across your phone, tablet and computer.</p>
    <nav class="seg" id="pfTabs"><button class="seg-b on" data-t="in">Sign in</button><button class="seg-b" data-t="new">Create account</button></nav>
    <label class="field"><span>Email</span><input id="pfMail" type="email" autocomplete="email" inputmode="email"></label>
    <label class="field"><span>Password (8+ characters)</span><input id="pfPin" type="password" autocomplete="current-password"></label>
    <label class="switch" id="pfCopyRow" hidden style="display:flex;justify-content:space-between"><span style="color:var(--ink);text-transform:none;letter-spacing:0;font-size:.95rem">Copy my guest songs into the account</span><input type="checkbox" id="pfCopy" checked><i></i></label>
    <div class="detected" id="pfErr" style="color:#a42b14"></div>
    <div class="row"><button class="btn ghost" id="pfForgot">Forgot password?</button><span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="pfGo">Sign in</button></div>`, b => {
    let mode = 'in';
    $('#pfForgot', b).onclick = async () => {
      const email = $('#pfMail', b).value.trim(), err = $('#pfErr', b);
      if (!sb) { err.style.color = '#a42b14'; err.textContent = 'Cloud is not reachable right now.'; return; }
      if (!/^\S+@\S+\.\S+$/.test(email)) { err.style.color = '#a42b14'; err.textContent = 'Type your email above first, then tap Forgot password.'; return; }
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      err.style.color = error ? '#a42b14' : '#4b6a1e';
      err.textContent = error ? error.message : 'If that address has an account, a reset link is on its way. Open it on this device.';
    };
    $$('#pfTabs .seg-b', b).forEach(x => x.onclick = () => {
      mode = x.dataset.t; $$('#pfTabs .seg-b', b).forEach(y => y.classList.toggle('on', y === x));
      $('#pfGo', b).textContent = mode === 'in' ? 'Sign in' : 'Create account';
      $('#pfCopyRow', b).hidden = mode === 'in'; $('#pfErr', b).textContent = '';
    });
    $('#pfGo', b).onclick = async () => {
      const email = $('#pfMail', b).value.trim(), pw = $('#pfPin', b).value, err = $('#pfErr', b);
      if (!sb) { err.textContent = 'Cloud is not reachable right now.'; return; }
      if (!/^\S+@\S+\.\S+$/.test(email) || pw.length < 8) { err.textContent = 'Enter a valid email and a password of 8+ characters.'; return; }
      err.style.color = '#a42b14'; err.textContent = 'One moment…';
      try {
        if (mode === 'in') {
          const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
          if (error) throw error;
          closeModal(); await cloudEnter(data.user, true); toast('Signed in');
        } else {
          const { data, error } = await sb.auth.signUp({ email, password: pw });
          if (error) throw error;
          if (!data.session) { err.style.color = '#4b6a1e'; err.textContent = 'Almost done. Check your email, confirm the address, then sign in.'; return; }
          const copy = $('#pfCopy', b).checked; closeModal(); await cloudEnter(data.user, copy); toast('Account created');
        }
      } catch (e) { err.style.color = '#a42b14'; err.textContent = e.message || 'Something went wrong.'; }
    };
  });
}
function profileModal() {
  if (cloudOn) { cloudModal(); return; }
  if (A.uid !== 'guest') {
    openModal(`<h2>${esc(userName())}</h2>
      <p class="note">You are signed in. Your songs and chosen voicings are kept in your own library on this device.</p>
      <div class="row"><button class="btn" id="pfOut">Sign out</button><button class="btn ghost" id="pfExp">Export backup</button>
      <label class="btn ghost" style="display:inline-flex;align-items:center">Import backup<input type="file" id="pfImp" accept="application/json,.json" hidden></label></div>
      <div class="row"><button class="btn danger" id="pfDel">Delete this profile</button><span class="grow"></span><button class="btn" data-close>Close</button></div>`, b => {
      $('#pfOut', b).onclick = () => { closeModal(); switchUser('guest'); toast('Signed out'); };
      $('#pfExp', b).onclick = exportBackup;
      $('#pfImp', b).onchange = importBackup;
      $('#pfDel', b).onclick = () => {
        if (!confirm('Delete profile “' + userName() + '” and all its songs on this device?')) return;
        const id = A.uid; A.users = A.users.filter(u => u.id !== id); LS.set('fw.users', A.users); LS.del('fw.data.' + id); closeModal(); switchUser('guest');
      };
    });
    return;
  }
  openModal(`<h2>Your profile</h2>
    <p class="note">You are using Fretwork as a guest. Everything works, and your songs stay in this browser. A profile keeps your own separate library, so several people can share one device.</p>
    <nav class="seg" id="pfTabs"><button class="seg-b on" data-t="in">Sign in</button><button class="seg-b" data-t="new">Create profile</button></nav>
    <label class="field"><span>Name</span><input id="pfName" autocomplete="username" autocapitalize="words"></label>
    <label class="field"><span>PIN (4+ characters)</span><input id="pfPin" type="password" autocomplete="current-password"></label>
    <label class="switch" id="pfCopyRow" hidden style="color:var(--ink);justify-content:space-between;display:flex"><span style="color:var(--ink);text-transform:none;letter-spacing:0;font-size:.95rem">Copy my guest songs and settings</span><input type="checkbox" id="pfCopy" checked><i></i></label>
    <div class="detected" id="pfErr" style="color:#a42b14"></div>
    <p class="note">Profiles are stored on this device only. Use Export backup to move your library to another device.</p>
    <div class="row"><span class="grow"></span><button class="btn" data-close>Cancel</button><button class="btn primary" id="pfGo">Sign in</button></div>`, b => {
    let mode = 'in';
    $$('#pfTabs .seg-b', b).forEach(x => x.onclick = () => {
      mode = x.dataset.t; $$('#pfTabs .seg-b', b).forEach(y => y.classList.toggle('on', y === x));
      $('#pfGo', b).textContent = mode === 'in' ? 'Sign in' : 'Create profile'; $('#pfCopyRow', b).hidden = mode === 'in'; $('#pfErr', b).textContent = '';
    });
    $('#pfGo', b).onclick = async () => {
      const name = $('#pfName', b).value.trim(), pin = $('#pfPin', b).value, err = $('#pfErr', b);
      if (!name || pin.length < 4) { err.textContent = 'Enter a name and a PIN of at least 4 characters.'; return; }
      const u = A.users.find(x => x.name.toLowerCase() === name.toLowerCase());
      if (mode === 'in') {
        if (!u || (await hashPin(pin, u.salt)) !== u.hash) { err.textContent = 'Name or PIN not recognised.'; return; }
        closeModal(); switchUser(u.id); toast('Welcome back, ' + u.name);
      } else {
        if (u) { err.textContent = 'That name is taken on this device.'; return; }
        const salt = Math.random().toString(36).slice(2), nu = { id: 'p' + Date.now().toString(36), name, salt, hash: await hashPin(pin, salt) };
        A.users.push(nu); LS.set('fw.users', A.users);
        if ($('#pfCopy', b).checked) LS.set('fw.data.' + nu.id, D);
        closeModal(); switchUser(nu.id); toast('Profile created');
      }
    };
  });
}
function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'fretwork', v: 1, data: D }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'fretwork-' + userName().toLowerCase().replace(/\W+/g, '-') + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== 'fretwork' || !j.data) throw 0;
    const ids = new Set(D.songs.map(s => s.id));
    (j.data.songs || []).forEach(s => { if (!ids.has(s.id)) D.songs.push(s); });
    Object.assign(D.pref, j.data.pref || {});
    D.progs = D.progs || []; (j.data.progs || []).forEach(p => { if (!D.progs.some(q => q.id === p.id)) D.progs.push(p); });
    save(); renderSongList(); renderMine(); closeModal(); toast('Backup imported');
  } catch (err) { toast('That file is not a Fretwork backup'); }
}

/* ================= wiring ================= */
/* ================= Find chord: place fingers, get chord names ================= */
const FIND_SUF = ['', 'm', '7', 'maj7', 'm7', '6', 'm6', '9', 'm9', 'maj9', 'add9', 'madd9', 'sus2', 'sus4', '7sus4', 'dim', 'dim7', 'm7b5', 'aug', 'aug7',
  '5', '11', 'm11', '13', 'm13', '69', '7b9', '7#9', '7#11', '7b5', '7#5', 'maj7#11', 'mMaj7', 'maj13', '9sus4', '13sus4', 'add11', '7b13'];
const FD = { frets: [0, 0, 0, 0, 0, 0], base: 1, drag: null, res: [] };

function voicingFromFrets(frets, chord) {
  const tun = F.TUNINGS[cfg().tuning], fg = F.fingering(frets);
  const tones = new Map(chord.tones.map(t => [t.pc, t]));
  const fr = frets.filter(f => f > 0), maxF = fr.length ? Math.max(...fr) : 0, minF = fr.length ? Math.min(...fr) : 0;
  return { frets, fingers: fg.fingers, barre: fg.barre, fingerCount: fg.count, base: maxF <= 5 ? 1 : minF, pos: minF, score: 0, rank: 99,
    omits: chord.tones.filter(t => !frets.some((f, s) => f >= 0 && (tun[s] + f) % 12 === t.pc)).map(t => t.label),
    notes: frets.map((f, s) => f < 0 ? null : (tones.get((tun[s] + f) % 12) || null)) };
}

function identify(frets) {
  const tun = F.TUNINGS[cfg().tuning], names = cfg().flats ? F.FLAT : F.SHARP;
  const notes = [];
  frets.forEach((f, s) => { if (f >= 0) notes.push({ s, midi: tun[s] + f, pc: (tun[s] + f) % 12 }); });
  if (notes.length < 2) return { notes, res: [] };
  const pcs = new Set(notes.map(n => n.pc));
  const bass = notes.reduce((a, b) => b.midi < a.midi ? b : a).pc;
  const res = [];
  for (let r = 0; r < 12; r++) {
    FIND_SUF.forEach((suf, i) => {
      const ch = F.withLocale('en', () => F.parseChord(names[r] + suf)); if (!ch.ok) return;
      const tp = new Set(ch.tones.map(t => t.pc));
      for (const p of pcs) if (!tp.has(p)) return;
      const missing = ch.tones.filter(t => t.req && !pcs.has(t.pc));
      const score = -missing.length * 3 - i * 0.12 + (bass === r ? 2.5 : 0) + (pcs.has(r) ? 1.5 : -1) - (tp.size - pcs.size) * 0.3;
      res.push({ name: cl(names[r] + suf + (bass !== r ? '/' + names[bass] : '')), chord: ch, missing: missing.map(t => t.label), score, inv: bass !== r });
    });
  }
  res.sort((a, b) => b.score - a.score);
  const seen = new Set(), out = [];
  for (const x of res) { if (!seen.has(x.name)) { seen.add(x.name); out.push(x); } }
  const full = out.filter(x => !x.missing.length), part = out.filter(x => x.missing.length);
  return { notes, res: full.slice(0, 6).concat(part.slice(0, full.length ? 3 : 6)) };
}

function renderFind() {
  const board = $('#findBoard'); if (!board) return;
  const tun = F.TUNINGS[cfg().tuning], names = cfg().flats ? F.FLAT : F.SHARP, lh = cfg().lh;
  const id = identify(FD.frets);
  let hiddenNames = 0;
  if (isBeg() && !FD.all) { const plain = id.res.filter(r => !r.inv && ['', 'm', '7'].includes(r.chord.suffix)); hiddenNames = id.res.length - plain.length; id.res = plain; }
  FD.res = id.res;
  const top = id.res[0], fr = FD.frets, fg = F.fingering(fr);
  const v = { frets: fr.slice(), fingers: fg.fingers, barre: fg.barre, base: FD.base,
    notes: fr.map((f, s) => { if (f < 0) return null; const pc = (tun[s] + f) % 12, t = top && top.chord.tones.find(x => x.pc === pc); return { name: (SK && pc === 10) ? 'Bb' : names[pc], label: t ? t.label : '' }; }) };
  let svg = diagram(v, { names: true });
  const L = 38, T = 42, SP = 22, FS = 34, X = i => L + (lh ? 5 - i : i) * SP;
  let hits = '<g class="hits">';
  for (let s = 0; s < 6; s++) {
    hits += `<rect class="hit" data-s="${s}" data-top="1" x="${X(s) - SP / 2}" y="${T - 38}" width="${SP}" height="34"/>`;
    for (let r = 1; r <= 5; r++) hits += `<rect class="hit" data-s="${s}" data-f="${FD.base + r - 1}" x="${X(s) - SP / 2}" y="${T + (r - 1) * FS}" width="${SP}" height="${FS}"/>`;
  }
  board.innerHTML = svg.replace(/<\/svg>$/, hits + '</g></svg>');
  $('#fdBase').textContent = FD.base;
  const sounded = fr.map((f, s) => f < 0 ? 'x' : (SK && (tun[s] + f) % 12 === 10) ? 'Bb' : names[(tun[s] + f) % 12]);
  $('#fdNotes').innerHTML = 'Strings, low to high: ' + sounded.map(n => `<b>${n === 'x' ? '✕' : sharpen(nn(n))}</b>`).join(' · ');
  const nPlayed = fr.filter(f => f >= 0).length;
  $('#findRes').innerHTML = !id.res.length
    ? `<div class="empty">${hiddenNames ? 'Not a common chord yet. Try moving a finger, or <button class="btn sm ghost" id="fdAll">show the technical names</button>' : nPlayed < 2 ? 'Place a few fingers on the neck and the chord names will show up here.' : 'No standard chord matches these notes. Try moving a finger, or muting a string with the circle above it.'}</div>`
    : id.res.map((r, i) => `<div class="res"><div class="rn"><b>${esc(sharpen(r.name))}</b><span>${esc(r.chord.notes.map(n => sharpen(nn(n))).join(' – '))}</span>
        <em class="${r.missing.length ? 'part' : 'full'}">${r.missing.length ? 'no ' + esc(r.missing.map(sharpen).join(', ')) : 'complete'}${r.inv ? ' · inversion' : ''}</em></div>
        <div class="ra"><button class="btn sm" data-fopen="${i}">Open</button><button class="btn sm ghost" data-fsave="${i}" title="Use this shape for ${esc(r.name)} in my songs">★</button></div></div>`).join('');
}
function findApply(s, f, mode) {
  const cur = FD.frets[s];
  if (mode === 'place') { if (cur === f) return false; FD.frets[s] = f; return true; }
  if (cur === f) { FD.frets[s] = 0; return true; }
  return false;
}
function findOpen(i, save_) {
  const r = FD.res[i]; if (!r) return;
  const v = voicingFromFrets(FD.frets.slice(), r.chord);
  if (save_) { D.pref[prefKey(r.name)] = F.vKey(v); save(); renderMine(); toast('Saved as your ' + r.name); return; }
  showView('chords'); setChordText(r.name);
  if (!S.list.length) return;
  const key = F.vKey(v); let idx = S.list.findIndex(x => F.vKey(x) === key);
  if (idx < 0) { S.list.push(v); S.list.sort((a, b) => a.pos - b.pos); idx = S.list.indexOf(v); }
  S.sel = idx; renderChord();
}
function initFind() {
  const board = $('#findBoard');
  board.addEventListener('pointerdown', e => {
    const t = e.target.closest('[data-s]'); if (!t) return;
    try { t.releasePointerCapture(e.pointerId); } catch (x) {}
    const s = +t.dataset.s;
    if (t.dataset.top) { FD.frets[s] = FD.frets[s] === -1 ? 0 : -1; renderFind(); return; }
    const f = +t.dataset.f, mode = FD.frets[s] === f ? 'erase' : 'place';
    FD.drag = { f, mode }; findApply(s, f, mode); renderFind();
  });
  document.addEventListener('pointermove', e => {
    if (!FD.drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest && el.closest('[data-f]');
    if (t && +t.dataset.f === FD.drag.f && findApply(+t.dataset.s, FD.drag.f, FD.drag.mode)) renderFind();
  });
  const end = () => { FD.drag = null; };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  const clip = () => { FD.frets = FD.frets.map(f => f > 0 && (f < FD.base || f > FD.base + 4) ? 0 : f); };
  $('#fdUp').onclick = () => { FD.base = Math.min(12, FD.base + 1); clip(); renderFind(); };
  $('#fdDown').onclick = () => { FD.base = Math.max(1, FD.base - 1); clip(); renderFind(); };
  $('#fdReset').onclick = () => { FD.frets = [0, 0, 0, 0, 0, 0]; FD.base = 1; renderFind(); };
  $('#fdPlay').onclick = () => strum({ frets: FD.frets });
  $('#findRes').addEventListener('click', e => {
    if (e.target.closest('#fdAll')) { FD.all = true; renderFind(); return; }
    const o = e.target.closest('[data-fopen]'), sv = e.target.closest('[data-fsave]');
    if (o) findOpen(+o.dataset.fopen); else if (sv) findOpen(+sv.dataset.fsave, true);
  });
  renderFind();
}

/* ================= Theory page ================= */
const THEORY_TYPES = [
  ['', 'Major', 'Bright, stable, happy'], ['m', 'Minor', 'Darker, sad or tender'], ['5', 'Power chord', 'Open, neutral, strong'],
  ['7', 'Dominant 7', 'Bluesy, wants to resolve'], ['maj7', 'Major 7', 'Dreamy, warm'], ['m7', 'Minor 7', 'Mellow, relaxed'],
  ['6', 'Major 6', 'Sweet, settled'], ['m6', 'Minor 6', 'Wistful, jazzy'], ['sus2', 'Suspended 2', 'Open, floating'],
  ['sus4', 'Suspended 4', 'Hanging, wants to resolve'], ['7sus4', 'Dominant 7 sus 4', 'Gospel, floating tension'], ['add9', 'Add 9', 'Shimmering, modern'],
  ['9', 'Dominant 9', 'Funky, rich'], ['m9', 'Minor 9', 'Smooth, soulful'], ['maj9', 'Major 9', 'Lush, dreamy'], ['11', 'Dominant 11', 'Open, ambiguous'],
  ['13', 'Dominant 13', 'Big, jazzy'], ['69', 'Six-nine', 'Relaxed, a good ending chord'], ['dim', 'Diminished', 'Tense, unstable'],
  ['dim7', 'Diminished 7', 'Very tense, symmetrical'], ['m7b5', 'Half-diminished', 'Soft tension, the ii of a minor key'], ['aug', 'Augmented', 'Floating, unsettled'],
  ['7b9', 'Dominant 7 ♭9', 'Dark, spicy tension'], ['7#9', 'Dominant 7 ♯9', 'Gritty, the “Hendrix chord”'], ['7#11', 'Dominant 7 ♯11', 'Bright, jazzy'],
  ['mMaj7', 'Minor-major 7', 'Cinematic, mysterious'], ['alt', 'Altered dominant', 'Maximum tension']
];
const DEG_SK = { 1: 'základný tón', 2: 'sekunda', 3: 'tercia', 4: 'kvarta', 5: 'kvinta', 6: 'sexta', 7: 'septima', 9: 'nona', 11: 'undecima', 13: 'tercdecima' };
const DEG_WORD = { 1: 'root', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 9: 'ninth', 11: 'eleventh', 13: 'thirteenth' };

function renderTheory() {
  const raw = $('#thIn').value.trim(), out = $('#theoryOut');
  if (!raw) { out.innerHTML = '<div class="empty">Type a chord above, or pick one from the list below.</div>'; return; }
  const ch = F.parseChord(raw);
  if (!ch.ok) { out.innerHTML = `<div class="empty">${esc(ch.error)}</div>`; return; }
  const T = F.theory(ch, cfg().flats), v = preferred(raw), sh = x => esc(sharpen(x)), shn = x => esc(sharpen(nn(x)));
  const pills = T.tones.map(t => `<span class="pill ${t.label === '1' ? 'root' : ''}">${shn(t.name)}<i>${sh(t.label)}</i></span>`).join('');
  const rows = T.tones.map(t => `<tr><td><b>${sh(t.label)}</b></td><td>${esc(t.interval)}</td><td class="num">${t.semis}</td><td><b>${shn(t.name)}</b></td><td>${esc(t.role)}${t.optional ? ' <em class="opt">often left out on guitar</em>' : ''}</td></tr>`).join('');
  // scale card
  const used = new Set(T.tones.filter(t => t.deg !== 99).map(t => ((t.deg - 1) % 7) + 1));
  const scalePills = T.scale.map((n, i) => `<span class="pill ${used.has(i + 1) ? 'used' : 'dim'}">${shn(n)}<i>${i + 1}</i></span>`).join('');
  const altTxt = T.altered.length
    ? SK ? '<ul>' + T.altered.map(t => `<li>${DEG_SK[t.deg] || t.deg + '.'} je <b>${t.diff < 0 ? 'znížená' : 'zvýšená'}</b> o ${Math.abs(t.diff) === 1 ? 'poltón' : Math.abs(t.diff) + ' poltóny'} (${sh(t.label)}), vznikne tak <b>${shn(t.name)}</b>.</li>`).join('') + '</ul>'
    : '<ul>' + T.altered.map(t => `<li>The ${DEG_WORD[t.deg] || t.deg} is <b>${t.diff < 0 ? 'lowered' : 'raised'}</b> by ${Math.abs(t.diff) === 1 ? 'one half step' : Math.abs(t.diff) + ' half steps'} (${sh(t.label)}), giving <b>${shn(t.name)}</b>.</li>`).join('') + '</ul>'
    : '<p>No alterations: every note comes straight from the major scale.</p>';
  const stack = T.stack ? `<div class="th card paper"><h3>Stacked thirds</h3>
      <p>Most chords are built by stacking notes a third apart, every other note of the scale.</p>
      <div class="stackrow">${T.stack.map((s, i) => `${i === 0 ? `<span class="pill">${shn(s.from)}</span>` : ''}<span class="arr">+${s.gap} <small>${esc(s.kind)}</small></span><span class="pill">${shn(s.to)}</span>`).join('')}</div></div>` : '';
  const keysHtml = T.keys.length
    ? `<p>This chord uses only notes of these major keys, so it fits naturally there:</p><div class="keylist">${T.keys.map(k => `<span class="pill"><b>${sh(k.roman)}</b><i>${SK ? 'v' : 'in'} ${shn(k.key)}</i></span>`).join('')}</div><p class="note">Roman numerals count the root's position in the key. Capitals are major, small letters are minor.</p>`
    : '<p>This chord is not made only from notes of a major scale, so it is a “colour” chord: it borrows notes from outside the key to add tension.</p>';
  const same = T.same.length ? `<div class="th card paper"><h3>Same notes, other names</h3><p>The same pitches can be named differently depending on which note you hear as the root:</p><div class="keylist">${T.same.map(n => `<button class="pill linkpill" data-th="${esc(cl(n))}">${sh(cl(n))}</button>`).join('')}</div></div>` : '';
  const vl = voicingsFor(raw).list, omit = {};
  vl.forEach(x => x.omits.forEach(o => { omit[o] = (omit[o] || 0) + 1; }));
  const omitTxt = SK ? (Object.keys(omit).length ? `Medzi tvarmi, ktoré Fretwork našiel, niektoré vynechávajú: ${Object.keys(omit).map(o => `<b>${sh(o)}</b>`).join(', ')}.` : 'Všetky nájdené tvary obsahujú každý tón akordu.') : Object.keys(omit).length ? `Among the voicings Fretwork found, some leave out: ${Object.keys(omit).map(o => `<b>${sh(o)}</b>`).join(', ')}.` : 'All the voicings found include every note of the chord.';
  let slashCard = '';
  if (ch.bass) {
    const bt = ch.tones.find(t => t.pc === ch.bass.pc), lb = bt ? bt.label : 'bass';
    const invSK = { '3': 'prvý obrat', 'b3': 'prvý obrat', '5': 'druhý obrat', 'b5': 'druhý obrat', '#5': 'druhý obrat', '7': 'tretí obrat', 'b7': 'tretí obrat', 'bb7': 'tretí obrat', '6': 'tretí obrat', '1': 'základný tvar' };
    const inv = { '3': 'first inversion', 'b3': 'first inversion', '5': 'second inversion', 'b5': 'second inversion', '#5': 'second inversion', '7': 'third inversion', 'b7': 'third inversion', 'bb7': 'third inversion', '6': 'third inversion', '1': 'root position' }[lb];
    const base = raw.slice(0, raw.lastIndexOf('/'));
    const why = lb === 'bass'
      ? `<b>${shn(ch.bass.name)}</b> is not a note of ${sh(base)}, so it is an <b>added bass note</b>. It colours the chord by putting a note from outside it underneath.`
      : `<b>${shn(ch.bass.name)}</b> is already in ${sh(base)}: it is the <b>${DEG_WORD[bt.deg] || sh(lb)}</b> (${sh(lb)}). Putting it in the bass gives the <b>${inv}</b>, the same notes with a different one on the bottom.`;
    if (SK) slashCard = `<div class="th card paper"><h3>Lomka: ${sh(raw)}</h3>
      <p>Čítaj to ako „${sh(base)} <b>nad</b> ${shn(ch.bass.name)}“. Časť pred lomkou je akord. Tón za ňou je <b>bas</b>: najnižší tón, ktorý zahráš.</p>
      <p>${lb === 'bass' ? `<b>${shn(ch.bass.name)}</b> nie je tónom akordu ${sh(base)}, ide teda o <b>pridaný basový tón</b>. Zafarbí akord tónom spoza neho.` : `<b>${shn(ch.bass.name)}</b> v akorde ${sh(base)} už je: je to <b>${DEG_SK[bt.deg] || sh(lb)}</b> (${sh(lb)}). Keď ho dáš do basu, vznikne <b>${invSK[lb]}</b>: rovnaké tóny, len iný je naspodku.`}</p>
      <ul><li>Akord hraj ako zvyčajne, ale najnižšia struna, ktorú udrieš, má byť <b>${shn(ch.bass.name)}</b>. Struny pod ňou zostanú stlmené.</li>
      <li>V diagramoch má basový tón <span class="bassring"></span> modrý krúžok.</li>
      <li>Akordy s lomkou sa často používajú na plynulé basové linky, napríklad C, potom C/H, potom Ami.</li></ul></div>`;
    else slashCard = `<div class="th card paper"><h3>The slash: ${sh(raw)}</h3>
      <p>Read it as “${sh(base)} <b>over</b> ${shn(ch.bass.name)}”. The part before the slash is the chord. The note after it is the <b>bass</b>: the lowest note you sound.</p>
      <p>${why}</p>
      <ul><li>Play the chord as usual, but make sure <b>${shn(ch.bass.name)}</b> is the lowest string you strum. Strings below it stay muted.</li>
      <li>On the diagrams the bass note has a <span class="bassring"></span> blue ring.</li>
      <li>Slash chords are often used for smooth walking bass lines, for example C, then C/B, then Am.</li></ul></div>`;
  }
  const enName = SK ? canon(raw) : raw;
  const skCard = !SK ? '' : `<div class="th card paper skcard"><h3>Slovenské názvy tónov a akordov</h3>
    <p>Na Slovensku sa tóny a akordy píšu inak než v angličtine. Fretwork rozumie obom spôsobom, v tejto verzii ich zobrazuje po slovensky.</p>
    <p class="skbox"><b>${sh(raw)}</b> sa v angličtine píše <b>${esc(sharpen(enName))}</b>.</p>
    <div class="tablewrap"><table class="tt"><thead><tr><th>Anglicky</th><th>Slovensky</th><th>Poznámka</th></tr></thead><tbody>
      <tr class="hl"><td>B</td><td><b>H</b></td><td>Anglické <b>B</b> je slovenské <b>H</b>. Je o poltón vyššie než B.</td></tr>
      <tr class="hl"><td>B♭ (A♯)</td><td><b>B</b></td><td>Slovenské <b>B</b> je anglické <b>B♭</b>. „B dur“ je teda B♭ major.</td></tr>
      <tr><td>C♯ / D♭</td><td>Cis / Des</td><td>Koncovka <b>-is</b> zvyšuje o poltón (krížik), <b>-es</b> znižuje o poltón (béčko).</td></tr>
      <tr><td>D♯ / E♭</td><td>Dis / Es</td><td>Pri E a A sa píše skrátene: <b>Es</b>, <b>As</b> (nie Ees, Aes).</td></tr>
      <tr><td>F♯ / G♭</td><td>Fis / Ges</td><td></td></tr>
      <tr><td>G♯ / A♭</td><td>Gis / As</td><td></td></tr>
      <tr><td>A♯</td><td>Ais (alebo B)</td><td>V spevníkoch sa takmer vždy píše B.</td></tr>
    </tbody></table></div>
    <h3 style="margin-top:16px">Dur a mol</h3>
    <div class="tablewrap"><table class="tt"><thead><tr><th>Anglicky</th><th>Slovensky</th><th>Význam</th></tr></thead><tbody>
      <tr><td>C, C major</td><td>C, C dur</td><td>durový akord (veselý, jasný)</td></tr>
      <tr><td>Cm, C minor</td><td>Cmi, C mol</td><td>molový akord (smutnejší, tmavší)</td></tr>
      <tr><td>Am7</td><td>Ami7</td><td>molový septakord</td></tr>
      <tr><td>B7</td><td>H7</td><td>dominantný septakord na tóne H (anglické B)</td></tr>
      <tr><td>Bm</td><td>Hmi</td><td>mol na tóne H, v gitarových spevníkoch častý akord</td></tr>
    </tbody></table></div>
    <p class="note">Ako to zadať: <b>Ami</b>, <b>Am</b>, <b>A mol</b> a <b>Amol</b> sú ten istý akord. Rovnako <b>Fis</b> a <b>F#</b>, alebo <b>C</b> a <b>C dur</b>. Durový septakord môžeš zapísať ako <b>Cmaj7</b> alebo <b>CΔ7</b>.</p>
    <p class="note">Pri importe piesne Fretwork sám rozpozná, či je zapísaná slovenským (H, B, Cis) alebo anglickým spôsobom, a akordy ti zobrazí po slovensky.</p></div>`;
  const root = ch.root ? F.pcLoc(ch.root.pc, false) : raw[0].toUpperCase();
  const SYM = [['Major 7th', 'maj7', 'CΔ7, C△, CM7'], ['Minor', 'm', 'C−, Cmin, Cmi'], ['Minor 7th', 'm7', 'C−7, Cmin7'], ['Minor major 7th', 'mMaj7', 'C−Δ7, Cm(maj7)'],
    ['Diminished', 'dim', 'C°, Cdim'], ['Diminished 7th', 'dim7', 'C°7'], ['Half-diminished', 'm7b5', 'Cø, Cø7'], ['Augmented', 'aug', 'C+, Caug'], ['Suspended 4th', 'sus4', 'Csus']];
  const symCard = `<div class="th card paper"><h3>Chord symbols you may meet</h3><p>Chord charts use different marks for the same chord. Fretwork understands all of these, so you can type them or paste them into a song.</p><div class="tablewrap"><table class="tt"><thead><tr><th>Chord</th><th>Usual name</th><th>Other marks</th></tr></thead><tbody>${SYM.map(([n, s, alt]) => `<tr><td><button class="pill linkpill" data-th="${esc(root + skS(s))}">${sh(root + skS(s))}</button></td><td>${n}</td><td>${esc((SK ? ({ m: 'C−, Cmi, C mol', m7: 'C−7, Cmi7', mMaj7: 'C−Δ7, Cmi(maj7)' }[s] || alt) : alt).replace(/C/g, root))}</td></tr>`).join('')}</tbody></table></div><p class="note">The triangle (Δ or △) always means a major 7th. A small circle (°) means diminished, a circle with a slash (ø) means half-diminished, and a dash (−) means minor.</p></div>`;
  out.innerHTML = `
    <div class="th card paper thhead">
      <div class="thdia">${v ? diagram(v, { names: true }) : ''}</div>
      <div><h2>${sh(raw)}${usualHtml(ch)}</h2><div class="sub2">${esc(T.family.title)}</div><p>${esc(T.family.blurb)}</p><div class="notepills">${pills}</div>
        <div class="actions"><button class="btn" data-thopen="${esc(raw)}">See all voicings</button></div></div>
    </div>
    <div class="th card paper"><h3>The building blocks</h3>
      <div class="tablewrap"><table class="tt"><thead><tr><th>Step</th><th>Interval</th><th>Semitones</th><th>Note</th><th>What it does</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">A semitone is one fret on the guitar (a half step). An octave is 12. Extensions wrap around: a 9th is 14 semitones above the root, the same note as the 2nd, one octave higher.</p></div>
    <div class="th card paper"><h3>Built from the major scale</h3>
      ${SK ? `<p>Začni <b>durovou stupnicou ${shn(ch.root.name)}</b>. Zlaté tóny používa tento akord (malé číslo je stupeň stupnice):</p>` : `<p>Start with the <b>${shn(ch.root.name)} major scale</b>. The gold notes are the ones this chord uses (the small number is the scale step):</p>`}
      <div class="notepills">${scalePills}</div>${altTxt}</div>
    ${stack}
    <div class="th card paper"><h3>Where it lives</h3>${keysHtml}${T.family.tips ? `<p><b>In practice:</b> ${esc(T.family.tips)}</p>` : ''}</div>
    ${slashCard}
    ${same}
    ${skCard}
    ${symCard}
    <div class="th card paper"><h3>On the guitar</h3>
      ${SK ? `<p>Šesť strún zahrá najviac šesť tónov, takže väčšie akordy musia niečo vynechať. Najdôležitejší je <b>základný tón</b> a tóny, ktoré určujú zvuk (tercia, septima, alterácie). <b>Kvinta</b> odpadá ako prvá, lebo o povahe akordu hovorí najmenej.</p>` : `<p>Six strings can sound at most six notes, so bigger chords have to leave something out. The <b>root</b> and the notes that define the sound (third, seventh, any alterations) matter most. The <b>fifth</b> is usually the first to go, because it says the least about the chord's character.</p>`}
      <p>${omitTxt}</p></div>`;
}
function thOpen(name) {
  if (name) $('#thIn').value = name; else if (!$('#thIn').value) $('#thIn').value = (S.chord && S.chord.ok && S.text) || 'Cmaj7';
  renderTheory(); showView('theory');
}
function initTheory() {
  $('#theoryTable').innerHTML = '<div class="tablewrap"><table class="tt types"><thead><tr><th>Name</th><th>Symbol</th><th>Steps</th><th>Notes in C</th><th>Sound</th></tr></thead><tbody>'
    + THEORY_TYPES.map(([suf, name, feel]) => { const c = F.parseChord('C' + suf);
      return `<tr data-suf="${esc(suf)}"><td><b>${esc(name)}</b></td><td>C${esc(sharpen(skS(suf)))}</td><td>${esc(c.formula.map(sharpen).join(' '))}</td><td>${esc(c.notes.map(n => sharpen(nn(n))).join(' '))}</td><td>${esc(feel)}</td></tr>`; }).join('')
    + '</tbody></table></div>';
  let t; $('#thIn').addEventListener('input', () => { clearTimeout(t); t = setTimeout(renderTheory, 160); });
  $('#theoryTable').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-suf]'); if (!tr) return;
    const sp = splitText($('#thIn').value.trim());
    $('#thIn').value = (sp.root ? nn(sp.root.name) : 'C') + skS(tr.dataset.suf); renderTheory();
    $('#theoryOut').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#theoryOut').addEventListener('click', e => {
    const l = e.target.closest('[data-th]'); if (l) { $('#thIn').value = l.dataset.th; renderTheory(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const o = e.target.closest('[data-thopen]'); if (o) { showView('chords'); setChordText(o.dataset.thopen); }
  });
  renderTheory();
}

/* ================= Teacher mode: choose the primary (recommended) voicing ================= */
let PRIMARY = {};                                                   // shipped with the app (primary.json)
const TP = { local: LS.get('fw.teacher.primary', {}), on: LS.get('fw.teacher.on', false), can: null };   // this device's edits; can = may publish (null = unknown)
const SH = { have: false, at: null };
function applyShared(j) { if (j && j.primary) { PRIMARY = j.primary; HIDDEN = j.hidden || {}; SH.have = true; } }
/* the published defaults live in Supabase (everyone may read, only listed teachers may write) */
async function sharedLoad() {
  if (!sb) return;
  try {
    const { data } = await sb.from('app_defaults').select('data,updated_at').eq('id', 'primary').maybeSingle();
    if (data && data.data) { applyShared(data.data); SH.at = data.updated_at; LS.set('fw.shared', data.data); VC.clear(); refreshAll(); }
  } catch (e) { /* offline or not set up yet: keep what we have */ }
  try {
    if (isCloud()) { const { data, error } = await sb.from('teachers').select('user_id').eq('user_id', A.uid.slice(2)).maybeSingle(); TP.can = error ? null : !!data; }
    else TP.can = false;
  } catch (e) { TP.can = null; }
  if (TP.can === false && TP.on) { TP.on = false; LS.set('fw.teacher.on', false); teacherBody(); refreshAll(); }
}
async function publishDefaults() {
  if (!sb || !isCloud() || TP.can !== true) { toast('Only a teacher account can publish. Sign in first.'); return false; }
  const data = { v: 1, primary: primaryMerged(), hidden: hiddenMerged() };
  const { error } = await sb.from('app_defaults').upsert({ id: 'primary', data, updated_at: new Date().toISOString(), updated_by: A.uid.slice(2) });
  if (error) { toast('Could not publish: ' + (error.message || 'no permission')); return false; }
  PRIMARY = data.primary; HIDDEN = data.hidden; SH.have = true; SH.at = new Date().toISOString();
  TP.local = {}; TH.local = {}; LS.set('fw.teacher.primary', {}); LS.set('fw.teacher.hidden', {}); LS.set('fw.shared', data);
  VC.clear(); refreshAll(); toast('Published. Everyone gets it next time they open the app.'); return true;
}
let HIDDEN = {};                                                    // shipped hidden shapes (primary.json "hidden")
const TH = { local: LS.get('fw.teacher.hidden', {}) };
function hiddenFor(name) { const k = prefKey(name); return k in TH.local ? TH.local[k] : (HIDDEN[k] || []); }
function hiddenMerged() { const m = Object.assign({}, HIDDEN); Object.entries(TH.local).forEach(([k, a]) => { if (a && a.length) m[k] = a; else delete m[k]; }); return m; }
function shownOnly(name, list) {   // everyone but the teacher loses hidden shapes (never all of them)
  if (TP.on) return list;
  const hs = hiddenFor(name); if (!hs.length) return list;
  const out = list.filter(x => !hs.includes(F.vKey(x))); return out.length ? out : list;
}
function toggleHidden(name, v) {
  const k = prefKey(name), vk = F.vKey(v), a = hiddenFor(name).slice(), i = a.indexOf(vk);
  if (i >= 0) a.splice(i, 1); else { a.push(vk); if (primaryKey(name) === vk) TP.local[k] = null; }
  TH.local[k] = a; LS.set('fw.teacher.hidden', TH.local); LS.set('fw.teacher.primary', TP.local);
  return i < 0;
}
function resetChordTeacher(name) {
  const k = prefKey(name); TP.local[k] = null; TH.local[k] = [];
  LS.set('fw.teacher.primary', TP.local); LS.set('fw.teacher.hidden', TH.local);
}
function primaryKey(name) { const k = prefKey(name); return k in TP.local ? TP.local[k] : (PRIMARY[k] || null); }
function primaryMerged() {
  const m = Object.assign({}, PRIMARY);
  Object.entries(TP.local).forEach(([k, v]) => { if (v) m[k] = v; else delete m[k]; });
  return m;
}
function refreshAll() {
  updateChord(); renderMine(); renderTheory(); renderSongList();
  if (S.song && $('#v-song').classList.contains('on')) renderStrip();
}
function setPrimary(name, v) {
  const k = prefKey(name);
  if (primaryKey(name) === F.vKey(v)) TP.local[k] = null; else TP.local[k] = F.vKey(v);
  LS.set('fw.teacher.primary', TP.local);
}
function teacherBody() { document.body.classList.toggle('teacher', !!TP.on); }
/* ---- the defaults board: one page to choose the default diagram for every common chord ---- */
const BOARD_SUF = [['', 'Major'], ['m', 'Minor'], ['7', '7'], ['maj7', 'maj7'], ['m7', 'm7'], ['sus4', 'sus4'], ['sus2', 'sus2'], ['5', 'Power'], ['add9', 'add9'], ['dim', 'dim']];
const BOARD_ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function boardOpen(tab) {
  tab = tab || 0; const suf = BOARD_SUF[tab][0], keep = $('#modalBody').scrollTop;
  const changed = Object.keys(primaryMerged()).length;
  const tiles = BOARD_ROOTS.map(r => {
    const nm = cl(r + suf), out = voicingsFor(nm); if (!out.chord.ok || !out.list.length) return '';
    const v = preferred(nm), k = primaryKey(nm), i = Math.max(0, out.list.findIndex(x => F.vKey(x) === F.vKey(v)));
    return `<div class="vcard bt ${k ? 'set' : ''}"><div class="name">${esc(sharpen(nm))}${k ? ' ◆' : ''}</div>${diagram(v)}
      <div class="actions" style="justify-content:center"><button class="btn sm" data-bstep="${esc(nm)}|-1" aria-label="Previous shape">‹</button><span class="note">${i + 1}/${out.list.length}</span><button class="btn sm" data-bstep="${esc(nm)}|1" aria-label="Next shape">›</button></div>
      <div class="actions" style="justify-content:center"><button class="btn sm ghost" data-bedit="${esc(nm)}">✎ Edit</button>${k ? `<button class="btn sm ghost" data-breset="${esc(nm)}">↺ Auto</button>` : ''}</div></div>`;
  }).join('');
  openModal(`<h2>Defaults board</h2>
    <p class="sub">The ◆ shape is what everyone sees first. ‹ › cycles through the shapes. ${changed} chords set. ${SH.at ? 'Last published ' + esc(new Date(SH.at).toLocaleString()) + '.' : ''}</p>
    <div class="chiprow">${BOARD_SUF.map(([s, l], j) => `<button class="chip ${j === tab ? 'on' : ''}" data-btab="${j}">${esc(l)}</button>`).join('')}</div>
    <div class="grid small" style="margin-top:10px">${tiles}</div>
    <div class="row" style="margin-top:12px">${TP.can ? '<button class="btn primary" id="bPub">Publish to everyone</button>' : '<span class="note">Sign in with a teacher account to publish.</span>'}<button class="btn ghost" id="bExp">Download primary.json</button><span class="grow"></span><button class="btn" data-close>Close</button></div>`, b => {
    b.scrollTop = keep;
    b.onclick = async e => {
      const t = x => e.target.closest(x);
      const tb = t('[data-btab]'); if (tb) { boardOpen(+tb.dataset.btab); return; }
      const st = t('[data-bstep]');
      if (st) { const [nm, d] = st.dataset.bstep.split('|'), list = voicingsFor(nm).list, v = preferred(nm); let i = list.findIndex(x => F.vKey(x) === F.vKey(v)); i = (i + +d + list.length) % list.length; const k = prefKey(nm); TP.local[k] = F.vKey(list[i]); LS.set('fw.teacher.primary', TP.local); VC.clear(); boardOpen(tab); return; }
      const rs = t('[data-breset]'); if (rs) { TP.local[prefKey(rs.dataset.breset)] = null; LS.set('fw.teacher.primary', TP.local); boardOpen(tab); return; }
      const ed = t('[data-bedit]'); if (ed) { closeModal(); showView('chords'); setChordText(ed.dataset.bedit); edStart(); return; }
      if (t('#bExp')) { exportPrimary(); return; }
      if (t('#bPub')) { if (await publishDefaults()) boardOpen(tab); }
    };
  });
}
function exportPrimary() {
  const blob = new Blob([JSON.stringify({ v: 1, primary: primaryMerged(), hidden: hiddenMerged() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'primary.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importPrimary(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j.primary || typeof j.primary !== 'object') throw 0;
    TP.local = Object.assign({}, j.primary); LS.set('fw.teacher.primary', TP.local);
    TH.local = Object.assign({}, j.hidden || {}); LS.set('fw.teacher.hidden', TH.local);
    refreshAll(); closeModal(); toast('Primary voicings imported');
  } catch (err) { toast('That is not a primary.json file'); }
}
function initTeacher() {
  teacherBody();
  applyShared(LS.get('fw.shared', null));
  fetch('primary.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && j.primary && !SH.have) { PRIMARY = j.primary; HIDDEN = j.hidden || {}; refreshAll(); } }).catch(() => {});
}

/* ================= first-time tour: how to read a chord diagram ================= */
const TOUR_STEPS = [
  { t: 'Meet the guitar', d: 'This is a guitar the way you see a <b>right-handed</b> player: <b>body</b> on the left, <b>neck</b> pointing right, <b>headstock</b> with the tuning pegs at the end. Check the <b>thickest string</b>: it is on top. That means you are holding it the right way round. (Left-handed? Turn on left-handed diagrams in Settings.)' },
  { t: 'Stand it up', d: 'Now tip the neck up, headstock on top, as if you held it up in front of you. The thickest string ends up on the <b>left</b>, and that is exactly how every chord diagram is drawn.' },
  { t: 'Zoom in on the neck', d: 'Most basic chords are played on the first few frets, just below the headstock. A chord diagram shows just this small part of the neck. Higher up the neck, the diagram simply starts at a higher fret.' },
  { t: 'This is the chord grid', d: 'To keep the picture small, the frets are squeezed closer together. Now let’s read it, one part at a time.' },
  { t: 'Vertical lines are strings', d: 'Six lines, six strings. The thick one on the <b>left</b> makes the lowest sound (low E). The thin one on the <b>right</b> is the highest.' },
  { t: 'Horizontal lines are frets', d: 'The thick bar on top is the <b>nut</b>, where the strings start. Every line below it is a metal <b>fret</b>. The gaps are numbered 1, 2, 3 … counting down from the nut.' },
  { t: 'Dots show where to press', d: 'A dot means: press this string, in this gap, just behind the fret line. The number in the dot is the finger: <b>1</b> index, <b>2</b> middle, <b>3</b> ring, <b>4</b> little.' },
  { t: 'O and X above the grid', d: '<b>O</b> means play that string <b>open</b>, with no finger on it. <b>X</b> means <b>don’t play</b> that string.' },
  { t: 'Put it together', d: 'This is <b>C major</b>. Skip the thickest string, press three strings, and strum the rest. The <b>red</b> dots are the root note, the one the chord is named after.' }
];
const TOUR_TF = [
  'translate(200px,160px) scale(0.6,0.6) rotate(180deg)',
  'translate(200px,160px) scale(0.48,0.48) rotate(90deg)',
  'translate(200px,643.8px) scale(2.6,2.6) rotate(90deg)',
  'translate(200px,472.1px) scale(5,1.7) rotate(90deg)'
];
const tour = { i: 0, auto: true, timer: null };

function tourDiagram() {
  const c = cfg(), keep = { lh: c.lh, tuning: c.tuning, label: c.label };
  c.lh = false; c.tuning = 'Standard (E A D G B E)'; c.label = 'finger';
  const n = (label, name) => ({ label, name });
  const v = { frets: [-1, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barre: null, base: 1,
    notes: [null, n('1', 'C'), n('3', 'E'), n('5', 'G'), n('1', 'C'), n('3', 'E')] };
  let s;
  try { s = diagram(v, { names: true }); } finally { Object.assign(c, keep); }
  const H = /viewBox="0 0 \d+ (\d+)"/.exec(s)[1];
  return s.replace('<svg class="dia"', '<svg x="107" y="68" width="168" height="' + H + '" overflow="visible"');
}

function tourSvg() {
  const INK = '#1d130b', K = 'vector-effect="non-scaling-stroke"';
  const SY = i => 11 - i * 4.4, SWd = [2.4, 2.0, 1.7, 1.4, 1.2, 1.0];
  let g = '';
  // ---- Guitar drawn to real proportions (units: 1 = about 1.6 mm, scale length 397 = 25.5 in) ----
  const crPath = P => {
    let d = `M${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
      d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0]},${p2[1]}`;
    }
    return d;
  };
  const fx = n => 397 * (1 - Math.pow(2, -n / 12));
  const ST = `fill="none" stroke="${INK}" stroke-width="1.8" ${K}`;
  // headstock with three tuners per side
  const hs = [[0, -13.5], [-14, -18], [-40, -24], [-72, -27], [-95, -23], [-105, -10], [-107, 0], [-105, 10], [-95, 23], [-72, 27], [-40, 24], [-14, 18], [0, 13.5]];
  g += `<g class="fadeout" data-fade ${ST}><path d="${crPath(hs)}" ${K}/>`;
  [[-30, 24], [-58, 27], [-86, 24]].forEach(([x, e]) => [-1, 1].forEach(sg => {
    g += `<line x1="${x}" y1="${sg * e}" x2="${x}" y2="${sg * (e + 8)}" ${K}/><ellipse cx="${x}" cy="${sg * (e + 13)}" rx="3.4" ry="5" ${K}/>`;
  }));
  g += '</g>';
  // fretboard beyond the grid, body, soundhole, bridge, pickguard, strings
  const hw = x => 13.2 + (x - 100) / 172 * 3.8;
  g += `<g class="fadeout" data-fade ${ST}>`
    + `<line x1="100" y1="-13.2" x2="272" y2="-17" ${K}/><line x1="100" y1="13.2" x2="272" y2="17" ${K}/><path d="M272,-17 Q283,0 272,17" ${K}/>`;
  for (let n = 6; n <= 20; n++) { const x = fx(n); if (x > 270) break; g += `<line x1="${x.toFixed(1)}" y1="${(-hw(x)).toFixed(1)}" x2="${x.toFixed(1)}" y2="${hw(x).toFixed(1)}" stroke-width="1.2" ${K}/>`; }
  [7, 9, 12, 15, 17].forEach(n => {
    const mx = ((fx(n - 1) + fx(n)) / 2).toFixed(1);
    (n === 12 ? [-5, 5] : [0]).forEach(y => { g += `<circle cx="${mx}" cy="${y}" r="2.4" stroke-width="1" ${K}/>`; });
  });
  const X0 = 222, sh = P => P.map(([t, y]) => [X0 + t, y]);
  // dreadnought body (traced from a reference photo), symmetrical top to bottom
  const half = [[0.0, 14.0], [1.9, 30.9], [8.0, 46.8], [17.5, 60.9], [29.9, 72.6], [44.7, 81.0], [61.2, 84.9], [78.3, 84.8], [95.2, 82.7], [112.1, 80.4], [129.1, 79.6], [145.9, 82.3], [161.5, 89.1], [176.0, 98.2], [190.0, 107.8], [204.6, 116.8], [220.3, 123.3], [237.2, 125.5], [254.0, 123.2], [270.0, 117.3], [284.5, 108.4], [297.1, 96.9], [307.1, 83.1], [314.0, 67.5], [318.2, 51.0], [320.4, 34.1], [321.3, 17.1], [321.5, 0.0]];
  const outline = half.map(([t, y]) => [t, -y]).concat(half.slice(0, -1).reverse());
  g += `<path d="${crPath(sh(outline))}" ${K}/>`;
  g += `<circle cx="332" cy="0" r="31" ${K}/><circle cx="332" cy="0" r="35" stroke-width="1" ${K}/><circle cx="332" cy="0" r="38.5" stroke-width="1" ${K}/>`;
  g += `<rect x="387" y="-46" width="22" height="92" rx="9" ${K}/>`;
  for (let k = -2.5; k <= 2.5; k++) g += `<circle cx="394" cy="${k * 8.4}" r="1.8" stroke-width="1" ${K}/>`;
  for (let i = 0; i < 6; i++) g += `<line x1="100" y1="${SY(i)}" x2="397" y2="${(SY(i) * 1.5).toFixed(1)}" stroke-width="${SWd[i]}" ${K}/>`;
  g += '</g>';
  // the part that becomes the chord grid
  g += `<g fill="none" stroke="${INK}" stroke-width="1.8" ${K}><line x1="0" y1="-13.2" x2="100" y2="-13.2" ${K}/><line x1="0" y1="13.2" x2="100" y2="13.2" ${K}/>`;
  for (let f = 20; f <= 100; f += 20) g += `<line x1="${f}" y1="-13.2" x2="${f}" y2="13.2" stroke-width="1.6" ${K}/>`;
  for (let i = 0; i < 6; i++) g += `<line x1="0" y1="${SY(i)}" x2="100" y2="${SY(i)}" stroke-width="${SWd[i]}" ${K}/>`;
  g += `</g><rect x="-3" y="-13.2" width="4" height="26.4" fill="${INK}"/>`;

  const X = i => 145 + 22 * i, gold = '#e2a919';
  let hi = '';
  const lab = (x, y, t, a, sz) => `<text x="${x}" y="${y}" text-anchor="${a || 'middle'}" font-size="${sz || 13}" font-weight="700" font-family="Georgia,serif" fill="#3a2808">${t}</text>`;
  const labels = '<g class="tl" id="tl0">' + lab(117, 254, 'Body') + lab(262, 206, 'Neck') + lab(361, 206, 'Headstock')
    + '<g stroke="#a42b14" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M262,124 L262,147"/><path d="M255,140 L262,148 L269,140"/></g>'
    + '<text x="262" y="92" text-anchor="middle" font-size="13" font-weight="700" font-family="Georgia,serif" fill="#a42b14">Thickest string</text>'
    + '<text x="262" y="108" text-anchor="middle" font-size="13" font-weight="700" font-family="Georgia,serif" fill="#a42b14">is on top</text></g>';
  hi += '<g class="tl" id="tl4">' + [0, 1, 2, 3, 4, 5].map(i => `<rect x="${X(i) - 8}" y="104" width="16" height="182" rx="8" fill="${gold}" opacity=".4"/>` + lab(X(i), 304, (SK ? 'EADGHE' : 'EADGBE')[i], 'middle', 15)).join('')
    + lab(X(0), 320, 'low', 'middle', 10) + lab(X(5), 320, 'high', 'middle', 10) + '</g>';
  hi += '<g class="tl" id="tl5">' + [1, 2, 3, 4, 5].map(r => `<rect x="134" y="${110 + 34 * (r - 1)}" width="132" height="34" fill="${gold}" opacity="${r % 2 ? .38 : .18}"/>` + lab(121, 110 + 34 * (r - 0.5) + 5, r, 'middle', 14)).join('')
    + lab(121, 100, 'nut', 'middle', 12) + `<rect x="130" y="102" width="140" height="9" rx="2" fill="${gold}" opacity=".5"/></g>`;
  hi += '<g class="tl" id="tl6">' + [[1, 3], [2, 2], [4, 1]].map(([s, r]) => `<circle class="pulse" cx="${X(s)}" cy="${110 + 34 * (r - 0.5)}" r="16" fill="none" stroke="${gold}" stroke-width="3" stroke-dasharray="4 3"/>`).join('') + '</g>';
  hi += '<g class="tl" id="tl7">' + [[0, 'skip'], [3, 'open'], [5, 'open']].map(([s, t]) => `<circle class="pulse" cx="${X(s)}" cy="90" r="13" fill="none" stroke="${gold}" stroke-width="3" stroke-dasharray="4 3"/>` + lab(X(s), 66, t, 'middle', 11)).join('') + '</g>';

  return `<svg id="tourSvg" viewBox="0 0 400 330" role="img" aria-label="Animation: a guitar stands up and zooms in to become a chord diagram">
    <g id="tourG" style="transform-origin:0 0;transform:${TOUR_TF[0]};transition:transform 1.8s cubic-bezier(.65,0,.35,1)"><g id="skel" transform="translate(-213 0)">${g}</g></g>
    <g id="realDia" class="tl">${tourDiagram()}</g>
    ${labels}${hi}</svg>`;
}

function tourOpen() {
  const el = $('#tour');
  el.innerHTML = `<div class="tour-card paper" role="dialog" aria-modal="true" aria-label="How to read a chord diagram">
    ${tourSvg()}
    <div class="tour-cap" aria-live="polite"><h2 id="tourT"></h2><p id="tourD"></p></div>
    <div class="tour-dots" id="tourDots">${TOUR_STEPS.map((s, i) => `<button data-i="${i}" aria-label="Step ${i + 1}: ${esc(s.t)}"></button>`).join('')}</div>
    <div class="row"><button class="btn ghost" id="tourSkip">Skip</button><span class="grow"></span><button class="btn" id="tourBack">Back</button><button class="btn primary" id="tourNext">Next</button></div>
  </div>`;
  el.hidden = false; document.body.style.overflow = 'hidden';
  tour.auto = true; tour.i = 0; tourGo(0);
  $('#tourNext').onclick = () => { tour.auto = false; tour.i >= TOUR_STEPS.length - 1 ? tourClose() : tourGo(tour.i + 1); };
  $('#tourBack').onclick = () => { tour.auto = false; tourGo(Math.max(0, tour.i - 1)); };
  $('#tourSkip').onclick = () => { if (tour.i >= TOUR_STEPS.length - 1) { tour.auto = false; tourGo(0); } else tourClose(); };
  $('#tourDots').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { tour.auto = false; tourGo(+b.dataset.i); } };
  $('#tourNext').focus();
}
function tourGo(i) {
  tour.i = i; clearTimeout(tour.timer);
  const st = TOUR_STEPS[i];
  $('#tourT').textContent = TT(st.t); $('#tourD').innerHTML = TT(st.d);
  $('#tourG').style.transform = TOUR_TF[i <= 0 ? 0 : i === 1 ? 1 : i === 2 ? 2 : 3];
  $$('#tourSvg [data-fade]').forEach(x => x.classList.toggle('gone', i >= 2));
  $('#skel').style.opacity = i >= 6 ? 0 : 1;
  $('#skel').style.transition = 'opacity .7s';
  $('#realDia').classList.toggle('on', i >= 6);
  $('#tl0').classList.toggle('on', i === 0);
  [4, 5, 6, 7].forEach(k => $('#tl' + k).classList.toggle('on', i === k));
  $$('#tourDots button').forEach((b, k) => b.classList.toggle('on', k === i));
  const last = i === TOUR_STEPS.length - 1;
  $('#tourNext').textContent = last ? 'Got it' : 'Next';
  $('#tourSkip').textContent = last ? 'Replay' : 'Skip';
  $('#tourBack').hidden = i === 0;
  if (tour.auto && !last) tour.timer = setTimeout(() => tourGo(i + 1), i === 0 ? 7000 : 8000);
}
function tourClose() {
  clearTimeout(tour.timer); $('#tour').hidden = true; $('#tour').innerHTML = ''; document.body.style.overflow = '';
  LS.set('fw.tourSeen', 1);
}

function askLevel(done) {
  openModal(`<h2>Welcome to Fretwork</h2><p class="note">How much guitar have you played?</p>
    <div class="row" style="flex-direction:column;gap:8px;margin-top:10px">
      <button class="btn primary" data-lv="1">I'm new: keep it simple</button>
      <button class="btn" data-lv="0">I've played before: show everything</button></div>
    <p class="note" style="margin-top:10px">You can change this any time in Settings.</p>`, b => {
    b.onclick = e => { const x = e.target.closest('[data-lv]'); if (!x) return; cfg().beginner = x.dataset.lv === '1'; save(); S.showAll = false; closeModal(); buildKeys(); applyBeg(); setChordText(isBeg() ? 'Em' : 'Am7'); done(); };
  });
}
function init() {
  applyFinish(); applyLook(); stkRender();
  fetch('look.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(j => { if (j && j.look) { LOOK_SHIPPED = j.look; LS.set('fw.look.shipped', j.look); applyLook(); } }).catch(() => {});
  if (/[?&]lab\b/.test(location.search)) setTimeout(labOpen, 400);
  buildKeys(); renderSongList(); renderMine(); updateWho();
  $('#chordIn').value = S.text; updateChord();

  $('#nav').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (!b) return; if (b.dataset.view === 'theory') thOpen(); else showView(b.dataset.view); });
  $('#chordIn').addEventListener('input', () => { clearTimeout(chordTimer); markKeys(); chordTimer = setTimeout(updateChord, 140); });
  $('#btnClear').onclick = () => { setChordText('', true); $('#chordIn').focus(); };
  $('#rootKeys').addEventListener('click', e => {
    const k = e.target.closest('.key'); if (!k) return;
    const sp = splitText($('#chordIn').value.trim());
    setChordText(rootName(+k.dataset.pc) + (sp.root ? sp.suf + sp.bass : ''));
  });
  $('#suffixChips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (c.id === 'btnMore') { cfg().more = !cfg().more; save(); buildKeys(); return; }
    const sp = splitText($('#chordIn').value.trim());
    if (!sp.root) { toast('Pick a root note first'); return; }
    setChordText(nn(sp.root.name) + skS(c.dataset.suf) + sp.bass);
  });
  $('#voicings').addEventListener('click', e => {
    if (e.target.closest('#btnShapes')) { S.showAll = !S.showAll; updateChord(); return; }
    const b = e.target.closest('.vcard'); if (!b) return;
    S.sel = +b.dataset.i; renderChord(); strum(S.list[S.sel]);
  });
  $('#detail').addEventListener('click', e => {
    if (e.target.closest('#btnPrimary')) {
      const v = S.list[S.sel]; setPrimary(S.text, v);
      toast(primaryKey(S.text) ? S.text + ': this shape is now the primary voicing' : 'Primary cleared for ' + S.text);
      refreshAll(); return;
    }
    if (e.target.closest('#btnHide')) { const on = toggleHidden(S.text, S.list[S.sel]); toast(on ? 'Hidden from students (export primary.json to publish)' : 'Shown again'); renderChord(); return; }
    if (e.target.closest('#btnResetChord')) { resetChordTeacher(S.text); toast('Primary and hidden shapes cleared for ' + S.text); refreshAll(); return; }
    if (e.target.closest('#btnLearn')) { toggleLearned(canon(S.text)); renderChord(); return; }
    if (e.target.closest('#btnTheory')) { thOpen(S.text); return; }
    if (edClick(e)) return;
    if (e.target.closest('#btnPin')) { togglePin(canon(S.text)); renderChord(); return; }
    if (e.target.closest('#btnSeqAdd')) { seqAdd(canon(S.text)); return; }
    if (e.target.closest('#btnPlay')) { strum(S.list[S.sel]); return; }
    const m = e.target.closest('[data-mode]'); if (m) { cfg().label = m.dataset.mode; save(); renderChord(); return; }
    if (e.target.closest('#btnPref')) {
      const v = S.list[S.sel], k = prefKey(S.text);
      if (D.pref[k] === F.vKey(v)) { delete D.pref[k]; toast('Back to the automatic voicing'); } else { D.pref[k] = F.vKey(v); toast('Saved as your ' + S.text); }
      save(); renderChord(); renderMine();
    }
  });
  document.addEventListener('click', e => {
    const ps = e.target.closest('[data-playsong]');
    if (ps) { const r = PLAYABLE.find(x => x[0] === ps.dataset.playsong); if (r) { const q = playSeq(r).filter(pgChordOk), st = songStyle(r); if (q.length) pgPlayer(r[0], ['#Main loop'].concat(q), { pat: st[0], spd: st[1] }); else toast('No playable shapes for this one'); } return; }
    const cp = e.target.closest('[data-copysong]');
    if (cp) { const r = PLAYABLE.find(x => x[0] === cp.dataset.copysong); if (r) { const q = playSeq(r).filter(pgChordOk), st = songStyle(r); seqLoad(null, { name: r[0], bars: ['#Verse'].concat(q), pat: st[0], spd: st[1] }); } return; }
    const l = e.target.closest('[data-learnrow]'); if (l) { learnChords(l.dataset.t, l.dataset.learnrow.split(',')); return; }
    const o = e.target.closest('[data-open]'); if (o && !o.closest('#drawer')) { if (o.closest('#playable,#chartStrip')) playChord(o.dataset.open); else openPicker(o.dataset.open); }
  });
  $('#mine').addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) { setChordText(o.dataset.open); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.addEventListener('click', e => { const o = e.target.closest('#mine [data-open]'); if (o) e.stopImmediatePropagation(); }, true);

  seqInit(); guideInit();
  $('#btnKeys').onclick = () => { S.keysOpen = !S.keysOpen; applyBeg(); };
  // tap or swipe across the strings of the big diagram
  (() => {
    const D_ = $('#detail'); let down = false, last = -1;
    const strIdx = e => {
      const svg = e.target.closest('#detailDia') && D_.querySelector('#detailDia svg'); if (!svg) return -1;
      const m = svg.getScreenCTM(); if (!m) return -1;
      const x = (e.clientX - m.e) / m.a, y = (e.clientY - m.f) / m.d;
      if (y < 38 || y > 216) return -1;
      const k = Math.round((x - 38) / 22); if (k < 0 || k > 5 || Math.abs(x - 38 - k * 22) > 11) return -1;
      return cfg().lh ? 5 - k : k;
    };
    const twang = i => {
      const svg = D_.querySelector('#detailDia svg'); if (!svg) return;
      const k = cfg().lh ? 5 - i : i, ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', 38 + k * 22); ln.setAttribute('x2', 38 + k * 22); ln.setAttribute('y1', 42); ln.setAttribute('y2', 212);
      ln.setAttribute('class', 'twang'); svg.appendChild(ln); setTimeout(() => ln.remove(), 600);
    };
    const hit = e => { const i = strIdx(e); if (i < 0 || i === last) return; last = i; strum(S.list[S.sel], i); twang(i); };
    D_.addEventListener('pointerdown', e => { if (!e.target.closest('#detailDia')) return; down = true; last = -1; const i = strIdx(e); if (i < 0) strum(S.list[S.sel]); else hit(e); });
    D_.addEventListener('pointermove', e => { if (down) hit(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => D_.addEventListener(t, () => { down = false; last = -1; }));
  })();
  // header tucks away while scrolling down
  (() => {
    let ly = scrollY;
    addEventListener('scroll', () => {
      const y = scrollY, d = y - ly;
      if (y < 70 || d < -6) document.body.classList.remove('deck-hide');
      else if (d > 6) document.body.classList.add('deck-hide');
      if (Math.abs(d) > 6) ly = y;
    }, { passive: true });
  })();
  $('#startCard').addEventListener('click', e => {
    const l = e.target.closest('[data-learn]'); if (l) { toggleLearned(l.dataset.learn); return; }
    if (e.target.closest('#heroGo')) { heroPlay(); return; }
    const o = e.target.closest('[data-st]'); if (o) { setChordText(cl(o.dataset.st)); strum(S.list[S.sel]); return; }
    if (e.target.closest('#stSongs')) { showView('songs'); $('#playable').scrollIntoView({ behavior: 'smooth' }); }
  });
  $('#progs').addEventListener('click', e => {
    if (e.target.closest('#pgNew')) { seqLoad(null); return; }
    const pl = e.target.closest('[data-pgplay]'), ed = e.target.closest('[data-pgedit]');
    if (pl) { const p = D.progs.find(x => x.id === pl.dataset.pgplay); if (p) pgPlayer(p.name, p.chords, { pat: p.pat, spd: p.spd, bts: p.bts }); }
    if (ed) seqLoad(ed.dataset.pgedit);
  });
  $('#btnLearnSong').onclick = () => { if (S.song) learnChords('Chords in this song', songChordsUI(S.song, S.tr, cfg().flats)); };
  $('#btnPlaySong').onclick = () => {
    if (!S.song) return; const ch = songArr(S.song, S.tr);
    if (!ch.some(isChord)) { toast('No playable chords in this song'); return; }
    pgPlayer(S.song.title || 'Song chords', ch);
  };
  $('#btnSongSeq').onclick = () => {
    if (!S.song) return; const ch = songArr(S.song, S.tr);
    if (!ch.some(isChord)) { toast('No playable chords in this song'); return; }
    seqLoad(null, { name: S.song.title || 'My song', bars: ch });
  };
  $('#btnImport').onclick = () => importModal();
  $('#songList').onclick = $('#sampleList').onclick = e => { const b = e.target.closest('[data-song]'); if (b) openSong(b.dataset.song); };
  $('#btnBack').onclick = () => { showView('songs'); renderSongList(); };
  $('#btnEditSong').onclick = () => importModal(S.song);
  const setTr = n => { S.tr = n; if (!S.song.sample) { S.song.tr = n; save(); } renderSong(); };
  $('#trDown').onclick = () => setTr(S.tr - 1);
  $('#trUp').onclick = () => setTr(S.tr + 1);
  $('#fsDown').onclick = () => { cfg().fs = Math.max(12, cfg().fs - 2); save(); renderSong(); };
  $('#fsUp').onclick = () => { cfg().fs = Math.min(34, cfg().fs + 2); save(); renderSong(); };
  $('#swCharts').onchange = renderStrip;
  $('#sheet').addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (c) playChord(c.dataset.c); });
  $('#sheet').addEventListener('keydown', e => { if (e.key === 'Enter') { const c = e.target.closest('[data-c]'); if (c) playChord(c.dataset.c); } });
  $('#btnSettings').onclick = settingsModal;
  $('#btnLang').dataset.lang = SK ? 'sk' : 'en'; $('#btnLang').setAttribute('aria-checked', SK);
  $('#btnLang').onclick = () => { $('#btnLang').dataset.lang = SK ? 'en' : 'sk'; setTimeout(() => setLang(SK ? 'en' : 'sk'), 300); };   // let the lever flip first
  $('#btnProfile').onclick = profileModal;

  $('#btnHelp').onclick = tourOpen;
  $('#btnHelp2').onclick = tourOpen;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#tour').hidden) tourClose(); });
  const afterAsk = () => { if (!LS.get('fw.tourSeen', false)) setTimeout(tourOpen, 400); };
  if (cfg().beginner == null && !D.songs.length && !Object.keys(D.pref).length) setTimeout(() => askLevel(afterAsk), 500);
  else { if (cfg().beginner == null) { cfg().beginner = false; save(); buildKeys(); applyBeg(); } afterAsk(); }
  initFind();
  applyBeg();
  initTheory();
  initTeacher();
  tuneBar(); a2hsBar();
  $('#a2hs').addEventListener('click', e => { if (e.target.closest('#a2Go')) a2hsAsk(); if (e.target.closest('#a2No')) { LS.set('fw.a2hsHide', 1); a2hsBar(); } });
  $('#wip').innerHTML = SK
    ? '<b>Rozpracované.</b> Spätná väzba vítaná: <a href="mailto:gitara@lesson.sk">gitara@lesson.sk</a>'
    : '<b>Work in progress.</b> Feedback welcome: <a href="mailto:guitar@lesson.sk">guitar@lesson.sk</a>';
  $('#tuneBar').addEventListener('click', e => {
    if (e.target.id === 'tbChange') settingsModal();
    if (e.target.id === 'tbStd') { cfg().tuning = 'Standard (E A D G B E)'; save(); VC.clear(); buildKeys(); updateChord(); renderFind(); renderTheory(); renderMine(); renderSongList(); if (S.song && $('#v-song').classList.contains('on')) renderSong(); }
  });
  cloudInit();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadSW = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js?v=' + VER).then(reg => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      setInterval(check, 30 * 60 * 1000);
    }).catch(() => {});
    let shown = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadSW || shown) return; shown = true;   // first install is not an update
      const bar = document.createElement('div'); bar.className = 'updbar'; bar.setAttribute('role', 'status');
      bar.innerHTML = (SK ? 'Je dostupná nová verzia. ' : 'A new version is available. ') + `<button class="btn sm primary">${SK ? 'Obnoviť' : 'Reload'}</button>`;
      bar.querySelector('button').onclick = () => location.reload();
      document.body.appendChild(bar);
    });
  }
}
init();
})();
