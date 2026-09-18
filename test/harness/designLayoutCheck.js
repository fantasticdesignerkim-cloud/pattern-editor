// ══════════════════════════════════════════════
// designLayoutCheck.js — js/designLayout.js 의 순수 기하(bboxOf/outlineBBoxOf/autoLayout/
// ensureLayout) 회귀 테스트. DOM/view 연동(카메라·드래그)은 브라우저 검증 몫이라 여기선
// 다루지 않는다. 실제 소스를 vm 으로 실행한다(구현 복사 아님).
//
//   node test/harness/designLayoutCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designLayout.js"), "utf8");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// svg 미정의 컨텍스트(initDrag 는 자동 skip) — window/document 만 최소 제공.
function load() {
  const sandbox = {
    window: {}, document: { documentElement: { clientWidth: 1440 }, addEventListener() {} },
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, isFinite, Infinity, NaN
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "designLayout.js" });
  return sandbox.window.designLayout;
}
const DL = load();

const line = (x1, y1, x2, y2) => ({ kind: "line", from: { x: x1, y: y1 }, to: { x: x2, y: y2 } });
const cubic = (pts) => ({ kind: "path", commands: [{ type: "M", points: [{ x: pts[0][0], y: pts[0][1] }] }, { type: "C", points: [{ x: pts[1][0], y: pts[1][1] }, { x: pts[2][0], y: pts[2][1] }, { x: pts[3][0], y: pts[3][1] }] }] });
// 앞판/뒤판 outline 은 겹칠 수 있다(슬로퍼 두 반쪽). front·back x[0..20] y[0..30], 소매 x[0..15] y[40..80].
function geom() {
  return {
    front: { outline: [line(0, 0, 20, 0), line(0, 30, 20, 30), line(0, 0, 0, 30), line(20, 0, 20, 30)], construction: [] },
    back: { outline: [line(0, 0, 20, 0), line(0, 30, 20, 30), line(0, 0, 0, 30), line(20, 0, 20, 30)], construction: [] },
    shared: { outline: [], construction: [line(3, 12, 4, 18)] },     // 허리다트 c 다리(앞판 따라감)
    sleeve: { outline: [line(0, 40, 15, 40), line(0, 80, 15, 80), line(0, 40, 0, 80), line(15, 40, 15, 80)], construction: [] }
  };
}

// 1. 공개 API
{
  const puresOk = ["bboxOf", "outlineBBoxOf", "autoLayout", "ensureLayout"].every(k => typeof DL[k] === "function");
  ok(puresOk && Object.isFrozen(DL), "1: 순수 API 존재·frozen");
  const domOk = ["enterDesign", "centerBody", "placeSleeveRight", "resetLayout", "afterBodyLength", "resetViewForDesign"].every(k => typeof DL[k] === "function");
  ok(domOk, "1: DOM 액션 API 존재");
}

