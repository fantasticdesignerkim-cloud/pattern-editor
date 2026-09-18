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
  if (cfg.sideWaist !== undefined) win.sideWaistAnnotationForRender = () => cfg.sideWaist;

  const sandbox = {
    svg, document, window: win,
    E(tag, a, txt) { const el = makeEl(tag); if (a) for (const k in a) el.setAttribute(k, a[k]); if (txt !== undefined) el.textContent = txt; return el; },
    line(x1, y1, x2, y2, cls) { const el = makeEl("line"); el.setAttribute("class", cls); return el; },
    SC: 11, viewZ: 1, isMeasureDirty: false, c2p: (x, y) => [x * 10, y * 10],
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
  referenceGeometry: { front: { F: 1 }, back: { B: 1 }, shared: { S: 1 }, sleeve: { SL: 1 } },
  working: { geometry: { front: { wF: 1 }, back: { wB: 1 }, shared: { wS: 1 }, sleeve: { wSL: 1 } }, parameters: {}, layout: { front: { dx: 0, dy: 0 }, back: { dx: 0, dy: 0 }, sleeve: { dx: 0, dy: 0 }, placement: { front: "auto", back: "auto", sleeve: "auto" } } }
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
// 3. design=true + project → 전역 z-order: grid → reference root → working root → hit layer
//    (모든 reference 가 모든 working 보다 아래: 회색이 남색을 가리지 않음)
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), nValue: 83 });
  h.render();
  const roots = h.svg._appended;
  ok(roots.length === 4, "3: 그룹 4개(grid+ref root+work root+hit layer)");
  ok(roots[1]._attrs["data-design-root"] === "reference" && roots[2]._attrs["data-design-root"] === "working" && roots[3]._attrs["data-design-root"] === "hit", "3: z-order grid→reference→working→hit");
  const refKids = roots[1].childNodes.map(c => c._attrs["class"]);
  const workKids = roots[2].childNodes.map(c => c._attrs["class"]);
  ok(refKids.length === 3 && refKids.every(c => c === "block-ref"), "3: reference root=front+back+sleeve(block-ref)");
  ok(workKids.length === 3 && workKids.every(c => c === "design-working"), "3: working root=front+back+sleeve(design-working)");
  const pcs = roots[1].childNodes.map(c => c._attrs["data-layout-piece"]);
  ok(pcs[0] === "front" && pcs[1] === "back" && pcs[2] === "sleeve", "3: piece 순서 front→back→sleeve");
}
// 4. design 분기에서 createDraft·sleeve·overlay·applyLayerVisibility·updateStatusBar 호출 0
{
  const h = makeHarness({ designGetter: () => true, project: PROJECT(), nValue: 83 });
  h.render();
  const s = h.spies;
  ok(s.createDraft.calls === 0 && s.drawSleeve.calls === 0 && s.drawDartMoveOverlay.calls === 0 && s.applyLayerVisibility.calls === 0 && s.updateStatusBar.calls === 0, "4: 원형 draw 경로 호출 0");
}
// 5. 각 root 는 piece 서브셋으로 builder 호출: front=front/shared(+빈 back/sleeve),
//    back=back(+빈 나머지), sleeve=sleeve(+빈 몸판). shared 는 앞판을 따른다.
//    원본 geometry 좌표는 공유(참조), 형상 불변.
{
  const p = PROJECT();
  const h = makeHarness({ designGetter: () => true, project: p, nValue: 83 });
  h.render();
  const rf = h.refArgs[0], rbk = h.refArgs[1], rs = h.refArgs[2];
  // 앞판 서브셋: front·shared 참조 공유, back/sleeve 는 비움
  ok(rf.front === p.referenceGeometry.front && rf.shared === p.referenceGeometry.shared, "5: 앞판 subset=front+shared(shared 는 앞판)");
  ok(rf.back.outline.length === 0 && rf.sleeve.outline.length === 0, "5: 앞판 subset back/sleeve 비움");
  // 뒤판 서브셋: back 만
  ok(rbk.back === p.referenceGeometry.back && rbk.front.outline.length === 0 && rbk.shared.outline.length === 0, "5: 뒤판 subset=back(shared 제외)");
  // 소매 서브셋: sleeve 만
  ok(rs.sleeve === p.referenceGeometry.sleeve && rs.front.outline.length === 0, "5: 소매 subset=sleeve");
  const wf = h.workArgs[0], wbk = h.workArgs[1], ws = h.workArgs[2];
  ok(wf.front === p.working.geometry.front && wbk.back === p.working.geometry.back && ws.sleeve === p.working.geometry.sleeve, "5: working subset=working.geometry");
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
  ok(h.svg._appended.length === 4 && h.svg._appended[1] !== firstRef, "8: 그룹 새 인스턴스 재생성");
}
// 9. design=true인데 project 없음 → design-project-missing 명시적 실패
{
  const h = makeHarness({ designGetter: () => true, project: null, nValue: 83 });
  throws(() => h.render(), "design-project-missing", "9: project 없는 design → design-project-missing");
  ok(h.spies.createDraft.calls === 0, "9: 실패 시 draft fallback 0");
}

