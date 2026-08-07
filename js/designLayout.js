// ══════════════════════════════════════════════
// js/designLayout.js — Design 화면의 "작업 배치"(piece layout)만 담당.
//
// 형상(geometry)은 절대 움직이지 않는다. 몸판/소매의 **표시 offset(cm)** 을
// project.working.layout 에 두고, render 가 그 offset 을 SVG transform 으로만 적용한다.
// reference 와 working 에 같은 offset 을 적용해 회색/남색 원형이 항상 함께 이동한다.
//
// 배치 ≠ 카메라:
//  · 소매 offset  = 화면 폭과 무관하게 항상 몸판 오른쪽 끝 + 10cm(도안 cm)
//  · 진입/리사이즈/초기화 = 몸판+소매를 한 묶음으로 보고 **union bbox 중심**을 viewport
//    중심에 두는 union fit(카메라만). "몸판 중앙" 버튼만 몸판 중심으로(현재 zoom 유지).
//
// 계약:
//  - sourceBlock/baseSource/referenceGeometry/working.geometry(좌표) 불변.
//  - 저장·autosave 연결 0. reload 시 working(=layout) 소멸 → 기본 배치 복귀.
//  - 줌·팬 이후에도 layout 값 불변(카메라와 배치는 독립).
//  - 순수 함수(bboxOf/autoSleeveOffset)는 DOM/view 미접근 → 하네스로 검증.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const SLEEVE_GAP = 10;       // 몸판 오른쪽 끝과 소매 사이 간격(도안 cm)
  const BODY_PIECES = ["front", "back", "shared"];
  const FIT_MARGIN = 24;       // fit 안전 여백(px)
  const DESIGN_MIN_Z = 0.1;    // design 자동 fit 최소 zoom. design 전용 휠·핀치 하한과 동일
                               // (init.js: design 0.1 / draft 0.2) → auto-fit 저zoom 에서
                               // 첫 수동 조작이 0.2 로 튀지 않고 연속 확대/0.1 까지 축소된다.

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

  // ── 순수: 소매 auto offset(cm). 가로는 항상 몸판 오른쪽 끝 + GAP, 세로는 몸판과
  //    세로 중심을 맞춘다(원형 화면과 동일 기준 — 대각선 아래가 아니라 옆으로 나란히) ──
  function autoSleeveOffset(geometry) {
    const b = bboxOf(geometry, "body"), s = bboxOf(geometry, "sleeve");
    if (!b || !s) return { dx: 0, dy: 0 };
    const bodyCenterY = (b.minY + b.maxY) / 2, sleeveCenterY = (s.minY + s.maxY) / 2;
    return {
      dx: (b.maxX + SLEEVE_GAP) - s.minX,   // 몸판 오른쪽 끝 + GAP
      dy: bodyCenterY - sleeveCenterY        // 몸판과 소매 세로 중심 일치
    };
  }

  // ── DOM/view 연동 ──
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
    L.sleeve = autoSleeveOffset(p.working.geometry);
  }

  // bbox 에 offset 적용(화면상 위치).
  function offBBox(bb, off) {
    return bb ? { minX: bb.minX + off.dx, minY: bb.minY + off.dy, maxX: bb.maxX + off.dx, maxY: bb.maxY + off.dy } : null;
  }

  // union fit(no render): 몸판+소매를 **한 묶음**으로 보고, union bbox 중심을 viewport 중심에
  // 두면서 union 전체가 24px 여백 안에 들어오도록 zoom 을 자동 계산한다(반경 = union 절반).
  // geometry·layout 좌표 불변, 카메라(viewX/viewY/viewZ)만 조정.
  function fitUnion() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    const b = offBBox(bboxOf(p.working.geometry, "body"), L.body); if (!b) return;
    const s = offBBox(bboxOf(p.working.geometry, "sleeve"), L.sleeve);
    let uMinX = b.minX, uMinY = b.minY, uMaxX = b.maxX, uMaxY = b.maxY;
    if (s) { uMinX = Math.min(uMinX, s.minX); uMinY = Math.min(uMinY, s.minY); uMaxX = Math.max(uMaxX, s.maxX); uMaxY = Math.max(uMaxY, s.maxY); }
    const uCx = (uMinX + uMaxX) / 2, uCy = (uMinY + uMaxY) / 2;   // union 중심
    const halfW = (uMaxX - uMinX) / 2, halfH = (uMaxY - uMinY) / 2;
    const W = svg.clientWidth || 900, H = svg.clientHeight || 700;
    const hz = (halfW * SC > 0) ? (W / 2 - FIT_MARGIN) / (halfW * SC) : Infinity;
    const vz = (halfH * SC > 0) ? (H / 2 - FIT_MARGIN) / (halfH * SC) : Infinity;
    let fitZ = Math.min(hz, vz, 1);                        // 1 이상으로 확대하지 않음
    if (!(fitZ > 0)) fitZ = 1;
    fitZ = Math.max(fitZ, DESIGN_MIN_Z);                  // design 자동 fit 하한 0.1
    view.z = fitZ;
    // union 중심 → viewport 중심
    view.x = W / 2 - MX - uCx * SC * fitZ;
    view.y = H / 2 - MY - uCy * SC * fitZ;
    syncViewVars();
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
  function enterDesign() {            // design 최초/재진입: 소매 auto(오른쪽 10cm) + union fit
    _userArranged = false;
    refreshAutoSleeve();
    fitUnion();
    if (typeof render === "function") render();
  }
  function centerBody() {            // "몸판 중앙": 현재 zoom 유지, 카메라만 몸판 중심으로
    _userArranged = false;
    centerCameraOnBody();
    if (typeof render === "function") render();
  }
  function placeSleeveRight() {      // "소매 오른쪽": 현재 body 기준 재배치(auto 복귀) + 다시 fit
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    _userArranged = false;
    L.sleevePlacement = "auto";
    L.sleeve = autoSleeveOffset(p.working.geometry);
    fitUnion();
    if (typeof render === "function") render();
  }
  function resetLayout() {           // "배치 초기화": body 0,0 → 소매 재배치 → 기본 SC → fit(결정론)
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    _userArranged = false;
    L.body = { dx: 0, dy: 0 };
    L.sleevePlacement = "auto";
    L.sleeve = autoSleeveOffset(p.working.geometry);
    Object.assign(view, { SC: 11, MX: 80, MY: 100 });   // 기준 축척 복원(z 는 fit 이 정함)
    syncViewVars();
    fitUnion();
    if (typeof render === "function") render();
  }
  function resetViewForDesign() {    // 화면 초기화(design): 기준 축척 + union fit(배치 offset 유지)
    _userArranged = false;
    Object.assign(view, { SC: 11, MX: 80, MY: 100 });
    syncViewVars();
    fitUnion();
    if (typeof render === "function") render();
  }
  // 엉덩이 길이 적용 직후(ui.js 호출, render 는 호출부): auto 면 소매 재배치+fit, manual 이면
  // 카메라·offset 유지(자동 이동/재fit 안 함).
  function afterBodyLength() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    if (L.sleevePlacement !== "auto") return;   // manual: 유지
    refreshAutoSleeve();
    fitUnion();
  }

  // ── 드래그: 투명 hit rect(pointer-events:all)만 잡는다. Space+drag 는 pan 우선 ──
  // _userArranged: 사용자가 조각을 드래그하면 true → 이후 리사이즈에서 자동 재중앙 금지.
  // 자동/버튼 배치(enterDesign·centerBody·placeSleeveRight·resetLayout·resetViewForDesign)는
  // false 로 되돌려 창 크기 변경 시 다시 fit 되게 한다.
  let drag = null, spaceHeld = false, _userArranged = false, _resizeRaf = null;
  function initDrag() {
    // 창 크기·리플로우(가시 캔버스 폭 변화, 데스크톱↔모바일 inspector 이동 포함) 시 카메라만
    // 다시 fit 한다 — 형상·layout 좌표는 안 건드린다. 사용자가 드래그로 배치한 뒤엔 금지.
    window.addEventListener("resize", () => {
      if (_resizeRaf) return;
      _resizeRaf = requestAnimationFrame(() => {
        _resizeRaf = null;
        if (!inDesign() || _userArranged) return;
        fitUnion();
        if (typeof render === "function") render();
      });
    });
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
      _userArranged = true;                                         // 리사이즈 자동 재중앙 금지
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
    refreshAutoSleeve, afterBodyLength, resetViewForDesign
  });
})();
