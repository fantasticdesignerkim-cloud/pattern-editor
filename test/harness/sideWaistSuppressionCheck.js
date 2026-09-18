// ══════════════════════════════════════════════
// sideWaistSuppressionCheck.js — 옆선 허리 조임(c) 승격 회귀.
//
// 도메인 결정: shared-waist-c 는 봉제해서 닫는 다트가 아니라 앞·뒤 옆선에 분배된 허리 조임이다.
// 앞판 최종 옆선 = SIDE_TOP→c.right(FRONT_SIDE_WL), 뒤판 = SIDE_TOP→c.left(BACK_SIDE_WL). draft 가 단일 원천.
// SIDE_TOP→SIDE_BTM 중앙선은 기준선일 뿐 외곽선 끝점이 아니다. c 는 구조화 다트/attachment/carry 대상이 아니다.
// 옆선·허리 외 primitive, a/b/d/e/f 다리·apex 좌표는 승격 전과 동일해야 한다(아래 PRE_* 는 승격 직전
// HEAD 88d1509 의 엔진 출력에서 기록한 값).
//
//   node test/harness/sideWaistSuppressionCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe } = require("./dartDriver");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const nearPt = (p, q, e = 1e-9) => near(p.x, q.x, e) && near(p.y, q.y, e);
const dims = { B: 83, W: 64, BL: 38 };
const hashStr = (s) => { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(16) + ":" + s.length; };
const SIDE_WAIST = new Set(["side-seam", "front-waist", "back-waist"]);

// 승격 직전(HEAD 88d1509) 기록값
const PRE_OTHER_OUTLINE_HASH = { front: "3f980a6c:11980", back: "965bfedd:1391" };
const PRE_WAIST_DARTS = {"a":{"apex":{"x":38.512499999999996,"y":22.616666666666667},"left":{"x":37.637499999999996,"y":38},"right":{"x":39.387499999999996,"y":38}},"b":{"apex":{"x":29.83125,"y":14.808333333333334},"left":{"x":28.89375,"y":38},"right":{"x":30.76875,"y":38}},"d":{"apex":{"x":16.775,"y":14.808333333333334},"left":{"x":14.587499999999999,"y":38},"right":{"x":18.9625,"y":38}},"e":{"apex":{"x":9.3875,"y":18.616666666666667},"left":{"x":8.2625,"y":38},"right":{"x":10.5125,"y":38}},"f":{"apex":{"x":0,"y":12.205555555555556},"left":{"x":-0.43750000000000006,"y":38},"right":{"x":0.43750000000000006,"y":38}}};

const { engine } = createEngine();
const d = engine.createDraft(83, 64, 38), p = d.pts;

// 1. draft 단일 원천: c 분배점
{
  const half = d.darts.c / 2;
  ok(nearPt(p.FRONT_SIDE_WL, { x: p.SIDE_TOP.x + half, y: p.SIDE_BTM.y }) && nearPt(p.BACK_SIDE_WL, { x: p.SIDE_TOP.x - half, y: p.SIDE_BTM.y }),
    "1: FRONT_SIDE_WL = c.right, BACK_SIDE_WL = c.left (허리선 위 SIDE_TOP.x ± c/2)");
  ok(p.SIDE_BTM.x === p.SIDE_TOP.x && typeof d.darts.c === "number" && d.darts.c > 0, "1: 중앙 SIDE_BTM·c 분량은 기준값으로 유지");
}

