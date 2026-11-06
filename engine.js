/* Fretwork engine: chord parsing, voicing search, song parsing. No DOM. */
(function (g) {
'use strict';
const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const LETTERS = ['C','D','E','F','G','A','B'];
const LETTER_PC = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const mod = (n, m) => ((n % m) + m) % m;

const TUNINGS = {
  'Standard (E A D G B E)': [40,45,50,55,59,64],
  'Half step down (Eb)':    [39,44,49,54,58,63],
  'Drop D':                 [38,45,50,55,59,64],
  'Double drop D':          [38,45,50,55,59,62],
  'DADGAD':                 [38,45,50,55,57,62],
  'Open G (D G D G B D)':   [38,43,50,55,59,62],
  'Open D (D A D F# A D)':  [38,45,50,54,57,62],
  'Open E (E B E G# B E)':  [40,47,52,56,59,64],
  'Open C (C G C G C E)':   [36,43,48,55,60,64]
};

/* ---------- locale: 'en' (B = B natural) or 'sk' (H = B natural, B = B flat, Cis, Es ...) ---------- */
let LOC = 'en';
const setLocale = l => { LOC = l === 'sk' ? 'sk' : 'en'; };
const locale = () => LOC;
function withLocale(l, fn) { const o = LOC; LOC = l === 'sk' ? 'sk' : 'en'; try { return fn(); } finally { LOC = o; } }

function parseNoteSK(s) {
  const m = /^([A-H])/.exec(s); if (!m) return null;
  const L = m[1], rest = s.slice(1);
  let acc = 0, len = 1, m2;
  const en = L === 'H' ? 'B' : L;
  if (L === 'B') acc = -1;                                   // Slovak B is B flat
  else if ((m2 = /^(isis|is)/.exec(rest))) { acc = m2[1] === 'is' ? 1 : 2; len += m2[0].length; }
  else if ((m2 = /^(eses|es)/.exec(rest)) && L !== 'E' && L !== 'A') { acc = m2[1] === 'es' ? -1 : -2; len += m2[0].length; }
  else if (L === 'E' || L === 'A') {
    if ((m2 = /^ses/.exec(rest))) { acc = -2; len += 3; }
    else if ((m2 = /^s(?!u)/.exec(rest))) { acc = -1; len += 1; }                     // Es, As (not “sus”)
  }
  if (len === 1) {
    const a = rest[0];
    if (a === '#' || a === '♯') { acc += 1; len++; } else if ((a === 'b' || a === '♭') && L !== 'B') { acc -= 1; len++; }
    else if ((a === 'b' || a === '♭') && L === 'B') { len++; }                          // “Bb” typed in Slovak: still B flat
  }
  const pc = mod(LETTER_PC[en] + acc, 12);
  return { pc, len, letter: en, name: en + (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc)) };
}
function parseNote(s) {
  if (LOC === 'sk') { const r = parseNoteSK(s); if (r) return r; }
  const m = /^([A-G])([#b♯♭]?)/.exec(s);
  if (!m) return null;
  let pc = LETTER_PC[m[1]];
  const a = m[2];
  if (a === '#' || a === '♯') pc++; else if (a === 'b' || a === '♭') pc--;
  return { pc: mod(pc, 12), len: m[0].length, letter: m[1],
           name: m[1] + (a === '♯' ? '#' : a === '♭' ? 'b' : a) };
}
/* English note name (C#, Bb, B) -> display name in the current locale */
function noteLoc(n) {
  if (LOC !== 'sk') return n;
  const m = /^([A-G])(##|#|bb|b|)$/.exec(n); if (!m) return n;
  const L = m[1], a = m[2], vowel = L === 'E' || L === 'A';
  if (L === 'B') return { '': 'H', b: 'B', bb: 'Heses', '#': 'His', '##': 'Hisis' }[a];
  if (a === '') return L;
  if (a === '#') return L + 'is'; if (a === '##') return L + 'isis';
  if (a === 'b') return L + (vowel ? 's' : 'es');
  return L + (vowel ? 'ses' : 'eses');
}
/* pitch class -> display name; in Slovak the black key between A and H is always “B” */
function pcLoc(pc, flats) { if (LOC === 'sk' && (pc === 10 || (pc === 3 && !flats))) return pc === 10 ? 'B' : 'Es'; return noteLoc((flats ? FLAT : SHARP)[pc]); }
/* English chord name (Am7, Bb/D) -> display name (Slovak: Ami7, B/D) */
function chordLoc(name) {
  if (LOC !== 'sk') return name;
  const r = withLocale('en', () => parseNote(name)); if (!r) return name;
  let rest = name.slice(r.len), bass = '';
  const i = rest.lastIndexOf('/');
  if (i >= 0) { const b = withLocale('en', () => parseNote(rest.slice(i + 1))); if (b && b.len === rest.length - i - 1) { bass = '/' + noteLoc(b.name); rest = rest.slice(0, i); } }
  return noteLoc(r.name) + rest.replace(/^m(?!aj|in|i|ol)/, 'mi') + bass;
}
/* re-spell a chord typed in one notation into the other */
function convert(str, from, to, flats) {
  if (from === to) return str;
  const r = withLocale(from, () => parseNote(str)); if (!r) return str;
  let rest = str.slice(r.len), bass = '';
  const i = rest.lastIndexOf('/');
  if (i >= 0) { const b = withLocale(from, () => parseNote(rest.slice(i + 1))); if (b && b.len === rest.length - i - 1) { bass = '/' + withLocale(to, () => noteLoc(b.name)); rest = rest.slice(0, i); } }
  if (to === 'sk') rest = rest.replace(/^m(?!aj|in|i|ol)/, 'mi');                 // Am -> Ami when an English song is shown in Slovak
  return withLocale(to, () => noteLoc(r.name)) + rest + bass;
}

/* ---------- chord suffix -> tones ---------- */
function parseSuffix(raw) {
  let t = raw.replace(/[()\s,]/g, '').replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[△∆]/g, 'Δ').replace(/[−–]/g, '-').replace(/ᵒ/g, '°');
  let minor = false, dim = false, aug = false, half = false, maj = false, m;
  t = t.replace(/^dur/, '');                                  // Slovak “dur” = major

  if ((m = /^(dim|°|o)/.exec(t))) { dim = true; t = t.slice(m[0].length); }
  else if ((m = /^(aug|\+)(?!5)/.exec(t))) { aug = true; t = t.slice(m[0].length); }
  else if (/^[øØ]/.test(t)) { half = true; minor = true; t = t.slice(1); }
  else {
    if ((m = /^(maj|Maj|MAJ|Δ|M(?!i))/.exec(t))) { maj = true; t = t.slice(m[0].length); }
    else if ((m = /^(moll|mol|min|mi|m|-)(?!5)/.exec(t))) {
      minor = true; t = t.slice(m[0].length);
      if ((m = /^(maj|Maj|MAJ|Δ|M)/.exec(t))) { maj = true; t = t.slice(m[0].length); }
    }
  }
  let N = null;
  if ((m = /^(69|13|11|9|7|6|5|4|2)/.exec(t))) { N = +m[1]; t = t.slice(m[0].length); }

  let sus = null, no3 = false, no5 = false, alt = false;
  const adds = [], alts = [];
  while (t.length) {
    if ((m = /^add(b|#)?(2|4|6|9|11|13)/.exec(t))) adds.push({ acc: m[1] || '', n: +m[2] });
    else if ((m = /^(b|#)(5|9|11|13)/.exec(t))) alts.push({ acc: m[1], n: +m[2] });
    else if ((m = /^-5/.exec(t))) alts.push({ acc: 'b', n: 5 });
    else if ((m = /^\+5/.exec(t))) alts.push({ acc: '#', n: 5 });
    else if ((m = /^sus(2|4)?/.exec(t))) sus = m[1] ? +m[1] : 4;
    else if ((m = /^(no|omit)(3|5)/.exec(t))) { if (m[2] === '3') no3 = true; else no5 = true; }
    else if ((m = /^alt/.exec(t))) alt = true;
    else if ((m = /^(maj|M|Δ)(?=7|9|11|13|$)/.exec(t))) maj = true;
    else return { error: 'I don’t recognise “' + t + '” in that chord' };
    t = t.slice(m[0].length);
  }

  if (half && N == null) N = 7;
  if (alt && N == null) N = 7;
  if (N === 4) { sus = 4; N = null; }
  if (N === 2) { adds.push({ acc: '', n: 9 }); N = null; }
  if (maj && !(N === 7 || N === 9 || N === 11 || N === 13)) maj = false;

  const hasSeventh = N === 7 || N === 9 || N === 11 || N === 13;
  const tones = [];
  const add = (semi, label, deg, o) => tones.push(Object.assign({ semi, label, deg, req: true, core: false, alt: false }, o || {}));

  add(0, '1', 1, { core: true });

  let fifth = (dim || half) ? 6 : aug ? 8 : 7;
  const extras = [];
  for (const a of alts) if (a.n === 5) fifth = a.acc === 'b' ? 6 : 8;
  for (const a of alts) if (a.n !== 5) extras.push(a);
  if (alt) { extras.push({ acc: 'b', n: 9 }, { acc: '#', n: 9 }, { acc: '#', n: 11 }, { acc: 'b', n: 13 }); no5 = true; }
  const fifthAlt = fifth !== 7;
  const has = (acc, n) => extras.some(e => e.acc === acc && e.n === n) || adds.some(e => e.acc === acc && e.n === n);
  const hasN = n => extras.some(e => e.n === n) || adds.some(e => e.n === n && e.acc);

  // third / sus
  if (N === 5) { /* power chord: no third */ }
  else if (sus) add(sus === 2 ? 2 : 5, 'sus' + sus, sus, { core: true });
  else if (!no3) {
    const third = (minor || dim) ? 3 : 4;
    add(third, third === 3 ? 'b3' : '3', 3, { core: true, req: !(N === 11 && !minor && !maj) });
  }
  // fifth
  if (!no5) {
    const plain = !hasSeventh && !(N === 6 || N === 69) && !fifthAlt;
    add(fifth, fifth === 7 ? '5' : fifth === 6 ? 'b5' : '#5', 5, { req: N === 5 || fifthAlt || plain, alt: fifthAlt });
  }
  // seventh
  if (hasSeventh) {
    const s = maj ? 11 : (dim && !half) ? 9 : 10;
    add(s, maj ? '7' : s === 9 ? 'bb7' : 'b7', 7, { core: true });
  }
  if (N === 6 || N === 69) add(9, '6', 6);
  if (N >= 9 && N !== 69 && !hasN(9)) add(2, '9', 9, { req: N === 9 });
  if (N === 69) add(2, '9', 9);
  if (N === 11 && !has('#', 11) && !sus) add(5, '11', 11);
  if (N === 13 && !has('b', 13)) add(9, '13', 13);

  for (const a of adds) {
    const map = { 2: 2, 9: 2, 4: 5, 11: 5, 6: 9, 13: 9 };
    const semi = map[a.n] + (a.acc === '#' ? 1 : a.acc === 'b' ? -1 : 0);
    const deg = a.n === 2 ? 9 : a.n === 4 ? 11 : a.n === 6 ? 13 : a.n;
    add(mod(semi, 12), (a.acc || '') + (deg === 13 ? '13' : String(deg)), deg, { alt: !!a.acc, addTone: true });
  }
  for (const a of extras) {
    const base = { 9: 2, 11: 5, 13: 9 }[a.n];
    add(mod(base + (a.acc === '#' ? 1 : -1), 12), a.acc + a.n, a.n, { alt: true });
  }

  // dedupe by pitch class, first wins (keeps stricter flags)
  const seen = new Map();
  for (const x of tones) {
    const k = mod(x.semi, 12);
    if (!seen.has(k)) seen.set(k, x);
    else { const p = seen.get(k); p.req = p.req || x.req; p.core = p.core || x.core; }
  }
  const list = [...seen.values()].sort((a, b) => a.deg - b.deg || a.semi - b.semi);
  return { tones: list, flags: { minor, dim, aug, half, maj, sus, N } };
}

function spell(rootLetter, rootPc, tone, rootFlat) {
  const deg = tone.deg;
  const letter = LETTERS[(LETTERS.indexOf(rootLetter) + deg - 1) % 7];
  const pc = mod(rootPc + tone.semi, 12);
  let diff = mod(pc - LETTER_PC[letter] + 6, 12) - 6;
  if (Math.abs(diff) >= 2) return (rootFlat ? FLAT : SHARP)[pc];
  return letter + (diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff));
}

function parseChord(input) {
  const s = String(input || '').trim();
  if (!s) return { ok: false, error: 'Type a chord, for example Am7, F#m7b5 or Cmaj9/E' };
  const r = parseNote(s);
  if (!r) return { ok: false, error: 'A chord starts with a note name, A to G' };
  let rest = s.slice(r.len).replace(/6\/9/, '69');
  let bass = null;
  const sl = rest.lastIndexOf('/');
  if (sl >= 0) {
    const b = parseNote(rest.slice(sl + 1));
    if (!b || b.len !== rest.length - sl - 1) return { ok: false, error: 'After the slash I expect a bass note, like C/E' };
    bass = b; rest = rest.slice(0, sl);
  }
  const q = parseSuffix(rest);
  if (q.error) return { ok: false, error: q.error };

  const tones = q.tones.map(t => ({
    pc: mod(r.pc + t.semi, 12), semi: t.semi, label: t.label, deg: t.deg,
    req: t.req, core: t.core, alt: t.alt,
    name: spell(r.letter, r.pc, t, /b$/.test(r.name) || r.name === 'F')
  }));
  if (bass) {
    const ex = tones.find(t => t.pc === bass.pc);
    if (ex) { ex.req = true; ex.name = bass.name; }
    else tones.push({ pc: bass.pc, semi: mod(bass.pc - r.pc, 12), label: 'bass', deg: 99, req: true, core: false, alt: true, name: bass.name });
  }
  return {
    ok: true, input: s, root: { pc: r.pc, name: r.name, letter: r.letter },
    bass: bass ? { pc: bass.pc, name: bass.name } : null,
    suffix: rest, tones,
    notes: tones.map(t => t.name), formula: tones.map(t => t.label),
    flags: q.flags
  };
}

/* ---------- fingering ---------- */
function fingering(frets) {
  const fretted = [];
  frets.forEach((f, s) => { if (f > 0) fretted.push({ s, f }); });
  const fingers = frets.map(() => 0);
  if (!fretted.length) return { fingers, barre: null, count: 0 };
  const minF = Math.min(...fretted.map(x => x.f));
  const atMin = fretted.filter(x => x.f === minF);
  let barre = null;
  if (atMin.length >= 2) {
    const s1 = atMin[0].s, s2 = atMin[atMin.length - 1].s;
    if (s2 - s1 >= 3) {
      let ok = true;
      for (let s = s1; s <= s2; s++) if (frets[s] < minF) ok = false;
      if (ok) barre = { fret: minF, from: s1, to: s2 };
    }
  }
  let next = 1;
  if (barre) { for (let s = barre.from; s <= barre.to; s++) if (frets[s] === minF) fingers[s] = 1; next = 2; }
  const rest = fretted.filter(x => !fingers[x.s]).sort((a, b) => a.f - b.f || a.s - b.s);
  rest.forEach(x => { fingers[x.s] = next++; });
  return { fingers, barre, count: next - 1 };
}

/* ---------- voicing search ---------- */
function findVoicings(chord, tuning, opts) {
  opts = opts || {};
  const maxN = opts.max || 12, maxFret = opts.maxFret || 15;
  const allowed = new Map();
  chord.tones.forEach(t => { if (!allowed.has(t.pc)) allowed.set(t.pc, t); });
  const bassPc = chord.bass ? chord.bass.pc : chord.root.pc;
  const slash = !!chord.bass;
  const minNotes = chord.tones.length >= 3 ? 3 : 2;
  const found = new Map();

  function search(level) {
    let req = chord.tones.filter(t => level === 0 ? t.req : level === 1 ? (t.core || t.alt) : t.core);
    if (level >= 2 && slash) req = req.filter(t => t.pc !== chord.root.pc || true);
    const reqPcs = [...new Set(req.map(t => t.pc))];
    const lastLo = Math.max(1, maxFret - 3);
    for (let lo = 1; lo <= lastLo; lo++) {
      const opt = tuning.map(open => {
        const o = [-1];
        if (lo <= 4 && allowed.has(open % 12)) o.push(0);
        for (let f = lo; f <= lo + 3; f++) if (allowed.has((open + f) % 12)) o.push(f);
        return o;
      });
      const cur = [-1, -1, -1, -1, -1, -1];
      const rec = s => {
        if (s === 6) { evaluate(cur.slice(), level, reqPcs, lo); return; }
        for (const f of opt[s]) {
          if (f >= 0) {
            const firstSounded = cur.slice(0, s).every(x => x < 0);
            if (firstSounded && level < 3 && (tuning[s] + f) % 12 !== bassPc) continue;
          }
          cur[s] = f; rec(s + 1);
        }
        cur[s] = -1;
      };
      rec(0);
    }
  }

  function evaluate(frets, level, reqPcs, lo) {
    const key = frets.join(',');
    if (found.has(key)) return;
    const sounded = [];
    frets.forEach((f, s) => { if (f >= 0) sounded.push(s); });
    if (sounded.length < minNotes) return;
    const first = sounded[0], last = sounded[sounded.length - 1];
    let inner = 0;
    for (let s = first; s <= last; s++) if (frets[s] < 0) inner++;
    if (inner > 1) return;
    const pcs = new Set(sounded.map(s => (tuning[s] + frets[s]) % 12));
    for (const p of reqPcs) if (!pcs.has(p)) return;
    const fg = fingering(frets);
    if (fg.count > 4) return;
    if (level === 0 && chord.tones.some(t => t.req && !pcs.has(t.pc))) return;

    const opens = frets.filter(f => f === 0).length;
    const omits = chord.tones.filter(t => !pcs.has(t.pc)).map(t => t.label);
    let score = Math.min(sounded.length, 5) * 2 + (sounded.length >= 4 ? 2 : 0) - inner * 6 - fg.count * 2.5 - (fg.barre ? 3 : 0)
      - lo * 1.2 + opens * 1.0 + (4 - omits.length) * 0.8 - level * 8;
    if ((tuning[first] + frets[first]) % 12 === chord.root.pc) score += 3;
    const fretted = frets.filter(f => f > 0);
    const maxF = fretted.length ? Math.max(...fretted) : 0;
    const minF = fretted.length ? Math.min(...fretted) : 0;
    found.set(key, {
      frets, fingers: fg.fingers, barre: fg.barre, fingerCount: fg.count,
      base: maxF <= 5 ? 1 : minF, pos: minF, score, omits, level,
      notes: frets.map((f, s) => f < 0 ? null : allowed.get((tuning[s] + f) % 12))
    });
  }

  for (let level = 0; level <= 3; level++) {
    search(level);
    if (found.size >= 6) break;
  }
  const all = [...found.values()].sort((a, b) => b.score - a.score);
  const picked = [];
  for (const v of all) {
    if (picked.length >= maxN) break;
    const dup = picked.some(p => p.frets.filter((f, i) => f === v.frets[i]).length >= 5);
    if (!dup) picked.push(v);
  }
  picked.forEach((v, i) => { v.rank = i; });
  picked.sort((a, b) => a.pos - b.pos || b.score - a.score);
  return picked;
}

const vKey = v => v.frets.map(f => f < 0 ? 'x' : f).join('-');

/* ---------- transposition ---------- */
function transposeChord(str, n, flats) {
  const r = parseNote(str);
  if (!r) return str;
  let rest = str.slice(r.len), bass = '';
  const i = rest.lastIndexOf('/');
  if (i >= 0) {
    const b = parseNote(rest.slice(i + 1));
    if (b && b.len === rest.length - i - 1) { bass = '/' + pcLoc(mod(b.pc + n, 12), flats); rest = rest.slice(0, i); }
  }
  return pcLoc(mod(r.pc + n, 12), flats) + rest + bass;
}

/* ---------- song parsing ---------- */
const SECTION_RE = /^[\[(]?\s*(verse|chorus|bridge|intro|outro|pre-?chorus|solo|interlude|refrain|instrumental|tag|coda|hook|riff|refr[eé]n|sloha|predohra|medzihra|dohra|most[ií]k|s[oó]lo|prechod|zbor)\b[^\n]{0,24}$/i;

function chordLine(line) {
  if (!line.trim()) return null;
  const chords = [];
  for (const m of line.matchAll(/\S+/g)) {
    const w = m[0];
    if (/^[|:\-–%/\\.]+$/.test(w) || /^\(?x\d+\)?$/i.test(w) || /^N\.?C\.?$/i.test(w) || /^[\[\]()]+$/.test(w)) continue;
    const c = w.replace(/^[\[(]+|[\])]+$/g, '');
    if (!parseChord(c).ok) return null;
    chords.push({ c, col: m.index });
  }
  return chords.length ? chords : null;
}

function parseSong(raw) {
  const lines = String(raw || '').replace(/\r/g, '').replace(/\t/g, '    ').split('\n');
  const out = [], meta = {};
  const isDirective = l => /^\s*\{.*\}\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    let ln = lines[i];
    const lab = /^\s*([A-Za-z][\w -]{0,20}):\s+(\S.*)$/.exec(ln);
    if (lab && SECTION_RE.test(lab[1]) && chordLine(lab[2])) { out.push({ t: 'sec', text: lab[1].trim() }); ln = lab[2]; }
    let d = /^\s*\{\s*([\w]+)\s*:?\s*(.*?)\s*\}\s*$/.exec(ln);
    if (d) {
      const k = d[1].toLowerCase(), v = d[2];
      if (k === 'title' || k === 't') meta.title = v;
      else if (k === 'artist' || k === 'subtitle' || k === 'st' || k === 'a') meta.artist = v;
      else if (k === 'key') meta.key = v;
      else if (['comment', 'c', 'ci', 'cb'].includes(k)) out.push({ t: 'sec', text: v });
      else if (k === 'soc' || k === 'start_of_chorus') out.push({ t: 'sec', text: v || 'Chorus' });
      else if (k === 'sov' || k === 'start_of_verse') out.push({ t: 'sec', text: v || 'Verse' });
      else if (k === 'sob' || k === 'start_of_bridge') out.push({ t: 'sec', text: v || 'Bridge' });
      continue;
    }
    if (!ln.trim()) { out.push({ t: 'blank' }); continue; }
    const sb = /^\s*\[([^\]]+)\]\s*:?\s*$/.exec(ln);
    if (sb && !parseChord(sb[1].trim()).ok) { out.push({ t: 'sec', text: sb[1].trim() }); continue; }
    const inline = /\[[^\]]+\]/.test(ln) && [...ln.matchAll(/\[([^\]]+)\]/g)].some(m => parseChord(m[1].trim()).ok);
    if (inline) {
      const segs = []; let last = 0, m; const re = /\[([^\]]*)\]/g;
      let pendingChord = null;
      if (!/^\s*\[/.test(ln)) { /* leading text before first chord */ }
      while ((m = re.exec(ln))) {
        const before = ln.slice(last, m.index);
        if (before || pendingChord !== null) { segs.push({ c: pendingChord, x: before }); }
        else if (m.index > 0) segs.push({ c: null, x: before });
        pendingChord = parseChord(m[1].trim()).ok ? m[1].trim() : null;
        if (pendingChord === null) { segs.push({ c: null, x: '' }); }
        last = m.index + m[0].length;
      }
      segs.push({ c: pendingChord, x: ln.slice(last) });
      out.push({ t: 'ln', segs: segs.filter(s => s.c || s.x)});
      continue;
    }
    if (ln.trim().length < 40 && SECTION_RE.test(ln.trim()) && !chordLine(ln)) {
      out.push({ t: 'sec', text: ln.trim().replace(/^[\[(]|[\]):]+$/g, '').replace(/:$/, '') }); continue;
    }
    const ch = chordLine(ln);
    if (ch) {
      const nx = lines[i + 1];
      const nextIsLyric = nx != null && nx.trim() && !chordLine(nx) && !isDirective(nx)
        && !(/^\s*\[[^\]]+\]\s*:?\s*$/.test(nx)) && !SECTION_RE.test(nx.trim());
      const segs = [];
      if (nextIsLyric) {
        if (ch[0].col > 0) segs.push({ c: null, x: nx.slice(0, ch[0].col) });
        ch.forEach((c, k) => {
          const end = k + 1 < ch.length ? ch[k + 1].col : nx.length;
          segs.push({ c: c.c, x: nx.slice(c.col, Math.max(end, c.col)) });
        });
        i++;
      } else ch.forEach(c => segs.push({ c: c.c, x: '' }));
      out.push({ t: 'ln', segs, instrumental: !nextIsLyric });
      continue;
    }
    out.push({ t: 'ln', segs: [{ c: null, x: ln }] });
  }
  // collapse repeated blanks / trim
  const clean = [];
  for (const l of out) { if (l.t === 'blank' && (!clean.length || clean[clean.length - 1].t === 'blank')) continue; clean.push(l); }
  while (clean.length && clean[clean.length - 1].t === 'blank') clean.pop();
  return { meta, lines: clean };
}

function songChords(song, semis, flats) {
  const set = new Set();
  song.lines.forEach(l => l.segs && l.segs.forEach(s => { if (s.c) set.add(transposeChord(s.c, semis || 0, flats)); }));
  return [...set];
}

/* ---------- theory ---------- */
const SUF_ALL = ['', 'm', '7', 'maj7', 'm7', '6', 'm6', '9', 'm9', 'maj9', 'add9', 'madd9', 'sus2', 'sus4', '7sus4', 'dim', 'dim7', 'm7b5', 'aug', 'aug7',
  '5', '11', 'm11', '13', 'm13', '69', '7b9', '7#9', '7#11', '7b5', '7#5', 'maj7#11', 'mMaj7', 'maj13', '9sus4', '13sus4', 'add11', '7b13'];
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const DEG_NAT = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11, 9: 2, 11: 5, 13: 9 };
const CIRCLE = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
const IV_NAME = {
  '1': 'Root (perfect unison)', 'b3': 'Minor third', '3': 'Major third', 'sus2': 'Major second', 'sus4': 'Perfect fourth',
  'b5': 'Diminished fifth (tritone)', '5': 'Perfect fifth', '#5': 'Augmented fifth', '6': 'Major sixth', 'bb7': 'Diminished seventh',
  'b7': 'Minor seventh', '7': 'Major seventh', 'b9': 'Minor ninth', '9': 'Major ninth', '#9': 'Augmented ninth', '11': 'Perfect eleventh',
  '#11': 'Augmented eleventh', 'b13': 'Minor thirteenth', '13': 'Major thirteenth', 'bass': 'Bass note (slash chord)'
};
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function toneRole(l) {
  if (l === '1') return 'Anchor: the note the chord is named after.';
  if (l === '3') return 'Decides the mood: a major third makes it major, bright.';
  if (l === 'b3') return 'Decides the mood: a minor third makes it minor, darker.';
  if (l === 'sus2' || l === 'sus4') return 'Stands in for the third, so the chord is neither major nor minor.';
  if (l === '5') return 'Stabiliser. Adds fullness, and is the first note players drop.';
  if (l === 'b5' || l === '#5') return 'Altered fifth: bends the stability of the chord, adds tension.';
  if (l === 'b7') return 'Colour note. With a major third it creates the pull that wants to resolve.';
  if (l === '7') return 'Colour note. A major seventh sounds smooth and dreamy.';
  if (l === 'bb7') return 'Fully diminished seventh: tense, symmetrical sound.';
  if (l === '6') return 'Sweet colour note, a calmer alternative to the seventh.';
  if (l === 'bass') return 'Different lowest note than the root (an inversion or slash chord).';
  if (/^(b|#)/.test(l)) return 'Altered tension note: spicy colour on top of the chord.';
  return 'Extension: another third stacked on top of the seventh. Adds richness.';
}

function chordFamily(L, flags) {
  const has = x => L.has(x);
  const third = has('3'), mthird = has('b3');
  if (has('sus2') || has('sus4')) return { key: 'sus', title: 'Suspended chord',
    blurb: 'The third is replaced by a second (sus2) or a fourth (sus4). Without a third the chord is neither major nor minor, so it hangs in the air and wants to resolve.',
    tips: 'Common as a moment of tension before the plain major or minor chord: Dsus4 → D. Also great as a floating, open sound in folk and rock.' };
  if (mthird && has('b5') && has('bb7')) return { key: 'dim7', title: 'Diminished seventh chord',
    blurb: 'A stack of three minor thirds (3 semitones each). It is perfectly symmetrical: the same four notes repeat every 3 semitones, so each diminished seventh chord has four different names.',
    tips: 'Used as a passing chord that connects two chords. Dim7 chords slide up or down by frets and still sound correct.' };
  if (mthird && has('b5') && has('b7')) return { key: 'hdim', title: 'Half-diminished chord (m7♭5)',
    blurb: 'A diminished triad with a minor seventh. It is the ii chord of a minor key, soft but unstable.',
    tips: 'Typically the ii chord in a minor ii–V–i progression: Bm7♭5 → E7 → Am.' };
  if (mthird && has('b5')) return { key: 'dim', title: 'Diminished triad',
    blurb: 'Two minor thirds stacked, which makes a tritone (6 semitones) between root and fifth. Very tense and unstable.',
    tips: 'Rare as a stand-alone chord; used to lead into the next chord.' };
  if (third && has('#5')) return { key: 'aug', title: 'Augmented chord',
    blurb: 'Two major thirds stacked, a raised fifth. It is symmetrical: the same three notes repeat every 4 semitones, so each augmented chord has three names.',
    tips: 'Creates floating tension, often right before resolving to the I chord.' };
  if (mthird && has('7')) return { key: 'mmaj7', title: 'Minor-major seventh chord',
    blurb: 'A minor triad with a major seventh: the dark minor third sits against a bright seventh. Cinematic, mysterious.',
    tips: 'Think of spy-film themes: Am(maj7) to Am7 to Am6 is a classic descending line.' };
  if (mthird && has('b7')) return { key: 'm7', title: 'Minor seventh family',
    blurb: 'A minor triad plus a minor seventh. Softer and more relaxed than a plain minor chord. Higher extensions (9, 11, 13) add colour.',
    tips: 'The ii, iii and vi chords of a major key. A jazz favourite: ii7 – V7 – Imaj7.' };
  if (mthird) return { key: 'minor', title: 'Minor chord',
    blurb: 'Root, minor third, perfect fifth. The minor third (3 semitones) gives the sad, serious or tender colour.',
    tips: 'The ii, iii and vi chords of a major key, and the i, iv chords of a minor key.' };
  if (third && has('7')) return { key: 'maj7', title: 'Major seventh family',
    blurb: 'A major triad plus a major seventh, one half step below the octave. Dreamy, warm, slightly wistful.',
    tips: 'The I and IV chords of a major key. A staple of jazz, bossa nova and soft pop.' };
  if (third && has('b7')) return { key: 'dom', title: 'Dominant seventh family',
    blurb: 'A major triad with a minor seventh. Between the major third and the minor seventh sits a tritone, the most unstable interval, which creates a strong pull to resolve.',
    tips: 'Built on the 5th note of a key (V7), it pulls home: G7 → C. In blues, 7 chords are used on I, IV and V.' };
  if (third && has('6')) return { key: 'six', title: 'Sixth chord',
    blurb: 'A major triad plus a major sixth. Sweet and settled, a calmer alternative to the major seventh.',
    tips: 'Often used as a gentle ending chord, or a tonic in swing and country.' };
  if (third) return { key: 'major', title: 'Major chord',
    blurb: 'Root, major third, perfect fifth. The major third (4 semitones) gives the bright, stable, happy sound.',
    tips: 'The I, IV and V chords of a major key: the three chords of countless songs.' };
  if (has('5')) return { key: 'power', title: 'Power chord',
    blurb: 'Just the root and the fifth. With no third it is neither major nor minor, so it fits either, and it stays clear under distortion.',
    tips: 'The backbone of rock and punk. Play it on two or three strings.' };
  return { key: 'other', title: 'Custom chord', blurb: 'A chord built from the notes shown below.', tips: '' };
}

function theory(chord, flats) {
  const names = flats ? FLAT : SHARP, r = chord.root;
  const L = new Set(chord.tones.map(t => t.label));
  const fam = chordFamily(L, chord.flags);
  const major = [];
  const ri = LETTERS.indexOf(r.letter);
  for (let i = 0; i < 7; i++) {
    const letter = LETTERS[(ri + i) % 7], pc = mod(r.pc + MAJ[i], 12), d = mod(pc - LETTER_PC[letter] + 6, 12) - 6;
    major.push(Math.abs(d) >= 2 ? names[pc] : letter + (d > 0 ? '#' : d < 0 ? 'b' : ''));
  }
  const tones = chord.tones.map(t => {
    const nat = DEG_NAT[t.deg], diff = nat == null ? 0 : mod(t.semi - nat + 6, 12) - 6;
    const high = t.deg >= 9 && t.deg !== 99 && !/^sus/.test(t.label);
    return { label: t.label, name: t.name, deg: t.deg, interval: IV_NAME[t.label] || '', semis: t.semi + (high ? 12 : 0), role: toneRole(t.label), diff, optional: !t.req };
  });
  const altered = tones.filter(t => t.diff !== 0 && t.deg !== 99);
  const degs = tones.filter(t => t.deg !== 99).map(t => t.deg);
  const sort = tones.filter(t => /^(1|b3|3|b5|5|#5|bb7|b7|7)$/.test(t.label)).sort((a, b) => a.deg - b.deg);
  let stack = null;
  if (sort.length >= 3 && sort.length === tones.filter(t => t.deg !== 99 && !/^(add)/.test(t.label)).length) {
    stack = [];
    for (let i = 0; i < sort.length - 1; i++) {
      const gap = mod(sort[i + 1].semis - sort[i].semis, 12);
      stack.push({ from: sort[i].name, to: sort[i + 1].name, gap, kind: gap === 4 ? 'major third' : gap === 3 ? 'minor third' : gap === 2 ? 'major second' : gap === 5 ? 'perfect fourth' : gap + ' semitones' });
    }
  }
  // diatonic homes in major keys
  const sfx = chord.suffix;
  let rs = sfx;
  if (chord.flags.dim) rs = sfx.replace(/^(dim|°|o)/, '°');
  else if (chord.flags.half) rs = sfx.replace(/^(m7b5|ø|Ø)/, 'ø7');
  else if (chord.flags.minor) rs = sfx.replace(/^(min|mi|m|-)/, '');
  else if (chord.flags.aug) rs = sfx.replace(/^(aug|\+)/, '+');
  const lower = chord.flags.minor || chord.flags.dim || chord.flags.half;
  const keys = [];
  CIRCLE.forEach(k => {
    const sc = MAJ.map(x => mod(k + x, 12));
    if (!chord.tones.every(t => sc.includes(t.pc))) return;
    const idx = sc.indexOf(r.pc); if (idx < 0) return;
    keys.push({ key: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][k], roman: (lower ? ROMAN[idx].toLowerCase() : ROMAN[idx]) + rs });
  });
  // same notes, other names
  const mine = [...new Set(chord.tones.map(t => t.pc))].sort().join(',');
  const myName = r.name + sfx, same = [];
  for (let k = 0; k < 12; k++) for (const s of SUF_ALL) {
    const c = withLocale('en', () => parseChord(names[k] + s)); if (!c.ok) continue;
    if ([...new Set(c.tones.map(t => t.pc))].sort().join(',') === mine && names[k] + s !== myName && !(names[k] === r.name && s === sfx)) same.push(names[k] + s);
  }
  return { family: fam, scale: major, degs, altered, tones, stack, keys, same: same.slice(0, 6), notes: tones.map(t => t.name) };
}

g.Fretwork = { setLocale, locale, withLocale, noteLoc, pcLoc, chordLoc, convert, theory, SUF_ALL, SHARP, FLAT, TUNINGS, parseNote, parseChord, findVoicings, fingering, vKey,
               transposeChord, parseSong, songChords, mod };
if (typeof module !== 'undefined') module.exports = g.Fretwork;
})(typeof window !== 'undefined' ? window : globalThis);
