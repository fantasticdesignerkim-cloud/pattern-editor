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

  var DEFAULT_STAND_HEIGHT = 3;   // cm
  var DEFAULT_FRONT_RISE = 1.5;   // cm (앞끝 올림)
  var EPS_RISE = 1e-6;            // 이 미만이면 직선 스캐폴드(C1 정확 재현)
  var FLAT_TOL = 1e-4;           // adaptive de Casteljau 평탄 허용(코드베이스 관례)
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
    return {
      ok: true, standGeometry: { outline: outline, construction: [] },
      lowerNeckSeamLenCm: neckM, lowerExtensionLenCm: extM,
      upperNeckSegmentLenCm: neckM, upperExtensionLenCm: extM, upperTotalLenCm: neckM + extM,
      standHeightCm: H, frontRiseCm: 0, backNeckLenCm: back, frontNeckLenCm: front,
      anchors: { cbSeam: cbSeam, cbTop: cbTop, shoulderSeam: { x: back, y: 0 }, shoulderTop: { x: back, y: -H },
        cfSeam: cfSeam, cfExtSeam: cfExtSeam, cfTop: cfTop }
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
    var upperArcRev = arcSubCubics(Cc, R - H, a0, a1, null).reverse().map(function (s) { return reverseCubic(s, "top-arc"); });

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
    return {
      ok: true, standGeometry: { outline: outline, construction: [] },
      lowerNeckSeamLenCm: m.lowerNeckSeamLenCm, lowerExtensionLenCm: m.lowerExtensionLenCm,
      upperNeckSegmentLenCm: m.upperNeckSegmentLenCm, upperExtensionLenCm: m.upperExtensionLenCm, upperTotalLenCm: m.upperTotalLenCm,
      standHeightCm: H, frontRiseCm: rise, backNeckLenCm: m.backNeckLenCm, frontNeckLenCm: m.frontNeckLenCm,
      anchors: { cbSeam: cbSeam, cbTop: cbTop, shoulderSeam: S, shoulderTop: Su, cfSeam: CF, cfExtSeam: extTipL, cfTop: CFu }
    };
  }

  window.designCollar = Object.freeze({
    referenceParams: referenceParams,
    readBodice: readBodice,
    computeStand: computeStand
  });
})();
