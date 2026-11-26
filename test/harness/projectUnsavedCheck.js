// ══════════════════════════════════════════════
// projectUnsavedCheck.js — 저장하지 않은 작업 보호 + 64MB UTF-8 바이트 제한 (2026-11-26)
//   §1 UTF-8 바이트 길이(한글 3바이트·이모지 4바이트·짝 없는 대리) = 실제 인코더와 일치
//   §2 64MB 경계: 문자 수는 한도 미만이어도 바이트가 넘으면 too-large · 정확히 한도는 통과(그 뒤 다른 사유로 거절)
//   §3 미저장 변경: 시작 직후 깨끗 · 편집 → 변경됨 · 저장 성공 → 깨끗 · 저장 실패 → 기준 유지 · 열기 성공/실패
//   §4 beforeunload: 변경 있을 때만 막고(preventDefault), 깨끗하면 건드리지 않음
//   node test/harness/projectUnsavedCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("projectOpenRaceCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
const J = JSON.stringify, ROOT = path.join(__dirname, "..", "..");
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const SNAPSHOT = () => ({ schemaVersion: 8,
  source: { measurements: { B: 83, W: 64, BL: 38, SL: 52, Hem: 30, capAdj: 0, capFormula: "bunka", dartTotal: 12 }, handles: { armH: null, fArmH: null, bNeckH: null, fNeckH: null, sleeveH: null }, appliedDarts: { front: null, back: null } },
  geometry: Object.assign(JSON.parse(J(REF)), { sleeve: REFSLEEVE() }) });
const SLEEVE_EXTRA = (() => { const fs0 = require("fs"), p0 = require("path"), out = [];
  "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(k => { const R0 = p0.join(__dirname, "..", "..", "js"); if (fs0.existsSync(p0.join(R0, "designSleeve" + k + ".js"))) out.push("designSleeve" + k + ".js"); out.push("sleeve" + k + "Apply.js"); });
  return out; })();
const FILES = ["blockWorkflow.js", "designProject.js", "sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "sleeveOutlineEdit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js",
  "designPlacket.js", "designBodice.js", "bodicePresets.js", "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js",
  "designSleeveA.js", "designCuff.js", "sleeveAApply.js", "sleeveAnnotation.js", "designCollar.js", "collarPresets.js", "collarCheckpoint.js", "designResult.js", "projectFile.js", "seamMatch.js", "seamAllowance.js", "cutPrep.js"].concat(SLEEVE_EXTRA);
