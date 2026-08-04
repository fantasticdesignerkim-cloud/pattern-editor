// ══════════════════════════════════════════════
// blockMasterCheck.js — js/blockMaster.js 의 captureBlockSnapshot() 회귀 테스트.
//
// 실제 프로덕션 소스(js/blockMaster.js)를 Node vm 으로 그대로 실행해 공개 함수를
// 검증한다. 구현을 복사하지 않는다(복사 검증은 프로덕션 변화를 못 잡는다).
//
// 외부 dependency/jsdom 없음. blockMaster.js 가 실제 소비하는 최소한만 plain JS
// mock 으로 구성한다: window / document(getElementById) / svg(querySelectorAll) /
// input(value) / state / dartMoveState / workMode / setWorkMode / render / p2c_ /
// structuredClone / n.
//
//   node test/harness/blockMasterCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "..", "js", "blockMaster.js"), "utf8");

// ── 미니 assert 프레임워크 ──
let PASS = 0, FAIL = 0;
const fails = [];
function ok(cond, name) {
  if (cond) { PASS++; } else { FAIL++; fails.push(name); }
}
function throws(fn, reasonWanted, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    if (reasonWanted && e.reason !== reasonWanted) { FAIL++; fails.push(name + ` (reason=${e.reason}, 기대=${reasonWanted})`); }
    else PASS++;
  }
}
function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
// 두 객체 트리가 동일 객체/배열 참조를 공유하는지 탐색.
function sharesRef(a, b) {
  const refsA = new Set();
  (function walk(o) { if (o && typeof o === "object") { if (refsA.has(o)) return; refsA.add(o); Object.values(o).forEach(walk); } })(a);
  let shared = false;
  const seen = new Set();
  (function walk(o) { if (o && typeof o === "object") { if (refsA.has(o)) { shared = true; return; } if (seen.has(o)) return; seen.add(o); Object.values(o).forEach(walk); } })(b);
  return shared;
}

// ── 알려진 좌표 변환(테스트가 결과를 예측할 수 있도록 고정) ──
const MX = 40, MY = 20, SC = 4;
const p2c_ref = (x, y) => [(x - MX) / SC, (y - MY) / SC];

// 앞/뒤 옆선 공유 좌표(테스트 15: 같은 좌표의 front/back 옆선 허용).
const SIDE = { x1: 240, y1: 100, x2: 240, y2: 300 };

function elFactory() {
  const el = (tag, attrs) => ({ tagName: tag, getAttribute(k) { return (k in attrs) ? String(attrs[k]) : null; } });
  // edge(선택): 있을 때만 data-edge 속성을 넣는다(없으면 getAttribute 가 null → 실제 DOM 동일).
  const lineEl = (piece, role, c, edge) => {
    const a = { "data-piece": piece, "data-geometry-role": role, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 };
    if (edge) a["data-edge"] = edge;
    return el("line", a);
  };
  const pathEl = (piece, role, d) => el("path", { "data-piece": piece, "data-geometry-role": role, d });
  return { el, lineEl, pathEl };
}
const { el, lineEl, pathEl } = elFactory();

// SV2 의미 모서리 좌표(junction 이 유일하도록 설계).
//  front: side(240,100→240,300) ∩ waist(240,300→140,300) = (240,300);
//         center(140,300→140,100) ∩ waist = (140,300).
//  back:  side(SIDE 동일) ∩ waist(240,300→60,300) = (240,300);
//         center(60,300→60,100) ∩ waist = (60,300).
const F_WAIST = { x1: 240, y1: 300, x2: 140, y2: 300 };
const F_CENTER = { x1: 140, y1: 300, x2: 140, y2: 100 };
const B_WAIST = { x1: 240, y1: 300, x2: 60, y2: 300 };
const B_CENTER = { x1: 60, y1: 300, x2: 60, y2: 100 };

