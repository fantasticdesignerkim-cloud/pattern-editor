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

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
