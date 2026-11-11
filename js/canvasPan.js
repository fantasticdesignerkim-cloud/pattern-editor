// 캔버스 화면 이동(팬)·두 손가락 핀치 — 뷰 변환(view.x·y·z)만 바꾼다. 형상·배치·저장 무변경.
// 2026-11-11 김님 리뷰 보완(하단 패널 실사용 회귀):
//   · 빈 캔버스(선·핸들·조각 드래그·그리기 점 추가가 잡지 않은 누름)를 한 손가락·마우스로 끌면 팬.
//     움직임 임계값(마우스 4px · 터치 8px) 미만이면 «클릭»(onTap — 선택 해제 같은 종전 클릭 동작), 이상이면 팬(선택·작성 중 선 보존).
//   · Space+드래그 = 즉시 팬(종전 명시적 팬 수단 유지 · 어느 stage 든).
//   · 두 손가락 = 핀치 확대·축소 + 두 손가락 중점 이동 = 팬(같은 뷰 변환). 두 번째 손가락이 닿으면 한 손가락으로 시작한
//     선·핸들·조각 드래그·그리기 점은 취소 훅(onMultiTouch)으로 되돌린다 — 핀치가 형상 좌표를 바꾸지 않게.
// 누가 «빈 누름»인지는 각 도구가 정한다: 선 도구는 맞은 게 없을 때 press(e, onTap) 를 부르고, 아무 도구도 잡지 않은
// 누름(전파가 막히지 않은 것)은 캔버스 래퍼에서 디자인 stage 일 때만 팬 후보가 된다.
(function () {
  "use strict";
  const MOUSE_PX = 4, TOUCH_PX = 8;
  let pend = null;                 // {id, x, y, vx, vy, thr, panning, onTap}
  const touches = new Map();       // 캔버스 위 터치 포인터 id → {x, y}(client)
  let pinch = null;                // {d, mx, my}
  const multiHooks = [];

  function cv() { return (typeof svg !== "undefined" && svg) ? svg : null; }
  function setCursor(c) { const s = cv(); if (s) s.style.cursor = c; }
  function redraw() { if (typeof syncViewVars === "function") syncViewVars(); if (typeof render === "function") render(); }
  function inDesign() { return typeof window.isDesignStageActive === "function" && !!window.isDesignStageActive(); }

  // 빈 누름 → 팬 후보. immediate = Space 팬(임계값 없이 바로 팬). 두 손가락 중이면 받지 않는다.
  function press(e, onTap, opt) {
    if (touches.size >= 2 || typeof view === "undefined") return false;
    const immediate = !!(opt && opt.immediate);
    pend = { id: e.pointerId, x: e.clientX, y: e.clientY, vx: view.x, vy: view.y,
      thr: immediate ? 0 : (e.pointerType === "mouse" ? MOUSE_PX : TOUCH_PX), panning: immediate, onTap: onTap || null };
    const s = cv(); try { if (s && e.pointerId != null) s.setPointerCapture(e.pointerId); } catch (_) {}
    if (immediate) setCursor("grabbing");
    return true;
  }
  function onMove(e) {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size >= 2) { pinchMove(); return; }
    if (!pend || e.pointerId !== pend.id) return;
    const dx = e.clientX - pend.x, dy = e.clientY - pend.y;
    if (!pend.panning) { if (Math.hypot(dx, dy) < pend.thr) return; pend.panning = true; setCursor("grabbing"); }
    view.x = pend.vx + dx; view.y = pend.vy + dy; redraw();
  }
  function finish(e, tap) {
    if (!pend || (e && e.pointerId !== pend.id)) return;
    const p = pend; pend = null;
    setCursor(typeof spaceDown !== "undefined" && spaceDown ? "grab" : "");
    if (tap && !p.panning && p.onTap) p.onTap();
  }
  function cancel() { if (pend) { pend = null; setCursor(typeof spaceDown !== "undefined" && spaceDown ? "grab" : ""); } }

  // ── 두 손가락 ──
  function two() { const v = Array.from(touches.values()); return v.length >= 2 ? [v[0], v[1]] : null; }
  function pinchStart() {
    const t = two(), s = cv(); if (!t || !s) return;
    cancel();                                         // 한 손가락 팬·클릭 후보는 버린다(클릭 아님)
    multiHooks.forEach(f => { try { f(); } catch (_) {} });   // 도구별 진행 중 드래그·점 추가 되돌리기
    const r = s.getBoundingClientRect();
    pinch = { d: Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y), mx: (t[0].x + t[1].x) / 2 - r.left, my: (t[0].y + t[1].y) / 2 - r.top };
  }
  function pinchMove() {
    const t = two(), s = cv(); if (!t || !s || !pinch || typeof view === "undefined") return;
    const r = s.getBoundingClientRect();
    const d = Math.hypot(t[1].x - t[0].x, t[1].y - t[0].y), mx = (t[0].x + t[1].x) / 2 - r.left, my = (t[0].y + t[1].y) / 2 - r.top;
    const lo = typeof _minZoom === "function" ? _minZoom() : 0.2;
    const nz = pinch.d > 0 ? Math.min(Math.max(view.z * d / pinch.d, lo), 10) : view.z;
    // 이전 중점 기준 확대·축소(휠·종전 핀치와 같은 식) + 중점 이동량만큼 팬
    view.x = pinch.mx - view.MX - (pinch.mx - view.MX - view.x) * (nz / view.z) + (mx - pinch.mx);
    view.y = pinch.my - view.MY - (pinch.my - view.MY - view.y) * (nz / view.z) + (my - pinch.my);
    view.z = nz;
    pinch = { d: d, mx: mx, my: my };
    redraw();
  }

  function attach() {
    const s = cv(); if (!s) return;
    // 터치 포인터 추적은 캡처 단계(도구 핸들러보다 먼저) — 두 번째 손가락이면 도구로 가기 전에 핀치로 전환한다.
    s.addEventListener("pointerdown", e => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) { pinchStart(); e.stopImmediatePropagation(); e.stopPropagation(); }
      else if (touches.size > 2) { e.stopImmediatePropagation(); e.stopPropagation(); }
    }, true);
    s.addEventListener("pointermove", e => { if (pinch && touches.has(e.pointerId)) { onMove(e); e.stopImmediatePropagation(); } }, true);
    s.addEventListener("pointermove", onMove);
    const up = (e, tap) => {
      const wasPinch = !!pinch;
      if (touches.delete(e.pointerId) && touches.size < 2) pinch = null;
      if (wasPinch) { e.stopImmediatePropagation(); return; }   // 핀치 손가락 떼기는 클릭이 아니다
      finish(e, tap);
    };
    s.addEventListener("pointerup", e => up(e, true), true);
    s.addEventListener("pointercancel", e => up(e, false), true);
    // 어떤 도구도 잡지 않은 누름(전파가 래퍼까지 옴): Space = 즉시 팬(모든 stage) · 디자인 stage 의 빈 곳 = 팬 후보.
    const wrap = s.parentElement;
    if (wrap) wrap.addEventListener("pointerdown", e => {
      if (e.target !== s && !s.contains(e.target)) return;   // 패널 등 캔버스 밖 요소는 제외(패널은 이미 전파를 막는다)
      if (e.button !== 0 || pend || touches.size >= 2) return;
      if (typeof spaceDown !== "undefined" && spaceDown) { press(e, null, { immediate: true }); return; }
      if (inDesign()) press(e, null);
    });
  }

  window.canvasPan = Object.freeze({
    press: press, cancel: cancel,
    pending: () => !!pend, panning: () => !!(pend && pend.panning), pinching: () => !!pinch,
    onMultiTouch: f => { if (typeof f === "function") multiHooks.push(f); },
    MOUSE_PX: MOUSE_PX, TOUCH_PX: TOUCH_PX
  });
  attach();
})();
