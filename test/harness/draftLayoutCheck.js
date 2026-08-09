// ══════════════════════════════════════════════
// draftLayoutCheck.js — js/draftLayout.js 회귀 테스트. 실제 소스를 vm 으로 실행한다
// (구현 복사 아님). 순수 함수 계약 + mock DOM 으로 fitDraftView/syncSleeveOffset/
// ResizeObserver 경로까지 헤드리스로 고정한다.
//
// 고정하는 계약(사용자 완료 조건):
//   1) 소매 봉제선 간격 정확히 10cm
//   2) union 중심 오차 ≤1px
//   3) geometry 좌표 불변(순수 함수 입력 비변형)
//   4) resize 자동 재fit(ResizeObserver 콜백 + 크기 바뀌어도 재중앙)
//   5) draft 소매 핸들 offset 왕복(저장=화면−off, 표시=저장+off, 합성 항등)
//   6) 격자·라벨·핸들·보조선(construction)이 bbox 에 개입하지 않음(outline 만 측정)
//
//   node test/harness/draftLayoutCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "draftLayout.js"), "utf8");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ── mock DOM/view (draft 좌표계: p2c_ 를 항등으로 둬 getBBox 를 cm 로 직접 다룬다) ──
// 실제 앱은 getBBox=px, p2c_=px→cm. 여기선 px==cm 로 두어 중심오차 검증을 단순화한다.
function makeEl(role, piece, x, y, w, h) {
  return {
    _role: role, _piece: piece, _bb: { x, y, width: w, height: h },
    getAttribute(k) { return k === "data-geometry-role" ? this._role : (k === "data-piece" ? this._piece : null); },
    getBBox() { return this._bb; }
  };
}
// 실제 도안 근사: 몸판 outline maxX=47.5, 소매 local outline minX=5.5. + 노이즈(제외돼야 함).
function makeElements() {
  return [
    // 몸판 봉제선 outline (front/back) — minX 0, maxX 47.5, minY -4, maxY 38
    makeEl("outline", "front", 0, -4, 47.5, 42),
    makeEl("outline", "back", 0, 0, 10, 38),
    // 소매 봉제선 outline (로컬) — minX 5.5, maxX 39.3, minY 53, maxY 105
    makeEl("outline", "sleeve", 5.5, 53, 33.8, 52),
    // 노이즈: 라벨(role 없음)·보조선(construction)·핸들(role 없음) — 극단 좌표라 개입하면 티남
    makeEl(null, "front", 200, 200, 5, 5),           // 라벨
    makeEl("construction", "front", -50, -50, 5, 5), // 보조선(가슴다트 등)
    makeEl(null, "sleeve", 300, 300, 5, 5)           // 핸들
  ];
}
function makeSandbox(svgW, svgH, elements) {
  const roList = [];
  const sleeveGroup = { _tf: null, setAttribute(k, v) { if (k === "transform") this._tf = v; } };
  const svg = {
    clientWidth: svgW, clientHeight: svgH,
    getBoundingClientRect() { return { left: 0, top: 0, width: svgW, height: svgH, right: svgW, bottom: svgH }; },
    querySelectorAll(sel) {
      if (sel.indexOf("outline") >= 0) return elements.filter(e => e._role === "outline");
      return [];
    },
    querySelector(sel) { return sel.indexOf("data-sleeve-root") >= 0 ? sleeveGroup : null; }
  };
  const view = { SC: 11, MX: 80, MY: 100, x: 0, y: 0, z: 1 };
  let renderCount = 0;
  const sandbox = {
    window: {}, // isDesignStageActive 없음 → inDraft() true
    svg, view,
    SC: view.SC, MX: view.MX, MY: view.MY, viewX: view.x, viewY: view.y, viewZ: view.z,
    p2c_: (sx, sy) => [sx, sy],           // 항등(px==cm)
    syncViewVars() { this.viewX = view.x; this.viewY = view.y; this.viewZ = view.z; },
    render() { renderCount++; },
    ResizeObserver: class { constructor(cb) { this._cb = cb; roList.push(this); } observe() {} disconnect() {} },
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, isFinite, Infinity, NaN
  };
  sandbox.globalThis = sandbox;
  sandbox.__roList = roList; sandbox.__sleeveGroup = sleeveGroup;
  sandbox.__renderCount = () => renderCount;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "draftLayout.js" });
  return sandbox;
}
// 실제 c2p (검증용): px = MX + viewX + cm*SC*viewZ
function c2p(sb, cx, cy) {
  return [sb.MX + sb.view.x + cx * sb.SC * sb.view.z, sb.MY + sb.view.y + cy * sb.SC * sb.view.z];
}

