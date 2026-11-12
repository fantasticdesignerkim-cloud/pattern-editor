// ══════════════════════════════════════════════
// js/designLineTool.js — Design 패턴선 도구(그리기 + 선택·편집).
//
// 모드 분리(핵심 계약): mode ∈ {"off","draw","select"}. 그리기 모드와 선택 모드를
// 명확히 분리한다. 작성 중(draw)에는 기존 선 선택을 막는다.
//
// [draw] 클릭=직선 점 / 클릭-드래그=곡선(베지어) 점. 하나의 patternLine 에 line·cubic
//   혼합. 완료(«그리기 완료» 버튼 = 주 경로 · Enter·더블클릭 호환)·취소(Esc · 그리기 중 «그리기 취소» 버튼)·
//   Backspace(마지막 점)·서로 다른 2점 미만 불가·다른 피스 거부·
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
  const SNAP_LABEL = { anchor: "기존 anchor", endpoint: "형상 끝점", outline: "외곽선", grid: "격자 0.5cm", seam: "옆선 목표 길이" };
  const BODICE_COMPOSE_OPTS = Object.freeze({ inheritSideSeam: true });   // 몸판 앞·뒤 합성(designOutline) 전용 — 옆선 의미 승계
  const ROLE_LABEL = { cut: "절개선", boundary: "외곽 대체선", guide: "보조선" };

  let mode = "off";
  let draft = null, drawDrag = null, lastDown = null;   // draw 상태(lastDown = 직전 pointerdown 시각·위치)
  let selectedId = null, editDrag = null;            // select 상태
  let snapHint = null;                               // {piece, point, type} — 흡착 표시(세션 UI)
  let hoverPt = null;                                // 그리기 거리 안내(2026-11-08): {piece, point} — 다음 점이 놓일 자리(기존 snap·Alt 반영 · 마우스 hover 만)
  let splitState = null;                              // 마지막 파트 분리 판정(syncSplitButton 이 씀 · getSplitState 로 막대가 읽음 · 세션 UI)
  let boundaryState = null;                           // 마지막 외곽 대체 판정(syncBoundaryStatus 가 씀 · getBoundaryState 로 막대가 읽음 · 세션 UI · 2026-11-06)
  let lastHandleGeo = null;                           // 핸들 드래그 중 마지막 커서(형상 cm) — Shift 즉시 반영
  // 옆선 길이 자석(2026-11-06 · 세션 UI 설정 — 형상·완료본 무관): 켜짐/꺼짐 · 기준판(고정되는 판). seamCtx = 드래그 시작 때 한 번 만든 문맥,
  //   seamLive = 드래그 중 표시값(막대·캔버스 라벨). 드래그가 끝나면 둘 다 비우고 표시는 권위 계측(bodiceCheckpoint)으로 돌아간다.
  // 2026-11-08 김님 방향 전환: 자동 길이 보정 끔(기본 false · 사용자 UI 없음). 내부 API(setSeamMagnet)는 헤드리스 회귀 호환용으로만 남긴다 — 편집 드래그는 손 그대로 움직이고 일반 점·외곽 흡착만 남는다.
  let seamMagnetOn = false, seamBasis = "auto", seamCtx = null, seamLive = null, seamStateCache = null;

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
  // ── 의미 metadata 보존 ──
  // 유지 구간(대체되지 않고 남는 경계)은 잘리고·뒤집히고·복제돼도 **원본 semantic 을 그대로
  // 들고 가야** manual/designOutline 경로에서 의미가 유실되지 않는다. 좌표·kind·개수·순서는
  // 바뀌지 않는다(전부 own-property 로만 추가되고, 없으면 추가하지 않는다 — SV2 계약).
  // ★ `_canonKey`(정준 정렬)는 이 필드들을 보지 않는다 → 합성 결과의 정렬 순서 불변.
  //
  // 세 필드의 책임 분리:
  //   · edge             = **실제 semantic role 만**(neckline/shoulder/armhole/center/…).
  //                        "unresolved" 를 role 값으로 위장하지 않는다.
  //   · edgeStatus       = 해결 상태. 현재 유일한 값은 "unresolved"(의미 미지정 대체 구간).
  //   · edgeSourceLineId = 그 구간을 만든 patternLine 의 stable ID(provenance).
  //                        **중첩 객체가 아니라 평문 문자열** — clone/freeze 경로에서 공유
  //                        참조가 생길 여지를 아예 없앤다.
  //   · boundary         = (P0.3a) 생산자가 선언한 경계 identity { root, ranges:[[from,to]] }.
  //                        세그먼트(line/cubic) 하나는 구간 하나. 자르면 root 는 유지·구간만 좁히고
  //                        뒤집으면 구간 방향을 바꾼다. 매핑할 수 없으면 **버린다**(추측 금지).
  //   · edgeInherited    = (2026-11-06) 몸판 합성에서 대체된 원래 구간이 **전부 명시 side-seam** 이라 그 의미를 이어받았다는 표식(true).
  //   · replacedEdges    = (2026-11-06) 승계하지 못한 unresolved 대체선이 덮은 원래 의미 목록(옆선 일부를 덮었으면 측정 불가 판정용).
  const SEMANTIC_KEYS = ["edge", "edgeStatus", "edgeSourceLineId", "dart", "boundary", "edgeInherited", "replacedEdges"];
  //   ★ 중첩 객체(dart)는 **값 복제**한다 — 참조로 옮기면 잘라낸/뒤집은/합성한 작업 형상과
  //   원본 working.geometry 가 같은 객체를 공유해, 한쪽 변형이 다른 쪽을 오염시킨다.
  //   문자열 값(edge·edgeStatus·edgeSourceLineId)은 불변이라 그대로 옮긴다.
  function _copySemanticValue(v) {
    if (v === null || typeof v !== "object") return v;
    return (typeof structuredClone === "function") ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  }
  function _carryEdge(src, dst) {
    if (src) SEMANTIC_KEYS.forEach(k => { if (k in src) dst[k] = _copySemanticValue(src[k]); });
    return dst;
  }
  // 대체선(boundary patternLine)의 세그먼트를 합성 입력으로 변환한다.
  //   의미가 명시된 구간(예: 목선 전환 도구가 만든 edge:"neckline")은 그대로 승계하고,
  //   **의미가 없는 일반 replacement 구간에만** 명시적 unresolved + provenance 를 부여한다.
  //   → "edge 부재"만으로 unresolved 를 표현하지 않는다(다트 다리·구성선과 구분 가능).
  // P0.3a 경계 구간 lineage. 한 구간 안에서 root 파라미터는 세그먼트 자체 파라미터에 affine 이다.
  function _singleRange(seg) {
    const b = seg && seg.boundary;
    return (b && typeof b.root === "string" && Array.isArray(b.ranges) && b.ranges.length === 1) ? b.ranges[0] : null;
  }
  function _sliceBoundary(dst, t0, t1) {
    if (!("boundary" in dst)) return dst;
    const r = _singleRange(dst);
    if (!r) { delete dst.boundary; return dst; }
    dst.boundary = { root: dst.boundary.root, ranges: [[r[0] + (r[1] - r[0]) * t0, r[0] + (r[1] - r[0]) * t1]] };
    return dst;
  }
  function _reverseBoundary(dst) {
    if (!("boundary" in dst)) return dst;
    const r = _singleRange(dst);
    if (!r) { delete dst.boundary; return dst; }
    dst.boundary = { root: dst.boundary.root, ranges: [[r[1], r[0]]] };
    return dst;
  }
  // path primitive 의 k 번째 C 명령(전체 n 개)에 해당하는 구간만 남긴다. 선언 구간 수가 명령 수와
  // 다르면 어느 구간인지 알 수 없으므로 identity 를 싣지 않는다.
  function _commandBoundary(dst, k, n) {
    if (!("boundary" in dst)) return dst;
    const b = dst.boundary;
    if (!(b && typeof b.root === "string" && Array.isArray(b.ranges) && b.ranges.length === n)) { delete dst.boundary; return dst; }
    dst.boundary = { root: b.root, ranges: [[b.ranges[k][0], b.ranges[k][1]]] };
    return dst;
  }
  function boundarySegsOf(line) {
    const id = line && line.id;
    return ((line && line.segments) || []).map(s => {
      const o = cloneSeg(s);
      if (!("edge" in o)) { o.edgeStatus = "unresolved"; o.edgeSourceLineId = id || null; }
      return o;
    });
  }
  function subSegment(seg, t0, t1) {
    if (seg.kind === "line") return _sliceBoundary(_carryEdge(seg, { kind: "line", from: _lerpP(seg.from, seg.to, t0), to: _lerpP(seg.from, seg.to, t1) }), t0, t1);
    const R = _cubicBetween(seg.from, seg.c1, seg.c2, seg.to, t0, t1);
    return _sliceBoundary(_carryEdge(seg, { kind: "cubic", from: R[0], c1: R[1], c2: R[2], to: R[3] }), t0, t1);
  }
  function reverseSeg(seg) {
    if (seg.kind === "line") return _reverseBoundary(_carryEdge(seg, { kind: "line", from: _pt(seg.to), to: _pt(seg.from) }));
    return _reverseBoundary(_carryEdge(seg, { kind: "cubic", from: _pt(seg.to), c1: _pt(seg.c2), c2: _pt(seg.c1), to: _pt(seg.from) }));
  }
  function cloneSeg(seg) {
    return _carryEdge(seg, seg.kind === "cubic"
      ? { kind: "cubic", from: _pt(seg.from), c1: _pt(seg.c1), c2: _pt(seg.c2), to: _pt(seg.to) }
      : { kind: "line", from: _pt(seg.from), to: _pt(seg.to) });
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
  // 경계 분할점 → ring 접점 결속(2026-11-07 · 실측: 진동 path 끝 (23.053, 20.617)[원본 3자리 반올림] ↔ 옆선 시작·옆허리 다트 c apex (23.053125, 20.616667),
  //   차 0.000356cm = RING_EPS 주석의 «부동소수 drift 0.0004» — ring 은 둘을 한 접점으로 잇는다). 투영점과 그 세그먼트 끝(접점) 사이 남는 조각이
  //   ring 자신의 접점 판정 거리(RING_EPS)보다 짧으면, 그 조각은 ring 기준으로 접점과 구별되지 않는 가짜 변(0.00033cm 조각 → ring 걸음이 모호 → 연결 실패)이므로
  //   분할을 그 접점(t=0/1)에 정확히 둔다. 허용오차를 넓히지 않고(RING_EPS·CONNECT_EPS 그대로), 선 데이터·원본 형상은 바꾸지 않는다(합성 결과의 분할 위치만).
  function _bindJunction(pj, ring) {
    if (!pj || pj.i < 0) return pj;
    const seg = ring[pj.i].seg;
    if (pj.t > 0 && _segLen(subSegment(seg, 0, pj.t)) < RING_EPS) return Object.assign({}, pj, { t: 0, point: _pt(seg.from) });
    if (pj.t < 1 && _segLen(subSegment(seg, pj.t, 1)) < RING_EPS) return Object.assign({}, pj, { t: 1, point: _pt(seg.to) });
    return pj;
  }
  function _boundaryPlan(ring, boundarySegs, opts) {
    opts = opts || {}; const onTol = opts.onTol != null ? opts.onTol : 0.05, ambRatio = opts.ambRatio != null ? opts.ambRatio : 0.9;
    if (!boundarySegs || !boundarySegs.length) return { ok: false, reason: "대체선 없음" };
    const B0 = boundarySegs[0].from, B1 = boundarySegs[boundarySegs.length - 1].to;
    const pj0 = _bindJunction(projectOntoRing(B0, ring), ring), pj1 = _bindJunction(projectOntoRing(B1, ring), ring);
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
    if (opts.inheritSideSeam) _inheritSideSeam(bnd, replaced, kept);
    return { ok: true, kept: kept, replaced: replaced, bnd: bnd, aPos: aPos, bPos: bPos };
  }
  // 몸판 옆선 의미 승계(2026-11-06 김님 확정 «대체 구간 의미 승계» — 소매 «대체 구간 의미 하나»와 같은 원칙).
  //   대체된 원래 구간이 **전부 명시 edge "side-seam"**(허리 아래 연장 포함)일 때만, 의미 미지정 대체 구간에 side-seam 을 싣는다.
  //   좌표·형상 유사성은 보지 않는다(대체 구간의 선언 의미만). 다른 의미(진동·밑단·허리·구성선)가 섞이면 승계하지 않고
  //   unresolved 그대로 두되, 옆선 일부를 덮었다는 기록(replacedEdges)을 남겨 계측이 틀린 수치를 내지 않게 한다.
  //   명시 의미가 이미 있는 대체 구간(목선 전환 도구 등)은 건드리지 않는다. 몸판 합성 경로만 opts.inheritSideSeam 으로 켠다.
  //   ★ 2026-11-09 김님 확정 «옆선에서 밑단 안쪽으로 그린 선 전체 = 새 옆선 · 그 끝 = 새 밑단 모서리»(옆선→밑단 테이퍼만):
  //     대체된 원래 구간이 [명시 옆선 연속 → 명시 밑단 연속](또는 역순) 딱 두 덩어리이고, 밑단이 유지 쪽에도 남아 있을 때만
  //     대체선 전 구간을 side-seam 으로 승계한다(남은 밑단 = 밑단 그대로). 판정 = 대체 구간의 선언 의미 순서만(좌표 추측 없음).
  //     진동에서 끝남·밑단만 자름·중심선 침범·다른 의미가 섞임·밑단을 통째로 덮음 = 종전대로 unresolved(측정 불가).
  function _sideHemTaper(replaced, kept) {
    const seq = replaced.map(o => (o.source === "outline" && typeof o.seg.edge === "string") ? o.seg.edge : "(none)");
    if (!seq.length || seq.some(e => e !== "side-seam" && e !== "hem")) return false;
    const runs = seq.filter((e, i) => i === 0 || e !== seq[i - 1]);
    if (runs.length !== 2) return false;                                           // 옆선 덩어리 하나 + 밑단 덩어리 하나(끼어든 의미 없음)
    return (kept || []).some(o => o.source === "outline" && o.seg.edge === "hem");   // 남은 밑단 보존(밑단 전체를 덮지 않음)
  }
  //   ★ 2026-11-09 김님 확정 «셔츠형 둥근 밑단: 그린 곡선 = 새 밑단 · 남은 옆선 = 새 밑단 접점까지 옆선 · 남은 중심선 = 중심선»:
  //     대체된 원래 구간이 [(중심선 일부) → 밑단 전부 → 옆선 일부](또는 역순)이고 **원래 밑단이 하나도 남지 않을 때만** 대체선 = hem.
  //     밑단이 남는 경우(밑단 중간에서 시작)는 위 테이퍼와 출처가 같아 자동 구분 불가 — 여기서 판정하지 않는다(종전 테이퍼 규칙 그대로 · 보고).
  function _hemCurve(replaced, kept) {
    const seq = replaced.map(o => (o.source === "outline" && typeof o.seg.edge === "string") ? o.seg.edge : "(none)");
    if (!seq.length) return false;
    const runs = seq.filter((e, i) => i === 0 || e !== seq[i - 1]), r = runs[0] === "side-seam" ? runs.slice().reverse() : runs;
    const okSeq = (r.length === 2 && r[0] === "hem" && r[1] === "side-seam") || (r.length === 3 && r[0] === "center" && r[1] === "hem" && r[2] === "side-seam");
    if (!okSeq) return false;
    const keptEdge = e => (kept || []).some(o => o.source === "outline" && o.seg.edge === e);
    return !keptEdge("hem") && keptEdge("side-seam") && keptEdge("center");   // 밑단 전부 교체 · 옆선·중심선은 남음
  }
  function _inheritSideSeam(bnd, replaced, kept) {
    const edges = [];
    replaced.forEach(o => { const e = (o.source === "outline" && typeof o.seg.edge === "string") ? o.seg.edge : "(none)"; if (edges.indexOf(e) < 0) edges.push(e); });
    if (_hemCurve(replaced, kept)) { bnd.forEach(sg => { if (sg.edgeStatus === "unresolved") { sg.edge = "hem"; delete sg.edgeStatus; sg.edgeInherited = true; } }); return; }
    const pure = (edges.length === 1 && edges[0] === "side-seam") || _sideHemTaper(replaced, kept);
    bnd.forEach(sg => {
      if (sg.edgeStatus !== "unresolved") return;
      if (pure) { sg.edge = "side-seam"; delete sg.edgeStatus; sg.edgeInherited = true; }
      else if (edges.indexOf("side-seam") >= 0) sg.replacedEdges = edges.slice().sort();
    });
  }
  // 대체선으로 ring 의 **짧은 arc** 를 교체한 파생 outline 반환(단일). 원본 geometry 불변.
  //   opts.keepDartlegs(2026-11-06 소매 외곽 대체): 유지 arc 의 dartleg 구간도 출력에 남긴다 — 소매의 열린 다트 V(Ⓒ·Ⓦ)는
  //   봉합용 제도선이 아니라 **실제 외곽**이라 지우면 안 된다. 기본(몸판)은 종전대로 다트 다리(construction)를 빼서 입구를 연다.
  function replaceArcOnRing(ring, boundarySegs, opts) {
    const pl = _boundaryPlan(ring, boundarySegs, opts); if (!pl.ok) return pl;
    const testLoop = pl.kept.map(o => o.seg).concat(pl.bnd);        // 다트 포함 닫은 테스트 루프
    const chk = _checkPart(testLoop); if (!chk.ok) return { ok: false, reason: "결과 폐곡선 무효: " + chk.reason };
    const ringArea = _signedArea(_flattenPart(ring.map(r => r.seg)));
    if (Math.sign(chk.area) !== Math.sign(ringArea)) return { ok: false, reason: "결과 방향 오류" };
    const keptOutline = (opts && opts.keepDartlegs) ? pl.kept.map(o => o.seg) : pl.kept.filter(o => o.source === "outline").map(o => o.seg);
    return { ok: true, outline: pl.bnd.concat(keptOutline) };       // 대체선 + 유지 outline(몸판 = 다트 입구 열림 · keepDartlegs = 닫힌 한 고리)
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
  // outline primitive 배열(line·cubic·path[M/C]) → flattenLine 이 이해하는 line/cubic 세그먼트.
  //   geometry.outline 과 bodiceResult[piece].outline(frozen effective outline) 둘 다 이 형식을 거쳐야
  //   flattenSegment 가 raw path 를 [undefined,undefined] 로 내지 않는다.
  function outlinePrimsToSegs(outline) {
    const segs = [];
    (outline || []).forEach(pr => {
      // path 가 여러 C 로 쪼개져도 **각 span 이 같은 edge role 을 유지**한다(span 수는 identity 아님).
      if (pr.kind === "line") segs.push(_commandBoundary(_carryEdge(pr, { kind: "line", from: pr.from, to: pr.to }), 0, 1));
      else if (pr.kind === "cubic") segs.push(_commandBoundary(_carryEdge(pr, { kind: "cubic", from: pr.from, c1: pr.c1, c2: pr.c2, to: pr.to }), 0, 1));
      else if (pr.kind === "path") { const nC = pr.commands.filter(c => c.type === "C").length; let cur = null, k = 0; pr.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { segs.push(_commandBoundary(_carryEdge(pr, { kind: "cubic", from: cur, c1: c.points[0], c2: c.points[1], to: c.points[2] }), k++, nC)); cur = c.points[2]; } }); }
    });
    return segs;
  }
  function outlineSegsOf(geom, keys) {
    const segs = [];
    keys.forEach(k => { const b = geom[k]; if (!b) return; outlinePrimsToSegs(b.outline).forEach(s => segs.push(s)); });
    return segs;
  }
  function patternAnchorPts(piece, exclude) {
    const pts = [];
    lines().forEach(l => { if (l.piece !== piece) return; anchorsFromSegments(l.segments).forEach(a => { if (exclude && Math.abs(a.x - exclude.x) < EPS && Math.abs(a.y - exclude.y) < EPS) return; pts.push(a); }); });
    return pts;
  }
  // ── 편집 기준 몸판(2026-11-04 김님 승인 «최종 몸판 기준 절개선 편집 정합성») ──
  //   designResult 완료 판정의 «최종 몸판»(finalBodiceOf: 완료 소매의 derivedBodice ∥ bodiceResult)과 몸판 탭 절개선 상태·snap 이 같은 형상을 보게 한다.
  //   · original: 소매 파생 몸판이 화면(작업 중 Ⓡ~Ⓩ)에도 완료본에도 없음(Ⓐ~Ⓠ·원형·기존 몸판 편집) → **종전 경로 그대로**.
  //   · sleeve-derived: 완료 소매가 파생 몸판을 갖고 현재 상태와 일치 → 판정 = finalBodiceOf 의 frozen 조각(같은 validateCut · 같은 외곽 유틸 · 복제 없음).
  //   · pending: 화면 파생 몸판(작업 중)과 완료본이 어긋남(미완료·변경·차단·몸판 변경) → 판정하지 않고 재완료 이유만(옛 frozen 으로 판정하지 않음).
  //   snap 은 **화면에 그려진 형상**(작업 중 파생 몸판이 그려지면 그것 — sleeveAnnotation.dolmanBodice 와 같은 조건, 아니면 원래)에 붙는다.
  //     sleeve-derived 일 때 화면 = frozen(소매 체크포인트가 derivedBodice 바이트 동일을 «현재» 조건으로 본다).
  //   파트 분리(splitRingByCut)는 원래 몸판 ring 전용 → original 이 아닐 때는 실행·표시하지 않는다(파생 몸판을 원래 형상으로 자른 가짜 결과 금지).
  const DERIVED_SLEEVE_KEYS = ["sleeveZ", "sleeveY", "sleeveX", "sleeveW", "sleeveV", "sleeveU", "sleeveT", "sleeveS", "sleeveR"];   // dolmanBodice 와 같은 우선순위
  function symOfPresetId(id) { const m = /^bunka-sleeve-([A-Z])$/.exec(id || ""); return m ? String.fromCharCode(0x24B6 + m[1].charCodeAt(0) - 65) : (id || "?"); }
  function liveDerivedSleeve(p) {
    const w = p && p.working; if (!w) return null;
    for (const k of DERIVED_SLEEVE_KEYS) if (w[k]) return { key: k, state: w[k], presetId: w[k].presetId || ("bunka-sleeve-" + k.slice(-1)), sym: symOfPresetId(w[k].presetId || ("bunka-sleeve-" + k.slice(-1))) };
    return null;
  }
  // 화면에 그려진 작업 중 파생 몸판 조각(차단·미완성 상태면 그려지지 않으므로 null).
  function displayedDerivedPiece(p, piece) {
    const live = liveDerivedSleeve(p), st = live && live.state;
    if (!st || st.blocked || !st.derivedBodice || !(st.meta || st.rMeta)) return null;
    const pc = st.derivedBodice[piece];
    return pc && Array.isArray(pc.outline) && pc.outline.length ? pc : null;
  }
  // 원래 몸판 전용 동작(파트 분리)이 의미 있는지 — 싸다(완료 판정 없음). render 의 파트 미리보기도 이것으로 가린다.
  function isOriginalBodiceContext(p) {
    p = p || project(); if (!p) return true;
    if (liveDerivedSleeve(p)) return false;
    const SCk = window.sleeveCheckpoint, s = SCk && SCk.latest ? SCk.latest(p) : null;
    return !(s && s.derivedBodice);
  }
  function editBodiceRef(p) {
    p = p || project(); if (!p) return { source: "original" };
    if (isOriginalBodiceContext(p)) return { source: "original" };
    const live = liveDerivedSleeve(p), SCk = window.sleeveCheckpoint, BCk = window.bodiceCheckpoint, DR = window.designResult;
    const sleeve = SCk && SCk.latest ? SCk.latest(p) : null;
    const doneId = sleeve && sleeve.origin ? sleeve.origin.presetId : null, doneSym = doneId ? symOfPresetId(doneId) : null;
    const curSym = live ? live.sym : null;
    const pend = reason => ({ source: "pending", sym: curSym || doneSym, reason: reason });
    if (!SCk || !BCk || !DR || !DR.finalBodiceOf) return pend("최종 몸판 조회 모듈 없음");
    if (live && live.state.blocked) return pend("소매 " + curSym + " 적용이 차단됨(" + (live.state.blocked.text || live.state.blocked.reason || "차단") + ") — 화면은 원래 몸판만 보입니다 · 소매 탭에서 고쳐 다시 적용·완료하세요");
    const bodice = BCk.latest(p);
    if (!bodice) return pend("몸판 모양 완료 전");
    if (BCk.isCurrentBodiceChanged(p)) return pend("몸판이 완료 후 바뀜 — 몸판·소매 모양을 다시 완료해야 최종 몸판이 정해집니다");
    if (!sleeve) return pend("소매 " + curSym + " 모양 완료 전 — 완료하면 그 파생 몸판 기준으로 판정합니다");
    if (live && live.presetId !== doneId) return pend("완료된 소매는 " + doneSym + ", 현재 소매는 " + curSym + " — 소매 모양을 다시 완료해야 합니다");
    if (!live) return pend("완료된 소매 " + doneSym + "(파생 몸판)와 현재 소매가 다름 — 소매 모양을 다시 완료해야 합니다");
    if (sleeve.sourceBodiceHash !== bodice.hash || SCk.invalidatedByBodice(p)) return pend("소매 " + doneSym + " 완료본의 출처가 현재 몸판과 다름 — 소매 모양을 다시 완료하세요");
    if (SCk.isCurrentSleeveChanged(p)) return pend("소매 " + curSym + " 가 완료 후 바뀜(입력·형상) — 소매 모양을 다시 완료해야 합니다");
    const fin = DR.finalBodiceOf({ bodice: bodice, sleeve: sleeve });
    if (!fin || fin.source !== "sleeve-derived") return pend("최종 몸판을 정할 수 없음");
    return { source: "sleeve-derived", sym: doneSym, fin: fin, bodice: bodice };
  }
  // 커서(형상 cm)를 같은 피스의 **화면에 그려진 형상** 기준으로 snap. Alt 면 해제(자유).
  //   원래 몸판 맥락이면 종전대로 working geometry, 작업 중 파생 몸판이 그려지면 그 외곽·다트 다리 끝점(같은 피스 좌표 — 피스 transform 동승).
  // exclude = 선택 편집 중 자기 자신 anchor(있으면 후보에서 제외).
  function snapForCursor(cursor, piece, altKey, exclude) {
    if (altKey) return null;
    const p = project(); if (!p) return null;
    const thr = SNAP_PX * pxToCm();
    const dpc = (piece === "front" || piece === "back") ? displayedDerivedPiece(p, piece) : null;
    if (dpc) return chooseSnap(cursor, { anchors: patternAnchorPts(piece, exclude), endpoints: geomEndpoints({ d: dpc }, ["d"]), outlineSegs: outlinePrimsToSegs(dpc.outline) }, thr, GRID_CM);
    const geom = p.working.geometry, keys = PIECE_GEOM_KEYS[piece] || [piece];
    return chooseSnap(cursor, { anchors: patternAnchorPts(piece, exclude), endpoints: geomEndpoints(geom, keys), outlineSegs: outlineSegsOf(geom, keys) }, thr, GRID_CM);
  }
  function pxToCm() { const s = SC * viewZ; return s > 0 ? 1 / s : 1; }
  function ensurePatternLines(p) { if (!Array.isArray(p.working.patternLines)) p.working.patternLines = []; return p.working.patternLines; }
  function setNote(m) { const el = document.getElementById("designLineNote"); if (el) el.textContent = m; }
  function noteText() { const el = document.getElementById("designLineNote"); return el ? el.textContent : ""; }
  // draw 상태가 바뀌는 모든 경로(점 추가·Backspace·Esc·완료·모드 전환)가 rerender 를 부르므로 «그리기 완료» 활성도 여기서 함께 맞춘다.
  function rerender() { syncFinishButton(); if (typeof render === "function") render(); }
  function syncButtons() {
    const bd = document.getElementById("btnDesignLine"), bs = document.getElementById("btnDesignSelect");
    // 그리기 중 이 버튼은 작성 중 선을 버리고 나간다 → «그리기 완료»와 헷갈리지 않게 «그리기 취소»(2026-11-05).
    if (bd) { bd.textContent = mode === "draw" ? "그리기 취소" : "선·곡선 그리기"; bd.setAttribute("aria-pressed", mode === "draw" ? "true" : "false"); }
    if (bs) { bs.textContent = mode === "select" ? "편집 종료" : "선택·편집"; bs.setAttribute("aria-pressed", mode === "select" ? "true" : "false"); }
    syncFinishButton();
  }
  // 완료 가능 = 그리기 모드 · 작성 중 선 · 앵커 2개 이상 · 만들어질 선(segmentsFromAnchors 결과 그대로)이 **실제로 길이 0 으로 퇴화하지 않음**.
  //   퇴화 = line 은 from=to, cubic 은 from·c1·c2·to 가 모두 한 점. 같은 자리 두 앵커라도 핸들(제어점)이 있는 곡선은 길이가 있으므로 완료 가능(종전 Enter 와 같음).
  //   버튼·Enter·더블클릭이 모두 commitDraft 를 거치고 commitDraft 가 이 판정을 쓴다(기준 하나).
  const DEGEN_EPS = 1e-6;
  function segmentDegenerate(sg) {
    const d = q => Math.hypot(q.x - sg.from.x, q.y - sg.from.y) <= DEGEN_EPS;
    return sg.kind === "cubic" ? (d(sg.c1) && d(sg.c2) && d(sg.to)) : d(sg.to);
  }
  function lineDegenerate(segs) { return !segs.length || segs.every(segmentDegenerate); }
  function draftFinishable() {
    if (mode !== "draw" || !draft || draft.anchors.length < 2) return false;
    return !lineDegenerate(segmentsFromAnchors(draft.anchors));
  }
  const FINISH_OFF_TIP = "서로 다른 점을 2개 이상 찍으면(또는 곡선을 드래그하면) 누를 수 있습니다";
  function syncFinishButton() {
    const bf = document.getElementById("btnDesignFinish"); if (!bf) return;
    const on = draftFinishable();
    bf.disabled = !on; bf.setAttribute("aria-disabled", on ? "false" : "true");
    if (on) bf.removeAttribute("title"); else bf.setAttribute("title", FINISH_OFF_TIP);
  }
  const DRAW_NOTE = "클릭=직선 점 · 드래그=곡선 · 끝나면 «그리기 완료»(Enter·더블클릭도 됨)";
  const SELECT_NOTE = "선을 클릭해 선택 · Delete 삭제 · anchor/핸들 드래그 편집 · Esc 해제";

  // ── 모드 전환(그리기/선택 상호배타) ──
  function setMode(m) {
    mode = m; draft = null; drawDrag = null; lastDown = null; editDrag = null; selectedId = null; snapHint = null; hoverPt = null;
    if (window.designLayout && window.designLayout.cancelLayoutDrag) window.designLayout.cancelLayoutDrag();   // 진행 중 배치 드래그 취소
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

  // ── 그리기 거리 안내(2026-11-08 김님 «점 찍기 전에 여기 점이 저기 점에서 몇 cm 떨어졌는지» · «선이나 곡선을 따라 잰 거리도 필요») ──
  //   읽기 전용 표시 모델 — 점을 자동으로 놓거나 좌표를 잠그거나 새 점을 만들지 않는다(다음 점 자리 = 기존 snap 결과 그대로).
  //   ① 직선 = 기준점(직전 확정점)→커서 두 점 거리 · 가로/세로 차(부호는 화살표 →←↓↑, 화면 방향)
  //   ② 선 따라 = 지금 그리는 선의 이 구간(곡선이면 그 곡선)·시작점부터 누적 — 길이 함수 = bodiceCheckpoint 의 봉제 길이(cubic 계측) 재사용
  //   ③ 기존 선 따라 = 기준점과 커서가 같은 기존 열린 선(패턴선 하나 / 이름이 같은 외곽 구간 하나) 위에 있을 때만 그 사이 호 길이.
  //      다른 구간·닫힌 선·여러 선이 겹친 점은 임의로 짧은 쪽을 고르지 않고 사유만 보인다.
  const EDGE_KO = { "side-seam": "옆선", armhole: "진동", hem: "밑단", waist: "허리", center: "중심선", neckline: "네크라인", shoulder: "어깨", "yoke-seam": "요크 이음선", "princess-seam": "프린세스 이음선" };
  const ROLE_KO = { cut: "절개선", boundary: "외곽 대체선", guide: "보조선" };
  const MEASURE_ON_TOL = 2e-3;   // cm — snap 은 adaptive flatten(FLAT_TOL 1e-4) 위로 놓이므로 실제 곡선과의 거리는 이보다 훨씬 작다
  function arcLenOf(seg) {
    const BC = window.bodiceCheckpoint;
    if (BC && BC.sideSeamSegLen) return BC.sideSeamSegLen(seg);
    let L = 0; flattenSegment(seg).forEach(ab => { L += Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y); }); return L;
  }
  function _bez(seg, t) { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * seg.from.x + b * seg.c1.x + c * seg.c2.x + d * seg.to.x, y: a * seg.from.y + b * seg.c1.y + c * seg.c2.y + d * seg.to.y }; }
  // 점 → 세그먼트 위 매개변수 t(실제 기하 위 최근접 · 근사 꺾은선 아님) + 거리
  function paramOnSeg(seg, q) {
    if (seg.kind === "line") { const vx = seg.to.x - seg.from.x, vy = seg.to.y - seg.from.y, L2 = vx * vx + vy * vy;
      let t = L2 > 0 ? ((q.x - seg.from.x) * vx + (q.y - seg.from.y) * vy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      return { t: t, d: Math.hypot(seg.from.x + t * vx - q.x, seg.from.y + t * vy - q.y) }; }
    const dAt = t => { const b = _bez(seg, t); return Math.hypot(b.x - q.x, b.y - q.y); };
    let bt = 0, bd = Infinity; const N = 128;
    for (let i = 0; i <= N; i++) { const d = dAt(i / N); if (d < bd) { bd = d; bt = i / N; } }
    let lo = Math.max(0, bt - 1 / N), hi = Math.min(1, bt + 1 / N);
    for (let k = 0; k < 60; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (dAt(m1) <= dAt(m2)) hi = m2; else lo = m1; }
    const t = (lo + hi) / 2, d = dAt(t); return d < bd ? { t: t, d: d } : { t: bt, d: bd };
  }
  // 같은 이름 외곽 세그먼트 → 끝점이 이어진 열린 사슬들(방향 정렬). 끊긴 같은 이름 구간(다트 등)은 다른 사슬.
  function _linkChains(segs) {
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-3, used = segs.map(() => false), out = [];
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue; used[s0] = true; let ch = [cloneSeg(segs[s0])], grew = true;
      while (grew) { grew = false;
        for (let k = 0; k < segs.length; k++) { if (used[k]) continue; const g = segs[k], tail = ch[ch.length - 1].to, head = ch[0].from;
          if (near(g.from, tail)) { ch.push(cloneSeg(g)); used[k] = grew = true; }
          else if (near(g.to, tail)) { ch.push(reverseSeg(g)); used[k] = grew = true; }
          else if (near(g.to, head)) { ch.unshift(cloneSeg(g)); used[k] = grew = true; }
          else if (near(g.from, head)) { ch.unshift(reverseSeg(g)); used[k] = grew = true; } } }
      out.push(ch);
    }
    return out;
  }
  // 이 피스에서 «따라 잴» 수 있는 기존 선: 패턴선(같은 피스) + 화면에 그려진 외곽(합성 외곽 우선)의 이름 있는 구간
  function measureChains(piece) {
    const p = project(), chains = []; if (!p) return { chains: chains, note: null };
    lines().forEach(l => { if (l.piece === piece && Array.isArray(l.segments) && l.segments.length) chains.push({ name: ROLE_KO[l.role || "guide"] || "선", segs: l.segments.map(cloneSeg) }); });
    let note = null;
    const dpc = (piece === "front" || piece === "back") ? displayedDerivedPiece(p, piece) : null;
    if (dpc) note = "소매 파생 몸판 외곽은 따라 재기 미지원";
    else {
      const dO = p.working.designOutline && p.working.designOutline[piece];
      const prims = (dO && Array.isArray(dO.outline) && dO.outline.length) ? dO.outline : (PIECE_GEOM_KEYS[piece] || [piece]).reduce((a, k) => a.concat((p.working.geometry[k] && p.working.geometry[k].outline) || []), []);
      const segs = outlinePrimsToSegs(prims), by = {};
      segs.forEach(sg => { if (typeof sg.edge === "string" && EDGE_KO[sg.edge]) (by[sg.edge] = by[sg.edge] || []).push(sg); });
      Object.keys(by).forEach(e => _linkChains(by[e]).forEach(ch => chains.push({ name: EDGE_KO[e], segs: ch })));
    }
    chains.forEach(c => { const a = c.segs[0].from, b = c.segs[c.segs.length - 1].to; c.closed = c.segs.length > 1 && Math.hypot(a.x - b.x, a.y - b.y) < 1e-3; });
    return { chains: chains, note: note };
  }
  // 사슬 위 위치(시작부터 호 길이). 같은 점이 이음매(t=1 / 다음 t=0)에 걸려도 값은 같다.
  function chainPos(ch, q) {
    let best = null;
    ch.segs.forEach((sg, i) => { const r = paramOnSeg(sg, q); if (r.d <= MEASURE_ON_TOL && (!best || r.d < best.d)) best = { i: i, t: r.t, d: r.d }; });
    if (!best) return null;
    let L = 0; for (let k = 0; k < best.i; k++) L += arcLenOf(ch.segs[k]);
    if (best.t > 0) L += arcLenOf(subSegment(ch.segs[best.i], 0, best.t));
    return L;
  }
  function alongExisting(piece, A, B) {
    const mc = measureChains(piece), onA = [], onB = [];
    mc.chains.forEach(ch => { const a = chainPos(ch, A), b = chainPos(ch, B); if (a != null) onA.push({ ch: ch, pos: a }); if (b != null) onB.push({ ch: ch, pos: b }); });
    if (!onA.length || !onB.length) return null;   // 둘 중 하나라도 기존 선 위가 아니면 표시 없음(소음 금지)
    const both = onA.filter(x => onB.some(y => y.ch === x.ch)).map(x => ({ ch: x.ch, len: Math.abs(onB.filter(y => y.ch === x.ch)[0].pos - x.pos) }));
    if (!both.length) return { reason: "다른 구간(" + onA[0].ch.name + " → " + onB[0].ch.name + ") — 한 구간 안의 두 점만 잽니다" };
    const open = both.filter(x => !x.ch.closed);
    if (!open.length) return { reason: "닫힌 선 — 어느 쪽으로 돌지 정할 수 없어 생략" };
    const L0 = open[0].len;
    if (open.some(x => Math.abs(x.len - L0) > 1e-6)) return { reason: "여러 선이 만나는 점 — 어느 선을 따라 잴지 정할 수 없어 생략" };
    if (L0 < 1e-9) return null;
    return { len: L0, name: open[0].ch.name };
  }
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
  const dxText = v => (Math.abs(v) < 0.05 ? "가로 0.0" : "가로 " + (v > 0 ? "→ " : "← ") + f1(Math.abs(v)));
  const dyText = v => (Math.abs(v) < 0.05 ? "세로 0.0" : "세로 " + (v > 0 ? "↓ " : "↑ ") + f1(Math.abs(v)));
  function getMeasureGuide() {
    if (mode !== "draw") return null;
    if (!draft) return hoverPt ? { piece: hoverPt.piece, kind: "start", cur: _pt(hoverPt.point), lines: ["먼저 기준점(첫 점)을 찍으세요 — 그다음 커서까지 거리가 보입니다"] } : null;
    const an = draft.anchors, n = an.length, segs = segmentsFromAnchors(an);
    let kind, A, B, seg = null;
    const curving = !!(drawDrag && n >= 2 && an[n - 1].h);
    if (!curving && hoverPt && hoverPt.piece === draft.piece) { kind = "hover"; A = an[n - 1].p; B = hoverPt.point; seg = { kind: "line", from: _pt(A), to: _pt(B) }; }
    else if (n >= 2) { kind = curving ? "curve" : "last"; A = an[n - 2].p; B = an[n - 1].p; seg = segs[segs.length - 1]; }
    else return { piece: draft.piece, kind: "base", cur: _pt(an[0].p), lines: ["기준점 — 커서를 올리면(터치는 다음 점을 찍으면) 이 점부터 거리"] };   // 터치엔 hover 가 없다
    const straight = Math.hypot(B.x - A.x, B.y - A.y), dx = B.x - A.x, dy = B.y - A.y;
    const segArc = arcLenOf(seg), prior = kind === "hover" ? segs.reduce((a, sg) => a + arcLenOf(sg), 0) : segs.slice(0, -1).reduce((a, sg) => a + arcLenOf(sg), 0);
    const total = prior + segArc, isCurve = seg.kind === "cubic";
    const head = kind === "last" ? "마지막 구간 " : "";
    const out = [head + "직선 " + f1(straight) + " · " + dxText(dx) + " · " + dyText(dy) + "cm"];
    const second = [];
    if (isCurve) second.push("이 곡선 따라 " + f1(segArc));
    if (prior > 1e-9) second.push("시작점부터 그리는 선 따라 " + f1(total));
    if (second.length) out.push(second.join(" · ") + "cm");
    const ax = alongExisting(draft.piece, A, B);
    if (ax) out.push(ax.reason ? "기존 선 따라: " + ax.reason : "기존 " + ax.name + " 따라 " + f1(ax.len) + "cm");
    return { piece: draft.piece, kind: kind, base: _pt(A), cur: _pt(B), straight: straight, dx: dx, dy: dy, segArc: segArc, isCurve: isCurve, total: total, along: ax, lines: out };
  }
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
      // locked: 관리선(소매산·칼라 본체)의 양 끝 = 끌 수 없는 점(render 가 다른 모양으로 그린다 · 선택 hit 규칙과 같은 조건).
      anchors: anchorsFromSegments(line.segments).map((a, k, as) => ({ x: a.x, y: a.y, locked: (isSleeveCapLine(line) || isCollarBodyLine(line)) && (k === 0 || k === as.length - 1) })),
      handles: handlesOf(line).map(h => ({ c: { x: h.c.x, y: h.c.y }, a: { x: h.a.x, y: h.a.y } }))
    };
  }

  // ── draw 동작 ──
  // cut 생성·삭제·역할 변경·편집 후 Design 통합 UI 갱신(hidden 이어도 상태 갱신). ui.js 가 훅 설치.
  function notifyDesignResult() { if (window.refreshDesignResultUI) window.refreshDesignResultUI(); }
  // 완료(«그리기 완료» 버튼·Enter·더블클릭) 성공 → 방금 그린 선을 **선택·편집 상태로 자동 전환**(2026-11-05 김님 실사용 피드백 «선택·편집 → 같은 선 재클릭» 두 단계 제거).
  //   역할은 기본 guide 그대로(자동 지정 없음) — 사용자가 절개선/외곽/보조선을 고른다. 다시 그리려면 «선·곡선 그리기» 버튼.
  //   점 2개 미만(한 점)·Esc 취소는 이 경로에 오지 않는다(그리기 모드 유지 · 선택 없음).
  function commitDraft() {
    if (!draft || draft.anchors.length < 2) { setNote("점 2개 이상 필요"); return false; }
    if (!draftFinishable()) { setNote("길이 0 인 선은 만들 수 없음 · 서로 다른 점 2개 이상 필요"); return false; }   // 실제로 퇴화한 길이 0 선(종이 위에 없는 선)
    const p = project(); const ls = ensurePatternLines(p);
    const line = makePatternLine(nextId(ls), draft.piece, draft.anchors);
    ls.push(line);
    invalidateForLine(p, line);              // 새 선(역할 guide) — 그 선 출처 파생만(다른 조각 불변 · 2026-11-10)
    setMode("select");                       // draft·드래그 상태 정리 + 버튼 문구(그리기 취소 → 선·곡선 그리기 / 편집 종료) · 완료 버튼 비활성
    selectedId = line.id;
    setNote("완료 · 방금 그린 선 선택됨 — 역할(절개선·외곽·보조선)을 고르세요 · anchor/핸들 드래그 · Delete 삭제 · 새 선은 «선·곡선 그리기»");
    syncRoleButtons(); syncCutStatus(); rerender(); notifyDesignResult(); return true;
  }
  // «그리기 완료» 버튼(index.html onclick) — Enter·더블클릭과 같은 commitDraft 경로. 그리기 모드가 아니면 아무것도 안 한다.
  function finishDraw() { if (mode !== "draw") return false; return commitDraft(); }
  function draftBackspace() {
    if (!draft || !draft.anchors.length) return;
    draft.anchors.pop();
    if (!draft.anchors.length) { draft = null; setNote("첫 점을 찍으세요"); } else setNote(DRAW_NOTE);
    drawDrag = null; rerender();
  }

  // ── select 동작 ──
  function deleteSelected() {
    if (mode !== "select" || !selectedId) return;
    if (isNeckAutoLine(selectedId)) { setNote("네크라인 전용선은 삭제할 수 없습니다 · 기본형으로 돌아가기로만 제거"); return; }   // 자동 네크라인 보호
    if (isSleeveCapLine(selectedId)) { setNote("소매산 관리선은 삭제할 수 없습니다 · 기본 소매산으로 돌아가기로만 제거"); return; }   // 관리형 소매산 보호
    if (isCollarBodyLine(selectedId)) { setNote("칼라 본체 관리선은 삭제할 수 없습니다 · 기본형으로 돌아가기로만 제거"); return; }   // 관리형 칼라 본체 보호
    const p = project(), gone = findLine(selectedId); p.working.patternLines = ensurePatternLines(p).filter(l => l.id !== selectedId);
    invalidateForLine(p, gone, { removed: true });   // 그 선 출처 파생만 · 반영된 외곽선이면 그 피스만 재합성
    selectedId = null; editDrag = null; setNote("선 삭제됨 · 다른 선을 클릭"); syncRoleButtons(); syncCutStatus(); rerender(); notifyDesignResult();
  }
  // ── 칼라 본체 관리선: 직선 구간 → 같은 모양의 곡선(2026-11-12 김님 «카라 모양을 몸판·소매처럼») ──
  //   기본 M 은 외곽 휨 0 = 직선 구간이라 곡선 핸들이 없었다. 직선 세그를 제어점 1/3·2/3 인 cubic 으로 바꾼다(형상 동일 · 점 위치 무변경).
  //   양 끝점·부착선 잠금·검증(computeFromBodyLine)은 그대로 — 관리선 세그의 kind 만 바뀐다. 칼라 본체 관리선 전용(일반 선·소매산·네크라인 무변경).
  function curveLineSegCount(line) { return line ? line.segments.filter(s => s.kind !== "cubic" && Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > EPS).length : 0; }
  function getCurveState() {
    if (mode !== "select" || !selectedId) return null;
    const line = findLine(selectedId); if (!line || !isCollarBodyLine(line)) return null;
    const n = curveLineSegCount(line), nh = handlesOf(line).length;
    return { show: true, allowed: n > 0 && !editDrag, lineSegs: n, handles: nh };
  }
  function doToCurve() {
    const st = getCurveState(); if (!st || !st.allowed) return false;
    const line = findLine(selectedId);
    line.segments = line.segments.map(s => {
      if (s.kind === "cubic" || Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) <= EPS) return s;
      const f = s.from, t = s.to, c = { kind: "cubic", from: { x: f.x, y: f.y }, c1: { x: f.x + (t.x - f.x) / 3, y: f.y + (t.y - f.y) / 3 }, c2: { x: f.x + (t.x - f.x) * 2 / 3, y: f.y + (t.y - f.y) * 2 / 3 }, to: { x: t.x, y: t.y } };
      if (s.part) c.part = s.part;
      return c;
    });
    if (window.recomposeCollarBody) window.recomposeCollarBody();   // 같은 형상으로 재합성·검증(편집 pointerup 과 같은 경로)
    setNote("곡선으로 바뀜 · 모양은 그대로 · 점에서 나온 핸들을 끌어 휘게 하세요(양 끝 점은 고정)");
    syncRoleButtons(); rerender(); notifyDesignResult();
    return true;
  }

  // 선택한 선의 역할 지정(cut/boundary/guide). 표시만 바뀌고 outline 분할은 다음 단계.
  function setRole(role) {
    if (mode !== "select" || !selectedId || !ROLE_LABEL[role]) return;
    if (isNeckAutoLine(selectedId)) { setNote("네크라인 전용선은 역할을 바꿀 수 없습니다"); return; }   // 자동 네크라인 보호
    if (isSleeveCapLine(selectedId)) { setNote("소매산 관리선은 역할을 바꿀 수 없습니다"); return; }   // 관리형 소매산 보호
    if (isCollarBodyLine(selectedId)) { setNote("칼라 본체 관리선은 역할을 바꿀 수 없습니다"); return; }   // 관리형 칼라 본체 보호
    const line = findLine(selectedId); if (!line) return;
    line.role = role; invalidateForLine(project(), line); setNote("역할: " + ROLE_LABEL[role]); syncRoleButtons(); syncCutStatus(); rerender(); notifyDesignResult();
  }
  // 역할 버튼(design inspector): 선택 시 활성, 현재 역할 강조. 자동 네크라인 전용선이면 잠금(역할 변경 금지).
  function syncRoleButtons() {
    const sel = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    const role = sel ? (sel.role || "guide") : null;
    const locked = sel && (isNeckAutoLine(sel.id) || isSleeveCapLine(sel) || isCollarBodyLine(sel));
    [["btnRoleCut", "cut"], ["btnRoleBoundary", "boundary"], ["btnRoleGuide", "guide"]].forEach(pair => {
      const b = document.getElementById(pair[0]); if (!b) return;
      b.disabled = !sel || locked; b.setAttribute("aria-pressed", role === pair[1] ? "true" : "false");
    });
  }
  // 선택한 절개선을 **현재 working outline** 기준으로 재검사(snapHint 아님). geometry 무변경.
  // 반환 {ok, reason} | null(cut 아님/미선택). 다음 단계 파트 분리는 ok 인 것만 소비.
  function validateSelectedCut() {
    const line = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    if (!line || line.role !== "cut") return null;
    const p = project(); if (!p) return null;
    return cutStatusOf(p, line);
  }
  // 절개선 한 개의 상태(순수 판정 · geometry 무변경). 반환 {ok, reason, basis?, ...}.
  //   basis 없음 = 원래 몸판 맥락(종전 판정 그대로 — 합성 design outline 우선). 파트 분리는 이 경우에만.
  //   basis "sleeve-derived" = designResult 와 같은 최종 몸판(frozen) · 같은 3분류(유효 / 원래에서만 유효 = 최종 몸판 불일치 / 둘 다 무효 = 작성 중).
  //   basis "pending" = 최종 몸판 미확정(재완료 필요) — 유효라고 하지 않는다.
  //   basis "sleeve"(2026-11-05) = 소매 선: sleeveSplit.cutStatus — 유효(ok)와 지금 실제 분리 가능(ready)을 따로 낸다(현재 소매 완료본 기준).
  function cutStatusOf(p, line, ref) {
    const others = lines().filter(l => l.piece === line.piece && l.role === "cut" && l.id !== line.id).map(l => flattenLine(l.segments));
    if (line.piece === "sleeve" && window.sleeveSplit) return window.sleeveSplit.cutStatus(p, line, others);
    ref = (line.piece === "front" || line.piece === "back") ? (ref || editBodiceRef(p)) : { source: "original" };
    if (ref.source === "original") return validateCut(line, flattenLine(currentOutlineSegs(p, line.piece)), others);   // 합성 design outline 이 있으면 그 기준(종전)
    if (ref.source === "pending") return { ok: false, basis: "pending", sym: ref.sym, reason: ref.reason };
    const v = validateCut(line, flattenLine(outlinePrimsToSegs(ref.fin[line.piece].outline)), others);
    const onOriginal = v.ok ? true : validateCut(line, flattenLine(outlinePrimsToSegs(ref.bodice[line.piece].outline)), others).ok;   // designResult 의 «원래 몸판» = frozen bodiceResult
    return { ok: v.ok, reason: v.reason, basis: "sleeve-derived", sym: ref.sym, onOriginal: onOriginal, state: v.ok ? "valid" : onOriginal ? "final-mismatch" : "draft" };
  }
  function cutStatusText(v) {
    if (!v.basis) return v.ok ? "분리 가능" : v.reason;   // 원래 몸판 맥락: 종전 문구
    if (v.basis === "sleeve") {   // 소매: 유효 절개선 ≠ 지금 분리 가능 — 둘을 섞어 «분리 가능»이라 하지 않는다
      if (v.kind === "ok") return "분리 가능 — 소매 " + v.sym + " 현재 형상 기준";
      if (v.kind === "none") return "소매 조각 없음: " + v.reason;
      if (!v.ok) return v.kind === "pending" ? "판정 보류: " + v.reason : v.reason;
      if (v.kind === "pending") return "유효 절개선 · 파트 분리 보류: " + v.reason;
      return "유효 절개선 · 분리 불가: " + v.reason;
    }
    if (v.basis === "pending") return "판정 보류(최종 몸판 미확정): " + v.reason;
    const on = "소매 " + v.sym + " 까지 반영한 최종 몸판 기준";
    if (v.ok) return "유효 절개선 — " + on + " · Design 완료에 포함 · 파트 분리는 원래 몸판 전용이라 여기서 하지 않음";
    if (v.onOriginal) return "최종 몸판 불일치: " + v.reason + " — " + on + " · 원래 몸판에서는 맞던 선 · 이대로면 Design 완료가 거부됩니다";
    return "작성 중: " + v.reason + " — " + on + " · Design 완료에서 제외";
  }
  function splitAllowed(v) { return !!(v && v.ok && !v.basis); }
  // Design 통합용: 유효한 role:"cut" 절개선을 **완료된 몸판(frozen bodiceResult)의 최종 effective
  //   outline 기준으로 재검증**해 수집한다(mutable working outline 아님 — 몸판 완료 후 표류 방지).
  //   반환 [{ piece, segments(형상 cm 복사) }], **canonical 정렬**(patternLine 배열·id 순서 무관 →
  //   design hash 안정). role=cut·piece=front/back 만. designResult 가 소비.
  function _cutCanonKey(cut) {
    const r = v => Math.round(v * 1e4) / 1e4;
    return cut.piece + ":" + cut.segments.map(s => s.kind === "cubic"
      ? "C" + [s.from.x, s.from.y, s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y].map(r).join(",")
      : "L" + [s.from.x, s.from.y, s.to.x, s.to.y].map(r).join(",")).join("|");
  }
  function gatherValidCuts(patternLines, bodiceResult) {
    if (!bodiceResult) return [];
    const src = Array.isArray(patternLines) ? patternLines : lines();
    const out = [];
    ["front", "back"].forEach(piece => {
      const face = bodiceResult[piece];
      if (!face || !Array.isArray(face.outline) || !face.outline.length) return;
      const cuts = src.filter(l => l.piece === piece && l.role === "cut");
      if (!cuts.length) return;
      // frozen 몸판 effective outline(raw primitive) → line/cubic 정규화 후 평탄화(path 를 null 로 내지 않게).
      const outlineFlat = flattenLine(outlinePrimsToSegs(face.outline));
      cuts.forEach(line => {
        const others = cuts.filter(l => l.id !== line.id).map(l => flattenLine(l.segments));
        if (validateCut(line, outlineFlat, others).ok) out.push({ piece: piece, segments: line.segments.map(cloneSeg) });
      });
    });
    out.sort((a, b) => { const ka = _cutCanonKey(a), kb = _cutCanonKey(b); return ka < kb ? -1 : ka > kb ? 1 : 0; });
    return out;
  }
  // 검사 결과를 UI 상태로만 표시(#designCutStatus). data-ok 로 통과/실패 색 구분.
  function syncCutStatus() {
    const v = validateSelectedCut();
    const bv = v ? null : validateSelectedBoundary();   // 선 하나 = 역할 하나 → 비싼 소매 판정은 둘 중 하나만
    const p = project(), SS = window.sleeveSplit;
    if (p && window.sleeveOutlineEdit && window.sleeveOutlineEdit.prune(p)) sleeveUIRefresh();   // 소매를 새로 적용해 낡은 수동 외곽 수정 → 해제(다른 형상에 옮기지 않음)
    let ref = (v && v._ref) || (bv && bv._ref) || null;
    const needRef = p && SS && ((Array.isArray(p.working.parts) && p.working.parts.some(q => q.sourcePiece === "sleeve")) || (p.working.boundaryPreview && p.working.boundaryPreview.sourcePiece === "sleeve"));
    if (!ref && needRef) ref = SS.sleeveRef(p);           // 같은 동기화에서 한 번만(파트·미리보기 prune 공용)
    const prunedParts = pruneStaleSleeveParts(null, ref);   // 소매·몸판·입력이 바뀐 뒤 낡은 소매 파트를 데이터에서도 지운다(표시는 visibleParts 가 빠른 판정으로 이미 제외)
    const prunedPreview = pruneStaleBoundaryPreview(p, ref);  // 낡은 외곽 대체 미리보기도 같은 기준으로(표시는 visibleBoundaryPreview 가 이미 제외)
    // 판정 문구는 같아도(새 형상에서도 «분리 가능») 파트·미리보기가 지워졌으면 막대를 맞춘다(이전 «분리됨»·«미리보기 표시 중»을 남기지 않음).
    if ((prunedParts || prunedPreview) && window.designLineQuickBar) window.designLineQuickBar.sync();
    const el = document.getElementById("designCutStatus"); if (!el) return;
    if (!v) { el.textContent = ""; el.removeAttribute("data-ok"); el.removeAttribute("data-basis"); syncSplitButton(v); syncBoundaryStatus(bv); syncComposeButton(); return; }
    el.textContent = cutStatusText(v);
    el.setAttribute("data-ok", v.ok ? "1" : "0");
    if (v.basis) el.setAttribute("data-basis", v.basis); else el.removeAttribute("data-basis");
    syncSplitButton(v);
    syncBoundaryStatus(null);           // 절개선 선택 = 대체선 아님(재판정 없음)
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
  // 선 하나의 변경(새 선 완료·역할 변경·삭제·cut/guide 편집) → **그 선에서 나온 파생만** 무효화(2026-11-10 김님 승인 버그 수정).
  //   종전엔 invalidateParts 로 어떤 선이든 parts·미리보기·designOutline 을 통째로 지워, 소매에 보조선 하나만 그려도
  //   완료한 몸판의 곡선 밑단(designOutline)이 사라지고 몸판·소매·카라·Design 이 연쇄 «변경됨»이 됐다(다른 조각 파괴 = 버그).
  //   출처: parts.sourceCutId · boundaryPreview.sourceLineId · designOutline[piece].lineIds(= 앞·뒤판 boundary 선 + geometry 의 함수).
  //   반영된 선이 반영에서 빠질 때(boundary 아닌 역할로 변경 · 삭제)만 그 피스를 **남은 반영 선으로** 재합성한다(사용자 자신의 그 조각 조작 = 정당한 무효화).
  //   반영 안 된 선을 boundary 로 바꾸는 것만으로는 몸판이 바뀌지 않는다(«몸판 외곽으로 반영»/«디자인 외곽 합성» 명시 클릭 원칙 그대로).
  function invalidateForLine(p, line, opts) {
    p = p || project(); if (!p || !line) return false;
    const w = p.working, id = line.id; let ch = false;
    if (Array.isArray(w.parts) && w.parts.some(q => q.sourceCutId === id)) { w.parts = w.parts.filter(q => q.sourceCutId !== id); ch = true; }
    if (w.boundaryPreview && w.boundaryPreview.sourceLineId === id) { w.boundaryPreview = null; ch = true; }
    const ent = w.designOutline && w.designOutline[line.piece];
    const reflected = !!(ent && (ent.lineIds || []).indexOf(id) >= 0);
    if (reflected && ((opts && opts.removed) || line.role !== "boundary")) { recomposeReflectedPiece(p, line.piece, id); ch = true; }
    return ch;
  }
  // 반영된 피스 하나를 dropId 를 뺀 «이미 반영된» boundary 선으로만 재합성(반영 안 된 boundary 를 몰래 반영하지 않는다). 다른 피스 불변.
  //   남은 선이 없으면 그 피스 항목만 제거 · 합성 실패면 그 피스 항목만 제거 + 사유 표시. 그 피스의 parts·미리보기만 정리.
  function recomposeReflectedPiece(p, piece, dropId) {
    const w = p.working, ent = w.designOutline && w.designOutline[piece]; if (!ent) return;
    const keep = (ent.lineIds || []).filter(x => x !== dropId).map(x => findLine(x)).filter(l => l && l.role === "boundary" && l.piece === piece);
    const next = Object.assign({}, w.designOutline); let reason = null;
    delete next[piece];
    if (keep.length) {
      const keys = PIECE_GEOM_KEYS[piece] || [piece];
      const rb = buildPieceRing(outlineSegsOf(w.geometry, keys), constrLinesOf(w.geometry, keys));
      const res = rb.ok ? composeDesignOutline(rb.ring, keep.map(boundarySegsOf), BODICE_COMPOSE_OPTS) : rb;
      if (res.ok) next[piece] = { outline: res.outline, lineIds: keep.map(l => l.id) }; else reason = res.reason;
    }
    w.designOutline = Object.keys(next).length ? next : null;
    if (Array.isArray(w.parts)) w.parts = w.parts.filter(q => q.sourcePiece !== piece);
    if (w.boundaryPreview && w.boundaryPreview.sourcePiece === piece) w.boundaryPreview = null;
    seamStateCache = null;
    const pk = piece === "front" ? "앞" : "뒤";
    setComposeNote(reason ? "외곽 반영 해제 · " + pk + "판 재합성 불가(" + reason + ") — " + pk + "판 원래 외곽으로 돌아감"
      : keep.length ? pk + "판 외곽 재합성 · 빠진 선만 반영 해제" : pk + "판 외곽 반영 해제 · 원래 외곽");
    if (window.refreshFrontPlacket) window.refreshFrontPlacket();      // 유효 앞판 외곽 변경 → 여밈 재파생
    if (window.refreshDesignBodyPanel) window.refreshDesignBodyPanel();
  }
  // 파트 분리 버튼: 유효 절개선 선택 시에만 활성.
  //   v 를 넘기면 재판정하지 않는다(최종 몸판 판정은 소매 현재성 검사를 포함해 비싸다). 원래 몸판 맥락이 아니면 비활성(분리는 원래 ring 전용).
  //   판정은 splitState 에 남겨 «선 가까이» 막대가 **같은 판정**을 읽는다(getSplitState — 매 render 재판정 없음 · 저장 안 함).
  //   앞판·뒤판·소매가 아닌 절개선은 doSplit 이 거부하므로 버튼도 같은 조건으로 비활성(2026-11-05 · 막대 연결 때 doSplit 과 정합 · 소매는 같은 날 추가).
  const SPLIT_DERIVED_TIP = "파트 분리는 원래 몸판 전용 — 소매 파생 몸판은 여기서 자르지 않습니다(재단 단계 범위)";
  function _firstClause(t) { return String(t || "").split(" — ")[0]; }
  function J_(o) { return o ? JSON.stringify(o) : ""; }
  //   소매(2026-11-05 · 2026-11-06 첫 완료 불필요): 허용 = 유효 + 현재 소매 형상 기준 + 실제 분할 시험 통과(v.ready). 불가 사유 = 판정 문구 그대로(사용자 조치 포함).
  function splitStateOf(v, line) {
    if (!v || !line || line.role !== "cut") return null;
    if (line.piece === "sleeve" && v.basis === "sleeve") {
      const allowed = !!(v.ok && v.ready);
      const reason = allowed ? "분리 가능"
        : v.kind === "pending" ? "판정 보류 — " + _firstClause(v.reason)
        : v.kind === "physical" ? "분할 불가 — " + _firstClause(v.reason)
        : v.kind === "none" ? _firstClause(v.reason)
        : v.reason;
      return { lineId: line.id, allowed: allowed, kind: allowed ? "ok" : v.kind, reason: reason };
    }
    const fb = line.piece === "front" || line.piece === "back";
    const allowed = splitAllowed(v) && fb;
    const kind = allowed ? "ok" : !fb ? "piece" : v.basis === "pending" ? "pending" : v.basis ? "derived" : "invalid";
    const reason = kind === "ok" ? "분리 가능"
      : kind === "piece" ? "앞판·뒤판·소매 절개선만 분리합니다"
      : kind === "pending" ? "최종 몸판 미확정 — " + _firstClause(v.reason)
      : kind === "derived" ? "소매 " + v.sym + " 파생 몸판은 파트 분리 미지원(원래 몸판 전용)"
      : v.reason;
    return { lineId: line.id, allowed: allowed, kind: kind, reason: reason };
  }
  function syncSplitButton(v) {
    if (arguments.length === 0) v = validateSelectedCut();
    const prev = J_(splitState);
    splitState = splitStateOf(v, (mode === "select" && selectedId) ? findLine(selectedId) : null);
    // 판정이 바뀌었으면 막대도 즉시 맞춘다(소매·몸판 패널 동기화는 render 없이 syncCutStatus 만 부를 수 있다 — 막대가 이전 «분리 가능»을 남기지 않게).
    if (prev !== J_(splitState) && window.designLineQuickBar) window.designLineQuickBar.sync();
    const b = document.getElementById("btnDesignSplit"); if (!b) return;
    b.disabled = !(splitState && splitState.allowed);
    if (v && v.basis === "sleeve") { if (splitState && !splitState.allowed) b.title = splitState.reason; else b.removeAttribute("title"); }
    else if (v && v.basis) b.title = SPLIT_DERIVED_TIP; else if (splitState && splitState.kind === "piece") b.title = splitState.reason; else b.removeAttribute("title");
  }
  // 지금 «현재 결과»로 보여 줄 파트(render·막대 집계 공용). 몸판 파트 = 원래 몸판 맥락에서만(종전) · 소매 파트 = sleeveSplit.partCurrent(출처 결속 · 빠른 판정).
  function visibleParts(p) {
    p = p || project(); const ps = (p && Array.isArray(p.working.parts)) ? p.working.parts : [];
    if (!ps.length) return [];
    const SS = window.sleeveSplit, hasSleeve = ps.some(q => q.sourcePiece === "sleeve");
    const ref = hasSleeve && SS ? SS.quickRef(p) : null, orig = ps.some(q => q.sourcePiece !== "sleeve") ? isOriginalBodiceContext(p) : false;   // 빠른 판정(매 render) — 전체 판정은 prune
    return ps.filter(q => q.sourcePiece === "sleeve" ? !!(SS && SS.partCurrent(p, q, ref)) : orig);
  }
  // 낡은 소매 파트 제거(소매·몸판·입력·선 변경 뒤 · syncCutStatus 가 부른다). 몸판 파트는 종전 규칙(invalidateParts) 그대로 둔다.
  //   ref = 같은 동기화에서 이미 낸 전체 판정(sleeveSplit.cutStatus 의 _ref)이 있으면 재사용.
  function pruneStaleSleeveParts(p, ref) {
    p = p || project(); const ps = p && Array.isArray(p.working.parts) ? p.working.parts : null;
    if (!ps || !ps.some(q => q.sourcePiece === "sleeve")) return false;
    const SS = window.sleeveSplit; ref = ref || (SS ? SS.sleeveRef(p) : null);
    if (ps.every(q => q.sourcePiece !== "sleeve" || (SS && SS.partCurrent(p, q, ref)))) return false;
    p.working.parts = ps.filter(q => q.sourcePiece !== "sleeve");
    return true;
  }
  // 막대용 읽기 전용 조회: 지금 선택한 절개선에 대해 오른쪽 «파트 분리» 버튼이 마지막으로 쓴 판정 + 이 선으로 만든 파트 수.
  //   선택·역할이 바뀌면 syncCutStatus → syncSplitButton 이 다시 쓴다. 판정이 다른 선 것이면 null(추측 안 함).
  function getSplitState() {
    if (mode !== "select" || !selectedId || !splitState || splitState.lineId !== selectedId) return null;
    const line = findLine(selectedId); if (!line || line.role !== "cut") return null;
    const p = project(), parts = p ? visibleParts(p).filter(q => q.sourceCutId === selectedId).length : 0;   // 현재 결과로 보이는 파트만(낡은 소매 파트 제외)
    return { lineId: splitState.lineId, allowed: splitState.allowed, kind: splitState.kind, reason: splitState.reason, parts: parts };
  }
  function setSplitNote(m) { const el = document.getElementById("designSplitNote"); if (el) el.textContent = m; }
  // 선택된 유효 절개선 1개로 실제 분할 실행. 분할 직전 validateCut 재실행 → ring 구성 →
  // splitRingByCut → 성공 시에만 working.parts 원자적 교체 → 미리보기 렌더.
  function doSplit() {
    if (mode !== "select" || !selectedId) return;
    const line = findLine(selectedId); if (!line || line.role !== "cut") { setSplitNote("절개선을 선택하세요"); return; }
    const p = project(); if (!p) return;
    if (line.piece === "sleeve") { doSplitSleeve(p, line); return; }
    if (line.piece !== "front" && line.piece !== "back") { setSplitNote("앞판·뒤판·소매 절개선만 분리합니다"); return; }
    const v = validateSelectedCut();                       // ★ 분할 직전 재검증
    if (v && v.basis) { setSplitNote("분할 불가: 파트 분리는 원래 몸판 전용 — 소매 " + v.sym + " 파생 몸판은 여기서 자르지 않습니다(재단 단계 범위)"); return; }   // 원래 형상을 잘라 «분리됨»처럼 보이지 않게
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
  // 소매 분리(2026-11-05): 분할 직전 같은 판정(sleeveSplit.cutStatus)을 다시 내고, 현재 소매 완료본(frozen = 화면과 동일)을 자른다.
  //   실패면 working.parts 불변 · 성공이면 출처 결속 파트 두 장으로 원자적 교체(마지막 분리 한 쌍 — 종전 계약).
  function doSplitSleeve(p, line) {
    const SS = window.sleeveSplit; if (!SS) { setSplitNote("분할 불가: 소매 분리 모듈 없음"); return; }
    const v = validateSelectedCut();                        // ★ 분할 직전 재판정
    if (!v || !v.ok) { setSplitNote("분할 불가: " + (v ? v.reason : "절개선 아님")); syncSplitButton(v); return; }
    if (!v.ready) { setSplitNote("분할 불가: " + v.reason); syncSplitButton(v); return; }
    const ref = v._ref || SS.sleeveRef(p);
    if (ref.source !== "current") { setSplitNote("분할 불가: " + ref.reason); return; }
    const res = SS.splitSleeve(ref.geometry, line.segments);
    if (!res.ok) { setSplitNote("분할 불가: " + res.reason); return; }
    p.working.parts = SS.makeParts(ref, line, res);
    setSplitNote("분할 완료 · 소매 " + ref.sym + (res.piece !== "sleeve" ? "(" + res.piece + ")" : "") + " 두 파트(다른 색) 미리보기 — 소매·몸판·선이 바뀌면 사라집니다");
    rerender();
  }
  // ── 외곽 대체선(boundary) DOM 연동 ──
  // 선택된 boundary 선을 현재 작업 기준으로 검증 + 파생 outline 계산. 반환 {ok, kind, reason, outline?, basis?} | null(boundary 아님/미선택). geometry 무변경.
  //   kind: ok | invalid | piece(카라) | derived(소매 파생 몸판 맥락) | pending(판정 보류 — 소매 검사 미통과·차단·몸판 미완료) | none(별도 소매 조각 없음)
  //   앞판·뒤판 = 원래 몸판 맥락에서만 종전 판정(현재 작업 outline · 합성 design outline 우선). 소매 Ⓡ~Ⓩ 파생 몸판 맥락에서는 원래 몸판 외곽을
  //     대체해 현재 결과처럼 보이지 않게 거부한다(파생 몸판 외곽 대체 = 범위 밖).
  //   소매(2026-11-06) = sleeveSplit.boundaryStatus — 현재 소매 형상 기준(분리와 같은 sleeveRef · 첫 완료 불필요).
  function boundaryStatusOf(p, line) {
    if (line.piece === "sleeve") {
      if (!window.sleeveSplit) return { ok: false, kind: "invalid", reason: "소매 외곽 대체 모듈 없음" };
      const E = window.sleeveOutlineEdit;
      if (E && E.isApplied(p, line)) return { ok: false, kind: "applied", basis: "sleeve", reason: "이 선은 소매 외곽에 반영됨 — 지금 소매 외곽의 일부(다시 반영하지 않음)" };
      const sv = window.sleeveSplit.boundaryStatus(p, line);
      // 반영 가능 판정(2026-11-06): 미리보기 판정과 따로 — 미리보기가 되어도 구간 의미가 모호하면 반영은 막힌다(같은 동기화에서 한 번).
      if (E) Object.defineProperty(sv, "apply", { value: E.applyStatus(p, line, sv), enumerable: false });
      return sv;
    }
    if (line.piece !== "front" && line.piece !== "back") return { ok: false, kind: "piece", reason: "앞판·뒤판·소매 외곽만 대체합니다(카라 미지원)" };
    if (!isOriginalBodiceContext(p)) {
      const live = liveDerivedSleeve(p), SCk = window.sleeveCheckpoint, s = SCk && SCk.latest ? SCk.latest(p) : null;
      const sym = live ? live.sym : (s && s.origin ? symOfPresetId(s.origin.presetId) : "?");
      return { ok: false, kind: "derived", sym: sym, reason: "소매 " + sym + " 파생 몸판은 외곽 대체 미리보기 미지원 — 원래 몸판 외곽을 대체해 현재 결과처럼 보이지 않게 합니다" };
    }
    const rb = buildRingForPiece(p, line.piece);
    if (!rb.ok) return { ok: false, kind: "invalid", reason: rb.reason };
    const r = replaceArcOnRing(rb.ring, boundarySegsOf(line));
    return Object.assign(r, { kind: r.ok ? "ok" : "invalid" });
  }
  function validateSelectedBoundary() {
    const line = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    if (!line || line.role !== "boundary") return null;
    const p = project(); if (!p) return null;
    return boundaryStatusOf(p, line);
  }
  // 판정 → 사람이 읽는 짧은 문구(오른쪽 상태줄·막대 이유 공용 — 같은 문구).
  function boundaryReasonOf(v) {
    if (!v) return "";
    if (v.ok) return v.basis === "sleeve" ? v.reason : "대체 가능";
    if (v.kind === "pending") return "판정 보류 — " + _firstClause(v.reason);
    if (v.kind === "none") return "별도 소매 조각 없음 — 대체할 소매 외곽이 없습니다(소매가 몸판과 한 장)";
    if (v.kind === "applied") return "반영됨 — 이 선은 지금 소매 외곽의 일부입니다";
    return v.reason;
  }
  //   v 를 넘기면 재판정하지 않는다(소매 현재성 판정은 비싸다 — syncCutStatus 가 한 번 낸 판정을 넘긴다). 막대는 boundaryState 를 읽는다(매 render 재판정 없음).
  function syncBoundaryStatus(v) {
    if (arguments.length === 0) v = validateSelectedBoundary();
    const line = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    const prev = J_(boundaryState);
    boundaryState = (v && line && line.role === "boundary") ? { lineId: line.id, allowed: !!v.ok, kind: v.kind || (v.ok ? "ok" : "invalid"), reason: boundaryReasonOf(v),
      apply: v.apply ? { allowed: !!v.apply.allowed, reason: v.apply.reason } : null } : null;
    if (prev !== J_(boundaryState) && window.designLineQuickBar) window.designLineQuickBar.sync();
    const el = document.getElementById("designBoundaryStatus");
    if (el) {
      if (!v) { el.textContent = ""; el.removeAttribute("data-ok"); }
      else { el.textContent = boundaryReasonOf(v); el.setAttribute("data-ok", v.ok ? "1" : "0"); }
    }
    const b = document.getElementById("btnDesignBoundary");
    if (b) { b.disabled = !(v && v.ok); if (v && !v.ok) b.title = boundaryReasonOf(v); else b.removeAttribute("title"); }
    syncApplyButtons();
  }
  // 소매 외곽 반영 판정(막대·오른쪽 공용): 반영 허용(applyStatus) + 이 선의 미리보기가 지금 보임 — 미리보기 확인 전엔 반영할 수 없다.
  function boundaryApplyOf(st, shown) {
    if (!st || !st.apply) return null;
    if (!st.apply.allowed) return { allowed: false, reason: st.apply.reason };
    if (!shown) return { allowed: false, reason: "먼저 «외곽 대체 미리보기»로 확인하세요" };
    return { allowed: true, reason: st.apply.reason };
  }
  // 오른쪽 «외곽 반영»·«수동 외곽 수정 되돌리기» 버튼(소매 전용). 판정은 boundaryState(마지막 동기화) — 재판정 없음.
  function syncApplyButtons() {
    const p = project(), E = window.sleeveOutlineEdit;
    const line = (mode === "select" && selectedId) ? findLine(selectedId) : null;
    const st = (boundaryState && line && boundaryState.lineId === line.id) ? boundaryState : null;
    const bp = p ? visibleBoundaryPreview(p) : null, shown = !!(bp && st && bp.sourceLineId === st.lineId);
    const a = boundaryApplyOf(st, shown);
    const ab = document.getElementById("btnDesignBoundaryApply");
    if (ab) { ab.hidden = !(line && line.piece === "sleeve" && line.role === "boundary"); ab.disabled = !(a && a.allowed); if (a && !a.allowed) ab.title = a.reason; else ab.removeAttribute("title"); }
    const ub = document.getElementById("btnSleeveEditUndo");
    if (ub) { const on = !!(p && E && E.isActive(p)); ub.hidden = !on; ub.disabled = !on; }
  }
  // 미리보기가 지금도 현재 결과인가(출처 결속). 소매 = sleeveSplit.previewCurrent(ref 없으면 빠른 판정) ·
  //   몸판 = 원래 몸판 맥락 · 같은 선(역할·서명) · 같은 작업 outline(서명). 서명이 없는 옛 미리보기는 현재가 아니다(숨김).
  function boundaryPreviewCurrent(p, bp, ref) {
    if (!p || !bp) return false;
    if (bp.sourcePiece === "sleeve") return !!(window.sleeveSplit && window.sleeveSplit.previewCurrent(p, bp, ref));
    if (bp.sourcePiece !== "front" && bp.sourcePiece !== "back") return false;
    const line = findLine(bp.sourceLineId);
    if (!line || line.piece !== bp.sourcePiece || line.role !== "boundary" || J_(line.segments) !== bp.sourceLineSig) return false;
    return isOriginalBodiceContext(p) && J_(currentOutlineSegs(p, bp.sourcePiece)) === bp.sourceOutlineSig;
  }
  // 지금 «현재 결과»로 보여 줄 외곽 대체 미리보기(render·막대 공용 · 빠른 판정) — 아니면 null(데이터는 prune 이 지운다).
  function visibleBoundaryPreview(p) {
    p = p || project(); const bp = p && p.working.boundaryPreview;
    return bp && boundaryPreviewCurrent(p, bp, null) ? bp : null;
  }
  function pruneStaleBoundaryPreview(p, ref) {
    p = p || project(); const bp = p && p.working.boundaryPreview;
    if (!bp || boundaryPreviewCurrent(p, bp, bp.sourcePiece === "sleeve" ? (ref || (window.sleeveSplit ? window.sleeveSplit.sleeveRef(p) : null)) : null)) return false;
    p.working.boundaryPreview = null; return true;
  }
  // 막대용 읽기 전용 조회: 지금 선택한 대체선에 대해 오른쪽 «외곽 대체 미리보기»가 마지막으로 쓴 판정 + 이 선의 미리보기가 지금 보이는지.
  function getBoundaryState() {
    if (mode !== "select" || !selectedId || !boundaryState || boundaryState.lineId !== selectedId) return null;
    const line = findLine(selectedId); if (!line || line.role !== "boundary") return null;
    const p = project(), bp = visibleBoundaryPreview(p), shown = !!(bp && bp.sourceLineId === selectedId);
    const E = window.sleeveOutlineEdit, ed = (p && E && line.piece === "sleeve" && E.isActive(p)) ? p.working.sleeveEdit : null;
    return { lineId: boundaryState.lineId, allowed: boundaryState.allowed, kind: boundaryState.kind, reason: boundaryState.reason, shown: shown,
      apply: boundaryApplyOf(boundaryState, shown), applied: boundaryState.kind === "applied",
      edit: ed ? { count: ed.ops.length, pending: quickEditPending(p) } : null };
  }
  // 빠른 판정: 수정 반영 뒤 아직 «소매 모양 완료» 전인가(완료본 outline ≠ 화면 outline) — 비싼 isCurrentSleeveChanged 는 부르지 않는다.
  function quickEditPending(p) {
    const s = p.working.sleeveResult, g = p.working.geometry && p.working.geometry.sleeve;
    return !s || !s.manualEdit || !s.geometry || !g || J_(s.geometry.outline) !== J_(g.outline);
  }
  function setBoundaryNote(m) { const el = document.getElementById("designBoundaryNote"); if (el) el.textContent = m; }
  // 선택된 유효 대체선으로 파생 outline 미리보기 생성. 성공 시에만 working.boundaryPreview
  // 원자적 교체. 원본 geometry·patternLines·완료본 불변, 출처(선·외곽·소매 완료본)가 바뀌면 숨김·제거. 반환 = 미리보기 생성 여부.
  //   미리보기는 완성 외곽이 아니다 — 몸판은 «디자인 외곽 합성»이 반영 경로(종전), 소매는 반영 경로 없음(sleeveResult·Design 결과 그대로).
  function doBoundaryPreview() {
    if (mode !== "select" || !selectedId) return false;
    const line = findLine(selectedId); if (!line || line.role !== "boundary") { setBoundaryNote("외곽 대체선을 선택하세요"); return false; }
    const p = project(); if (!p) return false;
    const v = validateSelectedBoundary();                  // ★ 미리보기 직전 재검증
    syncBoundaryStatus(v);
    if (!v || !v.ok) { setBoundaryNote("대체 불가: " + (v ? boundaryReasonOf(v) : "대체선 아님")); return false; }
    if (line.piece === "sleeve") {
      const ref = v._ref;
      if (!ref || ref.source !== "current") { setBoundaryNote("대체 불가: " + (ref ? ref.reason : "소매 기준 없음")); return false; }
      p.working.boundaryPreview = window.sleeveSplit.makeBoundaryPreview(ref, line, v);
      const ap = v.apply;
      setBoundaryNote("대체 미리보기 · 소매 " + ref.sym + (v.piece !== "sleeve" ? "(" + v.piece + ")" : "") + " 파생 외곽선(보라) — 미리보기일 뿐 · 확인 후 «외곽 반영»을 눌러야 소매에 반영됩니다" + (ap && !ap.allowed ? " · 반영 불가: " + ap.reason : "") + " · 소매·몸판·선이 바뀌면 사라집니다");
    } else {
      p.working.boundaryPreview = { sourcePiece: line.piece, sourceLineId: line.id, outline: v.outline, sourceLineSig: J_(line.segments), sourceOutlineSig: J_(currentOutlineSegs(p, line.piece)) };
      setBoundaryNote("대체 미리보기 · 파생 외곽선(다른 색)");
    }
    rerender();
    syncApplyButtons();
    return true;
  }
  // 소매 «외곽 반영»(2026-11-06 김님 승인): 보이는 미리보기를 확인한 뒤 **명시 클릭으로만** 소매에 반영한다(역할 선택·미리보기만으로는 반영 없음).
  //   직전 재판정·원자적 반영은 sleeveOutlineEdit.apply 가 한다(실패면 아무것도 바뀌지 않음). 반영 뒤 = 수정 중(미완료) — 더 반영하거나 «소매 모양 완료».
  function sleeveUIRefresh() { if (typeof window.refreshSleeveCheckpointUI === "function") window.refreshSleeveCheckpointUI(); }
  function doBoundaryApply() {
    if (mode !== "select" || !selectedId) return false;
    const line = findLine(selectedId);
    if (!line || line.role !== "boundary" || line.piece !== "sleeve") { setBoundaryNote("소매 외곽 대체선을 선택하세요"); return false; }
    const p = project(), E = window.sleeveOutlineEdit; if (!p || !E) { setBoundaryNote("반영 안 함: 소매 외곽 반영 모듈 없음"); return false; }
    const r = E.apply(p, line);
    if (!r.ok) { setBoundaryNote("반영 안 함: " + r.reason); syncCutStatus(); return false; }
    const bad = r.cuts.invalid.length;
    setBoundaryNote("외곽 반영됨 · 소매 " + p.working.sleeveEdit.sym + " " + r.label + (r.hemCut ? "" : " 수정") + "(수동 외곽 수정 " + r.count + "회) — 더 고칠 선이 있으면 이어서 반영 · 다 고쳤으면 소매 탭 «소매 모양 완료»"
      + (r.cuts.total ? " · 소매 절개선 " + r.cuts.total + "개 중 " + (bad ? bad + "개는 새 외곽에서 무효(선을 선택하면 이유)" : "모두 새 외곽에서 유효") : ""));
    syncCutStatus(); rerender(); sleeveUIRefresh();
    return true;
  }
  // 마지막 반영 하나 되돌리기(최소 복귀 동선 — 새 undo 체계 아님). 한 번뿐이었다면 원래 소매 완료본 형상으로.
  function doSleeveEditUndo() {
    const p = project(), E = window.sleeveOutlineEdit; if (!p || !E) return false;
    const r = E.undoLast(p);
    setBoundaryNote(r.ok ? (r.count ? "마지막 외곽 반영을 되돌림 · 남은 수동 외곽 수정 " + r.count + "회" : "수동 외곽 수정을 모두 되돌림 · 원래 소매 형상") + " — 소매 상태는 소매 탭에서 확인" : "되돌리지 않음: " + r.reason);
    syncCutStatus(); rerender(); sleeveUIRefresh();
    return !!r.ok;
  }
  // ── 옆선 길이 자석 ──
  //   길이 = bodiceCheckpoint 의 옆선 봉제 길이(같은 segLen · 같은 명시 side-seam 집합). 드래그 중에는 남은 외곽 몫 K(시작 때 권위 계측 −
  //   이 선 몫)를 고정하고 이 선의 몫만 다시 잰다 — 이 선 밖의 점(진동점·허리점·밑단·기준판)은 움직이지 않으므로 K 는 그대로다.
  //   손 뗀 뒤 실제 커밋은 종전 재합성(recomposeAfterBoundaryEdit) → 완료 검사가 권위로 다시 잰다.
  const SEAM_OTHER = { front: "back", back: "front" };
  function seamMulti(g) { return !!(g && (g.frontPeplum || g.backPeplum || g.frontYoke || g.shoulderYoke || g.frontCenter || g.backCenter)); }
  function _chainEnds(line, mySegs) {
    const pts = []; mySegs.forEach(sg => { pts.push(sg.from); pts.push(sg.to); });
    const near = q => pts.reduce((b, r) => (Math.hypot(r.x - q.x, r.y - q.y) < Math.hypot(b.x - q.x, b.y - q.y) ? r : b), pts[0]);
    const s0 = line.segments[0].from, s1 = line.segments[line.segments.length - 1].to;
    return { E0: _pt(near(s0)), E1: _pt(near(s1)) };
  }
  // 선(line) 하나의 옆선 문맥(순수 판정 · p 미변경). {touches, ok, reason, piece, K, ref, T, intent, E0, E1, keptFlat, comp}
  function seamInfoFor(p, line) {
    const BC = window.bodiceCheckpoint, M = window.sideSeamMagnet;
    if (!line || line.role !== "boundary" || (line.piece !== "front" && line.piece !== "back")) return { touches: false };
    if (!BC || !BC.measureSideSeam || !M) return { touches: false };
    if (!isOriginalBodiceContext(p)) return { touches: true, ok: false, reason: "소매 파생 몸판 맥락 — 옆선 자석은 원래 몸판 전용(파생 몸판 옆선은 소매 완료본 소유)" };
    if (seamMulti(p.working.geometry)) return { touches: true, ok: false, reason: "다조각 몸판(페플럼·요크·프린세스) — 옆선 자석 범위 밖" };
    const comp = composeWith(p.working.geometry, p.working.patternLines);
    if (!comp.ok) return { touches: true, ok: false, reason: "현재 외곽 합성 불가: " + comp.reason };
    const dO = comp.designOutline || {}, piece = line.piece, other = SEAM_OTHER[piece];
    const outl = dO[piece] ? dO[piece].outline : null;
    const mine = outl ? outl.filter(sg => sg.edgeSourceLineId === line.id) : [];
    if (!mine.length) return { touches: false };
    const inh = mine.every(sg => sg.edge === "side-seam" && sg.edgeInherited === true);
    const partial = mine.some(sg => Array.isArray(sg.replacedEdges) && sg.replacedEdges.indexOf("side-seam") >= 0);
    if (!inh) return partial ? { touches: true, ok: false, reason: "이 대체선이 옆선과 다른 외곽(" + mine[0].replacedEdges.filter(e => e !== "side-seam").join("·") + ")에 걸쳐 옆선 의미를 정할 수 없음 — 옆선 구간 안에서 시작·끝내세요(옆선 측정 불가)" } : { touches: false };
    const msMe = BC.measureSideSeam(outl);
    const otherOutl = dO[other] ? dO[other].outline : BC.effectiveOutline({ working: Object.assign({}, p.working, { designOutline: null }) }, other);
    const msRef = BC.measureSideSeam(otherOutl);
    if (msMe.status !== "measured") return { touches: true, ok: false, reason: "이 판 옆선 측정 불가" };
    if (msRef.status !== "measured") return { touches: true, ok: false, reason: (other === "front" ? "앞판" : "뒤판") + " 옆선 측정 불가 — 기준 길이가 없음" };
    const si = BC.sideSeamIntent(p); if (!si.ok) return { touches: true, ok: false, reason: "저장된 옆선 의도가 올바르지 않음 — 다시 지정하세요" };
    const myLen = mine.reduce((a, sg) => a + BC.sideSeamSegLen(sg), 0);
    const ends = _chainEnds(line, mine);
    const keptFlat = flattenLine(outl.filter(sg => sg.edgeSourceLineId !== line.id));
    const base = { touches: true, piece: piece, other: other, len: msMe.length, ref: msRef.length, K: msMe.length - myLen, intent: si.intent,
      T: M.targetFor(piece, msRef.length, si.intent), E0: ends.E0, E1: ends.E1, keptFlat: keptFlat, composed: !!(p.working.designOutline && p.working.designOutline[piece] && (p.working.designOutline[piece].lineIds || []).indexOf(line.id) >= 0) };
    if (!seamMagnetOn) return Object.assign(base, { ok: false, reason: "옆선 자석 꺼짐" });
    if (seamBasis === piece) return Object.assign(base, { ok: false, reason: "기준판(" + (piece === "front" ? "앞" : "뒤") + ")은 고정 — " + (piece === "front" ? "뒤판" : "앞판") + " 옆선을 편집하면 붙습니다" });
    return Object.assign(base, { ok: true });
  }
  function _forcedLen(c, segs) {
    const BC = window.bodiceCheckpoint, cl = segs.map(cloneSeg);
    cl[0].from = _pt(c.E0); cl[cl.length - 1].to = _pt(c.E1);
    return cl.reduce((a, sg) => a + BC.sideSeamSegLen(sg), 0);
  }
  function _seamValid(c, segs) {
    const f = flattenLine(segs);
    for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) if (segCross(f[i][0], f[i][1], f[j][0], f[j][1])) return { ok: false, reason: "self-cross" };
    for (const kb of c.keptFlat) for (const bs of f) { const q = segCross(bs[0], bs[1], kb[0], kb[1]); if (q && !nearAny(q, [c.E0, c.E1], 0.05)) return { ok: false, reason: "kept-cross" }; }
    return { ok: true };
  }
  // 한 프레임: build(Q) = 점/핸들이 Q 일 때 이 선의 세그먼트. 반환 {snapped, point?} — seamLive 갱신.
  function seamStep(cursor, build, minPoint) {
    const c = seamCtx, M = window.sideSeamMagnet;
    const f = Q => c.K + _forcedLen(c, build(Q));
    const r = M.decide({ f: f, T: c.T, cursor: cursor, pxToCm: pxToCm(), locked: !!(seamLive && seamLive.locked),
      valid: Q => _seamValid(c, build(Q)), minLen: minPoint ? f(minPoint) : undefined });
    return { r: r, f: f };
  }
  function setSeamLive(c, len, r) {
    seamLive = { piece: c.piece, composed: c.composed, len: len, ref: c.ref, T: c.T, remain: len - c.T, snapped: !!(r && r.snapped), locked: !!(r && r.locked), reason: r && !r.snapped ? r.reason : null, intent: c.intent };
  }
  function fmt2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function fmtS(v) { const a = Math.round(v * 100) / 100; return (a > 0 ? "+" : a < 0 ? "−" : "±") + Math.abs(a).toFixed(2); }
  // 드래그 중 실측 문구(2026-11-08): 목표·남은 차·자석 문구 없이 이 판 옆선 봉제 길이만(권위 계측과 같은 길이 함수). 아직 외곽 반영 전인 선이면 «반영하면» 값임을 밝힌다.
  function seamLiveText(L) {
    const me = L.piece === "front" ? "앞" : "뒤";
    return me + " 옆선 " + fmt2(L.len) + "cm" + (L.composed === false ? "(이 선을 몸판 외곽에 반영하면)" : "") + (L.snapped ? " · 자석 붙음" : "");
  }
  // 막대(선택 선) 표시: 권위 계측(완료가 보는 유효 외곽) + 의도 + 자석 상태. render 마다 재합성하지 않도록 출처 키 캐시.
  function getSeamState() {
    const p = project(); if (!p || mode !== "select" || !selectedId) return null;
    if (seamLive && editDrag) return { show: true, live: true, text: seamLiveText(seamLive), magnet: { on: seamMagnetOn, basis: seamBasis } };
    const line = findLine(selectedId); if (!line || line.role !== "boundary" || (line.piece !== "front" && line.piece !== "back")) return null;
    const key = J_(p.working.patternLines) + "|" + J_(p.working.sideSeamIntent || null) + "|" + seamMagnetOn + seamBasis + "|" + line.id + "|" + J_(p.working.designOutline ? Object.keys(p.working.designOutline).map(k => p.working.designOutline[k].lineIds) : null);
    if (seamStateCache && seamStateCache.key === key && seamStateCache.geom === p.working.geometry) return seamStateCache.val;
    const info = seamInfoFor(p, line);
    // 2026-11-09: 몸판 외곽에 반영된 선이면 옆선이 아니어도(예: 둥근 밑단 = hem) 같은 행(옆선 숫자·몸판 완료 막힘 사유·완료 버튼)을 보인다 — 좁은 화면에서 오른쪽 안내가 안 보여도 마무리 방법이 팝업에 있게.
    const dOl = p.working.designOutline && p.working.designOutline[line.piece], reflected = !!(dOl && (dOl.lineIds || []).indexOf(line.id) >= 0);
    let val = null;
    if (info.touches || reflected) {
      const BC = window.bodiceCheckpoint, M = window.sideSeamMagnet;
      const c = BC.check(p).sideSeam;   // 권위(완료 게이트와 같은 판정)
      const sI = BC.sideSeamIntent ? BC.sideSeamIntent(p) : null, sIntent = info.intent || (sI && sI.ok ? sI.intent : null);
      // 2026-11-08: 숫자 그대로(앞·뒤·차) — 목표·자석 문구 없음. 옛 프로젝트에 저장된 여유 의도가 있으면 그 사실만 밝힌다(판정에 쓰임).
      let text = c.status === "unmeasured" ? "옆선 측정 불가(완료 불가)" :
        "옆선 앞 " + fmt2(c.front) + " · 뒤 " + fmt2(c.back) + " · 뒤−앞 " + fmtS(c.back - c.front) + "cm" + (sIntent ? " · 저장된 여유 의도 " + M.intentText(sIntent) : "");
      if (info.T != null && info.composed === false) text += " · 몸판 외곽 반영 전(완료 판정은 아직 원래 옆선) — 이 선을 반영하면 " + (info.piece === "front" ? "앞 " : "뒤 ") + fmt2(info.len);
      val = { show: true, live: false, text: text, magnet: { on: seamMagnetOn, basis: seamBasis, active: !!info.ok, reason: info.ok ? null : info.reason } };
    }
    seamStateCache = { key: key, geom: p.working.geometry, val: val };
    return val;
  }
  function getSeamLive() { return seamLive && editDrag ? Object.assign({}, seamLive, { text: seamLiveText(seamLive) }) : null; }
  function setSeamMagnet(on) { seamMagnetOn = !!on; seamStateCache = null; if (window.designLineQuickBar) window.designLineQuickBar.sync(); return seamMagnetOn; }
  function setSeamBasis(b) { if (b !== "front" && b !== "back" && b !== "auto") return seamBasis; seamBasis = b; seamStateCache = null; if (window.designLineQuickBar) window.designLineQuickBar.sync(); return seamBasis; }
  function getSeamSettings() { return { on: seamMagnetOn, basis: seamBasis }; }
  // ── 옆선 길이 상시 표시(2026-11-08 김님 «옆선 길이를 외곽선과 같은 색으로 알려 달라 · 다르면 내가 고친다») ──
  //   값 = 완료 판정과 같은 권위 계측(bodiceCheckpoint.measureSideSeam(effectiveOutline) — 명시 side-seam 봉제 길이 · 연장 포함).
  //   직선 높이·끝점 거리로 대신하지 않는다. 측정 불가 = 0 이 아니라 «확인 필요 + 사유». 소매 파생 몸판·다조각 몸판은 원래 몸판 값을
  //   다른 조각에 붙이지 않도록 값 없이 사유만. 편집 드래그 중(이미 외곽에 반영된 선)은 같은 길이 함수의 실시간 값. 형상·완료 hash 무관(읽기 전용).
  //   at = 라벨을 붙일 옆선 위 점(표시 위치 전용 — 길이 계산에 쓰지 않음) · out = 피스 바깥 방향(+1 오른쪽 / −1 왼쪽).
  function sideSeamLabels(p) {
    p = p || project(); const BC = window.bodiceCheckpoint;
    if (!p || !p.working || !p.working.geometry || !BC || !BC.measureSideSeam || !BC.effectiveOutline) return null;
    const g = p.working.geometry;
    // 2026-11-09: 파생 여부 = **실제 화면에 그려진** 파생 몸판(displayedDerivedPiece — hit·snap 과 같은 권위). 차단·미완성으로 그려지지 않은
    //   소매 상태 키만 남았다고 원래 몸판 값을 숨기지 않는다(그려진 것 = 원래 몸판 → 그 값). 편집 지원 게이트(isOriginalBodiceContext)는 그대로.
    const multi = seamMulti(g) ? "여러 조각 몸판 — 조각별 옆선 길이는 아직 표시 안 함" : null;
    const out = {};
    ["front", "back"].forEach(pc => {
      const scope = displayedDerivedPiece(p, pc) ? "소매 파생 몸판 — 옆선은 소매 완료본에서 확인" : multi;
      const name = pc === "front" ? "앞" : "뒤";
      const outl = BC.effectiveOutline(p, pc) || [];
      let pos = outl.filter(sg => sg && sg.edge === "side-seam");
      if (!pos.length) pos = ((g[pc] && g[pc].outline) || []).filter(sg => sg && sg.edge === "side-seam");
      let len = null, reason = scope, live = false;
      if (!scope) {
        const ms = BC.measureSideSeam(outl);
        if (ms.status === "measured") len = ms.length;
        else if (ms.reason === "side-seam-partially-unresolved") {   // 2026-11-09: 실제 replacedEdges 에 있는 의미만 나열(진동·밑단을 무조건 같이 쓰지 않음)
          const other = []; outl.forEach(sg => { if (sg && sg.edgeStatus === "unresolved" && Array.isArray(sg.replacedEdges) && sg.replacedEdges.indexOf("side-seam") >= 0) sg.replacedEdges.forEach(e => { if (e !== "side-seam") { const k = EDGE_KO[e] || e; if (other.indexOf(k) < 0) other.push(k); } }); });
          const lst = other.join("·"), lc = lst ? lst.charCodeAt(lst.length - 1) - 0xAC00 : -1, josa = (lc >= 0 && lc < 11172 && lc % 28 !== 0) ? "과" : "와";
          reason = "옆선 일부가 " + (lst ? lst + josa + " 함께 한 선으로" : "다른 외곽과 함께") + " 대체됨 — 새 선의 의미를 정할 수 없음";
        } else reason = "명시된 옆선 구간 없음";
        if (len != null && seamLive && editDrag && seamLive.piece === pc && seamLive.composed) { len = seamLive.len; live = true; }
      }
      // 표시 위치: 옆선 꺾은선 길이의 가운데 점(위치 전용 근사) · 바깥 방향 = 피스 bbox 중심의 반대쪽
      const fl = flattenLine(pos); let at = null;
      if (fl.length) {
        const tot = fl.reduce((a, ab) => a + Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y), 0); let acc = 0;
        for (const ab of fl) { const d = Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y); if (acc + d >= tot / 2 && d > 0) { const t = (tot / 2 - acc) / d; at = { x: ab[0].x + (ab[1].x - ab[0].x) * t, y: ab[0].y + (ab[1].y - ab[0].y) * t }; break; } acc += d; }
        if (!at) at = { x: fl[0][0].x, y: fl[0][0].y };
      }
      const bb = window.designLayout && window.designLayout.bboxOf ? window.designLayout.bboxOf(g, pc) : null;
      const outDir = (at && bb) ? (at.x >= (bb.minX + bb.maxX) / 2 ? 1 : -1) : 1;
      if (!at && bb) at = { x: outDir > 0 ? bb.maxX : bb.minX, y: (bb.minY + bb.maxY) / 2 };
      out[pc] = { piece: pc, length: len, live: live, reason: len == null ? reason : null, at: at, out: outDir,
        text: len != null ? name + " 옆선 " + fmt2(len) + "cm" : name + " 옆선 길이 확인 필요 · " + reason };
    });
    return out;
  }

  // ── 옆선 «길이 맞춤»(2026-11-07 김님 «자석 순간을 눈대중으로 찾아야만 완료» 해소) ──
  // 선택한 옆선 대체선에서 명시 클릭 한 번 → 이 선의 **중간 점·곡선 핸들 하나**를 움직여 목표 길이에 정확히 닿는 후보를 계산.
  //   · 계측 = 자석과 같은 길이 함수(seamInfoFor 의 K + _forcedLen = bodiceCheckpoint 옆선 봉제 길이) · 해법 = 자석과 같은 sideSeamMagnet.projectToLevel
  //     (현재 위치에서 등위선으로 사영 = 그 자유도에서 원래 위치에 가장 가까운 해) · 유효성 = 자석과 같은 _seamValid(자기 교차·남은 외곽 교차 금지).
  //   · 후보 여럿 = 움직임(cm)이 가장 작은 유효 후보(원래 형상에 가장 가까운 것).
  //   · 끝점(진동점·허리점·밑단 연결점)은 움직이지 않는다 · 점·곡선을 새로 만들지 않는다 · 이세·셔링 자동 추가 없음.
  //   · 미리보기 = 형상 불변(seamFit 은 UI 상태) · «반영» = 원자적(재합성·권위 옆선 판정 실패 시 선·외곽·파트·미리보기 전부 이전 그대로) · «취소» = 버림.
  let drawHint = null;   // 그리기 중 마지막 클릭이 거부된 이유(UI 전용 · 다음 점이 찍히면 지움)
  let seamFit = null;   // { key, lineId, piece, segments, from, to, label, before, T }
  function seamFitKey(p, line) { return J_(line.segments) + "|" + J_(p.working.sideSeamIntent || null) + "|" + seamBasis + "|" + line.id + "|" + J_(p.working.designOutline ? Object.keys(p.working.designOutline).map(k => p.working.designOutline[k].lineIds) : null); }
  function seamFitPlan(p, line) {
    const info = seamInfoFor(p, line); if (!info.touches) return null;
    const me = line.piece === "front" ? "앞판" : "뒤판", ot = line.piece === "front" ? "뒤판" : "앞판";
    const dofCount = (line.segments.length - 1) + line.segments.filter(sg => sg.kind === "cubic").length * 2;
    const no = (reason, next, extra) => Object.assign({ ok: false, reason: reason, next: next || "", dof: dofCount }, extra || {});
    if (info.T == null) return no(info.reason || "옆선 길이를 잴 수 없음", "옆선 구간 안에서 시작·끝나는 선인지 확인하세요");
    if (seamBasis === line.piece) return no("기준판(" + me + ")은 고정으로 설정됨", ot + " 옆선 선을 선택해 맞추거나, 설정에서 기준판을 «자동»으로 바꾸세요");
    if (!info.composed) return no("아직 몸판 외곽에 반영 전", "먼저 «몸판 외곽으로 반영»을 누르세요");
    const f = segs => info.K + _forcedLen(info, segs);
    const cur = f(line.segments), base = { len: cur, T: info.T, ref: info.ref, dof: dofCount };
    if (Math.abs(cur - info.T) < 0.005) return Object.assign({ ok: false, done: true, reason: "이미 목표 길이와 같음", next: "" }, base);
    const chordMin = info.K + Math.hypot(info.E1.x - info.E0.x, info.E1.y - info.E0.y);
    if (info.T < chordMin - 1e-6) return no("불가능: 목표 " + fmt2(info.T) + "cm 가 두 끝점을 곧게 이은 길이 " + fmt2(chordMin) + "cm 보다 짧음",
      "끝점(진동점·허리점·밑단)은 자동으로 옮기지 않습니다 — «여유»로 목표를 바꾸거나, " + ot + " 옆선을 맞추세요", base);
    if (dofCount === 0) return no("이 선은 두 점 직선이라 움직일 중간 점·곡선 핸들이 없음",
      "중간 점이 있는 선(3점 이상)이나 곡선(드래그)으로 다시 그리면 «길이 맞춤»을 쓸 수 있습니다", base);
    const M = window.sideSeamMagnet, cands = [];
    // 사영 시작점: 현재 위치(그 자유도에서 가장 가까운 해). 점이 양옆 점을 잇는 직선 위에 있으면 길이 기울기가 0(어느 쪽으로 밀어도 길어짐)
    //   → 그 직선의 양쪽(수직 ±0.5cm)에서도 시작해 두 쪽 해를 모두 후보로 둔다(어느 쪽으로 휠지는 사용자가 «다른 후보»로 고른다 — 임의 판단 없음).
    const tryDof = (label, start, build, chordA, chordB) => {
      const starts = [start];
      if (chordA && chordB) { const dx = chordB.x - chordA.x, dy = chordB.y - chordA.y, L = Math.hypot(dx, dy); if (L > 1e-9) { const n = { x: -dy / L * 0.5, y: dx / L * 0.5 }; starts.push({ x: start.x + n.x, y: start.y + n.y }, { x: start.x - n.x, y: start.y - n.y }); } }
      starts.forEach(st => {
        const pr = M.projectToLevel(Q => f(build(Q)), info.T, st);
        if (!pr.ok) return;
        if (cands.some(c => c.label === label && Math.hypot(c.to.x - pr.point.x, c.to.y - pr.point.y) < 1e-6)) return;
        const segs = build(pr.point); if (!_seamValid(info, segs).ok) return;
        const v = f(segs); if (!(Math.abs(v - info.T) < 1e-5)) return;
        cands.push({ label: label, segments: segs, from: { x: start.x, y: start.y }, to: pr.point, move: Math.hypot(pr.point.x - start.x, pr.point.y - start.y) });
      });
    };
    const a = anchorsFromSegments(line.segments);
    for (let k = 1; k < a.length - 1; k++) {
      const oa = a[k], orig = line.segments;
      tryDof("중간 점 " + k, oa, Q => { const tmp = { segments: JSON.parse(JSON.stringify(orig)) }; moveAnchor(tmp, k, Q.x - oa.x, Q.y - oa.y); return tmp.segments; }, a[k - 1], a[k + 1]);
    }
    line.segments.forEach((sg, si) => {
      if (sg.kind !== "cubic") return;
      ["c1", "c2"].forEach(which => tryDof("곡선 핸들", sg[which], Q => line.segments.map((s, ix) => { if (ix !== si) return s; const o = cloneSeg(s); o[which] = { x: Q.x, y: Q.y }; return o; }), sg.from, sg.to));
    });
    if (!cands.length) return no("이 선의 중간 점·핸들 하나로는 목표 길이에 닿는 모양을 찾지 못함(선이 꼬이거나 외곽과 교차)", "점을 직접 끌어 모양을 바꾼 뒤 다시 «길이 맞춤»을 누르세요", base);
    cands.sort((x, y) => (x.move - y.move) || (x.to.x - y.to.x) || (x.to.y - y.to.y));   // 가장 조금 움직이는 후보 먼저 · 동률은 결정적 순서
    return Object.assign({ ok: true, reason: "", next: "", best: cands[0], cands: cands, count: cands.length }, base);
  }
  function getSeamFit() {
    const p = project(); if (!p || mode !== "select" || !selectedId) return null;
    const line = findLine(selectedId); if (!line || line.role !== "boundary" || (line.piece !== "front" && line.piece !== "back")) return null;
    const plan = seamFitPlan(p, line); if (!plan) return null;
    const pv = getSeamFitPreview();
    return { ok: !!plan.ok, done: !!plan.done, reason: plan.reason, next: plan.next, dof: plan.dof, len: plan.len, T: plan.T, ref: plan.ref, count: plan.count || 0,
      preview: pv ? { label: pv.label, move: pv.move, before: pv.before, T: pv.T, index: pv.index, count: pv.count, dropped: pv.dropped } : null,
      note: (!pv && seamFitNote && seamFitNote.key === seamFitKey(p, line)) ? seamFitNote.text : null };
  }
  function getSeamFitPreview() {
    if (!seamFit || mode !== "select" || selectedId !== seamFit.lineId) return null;
    const p = project(), line = p && findLine(seamFit.lineId);
    if (!line || seamFitKey(p, line) !== seamFit.key || seamFit.geom !== p.working.geometry) { seamFit = null; return null; }
    return seamFit;
  }
  // 후보를 완료 게이트 전체(권위 check)로 시험: 반영했다고 가정한 사본 프로젝트에서 합성 → check. 형상 불변(사본만).
  //   허용 = 새 차단 사유를 만들지 않음(지금 있던 옆선 불일치·측정 불가는 풀리는 것이 목적이라 제외) + 옆선 정합.
  //   (예: 옆선 대체선 끝점이 외곽 모서리와 미세하게 어긋난 채 바깥으로 휘면 «앞판 외곽이 연결되지 않음» — 그런 후보는 내놓지 않는다.)
  function seamFitGate(p, line, segs) {
    const BC = window.bodiceCheckpoint, before = BC.check(p).fails || [];
    const pls = p.working.patternLines.map(l => l.id === line.id ? Object.assign({}, l, { segments: segs }) : l);
    const comp = composeWith(p.working.geometry, pls);
    if (!comp.ok) return { ok: false, why: "외곽 합성 불가" };
    const c = BC.check(Object.assign({}, p, { working: Object.assign({}, p.working, { patternLines: pls, designOutline: comp.designOutline, parts: [], boundaryPreview: null }) }));
    const SEAM = ["side-seam-mismatch", "side-seam-unmeasured"];
    const added = (c.fails || []).filter(f => before.indexOf(f) < 0 && SEAM.indexOf(f) < 0);
    if (c.sideSeam.status === "mismatch" || c.sideSeam.status === "unmeasured") return { ok: false, why: "옆선 판정 불일치" };
    if (added.length) return { ok: false, why: added.map(f => window.bodiceFailText ? window.bodiceFailText(f) : f).join(" · ") };
    return { ok: true };
  }
  // next = true → 지금 미리보기의 다음 후보(같은 출처일 때만 · 끝이면 처음으로). 완료 게이트를 깨는 후보는 건너뛰고 이유를 남긴다.
  let seamFitNote = null;
  function previewSeamFit(next) {
    const p = project(), line = selectedId && findLine(selectedId); if (!p || !line || mode !== "select") return false;
    seamFitNote = null;
    const plan = seamFitPlan(p, line); if (!plan || !plan.ok) { seamFit = null; rerender(); return false; }
    const usable = [], dropped = [];
    plan.cands.forEach(cd => { const g = seamFitGate(p, line, cd.segments); if (g.ok) usable.push(cd); else dropped.push(g.why); });
    if (!usable.length) {
      seamFit = null;
      seamFitNote = { key: seamFitKey(p, line), text: "후보 " + plan.count + "개 모두 반영하면 완료 검사가 새로 막힘(" + Array.from(new Set(dropped)).join(" · ") + ") — 내놓지 않음 · 선 끝점이 외곽 모서리에 정확히 붙었는지 확인하거나 점을 직접 조정하세요" };
      rerender(); return false;
    }
    const cur = next ? getSeamFitPreview() : null, idx = cur ? (cur.index + 1) % usable.length : 0, b = usable[idx];
    seamFit = { key: seamFitKey(p, line), geom: p.working.geometry, lineId: line.id, piece: line.piece, segments: b.segments, from: b.from, to: b.to, label: b.label, move: b.move, before: plan.len, T: plan.T, index: idx, count: usable.length,
      dropped: dropped.length ? dropped.length + "개 후보 제외(" + Array.from(new Set(dropped)).join(" · ") + ")" : null };
    rerender(); return true;
  }
  function cancelSeamFit() { const had = !!seamFit; seamFit = null; if (had) rerender(); return had; }
  function applySeamFit() {
    const pv = getSeamFitPreview(); if (!pv) return { ok: false, reason: "미리보기가 없거나 낡음 — 다시 «길이 맞춤»을 누르세요" };
    const p = project(), w = p.working, line = findLine(pv.lineId);
    const prev = { segs: line.segments, parts: w.parts, bp: w.boundaryPreview, dO: w.designOutline };
    pv.failsBefore = window.bodiceCheckpoint.check(p).fails || [];
    const restore = reason => {
      line.segments = prev.segs; w.parts = prev.parts; w.boundaryPreview = prev.bp; w.designOutline = prev.dO;
      seamStateCache = null; rerender(); notifyDesignResult();
      if (window.refreshFrontPlacket) window.refreshFrontPlacket();
      if (window.refreshDesignBodyPanel) window.refreshDesignBodyPanel();
      return { ok: false, reason: reason };
    };
    line.segments = JSON.parse(JSON.stringify(pv.segments));
    const r = recomposeDesignOutline();
    if (!r.ok) return restore("외곽 합성 불가: " + r.reason);
    const c1 = window.bodiceCheckpoint.check(p), ss = c1.sideSeam;
    if (ss.status === "mismatch" || ss.status === "unmeasured") return restore("반영해도 옆선 판정이 맞지 않음(" + ss.status + ")");
    const added = (c1.fails || []).filter(f => (pv.failsBefore || []).indexOf(f) < 0 && f !== "side-seam-mismatch" && f !== "side-seam-unmeasured");
    if (added.length) return restore("반영하면 완료 검사가 새로 막힘(" + added.map(f => window.bodiceFailText ? window.bodiceFailText(f) : f).join(" · ") + ")");
    seamFit = null; seamStateCache = null;
    setBoundaryNote("옆선 길이 맞춤 반영 · 외곽 재합성");
    if (window.refreshFrontPlacket) window.refreshFrontPlacket();
    if (window.refreshDesignBodyPanel) window.refreshDesignBodyPanel();
    syncCutStatus(); rerender(); notifyDesignResult();
    return { ok: true };
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
    const res = composeDesignOutline(rb.ring, bl.map(boundarySegsOf), BODICE_COMPOSE_OPTS);
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
    // 합성 뒤 판정 재동기화(2026-11-10): 종전엔 rerender 만 해서 선택 선의 «판정 보류» 캐시가 재클릭 전까지 남았다(«몸판 외곽으로 반영»과 같은 후처리).
    seamStateCache = null; syncRoleButtons(); syncCutStatus(); rerender(); notifyDesignResult();
    if (window.refreshFrontPlacket) window.refreshFrontPlacket();
    if (window.refreshDesignBodyPanel) window.refreshDesignBodyPanel();
  }
  // ── «몸판 외곽으로 반영»(2026-11-06 김님 승인 UX) ──
  //   일반 앞·뒤판 사용자 선 하나를 [외곽 역할 지정 → 대체 검증(boundaryStatusOf) → 디자인 외곽 합성(composeForPiece)] 한 번의 명시 클릭으로 묶는다.
  //   기존 원리·검증(짧은 arc 선택 · 옆선 의미 승계)을 그대로 재사용한다. 실패하면 역할·parts·미리보기·designOutline 모두 이전 그대로(원자적).
  //   클릭 전에는 몸판 불변 · 자동 역할 반영 없음 · 사용자 최종 완료(bodiceResult)를 만들지 않는다.
  function reflectInfoFor(p, line) {
    if (!line || (line.piece !== "front" && line.piece !== "back") || line.managedBy) return null;
    if (isNeckAutoLine(line.id)) return null;
    if (!isOriginalBodiceContext(p)) return { allowed: false, reason: "소매 파생 몸판은 외곽 반영 미지원 — 파생 몸판 외곽은 소매 완료본 소유" };
    if (seamMulti(p.working.geometry)) return { allowed: false, reason: "다조각 몸판(페플럼·요크·프린세스)은 이 반영 미지원 — 오른쪽 «디자인 외곽 합성» 사용" };
    const dO = p.working.designOutline && p.working.designOutline[line.piece];
    if (line.role === "boundary" && dO && (dO.lineIds || []).indexOf(line.id) >= 0) return { allowed: false, done: true, reason: "몸판 외곽에 반영됨 · 선을 고치면 자동으로 다시 합성" };
    return { allowed: true, reason: "이 선을 몸판 외곽으로 반영합니다 · 누르기 전에는 몸판이 바뀌지 않습니다" };
  }
  function getReflectState() {
    const p = project(); if (!p || mode !== "select" || !selectedId) return null;
    return reflectInfoFor(p, findLine(selectedId));
  }
  // 반영 성공 안내(2026-11-09): 반영 직후 몸판 완료 판정(권위 check)이 막히면 성공 문구만 남기지 않고 실제 미완료 이유를 함께 보인다(자동 수정 없음).
  function reflectDoneNote(p) {
    const BC = window.bodiceCheckpoint, c = BC && BC.check ? BC.check(p) : null;
    if (!c || !c.fails || !c.fails.length) return "몸판 외곽으로 반영됨 · 선을 고치면 자동으로 다시 합성 · 마지막에 «몸판 모양 완료»";
    const F = window.bodiceFailText || (x => x), ss = c.sideSeam || {};
    const nums = (ss.front != null && ss.back != null) ? " (앞 옆선 " + fmt2(ss.front) + " · 뒤 옆선 " + fmt2(ss.back) + "cm)" : "";
    return "몸판 외곽으로 반영됨 · 아직 몸판 완료 안 됨: " + c.fails.map(f => F(f)).join(" · ") + nums;
  }
  function doReflectToBodice() {
    if (mode !== "select" || !selectedId) return false;
    const p = project(), line = findLine(selectedId); if (!p || !line) return false;
    const info = reflectInfoFor(p, line);
    if (!info) { setComposeNote("반영 불가: 앞·뒤판 일반 선이 아닙니다"); return false; }
    if (!info.allowed) { setComposeNote(info.done ? info.reason : "반영 불가: " + info.reason); return info.done === true; }
    const w = p.working, prev = { role: line.role, parts: w.parts, bp: w.boundaryPreview, dO: w.designOutline };
    const fail = reason => {   // 원자적: 아무것도 바뀌지 않은 상태로 복귀
      line.role = prev.role; w.parts = prev.parts; w.boundaryPreview = prev.bp; w.designOutline = prev.dO;
      setComposeNote("반영 안 됨: " + reason); syncRoleButtons(); syncCutStatus(); rerender(); return false;
    };
    line.role = "boundary";
    const v = boundaryStatusOf(p, line);
    if (!v || !v.ok) return fail(v ? v.reason : "대체선 아님");
    const result = {};
    for (const pc of ["front", "back"]) {
      const r = composeForPiece(p, pc);
      if (!r.ok) return fail("합성 불가(" + (pc === "front" ? "앞" : "뒤") + "판): " + r.reason);
      if (!r.empty) result[pc] = { outline: r.outline, lineIds: r.lineIds };
    }
    if (!result[line.piece] || (result[line.piece].lineIds || []).indexOf(line.id) < 0) return fail("합성 결과에 이 선이 들어가지 않음");
    w.parts = []; w.boundaryPreview = null; w.designOutline = result;
    setComposeNote(reflectDoneNote(p));
    seamStateCache = null; syncRoleButtons(); syncCutStatus(); rerender(); notifyDesignResult();
    if (window.refreshFrontPlacket) window.refreshFrontPlacket();
    if (window.refreshDesignBodyPanel) window.refreshDesignBodyPanel();
    return true;
  }
  // geometry 재계산(엉덩이 길이 등) 후 외부(ui.js)에서 호출: 절개선 재검사 + 파생 무효화.
  function revalidate() { invalidateParts(); syncRoleButtons(); syncCutStatus(); syncSplitButton(); rerender(); }
  // 선택 모드 pointerdown: 선택 선의 핸들·anchor 히트 → 편집 시작. 아니면 선 선택/해제.
  // 선택 모드의 클릭 피스 해석. 기본 = hit rect 피스(종전). 단 화면에 그려진 선·핸들이 rect 밖/다른 조각 rect 위로 나와 있으면
  //   그 실제 표시 위치(피스 offset·줌·팬이 반영된 geoAt, 화면 px 허용폭)로 선택 피스를 바꾼다. 우선순위:
  //   ① 현재 선택선의 핸들·anchor(rect 피스 쪽에서 이미 잡히면 그대로) ② rect 피스 안의 선 ③ 다른 피스의 선(가장 가까운 것).
  //   rect 피스에서 잡히는 것이 있으면 절대 가로채지 않는다. 임계 밖 = 종전 그대로(빈 공간·다른 조각 클릭 전파 없음).
  function pickableLine(l) { const p = project(); return typeof window.designLinePickable === "function" && !!p && window.designLinePickable(p, l) && !isNeckAutoLine(l.id); }
  function resolveSelectPiece(e, piece) {
    if (!inDesign()) return piece;
    const p = project(), L = window.designLayout ? window.designLayout.ensureLayout(p) : null;
    if (!L) return piece;
    const rCm = NODE_HIT_PX * pxToCm(), lCm = LINE_HIT_PX * pxToCm();
    // 보정 대상 = 화면에 실제 그려진 비관리 사용자 선만(render.js designLinePickable 공유 — 요크/프린세스 숨김·사라진 소매·관리선·카라 제외).
    //   네크라인 전용선도 관리선이라 제외. 판정 함수가 없으면(render 미적재) 보정 없음 = 종전 rect 규칙.
    const pickable = l => !!L[l.piece] && pickableLine(l);
    const near = (pc, only) => { const g = geoAt(e, pc); let d = Infinity; lines().forEach(l => { if (l.piece === pc && (!only || only(l))) d = Math.min(d, distToLine(g, l)); }); return { g, d }; };
    const sel = selectedId ? findLine(selectedId) : null;
    const handleHit = (line, g) => handlesOf(line).some(h => Math.hypot(g.x - h.c.x, g.y - h.c.y) < rCm) || anchorsFromSegments(line.segments).some(a => Math.hypot(g.x - a.x, g.y - a.y) < rCm);
    if (piece && sel && sel.piece === piece && handleHit(sel, geoAt(e, piece))) return piece;          // rect 피스 = 종전 selectDown 그대로
    if (sel && sel.piece !== piece && pickable(sel) && handleHit(sel, geoAt(e, sel.piece))) return sel.piece;
    if (piece && near(piece).d < lCm) return piece;
    let best = null, bd = lCm;
    const seen = {};
    lines().forEach(l => { if (!l.piece || seen[l.piece] || l.piece === piece || !pickable(l)) return; seen[l.piece] = 1; const d = near(l.piece, pickable).d; if (d < bd) { bd = d; best = l.piece; } });
    return best || piece;
  }
  function selectDown(e, piece, geo, only) {
    const rCm = NODE_HIT_PX * pxToCm(), lCm = LINE_HIT_PX * pxToCm();
    if (selectedId) {
      const line = findLine(selectedId);
      if (line && line.piece === piece && (!only || only(line))) {
        // 핸들 먼저(위에 그려짐)
        const hs = handlesOf(line);
        for (const h of hs) if (Math.hypot(geo.x - h.c.x, geo.y - h.c.y) < rCm) { editDrag = { kind: "handle", seg: h.seg, which: h.which, orig: JSON.parse(JSON.stringify(line.segments)) }; return; }   // orig = 두 손가락 전환 시 되돌리기(2026-11-11)
        const as = anchorsFromSegments(line.segments);
        for (let k = 0; k < as.length; k++) if (Math.hypot(geo.x - as[k].x, geo.y - as[k].y) < rCm) {
          if (isSleeveCapLine(line) && (k === 0 || k === as.length - 1)) { setNote("소매산 진동밑점은 고정됩니다 · SP·중간 anchor·핸들만 편집"); return; }   // 진동밑 endpoint 고정
          if (isCollarBodyLine(line) && (k === 0 || k === as.length - 1)) { setNote("이 점은 고정입니다(뒤중심·밴드 부착 앞끝 — 네모 표시) · 둥근 점과 핸들은 끌어서 수정할 수 있습니다"); return; }   // endpoint 고정
          editDrag = { kind: "anchor", k: k, startGeo: geo, origAnchor: { x: as[k].x, y: as[k].y }, orig: JSON.parse(JSON.stringify(line.segments)) }; return;
        }
      }
    }
    // 선 선택(같은 피스에서 가장 가까운 선, 임계 내). 없으면 해제.
    let best = null, bestD = lCm;
    lines().forEach(l => { if (l.piece !== piece || (only && !only(l))) return; const d = distToLine(geo, l); if (d < bestD) { bestD = d; best = l; } });
    selectedId = best ? best.id : null;
    setNote(best ? (isSleeveCapLine(selectedId) ? "소매산 관리선 · 진동밑 고정 · SP·중간 anchor·핸들 편집(재합성)"
      : isCollarBodyLine(selectedId) ? "위 칼라 바깥선 · 둥근 점 = 끌어서 이동 · 네모 점(양 끝) = 고정 · 곡선 핸들 = 휨 조절 · 지우려면 «기본형으로 돌아가기»"
      : isNeckAutoLine(selectedId) ? "네크라인 전용선 · 역할 변경·삭제 금지(기본형으로 돌아가기로만) · anchor/핸들만 편집"
      : "선택됨 · Delete 삭제 · anchor/핸들 드래그 · Esc 해제") : SELECT_NOTE);
  }
  // 편집 드래그 시작: 대상(중간 anchor·핸들)이 옆선 승계 대체선이면 자석 문맥을 만든다. 끝점 anchor = 외곽 연결점이라 자석 없음.
  function seamBegin() {
    seamCtx = null; seamLive = null;
    if (!editDrag) return;
    const p = project(), line = findLine(selectedId); if (!p || !line) return;
    const info = seamInfoFor(p, line); if (!info.touches) return;
    const nA = line.segments.length + 1;
    // 끝점을 옮기면 대체 구간 자체(남은 외곽 몫 K)가 바뀐다 → 드래그 중 길이 표시·자석 없음(손 떼면 권위 계측으로 표시).
    if (editDrag.kind === "anchor" && (editDrag.k === 0 || editDrag.k === nA - 1)) { seamCtx = { touches: true, ok: false, T: null, reason: "끝점은 외곽 연결점 — 옆선 자석은 중간 점·곡선 핸들에서 작동" }; return; }
    seamCtx = info;
    if (info.T != null) setSeamLive(info, info.len, null);
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
      let tip = { x: geo.x, y: geo.y };                                       // 핸들 위치 snap 없음(자유) — 옆선 길이 자석만 예외
      if (shiftKey) { const v = constrainAngle45(geo.x - anchor.x, geo.y - anchor.y); tip = { x: anchor.x + v.x, y: anchor.y + v.y }; }
      snapHint = null;
      let mg = null;
      if (seamCtx && seamCtx.T != null) {
        const which = editDrag.which, si = editDrag.seg;
        const build = Q => line.segments.map((sg, ix) => { if (ix !== si) return sg; const o = cloneSeg(sg); o[which] = { x: Q.x, y: Q.y }; return o; });
        if (seamCtx.ok && !shiftKey && !altKey) { const st = seamStep(tip, build); mg = st.r; if (mg.snapped) tip = mg.point; setSeamLive(seamCtx, mg.snapped ? mg.value : st.f(tip), mg); }
        if (seamLive) seamLive.at = { x: tip.x, y: tip.y };
        else setSeamLive(seamCtx, seamCtx.K + _forcedLen(seamCtx, build(tip)), null);
        if (mg && mg.snapped) snapHint = { piece: line.piece, point: { x: tip.x, y: tip.y }, type: "seam" };
      }
      seg[editDrag.which] = tip;                                              // 선택한 c1/c2만(반대쪽 강제 대칭 없음)
      setNote(seamLive ? seamLiveText(seamLive) : (shiftKey ? "핸들 45° 각도 고정 (Shift)" : "핸들 이동 · Shift = 45° 고정"));
    } else {                                                                  // anchor: 총 delta + snap
      const oa = editDrag.origAnchor;
      const nx = oa.x + (geo.x - editDrag.startGeo.x), ny = oa.y + (geo.y - editDrag.startGeo.y);
      let t;
      if (isSleeveCapLine(line)) {
        // 관리형 소매산 snap 제한: SP=grain x 고정·y 0.5 격자 / 중간=x·y 0.5 격자 / 다른 선 snap 금지 / Alt 해제.
        const isSP = editDrag.k === line.splitAnchorIndex, grid = v => Math.round(v / 0.5) * 0.5;
        t = { x: isSP ? oa.x : (altKey ? nx : grid(nx)), y: altKey ? ny : grid(ny) };
        snapHint = altKey ? null : { piece: line.piece, point: { x: t.x, y: t.y }, type: "grid" };
        setNote(isSP ? "SP · x 고정(grain) · y 0.5cm 격자(Alt 해제)" : "소매산 anchor · 0.5cm 격자(Alt 해제)");
      } else {
        const snap = snapForCursor({ x: nx, y: ny }, line.piece, altKey, oa);   // 자기 자신 anchor 제외
        t = snap ? snap.point : { x: nx, y: ny };
        snapHint = snap ? { piece: line.piece, point: snap.point, type: snap.type } : null;
        // 옆선 길이 자석: 의도한 점 흡착(anchor·끝점)이 우선, 외곽선·격자보다는 앞선다. Alt = 모든 흡착 해제(종전).
        if (seamCtx && seamCtx.T != null) {
          const k = editDrag.k, orig = editDrag.orig;
          const build = Q => { const tmp = { segments: JSON.parse(JSON.stringify(orig)) }; moveAnchor(tmp, k, Q.x - oa.x, Q.y - oa.y); return tmp.segments; };
          if (seamCtx.ok && !altKey && (!snap || snap.type === "grid" || snap.type === "outline")) {   // 외곽선 흡착은 편집 중인 옆선 자체에 걸리므로 자석이 앞선다(점 흡착 anchor·끝점은 우선)
            const a = anchorsFromSegments(orig), nb = (orig[k - 1] && orig[k - 1].kind === "line" && orig[k] && orig[k].kind === "line") ? { x: (a[k - 1].x + a[k + 1].x) / 2, y: (a[k - 1].y + a[k + 1].y) / 2 } : null;
            const st = seamStep({ x: nx, y: ny }, build, nb), mg = st.r;
            if (mg.snapped) { t = mg.point; snapHint = { piece: line.piece, point: { x: t.x, y: t.y }, type: "seam" }; }
            setSeamLive(seamCtx, mg.snapped ? mg.value : st.f(t), mg);
          } else setSeamLive(seamCtx, seamCtx.K + _forcedLen(seamCtx, build(t)), null);
          if (seamLive) seamLive.at = { x: t.x, y: t.y };
        }
        setNote(seamLive ? seamLiveText(seamLive) : snapHint ? ("흡착 → " + (SNAP_LABEL[snapHint.type] || snapHint.type)) : "anchor 이동 · Esc 해제");
      }
      line.segments = JSON.parse(JSON.stringify(editDrag.orig));
      moveAnchor(line, editDrag.k, t.x - oa.x, t.y - oa.y);
    }
    rerender();
  }

  if (typeof svg !== "undefined" && svg) {
    svg.addEventListener("pointerdown", e => {
      if (mode === "off" || e.button !== 0 || !inDesign()) return;
      // Space+드래그 = 화면 팬(init.js) — 같은 svg pointerdown 이라 여기서도 돌면 선택 해제·점 추가가 일어났다(2026-11-11 실측).
      //   명시적 팬 제스처 동안은 선 도구가 손대지 않는다(선택·작성 중 선 유지 · 형상·저장 무변경).
      if (typeof spaceDown !== "undefined" && spaceDown) return;
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
        // 2026-11-11: 조각 밖 누름은 점을 찍지 않는다 → 끌면 화면 이동(canvasPan) · 그냥 클릭이면 종전 안내(그리기 우선 · 작성 중 선 보존).
        const CP = window.canvasPan;
        if (!draft) {
          if (!piece) { if (CP && CP.press(e, () => { setNote("피스 위를 클릭하세요"); rerender(); })) { e.stopPropagation(); return; } setNote("피스 위를 클릭하세요"); return; }
          draft = { piece: piece, anchors: [{ p: placeGeo(piece), h: null }] }; setNote(DRAW_NOTE);
        } else if (piece !== draft.piece) {   // 거부: 점 안 찍힘 — 이유를 막대에도(좁은 화면은 오른쪽 안내가 안 보임)
          const reject = () => {
            setNote("같은 피스 안에서 이어 그리세요");
            drawHint = "점이 찍히지 않음 — " + ({ front: "앞판", back: "뒤판", sleeve: "소매", collar: "카라" }[draft.piece] || "같은 조각") + " 안을 누르세요(다른 조각·바깥은 이어 그릴 수 없음)";
            if (window.designLineQuickBar) window.designLineQuickBar.sync();
          };
          if (!piece && CP && CP.press(e, () => { if (draft) reject(); })) { e.stopPropagation(); return; }   // 조각 밖 = 끌면 팬 · 클릭이면 거부 안내
          reject(); return;
        }
        else { draft.anchors.push({ p: placeGeo(draft.piece), h: null }); setNote(DRAW_NOTE); }
        drawHint = null; hoverPt = null;   // 새 점 확정 → 커서가 다시 움직이기 전까지는 «마지막 구간» 표시(터치에도 보임)
        lastDown = { t: now, x: e.clientX, y: e.clientY };
        drawDrag = { startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, created: draft.anchors.length === 1 };
      } else { // select
        const selPiece = resolveSelectPiece(e, piece);   // 조각 hit rect 밖으로 휜 선·핸들도 화면 위치 그대로 선택(전역 rect 없음)
        // 2026-11-11 빈 곳(선·핸들·anchor 어느 것도 안 맞음) 누름: 끌면 화면 이동(선택 보존) · 그냥 클릭이면 종전대로 선택 해제.
        //   판정은 종전 selectDown 그대로 — 맞은 게 없을 때(해제 결과 · 편집 드래그 없음)만 해제를 클릭 시점으로 미룬다. canvasPan 없으면 종전 즉시 해제.
        const prevSel = selectedId, prevNote = noteText();
        if (!selPiece) { selectedId = null; editDrag = null; }
        else selectDown(e, selPiece, geoAt(e, selPiece), selPiece !== piece ? pickableLine : null);   // 보정 피스에서는 보정 대상 선만
        const CP = window.canvasPan;
        if (!selectedId && !editDrag && CP) {
          selectedId = prevSel; setNote(prevNote);
          const tap = () => { selectedId = null; editDrag = null; setNote(SELECT_NOTE); syncRoleButtons(); syncCutStatus(); rerender(); };
          if (CP.press(e, tap)) { e.stopPropagation(); return; }
          tap(); e.stopPropagation(); return;
        }
        if (!selectedId && !editDrag) setNote(SELECT_NOTE);
        seamBegin();                          // 옆선 자석 문맥(편집 드래그 시작 때 한 번 — 매 프레임 재합성 없음)
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
          let hp = null;
          if (piece) { const g = geoAt(e, piece), s = snapForCursor(g, piece, e.altKey, null); if (s) h = { piece: piece, point: s.point, type: s.type }; hp = { piece: piece, point: s ? _pt(s.point) : { x: g.x, y: g.y } }; }
          const hpChanged = JSON.stringify(hp) !== JSON.stringify(hoverPt); hoverPt = hp;   // 거리 안내 = 다음 점이 실제로 놓일 자리(snap·Alt 반영)
          if (setSnapHint(h, DRAW_NOTE) || hpChanged) rerender();
        }
      } else if (mode === "select" && editDrag) {
        editMove(geoAt(e, findLine(selectedId).piece), e.altKey, e.shiftKey);
      }
    });
    svg.addEventListener("pointerleave", () => { if (mode === "draw" && hoverPt && !drawDrag) { hoverPt = null; rerender(); } });   // 캔버스 밖 = 거리 안내 숨김(마지막 구간 표시로 돌아감)
    const endDrag = e => {
      if (mode === "draw" && drawDrag) {
        const anchor = draft && draft.anchors[draft.anchors.length - 1];
        if (anchor && anchor.h && Math.hypot(anchor.h.x, anchor.h.y) < EPS) anchor.h = null;
        drawDrag = null; snapHint = null; lastHandleGeo = null; _handleShift = false; try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {} rerender();
      } else if (mode === "select" && editDrag) {
        const edited = findLine(selectedId);
        if (edited && isSleeveCapLine(edited)) { if (window.recomposeSleeveCap) window.recomposeSleeveCap(); }   // 소매산 편집 → 소매 재합성
        else if (edited && isCollarBodyLine(edited)) { if (window.recomposeCollarBody) window.recomposeCollarBody(); }   // 칼라 본체 편집 → 본체 재합성
        else if (edited && edited.role === "boundary" && edited.piece === "sleeve") { const p = project(); if (p && p.working.boundaryPreview && p.working.boundaryPreview.sourceLineId === edited.id) p.working.boundaryPreview = null; }   // 소매 대체선 편집 → 그 미리보기만 무효(몸판 합성 외곽은 소매 선과 무관 · 2026-11-06)
        else if (edited && edited.role === "boundary") recomposeAfterBoundaryEdit();   // 대체선 편집 → designOutline 재합성
        else invalidateForLine(project(), edited);                                // 그 외(cut/guide) → 그 선 출처 파생만 무효화(2026-11-10)
        editDrag = null; snapHint = null; lastHandleGeo = null; _handleShift = false; seamCtx = null; seamLive = null; seamStateCache = null; try { if (e) svg.releasePointerCapture(e.pointerId); } catch (_) {}
        if (edited && (edited.role === "cut" || edited.role === "boundary")) syncCutStatus();   // 앵커·핸들을 옮긴 뒤의 실제 상태(이동 전 문구를 남기지 않음 · 대체선 포함 2026-11-06)
        rerender(); notifyDesignResult();
      }
    };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    // 두 번째 손가락(핀치·두 손가락 팬 · canvasPan) = 한 손가락으로 시작한 편집·점 추가를 되돌린다 — 핀치가 형상 좌표를 바꾸지 않게(2026-11-11).
    if (window.canvasPan) window.canvasPan.onMultiTouch(() => {
      if (mode === "select" && editDrag) {
        const l = findLine(selectedId); if (l && editDrag.orig) l.segments = JSON.parse(JSON.stringify(editDrag.orig));
        editDrag = null; snapHint = null; lastHandleGeo = null; _handleShift = false; seamCtx = null; seamLive = null; seamStateCache = null;
        setNote("두 손가락 = 화면 이동·확대 — 편집 드래그 취소(선은 원래대로)"); rerender();
      } else if (mode === "draw" && drawDrag && draft) {
        if (drawDrag.created) draft = null; else draft.anchors.pop();
        drawDrag = null; lastDown = null; snapHint = null; lastHandleGeo = null; _handleShift = false; hoverPt = null;
        setNote("두 손가락 = 화면 이동·확대 — 방금 찍힌 점 취소"); rerender();
      }
    });
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
        if (e.key === "Escape") { selectedId = null; editDrag = null; seamCtx = null; seamLive = null; setNote(SELECT_NOTE); syncRoleButtons(); syncCutStatus(); rerender(); }
        else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) { e.preventDefault(); deleteSelected(); }
      }
    });
  }

  // ── 네크라인 parametric → manual 변환(증분 3) ──
  // geometry primitive({kind:"line"|"path"}) → patternLine 세그먼트({kind:"line"|"cubic"}).
  function geomToPatternSegments(prims) {
    const out = [];
    (prims || []).forEach(pr => {
      // P0.3a: 생산자(designBodice)가 선언한 경계 identity 만 명령 단위로 옮긴다(다른 의미는 옮기지 않음).
      const bnd = (dst, k, n) => { if (pr.boundary) { dst.boundary = _copySemanticValue(pr.boundary); _commandBoundary(dst, k, n); } return dst; };
      if (pr.kind === "line") out.push(bnd({ kind: "line", from: _pt(pr.from), to: _pt(pr.to) }, 0, 1));
      else if (pr.kind === "path") { const nC = pr.commands.filter(c => c.type === "C").length; let cur = null, k = 0; pr.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { out.push(bnd({ kind: "cubic", from: _pt(cur), c1: _pt(c.points[0]), c2: _pt(c.points[1]), to: _pt(c.points[2]) }, k++, nC)); cur = c.points[2]; } }); }
    });
    return out;
  }
  // 주어진 geometry·patternLines 로 front/back boundary 를 합성(순수, p 미변경). {ok, designOutline|null, reason?}.
  function composeWith(geometry, patternLines) {
    const result = {};
    for (const pc of ["front", "back"]) {
      const bl = (patternLines || []).filter(l => l.piece === pc && l.role === "boundary");
      if (!bl.length) continue;
      const keys = PIECE_GEOM_KEYS[pc] || [pc];
      const rb = buildPieceRing(outlineSegsOf(geometry, keys), constrLinesOf(geometry, keys));
      if (!rb.ok) return { ok: false, reason: rb.reason };
      const res = composeDesignOutline(rb.ring, bl.map(boundarySegsOf), BODICE_COMPOSE_OPTS);
      if (!res.ok) return { ok: false, reason: res.reason };
      result[pc] = { outline: res.outline, lineIds: bl.map(l => l.id) };
    }
    return { ok: true, designOutline: Object.keys(result).length ? result : null };
  }
  // 세부 수정: 현재 parametric 앞·뒤 네크라인을 각각 role:"boundary" patternLine 으로 변환하고
  // mode:"manual" 로 원자적 전환. 앞 또는 뒤 하나라도 실패하면 patternLines·geometry·mode·
  // designOutline 전부 불변. neckline(현재 committed parametric) 을 인자로 받는다.
  function convertNecklineToBoundary(neckline) {
    const p = project(); if (!p || !window.designBodice) return { ok: false, reason: "no-project" };
    if (!neckline || neckline.mode !== "parametric" || neckline.type === "original") return { ok: false, reason: "no-parametric-neckline" };
    let segsByPiece;
    try { segsByPiece = window.designBodice.necklineSegments(p.referenceGeometry, neckline); }
    catch (e) { return { ok: false, reason: (e && e.reason) || "neckline-failed" }; }
    if (!segsByPiece) return { ok: false, reason: "no-parametric-neckline" };
    // manual 로 되돌린 candidate geometry(원본 목선 복귀) — boundary 가 원본 arc 를 대체하게.
    const geomParams = structuredClone(p.working.parameters);
    geomParams.neckline = { mode: "manual", type: neckline.type, parameters: neckline.parameters };
    let candGeom;
    try { candGeom = window.designBodice.computeGeometry(p.referenceGeometry, geomParams); }
    catch (e) { return { ok: false, reason: (e && e.reason) || "geometry-failed" }; }
    // 앞·뒤 boundary 후보 + candidate 원본 ring 에 dry-run 검증(둘 다 유효해야 진행).
    const cand = {};
    for (const pc of ["front", "back"]) {
      const segs = geomToPatternSegments(segsByPiece[pc]);
      if (!segs.length) return { ok: false, reason: "empty-neckline-" + pc };
      // ★ 이 도구는 "목선을 패턴선으로 전환"이라는 **작업 의미를 알고 있으므로** 새 대체 구간에
      //   neckline role 을 명시적으로 부여한다(좌표 추론·승계 아님). 합성 시 cloneSeg 가 그대로 나른다.
      //   일반 boundary replacement 는 의미 입력 수단이 없으므로 role 을 지어내지 않고 unresolved 로 둔다.
      segs.forEach(s => { s.edge = "neckline"; });
      const keys = PIECE_GEOM_KEYS[pc] || [pc];
      const rb = buildPieceRing(outlineSegsOf(candGeom, keys), constrLinesOf(candGeom, keys));
      if (!rb.ok) return { ok: false, reason: rb.reason };
      const v = replaceArcOnRing(rb.ring, segs);
      if (!v.ok) return { ok: false, reason: v.reason };
      cand[pc] = segs;
    }
    // 새 patternLines(기존 + 자동 네크라인 boundary 2개) — 커밋 전 로컬로만.
    const base = ensurePatternLines(p).slice();
    const fId = nextId(base); const withF = base.concat([{ id: fId, piece: "front", role: "boundary", segments: cand.front }]);
    const bId = nextId(withF); const newLines = withF.concat([{ id: bId, piece: "back", role: "boundary", segments: cand.back }]);
    const comp = composeWith(candGeom, newLines);   // 기존 사용자 boundary 와 겹치면 여기서 실패
    if (!comp.ok) return { ok: false, reason: comp.reason };
    // ── 원자적 커밋 ──
    const storeParams = structuredClone(p.working.parameters);
    storeParams.neckline = { mode: "manual", type: neckline.type, parameters: neckline.parameters, boundaryLineIds: { front: fId, back: bId } };
    p.working.patternLines = newLines;
    p.working.geometry = candGeom;
    p.working.parameters = storeParams;
    p.working.parts = []; p.working.boundaryPreview = null;
    p.working.designOutline = comp.designOutline;
    rerender();
    return { ok: true, frontId: fId, backId: bId };
  }
  // 기본형으로 돌아가기: 자동 생성된 네크라인 boundary 2개만 제거(다른 사용자 선 보존) →
  // mode:"parametric" 복귀 → geometry 재계산 → 남은 사용자 boundary 재합성. 원자적.
  function revertNecklineToParametric() {
    const p = project(); if (!p || !window.designBodice) return { ok: false, reason: "no-project" };
    const nk = p.working.parameters && p.working.parameters.neckline;
    if (!nk || nk.mode !== "manual") return { ok: false, reason: "not-manual" };
    const ids = nk.boundaryLineIds || {};
    const removeIds = [ids.front, ids.back].filter(Boolean);
    const newLines = (p.working.patternLines || []).filter(l => removeIds.indexOf(l.id) < 0);
    const params = structuredClone(p.working.parameters);
    params.neckline = { mode: "parametric", type: nk.type, parameters: nk.parameters };
    let geom;
    try { geom = window.designBodice.computeGeometry(p.referenceGeometry, params); }
    catch (e) { return { ok: false, reason: (e && e.reason) || "geometry-failed" }; }
    const comp = composeWith(geom, newLines);
    if (!comp.ok) return { ok: false, reason: comp.reason };
    p.working.patternLines = newLines;
    p.working.geometry = geom;
    p.working.parameters = params;
    p.working.parts = []; p.working.boundaryPreview = null;
    p.working.designOutline = comp.designOutline;
    rerender();
    return { ok: true };
  }
  // 몸판 형상 적용(엉덩이 길이 등)으로 geometry 가 바뀐 뒤 manual 네크라인 유지용: 기존 patternLines 를
  // 현재 geometry 로 재합성. 실패하면 designOutline 을 건드리지 않고 사유 반환(호출부가 판단).
  function recomposeDesignOutline() {
    const p = project(); if (!p) return { ok: false, reason: "no-project" };
    const comp = composeWith(p.working.geometry, p.working.patternLines);
    p.working.parts = []; p.working.boundaryPreview = null;
    p.working.designOutline = comp.ok ? comp.designOutline : null;   // 실패 시 stale 유지 금지(null)
    return comp.ok ? { ok: true } : { ok: false, reason: comp.reason };
  }
  // 자동 생성된 네크라인 전용선(boundaryLineIds) 여부. 역할 변경·개별 삭제 금지(제거는 기본형으로
  // 돌아가기로만). anchor·핸들 형상 편집은 허용.
  function isNeckAutoLine(id) {
    const p = project(); const nk = p && p.working.parameters && p.working.parameters.neckline;
    if (!nk || nk.mode !== "manual" || !nk.boundaryLineIds) return false;
    return id === nk.boundaryLineIds.front || id === nk.boundaryLineIds.back;
  }
  // 관리형 소매산 선(managedBy sleeve-cap): 역할 변경·개별 삭제 금지, endpoint 이동 금지.
  // 제거는 '기본 소매산으로 돌아가기'로만. line 객체 또는 id 로 판정.
  function isSleeveCapLine(lineOrId) {
    const line = (typeof lineOrId === "string") ? findLine(lineOrId) : lineOrId;
    return !!(line && line.managedBy === "sleeve-cap");
  }
  // 관리형 칼라 본체 선(managedBy collar-body): 역할 변경·개별 삭제 금지, endpoint(cbOuter·attachFront) 이동 금지.
  // 제거는 '기본형으로 돌아가기'로만.
  function isCollarBodyLine(lineOrId) {
    const line = (typeof lineOrId === "string") ? findLine(lineOrId) : lineOrId;
    return !!(line && line.managedBy === "collar-body");
  }
  // boundary(anchor·핸들) 편집 pointerup 후: designOutline 재합성(에메랄드가 편집 위치로 즉시 이동).
  // 유효하지 않으면 designOutline 무효화 + 오류(이전 stale 유지 금지). 목둘레·상태는 ui 로 갱신.
  function recomposeAfterBoundaryEdit() {
    const r = recomposeDesignOutline();   // 성공 시 재합성, 실패 시 designOutline=null(stale 유지 금지)
    setBoundaryNote(r.ok ? "대체선 편집 반영 · 외곽 재합성" : "대체 불가: " + r.reason);
    if (window.refreshFrontPlacket) window.refreshFrontPlacket();   // 유효 앞판 외곽 변경 → 여밈 재파생
    if (window.refreshDesignBodyPanel) window.refreshDesignBodyPanel();   // 목둘레·상태 갱신
  }
  // manual 상태의 네크라인 봉제 길이: 자동 네크라인 boundary 선(=designOutline 에 스플라이스된 목선)
  // 세그먼트를 flatten 해 측정. 편집(anchor/핸들)하면 반영.
  function necklineBoundaryLen(piece) {
    const p = project(); if (!p) return 0;
    const nk = p.working.parameters && p.working.parameters.neckline;
    if (!nk || nk.mode !== "manual" || !nk.boundaryLineIds) return 0;
    const line = (p.working.patternLines || []).find(l => l.id === nk.boundaryLineIds[piece]);
    if (!line) return 0;
    return flattenLine(line.segments).reduce((s, ab) => s + Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y), 0);
  }

  window.designLineTool = Object.freeze({
    toggle, toggleSelect, setMode, getMode, cancel: () => setMode("off"), isActive, finishDraw, canFinishDraw: () => draftFinishable(),
    convertNecklineToBoundary, revertNecklineToParametric, recomposeDesignOutline, necklineBoundaryLen, isNeckAutoLine, isSleeveCapLine, isCollarBodyLine, findLine: (id) => findLine(id),
    getDraft, getSelectedId, getSelectionOverlay, resolveSelectPiece, getSnapHint, deleteSelected, setRole,
    validateSelectedCut, getSplitState, revalidate, validateCut, gatherValidCuts, flattenLine, segCross, distPtToSegs,
    // 편집 기준 몸판(최종 몸판 정합) — 판정·snap·파트 분리 경계
    editBodiceRef, cutStatusOf, cutStatusText, snapForCursor, isOriginalBodiceContext, displayedDerivedPiece, syncCutStatus: () => syncCutStatus(),
    doSplit, invalidateParts, visibleParts, pruneStaleSleeveParts, doBoundaryPreview, doBoundaryApply, doSleeveEditUndo, validateSelectedBoundary, doComposeDesignOutline,
    getBoundaryState, visibleBoundaryPreview, boundaryStatusOf, pruneStaleBoundaryPreview,
    // 옆선 길이 자석(2026-11-06)
    getCurveState, doToCurve, getSeamState, getSeamLive, isEditDragging: () => !!(editDrag && mode === "select"), getReflectState, doReflectToBodice, sideSeamLabels, getMeasureGuide, measureAlong: alongExisting, setSeamMagnet, setSeamBasis, getSeamSettings, seamInfoFor,
    // 옆선 «길이 맞춤»(2026-11-07) · 그리기 중 거부 안내
    getSeamFit, getSeamFitPreview, previewSeamFit, applySeamFit, cancelSeamFit, getDrawHint: () => (mode === "draw" && draft ? drawHint : null),
    // 순수
    pointToGeometryCm, geometryToDrawCm, segmentsFromAnchors, makePatternLine, nextId,
    anchorsFromSegments, moveAnchor, segmentDegenerate, lineDegenerate, distToLine, distToSegment, handlesOf,
    chooseSnap, closestOnSeg, nearestOnSegs, flattenSegment, constrainAngle45,
    // 파트 분리·외곽 대체(순수)
    buildPieceRing, splitRingByCut, subSegment, reverseSeg, cloneSeg, projectOntoRing, projectOntoSeg, walkConstruction,
    replaceArcOnRing, extractArcTagged, composeDesignOutline, geomToPatternSegments, outlinePrimsToSegs, boundarySegsOf
  });
})();