// 2. bboxOf(front) = front + shared(construction 포함). 겹치는 back 은 제외.
{
  const b = DL.bboxOf(geom(), "front");
  ok(b && near(b.minX, 0) && near(b.maxX, 20) && near(b.minY, 0) && near(b.maxY, 30), "2: front bbox(=front+shared)");
}
// 3. bboxOf(back)
{
  const b = DL.bboxOf(geom(), "back");
  ok(b && near(b.minX, 0) && near(b.maxX, 20) && near(b.minY, 0) && near(b.maxY, 30), "3: back bbox");
}
// 4. bboxOf(sleeve) + cubic 점 포함
{
  const g = geom(); g.sleeve.outline.push(cubic([[16, 41], [17, 42], [18, 90], [19, 91]]));
  const s = DL.bboxOf(g, "sleeve");
  ok(s && near(s.minX, 0) && near(s.maxX, 19) && near(s.minY, 40) && near(s.maxY, 91), "4: sleeve bbox + cubic");
}
// 5. 빈 piece → null
{
  const g = geom(); g.sleeve = { outline: [], construction: [] };
  ok(DL.bboxOf(g, "sleeve") === null, "5: 빈 sleeve bbox null");
}
// 6. outlineBBoxOf 는 construction 제외 — shared construction 만 있는 front 는 outline 만 반영
{
  const g = geom();
  const full = DL.bboxOf(g, "front");        // outline+construction
  const out = DL.outlineBBoxOf(g, "front");  // outline 만
  // 이 fixture 는 shared construction 이 front outline 안(y12..18)이라 bbox 동일
  ok(near(full.minX, out.minX) && near(full.maxX, out.maxX) && near(full.minY, out.minY) && near(full.maxY, out.maxY), "6: outlineBBoxOf(front)");
  // construction 이 outline 밖이면 bbox 가 달라진다(분리 확인)
  const g2 = geom(); g2.shared.construction = [line(-5, -5, -4, -4)];
  const full2 = DL.bboxOf(g2, "front"), out2 = DL.outlineBBoxOf(g2, "front");
  ok(near(full2.minX, -5) && near(out2.minX, 0), "6: construction 은 full 에만 반영");
}

// 7. autoLayout: 뒤판→앞판→소매 가로(원형 화면과 같은 좌우 순서), 실제 봉제선 간격 10, 세로중심 뒤판 기준
{
  const a = DL.autoLayout(geom());
  ok(a && near(a.back.dx, 0) && near(a.back.dy, 0), "7: 뒤판 앵커(0,0)");
  // front.dx = (backMaxX 20 + 10) - frontMinX 0 = 30, dy = backCY 15 - frontCY 15 = 0
  ok(near(a.front.dx, 30) && near(a.front.dy, 0), "7: 앞판 = 뒤판 오른쪽+10, 세로중심");
  // sleeve.dx = (frontDisp maxX 50 + 10) - sleeveMinX 0 = 60, dy = 15 - 60 = -45
  ok(near(a.sleeve.dx, 60) && near(a.sleeve.dy, -45), "7: 소매 = 앞판 오른쪽+10, 세로중심");
  ok(near((0 + a.front.dx) - 20, 10), "7: 뒤↔앞 봉제선 간격 10");
  ok(near((0 + a.sleeve.dx) - (20 + a.front.dx), 10), "7: 앞↔소매 봉제선 간격 10");
  const bcy = 15, fcy = 15 + a.front.dy, scy = 60 + a.sleeve.dy;
  ok(near(fcy, bcy) && near(bcy, scy), "7: 세 피스 세로중심 일치");
  ok(a.back.dx + 0 < a.front.dx + 0 && a.front.dx + 20 < a.sleeve.dx + 0, "7: x 순서 back < front < sleeve");
}
// 7b. 서로 다른 형상 폭·위치: 순서·간격 10·겹침 없음 유지
[[0, 26, 18, 44, 5, 22], [-8, 14, 30, 70, 100, 131], [3, 40, 3, 25, -20, -2]].forEach(([b0, b1, f0, f1, s0, s1], i) => {
  const rect = (x0, x1, y0, y1) => [line(x0, y0, x1, y0), line(x0, y1, x1, y1), line(x0, y0, x0, y1), line(x1, y0, x1, y1)];
  const g = { front: { outline: rect(f0, f1, 2, 40), construction: [] }, back: { outline: rect(b0, b1, 0, 36), construction: [] },
    shared: { outline: [], construction: [] }, sleeve: { outline: rect(s0, s1, 45, 95), construction: [] } };
  const a = DL.autoLayout(g);
  const B = [b0 + a.back.dx, b1 + a.back.dx], F = [f0 + a.front.dx, f1 + a.front.dx], S = [s0 + a.sleeve.dx, s1 + a.sleeve.dx];
  ok(near(a.back.dx, 0) && near(F[0] - B[1], 10) && near(S[0] - F[1], 10), "7b-" + i + ": 뒤↔앞·앞↔소매 간격 10");
  ok(B[1] < F[0] && F[1] < S[0], "7b-" + i + ": 겹침 없음·x 순서 back < front < sleeve");
});
// 8. autoLayout: 소매 없으면 소매 offset 0 / 뒤판 없으면 앞판이 앵커 / 앞판 없으면 null
{
  const g = geom(); g.sleeve = { outline: [], construction: [] };
  const a = DL.autoLayout(g);
  ok(near(a.front.dx, 30) && near(a.sleeve.dx, 0) && near(a.sleeve.dy, 0), "8: 소매 없음 → 0");
  const g1 = geom(); g1.back = { outline: [], construction: [] };
  const a1 = DL.autoLayout(g1);
  ok(near(a1.front.dx, 0) && near(a1.back.dx, 0) && near(a1.sleeve.dx, 30), "8: 뒤판 없음 → 앞판 앵커·소매 앞판 오른쪽");
  const g2 = geom(); g2.front = { outline: [], construction: [] };
  ok(DL.autoLayout(g2) === null, "8: 앞판 없음 → null");
}

