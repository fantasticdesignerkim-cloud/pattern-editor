// ══════════════════════════════════════════════
// js/designLineQuickBar.js — 패턴선 «선 가까이» 빠른 도구막대(UI 전용 · 2026-11-05 김님 시안 «선 가까이» 승인).
//
// 무엇: 패턴 위, 지금 작업 대상 가까이에 작은 도구막대를 띄워 오른쪽 패널 왕복을 줄인다.
//   · 그리기 중(점 ≥1) → 마지막 점 근처에 «그리기 취소» · «그리기 완료»(완료 가능 = designLineTool.canFinishDraw 그대로)
//   · 선 선택(정상 완료 직후 자동 선택 포함 · 기존 선 재선택) → 그 선 근처에 절개선 · 외곽 · 보조선(현재 역할 강조)
//   · 관리형 선(네크라인 전용 · 소매산 · 칼라 본체)은 역할 버튼 잠금(designLineTool 의 잠금 판정 그대로)
//
// 계약(제품 엔진 불변):
//   · 상태를 새로 갖지 않는다 — 매 render 직후 designLineTool 의 공개 상태(getMode·getDraft·getSelectedId·findLine·
//     canFinishDraw·잠금 판정)를 읽어 보이기만 한다. 저장 상태·선 생성·자동 역할 지정 없음.
//   · 버튼은 기존 명령만 부른다: finishDraw · cancel(= 오른쪽 «그리기 취소»와 같은 setMode("off")) · setRole.
//     오른쪽 버튼·id·단축키(Enter·Esc·Backspace·Delete)는 그대로이고, 둘 다 같은 명령이라 자동 동기화된다.
//   · 유일한 UI 상태: «접기(×)» = 지금 선택한 선에 대해서만 막대를 접는다(선·선택 무변경). 캔버스를 다시 누르면 풀린다.
//   · 위치 기준 = **실제로 그려진 SVG**(선택 선 path · overlay 앵커/핸들 · 작성 중 preview/vertex)의 화면 좌표(getScreenCTM).
//     피스 offset·파생 몸판·카라 레이어·줌·팬이 무엇이든 화면에 그려진 선과 정합. 커서 위치는 쓰지 않는다(흔들림 없음).
//   · 배치 = 기준점 위/아래/오른쪽/왼쪽 후보 중 **선·앵커·핸들 점을 가리지 않는 첫 후보**(같으면 위 우선) → 캔버스 안으로 클램프.
//   · 캔버스 위 드래그(곡선 핸들·앵커 이동·팬·핀치) 중에는 숨기고, 손을 떼면 다시 계산한다.
//   · 막대는 #cv 의 형제(SVG 밖) → 막대 클릭은 캔버스 점 추가·피스 드래그로 전파되지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const PIECE_LABEL = { front: "앞판", back: "뒤판", sleeve: "소매", collar: "카라" };
  const LOCK_TITLE = { neck: "네크라인 전용선 · 역할 고정", cap: "소매산 관리선 · 역할 고정", collar: "칼라 본체 관리선 · 역할 고정" };
  const GAP = 18;        // 기준점과 막대 사이(손가락·핸들 여유)
  const PAD = 12;        // 가림 판정 여유(막대 사각형을 이만큼 키워 점이 들어오면 «가림»)
  const MARGIN = 8;      // 캔버스 가장자리 여백
  const DRAG_PX = 4;     // 이 이상 움직이면 캔버스 드래그로 보고 숨김(designLineTool DRAG_PX 와 같은 값)

  // ── 순수: 도구 상태 → 막대 표시 모델 ──
  // s = {design, mode, draft:{piece,n}|null, canFinish, sel:{id,piece,role,lock}|null}
  function describe(s) {
    if (!s || !s.design) return null;
    if (s.mode === "draw" && s.draft && s.draft.n > 0) {
      return { kind: "draw", key: "draw", title: "그리기 · " + (PIECE_LABEL[s.draft.piece] || s.draft.piece) + " · 점 " + s.draft.n + "개", canFinish: !!s.canFinish };
    }
    if (s.mode === "select" && s.sel) {
      const lock = s.sel.lock || null;
      return { kind: "select", key: "sel:" + s.sel.id, title: lock ? LOCK_TITLE[lock] : "선택한 선 · " + (PIECE_LABEL[s.sel.piece] || s.sel.piece), role: s.sel.role || "guide", locked: !!lock };
    }
    return null;
  }

  // ── 순수: 배치 ──
  // o = {bounds:{l,t,r,b}, size:{w,h}, refs:[{x,y}], obstacles:[{x,y}]} (모두 canvas-wrap 기준 px)
  // 반환 {x, y, hits, index} — 후보 순서: 각 기준점마다 위 · 아래 · 오른쪽 · 왼쪽. 가림 점 수가 가장 적은 첫 후보.
  function place(o) {
    const b = o.bounds, w = o.size.w, h = o.size.h;
    const clampX = x => Math.max(b.l, Math.min(x, b.r - w));
    const clampY = y => Math.max(b.t, Math.min(y, b.b - h));
    const cands = [];
    (o.refs || []).forEach(p => {
      cands.push({ x: p.x - w / 2, y: p.y - GAP - h });   // 위
      cands.push({ x: p.x - w / 2, y: p.y + GAP });       // 아래(위가 막히면 반전)
      cands.push({ x: p.x + GAP, y: p.y - h / 2 });       // 오른쪽
      cands.push({ x: p.x - GAP - w, y: p.y - h / 2 });   // 왼쪽
    });
    let best = null;
    cands.forEach((c, i) => {
      const x = clampX(c.x), y = clampY(c.y);
      let hits = 0;
      (o.obstacles || []).forEach(q => { if (q.x >= x - PAD && q.x <= x + w + PAD && q.y >= y - PAD && q.y <= y + h + PAD) hits++; });
      if (!best || hits < best.hits) best = { x: x, y: y, hits: hits, index: i };
    });
    return best;
  }

  // ── DOM ──
  let bar = null, titleEl = null, dismissBtn = null, drawRow = null, roleRow = null, finishBtn = null, cancelBtn = null, roleBtns = [];
  let dismissedKey = null;            // «접기(×)» 한 선택 키(UI 전용)
  let press = null, dragging = false;  // 캔버스 위 누름·드래그 상태
  let lastPos = null;

  function tool() { return window.designLineTool || null; }
  function snapshot() {
    const T = tool();
    const design = typeof window.isDesignStageActive === "function" && window.isDesignStageActive();
    if (!T || !design) return { design: false };
    const mode = T.getMode();
    if (mode === "draw") {
      const d = T.getDraft();
      return { design: true, mode: mode, draft: d ? { piece: d.piece, n: d.anchors.length } : null, canFinish: T.canFinishDraw() };
    }
    if (mode === "select") {
      const id = T.getSelectedId(), l = id ? T.findLine(id) : null;
      if (!l) return { design: true, mode: mode, sel: null };
      const lock = T.isNeckAutoLine(id) ? "neck" : T.isSleeveCapLine(l) ? "cap" : T.isCollarBodyLine(l) ? "collar" : null;
      return { design: true, mode: mode, sel: { id: id, piece: l.piece, role: l.role || "guide", lock: lock } };
    }
    return { design: true, mode: mode };
  }

  // 화면에 그려진 대상 → 기준점·가림 점(canvas-wrap 기준 px).
  function collectTargets(kind, wrapRect) {
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (!cv) return null;
    const local = (el, x, y) => { const m = el.getScreenCTM && el.getScreenCTM(); if (!m) return null; return { x: m.a * x + m.c * y + m.e - wrapRect.left, y: m.b * x + m.d * y + m.f - wrapRect.top }; };
    const pathPts = (p) => {
      const out = []; let L = 0; try { L = p.getTotalLength(); } catch (_) { return out; }
      const n = Math.max(16, Math.min(120, Math.ceil(L / 8)));
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); const r = local(p, q.x, q.y); if (r) out.push(r); }
      return out;
    };
    const circlePt = c => local(c, c.cx.baseVal.value, c.cy.baseVal.value);
    const obstacles = [], refs = [];
    cv.querySelectorAll(".design-line-handle").forEach(ln => {   // 곡선 핸들선(작성 중·선택 overlay 공통)
      const x1 = ln.x1.baseVal.value, y1 = ln.y1.baseVal.value, x2 = ln.x2.baseVal.value, y2 = ln.y2.baseVal.value;
      for (let i = 0; i <= 4; i++) { const r = local(ln, x1 + (x2 - x1) * i / 4, y1 + (y2 - y1) * i / 4); if (r) obstacles.push(r); }
    });
    cv.querySelectorAll(".design-line-handledot").forEach(c => { const r = circlePt(c); if (r) obstacles.push(r); });
    if (kind === "draw") {
      const pv = cv.querySelector(".design-line-preview");
      if (pv) pathPts(pv).forEach(r => obstacles.push(r));
      const vs = cv.querySelectorAll(".design-line-vertex");
      vs.forEach(c => { const r = circlePt(c); if (r) obstacles.push(r); });
      if (vs.length) { const r = circlePt(vs[vs.length - 1]); if (r) refs.push(r); }   // 마지막 점
    } else {
      const sp = cv.querySelector("path.design-line.selected");
      const anchors = []; cv.querySelectorAll(".design-line-anchor").forEach(c => { const r = circlePt(c); if (r) anchors.push(r); });
      anchors.forEach(r => obstacles.push(r));
      if (sp) {
        const pts = pathPts(sp); pts.forEach(r => obstacles.push(r));
        if (pts.length) { refs.push(pts[Math.floor(pts.length / 2)]); refs.push(pts[0]); refs.push(pts[pts.length - 1]); }
      } else if (anchors.length) {   // 관리형 선(유효 상태는 path 를 따로 그리지 않음) → overlay 앵커 기준
        refs.push(anchors[Math.floor(anchors.length / 2)]); refs.push(anchors[0]); refs.push(anchors[anchors.length - 1]);
      }
    }
    if (!refs.length) return null;
    return { cv: cv, refs: refs, obstacles: obstacles };
  }

  function hide() { if (bar && !bar.hidden) bar.hidden = true; lastPos = null; }

  function sync() {
    if (!bar) return;
    const vm = describe(snapshot());
    if (!vm || dragging || (vm.kind === "select" && dismissedKey === vm.key)) { hide(); return; }
    const wrap = bar.parentElement; if (!wrap) { hide(); return; }
    const wr = wrap.getBoundingClientRect();
    const tg = collectTargets(vm.kind, wr);
    if (!tg) { hide(); return; }                       // 대상이 화면에 안 그려짐(숨김 모드·다른 stage) → 막대도 없음
    const sr = tg.cv.getBoundingClientRect();
    if (sr.width < 1 || sr.height < 1) { hide(); return; }

    // 내용 갱신(요소 재생성 없음 — 포커스 보존)
    const hadFocus = bar.contains(document.activeElement);
    titleEl.textContent = vm.title;
    bar.setAttribute("aria-label", "패턴선 빠른 조작 · " + vm.title);
    bar.setAttribute("data-kind", vm.kind);
    drawRow.hidden = vm.kind !== "draw";
    roleRow.hidden = vm.kind !== "select";
    dismissBtn.hidden = vm.kind !== "select";        // 그리기 중엔 접기 없음(완료·취소만 명시적으로)
    if (vm.kind === "draw") {
      finishBtn.disabled = !vm.canFinish; finishBtn.setAttribute("aria-disabled", vm.canFinish ? "false" : "true");
      if (vm.canFinish) finishBtn.removeAttribute("title"); else finishBtn.setAttribute("title", "서로 다른 점을 2개 이상 찍으면(또는 곡선을 드래그하면) 누를 수 있습니다");
    } else {
      roleBtns.forEach(b => {
        const on = b.getAttribute("data-role") === vm.role;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.disabled = vm.locked; b.setAttribute("aria-disabled", vm.locked ? "true" : "false");
      });
    }

    // 측정 → 배치(보이기 전에 visibility 로 측정)
    const wasHidden = bar.hidden;
    if (wasHidden) { bar.style.visibility = "hidden"; bar.hidden = false; }
    const size = { w: bar.offsetWidth, h: bar.offsetHeight };
    const bounds = { l: sr.left - wr.left + MARGIN, t: sr.top - wr.top + MARGIN, r: sr.right - wr.left - MARGIN, b: sr.bottom - wr.top - MARGIN };
    // 화면 안에 보이는 기준점만 쓴다. 기준점이 모두 밖이면 보이는 선 위 점 하나로 · 대상이 통째로 화면 밖(팬·줌)이면 막대도 숨김.
    const vis = q => q.x >= bounds.l && q.x <= bounds.r && q.y >= bounds.t && q.y <= bounds.b;
    let refs = tg.refs.filter(vis);
    if (!refs.length) { const v = tg.obstacles.filter(vis); if (v.length) refs = [v[Math.floor(v.length / 2)]]; }
    if (!refs.length) { bar.style.visibility = ""; hide(); return; }
    const pos = place({ bounds: bounds, size: size, refs: refs, obstacles: tg.obstacles });
    const x = Math.round(pos.x), y = Math.round(pos.y);
    if (!lastPos || lastPos.x !== x || lastPos.y !== y) { bar.style.left = x + "px"; bar.style.top = y + "px"; lastPos = { x: x, y: y }; }
    bar.setAttribute("data-place", String(pos.index % 4));
    bar.style.visibility = "";

    // 포커스가 막대 안에 있었는데 그 버튼이 숨겨졌으면(완료 → 역할 단계) 지금 단계의 주 버튼으로 옮긴다.
    if (hadFocus && !bar.contains(document.activeElement)) focusPrimary(vm);
    else if (hadFocus && document.activeElement && document.activeElement.closest("[hidden]")) focusPrimary(vm);
  }
  function focusPrimary(vm) {
    const t = vm.kind === "draw" ? (finishBtn.disabled ? cancelBtn : finishBtn)
      : (roleBtns.filter(b => b.getAttribute("aria-pressed") === "true" && !b.disabled)[0] || (dismissBtn.hidden ? null : dismissBtn));
    if (t) { try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); } }
  }

  function init() {
    bar = document.getElementById("lineQuickBar");
    if (!bar) return;
    titleEl = document.getElementById("lineQuickTitle");
    dismissBtn = document.getElementById("lineQuickDismiss");
    drawRow = bar.querySelector('[data-lqb="draw"]');
    roleRow = bar.querySelector('[data-lqb="role"]');
    finishBtn = document.getElementById("lineQuickFinish");
    cancelBtn = document.getElementById("lineQuickCancel");
    roleBtns = Array.prototype.slice.call(roleRow.querySelectorAll("[data-role]"));

    // 막대 위 조작은 캔버스(점 추가·피스 드래그·팬)로 가지 않는다.
    ["pointerdown", "mousedown", "touchstart", "wheel", "dblclick"].forEach(t => bar.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    finishBtn.addEventListener("click", () => { const T = tool(); if (T) T.finishDraw(); });
    cancelBtn.addEventListener("click", () => { const T = tool(); if (T && T.getMode() === "draw") T.cancel(); });
    roleBtns.forEach(b => b.addEventListener("click", () => { const T = tool(); if (T) T.setRole(b.getAttribute("data-role")); }));
    dismissBtn.addEventListener("click", () => { const vm = describe(snapshot()); if (vm && vm.kind === "select") { dismissedKey = vm.key; hide(); } });

    // 캔버스 드래그 중 숨김 · 손 떼면 재계산. 캔버스를 누르면 «접기» 해제(같은 선 재선택에도 다시 보임).
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (cv) cv.addEventListener("pointerdown", e => { press = { x: e.clientX, y: e.clientY, id: e.pointerId }; dismissedKey = null; }, true);
    window.addEventListener("pointermove", e => {
      if (!press || dragging) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_PX) { dragging = true; hide(); }
    }, true);
    const release = () => { if (!press) return; press = null; if (dragging) { dragging = false; sync(); } };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    // 캔버스 크기 변화(창·패널 리사이즈)에는 render 없이도 위치만 다시 맞춘다.
    // 막대 자체 크기 변화(글꼴·단계 전환으로 높이가 바뀜)도 다시 맞춘다 — sync 는 left/top 만 바꿔 크기를 안 바꾸므로 되먹임 루프 없음.
    if (typeof ResizeObserver !== "undefined" && bar.parentElement) { const ro = new ResizeObserver(() => sync()); ro.observe(bar.parentElement); ro.observe(bar); }
    sync();
  }

  window.designLineQuickBar = Object.freeze({ sync: () => { try { sync(); } catch (_) { hide(); } }, describe: describe, place: place });
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  }
})();
