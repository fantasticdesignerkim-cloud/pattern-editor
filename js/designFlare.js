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

    var outline = kA.concat([line(hA, hB)], kB);
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
      return inRotatedPart(s, apex, pjH.point, rotateB, ring, dIdx) ? rotSeg(s, apex, rt) : clone(s);
    });

    return {
      outline: outline,
      construction: construction,
      apex: { x: apex.x, y: apex.y },
      dartAngleRad: th,
      slashLenCm: Math.hypot(pjH.point.x - apex.x, pjH.point.y - apex.y),
      spreadCm: spread,
      residualSliverCm: sliver,
      areaBeforeCm2: areaBefore,
      wedgeAreaCm2: areaAfter - areaBefore,
      rotatedSide: rotateB ? "B" : "A"
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

  window.designFlare = Object.freeze({ closeDartSpread: closeDartSpread });
})();
