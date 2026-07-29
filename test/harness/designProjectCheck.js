// ══════════════════════════════════════════════
// designProjectCheck.js — js/designProject.js 의 window.designWorkflow 회귀 테스트.
//
// 실제 프로덕션 소스(blockMaster.js + blockWorkflow.js + designProject.js)를 같은
// Node vm 컨텍스트에서 실행한다. blockWorkflow.complete() 로 **실제 CompletedBlock** 을
// 만들어 designWorkflow.startFromBlock() 에 먹인다(입력 fixture 를 손으로 지어내지 않는다).
// 외부 dependency/jsdom 없음. window===global 브릿지로 bare 전역을 해석한다.
//
//   node test/harness/designProjectCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
const SRC = { bm: JS("blockMaster.js"), bw: JS("blockWorkflow.js"), dp: JS("designProject.js") };

// ── 미니 assert ──
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throws(fn, reasonWanted, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (reasonWanted && e.reason !== reasonWanted) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${reasonWanted})`); } else PASS++; }
}
// 두 객체 트리가 동일 객체/배열 참조를 공유하는지.
function sharesRef(a, b) {
  const refsA = new Set();
  (function walk(o) { if (o && typeof o === "object") { if (refsA.has(o)) return; refsA.add(o); Object.values(o).forEach(walk); } })(a);
  let shared = false; const seen = new Set();
  (function walk(o) { if (o && typeof o === "object") { if (refsA.has(o)) { shared = true; return; } if (seen.has(o)) return; seen.add(o); Object.values(o).forEach(walk); } })(b);
  return shared;
}
function allFrozen(o) {
  if (o && typeof o === "object") {
    if (!Object.isFrozen(o)) return false;
    return Object.keys(o).every(k => allFrozen(o[k]));
  }
  return true;
}

// ── blockMaster/blockWorkflow 검증에서 쓰던 최소 mock ──
const MX = 40, MY = 20, SC = 4;
const p2c_ref = (x, y) => [(x - MX) / SC, (y - MY) / SC];
const SIDE = { x1: 240, y1: 100, x2: 240, y2: 300 };
const el = (tag, attrs) => ({ tagName: tag, getAttribute(k) { return (k in attrs) ? String(attrs[k]) : null; } });
const lineEl = (piece, role, c) => el("line", { "data-piece": piece, "data-geometry-role": role, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 });
const pathEl = (piece, role, d) => el("path", { "data-piece": piece, "data-geometry-role": role, d });
function defaultScene(mode) {
  const out = []; const body = mode !== "sleeve", sleeve = mode !== "body";
  if (body) {
    out.push(pathEl("front", "outline", "M140,100 C160,120 180,140 200,160"));
    out.push(lineEl("front", "outline", SIDE));
    out.push(lineEl("front", "construction", { x1: 100, y1: 60, x2: 120, y2: 80 }));
    out.push(pathEl("back", "outline", "M60,100 C80,120 100,140 120,160"));
    out.push(lineEl("back", "outline", SIDE));
    out.push(lineEl("back", "construction", { x1: 300, y1: 60, x2: 320, y2: 80 }));
    out.push(lineEl("shared", "construction", { x1: 200, y1: 60, x2: 200, y2: 80 }));
  }
  if (sleeve) {
    out.push(pathEl("sleeve", "outline", "M400,100 C420,120 440,140 460,160"));
    out.push(lineEl("sleeve", "outline", { x1: 400, y1: 300, x2: 460, y2: 300 }));
  }
  return out;
}

function makeHarness() {
  const inputs = { inpB: 83, inpW: 64, inpBL: 38, inpSL: 52, inpHem: 30, inpCapAdj: 3, inpDart: 12.5 };
  const state = {
    workMode: "all", armEditMode: false, neckEditMode: false, sleeveEditMode: false,
    armH: { h0: { x: 1, y: 2 } }, fArmH: { hGa: { x: 5, y: 6 } }, bNeckH: { h0: { x: 7, y: 8 } },
    fNeckH: { h0: { x: 9, y: 10 } }, sleeveH: { anchorCount: 9, segments: [{ c1: { x: 11, y: 12 }, c2: { x: 13, y: 14 } }] }
  };
  const dartMoveState = { active: false, appliedFront: null, appliedBack: null };
  const svg = { _els: [], querySelectorAll() { return this._els; } };
  function render() { svg._els = defaultScene(state.workMode); }
  function setWorkMode(mode) { state.workMode = mode; render(); }
  const calls = { setItem: 0 };
  const localStorage = { _d: {}, setItem(k, v) { calls.setItem++; this._d[k] = v; }, getItem(k) { return this._d[k]; }, get length() { return Object.keys(this._d).length; } };
  const document = {
    getElementById(id) {
      if (id === "cv") return svg;
      if (id === "selCapFormula") return { value: "culture" };
      if (Object.prototype.hasOwnProperty.call(inputs, id)) return { value: String(inputs[id]) };
      return null;
    }
  };
  function n(id) { const e = document.getElementById(id); return +((e && e.value) || 0); }

  const sandbox = {
    document, state, dartMoveState, setWorkMode, render, n, p2c_: p2c_ref, localStorage,
    isMeasureDirty: false,
    structuredClone: (typeof structuredClone === "function") ? structuredClone : undefined,
    console: { log() {}, warn() {}, error() {} }, Date,
    Math, JSON, Object, Array, Number, String, isFinite, Error, Infinity, NaN
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.runInContext(SRC.bm, sandbox, { filename: "blockMaster.js" });
  vm.runInContext(SRC.bw, sandbox, { filename: "blockWorkflow.js" });
  vm.runInContext(SRC.dp, sandbox, { filename: "designProject.js" });
  render();
  return {
    bw: sandbox.blockWorkflow, dw: sandbox.designWorkflow,
    state, inputs, calls, localStorage, setInput: (id, v) => { inputs[id] = v; }
  };
}

// ══════════════════════════════════════════════
// 1. startFromBlock → design-1, 필드 형태
{
  const h = makeHarness();
  const v1 = h.bw.complete();
  const dp = h.dw.startFromBlock(v1);
  ok(dp.id === "design-1", "1: id=design-1");
  ok(dp.sourceBlock.id === v1.id && dp.sourceBlock.version === v1.version && dp.sourceBlock.canonicalHash === v1.canonicalHash, "1: sourceBlock 일치");
  ok(typeof dp.createdAt === "string" && dp.createdAt.length > 0, "1: createdAt metadata");
  ok(dp.baseSource && dp.referenceGeometry && dp.working, "1: baseSource/referenceGeometry/working 존재");
  ok(dp.working.geometry && JSON.stringify(dp.working.parameters) === "{}", "1: working.geometry + parameters={}");
}

// 2. baseSource + referenceGeometry deepFrozen, project/sourceBlock frozen
{
  const h = makeHarness();
  const dp = h.dw.startFromBlock(h.bw.complete());
  ok(allFrozen(dp.baseSource), "2: baseSource deepFrozen");
  ok(allFrozen(dp.referenceGeometry), "2: referenceGeometry deepFrozen");
  ok(Object.isFrozen(dp) && Object.isFrozen(dp.sourceBlock), "2: project/sourceBlock frozen");
}

// 3. working.geometry / working.parameters 는 편집 대상(mutable) — 편집이 current 에 반영
{
  const h = makeHarness();
  const dp = h.dw.startFromBlock(h.bw.complete());
  dp.working.geometry.front.outline.push({ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } });
  dp.working.parameters.ease = 4;
  const now = h.dw.current();
  ok(now.working.parameters.ease === 4, "3: working.parameters 편집 반영");
  ok(now.working.geometry.front.outline.some(p => p.from && p.from.x === 0 && p.to.x === 1), "3: working.geometry 편집 반영");
}

// 4. reference/base 는 working 편집·completed 와 참조 공유 0
{
  const h = makeHarness();
  const v1 = h.bw.complete();
  const dp = h.dw.startFromBlock(v1);
  ok(sharesRef(dp, v1) === false, "4: completed 와 참조 공유 0");
  ok(dp.baseSource !== dp.working.geometry && dp.referenceGeometry !== dp.working.geometry, "4: base/reference !== working");
  // working 편집 후 referenceGeometry·baseSource·completed 불변
  const refBefore = JSON.stringify(dp.referenceGeometry), baseBefore = JSON.stringify(dp.baseSource), compBefore = JSON.stringify(v1.snapshot);
  dp.working.geometry.back.outline.push({ kind: "line", from: { x: 9, y: 9 }, to: { x: 9, y: 9 } });
  ok(JSON.stringify(dp.referenceGeometry) === refBefore, "4: working 편집이 referenceGeometry 안 바꿈");
  ok(JSON.stringify(dp.baseSource) === baseBefore, "4: working 편집이 baseSource 안 바꿈");
  ok(JSON.stringify(v1.snapshot) === compBefore, "4: working 편집이 완료본 snapshot 안 바꿈");
}

// 5. idempotent — 같은 완료본 재시작 → 같은 참조
{
  const h = makeHarness();
  const v1 = h.bw.complete();
  const a = h.dw.startFromBlock(v1), b = h.dw.startFromBlock(v1);
  ok(a === b, "5: 같은 완료본 재시작 idempotent(같은 참조)");
}

// 6. 다른 version 시작 → design-project-exists, current 불변
{
  const h = makeHarness();
  const v1 = h.bw.complete();
  h.dw.startFromBlock(v1);
  h.setInput("inpB", 90);
  const v2 = h.bw.complete();
  ok(v2.version === 2, "6: v2 준비");
  const before = h.dw.current();
  throws(() => h.dw.startFromBlock(v2), "design-project-exists", "6: 다른 version 시작 차단");
  ok(h.dw.current() === before && h.dw.current().sourceBlock.version === 1, "6: current 불변(v1 고정, 자동 교체 금지)");
}

// 7. hasProject / current
{
  const h = makeHarness();
  ok(h.dw.hasProject() === false && h.dw.current() === null, "7: 시작 전 없음");
  const dp = h.dw.startFromBlock(h.bw.complete());
  ok(h.dw.hasProject() === true && h.dw.current() === dp, "7: 시작 후 존재·current 일치");
}

// 8. 잘못된 completed → invalid-completed-block
{
  const h = makeHarness();
  throws(() => h.dw.startFromBlock(null), "invalid-completed-block", "8: null");
  throws(() => h.dw.startFromBlock({ id: "x", version: 1, canonicalHash: "h" }), "invalid-completed-block", "8: snapshot 없음");
  throws(() => h.dw.startFromBlock({ id: "x", version: 1, canonicalHash: "h", snapshot: { source: {} } }), "invalid-completed-block", "8: geometry 없음");
}

// 9. deepFrozen 변형 무효 (referenceGeometry)
{
  const h = makeHarness();
  const dp = h.dw.startFromBlock(h.bw.complete());
  try { dp.referenceGeometry.front.outline.push({ x: 1 }); } catch (e) {}
  try { dp.id = "x"; } catch (e) {}
  ok(dp.id === "design-1", "9: id 변형 무효");
  ok(!dp.referenceGeometry.front.outline.some(p => p.x === 1), "9: referenceGeometry 변형 무효");
}

// 10. namespace frozen
{
  const h = makeHarness();
  ok(Object.isFrozen(h.dw), "10: designWorkflow frozen");
  try { h.dw.startFromBlock = null; } catch (e) {}
  ok(typeof h.dw.startFromBlock === "function", "10: 메서드 재할당 무효");
}

// 11. storage/save 미접근
{
  const h = makeHarness();
  const dp = h.dw.startFromBlock(h.bw.complete());
  dp.working.parameters.x = 1;
  ok(h.localStorage.length === 0 && h.calls.setItem === 0, "11: localStorage 미접근");
}

// ── 결과 ──
console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