// 기본 scene: workMode 에 따라 파트를 포함/제외(프로덕션 body→소매 없음, sleeve→몸판 없음).
function defaultScene(mode) {
  const out = [];
  const body = mode !== "sleeve";
  const sleeve = mode !== "body";
  if (body) {
    out.push(pathEl("front", "outline", "M140,100 C160,120 180,140 200,160")); // [0] 진동곡선(edge 없음)
    out.push(lineEl("front", "outline", SIDE, "side-seam"));                    // 앞 옆선
    out.push(lineEl("front", "outline", F_WAIST, "waist"));                     // 앞 허리
    out.push(lineEl("front", "outline", F_CENTER, "center"));                   // 앞 중심
    out.push(lineEl("front", "construction", { x1: 100, y1: 60, x2: 120, y2: 80 }));
    out.push(lineEl("front", "construction", { x1: 130, y1: 60, x2: 150, y2: 80 }));
    out.push(pathEl("back", "outline", "M60,100 C80,120 100,140 120,160"));
    out.push(lineEl("back", "outline", SIDE, "side-seam"));                     // 뒤 옆선(앞과 동일 좌표)
    out.push(lineEl("back", "outline", B_WAIST, "waist"));
    out.push(lineEl("back", "outline", B_CENTER, "center"));
    out.push(lineEl("back", "construction", { x1: 300, y1: 60, x2: 320, y2: 80 }));
    out.push(lineEl("back", "construction", { x1: 330, y1: 60, x2: 350, y2: 80 }));
    out.push(lineEl("shared", "construction", { x1: 200, y1: 60, x2: 200, y2: 80 }));
    out.push(lineEl("shared", "construction", { x1: 210, y1: 60, x2: 210, y2: 80 }));
  }
  if (sleeve) {
    out.push(pathEl("sleeve", "outline", "M400,100 C420,120 440,140 460,160"));
    out.push(lineEl("sleeve", "outline", { x1: 400, y1: 300, x2: 460, y2: 300 }));
  }
  return out;
}

// blockMaster.js 를 vm 으로 실행하고 mock 컨텍스트/제어 핸들을 돌려준다.
function makeHarness(cfg) {
  cfg = cfg || {};
  const inputs = Object.assign({ inpB: 83, inpW: 64, inpBL: 38, inpSL: 52, inpHem: 30, inpCapAdj: 3, inpDart: 12.5 }, cfg.inputs || {});
  const state = Object.assign({
    workMode: cfg.workMode || "all",
    armEditMode: false, neckEditMode: false, sleeveEditMode: false,
    armH: { h0: { x: 1, y: 2 }, h1a: { x: 3, y: 4 } },
    fArmH: { hGa: { x: 5, y: 6 } },
    bNeckH: { h0: { x: 7, y: 8 } },
    fNeckH: { h0: { x: 9, y: 10 } },
    sleeveH: { anchorCount: 9, segments: [{ c1: { x: 11, y: 12 }, c2: { x: 13, y: 14 } }] }
  }, cfg.state || {});
  const dartMoveState = Object.assign({ active: false, appliedFront: null, appliedBack: null }, cfg.dartMoveState || {});
  const sceneBuilder = cfg.sceneBuilder || defaultScene;

  const svg = { _els: [], querySelectorAll() { return this._els; } };
  let renderCount = 0;
  function render() { renderCount++; svg._els = sceneBuilder(state.workMode); }
  function setWorkMode(mode) { state.workMode = mode; render(); }

  const localStorage = {
    _d: {}, setItem(k, v) { calls.setItem++; this._d[k] = v; },
    getItem(k) { return this._d[k]; }, removeItem(k) { delete this._d[k]; },
    get length() { return Object.keys(this._d).length; }
  };
  const calls = { setItem: 0 };

  const document = {
    getElementById(id) {
      if (id === "cv") return cfg.noSvg ? null : svg;
      if (id === "selCapFormula") return { value: cfg.capFormula || "culture" };
      if (Object.prototype.hasOwnProperty.call(inputs, id)) return { value: String(inputs[id]) };
      return null;
    }
  };
  function n(id) { const e = document.getElementById(id); return +((e && e.value) || 0); }

  const sandbox = {
    window: {}, document, state, dartMoveState, setWorkMode, render, n,
    p2c_: p2c_ref, localStorage,
    structuredClone: (typeof structuredClone === "function") ? structuredClone : undefined,
    console: { log() {}, warn() {}, error() {} },
    Math, JSON, Object, Array, Number, String, isFinite, Error, Infinity, NaN
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "blockMaster.js" });
  render(); // 초기 scene 채우기(캡처 전 화면 상태 존재)

  return {
    capture: sandbox.window.captureBlockSnapshot,
    state, dartMoveState, svg, calls, localStorage,
    renderCount: () => renderCount, setWorkMode, render
  };
}

