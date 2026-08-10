// ══════════════════════════════════════════════
// js/designLayout.js — Design 화면의 "작업 배치"(piece layout)만 담당.
//
// 형상(geometry)은 절대 움직이지 않는다. **앞판/뒤판/소매** 각각의 표시 offset(cm)을
// project.working.layout.{front,back,sleeve} 에 두고, render 가 SVG transform 으로만 적용한다.
// reference 와 working 에 같은 offset 을 적용해 회색/남색이 항상 함께 이동한다.
//
// 배치 규칙:
//  · 초기 배치 = 앞판 → 뒤판 → 소매 순 **가로**, 피스 사이 **실제 봉제선(outline) 간격 10cm**,
//    세 피스 **세로 중심**을 앞판 세로 중심에 맞춘다(옆으로 나란히).
//  · 앞판/뒤판/소매를 각각 드래그하면 그 피스만 "manual" → 이후 자동 배치에서 안 움직인다.
//  · shared(허리다트 c 다리)는 **앞판 offset 을 따른다**(앞·뒤가 벌어져도 붙일 곳은 하나).
//  · fit = 세 피스 union 중심을 viewport 중심에 두는 카메라(형상·layout 불변).
//
// 계약:
//  - sourceBlock/baseSource/referenceGeometry/working.geometry(좌표) 불변.
//  - 저장·autosave 연결 0. reload 시 working(=layout) 소멸 → 기본 배치 복귀.
//  - 순수 함수(bboxOf/outlineBBoxOf/autoLayout)는 DOM/view 미접근 → 하네스로 검증.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const GAP = 10;              // 피스 사이 실제 봉제선(outline) 간격(도안 cm)
  const FIT_MARGIN = 24;       // fit 안전 여백(px)
  const DESIGN_MIN_Z = 0.1;    // design 자동 fit 최소 zoom(휠·핀치 하한과 동일)
  const PIECES = ["front", "back", "sleeve"];
  // 각 배치 피스가 포함하는 geometry 키. shared 는 앞판을 따른다.
  const PIECE_KEYS = {
    front: ["front", "shared"],
    back: ["back"],
    sleeve: ["sleeve"],
    body: ["front", "back", "shared"]   // 하위호환(앞+뒤 묶음)
  };

  // ── 순수 기하 ──
  function pointsOfPrim(p, out) {
    if (p.kind === "line") { out.push(p.from, p.to); return; }
    p.commands.forEach(c => c.points.forEach(q => out.push(q)));
  }
  function bboxFromKeys(geometry, keys, roles) {
    const pts = [];
    keys.forEach(pc => {
      const b = geometry[pc]; if (!b) return;
      roles.forEach(rl => (b[rl] || []).forEach(p => pointsOfPrim(p, pts)));
    });
    if (pts.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(q => { if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y; });
    return { minX, minY, maxX, maxY };
  }
  // outline+construction bbox(fit·hit rect 용).
  function bboxOf(geometry, which) {
    if (!geometry) return null;
    return bboxFromKeys(geometry, PIECE_KEYS[which] || PIECE_KEYS.body, ["outline", "construction"]);
  }
  // outline 만 bbox(피스 사이 실제 봉제선 간격·세로 중심 계산용).
  function outlineBBoxOf(geometry, which) {
    if (!geometry) return null;
    return bboxFromKeys(geometry, PIECE_KEYS[which] || PIECE_KEYS.body, ["outline"]);
  }

  // ── 순수: 앞판 → 뒤판 → 소매 가로 배치 offset. 실제 봉제선 간격 GAP, 세로중심은 앞판 기준. ──
  function autoLayout(geometry) {
    const f = outlineBBoxOf(geometry, "front");
    const b = outlineBBoxOf(geometry, "back");
    const s = outlineBBoxOf(geometry, "sleeve");
    if (!f) return null;
    const fcy = (f.minY + f.maxY) / 2;
    const front = { dx: 0, dy: 0 };                                  // 앵커(자연 위치)
    const back = b ? { dx: (f.maxX + GAP) - b.minX, dy: fcy - (b.minY + b.maxY) / 2 } : { dx: 0, dy: 0 };
    const backMaxXDisp = b ? (b.maxX + back.dx) : f.maxX;
    const sleeve = s ? { dx: (backMaxXDisp + GAP) - s.minX, dy: fcy - (s.minY + s.maxY) / 2 } : { dx: 0, dy: 0 };
    return { front, back, sleeve };
  }

  // ── layout 기본값·정규화(구형 {body,sleeve,sleevePlacement} 마이그레이션 포함) ──
  function defaultLayout() {
    return {
      front: { dx: 0, dy: 0 }, back: { dx: 0, dy: 0 }, sleeve: { dx: 0, dy: 0 },
      placement: { front: "auto", back: "auto", sleeve: "auto" }
    };
  }
  function ensureLayout(project) {
    if (!project || !project.working) return defaultLayout();
    let L = project.working.layout;
    if (!L) { L = project.working.layout = defaultLayout(); return L; }
    if (L.body && !L.front) L.front = L.body;                        // 구형 body → 앞판 앵커
    PIECES.forEach(k => { if (!L[k] || typeof L[k].dx !== "number") L[k] = { dx: 0, dy: 0 }; });
    if (!L.placement || typeof L.placement !== "object") {
      const slv = (typeof L.sleevePlacement === "string") ? L.sleevePlacement : "auto";
      L.placement = { front: "auto", back: "auto", sleeve: slv };
    } else {
      PIECES.forEach(k => { if (typeof L.placement[k] !== "string") L.placement[k] = "auto"; });
    }
    return L;
  }

  // ── DOM/view 연동 ──
  function currentProject() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function inDesign() { return typeof window.isDesignStageActive === "function" && window.isDesignStageActive() && !!currentProject(); }

  function offBBox(bb, off) {
    return bb ? { minX: bb.minX + off.dx, minY: bb.minY + off.dy, maxX: bb.maxX + off.dx, maxY: bb.maxY + off.dy } : null;
  }
  function unionOf(geometry, L, keys) {
    let u = null;
    keys.forEach(k => {
      const bb = offBBox(bboxOf(geometry, k), L[k]); if (!bb) return;
      if (!u) u = { minX: bb.minX, minY: bb.minY, maxX: bb.maxX, maxY: bb.maxY };
      else { if (bb.minX < u.minX) u.minX = bb.minX; if (bb.minY < u.minY) u.minY = bb.minY; if (bb.maxX > u.maxX) u.maxX = bb.maxX; if (bb.maxY > u.maxY) u.maxY = bb.maxY; }
    });
    return u;
  }
  function viewportWH() {
    const r = svg.getBoundingClientRect();
    return { W: r.width || svg.clientWidth || 900, H: r.height || svg.clientHeight || 700 };
  }

  // placement==="auto" 인 피스만 autoLayout 결과로 갱신(manual 은 유지). no render.
  function refreshAutoLayout() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    const auto = autoLayout(p.working.geometry); if (!auto) return;
    PIECES.forEach(k => { if (L.placement[k] === "auto") L[k] = { dx: auto[k].dx, dy: auto[k].dy }; });
  }

  // 세 피스 union 중심을 viewport 중심에 두는 카메라 fit(형상·layout 불변). no render.
  function fitUnion() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    const u = unionOf(p.working.geometry, L, PIECES); if (!u) return;
    const uCx = (u.minX + u.maxX) / 2, uCy = (u.minY + u.maxY) / 2;
    const halfW = (u.maxX - u.minX) / 2, halfH = (u.maxY - u.minY) / 2;
    const { W, H } = viewportWH();
    const hz = (halfW * SC > 0) ? (W / 2 - FIT_MARGIN) / (halfW * SC) : Infinity;
    const vz = (halfH * SC > 0) ? (H / 2 - FIT_MARGIN) / (halfH * SC) : Infinity;
    let z = Math.min(hz, vz, 1); if (!(z > 0)) z = 1; z = Math.max(z, DESIGN_MIN_Z);
    view.z = z; view.x = W / 2 - MX - uCx * SC * z; view.y = H / 2 - MY - uCy * SC * z;
    syncViewVars();
  }

  // 카메라를 앞판+뒤판 union 중심으로(형상·layout 불변). no render.
  function centerCameraOnBody() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    const u = unionOf(p.working.geometry, L, ["front", "back"]); if (!u) return;
    const cx = (u.minX + u.maxX) / 2, cy = (u.minY + u.maxY) / 2;
    const { W, H } = viewportWH();
    view.x = W / 2 - MX - cx * SC * viewZ; view.y = H / 2 - MY - cy * SC * viewZ;
    syncViewVars();
  }

  // ── 공개 액션(각자 render 로 마무리) ──
  function enterDesign() {            // design 최초/재진입: auto 피스 배치 + union fit
    _userArranged = false;
    refreshAutoLayout(); fitUnion();
    if (typeof render === "function") render();
  }
  function centerBody() {            // "몸판 중앙": 현재 zoom 유지, 카메라만 앞+뒤 중심으로
    _userArranged = false;
    centerCameraOnBody();
    if (typeof render === "function") render();
  }
  function placeSleeveRight() {      // "소매 오른쪽": 소매를 auto 로 되돌려 뒤판 오른쪽 재배치 + fit
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    _userArranged = false;
    L.placement.sleeve = "auto";
    refreshAutoLayout(); fitUnion();
    if (typeof render === "function") render();
  }
  function resetLayout() {           // "배치 초기화": 세 피스 전부 auto 재배치 + 기준 축척 + fit
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    _userArranged = false;
    L.placement = { front: "auto", back: "auto", sleeve: "auto" };
    refreshAutoLayout();
    Object.assign(view, { SC: 11, MX: 80, MY: 100 });
    syncViewVars(); fitUnion();
    if (typeof render === "function") render();
  }
  function resetViewForDesign() {    // 화면 초기화(design): 기준 축척 + union fit(배치 offset 유지)
    _userArranged = false;
    Object.assign(view, { SC: 11, MX: 80, MY: 100 });
    syncViewVars(); fitUnion();
    if (typeof render === "function") render();
  }
  // 엉덩이 길이 적용 직후(ui.js 호출, render 는 호출부): auto 피스만 재배치+fit, manual 유지.
  function afterBodyLength() {
    const p = currentProject(); if (!p) return;
    refreshAutoLayout(); fitUnion();
  }

  // ── 드래그: 앞판/뒤판/소매 각각 투명 hit rect 만 잡는다. Space+drag 는 pan 우선 ──
  let drag = null, spaceHeld = false, _userArranged = false, _resizeRaf = null;
  function initDrag() {
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
      // 패턴선 도구 활성 중엔 드래그 대신 선 그리기 → 드래그 건너뜀(designLineTool 이 처리).
      if (window.designLineTool && window.designLineTool.isActive()) return;
      const hit = e.target && e.target.closest && e.target.closest(".design-layout-hit");
      if (!hit) return;
      const piece = hit.getAttribute("data-layout-piece");
      const p = currentProject(); if (!p || PIECES.indexOf(piece) < 0) return;
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
      L.placement[drag.piece] = "manual";                          // 이후 auto 이동 금지
      _userArranged = true;                                        // 리사이즈 자동 재중앙 금지
      if (typeof render === "function") render();
    });
    const end = () => { drag = null; };
    svg.addEventListener("pointerup", end);
    svg.addEventListener("pointercancel", end);
  }

  if (typeof svg !== "undefined" && svg) initDrag();

  window.designLayout = Object.freeze({
    // 순수(harness)
    bboxOf, outlineBBoxOf, autoLayout, ensureLayout,
    // DOM 연동
    enterDesign, centerBody, placeSleeveRight, resetLayout, refreshAutoLayout, afterBodyLength, resetViewForDesign
  });
})();
