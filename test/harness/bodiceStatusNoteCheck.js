// bodiceStatusNoteCheck.js — 몸판 상태 문구·완료 버튼 정합(2026-11-11 김님 실사용 «밑단·여밈 수정 뒤 몸판 모양 완료 비활성 · 문구 = 몸판 변경됨 다시 완료 필요»)
//   node test/harness/bodiceStatusNoteCheck.js
//   원인: ui.js updateBodiceCheckpointUI 가 완료본이 있고 변경됐으면 실제 check 결과와 무관하게 일괄 «변경됨 · 다시 완료 필요»로 덮어 차단 사유가 안 보였다.
//   §0 정적(버튼·문구 = 같은 bodiceStatusView) · §1–5 박시 A 곡선 밑단 → 완료 → 밑단/여밈 수정 → 사유·숫자 → 맞춤 → 다시 완료 · §6 순수 조합
//   설정(샌드박스·프로젝트·실제 그리기 경로)은 sideHemTaperCheck.js 와 같다. 표시만 검사 — 완료 게이트·형상 무변경.
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");

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
// 실제 경로: «선·곡선 그리기» → 점(Alt = 격자 흡착 없이 정확한 좌표) → Enter(완료 = 자동 선택) → «외곽» → «외곽 합성»
function drawBoundary(pc, pts, handles) {
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle();
  pts.forEach((q, i) => { if (handles && handles[i]) drag(pc, q, handles[i]); else click(pc, q, { altKey: true }); });
  key("Enter");
  const line = last();
  DLT.setRole("boundary");
  DLT.doComposeDesignOutline();
  return line;
}

// ── 독립 계측(엔진 코드 미사용 · 조밀 샘플) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const bez = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
function indLen(s) {
  if (s.kind === "line") return D(s.from, s.to);
  const q = [s.from, s.c1, s.c2, s.to]; let L = 0, pv = q[0];
  for (let i = 1; i <= 4000; i++) { const p = bez(q, i / 4000); L += D(pv, p); pv = p; }
  return L;
}
const indSide = outl => outl.filter(s => s.edge === "side-seam").reduce((a, s) => a + indLen(s), 0);
const effO = pc => (PROJECT.working.designOutline && PROJECT.working.designOutline[pc]) ? PROJECT.working.designOutline[pc].outline : PROJECT.working.geometry[pc].outline;
const SX = 23.053125;   // 몸판 Ⓐ 앞·뒤 옆선 x(형상 cm) · y 20.617 → 38(기본) → 58(허리 아래 연장)

const HEM_Y = 58;
const effSide = pc => effO(pc).filter(s => s.edge === "side-seam");
const mine = (pc, id) => effO(pc).filter(s => s.edgeSourceLineId === id);
const keptHem = pc => effO(pc).filter(s => s.edge === "hem");
// 실제 경로: 그리기(Alt = 정확 좌표) → Enter(자동 선택) → «몸판 외곽으로 반영»
function taper(pc, pts, handles) {
  if (DLT.getMode() !== "off") DLT.setMode("off");
  DLT.toggle();
  pts.forEach((q, i) => { if (handles && handles[i]) drag(pc, q, handles[i]); else click(pc, q, { altKey: true }); });
  key("Enter");
  const ok_ = DLT.doReflectToBodice();
  return { line: last(), ok: ok_ };
}
const note = () => el("designComposeNote").textContent || "";

// ── ui.js 실제 함수(소스에서 추출 · 제품 코드와 같은 본문) ──
const UI_SRC = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
const cut = (from, to) => { const a = UI_SRC.indexOf(from), b = UI_SRC.indexOf(to, a); return (a >= 0 && b > a) ? UI_SRC.slice(a, b) : ""; };
const SRC_FAIL = cut("  function bodiceFailStr(", "  window.bodiceFailText");
const SRC_VIEW = cut("  function bodiceStatusView(", "  // refresh 에서 읽기 전용");
const SRC_PK = cut("  function effectiveFrontOutline(", "  // 유효 외곽이 바뀐 뒤");
ok(SRC_FAIL && SRC_VIEW && SRC_PK, "0: ui.js 에서 bodiceFailStr·bodiceStatusView·computeFrontPlacket 추출");
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "designPlacket.js"), "utf8"), sb, { filename: "designPlacket.js" });
vm.runInContext("var window = this.window;\n" + SRC_FAIL + SRC_VIEW + SRC_PK.replace(/  function setPlacketNote[^\n]*\n/, "") +
  "\nthis.__fail = bodiceFailStr; this.__view = bodiceStatusView; this.__placket = computeFrontPlacket;", sb, { filename: "ui.js#bodiceStatus" });
