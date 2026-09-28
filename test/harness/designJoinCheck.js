// ══════════════════════════════════════════════
// designJoinCheck.js — js/designJoin.js (처리 방법 157「맞댄다」) 회귀.
//
// 핵심 계약:
//   (1) B 를 **강체 이동·회전**해 A 구간에 **역방향으로** 일치시킨다(뒤집기 없음).
//   (2) 중복 맞댐선은 **양쪽 다** 외곽에서 빠진다 → 둘레 = 둘레A + 둘레B − 2·봉제선.
//   (3) 면적은 각각 보존되고 결과 면적 = 합(겹치면 작아진다).
//   (4) 길이만 같고 **형상이 다른** 봉제선은 거부한다(종이가 맞닿지 않는다 — 제1법칙).
//   (5) 쌍 불일치·퇴화 구간·길이 불일치·면적 0·자기교차·연결 실패는 **원자적 거부**.
//   (6) 입력 불변 · DOM/render/storage 미접근(순수).
//
//   node test/harness/designJoinCheck.js
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

// ── 순수성 샌드박스: document 도 주지 않는다. 접근하면 ReferenceError 로 터진다. ──
const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const js = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
js("designLineTool.js");
js("designJoin.js");
const G = sandbox.window.designJoin, T = sandbox.window.designLineTool;

ok(typeof G.buttJoin === "function" && Object.isFrozen(G), "0: API·frozen");

// geometry 포맷은 {kind:"path", commands} 라 from/to 가 없다 — 양쪽 공용 끝점 헬퍼.
function ends(sg) {
  if (sg.kind === "path") {
    const pts = []; sg.commands.forEach(c => c.points.forEach(p => pts.push(p)));
    return { from: pts[0], to: pts[pts.length - 1] };
  }
  return { from: sg.from, to: sg.to };
}
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function primsLen(prims) {
  return T.outlinePrimsToSegs(prims).reduce((L, s) =>
    L + T.flattenLine([s]).reduce((t, ab) => t + D(ab[0], ab[1]), 0), 0);
}
function primsArea(prims) {
  const pts = [];
  T.outlinePrimsToSegs(prims).forEach(s => T.flattenLine([s]).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }));
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a / 2);
}
const L = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
const CU = (a, c1, c2, b, edge) => {
  const s = { kind: "path", commands: [
    { type: "M", points: [{ x: a[0], y: a[1] }] },
    { type: "C", points: [{ x: c1[0], y: c1[1] }, { x: c2[0], y: c2[1] }, { x: b[0], y: b[1] }] }
  ] };
  if (edge) s.edge = edge;
  return s;
};

// ── 픽스처 ①: 정사각 두 장을 맞댄 변에서 잇는다(맞댐 = A 오른변 / B 왼변) ──────
//   canonical 방향(양의 signed area) 기준 forward 호가 맞댐 구간이다.
function squares(o) {
  o = o || {};
  const h = o.bh != null ? o.bh : 10;                        // B 높이(길이 불일치 시험용)
  return {
    a: { pairId: "yoke-1", start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, piece: {
      outline: [
        L([0, 0], [10, 0], "shoulder"),
        o.aSeam || L([10, 0], [10, 10], "armhole"),
        L([10, 10], [0, 10], "hem"),
        L([0, 10], [0, 0], "center")
      ],
      construction: o.aConstr || []
    } },
    b: { pairId: "yoke-1", start: { x: 20, y: h }, end: { x: 20, y: 0 }, piece: {
      outline: [
        L([20, 0], [30, 0], "shoulder"),
        L([30, 0], [30, h], "side-seam"),
        L([30, h], [20, h], "hem"),
        o.bSeam || L([20, h], [20, 0], "armhole")
      ],
      construction: o.bConstr || []
    } }
  };
}
const spec1 = () => Object.assign({ joinPairId: "yoke-1" }, squares());

