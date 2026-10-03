// ═══════════════════════════════════════════════════════════
// designPrincess.js — [패턴학교] 프린세스 라인 Ⓔ(P.18)의 **순수 geometry 연산**.
//
//   교재 문장: «허리 다트 a, e 를 옆쪽으로 이동해 선의 흐름이 아름답다. 옆선도 1cm 줄인다.» + 처리 방법 «닫는다»(P.160, Ⓔ 를 예제로 설명):
//   앞·옆 조각의 AH 다트 아래 부분을 본뜨고, **다트 끝(BP)을 고정**해 종이를 회전시켜 AH 다트 위쪽 선에 겹친다.
//
// 입력  designBodice.computeGeometry 가 만든 front / back piece({outline, construction}) — Ⓒ 몸판(허리 다트 a·e 만, 옆선 −1·밑단 +1).
//       앞은 열린 AH 다트 `front-bust` + 허리 다트 `front-waist-a`, 뒤는 열린 어깨 다트 `back-shoulder` + 허리 다트 `back-waist-e`.
// 출력  frontCenter / frontSide / backCenter / backSide = **별개 폐곡선 조각 네 장** + 검산 메타. front/back(전체 몸판)은 건드리지 않는다.
//
// ★ 잠긴 결정(2026-10-03, 사용자 확정 — 도해 실측 기준, 해석이 아니다) ★
//   1. **앞 어깨 절개 시작점 = 목점(NP)에서 어깨선 호길이 50%.**
//   2. **어깨→BP 이음선 = 기준 직선(어깨 시작점→BP)에서 도해 방향(= 앞중심 반대, 진동 쪽)으로 최대 0.5cm 볼록한 완만한 곡선.**
//      (대칭 제어점 3차 베지어, 최대 편차는 정확히 0.5cm 이며 중점에서 난다.)
//   3. **뒤 이음선은 기존 어깨 다트 입구에서 시작한다.** 중심 쪽 조각은 다트의 중심 쪽 다리를, 옆 조각은 진동 쪽 다리를 이음선으로 갖고(다트가
//      이음선에 흡수된다), 다트 끝 아래는 하나의 수직선이다.
//   4. **허리 다트의 마름모(a·e)는 이음선 축에 맞춘다.** 축 x = 위쪽 다트의 끝(앞 BP · 뒤 어깨 다트 끝)의 x. a·e 의 중심을 그 축으로 옮기고(앞 a 는
//      이미 BP 와 같은 x — 이동 0, 뒤 e 는 옆쪽으로 이동), 마름모는 다트 끝에서 WL 의 다트 폭까지 벌어졌다 밑단(축 위 한 점)에서 닫힌다.
//   5. **닫는다 = 앞 AH 다트만, BP 고정 기본 다트각(B83 에서 18.25°)으로 닫는다.** 옆 조각의 BP 위쪽(어깨·진동 윗부분·이음선 위쪽)이 회전하고
//      아래쪽은 제자리다(P.160 의 «나머지를 본뜬다»). 닫힌 V 의 두 다리는 어디에도 남기지 않는다(닫힌 다트 = 과거 흔적).
//   6. **어깨 재작도**: 강체 회전은 어깨 길이와 각도를 보존하므로 봉제 정렬 프레임(옆 조각을 BP 축으로 다시 열어 이음선을 맞춘 상태)에서 중심·옆 어깨선은
//      한 직선이고(꺾임 0) 길이의 합은 원래 어깨 길이와 같다 — 끊긴 곳도 겹침도 없다. 닫은 평면 배치에서 옆 조각 어깨 끝이 θ 만큼 벌어져 보이는 것은
//      다트 분량이 이음선으로 옮겨 간 결과다. 이를 meta.front.shoulder 에 수치로 기록하고 체크포인트가 다시 계산해 대조한다.
//   7. 두 조각이 마주 닿는 이음선의 **길이는 앞은 정확히 같고**(강체 회전) 뒤는 어깨 다트 두 다리 길이 차(≈0.10cm, 문서화된 잔여)만큼 다르다.
//
// 원자성·순수성: 입력 불변(deepClone), 실패는 reason 을 단 Error throw(부분 결과 없음), DOM·storage·render 미접근, 결정론.
//   designLineTool·designJoin 의 순수 헬퍼만 쓴다(그 둘 **다음에** 로드). 어떤 기존 모듈의 계약도 넓히지 않았다.
// ═══════════════════════════════════════════════════════════
(function () {
  "use strict";

  var CLOSE_EPS = 1e-4;       // 폐곡선 연속성 허용오차(designJoin·designLineTool 과 같은 계약)
  var MIN_AREA = 0.01;        // cm²
  var SEAM_TOL = 1e-6;        // 앞 이음 길이 정합 허용(cm) — 강체 회전이라 사실상 0
  var LEG_TOL = 0.2;          // 다트 두 다리 길이 차 허용(cm) — 뒤 어깨 다트의 문서화된 ≈0.10 을 포함
  var AREA_TOL = 0.05;        // 면적 보존 허용(cm²)
  var ON_EDGE = 1e-5;         // 점이 변 위에 있다고 보는 허용(cm) — 조각 겹침 판정의 경계 접촉
  var SHOULDER_RATIO = 0.5;   // 잠긴 결정 1
  var BULGE_CM = 0.5;         // 잠긴 결정 2
  var FRONT_AH = "front-bust", BACK_SH = "back-shoulder", FRONT_WAIST = "front-waist-a", BACK_WAIST = "back-waist-e";

  function fail(reason, detail) {
    var e = new Error("designPrincess: " + reason);
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
    if (!j || typeof j.toGeomPrim !== "function") fail("designJoin-missing");
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
  var clone = function (seg) { return T().subSegment(seg, 0, 1); };
  var rev = function (seg) { return T().reverseSeg(seg); };

  // ── 평탄화·면적·자기교차(designLineTool 의 순수 헬퍼 위에서) ──
  function flatPairs(segs) {
    var t = T(), f = [];
    segs.forEach(function (s) { t.flattenLine([s]).forEach(function (ab) { f.push(ab); }); });
    return f;
  }
  function flatPts(segs) {
    var pts = [];
    flatPairs(segs).forEach(function (ab) { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); });
    return pts;
  }
  function signedArea(segs) {
    var pts = flatPts(segs), a = 0;
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
  // 점이 평탄화 다각형의 변 위(허용 안)인지 / 엄격히 안쪽인지 — 두 조각의 겹침(경계 접촉은 겹침이 아니다) 판정.
  function onBoundary(p, pts) {
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      var u = L2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
      if (Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy)) <= ON_EDGE) return true;
    }
    return false;
  }
  function pip(p, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
    }
    return inside;
  }
  function strictlyInside(p, pts) { return !onBoundary(p, pts) && pip(p, pts); }
  // 두 폐곡선 조각이 겹치는가(변이 서로 가로지르거나 한쪽 점이 다른 쪽 엄격히 안쪽). 경계가 닿는 것(이음선·점 접촉)은 겹침이 아니다.
  function piecesOverlap(a, b) {
    var t = T(), fa = flatPairs(a), fb = flatPairs(b);
    var touch = function (u, v) { return dist(u, v) < 1e-6; };
    for (var i = 0; i < fa.length; i++) for (var j = 0; j < fb.length; j++) {
      if (!t.segCross(fa[i][0], fa[i][1], fb[j][0], fb[j][1])) continue;
      if (touch(fa[i][0], fb[j][0]) || touch(fa[i][0], fb[j][1]) || touch(fa[i][1], fb[j][0]) || touch(fa[i][1], fb[j][1])) continue;
      return true;
    }
    var pa = flatPts(a), pb = flatPts(b);
    return pa.some(function (p) { return strictlyInside(p, pb); }) || pb.some(function (p) { return strictlyInside(p, pa); });
  }

  // ── 강체 회전 ──
  function rotPt(p, o, th) {
    var c = Math.cos(th), s = Math.sin(th), dx = p.x - o.x, dy = p.y - o.y;
    return { x: o.x + dx * c - dy * s, y: o.y + dx * s + dy * c };
  }
  function rotSeg(seg, o, th) {
    var q = clone(seg);
    ["from", "to", "c1", "c2"].forEach(function (k) { if (q[k]) q[k] = rotPt(q[k], o, th); });
    return q;
  }

  // ── 원래 path 프리미티브 복원(designYokeSeam.toPrims 와 같은 계약 — 그쪽은 export 하지 않으므로 복제) ──
  function sameCubic(a, b) {
    if (a.kind !== "cubic" || b.kind !== "cubic") return false;
    return ["from", "c1", "c2", "to"].every(function (k) { return near(a[k], b[k], 1e-6); });
  }
  function toPrims(segs, originals) {
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
        var fwd = true, rv = true;
        for (var q = 0; q < k; q++) {
          if (!sameCubic(segs[i + q], cs[q])) fwd = false;
          if (!sameCubic(segs[i + q], t.reverseSeg(cs[k - 1 - q]))) rv = false;
        }
        if (fwd || rv) hit = { prim: multi[m].prim, k: k };
      }
      if (hit) { out.push(deepClone(hit.prim)); i += hit.k; }
      else { out.push(Jn.toGeomPrim(segs[i])); i++; }
    }
    return out;
  }

  // ── 공용 ──
  function legsOf(piece, dartId, side) {
    var legs = (piece.construction || []).filter(function (s) { return s && s.dart && s.dart.id === dartId; });
    if (legs.length !== 2) fail("dart-missing", { side: side, dartId: dartId, found: legs.length });
    return legs;
  }
  var apexOf = function (s) { return s.dart.apexAt === "to" ? s.to : s.from; };
  var footOf = function (s) { return s.dart.apexAt === "to" ? s.from : s.to; };
  function apexOfLegs(legs, id) {
    var a = P(apexOf(legs[0]));
    if (!near(a, apexOf(legs[1]), 1e-6)) fail("dart-apex-mismatch", id);
    return a;
  }
  // 링의 열린 다트 다리 두 개를 맨 뒤로 보낸다(다리 다음 요소부터 시작). 반환: 복제된 {seg, source} 배열.
  function ringLegsLast(ring, side) {
    var n = ring.length, at = -1;
    for (var i = 0; i < n; i++) {
      if (ring[i].source === "dartleg" && ring[(i + 1) % n].source === "dartleg" && ring[(i + 2) % n].source !== "dartleg" && ring[(i + n - 1) % n].source !== "dartleg") at = i;
    }
    if (at < 0) fail("dart-legs-layout", { side: side });
    var order = ring.slice(at + 2).concat(ring.slice(0, at + 2));
    return order.map(function (r) { return { seg: clone(r.seg), source: r.source }; });
  }
  function indexOfEdge(ring, edge, side) {
    var hits = [];
    ring.forEach(function (r, i) { if (r.source === "outline" && r.seg.edge === edge) hits.push(i); });
    if (hits.length !== 1) fail("edge-count", { side: side, edge: edge, count: hits.length });
    return hits[0];
  }
  // 이음선 가장자리 한 줄: princess-seam 태그(조각 구분은 seam: center|side)
  var seamLine = function (a, b, which) { return line(a, b, { edge: "princess-seam", seam: which }); };
  function seamCubic(c, which) { var s = clone(c); s.edge = "princess-seam"; s.seam = which; return s; }

  // 어깨→BP 곡선: p0→p3 기준 직선에서 nHat 쪽으로 최대 BULGE_CM(중점) 볼록한 대칭 제어점 3차 베지어.
  function bulgeCurve(p0, p3, nHat, maxCm) {
    var h = maxCm / 0.75;   // 대칭 제어점 → 편차 3t(1−t)·h, 최대(t=½) 0.75h
    var k = function (f) { return { x: p0.x + (p3.x - p0.x) * f + nHat.x * h, y: p0.y + (p3.y - p0.y) * f + nHat.y * h }; };
    return { kind: "cubic", from: P(p0), c1: k(1 / 3), c2: k(2 / 3), to: P(p3) };
  }
  function maxDeviation(c, nHat, p0) {   // 곡선의 p0→p3 직선에 대한 nHat 방향 최대 편차(검산)
    var best = -Infinity;
    for (var i = 0; i <= 200; i++) {
      var t = i / 200, u = 1 - t;
      var x = u * u * u * c.from.x + 3 * u * u * t * c.c1.x + 3 * u * t * t * c.c2.x + t * t * t * c.to.x;
      var y = u * u * u * c.from.y + 3 * u * u * t * c.c1.y + 3 * u * t * t * c.c2.y + t * t * t * c.to.y;
      var d = (x - p0.x) * nHat.x + (y - p0.y) * nHat.y;
      if (d > best) best = d;
    }
    return best;
  }

  // 허리 다트(a·e): 축 x 로 옮기고 마름모 점들을 만든다. 반환 {apex, footC, footS, width, shift, centerBefore}
  function waistDiamond(wLegs, axisX, cx, hemY, side) {
    var apex = apexOfLegs(wLegs, side + ":waist-dart");
    var f1 = P(footOf(wLegs[0])), f2 = P(footOf(wLegs[1]));
    if (Math.abs(f1.y - f2.y) > 1e-6) fail("waist-dart-feet", side);
    var centerBefore = (f1.x + f2.x) / 2, shift = axisX - centerBefore;
    var a = { x: f1.x + shift, y: f1.y }, b = { x: f2.x + shift, y: f2.y };
    var footC = Math.abs(a.x - cx) <= Math.abs(b.x - cx) ? a : b, footS = footC === a ? b : a;
    if (!(Math.abs(footC.x - footS.x) > 1e-6)) fail("waist-dart-width", side);
    if (!(hemY > f1.y + 1e-6)) fail("waist-dart-below-hem", side);
    return { apex: { x: axisX, y: apex.y }, footC: footC, footS: footS, width: Math.abs(footC.x - footS.x), shift: shift, centerBefore: centerBefore, hem: { x: axisX, y: hemY } };
  }

  // 구성선 배분: 허리선(role:"waist")은 마름모 발에서 둘로 가르고, 나머지는 중점이 든 조각으로 보낸다. 다트 a·e/흡수한 다트 다리는 버린다(윤곽이 됐다).
  function distributeConstruction(piece, skipIds, dia, cx, centerLoop, sideLoop) {
    var cPts = flatPts(centerLoop), sPts = flatPts(sideLoop), cen = [], sid = [], dropped = [];
    (piece.construction || []).forEach(function (s) {
      if (!s) return;
      if (s.dart && skipIds.indexOf(s.dart.id) >= 0) return;
      var c = deepClone(s);
      if ((s.role === "waist" || s.edge === "waist") && s.kind === "line") {
        var cEnd = Math.abs(s.from.x - cx) <= Math.abs(s.to.x - cx) ? "from" : "to", sEnd = cEnd === "from" ? "to" : "from";
        var cp = deepClone(s), sp = deepClone(s);
        cp[cEnd] = P(s[cEnd]); cp[sEnd] = P(dia.footC);
        sp[sEnd] = P(s[sEnd]); sp[cEnd] = P(dia.footS);
        cen.push(cp); sid.push(sp);
        return;
      }
      var mid = { x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2 };
      if (strictlyInside(mid, cPts) || onBoundary(mid, cPts)) cen.push(c);
      else if (strictlyInside(mid, sPts) || onBoundary(mid, sPts)) sid.push(c);
      else dropped.push(s.dart && s.dart.id || s.role || "?");
    });
    return { center: cen, side: sid, dropped: dropped };
  }

  // ══ 앞(Ⓔ) ═══════════════════════════════════════════════════════════════
  //   절개선: 어깨 위 한 점 S0(목점에서 호길이 50%) → 곡선 → BP → (수직) 마름모 a → 밑단. 옆 조각의 BP 위쪽을 회전해 AH 다트를 닫는다.
  function splitFront(piece, opts) {
    var t = T();
    if (!piece || !Array.isArray(piece.outline) || !Array.isArray(piece.construction)) fail("invalid-geometry", "front");
    var ratio = (opts && opts.shoulderRatio != null) ? opts.shoulderRatio : SHOULDER_RATIO;
    var bulge = (opts && opts.bulgeCm != null) ? opts.bulgeCm : BULGE_CM;
    if (!(ratio > 0 && ratio < 1) || !(bulge >= 0 && isFinite(bulge))) fail("invalid-option", { shoulderRatio: ratio, bulgeCm: bulge });
    var ahLegs = legsOf(piece, FRONT_AH, "front"), wLegs = legsOf(piece, FRONT_WAIST, "front");
    var BP = apexOfLegs(ahLegs, FRONT_AH);
    var rb = t.buildPieceRing(t.outlinePrimsToSegs(piece.outline), ahLegs);
    if (!rb.ok) fail("ring-failed", rb.reason);
    var ring = ringLegsLast(rb.ring, "front"), n = ring.length;
    var legL = ring[n - 2].seg, legU = ring[n - 1].seg;                       // M_l→BP, BP→M_u
    if (!near(legL.to, BP, 1e-6) || !near(legU.from, BP, 1e-6)) fail("dart-apex-mismatch", "front:ring");
    var Ml = P(legL.from), Mu = P(legU.to);

    // 어깨 한 점 S0(NP 에서 호길이 ratio) / 밑단 한 점 H(축 x)
    var iSh = indexOfEdge(ring, "shoulder", "front"), iHem = indexOfEdge(ring, "hem", "front");
    var sh = ring[iSh].seg, hemSeg = ring[iHem].seg;
    if (sh.kind !== "line") fail("shoulder-not-line", "front");
    var npAtTo = !!(ring[(iSh + 1) % n].seg.edge === "neckline");
    if (!npAtTo && ring[(iSh + n - 1) % n].seg.edge !== "neckline") fail("shoulder-neck-adjacent", "front");
    var tS = npAtTo ? 1 - ratio : ratio;                                         // 선분 파라미터 상의 S0 (직선이므로 호길이 = 선분 비율)
    var S0 = { x: sh.from.x + (sh.to.x - sh.from.x) * tS, y: sh.from.y + (sh.to.y - sh.from.y) * tS };
    var NP = npAtTo ? P(sh.to) : P(sh.from), SP = npAtTo ? P(sh.from) : P(sh.to);
    var cxEdge = null;
    ring.forEach(function (r) { if (r.source === "outline" && r.seg.edge === "center" && cxEdge == null) cxEdge = r.seg.from.x; });
    if (cxEdge == null) fail("center-edge-missing", "front");
    var axisX = BP.x;
    if (Math.abs(hemSeg.from.y - hemSeg.to.y) > 1e-6) fail("hem-not-horizontal", "front");
    var tH = (axisX - hemSeg.from.x) / (hemSeg.to.x - hemSeg.from.x);
    if (!(tH > 1e-6 && tH < 1 - 1e-6)) fail("axis-outside-hem", { axisX: axisX });
    var dia = waistDiamond(wLegs, axisX, cxEdge, hemSeg.from.y, "front");
    if (!(dia.apex.y > BP.y + 1e-6)) fail("waist-apex-above-bp", { bpY: BP.y, apexY: dia.apex.y });
    var H = dia.hem;

    // 링을 S0·H 에서 쪼갠다 → 중심 경로(S0→…→H)와 옆 경로(H→…→S0)
    var shA = t.subSegment(sh, 0, tS), shB = t.subSegment(sh, tS, 1), hemA = t.subSegment(hemSeg, 0, tH), hemB = t.subSegment(hemSeg, tH, 1);
    var split = ring.slice(0, iSh).concat([{ seg: shA, source: "outline" }, { seg: shB, source: "outline" }]);
    split = split.concat(ring.slice(iSh + 1, iHem), [{ seg: hemA, source: "outline" }, { seg: hemB, source: "outline" }], ring.slice(iHem + 1));
    var iB = split.findIndex(function (r) { return r.seg === shB; }), iHB = split.findIndex(function (r) { return r.seg === hemB; });
    var centerPath = split.slice(iB, iHB).map(function (r) { return r.seg; });
    var sidePath = split.slice(iHB).concat(split.slice(0, iB));
    if (!(iB >= 0 && iHB > iB)) fail("ring-layout", "front");
    if (centerPath.some(function (s) { return s.edge === "armhole" || s.edge === "side-seam"; }) || !centerPath.some(function (s) { return s.edge === "center"; })) fail("ring-layout", "front:center");
    var iLegL = sidePath.findIndex(function (r) { return r.source === "dartleg"; });
    if (!(iLegL > 0 && sidePath[iLegL + 1] && sidePath[iLegL + 1].source === "dartleg" && iLegL + 4 === sidePath.length)) fail("ring-layout", "front:side");   // …leg, leg, armhole(upper), shoulder(A)

    // 닫는 각: 위쪽 다리(BP→M_u)를 아래쪽 다리(BP→M_l) 위로 — 위쪽 부분이 −θ 만큼 회전
    var aL = Math.atan2(Ml.y - BP.y, Ml.x - BP.x), aU = Math.atan2(Mu.y - BP.y, Mu.x - BP.x), theta = aL - aU;
    while (theta > Math.PI) theta -= 2 * Math.PI;
    while (theta <= -Math.PI) theta += 2 * Math.PI;
    if (!(Math.abs(theta) > 1e-6) || Math.abs(theta) >= Math.PI / 2) fail("dart-angle-range", { side: "front", deg: theta * 180 / Math.PI });
    var lenL = dist(Ml, BP), lenU = dist(Mu, BP), residual = Math.abs(lenL - lenU);
    if (residual > LEG_TOL) fail("dart-leg-length-mismatch", { side: "front", legCm: [lenL, lenU] });

    // 이음선(위쪽 곡선 + 수직 + 마름모)
    var d = { x: (BP.x - S0.x), y: (BP.y - S0.y) }, Lc = Math.hypot(d.x, d.y);
    if (!(Lc > 1e-6)) fail("seam-degenerate", "front");
    d.x /= Lc; d.y /= Lc;
    var nHat = { x: -d.y, y: d.x };
    if (nHat.x * (cxEdge - S0.x) > 0) nHat = { x: -nHat.x, y: -nHat.y };         // 앞중심에서 먼 쪽(진동 쪽)
    var C = bulgeCurve(S0, BP, nHat, bulge);
    var devMax = maxDeviation(C, nHat, S0);
    var lowerC = [seamLine(BP, dia.apex, "center"), seamLine(dia.apex, dia.footC, "center"), seamLine(dia.footC, H, "center")];
    var lowerS = [seamLine(BP, dia.apex, "side"), seamLine(dia.apex, dia.footS, "side"), seamLine(dia.footS, H, "side")];
    var seamCenter = [seamCubic(C, "center")].concat(lowerC);
    var Crot = rotSeg(seamCubic(C, "side"), BP, theta);
    var seamSide = [Crot].concat(lowerS);

    // 중심 조각: centerPath + 이음선(H→S0)
    var centerSegs = centerPath.map(clone);
    for (var ci = seamCenter.length - 1; ci >= 0; ci--) centerSegs.push(rev(seamCenter[ci]));
    // 옆 조각: 다리 앞까지 + (연결) + 회전한 윗부분 + 이음선(S0'→H)
    var pre = sidePath.slice(0, iLegL).map(function (r) { return clone(r.seg); });
    var upper = [rotSeg(sidePath[iLegL + 2].seg, BP, theta), rotSeg(sidePath[iLegL + 3].seg, BP, theta)];   // sidePath = […, legL, legU, armU, shA] → rot(armU), rot(shA)
    var MuRot = rotPt(Mu, BP, theta), conn = [];
    if (dist(Ml, MuRot) > 1e-9) { var cs = line(Ml, MuRot, { edge: "armhole", closedDart: FRONT_AH }); conn.push(cs); }
    var sideSegs = pre.concat(conn, upper, seamSide.map(clone));
    [centerSegs, sideSegs].forEach(function (arr) { for (var g = 0; g < arr.length; g++) arr[(g + 1) % arr.length].from = P(arr[g].to); });   // 회전 오차 제거(연속)
    var S0Rot = P(seamSide[0].from);

    // 검증
    var areaC = checkClosed(centerSegs, "front:center"), areaS = checkClosed(sideSegs, "front:side");
    var lenCenter = segsLen(seamCenter), lenSide = segsLen(seamSide);
    if (Math.abs(lenCenter - lenSide) > SEAM_TOL) fail("seam-length-mismatch", { side: "front", centerCm: lenCenter, sideCm: lenSide });
    var areaIn = Math.abs(signedArea(rb.ring.map(function (r) { return r.seg; })));
    var diamond = 0.5 * dia.width * (H.y - dia.apex.y);
    if (Math.abs(areaC + areaS - (areaIn - diamond)) > AREA_TOL) fail("area-not-conserved", { side: "front", centerCm2: areaC, sideCm2: areaS, inputCm2: areaIn, diamondCm2: diamond });
    if (piecesOverlap(centerSegs, sideSegs)) fail("pieces-overlap", "front");
    var shoulderSeg = sideSegs.filter(function (s) { return s.edge === "shoulder"; });
    var centerSh = centerSegs.filter(function (s) { return s.edge === "shoulder"; });
    if (shoulderSeg.length !== 1 || centerSh.length !== 1) fail("shoulder-missing", "front");
    // 어깨: 봉제 정렬 프레임(옆 조각 윗부분을 BP 축으로 +θ 되돌림)에서 중심·옆 어깨선의 직선 연속 · 길이 합
    var back0 = rotPt(shoulderSeg[0].from, BP, -theta), back1 = rotPt(shoulderSeg[0].to, BP, -theta);
    var uC = { x: centerSh[0].to.x - centerSh[0].from.x, y: centerSh[0].to.y - centerSh[0].from.y }, uS = { x: back1.x - back0.x, y: back1.y - back0.y };
    var kink = Math.abs(Math.atan2(uC.x * uS.y - uC.y * uS.x, uC.x * uS.x + uC.y * uS.y)) * 180 / Math.PI;   // 같은 방향이면 0
    var shLenC = dist(centerSh[0].from, centerSh[0].to), shLenS = dist(shoulderSeg[0].from, shoulderSeg[0].to), shOrig = dist(sh.from, sh.to);
    if (!(Math.abs(shLenC + shLenS - shOrig) <= 1e-6) || !(kink <= 1e-6 || Math.abs(kink - 180) <= 1e-6)) fail("shoulder-continuity", { kinkDeg: kink, sumCm: shLenC + shLenS, originalCm: shOrig });
    var hemW = function (segs) { return segs.filter(function (s) { return s.edge === "hem"; }).reduce(function (a, s) { return a + dist(s.from, s.to); }, 0); };
    if (Math.abs(hemW(centerSegs) + hemW(sideSegs) - dist(hemSeg.from, hemSeg.to)) > 1e-6) fail("hem-width-changed", "front");

    var cons = distributeConstruction(piece, [FRONT_AH, FRONT_WAIST], dia, cxEdge, centerSegs, sideSegs);
    var meta = {
      side: "front",
      seamPoints: { shoulder: P(S0), shoulderAfterClose: S0Rot, bp: P(BP), waistApex: P(dia.apex), waistCenter: P(dia.footC), waistSide: P(dia.footS), hem: P(H), np: NP, sp: SP, axisX: axisX },
      shoulderRatio: ratio, shoulderFromNpCm: dist(NP, S0),
      bulge: { maxCm: devMax, wantCm: bulge, direction: "armhole" },
      seamLenCenterCm: lenCenter, seamLenSideCm: lenSide, seamDeltaCm: lenCenter - lenSide,
      closedDart: { id: FRONT_AH, apex: P(BP), angleDeg: Math.abs(theta) * 180 / Math.PI, thetaRad: theta, mouths: [P(Ml), P(Mu)], legLenCm: [lenL, lenU], residualStepCm: residual, rotated: "side-upper" },
      waistDart: { id: FRONT_WAIST, widthCm: dia.width, shiftCm: dia.shift, centerBeforeCm: dia.centerBefore, apexY: dia.apex.y },
      shoulder: { lenCenterCm: shLenC, lenSideCm: shLenS, totalCm: shLenC + shLenS, originalCm: shOrig, kinkAlignedDeg: kink > 90 ? 180 - kink : kink, openGapCm: dist(S0, S0Rot) },
      areaCenterCm2: areaC, areaSideCm2: areaS, areaInputCm2: areaIn, areaDiamondCm2: diamond,
      droppedConstruction: cons.dropped
    };
    return {
      center: { outline: toPrims(centerSegs, piece.outline), construction: cons.center },
      side: { outline: toPrims(sideSegs, piece.outline), construction: cons.side },
      meta: meta
    };
  }

  // ══ 뒤(Ⓔ) ═══════════════════════════════════════════════════════════════
  //   이음선: 어깨 다트 입구에서 시작 → 다트 다리(중심 조각 = 중심 쪽 다리, 옆 조각 = 진동 쪽 다리) → 다트 끝 → 수직 → 마름모 e → 밑단.
  function splitBack(piece, opts) {
    var t = T();
    if (!piece || !Array.isArray(piece.outline) || !Array.isArray(piece.construction)) fail("invalid-geometry", "back");
    var shLegs = legsOf(piece, BACK_SH, "back"), wLegs = legsOf(piece, BACK_WAIST, "back");
    var A1 = apexOfLegs(shLegs, BACK_SH);
    var rb = t.buildPieceRing(t.outlinePrimsToSegs(piece.outline), shLegs);
    if (!rb.ok) fail("ring-failed", rb.reason);
    var ring = ringLegsLast(rb.ring, "back"), n = ring.length;
    var legA = ring[n - 2].seg, legB = ring[n - 1].seg;                       // M_a→apex(진동 쪽 입구), apex→M_b(중심 쪽 입구)
    if (!near(legA.to, A1, 1e-6) || !near(legB.from, A1, 1e-6)) fail("dart-apex-mismatch", "back:ring");
    var Ma = P(legA.from), Mb = P(legB.to);
    var iHem = indexOfEdge(ring, "hem", "back");
    var hemSeg = ring[iHem].seg;
    var cxEdge = null;
    ring.forEach(function (r) { if (r.source === "outline" && r.seg.edge === "center" && cxEdge == null) cxEdge = r.seg.from.x; });
    if (cxEdge == null) fail("center-edge-missing", "back");
    if (!(Math.abs(Mb.x - cxEdge) < Math.abs(Ma.x - cxEdge))) fail("dart-mouth-order", "back");   // 링 맨 앞 어깨가 중심 쪽 입구에서 시작해야 한다
    var axisX = A1.x;
    if (Math.abs(hemSeg.from.y - hemSeg.to.y) > 1e-6) fail("hem-not-horizontal", "back");
    var tH = (axisX - hemSeg.from.x) / (hemSeg.to.x - hemSeg.from.x);
    if (!(tH > 1e-6 && tH < 1 - 1e-6)) fail("axis-outside-hem", { axisX: axisX });
    var dia = waistDiamond(wLegs, axisX, cxEdge, hemSeg.from.y, "back");
    if (!(dia.apex.y > A1.y + 1e-6)) fail("waist-apex-above-shoulder-apex", { shoulderApexY: A1.y, apexY: dia.apex.y });
    var H = dia.hem;
    var lenA = dist(Ma, A1), lenB = dist(Mb, A1), legDiff = Math.abs(lenA - lenB);
    if (legDiff > LEG_TOL) fail("dart-leg-length-mismatch", { side: "back", legCm: [lenA, lenB] });

    var hemA = t.subSegment(hemSeg, 0, tH), hemB = t.subSegment(hemSeg, tH, 1);
    var split = ring.slice(0, iHem).concat([{ seg: hemA, source: "outline" }, { seg: hemB, source: "outline" }], ring.slice(iHem + 1));
    var iHB = split.findIndex(function (r) { return r.seg === hemB; });
    var centerPath = split.slice(0, iHB).map(function (r) { return r.seg; });
    var sidePath = split.slice(iHB, split.length - 2).map(function (r) { return r.seg; });   // 다리 두 개 제외
    if (!centerPath.some(function (s) { return s.edge === "center"; }) || centerPath.some(function (s) { return s.edge === "armhole" || s.edge === "side-seam"; })) fail("ring-layout", "back:center");
    if (!sidePath.some(function (s) { return s.edge === "armhole"; }) || sidePath.some(function (s) { return s.edge === "center"; })) fail("ring-layout", "back:side");
    if (!near(centerPath[0].from, Mb, 1e-6) || !near(sidePath[sidePath.length - 1].to, Ma, 1e-6)) fail("ring-layout", "back:ends");

    var A2 = dia.apex;   // (축 x, e 끝 y)
    var seamCenter = [seamLine(Mb, A1, "center"), seamLine(A1, A2, "center"), seamLine(A2, dia.footC, "center"), seamLine(dia.footC, H, "center")];
    var seamSide = [seamLine(Ma, A1, "side"), seamLine(A1, A2, "side"), seamLine(A2, dia.footS, "side"), seamLine(dia.footS, H, "side")];
    var centerSegs = centerPath.map(clone);
    for (var ci = seamCenter.length - 1; ci >= 0; ci--) centerSegs.push(rev(seamCenter[ci]));
    var sideSegs = sidePath.map(clone).concat(seamSide.map(clone));
    [centerSegs, sideSegs].forEach(function (arr) { for (var g = 0; g < arr.length; g++) arr[(g + 1) % arr.length].from = P(arr[g].to); });

    var areaC = checkClosed(centerSegs, "back:center"), areaS = checkClosed(sideSegs, "back:side");
    var lenCenter = segsLen(seamCenter), lenSide = segsLen(seamSide);
    if (Math.abs(Math.abs(lenCenter - lenSide) - legDiff) > 1e-6) fail("seam-length-mismatch", { side: "back", centerCm: lenCenter, sideCm: lenSide, legDiffCm: legDiff });
    var areaIn = Math.abs(signedArea(rb.ring.map(function (r) { return r.seg; })));
    var diamond = 0.5 * dia.width * (H.y - A2.y);
    if (Math.abs(areaC + areaS - (areaIn - diamond)) > AREA_TOL) fail("area-not-conserved", { side: "back", centerCm2: areaC, sideCm2: areaS, inputCm2: areaIn, diamondCm2: diamond });
    if (piecesOverlap(centerSegs, sideSegs)) fail("pieces-overlap", "back");
    var hemW = function (segs) { return segs.filter(function (s) { return s.edge === "hem"; }).reduce(function (a, s) { return a + dist(s.from, s.to); }, 0); };
    if (Math.abs(hemW(centerSegs) + hemW(sideSegs) - dist(hemSeg.from, hemSeg.to)) > 1e-6) fail("hem-width-changed", "back");
    var shLen = function (segs) { return segs.filter(function (s) { return s.edge === "shoulder"; }).reduce(function (a, s) { return a + dist(s.from, s.to); }, 0); };
    var shOrig = ring.filter(function (r) { return r.source === "outline" && r.seg.edge === "shoulder"; }).reduce(function (a, r) { return a + dist(r.seg.from, r.seg.to); }, 0);
    if (Math.abs(shLen(centerSegs) + shLen(sideSegs) - shOrig) > 1e-6) fail("shoulder-length-changed", "back");

    var cons = distributeConstruction(piece, [BACK_SH, BACK_WAIST], dia, cxEdge, centerSegs, sideSegs);
    var meta = {
      side: "back",
      seamPoints: { mouthCenter: P(Mb), mouthSide: P(Ma), shoulderApex: P(A1), waistApex: P(A2), waistCenter: P(dia.footC), waistSide: P(dia.footS), hem: P(H), axisX: axisX },
      seamLenCenterCm: lenCenter, seamLenSideCm: lenSide, seamDeltaCm: lenCenter - lenSide,
      absorbedDart: { id: BACK_SH, apex: P(A1), mouths: [P(Ma), P(Mb)], mouthWidthCm: dist(Ma, Mb), legLenCm: [lenA, lenB], residualStepCm: legDiff },
      waistDart: { id: BACK_WAIST, widthCm: dia.width, shiftCm: dia.shift, centerBeforeCm: dia.centerBefore, apexY: A2.y },
      shoulder: { lenCenterCm: shLen(centerSegs), lenSideCm: shLen(sideSegs), totalCm: shLen(centerSegs) + shLen(sideSegs), originalCm: shOrig },
      areaCenterCm2: areaC, areaSideCm2: areaS, areaInputCm2: areaIn, areaDiamondCm2: diamond,
      droppedConstruction: cons.dropped
    };
    return {
      center: { outline: toPrims(centerSegs, piece.outline), construction: cons.center },
      side: { outline: toPrims(sideSegs, piece.outline), construction: cons.side },
      meta: meta
    };
  }

  // split({front, back}, opts) → { frontCenter, frontSide, backCenter, backSide, meta:{ variant:"E", front, back } }
  // 원자적: 앞·뒤 중 하나라도 실패하면 아무것도 반환하지 않는다. 입력은 변형하지 않는다.
  function split(geometry, opts) {
    if (!geometry || typeof geometry !== "object" || !geometry.front || !geometry.back) fail("invalid-geometry");
    var f = splitFront(deepClone(geometry.front), opts);
    var b = splitBack(deepClone(geometry.back), opts);
    return { frontCenter: f.center, frontSide: f.side, backCenter: b.center, backSide: b.side, meta: { variant: "E", front: f.meta, back: b.meta } };
  }

  window.designPrincess = Object.freeze({ split: split, splitFront: splitFront, splitBack: splitBack,
    SHOULDER_RATIO: SHOULDER_RATIO, BULGE_CM: BULGE_CM, DARTS: Object.freeze({ frontAh: FRONT_AH, backShoulder: BACK_SH, frontWaist: FRONT_WAIST, backWaist: BACK_WAIST }) });
})();
