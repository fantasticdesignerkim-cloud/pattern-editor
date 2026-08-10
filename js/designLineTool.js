// ══════════════════════════════════════════════
// js/designLineTool.js — Design 패턴선 도구(그리기 + 선택·편집).
//
// 모드 분리(핵심 계약): mode ∈ {"off","draw","select"}. 그리기 모드와 선택 모드를
// 명확히 분리한다. 작성 중(draw)에는 기존 선 선택을 막는다.
//
// [draw] 클릭=직선 점 / 클릭-드래그=곡선(베지어) 점. 하나의 patternLine 에 line·cubic
//   혼합. 완료(Enter·더블클릭)·취소(Esc)·Backspace(마지막 점)·2점미만 불가·다른 피스 거부·
//   preview 미커밋. anchor 모델(p, h) → segmentsFromAnchors.
//
// [select] 선 클릭=선택 강조 / Delete·Backspace=선택 선 삭제 / 선택 선의 anchor·handle 표시 /
//   anchor 드래그=공유 이웃 세그먼트 to·from(+인접 핸들) 함께 이동 / cubic 핸들 드래그=c1·c2
//   수정 / Esc=선택 해제. 선택 상태는 **세션 UI 상태**일 뿐 working.patternLines 에 저장 안 함.
//
// 공통: 화면 클릭(px) → eventToPatternPoint(도안 cm) → 피스 offset 역변환 → 형상 cm 저장/편집.
//   working.patternLines(=geometry 와 분리). 피스 이동·엉덩이 길이 재계산에도 좌표 불변.
//   reference·geometry·다른 선 불변.
//
// 이번 단계 제외: snap(편집 완성 후 별도).
// ══════════════════════════════════════════════
(function () {
  "use strict";

  const DRAG_PX = 4;          // draw: 이 픽셀 미만 이동은 클릭(모서리), 이상은 드래그(곡선 핸들)
  const LINE_HIT_PX = 7;      // select: 선 히트 반경(px)
  const NODE_HIT_PX = 9;      // select: anchor·handle 히트 반경(px)
  const EPS = 1e-9;

  let mode = "off";
  let draft = null, drawDrag = null;                 // draw 상태
  let selectedId = null, editDrag = null;            // select 상태

  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function inDesign() { return typeof window.isDesignStageActive === "function" && window.isDesignStageActive() && !!project(); }
  function isActive() { return mode !== "off"; }     // draw·select 모두 피스 드래그(designLayout) 차단
  function getMode() { return mode; }
  function lines() { const p = project(); return (p && Array.isArray(p.working.patternLines)) ? p.working.patternLines : []; }
  function findLine(id) { return lines().filter(l => l.id === id)[0] || null; }

  // ── 순수(harness) ──
  function pointToGeometryCm(drawCmX, drawCmY, off) { return { x: drawCmX - off.dx, y: drawCmY - off.dy }; }
  function geometryToDrawCm(geo, off) { return { x: geo.x + off.dx, y: geo.y + off.dy }; }
  function segmentsFromAnchors(anchors) {
    const segs = [];
    for (let i = 0; i < anchors.length - 1; i++) {
      const a = anchors[i], b = anchors[i + 1];
      if (!b.h) segs.push({ kind: "line", from: { x: a.p.x, y: a.p.y }, to: { x: b.p.x, y: b.p.y } });
      else {
        const c1 = a.h ? { x: a.p.x + a.h.x, y: a.p.y + a.h.y } : { x: a.p.x, y: a.p.y };
        const c2 = { x: b.p.x - b.h.x, y: b.p.y - b.h.y };
        segs.push({ kind: "cubic", from: { x: a.p.x, y: a.p.y }, c1: c1, c2: c2, to: { x: b.p.x, y: b.p.y } });
      }
    }
    return segs;
  }
  function makePatternLine(id, piece, anchors) { return { id: id, piece: piece, segments: segmentsFromAnchors(anchors) }; }
  function nextId(ls) { let m = 0; ls.forEach(l => { const x = /^line-(\d+)$/.exec(l.id); if (x) m = Math.max(m, +x[1]); }); return "line-" + (m + 1); }
  // 세그먼트 배열 → anchor 점 목록(공유 끝점). anchors[0]=seg0.from, anchors[k]=seg[k-1].to.
  function anchorsFromSegments(segments) {
    if (!segments || !segments.length) return [];
    const a = [{ x: segments[0].from.x, y: segments[0].from.y }];
    segments.forEach(s => a.push({ x: s.to.x, y: s.to.y }));
    return a;
  }
  // anchor k 이동: 공유 이웃 세그먼트의 to/from(+인접 cubic 핸들)을 함께 갱신. line 을 변형.
  function moveAnchor(line, k, dx, dy) {
    const s = line.segments, n = s.length;
    if (k > 0) { s[k - 1].to.x += dx; s[k - 1].to.y += dy; if (s[k - 1].kind === "cubic") { s[k - 1].c2.x += dx; s[k - 1].c2.y += dy; } }
    if (k < n) { s[k].from.x += dx; s[k].from.y += dy; if (s[k].kind === "cubic") { s[k].c1.x += dx; s[k].c1.y += dy; } }
  }
  // 점-선분 거리 / 점-세그먼트(line·cubic) 최소거리 / 점-선 최소거리
  function distPointSeg(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
    let t = L2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  }
  function cubicAt(s, t) {
    const m = 1 - t;
    return {
      x: m * m * m * s.from.x + 3 * m * m * t * s.c1.x + 3 * m * t * t * s.c2.x + t * t * t * s.to.x,
      y: m * m * m * s.from.y + 3 * m * m * t * s.c1.y + 3 * m * t * t * s.c2.y + t * t * t * s.to.y
    };
  }
  function distToSegment(p, seg) {
    if (seg.kind === "line") return distPointSeg(p, seg.from, seg.to);
    let prev = cubicAt(seg, 0), min = Infinity;
    for (let i = 1; i <= 16; i++) { const cur = cubicAt(seg, i / 16); min = Math.min(min, distPointSeg(p, prev, cur)); prev = cur; }
    return min;
  }
  function distToLine(p, line) { let m = Infinity; line.segments.forEach(s => { m = Math.min(m, distToSegment(p, s)); }); return m; }
  // 선의 cubic 핸들 목록: [{seg, which, c(제어점), a(연결 anchor)}]
  function handlesOf(line) {
    const hs = [];
    line.segments.forEach((s, i) => { if (s.kind === "cubic") { hs.push({ seg: i, which: "c1", c: s.c1, a: s.from }); hs.push({ seg: i, which: "c2", c: s.c2, a: s.to }); } });
    return hs;
  }

  // ── DOM 연동 ──
  function pieceOffset(piece) { const L = window.designLayout ? window.designLayout.ensureLayout(project()) : null; return (L && L[piece]) ? L[piece] : { dx: 0, dy: 0 }; }
  function pieceAt(target) { const h = target && target.closest && target.closest(".design-layout-hit"); return h ? h.getAttribute("data-layout-piece") : null; }
  function geoAt(e, piece) { const [dx, dy] = eventToPatternPoint(e); return pointToGeometryCm(dx, dy, pieceOffset(piece)); }
  function pxToCm() { const s = SC * viewZ; return s > 0 ? 1 / s : 1; }
  function ensurePatternLines(p) { if (!Array.isArray(p.working.patternLines)) p.working.patternLines = []; return p.working.patternLines; }
  function setNote(m) { const el = document.getElementById("designLineNote"); if (el) el.textContent = m; }
  function rerender() { if (typeof render === "function") render(); }
  function syncButtons() {
    const bd = document.getElementById("btnDesignLine"), bs = document.getElementById("btnDesignSelect");
    if (bd) { bd.textContent = mode === "draw" ? "그리기 종료" : "선·곡선 그리기"; bd.setAttribute("aria-pressed", mode === "draw" ? "true" : "false"); }
    if (bs) { bs.textContent = mode === "select" ? "편집 종료" : "선택·편집"; bs.setAttribute("aria-pressed", mode === "select" ? "true" : "false"); }
  }
  const DRAW_NOTE = "클릭=직선 점 · 드래그=곡선 · 더블클릭/Enter 완료";
  const SELECT_NOTE = "선을 클릭해 선택 · Delete 삭제 · anchor/핸들 드래그 편집 · Esc 해제";

  // ── 모드 전환(그리기/선택 상호배타) ──
  function setMode(m) {
    mode = m; draft = null; drawDrag = null; editDrag = null; selectedId = null;
    setNote(m === "draw" ? "첫 점을 클릭(또는 드래그)하세요" : m === "select" ? SELECT_NOTE : "");
    syncButtons(); rerender();
  }
  function toggle() { setMode(mode === "draw" ? "off" : "draw"); }          // 그리기 버튼
  function toggleSelect() { setMode(mode === "select" ? "off" : "select"); } // 선택·편집 버튼

  // render.js preview 용(draw): anchors + 도출 segments.
  function getDraft() {
    if (mode !== "draw" || !draft) return null;
    return { piece: draft.piece, anchors: draft.anchors.map(a => ({ p: { x: a.p.x, y: a.p.y }, h: a.h ? { x: a.h.x, y: a.h.y } : null })), segments: segmentsFromAnchors(draft.anchors) };
  }
  // render.js overlay 용(select): 선택 선의 piece·anchors·handles.
  function getSelectedId() { return mode === "select" ? selectedId : null; }
  function getSelectionOverlay() {
    if (mode !== "select" || !selectedId) return null;
    const line = findLine(selectedId); if (!line) return null;
    return {
      piece: line.piece,
      anchors: anchorsFromSegments(line.segments),
      handles: handlesOf(line).map(h => ({ c: { x: h.c.x, y: h.c.y }, a: { x: h.a.x, y: h.a.y } }))
    };
  }

  // ── draw 동작 ──
  function commitDraft() {
    if (!draft || draft.anchors.length < 2) { setNote("점 2개 이상 필요"); return false; }
    const p = project(); const ls = ensurePatternLines(p);
    ls.push(makePatternLine(nextId(ls), draft.piece, draft.anchors));
    draft = null; drawDrag = null; setNote("완료 · 새 선은 다시 첫 점부터"); rerender(); return true;
  }
  function draftBackspace() {
    if (!draft || !draft.anchors.length) return;
    draft.anchors.pop();
    if (!draft.anchors.length) { draft = null; setNote("첫 점을 찍으세요"); } else setNote(DRAW_NOTE);
    drawDrag = null; rerender();
  }

  // ── select 동작 ──
  function deleteSelected() {
    if (mode !== "select" || !selectedId) return;
    const p = project(); p.working.patternLines = ensurePatternLines(p).filter(l => l.id !== selectedId);
    selectedId = null; editDrag = null; setNote("선 삭제됨 · 다른 선을 클릭"); rerender();
  }
  // 선택 모드 pointerdown: 선택 선의 핸들·anchor 히트 → 편집 시작. 아니면 선 선택/해제.
  function selectDown(e, piece, geo) {
    const rCm = NODE_HIT_PX * pxToCm(), lCm = LINE_HIT_PX * pxToCm();
    if (selectedId) {
      const line = findLine(selectedId);
      if (line && line.piece === piece) {
        // 핸들 먼저(위에 그려짐)
        const hs = handlesOf(line);
        for (const h of hs) if (Math.hypot(geo.x - h.c.x, geo.y - h.c.y) < rCm) { editDrag = { kind: "handle", seg: h.seg, which: h.which }; return; }
        const as = anchorsFromSegments(line.segments);
        for (let k = 0; k < as.length; k++) if (Math.hypot(geo.x - as[k].x, geo.y - as[k].y) < rCm) {
          editDrag = { kind: "anchor", k: k, startGeo: geo, orig: JSON.parse(JSON.stringify(line.segments)) }; return;
        }
      }
    }
    // 선 선택(같은 피스에서 가장 가까운 선, 임계 내). 없으면 해제.
    let best = null, bestD = lCm;
    lines().forEach(l => { if (l.piece !== piece) return; const d = distToLine(geo, l); if (d < bestD) { bestD = d; best = l; } });
    selectedId = best ? best.id : null;
    setNote(best ? "선택됨 · Delete 삭제 · anchor/핸들 드래그 · Esc 해제" : SELECT_NOTE);
  }
  function editMove(geo) {
    const line = findLine(selectedId); if (!line || !editDrag) return;
    if (editDrag.kind === "handle") {
      line.segments[editDrag.seg][editDrag.which] = { x: geo.x, y: geo.y };   // c1/c2 절대 이동
    } else {                                                                  // anchor: 원본에서 총 delta 적용
      line.segments = JSON.parse(JSON.stringify(editDrag.orig));
      moveAnchor(line, editDrag.k, geo.x - editDrag.startGeo.x, geo.y - editDrag.startGeo.y);
    }
    rerender();
  }

  if (typeof svg !== "undefined" && svg) {
    svg.addEventListener("pointerdown", e => {
      if (mode === "off" || e.button !== 0 || !inDesign()) return;
      const piece = pieceAt(e.target);
      if (mode === "draw") {
        if (!draft) {
          if (!piece) { setNote("피스 위를 클릭하세요"); return; }
          draft = { piece: piece, anchors: [{ p: geoAt(e, piece), h: null }] }; setNote(DRAW_NOTE);
        } else if (piece !== draft.piece) { setNote("같은 피스 안에서 이어 그리세요"); return; }
        else { draft.anchors.push({ p: geoAt(e, piece), h: null }); setNote(DRAW_NOTE); }
        drawDrag = { startX: e.clientX, startY: e.clientY };
      } else { // select
        if (!piece) { selectedId = null; editDrag = null; setNote(SELECT_NOTE); }
        else selectDown(e, piece, geoAt(e, piece));
      }
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      e.stopPropagation(); rerender();
    });
    svg.addEventListener("pointermove", e => {
      if (mode === "draw") {
        if (!drawDrag || !draft) return;
        const anchor = draft.anchors[draft.anchors.length - 1];
        if (Math.hypot(e.clientX - drawDrag.startX, e.clientY - drawDrag.startY) > DRAG_PX) {
          const g = geoAt(e, draft.piece); anchor.h = { x: g.x - anchor.p.x, y: g.y - anchor.p.y };
        } else anchor.h = null;
        rerender();
      } else if (mode === "select" && editDrag) {
        editMove(geoAt(e, findLine(selectedId).piece));
      }
    });
    const endDrag = e => {
      if (mode === "draw" && drawDrag) {
        const anchor = draft && draft.anchors[draft.anchors.length - 1];
        if (anchor && anchor.h && Math.hypot(anchor.h.x, anchor.h.y) < EPS) anchor.h = null;
        drawDrag = null; try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {} rerender();
      } else if (mode === "select" && editDrag) {
        editDrag = null; try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {} rerender();
      }
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("dblclick", e => {
      if (mode !== "draw" || !draft) return;
      draft.anchors.pop(); commitDraft(); e.preventDefault(); e.stopPropagation();
    });
    document.addEventListener("keydown", e => {
      if (mode === "off" || !inDesign()) return;
      const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (mode === "draw") {
        if (e.key === "Escape") { draft = null; drawDrag = null; setNote("취소됨 · 첫 점을 다시 찍으세요"); rerender(); }
        else if (e.key === "Enter" && draft) { e.preventDefault(); commitDraft(); }
        else if (e.key === "Backspace" && draft) { e.preventDefault(); draftBackspace(); }
      } else { // select
        if (e.key === "Escape") { selectedId = null; editDrag = null; setNote(SELECT_NOTE); rerender(); }
        else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSelected(); }
      }
    });
  }

  window.designLineTool = Object.freeze({
    toggle, toggleSelect, setMode, getMode, cancel: () => setMode("off"), isActive,
    getDraft, getSelectedId, getSelectionOverlay, deleteSelected,
    // 순수
    pointToGeometryCm, geometryToDrawCm, segmentsFromAnchors, makePatternLine, nextId,
    anchorsFromSegments, moveAnchor, distToLine, distToSegment, handlesOf
  });
})();
