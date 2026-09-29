// ══════════════════════════════════════════════
// designJoinSpreadCheck.js — js/designJoin.js `buttSpread` (처리 방법 158「맞대면서 벌린다」) 회귀.
//
// 핵심 계약:
//   (1) 맞댄 뒤(157) **봉제선의 한 끝점(pivot, 교재의 WL 포인트)을 고정**하고 B 를 강체 회전해
//       반대 끝(far)에서 두 봉제선 끝 사이 직선 거리가 chordCm(교재 ∅/2)이 되게 벌린다.
//   (2) 벌어지는 방향은 결정적이다 — 쐐기가 생겨야 하고(면적 = A + B + 쐐기) 겹치면 안 된다.
//   (3) 벌어진 자리는 접선 연속(G1) 이음으로 잇는다(교재 «각지지 않게 완만한 곡선») — 직선은 비교용.
//   (4) 원자적 거부: pivot 이 봉제선 끝점이 아님·벌림량 무효/과대·이음 형식 무효·157 의 모든 거부.
//   (5) 입력 불변·결정론·순수(document 없음).
//
//   node test/harness/designJoinSpreadCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    if (!e.reason) { FAIL++; fails.push(`${name} (reason 없음: ${e.message})`); }
    else if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); }
    else PASS++;
  }
}
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const J = JSON.stringify;

const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const js = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
js("designLineTool.js"); js("designFlare.js"); js("designJoin.js");
const G = sandbox.window.designJoin, T = sandbox.window.designLineTool;
ok(typeof G.buttSpread === "function" && Object.isFrozen(G), "0: API·frozen");

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const L = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
function flat(prims) {
  const pts = [];
  T.outlinePrimsToSegs(prims).forEach(s => T.flattenLine([s]).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }));
  return pts;
}
const areaOf = (prims) => { const p = flat(prims); let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; a += u.x * v.y - v.x * u.y; } return Math.abs(a / 2); };
const lenOf = (prims) => T.outlinePrimsToSegs(prims).reduce((s, g) => s + T.flattenLine([g]).reduce((t, ab) => t + D(ab[0], ab[1]), 0), 0);

// 페플럼 두 조각의 축소판: 다트 폭 2(위) → 0(아래, 밑단 apex). 다리 길이 ≈ 20.025.
//   A 의 다리 (9,0)→(10,20), B 의 다리 (10,20)→(11,0). 정규화(양의 signed area) 방향 기준 끝점을 준다.
const MOUTH = { x: 9, y: 0 }, APEX = { x: 10, y: 20 };
function fixture(o) {
  o = o || {};
  return {
    joinPairId: "t-1",
    a: { pairId: "t-1", start: { x: 9, y: 0 }, end: { x: 10, y: 20 }, piece: { outline: [
      L([0, 0], [9, 0], "waist"), L([9, 0], [10, 20], "join:t-1:first"), L([10, 20], [0, 20], "hem"), L([0, 20], [0, 0], "center")
    ], construction: [] } },
    b: { pairId: "t-1", start: { x: 10, y: 20 }, end: { x: 11, y: 0 }, piece: { outline: [
      L([11, 0], [20, 0], "waist"), L([20, 0], [20, 20], "side-seam"), L([20, 20], [10, 20], "hem"), L([10, 20], [11, 0], "join:t-1:second")
    ], construction: [] } },
    spread: { pivot: o.pivot || MOUTH, chordCm: o.chord != null ? o.chord : 3 }
  };
}
const OPT = { bridge: "smooth", bridgeEdge: "hem" };
const Lc = D(MOUTH, APEX), SUM = 9 * 20 - 0.5 * 1 * 20 + 0; // 무시: 아래에서 실측 면적으로 비교

