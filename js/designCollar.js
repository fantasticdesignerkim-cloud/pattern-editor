// ══════════════════════════════════════════════
// designCollar.js — 카라 모양 단계 파생(순수). 칼라 밴드 달린 셔츠 칼라(family 3, M·N·P)와
// 한 장 셔츠 칼라(family 2, G, P.147 computeOnePiece)의 생성기.
//
// 입력은 live 몸판이 아니라 **완료본에 고정된 bodiceResult**(bodiceCheckpoint.complete 결과):
//   · 뒤목 봉제 = bodiceResult.necklineLengths.back  · 앞목 봉제 = .front  · 합 = .half(반패턴 합계).
//     CB(뒤중심)는 접어 재단하는 반패턴.
//   · 앞끝 여밈 연장 = bodiceResult.placket.parameters.overlapCm(여밈 없으면 0). 목둘레에 미포함.
//
// ── 칼라 밴드(교재 P.148 제도 방법) ──
//   ① 목둘레 치수 ×+⊘ 를 **수평 직선**으로 긋고 ② CB 수직선 ③ 밴드 폭 ⑤ 앞 중심에서 올림 치수(수직) → Ⓑ.
//   ⑥ ①을 3등분해 앞쪽 3분의 2 지점 Ⓐ ⑦ Ⓐ–Ⓑ 안내선 ⑧ Ⓑ에서 그 안내선에 **직각**으로 밴드 폭 → 밴드 앞 윗점.
//   ⑨ ⑦과 평행한 윗선 안내 ⑩ 앞 중심선 ⑪ 앞 끝선(⑩과 평행, frontEndCm).
//   ⑫⑬ 이음선·달림선을 완만하게 정리 ⑭ **Ⓑ에서 달림선 실측이 ×+⊘ 가 되도록 뒤 중심선을 수정**(길이 책임).
//   → 달림선 전체 길이 = ×+⊘(보정 후), 밴드 윗선 ⒸⒹ 는 그보다 짧다(밴드가 서면서 생기는 정상 성질).
//   교재 0.5 는 **밴드 앞 끝선**(앞 중심선 앞)이며 위 칼라 물림이 아니다.
//
// ★ **길이는 해석식이 아니라 "실제 출력 primitive"를 adaptive flattening 으로 측정해 반환**한다
//   (달림선 실측 = ×+⊘, 밴드 윗선 실측 = 위 칼라 이음선 목표). 교재가 "완만하게/자연스럽게"로만 지시한
//   곡선 정리는 이 파일의 관례(접선 연속 cubic · 핸들 = 현 길이 × 1/3, BAND_METHOD)로 고정하며
//   **구현 관례이지 교재 수치가 아니다.**
//
// 실패(원자적, 이전 유지): invalid-band-width / invalid-front-rise / invalid-front-end /
//   invalid-guide-direction / self-intersection.
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

  // ── 교재 M(P.66) 밴드 기준값 ── 수치의 단일 출처는 collarPresets 레코드이고 여기는 엔진 fallback·참조.
  var DEFAULT_BAND_WIDTH = 3;     // cm — 교재 M 밴드 폭
  var DEFAULT_FRONT_RISE = 1;     // cm — 교재 M 앞 중심 올림
  var DEFAULT_FRONT_END = 0.5;    // cm — 교재 앞 끝선(앞 중심선 앞), M~R 공통 표기
  var FLAT_TOL = 1e-5;           // adaptive de Casteljau 평탄 허용(길이 측정 정밀도. 형상 좌표엔 무영향)

  function referenceParams() { return { bandWidthCm: DEFAULT_BAND_WIDTH, frontRiseCm: DEFAULT_FRONT_RISE, frontEndCm: DEFAULT_FRONT_END }; }

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
    return { ok: true, backCm: nl.back, frontCm: nl.front, overlapCm: overlap,
      necklineProfile: bodiceResult.necklineProfile || null };
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

  // ══════════════════════════════════════════════
  // 칼라 밴드(교재 P.148 제도 방법 — 예: 칼라 N P.66). M·N·P 공용 골격, preset 치수만 다르다.
  //   로컬: CB = x 0, 목둘레 기준 수평선 ① = y 0, 위 = −y.
  //   ① 목둘레 치수(×+⊘)를 수평 직선으로 / ② CB 수직 / ③ 밴드 폭 / ⑤ 앞 중심에서 올림 치수(수직) → Ⓑ
  //   ⑥ ①을 3등분 → Ⓐ(앞쪽 3분의 2 지점) / ⑦ Ⓐ–Ⓑ 안내선 / ⑧ Ⓑ에서 ⑦에 직각으로 밴드 폭 → 밴드 앞 윗점
  //   ⑨ ⑦과 평행한 윗선 안내 / ⑩ 앞 중심선(Ⓑ–앞 윗점) / ⑪ 앞 끝선(⑩과 평행, frontEndCm 앞)
  //   ⑫⑬ 이음선·달림선을 완만하게 수정 / ⑭ Ⓑ에서 달림선 실측이 ×+⊘가 되도록 **뒤 중심선을 수정**
  //   ★ "완만하게 수정"은 교재에 수치가 없다 → 이 파일의 관례(접선 연속 cubic·핸들 1/3, ONE_PIECE_METHOD
  //     와 같은 규칙)로 고정한다. **구현 관례이며 교재 수치가 아니다.**

  // 경로 끝(앞)에서부터 호길이 target 만큼만 남긴다(⑭ 뒤 중심 수정). 반환은 CB→앞 방향.
  function trimFromEnd(path, target) {
    var rev = path.slice().reverse().map(function (s) { return reverseSeg(s); });
    var part = subpathByLength(rev, target);
    return part.slice().reverse().map(function (s) { return reverseSeg(s); });
  }
  // 경로를 수직선 x=xc 에서 자르고 앞쪽(오른쪽)만 남긴다. x 가 단조 증가하는 경로 전제.
  function trimAtX(path, xc) {
    for (var i = 0; i < path.length; i++) {
      var s = path[i], x0 = s.from.x, x1 = s.to.x;
      if (x1 < xc - 1e-12) continue;
      if (s.kind === "line") {
        var t = (x1 - x0) === 0 ? 0 : (xc - x0) / (x1 - x0);
        t = Math.max(0, Math.min(1, t));
        var cut = { kind: "line", from: { x: x0 + (x1 - x0) * t, y: s.from.y + (s.to.y - s.from.y) * t }, to: cp(s.to), part: s.part };
        return [cut].concat(path.slice(i + 1).map(function (q) { return cloneSeg(q, q.part); }));
      }
      var lo = 0, hi = 1;
      for (var k = 0; k < 80; k++) { var m = (lo + hi) / 2; if (evalCubicX(s, m) < xc) lo = m; else hi = m; }
      var right = cubicSplitRight(s, (lo + hi) / 2);
      right.part = s.part;
      return [right].concat(path.slice(i + 1).map(function (q) { return cloneSeg(q, q.part); }));
    }
    return path.slice();
  }
  function evalCubicX(s, t) {
    var u = 1 - t;
    return u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x;
  }
  function cubicSplitRight(s, t) {
    var p0 = s.from, p1 = s.c1, p2 = s.c2, p3 = s.to;
    var a = lerp(p0, p1, t), b = lerp(p1, p2, t), c = lerp(p2, p3, t);
    var d = lerp(a, b, t), e = lerp(b, c, t), f = lerp(d, e, t);
    return { kind: "cubic", from: cp(f), c1: cp(e), c2: cp(c), to: cp(p3) };
  }
  // 안내 폴리라인 P0 → Pm → P1 을 "완만한 선"으로(시작 접선 = CB 에 직각 = 수평, 그 외 현 방향, 핸들 1/3).
  function smoothBandGuide(P0, Pm, P1, part) {
    var chord = unit(sub(P1, P0));
    var h1 = lineLen(P0, Pm) * SEAM_HANDLE_FRACTION, h2 = lineLen(Pm, P1) * SEAM_HANDLE_FRACTION;
    return [
      { kind: "cubic", from: cp(P0), c1: { x: P0.x + h1, y: P0.y }, c2: add(Pm, chord, -h1), to: cp(Pm), part: part },
      { kind: "cubic", from: cp(Pm), c1: add(Pm, chord, h2), c2: add(P1, chord, -h2), to: cp(P1), part: part }
    ];
  }

  // 원호를 cubic 조각으로 만든다. F형의 잘라서 벌림 0.2cm×3을
  // 달림선을 축으로 한 연속 환형 부채꼴로 정리하는 구현 관례에 쓴다.
  function arcPoint(center, radius, angle) { return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }; }
  function arcPath(center, radius, startAngle, sweep, pieces, part) {
    var out = [], da = sweep / pieces;
    for (var i = 0; i < pieces; i++) {
      var a0 = startAngle + da * i, a1 = a0 + da, k = 4 / 3 * Math.tan(da / 4);
      var p0 = arcPoint(center, radius, a0), p1 = arcPoint(center, radius, a1);
      out.push({ kind: "cubic", from: p0,
        c1: { x: p0.x - k * radius * Math.sin(a0), y: p0.y + k * radius * Math.cos(a0) },
        c2: { x: p1.x + k * radius * Math.sin(a1), y: p1.y - k * radius * Math.cos(a1) },
        to: p1, part: part });
    }
    return out;
  }
  function isStandFProfile(profile) {
    if (!profile || profile.mode !== "parametric" || profile.type !== "stand-f") return false;
    var p = profile.parameters || {}, near = function (a, b) { return num(a) && Math.abs(a - b) < 1e-9; };
    return near(p.neckWidthCm, 3) && near(p.frontDepthCm, 3) && near(p.backDepthCm, 2) && near(p.curveAmountNorm, 1);
  }
  function computeSpreadStandalone(b, P, O) {
    if (O.requiresNecklineProfile === "stand-f" && !isStandFProfile(b.necklineProfile)) return { ok: false, reason: "stand-f-neckline-required" };
    var W = P.collarWidthCm, spread = O.slashSpreadCm, count = O.slashCount;
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(spread) || spread <= 0 || !Number.isInteger(count) || count <= 0) return { ok: false, reason: "invalid-construction-guide" };
    var N = b.backCm + b.frontCm, targetSweep = spread * count / W;
    var unitCenter = { x: 0, y: 1 }, start = -Math.PI / 2;
    var unitLen = sumMeasure(arcPath(unitCenter, 1, start, targetSweep, count, "neck-seam"));
    var R = N / unitLen, center = { x: 0, y: R };
    var attach = arcPath(center, R, start, targetSweep, count, "neck-seam");
    // adaptive 길이 측정의 절대 허용치 때문에 단위 원호를 확대하면 약 1e-5cm 차이가 날 수 있다.
    // 같은 canonical 측정기로 한 번 재비례해 달림선 자체를 목표 목둘레에 맞춘다(형상 보정이 아니라 수치 정규화).
    var firstAttachLen = sumMeasure(attach);
    R *= N / firstAttachLen; center = { x: 0, y: R };
    attach = arcPath(center, R, start, targetSweep, count, "neck-seam");
    var outer = arcPath(center, R + W, start, targetSweep, count, "outer");
    var cbSeam = cp(attach[0].from), cfSeam = cp(attach[attach.length - 1].to);
    var cbOuter = cp(outer[0].from), cfOuter = cp(outer[outer.length - 1].to);
    var outline = attach.map(function (s) { return cloneSeg(s, "neck-seam"); });
    outline.push(L(cfSeam, cfOuter, "front-edge"));
    outer.slice().reverse().forEach(function (s) { outline.push(reverseSeg2(s, "outer")); });
    outline.push(L(cbOuter, cbSeam, "cb-fold"));
    var closed = validateClosedOutline(outline); if (!closed.ok) return { ok: false, reason: closed.reason };
    // 교재의 세 벌림 위치: 전체 1/3·2/3 + 앞·뒤 어깨 맞댐 지점(뒤목/전체).
    var shoulderFraction = b.backCm / N;
    var slashFractions = [1 / 3, shoulderFraction, 2 / 3].sort(function (a, z) { return a - z; });
    var slashLines = slashFractions.map(function (f) {
      var a = start + targetSweep * f;
      return L(arcPoint(center, R, a), arcPoint(center, R + W, a), "slash-guide");
    });
    var attachLen = sumMeasure(attach), outerLen = sumMeasure(outer);
    return { ok: true,
      geometry: { outline: outline, construction: slashLines },
      measure: {
        collarWidthCm: W, frontRiseCm: 0, topSetbackCm: 0,
        baselineReductionCm: 0, guideRiseCm: 0, frontExtensionCm: 0,
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: N,
        attachLenCm: attachLen, attachDiffCm: attachLen - N,
        drawnAttachLenCm: attachLen, cbTrimCm: 0, outerLenCm: outerLen,
        frontEdgeLenCm: lineLen(cfSeam, cfOuter), spreadEachCm: spread,
        spreadCount: count, totalSpreadCm: outerLen - attachLen, shoulderFraction: shoulderFraction,
        neckWidthCm: 3, frontNeckDropCm: 3, backNeckDropCm: 2
      },
      anchors: { cbSeam: cbSeam, cbOuter: cbOuter, guideA: arcPoint(center, R, start + targetSweep * 2 / 3),
        cfSeam: cfSeam, cfOuterGuide: cfOuter, cfOuter: cfOuter,
        frontEdgeSeam: cfSeam, frontEdgeOuter: cfOuter, slashLines: slashLines,
        guideDir: { x: Math.cos(targetSweep), y: Math.sin(targetSweep) } }
    };
  }

  // params = { bandWidthCm(밴드 폭), frontRiseCm(앞 중심 올림), frontEndCm(앞 끝선 = 앞 중심선 앞 0.5) }
  //   options(선택, 기본 0 = M·N·P 무변경) — 교재 O(P.67) 가 인용하는 D(P.61) 방식:
  //     baselineReductionCm : ① 기초 수평선을 ×+⊘ 대신 **×+⊘ − 감산**으로 긋는다.
  //     guideRiseCm         : ⑥ 앞쪽 2/3 안내점 Ⓐ 를 기초선에서 그만큼 **위로** 올린다.
  //   근거 — P.61 D 본문 "앞 중심에서 올리는 치수가 많아질수록 칼라 달림선과의 오차가 커지기 때문에
  //   미리 수평선상에서 뺀다. 제도 후 달림선 치수를 재고, 뒤 중심에서 수정한다."
  //   P.146 ⑥·P.148 ⑥ 에서 기초선 위의 유일한 명명 안내점이 Ⓐ(앞쪽 2/3)이고, Ⓐ 를 올려야만
  //   그린 달림선이 짧아져(=오차 감소) ⑭ 뒤 중심 **수정(잘라냄)** 이 성립한다(내리면 길어져 반대).
  //   ★ 목표 실측(⑭)은 감산 전 ×+⊘ 그대로다 — 감산은 기초선에만 적용한다.
  function computeStand(bodiceResult, params, options) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {}, O = options || {};
    var W = P.bandWidthCm, rise = P.frontRiseCm, endCm = P.frontEndCm;
    var reduction = num(O.baselineReductionCm) ? O.baselineReductionCm : 0;
    var guideRise = num(O.guideRiseCm) ? O.guideRiseCm : 0;
    var horizontalTop = O.horizontalTopLine === true;   // 교재 Q(P.68): 칼라 외곽의 꺾임선을 수평으로 긋는다
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-band-width" };
    if (!num(rise) || rise < 0) return { ok: false, reason: "invalid-front-rise" };
    if (!num(endCm) || endCm < 0) return { ok: false, reason: "invalid-front-end" };
    if (reduction < 0 || guideRise < 0) return { ok: false, reason: "invalid-construction-guide" };
    var N = b.backCm + b.frontCm;                       // ① 목둘레 치수 ×+⊘(⑭ 목표 실측)
    var baseLen = N - reduction;                        // 기초 수평선 길이(D 방식이면 ×+⊘−감산)
    if (!(baseLen > 0)) return { ok: false, reason: "invalid-construction-guide" };
    var CB0 = { x: 0, y: 0 }, A = { x: baseLen * 2 / 3, y: -guideRise }, B = { x: baseLen, y: -rise };   // ⑥ Ⓐ / ⑤ Ⓑ
    var u = unit(sub(B, A));                            // ⑦ 안내선 방향
    var n = { x: u.y, y: -u.x };                        // 위쪽 법선
    if (!(n.y < 0)) return { ok: false, reason: "invalid-guide-direction" };
    // ⑧ Ⓑ에서 ⑦에 직각으로 밴드 폭. Q(수평 꺾임선)는 그 직각선 ⑩ 이 수평 꺾임선과 만나는 점이 앞 위 끝 Ⓒ 다.
    var Btop = horizontalTop ? add(B, n, (-W - B.y) / n.y) : add(B, n, W);
    var K = null;
    if (horizontalTop) {
      if (!(W > rise)) return { ok: false, reason: "invalid-band-width" };   // 꺾임선이 앞 달림선보다 위여야 한다
      if (!(A.x > 0) || !(Btop.x > 0)) return { ok: false, reason: "invalid-band-width" };
    } else {
      var tK = (-W - Btop.y) / u.y;                     // ⑨ ⑦과 평행한 안내선 ∩ 수평선 y=−W
      K = add(Btop, u, tK);
      if (!(K.x > 0) || !(A.x > 0)) return { ok: false, reason: "invalid-band-width" };
    }

    var attachFull = smoothBandGuide(CB0, A, B, "neck-seam");         // ⑬ 달림선
    // ⑫ 이음선(밴드 윗선). Q 는 교재 본문대로 **수평 직선**(꺾임선), 그 외는 ⑨ 안내선을 완만하게 정리한다.
    var topFull = horizontalTop ? [L({ x: 0, y: -W }, Btop, "top")] : smoothBandGuide({ x: 0, y: -W }, K, Btop, "top");
    var drawnLen = sumMeasure(attachFull);
    if (!(drawnLen >= N - 1e-9)) return { ok: false, reason: "invalid-front-rise" };   // 보정으로 줄일 수 없음
    var attach = trimFromEnd(attachFull, N);                          // ⑭ 달림선 실측 = ×+⊘ → 뒤 중심 수정
    var cbX = attach[0].from.x;
    var top = trimAtX(topFull, cbX);
    var cbSeam = cp(attach[0].from), cbTop = cp(top[0].from);
    var Bext = add(B, u, endCm), BextTop = add(Btop, u, endCm);        // ⑪ 앞 끝선

    var outline = attach.map(function (s) { return cloneSeg(s, "neck-seam"); });
    if (endCm > 0) {
      outline.push(L(B, Bext, "extension"));
      outline.push(L(Bext, BextTop, "cf"));
      outline.push(L(BextTop, Btop, "top-extension"));
    } else outline.push(L(B, Btop, "cf"));
    top.slice().reverse().forEach(function (s) { outline.push(reverseSeg2(s, "top")); });
    outline.push(L(cbTop, cbSeam, "cb-fold"));
    if (outlineSelfIntersects(outline)) return { ok: false, reason: "self-intersection" };

    var topLen = sumMeasure(top), attachLen = sumMeasure(attach);
    return {
      ok: true, standGeometry: { outline: outline, construction: [] },
      upperNeckPath: top.map(function (s) { return cloneSeg(s, "attach"); }),   // 밴드 윗선 Ⓓ→Ⓒ(연장 제외)
      lowerNeckSeamLenCm: attachLen, lowerExtensionLenCm: endCm,
      upperNeckSegmentLenCm: topLen, upperExtensionLenCm: endCm, upperTotalLenCm: topLen + endCm,
      bandWidthCm: W, frontRiseCm: rise, frontEndCm: endCm,
      baseLineLenCm: baseLen, baselineReductionCm: reduction, guideRiseCm: guideRise,   // D 방식 기초선(감산·Ⓐ 올림)
      horizontalTopLine: horizontalTop,   // Q: 꺾임선을 수평 직선으로 그렸는지
      backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: N,
      drawnAttachLenCm: drawnLen, cbTrimCm: drawnLen - N,   // ⑭ 뒤 중심 수정량(그린 길이 − 목둘레)
      anchors: { cbSeam: cbSeam, cbTop: cbTop, guideA: A, cfSeam: B, cfTop: Btop,
        cfExtSeam: Bext, cfExtTop: BextTop, upperNeckEnd: Btop, guideDir: { x: u.x, y: u.y } }
    };
  }
  function reverseSeg2(s, part) { var r = reverseSeg(s); r.part = part; return r; }

  // ══ 스탠드 칼라 A~F(교재 P.60~62, 제도법 P.146) ══
  // 셔츠 칼라의 밴드가 아니라 단독 스탠드 칼라 한 조각이다. 앞 윗점 0.5cm는 앞끝 연장이 아니라
  // 앞 중심 기준선의 윗점에서 뒤 중심 방향(윗선 안내 방향)으로 물리는 정리량이다.
  function computeStandaloneStand(bodiceResult, params, options) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {}, O = options || {}, fitNeckSeam = O.fitNeckSeam === true;
    var extendToFrontEdge = O.extendToFrontEdge === true;
    var baselineReduction = num(O.baselineReductionCm) ? O.baselineReductionCm : 0;
    var guideRise = num(O.guideRiseCm) ? O.guideRiseCm : 0;
    var W = P.collarWidthCm, rise = P.frontRiseCm, setback = P.topSetbackCm;
    if (O.slashSpreadCm !== undefined || O.slashCount !== undefined) return computeSpreadStandalone(b, P, O);
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(rise) || rise < 0) return { ok: false, reason: "invalid-front-rise" };
    if (!num(setback) || setback < 0) return { ok: false, reason: "invalid-top-setback" };
    if (baselineReduction < 0 || guideRise < 0) return { ok: false, reason: "invalid-construction-guide" };
    if (extendToFrontEdge && !(b.overlapCm > 0)) return { ok: false, reason: "front-extension-missing" };
    var N = b.backCm + b.frontCm;
    var draftedN = N - baselineReduction;
    if (!(draftedN > 0)) return { ok: false, reason: "invalid-construction-guide" };
    var CB0 = { x: 0, y: 0 }, A = { x: draftedN * 2 / 3, y: -guideRise }, B = { x: draftedN, y: -rise };
    var u = unit(sub(B, A)), n = { x: u.y, y: -u.x };
    if (!(n.y < 0)) return { ok: false, reason: "invalid-guide-direction" };
    var BtopGuide = add(B, n, W);
    // B형은 달림선이 수평이라 윗선 안내 방향도 y=-W 와 평행하다. 이때 교점을 구하면 0/0이므로
    // 목둘레 2/3 기준점 A를 같은 폭만큼 올린 점을 윗선의 제어 기준으로 쓴다.
    var K;
    if (Math.abs(u.y) < 1e-12) K = add(A, n, W);
    else { var tK = (-W - BtopGuide.y) / u.y; K = add(BtopGuide, u, tK); }
    if (!(K.x > 0) || !(A.x > 0)) return { ok: false, reason: "invalid-collar-width" };
    var Btop = add(BtopGuide, u, -setback);                 // P.60/P.146 앞 윗끝 0.5cm 물림
    var CBtop = { x: 0, y: -W };
    var attachFull = smoothBandGuide(CB0, A, B, "neck-seam");
    var outerFull = smoothBandGuide(CBtop, K, Btop, "outer");
    var drawnAttachLen = sumMeasure(attachFull), attach = attachFull, outer = outerFull;
    // C형(P.61): 앞 중심 3cm 올림으로 달림선이 목둘레보다 길어지므로 실측 후 뒤중심에서 수정한다.
    if (fitNeckSeam) {
      if (drawnAttachLen < N - 1e-9) return { ok: false, reason: "invalid-front-rise" };
      attach = trimFromEnd(attachFull, N);
      outer = trimAtX(outerFull, attach[0].from.x);
    }
    var cbSeam = cp(attach[0].from), cbOuter = cp(outer[0].from);
    // E형(P.62): B형을 제도한 뒤, 완료된 몸판의 앞중심→앞끝(여밈) 길이만큼
    // 달림선·윗선을 같은 방향으로 평행 연장한다. 연장분은 목둘레 봉제 길이에 포함하지 않는다.
    var frontExtension = extendToFrontEdge ? b.overlapCm : 0;
    var frontEdgeSeam = add(B, u, frontExtension), frontEdgeOuter = add(Btop, u, frontExtension);
    var outline = attach.map(function (s) { return cloneSeg(s, "neck-seam"); });
    if (frontExtension > 0) outline.push(L(B, frontEdgeSeam, "front-extension"));
    outline.push(L(frontEdgeSeam, frontEdgeOuter, "front-edge"));
    if (frontExtension > 0) outline.push(L(frontEdgeOuter, Btop, "outer-extension"));
    outer.slice().reverse().forEach(function (s) { outline.push(reverseSeg2(s, "outer")); });
    outline.push(L(cbOuter, cbSeam, "cb-fold"));
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };
    var attachLen = sumMeasure(attach), outerLen = sumMeasure(outer) + frontExtension;
    return { ok: true,
      geometry: { outline: outline, construction: [] },
      measure: {
        collarWidthCm: W, frontRiseCm: rise, topSetbackCm: setback,
        baselineReductionCm: baselineReduction, guideRiseCm: guideRise,
        frontExtensionCm: frontExtension,
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: N,
        attachLenCm: attachLen, attachDiffCm: attachLen - N,
        drawnAttachLenCm: drawnAttachLen, cbTrimCm: fitNeckSeam ? drawnAttachLen - N : 0,
        outerLenCm: outerLen, frontEdgeLenCm: lineLen(frontEdgeSeam, frontEdgeOuter)
      },
      anchors: { cbSeam: cbSeam, cbOuter: cbOuter, guideA: A, cfSeam: B,
        cfOuterGuide: BtopGuide, cfOuter: Btop, frontEdgeSeam: frontEdgeSeam, frontEdgeOuter: frontEdgeOuter,
        outerGuide: K, guideDir: { x: u.x, y: u.y } }
    };
  }

  // ══ 위 칼라(교재 P.148 step 2·3) ══ 밴드 결과 위에 제도한다. M·N·P 공용.
  //   ①②③ CB 에 직각인 안내선으로 **간격(gapCm)** 과 **뒤 위 칼라 폭(cbWidthCm)** 을 잡는다(밴드 윗선 CB Ⓓ 기준).
  //   ④ Ⓒ(밴드 윗선 앞 끝 = 앞 중심선 위쪽)에서 곧게 올린 안내선 / ⑤ ④와 평행한 안내선(frontProjectionCm 앞)
  //   ⑥ 이음선 = gap 점 → Ⓒ 자연스러운 곡선(관례: CB 수평 출발 · 현 방향 도착 · 핸들 1/3)
  //   ⑦ 앞 위 칼라 폭(pointDiagonalCm) = Ⓒ 에서 ⑤ 안내선까지 → 칼라 끝
  //   ⑧ 외곽선 = 칼라 끝 → CB 폭 점(같은 관례, outerBowCm 은 추가 휨 옵션으로 교재 수치가 아니다)
  //   step 3: **Ⓒ에서 ⒸⒹ(밴드 윗선) 길이와 같아지도록 위칼라 뒤 중심을 수평 이동**(이분 탐색).
  //   ★ 앞 물림(setback)은 없다 — 교재의 0.5 는 밴드 **앞 끝선**(앞 중심선 앞 0.5)이며 computeStand 가 그린다.
  // 교재 M(P.66) 위 칼라 기준값(엔진 fallback·참조). 수치의 단일 출처는 collarPresets 레코드다.
  var M_UPPER = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
  function referenceBodyParams() {
    return { gapCm: M_UPPER.gapCm, cbWidthCm: M_UPPER.cbWidthCm,
      frontProjectionCm: M_UPPER.frontProjectionCm, pointDiagonalCm: M_UPPER.pointDiagonalCm, outerBowCm: M_UPPER.outerBowCm };
  }
  // 위칼라 이음선 곡률 규칙(파생 규칙 — 새 도메인 치수 아님). 핸들 1/3 은 이 파일의 외곽 휨 곡선과 같은 관례.
  var UPPER_SEAM_RULE = { startTangent: "horizontal-toward-front", endTangent: "chord", handleFraction: 1 / 3 };
  var SEAM_HANDLE_FRACTION = UPPER_SEAM_RULE.handleFraction;
  // 밴드(P.148) 제도법 메타: 페이지·곡선 정리 관례. handleFraction 은 UPPER_SEAM_RULE 과 같은 단일 출처.
  var BAND_METHOD = { page: 148, smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION, guidePoint: "front-third" };
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

  // standResult(computeStand 반환) + { gapCm, cbWidthCm, frontProjectionCm, pointDiagonalCm, outerBowCm }.
  //   이음선 앞끝은 밴드 윗선 앞 끝 Ⓒ 그대로(물림 없음)이고, 길이 목표는 밴드 윗선 ⒸⒹ **전체**다.
  //   반환 { ok, bodyGeometry:{outline,construction}, attachLenCm(=위칼라 이음선 실측), measure, anchors } | { ok:false, reason }.
  function computeBody(standResult, params) {
    if (!standResult || !standResult.ok || !Array.isArray(standResult.upperNeckPath) || !standResult.upperNeckPath.length) return { ok: false, reason: "invalid-stand" };
    var P = params || {};
    var gap = P.gapCm !== undefined ? P.gapCm : M_UPPER.gapCm;
    var cbW = P.cbWidthCm, proj = P.frontProjectionCm, diag = P.pointDiagonalCm;
    var bow = P.outerBowCm !== undefined ? P.outerBowCm : 0;
    if (!num(gap) || gap <= 0) return { ok: false, reason: "invalid-gap" };
    if (!num(cbW) || cbW <= 0) return { ok: false, reason: "invalid-cb-width" };
    if (!num(proj) || proj < 0) return { ok: false, reason: "invalid-front-projection" };
    if (!num(diag) || diag <= proj) return { ok: false, reason: "invalid-point-diagonal" };
    if (!num(bow)) return { ok: false, reason: "invalid-outer-bow" };

    // ①② 밴드 윗선 Ⓓ→Ⓒ 와 그 실측 길이(위칼라 이음선의 목표 길이)
    var path = standResult.upperNeckPath;                    // 밴드 윗선 Ⓓ(CB)→Ⓒ(앞 중심), 앞 끝선 연장 제외
    var bandTopNeckLen = sumMeasure(path);
    var bandAttachLen = bandTopNeckLen;                      // step 3 목표 = ⒸⒹ 전체
    var bandTopCb = cp(path[0].from), bandTopCf = cp(path[path.length - 1].to);
    var A = cp(bandTopCf);                                   // 위칼라 이음선 앞끝 = Ⓒ (물림 없음)
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
        gapCm: gap, cbWidthCm: lineLen(cbOuter, G),
        bandTopNeckLenCm: bandTopNeckLen, bandAttachLenCm: bandAttachLen, upperCollarSeamLenCm: corr.seamLen,
        seamLengthDiffCm: corr.seamLen - bandAttachLen, cbCorrectionCm: G.x - bandTopCb.x,
        frontProjectionCm: tip.x - A.x, pointDiagonalLenCm: lineLen(tip, A), frontWidthCm: A.y - tip.y,   // frontWidthCm = 파생 수직 성분
        localTiltDeg: Math.atan2(A.y - tip.y, tip.x - A.x) * 180 / Math.PI, outerBowCm: bow, outerEdgeLenCm: outerLen
      },
      // named semantic points(reference recipe)
      anchors: { bandTopCb: bandTopCb, bandTopCf: bandTopCf, attachFront: A, upperCbSeam: G, cbOuter: cbOuter, tip: tip,
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
  //   ⑥ 달림선 = N0→A 직선 + A→B 곡선. 기본은 현 중점에서 위쪽으로 attachCurve 만큼 볼록,
  //        K형은 같은 치수를 유지한 채 attachCurveDirection="reversed"로 반대쪽에 곡률을 둔다.
  //   ⑦ C  = B 에서 수평으로 칼라 끝 치수 → (B.x + proj, 0)
  //   ⑧⑨ D(앞끝) = C 수직선 위에서 |B→D| = 앞 칼라 폭 → (C.x, −√(앞폭²−proj²))
  //   2-① 안내선 = A 에서 달림 기초선(N0→A, A→B)과 동일한 각도 = 두 수직선의 이등분 방향 u
  //   2-② CB 에서 칼라 허리(N0→F0)를 잡고, 그 위에 뒤 칼라 폭(F0→O0)을 이어 잡는다.
  //        두 치수는 같은 기준점에서 포개 재는 값이 아니다(J: 허리4 > 뒤폭3.5도 유효).
  //        각 수평선과 안내선 u 가 만난 점이 F_a·O_a.
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
  // 달림선 A→B: signedBow 양수면 위쪽, 음수면 반대쪽(K형). 0이면 직선.
  function attachBow(A, B, signedBow, part) {
    var bow = signedBow;
    if (bow === 0) return [L(A, B, part)];
    var chord = unit(sub(B, A)), bowMid = add(mid(A, B), upNormal(A, B), bow);
    var h1 = lineLen(A, bowMid) * SEAM_HANDLE_FRACTION, h2 = lineLen(bowMid, B) * SEAM_HANDLE_FRACTION;
    return [
      { kind: "cubic", from: cp(A), c1: add(A, chord, h1), c2: add(bowMid, chord, -h1), to: cp(bowMid), part: part },
      { kind: "cubic", from: cp(bowMid), c1: add(bowMid, chord, h2), c2: add(B, chord, -h2), to: cp(B), part: part }
    ];
  }
  // params = { riseCm(★), backCollarWidthCm, collarStandCm(칼라 허리), frontCollarWidthCm, tipProjectionCm,
  //            attachCurveCm, attachCurveDirection?("as-drawn" 기본 | "reversed") }
  //   반환 { ok, geometry:{outline,construction}, measure, anchors } | { ok:false, reason }.
  function computeOnePiece(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var rise = P.riseCm, backW = P.backCollarWidthCm, stand = P.collarStandCm;
    var frontW = P.frontCollarWidthCm, proj = P.tipProjectionCm, bow = P.attachCurveCm;
    var curveDir = P.attachCurveDirection == null ? "as-drawn" : P.attachCurveDirection;
    if (!num(rise) || rise <= 0) return { ok: false, reason: "invalid-rise" };
    if (!num(backW) || backW <= 0) return { ok: false, reason: "invalid-back-collar-width" };
    if (!num(stand) || stand <= 0) return { ok: false, reason: "invalid-collar-stand" };
    if (!num(proj) || proj < 0) return { ok: false, reason: "invalid-tip-projection" };
    if (!num(frontW) || frontW <= proj) return { ok: false, reason: "invalid-front-collar-width" };
    if (!num(bow) || bow < 0) return { ok: false, reason: "invalid-attach-curve" };
    if (curveDir !== "as-drawn" && curveDir !== "reversed") return { ok: false, reason: "invalid-attach-curve-direction" };
    if (!(b.frontCm > rise)) return { ok: false, reason: "invalid-rise" };   // ⑤ 가 기초선에 닿지 않음

    var N0 = { x: 0, y: -rise };
    var A = { x: b.backCm, y: -rise };
    var B = { x: A.x + Math.sqrt(b.frontCm * b.frontCm - rise * rise), y: 0 };
    var C = { x: B.x + proj, y: 0 };
    var D = { x: C.x, y: -Math.sqrt(frontW * frontW - proj * proj) };
    // 2-①: A 에서 두 달림 기초선에 세운 수직선의 이등분 방향(각도기 없이 긋는 교재 방법과 동일).
    var u = unit({ x: upNormal(N0, A).x + upNormal(A, B).x, y: upNormal(N0, A).y + upNormal(A, B).y });
    if (!(u.y < 0)) return { ok: false, reason: "invalid-guide-direction" };
    var outerDepth = stand + backW;
    var F0 = { x: 0, y: N0.y - stand }, O0 = { x: 0, y: N0.y - outerDepth };
    var Fa = add(A, u, -stand / u.y), Oa = add(A, u, -outerDepth / u.y);   // CB 에 직각인 수평선과 안내선의 교점

    var signedBow = curveDir === "reversed" ? -bow : bow;
    var attach = [L(N0, A, "attach")].concat(attachBow(A, B, signedBow, "attach"));
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
        riseCm: rise, backCollarWidthCm: backW, collarStandCm: stand, attachCurveCm: bow, attachCurveDirection: curveDir,
        attachLenCm: attachLen, neckTargetCm: b.backCm + b.frontCm, attachDiffCm: attachLen - (b.backCm + b.frontCm),
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm,
        frontCollarWidthCm: lineLen(B, D), tipProjectionCm: D.x - B.x, tipRiseCm: -D.y,
        foldLenCm: sumMeasure(fold), outerLenCm: sumMeasure(outerFwd)
      },
      anchors: { cbAttach: N0, a: A, b: B, tipBase: C, tip: D, cbFold: F0, cbOuter: O0, foldGuide: Fa, outerGuide: Oa,
        guideDir: { x: u.x, y: u.y } } };
  }

  // ══════════════════════════════════════════════
  // 오픈 칼라(교재 L, P.65) — **몸판 연동(body-linked) 전용 생성 계약**.
  //   family 2 의 G~K(한 장, P.147 computeOnePiece)와 데이터·의미를 섞지 않는다:
  //   G~K 는 목둘레 길이(×·⊘)와 올림 ★ 만으로 독립 생성되지만, L 은 교재 본문대로
  //   **"몸판의 목둘레와 앞 꺾임선을 그린 뒤 그 치수를 토대로" 제도**한다.
  //
  // ── 몸판 쪽(실제 앞판 외곽에서 읽는다) ──
  //   · FNP = 앞판 center edge ∩ neckline edge 공유 끝점(앞 중심 목점).
  //   · 꺾임선 윗 끝 = FNP 에서 **목둘레 곡선을 따라(호길이)** frontStraightCm(교재 4) 뒤 지점.
  //   · 꺾임 끝 = 여밈 끝선(앞 중심 + 여밈분) 위에서 **FNP 와의 두 점 사이 직선거리**가
  //     breakPointDistanceCm(교재 8)인 점. 여밈분 0 이면 앞 중심선 위(교재 수치 그대로 적용).
  //   · "꺾임선을 앞 중심에서 떨어뜨린다" = 윗 끝을 앞 중심(FNP)이 아니라 목둘레선 위 4cm 뒤에 둔 것.
  //
  // ── 칼라 쪽(로컬 프레임: CB x=0, 기초선 y=0, 위 = −y) ──
  //   ① 기초 수평선(CB 에 직각) ② CB 에서 칼라 허리 3 → 꺾임선 CB 끝, 이어서 뒤 폭 3.5 → 외곽 CB 끝
  //   ③ 앞 끝 F = 기초선에서 수직으로 frontEndRiseCm(교재 1) 위
  //   ④ 달림선 = CB 에서 F 로 가는 완만한 곡선이되 **앞 끝에서 frontStraightCm(4) 구간은 직선**
  //   ⑤ **길이 책임**: 달림선 실측 = ×+⊘ 가 되도록 기초선 길이(=앞 끝의 위치)를 결정한다.
  //      → 꺾임점 J 의 기초선 위 들림은 **파생값**이며 독립 목표 수치가 아니다.
  //   ⑥ 외곽선 = 기초선과 나란한 **수평 직선**(교재: 외곽을 수평선으로 하면 골선 재단 가능)
  //   ⑦ 앞 끝선 = 외곽 오른쪽 끝에서 F 까지 수직
  //   ⑧ 칼라 꺾임선 = CB 허리점 → J(완만한 곡선)
  //   ★ ④⑧ 의 "완만한 곡선"은 교재에 수치가 없다 → 이 파일의 관례(시작 접선은 기초선과 나란함,
  //     핸들 = 현 길이 × 1/3)로 고정한다. **구현 관례이며 교재 수치가 아니다**(OPEN_COLLAR_METHOD).
  //
  // 실패(원자적, 이전 유지): invalid-back-collar-width / invalid-collar-stand / invalid-front-end-rise /
  //   invalid-front-straight / invalid-break-point / no-body-neckline / no-body-center /
  //   ambiguous-front-neck-point / break-start-out-of-neckline / attach-length-unreachable / self-intersection.
  var OPEN_COLLAR_METHOD = { page: 65, methodPage: 147, smoothing: "tangent-continuous-cubic",
    handleFraction: SEAM_HANDLE_FRACTION, lengthResponsibility: "attach-equals-neck", bodyLinked: true };
  var JOIN_TOL = 0.02;   // cm — 몸판 외곽 primitive 끝점 연결 허용치(designBodice 와 같은 기준)

  // 몸판 outline primitive(line/cubic/path) 의 양 끝 on-curve 점.
  function primEnds(s) {
    if (!s) return null;
    if (s.kind === "path") {
      var cs = s.commands || [], first = cs[0], last = cs[cs.length - 1];
      if (!first || !last || !first.points || !last.points) return null;
      return [cp(first.points[0]), cp(last.points[last.points.length - 1])];
    }
    if (!s.from || !s.to) return null;
    return [cp(s.from), cp(s.to)];
  }
  // 몸판 outline primitive → line/cubic 세그먼트 목록(측정·분할 공용 형식).
  function primToSegs(s) {
    if (!s) return [];
    if (s.kind === "line") return [{ kind: "line", from: cp(s.from), to: cp(s.to) }];
    if (s.kind === "cubic") return [{ kind: "cubic", from: cp(s.from), c1: cp(s.c1), c2: cp(s.c2), to: cp(s.to) }];
    if (s.kind === "path") {
      var out = [], cur = null;
      (s.commands || []).forEach(function (c) {
        if (!c || !c.points || !c.points.length) return;
        if (c.type === "M") { cur = cp(c.points[0]); return; }
        if (c.type === "C" && cur) { out.push({ kind: "cubic", from: cp(cur), c1: cp(c.points[0]), c2: cp(c.points[1]), to: cp(c.points[2]) }); cur = cp(c.points[2]); }
      });
      return out;
    }
    return [];
  }
  // start 에서 출발해 끝점 연결로 이어붙인 체인(방향 정규화). 좌표 근접이 아니라 **연결만** 본다.
  function chainFromPoint(prims, start) {
    var pool = prims.slice(), out = [], cur = cp(start), guard = 0;
    while (pool.length && guard++ < 200) {
      var found = -1, rev = false;
      for (var i = 0; i < pool.length; i++) {
        var e = primEnds(pool[i]); if (!e) continue;
        if (lineLen(e[0], cur) <= JOIN_TOL) { found = i; rev = false; break; }
        if (lineLen(e[1], cur) <= JOIN_TOL) { found = i; rev = true; break; }
      }
      if (found < 0) break;
      var ss = primToSegs(pool.splice(found, 1)[0]);
      if (!ss.length) continue;
      if (rev) ss = ss.slice().reverse().map(function (q) { return reverseSeg(q); });
      out = out.concat(ss);
      cur = cp(out[out.length - 1].to);
    }
    return out;
  }
  // 몸판 앞판에서 앞 중심 목점(FNP) + FNP 에서 출발하는 목둘레 체인을 **의미 모서리(SV3)** 로만 찾는다.
  function frontNecklineFromBodice(bodiceResult) {
    var fr = bodiceResult && bodiceResult.front;
    if (!fr || !Array.isArray(fr.outline)) return { ok: false, reason: "no-body-neckline" };
    var neck = [], center = [];
    fr.outline.forEach(function (s) { if (s.edge === "neckline") neck.push(s); else if (s.edge === "center") center.push(s); });
    if (!neck.length) return { ok: false, reason: "no-body-neckline" };
    if (!center.length) return { ok: false, reason: "no-body-center" };
    var hits = [];
    neck.forEach(function (n) {
      var ne = primEnds(n); if (!ne) return;
      center.forEach(function (c) {
        var ce = primEnds(c); if (!ce) return;
        ne.forEach(function (p) { ce.forEach(function (q) { if (lineLen(p, q) <= JOIN_TOL && !hits.some(function (h) { return lineLen(h, p) <= JOIN_TOL; })) hits.push(cp(p)); }); });
      });
    });
    if (hits.length !== 1) return { ok: false, reason: "ambiguous-front-neck-point" };
    var chain = chainFromPoint(neck, hits[0]);
    if (!chain.length) return { ok: false, reason: "no-body-neckline" };
    return { ok: true, fnp: hits[0], chain: chain, chainLenCm: sumMeasure(chain) };
  }
  // 몸판 앞 꺾임선(교재 L): 목둘레선 위 4cm 지점 → 여밈 끝선 위 직선 8cm 지점.
  function buildBreakLine(bodiceResult, b, startArc, pointDistance) {
    var nk = frontNecklineFromBodice(bodiceResult);
    if (!nk.ok) return nk;
    if (!(nk.chainLenCm > startArc)) return { ok: false, reason: "break-start-out-of-neckline" };
    var head = subpathByLength(nk.chain, startArc);
    var top = cp(head[head.length - 1].to);
    var overlap = b.overlapCm;                       // 여밈분(없으면 0 → 꺾임 끝은 앞 중심선 위)
    if (!(pointDistance > overlap)) return { ok: false, reason: "invalid-break-point" };
    var drop = Math.sqrt(pointDistance * pointDistance - overlap * overlap);
    var end = { x: nk.fnp.x + overlap, y: nk.fnp.y + drop };   // 앞판 프레임: +x = 여밈 바깥, +y = 아래
    return { ok: true, frontNeckPoint: nk.fnp, breakTop: top, breakEnd: end, overlapCm: overlap, breakDropCm: drop,
      breakLine: [L(top, end, "break-line")], breakLineLenCm: lineLen(top, end), frontNeckChainLenCm: nk.chainLenCm };
  }
  // 기초선 길이 Lb 에서 달림선(완만한 곡선 + 앞쪽 직선) 한 벌. 실패 시 null.
  //   J 는 안내 곡선 위에서 **앞 끝 F 와의 직선 거리가 정확히 straight(교재 4)** 인 점이다 —
  //   교재의 4 는 그려진 직선 구간의 길이이므로 호길이가 아니라 그 현으로 잡는다.
  function openAttachFor(Lb, rise, straight) {
    var O = { x: 0, y: 0 }, F = { x: Lb, y: -rise };
    var chord = lineLen(O, F); if (!(chord > straight)) return null;
    var u = unit(sub(F, O)), h = chord * SEAM_HANDLE_FRACTION;
    var guide = { kind: "cubic", from: cp(O), c1: { x: O.x + h, y: O.y }, c2: add(F, u, -h), to: cp(F) };
    if (!(segMeasure(guide) > straight)) return null;
    var lo = 0, hi = 1;                              // |guide(t)→F| 는 t 에 대해 단조 감소
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (lineLen(cubicSplitLeft(guide, m).to, F) > straight) lo = m; else hi = m; }
    var head = cubicSplitLeft(guide, (lo + hi) / 2);
    var J = cp(head.to);
    var attach = [cloneSeg(head, "attach"), L(J, F, "attach-front")];   // 완만한 곡선 + 앞 끝 직선(교재 4)
    return { attach: attach, J: J, F: F, attachLenCm: sumMeasure(attach) };
  }
  // params = { backCollarWidthCm, collarStandCm, frontEndRiseCm, frontStraightCm, breakPointDistanceCm }
  //   반환 { ok, geometry:{outline,construction}, measure, anchors, bodyLink } | { ok:false, reason }.
  function computeOpenCollar(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var backW = P.backCollarWidthCm, stand = P.collarStandCm, rise = P.frontEndRiseCm;
    var straight = P.frontStraightCm, breakDist = P.breakPointDistanceCm;
    if (!num(backW) || backW <= 0) return { ok: false, reason: "invalid-back-collar-width" };
    if (!num(stand) || stand <= 0) return { ok: false, reason: "invalid-collar-stand" };
    if (!num(rise) || rise < 0) return { ok: false, reason: "invalid-front-end-rise" };
    if (!num(straight) || straight <= 0) return { ok: false, reason: "invalid-front-straight" };
    if (!num(breakDist) || breakDist <= 0) return { ok: false, reason: "invalid-break-point" };
    var neck = b.backCm + b.frontCm;
    if (!(straight < neck)) return { ok: false, reason: "invalid-front-straight" };
    if (!(rise < stand + backW)) return { ok: false, reason: "invalid-front-end-rise" };   // 앞 끝선 길이 > 0

    // ── 몸판 연동: 실제 목둘레선·여밈 끝선에서 앞 꺾임선을 먼저 그린다 ──
    var link = buildBreakLine(bodiceResult, b, straight, breakDist);
    if (!link.ok) return link;

    // ── 길이 책임: 달림선 실측 = ×+⊘ 가 되도록 기초선 길이를 이분 탐색(달림선 길이는 Lb 에 단조 증가) ──
    var hi = neck + rise + 1, lo = straight;
    var probe = openAttachFor(hi, rise, straight);
    if (!probe || probe.attachLenCm < neck) return { ok: false, reason: "attach-length-unreachable" };
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2, t = openAttachFor(mid, rise, straight);
      if (t && t.attachLenCm < neck) lo = mid; else hi = mid;
    }
    var A = openAttachFor((lo + hi) / 2, rise, straight);
    if (!A) return { ok: false, reason: "attach-length-unreachable" };
    var Lb = A.F.x, F = A.F, J = A.J;
    var O = { x: 0, y: 0 }, E = { x: Lb, y: 0 };
    var cbFold = { x: 0, y: -stand }, cbOuter = { x: 0, y: -(stand + backW) };
    var outerEnd = { x: Lb, y: -(stand + backW) };

    var outline = [L(O, cbOuter, "cb")];                           // CB(접힘)
    outline.push(L(cbOuter, outerEnd, "outer"));                   // ⑥ 외곽 수평 직선
    outline.push(L(outerEnd, F, "front-end"));                     // ⑦ 앞 끝선(수직)
    A.attach.slice().reverse().forEach(function (s) { outline.push(reverseSeg2(s, s.part)); });   // 달림선 F→J→CB
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var foldSeg = smoothToPoint(cbFold, J, "fold");                // ⑧ 칼라 꺾임선
    var construction = [L(O, E, "baseline"), foldSeg];             // ① 기초선 + 꺾임선
    var attachLen = sumMeasure(A.attach);
    return { ok: true,
      geometry: { outline: outline, construction: construction },
      measure: {
        backCollarWidthCm: backW, collarStandCm: stand, frontEndRiseCm: rise, frontStraightCm: straight,
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: neck,
        attachLenCm: attachLen, attachDiffCm: attachLen - neck,
        baseLineLenCm: Lb, foldJunctionLiftCm: -J.y,                 // 들림 = 파생값(독립 목표 수치 아님)
        cbHeightCm: stand + backW, outerLenCm: lineLen(cbOuter, outerEnd), frontEdgeLenCm: lineLen(outerEnd, F),
        foldLenCm: segMeasure(foldSeg),
        breakPointDistanceCm: breakDist, breakDropCm: link.breakDropCm, frontOverlapCm: link.overlapCm,
        breakStartArcCm: straight, breakLineLenCm: link.breakLineLenCm
      },
      anchors: { cbAttach: O, cbFold: cbFold, cbOuter: cbOuter, baseEnd: E, outerEnd: outerEnd, frontEnd: F, foldJunction: J },
      bodyLink: { frontNeckPoint: link.frontNeckPoint, breakTop: link.breakTop, breakEnd: link.breakEnd,
        overlapCm: link.overlapCm, breakLine: link.breakLine }
    };
  }
  // 완만한 곡선 한 구간: 시작 접선은 기초선과 나란함(CB 직각 표시), 끝은 현 방향, 핸들 1/3(구현 관례).
  function smoothToPoint(P0, P1, part) {
    var u = unit(sub(P1, P0)), h = lineLen(P0, P1) * SEAM_HANDLE_FRACTION;
    return { kind: "cubic", from: cp(P0), c1: { x: P0.x + h, y: P0.y }, c2: add(P1, u, -h), to: cp(P1), part: part };
  }

  // ══════════════════════════════════════════════
  // 윙 칼라(교재 Q, P.68) — 밴드(P.148) + **수평 꺾임선** + 앞 위 끝의 칼라 끝부분.
  //   교재 본문: "몸판의 목둘레 치수를 토대로 칼라 밴드를 그리는데, **칼라 외곽의 꺾임선은 수평으로
  //   그린다**. 이어서 **앞 위 끝**에, 칼라 끝부분만 제도한다." → 위 칼라(M~P의 본체)는 없다.
  //
  // 밴드는 computeStand(…, { horizontalTopLine: true }) 가 그린다(달림선 실측 = ×+⊘, ⑭ 뒤 중심 수정,
  //   앞 끝선 0.5 는 M~P와 같은 연장량). 앞 위 끝 Ⓒ = 앞 중심선 ⑩ ∩ 수평 꺾임선.
  //
  // 칼라 끝(윙) — 전부 꺾임선(수평)과 Ⓒ 기준(사용자 확정 도메인 결정):
  //   ① 뒤 제도점 P = 꺾임선 위에서 Ⓒ 에서 뒤로 tipBaseCm(교재 7)
  //   ② 꼭짓점 T = Ⓒ 에서 뒤로 tipSetbackCm(교재 1.5) 수평 후퇴한 수직선 위,
  //      앞변 |T→Ⓒ| = tipEdgeCm(교재 4.5) → **세로 성분 √(4.5²−1.5²) 은 파생값**(독립 입력 아님)
  //   ③ 외곽선 P→T 는 교재 도해처럼 완만하게 연결 — 이 파일 관례(시작 접선은 꺾임선과 나란함,
  //      핸들 = 현 길이 × 1/3). ★ **구현 관례이며 교재 수치가 아니다**(WING_METHOD).
  //
  // 실패(원자적): invalid-stand / invalid-tip-base / invalid-tip-setback / invalid-tip-edge /
  //   tip-base-too-long / self-intersection.
  var WING_METHOD = { page: 68, bandMethodPage: 148, foldLine: "horizontal",
    smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION, derivedTipHeight: true };

  // params = { tipBaseCm, tipSetbackCm, tipEdgeCm }
  function computeWingTip(standResult, params) {
    var st = standResult;
    if (!st || st.ok !== true || !st.anchors || !num(st.bandWidthCm)) return { ok: false, reason: "invalid-stand" };
    if (st.horizontalTopLine !== true) return { ok: false, reason: "invalid-stand" };   // 수평 꺾임선 밴드에서만
    var P = params || {};
    var base = P.tipBaseCm, setback = P.tipSetbackCm, edge = P.tipEdgeCm;
    if (!num(base) || base <= 0) return { ok: false, reason: "invalid-tip-base" };
    if (!num(setback) || setback <= 0) return { ok: false, reason: "invalid-tip-setback" };
    if (!num(edge) || !(edge > setback)) return { ok: false, reason: "invalid-tip-edge" };       // 세로 성분 > 0
    if (!(base > setback)) return { ok: false, reason: "invalid-tip-base" };                     // 뒤 제도점이 꼭짓점보다 뒤
    var foldLen = st.upperNeckSegmentLenCm;
    if (!num(foldLen) || !(base < foldLen)) return { ok: false, reason: "tip-base-too-long" };   // 꺾임선 안에 들어가야 한다

    var C = cp(st.anchors.cfTop);                       // Ⓒ = 앞 위 끝(앞변 발점)
    var height = Math.sqrt(edge * edge - setback * setback);   // 파생 세로 성분
    var back = { x: C.x - base, y: C.y };               // ① 꺾임선 위 뒤 제도점
    var tip = { x: C.x - setback, y: C.y - height };    // ② 칼라 끝 꼭짓점(위 = −y)
    var outer = smoothToPoint(back, tip, "outer");      // ③ 완만한 외곽선

    var outline = [outer, L(tip, C, "tip-front"), L(C, back, "fold")];
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    return { ok: true,
      geometry: { outline: outline, construction: [] },
      measure: {
        tipBaseCm: base, tipSetbackCm: setback, tipEdgeCm: edge,
        tipHeightCm: height,                               // 파생(√(앞변²−후퇴²))
        foldBaseLenCm: lineLen(C, back),                   // 실측 = 7
        tipEdgeLenCm: lineLen(tip, C),                     // 실측 = 4.5
        tipSetbackLenCm: C.x - tip.x,                      // 실측 = 1.5
        outerEdgeLenCm: segMeasure(outer),                 // 완만한 곡선 실측(밑변 7 보다 길다)
        foldLineLenCm: foldLen, bandWidthCm: st.bandWidthCm
      },
      anchors: { foldFront: C, foldBack: back, tip: tip } };
  }

  // ══════════════════════════════════════════════
  // 밴드+위 칼라 한 장(교재 R, P.68) — "칼라 밴드에 이어서 위 칼라를 그린다".
  //   본문: "칼라 밴드와 위 칼라를 1장으로 이어서 제도한다. 어깨부터 앞까지 칼라 외곽 치수가
  //   부족해지기 쉬워, 칼라 밴드 단추를 채우지 않고 입는 경우에 적합하다."
  //   → 밴드는 M·N·P 와 같은 P.148 골격(달림선 실측 = ×+⊘, ⑭ 뒤 중심 수정, 앞 끝선 0.5)이고,
  //     그 **밴드 윗선(이음선)을 경계로 위 칼라가 한 장으로 이어진다**(별도 조각·간격 없음).
  //
  // 위 칼라(도해 실측으로 확정한 점·선·방향):
  //   ① CB: 밴드 윗선 CB 점에서 **CB(수직)로 위 칼라 폭 3.5** → 외곽 CB 점 Ⓞ
  //   ② 외곽 뒤 구간: Ⓞ 에서 **CB 에 직각(수평)으로 뒤 목둘레 ×** → 어깨점 Ⓢ
  //      (본문 "어깨부터 앞까지"의 어깨. 도해 실측 8.41cm, ×/(×+⊘)=0.416)
  //   ③ 앞 위 끝 Ⓕ: 밴드 윗선 앞 끝 Ⓒ 에서 **CB 와 나란히(수직) 앞 칼라 폭 6.5** 위
  //      (도해 실측 6.63cm, Ⓒ·Ⓕ 의 x 차이 0.00)
  //   ④ 외곽 앞 구간: Ⓢ→Ⓕ 를 현(弦) 기준 **0.5 처진 완만한 곡선**(도해 실측 0.52)
  //      곡선 정리는 이 파일 관례(시작 접선은 ② 수평 구간과 나란함, 핸들 = 현 길이 × 1/3) —
  //      ★ **구현 관례이며 교재 수치가 아니다**(BAND_ONE_PIECE_METHOD). 0.5 처짐만 교재 수치다.
  //   밴드 윗선은 조각 경계가 아니라 **이음선 자리(construction)** 로 남는다.
  //
  // 실패(원자적): invalid-stand / invalid-upper-width / invalid-front-width / invalid-outer-bow /
  //   invalid-outer-back / self-intersection.
  var BAND_ONE_PIECE_METHOD = { page: 68, bandMethodPage: 148, joined: true,
    outerBackFrom: "back-neck", smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION };

  // params = { upperWidthCm, frontWidthCm, outerBowCm }
  function computeBandOnePiece(bodiceResult, standParams, params) {
    var st = computeStand(bodiceResult, standParams);
    if (!st.ok) return st;
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var upW = P.upperWidthCm, frW = P.frontWidthCm, bow = P.outerBowCm;
    if (!num(upW) || upW <= 0) return { ok: false, reason: "invalid-upper-width" };
    if (!num(frW) || frW <= 0) return { ok: false, reason: "invalid-front-width" };
    if (!num(bow) || bow < 0) return { ok: false, reason: "invalid-outer-bow" };

    var cbSeam = cp(st.anchors.cbSeam), cbTop = cp(st.anchors.cbTop), C = cp(st.anchors.cfTop);
    var Ocb = { x: cbTop.x, y: cbTop.y - upW };          // ① 위 칼라 CB(수직)
    var S = { x: Ocb.x + b.backCm, y: Ocb.y };           // ② 외곽 뒤 구간 = 뒤 목둘레 ×(수평)
    var F = { x: C.x, y: C.y - frW };                    // ③ 앞 위 끝(Ⓒ 에서 수직)
    if (!(S.x < F.x)) return { ok: false, reason: "invalid-outer-back" };   // 어깨점이 앞 위 끝보다 뒤여야 한다
    var chord = unit(sub(F, S)), down = { x: -chord.y, y: chord.x };        // 현의 아래쪽(밴드 쪽) 법선
    if (!(down.y > 0)) down = { x: chord.y, y: -chord.x };
    var M = add(mid(S, F), down, bow);                   // ④ 현에서 0.5 처진 통과점
    var outerFront = smoothBandGuide(S, M, F, "outer");  // 시작 접선 = ② 수평 구간과 나란함

    var pick = function (p) { return st.standGeometry.outline.filter(function (s) { return s.part === p; }); };
    var attach = pick("neck-seam").map(function (s) { return cloneSeg(s, "neck-seam"); });
    var frontBlock = st.standGeometry.outline.filter(function (s) {
      return s.part === "extension" || s.part === "cf" || s.part === "top-extension";
    }).map(function (s) { return cloneSeg(s, s.part); });
    var bandTop = pick("top").map(function (s) { return cloneSeg(s, "band-top"); });   // 이음선 자리(구성선)

    var outline = attach.slice();
    frontBlock.forEach(function (s) { outline.push(s); });
    outline.push(L(C, F, "front-edge"));                                   // ③ 앞 칼라 폭
    outerFront.slice().reverse().forEach(function (s) { outline.push(reverseCubic(s, "outer")); });   // Ⓕ→Ⓢ
    outline.push(L(S, Ocb, "outer-back"));                                 // ② Ⓢ→Ⓞ(수평)
    outline.push(L(Ocb, cbSeam, "cb-fold"));                               // CB 전체(위 칼라 + 밴드)
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var outerFrontLen = sumMeasure(outerFront), outerBackLen = lineLen(Ocb, S);
    return { ok: true,
      geometry: { outline: outline, construction: bandTop },
      measure: {
        bandWidthCm: st.bandWidthCm, frontRiseCm: st.frontRiseCm, frontEndCm: st.frontEndCm,
        upperWidthCm: upW, frontWidthCm: frW, outerBowCm: bow,
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: st.neckTargetCm,
        lowerNeckSeamLenCm: st.lowerNeckSeamLenCm, lowerExtensionLenCm: st.lowerExtensionLenCm,
        cbTrimCm: st.cbTrimCm, bandTopLenCm: st.upperNeckSegmentLenCm,   // 이음선 자리 실측
        outerBackLenCm: outerBackLen,          // 실측 = ×
        outerFrontLenCm: outerFrontLen,        // 완만한 곡선 실측(현보다 김)
        outerLenCm: outerBackLen + outerFrontLen,
        frontEdgeLenCm: lineLen(C, F),         // 실측 = 앞 칼라 폭
        cbHeightCm: lineLen(Ocb, cbSeam)       // 실측 = 밴드 폭 + 위 칼라 폭
      },
      anchors: { cbSeam: cbSeam, bandTopCb: cbTop, outerCb: Ocb, shoulder: S, bandTopCf: C, frontTop: F,
        cfSeam: cp(st.anchors.cfSeam), cfExtSeam: cp(st.anchors.cfExtSeam), cfExtTop: cp(st.anchors.cfExtTop) },
      stand: st };
  }

  function validateClosedOutline(outline) {
    if (!Array.isArray(outline) || outline.length < 3) return { ok: false, reason: "empty" };
    for (var i = 0; i < outline.length; i++) { var nx = outline[(i + 1) % outline.length]; if (!nx.from || !outline[i].to || lineLen(outline[i].to, nx.from) > 1e-4) return { ok: false, reason: "not-closed" }; }
    if (outlineSelfIntersects(outline)) return { ok: false, reason: "self-intersection" };
    if (outlineArea(outline) < 0.01) return { ok: false, reason: "degenerate-area" };
    return { ok: true };
  }

  window.designCollar = Object.freeze({
    BAND_METHOD: BAND_METHOD,
    referenceParams: referenceParams,
    referenceBodyParams: referenceBodyParams,
    readBodice: readBodice,
    computeStand: computeStand,
    computeStandaloneStand: computeStandaloneStand,   // family 1(스탠드 칼라 A, P.146)
    computeBody: computeBody,
    computeOnePiece: computeOnePiece,   // family 2(한 장 셔츠 칼라, P.147)
    ONE_PIECE_METHOD: ONE_PIECE_METHOD,
    computeBandOnePiece: computeBandOnePiece,   // family 3(밴드+위 칼라 한 장 R, P.68)
    BAND_ONE_PIECE_METHOD: BAND_ONE_PIECE_METHOD,
    computeWingTip: computeWingTip,   // family 3(윙 칼라 Q, P.68 — 수평 꺾임선 + 칼라 끝)
    WING_METHOD: WING_METHOD,
    computeOpenCollar: computeOpenCollar,   // family 2(오픈 칼라 L, P.65 — 몸판 연동)
    OPEN_COLLAR_METHOD: OPEN_COLLAR_METHOD,
    frontNecklineFromBodice: frontNecklineFromBodice,   // 순수(하네스·검증용)
    collarBodyLineFromGeometry: collarBodyLineFromGeometry,
    computeFromBodyLine: computeFromBodyLine,
    validateClosedOutline: validateClosedOutline
  });
})();
