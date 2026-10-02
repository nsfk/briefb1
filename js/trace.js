/* B1 Schreibtrainer - tracing mode ("viết in vết"): what the learner types is compared with the model answer.
 * Browser: window.B1Trace. Node: module.exports (test/trace.test.mjs).
 *
 * Words are matched by position (word k typed <-> word k of the model), like a typing tutor; inside a word the
 * characters are aligned with an edit distance, so one skipped letter does not turn the rest of the word red and
 * "ss" for "ß" or "ue" for "ü" counts as ONE umlaut/ß error. Every error gets a category:
 *   case   - capital / small letter (anna -> Anna)
 *   punct  - punctuation: wrong, missing or extra (Anna -> Anna,)
 *   uml    - umlaut / ß (Grusse, Grüsse, Gruesse -> Grüße)
 *   letter - another letter
 *   missing / extra - a letter left out / added
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.B1Trace = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const INVIS = /[­​-‍⁠﻿]/g;
  const PUNCT = /^[.,;:!?„“”"'‚‘’«»()[\]{}\-–—…/]$/u;
  // typographic variants that are not spelling: typing ' for ’ or - for – is fine
  const SAME = { '’': "'", '‘': "'", '‚': "'", '´': "'", '`': "'", '“': '"', '”': '"', '„': '"', '«': '"', '»': '"', '–': '-', '—': '-', ' ': ' ' };
  const norm = ch => SAME[ch] || ch;
  const base = ch => ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 's');
  // two typed letters for one model letter (and back): the usual ways to write without umlaut keys
  const PAIRS = { 'ß': 'ss', 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue' };

  function chars(s) { return Array.from(s); }

  /* ---------- the model: words + line breaks after each word ---------- */
  function prepare(model) {
    const text = String(model || '').normalize('NFC').replace(/\r\n?/g, '\n').replace(INVIS, '').replace(/ /g, ' ').trim();
    const words = [];
    const re = /\S+/g;
    let m, last = 0;
    while ((m = re.exec(text))) {
      if (words.length) words[words.length - 1].br = Math.min(2, (text.slice(last, m.index).match(/\n/g) || []).length);
      words.push({ w: m[0], br: 0 });
      last = m.index + m[0].length;
    }
    return { text, words };
  }

  /* ---------- what was typed: whole words + the word in progress ---------- */
  function splitTyped(typed) {
    const t = String(typed || '').normalize('NFC').replace(INVIS, '');
    const words = t.split(/\s+/).filter(Boolean);
    const open = words.length > 0 && !/\s$/.test(t);       // the last word is still being typed
    return { words, open };
  }

  /* ---------- one word: alignment ---------- */
  function subCost(e, t) {
    if (e === t || norm(e) === norm(t)) return 0;
    if (e.toLowerCase() === t.toLowerCase()) return 0.5;
    if (base(e) === base(t) && /\p{L}/u.test(e)) return 0.6;
    return 1;
  }
  function category(e, t) {
    if (e.toLowerCase() === t.toLowerCase()) return 'case';
    if (PUNCT.test(e) || PUNCT.test(t)) return 'punct';
    if (base(e) === base(t)) return 'uml';
    return 'letter';
  }
  // done = the word is finished (a space followed): every model letter must be there.
  // open = still typing: the rest of the model word is not an error yet ("ghost").
  function compareWord(expected, typed, done) {
    const E = chars(expected), T = chars(typed), m = E.length, n = T.length;
    const INF = 1e9, W = m + 1;
    const D = new Float64Array((n + 1) * W).fill(INF), B = new Int8Array((n + 1) * W);
    // B: 1 = match/sub, 2 = extra typed char, 3 = missing model char, 4 = two typed for one model, 5 = one typed for two model
    D[0] = 0;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= m; j++) {
        const here = D[i * W + j];
        if (here >= INF) continue;
        const relax = (ii, jj, c, op) => { const k = ii * W + jj; if (here + c < D[k] - 1e-9) { D[k] = here + c; B[k] = op; } };
        if (i < n && j < m) relax(i + 1, j + 1, subCost(E[j], T[i]), 1);
        if (i < n) relax(i + 1, j, 1, 2);
        if (j < m) relax(i, j + 1, 1, 3);
        if (j < m && i + 1 < n && PAIRS[E[j]] && (T[i] + T[i + 1]).toLowerCase() === PAIRS[E[j]].toLowerCase()) relax(i + 2, j + 1, 0.6, 4);
        if (i < n && j + 1 < m && PAIRS[T[i]] && (E[j] + E[j + 1]).toLowerCase() === PAIRS[T[i]].toLowerCase()) relax(i + 1, j + 2, 0.6, 5);
      }
    }
    // where the typed letters end in the model word
    let endJ = m;
    if (!done) {                                             // cheapest reading; on a tie the one where typed and model
      endJ = 0;                                              // letters line up position by position (instant, predictable)
      for (let j = 1; j <= m; j++) {
        const c = D[n * W + j], best = D[n * W + endJ];
        if (c < best - 1e-9 || (Math.abs(c - best) <= 1e-9 && Math.abs(j - n) < Math.abs(endJ - n))) endJ = j;
      }
    }
    // walk back
    const ops = [];
    let i = n, j = endJ;
    while (i > 0 || j > 0) {
      const op = B[i * W + j];
      if (op === 1) { ops.push({ op, e: E[j - 1], t: T[i - 1] }); i--; j--; }
      else if (op === 2) { ops.push({ op, t: T[i - 1] }); i--; }
      else if (op === 3) { ops.push({ op, e: E[j - 1] }); j--; }
      else if (op === 4) { ops.push({ op, e: E[j - 1], t: T[i - 2] + T[i - 1] }); i -= 2; j--; }
      else if (op === 5) { ops.push({ op, e: E[j - 2] + E[j - 1], t: T[i - 1] }); i--; j -= 2; }
      else break;                                            // (0,0)
    }
    ops.reverse();
    const items = [], cats = { case: 0, punct: 0, uml: 0, letter: 0, missing: 0, extra: 0 };
    let ok = 0, errors = 0;
    const err = c => { cats[c]++; errors++; };
    for (const o of ops) {
      if (o.op === 1) {
        if (subCost(o.e, o.t) === 0) { items.push({ ch: o.e, cls: 'ok' }); ok++; }
        else { const c = category(o.e, o.t); items.push({ ch: o.e, cls: c, typed: o.t }); err(c); }
      } else if (o.op === 2) {
        const c = PUNCT.test(o.t) ? 'punct' : 'extra';
        items.push({ ch: o.t, cls: 'extra', cat: c }); err(c);
      } else if (o.op === 3) {
        const c = PUNCT.test(o.e) ? 'punct' : 'missing';
        items.push({ ch: o.e, cls: 'miss', cat: c }); err(c);
      } else {                                               // ss/ß, ue/ü ...: one umlaut/ß error
        const ex = chars(o.e);
        ex.forEach((ch, k) => items.push(k ? { ch, cls: 'uml', cont: true } : { ch, cls: 'uml', typed: o.t }));
        err('uml');
      }
    }
    for (let k = endJ; k < m; k++) items.push({ ch: E[k], cls: 'ghost' });
    return { items, ok, errors, cats, caret: done ? -1 : items.length - (m - endJ) };
  }

  /* ---------- the whole text ---------- */
  function emptyCats() { return { case: 0, punct: 0, uml: 0, letter: 0, missing: 0, extra: 0 }; }
  // cache (optional Map, kept by the caller while the model stays the same): unchanged words are not compared again,
  // so a keystroke costs one word, not the whole letter
  function compareAll(prep, typed, cache) {
    const { words: tw, open } = splitTyped(typed);
    if (cache && cache.size > 20000) cache.clear();
    const memo = (key, make) => { if (!cache) return make(); let v = cache.get(key); if (!v) { v = make(); cache.set(key, v); } return v; };
    const pw = prep.words;
    const res = [], cats = emptyCats();
    let ok = 0, errors = 0, wrongWords = 0;
    const doneCount = open ? tw.length - 1 : tw.length;
    for (let k = 0; k < Math.max(pw.length, tw.length); k++) {
      let r;
      if (k < pw.length && k < tw.length) { const d = k < doneCount; r = memo(k + (d ? '|d|' : '|o|') + tw[k], () => compareWord(pw[k].w, tw[k], d)); }
      else if (k < pw.length) r = memo(k + '|g', () => ({ items: chars(pw[k].w).map(ch => ({ ch, cls: 'ghost' })), ok: 0, errors: 0, cats: emptyCats(), caret: -1, untouched: true }));
      else {                                                 // typed beyond the end of the model
        const items = chars(tw[k]).map(ch => ({ ch, cls: 'extra', cat: PUNCT.test(ch) ? 'punct' : 'extra' }));
        const c = emptyCats();
        items.forEach(it => c[it.cat]++);
        r = { items, ok: 0, errors: items.length, cats: c, caret: -1, beyond: true };
      }
      res.push(r);
      ok += r.ok; errors += r.errors;
      if (r.errors) wrongWords++;
      for (const c in cats) cats[c] += r.cats[c];
    }
    const finished = pw.length > 0 && tw.length >= pw.length &&
      (doneCount >= pw.length || (open && tw.length === pw.length && res[pw.length - 1].items.every(it => it.cls !== 'ghost')));
    return {
      words: res, typedWords: tw.length, doneWords: Math.min(doneCount, pw.length), totalWords: pw.length,
      current: open ? tw.length - 1 : tw.length,              // the word the caret is in (or before)
      ok, errors, cats, wrongWords, finished,
      accuracy: ok + errors ? ok / (ok + errors) : 1
    };
  }

  return { prepare, splitTyped, compareWord, compareAll, category, PUNCT };
});