// 2. unmoved 엔진 외곽: 옆선·허리 끝점 승격, 중앙 SIDE_BTM 은 외곽 끝점 아님, identity·방향 유지
[["front", engine.buildFrontOutline(p, d.formula, 83), p.FRONT_SIDE_WL, "front-waist"],
 ["back", engine.buildBackOutline(p, d.formula, 83), p.BACK_SIDE_WL, "back-waist"]].forEach(([side, segs, S, waistType]) => {
  const ss = segs.filter(s => s.type === "side-seam"), ws = segs.filter(s => s.type === waistType);
  ok(ss.length === 1 && nearPt(ss[0].from, S) && nearPt(ss[0].to, p.SIDE_TOP), "2: " + side + " 옆선 = 새 옆선 허리점→SIDE_TOP");
  ok(ss[0].boundaryRoot === side + "/side-seam" && ss[0].boundaryFromT === 1 && ss[0].boundaryToT === 0, "2: " + side + " 옆선 root·방향(진동밑 0→허리 1) 유지");
  ok(ws.length === 1 && nearPt(ws[0].to, S) && ws[0].boundaryRoot === side + "/waist" && ws[0].boundaryFromT === 0 && ws[0].boundaryToT === 1, "2: " + side + " 허리 root 중심(0)→새 옆 점(1)");
  ok(segs.every(s => !nearPt(s.from, p.SIDE_BTM, 1e-6) && !nearPt(s.to, p.SIDE_BTM, 1e-6)), "2: " + side + " 중앙 SIDE_BTM 은 외곽 끝점 아님");
  ok(hashStr(JSON.stringify(segs.filter(s => !SIDE_WAIST.has(s.type)))) === PRE_OTHER_OUTLINE_HASH[side], "2: " + side + " 옆선·허리 외 primitive 는 승격 전과 byte 동일");
});

// 3. c 는 다트가 아니다: 단일 원천·payload·attachment 에서 제거, a/b/d/e/f 다리·apex 불변, attach t 는 새 허리 root 기준
{
  const darts = engine.buildGen0WaistDarts(d.formula, p, d.darts);
  ok(JSON.stringify(Object.keys(darts)) === JSON.stringify(["a", "b", "d", "e", "f"]), "3: gen-0 허리다트 = a,b,d,e,f (c 없음)");
  ok(Object.keys(PRE_WAIST_DARTS).every(k => ["apex", "left", "right"].every(q => JSON.stringify(darts[k][q]) === JSON.stringify(PRE_WAIST_DARTS[k][q]))), "3: a/b/d/e/f 다리·apex 좌표 승격 전과 동일");
  let aligned = true;
  ["a", "b", "d", "e", "f"].forEach(k => {
    const at = engine.gen0WaistDartAttach(p, k, darts[k]);
    ["left", "right"].forEach(leg => {
      if (!at[leg]) return;
      const piece = at[leg].root.split("/")[0], C = piece === "front" ? p.FRONT_WL : p.BACK_WL, S = piece === "front" ? p.FRONT_SIDE_WL : p.BACK_SIDE_WL;
      const q = { x: C.x + (S.x - C.x) * at[leg].t, y: C.y + (S.y - C.y) * at[leg].t };
      if (!nearPt(q, darts[k][leg], 1e-9) || at[leg].t < 0 || at[leg].t > 1) aligned = false;
    });
  });
  ok(aligned, "3: a/b/d/e/f attachment t = 새 허리 root 위 같은 물리점");
  ok(!("c" in engine.gen0WaistDartPayload("front", d.formula, p, d.darts)) && !("c" in engine.gen0WaistDartPayload("back", d.formula, p, d.darts)), "3: carry payload 에 c 없음");
}