// 1. 한 장으로 이어진다 — 이동량·회전·폐곡선·둘레·면적
{
  const s = spec1();
  const SNAP = J(s);
  const r = G.buttJoin(s);

  ok(J(s) === SNAP, "1: 입력 불변(호출이 입력을 건드리지 않는다)");
  ok(r.joinPairId === "yoke-1", "1: joinPairId 를 결과에 들고 있다");
  ok(near(r.transform.rotationDeg, 0), "1: 같은 방향이면 회전 0°");
  ok(near(r.transform.mapFrom.x, 20) && near(r.transform.mapFrom.y, 10), "1: b.start 를 옮긴다");
  ok(near(r.transform.mapTo.x, 10) && near(r.transform.mapTo.y, 10), "1: b.start ↦ a.end (역방향 대응)");
  ok(near(r.seamLenACm, 10) && near(r.seamLenBCm, 10) && near(r.seamLenDeltaCm, 0), "1: 봉제선 길이 10·일치");
  ok(near(r.maxSeamDeviationCm, 0, 1e-12), "1: 봉제선 형상 편차 0");
  ok(near(r.residualGapCm, 0, 1e-12), "1: 이음 틈 0");

  // 폐곡선 연속성(제1법칙)
  let maxGap = 0;
  for (let i = 0; i < r.outline.length; i++) {
    const u = ends(r.outline[i]), v = ends(r.outline[(i + 1) % r.outline.length]);
    maxGap = Math.max(maxGap, D(u.to, v.from));
  }
  ok(maxGap < 1e-4, "1: 외곽이 끊기지 않는다(" + maxGap.toExponential(1) + ")");

  // ★ 중복 맞댐선 제거 — 둘레 = 둘레A + 둘레B − 2·봉제선
  const perimA = primsLen(s.a.piece.outline), perimB = primsLen(s.b.piece.outline);
  ok(near(perimA, 40) && near(perimB, 40), "1: 원본 둘레 40·40");
  ok(near(primsLen(r.outline), perimA + perimB - 2 * 10, 1e-9), "1: 둘레 = A+B−2·봉제선(중복선 제거)");
  ok(r.outline.length === 6, "1: 외곽 세그먼트 3+3(맞댄 두 변이 빠진다)");

  // 면적 — 강체 변환이라 각각 보존되고 합이 된다
  ok(near(r.areaACm2, 100) && near(r.areaBCm2, 100), "1: 원본 면적 100·100");
  ok(near(r.areaJoinedCm2, 200, 1e-9), "1: 맞댄 면적 = 200(10×20)");
  ok(near(r.areaDeltaCm2, 0, 1e-9), "1: 면적 보존(겹치지 않았다)");
  ok(near(primsArea(r.outline), r.areaJoinedCm2, 1e-9), "1: 보고한 면적 = 실제 외곽 면적");

  // 실제 좌표: B 가 x−10 만큼 평행이동해 붙었다
  const xs = [];
  T.outlinePrimsToSegs(r.outline).forEach(sg => T.flattenLine([sg]).forEach(ab => { xs.push(ab[0].x, ab[1].x); }));
  ok(near(Math.min(...xs), 0) && near(Math.max(...xs), 20), "1: x 범위 0~20(B 가 A 에 맞닿았다)");

  // 제거된 맞댐선은 기록으로 남는다(외곽이 아니다)
  ok(r.joinSeam.length === 1 && near(primsLen(r.joinSeam), 10), "1: joinSeam 에 제거된 맞댐선 한 벌");

  // 포맷 경계: cubic 이 새어 나가면 designRenderer 가 invalid-primitive 로 깨진다
  const leaks = [].concat(r.outline, r.construction, r.joinSeam).filter(p => p.kind === "cubic");
  ok(leaks.length === 0, "1: geometry 포맷만 내보낸다(kind:\"cubic\" 누출 0)");

  // 의미 모서리 승계
  const edges = r.outline.map(p => p.edge);
  ok(edges.filter(e => e === "center").length === 1 && edges.filter(e => e === "hem").length === 2,
    "1: edge 의미가 승계된다(center 1 · hem 2)");
  ok(edges.indexOf("armhole") < 0, "1: 맞댄 변(armhole)은 외곽에 남지 않는다");

  // 결정론
  ok(J(G.buttJoin(spec1())) === J(r), "1: 같은 입력 → 같은 결과(결정론)");
}

