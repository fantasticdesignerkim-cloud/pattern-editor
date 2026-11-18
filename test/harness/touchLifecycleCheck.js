// ══════════════════════════════════════════════
// touchLifecycleCheck.js — 원형 캔버스의 다트 회전 + 두 손가락 핀치 입력 수명(실행 회귀 · 2026-11-18)
//   실제 파일(원형 공식 · state.js · canvasPan.js · dartMove.js)을 vm 에서 그대로 돌리고, 이벤트는 «캔버스 캡처 → 캔버스 버블 → 창 버블» 순서로 보낸다.
//   pointer capture 를 흉내 낸다: 캔버스가 잡은 포인터는 대상이 사라져도 캔버스가 받는다 · 잡지 않은 포인터는 대상이 사라지면(render 교체) 창만 받는다.
//   §1 회전 부분 → 두 번째 손가락 = 시작 각도로 되돌림·끝 → 핀치 중 render(대상 교체) → 두 손가락 다 떼기 → 새 한 손가락 = 핀치 아님 · 다시 회전됨
//   §2 캔버스 밖에서 뗀 손가락(창만 받음) = 정리 · §3 창 blur = 손가락 기록·회전 정리 · §4 pointercancel · lostpointercapture
//   §5 따라오는 클릭 한 번만: 그 동작의 클릭 = 삼킴 · 클릭 없던 동작 뒤 새 누름의 클릭 = 삼키지 않음 · 600ms 지난 클릭 = 삼키지 않음
//   node test/harness/touchLifecycleCheck.js
// ══════════════════════════════════════════════
"use strict";
const vm = require("vm"), fs = require("fs"), path = require("path");
const { applyRecipe } = require("./dartDriver");
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const JS = path.join(__dirname, "..", "..", "js");
const tc = T => (T.CP.touchCount ? T.CP.touchCount() : -1);   // 남은 손가락 기록 수(옛 판에는 없음 → -1)

