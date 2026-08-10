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

// 7. autoLayout: 앞판→뒤판→소매 가로, 실제 봉제선 간격 10, 세로중심 앞판 기준
{
  const a = DL.autoLayout(geom());
  ok(a && near(a.front.dx, 0) && near(a.front.dy, 0), "7: 앞판 앵커(0,0)");
  // back.dx = (frontMaxX 20 + 10) - backMinX 0 = 30, dy = frontCY 15 - backCY 15 = 0
  ok(near(a.back.dx, 30) && near(a.back.dy, 0), "7: 뒤판 = 앞판 오른쪽+10, 세로중심");
  // sleeve.dx = (backDisp maxX 50 + 10) - sleeveMinX 0 = 60, dy = 15 - 60 = -45
  ok(near(a.sleeve.dx, 60) && near(a.sleeve.dy, -45), "7: 소매 = 뒤판 오른쪽+10, 세로중심");
  // 실제 봉제선 간격 검증(outline 기준): 뒤판 좌단 - 앞판 우단 = 10
  ok(near((0 + a.back.dx) - 20, 10), "7: 앞↔뒤 봉제선 간격 10");
  ok(near((0 + a.sleeve.dx) - (20 + a.back.dx), 10), "7: 뒤↔소매 봉제선 간격 10");
  // 세로 중심 3피스 일치(표시 후)
  const fcy = 15, bcy = 15 + a.back.dy, scy = 60 + a.sleeve.dy;
  ok(near(fcy, bcy) && near(fcy, scy), "7: 세 피스 세로중심 일치");
}
// 8. autoLayout: 소매 없으면 소매 offset 0, 뒤판만 배치
{
  const g = geom(); g.sleeve = { outline: [], construction: [] };
  const a = DL.autoLayout(g);
  ok(near(a.back.dx, 30) && near(a.sleeve.dx, 0) && near(a.sleeve.dy, 0), "8: 소매 없음 → 0");
  // 앞판 없으면 null(안전)
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

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
