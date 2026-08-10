// ══════════════════════════════════════════════
// js/designLineTool.js — Design 패턴선 도구(1차: 직선, 두 점 클릭).
//
// 핵심 원칙(사용자 계약):
//  1. 선을 만들 때부터 piece("front"|"back"|"sleeve") 소유권을 기록한다(좌표로 추측 안 함).
//  2. 현재 피스 배치 offset 을 **역변환**해 도안(형상) cm 로 저장한다:
//       화면클릭(px) → eventToPatternPoint → 도안 cm(offset 미반영)
//                    → 그 피스의 layout offset 을 **빼서** 형상 cm 로 저장.
//     그래야 피스를 다시 옮기거나 배치를 초기화해도 선이 형상에 정확히 붙어 있고,
//     렌더는 reference/working 과 같은 transform 을 타 자동 정합된다.
//
// 저장 위치: working.geometry[piece].designLines (신규 배열). 기존 outline/construction·
// golden 은 건드리지 않는다. reference 에는 없음(사용자 편집=working 전용, 세션 한정).
//
// 두 점이 서로 다른 피스면 거부(같은 피스 안에서만 한 선). geometry·저장 데이터 불변
// (working.geometry 편집은 세션 메모리, reload 시 소멸).
// ══════════════════════════════════════════════
(function () {
  "use strict";

  let active = false, pending = null;   // pending = { piece, from:{x,y}(형상 cm) }

  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function inDesign() { return typeof window.isDesignStageActive === "function" && window.isDesignStageActive() && !!project(); }
  function isActive() { return active; }

  // ── 순수(harness): 도안 cm(offset 미반영) → 형상 cm(그 피스 offset 역변환) ──
  function pointToGeometryCm(drawCmX, drawCmY, off) { return { x: drawCmX - off.dx, y: drawCmY - off.dy }; }
  // 역: 형상 cm → 도안 cm(렌더 정합 검증용). display = geo + off.
  function geometryToDrawCm(geo, off) { return { x: geo.x + off.dx, y: geo.y + off.dy }; }
  // 패턴선 1개: { id, piece, segments:[{kind:"line",from,to}] } (좌표는 형상 cm).
  function makePatternLine(id, piece, from, to) {
    return { id: id, piece: piece, segments: [{ kind: "line", from: { x: from.x, y: from.y }, to: { x: to.x, y: to.y } }] };
  }
  // 기존 id 최대치 + 1(삭제가 생겨도 충돌 없음).
  function nextId(lines) {
    let max = 0;
    lines.forEach(l => { const m = /^line-(\d+)$/.exec(l.id); if (m) max = Math.max(max, +m[1]); });
    return "line-" + (max + 1);
  }

  function pieceOffset(piece) {
    const L = window.designLayout ? window.designLayout.ensureLayout(project()) : null;
    return (L && L[piece]) ? L[piece] : { dx: 0, dy: 0 };
  }
  function pieceAt(target) {
    const hit = target && target.closest && target.closest(".design-layout-hit");
    return hit ? hit.getAttribute("data-layout-piece") : null;
  }
  // 사용자 패턴선은 geometry 가 아니라 working.patternLines 에 별도 저장(geometry 교체와 분리).
  function ensurePatternLines(p) { if (!Array.isArray(p.working.patternLines)) p.working.patternLines = []; return p.working.patternLines; }

  function setNote(msg) { const el = document.getElementById("designLineNote"); if (el) el.textContent = msg; }
  function syncButton() {
    const b = document.getElementById("btnDesignLine");
    if (b) { b.textContent = active ? "그리기 종료" : "직선 그리기"; b.setAttribute("aria-pressed", active ? "true" : "false"); }
  }

  function toggle() {
    active = !active; pending = null;
    setNote(active ? "선을 그릴 두 점을 클릭하세요(같은 피스)" : "");
    syncButton();
    if (typeof render === "function") render();
  }
  function cancel() { pending = null; setNote(active ? "취소됨 · 두 점을 다시 클릭하세요" : ""); }

  // ── 클릭: 두 점(같은 피스) → 직선 1개. offset 역변환해 형상 cm 로 저장 ──
  if (typeof svg !== "undefined" && svg) {
    svg.addEventListener("pointerdown", e => {
      if (!active || e.button !== 0 || !inDesign()) return;
      const piece = pieceAt(e.target);
      if (!piece) { setNote("피스 위를 클릭하세요"); return; }
      const p = project();
      const [dcx, dcy] = eventToPatternPoint(e);                      // 도안 cm(offset 미반영)
      const geo = pointToGeometryCm(dcx, dcy, pieceOffset(piece));    // ★ offset 역변환 → 형상 cm
      if (!pending) {
        pending = { piece: piece, from: geo };
        setNote("두 번째 점을 클릭하세요");
      } else if (pending.piece !== piece) {
        setNote("같은 피스 안에서 두 점을 찍으세요");                  // 다른 피스 거부(pending 유지)
      } else {
        const lines = ensurePatternLines(p);
        lines.push(makePatternLine(nextId(lines), piece, pending.from, geo));
        pending = null;
        setNote("선 추가됨 · 계속 그리려면 다시 두 점 클릭");
        if (typeof render === "function") render();
      }
      e.stopPropagation();   // designLayout 드래그(가드도 있음)와 이중 안전
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && active) cancel(); });
  }

  window.designLineTool = Object.freeze({ toggle, cancel, isActive, pointToGeometryCm, geometryToDrawCm, makePatternLine, nextId });
})();
