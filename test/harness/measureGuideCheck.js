// measureGuideCheck.js — 옆선 길이 상시 표시 + 그리기 거리 안내(직선·가로/세로·선 따라·기존 선 따라) — 2026-11-08 김님 방향 전환
//   node test/harness/measureGuideCheck.js
//   §1 옆선 라벨 = bodiceCheckpoint 권위 계측(곡선·연장 포함 · 독립 호 길이) · 읽기 전용 · 측정 불가/다조각 = 사유(0 아님)
//   §2 기준점→커서 직선·가로/세로(화살표 부호) · snap/Alt/줌/offset · 곡선 호 ≠ 직선 · 시작점부터 누적
//   §3 기존 열린 선(외곽 같은 이름 구간·패턴선) 위 두 점 호 길이(독립 검산) · 다른 구간·닫힌 선 = 사유 · 형상 불변
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

const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const MG = () => DLT.getMeasureGuide();
const hover = (pc, g, extra) => move(evAt(pc, g, extra));
// 독립: path 의 k번째 C 구간을 4000 등분해 t0→t1 호 길이
function pathSpan(prim, k) { let cur = null, n = 0, out = null; prim.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { if (n === k) out = [cur, c.points[0], c.points[1], c.points[2]]; n++; cur = c.points[2]; } }); return out; }
function indArc(q, t0, t1) { let L = 0, pv = bez(q, t0); for (let i = 1; i <= 4000; i++) { const p = bez(q, t0 + (t1 - t0) * i / 4000); L += D(pv, p); pv = p; } return L; }

// ══ §1 옆선 길이 상시 표시 = 권위 계측(완료 판정과 같은 값) · 읽기 전용 ══
{
  projectOn("A");
  const before = J(PROJECT);
  const lb = DLT.sideSeamLabels(PROJECT), c = BC.check(PROJECT).sideSeam;
  ok(J(PROJECT) === before, "1: 라벨 계산은 읽기 전용(프로젝트 불변)");
  ok(lb && lb.front.length === c.front && lb.back.length === c.back, "1: 앞·뒤 값 = bodiceCheckpoint 권위 계측과 정확히 같음");
  ok(lb.front.text === "앞 옆선 " + c.front.toFixed(2) + "cm" && lb.back.text === "뒤 옆선 " + c.back.toFixed(2) + "cm", "1: 문구 «앞 옆선 00.00cm / 뒤 옆선 00.00cm» (" + lb.front.text + " / " + lb.back.text + ")");
  ok(Math.abs(lb.front.length - indSide(effO("front"))) < 2e-3 && Math.abs(lb.back.length - indSide(effO("back"))) < 2e-3, "1: 독립 호 길이(조밀 샘플)와 일치");
  ["front", "back"].forEach(pc => { const bb = DLy.bboxOf(PROJECT.working.geometry, pc), l = lb[pc];
    ok(l.at && (l.out === 1 || l.out === -1) && l.out === (l.at.x >= (bb.minX + bb.maxX) / 2 ? 1 : -1), "1: " + pc + " 라벨 자리 = 옆선 위 · 피스 바깥 방향"); });
  // 곡선 외곽 대체(뒤만) → 뒤 값만 바뀌고 앞뒤 다른 길이를 숫자 그대로
  drawBoundary("back", [{ x: SX, y: 26 }, { x: SX, y: 36 }], [{ x: -1.2, y: 2 }, { x: 0.8, y: 2 }]);
  const lb2 = DLT.sideSeamLabels(PROJECT), c2 = BC.check(PROJECT).sideSeam;
  ok(lb2.back.length === c2.back && lb2.back.length > lb.back.length + 0.05 && lb2.front.length === lb.front.length, "1: 곡선 외곽 반영 → 뒤 값만 갱신(" + lb2.back.text + ")");
  ok(Math.abs(lb2.back.length - indSide(effO("back"))) < 2e-3, "1: 곡선 포함 뒤 옆선 = 독립 호 길이(직선 높이 아님)");
  ok(Math.abs(lb2.back.length - lb2.front.length) > 0.05 && !/불일치|오류|경고/.test(lb2.front.text + lb2.back.text), "1: 앞뒤 다른 길이 = 숫자 그대로(판정 문구 없음)");
  // 옆선 + 밑단에 걸친 대체선 → 측정 불가 = 0 이 아니라 «확인 필요 + 사유»
  projectOn("A");
  drawBoundary("front", [{ x: SX, y: 50 }, { x: 40, y: 55 }, { x: 47.5, y: 56 }]);   // 승인 밖 혼합(옆선 + 밑단 전체 + 중심선) — 옆선 → 밑단 안쪽 테이퍼는 2026-11-09 부터 새 옆선
  const lb3 = DLT.sideSeamLabels(PROJECT), c3 = BC.check(PROJECT).sideSeam;
  ok(c3.status === "unmeasured" && lb3.front.length === null && /^앞 옆선 길이 확인 필요 · /.test(lb3.front.text) && !/0\.00/.test(lb3.front.text), "1: 측정 불가 = «확인 필요 · 사유»(0 으로 속이지 않음) (" + lb3.front.text + ")");
  // 다조각 몸판 = 원래 몸판 값을 붙이지 않음
  projectOn("A");
  PROJECT.working.geometry = Object.assign({}, PROJECT.working.geometry, { frontPeplum: PROJECT.working.geometry.front });
  const lb4 = DLT.sideSeamLabels(PROJECT);
  ok(lb4.front.length === null && lb4.back.length === null && /여러 조각/.test(lb4.front.text), "1: 다조각 몸판 = 값 없이 사유만 (" + lb4.front.text + ")");
}

