// ═══════════════════════════════════════════════════════════
// designYokeSeam.js — [패턴학교] 요크 이음선 ① Ⓠ(P.30)의 **순수 geometry 연산**.
//
//   교재 문장: «이음선을 넣고 밑단에서 1cm 추가. 어깨와 앞뒤 중심에 이음선을 넣는다.
//   앞 몸판은 AH 다트를 닫는다.» / 주의: «이음선의 위치는 몸판 Ⓐ 의 다트 끝.»
//
// 입력  designBodice.computeGeometry 가 만든 front / back piece({outline, construction}).
//       열린 다트가 정확히 하나(앞 AH 다트 `front-bust` · 뒤 어깨 다트 `back-shoulder`)인 박시 몸판.
//       밑단 옆선 +1cm 는 입력 몸판(Ⓑ: hemSideOffsetCm:1)이 이미 갖고 있고 이 모듈은 **검증만** 한다.
// 출력  frontYoke / frontBody / backYoke / backBody = **별개 폐곡선 조각 네 장**(요크는 어깨에서
//       앞뒤를 합치지 않는다) + 검산 메타.
//
// ★ 잠긴 결정(2026-09-30, 사용자 승인 — 해석이 아니다) ★
//   1. 이음선은 앞·뒤 각각 **다트 끝(apex)을 지나는 수평선**이다 — 교재의 설명 없는 «11» 은 쓰지 않는다.
//      좌표는 다트 apex y 하나뿐이다.
//   2. 앞 요크와 뒤 요크는 어깨에서 합치지 않는다(별도 조각).
//   3. 앞 AH 다트 / 4. 뒤 어깨 다트는 **이음선으로 전량 흡수**한다.
//   5. 앞 3cm · 뒤 2cm 이동 조정은 이번 기본형에 없다. 6. 밑단 +1cm 는 앞·뒤 각각 옆선 방향.
//
// ★ 다트 흡수 = apex 를 축으로 한 강체 회전(다트 wedge 가 접혀 사라진다). apex 가 이음선 위에 있으므로
//   요크 이음선 가장자리는 `앞/뒤중심 → apex → 옆쪽` 으로 apex 에서 다트각만큼 꺾인다.
//   회전하는 쪽은 옆쪽(진동 쪽) 호(다트 입 → 이음선 옆 끝)이고 중심 쪽은 고정이다.
//   하부 몸판의 이음선은 곧은 수평선이다 → **길이는 정확히 같고 모양만 다르다**(강체 회전은 길이를 보존한다).
//   꺾인 이음선의 재작도(truing)는 패턴선 확정 단계 몫이다 — 여기서는 손대지 않는다.
//   닫힌 다트의 다리는 어디에도 남기지 않는다(지배 데이터 모델: 닫힌 다트 = 과거 흔적). 두 다리 길이가
//   다르면(뒤 어깨 다트 ≈0.10cm) 회전 뒤 입 점이 그만큼 어긋나므로 그 짧은 잔여 step 을
//   `closedDart` 태그 선분으로 잇고 `residualStepCm` 으로 기록한다.
//
// ★ Ⓢ(P.32, 2026-10-01 사용자 확정) — `split(…, { variant: "S", gather: true })` → `splitSideS`: 이음선 = BL 5cm 아래(뒤 수평) / 앞은 CF→BP(BL 높이)→
//   옆선 BL−5 사선. 앞 AH 다트는 BP 축으로 닫아 흡수(위 회전 그대로), **뒤 어깨 다트는 요크 construction 에 열린 봉제 다트로 그대로 보존**한다.
//   개더 띠 폭 = 각 면 완성 이음선 전체 길이 × 0.5(몸판에만, 요크 불변). Ⓠ·Ⓡ 경로(`splitSide`)는 바이트 불변이다.
//
// ★ Ⓣ(P.33, 2026-10-01 사용자 확정) — `split(…, { variant: "T", hemSideCm: 2.5 })`: 요크·이음선·앞 AH 다트 흡수·뒤 어깨 다트 보존은 Ⓢ 와 **완전히 같고**
//   (`splitSideS` 재사용), 개더 띠 대신 **몸판을 수직 절개 2곳(WL 3등분점)으로 잘라 이음선 교점을 고정하고 밑단만 벌린다**(처리 방법 P.163).
//   총 벌림 ∅ = ● × 0.5 − 2.5, 절개당 ∅/2 · ● = 그 면 Ⓐ 몸판의 **BL 수평폭**(앞뒤 각각 독립 — 이음선 전체 길이가 아니다) · 밑단 옆 +2.5(이미 차지한 몫).
//   절개마다 `designJoin.buttSpread`(접선 연속 밑단 fairing 포함)를 중심→옆 순으로 부른다. 이음선은 강체 회전이라 길이가 정확히 보존되고(꺾임은 패턴선
//   확정 단계 몫), 개더·턱은 만들지 않는다. Ⓠ·Ⓡ·Ⓢ 경로는 바이트 불변이다.
//
// 원자성·순수성: 입력 불변(deepClone), 실패는 reason 을 단 Error throw(부분 결과 없음), DOM·storage·render
//   미접근, 결정론. designLineTool·designJoin 의 순수 헬퍼만 쓴다(그 둘 **다음에** 로드).
//   designJoin / designWaistSeam / dartMove 의 기존 계약은 넓히지 않았다.
// ═══════════════════════════════════════════════════════════
(function () {
  "use strict";

  var CLOSE_EPS = 1e-4;       // 폐곡선 연속성 허용오차(designJoin·designLineTool 과 같은 계약)
  var MIN_AREA = 0.01;        // cm²
  var Y_TOL = 1e-3;           // 이음선 y 와 정점이 같은 높이로 보는 허용(cm)
  var CON_TOL = 5e-3;         // 구성선이 이음선 아래(하부)에 있다고 보는 허용(cm)
  var LEG_TOL = 0.2;          // 다트 두 다리 길이 차 허용(cm) — 뒤 어깨 다트의 문서화된 ≈0.10 을 포함
  var SEAM_TOL = 1e-6;        // 상·하 이음 길이 정합 허용(cm)
  var AREA_TOL = 0.05;        // 면적 보존 허용(cm²)
  var HEM_TOL = 1e-6;
  var ABSORB = { front: "front-bust", back: "back-shoulder" };   // 이음선이 흡수하는 다트 id
  var DEFAULT_HEM_SIDE_CM = 1;
  // ── Ⓡ(P.31) 개더 띠 — 사용자 확정(2026-10-01, 도메인 판단): 뒤 ⌀ = 10cm 고정(BNP–CB 가슴라인점 1/2 높이에서 수평 11cm − 1cm),
  //   앞 ⊠ = 앞중심에서 AH 다트 끝점까지 이음선상 수평거리 − 1cm. 분량 = ⌀·⊠ 의 1배. 책에 없는 주름 수·턱 형상은 만들지 않는다.
  var GATHER_BACK_CM = 10;
  var GATHER_FRONT_TRIM_CM = 1;
  var GATHER_AREA_TOL = 1e-6;
  // ── Ⓢ(P.32) — 사용자 확정(2026-10-01, 도메인 판단): 이음선 = BL 5cm 아래(뒤 수평) / 앞은 CF→BP 를 BL 높이로 잇고 BP→옆선 BL−5 사선.
  //   앞 AH 다트는 BP 축으로 닫아 요크에 흡수 · **뒤 어깨 다트는 요크에 열린 봉제 다트로 그대로 보존**(닫지도 흡수하지도 않는다).
  //   개더 띠 폭 = 각 면의 완성 이음선 전체 길이 × 0.5(앞뒤 모두, 요크에는 추가하지 않는다). 주름 수·턱 형상은 만들지 않는다.
  var SEAM_BELOW_BL_CM = 5;
  var GATHER_S_RATIO = 0.5;
  // ── Ⓣ(P.33) — 사용자 확정(2026-10-01): ∅ = BL 수평폭 × 0.5 − 2.5(앞뒤 독립) · 절개 2곳(WL 3등분) 균등 ∅/2 · 밑단 옆 +2.5 · 개더·턱 없음.
  var SPREAD_T = { ratio: 0.5, subtractCm: 2.5, cuts: 2 };
  var DEFAULT_HEM_SIDE_T_CM = 2.5;
  var CUT_EPS = 1e-9;
  // Ⓣ 이음선 truing — 절개 벌림은 조각을 이음선 교점에서 돌리므로 몸판 윗변(이음선)에 교점마다 꺾임이 생긴다(교재 P.158 ③ «각지지 않게 완만한 곡선으로 수정»).
  //   이음선의 모든 내부 모서리를 접선 연속 cubic 으로 둥글린다. 모서리마다 양 이웃 선분의 0.45 만큼씩 물러난다(한 선분을 두 모서리가 나눠 써도 겹치지 않는다).
  //   cubic 의 핸들 길이는 **호 길이가 원래 꺾인 길(2t)과 정확히 같도록** 풀어 몸판 이음 길이를 요크와 그대로 맞춘다. 모서리 위치(BP·교점)는 옮기지 않는다.
  var SEAM_FAIR_FRAC = 0.45, SEAM_FAIR_MIN_TURN = 1e-4;

  function fail(reason, detail) {
    var e = new Error("designYokeSeam: " + reason);
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

  // ── 평탄화·면적·자기교차(designLineTool 의 순수 헬퍼 위에서) ──
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

  // ── 이음선(y = Ys) 교차 ──
  function yAt(seg, t) {
    if (seg.kind === "line") return seg.from.y + (seg.to.y - seg.from.y) * t;
    var u = 1 - t;
    return u * u * u * seg.from.y + 3 * u * u * t * seg.c1.y + 3 * u * t * t * seg.c2.y + t * t * t * seg.to.y;
  }
  function ptAt(seg, t) {
    if (seg.kind === "line") return { x: seg.from.x + (seg.to.x - seg.from.x) * t, y: seg.from.y + (seg.to.y - seg.from.y) * t };
    var u = 1 - t;
    return {
      x: u * u * u * seg.from.x + 3 * u * u * t * seg.c1.x + 3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
      y: u * u * u * seg.from.y + 3 * u * u * t * seg.c1.y + 3 * u * t * t * seg.c2.y + t * t * t * seg.to.y
    };
  }
  // 세그먼트가 수평선 y=Ys 와 만나는 내부 t(0<t<1) 목록 — 끝점 접촉은 호출부가 정점으로 본다.
  function interiorCrossings(seg, Ys) {
    var f0 = yAt(seg, 0) - Ys, f1 = yAt(seg, 1) - Ys, N = 64, out = [];
    if (Math.abs(f0) <= Y_TOL && Math.abs(f1) <= Y_TOL) fail("seam-collinear", seg.edge || null);
    for (var k = 0; k < N; k++) {
      var ta = k / N, tb = (k + 1) / N, fa = yAt(seg, ta) - Ys, fb = yAt(seg, tb) - Ys;
      if (!(fa * fb < 0)) continue;
      if ((k === 0 && Math.abs(f0) <= Y_TOL) || (k === N - 1 && Math.abs(f1) <= Y_TOL)) continue;
      var lo = ta, hi = tb, flo = fa;
      for (var it = 0; it < 60; it++) {
        var mid = (lo + hi) / 2, fm = yAt(seg, mid) - Ys;
        if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
      }
      out.push((lo + hi) / 2);
    }
    return out;
  }

  // ── 원래 path 프리미티브 복원(designWaistSeam.restorePaths 와 같은 계약 — 그쪽은 export 하지 않으므로 복제) ──
  //   outlinePrimsToSegs 는 여러 C 를 가진 path(앞 목선 2 커브)를 커브마다 쪼갠다. 회전·절단으로 바뀌지 않은
  //   구간은 원래 프리미티브 그대로 되돌려야 목선 길이를 재는 소비자가 깨지지 않는다.
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

  // ══ 링 분할(Ⓠ·Ⓡ·Ⓢ 공용) ═══════════════════════════════════════════════════
  //   열린 다트 다리로 닫은 폐곡선 링을 이음선과 만나는 두 점에서 가른다. levelOf(seg) = 그 외곽 변을 가르는 수평 높이(없으면 null).
  //   Ⓠ·Ⓡ 은 모든 변에 같은 높이, Ⓢ 는 앞뒤 중심 변과 옆선 변에 서로 다른 높이를 준다.
  //   반환: rb(링) · U(다트 다리가 든 호 = 요크 쪽) · L(몸판 쪽) · Pcf(중심 쪽 교차) · Ps(옆쪽 교차).
  function cutRing(piece, which, legs, levelOf) {
    var t = T();
    var rb = t.buildPieceRing(t.outlinePrimsToSegs(piece.outline), legs);
    if (!rb.ok) fail("ring-failed", rb.reason);

    // 이음선 높이에서 링을 정점으로 쪼갠다(다트 다리는 교차 검사하지 않는다)
    var pieces = [], cross = [];
    var addCross = function (p) { if (!cross.some(function (c) { return near(c, p, 1e-6); })) cross.push(P(p)); };
    rb.ring.forEach(function (r) {
      if (r.source !== "outline") { pieces.push({ seg: clone(r.seg), source: r.source }); return; }
      var seg = r.seg, Y = levelOf(seg);
      if (Y == null) { pieces.push({ seg: t.subSegment(seg, 0, 1), source: "outline" }); return; }
      if (Math.abs(yAt(seg, 0) - Y) <= Y_TOL) addCross(seg.from);
      if (Math.abs(yAt(seg, 1) - Y) <= Y_TOL) addCross(seg.to);
      var ts = interiorCrossings(seg, Y), prev = 0;
      ts.forEach(function (tc) {
        pieces.push({ seg: t.subSegment(seg, prev, tc), source: "outline" });
        addCross(ptAt(seg, tc));
        prev = tc;
      });
      pieces.push({ seg: t.subSegment(seg, prev, 1), source: "outline" });
    });
    // 조각 사이 junction 정확 공유
    for (var pi = 0; pi < pieces.length; pi++) {
      var nx = pieces[(pi + 1) % pieces.length].seg;
      if (dist(pieces[pi].seg.to, nx.from) > CLOSE_EPS) fail("ring-discontinuous", { side: which, at: pi });
      nx.from = P(pieces[pi].seg.to);
    }
    if (cross.length !== 2) fail("seam-crossing-count", { side: which, count: cross.length });

    // 4) 중심 쪽 교차(P_cf) / 옆쪽 교차(P_side)
    var centerPts = cross.filter(function (c) {
      return pieces.some(function (pc) { return pc.source === "outline" && pc.seg.edge === "center" && (near(pc.seg.from, c, 1e-6) || near(pc.seg.to, c, 1e-6)); });
    });
    if (centerPts.length !== 1) fail("seam-center-crossing", { side: which, count: centerPts.length });
    var Pcf = centerPts[0];
    var Ps = cross.filter(function (c) { return c !== Pcf; })[0];

    // 5) 두 호로 가르기: 다트 다리가 든 쪽 = 요크(upper), 다른 쪽 = 몸판(lower)
    var n = pieces.length;
    var startsAt = function (p) {
      for (var i = 0; i < n; i++) if (near(pieces[i].seg.from, p, 1e-6)) return i;
      return -1;
    };
    var ka = startsAt(cross[0]), kb = startsAt(cross[1]);
    if (ka < 0 || kb < 0) fail("seam-vertex-missing", which);
    var arcFrom = function (a, b) { var out = [], i = a; while (i !== b) { out.push(pieces[i]); i = (i + 1) % n; } return out; };
    var arc1 = arcFrom(ka, kb), arc2 = arcFrom(kb, ka);
    var hasLeg = function (arc) { return arc.some(function (pc) { return pc.source === "dartleg"; }); };
    var U, L;
    if (hasLeg(arc1) && !hasLeg(arc2)) { U = arc1; L = arc2; }
    else if (hasLeg(arc2) && !hasLeg(arc1)) { U = arc2; L = arc1; }
    else fail("dart-not-above-seam", { side: which });
    return { rb: rb, U: U, L: L, Pcf: Pcf, Ps: Ps };
  }

  // ── 개더 띠(Ⓡ·Ⓢ 공용) — 이음선 **아래 몸판에만** 중심 쪽으로 Wcm 평행 추가한다. 요크·이음선 위 geometry 는 손대지 않는다.
  //   반환: { meta, bodySegs(개더 적용), keep(구성선 — 허리선 이동 + 띠 경계 추가) }. 입력 배열은 변형하지 않는다.
  function gatherBand(which, Wcm, rule, Ps, cx, bodySegs, keep, Ys, seamLenUp, areaLow) {
    if (!(Wcm > 0) || !isFinite(Wcm)) fail("gather-width-invalid", { side: which, widthCm: Wcm });
    var dirX = (cx - Ps.x) >= 0 ? 1 : -1;               // 중심 쪽 = 옆선의 반대
    var dx = dirX * Wcm;
    var onCenter = function (p) { return Math.abs(p.x - cx) <= 1e-6; };
    var touches = bodySegs.filter(function (sg) { return onCenter(sg.from) || onCenter(sg.to); });
    if (!touches.every(function (sg) { return sg.kind === "line"; })) fail("gather-center-not-line", { side: which });
    var shiftP = function (p) { return onCenter(p) ? { x: p.x + dx, y: p.y } : P(p); };
    var gSegs = bodySegs.map(function (sg) {
      var q = clone(sg);
      if (q.kind === "line") { q.from = shiftP(sg.from); q.to = shiftP(sg.to); }
      return q;
    });
    var centerYs = [];
    bodySegs.forEach(function (sg) { if (sg.edge === "center") centerYs.push(sg.from.y, sg.to.y); });
    var botY = Math.max.apply(null, centerYs);
    var areaLowG = checkClosed(gSegs, which + ":body-gather");
    var seamLowG = gSegs.filter(function (sg) { return sg.edge === "yoke-seam"; });
    var seamLenLowG = segsLen(seamLowG);
    if (Math.abs((seamLenLowG - seamLenUp) - Wcm) > SEAM_TOL) fail("gather-seam-length-mismatch", { side: which, bodyCm: seamLenLowG, yokeCm: seamLenUp, widthCm: Wcm });
    var areaAdded = Wcm * (botY - Ys);
    if (Math.abs((areaLowG - areaLow) - areaAdded) > AREA_TOL) fail("gather-area-mismatch", { side: which, gotCm2: areaLowG - areaLow, wantCm2: areaAdded });
    var gatherMeta = {
      addedCm: Wcm,
      rule: rule,
      centerX: cx, newCenterX: cx + dx,
      seamLenBodyCm: seamLenLowG, seamLenYokeCm: seamLenUp, seamExcessCm: seamLenLowG - seamLenUp,
      areaAddedCm2: areaLowG - areaLow
    };
    keep = keep.map(function (sg) {
      if (sg.edge !== "waist" || sg.kind !== "line") return sg;
      sg.from = shiftP(sg.from); sg.to = shiftP(sg.to);
      return sg;
    });
    keep.push({ kind: "line", from: { x: cx, y: Ys }, to: { x: cx, y: botY }, gatherBoundary: true, gatherCm: Wcm });
    return { meta: gatherMeta, bodySegs: gSegs, keep: keep };
  }

  // ── 열린 다트를 apex 축 강체 회전으로 닫는다(Ⓠ·Ⓡ·Ⓢ 앞 공용) ──
  //   U = cutRing 의 요크 호(다트 다리 두 개를 품음). 옆(Ps) 쪽 호가 회전하고 중심 쪽은 고정이다.
  //   반환: 다트 다리가 사라진 요크 호(upSegs, 연속) · 입 점(mA·mB) · 회전각 theta · 두 다리 길이 차(residual) · 회전한 옆 끝(PsRot) · 호의 양 끝.
  function absorbDart(U, Ps, apex, which, dartId, aboveY) {
    var il = -1;
    for (var ui = 0; ui < U.length; ui++) if (U[ui].source === "dartleg") { il = ui; break; }
    if (!(il > 0 && il + 2 < U.length && U[il + 1].source === "dartleg" && U[il + 2].source !== "dartleg")) fail("dart-legs-layout", { side: which });
    var X1 = U.slice(0, il).map(function (pc) { return pc.seg; });
    var X2 = U.slice(il + 2).map(function (pc) { return pc.seg; });
    var mA = P(U[il].seg.from), mB = P(U[il + 1].seg.to);
    if (!near(U[il].seg.to, apex, 1e-6) || !near(U[il + 1].seg.from, apex, 1e-6)) fail("dart-apex-mismatch", { side: which });
    var Q0 = P(U[0].seg.from), Q1 = P(U[U.length - 1].seg.to);

    // 요크 링이 수평 이음선 위(y ≤ aboveY)에만 있는지 — Ⓠ·Ⓡ 전용(Ⓢ 앞은 이음선이 꺾여 이 검사를 쓰지 않는다)
    if (aboveY != null) {
      var above = flatPairs(X1.concat(X2)).every(function (ab) { return ab[0].y <= aboveY + Y_TOL && ab[1].y <= aboveY + Y_TOL; });
      if (!above) fail("yoke-crosses-seam", { side: which });
    }

    // 6) 옆쪽 호를 apex 축으로 회전해 다트를 닫는다
    var movingFirst = near(Q0, Ps, 1e-6);            // 옆 끝이 요크 호의 시작이면 X1 이 회전
    if (!movingFirst && !near(Q1, Ps, 1e-6)) fail("seam-side-endpoint", { side: which });
    var mM = movingFirst ? mA : mB, mF = movingFirst ? mB : mA;
    var aM = Math.atan2(mM.y - apex.y, mM.x - apex.x), aF = Math.atan2(mF.y - apex.y, mF.x - apex.x);
    var theta = aF - aM;
    while (theta > Math.PI) theta -= 2 * Math.PI;
    while (theta <= -Math.PI) theta += 2 * Math.PI;
    if (!(Math.abs(theta) > 1e-6) || Math.abs(theta) >= Math.PI / 2) fail("dart-angle-range", { side: which, deg: theta * 180 / Math.PI });
    var lenM = dist(mM, apex), lenF = dist(mF, apex), residual = Math.abs(lenM - lenF);
    if (residual > LEG_TOL) fail("dart-leg-length-mismatch", { side: which, legCm: [lenM, lenF] });
    var moving = (movingFirst ? X1 : X2).map(function (s) { return rotSeg(s, apex, theta); });
    var mMr = rotPt(mM, apex, theta);
    var connEdge = (movingFirst ? X1[X1.length - 1] : X2[0]).edge;
    var conn = [];
    if (residual > 1e-9) {
      var cs = movingFirst ? line(mMr, mF) : line(mF, mMr);
      cs.closedDart = dartId;
      if (connEdge) cs.edge = connEdge;
      conn.push(cs);
    }
    var upSegs = movingFirst ? moving.concat(conn, X2.map(clone)) : X1.map(clone).concat(conn, moving);
    var PsRot = movingFirst ? P(upSegs[0].from) : P(upSegs[upSegs.length - 1].to);
    var eUp = P(upSegs[upSegs.length - 1].to), sUp = P(upSegs[0].from);
    for (var g = 0; g + 1 < upSegs.length; g++) upSegs[g + 1].from = P(upSegs[g].to);   // 회전 오차 제거(연속)
    return { upSegs: upSegs, mA: mA, mB: mB, theta: theta, residual: residual, PsRot: PsRot, eUp: eUp, sUp: sUp };
  }

  // ══ 한 면(앞 또는 뒤) ══════════════════════════════════════════════════════
  function splitSide(piece, which, opts) {
    var t = T();
    var hemSideCm = (opts && "hemSideCm" in opts) ? opts.hemSideCm : DEFAULT_HEM_SIDE_CM;
    if (hemSideCm != null && !(typeof hemSideCm === "number" && isFinite(hemSideCm))) fail("invalid-option", { hemSideCm: hemSideCm });
    if (!piece || !Array.isArray(piece.outline) || !Array.isArray(piece.construction)) fail("invalid-geometry", which);

    // 1) 흡수할 다트(열린 AH / 어깨 다트)와 apex
    var dartId = ABSORB[which];
    var legs = piece.construction.filter(function (s) { return s && s.dart && s.dart.id === dartId; });
    if (legs.length !== 2) fail("dart-missing", { side: which, dartId: dartId, found: legs.length });
    var apexOf = function (s) { return s.dart.apexAt === "to" ? s.to : s.from; };
    var apex = P(apexOf(legs[0]));
    if (!near(apex, apexOf(legs[1]), 1e-6)) fail("dart-apex-mismatch", dartId);
    var Ys = apex.y;                                   // ★ 이음선 높이 = 다트 끝 y (잠긴 결정 1)

    // 2~5) 다트 입구가 열린 폐곡선 링을 이음선 높이(수평 Ys)에서 두 호(요크 U / 몸판 L)로 가른다
    var originalOutline = piece.outline;
    var cut = cutRing(piece, which, legs, function () { return Ys; });
    var rb = cut.rb, U = cut.U, L = cut.L, Pcf = cut.Pcf, Ps = cut.Ps;

    var ab = absorbDart(U, Ps, apex, which, dartId, Ys);
    var upSegs = ab.upSegs, mA = ab.mA, mB = ab.mB, theta = ab.theta, residual = ab.residual, PsRot = ab.PsRot, eUp = ab.eUp, sUp = ab.sUp;
    var seamUp = [line(eUp, apex, { edge: "yoke-seam", yokeSeam: "upper" }), line(apex, sUp, { edge: "yoke-seam", yokeSeam: "upper" })];
    var yokeSegs = upSegs.concat(seamUp);

    // 7) 하부 몸판: 곧은 이음선 Ps → apex → Pcf(요크와 반대 방향)
    var lowSegs = L.map(function (pc) { return clone(pc.seg); });
    var lQ0 = P(lowSegs[lowSegs.length - 1].to);      // 호 끝(= Q0)
    var lQ1 = P(lowSegs[0].from);                     // 호 시작(= Q1)
    var seamLow = [line(lQ0, apex, { edge: "yoke-seam", yokeSeam: "lower" }), line(apex, lQ1, { edge: "yoke-seam", yokeSeam: "lower" })];
    var bodySegs = lowSegs.concat(seamLow);

    // 8) 검증 — 연속·폐곡선·자기교차 0·면적 / 이음 길이 정합 / 면적 보존 / 밑단 +hemSide
    var areaUp = checkClosed(yokeSegs, which + ":yoke");
    var areaLow = checkClosed(bodySegs, which + ":body");
    var seamLenUp = segsLen(seamUp), seamLenLow = segsLen(seamLow);
    if (Math.abs(seamLenUp - seamLenLow) > SEAM_TOL) fail("seam-length-mismatch", { side: which, upperCm: seamLenUp, lowerCm: seamLenLow });
    var areaIn = Math.abs(signedArea(rb.ring.map(function (r) { return r.seg; })));
    if (Math.abs(areaUp + areaLow - areaIn) > AREA_TOL) fail("area-not-conserved", { side: which, upperCm2: areaUp, lowerCm2: areaLow, inputCm2: areaIn });
    var sides = lowSegs.filter(function (s) { return s.edge === "side-seam"; });
    if (!sides.length) fail("side-seam-missing", which);
    var pts = []; sides.forEach(function (s) { pts.push(s.from, s.to); });
    var top = pts.reduce(function (a, b) { return b.y < a.y ? b : a; }), bot = pts.reduce(function (a, b) { return b.y > a.y ? b : a; });
    var centerX = lowSegs.filter(function (s) { return s.edge === "center"; })[0];
    var cx = centerX ? centerX.from.x : Pcf.x;
    var hemExtra = (top.x >= cx ? 1 : -1) * (bot.x - top.x);
    if (hemSideCm != null && Math.abs(hemExtra - hemSideCm) > HEM_TOL) fail("hem-side-mismatch", { side: which, actualCm: hemExtra, wantCm: hemSideCm });

    // 9) 구성선: 흡수한 다트는 사라지고, 이음선 아래에 완전히 있는 선만 몸판이 잇는다(요크는 구성선 없음)
    var keep = [], dropped = [];
    piece.construction.forEach(function (s) {
      if (s && s.dart && s.dart.id === dartId) return;
      if (s && s.from && s.to && s.from.y >= Ys - CON_TOL && s.to.y >= Ys - CON_TOL) keep.push(deepClone(s));
      else if (s) { var id = s.dart && s.dart.id || s.edge || "?"; if (dropped.indexOf(id) < 0) dropped.push(id); }
    });

    // 9b) Ⓡ 개더 띠 — 이음선 **아래 몸판에만** 중심 쪽으로 평행 추가한다. 요크(yokeSegs)·이음선 위 geometry 는 손대지 않는다.
    //   opts.gather 가 없으면 이 블록은 실행되지 않고 Ⓠ 결과는 바이트 동일하다.
    var gatherMeta = null;
    if (opts && opts.gather === true) {
      var Wcm = (which === "back") ? GATHER_BACK_CM : Math.abs(apex.x - cx) - GATHER_FRONT_TRIM_CM;
      var gr = gatherBand(which, Wcm, which === "back" ? "back-fixed-10" : "front-apex-distance-minus-1", Ps, cx, bodySegs, keep, Ys, seamLenUp, areaLow);
      gatherMeta = gr.meta; bodySegs = gr.bodySegs; keep = gr.keep;
    }

    var meta = {
      side: which,
      seamY: Ys,
      seamPoints: { center: P(Pcf), apex: P(apex), side: P(Ps), sideAfterClose: P(PsRot) },
      seamLenLowerCm: seamLenLow,
      seamLenUpperCm: seamLenUp,
      seamDeltaCm: seamLenUp - seamLenLow,
      seamMaxDyCm: Math.max(Math.abs(Pcf.y - Ys), Math.abs(Ps.y - Ys)),
      absorbedDarts: [{ id: dartId, apex: P(apex), mouths: [P(mA), P(mB)], mouthWidthCm: dist(mA, mB),
        angleDeg: Math.abs(theta) * 180 / Math.PI, rotatedSide: "side", legLenCm: [dist(mA, apex), dist(mB, apex)],
        residualStepCm: residual }],
      hemSideExtraCm: hemExtra,
      areaYokeCm2: areaUp, areaBodyCm2: areaLow, areaInputCm2: areaIn,
      droppedConstruction: dropped
    };
    if (gatherMeta) {
      meta.gather = gatherMeta;
      meta.seamLenLowerCm = gatherMeta.seamLenBodyCm;     // 개더 적용 후 몸판 이음 길이(정직 기록)
      meta.seamDeltaCm = seamLenUp - gatherMeta.seamLenBodyCm;
      meta.areaBodyCm2 = areaLow + gatherMeta.areaAddedCm2;
    }
    return {
      yoke: { outline: toPrims(yokeSegs, originalOutline), construction: [] },
      body: { outline: toPrims(bodySegs, originalOutline), construction: keep },
      meta: meta
    };
  }

  // ══ Ⓢ(P.32) 한 면 ═════════════════════════════════════════════════════════
  //   BL = 옆선 변의 위 끝(진동 밑 점)의 y. 뒤: BL+5 수평선(CB→옆선). 앞: CF→BP 를 BL 높이로 잇고 BP→옆선 BL+5 사선.
  //   (y 는 아래로 증가한다 — 도해의 «BL 에서 5cm 아래» = BL.y + 5.)
  // ── Ⓣ 이음선 truing: 연속한 yoke-seam 직선 사이의 모서리를 길이 보존 접선 연속 cubic 으로 대체 ──
  function fairSeamRun(chain, which) {
    var t = T(), n = chain.length, isSeam = function (sg) { return sg && sg.edge === "yoke-seam" && sg.kind === "line"; };
    var len = function (sg) { return dist(sg.from, sg.to); };
    var trim = chain.map(function () { return { a: 0, b: 0 }; }), fil = [];
    for (var i = 0; i < n; i++) {
      var A = chain[i], B = chain[(i + 1) % n];
      if (!isSeam(A) || !isSeam(B)) continue;
      var d0 = { x: (A.to.x - A.from.x) / len(A), y: (A.to.y - A.from.y) / len(A) }, d1 = { x: (B.to.x - B.from.x) / len(B), y: (B.to.y - B.from.y) / len(B) };
      var turn = Math.abs(Math.atan2(d0.x * d1.y - d0.y * d1.x, d0.x * d1.x + d0.y * d1.y));
      if (turn < SEAM_FAIR_MIN_TURN) continue;
      var tt = SEAM_FAIR_FRAC * Math.min(len(A), len(B));
      var V = P(A.to), P0 = { x: V.x - tt * d0.x, y: V.y - tt * d0.y }, P3 = { x: V.x + tt * d1.x, y: V.y + tt * d1.y };
      var mk = function (h) {
        return { kind: "cubic", from: P(P0), c1: { x: P0.x + h * d0.x, y: P0.y + h * d0.y }, c2: { x: P3.x - h * d1.x, y: P3.y - h * d1.y }, to: P(P3),
          edge: "yoke-seam", yokeSeam: "lower" };
      };
      var lo = 0, hi = 2 * tt;
      if (!(segsLen([mk(hi)]) >= 2 * tt)) fail("seam-fair-length", { side: which, turnRad: turn });
      for (var it = 0; it < 80; it++) { var mid = (lo + hi) / 2; if (segsLen([mk(mid)]) < 2 * tt) lo = mid; else hi = mid; }
      var c = mk((lo + hi) / 2);
      trim[i].b = tt; trim[(i + 1) % n].a = tt;
      fil.push({ after: i, seg: c, atX: V.x, atY: V.y, turnDeg: turn * 180 / Math.PI, tCm: tt, handleCm: (lo + hi) / 2 });
    }
    if (!fil.length) return { chain: chain, corners: [] };
    var out = [];
    for (var k = 0; k < n; k++) {
      var sg = chain[k], tr = trim[k];
      if (tr.a || tr.b) {
        var L = len(sg), q = t.subSegment(sg, tr.a / L, 1 - tr.b / L);
        q.edge = sg.edge; if (sg.yokeSeam) q.yokeSeam = sg.yokeSeam;
        out.push(q);
      } else out.push(sg);
      fil.forEach(function (f) { if (f.after === k) out.push(f.seg); });
    }
    for (var g = 0; g < out.length; g++) out[(g + 1) % out.length].from = P(out[g].to);   // 연속(부동소수 drift 제거)
    return { chain: out, corners: fil.map(function (f) { return { at: { x: f.atX, y: f.atY }, turnDeg: f.turnDeg, setbackCm: f.tCm, handleCm: f.handleCm }; }) };
  }

  // ══ Ⓣ(P.33) 몸판 절개 벌림 ═════════════════════════════════════════════════
  //   bodySegs = 이음선 아래 몸판 폐곡선(개더 없음), keep = 그 몸판의 구성선. WL 참고선(keep 의 edge:"waist")을 (cuts+1)등분한 x 에서
  //   수직 절개 → 중심 조각 고정, 나머지를 바깥으로 순차 `buttSpread`(고정점 = 절개선과 이음선의 교점, 밑단 끝 chord = ∅/cuts).
  //   반환: { outline(geometry 포맷), construction, flare(메타), areaCm2, seamLenCm }. 실패는 reason 을 단 throw(부분 결과 없음).
  function spreadBody(which, bodySegs, keep, BLw, spec) {
    var t = T(), Jn = J();
    if (!Jn || typeof Jn.buttSpread !== "function") fail("designJoin-missing");
    var n = spec.cuts, total = spec.ratio * BLw - spec.subtractCm;
    if (!(total > 0) || !isFinite(total)) fail("flare-not-positive", { side: which, bustWidthCm: BLw, totalCm: total });
    var chord = total / n;
    var byEdge = function (e) { return bodySegs.filter(function (sg) { return sg.edge === e; }); };
    var seam = byEdge("yoke-seam"), center = byEdge("center"), side = byEdge("side-seam"), hemL = byEdge("hem");
    if (!seam.length || !center.length || !side.length || hemL.length !== 1) fail("spread-body-topology", which);
    if (!seam.every(function (sg) { return sg.kind === "line"; }) || hemL[0].kind !== "line") fail("spread-body-not-line", which);
    var cx = center[0].from.x;
    if (!center.every(function (sg) { return Math.abs(sg.from.x - cx) < 1e-6 && Math.abs(sg.to.x - cx) < 1e-6; })) fail("spread-center-not-vertical", which);
    var sideTopX = side.reduce(function (a, sg) { var p = sg.from.y < sg.to.y ? sg.from : sg.to; return p.y < a.y ? p : a; }, { x: 0, y: Infinity }).x;
    if (Math.abs(sideTopX - cx) < 1e-6) fail("spread-side-degenerate", which);
    var dir = sideTopX > cx ? 1 : -1;
    var U = function (x) { return (x - cx) * dir; };
    var X = function (u) { return cx + dir * u; };

    // WL 참고선 → 3등분(= Ⓞ·Ⓟ 와 같은 표기)
    var wl = keep.filter(function (sg) { return sg && sg.kind === "line" && sg.edge === "waist"; });
    if (wl.length !== 1) fail("spread-waist-reference", { side: which, count: wl.length });
    var uW = Math.max(U(wl[0].from.x), U(wl[0].to.x));
    if (Math.min(U(wl[0].from.x), U(wl[0].to.x)) > 1e-6 || !(uW > 0)) fail("spread-waist-reference", { side: which, reason: "not-from-center" });
    var cutU = []; for (var ci = 1; ci <= n; ci++) cutU.push(uW * ci / (n + 1));

    // 이음선(중심→옆 방향으로 정렬) · 밑단(중심→옆) · 옆선(위→아래) · 중심(아래→위)
    var seamC = seam.map(function (sg) { return U(sg.from.x) <= U(sg.to.x) ? clone(sg) : t.reverseSeg(sg); })
      .sort(function (a, b) { return U(a.from.x) - U(b.from.x); });
    for (var k = 0; k + 1 < seamC.length; k++) if (dist(seamC[k].to, seamC[k + 1].from) > CLOSE_EPS) fail("spread-seam-discontinuous", which);
    if (Math.abs(U(seamC[0].from.x)) > 1e-6) fail("spread-seam-not-from-center", which);
    var uSeamEnd = U(seamC[seamC.length - 1].to.x);
    var hemC = U(hemL[0].from.x) <= U(hemL[0].to.x) ? clone(hemL[0]) : t.reverseSeg(hemL[0]);
    var sideD = side.map(function (sg) { return sg.from.y <= sg.to.y ? clone(sg) : t.reverseSeg(sg); }).sort(function (a, b) { return a.from.y - b.from.y; });
    var centerU = center.map(function (sg) { return sg.from.y >= sg.to.y ? clone(sg) : t.reverseSeg(sg); }).sort(function (a, b) { return b.from.y - a.from.y; });
    var uHem0 = U(hemC.from.x), uHem1 = U(hemC.to.x);
    if (!(uHem1 - uHem0 > CUT_EPS)) fail("spread-hem-degenerate", which);
    var seamAt = function (u) {
      for (var i = 0; i < seamC.length; i++) {
        var a = U(seamC[i].from.x), b = U(seamC[i].to.x);
        if (u >= a - CUT_EPS && u <= b + CUT_EPS) { var f = b - a > CUT_EPS ? (u - a) / (b - a) : 0; return { x: X(u), y: seamC[i].from.y + (seamC[i].to.y - seamC[i].from.y) * f }; }
      }
      return null;
    };
    var hemAt = function (u) { var f = (u - uHem0) / (uHem1 - uHem0); return { x: X(u), y: hemC.from.y + (hemC.to.y - hemC.from.y) * f }; };
    var cuts = cutU.map(function (u, i) {
      var sp = seamAt(u);
      if (!sp || u >= uSeamEnd - 1e-6 || u >= uHem1 - 1e-6) fail("cut-outside-body", { side: which, cut: i + 1 });
      return { u: u, id: which + "-yoke-cut-" + (i + 1), seamPt: sp, hemPt: hemAt(u) };
    });
    var tag = function (pid, sd) { return "join:" + pid + ":" + sd; };

    // 조각(strip) 0..n — 허리 대신 이음선 구간이 윗변이다
    var clipSeam = function (uA, uB) {
      var out = [];
      seamC.forEach(function (sg) {
        var a = U(sg.from.x), b = U(sg.to.x), lo = Math.max(a, uA), hi = Math.min(b, uB);
        if (!(hi - lo > 1e-9)) return;
        var f0 = (lo - a) / (b - a), f1 = (hi - a) / (b - a);
        out.push(line({ x: sg.from.x + (sg.to.x - sg.from.x) * f0, y: sg.from.y + (sg.to.y - sg.from.y) * f0 },
          { x: sg.from.x + (sg.to.x - sg.from.x) * f1, y: sg.from.y + (sg.to.y - sg.from.y) * f1 }, { edge: "yoke-seam", yokeSeam: "lower" }));
      });
      return out;
    };
    var strips = [], areaStrips = 0;
    var assignCon = function (uA, uB, last) {
      var out = [];
      keep.forEach(function (sg) {
        if (!sg || sg.kind !== "line" || (sg.dart && sg.dart.id)) return;
        var a = U(sg.from.x), b = U(sg.to.x);
        if (Math.abs(b - a) < CUT_EPS) { if (a >= uA - CUT_EPS && (a < uB - CUT_EPS || last)) out.push(clone(sg)); return; }
        var lo = Math.max(Math.min(a, b), uA), hi = Math.min(Math.max(a, b), uB);
        if (!(hi - lo > 1e-9)) return;
        var f = function (u) { return (u - a) / (b - a); };
        var q = clone(sg), pa = { x: sg.from.x + (sg.to.x - sg.from.x) * f(lo), y: sg.from.y + (sg.to.y - sg.from.y) * f(lo) },
          pb = { x: sg.from.x + (sg.to.x - sg.from.x) * f(hi), y: sg.from.y + (sg.to.y - sg.from.y) * f(hi) };
        if (a <= b) { q.from = pa; q.to = pb; } else { q.from = pb; q.to = pa; }
        out.push(q);
      });
      return out;
    };
    for (var s = 0; s <= n; s++) {
      var uA = s === 0 ? 0 : cuts[s - 1].u, uB = s === n ? uSeamEnd : cuts[s].u, segs = clipSeam(uA, uB);
      if (!segs.length) fail("spread-strip-empty", { side: which, strip: s });
      if (s < n) segs.push(line(cuts[s].seamPt, cuts[s].hemPt, { edge: tag(cuts[s].id, "first") }));
      else sideD.forEach(function (sg) { segs.push(clone(sg)); });
      var ha = s === 0 ? 0 : (cuts[s - 1].u - uHem0) / (uHem1 - uHem0), hb = s === n ? 1 : (cuts[s].u - uHem0) / (uHem1 - uHem0);
      segs.push(t.reverseSeg(t.subSegment(hemC, ha, hb)));
      if (s > 0) segs.push(line(cuts[s - 1].hemPt, cuts[s - 1].seamPt, { edge: tag(cuts[s - 1].id, "second") }));
      else centerU.forEach(function (sg) { segs.push(clone(sg)); });
      var R = Jn.buildClosedRing(segs);
      if (!R.ok) fail(R.reason, { side: which, strip: s });
      areaStrips += checkClosed(R.chain, which + ".body-strip" + s);
      strips.push({ outline: R.chain.map(Jn.toGeomPrim), construction: assignCon(uA, s === n ? Infinity : uB, s === n).map(Jn.toGeomPrim) });
    }

    var legEnds = function (pc, edgeTag) {
      var R = Jn.buildClosedRing(t.outlinePrimsToSegs(pc.outline));
      if (!R.ok) fail(R.reason, edgeTag);
      var hit = Jn.canonicalRing(R.chain).chain.filter(function (sg) { return sg.edge === edgeTag; });
      if (hit.length !== 1) fail("join-leg-not-found", { tag: edgeTag, count: hit.length });
      return { start: P(hit[0].from), end: P(hit[0].to) };
    };
    // 고정점 = 다리 끝 중 이음선 모서리에 닿은 쪽(좌표를 추측하지 않는다)
    var pivotOf = function (pc, ends, tagName) {
      var sm = t.outlinePrimsToSegs(pc.outline).filter(function (sg) { return sg.edge === "yoke-seam"; });
      var on = function (pt) { return sm.some(function (sg) { return near(sg.from, pt, 1e-6) || near(sg.to, pt, 1e-6); }); };
      var a0 = on(ends.start), a1 = on(ends.end);
      if (a0 === a1) fail("spread-pivot-not-found", { tag: tagName });
      return a0 ? ends.start : ends.end;
    };
    var acc = strips[0], joins = [];
    for (var j = 0; j < n; j++) {
      var d = cuts[j], ea = legEnds(acc, tag(d.id, "first")), eb = legEnds(strips[j + 1], tag(d.id, "second")), res;
      try {
        res = Jn.buttSpread({ joinPairId: d.id,
          a: { piece: acc, pairId: d.id, start: ea.start, end: ea.end },
          b: { piece: strips[j + 1], pairId: d.id, start: eb.start, end: eb.end },
          spread: { pivot: pivotOf(acc, ea, tag(d.id, "first")), chordCm: chord } }, { bridge: "smooth", bridgeEdge: "hem" });
      } catch (e) { fail("spread-join-failed", { side: which, cut: d.id, reason: e.reason || e.message }); }
      acc = { outline: res.outline, construction: res.construction };
      joins.push({ cutId: d.id, uCm: d.u, seamPoint: P(d.seamPt), hemPoint: P(d.hemPt), chordCm: res.spread.chordCm, angleDeg: res.spread.angleDeg,
        bridgeLenCm: res.spread.bridgeLenCm, wedgeAreaCm2: res.spread.wedgeAreaCm2, areaDeltaCm2: res.areaDeltaCm2, maxSeamDeviationCm: res.maxSeamDeviationCm });
    }
    var fin = Jn.buildClosedRing(t.outlinePrimsToSegs(acc.outline));
    if (!fin.ok) fail(fin.reason, which);
    var areaBeforeFair = Math.abs(signedArea(fin.chain));
    var fr = fairSeamRun(fin.chain, which);
    var finArea = checkClosed(fr.chain, which + ":body-spread");
    var seamLen = segsLen(fr.chain.filter(function (sg) { return sg.edge === "yoke-seam"; }));
    return { outline: fr.chain.map(Jn.toGeomPrim), construction: acc.construction, areaCm2: finArea, areaStripsCm2: areaStrips, seamLenCm: seamLen,
      flare: { bustWidthCm: BLw, ratio: spec.ratio, subtractCm: spec.subtractCm, totalCm: total, perCutChordCm: chord, cuts: joins, seamFairing: fr.corners, seamFairingAreaCm2: finArea - areaBeforeFair,
        waistThirdsCm: uW, strips: n + 1 } };
  }

  function splitSideS(piece, which, opts) {
    var variantT = !!(opts && opts.variant === "T");   // Ⓣ(P.33): 개더 띠 대신 몸판 절개 벌림
    var hemSideCm = (opts && "hemSideCm" in opts) ? opts.hemSideCm : (variantT ? DEFAULT_HEM_SIDE_T_CM : DEFAULT_HEM_SIDE_CM);
    if (hemSideCm != null && !(typeof hemSideCm === "number" && isFinite(hemSideCm))) fail("invalid-option", { hemSideCm: hemSideCm });
    if (!piece || !Array.isArray(piece.outline) || !Array.isArray(piece.construction)) fail("invalid-geometry", which);
    var isFront = (which === "front");

    // 1) BL · 이음선 높이
    var sideEdges = piece.outline.filter(function (s) { return s && s.edge === "side-seam"; });
    if (!sideEdges.length) fail("side-seam-missing", which);
    var BLy = Infinity;
    sideEdges.forEach(function (s) { BLy = Math.min(BLy, s.from.y, s.to.y); });
    var Ys = BLy + SEAM_BELOW_BL_CM;

    // 2) 다트(앞 AH = 흡수 / 뒤 어깨 = 보존)와 apex
    var dartId = ABSORB[which];
    var legs = piece.construction.filter(function (s) { return s && s.dart && s.dart.id === dartId; });
    if (legs.length !== 2) fail("dart-missing", { side: which, dartId: dartId, found: legs.length });
    var apexOf = function (s) { return s.dart.apexAt === "to" ? s.to : s.from; };
    var mouthOf = function (s) { return s.dart.apexAt === "to" ? s.from : s.to; };
    var apex = P(apexOf(legs[0]));
    if (!near(apex, apexOf(legs[1]), 1e-6)) fail("dart-apex-mismatch", dartId);
    if (isFront && Math.abs(apex.y - BLy) > Y_TOL) fail("bust-point-off-bust-line", { apexY: apex.y, bustLineY: BLy });
    var Ycf = isFront ? BLy : Ys;                       // 중심 쪽 이음선 높이(앞 = BL, 뒤 = BL+5)

    // 3) 링을 두 높이에서 가른다: 중심 변은 Ycf, 옆선 변은 Ys
    var cut = cutRing(piece, which, legs, function (seg) { return seg.edge === "center" ? Ycf : (seg.edge === "side-seam" ? Ys : null); });
    var U = cut.U, L = cut.L, Pcf = cut.Pcf, Ps = cut.Ps, rb = cut.rb;
    if (Math.abs(Pcf.y - Ycf) > Y_TOL || Math.abs(Ps.y - Ys) > Y_TOL) fail("seam-crossing-height", { side: which, centerY: Pcf.y, sideY: Ps.y });

    // 4) 요크
    var yokeRingSegs, yokeOutlineSegs, yokeConstruction = [], seamUp, absorbed = [], preserved = [], PsRot = P(Ps);
    if (isFront) {
      var ab = absorbDart(U, Ps, apex, which, dartId, null);
      var eUp = ab.eUp, sUp = ab.sUp;
      seamUp = [line(eUp, apex, { edge: "yoke-seam", yokeSeam: "upper" }), line(apex, sUp, { edge: "yoke-seam", yokeSeam: "upper" })];
      yokeRingSegs = ab.upSegs.concat(seamUp);
      yokeOutlineSegs = yokeRingSegs;
      PsRot = ab.PsRot;
      absorbed.push({ id: dartId, apex: P(apex), mouths: [P(ab.mA), P(ab.mB)], mouthWidthCm: dist(ab.mA, ab.mB),
        angleDeg: Math.abs(ab.theta) * 180 / Math.PI, rotatedSide: "side", legLenCm: [dist(ab.mA, apex), dist(ab.mB, apex)],
        residualStepCm: ab.residual });
    } else {
      var uSegs = U.map(function (pc) { return pc.seg; });
      seamUp = [line(U[U.length - 1].seg.to, U[0].seg.from, { edge: "yoke-seam", yokeSeam: "upper" })];
      yokeRingSegs = uSegs.concat(seamUp);                                       // 검증용 링(다트 다리 포함 — 열린 V 노치)
      yokeOutlineSegs = U.filter(function (pc) { return pc.source !== "dartleg"; }).map(function (pc) { return pc.seg; }).concat(seamUp);
      yokeConstruction = legs.map(deepClone);                                    // 열린 봉제 다트: 원본 다리(dart 메타 포함) 그대로
      var mo = legs.map(mouthOf);
      preserved.push({ id: dartId, apex: P(apex), mouths: [P(mo[0]), P(mo[1])], mouthWidthCm: dist(mo[0], mo[1]),
        legLenCm: [dist(mo[0], apex), dist(mo[1], apex)], open: true });
    }

    // 5) 하부 몸판: 이음선은 원래 모양 그대로(앞: Ps→apex→Pcf, 뒤: Ps→Pcf 수평)
    var lowSegs = L.map(function (pc) { return clone(pc.seg); });
    var lQ0 = P(lowSegs[lowSegs.length - 1].to), lQ1 = P(lowSegs[0].from);
    var seamLow = isFront
      ? [line(lQ0, apex, { edge: "yoke-seam", yokeSeam: "lower" }), line(apex, lQ1, { edge: "yoke-seam", yokeSeam: "lower" })]
      : [line(lQ0, lQ1, { edge: "yoke-seam", yokeSeam: "lower" })];
    var bodySegs = lowSegs.concat(seamLow);

    // 6) 검증
    var areaUp = checkClosed(yokeRingSegs, which + ":yoke");
    var areaLow = checkClosed(bodySegs, which + ":body");
    var seamLenUp = segsLen(seamUp), seamLenLow = segsLen(seamLow);
    if (Math.abs(seamLenUp - seamLenLow) > SEAM_TOL) fail("seam-length-mismatch", { side: which, upperCm: seamLenUp, lowerCm: seamLenLow });
    var areaIn = Math.abs(signedArea(rb.ring.map(function (r) { return r.seg; })));
    if (Math.abs(areaUp + areaLow - areaIn) > AREA_TOL) fail("area-not-conserved", { side: which, upperCm2: areaUp, lowerCm2: areaLow, inputCm2: areaIn });
    var sides = lowSegs.filter(function (s) { return s.edge === "side-seam"; });
    if (!sides.length) fail("side-seam-missing", which);
    var pts = []; sides.forEach(function (s) { pts.push(s.from, s.to); });
    var top = pts.reduce(function (a, b) { return b.y < a.y ? b : a; }), bot = pts.reduce(function (a, b) { return b.y > a.y ? b : a; });
    var centerX = lowSegs.filter(function (s) { return s.edge === "center"; })[0];
    var cx = centerX ? centerX.from.x : Pcf.x;
    var hemExtra = (top.x >= cx ? 1 : -1) * (bot.x - top.x);
    if (hemSideCm != null && Math.abs(hemExtra - hemSideCm) > HEM_TOL) fail("hem-side-mismatch", { side: which, actualCm: hemExtra, wantCm: hemSideCm });

    // 7) 구성선: 이음선 꺾인 선 **아래**에 완전히 있는 선만 몸판이 잇는다(요크는 구성선 대신 보존한 다트 다리만)
    var seamYAt = function (x) {
      if (!isFront) return Ys;
      var lo = Math.min(Ps.x, apex.x), hi = Math.max(Ps.x, apex.x);
      if (x <= lo) return (Ps.x <= apex.x) ? Ps.y : apex.y;
      if (x >= hi) return (Ps.x <= apex.x) ? apex.y : Ps.y;
      return Ps.y + (apex.y - Ps.y) * (x - Ps.x) / (apex.x - Ps.x);
    };
    var keep = [], dropped = [];
    piece.construction.forEach(function (sg) {
      if (sg && sg.dart && sg.dart.id === dartId) return;
      if (sg && sg.from && sg.to && sg.from.y >= seamYAt(sg.from.x) - CON_TOL && sg.to.y >= seamYAt(sg.to.x) - CON_TOL) keep.push(deepClone(sg));
      else if (sg) { var id = sg.dart && sg.dart.id || sg.edge || "?"; if (dropped.indexOf(id) < 0) dropped.push(id); }
    });

    // 8) 개더 띠(Ⓢ) — 폭 = 완성 이음선 전체 길이 × 0.5, 몸판에만(요크 geometry 불변). 띠 윗변 = 중심 쪽 이음선 높이(Pcf.y).
    //    Ⓣ 는 개더 대신 몸판을 절개해 벌린다(● = 이 면 Ⓐ 몸판의 BL 수평폭).
    var gr = null, sp = null;
    if (variantT) {
      var BLside = sideEdges.reduce(function (a, s2) { var p = s2.from.y <= s2.to.y ? s2.from : s2.to; return p.y < a.y ? p : a; }, { x: 0, y: Infinity });
      if (Math.abs(BLside.y - BLy) > Y_TOL) fail("bust-line-side-point", which);
      sp = spreadBody(which, bodySegs, keep, Math.abs(BLside.x - cx), SPREAD_T);
      if (Math.abs(sp.areaStripsCm2 - areaLow) > AREA_TOL) fail("spread-strips-area", { side: which, stripsCm2: sp.areaStripsCm2, bodyCm2: areaLow });
      if (Math.abs(sp.seamLenCm - seamLenUp) > 1e-4) fail("spread-seam-length-mismatch", { side: which, bodyCm: sp.seamLenCm, yokeCm: seamLenUp });
    } else {
      var Wcm = GATHER_S_RATIO * seamLenUp;
      gr = gatherBand(which, Wcm, "seam-length-half", Ps, cx, bodySegs, keep, Pcf.y, seamLenUp, areaLow);
      bodySegs = gr.bodySegs; keep = gr.keep;
    }

    var meta = {
      side: which, variant: variantT ? "T" : "S",
      seamY: Ys, seamYCenter: Ycf, bustLineY: BLy, seamDropCm: SEAM_BELOW_BL_CM,
      seamPoints: { center: P(Pcf), apex: isFront ? P(apex) : null, side: P(Ps), sideAfterClose: P(PsRot) },
      seamLenUpperCm: seamLenUp,
      seamLenLowerCm: gr ? gr.meta.seamLenBodyCm : sp.seamLenCm,
      seamDeltaCm: seamLenUp - (gr ? gr.meta.seamLenBodyCm : sp.seamLenCm),
      seamMaxDyCm: isFront ? Math.abs(Ps.y - Ys) : Math.max(Math.abs(Pcf.y - Ys), Math.abs(Ps.y - Ys)),
      absorbedDarts: absorbed, preservedDarts: preserved,
      hemSideExtraCm: hemExtra,
      areaYokeCm2: areaUp, areaBodyCm2: gr ? areaLow + gr.meta.areaAddedCm2 : sp.areaCm2, areaInputCm2: areaIn,
      droppedConstruction: dropped,
      gather: gr ? gr.meta : null
    };
    if (sp) {
      meta.flare = sp.flare;
      return {
        yoke: { outline: toPrims(yokeOutlineSegs, piece.outline), construction: yokeConstruction },
        body: { outline: sp.outline, construction: sp.construction },
        meta: meta
      };
    }
    return {
      yoke: { outline: toPrims(yokeOutlineSegs, piece.outline), construction: yokeConstruction },
      body: { outline: toPrims(bodySegs, piece.outline), construction: keep },
      meta: meta
    };
  }

  // split({front, back}, opts) → { frontYoke, frontBody, backYoke, backBody, meta:{front, back} }
  // 원자적: 앞·뒤 중 하나라도 실패하면 아무것도 반환하지 않는다. 입력은 변형하지 않는다.
  function split(geometry, opts) {
    if (!geometry || typeof geometry !== "object" || !geometry.front || !geometry.back) fail("invalid-geometry");
    var sideFn = (opts && (opts.variant === "S" || opts.variant === "T")) ? splitSideS : splitSide;   // Ⓢ(P.32)·Ⓣ(P.33) = 이음선 BL−5·앞 꺾인 선·뒤 어깨 다트 보존(Ⓣ 는 개더 대신 절개 벌림)
    var f = sideFn(deepClone(geometry.front), "front", opts);
    var b = sideFn(deepClone(geometry.back), "back", opts);
    return { frontYoke: f.yoke, frontBody: f.body, backYoke: b.yoke, backBody: b.body, meta: { front: f.meta, back: b.meta } };
  }

  window.designYokeSeam = Object.freeze({ split: split, splitSide: splitSide, ABSORB: Object.freeze(deepClone(ABSORB)), SPREAD_T: Object.freeze(deepClone(SPREAD_T)) });
})();