// 10. 원형 옆허리 억제 보조 표시: 모델 있으면 working 과 hit 사이 annotation root 1개, 조각 offset 동승, 없으면 기존 4 root
{
  const half = 0.6875;
  const SW = { front: { available: true, underarm: { x: 23, y: 20 }, waist: { x: 23 + half, y: 38 }, guideBottom: { x: 23, y: 38 }, halfCm: half },
    back: { available: true, underarm: { x: 23, y: 20 }, waist: { x: 23 - half, y: 38 }, guideBottom: { x: 23, y: 38 }, halfCm: half }, totalCm: 2 * half };
  const pr = PROJECT(); pr.working.layout.front = { dx: 10, dy: 1 };
  const h = makeHarness({ designGetter: () => true, project: pr, nValue: 83, sideWaist: SW });
  h.render();
  const roots = h.svg._appended, names = roots.map(r => r._attrs["data-design-root"]);
  ok(roots.length === 5 && names[2] === "working" && names[3] === "side-waist-annotation" && names[4] === "hit", "10: working → side-waist-annotation → hit (" + names.join(",") + ")");
  const grs = roots[3].childNodes;
  ok(grs.length === 2 && grs.every(g => g._attrs["class"] === "side-waist-anno") && grs.map(g => g._attrs["data-side-waist"]).join(",") === "back,front", "10: 뒤·앞 각 1그룹(pointer-events:none 클래스)");
  const fg = grs.find(g => g._attrs["data-side-waist"] === "front");
  const workFront = roots[2].childNodes.find(c => c._attrs["data-layout-piece"] === "front");
  ok(fg._attrs.transform === workFront._attrs.transform && grs[0]._attrs.transform === roots[2].childNodes.find(c => c._attrs["data-layout-piece"] === "back")._attrs.transform, "10: 조각 그룹 transform = 같은 조각 working offset");
  const kinds = (g) => g.childNodes.map(c => c._attrs["data-anno"] || c._attrs["data-anno-text"] || c._attrs["class"]);
  ok(kinds(fg).join(",") === "guide,half,side-waist-anno-dim,side-waist-anno-dim,front", "10: 수직 보조선·치수선·양끝 tick·라벨");
  const guide = fg.childNodes[0]._attrs;
  ok(guide.class === "side-waist-anno-guide" && guide.x1 === guide.x2 && guide.x1 === "230" && guide.y1 === "200" && guide.y2 === "380", "10: 보조선 = 진동밑 x 에서 허리 y 까지 수직");
  ok(fg.childNodes[4].textContent === "원형 앞 c/2 0.69" && grs[0].childNodes[4].textContent === "원형 뒤 c/2 0.69", "10: 라벨 원형 앞/뒤 c/2 0.69");
  const h2 = makeHarness({ designGetter: () => true, project: pr, nValue: 83, sideWaist: Object.assign({}, SW, { front: { available: false, reason: "working-side-unmeasured" } }) });
  h2.render();
  ok(h2.svg._appended[3].childNodes.length === 1 && h2.svg._appended[3].childNodes[0]._attrs["data-side-waist"] === "back", "10: 표시 불가 조각은 그리지 않음");
  const h3 = makeHarness({ designGetter: () => true, project: pr, nValue: 83, sideWaist: null });
  h3.render();
  ok(h3.svg._appended.length === 4, "10: 모델 null(몸판 탭 아님 등) → annotation root 없음");
  h.render();
  ok(h.svg._appended.length === 5 && h.svg._appended.filter(r => r._attrs["data-design-root"] === "side-waist-annotation").length === 1, "10: 재렌더 중복 누적 없음");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
