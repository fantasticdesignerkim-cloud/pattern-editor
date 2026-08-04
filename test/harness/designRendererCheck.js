// ══════════════════════════════════════════════
// designRendererCheck.js — js/designRenderer.js 의 window.designRenderer 회귀 테스트.
//
// 실제 프로덕션 소스(designRenderer.js)를 Node vm 으로 실행한다. 최소 SVG mock
// (document.createElementNS 반환 요소 + c2p)만 스텁하고, 입력 geometry 는 snapshot
// 형태의 fixture 를 쓴다(designRenderer 구현을 복사하지 않는다). 외부 dependency 없음.
//
//   node test/harness/designRendererCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designRenderer.js"), "utf8");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throws(fn, reasonWanted, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (reasonWanted && e.reason !== reasonWanted) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${reasonWanted})`); } else PASS++; }
}
function sharesRef(a, b) {
  const refsA = new Set();
  (function w(o) { if (o && typeof o === "object") { if (refsA.has(o)) return; refsA.add(o); Object.values(o).forEach(w); } })(a);
  let shared = false; const seen = new Set();
  (function w(o) { if (o && typeof o === "object") { if (refsA.has(o)) { shared = true; return; } if (seen.has(o)) return; seen.add(o); Object.values(o).forEach(w); } })(b);
  return shared;
}

// ── snapshot geometry fixture (도안 좌표) ──
// 분포: front 2/2, back 2/2, shared 0/2, sleeve 2/0 = 12. front/back 옆선 동일 좌표.
const SIDE = { from: { x: 50, y: 20 }, to: { x: 50, y: 70 } };
function freshGeometry() {
  return {
    front: {
      outline: [
        { kind: "path", commands: [{ type: "M", points: [{ x: 10, y: 10 }] }, { type: "C", points: [{ x: 12, y: 12 }, { x: 14, y: 14 }, { x: 16, y: 16 }] }] },
        { kind: "line", from: { x: SIDE.from.x, y: SIDE.from.y }, to: { x: SIDE.to.x, y: SIDE.to.y } }
      ],
      construction: [
        { kind: "line", from: { x: 15, y: 10 }, to: { x: 20, y: 15 } },
        { kind: "line", from: { x: 18, y: 10 }, to: { x: 22, y: 15 } }
      ]
    },
    back: {
      outline: [
        { kind: "path", commands: [{ type: "M", points: [{ x: -10, y: 10 }] }, { type: "C", points: [{ x: -12, y: 12 }, { x: -14, y: 14 }, { x: -16, y: 16 }] }] },
        { kind: "line", from: { x: SIDE.from.x, y: SIDE.from.y }, to: { x: SIDE.to.x, y: SIDE.to.y } }  // front 와 동일 좌표
      ],
      construction: [
        { kind: "line", from: { x: -15, y: 10 }, to: { x: -20, y: 15 } },
        { kind: "line", from: { x: -18, y: 10 }, to: { x: -22, y: 15 } }
      ]
    },
    shared: {
      outline: [],  // 비어도 됨
      construction: [
        { kind: "line", from: { x: 30, y: 10 }, to: { x: 30, y: 20 } },  // 다트 c 다리 1
        { kind: "line", from: { x: 31, y: 10 }, to: { x: 31, y: 20 } }   // 다트 c 다리 2
      ]
    },
    sleeve: {
      outline: [
        { kind: "path", commands: [{ type: "M", points: [{ x: 60, y: 10 }] }, { type: "C", points: [{ x: 62, y: 12 }, { x: 64, y: 14 }, { x: 66, y: 16 }] }] },
        { kind: "line", from: { x: 60, y: 50 }, to: { x: 66, y: 50 } }
      ],
      construction: []
    }
  };
}