// ══════════════════════════════════════════════
// 테스트 1: 정상 schema + piece×role 분포
{
  const h = makeHarness();
  const s = h.capture();
  ok(s.schemaVersion === 2, "1: schemaVersion=2");
  ok(deepEqual(Object.keys(s).sort(), ["geometry", "schemaVersion", "source"]), "1: 최상위 키");
  const dist = {};
  ["front", "back", "shared", "sleeve"].forEach(pc => ["outline", "construction"].forEach(rl => { dist[pc + "/" + rl] = s.geometry[pc][rl].length; }));
  ok(dist["front/outline"] === 4 && dist["front/construction"] === 2, "1: front 분포");
  ok(dist["back/outline"] === 4 && dist["back/construction"] === 2, "1: back 분포");
  ok(dist["shared/outline"] === 0 && dist["shared/construction"] === 2, "1: shared 분포");
  ok(dist["sleeve/outline"] === 2 && dist["sleeve/construction"] === 0, "1: sleeve 분포");
  ok(deepEqual(s.source.measurements, { B: 83, W: 64, BL: 38, SL: 52, Hem: 30, capAdj: 3, capFormula: "culture", dartTotal: 12.5 }), "1: measurements");
  ok(deepEqual(Object.keys(s.source.handles).sort(), ["armH", "bNeckH", "fArmH", "fNeckH", "sleeveH"]), "1: handle 키");
  ok(s.source.appliedDarts.front === null && s.source.appliedDarts.back === null, "1: appliedDarts null");
}

// 테스트 2: line 정규화 (p2c_ 적용)
{
  const h = makeHarness();
  const s = h.capture();
  const line = s.geometry.front.construction[0]; // {x1:100,y1:60,x2:120,y2:80}
  ok(line.kind === "line", "2: kind=line");
  const f = p2c_ref(100, 60), t = p2c_ref(120, 80);
  ok(line.from.x === f[0] && line.from.y === f[1], "2: from 정규화");
  ok(line.to.x === t[0] && line.to.y === t[1], "2: to 정규화");
}

// 테스트 3: M/C endpoint·control point 정규화
{
  const h = makeHarness();
  const s = h.capture();
  const p = s.geometry.front.outline[0]; // 'M140,100 C160,120 180,140 200,160'
  ok(p.kind === "path", "3: kind=path");
  ok(p.commands.length === 2 && p.commands[0].type === "M" && p.commands[1].type === "C", "3: command 구조");
  const m = p.commands[0].points[0], mExp = p2c_ref(140, 100);
  ok(m.x === mExp[0] && m.y === mExp[1], "3: M endpoint 정규화");
  const cp = p.commands[1].points;
  const e1 = p2c_ref(160, 120), e2 = p2c_ref(180, 140), e3 = p2c_ref(200, 160);
  ok(cp.length === 3 && cp[0].x === e1[0] && cp[1].x === e2[0] && cp[2].x === e3[0], "3: C control/endpoint 정규화");
}

// 테스트 4: JSON 왕복
{
  const h = makeHarness();
  const s = h.capture();
  ok(deepEqual(s, JSON.parse(JSON.stringify(s))), "4: JSON 왕복 deepEqual");
}

// 테스트 5: 연속 캡처 deepEqual + 참조 공유 0
{
  const h = makeHarness();
  const s1 = h.capture(), s2 = h.capture();
  ok(deepEqual(s1, s2), "5: 두 캡처 deepEqual");
  ok(sharesRef(s1, s2) === false, "5: 참조 공유 없음");
}

// 테스트 6: 반환값 변형 시 원본(state/dartMoveState) 불변
{
  const h = makeHarness();
  const before = JSON.stringify({ armH: h.state.armH, sleeveH: h.state.sleeveH });
  const s = h.capture();
  s.source.handles.armH.h0.x = -99999;
  s.source.handles.sleeveH.segments[0].c1.y = -12345;
  s.geometry.front.outline.push({ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } });
  s.schemaVersion = 42;
  const after = JSON.stringify({ armH: h.state.armH, sleeveH: h.state.sleeveH });
  ok(before === after, "6: snapshot 변형이 state 를 바꾸지 않음");
}

