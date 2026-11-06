// sideSeamMagnetCheck.js — 몸판 옆선 «길이 맞춤 자석» + «의도적인 여유량»(2026-11-06 김님 승인 설계).
//   node test/harness/sideSeamMagnetCheck.js
//
//   §1 순수 엔진: 의도 입력 정규화·거부 · 목표(앞 기준/뒤 기준 · 0/앞 여유/뒤 여유) · 등위선 사영 · 획득/해제(히스테리시스) · 불가능 사유
//   §2 옆선 의미 승계(실제 경로: 그리기 → 완료 → «외곽» → 합성): 순수 옆선 대체 = side-seam 승계 · 진동/밑단 걸침 = 승계 없음 + 측정 불가 사유
//      · 앞·뒤 직선/곡선 호 길이 = 엔진과 독립 검산 · 미설정 = check 출력·hash 종전과 같음
//   §3 자석 드래그(실제 핸들러): 중간 점·곡선 핸들 스냅(정확히 목표) · 해제 · Alt/끔/기준판/끝점 = 스냅 없음 · 고정점·기준판 불변 · 자기교차 없음
//      · 손 뗀 뒤 권위 계측 잔차 0 → 몸판 완료
//   §4 의도 게이트: 잔차 0.1/0.3 경계 · 목표 일치/불일치 · 입력 거부 시 무변경 · 의도 변경 = hash 변경·재완료 · 옛 완료본 자동 정상화 없음
//      · 같은 길이 = 미설정 hash · 소매 완료본 무효화(출처 hash)
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

// §1 순수 엔진
{
  const n = M.normalizeIntent;
  ok(n({ mode: "equal" }).ok && n({ mode: "equal" }).intent === null, "1: 같은 길이 = 저장 없음(null)");
  ok(J(n({ mode: "back-ease", easeCm: 2 }).intent) === J({ mode: "back-ease", easeCm: 2 }), "1: 뒤판 여유 2");
  ok(J(n({ mode: "front-ease", easeCm: "1.25" }).intent) === J({ mode: "front-ease", easeCm: 1.25 }), "1: 문자열 숫자 입력 허용(UI)");
  [[{ mode: "back-ease", easeCm: -1 }, "intent-ease-nonpositive"], [{ mode: "back-ease", easeCm: 0 }, "intent-ease-nonpositive"], [{ mode: "back-ease", easeCm: "abc" }, "intent-ease-nan"],
   [{ mode: "back-ease", easeCm: "" }, "intent-ease-nan"], [{ mode: "back-ease", easeCm: NaN }, "intent-ease-nan"], [{ mode: "back-ease", easeCm: Infinity }, "intent-ease-nan"],
   [{ mode: "front-ease", easeCm: 10.01 }, "intent-ease-range"], [{ mode: "both", easeCm: 1 }, "intent-mode"], [null, "intent-mode"]]
    .forEach(([inp, code]) => { const r = n(inp); ok(!r.ok && r.reason === code && r.text, "1: 입력 거부 " + J(inp) + " → " + code); });
  ok(M.validStored(undefined).ok && M.validStored({ mode: "back-ease", easeCm: 2 }).ok && !M.validStored({ mode: "back-ease", easeCm: 2, x: 1 }).ok && !M.validStored({ mode: "back-ease", easeCm: -2 }).ok && !M.validStored("x").ok, "1: 저장값 검증");
  // 목표: 뒤 − 앞 = D
  const bE = { mode: "back-ease", easeCm: 2 }, fE = { mode: "front-ease", easeCm: 2 };
  ok(M.targetFor("front", 40, null) === 40 && M.targetFor("back", 40, null) === 40, "1: 같은 길이 목표 = 기준판 길이(앞 기준/뒤 기준)");
  ok(M.targetFor("back", 40, bE) === 42 && M.targetFor("front", 42, bE) === 40, "1: 뒤판 여유 2 — 뒤 편집 목표 = 앞+2 · 앞 편집 목표 = 뒤−2");
  ok(M.targetFor("front", 40, fE) === 42 && M.targetFor("back", 42, fE) === 40, "1: 앞판 여유 2 — 앞 편집 목표 = 뒤+2 · 뒤 편집 목표 = 앞−2");
  ok(/뒤판 여유 2\.00cm\(뒤 − 앞 = \+2\.00\)/.test(M.intentText(bE)) && /앞판 여유 2\.00cm\(뒤 − 앞 = −2\.00\)/.test(M.intentText(fE)), "1: 부호를 오해하지 않는 문구");
  // 등위선 사영: f = 원점 거리 → 반지름 5 원
  const f = q => Math.hypot(q.x, q.y);
  const pr = M.projectToLevel(f, 5, { x: 3, y: 4.3 });
  ok(pr.ok && Math.abs(f(pr.point) - 5) < 1e-7 && D(pr.point, { x: 3 * 5 / Math.hypot(3, 4.3), y: 4.3 * 5 / Math.hypot(3, 4.3) }) < 1e-6, "1: 사영 = 커서에 가장 가까운 등위점");
  // 획득 10px · 해제 16px (pxToCm 0.1 → 1cm · 1.6cm)
  const dec = (cur, locked) => M.decide({ f: f, T: 5, cursor: cur, pxToCm: 0.1, locked: locked });
  ok(dec({ x: 0, y: 5.9 }, false).snapped && !dec({ x: 0, y: 6.1 }, false).snapped, "1: 획득 문턱 10px");
  ok(dec({ x: 0, y: 6.5 }, true).snapped && !dec({ x: 0, y: 6.7 }, true).snapped, "1: 해제 문턱 16px(히스테리시스)");
  ok(dec({ x: 0, y: 5.9 }, false).point && Math.abs(f(dec({ x: 0, y: 5.9 }, false).point) - 5) < 1e-7, "1: 붙으면 정확히 목표 길이");
  ok(M.decide({ f: f, T: 5, cursor: { x: 0, y: 5.5 }, pxToCm: 0.1, minLen: 5.2 }).reason === "too-short", "1: 목표 < 최소 가능 길이 = too-short");
  ok(M.decide({ f: () => 3, T: 5, cursor: { x: 0, y: 0 }, pxToCm: 0.1 }).reason === "degenerate", "1: 길이가 안 변하는 자유도 = degenerate(스냅 없음)");
  ok(M.decide({ f: f, T: 5, cursor: { x: 0, y: 5.5 }, pxToCm: 0.1, valid: () => ({ ok: false, reason: "self-cross" }) }).reason === "self-cross", "1: 무효 형상 = 스냅 없음 + 사유");
  ok(M.reasonText("too-short") && M.reasonText("kept-cross") && M.reasonText("no-converge"), "1: 사유 문구");
}

