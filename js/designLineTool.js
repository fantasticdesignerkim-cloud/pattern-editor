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
  const DBLCLICK_MS = 400;    // draw: 수동 더블클릭 감지 시간 임계(네이티브 dblclick 은 rerender 로 DOM 이
  const DBLCLICK_PX = 6;      //       매 클릭 재생성돼 발화 안 함 → pointerdown 에서 직접 감지·완료)
  const LINE_HIT_PX = 7;      // select: 선 히트 반경(px)
  const NODE_HIT_PX = 9;      // select: anchor·handle 히트 반경(px)
  const SNAP_PX = 8;          // snap: 화면 8px 이내에서만 흡착(zoom→cm 환산)
  const GRID_CM = 0.5;        // snap: 격자 0.5cm(최저 우선순위)
  const EPS = 1e-9;
  const PIECE_GEOM_KEYS = { front: ["front", "shared"], back: ["back"], sleeve: ["sleeve"] };
  const SNAP_LABEL = { anchor: "기존 anchor", endpoint: "형상 끝점", outline: "외곽선", grid: "격자 0.5cm" };
  const ROLE_LABEL = { cut: "절개선", boundary: "외곽 대체선", guide: "보조선" };

  let mode = "off";
  let draft = null, drawDrag = null, lastDown = null;   // draw 상태(lastDown = 직전 pointerdown 시각·위치)
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

  // ── 절개선 유효성 검사(순수) — snapHint 아님, 실제 좌표·교차 재계산 ──
  // 세그먼트(line·cubic) 배열 → 평탄화된 [a,b] 선분 배열(cubic 은 adaptive de Casteljau).
  function flattenLine(segments) { const out = []; (segments || []).forEach(s => { flattenSegment(s).forEach(ab => out.push(ab)); }); return out; }
  function distPtToSegs(p, segs) { let m = Infinity; segs.forEach(ab => { const d = distPointSeg(p, ab[0], ab[1]); if (d < m) m = d; }); return m; }
  // 두 선분의 proper/touch 교차점(평행·공선은 null — 중복/스침은 별도 검사).
  function segCross(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const den = rx * sy - ry * sx; if (Math.abs(den) < 1e-12) return null;
    const ex = c.x - a.x, ey = c.y - a.y;
    const t = (ex * sy - ey * sx) / den, u = (ex * ry - ey * rx) / den, E = 1e-9;
    if (t >= -E && t <= 1 + E && u >= -E && u <= 1 + E) return { x: a.x + t * rx, y: a.y + t * ry };
    return null;
  }
  function nearAny(p, pts, tol) { return pts.some(q => Math.hypot(p.x - q.x, p.y - q.y) < tol); }
  // 절개선 유효성: role=cut / 양끝 outline 위 / 양끝 다름 / 자기교차 없음 / 중간이 outline 에
  // 닿지 않음 / outline 따라가는 중복 아님 / 기존 cut 과 교차 없음. {ok, reason} 반환(순수).
  // outlineFlat·otherCutsFlat = 미리 평탄화한 [a,b] 선분들. geometry 를 바꾸지 않는다.
  function validateCut(cutLine, outlineFlat, otherCutsFlat, opts) {
    opts = opts || {}; const ON = opts.onTol != null ? opts.onTol : 0.05, SEP = opts.minSep != null ? opts.minSep : 0.1;
    if (!cutLine || cutLine.role !== "cut") return { ok: false, reason: "절개선이 아님" };
    const segs = cutLine.segments; if (!segs || !segs.length) return { ok: false, reason: "선이 비었음" };
    const start = segs[0].from, end = segs[segs.length - 1].to;
    if (!outlineFlat || !outlineFlat.length) return { ok: false, reason: "피스 외곽선을 찾을 수 없음" };
    if (distPtToSegs(start, outlineFlat) > ON) return { ok: false, reason: "시작점이 외곽선에 연결되지 않음" };
    if (distPtToSegs(end, outlineFlat) > ON) return { ok: false, reason: "끝점이 외곽선에 연결되지 않음" };
    if (Math.hypot(start.x - end.x, start.y - end.y) < SEP) return { ok: false, reason: "시작점과 끝점이 같음" };
    const cf = flattenLine(segs);
    for (let i = 0; i < cf.length; i++) for (let j = i + 2; j < cf.length; j++) {
      if (segCross(cf[i][0], cf[i][1], cf[j][0], cf[j][1])) return { ok: false, reason: "절개선이 자기 자신과 교차" };
    }
    for (const cs of cf) for (const os of outlineFlat) {
      const p = segCross(cs[0], cs[1], os[0], os[1]);
      if (p && !nearAny(p, [start, end], ON)) return { ok: false, reason: "절개선 중간이 외곽선에 닿음" };
    }
    // outline 따라가는 중복: 끝점 근처를 뺀 내부 샘플이 전부 outline 위면 중복.
    const samples = []; cf.forEach(ab => { samples.push(ab[0]); samples.push({ x: (ab[0].x + ab[1].x) / 2, y: (ab[0].y + ab[1].y) / 2 }); }); if (cf.length) samples.push(cf[cf.length - 1][1]);
    const interior = samples.filter(pt => !nearAny(pt, [start, end], ON));
    if (interior.length && interior.every(pt => distPtToSegs(pt, outlineFlat) <= ON)) return { ok: false, reason: "외곽선을 따라가는 중복 선" };
    for (const oc of (otherCutsFlat || [])) for (const cs of cf) for (const os of oc) {
      if (segCross(cs[0], cs[1], os[0], os[1])) return { ok: false, reason: "다른 절개선과 교차" };
    }
    return { ok: true, reason: "분리 가능" };
  }

  // ── 파트 분리(파트 분할) — 순수(harness) ──
  // 열린 다트 입구를 construction 다트 다리(입구→apex→입구)로 닫아 폐곡선 ring 을 만든 뒤,
  // 유효 절개선으로 두 폐곡선으로 자른다. **flatten 은 교차·검증·면적에만 쓰고, 실제 파트
  // outline cubic 은 교차 parameter t 에서 de Casteljau 로 정확히 분할한다(곡선 보존).**
  const RING_EPS = 0.02;        // outline 끝점 연결 허용(부동소수 drift 0.0004 는 잇고, 다트 입구 1.79+ 는 gap 유지)
  const SPLIT_MIN_AREA = 0.01;  // cm² — 면적 0 파트 차단
  const CLOSE_EPS = 1e-4;       // 폐곡선 시작·끝 연결 허용오차(계약)
  function _pt(p) { return { x: p.x, y: p.y }; }
  function _lerpP(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function _near2(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) <= RING_EPS; }
  function _evalSeg(seg, t) {
    if (seg.kind === "line") return _lerpP(seg.from, seg.to, t);
    const a = _lerpP(seg.from, seg.c1, t), b = _lerpP(seg.c1, seg.c2, t), c = _lerpP(seg.c2, seg.to, t);
    const d = _lerpP(a, b, t), e = _lerpP(b, c, t); return _lerpP(d, e, t);
  }
  function _deriv1(seg, t) { // cubic 1차 도함수
    const p0 = seg.from, p1 = seg.c1, p2 = seg.c2, p3 = seg.to, u = 1 - t;
    return { x: 3 * (u * u * (p1.x - p0.x) + 2 * u * t * (p2.x - p1.x) + t * t * (p3.x - p2.x)),
      y: 3 * (u * u * (p1.y - p0.y) + 2 * u * t * (p2.y - p1.y) + t * t * (p3.y - p2.y)) };
  }
  function _deriv2(seg, t) { // cubic 2차 도함수
    const p0 = seg.from, p1 = seg.c1, p2 = seg.c2, p3 = seg.to;
    return { x: 6 * ((1 - t) * (p2.x - 2 * p1.x + p0.x) + t * (p3.x - 2 * p2.x + p1.x)),
      y: 6 * ((1 - t) * (p2.y - 2 * p1.y + p0.y) + t * (p3.y - 2 * p2.y + p1.y)) };
  }
  // cubic 을 [t0,t1] 로 정확히 자른 새 cubic 제어점 [from,c1,c2,to]. de Casteljau 두 번.
  function _cubicBetween(P0, P1, P2, P3, t0, t1) {
    function split(p0, p1, p2, p3, t) {
      const a = _lerpP(p0, p1, t), b = _lerpP(p1, p2, t), c = _lerpP(p2, p3, t);
      const d = _lerpP(a, b, t), e = _lerpP(b, c, t), f = _lerpP(d, e, t);
      return { left: [p0, a, d, f], right: [f, e, c, p3] };
    }
    const L = split(P0, P1, P2, P3, t1).left;                 // [0,t1]
    const tt = t1 > 0 ? t0 / t1 : 0;
    return split(L[0], L[1], L[2], L[3], tt).right;           // [t0,t1]
  }
  function subSegment(seg, t0, t1) {
    if (seg.kind === "line") return { kind: "line", from: _lerpP(seg.from, seg.to, t0), to: _lerpP(seg.from, seg.to, t1) };
    const R = _cubicBetween(seg.from, seg.c1, seg.c2, seg.to, t0, t1);
    return { kind: "cubic", from: R[0], c1: R[1], c2: R[2], to: R[3] };
  }
  function reverseSeg(seg) {
    if (seg.kind === "line") return { kind: "line", from: _pt(seg.to), to: _pt(seg.from) };
    return { kind: "cubic", from: _pt(seg.to), c1: _pt(seg.c2), c2: _pt(seg.c1), to: _pt(seg.from) };
  }
  function cloneSeg(seg) {
    return seg.kind === "cubic"
      ? { kind: "cubic", from: _pt(seg.from), c1: _pt(seg.c1), c2: _pt(seg.c2), to: _pt(seg.to) }
      : { kind: "line", from: _pt(seg.from), to: _pt(seg.to) };
  }
  function _segLen(seg) { return Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y); }
  // 점을 세그먼트에 투영 → {t, point, dist}. cubic 은 조밀 샘플 후 Newton 정밀화.
  function projectOntoSeg(P, seg) {
    if (seg.kind === "line") {
      const vx = seg.to.x - seg.from.x, vy = seg.to.y - seg.from.y, L2 = vx * vx + vy * vy;
      let t = L2 > 0 ? ((P.x - seg.from.x) * vx + (P.y - seg.from.y) * vy) / L2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t; const pt = _lerpP(seg.from, seg.to, t);
      return { t: t, point: pt, dist: Math.hypot(P.x - pt.x, P.y - pt.y) };
    }
    let bt = 0, bd = Infinity, N = 40, k;
    for (k = 0; k <= N; k++) { const t = k / N, pt = _evalSeg(seg, t), d = Math.hypot(P.x - pt.x, P.y - pt.y); if (d < bd) { bd = d; bt = t; } }
    let t = bt;
    for (let it = 0; it < 12; it++) {
      const B = _evalSeg(seg, t), d1 = _deriv1(seg, t), d2 = _deriv2(seg, t);
      const dx = B.x - P.x, dy = B.y - P.y;
      const f = dx * d1.x + dy * d1.y, fp = d1.x * d1.x + d1.y * d1.y + dx * d2.x + dy * d2.y;
      if (Math.abs(fp) < 1e-12) break;
      let tn = t - f / fp; if (tn < 0) tn = 0; if (tn > 1) tn = 1;
      if (Math.abs(tn - t) < 1e-10) { t = tn; break; } t = tn;
    }
    const pt = _evalSeg(seg, t); return { t: t, point: pt, dist: Math.hypot(P.x - pt.x, P.y - pt.y) };
  }
  function projectOntoRing(P, ring) {
    let best = { dist: Infinity, i: -1, t: 0, point: null };
    ring.forEach((r, i) => { const pr = projectOntoSeg(P, r.seg); if (pr.dist < best.dist) best = { dist: pr.dist, i: i, t: pr.t, point: pr.point }; });
    return best;
  }
  // construction line 들로 fromPt→toPt 경로(다트 다리) 걷기. 반환 {ok, segs:[oriented line...]}.
  function walkConstruction(constrLines, fromPt, toPt) {
    const used = new Array(constrLines.length).fill(false), out = [];
    let cur = _pt(fromPt);
    for (let step = 0; step < constrLines.length; step++) {
      if (_near2(cur, toPt)) return { ok: true, segs: out };
      let found = -1, oriented = null;
      for (let j = 0; j < constrLines.length; j++) {
        if (used[j]) continue; const l = constrLines[j];
        if (_near2(l.from, cur)) { found = j; oriented = { kind: "line", from: _pt(cur), to: _pt(l.to) }; break; }
        if (_near2(l.to, cur)) { found = j; oriented = { kind: "line", from: _pt(cur), to: _pt(l.from) }; break; }
      }
      if (found < 0) return { ok: false, reason: "다트 다리 경로를 찾을 수 없음" };
      used[found] = true; out.push(oriented); cur = oriented.to;
    }
    return _near2(cur, toPt) ? { ok: true, segs: out } : { ok: false, reason: "다트 다리 경로가 닫히지 않음" };
  }
  // outline 세그먼트(무순서) + construction line → 다트로 닫힌 폐곡선 ring.
  // 반환 { ok, ring:[{seg, source:"outline"|"dartleg"}], reason }. 내부 junction 은 정확 공유로 강제.
  function buildPieceRing(outlineSegs, constrLines) {
    const segs = outlineSegs.map(cloneSeg), n = segs.length;
    if (!n) return { ok: false, reason: "외곽선 없음" };
    const E = []; for (let i = 0; i < n; i++) { E.push({ i: i, p: segs[i].from }); E.push({ i: i, p: segs[i].to }); }
    const shared = (pt, exclI) => E.some(x => x.i !== exclI && _near2(x.p, pt));
    const free = [];
    for (let i = 0; i < n; i++) { if (!shared(segs[i].from, i)) free.push({ i: i, w: "from", p: segs[i].from }); if (!shared(segs[i].to, i)) free.push({ i: i, w: "to", p: segs[i].to }); }
    if (free.length !== 2) return { ok: false, reason: "열린 다트 입구가 정확히 1개가 아님(토폴로지 예외)" };
    const start = free[0], goal = free[1].p, chain = [], used = new Array(n).fill(false);
    let first = start.w === "from" ? cloneSeg(segs[start.i]) : reverseSeg(segs[start.i]);
    chain.push({ seg: first, source: "outline" }); used[start.i] = true; let cur = first.to;
    for (let step = 1; step < n; step++) {
      let found = -1, oriented = null;
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        if (_near2(segs[j].from, cur)) { found = j; oriented = cloneSeg(segs[j]); break; }
        if (_near2(segs[j].to, cur)) { found = j; oriented = reverseSeg(segs[j]); break; }
      }
      if (found < 0) return { ok: false, reason: "외곽선이 단일 체인이 아님(토폴로지 예외)" };
      oriented.from = _pt(cur);                       // 내부 junction 정확 공유(drift 제거)
      used[found] = true; chain.push({ seg: oriented, source: "outline" }); cur = oriented.to;
    }
    if (!_near2(cur, goal)) return { ok: false, reason: "외곽선 체인이 다트 입구에서 끝나지 않음" };
    const legs = walkConstruction(constrLines, cur, start.p);   // 입구→apex→시작 입구
    if (!legs.ok) return { ok: false, reason: legs.reason };
    legs.segs.forEach((s, idx) => { if (idx === 0) s.from = _pt(cur); chain.push({ seg: s, source: "dartleg" }); });
    // 폐곡선 정확 닫기: 마지막 to = 첫 from
    const last = chain[chain.length - 1].seg;
    if (Math.hypot(last.to.x - chain[0].seg.from.x, last.to.y - chain[0].seg.from.y) > RING_EPS) return { ok: false, reason: "폐곡선이 닫히지 않음" };
    last.to = _pt(chain[0].seg.from);
    return { ok: true, ring: chain };
  }
  // ring 을 위치 A(=proj)에서 B(=proj)까지 forward 로 걷는 부분 경로(정확 분할).
  function extractArc(ring, A, B) {
    const n = ring.length, out = [];
    if (A.i === B.i && A.t <= B.t) { const s = subSegment(ring[A.i].seg, A.t, B.t); if (_segLen(s) > 1e-9) out.push(s); return out; }
    const tail = subSegment(ring[A.i].seg, A.t, 1); if (_segLen(tail) > 1e-9) out.push(tail);
    let k = (A.i + 1) % n;
    while (k !== B.i) { out.push(cloneSeg(ring[k].seg)); k = (k + 1) % n; }
    const head = subSegment(ring[B.i].seg, 0, B.t); if (_segLen(head) > 1e-9) out.push(head);
    return out;
  }
  function forceCutEnds(cutSegs, p0, p1) {
    const out = cutSegs.map(cloneSeg);
    out[0].from = _pt(p0); out[out.length - 1].to = _pt(p1); return out;
  }
  function _flattenPart(segs) { const pts = []; segs.forEach(s => { flattenSegment(s).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); }); return pts; }
  function _signedArea(pts) { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
  function _partSelfIntersects(segs) {
    const flat = []; segs.forEach(s => flattenSegment(s).forEach(ab => flat.push(ab)));
    for (let i = 0; i < flat.length; i++) for (let j = i + 2; j < flat.length; j++) {
      if (i === 0 && j === flat.length - 1) continue;   // 폐곡선 wrap 인접
      const p = segCross(flat[i][0], flat[i][1], flat[j][0], flat[j][1]);
      if (p) {
        const shareEnd = _near2(flat[i][1], flat[j][0]) || _near2(flat[j][1], flat[i][0]) || _near2(flat[i][0], flat[j][0]) || _near2(flat[i][1], flat[j][1]);
        if (!shareEnd) return true;
      }
    }
    return false;
  }
  function _checkPart(part) {
    if (part.length < 2) return { ok: false, reason: "세그먼트 부족" };
    for (let i = 0; i < part.length - 1; i++) if (Math.hypot(part[i].to.x - part[i + 1].from.x, part[i].to.y - part[i + 1].from.y) > CLOSE_EPS) return { ok: false, reason: "연속성 끊김" };
    const closeErr = Math.hypot(part[part.length - 1].to.x - part[0].from.x, part[part.length - 1].to.y - part[0].from.y);
    if (closeErr > CLOSE_EPS) return { ok: false, reason: "폐곡선 미연결" };
    if (_partSelfIntersects(part)) return { ok: false, reason: "자기 교차" };
    const area = _signedArea(_flattenPart(part));
    if (Math.abs(area) < SPLIT_MIN_AREA) return { ok: false, reason: "면적 0" };
    return { ok: true, area: area };
  }
  // 유효 절개선으로 ring 을 두 폐곡선으로 분할. 반환 {ok, parts:[segsA, segsB], reason}.
  // 1차 제한: 끝점이 outline(다트 다리 아님) 위, 절개선이 다트 다리를 가로지르지 않음.
  function splitRingByCut(ring, cutSegs, opts) {
    opts = opts || {}; const onTol = opts.onTol != null ? opts.onTol : 0.05;
    if (!cutSegs || !cutSegs.length) return { ok: false, reason: "절개선 없음" };
    const C0 = cutSegs[0].from, C1 = cutSegs[cutSegs.length - 1].to;
    const pj0 = projectOntoRing(C0, ring), pj1 = projectOntoRing(C1, ring);
    if (pj0.dist > onTol) return { ok: false, reason: "절개선 시작점이 경계에서 벗어남" };
    if (pj1.dist > onTol) return { ok: false, reason: "절개선 끝점이 경계에서 벗어남" };
    if (ring[pj0.i].source !== "outline" || ring[pj1.i].source !== "outline") return { ok: false, reason: "절개선 끝점이 다트 다리 위 — 후속 지원" };
    const cutFlat = flattenLine(cutSegs);
    for (const r of ring) {
      if (r.source !== "dartleg") continue;
      for (const cs of cutFlat) { const p = segCross(cs[0], cs[1], r.seg.from, r.seg.to); if (p && !nearAny(p, [C0, C1], onTol)) return { ok: false, reason: "절개선이 다트를 가로지름 — 후속 지원" }; }
    }
    if (pj0.i === pj1.i && Math.abs(pj0.t - pj1.t) < 1e-6) return { ok: false, reason: "절개선 양끝이 같은 지점" };
    const arcA = extractArc(ring, pj0, pj1), arcB = extractArc(ring, pj1, pj0);
    const cutFwd = forceCutEnds(cutSegs, pj0.point, pj1.point);      // pj0.point → pj1.point
    const cutRev = cutFwd.slice().reverse().map(reverseSeg);         // pj1.point → pj0.point
    const partA = arcA.concat(cutRev), partB = arcB.concat(cutFwd);
    const cA = _checkPart(partA); if (!cA.ok) return { ok: false, reason: "파트 A: " + cA.reason };
    const cB = _checkPart(partB); if (!cB.ok) return { ok: false, reason: "파트 B: " + cB.reason };
    const ringArea = _signedArea(_flattenPart(ring.map(r => r.seg)));
    if (Math.sign(cA.area) !== Math.sign(ringArea) || Math.sign(cB.area) !== Math.sign(ringArea)) return { ok: false, reason: "파트 방향 오류" };
    return { ok: true, parts: [partA, partB] };
  }

  // ── 외곽 대체선(boundary) — 순수 ──
  // extractArc 의 source(outline/dartleg) 태깅 버전. 대체 arc 의 다트 포함 판정·유지 arc 의
  // dartleg 제거(다트 입구 열림 유지)에 필요.
  function extractArcTagged(ring, A, B) {
    const n = ring.length, out = [];
    if (A.i === B.i && A.t <= B.t) { const s = subSegment(ring[A.i].seg, A.t, B.t); if (_segLen(s) > 1e-9) out.push({ seg: s, source: ring[A.i].source }); return out; }
    const tail = subSegment(ring[A.i].seg, A.t, 1); if (_segLen(tail) > 1e-9) out.push({ seg: tail, source: ring[A.i].source });
    let k = (A.i + 1) % n;
    while (k !== B.i) { out.push({ seg: cloneSeg(ring[k].seg), source: ring[k].source }); k = (k + 1) % n; }
    const head = subSegment(ring[B.i].seg, 0, B.t); if (_segLen(head) > 1e-9) out.push({ seg: head, source: ring[B.i].source });
    return out;
  }
  function _arcLen(tagged) { let L = 0; tagged.forEach(o => flattenSegment(o.seg).forEach(ab => { L += Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y); })); return L; }
  // 대체선 하나의 계획(공용): 끝점 투영·짧은 arc 선택·다트/모호/교차 검증 → {ok, reason,
  // kept, replaced, bnd(방향·끝점 강제), aPos, bPos(대체 arc 의 ring position 구간, forward)}.
  // replaceArcOnRing(단일)·composeDesignOutline(다중) 이 공유해 동작 일치를 강제한다.
  function _boundaryPlan(ring, boundarySegs, opts) {
    opts = opts || {}; const onTol = opts.onTol != null ? opts.onTol : 0.05, ambRatio = opts.ambRatio != null ? opts.ambRatio : 0.9;
    if (!boundarySegs || !boundarySegs.length) return { ok: false, reason: "대체선 없음" };
    const B0 = boundarySegs[0].from, B1 = boundarySegs[boundarySegs.length - 1].to;
    const pj0 = projectOntoRing(B0, ring), pj1 = projectOntoRing(B1, ring);
    if (pj0.dist > onTol) return { ok: false, reason: "대체선 시작점이 경계에서 벗어남" };
    if (pj1.dist > onTol) return { ok: false, reason: "대체선 끝점이 경계에서 벗어남" };
    if (ring[pj0.i].source !== "outline" || ring[pj1.i].source !== "outline") return { ok: false, reason: "대체선 끝점이 다트 다리 위 — 후속 지원" };
    if (pj0.i === pj1.i && Math.abs(pj0.t - pj1.t) < 1e-6) return { ok: false, reason: "대체선 양끝이 같은 지점" };
    const arcA = extractArcTagged(ring, pj0, pj1), arcB = extractArcTagged(ring, pj1, pj0);
    const lenA = _arcLen(arcA), lenB = _arcLen(arcB), mn = Math.min(lenA, lenB), mx = Math.max(lenA, lenB);
    if (mx > 0 && mn / mx > ambRatio) return { ok: false, reason: "대체할 arc 가 모호함(양쪽 길이 유사)" };
    const aShort = lenA <= lenB;                                       // 짧은 arc = 대체
    const replaced = aShort ? arcA : arcB, kept = aShort ? arcB : arcA;
    const aPos = aShort ? { i: pj0.i, t: pj0.t } : { i: pj1.i, t: pj1.t };   // 대체 arc forward 시작
    const bPos = aShort ? { i: pj1.i, t: pj1.t } : { i: pj0.i, t: pj0.t };   //          forward 끝
    if (replaced.some(o => o.source === "dartleg")) return { ok: false, reason: "대체 arc 가 다트를 포함 — 후속 지원" };
    const bFlat = flattenLine(boundarySegs);
    for (let i = 0; i < bFlat.length; i++) for (let j = i + 2; j < bFlat.length; j++) if (segCross(bFlat[i][0], bFlat[i][1], bFlat[j][0], bFlat[j][1])) return { ok: false, reason: "대체선이 자기 자신과 교차" };
    for (const o of kept) for (const kb of flattenSegment(o.seg)) for (const bs of bFlat) { const p = segCross(bs[0], bs[1], kb[0], kb[1]); if (p && !nearAny(p, [B0, B1], onTol)) return { ok: false, reason: "대체선이 유지 경계와 교차" }; }
    const keptStart = kept[0].seg.from, keptEnd = kept[kept.length - 1].seg.to;
    let bnd = boundarySegs.map(cloneSeg);
    const dFwd = Math.hypot(bnd[0].from.x - keptEnd.x, bnd[0].from.y - keptEnd.y) + Math.hypot(bnd[bnd.length - 1].to.x - keptStart.x, bnd[bnd.length - 1].to.y - keptStart.y);
    const dRev = Math.hypot(bnd[0].from.x - keptStart.x, bnd[0].from.y - keptStart.y) + Math.hypot(bnd[bnd.length - 1].to.x - keptEnd.x, bnd[bnd.length - 1].to.y - keptEnd.y);
    if (dRev < dFwd) bnd = bnd.slice().reverse().map(reverseSeg);
    bnd[0].from = _pt(keptEnd); bnd[bnd.length - 1].to = _pt(keptStart);
    return { ok: true, kept: kept, replaced: replaced, bnd: bnd, aPos: aPos, bPos: bPos };
  }
  // 대체선으로 ring 의 **짧은 arc** 를 교체한 파생 outline 반환(단일). 원본 geometry 불변.
  function replaceArcOnRing(ring, boundarySegs, opts) {
    const pl = _boundaryPlan(ring, boundarySegs, opts); if (!pl.ok) return pl;
    const testLoop = pl.kept.map(o => o.seg).concat(pl.bnd);        // 다트 포함 닫은 테스트 루프
    const chk = _checkPart(testLoop); if (!chk.ok) return { ok: false, reason: "결과 폐곡선 무효: " + chk.reason };
    const ringArea = _signedArea(_flattenPart(ring.map(r => r.seg)));
    if (Math.sign(chk.area) !== Math.sign(ringArea)) return { ok: false, reason: "결과 방향 오류" };
    const keptOutline = pl.kept.filter(o => o.source === "outline").map(o => o.seg);
    return { ok: true, outline: pl.bnd.concat(keptOutline) };       // 대체선 + 유지 outline(다트 입구 열림)
  }
  // 대체 arc 의 forward position 구간(aPos→bPos)을 세그먼트별 [t0,t1] 범위로.
  function _intervalRanges(a, b, N) {
    const out = [];
    if (a.i === b.i && a.t <= b.t) { if (b.t - a.t > 1e-12) out.push({ seg: a.i, t0: a.t, t1: b.t }); return out; }
    if (1 - a.t > 1e-12) out.push({ seg: a.i, t0: a.t, t1: 1 });
    let k = (a.i + 1) % N;
    while (k !== b.i) { out.push({ seg: k, t0: 0, t1: 1 }); k = (k + 1) % N; }
    if (b.t > 1e-12) out.push({ seg: b.i, t0: 0, t1: b.t });
    return out;
  }
  function _rangesOverlap(r1, r2) {
    for (const x of r1) for (const y of r2) if (x.seg === y.seg) { const lo = Math.max(x.t0, y.t0), hi = Math.min(x.t1, y.t1); if (hi - lo > 1e-6) return true; }
    return false;
  }
  function _canonKey(s) { return [s.kind, s.from.x, s.from.y, s.to.x, s.to.y, s.c1 ? s.c1.x : 0, s.c1 ? s.c1.y : 0, s.c2 ? s.c2.x : 0, s.c2 ? s.c2.y : 0].map(v => typeof v === "number" ? v.toFixed(6) : v).join(","); }
  // 여러 유효 boundary 를 **원본 ring 기준으로 한 번에 합성**한 파생 design outline.
  // 순서 무관(원본 ring 위 대체 구간 집합으로 결정 + 정준 정렬). 대체 구간이 겹치면 거부.
  // 반환 {ok, outline:[유지 outline 서브세그먼트 + 대체선들], reason}. 원본 geometry 불변.
  function composeDesignOutline(ring, boundaryList, opts) {
    if (!Array.isArray(boundaryList) || !boundaryList.length) return { ok: false, reason: "대체선 없음" };
    const N = ring.length, specs = [];
    for (const segs of boundaryList) {
      const rr = replaceArcOnRing(ring, segs, opts); if (!rr.ok) return { ok: false, reason: rr.reason };   // 개별 유효성
      const pl = _boundaryPlan(ring, segs, opts);
      specs.push({ ranges: _intervalRanges(pl.aPos, pl.bPos, N), bnd: pl.bnd });
    }
    for (let i = 0; i < specs.length; i++) for (let j = i + 1; j < specs.length; j++) if (_rangesOverlap(specs[i].ranges, specs[j].ranges)) return { ok: false, reason: "대체 구간이 겹침" };
    // 세그먼트별 covered 범위
    const cov = {};
    specs.forEach(s => s.ranges.forEach(r => { (cov[r.seg] = cov[r.seg] || []).push([r.t0, r.t1]); }));
    const out = [];
    for (let k = 0; k < N; k++) {
      if (ring[k].source === "dartleg") continue;                    // 다트 다리 출력 안 함(입구 열림)
      const cr = (cov[k] || []).slice().sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      for (const c of cr) { if (c[0] - cursor > 1e-9) { const sub = subSegment(ring[k].seg, cursor, c[0]); if (_segLen(sub) > 1e-9) out.push(sub); } cursor = Math.max(cursor, c[1]); }
      if (1 - cursor > 1e-9) { const sub = subSegment(ring[k].seg, cursor, 1); if (_segLen(sub) > 1e-9) out.push(sub); }
    }
    specs.forEach(s => s.bnd.forEach(seg => out.push(cloneSeg(seg))));   // 대체선 삽입
    // 합성 결과 폐곡선 검증(다트 다리로 닫아 단순·면적·재연결 확인)
    const dartLegs = ring.filter(r => r.source === "dartleg").map(r => ({ from: r.seg.from, to: r.seg.to }));
    const cr2 = buildPieceRing(out, dartLegs);
    if (!cr2.ok) return { ok: false, reason: "합성 외곽선이 폐곡선을 이루지 못함: " + cr2.reason };
    const area = _signedArea(_flattenPart(cr2.ring.map(r => r.seg)));
    if (Math.abs(area) < SPLIT_MIN_AREA) return { ok: false, reason: "합성 결과 면적 0" };
    if (_partSelfIntersects(cr2.ring.map(r => r.seg))) return { ok: false, reason: "합성 결과 자기교차" };
    out.sort((a, b) => _canonKey(a) < _canonKey(b) ? -1 : _canonKey(a) > _canonKey(b) ? 1 : 0);   // 순서 무관 정준화
    return { ok: true, outline: out };
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
    mode = m; draft = null; drawDrag = null; lastDown = null; editDrag = null; selectedId = null; snapHint = null;
    setNote(m === "draw" ? "첫 점을 클릭(또는 드래그)하세요" : m === "select" ? SELECT_NOTE : "");
    syncButtons(); syncRoleButtons(); syncCutStatus(); rerender();
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
    invalidateParts(p);
    draft = null; drawDrag = null; lastDown = null; setNote("완료 · 새 선은 다시 첫 점부터"); rerender(); return true;
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
    invalidateParts(p);
    selectedId = null; editDrag = null; setNote("선 삭제됨 · 다른 선을 클릭"); syncRoleButtons(); syncCutStatus(); rerender();
  }
  // 선택한 선의 역할 지정(cut/boundary/guide). 표시만 바뀌고 outline 분할은 다음 단계.
  function setRole(role) {
    if (mode !== "select" || !selectedId || !ROLE_LABEL[role]) return;
    const line = findLine(selectedId); if (!line) return;
    line.role = role; invalidateParts(); setNote("역할: " + ROLE_LABEL[role]); syncRoleButtons(); syncCutStatus(); rerender();
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
  // 선택한 절개선을 **현재 working outline** 기준으로 재검사(snapHint 아님). geometry 무변경.
  // 반환 {ok, reason} | null(cut 아님/미선택). 다음 단계 파트 분리는 ok 인 것만 소비.
  function validateSelectedCut() {
    const line = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    if (!line || line.role !== "cut") return null;
    const p = project(); if (!p) return null;
    const outlineFlat = flattenLine(currentOutlineSegs(p, line.piece));   // 합성 design outline 이 있으면 그 기준
    const others = lines().filter(l => l.piece === line.piece && l.role === "cut" && l.id !== line.id).map(l => flattenLine(l.segments));
    return validateCut(line, outlineFlat, others);
  }
  // 검사 결과를 UI 상태로만 표시(#designCutStatus). data-ok 로 통과/실패 색 구분.
  function syncCutStatus() {
    const el = document.getElementById("designCutStatus"); if (!el) return;
    const v = validateSelectedCut();
    if (!v) { el.textContent = ""; el.removeAttribute("data-ok"); syncSplitButton(); syncBoundaryStatus(); syncComposeButton(); return; }
    el.textContent = v.ok ? "분리 가능" : v.reason;
    el.setAttribute("data-ok", v.ok ? "1" : "0");
    syncSplitButton();
    syncBoundaryStatus();
    syncComposeButton();
  }
  // ── 파트 분리 DOM 연동 ──
  function constrLinesOf(geom, keys) {
    const out = [];
    keys.forEach(k => { const b = geom[k]; if (!b) return; (b.construction || []).forEach(pr => { if (pr.kind === "line") out.push({ from: pr.from, to: pr.to }); }); });
    return out;
  }
  // 현재 piece(front/back)의 **작업 기준 outline**: 합성된 design outline 이 있으면 그것,
  // 없으면 원본 working.geometry outline. cut/parts 는 이 outline 을 기준으로 검증한다.
  function currentOutlineSegs(p, piece) {
    const dOut = p.working.designOutline && p.working.designOutline[piece];
    if (dOut && Array.isArray(dOut.outline) && dOut.outline.length) return dOut.outline.map(cloneSeg);
    const keys = PIECE_GEOM_KEYS[piece] || [piece];
    return outlineSegsOf(p.working.geometry, keys);
  }
  // 현재 작업 기준 outline(합성 design outline 우선) + 원본 다트 다리로 폐곡선 ring 구성.
  function buildRingForPiece(p, piece) {
    const keys = PIECE_GEOM_KEYS[piece] || [piece];
    return buildPieceRing(currentOutlineSegs(p, piece), constrLinesOf(p.working.geometry, keys));
  }
  // geometry·절개선 변경 시 기존 파생(파트·boundary 미리보기·합성 design outline) 즉시 무효화.
  function invalidateParts(p) {
    p = p || project(); let ch = false;
    if (p && Array.isArray(p.working.parts) && p.working.parts.length) { p.working.parts = []; ch = true; }
    if (p && p.working.boundaryPreview) { p.working.boundaryPreview = null; ch = true; }
    if (p && p.working.designOutline) { p.working.designOutline = null; ch = true; }
    return ch;
  }
  // 파트 분리 버튼: 유효 절개선 선택 시에만 활성.
  function syncSplitButton() {
    const b = document.getElementById("btnDesignSplit"); if (!b) return;
    const v = validateSelectedCut(); b.disabled = !(v && v.ok);
  }
  function setSplitNote(m) { const el = document.getElementById("designSplitNote"); if (el) el.textContent = m; }
  // 선택된 유효 절개선 1개로 실제 분할 실행. 분할 직전 validateCut 재실행 → ring 구성 →
  // splitRingByCut → 성공 시에만 working.parts 원자적 교체 → 미리보기 렌더.
  function doSplit() {
    if (mode !== "select" || !selectedId) return;
    const line = findLine(selectedId); if (!line || line.role !== "cut") { setSplitNote("절개선을 선택하세요"); return; }
    if (line.piece !== "front" && line.piece !== "back") { setSplitNote("front·back 만 지원(소매는 후속)"); return; }
    const p = project(); if (!p) return;
    const v = validateSelectedCut();                       // ★ 분할 직전 재검증
    if (!v || !v.ok) { setSplitNote("분할 불가: " + (v ? v.reason : "절개선 아님")); return; }
    const rb = buildRingForPiece(p, line.piece);
    if (!rb.ok) { setSplitNote("분할 불가: " + rb.reason); return; }
    const res = splitRingByCut(rb.ring, line.segments);
    if (!res.ok) { setSplitNote("분할 불가: " + res.reason); return; }   // 실패 시 working.parts 불변
    p.working.parts = [                                     // 성공 후에만 원자적 교체
      { id: "part-1", sourcePiece: line.piece, sourceCutId: line.id, outline: res.parts[0] },
      { id: "part-2", sourcePiece: line.piece, sourceCutId: line.id, outline: res.parts[1] }
    ];
    setSplitNote("분할 완료 · 두 파트(다른 색) 미리보기");
    rerender();
  }
  // ── 외곽 대체선(boundary) DOM 연동 ──
  // 선택된 boundary 선을 현재 working outline 기준으로 검증 + 파생 outline 계산.
  // 반환 {ok, reason, outline?} | null(boundary 아님/미선택). geometry 무변경.
  function validateSelectedBoundary() {
    const line = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    if (!line || line.role !== "boundary") return null;
    if (line.piece !== "front" && line.piece !== "back") return { ok: false, reason: "front·back 만 지원(소매는 후속)" };
    const p = project(); if (!p) return null;
    const rb = buildRingForPiece(p, line.piece);
    if (!rb.ok) return { ok: false, reason: rb.reason };
    return replaceArcOnRing(rb.ring, line.segments);
  }
  function syncBoundaryStatus() {
    const el = document.getElementById("designBoundaryStatus");
    const v = validateSelectedBoundary();
    if (el) {
      if (!v) { el.textContent = ""; el.removeAttribute("data-ok"); }
      else { el.textContent = v.ok ? "대체 가능" : v.reason; el.setAttribute("data-ok", v.ok ? "1" : "0"); }
    }
    const b = document.getElementById("btnDesignBoundary"); if (b) b.disabled = !(v && v.ok);
  }
  function setBoundaryNote(m) { const el = document.getElementById("designBoundaryNote"); if (el) el.textContent = m; }
  // 선택된 유효 대체선으로 파생 outline 미리보기 생성. 성공 시에만 working.boundaryPreview
  // 원자적 교체. 원본 geometry·patternLines 불변, geometry·대체선 변경 시 무효화.
  function doBoundaryPreview() {
    if (mode !== "select" || !selectedId) return;
    const line = findLine(selectedId); if (!line || line.role !== "boundary") { setBoundaryNote("외곽 대체선을 선택하세요"); return; }
    const p = project(); if (!p) return;
    const v = validateSelectedBoundary();                  // ★ 미리보기 직전 재검증
    if (!v || !v.ok) { setBoundaryNote("대체 불가: " + (v ? v.reason : "대체선 아님")); return; }
    p.working.boundaryPreview = { sourcePiece: line.piece, sourceLineId: line.id, outline: v.outline };
    setBoundaryNote("대체 미리보기 · 파생 외곽선(다른 색)");
    rerender();
  }
  // ── 디자인 외곽 합성 DOM 연동 ──
  function pieceBoundaries(piece) { return lines().filter(l => l.piece === piece && l.role === "boundary"); }
  // 한 piece 의 모든 boundary 를 **원본 ring 기준으로** 합성. {ok, empty?, outline?, lineIds?, reason?}.
  function composeForPiece(p, piece) {
    const bl = pieceBoundaries(piece);
    if (!bl.length) return { ok: true, empty: true };
    const keys = PIECE_GEOM_KEYS[piece] || [piece];
    const rb = buildPieceRing(outlineSegsOf(p.working.geometry, keys), constrLinesOf(p.working.geometry, keys));   // ★ 원본 ring
    if (!rb.ok) return { ok: false, reason: rb.reason };
    const res = composeDesignOutline(rb.ring, bl.map(l => l.segments));
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, outline: res.outline, lineIds: bl.map(l => l.id) };
  }
  function setComposeNote(m) { const el = document.getElementById("designComposeNote"); if (el) el.textContent = m; }
  function syncComposeButton() {
    const b = document.getElementById("btnDesignCompose"); if (!b) return;
    b.disabled = !lines().some(l => l.role === "boundary" && (l.piece === "front" || l.piece === "back"));
  }
  // front/back 각 피스의 boundary 를 합성해 working.designOutline 에 저장. 한 피스라도 실패하면
  // 전체 중단(저장 안 함). 성공 시 parts·boundaryPreview 는 정리(원본 기준이라 stale).
  function doComposeDesignOutline() {
    const p = project(); if (!p) return;
    const result = {};
    for (const pc of ["front", "back"]) {
      const r = composeForPiece(p, pc);
      if (!r.ok) { setComposeNote("합성 불가(" + pc + "): " + r.reason); return; }   // 실패 시 저장 안 함
      if (!r.empty) result[pc] = { outline: r.outline, lineIds: r.lineIds };
    }
    if (!Object.keys(result).length) { p.working.designOutline = null; setComposeNote("합성할 외곽 대체선이 없습니다"); rerender(); return; }
    p.working.parts = []; p.working.boundaryPreview = null;   // 원본 기준 파생 정리(designOutline 은 유지)
    p.working.designOutline = result;                         // 원자적 저장
    setComposeNote("디자인 외곽 합성 완료 · cut 은 이 외곽 기준으로 검증");
    rerender();
  }
  // geometry 재계산(엉덩이 길이 등) 후 외부(ui.js)에서 호출: 절개선 재검사 + 파생 무효화.
  function revalidate() { invalidateParts(); syncRoleButtons(); syncCutStatus(); syncSplitButton(); rerender(); }
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
        const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        // 수동 더블클릭 = 완료(네이티브 dblclick 은 rerender 로 DOM 이 매 클릭 재생성돼 안 뜬다).
        // 이번(두 번째) 눌림은 중복점이므로 추가하지 않고 현재 draft 를 그대로 커밋한다.
        if (draft && lastDown && (now - lastDown.t) < DBLCLICK_MS && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < DBLCLICK_PX) {
          lastDown = null; drawDrag = null; e.stopPropagation(); if (e.preventDefault) e.preventDefault();
          commitDraft();   // ≥2 anchors 필요; 미만이면 무시(안내)
          return;
        }
        // 새 anchor 는 snap 적용(같은 피스 · working geometry 기준 · Alt 해제).
        const placeGeo = pc => { const g = geoAt(e, pc); const s = snapForCursor(g, pc, e.altKey, null); snapHint = s ? { piece: pc, point: s.point, type: s.type } : null; return s ? { x: s.point.x, y: s.point.y } : g; };
        if (!draft) {
          if (!piece) { setNote("피스 위를 클릭하세요"); return; }
          draft = { piece: piece, anchors: [{ p: placeGeo(piece), h: null }] }; setNote(DRAW_NOTE);
        } else if (piece !== draft.piece) { setNote("같은 피스 안에서 이어 그리세요"); return; }
        else { draft.anchors.push({ p: placeGeo(draft.piece), h: null }); setNote(DRAW_NOTE); }
        lastDown = { t: now, x: e.clientX, y: e.clientY };
        drawDrag = { startX: e.clientX, startY: e.clientY };
      } else { // select
        if (!piece) { selectedId = null; editDrag = null; setNote(SELECT_NOTE); }
        else selectDown(e, piece, geoAt(e, piece));
        syncRoleButtons(); syncCutStatus();   // 선택 변화 → 역할 버튼·절개 검사 갱신
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
        invalidateParts();   // anchor·핸들 편집으로 절개선 변경 → 파트 무효화
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
    // 네이티브 dblclick 은 매 pointerdown 의 rerender 로 DOM 이 재생성돼 발화하지 않는다 →
    // 완료(더블클릭)는 위 pointerdown 의 수동 감지(DBLCLICK_MS·DBLCLICK_PX)로 처리한다.
    document.addEventListener("keydown", e => {
      if (mode === "off" || !inDesign()) return;
      const t = e.target; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (mode === "draw") {
        if (e.key === "Escape") { draft = null; drawDrag = null; lastDown = null; setNote("취소됨 · 첫 점을 다시 찍으세요"); rerender(); }
        else if (e.key === "Enter" && draft) { e.preventDefault(); commitDraft(); }
        else if (e.key === "Backspace" && draft) { e.preventDefault(); draftBackspace(); }
      } else { // select
        if (e.key === "Escape") { selectedId = null; editDrag = null; setNote(SELECT_NOTE); syncRoleButtons(); syncCutStatus(); rerender(); }
        else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSelected(); }
      }
    });
  }

  window.designLineTool = Object.freeze({
    toggle, toggleSelect, setMode, getMode, cancel: () => setMode("off"), isActive,
    getDraft, getSelectedId, getSelectionOverlay, getSnapHint, deleteSelected, setRole,
    validateSelectedCut, revalidate, validateCut, flattenLine, segCross, distPtToSegs,
    doSplit, invalidateParts, doBoundaryPreview, validateSelectedBoundary, doComposeDesignOutline,
    // 순수
    pointToGeometryCm, geometryToDrawCm, segmentsFromAnchors, makePatternLine, nextId,
    anchorsFromSegments, moveAnchor, distToLine, distToSegment, handlesOf,
    chooseSnap, closestOnSeg, nearestOnSegs, flattenSegment, constrainAngle45,
    // 파트 분리·외곽 대체(순수)
    buildPieceRing, splitRingByCut, subSegment, reverseSeg, projectOntoRing, projectOntoSeg, walkConstruction,
    replaceArcOnRing, extractArcTagged, composeDesignOutline
  });
})();
