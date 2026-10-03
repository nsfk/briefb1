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
// The interface language is the page's: index.html (vi), en.html, de.html. The English and German copies of this file are
// written by build.py from this one (tools/i18n.py replaces each Vietnamese text), so the program is the same in all three.
const LANG = (document.documentElement.lang || 'vi').slice(0, 2);
const LOCALE = { vi: 'vi-VN', en: 'en-GB', de: 'de-DE' }[LANG] || 'vi-VN';     // numbers, dates and times
const nf1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nfp = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const pct = x => nfp.format(x * 100) + ' %';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
const joinVi = list => (list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' und ' + list[list.length - 1]);
// quan-tri.html (<html data-page="admin">): the owner's console - server dashboard and the maintenance switch, nothing of
// the learner's desk. index.html is the learner page and never shows the owner's tools.
const ADMIN_PAGE = document.documentElement.getAttribute('data-page') === 'admin';
const BASE_TITLE = document.title || 'B1 Schreibtrainer';   // the full title (search results) while idle
const SHORT_TITLE = 'B1 Schreibtrainer';                     // next to the countdown, so the time stays readable in the tab
const setLabel = (btn, text) => { (btn.querySelector('span') || btn).textContent = text; };   // keeps a button's icon
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
  sheetPanel: $('.sheet-panel'), sheetTools: $('#sheetTools'), umlBar: $('#sheetTools .umlauts'), desk: $('.desk'), btnFocus: $('#btnFocus'),
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
  siteNote: $('#siteNote'), siteJsonBox: $('#siteJsonBox'), siteJson: $('#siteJson'),
  btnSiteJsonCopy: $('#btnSiteJsonCopy'), btnSiteJsonDownload: $('#btnSiteJsonDownload'), maintOwnerHint: $('#maintOwnerHint'),
  maintScreen: $('#maintScreen'), maintTitle: $('#maintTitle'), maintMsg: $('#maintMsg'), maintEta: $('#maintEta'),
  maintTimerNote: $('#maintTimerNote'), maintAdmin: $('#maintAdmin'), maintPinRow: $('#maintPinRow'), maintPin: $('#maintPin'),
  btnMaintReopen: $('#btnMaintReopen'), btnMaintClosePreview: $('#btnMaintClosePreview'), maintPinErr: $('#maintPinErr'),
  sitePanel: $('#sitePanel'), configGrid: $('.config-grid'), btnContribute: $('#btnContribute'), stepContrib: $('#stepContrib'),
  modeFree: $('#modeFree'), modeTrace: $('#modeTrace'), traceBox: $('#traceBox'), traceView: $('#traceView'), traceInput: $('#traceInput'),
  traceEmpty: $('#traceEmpty'), traceStats: $('#traceStats'), traceDone: $('#traceDone'), btnTraceFinish: $('#btnTraceFinish'),
  btnTraceRestart: $('#btnTraceRestart'), gradeHint: $('#gradeHint'),
  btnWordsExport: $('#btnWordsExport'), btnWordsImport: $('#btnWordsImport'), btnBackupExport: $('#btnBackupExport'),
  btnBackupImport: $('#btnBackupImport'), linkBox: $('#linkBox'), linkState: $('#linkState'), btnLink: $('#btnLink'),
  btnLinkAllow: $('#btnLinkAllow'), btnLinkRestore: $('#btnLinkRestore'), btnUnlink: $('#btnUnlink'),
  optHelpers: $('#optHelpers'), optFileTip: $('#optFileTip'), optStats: $('#optStats'), btnWordsSuggest: $('#btnWordsSuggest'),
  apiUrl: $('#apiUrl'), adminToken: $('#adminToken'), adminRemember: $('#adminRemember'), btnAdminConnect: $('#btnAdminConnect'),
  btnAdminLogout: $('#btnAdminLogout'), adminNote: $('#adminNote'), adminBody: $('#adminBody'), apiStatus: $('#apiStatus'), adminPanel: $('#adminPanel'),
  admStats: $('#admStats'), admSamples: $('#admSamples'), admWords: $('#admWords'), admReports: $('#admReports'),
  admCntSamples: $('#admCntSamples'), admCntWords: $('#admCntWords'), admCntReports: $('#admCntReports'),
  umlFloat: $('#umlFloat'), backdrop: $('#backdrop'), modal: $('#modal'), pop: $('#pop'), toast: $('#toast')
};

/* ===================== unexpected errors in this app: tell the user once instead of failing silently ===================== */
let crashShown = false, lastCrash = '';
const OUR_FILES = /js\/(app|analysis|trace)\.js/;
function reportCrash(detail) {
  lastCrash = String(detail || '').slice(0, 500);           // goes into a bug report only if the user sends one
  if (crashShown) return;
  crashShown = true;
  toast('In der App ist ein unerwarteter Fehler aufgetreten. Laden Sie die Seite neu; Ihr Entwurf bleibt in diesem Browser erhalten. Sie können unten auf der Seite auf „Fehler melden“ klicken.');
  try { track('error'); } catch (e) { /* counting is optional */ }
}
window.addEventListener('error', e => { if (OUR_FILES.test(e && e.filename || '')) reportCrash(`${e.message} @ ${String(e.filename).split('/').pop()}:${e.lineno}`); });
window.addEventListener('unhandledrejection', e => { const st = String(e && e.reason && e.reason.stack || ''); if (OUR_FILES.test(st)) reportCrash(st.split('\n').slice(0, 2).join(' ')); });

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
    if (k === 'history') histCache = null;
    const s = JSON.stringify(v);
    try { localStorage.setItem('b1st:' + k, s); }
    catch (e) { unsaved.set(k, s); storageFailed(e); return false; }
    if (unsaved.delete(k) && !unsaved.size) setTimeout(renderStorageState, 0);   // everything is saved again
    return true;
  },
  del(k) {
    if (k === 'history') histCache = null;
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
    toast(ADMIN_PAGE ? (store.blocked ? 'Trình duyệt không cho lưu dữ liệu: thiết lập trên trang quản trị chỉ giữ đến khi đóng trang.'
        : 'Bộ nhớ của trình duyệt đã đầy nên chưa lưu được. Hãy mở trang luyện viết và xóa bớt lịch sử (Cấu hình › Dữ liệu).')
      : store.blocked ? 'Der Browser erlaubt kein Speichern: Entwurf, Verlauf und Einstellungen bleiben nur erhalten, bis die Seite geschlossen wird.'
      : 'Der Speicher des Browsers ist voll, daher konnte nichts gespeichert werden. Löschen Sie einen Teil des Verlaufs im Tab Einstellungen.');
  }, 0);
}
window.addEventListener('beforeunload', e => {           // last line of defence when nothing could be saved
  if ((store.blocked || store.pending) && E.answer.value.trim()) { e.preventDefault(); e.returnValue = ''; }
});

/* ===================== settings ===================== */
const DEFAULTS = { k: 10, sound: true, exam: true, time: '30', words: [], showModel: true, mode: 'free', helpers: false, fileTip: true, stats: true, focus: false };
function cleanSettings(raw) {
  const s = Object.assign({}, DEFAULTS, raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {});
  s.k = Math.round(+s.k);
  if (!(s.k >= 1 && s.k <= 50)) s.k = DEFAULTS.k;
  for (const b of ['sound', 'exam', 'showModel', 'helpers', 'fileTip', 'stats', 'focus']) if (typeof s[b] !== 'boolean') s[b] = DEFAULTS[b];
  if (typeof s.time !== 'string' || !validSec(parseTime(s.time))) s.time = DEFAULTS.time;
  s.words = Array.isArray(s.words) ? [...new Set(s.words.filter(w => typeof w === 'string' && w).map(w => w.normalize('NFC')))] : [];
  if (s.mode !== 'trace') s.mode = 'free';
  for (const k of Object.keys(s)) if (!(k in DEFAULTS)) delete s[k];
  return s;
}
const settings = cleanSettings(store.get('settings', null));
const saveSettings = () => { const ok = store.set('settings', settings); scheduleBackup(); return ok; };

/* ===================== sample tasks (original practice prompts) ===================== */
const SAMPLES = [
  { id: 'geburtstag', title: 'Einladung zum Geburtstag (informell)',
    task: 'Ihre Freundin Anna hat Sie zu ihrer Geburtstagsparty am Samstag eingeladen. Sie können aber leider nicht kommen.\n\nSchreiben Sie Anna eine E-Mail:\n– Bedanken Sie sich für die Einladung.\n– Erklären Sie, warum Sie nicht kommen können.\n– Machen Sie einen Vorschlag für ein anderes Treffen.\n– Fragen Sie, was sie sich zum Geburtstag wünscht.\n\nDenken Sie an eine passende Anrede, eine Einleitung und einen Schluss.',
    model: 'Liebe Anna,\n\nvielen Dank für deine Einladung zu deiner Geburtstagsparty am Samstag. Ich habe mich sehr darüber gefreut.\n\nLeider kann ich nicht kommen, weil ich am Wochenende arbeiten muss. Meine Kollegin ist krank, deshalb muss ich ihre Schicht übernehmen. Das tut mir wirklich leid.\n\nHast du vielleicht nächste Woche Zeit? Wir könnten zusammen in unser Lieblingscafé gehen und ein Stück Kuchen essen. Wie wäre es mit Dienstag oder Mittwoch am Abend?\n\nAußerdem möchte ich dir gern etwas schenken. Hast du einen besonderen Wunsch? Vielleicht ein Buch oder etwas für deine neue Wohnung? Schreib mir einfach.\n\nIch wünsche dir eine schöne Party und einen tollen Geburtstag!\n\nViele Grüße\nLisa' },
  { id: 'kurs', title: 'Deutschkurs am Wochenende (formell)',
    task: 'Sie haben im Internet eine Anzeige für einen Deutschkurs am Wochenende gelesen. Schreiben Sie an die Sprachschule:\n– Stellen Sie sich kurz vor.\n– Warum möchten Sie den Kurs besuchen?\n– Fragen Sie nach den Kosten und den Kurszeiten.\n– Fragen Sie, ob es am Ende eine Prüfung gibt.\n\nDenken Sie an eine passende Anrede, eine Einleitung und einen Schluss.',
    model: 'Sehr geehrte Damen und Herren,\n\nich habe im Internet Ihre Anzeige für einen Deutschkurs am Wochenende gelesen und interessiere mich sehr für dieses Angebot.\n\nMein Name ist Lisa Tran. Ich bin 27 Jahre alt und komme aus Vietnam. Seit einem Jahr lebe ich in Leipzig und arbeite als Krankenpflegerin.\n\nIch möchte den Kurs besuchen, weil ich im nächsten Jahr die B1-Prüfung machen möchte. Unter der Woche habe ich leider keine Zeit, deshalb passt ein Kurs am Wochenende sehr gut zu mir.\n\nKönnten Sie mir bitte mitteilen, wie viel der Kurs kostet und wann genau er stattfindet? Außerdem würde ich gern wissen, ob es am Ende des Kurses eine Prüfung gibt.\n\nIch freue mich auf Ihre Antwort.\n\nMit freundlichen Grüßen\nLisa Tran' },
  { id: 'umzug', title: 'Ein Freund zieht um (informell)',
    task: 'Ihr Freund Jonas zieht bald in Ihre Stadt und sucht eine Wohnung. Schreiben Sie ihm eine E-Mail:\n– Sagen Sie, dass Sie sich über den Umzug freuen.\n– Geben Sie Tipps für die Wohnungssuche.\n– Welchen Stadtteil empfehlen Sie? Warum?\n– Bieten Sie Ihre Hilfe beim Umzug an.', model: '' },
  { id: 'beschwerde', title: 'Beschwerde über eine Bestellung (formell)',
    task: 'Sie haben online ein Fahrrad bestellt. Es ist aber beschädigt angekommen. Schreiben Sie an den Kundenservice:\n– Was haben Sie wann bestellt?\n– Beschreiben Sie das Problem.\n– Was erwarten Sie jetzt von der Firma?\n– Bis wann möchten Sie eine Antwort?', model: '' }
];
const DEMO_ANSWER = 'Liebe Anna,\n\nvielen Dank fuer deine Einladung zu deiner Geburtstagsparty am Samstag. Ich habe mich sehr gefreut!\n\nLeider kann ich nicht kommen, weil ich am Wochenende arbeiten muss. meine Kollegin ist krank und ich muss ihre Schicht übernehmen. Entschuldiegung, das ich nicht dabei sein kann. Ich bin wirklich traurig.\n\nHast du nächste woche Zeit? Wir könnten zusammen ins Café gehen und Kuchen essen. Vieleicht am Dienstag oder am Mittwoch nach der Arbeit? Ich lade dich natürlich ein.\n\nWas wünschst du dir zum Geburtstag? Ich möchte dir gern etwas schenken, aber ich weiß nicht, was dir gefällt. Vielleicht ein Buch oder eine Pflanze für deine neue Wohnung?\n\nIch wünsche dir eine schöne Party und viel Spaß mit deinen Freunden!\n\nViele Grüsse\nLisa';

/* ===================== spell checker (Hunspell 1.7.3, WebAssembly) ===================== */
// slow: still loading after 30 s (a slow connection) - grading stops waiting for it, and it takes over when it arrives
const Spell = { ready: false, failed: false, slow: false, broken: false, h: null, added: new Set(), promise: null, engineErrors: 0, version: '',
  loadMs: null, shared: [], sharedAdded: new Set() };
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
    s.onerror = () => reject(new Error('Konnte nicht geladen werden: ' + src));
    (document.head || document.documentElement).appendChild(s);
  });
}
function setSpellStatus(kind, text, title) {
  E.spell.className = 'pill ' + kind;
  E.spell.textContent = text;
  E.spell.title = title || '';
}
const ON_WEB = /^https?:$/.test(location.protocol);
const SPELL_FAIL_HINT = ON_WEB ? 'Prüfen Sie die Internetverbindung und laden Sie die Seite neu (Ihr Entwurf bleibt erhalten).'
  : 'Lokale Kopie: Prüfen Sie, ob der Ordner lib (hunspell.js, dict-de.js) neben index.html liegt, und laden Sie die Seite neu.';
const SPELL_SLOW_HINT = 'Das Netz ist langsam: Das Wörterbuch (etwa 0,8 MB) wird noch geladen und automatisch verwendet, sobald es da ist. Sie können weiterschreiben.';
// The dictionary (~3 MB) loads when the page is idle, so the first seconds of typing stay smooth; anything that needs it
// earlier (grading, re-grading) calls ensureSpell(), which starts the load at once.
function ensureSpell() { return Spell.promise || initSpell(); }
function initSpell() {
  if (Spell.promise) return Spell.promise;
  // still loading after 30 s: reported as a slow connection (not as a failure), so grading does not keep waiting;
  // the load goes on and takes over when it arrives (a real failure - a missing file - is reported by the loader itself)
  const watchdog = setTimeout(() => {
    if (Spell.ready || Spell.failed) return;
    Spell.slow = true;
    setSpellStatus('warn', 'Das Wörterbuch lädt langsam…', SPELL_SLOW_HINT);
    renderAbout();
  }, 30000);
  const t0 = performance.now();
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
      // both files at once (neither needs the other): one round of waiting instead of two
      await Promise.all([window.HunspellWasm ? null : loadScript('lib/hunspell.js'), window.B1_DICT_DE ? null : loadScript('lib/dict-de.js')]);
      const factory = await window.HunspellWasm.loadModule();
      const enc = new TextEncoder();
      const aff = factory.mountBuffer(enc.encode(window.B1_DICT_DE.aff), 'de_DE.aff');
      const dic = factory.mountBuffer(enc.encode(window.B1_DICT_DE.dic), 'de_DE.dic');
      const h = factory.create(aff, dic);
      for (const [w, ex] of A.EXTRA_WORDS) { try { ex ? h.addWordWithAffix(w, ex) : h.addWord(w); } catch (e) { /* one missing word is not fatal */ } }
      Spell.h = h; Spell.ready = true; Spell.failed = false; Spell.slow = false; Spell.version = window.HunspellWasm.HUNSPELL_VERSION || '1.7.3';
      Spell.loadMs = performance.now() - t0;
      loaded = true;
    } catch (err) {
      Spell.failed = true; Spell.slow = false;
      setSpellStatus('bad', 'Wörterbuch konnte nicht geladen werden', String(err && err.message || err) + '. ' + SPELL_FAIL_HINT);
    }
    clearTimeout(watchdog);
    if (loaded) {
      setSpellStatus('ok', 'Rechtschreibung: Hunspell · de_DE', 'Hunspell ' + Spell.version + ' · Wörterbuch igerman98 (de_DE) · läuft offline im Browser');
      applySharedWords();                                   // approved words of the shared dictionary, then the personal ones
      syncPersonalWords();
      if (lastResult && !lastResult.spellReady) regrade(!lastResult.review);   // graded / reopened while the dictionary was loading
    }
    renderAbout();
    maybeTrackOpen();
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
  const shared = new Set(Spell.shared);
  for (const w of [...Spell.added]) {
    if (want.has(w)) continue;
    // an approved word of the shared dictionary stays known (it was not added again while it was a personal word)
    if (!shared.has(w)) { try { Spell.h.removeWord(w); } catch (e) { /* the engine no longer has it: nothing to undo */ } }
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
  if (name === 'config') {
    renderConfig();
    if (ADMIN_PAGE && Api.base && Admin.token && !Admin.on && !Admin.refused) adminLoad();   // e.g. the server was offline at start
  }
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
  box.innerHTML = UML_KEYS.map(ch => `<button type="button" class="uml" data-ch="${ch}" title="${ch} einfügen" aria-label="${ch} einfügen"${inFloat ? ' tabindex="-1"' : ''}>${ch}</button>`).join('');
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

// "Mở rộng" (focus mode): the writing sheet alone - the task and the model are hidden, the sheet gets a wider column and
// larger writing (CSS .desk.focus). The same button brings them back; the choice is kept on this browser.
function applyFocus() {
  const on = !!settings.focus;
  E.desk.classList.toggle('focus', on);
  E.btnFocus.setAttribute('aria-pressed', String(on));
  const label = on ? 'Schreibfeld verkleinern, Aufgabe und Musterbrief wieder zeigen' : 'Schreibfeld vergrößern, Aufgabe und Musterbrief ausblenden';
  E.btnFocus.title = label;
  E.btnFocus.setAttribute('aria-label', label);
  $('use', E.btnFocus).setAttribute('href', on ? '#i-collapse' : '#i-expand');
}
E.btnFocus.addEventListener('click', () => {
  // the lines being written stay where they are on the screen (on a phone the hidden panels sit above the sheet)
  const sheet = traceOn() ? E.traceView : E.answer, before = sheet.getBoundingClientRect().top;
  settings.focus = !settings.focus;
  saveSettings();
  applyFocus();
  autoGrow();
  const shift = sheet.getBoundingClientRect().top - before;
  if (Math.abs(shift) > 1) window.scrollBy(0, shift);
  if (traceOn()) scheduleTraceLayout();                 // the hidden input follows the caret to its new place
  requestAnimationFrame(() => { updateSticky(); updateFloat(); });
});

// While writing, keep the caret line clear of the sticky clock and toolbar (scroll-padding steers caret scrolling).
for (const el of [E.answer, E.traceInput]) {
  el.addEventListener('focus', () => document.documentElement.classList.add('writing'));
  el.addEventListener('blur', () => document.documentElement.classList.remove('writing'));
}

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
  const vv = window.visualViewport;
  const topLimit = (vv ? vv.offsetTop : 0) + stickTop + E.sheetTools.getBoundingClientRect().height + 6;
  const box = E.answer.getBoundingClientRect();
  if (box.top >= topLimit && box.bottom <= (vv ? vv.offsetTop + vv.height : window.innerHeight)) return;   // whole sheet on screen: nothing hidden
  const lh = parseFloat(getComputedStyle(E.answer).lineHeight) || 32;
  const y = box.top + caretTop();
  const bottomLimit = (vv ? vv.offsetTop + vv.height : window.innerHeight) - 12;
  if (y < topLimit) window.scrollBy(0, y - topLimit);
  else if (y + lh > bottomLimit) window.scrollBy(0, y + lh - bottomLimit);
}
let caretFrame = 0;                                       // at most one caret check per frame (fast Backspace / Enter)
const keepCaretSoon = () => { if (!caretFrame) caretFrame = requestAnimationFrame(() => { caretFrame = 0; keepCaretVisible(); }); };
E.answer.addEventListener('keyup', e => { if (/^(Arrow|Page|Home|End|Enter|Backspace|Delete)/.test(e.key)) keepCaretSoon(); });
E.answer.addEventListener('click', keepCaretSoon);

