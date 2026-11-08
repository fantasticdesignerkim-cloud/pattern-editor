// seamFitCheck.js — 옆선 «길이 맞춤»(2026-11-07 김님 승인 «자석 순간을 눈대중으로 찾아야만 완료» 해소) + 그리기 거부 안내.
//   node test/harness/seamFitCheck.js
//   §1 두 점 직선 = 자유도 없음 → 불가·다음 할 일 · §2 세 점 → 미리보기(불변) → 반영(정확히 목표) → 완료
//   §3 곡선 핸들 · 여유(뒤+/앞+) 목표 · §4 불가능(목표<직선)·기준판 고정·반영 전·취소·낡은 미리보기 · §5 원자성 · §6 그리기 거부 안내
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

// ══ 옆선 «길이 맞춤»(2026-11-07) ══
const S = () => DLT.getSeamFit();
const sel = (pc, g) => { DLT.setMode("off"); DLT.toggleSelect(); click(pc, g); };
const segsOf = id => J(lines().find(l => l.id === id).segments);
// 공통: 뒤 = 곡선 대체(앞보다 길다 · 기준) → 앞에 다양한 선
function base() {
  projectOn("A");
  drawBoundary("back", [{ x: SX, y: 26 }, { x: SX, y: 36 }], [{ x: -2.5, y: 2 }, { x: 1.5, y: 2 }]);
}

// §1 두 점 직선 = 자유도 없음 → 불가 + 다음 할 일 · 자석을 활성처럼 보이지 않음(dof 0)
{
  base();
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: SX, y: 34 }]);
  sel("front", { x: SX, y: 29 });
  ok(DLT.getSelectedId() === fl.id, "1: 앞 두 점 직선 선택");
  const f = S();
  ok(f && !f.ok && f.dof === 0 && /두 점 직선/.test(f.reason) && /3점 이상|곡선/.test(f.next), "1: 직선 두 점 = 불가 · 이유·다음 할 일 (" + (f && f.reason) + ")");
  ok(f.T > f.len, "1: 목표(뒤 길이) > 현재 앞 길이 — 수치 노출");
  const before = segsOf(fl.id);
  ok(DLT.previewSeamFit() === false && !DLT.getSeamFitPreview() && segsOf(fl.id) === before, "1: 미리보기 거부 · 선 불변");
  ok(DLT.applySeamFit().ok === false && segsOf(fl.id) === before, "1: 반영 거부 · 선 불변");
}

// §2 세 점 선 → 미리보기(형상 불변) → 반영(정확히 목표) → 몸판 완료
{
  base();
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.8, y: 29 }, { x: SX, y: 34 }]);
  sel("front", { x: 22.8, y: 29 });
  const geomBefore = J(PROJECT.working.geometry), backBefore = J(effO("back")), segBefore = segsOf(fl.id), dOBefore = J(PROJECT.working.designOutline);
  ok(BC.check(PROJECT).sideSeam.status === "mismatch" && !BC.check(PROJECT).ok, "2: 시작 = 옆선 불일치 · 완료 불가");
  const f = S();
  ok(f && f.ok && f.dof === 1, "2: 세 점 = 길이 맞춤 가능 (" + (f && f.reason) + ")");
  ok(DLT.previewSeamFit() === true, "2: 미리보기 생성");
  const pv = DLT.getSeamFitPreview();
  ok(pv && /중간 점/.test(pv.label) && pv.move > 0, "2: 후보 = 중간 점 이동(" + (pv && pv.label) + " " + (pv && pv.move.toFixed(3)) + "cm)");
  ok(segsOf(fl.id) === segBefore && J(PROJECT.working.designOutline) === dOBefore && J(PROJECT.working.geometry) === geomBefore, "2: 미리보기 중 형상·외곽·원래 형상 불변");
  const a0 = DLT.anchorsFromSegments(JSON.parse(segBefore)), a1 = DLT.anchorsFromSegments(pv.segments);
  ok(D(a0[0], a1[0]) < 1e-12 && D(a0[2], a1[2]) < 1e-12, "2: 끝점(외곽 연결점) 그대로");
  const r = DLT.applySeamFit();
  ok(r.ok, "2: 반영 성공 " + (r.reason || ""));
  const c = BC.check(PROJECT);
  ok(c.sideSeam.status === "match" && Math.abs(c.sideSeam.front - c.sideSeam.back) < 1e-5, "2: 권위 계측 = 정합(앞 " + c.sideSeam.front + " · 뒤 " + c.sideSeam.back + ")");
  ok(Math.abs(indSide(effO("front")) - c.sideSeam.front) < 1e-9 && Math.abs(indSide(effO("back")) - c.sideSeam.back) < 3e-3, "2: 독립 호 길이 검산(앞 직선 = 정확 · 뒤 곡선 = 권위 24분할 근사 오차 이내 — sideSeamMagnetCheck 와 같은 기준)");
  ok(J(effO("back")) === backBefore && J(PROJECT.working.geometry) === geomBefore, "2: 기준판(뒤)·원래 형상 불변");
  ok(!DLT.getSeamFitPreview(), "2: 반영 뒤 미리보기 없음");
  ok(c.ok && BC.complete(PROJECT).ok, "2: 몸판 모양 완료");
  ok(S().done === true, "2: 다시 보면 «길이 맞음»");
}