function mkT(extra) { const H = { cap: {}, bub: {} }; return Object.assign({ H, addEventListener(t, f, o) { const k = (o === true || (o && o.capture)) ? "cap" : "bub"; (H[k][t] = H[k][t] || []).push(f); } }, extra || {}); }
function setup() {
  const wrap = mkT(), cap = new Set(), win = mkT();
  const svgEl = mkT({ parentElement: wrap, style: {}, setPointerCapture: id => cap.add(id), releasePointerCapture: id => cap.delete(id), hasPointerCapture: id => cap.has(id),
    closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }), contains: t => !!(t && t.inSvg), clientWidth: 800, clientHeight: 600, appendChild() {}, setAttribute() {} });
  const inputs = { inpB: 83, inpW: 64, inpBL: 38, inpDart: 12.5 }, els = {};
  const el = (o) => Object.assign({ value: "", textContent: "", style: {}, disabled: false, classList: { toggle() {}, add() {}, remove() {} }, closest() { return null; }, addEventListener() {}, getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; }, appendChild() {}, setAttribute() {} }, o || {});
  const document = { getElementById: id => id === "cv" ? svgEl : (id in inputs ? (els[id] = els[id] || el({ value: String(inputs[id]) })) : (els[id] = els[id] || el())), createElementNS: (_n, t) => el({ tagName: t }), createElement: t => el({ tagName: t }), querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
  const st = { renders: 0, now: 1000 };
  const sb = { document, window: win, console: { log() {}, warn() {}, error() {} }, DEBUG_DART_MOVE: false, DEBUG_COLORS: false, setTimeout, clearTimeout, Math, JSON, Object, Array, Map, Set, Infinity, NaN,
    Date: { now: () => st.now }, render() { st.renders++; },
    // 프레임 묶음(2026-11-18): 손잡이 이동은 프레임당 한 번 처리된다 — 브라우저 rAF 대신 손으로 넘기는 큐(st.frame())
    requestAnimationFrame: f => { st.raf.push(f); return st.raf.length; }, cancelAnimationFrame: id => { st.raf[id - 1] = null; } };
  st.raf = []; st.frame = () => { const q = st.raf.splice(0); q.forEach(f => f && f(16)); };
  sb.globalThis = sb; win.isDesignStageActive = () => false;
  vm.createContext(sb);
  // TLC_CANVASPAN / TLC_DARTMOVE = 다른 판 파일로 같은 검사를 돌려 «고치기 전엔 실패»를 확인할 때만(기본 = 지금 파일)
  ["draft.js", "state.js", "canvasPan.js", "dartMove.js"].forEach(f => { const alt = f === "canvasPan.js" ? process.env.TLC_CANVASPAN : f === "dartMove.js" ? process.env.TLC_DARTMOVE : null; vm.runInContext(fs.readFileSync(alt || path.join(JS, f), "utf8"), sb, { filename: f }); });
  vm.runInContext("view.x=0;view.y=0;view.z=1;window.__E={dartMoveState,createDraft,buildFrontOutline,buildBackOutline,getFrontTargetOutline,getBackTargetOutline,splitFrontOutline,splitBackOutline,splitBakedOutline,findCutPoint,findCutPointBack,isClickableSeg,isBakedBoundarySeg,isDartLegType,prepareDartMoveCandidate,resolveRequestedAngle,calcFrontBaseDartAngle,calcBackBaseDartAngle,buildBackShoulderDartInfo,applyDartMove(){},EPS_CLOSED_DART};initDartMoveClickHandler();", sb);
  const E = win.__E, CP = win.canvasPan;
  // 포인터마다 «처음 닿은 대상»(손잡이 · 선) — render 가 일어나면 사라진 것으로 본다
  const targets = {}; let rendersAtDown = {};
  const handleT = { inSvg: true, closest: s => s === ".dart-rotate-handle" ? handleT : null }, lineT = { inSvg: true, closest: () => null };
  function dispatch(type, e) {
    e.type = type; e.stopped = false; e.immediate = false; e.defaultPrevented = false;
    e.stopPropagation = () => { e.stopped = true; }; e.stopImmediatePropagation = () => { e.immediate = true; e.stopped = true; }; e.preventDefault = () => { e.defaultPrevented = true; };
    const run = (list) => { for (const f of (list || [])) { f(e); if (e.immediate) return true; } return false; };
    if (run(win.H.cap[type])) return e;
    const id = e.pointerId, captured = id != null && cap.has(id), gone = id != null && targets[id] && st.renders !== rendersAtDown[id] && targets[id] !== handleT && !captured;
    const reachesSvg = e.offCanvas ? captured : (captured || !gone);
    e.target = captured ? svgEl : (targets[id] || lineT);
    if (reachesSvg) { if (run(svgEl.H.cap[type])) return e; if (!e.stopped && run(svgEl.H.bub[type])) return e; if (!e.stopped) for (const f of (wrap.H.bub[type] || [])) f(e); }
    if (!e.stopped || !reachesSvg) run(win.H.bub[type]);
    if ((type === "pointerup" || type === "pointercancel") && id != null) cap.delete(id);   // 브라우저처럼 떼면 capture 도 풀림
    return e;
  }
  const P = (id, x, y, o) => Object.assign({ pointerId: id, pointerType: "touch", isPrimary: true, button: 0, clientX: x, clientY: y }, o || {});
  const down = (id, x, y, t, o) => { targets[id] = t; rendersAtDown[id] = st.renders; return dispatch("pointerdown", P(id, x, y, o)); };
  return { sb, st, E, CP, cap, dispatch, down, P, handleT, lineT, svgEl, win };
}
function intoDrag(T) {   // 실제 엔진 경로로 «앞판 절개 · 조각 고름 · 각도 0» 상태(적용은 하지 않음)
  T.E.dartMoveState.active = true;
  const r = applyRecipe(T.E, "front", { B: 83, W: 64, BL: 38 }, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.0001 });
  T.E.dartMoveState.userAngle = 0; T.E.dartMoveState.evaluation = null;
  return r;
}
// 화면 좌표 ↔ 패턴 좌표(state.js 의 c2p 를 그대로 씀)
const scr = (T, p) => { const a = vm.runInContext("c2p(" + p.x + "," + p.y + ")", T.sb); return { x: a[0], y: a[1] }; };
function rotTarget(T, frac) {   // 손잡이를 피벗 둘레로 최대각 × frac 돌린 화면 점
  const ds = T.E.dartMoveState, d = T.E.createDraft(83, 64, 38), pv = d.pts.BP, c = ds.cutPoint, a = ds.baseAngle * frac;
  const q = { x: pv.x + (c.x - pv.x) * Math.cos(a) - (c.y - pv.y) * Math.sin(a), y: pv.y + (c.x - pv.x) * Math.sin(a) + (c.y - pv.y) * Math.cos(a) };
  return { handle: scr(T, c), to: scr(T, q) };
}

