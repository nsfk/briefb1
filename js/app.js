/* B1 Schreibtrainer - user interface: exam clock, answer sheet, grading views, history, configuration, maintenance.
 * Grading itself lives in js/analysis.js (window.B1Analysis), the same code the accuracy test suite runs. */
(() => {
'use strict';

const A = window.B1Analysis;
if (!A) return;                     // the start-up check after the script tags in index.html tells the user what is missing

/* ===================== helpers ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfp = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const pct = x => nfp.format(x * 100) + ' %';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const joinVi = list => (list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' và ' + list[list.length - 1]);
const BASE_TITLE = document.title || 'B1 Schreibtrainer';
function debounce(fn, ms) {
  let t = 0, args = null;
  const run = () => { t = 0; const a = args; args = null; fn(...a); };
  const d = (...a) => { args = a; clearTimeout(t); t = setTimeout(run, ms); };
  d.flush = () => { if (t) { clearTimeout(t); run(); } };
  return d;
}
function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec - 1e-6));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
}
function parseTime(s) {
  s = String(s || '').trim();
  let m = s.match(/^(\d{1,3})$/);
  if (m) return +m[1] * 60;
  m = s.match(/^(\d{1,3}):(\d{1,2})$/);
  if (m && +m[2] < 60) return +m[1] * 60 + +m[2];
  return NaN;
}
const validSec = sec => sec >= 5 && sec <= 36000;
const pad2 = n => String(n).padStart(2, '0');
function dateStr(t) {
  const d = new Date(t);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function toLocalInput(ms) {                               // value for <input type="datetime-local">
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fromLocalInput(v) {
  if (!v) return 0;
  const t = new Date(v).getTime();                        // "YYYY-MM-DDTHH:MM" is read as local time
  return Number.isFinite(t) ? t : NaN;
}

/* ===================== elements ===================== */
const E = {
  appRoot: $('#appRoot'), topbar: $('#topbar'), cfgDot: $('#cfgDot'),
  viewPractice: $('#view-practice'), viewHistory: $('#view-history'), viewConfig: $('#view-config'),
  clock: $('#clock'), clockState: $('#clockState'), clockTotal: $('#clockTotal'), bar: $('#progressBar'),
  timeInput: $('#timeInput'), timeErr: $('#timeErr'), btnStart: $('#btnStart'), btnReset: $('#btnReset'), btnFull: $('#btnFull'),
  icoPlay: $('#icoPlay'), icoPause: $('#icoPause'), optExam: $('#optExam'), optSound: $('#optSound'), spell: $('#spellStatus'),
  maintBanner: $('#maintBanner'), maintBannerText: $('#maintBannerText'), btnBannerReopen: $('#btnBannerReopen'),
  task: $('#task'), model: $('#model'), answer: $('#answer'), sampleSel: $('#sampleSel'), sampleNote: $('#sampleNote'),
  btnModelToggle: $('#btnModelToggle'), modelCover: $('#modelCover'), modelCoverText: $('#modelCoverText'),
  sheetPanel: $('.sheet-panel'), sheetTools: $('#sheetTools'), umlBar: $('#sheetTools .umlauts'),
  cntWords: $('#cntWords'), cntSent: $('#cntSent'), imeWarn: $('#imeWarn'), saveWarn: $('#saveWarn'), lockNote: $('#lockNote'), btnUnlock: $('#btnUnlock'),
  btnGrade: $('#btnGrade'), btnDemo: $('#btnDemo'), btnNew: $('#btnNew'),
  results: $('#results'), staleNote: $('#staleNote'), paneScore: $('#pane-score'), paneCorr: $('#pane-corr'), paneCmp: $('#pane-cmp'),
  histBody: $('#histBody'), btnClearHist: $('#btnClearHist'), btnClearHist2: $('#btnClearHist2'), btnClearDraft: $('#btnClearDraft'),
  optK: $('#optK'), kExample: $('#kExample'), optWords: $('#optWords'), storageState: $('#storageState'), aboutEngine: $('#aboutEngine'),
  siteStatus: $('#siteStatus'), siteScope: $('#siteScope'), siteViewerNote: $('#siteViewerNote'), siteLocked: $('#siteLocked'),
  cfgPin: $('#cfgPin'), btnCfgUnlock: $('#btnCfgUnlock'), cfgPinErr: $('#cfgPinErr'), siteForm: $('#siteForm'),
  maintMessage: $('#maintMessage'), maintUntil: $('#maintUntil'), btnClearUntil: $('#btnClearUntil'),
  btnMaintToggle: $('#btnMaintToggle'), btnMaintSave: $('#btnMaintSave'), btnMaintPreview: $('#btnMaintPreview'),
  pinBox: $('#pinBox'), newPin: $('#newPin'), btnSetPin: $('#btnSetPin'), btnClearPin: $('#btnClearPin'), pinState: $('#pinState'),
  siteNote: $('#siteNote'),
  maintScreen: $('#maintScreen'), maintTitle: $('#maintTitle'), maintMsg: $('#maintMsg'), maintEta: $('#maintEta'),
  maintTimerNote: $('#maintTimerNote'), maintAdmin: $('#maintAdmin'), maintPinRow: $('#maintPinRow'), maintPin: $('#maintPin'),
  btnMaintReopen: $('#btnMaintReopen'), btnMaintClosePreview: $('#btnMaintClosePreview'), maintPinErr: $('#maintPinErr'),
  umlFloat: $('#umlFloat'), backdrop: $('#backdrop'), modal: $('#modal'), pop: $('#pop'), toast: $('#toast'), fileInput: $('#fileInput')
};

/* ===================== unexpected errors in this app: tell the user once instead of failing silently ===================== */
let crashShown = false;
const OUR_FILES = /js\/(app|analysis)\.js/;
function reportCrash() {
  if (crashShown) return;
  crashShown = true;
  toast('Ứng dụng gặp lỗi không mong muốn. Hãy tải lại trang; bản nháp vẫn được giữ trên trình duyệt này.');
}
window.addEventListener('error', e => { if (OUR_FILES.test(e && e.filename || '')) reportCrash(); });
window.addEventListener('unhandledrejection', e => { if (OUR_FILES.test(String(e && e.reason && e.reason.stack || ''))) reportCrash(); });

/* ===================== storage (this browser only) ===================== */
// Values that could not be written (storage blocked, or quota full) are kept in memory, so the page keeps working
// (history, settings, draft) until it is closed; the user is told, and the sheet shows a "not saved" line.
const unsaved = new Map();
const isQuota = e => !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014);
const store = {
  blocked: false,                                         // the browser refuses storage altogether (private window, policy)
  warned: false,
  get pending() { return unsaved.size > 0; },             // something could not be saved
  get(k, d) {
    if (unsaved.has(k)) return JSON.parse(unsaved.get(k));
    try { const v = localStorage.getItem('b1st:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
  },
  set(k, v) {
    const s = JSON.stringify(v);
    try { localStorage.setItem('b1st:' + k, s); }
    catch (e) { unsaved.set(k, s); storageFailed(e); return false; }
    if (unsaved.delete(k) && !unsaved.size) setTimeout(renderStorageState, 0);   // everything is saved again
    return true;
  },
  del(k) {
    unsaved.delete(k);
    try { localStorage.removeItem('b1st:' + k); } catch (e) { /* storage unavailable: nothing stored to delete */ }
    setTimeout(renderStorageState, 0);
  }
};
try { localStorage.setItem('b1st:probe', '1'); localStorage.removeItem('b1st:probe'); }
catch (e) { if (!isQuota(e)) store.blocked = true; }      // a full quota is reported by the first real write that fails
function storageFailed(e) {
  if (!isQuota(e)) store.blocked = true;
  setTimeout(() => {                                      // deferred: a retry that succeeds right away (history trim) cancels the warning
    renderStorageState();
    if (store.warned || !(store.blocked || store.pending)) return;
    store.warned = true;
    toast(store.blocked ? 'Trình duyệt không cho lưu dữ liệu: bản nháp, lịch sử và cài đặt chỉ giữ đến khi đóng trang.'
      : 'Bộ nhớ của trình duyệt đã đầy nên chưa lưu được. Hãy xóa bớt lịch sử trong tab Cấu hình.');
  }, 0);
}
window.addEventListener('beforeunload', e => {           // last line of defence when nothing could be saved
  if ((store.blocked || store.pending) && E.answer.value.trim()) { e.preventDefault(); e.returnValue = ''; }
});

/* ===================== settings ===================== */
const DEFAULTS = { k: 10, sound: true, exam: true, time: '30', words: [], showModel: true };
const settings = (() => {
  const raw = store.get('settings', null);
  const s = Object.assign({}, DEFAULTS, raw && typeof raw === 'object' ? raw : {});
  s.k = Math.round(+s.k);
  if (!(s.k >= 1 && s.k <= 50)) s.k = DEFAULTS.k;
  for (const b of ['sound', 'exam', 'showModel']) if (typeof s[b] !== 'boolean') s[b] = DEFAULTS[b];
  if (typeof s.time !== 'string' || !validSec(parseTime(s.time))) s.time = DEFAULTS.time;
  s.words = Array.isArray(s.words) ? [...new Set(s.words.filter(w => typeof w === 'string' && w).map(w => w.normalize('NFC')))] : [];
  return s;
})();
const saveSettings = () => store.set('settings', settings);

/* ===================== sample tasks (original practice prompts) ===================== */
const SAMPLES = [
  { id: 'geburtstag', title: 'Einladung zum Geburtstag (thân mật)',
    task: 'Ihre Freundin Anna hat Sie zu ihrer Geburtstagsparty am Samstag eingeladen. Sie können aber leider nicht kommen.\n\nSchreiben Sie Anna eine E-Mail:\n– Bedanken Sie sich für die Einladung.\n– Erklären Sie, warum Sie nicht kommen können.\n– Machen Sie einen Vorschlag für ein anderes Treffen.\n– Fragen Sie, was sie sich zum Geburtstag wünscht.\n\nDenken Sie an eine passende Anrede, eine Einleitung und einen Schluss.',
    model: 'Liebe Anna,\n\nvielen Dank für deine Einladung zu deiner Geburtstagsparty am Samstag. Ich habe mich sehr darüber gefreut.\n\nLeider kann ich nicht kommen, weil ich am Wochenende arbeiten muss. Meine Kollegin ist krank, deshalb muss ich ihre Schicht übernehmen. Das tut mir wirklich leid.\n\nHast du vielleicht nächste Woche Zeit? Wir könnten zusammen in unser Lieblingscafé gehen und ein Stück Kuchen essen. Wie wäre es mit Dienstag oder Mittwoch am Abend?\n\nAußerdem möchte ich dir gern etwas schenken. Hast du einen besonderen Wunsch? Vielleicht ein Buch oder etwas für deine neue Wohnung? Schreib mir einfach.\n\nIch wünsche dir eine schöne Party und einen tollen Geburtstag!\n\nViele Grüße\nLisa' },
  { id: 'kurs', title: 'Deutschkurs am Wochenende (trang trọng)',
    task: 'Sie haben im Internet eine Anzeige für einen Deutschkurs am Wochenende gelesen. Schreiben Sie an die Sprachschule:\n– Stellen Sie sich kurz vor.\n– Warum möchten Sie den Kurs besuchen?\n– Fragen Sie nach den Kosten und den Kurszeiten.\n– Fragen Sie, ob es am Ende eine Prüfung gibt.\n\nDenken Sie an eine passende Anrede, eine Einleitung und einen Schluss.',
    model: 'Sehr geehrte Damen und Herren,\n\nich habe im Internet Ihre Anzeige für einen Deutschkurs am Wochenende gelesen und interessiere mich sehr für dieses Angebot.\n\nMein Name ist Lisa Tran. Ich bin 27 Jahre alt und komme aus Vietnam. Seit einem Jahr lebe ich in Leipzig und arbeite als Krankenpflegerin.\n\nIch möchte den Kurs besuchen, weil ich im nächsten Jahr die B1-Prüfung machen möchte. Unter der Woche habe ich leider keine Zeit, deshalb passt ein Kurs am Wochenende sehr gut zu mir.\n\nKönnten Sie mir bitte mitteilen, wie viel der Kurs kostet und wann genau er stattfindet? Außerdem würde ich gern wissen, ob es am Ende des Kurses eine Prüfung gibt.\n\nIch freue mich auf Ihre Antwort.\n\nMit freundlichen Grüßen\nLisa Tran' },
  { id: 'umzug', title: 'Ein Freund zieht um (thân mật)',
    task: 'Ihr Freund Jonas zieht bald in Ihre Stadt und sucht eine Wohnung. Schreiben Sie ihm eine E-Mail:\n– Sagen Sie, dass Sie sich über den Umzug freuen.\n– Geben Sie Tipps für die Wohnungssuche.\n– Welchen Stadtteil empfehlen Sie? Warum?\n– Bieten Sie Ihre Hilfe beim Umzug an.', model: '' },
  { id: 'beschwerde', title: 'Beschwerde über eine Bestellung (trang trọng)',
    task: 'Sie haben online ein Fahrrad bestellt. Es ist aber beschädigt angekommen. Schreiben Sie an den Kundenservice:\n– Was haben Sie wann bestellt?\n– Beschreiben Sie das Problem.\n– Was erwarten Sie jetzt von der Firma?\n– Bis wann möchten Sie eine Antwort?', model: '' }
];
const DEMO_ANSWER = 'Liebe Anna,\n\nvielen Dank fuer deine Einladung zu deiner Geburtstagsparty am Samstag. Ich habe mich sehr gefreut!\n\nLeider kann ich nicht kommen, weil ich am Wochenende arbeiten muss. meine Kollegin ist krank und ich muss ihre Schicht übernehmen. Entschuldiegung, das ich nicht dabei sein kann. Ich bin wirklich traurig.\n\nHast du nächste woche Zeit? Wir könnten zusammen ins Café gehen und Kuchen essen. Vieleicht am Dienstag oder am Mittwoch nach der Arbeit? Ich lade dich natürlich ein.\n\nWas wünschst du dir zum Geburtstag? Ich möchte dir gern etwas schenken, aber ich weiß nicht, was dir gefällt. Vielleicht ein Buch oder eine Pflanze für deine neue Wohnung?\n\nIch wünsche dir eine schöne Party und viel Spaß mit deinen Freunden!\n\nViele Grüsse\nLisa';

/* ===================== spell checker (Hunspell 1.7.3, WebAssembly) ===================== */
const Spell = { ready: false, failed: false, broken: false, h: null, added: new Set(), promise: null, engineErrors: 0, version: '' };
const suggestCache = new Map();                           // suggestions per word: re-grading (k, personal words) stays instant
// The adapter analysis.js expects. One engine exception never turns a word into an error; runAnalysis() counts them
// and withholds the score when the engine itself is failing.
const speller = {
  get ready() { return Spell.ready; },
  spell(w) { try { return Spell.h.spell(w); } catch (e) { Spell.engineErrors++; return true; } },
  suggest(w) {
    if (suggestCache.has(w)) return suggestCache.get(w).slice();
    try { const r = Spell.h.suggest(w) || []; suggestCache.set(w, r); return r.slice(); } catch (e) { Spell.engineErrors++; return []; }
  },
  stem(w) { try { return Spell.h.stem(w) || []; } catch (e) { Spell.engineErrors++; return []; } }
};
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Không tải được ' + src));
    (document.head || document.documentElement).appendChild(s);
  });
}
function setSpellStatus(kind, text, title) {
  E.spell.className = 'pill ' + kind;
  E.spell.textContent = text;
  E.spell.title = title || '';
}
const SPELL_FAIL_HINT = 'Bản trên máy: kiểm tra thư mục lib (hunspell.js, dict-de.js) đặt cạnh index.html, rồi tải lại trang.';
function initSpell() {
  // a load that never finishes is reported after 30 s, so grading does not keep waiting; a late success still takes over
  const watchdog = setTimeout(() => {
    if (Spell.ready || Spell.failed) return;
    Spell.failed = true;
    setSpellStatus('bad', 'Từ điển tải quá lâu', 'Từ điển chưa tải xong sau 30 giây. ' + SPELL_FAIL_HINT);
    renderAbout();
  }, 30000);
  Spell.promise = (async () => {
    let loaded = false;
    try {
      if (window.crypto && !crypto.randomUUID) {          // older browsers: the wasm glue code asks for it
        Crypto.prototype.randomUUID = function () {
          const b = crypto.getRandomValues(new Uint8Array(16));
          b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
          const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
          return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
        };
      }
      if (!window.HunspellWasm) await loadScript('lib/hunspell.js');
      if (!window.B1_DICT_DE) await loadScript('lib/dict-de.js');
      const factory = await window.HunspellWasm.loadModule();
      const enc = new TextEncoder();
      const aff = factory.mountBuffer(enc.encode(window.B1_DICT_DE.aff), 'de_DE.aff');
      const dic = factory.mountBuffer(enc.encode(window.B1_DICT_DE.dic), 'de_DE.dic');
      const h = factory.create(aff, dic);
      for (const [w, ex] of A.EXTRA_WORDS) { try { ex ? h.addWordWithAffix(w, ex) : h.addWord(w); } catch (e) { /* one missing word is not fatal */ } }
      Spell.h = h; Spell.ready = true; Spell.failed = false; Spell.version = window.HunspellWasm.HUNSPELL_VERSION || '1.7.3';
      loaded = true;
    } catch (err) {
      Spell.failed = true;
      setSpellStatus('bad', 'Không tải được từ điển', String(err && err.message || err) + '. ' + SPELL_FAIL_HINT);
    }
    clearTimeout(watchdog);
    if (loaded) {
      setSpellStatus('ok', 'Chính tả: Hunspell · de_DE', 'Hunspell ' + Spell.version + ' · từ điển igerman98 (de_DE) · chạy offline trong trình duyệt');
      syncPersonalWords();
      if (lastResult && !lastResult.spellReady) regrade(!lastResult.review);   // graded / reopened while the dictionary was loading
    }
    renderAbout();
  })();
  return Spell.promise;
}
// Personal words are added to the running Hunspell instance. A word the dictionary already accepts is never added,
// so removing it from the list later can never mark a real dictionary word as wrong.
// Returns the words the engine refused, so the caller can say so.
function syncPersonalWords() {
  if (!Spell.ready) return [];
  const want = new Set(settings.words), refused = [];
  let changed = false;
  for (const w of [...Spell.added]) {
    if (want.has(w)) continue;
    try { Spell.h.removeWord(w); } catch (e) { /* the engine no longer has it: nothing to undo */ }
    Spell.added.delete(w); changed = true;
  }
  for (const w of want) {
    if (Spell.added.has(w)) continue;
    let known = false;
    try { known = Spell.h.spell(w); } catch (e) { known = false; }
    if (known) continue;
    try { Spell.h.addWord(w); Spell.added.add(w); changed = true; } catch (e) { refused.push(w); }
  }
  if (changed) suggestCache.clear();
  return refused;
}

