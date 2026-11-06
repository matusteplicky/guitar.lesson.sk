/* Fretwork UI */
(function () {
'use strict';
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
const DEFAULTS = () => ({ songs: [], pref: {}, settings: { tuning: 'Standard (E A D G B E)', label: 'finger', lh: false, flats: false, sound: true, fs: 18 } });
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
  d.songs = d.songs || []; d.pref = d.pref || {};
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden) cloudPull(); });
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
  }
  LS.set('fw.data.' + uid, merged);
  switchUser(uid);
  cloudPush(true);
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
function strum(v) {
  if (!cfg().sound || !v) return;
  const c = actx(); if (!c) return;
  const tun = F.TUNINGS[cfg().tuning];
  let k = 0; const t0 = c.currentTime + 0.02;
  v.frets.forEach((f, s) => {
    if (f < 0) return;
    const src = c.createBufferSource(); src.buffer = pluckBuffer(c, tun[s] + f);
    const g = c.createGain(); g.gain.value = 0.2;
    src.connect(g).connect(c.destination); src.start(t0 + k++ * 0.05);
  });
}

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
  v = v || list.find(x => x.rank === 0) || list[0];
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
const S = { text: 'Am7', chord: null, list: [], sel: 0, song: null, tr: 0 };

function rootName(pc) { return F.pcLoc(pc, cfg().flats); }
function buildKeys() {
  $('#rootKeys').innerHTML = ROOTS.map(pc => {
    const nat = [0, 2, 4, 5, 7, 9, 11].includes(pc), main = rootName(pc);
    const alt = main === nn(F.FLAT[pc]) ? nn(F.SHARP[pc]) : nn(F.FLAT[pc]);
    return `<button class="key ${nat ? 'w' : 'b'}" data-pc="${pc}" aria-label="${main}">${sharpen(main)}${nat ? '' : `<small>${sharpen(alt)}</small>`}</button>`;
  }).join('');
  const BASIC = ['', 'm', '7', 'maj7', 'm7', 'sus2', 'sus4', '5'];
  const chip = ([v, l], cls) => `<button class="chip ${cls}" data-suf="${v}">${l === 'major' ? 'major' : sharpen(skS(l))}</button>`;
  const basic = SUFFIXES.filter(x => BASIC.includes(x[0])), more = SUFFIXES.filter(x => !BASIC.includes(x[0])), open = !!cfg().more;
  $('#suffixChips').innerHTML = `<div class="chiprow">${basic.map(x => chip(x, 'basic')).join('')}<button class="chip morebtn" id="btnMore" aria-expanded="${open}">${open ? 'Fewer ▴' : 'More chord types (' + more.length + ') ▾'}</button></div>`
    + `<div class="chiprow" ${open ? '' : 'hidden'}>${more.map(x => chip(x, '')).join('')}</div>`;
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
  S.chord = out.chord; S.list = out.list.slice();
  if (!out.chord.ok) { info.className = 'status err'; info.textContent = out.chord.error; $('#chordResult').hidden = true; $('#chordHint').textContent = ''; return; }
  $('#chordHint').textContent = '';
  if (!out.list.length) { info.className = 'status err'; info.textContent = 'That chord is parsed (' + out.chord.notes.map(nn).join(' – ') + ') but I couldn’t find a playable shape in this tuning.'; $('#chordResult').hidden = true; return; }
  info.className = 'status'; info.innerHTML = '<b>' + esc(sharpen(raw)) + '</b>' + usualHtml(out.chord) + ' · ' + esc(out.chord.notes.map(n => sharpen(nn(n))).join(' – '));
  const pk = preferred(raw);
  if (pk && !S.list.includes(pk)) { S.list.push(pk); S.list.sort((x, y) => x.pos - y.pos); }
  S.sel = Math.max(0, S.list.indexOf(pk));
  renderChord();
}
function posCaption(v) { return v.pos === 0 ? 'Open position' : 'Starts at fret ' + v.pos; }
function tagsFor(v, name) {
  let t = '';
  if (name && primaryKey(name) === F.vKey(v)) t += '<span class="tag gold">Recommended</span> ';
  if (v.barre) t += '<span class="tag">Barre</span> ';
  else if (v.fingerCount <= 3 && v.pos <= 3) t += '<span class="tag">Easy</span> ';
  if (v.omits.length) t += `<span class="tag">no ${esc(v.omits.map(sharpen).join(', '))}</span>`;
  if (v.slashBass) t += ` <span class="tag bassTag">bass ${esc(sharpen(nn(v.slashBass)))}</span>`;
  return t;
}
function renderChord() {
  const raw = S.text, chord = S.chord, v = S.list[S.sel];
  $('#chordResult').hidden = false;
  const isPref = D.pref[prefKey(raw)] === F.vKey(v), isPrim = primaryKey(raw) === F.vKey(v);
  const pills = chord.tones.map(t => `<span class="pill ${t.label === '1' ? 'root' : ''}">${esc(sharpen(nn(t.name)))}<i>${esc(sharpen(t.label))}</i></span>`).join('');
  const modes = [['finger', 'Fingers'], ['note', 'Notes'], ['interval', 'Intervals']];
  $('#detail').innerHTML = `
    <div id="detailDia" data-play>${diagram(v, { names: true })}</div>
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
        <button class="btn primary" id="btnPlay">▶ Strum</button>
        <button class="btn" id="btnPref">${isPref ? '★ My voicing' : '☆ Use in my songs'}</button>
        <button class="btn ghost" id="btnTheory">Theory ›</button>
        ${TP.on ? `<button class="btn teach" id="btnPrimary">${isPrim ? '◆ Primary (tap to clear)' : '◆ Make primary'}</button>` : ''}
      </div>
    </div>`;
  $('#voicingCount').textContent = S.list.length + ' shapes, low to high';
  $('#voicings').innerHTML = S.list.map((x, i) => `
    <button class="vcard ${i === S.sel ? 'sel' : ''}" data-i="${i}">
      ${D.pref[prefKey(raw)] === F.vKey(x) ? '<span class="star">★</span>' : ''}
      ${diagram(x)}
      <div class="cap">${posCaption(x)}</div>${tagsFor(x, raw)}
    </button>`).join('');
}
function renderMine() {
  const items = Object.entries(D.pref).filter(([k]) => k.startsWith(cfg().tuning + '|')).map(([k, vk]) => ({ name: cl(k.slice(cfg().tuning.length + 1)), vk }));
  const cards = items.map(it => { const v = preferred(it.name); return v && F.vKey(v) === it.vk ? { name: it.name, v } : null; }).filter(Boolean);
  $('#mineHead').hidden = !cards.length;
  $('#mine').innerHTML = cards.map(c => `<button class="vcard" data-open="${esc(c.name)}"><div class="name">${esc(sharpen(c.name))}</div>${diagram(c.v)}</button>`).join('');
}