// 2. 회전이 필요한 배치 — B 를 임의 강체 변환해 두고 같은 결과가 나오는지
{
  const base = spec1();
  const ref = G.buttJoin(spec1());
  const rad = 37 * Math.PI / 180, c = Math.cos(rad), sn = Math.sin(rad);
  const mv = (p) => ({ x: (p.x - 20) * c - (p.y - 5) * sn + 43, y: (p.x - 20) * sn + (p.y - 5) * c - 17 });
  const s = spec1();
  s.b.piece.outline = base.b.piece.outline.map(pr => {
    const q = JSON.parse(J(pr));
    q.from = mv(q.from); q.to = mv(q.to);
    return q;
  });
  s.b.start = mv(base.b.start); s.b.end = mv(base.b.end);

  const r = G.buttJoin(s);
  ok(near(((r.transform.rotationDeg % 360) + 360) % 360, ((-37 % 360) + 360) % 360, 1e-9),
    "2: 회전을 정확히 되돌린다(−37°)");
  ok(near(r.areaJoinedCm2, 200, 1e-8) && near(r.areaDeltaCm2, 0, 1e-8), "2: 회전 후에도 면적 = 합");
  // 결과 형상이 회전 전 배치와 같은가 (강체 변환 불변)
  const pts = (rr) => { const o = []; T.outlinePrimsToSegs(rr.outline).forEach(sg => T.flattenLine([sg]).forEach(ab => o.push(ab[0]))); return o; };
  const p1 = pts(ref), p2 = pts(r);
  let worst = 0;
  ok(p1.length === p2.length, "2: 세그먼트 구조 동일");
  for (let i = 0; i < Math.min(p1.length, p2.length); i++) worst = Math.max(worst, D(p1[i], p2[i]));
  ok(worst < 1e-9, "2: 회전 배치에서도 같은 형상으로 복원(" + worst.toExponential(1) + ")");
}

// 3. 곡선 봉제선 — A 의 볼록한 배가 B 의 오목한 자리에 들어간다
{
  // A 오른변: (10,0)→(10,10) 이 x=13 쪽으로 부푼다.
  // B 왼변: 같은 곡선을 **역방향**으로 — (20,10)→(20,0), 제어점 x=23.
  const aSeam = CU([10, 0], [13, 3], [13, 7], [10, 10], "armhole");
  const bSeam = CU([20, 10], [23, 7], [23, 3], [20, 0], "armhole");
  const s = Object.assign({ joinPairId: "yoke-1" }, squares({ aSeam, bSeam }));
  const r = G.buttJoin(s);

  ok(near(r.seamLenDeltaCm, 0, 1e-9), "3: 곡선 봉제선 길이 일치");
  ok(r.seamLenACm > 10, "3: 곡선이라 직선보다 길다(" + r.seamLenACm.toFixed(4) + ")");
  ok(near(r.maxSeamDeviationCm, 0, 1e-9), "3: 곡선 형상이 정확히 맞물린다");
  ok(r.areaACm2 > 100 && r.areaBCm2 < 100, "3: A 는 볼록해 커지고 B 는 오목해 작아진다");
  ok(near(r.areaACm2 + r.areaBCm2, 200, 1e-6), "3: 볼록·오목이 정확히 상쇄된다");
  ok(near(r.areaJoinedCm2, 200, 1e-6), "3: 맞댄 결과는 10×20(부푼 자리가 메워진다)");
  ok(near(primsLen(r.outline), 60, 1e-6), "3: 맞댄 둘레 60(곡선 봉제선이 둘 다 빠진다)");

  // ★ 길이는 같고 **방향으로 부푼 쪽이 반대**인 봉제선 — 길이 검사만으로는 못 잡는다
  const mirrored = CU([20, 10], [17, 7], [17, 3], [20, 0], "armhole");
  const bad = Object.assign({ joinPairId: "yoke-1" }, squares({ aSeam, bSeam: mirrored }));
  const lenSame = Math.abs(primsLen([aSeam]) - primsLen([mirrored]));
  ok(lenSame < 1e-9, "3: (대조군) 반대로 부푼 봉제선은 길이가 같다");
  throwsReason(() => G.buttJoin(bad), "seam-shape-mismatch", "3: 형상이 다르면 거부한다");
}

