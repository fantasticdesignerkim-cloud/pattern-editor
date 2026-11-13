// 라이트 테마 크롬(UI 전용 · 2026-11-12 apple-light-ui · 2026-11-13 현재 HEAD 에 통합) — 확대 알약 · 폰 하단 시트 · 화면 모드 · 폰 원형 맞춤.
// 기존 전역(view · syncViewVars · render · resetView · _minZoom)만 호출한다. 형상·저장·상태 계약 무변경.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);

  // ── 확대 알약: 캔버스 가운데를 기준으로 init.js 휠 줌과 같은 식으로 확대/축소 ──
  function zoomBy(f) {
    if (typeof view === "undefined" || typeof syncViewVars !== "function" || typeof render !== "function") return;
    const cv = $("cv"); if (!cv) return;
    const r = cv.getBoundingClientRect(), mx = r.width / 2, my = r.height / 2;
    const minZ = typeof _minZoom === "function" ? _minZoom() : 0.2;
    const nz = Math.min(Math.max(view.z * f, minZ), 10);
    view.x = mx - view.MX - (mx - view.MX - view.x) * (nz / view.z);
    view.y = my - view.MY - (my - view.MY - view.y) * (nz / view.z);
    view.z = nz;
    syncViewVars();
    render();
    showZoom();
  }
  function showZoom() {
    const el = $("zoomPct");
    if (el && typeof view !== "undefined") {
      const t = Math.round(view.z * 100) + "%";
      if (el.textContent !== t) el.textContent = t;
    }
  }
  const zi = $("zoomIn"), zo = $("zoomOut"), zf = $("zoomFit");
  if (zi) zi.addEventListener("click", () => zoomBy(1.12));
  if (zo) zo.addEventListener("click", () => zoomBy(1 / 1.12));
  if (zf) zf.addEventListener("click", () => {
    if (typeof resetView === "function") resetView();
    if (window.axPhoneFit) window.axPhoneFit();   // 좁은 화면 원형: 초기화 뒤 도면 맞춤(아래 IIFE · 그 밖에서는 아무것도 안 함)
    showZoom();
  });
  // 휠·핀치·화면 초기화·자동 맞춤 등 다른 경로의 배율 변화도 표시(가벼운 폴링 — 값이 바뀔 때만 DOM 갱신)
  setInterval(showZoom, 250);
  showZoom();

  // (빠른 도구 접기 그래버는 통합하지 않음 — 현재 막대의 압축 배치(js/designLineQuickBar.js data-fit)가 같은 일을 한다 · css/apple.css 주석)
})();