// 9. ensureLayout: 신형 기본값 + 결손 보정
{
  const p1 = { working: {} };
  const L1 = DL.ensureLayout(p1);
  ok(L1.front.dx === 0 && L1.back.dx === 0 && L1.sleeve.dx === 0 && L1.placement.front === "auto" && L1.placement.back === "auto" && L1.placement.sleeve === "auto" && p1.working.layout === L1, "9: 신형 기본 layout");
  const p2 = { working: { layout: { front: { dx: 1, dy: 2 }, back: { dx: 3, dy: 4 }, sleeve: { dx: 5, dy: 6 }, placement: { front: "manual", back: "auto", sleeve: "manual" } } } };
  const L2 = DL.ensureLayout(p2);
  ok(L2.back.dx === 3 && L2.placement.front === "manual" && L2.placement.sleeve === "manual", "9: 기존 layout 보존");
  // 결손 필드 보정
  const p3 = { working: { layout: { front: { dx: 1, dy: 2 } } } };
  const L3 = DL.ensureLayout(p3);
  ok(L3.back.dx === 0 && L3.sleeve.dx === 0 && L3.placement.front === "auto", "9: 결손 필드 보정");
}
// 10. ensureLayout: 구형 {body,sleeve,sleevePlacement} 마이그레이션
{
  const p = { working: { layout: { body: { dx: 7, dy: 8 }, sleeve: { dx: 9, dy: 10 }, sleevePlacement: "manual" } } };
  const L = DL.ensureLayout(p);
  ok(L.front.dx === 7 && L.front.dy === 8, "10: 구형 body → 앞판 앵커");
  ok(L.sleeve.dx === 9 && L.placement.sleeve === "manual", "10: 구형 sleevePlacement → placement.sleeve");
  ok(L.placement.front === "auto" && L.placement.back === "auto", "10: 앞/뒤 placement auto 기본");
}

