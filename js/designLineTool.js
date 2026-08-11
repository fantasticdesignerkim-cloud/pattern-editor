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
  const SNAP_PX = 8;          // snap: 화면 8px 이내에서만 흡착(zoom→cm 환산)
  const GRID_CM = 0.5;        // snap: 격자 0.5cm(최저 우선순위)
  const EPS = 1e-9;
  const PIECE_GEOM_KEYS = { front: ["front", "shared"], back: ["back"], sleeve: ["sleeve"] };
  const SNAP_LABEL = { anchor: "기존 anchor", endpoint: "형상 끝점", outline: "외곽선", grid: "격자 0.5cm" };
  const ROLE_LABEL = { cut: "절개선", boundary: "외곽 대체선", guide: "보조선" };

  let mode = "off";
  let draft = null, drawDrag = null;                 // draw 상태
  let selectedId = null, editDrag = null;            // select 상태
  let snapHint = null;                               // {piece, point, type} — 흡착 표시(세션 UI)
  let lastHandleGeo = null;                           // 핸들 드래그 중 마지막 커서(형상 cm) — Shift 즉시 반영

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
  // role: "cut"(절개선) | "boundary"(외곽 대체선) | "guide"(보조선). 새 선은 guide(참고)로 시작.
  function makePatternLine(id, piece, anchors, role) { return { id: id, piece: piece, role: role || "guide", segments: segmentsFromAnchors(anchors) }; }
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
  // adaptive de Casteljau flattening — designBodice 교차검사와 **동일 경계**(FLAT_TOL 1e-4,
  // 최대 depth 16). 고정 분할은 최근접점이 샘플 사이/꼭짓점에 걸리면 오차가 남으므로 안 쓴다.
  // snap 최근접점(nearestOnSegs)·선 선택 hit-test(distToSegment) 둘 다 이 flattenSegment 를 공유.
  const FLAT_TOL = 1e-4, FLAT_MAX_DEPTH = 16;
  function _mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function _cubicFlatEnough(p0, p1, p2, p3) {
    let ux = 3 * p1.x - 2 * p0.x - p3.x, uy = 3 * p1.y - 2 * p0.y - p3.y;
    let vx = 3 * p2.x - p0.x - 2 * p3.x, vy = 3 * p2.y - p0.y - 2 * p3.y;
    ux *= ux; uy *= uy; vx *= vx; vy *= vy;
    if (ux < vx) ux = vx; if (uy < vy) uy = vy;
    return (ux + uy) <= 16 * FLAT_TOL * FLAT_TOL;
  }
  function _flattenCubic(p0, p1, p2, p3, depth, out) {
    if (depth >= FLAT_MAX_DEPTH || _cubicFlatEnough(p0, p1, p2, p3)) { out.push([p0, p3]); return; }
    const p01 = _mid(p0, p1), p12 = _mid(p1, p2), p23 = _mid(p2, p3);
    const p012 = _mid(p01, p12), p123 = _mid(p12, p23), p0123 = _mid(p012, p123);
    _flattenCubic(p0, p01, p012, p0123, depth + 1, out);   // 좌 → 우 결정론적
    _flattenCubic(p0123, p123, p23, p3, depth + 1, out);
  }
  // 세그먼트(line·cubic) → 평탄화된 [a,b] 선분 배열.
  function flattenSegment(seg) {
    if (seg.kind === "cubic") { const out = []; _flattenCubic(seg.from, seg.c1, seg.c2, seg.to, 0, out); return out; }
    return [[seg.from, seg.to]];
  }
  function distToSegment(p, seg) {
    let min = Infinity;
    flattenSegment(seg).forEach(ab => { const d = distPointSeg(p, ab[0], ab[1]); if (d < min) min = d; });
    return min;
  }
  function distToLine(p, line) { let m = Infinity; line.segments.forEach(s => { m = Math.min(m, distToSegment(p, s)); }); return m; }
  // 선의 cubic 핸들 목록: [{seg, which, c(제어점), a(연결 anchor)}]
  function handlesOf(line) {
    const hs = [];
    line.segments.forEach((s, i) => { if (s.kind === "cubic") { hs.push({ seg: i, which: "c1", c: s.c1, a: s.from }); hs.push({ seg: i, which: "c2", c: s.c2, a: s.to }); } });
    return hs;
  }
  // 선분 위 최근접점 / 점 목록 최근접(임계 내) / 세그먼트 목록 최근접점(line·cubic)
  function closestOnSeg(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy;
    let t = L2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return { x: a.x + t * vx, y: a.y + t * vy };
  }
  function nearestPoint(cursor, pts, thr) {
    let best = null, bd = thr;
    pts.forEach(pt => { const d = Math.hypot(cursor.x - pt.x, cursor.y - pt.y); if (d < bd) { bd = d; best = pt; } });
    return best ? { pt: { x: best.x, y: best.y }, d: bd } : null;
  }
  function nearestOnSegs(cursor, segs, thr) {
    let best = null, bd = thr;
    segs.forEach(s => {
      flattenSegment(s).forEach(ab => {   // line·cubic 모두 adaptive flatten 선분에 투영(동일 경계)
        const c = closestOnSeg(cursor, ab[0], ab[1]); const d = Math.hypot(cursor.x - c.x, cursor.y - c.y);
        if (d < bd) { bd = d; best = c; }
      });
    });
    return best ? { pt: best, d: bd } : null;
  }
  // 순수 snap 선택(우선순위 캐스케이드): anchor → geometry 끝점 → outline 최근접 → 격자.
  // 상위 우선순위에 임계 내 후보가 있으면 그 tier 에서 최근접을 고른다(격자는 최저 폴백).
  function chooseSnap(cursor, sources, thr, grid) {
    let c = nearestPoint(cursor, sources.anchors || [], thr);
    if (c) return { point: c.pt, type: "anchor", dist: c.d };
    c = nearestPoint(cursor, sources.endpoints || [], thr);
    if (c) return { point: c.pt, type: "endpoint", dist: c.d };
    c = nearestOnSegs(cursor, sources.outlineSegs || [], thr);
    if (c) return { point: c.pt, type: "outline", dist: c.d };
    const gp = { x: Math.round(cursor.x / grid) * grid, y: Math.round(cursor.y / grid) * grid };
    const gd = Math.hypot(cursor.x - gp.x, cursor.y - gp.y);
    if (gd < thr) return { point: gp, type: "grid", dist: gd };
    return null;
  }
  // Shift 각도 고정: 핸들 벡터(dx,dy)의 각도만 45° 배수로 고정하고 길이는 유지.
  // 도안 cm(피스 offset 제거) 벡터라 zoom·offset 독립. anchor snap 과 분리(핸들 위치 snap 없음).
  function constrainAngle45(dx, dy) {
    const len = Math.hypot(dx, dy);
    if (len < EPS) return { x: 0, y: 0 };
    const step = Math.PI / 4;
    const a = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: len * Math.cos(a), y: len * Math.sin(a) };
  }

  // ── DOM 연동 ──
  function pieceOffset(piece) { const L = window.designLayout ? window.designLayout.ensureLayout(project()) : null; return (L && L[piece]) ? L[piece] : { dx: 0, dy: 0 }; }
  function pieceAt(target) { const h = target && target.closest && target.closest(".design-layout-hit"); return h ? h.getAttribute("data-layout-piece") : null; }
  function geoAt(e, piece) { const [dx, dy] = eventToPatternPoint(e); return pointToGeometryCm(dx, dy, pieceOffset(piece)); }

  // ── snap 후보 소스(working geometry·같은 피스만) ──
  function geomEndpoints(geom, keys) {
    const pts = [];
    keys.forEach(k => { const b = geom[k]; if (!b) return; ["outline", "construction"].forEach(rl => (b[rl] || []).forEach(pr => {
      if (pr.kind === "line") { pts.push(pr.from); pts.push(pr.to); }
      else if (pr.kind === "path") pr.commands.forEach(c => { if (c.type === "M") pts.push(c.points[0]); else if (c.type === "C") pts.push(c.points[c.points.length - 1]); });
    })); });
    return pts;
  }
  function outlineSegsOf(geom, keys) {
    const segs = [];
    keys.forEach(k => { const b = geom[k]; if (!b) return; (b.outline || []).forEach(pr => {
      if (pr.kind === "line") segs.push({ kind: "line", from: pr.from, to: pr.to });
      else if (pr.kind === "path") { let cur = null; pr.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { segs.push({ kind: "cubic", from: cur, c1: c.points[0], c2: c.points[1], to: c.points[2] }); cur = c.points[2]; } }); }
    }); });
    return segs;
  }
  function patternAnchorPts(piece, exclude) {
    const pts = [];
    lines().forEach(l => { if (l.piece !== piece) return; anchorsFromSegments(l.segments).forEach(a => { if (exclude && Math.abs(a.x - exclude.x) < EPS && Math.abs(a.y - exclude.y) < EPS) return; pts.push(a); }); });
    return pts;
  }
  // 커서(형상 cm)를 같은 피스의 working geometry 기준으로 snap. Alt 면 해제(자유).
  // exclude = 선택 편집 중 자기 자신 anchor(있으면 후보에서 제외).
  function snapForCursor(cursor, piece, altKey, exclude) {
    if (altKey) return null;
    const p = project(); if (!p) return null;
    const geom = p.working.geometry, keys = PIECE_GEOM_KEYS[piece] || [piece];
    const thr = SNAP_PX * pxToCm();
    return chooseSnap(cursor, { anchors: patternAnchorPts(piece, exclude), endpoints: geomEndpoints(geom, keys), outlineSegs: outlineSegsOf(geom, keys) }, thr, GRID_CM);
  }
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
    mode = m; draft = null; drawDrag = null; editDrag = null; selectedId = null; snapHint = null;
    setNote(m === "draw" ? "첫 점을 클릭(또는 드래그)하세요" : m === "select" ? SELECT_NOTE : "");
    syncButtons(); syncRoleButtons(); rerender();
  }
  function getSnapHint() { return snapHint ? { piece: snapHint.piece, point: { x: snapHint.point.x, y: snapHint.point.y }, type: snapHint.type } : null; }
  // snapHint 갱신(변화 시에만 rerender 신호). 흡착 안내를 note 에 병기.
  function setSnapHint(h, baseNote) {
    const changed = JSON.stringify(h) !== JSON.stringify(snapHint);
    snapHint = h;
    setNote(h ? ("흡착 → " + (SNAP_LABEL[h.type] || h.type)) : baseNote);
    return changed;
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
    selectedId = null; editDrag = null; setNote("선 삭제됨 · 다른 선을 클릭"); syncRoleButtons(); rerender();
  }
  // 선택한 선의 역할 지정(cut/boundary/guide). 표시만 바뀌고 outline 분할은 다음 단계.
  function setRole(role) {
    if (mode !== "select" || !selectedId || !ROLE_LABEL[role]) return;
    const line = findLine(selectedId); if (!line) return;
    line.role = role; setNote("역할: " + ROLE_LABEL[role]); syncRoleButtons(); rerender();
  }
  // 역할 버튼(design inspector): 선택 시 활성, 현재 역할 강조.
  function syncRoleButtons() {
    const sel = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    const role = sel ? (sel.role || "guide") : null;
    [["btnRoleCut", "cut"], ["btnRoleBoundary", "boundary"], ["btnRoleGuide", "guide"]].forEach(pair => {
      const b = document.getElementById(pair[0]); if (!b) return;
      b.disabled = !sel; b.setAttribute("aria-pressed", role === pair[1] ? "true" : "false");
    });
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
          editDrag = { kind: "anchor", k: k, startGeo: geo, origAnchor: { x: as[k].x, y: as[k].y }, orig: JSON.parse(JSON.stringify(line.segments)) }; return;
        }
      }
    }
    // 선 선택(같은 피스에서 가장 가까운 선, 임계 내). 없으면 해제.
    let best = null, bestD = lCm;
    lines().forEach(l => { if (l.piece !== piece) return; const d = distToLine(geo, l); if (d < bestD) { bestD = d; best = l; } });
    selectedId = best ? best.id : null;
    setNote(best ? "선택됨 · Delete 삭제 · anchor/핸들 드래그 · Esc 해제" : SELECT_NOTE);
  }
  // draw 곡선 핸들: 커서 g(형상 cm) → 마지막 anchor.h. Shift=45° 고정(길이 유지).
  function applyDrawHandle(g, shift) {
    const anchor = draft.anchors[draft.anchors.length - 1];
    anchor.h = shift ? constrainAngle45(g.x - anchor.p.x, g.y - anchor.p.y) : { x: g.x - anchor.p.x, y: g.y - anchor.p.y };
    setNote(shift ? "핸들 45° 각도 고정 (Shift)" : "곡선 핸들 · Shift = 45° 고정");
  }
  function editMove(geo, altKey, shiftKey) {
    const line = findLine(selectedId); if (!line || !editDrag) return;
    if (editDrag.kind === "handle") {
      lastHandleGeo = { x: geo.x, y: geo.y };
      const seg = line.segments[editDrag.seg];
      const anchor = editDrag.which === "c1" ? seg.from : seg.to;             // c1=from쪽 · c2=to쪽 기준
      let tip = { x: geo.x, y: geo.y };                                       // 핸들 위치 snap 없음(자유)
      if (shiftKey) { const v = constrainAngle45(geo.x - anchor.x, geo.y - anchor.y); tip = { x: anchor.x + v.x, y: anchor.y + v.y }; }
      seg[editDrag.which] = tip;                                              // 선택한 c1/c2만(반대쪽 강제 대칭 없음)
      snapHint = null; setNote(shiftKey ? "핸들 45° 각도 고정 (Shift)" : "핸들 이동 · Shift = 45° 고정");
    } else {                                                                  // anchor: 총 delta + snap
      const oa = editDrag.origAnchor;
      const nx = oa.x + (geo.x - editDrag.startGeo.x), ny = oa.y + (geo.y - editDrag.startGeo.y);
      const snap = snapForCursor({ x: nx, y: ny }, line.piece, altKey, oa);   // 자기 자신 anchor 제외
      const t = snap ? snap.point : { x: nx, y: ny };
      snapHint = snap ? { piece: line.piece, point: snap.point, type: snap.type } : null;
      line.segments = JSON.parse(JSON.stringify(editDrag.orig));
      moveAnchor(line, editDrag.k, t.x - oa.x, t.y - oa.y);
      setNote(snapHint ? ("흡착 → " + (SNAP_LABEL[snapHint.type] || snapHint.type)) : "anchor 이동 · Esc 해제");
    }
    rerender();
  }

  if (typeof svg !== "undefined" && svg) {
    svg.addEventListener("pointerdown", e => {
      if (mode === "off" || e.button !== 0 || !inDesign()) return;
      const piece = pieceAt(e.target);
      if (mode === "draw") {
        // 새 anchor 는 snap 적용(같은 피스 · working geometry 기준 · Alt 해제).
        const placeGeo = pc => { const g = geoAt(e, pc); const s = snapForCursor(g, pc, e.altKey, null); snapHint = s ? { piece: pc, point: s.point, type: s.type } : null; return s ? { x: s.point.x, y: s.point.y } : g; };
        if (!draft) {
          if (!piece) { setNote("피스 위를 클릭하세요"); return; }
          draft = { piece: piece, anchors: [{ p: placeGeo(piece), h: null }] }; setNote(DRAW_NOTE);
        } else if (piece !== draft.piece) { setNote("같은 피스 안에서 이어 그리세요"); return; }
        else { draft.anchors.push({ p: placeGeo(draft.piece), h: null }); setNote(DRAW_NOTE); }
        drawDrag = { startX: e.clientX, startY: e.clientY };
      } else { // select
        if (!piece) { selectedId = null; editDrag = null; setNote(SELECT_NOTE); }
        else selectDown(e, piece, geoAt(e, piece));
        syncRoleButtons();   // 선택 변화 → 역할 버튼 활성/강조 갱신
      }
      try { svg.setPointerCapture(e.pointerId); } catch (_) {}
      e.stopPropagation(); rerender();
    });
    svg.addEventListener("pointermove", e => {
      if (mode === "draw") {
        if (drawDrag && draft) {                                   // 곡선 핸들 드래그(핸들 위치 snap 없음)
          const anchor = draft.anchors[draft.anchors.length - 1];
          if (Math.hypot(e.clientX - drawDrag.startX, e.clientY - drawDrag.startY) > DRAG_PX) {
            const g = geoAt(e, draft.piece); lastHandleGeo = g; applyDrawHandle(g, e.shiftKey);
          } else { anchor.h = null; lastHandleGeo = null; }
          snapHint = null; rerender();
        } else {                                                   // hover: 다음 anchor 의 snap 미리보기
          const piece = draft ? draft.piece : pieceAt(e.target);
          let h = null;
          if (piece) { const s = snapForCursor(geoAt(e, piece), piece, e.altKey, null); if (s) h = { piece: piece, point: s.point, type: s.type }; }
          if (setSnapHint(h, DRAW_NOTE)) rerender();
        }
      } else if (mode === "select" && editDrag) {
        editMove(geoAt(e, findLine(selectedId).piece), e.altKey, e.shiftKey);
      }
    });
    const endDrag = e => {
      if (mode === "draw" && drawDrag) {
        const anchor = draft && draft.anchors[draft.anchors.length - 1];
        if (anchor && anchor.h && Math.hypot(anchor.h.x, anchor.h.y) < EPS) anchor.h = null;
        drawDrag = null; snapHint = null; lastHandleGeo = null; _handleShift = false; try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {} rerender();
      } else if (mode === "select" && editDrag) {
        editDrag = null; snapHint = null; lastHandleGeo = null; _handleShift = false; try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {} rerender();
      }
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    // Shift 즉시 반영: 핸들 드래그 중(마우스 정지 상태 포함) Shift 누름/뗌에 각도 고정/해제.
    let _handleShift = false;
    function onShift(shift) {
      if (shift === _handleShift || !lastHandleGeo) return; _handleShift = shift;
      if (mode === "draw" && drawDrag && draft) { applyDrawHandle(lastHandleGeo, shift); rerender(); }
      else if (mode === "select" && editDrag && editDrag.kind === "handle") { editMove(lastHandleGeo, false, shift); }
    }
    document.addEventListener("keydown", e => { if (e.key === "Shift") onShift(true); });
    document.addEventListener("keyup", e => { if (e.key === "Shift") onShift(false); });
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
        if (e.key === "Escape") { selectedId = null; editDrag = null; setNote(SELECT_NOTE); syncRoleButtons(); rerender(); }
        else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSelected(); }
      }
    });
  }

  window.designLineTool = Object.freeze({
    toggle, toggleSelect, setMode, getMode, cancel: () => setMode("off"), isActive,
    getDraft, getSelectedId, getSelectionOverlay, getSnapHint, deleteSelected, setRole,
    // 순수
    pointToGeometryCm, geometryToDrawCm, segmentsFromAnchors, makePatternLine, nextId,
    anchorsFromSegments, moveAnchor, distToLine, distToSegment, handlesOf,
    chooseSnap, closestOnSeg, nearestOnSegs, flattenSegment, constrainAngle45
  });
})();