// §3 곡선(핸들) 선 · 여유(뒤 +1 / 앞 +0.5) 목표
{
  base();
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: SX, y: 34 }], [{ x: -0.5, y: 1.5 }, { x: 0.5, y: 1.5 }]);
  sel("front", { x: SX - 0.1, y: 27 });
  ok(DLT.getSelectedId() === fl.id, "3: 앞 곡선 선택");
  const f0 = S();
  ok(f0 && f0.ok && f0.dof >= 1, "3: 곡선 = 핸들 자유도로 가능 (" + (f0 && f0.reason) + ")");
  ok(BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 0.3 }).ok, "3: 뒤판 여유 0.3");
  const f1 = S();
  ok(f1.ok && Math.abs(f1.T - (BC.check(PROJECT).sideSeam.back - 0.3)) < 1e-9, "3: 목표 = 뒤 − 0.3(여유 반영)");
  ok(DLT.previewSeamFit() && DLT.applySeamFit().ok, "3: 미리보기 → 반영");
  const c = BC.check(PROJECT);
  ok(c.sideSeam.status === "match" && Math.abs((c.sideSeam.back - c.sideSeam.front) - 0.3) < 1e-5 && c.ok, "3: 뒤−앞 = +0.3 정합 · 완료 가능");
  ok(BC.setSideSeamIntent(PROJECT, { mode: "front-ease", easeCm: 0.5 }).ok && BC.check(PROJECT).sideSeam.status === "mismatch", "3: 앞판 여유 0.5 지정 → 불일치");
  ok(DLT.previewSeamFit() && DLT.applySeamFit().ok, "3: 다시 길이 맞춤");
  const c2 = BC.check(PROJECT);
  ok(c2.sideSeam.status === "match" && Math.abs((c2.sideSeam.back - c2.sideSeam.front) + 0.5) < 1e-5, "3: 뒤−앞 = −0.5 정합");
}

// §4 불가능(목표 < 고정 끝점 직선) · 기준판 고정 · 반영 전 · 취소 · 낡은 미리보기
{
  base();
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.8, y: 29 }, { x: SX, y: 34 }]);
  sel("front", { x: 22.8, y: 29 });
  const segBefore = segsOf(fl.id);
  ok(BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 3 }).ok, "4: 뒤판 여유 3(앞 목표가 곧은 옆선보다 짧아짐)");
  const f = S();
  ok(f && !f.ok && /불가능/.test(f.reason) && /짧음/.test(f.reason) && /자동으로 옮기지 않/.test(f.next), "4: 불가능 = 명시 (" + (f && f.reason) + ")");
  ok(!DLT.previewSeamFit() && segsOf(fl.id) === segBefore, "4: 불가능 = 미리보기 없음 · 선 불변");
  BC.setSideSeamIntent(PROJECT, { mode: "equal" });
  DLT.setSeamBasis("front");
  sel("front", { x: 22.8, y: 29 });
  const fb = S();
  ok(fb && !fb.ok && /기준판/.test(fb.reason), "4: 기준판(앞) 고정 = 불가 + 이유");
  DLT.setSeamBasis("auto");
  sel("front", { x: 22.8, y: 29 });
  ok(DLT.previewSeamFit(), "4: 미리보기");
  ok(DLT.cancelSeamFit() === true && !DLT.getSeamFitPreview() && segsOf(fl.id) === segBefore, "4: 취소 = 버림 · 선 불변");
  ok(DLT.previewSeamFit(), "4: 다시 미리보기");
  BC.setSideSeamIntent(PROJECT, { mode: "back-ease", easeCm: 0.2 });
  ok(!DLT.getSeamFitPreview() && DLT.applySeamFit().ok === false && segsOf(fl.id) === segBefore, "4: 의도가 바뀌면 미리보기 낡음 → 반영 거부 · 선 불변");
  BC.setSideSeamIntent(PROJECT, { mode: "equal" });
  // 반영 전(외곽 합성 전) 선
  projectOn("A");
  drawBoundary("back", [{ x: SX, y: 26 }, { x: SX, y: 36 }], [{ x: -1.2, y: 2 }, { x: 0.8, y: 2 }]);
  DLT.setMode("off"); DLT.toggle();
  [{ x: SX, y: 24 }, { x: 22.8, y: 29 }, { x: SX, y: 34 }].forEach(q => click("front", q, { altKey: true })); key("Enter");
  DLT.setRole("boundary");
  const fn = S();
  ok(fn && !fn.ok && /반영 전/.test(fn.reason) && /몸판 외곽으로 반영/.test(fn.next), "4: 외곽 합성 전 = «몸판 외곽으로 반영» 먼저 (" + (fn && fn.reason) + ")");
}