// ── 1. 기본: 고정점 = 입(mouth) ──
const spec1 = fixture(); const snap1 = J(spec1);
const r1 = G.buttSpread(spec1, OPT);
ok(J(spec1) === snap1, "1: 입력 불변");
ok(r1.spread.pivotAt === "end" || r1.spread.pivotAt === "start", "1: pivotAt 결정");
const phiWant = 2 * Math.asin(3 / (2 * Lc));
ok(near(Math.abs(r1.spread.angleRad), phiWant, 1e-12), "1: 벌림각 = 2·asin(chord/2L)");
ok(near(r1.spread.bridgeChordCm, 3, 1e-9), "1: far 끝 두 봉제선 사이 직선거리 = chordCm");
ok(near(r1.spread.seamChordCm, Lc, 1e-9), "1: 봉제선 현 길이");
// 고정점은 움직이지 않는다 — 외곽에 정확히 그 좌표의 꼭짓점이 있다.
const fp = flat(r1.outline);
ok(fp.some(q => D(q, MOUTH) < 1e-9), "1: 고정점(입)이 외곽 위에 그대로 있다");
ok(fp.some(q => D(q, APEX) < 1e-9), "1: A 쪽 far 끝은 그대로");
// 면적: 선 이음 기준 = A + B + 쐐기, 조각 면적은 각각 보존.
const a0 = r1.areaACm2, b0 = r1.areaBCm2;
ok(near(a0, 9 * 20 + 0.5 * 1 * 20, 1e-6) || a0 > 0, "1: A 면적 양수");
ok(r1.spread.wedgeAreaCm2 > 0 && near(r1.spread.wedgeAreaCm2, 0.5 * Lc * Lc * Math.sin(phiWant), 1e-6), "1: 쐐기 면적 = ½L²sinφ");
ok(near(r1.areaJoinedCm2 - r1.spread.bridgeAreaCm2, a0 + b0 + r1.spread.wedgeAreaCm2, 2e-3), "1: 선 이음 면적 = A+B+쐐기(겹침 없음)");
ok(r1.areaJoinedCm2 > a0 + b0, "1: 분량이 늘었다");
// 외곽 연속 폐곡선 + 의미 모서리
const segs1 = T.outlinePrimsToSegs(r1.outline);
ok(segs1.every((s, i) => D(s.to, segs1[(i + 1) % segs1.length].from) < 1e-4), "1: 폐곡선 연속");
ok(segs1.filter(s => s.edge === "join:t-1:first" || s.edge === "join:t-1:second").length === 0, "1: 맞댄 다리는 외곽에서 사라진다");
ok(segs1.filter(s => s.edge === "hem").length >= 3, "1: 이음이 hem 의미를 잇는다(2 + 이음)");
ok(r1.spread.bridgeKind === "smooth" && r1.spread.bridgeLenCm >= r1.spread.bridgeChordCm - 1e-9, "1: 이음 = smooth, 길이 ≥ 현");

// 접선 연속(G1): 이음의 양 끝 접선이 이웃 hem 직선의 방향과 같다.
function unit(v) { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; }
const brIdx = segs1.findIndex(s => s.kind === "cubic" || (s.commands && s.commands.some(c => c.type === "C")));
ok(brIdx >= 0, "1: cubic 이음 존재");
{
  const n = segs1.length, br = segs1[brIdx], prev = segs1[(brIdx + n - 1) % n], next = segs1[(brIdx + 1) % n];
  const p0 = br.from, c1 = br.c1 || br.commands[1].points[0], c2 = br.c2 || br.commands[1].points[1], p3 = br.to;
  const dPrev = unit({ x: prev.to.x - prev.from.x, y: prev.to.y - prev.from.y }), dIn = unit({ x: c1.x - p0.x, y: c1.y - p0.y });
  const dOut = unit({ x: p3.x - c2.x, y: p3.y - c2.y }), dNext = unit({ x: next.to.x - next.from.x, y: next.to.y - next.from.y });
  ok(near(dPrev.x, dIn.x, 1e-9) && near(dPrev.y, dIn.y, 1e-9), "1: 이음 시작 접선 = 앞 hem 방향(G1)");
  ok(near(dOut.x, dNext.x, 1e-9) && near(dOut.y, dNext.y, 1e-9), "1: 이음 끝 접선 = 뒤 hem 방향(G1)");
}

// 직선 이음(비교용): 둘레 = A + B − 2·봉제선 + 현
const rl = G.buttSpread(fixture(), { bridge: "line", bridgeEdge: "hem" });
const perimA = 9 + Lc + 10 + 20, perimB = 9 + 20 + 10 + Math.hypot(1, 20);
ok(near(lenOf(rl.outline), perimA + perimB - 2 * Lc + 3, 1e-6), "2: 직선 이음 둘레 = A+B−2·봉제선+chord");
ok(near(areaOf(rl.outline), a0 + b0 + r1.spread.wedgeAreaCm2, 2e-3), "2: 직선 이음 면적 = A+B+쐐기");
ok(r1.areaJoinedCm2 - areaOf(rl.outline) === r1.spread.bridgeAreaCm2 || near(r1.spread.bridgeAreaCm2, r1.areaJoinedCm2 - areaOf(rl.outline), 1e-9), "2: bridgeArea 보고 = cubic − 직선");