// §2 실제 경로 · 의미 승계 · 독립 호 길이
{
  projectOn("A");
  const c0 = BC.check(PROJECT);
  ok(J(Object.keys(c0.sideSeam)) === J(["front", "back", "diff", "status"]) && c0.sideSeam.status === "match", "2: 미설정 check.sideSeam = 종전 4키");
  const h0 = BC.complete(PROJECT).result.hash;
  ok(!("sideSeamIntent" in PROJECT.working.bodiceResult), "2: 미설정 완료본에 의도 키 없음");
  // 앞: 옆선 안쪽 구간(y 24 → 34)을 곡선으로(중간 점 하나)
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.2, y: 29 }, { x: SX, y: 34 }]);
  const fo = effO("front"), mine = fo.filter(s => s.edgeSourceLineId === fl.id);
  ok(PROJECT.working.designOutline && mine.length === 2 && mine.every(s => s.edge === "side-seam" && s.edgeInherited === true && !("edgeStatus" in s)), "2: 순수 옆선 대체 → side-seam 승계 (" + J(mine.map(s => [s.edge, s.edgeStatus])) + ")");
  const c1 = BC.check(PROJECT).sideSeam;
  ok(c1.status !== "unmeasured" && Math.abs(c1.front - indSide(fo)) < 1e-9 && Math.abs(c1.back - indSide(effO("back"))) < 1e-9, "2: 직선 앞·뒤 호 길이 = 독립 검산");
  const expectF = (37.38333333333334 - 10) + 2 * Math.hypot(SX - 22.2, 5);
  ok(Math.abs(c1.front - expectF) < 1e-9, "2: 앞 = 남은 옆선 + 새 두 직선(" + c1.front.toFixed(4) + ")");
  ok(BC.isCurrentBodiceChanged(PROJECT), "2: 옆선 수정 → 몸판 변경됨");
  // 곡선(핸들) — 뒤판
  const bl = drawBoundary("back", [{ x: SX, y: 26 }, { x: SX, y: 36 }], [{ x: -1.2, y: 2 }, { x: 0.8, y: 2 }]);
  const bo = effO("back"), bm = bo.filter(s => s.edgeSourceLineId === bl.id);
  ok(bm.length >= 1 && bm.some(s => s.kind === "cubic") && bm.every(s => s.edge === "side-seam"), "2: 뒤 곡선 대체선 승계");
  const c2 = BC.check(PROJECT).sideSeam;
  ok(Math.abs(c2.back - indSide(bo)) < 2e-3 && Math.abs(c2.front - indSide(effO("front"))) < 1e-9, "2: 곡선 호 길이 독립 검산(24분할 권위 vs 4000분할 · 차 " + Math.abs(c2.back - indSide(bo)).toExponential(1) + ")");
  // 걸침(옆선 + 밑단): 승계 없음 → 측정 불가 사유(남은 조각만 더한 틀린 수치 금지)
  projectOn("A");
  drawBoundary("front", [{ x: SX, y: 50 }, { x: 26, y: 58 }]);
  const fo2 = effO("front"), mx = fo2.filter(s => s.edgeStatus === "unresolved");
  ok(mx.length === 1 && J(mx[0].replacedEdges) === J(["hem", "side-seam"]) && !("edge" in mx[0]), "2: 옆선+밑단 걸침 = unresolved + replacedEdges");
  const c3 = BC.check(PROJECT);
  ok(c3.sideSeam.status === "unmeasured" && J(c3.sideSeam.unmeasuredReasons) === J(["front:side-seam-partially-unresolved"]) && c3.fails.indexOf("side-seam-unmeasured") >= 0, "2: 걸침 = 측정 불가·완료 차단(사유)");
  DLT.setMode("select"); DLT.setMode("off");
  const st = (() => { DLT.toggleSelect(); click("front", { x: 24.5, y: 54 }); const s = DLT.getSeamState(); DLT.setMode("off"); return s; })();
  ok(st && st.magnet.active === false && /다른 외곽\(hem\)/.test(st.magnet.reason), "2: 걸침 선 = 자석 없음 + 이유 (" + (st && st.magnet.reason) + ")");
  // 진동선을 대체(옆선 무관) = 승계·표시 없음
  projectOn("A");
  const ah = PROJECT.working.geometry.front.outline.filter(s => s.edge === "armhole")[0];
  ok(!!ah, "2: 진동 구간 있음");
  // 미설정 hash 종전 그대로(새 프로젝트 · 수정 없음)
  projectOn("A");
  ok(BC.complete(PROJECT).result.hash === h0, "2: 미설정 완료 hash 재현");
}