// §5 원자성: 반영 직후 권위 판정이 맞지 않으면 선·외곽·파트·미리보기 전부 이전 그대로
{
  base();
  const fl = drawBoundary("front", [{ x: SX, y: 24 }, { x: 22.8, y: 29 }, { x: SX, y: 34 }]);
  sel("front", { x: 22.8, y: 29 });
  const segBefore = segsOf(fl.id), dOBefore = J(PROJECT.working.designOutline);
  ok(DLT.previewSeamFit(), "5: 미리보기");
  W.bodiceCheckpoint = Object.assign({}, BC, { check: p => { const c = BC.check(p); c.sideSeam = Object.assign({}, c.sideSeam, { status: "mismatch" }); return c; } });   // 권위 판정 실패 주입
  const r = DLT.applySeamFit();
  W.bodiceCheckpoint = BC;
  ok(!r.ok && /맞지 않음/.test(r.reason), "5: 실패 사유 (" + r.reason + ")");
  ok(segsOf(fl.id) === segBefore && J(PROJECT.working.designOutline) === dOBefore, "5: 선·외곽 이전 그대로(원자적)");
}

// §6 그리기 거부 안내(다른 조각 클릭 = 점 안 찍힘 + 막대 안내) · 다음 점이 찍히면 지움
{
  projectOn("A");
  DLT.setMode("off"); DLT.toggle();
  click("front", { x: SX, y: 24 }, { altKey: true });
  ok(DLT.getDrawHint() === null, "6: 정상 점 = 안내 없음");
  const n0 = DLT.getDraft().anchors.length;
  click("back", { x: SX, y: 30 }, { altKey: true });
  ok(DLT.getDraft().anchors.length === n0 && /점이 찍히지 않음/.test(DLT.getDrawHint() || "") && /앞판 안/.test(DLT.getDrawHint()), "6: 다른 조각 클릭 = 점 안 찍힘 + 안내 (" + DLT.getDrawHint() + ")");
  click("front", { x: SX, y: 30 }, { altKey: true });
  ok(DLT.getDraft().anchors.length === n0 + 1 && DLT.getDrawHint() === null, "6: 다음 점이 찍히면 안내 지움");
  DLT.setMode("off");
  ok(DLT.getDrawHint() === null, "6: 그리기 밖 = 안내 없음");
}