// 테스트 7: all/body/sleeve workMode 복원 + 강제 all 수집
{
  ["all", "body", "sleeve"].forEach(mode => {
    const h = makeHarness({ workMode: mode });
    const s = h.capture();
    ok(h.state.workMode === mode, "7: workMode 복원(" + mode + ")");
    // 캡처는 내부적으로 all 로 수집하므로 분포는 항상 전 파트
    ok(s.geometry.sleeve.outline.length === 2 && s.geometry.front.outline.length === 4, "7: all 강제 수집(" + mode + ")");
  });
}

// 테스트 8: 정상 성공 후 화면(scene) 복원 — prevMode=body 면 최종 svg 에 소매 없음
{
  const h = makeHarness({ workMode: "body" });
  h.capture();
  ok(h.state.workMode === "body", "8: 성공 후 workMode=body");
  const hasSleeve = h.svg._els.some(e => e.getAttribute("data-piece") === "sleeve");
  ok(!hasSleeve, "8: 성공 후 svg 가 body scene 으로 복원");
}

// 테스트 9: collect 중 throw 후에도 finally 복원
{
  // all 에서만 중복을 주입해 collectGeometry 가 throw 하게 함. prevMode=body.
  const dupScene = (mode) => {
    const base = defaultScene(mode);
    if (mode === "all") base.push(lineEl("front", "outline", SIDE)); // front 옆선 중복
    return base;
  };
  const h = makeHarness({ workMode: "body", sceneBuilder: dupScene });
  throws(() => h.capture(), "duplicate-primitive", "9: collect throw");
  ok(h.state.workMode === "body", "9: throw 후 workMode=body 복원");
  const hasSleeve = h.svg._els.some(e => e.getAttribute("data-piece") === "sleeve");
  ok(!hasSleeve, "9: throw 후 svg body scene 복원");
}

// 테스트 10: dart / edit busy 실패
{
  throws(() => makeHarness({ dartMoveState: { active: true } }).capture(), "dart-busy", "10: dart busy");
  throws(() => makeHarness({ state: { armEditMode: true } }).capture(), "edit-busy", "10: arm edit busy");
  throws(() => makeHarness({ state: { neckEditMode: true } }).capture(), "edit-busy", "10: neck edit busy");
  throws(() => makeHarness({ state: { sleeveEditMode: true } }).capture(), "edit-busy", "10: sleeve edit busy");
}

// 테스트 11: bad piece / role
{
  const badPiece = (mode) => { const b = defaultScene(mode); b.push(lineEl("bogus", "outline", { x1: 1, y1: 1, x2: 2, y2: 2 })); return b; };
  const badRole = (mode) => { const b = defaultScene(mode); b.push(lineEl("front", "bogus", { x1: 1, y1: 1, x2: 2, y2: 2 })); return b; };
  throws(() => makeHarness({ sceneBuilder: badPiece }).capture(), "bad-piece", "11: bad piece");
  throws(() => makeHarness({ sceneBuilder: badRole }).capture(), "bad-role", "11: bad role");
}

// 테스트 12: L / Q 명령 실패
{
  const withL = (mode) => { const b = defaultScene(mode); b.push(pathEl("front", "outline", "M10,10 L20,20")); return b; };
  const withQ = (mode) => { const b = defaultScene(mode); b.push(pathEl("front", "outline", "M10,10 Q15,15 20,20")); return b; };
  throws(() => makeHarness({ sceneBuilder: withL }).capture(), "non-mc-path-command", "12: L 명령 실패");
  throws(() => makeHarness({ sceneBuilder: withQ }).capture(), "non-mc-path-command", "12: Q 명령 실패");
}

// 테스트 13: 필수 outline 없음
{
  const noSleeve = (mode) => defaultScene(mode).filter(e => !(e.getAttribute("data-piece") === "sleeve" && e.getAttribute("data-geometry-role") === "outline"));
  const noFront = (mode) => defaultScene(mode).filter(e => !(e.getAttribute("data-piece") === "front" && e.getAttribute("data-geometry-role") === "outline"));
  throws(() => makeHarness({ sceneBuilder: noSleeve }).capture(), "empty-required-outline", "13: sleeve outline 없음");
  throws(() => makeHarness({ sceneBuilder: noFront }).capture(), "empty-required-outline", "13: front outline 없음");
}

