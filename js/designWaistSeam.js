// ══════════════════════════════════════════════════════════════════════════════
// designWaistSeam.js — [패턴학교] 허리 이음선 Ⓜ(P.26)의 **순수 조합**.
//
//   교재 문장: «이음선을 넣어 옆에서 1.5cm 줄이고 밑단에서 1cm 추가. 몸판은 다트 b와 d를 닫고
//   페플럼은 맞댄다. 몸판은 a,e를 다트로, b,d는 닫아 벌어지는 분량을 진동 둘레 여유분으로 둔다.
//   페플럼은 a,b,d,e를 몸판과 같은 분량으로 잡은 뒤 맞댄다. 뒤도 같은 방법.»
//
// 입력  designBodice.computeGeometry 가 만든 front / back piece({outline, construction}, geometry
//       포맷). 밑단(hemExtensionBelowWaistCm > 0)이 있어야 한다 — 허리 아래가 없으면 페플럼이 없다.
// 출력  front / back = **upper**(허리 위 몸판, 원형과 같은 형태: 허리선이 외곽, 다트는 construction),
//       frontPeplum / backPeplum = 허리 아래를 다트 자리에서 갈라 **맞댄 한 장**, 그리고 검산 메타.
//       떨어진 두 조각을 한 outline 으로 속이지 않는다 — 조각은 네 장이다.
//
// ★ 몸판(upper) — a·e 는 그대로. **b(앞)·d(뒤)만 닫는다.**
//   다트 apex A 를 축으로 옆쪽 조각(허리 mouth Ms 부터 옆선·진동 아래쪽 T 까지의 외곽 호)을
//   Ms 가 중심쪽 mouth Mc 에 얹히는 각만큼 회전한다. 절개선은 **A 에서 옆쪽으로 수평**(grain 직각)
//   으로 진동선과 만나는 점 T 까지다. 다트 wedge(Ms-A-Mc)는 접혀 사라지고, 회전 조각의 진동 쪽
//   끝 T' 와 원래 T 사이가 벌어진다 — 그 벌어진 분량이 «진동 둘레 여유분»(`armholeEaseCm`)이다.
//   T'→T 를 잇는 짧은 선을 진동선의 일부로 두고, **닫힌 다트의 다리는 어디에도 남기지 않는다**
//   (지배 데이터 모델: 닫힌 다트 = 과거 흔적).
//
// ★ 페플럼 — 몸판 다트 a,b,d,e 와 **같은 입 너비**를 허리선에 잡고, 각 다트 자리에서 **밑단까지**
//   wedge 를 잘라내 조각을 나눈 뒤(다리 길이는 두 다리가 같다), 다트마다 semantic joinPairId
//   (`<front|back>-peplum-<기호>`)를 붙여 **designJoin.buttJoin 을 순차 호출**해 맞댄다. 좌표를
//   호출부가 추측하지 않는다 — 다리 세그먼트에 새긴 edge 태그(`join:<id>:first|second`)에서 정확한
//   끝점을 꺼낸다. 결과는 앞/뒤 각각 한 장.
//
// ★ 허리 이음 길이 정합 — upper 의 봉제 허리(허리 외곽 − 남은 다트 입) 와 peplum 의 허리(맞댄 뒤)는
//   같은 값이어야 한다(둘 다 W − Σ(a·b 또는 d·e 입)). 어긋나면 **원자적 거부**.
//
// 원자성·순수성: 입력은 불변(deepClone), 실패는 reason 을 단 Error throw(부분 결과 없음), DOM·
//   storage·render 미접근, 결정론(난수·시간 없음). designJoin·designLineTool 의 순수 헬퍼를 쓴다
//   (index.html 에서 그 둘 **다음에** 로드).
//
// ※ 이동한 다리(옆 다트 c 등)의 `dart.attach` 는 원래 허리 root 기준 t 라 회전 뒤 stale 이다.
//   이 모듈은 **손대지 않고** 표시만 한다(`movedLegs`) — 봉제 정합 게이트는 후속 커밋 몫.
// ══════════════════════════════════════════════════════════════════════════════
(function () {
  "use strict";

  var CLOSE_EPS = 1e-4;      // 폐곡선 연속성 허용오차(designJoin·designLineTool 과 같은 계약)
  var SNAP_EPS = 0.02;       // 회전 뒤 mouth 가 겹쳐야 하는 허용거리(두 다리 길이가 같을 때 ≈0)
  var MIN_AREA = 0.01;       // cm²
  var SEAM_TOL = 0.01;       // 허리 이음 길이 정합 허용오차(cm)
  var Y_EPS = 1e-6;
  var CLOSE_DARTS = { front: "front-waist-b", back: "back-waist-d" };   // 몸판에서 닫는 다트

  function fail(reason, detail) {
    var e = new Error("designWaistSeam: " + reason);
    e.reason = reason;
    if (detail !== undefined) e.detail = detail;
    throw e;
  }
  var deepClone = function (v) {
    return (typeof structuredClone === "function") ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  };
  function T() {
    var t = (typeof window !== "undefined") && window.designLineTool;
    if (!t || typeof t.buildPieceRing !== "function") fail("designLineTool-missing");
    return t;
  }
  function J() {
    var j = (typeof window !== "undefined") && window.designJoin;
    if (!j || typeof j.buttJoin !== "function") fail("designJoin-missing");
    return j;
  }
  var P = function (p) { return { x: p.x, y: p.y }; };
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };
  var near = function (a, b, e) { return dist(a, b) <= e; };
  var line = function (a, b, extra) {
    var s = { kind: "line", from: P(a), to: P(b) };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  };

  // ── 평탄화·면적·자기교차(designLineTool 의 순수 헬퍼 위에서) ──────────────────
  function flatPairs(segs) {
    var t = T(), f = [];
    segs.forEach(function (s) { t.flattenLine([s]).forEach(function (ab) { f.push(ab); }); });
    return f;
  }
  function signedArea(segs) {
    var pts = [];
    flatPairs(segs).forEach(function (ab) { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); });
    var a = 0;
    for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
    return a / 2;
  }
  function selfIntersects(segs) {
    var t = T(), f = flatPairs(segs);
    var touch = function (u, v) { return dist(u, v) < 1e-6; };
    for (var i = 0; i < f.length; i++) for (var j = i + 2; j < f.length; j++) {
      if (i === 0 && j === f.length - 1) continue;
      if (!t.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
      if (touch(f[i][1], f[j][0]) || touch(f[j][1], f[i][0]) || touch(f[i][0], f[j][0]) || touch(f[i][1], f[j][1])) continue;
      return true;
    }
    return false;
  }
  function segsLen(segs) {
    var L = 0;
    flatPairs(segs).forEach(function (ab) { L += dist(ab[0], ab[1]); });
    return L;
  }
  // 닫힌 세그먼트 열(순서대로 이어진)의 검증 — 연속·자기교차 0·면적>0.
  function checkClosed(segs, what) {
    for (var i = 0; i < segs.length; i++) {
      var g = dist(segs[i].to, segs[(i + 1) % segs.length].from);
      if (g > CLOSE_EPS) fail("discontinuous", { what: what, at: i, gapCm: g });
    }
    if (selfIntersects(segs)) fail("self-intersection", what);
    var a = Math.abs(signedArea(segs));
    if (!(a > MIN_AREA)) fail("zero-area", { what: what, areaCm2: a });
    return a;
  }

  // ── 강체 회전 ────────────────────────────────────────────────────────────────
  function rotPt(p, o, th) {
    var c = Math.cos(th), s = Math.sin(th), dx = p.x - o.x, dy = p.y - o.y;
    return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
  }
  function rotObj(seg, o, th) {
    var q = deepClone(seg);
    ["from", "to", "c1", "c2"].forEach(function (k) { if (q[k]) q[k] = rotPt(q[k], o, th); });
    if (q.commands) q.commands.forEach(function (c) { c.points = c.points.map(function (p) { return rotPt(p, o, th); }); });
    return q;
  }

  // ── 다트 그룹(구성선의 허리 다트) ───────────────────────────────────────────
  function dartMouth(seg) { return seg.dart.apexAt === "to" ? seg.from : seg.to; }
  function dartApex(seg) { return seg.dart.apexAt === "to" ? seg.to : seg.from; }
  function symbolOf(id) { var m = /-([a-z])$/.exec(String(id || "")); return m ? m[1] : null; }
  function waistDartGroups(construction) {
    var m = {}, order = [];
    construction.forEach(function (s) {
      var d = s && s.dart;
      if (!d || d.boundary !== "waist" || s.kind !== "line") return;
      if (!m[d.id]) { m[d.id] = []; order.push(d.id); }
      m[d.id].push(s);
    });
    return order.map(function (id) {
      var segs = m[id], first = segs[0].dart;
      return { id: id, symbol: symbolOf(id), segs: segs, locked: !!first.locked, onFold: !!first.onFold };
    });
  }
  function sewnGroups(construction) {
    return waistDartGroups(construction).filter(function (g) { return !g.locked && !g.onFold && g.segs.length === 2; });
  }

  // ── 조각을 허리에서 위/아래로 나눈다 ─────────────────────────────────────────
  function classify(piece, which) {
    var t = T();
    if (!piece || !Array.isArray(piece.outline) || !Array.isArray(piece.construction)) fail("invalid-piece", which);
    if (piece.flareCm) fail("flare-unsupported", which);
    var waistLines = piece.construction.filter(function (s) { return s && s.edge === "waist" && !s.dart; });
    if (waistLines.length !== 1 || waistLines[0].kind !== "line") fail("no-waist-edge", which);
    var W = waistLines[0];
    if (Math.abs(W.from.y - W.to.y) > Y_EPS) fail("waist-not-horizontal", which);
    var Yw = W.from.y;
    var above = [], below = [];
    t.outlinePrimsToSegs(piece.outline).forEach(function (s) {
      var lo = Math.min.apply(null, flatPairs([s]).map(function (ab) { return Math.min(ab[0].y, ab[1].y); }));
      var hi = Math.max.apply(null, flatPairs([s]).map(function (ab) { return Math.max(ab[0].y, ab[1].y); }));
      if (lo < Yw - Y_EPS && hi > Yw + Y_EPS) fail("outline-crosses-waist", which);
      if (hi > Yw + Y_EPS) below.push(s); else above.push(s);
    });
    if (!below.length) fail("no-hem-extension", which);
    return { waist: W, waistSeg: t.outlinePrimsToSegs([W])[0], Yw: Yw, above: above, below: below };
  }

  // ── 원래 path 프리미티브 복원 ─────────────────────────────────────────────────
  // (여러 C 뿐 아니라 하나뿐인 path 도 링 방향에 따라 뒤집혀 나오므로 같은 방식으로 되돌린다.)
  // outlinePrimsToSegs 는 여러 C 를 가진 path(예: 앞 목선 2 커브)를 **커브마다 별개 세그먼트**로 쪼갠다.
  // 그대로 내보내면 원래 하나였던 프리미티브가 둘이 돼, "중심 상단에 닿는 단일 네크라인 세그먼트"를
  // 재는 소비자(bodiceCheckpoint.necklineHalf — 목선 길이가 앞 11.1 → 5.4cm 로 절반)와 소매·카라가
  // 깨진다. **회전·절단으로 바뀌지 않은 구간은 원래 프리미티브 그대로** 되돌린다(좌표·boundary·edge 동일).
  var SAME_EPS = 1e-6;
  function sameCubic(a, b) {
    if (a.kind !== "cubic" || b.kind !== "cubic") return false;
    return ["from", "c1", "c2", "to"].every(function (k) { return near(a[k], b[k], SAME_EPS); });
  }
  function restorePaths(segs, originals) {
    var t = T(), Jn = J();
    var multi = originals.filter(function (pr) {
      return pr && pr.kind === "path" && pr.commands.some(function (c) { return c.type === "C"; });
    }).map(function (pr) { return { prim: pr, cubics: t.outlinePrimsToSegs([pr]) }; });
    var out = [];
    for (var i = 0; i < segs.length;) {
      var hit = null;
      for (var m = 0; m < multi.length && !hit; m++) {
        var cs = multi[m].cubics, k = cs.length;
        if (i + k > segs.length) continue;
        var fwd = true, rev = true;
        for (var q = 0; q < k; q++) {
          if (!sameCubic(segs[i + q], cs[q])) fwd = false;
          if (!sameCubic(segs[i + q], t.reverseSeg(cs[k - 1 - q]))) rev = false;
        }
        if (fwd || rev) hit = { prim: multi[m].prim, k: k };
      }
      if (hit) { out.push(deepClone(hit.prim)); i += hit.k; }
      else { out.push(Jn.toGeomPrim(segs[i])); i++; }
    }
    return out;
  }

  // ══ upper: b/d 를 닫는다 ═════════════════════════════════════════════════════
  function buildUpper(piece, which, cls) {
    var t = T(), Jn = J();
    var group = null;
    sewnGroups(piece.construction).forEach(function (g) { if (g.id === CLOSE_DARTS[which]) group = g; });

    var construction = piece.construction.filter(function (s) { return !(s && s.edge === "waist" && !s.dart); });
    var upperSegs = cls.above.map(function (s) { return t.subSegment(s, 0, 1); }).concat([cls.waistSeg]);

    if (!group) {
      // 닫을 다트가 없다(배율 0 등) — 허리 위 조각을 그대로 잘라 낸다.
      var rawOut = restorePaths(upperSegs, piece.outline);
      return { outline: rawOut, construction: deepClone(construction), closed: null };
    }

    // 절개 기준점
    var wp0 = cls.waistSeg.from, wp1 = cls.waistSeg.to;
    var centerSeg = cls.above.filter(function (s) { return s.edge === "center"; });
    var sideSeg = cls.above.filter(function (s) { return s.edge === "side-seam"; });
    if (centerSeg.length !== 1 || sideSeg.length !== 1) fail("center-or-side-missing", which);
    var touches = function (p, s) { return near(p, s.from, SNAP_EPS) || near(p, s.to, SNAP_EPS); };
    var Wc, Ws;
    if (touches(wp0, centerSeg[0]) && touches(wp1, sideSeg[0])) { Wc = wp0; Ws = wp1; }
    else if (touches(wp1, centerSeg[0]) && touches(wp0, sideSeg[0])) { Wc = wp1; Ws = wp0; }
    else fail("waist-ends-unmatched", which);
    var axis = { x: Ws.x - Wc.x, y: Ws.y - Wc.y }, axisLen = Math.hypot(axis.x, axis.y);
    var u = function (p) { return ((p.x - Wc.x) * axis.x + (p.y - Wc.y) * axis.y) / axisLen; };   // 중심→옆 거리

    var A = P(dartApex(group.segs[0]));
    var m0 = P(dartMouth(group.segs[0])), m1 = P(dartMouth(group.segs[1]));
    var Mc = u(m0) <= u(m1) ? m0 : m1, Ms = u(m0) <= u(m1) ? m1 : m0;   // Mc = 중심쪽, Ms = 옆쪽

    // 링(열린 진동/어깨 다트는 construction 다리로 닫는다). 허리 다트 구성선은 링에 넣지 않는다.
    var ringLegs = piece.construction.filter(function (s) {
      return s && s.kind === "line" && s.dart && s.dart.boundary !== "waist";
    }).map(function (s) { return { kind: "line", from: P(s.from), to: P(s.to) }; });
    var R = t.buildPieceRing(upperSegs, ringLegs);
    if (!R.ok) fail("ring-failed", { which: which, reason: R.reason });
    var ring = R.ring;

    // T: A 에서 옆쪽으로 수평으로 나아가 처음 만나는 링 위 점.
    var sgn = Math.sign(Ws.x - Wc.x) || 1;
    var Tpt = rayHit(ring, A, sgn);
    if (!Tpt) fail("slash-misses-boundary", which);

    var posOf = function (p) {
      var pj = t.projectOntoRing(p, ring);
      if (pj.dist > 0.02) fail("point-off-boundary", { which: which, distCm: pj.dist });
      return pj;
    };
    var pMs = posOf(Ms), pMc = posOf(Mc), pT = posOf(Tpt);
    var hasEdge = function (arc, e) { return arc.some(function (o) { return o.seg.edge === e; }); };
    var sideArc = t.extractArcTagged(ring, pMs, pT);
    if (!hasEdge(sideArc, "side-seam")) {
      // 링 방향이 반대다 — 뒤집고 위치를 다시 잡는다(방향 정규화 : Mc → Ms → 옆선 → T → 중심).
      ring = ring.slice().reverse().map(function (r) { return { seg: t.reverseSeg(r.seg), source: r.source }; });
      pMs = posOf(Ms); pMc = posOf(Mc); pT = posOf(Tpt);
      sideArc = t.extractArcTagged(ring, pMs, pT);
      if (!hasEdge(sideArc, "side-seam")) fail("side-arc-ambiguous", which);
    }
    var centerArc = t.extractArcTagged(ring, pT, pMc);
    if (hasEdge(sideArc, "center") || !hasEdge(centerArc, "center")) fail("center-arc-ambiguous", which);
    if (sideArc.some(function (o) { return o.source === "dartleg"; })) fail("dart-leg-in-rotated-part", which);

    var th = Math.atan2(Mc.y - A.y, Mc.x - A.x) - Math.atan2(Ms.y - A.y, Ms.x - A.x);
    if (!isFinite(th) || Math.abs(th) < 1e-9) fail("degenerate-dart", { which: which, th: th });

    var sideR = sideArc.map(function (o) { return rotObj(o.seg, A, th); });
    var Tp = rotPt(Tpt, A, th), Msp = rotPt(Ms, A, th);
    var waistGap = dist(Msp, Mc);
    if (waistGap > SNAP_EPS) fail("dart-legs-unequal", { which: which, gapCm: waistGap });
    var ease = dist(Tp, Tpt);
    if (!(ease > 1e-6)) fail("no-armhole-ease", which);

    // 조립: 옆 조각' + T'→T 이음(진동선) + 중심 호. junction 은 정확 공유로 snap.
    var chord = line(Tp, Tpt, { edge: "armhole" });
    var chain = sideR.concat([chord]).concat(centerArc.map(function (o) { return o.seg; }));
    var isLeg = sideR.map(function () { return false; }).concat([false]).concat(centerArc.map(function (o) { return o.source === "dartleg"; }));
    chain[0].from = P(Mc);
    for (var i = 0; i < chain.length; i++) {
      var nx = chain[(i + 1) % chain.length];
      if (i === chain.length - 1) { chain[i].to = P(nx.from); continue; }
      if (dist(chain[i].to, nx.from) > SNAP_EPS) fail("assembly-gap", { which: which, at: i });
      nx.from = P(chain[i].to);
    }
    var ringArea = checkClosed(chain, which + ".upper");

    var outlineSegs = chain.filter(function (s, k) { return !isLeg[k]; });

    // construction: 닫은 다트 다리 제거, 옆 조각에 실린 다리는 함께 회전, 허리 선은 외곽으로 옮겼다.
    var uMs = u(Ms), moved = [];
    var outConstruction = [];
    construction.forEach(function (s) {
      if (s.dart && s.dart.id === group.id) return;                       // 닫힌 다트 — 흔적 0
      if (s.dart && s.dart.boundary === "waist") {
        var mo = dartMouth(s);
        if (u(mo) >= uMs - 1e-9) {                                        // 옆쪽 조각 소속
          var r = rotObj(s, A, th); outConstruction.push(r); moved.push(s.dart.id); return;
        }
      }
      outConstruction.push(deepClone(s));
    });

    var waistPieces = outlineSegs.filter(function (s) { return s.edge === "waist"; });
    return {
      outline: restorePaths(outlineSegs, piece.outline),
      construction: outConstruction,
      closed: {
        dartId: group.id,
        dartAngleRad: th,
        widthCm: dist(Ms, Mc),
        apex: P(A), slashEnd: P(Tpt), slashEndRotated: P(Tp),
        slashLenCm: dist(A, Tpt),
        armholeEaseCm: ease,
        residualWaistGapCm: waistGap,
        movedLegs: moved.filter(function (id, k, a) { return a.indexOf(id) === k; }),
        ringAreaCm2: ringArea
      },
      waistEdgeLenCm: segsLen(waistPieces)
    };
  }

  // A 에서 (sgn,0) 방향으로 나아가 링과 처음 만나는 점(가장 가까운 것). 꼭짓점 스침을 허용한다.
  function rayHit(ring, A, sgn) {
    var t = T(), best = null;
    flatPairs(ring.map(function (r) { return r.seg; })).forEach(function (ab) {
      var p = ab[0], q = ab[1], d0 = p.y - A.y, d1 = q.y - A.y;
      var cand = [];
      if (Math.abs(d0) < 1e-12 && Math.abs(d1) < 1e-12) { cand.push(p.x, q.x); }
      else if (d0 * d1 <= 0 && Math.abs(d1 - d0) > 1e-12) {
        var s = d0 / (d0 - d1); cand.push(p.x + (q.x - p.x) * s);
      }
      cand.forEach(function (x) {
        var du = sgn * (x - A.x);
        if (du > 1e-9 && (!best || du < best.du)) best = { du: du, x: x };
      });
    });
    if (!best) return null;
    var pj = t.projectOntoRing({ x: best.x, y: A.y }, ring);
    return pj.dist < 0.05 ? pj.point : { x: best.x, y: A.y };
  }

  // ══ peplum: a,b,d,e 자리에서 갈라 buttJoin 으로 맞댄다 ═══════════════════════
  function buildPeplum(piece, which, cls) {
    var t = T(), Jn = J();
    var groups = sewnGroups(piece.construction);
    var below = cls.below.map(function (s) { return t.subSegment(s, 0, 1); });
    var waist = t.subSegment(cls.waistSeg, 0, 1);
    var pick = function (edge) { return below.filter(function (s) { return s.edge === edge; }); };
    var cEx = pick("center"), sEx = pick("side-seam"), hems = pick("hem");
    if (cEx.length !== 1 || sEx.length !== 1 || hems.length !== 1 || below.length !== 3) fail("unsupported-peplum-outline", which);
    if (hems[0].kind !== "line") fail("unsupported-hem", which);
    // 방향 정규화: 허리에서 밑단으로.
    var down = function (s) { return s.from.y <= s.to.y ? s : t.reverseSeg(s); };
    var cx = down(cEx[0]), sx = down(sEx[0]);
    if (!near(waist.from, cx.from, SNAP_EPS)) waist = t.reverseSeg(waist);
    if (!near(waist.from, cx.from, SNAP_EPS) || !near(waist.to, sx.from, SNAP_EPS)) fail("peplum-waist-unmatched", which);
    var hem = hems[0];
    if (!near(hem.from, cx.to, SNAP_EPS)) hem = t.reverseSeg(hem);
    if (!near(hem.from, cx.to, SNAP_EPS) || !near(hem.to, sx.to, SNAP_EPS)) fail("peplum-hem-unmatched", which);
    var Wc = P(waist.from), Ws = P(waist.to), Hc = P(hem.from), Hs = P(hem.to);
    var wl = dist(Wc, Ws), hl = dist(Hc, Hs);
    var wt = function (p) { return ((p.x - Wc.x) * (Ws.x - Wc.x) + (p.y - Wc.y) * (Ws.y - Wc.y)) / (wl * wl); };

    var darts = groups.map(function (g) {
      var m0 = dartMouth(g.segs[0]), m1 = dartMouth(g.segs[1]);
      var a = wt(m0) <= wt(m1) ? m0 : m1, b = wt(m0) <= wt(m1) ? m1 : m0;   // a = 중심쪽
      var ta = wt(a), tb = wt(b);
      if (ta < -1e-9 || tb > 1 + 1e-9) fail("dart-outside-waist", g.id);
      var xm = (a.x + b.x) / 2;
      if (Math.abs(Hs.x - Hc.x) < 1e-9) fail("hem-vertical", which);
      var hs = (xm - Hc.x) / (Hs.x - Hc.x);
      if (!(hs > 0 && hs < 1)) fail("dart-outside-hem", g.id);
      return { id: g.id, symbol: g.symbol, pairId: which + "-peplum-" + g.symbol, a: P(a), b: P(b), ta: ta, tb: tb, hs: hs,
        apex: { x: Hc.x + (Hs.x - Hc.x) * hs, y: Hc.y + (Hs.y - Hc.y) * hs }, widthCm: dist(a, b) };
    }).sort(function (p, q) { return p.ta - q.ta; });
    for (var k = 1; k < darts.length; k++) if (darts[k].ta < darts[k - 1].tb - 1e-9) fail("darts-overlap", darts[k].id);
    if (darts.some(function (d) { return !d.symbol; })) fail("dart-symbol-missing", which);

    var toPrims = function (segs) { return segs.map(Jn.toGeomPrim); };
    var sub = function (seg, a, b) { return t.subSegment(seg, a, b); };
    var tag = function (pid, side) { return "join:" + pid + ":" + side; };

    if (!darts.length) {
      var whole = [waist, sx, t.reverseSeg(hem), t.reverseSeg(cx)];
      // 다트 없는 페플럼은 그대로 한 장(맞댈 것이 없다).
      var rr = Jn.buildClosedRing(whole);
      if (!rr.ok) fail(rr.reason, which);
      checkClosed(rr.chain, which + ".peplum");
      return { outline: toPrims(rr.chain), construction: [], joins: [], darts: [], waistEdgeLenCm: wl };
    }

    // 조각(strip) k = 0..n
    var n = darts.length, strips = [];
    for (var s = 0; s <= n; s++) {
      var segs = [];
      var wA = s === 0 ? 0 : darts[s - 1].tb, wB = s === n ? 1 : darts[s].ta;
      var hA = s === 0 ? 0 : darts[s - 1].hs, hB = s === n ? 1 : darts[s].hs;
      segs.push(sub(waist, wA, wB));                                       // 허리(중심→옆)
      if (s < n) segs.push(line(darts[s].a, darts[s].apex, { edge: tag(darts[s].pairId, "first") }));   // 오른 다리(아래로)
      else segs.push(sx);                                                   // 옆선 연장(아래로)
      segs.push(t.reverseSeg(sub(hem, hA, hB)));                           // 밑단(옆→중심)
      if (s > 0) segs.push(line(darts[s - 1].apex, darts[s - 1].b, { edge: tag(darts[s - 1].pairId, "second") }));  // 왼 다리(위로)
      else segs.push(t.reverseSeg(cx));                                     // 중심 연장(위로)
      var R = Jn.buildClosedRing(segs);
      if (!R.ok) fail(R.reason, { which: which, strip: s });
      checkClosed(R.chain, which + ".strip" + s);
      strips.push({ outline: toPrims(R.chain), construction: [] });
    }

    // 순차 맞댐 — 다리 끝점은 세그먼트 태그에서 정확히 꺼낸다(좌표 추측 금지).
    var legEnds = function (pc, edgeTag) {
      var R = Jn.buildClosedRing(t.outlinePrimsToSegs(pc.outline));
      if (!R.ok) fail(R.reason, edgeTag);
      var C = Jn.canonicalRing(R.chain), hit = C.chain.filter(function (sg) { return sg.edge === edgeTag; });
      if (hit.length !== 1) fail("join-leg-not-found", { tag: edgeTag, count: hit.length });
      return { start: P(hit[0].from), end: P(hit[0].to) };
    };
    var acc = strips[0], joins = [];
    for (var j = 0; j < n; j++) {
      var d = darts[j], ea = legEnds(acc, tag(d.pairId, "first")), eb = legEnds(strips[j + 1], tag(d.pairId, "second"));
      var res;
      try {
        res = Jn.buttJoin({ joinPairId: d.pairId,
          a: { piece: acc, pairId: d.pairId, start: ea.start, end: ea.end },
          b: { piece: strips[j + 1], pairId: d.pairId, start: eb.start, end: eb.end } });
      } catch (e) { fail("join-failed", { which: which, pairId: d.pairId, reason: e.reason || e.message }); }
      acc = { outline: res.outline, construction: [] };
      joins.push({ joinPairId: d.pairId, dartId: d.id, widthCm: d.widthCm,
        seamLenACm: res.seamLenACm, seamLenBCm: res.seamLenBCm, seamLenDeltaCm: res.seamLenDeltaCm,
        maxSeamDeviationCm: res.maxSeamDeviationCm, residualGapCm: res.residualGapCm,
        areaACm2: res.areaACm2, areaBCm2: res.areaBCm2, areaJoinedCm2: res.areaJoinedCm2, areaDeltaCm2: res.areaDeltaCm2,
        rotationDeg: res.transform.rotationDeg });
    }
    var fin = Jn.buildClosedRing(t.outlinePrimsToSegs(acc.outline));
    if (!fin.ok) fail(fin.reason, which);
    var finArea = checkClosed(fin.chain, which + ".peplum");
    var waistEdge = fin.chain.filter(function (sg) { return sg.edge === "waist"; });
    var totalW = darts.reduce(function (sum, dd) { return sum + dd.widthCm; }, 0);
    return { outline: acc.outline, construction: [], joins: joins, areaCm2: finArea,
      darts: darts.map(function (dd) { return { id: dd.id, pairId: dd.pairId, widthCm: dd.widthCm }; }),
      waistEdgeLenCm: segsLen(waistEdge), dartTotalCm: totalW };
  }

  // ══ 공개: 앞/뒤 한 벌 ═════════════════════════════════════════════════════════
  function splitSide(piece, which) {
    var cls = classify(piece, which);
    var upper = buildUpper(piece, which, cls);
    var peplum = buildPeplum(piece, which, cls);

    // 허리 이음 길이 정합: upper 봉제 허리(허리 외곽 − 남은 a/e 입) == peplum 허리(맞댄 뒤)
    var openSewn = sewnGroups(upper.construction).reduce(function (sum, g) {
      return sum + dist(dartMouth(g.segs[0]), dartMouth(g.segs[1]));
    }, 0);
    var upperSeam = (upper.waistEdgeLenCm != null ? upper.waistEdgeLenCm : segsLen(T().outlinePrimsToSegs(upper.outline).filter(function (s) { return s.edge === "waist"; })))
      - openSewn;
    var delta = upperSeam - peplum.waistEdgeLenCm;
    if (Math.abs(delta) > SEAM_TOL) fail("waist-seam-mismatch", { which: which, upperCm: upperSeam, peplumCm: peplum.waistEdgeLenCm, deltaCm: delta });

    var upperPiece = deepClone(piece);
    upperPiece.outline = upper.outline;
    upperPiece.construction = upper.construction;
    var peplumPiece = { outline: peplum.outline, construction: peplum.construction };
    return {
      upper: upperPiece, peplum: peplumPiece,
      meta: {
        closedDart: upper.closed,
        keptDarts: sewnGroups(upper.construction).map(function (g) { return g.id; }),
        peplumDarts: peplum.darts, joins: peplum.joins,
        upperWaistEdgeCm: upper.waistEdgeLenCm, upperOpenDartCm: openSewn,
        upperWaistSeamCm: upperSeam, peplumWaistSeamCm: peplum.waistEdgeLenCm, waistSeamDeltaCm: delta,
        peplumAreaCm2: peplum.areaCm2 != null ? peplum.areaCm2 : null
      }
    };
  }

  // split({front, back}) → { front, back, frontPeplum, backPeplum, meta:{front, back} }
  // 원자적: 앞·뒤 중 하나라도 실패하면 아무것도 반환하지 않는다. 입력은 변형하지 않는다.
  function split(geometry) {
    if (!geometry || typeof geometry !== "object" || !geometry.front || !geometry.back) fail("invalid-geometry");
    var f = splitSide(deepClone(geometry.front), "front");
    var b = splitSide(deepClone(geometry.back), "back");
    return { front: f.upper, back: b.upper, frontPeplum: f.peplum, backPeplum: b.peplum,
      meta: { front: f.meta, back: b.meta } };
  }

  window.designWaistSeam = Object.freeze({ split: split, splitSide: splitSide, CLOSE_DARTS: Object.freeze(deepClone(CLOSE_DARTS)) });
})();