// 4. construction 은 B 쪽만 같은 강체 변환으로 따라온다
{
  const aC = [Object.assign(L([2, 2], [2, 8]), { dart: { id: "a-guide", boundary: "hem" } })];
  const bC = [L([25, 2], [25, 8])];
  const s = Object.assign({ joinPairId: "yoke-1" }, squares({ aConstr: aC, bConstr: bC }));
  const r = G.buttJoin(s);
  ok(r.construction.length === 2, "4: construction 은 A+B 둘 다 유지");
  const a0 = ends(r.construction[0]), b0 = ends(r.construction[1]);
  ok(near(a0.from.x, 2) && near(a0.to.y, 8), "4: A 의 construction 은 그대로");
  ok(near(b0.from.x, 15) && near(b0.from.y, 2) && near(b0.to.x, 15), "4: B 의 construction 이 함께 옮겨진다(x−10)");
  ok(r.construction[0].dart && r.construction[0].dart.id === "a-guide", "4: 다트 선언이 승계된다");
  // 값 복제인가(참조 공유면 결과를 만지면 입력이 오염된다)
  r.construction[0].dart.id = "TOUCHED";
  ok(aC[0].dart.id === "a-guide", "4: 다트는 참조가 아니라 값으로 복제된다");
}

// 5. 쌍 불일치 — 같은 표시의 반원끼리만 맞댄다(P.159)
{
  throwsReason(() => { const s = spec1(); s.b.pairId = "yoke-2"; return G.buttJoin(s); },
    "pair-mismatch", "5: B 표시가 다르면 거부");
  throwsReason(() => { const s = spec1(); s.a.pairId = "other"; return G.buttJoin(s); },
    "pair-mismatch", "5: A 표시가 다르면 거부");
  throwsReason(() => { const s = spec1(); s.joinPairId = ""; return G.buttJoin(s); },
    "invalid-join-pair-id", "5: 빈 joinPairId 거부");
  throwsReason(() => { const s = spec1(); delete s.joinPairId; return G.buttJoin(s); },
    "invalid-join-pair-id", "5: joinPairId 없으면 거부(추측하지 않는다)");
  throwsReason(() => G.buttJoin(null), "invalid-spec", "5: spec 없으면 거부");
}

// 6. 퇴화 구간 · 경계 밖 · 잘못된 입력
{
  throwsReason(() => { const s = spec1(); s.a.end = { x: 10, y: 0 }; return G.buttJoin(s); },
    "degenerate-interval", "6: 양끝이 같은 지점이면 거부");
  throwsReason(() => { const s = spec1(); s.a.start = { x: 5, y: 5 }; return G.buttJoin(s); },
    "interval-off-boundary", "6: 구간 끝점이 경계에서 벗어나면 거부");
  throwsReason(() => { const s = spec1(); s.b.end = { x: 24, y: 5 }; return G.buttJoin(s); },
    "interval-off-boundary", "6: B 쪽도 같게 거부");
  throwsReason(() => { const s = spec1(); s.a.start = { x: 10, y: NaN }; return G.buttJoin(s); },
    "invalid-join-point", "6: NaN 좌표 거부");
  throwsReason(() => { const s = spec1(); s.b.piece.outline = []; return G.buttJoin(s); },
    "invalid-piece", "6: 빈 외곽 거부");
  throwsReason(() => { const s = spec1(); delete s.b; return G.buttJoin(s); },
    "invalid-side", "6: 한쪽이 없으면 거부");
  throwsReason(() => G.buttJoin(spec1(), { lenTol: 0 }), "invalid-tolerance", "6: 0 허용오차 거부");
}

