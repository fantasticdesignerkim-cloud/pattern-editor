// ══════════════════════════════════════════════
// designCollar.js — 카라 모양 단계 파생(순수). 2피스 셔츠 칼라의 **칼라 스탠드**.
//
// 입력은 live 몸판이 아니라 **완료본에 고정된 bodiceResult**(bodiceCheckpoint.complete 결과):
//   · 뒤목 봉제 = bodiceResult.necklineLengths.back  · 앞목 봉제 = .front  · 합 = .half(반패턴 합계).
//     CB(뒤중심)는 접어 재단하는 반패턴.
//   · 앞끝 여밈 연장 = bodiceResult.placket.parameters.overlapCm(여밈 없으면 0). 목둘레에 미포함.
//
// ── C1c 스탠드 곡률(직선+원호 복합, 어깨 경계) ──
//   CB ─(뒤목 길이 직선)─ 어깨 경계 ─(앞목 길이 원호, CF 에서 frontRise 만큼 상승)─ CF ─(접선 여밈 연장)
//   · 직선 길이 = necklineLengths.back, 원호 목표 길이 = necklineLengths.front → 아랫선 전체 봉제 = half.
//   · 원호 시작 접선 = 뒤쪽 직선과 수평(접선 연속). 원호 끝 높이 = frontRiseCm.
//   · 윗선 = 아랫선을 스탠드 높이만큼 법선(칼라쪽)으로 오프셋 — 직선부 평행(길이=뒤목), 원호부 동심(반경 R−H)
//     → **윗선 앞목 구간이 아랫선보다 짧아짐**(곡선 스탠드 정상 성질).
//   · frontRiseCm=0 → 현재 직선 스캐폴드(C1)와 **정확히 동일**(단일 목둘레 봉제선).
//
// ★ **길이는 해석식 R·θ 메타값이 아니라 "실제 출력 primitive"를 adaptive flattening 으로 측정해 반환**한다.
//   원호는 수학적 원호가 아니라 **원호형 cubic**이므로(끝점·접선은 원 위, 사이는 근사), 반환·검증은 실제
//   cubic 길이 기준이어야 C2 칼라 본체가 흔들리지 않는다. 정확도를 위해 앞목 원호를 얕은 sub-cubic(≤30°)
//   여러 개로 분할한다(θ 클 때 단일 cubic 오차·법선거리 드리프트 방지). 실측: 실제 봉제 합 vs half ≤1e-3,
//   법선거리 vs standHeight ≤1e-2, 여밈 primitive vs extension 일치(designCollarCheck).
//
// 원호 계약: 앞목 원호 목표 길이 L=necklineLengths.front, 앞끝 올림 h=frontRiseCm.
//   L=R·θ, h=R·(1−cosθ) → θ 수치 결정 후 R=L/θ. 실패(원자적, 이전 유지): invalid-*/invalid-front-rise
//   (θ 해 없음)/invalid-stand-offset(R−H≤0)/self-intersection.
//
// 로컬 프레임(캔버스 y-down): CB x=0, 봉제 모서리 y=0, 스탠드는 위(−y). 카라는 소매에 비의존.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function cp(p) { return { x: p.x, y: p.y }; }
  function L(a, b, part) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (part) s.part = part; return s; }
  function num(v) { return typeof v === "number" && isFinite(v); }
  function add(a, b, s) { return { x: a.x + b.x * s, y: a.y + b.y * s }; }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function lineLen(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

  // ── 교재 M형(bunka-shirt-collar-M-v2) 기본값 ──
  //   밴드: 폭 3, 앞끝 올림 1(여밈 연장량 아님 — 인체 목 곡률용). 위 칼라는 아래 computeBody 의 제도 순서 참고.
  var DEFAULT_STAND_HEIGHT = 3;   // cm
  var DEFAULT_FRONT_RISE = 1;     // cm (앞끝 올림) — 교재 M
  var EPS_RISE = 1e-6;            // 이 미만이면 직선 스캐폴드(C1 정확 재현)
  var FLAT_TOL = 1e-5;           // adaptive de Casteljau 평탄 허용(길이 측정 정밀도. 형상 좌표엔 무영향)
  var SUB_ARC_MAX = Math.PI / 6;  // 원호 sub-cubic 최대 각(30°) — 얕게 유지해 근사 오차 최소화

  function referenceParams() { return { standHeightCm: DEFAULT_STAND_HEIGHT, frontRiseCm: DEFAULT_FRONT_RISE }; }

  function readBodice(bodiceResult) {
    if (!bodiceResult || typeof bodiceResult !== "object") return { ok: false, reason: "no-bodice" };
    var nl = bodiceResult.necklineLengths;
    if (!nl || !num(nl.back) || !num(nl.front) || nl.back < 0 || nl.front <= 0) return { ok: false, reason: "no-neckline" };
    var overlap = 0;
    if (bodiceResult.placket && bodiceResult.placket.parameters) {
      var o = bodiceResult.placket.parameters.overlapCm;
      if (o !== undefined && o !== null) {
        if (!num(o) || o < 0) return { ok: false, reason: "invalid-overlap" };
        overlap = o;
      }
    }
    return { ok: true, backCm: nl.back, frontCm: nl.front, overlapCm: overlap };
  }

  // 앞목 원호 각: L(1−cosθ)/θ = h, θ∈(0,π). f 증가(f(0+)=0, f(π)=2L/π). h≥2L/π → 해 없음(null).
  function solveArcAngle(Llen, h) {
    var hi = Math.PI, fhi = Llen * (1 - Math.cos(hi)) / hi;   // = 2L/π
    if (h >= fhi) return null;
    var lo = 1e-9;
    for (var i = 0; i < 80; i++) { var m = (lo + hi) / 2, fm = Llen * (1 - Math.cos(m)) / m; if (fm < h) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // ── adaptive de Casteljau: cubic 실제 호길이 + 조밀 점열(측정·자기교차 공용, 고정 N분할 금지) ──
  function distPtLine(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    if (L2 === 0) return lineLen(p, a);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / Math.sqrt(L2);
  }
  function adaptiveCubicLen(p0, p1, p2, p3, tol, depth) {
    depth = depth || 0;
    if (depth >= 20 || (distPtLine(p1, p0, p3) <= tol && distPtLine(p2, p0, p3) <= tol)) return lineLen(p0, p3);
    var p01 = mid(p0, p1), p12 = mid(p1, p2), p23 = mid(p2, p3), a = mid(p01, p12), b = mid(p12, p23), m = mid(a, b);
    return adaptiveCubicLen(p0, p01, a, m, tol, depth + 1) + adaptiveCubicLen(m, b, p23, p3, tol, depth + 1);
  }
  function segMeasure(s) {
    if (s.kind === "line") return lineLen(s.from, s.to);
    if (s.kind === "cubic") return adaptiveCubicLen(s.from, s.c1, s.c2, s.to, FLAT_TOL);
    return 0;
  }
  function sumMeasure(segs) { return segs.reduce(function (t, s) { return t + segMeasure(s); }, 0); }

  // 원호(center Cc, 반경 r)를 각 a0→a1(감소, 시계방향)로 sub-cubic 여러 개로. 각 sub 각 ≤ SUB_ARC_MAX.
  //   travel(각 감소) 접선 = (sin a, −cos a). 얕은 호라 각 cubic 이 원에 near-exact.
  function arcSubCubics(Cc, r, a0, a1, part) {
    var span = a0 - a1, N = Math.max(1, Math.ceil(span / SUB_ARC_MAX)), da = span / N, out = [];
    for (var i = 0; i < N; i++) {
      var as = a0 - da * i, ae = a0 - da * (i + 1);
      var P0 = { x: Cc.x + r * Math.cos(as), y: Cc.y + r * Math.sin(as) };
      var P3 = { x: Cc.x + r * Math.cos(ae), y: Cc.y + r * Math.sin(ae) };
      var k = (4 / 3) * r * Math.tan(da / 4);
      var t0 = { x: Math.sin(as), y: -Math.cos(as) }, t1 = { x: Math.sin(ae), y: -Math.cos(ae) };
      var s = { kind: "cubic", from: P0, c1: add(P0, t0, k), c2: add(P3, t1, -k), to: P3 };
      if (part) s.part = part;
      out.push(s);
    }
    return out;
  }
  function reverseCubic(s, part) { var r = { kind: "cubic", from: cp(s.to), c1: cp(s.c2), c2: cp(s.c1), to: cp(s.from) }; if (part) r.part = part; return r; }
  function cloneSeg(s, part) {
    var r = s.kind === "cubic" ? { kind: "cubic", from: cp(s.from), c1: cp(s.c1), c2: cp(s.c2), to: cp(s.to) } : { kind: "line", from: cp(s.from), to: cp(s.to) };
    if (part) r.part = part; else if (s.part) r.part = s.part;
    return r;
  }

  // 자기교차(원자적 실패): outline 을 조밀 점열로 펴서 비인접 선분 교차.
  function flattenSeg(s) {
    if (s.kind === "line") return [cp(s.from), cp(s.to)];
    var out = [], p0 = s.from, p1 = s.c1, p2 = s.c2, p3 = s.to;
    for (var i = 0; i <= 16; i++) { var t = i / 16, u = 1 - t;
      out.push({ x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
                 y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y }); }
    return out;
  }
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) {
    var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function outlineSelfIntersects(outline) {
    var pts = [];
    outline.forEach(function (s, i) { var f = flattenSeg(s); pts = pts.concat(i === 0 ? f : f.slice(1)); });
    var n = pts.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segCross(pts[i], pts[i + 1], pts[j], pts[j + 1])) return true;
    }
    return false;
  }

  // 반환 길이 조립(전부 실제 primitive 측정값). parts 그룹별 합.
  function measured(outline, straightPart, arcPart, extPart, topStraightPart, topArcPart, topExtPart) {
    var by = function (p) { return outline.filter(function (s) { return s.part === p; }); };
    var backM = sumMeasure(by(straightPart)), frontM = sumMeasure(by(arcPart)), extM = sumMeasure(by(extPart));
    var upStrM = sumMeasure(by(topStraightPart)), upArcM = sumMeasure(by(topArcPart)), upExtM = sumMeasure(by(topExtPart));
    return {
      lowerNeckSeamLenCm: backM + frontM, lowerExtensionLenCm: extM,
      upperNeckSegmentLenCm: upStrM + upArcM, upperExtensionLenCm: upExtM, upperTotalLenCm: upStrM + upArcM + upExtM,
      backNeckLenCm: backM, frontNeckLenCm: frontM
    };
  }

  // ── 직선 스캐폴드(frontRise≈0): C1 과 정확히 동일한 geometry(단일 목둘레 봉제선) ──
  function straightStand(back, front, overlap, H) {
    var neck = back + front, cfExt = neck + overlap;
    var cbSeam = { x: 0, y: 0 }, cbTop = { x: 0, y: -H };
    var cfSeam = { x: neck, y: 0 }, cfExtSeam = { x: cfExt, y: 0 }, cfTop = { x: cfExt, y: -H };
    var outline = [L(cbSeam, cfSeam, "neck-seam")];
    if (overlap > 0) outline.push(L(cfSeam, cfExtSeam, "extension"));
    outline.push(L(cfExtSeam, cfTop, "cf"));
    outline.push(L(cfTop, cbTop, "top"));
    outline.push(L(cbTop, cbSeam, "cb-fold"));
    // 직선은 primitive 측정 = 정확. neck-seam 전체가 목둘레, top 전체가 윗선(연장 포함).
    var neckM = segMeasure(outline[0]), extM = overlap > 0 ? segMeasure(outline[1]) : 0;
    var upperNeckEnd = { x: neck, y: -H };   // 윗선 목 끝(연장 제외) = 완성 CF 위쪽
    return {
      ok: true, standGeometry: { outline: outline, construction: [] },
      // C2 부착선 후보: 윗선 목 구간(연장 제외) CB→CF. 직선 스탠드는 단일 직선 cbTop→(neck,−H).
      upperNeckPath: [L(cbTop, upperNeckEnd, "attach")],
      lowerNeckSeamLenCm: neckM, lowerExtensionLenCm: extM,
      upperNeckSegmentLenCm: neckM, upperExtensionLenCm: extM, upperTotalLenCm: neckM + extM,
      standHeightCm: H, frontRiseCm: 0, backNeckLenCm: back, frontNeckLenCm: front,
      anchors: { cbSeam: cbSeam, cbTop: cbTop, shoulderSeam: { x: back, y: 0 }, shoulderTop: { x: back, y: -H },
        cfSeam: cfSeam, cfExtSeam: cfExtSeam, cfTop: cfTop, upperNeckEnd: upperNeckEnd }
    };
  }

  function computeStand(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var H = (params && params.standHeightCm !== undefined) ? params.standHeightCm : DEFAULT_STAND_HEIGHT;
    if (!num(H) || H <= 0) return { ok: false, reason: "invalid-stand-height" };
    var rise = (params && params.frontRiseCm !== undefined) ? params.frontRiseCm : DEFAULT_FRONT_RISE;
    if (!num(rise) || rise < 0) return { ok: false, reason: "invalid-front-rise" };
    var back = b.backCm, front = b.frontCm, overlap = b.overlapCm;

    if (rise < EPS_RISE) return straightStand(back, front, overlap, H);

    var theta = solveArcAngle(front, rise);
    if (theta === null) return { ok: false, reason: "invalid-front-rise" };
    var R = front / theta;
    if (R - H <= 0) return { ok: false, reason: "invalid-stand-offset" };

    var ct = Math.cos(theta), st = Math.sin(theta);
    var Cc = { x: back, y: -R };                       // 원호 중심(아랫·윗선 동심)
    var a0 = Math.PI / 2, a1 = Math.PI / 2 - theta;    // S 에서 CF 로 각 감소
    var cbSeam = { x: 0, y: 0 }, S = { x: back, y: 0 };
    var CF = { x: back + R * st, y: -rise };
    var tEnd = { x: ct, y: -st };                      // CF 접선(앞·위)
    var nCF = { x: -st, y: -ct };                      // CF 내향 법선(칼라쪽)
    var extTipL = add(CF, tEnd, overlap);
    var cbTop = { x: 0, y: -H }, Su = { x: back, y: -H };
    var CFu = add(CF, nCF, H);
    var extTipU = add(extTipL, nCF, H);

    var lowerArc = arcSubCubics(Cc, R, a0, a1, "neck-seam-arc");
    var upperArcFwd = arcSubCubics(Cc, R - H, a0, a1, "top-arc");        // Su → CFu (윗선 진행 방향)
    var upperArcRev = upperArcFwd.slice().reverse().map(function (s) { return reverseCubic(s, "top-arc"); });   // 폐곡선용 CFu → Su

    var outline = [L(cbSeam, S, "neck-seam-straight")].concat(lowerArc);
    if (overlap > 0) {
      outline.push(L(CF, extTipL, "extension"));
      outline.push(L(extTipL, extTipU, "cf"));
      outline.push(L(extTipU, CFu, "top-extension"));
    } else {
      outline.push(L(CF, CFu, "cf"));
    }
    outline = outline.concat(upperArcRev);
    outline.push(L(Su, cbTop, "top-straight"));
    outline.push(L(cbTop, cbSeam, "cb-fold"));

    if (outlineSelfIntersects(outline)) return { ok: false, reason: "self-intersection" };

    var m = measured(outline, "neck-seam-straight", "neck-seam-arc", "extension", "top-straight", "top-arc", "top-extension");
    // C2 부착선 후보 = 윗선 목 구간(연장 제외), CB→CF 방향으로 정렬한 실제 primitive.
    var upperNeckPath = [L(cbTop, Su, "attach")].concat(upperArcFwd.map(function (s) { return cloneSeg(s, "attach"); }));
    return {
      ok: true, standGeometry: { outline: outline, construction: [] }, upperNeckPath: upperNeckPath,
      lowerNeckSeamLenCm: m.lowerNeckSeamLenCm, lowerExtensionLenCm: m.lowerExtensionLenCm,
      upperNeckSegmentLenCm: m.upperNeckSegmentLenCm, upperExtensionLenCm: m.upperExtensionLenCm, upperTotalLenCm: m.upperTotalLenCm,
      standHeightCm: H, frontRiseCm: rise, backNeckLenCm: m.backNeckLenCm, frontNeckLenCm: m.frontNeckLenCm,
      anchors: { cbSeam: cbSeam, cbTop: cbTop, shoulderSeam: S, shoulderTop: Su, cfSeam: CF, cfExtSeam: extTipL, cfTop: CFu, upperNeckEnd: CFu }
    };
  }

  // ══ 위 칼라(칼라 본체) — 교재 M형 제도 순서(reference recipe) ══
  //   ① 밴드 CF 기준점(bandTopCf) = CF 1cm 올림점에서 밴드 아래선에 90° 윗방향으로 세운 선과 밴드 위선의 교점
  //      (= computeStand 의 CFu, 플래킷 연장 끝이 아님).
  //   ② 앞 attach점(setbackPoint) = bandTopCf 에서 **밴드 위선을 따라 CB 방향으로 호길이 frontInsetCm(0.5)**.
  //      이세·중첩·수직 간격이 아니다. 밴드 쪽 기준 봉제 길이 bandAttachLenCm = 밴드 위선 CB→setbackPoint 호길이
  //      (= upperNeckSegmentLenCm − setback, 여밈 연장 미포함).
  //   ③ CB gap점(upperCbSeam) = 밴드 위선 CB 에서 CB 선을 따라 위로 gapCm(3). gap 높이는 고정.
  //   ④ 위칼라 이음선 = gap점 → setbackPoint 의 **독립 곡선**(밴드 위선 subpath 복사 아님). 곡률은 UPPER_SEAM_RULE
  //      (CB 에서 수평 출발 · setbackPoint 에서 현(chord) 방향 도착 · 핸들 = 현 길이 × SEAM_HANDLE_FRACTION).
  //   ⑤ CB 보정: 이음선 길이가 bandAttachLenCm 와 같아지도록 gap점을 **수평으로만** 이동(이분 탐색).
  //      cbCorrectionCm = 보정된 CB x − 밴드 CB x(+ = 앞쪽).
  //   ⑥ CB 폭: upperCbSeam 에서 CB 선(수직)을 따라 위로 cbWidthCm(4) → cbOuter.
  //   ⑦ 칼라 끝(tip): setbackPoint 에 CB 선과 평행한 수직 기준선을 세우고, 앞쪽으로 수평 frontProjectionCm(1.5),
  //      setbackPoint→tip 실제 거리 pointDiagonalCm(6). 수직 성분 √(6²−1.5²)=√33.75 는 **파생값**(입력 아님).
  //   ⑧ 외곽선 cbOuter→tip. outerBowCm 은 외곽선의 추가 휨만(0=직선) — 이음선 형상과 무관.
  // 로컬 프레임은 스탠드와 같다(캔버스 y-down, 위 = −y, CB 선 = 수직).
  var M_UPPER = { gapCm: 3, cbWidthCm: 4, frontSetbackCm: 0.5, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
  function referenceBodyParams() {
    return { gapCm: M_UPPER.gapCm, cbWidthCm: M_UPPER.cbWidthCm, frontInsetCm: M_UPPER.frontSetbackCm,
      frontProjectionCm: M_UPPER.frontProjectionCm, pointDiagonalCm: M_UPPER.pointDiagonalCm, outerBowCm: M_UPPER.outerBowCm };
  }
  // 위칼라 이음선 곡률 규칙(파생 규칙 — 새 도메인 치수 아님). 핸들 1/3 은 이 파일의 외곽 휨 곡선과 같은 관례.
  var UPPER_SEAM_RULE = { startTangent: "horizontal-toward-front", endTangent: "chord", handleFraction: 1 / 3 };
  var SEAM_HANDLE_FRACTION = UPPER_SEAM_RULE.handleFraction;
  var CB_CORRECTION_TOL = 1e-9;   // 길이 정합 이분 탐색 허용치(cm)

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function unit(v) { var d = Math.hypot(v.x, v.y) || 1; return { x: v.x / d, y: v.y / d }; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function startTangent(s) { return unit(s.kind === "cubic" ? sub(s.c1, s.from) : sub(s.to, s.from)); }
  // cubic 을 t 에서 de Casteljau 로 나눈 **왼쪽[0,t]** 부분.
  function cubicSplitLeft(s, t) {
    var a = lerp(s.from, s.c1, t), b = lerp(s.c1, s.c2, t), c = lerp(s.c2, s.to, t);
    var d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
    return { kind: "cubic", from: cp(s.from), c1: a, c2: d, to: f };
  }
  // cubic 에서 시작점부터 호길이 target 이 되는 t(이분탐색, adaptive 측정).
  function tFromArcLen(s, target) {
    var lo = 0, hi = 1;
    for (var i = 0; i < 44; i++) { var m = (lo + hi) / 2; if (segMeasure(cubicSplitLeft(s, m)) < target) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  // path(정렬된 segs) 를 시작부터 호길이 target 까지 자른 subpath(중간 seg 는 정확 분할).
  function subpathByLength(path, target) {
    var acc = 0, out = [];
    for (var i = 0; i < path.length; i++) {
      var s = path[i], Ln = segMeasure(s);
      if (acc + Ln <= target + 1e-12) { out.push(cloneSeg(s)); acc += Ln; if (Math.abs(acc - target) < 1e-9) return out; continue; }
      var rem = target - acc;
      if (s.kind === "line") out.push({ kind: "line", from: cp(s.from), to: lerp(s.from, s.to, rem / Ln) });
      else out.push(cubicSplitLeft(s, tFromArcLen(s, rem)));
      return out;
    }
    return out;   // target ≥ 전체 길이 → 전체
  }
  // UPPER_SEAM_RULE 로 gap점 G → attach점 A 이음선(단일 cubic).
  function upperSeamCurve(G, A) {
    var chord = sub(A, G), h = Math.hypot(chord.x, chord.y) * SEAM_HANDLE_FRACTION, dir = unit(chord);
    return { kind: "cubic", from: cp(G), c1: { x: G.x + h, y: G.y }, c2: { x: A.x - dir.x * h, y: A.y - dir.y * h }, to: cp(A), part: "attach" };
  }
  // CB 보정: gap 높이 gapY 고정, CB x 만 이동해 이음선 길이 = targetLen. 이음선 길이는 CB x 가 앞(A 쪽)으로 갈수록 준다.
  function solveCbCorrection(gapY, A, targetLen) {
    var hi = A.x - 1e-9, lo = A.x - (targetLen + Math.abs(A.y - gapY) + 1);
    if (!(segMeasure(upperSeamCurve({ x: hi, y: gapY }, A)) < targetLen) || !(segMeasure(upperSeamCurve({ x: lo, y: gapY }, A)) > targetLen)) return null;
    for (var i = 0; i < 80; i++) {
      var m = (lo + hi) / 2, len = segMeasure(upperSeamCurve({ x: m, y: gapY }, A));
      if (len > targetLen) lo = m; else hi = m;
      if (hi - lo < 1e-12) break;
    }
    var x = (lo + hi) / 2, seam = upperSeamCurve({ x: x, y: gapY }, A), seamLen = segMeasure(seam);
    return Math.abs(seamLen - targetLen) <= CB_CORRECTION_TOL * 1e3 ? { x: x, seam: seam, seamLen: seamLen } : null;
  }

  // standResult(computeStand 반환) + { gapCm, cbWidthCm, frontInsetCm(setback), frontProjectionCm, pointDiagonalCm, outerBowCm }.
  //   반환 { ok, bodyGeometry:{outline,construction}, attachLenCm(=위칼라 이음선 실측), measure, anchors } | { ok:false, reason }.
  function computeBody(standResult, params) {
    if (!standResult || !standResult.ok || !Array.isArray(standResult.upperNeckPath) || !standResult.upperNeckPath.length) return { ok: false, reason: "invalid-stand" };
    var P = params || {};
    var gap = P.gapCm !== undefined ? P.gapCm : M_UPPER.gapCm;
    var cbW = P.cbWidthCm, setback = P.frontInsetCm, proj = P.frontProjectionCm, diag = P.pointDiagonalCm;
    var bow = P.outerBowCm !== undefined ? P.outerBowCm : 0;
    if (!num(gap) || gap <= 0) return { ok: false, reason: "invalid-gap" };
    if (!num(cbW) || cbW <= 0) return { ok: false, reason: "invalid-cb-width" };
    if (!num(setback) || setback < 0) return { ok: false, reason: "invalid-front-inset" };
    if (!num(proj) || proj < 0) return { ok: false, reason: "invalid-front-projection" };
    if (!num(diag) || diag <= proj) return { ok: false, reason: "invalid-point-diagonal" };
    if (!num(bow)) return { ok: false, reason: "invalid-outer-bow" };

    // ①② 밴드 CF 기준점·setback 점·밴드 기준 봉제 길이
    var path = standResult.upperNeckPath;                    // 밴드 위선 CB→bandTopCf(연장 제외)
    var bandTopNeckLen = sumMeasure(path);
    var bandAttachTarget = bandTopNeckLen - setback;
    if (bandAttachTarget <= 1e-9) return { ok: false, reason: "invalid-front-inset" };
    var bandAttach = subpathByLength(path, bandAttachTarget);
    var bandAttachLen = sumMeasure(bandAttach);
    var bandTopCb = cp(path[0].from), bandTopCf = cp(path[path.length - 1].to);
    var A = cp(bandAttach[bandAttach.length - 1].to);        // setbackPoint = 위칼라 이음선 앞끝
    // ③⑤ gap 점 + CB 보정(수평)
    var gapY = bandTopCb.y - gap;
    if (!(A.y > gapY)) return { ok: false, reason: "invalid-gap" };   // 이음선은 gap 점에서 앞으로 내려와야 한다
    var corr = solveCbCorrection(gapY, A, bandAttachLen);
    if (!corr) return { ok: false, reason: "cb-correction-failed" };
    var G = { x: corr.x, y: gapY };
    // ⑥ CB 폭 · ⑦ 칼라 끝
    var cbOuter = { x: G.x, y: G.y - cbW };
    var vComp = Math.sqrt(diag * diag - proj * proj);        // 파생값
    var tip = { x: A.x + proj, y: A.y - vComp };
    // ⑧ 외곽선(loop 방향 tip→cbOuter). bow=0 이면 직선 1개.
    var tCB = startTangent(corr.seam);                       // = 수평(CB 선 직각)
    var outerSegs, outerLen;
    if (bow === 0) { outerSegs = [L(tip, cbOuter, "outer")]; outerLen = lineLen(tip, cbOuter); }
    else {
      var chord = unit(sub(tip, cbOuter)), Mmid = mid(cbOuter, tip);
      var perp = { x: -chord.y, y: chord.x };                // 부착선에서 멀어지는(위) 쪽
      if (perp.y > 0) perp = { x: chord.y, y: -chord.x };
      var bowMid = add(Mmid, perp, bow);
      var hA = lineLen(cbOuter, bowMid) / 3, hB = lineLen(bowMid, tip) / 3;
      var cubicA = { kind: "cubic", from: cp(cbOuter), c1: add(cbOuter, tCB, hA), c2: add(bowMid, chord, -hA), to: cp(bowMid) };
      var cubicB = { kind: "cubic", from: cp(bowMid), c1: add(bowMid, chord, hB), c2: add(tip, chord, -hB), to: cp(tip) };
      outerSegs = [reverseCubic(cubicB, "outer"), reverseCubic(cubicA, "outer")];
      outerLen = sumMeasure(outerSegs);
    }
    // 폐곡선: 이음선(G→A) → 앞끝 사선(A→tip) → 외곽(tip→cbOuter) → CB 접힘(cbOuter→G).
    var outline = [corr.seam];
    outline.push(L(A, tip, "point-front"));
    outline = outline.concat(outerSegs);
    outline.push(L(cbOuter, G, "cb-fold"));
    if (outlineSelfIntersects(outline)) return { ok: false, reason: "self-intersection" };
    return {
      ok: true, bodyGeometry: { outline: outline, construction: [] }, attachLenCm: corr.seamLen,
      measure: {
        gapCm: gap, cbWidthCm: lineLen(cbOuter, G), frontSetbackCm: setback,
        bandTopNeckLenCm: bandTopNeckLen, bandAttachLenCm: bandAttachLen, upperCollarSeamLenCm: corr.seamLen,
        seamLengthDiffCm: corr.seamLen - bandAttachLen, cbCorrectionCm: G.x - bandTopCb.x,
        frontProjectionCm: tip.x - A.x, pointDiagonalLenCm: lineLen(tip, A), frontWidthCm: A.y - tip.y,   // frontWidthCm = 파생 수직 성분
        localTiltDeg: Math.atan2(A.y - tip.y, tip.x - A.x) * 180 / Math.PI, outerBowCm: bow, outerEdgeLenCm: outerLen
      },
      // named semantic points(reference recipe)
      anchors: { bandTopCb: bandTopCb, bandTopCf: bandTopCf, setbackPoint: A, upperCbSeam: G, cbOuter: cbOuter, tip: tip,
        cbAttach: G, target: A }
    };
  }

  // ══ C3 칼라 본체 직접 편집(관리형 선) ══ 소매산 manual 과 같은 결.
  //   관리형 체인은 항상 [cbOuter, bowMid, tip, attachFront] 로 고정 — outerBow=0(직선)도
  //   중간점 bowMid 를 명시 생성해 두 line 으로 정규화한다. 그래야 편집 anchor index 가 파라미터 상태와 무관.
  function reverseSeg(s) { return s.kind === "cubic" ? { kind: "cubic", from: cp(s.to), c1: cp(s.c2), c2: cp(s.c1), to: cp(s.from) } : { kind: "line", from: cp(s.to), to: cp(s.from) }; }
  function outlineArea(outline) {
    var pts = []; outline.forEach(function (s, i) { var f = flattenSeg(s); pts = pts.concat(i === 0 ? f : f.slice(1)); });
    var a = 0; for (var i = 0; i < pts.length; i++) { var j = (i + 1) % pts.length; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y; }
    return Math.abs(a) / 2;
  }

  // 파라미터 본체 geometry → 관리형 체인(cbOuter→bowMid→tip→attachFront) + 고정(locked: 위칼라 이음선).
  //   반환 { segments, anchors, locked:{attachSegs, attachCB, attachFront, cbOuter} } | null.
  function collarBodyLineFromGeometry(g) {
    if (!g || !Array.isArray(g.outline)) return null;
    var byPart = function (p) { return g.outline.filter(function (s) { return s.part === p; }); };
    var attach = byPart("attach"), outer = byPart("outer"), pfront = byPart("point-front"), fold = byPart("cb-fold");
    if (!attach.length || !outer.length || pfront.length !== 1 || fold.length !== 1) return null;
    var attachCB = cp(attach[0].from), attachFront = cp(attach[attach.length - 1].to);
    var cbOuter = cp(fold[0].from);           // cb-fold: cbOuter → attachCB
    var tip = cp(outer[0].from);              // outer(loop) 시작 = tip
    // outer 를 cbOuter→bowMid→tip 두 세그로 정규화(직선=두 line, 곡선=두 cubic)
    var outerNorm;
    if (outer.length === 1) { var bm = mid(cbOuter, tip); outerNorm = [L(cbOuter, bm), L(bm, tip)]; }
    else outerNorm = [reverseSeg(outer[outer.length - 1]), reverseSeg(outer[0])];   // [tip→bowMid, bowMid→cbOuter] → 역
    var tipToAttach = reverseSeg(pfront[0]);  // point-front(attachFront→tip) 역 = tip → attachFront
    var segments = outerNorm.concat([tipToAttach]);
    var anchors = segments.map(function (s) { return cp(s.from); }); anchors.push(cp(segments[segments.length - 1].to));
    return { segments: segments, anchors: anchors,
      locked: { attachSegs: attach.map(function (s) { return cloneSeg(s); }), attachCB: attachCB, attachFront: attachFront, cbOuter: cbOuter } };
  }

  // ★ 관리형 선이 source of truth. params 로 외곽·포인트를 다시 계산하지 않는다(params 는 복귀용 보존).
  //   고정 부착선(locked.attachSegs) + 편집된 관리형 체인으로 본체 재조립·검증.
  //   허용 접점: cb-fold↔체인은 cbOuter 만, 부착선↔체인은 attachFront 만(둘 다 인접 세그 공유 endpoint 라
  //   proper-crossing 검사가 자동 허용). 그 외 횡단·침범은 outlineSelfIntersects 가 잡는다(blanket tolerance 없음).
  function computeFromBodyLine(managedSegs, locked) {
    if (!Array.isArray(managedSegs) || managedSegs.length < 2) return { ok: false, reason: "no-line" };
    if (!locked || !Array.isArray(locked.attachSegs) || !locked.attachSegs.length) return { ok: false, reason: "no-attach" };
    var start = managedSegs[0].from, end = managedSegs[managedSegs.length - 1].to;
    if (lineLen(start, locked.cbOuter) > 1e-6) return { ok: false, reason: "endpoint-cbouter" };     // 첫 anchor=cbOuter 고정
    if (lineLen(end, locked.attachFront) > 1e-6) return { ok: false, reason: "endpoint-attachfront" }; // 마지막 anchor=attachFront 고정
    var revManaged = managedSegs.slice().reverse().map(function (s) { return reverseSeg(s); });        // attachFront→…→cbOuter
    var parts = ["point-front"]; for (var k = 1; k < revManaged.length; k++) parts.push("outer");
    var outline = locked.attachSegs.map(function (s) { return cloneSeg(s, "attach"); });
    revManaged.forEach(function (s, i) { var c = cloneSeg(s); c.part = parts[i] || "outer"; outline.push(c); });
    outline.push(L(locked.cbOuter, locked.attachCB, "cb-fold"));
    for (var i = 0; i < outline.length; i++) { var nx = outline[(i + 1) % outline.length]; if (lineLen(outline[i].to, nx.from) > 1e-6) return { ok: false, reason: "not-closed" }; }
    if (outlineSelfIntersects(outline)) return { ok: false, reason: "self-intersection" };            // 부착선 침범·CB fold 교차·자기교차 포함
    if (outlineArea(outline) < 0.01) return { ok: false, reason: "degenerate-area" };
    var tip = cp(revManaged[0].to);   // point-front 끝 = tip
    return {
      ok: true, bodyGeometry: { outline: outline, construction: [] }, attachLenCm: sumMeasure(locked.attachSegs),
      measure: { outerEdgeLenCm: sumMeasure(outline.filter(function (s) { return s.part === "outer"; })), pointDiagonalLenCm: lineLen(tip, locked.attachFront) }
    };
  }

  // 완료 게이트용: outline 폐곡선·자기교차·퇴화 검증. {ok, reason}.
  // ══════════════════════════════════════════════
  // 한 장 셔츠 칼라(교재 P.147 제도 방법, 예: 칼라 G P.63) — family 2 전용 생성기.
  //   M(밴드+위칼라 2피스)과 데이터·의미를 섞지 않는다. 결과는 한 조각(달림선·꺾임선·외곽선·CB·앞끝).
  //
  // 로컬 좌표(M 과 같은 관례): CB = x 0, 기초 안내선 ① = y 0, 위쪽 = −y.
  //   ① 수평 기초 안내선, ② CB 수직선.
  //   ③ N0 = CB 에서 올림 치수 ★ 위 → (0, −rise)
  //   ④ A  = N0 에서 CB 에 직각(수평)으로 뒤목 길이 × → (back, −rise)
  //   ⑤ B  = A 에서 앞목 길이 ⊘ 를 기초선 ① 까지 → (A.x + √(⊘²−★²), 0)
  //   ⑥ 달림선 = N0→A 직선 + A→B 곡선(현 중점에서 위쪽으로 attachCurve 만큼 볼록)
  //   ⑦ C  = B 에서 수평으로 칼라 끝 치수 → (B.x + proj, 0)
  //   ⑧⑨ D(앞끝) = C 수직선 위에서 |B→D| = 앞 칼라 폭 → (C.x, −√(앞폭²−proj²))
  //   2-① 안내선 = A 에서 달림 기초선(N0→A, A→B)과 동일한 각도 = 두 수직선의 이등분 방향 u
  //   2-② CB 에서 칼라 허리·뒤 칼라 폭을 잡고(뒤 중심선에 직각) 안내선 u 와 만난 점이 F_a·O_a
  //   2-③④ 꺾임선 안내 = CB허리 → F_a → B / 외곽 안내 = CB폭 → O_a → D(칼라 끝)
  //   2-⑤⑥ "완만한 선으로 수정" = 이 파일의 기존 관례(접선 연속 cubic, 핸들 = 현 길이 × 1/3)로 고정한다.
  //        ★ 교재는 손으로 정리하라고만 하므로 **이 정리 규칙은 구현 관례**이고 교재 수치가 아니다.
  //   외곽 길이는 목둘레에 맞추지 않는다(교재: 가봉 필요). 달림선 실측과 ×+⊘ 는 측정값으로만 보고.
  var ONE_PIECE_METHOD = { page: 147, smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION };
  function upNormal(from, to) { var d = unit(sub(to, from)); return { x: d.y, y: -d.x }; }   // 위쪽(−y) 법선
  // 안내 폴리라인 P0 → Pm → P1 을 "완만한 선"으로: 시작 접선 = 수평(+x, CB 에 직각), 그 외 = 현 방향, 핸들 1/3.
  function smoothGuide(P0, Pm, P1, part) {
    var chord = unit(sub(P1, P0));
    var h1 = lineLen(P0, Pm) * SEAM_HANDLE_FRACTION, h2 = lineLen(Pm, P1) * SEAM_HANDLE_FRACTION;
    var c1 = { kind: "cubic", from: cp(P0), c1: { x: P0.x + h1, y: P0.y }, c2: add(Pm, chord, -h1), to: cp(Pm), part: part };
    var c2 = { kind: "cubic", from: cp(Pm), c1: add(Pm, chord, h2), c2: add(P1, chord, -h2), to: cp(P1), part: part };
    return [c1, c2];
  }
  // 달림선 A→B: 현 중점에서 위쪽으로 bow 만큼 볼록(교재 0.2). bow=0 이면 직선.
  function attachBow(A, B, bow, part) {
    if (bow === 0) return [L(A, B, part)];
    var chord = unit(sub(B, A)), bowMid = add(mid(A, B), upNormal(A, B), bow);
    var h1 = lineLen(A, bowMid) * SEAM_HANDLE_FRACTION, h2 = lineLen(bowMid, B) * SEAM_HANDLE_FRACTION;
    return [
      { kind: "cubic", from: cp(A), c1: add(A, chord, h1), c2: add(bowMid, chord, -h1), to: cp(bowMid), part: part },
      { kind: "cubic", from: cp(bowMid), c1: add(bowMid, chord, h2), c2: add(B, chord, -h2), to: cp(B), part: part }
    ];
  }
  // params = { riseCm(★), backCollarWidthCm, collarStandCm(칼라 허리), frontCollarWidthCm, tipProjectionCm, attachCurveCm }
  //   반환 { ok, geometry:{outline,construction}, measure, anchors } | { ok:false, reason }.
  function computeOnePiece(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var rise = P.riseCm, backW = P.backCollarWidthCm, stand = P.collarStandCm;
    var frontW = P.frontCollarWidthCm, proj = P.tipProjectionCm, bow = P.attachCurveCm;
    if (!num(rise) || rise <= 0) return { ok: false, reason: "invalid-rise" };
    if (!num(backW) || backW <= 0) return { ok: false, reason: "invalid-back-collar-width" };
    if (!num(stand) || stand <= 0 || stand >= backW) return { ok: false, reason: "invalid-collar-stand" };
    if (!num(proj) || proj < 0) return { ok: false, reason: "invalid-tip-projection" };
    if (!num(frontW) || frontW <= proj) return { ok: false, reason: "invalid-front-collar-width" };
    if (!num(bow) || bow < 0) return { ok: false, reason: "invalid-attach-curve" };
    if (!(b.frontCm > rise)) return { ok: false, reason: "invalid-rise" };   // ⑤ 가 기초선에 닿지 않음

    var N0 = { x: 0, y: -rise };
    var A = { x: b.backCm, y: -rise };
    var B = { x: A.x + Math.sqrt(b.frontCm * b.frontCm - rise * rise), y: 0 };
    var C = { x: B.x + proj, y: 0 };
    var D = { x: C.x, y: -Math.sqrt(frontW * frontW - proj * proj) };
    // 2-①: A 에서 두 달림 기초선에 세운 수직선의 이등분 방향(각도기 없이 긋는 교재 방법과 동일).
    var u = unit({ x: upNormal(N0, A).x + upNormal(A, B).x, y: upNormal(N0, A).y + upNormal(A, B).y });
    if (!(u.y < 0)) return { ok: false, reason: "invalid-guide-direction" };
    var F0 = { x: 0, y: N0.y - stand }, O0 = { x: 0, y: N0.y - backW };
    var Fa = add(A, u, -stand / u.y), Oa = add(A, u, -backW / u.y);   // CB 에 직각인 수평선과 안내선의 교점

    var attach = [L(N0, A, "attach")].concat(attachBow(A, B, bow, "attach"));
    var fold = smoothGuide(F0, Fa, B, "fold");
    var outerFwd = smoothGuide(O0, Oa, D, "outer");                    // CB → 칼라 끝
    var outline = attach.slice();
    outline.push(L(B, D, "front-end"));                                // 앞 칼라 폭(칼라 끝 선)
    outerFwd.slice().reverse().forEach(function (sgm) { outline.push(reverseCubic(sgm, "outer")); });   // 칼라 끝 → CB
    outline.push(L(O0, N0, "cb"));                                     // CB(접힘) → 달림선 시작
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var attachLen = sumMeasure(attach);
    return { ok: true,
      geometry: { outline: outline, construction: fold.map(function (sgm) { return cloneSeg(sgm, "fold"); }) },
      measure: {
        riseCm: rise, backCollarWidthCm: backW, collarStandCm: stand, attachCurveCm: bow,
        attachLenCm: attachLen, neckTargetCm: b.backCm + b.frontCm, attachDiffCm: attachLen - (b.backCm + b.frontCm),
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm,
        frontCollarWidthCm: lineLen(B, D), tipProjectionCm: D.x - B.x, tipRiseCm: -D.y,
        foldLenCm: sumMeasure(fold), outerLenCm: sumMeasure(outerFwd)
      },
      anchors: { cbAttach: N0, a: A, b: B, tipBase: C, tip: D, cbFold: F0, cbOuter: O0, foldGuide: Fa, outerGuide: Oa,
        guideDir: { x: u.x, y: u.y } } };
  }

  function validateClosedOutline(outline) {
    if (!Array.isArray(outline) || outline.length < 3) return { ok: false, reason: "empty" };
    for (var i = 0; i < outline.length; i++) { var nx = outline[(i + 1) % outline.length]; if (!nx.from || !outline[i].to || lineLen(outline[i].to, nx.from) > 1e-4) return { ok: false, reason: "not-closed" }; }
    if (outlineSelfIntersects(outline)) return { ok: false, reason: "self-intersection" };
    if (outlineArea(outline) < 0.01) return { ok: false, reason: "degenerate-area" };
    return { ok: true };
  }

  window.designCollar = Object.freeze({
    referenceParams: referenceParams,
    referenceBodyParams: referenceBodyParams,
    readBodice: readBodice,
    computeStand: computeStand,
    computeBody: computeBody,
    computeOnePiece: computeOnePiece,   // family 2(한 장 셔츠 칼라, P.147)
    ONE_PIECE_METHOD: ONE_PIECE_METHOD,
    collarBodyLineFromGeometry: collarBodyLineFromGeometry,
    computeFromBodyLine: computeFromBodyLine,
    validateClosedOutline: validateClosedOutline
  });
})();
