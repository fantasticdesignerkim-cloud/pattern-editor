// ══════════════════════════════════════════════
// sideWaistDartCheck.js — 기본 수직 옆선 + 옆허리 다트 c(앞·뒤 반쪽) 원형·엔진 회귀.
//
// 도메인 계약(사용자 확정):
//  · 앞·뒤 기본 옆선 = SIDE_TOP→SIDE_BTM 수직 완성선(겹침 원형 화면에서 같은 위치). 허리 root 는 SIDE_BTM 에서 끝.
//  · c 는 논리적 하나의 옆허리 다트(총 intake darts.c). 앞·뒤 조각에 각각 c/2 반쪽 다트:
//    apex SIDE_TOP · 다리 SIDE_BTM · 다리 FRONT_SIDE_WL(앞) / BACK_SIDE_WL(뒤). group 으로 연결, 예산에서 한 번만.
//  · c 반쪽은 locked — 다트이동 carry·split·retarget 대상 아님(엔진 외곽·carry payload 에 없음).
//  · SIDE_TOP→*_SIDE_WL 사선은 다트선이지 외곽(side-seam)이 아니다.
//
//   node test/harness/sideWaistDartCheck.js
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

// 수직 옆선 도입 전후 모두 같은 a/b/d/e/f 다리·apex(HEAD 88d1509 엔진 출력 기록값)
const PRE_WAIST_DARTS = {"a":{"apex":{"x":38.512499999999996,"y":22.616666666666667},"left":{"x":37.637499999999996,"y":38},"right":{"x":39.387499999999996,"y":38}},"b":{"apex":{"x":29.83125,"y":14.808333333333334},"left":{"x":28.89375,"y":38},"right":{"x":30.76875,"y":38}},"d":{"apex":{"x":16.775,"y":14.808333333333334},"left":{"x":14.587499999999999,"y":38},"right":{"x":18.9625,"y":38}},"e":{"apex":{"x":9.3875,"y":18.616666666666667},"left":{"x":8.2625,"y":38},"right":{"x":10.5125,"y":38}},"f":{"apex":{"x":0,"y":12.205555555555556},"left":{"x":-0.43750000000000006,"y":38},"right":{"x":0.43750000000000006,"y":38}}};

const { engine } = createEngine();
const d = engine.createDraft(83, 64, 38), p = d.pts;

// 1. 원형 기준점·분량(B83/W64/BL38/total 12.5)
{
  ok(nearPt(p.SIDE_TOP, { x: 23.053125, y: 20.616666666666667 }, 1e-9) && nearPt(p.SIDE_BTM, { x: 23.053125, y: 38 }), "1: SIDE_TOP (23.053125,20.616667) · SIDE_BTM (23.053125,38)");
  ok(near(d.darts.total, 12.5) && near(d.darts.c, 1.375), "1: total 12.5 · c = 12.5×0.11 = 1.375");
  ok(nearPt(p.FRONT_SIDE_WL, { x: 23.740625, y: 38 }) && nearPt(p.BACK_SIDE_WL, { x: 22.365625, y: 38 }), "1: c 다리 끝 FRONT_SIDE_WL 23.740625 · BACK_SIDE_WL 22.365625");
  ok(near(["a", "b", "c", "d", "e", "f"].reduce((t, k) => t + d.darts[k], 0), 12.5), "1: a+b+c+d+e+f = 12.5");
}