// 11. 카라(별도 조각) 배치 헬퍼: bboxOfStand / collarAutoOffset / ensureLayout collar 기본값
{
  const stand = { outline: [line(0, 0, 20, 0), line(20, 0, 20, -3), line(20, -3, 0, -3), line(0, -3, 0, 0)], construction: [] };
  const bb = DL.bboxOfStand(stand);
  ok(bb && bb.minX === 0 && bb.maxX === 20 && bb.minY === -3 && bb.maxY === 0, "11: bboxOfStand");
  ok(DL.bboxOfStand({ outline: [], construction: [] }) === null, "11: 빈 stand → null");
  const bs = { minX: 0, minY: 0, maxX: 35, maxY: 30 }, cbb = { minX: 0, minY: -3, maxX: 20, maxY: 0 };
  const right = DL.collarAutoOffset(bs, cbb, "right");
  ok(near(right.dx, 45) && near(right.dy, 16.5), "11: collarAutoOffset right(소매 오른쪽 GAP·세로중심)");
  const below = DL.collarAutoOffset(bs, cbb, "below");
  ok(near(below.dx, 7.5) && near(below.dy, 43), "11: collarAutoOffset below(bs 아래 GAP·가로중심)");
  ok(DL.collarAutoOffset(null, cbb, "right").dx === 0 && DL.collarAutoOffset(bs, null, "right").dy === 0, "11: 결손 입력 안전");
  // ensureLayout 이 collar 기본값·placement.collar 를 추가한다(신규·구형 모두).
  const Lnew = DL.ensureLayout({ working: {} });
  ok(Lnew.collar && Lnew.collar.dx === 0 && Lnew.placement.collar === "auto", "11: ensureLayout 신규 collar 기본");
  const Lold = DL.ensureLayout({ working: { layout: { body: { dx: 7, dy: 8 }, sleeve: { dx: 9, dy: 10 }, sleevePlacement: "manual" } } });
  ok(Lold.collar && Lold.collar.dx === 0 && Lold.placement.collar === "auto", "11: ensureLayout 구형 마이그레이션 시 collar 추가");
}