/* ===================== views: Luyện viết / Lịch sử / Cấu hình ===================== */
const VIEWS = ['practice', 'history', 'config'];
let currentView = 'practice';
function selectView(name, focusTab) {
  if (!VIEWS.includes(name)) name = 'practice';
  for (const v of VIEWS) {
    const on = v === name, tab = $('#vt-' + v);
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    $('#view-' + v).hidden = !on;
  }
  currentView = name;
  closePop();
  if (focusTab) $('#vt-' + name).focus();
  if (name === 'history') renderHistory();
  if (name === 'config') renderConfig();
  if (name === 'practice') autoGrow();
  requestAnimationFrame(() => { updateSticky(); updateFloat(); });
}
$$('.vtab').forEach(t => {
  const name = t.id.slice(3);
  t.addEventListener('click', () => selectView(name));
  t.addEventListener('keydown', e => {
    const i = VIEWS.indexOf(name);
    let n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % VIEWS.length;
    else if (e.key === 'ArrowLeft') n = (i + VIEWS.length - 1) % VIEWS.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = VIEWS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    selectView(VIEWS[n], true);
  });
});

/* ===================== the answer sheet: sticky toolbar, growing sheet, umlaut keys ===================== */
const UML_KEYS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü', '„', '“'];
$$('[data-uml]').forEach(box => {
  const inFloat = !!box.closest('#umlFloat');
  // The floating keys are pointer-only (tabindex -1): tabbing onto them would move focus out of the field they serve.
  box.innerHTML = UML_KEYS.map(ch => `<button type="button" class="uml" data-ch="${ch}" title="Chèn ${ch}" aria-label="Chèn ${ch}"${inFloat ? ' tabindex="-1"' : ''}>${ch}</button>`).join('');
});
let stickTop = 0;
function updateSticky() {
  const pos = getComputedStyle(E.topbar).position;
  stickTop = pos === 'sticky' || pos === 'fixed' ? Math.round(E.topbar.getBoundingClientRect().height) : 0;
  const root = document.documentElement.style;
  root.setProperty('--stick-top', stickTop + 'px');
  if (!E.viewPractice.hidden) root.setProperty('--tools-h', Math.round(E.sheetTools.getBoundingClientRect().height) + 'px');
  updateStuck();
}
function updateStuck() {
  if (E.viewPractice.hidden) return;
  E.sheetTools.classList.toggle('stuck', E.sheetPanel.getBoundingClientRect().top < stickTop - 1);
}
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => updateSticky());
  ro.observe(E.topbar); ro.observe(E.sheetTools);
}
window.addEventListener('resize', () => { updateSticky(); autoGrow(); updateFloat(); });

// The sheet grows with the letter (CSS field-sizing), so the page is the only scroller and the toolbar can stick.
const NATIVE_GROW = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));
function autoGrow() {
  if (NATIVE_GROW || E.viewPractice.hidden) return;      // a hidden sheet measures 0 px: grow it when it is shown again
  const y = window.scrollY;
  E.answer.style.height = 'auto';
  E.answer.style.height = E.answer.scrollHeight + 'px';
  if (window.scrollY !== y) window.scrollTo(0, y);
}

// While writing, keep the caret line clear of the sticky clock and toolbar (scroll-padding steers caret scrolling).
E.answer.addEventListener('focus', () => document.documentElement.classList.add('writing'));
E.answer.addEventListener('blur', () => document.documentElement.classList.remove('writing'));

// Measure where the caret is (mirror element) and scroll it out from under the sticky bars if the browser left it there.
let mirror = null;
function caretTop() {
  const ta = E.answer, cs = getComputedStyle(ta);
  if (!mirror) {
    mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    document.body.appendChild(mirror);
  }
  const props = ['boxSizing', 'width', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
    'borderBottomWidth', 'borderLeftWidth', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'tabSize', 'textIndent'];
  const st = mirror.style;
  st.cssText = 'position:absolute;visibility:hidden;top:0;left:-9999px;white-space:pre-wrap;overflow-wrap:break-word;word-break:normal;';
  for (const p of props) st[p] = cs[p];
  st.width = ta.getBoundingClientRect().width + 'px';
  mirror.textContent = ta.value.slice(0, ta.selectionStart);
  const marker = document.createElement('span');
  marker.textContent = '\u200B';
  mirror.appendChild(marker);
  return marker.offsetTop;
}
function keepCaretVisible() {
  if (document.activeElement !== E.answer || E.viewPractice.hidden) return;
  const lh = parseFloat(getComputedStyle(E.answer).lineHeight) || 32;
  const y = E.answer.getBoundingClientRect().top + caretTop();
  const vv = window.visualViewport;
  const topLimit = (vv ? vv.offsetTop : 0) + stickTop + E.sheetTools.getBoundingClientRect().height + 6;
  const bottomLimit = (vv ? vv.offsetTop + vv.height : window.innerHeight) - 12;
  if (y < topLimit) window.scrollBy(0, y - topLimit);
  else if (y + lh > bottomLimit) window.scrollBy(0, y + lh - bottomLimit);
}
const keepCaretSoon = () => requestAnimationFrame(keepCaretVisible);
E.answer.addEventListener('keyup', e => { if (/^(Arrow|Page|Home|End|Enter|Backspace|Delete)/.test(e.key)) keepCaretSoon(); });
E.answer.addEventListener('click', keepCaretSoon);

