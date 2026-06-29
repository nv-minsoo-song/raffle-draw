const fs = require("fs");
const vm = require("vm");

function makeElement(initial = {}) {
  const classes = new Set(initial.classes || []);
  const attributes = new Map();
  const listeners = new Map();
  const element = {
    textContent: "",
    value: "",
    disabled: false,
    innerHTML: "",
    files: [],
    dataset: initial.dataset || {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force) {
        const next = force === undefined ? !classes.has(name) : Boolean(force);
        if (next) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
        return next;
      }
    },
    addEventListener(type, listener) {
      const current = listeners.get(type) || [];
      current.push(listener);
      listeners.set(type, current);
    },
    setAttribute(name, value) {
      attributes.set(name, String(value));
    },
    getAttribute: (name) => attributes.get(name) ?? null,
    appendChild() {},
    append() {},
    remove() {},
    click() {
      (listeners.get("click") || []).forEach((listener) => listener({ target: element }));
    }
  };
  return element;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert(scriptMatch, "Could not find inline script in index.html");

const localStorageValues = new Map();
const languageButtons = [
  makeElement({ dataset: { language: "en" }, classes: ["language-button"] }),
  makeElement({ dataset: { language: "ko" }, classes: ["language-button", "is-active"] }),
  makeElement({ dataset: { language: "ja" }, classes: ["language-button"] })
];
const translatedTextNode = makeElement({ dataset: { i18n: "winnerHistoryTitle" } });
const translatedAriaNode = makeElement({ dataset: { i18nAria: "setupAria" } });

const context = {
  console,
  Blob: global.Blob,
  Response: global.Response,
  DecompressionStream: global.DecompressionStream,
  TextDecoder: global.TextDecoder,
  DataView: global.DataView,
  Uint8Array: global.Uint8Array,
  Uint32Array: global.Uint32Array,
  Date: global.Date,
  Math: global.Math,
  Number: global.Number,
  JSON: global.JSON,
  String: global.String,
  Array: global.Array,
  Map: global.Map,
  Set: global.Set,
  RegExp: global.RegExp,
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL() {}
  },
  localStorage: {
    getItem: (key) => localStorageValues.get(key) ?? null,
    setItem: (key, value) => localStorageValues.set(key, String(value))
  },
  document: {
    getElementById: () => makeElement(),
    querySelectorAll: (selector) => {
      if (selector === "[data-language]") return languageButtons;
      if (selector === "[data-i18n]") return [translatedTextNode];
      if (selector === "[data-i18n-aria]") return [translatedAriaNode];
      return [];
    },
    addEventListener() {},
    createElement: () => makeElement(),
    body: makeElement(),
    documentElement: {
      requestFullscreen() {}
    },
    fullscreenElement: null,
    exitFullscreen() {}
  },
  window: {
    crypto: require("crypto").webcrypto,
    setInterval,
    setTimeout,
    clearInterval,
    confirm: () => true
  }
};

