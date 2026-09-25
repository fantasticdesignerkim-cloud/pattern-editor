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

  // ── 플랫 칼라 S(교재 P.69) — 몸판에 직접 그리고 어깨선에서 맞댄다 ──
  // 근거: P.69 S 본문·도해 + P.149(플랫 칼라 T 제도 방법)의 **공통 절차**.
  //   공통(P.149 ①②⑤⑥): 칼라 끝 안내선(앞 중심선에 평행) → FNP 에서 안내선으로 앞 칼라 폭(6·4)
  //     → 어깨에서 칼라 폭(5.5) → 뒤 중심에서 칼라 끝까지 외곽선(③ 뒤 중심 폭선에 **직각**,
  //     나머지는 완만한 곡선으로 ②에 연결).
  //   S 전용(T 와 다른 점): 앞뒤 몸판을 **겹치지 않는다**(T 의 어깨 3.5 겹침 없음) ·
  //     달림선은 **몸판 목둘레선 그대로**(T 의 ④ 재작도·뒤 중심 0.5 올림 없음) ·
  //     앞뒤 칼라를 **어깨선에서 맞대어**(butt) 한 장으로 잇는다.
  //   ★ 몸판 형상은 입력일 뿐 바꾸지 않는다 — 최종 bodice geometry 의 목둘레선·어깨선·중심선만 읽는다.
  //   ★ 어깨 칼라 폭은 교재대로 **제도된 어깨선 위 직선거리**로 잡는다(뒤 어깨다트 절개량을
  //     빼거나 더하는 자동 보정을 하지 않는다 — 봉제 길이 정리는 패턴 확정 단계 책임).
  var FLAT_COLLAR_S_METHOD = { page: 69, methodPage: 149, variant: "S", bodyLinked: true,
    attachFrom: "bodice-neckline", join: "shoulder-butt", shoulderOverlapCm: 0, cbRiseCm: 0,
    smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION };

  // 몸판 한 조각에서 목점·목둘레 체인·SNP·중심선 방향·어깨선 방향을 **의미 모서리(SV3)** 로만 읽는다.
  //   실패: no-body-neckline / no-body-center / no-body-shoulder / ambiguous-neck-point.
  function bodiceSeamFrame(bodiceResult, piece) {
    var pc = bodiceResult && bodiceResult[piece];
    if (!pc || !Array.isArray(pc.outline)) return { ok: false, reason: "no-body-neckline" };
    var neck = [], center = [], shoulder = [];
    pc.outline.forEach(function (s) {
      if (s.edge === "neckline") neck.push(s);
      else if (s.edge === "center") center.push(s);
      else if (s.edge === "shoulder") shoulder.push(s);
    });
    if (!neck.length) return { ok: false, reason: "no-body-neckline" };
    if (!center.length) return { ok: false, reason: "no-body-center" };
    if (!shoulder.length) return { ok: false, reason: "no-body-shoulder" };
    var hits = [];
    neck.forEach(function (n) {
      var ne = primEnds(n); if (!ne) return;
      center.forEach(function (c) {
        var ce = primEnds(c); if (!ce) return;
        ne.forEach(function (p) {
          ce.forEach(function (q) {
            if (lineLen(p, q) <= JOIN_TOL && !hits.some(function (h) { return lineLen(h, p) <= JOIN_TOL; })) hits.push(cp(p));
          });
        });
      });
    });
    if (hits.length !== 1) return { ok: false, reason: "ambiguous-neck-point" };
    var neckPoint = hits[0];
    // 목점에서 출발하는 목둘레 primitive 도 하나여야 체인이 유일하다(둘 이상이면 방향을 고를 수 없다).
    var starts = neck.filter(function (n) {
      var e = primEnds(n); return !!e && (lineLen(e[0], neckPoint) <= JOIN_TOL || lineLen(e[1], neckPoint) <= JOIN_TOL);
    });
    if (starts.length !== 1) return { ok: false, reason: "ambiguous-neck-point" };
    var chain = chainFromPoint(neck, neckPoint);
    if (!chain.length) return { ok: false, reason: "no-body-neckline" };
    var snp = cp(chain[chain.length - 1].to);
    var centerChain = chainFromPoint(center, neckPoint);
    if (!centerChain.length) return { ok: false, reason: "no-body-center" };
    var centerFar = cp(centerChain[centerChain.length - 1].to);
    if (lineLen(centerFar, neckPoint) < 1e-6) return { ok: false, reason: "no-body-center" };
    // 어깨선 방향 = SNP 에 닿는 어깨 span(뒤판은 어깨다트로 끊겨 있어도 SNP 쪽 span 이 어깨선이다).
    var sdir = null;
    shoulder.forEach(function (s) {
      if (sdir) return;
      var e = primEnds(s); if (!e) return;
      if (lineLen(e[0], snp) <= JOIN_TOL) sdir = unit(sub(e[1], e[0]));
      else if (lineLen(e[1], snp) <= JOIN_TOL) sdir = unit(sub(e[0], e[1]));
    });
    if (!sdir) return { ok: false, reason: "no-body-shoulder" };
    // 어깨 끝점(SP): 어깨 span 의 끝점 중 SNP 에서 어깨선 방향으로 가장 먼 점.
    //   뒤판은 어깨다트로 span 이 끊겨 있어도(두 span 이 같은 직선) 제도된 어깨 끝을 그대로 얻는다.
    var tip = null, far = -Infinity;
    shoulder.forEach(function (s) {
      var e = primEnds(s); if (!e) return;
      e.forEach(function (p) {
        var d = (p.x - snp.x) * sdir.x + (p.y - snp.y) * sdir.y;
        if (d > far) { far = d; tip = cp(p); }
      });
    });
    return { ok: true, neckPoint: neckPoint, chain: chain, snp: snp, shoulderTip: tip,
      centerDir: unit(sub(centerFar, neckPoint)), shoulderDir: sdir };
  }

  // 외곽선: 뒤 중심 폭선(③)에 직각으로 출발해 어깨 폭 지점을 지나 칼라 끝까지 완만한 곡선.
  //   smoothBandGuide 와 같은 관례(접선 연속·핸들 = 현 길이 × 1/3)이고, 출발 접선만
  //   프레임 x 축(= CB 에 직각) 방향으로 둔다.
  function flatOuterGuide(P0, Pm, P1, part) {
    var chord = unit(sub(P1, P0));
    var h1 = lineLen(P0, Pm) * SEAM_HANDLE_FRACTION, h2 = lineLen(Pm, P1) * SEAM_HANDLE_FRACTION;
    var sx = (Pm.x >= P0.x) ? 1 : -1;
    return [
      { kind: "cubic", from: cp(P0), c1: { x: P0.x + sx * h1, y: P0.y }, c2: add(Pm, chord, -h1), to: cp(Pm), part: part },
      { kind: "cubic", from: cp(Pm), c1: add(Pm, chord, h2), c2: add(P1, chord, -h2), to: cp(P1), part: part }
    ];
  }

  // params: { collarWidthCm(5.5), frontEndFromFnpCm(6), frontEndOffsetCm(4) }
  //   실패: no-bodice / no-neckline / 몸판 의미 모서리 실패 / invalid-collar-width /
  //     invalid-front-end / invalid-front-end-offset / front-end-unreachable /
  //     shoulder-butt-overlap / self-intersection.
  function computeFlatCollarS(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var W = P.collarWidthCm, EL = P.frontEndFromFnpCm, EO = P.frontEndOffsetCm;
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(EL) || EL <= 0) return { ok: false, reason: "invalid-front-end" };
    if (!num(EO) || EO < 0) return { ok: false, reason: "invalid-front-end-offset" };
    if (!(EO < EL)) return { ok: false, reason: "front-end-unreachable" };   // 안내선까지 EL 로 닿지 않는다
    var bk = bodiceSeamFrame(bodiceResult, "back"); if (!bk.ok) return bk;
    var fr = bodiceSeamFrame(bodiceResult, "front"); if (!fr.ok) return fr;

    // 뒤: 뒤 중심 칼라 폭(③) · 어깨 칼라 폭(⑤)
    var cbNeck = bk.neckPoint, cbOuter = add(cbNeck, bk.centerDir, W);
    var shoulderB = add(bk.snp, bk.shoulderDir, W);
    // 앞: 칼라 끝(① 안내선 ∥ 앞 중심선 · ② FNP 에서 EL)
    var nPerp = { x: fr.centerDir.y, y: -fr.centerDir.x };
    var inward = (nPerp.x * (fr.snp.x - fr.neckPoint.x) + nPerp.y * (fr.snp.y - fr.neckPoint.y)) >= 0
      ? nPerp : { x: -nPerp.x, y: -nPerp.y };                 // 앞 중심선에서 몸판 안쪽
    var tipF = add(add(fr.neckPoint, inward, EO), fr.centerDir, Math.sqrt(EL * EL - EO * EO));
    var shoulderF = add(fr.snp, fr.shoulderDir, W);

    // 맞댐: 앞 조각을 어깨선(SNP→어깨 폭 지점)에 맞춰 **회전 이동**(뒤집지 않는다).
    var a = unit(sub(shoulderF, fr.snp)), c = unit(sub(shoulderB, bk.snp));
    var rc = a.x * c.x + a.y * c.y, rs = a.x * c.y - a.y * c.x;
    var toBack = function (p) {
      var dx = p.x - fr.snp.x, dy = p.y - fr.snp.y;
      return { x: bk.snp.x + dx * rc - dy * rs, y: bk.snp.y + dx * rs + dy * rc };
    };
    // 맞댄 두 조각은 어깨선을 사이에 두고 **반대쪽**이어야 한다(겹치면 임의로 뒤집지 않고 실패).
    var fnpB = toBack(fr.neckPoint);
    var sideBack = c.x * (cbNeck.y - bk.snp.y) - c.y * (cbNeck.x - bk.snp.x);
    var sideFront = c.x * (fnpB.y - bk.snp.y) - c.y * (fnpB.x - bk.snp.x);
    if (!(sideBack * sideFront < 0)) return { ok: false, reason: "shoulder-butt-overlap" };

    // 칼라 프레임: CB 목점 = 원점, CB 의 몸통 방향 → +y (순수 회전, 반사 없음).
    var fc = bk.centerDir.y, fs = bk.centerDir.x;
    var toFrame = function (p) {
      var dx = p.x - cbNeck.x, dy = p.y - cbNeck.y;
      return { x: dx * fc - dy * fs, y: dx * fs + dy * fc };
    };
    var mapBack = function (p) { return toFrame(p); };
    var mapFront = function (p) { return toFrame(toBack(p)); };
    var mapSeg = function (s, f, part) {
      return s.kind === "line"
        ? { kind: "line", from: f(s.from), to: f(s.to), part: part }
        : { kind: "cubic", from: f(s.from), c1: f(s.c1), c2: f(s.c2), to: f(s.to), part: part };
    };

    var O = { x: 0, y: 0 };
    var cbOuterC = mapBack(cbOuter), snpC = mapBack(bk.snp), shoulderC = mapBack(shoulderB);
    var fnpC = mapFront(fr.neckPoint), tipC = mapFront(tipF);
    // 달림선 = 몸판 목둘레선 그대로(뒤 CB→SNP + 앞 SNP→FNP).
    var backAttach = bk.chain.map(function (s) { return mapSeg(s, mapBack, "neck-seam"); });
    var frontAttach = fr.chain.slice().reverse().map(function (s) { return mapSeg(reverseSeg(s), mapFront, "neck-seam"); });
    var outer = flatOuterGuide(cbOuterC, shoulderC, tipC, "outer");

    var outline = backAttach.concat(frontAttach);
    outline.push(L(fnpC, tipC, "front-edge"));                                    // 앞 끝선(②)
    outer.slice().reverse().forEach(function (s) { outline.push(reverseCubic(s, "outer")); });
    outline.push(L(cbOuterC, O, "cb-fold"));                                      // 뒤 중심(접어 재단)
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var backLen = sumMeasure(backAttach), frontLen = sumMeasure(frontAttach);
    return { ok: true,
      geometry: { outline: outline, construction: [L(snpC, shoulderC, "shoulder-butt")] },
      measure: {
        collarWidthCm: W, frontEndFromFnpCm: EL, frontEndOffsetCm: EO,
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: b.backCm + b.frontCm,
        backAttachLenCm: backLen, frontAttachLenCm: frontLen, attachLenCm: backLen + frontLen,
        cbWidthLenCm: lineLen(O, cbOuterC),                    // 실측 = 뒤 중심 칼라 폭
        shoulderWidthLenCm: lineLen(snpC, shoulderC),          // 실측 = 어깨 칼라 폭(맞댐선 길이)
        frontEndLenCm: lineLen(fnpC, tipC),                    // 실측 = FNP→칼라 끝
        frontEndOffsetLenCm: Math.abs(inward.x * (tipF.x - fr.neckPoint.x) + inward.y * (tipF.y - fr.neckPoint.y)),
        outerLenCm: sumMeasure(outer)
      },
      anchors: { cbNeck: O, cbOuter: cbOuterC, snp: snpC, shoulder: shoulderC, fnp: fnpC, tip: tipC } };
  }

  // ── 플랫 칼라 T(교재 P.69 하단 · 제도 방법 P.149) — 어깨선을 겹쳐서 한 장으로 제도 ──
  // 판독 근거(PDF 1쪽 P.69 / 17쪽 P.149 직접 판독):
  //   ① 앞 몸판을 베끼고 ② SNP 를 맞춘 뒤 ③ 지정 치수(3.5)를 겹친다 — 3.5 는 **두 어깨 끝점
  //      사이의 직선 거리**다(도해의 치수 호가 앞·뒤 어깨 끝을 잇는다. 실측: 어깨 끝 간격 83px,
  //      같은 도해의 앞 끝선 6cm=154px 기준 ≈3.2~3.5cm).
  //   ④ 뒤 중심에서 FNP 를 향해 목둘레(달림선)를 다시 그린다. 시작점은 몸판 뒤 목점에서
  //      **목 쪽으로 0.5 올린 점**이고, 첫 시작은 뒤 중심선에 직각이다.
  //      ★ 이 곡선은 겹친 몸판 목둘레선을 **바깥(목 쪽)으로 밀어 다시 그린 것**이고
  //        앞 중심(FNP)에서 몸판 목둘레선과 다시 만난다(도해 실측: CB 0.5 → 중간 0.5~0.7 →
  //        FNP 0). 구현 관례로 **offset 량을 호길이 비례로 0.5 → 0 으로 줄인다** —
  //        교재가 명시한 길이 계약("몸판의 목둘레 치수보다 전체가 약 0.5cm 짧아진다")을
  //        재현하는 읽기다(이 방식 −0.68cm. 단일 cubic −4.3 / SNP 통과 −1.1 / 균일 0.5 −1.4).
  //   ⑤ 어깨에서 칼라 폭(5.5): **SNP 에서 앞 어깨선을 따라** 외곽선까지(실측: 치수 호가
  //      SNP 에서 다트 없는 쪽 = 앞 어깨선 방향 157°로 뻗는다. 뒤 어깨선 쪽에는 다트 틈이 있다).
  //   ⑥ 외곽선: 뒤 중심 폭선(③)에 직각으로 출발 → 어깨 폭 지점 → 칼라 끝(② 6·4)으로 완만한 곡선.
  //   S 와 다른 점: 겹침 3.5(S 는 0) · 달림선 재작도(S 는 몸판 목둘레선 그대로) · 뒤 중심 0.5 올림(S 는 0).
  //   ★ 몸판 형상은 입력일 뿐 바꾸지 않는다.
  var FLAT_COLLAR_T_METHOD = { page: 69, methodPage: 149, variant: "T", bodyLinked: true,
    attachFrom: "redrawn-neckline", join: "shoulder-overlap", attachOffsetTaper: "cb-to-front-linear",
    smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION };

  // 세그먼트의 t 에서의 접선(정규화 전). 직선은 상수.
  function segTangentAt(s, t) {
    if (s.kind === "line") return sub(s.to, s.from);
    var u = 1 - t;
    return { x: 3 * (-u * u * s.from.x + (u * u - 2 * u * t) * s.c1.x + (2 * u * t - t * t) * s.c2.x + t * t * s.to.x),
      y: 3 * (-u * u * s.from.y + (u * u - 2 * u * t) * s.c1.y + (2 * u * t - t * t) * s.c2.y + t * t * s.to.y) };
  }
  // 체인을 바깥 법선 방향으로 offset(시작 rise → 끝 0, 호길이 비례). 접선 방향은 보존되므로
  //   시작점의 직각 계약(달림선 ⊥ 뒤 중심선)이 그대로 유지된다.
  function offsetChainTaper(chain, rise, outwardAtStart) {
    var lens = chain.map(segMeasure), total = 0, i;
    for (i = 0; i < lens.length; i++) total += lens[i];
    if (!(total > 0)) return null;
    var t0 = segTangentAt(chain[0], 0);
    if (!(Math.hypot(t0.x, t0.y) > 1e-9)) return null;
    var u0 = unit(t0), left = { x: u0.y, y: -u0.x };
    var handed = (left.x * outwardAtStart.x + left.y * outwardAtStart.y) >= 0 ? 1 : -1;
    var normAt = function (s, t) {
      var d = segTangentAt(s, t);
      if (!(Math.hypot(d.x, d.y) > 1e-9)) d = segTangentAt(s, t < 0.5 ? t + 1e-3 : t - 1e-3);
      var un = unit(d);
      return handed > 0 ? { x: un.y, y: -un.x } : { x: -un.y, y: un.x };
    };
    // ★ 이음점(예: SNP 모서리)에서는 앞뒤 법선의 이등분선을 공유해야 offset 체인이 끊기지 않는다.
    var joinN = [], acc0 = 0;
    for (i = 0; i <= chain.length; i++) {
      var nPrev = i > 0 ? normAt(chain[i - 1], 1) : null;
      var nNext = i < chain.length ? normAt(chain[i], 0) : null;
      var nn = nPrev && nNext ? unit({ x: nPrev.x + nNext.x, y: nPrev.y + nNext.y }) : (nPrev || nNext);
      joinN.push(nn);
    }
    var out = [], acc = 0;
    for (i = 0; i < chain.length; i++) {
      var s = chain[i], segLen = lens[i], base = acc;
      var amtAt = function (t) { return rise * (1 - (base + segLen * t) / total); };
      var at = function (t, pt) { return add(pt, normAt(s, t), amtAt(t)); };
      var p0 = add(s.from, joinN[i], amtAt(0)), p1 = add(s.to, joinN[i + 1], amtAt(1));
      if (s.kind === "line") out.push({ kind: "line", from: p0, to: p1 });
      else out.push({ kind: "cubic", from: p0, c1: at(1 / 3, s.c1), c2: at(2 / 3, s.c2), to: p1 });
      acc += segLen;
    }
    // ★ 시작 접선 복원: 법선 offset 은 이론상 접선을 보존하지만, 제어점을 각자의 법선으로
    //   옮기면 시작 접선이 1~2° 흔들린다. 교재의 "첫 시작은 직각" 계약을 정확히 지키도록
    //   첫 제어점을 원래 시작 접선 방향으로 되돌린다(길이는 유지).
    var f0 = out[0];
    if (f0 && f0.kind === "cubic") {
      var hLen = lineLen(f0.from, f0.c1);
      if (hLen > 1e-9) f0.c1 = add(f0.from, u0, hLen);
    }
    return out;
  }

  // params: { collarWidthCm(5.5), cbRiseCm(0.5), shoulderOverlapCm(3.5), frontEndFromFnpCm(6), frontEndOffsetCm(4) }
  //   실패: no-bodice / no-neckline / 몸판 의미 모서리 실패 / invalid-collar-width / invalid-cb-rise /
  //     invalid-shoulder-overlap / shoulder-overlap-unreachable / invalid-front-end /
  //     invalid-front-end-offset / front-end-unreachable / attach-offset-failed / self-intersection.
  function computeFlatCollarT(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var W = P.collarWidthCm, RISE = P.cbRiseCm, OV = P.shoulderOverlapCm, EL = P.frontEndFromFnpCm, EO = P.frontEndOffsetCm;
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(RISE) || RISE < 0) return { ok: false, reason: "invalid-cb-rise" };
    if (!num(OV) || OV < 0) return { ok: false, reason: "invalid-shoulder-overlap" };
    if (!num(EL) || EL <= 0) return { ok: false, reason: "invalid-front-end" };
    if (!num(EO) || EO < 0) return { ok: false, reason: "invalid-front-end-offset" };
    if (!(EO < EL)) return { ok: false, reason: "front-end-unreachable" };
    var bk = bodiceSeamFrame(bodiceResult, "back"); if (!bk.ok) return bk;
    var fr = bodiceSeamFrame(bodiceResult, "front"); if (!fr.ok) return fr;
    if (!bk.shoulderTip || !fr.shoulderTip) return { ok: false, reason: "no-body-shoulder" };

    // ③ 겹침: SNP 를 맞춘 뒤 두 어깨 끝점 거리가 OV 가 되도록 앞 조각을 회전한다.
    var Lb = lineLen(bk.snp, bk.shoulderTip), Lf = lineLen(fr.snp, fr.shoulderTip);
    if (!(Lb > 0 && Lf > 0)) return { ok: false, reason: "no-body-shoulder" };
    if (OV < Math.abs(Lb - Lf) - 1e-9 || OV > Lb + Lf) return { ok: false, reason: "shoulder-overlap-unreachable" };
    var cosT = (Lf * Lf + Lb * Lb - OV * OV) / (2 * Lf * Lb);
    var theta = Math.acos(Math.max(-1, Math.min(1, cosT)));

    // S 와 같은 맞댐(어깨선 일치)에서 출발해, 뒤 조각이 있는 쪽으로 theta 만큼 더 돌려 겹친다.
    var aDir = unit(sub(fr.shoulderTip, fr.snp)), cDir = unit(sub(bk.shoulderTip, bk.snp));
    var rc = aDir.x * cDir.x + aDir.y * cDir.y, rs = aDir.x * cDir.y - aDir.y * cDir.x;
    var buttP = function (p) {
      var dx = p.x - fr.snp.x, dy = p.y - fr.snp.y;
      return { x: bk.snp.x + dx * rc - dy * rs, y: bk.snp.y + dx * rs + dy * rc };
    };
    var sideOf = function (p) { return cDir.x * (p.y - bk.snp.y) - cDir.y * (p.x - bk.snp.x); };
    var sideBack = sideOf(bk.neckPoint);
    if (!(Math.abs(sideBack) > 1e-9)) return { ok: false, reason: "no-body-shoulder" };
    var dirSign = sideBack > 0 ? 1 : -1;               // 뒤 조각이 있는 쪽으로 앞을 돌린다 = 겹침
    var ct = Math.cos(dirSign * theta), st = Math.sin(dirSign * theta);
    var toBack = function (p) {
      var q = buttP(p), dx = q.x - bk.snp.x, dy = q.y - bk.snp.y;
      return { x: bk.snp.x + dx * ct - dy * st, y: bk.snp.y + dx * st + dy * ct };
    };
    var mapSegBack = function (s, f) {
      return s.kind === "line" ? { kind: "line", from: f(s.from), to: f(s.to) }
        : { kind: "cubic", from: f(s.from), c1: f(s.c1), c2: f(s.c2), to: f(s.to) };
    };

    // ④ 달림선: 겹친 몸판 목둘레(뒤 CB→SNP + 앞 SNP→FNP)를 바깥으로 0.5 → 0 offset.
    var frontChainRot = fr.chain.slice().reverse().map(function (s) { return mapSegBack(reverseSeg(s), toBack); });
    var neckChain = bk.chain.map(function (s) { return mapSegBack(s, function (p) { return cp(p); }); }).concat(frontChainRot);
    var outward = { x: -bk.centerDir.x, y: -bk.centerDir.y };     // 뒤 중심선에서 몸판 바깥(목 쪽)
    var attachRaw = offsetChainTaper(neckChain, RISE, outward);
    if (!attachRaw) return { ok: false, reason: "attach-offset-failed" };

    var A0 = cp(attachRaw[0].from);                                // = 몸판 뒤 목점 + 0.5(목 쪽)
    var cbOuter = add(A0, bk.centerDir, W);                        // ③ 뒤 중심 칼라 폭
    var shoulderDirRot = unit(sub(toBack(fr.shoulderTip), bk.snp));  // 겹친 뒤의 앞 어깨선
    var shoulderPt = add(bk.snp, shoulderDirRot, W);               // ⑤ 어깨 칼라 폭
    // ①② 칼라 끝: 앞 중심선에 평행한 안내선(EO) 위, FNP 에서 EL
    var nPerp = { x: fr.centerDir.y, y: -fr.centerDir.x };
    var inward = (nPerp.x * (fr.snp.x - fr.neckPoint.x) + nPerp.y * (fr.snp.y - fr.neckPoint.y)) >= 0
      ? nPerp : { x: -nPerp.x, y: -nPerp.y };
    var tipF = add(add(fr.neckPoint, inward, EO), fr.centerDir, Math.sqrt(EL * EL - EO * EO));

    // 칼라 프레임: CB 목점 = 원점, CB 의 몸통 방향 → +y (순수 회전).
    var fc = bk.centerDir.y, fs = bk.centerDir.x;
    var toFrame = function (p) {
      var dx = p.x - bk.neckPoint.x, dy = p.y - bk.neckPoint.y;
      return { x: dx * fc - dy * fs, y: dx * fs + dy * fc };
    };
    var mapPart = function (s, part) {
      return s.kind === "line" ? { kind: "line", from: toFrame(s.from), to: toFrame(s.to), part: part }
        : { kind: "cubic", from: toFrame(s.from), c1: toFrame(s.c1), c2: toFrame(s.c2), to: toFrame(s.to), part: part };
    };
    var attach = attachRaw.map(function (s) { return mapPart(s, "neck-seam"); });
    var A0C = toFrame(A0), cbOuterC = toFrame(cbOuter), snpC = toFrame(bk.snp), shoulderC = toFrame(shoulderPt);
    var fnpC = toFrame(toBack(fr.neckPoint)), tipC = toFrame(toBack(tipF));
    var outer = flatOuterGuide(cbOuterC, shoulderC, tipC, "outer");

    var outline = attach.slice();
    outline.push(L(fnpC, tipC, "front-edge"));
    outer.slice().reverse().forEach(function (s) { outline.push(reverseCubic(s, "outer")); });
    outline.push(L(cbOuterC, A0C, "cb-fold"));
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var attachLen = sumMeasure(attach), neckTarget = b.backCm + b.frontCm;
    return { ok: true,
      geometry: { outline: outline, construction: [L(snpC, shoulderC, "shoulder-mark")] },
      measure: {
        collarWidthCm: W, cbRiseCm: RISE, shoulderOverlapCm: OV, frontEndFromFnpCm: EL, frontEndOffsetCm: EO,
        backNeckLenCm: b.backCm, frontNeckLenCm: b.frontCm, neckTargetCm: neckTarget,
        backShoulderLenCm: Lb, frontShoulderLenCm: Lf, overlapAngleDeg: theta * 180 / Math.PI,
        shoulderTipGapCm: lineLen(toBack(fr.shoulderTip), bk.shoulderTip),   // 실측 = 겹침 3.5
        attachLenCm: attachLen,
        attachShortfallCm: neckTarget - attachLen,        // 교재: 몸판 목둘레보다 약 0.5 짧다
        cbWidthLenCm: lineLen(A0C, cbOuterC),
        shoulderWidthLenCm: lineLen(snpC, shoulderC),
        frontEndLenCm: lineLen(fnpC, tipC),
        frontEndOffsetLenCm: Math.abs(inward.x * (tipF.x - fr.neckPoint.x) + inward.y * (tipF.y - fr.neckPoint.y)),
        outerLenCm: sumMeasure(outer)
      },
      anchors: { cbNeck: toFrame(bk.neckPoint), cbAttach: A0C, cbOuter: cbOuterC, snp: snpC,
        shoulder: shoulderC, fnp: fnpC, tip: tipC } };
  }

  // ── 세일러 칼라(교재 U·V·W, P.70 · 제도 방법 P.150) ──
  // ★ 하나의 생성기가 세 도해를 모두 만든다. 교재 본문이 V = "칼라 폭을 조정하여 Ⓤ와 같은 방식으로
  //   제도한다", W = "목둘레를 바꿔 Ⓤ와 같이 제도한다" 라고 못박듯, 절차·기준점·방향은 같고 수치만
  //   다르다(V: 폭 11/15.5/10/1.5 → 9/13.5/7/1 · W: 목둘레 12·0.8 → 22·0.3, 앞 외곽 휨 1.5 → 0.7).
  //   함수명·METHOD.variant 의 "U" 는 교재가 제도 방법을 U 로 예시했다는 출처 표기다(파라미터로 분기하지 않는다).
  //   아래 판독 근거는 그 예시(U) 도해 기준이다.
  // 판독 근거(PDF 2쪽 P.70 / 18쪽 P.150 직접 판독):
  //   본문 U: "목둘레는 FNP에서 12cm 내리고 칼라 폭은 어깨에서 10cm … 플랫 칼라 T(P.69)와 같이
  //   앞뒤 어깨선을 겹쳐서 베끼고, 칼라를 제도한다. 칼라 외곽의 모양은 뒤에서 앞의 순서로 그린다."
  //   ① (몸판) V 목둘레: 앞 목점에서 **앞 중심선을 따라 12 내린 점**까지, 현에서 **0.8** 만큼
  //      몸판 안쪽으로 휜 곡선(P.70 앞 몸판 도해). ★ 몸판을 바꾸지 않고 칼라 안에서만 파생한다.
  //   ② 겹침: SNP 를 맞추고 **지정 치수 1.5** 를 겹친다(P.150 1-③, 실측 어깨 끝 간격 1.63cm ≈ 1.5).
  //   ③ 달림선: 뒤 중심에서 0.5 올린 점에서 **몸판과 평행**(P.150 2-⑤) 하게 긋고, SNP 에서 FNP 까지
  //      완만한 곡선으로 잇는다(P.150 3-①) — T 와 같은 taper offset(뒤 중심 0.5 → 앞 0).
  //   ④ 뒤 중심 칼라 폭 **11**(P.150 2-①), 그 끝에서 ①에 **직각**으로 칼라 외곽 **15.5**(2-③).
  //      실측: |apex→달림선| 10.9cm, |apex→외곽 모서리| 15.8cm, 사잇각 89.8°.
  //   ⑤ 어깨에서 칼라 폭 **10**(2-②) — SNP 에서 **앞 어깨선**을 따라(실측 159° = 다트 없는 쪽).
  //   ⑥ 뒤 칼라 외곽선은 ③과 ②를 **직선**으로 잇는다(2-④ · 세일러의 네모난 뒤판).
  //   ⑦ 앞 칼라 외곽선은 현에서 **1.5** 휜 완만한 곡선으로 FNP 에 연결(3-②).
  var SAILOR_COLLAR_U_METHOD = { page: 70, methodPage: 150, variant: "U", bodyLinked: true,
    vNeck: "derived-internal", join: "shoulder-overlap", attachOffsetTaper: "cb-to-front-linear",
    backOuterSquare: true, smoothing: "tangent-continuous-cubic", handleFraction: SEAM_HANDLE_FRACTION };

  // 양 끝점과 "현에서 bow 만큼 벗어난 중점"을 지나는 완만한 곡선(중점에서 접선 연속).
  //   교재는 곡률값 없이 "완만한 곡선"만 지정하므로 핸들 = 각 반현 × 1/3 의 구현 관례를 쓴다.
  //   bow = 0 이면 현을 그대로 따라간다.
  function bowedGuide(P0, P1, bow, sideHint, part) {
    var d = sub(P1, P0), len = Math.hypot(d.x, d.y);
    if (!(len > 1e-9)) return null;
    var chord = { x: d.x / len, y: d.y / len };
    var n = { x: -chord.y, y: chord.x };
    if (sideHint && (n.x * sideHint.x + n.y * sideHint.y) < 0) n = { x: -n.x, y: -n.y };
    var M = add(mid(P0, P1), n, bow);
    var h1 = lineLen(P0, M) * SEAM_HANDLE_FRACTION, h2 = lineLen(M, P1) * SEAM_HANDLE_FRACTION;
    var u0 = unit(sub(M, P0)), u1 = unit(sub(P1, M));
    return { mid: M, segs: [
      { kind: "cubic", from: cp(P0), c1: add(P0, u0, h1), c2: add(M, chord, -h1), to: cp(M), part: part },
      { kind: "cubic", from: cp(M), c1: add(M, chord, h2), c2: add(P1, u1, -h2), to: cp(P1), part: part }
    ] };
  }

  // params: { vDropCm(12), vHollowCm(0.8), shoulderOverlapCm(1.5), cbRiseCm(0.5),
  //           cbWidthCm(11), backOuterCm(15.5), shoulderWidthCm(10), frontOuterBowCm(1.5) }
  //   실패: no-bodice / no-neckline / 몸판 의미 모서리 실패 / invalid-v-drop / invalid-v-hollow /
  //     invalid-shoulder-overlap / shoulder-overlap-unreachable / invalid-cb-rise / invalid-collar-width /
  //     invalid-back-outer / invalid-shoulder-width / invalid-front-bow / v-neck-failed /
  //     attach-offset-failed / self-intersection.
  function computeSailorCollarU(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var VD = P.vDropCm, VH = P.vHollowCm, OV = P.shoulderOverlapCm, RISE = P.cbRiseCm;
    var CBW = P.cbWidthCm, BOUT = P.backOuterCm, SHW = P.shoulderWidthCm, FBOW = P.frontOuterBowCm;
    if (!num(VD) || VD <= 0) return { ok: false, reason: "invalid-v-drop" };
    if (!num(VH) || VH < 0) return { ok: false, reason: "invalid-v-hollow" };
    if (!num(OV) || OV < 0) return { ok: false, reason: "invalid-shoulder-overlap" };
    if (!num(RISE) || RISE < 0) return { ok: false, reason: "invalid-cb-rise" };
    if (!num(CBW) || CBW <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(BOUT) || BOUT <= 0) return { ok: false, reason: "invalid-back-outer" };
    if (!num(SHW) || SHW <= 0) return { ok: false, reason: "invalid-shoulder-width" };
    if (!num(FBOW) || FBOW < 0) return { ok: false, reason: "invalid-front-bow" };
    var bk = bodiceSeamFrame(bodiceResult, "back"); if (!bk.ok) return bk;
    var fr = bodiceSeamFrame(bodiceResult, "front"); if (!fr.ok) return fr;
    if (!bk.shoulderTip || !fr.shoulderTip) return { ok: false, reason: "no-body-shoulder" };

    // ① V 목둘레(칼라 내부 파생 — 몸판 geometry 는 바꾸지 않는다)
    var fnpV = add(fr.neckPoint, fr.centerDir, VD);
    var nPerp = { x: fr.centerDir.y, y: -fr.centerDir.x };
    var inward = (nPerp.x * (fr.snp.x - fr.neckPoint.x) + nPerp.y * (fr.snp.y - fr.neckPoint.y)) >= 0
      ? nPerp : { x: -nPerp.x, y: -nPerp.y };                       // 앞 중심선에서 몸판 안쪽
    var vCurve = bowedGuide(fr.snp, fnpV, VH, inward);
    if (!vCurve) return { ok: false, reason: "v-neck-failed" };

    // ② 겹침: SNP 를 맞춘 뒤 **짧은 쪽 어깨선 끝에서 OV 만큼 겹치도록** 앞 조각을 회전한다.
    //   ★ 기준 반지름 = min(뒤, 앞 제도 어깨 길이). 교재 블록은 앞뒤 제도 어깨가 거의 같아
    //     "두 어깨 끝점 사이 거리"와 같은 값이지만, 이 앱의 블록은 뒤 어깨가 어깨다트 절개량
    //     (1.79cm)만큼 길어 두 정의가 갈린다. 실측으로 교재 도해의 겹침 각을 재현하는 쪽은
    //     이 정의다 — P.150(U) 실측 7.5° ↔ 이 식 7.62°, P.149(T) 실측 18° ↔ 이 식 18.1°.
    //   (플랫 칼라 T 는 현재 "두 어깨 끝점 거리" 기준으로 구현돼 있다 — 통일은 별도 보정 사안.)
    var Lb = lineLen(bk.snp, bk.shoulderTip), Lf = lineLen(fr.snp, fr.shoulderTip);
    if (!(Lb > 0 && Lf > 0)) return { ok: false, reason: "no-body-shoulder" };
    var Lmin = Math.min(Lb, Lf);
    if (OV > 2 * Lmin) return { ok: false, reason: "shoulder-overlap-unreachable" };
    var theta = 2 * Math.asin(Math.max(-1, Math.min(1, OV / (2 * Lmin))));
    var aDir = unit(sub(fr.shoulderTip, fr.snp)), cDir = unit(sub(bk.shoulderTip, bk.snp));
    var rc = aDir.x * cDir.x + aDir.y * cDir.y, rs = aDir.x * cDir.y - aDir.y * cDir.x;
    var buttP = function (p) {
      var dx = p.x - fr.snp.x, dy = p.y - fr.snp.y;
      return { x: bk.snp.x + dx * rc - dy * rs, y: bk.snp.y + dx * rs + dy * rc };
    };
    var sideBack = cDir.x * (bk.neckPoint.y - bk.snp.y) - cDir.y * (bk.neckPoint.x - bk.snp.x);
    if (!(Math.abs(sideBack) > 1e-9)) return { ok: false, reason: "no-body-shoulder" };
    var dirSign = sideBack > 0 ? 1 : -1;
    var ct = Math.cos(dirSign * theta), st = Math.sin(dirSign * theta);
    var toBack = function (p) {
      var q = buttP(p), dx = q.x - bk.snp.x, dy = q.y - bk.snp.y;
      return { x: bk.snp.x + dx * ct - dy * st, y: bk.snp.y + dx * st + dy * ct };
    };
    var mapSegBack = function (s) {
      return s.kind === "line" ? { kind: "line", from: toBack(s.from), to: toBack(s.to) }
        : { kind: "cubic", from: toBack(s.from), c1: toBack(s.c1), c2: toBack(s.c2), to: toBack(s.to) };
    };

    // ③ 달림선: (뒤 목둘레 + V선) 체인을 바깥으로 0.5 → 0 taper offset
    var vRot = vCurve.segs.map(function (s) { return mapSegBack({ kind: s.kind, from: s.from, c1: s.c1, c2: s.c2, to: s.to }); });
    var neckChain = bk.chain.map(function (s) { return { kind: s.kind, from: cp(s.from), c1: s.c1 ? cp(s.c1) : undefined, c2: s.c2 ? cp(s.c2) : undefined, to: cp(s.to) }; }).concat(vRot);
    var outward = { x: -bk.centerDir.x, y: -bk.centerDir.y };
    var attachRaw = offsetChainTaper(neckChain, RISE, outward);
    if (!attachRaw) return { ok: false, reason: "attach-offset-failed" };

    var A0 = cp(attachRaw[0].from);
    var apex = add(A0, bk.centerDir, CBW);                          // ④ 뒤 중심 칼라 폭 11
    var shoulderDirRot = unit(sub(toBack(fr.shoulderTip), bk.snp)); // ⑤ 겹친 뒤의 앞 어깨선
    var P10 = add(bk.snp, shoulderDirRot, SHW);
    // ④ 외곽 15.5: CB 에 직각이고, 칼라가 퍼지는 쪽(어깨 폭 지점 방향)
    var perp = { x: -bk.centerDir.y, y: bk.centerDir.x };
    if ((perp.x * (P10.x - apex.x) + perp.y * (P10.y - apex.y)) < 0) perp = { x: -perp.x, y: -perp.y };
    var P15 = add(apex, perp, BOUT);
    var fnpVRot = toBack(fnpV);
    // ⑦ 앞 외곽선: 현에서 FBOW 만큼 **달림선 반대쪽**으로 휜 완만한 곡선
    var frontChordMid = mid(P10, fnpVRot);
    var awaySide = sub(frontChordMid, bk.snp);
    var frontOuter = bowedGuide(P10, fnpVRot, FBOW, awaySide, "outer");
    if (!frontOuter) return { ok: false, reason: "invalid-front-bow" };

    // 칼라 프레임: CB 목점 = 원점, CB 의 몸통 방향 → +y (순수 회전)
    var fc = bk.centerDir.y, fs = bk.centerDir.x;
    var toFrame = function (p) {
      var dx = p.x - bk.neckPoint.x, dy = p.y - bk.neckPoint.y;
      return { x: dx * fc - dy * fs, y: dx * fs + dy * fc };
    };
    var mapPart = function (s, part) {
      return s.kind === "line" ? { kind: "line", from: toFrame(s.from), to: toFrame(s.to), part: part }
        : { kind: "cubic", from: toFrame(s.from), c1: toFrame(s.c1), c2: toFrame(s.c2), to: toFrame(s.to), part: part };
    };
    var attach = attachRaw.map(function (s) { return mapPart(s, "neck-seam"); });
    var frontOut = frontOuter.segs.map(function (s) { return mapPart(s, "outer"); });
    var A0C = toFrame(A0), apexC = toFrame(apex), p15C = toFrame(P15), p10C = toFrame(P10);
    var snpC = toFrame(bk.snp), fnpC = toFrame(fnpVRot);

    var outline = attach.slice();
    frontOut.slice().reverse().forEach(function (s) { outline.push(reverseCubic(s, "outer")); });  // FNP → 어깨
    outline.push(L(p10C, p15C, "outer-back"));                      // ⑥ 뒤 칼라 외곽선(직선)
    outline.push(L(p15C, apexC, "outer-cb"));                       // ④ 15.5(CB 직각)
    outline.push(L(apexC, A0C, "cb-fold"));                         // ④ 11(뒤 중심)
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var backNeck = sumMeasure(bk.chain), vLen = sumMeasure(vCurve.segs);
    var attachLen = sumMeasure(attach), neckTarget = backNeck + vLen;
    var frontOuterLen = sumMeasure(frontOut);
    var apexA = unit(sub(A0C, apexC)), apexB = unit(sub(p15C, apexC));
    return { ok: true,
      geometry: { outline: outline, construction: [L(snpC, p10C, "shoulder-mark")] },
      measure: {
        vDropCm: VD, vHollowCm: VH, shoulderOverlapCm: OV, cbRiseCm: RISE,
        cbWidthCm: CBW, backOuterCm: BOUT, shoulderWidthCm: SHW, frontOuterBowCm: FBOW,
        bodyBackNeckLenCm: b.backCm, bodyFrontNeckLenCm: b.frontCm,
        backNeckLenCm: backNeck, vNeckLenCm: vLen, neckTargetCm: neckTarget,
        backShoulderLenCm: Lb, frontShoulderLenCm: Lf, overlapAngleDeg: theta * 180 / Math.PI,
        shoulderTipGapCm: lineLen(toBack(fr.shoulderTip), bk.shoulderTip),
        attachLenCm: attachLen, attachShortfallCm: neckTarget - attachLen,
        cbWidthLenCm: lineLen(A0C, apexC),
        backOuterLenCm: lineLen(apexC, p15C),
        backCornerAngleDeg: Math.acos(Math.max(-1, Math.min(1, apexA.x * apexB.x + apexA.y * apexB.y))) * 180 / Math.PI,
        shoulderWidthLenCm: lineLen(snpC, p10C),
        backOuterEdgeLenCm: lineLen(p10C, p15C),
        frontOuterLenCm: frontOuterLen,
        outerLenCm: frontOuterLen + lineLen(p10C, p15C) + lineLen(p15C, apexC)
      },
      anchors: { cbNeck: toFrame(bk.neckPoint), cbAttach: A0C, cbOuter: apexC, backOuter: p15C,
        shoulder: p10C, snp: snpC, fnpV: fnpC } };
  }

  // ── 보 칼라(교재 X·Y·Z, P.71) ──
  // 교재 본문(P.71 직접 판독):
  //   머리말 "칼라에 넥타이처럼 직사각형의 천을 붙이고 나비매듭을 한 칼라. 타이 칼라라고도 한다.
  //     칼라 폭을 달리한 디자인을 3가지 소개한다. 길이는 리본의 칼라 폭이 넓을수록 길게 해야 균형이
  //     맞지만 원하는 대로 조정할 수 있다."
  //   Ⓧ "앞 몸판의 칼라 달림 끝은 리본 매듭이 예쁘게 자리 잡도록 앞 중심에서 떨어진 위치에 정한다.
  //     목둘레 치수를 수평선상에 두고 제도한다. 칼라 달림 끝부터 리본의 길이는 45cm." · 칼라 폭 3
  //   Ⓨ "칼라 폭 7cm. Ⓧ와 같이 제도한다. 칼라 달림 끝부터 리본의 길이는 60cm."
  //   Ⓩ "칼라 폭 15cm. Ⓧ와 같이 제도한다. 칼라 달림 끝부터 리본의 길이는 75cm."
  // 도해 판독(세 도해가 완전히 같은 구성):
  //   · 칼라 = 직사각형 한 장. 왼쪽 변 = 뒤 중심(접어 재단), 아래 변 = 목둘레를 올려놓은 수평 기준선.
  //   · 아래 변 = (×+⊠) + 리본 길이. 리본 구간의 물결선은 **그림 생략 기호**이고 치수가 아니다.
  //   · 앞 몸판 도해: 목둘레 곡선 바깥의 가는 호 하나를 두 지시선이 나눠 ⊠ 와 3 으로 표기한다 —
  //     ⊠ = SNP→칼라 달림 끝, 3 = 칼라 달림 끝→앞 중심. 즉 **둘 다 목둘레선을 따라 잰 값**이고
  //     ⊠ + 3 = 몸판 앞 목둘레(반쪽)다. 화살표 "칼라 달림 끝"이 그 분할점을 가리킨다.
  //   · × = 뒤 목둘레(SNP→CB) 전체. ⇒ 달림선 = × + (앞 목둘레 − 3).
  //   · 도해의 1(SNP 올림)·1(앞 목점 내림)·1.5(여밈)는 **몸판 셔츠 목선·앞여밈 수치**이고 칼라 수치가 아니다.
  // ★ X·Y·Z 의 차이는 **칼라 폭과 리본 길이 두 값뿐**이다(교재가 Y·Z 에 "Ⓧ와 같이 제도한다"고 못박는다).
  //   칼라 달림 끝 3 은 세 도해 모두 같은 표기라 같은 값으로 둔다(레코드 수치, 엔진 상수가 아니다).
  // ★ 몸판은 바꾸지 않는다 — 칼라 달림 끝은 몸판 쪽 표시점이고, 여기서는 완료된 몸판 목둘레 치수
  //   (necklineLengths, 최종 bodice geometry 파생)만 읽어 달림선 길이를 만든다.
  var BOW_COLLAR_METHOD = { page: 71, piece: "rectangle", baseline: "horizontal-neck-measure",
    attachEndFrom: "front-center-along-neckline", ribbonFrom: "attach-end", symmetry: "half-cb-fold" };

  // params: { collarWidthCm(3), ribbonLengthCm(45), attachEndFromCfCm(3) }
  //   로컬 프레임: 뒤 중심 = x 0, 목둘레 기준 수평선 = y 0, 위 = −y(밴드 P.148 프레임과 같은 관례).
  //   실패: no-bodice / no-neckline / invalid-collar-width / invalid-ribbon-length /
  //     invalid-attach-end / attach-end-unreachable / self-intersection.
  function computeBowCollar(bodiceResult, params) {
    var b = readBodice(bodiceResult);
    if (!b.ok) return b;
    var P = params || {};
    var W = P.collarWidthCm, RB = P.ribbonLengthCm, AE = P.attachEndFromCfCm;
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(RB) || RB <= 0) return { ok: false, reason: "invalid-ribbon-length" };
    if (!num(AE) || AE < 0) return { ok: false, reason: "invalid-attach-end" };
    if (!(AE < b.frontCm)) return { ok: false, reason: "attach-end-unreachable" };   // ⊠ ≤ 0 이면 달림선이 성립하지 않는다

    var frontAttach = b.frontCm - AE;                  // ⊠ = 앞 목둘레 − 3(칼라 달림 끝까지)
    var seam = b.backCm + frontAttach;                 // 달림선 = ×+⊠
    var cbSeam = { x: 0, y: 0 }, attachEnd = { x: seam, y: 0 }, ribbonEnd = { x: seam + RB, y: 0 };
    var cbTop = { x: 0, y: -W }, attachEndTop = { x: seam, y: -W }, ribbonEndTop = { x: seam + RB, y: -W };

    var outline = [
      L(cbSeam, attachEnd, "neck-seam"),          // ×+⊠ — 몸판 목둘레에 달리는 구간
      L(attachEnd, ribbonEnd, "ribbon-edge"),     // 칼라 달림 끝부터 리본(45/60/75)
      L(ribbonEnd, ribbonEndTop, "ribbon-end"),   // 리본 끝
      L(ribbonEndTop, cbTop, "outer"),            // 칼라 폭 위쪽 변
      L(cbTop, cbSeam, "cb-fold")                 // 뒤 중심(접어 재단)
    ];
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var by = function (p) { return outline.filter(function (s) { return s.part === p; }); };
    var attachLen = sumMeasure(by("neck-seam")), ribbonLen = sumMeasure(by("ribbon-edge"));
    return { ok: true,
      geometry: { outline: outline, construction: [L(attachEnd, attachEndTop, "attach-end-mark")] },
      measure: {
        collarWidthCm: W, ribbonLengthCm: RB, attachEndFromCfCm: AE,
        backNeckLenCm: b.backCm, bodyFrontNeckLenCm: b.frontCm,
        frontAttachLenCm: frontAttach,                 // ⊠(실측 아님 — 목둘레 치수 산술)
        neckTargetCm: seam,                            // ×+⊠
        attachLenCm: attachLen,                        // 달림선 실측(= ×+⊠)
        ribbonLenCm: ribbonLen,                        // 칼라 달림 끝→리본 끝 실측
        totalLenCm: attachLen + ribbonLen,             // 아래 변 전체
        outerLenCm: sumMeasure(by("outer")),
        collarWidthLenCm: sumMeasure(by("cb-fold")),
        ribbonEndLenCm: sumMeasure(by("ribbon-end"))
      },
      anchors: { cbSeam: cp(cbSeam), cbTop: cp(cbTop), attachEnd: cp(attachEnd), attachEndTop: cp(attachEndTop),
        ribbonEnd: cp(ribbonEnd), ribbonEndTop: cp(ribbonEndTop) } };
  }

  // ── 프릴 칼라(교재 a·b·c, P.72–73) ──
  // a: 목둘레의 1배를 개더분으로 더한 8cm 직사각형(재단 달림변 = 목둘레×2).
  // b: 몸판 목둘레를 기준으로 8cm 칼라를 그리고 6등분 절개, 외곽에서 각 3cm 벌림.
  // c: FNP 에서 22cm 내린 V 목둘레를 칼라 안에서 파생하고 b와 같은 원리로 더 많이 벌린다.
  // ★ 몸판 geometry 는 절대 바꾸지 않는다. 원호는 절개·전개 뒤의 한 조각을 결정론적으로 표현한다.
  var FRILL_COLLAR_METHOD = { pages: [72, 73], piece: "one-piece", bodyLinked: true,
    gathered: "a", slashSpread: ["b", "c"], smoothing: "cubic-arc" };

  function arcSegments(center, radius, a0, a1, part) {
    var out = [], total = a1 - a0, n = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 2)));
    for (var i = 0; i < n; i++) {
      var s = a0 + total * i / n, e = a0 + total * (i + 1) / n, d = e - s;
      var k = 4 / 3 * Math.tan(d / 4);
      var p0 = { x: center.x + radius * Math.cos(s), y: center.y + radius * Math.sin(s) };
      var p1 = { x: center.x + radius * Math.cos(e), y: center.y + radius * Math.sin(e) };
      out.push({ kind: "cubic", from: p0,
        c1: { x: p0.x - radius * Math.sin(s) * k, y: p0.y + radius * Math.cos(s) * k },
        c2: { x: p1.x + radius * Math.sin(e) * k, y: p1.y - radius * Math.cos(e) * k },
        to: p1, part: part });
    }
    return out;
  }

  // params: { styleCode(0=a,1=b,2=c), collarWidthCm, gatherRatio, vDropCm, vHollowCm,
  //           spreadCount, spreadEachCm }
  function computeFrillCollar(bodiceResult, params) {
    var b = readBodice(bodiceResult); if (!b.ok) return b;
    var P = params || {}, style = P.styleCode, W = P.collarWidthCm, GR = P.gatherRatio;
    var VD = P.vDropCm, VH = P.vHollowCm, SC = P.spreadCount, SE = P.spreadEachCm;
    if (!(style === 0 || style === 1 || style === 2)) return { ok: false, reason: "invalid-frill-style" };
    if (!num(W) || W <= 0) return { ok: false, reason: "invalid-collar-width" };
    if (!num(GR) || GR < 1) return { ok: false, reason: "invalid-gather-ratio" };
    if (!num(VD) || VD < 0 || !num(VH) || VH < 0) return { ok: false, reason: "invalid-v-neck" };
    if (!num(SC) || SC < 0 || Math.floor(SC) !== SC || !num(SE) || SE < 0) return { ok: false, reason: "invalid-spread" };
    if (style === 0 && (!(GR > 1) || SC !== 0 || SE !== 0)) return { ok: false, reason: "invalid-gathered-frill" };
    if (style !== 0 && (!(SC > 0) || !(SE > 0) || GR !== 1)) return { ok: false, reason: "invalid-flared-frill" };

    var target = b.backCm + b.frontCm, vLen = null;
    if (style === 2) {
      if (!(VD > 0)) return { ok: false, reason: "invalid-v-neck" };
      var fr = bodiceSeamFrame(bodiceResult, "front"); if (!fr.ok) return fr;
      var fnpV = add(fr.neckPoint, fr.centerDir, VD);
      var nPerp = { x: fr.centerDir.y, y: -fr.centerDir.x };
      var inward = (nPerp.x * (fr.snp.x - fr.neckPoint.x) + nPerp.y * (fr.snp.y - fr.neckPoint.y)) >= 0
        ? nPerp : { x: -nPerp.x, y: -nPerp.y };
      var vg = bowedGuide(fr.snp, fnpV, VH, inward); if (!vg) return { ok: false, reason: "v-neck-failed" };
      vLen = sumMeasure(vg.segs); target = b.backCm + vLen;
    }

    var outline = [], construction = [], anchors, cutAttach, outerLen, flareAngle = 0, spreadTotal = SC * SE;
    if (style === 0) {
      cutAttach = target * GR;
      var a0 = { x: 0, y: 0 }, a1 = { x: cutAttach, y: 0 }, o1 = { x: cutAttach, y: -W }, o0 = { x: 0, y: -W };
      outline = [L(a0, a1, "gather-edge"), L(a1, o1, "front-edge"), L(o1, o0, "outer"), L(o0, a0, "cb-fold")];
      for (var gi = 1; gi < 8; gi++) {
        var gx = cutAttach * gi / 8;
        construction.push(L({ x: gx, y: 0 }, { x: gx, y: -Math.min(1.2, W * 0.2) }, "gather-mark"));
      }
      outerLen = cutAttach; anchors = { cbAttach: a0, cbOuter: o0, frontAttach: a1, frontOuter: o1 };
    } else {
      flareAngle = spreadTotal / W;
      if (!(flareAngle > 0 && flareAngle < Math.PI * 1.9)) return { ok: false, reason: "spread-unreachable" };
      var R = target / flareAngle, O = R + W, center = { x: 0, y: 0 };
      var inner = arcSegments(center, R, 0, flareAngle, "neck-seam");
      var outerForward = arcSegments(center, O, 0, flareAngle, "outer");
      var i0 = inner[0].from, i1 = inner[inner.length - 1].to;
      var o0a = outerForward[0].from, o1a = outerForward[outerForward.length - 1].to;
      outline = inner.concat([L(i1, o1a, "front-edge")]);
      outerForward.slice().reverse().forEach(function (s) { outline.push(reverseCubic(s, "outer")); });
      outline.push(L(o0a, i0, "cb-fold"));
      for (var si = 1; si < SC; si++) {
        var aa = flareAngle * si / SC;
        construction.push(L({ x: R * Math.cos(aa), y: R * Math.sin(aa) },
          { x: O * Math.cos(aa), y: O * Math.sin(aa) }, "slash-line"));
      }
      cutAttach = sumMeasure(inner); outerLen = sumMeasure(outerForward);
      anchors = { cbAttach: cp(i0), cbOuter: cp(o0a), frontAttach: cp(i1), frontOuter: cp(o1a), center: cp(center) };
    }
    var closed = validateClosedOutline(outline); if (!closed.ok) return { ok: false, reason: closed.reason };
    return { ok: true, geometry: { outline: outline, construction: construction },
      measure: { styleCode: style, collarWidthCm: W, gatherRatio: GR, vDropCm: VD, vHollowCm: VH,
        spreadCount: SC, spreadEachCm: SE, spreadTotalCm: spreadTotal, flareAngleDeg: flareAngle * 180 / Math.PI,
        backNeckLenCm: b.backCm, bodyFrontNeckLenCm: b.frontCm, vNeckLenCm: vLen,
        neckTargetCm: target, cutAttachLenCm: cutAttach, finishedAttachLenCm: target,
        outerLenCm: outerLen, cbWidthLenCm: W, frontWidthLenCm: W }, anchors: anchors };
  }

  // ── 후드(교재 d, P.74 · 제도 방법 P.151) ──
  // 판독 근거(PDF 직접 판독):
  //   P.74 본문 "앞 몸판 중심의 목둘레에서 위로 후드 길이를 잡고, 거기서 뒤로 후드 폭을 잡는다.
  //     다음에 앞뒤 몸판의 목둘레와 **같은 치수가 되도록** 후드 달림선을 그린다. 뒤 중심선의 곡선을 그리면 완성."
  //   P.151 머리말 "이 제도의 포인트는 앞뒤 몸판의 목둘레와 같은 치수가 되도록 후드 달림선을 그리는 것."
  //   ※ 괄호 안 치수는 **후드 치수 39 · 머리 둘레 56** 인 경우 — d: 폭 25 = 머리둘레/2−3, 길이 44 = 후드치수+5.
  //   1 ❶ 앞 끝선을 긋고 후드 길이를 잡는다(FNP에서 곧게 올린다) ❷ 직각으로 후드 폭 ❸ 직각으로 뒤 중심 안내선
  //   2 ❶ (앞)목둘레를 2등분 → Ⓐ  ❷ SNP를 기준점으로 반원  ❸ 완만한 곡선으로 앞 달림선(Ⓐ~SNP와 같은 치수로 Ⓑ)
  //     ❹ 뒤 달림선의 안내선(Ⓑ에서 수평으로 연장)
  //   3 ❶ 뒤 목둘레 치수를 잡는다 ❷ 뒤 중심 안내선을 2등분 ❸ 안내선(❶·❷의 2등분점 연결)
  //     ❹ 뒤 달림선(❸에 직각, 완만한 곡선으로 앞 달림선에 연결) ❺ 뒤 중심선(각 포인트를 잇는 완만한 곡선)
  //   도해 수치: 윗변 직선 8(앞 위 모서리에서) · 모서리 6.5(뒤 위 모서리 대각) · 뒤 달림선 처짐 0.6.
  //   도해의 1(SNP 올림)·1(앞 목점 내림)·1.5(여밈)는 **몸판 셔츠 목선·앞여밈 수치**이고 후드 수치가 아니다.
  // ★ Ⓑ는 SNP에서 반지름 `snpRadiusCm`(도해 4) 위에 있다. 원 위 **어느 각도인지**는 교재가 수치로 주지 않으므로,
  //   교재가 "이 제도의 포인트"라고 못박은 길이 책임으로 푼다 — 앞 달림선 실측 = 몸판 앞 목둘레가 되는 각도.
  //   같은 이유로 C(뒤 달림선 끝)는 뒤 달림선 실측 = 몸판 뒤 목둘레가 되는 지점으로 푼다.
  //   **이분 탐색으로 길이를 맞추는 방식은 밴드 칼라 ⑭(solveCbCorrection)와 같은 구현 관례**이고 교재 수치가 아니다.
  // ★ 몸판은 바꾸지 않는다 — 앞 목둘레선·FNP·SNP를 읽기만 한다.
  // 로컬 프레임: FNP = 원점, +x = 뒤(앞 중심선에서 몸판 안쪽), +y = 아래(앞 중심선 방향). 위 = −y.
  var HOOD_METHOD = { pages: [74], methodPage: 151, piece: "half-cb-seam", bodyLinked: true,
    widthFormula: "head/2 + widthOffset", lengthFormula: "hoodMeasure + lengthOffset",
    attachLengthRule: "front = body front neck, back = body back neck",
    solve: "snp-angle + cb-bottom by bisection", smoothing: "tangent-continuous-cubic",
    handleFraction: SEAM_HANDLE_FRACTION };
  // 교재 순서(d·e·f·g)의 자리. e(1)·f(2)·g(3)는 **제도 구조가 d와 달라** 여기서 만들지 않는다:
  //   e = 중심에 덧천(별도 조각) · f = 앞 끝 윤곽선이 큰 곡선(앞 중심 7 세움) · g = 턱~정수리 대각 이음선.
  var HOOD_STYLE = { d: 0 };
  var HOOD_SOLVE_STEPS = 60;         // 이분 탐색 반복(길이 1e-9cm 수렴)

  // 세 점을 지나는 완만한 곡선(중점에서 접선 연속, 핸들 = 각 반현 × 1/3). bowedGuide 와 같은 관례.
  function smoothVia(P0, M, P1, part) {
    var chord = sub(P1, P0), cl = Math.hypot(chord.x, chord.y);
    if (!(cl > 1e-9)) return null;
    var u = { x: chord.x / cl, y: chord.y / cl };
    var h1 = lineLen(P0, M) * SEAM_HANDLE_FRACTION, h2 = lineLen(M, P1) * SEAM_HANDLE_FRACTION;
    if (!(h1 > 1e-12) || !(h2 > 1e-12)) return null;
    var u0 = unit(sub(M, P0)), u1 = unit(sub(P1, M));
    return [
      { kind: "cubic", from: cp(P0), c1: add(P0, u0, h1), c2: add(M, u, -h1), to: cp(M), part: part },
      { kind: "cubic", from: cp(M), c1: add(M, u, h2), c2: add(P1, u1, -h2), to: cp(P1), part: part }
    ];
  }
  // 시작 접선을 지정한 단일 cubic(끝 접선은 현). ❹ "❸에 직각으로 출발" 용.
  function tangentCurve(P0, dir0, P1, part) {
    var chord = sub(P1, P0), cl = Math.hypot(chord.x, chord.y);
    if (!(cl > 1e-9)) return null;
    var h = cl * SEAM_HANDLE_FRACTION, u = { x: chord.x / cl, y: chord.y / cl };
    return { kind: "cubic", from: cp(P0), c1: add(P0, dir0, h), c2: add(P1, u, -h), to: cp(P1), part: part };
  }

  // params: { styleCode, headCircumferenceCm, hoodMeasureCm, widthOffsetCm, lengthOffsetCm,
  //           topStraightCm, cornerCurveCm, snpRadiusCm }
  //   실패: no-bodice / no-neckline / 몸판 의미 모서리 실패 / invalid-hood-style / invalid-head-circumference /
  //     invalid-hood-measure / invalid-hood-width / invalid-hood-length / invalid-top-straight /
  //     invalid-corner-curve / invalid-snp-radius / attach-angle-unreachable /
  //     back-attach-unreachable / self-intersection.
  function computeHood(bodiceResult, params) {
    var b = readBodice(bodiceResult); if (!b.ok) return b;
    var P = params || {}, style = P.styleCode;
    var HC = P.headCircumferenceCm, HM = P.hoodMeasureCm;
    var WO = P.widthOffsetCm, LO = P.lengthOffsetCm;
    var TS = P.topStraightCm, CCv = P.cornerCurveCm, SR = P.snpRadiusCm;
    if (style !== HOOD_STYLE.d) return { ok: false, reason: "invalid-hood-style" };
    if (!num(HC) || HC <= 0) return { ok: false, reason: "invalid-head-circumference" };
    if (!num(HM) || HM <= 0) return { ok: false, reason: "invalid-hood-measure" };
    if (!num(WO) || !num(LO)) return { ok: false, reason: "invalid-hood-width" };
    if (!num(TS) || TS <= 0) return { ok: false, reason: "invalid-top-straight" };
    if (!num(CCv) || CCv <= 0) return { ok: false, reason: "invalid-corner-curve" };
    if (!num(SR) || SR <= 0) return { ok: false, reason: "invalid-snp-radius" };
    var W = HC / 2 + WO, Lh = HM + LO;
    if (!(W > 0)) return { ok: false, reason: "invalid-hood-width" };
    if (!(Lh > 0)) return { ok: false, reason: "invalid-hood-length" };
    if (!(TS < W)) return { ok: false, reason: "invalid-top-straight" };
    if (!(CCv * Math.SQRT1_2 < W && CCv * Math.SQRT1_2 < Lh)) return { ok: false, reason: "invalid-corner-curve" };

    var fr = bodiceSeamFrame(bodiceResult, "front"); if (!fr.ok) return fr;
    // 프레임: FNP 원점, +x = 뒤(앞 중심선에서 몸판 안쪽), +y = 아래(앞 중심선 방향).
    var down = fr.centerDir, nPerp = { x: down.y, y: -down.x };
    var back = (nPerp.x * (fr.snp.x - fr.neckPoint.x) + nPerp.y * (fr.snp.y - fr.neckPoint.y)) >= 0
      ? nPerp : { x: -nPerp.x, y: -nPerp.y };
    var toFrame = function (p) {
      var dx = p.x - fr.neckPoint.x, dy = p.y - fr.neckPoint.y;
      return { x: dx * back.x + dy * back.y, y: dx * down.x + dy * down.y };
    };
    var mapSeg = function (s) {
      return s.kind === "line" ? { kind: "line", from: toFrame(s.from), to: toFrame(s.to) }
        : { kind: "cubic", from: toFrame(s.from), c1: toFrame(s.c1), c2: toFrame(s.c2), to: toFrame(s.to) };
    };
    var neckChain = fr.chain.map(mapSeg);                 // FNP → SNP (프레임)
    var neckLen = sumMeasure(neckChain);
    if (!(neckLen > 0)) return { ok: false, reason: "no-body-neckline" };
    var SNP = toFrame(fr.snp);
    if (!(SNP.x > 0)) return { ok: false, reason: "no-body-neckline" };
    // 2-❶ 앞 목둘레 2등분점 Ⓐ
    var halfPath = subpathByLength(neckChain, neckLen / 2);
    var A = cp(halfPath[halfPath.length - 1].to);

    var FNP = { x: 0, y: 0 };                             // ❶ 앞 끝선은 FNP 에서 곧게 올린다
    var frontTop = { x: 0, y: -Lh }, topBack = { x: W, y: -Lh };

    // 2-❷❸ Ⓑ: SNP 중심 반지름 SR 위. 각도 φ(+x=뒤 → +y=아래)는 **앞 달림선 실측 = 몸판 앞 목둘레**로 푼다.
    var bAt = function (phi) { return { x: SNP.x + SR * Math.cos(phi), y: SNP.y + SR * Math.sin(phi) }; };
    var frontAt = function (phi) { return smoothVia(FNP, A, bAt(phi), "neck-seam"); };
    var frontLenAt = function (phi) { var s = frontAt(phi); return s ? sumMeasure(s) : NaN; };
    var lo = 0, hi = Math.PI / 2, fLo = frontLenAt(lo), fHi = frontLenAt(hi);
    // φ 가 커질수록 Ⓑ 가 Ⓐ 쪽으로 내려와 앞 달림선이 짧아진다(단조).
    if (!(num(fLo) && num(fHi) && fHi <= b.frontCm && b.frontCm <= fLo)) return { ok: false, reason: "attach-angle-unreachable" };
    for (var i = 0; i < HOOD_SOLVE_STEPS; i++) {
      var mPhi = (lo + hi) / 2;
      if (frontLenAt(mPhi) > b.frontCm) lo = mPhi; else hi = mPhi;
    }
    var phi = (lo + hi) / 2, B = bAt(phi), frontAttach = frontAt(phi);
    if (!frontAttach) return { ok: false, reason: "attach-angle-unreachable" };

    // 2-❹ Ⓑ에서 수평(=프레임 x 축)으로 뒤 달림선 안내선 → 뒤 중심 안내선의 아래 끝이 정해진다.
    var cbGuideBottom = { x: W, y: B.y };
    var guideMid2 = { x: W, y: (-Lh + B.y) / 2 };         // 3-❷ 뒤 중심 안내선 2등분점
    // 3-❶❸❹ C: Ⓑ에서 뒤로 t. ❸(❶·❷ 2등분점 연결)에 직각으로 출발하는 완만한 곡선의 실측 = 몸판 뒤 목둘레.
    var backAt = function (t) {
      var C = { x: B.x + t, y: B.y };
      var m1 = { x: B.x + t / 2, y: B.y };                // 3-❶ 뒤 목둘레 구간의 2등분점
      var g = sub(guideMid2, m1), gl = Math.hypot(g.x, g.y);
      if (!(gl > 1e-9)) return null;
      var perp = { x: -g.y / gl, y: g.x / gl };           // ❸에 직각
      if (perp.y > 0) perp = { x: -perp.x, y: -perp.y };  // 뒤 중심선 쪽(위)으로 출발
      var seg = tangentCurve(C, { x: -perp.x, y: -perp.y }, B, "neck-seam");   // C → Ⓑ
      return seg ? { C: C, m1: m1, seg: seg } : null;
    };
    var backLenAt = function (t) { var r = backAt(t); return r ? segMeasure(r.seg) : NaN; };
    var tLo = 1e-6, tHi = b.backCm * 2 + W + Lh;
    if (!(num(backLenAt(tLo)) && num(backLenAt(tHi)) && backLenAt(tLo) <= b.backCm && b.backCm <= backLenAt(tHi)))
      return { ok: false, reason: "back-attach-unreachable" };
    for (var j = 0; j < HOOD_SOLVE_STEPS; j++) {
      var mT = (tLo + tHi) / 2;
      if (backLenAt(mT) < b.backCm) tLo = mT; else tHi = mT;
    }
    var back0 = backAt((tLo + tHi) / 2);
    if (!back0) return { ok: false, reason: "back-attach-unreachable" };
    var C0 = back0.C;

    // 1-❷ 윗변 직선 8 → 3-❺ 뒤 중심선(윗변 끝 · 뒤 위 모서리 대각 6.5 · C 를 잇는 완만한 곡선)
    var topEnd = { x: TS, y: -Lh };
    var corner = { x: W - CCv * Math.SQRT1_2, y: -Lh + CCv * Math.SQRT1_2 };
    var cbLine = smoothVia(topEnd, corner, C0, "cb-seam");
    if (!cbLine) return { ok: false, reason: "invalid-corner-curve" };

    var outline = [];
    outline.push(L(FNP, frontTop, "front-edge"));                     // ❶ 앞 끝선(얼굴 쪽)
    outline.push(L(frontTop, topEnd, "top-straight"));                // 윗변 직선 8
    cbLine.forEach(function (s) { outline.push(s); });                // 뒤 중심선
    outline.push(back0.seg);                                          // 뒤 달림선 C → Ⓑ
    frontAttach.slice().reverse().forEach(function (s) { outline.push(reverseCubic(s, "neck-seam")); });   // Ⓑ → Ⓐ → 앞 끝
    var closed = validateClosedOutline(outline);
    if (!closed.ok) return { ok: false, reason: closed.reason };

    var construction = [
      L(cbGuideBottom, topBack, "cb-guide"),              // 1-❸ 뒤 중심 안내선
      L(back0.m1, guideMid2, "mid-guide")                 // 3-❸ 2등분점을 잇는 안내선
    ];
    var by = function (part) { return outline.filter(function (s) { return s.part === part; }); };
    var frontLen = sumMeasure(by("neck-seam")) - segMeasure(back0.seg);
    var backLen = segMeasure(back0.seg);
    // 뒤 달림선 처짐(도해 0.6): 현에서 가장 멀어진 거리 — 입력이 아니라 **파생 실측**이다.
    var bow = 0, fl = flattenSeg(back0.seg);
    for (var k = 0; k < fl.length; k++) bow = Math.max(bow, distPtLine(fl[k], C0, B));
    return { ok: true,
      geometry: { outline: outline, construction: construction },
      measure: {
        styleCode: style, headCircumferenceCm: HC, hoodMeasureCm: HM,
        widthOffsetCm: WO, lengthOffsetCm: LO, topStraightCm: TS, cornerCurveCm: CCv,
        snpRadiusCm: SR,
        hoodWidthCm: W, hoodLengthCm: Lh,
        backNeckLenCm: b.backCm, bodyFrontNeckLenCm: b.frontCm, bodyNeckChainLenCm: neckLen,
        neckTargetCm: b.backCm + b.frontCm,
        frontAttachLenCm: frontLen, backAttachLenCm: backLen, attachLenCm: frontLen + backLen,
        snpRadiusLenCm: lineLen(SNP, B), snpAngleDeg: phi * 180 / Math.PI,
        backSeamBowCm: bow,
        frontEdgeLenCm: sumMeasure(by("front-edge")),
        topStraightLenCm: sumMeasure(by("top-straight")), cbLenCm: sumMeasure(by("cb-seam"))
      },
      anchors: { fnp: cp(FNP), frontTop: cp(frontTop), topBack: cp(topBack),
        topStraightEnd: cp(topEnd), corner: cp(corner), cbBottom: cp(C0), attachJoin: cp(B),
        frontMid: cp(A), snp: cp(SNP), cbGuideBottom: cp(cbGuideBottom), guideMid1: cp(back0.m1), guideMid2: cp(guideMid2) } };
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
    computeFlatCollarS: computeFlatCollarS,     // family 4(플랫 칼라 S, P.69 · 제도 방법 P.149 공통 절차)
    computeFlatCollarT: computeFlatCollarT,     // family 4(플랫 칼라 T, P.69 하단 · 제도 방법 P.149)
    computeSailorCollarU: computeSailorCollarU,   // family 5(세일러 칼라 U, P.70 · 제도 방법 P.150)
    SAILOR_COLLAR_U_METHOD: SAILOR_COLLAR_U_METHOD,
    computeBowCollar: computeBowCollar,           // family 6(보 칼라 X·Y·Z, P.71 — 직사각형 한 장)
    BOW_COLLAR_METHOD: BOW_COLLAR_METHOD,
    computeFrillCollar: computeFrillCollar,       // family 7(프릴 칼라 a·b·c, P.72–73)
    FRILL_COLLAR_METHOD: FRILL_COLLAR_METHOD,
    computeHood: computeHood,                     // family 8(후드 d, P.74 · 제도 방법 P.151)
    HOOD_METHOD: HOOD_METHOD,
    HOOD_STYLE: HOOD_STYLE,
    FLAT_COLLAR_T_METHOD: FLAT_COLLAR_T_METHOD,
    FLAT_COLLAR_S_METHOD: FLAT_COLLAR_S_METHOD,
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
