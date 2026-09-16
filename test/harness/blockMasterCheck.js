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
// P0.3a(SV5): 의미 모서리 outline 은 생산자가 root 경계 identity 를 선언한다(명령마다 구간 하나).
const bndAttrs = (a, piece, role, edge, cmds) => {
  if (edge && role === "outline" && (piece === "front" || piece === "back")) {
    a["data-boundary-root"] = piece + "/" + edge;
    a["data-boundary-ranges"] = Array.from({ length: cmds }, (_, k) => (k / cmds) + "," + ((k + 1) / cmds)).join(";");
  }
};
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
    bndAttrs(a, piece, role, edge, 1);
    return el("line", a);
  };
  const pathEl = (piece, role, d, edge) => {
    const a = { "data-piece": piece, "data-geometry-role": role, d };
    if (edge) a["data-edge"] = edge;
    bndAttrs(a, piece, role, edge, (String(d).match(/C/g) || []).length);
    return el("path", a);
  };
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
// SV3 봉제 경계 의미(neckline/shoulder/armhole). 진동은 **앞판 2 span**(다트로 나뉜 형태)로
// 두어 "span 수 고정 아님 / 여러 primitive 가 같은 role" 계약을 픽스처가 직접 덮는다.
const F_NECK = { x1: 140, y1: 100, x2: 170, y2: 80 };
const F_SHOULDER = { x1: 170, y1: 80, x2: 200, y2: 60 };
const B_NECK = { x1: 60, y1: 100, x2: 90, y2: 80 };
const B_SHOULDER = { x1: 90, y1: 80, x2: 120, y2: 60 };