const S0 = makeSandbox(1000, 616, makeElements());
const DL = S0.window.draftLayout;

// ── 0. 공개 API ──
{
  const puresOk = ["computeSleeveDx", "computeSleeveDy", "computeFitCamera", "symmetricFitBBox", "unionOutlineBBox", "sleeveStoreFromEvt", "sleeveDisplayFromStore"].every(k => typeof DL[k] === "function");
  const domOk = ["fitDraftView", "afterDraftRender", "syncSleeveOffset", "measureOutlineCm", "outlineUnionCm"].every(k => typeof DL[k] === "function");
  ok(puresOk && domOk && Object.isFrozen(DL) && DL.GAP === 10, "0: API·GAP·frozen");
}

// ── 1. 소매 봉제선 간격 정확히 10cm (순수 + 실측 경로) ──
{
  // 순수: (sleeveLocalMinX + dx) - bodyMaxX === gap
  const dx = DL.computeSleeveDx(47.5, 5.5, 10);
  ok(near((5.5 + dx) - 47.5, 10), "1: computeSleeveDx gap=10 (순수)");
  // 순수 dy: 몸판 세로중심(17) − 소매 세로중심(79) = -62 → 표시 후 세로중심 일치
  const dy = DL.computeSleeveDy({ minY: -4, maxY: 38 }, { minY: 53, maxY: 105 });
  ok(near(dy, -62) && near((-4 + 38) / 2, (53 + dy + 105 + dy) / 2), "1: computeSleeveDy 세로중심 정렬(순수)");
  // 실측: syncSleeveOffset 이 window.draftSleeveLayout 에 정확한 gap + 세로중심 정렬을 만든다
  DL.syncSleeveOffset();
  const off = S0.window.draftSleeveLayout;
  ok(off && near((5.5 + off.dx) - 47.5, 10) && near(off.dy, -62), "1: syncSleeveOffset 실측 gap=10·dy=-62");
  // 소매 그룹 transform 이 그 offset 으로 in-place 보정됨(재렌더 없이)
  ok(S0.__sleeveGroup._tf === "translate(" + (off.dx * S0.SC * S0.viewZ) + "," + (off.dy * S0.SC * S0.viewZ) + ")", "1: 소매 그룹 transform 보정");
}

