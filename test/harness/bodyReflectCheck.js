// bodyReflectCheck.js — «몸판 외곽으로 반영»(2026-11-06 김님 승인 UX): 선 그리기 → 한 번의 반영 → 몸판 모양 완료.
//   node test/harness/bodyReflectCheck.js
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");
//   클릭 전 몸판 불변 · 한 번에 역할+검증+합성(옆선 승계 재사용) · 최종 완료본 자동 생성 없음 · 실패 원자성 · 편집 자동 재합성 · 여유 의도 유지 · 기준판 auto 기본
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const ELS = {};
function el(id) { if (!ELS[id]) ELS[id] = { id, textContent: "", disabled: false, title: "", attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, removeAttribute(k) { delete this.attrs[k]; } }; return ELS[id]; }
let LOADING = null; const SVG_H = {}, DOC_H = {};
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, Promise, Number, String,
  c2p: (x, y) => [x * 10, y * 10], SC: 10, viewZ: 1,
  eventToPatternPoint: e => [e.px, e.py],
  render: () => {},
  svg: { addEventListener(t, f) { (SVG_H[LOADING + ":" + t] = SVG_H[LOADING + ":" + t] || []).push(f); }, setPointerCapture() {}, releasePointerCapture() {} },
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }), getElementById: el,
    addEventListener(t, f) { (DOC_H[LOADING + ":" + t] = DOC_H[LOADING + ":" + t] || []).push(f); } } };
sb.globalThis = sb; vm.createContext(sb);
sb.window.designWorkflow = { current: () => PROJECT };
sb.window.isDesignStageActive = () => true;
sb.window.addEventListener = () => {};
sb.window.refreshDesignResultUI = () => {};
const files = ["sideSeamMagnet.js", "designLineTool.js", "sleeveSplit.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js", "designSleeveA.js", "sleeveAApply.js"];
files.forEach(f => { LOADING = f; vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }); });
LOADING = null;
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, DLT = W.designLineTool, DLy = W.designLayout, M = W.sideSeamMagnet;
let BARSYNC = 0; W.designLineQuickBar = { sync() { BARSYNC++; } };
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REF_J = J(REF);
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29.5, y: 53 }, { x: 35, y: 56 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};
const bodicePreset = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectOn(sym) {
  const body = BP.bodyParams(bodicePreset(sym || "A"));
  PROJECT = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: Object.assign(JSON.parse(REF_J), { sleeve: REFSLEEVE() }),
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
  PROJECT.working.layout = { front: { dx: 40, dy: 5 }, back: { dx: 0, dy: 5 }, sleeve: { dx: 80, dy: 5 }, collar: { dx: 0, dy: 70 } };
  DLy.ensureLayout(PROJECT);
  return PROJECT;
}

// ── 실제 핸들러 ──
const H = t => (SVG_H["designLineTool.js:" + t] || []);
const KD = () => (DOC_H["designLineTool.js:keydown"] || []);
let CLX = 0;
function evAt(pc, geo, extra) {
  const L = DLy.ensureLayout(PROJECT), off = L[pc] || { dx: 0, dy: 0 };
  CLX += 100;
  return Object.assign({ button: 0, pointerId: 1, clientX: CLX, clientY: 0, altKey: false, shiftKey: false, px: geo.x + off.dx, py: geo.y + off.dy,
    target: { closest: () => ({ getAttribute: () => pc }) }, stopPropagation() {}, preventDefault() {} }, extra || {});
}
const down = e => H("pointerdown").forEach(f => f(e)), up = e => H("pointerup").forEach(f => f(e)), move = e => H("pointermove").forEach(f => f(e));
const key = k => KD().forEach(f => f({ key: k, target: {}, preventDefault() {} }));
const click = (pc, g, extra) => { const e = evAt(pc, g, extra); down(e); up(e); };
const drag = (pc, g, h) => { const e0 = evAt(pc, g); down(e0); const e1 = evAt(pc, { x: g.x + h.x, y: g.y + h.y }, { clientX: e0.clientX + 50 }); move(e1); up(e1); };
const lines = () => PROJECT.working.patternLines;
const last = () => lines()[lines().length - 1];

// ── drawFinish: 그리기 → Enter(완료·자동 선택). 역할 지정·합성은 하지 않는다 ──
function drawOnly(pc, pts) {
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle(); pts.forEach(q => click(pc, q, { altKey: true })); key("Enter"); return last();
}
const SX = 23.053125;
const QB = () => W.designLineQuickBar;
const snapState = () => J({ roles: lines().map(l => [l.id, l.role]), dO: PROJECT.working.designOutline, parts: PROJECT.working.parts, bp: PROJECT.working.boundaryPreview, br: PROJECT.working.bodiceResult || null });

