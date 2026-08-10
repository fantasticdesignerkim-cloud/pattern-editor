// ══════════════════════════════════════════════
// js/designLineTool.js — Design 패턴선 도구(연속선 polyline 생성).
//
// 동작 계약(사용자 잠금):
//  · 첫 클릭: 시작점과 piece 확정
//  · 이후 클릭: 같은 피스에 점 + line segment 추가
//  · 다른 피스/빈 영역 클릭: 거부하고 작성 상태 유지
//  · 더블클릭 또는 Enter: 현재 연속선 완료(점 2개 미만이면 완료 불가)
//  · Backspace: 마지막 점 하나 취소
//  · Esc: 미완성 연속선 전체 취소
//  · 완성된 polyline = patternLines 항목 하나 + 여러 segments
//  · 작성 중 선은 **preview 일 뿐** — 완료 전 working.patternLines 에 커밋하지 않는다.
//
// 핵심 원칙(직선 도구에서 이어짐):
//  1. 점을 찍는 순간 piece 소유권 확정(좌표로 추측 안 함).
//  2. 클릭(px) → eventToPatternPoint(도안 cm) → 그 피스 offset 을 빼서 형상 cm 로 저장
//     (pointToGeometryCm). 피스를 옮기거나 몸판을 재계산해도 선이 형상에 붙어 있다.
//  저장 위치는 working.patternLines(= working.geometry 와 분리, geometry 교체와 무관).
//
// 이번 단계 제외: 선택·점 이동·삭제·스냅·곡선 핸들.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  let active = false, draft = null;   // draft = { piece, points:[{x,y}] } 형상 cm(미커밋 preview)

  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function inDesign() { return typeof window.isDesignStageActive === "function" && window.isDesignStageActive() && !!project(); }
  function isActive() { return active; }
  // render.js preview 용: 작성 중 draft 의 복사본(형상 cm). 없으면 null.
  function getDraft() { return draft ? { piece: draft.piece, points: draft.points.map(p => ({ x: p.x, y: p.y })) } : null; }

  // ── 순수(harness) ──
  function pointToGeometryCm(drawCmX, drawCmY, off) { return { x: drawCmX - off.dx, y: drawCmY - off.dy }; }
  function geometryToDrawCm(geo, off) { return { x: geo.x + off.dx, y: geo.y + off.dy }; }
  function segmentsFromPoints(points) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) segs.push({ kind: "line", from: { x: points[i].x, y: points[i].y }, to: { x: points[i + 1].x, y: points[i + 1].y } });
    return segs;
  }
  function makePatternLine(id, piece, points) { return { id: id, piece: piece, segments: segmentsFromPoints(points) }; }
  function nextId(lines) { let m = 0; lines.forEach(l => { const x = /^line-(\d+)$/.exec(l.id); if (x) m = Math.max(m, +x[1]); }); return "line-" + (m + 1); }

  // ── DOM 연동 ──
  function pieceOffset(piece) { const L = window.designLayout ? window.designLayout.ensureLayout(project()) : null; return (L && L[piece]) ? L[piece] : { dx: 0, dy: 0 }; }
  function pieceAt(target) { const h = target && target.closest && target.closest(".design-layout-hit"); return h ? h.getAttribute("data-layout-piece") : null; }
  function ensurePatternLines(p) { if (!Array.isArray(p.working.patternLines)) p.working.patternLines = []; return p.working.patternLines; }
  function setNote(m) { const el = document.getElementById("designLineNote"); if (el) el.textContent = m; }
  function syncButton() { const b = document.getElementById("btnDesignLine"); if (b) { b.textContent = active ? "그리기 종료" : "연속선 그리기"; b.setAttribute("aria-pressed", active ? "true" : "false"); } }
  function rerender() { if (typeof render === "function") render(); }

  function toggle() { active = !active; draft = null; setNote(active ? "첫 점을 클릭하세요 · 더블클릭/Enter 완료" : ""); syncButton(); rerender(); }
  function cancel() { draft = null; setNote(active ? "취소됨 · 첫 점을 다시 클릭하세요" : ""); rerender(); }   // Esc

  // 완료: 점 2개 이상이면 patternLine 하나(여러 segment)로 커밋. 미만이면 불가(작성 유지).
  function commit() {
    if (!draft || draft.points.length < 2) { setNote("점 2개 이상 필요"); return false; }
    const p = project(); const lines = ensurePatternLines(p);
    lines.push(makePatternLine(nextId(lines), draft.piece, draft.points));
    draft = null; setNote("연속선 완료 · 새 선은 다시 첫 점부터"); rerender(); return true;
  }
  function backspace() {   // 마지막 점 하나 취소
    if (!draft || draft.points.length === 0) return;
    draft.points.pop();
    if (draft.points.length === 0) { draft = null; setNote("첫 점을 클릭하세요"); }
    else setNote("점 취소됨 · 이어 클릭 또는 더블클릭/Enter");
    rerender();
  }

  if (typeof svg !== "undefined" && svg) {
    svg.addEventListener("pointerdown", e => {
      if (!active || e.button !== 0 || !inDesign()) return;
      const piece = pieceAt(e.target);
      if (!draft) {
        if (!piece) { setNote("피스 위를 클릭하세요"); return; }
        const [dx, dy] = eventToPatternPoint(e);
        draft = { piece: piece, points: [pointToGeometryCm(dx, dy, pieceOffset(piece))] };   // 첫 점 + piece 확정
        setNote("점을 이어 클릭 · 더블클릭/Enter 완료");
      } else if (piece !== draft.piece) {
        setNote("같은 피스 안에서 이어 그리세요");   // 다른 피스/빈 영역 거부 → 작성 유지
      } else {
        const [dx, dy] = eventToPatternPoint(e);
        draft.points.push(pointToGeometryCm(dx, dy, pieceOffset(piece)));   // 같은 피스에 점 추가
        setNote("이어 클릭 · 더블클릭/Enter 완료 · Backspace 취소");
      }
      e.stopPropagation();
      rerender();
    });
    // 더블클릭 완료: 두 번째 down 이 만든 중복 점을 제거한 뒤 커밋.
    svg.addEventListener("dblclick", e => {
      if (!active || !draft) return;
      draft.points.pop();
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
    pointToGeometryCm, geometryToDrawCm, segmentsFromPoints, makePatternLine, nextId
  });
})();