// ── 6. 격자·라벨·핸들·보조선이 bbox 에 개입하지 않음 (outline 만) ──
{
  // 노이즈 요소는 200~300 좌표. outline 만 잡으면 union maxX 는 소매 표시 maxX(≈91.3)여야 함.
  const u = DL.outlineUnionCm();
  const off = S0.window.draftSleeveLayout;                      // dx≈52, dy=-62
  const expSleeveMaxX = 39.3 + off.dx;                          // 5.5+33.8=39.3 (+dx)
  // 소매 표시 세로 = 53+dy(-9) .. 105+dy(43). 소매가 몸판(-4..38)보다 세로로 넓어
  // union 세로는 소매가 지배: minY 53+dy(-9), maxY 105+dy(43).
  ok(u && near(u.minX, 0) && near(u.maxX, expSleeveMaxX) && near(u.minY, 53 + off.dy) && near(u.maxY, 105 + off.dy), "6: outline 만 union (노이즈 제외, 세로중심 정렬)");
  // unionOutlineBBox 순수: role!=="outline" 무시
  const metas = [
    { role: "outline", piece: "body", minX: 0, maxX: 47.5, minY: -4, maxY: 38 },
    { role: "outline", piece: "sleeve", minX: 5.5, maxX: 39.3, minY: 53, maxY: 105 },
    { role: "label", piece: "front", minX: 999, maxX: 999, minY: 999, maxY: 999 },
    { role: "construction", piece: "front", minX: -999, maxX: -999, minY: -999, maxY: -999 }
  ];
  const ub = DL.unionOutlineBBox(metas, { dx: 52, dy: 0 });
  ok(near(ub.minX, 0) && near(ub.maxX, 39.3 + 52) && near(ub.minY, -4) && near(ub.maxY, 105), "6: unionOutlineBBox 순수 outline-only");
}

// ── 2. union 중심 오차 ≤1px (순수 computeFitCamera + 실제 fitDraftView) ──
{
  const bb = { minX: 0, maxX: 91.3, minY: -4, maxY: 105 };
  const cam = DL.computeFitCamera(bb, 1000, 616, { SC: 11, MX: 80, MY: 100 }, 0.2, 24);
  // c2p(center) === viewport center
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  const px = 80 + cam.x + cx * 11 * cam.z, py = 100 + cam.y + cy * 11 * cam.z;
  ok(Math.abs(px - 500) <= 1 && Math.abs(py - 308) <= 1, "2: computeFitCamera 중심오차 ≤1px");
  ok(Math.abs(px - 500) < 1e-6 && Math.abs(py - 308) < 1e-6, "2: 실제로 정확 중심(≈0)");
  // 실제 fitDraftView 후 c2p(union 중심) 검증
  DL.syncSleeveOffset(); DL.fitDraftView();
  const u = DL.outlineUnionCm();
  const ucx = (u.minX + u.maxX) / 2, ucy = (u.minY + u.maxY) / 2;
  const [vpx, vpy] = c2p(S0, ucx, ucy);
  ok(Math.abs(vpx - 500) <= 1 && Math.abs(vpy - 308) <= 1, "2: fitDraftView union 중심 ≤1px");
}

// ── 2b. symmetricFitBBox: 중심은 outline, 범위는 full(라벨 포함) — outline 중심 대칭 ──
{
  const outline = { minX: 0, maxX: 91.3, minY: -9.1, maxY: 42.9 };       // 중심 45.65
  const full = { minX: -7.1, maxX: 102.2, minY: -19.3, maxY: 53 };       // 중심 47.55(비대칭)
  const fit = DL.symmetricFitBBox(outline, full);
  const cx = (outline.minX + outline.maxX) / 2, cy = (outline.minY + outline.maxY) / 2;
  // fit 중심 === outline 중심(대칭)
  ok(near((fit.minX + fit.maxX) / 2, cx) && near((fit.minY + fit.maxY) / 2, cy), "2b: fit 중심 = outline 중심(대칭)");
  // full 이 다 담긴다(양쪽 라벨 포함)
  ok(fit.minX <= full.minX + 1e-9 && fit.maxX >= full.maxX - 1e-9 && fit.minY <= full.minY + 1e-9 && fit.maxY >= full.maxY - 1e-9, "2b: full content 전부 포함");
  // halfW = 중심에서 먼 쪽(오른쪽 라벨 102.2)
  ok(near(fit.maxX - cx, Math.max(full.maxX - cx, cx - full.minX)), "2b: halfW = 먼 쪽 거리");
  // full 이 이미 대칭이면 그대로
  const sym = { minX: cx - 30, maxX: cx + 30, minY: cy - 20, maxY: cy + 20 };
  const fit2 = DL.symmetricFitBBox(outline, sym);
  ok(near(fit2.minX, sym.minX) && near(fit2.maxX, sym.maxX), "2b: 이미 대칭이면 그대로");
}

