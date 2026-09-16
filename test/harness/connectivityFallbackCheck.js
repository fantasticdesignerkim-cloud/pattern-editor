// ══════════════════════════════════════════════
// connectivityFallbackCheck.js — seam-ready 연결성 gate 의 dart-moved 닫힌 외곽 fallback 회귀.
//
// 기존 경로(buildPieceRing: 열린 입구 1개 + construction 다리)는 그대로 우선한다. 그것이 실패하면
// 외곽 끝점 그래프가 한 성분·자유 끝점 0·짝수 차수이고, 차수>2 정점의 모든 branch 가 선언 apex 끝으로
// 닿는 외곽 다트 다리일 때만 연결로 인정한다. 연결성 외 게이트는 우회하지 않는다.
//
//   node test/harness/connectivityFallbackCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe } = require("./dartDriver");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const dims = { B: 83, W: 64, BL: 38 };
const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");

function loadBC(ringStub) {
  let PROJECT = null;
  const sb = { window: {}, console: { log() {}, warn() {}, error() {} }, structuredClone, Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN, Date };
  sb.globalThis = sb; sb.document = {}; vm.createContext(sb);
  if (ringStub) sb.window.designLineTool = { buildPieceRing: ringStub };
  else vm.runInContext(JS("designLineTool.js"), sb, { filename: "designLineTool.js" });
  sb.window.designWorkflow = { current: () => PROJECT };
  vm.runInContext(JS("bodiceCheckpoint.js"), sb, { filename: "bodiceCheckpoint.js" });
  return { BC: sb.window.bodiceCheckpoint, LT: sb.window.designLineTool, set: (p) => { PROJECT = p; } };
}
const REAL = loadBC(null);
const BC = REAL.BC;

// 엔진 baked → design outline primitive. 다리는 선언 dart meta 를 싣고, 같은 타입 곡선 run 은 capture 처럼
// 하나의 path(C 명령 여러 개)로 묶는다(mergeCurves).
const CURVE = new Set(["back-armhole", "front-armhole-lower", "front-armhole-upper", "back-neckline", "front-neckline"]);
function toPrims(segs, mergeCurves) {
  const out = [];
  let run = null;
  const flush = () => {
    if (!run) return;
    const pts = run.pts;
    out.push({ kind: "path", commands: [{ type: "M", points: [pts[0]] }].concat(pts.slice(1).map((q, i) => ({ type: "C", points: [pts[i], q, q] }))) });
    run = null;
  };
  segs.forEach(s => {
    if (mergeCurves && CURVE.has(s.type)) {
      const cont = run && run.type === s.type && Math.hypot(run.pts[run.pts.length - 1].x - s.from.x, run.pts[run.pts.length - 1].y - s.from.y) < 0.05;
      if (!cont) { flush(); run = { type: s.type, pts: [{ ...s.from }] }; }
      run.pts.push({ ...s.to });
      return;
    }
    flush();
    const o = { kind: "line", from: { ...s.from }, to: { ...s.to } };
    if (s.dartId) o.dart = { id: s.dartId, apexAt: s.dartApexAt, boundary: s.dartBoundary };
    out.push(o);
  });
  flush();
  return out;
}
const project = (front, back, constr) => ({ sourceBlock: { version: 1, schemaVersion: 6 }, working: {
  geometry: { front: { outline: front, construction: constr || [] }, back: { outline: back || front, construction: constr || [] }, shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] } },
  parameters: {}, designOutline: null, frontPlacket: null, patternLines: [] } });
const connected = (outline, constr) => { REAL.set(project(outline, outline, constr)); return BC.check().connectivity.front; };
const ringOnly = (outline, constr) => { try { return REAL.LT.buildPieceRing(REAL.LT.outlinePrimsToSegs(outline), constr || []).ok; } catch (e) { return false; } };
const pivotDegree = (prims, pivot) => prims.reduce((n, p) => n + [p.from || p.commands[0].points[0], p.to || p.commands[p.commands.length - 1].points[2]].filter(q => Math.hypot(q.x - pivot.x, q.y - pivot.y) < 1e-4).length, 0);