// §3 자석 드래그
function setupEqual() {   // 뒤: 곡선 대체(기준판 · 고정) → 앞: 중간 점 하나 대체선(편집 대상)
  projectOn("A");
  drawBoundary("back", [{ x: SX, y: 26 }, { x: SX, y: 36 }], [{ x: -1.2, y: 2 }, { x: 0.8, y: 2 }]);
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.6, y: 29 }, { x: SX, y: 34 }]);
  DLT.setMode("off"); DLT.toggleSelect(); click("front", { x: 22.6, y: 29 });   // 선택
  return fl;
}
// 같은 x 위의 목표 점(독립 이분법): 앞 길이 = 남은 + 2·hypot(SX−x, 5)
function solveX(T, K) { let lo = SX - 4, hi = SX; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (K + 2 * Math.hypot(SX - m, 5) > T) lo = m; else hi = m; } return (lo + hi) / 2; }
{
  const fl = setupEqual();
  ok(DLT.getSelectedId() === fl.id, "3: 앞 대체선 선택");
  const st = DLT.getSeamState();
  ok(st && st.magnet.active === true && /옆선 앞 .* 뒤 .* 목표 ±0\.00/.test(st.text), "3: 막대 표시 = 실제 앞·뒤 길이·목표·잔차 (" + (st && st.text) + ")");
  const backBefore = J(effO("back")), geomBefore = J(PROJECT.working.geometry);
  const T = BC.check(PROJECT).sideSeam.back, K = 37.38333333333334 - 10;
  const xT = solveX(T, K);
  // 중간 점 드래그: 목표 x 에서 0.6cm(6px) 떨어진 곳 → 붙음
  const e0 = evAt("front", { x: 22.6, y: 29 }); down(e0);
  move(evAt("front", { x: xT - 0.6, y: 29.03 }, { clientX: e0.clientX + 30 }));
  const live = DLT.getSeamLive();
  ok(live && live.snapped && Math.abs(live.len - T) < 1e-6, "3: 획득 — 정확히 목표 길이 (" + (live && live.text) + ")");
  ok(DLT.getSnapHint() && DLT.getSnapHint().type === "seam", "3: 흡착 표시 = 옆선 목표 길이");
  // 해제: 1.3cm(13px) — 붙은 상태라 아직 유지(16px 해제) · 2.0cm(20px) — 떨어짐
  move(evAt("front", { x: xT - 1.3, y: 29.03 }, { clientX: e0.clientX + 40 }));
  ok(DLT.getSeamLive().snapped, "3: 13px — 히스테리시스로 유지");
  move(evAt("front", { x: xT - 2.0, y: 29.03 }, { clientX: e0.clientX + 50 }));
  ok(!DLT.getSeamLive().snapped && DLT.getSeamLive().remain > 0, "3: 20px — 해제 · 남은 차 표시(긴 쪽)");
  move(evAt("front", { x: xT - 1.3, y: 29.03 }, { clientX: e0.clientX + 60 }));
  ok(!DLT.getSeamLive().snapped, "3: 해제 뒤 13px = 획득 문턱(10px) 밖 → 안 붙음");
  move(evAt("front", { x: xT - 0.4, y: 28.8 }, { clientX: e0.clientX + 70 }));
  ok(DLT.getSeamLive().snapped, "3: 다시 가까이 → 재획득");
  ok(J(effO("back")) === backBefore, "3: 드래그 중 기준판 불변");
  const e1 = evAt("front", { x: xT - 0.4, y: 28.8 }, { clientX: e0.clientX + 80 }); up(e1);
  ok(DLT.getSeamLive() === null, "3: 손 떼면 드래그 표시 종료");
  const c = BC.check(PROJECT);
  ok(Math.abs(c.sideSeam.front - c.sideSeam.back) < 1e-6 && c.sideSeam.status === "match" && c.ok, "3: 권위 계측 잔차 " + Math.abs(c.sideSeam.front - c.sideSeam.back).toExponential(1) + " · 정합 · 완료 가능");
  const line = DLT.findLine(fl.id);
  ok(D(line.segments[0].from, { x: SX, y: 24 }) < 1e-12 && D(line.segments[1].to, { x: SX, y: 34 }) < 1e-12, "3: 끝점(외곽 연결점) 불변");
  ok(J(PROJECT.working.geometry) === geomBefore, "3: 원본 working geometry 불변(진동점·허리점·밑단 그대로)");
  const kept = effO("front").filter(s => s.edgeSourceLineId !== fl.id), keptRef = (() => { const P = projectOn("A"); return null; })();
  ok(kept.length > 0, "3: 유지 외곽 있음");
  ok(BC.complete(PROJECT).ok && PROJECT.working.bodiceResult && !("sideSeamIntent" in PROJECT.working.bodiceResult), "3: 몸판 완료(같은 길이 = 의도 키 없음)");
}
{
  // Alt = 흡착 해제 · 자석 끔 · 기준판(앞)이면 앞 편집에 자석 없음 · 끝점 = 자석 없음
  const fl = setupEqual(); const T = BC.check(PROJECT).sideSeam.back, xT = solveX(T, 37.38333333333334 - 10);
  const tryDrag = (extra, from) => { const e0 = evAt("front", from || { x: 22.6, y: 29 }); down(e0); move(evAt("front", { x: xT + 0.3, y: 29 }, Object.assign({ clientX: e0.clientX + 30 }, extra || {}))); const L = DLT.getSeamLive(), S = DLT.getSnapHint(); key("Escape"); up(e0); return { L, S }; };
  let r = tryDrag({ altKey: true });
  ok(r.L && !r.L.snapped && !r.S, "3: Alt = 자석 포함 모든 흡착 해제(길이 표시는 유지)");
  DLT.toggleSelect(); DLT.toggleSelect(); click("front", { x: 22.6, y: 29 });
  DLT.setSeamMagnet(false); r = tryDrag();
  ok(r.L && !r.L.snapped, "3: 자석 끔 = 스냅 없음");
  DLT.setSeamMagnet(true); click("front", { x: 22.6, y: 29 });
  DLT.setSeamBasis("front"); r = tryDrag();
  ok(r.L && !r.L.snapped, "3: 기준판 = 앞 → 앞 편집은 고정판 편집이라 스냅 없음");
  click("front", { x: 22.6, y: 29 });
  ok(/기준판\(앞\)은 고정/.test(DLT.getSeamState().magnet.reason), "3: 기준판 사유 문구");
  DLT.setSeamBasis("back");
  click("front", { x: 22.6, y: 29 });
  const e0 = evAt("front", { x: SX, y: 24 }); down(e0); move(evAt("front", { x: SX - 0.1, y: 24.5 }, { clientX: e0.clientX + 30 }));
  ok(DLT.getSeamLive() === null && (!DLT.getSnapHint() || DLT.getSnapHint().type !== "seam"), "3: 끝점 드래그 = 자석·길이 표시 없음(대체 구간 자체가 바뀜)");
  key("Escape"); up(e0);
  ok(DLT.getSeamSettings().on && DLT.getSeamSettings().basis === "back", "3: 설정 복귀");
}
{
  // 곡선 핸들 스냅 + 자기교차 없음 + 뒤 기준(앞 편집) / 앞 기준(뒤 편집)
  projectOn("A");
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: SX, y: 34 }], [{ x: -1.0, y: 2 }, { x: 0.6, y: 2 }]);
  DLT.setMode("off"); DLT.toggleSelect(); click("front", { x: 22.3, y: 29 });
  ok(DLT.getSelectedId() === fl.id, "3h: 앞 곡선 선택");
  DLT.setSeamBasis("front");   // 앞 고정 → 뒤를 앞에 맞춘다
  drawBoundary("back", [{ x: SX, y: 25 }, { x: SX, y: 35 }], [{ x: -0.3, y: 2 }, { x: 0.3, y: 2 }]);
  const bl = last(); DLT.setMode("off"); DLT.toggleSelect(); click("back", { x: SX - 0.15, y: 30 });
  ok(DLT.getSelectedId() === bl.id, "3h: 뒤 곡선 선택");
  const hs = DLT.handlesOf(bl)[0], frontBefore = J(effO("front"));
  const Tb = BC.check(PROJECT).sideSeam.front;
  // 핸들을 바깥쪽(−x)으로 천천히 끌며 처음 붙는 곳 찾기
  const e0 = evAt("back", hs.c); down(e0);
  let snappedAt = null;
  for (let k = 1; k <= 80 && !snappedAt; k++) { move(evAt("back", { x: hs.c.x - 0.05 * k, y: hs.c.y }, { clientX: e0.clientX + k })); const L = DLT.getSeamLive(); if (L && L.snapped) snappedAt = k; }
  const L = DLT.getSeamLive();
  ok(snappedAt && Math.abs(L.len - Tb) < 1e-6, "3h: 핸들 스냅 = 정확히 앞 길이 (" + (L && L.text) + ")");
  up(evAt("back", { x: hs.c.x - 0.05 * snappedAt, y: hs.c.y }, { clientX: e0.clientX + 200 }));
  const c = BC.check(PROJECT);
  ok(Math.abs(c.sideSeam.back - c.sideSeam.front) < 1e-6 && c.ok, "3h: 손 뗀 뒤 권위 잔차 " + Math.abs(c.sideSeam.back - c.sideSeam.front).toExponential(1));
  ok(J(effO("front")) === frontBefore, "3h: 기준판(앞) 불변");
  ok(PROJECT.working.designOutline && PROJECT.working.designOutline.back, "3h: 합성 유효(자기교차 없음 · 폐곡선)");
  DLT.setSeamBasis("back"); DLT.setMode("off");
}
{
  // 불가능: 중간 점 + 양옆 직선에서 목표가 곧게 편 길이보다 짧음
  projectOn("A");
  drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.0, y: 29 }, { x: SX, y: 34 }]);
  W.bodiceCheckpoint.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 1 });   // 앞 목표 = 뒤 − 1 < 곧은 옆선
  DLT.setMode("off"); DLT.toggleSelect(); click("front", { x: 22.0, y: 29 });
  const e0 = evAt("front", { x: 22.0, y: 29 }); down(e0); move(evAt("front", { x: SX - 0.05, y: 29 }, { clientX: e0.clientX + 30 }));
  const L = DLT.getSeamLive();
  ok(L && !L.snapped && L.reason === "too-short", "3i: 불가능 해 = 스냅 없음 + 사유 too-short (" + (L && L.text) + ")");
  key("Escape"); up(e0); DLT.setMode("off");
}

