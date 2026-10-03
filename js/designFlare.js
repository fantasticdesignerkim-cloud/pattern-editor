// ══════════════════════════════════════════════════════════════════════════════
// designFlare.js — [패턴학교] 처리 방법 **161「닫는다·벌린다」** 의 디자인 단계 구현.
//
//   교재 정의(P.161): *"'닫는다'와 '벌린다'는 한 세트. 평면 패턴은 반드시 그 반동이
//   생기기 때문에 지정된 곳을 벌린다."*  플레어 라인 Ⓖ(P.20)가 이 연산을 그대로 부른다 —
//   **앞 AH 다트·뒤 어깨 다트를 닫아 밑단을 벌린다.**
//
// 절개선(P.20 판독): **다트 apex 에서 grain 방향으로 내려 밑단과 만나는 선.** 별도 수치 없음.
//
// ★ 물리 불변식 — 강체 회전이라 **조각 면적이 정확히 보존**된다. 벌어진 밑단 쐐기만
//   새로 더해진다(그게 "분량 추가"의 정의). 이 두 값을 반환해 호출부가 검산할 수 있게 한다.
//
// 의존: `window.designLineTool` 의 순수 헬퍼(buildPieceRing·subSegment·projectOntoRing·
//   flattenLine·segCross·outlinePrimsToSegs·reverseSeg). **복제하지 않는다** — 링 구성·
//   정확 분할은 파트 분리에서 이미 검증된 코드고, 베끼면 한쪽만 고쳐도 조용히 어긋난다.
//   그래서 index.html 에서 **designLineTool 다음에** 로드한다.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var CLOSE_EPS = 1e-4;        // 폐곡선 연결 허용오차(designLineTool 과 같은 기준)
  var SLIVER_EPS = 1e-6;       // 이보다 크면 잔여 sliver 를 명시 세그먼트로 남긴다

  function fail(reason, detail) {
    var e = new Error("designFlare: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }
  function T() {
    var t = (typeof window !== "undefined") && window.designLineTool;
    if (!t || typeof t.buildPieceRing !== "function") fail("designLineTool-missing");
    return t;
  }
  var clone = function (v) {
    return (typeof structuredClone === "function") ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  };
  function rotPt(p, o, th) {
    var c = Math.cos(th), s = Math.sin(th), dx = p.x - o.x, dy = p.y - o.y;
    return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
  }
  function rotSeg(seg, o, th) {
    var q = clone(seg);
    ["from", "to", "c1", "c2"].forEach(function (k) { if (q[k]) q[k] = rotPt(q[k], o, th); });
    if (q.commands) q.commands.forEach(function (c) { c.points = c.points.map(function (p) { return rotPt(p, o, th); }); });
    return q;
  }
  function flatPts(segs) {
    var t = T(), pts = [];
    segs.forEach(function (s) {
      t.flattenLine([s]).forEach(function (ab) { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); });
    });
    return pts;
  }
  function signedArea(segs) {
    var pts = flatPts(segs), a = 0;
    for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
    return a / 2;
  }
  function segLen(s) {
    return T().flattenLine([s]).reduce(function (t, ab) { return t + Math.hypot(ab[1].x - ab[0].x, ab[1].y - ab[0].y); }, 0);
  }
  // 폐곡선 자기교차(끝점 공유는 정상 연결이라 제외) — 파트 분리와 같은 판정.
  function selfIntersects(segs) {
    var t = T(), f = [];
    segs.forEach(function (s) { t.flattenLine([s]).forEach(function (ab) { f.push(ab); }); });
    var near = function (u, v) { return Math.hypot(u.x - v.x, u.y - v.y) < 1e-6; };
    for (var i = 0; i < f.length; i++) for (var j = i + 2; j < f.length; j++) {
      if (i === 0 && j === f.length - 1) continue;
      var p = t.segCross(f[i][0], f[i][1], f[j][0], f[j][1]);
      if (!p) continue;
      if (near(f[i][1], f[j][0]) || near(f[j][1], f[i][0]) || near(f[i][0], f[j][0]) || near(f[i][1], f[j][1])) continue;
      return true;
    }
    return false;
  }
  // ring 위 A→B forward 부분 경로(cubic 은 de Casteljau 정확 분할 — 폴리라인화 금지).
  function extractArc(ring, A, B) {
    var t = T(), n = ring.length, out = [];
    if (A.i === B.i && A.t <= B.t) {
      var s = t.subSegment(ring[A.i].seg, A.t, B.t);
      if (segLen(s) > 1e-9) out.push(s);
      return out;
    }
    var tail = t.subSegment(ring[A.i].seg, A.t, 1);
    if (segLen(tail) > 1e-9) out.push(tail);
    var k = (A.i + 1) % n;
    while (k !== B.i) { out.push(clone(ring[k].seg)); k = (k + 1) % n; }
    var head = t.subSegment(ring[B.i].seg, 0, B.t);
    if (segLen(head) > 1e-9) out.push(head);
    return out;
  }
  var line = function (a, b) { return { kind: "line", from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } }; };
  var sub = function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; };
  // ★★ 포맷 경계 — geometry 는 `{kind:"path", commands:[M,C…]}` 만 받는다. `{kind:"cubic"}` 은
  //   **패턴선(designLineTool) 포맷**이라 designRenderer·designLayout.pointsOfPrim 이 못 읽고
  //   `invalid-primitive` 로 깨진다(CLAUDE.md 가 두 번 기록한 함정 — 여기서 한 번 더 걸렸다).
  //   ring 작업은 패턴선 포맷으로 하고, **내보낼 때 반드시 geometry 포맷으로 되돌린다.**
  function toGeomPrim(seg) {
    if (!seg) return seg;
    if (seg.kind !== "cubic") return clone(seg);
    var out = { kind: "path", commands: [
      { type: "M", points: [{ x: seg.from.x, y: seg.from.y }] },
      { type: "C", points: [{ x: seg.c1.x, y: seg.c1.y }, { x: seg.c2.x, y: seg.c2.y }, { x: seg.to.x, y: seg.to.y }] }
    ] };
    ["edge", "boundary", "dart"].forEach(function (k) { if (seg[k] !== undefined) out[k] = clone(seg[k]); });
    return out;
  }
  function unit(v) { var L = Math.hypot(v.x, v.y); return L > 1e-12 ? { x: v.x / L, y: v.y / L } : null; }
  function onCurve(seg) {
    // {kind:"cubic"} 과 {kind:"path", commands:[M,C…]} 둘 다에서 제어점을 순서대로 꺼낸다.
    if (seg.kind === "cubic") return [seg.from, seg.c1, seg.c2, seg.to];
    if (seg.commands) {
      var pts = [];
      seg.commands.forEach(function (c) { c.points.forEach(function (p) { pts.push(p); }); });
      return pts;
    }
    return [seg.from, seg.to];
  }
  // 세그먼트 끝/시작의 진행 방향. 퇴화 제어점은 건너뛴다.
  function tangentAtEnd(seg) {
    var p = onCurve(seg), last = p[p.length - 1];
    for (var i = p.length - 2; i >= 0; i--) { var u = unit(sub(last, p[i])); if (u) return u; }
    return null;
  }
  function tangentAtStart(seg) {
    var p = onCurve(seg), first = p[0];
    for (var i = 1; i < p.length; i++) { var u = unit(sub(p[i], first)); if (u) return u; }
    return null;
  }
  // ★ 벌어진 접합부를 **접선 연속(G1) cubic** 으로 잇는다 — 교재 P.157 의 전 연산 공통 불변식
  //   «처리한 곳이 각지지 않게 완만한 곡선으로 수정한다». 밑단 전체를 다시 그리지 않는다:
  //   원래 밑단 형상을 지우지 않고 **처리한 곳만** 매끄럽게 한다(교재 문장 그대로).
  //   핸들 = 현(chord) 길이의 1/3 — 옆선 곡선화·칼라 외곽 휨과 같은 관례(overshoot 방지).
  function fairBridge(a, b, tanA, tanB) {
    var L = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(L > 0) || !tanA || !tanB) return line(a, b);
    var h = L / 3;
    return { kind: "cubic",
      from: { x: a.x, y: a.y },
      c1: { x: a.x + tanA.x * h, y: a.y + tanA.y * h },
      c2: { x: b.x - tanB.x * h, y: b.y - tanB.y * h },
      to: { x: b.x, y: b.y } };
  }

  // ── 본 연산 ────────────────────────────────────────────────────────────────
  // closeDartSpread(piece, opts) — piece = {outline, construction} (geometry 포맷)
  //   opts.hemEdge   기본 "hem"  — 벌릴 모서리
  //   opts.hemFairing 기본 "straight" — v1 은 직선. 교재의 «완만한 곡선» 은 후속.
  function closeDartSpread(piece, opts) {
    opts = opts || {};
    var t = T();
    if (!piece || !Array.isArray(piece.outline) || !piece.outline.length) fail("invalid-piece");
    var hemEdge = opts.hemEdge || "hem";

    var outSegs = t.outlinePrimsToSegs(piece.outline);
    var constr = (piece.construction || []).filter(function (s) { return s && s.kind === "line"; });

    // ★ 봉제 허리다트가 남아 있으면 거부한다. 절개선이 다트를 관통할 수 있고(앞판은 a 의
    //   apex 가 BP 바로 아래라 실제로 겹친다), 플레어는 그 조임을 대신하는 디자인이다.
    //   먼저 `waistDartScales` 로 0 을 주라고 안내한다 — 조용히 지우지 않는다.
    var sewnWaist = constr.filter(function (s) {
      var d = s && s.dart;
      return !!(d && d.boundary === "waist" && !d.locked && !d.onFold);
    });
    if (sewnWaist.length) fail("waist-darts-present", sewnWaist.length);

    var R = t.buildPieceRing(outSegs, constr);
    if (!R.ok) fail("ring-failed", R.reason);
    var ring = R.ring;

    var dIdx = [];
    ring.forEach(function (r, i) { if (r.source === "dartleg") dIdx.push(i); });
    if (dIdx.length !== 2) fail("unsupported-dart-legs", dIdx.length);
    var apex = ring[dIdx[0]].seg.to;                 // 두 다리가 만나는 꼭짓점
    var mouth1 = ring[dIdx[0]].seg.from;             // L1: mouth1 → apex
    var mouth0 = ring[dIdx[1]].seg.to;               // L2: apex → mouth0

    // 절개선 = apex 에서 grain(+y) 아래로 내려 밑단과 만나는 점.
    var hemPts = [];
    outSegs.forEach(function (s) {
      if (s.edge !== hemEdge) return;
      t.flattenLine([s]).forEach(function (ab) { hemPts.push(ab[0], ab[1]); });
    });
    if (!hemPts.length) fail("no-hem-edge", hemEdge);
    var hemY = hemPts.reduce(function (m, p) { return Math.max(m, p.y); }, -Infinity);
    var pjH = t.projectOntoRing({ x: apex.x, y: hemY }, ring);
    if (pjH.dist > 0.05) fail("slash-off-boundary", pjH.dist);
    if (ring[pjH.i].source !== "outline") fail("slash-hits-dart-leg");

    // 다트각 — mouth0 방향을 mouth1 방향으로 가져가면 다트가 닫힌다.
    var th = Math.atan2(mouth1.y - apex.y, mouth1.x - apex.x)
           - Math.atan2(mouth0.y - apex.y, mouth0.x - apex.x);
    if (!isFinite(th) || Math.abs(th) < 1e-9) fail("degenerate-dart", th);

    var apexPos = { i: dIdx[0], t: 1, point: apex };
    var arcA = extractArc(ring, apexPos, pjH);       // L2 + 외곽(mouth0 → H)
    var arcB = extractArc(ring, pjH, apexPos);       // 외곽(H → mouth1) + L1
    if (arcA.length < 2 || arcB.length < 2) fail("degenerate-split");

    // ★ 중심선(center)을 품은 쪽을 고정한다 — 교재 절개 그림도 CF 를 고정하고 옆쪽을 벌린다.
    var hasCenter = function (segs) { return segs.some(function (s) { return s.edge === "center"; }); };
    var rotateB = hasCenter(arcA);
    if (rotateB === hasCenter(arcB)) fail("center-edge-ambiguous");
    var rt = rotateB ? -th : th;

    var keepA = arcA.slice(1);                       // L2 제거
    var keepB = arcB.slice(0, -1);                   // L1 제거
    var kA = rotateB ? keepA : keepA.map(function (s) { return rotSeg(s, apex, rt); });
    var kB = rotateB ? keepB.map(function (s) { return rotSeg(s, apex, rt); }) : keepB;

    // 진동(또는 어깨) 쪽 이음: 닫힌 다트의 두 입이 만난다. 이등변이 아니면 잔여가 남는다
    // (뒤 어깨다트 ~0.1cm — 알려진 성질, 패턴선 확정 단계에서 흡수된다). **감추지 않고**
    // 명시 세그먼트로 남겨 폐곡선을 정직하게 닫는다.
    var joinFrom = kB[kB.length - 1].to, joinTo = kA[0].from;
    var sliver = Math.hypot(joinFrom.x - joinTo.x, joinFrom.y - joinTo.y);

    // 벌어진 밑단을 잇는다(v1 직선 — 교재의 «완만한 곡선» 재작도는 후속).
    var hA = kA[kA.length - 1].to, hB = kB[0].from;
    var spread = Math.hypot(hA.x - hB.x, hA.y - hB.y);
    if (!(spread > 0)) fail("no-spread");

    // 밑단 이음: 기본은 «완만한 곡선»(교재). "straight" 를 주면 직선(검증·비교용).
    var fairing = opts.hemFairing || "smooth";
    if (fairing !== "smooth" && fairing !== "straight") fail("invalid-hem-fairing", fairing);
    var bridge = (fairing === "smooth")
      ? fairBridge(hA, hB, tangentAtEnd(kA[kA.length - 1]), tangentAtStart(kB[0]))
      : line(hA, hB);
    bridge.edge = hemEdge;                 // 이 이음은 밑단의 일부다(의미를 잃지 않게)
    var outline = kA.concat([bridge], kB);
    // 잔여 sliver 이음은 다트를 닫고 남은 자리를 잇는 truing 선이라 의미 모서리를 주지 않는다.
    if (sliver > SLIVER_EPS) outline = outline.concat([line(joinFrom, joinTo)]);

    // 검증 — 하나라도 어긋나면 부분 결과를 반환하지 않는다.
    for (var i = 0; i < outline.length; i++) {
      var a = outline[i], b = outline[(i + 1) % outline.length];
      if (Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y) > CLOSE_EPS) fail("outline-discontinuous", i);
    }
    if (selfIntersects(outline)) fail("self-intersection");
    var areaBefore = Math.abs(signedArea(ring.map(function (r) { return r.seg; })));
    var areaAfter = Math.abs(signedArea(outline));
    if (!(areaAfter > areaBefore)) fail("no-area-gain", areaAfter - areaBefore);

    // construction 은 회전 조각에 실린 것만 함께 돈다(안 그러면 다트가 외곽에서 떨어진다).
    var construction = (piece.construction || []).map(function (s) {
      return toGeomPrim(inRotatedPart(s, apex, pjH.point, rotateB, ring, dIdx) ? rotSeg(s, apex, rt) : clone(s));
    });

    return {
      outline: outline.map(toGeomPrim),
      construction: construction,
      apex: { x: apex.x, y: apex.y },
      dartAngleRad: th,
      slashLenCm: Math.hypot(pjH.point.x - apex.x, pjH.point.y - apex.y),
      spreadCm: spread,
      hemFairing: fairing,
      residualSliverCm: sliver,
      areaBeforeCm2: areaBefore,
      wedgeAreaCm2: areaAfter - areaBefore,
      rotatedSide: rotateB ? "B" : "A",
      // Ⓗ(P.21) 절개가 쓰는 값 — geometry 는 바꾸지 않는다(스칼라만 추가).
      rotationRad: rt,                                   // 회전 조각이 돈 각(원본 수직선 → Ⓖ 좌표계의 절개 방향)
      mouth: { x: kA[0].from.x, y: kA[0].from.y },       // 닫힌 다트 입구(진동 또는 어깨 위의 점)
      mouthEdges: [kB[kB.length - 1].edge || null, kA[0].edge || null]
    };
  }

  // ── Ⓗ(P.21) — Ⓖ 결과 한 조각에 «진동 가장 안쪽 → 밑단» 수직 절개를 하나 더 넣고 P.163 으로 벌린다 ──────────
  // 새 엔진이 아니다: ① Ⓖ(closeDartSpread) 가 낸 한 조각을 절개선으로 둘로 가르고 ② designJoin.buttSpread(기준점 고정 ·
  // 밑단 chord · 접선 연속 fairing) 로 다시 한 장으로 맞대 벌린다. 여기 있는 건 절개선·분량을 정하는 접착 코드뿐이다.
  //   ∅ = min(●×1 − (3 + ■), ■)   — 교재 «■ 까지가 최대»(사용자 확정 A안)가 산식보다 우선한다.
  //   ● = 벌리기 전 가슴선 폭(앞중심~옆선, 닫기 전·후 같다) · 3 = 밑단 옆 추가(hemSideOffsetCm) · ■ = Ⓖ 밑단 벌림(spreadCm).
  function J() {
    var j = (typeof window !== "undefined") && window.designJoin;
    if (!j || typeof j.buttSpread !== "function") fail("designJoin-missing");
    return j;
  }
  var outEdge = function (s) { return s && s.edge; };
  // 벌리기 전 가슴선 폭 ● — 앞중심(center 모서리) x 와 진동·옆선이 만나는 겨드랑점 x 의 수평 거리.
  function bustWidthCm(piece) {
    var segs = T().outlinePrimsToSegs(piece.outline);
    var ctr = segs.filter(function (s) { return outEdge(s) === "center"; });
    var arm = segs.filter(function (s) { return outEdge(s) === "armhole"; });
    var sid = segs.filter(function (s) { return outEdge(s) === "side-seam"; });
    if (!ctr.length || !arm.length || !sid.length) fail("bust-width-edges-missing");
    var near2 = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y) < 0.01; };   // 원형 겨드랑점 이음 허용(0.0004cm 잔차)
    var hit = null;
    arm.forEach(function (a) { sid.forEach(function (d) { [a.from, a.to].forEach(function (p) { [d.from, d.to].forEach(function (q) { if (!hit && near2(p, q)) hit = p; }); }); }); });
    if (!hit) fail("underarm-point-not-found");
    var w = Math.abs(ctr[0].from.x - hit.x);
    if (!(w > 0)) fail("bust-width-not-positive", w);
    return w;
  }
  var cubicAt = function (s, u) {
    var m = 1 - u, a = m * m * m, b = 3 * m * m * u, c = 3 * m * u * u, d = u * u * u;
    return { x: a * s.from.x + b * s.c1.x + c * s.c2.x + d * s.to.x, y: a * s.from.y + b * s.c1.y + c * s.c2.y + d * s.to.y };
  };
  // 진동 곡선에서 방향 n 으로 가장 먼(= 앞중심/뒤중심 쪽으로 가장 안쪽인) 점. 곡선 위의 정확한 점을 돌려준다.
  function armholeInnermost(segs, n) {
    var best = null, dot = function (p) { return p.x * n.x + p.y * n.y; };
    segs.forEach(function (s) {
      var ev = s.kind === "cubic" ? function (u) { return cubicAt(s, u); } : function (u) { return { x: s.from.x + (s.to.x - s.from.x) * u, y: s.from.y + (s.to.y - s.from.y) * u }; };
      var N = 400, bu = 0, bv = -Infinity;
      for (var i = 0; i <= N; i++) { var v = dot(ev(i / N)); if (v > bv) { bv = v; bu = i / N; } }
      var lo = Math.max(0, bu - 1 / N), hi = Math.min(1, bu + 1 / N);
      for (var k = 0; k < 60; k++) {          // 삼분 탐색 — 극점 정밀화
        var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
        if (dot(ev(m1)) < dot(ev(m2))) lo = m1; else hi = m2;
      }
      var u = (lo + hi) / 2, p = ev(u);
      if (!best || dot(p) > dot(best)) best = p;
    });
    return best;
  }
  function slashSpread(piece, res, opts) {
    opts = opts || {};
    var t = T(), Jn = J();
    if (!piece || !Array.isArray(piece.outline) || !piece.outline.length || !res) fail("invalid-piece");
    var bust = opts.bustWidthCm, extra = opts.hemExtraCm;
    if (typeof bust !== "number" || !isFinite(bust) || !(bust > 0)) fail("invalid-bust-width", bust);
    if (typeof extra !== "number" || !isFinite(extra) || extra < 0) fail("invalid-hem-extra", extra);
    var dartSpread = res.spreadCm;
    if (typeof dartSpread !== "number" || !isFinite(dartSpread) || !(dartSpread > 0)) fail("invalid-dart-spread", dartSpread);
    var formulaCm = bust - (extra + dartSpread);
    var clamped = formulaCm > dartSpread;                       // «■ 까지가 최대» 가 산식보다 우선
    var chord = Math.min(formulaCm, dartSpread);
    if (!(chord > 1e-6)) fail("slash-not-positive", { bustWidthCm: bust, hemExtraCm: extra, dartSpreadCm: dartSpread, formulaCm: formulaCm });

    var segs = t.outlinePrimsToSegs(piece.outline);
    var R = Jn.buildClosedRing(segs); if (!R.ok) fail("ring-failed", R.reason);
    var C = Jn.canonicalRing(R.chain);
    var ring = C.chain.map(function (s) { return { seg: s, source: "outline" }; });

    // 절개 방향 = 원본 수직선이 Ⓖ 회전으로 놓인 방향. 기준점 = 도해의 «진동 가장 안쪽».
    var rt = res.rotationRad;
    if (typeof rt !== "number" || !isFinite(rt)) fail("invalid-rotation", rt);
    var dir = { x: -Math.sin(rt), y: Math.cos(rt) };
    var arm = C.chain.filter(function (s) { return outEdge(s) === "armhole"; });
    var ctr = C.chain.filter(function (s) { return outEdge(s) === "center"; });
    if (!arm.length || !ctr.length) fail("slash-edges-missing");
    var onArmhole = res.mouthEdges && res.mouthEdges.every(function (e) { return e === "armhole"; });
    var pivot, rule;
    if (onArmhole) { pivot = { x: res.mouth.x, y: res.mouth.y }; rule = "dart-mouth"; }       // 앞: 도해 화살표 = AH 다트의 닫힌 입구
    else {                                                                                  // 뒤: 어깨 다트라 입구가 진동에 없다 → 진동 곡선의 중심 쪽 극점
      var meanX = 0, cnt = 0; arm.forEach(function (s) { meanX += s.from.x + s.to.x; cnt += 2; }); meanX /= cnt;
      var sgn = ctr[0].from.x >= meanX ? 1 : -1;
      var nIn = { x: sgn * Math.cos(rt), y: sgn * Math.sin(rt) };                           // 중심 쪽 단위 방향을 Ⓖ 회전만큼 돌린 것
      pivot = armholeInnermost(arm, nIn); rule = "armhole-innermost";
    }
    // 절개 끝 = 기준점에서 dir 로 내려 밑단 직선 모서리와 처음 만나는 점
    var foot = null, footEdge = null, bestT = Infinity;
    C.chain.forEach(function (s) {
      t.flattenLine([s]).forEach(function (ab) {
        var ex = ab[1].x - ab[0].x, ey = ab[1].y - ab[0].y, den = dir.x * ey - dir.y * ex;
        if (Math.abs(den) < 1e-12) return;
        var wx = ab[0].x - pivot.x, wy = ab[0].y - pivot.y;
        var tr = (wx * ey - wy * ex) / den, us = (wx * dir.y - wy * dir.x) / den;
        if (tr > 1e-3 && us >= -1e-9 && us <= 1 + 1e-9 && tr < bestT) { bestT = tr; foot = { x: pivot.x + dir.x * tr, y: pivot.y + dir.y * tr }; footEdge = s; }
      });
    });
    if (!foot) fail("slash-foot-not-found");
    if (outEdge(footEdge) !== "hem" || footEdge.kind !== "line") fail("slash-foot-not-hem-line", outEdge(footEdge));

    var pj0 = t.projectOntoRing(pivot, ring), pj1 = t.projectOntoRing(foot, ring);
    if (pj0.dist > 0.02) fail("slash-pivot-off-boundary", pj0.dist);
    if (pj1.dist > 0.02) fail("slash-foot-off-boundary", pj1.dist);
    var arcF = t.extractArcTagged(ring, pj0, pj1).map(function (o) { return o.seg; });
    var arcB = t.extractArcTagged(ring, pj1, pj0).map(function (o) { return o.seg; });
    if (!arcF.length || !arcB.length) fail("degenerate-split");
    var legFwd = { kind: "line", from: { x: pj0.point.x, y: pj0.point.y }, to: { x: pj1.point.x, y: pj1.point.y } };   // 기준점 → 밑단
    var legRev = { kind: "line", from: { x: pj1.point.x, y: pj1.point.y }, to: { x: pj0.point.x, y: pj0.point.y } };
    var hasCtr = function (arc) { return arc.some(function (s) { return outEdge(s) === "center"; }); };
    if (hasCtr(arcF) === hasCtr(arcB)) fail("center-edge-ambiguous");
    // 앞·뒤중심을 품은 쪽이 고정(Ⓖ 와 같은 규약) · 다른 쪽(옆선)이 기준점을 축으로 벌어진다.
    var fixedIsF = hasCtr(arcF);
    var fixedArc = fixedIsF ? arcF : arcB, moveArc = fixedIsF ? arcB : arcF;
    if (!moveArc.some(function (s) { return outEdge(s) === "side-seam"; })) fail("slash-side-missing");
    var fixedLeg = fixedIsF ? legRev : legFwd, moveLeg = fixedIsF ? legFwd : legRev;   // 각 조각을 닫는 방향의 절개 다리
    var PID = "slash";
    var tagFirst = "join:" + PID + ":first", tagSecond = "join:" + PID + ":second";
    fixedLeg.edge = tagFirst; moveLeg.edge = tagSecond;
    var partFixed = fixedArc.concat([fixedLeg]), partMove = moveArc.concat([moveLeg]);

    // construction — 절개선이 가르는 대로 나눈다(가로지르는 직선은 교점에서 둘로). 옮겨진 쪽은 buttSpread 가 같이 돌린다.
    var cutFlat = [[pj0.point, pj1.point]];
    var sideOf = function (p) { return (pj1.point.x - pj0.point.x) * (p.y - pj0.point.y) - (pj1.point.y - pj0.point.y) * (p.x - pj0.point.x); };
    var mvSample = moveArc[0], mvP = { x: (mvSample.from.x + mvSample.to.x) / 2, y: (mvSample.from.y + mvSample.to.y) / 2 };
    var moveSign = Math.sign(sideOf(mvP)) || 1;
    var conFixed = [], conMove = [];
    (piece.construction || []).forEach(function (cs) {
      var c = clone(cs);
      var mpOf = function (q) { return { x: (q.from.x + q.to.x) / 2, y: (q.from.y + q.to.y) / 2 }; };
      var put = function (q) { (Math.sign(sideOf(mpOf(q))) === moveSign ? conMove : conFixed).push(q); };
      if (c.kind !== "line") { if (!c.from) fail("slash-construction-unsupported", c.kind); put(c); return; }
      var x = t.segCross(c.from, c.to, pj0.point, pj1.point), len = Math.hypot(c.to.x - c.from.x, c.to.y - c.from.y);
      var u = x && len > 0 ? Math.hypot(x.x - c.from.x, x.y - c.from.y) / len : null;
      // 가로지르는 직선은 교점에서 둘로 나눈다 — subSegment 가 boundary·dart 의미 구간을 같이 잘라 준다(좌표만 자르면 attach 가 어긋난다).
      if (u !== null && u > 1e-9 && u < 1 - 1e-9) { put(t.subSegment(c, 0, u)); put(t.subSegment(c, u, 1)); }
      else put(c);
    });

    var toPrims = function (arr) { return arr.map(Jn.toGeomPrim); };
    var fixedPiece = { outline: toPrims(partFixed), construction: conFixed };
    var movePiece = { outline: toPrims(partMove), construction: conMove };
    var legEnds = function (pc, tag) {
      var rr = Jn.buildClosedRing(t.outlinePrimsToSegs(pc.outline));
      if (!rr.ok) fail(rr.reason, tag);
      var cc = Jn.canonicalRing(rr.chain), hit = cc.chain.filter(function (sg) { return sg.edge === tag; });
      if (hit.length !== 1) fail("join-leg-not-found", { tag: tag, count: hit.length });
      return { start: { x: hit[0].from.x, y: hit[0].from.y }, end: { x: hit[0].to.x, y: hit[0].to.y } };
    };
    var ea = legEnds(fixedPiece, tagFirst), eb = legEnds(movePiece, tagSecond);
    var out;
    try {
      out = Jn.buttSpread({ joinPairId: PID,
        a: { piece: fixedPiece, pairId: PID, start: ea.start, end: ea.end },
        b: { piece: movePiece, pairId: PID, start: eb.start, end: eb.end },
        spread: { pivot: { x: pj0.point.x, y: pj0.point.y }, chordCm: chord } },
        { bridge: "smooth", bridgeEdge: "hem" });
    } catch (e) { fail("slash-spread-failed", e.reason || e.message); }

    return {
      outline: out.outline, construction: out.construction,
      slash: {
        rule: rule,
        pivot: { x: pj0.point.x, y: pj0.point.y }, foot: { x: pj1.point.x, y: pj1.point.y },
        cutLenCm: Math.hypot(pj1.point.x - pj0.point.x, pj1.point.y - pj0.point.y),
        bustWidthCm: bust, hemExtraCm: extra, dartSpreadCm: dartSpread, formulaCm: formulaCm, chordCm: chord, clamped: clamped,
        angleDeg: out.spread.angleDeg, wedgeAreaCm2: out.spread.wedgeAreaCm2, bridgeChordCm: out.spread.bridgeChordCm,
        bridgeLenCm: out.spread.bridgeLenCm, areaDeltaCm2: out.areaDeltaCm2, residualGapCm: out.residualGapCm,
        seamLenCm: out.seamLenACm
      }
    };
  }

  // ── Ⓘ(P.22) — 목둘레 턱: 다트를 닫고 그 반동으로 목둘레의 **절개 2곳**을 벌린다(처리 방법 161) ─────────────────────────
  // 책은 절개 위치·분량 배분·턱 깊이를 수치로 주지 않는다(P.22 «원하는 목둘레의 위치»). 사용자 확정(2026-10-03):
  //   · 절개선 = 다트 꼭짓점(앞 BP · 뒤 어깨 다트 apex)에서 목둘레 호의 1/3·2/3 지점으로 가는 직선 2개
  //   · 닫는 다트각 θ 를 두 절개가 **균등(각 θ/2)** 으로 나눠 벌린다 — 중심을 품은 조각 고정, 어깨 쪽 조각 θ, 가운데 조각 θ/2 (강체 회전)
  //   · 박기 끝 = 절개 다리를 따라 목둘레에서 2cm 아래(표시 전용 — geometry 에 만들어 넣지 않는다)
  // 결과 외곽은 **절개 틈이 apex 까지 열린 V 두 개**를 가진다(열린 다트 = 현재 외곽선 · 젤리 모델). 면적은 강체라 정확히 보존된다.
  var TUCK_AT = [1 / 3, 2 / 3];
  var TUCK_DEPTH_CM = 2;
  function neckTuck(piece, opts) {
    opts = opts || {};
    var t = T();
    if (!piece || !Array.isArray(piece.outline) || !piece.outline.length) fail("invalid-piece");
    var depth = opts.depthCm == null ? TUCK_DEPTH_CM : opts.depthCm;
    if (typeof depth !== "number" || !isFinite(depth) || !(depth > 0)) fail("invalid-tuck-depth", depth);
    var outSegs = t.outlinePrimsToSegs(piece.outline);
    var constr = (piece.construction || []).filter(function (s) { return s && s.kind === "line"; });
    var R = t.buildPieceRing(outSegs, constr);
    if (!R.ok) fail("ring-failed", R.reason);
    var ring = R.ring, n = ring.length;
    var dIdx = [];
    ring.forEach(function (r, i) { if (r.source === "dartleg") dIdx.push(i); });
    if (dIdx.length !== 2) fail("unsupported-dart-legs", dIdx.length);
    var apex = ring[dIdx[0]].seg.to, mouth1 = ring[dIdx[0]].seg.from, mouth0 = ring[dIdx[1]].seg.to;
    var th = Math.atan2(mouth1.y - apex.y, mouth1.x - apex.x) - Math.atan2(mouth0.y - apex.y, mouth0.x - apex.x);
    if (!isFinite(th) || Math.abs(th) < 1e-9) fail("degenerate-dart", th);

    // 목둘레 연속 구간(ring 순서)과 그 위의 1/3·2/3 지점 — 호 길이 기준, 곡선은 정확 분할 위에서 이분 탐색.
    var isNeck = function (k) { return ring[k].source === "outline" && ring[k].seg.edge === "neckline"; };
    var first = -1;
    for (var k0 = 0; k0 < n; k0++) if (isNeck(k0) && !isNeck((k0 + n - 1) % n)) { first = k0; break; }
    if (first < 0) fail("no-neckline-edge");
    var run = [], total = 0;
    for (var q = first; isNeck(q % n) && run.length < n; q++) { var L = segLen(ring[q % n].seg); run.push({ i: q % n, len: L }); total += L; }
    if (!(total > 1e-6)) fail("neckline-too-short", total);
    var pos = function (frac) {
      var want = total * frac, acc = 0;
      for (var r = 0; r < run.length; r++) {
        if (want <= acc + run[r].len + 1e-12) {
          var seg = ring[run[r].i].seg, need = want - acc, lo = 0, hi = 1;
          for (var it = 0; it < 80; it++) { var mid = (lo + hi) / 2; if (segLen(t.subSegment(seg, 0, mid)) < need) lo = mid; else hi = mid; }
          var u = (lo + hi) / 2;
          return { i: run[r].i, t: u, point: t.subSegment(seg, 0, u).to, arcCm: want, frac: frac };
        }
        acc += run[r].len;
      }
      fail("neckline-position-failed", frac);
    };
    var cuts = TUCK_AT.map(pos);
    // apex 에서 앞으로 나아가는 순서(L2 → … → L1)로 정렬 — 중심을 품은 쪽이 고정이 된다.
    var rel = function (p) { return ((p.i - (dIdx[0] + 1) + 2 * n) % n) + p.t; };
    cuts.sort(function (a, b) { return rel(a) - rel(b); });
    var apexPos = { i: dIdx[0], t: 1, point: apex };
    var A0 = extractArc(ring, apexPos, cuts[0]), A1 = extractArc(ring, cuts[0], cuts[1]), A2 = extractArc(ring, cuts[1], apexPos);
    if (A0.length < 2 || !A1.length || A2.length < 2) fail("degenerate-split");
    var hasCenter = function (segs) { return segs.some(function (s) { return s.edge === "center"; }); };
    if (hasCenter(A1)) fail("center-in-middle-piece");
    var fixedFirst = hasCenter(A0);
    if (fixedFirst === hasCenter(A2)) fail("center-edge-ambiguous");
    var rot = fixedFirst ? [0, -th / 2, -th] : [th, th / 2, 0];       // 조각별 회전각(apex 기준) — 가운데는 정확히 절반
    var K0 = A0.slice(1), K2 = A2.slice(0, -1);                          // L2 · L1 제거(닫힌 다트)
    var R0 = K0.map(function (s) { return rotSeg(s, apex, rot[0]); });
    var R1 = A1.map(function (s) { return rotSeg(s, apex, rot[1]); });
    var R2 = K2.map(function (s) { return rotSeg(s, apex, rot[2]); });
    var first0 = R0[0].from, last2 = R2[R2.length - 1].to;
    var sliver = Math.hypot(last2.x - first0.x, last2.y - first0.y);
    var last0 = R0[R0.length - 1].to, first1 = R1[0].from, last1 = R1[R1.length - 1].to, first2 = R2[0].from;
    var legs = function (a, b) { return [line(a, apex), line(apex, b)]; };
    var slitA = legs(last0, first1), slitB = legs(last1, first2);
    // 틈의 두 다리는 apex 로 모이는 **열린 V**(현재 외곽선)다 — 체크포인트의 외곽 연결성 판정이 읽는 «선언된 다리»(dart.id·apexAt)를 붙인다.
    // edge 이름은 주지 않는다: designRenderer 의 EDGE_PLACEMENT 는 닫힌 어휘라 새 이름이 `bad-edge` 로 렌더를 깬다(헤드리스에선 안 보이고 브라우저에서만 터진 사고).
    [[slitA, 1], [slitB, 2]].forEach(function (pr) {
      pr[0].forEach(function (s, k) { s.dart = { id: "neck-tuck-" + pr[1], boundary: "neckline", apexAt: k === 0 ? "to" : "from" }; });
    });
    var outline = R0.concat(slitA, R1, slitB, R2);
    if (sliver > SLIVER_EPS) outline = outline.concat([line(last2, first0)]);
    for (var i = 0; i < outline.length; i++) {
      var a = outline[i], b = outline[(i + 1) % outline.length];
      if (Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y) > CLOSE_EPS) fail("outline-discontinuous", i);
    }
    if (selfIntersects(outline)) fail("self-intersection");
    var areaBefore = Math.abs(signedArea(ring.map(function (r) { return r.seg; })));
    var areaAfter = Math.abs(signedArea(outline));
    if (!(Math.abs(areaAfter - areaBefore) < 1)) fail("area-not-preserved", areaAfter - areaBefore);   // 강체 → 같다(뒤 sliver 잔여만 허용)

    // construction — 조각에 실린 대로 돈다. 닫힌 다리(L1·L2)는 입구 끝점으로, 나머지는 조각 다각형 안/밖으로 판정(밖이면 고정 조각).
    var near = function (u, v) { return Math.hypot(u.x - v.x, u.y - v.y) < 1e-6; };
    var polyOf = function (arc) { return flatPts(arc.concat([line(arc[arc.length - 1].to, arc[0].from)])); };
    var polys = [polyOf(A0), polyOf(A1), polyOf(A2)];
    var inPoly = function (p, poly) {
      var inside = false;
      for (var a = 0, b = poly.length - 1; a < poly.length; b = a++) {
        if ((poly[a].y > p.y) !== (poly[b].y > p.y) && p.x < (poly[b].x - poly[a].x) * (p.y - poly[a].y) / (poly[b].y - poly[a].y) + poly[a].x) inside = !inside;
      }
      return inside;
    };
    var fixedIdx = fixedFirst ? 0 : 2;
    var cutLines = cuts.map(function (c) { return [apex, c.point]; });
    var construction = (piece.construction || []).map(function (s) {
      if (s && s.kind === "line") cutLines.forEach(function (cl) {
        var x = t.segCross(s.from, s.to, cl[0], cl[1]);
        if (x && !(near(x, apex))) fail("tuck-construction-crosses-cut");
      });
      var g;
      if (s && s.kind === "line" && ((near(s.from, apex) && near(s.to, mouth1)) || (near(s.to, apex) && near(s.from, mouth1)))) g = 2;
      else if (s && s.kind === "line" && ((near(s.from, apex) && near(s.to, mouth0)) || (near(s.to, apex) && near(s.from, mouth0)))) g = 0;
      else {
        var mp = s && s.from && s.to ? { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2 } : null;
        g = fixedIdx;
        if (mp) for (var gi = 0; gi < 3; gi++) if (inPoly(mp, polys[gi])) { g = gi; break; }
      }
      return toGeomPrim(g === fixedIdx ? clone(s) : rotSeg(s, apex, rot[g]));
    });

    // 절개별 메타 — 틈(neck 에서의 현) · 박기 끝(다리를 따라 depth 만큼 아래). 표시·체크포인트용이고 geometry 는 바꾸지 않는다.
    var neckAt = [{ before: last0, after: first1 }, { before: last1, after: first2 }];
    var tuckCuts = neckAt.map(function (na, ci) {
      var dir = function (p) { var u = unit(sub(apex, p)); return u; };
      var ua = dir(na.before), ub = dir(na.after);
      var len = Math.hypot(na.before.x - apex.x, na.before.y - apex.y);
      var d = Math.min(depth, len * 0.5);
      return {
        index: ci + 1, frac: cuts[ci].frac, arcFromCenterOrShoulderCm: cuts[ci].arcCm,
        neckBefore: { x: na.before.x, y: na.before.y }, neckAfter: { x: na.after.x, y: na.after.y },
        endBefore: { x: na.before.x + ua.x * d, y: na.before.y + ua.y * d }, endAfter: { x: na.after.x + ub.x * d, y: na.after.y + ub.y * d },
        lenCm: len, gapChordCm: Math.hypot(na.after.x - na.before.x, na.after.y - na.before.y), angleRad: Math.abs(th) / 2, depthCm: d
      };
    });
    return {
      outline: outline.map(toGeomPrim), construction: construction,
      meta: {
        apex: { x: apex.x, y: apex.y }, dartAngleRad: th, perCutAngleRad: th / 2, neckLenCm: total,
        cuts: tuckCuts, depthCm: depth, residualSliverCm: sliver, areaBeforeCm2: areaBefore, areaAfterCm2: areaAfter,
        fixedSide: fixedFirst ? "A" : "B", tuckDirection: "outward"
      }
    };
  }

  // 절개선(apex→H)의 어느 쪽인가 — 외적 부호로 판정한다. 회전 조각 쪽이면 true.
  function inRotatedPart(seg, apex, H, rotateB, ring, dIdx) {
    var p = seg && (seg.from || (seg.commands && seg.commands[0] && seg.commands[0].points[0]));
    if (!p) return false;
    var mid = seg.to ? { x: (seg.from.x + seg.to.x) / 2, y: (seg.from.y + seg.to.y) / 2 } : p;
    var ux = H.x - apex.x, uy = H.y - apex.y;
    var cross = ux * (mid.y - apex.y) - uy * (mid.x - apex.x);
    // arcB(=H→apex forward)가 절개선 기준 어느 부호인지 표본으로 잡는다.
    var sample = ring[(dIdx[0] + ring.length - 1) % ring.length].seg;   // L1 직전 외곽(=B 쪽)
    var sp = { x: (sample.from.x + sample.to.x) / 2, y: (sample.from.y + sample.to.y) / 2 };
    var sideB = Math.sign(ux * (sp.y - apex.y) - uy * (sp.x - apex.x));
    var isB = Math.sign(cross) === sideB;
    return rotateB ? isB : !isB;
  }

  window.designFlare = Object.freeze({
    closeDartSpread: closeDartSpread, slashSpread: slashSpread, neckTuck: neckTuck, bustWidthCm: bustWidthCm,
    tangentAtEnd: tangentAtEnd, tangentAtStart: tangentAtStart, fairBridge: fairBridge
  });
})();