// Floating umlaut keys: for the task, the model answer and the settings fields, and for the sheet whenever its own
// toolbar is not on screen (e.g. a phone keyboard covering the page).
const FLOAT_FIELDS = new Set([E.task, E.model, E.optWords, E.maintMessage]);
let floatTarget = null;
function toolbarOnScreen() {
  if (E.viewPractice.hidden) return false;
  const r = E.umlBar.getBoundingClientRect(), vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0, bottom = top + (vv ? vv.height : window.innerHeight);
  return r.height > 0 && r.top >= top - 1 && r.bottom <= bottom + 1;
}
function updateFloat() {
  const ae = document.activeElement;
  let t = null;
  if (!Site.screen && E.backdrop.hidden) {
    if (FLOAT_FIELDS.has(ae) && !ae.readOnly && !ae.disabled && !ae.hidden) t = ae;
    else if (ae === E.answer && !E.answer.readOnly && !toolbarOnScreen()) t = E.answer;
  }
  floatTarget = t;
  E.umlFloat.hidden = !t;
  if (t) {
    const vv = window.visualViewport;
    const inset = vv ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)) : 0;   // on-screen keyboard
    E.umlFloat.style.bottom = `calc(${16 + Math.round(inset)}px + env(safe-area-inset-bottom, 0px))`;
  }
}
document.addEventListener('focusin', updateFloat);
document.addEventListener('focusout', () => setTimeout(updateFloat, 0));
let scrollQueued = false;
window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => { scrollQueued = false; updateStuck(); if (document.activeElement === E.answer || floatTarget) updateFloat(); });
}, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateFloat);
  window.visualViewport.addEventListener('scroll', updateFloat);
}
document.addEventListener('mousedown', e => { if (e.target.closest('.uml')) e.preventDefault(); });   // keep the caret in the text
document.addEventListener('click', e => {
  const b = e.target.closest('.uml');
  if (!b) return;
  insertAtCaret(b.closest('#umlFloat') ? floatTarget : E.answer, b.dataset.ch);
});
function insertAtCaret(ta, str) {
  if (!ta || ta.readOnly || ta.disabled || ta.hidden) return;
  ta.focus();
  let ok = false;
  try { ok = document.execCommand('insertText', false, str); } catch (e) { ok = false; }
  if (!ok) {
    const s = ta.selectionStart, e = ta.selectionEnd;
    ta.setRangeText(str, s, e, 'end');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/* ===================== timer ===================== */
const T = { state: 'idle', total: 1800, endAt: 0, remaining: 1800, warned5: false, warned1: false, unlocked: false, maintPaused: false, graded: false };
const STATE_LABEL = { idle: 'Sẵn sàng', running: 'Đang làm bài', paused: 'Tạm dừng', done: 'Hết giờ', stopped: 'Đã nộp bài' };
const STATE_KIND = { idle: '', running: 'info', paused: 'warn', done: 'bad', stopped: 'ok' };
const active = () => T.state === 'running' || T.state === 'paused';
let lastShownSec = -1, timerRun = 0;
function remaining() { return T.state === 'running' ? (T.endAt - Date.now()) / 1000 : T.remaining; }
function persistTimer() {
  store.set('timer', { state: T.state, total: T.total, endAt: T.endAt, remaining: T.remaining, warned5: T.warned5, warned1: T.warned1,
    unlocked: T.unlocked, maintPaused: T.maintPaused, graded: T.graded });
}
function renderClock() {
  const r = remaining();
  const shown = T.state === 'idle' ? T.total : Math.max(0, r);
  const sec = Math.ceil(shown - 1e-6);
  E.clock.textContent = fmt(shown);
  const warn = T.state !== 'idle' && T.state !== 'stopped' && r <= 300 && r > 60;
  const crit = active() && r <= 60;
  E.clock.classList.toggle('warn', warn);
  E.clock.classList.toggle('crit', crit);
  E.clock.classList.toggle('done', T.state === 'done');
  const frac = T.state === 'idle' ? 0 : Math.min(1, Math.max(0, 1 - Math.max(0, r) / T.total));
  E.bar.style.width = (frac * 100).toFixed(2) + '%';
  E.bar.classList.toggle('warn', warn);
  E.bar.classList.toggle('crit', crit || T.state === 'done');
  if (sec !== lastShownSec) {
    lastShownSec = sec;
    if (active()) document.title = fmt(shown) + ' · ' + BASE_TITLE;
    else if (!flashTimer) document.title = BASE_TITLE;
  }
}
function applyTimerUI() {
  const st = T.state;
  E.clockState.textContent = STATE_LABEL[st];
  E.clockState.className = 'pill ' + STATE_KIND[st];
  E.clockTotal.textContent = 'Tổng: ' + fmt(T.total);
  E.btnStart.querySelector('span').textContent = { idle: 'Bắt đầu', running: 'Tạm dừng', paused: 'Tiếp tục', done: 'Bắt đầu lại', stopped: 'Bắt đầu lại' }[st];
  E.icoPlay.hidden = st === 'running';
  E.icoPause.hidden = st !== 'running';
  E.btnStart.classList.toggle('btn-primary', st !== 'running');
  E.btnReset.disabled = st === 'idle';
  const editable = !active();
  E.timeInput.disabled = !editable;
  const want = parseTime(E.timeInput.value);
  $$('.chip[data-time]').forEach(c => { c.disabled = !editable; c.setAttribute('aria-pressed', String(parseTime(c.dataset.time) === want)); });
  if (!grading) E.btnGrade.textContent = active() ? 'Nộp bài và chấm điểm' : 'Chấm điểm';
  lastShownSec = -1;                                      // a state change always refreshes the tab title
  renderClock();
  applyExam();
}
function readTimeInput(showError) {
  const sec = parseTime(E.timeInput.value);
  const ok = validSec(sec);
  if (ok) E.timeErr.hidden = true;
  else if (showError) {
    E.timeErr.textContent = 'Thời gian không hợp lệ. Nhập số phút (ví dụ 30) hoặc phút:giây (ví dụ 0:20), từ 5 giây đến 600 phút.';
    E.timeErr.hidden = false;
  }
  return ok ? sec : 0;
}
function startTimer() {
  const sec = readTimeInput(true);
  if (!sec) { E.timeInput.focus(); return; }
  settings.time = E.timeInput.value.trim(); saveSettings();
  timerRun++;
  T.total = sec; T.remaining = sec; T.endAt = Date.now() + sec * 1000; T.state = 'running';
  T.warned5 = sec <= 300; T.warned1 = sec <= 60; T.unlocked = false; T.maintPaused = false; T.graded = false;
  stopFlash(); scheduleAlarms(sec); startTicking(); persistTimer(); applyTimerUI();
  if (currentView !== 'practice') selectView('practice');
  E.answer.focus();
}
function pauseTimer() {
  if (T.state !== 'running') return;
  T.remaining = Math.max(0, remaining()); T.state = 'paused';
  cancelAlarms(); stopTicking(); persistTimer(); applyTimerUI();
}
function resumeTimer() {
  if (T.state !== 'paused') return;
  T.endAt = Date.now() + T.remaining * 1000; T.state = 'running'; T.maintPaused = false;
  scheduleAlarms(T.remaining); startTicking(); persistTimer(); applyTimerUI();
}
function stopTimer() {                                    // submitted before the time was up
  if (!active()) return;
  T.remaining = Math.max(0, remaining()); T.state = 'stopped'; T.maintPaused = false;
  cancelAlarms(); stopTicking(); persistTimer(); applyTimerUI();
}
// Back to "Sẵn sàng". Never shows the time error: an invalid entry quietly falls back to the last valid time.
function resetTimer() {
  timerRun++;
  cancelAlarms(); stopTicking(); stopFlash();
  let sec = readTimeInput(false);
  if (!sec) { E.timeInput.value = settings.time; E.timeErr.hidden = true; sec = parseTime(settings.time) || 1800; }
  Object.assign(T, { state: 'idle', total: sec, remaining: sec, endAt: 0, warned5: false, warned1: false, unlocked: false, maintPaused: false, graded: false });
  persistTimer(); applyTimerUI();
}
function finishTimer(silent) {                            // time is up
  T.state = 'done'; T.remaining = 0; T.maintPaused = false;
  stopTicking(); persistTimer();
  if (!silent) playEndIfNeeded();
  applyTimerUI();
  showTimeUp();
  if (document.hidden) flashTitle();
}
function tick() {
  if (T.state !== 'running') return;
  const r = remaining();
  if (r <= 0) { finishTimer(false); return; }
  if (!T.warned5 && r <= 300) { T.warned5 = true; persistTimer(); toast('Còn 5 phút.'); }
  if (!T.warned1 && r <= 60) { T.warned1 = true; persistTimer(); toast('Còn 1 phút — hãy viết lời chào kết.'); }
  renderClock();
}
let tickWorker = null, tickInterval = 0;
function startTicking() {                                 // a worker keeps ticking in background tabs; setInterval is the backup
  stopTicking();
  try {
    if (!tickWorker) {
      const src = 'let i=0;onmessage=function(e){clearInterval(i);if(e.data)i=setInterval(function(){postMessage(1)},250)}';
      tickWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      tickWorker.onmessage = tick;
    }
    tickWorker.postMessage(1);
  } catch (e) { tickWorker = null; }
  tickInterval = setInterval(tick, 250);
  tick();
}
function stopTicking() {
  if (tickWorker) tickWorker.postMessage(0);
  clearInterval(tickInterval); tickInterval = 0;
}
let flashTimer = 0;
function flashTitle() {
  stopFlash();
  let on = false;
  flashTimer = setInterval(() => { document.title = (on = !on) ? 'HẾT GIỜ · ' + BASE_TITLE : BASE_TITLE; }, 900);
}
function stopFlash() {
  if (flashTimer) { clearInterval(flashTimer); flashTimer = 0; }
  document.title = active() ? fmt(Math.max(0, remaining())) + ' · ' + BASE_TITLE : BASE_TITLE;
}

/* ---- sound: alarms are scheduled on the audio clock, so they ring on time even in a background tab ---- */
let actx = null, scheduled = [], endAudioAt = 0, audioWarned = false;
function warnAudio() {
  if (audioWarned) return;
  audioWarned = true;
  toast('Trình duyệt này không phát được âm thanh báo giờ. Hãy theo dõi đồng hồ trên màn hình.');
}
function audio() {
  if (!settings.sound) return null;
  try {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('no AudioContext');
      actx = new AC();
    }
    if (actx.state === 'suspended') { const p = actx.resume(); if (p && p.catch) p.catch(() => {}); }
  } catch (e) { actx = null; warnAudio(); }
  return actx;
}
function tone(at, freq, dur, vol) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(actx.destination);
  o.start(at); o.stop(at + dur + 0.05);
  const item = { o, g };
  scheduled.push(item);
  o.onended = () => { scheduled = scheduled.filter(x => x !== item); try { o.disconnect(); g.disconnect(); } catch (e) { /* already disconnected */ } };
}
const PATTERNS = {
  warn5: [[0, 880, .22]],
  warn1: [[0, 880, .18], [.28, 880, .18]],
  end: [[0, 659, .38], [.42, 880, .38], [.84, 1047, .7], [1.9, 659, .38], [2.32, 880, .38], [2.74, 1047, .7], [3.8, 659, .38], [4.22, 880, .38], [4.64, 1047, .9]]
};
function pattern(name, at) { for (const [dt, f, d] of PATTERNS[name]) tone(at + dt, f, d, name === 'end' ? 0.32 : 0.22); }
function scheduleAlarms(rem) {
  cancelAlarms();
  const a = audio();
  if (!a) return;
  try {
    const now = a.currentTime + 0.02;
    if (rem > 300.5) pattern('warn5', now + rem - 300);
    if (rem > 60.5) pattern('warn1', now + rem - 60);
    endAudioAt = now + rem;
    pattern('end', endAudioAt);
  } catch (e) { cancelAlarms(); warnAudio(); }
}
function cancelAlarms() {
  for (const { o, g } of scheduled) {
    try { o.onended = null; o.stop(0); } catch (e) { /* not started or already stopped */ }
    try { o.disconnect(); g.disconnect(); } catch (e) { /* already disconnected */ }
  }
  scheduled = []; endAudioAt = 0;
}
function playEndIfNeeded() {
  const a = audio();
  if (!a || a.state !== 'running') return;               // a suspended context would ring late, at the next click
  if (endAudioAt && a.currentTime >= endAudioAt - 0.3 && a.currentTime < endAudioAt + 6) return;   // already ringing on schedule
  cancelAlarms();
  try { pattern('end', a.currentTime + 0.05); } catch (e) { warnAudio(); }
}

/* ===================== exam mode, model answer visibility ===================== */
function applyExam() {
  const running = active();
  E.optExam.checked = settings.exam;
  E.optExam.disabled = running;
  E.optSound.checked = settings.sound;
  E.answer.spellcheck = !settings.exam;
  const locked = settings.exam && T.state === 'done' && !T.unlocked;
  E.answer.readOnly = locked;
  E.lockNote.hidden = !locked;
  const covered = settings.exam && running;
  // the previous results (corrections, suggestions, the whole model answer in the comparison) stay out of sight too
  E.results.hidden = !lastResult || covered;
  if (covered) closePop();
  const showModel = settings.showModel && !covered;
  E.model.hidden = !showModel;
  E.modelCover.hidden = showModel;
  E.modelCoverText.textContent = covered ? 'Trong chế độ thi, bài mẫu được che cho đến khi bạn nộp bài hoặc hết giờ.' : 'Bấm „Hiện“ để xem bài mẫu.';
  E.btnModelToggle.disabled = covered;
  E.btnModelToggle.textContent = settings.showModel ? 'Ẩn' : 'Hiện';
  E.btnModelToggle.setAttribute('aria-pressed', String(settings.showModel));
  $('[data-open="model"]').disabled = covered;
  E.sampleSel.disabled = covered;
  if (floatTarget === E.answer && locked) updateFloat();
}