/* ================= songs ================= */
const SAMPLES = [
  { id: 's-grace', sample: true, title: 'Amazing Grace', artist: 'Traditional · ChordPro format', text:
`{title: Amazing Grace}
{artist: Traditional}
{key: G}
[Verse 1]
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That saved a [Em]wretch like [D]me
I [G]once was lost but [C]now am [G]found
Was [Em]blind but [D]now I [G]see
` },
  { id: 's-sun', sample: true, title: 'House of the Rising Sun', artist: 'Traditional · chords above lyrics', text:
`[Verse 1]
Am        C       D        F
There is a house in New Orleans
Am       C        E
They call the Rising Sun
Am          C         D      F
And it's been the ruin of many a poor boy
Am     E      Am
And God, I know I'm one
` },
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
function detectNt(text) {
  const n = l => F.withLocale(l, () => { const p = F.parseSong(text); let k = 0; p.lines.forEach(x => x.segs && x.segs.forEach(s => { if (s.c) k++; })); return k; });
  const e = n('en'), s = n('sk'); return s > e ? 'sk' : e > s ? 'en' : LANG;
}

function songCard(s) {
  const p = parsed(s), ch = songChordsUI(s, 0, cfg().flats).slice(0, 7);
  return `<button class="scard" data-song="${esc(s.id)}"><b>${esc(s.title || p.meta.title || 'Untitled')}</b><span>${esc(s.artist || p.meta.artist || '')}</span>
    <div class="mini">${ch.map(c => `<span class="pill">${esc(sharpen(c))}</span>`).join('')}</div></button>`;
}
function renderSongList() {
  $('#songList').innerHTML = D.songs.length ? D.songs.map(songCard).join('') : '<div class="empty">No songs yet. Import one: paste text from any chord site, or open a ChordPro / text file.</div>';
  $('#sampleList').innerHTML = SAMPLES.map(songCard).join('');
}
function showView(v) {
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  $$('#nav .seg-b').forEach(b => b.classList.toggle('on', b.dataset.view === (v === 'song' ? 'songs' : v)));
  window.scrollTo(0, 0);
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
    <div class="toggles">
      <label class="switch"><span>Left-handed diagrams</span><input type="checkbox" id="stLh" ${c.lh ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>Use flats (B♭) instead of sharps</span><input type="checkbox" id="stFl" ${c.flats ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>Sound</span><input type="checkbox" id="stSnd" ${c.sound ? 'checked' : ''}><i></i></label>
      <label class="switch"><span>Teacher mode: pick the primary voicing</span><input type="checkbox" id="stTeach" ${TP.on ? 'checked' : ''}><i></i></label>
    </div>
    ${TP.on ? `<div class="field"><span>Primary voicings (${Object.keys(primaryMerged()).length})</span>
      <p class="note">Open a chord and press “Make primary” under its diagram. Primary shapes show as Recommended and open first for everyone. Export the file and save it as <b>primary.json</b> next to index.html to publish your picks.</p>
      <div class="row" style="margin-top:6px"><button class="btn sm" id="tcExport">Export primary.json</button>
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
    $('#stSnd', b).onchange = e => { c.sound = e.target.checked; save(); };
    $('#stTeach', b).onchange = e => { TP.on = e.target.checked; LS.set('fw.teacher.on', TP.on); teacherBody(); refreshAll(); settingsModal(); };
    if ($('#tcExport', b)) {
      $('#tcExport', b).onclick = exportPrimary;
      $('#tcImport', b).onchange = importPrimary;
      $('#tcClear', b).onclick = () => { if (!confirm('Remove all primary-voicing changes made on this device?')) return; TP.local = {}; LS.set('fw.teacher.primary', TP.local); refreshAll(); settingsModal(); };
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
      $('#pfOut', b).onclick = async () => { closeModal(); await sb.auth.signOut(); switchUser('guest'); toast('Signed out'); };
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
  const id = identify(FD.frets); FD.res = id.res;
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
    ? `<div class="empty">${nPlayed < 2 ? 'Place a few fingers on the neck and the chord names will show up here.' : 'No standard chord matches these notes. Try moving a finger, or muting a string with the circle above it.'}</div>`
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
const TP = { local: LS.get('fw.teacher.primary', {}), on: LS.get('fw.teacher.on', false) };   // this device's edits
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
function exportPrimary() {
  const blob = new Blob([JSON.stringify({ v: 1, primary: primaryMerged() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'primary.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function importPrimary(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j.primary || typeof j.primary !== 'object') throw 0;
    TP.local = Object.assign({}, j.primary); LS.set('fw.teacher.primary', TP.local);
    refreshAll(); closeModal(); toast('Primary voicings imported');
  } catch (err) { toast('That is not a primary.json file'); }
}
function initTeacher() {
  teacherBody();
  fetch('primary.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
    .then(j => { if (j && j.primary) { PRIMARY = j.primary; refreshAll(); } }).catch(() => {});
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

function init() {
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
    const b = e.target.closest('.vcard'); if (!b) return;
    S.sel = +b.dataset.i; renderChord(); strum(S.list[S.sel]);
    $('#detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  $('#detail').addEventListener('click', e => {
    if (e.target.closest('#btnPrimary')) {
      const v = S.list[S.sel]; setPrimary(S.text, v);
      toast(primaryKey(S.text) ? S.text + ': this shape is now the primary voicing' : 'Primary cleared for ' + S.text);
      refreshAll(); return;
    }
    if (e.target.closest('#btnTheory')) { thOpen(S.text); return; }
    if (e.target.closest('#btnPlay') || e.target.closest('#detailDia')) { strum(S.list[S.sel]); return; }
    const m = e.target.closest('[data-mode]'); if (m) { cfg().label = m.dataset.mode; save(); renderChord(); return; }
    if (e.target.closest('#btnPref')) {
      const v = S.list[S.sel], k = prefKey(S.text);
      if (D.pref[k] === F.vKey(v)) { delete D.pref[k]; toast('Back to the automatic voicing'); } else { D.pref[k] = F.vKey(v); toast('Saved as your ' + S.text); }
      save(); renderChord(); renderMine();
    }
  });
  document.addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o && !o.closest('#drawer')) openPicker(o.dataset.open); });
  $('#mine').addEventListener('click', e => { const o = e.target.closest('[data-open]'); if (o) { setChordText(o.dataset.open); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  document.addEventListener('click', e => { const o = e.target.closest('#mine [data-open]'); if (o) e.stopImmediatePropagation(); }, true);

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
  $('#sheet').addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (c) openPicker(c.dataset.c); });
  $('#sheet').addEventListener('keydown', e => { if (e.key === 'Enter') { const c = e.target.closest('[data-c]'); if (c) openPicker(c.dataset.c); } });
  $('#btnSettings').onclick = settingsModal;
  $('#btnLang').textContent = SK ? 'EN' : 'SK';
  $('#btnLang').onclick = () => setLang(SK ? 'en' : 'sk');
  $('#btnProfile').onclick = profileModal;

  $('#btnHelp').onclick = tourOpen;
  $('#btnHelp2').onclick = tourOpen;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#tour').hidden) tourClose(); });
  if (!LS.get('fw.tourSeen', false)) setTimeout(tourOpen, 700);
  initFind();
  initTheory();
  initTeacher();
  tuneBar();
  $('#wip').innerHTML = SK
    ? '<b>Rozpracované.</b> Spätná väzba vítaná: <a href="mailto:gitara@lesson.sk">gitara@lesson.sk</a>'
    : '<b>Work in progress.</b> Feedback welcome: <a href="mailto:guitar@lesson.sk">guitar@lesson.sk</a>';
  $('#tuneBar').addEventListener('click', e => {
    if (e.target.id === 'tbChange') settingsModal();
    if (e.target.id === 'tbStd') { cfg().tuning = 'Standard (E A D G B E)'; save(); VC.clear(); buildKeys(); updateChord(); renderFind(); renderTheory(); renderMine(); renderSongList(); if (S.song && $('#v-song').classList.contains('on')) renderSong(); }
  });
  cloudInit();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
})();