// 4. dartMove 후 baked: 옆선 root 허리 끝(t=1)의 실제 점이 (강체 변환된) 새 옆선 허리점과 일치, 허리다트 정합
function evalRoot(segs, root, t) {
  return segs.filter(s => s.boundaryRoot === root && t >= Math.min(s.boundaryFromT, s.boundaryToT) - 1e-9 && t <= Math.max(s.boundaryFromT, s.boundaryToT) + 1e-9)
    .map(s => { const u = (t - s.boundaryFromT) / (s.boundaryToT - s.boundaryFromT); return { x: s.from.x + (s.to.x - s.from.x) * u, y: s.from.y + (s.to.y - s.from.y) * u }; });
}
[["front", ["front-neckline", 0.4, "A", 1.0]], ["front", ["front-armhole-upper", 0.5, "B", 0.4]], ["front", ["front-waist", 0.6, "A", 0.5]],
 ["back", ["back-waist", 0.55, "A", 0.5]], ["back", ["back-armhole", 0.4, "A", 0.6]]].forEach(([side, m]) => {
  const { engine: e } = createEngine();
  const res = applyRecipe(e, side, dims, { type: m[0], arcFraction: m[1], piece: m[2], moveFraction: m[3] });
  const name = side + " " + m[0] + " " + m[2] + "×" + m[3];
  ok(res.status === "applied", "4: " + name + " 적용");
  if (res.status !== "applied") return;
  const segs = res.bakedSegments;
  const S = side === "front" ? p.FRONT_SIDE_WL : p.BACK_SIDE_WL;
  const sideEnd = evalRoot(segs, side + "/side-seam", 1), waistEnd = evalRoot(segs, side + "/waist", 1);
  ok(sideEnd.length >= 1 && waistEnd.length >= 1 && sideEnd.some(q => waistEnd.some(w => nearPt(q, w, 1e-6))), "4: " + name + " 옆선 t=1 과 허리 t=1 이 같은 점(최종 형상 접합)");
  const pivot = res.pivot, rot = (pt, a) => ({ x: pivot.x + (pt.x - pivot.x) * Math.cos(a) - (pt.y - pivot.y) * Math.sin(a), y: pivot.y + (pt.x - pivot.x) * Math.sin(a) + (pt.y - pivot.y) * Math.cos(a) });
  const ang = res.userAngleDeg * Math.PI / 180;
  ok(sideEnd.some(q => nearPt(q, S, 1e-6) || nearPt(q, rot(S, ang), 1e-6)) || m[0] === "front-waist" || m[0] === "back-waist",
    "4: " + name + " 옆선 허리 끝 = 새 옆선 허리점(고정 또는 이번 회전)");
  ok(segs.every(s => !nearPt(s.from, p.SIDE_BTM, 1e-6) && !nearPt(s.to, p.SIDE_BTM, 1e-6)), "4: " + name + " 중앙 SIDE_BTM 이 baked 끝점에 없음");
  const pl = side === "front" ? e.dartMoveState.appliedFront.waistDarts : e.dartMoveState.appliedBack.waistDarts;
  const legAligned = Object.values(pl).filter(x => !x.unresolved).every(x => (x.onFold ? ["right"] : ["left", "right"]).every(l => evalRoot(segs, x.attach[l].root, x.attach[l].t).some(q => nearPt(q, x.dart[l], 1e-3))));
  ok(legAligned && !("c" in pl), "4: " + name + " 허리다트 carry 정합·c 없음");
});

// 5. Design 변환(여유량·허리 이동·허리 아래 길이) + seam-ready evidence, v6 legacy 미승격
const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
let PROJECT = null;
const sb = { window: { designLineTool: { buildPieceRing: () => ({ ok: true }) }, designWorkflow: { current: () => PROJECT } },
  console: { log() {}, warn() {}, error() {} }, structuredClone, Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN, Date };
sb.globalThis = sb; vm.createContext(sb);
["designBodice.js", "bodiceCheckpoint.js"].forEach(f => vm.runInContext(JS(f), sb, { filename: f }));
const DB = sb.window.designBodice, BC = sb.window.bodiceCheckpoint;
function loadLT() { const s2 = { window: {}, document: {}, console: { log() {}, warn() {} }, structuredClone, Math, JSON, Object, Array, Number, isFinite, Error, Infinity, NaN }; s2.globalThis = s2; vm.createContext(s2); vm.runInContext(JS("designLineTool.js"), s2); return s2.window.designLineTool; }
// 엔진 unmoved 외곽을 design geometry(line primitive + edge + boundary)로 옮긴다. 곡선도 샘플 line 으로 둔다.
const EDGE = { "front-center": "center", "back-center": "center", "front-waist": "waist", "back-waist": "waist", "side-seam": "side-seam",
  "front-shoulder": "shoulder", "back-shoulder": "shoulder", "front-armhole-lower": "armhole", "front-armhole-upper": "armhole", "back-armhole": "armhole",
  "front-neckline": "neckline", "back-neckline": "neckline" };