// 2. 엔진 외곽: 앞·뒤 옆선 = SIDE_BTM→SIDE_TOP 수직, 허리 root 끝 = SIDE_BTM, c 사선은 외곽에 없음
[["front", engine.buildFrontOutline(p, d.formula, 83), "front-waist"], ["back", engine.buildBackOutline(p, d.formula, 83), "back-waist"]].forEach(([side, segs, waistType]) => {
  const ss = segs.filter(s => s.type === "side-seam"), ws = segs.filter(s => s.type === waistType);
  ok(ss.length === 1 && nearPt(ss[0].from, p.SIDE_BTM) && nearPt(ss[0].to, p.SIDE_TOP) && near(ss[0].from.x, ss[0].to.x), "2: " + side + " 옆선 = SIDE_BTM→SIDE_TOP 수직");
  ok(near(Math.hypot(ss[0].to.x - ss[0].from.x, ss[0].to.y - ss[0].from.y), 17.383333333333333, 1e-9), "2: " + side + " 옆선 길이 17.383333");
  ok(ss[0].boundaryRoot === side + "/side-seam" && ss[0].boundaryFromT === 1 && ss[0].boundaryToT === 0, "2: " + side + " 옆선 root·방향(진동밑 0→허리 1)");
  ok(ws.length === 1 && nearPt(ws[0].to, p.SIDE_BTM) && ws[0].boundaryRoot === side + "/waist" && ws[0].boundaryFromT === 0 && ws[0].boundaryToT === 1, "2: " + side + " 허리 root 중심(0)→SIDE_BTM(1)");
  const cEnd = side === "front" ? p.FRONT_SIDE_WL : p.BACK_SIDE_WL;
  ok(segs.every(s => !nearPt(s.from, cEnd, 1e-6) && !nearPt(s.to, cEnd, 1e-6)), "2: " + side + " c 다리 끝(" + (side === "front" ? "FRONT" : "BACK") + "_SIDE_WL)은 엔진 외곽 끝점이 아님");
  ok(segs.every(s => !/side-waist-c/.test(s.dartId || "")), "2: " + side + " c 는 엔진 외곽(다트이동 대상)에 없음");
});

// 3. c 반쪽 다트(단일 원천): identity·group·locked·apex·다리·intake·attachment, 예산에서 한 번만
const SC = engine.buildGen0SideWaistC(d.formula, p, d.darts);
{
  ok(SC.group === "side-waist-c" && near(SC.totalCm, 1.375), "3: logical group side-waist-c · total 1.375");
  [["front", SC.front, p.FRONT_SIDE_WL], ["back", SC.back, p.BACK_SIDE_WL]].forEach(([pc, h, leg]) => {
    ok(h.id === pc + "-side-waist-c" && h.piece === pc && h.group === SC.group && h.locked === true, "3: " + pc + " 반쪽 id·piece·group·locked");
    ok(nearPt(h.apex, p.SIDE_TOP) && nearPt(h.legs.side, p.SIDE_BTM) && nearPt(h.legs.intake, leg), "3: " + pc + " apex SIDE_TOP · 다리 SIDE_BTM · 다리 " + pc.toUpperCase() + "_SIDE_WL");
    ok(near(h.intakeCm, 0.6875, 1e-12), "3: " + pc + " intake c/2 = 0.6875");
    const C = pc === "front" ? p.FRONT_WL : p.BACK_WL, at = (t) => ({ x: C.x + (p.SIDE_BTM.x - C.x) * t, y: C.y });
    ok(h.attach.side.root === pc + "/waist" && near(h.attach.side.t, 1) && h.attach.intake.root === pc + "/waist" && nearPt(at(h.attach.intake.t), leg, 1e-9) && h.attach.intake.t < 1,
      "3: " + pc + " attach = 허리 root(SIDE_BTM t 1, 사선 다리 t = 같은 물리점)");
  });
  // 예산: a,b,d,e,f 폭 + group 당 c 한 번 = 12.5. 반쪽 intake 를 따로 더해도 c 와 같다(이중 계산 없음).
  const darts = engine.buildGen0WaistDarts(d.formula, p, d.darts);
  const wid = k => Math.abs(darts[k].right.x - darts[k].left.x);
  const byGroup = {}; [SC.front, SC.back].forEach(h => { byGroup[h.group] = (byGroup[h.group] || 0) + h.intakeCm; });
  ok(Object.keys(byGroup).length === 1 && near(byGroup[SC.group], SC.totalCm, 1e-12), "3: 반쪽 두 record 합 = group 총량 c(1.375)");
  ok(near(["a", "b", "d", "e", "f"].reduce((t, k) => t + wid(k), 0) + SC.totalCm, 12.5, 1e-9), "3: a,b,d,e,f + c(group 1회) = 12.5");
}