// §4 의도 게이트 · hash · 무효화
{
  projectOn("A");
  const h0 = (() => { const r = BC.complete(PROJECT); return r.result.hash; })();
  // 잔차 경계(실제 차 0): 뒤판 여유 e → 잔차 e
  [[0.1, "match", true], [0.2, "check", true], [0.3, "check", true], [0.31, "mismatch", false]].forEach(([e, s, okk]) => {
    ok(BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: e }).ok, "4: 의도 적용 " + e);
    const c = BC.check(PROJECT);
    ok(c.sideSeam.status === s && c.ok === okk && Math.abs(c.sideSeam.residual - e) < 1e-9 && c.sideSeam.targetDiff === e && c.sideSeam.signedDiff === 0, "4: 잔차 " + e + " → " + s + (okk ? " 완료 가능" : " 차단"));
  });
  // 입력 거부 = 무변경
  const before = J(PROJECT.working.sideSeamIntent);
  ["abc", -2, 0, 11].forEach(v => { const r = BC.setSideSeamIntent(PROJECT, { mode: "front-ease", easeCm: v }); ok(!r.ok && J(PROJECT.working.sideSeamIntent) === before, "4: 거부 " + v + " = 무변경(" + r.reason + ")"); });
  // 같은 길이 = 키 삭제 = 미설정 hash
  BC.setSideSeamIntent(PROJECT, { mode: "equal" });
  ok(!("sideSeamIntent" in PROJECT.working) && !BC.isCurrentBodiceChanged(PROJECT), "4: 같은 길이 = 미설정과 같음(완료본 변경 아님)");
  // 의도 지정 → 변경됨 · 옛 완료본 자동 정상화 없음 · 재완료 hash 다름
  const old = PROJECT.working.bodiceResult;
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 0.2 });
  ok(BC.isCurrentBodiceChanged(PROJECT) && BC.latest(PROJECT) === old && !("sideSeamIntent" in old), "4: 의도 변경 = 몸판 변경됨 · 옛 완료본 그대로");
  const r = BC.complete(PROJECT);
  ok(r.ok && r.result.hash !== h0 && J(r.result.sideSeamIntent) === J({ mode: "back-ease", easeCm: 0.2 }) && Object.isFrozen(r.result.sideSeamIntent), "4: 재완료 = 새 hash · 의도 동결 결속");
  ok(!BC.isCurrentBodiceChanged(PROJECT), "4: 재완료 뒤 변경 아님");
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 0.25 });
  ok(BC.isCurrentBodiceChanged(PROJECT), "4: 여유 cm 변경 = 변경됨");
  BC.setSideSeamIntent(PROJECT, { mode: "front-ease", easeCm: 0.2 });
  ok(BC.isCurrentBodiceChanged(PROJECT), "4: 부호(앞/뒤) 변경 = 변경됨");
  BC.setSideSeamIntent(PROJECT, { mode: "equal" });
  ok(BC.isCurrentBodiceChanged(PROJECT) && BC.complete(PROJECT).result.hash === h0, "4: 같은 길이로 되돌려 재완료 = 미설정 hash 그대로");
  // 손상된 저장값 = 완료 차단
  PROJECT.working.sideSeamIntent = { mode: "back-ease", easeCm: -1 };
  ok(BC.check(PROJECT).fails.indexOf("side-seam-intent-invalid") >= 0, "4: 손상 의도 = 완료 차단");
  delete PROJECT.working.sideSeamIntent;
}
{
  // 실제 차 2(뒤가 김): 미설정 = 불일치 차단 · 뒤판 여유 2 = 정합 · 앞판 여유 2 = 불일치(부호)
  projectOn("A");
  const bl = drawBoundary("back", [{ x: SX, y: 24 }, { x: 19.5, y: 29 }, { x: SX, y: 34 }]);
  DLT.setMode("off");
  const c0 = BC.check(PROJECT).sideSeam, gap = c0.back - c0.front;
  ok(gap > 0.31 && c0.status === "mismatch", "4b: 뒤가 " + gap.toFixed(3) + " 김 · 미설정 = 불일치");
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: Math.round(gap * 1e4) / 1e4 });
  let c = BC.check(PROJECT);
  ok(c.sideSeam.status === "match" && c.ok, "4b: 뒤판 여유 " + gap.toFixed(4) + " = 목표 일치 → 완료 가능");
  BC.setSideSeamIntent(PROJECT, { mode: "front-ease", easeCm: Math.round(gap * 1e4) / 1e4 });
  c = BC.check(PROJECT);
  ok(c.sideSeam.status === "mismatch" && !c.ok, "4b: 앞판 여유(부호 반대) = 불일치 차단");
  // 자석: 앞을 편집 → 앞 목표 = 뒤 − 2 (뒤판 여유 2)
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 2 });
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.9, y: 29 }, { x: SX, y: 34 }]);
  DLT.setMode("off"); DLT.toggleSelect(); click("front", { x: 22.9, y: 29 });
  const Bk = BC.check(PROJECT).sideSeam.back, T = Bk - 2, xT = solveX(T, 37.38333333333334 - 10);
  const st = DLT.getSeamState();
  ok(st && /목표 \+2\.00/.test(st.text), "4b: 막대 = 목표 뒤−앞 +2.00 (" + (st && st.text) + ")");
  const e0 = evAt("front", { x: 22.9, y: 29 }); down(e0); move(evAt("front", { x: xT - 0.5, y: 29 }, { clientX: e0.clientX + 30 }));
  ok(DLT.getSeamLive().snapped && Math.abs(DLT.getSeamLive().T - T) < 1e-9, "4b: 앞 목표 = 뒤 − 2 에 붙음");
  up(evAt("front", { x: xT - 0.5, y: 29 }, { clientX: e0.clientX + 40 }));
  c = BC.check(PROJECT);
  ok(Math.abs(c.sideSeam.residual) < 1e-6 && c.ok, "4b: 의도 잔차 " + c.sideSeam.residual.toExponential(1) + " → 완료 가능");
  const r = BC.complete(PROJECT);
  ok(r.ok && r.result.sideSeamIntent.easeCm === 2, "4b: 몸판 완료(뒤판 여유 2 결속)");
  // 소매 Ⓐ 완료 → 의도 변경 → 몸판 재완료 → 소매 완료본 출처 무효
  const SA = W.sleeveAApply, rec = W.sleevePresets.get("bunka-sleeve-A"), prm = {};
  rec.inputs.forEach(i => { prm[i.key] = typeof i.defaultValue === "number" ? i.defaultValue : 52; });
  const ap = SA.apply(PROJECT, prm), sc = ap && ap.ok ? SC.complete(PROJECT) : null;
  ok(sc && sc.ok && !SC.invalidatedByBodice(PROJECT), "4b: 소매 Ⓐ 완료(" + (sc ? sc.reason || "ok" : (ap && ap.reason)) + ")");
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 1.9 });
  ok(BC.isCurrentBodiceChanged(PROJECT), "4b: 의도 변경 → 몸판 변경됨");
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 2 });
  ok(!BC.isCurrentBodiceChanged(PROJECT) && !SC.invalidatedByBodice(PROJECT), "4b: 같은 의도로 되돌림 = 변경 아님");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
