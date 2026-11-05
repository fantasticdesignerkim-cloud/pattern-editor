// ══════════════════════════════════════════════
// js/designLineQuickBar.js — 패턴선 «선 가까이» 빠른 도구막대(UI 전용 · 2026-11-05 김님 시안 «선 가까이» 승인).
//
// 무엇: 패턴 위, 지금 작업 대상 가까이에 작은 도구막대를 띄워 오른쪽 패널 왕복을 줄인다.
//   · 그리기 중(점 ≥1) → 마지막 점 근처에 «그리기 취소» · «그리기 완료»(완료 가능 = designLineTool.canFinishDraw 그대로)
//   · 선 선택(정상 완료 직후 자동 선택 포함 · 기존 선 재선택) → 그 선 근처에 절개선 · 외곽 · 보조선(현재 역할 강조)
//   · 관리형 선(네크라인 전용 · 소매산 · 칼라 본체)은 역할 버튼 잠금(designLineTool 의 잠금 판정 그대로)
//   · 선택한 선이 절개선이면 별도 «다음 단계» 행에 «파트 분리»(2026-11-05 김님 요청) — 오른쪽 «파트 분리»와 **같은 판정**
//     (designLineTool.getSplitState = syncSplitButton 이 마지막으로 쓴 판정 · 재판정 없음)과 **같은 명령**(doSplit).
//     불가면 비활성 + 보이는 짧은 이유(무효 절개선 · 최종 몸판 미확정 · 파생 몸판 미지원 · 앞/뒤판 아님). 분리되면 «분리됨 · 파트 N개».
//   · 선택한 선이 외곽이면 별도 «다음 단계» 행에 «외곽 대체 미리보기»(2026-11-06 김님 «외곽 선택하면 외곽 대체 미리보기가 있어야지»)
//     — 오른쪽 «외곽 대체 미리보기»와 같은 판정(designLineTool.getBoundaryState = syncBoundaryStatus 가 마지막으로 쓴 판정)·같은 명령(doBoundaryPreview).
//     불가면 비활성 + 이유(무효 · 소매 재완료 필요 · 별도 소매 조각 없음 · 파생 몸판 미지원 · 카라). 보이면 «미리보기 표시 중»(완성 외곽 아님). 보조선 = 다음 단계 없음.
//
// 계약(제품 엔진 불변):
//   · 상태를 새로 갖지 않는다 — 매 render 직후 designLineTool 의 공개 상태(getMode·getDraft·getSelectedId·findLine·
//     canFinishDraw·잠금 판정)를 읽어 보이기만 한다. 저장 상태·선 생성·자동 역할 지정 없음.
//   · 버튼은 기존 명령만 부른다: finishDraw · cancel(= 오른쪽 «그리기 취소»와 같은 setMode("off")) · setRole.
//     오른쪽 버튼·id·단축키(Enter·Esc·Backspace·Delete)는 그대로이고, 둘 다 같은 명령이라 자동 동기화된다.
//   · UI 상태: «접기(×)» = 지금 선택한 선에 대해서만 막대를 접는다(선·선택 무변경). 캔버스를 다시 누르면 풀린다.
//     «도구»(소형 상태줄 → 전체 막대, 2026-11-05) = 분리 결과 확인용 상태줄을 그 결과에 대해서만 펼친다. 선택·결과 변화·캔버스 누름에 풀린다.
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
      const role = s.sel.role || "guide";
      const sp = (!lock && role === "cut" && s.sel.split) ? s.sel.split : null;   // 절개선만 · 관리선·다른 역할은 분리 행 없음
      const split = sp ? { allowed: !!sp.allowed, kind: sp.kind, parts: sp.parts || 0,
        text: sp.allowed ? (sp.parts > 0 ? "분리됨 · 파트 " + sp.parts + "개(색으로 미리보기)" : "분리 가능") : "분리 불가 · " + sp.reason } : null;
      const bs = (!lock && role === "boundary" && s.sel.boundary) ? s.sel.boundary : null;   // 외곽만 · 관리선(네크라인 전용선 등)은 잠금 그대로
      // 단계(2026-11-06 소매 «외곽 반영»): preview(미리보기 전) → confirm(미리보기 확인 · 소매만 «외곽 반영») → applied(반영됨 · 재완료 안내).
      //   몸판은 apply 가 없어 종전 그대로(preview·미리보기 표시 중).
      const stage = bs ? (bs.applied ? "applied" : (bs.shown && bs.apply) ? "confirm" : "preview") : null;
      const boundary = bs ? { allowed: !!bs.allowed, kind: bs.kind, shown: !!bs.shown, stage: stage,
        apply: bs.apply ? { allowed: !!bs.apply.allowed, reason: bs.apply.reason } : null, undo: !!bs.edit,
        text: stage === "applied" ? (bs.edit && bs.edit.pending ? "반영됨 · 소매 변경됨 — 소매 모양을 다시 완료하세요" : "반영됨 · 소매 외곽의 일부")
          : stage === "confirm" ? (bs.apply.allowed ? "미리보기 확인 · «외곽 반영»을 눌러야 소매에 반영됩니다" : "반영 불가 · " + bs.apply.reason)
          : bs.allowed ? (bs.shown ? "미리보기 표시 중 · 보라 외곽(완성 외곽 아님)" : bs.reason) : "대체 불가 · " + bs.reason } : null;
      return { kind: "select", key: "sel:" + s.sel.id, title: lock ? LOCK_TITLE[lock] : "선택한 선 · " + (PIECE_LABEL[s.sel.piece] || s.sel.piece), role: role, locked: !!lock, split: split, boundary: boundary };
    }
    return null;
  }

  // ── 순수: 표시 형태(2026-11-05 · Codex 후속 «320×640 팝업이 분리 파트를 덮음») ──
  //   분리가 성공해 파트가 현재 결과로 보이는데(sp.allowed && parts>0) **전체 막대를 놓을 빈자리가 없으면**(배치 최소 가림 > 0)
  //   결과 확인용 소형 상태줄 «분리됨 · 파트 N개» + «도구»로 줄인다. «도구»를 누르면(expandedKey = 그 결과 키) 전체 막대로 복귀.
  //   미분리·실패·보류·그리기·관리선·넓은 화면(빈자리 있음)은 언제나 전체 막대(이유·분리 버튼이 보여야 한다).
  //   버튼을 구겨 작게 만들지 않는다 — 소형 상태줄의 «도구»도 44px.
  //   외곽 대체 미리보기가 보이는 것도 같은 «결과»(2026-11-06) — 소형 상태줄 «외곽 대체 미리보기 표시 중».
  function resultKey(vm) {
    const sp = vm && vm.kind === "select" ? vm.split : null, bd = vm && vm.kind === "select" ? vm.boundary : null;
    if (sp && sp.allowed && sp.parts > 0) return vm.key + ":parts" + sp.parts;
    if (bd && bd.allowed && bd.shown) return vm.key + ":bnd";
    return null;
  }
  function compactText(vm) {
    const sp = vm && vm.split;
    return (sp && sp.allowed && sp.parts > 0) ? "분리됨 · 파트 " + sp.parts + "개" : "외곽 대체 미리보기 표시 중 · «도구»에서 반영";
  }
  function chooseMode(vm, fullHits, expandedKey) {
    const k = resultKey(vm);
    return (k && fullHits > 0 && expandedKey !== k) ? "compact" : "full";
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
    // 가림 대상 묶음(선·분리 파트) 바깥 네 방향(2026-11-05 소매 파트 분리) — 좁은 화면에서 선 주변 후보가 모두 파트를 덮을 때만 뽑힌다
    //   (동점이면 앞 후보 유지 → 선 주변에 빈자리가 있으면 종전 위치 그대로).
    const nRef = cands.length, ob = o.obstacles || [];
    if (ob.length) {
      let l = Infinity, r = -Infinity, t = Infinity, bt = -Infinity;
      ob.forEach(q => { l = Math.min(l, q.x); r = Math.max(r, q.x); t = Math.min(t, q.y); bt = Math.max(bt, q.y); });
      const mx = (l + r) / 2, my = (t + bt) / 2;
      cands.push({ x: mx - w / 2, y: bt + GAP }, { x: mx - w / 2, y: t - GAP - h }, { x: l - GAP - w, y: my - h / 2 }, { x: r + GAP, y: my - h / 2 });
    }
    (o.extra || []).forEach(c => cands.push({ x: c.x, y: c.y }));   // 호출부가 더하는 자리(소형 상태줄 = 캔버스 네 모서리) — 맨 뒤라 동점이면 앞 후보 우선
    let best = null;
    cands.forEach((c, i) => {
      const x = clampX(c.x), y = clampY(c.y);
      let hits = 0;
      (o.obstacles || []).forEach(q => { if (q.x >= x - PAD && q.x <= x + w + PAD && q.y >= y - PAD && q.y <= y + h + PAD) hits++; });
      if (!best || hits < best.hits) best = { x: x, y: y, hits: hits, index: i, around: i >= nRef };
    });
    return best;
  }

  // ── DOM ──
  let bar = null, titleEl = null, dismissBtn = null, drawRow = null, roleRow = null, finishBtn = null, cancelBtn = null, roleBtns = [];
  let splitRow = null, splitBtn = null, splitReason = null;
  let bndRow = null, bndBtn = null, bndReason = null, bndApply = null, bndUndo = null;
  let headRow = null, compactRow = null, compactText_ = null, expandBtn = null;
  let expandedKey = null;             // 소형 상태줄에서 «도구»로 펼친 결과 키(UI 전용 · 선택·결과가 바뀌거나 캔버스를 누르면 풀림)
  let splitNote = null;                // {key, text}: 막대 «파트 분리»를 눌렀는데 파트가 안 생겼을 때 doSplit 이 남긴 안내(#designSplitNote) — 선택이 바뀌면 버림
  let bndNote = null;                  // {key, text}: 막대 «외곽 대체 미리보기»를 눌렀는데 미리보기가 안 생겼을 때 doBoundaryPreview 가 남긴 안내(#designBoundaryNote)
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
      return { design: true, mode: mode, sel: { id: id, piece: l.piece, role: l.role || "guide", lock: lock, split: T.getSplitState ? T.getSplitState() : null, boundary: T.getBoundaryState ? T.getBoundaryState() : null } };
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
      // 파트 분리 결과(색 미리보기) 외곽도 가리지 않을 대상 — 분리 직후 막대가 작은 파트를 덮지 않게.
      cv.querySelectorAll('[data-design-root="parts"] path').forEach(pp => pathPts(pp).forEach(r => obstacles.push(r)));
      cv.querySelectorAll('[data-design-root="boundary"] path').forEach(pp => pathPts(pp).forEach(r => obstacles.push(r)));   // 외곽 대체 미리보기도 가리지 않을 대상
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
    if (vm.kind !== "select") { splitRow.hidden = true; if (bndRow) bndRow.hidden = true; }
    dismissBtn.hidden = vm.kind !== "select";        // 그리기 중엔 접기 없음(완료·취소만 명시적으로)
    if (vm.kind === "draw") {
      finishBtn.disabled = !vm.canFinish; finishBtn.setAttribute("aria-disabled", vm.canFinish ? "false" : "true");
      if (vm.canFinish) finishBtn.removeAttribute("title"); else finishBtn.setAttribute("title", "서로 다른 점을 2개 이상 찍으면(또는 곡선을 드래그하면) 누를 수 있습니다");
    } else {
      const sp = vm.split;
      splitRow.hidden = !sp;
      if (sp) {
        if (splitNote && splitNote.key !== vm.key) splitNote = null;
        const note = (splitNote && sp.allowed && !sp.parts) ? splitNote.text : null;
        splitBtn.disabled = !sp.allowed; splitBtn.setAttribute("aria-disabled", sp.allowed ? "false" : "true");
        splitReason.textContent = note || sp.text;
        splitRow.setAttribute("data-state", note ? "no" : !sp.allowed ? "no" : sp.parts > 0 ? "done" : "ok");
      }
      const bd = vm.boundary;
      if (bndRow) {
        bndRow.hidden = !bd;
        if (bd) {
          if (bndNote && bndNote.key !== vm.key) bndNote = null;
          const note = (bndNote && ((bd.stage === "preview" && bd.allowed && !bd.shown) || bd.stage === "confirm")) ? bndNote.text : null;
          bndBtn.hidden = bd.stage !== "preview";
          bndBtn.disabled = !bd.allowed; bndBtn.setAttribute("aria-disabled", bd.allowed ? "false" : "true");
          if (bndApply) {   // 같은 명령(doBoundaryApply) · 같은 판정(getBoundaryState.apply) — 오른쪽 «외곽 반영»과 공용
            const ap = bd.stage === "confirm" && bd.apply;
            bndApply.hidden = !ap; const on = !!(ap && bd.apply.allowed);
            bndApply.disabled = !on; bndApply.setAttribute("aria-disabled", on ? "false" : "true");
          }
          if (bndUndo) bndUndo.hidden = !(bd.stage === "applied" && bd.undo);
          bndReason.textContent = note || bd.text;
          bndRow.setAttribute("data-state", note ? "no" : bd.stage === "applied" ? "done" : bd.stage === "confirm" ? (bd.apply.allowed ? "ok" : "no") : !bd.allowed ? "no" : bd.shown ? "done" : "ok");
        }
      }
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
    let pos = place({ bounds: bounds, size: size, refs: refs, obstacles: tg.obstacles });
    const rk = resultKey(vm);
    if (expandedKey && expandedKey !== rk) expandedKey = null;   // 다른 선·다른 결과(무효화·재분리)면 펼침 해제
    const mode = chooseMode(vm, pos.hits, expandedKey);
    setCompact(mode === "compact", vm);
    if (mode === "compact") {   // 줄인 크기로 다시 배치 — 선·파트 둘레 후보 + 캔버스 네 모서리(빈 UI 자리) 중 가장 덜 가리는 곳
      const cs = { w: bar.offsetWidth, h: bar.offsetHeight };
      pos = place({ bounds: bounds, size: cs, refs: refs, obstacles: tg.obstacles,
        extra: [{ x: bounds.l, y: bounds.t }, { x: bounds.r - cs.w, y: bounds.t }, { x: bounds.l, y: bounds.b - cs.h }, { x: bounds.r - cs.w, y: bounds.b - cs.h }] });
    }
    bar.setAttribute("data-mode", mode);
    const x = Math.round(pos.x), y = Math.round(pos.y);
    if (!lastPos || lastPos.x !== x || lastPos.y !== y) { bar.style.left = x + "px"; bar.style.top = y + "px"; lastPos = { x: x, y: y }; }
    bar.setAttribute("data-place", pos.around ? "around" : String(pos.index % 4));
    bar.style.visibility = "";

    // 포커스가 막대 안에 있었는데 그 버튼이 숨겨졌으면(완료 → 역할 단계) 지금 단계의 주 버튼으로 옮긴다.
    if (hadFocus && !bar.contains(document.activeElement)) focusPrimary(vm);
    else if (hadFocus && document.activeElement && document.activeElement.closest("[hidden]")) focusPrimary(vm);
  }
  // 소형 상태줄 켜기/끄기 — 전체 막대의 행은 그대로 두고 보이기만 바꾼다(요소 재생성 없음).
  function setCompact(on, vm) {
    if (!compactRow) return;
    if (on) {
      const t = compactText(vm);
      compactText_.textContent = t;
      headRow.hidden = true; roleRow.hidden = true; splitRow.hidden = true; if (bndRow) bndRow.hidden = true; drawRow.hidden = true; compactRow.hidden = false;
      bar.setAttribute("aria-label", "패턴선 빠른 조작 · " + vm.title + " · " + t);
    } else { compactRow.hidden = true; headRow.hidden = false; }
  }
  function focusPrimary(vm) {
    if (compactRow && !compactRow.hidden) { try { expandBtn.focus({ preventScroll: true }); } catch (_) { expandBtn.focus(); } return; }
    if (vm.kind === "select" && bndApply && !bndApply.hidden && !bndApply.disabled && bndRow && !bndRow.hidden) { try { bndApply.focus({ preventScroll: true }); } catch (_) { bndApply.focus(); } return; }   // 미리보기 확인 단계 = 다음 행동
    const t = vm.kind === "draw" ? (finishBtn.disabled ? cancelBtn : finishBtn)
      : (roleBtns.filter(b => b.getAttribute("aria-pressed") === "true" && !b.disabled)[0] || (dismissBtn.hidden ? null : dismissBtn));
    if (t) { try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); } }
  }

  // 막대 «파트 분리» 동작(버튼 click 이 부르는 그대로 · 검사도 이 함수를 부른다). 판정이 허용일 때만 doSplit.
  function actSplit() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.split || !vm.split.allowed) return false;
    T.doSplit();
    const st = T.getSplitState ? T.getSplitState() : null, el = typeof document !== "undefined" ? document.getElementById("designSplitNote") : null;
    const done = !!(st && st.parts > 0);
    splitNote = done ? null : { key: vm.key, text: (el && el.textContent) || "분리되지 않았습니다" };
    sync(); return done;
  }

  // 막대 «외곽 대체 미리보기» 동작(버튼 click 이 부르는 그대로 · 검사도 이 함수를 부른다). 판정이 허용일 때만 doBoundaryPreview.
  function actBoundary() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.boundary || !vm.boundary.allowed) return false;
    T.doBoundaryPreview();
    const st = T.getBoundaryState ? T.getBoundaryState() : null, el = typeof document !== "undefined" ? document.getElementById("designBoundaryNote") : null;
    const done = !!(st && st.shown);
    bndNote = done ? null : { key: vm.key, text: (el && el.textContent) || "미리보기가 만들어지지 않았습니다" };
    sync(); return done;
  }

  // 막대 «외곽 반영»(소매 · 미리보기 확인 단계에서만) — 오른쪽 버튼과 같은 doBoundaryApply. 반영이 안 되면 그 안내를 막대에도.
  function actBoundaryApply() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.boundary || vm.boundary.stage !== "confirm" || !vm.boundary.apply || !vm.boundary.apply.allowed) return false;
    const done = !!(T.doBoundaryApply && T.doBoundaryApply());
    const el = typeof document !== "undefined" ? document.getElementById("designBoundaryNote") : null;
    bndNote = done ? null : { key: vm.key, text: (el && el.textContent) || "반영되지 않았습니다" };
    sync(); return done;
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
    splitRow = bar.querySelector('[data-lqb="split"]');
    splitBtn = document.getElementById("lineQuickSplit");
    splitReason = document.getElementById("lineQuickSplitReason");
    headRow = bar.querySelector(".lqb-head");
    compactRow = bar.querySelector('[data-lqb="compact"]');
    compactText_ = document.getElementById("lineQuickCompactText");
    bndRow = bar.querySelector('[data-lqb="boundary"]');
    bndBtn = document.getElementById("lineQuickBoundary");
    bndReason = document.getElementById("lineQuickBoundaryReason");
    bndApply = document.getElementById("lineQuickBoundaryApply");
    bndUndo = document.getElementById("lineQuickBoundaryUndo");
    expandBtn = document.getElementById("lineQuickExpand");

    // 막대 위 조작은 캔버스(점 추가·피스 드래그·팬)로 가지 않는다.
    ["pointerdown", "mousedown", "touchstart", "wheel", "dblclick"].forEach(t => bar.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    finishBtn.addEventListener("click", () => { const T = tool(); if (T) T.finishDraw(); });
    cancelBtn.addEventListener("click", () => { const T = tool(); if (T && T.getMode() === "draw") T.cancel(); });
    roleBtns.forEach(b => b.addEventListener("click", () => { const T = tool(); if (T) T.setRole(b.getAttribute("data-role")); }));
    // 파트 분리 = 오른쪽 버튼과 같은 doSplit. 파트가 안 생기면(분할 직전 재검증·ring 실패) doSplit 이 남긴 안내를 막대에도 보인다.
    splitBtn.addEventListener("click", () => { actSplit(); });
    if (bndBtn) bndBtn.addEventListener("click", () => { actBoundary(); });   // 외곽 대체 미리보기 = 오른쪽 버튼과 같은 doBoundaryPreview
    if (bndApply) bndApply.addEventListener("click", () => { actBoundaryApply(); });   // 외곽 반영 = 오른쪽 버튼과 같은 doBoundaryApply
    if (bndUndo) bndUndo.addEventListener("click", () => { const T = tool(); if (T && T.doSleeveEditUndo) T.doSleeveEditUndo(); sync(); });   // 되돌리기 = 오른쪽과 같은 doSleeveEditUndo
    // 소형 상태줄 «도구» = 이 결과에 대해 전체 막대(역할·파트 분리)로 복귀.
    if (expandBtn) expandBtn.addEventListener("click", () => { const vm = describe(snapshot()); expandedKey = resultKey(vm); sync();
      const t = roleBtns.filter(b => b.getAttribute("aria-pressed") === "true" && !b.disabled)[0]; if (t) { try { t.focus({ preventScroll: true }); } catch (_) { t.focus(); } } });
    dismissBtn.addEventListener("click", () => { const vm = describe(snapshot()); if (vm && vm.kind === "select") { dismissedKey = vm.key; hide(); } });

    // 캔버스 드래그 중 숨김 · 손 떼면 재계산. 캔버스를 누르면 «접기» 해제(같은 선 재선택에도 다시 보임).
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (cv) cv.addEventListener("pointerdown", e => { press = { x: e.clientX, y: e.clientY, id: e.pointerId }; dismissedKey = null; expandedKey = null; }, true);
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

  window.designLineQuickBar = Object.freeze({ sync: () => { try { sync(); } catch (_) { hide(); } }, describe: describe, place: place, chooseMode: chooseMode, resultKey: resultKey,
    viewModel: () => describe(snapshot()), actSplit: actSplit, actBoundary: actBoundary, actBoundaryApply: actBoundaryApply });
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  }
})();