// 1. 실제 다트이동 닫힌 외곽: partial/full, A/B, 다세대 — 기존 ring 은 실패, fallback 으로 연결
const scenarios = [
  ["front", [["front-neckline", 0.4, "A", 1.0]]], ["front", [["front-neckline", 0.4, "A", 0.5]]],
  ["front", [["front-waist", 0.6, "A", 0.5]]], ["front", [["front-waist", 0.6, "B", 1.0]]],
  ["back", [["back-waist", 0.55, "A", 0.5]]], ["back", [["back-waist", 0.55, "B", 1.0]]],
  ["front", [["front-neckline", 0.4, "A", 0.5], ["front-armhole-upper", 0.5, "B", 0.4], ["front-waist", 0.6, "A", 0.6]]],
  ["back", [["back-waist", 0.55, "A", 0.5], ["back-armhole", 0.4, "A", 0.6], ["back-neckline", 0.5, "B", 0.5]]],
];
let partialPrims = null, partialPivot = null;
scenarios.forEach(([side, moves]) => {
  const { engine } = createEngine();
  let res;
  moves.forEach(m => { res = applyRecipe(engine, side, dims, { type: m[0], arcFraction: m[1], piece: m[2], moveFraction: m[3] }); });
  const name = side + " " + moves.map(m => m[0] + " " + m[2] + "×" + m[3]).join(" → ");
  ok(res.status === "applied", "1: " + name + " 적용");
  if (res.status !== "applied") return;
  [false, true].forEach(merge => {
    const prims = toPrims(res.bakedSegments, merge);
    ok(!ringOnly(prims) && connected(prims) === true, "1: " + name + (merge ? " (path 병합)" : "") + " → 기존 ring 실패 · fallback 연결");
  });
  if (!partialPrims && moves.length === 1 && moves[0][3] === 0.5 && side === "front") { partialPrims = toPrims(res.bakedSegments, true); partialPivot = res.pivot; }
});
ok(partialPrims && pivotDegree(partialPrims, partialPivot) === 4, "1: 부분 이동 fixture 는 pivot 에 다리 4개(서로 다른 id)");

// 2. unmoved 2-free-end 경로: 기존 판정 그대로(fallback 은 이 형상을 독자 승인하지 않음)
{
  const { engine } = createEngine();
  const d = engine.createDraft(83, 64, 38);
  const segs = engine.buildFrontOutline(d.pts, d.formula, 83);
  const outline = toPrims(segs.filter(s => !s.disabled), true);
  const constr = segs.filter(s => s.disabled).map(s => ({ from: { ...s.from }, to: { ...s.to } }));
  ok(ringOnly(outline, constr) === true && connected(outline, constr.map(c => ({ kind: "line", from: c.from, to: c.to }))) === true, "2: unmoved 기존 ring 경로 통과 유지");
  ok(BC.closedOutlineWithDeclaredDartJunctions(outline) === false, "2: 열린 입구 외곽은 fallback 단독으로는 연결 아님(자유 끝점)");
  ok(connected(outline, []) === false, "2: construction 다리 없이 열린 입구 → 기존대로 not-connected");
}

// 3. malformed: 전부 not-connected
{
  const P = partialPrims, pv = partialPivot;
  const clone = () => JSON.parse(JSON.stringify(P));
  const atPivot = (p) => [p.from, p.to].some(q => q && Math.hypot(q.x - pv.x, q.y - pv.y) < 1e-4);
  const legIdx = clone().map((p, i) => (p.dart && atPivot(p)) ? i : -1).filter(i => i >= 0);
  ok(legIdx.length === 4 && BC.closedOutlineWithDeclaredDartJunctions(clone()) === true, "3: 기준 fixture 연결");
  const noMeta = clone(); delete noMeta[legIdx[0]].dart;
  ok(BC.closedOutlineWithDeclaredDartJunctions(noMeta) === false, "3: pivot branch 다트 선언 제거 → not-connected");
  const flip = clone(); flip[legIdx[1]].dart.apexAt = flip[legIdx[1]].dart.apexAt === "from" ? "to" : "from";
  ok(BC.closedOutlineWithDeclaredDartJunctions(flip) === false, "3: apexAt 반전 → not-connected");
  const otherApex = clone(); const idX = otherApex[legIdx[0]].dart.id;
  const far = otherApex.find(p => !p.dart && p.kind === "line");
  far.dart = { id: idX, apexAt: "from" };   // 같은 id 인데 선언 apex 가 pivot 이 아닌 곳
  ok(BC.closedOutlineWithDeclaredDartJunctions(otherApex) === false, "3: 같은 id 다리의 apex 불일치 → not-connected");
  const odd = clone(); odd.push({ kind: "line", from: { ...pv }, to: { x: pv.x + 3, y: pv.y + 3 }, dart: { id: "extra", apexAt: "from" } });
  ok(BC.closedOutlineWithDeclaredDartJunctions(odd) === false, "3: 홀수 branch(선언 있어도) → not-connected");
  const disc = clone(); disc.push({ kind: "line", from: { x: 500, y: 500 }, to: { x: 501, y: 500 } }, { kind: "line", from: { x: 501, y: 500 }, to: { x: 500, y: 501 } }, { kind: "line", from: { x: 500, y: 501 }, to: { x: 500, y: 500 } });
  ok(BC.closedOutlineWithDeclaredDartJunctions(disc) === false, "3: 분리된 두 번째 루프 → not-connected");
  const gap = clone(); const gl = gap.find(p => !p.dart && p.kind === "line"); gl.to = { x: gl.to.x + 0.01, y: gl.to.y };
  ok(BC.closedOutlineWithDeclaredDartJunctions(gap) === false, "3: 실제 gap(0.01cm) → not-connected");
  const cross = clone(); const nd = cross.filter(p => !p.dart && p.kind === "line")[0];
  cross.push({ kind: "line", from: { ...pv }, to: { ...nd.from } }, { kind: "line", from: { ...nd.from }, to: { ...pv } });   // 선언 없는 branch 쌍으로 차수 짝수 유지
  ok(BC.closedOutlineWithDeclaredDartJunctions(cross) === false, "3: 선언 없는 branch 가 pivot 에 모임 → not-connected");
  ok(connected(noMeta) === false && connected(flip) === false, "3: gate(check) 에서도 not-connected");
}