// ══ §2 그리기 거리 안내: 직선 · 가로/세로 · 이 곡선 따라 · 시작점부터 누적 ══
{
  projectOn("A");
  const before = J(PROJECT.working);
  DLT.setMode("off"); DLT.toggle();
  hover("back", { x: 6, y: 30 }, { altKey: true });
  ok(MG() && MG().kind === "start" && /먼저 기준점/.test(MG().lines[0]), "2: 시작점 전 = 기준점을 먼저 찍으라는 안내");
  click("back", { x: 5, y: 30 }, { altKey: true });
  ok(MG() && MG().kind === "base" && /^기준점 — /.test(MG().lines[0]), "2: 첫 점 직후(터치 = hover 없음) = 기준점 안내");
  hover("back", { x: 8, y: 34 }, { altKey: true });
  let g = MG();
  ok(g.kind === "hover" && Math.abs(g.straight - 5) < 1e-12 && g.lines[0] === "직선 5.0 · 가로 → 3.0 · 세로 ↓ 4.0cm", "2: 기준점→커서 직선·가로·세로 (" + g.lines[0] + ")");
  ok(g.lines.length === 1, "2: 첫 구간 직선 = 선 따라 길이를 따로 지어내지 않음(같은 길이 중복 표시 없음)");
  hover("back", { x: 2, y: 26 }, { altKey: true });
  ok(MG().lines[0] === "직선 5.0 · 가로 ← 3.0 · 세로 ↑ 4.0cm", "2: 반대 방향 = 화살표로 부호 (" + MG().lines[0] + ")");
  // snap: Alt 없으면 다음 점이 놓일 자리(격자 등) 기준
  hover("back", { x: 8.1, y: 34.07 });
  const sh = DLT.getSnapHint();
  ok(sh && D(MG().cur, sh.point) < 1e-12, "2: 안내 = 기존 snap 결과 자리(" + (sh && sh.type) + ")");
  hover("back", { x: 8.1, y: 34.07 }, { altKey: true });
  ok(D(MG().cur, { x: 8.1, y: 34.07 }) < 1e-12 && MG().lines[0] === "직선 5.1 · 가로 → 3.1 · 세로 ↓ 4.1cm", "2: Alt = 흡착 해제 자리 그대로 (" + MG().lines[0] + ")");
  // 줌: 흡착 문턱(px)이 줄어 같은 커서가 자유 자리 — 안내는 그 자리
  sb.viewZ = 8; hover("back", { x: 8.1, y: 34.07 });
  ok(D(MG().cur, { x: 8.1, y: 34.07 }) < 1e-12, "2: 줌 8× = 흡착 문턱 축소 → 안내도 그 자리"); sb.viewZ = 1;
  // 피스 offset 이동: 같은 형상 좌표면 같은 수치
  PROJECT.working.layout.back = { dx: 13, dy: 9 };
  hover("back", { x: 8, y: 34 }, { altKey: true });
  ok(MG().lines[0] === "직선 5.0 · 가로 → 3.0 · 세로 ↓ 4.0cm", "2: 피스 offset 이동 후에도 같은 수치");
  // 곡선 구간: 드래그 중 = 이 곡선 따라(독립 검산) ≠ 직선
  const e0 = evAt("back", { x: 12, y: 30 }); down(e0);
  move(evAt("back", { x: 15, y: 33 }, { clientX: e0.clientX + 60 }));
  g = MG();
  const seg = DLT.getDraft().segments[0];
  ok(g.kind === "curve" && g.isCurve && seg.kind === "cubic", "2: 곡선 드래그 중 = 곡선 구간 안내");
  ok(Math.abs(g.segArc - indLen(seg)) < 2e-3 && g.segArc > g.straight + 0.01, "2: 이 곡선 따라 " + g.segArc.toFixed(4) + " = 독립 " + indLen(seg).toFixed(4) + " > 직선 " + g.straight.toFixed(4));
  ok(g.lines[0].indexOf("직선 " + f1(g.straight)) === 0 && g.lines[1] === "이 곡선 따라 " + f1(g.segArc) + "cm", "2: 직선과 곡선 길이를 다른 이름으로 (" + g.lines.join(" | ") + ")");
  up(evAt("back", { x: 15, y: 33 }, { clientX: e0.clientX + 60 }));
  ok(MG().kind === "last" && /^마지막 구간 직선 /.test(MG().lines[0]), "2: 손 뗀 뒤(터치 포함) = 마지막 구간 표시");
  hover("back", { x: 12, y: 36 }, { altKey: true });
  g = MG();
  const exp = indLen(DLT.getDraft().segments[0]) + 6;
  ok(g.lines[1] === "시작점부터 그리는 선 따라 " + f1(g.total) + "cm" && Math.abs(g.total - exp) < 2e-3 && g.total > g.straight + 7, "2: 시작점부터 누적 = 곡선 호 + 다음 직선 (" + g.lines[1] + ")");
  key("Escape");
  ok(J(PROJECT.working.patternLines) === J(JSON.parse(before).patternLines), "2: 안내는 선·점을 만들지 않음(Esc 뒤 패턴선 그대로)");
  DLT.setMode("off");
  ok(MG() === null, "2: 그리기 밖 = 안내 없음");
}

