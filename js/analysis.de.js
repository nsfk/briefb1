/* B1 Schreibtrainer - text analysis (no DOM).
 * Browser: window.B1Analysis. Node: module.exports (used by the accuracy test suite).
 * The speller passed in is Hunspell (de_DE): { ready, spell(w), suggest(w), stem(w) }.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.B1Analysis = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- words the 2016 dictionary lacks: [word, example stem it inflects like] ---------- */
  const EXTRA_WORDS = [
    ['App', 'Auto'], ['Tablet', 'Auto'], ['E-Bike', 'Auto'], ['Selfie', 'Auto'], ['Influencer', 'Lehrer'],
    ['Messenger', 'Computer'], ['E-Scooter', 'Computer'], ['Homeoffice', 'Büro'], ['Home-Office', 'Büro'],
    ['Tandempartner', 'Partner'], ['Fahrradweg', 'Weg'], ['posten', 'testen'], ['gepostet', 'getestet'],
    ['Vietnamesisch', 'Chinesisch'], ['vietnamesisch', 'chinesisch'], ['Coronavirus', 'Virus'],
    ['Corona'], ['Homeschooling'], ['Onlineshopping'], ['Online-Shopping'], ['Carsharing'], ['WhatsApp'],
    ['Instagram'], ['TikTok'], ['Netflix'], ['YouTube'], ['Spotify'], ['WG'], ['WGs']
  ];

  /* ---------- tokens ---------- */
  const INVIS = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g;               // soft hyphen, zero-width chars
  const WORD_RE = /[\p{L}\p{M}\u00AD\u200B-\u200D\u2060]+(?:[-'’][\p{L}\p{M}\u00AD\u200B-\u200D\u2060]+)*/gu;
  // URLs, e-mail addresses and bare domains are not German words: masked before tokenising (same length).
  const SKIP_RE = /(?:https?:\/\/|www\.)[^\s<>"„“”]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\b[\w-]+(?:\.[\w-]+)*\.(?:de|com|org|net|at|ch|eu|info|io|vn|edu|gov|app)\b/giu;

  function maskText(text) {
    return text.replace(SKIP_RE, m => '#'.repeat(m.length));
  }
  function tokenize(work) {
    const out = [];
    for (const m of work.matchAll(WORD_RE)) {
      let w = m[0], s = m.index, e = s + w.length;
      while (w && /[\u00AD\u200B-\u200D\u2060]/.test(w[0])) { w = w.slice(1); s++; }
      while (w && /[\u00AD\u200B-\u200D\u2060]/.test(w[w.length - 1])) { w = w.slice(0, -1); e--; }
      if (!/\p{L}/u.test(w)) continue;
      out.push({ w, s, e, clean: w.normalize('NFC').replace(INVIS, '') });
    }
    return out;
  }
  function countWords(text) {
    const parts = maskText(text).match(/\S+/g) || [];
    let n = 0;
    for (const p of parts) if (/[\p{L}\p{N}#]/u.test(p)) n++;
    return n;
  }

  /* ---------- sentence boundaries ---------- */
  const ABBR = new Set(('z.b. d.h. u.a. o.ä. u.ä. usw. bzw. ca. evtl. ggf. inkl. exkl. nr. str. tel. vgl. etc. bspw. sog. dr. prof. hr. fr. frl. abs. abt. allg. bzgl. ebd. geb. ges. i.a. m.e. max. min. mio. mrd. o.g. s. s.o. s.u. u.u. v.a. z.t. zzgl. jh. jan. feb. febr. apr. jun. jul. aug. sep. sept. okt. nov. dez. mo. di. mi. do. sa. so. std. sek. bsp. u.s.w. i.d.r. u.v.m. vs. ps. p.s. lg. mfg. tsd. zb. zb').split(' '));
  function isSentenceStart(work, toks, i) {
    const gapStart = i ? toks[i - 1].e : 0;
    const gap = work.slice(gapStart, toks[i].s);
    if (/\p{N}/u.test(gap)) return false;                   // "am 3. mai", "um 18.30 uhr"
    if (i === 0) return true;                                // first word of the text
    if (/\.\.|…/.test(gap)) return false;                    // ellipsis
    const last = Math.max(gap.lastIndexOf('.'), gap.lastIndexOf('!'), gap.lastIndexOf('?'));
    if (last < 0) return false;
    if (/[,;:]/.test(gap.slice(last + 1))) return false;     // „Kommst du?“, fragte sie
    if (gap[0] === '.') {                                     // dot glued to the previous word: abbreviation?
      let s = gapStart - 1;
      while (s >= 0 && /[\p{L}.]/u.test(work[s])) s--;
      const run = work.slice(s + 1, gapStart + 1);
      if (ABBR.has(run.toLowerCase()) || /^(\p{L}\.)+$/u.test(run)) return false;
    }
    return true;
  }
  function sentenceCount(work, toks) {
    let n = 0;
    for (let i = 0; i < toks.length; i++) if (isSentenceStart(work, toks, i)) n++;
    return n;
  }
  // Sentences closed by . ! or ? (the rule for contributed model answers): a closing formula or a signature written
  // without a full stop ("Viele Grüße / Kien") is not counted as a sentence.
  function closedSentenceCount(text) {
    const work = maskText(String(text || '').normalize('NFC')), toks = tokenize(work);
    let n = 0;
    for (let i = 1; i < toks.length; i++) if (isSentenceStart(work, toks, i)) n++;
    if (toks.length && /^[^\p{L}\p{N}]*[.!?]/u.test(work.slice(toks[toks.length - 1].e)) && !/^\s*(\.\.|…)/.test(work.slice(toks[toks.length - 1].e))) n++;
    return n;
  }

  /* ---------- spelling ---------- */
  // Strong verbs whose imperative changes the vowel (gib, nimm, sieh, lies …): "geb!" is a real learner error.
  const STRONG_EI = new Set('geb nehm seh les helf ess sprech treff werf vergess empfehl sterb brech stehl befehl erschreck tret mess verderb'.split(' '));
  function shortImperativeOk(w, speller) {                             // besuch mich! frag doch! (short form of besuche)
    if (!/^\p{Ll}{3,}$/u.test(w) || STRONG_EI.has(w) || !speller.spell(w + 'e')) return false;
    if (typeof speller.stem !== 'function') return false;
    let stems;
    try { stems = speller.stem(w + 'e'); } catch (e) { return false; }
    return (stems || []).some(s => /^\p{Ll}+(en|ern|eln)$/u.test(s) && s.startsWith(w.slice(0, 3)));
  }
  // strict (contributed model answers): ALL-CAPS words are checked too (Hunspell accepts HAUS for Haus, and known acronyms)
  function spellOk(t, work, speller, strict) {
    const w = t.clean;
    if (!strict && /^\p{Lu}{2,}$/u.test(w.replace(/[-'’]/g, ''))) return true;   // ALL CAPS (OK, USA) - ignored like in Word
    if (speller.spell(w)) return true;
    if (work[t.e] === '.' && speller.spell(w + '.')) return true;        // usw. bzw. ca. Nr.
    const ap = w.match(/^(\p{L}+)['’]s$/u);                              // geht's, gibt's
    if (ap && speller.spell(ap[1])) return true;
    if (shortImperativeOk(w.charAt(0).toLowerCase() + w.slice(1), speller)) return true;
    return false;
  }
  const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
  const noUml = s => s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  // Optimal string alignment distance (Damerau-Levenshtein without repeated edits)
  function osa(a, b) {
    const la = a.length, lb = b.length;
    if (!la) return lb;
    if (!lb) return la;
    let prev2 = null, prev = Array.from({ length: lb + 1 }, (_, j) => j);
    for (let i = 1; i <= la; i++) {
      const cur = [i];
      for (let j = 1; j <= lb; j++) {
        const c = a[i - 1] === b[j - 1] ? 0 : 1;
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
      }
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  }
  function suggestFor(w, speller) {
    let list = [];
    if (/^\p{Lu}\p{Ll}/u.test(w)) {                         // capitalised: the lowercase word gives better hints
      try { list = speller.suggest(w.toLowerCase()).map(cap); } catch (e) { list = []; }
    }
    try { list = list.concat(speller.suggest(w)); } catch (e) { /* engine refused: keep what we have */ }
    const low = w.toLowerCase(), lowN = noUml(low), seen = new Set(), ranked = [];
    list.forEach((s, i) => {
      if (s === w || /^-|-$/.test(s) || seen.has(s)) return;  // drop compound fragments like "-woche"
      seen.add(s);
      const sl = s.toLowerCase();
      ranked.push({ s, i, d: Math.min(osa(low, sl), osa(lowN, noUml(sl))) });
    });
    ranked.sort((a, b) => a.d - b.d || a.i - b.i);
    return ranked.slice(0, 4).map(x => x.s);
  }
  function uniqueWords(toks) {
    const seen = new Map();
    for (const t of toks) { const low = t.clean.toLowerCase(); if (!seen.has(low)) seen.set(low, { low, form: t.clean }); }
    return [...seen.values()];
  }
  function similarFromModel(word, uniq) {
    const w = word.toLowerCase(), wn = noUml(w);
    const limit = Math.min(3, Math.max(1, Math.floor(w.length / 3)));
    let best = limit + 1, hit = '';
    for (const u of uniq) {
      if (u.form === word || Math.abs(u.low.length - w.length) > limit + 1) continue;
      const d = Math.min(osa(w, u.low), osa(wn, noUml(u.low)));
      if (d < best) { best = d; hit = u.form; }
    }
    return hit;
  }

  /* ---------- letter form ---------- */
  const GREETING_RE = /^(Sehr geehrte[rs]?|Liebe[rs]?|Hallo|Hi|Hey|Guten Tag|Guten Morgen|Guten Abend|Moin|Servus|Grüß dich|Grüß Gott)\b/i;
  function letterChecks(text) {
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const betreff = /^betreff\s*:/i.test(lines[0] || '');
    const anredeLine = betreff ? (lines[1] || '') : (lines[0] || '');
    const anrede = GREETING_RE.test(anredeLine);
    // "Liebe Frau Schneider," / "Hallo Herr Wagner," still use Sie
    const formal = /^(Sehr geehrte[rs]?|Guten Tag)\b/i.test(anredeLine) || /\b(Frau|Herr|Herrn|Dr\.|Prof\.)\b/.test(anredeLine) ? 'formal'
      : (/^(Liebe[rs]?|Hallo|Hi|Hey|Moin|Servus|Grüß dich)\b/i.test(anredeLine) ? 'informal' : '');
    const komma = anrede && /[,!]\s*$/.test(anredeLine);
    const tail = lines.slice(-3).join(' ');
    const gruss = /(viele|liebe|herzliche|beste|freundliche|schöne|sonnige|liebste)\s+gr(ü|ue)(ß|ss)e|mit (freundlichen|besten|herzlichen|lieben) gr(ü|ue)(ß|ss)en|bis bald|bis dann|bis später|alles gute|tschüss|tschüs|\blg\b|\bvg\b/i.test(tail);
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
    return { betreff, anrede, komma, gruss, formal, paragraphs, anredeLine };
  }
  function leitpunkte(task) {
    const out = [];
    for (const line of String(task || '').split('\n')) {
      const m = line.trim().match(/^(?:[-–—•*·▪]|\d+[.)])\s*(.+)$/u);
      if (m && m[1].length > 2) out.push(m[1].trim());
    }
    return out.slice(0, 8);
  }

  /* ---------- hints: shown for self-checking, never counted ---------- */
  const HINT_TEXT = {
    dass: '„das“ nach einem Komma: Leitet es einen Inhaltssatz ein (…, dass ich komme), schreibt man „dass“. Ist es ein Relativpronomen (das Buch, das ich lese), ist „das“ richtig.',
    seid: '„seid“ ist eine Form von sein (ihr seid). Wenn Sie „seit“ im Sinn von Zeit meinen, schreiben Sie „seit“ (seit zwei Jahren).',
    seit: 'Nach „ihr“ folgt meist das Verb „seid“ (ihr seid), nicht „seit“.',
    wenn: '„wen“ ist der Akkusativ von „wer“. Wenn Sie „falls / sobald“ meinen, schreiben Sie „wenn“.',
    wieder: '„wider“ bedeutet „gegen“. Wenn Sie „noch einmal“ meinen, schreiben Sie „wieder“.',
    viel: '„fiel“ ist das Präteritum von fallen. Wenn Sie „eine große Menge“ meinen, schreiben Sie „viel“.',
    formalDu: 'Im formellen Brief (Sehr geehrte …) verwendet man „Sie / Ihnen / Ihr“, nicht „du“.',
    formalSie: 'Formeller Brief: Die Anredepronomen für den Empfänger werden großgeschrieben (Sie, Ihnen, Ihr). Kleinschreibung ist nur richtig, wenn „sie“ eine Frau oder mehrere Personen meint.',
    informalSie: 'Informeller Brief (Liebe/Lieber/Hallo): meist mit „du“ (dir, dich, dein), nicht mit „Sie“.',
    caps: 'Großbuchstabe mitten im Satz: Im Deutschen werden nur Nomen (und nominalisierte Wörter: das Gute, beim Lernen) großgeschrieben. Ist das Wort ein Adjektiv, Verb oder Adverb, schreibt man es klein.',
    capsAfterGreeting: 'Nach einer Anrede mit Komma (Liebe Anna,) beginnt die nächste Zeile klein, außer bei Nomen und Sie/Ihnen: „vielen Dank …“, „ich …“.',
    repeat: 'Ein Wort steht zweimal hintereinander. Wenn das nicht beabsichtigt ist (richtig ist zum Beispiel „…, die die Blumen kauft“), löschen Sie eines davon.'
  };
  const PRONOUN_CAPS = new Set('Sie Ihnen Ihr Ihre Ihren Ihrem Ihrer Ihres Du Dich Dir Dein Deine Deinen Deinem Deiner Deines Euch Euer Eure Euren Eurem Eurer'.split(' '));
  const NOUN_ALWAYS = new Set(('Deutsch Englisch Französisch Spanisch Italienisch Russisch Polnisch Türkisch Arabisch Chinesisch Japanisch Koreanisch Vietnamesisch Portugiesisch Niederländisch Griechisch Ukrainisch Persisch Thailändisch Hindi ' +
    'Morgen Mittag Nachmittag Vormittag Abend Nacht Frühstück Mittagessen Abendessen Hause').split(' '));
  const NOMINALIZERS = new Set(('der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner mein meine meinen meinem meiner ' +
    'dein deine deinen deinem deiner sein seine seinen seinem seiner ihr ihre ihren ihrem ihrer unser unsere unseren unserem unserer euer eure euren eurem eurer ' +
    'etwas nichts viel viele vieles wenig weniges alles allem allen beim zum zur im am vom ins aufs fürs ums durchs übers guten gute gutes liebe lieber liebes ' +
    'dieses diesem dieser diesen jedes jedem jeden manches').split(' '));
  function looksLikeNonNoun(w, speller) {
    if (typeof speller.stem !== 'function') return false;
    let stems;
    try { stems = speller.stem(w); } catch (e) { return false; }
    if (!stems || !stems.length) return false;                   // unknown (e.g. compounds): don't guess
    if (stems.some(s => /^\p{Lu}/u.test(s))) return false;       // has a noun or name stem
    return speller.spell(w.toLowerCase());
  }
  function likelyFiniteVerb(w, speller) {                              // "…, das heißt", "…, das macht nichts"
    if (!speller || typeof speller.stem !== 'function' || !/^\p{Ll}/u.test(w)) return false;
    if (/^(ich|du|er|es|sie|wir|ihr|man|mir|dir|mich|dich|uns|euch|ihm|ihn|ihnen|nicht|so|auch|noch|schon)$/.test(w)) return false;
    let stems;
    try { stems = speller.stem(w); } catch (e) { return false; }
    return (stems || []).some(s => /^\p{Ll}+(en|ern|eln)$/u.test(s) && s !== w);
  }
  // "das Heizgerät, das ich gekauft habe" / "… für das Heizgerät übernehmen, das ich …": a neuter noun phrase in the
  // clause before the comma makes "das" a relative pronoun, not a misspelled "dass".
  const NEUTER_DET = /^(das|ein|kein|mein|dein|sein|ihr|unser|euer|dieses|jedes|welches|manches|jenes)$/i;
  function neuterNounBefore(work, toks, i) {
    const from = Math.max(0, i - 8);
    let start = i - 1;
    while (start > from && !/[.,;:!?]/.test(work.slice(toks[start - 1].e, toks[start].s))) start--;   // clause start
    for (let k = start; k < i - 1; k++) {
      if (!NEUTER_DET.test(toks[k].clean)) continue;
      for (let n = k + 1; n <= Math.min(i - 1, k + 3); n++) {
        if (/^\p{Lu}/u.test(toks[n].clean)) return true;          // determiner (+ adjectives) + Noun
        if (!/^\p{Ll}/u.test(toks[n].clean)) break;
      }
    }
    return false;
  }
  function findHints(work, toks, errIdx, letter, speller, names) {
    const out = [];
    names = names || new Set();
    const formal = letter.formal;
    // first word after a greeting that ends with a comma
    let greetEnd = -1;
    if (letter.anrede && /,\s*$/.test(letter.anredeLine)) {
      const at = work.indexOf(letter.anredeLine);
      if (at >= 0) greetEnd = at + letter.anredeLine.length;
    }
    let afterGreetingDone = false;
    for (let i = 0; i < toks.length; i++) {
      const firstAfterGreeting = greetEnd >= 0 && !afterGreetingDone && toks[i].s > greetEnd;
      if (firstAfterGreeting) afterGreetingDone = true;
      if (errIdx.has(i)) continue;
      const t = toks[i], w = t.clean, lw = w.toLowerCase(), prev = i ? toks[i - 1].clean.toLowerCase() : '';
      const gap = work.slice(i ? toks[i - 1].e : 0, t.s);
      let key = '';
      const next = toks[i + 1];
      // ", das Gespräch" is an article, ", das heißt" a demonstrative; a misspelled next word gives no usable context
      if (lw === 'das' && /,\s*$/.test(gap) && next && /^\p{Ll}/u.test(next.clean) && !errIdx.has(i + 1) &&
          !likelyFiniteVerb(next.clean, speller) && !neuterNounBefore(work, toks, i)) key = 'dass';
      else if (lw === 'seid' && prev !== 'ihr') key = 'seid';
      else if (lw === 'seit' && prev === 'ihr') key = 'seit';
      else if (lw === 'wen') key = 'wenn';
      else if (lw === 'wider') key = 'wieder';
      else if (lw === 'fiel') key = 'viel';
      else if (formal === 'formal' && /^(du|dich|dir|dein|deine|deinen|deinem|deiner|deines)$/.test(lw)) key = 'formalDu';
      else if (formal === 'formal' && /^(sie|ihnen|ihr|ihre|ihren|ihrem|ihrer|ihres)$/.test(w) && !isSentenceStart(work, toks, i)) key = 'formalSie';
      else if (formal === 'informal' && /^(Sie|Ihnen|Ihre|Ihren|Ihrem|Ihrer|Ihres)$/.test(w) && !isSentenceStart(work, toks, i)) key = 'informalSie';
      else if (i && lw === prev && lw.length > 1 && /^\s+$/.test(gap) &&
               !(/^(der|die|das|den|dem)$/.test(lw) && /,\s*$/.test(work.slice(i > 1 ? toks[i - 2].e : 0, toks[i - 1].s)))) key = 'repeat';
      else if (speller && /^\p{Lu}\p{Ll}/u.test(w) && !PRONOUN_CAPS.has(w) && !NOUN_ALWAYS.has(w) && !names.has(w)) {
        if (firstAfterGreeting) {
          if (looksLikeNonNoun(w, speller)) key = 'capsAfterGreeting';
        } else if (i && !/[.!?:„“"«»(–\n]/.test(gap) && !NOMINALIZERS.has(prev) &&
                   looksLikeNonNoun(w, speller)) key = 'caps';          // any possible sentence start is skipped
      }
      if (key) out.push({ i, s: t.s, e: t.e, w: t.w, key });
    }
    return out;
  }

  /* ---------- comparison with the model answer ---------- */
  const STOP = new Set(('der die das den dem des ein eine einer eines einem einen und oder aber denn weil dass wenn als wie ich du er sie es wir ihr mich dich sich uns euch mir dir ihm ihn ihnen mein meine meinen meinem meiner dein deine deinen deinem deiner sein seine seinen seinem seiner ihre ihren ihrem ihrer unser unsere unseren unserem euer eure ist bin bist sind seid war waren habe hast hat haben hatte hatten wird werde wirst werden würde würden kann kannst können könnte möchte möchten muss musst müssen soll sollen will wollen nicht kein keine keinen keinem keiner auch noch schon sehr nur mit von zum zur bei nach aus für auf über unter vor durch gegen ohne seit hier dort dann jetzt also doch nein diese dieser dieses diesen diesem alle alles viel viele mehr etwas gern gerne ganz immer einmal mal bitte danke').split(' '));
  function compareTexts(textA, textB) {
    const A = tokenize(maskText(textA)), B = tokenize(maskText(textB));
    const a = A.map(t => t.clean.toLowerCase()), b = B.map(t => t.clean.toLowerCase());
    const n = a.length, m = b.length;
    const inA = new Uint8Array(n), inB = new Uint8Array(m);
    let lcs = 0, aligned = true;
    if (n && m && n * m <= 6e6) {
      const W = m + 1, dp = new Uint16Array((n + 1) * W);
      for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
        dp[i * W + j] = a[i] === b[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      lcs = dp[0];
      let i = 0, j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) { inA[i] = inB[j] = 1; i++; j++; }
        else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
        else j++;
      }
    } else if (n && m) aligned = false;                     // texts too long for word alignment
    const setA = new Set(a), uniqB = uniqueWords(B);
    const used = uniqB.filter(u => setA.has(u.low)).length;
    const missing = uniqB.filter(u => !setA.has(u.low) && u.low.length >= 4 && !STOP.has(u.low)).slice(0, 40).map(u => u.form);
    return { A, B, inA, inB, lcs, aligned, similarity: (n + m) ? 2 * lcs / (n + m) : 0,
      coverage: uniqB.length ? used / uniqB.length : 0, used, uniqB, missing };
  }

  /* ---------- names: not in any dictionary, but not spelling errors either ---------- */
  const GRUSS_LINE = /(gr(ü|ue)(ß|ss)e|gr(ü|ue)(ß|ss)en|bis bald|bis dann|bis später|alles gute|tschüss|tschüs|\blg\b|\bvg\b|dein[e]?$|ihr[e]?$)/i;
  function nameCandidates(text, task) {
    const names = new Set();
    const addCaps = s => { for (const t of tokenize(maskText(s))) if (/^\p{Lu}/u.test(t.clean)) names.add(t.clean); };
    addCaps(String(task || '').normalize('NFC'));                    // names given in the task (Anna, Jonas …)
    const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
    const g = (/^betreff\s*:/i.test(lines[0] || '') ? lines[1] : lines[0]) || '';
    const m = g.match(GREETING_RE);
    if (m) addCaps(g.slice(m[0].length));                            // Liebe Anna, / Sehr geehrte Frau Nguyen,
    if (lines.length >= 2) {                                         // signature under the closing formula
      const last = lines[lines.length - 1], before = lines[lines.length - 2];
      const n = tokenize(maskText(last)).length;
      if (n >= 1 && n <= 4 && !/[.!?,:]$/.test(last) && (GRUSS_LINE.test(before) || /^(dein|deine|ihr|ihre|euer|eure)\b/i.test(last))) addCaps(last);
    }
    return names;
  }

  /* ---------- the whole grading pass ---------- */
  function analyze(rawText, opts) {
    const o = Object.assign({ task: '', model: '', k: 10, speller: null, strict: false }, opts || {});
    const text = rawText.normalize('NFC');
    const work = maskText(text);
    const sp = o.speller && o.speller.ready ? o.speller : null;
    const toks = tokenize(work);
    const words = countWords(text);
    const names = nameCandidates(text, o.task);
    const namesIgnored = new Set();
    const byKey = new Map(), occ = [], errIdx = new Set();
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let type = '';
      if (sp && !spellOk(t, work, sp, o.strict)) {
        if (names.has(t.clean)) namesIgnored.add(t.clean);
        else type = 'R';
      }
      if (!type && /^\p{Ll}/u.test(t.clean) && isSentenceStart(work, toks, i)) type = 'G';
      if (!type) continue;
      const key = type + '|' + t.clean;
      let u = byKey.get(key);
      if (!u) { u = { key, w: t.clean, type, n: 0, sugg: [], similar: '' }; byKey.set(key, u); }
      u.n++;
      occ.push({ s: t.s, e: t.e, u });
      errIdx.add(i);
    }
    const uniq = [...byKey.values()];
    const modelUniq = o.model.trim() ? uniqueWords(tokenize(maskText(o.model.normalize('NFC')))) : [];
    for (const u of uniq) {
      u.sugg = u.type === 'G' ? [cap(u.w)] : (sp ? suggestFor(u.w, sp) : []);
      if (modelUniq.length && u.type === 'R') u.similar = similarFromModel(u.w, modelUniq);
    }
    const letter = letterChecks(text);
    const hints = findHints(work, toks, errIdx, letter, sp, names);
    const errors = occ.length;
    const fq = words ? errors * 100 / words : 0;             // Fehlerquotient: errors per 100 words
    const score = Math.max(0, Math.round(100 - o.k * fq));
    return {
      text, rawText, task: o.task, model: o.model, words, sentences: sentenceCount(work, toks), toks, occ, uniq, hints,
      namesIgnored: [...namesIgnored],
      letter, errors, fq, score, k: o.k, vocab: uniqueWords(toks).length, spellReady: !!sp,
      cmp: o.model.trim() ? compareTexts(text, o.model.normalize('NFC')) : null, leit: leitpunkte(o.task)
    };
  }

  return { EXTRA_WORDS, HINT_TEXT, ABBR, STOP, maskText, tokenize, countWords, isSentenceStart, sentenceCount, closedSentenceCount,
    spellOk, suggestFor, osa, noUml, cap, uniqueWords, similarFromModel, letterChecks, leitpunkte, findHints,
    looksLikeNonNoun, nameCandidates, compareTexts, analyze };
});