// 3b. path primitive 는 정확히 하나의 연속 subpath(M 1개 + 유효 C ≥1)일 때만 edge 로 인정
{
  const P = JSON.parse(JSON.stringify(partialPrims));
  const pi = P.findIndex(p => p.kind === "path" && p.commands.length >= 3);
  ok(pi >= 0 && BC.closedOutlineWithDeclaredDartJunctions(P) === true, "3b: 정상 single-M multi-C path 통과");
  const variant = (fn) => { const Q = JSON.parse(JSON.stringify(P)); fn(Q[pi].commands); return BC.closedOutlineWithDeclaredDartJunctions(Q); };
  // 숨겨진 두 번째 subpath: 중간 C 를 M 으로 바꾸면 첫 시작·마지막 끝은 같아도 실제로는 끊긴 형상
  ok(variant(c => { const mid = Math.floor(c.length / 2); c[mid] = { type: "M", points: [c[mid].points[2]] }; }) === false, "3b: 숨겨진 두 번째 M subpath 거부");
  ok(variant(c => { c.splice(1, 0, { type: "M", points: [c[0].points[0]] }); }) === false, "3b: 같은 점에서 다시 시작하는 추가 M 도 거부");
  ok(variant(c => { c[0] = { type: "C", points: [c[0].points[0], c[0].points[0], c[0].points[0]] }; }) === false, "3b: 첫 명령이 M 아님 거부");
  ok(variant(c => { c[c.length - 1] = { type: "L", points: [c[c.length - 1].points[2]] }; }) === false, "3b: 마지막 명령이 C 아님 거부");
  ok(variant(c => { c[0].points.push({ x: 0, y: 0 }); }) === false, "3b: M 점 수 오류 거부");
  ok(variant(c => { c[1].points = c[1].points.slice(0, 2); }) === false, "3b: C 점 수 오류 거부");
  ok(variant(c => { c.splice(1); }) === false, "3b: C 없는 path 거부");
}

// 4. waist carry 유무와 무관(연결성은 외곽만 본다) · hash/측정 불변(fallback 은 gate 만 바꾼다)
{
  const { engine } = createEngine();
  const res = applyRecipe(engine, "front", dims, { type: "front-neckline", arcFraction: 0.4, piece: "A", moveFraction: 1.0 });
  const prims = toPrims(res.bakedSegments, true);
  const carried = engine.dartMoveState.appliedFront.waistDarts;
  const d = engine.createDraft(83, 64, 38), base = engine.gen0WaistDartPayload("front", d.formula, d.pts, d.darts);
  const legsOf = (pl) => Object.values(pl).flatMap(e => [{ kind: "line", from: e.dart.left, to: e.dart.apex }, { kind: "line", from: e.dart.right, to: e.dart.apex }]);
  ok(connected(prims, legsOf(carried)) === true && connected(prims, legsOf(base)) === true && connected(prims, []) === true, "4: carried/base/없음 허리다트와 무관하게 동일 판정");
  const stub = loadBC(() => ({ ok: true }));
  const projOf = () => { const pr = project(prims, prims); pr.working.geometry.front.construction = legsOf(carried); return pr; };
  REAL.set(projOf()); const c1 = BC.complete();
  stub.set(projOf()); const c2 = stub.BC.complete();
  const ck = (c) => c.check || {};
  ok(ck(c1).connectivity && ck(c1).connectivity.front === true, "4: 실제 도구 gate 연결 통과");
  ok(JSON.stringify(ck(c1).armhole) === JSON.stringify(ck(c2).armhole) && JSON.stringify(ck(c1).sideSeam) === JSON.stringify(ck(c2).sideSeam) &&
     JSON.stringify(ck(c1).neckline) === JSON.stringify(ck(c2).neckline), "4: reported 측정은 ring 판정 방식과 무관");
  ok(c1.ok === c2.ok && (!c1.ok || c1.result.hash === c2.result.hash), "4: 완료 결과·hash 는 ring 이 통과한 경우와 동일");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