function designPiece(segs, side) {
  const outline = segs.filter(s => !s.disabled).map(s => ({ kind: "line", from: { ...s.from }, to: { ...s.to }, edge: EDGE[s.type],
    boundary: { root: s.boundaryRoot, ranges: [[s.boundaryFromT, s.boundaryToT]] } }));
  const darts = engine.buildGen0WaistDarts(d.formula, p, d.darts);
  const keys = side === "front" ? ["a", "b"] : ["d", "e", "f"];
  const construction = [];
  keys.forEach(k => {
    const at = engine.gen0WaistDartAttach(p, k, darts[k]);
    ["left", "right"].forEach(leg => { if (!at[leg]) return;
      const o = { kind: "line", from: { ...darts[k][leg] }, to: { ...darts[k].apex }, dart: { id: (side === "front" ? "front" : "back") + "-waist-" + k, boundary: "waist", apexAt: "to", attach: at[leg] } };
      if (k === "f") o.dart.onFold = true; construction.push(o); });
  });
  return { outline, construction };
}
const geom0 = { front: designPiece(engine.buildFrontOutline(p, d.formula, 83), "front"), back: designPiece(engine.buildBackOutline(p, d.formula, 83), "back"),
  shared: { outline: [], construction: [] }, sleeve: { outline: [], construction: [] } };
const proj = (sv, g) => ({ sourceBlock: { version: 1, schemaVersion: sv }, working: { geometry: g, parameters: { neckline: { mode: "parametric", type: "round", parameters: {} } }, designOutline: null, frontPlacket: null, patternLines: [] } });
const waistRecs = (r) => r.darts.front.concat(r.darts.back).filter(x => /waist/.test(x.id));
[["unmoved", {}], ["ease 4", { bustEaseCm: 4 }], ["waist offset -2", { waistSideOffsetCm: -2 }], ["ease 4 + waist -1", { bustEaseCm: 4, waistSideOffsetCm: -1 }]].forEach(([name, body]) => {
  const g = DB.computeGeometry(geom0, { body });
  const sem = BC.evaluateSemantics(proj(7, g));
  ok(waistRecs(sem).length === 5 && waistRecs(sem).every(x => x.attachment === "complete"), "5: " + name + " a/b/d/e/f attachment complete");
  ok(sem.darts.shared.length === 0 && sem.issues.indexOf("dart-attachment-misaligned") < 0, "5: " + name + " shared c 다트 record 없음·misaligned 없음");
  ["front", "back"].forEach(pc => {
    const ss = g[pc].outline.filter(x => x.edge === "side-seam"), w = g[pc].outline.concat(g[pc].construction).filter(x => x.edge === "waist");
    const shared = ss.some(s => w.some(wl => [s.from, s.to].some(a => [wl.from, wl.to].some(b => nearPt(a, b, 1e-9)))));
    ok(ss.length === 1 && shared && ss[0].boundary.root === pc + "/side-seam", "5: " + name + " " + pc + " 옆선·허리 접합·root 유지");
  });
});
{
  // 허리 아래: 기존 수직 연장 규칙이 새 옆선 허리점에서 시작(기울기 연장·곡선화 없음)
  const g = DB.computeGeometry(geom0, { body: { hemExtensionBelowWaistCm: 10 } });
  ["front", "back"].forEach(pc => {
    const S = pc === "front" ? p.FRONT_SIDE_WL : p.BACK_SIDE_WL;
    const ext = g[pc].outline.filter(x => x.boundary && x.boundary.root === pc + "/side-seam-extension");
    ok(ext.length === 1 && nearPt(ext[0].from, S, 1e-9) && near(ext[0].to.x, S.x, 1e-9) && near(ext[0].to.y, S.y + 10, 1e-9), "5: " + pc + " 허리 아래 연장 = 새 옆선 허리점에서 수직 10cm");
  });
  ok(waistRecs(BC.evaluateSemantics(proj(7, g))).every(x => x.attachment === "complete"), "5: 길이 연장 후에도 허리다트 정합");
}
{
  const r6 = BC.evaluateSemantics(proj(6, geom0));
  ok(r6.ready === false && r6.issues.indexOf("legacy-source") >= 0, "5: v6 출처는 legacy-source(현재 seam-ready 로 승격 안 함)");
  ok(BC.evaluateSemantics(proj(7, geom0)).ready === true, "5: v7 동일 형상은 ready");
}