// 12. DOM 액션(디자인 진입·배치 초기화·몸판 중앙·길이 적용): 순서 back<front<sleeve, manual 보존, 몸판 중앙은 offset 불변
{
  let W = 1440, H = 900;
  const sb = {
    window: { addEventListener() {} }, document: { documentElement: { clientWidth: W }, addEventListener() {} },
    console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, isFinite, Infinity, NaN
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(`var view = { SC: 11, MX: 80, MY: 100, x: 0, y: 0, z: 1 }; var SC = 11, MX = 80, MY = 100, viewX = 0, viewY = 0, viewZ = 1;
    function syncViewVars(){ SC=view.SC; MX=view.MX; MY=view.MY; viewX=view.x; viewY=view.y; viewZ=view.z; }
    var renders = 0; function render(){ renders++; }
    var svg = { getBoundingClientRect: () => ({ width: __W(), height: __H() }), addEventListener(){}, clientWidth: 0, clientHeight: 0 };`, sb);
  sb.__W = () => W; sb.__H = () => H;
  const project = { working: { geometry: geom(), layout: null } };
  sb.window.designWorkflow = { current: () => project };
  sb.window.isDesignStageActive = () => true;
  vm.runInContext(SRC, sb, { filename: "designLayout.js" });
  const D = sb.window.designLayout;
  const order = () => { const L = project.working.layout; return [L.back.dx + 20, L.front.dx, L.front.dx + 20, L.sleeve.dx]; };   // [backMax, frontMin, frontMax, sleeveMin]
  const inOrder = () => { const o = order(); return o[0] < o[1] && o[2] < o[3] && near(o[1] - o[0], 10) && near(o[3] - o[2], 10); };
  [[1440, 900], [390, 700]].forEach(([w, h]) => {
    W = w; H = h; project.working.layout = null;
    D.enterDesign(); ok(inOrder(), "12: 디자인 진입 " + w + "px → back<front<sleeve·간격 10");
    project.working.layout.front = { dx: 99, dy: 1 }; project.working.layout.placement.front = "manual";
    D.afterBodyLength(); ok(project.working.layout.front.dx === 99 && project.working.layout.placement.front === "manual", "12: 길이 적용 재배치가 manual 앞판을 덮지 않음 " + w);
    D.resetLayout(); ok(inOrder() && project.working.layout.placement.front === "auto", "12: 배치 초기화 " + w + "px → back<front<sleeve");
    const before = JSON.stringify(project.working.layout);
    D.centerBody(); ok(JSON.stringify(project.working.layout) === before && inOrder(), "12: 몸판 중앙 = 카메라만, 순서 보존 " + w);
    const L = project.working.layout, cx = ((0 + L.back.dx) + (20 + L.front.dx)) / 2;
    ok(Math.abs((sb.MX + cx * sb.SC * sb.viewZ + sb.viewX) - w / 2) < 1e-6, "12: 몸판 중앙 = 뒤+앞 union 중심 " + w);
  });
}

// 13. 가슴선(BL) 정렬: 앞판 dy 는 bbox 가 아니라 semantic U(side-seam 의 비허리 끝, SIDE_TOP) 로 정한다.
//   뒤판 bbox y[0,40]·U.y=18 / 앞판 bbox y[-4,44]·U.y=20(목·어깨·허리 높이 모두 다름).
//   bbox 세로중심 정렬 → dy 0, top 정렬 → 4, bottom 정렬 → -4, **가슴선 정렬 → -2**.
const E = (pr, e) => { pr.edge = e; return pr; };
function semGeom(opts) {
  opts = opts || {};
  const back = { outline: [
    E(line(0, 2, 0, 40), "center"), E(line(0, 40, 20, 40), "waist"), E(line(20, 40, 20, 18), "side-seam"),
    cubic([[20, 18], [18, 12], [16, 8], [15, 5]]), line(15, 5, 5, 0), line(5, 0, 0, 2)], construction: [] };
  let front;
  if (opts.frontHemCurve) {
    // hem 연장 + 옆선 곡선화 후 형태: side-seam 2 path(U→Sp→H), waist 는 construction, hem outline.
    front = { outline: [
      E(line(0, 8, 0, 60), "center"), E(line(0, 60, 22, 60), "hem"),
      E(cubic([[22, 60], [22, 55], [23, 49], [23, 44]]), "side-seam"), E(cubic([[23, 44], [23, 38], [22, 26], [22, 20]]), "side-seam"),
      cubic([[22, 20], [20, 12], [17, 6], [16, 3]]), line(16, 3, 6, -4), line(6, -4, 0, 8)],
      construction: [E(line(0, 44, 23, 44), "waist")] };
  } else {
    front = { outline: [
      E(line(0, 8, 0, 44), "center"), E(line(0, 44, 22, 44), "waist"), E(line(22, 44, 22, 20), "side-seam"),
      cubic([[22, 20], [20, 12], [17, 6], [16, 3]]), line(16, 3, 6, -4), line(6, -4, 0, 8)], construction: [] };
  }
  return { front, back, shared: { outline: [], construction: [] },
    sleeve: { outline: [line(0, 40, 15, 40), line(0, 80, 15, 80), line(0, 40, 0, 80), line(15, 40, 15, 80)], construction: [] } };
}
{
  const g = semGeom();
  const uB = DL.sideSeamUnderarm(g, "back"), uF = DL.sideSeamUnderarm(g, "front");
  ok(uB && near(uB.x, 20) && near(uB.y, 18) && uF && near(uF.x, 22) && near(uF.y, 20), "13: semantic U = side-seam 비허리 끝");
  const a = DL.autoLayout(g);
  ok(near(uF.y + a.front.dy, uB.y + a.back.dy), "13: 초기 배치 가슴선 일치(front U.y+dy == back U.y+dy)");
  ok(near(a.front.dy, -2), "13: 앞판 dy = -2 (bbox 중심 0·top 4·bottom -4 아님)");
  const bbF = DL.outlineBBoxOf(g, "front"), bbB = DL.outlineBBoxOf(g, "back");
  ok(!near((bbF.minY + bbF.maxY) / 2 + a.front.dy, (bbB.minY + bbB.maxY) / 2) && !near(bbF.minY + a.front.dy, bbB.minY), "13: bbox 중심·top 정렬이 아님");
  ok(near(a.front.dx, (20 + 10) - 0) && near(a.sleeve.dx, (22 + a.front.dx + 10) - 0), "13: 뒤→앞→소매 봉제선 간격 10(가로 불변)");
  ok(near((40 + 80) / 2 + a.sleeve.dy, (0 + 40) / 2), "13: 소매 세로중심 = 뒤판(앵커) 세로중심");
  // hem 연장 + 곡선 옆선(waist 가 construction) 에서도 U 식별
  const g2 = semGeom({ frontHemCurve: true });
  const uF2 = DL.sideSeamUnderarm(g2, "front");
  ok(uF2 && near(uF2.x, 22) && near(uF2.y, 20), "13: hem·곡선 옆선 후에도 U 식별(waist=construction)");
  ok(near(uF2.y + DL.autoLayout(g2).front.dy, 18), "13: hem·곡선 옆선 후 가슴선 정렬");
  // 모호/결손 → null(legacy 세로중심 폴백)
  const g3 = semGeom(); g3.front.outline = g3.front.outline.filter(pr => pr.edge !== "waist");
  ok(DL.sideSeamUnderarm(g3, "front") === null, "13: waist 없으면 U null(추측 안 함)");
  const a3 = DL.autoLayout(g3), b3 = DL.outlineBBoxOf(g3, "front");
  ok(near((b3.minY + b3.maxY) / 2 + a3.front.dy, 20), "13: U 없으면 세로중심 폴백");
  ok(DL.sideSeamUnderarm(geom(), "front") === null, "13: edge 없는 legacy fixture → null");
}
// 14. DOM 액션에서도 가슴선: 진입·배치 초기화·몸판 중앙 보존, manual drag 는 자동 재정렬 안 함
{
  const sb = {
    window: { addEventListener() {} }, document: { documentElement: { clientWidth: 1440 }, addEventListener() {} },
    console: { log() {}, warn() {}, error() {} }, Math, JSON, Object, Array, Number, isFinite, Infinity, NaN
  };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(`var view = { SC: 11, MX: 80, MY: 100, x: 0, y: 0, z: 1 }; var SC = 11, MX = 80, MY = 100, viewX = 0, viewY = 0, viewZ = 1;
    function syncViewVars(){ SC=view.SC; MX=view.MX; MY=view.MY; viewX=view.x; viewY=view.y; viewZ=view.z; }
    function render(){}
    var svg = { getBoundingClientRect: () => ({ width: 1440, height: 900 }), addEventListener(){}, clientWidth: 0, clientHeight: 0 };`, sb);
  const project = { working: { geometry: semGeom(), layout: null } };
  sb.window.designWorkflow = { current: () => project };
  sb.window.isDesignStageActive = () => true;
  vm.runInContext(SRC, sb, { filename: "designLayout.js" });
  const D = sb.window.designLayout, L = () => project.working.layout;
  const bl = () => near(20 + L().front.dy, 18 + L().back.dy);
  const nonOverlap = () => (20 + L().back.dx) < (0 + L().front.dx) && (22 + L().front.dx) < (0 + L().sleeve.dx)
    && near(L().front.dx - (20 + L().back.dx), 10) && near(L().sleeve.dx - (22 + L().front.dx), 10);
  D.enterDesign(); ok(bl() && nonOverlap(), "14: 디자인 진입 → 가슴선 일치·뒤<앞<소매·간격 10");
  const before = JSON.stringify(L()); D.centerBody();
  ok(JSON.stringify(L()) === before && bl(), "14: 몸판 중앙 = 카메라만, 가슴선 보존");
  L().front = { dx: 77, dy: 5 }; L().placement.front = "manual";
  D.afterBodyLength(); D.afterCollar();
  ok(L().front.dx === 77 && L().front.dy === 5 && L().placement.front === "manual", "14: manual 앞판은 재계산에서 재정렬 안 함");
  D.resetLayout(); ok(bl() && nonOverlap() && L().placement.front === "auto" && L().placement.collar === "auto", "14: 배치 초기화 → 가슴선 복귀·collar 포함 auto");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
