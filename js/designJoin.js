// ══════════════════════════════════════════════════════════════════════════════
// designJoin.js — [패턴학교] 처리 방법 **157「맞댄다」** 의 순수 연산 (1차 구현).
//
//   교재 정의(P.157): *"2개의 패턴을 표시가 있는 위치에서 맞대어 **1장으로 잇는다**."*
//   표시 규약: **맞대는 곳 = 2겹의 반원.** *"2개의 반원을 결합하면 완전한 원이 되듯이
//   패턴도 같은 작업으로 완성한다."* 맞대는 곳이 둘 이상이면 다른 표시를 쓰고
//   **같은 표시의 반원끼리** 맞댄다(P.159) → 그 "같은 표시"가 여기서는 `joinPairId` 다.
//
// ★ 이 연산은 "두 조각을 붙인다"가 아니라 **표시된 두 구간을 일치시키는 강체 변환 +
//   경계 재작도**다([P157.md](../docs/book/P157.md) 의 설계 메모 그대로).
//
// ★ geometry 에는 맞춤 표시(2겹 반원) 필드가 **없다**. 지어내지 않는다 — 1차 구현은
//   맞댐 쌍을 **호출부가 명시**한다(`joinPairId` + 양쪽 구간 끝점). 표시를 geometry 에
//   저장하는 설계는 별건이고, 그때 이 함수의 입력은 그 표시에서 만들어 주면 된다.
//
// ★ P.157 은 처리 방법 7쪽 중 **«각지지 않게 완만한 곡선으로 수정한다» 주석이 없는
//   유일한 쪽**이다(158~163 여섯 쪽에만 있다). 맞대는 것은 같은 길이의 두 봉제선을
//   겹쳐 놓는 것이라 새로 꺾인 자리가 생기지 않는다 — 그래서 fairing 을 하지 않는다.
//
// 물리 불변식 (제1법칙 — 종이 위에서 성립해야 한다):
//   · 강체 이동·회전이므로 **두 조각의 면적이 각각 보존**되고, 맞댄 결과 면적 = 합.
//     겹치면 합보다 작아진다 → `area-not-conserved` 로 거부한다.
//   · 맞댄 두 구간은 **같은 봉제선**이라 길이와 **형상**이 일치해야 한다. 길이만 같고
//     휘어짐이 다르면 종이가 맞닿지 않는다 → `seam-shape-mismatch`.
//   · 결과는 자기교차 없는 연속 폐곡선 한 장이어야 한다.
//
// 방향 규약: 두 링을 **양의 signed area** 방향으로 정규화한다. 맞댐 구간은 그 방향
//   기준 `start → end` forward 호다. B 는 **역방향으로** A 에 얹힌다
//   (`b.start ↦ a.end`, `b.end ↦ a.start`) — 두 조각이 봉제선의 반대편에 놓이기
//   때문이고, 그래서 회전만으로(뒤집기 없이) 맞물린다. 교재의 "반원 두 개가 원이 된다"가
//   이 역방향 대응이다.
//
// 의존: `window.designLineTool` 의 순수 헬퍼(outlinePrimsToSegs·subSegment·reverseSeg·
//   projectOntoRing·extractArcTagged·flattenLine·segCross). **복제하지 않는다** —
//   정확 분할(de Casteljau)·의미 metadata 승계는 파트 분리에서 이미 검증된 코드다.
//   그래서 index.html 에서 **designLineTool 다음에** 로드한다.
//   DOM·render·storage 에 접근하지 않는다(순수).
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var RING_EPS = 0.02;      // 외곽 체인 연결 허용(designLineTool 과 같은 기준)
  var CLOSE_EPS = 1e-4;     // 폐곡선 연속성 허용오차(계약)
  var MIN_AREA = 0.01;      // cm² — 면적 0 조각 차단(designLineTool SPLIT_MIN_AREA 와 동일)
  var DEG_EPS = 1e-6;       // 퇴화 판정
  var SEAM_SAMPLES = 24;    // 봉제선 형상 대조 표본 수

  function fail(reason, detail) {
    var e = new Error("designJoin: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }
  function T() {
    var t = (typeof window !== "undefined") && window.designLineTool;
    if (!t || typeof t.extractArcTagged !== "function" || typeof t.outlinePrimsToSegs !== "function") {
      fail("designLineTool-missing");
    }
    return t;
  }
  var deepClone = function (v) {
    return (typeof structuredClone === "function") ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  };
  // subSegment(s,0,1) 은 de Casteljau 상 정확히 원본과 같은 제어점을 내며 의미 metadata
  // (edge/edgeStatus/edgeSourceLineId/dart/boundary)까지 승계한다 → 이걸 clone 으로 쓴다.
  // (designLineTool 은 cloneSeg 를 export 하지 않는다. 베끼지 않고 있는 것을 쓴다.)
  function cloneSeg(seg) { return T().subSegment(seg, 0, 1); }
  var P = function (p) { return { x: p.x, y: p.y }; };
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var near = function (a, b, eps) { return dist(a, b) <= eps; };

  // ── 평탄화·면적·자기교차 (designLineTool 의 순수 헬퍼 위에서) ────────────────
  function flatPts(segs) {
    var t = T(), pts = [];
    segs.forEach(function (s) {
      t.flattenLine([s]).forEach(function (ab) { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); });
    });
    return pts;
  }
  function signedArea(segs) {
    var pts = flatPts(segs), a = 0;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
  }
  function segsLen(segs) {
    var t = T(), L = 0;
    segs.forEach(function (s) {
      t.flattenLine([s]).forEach(function (ab) { L += dist(ab[0], ab[1]); });
    });
    return L;
  }
  // 폐곡선 자기교차(끝점 공유는 정상 연결이라 제외) — 파트 분리와 같은 판정.
  function selfIntersects(segs) {
    var t = T(), f = [];
    segs.forEach(function (s) { t.flattenLine([s]).forEach(function (ab) { f.push(ab); }); });
    var touch = function (u, v) { return dist(u, v) < 1e-6; };
    for (var i = 0; i < f.length; i++) for (var j = i + 2; j < f.length; j++) {
      if (i === 0 && j === f.length - 1) continue;          // 폐곡선 wrap 인접
      var p = t.segCross(f[i][0], f[i][1], f[j][0], f[j][1]);
      if (!p) continue;
      if (touch(f[i][1], f[j][0]) || touch(f[j][1], f[i][0]) ||
          touch(f[i][0], f[j][0]) || touch(f[i][1], f[j][1])) continue;
      return true;
    }
    return false;
  }
  // 호를 등간격 호길이로 표본한다(형상 대조용).
  function samplePolyline(segs, n) {
    var pts = flatPts(segs), cum = [0], i;
    for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
    var total = cum[cum.length - 1], out = [];
    for (var k = 0; k <= n; k++) {
      var target = total * (k / n), j = 1;
      while (j < cum.length - 1 && cum[j] < target) j++;
      var span = cum[j] - cum[j - 1];
      var u = span > 0 ? (target - cum[j - 1]) / span : 0;
      out.push({ x: pts[j - 1].x + (pts[j].x - pts[j - 1].x) * u,
                 y: pts[j - 1].y + (pts[j].y - pts[j - 1].y) * u });
    }
    return out;
  }

  // ── 강체 변환 (회전 + 이동. 반사 없음 — 패턴을 뒤집는 것은 맞댐이 아니다) ────
  function makeXform(fromPt, toPt, rad) {
    return { c: Math.cos(rad), s: Math.sin(rad), from: P(fromPt), to: P(toPt), rad: rad };
  }
  function xformPt(p, X) {
    var dx = p.x - X.from.x, dy = p.y - X.from.y;
    return { x: X.to.x + dx * X.c - dy * X.s, y: X.to.y + dx * X.s + dy * X.c };
  }
  function xformSeg(seg, X) {
    var q = deepClone(seg);
    ["from", "to", "c1", "c2"].forEach(function (k) { if (q[k]) q[k] = xformPt(q[k], X); });
    if (q.commands) q.commands.forEach(function (cmd) {
      cmd.points = cmd.points.map(function (p) { return xformPt(p, X); });
    });
    return q;
  }

  // ── 포맷 경계 ───────────────────────────────────────────────────────────────
  // geometry 는 `{kind:"path", commands:[M,C…]}` 만 받는다. `{kind:"cubic"}` 은 패턴선
  // (designLineTool) 포맷이라 designRenderer·designLayout 이 못 읽고 `invalid-primitive`
  // 로 깨진다(CLAUDE.md·designFlare 가 기록한 함정). 링 작업은 패턴선 포맷으로 하고
  // **내보낼 때 반드시 geometry 포맷으로 되돌린다.**
  var SEMANTIC_KEYS = ["edge", "edgeStatus", "edgeSourceLineId", "dart", "boundary"];
  function toGeomPrim(seg) {
    if (!seg) return seg;
    if (seg.kind !== "cubic") return deepClone(seg);
    var out = { kind: "path", commands: [
      { type: "M", points: [P(seg.from)] },
      { type: "C", points: [P(seg.c1), P(seg.c2), P(seg.to)] }
    ] };
    SEMANTIC_KEYS.forEach(function (k) { if (k in seg) out[k] = deepClone(seg[k]); });
    return out;
  }

  // ── 폐곡선 링 ──────────────────────────────────────────────────────────────
  // designLineTool.buildPieceRing 은 **열린 다트 입구가 정확히 1개**인 토폴로지를 요구한다
  // (다트를 construction 다리로 닫아 링을 만든다). 157 맞댄다의 입력은 **이미 닫힌 두 장**
  // 이라 그 요구를 만족하지 못한다 — 그래서 여기서는 닫힌 외곽 전용 체이너를 쓴다.
  // 같은 RING_EPS·junction 정확 공유 규약을 따른다(다른 규약을 새로 만들지 않는다).
  function buildClosedRing(outlineSegs) {
    var n = outlineSegs.length;
    if (n < 2) return { ok: false, reason: "outline-too-short" };
    var used = new Array(n).fill(false), t = T();
    var chain = [cloneSeg(outlineSegs[0])];
    used[0] = true;
    var cur = chain[0].to;
    for (var step = 1; step < n; step++) {
      var found = -1, oriented = null;
      for (var j = 0; j < n; j++) {
        if (used[j]) continue;
        if (near(outlineSegs[j].from, cur, RING_EPS)) { found = j; oriented = cloneSeg(outlineSegs[j]); break; }
        if (near(outlineSegs[j].to, cur, RING_EPS)) { found = j; oriented = t.reverseSeg(outlineSegs[j]); break; }
      }
      if (found < 0) return { ok: false, reason: "outline-not-single-chain" };
      oriented.from = P(cur);                       // 내부 junction 정확 공유(drift 제거)
      used[found] = true; chain.push(oriented); cur = oriented.to;
    }
    if (!near(cur, chain[0].from, RING_EPS)) return { ok: false, reason: "ring-not-closed" };
    chain[chain.length - 1].to = P(chain[0].from);   // 폐곡선 정확 닫기
    return { ok: true, chain: chain };
  }
  // 방향 정규화 — 양의 signed area. 맞댐 구간 forward 방향의 정의를 결정론으로 만든다.
  function canonicalRing(chain) {
    var area = signedArea(chain);
    if (area >= 0) return { chain: chain, area: area };
    var t = T();
    var rev = chain.slice().reverse().map(function (s) { return t.reverseSeg(s); });
    return { chain: rev, area: -area };
  }
  var tagRing = function (chain) { return chain.map(function (s) { return { seg: s, source: "outline" }; }); };
  var arcOf = function (ring, A, B) { return T().extractArcTagged(ring, A, B).map(function (o) { return o.seg; }); };

  // ── 입력 검사 ──────────────────────────────────────────────────────────────
  function readSide(side, which, joinPairId) {
    if (!side || typeof side !== "object") fail("invalid-side", which);
    var piece = side.piece;
    if (!piece || !Array.isArray(piece.outline) || !piece.outline.length) fail("invalid-piece", which);
    if (side.pairId !== joinPairId) fail("pair-mismatch", { side: which, pairId: side.pairId, joinPairId: joinPairId });
    var pt = function (p, nm) {
      if (!p || typeof p.x !== "number" || typeof p.y !== "number" || !isFinite(p.x) || !isFinite(p.y)) {
        fail("invalid-join-point", which + "." + nm);
      }
      return P(p);
    };
    return { piece: deepClone(piece), start: pt(side.start, "start"), end: pt(side.end, "end") };
  }
  // 한쪽 조각 → 정규화 링 + 맞댐 구간의 ring 위치.
  function prepareSide(side, which, onTol) {
    var t = T();
    var outSegs = t.outlinePrimsToSegs(side.piece.outline);
    var R = buildClosedRing(outSegs);
    if (!R.ok) fail(R.reason, which);
    var C = canonicalRing(R.chain);
    if (!(C.area > MIN_AREA)) fail("zero-area", { side: which, areaCm2: C.area });
    var ring = tagRing(C.chain);
    var p0 = t.projectOntoRing(side.start, ring), p1 = t.projectOntoRing(side.end, ring);
    if (p0.dist > onTol) fail("interval-off-boundary", { side: which, at: "start", distCm: p0.dist });
    if (p1.dist > onTol) fail("interval-off-boundary", { side: which, at: "end", distCm: p1.dist });
    if (p0.i === p1.i && Math.abs(p0.t - p1.t) < DEG_EPS) fail("degenerate-interval", { side: which, reason: "same-point" });
    var butt = arcOf(ring, p0, p1), rest = arcOf(ring, p1, p0);
    if (!butt.length || !rest.length) fail("degenerate-interval", { side: which, reason: "empty-arc" });
    var buttLen = segsLen(butt);
    if (!(buttLen > DEG_EPS)) fail("degenerate-interval", { side: which, reason: "zero-length", lenCm: buttLen });
    if (dist(p0.point, p1.point) < DEG_EPS) fail("degenerate-interval", { side: which, reason: "zero-chord" });
    return { ring: ring, area: C.area, startPos: p0, endPos: p1, butt: butt, rest: rest, buttLenCm: buttLen };
  }

  // ── 본 연산 ────────────────────────────────────────────────────────────────
  // buttJoin(spec, opts)
  //   spec = { joinPairId, a: {piece, pairId, start, end}, b: {piece, pairId, start, end} }
  //     piece       = {outline, construction} (geometry 포맷, 폐곡선)
  //     pairId      = 그 조각에 찍힌 맞댐 표시의 id. 양쪽이 joinPairId 와 같아야 한다(P.159).
  //     start/end   = 맞댐 구간의 끝점. 정규화 링 방향 기준 start→end forward 호가 맞댐 구간.
  //   opts.onTol    기본 0.02cm — 끝점이 경계 위에 있다고 볼 허용거리
  //   opts.lenTol   기본 0.01cm — 봉제선 길이·형상·이음 틈 허용오차
  // 반환: 맞댄 한 장 + 검산 수치. 하나라도 어긋나면 **부분 결과를 반환하지 않는다**(throw).
  function alignSeams(spec, opts) {
    opts = opts || {};
    var t = T();
    if (!spec || typeof spec !== "object") fail("invalid-spec");
    var joinPairId = spec.joinPairId;
    if (typeof joinPairId !== "string" || !joinPairId) fail("invalid-join-pair-id", joinPairId);
    var onTol = opts.onTol != null ? opts.onTol : 0.02;
    var lenTol = opts.lenTol != null ? opts.lenTol : 0.01;
    if (!(onTol > 0) || !(lenTol > 0)) fail("invalid-tolerance", { onTol: onTol, lenTol: lenTol });

    var sa = readSide(spec.a, "a", joinPairId);
    var sb = readSide(spec.b, "b", joinPairId);
    var A = prepareSide(sa, "a", onTol);
    var B = prepareSide(sb, "b", onTol);

    // 1) 같은 봉제선인가 — 길이
    var lenDelta = A.buttLenCm - B.buttLenCm;
    if (Math.abs(lenDelta) > lenTol) {
      fail("length-mismatch", { aCm: A.buttLenCm, bCm: B.buttLenCm, deltaCm: lenDelta });
    }

    // 2) 강체 변환 — B 를 **역방향으로** A 구간에 얹는다(b.start↦a.end, b.end↦a.start).
    var aS = A.startPos.point, aE = A.endPos.point, bS = B.startPos.point, bE = B.endPos.point;
    var rad = Math.atan2(aS.y - aE.y, aS.x - aE.x) - Math.atan2(bE.y - bS.y, bE.x - bS.x);
    if (!isFinite(rad)) fail("degenerate-interval", { reason: "undefined-rotation" });
    var X = makeXform(bS, aE, rad);

    // 3) 같은 봉제선인가 — 형상. 길이가 같아도 휘어짐이 다르면 종이가 맞닿지 않는다.
    //    B 의 forward 표본은 A 의 **역방향** 표본과 대응한다.
    var sampA = samplePolyline(A.butt, SEAM_SAMPLES);
    var sampB = samplePolyline(B.butt, SEAM_SAMPLES).map(function (p) { return xformPt(p, X); });
    var maxDev = 0;
    for (var k = 0; k <= SEAM_SAMPLES; k++) {
      maxDev = Math.max(maxDev, dist(sampA[SEAM_SAMPLES - k], sampB[k]));
    }
    if (maxDev > lenTol) fail("seam-shape-mismatch", { maxDeviationCm: maxDev, tolCm: lenTol });

    return { joinPairId: joinPairId, t: t, sa: sa, sb: sb, A: A, B: B, X: X, rad: rad, aS: aS, aE: aE, bS: bS, bE: bE,
      lenDelta: lenDelta, maxDev: maxDev, onTol: onTol, lenTol: lenTol };
  }

  function buttJoin(spec, opts) {
    opts = opts || {};
    var c = alignSeams(spec, opts);
    var joinPairId = c.joinPairId, sa = c.sa, sb = c.sb, A = c.A, B = c.B, X = c.X, rad = c.rad;
    var bS = c.bS, lenDelta = c.lenDelta, maxDev = c.maxDev, lenTol = c.lenTol;
    var aE = c.aE;
    // 4) 중복 맞댐선 제거 후 재조립 — A 의 나머지(a.end→a.start) + 변환된 B 의 나머지
    //    (b.end→b.start). 두 맞댐 호는 **둘 다** 외곽에서 빠진다(그게 "1장으로 잇는다").
    var keepA = A.rest.map(function (s) { return cloneSeg(s); });
    var keepB = B.rest.map(function (s) { return xformSeg(s, X); });
    if (!keepA.length || !keepB.length) fail("join-failed", "empty-remainder");

    // 이음부 틈: X 는 b.start→a.end 를 정확히 맞추므로 한쪽(a.end)은 0 이고, 다른 쪽
    // (a.start ↔ T(b.end))에만 현(chord) 오차가 남는다. **감추지 않고 기록**한 뒤 snap 한다.
    var gap = dist(keepA[keepA.length - 1].to, keepB[0].from);
    if (gap > lenTol) fail("seam-endpoint-gap", { gapCm: gap, tolCm: lenTol });
    keepB[0].from = P(keepA[keepA.length - 1].to);
    keepB[keepB.length - 1].to = P(keepA[0].from);

    var outline = keepA.concat(keepB);

    // 5) 검증 — 하나라도 어긋나면 거부한다(제1법칙: 종이 위에서 성립해야 한다).
    for (var i = 0; i < outline.length; i++) {
      var u = outline[i], v = outline[(i + 1) % outline.length];
      if (dist(u.to, v.from) > CLOSE_EPS) fail("join-discontinuous", { at: i, gapCm: dist(u.to, v.from) });
    }
    if (selfIntersects(outline)) fail("self-intersection");
    var areaJoined = Math.abs(signedArea(outline));
    if (!(areaJoined > MIN_AREA)) fail("zero-area", { side: "joined", areaCm2: areaJoined });
    var areaSum = A.area + B.area, areaDelta = areaJoined - areaSum;
    // 강체 변환은 면적을 보존하므로 맞댄 결과 = 합이어야 한다. **겹치면 작아진다** — 그걸
    // 잡는 검사다. 허용오차의 세 항:
    //   · 1e-3           평탄화 세분이 회전 후 한 단계 달라질 수 있다
    //   · 1e-6·합        큰 조각의 상대 오차
    //   · 봉제선·(틈+길이차)  허용오차 안의 길이차를 snap 으로 흡수하면 그만큼 면적이
    //     변한다(면적 변화 ≤ 봉제선 길이 × 이동거리). 이건 오차가 아니라 **대가**이므로
    //     숨기지 않고 areaDeltaCm2 로 보고한다.
    var areaTol = Math.max(1e-3, 1e-6 * areaSum, A.buttLenCm * (gap + Math.abs(lenDelta)));
    if (Math.abs(areaDelta) > areaTol) {
      fail("area-not-conserved", { joinedCm2: areaJoined, sumCm2: areaSum, deltaCm2: areaDelta, tolCm2: areaTol });
    }

    // construction 은 A 는 그대로, B 는 같은 강체 변환으로 함께 옮긴다
    // (안 그러면 다트·구성선이 외곽에서 떨어진다).
    var construction = (sa.piece.construction || []).map(toGeomPrim)
      .concat((sb.piece.construction || []).map(function (s) { return toGeomPrim(xformSeg(s, X)); }));

    return {
      joinPairId: joinPairId,
      outline: outline.map(toGeomPrim),
      construction: construction,
      // 제거된 중복 맞댐선의 기록(A 쪽 사본 한 벌 — 최종 좌표계가 A 다). 외곽이 아니다.
      joinSeam: A.butt.map(function (s) { return toGeomPrim(cloneSeg(s)); }),
      transform: { rotationRad: rad, rotationDeg: rad * 180 / Math.PI, mapFrom: P(bS), mapTo: P(aE) },
      seamLenACm: A.buttLenCm,
      seamLenBCm: B.buttLenCm,
      seamLenDeltaCm: lenDelta,
      maxSeamDeviationCm: maxDev,
      residualGapCm: gap,
      areaACm2: A.area,
      areaBCm2: B.area,
      areaJoinedCm2: areaJoined,
      areaDeltaCm2: areaDelta
    };
  }

  // ══ 158「맞대면서 벌린다」 ══════════════════════════════════════════════════
  // 교재(P.158): *"패턴을 맞대는 위치에 분량을 추가하는 방법 — 맞대어 완성한 패턴을 다시
  // 잘라서 벌리는 것."* 절차: ① 맞댄다(157) ② **한 점(WL 포인트)을 고정**하고 종이를 회전시켜
  // 지정 치수를 벌린다 ③ **처리한 곳을 각지지 않게 완만한 곡선으로 수정**한다.
  //
  // buttSpread(spec, opts) — spec 은 buttJoin 과 같고 `spread` 가 더 붙는다.
  //   spec.spread = { pivot:{x,y}, chordCm }
  //     pivot    A 좌표계의 고정점. 맞댐 봉제선(A 구간)의 **한쪽 끝점**이어야 한다(아니면 거부).
  //     chordCm  반대쪽 끝(far)에서 A·B 두 봉제선 끝 사이의 **직선 거리** — 교재 도해의 ∅/2 표기.
  //   opts.bridge      "smooth"(기본, 접선 연속 cubic) | "line"(검증·비교용)
  //   opts.bridgeEdge  벌어진 자리를 잇는 이음선에 줄 의미 모서리(예: "hem")
  // 벌어지는 방향은 결정적이다 — B 몸판이 놓인 쪽으로 봉제선이 돌아 나가, 두 조각 사이에 쐐기가
  // 생긴다(반대로 돌면 겹친다). 쐐기 면적만큼 분량이 늘고, 조각 면적은 각각 보존된다.
  function buttSpread(spec, opts) {
    opts = opts || {};
    var c = alignSeams(spec, opts);
    var sa = c.sa, sb = c.sb, A = c.A, B = c.B, X = c.X, rad = c.rad;
    var aS = c.aS, aE = c.aE, bS = c.bS, lenDelta = c.lenDelta, maxDev = c.maxDev, lenTol = c.lenTol, onTol = c.onTol;
    var sp = spec.spread;
    if (!sp || typeof sp !== "object") fail("invalid-spread");
    var pv = sp.pivot;
    if (!pv || typeof pv.x !== "number" || typeof pv.y !== "number" || !isFinite(pv.x) || !isFinite(pv.y)) fail("invalid-spread-pivot");
    if (typeof sp.chordCm !== "number" || !isFinite(sp.chordCm) || !(sp.chordCm > 0)) fail("invalid-spread-amount", sp.chordCm);
    var bridgeKind = opts.bridge || "smooth";
    if (bridgeKind !== "smooth" && bridgeKind !== "line") fail("invalid-bridge", bridgeKind);

    var pivotAt = dist(pv, aS) <= onTol ? "start" : (dist(pv, aE) <= onTol ? "end" : null);
    if (!pivotAt) fail("pivot-off-seam-end", { toStartCm: dist(pv, aS), toEndCm: dist(pv, aE), tolCm: onTol });
    var pivot = pivotAt === "start" ? aS : aE, far = pivotAt === "start" ? aE : aS;
    var Lc = dist(pivot, far);
    if (!(Lc > DEG_EPS)) fail("degenerate-interval", { reason: "zero-chord" });
    if (!(sp.chordCm < 2 * Lc * 0.999)) fail("spread-too-large", { chordCm: sp.chordCm, maxCm: 2 * Lc });
    var phi = 2 * Math.asin(sp.chordCm / (2 * Lc));
    if (pivotAt === "start") phi = -phi;

    var ca = Math.cos(phi), sn = Math.sin(phi);
    var rp = function (q) { return { x: pivot.x + (q.x - pivot.x) * ca - (q.y - pivot.y) * sn, y: pivot.y + (q.x - pivot.x) * sn + (q.y - pivot.y) * ca }; };
    var X2 = makeXform(bS, rp(aE), rad + phi);
    var sampA = samplePolyline(A.butt, SEAM_SAMPLES);
    var sampB = samplePolyline(B.butt, SEAM_SAMPLES).map(function (q) { return xformPt(q, X2); });
    var keepA = A.rest.map(function (q) { return cloneSeg(q); });
    var keepB = B.rest.map(function (q) { return xformSeg(q, X2); });
    if (!keepA.length || !keepB.length) fail("join-failed", "empty-remainder");

    // 고정점 쪽 이음 틈은 0 이어야 한다(회전 중심이므로). 허용오차 이상이면 거부.
    var pGap = pivotAt === "start" ? dist(keepA[keepA.length - 1].to, keepB[0].from) : dist(keepB[keepB.length - 1].to, keepA[0].from);
    if (pGap > lenTol) fail("seam-endpoint-gap", { gapCm: pGap, tolCm: lenTol });
    if (pivotAt === "start") keepB[0].from = P(keepA[keepA.length - 1].to);
    else keepB[keepB.length - 1].to = P(keepA[0].from);

    // 벌어진 쪽 이음 — 두 조각 외곽 사이를 잇는 선(직선 또는 접선 연속 cubic).
    var prev, next;
    if (pivotAt === "start") { prev = keepB[keepB.length - 1]; next = keepA[0]; }
    else { prev = keepA[keepA.length - 1]; next = keepB[0]; }
    var bp = P(prev.to), bq = P(next.from);
    var bridgeChord = dist(bp, bq);
    if (!(bridgeChord > DEG_EPS)) fail("no-spread");
    var mkBridge = function (kind) {
      var seg = { kind: "line", from: bp, to: bq };
      if (kind === "smooth") {
        var FL = (typeof window !== "undefined") && window.designFlare;
        if (!FL || typeof FL.fairBridge !== "function") fail("designFlare-missing");
        seg = FL.fairBridge(bp, bq, FL.tangentAtEnd(prev), FL.tangentAtStart(next));
      }
      if (opts.bridgeEdge) seg.edge = opts.bridgeEdge;
      return seg;
    };
    var assemble = function (bridge) {
      return pivotAt === "start" ? keepA.concat(keepB, [bridge]) : keepA.concat([bridge], keepB);
    };
    var lineOutline = assemble(mkBridge("line"));
    var bridgeSeg = mkBridge(bridgeKind);
    var outline = bridgeKind === "line" ? lineOutline : assemble(bridgeSeg);

    for (var i = 0; i < outline.length; i++) {
      var u = outline[i], v = outline[(i + 1) % outline.length];
      if (dist(u.to, v.from) > CLOSE_EPS) fail("join-discontinuous", { at: i, gapCm: dist(u.to, v.from) });
    }
    if (selfIntersects(outline)) fail("self-intersection");
    var areaJoined = Math.abs(signedArea(outline));
    if (!(areaJoined > MIN_AREA)) fail("zero-area", { side: "joined", areaCm2: areaJoined });

    // 면적 검산: (선으로 이은 한 장) = A + B + **두 봉제선 사이 쐐기**. 겹치면 이보다 작아진다.
    var wedgePts = (pivotAt === "start" ? sampA : sampA.slice().reverse())
      .concat((pivotAt === "start" ? sampB : sampB.slice().reverse()));
    var wA = 0;
    for (var k = 0; k < wedgePts.length; k++) { var pa = wedgePts[k], pb = wedgePts[(k + 1) % wedgePts.length]; wA += pa.x * pb.y - pb.x * pa.y; }
    var wedgeArea = Math.abs(wA / 2);
    var areaLine = Math.abs(signedArea(lineOutline));
    var areaSum = A.area + B.area;
    var areaTol = Math.max(2e-3, 1e-6 * areaSum, A.buttLenCm * (pGap + Math.abs(lenDelta)));
    if (Math.abs(areaLine - areaSum - wedgeArea) > areaTol) {
      fail("area-not-conserved", { lineCm2: areaLine, sumCm2: areaSum, wedgeCm2: wedgeArea, tolCm2: areaTol });
    }
    if (!(wedgeArea > MIN_AREA)) fail("no-spread");

    var construction = (sa.piece.construction || []).map(toGeomPrim)
      .concat((sb.piece.construction || []).map(function (q) { return toGeomPrim(xformSeg(q, X2)); }));
    var bridgeLen = segsLen([bridgeSeg]);

    return {
      joinPairId: c.joinPairId,
      outline: outline.map(toGeomPrim),
      construction: construction,
      joinSeam: A.butt.map(function (q) { return toGeomPrim(cloneSeg(q)); }),
      transform: { rotationRad: rad + phi, rotationDeg: (rad + phi) * 180 / Math.PI, mapFrom: P(bS), mapTo: rp(aE) },
      seamLenACm: A.buttLenCm, seamLenBCm: B.buttLenCm, seamLenDeltaCm: lenDelta,
      maxSeamDeviationCm: maxDev, residualGapCm: pGap,
      areaACm2: A.area, areaBCm2: B.area, areaJoinedCm2: areaJoined,
      areaDeltaCm2: areaJoined - areaSum,
      spread: {
        pivotAt: pivotAt, pivot: P(pivot), far: P(far), chordCm: sp.chordCm, seamChordCm: Lc,
        angleRad: phi, angleDeg: phi * 180 / Math.PI, bridgeKind: bridgeKind, bridgeChordCm: bridgeChord,
        bridgeLenCm: bridgeLen, wedgeAreaCm2: wedgeArea, bridgeAreaCm2: areaJoined - areaLine
      }
    };
  }

  window.designJoin = Object.freeze({
    buttJoin: buttJoin,
    buttSpread: buttSpread,
    // 순수 헬퍼(하네스·후속 158/159 가 쓴다 — 베끼지 않게 노출한다)
    buildClosedRing: buildClosedRing,
    canonicalRing: canonicalRing,
    xformPt: xformPt,
    xformSeg: xformSeg,
    toGeomPrim: toGeomPrim
  });
})();