const SRC = {}; FILES.forEach(f => { SRC[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });

function makeSession() {
  const ELS = {};
  const el = id => { if (!ELS[id]) ELS[id] = { id, textContent: "", value: "", disabled: false, hidden: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; }, getAttribute(k) { return this.attrs[k]; } }; return ELS[id]; };
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String, Map, Set, WeakMap,
    setTimeout: () => 0, clearTimeout: () => {},
    c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1, eventToPatternPoint: e => [e.px, e.py], render: () => {},
    svg: { addEventListener() {}, setPointerCapture() {}, releasePointerCapture() {} },
    document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el, addEventListener() {} } };
  sb.globalThis = sb; vm.createContext(sb);
  sb.window.isDesignStageActive = () => true; sb.window.addEventListener = () => {}; sb.window.refreshDesignResultUI = () => {};
  sb.captureBlockSnapshot = () => SNAPSHOT();
  FILES.forEach(f => vm.runInContext(SRC[f], sb, { filename: f }));
  const W = sb.window; W.designLineQuickBar = { sync() {} };
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint, SP: W.sleevePresets, DPL: W.designPlacket,
    DC: W.designCollar, CP: W.collarPresets, CC: W.collarCheckpoint, DR: W.designResult, DLT: W.designLineTool, DLy: W.designLayout, PF: W.projectFile, SM: W.seamMatch, CUT: W.cutPrep, SA: W.designSleeveA, DCF: W.designCuff };
  S.P = () => S.DW.current(); S.sandboxDoc = sb.document; S.sb = sb;
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "collar" }), unfinished: () => [], afterRestore() {} };
  return S;
}
const presetOf = (S, sym) => { for (const f of S.BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
// ui.js computeFrontPlacket 과 같은 상태 변화(유효 앞 외곽 → designPlacket.compute → working.frontPlacket)
function setPlacket(S, overlap, facing) {
  const P = S.P(), params = { overlapCm: overlap, facingWidthCm: facing, lengthMode: "full" }, r = S.DPL.compute(S.BC.effectiveOutline(P, "front"), params);
  if (!r.ok) return r;
  P.working.frontPlacket = { parameters: { overlapCm: overlap, facingWidthCm: facing, lengthMode: "full" }, outline: r.outline, construction: r.construction };
  return { ok: true };
}
function start(S) {
  const P = S.DW.startFromBlock(S.BW.complete()), body = S.BP.bodyParams(presetOf(S, "A"));
  P.working.parameters.neckline = { mode: "parametric", type: "original", parameters: {} };
  P.working.parameters.body = body;
  P.working.geometry = Object.assign({}, S.DB.computeGeometry(P.referenceGeometry, { body }), { sleeve: P.working.geometry.sleeve });
  P.working.designOutline = null; P.working.frontPlacket = null;
  S.DLy.ensureLayout(P);
  return P;
}
const flush = () => new Promise(r => setImmediate(r));

const mk = () => { const S = makeSession(); S.DW.startFromBlock(S.BW.complete()); return S; };
(async () => {
  // §1
  { const S = makeSession(), U = S.PF.utf8ByteLength, enc = s => Buffer.byteLength(s, "utf8");
    const samples = ["", "abc", "가나다", "é", "😀", "a😀가", "\ud800", "x\udc00y", "\ud83d", "ab\ud83dc"];
    samples.forEach((s, i) => ok(U(s) === enc(s), "1: utf8ByteLength 샘플 " + i + " (" + U(s) + " vs " + enc(s) + ")"));
    ok(S.PF.MAX_BYTES === 64 * 1024 * 1024, "1: MAX_BYTES = 64MiB"); }
  // §2
  { const S = makeSession(), M = S.PF.MAX_BYTES, k = Math.floor(M / 3), rest = M - 3 * k;   // 가×k + 영문 rest = 정확히 M 바이트
    const exact = "가".repeat(k) + "a".repeat(rest), over = exact + "a";
    ok(Buffer.byteLength(exact, "utf8") === M && exact.length < M, "2: 픽스처 = 정확히 한도 바이트 · 문자 수는 한도 미만");
    const rOver = S.PF.verifyText(over), rExact = S.PF.verifyText(exact);
    ok(!rOver.ok && rOver.reason === "too-large", "2: 한도 +1바이트(문자 수는 한도 미만) = too-large (" + rOver.reason + ")");
    ok(!rExact.ok && rExact.reason !== "too-large", "2: 정확히 한도 = 크기로는 통과(다른 사유로 거절: " + rExact.reason + ")"); }
  // §3
  { const S = mk(), PF = S.PF;
    ok(PF.hasUnsavedChanges() === true, "3: 기준점이 없는 프로젝트 = 안전쪽 «변경됨»(실제 앱은 ui 시작 훅이 markSaved 로 기준을 잡는다)");
    PF.markSaved(); ok(PF.hasUnsavedChanges() === false, "3: markSaved 직후 깨끗");
    PF.hasUnsavedChanges(); ok(PF.hasUnsavedChanges() === false, "3: 반복 검사해도 깨끗(지문 부작용 없음)");
    S.P().working.parameters.body = { bustEaseCm: 7 };
    ok(PF.hasUnsavedChanges() === true, "3: 디자인 데이터 편집 → 변경됨");
    // 저장 성공(다운로드 클릭까지)
    let clicks = 0; const sb = S.sb;
    sb.Blob = function () {}; sb.URL = { createObjectURL: () => "blob:x", revokeObjectURL() {} };
    sb.document.createElement = () => ({ click() { clicks++; }, remove() {}, set href(v) {}, get href() { return "blob:x"; } });
    sb.document.body = { appendChild() {} };
    PF.onSave();
    ok(clicks === 1 && PF.hasUnsavedChanges() === false, "3: 저장 성공 → 깨끗 (clicks=" + clicks + ")");
    S.P().working.parameters.body = { bustEaseCm: 8 };
    ok(PF.hasUnsavedChanges() === true, "3: 저장 뒤 다시 편집 → 변경됨");
    // 저장 실패(미완성 작업 있음) → 기준 유지
    S.W.projectSessionUI.unfinished = () => ["테스트 미적용 입력"];
    PF.onSave(); ok(clicks === 1 && PF.hasUnsavedChanges() === true, "3: 저장 실패(마무리하지 않은 작업) → 변경됨 유지");
    S.W.projectSessionUI.unfinished = () => [];
    // UI 전용 값은 지문 밖
    PF.onSave(); ok(PF.hasUnsavedChanges() === false, "3: 재저장 → 깨끗");
    S.W.projectSessionUI.snapshot = () => ({ stage: "design", subtab: "sleeve" });
    ok(PF.hasUnsavedChanges() === false, "3: 화면 탭 값 변경은 미저장 변경이 아님"); }
  // §3b 열기: 깨끗한 세션에 열기 성공 → 깨끗 · 실패 → 기준 유지
  { const A = mk(); A.PF.markSaved(); const text = A.PF.buildFileText({ savedAt: "2026-11-26T00:00:00.000Z" }).text;
    const S = mk(); S.PF.markSaved(); S.P().working.parameters.body = { bustEaseCm: 9 };
    ok(S.PF.hasUnsavedChanges() === true, "3b: 편집됨");
    S.PF.onOpenFile({ value: "x", files: [{ size: 10, text: () => Promise.resolve("{broken") }] }); await flush();
    ok(S.PF.hasUnsavedChanges() === true, "3b: 열기 실패(깨진 파일) → 변경됨 유지");
    S.PF.onOpenFile({ value: "x", files: [{ size: text.length, text: () => Promise.resolve(text) }] }); await flush();
    S.PF.onConfirmOpen(); await flush();
    ok(S.PF.hasUnsavedChanges() === false, "3b: 열기 성공 → 새 기준(깨끗)"); }
  // §4
  { const S = mk(), PF = S.PF; let pd = 0; const ev = { preventDefault() { pd++; }, returnValue: undefined };
    PF._onBeforeUnload(ev); ok(pd === 1, "4: 기준점 없는 프로젝트 = 안전쪽으로 닫기 경고");
    PF.markSaved(); pd = 0; const ev2 = { preventDefault() { pd++; }, returnValue: undefined };
    ok(PF._onBeforeUnload(ev2) === undefined && pd === 0 && ev2.returnValue === undefined, "4: 깨끗하면 경고 없음");
    S.P().working.parameters.body = { bustEaseCm: 7 };
    const ev3 = { preventDefault() { pd++; }, returnValue: undefined }; PF._onBeforeUnload(ev3);
    ok(pd === 1 && ev3.returnValue === "", "4: 변경 있으면 경고");
    const S2 = makeSession(); const ev4 = { preventDefault() { pd++; } }; pd = 0; S2.PF._onBeforeUnload(ev4);
    ok(pd === 0, "4: 디자인 프로젝트가 없으면 경고 없음"); }
  // §5 소매 «적용» 안내 = 실제 적용 판정 공유(정적 배선 검사 — ui.js 는 브라우저 전용이라 소스에서 확인)
  { const ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
    const a = ui.slice(ui.indexOf("function syncSleeveApplyTarget"), ui.indexOf("function syncSleeveButtons")), b = ui.slice(ui.indexOf("function onApplySleeve()"), ui.indexOf("function onApplySleeve()") + 1400);
    ok(/function sleeveApplyRoute\(project\)/.test(ui) && /sleeveApplyRoute\(project\)/.test(a) && /sleeveApplyRoute\(project\) === "preset"/.test(b), "5: 안내와 실제 «소매 적용» 이 같은 분기 함수(sleeveApplyRoute)를 쓴다");
    ok(/sleevePresets\.resolve\(fid, vid\)\.ok\) t = "«소매 적용»: 위에서 고른 라인을 적용합니다/.test(a) && /아직 제도할 수 없어 적용되지 않습니다/.test(a), "5: «적용합니다» 안내는 resolve().ok 일 때만 — 준비 중·보류 라인은 «적용되지 않습니다»"); }
  console.log("projectUnsavedCheck: " + PASS + " pass, " + FAIL + " fail");
  if (FAIL) { fails.forEach(f => console.log(" FAIL " + f)); process.exit(1); }
})();