// ── 최소 SVG mock + c2p(가변 T 로 zoom/pan 모사) ──
function makeHarness() {
  let listenerCount = 0;
  const created = [];
  function makeEl(tag) {
    const el = {
      tagName: tag, _attrs: {}, childNodes: [], parentNode: null,
      setAttribute(k, v) { this._attrs[k] = String(v); },
      getAttribute(k) { return (k in this._attrs) ? this._attrs[k] : null; },
      hasAttribute(k) { return k in this._attrs; },
      getAttributeNames() { return Object.keys(this._attrs); },
      appendChild(c) { c.parentNode = this; this.childNodes.push(c); return c; },
      addEventListener() { listenerCount++; }
    };
    created.push(el);
    return el;
  }
  const T = { sc: 4, ox: 40, oy: 20 };
  const c2p = (x, y) => [x * T.sc + T.ox, y * T.sc + T.oy];
  const calls = { setItem: 0 };
  const localStorage = { setItem() { calls.setItem++; } };
  const sandbox = {
    document: { createElementNS(_ns, tag) { return makeEl(tag); } },
    c2p, localStorage, console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, String, isFinite, Error, Infinity, NaN
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInContext(SRC, sandbox, { filename: "designRenderer.js" });
  return { dr: sandbox.window.designRenderer, T, c2p, listeners: () => listenerCount, calls, created };
}

// child(line/path) 를 (piece,role) 순서 배열로
function childSeq(g) { return g.childNodes.map(c => c.getAttribute("data-piece") + "/" + c.getAttribute("data-geometry-role")); }

// ══════════════════════════════════════════════
// 1. 공개 API 2개
{
  const h = makeHarness();
  ok(JSON.stringify(Object.keys(h.dr).sort()) === JSON.stringify(["createReferenceGroup", "createWorkingGroup"]), "1: API 2개");
}
// 2. namespace frozen
{
  const h = makeHarness();
  ok(Object.isFrozen(h.dr), "2: frozen");
  try { h.dr.createReferenceGroup = null; } catch (e) {}
  ok(typeof h.dr.createReferenceGroup === "function", "2: 재할당 무효");
}
// 3. reference group tag/class/data
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  ok(g.tagName === "g" && g.getAttribute("class") === "block-ref" && g.getAttribute("data-design-layer") === "reference", "3: reference group 속성");
}
// 4. working group tag/class/data
{
  const h = makeHarness();
  const g = h.dr.createWorkingGroup(freshGeometry());
  ok(g.tagName === "g" && g.getAttribute("class") === "design-working" && g.getAttribute("data-design-layer") === "working", "4: working group 속성");
}
// 5. deterministic child order
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  const expect = ["front/outline", "front/outline", "front/construction", "front/construction",
    "back/outline", "back/outline", "back/construction", "back/construction",
    "shared/construction", "shared/construction", "sleeve/outline", "sleeve/outline"];
  ok(JSON.stringify(childSeq(g)) === JSON.stringify(expect), "5: 고정 순서");
}
// 6. child count 정확 (12)
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  ok(g.childNodes.length === 12, "6: child 12");
}
// 7. front/back 동일 좌표 옆선 둘 다 생성
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  const sx = h.c2p(SIDE.from.x, SIDE.from.y), ex = h.c2p(SIDE.to.x, SIDE.to.y);
  const sides = g.childNodes.filter(c => c.tagName === "line"
    && +c.getAttribute("x1") === sx[0] && +c.getAttribute("y1") === sx[1]
    && +c.getAttribute("x2") === ex[0] && +c.getAttribute("y2") === ex[1]);
  const pieces = sides.map(c => c.getAttribute("data-piece")).sort();
  ok(sides.length === 2 && pieces[0] === "back" && pieces[1] === "front", "7: 동일좌표 front/back 옆선 둘 다");
}
// 8. shared construction 두 다리
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  const sc = g.childNodes.filter(c => c.getAttribute("data-piece") === "shared" && c.getAttribute("data-geometry-role") === "construction");
  ok(sc.length === 2, "8: shared construction 2");
}
// 9. line c2p 변환
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  const line = g.childNodes.find(c => c.tagName === "line" && c.getAttribute("data-piece") === "front" && c.getAttribute("data-geometry-role") === "construction");
  const a = h.c2p(15, 10), b = h.c2p(20, 15);
  ok(+line.getAttribute("x1") === a[0] && +line.getAttribute("y1") === a[1] && +line.getAttribute("x2") === b[0] && +line.getAttribute("y2") === b[1], "9: line c2p");
}
// 10·11. M endpoint / C control·end 변환
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  const p = g.childNodes.find(c => c.tagName === "path" && c.getAttribute("data-piece") === "front");
  const m = h.c2p(10, 10), c1 = h.c2p(12, 12), c2 = h.c2p(14, 14), c3 = h.c2p(16, 16);
  const expD = "M" + m[0] + "," + m[1] + " C" + c1[0] + "," + c1[1] + " " + c2[0] + "," + c2[1] + " " + c3[0] + "," + c3[1];
  ok(p.getAttribute("d") === expD, "10·11: M/C 변환 정확");
}
// 12·13. reference/working 초기 좌표 동일, class/data-design-layer만 다름
{
  const h = makeHarness();
  const geo = freshGeometry();
  const r = h.dr.createReferenceGroup(geo), w = h.dr.createWorkingGroup(geo);
  const geomOf = g => g.childNodes.map(c => c.tagName === "line"
    ? "L:" + [c.getAttribute("x1"), c.getAttribute("y1"), c.getAttribute("x2"), c.getAttribute("y2")].join(",")
    : "P:" + c.getAttribute("d"));
  ok(JSON.stringify(geomOf(r)) === JSON.stringify(geomOf(w)), "12: 초기 좌표 동일");
  const layerOf = g => g.childNodes.map(c => c.getAttribute("data-design-layer"));
  ok(r.getAttribute("class") === "block-ref" && w.getAttribute("class") === "design-working"
    && layerOf(r).every(v => v === "reference") && layerOf(w).every(v => v === "working"), "13: class/layer만 다름");
}
// 14. 입력 geometry mutation 0
{
  const h = makeHarness();
  const geo = freshGeometry(); const before = JSON.stringify(geo);
  h.dr.createReferenceGroup(geo); h.dr.createWorkingGroup(geo);
  ok(JSON.stringify(geo) === before, "14: 입력 mutation 0");
}
// 15. 입력↔생성 DOM 참조 공유 0
{
  const h = makeHarness();
  const geo = freshGeometry();
  const g = h.dr.createReferenceGroup(geo);
  ok(sharesRef(g, geo) === false, "15: 참조 공유 0");
}
// 16. 반환 전 부모 없음
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  ok(g.parentNode === null, "16: group parentNode null");
}
// 17. 이벤트 리스너 0
{
  const h = makeHarness();
  h.dr.createReferenceGroup(freshGeometry()); h.dr.createWorkingGroup(freshGeometry());
  ok(h.listeners() === 0, "17: 리스너 0");
}
// 18. invalid geometry
{
  const h = makeHarness();
  throws(() => h.dr.createReferenceGroup(null), "invalid-geometry", "18: null geometry");
  const g = freshGeometry(); delete g.back;
  throws(() => h.dr.createReferenceGroup(g), "invalid-geometry", "18: bucket 없음");
  const g2 = freshGeometry(); g2.front.outline = "x";
  throws(() => h.dr.createReferenceGroup(g2), "invalid-geometry", "18: role 배열 아님");
}
// 19. invalid primitive
{
  const h = makeHarness();
  const g = freshGeometry(); g.front.outline.push({ kind: "blob" });
  throws(() => h.dr.createReferenceGroup(g), "invalid-primitive", "19: 알 수 없는 kind");
}
// 20. L/Q 명령 실패
{
  const h = makeHarness();
  const gL = freshGeometry(); gL.front.outline.push({ kind: "path", commands: [{ type: "M", points: [{ x: 0, y: 0 }] }, { type: "L", points: [{ x: 1, y: 1 }] }] });
  throws(() => h.dr.createReferenceGroup(gL), "invalid-path-command", "20: L 명령");
  const gQ = freshGeometry(); gQ.front.outline.push({ kind: "path", commands: [{ type: "Q", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] });
  throws(() => h.dr.createReferenceGroup(gQ), "invalid-path-command", "20: Q 명령");
}
// 21. M/C point count 실패
{
  const h = makeHarness();
  const gM = freshGeometry(); gM.front.outline.push({ kind: "path", commands: [{ type: "M", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }] });
  throws(() => h.dr.createReferenceGroup(gM), "invalid-path-command", "21: M point!=1");
  const gC = freshGeometry(); gC.front.outline.push({ kind: "path", commands: [{ type: "M", points: [{ x: 0, y: 0 }] }, { type: "C", points: [{ x: 1, y: 1 }, { x: 2, y: 2 }] }] });
  throws(() => h.dr.createReferenceGroup(gC), "invalid-path-command", "21: C point!=3");
}
// 22. NaN/Infinity
{
  const h = makeHarness();
  const gN = freshGeometry(); gN.front.construction.push({ kind: "line", from: { x: NaN, y: 0 }, to: { x: 1, y: 1 } });
  throws(() => h.dr.createReferenceGroup(gN), "non-finite-coordinate", "22: NaN");
  const gI = freshGeometry(); gI.front.construction.push({ kind: "line", from: { x: 0, y: 0 }, to: { x: Infinity, y: 1 } });
  throws(() => h.dr.createReferenceGroup(gI), "non-finite-coordinate", "22: Infinity");
}
// 23. 실패 시 group 미조립(부분 반환/append 0)
{
  const h = makeHarness();
  const gN = freshGeometry(); gN.sleeve.outline.push({ kind: "line", from: { x: NaN, y: 0 }, to: { x: 1, y: 1 } });
  try { h.dr.createReferenceGroup(gN); } catch (e) {}
  const groupsWithKids = h.created.filter(el => el.tagName === "g" && el.childNodes.length > 0);
  ok(groupsWithKids.length === 0, "23: 실패 시 group 미조립");
}
// 24. zoom/pan(c2p 변경) 후 재생성 → 새 화면좌표
{
  const h = makeHarness();
  h.dr.createReferenceGroup(freshGeometry()); // 초기
  h.T.sc = 7; h.T.ox = 100; h.T.oy = -30;      // zoom/pan
  const g2 = h.dr.createReferenceGroup(freshGeometry());
  const line = g2.childNodes.find(c => c.tagName === "line" && c.getAttribute("data-piece") === "front" && c.getAttribute("data-geometry-role") === "construction");
  const a = h.c2p(15, 10);
  ok(+line.getAttribute("x1") === a[0] && +line.getAttribute("y1") === a[1], "24: 변경된 c2p 반영");
}
// 25. 원래 geometry 도안좌표 불변
{
  const h = makeHarness();
  const geo = freshGeometry();
  h.dr.createReferenceGroup(geo); h.T.sc = 9; h.dr.createReferenceGroup(geo);
  ok(geo.front.construction[0].from.x === 15 && geo.front.outline[1].from.x === 50, "25: 도안좌표 불변");
}
// 26. 빈 shared outline 허용
{
  const h = makeHarness();
  const geo = freshGeometry();
  ok(geo.shared.outline.length === 0, "26: fixture shared outline 빈 상태");
  const g = h.dr.createReferenceGroup(geo);
  ok(!g.childNodes.some(c => c.getAttribute("data-piece") === "shared" && c.getAttribute("data-geometry-role") === "outline"), "26: 빈 shared outline 허용(자식 0)");
}
// 27. construction 보존
{
  const h = makeHarness();
  const g = h.dr.createWorkingGroup(freshGeometry());
  const con = g.childNodes.filter(c => c.getAttribute("data-geometry-role") === "construction");
  ok(con.length === 6, "27: construction 보존(front2+back2+shared2)");
}
// 28. class/style/camera 데이터 유입 0 (child 속성은 정해진 것만)
{
  const h = makeHarness();
  const g = h.dr.createReferenceGroup(freshGeometry());
  const allowed = new Set(["x1", "y1", "x2", "y2", "d", "fill", "data-piece", "data-geometry-role", "data-design-layer", "data-edge"]);
  const bad = g.childNodes.some(c => c.getAttributeNames().some(k => !allowed.has(k)));
  ok(!bad, "28: child 속성 화이트리스트 준수(class/style/camera 유입 0)");
}
// 29. storage 호출 0
{
  const h = makeHarness();
  h.dr.createReferenceGroup(freshGeometry()); h.dr.createWorkingGroup(freshGeometry());
  ok(h.calls.setItem === 0, "29: storage 호출 0");
}

// ══════════════════════════════════════════════
// SV2: edge 검증 + 재발행
// ══════════════════════════════════════════════

// 30. edge 재발행 — 있는 primitive 만 data-edge, 없는 것엔 미부여
{
  const h = makeHarness();
  const geo = freshGeometry();
  geo.front.outline[1].edge = "side-seam"; // SIDE line
  geo.back.outline[1].edge = "side-seam";
  const g = h.dr.createReferenceGroup(geo);
  const sides = g.childNodes.filter(c => c.getAttribute("data-edge") === "side-seam");
  ok(sides.length === 2, "30: side-seam 두 개 재발행");
  const path = g.childNodes.find(c => c.tagName === "path" && c.getAttribute("data-piece") === "front");
  ok(path.getAttribute("data-edge") === null, "30: edge 없는 path 엔 data-edge 미부여");
  const constr = g.childNodes.find(c => c.getAttribute("data-geometry-role") === "construction");
  ok(constr.getAttribute("data-edge") === null, "30: construction 엔 data-edge 미부여");
}

// 31. bad-edge (미지 값 / 비문자열)
{
  const h = makeHarness();
  const gb = freshGeometry(); gb.front.outline[1].edge = "bogus";
  throws(() => h.dr.createReferenceGroup(gb), "bad-edge", "31: 미지 edge 값");
  const gn = freshGeometry(); gn.front.outline[1].edge = 5;
  throws(() => h.dr.createReferenceGroup(gn), "bad-edge", "31: 비문자열 edge");
}

// 32. edge-placement (construction / sleeve outline / shared outline 에 edge)
{
  const h = makeHarness();
  const gc = freshGeometry(); gc.front.construction[0].edge = "center";
  throws(() => h.dr.createReferenceGroup(gc), "edge-placement", "32: front construction edge");
  const gs = freshGeometry(); gs.sleeve.outline[1].edge = "waist";
  throws(() => h.dr.createReferenceGroup(gs), "edge-placement", "32: sleeve outline edge");
  const gsh = freshGeometry(); gsh.shared.outline.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, edge: "center" });
  throws(() => h.dr.createReferenceGroup(gsh), "edge-placement", "32: shared outline edge");
}

// 33. 실패(bad-edge) 시 group 미조립
{
  const h = makeHarness();
  const gb = freshGeometry(); gb.front.outline[1].edge = "bogus";
  try { h.dr.createReferenceGroup(gb); } catch (e) {}
  const groupsWithKids = h.created.filter(el => el.tagName === "g" && el.childNodes.length > 0);
  ok(groupsWithKids.length === 0, "33: bad-edge 시 group 미조립");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