// 테스트 14: 동일 piece+role+geometry 중복 실패
{
  const dup = (mode) => { const b = defaultScene(mode); b.push(lineEl("front", "construction", { x1: 100, y1: 60, x2: 120, y2: 80 })); return b; };
  throws(() => makeHarness({ sceneBuilder: dup }).capture(), "duplicate-primitive", "14: 중복 primitive 실패");
}

// 테스트 15: 같은 좌표의 front/back 옆선은 허용
{
  const h = makeHarness();
  const s = h.capture(); // 기본 scene 은 front/back 옆선이 동일 좌표(SIDE)
  const fSide = p2c_ref(SIDE.x1, SIDE.y1);
  const frontHas = s.geometry.front.outline.some(p => p.kind === "line" && p.from.x === fSide[0] && p.from.y === fSide[1]);
  const backHas = s.geometry.back.outline.some(p => p.kind === "line" && p.from.x === fSide[0] && p.from.y === fSide[1]);
  ok(frontHas && backHas, "15: 같은 좌표 front/back 옆선 둘 다 보존");
}

// 테스트 16: DOM/class/style/data-*/카메라 상태 미노출
{
  const h = makeHarness();
  const s = h.capture();
  let bad = null;
  (function walk(o) {
    if (bad) return;
    if (typeof o === "function") { bad = "function-value"; return; }
    if (o && typeof o === "object") {
      if (typeof o.getAttribute === "function" || "tagName" in o) { bad = "dom-element"; return; }
      for (const k of Object.keys(o)) {
        if (/^(class|className|style|tagName|data-|view|viewZ|viewX|viewY|camera|zoom)$/.test(k) || k.indexOf("data-") === 0) { bad = "forbidden-key:" + k; return; }
        walk(o[k]);
      }
    }
  })(s);
  ok(bad === null, "16: DOM/class/style/data-*/카메라 미노출" + (bad ? " (" + bad + ")" : ""));
}

// 테스트 17: id/version/completedAt/designProject 미노출
{
  const h = makeHarness();
  const s = h.capture();
  let found = null;
  (function walk(o) {
    if (found) return;
    if (o && typeof o === "object") for (const k of Object.keys(o)) {
      if (/^(id|version|completedAt|designProject)$/.test(k)) { found = k; return; }
      walk(o[k]);
    }
  })(s);
  ok(found === null, "17: id/version/completedAt/designProject 미노출" + (found ? " (" + found + ")" : ""));
  ok(!("schemaVersion" in s) === false, "17: schemaVersion 은 존재(대조)");
}

// 테스트 18: storage / save / import 호출 0
{
  const h = makeHarness();
  h.capture(); h.capture();
  ok(h.localStorage.length === 0, "18: localStorage 0키");
  ok(h.calls.setItem === 0, "18: setItem 호출 0");
}

// 테스트 19: SV2 edge 가 snapshot 에 보존(앞·뒤 outline 각각 center/waist/side-seam)
{
  const h = makeHarness();
  const s = h.capture();
  const edgesOf = (arr) => arr.filter(p => Object.prototype.hasOwnProperty.call(p, "edge")).map(p => p.edge).sort();
  ok(deepEqual(edgesOf(s.geometry.front.outline), ["center", "side-seam", "waist"]), "19: front edge 집합");
  ok(deepEqual(edgesOf(s.geometry.back.outline), ["center", "side-seam", "waist"]), "19: back edge 집합");
}

// 테스트 20: edge 없는 primitive 는 own-property "edge" 자체가 없다
{
  const h = makeHarness();
  const s = h.capture();
  const noEdge = (p) => Object.prototype.hasOwnProperty.call(p, "edge") === false;
  ok(s.geometry.front.construction.every(noEdge), "20: front construction edge 없음");
  ok(s.geometry.sleeve.outline.every(noEdge), "20: sleeve outline edge 없음");
  ok(noEdge(s.geometry.front.outline[0]), "20: 진동곡선 path edge 없음");
  // undefined 값을 가진 own-property 도 없어야 한다
  const hasUndefEdge = s.geometry.front.construction.some(p => "edge" in p && p.edge === undefined);
  ok(!hasUndefEdge, "20: edge:undefined own-property 없음");
}

// 테스트 21: JSON 왕복 후에도 edge own-property 유무가 동일
{
  const h = makeHarness();
  const s = h.capture();
  const rt = JSON.parse(JSON.stringify(s));
  const key = (arr) => arr.map(p => Object.prototype.hasOwnProperty.call(p, "edge") ? p.edge : "∅").join(",");
  ok(key(s.geometry.front.outline) === key(rt.geometry.front.outline), "21: 왕복 후 edge 유무 동일");
}

