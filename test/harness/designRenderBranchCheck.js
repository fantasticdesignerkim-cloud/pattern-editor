// ══════════════════════════════════════════════
// designRenderBranchCheck.js — render.js 의 design stage 분기(D3a) 회귀 테스트.
//
// 실제 render.js 를 Node vm 으로 실행하고, grid·design 분기 진입까지 필요한 최소
// mock 만 스텁한다(svg/E/line/n/document/window.designWorkflow/window.designRenderer/
// window.isDesignStageActive + 외부 draw 함수 spy). design 분기는 grid 직후 early-return
// 하므로 createDraft·원형 draw·sleeve·overlay·applyLayerVisibility·updateStatusBar 는
// 도달하지 않는다(draft 경로는 n()=0 으로 조기 반환시켜 draw 를 피한다).
//
//   node test/harness/designRenderBranchCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "render.js"), "utf8");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
function throws(fn, reasonWanted, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (reasonWanted && e.reason !== reasonWanted) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${reasonWanted})`); } else PASS++; }
}

function makeEl(tag) {
  return {
    tagName: tag, _attrs: {}, childNodes: [], textContent: "",
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return (k in this._attrs) ? this._attrs[k] : null; },
    appendChild(c) { this.childNodes.push(c); return c; }
  };
}

// cfg: { designGetter: undefined|fn, project: obj|null, rendererThrows: bool, nValue }
function makeHarness(cfg) {
  cfg = cfg || {};
  const svg = {
    innerHTML: "", _appended: [], _clearCount: 0,
    clientWidth: 10, clientHeight: 10,
    set innerHTMLValue(v) {},
    appendChild(c) { this._appended.push(c); return c; }
  };
  // svg.innerHTML="" 를 감지: 프로퍼티 setter 로 clear 카운트
  Object.defineProperty(svg, "innerHTML", {
    get() { return this._html || ""; },
    set(v) { this._html = v; if (v === "") { this._clearCount++; this._appended.length = 0; } }
  });

  const sbEl = makeEl("div");
  const capEl = makeEl("div");
  const document = { getElementById(id) { if (id === "sb") return sbEl; if (id === "capAdjVal") return capEl; return null; } };

  const spy = () => { const f = (...a) => { f.calls++; return f.ret; }; f.calls = 0; f.ret = undefined; return f; };
  const createDraft = spy(), drawSleeve = spy(), drawDartMoveOverlay = spy(), applyLayerVisibility = spy(), updateStatusBar = spy();

  const refArgs = [], workArgs = [];
  const designRenderer = {
    createReferenceGroup(geo) { refArgs.push(geo); const g = makeEl("g"); g._attrs["class"] = "block-ref"; return g; },
    createWorkingGroup(geo) { workArgs.push(geo); if (cfg.rendererThrows) { const e = new Error("designRenderer: invalid-geometry"); e.reason = "invalid-geometry"; throw e; } const g = makeEl("g"); g._attrs["class"] = "design-working"; return g; }
  };
  const designWorkflow = { current() { return ("project" in cfg) ? cfg.project : null; } };

  const win = {};
  if (cfg.designGetter !== undefined) win.isDesignStageActive = cfg.designGetter;
  win.designWorkflow = designWorkflow;
  win.designRenderer = designRenderer;

  const sandbox = {
    svg, document, window: win,
    E(tag, a, txt) { const el = makeEl(tag); if (a) for (const k in a) el.setAttribute(k, a[k]); if (txt !== undefined) el.textContent = txt; return el; },
    line(x1, y1, x2, y2, cls) { const el = makeEl("line"); el.setAttribute("class", cls); return el; },
    SC: 11, viewZ: 1, isMeasureDirty: false,
    n: cfg.nValue !== undefined ? (() => cfg.nValue) : (() => 0),
    createDraft, drawSleeve, drawDartMoveOverlay, applyLayerVisibility, updateStatusBar,
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, String, isFinite, Infinity, NaN, Error
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "render.js" });
  return { render: sandbox.render, svg, sbEl, spies: { createDraft, drawSleeve, drawDartMoveOverlay, applyLayerVisibility, updateStatusBar }, refArgs, workArgs, designRenderer };
}

const PROJECT = () => ({
  id: "design-1",
  sourceBlock: { id: "block-1", version: 1 },
  referenceGeometry: { REF: true },
  working: { geometry: { WORK: true }, parameters: {} }
});

// 1. isDesignStageActive 부재 시 초기 render()가 오류 없이 draft 경로(조기반환)로 진행
{
  const h = makeHarness({ designGetter: undefined, nValue: 0 });
  let threw = false; try { h.render(); } catch (e) { threw = true; }
  ok(!threw, "1: getter 부재 시 render() 오류 없음");
  ok(h.refArgs.length === 0 && h.workArgs.length === 0, "1: designRenderer 호출 0");
}
// 2. design=false → designRenderer 호출 0
{
  const h = makeHarness({ designGetter: () => false, nValue: 0 });
  h.render();
  ok(h.refArgs.length === 0 && h.workArgs.length === 0, "2: design=false designRenderer 0");
}
// 3. design=true + project → append 순서 grid → reference → working
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), nValue: 83 });
  h.render();
  const cls = h.svg._appended.map(g => g._attrs && g._attrs["class"]);
  ok(h.svg._appended.length === 3, "3: 그룹 3개(grid+ref+work)");
  ok(cls[1] === "block-ref" && cls[2] === "design-working", "3: 순서 grid→reference→working");
}
// 4. design 분기에서 createDraft·sleeve·overlay·applyLayerVisibility·updateStatusBar 호출 0
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), nValue: 83 });
  h.render();
  const s = h.spies;
  ok(s.createDraft.calls === 0 && s.drawSleeve.calls === 0 && s.drawDartMoveOverlay.calls === 0 && s.applyLayerVisibility.calls === 0 && s.updateStatusBar.calls === 0, "4: 원형 draw 경로 호출 0");
}
// 5. reference←referenceGeometry, working←working.geometry 전달
{
  const p = PROJECT();
  const h = makeHarness({ designGetter: () => true, project: p, nValue: 83 });
  h.render();
  ok(h.refArgs[0] === p.referenceGeometry, "5: reference 인자=referenceGeometry");
  ok(h.workArgs[0] === p.working.geometry, "5: working 인자=working.geometry");
}
// 6. status 문구가 sourceBlock id/version 사용
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), nValue: 83 });
  h.render();
  ok(h.sbEl.textContent === "디자인 · 원형 block-1 v1 참조 · 세션 전용", "6: status 문구");
}
// 7. builder 실패 → 오류 전파(원형 fallback 없음)
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), rendererThrows: true, nValue: 83 });
  throws(() => h.render(), "invalid-geometry", "7: builder 실패 전파");
  ok(h.spies.createDraft.calls === 0, "7: 실패 시 draft fallback 0");
}
// 8. 두 번째 render()에서 svg 비워지고 그룹 새로 생성
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), nValue: 83 });
  h.render();
  const firstRef = h.svg._appended[1];
  h.render();
  ok(h.svg._clearCount === 2, "8: svg.innerHTML='' 두 번(매 render clear)");
  ok(h.svg._appended.length === 3 && h.svg._appended[1] !== firstRef, "8: 그룹 새 인스턴스 재생성");
}
// 9. design=true인데 project 없음 → design-project-missing 명시적 실패
{
  const h = makeHarness({ designGetter: () => true, project: null, nValue: 83 });
  throws(() => h.render(), "design-project-missing", "9: project 없는 design → design-project-missing");
  ok(h.spies.createDraft.calls === 0, "9: 실패 시 draft fallback 0");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