// 4. a/b/d/e/f 불변·새 허리 root attach·carry 에 c 없음
{
  const darts = engine.buildGen0WaistDarts(d.formula, p, d.darts);
  ok(JSON.stringify(Object.keys(darts)) === JSON.stringify(["a", "b", "d", "e", "f"]), "4: 이동 대상 gen-0 허리다트 = a,b,d,e,f (c 는 locked 별도)");
  ok(Object.keys(PRE_WAIST_DARTS).every(k => ["apex", "left", "right"].every(q => JSON.stringify(darts[k][q]) === JSON.stringify(PRE_WAIST_DARTS[k][q]))), "4: a/b/d/e/f 다리·apex 좌표 불변");
  let aligned = true;
  ["a", "b", "d", "e", "f"].forEach(k => {
    const at = engine.gen0WaistDartAttach(p, k, darts[k]);
    ["left", "right"].forEach(leg => {
      if (!at[leg]) return;
      const C = at[leg].root.startsWith("front") ? p.FRONT_WL : p.BACK_WL;
      const q = { x: C.x + (p.SIDE_BTM.x - C.x) * at[leg].t, y: C.y };
      if (!nearPt(q, darts[k][leg], 1e-9) || at[leg].t < 0 || at[leg].t > 1) aligned = false;
    });
  });
  ok(aligned, "4: a/b/d/e/f attachment t = 새 허리 root(→SIDE_BTM) 위 같은 물리점");
  ["front", "back"].forEach(side => {
    const pl = engine.gen0WaistDartPayload(side, d.formula, p, d.darts);
    ok(!("c" in pl) && Object.values(pl).every(x => !/side-waist-c/.test(x.id)), "4: " + side + " carry payload 에 c 없음");
  });
}

// 5. 가상 닫힘 허리(반패턴): 앞 20.134375 · 뒤 15.303125 · 합 35.4375 — c 는 각 조각에서 자기 c/2 만 닫힌다
{
  const darts = engine.buildGen0WaistDarts(d.formula, p, d.darts);
  const onPattern = (k, xmin, xmax) => Math.max(0, Math.min(darts[k].right.x, xmax) - Math.max(darts[k].left.x, xmin));
  const frontOpen = p.FRONT_WL.x - p.SIDE_BTM.x, backOpen = p.SIDE_BTM.x - p.BACK_WL.x;
  const frontClosed = frontOpen - (onPattern("a", p.SIDE_BTM.x, p.FRONT_WL.x) + onPattern("b", p.SIDE_BTM.x, p.FRONT_WL.x) + SC.front.intakeCm);
  const backClosed = backOpen - (onPattern("d", p.BACK_WL.x, p.SIDE_BTM.x) + onPattern("e", p.BACK_WL.x, p.SIDE_BTM.x) + onPattern("f", p.BACK_WL.x, p.SIDE_BTM.x) + SC.back.intakeCm);
  ok(near(frontOpen, 24.446875) && near(backOpen, 23.053125), "5: 펼친 허리 앞 24.446875 · 뒤 23.053125 (합 47.5)");
  ok(near(frontClosed, 20.134375, 1e-9) && near(backClosed, 15.303125, 1e-9) && near(frontClosed + backClosed, 35.4375, 1e-9), "5: 닫힌 허리 앞 20.134375 · 뒤 15.303125 · 합 35.4375");
  // 기록: 예산식 sw − total = 35.0 과의 차 0.4375 = f 의 CB 접힘 바깥 반쪽(이번 범위에서 해결하지 않음)
  ok(near((frontClosed + backClosed) - (p.FRONT_WL.x - d.darts.total), 0.4375, 1e-9), "5: 기록 — 예산식 35.0 과의 차 0.4375 = f 의 CB 바깥 반쪽");
}

