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
  const COLLAR_MIN_FIT_Z = 0.32; // 카라를 소매 오른쪽에 뒀을 때 union fit zoom 이 이보다 작으면 아래 행으로 reflow
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
    if (p.kind === "cubic") { out.push(p.from, p.c1, p.c2, p.to); return; }   // 카라 원호(cubic) bbox
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
  // ── 카라(collarDraft.standGeometry): working.geometry 밖 별도 조각이라 전용 bbox·배치 ──
  function bboxOfStand(standGeometry) {
    if (!standGeometry) return null;
    const pts = [];
    ["outline", "construction"].forEach(rl => (standGeometry[rl] || []).forEach(p => pointsOfPrim(p, pts)));
    if (pts.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(q => { if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x; if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y; });
    return { minX, minY, maxX, maxY };
  }
  // 카라 auto offset(순수). "right" = 소매(bs) 오른쪽 GAP·세로중심 정렬 / "below" = bs 아래 GAP·가로중심 정렬.
  function collarAutoOffset(bs, cbb, place) {
    if (!bs || !cbb) return { dx: 0, dy: 0 };
    if (place === "below") return { dx: (bs.minX + bs.maxX) / 2 - (cbb.minX + cbb.maxX) / 2, dy: (bs.maxY + GAP) - cbb.minY };
    return { dx: (bs.maxX + GAP) - cbb.minX, dy: (bs.minY + bs.maxY) / 2 - (cbb.minY + cbb.maxY) / 2 };
  }
  function collarStandGeom(project) {
    const cd = project && project.working && project.working.collarDraft;
    return (cd && cd.standGeometry && Array.isArray(cd.standGeometry.outline) && cd.standGeometry.outline.length) ? cd.standGeometry : null;
  }
  // 카라 조각 로컬 bbox = 스탠드 ∪ 본체(C2). 배치·fit 이 본체까지 포함하도록.
  function collarLocalBBox(project) {
    const cd = project && project.working && project.working.collarDraft; if (!cd) return null;
    let u = collarStandGeom(project) ? bboxOfStand(collarStandGeom(project)) : null;
    const bodyG = cd.body && cd.body.geometry && Array.isArray(cd.body.geometry.outline) && cd.body.geometry.outline.length ? cd.body.geometry : null;
    if (bodyG) { const bb = bboxOfStand(bodyG); u = u ? { minX: Math.min(u.minX, bb.minX), minY: Math.min(u.minY, bb.minY), maxX: Math.max(u.maxX, bb.maxX), maxY: Math.max(u.maxY, bb.maxY) } : bb; }
    return u;
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
      front: { dx: 0, dy: 0 }, back: { dx: 0, dy: 0 }, sleeve: { dx: 0, dy: 0 }, collar: { dx: 0, dy: 0 },
      placement: { front: "auto", back: "auto", sleeve: "auto", collar: "auto" }
    };
  }
  function ensureLayout(project) {
    if (!project || !project.working) return defaultLayout();
    let L = project.working.layout;
    if (!L) { L = project.working.layout = defaultLayout(); return L; }
    if (L.body && !L.front) L.front = L.body;                        // 구형 body → 앞판 앵커
    PIECES.forEach(k => { if (!L[k] || typeof L[k].dx !== "number") L[k] = { dx: 0, dy: 0 }; });
    if (!L.collar || typeof L.collar.dx !== "number") L.collar = { dx: 0, dy: 0 };   // 카라(별도 조각)
    if (!L.placement || typeof L.placement !== "object") {
      const slv = (typeof L.sleevePlacement === "string") ? L.sleevePlacement : "auto";
      L.placement = { front: "auto", back: "auto", sleeve: slv, collar: "auto" };
    } else {
      PIECES.forEach(k => { if (typeof L.placement[k] !== "string") L.placement[k] = "auto"; });
      if (typeof L.placement.collar !== "string") L.placement.collar = "auto";
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
  function unionBB(a, b) {
    if (!a) return b; if (!b) return a;
    return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) };
  }
  // 앞판+뒤판+소매 표시 outline union(카라 배치의 기준 = 소매 오른쪽 GAP).
  function bsOutlineUnion(geometry, L) {
    let u = null;
    PIECES.forEach(k => { u = unionBB(u, offBBox(outlineBBoxOf(geometry, k), L[k])); });
    return u;
  }
  // 표시된 카라 bbox(offset 반영, 스탠드∪본체). 카라 geometry 없으면 null.
  function collarDispBBox(p, L) {
    const cbb = collarLocalBBox(p); if (!cbb) return null;
    return offBBox(cbb, L.collar || { dx: 0, dy: 0 });
  }
  // union bbox → fit zoom(fitUnion 과 동일 공식). reflow 판정·fit 공용.
  function fitZoomForUnion(u) {
    if (!u) return 1;
    const halfW = (u.maxX - u.minX) / 2, halfH = (u.maxY - u.minY) / 2, wh = viewportWH();
    const hz = (halfW * SC > 0) ? (wh.W / 2 - FIT_MARGIN) / (halfW * SC) : Infinity;
    const vz = (halfH * SC > 0) ? (wh.H / 2 - FIT_MARGIN) / (halfH * SC) : Infinity;
    let z = Math.min(hz, vz, 1); if (!(z > 0)) z = 1; return Math.max(z, DESIGN_MIN_Z);
  }

  // placement==="auto" 인 피스만 autoLayout 결과로 갱신(manual 은 유지). no render.
  function refreshAutoLayout() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    const auto = autoLayout(p.working.geometry); if (!auto) return;
    PIECES.forEach(k => { if (L.placement[k] === "auto") L[k] = { dx: auto[k].dx, dy: auto[k].dy }; });
    // 카라(별도 조각, 스탠드∪본체): 우선 소매 오른쪽 GAP. 그 배치로 union fit 이 작아지면 아래 행 reflow.
    const cbb = collarLocalBBox(p);
    if (cbb && L.placement.collar === "auto") {
      const bs = bsOutlineUnion(p.working.geometry, L);
      if (bs && cbb) {
        let off = collarAutoOffset(bs, cbb, "right");
        const dispRight = { minX: cbb.minX + off.dx, minY: cbb.minY + off.dy, maxX: cbb.maxX + off.dx, maxY: cbb.maxY + off.dy };
        if (fitZoomForUnion(unionBB(bs, dispRight)) < COLLAR_MIN_FIT_Z) off = collarAutoOffset(bs, cbb, "below");
        L.collar = off;
      }
    }
  }

  // 세 피스 + 카라 union 중심을 viewport 중심에 두는 카메라 fit(형상·layout 불변). no render.
  function fitUnion() {
    const p = currentProject(); if (!p) return;
    const L = ensureLayout(p);
    const u = unionBB(unionOf(p.working.geometry, L, PIECES), collarDispBBox(p, L)); if (!u) return;
    const uCx = (u.minX + u.maxX) / 2, uCy = (u.minY + u.maxY) / 2;
    const { W, H } = viewportWH();
    const z = fitZoomForUnion(u);
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
  // 카라 적용/제거 직후(ui.js 호출, render 는 호출부): 카라 auto 배치(소매 오른쪽/reflow) + fit.
  function afterCollar() {
    const p = currentProject(); if (!p) return;
    refreshAutoLayout(); fitUnion();
  }

  // ── 드래그: 앞판/뒤판/소매 각각 투명 hit rect 만 잡는다. Space+drag 는 pan 우선 ──
  let drag = null, spaceHeld = false, _userArranged = false, _resizeRaf = null;
  // 도구 우선순위 게이트: 배치 드래그는 **선 도구가 off 일 때만** 허용한다.
  //   designLineTool.mode==="draw"  → 선 그리기만 / "select" → 선·anchor·handle 편집만 / "off" → 배치 드래그.
  // 이벤트 등록 순서나 CSS pointer-events 에 의존하지 않는 강한 게이트(선 그리기까지 막지 않음).
  function layoutDragAllowed() {
    return !window.designLineTool || window.designLineTool.getMode() === "off";
  }
  // 진행 중인 배치 드래그 취소: 좌표 변경 없이 상태·pointer capture 만 정리(모드 전환 시 호출).
  function cancelLayoutDrag() {
    if (!drag) return;
    try { if (drag.pointerId != null && svg.releasePointerCapture) svg.releasePointerCapture(drag.pointerId); } catch (_) {}
    drag = null;
  }
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
      if (!layoutDragAllowed()) return;   // ★ 선 도구가 off 일 때만 배치 드래그 시작(강한 게이트)
      const hit = e.target && e.target.closest && e.target.closest(".design-layout-hit");
      if (!hit) return;
      const piece = hit.getAttribute("data-layout-piece");
      const p = currentProject(); if (!p || PIECES.indexOf(piece) < 0) return;
      const L = ensureLayout(p);
      drag = { piece, pointerId: e.pointerId, x: e.clientX, y: e.clientY, dx0: L[piece].dx, dy0: L[piece].dy };
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      e.stopPropagation();
    });
    svg.addEventListener("pointermove", e => {
      if (!drag) return;
      if (!layoutDragAllowed()) { cancelLayoutDrag(); return; }   // 드래그 중 도구가 켜지면 즉시 취소(layout 불변)
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
    bboxOf, outlineBBoxOf, autoLayout, ensureLayout, bboxOfStand, collarAutoOffset,
    // DOM 연동
    enterDesign, centerBody, placeSleeveRight, resetLayout, refreshAutoLayout, afterBodyLength, afterCollar, resetViewForDesign,
    cancelLayoutDrag   // 모드 전환 시 진행 중 배치 드래그 취소(designLineTool.setMode 에서 호출)
  });
})();