// Umlaut keys: one set on screen at a time. The keys in the sheet's toolbar serve whichever writing field has focus (the
// answer, the task or the model, like the Alt shortcuts) while that toolbar is on screen; the floating keys appear only
// when it is not (a phone scrolled up to the task, "Từ của tôi" in the settings, the sheet's toolbar out of view). They
// never show while the page is not the one in use (the address bar or another window has focus, the page is hidden or
// being left), so they cannot linger over a page that is loading slowly. The owner's console needs no umlaut keys.
const FLOAT_FIELDS = new Set(ADMIN_PAGE ? [] : [E.task, E.model, E.optWords, E.maintMessage]);
const BAR_FIELDS = new Set([E.task, E.model]);            // besides the answer: fields the sheet's own keys serve
let floatTarget = null, leaving = false;
function toolbarOnScreen() {
  if (E.viewPractice.hidden) return false;
  const r = E.umlBar.getBoundingClientRect(), vv = window.visualViewport;
  const top = vv ? vv.offsetTop : 0, bottom = top + (vv ? vv.height : window.innerHeight);
  return r.height > 0 && r.top >= top - 1 && r.bottom <= bottom + 1;
}
function updateFloat() {
  const ae = document.activeElement;
  let t = null;
  if (!Site.screen && E.backdrop.hidden && !leaving && !document.hidden && document.hasFocus() && ae && !ae.readOnly && !ae.disabled && !ae.hidden) {
    const sheet = ae === E.answer || ae === E.traceInput;
    if ((FLOAT_FIELDS.has(ae) || sheet) && !((sheet || BAR_FIELDS.has(ae)) && toolbarOnScreen())) t = ae;
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
window.addEventListener('blur', () => setTimeout(updateFloat, 0));   // e.g. the address bar: a new address is being typed
window.addEventListener('focus', updateFloat);
document.addEventListener('visibilitychange', updateFloat);
// leaving the page (new address, link, reload): the last picture of this page stays on screen until the next one paints.
// If the leaving is cancelled ("Leave site?"), the next touch, key or focus on the page brings the keys back.
window.addEventListener('beforeunload', () => { leaving = true; updateFloat(); });
window.addEventListener('pagehide', () => { leaving = true; updateFloat(); });
window.addEventListener('pageshow', () => { leaving = false; updateFloat(); });   // also when the page comes back from the back/forward cache
for (const type of ['pointerdown', 'keydown', 'focusin']) document.addEventListener(type, () => { if (leaving) { leaving = false; setTimeout(updateFloat, 0); } }, true);
let scrollQueued = false;
window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => {
    scrollQueued = false; updateStuck();
    const ae = document.activeElement;                    // the sheet's toolbar scrolled into or out of view
    if (ae === E.answer || ae === E.traceInput || BAR_FIELDS.has(ae) || floatTarget) updateFloat();
  });
}, { passive: true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', updateFloat);
  window.visualViewport.addEventListener('scroll', updateFloat);
}
document.addEventListener('mousedown', e => { if (e.target.closest('.uml')) e.preventDefault(); });   // keep the caret in the text
document.addEventListener('click', e => {
  const b = e.target.closest('.uml');
  if (!b) return;
  const ae = document.activeElement;                      // the keys keep the focus where it was (mousedown above)
  insertAtCaret(b.closest('#umlFloat') ? floatTarget : BAR_FIELDS.has(ae) ? ae : traceOn() ? E.traceInput : E.answer, b.dataset.ch);
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
const STATE_LABEL = { idle: 'Bereit', running: 'Läuft', paused: 'Angehalten', done: 'Zeit abgelaufen', stopped: 'Abgegeben' };
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
    if (active()) document.title = fmt(shown) + ' · ' + SHORT_TITLE;
    else if (!flashTimer) document.title = BASE_TITLE;
  }
}
function applyTimerUI() {
  const st = T.state;
  E.clockState.textContent = STATE_LABEL[st];
  E.clockState.className = 'pill ' + STATE_KIND[st];
  E.clockTotal.textContent = 'Gesamt: ' + fmt(T.total);
  E.btnStart.querySelector('span').textContent = { idle: 'Starten', running: 'Angehalten', paused: 'Fortsetzen', done: 'Neu starten', stopped: 'Neu starten' }[st];
  E.icoPlay.hidden = st === 'running';
  E.icoPause.hidden = st !== 'running';
  E.btnStart.classList.toggle('btn-primary', st !== 'running');
  E.btnReset.disabled = st === 'idle';
  const editable = !active();
  E.timeInput.disabled = !editable;
  const want = parseTime(E.timeInput.value);
  $$('.chip[data-time]').forEach(c => { c.disabled = !editable; c.setAttribute('aria-pressed', String(parseTime(c.dataset.time) === want)); });
  if (!grading) setLabel(E.btnGrade, active() ? 'Abgeben und bewerten' : 'Bewerten');
  lastShownSec = -1;                                      // a state change always refreshes the tab title
  renderClock();
  applyExam();
}
function readTimeInput(showError) {
  const sec = parseTime(E.timeInput.value);
  const ok = validSec(sec);
  if (ok) E.timeErr.hidden = true;
  else if (showError) {
    E.timeErr.textContent = 'Ungültige Zeit. Geben Sie Minuten (zum Beispiel 30) oder Min:Sek (zum Beispiel 0:20) ein, von 5 Sekunden bis 600 Minuten.';
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
  if (!T.warned5 && r <= 300) { T.warned5 = true; persistTimer(); toast('Noch 5 Minuten.'); }
  if (!T.warned1 && r <= 60) { T.warned1 = true; persistTimer(); toast('Noch 1 Minute — schreiben Sie jetzt den Schlussgruß.'); }
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
  flashTimer = setInterval(() => { document.title = (on = !on) ? 'ZEIT ABGELAUFEN · ' + SHORT_TITLE : SHORT_TITLE; }, 900);
}
function stopFlash() {
  if (flashTimer) { clearInterval(flashTimer); flashTimer = 0; }
  document.title = active() ? fmt(Math.max(0, remaining())) + ' · ' + SHORT_TITLE : BASE_TITLE;
}

/* ---- sound: alarms are scheduled on the audio clock, so they ring on time even in a background tab ---- */
let actx = null, scheduled = [], endAudioAt = 0, audioWarned = false;
function warnAudio() {
  if (audioWarned) return;
  audioWarned = true;
  toast('Dieser Browser kann die Zeitsignale nicht abspielen. Behalten Sie die Uhr auf dem Bildschirm im Blick.');
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
  E.traceInput.readOnly = locked;
  E.lockNote.hidden = !locked;
  const covered = settings.exam && running && !traceOn();   // tracing is copy practice: the model is the point
  // the previous results (corrections, suggestions, the whole model answer in the comparison) stay out of sight too
  E.results.hidden = !lastResult || covered || traceOn();
  if (covered) closePop();
  const showModel = settings.showModel && !covered;
  E.model.hidden = !showModel;
  E.modelCover.hidden = showModel;
  E.modelCoverText.textContent = covered ? 'Im Prüfungsmodus bleibt der Musterbrief verdeckt, bis Sie abgeben oder die Zeit abgelaufen ist.' : 'Klicken Sie auf „Zeigen“, um den Musterbrief zu sehen.';
  E.btnModelToggle.disabled = covered;
  E.btnModelToggle.textContent = settings.showModel ? 'Ausblenden' : 'Zeigen';
  E.btnModelToggle.setAttribute('aria-pressed', String(settings.showModel));
  $('[data-open="model"]').disabled = covered;
  E.sampleSel.disabled = covered;
  renderContribBtn();
  if (floatTarget === E.answer && locked) updateFloat();
}

/* ===================== modal, popover, toast ===================== */
let modalResolve = null, lastFocus = null, modalOpenedAt = 0;
function openModal({ title, sub = '', html = '', buttons = [], kind = '' }) {
  closePop();
  if (modalResolve) { const r = modalResolve; modalResolve = null; r(null); }
  lastFocus = document.activeElement;
  modalOpenedAt = performance.now();
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
// a click beside the box closes it - but not the second click of a double click that opened it
E.backdrop.addEventListener('click', e => {
  if (e.target === E.backdrop && !E.modal.classList.contains('alarm') && performance.now() - modalOpenedAt > 500) closeModal(null);
});
function confirmBox(title, text, okLabel, danger) {
  return openModal({ title, html: `<p>${esc(text)}</p>`, buttons: [{ label: 'Abbrechen', value: false }, { label: okLabel, value: true, primary: !danger, danger }] }).then(v => v === true);
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
  const w = A.countWords(traceOn() ? E.traceInput.value : E.answer.value);
  const locked = settings.exam && !T.unlocked;
  openModal({
    kind: 'alarm', title: 'Die Zeit ist abgelaufen!', sub: 'Die Zeit ist um.',
    html: `<p>Sie haben <b>${w}</b> Wörter in ${esc(fmt(T.total))} geschrieben.</p>` + (locked ? '<p class="muted small">Ihr Text wurde gesperrt, wie im Prüfungsraum. Sie können ihn entsperren und weiterschreiben.</p>' : ''),
    buttons: [{ label: 'Später', value: 'later' }, { label: traceOn() ? 'Ergebnis des Nachschreibens ansehen' : 'Jetzt bewerten', value: 'grade', primary: true }]
  }).then(v => { stopFlash(); if (v === 'grade') { if (traceOn()) finishTrace(false); else grade(); } });
}

/* ===================== browser helpers on the writing fields ===================== */
// Translation, Grammarly, LanguageTool, Microsoft Editor, Chrome's writing suggestions and phone keyboards' automatic
// capitals cover the caret, suggest the wrong language or silently fix exactly what is being graded.
const HELPER_ATTRS = { translate: 'no', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', writingsuggestions: 'false',
  'data-gramm': 'false', 'data-gramm_editor': 'false', 'data-enable-grammarly': 'false', 'data-lt-active': 'false', 'data-ms-editor': 'false' };
function applyHelpers() {
  for (const el of [E.task, E.model, E.answer, E.optWords, E.maintMessage, E.traceInput]) {
    const block = !settings.helpers || el === E.traceInput;  // the tracing sheet is always protected
    for (const [a, v] of Object.entries(HELPER_ATTRS)) { if (block) el.setAttribute(a, v); else el.removeAttribute(a); }
    el.classList.toggle('notranslate', block);
  }
  E.optHelpers.checked = settings.helpers;
  E.optFileTip.checked = settings.fileTip;
  E.optStats.checked = settings.stats;
}
E.optHelpers.addEventListener('change', () => { settings.helpers = E.optHelpers.checked; saveSettings(); applyHelpers(); });
E.optFileTip.addEventListener('change', () => { settings.fileTip = E.optFileTip.checked; saveSettings(); });

/* ===================== editor: keys, counters, draft ===================== */
const ALT_KEYS = { KeyA: 'ä', KeyO: 'ö', KeyU: 'ü', KeyS: 'ß' };
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'Enter') {
    // only on the writing desk, never behind a dialog or the maintenance screen
    if (currentView === 'practice' && E.backdrop.hidden && !Site.screen) { e.preventDefault(); if (traceOn()) finishTrace(false); else grade(); }
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
  const text = traceOn() ? E.traceInput.value : E.answer.value;
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
E.model.addEventListener('input', () => { saveDraft(); updateStale(); if (traceOn()) prepareTraceSoon(); });
window.addEventListener('pagehide', () => saveDraft.flush());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveDraft.flush();
  else { stopFlash(); tick(); }
});

/* ===================== tracing mode ("viết in vết"): type over the faded model answer ===================== */
const TR = window.B1Trace;
const Trace = { prep: null, sig: '', cache: new Map(), nodes: [], tail: null, res: null, started: 0, activeMs: 0, lastKey: 0,
  saved: false, autoDone: false, entryId: null };
function traceOn() { return settings.mode === 'trace' && !!TR; }
function hashText(s) {                                    // FNV-1a: is the stored progress for this model answer?
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + ':' + s.length;
}
const saveTrace = debounce(() => store.set('trace', { typed: E.traceInput.value, sig: Trace.sig, activeMs: Trace.activeMs, started: Trace.started,
  saved: Trace.saved, entryId: Trace.entryId }), 400);
window.addEventListener('pagehide', () => saveTrace.flush());
function setMode(mode) {
  if ((mode === 'trace' && !TR) || settings.mode === mode) return;
  settings.mode = mode; saveSettings();
  applyMode();
  (mode === 'trace' ? (E.traceInput.disabled ? E.model : E.traceInput) : E.answer).focus({ preventScroll: true });
}
function applyMode() {
  const on = traceOn();
  E.modeFree.setAttribute('aria-checked', String(!on)); E.modeFree.tabIndex = on ? -1 : 0;
  E.modeTrace.setAttribute('aria-checked', String(on)); E.modeTrace.tabIndex = on ? 0 : -1;
  E.answer.hidden = on;
  E.traceBox.hidden = !on;
  E.traceStats.hidden = !on;
  for (const b of [E.btnGrade, E.btnDemo, E.btnNew]) b.hidden = on;
  E.btnTraceFinish.hidden = E.btnTraceRestart.hidden = !on;
  E.gradeHint.textContent = on ? 'Strg + Enter zum Beenden und Speichern' : 'Strg + Enter zum Bewerten';
  if (on) prepareTrace(); else E.traceDone.hidden = true;
  applyExam();
  updateCounters();
  requestAnimationFrame(() => { updateSticky(); updateFloat(); });
}
[E.modeFree, E.modeTrace].forEach(b => {
  b.addEventListener('click', () => setMode(b === E.modeTrace ? 'trace' : 'free'));
  b.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = traceOn() ? E.modeFree : E.modeTrace;
    setMode(next === E.modeTrace ? 'trace' : 'free'); next.focus();
  });
});
function prepareTrace() {
  const model = E.model.value;
  const empty = !model.trim();
  E.traceEmpty.hidden = !empty;
  E.traceInput.disabled = empty;
  const sig = hashText(model.normalize('NFC'));
  if (sig !== Trace.sig || !Trace.prep) { Trace.prep = TR.prepare(model); Trace.sig = sig; Trace.cache.clear(); buildTraceView(); }
  renderTrace();
}
const prepareTraceSoon = debounce(prepareTrace, 250);
// One block per paragraph: a keystroke then re-lays out only its own paragraph, not the whole letter.
function buildTraceView() {
  const view = E.traceView, words = Trace.prep.words, frag = document.createDocumentFragment();
  const newPara = () => { const d = document.createElement('div'); d.className = 'tpara'; frag.appendChild(d); return d; };
  view.textContent = '';
  let para = newPara();
  Trace.nodes = words.map((wd, k) => {
    const el = document.createElement('span');
    el.textContent = wd.w;
    para.appendChild(el);
    if (k < words.length - 1) {
      if (wd.br === 2) para = newPara();
      else para.appendChild(document.createTextNode(wd.br === 1 ? '\n' : ' '));
    }
    return { el, r: null, caret: -2 };
  });
  Trace.tail = document.createElement('span');            // words typed past the end of the model
  para.appendChild(Trace.tail);
  view.appendChild(frag);
}
const TIP = { case: 'Falsche Groß- / Kleinschreibung', punct: 'Falsches Satzzeichen', uml: /*vi*/'Falscher Umlaut / ß', letter: 'Falscher Buchstabe' };
function paintWord(el, r, caret) {
  let html = '', run = null;
  const flush = () => { if (run) { html += run.cls ? `<span class="${run.cls}"${run.tip}>${esc(run.text)}</span>` : esc(run.text); run = null; } };
  r.items.forEach((it, i) => {
    if (i === caret) { flush(); html += '<span class="tcaret"></span>'; }
    const cls = it.cls === 'ghost' ? '' : 't-' + it.cls;
    const tip = it.typed != null ? ` title="${esc(TIP[it.cls] || /*vi*/'Falsch')}: Sie haben „${esc(it.typed)}“ getippt"` : it.cls === 'miss' ? ' title="Dieser Buchstabe fehlt"' : it.cls === 'extra' ? ' title="Überzähliger Buchstabe"' : '';
    if (run && run.cls === cls && !tip && !run.tip) run.text += it.ch;
    else { flush(); run = { cls, tip, text: it.ch }; }
  });
  flush();
  if (caret === r.items.length) html += '<span class="tcaret"></span>';
  el.innerHTML = html;
}
function renderTrace() {
  if (!Trace.prep || !traceOn()) return;
  const typed = E.traceInput.value;
  const res = Trace.res = TR.compareAll(Trace.prep, typed, Trace.cache);
  const open = res.typedWords > 0 && res.current === res.typedWords - 1;
  const pw = Trace.prep.words.length;
  for (let k = 0; k < pw; k++) {                         // only words whose result or caret changed are repainted
    const node = Trace.nodes[k], r = res.words[k];
    const caret = k === res.current ? (open ? r.caret : 0) : -1;
    if (node.r === r && node.caret === caret) continue;
    node.r = r; node.caret = caret;
    paintWord(node.el, r, caret);
  }
  let tail = '';
  res.words.slice(pw).forEach(r => { tail += ' <span class="t-extra" title="Überzählig gegenüber dem Musterbrief">' + esc(r.items.map(it => it.ch).join('')) + '</span>'; });
  if (res.current >= pw) tail += (open ? '' : ' ') + '<span class="tcaret"></span>';
  if (Trace.tail.innerHTML !== tail) Trace.tail.innerHTML = tail;
  scheduleTraceLayout();
}
// Letters are painted inside the input event; everything that reads layout (caret position, scrolling) and the stats line
// run once per frame, so a fast typist's keystrokes never wait for each other.
let traceFrame = 0;
function scheduleTraceLayout() {
  if (traceFrame) return;
  traceFrame = requestAnimationFrame(() => {
    traceFrame = 0;
    if (Trace.res) renderTraceStats(Trace.res);
    const caretEl = E.traceView.querySelector('.tcaret');
    if (caretEl) { E.traceInput.style.top = caretEl.offsetTop + 'px'; E.traceInput.style.left = caretEl.offsetLeft + 'px'; }   // IME window at the caret
    if (document.activeElement === E.traceInput) keepTraceCaretVisible(caretEl);
  });
}
const CAT_LABEL = [['case', 'Großschreibung'], ['punct', 'Satzzeichen'], ['uml', 'Umlaut/ß'], ['letter', 'Falscher Buchstabe'], ['missing', 'Fehlt'], ['extra', 'Überzählig']];
const catPills = cats => CAT_LABEL.map(([k, label]) => `<span class="tpill ${cats[k] ? 'tp-' + k : 'tp-zero'}">${label} <b>${cats[k]}</b></span>`).join('');
const pctInt = x => Math.floor(x * 100 + 1e-9) + ' %';
function traceWpm(res) { return Trace.activeMs > 5000 ? Math.round(res.doneWords / (Trace.activeMs / 60000)) : null; }
let lastStats = '';
function renderTraceStats(res) {
  const wpm = traceWpm(res);
  const html = `<span><b>${res.doneWords}</b>/${res.totalWords} Wörter</span><span>Genauigkeit <b>${pctInt(res.accuracy)}</b></span>${catPills(res.cats)}` +
    (wpm != null ? `<span class="muted">${wpm} Wörter/Min</span>` : '');
  if (html !== lastStats) { lastStats = html; E.traceStats.innerHTML = html; }
}
function keepTraceCaretVisible(c) {
  if (!c) return;
  const r = c.getBoundingClientRect(), vv = window.visualViewport;
  const topLimit = (vv ? vv.offsetTop : 0) + stickTop + E.sheetTools.getBoundingClientRect().height + 6;
  const bottomLimit = (vv ? vv.offsetTop + vv.height : window.innerHeight) - 12;
  if (r.top < topLimit) window.scrollBy(0, r.top - topLimit);
  else if (r.bottom + 8 > bottomLimit) window.scrollBy(0, r.bottom + 8 - bottomLimit);
}
function noteActivity() {
  const now = Date.now();
  if (!Trace.started) Trace.started = now;
  if (Trace.lastKey) Trace.activeMs += Math.min(now - Trace.lastKey, 5000);   // pauses longer than 5 s do not count as typing time
  Trace.lastKey = now;
}
E.traceInput.addEventListener('input', () => {
  noteActivity();
  if (Trace.saved) { Trace.saved = false; E.traceDone.hidden = true; }   // typing on after saving: a continued attempt
  renderTrace();
  saveTrace();
  updateCountersSoon();
  if (Trace.res && Trace.res.finished && !Trace.autoDone) { Trace.autoDone = true; finishTrace(true); }
});
E.traceInput.addEventListener('keydown', e => {            // the caret always stays at the end, as in a typing tutor
  if (/^(Arrow(Left|Right|Up|Down)|Home|End|PageUp|PageDown)$/.test(e.key) && !e.altKey) e.preventDefault();
});
const traceKeepEnd = () => { const ta = E.traceInput, n = ta.value.length; if (ta.selectionStart !== n || ta.selectionEnd !== n) ta.setSelectionRange(n, n); };
document.addEventListener('selectionchange', () => { if (document.activeElement === E.traceInput) traceKeepEnd(); });
E.traceInput.addEventListener('paste', e => { e.preventDefault(); toast('Beim Nachschreiben kann kein Text eingefügt werden. Tippen Sie den Musterbrief nach.'); });
E.traceInput.addEventListener('drop', e => e.preventDefault());
E.traceInput.addEventListener('focus', () => { E.traceView.classList.add('focused'); traceKeepEnd(); });
E.traceInput.addEventListener('blur', () => E.traceView.classList.remove('focused'));
E.traceView.addEventListener('mousedown', e => { e.preventDefault(); if (!E.traceInput.disabled) E.traceInput.focus({ preventScroll: true }); });
E.traceView.addEventListener('click', () => { if (!E.traceInput.disabled) E.traceInput.focus({ preventScroll: true }); });
function traceSummaryHtml(res, savedNote) {
  const tw = TR.splitTyped(E.traceInput.value).words, pw = Trace.prep.words, wrong = [];
  for (let k = 0; k < Math.min(tw.length, pw.length) && wrong.length < 60; k++) if (res.words[k].errors) wrong.push([tw[k], pw[k].w]);
  const kind = res.accuracy >= 0.95 ? 'ok' : res.accuracy >= 0.85 ? 'warn' : 'bad', wpm = traceWpm(res);
  return `<h3>Ergebnis des Nachschreibens</h3>\n    <div class="row"><span class="pill ${kind}">Genauigkeit ${pctInt(res.accuracy)}</span><span class="small">${res.doneWords}/${res.totalWords} Wörter</span>\n      <span class="small muted">Tippzeit ${esc(fmt(Trace.activeMs / 1000))}</span>${wpm != null ? `<span class="small muted">${wpm} Wörter/Min</span>` : ''}</div>\n    <div class="row">${catPills(res.cats)}</div>\n    ${wrong.length ? `<div><div class="lbl" style="margin-bottom:6px">Falsch getippte Wörter: Ihre Eingabe → Musterbrief</div><div class="wordfix" lang="de">${wrong.map(([t, m]) => `<span><s>${esc(t)}</s> → <b>${esc(m)}</b></span>`).join('')}</div></div>`
      : '<p class="small" style="margin:0">Keine falsch getippten Wörter. Sehr gut!</p>'}\n    <p class="muted small" style="margin:0">${esc(savedNote)}</p>`;
}
function finishTrace(auto) {
  const res = Trace.res;
  if (!traceOn() || !Trace.prep) return;
  if (!res || !res.typedWords) { toast('Sie haben noch nichts vom Musterbrief getippt.'); E.traceInput.focus(); return; }
  const hist = loadHistory();
  const entry = { id: Trace.entryId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Trace.started || Date.now(), mode: 'trace',
    task: firstLine(E.task.value), taskFull: E.task.value, modelFull: E.model.value, text: E.traceInput.value, words: res.typedWords,
    errors: res.errors, score: Math.floor(res.accuracy * 100 + 1e-9), cats: res.cats, used: Math.round(Trace.activeMs / 1000), total: null, k: null };
  if (!Trace.entryId) track('trace');
  Trace.entryId = entry.id;
  putHistory(hist, entry);
  Trace.saved = true;
  saveTrace(); saveTrace.flush();
  E.traceDone.innerHTML = traceSummaryHtml(res, 'Im Verlauf gespeichert.');
  E.traceDone.hidden = false;
  if (!auto) E.traceDone.scrollIntoView({ behavior: smooth(), block: 'nearest' });
  toast(auto ? 'Sie haben den ganzen Musterbrief getippt. Das Ergebnis wurde im Verlauf gespeichert.' : 'Das Ergebnis des Nachschreibens wurde im Verlauf gespeichert.');
}
function resetTraceSession() {
  E.traceInput.value = '';
  Object.assign(Trace, { started: 0, activeMs: 0, lastKey: 0, saved: false, autoDone: false, entryId: null });
  E.traceDone.hidden = true;
  store.del('trace');
  if (traceOn()) { renderTrace(); updateCounters(); }
}
E.btnTraceFinish.addEventListener('click', () => finishTrace(false));
E.btnTraceRestart.addEventListener('click', async () => {
  if (E.traceInput.value.trim() && !Trace.saved &&
      !(await confirmBox('Von vorn tippen?', 'Was Sie getippt haben (das Ergebnis ist nicht gespeichert), wird gelöscht.', 'Von vorn', true))) return;
  resetTraceSession();
  if (!E.traceInput.disabled) E.traceInput.focus({ preventScroll: true });
});
async function reopenTrace(h) {
  const lose = [];
  if (h.taskFull && E.task.value.trim() && E.task.value !== h.taskFull) lose.push('die Aufgabe');
  if (typeof h.modelFull === 'string' && E.model.value.trim() && E.model.value !== h.modelFull) lose.push('der Musterbrief');
  if (E.traceInput.value.trim() && !Trace.saved && E.traceInput.value !== h.text) lose.push('der nachgeschriebene Text');
  if (lose.length && !(await confirmBox('Nachschreib-Übung wieder öffnen?', `Folgendes auf der Seite wird durch den Inhalt der Übung vom ${dateStr(h.t)} ersetzt: ${capFirst(joinVi(lose))}.`, 'Wieder öffnen'))) return;
  if (h.taskFull) E.task.value = h.taskFull;
  if (typeof h.modelFull === 'string') E.model.value = h.modelFull;
  E.task.dispatchEvent(new Event('input')); E.model.dispatchEvent(new Event('input'));
  E.sampleNote.hidden = !SAMPLES.some(x => x.task === E.task.value);
  settings.mode = 'trace'; saveSettings();
  E.traceInput.value = String(h.text || '');
  Object.assign(Trace, { started: h.t, activeMs: (+h.used || 0) * 1000, lastKey: 0, saved: true, autoDone: true, entryId: h.id });
  applyMode();
  saveTrace();
  selectView('practice');
  if (Trace.res) { E.traceDone.innerHTML = traceSummaryHtml(Trace.res, `Übung vom ${dateStr(h.t)}. Tippen Sie weiter, um mehr zu üben; klicken Sie auf „Beenden und Ergebnis speichern“, um das Ergebnis zu aktualisieren.`); E.traceDone.hidden = false; }
  E.traceBox.scrollIntoView({ behavior: smooth(), block: 'start' });
}

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
  const broken = () => new ImportError('Die .docx-Datei ist beschädigt oder keine Word-Datei. Öffnen Sie sie in Word, speichern Sie sie erneut und versuchen Sie es noch einmal, oder kopieren Sie den Inhalt.');
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
  if (!entry) throw new ImportError('In der .docx-Datei wurde kein Text gefunden.');
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
  } else throw new ImportError('Dieser Browser kann .docx-Dateien nicht entpacken. Öffnen Sie die Datei in Word und kopieren Sie den Inhalt.');
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
$$('[data-open]').forEach(b => b.addEventListener('click', async () => {
  const target = b.dataset.open === 'task' ? E.task : E.model;
  const f = await chooseFile('.txt,.md,.docx,text/plain', TEXT_TYPES);
  if (f) importFile(f, target);
}));
async function importFile(file, target) {
  const name = file.name || '';
  if (!/\.(txt|md|docx)$/i.test(name) && !/^text\//.test(file.type || '')) {
    toast(/\.doc$/i.test(name) ? '.doc-Dateien (altes Word-Format) können noch nicht gelesen werden. Speichern Sie die Datei als .docx oder .txt.' : 'Es können nur .txt-, .md- oder .docx-Dateien geöffnet werden.');
    return;
  }
  try {
    const raw = /\.docx$/i.test(name) ? await readDocx(file) : await readText(file);
    const text = cleanImported(raw);
    if (!text) { toast('Die Datei enthält keinen Text.'); return; }
    target.value = text;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    if (target === E.model && E.model.hidden) toast(`Musterbrief importiert (${A.countWords(text)} Wörter). Der Musterbrief ist ausgeblendet.`);
    else toast(`„${name}“ importiert (${A.countWords(text)} Wörter).`);
  } catch (err) {
    toast(err instanceof ImportError ? err.message : `„${name}“ konnte nicht gelesen werden: Die Datei ist möglicherweise beschädigt. Öffnen Sie sie in Word oder im Editor, speichern Sie sie erneut und versuchen Sie es noch einmal, oder kopieren Sie den Inhalt.`);
  }
}
[E.task, E.model].forEach(ta => {                         // drag and drop: no system dialog at all
  const isFile = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
  ta.addEventListener('dragover', e => { if (isFile(e)) { e.preventDefault(); ta.classList.add('dropping'); } });
  ta.addEventListener('dragleave', () => ta.classList.remove('dropping'));
  ta.addEventListener('drop', e => {
    ta.classList.remove('dropping');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { e.preventDefault(); importFile(f, ta); }
  });
});