// ══ §1 회전 → 두 번째 손가락 → render → 둘 다 떼기 → 새 한 손가락 ══
{
  const T = setup(), r = intoDrag(T), ds = T.E.dartMoveState;
  ok(ds.mode === "drag" && ds.cutPoint && Math.abs(ds.baseAngle) > 0.1, "1: 실제 엔진 경로로 앞판 절개·조각 선택(회전 대기)");
  const g = rotTarget(T, 0.5);
  T.down(1, g.handle.x, g.handle.y, T.handleT);
  ok(ds.dragging && T.cap.has(1), "1: 손가락 하나로 손잡이 잡음 = 끌기 시작 · 캔버스가 그 포인터를 잡음(capture)");
  T.dispatch("pointermove", T.P(1, g.to.x, g.to.y)); T.st.frame();   // 다음 프레임에 그 이동이 반영
  const partial = ds.userAngle;
  ok(Math.abs(partial) > Math.abs(ds.baseAngle) * 0.3, "1: 부분 회전 " + (partial * 180 / Math.PI).toFixed(2) + "°");
  T.down(2, 600, 400, T.lineT, { isPrimary: false });   // 두 번째 손가락(선 위)
  ok(!ds.dragging && ds.userAngle === 0 && T.CP.pinching() && T.cap.has(2) && T.cap.has(1), "1: 두 번째 손가락 = 회전을 시작 각도(0)로 되돌리고 끝 · 핀치 시작 · 두 손가락 모두 캔버스가 잡음");
  T.dispatch("pointermove", T.P(2, 640, 430)); T.st.renders++;   // 핀치 중 다시 그림(선 교체)
  T.dispatch("pointerup", T.P(2, 640, 430)); T.dispatch("pointerup", T.P(1, g.to.x, g.to.y));
  ok(tc(T) === 0 && !T.CP.pinching() && ds.userAngle === 0, "1: 다시 그린 뒤 두 손가락 다 떼기 = 손가락 기록 0 · 핀치 끝 · 회전 섞이지 않음(0)");
  T.st.now += 2000;
  const g2 = rotTarget(T, 0.5);   // 핀치로 화면이 움직였으니 화면 좌표를 다시 구함
  const e3 = T.down(3, g2.handle.x, g2.handle.y, T.handleT);
  ok(!T.CP.pinching() && !e3.immediate && ds.dragging, "1: 새 한 손가락 = 핀치 아님 · 손잡이 다시 잡힘");
  T.dispatch("pointermove", T.P(3, g2.to.x, g2.to.y)); T.dispatch("pointerup", T.P(3, g2.to.x, g2.to.y));
  ok(Math.abs(ds.userAngle - partial) < 1e-12 && !ds.dragging, "1: 다시 같은 만큼 회전 = 같은 각도(" + (ds.userAngle * 180 / Math.PI).toFixed(2) + "°) · 끝");
}
// ══ §1b 고친 점 확인: 핀치 손가락을 캔버스가 잡지 않았다면(옛 동작) 다시 그린 뒤 떼기를 놓친다 ══
{
  const T = setup(); intoDrag(T); const realCap = T.svgEl.setPointerCapture; T.svgEl.setPointerCapture = id => { if (id === 1) realCap(id); };   // 핀치 capture 를 막아 옛 상황 흉내
  T.down(5, 500, 300, T.lineT); T.down(6, 600, 400, T.lineT, { isPrimary: false }); T.st.renders++;
  const winUps = (T.win.H.bub.pointerup || []).length;
  T.dispatch("pointerup", T.P(5, 500, 300)); T.dispatch("pointerup", T.P(6, 600, 400));
  ok(winUps >= 1 && tc(T) === 0 && !T.CP.pinching(), "1b: 캔버스가 못 받은 손가락 떼기도 창의 안전망이 정리(기록 0 · 핀치 끝) — 다음 한 손가락이 핀치로 읽히지 않음");
}
// ══ §2 캔버스 밖에서 떼기 ══
{
  const T = setup(); intoDrag(T); const ds = T.E.dartMoveState, g = rotTarget(T, 0.4);
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("pointermove", T.P(1, g.to.x, g.to.y));
  T.dispatch("pointerup", T.P(1, 900, 700, { offCanvas: true }));
  ok(!ds.dragging && tc(T) === 0 && Math.abs(ds.userAngle) > 0, "2: 캔버스 밖에서 떼도(캔버스가 잡은 포인터) 끝 · 기록 0 · 그때까지 각도 유지");
  T.down(7, 100, 100, T.lineT); T.down(8, 200, 200, T.lineT, { isPrimary: false }); T.dispatch("pointerup", T.P(7, 900, 700, { offCanvas: true })); T.dispatch("pointerup", T.P(8, 900, 700, { offCanvas: true }));
  ok(tc(T) === 0 && !T.CP.pinching(), "2: 핀치 손가락을 캔버스 밖에서 떼도 정리");
}
// ══ §3 창 blur · §4 cancel / lostpointercapture ══
{
  const T = setup(); intoDrag(T); const ds = T.E.dartMoveState, g = rotTarget(T, 0.3);
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("pointermove", T.P(1, g.to.x, g.to.y)); T.down(9, 300, 300, T.lineT, { isPrimary: false });
  (T.win.H.bub.blur || []).forEach(f => f({}));
  ok(!ds.dragging && tc(T) === 0 && !T.CP.pinching(), "3: 창 blur = 회전 끝 · 손가락 기록·핀치 정리");
  T.dispatch("pointerup", T.P(1, g.to.x, g.to.y)); T.dispatch("pointerup", T.P(9, 300, 300));   // 창으로 돌아와 손가락을 뗌
  const e1 = T.down(10, g.handle.x, g.handle.y, T.handleT);
  ok(ds.dragging && !e1.immediate && tc(T) === 1, "3: blur 뒤 새 한 손가락 = 정상으로 손잡이 잡음(핀치 아님)");
  T.dispatch("pointercancel", T.P(10, g.to.x, g.to.y));
  ok(!ds.dragging && tc(T) === 0, "4: pointercancel = 끝 · 기록 정리");
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("lostpointercapture", T.P(1, g.to.x, g.to.y));
  ok(!ds.dragging, "4: lostpointercapture = 끝");
  T.dispatch("pointerup", T.P(1, g.to.x, g.to.y));
  ok(tc(T) === 0, "4: 그 뒤 떼기도 기록 정리");
}
// ══ §5 따라오는 클릭 한 번만 ══
{
  const T = setup(); intoDrag(T); const ds = T.E.dartMoveState, g = rotTarget(T, 0.5), cut0 = JSON.stringify(ds.cutPoint);
  const clickSeen = () => { let reached = 0; const f = () => { reached++; }; T.svgEl.H.bub.click.push(f); return () => { T.svgEl.H.bub.click.pop(); return reached; }; };
  // ① 그 동작의 클릭(떼자마자 같은 자리) = 삼킴 → 새 절개로 들어가지 않음
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("pointermove", T.P(1, g.to.x, g.to.y)); T.dispatch("pointerup", T.P(1, g.to.x, g.to.y));
  let c = T.dispatch("click", T.P(1, g.to.x, g.to.y));
  ok(c.defaultPrevented && JSON.stringify(ds.cutPoint) === cut0 && ds.mode === "drag", "5: 끈 동작 뒤 따라오는 클릭 1번 = 삼킴(절개 그대로)");
  // ② 클릭이 없던 동작 → 곧바로(600ms 안 · 같은 자리) 새 누름 + 그 클릭 = 삼키지 않음
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("pointermove", T.P(1, g.to.x, g.to.y)); T.dispatch("pointerup", T.P(1, g.to.x, g.to.y));
  T.st.now += 100; T.down(4, g.to.x + 5, g.to.y + 5, T.lineT); T.dispatch("pointerup", T.P(4, g.to.x + 5, g.to.y + 5));
  c = T.dispatch("click", T.P(4, g.to.x + 5, g.to.y + 5));
  ok(!c.defaultPrevented, "5: 클릭이 없던 끌기 뒤 100ms 안의 새 탭 = 삼키지 않음(새 누름이 표시를 지움)");
  // ③ 600ms 지난 클릭 = 삼키지 않음
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("pointermove", T.P(1, g.to.x, g.to.y)); T.dispatch("pointerup", T.P(1, g.to.x, g.to.y));
  T.st.now += 700; c = T.dispatch("click", T.P(1, g.to.x, g.to.y));
  ok(!c.defaultPrevented, "5: 600ms 지난 클릭 = 삼키지 않음");
  // ④ 거리 밖(30px 넘음) = 삼키지 않음 · 한 번 확인한 뒤엔 표시가 없음
  T.down(1, g.handle.x, g.handle.y, T.handleT); T.dispatch("pointermove", T.P(1, g.to.x, g.to.y)); T.dispatch("pointerup", T.P(1, g.to.x, g.to.y));
  c = T.dispatch("click", T.P(1, g.to.x + 60, g.to.y)); const c2 = T.dispatch("click", T.P(1, g.to.x, g.to.y));
  ok(!c.defaultPrevented && !c2.defaultPrevented, "5: 30px 밖 클릭 = 삼키지 않음 · 표시는 한 번 보면 사라짐");
}

console.log("touchLifecycleCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