/* ===================== modal, popover, toast ===================== */
let modalResolve = null, lastFocus = null;
function openModal({ title, sub = '', html = '', buttons = [], kind = '' }) {
  closePop();
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(null); }
  lastFocus = document.activeElement;
  E.modal.className = 'modal ' + kind;
  E.modal.innerHTML = `<h2 id="modalTitle">${esc(title)}</h2>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}${html}<div class="actions"></div>`;
  const box = $('.actions', E.modal);
  return new Promise(resolve => {
    modalResolve = resolve;
    buttons.forEach((b, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ' + (b.primary ? 'btn-primary btn-lg' : b.danger ? 'btn-danger' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => closeModal(b.value !== undefined ? b.value : idx));
      box.appendChild(btn);
    });
    E.backdrop.hidden = false;
    updateFloat();
    const focusBtn = $('.btn-primary', box) || $('.btn-danger', box) || $('button', box);
    if (focusBtn) focusBtn.focus();
  });
}
function closeModal(value) {
  E.backdrop.hidden = true;
  const r = modalResolve; modalResolve = null;
  if (lastFocus && lastFocus.focus && !Site.screen) try { lastFocus.focus(); } catch (e) { /* element gone */ }
  updateFloat();
  if (r) r(value);
}
E.backdrop.addEventListener('click', e => { if (e.target === E.backdrop && !E.modal.classList.contains('alarm')) closeModal(null); });
function confirmBox(title, text, okLabel, danger) {
  return openModal({ title, html: `<p>${esc(text)}</p>`, buttons: [{ label: 'Hủy', value: false }, { label: okLabel, value: true, primary: !danger, danger }] }).then(v => v === true);
}
let toastTimer = 0;
function toast(msg) {
  E.toast.textContent = msg; E.toast.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { E.toast.hidden = true; }, 3600);
}
function closePop() { E.pop.hidden = true; E.pop.innerHTML = ''; }
function openPop(anchor, html) {
  E.pop.innerHTML = html; E.pop.hidden = false;
  const r = anchor.getBoundingClientRect(), pw = E.pop.offsetWidth, ph = E.pop.offsetHeight;
  let left = r.left + window.scrollX, top = r.bottom + window.scrollY + 6;
  left = Math.max(window.scrollX + 16, Math.min(left, window.scrollX + document.documentElement.clientWidth - pw - 16));
  if (r.bottom + ph + 12 > window.innerHeight && r.top - ph - 8 > stickTop) top = r.top + window.scrollY - ph - 6;
  E.pop.style.left = left + 'px'; E.pop.style.top = top + 'px';
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!E.pop.hidden) closePop();
  else if (!E.backdrop.hidden && !E.modal.classList.contains('alarm')) closeModal(null);
  else if (Site.preview) { Site.preview = false; applySite(); E.btnMaintPreview.focus(); }
});
document.addEventListener('click', e => {
  if (!E.pop.hidden && !E.pop.contains(e.target) && !e.target.closest('mark[data-k], mark[data-h]')) closePop();
});
function showTimeUp() {
  const w = A.countWords(E.answer.value);
  const locked = settings.exam && !T.unlocked;
  openModal({
    kind: 'alarm', title: 'Hết giờ!', sub: 'Die Zeit ist um.',
    html: `<p>Bạn đã viết <b>${w}</b> từ trong ${esc(fmt(T.total))}.</p>` + (locked ? '<p class="muted small">Bài viết đã được khóa như trong phòng thi. Bạn vẫn có thể mở khóa để viết tiếp.</p>' : ''),
    buttons: [{ label: 'Để sau', value: 'later' }, { label: 'Chấm điểm ngay', value: 'grade', primary: true }]
  }).then(v => { stopFlash(); if (v === 'grade') grade(); });
}

/* ===================== editor: keys, counters, draft ===================== */
const ALT_KEYS = { KeyA: 'ä', KeyO: 'ö', KeyU: 'ü', KeyS: 'ß' };
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'Enter') {
    // only on the writing desk, never behind a dialog or the maintenance screen
    if (currentView === 'practice' && E.backdrop.hidden && !Site.screen) { e.preventDefault(); grade(); }
    return;
  }
  if (e.altKey && !e.ctrlKey && !e.metaKey && e.target instanceof HTMLTextAreaElement && ALT_KEYS[e.code]) {
    e.preventDefault();
    const ch = ALT_KEYS[e.code];
    insertAtCaret(e.target, e.shiftKey && ch !== 'ß' ? ch.toUpperCase() : ch);
  }
});
const VN_RE = /[đĐơƠưƯăĂẠ-ỹ]/;
function updateCounters() {
  const text = E.answer.value;
  const work = A.maskText(text.normalize('NFC'));
  E.cntWords.textContent = A.countWords(text);
  E.cntSent.textContent = A.sentenceCount(work, A.tokenize(work));
  E.imeWarn.hidden = !VN_RE.test(text);
  updateStale();
}
function updateStale() {
  if (!lastResult) { E.staleNote.hidden = true; return; }
  E.staleNote.hidden = E.answer.value === lastResult.rawText && E.model.value === lastResult.model && E.task.value === lastResult.task;
}
const saveDraft = debounce(() => store.set('draft', { task: E.task.value, model: E.model.value, answer: E.answer.value }), 400);
const updateCountersSoon = debounce(updateCounters, 120);
E.answer.addEventListener('input', () => { autoGrow(); updateCountersSoon(); saveDraft(); });
E.task.addEventListener('input', () => { E.sampleNote.hidden = true; saveDraft(); updateStale(); });
E.model.addEventListener('input', () => { saveDraft(); updateStale(); });
window.addEventListener('pagehide', () => saveDraft.flush());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveDraft.flush();
  else { stopFlash(); tick(); }
});

/* ===================== files (.txt / .docx) ===================== */
class ImportError extends Error {}                        // our own messages, shown as they are
async function readText(file) {
  const buf = await file.arrayBuffer(), b = new Uint8Array(buf);
  if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(buf);   // Notepad "Unicode"
  if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(buf);
  let zeros = 0;                                          // UTF-16 without a byte-order mark: every other byte is 0
  for (let i = 1; i < Math.min(b.length, 2000); i += 2) if (b[i] === 0) zeros++;
  if (b.length > 3 && zeros > Math.min(b.length, 2000) / 4) return new TextDecoder('utf-16le').decode(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}
async function readDocx(file) {
  const u8 = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(u8.buffer);
  const broken = () => new ImportError('File .docx bị hỏng hoặc không phải file Word. Hãy mở file trong Word, lưu lại rồi thử lại, hoặc sao chép nội dung.');
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw broken();
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true), entry = null;
  const dec = new TextDecoder();
  for (let k = 0; k < count && p + 46 <= u8.length; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    if (dec.decode(u8.subarray(p + 46, p + 46 + nlen)) === 'word/document.xml') { entry = { method, csize, off }; break; }
    p += 46 + nlen + xlen + clen;
  }
  if (!entry) throw new ImportError('Không tìm thấy nội dung văn bản trong file .docx.');
  if (entry.off + 30 > u8.length) throw broken();
  const start = entry.off + 30 + dv.getUint16(entry.off + 26, true) + dv.getUint16(entry.off + 28, true);
  if (start + entry.csize > u8.length) throw broken();
  const data = u8.subarray(start, start + entry.csize);
  let xmlBytes;
  if (entry.method === 0) xmlBytes = data;
  else if (entry.method === 8 && typeof DecompressionStream !== 'undefined') {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { throw broken(); }                       // corrupt deflate data (the browser reports it as a network error)
  } else throw new ImportError('Trình duyệt này không giải nén được file .docx. Hãy mở file trong Word và sao chép nội dung.');
  const xml = new DOMParser().parseFromString(dec.decode(xmlBytes), 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw broken();
  const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paras = [];
  for (const para of xml.getElementsByTagNameNS(NS, 'p')) {
    if (para.parentNode && para.parentNode.closest && para.parentNode.closest('p')) continue;
    let s = '';
    for (const node of para.getElementsByTagNameNS(NS, '*')) {
      if (node.localName === 't') s += node.textContent;
      else if (node.localName === 'tab') s += '\t';
      else if (node.localName === 'br' || node.localName === 'cr') s += '\n';
    }
    paras.push(s);
  }
  return paras.join('\n');
}
function cleanImported(t) {
  return t.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
let fileTarget = null;
$$('[data-open]').forEach(b => b.addEventListener('click', () => {
  fileTarget = b.dataset.open === 'task' ? E.task : E.model;
  E.fileInput.value = '';
  E.fileInput.click();
}));
async function importFile(file, target) {
  const name = file.name || '';
  if (!/\.(txt|md|docx)$/i.test(name) && !/^text\//.test(file.type || '')) {
    toast(/\.doc$/i.test(name) ? 'File .doc (Word đời cũ) chưa đọc được. Hãy lưu lại thành .docx hoặc .txt.' : 'Chỉ mở được file .txt, .md hoặc .docx.');
    return;
  }
  try {
    const raw = /\.docx$/i.test(name) ? await readDocx(file) : await readText(file);
    const text = cleanImported(raw);
    if (!text) { toast('File không có nội dung văn bản.'); return; }
    target.value = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    if (target === E.model && E.model.hidden) toast(`Đã nhập bài mẫu (${A.countWords(text)} từ). Bài mẫu đang ẩn.`);
    else toast(`Đã nhập „${name}“ (${A.countWords(text)} từ).`);
  } catch (err) {
    toast(err instanceof ImportError ? err.message : `Không đọc được „${name}“: file có thể bị hỏng. Hãy mở bằng Word hoặc Notepad, lưu lại rồi thử lại, hoặc sao chép nội dung.`);
  }
}
E.fileInput.addEventListener('change', () => { const f = E.fileInput.files && E.fileInput.files[0]; if (f && fileTarget) importFile(f, fileTarget); });
[E.task, E.model].forEach(ta => {
  ta.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  ta.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { e.preventDefault(); importFile(f, ta); } });
});