// §7 실사용 재현(2026-11-07 UI): 세 점이 옆선 위 일직선(중간 점 흡착) · 앞판 +1 → 기울기 0 이어도 양쪽 후보 · «다른 후보» · 반영 → 정합
{
  projectOn("A");
  const fl = drawBoundary("front", [{ x: SX, y: 21 }, { x: SX, y: 29 }, { x: SX, y: 37 }]);
  sel("front", { x: SX, y: 29 });
  ok(BC.setSideSeamIntent(PROJECT, { mode: "front-ease", easeCm: 1 }).ok, "7: 앞판 여유 1");
  const f = S();
  ok(f && f.ok && f.count === 2, "7: 일직선 중간 점 = 양쪽 두 후보 (" + (f && (f.reason || f.count)) + ")");
  ok(DLT.previewSeamFit(), "7: 미리보기 1");
  const p1 = DLT.getSeamFitPreview();
  ok(DLT.previewSeamFit(true), "7: «다른 후보»");
  const p2 = DLT.getSeamFitPreview();
  ok(p1.index === 0 && p2.index === 1 && Math.sign(p1.to.x - SX) === -Math.sign(p2.to.x - SX) && Math.abs(p1.move - p2.move) < 1e-6, "7: 두 후보 = 옆선 양쪽 대칭 · 같은 이동량");
  ok(DLT.previewSeamFit(true) && DLT.getSeamFitPreview().index === 0, "7: 다시 누르면 처음 후보");
  const r = DLT.applySeamFit();
  const c = BC.check(PROJECT);
  ok(r.ok && c.sideSeam.status === "match" && Math.abs((c.sideSeam.back - c.sideSeam.front) + 1) < 1e-5 && c.ok, "7: 반영 → 뒤−앞 = −1 정합 · 완료 가능");
}

// §8 실사용 재현(2026-11-07 UI 390): 첫 점이 진동 곡선 시작점(23.053, 20.617)에 흡착 — 옆선 모서리(23.053125, 20.6167)와 3.56e-4 어긋남.
//   (종전: 바깥쪽 후보 = «앞판 외곽이 연결되지 않음»으로 제외) → 모서리 접점 결속 뒤: 두 후보 모두 통과 · 바깥쪽 반영 → 완료.
{
  projectOn("A");
  const fl = drawBoundary("front", [{ x: 23.053, y: 20.617 }, { x: SX, y: 29 }, { x: SX, y: 38 }]);
  sel("front", { x: SX, y: 29 });
  ok(BC.check(PROJECT).ok, "8: 시작 = 완료 가능(직선)");
  ok(BC.setSideSeamIntent(PROJECT, { mode: "front-ease", easeCm: 1 }).ok, "8: 앞판 여유 1");
  ok(S().ok && S().count === 2, "8: 기하 후보 2개");
  ok(DLT.previewSeamFit(), "8: 미리보기");
  const pv = DLT.getSeamFitPreview();
  // 모서리 접점 결속(§9) 이후: 바깥쪽 후보도 외곽 연결을 끊지 않음 → 두 후보 모두 사용 가능(제외 없음).
  ok(pv.count === 2 && !pv.dropped, "8: 모서리 접점 결속 뒤 = 두 후보 모두 완료 게이트 통과(제외 없음) (" + pv.count + " " + pv.dropped + ")");
  ok(DLT.previewSeamFit(true) && DLT.getSeamFitPreview().to.x < SX, "8: 바깥쪽 후보(«다른 후보»)");
  ok(DLT.applySeamFit().ok && BC.check(PROJECT).ok && BC.complete(PROJECT).ok, "8: 바깥쪽 후보 반영 → 몸판 완료(종전엔 «앞판 외곽이 연결되지 않음»)");
}