// 테스트 22: bad-edge (화이트리스트 밖 값)
{
  const badEdge = (mode) => defaultScene(mode).map(e =>
    (e.getAttribute("data-piece") === "front" && e.getAttribute("data-edge") === "center")
      ? lineEl("front", "outline", F_CENTER, "bogus") : e);
  throws(() => makeHarness({ sceneBuilder: badEdge }).capture(), "bad-edge", "22: bad-edge");
}

// 테스트 23: edge-placement (front construction / sleeve outline / shared 에 edge)
{
  const onConstr = (mode) => { const b = defaultScene(mode); b.push(lineEl("front", "construction", { x1: 5, y1: 5, x2: 6, y2: 6 }, "center")); return b; };
  const onSleeve = (mode) => { const b = defaultScene(mode); if (mode !== "body") b.push(lineEl("sleeve", "outline", { x1: 5, y1: 5, x2: 6, y2: 6 }, "waist")); return b; };
  const onShared = (mode) => { const b = defaultScene(mode); b.push(lineEl("shared", "outline", { x1: 5, y1: 5, x2: 6, y2: 6 }, "center")); return b; };
  throws(() => makeHarness({ sceneBuilder: onConstr }).capture(), "edge-placement", "23: front construction edge 불허");
  throws(() => makeHarness({ sceneBuilder: onSleeve }).capture(), "edge-placement", "23: sleeve outline edge 불허");
  throws(() => makeHarness({ sceneBuilder: onShared }).capture(), "edge-placement", "23: shared outline edge 불허");
}

// 테스트 24: missing-required-edge (앞 center 제거)
{
  const noCenter = (mode) => defaultScene(mode).filter(e => !(e.getAttribute("data-piece") === "front" && e.getAttribute("data-edge") === "center"));
  throws(() => makeHarness({ sceneBuilder: noCenter }).capture(), "missing-required-edge", "24: 앞 center 누락");
}

// 테스트 25: missing-topology-junction (center 가 waist 와 끝점을 공유하지 않음)
{
  const disc = (mode) => defaultScene(mode).map(e =>
    (e.getAttribute("data-piece") === "front" && e.getAttribute("data-edge") === "center")
      ? lineEl("front", "outline", { x1: 500, y1: 300, x2: 500, y2: 100 }, "center") : e);
  throws(() => makeHarness({ sceneBuilder: disc }).capture(), "missing-topology-junction", "25: center∩waist 없음");
}

// 테스트 26: ambiguous-topology-junction (center 가 waist 집합과 끝점 2개 공유)
{
  const amb = (mode) => { const b = defaultScene(mode); if (mode !== "sleeve") b.push(lineEl("front", "outline", { x1: 140, y1: 100, x2: 300, y2: 100 }, "waist")); return b; };
  throws(() => makeHarness({ sceneBuilder: amb }).capture(), "ambiguous-topology-junction", "26: center∩waist 2개");
}

// 테스트 27: 중복 판정은 edge 를 제외 — 같은 좌표·다른 edge 는 duplicate-primitive
{
  const dupDiffEdge = (mode) => { const b = defaultScene(mode); if (mode !== "sleeve") b.push(lineEl("front", "outline", F_CENTER, "waist")); return b; };
  throws(() => makeHarness({ sceneBuilder: dupDiffEdge }).capture(), "duplicate-primitive", "27: 같은 좌표 다른 edge 중복");
}

// 테스트 28: v1형 scene(모서리 전무) → missing-required-edge 로 거부(SV2 요구)
{
  const v1Scene = (mode) => defaultScene(mode).map(e =>
    (e.getAttribute("data-edge") !== null)
      ? lineEl(e.getAttribute("data-piece"), e.getAttribute("data-geometry-role"),
          { x1: +e.getAttribute("x1"), y1: +e.getAttribute("y1"), x2: +e.getAttribute("x2"), y2: +e.getAttribute("y2") })
      : e);
  throws(() => makeHarness({ sceneBuilder: v1Scene }).capture(), "missing-required-edge", "28: 모서리 없는 v1형 거부");
}

// ── 결과 ──
console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