// 6. dartMove 후: 옆선 t=1 = 허리 t=1 = SIDE_BTM(고정 또는 이번 회전), c 반쪽은 원형 그대로(locked)
function evalRoot(segs, root, t) {
  return segs.filter(s => s.boundaryRoot === root && t >= Math.min(s.boundaryFromT, s.boundaryToT) - 1e-9 && t <= Math.max(s.boundaryFromT, s.boundaryToT) + 1e-9)
    .map(s => { const u = (t - s.boundaryFromT) / (s.boundaryToT - s.boundaryFromT); return { x: s.from.x + (s.to.x - s.from.x) * u, y: s.from.y + (s.to.y - s.from.y) * u }; });
}
[["front", ["front-neckline", 0.4, "A", 1.0]], ["front", ["front-armhole-upper", 0.5, "B", 0.4]], ["front", ["front-waist", 0.6, "A", 0.5]], ["front", ["side-seam", 0.45, "B", 0.4]],
 ["back", ["back-waist", 0.55, "A", 0.5]], ["back", ["back-armhole", 0.4, "A", 0.6]]].forEach(([side, m]) => {
  const { engine: e } = createEngine();
  const res = applyRecipe(e, side, dims, { type: m[0], arcFraction: m[1], piece: m[2], moveFraction: m[3] });
  const name = side + " " + m[0] + " " + m[2] + "×" + m[3];
  ok(res.status === "applied", "6: " + name + " 적용");
  if (res.status !== "applied") return;
  const segs = res.bakedSegments;
  const sideEnd = evalRoot(segs, side + "/side-seam", 1), waistEnd = evalRoot(segs, side + "/waist", 1);
  ok(sideEnd.length >= 1 && waistEnd.length >= 1 && sideEnd.some(q => waistEnd.some(w => nearPt(q, w, 1e-6))), "6: " + name + " 옆선 t=1 과 허리 t=1 이 같은 점");
  const pivot = res.pivot, ang = res.userAngleDeg * Math.PI / 180;
  const rot = (pt) => ({ x: pivot.x + (pt.x - pivot.x) * Math.cos(ang) - (pt.y - pivot.y) * Math.sin(ang), y: pivot.y + (pt.x - pivot.x) * Math.sin(ang) + (pt.y - pivot.y) * Math.cos(ang) });
  ok(sideEnd.some(q => nearPt(q, p.SIDE_BTM, 1e-6) || nearPt(q, rot(p.SIDE_BTM), 1e-6)) || /waist|side-seam/.test(m[0]), "6: " + name + " 옆선 허리 끝 = SIDE_BTM(고정 또는 이번 회전)");
  ok(segs.every(s => !/side-waist-c/.test(s.dartId || "")), "6: " + name + " c 는 baked(이동) 결과에 없음");
  const pl = side === "front" ? e.dartMoveState.appliedFront.waistDarts : e.dartMoveState.appliedBack.waistDarts;
  const legAligned = Object.values(pl).filter(x => !x.unresolved).every(x => (x.onFold ? ["right"] : ["left", "right"]).every(l => evalRoot(segs, x.attach[l].root, x.attach[l].t).some(q => nearPt(q, x.dart[l], 1e-3))));
  ok(legAligned && !("c" in pl), "6: " + name + " a/b/d/e/f carry 정합·c 없음");
  ok(JSON.stringify(e.buildGen0SideWaistC(d.formula, p, d.darts)) === JSON.stringify(SC), "6: " + name + " c 반쪽 원천은 이동과 무관(locked)");
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
  const sem = BC.evaluateSemantics(proj(8, g));
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
    const S = p.SIDE_BTM;
    const ext = g[pc].outline.filter(x => x.boundary && x.boundary.root === pc + "/side-seam-extension");
    ok(ext.length === 1 && nearPt(ext[0].from, S, 1e-9) && near(ext[0].to.x, S.x, 1e-9) && near(ext[0].to.y, S.y + 10, 1e-9), "5: " + pc + " 허리 아래 연장 = SIDE_BTM 에서 수직 10cm");
  });
  ok(waistRecs(BC.evaluateSemantics(proj(8, g))).every(x => x.attachment === "complete"), "5: 길이 연장 후에도 허리다트 정합");
}
{
  const r6 = BC.evaluateSemantics(proj(6, geom0));
  ok(r6.ready === false && r6.issues.indexOf("legacy-source") >= 0, "5: v6 출처는 legacy-source(현재 seam-ready 로 승격 안 함)");
  ok(BC.evaluateSemantics(proj(8, geom0)).ready === true, "5: v8 동일 형상은 ready");
}

