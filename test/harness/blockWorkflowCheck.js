// ══════════════════════════════════════════════
// blockWorkflowCheck.js — js/blockWorkflow.js 의 window.blockWorkflow 회귀 테스트.
//
// 실제 프로덕션 소스(blockMaster.js + blockWorkflow.js)를 같은 Node vm 컨텍스트에서
// 그대로 실행해 검증한다(구현 복사 아님). 외부 dependency/jsdom 없음.
// vm 에서는 window===global 로 브릿지해 blockWorkflow 의 bare `captureBlockSnapshot`
// (blockMaster 가 window 에 붙임)이 브라우저처럼 전역으로 보이게 한다.
//
//   node test/harness/blockWorkflowCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const JS = (f) => fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8");
const BLOCKMASTER_SRC = JS("blockMaster.js");
const BLOCKWORKFLOW_SRC = JS("blockWorkflow.js");

// ── 미니 assert ──
let PASS = 0, FAIL = 0;
const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throws(fn, reasonWanted, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    if (reasonWanted && e.reason !== reasonWanted) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${reasonWanted})`); }
    else PASS++;
  }
}

// ── blockMaster 검증에서 쓰던 것과 동일한 최소 mock ──
const MX = 40, MY = 20, SC = 4;
const p2c_ref = (x, y) => [(x - MX) / SC, (y - MY) / SC];
const SIDE = { x1: 240, y1: 100, x2: 240, y2: 300 };
const el = (tag, attrs) => ({ tagName: tag, getAttribute(k) { return (k in attrs) ? String(attrs[k]) : null; } });
const lineEl = (piece, role, c) => el("line", { "data-piece": piece, "data-geometry-role": role, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 });
const pathEl = (piece, role, d) => el("path", { "data-piece": piece, "data-geometry-role": role, d });

function defaultScene(mode) {
  const out = [];
  const body = mode !== "sleeve", sleeve = mode !== "body";
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

// blockMaster + blockWorkflow 를 같은 컨텍스트에 로드하고 제어 핸들을 돌려준다.
function makeHarness(cfg) {
  cfg = cfg || {};
  const inputs = Object.assign({ inpB: 83, inpW: 64, inpBL: 38, inpSL: 52, inpHem: 30, inpCapAdj: 3, inpDart: 12.5 }, cfg.inputs || {});
  const state = Object.assign({
    workMode: "all", armEditMode: false, neckEditMode: false, sleeveEditMode: false,
    armH: { h0: { x: 1, y: 2 }, h1a: { x: 3, y: 4 } }, fArmH: { hGa: { x: 5, y: 6 } },
    bNeckH: { h0: { x: 7, y: 8 } }, fNeckH: { h0: { x: 9, y: 10 } },
    sleeveH: { anchorCount: 9, segments: [{ c1: { x: 11, y: 12 }, c2: { x: 13, y: 14 } }] }
  }, cfg.state || {});
  const dartMoveState = Object.assign({ active: false, appliedFront: null, appliedBack: null }, cfg.dartMoveState || {});
  const sceneBuilder = cfg.sceneBuilder || defaultScene;

  const svg = { _els: [], querySelectorAll() { return this._els; } };
  function render() { svg._els = sceneBuilder(state.workMode); }
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
    isMeasureDirty: !!cfg.dirty,       // handles.js 의 전역 bare 바인딩 대체
    structuredClone: (typeof structuredClone === "function") ? structuredClone : undefined,
    console: { log() {}, warn() {}, error() {} }, Date,
    Math, JSON, Object, Array, Number, String, isFinite, Error, Infinity, NaN
  };
  vm.createContext(sandbox);
  sandbox.window = sandbox;           // 브라우저처럼 window===global → bare 전역 해석
  sandbox.globalThis = sandbox;
  vm.runInContext(BLOCKMASTER_SRC, sandbox, { filename: "blockMaster.js" });
  // capture 호출 수를 세도록 blockMaster 가 붙인 전역을 spy 로 감싼다(bare 참조가 이걸 본다).
  const realCapture = sandbox.captureBlockSnapshot;
  let captureCalls = 0;
  sandbox.captureBlockSnapshot = function () { captureCalls++; return realCapture.apply(this, arguments); };
  vm.runInContext(BLOCKWORKFLOW_SRC, sandbox, { filename: "blockWorkflow.js" });
  render();

  return {
    wf: sandbox.blockWorkflow, state, dartMoveState, inputs, calls, localStorage,
    setInput: (id, v) => { inputs[id] = v; },
    setDirty: (v) => { sandbox.isMeasureDirty = !!v; },
    captureCalls: () => captureCalls,
    resetCaptureCalls: () => { captureCalls = 0; }
  };
}

// ══════════════════════════════════════════════
// 1. 첫 완료 → block-1 v1, wrapper 필드, snapshot 중첩
{
  const h = makeHarness();
  const b = h.wf.complete();
  ok(b.id === "block-1", "1: id=block-1");
  ok(b.version === 1, "1: v1");
  ok(typeof b.completedAt === "string" && b.completedAt.length > 0, "1: completedAt metadata");
  ok(typeof b.canonicalHash === "string" && /^[0-9a-f]{8}$/.test(b.canonicalHash), "1: canonicalHash 8hex");
  ok(b.snapshot && b.snapshot.schemaVersion === 1 && b.snapshot.source && b.snapshot.geometry, "1: snapshot 중첩");
  ok(h.wf.versions().length === 1 && h.wf.hasCompleted(), "1: 이력 1건");
}

// 2. 동일 draft 재완료 → idempotent(같은 참조, version 미증가)
{
  const h = makeHarness();
  const b1 = h.wf.complete();
  const b2 = h.wf.complete();
  ok(b1 === b2, "2: idempotent 같은 참조 반환");
  ok(h.wf.versions().length === 1 && h.wf.latest().version === 1, "2: version 미증가");
}

// 3. draft 변경 → v2, v1 보존
{
  const h = makeHarness();
  const b1 = h.wf.complete();
  h.setInput("inpB", 90);              // measurements 변경
  const b2 = h.wf.complete();
  ok(b2.version === 2, "3: v2");
  ok(h.wf.versions().length === 2, "3: 이력 2건");
  ok(h.wf.versions()[0] === b1 && h.wf.versions()[0].version === 1, "3: v1 보존");
  ok(b1.canonicalHash !== b2.canonicalHash, "3: hash 상이");
}

// 4. v1 → v2 → v1 형상 복귀 → v3 (되감지 않고 새 version, 계약 8)
{
  const h = makeHarness();
  const v1 = h.wf.complete();
  h.setInput("inpB", 90); const v2 = h.wf.complete();
  h.setInput("inpB", 83); const v3 = h.wf.complete();  // v1 형상으로 복귀
  ok(v3.version === 3, "4: 복귀해도 v3");
  ok(h.wf.versions().length === 3, "4: 이력 3건");
  ok(v3.canonicalHash === v1.canonicalHash, "4: 형상 hash 는 v1 과 동일");
  ok(v3 !== v1, "4: 그러나 별개 version 객체");
}

// 5. 완료본 deepFreeze 불변
{
  const h = makeHarness();
  const b = h.wf.complete();
  ok(Object.isFrozen(b) && Object.isFrozen(b.snapshot) && Object.isFrozen(b.snapshot.source), "5: deepFreeze");
  ok(Object.isFrozen(b.snapshot.geometry.front.outline), "5: 중첩 배열 freeze");
  try { b.version = 999; } catch (e) {}
  try { b.snapshot.source.measurements.B = -1; } catch (e) {}
  ok(b.version === 1 && b.snapshot.source.measurements.B === 83, "5: 변형 무효");
}

// 6. 실패(busy) → 이력·latest 무변화 (계약 10)
{
  const h = makeHarness();
  h.wf.complete();
  const lenBefore = h.wf.versions().length, latestBefore = h.wf.latest();
  h.dartMoveState.active = true;                     // dart busy
  throws(() => h.wf.complete(), "dart-busy", "6: busy 완료 실패");
  ok(h.wf.versions().length === lenBefore && h.wf.latest() === latestBefore, "6: 실패 후 이력 무변화");
}

// 7. canonicalString 미노출 / canonicalHash 만 노출 (계약 12·16)
{
  const h = makeHarness();
  const b = h.wf.complete();
  let hasCanonStr = false;
  (function walk(o) { if (o && typeof o === "object") for (const k of Object.keys(o)) { if (k === "canonicalString") hasCanonStr = true; walk(o[k]); } })(b);
  ok(!hasCanonStr, "7: canonicalString 미노출");
  ok("canonicalHash" in b && !("hash" in b.snapshot) && !("id" in b.snapshot) && !("version" in b.snapshot), "7: hash 는 wrapper 에만, snapshot 순수");
}

// 8. 32bit hash 만으로 판정하지 않음 = idempotency 는 canonicalString 기준 (계약 15)
//    (실제 해시 충돌은 결정적으로 만들 수 없으므로, "문자열 동일→idempotent /
//     문자열 상이→새 version" 이 hash 가 아니라 문자열로 결정됨을 2·3 과 함께 확인)
{
  const h = makeHarness();
  const b1 = h.wf.complete();
  const b2 = h.wf.complete();                 // 문자열 동일 → idempotent
  h.setInput("inpW", 65);                     // 문자열만 바꿈
  const b3 = h.wf.complete();
  ok(b1 === b2 && b3.version === 2, "8: idempotency 는 canonicalString 로 판정");
}

// 9. NaN/Infinity → 명시적 실패, 무변화 (계약 18)
{
  const h = makeHarness();
  h.wf.complete();
  const lenBefore = h.wf.versions().length;
  h.state.armH.h0.x = NaN;                     // handle 에 NaN 주입(캡처는 통과, canonicalize 에서 실패)
  throws(() => h.wf.complete(), "non-finite-number", "9: NaN 완료 실패");
  ok(h.wf.versions().length === lenBefore, "9: NaN 실패 후 무변화");
  h.state.armH.h0.x = Infinity;
  throws(() => h.wf.complete(), "non-finite-number", "9: Infinity 완료 실패");
}

// 10. key 순서 무관 결정성 (계약 19) — 같은 값, key 순서만 바꿔도 idempotent
{
  const h = makeHarness();
  h.wf.complete();
  h.state.armH = { h1a: { y: 4, x: 3 }, h0: { y: 2, x: 1 } };  // 같은 값, 역순 key
  const b2 = h.wf.complete();
  ok(h.wf.versions().length === 1 && b2.version === 1, "10: key 순서 무관 idempotent");
}

// 11. 1e-4 정규화: 노이즈(<1e-4)는 idempotent, 실제 변경(>1e-4)은 새 version (계약 17)
{
  const h = makeHarness();
  h.wf.complete();
  h.state.armH.h0.x = 1 + 1e-6;                // 노이즈
  ok(h.wf.complete().version === 1 && h.wf.versions().length === 1, "11: <1e-4 노이즈 idempotent");
  h.state.armH.h0.x = 1 + 0.001;              // 실제 변경
  ok(h.wf.complete().version === 2, "11: >1e-4 변경 새 version");
}

// 12. hasCompleted / isCurrentDraftChanged
{
  const h = makeHarness();
  ok(h.wf.hasCompleted() === false && h.wf.isCurrentDraftChanged() === true, "12: 완료 전 상태");
  h.wf.complete();
  ok(h.wf.hasCompleted() === true && h.wf.isCurrentDraftChanged() === false, "12: 완료 직후 변경 없음");
  h.setInput("inpBL", 39);
  ok(h.wf.isCurrentDraftChanged() === true, "12: draft 변경 감지");
}

// 13. versions() 는 복사본 — 반환 배열 변형이 내부에 영향 없음
{
  const h = makeHarness();
  h.wf.complete();
  const arr = h.wf.versions();
  arr.push("x");
  ok(h.wf.versions().length === 1, "13: versions() 복사본");
}

// 14. namespace frozen
{
  const h = makeHarness();
  ok(Object.isFrozen(h.wf), "14: blockWorkflow frozen");
  try { h.wf.complete = null; } catch (e) {}
  ok(typeof h.wf.complete === "function", "14: 메서드 재할당 무효");
}

// 15. storage/save 미접근
{
  const h = makeHarness();
  h.wf.complete(); h.setInput("inpB", 91); h.wf.complete(); h.wf.isCurrentDraftChanged();
  ok(h.localStorage.length === 0 && h.calls.setItem === 0, "15: localStorage 미접근");
}

// ══════════════════════════════════════════════
// dirty gate (측정 dirty 상태 완료 차단) — 계약 교정
// ══════════════════════════════════════════════

// D1. valid handles/geometry 가 모두 있어도 dirty=true 면 반드시 measure-dirty
{
  const h = makeHarness();                 // 기본 = 완전한 handles/geometry
  h.setDirty(true);
  throws(() => h.wf.complete(), "measure-dirty", "D1: dirty 면 measure-dirty");
}

// D2. dirty 실패 시 captureBlockSnapshot 호출 수 0
{
  const h = makeHarness();
  h.setDirty(true);
  h.resetCaptureCalls();
  try { h.wf.complete(); } catch (e) {}
  ok(h.captureCalls() === 0, "D2: dirty 실패 시 capture 호출 0");
}

// D3. dirty 실패 후 records/latest/versions 무변화
{
  const h = makeHarness();
  h.wf.complete();                          // v1 (dirty=false)
  const lenBefore = h.wf.versions().length, latestBefore = h.wf.latest();
  h.setDirty(true);
  throws(() => h.wf.complete(), "measure-dirty", "D3: dirty 완료 실패");
  ok(h.wf.versions().length === lenBefore && h.wf.latest() === latestBefore, "D3: 실패 후 이력 무변화");
}

// D4. dirty=false 로 바꾸면 같은 상태에서 정상 v1 생성
{
  const h = makeHarness({ dirty: true });
  throws(() => h.wf.complete(), "measure-dirty", "D4: dirty 상태 차단");
  h.setDirty(false);
  const b = h.wf.complete();
  ok(b.version === 1 && h.wf.versions().length === 1, "D4: dirty 해소 후 정상 v1");
}

// D5. 완료 후 dirty=true 면 isCurrentDraftChanged()=true 이고 capture 호출 0
{
  const h = makeHarness();
  h.wf.complete();
  h.setDirty(true);
  h.resetCaptureCalls();
  const changed = h.wf.isCurrentDraftChanged();
  ok(changed === true, "D5: dirty 면 변경됨");
  ok(h.captureCalls() === 0, "D5: dirty isCurrentDraftChanged capture 0");
}

// D6. missing-handles 보다 measure-dirty 가 우선
{
  const h = makeHarness({ dirty: true, state: { armH: null } }); // 핸들 없음 + dirty
  throws(() => h.wf.complete(), "measure-dirty", "D6: missing-handles 보다 measure-dirty 우선");
}

// D7. busy 와 dirty 동시 true 여도 measure-dirty 우선
{
  const h = makeHarness({ dirty: true, dartMoveState: { active: true } });
  throws(() => h.wf.complete(), "measure-dirty", "D7: busy 보다 measure-dirty 우선");
}

// ── 결과 ──
console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