// §9 모서리 접점 결속(2026-11-07 · Codex/PM 승인): 진동 path 끝(원본 3자리 반올림) ↔ 옆선 시작·옆허리 다트 c apex 의 0.000356cm 차.
//   모서리 흡착 그대로(흡착 동작 무변경) 시작한 직선/3점/곡선 · 전체/부분 · 위→아래/아래→위 → 반영 → (가능한 목표) 길이 맞춤 → 완료.
//   독립 검증: 합성 외곽에 RING_EPS(0.02)보다 짧은 조각 없음 · 대체선 모서리 끝 = 옆선 원본 끝점(비트 동일) · 원본 형상 불변.
{
  const TOPY = 20.616666666666667, BOTY = 38;
  const cornerSnap = pc => DLT.snapForCursor({ x: 23.06, y: 20.62 }, pc, false, null);
  projectOn("A");
  const gs = J(PROJECT.working.geometry);
  const seamTop = pc => PROJECT.working.geometry[pc].outline.find(s => s.edge === "side-seam").from;
  const armEnd = pc => { const st = seamTop(pc), ends = []; PROJECT.working.geometry[pc].outline.filter(s => s.edge === "armhole" && s.kind === "path").forEach(a => { const cm = a.commands; ends.push(cm[0].points[0], cm[cm.length - 1].points.slice(-1)[0]); }); return ends.sort((u, v) => Math.hypot(u.x - st.x, u.y - st.y) - Math.hypot(v.x - st.x, v.y - st.y))[0]; };
  ["front", "back"].forEach(pc => {
    const sp = cornerSnap(pc), ae = armEnd(pc), st = seamTop(pc), gap = Math.hypot(ae.x - st.x, ae.y - st.y);
    ok(sp && sp.type === "endpoint" && sp.point.x === ae.x && sp.point.y === ae.y && gap > 3e-4 && gap < 4e-4, "9-" + pc + ": 모서리 흡착 = 진동 path 끝(흡착 무변경) · 옆선 시작과 " + gap.toExponential(2) + "cm");
  });
  const indepNoSliver = pc => { const o = PROJECT.working.designOutline[pc].outline; return o.every(sg => { const a = sg.from || (sg.commands && sg.commands[0].points[0]), b = sg.to || (sg.commands && sg.commands.slice(-1)[0].points.slice(-1)[0]); return !a || !b || Math.hypot(a.x - b.x, a.y - b.y) >= 0.02 || sg.kind === "path"; }); };
  const bndCornerExact = (pc, lineId) => { const o = PROJECT.working.designOutline[pc].outline.filter(sg => sg.edgeSourceLineId === lineId), st = seamTop(pc); return o.some(sg => (sg.from.x === st.x && sg.from.y === st.y) || (sg.to.x === st.x && sg.to.y === st.y)); };
  const cases = [
    ["front", "직선 2점 부분(위→아래)", c => [c, { x: SX, y: 33 }], null, null],
    ["back", "직선 2점 부분(위→아래)", c => [c, { x: SX, y: 36.7 }], null, null],
    ["back", "직선 2점 부분(아래→위)", c => [{ x: SX, y: 36.7 }, c], null, null],
    ["front", "3점 전체", c => [c, { x: SX, y: 29 }, { x: SX, y: BOTY }], { mode: "front-ease", easeCm: 1 }, true],
    ["back", "3점 전체(아래→위)", c => [{ x: SX, y: BOTY }, { x: SX, y: 29 }, c], { mode: "back-ease", easeCm: 1 }, true],
    ["front", "곡선 전체", c => [c, { x: SX, y: BOTY }], { mode: "front-ease", easeCm: 0.5 }, true, [{ x: -0.6, y: 2 }, { x: 0.6, y: 2 }]],
    ["back", "3점 부분 곡선", c => [c, { x: 22.4, y: 26 }, { x: SX, y: 33 }], null, true]
  ];
  cases.forEach(([pc, nm, mk, ease, fit, hd]) => {
    projectOn("A");
    const c = cornerSnap(pc).point, pts = mk(c);
    const fl = drawBoundary(pc, pts, hd);
    const lab = "9-" + pc + " " + nm;
    ok(PROJECT.working.designOutline && PROJECT.working.designOutline[pc] && (PROJECT.working.designOutline[pc].lineIds || []).indexOf(fl.id) >= 0, lab + ": 외곽 합성됨");
    ok(indepNoSliver(pc) && bndCornerExact(pc, fl.id), lab + ": 모서리 조각 없음 · 대체선 끝 = 옆선 원본 끝점(비트 동일)");
    const c0 = BC.check(PROJECT);
    ok(c0.fails.indexOf(pc + "-outline-not-connected") < 0, lab + ": 외곽 연결 (" + J(c0.fails) + ")");
    sel(pc, pts.length > 2 ? pts[1] : { x: SX, y: 30 });
    if (ease) BC.setSideSeamIntent(PROJECT, ease);
    if (fit) {
      const f = S();
      if (f && f.ok) { ok(DLT.previewSeamFit() && DLT.applySeamFit().ok, lab + ": 길이 맞춤 반영"); }
      else ok(f && (f.done || f.ok), lab + ": 길이 맞춤 가능/이미 맞음 (" + (f && f.reason) + ")");
    }
    const c1 = BC.check(PROJECT);
    ok(c1.ok && BC.complete(PROJECT).ok, lab + ": 몸판 완료 (" + J(c1.fails) + " " + c1.sideSeam.status + ")");
    ok(J(PROJECT.working.geometry) === gs, lab + ": 원본 형상 불변");
  });
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