/* ===================== grading & results ===================== */
let lastResult = null, currentAttempt = null, grading = false;
function timeUsed() {
  if (T.state === 'idle') return null;
  return { used: Math.round(T.total - Math.max(0, remaining())), total: T.total };
}
function runAnalysis(text, task, model) {
  const before = Spell.engineErrors;
  const res = A.analyze(text, { task, model, k: settings.k, speller });
  if (Spell.engineErrors - before > 2) {                  // the engine itself is failing, not one odd word: no score
    Spell.broken = true;
    res.spellReady = false;
    setSpellStatus('bad', 'Bộ kiểm tra chính tả gặp lỗi', 'Hãy tải lại trang rồi chấm lại.');
  }
  return res;
}
function spellMissingNote() {
  if (Spell.broken) return 'Bộ kiểm tra chính tả gặp lỗi khi chấm, nên chưa có điểm. Hãy tải lại trang rồi chấm lại (bản nháp vẫn được giữ).';
  if (Spell.failed) return 'Không tải được từ điển, nên chưa kiểm tra chính tả và chưa có điểm. ' + SPELL_FAIL_HINT;
  return 'Từ điển đang tải, nên chưa kiểm tra chính tả. Kết quả sẽ tự cập nhật khi tải xong.';
}
async function grade() {
  if (grading) return;
  closePop();
  if (!E.backdrop.hidden) closeModal(null);
  if (!A.countWords(E.answer.value)) { toast('Bài viết đang trống. Hãy viết bài trước khi chấm.'); E.answer.focus(); return; }
  if (active()) {
    const ok = await confirmBox('Nộp bài và chấm điểm?', `Đồng hồ sẽ dừng ở ${fmt(remaining())}. Thời gian đã dùng được ghi vào kết quả.`, 'Nộp bài');
    if (!ok || !active()) return;
    stopTimer();
  }
  // the clock's time belongs to the letter handed in: taken now (the clock could be restarted while the dictionary loads),
  // and only for the first grading after the clock stopped - later revisions are untimed
  const run = timerRun;
  const handIn = (T.state === 'done' || T.state === 'stopped') && !T.graded ? timeUsed() : null;
  grading = true;
  E.btnGrade.disabled = true;
  E.btnGrade.textContent = Spell.ready ? 'Đang chấm…' : 'Đang tải từ điển…';
  try {
    if (!Spell.ready && !Spell.failed && Spell.promise) await Promise.race([Spell.promise, sleep(15000)]);
    await sleep(20);                                      // let the button repaint before the work
    const text = E.answer.value;                          // the sheet as it is now (typing may continue while the dictionary loads)
    if (!A.countWords(text)) { toast('Bài viết đang trống. Hãy viết bài trước khi chấm.'); return; }
    const res = runAnalysis(text, E.task.value, E.model.value);
    res.time = handIn;
    if (handIn && run === timerRun) { T.graded = true; persistTimer(); }
    res.at = Date.now();
    // the Leitpunkte ticks belong to the task: a revised letter for the same task keeps them
    res.leitChecked = lastResult && lastResult.task === res.task ? lastResult.leitChecked.slice() : [];
    lastResult = res;
    saveAttempt(res, true);
    showResult(res, true);
  } catch (err) {
    toast('Không chấm được bài: ' + (err && err.message || err) + '. Hãy tải lại trang rồi thử lại (bản nháp vẫn được giữ).');
  } finally {
    grading = false;
    E.btnGrade.disabled = false;
    applyTimerUI();
  }
}
function showResult(res, scroll) {
  renderResults(res);
  if (currentView !== 'practice') selectView('practice');   // e.g. "Chấm điểm ngay" when time ran out on another tab
  E.results.hidden = false;
  selectTab('tab-score');
  updateStale();
  if (scroll) E.results.scrollIntoView({ behavior: smooth(), block: 'start' });
}
// Same attempt, new marks (personal words, k, the dictionary finished loading). persist=false only re-displays.
function regrade(persist = true) {
  if (!lastResult) return false;
  const prev = lastResult;
  try {
    const res = runAnalysis(prev.rawText, prev.task, prev.model);
    res.time = prev.time; res.at = prev.at; res.leitChecked = prev.leitChecked; res.review = prev.review && !persist;
    lastResult = res;
    if (persist) saveAttempt(res, false);
    renderResults(res);
    updateStale();
    return true;
  } catch (err) {
    toast('Không chấm lại được: ' + (err && err.message || err) + '. Hãy tải lại trang.');
    return false;
  }
}
function ratingOf(score) {
  if (score >= 90) return ['Rất tốt', 'ok', 'good'];
  if (score >= 75) return ['Tốt', 'ok', 'good'];
  if (score >= 50) return ['Trung bình', 'warn', 'mid'];
  return ['Cần luyện thêm', 'bad', 'low'];
}
function chk(ok, yes, no) { return `<span class="pill ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(ok ? yes : no)}</span>`; }
const TYPE_LABEL = { R: 'Chính tả', G: 'Viết hoa đầu câu' };
function renderResults(res) {
  const [rating, pillKind, scoreKind] = ratingOf(res.score);
  const t = res.time, L = res.letter;
  const errRows = res.uniq.map((u, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td><span class="w bad">${esc(u.w)}</span></td>
      <td class="num">${u.n}</td>
      <td>${u.sugg.length ? `<div class="sugg">${u.sugg.map(s => `<span>${esc(s)}</span>`).join('')}</div>` : '<span class="muted">—</span>'}</td>
      ${res.cmp ? `<td>${u.similar ? `<span class="w">${esc(u.similar)}</span>` : '<span class="muted">—</span>'}</td>` : ''}
      <td>${TYPE_LABEL[u.type]}</td>
      <td>${u.type === 'R' ? `<button type="button" class="btn btn-sm" data-addword="${esc(u.w)}">Thêm vào Từ của tôi</button>` : ''}</td>
    </tr>`).join('');
  const hintItems = res.hints.map(h => `<li><b class="w" lang="de">${esc(h.w)}</b> — ${esc(A.HINT_TEXT[h.key] || '')}</li>`).join('');
  const below0 = res.score === 0 && 100 - res.k * res.fq < 0;
  E.paneScore.innerHTML = `
    <div class="scorehead">
      <div class="score ${res.spellReady ? scoreKind : ''}"><b>${res.spellReady ? res.score : '—'}</b><span>/ 100</span></div>
      <div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${res.spellReady ? `<span class="pill ${pillKind}">${esc(rating)}</span>` : ''}<span class="muted small">${esc(dateStr(res.at))}</span></div>
        <p class="formula">Điểm = 100 − ${res.k} × Fehlerquotient (số lỗi trên 100 từ) = 100 − ${res.k} × ${nf1.format(res.fq)}${below0 ? ', thấp nhất là 0' : ''}.</p>
        ${res.spellReady ? '' : `<p class="formula" style="color:var(--red)">${esc(spellMissingNote())}</p>`}
      </div>
    </div>
    <div class="stats">
      <div class="stat"><div class="v">${res.words}</div><div class="k">Số từ</div></div>
      <div class="stat"><div class="v">${res.errors}</div><div class="k">Lỗi tính điểm (${res.uniq.length} từ khác nhau)</div></div>
      <div class="stat"><div class="v">${nf1.format(res.fq)}</div><div class="k">Fehlerquotient · lỗi / 100 từ</div></div>
      <div class="stat"><div class="v">${t ? esc(fmt(t.used)) : '—'}</div><div class="k">${t ? 'Thời gian đã dùng / ' + esc(fmt(t.total)) : 'Không bấm giờ'}</div></div>
      <div class="stat"><div class="v">${res.sentences}</div><div class="k">Câu (ước tính)</div></div>
      <div class="stat"><div class="v">${res.sentences ? nf1.format(res.words / res.sentences) : '—'}</div><div class="k">Từ trung bình mỗi câu</div></div>
    </div>
    <div>
      <h3>Hình thức thư</h3>
      <div class="checks">
        ${L.betreff ? '<span class="pill info">Có dòng Betreff</span>' : ''}
        ${chk(L.anrede, 'Có lời chào đầu thư (Anrede)', 'Thiếu lời chào đầu thư (Anrede)')}
        ${L.anrede ? chk(L.komma, 'Có dấu phẩy sau lời chào', 'Thiếu dấu phẩy sau lời chào') : ''}
        ${chk(L.gruss, 'Có lời chào cuối thư (Grußformel)', 'Thiếu lời chào cuối thư (Grußformel)')}
        <span class="pill info">${L.paragraphs} đoạn văn</span>
        ${L.formal ? `<span class="pill">${L.formal === 'formal' ? 'Thư trang trọng (Sie)' : 'Thư thân mật (du)'}</span>` : ''}
      </div>
    </div>
    ${res.leit.length ? `<div><h3>Các ý của đề (Leitpunkte) — tự đánh dấu</h3><ul class="leit">${res.leit.map((p, i) => `<li><label><input type="checkbox" data-lp="${i}"${res.leitChecked[i] ? ' checked' : ''}><span lang="de">${esc(p)}</span></label></li>`).join('')}</ul></div>` : ''}
    <div>
      <h3>Danh sách lỗi</h3>
      ${res.uniq.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Từ trong bài</th><th>Lần</th><th>Gợi ý sửa</th>${res.cmp ? '<th>Trong bài mẫu</th>' : ''}<th>Loại</th><th></th></tr></thead><tbody lang="de">${errRows}</tbody></table></div>`
        : `<p class="empty">${res.spellReady ? 'Không tìm thấy lỗi chính tả nào. Rất tốt!' : 'Chưa kiểm tra được chính tả.'}</p>`}
      ${res.namesIgnored.length ? `<p class="muted small" style="margin:8px 0 0">Tên riêng không tính là lỗi (có trong đề bài, ở dòng chào hoặc ở chữ ký): <span lang="de">${res.namesIgnored.map(esc).join(', ')}</span>.</p>` : ''}
    </div>
    ${hintItems ? `<div><h3>Nên tự kiểm tra lại (không trừ điểm)</h3><ul class="hintlist">${hintItems}</ul></div>` : ''}`;

  // correction view: every counted error (R / G) and every hint (?) marked in the text
  const marks = res.occ.map(o => ({ s: o.s, e: o.e, cls: 'm-err', sup: o.u.type, attr: `data-k="${res.uniq.indexOf(o.u)}"` }))
    .concat(res.hints.map((h, idx) => ({ s: h.s, e: h.e, cls: 'm-hint', sup: '?', attr: `data-h="${idx}"` })))
    .sort((a, b) => a.s - b.s);
  let html = '', pos = 0;
  for (const m of marks) {
    if (m.s < pos) continue;
    html += esc(res.text.slice(pos, m.s));
    html += `<mark class="${m.cls}" ${m.attr} tabindex="0">${esc(res.text.slice(m.s, m.e))}<sup aria-hidden="true">${m.sup}</sup></mark>`;
    pos = m.e;
  }
  html += esc(res.text.slice(pos));
  E.paneCorr.innerHTML = `
    <div class="legend"><span><i style="background:var(--red-soft);box-shadow:inset 0 -2px 0 var(--red)"></i>R — lỗi chính tả, G — thiếu viết hoa đầu câu; bấm vào để xem gợi ý</span><span><i style="background:var(--amber-soft);box-shadow:inset 0 -2px 0 var(--amber)"></i>? — nên tự kiểm tra, không trừ điểm</span></div>
    <div class="corr" lang="de">${html}</div>`;

  // comparison with the model answer (offsets refer to the NFC text, exactly as analysis.js aligned it)
  if (!res.cmp) {
    E.paneCmp.innerHTML = '<p class="empty">Chưa có bài mẫu. Dán bài mẫu vào ô „Bài mẫu“ (hoặc bấm „Mở file“), rồi bấm Chấm điểm lại để so sánh từng từ.</p>';
    return;
  }
  const c = res.cmp, modelN = res.model.normalize('NFC');
  const col = (text, toks, inSet, cls) => {
    let out = '', p = 0;
    toks.forEach((tk, i) => {
      out += esc(text.slice(p, tk.s));
      const w = esc(text.slice(tk.s, tk.e));
      out += !c.aligned || inSet[i] ? w : `<mark class="${cls}">${w}</mark>`;
      p = tk.e;
    });
    return out + esc(text.slice(p));
  };
  E.paneCmp.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="v">${c.aligned ? pct(c.similarity) : '—'}</div><div class="k">Độ giống (cùng từ, cùng thứ tự)</div></div>
      <div class="stat"><div class="v">${pct(c.coverage)}</div><div class="k">Từ vựng của bài mẫu bạn đã dùng (${c.used}/${c.uniqB.length})</div></div>
      <div class="stat"><div class="v">${res.words} / ${A.countWords(modelN)}</div><div class="k">Số từ: bài bạn / bài mẫu</div></div>
    </div>
    ${c.aligned ? '' : '<p class="muted small">Hai bài quá dài để so khớp từng từ, nên chỉ có thống kê từ vựng.</p>'}
    ${c.missing.length ? `<div><h3>Từ hay trong bài mẫu mà bài bạn chưa dùng</h3><div class="wordchips" lang="de">${c.missing.map(w => `<span>${esc(w)}</span>`).join('')}</div></div>` : ''}
    ${c.aligned ? '<div class="legend"><span><i style="background:var(--red-soft);box-shadow:inset 0 -2px 0 var(--red)"></i>chỉ có trong bài bạn</span><span><i style="background:var(--green-soft);box-shadow:inset 0 -2px 0 var(--green)"></i>chỉ có trong bài mẫu</span><span>Chữ không tô: có ở cả hai bài, cùng thứ tự.</span></div>' : ''}
    <div class="cmp">
      <div class="cmp-col"><h4>Bài của bạn</h4><div class="cmp-text" lang="de">${col(res.text, c.A, c.inA, 'only-a')}</div></div>
      <div class="cmp-col"><h4>Bài mẫu</h4><div class="cmp-text" lang="de">${col(modelN, c.B, c.inB, 'only-b')}</div></div>
    </div>`;
}
E.paneScore.addEventListener('change', e => {
  const cb = e.target.closest('input[data-lp]');
  if (cb && lastResult) lastResult.leitChecked[+cb.dataset.lp] = cb.checked;
});
function errorPopHtml(u) {
  return `<div class="w" lang="de">${esc(u.w)}</div>
    <div class="muted small">${u.type === 'G' ? 'Đầu câu phải viết hoa (Großschreibung am Satzanfang).' : 'Lỗi chính tả (Rechtschreibung).'} Xuất hiện ${u.n} lần.</div>
    ${u.sugg.length ? `<div><div class="lbl">Gợi ý sửa</div><div class="sugg" lang="de">${u.sugg.map(s => `<span>${esc(s)}</span>`).join('')}</div></div>` : '<div class="muted small">Từ điển không có gợi ý.</div>'}
    ${u.similar ? `<div><div class="lbl">Trong bài mẫu</div><span class="w" lang="de" style="font-size:16px">${esc(u.similar)}</span></div>` : ''}
    ${u.type === 'R' ? `<div class="row"><button type="button" class="btn btn-sm" data-addword="${esc(u.w)}">Đây là từ đúng — thêm vào Từ của tôi</button></div>` : ''}`;
}
E.paneCorr.addEventListener('click', e => {
  const m = e.target.closest('mark');
  if (!m || !lastResult) return;
  if (m.dataset.k !== undefined) { const u = lastResult.uniq[+m.dataset.k]; if (u) openPop(m, errorPopHtml(u)); }
  else if (m.dataset.h !== undefined) {
    const h = lastResult.hints[+m.dataset.h];
    if (h) openPop(m, `<div class="w" lang="de">${esc(h.w)}</div><div class="small">${esc(A.HINT_TEXT[h.key] || '')}</div><div class="muted small">Gợi ý kiểm tra, không trừ điểm.</div>`);
  }
});
E.paneCorr.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('mark')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('click', e => {
  const b = e.target.closest('[data-addword]');
  if (b) addPersonalWord(b.dataset.addword);
});
function addPersonalWord(w) {
  w = String(w || '').normalize('NFC');
  if (!w) return;
  if (!settings.words.includes(w)) { settings.words.push(w); saveSettings(); }
  E.optWords.value = settings.words.join('\n');
  const refused = syncPersonalWords();
  closePop();
  if (refused.includes(w)) { toast(`Bộ kiểm tra chính tả không nhận được từ „${w}“, nên từ này vẫn bị đánh dấu.`); return; }
  if (regrade()) toast(`Đã thêm „${w}“ vào Từ của tôi. Kết quả đã được chấm lại.`);
}
function selectTab(id) {
  $$('.tab').forEach(t => {
    const on = t.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
  closePop();
}
$$('.tab').forEach(t => {
  t.addEventListener('click', () => selectTab(t.id));
  t.addEventListener('keydown', e => {
    const tabs = $$('.tab'), i = tabs.indexOf(t);
    let n = null;
    if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') n = tabs[(i + tabs.length - 1) % tabs.length];
    else if (e.key === 'Home') n = tabs[0];
    else if (e.key === 'End') n = tabs[tabs.length - 1];
    if (!n) return;
    e.preventDefault();
    selectTab(n.id); n.focus();
  });
});

/* ===================== history ===================== */
function firstLine(s) { const l = (s || '').split('\n').map(x => x.trim()).find(Boolean) || ''; return l.length > 70 ? l.slice(0, 68) + '…' : l; }
function loadHistory() { const h = store.get('history', []); return Array.isArray(h) ? h.filter(x => x && typeof x === 'object' && x.id) : []; }
function saveAttempt(res, isNew) {
  const hist = loadHistory();
  const same = h => !!h && h.text === res.rawText && h.taskFull === res.task;
  let prev = null;
  if (isNew) {
    // the very same letter (same text, same task) graded again is the same attempt, not a new row -
    // except a timed hand-in, which is always an attempt of its own
    if (!res.time) prev = hist.find(h => h.id === currentAttempt && same(h)) || (same(hist[0]) ? hist[0] : null);
  } else {
    prev = hist.find(h => h.id === currentAttempt) || null;
    if (!prev) return null;                               // the attempt was deleted from the history: don't bring it back
  }
  if (prev && !res.spellReady && prev.score != null) {    // a check without a working dictionary never replaces a real score
    currentAttempt = prev.id;
    return prev;
  }
  if (prev) {                                             // an attempt keeps its date and the time measured when it was handed in
    res.at = prev.t;
    if (!res.time && prev.used != null) res.time = { used: prev.used, total: prev.total };
  }
  const entry = { id: prev ? prev.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: res.at,
    task: firstLine(res.task), taskFull: res.task, modelFull: res.model, text: res.rawText, words: res.words, errors: res.errors,
    fq: res.fq, k: res.k, score: res.spellReady ? res.score : null, used: res.time ? res.time.used : null, total: res.time ? res.time.total : null };
  currentAttempt = entry.id;
  const i = hist.findIndex(h => h.id === entry.id);
  if (i >= 0) hist[i] = entry; else hist.unshift(entry);
  if (hist.length > 100) hist.length = 100;
  if (!store.set('history', hist) && !store.blocked && hist.length > 20) {   // quota full: make room, and say so
    const dropped = hist.length - 20;
    hist.length = 20;
    if (store.set('history', hist)) toast(`Bộ nhớ của trình duyệt đã đầy: đã xóa ${dropped} lần chấm cũ nhất để lưu kết quả mới.`);
  }
  renderHistory();
  return entry;
}
function renderHistory() {
  const hist = loadHistory();
  E.btnClearHist.disabled = E.btnClearHist2.disabled = !hist.length;
  renderStorageState();
  if (!hist.length) {
    E.histBody.innerHTML = '<p class="empty">Chưa có lần chấm nào. Mỗi lần bấm Chấm điểm, kết quả (điểm, số lỗi, thời gian) được lưu ở đây để bạn theo dõi tiến bộ.</p>';
    return;
  }
  const rows = hist.map((h, i) => {
    const prev = hist[i + 1];
    let trend = '';
    // compare only scores computed with the same deduction per error
    if (prev && h.score != null && prev.score != null && h.score !== prev.score && (h.k || 10) === (prev.k || 10)) {
      trend = h.score > prev.score ? `<span class="trend-up">↑ ${h.score - prev.score}</span>` : `<span class="trend-down">↓ ${prev.score - h.score}</span>`;
    }
    const kind = h.score == null ? '' : h.score >= 75 ? 'ok' : h.score >= 50 ? 'warn' : 'bad';
    return `<tr>
      <td style="white-space:nowrap">${esc(dateStr(h.t))}</td>
      <td lang="de">${esc(h.task || '—')}</td>
      <td class="num">${+h.words || 0}</td>
      <td class="num">${+h.errors || 0}</td>
      <td class="num"><span class="pill ${kind}" title="Trừ ${+h.k || 10} điểm cho mỗi lỗi / 100 từ">${h.score == null ? '—' : +h.score}</span> ${trend}</td>
      <td class="num">${h.used != null ? esc(fmt(h.used)) + ' / ' + esc(fmt(h.total)) : '—'}</td>
      <td><button type="button" class="btn btn-sm" data-reopen="${esc(h.id)}">Mở lại</button></td>
    </tr>`;
  }).join('');
  E.histBody.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Ngày</th><th>Đề</th><th>Từ</th><th>Lỗi</th><th>Điểm</th><th>Thời gian</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
E.histBody.addEventListener('click', async e => {
  const b = e.target.closest('[data-reopen]');
  if (!b) return;
  const h = loadHistory().find(x => x.id === b.dataset.reopen);
  if (!h) return;
  if (active()) { toast('Đồng hồ đang chạy. Hãy nộp bài hoặc đặt lại đồng hồ trước.'); return; }
  const hasModel = typeof h.modelFull === 'string';        // entries saved before this version have no model answer
  const lose = [];
  if (E.answer.value.trim() && E.answer.value !== h.text) lose.push('bài đang viết');
  if (h.taskFull && E.task.value.trim() && E.task.value !== h.taskFull) lose.push('đề bài');
  if (hasModel && E.model.value.trim() && E.model.value !== h.modelFull) lose.push('bài mẫu');
  if (lose.length && !(await confirmBox('Mở lại bài cũ?', `${capFirst(joinVi(lose))} trên trang sẽ được thay bằng nội dung của lần chấm ngày ${dateStr(h.t)}.`, 'Mở lại'))) return;
  if (T.state === 'done' || T.state === 'stopped') resetTimer();   // the old attempt has nothing to do with the last clock
  E.answer.value = String(h.text || '');
  if (h.taskFull) E.task.value = h.taskFull;
  if (hasModel) E.model.value = h.modelFull;
  E.answer.dispatchEvent(new Event('input')); E.task.dispatchEvent(new Event('input')); E.model.dispatchEvent(new Event('input'));
  E.sampleNote.hidden = !SAMPLES.some(x => x.task === E.task.value);
  selectView('practice');
  autoGrow();
  // Show that attempt's result again - display only: the history row is not rewritten (no waiting, so nothing typed
  // meanwhile can leak into the old attempt). If the dictionary is still loading, it fills in the marks when ready.
  currentAttempt = h.id;
  try {
    const res = runAnalysis(String(h.text || ''), h.taskFull || E.task.value, hasModel ? h.modelFull : E.model.value);
    res.time = h.used != null ? { used: h.used, total: h.total } : null;
    res.at = h.t;
    res.leitChecked = [];
    res.review = true;
    lastResult = res;
    showResult(res, true);
    applyExam();
    toast(res.spellReady ? `Đã mở lại bài ngày ${dateStr(h.t)}, chấm lại theo từ điển và cài đặt hiện tại (lịch sử giữ nguyên).`
      : `Đã mở lại bài ngày ${dateStr(h.t)}. Phần chính tả sẽ hiện khi từ điển tải xong.`);
  } catch (err) {
    lastResult = null;
    toast('Không chấm lại được bài cũ: ' + (err && err.message || err) + '. Bấm Chấm điểm để thử lại.');
  }
});
async function clearHistory() {
  if (!(await confirmBox('Xóa toàn bộ lịch sử?', 'Tất cả kết quả đã lưu trong trình duyệt này sẽ bị xóa. Không thể hoàn tác.', 'Xóa lịch sử', true))) return;
  store.del('history'); currentAttempt = null; renderHistory(); toast('Đã xóa lịch sử.');
}
E.btnClearHist.addEventListener('click', clearHistory);
E.btnClearHist2.addEventListener('click', clearHistory);

/* ===================== configuration: scoring, personal words, data ===================== */
function renderKExample() {
  E.kExample.textContent = `Ví dụ: 150 từ, 3 lỗi → ${nf1.format(2)} lỗi/100 từ → ${Math.max(0, Math.round(100 - settings.k * 2))} điểm`;
}
E.optK.addEventListener('change', () => {
  const v = Math.round(+E.optK.value);
  settings.k = v >= 1 && v <= 50 ? v : DEFAULTS.k;
  E.optK.value = settings.k; saveSettings(); renderKExample();
  if (lastResult) regrade();
});
E.optWords.addEventListener('change', () => {
  const parts = E.optWords.value.split(/[\s,;]+/).map(s => s.trim().normalize('NFC')).filter(Boolean);
  const ok = parts.filter(s => /^\p{L}[\p{L}\p{M}'’.-]*$/u.test(s)), bad = parts.filter(s => !ok.includes(s));
  settings.words = [...new Set(ok)];
  E.optWords.value = settings.words.join('\n'); saveSettings();
  const refused = syncPersonalWords();
  if (bad.length) toast(`Bỏ qua: ${bad.slice(0, 5).join(', ')} (chỉ nhận từ gồm chữ cái, dấu gạch nối hoặc dấu nháy).`);
  else if (refused.length) toast(`Bộ kiểm tra chính tả không nhận được: ${refused.slice(0, 5).join(', ')}.`);
  if (lastResult) regrade();
  renderStorageState();
});
function renderStorageState() {
  const bad = store.blocked || store.pending;
  E.saveWarn.hidden = !bad;
  E.storageState.style.color = bad ? 'var(--red)' : '';
  if (store.blocked) {
    E.storageState.textContent = 'Trình duyệt đang chặn lưu dữ liệu (ví dụ cửa sổ ẩn danh hoặc cài đặt bảo mật). Bản nháp, lịch sử và cài đặt chỉ giữ đến khi đóng trang.';
    return;
  }
  E.storageState.textContent = (store.pending ? 'Bộ nhớ của trình duyệt đã đầy: phần chưa lưu được chỉ giữ đến khi đóng trang. Hãy xóa bớt lịch sử. ' : '') +
    `Đang lưu: bản nháp, ${loadHistory().length} lần chấm trong lịch sử, cài đặt và ${settings.words.length} từ trong „Từ của tôi“.`;
}
function renderAbout() {
  E.aboutEngine.textContent = Spell.ready
    ? `Đang dùng: Hunspell ${Spell.version} · từ điển de_DE · ${A.EXTRA_WORDS.length} từ mới bổ sung · ${Spell.added.size} từ của bạn.`
    : Spell.failed ? 'Từ điển chưa tải được. Hãy kiểm tra thư mục lib (hunspell.js, dict-de.js) rồi tải lại trang.' : 'Đang tải từ điển…';
}
function renderConfig() { renderSitePanel(); renderStorageState(); renderAbout(); }
E.btnClearDraft.addEventListener('click', async () => {
  if (active()) { toast('Đồng hồ đang chạy. Hãy nộp bài hoặc đặt lại đồng hồ trước.'); return; }
  if (!(await confirmBox('Xóa bản nháp?', 'Bài đang viết, đề bài và bài mẫu sẽ bị xóa khỏi trang và khỏi trình duyệt này; trang nạp lại đề ví dụ. Lịch sử và cài đặt được giữ nguyên.', 'Xóa bản nháp', true))) return;
  store.del('draft');
  E.answer.value = '';
  loadSample('geburtstag', true);
  E.answer.dispatchEvent(new Event('input'));
  resetTimer(); lastResult = null; currentAttempt = null; E.results.hidden = true;
  toast('Đã xóa bản nháp.');
});
E.optExam.addEventListener('change', () => { settings.exam = E.optExam.checked; saveSettings(); applyExam(); });
E.optSound.addEventListener('change', () => {
  settings.sound = E.optSound.checked; saveSettings();
  if (!settings.sound) cancelAlarms();
  else if (T.state === 'running') scheduleAlarms(remaining());
});
E.btnModelToggle.addEventListener('click', () => { settings.showModel = !settings.showModel; saveSettings(); applyExam(); });

/* ===================== site: open / temporarily closed for maintenance ===================== */
// local     - the offline copy: the state lives in this browser (localStorage), optional PIN.
// shared    - the published page: one shared document site/config; only owner/editors write it (db rules), everyone reads it.
// connecting / unavailable - published page whose shared data is not (yet) reachable: the app stays usable.
const DEFAULT_MSG = 'Trang đang được bảo trì. Vui lòng quay lại sau.';
const SUBTLE = !!(window.crypto && crypto.subtle && typeof crypto.subtle.digest === 'function');
const Site = {
  mode: 'local', conf: null, local: { pinHash: '', salt: '' }, isAdmin: null,
  ref: null, unsub: null, retries: 0, loaded: false, saving: false, readOnly: false, lastError: '',
  preview: false, cfgUnlocked: false, pinFails: 0, pinLockUntil: 0, screen: false, formDirty: false
};
function cleanConf(d) {
  d = d && typeof d === 'object' ? d : {};
  return {
    maintenance: d.maintenance === true,
    message: typeof d.message === 'string' ? d.message.slice(0, 400) : '',
    until: Number.isFinite(d.until) && d.until > 0 ? d.until : 0,
    updatedAt: Number.isFinite(d.updatedAt) ? d.updatedAt : 0
  };
}
Site.conf = cleanConf(null);
function readLocalSite() {
  const s = store.get('site', null);
  const rec = s && typeof s === 'object' ? s : {};
  Site.local = { pinHash: typeof rec.pinHash === 'string' ? rec.pinHash : '', salt: typeof rec.salt === 'string' ? rec.salt : '' };
  if (Site.mode === 'local') Site.conf = cleanConf(rec);
}
function writeLocalSite(conf) {
  Site.conf = cleanConf(conf);
  return store.set('site', Object.assign({}, Site.conf, Site.local));
}
const maintActive = (c = Site.conf) => c.maintenance && !(c.until && Date.now() >= c.until);
function applySite() {
  const on = maintActive(), shared = Site.mode === 'shared';
  const adminView = shared && Site.isAdmin === true;
  const show = Site.preview || (on && (Site.mode === 'local' || (shared && !adminView)));
  setScreen(show);
  E.maintBanner.hidden = !(adminView && on && !Site.preview);
  if (!E.maintBanner.hidden) {
    E.maintBannerText.textContent = 'Trang đang tạm đóng bảo trì' + (Site.conf.until ? ` đến ${dateStr(Site.conf.until)}` : '') +
      ': người xem khác chỉ thấy thông báo bảo trì.';
    E.btnBannerReopen.disabled = Site.saving;
  }
  E.cfgDot.hidden = !(on && (adminView || Site.mode === 'local'));
  renderSitePanel();
}
function setScreen(show) {
  if (show !== Site.screen) {
    Site.screen = show;
    E.maintScreen.hidden = !show;
    E.appRoot.inert = show;
    if (show) E.appRoot.setAttribute('aria-hidden', 'true'); else E.appRoot.removeAttribute('aria-hidden');
    if (show) {
      if (!E.backdrop.hidden) closeModal(null);
      closePop();
      if (!Site.preview && T.state === 'running') { pauseTimer(); T.maintPaused = true; persistTimer(); }
      E.maintPin.value = ''; E.maintPinErr.hidden = true;
    } else {
      if (T.maintPaused && T.state === 'paused') toast('Trang đã mở lại. Đồng hồ đang tạm dừng — bấm „Tiếp tục“ để làm bài tiếp.');
      if (T.maintPaused) { T.maintPaused = false; persistTimer(); }
    }
  }
  if (show) {
    const c = Site.conf;
    const msg = Site.preview ? E.maintMessage.value.trim() : c.message;
    const until = Site.preview ? fromLocalInput(E.maintUntil.value) : c.until;
    E.maintMsg.textContent = msg || DEFAULT_MSG;
    const left = until > 0 ? (until - Date.now()) / 1000 : 0;
    E.maintEta.hidden = !(left > 0);
    if (left > 0) E.maintEta.textContent = `Dự kiến mở lại lúc ${dateStr(until)} (còn ${fmt(left)})`;
    E.maintTimerNote.hidden = !T.maintPaused;
    const local = Site.mode === 'local';
    // reopen controls: local copy (PIN if set); published page only when this viewer's rights are unknown (the server decides)
    E.maintAdmin.hidden = !(Site.preview || local || (Site.mode === 'shared' && Site.isAdmin === null));
    E.maintPinRow.hidden = Site.preview || !(local && Site.local.pinHash);
    E.btnMaintReopen.hidden = Site.preview;
    E.btnMaintReopen.disabled = Site.saving;
    E.btnMaintClosePreview.hidden = !Site.preview;
    if (!E.maintScreen.contains(document.activeElement)) {
      const f = !E.maintPinRow.hidden && !E.maintAdmin.hidden ? E.maintPin : Site.preview ? E.btnMaintClosePreview : E.maintTitle;
      try { f.focus({ preventScroll: true }); } catch (e) { /* not focusable yet */ }
    }
  }
  updateFloat();
}
function pill(el, kind, text) { el.className = 'pill ' + kind; el.textContent = text; }
function renderSitePanel() {
  const c = Site.conf, on = maintActive(), local = Site.mode === 'local', shared = Site.mode === 'shared';
  if (Site.mode === 'connecting') pill(E.siteStatus, 'info', 'Đang kết nối…');
  else if (Site.mode === 'unavailable') pill(E.siteStatus, '', 'Không đổi được ở đây');
  else if (on) pill(E.siteStatus, 'bad', 'Đang tạm đóng');
  else pill(E.siteStatus, 'ok', 'Đang mở');
  const expired = c.maintenance && c.until && !on ? ` Lịch đóng trước đó đã hết hạn lúc ${dateStr(c.until)}, nên trang đang mở.` : '';
  E.siteScope.textContent = {
    local: 'Bản chạy từ tệp trên máy: trạng thái đóng / mở chỉ áp dụng cho trình duyệt này. Khi đóng, màn hình bảo trì che toàn bộ ứng dụng cho đến khi mở lại (hoặc đến giờ mở lại đã đặt).',
    connecting: 'Đang đọc trạng thái trang từ dữ liệu chung…',
    shared: Site.isAdmin === false || Site.readOnly ? 'Bản trực tuyến.'
      : 'Bản trực tuyến: khi tạm đóng, người mở trang (trừ chủ trang và người có quyền chỉnh sửa) chỉ thấy màn hình bảo trì. Thay đổi có hiệu lực ngay cả với người đang mở trang. Người xem chưa đăng nhập không đọc được trạng thái này nên vẫn dùng được trang.',
    unavailable: 'Không đọc được dữ liệu chung của trang (ví dụ trang được mở trực tiếp bên ngoài claude.ai, người xem chưa đăng nhập, hoặc kết nối vừa bị mất), nên không đọc và không đổi được trạng thái bảo trì. Ứng dụng vẫn dùng bình thường; nếu vừa mất kết nối, hãy tải lại trang.'
  }[Site.mode] + (local || shared ? expired : '');
  const pinLocked = local && !!Site.local.pinHash && !Site.cfgUnlocked;
  const canChange = local ? !pinLocked : shared && Site.isAdmin !== false && !Site.readOnly;
  E.siteViewerNote.hidden = !(shared && (Site.isAdmin === false || Site.readOnly));
  E.siteLocked.hidden = !pinLocked;
  E.siteForm.hidden = !canChange;
  E.pinBox.hidden = !local;
  E.btnMaintToggle.textContent = on ? 'Mở lại trang' : 'Tạm đóng để bảo trì';
  E.btnMaintToggle.className = 'btn ' + (on ? 'btn-primary' : 'btn-solid-danger');
  E.btnMaintSave.hidden = !on;
  for (const b of [E.btnMaintToggle, E.btnMaintSave, E.btnMaintPreview, E.btnClearUntil, E.btnSetPin]) b.disabled = Site.saving;
  E.btnSetPin.disabled = Site.saving || !SUBTLE;
  E.newPin.disabled = !SUBTLE;
  E.btnClearPin.disabled = Site.saving || !Site.local.pinHash;
  E.pinState.textContent = !SUBTLE ? 'Trình duyệt này không hỗ trợ mã PIN.'
    : Site.local.pinHash ? 'Đã đặt mã PIN: cần nhập mã khi mở lại trang và khi đổi phần này. Mã PIN chỉ là khóa tiện lợi trên máy này, không phải bảo mật thật (người dùng máy vẫn có thể xóa dữ liệu trình duyệt).'
    : 'Chưa đặt mã PIN: ai dùng trình duyệt này cũng mở lại được trang.';
}
function fillSiteForm(force) {
  if (!force && (Site.formDirty || E.siteForm.contains(document.activeElement))) return;
  E.maintMessage.value = Site.conf.message;
  E.maintUntil.value = Site.conf.until && Site.conf.until > Date.now() ? toLocalInput(Site.conf.until) : '';
  Site.formDirty = false;
}
[E.maintMessage, E.maintUntil].forEach(el => el.addEventListener('input', () => { Site.formDirty = true; }));
function siteNote(text, bad) { E.siteNote.textContent = text; E.siteNote.style.color = bad ? 'var(--red)' : ''; }
async function dbWrite(fn) {
  try { return await fn(); }
  catch (e) {
    if (e && e.code === 'unavailable') { await sleep(400 + Math.random() * 800); return await fn(); }   // transient: retry once
    throw e;
  }
}
// Message for a failed shared write, by error code (db.d.ts). Codes that are final for this page load end shared mode.
const FINAL_CODES = new Set(['revoked', 'not_granted', 'capability_disabled', 'capability_removed']);
function writeErrorText(code) {
  if (code === 'invalid_argument') return 'Chỉ chủ trang hoặc người có quyền chỉnh sửa mới thay đổi được trạng thái trang.';
  if (code === 'quota_exceeded') return 'Bộ nhớ dữ liệu của trang đã đầy, không lưu được.';
  if (code === 'resource_exhausted') return 'Thao tác quá nhanh. Hãy đợi vài giây rồi thử lại.';
  if (FINAL_CODES.has(code)) return 'Trang không còn kết nối được với dữ liệu chung. Hãy tải lại trang.';
  return 'Không lưu được (mạng hoặc dịch vụ đang bận). Hãy thử lại sau ít phút.';
}
// Writes the site state. Returns '' on success, otherwise the error code (the message is already shown).
async function saveConf(conf, okMsg) {
  if (Site.saving) return 'busy';
  conf = Object.assign(cleanConf(conf), { updatedAt: Date.now() });
  if (Site.mode === 'local') {
    const stored = writeLocalSite(conf);
    Site.formDirty = false;
    applySite(); fillSiteForm(true);
    siteNote(stored ? okMsg : okMsg + ' Trình duyệt không cho lưu dữ liệu, nên trạng thái này chỉ giữ đến khi đóng trang.', !stored);
    return '';
  }
  if (Site.mode !== 'shared' || !Site.ref) return 'unavailable';
  Site.saving = true; applySite(); siteNote('Đang lưu…');
  let code = '';
  try {
    await dbWrite(() => Site.ref.set(conf));
    Site.conf = conf;                                     // the live snapshot confirms the same value
    Site.formDirty = false;
    siteNote(okMsg);
  } catch (e) {
    code = e && e.code || 'unavailable';
    const text = writeErrorText(code);
    if (code === 'invalid_argument') Site.readOnly = true;
    if (FINAL_CODES.has(code)) { Site.mode = 'unavailable'; Site.conf = cleanConf(null); }
    siteNote(text, true);
    if (currentView !== 'config' && !Site.screen) toast(text);   // e.g. the banner's "Mở lại trang" on the writing desk
  } finally {
    Site.saving = false;
    applySite();
    if (!code) fillSiteForm(true);                        // a failed save keeps what the owner typed
  }
  return code;
}
function readForm(closing) {
  const message = E.maintMessage.value.trim().slice(0, 400);
  let until = 0;
  if (E.maintUntil.value) {
    until = fromLocalInput(E.maintUntil.value);
    if (!Number.isFinite(until)) return { error: 'Giờ mở lại không hợp lệ.' };
    if (closing && until <= Date.now() + 30000) return { error: 'Giờ tự mở lại phải ở tương lai (ít nhất 1 phút nữa), hoặc để trống.' };
  }
  return { message, until };
}
E.btnMaintToggle.addEventListener('click', async () => {
  if (maintActive()) { await saveConf(Object.assign({}, Site.conf, { maintenance: false, until: 0 }), 'Đã mở lại trang.'); return; }
  const f = readForm(true);
  if (f.error) { siteNote(f.error, true); E.maintUntil.focus(); return; }
  const who = Site.mode === 'local' ? 'Trình duyệt này sẽ chỉ hiện màn hình bảo trì' : 'Người mở trang (trừ chủ trang và người có quyền chỉnh sửa) sẽ chỉ thấy màn hình bảo trì';
  const until = f.until ? ` đến ${dateStr(f.until)}` : ' cho đến khi được mở lại';
  if (!(await confirmBox('Tạm đóng trang?', `${who}${until}. Người đang làm bài sẽ được tạm dừng đồng hồ.`, 'Tạm đóng', true))) return;
  await saveConf({ maintenance: true, message: f.message, until: f.until }, 'Đã tạm đóng trang.');
});
E.btnMaintSave.addEventListener('click', async () => {
  const f = readForm(true);
  if (f.error) { siteNote(f.error, true); return; }
  await saveConf({ maintenance: true, message: f.message, until: f.until }, 'Đã lưu lời nhắn và giờ mở lại.');
});
E.btnClearUntil.addEventListener('click', () => { E.maintUntil.value = ''; Site.formDirty = true; });
E.btnMaintPreview.addEventListener('click', () => { Site.preview = true; applySite(); });
E.btnMaintClosePreview.addEventListener('click', () => { Site.preview = false; applySite(); E.btnMaintPreview.focus(); });
E.btnBannerReopen.addEventListener('click', () => saveConf(Object.assign({}, Site.conf, { maintenance: false, until: 0 }), 'Đã mở lại trang.'));

/* ---- local PIN (SHA-256 with a random salt, kept in this browser) ---- */
async function hashPin(pin, salt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}
function showErr(el, text) { el.textContent = text; el.hidden = false; }
async function checkPin(pin, errEl) {
  const now = Date.now();
  if (Site.pinLockUntil > now) { showErr(errEl, `Nhập sai nhiều lần. Hãy thử lại sau ${Math.ceil((Site.pinLockUntil - now) / 1000)} giây.`); return false; }
  if (!SUBTLE) { showErr(errEl, 'Trình duyệt này không kiểm tra được mã PIN.'); return false; }
  let ok = false;
  try { ok = (await hashPin(String(pin || '').trim(), Site.local.salt)) === Site.local.pinHash; } catch (e) { ok = false; }
  if (ok) { Site.pinFails = 0; errEl.hidden = true; return true; }
  if (++Site.pinFails >= 5) { Site.pinFails = 0; Site.pinLockUntil = now + 30000; }
  showErr(errEl, 'Mã PIN không đúng.');
  return false;
}
E.btnCfgUnlock.addEventListener('click', async () => {
  if (await checkPin(E.cfgPin.value, E.cfgPinErr)) { Site.cfgUnlocked = true; E.cfgPin.value = ''; renderSitePanel(); fillSiteForm(true); E.maintMessage.focus(); }
});
E.cfgPin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); E.btnCfgUnlock.click(); } });
E.btnSetPin.addEventListener('click', async () => {
  const pin = E.newPin.value.trim();
  if (!/^\d{4,12}$/.test(pin)) { siteNote('Mã PIN gồm 4 đến 12 chữ số.', true); E.newPin.focus(); return; }
  const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try { Site.local = { pinHash: await hashPin(pin, salt), salt }; } catch (e) { siteNote('Không tạo được mã PIN trên trình duyệt này.', true); return; }
  const stored = writeLocalSite(Site.conf);
  Site.cfgUnlocked = true; E.newPin.value = '';
  renderSitePanel();
  siteNote(stored ? 'Đã lưu mã PIN.' : 'Trình duyệt không cho lưu dữ liệu: mã PIN chỉ có hiệu lực đến khi tải lại trang.', !stored);
});
E.newPin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); E.btnSetPin.click(); } });
E.btnClearPin.addEventListener('click', async () => {
  if (!(await confirmBox('Xóa mã PIN?', 'Sau khi xóa, ai dùng trình duyệt này cũng mở lại được trang khi đang bảo trì.', 'Xóa mã PIN', true))) return;
  Site.local = { pinHash: '', salt: '' };
  writeLocalSite(Site.conf);
  renderSitePanel();
  siteNote('Đã xóa mã PIN.');
});
E.btnMaintReopen.addEventListener('click', async () => {
  E.maintPinErr.hidden = true;
  if (Site.mode === 'local') {
    if (Site.local.pinHash && !(await checkPin(E.maintPin.value, E.maintPinErr))) { E.maintPin.select(); return; }
    await saveConf(Object.assign({}, Site.conf, { maintenance: false, until: 0 }), 'Đã mở lại trang.');
  } else if (Site.mode === 'shared') {
    const code = await saveConf(Object.assign({}, Site.conf, { maintenance: false, until: 0 }), 'Đã mở lại trang.');
    if (code && Site.screen) showErr(E.maintPinErr, code === 'invalid_argument' ? 'Chỉ chủ trang hoặc người có quyền chỉnh sửa mới mở lại được trang.' : writeErrorText(code));
  }
});
E.maintPin.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); E.btnMaintReopen.click(); } });
E.maintTitle.tabIndex = -1;
window.addEventListener('storage', e => {                 // another tab of the offline copy opened or closed the page
  if (e.key === 'b1st:site' && Site.mode === 'local') { readLocalSite(); applySite(); fillSiteForm(false); }
});
// the countdown on the screen and the automatic reopening at the set time
setInterval(() => { if (Site.screen || (Site.conf.maintenance && Site.conf.until)) applySite(); }, 1000);

/* ---- the published page: one shared document, live ---- */
function subscribeSite() {
  if (Site.unsub) { try { Site.unsub(); } catch (e) { /* already closed */ } Site.unsub = null; }
  try {
    Site.unsub = Site.ref.onSnapshot(snap => {
      Site.loaded = true; Site.retries = 0; Site.lastError = '';
      Site.conf = cleanConf(snap && snap.exists ? snap.data() : null);
      applySite(); fillSiteForm(false);
    }, err => {
      Site.unsub = null;
      const code = Site.lastError = err && err.code || 'unavailable';
      // a dropped bridge, a busy service or an unknown code: subscribe again (backoff ~4 s ... ~2 min), keeping the
      // last known state meanwhile. invalid_argument / revoked are final, and so is a sixth failure: then the page
      // fails open - a learner must never stay locked out because the live state can no longer be read.
      if (code !== 'invalid_argument' && code !== 'revoked' && Site.retries < 5) {
        Site.retries++;
        setTimeout(subscribeSite, 2000 * 2 ** Site.retries);
      } else {
        Site.mode = 'unavailable'; Site.conf = cleanConf(null);
      }
      applySite();
    });
  } catch (e) {
    Site.mode = 'unavailable'; Site.conf = cleanConf(null); applySite();
  }
}
async function initSite() {
  readLocalSite();
  const C = window.claude;
  if (!C || typeof C.use !== 'function') { Site.mode = 'local'; readLocalSite(); applySite(); fillSiteForm(true); return; }
  Site.mode = 'connecting'; Site.conf = cleanConf(null); applySite();
  let db = null, user = null;
  try {
    [db, user] = await Promise.all([Promise.resolve(C.use('db')).catch(() => null), Promise.resolve(C.use('user')).catch(() => null)]);
  } catch (e) { db = null; }
  if (!db) { Site.mode = 'unavailable'; applySite(); return; }
  if (user) { try { Site.isAdmin = (await user.canEdit()) === true; } catch (e) { Site.isAdmin = null; } }
  try { Site.ref = db.doc('site/config'); } catch (e) { Site.mode = 'unavailable'; applySite(); return; }
  Site.mode = 'shared';
  applySite();
  subscribeSite();
}

/* ===================== buttons ===================== */
E.btnStart.addEventListener('click', () => {
  if (T.state === 'running') pauseTimer();
  else if (T.state === 'paused') resumeTimer();
  else startTimer();
});
E.btnReset.addEventListener('click', async () => {
  if (active() && !(await confirmBox('Đặt lại đồng hồ?', 'Lượt làm bài đang chạy sẽ bị hủy. Bài viết vẫn được giữ nguyên.', 'Đặt lại', true))) return;
  resetTimer();
});
E.timeInput.addEventListener('input', () => {
  const sec = parseTime(E.timeInput.value);
  if (validSec(sec)) {
    E.timeErr.hidden = true;
    if (!active()) { settings.time = E.timeInput.value.trim(); saveSettings(); }
    // only a clock at rest takes the new time; "Hết giờ" / "Đã nộp bài" stay until the next start
    if (T.state === 'idle') { T.total = sec; T.remaining = sec; persistTimer(); }
  }
  applyTimerUI();
});
E.timeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (!active()) startTimer(); } });
$$('.chip[data-time]').forEach(c => c.addEventListener('click', () => { E.timeInput.value = c.dataset.time; E.timeInput.dispatchEvent(new Event('input')); }));
E.btnFull.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (e) { toast('Trình duyệt không cho phép toàn màn hình ở đây. Bạn có thể nhấn F11.'); }
});
E.btnUnlock.addEventListener('click', () => { T.unlocked = true; persistTimer(); applyExam(); E.answer.focus(); });
E.btnGrade.addEventListener('click', grade);
E.btnDemo.addEventListener('click', async () => {
  if (active()) { toast('Đồng hồ đang chạy. Hãy nộp bài hoặc đặt lại đồng hồ trước.'); return; }
  const s = SAMPLES[0];
  const lose = [];
  if (E.answer.value.trim() && E.answer.value !== DEMO_ANSWER) lose.push('bài đang viết');
  if (E.task.value.trim() && E.task.value !== s.task) lose.push('đề bài');
  if (E.model.value.trim() && E.model.value !== s.model) lose.push('bài mẫu');
  if (lose.length && !(await confirmBox('Dùng bài ví dụ?', `${capFirst(joinVi(lose))} sẽ được thay bằng đề „${s.title}“ và một bài ví dụ có vài lỗi điển hình.`, 'Dùng bài ví dụ'))) return;
  if (T.state === 'done' || T.state === 'stopped') resetTimer();   // the demo is not part of the last timed attempt
  loadSample(s.id, true);
  E.answer.value = DEMO_ANSWER;
  E.answer.dispatchEvent(new Event('input'));
  grade();
});
E.btnNew.addEventListener('click', async () => {
  if ((E.answer.value.trim() || active()) &&
      !(await confirmBox('Bắt đầu bài mới?', 'Tờ giấy sẽ được xóa trắng và đồng hồ được đặt lại. Đề bài và bài mẫu vẫn giữ nguyên.', 'Bài mới', true))) return;
  E.answer.value = ''; E.answer.dispatchEvent(new Event('input'));
  resetTimer(); lastResult = null; currentAttempt = null; E.results.hidden = true;
  E.answer.focus();
});
SAMPLES.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title; E.sampleSel.appendChild(o); });
function loadSample(id, quiet) {
  const s = SAMPLES.find(x => x.id === id);
  if (!s) return;
  E.task.value = s.task; E.model.value = s.model;
  E.task.dispatchEvent(new Event('input')); E.model.dispatchEvent(new Event('input'));
  E.sampleNote.hidden = false;
  if (!quiet) toast(s.model ? 'Đã nạp đề mẫu kèm bài mẫu.' : 'Đã nạp đề mẫu (đề này chưa có bài mẫu).');
}
E.sampleSel.addEventListener('change', async () => {
  const id = E.sampleSel.value; E.sampleSel.value = '';
  const s = SAMPLES.find(x => x.id === id);
  if (!s) return;
  const custom = (E.task.value.trim() && !SAMPLES.some(x => x.task === E.task.value)) || (E.model.value.trim() && !SAMPLES.some(x => x.model === E.model.value));
  if (custom && !(await confirmBox('Nạp đề mẫu?', 'Đề bài và bài mẫu hiện tại sẽ được thay bằng đề „' + s.title + '“.', 'Nạp đề mẫu'))) return;
  loadSample(id, false);
});

/* ===================== start-up ===================== */
function restore() {
  E.optK.value = settings.k; renderKExample();
  E.optWords.value = settings.words.join('\n');
  E.timeInput.value = settings.time;
  const draft = store.get('draft', null);
  if (draft && typeof draft === 'object' && (draft.task || draft.answer || draft.model)) {
    E.task.value = String(draft.task || ''); E.model.value = String(draft.model || ''); E.answer.value = String(draft.answer || '');
    E.sampleNote.hidden = !SAMPLES.some(x => x.task === E.task.value);
  } else {
    loadSample('geburtstag', true);
  }
  T.total = parseTime(settings.time) || 1800; T.remaining = T.total;
  const s = store.get('timer', null);
  if (s && typeof s === 'object' && ['running', 'paused', 'done', 'stopped'].includes(s.state) && +s.total > 0) {
    Object.assign(T, { state: s.state, total: +s.total, endAt: +s.endAt || 0, remaining: Math.max(0, +s.remaining || 0),
      warned5: !!s.warned5, warned1: !!s.warned1, unlocked: !!s.unlocked, maintPaused: !!s.maintPaused, graded: !!s.graded });
    if (T.state === 'running') {
      if (!(T.endAt > 0)) T.state = 'paused';
      else if (T.endAt <= Date.now()) { applyTimerUI(); finishTimer(true); }
      else {
        startTicking();
        if (settings.sound) {                             // audio needs a gesture after a reload
          const rearm = () => { if (T.state === 'running') scheduleAlarms(remaining()); };
          document.addEventListener('pointerdown', rearm, { once: true });
          document.addEventListener('keydown', rearm, { once: true });
          toast('Đồng hồ vẫn đang chạy. Nhấn vào trang để bật lại chuông báo giờ.');
        }
      }
    }
  }
  applyTimerUI();
  updateCounters();
  autoGrow();
  renderHistory();
  renderConfig();
  updateSticky();
}
restore();
initSpell();
initSite();
window.B1AppStarted = true;
})();
