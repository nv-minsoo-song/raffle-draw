const fs = require("fs");
const vm = require("vm");

function makeElement() {
  return {
    textContent: "",
    value: "",
    disabled: false,
    innerHTML: "",
    files: [],
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    addEventListener() {},
    setAttribute() {},
    appendChild() {},
    append() {},
    remove() {},
    click() {}
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const html = fs.readFileSync("index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
assert(scriptMatch, "Could not find inline script in index.html");

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
    getItem: () => null,
    setItem() {}
  },
  document: {
    getElementById: () => makeElement(),
    querySelectorAll: () => [makeElement(), makeElement()],
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
  state,
  parseCsv,
  readXlsxRows,
  normalizeParticipants,
  getHeaderInfo,
  romanizeKoreanName,
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
  const xlsxFiles = fs.readdirSync(".").filter((fileName) => fileName.toLowerCase().endsWith(".xlsx"));

  if (xlsxFiles.length === 0) {
    return null;
  }

  const xlsxFile = xlsxFiles[0];
  const buffer = fs.readFileSync(xlsxFile);
  const rows = await api.readXlsxRows(bufferToArrayBuffer(buffer));
  const participants = api.normalizeParticipants(rows);
  const firstParticipant = participants[0];

  assert(rows.length >= 900, "Local XLSX should include the expected large worksheet");
  assert(participants.length >= 900, "Local XLSX should parse hundreds of named participants");
  assert(firstParticipant.number !== "652178", "Local XLSX should not use IDX as the display raffle number");
  assert(firstParticipant.number === "1107", "Local XLSX should use 행운권 추첨번호 as the display number");
  assert(firstParticipant.name === "서바다", "Local XLSX first named participant should parse from 이름");
  assert(participants.some((participant) => participant.name === "Kai Cheung Ng" && participant.englishName === "Kai Cheung Ng"), "Non-Hangul names should stay readable as-is");

  return {
    fileName: xlsxFile,
    rowCount: rows.length,
    participantCount: participants.length,
    firstDisplayNumber: firstParticipant.number
  };
}

function bufferToArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

verifyLocalXlsx()
  .then((xlsxInfo) => {
    console.log("Verification passed");
    console.log(`Participants parsed: ${sampleParticipants.length}`);
    if (xlsxInfo) {
      console.log(`Local XLSX parsed: ${xlsxInfo.participantCount} participants from ${xlsxInfo.rowCount} rows`);
      console.log(`Local XLSX first display number: ${xlsxInfo.firstDisplayNumber}`);
    } else {
      console.log("Local XLSX parsed: skipped because no .xlsx file is present");
    }
    console.log(`First display name: ${sampleParticipants[0].englishName} / ${sampleParticipants[0].name}`);
    console.log("Use cases passed: auto romanization, manual English Name override, XLSX parsing, raffle-number header preference, non-Hangul name passthrough, adjustable draw count, sequential 3-winner draw, simultaneous 3-winner draw, simultaneous 7-winner draw, one-absent-from-3-with-replacement, two-absent-from-7-with-replacements, absent-and-redraw, restore absent, 3-final-winners-after-absent, quoted CSV, export statuses");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