// ══ §3 기존 선 따라(읽기 전용 투영): 같은 열린 구간만 · 다른 구간·닫힌 선 = 사유 ══
{
  projectOn("A");
  const ah = PROJECT.working.geometry.back.outline.filter(p => p.edge === "armhole")[0];
  const q = pathSpan(ah, 0), A = bez(q, 0.2), B = bez(q, 0.8);
  const before = J(PROJECT.working);
  DLT.toggle();
  click("back", A, { altKey: true });
  hover("back", B, { altKey: true });
  let g = MG(), ind = indArc(q, 0.2, 0.8);
  ok(g.along && g.along.name === "진동" && Math.abs(g.along.len - ind) < 2e-3 && g.along.len > g.straight + 0.01, "3: 기존 진동 따라 " + (g.along && g.along.len.toFixed(4)) + " = 독립 " + ind.toFixed(4) + " > 직선 " + g.straight.toFixed(4));
  ok(g.lines[g.lines.length - 1] === "기존 진동 따라 " + f1(ind) + "cm" && g.lines[0].indexOf("직선 " + f1(g.straight)) === 0, "3: «직선 / 기존 진동 따라» 이름 구분 (" + g.lines.join(" | ") + ")");
  // 반대 방향(B 를 기준으로) = 같은 길이
  key("Escape"); DLT.setMode("off"); DLT.toggle();
  click("back", B, { altKey: true }); hover("back", A, { altKey: true });
  ok(MG().along && Math.abs(MG().along.len - ind) < 2e-3, "3: 방향을 바꿔도 같은 호 길이");
  // 다른 구간(진동 → 옆선) = 단정하지 않고 사유
  hover("back", { x: SX, y: 30 }, { altKey: true });
  ok(MG().along && MG().along.reason && /다른 구간\(진동 → 옆선\)/.test(MG().along.reason) && MG().along.len == null, "3: 다른 구간 = 사유만 (" + (MG().along && MG().along.reason) + ")");
  // 기존 선 위가 아닌 커서 = 표시 없음
  hover("back", { x: 10, y: 40 }, { altKey: true });
  ok(MG().along === null && MG().lines.length === 1, "3: 기존 선 밖 = 따라 잰 길이 없음");
  key("Escape"); DLT.setMode("off");
  ok(J(PROJECT.working) === before, "3: 기존 선 측정은 외곽·선·점 불변(새 점 삽입 없음)");
  // 기존 곡선 패턴선 위 두 점
  DLT.toggle(); drag("back", { x: 4, y: 44 }, { x: 0, y: 0 }); click("back", { x: 4, y: 44 }, { altKey: true });
  key("Escape");
  DLT.setMode("off"); DLT.toggle();
  click("back", { x: 3, y: 42 }, { altKey: true });
  const e0 = evAt("back", { x: 9, y: 42 }); down(e0); move(evAt("back", { x: 11, y: 39 }, { clientX: e0.clientX + 60 })); up(evAt("back", { x: 11, y: 39 }, { clientX: e0.clientX + 60 }));
  key("Enter");
  const pl = last(), cs = pl.segments[0], cq = [cs.from, cs.c1, cs.c2, cs.to];
  DLT.setMode("off"); DLT.toggle();
  click("back", bez(cq, 0.25), { altKey: true }); hover("back", bez(cq, 0.9), { altKey: true });
  g = MG(); ind = indArc(cq, 0.25, 0.9);
  ok(cs.kind === "cubic" && g.along && g.along.name === "보조선" && Math.abs(g.along.len - ind) < 2e-3, "3: 기존 곡선 보조선 따라 = 독립 호 (" + (g.along && g.along.len.toFixed(4)) + " / " + ind.toFixed(4) + ")");
  key("Escape"); DLT.setMode("off");
  // 닫힌 선 = 어느 쪽으로 돌지 단정하지 않음
  DLT.toggle(); [{ x: 2, y: 47 }, { x: 6, y: 47 }, { x: 6, y: 51 }, { x: 2, y: 51 }, { x: 2, y: 47 }].forEach(pt => click("back", pt, { altKey: true })); key("Enter");
  DLT.setMode("off"); DLT.toggle();
  click("back", { x: 4, y: 47 }, { altKey: true }); hover("back", { x: 6, y: 49 }, { altKey: true });
  ok(MG().along && /닫힌 선/.test(MG().along.reason || ""), "3: 닫힌 선 = 사유 (" + (MG().along && (MG().along.reason || MG().along.len)) + ")");
  key("Escape"); DLT.setMode("off");
}

console.log("══════════════════════════════════════════════");
fails.forEach(f => console.log("  ✗ " + f));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