// 6. 몸판 체크포인트 옆선 측정 = 유효 외곽(designOutline 우선)의 명시 side-seam 만. 측정 불가는 0cm 정합이 아니라 차단.
{
  // 기준 수치 고정: B83/W64/BL38 → totalDart 12.5, c = 11% = 1.375, 앞·뒤 각 0.6875

  // 원형 → 디자인(no-op) 로컬 옆선 끝점 동일, c 는 dart id 로 나타나지 않음
  const g0 = DB.computeGeometry(geom0, {});
  ["front", "back"].forEach(pc => {
    const ss = g0[pc].outline.filter(x => x.edge === "side-seam");
    ok(ss.length === 1 && [ss[0].from, ss[0].to].some(q => nearPt(q, p.SIDE_BTM)) && [ss[0].from, ss[0].to].some(q => nearPt(q, p.SIDE_TOP)), "6: " + pc + " 디자인 옆선 = SIDE_TOP↔SIDE_BTM 수직(원형과 동일)");
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
  const projDO = (g, dO, pls) => { const pr = proj(8, g); pr.working.designOutline = dO; pr.working.patternLines = pls || []; return pr; };
  const geomSide = (g, pc) => g[pc].outline.filter(x => x.edge === "side-seam").reduce((t, x) => t + (x.kind === "line" ? Math.hypot(x.to.x - x.from.x, x.to.y - x.from.y) : NaN), 0);
  const A = p.SIDE_TOP, S = p.SIDE_BTM;
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


// 7. v8 Design: 앞·뒤 조각에 c/2 반쪽(construction)을 싣고 몸판 변환 후에도 identity·귀속·위상·intake 보존,
//    checkpoint 는 수직 옆선 17.383333 을 재고 c 는 group 으로 한 번(1.375)만 센다.
{
  const cLegs = (pc) => { const h = SC[pc]; return ["side", "intake"].map(leg => ({ kind: "line", from: { ...h.legs[leg] }, to: { ...h.apex },
    dart: { id: h.id, boundary: "waist", apexAt: "to", attach: { root: h.attach[leg].root, t: h.attach[leg].t }, group: h.group, locked: true } })); };
  const geomC = JSON.parse(JSON.stringify(geom0));
  ["front", "back"].forEach(pc => { geomC[pc].construction = geomC[pc].construction.concat(cLegs(pc)); });
  const P8 = (g, sv) => proj(sv || 8, g);
  PROJECT = P8(geomC);
  const c0 = BC.check(PROJECT);
  ok(c0.sideSeam.status === "match" && near(c0.sideSeam.front, 17.383333333333333, 1e-9) && near(c0.sideSeam.back, 17.383333333333333, 1e-9), "7: 기본 옆선 측정 = 수직 17.383333 (앞·뒤)");
  const sw = c0.sideWaistDart;
  ok(sw.ok && sw.front.id === "front-side-waist-c" && sw.back.id === "back-side-waist-c" && near(sw.front.intakeCm, 0.6875) && near(sw.back.intakeCm, 0.6875) && near(sw.totalCm, 1.375),
    "7: c 반쪽 record 앞·뒤 0.6875 · group 총량 1.375(한 번)");
  const sem8 = BC.evaluateSemantics(P8(geomC));
  const cRec = ["front", "back"].map(pc => sem8.darts[pc].find(x => x.group === "side-waist-c"));
  ok(sem8.ready === true && cRec.every(r => r && r.locked && r.legCount === 2 && r.attachment === "complete" && near(r.apex.x, p.SIDE_TOP.x, 1e-4)), "7: v8 semantics ready · c 반쪽 locked·다리 2·attachment complete·apex SIDE_TOP");
  ok(BC.evaluateSemantics(P8(geomC, 7)).issues.indexOf("legacy-source") >= 0, "7: v7 출처는 legacy-source(현재 형상으로 승격 안 함)");

  const topo = (g, pc) => {   // 옆선 위끝·옆선∩허리 접점(명시 edge 위상) — 검사용
    const ss = g[pc].outline.filter(x => x.edge === "side-seam" && x.boundary && x.boundary.root === pc + "/side-seam");
    const eps = x => x.kind === "line" ? [x.from, x.to] : [x.commands[0].points[0], x.commands[x.commands.length - 1].points[2]];
    const w = g[pc].outline.concat(g[pc].construction).filter(x => x.edge === "waist").flatMap(eps);
    const e = eps(ss[0]), S = e.find(q => w.some(z => nearPt(q, z, 1e-6))), U = e.find(q => q !== S);
    return { U, S };
  };
  [["ease 4", { bustEaseCm: 4 }], ["waist -2", { waistSideOffsetCm: -2 }], ["ease 4 + waist -1", { bustEaseCm: 4, waistSideOffsetCm: -1 }],
   ["hip 10", { hemExtensionBelowWaistCm: 10 }], ["hip 10 + hem +2", { hemExtensionBelowWaistCm: 10, hemSideOffsetCm: 2 }],
   ["hip 10 + waist -2 + curve 1", { hemExtensionBelowWaistCm: 10, waistSideOffsetCm: -2, sideSeamCurve: 1 }]].forEach(([name, body]) => {
    const inStr = JSON.stringify(geomC);
    const g = DB.computeGeometry(geomC, { body });
    ok(JSON.stringify(geomC) === inStr, "7: " + name + " 입력 불변");
    ["front", "back"].forEach(pc => {
      const cs = g[pc].construction.filter(x => x.dart && x.dart.group === "side-waist-c");
      const { U, S } = topo(g, pc);
      const legEnds = cs.map(x => x.from), apexes = cs.map(x => x.to);
      ok(cs.length === 2 && cs.every(x => x.dart.id === pc + "-side-waist-c" && x.dart.locked === true && !("edge" in x)), "7: " + name + " " + pc + " c 반쪽 identity·귀속·locked·외곽 아님");
      ok(apexes.every(a => nearPt(a, U, 1e-9)) && legEnds.some(q => nearPt(q, S, 1e-9)), "7: " + name + " " + pc + " apex = 옆선 위끝 · 한 다리 = 옆선∩허리");
      ok(near(Math.hypot(legEnds[0].x - legEnds[1].x, legEnds[0].y - legEnds[1].y), 0.6875, 1e-9), "7: " + name + " " + pc + " intake 0.6875 보존");
      ok(g[pc].outline.every(x => !(x.dart && x.dart.group)), "7: " + name + " " + pc + " c 는 외곽에 없음");
    });
    PROJECT = P8(g);
    const c = BC.check(PROJECT);
    ok(c.sideWaistDart.ok && near(c.sideWaistDart.totalCm, 1.375) && c.sideSeam.status !== "unmeasured", "7: " + name + " c record 정합(attachment complete)·총 1.375 · 옆선 측정 가능");
  });
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