// 기본 scene: workMode 에 따라 파트를 포함/제외(프로덕션 body→소매 없음, sleeve→몸판 없음).
function defaultScene(mode) {
  const out = [];
  const body = mode !== "sleeve";
  const sleeve = mode !== "body";
  if (body) {
    out.push(pathEl("front", "outline", "M140,100 C160,120 180,140 200,160", "armhole")); // [0] 진동 span 1
    out.push(pathEl("front", "outline", "M200,160 C210,170 215,175 220,180", "armhole")); // 진동 span 2(같은 role)
    out.push(lineEl("front", "outline", F_NECK, "neckline"));                   // 앞 목선
    out.push(lineEl("front", "outline", F_SHOULDER, "shoulder"));               // 앞 어깨
    out.push(lineEl("front", "outline", SIDE, "side-seam"));                    // 앞 옆선
    out.push(lineEl("front", "outline", F_WAIST, "waist"));                     // 앞 허리
    out.push(lineEl("front", "outline", F_CENTER, "center"));                   // 앞 중심
    out.push(lineEl("front", "construction", { x1: 100, y1: 60, x2: 120, y2: 80 }));
    out.push(lineEl("front", "construction", { x1: 130, y1: 60, x2: 150, y2: 80 }));
    out.push(pathEl("back", "outline", "M60,100 C80,120 100,140 120,160", "armhole"));
    out.push(lineEl("back", "outline", B_NECK, "neckline"));                    // 뒤 목선
    out.push(lineEl("back", "outline", B_SHOULDER, "shoulder"));                // 뒤 어깨
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
  ok(s.schemaVersion === 6, "1: schemaVersion=6");
  ok(deepEqual(Object.keys(s).sort(), ["geometry", "schemaVersion", "source"]), "1: 최상위 키");
  const dist = {};
  ["front", "back", "shared", "sleeve"].forEach(pc => ["outline", "construction"].forEach(rl => { dist[pc + "/" + rl] = s.geometry[pc][rl].length; }));
  ok(dist["front/outline"] === 7 && dist["front/construction"] === 2, "1: front 분포");
  ok(dist["back/outline"] === 6 && dist["back/construction"] === 2, "1: back 분포");
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
    ok(s.geometry.sleeve.outline.length === 2 && s.geometry.front.outline.length === 7, "7: all 강제 수집(" + mode + ")");
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

// 테스트 19: edge 가 snapshot 에 보존 — SV2 구조(center/waist/side-seam) + SV3 봉제 의미
//   (neckline/shoulder/armhole). 앞 진동은 2 span 이라 armhole 이 두 번 나온다(span 수 비고정).
{
  const h = makeHarness();
  const s = h.capture();
  const edgesOf = (arr) => arr.filter(p => Object.prototype.hasOwnProperty.call(p, "edge")).map(p => p.edge).sort();
  ok(deepEqual(edgesOf(s.geometry.front.outline),
    ["armhole", "armhole", "center", "neckline", "shoulder", "side-seam", "waist"]), "19: front edge 집합");
  ok(deepEqual(edgesOf(s.geometry.back.outline),
    ["armhole", "center", "neckline", "shoulder", "side-seam", "waist"]), "19: back edge 집합");
}

// 테스트 20: edge 없는 primitive 는 own-property "edge" 자체가 없다
{
  const h = makeHarness();
  const s = h.capture();
  const noEdge = (p) => Object.prototype.hasOwnProperty.call(p, "edge") === false;
  ok(s.geometry.front.construction.every(noEdge), "20: front construction edge 없음");
  ok(s.geometry.sleeve.outline.every(noEdge), "20: sleeve outline edge 없음");
  ok(s.geometry.shared.construction.every(noEdge), "20: shared construction edge 없음");
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
//   data-edge 만 가리고 tagName/좌표는 그대로 둔다(path 를 line 으로 바꾸면 중복 판정에 걸린다).
{
  const stripEdge = (e) => ({ tagName: e.tagName, getAttribute(k) { return k === "data-edge" ? null : e.getAttribute(k); } });
  const v1Scene = (mode) => defaultScene(mode).map(stripEdge);
  throws(() => makeHarness({ sceneBuilder: v1Scene }).capture(), "missing-required-edge", "28: 모서리 없는 v1형 거부");
}

// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// 테스트 32(SV4): 구조화 다트 의미가 **선언된 대로만** snapshot 에 실린다.
{
  const dartEl = (piece, role, c, meta) => {
    const a = { "data-piece": piece, "data-geometry-role": role, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2,
      "data-dart-id": meta.id, "data-dart-apex-at": meta.apexAt };
    if (meta.boundary) a["data-dart-boundary"] = meta.boundary;
    if (meta.onFold) a["data-dart-on-fold"] = "true";
    if (meta.attach) { a["data-dart-attach-root"] = meta.attach.root; a["data-dart-attach-t"] = String(meta.attach.t); }
    return el("line", a);
  };
  // apex=(200,200) 공유, leg=(180,260)·(220,260)
  const withDarts = (mode) => {
    const base = defaultScene(mode);
    if (mode === "sleeve") return base;
    return base.concat([
      dartEl("front", "construction", { x1: 180, y1: 260, x2: 200, y2: 200 }, { id: "front-bust", boundary: "armhole", apexAt: "to", attach: { root: "front/armhole", t: 1 } }),
      dartEl("front", "construction", { x1: 220, y1: 260, x2: 200, y2: 200 }, { id: "front-bust", boundary: "armhole", apexAt: "to", attach: { root: "front/armhole", t: 0 } }),
      dartEl("back", "construction", { x1: 80, y1: 260, x2: 100, y2: 200 }, { id: "back-waist-f", boundary: "waist", apexAt: "to", onFold: true, attach: { root: "back/waist", t: 0.3 } })
    ]);
  };
  const s4 = makeHarness({ sceneBuilder: withDarts }).capture();
  const fd = s4.geometry.front.construction.filter(p => p.dart);
  ok(fd.length === 2 && fd.every(p => p.dart.id === "front-bust" && p.dart.boundary === "armhole" && p.dart.apexAt === "to"),
    "32: 앞판 가슴다트 2다리 의미 보존");
  const bd = s4.geometry.back.construction.filter(p => p.dart);
  ok(bd.length === 1 && bd[0].dart.onFold === true, "32: 접어재단 반쪽 다트(다리 1개) 허용");
  // 선언 없는 primitive 엔 dart own-property 자체가 없다
  ok(s4.geometry.front.outline.every(p => !Object.prototype.hasOwnProperty.call(p, "dart")), "32: 선언 없으면 dart 속성 없음");
  // JSON 왕복 보존
  const rt = JSON.parse(JSON.stringify(s4));
  ok(JSON.stringify(rt.geometry.front.construction) === JSON.stringify(s4.geometry.front.construction), "32: JSON 왕복 보존");
}

// 테스트 33(SV4): 다트 선언 실패 계약
{
  const mk = (extraEls) => (mode) => mode === "sleeve" ? defaultScene(mode) : defaultScene(mode).concat(extraEls);
  const dl = (attrs) => el("line", Object.assign({ "data-piece": "front", "data-geometry-role": "construction", x1: 1, y1: 1, x2: 2, y2: 2 }, attrs));
  // apex-at 누락/오값
  throws(() => makeHarness({ sceneBuilder: mk([dl({ "data-dart-id": "d1", "data-dart-boundary": "waist" })]) }).capture(),
    "bad-dart-apex-at", "33: apex-at 누락 거부");
  throws(() => makeHarness({ sceneBuilder: mk([dl({ "data-dart-id": "d1", "data-dart-apex-at": "middle" })]) }).capture(),
    "bad-dart-apex-at", "33: apex-at 오값 거부");
  // boundary 화이트리스트
  throws(() => makeHarness({ sceneBuilder: mk([dl({ "data-dart-id": "d1", "data-dart-boundary": "bogus", "data-dart-apex-at": "to" })]) }).capture(),
    "bad-dart-boundary", "33: boundary 오값 거부");
  // 다리 1개(비 onFold) → legs-invalid
  throws(() => makeHarness({ sceneBuilder: mk([dl({ "data-dart-id": "d1", "data-dart-boundary": "waist", "data-dart-apex-at": "to" })]) }).capture(),
    "dart-legs-invalid", "33: 다리 1개(비 fold) 거부");
  // apex 불일치
  const a1 = dl({ "data-dart-id": "d2", "data-dart-boundary": "waist", "data-dart-apex-at": "to" });
  const a2 = el("line", { "data-piece": "front", "data-geometry-role": "construction", x1: 9, y1: 9, x2: 8, y2: 8,
    "data-dart-id": "d2", "data-dart-boundary": "waist", "data-dart-apex-at": "to" });
  throws(() => makeHarness({ sceneBuilder: mk([a1, a2]) }).capture(), "dart-apex-mismatch", "33: apex 불일치 거부");
  // 소매엔 다트 의미 금지
  const sl = el("line", { "data-piece": "sleeve", "data-geometry-role": "outline", x1: 1, y1: 1, x2: 2, y2: 2,
    "data-dart-id": "d3", "data-dart-apex-at": "to" });
  throws(() => makeHarness({ sceneBuilder: (mode) => mode === "body" ? defaultScene(mode) : defaultScene(mode).concat([sl]) }).capture(),
    "dart-placement", "33: sleeve 다트 의미 거부");
}

// 테스트 34(SV6, P0.3b): 다트 다리 경계 attachment — 선언 그대로 보존, 잘못된 선언·미포함은 명시적 거부.
{
  const leg = (piece, c, meta) => {
    const a = { "data-piece": piece, "data-geometry-role": "construction", x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2,
      "data-dart-id": meta.id, "data-dart-apex-at": "to", "data-dart-boundary": meta.boundary };
    if (meta.root !== undefined) a["data-dart-attach-root"] = meta.root;
    if (meta.t !== undefined) a["data-dart-attach-t"] = String(meta.t);
    return el("line", a);
  };
  const scene = (legs, mutateBase) => (mode) => {
    let base = defaultScene(mode); if (mutateBase) base = base.map(mutateBase);
    return mode === "sleeve" ? base : base.concat(legs);
  };
  const two = (m1, m2) => [leg("front", { x1: 180, y1: 260, x2: 200, y2: 200 }, m1), leg("front", { x1: 220, y1: 260, x2: 200, y2: 200 }, m2)];
  const good = { id: "dx", boundary: "armhole", root: "front/armhole", t: 0.25 };
  const s = makeHarness({ sceneBuilder: scene(two(good, Object.assign({}, good, { t: 0.75 }))) }).capture();
  const legs = s.geometry.front.construction.filter(p => p.dart);
  ok(legs.length === 2 && legs[0].dart.attach.root === "front/armhole" && legs[0].dart.attach.t === 0.25 && legs[1].dart.attach.t === 0.75,
    "34: attachment 선언값 그대로(root·t)");
  ok(legs[0].dart.attach !== makeHarness({ sceneBuilder: scene(two(good, good)) }).capture().geometry.front.construction.find(p => p.dart).dart.attach,
    "34: 캡처 간 attachment 참조 공유 없음");
  // 같은 root+t 두 다리(이동 다트형) 허용 · shared 다트의 앞/뒤 서로 다른 root 허용
  ok(!!makeHarness({ sceneBuilder: scene(two(good, good)) }).capture(), "34: 두 다리 같은 root+t 허용");
  const sharedLegs = [leg("shared", { x1: 230, y1: 300, x2: 240, y2: 200 }, { id: "sc", boundary: "waist", root: "back/waist", t: 0.9 }),
    leg("shared", { x1: 250, y1: 300, x2: 240, y2: 200 }, { id: "sc", boundary: "waist", root: "front/waist", t: 0.05 })];
  const ss = makeHarness({ sceneBuilder: scene(sharedLegs) }).capture();
  ok(ss.geometry.shared.construction.filter(p => p.dart).map(p => p.dart.attach.root).join(",") === "back/waist,front/waist", "34: shared 다트 서로 다른 root 허용");
  throws(() => makeHarness({ sceneBuilder: scene(two({ id: "dx", boundary: "armhole" }, good)) }).capture(), "missing-dart-attachment", "34: attachment 누락 거부");
  throws(() => makeHarness({ sceneBuilder: scene(two(Object.assign({}, good, { t: 1.2 }), good)) }).capture(), "bad-dart-attachment", "34: t 범위 밖 거부");
  throws(() => makeHarness({ sceneBuilder: scene(two(Object.assign({}, good, { root: "front/nope" }), good)) }).capture(), "bad-dart-attachment", "34: 모르는 root 거부");
  throws(() => makeHarness({ sceneBuilder: scene(two(Object.assign({}, good, { root: "back/armhole" }), good)) }).capture(), "dart-attachment-mismatch", "34: 다른 piece root 거부");
  throws(() => makeHarness({ sceneBuilder: scene(two(Object.assign({}, good, { root: "front/center" }), good)) }).capture(), "dart-attachment-mismatch", "34: root 의미 ≠ 다트 boundary 거부");
  throws(() => makeHarness({ sceneBuilder: scene(two(Object.assign({}, good, { root: "front/armhole-upper" }), good)) }).capture(), "dart-attachment-uncovered", "34: 캡처에 없는 root 거부");
  // 경계 구간이 t 를 덮지 않음(앞 진동 선언 구간을 0~0.5 로 좁힘)
  const narrowArm = (e) => (e.getAttribute("data-piece") === "front" && e.getAttribute("data-edge") === "armhole")
    ? { tagName: e.tagName, getAttribute(k) { return k === "data-boundary-ranges" ? "0,0.5" : e.getAttribute(k); } } : e;
  throws(() => makeHarness({ sceneBuilder: scene(two(good, Object.assign({}, good, { t: 0.75 })), narrowArm) }).capture(), "dart-attachment-uncovered", "34: 구간 밖 t 거부");
}

// 테스트 29(SV3): 봉제 경계 의미가 하나라도 빠지면 정상 v3 로 통과하지 않는다.
//   → v3 는 "신규 semantic 없이도 통과하는 optional schema" 가 아니다.
{
  const dropEdge = (edge, piece) => (mode) => defaultScene(mode).map(e =>
    (e.getAttribute("data-edge") === edge && e.getAttribute("data-piece") === piece)
      ? { tagName: e.tagName, getAttribute(k) { return k === "data-edge" ? null : e.getAttribute(k); } }
      : e);
  ["neckline", "shoulder", "armhole"].forEach(edge => {
    ["front", "back"].forEach(piece => {
      throws(() => makeHarness({ sceneBuilder: dropEdge(edge, piece) }).capture(),
        "missing-seam-edge", "29: " + piece + "/" + edge + " 누락 거부");
    });
  });
}

// 테스트 30(SV3): armhole 은 여러 연속 span 으로 나뉠 수 있고 span 수는 고정이 아니다.
//   배열 위치·primitive 종류를 identity 로 쓰지 않는다(같은 role 이 여러 primitive 에).
{
  const h = makeHarness();
  const s = h.capture();
  const arm = (pc) => s.geometry[pc].outline.filter(p => p.edge === "armhole");
  ok(arm("front").length === 2, "30: 앞 진동 2 span(다트 분할 형태)");
  ok(arm("back").length === 1, "30: 뒤 진동 1 span — span 수 고정 아님");
  ok(arm("front").every(p => p.kind === "path"), "30: span 은 primitive 종류와 무관하게 같은 role");
  // 어깨도 다중 span 가능해야 한다(뒤어깨다트로 나뉘는 실제 형태) — 위치 무관 role 집합으로 확인
  const shoulderScene = (mode) => {
    const base = defaultScene(mode);
    if (mode === "sleeve") return base;
    return base.concat([lineEl("back", "outline", { x1: 120, y1: 60, x2: 130, y2: 55 }, "shoulder")]);
  };
  const s2 = makeHarness({ sceneBuilder: shoulderScene }).capture();
  ok(s2.geometry.back.outline.filter(p => p.edge === "shoulder").length === 2, "30: 뒤 어깨 2 span 허용");
}

// 테스트 31(SV3): 신규 role 도 위치 규칙을 따른다(front/back outline 밖 금지).
{
  const onConstr = (mode) => defaultScene(mode).concat(
    mode === "sleeve" ? [] : [lineEl("front", "construction", { x1: 5, y1: 5, x2: 9, y2: 9 }, "armhole")]);
  const onSleeve = (mode) => defaultScene(mode).concat(
    mode === "body" ? [] : [lineEl("sleeve", "outline", { x1: 5, y1: 5, x2: 9, y2: 9 }, "shoulder")]);
  throws(() => makeHarness({ sceneBuilder: onConstr }).capture(), "edge-placement", "31: front construction armhole 불허");
  throws(() => makeHarness({ sceneBuilder: onSleeve }).capture(), "edge-placement", "31: sleeve outline shoulder 불허");
}

// 테스트 32(SV5, P0.3a): 생산자 선언 경계 identity 캡처 — root/ranges 를 그대로, 명령 수만큼.
{
  const s = makeHarness().capture();
  const armF = s.geometry.front.outline.filter(p => p.edge === "armhole");
  ok(armF.every(p => p.boundary && p.boundary.root === "front/armhole" && p.boundary.ranges.length === 1),
    "32: path 명령 수만큼 구간(C 1개 = 1)");
  ok(["front", "back"].every(pc => s.geometry[pc].outline.every(p => !p.edge || (p.boundary && p.boundary.root === pc + "/" + p.edge))),
    "32: 모든 의미 모서리 primitive 가 root identity 보유");
  ok(s.geometry.sleeve.outline.every(p => !("boundary" in p)) &&
     ["front", "back", "shared"].every(pc => s.geometry[pc].construction.every(p => !("boundary" in p))),
    "32: identity 없는 곳엔 필드 자체를 만들지 않음");
  const s2 = makeHarness().capture();
  ok(JSON.stringify(s.geometry) === JSON.stringify(s2.geometry), "32: 같은 입력 → 결정론적 identity");
  // 캡처본의 boundary 는 호출마다 새 객체(공유 참조 없음)
  ok(s.geometry.front.outline[0].boundary !== s2.geometry.front.outline[0].boundary, "32: 캡처 간 참조 공유 없음");
  // 두 명령 path 는 구간 2개
  const twoCmd = (mode) => defaultScene(mode).map(e =>
    (e.getAttribute("data-piece") === "back" && e.getAttribute("data-edge") === "armhole")
      ? pathEl("back", "outline", "M60,100 C70,110 80,120 90,130 C100,140 110,150 120,160", "armhole") : e);
  const s3 = makeHarness({ sceneBuilder: twoCmd }).capture();
  const ba = s3.geometry.back.outline.find(p => p.edge === "armhole");
  ok(ba.boundary.ranges.length === 2 && ba.boundary.ranges[1][0] === 0.5, "32: C 2개 path → 명령별 구간 2개");
}

// 테스트 33(SV5): identity 실패 계약 — 좌표로 채우지 않고 명시적으로 거부.
{
  const mutate = (pred, fn) => (mode) => defaultScene(mode).map(e => pred(e) ? fn(e) : e);
  const isFC = (e) => e.getAttribute("data-piece") === "front" && e.getAttribute("data-edge") === "center";
  const withAttr = (e, over) => ({ tagName: e.tagName, getAttribute(k) { return (k in over) ? over[k] : e.getAttribute(k); } });
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-root": null, "data-boundary-ranges": null })) }).capture(),
    "missing-boundary-identity", "33: 의미는 있는데 identity 없음 → 거부");
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-ranges": "0,0.5;0.5,1" })) }).capture(),
    "boundary-range-count", "33: 구간 수 ≠ 명령 수 → 거부");
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-ranges": "0,0" })) }).capture(),
    "bad-boundary-range", "33: 길이 0 구간 거부");
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-ranges": "0,1.01" })) }).capture(),
    "boundary-range-out-of-bounds", "33: [0,1] 밖 구간 거부(1.01)");
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-ranges": "-0.001,1" })) }).capture(),
    "boundary-range-out-of-bounds", "33: [0,1] 밖 구간 거부(-0.001)");
  ok(makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-ranges": "0,1.0000005" })) }).capture().geometry.front.outline
    .some(p => p.edge === "center" && p.boundary.ranges[0][1] === 1.0000005), "33: 허용치(1e-6) 이내 부동소수 오차는 수용·값 보존");
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-root": "back/center" })) }).capture(),
    "bad-boundary-root", "33: 다른 piece root 거부");
  throws(() => makeHarness({ sceneBuilder: mutate(isFC, e => withAttr(e, { "data-boundary-root": "front/waist" })) }).capture(),
    "boundary-edge-mismatch", "33: root 의미 ≠ edge 거부");
  const onSleeve = (mode) => defaultScene(mode).concat(mode === "body" ? [] :
    [el("line", { "data-piece": "sleeve", "data-geometry-role": "outline", x1: 5, y1: 5, x2: 9, y2: 9, "data-boundary-root": "front/center", "data-boundary-ranges": "0,1" })]);
  throws(() => makeHarness({ sceneBuilder: onSleeve }).capture(), "boundary-placement", "33: sleeve 에 identity 불허");
}

// ── 결과 ──
console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) process.exitCode = 1;
