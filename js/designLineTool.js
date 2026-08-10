// ══════════════════════════════════════════════
// js/designLineTool.js — Design 패턴선 도구(직선+곡선 혼합 연속선).
//
// 동작 계약(사용자 잠금):
//  · 클릭: 모서리 점 → 그 점으로 들어오는 세그먼트는 **직선(line)**
//  · 클릭 후 드래그: 곡선 점 + 베지어 핸들 → 그 점으로 들어오는 세그먼트는 **곡선(cubic)**
//  · 하나의 patternLine 안에 line·cubic 세그먼트 혼합 가능
//  · 다른 피스/빈 영역 클릭: 거부(작성 유지)
//  · 더블클릭 또는 Enter: 완료(점 2개 미만이면 불가) / Backspace: 마지막 점 취소 / Esc: 전체 취소
//  · 작성 중 선은 **preview 일 뿐** — 완료 시 한 번에 커밋
//
// 세그먼트 도출(anchor 모델): 각 anchor = { p(위치), h(핸들 벡터)|null }. 드래그가 h 를 만든다.
//  · 도착 anchor.h == null(클릭) → line { from, to }
//  · 도착 anchor.h != null(드래그) → cubic { from, c1, c2, to }
//        c1 = 출발 anchor.p + 출발.h (출발이 곡선점이면 부드럽게 이어짐, 아니면 = 출발.p)
//        c2 = 도착 anchor.p − 도착.h (드래그의 반대쪽 = 들어오는 접선)
//
// 좌표: 클릭(px) → eventToPatternPoint(도안 cm) → 피스 offset 역변환(pointToGeometryCm) →
//  형상 cm. 핸들 h 는 (드래그점 − anchor)라 offset 이 상쇄돼 순수 형상 cm 델타. from/c1/c2/to
//  모두 형상 cm 로 working.patternLines 에 저장(geometry 와 분리 → 재계산·이동에 불변).
//
// 이번 단계 제외: 완성된 선의 재편집·삭제·스냅.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const DRAG_PX = 4;          // 이 픽셀 미만 이동은 클릭(모서리), 이상은 드래그(곡선 핸들)
  const EPS = 1e-9;
  let active = false, draft = null, dragging = null;   // draft={piece,anchors:[{p,h}]}, dragging={startX,startY}

  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function inDesign() { return typeof window.isDesignStageActive === "function" && window.isDesignStageActive() && !!project(); }
  function isActive() { return active; }
  // render.js preview 용: anchors(위치+핸들 복사) + 도출 segments.
  function getDraft() {
    if (!draft) return null;
    return {
      piece: draft.piece,
      anchors: draft.anchors.map(a => ({ p: { x: a.p.x, y: a.p.y }, h: a.h ? { x: a.h.x, y: a.h.y } : null })),
      segments: segmentsFromAnchors(draft.anchors)
    };
  }

  // ── 순수(harness) ──
  function pointToGeometryCm(drawCmX, drawCmY, off) { return { x: drawCmX - off.dx, y: drawCmY - off.dy }; }
  function geometryToDrawCm(geo, off) { return { x: geo.x + off.dx, y: geo.y + off.dy }; }
  // anchors → line/cubic 세그먼트. 도착 anchor 의 핸들 유무가 세그먼트 타입을 정한다.
  function segmentsFromAnchors(anchors) {
    const segs = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (!b.h) {
        segs.push({ kind: "line", from: { x: a.p.x, y: a.p.y }, to: { x: b.p.x, y: b.p.y } });
      } else {
        const c1 = a.h ? { x: a.p.x + a.h.x, y: a.p.y + a.h.y } : { x: a.p.x, y: a.p.y };
        const c2 = { x: b.p.x - b.h.x, y: b.p.y - b.h.y };
        segs.push({ kind: "cubic", from: { x: a.p.x, y: a.p.y }, c1: c1, c2: c2, to: { x: b.p.x, y: b.p.y } });
      }
    }
    return segs;
  }
  function makePatternLine(id, piece, anchors) { return { id: id, piece: piece, segments: segmentsFromAnchors(anchors) }; }
  function nextId(lines) { let m = 0; lines.forEach(l => { const x = /^line-(\d+)$/.exec(l.id); if (x) m = Math.max(m, +x[1]); }); return "line-" + (m + 1); }

  // ── DOM 연동 ──
  function pieceOffset(piece) { const L = window.designLayout ? window.designLayout.ensureLayout(project()) : null; return (L && L[piece]) ? L[piece] : { dx: 0, dy: 0 }; }
  function pieceAt(target) { const h = target && target.closest && target.closest(".design-layout-hit"); return h ? h.getAttribute("data-layout-piece") : null; }
  function geoAt(e, piece) { const [dx, dy] = eventToPatternPoint(e); return pointToGeometryCm(dx, dy, pieceOffset(piece)); }
  function ensurePatternLines(p) { if (!Array.isArray(p.working.patternLines)) p.working.patternLines = []; return p.working.patternLines; }
  function setNote(m) { const el = document.getElementById("designLineNote"); if (el) el.textContent = m; }
  function syncButton() { const b = document.getElementById("btnDesignLine"); if (b) { b.textContent = active ? "그리기 종료" : "선·곡선 그리기"; b.setAttribute("aria-pressed", active ? "true" : "false"); } }
  function rerender() { if (typeof render === "function") render(); }
  const START_NOTE = "클릭=직선 점 · 드래그=곡선 · 더블클릭/Enter 완료";

  function toggle() { active = !active; draft = null; dragging = null; setNote(active ? "첫 점을 클릭(또는 드래그)하세요" : ""); syncButton(); rerender(); }
  function cancel() { draft = null; dragging = null; setNote(active ? "취소됨 · 첫 점을 다시 찍으세요" : ""); rerender(); }   // Esc

  function commit() {
    if (!draft || draft.anchors.length < 2) { setNote("점 2개 이상 필요"); return false; }
    const p = project(); const lines = ensurePatternLines(p);
    lines.push(makePatternLine(nextId(lines), draft.piece, draft.anchors));
    draft = null; dragging = null; setNote("완료 · 새 선은 다시 첫 점부터"); rerender(); return true;
  }
  function backspace() {   // 마지막 점 하나 취소
    if (!draft || draft.anchors.length === 0) return;
    draft.anchors.pop();
    if (draft.anchors.length === 0) { draft = null; setNote("첫 점을 찍으세요"); }
    else setNote(START_NOTE);
    dragging = null; rerender();
  }

  if (typeof svg !== "undefined" && svg) {
    svg.addEventListener("pointerdown", e => {
      if (!active || e.button !== 0 || !inDesign()) return;
      const piece = pieceAt(e.target);
      if (!draft) {
        if (!piece) { setNote("피스 위를 클릭하세요"); return; }
        draft = { piece: piece, anchors: [{ p: geoAt(e, piece), h: null }] };   // 첫 점 + piece 확정
        setNote(START_NOTE);
      } else if (piece !== draft.piece) {
        setNote("같은 피스 안에서 이어 그리세요"); return;   // 다른 피스/빈 영역 거부 → 작성 유지
      } else {
        draft.anchors.push({ p: geoAt(e, piece), h: null });   // 같은 피스에 점 추가
        setNote(START_NOTE);
      }
      dragging = { startX: e.clientX, startY: e.clientY };      // 드래그 시 핸들 생성 추적
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      e.stopPropagation();
      rerender();
    });
    svg.addEventListener("pointermove", e => {
      if (!active || !dragging || !draft) return;
      const anchor = draft.anchors[draft.anchors.length - 1];
      const dist = Math.hypot(e.clientX - dragging.startX, e.clientY - dragging.startY);
      if (dist > DRAG_PX) {                                     // 드래그 → 베지어 핸들(형상 cm 델타)
        const g = geoAt(e, draft.piece);
        anchor.h = { x: g.x - anchor.p.x, y: g.y - anchor.p.y };
      } else {
        anchor.h = null;                                       // 아직 클릭 수준 → 모서리 유지
      }
      rerender();
    });
    const endDrag = e => {
      if (dragging) {
        const anchor = draft && draft.anchors[draft.anchors.length - 1];
        if (anchor && anchor.h && Math.hypot(anchor.h.x, anchor.h.y) < EPS) anchor.h = null;
        dragging = null;
        try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {}
        rerender();
      }
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    // 더블클릭 완료: 두 번째 down 이 만든 중복 anchor 제거 후 커밋.
    svg.addEventListener("dblclick", e => {
      if (!active || !draft) return;
      draft.anchors.pop();
      commit();
      e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener("keydown", e => {
      if (!active || !inDesign()) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;   // 입력 필드 방해 금지
      if (e.key === "Escape") cancel();
      else if (e.key === "Enter" && draft) { e.preventDefault(); commit(); }
      else if (e.key === "Backspace" && draft) { e.preventDefault(); backspace(); }
    });
  }

  window.designLineTool = Object.freeze({
    toggle, cancel, commit, backspace, isActive, getDraft,
    pointToGeometryCm, geometryToDrawCm, segmentsFromAnchors, makePatternLine, nextId
  });
})();