// 7. 길이 불일치 — 같은 봉제선이 아니다
{
  const s = Object.assign({ joinPairId: "yoke-1" }, squares({ bh: 12 }));
  throwsReason(() => G.buttJoin(s), "length-mismatch", "7: 봉제선 길이가 다르면 거부");
  try { G.buttJoin(s); } catch (e) {
    ok(near(e.detail.aCm, 10) && near(e.detail.bCm, 12), "7: 실측 길이를 detail 로 알려준다");
  }
  // 허용오차 안이면 통과하고 차이를 기록한다
  const s2 = Object.assign({ joinPairId: "yoke-1" }, squares({ bh: 10.005 }));
  const r2 = G.buttJoin(s2);
  ok(near(r2.seamLenDeltaCm, -0.005, 1e-12), "7: 허용오차 안의 차이는 숨기지 않고 기록");
  ok(r2.residualGapCm > 0 && r2.residualGapCm <= 0.01, "7: 남은 이음 틈도 기록(" + r2.residualGapCm.toFixed(6) + ")");
}

// 8. 링 토폴로지 — 닫히지 않은 외곽 · 끊어진 체인 · 면적 0
{
  throwsReason(() => { const s = spec1(); s.a.piece.outline.pop(); return G.buttJoin(s); },
    "ring-not-closed", "8: 닫히지 않은 외곽 거부(폐곡선 두 장이 전제)");
  throwsReason(() => { const s = spec1(); s.a.piece.outline.push(L([50, 50], [55, 55])); return G.buttJoin(s); },
    "outline-not-single-chain", "8: 떨어진 세그먼트가 있으면 거부");
  throwsReason(() => { const s = spec1(); s.a.piece.outline = [L([0, 0], [10, 0])]; return G.buttJoin(s); },
    "outline-too-short", "8: 세그먼트 1개 거부");
  throwsReason(() => {
    const s = spec1();
    s.a.piece.outline = [L([0, 0], [10, 0]), L([10, 0], [10, 0.0005]), L([10, 0.0005], [0, 0.0005]), L([0, 0.0005], [0, 0])];
    return G.buttJoin(s);
  }, "zero-area", "8: 면적 0 조각 거부");
}

