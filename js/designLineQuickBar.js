// ══════════════════════════════════════════════
// js/designLineQuickBar.js — 패턴선 하단 고정 편집 패널(옛 «선 가까이» 빠른 도구막대)(UI 전용 · 2026-11-05 김님 시안 «선 가까이» 승인).
//
// 무엇: 패턴 위, 지금 작업 대상 가까이에 작은 도구막대를 띄워 오른쪽 패널 왕복을 줄인다.
//   · 그리기 중(점 ≥1) → 하단 고정 패널(2026-11-11 · 선택 패널과 같은 자리)에 «그리기 취소» · «그리기 완료»(완료 가능 = designLineTool.canFinishDraw 그대로)
//   · 선 선택(정상 완료 직후 자동 선택 포함 · 기존 선 재선택) → 그 선 근처에 절개선 · 외곽 · 보조선(현재 역할 강조)
//   · 관리형 선(네크라인 전용 · 소매산 · 칼라 본체)은 역할 버튼 잠금(designLineTool 의 잠금 판정 그대로)
//   · 선택한 선이 절개선이면 별도 «다음 단계» 행에 «파트 분리»(2026-11-05 김님 요청) — 오른쪽 «파트 분리»와 **같은 판정**
//     (designLineTool.getSplitState = syncSplitButton 이 마지막으로 쓴 판정 · 재판정 없음)과 **같은 명령**(doSplit).
//     불가면 비활성 + 보이는 짧은 이유(무효 절개선 · 최종 몸판 미확정 · 파생 몸판 미지원 · 앞/뒤판 아님). 분리되면 «분리됨 · 파트 N개».
//   · 선택한 선이 외곽이면 별도 «다음 단계» 행에 «외곽 대체 미리보기»(2026-11-06 김님 «외곽 선택하면 외곽 대체 미리보기가 있어야지»)
//     — 오른쪽 «외곽 대체 미리보기»와 같은 판정(designLineTool.getBoundaryState = syncBoundaryStatus 가 마지막으로 쓴 판정)·같은 명령(doBoundaryPreview).
//     불가면 비활성 + 이유(무효 · 판정 보류 · 별도 소매 조각 없음 · 파생 몸판 미지원 · 카라). 보이면 «미리보기 표시 중»(완성 외곽 아님). 보조선 = 다음 단계 없음.
//
// 계약(제품 엔진 불변):
//   · 상태를 새로 갖지 않는다 — 매 render 직후 designLineTool 의 공개 상태(getMode·getDraft·getSelectedId·findLine·
//     canFinishDraw·잠금 판정)를 읽어 보이기만 한다. 저장 상태·선 생성·자동 역할 지정 없음.
//   · 버튼은 기존 명령만 부른다: finishDraw · cancel(= 오른쪽 «그리기 취소»와 같은 setMode("off")) · setRole.
//     오른쪽 버튼·id·단축키(Enter·Esc·Backspace·Delete)는 그대로이고, 둘 다 같은 명령이라 자동 동기화된다.
//   · UI 상태: «접기(×)» = 지금 선택한 선에 대해서만 막대를 접는다(선·선택 무변경). 캔버스를 다시 누르면 풀린다.
//     «도구»(소형 상태줄 → 전체 막대, 2026-11-05) = 분리 결과 확인용 상태줄을 그 결과에 대해서만 펼친다. 선택·결과 변화·캔버스 누름에 풀린다.
//   · 위치(2026-11-11 김님 «애플같이 아래에 고정» — 선 근처·가장자리 dock 배치 대체): 선택 패널·그리기 패널이 **같은 하단 고정 자리**를 쓴다
//     (데스크톱 = 사이드바를 뺀 캔버스 하단 가운데 폭 제한 카드 · 좁은 화면 = 하단 시트 + safe-area). 자리는 CSS 만 정하고 JS 는 좌표를 쓰지 않는다.
//     선 근처 후보·좌우 flip·커서 추종·상단 회피 없음. 가려진 부분은 기존 팬으로 옮겨 본다(형상·저장 좌표 무변경).
//   · 캔버스 위 드래그(곡선 핸들·앵커 이동·팬·핀치) 중에는 패널을 그대로 두고(숨기지 않음), 손을 떼면 내용만 한 번 갱신한다.
//   · 막대는 #cv 의 형제(SVG 밖) → 막대 클릭은 캔버스 점 추가·피스 드래그로 전파되지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const PIECE_LABEL = { front: "앞판", back: "뒤판", sleeve: "소매", collar: "카라" };
  const LOCK_TITLE = { neck: "네크라인 전용선 · 역할 고정", cap: "소매산 관리선 · 역할 고정", collar: "칼라 본체 관리선 · 역할 고정" };
  const PAD = 12;        // 가림 판정 여유(막대 사각형을 이만큼 키워 점이 들어오면 «가림»)
  const DRAG_PX = 4;     // 이 이상 움직이면 캔버스 드래그로 본다(패널 자리·행 구성 고정 · designLineTool DRAG_PX 와 같은 값)
  const FIT_RATIO = 0.25; // 접힌 패널 높이 예산 = 캔버스 높이의 25%(2026-11-11 김님 리뷰 «20~25% 이내»)
  const ROLE_LABEL = { cut: "절개선", boundary: "외곽", guide: "보조선" };
  const EDIT_NOTE = "편집 중 · 손을 떼면 다시 검사합니다";   // 드래그 중: 놓을 때만 확정되는 판정은 현재값인 척 보이지 않는다

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
      const bs = (!lock && role === "boundary" && s.sel.boundary && !(s.sel.reflect && s.sel.reflect.done)) ? s.sel.boundary : null;   // 몸판 외곽에 이미 반영된 선은 «대체 미리보기» 단계가 필요 없다(반영 = 합성까지 한 번에)   // 외곽만 · 관리선(네크라인 전용선 등)은 잠금 그대로
      // 단계(2026-11-06 소매 «외곽 반영»): preview(미리보기 전) → confirm(미리보기 확인 · 소매만 «외곽 반영») → applied(반영됨 · 수정 중 → «소매 모양 완료» 안내).
      //   몸판은 apply 가 없어 종전 그대로(preview·미리보기 표시 중).
      const stage = bs ? (bs.applied ? "applied" : (bs.shown && bs.apply) ? "confirm" : "preview") : null;
      const boundary = bs ? { allowed: !!bs.allowed, kind: bs.kind, shown: !!bs.shown, stage: stage,
        apply: bs.apply ? { allowed: !!bs.apply.allowed, reason: bs.apply.reason } : null, undo: !!bs.edit,
        text: stage === "applied" ? (bs.edit && bs.edit.pending ? "반영됨 · 수정 중 — 다 고치면 «소매 모양 완료»" : "반영됨 · 소매 외곽의 일부")
          : stage === "confirm" ? (bs.apply.allowed ? "미리보기 확인 · «외곽 반영»을 눌러야 소매에 반영됩니다" : "반영 불가 · " + bs.apply.reason)
          : bs.allowed ? (bs.shown ? "미리보기 표시 중 · 보라 외곽(완성 외곽 아님)" : bs.reason) : "대체 불가 · " + bs.reason } : null;
      // 옆선 행(2026-11-08): 권위 계측 숫자 + 몸판 완료 차단 사유·완료 버튼만(자동 길이 맞춤·자석·여유 설정 없음).
      const seam = (!lock && role === "boundary" && s.sel.seam && s.sel.seam.show) ? { text: s.sel.seam.text, bodice: s.sel.bodice || null } : null;
      const rf = (!lock && s.sel.reflect && !s.sel.reflect.done) ? { allowed: !!s.sel.reflect.allowed, text: s.sel.reflect.reason } : null;   // 몸판 외곽으로 반영(앞·뒤판 일반 선 · 아직 미반영일 때)
      return { kind: "select", reflect: rf, seam: seam, key: "sel:" + s.sel.id, title: lock ? LOCK_TITLE[lock] : "선택한 선 · " + (PIECE_LABEL[s.sel.piece] || s.sel.piece), role: role, locked: !!lock, split: split, boundary: boundary };
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

  // ── 순수: 하단 고정 패널 가림 수(2026-11-11 김님 «애플같이 아래에 고정») ──
  // 자리는 계산하지 않는다(CSS 가 캔버스 하단 가운데에 고정). 여기서는 «고정 패널 사각형이 가리는 점 수»만 센다 —
  // 분리 결과가 생긴 순간 전체 패널이 파트를 덮으면 소형 상태줄로 시작할지(chooseMode)를 정하는 데만 쓴다.
  // rect = {l,t,r,b}, pts = [{x,y}] (같은 좌표계) → 정수
  function coverCount(rect, pts) {
    if (!rect) return 0; let n = 0;
    (pts || []).forEach(q => { if (q.x >= rect.l - PAD && q.x <= rect.r + PAD && q.y >= rect.t - PAD && q.y <= rect.b + PAD) n++; });
    return n;
  }

  // ── DOM ──

  let drawHintEl = null, failsEl = null, completeBtn = null, failsDetailEl = null;
  // «더보기/접기»(2026-11-11 iOS 메뉴형 정리): 선택 막대는 기본으로 «지금 단계 주 작업 1개 + 한 줄 상태»만 보이고,
  //   보조 작업(다른 다음 단계 행·완료 버튼)·긴 안내 전문·완료 차단 사유 전체는 명시적 «더보기»를 눌렀을 때만 펼친다(UI 전용 · 그 선 동안만).
  let moreBtn = null, moreKey = null;

  let modeMemo = null;                 // {key, sig, mode}: 같은 선·같은 결과/펼침 동안 전체/소형 형태를 한 번만 정한다(자리는 CSS 고정)
  let bar = null, titleEl = null, dismissBtn = null, drawRow = null, roleRow = null, finishBtn = null, cancelBtn = null, roleBtns = [];
  let splitRow = null, splitBtn = null, splitReason = null;
  let bndRow = null, bndBtn = null, bndReason = null, bndApply = null, bndUndo = null, seamRow = null, seamText = null;
  let rflRow = null, rflBtn = null, rflReason = null;
  let rflNote = null;
  let headRow = null, compactRow = null, compactText_ = null, expandBtn = null;
  let expandedKey = null;             // 소형 상태줄에서 «도구»로 펼친 결과 키(UI 전용 · 선택·결과가 바뀌거나 캔버스를 누르면 풀림)
  let splitNote = null;                // {key, text}: 막대 «파트 분리»를 눌렀는데 파트가 안 생겼을 때 doSplit 이 남긴 안내(#designSplitNote) — 선택이 바뀌면 버림
  let bndNote = null;                  // {key, text}: 막대 «외곽 대체 미리보기»를 눌렀는데 미리보기가 안 생겼을 때 doBoundaryPreview 가 남긴 안내(#designBoundaryNote)
  let dismissedKey = null;            // «접기(×)» 한 선택 키(UI 전용)
  let press = null, dragging = false;  // 캔버스 위 누름·드래그 상태

  function tool() { return window.designLineTool || null; }
  // 몸판 완료 게이트(권위 check 그대로 · 모든 차단 사유) — 옆선 행에서 «무엇이 남았나»를 정직하게 보이기 위해.
  function bodiceGate() {
    const BC = window.bodiceCheckpoint, W = window.designWorkflow, p = W && W.current ? W.current() : null;
    if (!BC || !p) return null;
    const c = BC.check(p), latest = BC.latest ? BC.latest(p) : null;
    const pending = !latest || (BC.isCurrentBodiceChanged && BC.isCurrentBodiceChanged(p));
    return { ok: !!c.ok, fails: (c.fails || []).slice(), pending: !!pending };
  }
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
      const seamSt = T.getSeamState ? T.getSeamState() : null;   // 옆선 행이 있을 때만 완료 게이트를 계산(매 render 비용 최소)
      return { design: true, mode: mode, sel: { id: id, piece: l.piece, role: l.role || "guide", lock: lock, split: T.getSplitState ? T.getSplitState() : null, boundary: T.getBoundaryState ? T.getBoundaryState() : null, seam: seamSt, reflect: T.getReflectState ? T.getReflectState() : null,
        bodice: (!dragging && seamSt) ? bodiceGate() : null } };
    }
    return { design: true, mode: mode };
  }

  // 화면에 그려진 대상(2026-11-11 하단 고정): 자리 계산에는 쓰지 않는다. 대상이 그려져 있는지(없으면 패널도 없음)와,
  // 소형/전체 판정용 «분리·외곽 대체 결과 외곽 점»(canvas-wrap 기준 px)만 본다. 화면 밖으로 팬해도 패널은 그대로 보인다.
  function collectTargets(kind, wrapRect) {
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (!cv) return null;
    const drawn = kind === "draw" ? !!cv.querySelector(".design-line-vertex")
      : !!(cv.querySelector("path.design-line.selected") || cv.querySelector(".design-line-anchor"));
    if (!drawn) return null;
    const local = (el, x, y) => { const m = el.getScreenCTM && el.getScreenCTM(); if (!m) return null; return { x: m.a * x + m.c * y + m.e - wrapRect.left, y: m.b * x + m.d * y + m.f - wrapRect.top }; };
    const pathPts = (p, out) => {
      let L = 0; try { L = p.getTotalLength(); } catch (_) { return; }
      const n = Math.max(16, Math.min(120, Math.ceil(L / 8)));
      for (let i = 0; i <= n; i++) { const q = p.getPointAtLength(L * i / n); const r = local(p, q.x, q.y); if (r) out.push(r); }
    };
    let pts = null;   // 필요할 때만(결과 형태를 정할 때) 계산
    const obstacles = () => {
      if (pts) return pts; pts = [];
      cv.querySelectorAll('[data-design-root="parts"] path, [data-design-root="boundary"] path').forEach(pp => pathPts(pp, pts));
      return pts;
    };
    return { cv: cv, obstacles: obstacles };
  }

  function hide() { if (bar && !bar.hidden) bar.hidden = true; }

  function sync() {
    if (!bar) return;
    const vm = describe(snapshot());
    if (!vm || vm.kind !== "select") modeMemo = null;   // 선택이 끝나면(해제·그리기) 형태 기억을 버린다
    if (!vm || vm.kind !== "select" || (moreKey && moreKey !== vm.key)) moreKey = null;   // 선택이 끝나거나 다른 선이면 «더보기» 펼침 해제
    // 캔버스 드래그·팬·핀치 중에는 패널을 그대로 둔다(숨기지도 다시 그리지도 않음 — 하단 고정이라 움직일 이유가 없다). 손을 떼면 한 번 갱신.
    //   2026-11-11: 단, 같은 대상이면 글자만 현재값으로(옆선 실시간 길이) — 행 숨김·형태·자리는 그대로(포커스·드래그 안 끊김).
    if (dragging && vm && !bar.hidden) { liveText(vm); return; }
    if (!vm || (vm.kind === "select" && dismissedKey === vm.key)) { hide(); return; }
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
    if (vm.kind !== "select") { splitRow.hidden = true; if (bndRow) bndRow.hidden = true; if (rflRow) rflRow.hidden = true; }
    if (rflRow && vm.kind === "select") {
      const rf = vm.reflect; rflRow.hidden = !rf;
      if (rf) {
        if (rflNote && rflNote.key !== vm.key) rflNote = null;
        rflBtn.disabled = !rf.allowed; rflBtn.setAttribute("aria-disabled", rf.allowed ? "false" : "true");
        rflReason.textContent = (rflNote && rf.allowed) ? rflNote.text : rf.text;
        rflRow.setAttribute("data-state", (rflNote && rf.allowed) ? "no" : rf.allowed ? "ok" : "no");
      }
    }
    if (seamRow) {   // 옆선 행(2026-11-08): 몸판 외곽이 옆선 구간을 대체할 때만 · 권위 계측 숫자 + 완료 차단 사유
      const sm = vm.kind === "select" ? vm.seam : null; seamRow.hidden = !sm;
      if (sm) { seamText.textContent = sm.text; seamRow.setAttribute("data-state", sm.bodice && sm.bodice.ok ? "ok" : "no"); renderGate(sm.bodice); }
    }
    dismissBtn.hidden = vm.kind !== "select";        // 그리기 중엔 접기 없음(완료·취소만 명시적으로)
    if (vm.kind === "draw") {
      finishBtn.disabled = !vm.canFinish; finishBtn.setAttribute("aria-disabled", vm.canFinish ? "false" : "true");
      if (vm.canFinish) finishBtn.removeAttribute("title"); else finishBtn.setAttribute("title", "서로 다른 점을 2개 이상 찍으면(또는 곡선을 드래그하면) 누를 수 있습니다");
      if (drawHintEl) { const T = tool(); drawHintEl.textContent = (T && T.getDrawHint && T.getDrawHint()) || ""; }
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
      // 주 작업 1개(2026-11-11): 보이는 다음 단계 행 중 첫 행(반영 > 파트 분리 > 외곽 대체) = 주 작업. 나머지 행과(주 작업이 따로 있을 때의)
      //   «몸판 모양 완료»는 보조 작업 → «더보기»에서만. 기능 삭제·가짜 비활성화 없음(같은 버튼·같은 명령이 펼치면 그대로 보인다).
      const open = moreKey === vm.key;
      const nexts = [rflRow, splitRow, bndRow].filter(r => r && !r.hidden);
      const primary = nexts[0] || null;
      nexts.forEach(r => { r.setAttribute("data-tier", r === primary ? "main" : "more"); if (r !== primary && !open) r.hidden = true; });
      let extra = nexts.length > 1;
      if (seamRow && !seamRow.hidden && completeBtn && !completeBtn.hidden && primary) { extra = true; if (!open) completeBtn.hidden = true; }
      if (failsDetailEl) { const has = !!failsDetailEl.textContent; failsDetailEl.hidden = !(open && has); if (has) extra = true; }
      bar.setAttribute("data-more", open ? "open" : "closed");
      moreBtn && moreBtn.setAttribute("data-extra", extra ? "1" : "0");
    }
    if (vm.kind !== "select") bar.removeAttribute("data-more");
    if (moreBtn && vm.kind !== "select") moreBtn.hidden = true;   // 선택 막대에서 보일지는 배치 측정 때(잘린 안내가 있는지) 정한다 — 중간에 숨기면 포커스가 빠진다

    // 하단 고정 패널(2026-11-11 김님 «애플같이 아래에 고정»): 자리 = CSS(캔버스 하단 가운데 · 모바일 = 하단 시트)만 정한다.
    //   JS 는 left/top/transform 을 쓰지 않는다 — 드래그·팬·줌·선 이동·반영/상태 변화에도 x·bottom 이 그대로다.
    //   선 근처 후보·좌우 flip·커서 추종·상단 회피·가장자리 dock 이동 없음. «더보기»는 같은 아래 기준점에서 위로 펼친다(CSS max-height + 내부 스크롤).
    const wasHidden = bar.hidden;
    if (wasHidden) { bar.style.visibility = "hidden"; bar.hidden = false; }
    if (moreBtn && vm.kind === "select") {   // 보조 작업이 있거나 한 줄로 잘린 안내가 있을 때만 «더보기»(펼친 동안엔 «접기»)
      const open = moreKey === vm.key;
      const cut = !open && Array.prototype.some.call(bar.querySelectorAll(".lqb-next:not([hidden]) .lqb-reason"), el => el.offsetParent && el.scrollWidth > el.clientWidth + 1);
      moreBtn.hidden = !(open || cut || moreBtn.getAttribute("data-extra") === "1");
      moreBtn.textContent = open ? "접기" : "더보기";
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      moreBtn.setAttribute("aria-label", open ? "보조 작업·전체 안내 접기" : "보조 작업·전체 안내 더보기");
    }
    bar.setAttribute("data-place", "bottom");
    if (vm.kind === "draw") {
      setCompact(false, vm); bar.setAttribute("data-mode", "full");
    } else {
      const rk = resultKey(vm);
      if (expandedKey && expandedKey !== rk) expandedKey = null;   // 다른 선·다른 결과(무효화·재분리)면 펼침 해제
      // 형태(전체/소형)는 결과·펼침이 바뀔 때만 한 번 정한다: 분리 결과가 생겼는데 전체 패널이 파트를 덮으면 소형 상태줄로 시작(«도구»로 복귀).
      const sig = (rk || "") + "|" + (expandedKey || "");
      if (!modeMemo || modeMemo.key !== vm.key || modeMemo.sig !== sig) {
        setCompact(false, vm);
        const r = bar.getBoundingClientRect();
        const hits = rk ? coverCount({ l: r.left - wr.left, t: r.top - wr.top, r: r.right - wr.left, b: r.bottom - wr.top }, tg.obstacles()) : 0;
        modeMemo = { key: vm.key, sig: sig, mode: chooseMode(vm, hits, expandedKey) };
      }
      setCompact(modeMemo.mode === "compact", vm);
      bar.setAttribute("data-mode", modeMemo.mode);
    }
    applyFit(vm, wrap);
    bar.style.visibility = "";

    // 포커스가 막대 안에 있었는데 그 버튼이 숨겨졌으면(완료 → 역할 단계) 지금 단계의 주 버튼으로 옮긴다.
    if (hadFocus && !bar.contains(document.activeElement)) focusPrimary(vm);
    else if (hadFocus && document.activeElement && document.activeElement.closest("[hidden]")) focusPrimary(vm);
  }
  // 드래그 중 글자 갱신(2026-11-11): 행 구성·숨김·형태는 손대지 않는다. 실시간 계측(옆선 live)만 현재값,
  //   손을 떼야 확정되는 판정(분리·외곽 대체·반영 가능 여부·몸판 완료 검사)은 «편집 중»으로 표시(이전 판정을 현재값처럼 두지 않음).
  function liveText(vm) {
    if (bar.getAttribute("data-kind") !== vm.kind) return;
    const T = tool(), editing = vm.kind === "select" && !!(T && T.isEditDragging && T.isEditDragging());
    if (vm.kind === "draw") {
      if (bar.getAttribute("data-fit") !== "dense") titleEl.textContent = vm.title;
      finishBtn.disabled = !vm.canFinish; finishBtn.setAttribute("aria-disabled", vm.canFinish ? "false" : "true");
      return;
    }
    if (!editing) return;                              // 화면 이동·핀치 = 값 변화 없음 → 글자도 그대로
    const live = vm.seam && T.getSeamLive && T.getSeamLive();
    if (seamRow && !seamRow.hidden) {
      if (live) seamText.textContent = vm.seam.text;  // getSeamState(live) = 같은 길이 함수의 실시간 값
      failsEl.textContent = EDIT_NOTE;
      seamRow.setAttribute("data-state", "editing");
    }
    [[rflRow, rflReason], [splitRow, splitReason], [bndRow, bndReason]].forEach(([row, el]) => {
      if (row && el && !row.hidden) { el.textContent = EDIT_NOTE; row.setAttribute("data-state", "editing"); }
    });
    if (bar.getAttribute("data-fit") === "dense") titleEl.textContent = vm.title + " · " + EDIT_NOTE;
  }
  // 접힌 패널 높이 맞춤(2026-11-11 김님 리뷰 «접힌 패널 = 캔버스 높이 20~25%»): 버튼을 잘라내거나 max-height 로 감추지 않는다.
  //   full(종전) → lean(역할 선택·옆선 상세를 «더보기»로 · 머리줄에 현재 역할 표시) → dense(한 줄 안내 + 주 작업 버튼·더보기·닫기 한 줄).
  //   주 작업 = 보이는 다음 단계 첫 행(반영·분리·외곽 대체) · 없으면 옆선 행(몸판 완료) · 그것도 없으면 역할 선택.
  //   «더보기» 펼침·소형 상태줄은 대상 아님(펼침 = 종전 위로 열림 + 내부 스크롤). 드래그 중에는 다시 정하지 않는다(sync 조기 반환).
  function applyFit(vm, wrap) {
    bar.removeAttribute("data-fit");
    const H = wrap.clientHeight;
    if (!(H > 0) || bar.getAttribute("data-mode") === "compact" || bar.getAttribute("data-more") === "open") return;
    const budget = H * FIT_RATIO, fits = () => bar.scrollHeight <= budget + 0.5;
    if (fits()) return;
    let cap = vm.title;
    if (vm.kind === "select") {
      const primary = bar.querySelector('.lqb-next[data-tier="main"]:not([hidden])');
      const main = primary || (seamRow && !seamRow.hidden ? seamRow : roleRow);
      let folded = false;
      if (roleRow !== main && !roleRow.hidden) { roleRow.hidden = true; folded = true; cap += " · 역할 " + (ROLE_LABEL[vm.role] || vm.role); }
      if (seamRow && seamRow !== main && !seamRow.hidden) { seamRow.hidden = true; folded = true; }
      if (folded && moreBtn) { moreBtn.setAttribute("data-extra", "1"); moreBtn.hidden = false; }
      titleEl.textContent = cap;
      bar.setAttribute("data-fit", "lean");
      if (fits()) return;
      // 옆선 행이 주 작업이면 몸판 완료 상태(막힘·가능)를 먼저 — 한 줄로 줄여도 «왜 완료가 안 되나»가 보이게.
      const why = main === seamRow ? [failsEl, seamText].map(el => el && !el.hidden ? el.textContent : "").filter(Boolean).join(" · ")
        : main && Array.prototype.map.call(main.querySelectorAll(".lqb-reason"), el => (el.hidden ? "" : el.textContent)).filter(Boolean)[0];
      if (why) cap += " · " + why;   // dense: 행 안 안내는 한 줄 머리말로 옮긴다(잘려도 «더보기»에서 전문)
    } else if (vm.kind === "draw" && drawHintEl && drawHintEl.textContent) cap += " · " + drawHintEl.textContent;
    titleEl.textContent = cap;
    bar.setAttribute("data-fit", "dense");
    if (fits()) return;
    // 낮은 가로 화면(예: 640×320 — 2줄 dense 도 25% 초과): 안내·주 작업·더보기/닫기를 한 줄로. 안내 칸이 너무 좁아지면(<96px) dense 유지.
    bar.setAttribute("data-fit", "row");
    if (fits() && titleEl.clientWidth >= 96 && bar.scrollWidth <= bar.clientWidth + 1) return;
    bar.setAttribute("data-fit", "dense");
  }
  // 소형 상태줄 켜기/끄기 — 전체 막대의 행은 그대로 두고 보이기만 바꾼다(요소 재생성 없음).
  function setCompact(on, vm) {
    if (!compactRow) return;
    if (on) {
      const t = compactText(vm);
      compactText_.textContent = t;
      headRow.hidden = true; roleRow.hidden = true; splitRow.hidden = true; if (seamRow) seamRow.hidden = true; if (bndRow) bndRow.hidden = true; if (rflRow) rflRow.hidden = true; drawRow.hidden = true; compactRow.hidden = false;
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
  // 막대 «몸판 외곽으로 반영»(버튼 click 이 부르는 그대로 · 검사도 이 함수를 부른다). 실패면 이유를 막대에도(원자적 — 몸판 불변).
  function actReflect() {
    const T = tool(), vm = describe(snapshot()); if (!T || !vm || !vm.reflect || !vm.reflect.allowed || !T.doReflectToBodice) return false;
    const done = !!T.doReflectToBodice();
    const el = typeof document !== "undefined" ? document.getElementById("designComposeNote") : null;
    rflNote = done ? null : { key: vm.key, text: (el && el.textContent) || "반영되지 않았습니다" };
    sync(); return done;
  }
  // 몸판 완료 차단 사유 전부 + 완료 가능하면 «몸판 모양 완료»(오른쪽과 같은 명령). 자동 보정 설정으로 돌려보내지 않는다.
  function renderGate(gate) {
    if (!failsEl || !completeBtn) return;
    const ok = !!(gate && gate.ok), pend = !!(gate && gate.pending);
    completeBtn.hidden = !(ok && pend);
    const F = window.bodiceFailText || (x => x);
    // 한 줄 상태(기본) + 차단 사유 전문(«더보기»에서만 · 2026-11-11 — 390 에서 막대가 캔버스 대부분을 덮던 원인 중 하나)
    // 2026-11-11: 사유가 비어 있는데 막힘이면 «0건»·빈 목록 대신 검사 결과 그대로(게이트 완화 없음 — 완료 버튼은 계속 숨김).
    const fl = gate && !gate.ok ? (gate.fails || []).filter(f => f != null && f !== "") : [];
    failsEl.textContent = !gate ? (dragging ? EDIT_NOTE : "") : gate.ok ? (pend ? "몸판 완료 가능" : "몸판 완료됨")
      : fl.length ? "몸판 완료 막힘 " + fl.length + "건" : "몸판 완료 막힘 · 검사가 사유를 돌려주지 않음 — 오른쪽 몸판 패널에서 확인";
    if (failsDetailEl) failsDetailEl.textContent = fl.map(f => F(f) + (FAIL_ACT[f] ? " → " + FAIL_ACT[f] : "")).join(" · ");
  }
  // 막대에서 바로 할 수 있는 조치(문구만 · 자동 수정 없음). 없는 사유는 이름만 보인다(오른쪽 몸판 패널에서 처리).
  const FAIL_ACT = {
    "front-outline-not-connected": "외곽으로 반영한 선의 끝점이 외곽선 위에 있지 않음 — 끝점을 외곽선(모서리 포함)에 다시 맞추거나 선을 지우세요",
    "back-outline-not-connected": "외곽으로 반영한 선의 끝점이 외곽선 위에 있지 않음 — 끝점을 외곽선(모서리 포함)에 다시 맞추거나 선을 지우세요"
  };
  function fmt(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function actCompleteBodice() { const b = document.getElementById("btnCompleteBodice"); if (!b || b.disabled) return false; b.click(); sync(); return true; }   // 오른쪽 «몸판 모양 완료»와 같은 명령
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
    seamRow = bar.querySelector('[data-lqb="seam"]'); seamText = document.getElementById("lineQuickSeamText");
    expandBtn = document.getElementById("lineQuickExpand");
    rflRow = bar.querySelector('[data-lqb="reflect"]'); rflBtn = document.getElementById("lineQuickReflect"); rflReason = document.getElementById("lineQuickReflectReason");
    drawHintEl = document.getElementById("lineQuickDrawHint");
    failsEl = document.getElementById("lineQuickBodiceFails"); completeBtn = document.getElementById("lineQuickCompleteBodice");
    failsDetailEl = document.getElementById("lineQuickBodiceFailsDetail");
    moreBtn = document.getElementById("lineQuickMore");
    if (moreBtn) moreBtn.addEventListener("click", () => { const vm = describe(snapshot()); if (!vm || vm.kind !== "select") return;
      moreKey = moreKey === vm.key ? null : vm.key; sync(); try { moreBtn.focus({ preventScroll: true }); } catch (_) { moreBtn.focus(); } });
    if (completeBtn) completeBtn.addEventListener("click", () => { actCompleteBodice(); });
    if (rflBtn) rflBtn.addEventListener("click", () => { actReflect(); });

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
    dismissBtn.addEventListener("click", () => { const vm = describe(snapshot()); if (vm && vm.kind === "select") { dismissedKey = vm.key; hide(); } });   // 닫기 = 패널만 접는다(선·선택·역할 보존) · 캔버스를 다시 누르면 같은 자리에 다시 보임

    // 캔버스 드래그 중에는 패널 내용·자리를 고정 · 손 떼면 한 번 갱신. 캔버스를 누르면 «접기» 해제(같은 선 재선택에도 다시 보임).
    const cv = (typeof svg !== "undefined" && svg) ? svg : document.getElementById("cv");
    if (cv) cv.addEventListener("pointerdown", e => { press = { x: e.clientX, y: e.clientY, id: e.pointerId }; dismissedKey = null; expandedKey = null; }, true);
    window.addEventListener("pointermove", e => {
      if (!press || dragging) return;
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_PX) dragging = true;   // 숨기지 않는다(하단 고정)
    }, true);
    const release = () => { if (!press) return; press = null; if (dragging) { dragging = false; sync(); } };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    // 캔버스 크기 변화(창·사이드바·회전)에는 render 없이도 내용(잘린 안내 «더보기» 여부)만 다시 맞춘다. 자리는 CSS 가 정한다.
    //   2026-11-11: 회전(390×844 → 844×390)에서 관찰 콜백이 중간 레이아웃으로 맞춤(applyFit)을 정해 32.8% 로 남던 것(실측) →
    //   다음 프레임(레이아웃 확정 뒤)에 한 번 다시 맞춘다. 창 resize 도 같은 경로.
    let rsRaf = 0;
    const resync = () => { if (rsRaf || typeof requestAnimationFrame !== "function") { if (!rsRaf) sync(); return; } rsRaf = requestAnimationFrame(() => { rsRaf = 0; sync(); }); };
    if (typeof ResizeObserver !== "undefined" && bar.parentElement) { const ro = new ResizeObserver(() => resync()); ro.observe(bar.parentElement); }
    window.addEventListener("resize", resync);
    sync();
  }

  window.designLineQuickBar = Object.freeze({ sync: () => { try { sync(); } catch (_) { hide(); } }, describe: describe, coverCount: coverCount, chooseMode: chooseMode, resultKey: resultKey,
    viewModel: () => describe(snapshot()), actSplit: actSplit, actBoundary: actBoundary, actBoundaryApply: actBoundaryApply, actReflect: actReflect,
    actCompleteBodice: actCompleteBodice });
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  }
})();