// ── 좁은 화면(≤615px) inspector 하단 시트: 그래버를 끌면 높이 조절 → 놓으면 접힘/중간/펼침 중 가까운 곳으로 · 탭 = 접기↔펼치기 ──
(function () {
  "use strict";
  const insp = document.querySelector("aside.inspector"), grab = document.getElementById("inspectorGrabber");
  if (!insp || !grab || !window.matchMedia) return;
  const mq = window.matchMedia("(max-width:615px)");
  const KEY = "dorobo.ui.inspectorSheet";
  const STATES = ["collapsed", "half", "expanded"];
  const load = () => { try { const v = localStorage.getItem(KEY); return STATES.indexOf(v) >= 0 ? v : "half"; } catch (_) { return "half"; } };
  const save = v => { try { localStorage.setItem(KEY, v); } catch (_) {} };
  let state = load(), lastOpen = state === "collapsed" ? "half" : state;
  function avail() { const ws = insp.parentElement; return ws ? ws.getBoundingClientRect().height : window.innerHeight; }
  function heights() {
    const sum = insp.querySelector(".insp:not([hidden]) > summary");
    const collapsed = Math.round(grab.offsetHeight + (sum ? sum.offsetHeight : 40) + 4);
    const half = Math.round(Math.min(260, Math.max(180, Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0) * 0.32)));   // = 기존 clamp(180px,32vh,260px)
    const expanded = Math.round(Math.max(half, avail() * 0.72));
    return { collapsed: collapsed, half: half, expanded: expanded };
  }
  // persist = 사용자가 직접 바꿨을 때만 true(끌기·탭·화살표키). 화면을 여는 것만으로는 저장소에 아무것도 쓰지 않는다(2026-11-13 통합 — 저장 키는 사용자 조작의 결과여야 한다).
  function apply(s, persist) {
    if (!mq.matches) { insp.style.removeProperty("--ax-sheet-h"); insp.removeAttribute("data-sheet"); return; }
    state = s; if (s !== "collapsed") lastOpen = s;
    insp.style.setProperty("--ax-sheet-h", heights()[s] + "px");
    insp.setAttribute("data-sheet", s);
    grab.setAttribute("aria-expanded", String(s !== "collapsed"));
    if (persist) save(s);
  }
  let drag = null;
  grab.addEventListener("pointerdown", e => {
    if (!mq.matches) return;
    drag = { y: e.clientY, h: insp.getBoundingClientRect().height, moved: false };
    insp.classList.add("ax-dragging");
    try { grab.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  });
  grab.addEventListener("pointermove", e => {
    if (!drag) return;
    const dy = e.clientY - drag.y;
    if (Math.abs(dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    const H = heights(), h = Math.max(H.collapsed, Math.min(H.expanded, drag.h - dy));
    insp.style.setProperty("--ax-sheet-h", h + "px");
  });
  function end(e) {
    if (!drag) return;
    const d = drag; drag = null; insp.classList.remove("ax-dragging");
    try { grab.releasePointerCapture(e.pointerId); } catch (_) {}
    if (!d.moved) { apply(state === "collapsed" ? lastOpen : "collapsed", true); return; }   // 탭
    const h = insp.getBoundingClientRect().height, H = heights();
    let best = "half", bd = Infinity;
    STATES.forEach(s => { const dd = Math.abs(H[s] - h); if (dd < bd) { bd = dd; best = s; } });
    apply(best, true);
  }
  grab.addEventListener("pointerup", end);
  grab.addEventListener("pointercancel", end);
  grab.addEventListener("keydown", e => {   // 키보드: 위/아래 화살표로 단계 이동(Enter/Space 는 click 으로 처리)
    const i = STATES.indexOf(state);
    if (e.key === "ArrowUp" && i < 2) { apply(STATES[i + 1], true); e.preventDefault(); }
    if (e.key === "ArrowDown" && i > 0) { apply(STATES[i - 1], true); e.preventDefault(); }
  });
  grab.addEventListener("click", e => { if (e.detail === 0) apply(state === "collapsed" ? lastOpen : "collapsed", true); });   // 키보드 클릭만(포인터 탭은 pointerup 에서)
  // 시트 크기 변화가 끝나면 그림을 다시 화면에 맞춘다(기존 맞춤 함수만 호출 — 원형 = draftLayout.fitDraftView · 디자인 = designLayout.resetViewForDesign).
  //   ResizeObserver(#cv) 도 원형에서는 이미 맞추지만, 애니메이션 끝 크기 기준으로 한 번 더 맞춰 확정한다.
  function refit() {
    const st = document.documentElement.dataset.workspaceStage || "draft";
    if (st === "design") { if (window.designLayout && window.designLayout.resetViewForDesign) window.designLayout.resetViewForDesign(); }
    else if (window.draftLayout && window.draftLayout.fitDraftView) { window.draftLayout.fitDraftView(); if (window.axPhoneFit) window.axPhoneFit(); }
  }
  insp.addEventListener("transitionend", e => { if (e.target === insp && e.propertyName === "height" && mq.matches) refit(); });
  const onMq = () => apply(state);
  if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);
  window.addEventListener("resize", () => { if (mq.matches && !drag) apply(state); });
  apply(state);
})();

// ── 화면 모드(시스템/밝게/어둡게) ── 저장 키 dorobo.ui.theme · html[data-theme] 를 light/dark 로 둔다.
//    «시스템»은 prefers-color-scheme 를 따르고 바뀌면 즉시 반영. 도면(SVG) 색·내보내기에는 관여하지 않는다.
(function(){
  const KEY = "dorobo.ui.theme";
  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const pref = () => { try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch (e) { return "system"; } };
  function apply(){
    const p = pref();
    const dark = p === "dark" || (p === "system" && !!(mq && mq.matches));
    root.setAttribute("data-theme", dark ? "dark" : "light");
    document.querySelectorAll("#axTheme [data-theme-pref]").forEach(b => {
      const on = b.dataset.themePref === p;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
  }
  const grp = document.getElementById("axTheme");
  if (grp) {
    grp.addEventListener("click", e => {
      const b = e.target.closest("[data-theme-pref]"); if (!b) return;
      try { if (b.dataset.themePref === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, b.dataset.themePref); } catch (err) {}
      apply();
    });
    grp.addEventListener("keydown", e => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const bs = [...grp.querySelectorAll("[data-theme-pref]")];
      const i = bs.findIndex(b => b.getAttribute("aria-checked") === "true");
      const n = bs[(i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length];
      e.preventDefault(); n.click(); n.focus();
    });
  }
  if (mq) (mq.addEventListener ? mq.addEventListener("change", apply) : mq.addListener(apply));
  apply();
})();

// ── 좁은 화면(≤615px) 원형 자동 맞춤 보정 ──────────────────────────────
//  원인: draftLayout.fitDraftView 는 zoom 을 «라벨·보조선 포함 전체 콘텐츠» bbox 로 정한다.
//   라벨 글씨는 고정 px 라 cm 로 환산하면 zoom 이 작을수록 커지고(390px: 소매 오른쪽 «EL/SL» 라벨이 봉제선 밖 24.7cm,
//   1440px: 11.9cm), symmetricFitBBox 가 그 가장 먼 쪽을 반대쪽에도 대칭으로 더해 폭이 봉제선(91.3cm)의 약 1.5배가 된다.
//   데스크톱에서는 여유가 있어 문제없지만 폰 폭에서는 도면이 20–27% 로 작아진다.
//  보정: ≤615px · 원형 단계에서만, 같은 순수 함수(computeFitCamera)로 **봉제선 outline union** 에 맞춘다
//   (중심은 기존과 동일한 outline 중심 · 여백 12px · 줌 하한은 기존 _minZoom). 가장자리 바깥 라벨은 잘릴 수 있고
//   끌어서/축소로 볼 수 있다. 카메라(view)만 바꾼다 — 형상·소매 배치 offset·내보내기 무관.
//  호출: #cv ResizeObserver(draftLayout 의 것 다음에 등록되어 그 뒤에 실행) · 시트 높이 전환 끝 · 확대 알약 ⤢.
(function () {
  "use strict";
  const mq = window.matchMedia ? window.matchMedia("(max-width: 615px)") : null;
  const MARGIN = 12;
  function inDraft() { return !(typeof window.isDesignStageActive === "function" && window.isDesignStageActive()); }
  function phoneFit() {
    if (!mq || !mq.matches || !inDraft()) return false;
    if (!window.draftLayout || typeof svg === "undefined" || !svg || typeof view === "undefined") return false;
    const bb = window.draftLayout.outlineUnionCm(); if (!bb) return false;
    const r = svg.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const minZ = typeof _minZoom === "function" ? _minZoom() : 0.2;
    const cam = window.draftLayout.computeFitCamera(bb, r.width, r.height, { SC, MX, MY }, minZ, MARGIN);
    view.z = cam.z; view.x = cam.x; view.y = cam.y;
    syncViewVars();
    if (typeof render === "function") render();
    return true;
  }
  window.axPhoneFit = phoneFit;
  if (typeof ResizeObserver !== "undefined" && typeof svg !== "undefined" && svg) {
    new ResizeObserver(() => { phoneFit(); }).observe(svg);
  }
})();
