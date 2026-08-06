// ══════════════════════════════════════════════
// js/designLayout.js — Design 화면의 "작업 배치"(piece layout)만 담당.
//
// 형상(geometry)은 절대 움직이지 않는다. 몸판/소매의 **표시 offset(cm)** 을
// project.working.layout 에 두고, render 가 그 offset 을 SVG transform 으로만 적용한다.
// reference 와 working 에 같은 offset 을 적용해 회색/남색 원형이 항상 함께 이동한다.
//
// 배치 ≠ 카메라:
//  · 소매 offset  = 몸판과 겹치지 않게 재배치(넓은 화면=몸판 오른쪽+5cm / 좁은=아래+5cm)
//  · 몸판 "화면 중앙" = geometry 를 옮기지 않고 **카메라(viewX/viewY)** 를 몸판 중심으로.
//
// 계약:
//  - sourceBlock/baseSource/referenceGeometry/working.geometry(좌표) 불변.
//  - 저장·autosave 연결 0. reload 시 working(=layout) 소멸 → 기본 배치 복귀.
//  - 줌·팬 이후에도 layout 값 불변(카메라와 배치는 독립).
//  - 순수 함수(bboxOf/autoSleeveOffset)는 DOM/view 미접근 → 하네스로 검증.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const NARROW_MAX = 615;      // css 모바일 브레이크포인트와 동일
  const SLEEVE_GAP = 5;        // 몸판과 소매 간격(cm)
  const BODY_PIECES = ["front", "back", "shared"];

  function defaultLayout() {
    return { body: { dx: 0, dy: 0 }, sleeve: { dx: 0, dy: 0 }, sleevePlacement: "auto" };
  }

  // working.layout 이 없으면 기본값을 붙여 반환(render 가 방어적으로 호출).
  function ensureLayout(project) {
    if (!project || !project.working) return defaultLayout();
    if (!project.working.layout) project.working.layout = defaultLayout();
    const L = project.working.layout;
    if (!L.body) L.body = { dx: 0, dy: 0 };
    if (!L.sleeve) L.sleeve = { dx: 0, dy: 0 };
    if (typeof L.sleevePlacement !== "string") L.sleevePlacement = "auto";
    return L;
  }

  // ── 순수 기하: piece bbox(도안 cm) ──
  function pointsOfPrim(p, out) {
    if (p.kind === "line") { out.push(p.from, p.to); return; }
    p.commands.forEach(c => c.points.forEach(q => out.push(q)));
  }
  function bboxOf(geometry, which) {
    if (!geometry) return null;
    const pieces = which === "sleeve" ? ["sleeve"] : BODY_PIECES;
    const pts = [];
    pieces.forEach(pc => {
      const b = geometry[pc]; if (!b) return;
      ["outline", "construction"].forEach(rl => (b[rl] || []).forEach(p => pointsOfPrim(p, pts)));
    });
    if (pts.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(q => {
      if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
      if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
    });
    return { minX, minY, maxX, maxY };
  }

  // ── 순수: 소매 auto offset(cm). 넓으면 몸판 오른쪽, 좁으면 몸판 아래로 +GAP ──
  function autoSleeveOffset(geometry, narrow) {
    const b = bboxOf(geometry, "body"), s = bboxOf(geometry, "sleeve");
    if (!b || !s) return { dx: 0, dy: 0 };
    return narrow
      ? { dx: 0, dy: (b.maxY + SLEEVE_GAP) - s.minY }   // 몸판 아래 끝 + GAP
      : { dx: (b.maxX + SLEEVE_GAP) - s.minX, dy: 0 };  // 몸판 오른쪽 끝 + GAP
  }

  // ── DOM/view 연동 ──
  function isNarrow() {
    return (document.documentElement.clientWidth || window.innerWidth || 0) <= NARROW_MAX;
  }
  function currentProject() {
    return (window.designWorkflow && window.designWorkflow.current()) || null;
  }
  function inDesign() {
    return typeof window.isDesignStageActive === "function" && window.isDesignStageActive() && !!currentProject();
  }

  // sleevePlacement==="auto" 이면 현재 body bbox 기준으로 소매 offset 재계산(no render).
  function refreshAutoSleeve() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    if (L.sleevePlacement !== "auto") return;   // 사용자가 옮긴 뒤엔 자동 이동 안 함
    L.sleeve = autoSleeveOffset(p.working.geometry, isNarrow());
  }

  // 카메라를 몸판 bbox 중심으로(형상·layout 불변, viewX/viewY 만 조정). no render.
  function centerCameraOnBody() {
    const p = currentProject(); if (!p) return;
    const bb = bboxOf(p.working.geometry, "body"); if (!bb) return;
    const L = ensureLayout(p);
    const cx = (bb.minX + bb.maxX) / 2 + L.body.dx;
    const cy = (bb.minY + bb.maxY) / 2 + L.body.dy;
    const W = svg.clientWidth || 900, H = svg.clientHeight || 700;
    // c2p(cx,cy) === (W/2,H/2) 가 되도록 viewX/viewY 설정.
    view.x = W / 2 - MX - cx * SC * viewZ;
    view.y = H / 2 - MY - cy * SC * viewZ;
    syncViewVars();
  }

  // ── 공개 액션(각자 render 로 마무리) ──
  function enterDesign() {            // design 최초/재진입: 소매 auto + 카메라 중앙
    refreshAutoSleeve();
    centerCameraOnBody();
    if (typeof render === "function") render();
  }
  function centerBody() {            // "몸판 중앙": 카메라만
    centerCameraOnBody();
    if (typeof render === "function") render();
  }
  function placeSleeveRight() {      // "소매 오른쪽": 현재 body 기준 오른쪽 +GAP(auto 복귀)
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    L.sleevePlacement = "auto";
    L.sleeve = autoSleeveOffset(p.working.geometry, isNarrow());
    if (typeof render === "function") render();
  }
  function resetLayout() {           // "배치 초기화": body 0,0 → 소매 재배치 → 기본 zoom → 중앙
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    L.body = { dx: 0, dy: 0 };
    L.sleevePlacement = "auto";
    L.sleeve = autoSleeveOffset(p.working.geometry, isNarrow());
    Object.assign(view, { SC: 11, MX: 80, MY: 100, z: 1 });
    syncViewVars();
    centerCameraOnBody();
    if (typeof render === "function") render();
  }
  function resetViewForDesign() {    // 화면 초기화(design): 기본 zoom + 몸판 재중앙(배치 유지)
    Object.assign(view, { SC: 11, MX: 80, MY: 100, z: 1 });
    syncViewVars();
    centerCameraOnBody();
    if (typeof render === "function") render();
  }

  // ── 드래그: 투명 hit rect(pointer-events:all)만 잡는다. Space+drag 는 pan 우선 ──
  let drag = null, spaceHeld = false;
  function initDrag() {
    document.addEventListener("keydown", e => { if (e.code === "Space") spaceHeld = true; });
    document.addEventListener("keyup", e => { if (e.code === "Space") spaceHeld = false; });
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0 || spaceHeld || !inDesign()) return;
      const hit = e.target && e.target.closest && e.target.closest(".design-layout-hit");
      if (!hit) return;
      const piece = hit.getAttribute("data-layout-piece");
      const p = currentProject(); if (!p || (piece !== "body" && piece !== "sleeve")) return;
      const L = ensureLayout(p);
      drag = { piece, x: e.clientX, y: e.clientY, dx0: L[piece].dx, dy0: L[piece].dy };
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      e.stopPropagation();
    });
    svg.addEventListener("pointermove", e => {
      if (!drag) return;
      const p = currentProject(); if (!p) { drag = null; return; }
      const scale = SC * viewZ; if (!(scale > 0)) return;
      const L = ensureLayout(p);
      L[drag.piece].dx = drag.dx0 + (e.clientX - drag.x) / scale;   // px → cm
      L[drag.piece].dy = drag.dy0 + (e.clientY - drag.y) / scale;
      if (drag.piece === "sleeve") L.sleevePlacement = "manual";    // 이후 auto 이동 금지
      if (typeof render === "function") render();
    });
    const end = () => { drag = null; };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }

  if (typeof svg !== "undefined" && svg) initDrag();

  window.designLayout = Object.freeze({
    ensureLayout, bboxOf, autoSleeveOffset,
    enterDesign, centerBody, placeSleeveRight, resetLayout,
    refreshAutoSleeve, resetViewForDesign
  });
})();
