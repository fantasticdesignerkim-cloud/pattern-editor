// ══════════════════════════════════════════════
// collarNoneCheck.js — 1차 디자인 UI ①~④(2026-11-19 사용자 승인) 최소 회귀. 실제 엔진(stub 없음) + index.html 정적 검사.
//   §1 기존 카라(M) 완료 → Design 완료 → 재단 ready(카라 조각 있음) · 기존 카라 완료본의 designResult.hash 공식 무변경
//   §2 «카라 없음» 적용 → 카라 초안·완료본 잔존 없음 → 몸판·소매 검사만으로 Design 완료 → 재단 ready(카라 조각·카라 누락 없음)
//   §3 저장 → 빈 세션 열기 → «카라 없음» 선택·완료 상태 유지 · 재단 조각 바이트 동일
//   §4 다른 카라(M)로 전환 → «카라 없음» 해제 → Design 다시 완료 필요(카라 완료 전 거부) → 카라·Design 재완료
//   §5 미적용(키 없음)·기존 프로젝트 = 지금까지처럼 «카라 완료 필요»
//   §6 index.html: «Design 형상 완료»가 카라 탭 밖(디자인 제목 옆) · ID 1개 · 버튼 문구 · 선택 화면 표시 이름 동명 없음
//   node test/harness/collarNoneCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("collarNoneCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
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
const SLEEVE_EXTRA = (() => { const out = [];
  "BCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(k => { const R0 = path.join(ROOT, "js"); if (fs.existsSync(path.join(R0, "designSleeve" + k + ".js"))) out.push("designSleeve" + k + ".js"); out.push("sleeve" + k + "Apply.js"); });
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
  const S = { W, BW: W.blockWorkflow, DW: W.designWorkflow, DB: W.designBodice, BP: W.bodicePresets, BC: W.bodiceCheckpoint, SC: W.sleeveCheckpoint,
    DC: W.designCollar, CP: W.collarPresets, CC: W.collarCheckpoint, DR: W.designResult, DLy: W.designLayout, PF: W.projectFile, CUT: W.cutPrep, DCF: W.designCuff };
  S.P = () => S.DW.current();
  W.projectSessionUI = { snapshot: () => ({ stage: "design", subtab: "collar" }), unfinished: () => [], afterRestore() {} };
  return S;
}
const presetOf = (S, sym) => { for (const f of S.BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function start(S) {
  const P = S.DW.startFromBlock(S.BW.complete()), body = S.BP.bodyParams(presetOf(S, "A"));
  P.working.parameters.neckline = { mode: "parametric", type: "original", parameters: {} };
  P.working.parameters.body = body;
  P.working.geometry = Object.assign({}, S.DB.computeGeometry(P.referenceGeometry, { body }), { sleeve: P.working.geometry.sleeve });
  P.working.designOutline = null; P.working.frontPlacket = null;
  S.DLy.ensureLayout(P);
  return P;
}
// ui.js onCollarBaseM 과 같은 상태 변화(composeDraft → 원자 교체 → «카라 없음» 해제)
function applyCollarM(S) { const P = S.P(), plan = S.CP.composeDraft("bunka-shirt-collar-M", S.BC.latest(P), S.DC); if (plan.ok) { P.working.collarDraft = plan.draft; S.CC.clearNone(P); } return plan; }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
const ids = d => (d.pieces || []).map(p => p.id).join(",");

let TEXT = null, D_NONE = null;
const S = makeSession(), P = start(S);
// ══ §1 기존 카라 ══
{
  ok(S.BC.complete(P).ok, "1: 몸판 완료");
  const ra = S.W.sleeveAApply.apply(P, { sleeveLengthCm: 52, cuff: S.DCF.defaults() }); ok(ra && ra.ok, "1: 소매 Ⓐ");
  ok(S.SC.complete(P).ok, "1: 소매 완료");
  ok(S.CC.isNone(P) === false && !("collarChoice" in P.working), "5: 미적용 = collarChoice 키 없음");
  const c0 = S.DR.check(P); ok(!c0.ok && c0.fails.indexOf("no-collar") >= 0, "5: 미적용 = 기존처럼 «카라 완료 필요»");
  ok(applyCollarM(S).ok && S.CC.complete(P).ok, "1: 카라 M 적용·완료");
  const r = S.DR.complete(P); ok(r.ok && r.result.collar && !("collarChoice" in r.result), "1: Design 완료(카라 포함 · collarChoice 키 없음)");
  const R = P.working.designResult, sig = J({ bh: R.bodiceHash, sh: R.sleeveHash, ch: R.collarHash, cuts: [] });
  ok(R.structuralLines.cut.length === 0 && R.hash === hashStr(sig), "1: 기존 카라 완료본 hash 공식 무변경(키 추가 없음)");
  const d = S.CUT.derive(P); ok(d.state === "ready" && /collar-stand/.test(ids(d)), "1: 재단 ready · 카라 조각 있음 (" + ids(d) + ")");
}
// ══ §2 «카라 없음» ══
{
  const oldHash = P.working.designResult.hash;
  // 위 칼라 직접 수정(manual) 중이어도 «카라 없음 적용» = 명시 승인 → 관리선까지 제거(ui.js onCollarBodyManual 과 같은 상태 변화)
  { const cd = P.working.collarDraft, lc = cd && cd.body && cd.body.geometry ? S.DC.collarBodyLineFromGeometry(cd.body.geometry) : null;
    ok(!!lc, "2: 위 칼라 관리선 변환 가능");
    if (lc) { const ls = P.working.patternLines || (P.working.patternLines = []), id = S.W.designLineTool.nextId(ls);
      ls.push({ id: id, piece: "collar", role: "boundary", managedBy: "collar-body", segments: lc.segments });
      cd.body.mode = "manual"; cd.body.lineId = id; cd.body.invalid = false; cd.body.manualLocked = lc.locked; } }
  ok(P.working.collarDraft.body.mode === "manual" && P.working.patternLines.some(l => l.managedBy === "collar-body"), "2: 직접 수정 상태 준비");
  ok(S.CC.chooseNone(P).ok, "2: «카라 없음» 적용(직접 수정 중에도)");
  ok(P.working.collarChoice === "none" && P.working.collarDraft === null && P.working.collarResult === null, "2: 카라 초안·완료본 잔존 없음");
  ok(!(P.working.patternLines || []).some(l => l && (/collar/.test(String(l.managedBy || "")) || l.piece === "collar")), "2: 카라 관리선(직접 수정 선 포함) 잔존 없음");
  ok(/T\.setMode\("off"\)/.test(fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8").split("function onApplyCollarNone")[1].split("function onApplyCollar()")[0]), "2: ui «카라 없음 적용» = 기존 종료 API(setMode off)로 선택·편집 해제");
  ok(S.CC.latest(P) === null && S.CC.check(P).ok === false, "2: 카라 완료 단계 없음(카라 완료 불가 · 불필요)");
  const dC = S.CUT.derive(P); ok(dC.state === "changed" && !dC.pieces, "2: 이전 Design 완료본 = 변경됨(재단 불가 · 다시 완료 필요)");
  ok(/디자인 제목 옆/.test(dC.reason) && !/카라 탭/.test(dC.reason), "2: 재단 안내가 «카라 탭» 대신 디자인 제목 옆을 가리킴 (" + dC.reason + ")");
  const c = S.DR.check(P); ok(c.ok && c._collarNone === true && c._collar === null, "2: 몸판·소매 검사만으로 Design 완료 가능");
  const r = S.DR.complete(P); ok(r.ok && r.result.collar === null && r.result.collarHash === null && r.result.collarChoice === "none" && r.result.hash !== oldHash, "2: Design 완료(카라 null · collarChoice none · 새 hash)");
  ok(S.DR.isCurrentDesignChanged(P) === false, "2: 완료 직후 변경됨 아님");
  const d = S.CUT.derive(P); D_NONE = J(d);
  ok(d.state === "ready" && !/collar/.test(ids(d)) && !d.missing.some(m => /^collar/.test(m.id)), "2: 재단 ready · 카라 조각·카라 누락 없음 (" + ids(d) + ")");
  const built = S.PF.buildFileText({ savedAt: "2026-11-19T00:00:00.000Z" }); TEXT = built.text;
  ok(built.status.collar.none === true && built.status.design.completed === true && built.status.design.changed === false, "3: 저장 status = 카라 없음 · Design 완료");
}
// ══ §3 저장 → 열기 ══
{
  const S2 = makeSession(), v = S2.PF.verifyText(TEXT);
  ok(v.ok, "3: 열기 검증 (" + (v.reason || "") + " " + (v.detail || "") + ")");
  S2.PF.commitCandidate(v.candidate);
  const P2 = S2.P();
  ok(S2.CC.isNone(P2) && P2.working.collarDraft === null && P2.working.collarResult === null, "3: 열기 후 «카라 없음» 선택 유지");
  ok(S2.DR.isCurrentDesignChanged(P2) === false && P2.working.designResult.collarChoice === "none", "3: 열기 후 Design 완료 유지");
  ok(J(S2.CUT.derive()) === D_NONE, "3: 복원 세션 재단 조각 = 저장 전과 바이트 동일");
  // 변조: «카라 없음»과 카라 초안 공존 → 열기 거부
  const bad = S2.PF.verifyText(TEXT.replace('"collarChoice":"none"', '"collarChoice":"other"'));
  ok(!bad.ok, "3: 변조 파일 거부 (" + bad.reason + ")");
}
// ══ §4 다른 카라로 전환 ══
{
  const noneHash = P.working.designResult.hash;
  ok(applyCollarM(S).ok && !("collarChoice" in P.working), "4: 카라 M 적용 → «카라 없음» 해제");
  const c = S.DR.check(P); ok(!c.ok && c.fails[0] === "no-collar", "4: 카라 완료 전 Design 완료 거부");
  ok(S.CUT.derive(P).state === "changed", "4: 재단 = 변경됨");
  ok(S.CC.complete(P).ok && S.DR.complete(P).ok && P.working.designResult.hash !== noneHash && !!P.working.designResult.collar, "4: 카라·Design 재완료 → 카라 포함 새 완료본");
  ok(S.CUT.derive(P).state === "ready", "4: 재단 ready");
}
// ══ §6 index.html 정적 ══
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const iBtn = html.indexOf('id="btnCompleteDesign"'), iTabs = html.indexOf('id="designSubtabs"'), iCollar = html.indexOf('data-subtab="collar"'), iCollarEnd = html.indexOf("<!-- /subtab collar -->");
  ok(iBtn > 0 && html.indexOf('id="btnCompleteDesign"', iBtn + 1) < 0, "6: btnCompleteDesign 1개");
  ok(iBtn < iTabs && !(iBtn > iCollar && iBtn < iCollarEnd), "6: «Design 형상 완료»가 카라 탭 밖 · 서브탭 앞(디자인 제목 옆)");
  ["designResultCheckNote", "designResultStatusNote", "cutPrepNote"].forEach(id => { const i = html.indexOf('id="' + id + '"'); ok(i > 0 && i < iTabs, "6: " + id + " 공통 위치"); });
  ok(/id="btnApplyCollarBody">카라 본체 적용</.test(html), "6: «카라 본체 적용»");
  // 선택 화면 표시 이름: 선행 표식 제거 뒤 같은 목록 안 동명 없음(있으면 ui.js 가 원래 문구로 되돌린다 — 여기선 현재 데이터가 충돌 없음을 확인)
  const LEAD = /^\s*(?:[A-Za-z]|[Ⓐ-ⓩ])\s*·\s*/;
  const SS = makeSession();
  [["몸판", SS.W.bodicePresets], ["소매", SS.W.sleevePresets], ["카라", SS.W.collarPresets]].forEach(([nm, M]) => {
    const fams = M.families(), flab = fams.map(f => f.label);
    ok(new Set(flab).size === flab.length, "6: " + nm + " 종류 이름 동명 없음");
    fams.forEach(f => {
      const labs = M.variantOptions(f.id).map(o => o.label.replace(LEAD, ""));
      ok(new Set(labs).size === labs.length && labs.every(l => l && !LEAD.test(l)), "6: " + nm + " " + f.label + " 세부 제도 표시 이름 동명 없음");
    });
  });
}

console.log("collarNoneCheck: " + PASS + " pass, " + FAIL + " fail");
fails.slice(0, 30).forEach(f => console.log("  ✗ " + f));
process.exit(FAIL ? 1 : 0);