// 9. ★ 방향 계약 · 겹침 거부 · 1차 구현의 한계
{
  // (a) 부분 변을 맞댄다 — A 오른변의 가운데 2cm 에 6×2 바를 붙인다.
  //     B 는 제 좌표계에 따로 놓여 있고, 모듈이 강체 변환으로 데려온다.
  const partial = () => ({
    joinPairId: "yoke-1",
    a: { pairId: "yoke-1", start: { x: 10, y: 4 }, end: { x: 10, y: 6 }, piece: {
      outline: [
        L([0, 0], [10, 0], "shoulder"), L([10, 0], [10, 4], "side-seam"),
        L([10, 4], [10, 6], "armhole"), L([10, 6], [10, 10], "side-seam"),
        L([10, 10], [0, 10], "hem"), L([0, 10], [0, 0], "center")
      ], construction: [] } },
    b: { pairId: "yoke-1", start: { x: 0, y: 2 }, end: { x: 0, y: 0 }, piece: {
      outline: [L([0, 0], [6, 0], "hem"), L([6, 0], [6, 2], "side-seam"), L([6, 2], [0, 2], "hem"), L([0, 2], [0, 0], "armhole")],
      construction: [] } }
  });
  const r = G.buttJoin(partial());
  ok(near(r.seamLenACm, 2) && near(r.seamLenBCm, 2), "9: 변의 일부(2cm)만 맞댈 수 있다");
  ok(near(r.areaACm2, 100) && near(r.areaBCm2, 12), "9: 원본 면적 100 · 12");
  ok(near(r.areaJoinedCm2, 112, 1e-9) && near(r.areaDeltaCm2, 0, 1e-9), "9: 맞댄 면적 = 112(합)");
  const xs = [];
  T.outlinePrimsToSegs(r.outline).forEach(sg => T.flattenLine([sg]).forEach(ab => xs.push(ab[0].x, ab[1].x)));
  ok(near(Math.max(...xs), 16), "9: 바가 A 바깥(x=16)으로 뻗는다 — 겹치지 않는다");
  ok(near(primsLen(r.outline), 40 + 16 - 2 * 2, 1e-9), "9: 둘레 = A+B−2·봉제선");

  // (b) 구간 끝점을 뒤집으면 **반대쪽 호**가 선택된다 → 길이 검사가 잡는다.
  //     (forward 호 규약이 스스로를 보호한다 — 조용히 다른 데를 맞대지 않는다.)
  throwsReason(() => { const s = partial(); const t0 = s.b.start; s.b.start = s.b.end; s.b.end = t0; return G.buttJoin(s); },
    "length-mismatch", "9: 구간 끝점을 뒤집으면 반대쪽 호가 되어 거부된다");

  // (c) 겹치는 배치는 거부한다 — 봉제선 길이·형상이 맞아도 조각이 서로를 덮으면 종이가
  //     아니다(제1법칙). B 를 A 위로 되짚어 오는 갈고리 형태로 만들어 시험한다.
  const overlap = {
    joinPairId: "yoke-1",
    a: { pairId: "yoke-1", start: { x: 10, y: 0 }, end: { x: 10, y: 10 }, piece: {
      outline: [L([0, 0], [10, 0], "shoulder"), L([10, 0], [10, 10], "armhole"), L([10, 10], [0, 10], "hem"), L([0, 10], [0, 0], "center")],
      construction: [] } },
    b: { pairId: "yoke-1", start: { x: 10, y: 10 }, end: { x: 10, y: 0 }, piece: {
      outline: [
        L([10, 10], [10, 0], "armhole"), L([10, 0], [14, 0]), L([14, 0], [14, 12]),
        L([14, 12], [-2, 12]), L([-2, 12], [-2, 8]), L([-2, 8], [5, 8]), L([5, 8], [5, 10]), L([5, 10], [10, 10])
      ], construction: [] } }
  };
  throwsReason(() => G.buttJoin(JSON.parse(J(overlap))), "self-intersection", "9: 겹치는 배치 거부");

  // (d) ★ 1차 구현의 한계(기록) — **정확히 들어맞는 홈을 메우는** 배치는 결과 경계가
  //     서로 맞닿아 self-intersection 으로 거부된다. 면적은 맞지만(겹치지 않는다) 외곽이
  //     내부선을 지나므로 현재 판정으로는 통과시킬 수 없다. 맞닿은 경계를 정식으로
  //     처리하려면 별도 설계가 필요하다 — 조용히 통과시키지 않고 여기 고정해 둔다.
  const notchFill = {
    joinPairId: "yoke-1",
    a: { pairId: "yoke-1", start: { x: 6, y: 4 }, end: { x: 6, y: 6 }, piece: {
      outline: [
        L([0, 0], [10, 0], "shoulder"), L([10, 0], [10, 4], "side-seam"),
        L([10, 4], [6, 4]), L([6, 4], [6, 6], "armhole"), L([6, 6], [10, 6]),
        L([10, 6], [10, 10], "side-seam"), L([10, 10], [0, 10], "hem"), L([0, 10], [0, 0], "center")
      ], construction: [] } },
    b: { pairId: "yoke-1", start: { x: 6, y: 4 }, end: { x: 6, y: 6 }, piece: {
      outline: [L([0, 4], [6, 4], "hem"), L([6, 4], [6, 6], "armhole"), L([6, 6], [0, 6], "hem"), L([0, 6], [0, 4], "center")],
      construction: [] } }
  };
  throwsReason(() => G.buttJoin(notchFill), "self-intersection", "9: (한계) 맞닿는 홈 메우기는 아직 거부한다");
}

// 10. 순수성 — DOM·storage 를 쓰지 않는다(document 없는 샌드박스에서 이미 로드·실행됐다)
{
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designJoin.js"), "utf8");
  const banned = ["document.", "localStorage", "window.render", "render()", "getElementById", "state."];
  const hit = banned.filter(k => src.indexOf(k) >= 0);
  ok(hit.length === 0, "10: DOM/render/storage 미접근(" + hit.join(",") + ")");
  ok(src.indexOf("designLineTool") >= 0, "10: designLineTool 순수 헬퍼를 베끼지 않고 쓴다");
}

// ── 결과 ──
console.log(`designJoinCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exitCode = 1; }
else console.log("전부 통과 ✓");