context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${scriptMatch[1]}
globalThis.__raffleTest = {
  DRAW_DURATION_MS,
  MIN_DRAW_COUNT,
  MAX_DRAW_COUNT,
  TRANSLATIONS,
  state,
  parseCsv,
  readXlsxRows,
  normalizeParticipants,
  getHeaderInfo,
  romanizeKoreanName,
  romanizeJapaneseKana,
  romanizeParticipantName,
  readCsvFile,
  t,
  setLanguage,
  restoreState,
  normalizeTitle,
  normalizeDrawCount,
  recordWinnerFromIndex,
  recordWinnersFromIndexes,
  markCurrentAbsent,
  markWinnerAbsentById,
  restoreLastAbsent,
  getExportData,
  toCsvLine
};`, context);

const api = context.__raffleTest;
const usedTranslationKeys = [...scriptMatch[1].matchAll(/\bt\("([^"]+)"/g)].map((match) => match[1]);
const markupTranslationKeys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((match) => match[1]);
const referenceTranslationKeys = Object.keys(api.TRANSLATIONS.ko).sort();
const getPlaceholders = (text) => [...String(text).matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort().join(",");
Object.entries(api.TRANSLATIONS).forEach(([language, messages]) => {
  assert(Object.keys(messages).sort().join("\n") === referenceTranslationKeys.join("\n"), `${language} translation dictionary should contain the same keys as Korean`);
  [...new Set([...usedTranslationKeys, ...markupTranslationKeys])].forEach((key) => {
    assert(key in messages, `${language} translation should include ${key}`);
  });
  referenceTranslationKeys.forEach((key) => {
    assert(getPlaceholders(messages[key]) === getPlaceholders(api.TRANSLATIONS.ko[key]), `${language}.${key} should use the same placeholders as Korean`);
  });
});

const englishButton = languageButtons.find((button) => button.dataset.language === "en");
const koreanButton = languageButtons.find((button) => button.dataset.language === "ko");
const japaneseButton = languageButtons.find((button) => button.dataset.language === "ja");

englishButton.click();
assert(api.state.language === "en", "English language button should switch state language");
assert(api.state.title === "Raffle Draw", "Switching a default title to English should localize it");
assert(context.document.documentElement.lang === "en", "English switch should update the document lang");
assert(translatedTextNode.textContent === "Winner History", "English switch should translate static text");
assert(translatedAriaNode.getAttribute("aria-label") === "Raffle setup", "English switch should translate ARIA labels");
assert(englishButton.classList.contains("is-active"), "English language button should become active");
assert(englishButton.getAttribute("aria-pressed") === "true", "English language button should expose pressed state");
assert(JSON.parse(localStorageValues.get("raffle-draw-state-v1")).language === "en", "English selection should persist to localStorage");

japaneseButton.click();
assert(api.state.language === "ja", "Japanese language button should switch state language");
assert(api.state.title === "抽選会", "Switching a default title to Japanese should localize it");
assert(context.document.documentElement.lang === "ja", "Japanese switch should update the document lang");
assert(translatedTextNode.textContent === "当選履歴", "Japanese switch should translate static text");
assert(translatedAriaNode.getAttribute("aria-label") === "抽選設定", "Japanese switch should translate ARIA labels");
assert(japaneseButton.classList.contains("is-active"), "Japanese language button should become active");
assert(japaneseButton.getAttribute("aria-pressed") === "true", "Japanese language button should expose pressed state");
assert(JSON.parse(localStorageValues.get("raffle-draw-state-v1")).language === "ja", "Selected language should persist to localStorage");

localStorageValues.set("raffle-draw-state-v1", JSON.stringify({
  language: "en",
  title: "오늘의 추첨",
  sourceName: "",
  participants: [],
  remaining: [],
  winners: [],
  absentees: [],
  currentBatch: [],
  current: null,
  drawCount: 1,
  pendingReplacementCount: 0
}));
api.restoreState();
assert(api.state.language === "en", "Saved English language should be restored");
assert(api.state.title === "Raffle Draw", "A translated default title should migrate to the English default");
api.state.title = "Global Partner Raffle";
koreanButton.click();
englishButton.click();
assert(api.state.title === "Global Partner Raffle", "Custom event titles should survive language switches");

localStorageValues.set("raffle-draw-state-v1", JSON.stringify({
  title: "Raffle Draw",
  sourceName: "",
  participants: [],
  remaining: [],
  winners: [],
  absentees: [],
  currentBatch: [],
  current: null,
  drawCount: 1,
  pendingReplacementCount: 0
}));
api.restoreState();
assert(api.state.language === "ko", "Saved v1 state without a language should migrate to Korean");
assert(api.state.title === "오늘의 추첨", "Legacy Raffle Draw title should migrate to the Korean default title");
assert(context.document.documentElement.lang === "ko", "Migrated state should update the document language");

const sampleRows = api.parseCsv(createSampleCsv(790));
const sampleParticipants = api.normalizeParticipants(sampleRows);

assert(sampleParticipants.length === 790, "Sample CSV should parse 790 participants");
assert(api.DRAW_DURATION_MS === 500, "Draw animation should be 0.5 seconds");
assert(api.MIN_DRAW_COUNT === 1, "Minimum draw count should be 1");
assert(api.MAX_DRAW_COUNT === 50, "Maximum draw count should be 50");
assert(api.normalizeDrawCount(7) === 7, "Draw count should allow arbitrary values such as 7");
assert(api.normalizeDrawCount(999) === 50, "Draw count should clamp above the maximum");
assert(api.normalizeDrawCount(0) === 1, "Draw count should clamp below the minimum");
assert(sampleParticipants[0].name === "양민규", "First Korean name should be preserved");
assert(sampleParticipants[0].englishName === "Yang Min-gyu", "양민규 should romanize as Yang Min-gyu");
assert(api.romanizeKoreanName("김민수") === "Kim Min-su", "김민수 should romanize as Kim Min-su");
assert(api.romanizeKoreanName("이서연") === "Lee Seo-yeon", "이서연 should romanize as Lee Seo-yeon");
assert(api.romanizeJapaneseKana("ほった しんや") === "Hotta Shin'ya", "Hiragana should romanize with small-tsu and n-apostrophe handling");
assert(api.romanizeJapaneseKana("ﾔﾏﾀﾞ ﾊﾅｺ") === "Yamada Hanako", "Half-width Katakana should normalize and romanize");
assert(api.romanizeParticipantName("山田太郎", "ヤマダ タロウ") === "Yamada Tarou", "Japanese furigana should provide a romanized display name");

const nonHangulRows = api.parseCsv("No,Name\n42,Kai Cheung Ng\n");
const nonHangulParticipants = api.normalizeParticipants(nonHangulRows);
assert(nonHangulParticipants[0].englishName === "Kai Cheung Ng", "Non-Hangul names should stay readable as-is");

const englishRows = api.parseCsv("No,Full Name,Department\n7,Alex Morgan,Global Programs\n");
const englishParticipants = api.normalizeParticipants(englishRows);
assert(englishParticipants.length === 1, "English participant headers should parse");
assert(englishParticipants[0].number === "7", "English No header should provide the participant number");
assert(englishParticipants[0].name === "Alex Morgan", "English Full Name header should provide the participant name");
assert(englishParticipants[0].extra === "Global Programs", "English Department should remain extra info");

const snuHeader = ["IDX", "등록 카테고리", "카테고리 코드", "이름", "단과대학(원) / 소속", "학과 및 전공 / 부서", "직급명(국문)", "행운권 추첨번호"];
const snuHeaderInfo = api.getHeaderInfo(snuHeader);
assert(snuHeaderInfo.nameIndex === 3, "SNU XLSX header should use 이름 as the participant name");
assert(snuHeaderInfo.numberIndex === 7, "SNU XLSX header should prefer 행운권 추첨번호 over IDX");

const overrideRows = api.parseCsv("No,Korean Name,English Name,Affiliation\n1,양민규,Min Gyu Yang,NVIDIA\n");
const overrideParticipants = api.normalizeParticipants(overrideRows);
assert(overrideParticipants[0].englishName === "Min Gyu Yang", "English Name column should override auto romanization");
assert(overrideParticipants[0].englishNameSource === "provided", "Manual English Name should be marked as provided");
assert(overrideParticipants[0].extra === "NVIDIA", "Affiliation should remain extra info");

const quotedRows = api.parseCsv("No,Korean Name,Affiliation\n11,\"김,민수\",\"Team, A\"\n");
const quotedParticipants = api.normalizeParticipants(quotedRows);
assert(quotedParticipants[0].name === "김,민수", "Quoted comma in Korean name should parse correctly");
assert(quotedParticipants[0].extra === "Team, A", "Quoted comma in extra info should parse correctly");

const japaneseRows = api.parseCsv("抽選番号,氏名,フリガナ,ローマ字,所属\nA-001,山田太郎,ヤマダ タロウ,Taro Yamada,営業\n");
const japaneseHeaderInfo = api.getHeaderInfo(japaneseRows[0]);
const japaneseParticipants = api.normalizeParticipants(japaneseRows);
assert(japaneseHeaderInfo.numberIndex === 0, "Japanese 抽選番号 should be the raffle number column");
assert(japaneseHeaderInfo.nameIndex === 1, "Japanese 氏名 should be the participant name column");
assert(japaneseHeaderInfo.readingIndex === 2, "Japanese フリガナ should be the reading column");
assert(japaneseHeaderInfo.englishNameIndex === 3, "Japanese ローマ字 should be the romanized name column");
assert(japaneseParticipants[0].number === "A-001", "Japanese raffle number should be preserved");
assert(japaneseParticipants[0].name === "山田太郎", "Japanese original name should be preserved");
assert(japaneseParticipants[0].englishName === "Taro Yamada", "Explicit Japanese romaji should take priority over furigana");
assert(japaneseParticipants[0].englishNameSource === "provided", "Explicit Japanese romaji should be marked as provided");
assert(japaneseParticipants[0].extra === "営業", "Japanese affiliation should remain extra info");

const japaneseKanaRows = api.parseCsv("番号,氏名,フリガナ,所属\n2,佐藤優希,サトウ ユウキ,研究開発\n3,髙橋凛,,企画\n4,ほった しんや,,営業\n5,ﾔﾏﾀﾞ ﾊﾅｺ,,広報\n");
const japaneseKanaParticipants = api.normalizeParticipants(japaneseKanaRows);
assert(japaneseKanaParticipants[0].englishName === "Satou Yuuki", "Furigana should auto-romanize when explicit romaji is absent");
assert(japaneseKanaParticipants[0].englishNameSource === "kana", "Furigana romanization should record a kana source");
assert(japaneseKanaParticipants[1].englishName === "髙橋凛", "Kanji without a reading should safely keep the original name");
assert(japaneseKanaParticipants[1].englishNameSource === "original", "Kanji fallback should be marked as original");
assert(japaneseKanaParticipants[2].englishName === "Hotta Shin'ya", "Kana-only names should auto-romanize");
assert(japaneseKanaParticipants[3].englishName === "Yamada Hanako", "Half-width Katakana names should auto-romanize");

const japaneseNoNumberRows = api.parseCsv("氏名,フリガナ,所属\n鈴木花子,スズキ ハナコ,広報\n");
const japaneseNoNumberParticipants = api.normalizeParticipants(japaneseNoNumberRows);
assert(japaneseNoNumberParticipants.length === 1, "Japanese headers without a number column should still parse");
assert(japaneseNoNumberParticipants[0].number === "1", "Missing Japanese numbers should fall back to row order");
assert(japaneseNoNumberParticipants[0].englishName === "Suzuki Hanako", "Japanese no-number rows should still use furigana");

const japaneseDepartmentRows = api.parseCsv("氏名,部署\n田中美咲,営業部\n");
const japaneseDepartmentParticipants = api.normalizeParticipants(japaneseDepartmentRows);
assert(japaneseDepartmentParticipants.length === 1, "Japanese 氏名,部署 headers should not be imported as a participant");
assert(japaneseDepartmentParticipants[0].number === "1", "Japanese department lists should generate a row number");
assert(japaneseDepartmentParticipants[0].name === "田中美咲", "Japanese department lists should preserve the real participant name");
assert(japaneseDepartmentParticipants[0].extra === "営業部", "Japanese department values should remain extra info");

const fullWidthJapaneseHeader = api.getHeaderInfo(["Ｎｏ．", "氏名（漢字）", "氏名（カナ）", "ローマ字氏名", "所属"]);
assert(fullWidthJapaneseHeader.numberIndex === 0, "Full-width Japanese No. headers should normalize");
assert(fullWidthJapaneseHeader.nameIndex === 1, "Japanese kanji-name headers should normalize");
assert(fullWidthJapaneseHeader.readingIndex === 2, "Japanese kana-name headers should normalize");
assert(fullWidthJapaneseHeader.englishNameIndex === 3, "Japanese romaji-name headers should normalize");

api.state.language = "ja";
assert(api.t("drawWinnersButton", { count: 3 }) === "3名を抽選", "Japanese dynamic draw labels should interpolate counts");
api.state.language = "en";
assert(api.t("drawWinnersButton", { count: 3 }) === "Draw 3 Winners", "English dynamic draw labels should interpolate counts");
assert(api.t("statusParticipantsLoaded", { count: 1 }) === "Participant list loaded · Total: 1", "English single-participant status should avoid plural grammar");
assert(api.t("drawReplacementButton", { count: 1 }) === "Replacement Draw (1)", "English single replacement label should avoid plural grammar");
api.state.language = "ko";

const csvLine = api.toCsvLine(["Winner", "Yang Min-gyu", "Team, A"]);
assert(csvLine === "Winner,Yang Min-gyu,\"Team, A\"", "CSV export should quote comma fields");

function createSampleCsv(count) {
  const surnames = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍", "전", "고", "문", "양", "손", "배", "백", "허", "유", "남"];
  const first = ["민", "서", "지", "하", "도", "준", "현", "유", "수", "예", "태", "시", "연", "다", "채", "은", "우", "승", "재", "건", "윤", "소", "나", "아", "정", "혜", "보", "동", "경", "성"];
  const second = ["규", "수", "연", "준", "윤", "아", "현", "호", "우", "진", "희", "빈", "영", "원", "민", "은", "서", "림", "율", "하", "훈", "경", "성", "주", "재", "혁", "찬", "솔", "리", "온"];
  const rows = ["No,Korean Name,Affiliation", "1,양민규,DevRel"];

  for (let index = 2; index <= count; index += 1) {
    const offset = index - 2;
    const name = surnames[offset % surnames.length] + first[Math.floor(offset / second.length) % first.length] + second[offset % second.length];
    const group = String(Math.floor(offset / 50) + 1).padStart(2, "0");
    rows.push(`${index},${name},Sample Group ${group}`);
  }

  return `${rows.join("\n")}\n`;
}

function resetTestState(participants) {
  api.state.title = "Raffle Draw";
  api.state.sourceName = "test.csv";
  api.state.participants = participants.map((participant) => ({ ...participant }));
  api.state.remaining = participants.map((participant) => ({ ...participant }));
  api.state.winners = [];
  api.state.absentees = [];
  api.state.currentBatch = [];
  api.state.current = null;
  api.state.drawCount = 1;
  api.state.pendingReplacementCount = 0;
  api.state.spinning = false;
}

function uniqueCount(items) {
  return new Set(items.map((item) => item.id)).size;
}

resetTestState(sampleParticipants);
api.recordWinnerFromIndex(0, "2026-06-07T10:00:00.000Z");
api.recordWinnerFromIndex(0, "2026-06-07T10:01:00.000Z");
api.recordWinnerFromIndex(0, "2026-06-07T10:02:00.000Z");
assert(api.state.winners.length === 3, "Three draw calls should create three winners");
assert(api.state.remaining.length === sampleParticipants.length - 3, "Three winners should be removed from remaining pool");
assert(uniqueCount(api.state.winners) === 3, "Three winners should be unique");
assert(api.state.winners.map((winner) => winner.drawOrder).join(",") === "1,2,3", "Three winners should have draw orders 1,2,3");

resetTestState(sampleParticipants);
api.state.drawCount = 3;
const simultaneousBatch = api.recordWinnersFromIndexes([0, 0, 0], "2026-06-07T10:30:00.000Z");
assert(simultaneousBatch.length === 3, "One simultaneous draw should return three winners");
assert(api.state.winners.length === 3, "One simultaneous draw should record three winners");
assert(api.state.currentBatch.length === 3, "Current batch should show three simultaneous winners");
assert(api.state.remaining.length === sampleParticipants.length - 3, "Three simultaneous winners should be removed from remaining pool");
assert(uniqueCount(api.state.currentBatch) === 3, "Simultaneous current batch should be unique");

resetTestState(sampleParticipants);
api.state.drawCount = 7;
const sevenAtOnce = api.recordWinnersFromIndexes([0, 0, 0, 0, 0, 0, 0], "2026-06-07T10:45:00.000Z");
assert(sevenAtOnce.length === 7, "Adjustable simultaneous draw should return seven winners");
assert(api.state.winners.length === 7, "Adjustable simultaneous draw should record seven winners");
assert(api.state.currentBatch.length === 7, "Current batch should show seven simultaneous winners");
assert(api.state.remaining.length === sampleParticipants.length - 7, "Seven simultaneous winners should be removed from remaining pool");
assert(uniqueCount(api.state.currentBatch) === 7, "Seven-winner current batch should be unique");

resetTestState(sampleParticipants.slice(0, 5));
const absentCandidate = api.recordWinnerFromIndex(0, "2026-06-07T11:00:00.000Z");
api.markCurrentAbsent();
assert(api.state.winners.length === 0, "Absent winner should be removed from winner list");
assert(api.state.absentees.length === 1, "Absent winner should be recorded in absent list");
assert(api.state.remaining.length === 4, "Absent winner should not be returned to remaining pool");
assert(!api.state.remaining.some((participant) => participant.id === absentCandidate.id), "Absent winner should not be drawable again");
api.recordWinnerFromIndex(0, "2026-06-07T11:01:00.000Z");
assert(api.state.winners.length === 1, "Replacement draw should create one valid winner");
assert(api.state.absentees.length === 1, "Absent history should remain after replacement draw");
assert(api.state.winners[0].id !== absentCandidate.id, "Replacement winner should not be the absent participant");
const exportData = api.getExportData();
assert(exportData.header.join(",") === "Status,Order,No.,Korean Name,English Name,English Name Source,Extra,Drawn At,Marked Absent At", "Export headers should remain backward compatible");
assert(exportData.rows.length === 2, "Export should include one winner row and one absent row");
assert(exportData.rows.some((row) => row[0] === "Winner"), "Export should include Winner status");
assert(exportData.rows.some((row) => row[0] === "Absent"), "Export should include Absent status");

resetTestState(sampleParticipants.slice(0, 3));
const restoredCandidate = api.recordWinnerFromIndex(0, "2026-06-07T12:00:00.000Z");
api.markCurrentAbsent();
api.restoreLastAbsent();
assert(api.state.absentees.length === 0, "Restore Last Absent should remove the absent record");
assert(api.state.winners.length === 0, "Restoring an absent person should not make them a winner");
assert(api.state.remaining.some((participant) => participant.id === restoredCandidate.id), "Restored absent person should return to the draw pool");

resetTestState(sampleParticipants.slice(0, 8));
const threeAtOnce = api.recordWinnersFromIndexes([0, 0, 0], "2026-06-07T12:30:00.000Z");
const missingFromBatch = threeAtOnce[1];
api.markWinnerAbsentById(missingFromBatch.id);
assert(api.state.winners.length === 2, "If one of three is absent, two winners should remain accepted");
assert(api.state.absentees.length === 1, "If one of three is absent, one absent record should be kept");
assert(api.state.currentBatch.length === 2, "Current batch should keep the two present winners");
assert(api.state.pendingReplacementCount === 1, "One absent from a three-person batch should require one replacement");
api.recordWinnersFromIndexes([0], "2026-06-07T12:31:00.000Z");
assert(api.state.winners.length === 3, "Replacement draw should restore the final winner count to three");
assert(api.state.currentBatch.length === 3, "Current batch should show the two accepted winners plus the replacement");
assert(api.state.pendingReplacementCount === 0, "Replacement draw should clear the pending replacement count");
assert(!api.state.winners.some((winner) => winner.id === missingFromBatch.id), "Absent person should not remain in final winners");

resetTestState(sampleParticipants.slice(0, 12));
const adjustableBatch = api.recordWinnersFromIndexes([0, 0, 0, 0, 0, 0, 0], "2026-06-07T12:45:00.000Z");
api.markWinnerAbsentById(adjustableBatch[1].id);
api.markWinnerAbsentById(adjustableBatch[4].id);
assert(api.state.winners.length === 5, "If two of seven are absent, five winners should remain accepted");
assert(api.state.absentees.length === 2, "If two of seven are absent, two absent records should be kept");
assert(api.state.pendingReplacementCount === 2, "Two absent people from an adjustable batch should require two replacements");
api.recordWinnersFromIndexes([0, 0], "2026-06-07T12:46:00.000Z");
assert(api.state.winners.length === 7, "Two replacements should restore the adjustable final winner count");
assert(api.state.currentBatch.length === 7, "Current batch should show five accepted winners plus two replacements");
assert(api.state.pendingReplacementCount === 0, "Two replacement draw should clear pending replacement count");

resetTestState(sampleParticipants.slice(0, 6));
const firstCalled = api.recordWinnerFromIndex(0, "2026-06-07T13:00:00.000Z");
api.markCurrentAbsent();
api.recordWinnerFromIndex(0, "2026-06-07T13:01:00.000Z");
api.recordWinnerFromIndex(0, "2026-06-07T13:02:00.000Z");
api.recordWinnerFromIndex(0, "2026-06-07T13:03:00.000Z");
const allResolvedIds = [...api.state.winners, ...api.state.absentees].map((participant) => participant.id);
assert(api.state.winners.length === 3, "Final target should still reach three valid winners after one absent call");
assert(api.state.absentees.length === 1, "Combined scenario should keep one absent record");
assert(api.state.remaining.length === 2, "Six participants minus three winners minus one absent should leave two remaining");
assert(!api.state.winners.some((winner) => winner.id === firstCalled.id), "Absent caller should not appear in final three winners");
assert(new Set(allResolvedIds).size === allResolvedIds.length, "Winners and absentees should not overlap");

async function verifyLocalXlsx() {
  const xlsxFiles = fs.readdirSync(".")
    .filter((fileName) => fileName.toLowerCase().endsWith(".xlsx"))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  if (xlsxFiles.length === 0) {
    return [];
  }

  const results = [];

  for (const xlsxFile of xlsxFiles) {
    const buffer = fs.readFileSync(xlsxFile);
    const rows = await api.readXlsxRows(bufferToArrayBuffer(buffer));
    const participants = api.normalizeParticipants(rows);
    const headerInfo = api.getHeaderInfo(rows[0]);
    const firstParticipant = participants[0];
    const firstDataRow = rows[1];
    const raffleColumnIndex = rows[0].findIndex((cell) => /행운권|추첨|raffle|ticket/i.test(String(cell)));
    const normalizedFileName = xlsxFile.normalize("NFC");
    const expectedCountMatch = normalizedFileName.match(/\((\d+)명\)/);

    assert(rows.length > 1, "Local XLSX should include a header row and data rows");
    assert(participants.length > 0, "Local XLSX should parse named participants");

    if (raffleColumnIndex >= 0) {
      assert(headerInfo.numberIndex === raffleColumnIndex, "Local XLSX should prefer raffle/draw number columns over generic IDs");
    }

    assert(firstParticipant.number === String(firstDataRow[headerInfo.numberIndex] ?? "").trim(), "Local XLSX first display number should come from the selected number column");
    assert(firstParticipant.name === String(firstDataRow[headerInfo.nameIndex] ?? "").trim(), "Local XLSX first participant name should come from the selected name column");

    results.push({
      fileName: xlsxFile,
      rowCount: rows.length,
      participantCount: participants.length,
      expectedFromFileName: expectedCountMatch ? Number.parseInt(expectedCountMatch[1], 10) : null,
      numberHeader: rows[0][headerInfo.numberIndex],
      nameHeader: rows[0][headerInfo.nameIndex],
      firstDisplayNumber: firstParticipant.number
    });
  }

  return results;
}

async function verifyLegacyCsvEncodings() {
  const originalLanguage = api.state.language;
  const fixtures = [
    {
      language: "ja",
      base64: "koqRSZTUjYYsjoGWvCyDdIOKg0uDaSyPipGuDQoxMDEsjlKTY5G+mFksg4SDfYNfIINeg42DRSyJY4vGDQo=",
      expected: "抽選番号,氏名,フリガナ,所属"
    },
    {
      language: "ko",
      base64: "ufjIoyzAzLinDQoxLLHouc689g0K",
      expected: "번호,이름"
    },
    {
      language: "en",
      base64: "koqRSZTUjYYsjoGWvCyDdIOKg0uDaSyPipGuDQoxMDEsjlKTY5G+mFksg4SDfYNfIINeg42DRSyJY4vGDQo=",
      expected: "抽選番号,氏名,フリガナ,所属"
    },
    {
      language: "en",
      base64: "ufjIoyzAzLinDQoxLLHouc689g0K",
      expected: "번호,이름"
    }
  ];

  for (const fixture of fixtures) {
    const buffer = Buffer.from(fixture.base64, "base64");
    const arrayBuffer = bufferToArrayBuffer(buffer);
    api.state.language = fixture.language;
    const decoded = await api.readCsvFile({
      arrayBuffer: async () => arrayBuffer
    });
    assert(decoded.includes(fixture.expected), `${fixture.language} legacy CSV encoding should decode correctly`);
  }

  api.state.language = originalLanguage;
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

Promise.all([verifyLocalXlsx(), verifyLegacyCsvEncodings()])
  .then(([xlsxResults]) => {
    console.log("Verification passed");
    console.log(`Participants parsed: ${sampleParticipants.length}`);
    if (xlsxResults.length > 0) {
      xlsxResults.forEach((xlsxInfo) => {
        const expectedText = xlsxInfo.expectedFromFileName ? `, filename says ${xlsxInfo.expectedFromFileName}` : "";
        console.log(`Local XLSX parsed: ${xlsxInfo.participantCount} participants from ${xlsxInfo.rowCount} rows${expectedText}`);
        console.log(`Local XLSX columns: ${xlsxInfo.numberHeader} -> first No. ${xlsxInfo.firstDisplayNumber}, ${xlsxInfo.nameHeader} -> name`);
      });
    } else {
      console.log("Local XLSX parsed: skipped because no .xlsx file is present");
    }
    console.log(`First display name: ${sampleParticipants[0].englishName} / ${sampleParticipants[0].name}`);
    console.log("Use cases passed: English/Korean/Japanese localization, Korean and Japanese romanization, multilingual headers, Shift-JIS and EUC-KR CSV decoding, manual romanized-name override, XLSX parsing, adjustable draw count, sequential and simultaneous draws, absent replacement flows, restore absent, quoted CSV, export statuses");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