/* ===================== grading & results ===================== */
let lastResult = null, currentAttempt = null, grading = false;
function timeUsed() {
  if (T.state === 'idle') return null;
  return { used: Math.round(T.total - Math.max(0, remaining())), total: T.total };
}
function runAnalysis(text, task, model, k = settings.k, strict = false) {
  const before = Spell.engineErrors;
  const res = A.analyze(text, { task, model, k, speller, strict });
  if (Spell.engineErrors - before > 2) {                  // the engine itself is failing, not one odd word: no score
    Spell.broken = true;
    res.spellReady = false;
    setSpellStatus('bad', 'Bei der Rechtschreibprüfung ist ein Fehler aufgetreten', 'Laden Sie die Seite neu und bewerten Sie erneut.');
  }
  return res;
}
function spellMissingNote() {
  if (Spell.broken) return 'Bei der Rechtschreibprüfung ist während der Bewertung ein Fehler aufgetreten, daher gibt es noch keine Punktzahl. Laden Sie die Seite neu und bewerten Sie erneut (Ihr Entwurf bleibt erhalten).';
  if (Spell.failed) return 'Das Wörterbuch konnte nicht geladen werden, daher wurde die Rechtschreibung nicht geprüft und es gibt keine Punktzahl. ' + SPELL_FAIL_HINT;
  if (Spell.slow) return 'Das Netz ist langsam und das Wörterbuch wird noch geladen, daher wurde die Rechtschreibung noch nicht geprüft. Das Ergebnis aktualisiert sich von selbst, sobald das Laden fertig ist.';
  return 'Das Wörterbuch wird geladen, daher wurde die Rechtschreibung noch nicht geprüft. Das Ergebnis aktualisiert sich von selbst, sobald das Laden fertig ist.';
}
async function grade() {
  if (grading) return;
  if (traceOn()) { finishTrace(false); return; }
  closePop();
  if (!E.backdrop.hidden) closeModal(null);
  if (!A.countWords(E.answer.value)) { toast('Ihr Text ist leer. Schreiben Sie Ihren Text vor dem Bewerten.'); E.answer.focus(); return; }
  if (active()) {
    const ok = await confirmBox('Abgeben und bewerten?', `Die Uhr bleibt bei ${fmt(remaining())} stehen. Die verbrauchte Zeit wird im Ergebnis festgehalten.`, 'Abgeben');
    if (!ok || !active()) return;
    stopTimer();
  }
  // the clock's time belongs to the letter handed in: taken now (the clock could be restarted while the dictionary loads),
  // and only for the first grading after the clock stopped - later revisions are untimed
  const run = timerRun;
  const handIn = (T.state === 'done' || T.state === 'stopped') && !T.graded ? timeUsed() : null;
  grading = true;
  E.btnGrade.disabled = true;
  setLabel(E.btnGrade, Spell.ready ? 'Wird bewertet…' : 'Wörterbuch wird geladen…');
  try {
    if (!Spell.ready && !Spell.failed && !Spell.slow) await Promise.race([ensureSpell(), sleep(15000)]);
    await sleep(20);                                      // let the button repaint before the work
    const text = E.answer.value;                          // the sheet as it is now (typing may continue while the dictionary loads)
    if (!A.countWords(text)) { toast('Ihr Text ist leer. Schreiben Sie Ihren Text vor dem Bewerten.'); return; }
    const ta = performance.now();
    const res = runAnalysis(text, E.task.value, E.model.value);
    track('grade', performance.now() - ta);
    res.time = handIn;
    if (handIn && run === timerRun) { T.graded = true; persistTimer(); }
    res.at = Date.now();
    // the Leitpunkte ticks belong to the task: a revised letter for the same task keeps them
    res.leitChecked = lastResult && lastResult.task === res.task ? lastResult.leitChecked.slice() : [];
    lastResult = res;
    saveAttempt(res, true);
    showResult(res, true);
  } catch (err) {
    toast('Der Text konnte nicht bewertet werden: ' + (err && err.message || err) + '. Laden Sie die Seite neu und versuchen Sie es noch einmal (Ihr Entwurf bleibt erhalten).');
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
    toast('Erneute Bewertung nicht möglich: ' + (err && err.message || err) + '. Laden Sie die Seite neu.');
    return false;
  }
}
function ratingOf(score) {
  if (score >= 90) return ['Sehr gut', 'ok', 'good'];
  if (score >= 75) return ['Gut', 'ok', 'good'];
  if (score >= 50) return ['Mittel', 'warn', 'mid'];
  return ['Mehr üben', 'bad', 'low'];
}
function chk(ok, yes, no) { return `<span class="pill ${ok ? 'ok' : 'bad'}">${ok ? '✓' : '✗'} ${esc(ok ? yes : no)}</span>`; }
const TYPE_LABEL = { R: 'Rechtschreibung', G: 'Großschreibung am Satzanfang' };
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
      <td>${u.type === 'R' ? `<button type="button" class="btn btn-sm" data-addword="${esc(u.w)}">Zu Meine Wörter hinzufügen</button>` : ''}</td>
    </tr>`).join('');
  const hintItems = res.hints.map(h => `<li><b class="w" lang="de">${esc(h.w)}</b> — ${esc(A.HINT_TEXT[h.key] || '')}</li>`).join('');
  const below0 = res.score === 0 && 100 - res.k * res.fq < 0;
  E.paneScore.innerHTML = `\n    <div class="scorehead">\n      <div class="score ${res.spellReady ? scoreKind : ''}"><b>${res.spellReady ? res.score : '—'}</b><span>/ 100</span></div>\n      <div>\n        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${res.spellReady ? `<span class="pill ${pillKind}">${esc(rating)}</span>` : ''}<span class="muted small">${esc(dateStr(res.at))}</span></div>\n        <p class="formula">Punkte = 100 − ${res.k} × Fehlerquotient (Fehler pro 100 Wörter) = 100 − ${res.k} × ${nf1.format(res.fq)}${below0 ? ', mindestens 0' : ''}.</p>\n        ${res.spellReady ? '' : `<p class="formula" style="color:var(--red)">${esc(spellMissingNote())}</p>`}\n      </div>\n    </div>\n    <div class="stats">\n      <div class="stat"><div class="v">${res.words}</div><div class="k">Wörter</div></div>\n      <div class="stat"><div class="v">${res.errors}</div><div class="k">Gezählte Fehler (${res.uniq.length} verschiedene Wörter)</div></div>\n      <div class="stat"><div class="v">${nf1.format(res.fq)}</div><div class="k">Fehlerquotient · Fehler / 100 Wörter</div></div>\n      <div class="stat"><div class="v">${t ? esc(fmt(t.used)) : '—'}</div><div class="k">${t ? 'Verbrauchte Zeit / ' + esc(fmt(t.total)) : 'Ohne Zeitmessung'}</div></div>\n      <div class="stat"><div class="v">${res.sentences}</div><div class="k">Sätze (geschätzt)</div></div>\n      <div class="stat"><div class="v">${res.sentences ? nf1.format(res.words / res.sentences) : '—'}</div><div class="k">Wörter pro Satz im Schnitt</div></div>\n    </div>\n    <div>\n      <h3>Briefform</h3>\n      <div class="checks">\n        ${L.betreff ? '<span class="pill info">Betreffzeile vorhanden</span>' : ''}\n        ${chk(L.anrede, 'Anrede vorhanden', 'Anrede fehlt')}\n        ${L.anrede ? chk(L.komma, 'Komma nach der Anrede', 'Kein Komma nach der Anrede') : ''}\n        ${chk(L.gruss, 'Grußformel vorhanden', 'Grußformel fehlt')}\n        <span class="pill info">${L.paragraphs} Absätze</span>\n        ${L.formal ? `<span class="pill">${L.formal === 'formal' ? 'Formeller Brief (Sie)' : 'Informeller Brief (du)'}</span>` : ''}\n      </div>\n    </div>\n    ${res.leit.length ? `<div><h3>Punkte der Aufgabe (Leitpunkte) — selbst abhaken</h3><ul class="leit">${res.leit.map((p, i) => `<li><label><input type="checkbox" data-lp="${i}"${res.leitChecked[i] ? ' checked' : ''}><span lang="de">${esc(p)}</span></label></li>`).join('')}</ul></div>` : ''}\n    <div>\n      <h3>Fehlerliste</h3>\n      ${res.uniq.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Wort im Text</th><th>Mal</th><th>Vorschläge</th>${res.cmp ? '<th>Im Musterbrief</th>' : ''}<th>Art</th><th></th></tr></thead><tbody lang="de">${errRows}</tbody></table></div>`
        : `<p class="empty">${res.spellReady ? 'Keine Rechtschreibfehler gefunden. Sehr gut!' : 'Die Rechtschreibung konnte nicht geprüft werden.'}</p>`}\n      ${res.namesIgnored.length ? `<p class="muted small" style="margin:8px 0 0">Namen zählen nicht als Fehler (sie stehen in der Aufgabe, in der Anrede oder in der Unterschrift): <span lang="de">${res.namesIgnored.map(esc).join(', ')}</span>.</p>` : ''}\n    </div>\n    ${hintItems ? `<div><h3>Lieber selbst prüfen (kein Punktabzug)</h3><ul class="hintlist">${hintItems}</ul></div>` : ''}\n`;

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
  E.paneCorr.innerHTML = `\n    <div class="legend"><span><i style="background:var(--red-soft);box-shadow:inset 0 -2px 0 var(--red)"></i>R — Rechtschreibfehler, G — fehlende Großschreibung am Satzanfang; ein Klick auf ein Wort zeigt Vorschläge</span><span><i style="background:var(--amber-soft);box-shadow:inset 0 -2px 0 var(--amber)"></i>? — lieber selbst prüfen, kein Punktabzug</span></div>\n    <div class="corr" lang="de">${html}</div>`;

  // comparison with the model answer (offsets refer to the NFC text, exactly as analysis.js aligned it)
  if (!res.cmp) {
    E.paneCmp.innerHTML = '<p class="empty">Noch kein Musterbrief. Fügen Sie einen Musterbrief in das Feld „Musterbrief“ ein (oder klicken Sie auf „Datei öffnen“) und klicken Sie dann erneut auf Bewerten, um Wort für Wort zu vergleichen.</p>';
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
  E.paneCmp.innerHTML = `\n    <div class="stats">\n      <div class="stat"><div class="v">${c.aligned ? pct(c.similarity) : '—'}</div><div class="k">Ähnlichkeit (gleiche Wörter, gleiche Reihenfolge)</div></div>\n      <div class="stat"><div class="v">${pct(c.coverage)}</div><div class="k">Verwendeter Wortschatz des Musterbriefs (${c.used}/${c.uniqB.length})</div></div>\n      <div class="stat"><div class="v">${res.words} / ${A.countWords(modelN)}</div><div class="k">Wörter: Ihr Text / Musterbrief</div></div>\n    </div>\n    ${c.aligned ? '' : '<p class="muted small">Die beiden Texte sind zu lang für einen Wort-für-Wort-Abgleich, daher gibt es nur die Wortschatz-Statistik.</p>'}\n    ${c.missing.length ? `<div><h3>Gute Wörter aus dem Musterbrief, die Sie noch nicht verwendet haben</h3><div class="wordchips" lang="de">${c.missing.map(w => `<span>${esc(w)}</span>`).join('')}</div></div>` : ''}\n    ${c.aligned ? '<div class="legend"><span><i style="background:var(--red-soft);box-shadow:inset 0 -2px 0 var(--red)"></i>nur in Ihrem Text</span><span><i style="background:var(--green-soft);box-shadow:inset 0 -2px 0 var(--green)"></i>nur im Musterbrief</span><span>Unmarkierter Text: in beiden Texten, in derselben Reihenfolge.</span></div>' : ''}\n    <div class="cmp">\n      <div class="cmp-col"><h4>Ihr Text</h4><div class="cmp-text" lang="de">${col(res.text, c.A, c.inA, 'only-a')}</div></div>\n      <div class="cmp-col"><h4>Musterbrief</h4><div class="cmp-text" lang="de">${col(modelN, c.B, c.inB, 'only-b')}</div></div>\n    </div>`;
}
E.paneScore.addEventListener('change', e => {
  const cb = e.target.closest('input[data-lp]');
  if (cb && lastResult) lastResult.leitChecked[+cb.dataset.lp] = cb.checked;
});
function errorPopHtml(u) {
  return `<div class="w" lang="de">${esc(u.w)}</div>\n    <div class="muted small">${u.type === 'G' ? 'Am Satzanfang wird großgeschrieben.' : 'Rechtschreibfehler.'} Vorkommen: ${u.n}.</div>\n    ${u.sugg.length ? `<div><div class="lbl">Vorschläge</div><div class="sugg" lang="de">${u.sugg.map(s => `<span>${esc(s)}</span>`).join('')}</div></div>` : '<div class="muted small">Das Wörterbuch hat keine Vorschläge.</div>'}\n    ${u.similar ? `<div><div class="lbl">Im Musterbrief</div><span class="w" lang="de" style="font-size:16px">${esc(u.similar)}</span></div>` : ''}\n    ${u.type === 'R' ? `<div class="row"><button type="button" class="btn btn-sm" data-addword="${esc(u.w)}">Das Wort ist richtig — zu Meine Wörter hinzufügen</button></div>` : ''}\n    ${u.type === 'R' && Api.base ? `<div class="row"><button type="button" class="btn btn-sm" data-suggest="${esc(u.w)}">Dieses Wort für das gemeinsame Wörterbuch vorschlagen</button></div>` : ''}`;
}
E.paneCorr.addEventListener('click', e => {
  const m = e.target.closest('mark');
  if (!m || !lastResult) return;
  if (m.dataset.k !== undefined) { const u = lastResult.uniq[+m.dataset.k]; if (u) openPop(m, errorPopHtml(u)); }
  else if (m.dataset.h !== undefined) {
    const h = lastResult.hints[+m.dataset.h];
    if (h) openPop(m, `<div class="w" lang="de">${esc(h.w)}</div><div class="small">${esc(A.HINT_TEXT[h.key] || '')}</div><div class="muted small">Hinweis zum Prüfen, kein Punktabzug.</div>`);
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
  if (refused.includes(w)) { toast(`Die Rechtschreibprüfung konnte das Wort „${w}“ nicht übernehmen, daher bleibt es markiert.`); return; }
  if (regrade()) toast(`„${w}“ wurde zu Meine Wörter hinzugefügt. Der Text wurde neu bewertet.`);
}
const RES_TABS = '.tab:not(.adm-tab)';                    // the result tabs (the admin dashboard has its own)
function selectTab(id) {
  $$(RES_TABS).forEach(t => {
    const on = t.id === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
  closePop();
}
$$(RES_TABS).forEach(t => {
  t.addEventListener('click', () => selectTab(t.id));
  t.addEventListener('keydown', e => {
    const tabs = $$(RES_TABS), i = tabs.indexOf(t);
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
let histCache = null;                                     // parsed once per change, not on every render
function loadHistory() {
  if (!histCache) { const h = store.get('history', []); histCache = Array.isArray(h) ? h.filter(x => x && typeof x === 'object' && x.id) : []; }
  return histCache.slice();
}
function saveAttempt(res, isNew) {
  const hist = loadHistory();
  const same = h => !!h && h.mode !== 'trace' && h.text === res.rawText && h.taskFull === res.task;
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
  putHistory(hist, entry);
  return entry;
}
function putHistory(hist, entry) {                        // insert or replace one entry, keep at most 100, survive a full quota
  const i = hist.findIndex(h => h.id === entry.id);
  if (i >= 0) hist[i] = entry; else hist.unshift(entry);
  if (hist.length > 100) hist.length = 100;
  if (!store.set('history', hist) && !store.blocked && hist.length > 20) {   // quota full: make room, and say so
    const dropped = hist.length - 20;
    hist.length = 20;
    if (store.set('history', hist)) toast(`Der Speicher des Browsers ist voll: Die ${dropped} ältesten Bewertungen wurden gelöscht, um das neue Ergebnis zu speichern.`);
  }
  renderHistory();
  scheduleBackup();
}
function renderHistory() {
  const hist = loadHistory();
  E.btnClearHist.disabled = E.btnClearHist2.disabled = !hist.length;
  renderStorageState();
  if (!hist.length) {
    E.histBody.innerHTML = '<p class="empty">Noch keine Bewertungen. Bei jedem Klick auf Bewerten wird das Ergebnis (Punkte, Fehler, Zeit) hier gespeichert, damit Sie Ihre Fortschritte verfolgen können.</p>';
    return;
  }
  const rows = hist.map((h, i) => {
    const trace = h.mode === 'trace';
    // trend: against the previous attempt of the same kind (and, for letters, the same deduction per error)
    const prev = hist.slice(i + 1).find(x => (x.mode === 'trace') === trace);
    let trend = '';
    if (prev && h.score != null && prev.score != null && h.score !== prev.score && (trace || (+h.k || 10) === (+prev.k || 10))) {
      trend = h.score > prev.score ? `<span class="trend-up">↑ ${h.score - prev.score}</span>` : `<span class="trend-down">↓ ${prev.score - h.score}</span>`;
    }
    const kind = h.score == null ? '' : trace ? (h.score >= 95 ? 'ok' : h.score >= 85 ? 'warn' : 'bad') : h.score >= 75 ? 'ok' : h.score >= 50 ? 'warn' : 'bad';
    const scoreCell = trace ? `<span class="pill ${kind}" title="Anteil richtig getippter Buchstaben beim Nachschreiben">${+h.score} %</span>`
      : `<span class="pill ${kind}" title="${+h.k || 10} Punkte Abzug pro Fehler / 100 Wörter">${h.score == null ? '—' : +h.score}</span>`;
    const timeCell = trace ? (h.used != null ? esc(fmt(h.used)) : '—') : h.used != null ? esc(fmt(h.used)) + ' / ' + esc(fmt(h.total)) : '—';
    return `<tr>\n      <td style="white-space:nowrap">${esc(dateStr(h.t))}</td>\n      <td><span lang="de">${esc(h.task || '—')}</span>${trace ? ' <span class="pill info">Nachschreiben</span>' : ''}</td>\n      <td class="num">${+h.words || 0}</td>\n      <td class="num">${+h.errors || 0}</td>\n      <td class="num">${scoreCell} ${trend}</td>\n      <td class="num">${timeCell}</td>\n      <td><button type="button" class="btn btn-sm" data-reopen="${esc(h.id)}">Wieder öffnen</button></td>\n    </tr>`;
  }).join('');
  E.histBody.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Datum</th><th>Aufgabe</th><th>Wörter</th><th>Fehler</th><th>Punkte</th><th>Zeit</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
E.histBody.addEventListener('click', async e => {
  const b = e.target.closest('[data-reopen]');
  if (!b) return;
  const h = loadHistory().find(x => x.id === b.dataset.reopen);
  if (!h) return;
  if (active()) { toast('Die Uhr läuft. Geben Sie zuerst ab oder setzen Sie die Uhr zurück.'); return; }
  if (h.mode === 'trace') { await reopenTrace(h); return; }
  const hasModel = typeof h.modelFull === 'string';        // entries saved before this version have no model answer
  const lose = [];
  if (E.answer.value.trim() && E.answer.value !== h.text) lose.push('der Text, den Sie gerade schreiben');
  if (h.taskFull && E.task.value.trim() && E.task.value !== h.taskFull) lose.push('die Aufgabe');
  if (hasModel && E.model.value.trim() && E.model.value !== h.modelFull) lose.push('der Musterbrief');
  if (lose.length && !(await confirmBox('Früheren Text wieder öffnen?', `Folgendes auf der Seite wird durch den Inhalt der Bewertung vom ${dateStr(h.t)} ersetzt: ${capFirst(joinVi(lose))}.`, 'Wieder öffnen'))) return;
  if (T.state === 'done' || T.state === 'stopped') resetTimer();   // the old attempt has nothing to do with the last clock
  if (traceOn()) { settings.mode = 'free'; saveSettings(); applyMode(); }
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
    toast(res.spellReady ? `Der Text vom ${dateStr(h.t)} wurde wieder geöffnet und mit dem aktuellen Wörterbuch und den aktuellen Einstellungen neu bewertet (der Verlauf bleibt unverändert).`
      : `Der Text vom ${dateStr(h.t)} wurde wieder geöffnet. Die Rechtschreibung erscheint, sobald das Wörterbuch geladen ist.`);
  } catch (err) {
    lastResult = null;
    toast('Der frühere Text konnte nicht neu bewertet werden: ' + (err && err.message || err) + '. Klicken Sie auf Bewerten, um es erneut zu versuchen.');
  }
});
async function clearHistory() {
  const linked = Backup.handle && Backup.perm === 'granted' ? ' Die verknüpfte Datei der automatischen Sicherung wird ebenfalls aktualisiert.' : '';
  if (!(await confirmBox('Den ganzen Verlauf löschen?', 'Alle in diesem Browser gespeicherten Ergebnisse werden gelöscht. Das kann nicht rückgängig gemacht werden.' + linked, 'Verlauf löschen', true))) return;
  store.del('history'); currentAttempt = null; renderHistory(); scheduleBackup(); toast('Verlauf gelöscht.');
}
E.btnClearHist.addEventListener('click', clearHistory);
E.btnClearHist2.addEventListener('click', clearHistory);

/* ===================== configuration: scoring, personal words, data ===================== */
function renderKExample() {
  E.kExample.textContent = `Beispiel: 150 Wörter, 3 Fehler → ${nf1.format(2)} Fehler/100 Wörter → ${Math.max(0, Math.round(100 - settings.k * 2))} Punkte`;
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
  if (bad.length) toast(`Übersprungen: ${bad.slice(0, 5).join(', ')} (nur Wörter aus Buchstaben, Bindestrichen oder Apostrophen werden angenommen).`);
  else if (refused.length) toast(`Von der Rechtschreibprüfung nicht übernommen: ${refused.slice(0, 5).join(', ')}.`);
  if (lastResult) regrade();
  renderStorageState(); renderServerUi();
});
function renderStorageState() {
  const bad = store.blocked || store.pending;
  E.saveWarn.hidden = !bad;
  E.storageState.style.color = bad ? 'var(--red)' : '';
  if (store.blocked) {
    E.storageState.textContent = 'Der Browser blockiert das Speichern (zum Beispiel ein privates Fenster oder Sicherheitseinstellungen). Entwurf, Verlauf und Einstellungen bleiben nur erhalten, bis die Seite geschlossen wird.';
    return;
  }
  E.storageState.textContent = (store.pending ? 'Der Speicher des Browsers ist voll: Was nicht gespeichert werden konnte, bleibt nur erhalten, bis die Seite geschlossen wird. Löschen Sie einen Teil des Verlaufs. ' : '') +
    `Gespeichert werden: der Entwurf, ${loadHistory().length} Bewertungen im Verlauf, die Einstellungen und ${settings.words.length} Wörter in „Meine Wörter“.`;
}
function renderAbout() {
  E.aboutEngine.textContent = Spell.ready
    ? `Verwendet: Hunspell ${Spell.version} · Wörterbuch de_DE · ${A.EXTRA_WORDS.length} ergänzte neuere Wörter · ${Spell.added.size} eigene Wörter.`
    : Spell.failed ? 'Das Wörterbuch konnte nicht geladen werden. ' + SPELL_FAIL_HINT : Spell.slow ? 'Das Wörterbuch lädt langsam (langsames Netz)…' : 'Wörterbuch wird geladen…';
}
function renderConfig() { renderSitePanel(); renderStorageState(); renderAbout(); renderServerUi(); }
E.btnClearDraft.addEventListener('click', async () => {
  if (active()) { toast('Die Uhr läuft. Geben Sie zuerst ab oder setzen Sie die Uhr zurück.'); return; }
  if (!(await confirmBox('Entwurf löschen?', 'Ihr Text, die Aufgabe und der Musterbrief werden von der Seite und aus diesem Browser entfernt; die Seite lädt wieder die Beispielaufgabe. Verlauf und Einstellungen bleiben unverändert.', 'Entwurf löschen', true))) return;
  store.del('draft');
  E.answer.value = '';
  resetTraceSession();
  loadSample('geburtstag', true);
  E.answer.dispatchEvent(new Event('input'));
  resetTimer(); lastResult = null; currentAttempt = null; E.results.hidden = true;
  toast('Entwurf gelöscht.');
});
E.optExam.addEventListener('change', () => { settings.exam = E.optExam.checked; saveSettings(); applyExam(); });
E.optSound.addEventListener('change', () => {
  settings.sound = E.optSound.checked; saveSettings();
  if (!settings.sound) cancelAlarms();
  else if (T.state === 'running') scheduleAlarms(remaining());
});
E.btnModelToggle.addEventListener('click', () => { settings.showModel = !settings.showModel; saveSettings(); applyExam(); });

/* ===================== backup: files on the user's computer ===================== */
// Export / import a .json backup (history, settings, personal words, draft) and the personal words as .txt.
// In Chrome / Edge / Cốc Cốc a backup file can be linked once (File System Access API, the handle kept in IndexedDB):
// every change of history or settings is then written to it automatically.
const WORD_OK = /^\p{L}[\p{L}\p{M}'’.-]*$/u;
const IN_FRAME = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
const FS_OK = typeof window.showSaveFilePicker === 'function' && typeof indexedDB !== 'undefined' && !IN_FRAME;
const Backup = { handle: null, name: '', perm: '', lastSaved: 0, writing: false, again: false, error: '', warned: false };
let backupTimer = 0;
function scheduleBackup() {
  if (!Backup.handle || Backup.perm !== 'granted') return;
  clearTimeout(backupTimer);
  backupTimer = setTimeout(writeBackup, 2000);
}
function idbOpen() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('b1st', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}
async function idbDo(mode, fn) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('kv', mode), req = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
const idbGet = k => idbDo('readonly', st => st.get(k));
const idbSet = (k, v) => idbDo('readwrite', st => st.put(v, k));
const idbDel = k => idbDo('readwrite', st => st.delete(k));

function buildBackup() {
  const { k, sound, exam, time, showModel, mode, helpers, fileTip, stats } = settings;
  return { app: 'B1 Schreibtrainer', format: 1, exportedAt: isoLocal(Date.now()),
    settings: { k, sound, exam, time, showModel, mode, helpers, fileTip, stats }, words: settings.words.slice(), history: loadHistory(),
    draft: { task: E.task.value, model: E.model.value, answer: E.answer.value }, trace: store.get('trace', null) };
}
function cleanEntry(h) {
  if (!h || typeof h !== 'object' || typeof h.id !== 'string' || !h.id || typeof h.text !== 'string') return null;
  const num = v => (v != null && Number.isFinite(+v) ? +v : null);
  const e = { id: h.id.slice(0, 40), t: num(h.t) || 0, task: String(h.task || '').slice(0, 120), taskFull: typeof h.taskFull === 'string' ? h.taskFull : '',
    text: h.text, words: num(h.words) || 0, errors: num(h.errors) || 0, fq: num(h.fq), k: num(h.k), score: num(h.score), used: num(h.used), total: num(h.total) };
  if (typeof h.modelFull === 'string') e.modelFull = h.modelFull;
  if (h.mode === 'trace') { e.mode = 'trace'; if (h.cats && typeof h.cats === 'object') e.cats = h.cats; }
  return e;
}
function parseBackup(text) {
  let o;
  try { o = JSON.parse(String(text).replace(/^﻿/, '')); } catch (e) { throw new ImportError('Diese Datei ist keine gültige Sicherungsdatei (der JSON-Inhalt ist fehlerhaft).'); }
  if (!o || typeof o !== 'object' || o.app !== 'B1 Schreibtrainer' || o.format !== 1) throw new ImportError('Dies ist keine Sicherungsdatei von B1 Schreibtrainer.');
  const hist = (Array.isArray(o.history) ? o.history : []).map(cleanEntry).filter(Boolean).slice(0, 500);
  const words = (Array.isArray(o.words) ? o.words : []).filter(w => typeof w === 'string').map(w => w.normalize('NFC')).filter(w => WORD_OK.test(w));
  const d = o.draft && typeof o.draft === 'object' ? o.draft : null;
  const draft = d ? { task: String(d.task || ''), model: String(d.model || ''), answer: String(d.answer || '') } : null;
  return { hist, words, draft, settings: o.settings && typeof o.settings === 'object' ? o.settings : null, at: o.exportedAt };
}
function backupSummary(b) {
  const at = Date.parse(b.at);
  return `${b.hist.length} Übungen im Verlauf, ${b.words.length} Wörter in „Meine Wörter“` + (Number.isFinite(at) ? `, gespeichert am ${dateStr(at)}` : '');
}
function askRestore(b, title) {
  return openModal({ title: title || 'Aus der Sicherungsdatei wiederherstellen?', html: `<p>Die Datei enthält ${esc(backupSummary(b))}.</p>\n      <p class="small"><b>Zusammenführen</b>: ergänzt die vorhandenen Daten und löscht nichts. <b>Ersetzen</b>: Verlauf, Einstellungen, „Meine Wörter“ und der Entwurf in diesem Browser werden durch den Inhalt der Datei ersetzt.</p>`,
    buttons: [{ label: 'Abbrechen', value: null }, { label: 'Alles ersetzen', value: 'replace', danger: true }, { label: 'Mit den vorhandenen Daten zusammenführen', value: 'merge', primary: true }] });
}
function applyBackup(b, replace) {
  const cur = replace ? [] : loadHistory(), ids = new Set(cur.map(h => h.id));
  const fresh = b.hist.filter(h => !ids.has(h.id));
  const hist = cur.concat(fresh).sort((x, y) => (y.t || 0) - (x.t || 0)).slice(0, 100);
  store.set('history', hist);
  currentAttempt = null;
  const before = new Set(settings.words);
  if (replace && b.settings) {
    const ns = cleanSettings(b.settings);
    for (const k of ['k', 'sound', 'exam', 'time', 'showModel', 'mode', 'helpers', 'fileTip', 'stats']) settings[k] = ns[k];
  }
  settings.words = [...new Set((replace ? [] : settings.words).concat(b.words))];
  const addedWords = settings.words.filter(w => !before.has(w)).length;
  saveSettings();
  E.optWords.value = settings.words.join('\n');
  E.optK.value = settings.k; renderKExample();
  if (!active()) E.timeInput.value = settings.time;
  applyHelpers();
  syncPersonalWords();
  if (replace && b.draft && !active()) {
    E.task.value = b.draft.task; E.model.value = b.draft.model; E.answer.value = b.draft.answer;
    E.task.dispatchEvent(new Event('input')); E.model.dispatchEvent(new Event('input')); E.answer.dispatchEvent(new Event('input'));
    E.sampleNote.hidden = !SAMPLES.some(x => x.task === E.task.value);
    lastResult = null;
  }
  applyMode();
  applyTimerUI();
  if (lastResult) regrade();
  renderHistory(); renderStorageState(); renderServerUi();
  scheduleBackup();
  toast(replace ? `Durch die Daten aus der Datei ersetzt: ${hist.length} Übungen, ${settings.words.length} eigene Wörter.`
    : `Zusammengeführt: ${fresh.length} Übungen und ${addedWords} eigene Wörter hinzugefügt.`);
}
async function saveFile(name, text, mime) {
  const C = window.claude;
  if (IN_FRAME && C && typeof C.use === 'function') {     // claude.ai: the platform asks the viewer before saving
    let dl = null;
    try { dl = await C.use('downloads'); } catch (e) { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data: text }); return true; }
      catch (e) {
        const code = e && e.code;
        if (code !== 'declined') toast(code === 'rate_limited' ? 'Ein anderes Dialogfenster zum Speichern ist offen. Versuchen Sie es später noch einmal.' : 'Der Browser erlaubt hier kein Speichern von Dateien.');
        return false;
      }
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
// Every system file dialog goes through here: the draft is saved first (nothing is lost if the browser is closed while
// Windows' dialog hangs), a short note explains the wait (can be turned off), and Chromium's picker remembers the folder.
async function chooseFile(accept, types) {
  saveDraft.flush(); saveTrace.flush();
  if (settings.fileTip) {
    const v = await openModal({ title: 'Dateiauswahl öffnen',
      html: `<p>Die Dateiauswahl von Windows braucht manchmal einige Sekunden (OneDrive-Ordner, Netzlaufwerke, Ordner mit vielen Bildern). Währenddessen kann der Browser stillstehen: Bitte schließen Sie ihn nicht. Ihr Text ist gespeichert.</p>\n        <p class="small muted">Schneller: eine Datei in das Feld Aufgabe / Musterbrief ziehen oder die Datei in Word / im Editor öffnen, dann kopieren und einfügen.</p>\n        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="fileTipOff"> Nicht mehr erinnern</label>`,
      buttons: [{ label: 'Abbrechen', value: false }, { label: 'Dateiauswahl öffnen', value: true, primary: true }] });
    const off = $('#fileTipOff', E.modal);
    if (off && off.checked) { settings.fileTip = false; saveSettings(); applyHelpers(); }
    if (!v) return null;
  }
  if (types && typeof window.showOpenFilePicker === 'function' && !IN_FRAME) {
    try {
      const [h] = await window.showOpenFilePicker({ id: 'b1-open', startIn: 'documents', multiple: false, types });
      return h ? await h.getFile() : null;
    } catch (e) { if (e && e.name === 'AbortError') return null; }   // anything else: the classic dialog below
  }
  return pickFile(accept);
}
const TEXT_TYPES = [{ description: 'Text (.txt, .docx)', accept: { 'text/plain': ['.txt', '.md'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }];
function pickFile(accept) {                               // resolves the chosen File, or null when cancelled
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = accept; inp.hidden = true;
    const done = f => { resolve(f || null); inp.remove(); };
    inp.addEventListener('change', () => done(inp.files && inp.files[0]));
    inp.addEventListener('cancel', () => done(null));
    document.body.appendChild(inp);
    inp.click();
  });
}
async function writeBackup() {
  clearTimeout(backupTimer);
  if (!Backup.handle || Backup.perm !== 'granted') return;
  if (Backup.writing) { Backup.again = true; return; }
  Backup.writing = true;
  try {
    const w = await Backup.handle.createWritable();
    await w.write(JSON.stringify(buildBackup(), null, 1));
    await w.close();
    Backup.lastSaved = Date.now(); Backup.error = '';
  } catch (e) {
    const n = e && e.name;
    if (n === 'NotAllowedError') Backup.perm = 'prompt';
    else Backup.error = n === 'NotFoundError' ? 'Datei nicht gefunden (gelöscht, umbenannt oder verschoben?)' : (e && e.message) || String(e);
    if (!Backup.warned) { Backup.warned = true; toast('Die Datei der automatischen Sicherung konnte nicht geschrieben werden. Siehe Tab Einstellungen → Daten.'); }
  } finally {
    Backup.writing = false;
    renderBackupState();
    if (Backup.again) { Backup.again = false; scheduleBackup(); }
  }
}
function renderBackupState() {
  const has = !!Backup.handle;
  E.btnLink.hidden = !FS_OK;
  setLabel(E.btnLink, has ? 'Andere Datei wählen' : 'Datei für die automatische Sicherung wählen');
  E.btnUnlink.hidden = E.btnLinkRestore.hidden = !has;
  E.btnLinkAllow.hidden = !(has && Backup.perm !== 'granted');
  E.linkState.style.color = Backup.error ? 'var(--red)' : '';
  if (!FS_OK) {
    E.linkState.textContent = IN_FRAME ? 'In der Version auf claude.ai erlaubt der Browser keine Dateiverknüpfung. Verwenden Sie „Sicherungsdatei exportieren“.'
      : 'Dieser Browser unterstützt noch keine Dateiverknüpfung (dafür braucht es Chrome, Edge oder Cốc Cốc). Verwenden Sie regelmäßig „Sicherungsdatei exportieren“.';
  } else if (!has) {
    E.linkState.textContent = 'Nicht verknüpft. Wählen (oder erstellen) Sie eine .json-Datei: Nach jeder Bewertung, Nachschreib-Übung oder Änderung der Einstellungen werden die Daten automatisch in diese Datei geschrieben.';
  } else if (Backup.perm !== 'granted') {
    E.linkState.textContent = `„${Backup.name}“ ist verknüpft. Bei jedem Öffnen der Seite müssen Sie dem Browser einmal erlauben, wieder in die Datei zu schreiben.`;
  } else {
    E.linkState.textContent = `Automatische Sicherung in „${Backup.name}“` + (Backup.lastSaved ? ` — zuletzt geschrieben um ${new Date(Backup.lastSaved).toLocaleTimeString(LOCALE)}` : '') +
      (Backup.error ? ` — noch nicht geschrieben: ${Backup.error}` : '') + '.';
  }
}
async function initBackup() {
  if (FS_OK) {
    try {
      const h = await idbGet('backupHandle');
      if (h && typeof h.queryPermission === 'function') {
        Backup.handle = h; Backup.name = h.name;
        Backup.perm = await h.queryPermission({ mode: 'readwrite' });
      }
    } catch (e) { Backup.error = 'die gespeicherte Verknüpfung konnte nicht gelesen werden'; }
  }
  renderBackupState();
}
E.btnBackupExport.addEventListener('click', () => saveFile(`b1-schreibtrainer-sao-luu-${isoLocal(Date.now()).slice(0, 10)}.json`, JSON.stringify(buildBackup(), null, 1), 'application/json'));
E.btnBackupImport.addEventListener('click', async () => {
  const f = await chooseFile('.json,application/json', [{ description: 'Sicherungsdatei von B1 Schreibtrainer', accept: { 'application/json': ['.json'] } }]);
  if (!f) return;
  let b;
  try { b = parseBackup(await readText(f)); } catch (e) { toast(e instanceof ImportError ? e.message : 'Die Sicherungsdatei konnte nicht gelesen werden.'); return; }
  const how = await askRestore(b);
  if (how) applyBackup(b, how === 'replace');
});
E.btnLink.addEventListener('click', async () => {
  let h;
  try {
    h = await window.showSaveFilePicker({ suggestedName: 'b1-schreibtrainer-sao-luu.json', id: 'b1-backup', startIn: 'documents',
      types: [{ description: 'Sicherungsdatei von B1 Schreibtrainer', accept: { 'application/json': ['.json'] } }] });
  } catch (e) { if (!e || e.name !== 'AbortError') toast('Die Datei konnte nicht gewählt werden: ' + (e && e.message || e)); return; }
  // the chosen file may already hold something: never overwrite it silently
  let kind = 'empty', b = null;
  try {
    const f = await h.getFile();
    if (f.size > 0) { try { b = parseBackup(await f.text()); kind = 'backup'; } catch (e) { kind = 'other'; } }
  } catch (e) { kind = 'empty'; }
  if (kind === 'other' && !(await confirmBox('Diese Datei hat bereits anderen Inhalt', `„${h.name}“ ist keine Sicherungsdatei von B1 Schreibtrainer. Diese Datei überschreiben?`, 'Überschreiben', true))) return;
  if (kind === 'backup') {
    const how = await openModal({ title: 'Diese Datei enthält bereits eine Sicherung', html: `<p>„${esc(h.name)}“ enthält ${esc(backupSummary(b))}.</p><p class="small">Wählen Sie, wie die Datei verwendet werden soll, bevor die automatische Sicherung hineinschreibt.</p>`,
      buttons: [{ label: 'Abbrechen', value: null }, { label: 'Mit den aktuellen Daten überschreiben', value: 'overwrite', danger: true }, { label: 'Datei mit den aktuellen Daten zusammenführen', value: 'merge', primary: true }] });
    if (!how) return;
    if (how === 'merge') applyBackup(b, false);
  }
  Backup.handle = h; Backup.name = h.name; Backup.perm = 'granted'; Backup.error = ''; Backup.warned = false;
  try { await idbSet('backupHandle', h); } catch (e) { Backup.error = 'der Browser kann sich die Verknüpfung nach dem Schließen der Seite nicht merken'; }
  await writeBackup();
  if (!Backup.error) toast(`„${h.name}“ ist verknüpft. Ab jetzt werden Ihre Daten automatisch in dieser Datei gesichert.`);
});
E.btnLinkAllow.addEventListener('click', async () => {
  try { Backup.perm = await Backup.handle.requestPermission({ mode: 'readwrite' }); } catch (e) { Backup.perm = 'denied'; }
  if (Backup.perm === 'granted') await writeBackup(); else renderBackupState();
});
E.btnLinkRestore.addEventListener('click', async () => {
  let b;
  try {
    if ((await Backup.handle.queryPermission({ mode: 'read' })) !== 'granted' && (await Backup.handle.requestPermission({ mode: 'read' })) !== 'granted') return;
    b = parseBackup(await (await Backup.handle.getFile()).text());
  } catch (e) { toast(e instanceof ImportError ? e.message : 'Die verknüpfte Datei konnte nicht gelesen werden: ' + (e && e.message || e)); return; }
  const how = await askRestore(b, `Aus „${Backup.name}“ wiederherstellen?`);
  if (how) applyBackup(b, how === 'replace');
});
E.btnUnlink.addEventListener('click', async () => {
  if (!(await confirmBox('Verknüpfung der Sicherungsdatei lösen?', `Die Seite schreibt nicht mehr in „${Backup.name}“. Die Datei bleibt unverändert auf Ihrem Computer.`, 'Verknüpfung lösen'))) return;
  try { await idbDel('backupHandle'); } catch (e) { /* nothing stored */ }
  Object.assign(Backup, { handle: null, name: '', perm: '', error: '', lastSaved: 0 });
  renderBackupState();
});
E.btnWordsExport.addEventListener('click', () => {
  if (!settings.words.length) { toast('„Meine Wörter“ ist leer.'); return; }
  saveFile('tu-cua-toi.txt', settings.words.join('\r\n') + '\r\n', 'text/plain');
});
E.btnWordsImport.addEventListener('click', async () => {
  const f = await chooseFile('.txt,.dic,text/plain', [{ description: 'Wortliste (.txt)', accept: { 'text/plain': ['.txt', '.dic'] } }]);
  if (!f) return;
  let text;
  try { text = await readText(f); } catch (e) { toast('Die Datei konnte nicht gelesen werden.'); return; }
  const parts = text.replace(/\u0000/g, '').replace(/^﻿/, '').split(/[\s,;]+/).map(w => w.trim().normalize('NFC')).filter(Boolean);
  const ok = [...new Set(parts.filter(w => WORD_OK.test(w)))], bad = parts.filter(w => !WORD_OK.test(w)).length;
  const before = new Set(settings.words), added = ok.filter(w => !before.has(w));
  if (!added.length) { toast(bad ? `Keine neuen Wörter (${bad} ungültige Einträge übersprungen).` : 'Keine neuen Wörter in der Datei.'); return; }
  settings.words = settings.words.concat(added);
  saveSettings();
  E.optWords.value = settings.words.join('\n');
  const refused = syncPersonalWords();
  if (lastResult) regrade();
  renderStorageState(); renderServerUi();
  toast(`${added.length} Wörter zu „Meine Wörter“ hinzugefügt` + (bad ? `, ${bad} ungültige Einträge übersprungen` : '') + (refused.length ? `; ${refused.length} Wörter hat die Rechtschreibprüfung nicht übernommen` : '') + '.');
});

/* ===================== the server (Cloudflare Worker + D1): contributions, reports, statistics, admin ===================== */
const APP_VERSION = '2.1.0';
const APP_DATE = '2026-10-03';                             // last change to the page's content (build.py: sitemap, structured data)
// contributed model answers (the owner's plan: a task, a model answer of more than 10 sentences and more than 50 words, spelling
// 90 or more). The server checks again what it can - lengths, its own simpler word and sentence count, the score sent - and
// the owner reviews every contribution.
const RULES = { WORDS_OVER: 50, SENTENCES_OVER: 10, MIN_SCORE: 90, TASK_MIN: 20, TASK_MAX: 3000, MODEL_MAX: 8000 };
const CONTACT = 'nguyenthanhkienqt13@gmail.com';
const Api = { base: '', fromSite: '', local: '' };       // base = the admin's own setting, else "api" in site.json
class ApiError extends Error { constructor(code, message, status) { super(message); this.code = code; this.status = status || 0; } }
function cleanApiUrl(v) {                                 // '' = none, null = invalid
  const s = String(v || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname))) return (u.origin + u.pathname).replace(/\/+$/, '');
  } catch (e) { /* not a URL */ }
  return null;
}
// Header values must be plain ASCII: a Vietnamese input method (Telex / VNI) silently turns "dd", "aw"... into đ, ă.
function tokenProblem(t) {
  if (!t) return 'Hãy nhập mã quản trị.';
  if (!/^[\x21-\x7E]+$/.test(t)) return 'Mã quản trị chỉ gồm chữ cái không dấu, chữ số và ký hiệu. Nếu đang bật bộ gõ tiếng Việt (Telex / VNI), hãy tắt bộ gõ rồi dán lại mã.';
  return '';
}
// The server writes its messages in Vietnamese. The English and German pages (en.html, de.html) give the replies a learner
// can meet in the page's language instead; the numbers are read from the server's sentence, whose wording stays as it is.
// The Vietnamese page shows the server's own message.
const FIELD_NAME = { title: 'Titel', task: 'Aufgabe', model: 'Musterbrief', author: 'Name der beitragenden Person', message: 'Inhalt',
  contact: 'Kontakt', page: /*vi*/'Seite', ua: 'Browser', app: 'Version' };
function serverText(code, msg) {
  if (LANG === 'vi' || !msg || !code) return msg;
  const n = (String(msg).match(/\d+/g) || []).map(Number);
  const field = /^invalid_(\w+)$/.exec(code);
  if (field && FIELD_NAME[field[1]] && n.length >= 2) return `${FIELD_NAME[field[1]]} braucht ${n[0]} bis ${n[1]} Zeichen.`;
  if (code === 'rate_limited') return 'Sie haben zu oft gesendet. Versuchen Sie es später noch einmal.';
  if (code === 'too_large') return 'Der gesendete Inhalt ist zu lang.';
  if (code === 'bad_json') return 'Die gesendeten Daten haben nicht das richtige Format.';
  if (code === 'score_low' && n.length >= 1) return `Der Musterbrief braucht mindestens ${n[0]} Rechtschreibpunkte.`;
  if (code === 'too_short' && n.length >= 4) return `Der Musterbrief braucht mindestens ${n[0]} Wörter und ${n[1]} Sätze (der Server hat ${n[2]} Wörter, ${n[3]} Sätze gezählt).`;
  if (code === 'duplicate') return 'Dieser Musterbrief wurde bereits gesendet.';
  if (code === 'no_words') return 'Keine gültigen Wörter (nur Buchstaben, Bindestriche und Apostrophe; 2–40 Zeichen).';
  if (code === 'no_schema' || code === 'no_database') return 'Der Server der Seite hat ein Problem. Versuchen Sie es später noch einmal.';
  return msg;
}
// Resolves with the reply object (null for 204). Rejects with an ApiError whose code says what went wrong:
// a code from the server (unauthorized, rate_limited, invalid_*, no_schema...), timeout, network, bad_reply, bad_token, client.
async function apiFetch(path, opts = {}) {
  if (!Api.base) throw new ApiError('no_api', 'Die Seite hat keinen Server.');
  if (opts.token && tokenProblem(opts.token)) throw new ApiError('bad_token', tokenProblem(opts.token));
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), opts.timeout || 12000);
  try {
    const headers = {};
    if (opts.body !== undefined) headers['Content-Type'] = 'text/plain;charset=UTF-8';   // a "simple" request: no extra preflight
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    const r = await fetch(Api.base + path, { method: opts.method || 'GET', headers, cache: 'no-store', signal: ctl.signal, keepalive: !!opts.keepalive,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    const raw = await r.text();
    let j = null;
    try { j = raw ? JSON.parse(raw) : null; } catch (e) { j = null; }
    if (!r.ok) throw new ApiError(j && j.error || 'http_' + r.status, serverText(j && j.error, j && j.message) || `Der Server meldet Fehler ${r.status}.`, r.status);
    if (r.status === 204) return null;
    // a 2xx that is not a JSON object: the address answers, but it is not this server (a web page, a proxy's error page...)
    if (!j || typeof j !== 'object' || Array.isArray(j)) throw new ApiError('bad_reply', 'Diese Adresse antwortet, ist aber kein B1-Schreibtrainer-Server (die Daten haben das falsche Format).', r.status);
    return j;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e && e.name === 'AbortError') throw new ApiError('timeout', 'Der Server antwortet nicht (Zeitüberschreitung). Versuchen Sie es später noch einmal.');
    if (e instanceof TypeError) throw new ApiError('network', 'Keine Verbindung zum Server (kein Netz oder falsche Serveradresse).');
    throw new ApiError('client', 'Die Anfrage konnte nicht gesendet werden: ' + String(e && e.message || e));
  } finally { clearTimeout(timer); }
}
// For the owner: a connection error also names the usual cause on the server side (the page's address not allowed).
function ownerErrorText(e) {
  if (e.code !== 'network') return e.message;
  const origin = location.protocol === 'file:' ? 'null' : location.origin;
  return e.message + ` Nếu địa chỉ đúng, hãy kiểm tra ALLOWED_ORIGINS trong wrangler.toml có „${origin}“ rồi chạy lại npx wrangler deploy.`;
}
// Anonymous counts. Optional by nature: a count that cannot be sent is simply not counted (no retry, no message).
function track(type, ms) {
  if (!Api.base || !settings.stats) return;
  apiFetch('/api/event', { method: 'POST', body: ms == null ? { type } : { type, ms: Math.round(ms) }, keepalive: true, timeout: 8000 }).catch(() => {});
}
let openTracked = false;
function maybeTrackOpen() {
  if (openTracked || !Api.base || !settings.stats || !(Spell.ready || Spell.failed)) return;
  openTracked = true;
  track('open', Spell.loadMs);
}
function updateApiBase() {
  const next = Api.local || Api.fromSite || '';
  if (next === Api.base) { renderServerUi(); return; }
  Api.base = next;
  if (Admin.on) { Admin.on = false; Admin.stats = null; applySite(); }   // signed in to another server: sign in again
  renderServerUi();
  if (next) {
    loadCommunity(false); loadSharedWords(false); maybeTrackOpen();
    if (ADMIN_PAGE && Admin.token && !Admin.refused) adminLoad();   // a remembered admin code: the dashboard and the switch
  }
}
function renderServerUi() {
  renderContribBtn();
  E.btnWordsSuggest.hidden = !Api.base || !settings.words.length;
  pill(E.apiStatus, Admin.on ? 'ok' : Api.base ? 'info' : '', Admin.on ? 'Đang quản trị' : Api.base ? 'Đã có máy chủ' : 'Chưa kết nối');
  E.adminBody.hidden = !Admin.on;
  E.btnAdminLogout.hidden = !Admin.on;
}

/* ---- model answers contributed by learners ---- */
// the lists of approved samples and words: shown from this browser's copy at once, asked again from the server after
// 15 minutes (an approval reaches returning visitors soon, without a request on every page open)
const LIST_FRESH_MS = 15 * 60e3;
let COMMUNITY = [];
const allSamples = () => SAMPLES.concat(COMMUNITY);
function cleanSample(x) {
  if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id) return null;
  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
  const title = str(x.title, 120).trim(), task = str(x.task, 3000), model = str(x.model, 8000);
  return title && task.trim() && model.trim() ? { id: 'c:' + x.id.replace(/^c:/, '').slice(0, 40), title, task, model, author: str(x.author, 60).trim() } : null;
}
function setCommunity(list) {
  COMMUNITY = list;
  let grp = E.sampleSel.querySelector('optgroup[data-community]');
  if (!list.length) { if (grp) grp.remove(); return; }
  if (!grp) { grp = document.createElement('optgroup'); grp.label = 'Von Lernenden beigetragen'; grp.dataset.community = '1'; E.sampleSel.appendChild(grp); }
  grp.textContent = '';
  for (const s of list) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title + (s.author ? ' — ' + s.author : ''); grp.appendChild(o); }
}
async function loadCommunity(force) {
  const cached = store.get('community', null);
  const fresh = cached && cached.base === Api.base && Array.isArray(cached.list);
  if (fresh) setCommunity(cached.list.map(cleanSample).filter(Boolean));
  if (!Api.base || (!force && fresh && Date.now() - (+cached.at || 0) < LIST_FRESH_MS)) return;
  try {
    const j = await apiFetch('/api/samples');
    if (!Array.isArray(j.samples)) throw new ApiError('bad_reply', 'samples');   // never cache a broken reply as "no samples"
    const list = j.samples.map(cleanSample).filter(Boolean).slice(0, 200);
    store.set('community', { at: Date.now(), base: Api.base, list });
    setCommunity(list);
  } catch (e) { /* offline or server down: the built-in samples and the last list keep working */ }
}
// The contribution is the task and the model answer in the "Đề bài" and "Bài mẫu" boxes (plan: a task, a model answer of 50+ words
// and 10+ sentences, spelling score 90+). The page checks the model answer with the same engine as the grading; the server
// checks the counts again, and the owner reviews every contribution before it is shown to anyone.
function renderContribBtn() {
  const show = !!Api.base && !IN_ARTIFACT && !ADMIN_PAGE;
  E.btnContribute.hidden = !show;
  E.btnContribute.disabled = contributing || (settings.exam && active() && !traceOn());   // the model is covered in an exam
  E.stepContrib.hidden = !show;
}
let contributing = false;
const sameText = s => String(s).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();   // as the server compares submissions
// The learner's own words („Từ của tôi“) are not proof of correct spelling for everyone: for the contribution check they are
// taken out of the engine (synchronously, so nothing else runs meanwhile) and put back right after. Approved shared words stay.
function withoutPersonalWords(fn) {
  const out = [];
  if (Spell.ready && Spell.added.size) {
    const shared = new Set(Spell.shared);
    for (const w of Spell.added) if (!shared.has(w)) { try { Spell.h.removeWord(w); out.push(w); } catch (e) { /* not in the engine */ } }
  }
  try { return { value: fn(), personal: out.length }; }
  finally {
    for (const w of out) { try { Spell.h.addWord(w); } catch (e) { Spell.added.delete(w); } }
    if (out.length) suggestCache.clear();
  }
}
function contribErrorText(e) {
  if (e.code === 'duplicate') return 'Dieser Musterbrief wurde bereits gesendet.';
  if (e.code === 'rate_limited') return 'Aus diesem Netz wurden in den letzten 24 Stunden schon viele Beiträge gesendet (zum Beispiel wenn viele dasselbe WLAN nutzen), daher nimmt der Server vorerst keine weiteren an. Versuchen Sie es morgen noch einmal.';
  if (/^invalid_(task|model)$/.test(e.code) || e.code === 'too_short' || e.code === 'score_low') return `Der Server hat den Beitrag nicht angenommen: ${e.message} Korrigieren Sie das Feld Aufgabe oder Musterbrief und klicken Sie dann erneut auf „Beitragen“.`;
  return e.message;
}
async function contributeModel(prev) {
  if (!Api.base || contributing) return;
  const task = E.task.value.normalize('NFC').trim(), model = E.model.value.normalize('NFC').trim();
  if (!model) { toast('Das Feld Musterbrief ist leer. Fügen Sie zuerst einen Musterbrief ein oder öffnen Sie einen.'); E.model.focus(); return; }
  const key = sameText(model);
  if (allSamples().some(x => x.model && sameText(x.model) === key)) { toast('Dieser Musterbrief ist bereits in der Liste „Beispielaufgaben…“.'); return; }
  contributing = true;
  setLabel(E.btnContribute, 'Wird geprüft…'); renderContribBtn();
  let res, personal = 0, sentences = 0;
  try {
    if (!Spell.ready && !Spell.failed && !Spell.slow) await Promise.race([ensureSpell(), sleep(15000)]);
    // the standard deduction and the strict check (ALL-CAPS words too), whatever this learner set for their own grading
    ({ value: res, personal } = withoutPersonalWords(() => runAnalysis(model, task, '', DEFAULTS.k, true)));
    sentences = A.closedSentenceCount(model);
  } finally { contributing = false; setLabel(E.btnContribute, 'Beitragen'); renderContribBtn(); }
  const n = x => nfInt.format(x);
  const own = [settings.k !== DEFAULTS.k && `mit dem Standardabzug von ${DEFAULTS.k} Punkten pro Fehler / 100 Wörter`, personal && 'Wörter in „Meine Wörter“ werden nicht berücksichtigt'].filter(Boolean);
  const checks = [
    [task.length >= RULES.TASK_MIN && task.length <= RULES.TASK_MAX, `Eine Aufgabe mit ${n(RULES.TASK_MIN)} bis ${n(RULES.TASK_MAX)} Zeichen`,
      task ? `derzeit ${n(task.length)} Zeichen` : 'das Feld Aufgabe ist leer'],
    [res.words > RULES.WORDS_OVER, `Ein Musterbrief mit mehr als ${RULES.WORDS_OVER} Wörtern`, `derzeit ${n(res.words)} Wörter`],
    [sentences > RULES.SENTENCES_OVER, `Ein Musterbrief mit mehr als ${RULES.SENTENCES_OVER} Sätzen`, `derzeit ${n(sentences)} Sätze, die mit . ! ? enden`],
    [res.spellReady && res.score >= RULES.MIN_SCORE, `Rechtschreibpunkte des Musterbriefs: ${RULES.MIN_SCORE} oder mehr`,
      res.spellReady ? [`derzeit ${res.score} Punkte, ${res.errors} Fehler`].concat(own).join('; ')
        : Spell.broken || Spell.failed ? 'noch nicht bewertet, weil die Rechtschreibprüfung nicht bereit ist; laden Sie die Seite neu und versuchen Sie es noch einmal'
        : 'noch nicht bewertet, weil das Wörterbuch noch geladen wird; warten Sie, bis es geladen ist, und klicken Sie dann erneut auf „Beitragen“']
  ];
  if (model.length > RULES.MODEL_MAX) checks.push([false, `Ein Musterbrief mit höchstens ${n(RULES.MODEL_MAX)} Zeichen`, `derzeit ${n(model.length)} Zeichen`]);
  const ok = checks.every(c => c[0]);
  const list = `<ul class="checklist">${checks.map(([pass, label, detail]) =>
    `<li class="${pass ? 'ok' : 'bad'}"><span class="mark" aria-hidden="true">${pass ? '✓' : '✗'}</span><span>${esc(label)} <span class="muted">(${esc(detail)})</span><span class="sr-only">${pass ? ': erfüllt' : ': nicht erfüllt'}</span></span></li>`).join('')}</ul>`;
  if (!ok) {
    const wrong = res.spellReady ? res.uniq.slice(0, 8).map(u => u.w) : [];
    await openModal({ title: 'Beitrag noch nicht möglich', html: `<p class="small">Aufgabe und Musterbrief müssen alle folgenden Bedingungen erfüllen:</p>${list}` +
      (wrong.length ? `<p class="small">Im Musterbrief als falsch markierte Wörter: <span lang="de">${esc(wrong.join(', '))}</span>${res.uniq.length > wrong.length ? '…' : ''}. Für Details und Korrekturvorschläge fügen Sie den Musterbrief in das Feld „Ihr Text“ ein und klicken auf Bewerten${own.length ? ' (beim Bewerten Ihres Textes verwendet die Seite Ihre eigenen Einstellungen, daher kann die Zahl der Fehler abweichen)' : ''}.</p>` : ''),
      buttons: [{ label: 'Schließen', value: false, primary: true }] });
    return;
  }
  const v = await openModal({ title: 'Aufgabe und Musterbrief beitragen',
    html: `<p class="small">Der Inhalt der Felder Aufgabe und Musterbrief wird dem Seitenbetreiber zur Prüfung gesendet. Nach der Freigabe können alle ihn unter „Beispielaufgaben…“ zum Üben auswählen.</p>${list}\n      ${prev && prev.problem ? `<p class="field-err" role="alert">${esc(prev.problem)}</p>` : ''}\n      <label class="lbl" for="cTitle">Titel</label><input id="cTitle" class="field" maxlength="120" value="${esc(prev ? prev.title : firstLine(task).slice(0, 120))}">\n      <label class="lbl" for="cAuthor">Name der beitragenden Person (freiwillig)</label><input id="cAuthor" class="field" maxlength="60" autocomplete="nickname" value="${esc(prev ? prev.author : '')}">\n      <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="cAgree"${prev && prev.agree ? ' checked' : ''}> Ich bin einverstanden, dass diese Aufgabe und dieser Musterbrief auf der Seite öffentlich erscheinen.</label>`,
    buttons: [{ label: 'Abbrechen', value: false }, { label: 'Beitrag senden', value: true, primary: true }] });
  if (!v) return;
  const cur = { title: $('#cTitle', E.modal).value.trim(), author: $('#cAuthor', E.modal).value.trim(), agree: $('#cAgree', E.modal).checked };
  if (cur.title.length < 3) return contributeModel(Object.assign(cur, { problem: 'Der Titel braucht mindestens 3 Zeichen.' }));
  if (!cur.agree) return contributeModel(Object.assign(cur, { problem: 'Zum Senden ist die Zustimmung zur Veröffentlichung nötig.' }));
  if (contributing) return;
  contributing = true;                                    // no second dialog while this one is on its way
  setLabel(E.btnContribute, 'Wird gesendet…'); renderContribBtn();
  let again = null;
  try {
    await apiFetch('/api/samples', { method: 'POST', body: { title: cur.title, task, model, score: res.score, author: cur.author } });
    toast('Aufgabe und Musterbrief wurden gesendet. Sie erscheinen unter „Beispielaufgaben…“, sobald der Seitenbetreiber sie geprüft hat. Vielen Dank!');
  } catch (e) {
    // a field of the form (title, name): the form again with the reason; the boxes' content: a message saying what to fix
    if (e.code === 'invalid_title' || e.code === 'invalid_author') again = Object.assign(cur, { problem: e.message });
    else toast(contribErrorText(e));
  } finally { contributing = false; setLabel(E.btnContribute, 'Beitragen'); renderContribBtn(); }
  if (again) return contributeModel(again);
}
E.btnContribute.addEventListener('click', () => contributeModel());

/* ---- the shared dictionary: approved words for everyone, suggestions from learners ---- */
function applySharedWords() {
  if (!Spell.ready) return;
  let changed = false;
  for (const w of Spell.shared) {
    if (Spell.sharedAdded.has(w)) continue;
    Spell.sharedAdded.add(w);
    let known = false;
    try { known = Spell.h.spell(w); } catch (e) { known = false; }
    if (!known) { try { Spell.h.addWord(w); changed = true; } catch (e) { /* the engine refused this one word */ } }
  }
  if (changed) suggestCache.clear();
}
async function loadSharedWords(force) {
  const cached = store.get('sharedWords', null);
  const fresh = cached && cached.base === Api.base && Array.isArray(cached.words);
  if (fresh) { Spell.shared = cached.words.filter(w => typeof w === 'string' && WORD_OK.test(w)).slice(0, 5000); applySharedWords(); }
  if (!Api.base || (!force && fresh && Date.now() - (+cached.at || 0) < LIST_FRESH_MS)) return;
  try {
    const j = await apiFetch('/api/words');
    if (!Array.isArray(j.words)) throw new ApiError('bad_reply', 'words');       // never cache a broken reply as "no words"
    const words = j.words.filter(w => typeof w === 'string').map(w => w.normalize('NFC')).filter(w => WORD_OK.test(w)).slice(0, 5000);
    store.set('sharedWords', { at: Date.now(), base: Api.base, words });
    Spell.shared = words; applySharedWords();
  } catch (e) { /* the built-in dictionary keeps working */ }
}
async function suggestWords(list) {
  try {
    const j = await apiFetch('/api/words', { method: 'POST', body: { words: list.slice(0, 20) } });
    toast(`${j.received} Wörter gesendet. Der Server schlägt sie in Wiktionary und DWDS nach; freigegebene Wörter kommen in das gemeinsame Wörterbuch der Seite.`);
  } catch (e) { toast(e.message); }
}
document.addEventListener('click', e => {
  const sg = e.target.closest('[data-suggest]');
  if (sg) { closePop(); suggestWords([sg.dataset.suggest]); return; }
  if (e.target.closest('[data-report]')) reportBug();
});
E.btnWordsSuggest.addEventListener('click', async () => {
  const list = settings.words.slice(0, 20);
  if (!list.length) return;
  if (await confirmBox('Für das gemeinsame Wörterbuch vorschlagen?', `${list.length} Wörter aus „Meine Wörter“ (${list.slice(0, 6).join(', ')}${list.length > 6 ? '…' : ''}) dem Seitenbetreiber zur Prüfung senden.`, 'Vorschlag senden')) suggestWords(list);
});
E.optStats.addEventListener('change', () => { settings.stats = E.optStats.checked; saveSettings(); });

/* ---- bug reports: to the server, or by e-mail ---- */
function collectDiag(withText) {
  const d = { app: APP_VERSION, lang: navigator.language, screen: `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`, site: Site.mode, writing: settings.mode,
    spell: Spell.ready ? 'ready' : Spell.failed ? 'failed' : Spell.slow ? 'slow' : 'loading', engineErrors: Spell.engineErrors,
    storage: store.blocked ? 'blocked' : store.pending ? 'full' : 'ok', lastError: lastCrash || null };
  if (withText) d.text = { task: E.task.value.slice(0, 3000), answer: (traceOn() ? E.traceInput.value : E.answer.value).slice(0, 6000) };
  return d;
}
// problem = why the form is shown again (a message from the page or the server); nothing typed is lost
async function reportBug(prev, problem) {
  prev = prev || { kind: 'grading', msg: '', contact: '', diag: true, text: false };
  const kinds = [['grading', 'Falsche Bewertung (Fehler zu Unrecht angezeigt oder übersehen)'], ['display', 'Anzeige oder Bedienung'], ['file', 'Dateien öffnen / speichern'], ['other', 'Sonstiges']];
  const v = await openModal({ title: 'Fehler melden',
    html: `${problem ? `<p class="field-err" role="alert">${esc(problem)}</p>` : ''}\n      <label class="lbl" for="rKind">Art des Problems</label>\n      <select id="rKind" class="field">${kinds.map(([k, l]) => `<option value="${k}"${k === prev.kind ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>\n      <label class="lbl" for="rMsg">Beschreibung (was Sie getan haben, was die Seite angezeigt hat)</label><textarea id="rMsg" class="field" rows="4" maxlength="4000">${esc(prev.msg)}</textarea>\n      <label class="lbl" for="rContact">E-Mail für eine Antwort (freiwillig)</label><input id="rContact" class="field" type="email" maxlength="200" value="${esc(prev.contact)}">\n      <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="rDiag"${prev.diag ? ' checked' : ''}> Technische Angaben mitsenden (Browser, Bildschirm, Version, letzter Fehler)</label>\n      <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="rText"${prev.text ? ' checked' : ''}> Aufgabe und Ihren Text mitsenden (hilft, einen Bewertungsfehler nachzuvollziehen)</label>\n      <p class="muted small">Oder direkt per E-Mail senden: <a href="mailto:${CONTACT}">${CONTACT}</a></p>`,
    buttons: [{ label: 'Abbrechen', value: false }, { label: Api.base ? 'Meldung senden' : 'Meldung per E-Mail verfassen', value: true, primary: true }] });
  if (!v) return;
  const cur = { kind: $('#rKind', E.modal).value, msg: $('#rMsg', E.modal).value.trim(), contact: $('#rContact', E.modal).value.trim(),
    diag: $('#rDiag', E.modal).checked, text: $('#rText', E.modal).checked };
  if (cur.msg.length < 10) return reportBug(cur, 'Bitte beschreiben Sie das Problem (mindestens 10 Zeichen).');
  if (cur.contact && (cur.contact.length < 3 || cur.contact.length > 200)) return reportBug(cur, 'Die Kontakt-E-Mail braucht 3 bis 200 Zeichen, oder lassen Sie das Feld leer.');
  const diag = cur.diag || cur.text ? collectDiag(cur.text) : null;
  let why = 'Die Seite hat keinen Server, der Fehlermeldungen annimmt.';
  if (Api.base) {
    try {
      await apiFetch('/api/reports', { method: 'POST', body: { kind: cur.kind, message: cur.msg, contact: cur.contact, page: location.href.slice(0, 300),
        ua: cur.diag ? navigator.userAgent.slice(0, 400) : '', app: APP_VERSION, diag } });
      toast('Fehlermeldung gesendet. Vielen Dank!');
      return;
    } catch (e) {
      if (/^invalid_/.test(e.code)) return reportBug(cur, e.message);   // the server names the field to fix
      // too many reports from one address (a class on one network), the server down...: the e-mail route still works
      why = e.code === 'rate_limited' ? 'Der Server erhält gerade zu viele Fehlermeldungen aus demselben Netz (zum Beispiel wenn eine ganze Klasse dasselbe Netz nutzt).'
        : 'Senden über den Server nicht möglich: ' + e.message.charAt(0).toLowerCase() + e.message.slice(1);
    }
  }
  mailReport(cur, diag, why);
}
// The e-mail route: the full text to copy (always works), and a link that opens the mail app with it (when there is one).
function mailReport(cur, diag, why) {
  let tech = diag ? JSON.stringify(diag) : '';
  if (tech.length > 6000) tech = tech.slice(0, 6000) + ' …(gekürzt)';
  const body = `Art des Problems: ${KIND_LABEL[cur.kind] || cur.kind}\n\n${cur.msg}\n\n` + (cur.contact ? `Kontakt: ${cur.contact}\n` : '') + (tech ? `\nTechnische Angaben: ${tech}\n` : '');
  // long mailto links are cut by some mail apps: the link carries the description first, the copied text is complete
  const short = body.length > 1800 ? body.slice(0, 1800) + '\n…(gekürzt: Fügen Sie den vollständigen Text ein, den Sie von der Seite kopiert haben)' : body;
  const href = `mailto:${CONTACT}?subject=${encodeURIComponent('Fehlermeldung B1 Schreibtrainer ' + APP_VERSION)}&body=${encodeURIComponent(short)}`;
  openModal({ title: 'Fehlermeldung per E-Mail senden',
    html: `<p class="small">${esc(why)} Sie können die Fehlermeldung per E-Mail senden an <b>${CONTACT}</b>: Öffnen Sie Ihr E-Mail-Programm oder kopieren Sie den Text unten und fügen Sie ihn in eine E-Mail ein.</p>\n      <textarea id="mailBody" class="field" rows="7" readonly>${esc(body)}</textarea>\n      <div class="row"><a class="btn btn-primary" id="mailOpen" href="${esc(href)}" target="_blank" rel="noopener">E-Mail-Programm öffnen</a>\n        <button type="button" class="btn" id="mailCopy">Text kopieren</button></div>`,
    buttons: [{ label: 'Schließen', value: false }] });
  $('#mailCopy', E.modal).addEventListener('click', async () => {
    toast((await copyText(body, $('#mailBody', E.modal))) ? 'Text der Fehlermeldung kopiert.' : 'Automatisches Kopieren nicht möglich: Der Text ist markiert, drücken Sie Strg+C.');
  });
}
async function copyText(text, field) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    if (!field) return false;
    field.focus(); field.select();
    try { return document.execCommand('copy'); } catch (e2) { return false; }
  }
}

/* ---- the owner's dashboard ---- */
// refused: the server said the token is wrong - it is not tried again on its own (each failure counts against the limit)
const Admin = { token: '', on: false, tab: 'stats', stats: null, refused: false, loading: null };
const IN_ARTIFACT = !!(window.claude && typeof window.claude.use === 'function');   // claude.ai: no outside requests
function adminNote(text, bad) { E.adminNote.textContent = text; E.adminNote.style.color = bad ? 'var(--red)' : ''; }
function initServer() {
  E.adminPanel.hidden = !ADMIN_PAGE || IN_ARTIFACT;        // the server's admin console lives on quan-tri.html only
  if (IN_ARTIFACT) { renderServerUi(); return; }
  const local = cleanApiUrl(store.get('api', ''));
  Api.local = local || '';
  const t = ADMIN_PAGE ? store.get('adminToken', '') : '';  // the learner page never holds the admin code
  if (typeof t === 'string' && t) { Admin.token = t; E.adminToken.value = t; E.adminRemember.checked = true; }
  E.apiUrl.value = Api.local || Api.fromSite;
  updateApiBase();
  if (!Api.base) { loadCommunity(false); loadSharedWords(false); }   // cached lists from an earlier visit
}
E.btnAdminConnect.addEventListener('click', async () => {
  const url = cleanApiUrl(E.apiUrl.value);
  if (url === null) { adminNote('Địa chỉ máy chủ không hợp lệ: cần dạng https://… (ví dụ https://b1-schreibtrainer-api.ten.workers.dev).', true); return; }
  const token = E.adminToken.value.trim();
  if (token && tokenProblem(token)) { adminNote(tokenProblem(token), true); E.adminToken.focus(); return; }
  if (url && url !== Api.fromSite) { Api.local = url; store.set('api', url); } else { Api.local = ''; store.del('api'); }
  Admin.token = token; Admin.refused = false;
  if (token && E.adminRemember.checked) store.set('adminToken', token); else store.del('adminToken');
  if (!token && Admin.on) { Admin.on = false; Admin.stats = null; applySite(); }
  const before = Api.base;
  updateApiBase();                                        // a different server: its lists are loaded and, with a token, signed in
  if (!Api.base) { adminNote('Hãy nhập địa chỉ máy chủ.', true); return; }
  if (!token) {
    adminNote('Đang kiểm tra máy chủ…');
    try {
      const j = await apiFetch('/api/health');
      if (j.ok !== true) throw new ApiError('bad_reply', 'Địa chỉ này trả lời nhưng không phải máy chủ B1 Schreibtrainer.');
      adminNote('Đã kết nối máy chủ. Nhập mã quản trị để xem thống kê và duyệt đóng góp.');
    } catch (e) { adminNote(ownerErrorText(e), true); }
    return;
  }
  if (Api.base === before) await adminLoad(); else if (Admin.loading) await Admin.loading.p;
});
E.adminToken.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); E.btnAdminConnect.click(); } });
E.btnAdminLogout.addEventListener('click', () => {
  Object.assign(Admin, { token: '', on: false, stats: null, refused: false });
  store.del('adminToken'); E.adminToken.value = ''; E.adminRemember.checked = false;
  adminNote('Đã thoát quản trị trên máy này.');
  renderServerUi(); applySite();                          // the switch goes back to producing the site.json content
});
// One sign-in per (code, server) at a time; a result for a code or a server that has changed meanwhile is dropped.
function adminLoad() {
  const token = Admin.token, base = Api.base;
  if (Admin.loading && Admin.loading.token === token && Admin.loading.base === base) return Admin.loading.p;
  const p = (async () => {
    adminNote('Đang tải…');
    let stats = null, err = null;
    try {
      stats = await apiFetch('/api/admin/stats?days=30', { token });
      if (typeof stats.from !== 'string' || !Array.isArray(stats.daily)) throw new ApiError('bad_reply', 'Máy chủ trả về số liệu không đúng định dạng.');
    } catch (e) { err = e; }
    if (token !== Admin.token || base !== Api.base) return;
    if (err) {
      Admin.on = false; Admin.stats = null;
      if (err.code === 'unauthorized') Admin.refused = true;
      adminNote(err.code === 'unauthorized' ? 'Mã quản trị không đúng.' : ownerErrorText(err), true);
    } else { Admin.stats = stats; Admin.on = true; Admin.refused = false; adminNote(''); }
    renderServerUi(); applySite();                        // signed in or out: the switch and the banner's button change their action
    if (Admin.on) { renderAdminCounts(); selectAdmTab(Admin.tab); }
  })().finally(() => { if (Admin.loading && Admin.loading.p === p) Admin.loading = null; });
  Admin.loading = { token, base, p };
  return p;
}
// The server refused the code during work (changed on the server, or the network got locked): back to signed out.
function adminRefused(msg) {
  Object.assign(Admin, { on: false, stats: null, refused: true });
  renderServerUi(); applySite();
  adminNote(msg || 'Mã quản trị không còn đúng. Hãy nhập lại mã và bấm „Kết nối“.', true);
}
function renderAdminCounts() {
  const p = (Admin.stats && Admin.stats.pending) || {};
  E.admCntSamples.textContent = p.samples ? `(${p.samples})` : '';
  E.admCntWords.textContent = p.words ? `(${p.words})` : '';
  E.admCntReports.textContent = p.reports ? `(${p.reports})` : '';
}
const ADM_TABS = ['stats', 'samples', 'words', 'reports'];
function selectAdmTab(name) {
  Admin.tab = name;
  for (const t of ADM_TABS) {
    const on = t === name, tab = $('#adm-tab-' + t);
    tab.setAttribute('aria-selected', String(on)); tab.tabIndex = on ? 0 : -1;
    E['adm' + capFirst(t)].hidden = !on;
  }
  if (name === 'stats') renderStats(); else loadQueue(name);
}
$$('.adm-tab').forEach(t => {
  t.addEventListener('click', () => selectAdmTab(t.id.slice(8)));
  t.addEventListener('keydown', e => {
    const i = ADM_TABS.indexOf(t.id.slice(8));
    const n = e.key === 'ArrowRight' ? (i + 1) % 4 : e.key === 'ArrowLeft' ? (i + 3) % 4 : -1;
    if (n < 0) return;
    e.preventDefault(); selectAdmTab(ADM_TABS[n]); $('#adm-tab-' + ADM_TABS[n]).focus();
  });
});
const nfInt = new Intl.NumberFormat(LOCALE);
function statRows(st) {                                   // one row per day, oldest first, zero days included
  const by = {};
  const day = d => (by[d] = by[d] || { day: d, open: 0, grade: 0, trace: 0, error: 0, report: 0, loadMs: 0, loadN: 0, gradeMs: 0, gradeN: 0 });
  for (const r of st.daily || []) {
    const o = day(r.day);
    if (r.type in o) o[r.type] = +r.n || 0;
    if (r.type === 'open') { o.loadMs = +r.sum_ms || 0; o.loadN = +r.cnt_ms || 0; }
    if (r.type === 'grade') { o.gradeMs = +r.sum_ms || 0; o.gradeN = +r.cnt_ms || 0; }
  }
  for (const r of st.reports || []) day(r.day).report = +r.n || 0;
  const out = [], start = Date.parse(st.from + 'T00:00:00Z');
  for (let i = 0; i < (st.days || 30); i++) out.push(day(new Date(start + i * 86400000).toISOString().slice(0, 10)));
  return out;
}
const ddmm = d => d.slice(8, 10) + '.' + d.slice(5, 7);
function niceMax(v) { const p = 10 ** Math.floor(Math.log10(Math.max(1, v))); for (const m of [1, 2, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
// one series (page opens per day): bars <= 24 px, 4 px rounded top, square at the baseline, 2 px gaps; hover/focus tooltip.
// Drawn at the box's real width (1 unit = 1 px), so the axis text keeps its size on a phone instead of shrinking with the SVG.
function barChartSvg(rows, width) {
  const W = Math.max(260, Math.min(1400, Math.round(width) || 640)), H = 190, L = 36, R = 8, T = 10, B = 24, plotH = H - T - B, base = T + plotH;
  const top = niceMax(Math.max(1, ...rows.map(r => r.open)));
  const band = (W - L - R) / rows.length, bw = Math.min(24, Math.max(2, band - 2));
  let g = '';
  for (const v of [0, top / 2, top]) {
    const y = base - plotH * v / top;
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="axis" x="${L - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end">${nfInt.format(v)}</text>`;
  }
  rows.forEach((r, i) => {
    const x = L + i * band + (band - bw) / 2, h = plotH * r.open / top, y = base - h, rad = Math.min(4, bw / 2, h);
    g += `<rect class="hit" data-i="${i}" tabindex="0" x="${(L + i * band).toFixed(1)}" y="${T}" width="${band.toFixed(1)}" height="${plotH}" aria-label="${ddmm(r.day)}: ${r.open} lượt mở trang"/>`;
    g += h > 0 ? `<path class="bar" d="M${x.toFixed(1)},${base} V${(y + rad).toFixed(1)} Q${x.toFixed(1)},${y.toFixed(1)} ${(x + rad).toFixed(1)},${y.toFixed(1)} H${(x + bw - rad).toFixed(1)} Q${(x + bw).toFixed(1)},${y.toFixed(1)} ${(x + bw).toFixed(1)},${(y + rad).toFixed(1)} V${base} Z"/>` : '<path class="bar" d=""/>';
  });
  for (const i of [0, Math.floor((rows.length - 1) / 2), rows.length - 1]) {
    g += `<text class="axis" x="${(L + i * band + band / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${ddmm(rows[i].day)}</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Lượt mở trang mỗi ngày trong ${rows.length} ngày">${g}</svg>`;
}
function renderStats() {
  const st = Admin.stats;
  if (!st) { E.admStats.innerHTML = '<p class="empty">Chưa có dữ liệu.</p>'; return; }
  const rows = statRows(st), sum = k => rows.reduce((a, r) => a + r[k], 0);
  const avg = (s, n) => (n ? s / n : null);
  const load = avg(sum('loadMs'), sum('loadN')), gr = avg(sum('gradeMs'), sum('gradeN'));
  const p = st.pending || {};
  const tile = (v, k) => `<div class="tile"><div class="v">${v}</div><div class="k">${esc(k)}</div></div>`;
  chartW = E.admStats.clientWidth;
  E.admStats.innerHTML = `\n    <div class="tiles">\n      ${tile(nfInt.format(sum('open')), 'Lượt mở trang (30 ngày)')}${tile(nfInt.format(sum('grade')), 'Lượt chấm bài')}${tile(nfInt.format(sum('trace')), 'Lượt luyện in vết')}\n      ${tile(nfInt.format(sum('report')), 'Báo lỗi gửi về')}${tile(nfInt.format(sum('error')), 'Lỗi trang tự ghi nhận')}\n      ${tile(load == null ? '—' : nf1.format(load / 1000) + ' giây', 'Tải từ điển trung bình')}${tile(gr == null ? '—' : nfInt.format(Math.round(gr)) + ' ms', 'Chấm một bài trung bình')}\n      ${tile(`${p.samples || 0} · ${p.words || 0} · ${p.reports || 0}`, 'Chờ xử lý: bài mẫu · từ · báo lỗi')}\n    </div>\n    <div><h3>Lượt mở trang mỗi ngày</h3><div class="chart" id="admChart">${barChartSvg(rows, chartW)}<div class="chart-tip" hidden></div></div></div>\n    <details><summary class="small">Xem dạng bảng</summary><div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Datum</th><th>Mở trang</th><th>Chấm</th><th>Nachschreiben</th><th>Fehler melden</th><th>Lỗi trang</th><th>Tải từ điển TB</th><th>Chấm TB</th></tr></thead><tbody>\n      ${rows.slice().reverse().map(r => `<tr><td>${ddmm(r.day)}</td><td class="num">${r.open}</td><td class="num">${r.grade}</td><td class="num">${r.trace}</td><td class="num">${r.report}</td><td class="num">${r.error}</td>
        <td class="num">${r.loadN ? nf1.format(r.loadMs / r.loadN / 1000) + ' s' : '—'}</td><td class="num">${r.gradeN ? Math.round(r.gradeMs / r.gradeN) + ' ms' : '—'}</td></tr>`).join('')}\n    </tbody></table></div></details>\n    <div class="row"><button type="button" class="btn btn-sm" id="admRefresh">Tải lại số liệu</button></div>`;
  const chart = $('#admChart', E.admStats), tip = $('.chart-tip', chart);
  const show = el => {
    const r = rows[+el.dataset.i];
    tip.textContent = '';
    const b = document.createElement('b'); b.textContent = `${r.open} lượt mở trang`;
    const line = document.createElement('div'); line.textContent = `${ddmm(r.day)} · ${r.grade} lượt chấm · ${r.trace} in vết · ${r.report} báo lỗi`;
    tip.append(b, line); tip.hidden = false;
    const cr = chart.getBoundingClientRect(), er = el.getBoundingClientRect();
    tip.style.left = Math.max(0, Math.min(cr.width - tip.offsetWidth, er.left - cr.left + er.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = '-8px';
  };
  chart.addEventListener('pointerover', e => { const h = e.target.closest('.hit'); if (h) show(h); });
  chart.addEventListener('focusin', e => { const h = e.target.closest('.hit'); if (h) show(h); });
  chart.addEventListener('pointerleave', () => { tip.hidden = true; });
  chart.addEventListener('focusout', () => { tip.hidden = true; });
  $('#admRefresh', E.admStats).addEventListener('click', adminLoad);
}
// the window was resized (a phone turned, a sidebar opened): only the chart is drawn again, at the new width
let chartW = 0, chartTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(chartTimer);
  chartTimer = setTimeout(() => {
    const chart = Admin.stats && !E.admStats.hidden && $('#admChart', E.admStats), svg = chart && $('svg', chart);
    const w = E.admStats.clientWidth;
    if (!svg || !w || Math.abs(w - chartW) < 16) return;
    chartW = w;
    svg.outerHTML = barChartSvg(statRows(Admin.stats), w);   // same rows: the tooltip keeps working (it reads data-i)
  }, 150);
});
const KIND_LABEL = { grading: 'Chấm sai', display: 'Hiển thị / thao tác', file: 'Tệp', other: 'Sonstiges', crash: 'Lỗi trang' };
// null = that source could not be checked (no answer, an error reply): shown as such, never as "not found"
function verdictPill(c) {
  if (!c) return '<span class="pill warn">Chưa tra</span>';
  const parts = [];
  if (c.german) parts.push('<span class="pill ok">Có trong Wiktionary (tiếng Đức)</span>');
  else if (c.wiktionary === true) parts.push('<span class="pill warn">Có trang Wiktionary, không có mục tiếng Đức</span>');
  else if (c.wiktionary === false) parts.push('<span class="pill bad">Không có trong Wiktionary</span>');
  else parts.push('<span class="pill warn">Wiktionary: chưa tra được</span>');
  if (c.dwds != null) parts.push(`<span class="pill ${c.dwds >= 2 ? 'ok' : 'warn'}">DWDS: tần suất ${+c.dwds}/6${c.hits != null ? ', ' + nfInt.format(+c.hits) + ' lần' : ''}</span>`);
  else parts.push('<span class="pill warn">DWDS: chưa tra được</span>');
  return parts.join(' ');
}
const RECHECK_TEXT = { wiktionary: 'Đã tra lại: có trong Wiktionary (tiếng Đức).', dwds: 'Đã tra lại: có trong DWDS.',
  'not-found': 'Đã tra lại: không có trong Wiktionary, DWDS không ghi nhận.', unchecked: 'Chưa tra được: Wiktionary hoặc DWDS không trả lời. Hãy thử lại sau.' };
async function loadQueue(kind) {
  const box = E['adm' + capFirst(kind)];
  box.innerHTML = '<p class="muted small">Đang tải…</p>';
  try {
    const j = await apiFetch(`/api/admin/${kind}`, { token: Admin.token });
    const items = j[kind] || [];
    if (!items.length) { box.innerHTML = '<p class="empty">Không có mục nào đang chờ.</p>'; return; }
    if (kind === 'samples') box.innerHTML = `<ul class="queue">${items.map(x => `<li data-key="${esc(x.id)}">\n        <div><b lang="de">${esc(x.title)}</b> <span class="meta">${esc(dateStr(x.created_at))}${x.author ? ' · ' + esc(x.author) : ''} · ${+x.words} từ · ${+x.sentences} câu · ${+x.score} điểm</span></div>\n        <details><summary class="small">Xem đề và bài mẫu</summary><div class="lbl" style="margin:6px 0 4px">Aufgabe</div><pre lang="de">${esc(x.task)}</pre><div class="lbl" style="margin:6px 0 4px">Musterbrief</div><pre lang="de">${esc(x.model)}</pre></details>\n        <div class="row"><button type="button" class="btn btn-sm btn-primary" data-act="approve">Duyệt</button><button type="button" class="btn btn-sm" data-act="reject">Từ chối</button><button type="button" class="btn btn-sm btn-danger" data-act="delete">Xóa</button></div></li>`).join('')}</ul>`;
    if (kind === 'words') box.innerHTML = `<ul class="queue">${items.map(x => { let c = null; try { c = x.check_json ? JSON.parse(x.check_json) : null; } catch (e) { c = null; }
      return `<li data-key="${esc(x.word)}"><div><b lang="de" style="font:600 18px var(--f-sheet)">${esc(x.word)}</b> <span class="meta">${+x.count} lần đề xuất · ${esc(dateStr(x.created_at))}</span></div>
        <div class="row">${verdictPill(c)}</div>
        <div class="row"><button type="button" class="btn btn-sm btn-primary" data-act="approve">Duyệt</button><button type="button" class="btn btn-sm" data-act="reject">Từ chối</button><button type="button" class="btn btn-sm" data-act="recheck">Tra lại</button></div></li>`; }).join('')}</ul>`;
    if (kind === 'reports') box.innerHTML = `<ul class="queue">${items.map(x => `<li data-key="${esc(x.id)}">
        <div><b>${esc(KIND_LABEL[x.kind] || x.kind)}</b> <span class="meta">${esc(dateStr(x.created_at))}${x.app ? ' · bản ' + esc(x.app) : ''}${x.contact ? ' · liên hệ: ' + esc(x.contact) : ''}</span></div>
        <pre>${esc(x.message)}</pre>
        ${x.diag ? `<details><summary class="small">Thông tin kỹ thuật</summary><pre>${esc((() => { try { return JSON.stringify(JSON.parse(x.diag), null, 2); } catch (e) { return x.diag; } })())}</pre></details>` : ''}
        ${x.ua ? `<div class="meta">${esc(x.ua)}</div>` : ''}
        <div class="row"><button type="button" class="btn btn-sm btn-primary" data-act="done">Đã xử lý</button><button type="button" class="btn btn-sm btn-danger" data-act="delete">Xóa</button></div></li>`).join('')}</ul>`;
  } catch (e) {
    box.innerHTML = '';
    const p = document.createElement('p'); p.className = 'small'; p.style.color = 'var(--red)';
    p.textContent = e.code === 'unauthorized' ? 'Mã quản trị không còn đúng. Hãy kết nối lại.' : ownerErrorText(e);
    box.appendChild(p);
    if (e.code === 'unauthorized') adminRefused();
  }
}
[['samples', E.admSamples], ['words', E.admWords], ['reports', E.admReports]].forEach(([kind, box]) => {
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const li = b.closest('li'), act = b.dataset.act;
    if (act === 'delete' && !(await confirmBox('Xóa hẳn mục này?', 'Không thể hoàn tác.', 'Xóa', true))) return;
    b.disabled = true;
    try {
      const j = await apiFetch(`/api/admin/${kind}/${encodeURIComponent(li.dataset.key)}`, { method: 'POST', token: Admin.token, body: { action: act } });
      toast(act === 'recheck' ? RECHECK_TEXT[j.check && j.check.verdict] || 'Đã tra lại.'
        : { approve: 'Đã duyệt.', reject: 'Đã từ chối.', delete: 'Đã xóa.', done: 'Đã đánh dấu đã xử lý.' }[act]);
      try { Admin.stats = await apiFetch('/api/admin/stats?days=30', { token: Admin.token }); renderAdminCounts(); } catch (e2) { /* the counts refresh next time */ }
      if (act === 'approve' && kind === 'samples') loadCommunity(true);
      if (act === 'approve' && kind === 'words') loadSharedWords(true);
      loadQueue(kind);
    } catch (err) {
      b.disabled = false;
      if (err.code === 'unauthorized') { adminRefused(); toast('Mã quản trị không còn đúng. Hãy đăng nhập lại.'); }
      else toast(ownerErrorText(err));
    }
  });
});

/* ===================== site: open / temporarily closed for maintenance ===================== */
// local     - the offline copy (file://): the state lives in this browser (localStorage), optional PIN.
// static    - served by a static host such as GitHub Pages: everyone reads site.json next to index.html (fresh copy,
//             re-checked every minute); the page cannot write it, so the config tab produces its content to commit.
// shared    - the claude.ai artifact: one shared document site/config; only owner/editors write it (db rules).
// connecting / unavailable - artifact whose shared data is not (yet) reachable: the app stays usable.
const DEFAULT_MSG = 'Die Seite wird gerade gewartet. Bitte kommen Sie später wieder.';
const SUBTLE = !!(window.crypto && crypto.subtle && typeof crypto.subtle.digest === 'function');
const Site = {
  mode: 'local', conf: null, local: { pinHash: '', salt: '' }, isAdmin: null,
  ref: null, unsub: null, retries: 0, loaded: false, saving: false, readOnly: false, lastError: '',
  preview: false, cfgUnlocked: false, pinFails: 0, pinLockUntil: 0, screen: false, formDirty: false,
  staticState: '', lastChecked: 0, fetching: false,    // static: '' (not read yet) | ok | missing | error
  source: '',                                          // static: where the state came from - api | file | none
  fileConf: null, serverConf: null, serverDown: false  // static with a server: both states, to tell the owner when they differ
};
function cleanConf(d) {
  d = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const ms = v => (typeof v === 'string' ? Date.parse(v) : v);     // site.json may carry readable ISO times
  const until = ms(d.until), updatedAt = ms(d.updatedAt);
  return {
    maintenance: d.maintenance === true,
    message: typeof d.message === 'string' ? d.message.slice(0, 400) : '',
    until: Number.isFinite(until) && until > 0 ? until : 0,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0
  };
}
// 2026-10-02T17:00:00+07:00 - readable, and exact in every time zone; precise adds the milliseconds (for "updatedAt",
// which is compared with the server's time: rounding it down could make a newer file look older than a server switch)
function isoLocal(ms, precise) {
  const d = new Date(ms), off = -d.getTimezoneOffset(), a = Math.abs(off);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` +
    (precise ? '.' + String(d.getMilliseconds()).padStart(3, '0') : '') + `${off >= 0 ? '+' : '-'}${pad2(Math.floor(a / 60))}:${pad2(a % 60)}`;
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
// The owner's view: quan-tri.html, or an editor of the claude.ai page. The learner page never offers the owner's tools.
const ownerView = () => ADMIN_PAGE || (Site.mode === 'shared' && Site.isAdmin === true);
function applySite() {
  const on = maintActive(), shared = Site.mode === 'shared', stat = Site.mode === 'static';
  // the owner works on while the page is closed (a banner instead of the closed screen); learners get the screen
  const adminView = ownerView();
  const show = Site.preview || (on && !adminView && (Site.mode === 'local' || stat || shared));
  setScreen(show);
  E.maintBanner.hidden = !(adminView && on && !Site.preview);
  if (!E.maintBanner.hidden) {
    E.maintBannerText.textContent = (ADMIN_PAGE ? 'Trang luyện viết đang tạm đóng bảo trì' : 'Trang đang tạm đóng bảo trì') +
      (Site.conf.until ? ` đến ${dateStr(Site.conf.until)}` : '') + (ADMIN_PAGE ? ': người học chỉ thấy thông báo bảo trì.' : ': người xem khác chỉ thấy thông báo bảo trì.');
    // static host, not signed in to the server: the button can only produce the site.json content (as in the panel)
    E.btnBannerReopen.textContent = stat && !(Api.base && Admin.on) ? 'Tạo site.json để mở lại' : 'Mở lại trang';
    E.btnBannerReopen.disabled = Site.saving;
  }
  E.cfgDot.hidden = !(adminView && !ADMIN_PAGE && (on || siteMismatch()));   // the tab bar exists on the learner page only
  renderSitePanel();
}
// static host with a server: site.json says "closed" while the server state in force says "open" - if the server stopped
// answering, a visitor who never read the server would get the closed file, so the owner is told to update the file.
// (The other way round fails open - a file saying "open" never locks anyone out - so it is not flagged.)
function siteMismatch() {
  return Site.mode === 'static' && !!Api.base && Site.source === 'api' && !!Site.fileConf && !!Site.serverConf &&
    maintActive(Site.fileConf) && !maintActive(Site.serverConf);
}
const stateWord = c => (maintActive(c) ? 'tạm đóng' : 'mở');
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
      if (T.maintPaused && T.state === 'paused') toast('Die Seite ist wieder geöffnet. Die Uhr ist angehalten — klicken Sie auf „Fortsetzen“, um weiterzuschreiben.');
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
    if (left > 0) E.maintEta.textContent = `Voraussichtlich wieder geöffnet um ${dateStr(until)} (noch ${fmt(left)})`;
    E.maintTimerNote.hidden = !T.maintPaused;
    const local = Site.mode === 'local';
    // no owner controls on the learner's closed screen: the owner works from quan-tri.html. Only on the claude.ai page,
    // when this viewer's rights could not be read, a reopen button lets the platform decide (editors pass, others are refused)
    E.maintAdmin.hidden = !(Site.preview || (Site.mode === 'shared' && Site.isAdmin === null));
    E.maintOwnerHint.hidden = Site.preview || !local;      // the offline copy: whoever has the folder has quan-tri.html
    E.maintPinRow.hidden = true;
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
  E.sitePanel.hidden = !ownerView();
  const c = Site.conf, on = maintActive(), local = Site.mode === 'local', shared = Site.mode === 'shared';
  const stat = Site.mode === 'static';
  if (Site.mode === 'connecting' || (stat && !Site.staticState)) pill(E.siteStatus, 'info', 'Wird geprüft…');
  else if (Site.mode === 'unavailable') pill(E.siteStatus, '', 'Không đổi được ở đây');
  else if (on) pill(E.siteStatus, 'bad', 'Đang tạm đóng');
  else if (stat && Site.staticState === 'missing') pill(E.siteStatus, 'info', 'Đang mở · chưa có site.json');
  else if (stat && Site.staticState === 'error') pill(E.siteStatus, 'warn', 'Không đọc được site.json');
  else pill(E.siteStatus, 'ok', 'Đang mở');
  const expired = c.maintenance && c.until && !on ? ` Lịch đóng trước đó đã hết hạn lúc ${dateStr(c.until)}, nên trang đang mở.` : '';
  const direct = stat && !!Api.base && Admin.on;          // the owner is signed in to the server: the switch acts at once
  const fileText = 'Trang trên máy chủ tĩnh (ví dụ GitHub Pages): trạng thái đóng / mở của mọi người truy cập nằm trong tệp site.json đặt cạnh index.html. Trang không tự ghi được lên GitHub, nên các nút dưới đây tạo nội dung tệp để bạn đưa lên kho rồi Commit.' +
    (Site.staticState === 'missing' ? ' Hiện chưa có tệp site.json trên máy chủ, nên trang luôn mở.' : '');
  const mismatch = siteMismatch();
  const apiText = 'Trang trên máy chủ tĩnh (ví dụ GitHub Pages) có máy chủ dữ liệu. Thay đổi mới nhất được áp dụng: lần bật / tắt qua máy chủ, hoặc tệp site.json được tạo sau đó bằng nút trong trang (tệp ghi thời điểm tạo). Khi máy chủ không trả lời, trình duyệt dùng trạng thái máy chủ đã đọc gần nhất; trình duyệt chưa từng đọc máy chủ thì dùng site.json. ' +
    (direct ? 'Bạn đang đăng nhập quản trị: các nút dưới đây đổi trạng thái trên máy chủ ngay; trang đang mở ở máy khác cập nhật trong vòng một phút.'
      : 'Để đổi trạng thái ngay cho mọi người, hãy đăng nhập ở phần „Quản trị máy chủ“; khi chưa đăng nhập, các nút dưới đây tạo nội dung tệp site.json (có hiệu lực sau khi Commit).') +
    ({ api: ' Trạng thái hiện tại do máy chủ cung cấp' + (Site.serverDown ? ' (bản đọc gần nhất; máy chủ hiện không trả lời).' : '.'),
       file: ' Trạng thái hiện tại lấy từ site.json' + (Site.serverDown ? ' (máy chủ hiện không trả lời).' : '.'),
       none: ' Máy chủ và site.json đều chưa có trạng thái, nên trang đang mở.' }[Site.source] || '') +
    (mismatch ? ` Lưu ý: site.json đang ghi „${stateWord(Site.fileConf)}“, khác với máy chủ („${stateWord(Site.serverConf)}“). Nếu máy chủ ngừng trả lời, người chưa từng mở trang sẽ thấy trạng thái trong site.json; hãy cập nhật site.json theo nội dung bên dưới rồi Commit.` : '') +
    (Api.local && !Api.fromSite ? ' Lưu ý: site.json trên trang chưa có dòng "api", nên người xem chưa biết máy chủ này và trạng thái trên máy chủ chưa áp dụng cho họ. Hãy thêm "api": "' + Api.local + '" vào site.json rồi Commit.'
      : Api.local && Api.local !== Api.fromSite ? ` Lưu ý: bạn đang dùng máy chủ ${Api.local}, khác với máy chủ ghi trong site.json (${Api.fromSite}); thay đổi qua máy chủ này chỉ áp dụng cho trình duyệt dùng cùng địa chỉ.` : '');
  E.siteScope.textContent = {
    local: 'Bản chạy từ tệp trên máy: trạng thái đóng / mở áp dụng cho trang luyện viết (index.html) mở bằng trình duyệt này. Khi đóng, trang luyện viết chỉ hiện màn hình bảo trì cho đến khi mở lại tại đây (hoặc đến giờ mở lại đã đặt).',
    static: (Api.base ? apiText : fileText) +
      (Site.staticState === 'error' ? ' Lần đọc site.json gần nhất bị lỗi (tệp sai định dạng JSON hoặc mất mạng); trang giữ trạng thái đọc được trước đó.' : '') +
      (Site.lastChecked ? ` Kiểm tra lần cuối lúc ${new Date(Site.lastChecked).toLocaleTimeString(LOCALE)}.` : ''),
    connecting: 'Đang đọc trạng thái trang từ dữ liệu chung…',
    shared: Site.isAdmin === false || Site.readOnly ? 'Bản trực tuyến.'
      : 'Bản trực tuyến: khi tạm đóng, người mở trang (trừ chủ trang và người có quyền chỉnh sửa) chỉ thấy màn hình bảo trì. Thay đổi có hiệu lực ngay cả với người đang mở trang. Người xem chưa đăng nhập không đọc được trạng thái này nên vẫn dùng được trang.',
    unavailable: 'Không đọc được dữ liệu chung của trang (ví dụ trang được mở trực tiếp bên ngoài claude.ai, người xem chưa đăng nhập, hoặc kết nối vừa bị mất), nên không đọc và không đổi được trạng thái bảo trì. Ứng dụng vẫn dùng bình thường; nếu vừa mất kết nối, hãy tải lại trang.'
  }[Site.mode] + (local || shared || stat ? expired : '');
  const pinLocked = local && !!Site.local.pinHash && !Site.cfgUnlocked;
  const canChange = local ? !pinLocked : stat || (shared && Site.isAdmin !== false && !Site.readOnly);
  E.siteViewerNote.hidden = !(shared && (Site.isAdmin === false || Site.readOnly));
  E.siteLocked.hidden = !pinLocked;
  E.siteForm.hidden = !canChange;
  E.pinBox.hidden = !local;
  const fileOnly = stat && !direct;                       // static without a signed-in admin: the buttons produce site.json
  setLabel(E.btnMaintToggle, fileOnly ? (on ? 'Tạo site.json để mở lại' : 'Tạo site.json để tạm đóng') : on ? 'Mở lại trang' : 'Tạm đóng để bảo trì');
  E.btnMaintToggle.className = 'btn ' + (on ? 'btn-primary' : 'btn-solid-danger');
  E.btnMaintSave.hidden = !on;
  setLabel(E.btnMaintSave, fileOnly ? 'Tạo site.json với lời nhắn và giờ mới' : 'Lưu lời nhắn và giờ mở lại');
  if (direct && mismatch) {                                // the file content that matches the server, ready to commit
    const want = staticJson(Site.serverConf, Site.serverConf.updatedAt);
    if (E.siteJson.value !== want) E.siteJson.value = want;
    E.siteJsonBox.hidden = false;
  } else if (!fileOnly) E.siteJsonBox.hidden = true;
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
// The result note sits at the end of „Trang và bảo trì“. When the owner acted from elsewhere (the banner's "Mở lại trang"
// on the writing desk, or at the top of quan-tri.html above the dashboard), a warning or an error is also shown as a toast.
function siteNoteOutOfSight() {
  if (currentView !== 'config' || E.sitePanel.hidden) return true;
  const r = E.siteNote.getBoundingClientRect();
  return r.bottom < 0 || r.top > (window.innerHeight || document.documentElement.clientHeight);
}
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
    if (!stored && ADMIN_PAGE) {       // the learner page reads this browser's storage: nothing reached it, so nothing changed
      unsaved.delete('site'); setTimeout(renderStorageState, 0);   // not kept in memory either: it would show a state nobody has
      readLocalSite(); applySite();
      siteNote('Chưa lưu được: trình duyệt không cho lưu dữ liệu (bị chặn hoặc bộ nhớ đã đầy), nên trang luyện viết không nhận được thay đổi. Trạng thái vẫn như trước.', true);
      return 'storage';
    }
    Site.formDirty = false;
    applySite(); fillSiteForm(true);
    siteNote(stored ? okMsg : okMsg + ' Trình duyệt không cho lưu dữ liệu, nên trạng thái này chỉ giữ đến khi đóng trang.', !stored);
    return '';
  }
  if (Site.mode === 'static' && Api.base && Admin.on) {   // the owner is signed in to the server: switch it for everyone now
    Site.saving = true; applySite(); siteNote('Đang lưu…');
    let code = '', warn = '';
    try {
      const j = await apiFetch('/api/admin/site', { method: 'PUT', token: Admin.token, body: { maintenance: conf.maintenance, message: conf.message, until: conf.until } });
      const c = cleanConf(j);
      if (typeof j.maintenance !== 'boolean' || !(c.updatedAt > 0)) throw new ApiError('bad_reply', 'Máy chủ trả về dữ liệu không đúng định dạng; trạng thái có thể chưa được lưu.');
      Object.assign(Site, { conf: c, serverConf: c, source: 'api', serverDown: false, formDirty: false });
      store.set('apiSite', { base: Api.base, conf: c });
      const other = Api.base !== Api.fromSite;            // visitors read the server named in site.json, not this one
      if (!other && Site.fileConf && maintActive(Site.fileConf) && !maintActive(c)) {
        warn = ` site.json vẫn ghi „${stateWord(Site.fileConf)}“: hãy cập nhật site.json theo nội dung trong phần „Trang và bảo trì“ để trạng thái không đổi ngược khi máy chủ không trả lời.`;
      }
      siteNote(okMsg + (other ? ` Đã lưu trên máy chủ ${Api.base}. Lưu ý: người xem dùng máy chủ ghi trong site.json (${Api.fromSite || 'chưa có'}), nên thay đổi này chưa áp dụng cho họ.`
        : ' Đã áp dụng qua máy chủ; trang đang mở ở máy khác cập nhật trong vòng một phút.') + warn, !!warn);
      if (warn && siteNoteOutOfSight()) toast(okMsg + warn);
    } catch (e) {
      code = e.code || 'error';
      if (code === 'unauthorized') adminRefused('Mã quản trị không còn đúng. Hãy nhập lại mã và bấm „Kết nối“.');
      const text = code === 'unauthorized' ? 'Mã quản trị không còn đúng. Hãy đăng nhập lại ở phần „Quản trị máy chủ“.' : ownerErrorText(e);
      siteNote(text, true);
      if (siteNoteOutOfSight() && !Site.screen) toast(text);
    } finally { Site.saving = false; applySite(); }
    if (!code) fillSiteForm(true);
    return code;
  }
  if (Site.mode === 'static') {                           // nothing to write from here: hand the owner the file content
    E.siteJson.value = staticJson(conf);
    E.siteJsonBox.hidden = false;
    siteNote(conf.maintenance ? 'Đã tạo nội dung site.json để TẠM ĐÓNG trang. Trang chỉ đóng sau khi tệp được Commit lên GitHub.'
      : 'Đã tạo nội dung site.json để MỞ LẠI trang. Trang chỉ mở lại sau khi tệp được Commit lên GitHub.');
    const away = siteNoteOutOfSight();                    // e.g. the banner's "Mở lại trang" at the top of quan-tri.html
    E.siteJson.focus({ preventScroll: true }); E.siteJson.select();
    if (away && currentView === 'config') E.siteJsonBox.scrollIntoView({ block: 'center' });
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
    if (siteNoteOutOfSight() && !Site.screen) toast(text);
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
  if (maintActive()) {
    const f = readForm(false);
    await saveConf(Object.assign({}, Site.conf, { maintenance: false, until: 0 }, f.error ? {} : { message: f.message }), 'Đã mở lại trang.');
    return;
  }
  const f = readForm(true);
  if (f.error) { siteNote(f.error, true); E.maintUntil.focus(); return; }
  const direct = Site.mode === 'static' && Api.base && Admin.on;
  if (Site.mode !== 'static' || direct) {                 // static without the server: only file content is produced
    const who = Site.mode === 'local' ? 'Trang luyện viết (index.html) mở bằng trình duyệt này sẽ chỉ hiện màn hình bảo trì'
      : direct && Api.base !== Api.fromSite ? `Chỉ trình duyệt dùng máy chủ ${Api.base} thấy màn hình bảo trì (người xem dùng máy chủ ghi trong site.json: ${Api.fromSite || 'chưa có'})`
      : direct ? 'Người mở trang luyện viết, kể cả trên máy này, sẽ chỉ thấy màn hình bảo trì (trang quản trị này vẫn dùng được)'
      : 'Người mở trang (trừ chủ trang và người có quyền chỉnh sửa) sẽ chỉ thấy màn hình bảo trì';
    const until = f.until ? ` đến ${dateStr(f.until)}` : ' cho đến khi được mở lại';
    const lag = direct ? ' Trang đang mở ở máy khác chuyển sang màn hình bảo trì trong vòng một phút.' : '';
    if (!(await confirmBox('Tạm đóng trang?', `${who}${until}. Người đang làm bài sẽ được tạm dừng đồng hồ.${lag}`, 'Tạm đóng', true))) return;
  }
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
E.btnBannerReopen.addEventListener('click', () => {
  if (Site.mode === 'local' && Site.local.pinHash && !Site.cfgUnlocked) {   // the PIN guards quan-tri.html on a shared computer
    siteNote('Hãy nhập mã PIN quản trị ở phần „Trang và bảo trì“ để mở lại trang.', true); E.cfgPin.focus(); return;
  }
  saveConf(Object.assign({}, Site.conf, { maintenance: false, until: 0 }), 'Đã mở lại trang.');
});

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
window.addEventListener('storage', e => { if (e.key === 'b1st:history' || e.key === null) { histCache = null; renderHistory(); } });
window.addEventListener('storage', e => {                 // another tab of the offline copy opened or closed the page
  if (e.key === 'b1st:site' && Site.mode === 'local') { readLocalSite(); applySite(); fillSiteForm(false); }
});
// the countdown on the screen and the automatic reopening at the set time
setInterval(() => { if (Site.screen || (Site.conf.maintenance && Site.conf.until)) applySite(); }, 1000);

/* ---- static host (GitHub Pages): site.json next to index.html ---- */
// at = the time written into the file (default now): with a server, the newer of the file and the server state wins
function staticJson(conf, at) {
  const o = { maintenance: !!conf.maintenance, message: conf.message || '' };
  if (conf.maintenance && conf.until) o.until = isoLocal(conf.until);
  o.updatedAt = isoLocal(at || Date.now(), true);
  const api = Api.fromSite || Api.local;                  // keep the server address in the file (the published one first)
  if (api) o.api = api;
  return JSON.stringify(o, null, 2) + '\n';
}
// The last state read from the server, per server address. When the server does not answer (an outage, the free daily
// quota used up), this browser keeps it instead of falling back to an older site.json - an outage never closes the page.
function lastServerState() {
  const s = store.get('apiSite', null);
  return s && typeof s === 'object' && s.base === Api.base ? cleanConf(s.conf) : null;
}
async function fetchStaticSite() {
  if (Site.mode !== 'static' || Site.fetching) return;
  Site.fetching = true;
  try { await readStaticSite(); }
  finally {                                               // always ends, so the next check is never blocked
    Site.fetching = false;
    Site.lastChecked = Date.now();
  }
  applySite(); fillSiteForm(false);
}
async function readStaticSite() {
  let fileConf = null, fileApi = null;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    // a unique URL and no-store: neither the browser cache nor the CDN may answer with an old copy
    const r = await fetch('site.json?v=' + Date.now(), { cache: 'no-store', signal: ctl.signal });
    if (r.status === 404) Site.staticState = 'missing';
    else if (!r.ok) throw new Error('HTTP ' + r.status);
    else {
      const j = await r.json();
      if (!j || typeof j !== 'object' || Array.isArray(j)) throw new Error('site.json is not an object');
      fileConf = cleanConf(j); fileApi = cleanApiUrl(j.api) || ''; Site.staticState = 'ok';
    }
  } catch (e) {
    Site.staticState = 'error';
  } finally { clearTimeout(timer); }
  if (fileApi !== null && fileApi !== Api.fromSite) {    // outside the try: an error here is the app's, not the file's
    Api.fromSite = fileApi; if (!Api.local) E.apiUrl.value = fileApi; updateApiBase();
  }
  // the server state counts once it has been switched (updatedAt > 0); without an answer, the last one this browser read
  let server = null;
  if (Api.base) {
    try {
      const c = cleanConf(await apiFetch('/api/site', { timeout: 8000 }));
      Site.serverDown = false;
      if (c.updatedAt > 0) { server = c; store.set('apiSite', { base: Api.base, conf: c }); } else store.del('apiSite');
    } catch (e) { Site.serverDown = true; server = lastServerState(); }
  } else Site.serverDown = false;
  // the newer change wins: a switch on the server, or a site.json created later (the page writes "updatedAt" into it;
  // a hand-edited file without it counts as older than any server switch)
  let pick = null, source = '';
  if (server && fileConf) { if (fileConf.updatedAt > server.updatedAt) { pick = fileConf; source = 'file'; } else { pick = server; source = 'api'; } }
  else if (server) { pick = server; source = 'api'; }
  else if (fileConf) { pick = fileConf; source = 'file'; }
  else if (Site.staticState === 'missing') { pick = cleanConf(null); source = 'none'; }
  if (pick) { Site.conf = pick; Site.source = source; }  // else: nothing could be read - keep the last state (never read: open)
  if (Site.staticState !== 'error') Site.fileConf = fileConf;
  Site.serverConf = server;
}
setInterval(() => {                                       // every minute (30 s while closed), only while the tab is visible
  if (Site.mode !== 'static' || document.hidden) return;
  if (Date.now() - Site.lastChecked >= (Site.screen ? 30000 : 60000)) fetchStaticSite();
}, 5000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && Site.mode === 'static') fetchStaticSite(); });
window.addEventListener('online', () => { if (Site.mode === 'static') fetchStaticSite(); });
E.btnSiteJsonCopy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(E.siteJson.value); toast('Đã sao chép nội dung site.json.'); }
  catch (e) {
    E.siteJson.focus(); E.siteJson.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    toast(ok ? 'Đã sao chép nội dung site.json.' : 'Automatisches Kopieren nicht möglich: Der Text ist markiert, drücken Sie Strg+C.');
  }
});
E.btnSiteJsonDownload.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([E.siteJson.value], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'site.json';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
});

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
  if (!C || typeof C.use !== 'function') {
    Site.mode = /^https?:$/.test(location.protocol) ? 'static' : 'local';
    readLocalSite(); applySite(); fillSiteForm(true);
    if (Site.mode === 'static') await fetchStaticSite();
    return;
  }
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
  if (active() && !(await confirmBox('Uhr zurücksetzen?', 'Der laufende Prüfungsdurchgang wird abgebrochen. Ihr Text bleibt erhalten.', 'Zurücksetzen', true))) return;
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
  } catch (e) { toast('Der Browser erlaubt hier kein Vollbild. Sie können F11 drücken.'); }
});
E.btnUnlock.addEventListener('click', () => { T.unlocked = true; persistTimer(); applyExam(); E.answer.focus(); });
E.btnGrade.addEventListener('click', grade);
E.btnDemo.addEventListener('click', async () => {
  if (active()) { toast('Die Uhr läuft. Geben Sie zuerst ab oder setzen Sie die Uhr zurück.'); return; }
  const s = SAMPLES[0];
  const lose = [];
  if (E.answer.value.trim() && E.answer.value !== DEMO_ANSWER) lose.push('der Text, den Sie gerade schreiben');
  if (E.task.value.trim() && E.task.value !== s.task) lose.push('die Aufgabe');
  if (E.model.value.trim() && E.model.value !== s.model) lose.push('der Musterbrief');
  if (lose.length && !(await confirmBox('Beispiel verwenden?', `Folgendes wird durch die Aufgabe „${s.title}“ und einen Beispieltext mit einigen typischen Fehlern ersetzt: ${capFirst(joinVi(lose))}.`, 'Beispiel verwenden'))) return;
  if (T.state === 'done' || T.state === 'stopped') resetTimer();   // the demo is not part of the last timed attempt
  loadSample(s.id, true);
  E.answer.value = DEMO_ANSWER;
  E.answer.dispatchEvent(new Event('input'));
  grade();
});
E.btnNew.addEventListener('click', async () => {
  if ((E.answer.value.trim() || active()) &&
      !(await confirmBox('Neuen Text beginnen?', 'Der Briefbogen wird geleert und die Uhr zurückgesetzt. Aufgabe und Musterbrief bleiben erhalten.', 'Neuer Text', true))) return;
  E.answer.value = ''; E.answer.dispatchEvent(new Event('input'));
  resetTimer(); lastResult = null; currentAttempt = null; E.results.hidden = true;
  E.answer.focus();
});
SAMPLES.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.title; E.sampleSel.appendChild(o); });
function loadSample(id, quiet) {
  const s = allSamples().find(x => x.id === id);
  if (!s) return;
  E.task.value = s.task; E.model.value = s.model;
  E.task.dispatchEvent(new Event('input')); E.model.dispatchEvent(new Event('input'));
  E.sampleNote.textContent = id.startsWith('c:') ? `Aufgabe und Musterbrief von einer lernenden Person beigetragen${s.author ? ' (' + s.author + ')' : ''}, freigegeben.`
    : 'Dies ist eine Beispielaufgabe. Fügen Sie Ihre eigene Aufgabe in das Feld oben ein oder öffnen Sie eine .txt- / .docx-Datei.';
  E.sampleNote.hidden = false;
  if (!quiet) toast(s.model ? 'Beispielaufgabe mit Musterbrief geladen.' : 'Beispielaufgabe geladen (zu dieser Aufgabe gibt es noch keinen Musterbrief).');
}
E.sampleSel.addEventListener('change', async () => {
  const id = E.sampleSel.value; E.sampleSel.value = '';
  const s = allSamples().find(x => x.id === id);
  if (!s) return;
  const custom = (E.task.value.trim() && !allSamples().some(x => x.task === E.task.value)) || (E.model.value.trim() && !allSamples().some(x => x.model === E.model.value));
  if (custom && !(await confirmBox('Beispielaufgabe laden?', `Die aktuelle Aufgabe und der Musterbrief werden durch die Aufgabe „${s.title}“ ersetzt.`, 'Beispielaufgabe laden'))) return;
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
          toast('Die Uhr läuft noch. Klicken Sie auf die Seite, um die Zeitsignale wieder einzuschalten.');
        }
      }
    }
  }
  const tr = store.get('trace', null);
  if (TR && tr && typeof tr === 'object' && typeof tr.typed === 'string' && tr.sig === hashText(E.model.value.normalize('NFC'))) {
    E.traceInput.value = tr.typed;
    Object.assign(Trace, { started: +tr.started || 0, activeMs: +tr.activeMs || 0, saved: !!tr.saved, autoDone: !!tr.saved,
      entryId: typeof tr.entryId === 'string' ? tr.entryId : null });
  }
  applyHelpers();
  applyFocus();                                           // before the sheet is laid out and measured
  applyMode();
  applyTimerUI();
  updateCounters();
  autoGrow();
  renderHistory();
  renderConfig();
  updateSticky();
}
if (ADMIN_PAGE) {
  // the owner's console: no exam clock, draft, dictionary or backups here - the server dashboard and the maintenance switch
  E.configGrid.prepend(E.adminPanel);
  selectView('config');
  initServer();
  initSite();
} else {
  restore();
  if ('requestIdleCallback' in window) requestIdleCallback(() => initSpell(), { timeout: 1200 }); else setTimeout(initSpell, 300);
  initServer();                                           // before initSite: the admin's own server address is known first
  initSite();
  initBackup();
}
window.B1AppStarted = true;
})();
