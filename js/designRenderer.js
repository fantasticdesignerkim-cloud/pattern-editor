// ══════════════════════════════════════════════
// js/designRenderer.js — 독립 design geometry renderer (D2: builder 만).
//
// designProject 의 snapshot geometry(referenceGeometry / working.geometry)를 **현재
// view 의 c2p** 로 SVG `<g>` 로 변환하는 builder. group 을 만들어 **반환만** 하고
// 실제 svg 에 append 하지 않는다(append·render 파이프라인 연결은 D3).
//
// 금지(이 파일에 없음): render.js hook, design stage 활성화, 디자인 시작 UI,
//   ui.js 변경, state/dartMoveState/input 접근, 기존 dart/curve 엔진 재사용, storage.
// 좌표는 전역 `c2p`(view 변환)만 쓴다 — 이것은 좌표 계약이지 pattern state 접근이 아니다.
//
// 공개 namespace:
//   window.designRenderer = Object.freeze({ createReferenceGroup, createWorkingGroup })
//     · createReferenceGroup(geometry) → <g class="block-ref" data-design-layer="reference">
//     · createWorkingGroup(geometry)   → <g class="design-working" data-design-layer="working">
//   둘 다 view-only: 그룹에 CSS pointer-events:none(자식 상속). 이벤트 리스너 0.
//   입력 geometry 변형 0, DOM append 0, 실패 시 부분 group 반환 0.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const PIECES = ["front", "back", "shared", "sleeve"];
  const ROLES = ["outline", "construction"];
  // 고정 순회 순서(deterministic).
  const ORDER = [
    ["front", "outline"], ["front", "construction"],
    ["back", "outline"], ["back", "construction"],
    ["shared", "outline"], ["shared", "construction"],
    ["sleeve", "outline"], ["sleeve", "construction"]
  ];

  function fail(reason, detail) {
    const e = new Error("designRenderer: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }

  function toScreen(pt) {
    if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number"
      || !isFinite(pt.x) || !isFinite(pt.y)) fail("non-finite-coordinate", pt);
    const s = c2p(pt.x, pt.y);
    if (!s || !isFinite(s[0]) || !isFinite(s[1])) fail("non-finite-coordinate", pt);
    return s;
  }

  function makeLine(prim) {
    if (!prim.from || !prim.to) fail("invalid-primitive", prim);
    const a = toScreen(prim.from), b = toScreen(prim.to);
    const el = document.createElementNS(NS, "line");
    el.setAttribute("x1", a[0]); el.setAttribute("y1", a[1]);
    el.setAttribute("x2", b[0]); el.setAttribute("y2", b[1]);
    return el;
  }

  function makePath(prim) {
    if (!Array.isArray(prim.commands) || prim.commands.length === 0) fail("invalid-primitive", prim);
    let d = "";
    for (const c of prim.commands) {
      if (!c || (c.type !== "M" && c.type !== "C")) fail("invalid-path-command", c && c.type);
      if (!Array.isArray(c.points)) fail("invalid-path-command", c && c.type);
      if (c.type === "M" && c.points.length !== 1) fail("invalid-path-command", "M-point-count");
      if (c.type === "C" && c.points.length !== 3) fail("invalid-path-command", "C-point-count");
      const s = c.points.map(toScreen);
      if (c.type === "M") d += "M" + s[0][0] + "," + s[0][1];
      else d += " C" + s[0][0] + "," + s[0][1] + " " + s[1][0] + "," + s[1][1] + " " + s[2][0] + "," + s[2][1];
    }
    const el = document.createElementNS(NS, "path");
    el.setAttribute("d", d);
    el.setAttribute("fill", "none");
    return el;
  }

  function makePrimitive(prim) {
    if (!prim || typeof prim !== "object") fail("invalid-primitive", prim);
    if (prim.kind === "line") return makeLine(prim);
    if (prim.kind === "path") return makePath(prim);
    fail("invalid-primitive", prim.kind);
  }

  function validGeometry(geometry) {
    if (!geometry || typeof geometry !== "object") return false;
    for (const pc of PIECES) {
      const bucket = geometry[pc];
      if (!bucket || typeof bucket !== "object") return false;
      for (const rl of ROLES) if (!Array.isArray(bucket[rl])) return false;
    }
    return true;
  }

  // 실패 시 부분 group 을 만들지 않도록, 모든 child 를 먼저 생성한 뒤에야 group 을
  // 조립한다(도중 throw 면 group 미생성·append 0).
  function buildGroup(geometry, cls, layer) {
    if (!validGeometry(geometry)) fail("invalid-geometry");
    const kids = [];
    for (const [pc, rl] of ORDER) {
      const arr = geometry[pc][rl];
      for (let i = 0; i < arr.length; i++) {
        const el = makePrimitive(arr[i]);
        el.setAttribute("data-piece", pc);
        el.setAttribute("data-geometry-role", rl);
        el.setAttribute("data-design-layer", layer);
        kids.push(el);
      }
    }
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", cls);
    g.setAttribute("data-design-layer", layer);
    for (let i = 0; i < kids.length; i++) g.appendChild(kids[i]);
    return g; // append 는 호출자(D3) 책임
  }

  function createReferenceGroup(geometry) { return buildGroup(geometry, "block-ref", "reference"); }
  function createWorkingGroup(geometry) { return buildGroup(geometry, "design-working", "working"); }

  window.designRenderer = Object.freeze({
    createReferenceGroup: createReferenceGroup,
    createWorkingGroup: createWorkingGroup
  });
})();