// ── 3. 고정점 = 반대 끝(apex): 여전히 쐐기, 겹침 없음 ──
const r3 = G.buttSpread(fixture({ pivot: APEX }), OPT);
ok(r3.spread.pivotAt !== r1.spread.pivotAt, "3: 다른 끝을 고정");
ok(r3.areaJoinedCm2 > r3.areaACm2 + r3.areaBCm2 - 1e-9 && r3.spread.wedgeAreaCm2 > 0, "3: apex 고정도 쐐기(분량 증가)");
ok(flat(r3.outline).some(q => D(q, APEX) < 1e-9), "3: 고정점(apex)이 외곽 위에 그대로");

// ── 4. 결정론 ──
ok(J(G.buttSpread(fixture(), OPT)) === J(r1), "4: 같은 입력 = 같은 출력");

// ── 5. 원자적 거부 ──
throwsReason(() => G.buttSpread(fixture({ pivot: { x: 9.5, y: 10 } }), OPT), "pivot-off-seam-end", "5: 고정점이 봉제선 중간");
throwsReason(() => G.buttSpread(fixture({ pivot: { x: 0, y: 0 } }), OPT), "pivot-off-seam-end", "5: 고정점이 봉제선 밖");
throwsReason(() => G.buttSpread(fixture({ chord: 0 }), OPT), "invalid-spread-amount", "5: 벌림 0");
throwsReason(() => G.buttSpread(fixture({ chord: -1 }), OPT), "invalid-spread-amount", "5: 벌림 음수");
throwsReason(() => G.buttSpread(fixture({ chord: NaN }), OPT), "invalid-spread-amount", "5: 벌림 NaN");
throwsReason(() => G.buttSpread(fixture({ chord: 1e-9 }), OPT), "no-spread", "5: 벌림이 너무 작음");
throwsReason(() => G.buttSpread(fixture({ chord: 2 * Lc }), OPT), "spread-too-large", "5: 현이 지름 이상");
throwsReason(() => G.buttSpread((() => { const s = fixture(); delete s.spread; return s; })(), OPT), "invalid-spread", "5: spread 없음");
throwsReason(() => G.buttSpread((() => { const s = fixture(); s.spread.pivot = null; return s; })(), OPT), "invalid-spread-pivot", "5: pivot 없음");
throwsReason(() => G.buttSpread(fixture(), { bridge: "zigzag" }), "invalid-bridge", "5: 이음 형식 무효");
throwsReason(() => G.buttSpread((() => { const s = fixture(); s.b.pairId = "other"; return s; })(), "pair-mismatch", "5: 157 거부(쌍 불일치) 그대로"), "pair-mismatch", "5: 157 거부 승계");
// 큰 벌림(60°)도 겹치지 않고 면적 검산이 맞는다 — 방향이 결정적이라 B 는 A 쪽으로 돌지 않는다.
const r60 = G.buttSpread(fixture({ chord: Lc }), { bridge: "line", bridgeEdge: "hem" });
ok(near(Math.abs(r60.spread.angleDeg), 60, 1e-9) && near(areaOf(r60.outline), r60.areaACm2 + r60.areaBCm2 + r60.spread.wedgeAreaCm2, 2e-3), "5: 60° 벌림 — 쐐기 면적 검산");

// ── 6. 벌림에 따른 단조성 ──
const rSmall = G.buttSpread(fixture({ chord: 1 }), OPT), rBig = G.buttSpread(fixture({ chord: 6 }), OPT);
ok(rSmall.spread.wedgeAreaCm2 < r1.spread.wedgeAreaCm2 && r1.spread.wedgeAreaCm2 < rBig.spread.wedgeAreaCm2, "6: 벌림 ↑ → 쐐기 면적 ↑");

// ── 7. 순수: document 가 없어도 돈다(위에서 이미 확인) + 157 회귀 ──
ok(typeof G.buttJoin === "function", "7: buttJoin 유지");

console.log("══════════════════════════════════════════════");
console.log(`designJoinSpreadCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
