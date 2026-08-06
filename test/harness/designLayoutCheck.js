// ══════════════════════════════════════════════
// designLayoutCheck.js — js/designLayout.js 의 순수 기하(bboxOf/autoSleeveOffset/
// ensureLayout) 회귀 테스트. DOM/view 연동(카메라·드래그)은 브라우저 검증 몫이라
// 여기선 다루지 않는다. 실제 소스를 vm 으로 실행한다(구현 복사 아님).
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
function geom() {
  return {
    front: { outline: [line(0, 0, 0, 10), line(0, 10, 20, 10)], construction: [] }, // x0..20 y0..10
    back: { outline: [line(-5, 2, -5, 8)], construction: [] },                       // minX -5
    shared: { outline: [], construction: [line(3, 1, 4, 2)] },
    sleeve: { outline: [line(30, 3, 40, 3), line(35, 3, 35, 15)], construction: [] } // x30..40 y3..15
  };
}

// 1. 공개 API
{
  ok(typeof DL.bboxOf === "function" && typeof DL.autoSleeveOffset === "function" && typeof DL.ensureLayout === "function", "1: 순수 API 존재");
  ok(Object.isFrozen(DL), "1: namespace frozen");
}

// 2. bboxOf(body) = front∪back∪shared
{
  const b = DL.bboxOf(geom(), "body");
  ok(b && near(b.minX, -5) && near(b.maxX, 20) && near(b.minY, 0) && near(b.maxY, 10), "2: body bbox");
}
// 3. bboxOf(sleeve)
{
  const s = DL.bboxOf(geom(), "sleeve");
  ok(s && near(s.minX, 30) && near(s.maxX, 40) && near(s.minY, 3) && near(s.maxY, 15), "3: sleeve bbox");
}
// 4. path(cubic) 점도 bbox 에 포함
{
  const g = geom(); g.sleeve.outline.push(cubic([[45, 1], [46, 2], [47, 20], [48, 21]]));
  const s = DL.bboxOf(g, "sleeve");
  ok(near(s.maxX, 48) && near(s.maxY, 21), "4: cubic 점 포함");
}
// 5. 빈 piece → null
{
  const g = geom(); g.sleeve = { outline: [], construction: [] };
  ok(DL.bboxOf(g, "sleeve") === null, "5: 빈 sleeve bbox null");
}

// 6. autoSleeveOffset 넓은 화면 = 몸판 오른쪽 + 5
{
  const o = DL.autoSleeveOffset(geom(), false);
  // dx = (bodyMaxX 20 + 5) - sleeveMinX 30 = -5, dy = 0
  ok(near(o.dx, -5) && near(o.dy, 0), "6: wide → 오른쪽+5");
}
// 7. autoSleeveOffset 좁은 화면 = 몸판 아래 + 5
{
  const o = DL.autoSleeveOffset(geom(), true);
  // dy = (bodyMaxY 10 + 5) - sleeveMinY 3 = 12, dx = 0
  ok(near(o.dx, 0) && near(o.dy, 12), "7: narrow → 아래+5");
}
// 8. body 또는 sleeve 없으면 offset 0(안전)
{
  const g = geom(); g.sleeve = { outline: [], construction: [] };
  const o = DL.autoSleeveOffset(g, false);
  ok(near(o.dx, 0) && near(o.dy, 0), "8: sleeve 없음 → 0");
}

// 9. ensureLayout: 없으면 기본값 부여, 있으면 보존
{
  const p1 = { working: {} };
  const L1 = DL.ensureLayout(p1);
  ok(L1.body.dx === 0 && L1.sleeve.dx === 0 && L1.sleevePlacement === "auto" && p1.working.layout === L1, "9: 기본 layout 부여");
  const p2 = { working: { layout: { body: { dx: 5, dy: 6 }, sleeve: { dx: 7, dy: 8 }, sleevePlacement: "manual" } } };
  const L2 = DL.ensureLayout(p2);
  ok(L2.body.dx === 5 && L2.sleeve.dy === 8 && L2.sleevePlacement === "manual", "9: 기존 layout 보존");
  // 부분 결손 보정
  const p3 = { working: { layout: { body: { dx: 1, dy: 2 } } } };
  const L3 = DL.ensureLayout(p3);
  ok(L3.sleeve.dx === 0 && L3.sleevePlacement === "auto", "9: 결손 필드 보정");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
