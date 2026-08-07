// ══════════════════════════════════════════════
// js/draftLayout.js — 원형(draft) 작업 화면의 배치(소매 offset) + 카메라(union-fit).
//
// 형상(geometry)·저장 데이터는 절대 건드리지 않는다.
//  · 소매 offset: 몸판 **봉제선 outline** 오른쪽 끝 + 10cm 가 되도록 실측으로 계산해
//    window.draftSleeveLayout 에 넣는다(sleeve.js 가 그 값을 transform 으로만 적용).
//    ★ 구성 사각형(sx_B)이 아니라 실제 outline 을 기준으로 해야 봉제선 간격이 정확히
//    10cm 가 된다(sx_B 기준이면 14cm 로 어긋난다 — 실측 확인).
//  · 카메라: 몸판+소매 **봉제선 outline** union 중심을 viewport 중심에 두고 전체가
//    24px 여백 안에 들어오게 zoom 자동 계산(라벨·보조선·핸들·격자 제외 → 중심오차 ≤1px).
//
// 측정 대상 = data-geometry-role="outline" 요소만(라벨·보조선(construction)·핸들·격자 제외).
// 재중앙 트리거 = ResizeObserver(#cv). rAF 에 의존하지 않아 hidden→visible/레이아웃 확정
// 시에도 반드시 다시 보정된다.
//
// 순수 함수(computeSleeveDx/computeFitCamera/unionOutlineBBox/sleeveStore·Display)는
// DOM/view 미접근 → test/harness/draftLayoutCheck.js 가 계약을 고정한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const GAP = 10;             // 몸판 봉제선 오른쪽 끝 ↔ 소매 봉제선 왼쪽 끝(도안 cm)
  const FIT_MARGIN = 24;      // fit 안전 여백(px)
  const DRAFT_MIN_Z = 0.2;    // draft 수동 줌 하한과 동일(init.js _minZoom)

  // ─────────────────────────────────────────────
  // 순수 함수 (DOM/전역 view 미접근) — harness 로 계약 고정
  // ─────────────────────────────────────────────

  // 소매 dx: (sleeveLocalMinX + dx) === bodyMaxX + gap 가 되게 한다(봉제선 간격 = gap).
  function computeSleeveDx(bodyMaxX, sleeveLocalMinX, gap) {
    return (bodyMaxX + gap) - sleeveLocalMinX;
  }

  // 소매 dy: 몸판과 세로 중심을 맞춘다(대각선 아래가 아니라 "옆으로 나란히").
  // 표시 후 소매 outline 세로 중심 === 몸판 outline 세로 중심.
  function computeSleeveDy(bodyBB, sleeveLocalBB) {
    return ((bodyBB.minY + bodyBB.maxY) / 2) - ((sleeveLocalBB.minY + sleeveLocalBB.maxY) / 2);
  }

  // union bbox(cm)와 viewport(px)·view 로 카메라 {z,x,y} 계산.
  // c2p(중심) === (W/2,H/2) 가 정확히 성립한다(중심오차 0, 부동소수 한계 내).
  function computeFitCamera(bb, W, H, view, minZ, margin) {
    const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
    const halfW = (bb.maxX - bb.minX) / 2, halfH = (bb.maxY - bb.minY) / 2;
    const SC = view.SC, MX = view.MX, MY = view.MY;
    const hz = (halfW * SC > 0) ? (W / 2 - margin) / (halfW * SC) : Infinity;
    const vz = (halfH * SC > 0) ? (H / 2 - margin) / (halfH * SC) : Infinity;
    let z = Math.min(hz, vz, 1);           // 1 이상으로 확대하지 않음
    if (!(z > 0)) z = 1;
    z = Math.max(z, minZ);                  // 줌 하한
    const x = W / 2 - MX - cx * SC * z;
    const y = H / 2 - MY - cy * SC * z;
    return { z, x, y };
  }

  // outline meta 목록의 union bbox. role!=="outline" 은 무시(라벨·보조선·핸들·격자 제외).
  // piece==="sleeve" 요소에만 off 를 적용한다(몸판은 offset 0). 입력 비변형.
  function unionOutlineBBox(metas, off) {
    let mnX = Infinity, mnY = Infinity, mxX = -Infinity, mxY = -Infinity, found = false;
    for (const m of metas) {
      if (m.role !== "outline") continue;
      const dx = m.piece === "sleeve" ? off.dx : 0;
      const dy = m.piece === "sleeve" ? off.dy : 0;
      found = true;
      if (m.minX + dx < mnX) mnX = m.minX + dx;
      if (m.maxX + dx > mxX) mxX = m.maxX + dx;
      if (m.minY + dy < mnY) mnY = m.minY + dy;
      if (m.maxY + dy > mxY) mxY = m.maxY + dy;
    }
    return found ? { minX: mnX, minY: mnY, maxX: mxX, maxY: mxY } : null;
  }

  // 소매 핸들 좌표 왕복(evtToSleeve 의 순수 모델): 저장 = 화면−offset, 표시 = 저장+offset.
  function sleeveStoreFromEvt(evtCm, off) { return { x: evtCm.x - off.dx, y: evtCm.y - off.dy }; }
  function sleeveDisplayFromStore(store, off) { return { x: store.x + off.dx, y: store.y + off.dy }; }

  // ─────────────────────────────────────────────
  // DOM/view 연동
  // ─────────────────────────────────────────────
  function inDraft() {
    return !(typeof window.isDesignStageActive === "function" && window.isDesignStageActive());
  }
  function currentOff() {
    const o = window.draftSleeveLayout;
    return (o && typeof o.dx === "number") ? o : { dx: 0, dy: 0 };
  }

  // 렌더된 봉제선 outline 을 몸판/소매(로컬, transform 前)로 나눠 cm bbox 로 반환.
  // getBBox 는 소매 그룹 transform 을 제외한 로컬 좌표라, 소매 offset 과 무관하게 안정적.
  function measureOutlineCm() {
    if (typeof svg === "undefined" || !svg) return { body: null, sleeveLocal: null };
    const outs = svg.querySelectorAll('[data-geometry-role="outline"]');
    let bMnX = Infinity, bMnY = Infinity, bMxX = -Infinity, bMxY = -Infinity, bFound = false;
    let sMnX = Infinity, sMnY = Infinity, sMxX = -Infinity, sMxY = -Infinity, sFound = false;
    outs.forEach(el => {
      let b; try { b = el.getBBox(); } catch (_) { return; }
      const [x0, y0] = p2c_(b.x, b.y);
      const [x1, y1] = p2c_(b.x + b.width, b.y + b.height);
      if (el.getAttribute("data-piece") === "sleeve") {
        sFound = true;
        if (x0 < sMnX) sMnX = x0; if (x1 > sMxX) sMxX = x1; if (y0 < sMnY) sMnY = y0; if (y1 > sMxY) sMxY = y1;
      } else {
        bFound = true;
        if (x0 < bMnX) bMnX = x0; if (x1 > bMxX) bMxX = x1; if (y0 < bMnY) bMnY = y0; if (y1 > bMxY) bMxY = y1;
      }
    });
    return {
      body: bFound ? { minX: bMnX, minY: bMnY, maxX: bMxX, maxY: bMxY } : null,
      sleeveLocal: sFound ? { minX: sMnX, minY: sMnY, maxX: sMxX, maxY: sMxY } : null
    };
  }

  // 실측 outline 으로 소매 offset 을 계산해 window.draftSleeveLayout 갱신.
  // 바뀌었으면 이미 그려진 소매 그룹 transform 만 in-place 보정(재렌더 없음)하고 true.
  // 몸판·소매 outline 중 하나라도 없으면(소매 숨김 등) 캐시 유지(false).
  function syncSleeveOffset() {
    const m = measureOutlineCm();
    if (!m.body || !m.sleeveLocal) return false;
    const dx = computeSleeveDx(m.body.maxX, m.sleeveLocal.minX, GAP);
    const dy = computeSleeveDy(m.body, m.sleeveLocal);   // 몸판과 세로 중심 정렬(옆으로 나란히)
    const cur = currentOff();
    if (Math.abs(cur.dx - dx) <= 1e-6 && Math.abs(cur.dy - dy) <= 1e-6) return false;
    window.draftSleeveLayout = { dx, dy };
    const g = svg.querySelector('[data-sleeve-root="1"]');
    if (g) g.setAttribute("transform", "translate(" + (dx * SC * viewZ) + "," + (dy * SC * viewZ) + ")");
    return true;
  }

  // render.js 가 draft 렌더 끝에서 호출: 소매 offset 을 실측으로 맞춘다(재렌더 없이).
  function afterDraftRender() {
    if (!inDraft()) return;
    syncSleeveOffset();
  }

  // 몸판+소매 봉제선 outline union(표시 위치, cm). 없으면 null.
  function outlineUnionCm() {
    const m = measureOutlineCm();
    const off = currentOff();
    const metas = [];
    if (m.body) metas.push({ role: "outline", piece: "body", ...m.body });
    if (m.sleeveLocal) metas.push({ role: "outline", piece: "sleeve", ...m.sleeveLocal });
    return unionOutlineBBox(metas, off);
  }

  // union 중심을 viewport 중심에 두는 카메라 fit(형상·offset 불변, viewX/viewY/viewZ 만).
  function fitDraftView() {
    if (!inDraft()) return;
    const bb = outlineUnionCm();
    if (!bb) return;                        // 측정 대상 없음(치수 미입력 등) → 유지
    // 실제 표시 박스 크기(px=user unit, viewBox 없음). clientWidth 가 0 일 수 있어
    // getBoundingClientRect 를 우선한다. 둘 다 0 이면 900/700.
    const r = svg.getBoundingClientRect();
    const W = r.width || svg.clientWidth || 900;
    const H = r.height || svg.clientHeight || 700;
    const cam = computeFitCamera(bb, W, H, { SC, MX, MY }, DRAFT_MIN_Z, FIT_MARGIN);
    view.z = cam.z; view.x = cam.x; view.y = cam.y;
    syncViewVars();
    if (typeof render === "function") render();
  }

  // ── 리사이즈 재중앙: ResizeObserver(#cv). rAF 비의존 → hidden→visible/레이아웃 확정
  //    시에도 콜백이 전달되어 반드시 다시 fit 된다. fit 은 카메라만 바꿔 #cv 크기를
  //    안 바꾸므로 루프 없음. design 화면은 designLayout 이 담당(inDraft 가드). ──
  if (typeof ResizeObserver !== "undefined" && typeof svg !== "undefined" && svg) {
    const ro = new ResizeObserver(() => { if (inDraft()) fitDraftView(); });
    ro.observe(svg);
  }

  window.draftLayout = Object.freeze({
    // 순수(harness)
    computeSleeveDx, computeSleeveDy, computeFitCamera, unionOutlineBBox, sleeveStoreFromEvt, sleeveDisplayFromStore,
    // DOM 연동
    fitDraftView, afterDraftRender, syncSleeveOffset, measureOutlineCm, outlineUnionCm,
    GAP
  });
})();