// §1 클릭 전에는 몸판 불변 · 반영 상태 판정
projectOn("A");
const before = J(PROJECT.working.designOutline);
const fl = drawOnly("front", [{ x: SX, y: 24 }, { x: 22.2, y: 29 }, { x: SX, y: 34 }]);
ok(fl.role === "guide" && J(PROJECT.working.designOutline) === before, "1: 그리기 완료 직후 역할 자동 반영 없음 · 몸판 불변");
const rs = DLT.getReflectState();
ok(rs && rs.allowed === true && !rs.done, "1: 일반 앞판 선 → 반영 가능");
ok(!PROJECT.working.bodiceResult, "1: 반영 전 사용자 최종 완료 없음");

// §2 한 번의 반영 = 역할 + 검증 + 합성 · 완료본 자동 생성 없음 · 옆선 의미 승계
ok(DLT.doReflectToBodice() === true, "2: 반영 성공");
const flr = DLT.findLine(fl.id);
const fo = PROJECT.working.designOutline && PROJECT.working.designOutline.front;
ok(flr.role === "boundary" && fo && fo.lineIds.indexOf(fl.id) >= 0, "2: 역할=외곽 · designOutline 에 이 선 포함");
ok(fo.outline.filter(s => s.edgeSourceLineId === fl.id).every(s => s.edge === "side-seam" && s.edgeInherited === true), "2: 옆선 의미 승계 경로 재사용");
ok(!PROJECT.working.bodiceResult, "2: 반영이 최종 완료본을 만들지 않음");
ok(DLT.getReflectState().done === true && DLT.getReflectState().allowed === false, "2: 반영 후 상태 = done");
const s1 = DLT.getSeamState();
ok(s1 && s1.show && /옆선 앞 \d+\.\d\d · 뒤 \d+\.\d\d · 뒤−앞 [+−±]\d+\.\d\dcm/.test(s1.text) && !/목표|잔차|자석/.test(s1.text), "2: 팝업 옆선 행 = 앞·뒤·차 숫자 그대로(목표·자석 문구 없음 · 2026-11-08)");

// §3 반영한 선 편집 = 자동 재합성(다시 합성 불필요)
const gBefore = J(PROJECT.working.designOutline.front.outline);
const sel = DLT.getSelectedId();
ok(sel === fl.id, "3: 선 선택 유지");
fl.segments; // 앵커 이동은 핸들러 경로: 중간 점 드래그
const mid = { x: 22.2, y: 29 };
const e0 = evAt("front", mid), e1 = evAt("front", { x: 21.5, y: 29 }, { clientX: e0.clientX + 60 });
down(e0); move(e1); up(e1);
ok(J(PROJECT.working.designOutline.front.outline) !== gBefore && PROJECT.working.designOutline.front.lineIds.indexOf(fl.id) >= 0, "3: 편집 뒤 designOutline 자동 재합성");

// §4 실패 원자성: 닫힌 외곽을 만들지 못하는 선 → 아무것도 바뀌지 않음
projectOn("A");
const bad = drawOnly("front", [{ x: 5, y: 40 }, { x: 8, y: 44 }]);   // 외곽과 만나지 않는 선(내부)
const S0 = snapState();
const okBad = DLT.doReflectToBodice();
ok(okBad === false && snapState() === S0 && DLT.findLine(bad.id).role === "guide", "4: 대체 불가 선 = 역할·외곽·파트·완료 전부 불변");
ok(/반영 안 됨/.test(ELS["designComposeNote"] ? ELS["designComposeNote"].textContent : ""), "4: 실패 이유 표시");

// §5 지원 밖: 소매·카라 선 / 비앞뒤 = 상태 null
// §6 여유 의도는 선 편집·선 전환으로 초기화되지 않음(working 소유)
projectOn("A");
const r1 = BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 1 });
const a = drawOnly("front", [{ x: SX, y: 24 }, { x: 22.2, y: 29 }, { x: SX, y: 34 }]); DLT.doReflectToBodice();
const b = drawOnly("back", [{ x: SX, y: 26 }, { x: SX, y: 36 }]); DLT.doReflectToBodice();
const si = BC.sideSeamIntent(PROJECT);
ok(r1.ok && si.ok && si.intent && si.intent.mode === "back-ease" && si.intent.easeCm === 1, "6: 선 추가·전환·반영 뒤에도 사용자 여유 유지");
ok(DLT.getSeamSettings().basis === "auto", "6: 기본 기준판 = auto(편집 반대판 고정) · 몰래 변형 없음");
DLT.setSeamBasis("front"); ok(DLT.getSeamSettings().basis === "front", "6: 수동 기준판 설정 존중");
DLT.setSeamBasis("auto");

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