// 6. 몸판 체크포인트 옆선 측정 = 유효 외곽(designOutline 우선)의 명시 side-seam 만. 측정 불가는 0cm 정합이 아니라 차단.
{
  // 기준 수치 고정: B83/W64/BL38 → totalDart 12.5, c = 11% = 1.375, 앞·뒤 각 0.6875
  ok(near(d.darts.total, 12.5) && near(d.darts.c, 1.375) && near(p.FRONT_SIDE_WL.x - p.SIDE_TOP.x, 0.6875) && near(p.SIDE_TOP.x - p.BACK_SIDE_WL.x, 0.6875),
    "6: c = 12.5×0.11 = 1.375, 앞·뒤 각 0.6875");
  // 원형 → 디자인(no-op) 로컬 옆선 끝점 동일, c 는 dart id 로 나타나지 않음
  const g0 = DB.computeGeometry(geom0, {});
  ["front", "back"].forEach(pc => {
    const S = pc === "front" ? p.FRONT_SIDE_WL : p.BACK_SIDE_WL, ss = g0[pc].outline.filter(x => x.edge === "side-seam");
    ok(ss.length === 1 && [ss[0].from, ss[0].to].some(q => nearPt(q, S)) && [ss[0].from, ss[0].to].some(q => nearPt(q, p.SIDE_TOP)), "6: " + pc + " 디자인 옆선 = SIDE_TOP↔옆선 허리점(원형과 동일)");
  });
  const ids = ["front", "back", "shared"].flatMap(pc => (g0[pc] ? g0[pc].construction : []).filter(x => x.dart).map(x => x.dart.id));
  ok(ids.length && ids.every(i => /-waist-[abdef]$/.test(i)), "6: 디자인 다트 id 는 a/b/d/e/f 뿐(c 없음)");

  // 진동을 곡선 primitive 로 둔 fixture(체크포인트 진동 측정용). 좌표·edge·boundary 는 geom0 그대로.
  const curveArm = (g) => { const o = JSON.parse(JSON.stringify(g)); ["front", "back"].forEach(pc => { o[pc].outline = o[pc].outline.map(x => (x.edge === "armhole" && x.kind === "line")
    ? Object.assign({ kind: "path", commands: [{ type: "M", points: [x.from] }, { type: "C", points: [x.from, x.to, x.to] }] }, { edge: x.edge, boundary: x.boundary }) : x); }); return o; };
  const G = curveArm(geom0);
  const LT = loadLT();
  const constr = (side) => (side === "front" ? engine.buildFrontOutline(p, d.formula, 83) : engine.buildBackOutline(p, d.formula, 83)).filter(x => x.disabled).map(x => ({ kind: "line", from: { ...x.from }, to: { ...x.to } }));
  const compose = (g, pc, lines) => { const ring = LT.buildPieceRing(LT.outlinePrimsToSegs(g[pc].outline), constr(pc)); const r = LT.composeDesignOutline(ring.ring, lines.map(LT.boundarySegsOf)); return r.ok ? r.outline : null; };
  const projDO = (g, dO, pls) => { const pr = proj(7, g); pr.working.designOutline = dO; pr.working.patternLines = pls || []; return pr; };
  const geomSide = (g, pc) => g[pc].outline.filter(x => x.edge === "side-seam").reduce((t, x) => t + (x.kind === "line" ? Math.hypot(x.to.x - x.from.x, x.to.y - x.from.y) : NaN), 0);
  const A = p.SIDE_TOP, S = p.FRONT_SIDE_WL;
  const bulge = (k, edge) => ({ id: "line-" + k, piece: "front", role: "boundary", segments: [Object.assign({ kind: "cubic", from: { ...A }, c1: { x: A.x - k, y: A.y + 5 }, c2: { x: S.x - k, y: S.y - 5 }, to: { ...S } }, edge ? { edge } : {})] });

  // 6a 정상(designOutline 없음): geometry 옆선 그대로 측정 — 기존 값·match·완료
  PROJECT = projDO(G, null);
  const c0 = BC.check(PROJECT);
  ok(c0.sideSeam.status === "match" && near(c0.sideSeam.front, geomSide(G, "front"), 1e-9) && near(c0.sideSeam.back, geomSide(G, "back"), 1e-9) && near(c0.sideSeam.diff, 0, 1e-9),
    "6a: designOutline 없음 → geometry 명시 옆선(기존 값) · match (" + c0.sideSeam.front.toFixed(4) + ")");
  ok(c0.fails.indexOf("side-seam-unmeasured") < 0 && c0.fails.indexOf("side-seam-mismatch") < 0, "6a: 옆선 실패 사유 없음");
  // 6b 옆선을 보존한 designOutline(다른 경계만 교체: 명시 edge 없는 generic 목선 대체 → unresolved 는 목선에만)
  const fnp = g0.front.outline.filter(x => x.edge === "neckline"), nkEnds = fnp.flatMap(x => [x.from, x.to]);
  const nkA = nkEnds.reduce((m, q) => q.y < m.y ? q : m), nkB = nkEnds.reduce((m, q) => q.x > m.x ? q : m);
  const neckGeneric = { id: "line-n", piece: "front", role: "boundary", segments: [{ kind: "line", from: { ...nkA }, to: { ...nkB } }] };
  const oNeck = compose(G, "front", [neckGeneric]);
  ok(!!oNeck && oNeck.some(x => x.edgeStatus === "unresolved") && oNeck.filter(x => x.edge === "side-seam").length === 1, "6b: 목선만 generic 대체 → unresolved 는 목선, 명시 옆선 보존");
  PROJECT = projDO(G, { front: { outline: oNeck, lineIds: ["line-n"] } }, [neckGeneric]);
  const cN = BC.check(PROJECT);
  ok(cN.sideSeam.status === "match" && near(cN.sideSeam.front, c0.sideSeam.front, 1e-9) && cN.fails.indexOf("side-seam-unmeasured") < 0, "6b: 다른 role 의 unresolved 는 옆선을 추측하지 않고 명시 옆선만 측정");
  ok(cN.semantics.issues.indexOf("unresolved-replacement") >= 0, "6b: 목선 unresolved 는 semantics 증거로 남음(완료 차단으로 일괄 승격 안 함)");
  // 6c 명시 side-seam 의미를 가진 대체선: 실제 새 길이 측정, 임계로 판정이 바뀜(원본 17.3969 재표시 금지)
  [[0.8, "match"], [1.5, "check"], [2.5, "mismatch"]].forEach(([k, want]) => {
    const bl = bulge(k, "side-seam"), o = compose(G, "front", [bl]);
    PROJECT = projDO(G, { front: { outline: o, lineIds: [bl.id] } }, [bl]);
    const c = BC.check(PROJECT), repl = o.filter(x => x.edge === "side-seam");
    ok(repl.length === 1 && repl[0].kind === "cubic" && !repl[0].edgeStatus, "6c: 명시 의미 대체선 = side-seam 구간(unresolved 아님) k=" + k);
    ok(c.sideSeam.status === want && c.sideSeam.front > c0.sideSeam.front + 0.05 && near(c.sideSeam.back, c0.sideSeam.back, 1e-9),
      "6c: 대체 옆선 실제 길이 " + c.sideSeam.front.toFixed(4) + " ≠ 원본 " + c0.sideSeam.front.toFixed(4) + " → " + want);
    if (want === "mismatch") ok(c.fails.indexOf("side-seam-mismatch") >= 0 && !BC.complete(PROJECT).ok && !PROJECT.working.bodiceResult, "6c: mismatch → 완료 차단·결과 없음");
  });
  // 6d 의미 없는 generic 대체선이 옆선을 삼킴 → 명시 옆선 없음 = unmeasured, 0cm 정합 금지, 완료 차단
  {
    const bl = bulge(1.5, null), o = compose(G, "front", [bl]);
    ok(!!o && o.filter(x => x.edge === "side-seam").length === 0 && o.some(x => x.edgeStatus === "unresolved"), "6d: generic 대체선 → 앞 유효 외곽에 명시 옆선 없음(unresolved)");
    PROJECT = projDO(G, { front: { outline: o, lineIds: [bl.id] } }, [bl]);
    const c = BC.check(PROJECT);
    ok(c.sideSeam.status === "unmeasured" && c.sideSeam.front === null && c.sideSeam.diff === null && near(c.sideSeam.back, c0.sideSeam.back, 1e-9), "6d: sideSeam = unmeasured(앞 null·diff null, 0cm 아님)");
    ok(c.fails.indexOf("side-seam-unmeasured") >= 0 && !c.ok, "6d: side-seam-unmeasured 로 check 차단");
    const r = BC.complete(PROJECT);
    ok(!r.ok && r.check.fails.indexOf("side-seam-unmeasured") >= 0 && !PROJECT.working.bodiceResult, "6d: complete 차단 · bodiceResult 미생성");
    ok(BC.measureSideSeam([]).status === "unavailable" && BC.measureSideSeam(null).length === null, "6d: measureSideSeam 빈 입력 = unavailable");
  }
  // 6e 길이 연장·허리 이동·곡선·여유량 조합: 명시 side-seam(연장 포함) 전체 합산, 앞·뒤 판정 유지
  [{ hemExtensionBelowWaistCm: 10 }, { hemExtensionBelowWaistCm: 10, waistSideOffsetCm: -2, sideSeamCurve: 1 }, { bustEaseCm: 4, hemExtensionBelowWaistCm: 12, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, sideSeamCurve: 0.6 }].forEach((body, i) => {
    const g = curveArm(DB.computeGeometry(geom0, { body }));
    PROJECT = projDO(g, null);
    const c = BC.check(PROJECT);
    const segs = pc => g[pc].outline.filter(x => x.edge === "side-seam");
    ok(segs("front").length === 2 && segs("front").some(x => x.boundary && x.boundary.root === "front/side-seam-extension"), "6e-" + i + ": 옆선 + 연장 두 구간 명시");
    ok(c.sideSeam.status === "match" && near(c.sideSeam.front, BC.measureSideSeam(g.front.outline).length, 1e-12) && near(c.sideSeam.back, BC.measureSideSeam(g.back.outline).length, 1e-12) && c.sideSeam.front > 20,
      "6e-" + i + ": 연장 포함 전체 합산 · 앞뒤 match (" + c.sideSeam.front.toFixed(4) + "/" + c.sideSeam.back.toFixed(4) + ")");
  });
  // 6f 허리 아래 연장이 있을 때: 연장(root …/side-seam-extension)만 남은 것은 기본 옆선의 증거가 아니다
  {
    const GH = curveArm(DB.computeGeometry(geom0, { body: { hemExtensionBelowWaistCm: 10 } }));
    const segLen = x => x.kind === "line" ? Math.hypot(x.to.x - x.from.x, x.to.y - x.from.y) : (() => { let t = 0, q = x.from; for (let i = 1; i <= 2000; i++) { const u = i / 2000, v = 1 - u;
      const r = { x: v*v*v*x.from.x + 3*v*v*u*x.c1.x + 3*v*u*u*x.c2.x + u*u*u*x.to.x, y: v*v*v*x.from.y + 3*v*v*u*x.c1.y + 3*v*u*u*x.c2.y + u*u*u*x.to.y }; t += Math.hypot(r.x - q.x, r.y - q.y); q = r; } return t; })();
    PROJECT = projDO(GH, null);
    const cH = BC.check(PROJECT);
    const upperF = GH.front.outline.filter(x => x.edge === "side-seam" && x.boundary.root === "front/side-seam");
    ok(cH.sideSeam.status === "match" && upperF.length === 1 && near(cH.sideSeam.front, geomSide(GH, "front"), 1e-9) && near(cH.sideSeam.front, segLen(upperF[0]) + 10, 1e-9), "6f: 정상 기본 옆선 + 연장 10 → 합계 측정·match");
    // generic 대체가 기본 옆선만 삼키고 연장만 남음 → unmeasured(연장 10cm 로 오인 금지)
    const gen = bulge(1.5, null), oG = compose(GH, "front", [gen]);
    ok(!!oG && oG.filter(x => x.edge === "side-seam").every(x => x.boundary && x.boundary.root === "front/side-seam-extension") && oG.some(x => x.edgeStatus === "unresolved"), "6f: generic 대체 후 남은 명시 옆선 = 연장뿐");
    PROJECT = projDO(GH, { front: { outline: oG, lineIds: [gen.id] } }, [gen]);
    const cG = BC.check(PROJECT);
    ok(cG.sideSeam.status === "unmeasured" && cG.sideSeam.front === null && cG.sideSeam.diff === null && cG.fails.indexOf("side-seam-unmeasured") >= 0, "6f: 연장만 남음 → front null·unmeasured·side-seam-unmeasured");
    const rG = BC.complete(PROJECT);
    ok(!rG.ok && !PROJECT.working.bodiceResult, "6f: 연장만 남음 → complete 차단·결과 없음");
    ok(BC.measureSideSeam(oG).status === "unavailable", "6f: measureSideSeam(연장만) = unavailable");
    // 명시 side-seam 의미의 대체선 + 연장 → 두 구간 합산 실제 길이
    const exp = bulge(1.5, "side-seam"), oE = compose(GH, "front", [exp]);
    PROJECT = projDO(GH, { front: { outline: oE, lineIds: [exp.id] } }, [exp]);
    const cE = BC.check(PROJECT), repl = oE.filter(x => x.edge === "side-seam" && !(x.boundary && /side-seam-extension$/.test(x.boundary.root)));
    ok(repl.length === 1 && cE.sideSeam.status !== "unmeasured" && near(cE.sideSeam.front, segLen(repl[0]) + 10, 1e-3) && cE.sideSeam.front > cH.sideSeam.front + 0.1, "6f: 명시 대체 + 연장 → 합산 실제 길이 (" + (cE.sideSeam.front || 0).toFixed(4) + ")");
    // 다른 role unresolved(목선) + 기본 옆선·연장 보존 → 측정 유지
    const oN = compose(GH, "front", [neckGeneric]);
    PROJECT = projDO(GH, { front: { outline: oN, lineIds: [neckGeneric.id] } }, [neckGeneric]);
    const cN2 = BC.check(PROJECT);
    ok(cN2.sideSeam.status === "match" && near(cN2.sideSeam.front, cH.sideSeam.front, 1e-9), "6f: 목선 unresolved + 옆선·연장 보존 → 측정 유지");
    // legacy 명시 edge(boundary 없음)는 기본 옆선으로 인정
    const leg = [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 0, y: 5 }, edge: "side-seam" }, { kind: "line", from: { x: 0, y: 5 }, to: { x: 0, y: 8 }, edge: "side-seam", boundary: { root: "front/side-seam-extension", ranges: [[0, 1]] } }];
    const mL = BC.measureSideSeam(leg);
    ok(mL.status === "measured" && near(mL.length, 8), "6f: legacy 명시 edge(boundary 없음) + 연장 → 측정 8");
  }
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