const FAILT = sb.__fail, VIEW = sb.__view, PLACKET = sb.__placket;
// updateBodiceCheckpointUI 와 같은 호출(버튼 disabled = !view.canComplete · 문구 = view.text)
const ui = () => { const c = BC.check(PROJECT), latest = BC.latest(PROJECT), v = VIEW(c, !!latest, !!(latest && BC.isCurrentBodiceChanged(PROJECT)), FAILT, latest && latest.sourceVersion); return { c: c, text: v.text, disabled: !v.canComplete }; };

// ── 정적: 상태 문구·버튼이 같은 view 에서 나온다 · 옛 일괄 문구 제거 ──
const UPD = cut("  function updateBodiceCheckpointUI(", "  function onCompleteBodice(");
ok(/const view = bodiceStatusView\(c, !!latest, !!\(latest && window\.bodiceCheckpoint\.isCurrentBodiceChanged\(project\)\), bodiceFailStr/.test(UPD)
  && /btn\.disabled = !view\.canComplete/.test(UPD) && /statusNote\.textContent = view\.text/.test(UPD), "0: updateBodiceCheckpointUI = 버튼·문구 모두 bodiceStatusView(같은 check 결과)");
ok(UI_SRC.indexOf('"몸판 변경됨 · 다시 완료 필요 · 세션 전용"') < 0, "0: 변경됨 상태에서 차단 사유를 덮던 일괄 문구 제거");

// ══ 김님 실사용 경로 재현: 박시 A 앞·뒤 곡선 밑단(중심 → 옆선 50) 반영 → 몸판 완료 → 앞 밑단만 수정 → 차단 사유 · 앞뒤 맞춤 → 다시 완료 가능 · 여밈 → 다시 완료 ══
{
  const FH = [{ x: 47.5, y: HEM_Y }, { x: 35, y: 57.2 }, { x: SX, y: 50 }], FHh = [null, { x: -4, y: -0.6 }, null];
  const BH = [{ x: 0, y: HEM_Y }, { x: 12, y: 57.2 }, { x: SX, y: 50 }], BHh = [null, { x: 4, y: -0.6 }, null];
  projectOn("A");
  const src0 = J(PROJECT.sourceBlock), ref0 = J(PROJECT.referenceGeometry), geom0 = J(PROJECT.working.geometry);
  let u = ui();
  ok(!u.disabled && u.text === "완료 가능 · 세션 전용", "1: 시작(원형 그대로) = 완료 가능");
  const tf = taper("front", FH, FHh);
  u = ui();
  ok(tf.ok && u.disabled && u.c.fails.join() === "side-seam-mismatch" && /^완료 전 검사\(1건\): /.test(u.text) && u.text.indexOf("지금 옆선 앞 " + u.c.sideSeam.front.toFixed(2) + " · 뒤 " + u.c.sideSeam.back.toFixed(2)) > 0,
    "1: 앞만 반영(완료본 없음) = 차단 · 사유 + 옆선 숫자 — " + u.text.slice(0, 60));
  const tb = taper("back", BH, BHh);
  u = ui();
  ok(tb.ok && u.c.ok && !u.disabled && u.text === "완료 가능 · 세션 전용", "1: 뒤도 같은 높이 = 완료 가능(버튼 활성)");
  ok(BC.complete(PROJECT).ok, "1: 몸판 모양 완료");
  const done1 = J(PROJECT.working.bodiceResult);
  u = ui();
  ok(!u.disabled && /^몸판 완료됨\(원형 v2\)/.test(u.text), "1: 완료 직후 = 완료됨");

  // 앞 밑단만 수정(선 삭제 → 옆선 접점 48 로 다시 반영) — 앞·뒤 옆선이 달라짐
  DLT.setMode("off"); DLT.toggleSelect(); click("front", { x: 35, y: 57.2 }); key("Delete"); DLT.setMode("off");
  const tf2 = taper("front", [FH[0], FH[1], { x: SX, y: 48 }], FHh);
  u = ui();
  ok(tf2.ok && BC.isCurrentBodiceChanged(PROJECT) && !u.c.ok && u.disabled, "2: 완료 뒤 앞 밑단만 수정 = 변경됨 · 실제 차단(c.ok=false) · 버튼 비활성");
  ok(/^몸판 변경됨\(완료본과 다름\) · 다시 완료 전 검사\(1건\): 앞·뒤 옆선 봉제 길이 차 > 0\.3cm/.test(u.text) && u.text.indexOf("지금 옆선 앞 " + u.c.sideSeam.front.toFixed(2) + " · 뒤 " + u.c.sideSeam.back.toFixed(2) + " · 뒤−앞 +2.00cm") > 0 && /고친 뒤 «몸판 모양 완료»/.test(u.text),
    "2: 변경됨이어도 실제 사유 + 앞·뒤·차 숫자 + 고칠 곳 — " + u.text);
  ok(u.text.indexOf("다시 완료 필요 · 세션 전용") < 0, "2: 사유를 덮는 일괄 «다시 완료 필요» 아님");
  ok(J(PROJECT.working.bodiceResult) === done1, "2: 완료본 불변(수정만으로 바뀌지 않음)");

  // 뒤도 같은 높이로 맞춤 → 검사 통과 → 다시 완료 가능
  DLT.setMode("off"); DLT.toggleSelect(); click("back", { x: 12, y: 57.2 }); key("Delete"); DLT.setMode("off");
  taper("back", [BH[0], BH[1], { x: SX, y: 48 }], BHh);
  u = ui();
  ok(u.c.ok && !u.disabled && BC.isCurrentBodiceChanged(PROJECT) && u.text === "몸판 변경됨(완료본과 다름) · 검사 통과 — «몸판 모양 완료»로 다시 완료할 수 있습니다 · 세션 전용",
    "3: 앞뒤 맞춤 = 변경됨 · 검사 통과 · 다시 완료 가능(버튼 활성 = c.ok)");

  // 여밈 1.2/1.2(ui.js computeFrontPlacket 그대로) — 검사에 영향 없음 · 변경됨 · 다시 완료 가능
  const before = J(u.c.fails), pk = PLACKET(PROJECT, { overlapCm: 1.2, facingWidthCm: 1.2, lengthMode: "full" });
  u = ui();
  ok(pk.ok && PROJECT.working.frontPlacket && J(u.c.fails) === before && u.c.ok && !u.disabled && /검사 통과 — «몸판 모양 완료»로 다시 완료할 수 있습니다/.test(u.text), "4: 여밈 1.2/1.2 적용 = 차단 사유 변화 없음 · 다시 완료 가능");
  const r2 = BC.complete(PROJECT);
  u = ui();
  ok(r2.ok && !BC.isCurrentBodiceChanged(PROJECT) && /^몸판 완료됨/.test(u.text) && J(PROJECT.working.bodiceResult) !== done1, "4: 다시 완료 → 완료됨(새 완료본)");
  ok(J(PROJECT.sourceBlock) === src0 && J(PROJECT.referenceGeometry) === ref0 && J(PROJECT.working.geometry) === geom0, "4: 원본 source·reference·working geometry 불변");

  // 여밈 뒤 앞 밑단만 다시 수정 → 변경됨 + 실제 사유(여밈은 사유가 아님)
  DLT.setMode("off"); DLT.toggleSelect(); click("front", { x: 35, y: 57.2 }); key("Delete"); DLT.setMode("off");
  taper("front", FH, FHh);
  PLACKET(PROJECT, { overlapCm: 1.2, facingWidthCm: 1.2, lengthMode: "full" });   // = refreshFrontPlacket
  u = ui();
  ok(!u.c.ok && u.disabled && u.c.fails.join() === "side-seam-mismatch" && /^몸판 변경됨\(완료본과 다름\) · 다시 완료 전 검사\(1건\)/.test(u.text) && u.text.indexOf("뒤−앞 −2.00cm") > 0,
    "5: 여밈 있는 완료본 뒤 앞 밑단 수정 = 변경됨 + 옆선 사유·숫자 (" + u.text.slice(0, 50) + "…)");
  DLT.setMode("off");
}

// ══ 순수 view 정합: 모든 조합에서 버튼 활성 = c.ok · 상태와 사유를 따로 ══
{
  const mk = (ok_, fails, ss) => ({ ok: ok_, fails: fails, sideSeam: ss || { status: "match", front: 30, back: 30 } });
  const cases = [[mk(true, []), false, false], [mk(true, []), true, true], [mk(true, []), true, false],
    [mk(false, ["front-outline-not-connected", "side-waist-dart-attachment"]), true, true],
    [mk(false, ["side-seam-unmeasured"], { status: "unmeasured", front: null, back: null }), true, true],
    [mk(false, ["side-seam-mismatch"], { status: "mismatch", front: 29.37, back: 37.38 }), false, false]];
  ok(cases.every(k => VIEW(k[0], k[1], k[2], FAILT, 2).canComplete === k[0].ok), "6: 모든 조합 버튼 활성 = c.ok");
  const v4 = VIEW(cases[3][0], true, true, FAILT, 2).text;
  ok(v4.indexOf("앞판 외곽이 연결되지 않음") > 0 && v4.indexOf("옆허리 다트 c 허리 부착 불일치") > 0 && /다시 완료 전 검사\(2건\)/.test(v4) && v4.indexOf("지금 옆선") < 0, "6: 변경됨 + 옆선 외 사유 2건 전부(옆선 숫자 없음)");
  const v5 = VIEW(cases[4][0], true, true, FAILT, 2).text;
  ok(/다시 완료 전 검사\(1건\)/.test(v5) && v5.indexOf("지금 옆선") < 0, "6: 측정 불가 = 사유만(가짜 숫자 없음)");
  ok(VIEW(cases[5][0], false, false, FAILT, 2).text.indexOf("지금 옆선 앞 29.37 · 뒤 37.38 · 뒤−앞 +8.01cm") > 0, "6: 미완료 옆선 차단도 앞·뒤·차 숫자");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