// ── 4. resize 자동 재fit (ResizeObserver 콜백 + 다른 크기에서도 재중앙) ──
{
  // ResizeObserver 가 svg 를 observe 했고 콜백이 저장돼 있다
  ok(S0.__roList.length === 1 && typeof S0.__roList[0]._cb === "function", "4: ResizeObserver(#cv) 설치됨");
  // 카메라를 흐트러뜨린 뒤 RO 콜백 발화 → 다시 union 중심으로 보정
  S0.view.z = 1; S0.view.x = -9999; S0.view.y = -9999; S0.syncViewVars();
  S0.__roList[0]._cb();  // 실제 리사이즈 이벤트처럼 콜백 실행 → fitDraftView
  const u = DL.outlineUnionCm();
  const ucx = (u.minX + u.maxX) / 2, ucy = (u.minY + u.maxY) / 2;
  let [vpx, vpy] = c2p(S0, ucx, ucy);
  ok(Math.abs(vpx - 500) <= 1 && Math.abs(vpy - 308) <= 1, "4: RO 콜백 후 재중앙 ≤1px");

  // 다른 viewport 크기(820x656)에서도 RO 콜백 → 그 중심으로 재fit
  const S2 = makeSandbox(820, 656, makeElements());
  S2.window.draftLayout.syncSleeveOffset();
  S2.__roList[0]._cb();
  const u2 = S2.window.draftLayout.outlineUnionCm();
  const c2x = (u2.minX + u2.maxX) / 2, c2y = (u2.minY + u2.maxY) / 2;
  const [p2x, p2y] = c2p(S2, c2x, c2y);
  ok(Math.abs(p2x - 410) <= 1 && Math.abs(p2y - 328) <= 1, "4: 다른 크기(820x656)에서도 중심 ≤1px");
}

// ── 5. draft 소매 핸들 offset 왕복 ──
{
  const off = { dx: 52.0, dy: 0 };
  const evt = { x: 60.5, y: 60.16 };                 // 화면(offset 반영) 좌표
  const store = DL.sleeveStoreFromEvt(evt, off);     // 저장 = 화면 − off
  ok(near(store.x, 8.5) && near(store.y, 60.16), "5: 저장좌표 = offset 0 계열");
  const disp = DL.sleeveDisplayFromStore(store, off);
  ok(near(disp.x, evt.x) && near(disp.y, evt.y), "5: 왕복 항등(표시=저장+off)");
}

// ── 3. geometry/입력 좌표 불변 (순수 함수 입력 비변형) ──
{
  const metas = [{ role: "outline", piece: "sleeve", minX: 5.5, maxX: 39.3, minY: 53, maxY: 105 }];
  const snap = JSON.stringify(metas);
  const off = { dx: 52, dy: 0 };
  DL.unionOutlineBBox(metas, off);
  ok(JSON.stringify(metas) === snap && off.dx === 52 && off.dy === 0, "3: unionOutlineBBox 입력 비변형");
  const e = { x: 60.5, y: 60.16 }, o = { dx: 52, dy: 0 }, es = JSON.stringify(e), os = JSON.stringify(o);
  DL.sleeveStoreFromEvt(e, o); DL.sleeveDisplayFromStore(e, o);
  ok(JSON.stringify(e) === es && JSON.stringify(o) === os, "3: 소매 왕복 함수 입력 비변형");
  const bb = { minX: 0, maxX: 91.3, minY: -4, maxY: 105 }, bs = JSON.stringify(bb);
  DL.computeFitCamera(bb, 1000, 616, { SC: 11, MX: 80, MY: 100 }, 0.2, 24);
  ok(JSON.stringify(bb) === bs, "3: computeFitCamera 입력 비변형");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
