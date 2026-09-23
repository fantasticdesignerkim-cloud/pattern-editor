// ══════════════════════════════════════════════
// collarAnnotation.js — 카라 제도 보조수치 표시 모델(순수, UI/annotation 전용).
//
// ★ 이 모듈이 만드는 것은 형상이 아니다. pattern geometry·collarResult/designResult hash·완료 게이트·출력
//   형상 어디에도 들어가지 않는다. render.js(오버레이)와 ui.js(읽기 전용 패널)만 소비한다.
// ★ 좌표·배열 순서·근접으로 의미를 추론하지 않는다. designCollar 가 만든 named anchors
//   (collarDraft.standAnchors / collarDraft.body.anchors) + parameters + measures 만 쓴다.
// ★ recipe 별 표시 규칙은 RECIPES[baseMethod] 한 곳. M 상수를 복제하지 않고 parameters 값을 그대로 표시한다.
//   다른 칼라 recipe 는 자기 builder 를 등록할 때까지 표시 모델이 없다(null).
//
// buildModel(collarDraft, bodiceResult) → null | {
//   recipe, mode:"parametric"|"manual", note,
//   dims:   [{ id, kind:"dim"|"ref", from, to, text }]   // 카라 로컬 cm(designCollar 프레임)
//   labels: [{ id, at, text }]
//   inputs: [{ key, label, value }]                        // 제도 입력값(parameters)
//   results:[{ key, label, value, text?, status? }]        // 계산·정합 결과(measures, 없으면 value=null)
// }
// ══════════════════════════════════════════════
(function () {
  "use strict";
  // 위칼라 이음선↔밴드 기준 길이 정합 허용치 — collarCheckpoint 의 seam-length-mismatch 판정과 같은 값(표시 전용).
  var SEAM_MATCH_TOL = 0.01;

  function num(v) { return typeof v === "number" && isFinite(v); }
  function val(v) { return num(v) ? v : null; }
  function pt(p) { return (p && num(p.x) && num(p.y)) ? { x: p.x, y: p.y } : null; }
  function dim(out, id, kind, from, to, text) { if (from && to) out.push({ id: id, kind: kind, from: from, to: to, text: text == null ? null : text }); }

  function mRecipe(cd, bodice) {
    var sp = (cd.parameters && cd.parameters.stand) || {}, sa = cd.standAnchors || null, sm = cd.measure || {};
    var body = cd.body || null, bp = (body && body.parameters) || {}, bm = (body && body.measure) || {};
    var manual = !!(body && body.mode === "manual");
    var ba = (body && !manual) ? body.anchors : null;   // manual: 과거 parametric anchor 를 현재 형상처럼 쓰지 않는다
    var dims = [], labels = [];

    if (sa) {
      var cbSeam = pt(sa.cbSeam), cbTop = pt(sa.cbTop), cfSeam = pt(sa.cfSeam), bandTopCf = pt(sa.upperNeckEnd);
      dim(dims, "band-width", "dim", cbSeam, cbTop, sp.bandWidthCm);
      if (cbSeam && cfSeam) {
        var riseBase = { x: cfSeam.x, y: cbSeam.y };   // CB 목점을 지나는 기준 수평선 위, CF 와 같은 x
        dim(dims, "cb-baseline", "ref", cbSeam, riseBase, null);
        dim(dims, "cf-rise", "dim", riseBase, cfSeam, sp.frontRiseCm);
      }
      dim(dims, "cf-perpendicular", "ref", cfSeam, bandTopCf, null);   // CF 올림점에서 밴드 아래선에 90°
      if (cbSeam) labels.push({ id: "cb", at: cbSeam, text: "CB" });
      if (cfSeam) labels.push({ id: "cf", at: cfSeam, text: "CF" });
    }
    if (ba) {
      var bCb = pt(ba.bandTopCb), bCf = pt(ba.bandTopCf), G = pt(ba.upperCbSeam), O = pt(ba.cbOuter), A = pt(ba.attachFront), T = pt(ba.tip);
      if (bCb && G) {
        var gapTop = { x: bCb.x, y: G.y };   // gap 높이는 밴드 위선 CB 에서 수직; CB 보정은 그 높이에서 수평
        dim(dims, "gap", "dim", bCb, gapTop, bp.gapCm);
        dim(dims, "cb-correction", "ref", gapTop, G, null);
      }
      dim(dims, "cb-width", "dim", G, O, bp.cbWidthCm);
      if (A && T) {
        var refTop = { x: A.x, y: T.y };      // Ⓒ(밴드 윗선 앞 끝)의 CB 평행 수직 기준선
        dim(dims, "setback-vertical", "ref", A, refTop, null);   // dim id 는 표시 계약(안정 키)이라 유지, 의미는 Ⓒ 수직 기준선
        dim(dims, "projection", "dim", refTop, T, bp.frontProjectionCm);
        dim(dims, "point-diagonal", "dim", A, T, bp.pointDiagonalCm);
      }
      if (A) labels.push({ id: "attach-front", at: A, text: "Ⓒ" });
    }

    var inputs = [
      { key: "bandWidthCm", label: "밴드 폭", value: val(sp.bandWidthCm) },
      { key: "frontRiseCm", label: "앞 중심 올림", value: val(sp.frontRiseCm) },
      { key: "frontEndCm", label: "앞 끝선(앞 중심선 앞)", value: val(sp.frontEndCm) },
      { key: "gapCm", label: "위칼라 gap(CB)", value: body ? val(bp.gapCm) : null },
      { key: "cbWidthCm", label: "위칼라 CB 폭", value: body ? val(bp.cbWidthCm) : null },
      { key: "frontProjectionCm", label: "수평 돌출", value: body ? val(bp.frontProjectionCm) : null },
      { key: "pointDiagonalCm", label: "끝 사선", value: body ? val(bp.pointDiagonalCm) : null },
      { key: "outerBowCm", label: "외곽 휨", value: body ? val(bp.outerBowCm) : null }
    ];
    var nl = (bodice && bodice.necklineLengths) || {};
    var diff = val(bm.seamLengthDiffCm), corr = val(bm.cbCorrectionCm);
    // 목둘레 ↔ 밴드 달림선, 밴드 윗선 ↔ 위칼라 이음선의 실측 차이(P.148 ⑭·step 3 의 보정 결과).
    var neckDiff = (num(nl.half) && num(sm.lowerNeckSeamLenCm)) ? sm.lowerNeckSeamLenCm - nl.half : null;
    var cbTrim = val(sm.cbTrimCm);
    var results = [
      { key: "neckBack", label: "몸판 뒤목(반쪽)", value: val(nl.back) },
      { key: "neckFront", label: "몸판 앞목(반쪽)", value: val(nl.front) },
      { key: "neckHalf", label: "반패턴 목둘레 합계(앞반+뒤반)", value: val(nl.half) },
      { key: "neckFinished", label: "완성 목둘레(반패턴×2)", value: val(nl.finished) },
      { key: "lowerNeckSeam", label: "밴드 달림선 실측", value: val(sm.lowerNeckSeamLenCm) },
      { key: "neckDiff", label: "달림선 − 목둘레 합계", value: neckDiff, status: neckDiff == null ? null : (Math.abs(neckDiff) <= SEAM_MATCH_TOL ? "match" : "mismatch") },
      { key: "cbTrim", label: "밴드 뒤중심 보정(그린 길이 − 목둘레)", value: cbTrim },
      { key: "lowerExtension", label: "밴드 앞 끝선 연장", value: val(sm.lowerExtensionLenCm) },
      { key: "bandTopNeck", label: "밴드 윗선 ⒸⒹ 실측", value: val(sm.upperNeckSegmentLenCm) },
      { key: "upperSeam", label: "위칼라 이음선 실제 길이", value: val(bm.upperCollarSeamLenCm) },
      { key: "seamDiff", label: "이음선 길이차", value: diff, status: diff == null ? null : (Math.abs(diff) <= SEAM_MATCH_TOL ? "match" : "mismatch") },
      { key: "cbCorrection", label: "CB 길이 보정", value: corr, text: corr == null ? null : (corr >= 0 ? "앞쪽 " : "뒤쪽 ") + Math.abs(corr).toFixed(2) },
      { key: "derivedVertical", label: "파생 세로성분 √(사선²−돌출²)", value: val(bm.frontWidthCm) },
      { key: "actualCbWidth", label: "실제 CB 폭", value: val(bm.cbWidthCm) },
      { key: "actualProjection", label: "실제 수평 돌출", value: val(bm.frontProjectionCm) },
      { key: "actualDiagonal", label: "실제 사선", value: val(bm.pointDiagonalLenCm) }
    ];
    return { recipe: cd.baseMethod, mode: manual ? "manual" : "parametric",
      note: manual ? "직접 수정 중 · 제도 기준 치수는 참고값(본체 보조선 숨김)" : null,
      dims: dims, labels: labels, inputs: inputs, results: results };
  }

  // 한 장 셔츠 칼라(교재 P.147, G·H P.63, I·J P.64) 표시 모델. designCollar.computeOnePiece 의 named anchors·
  //   parameters·measure 만 쓴다(좌표 추론 없음). 달림선 실측과 목둘레(뒤목+앞목) 차이는 **표시만**.
  function gRecipe(cd) {
    var op = cd.onePiece || null, P = (cd.parameters && cd.parameters.onePiece) || {}, m = (op && op.measure) || {};
    var an = (op && op.anchors) || null;
    var dims = [], labels = [];
    if (an) {
      var N0 = pt(an.cbAttach), A = pt(an.a), B = pt(an.b), C = pt(an.tipBase), D = pt(an.tip);
      var F0 = pt(an.cbFold), O0 = pt(an.cbOuter), Fa = pt(an.foldGuide), Oa = pt(an.outerGuide);
      if (N0 && B) {
        var base = { x: N0.x, y: B.y };                       // 기초 안내선 ①(y = B 의 높이)
        dim(dims, "baseline", "ref", base, B, null);
        dim(dims, "rise", "dim", base, N0, P.riseCm);         // ③ 올림 치수 ★
      }
      dim(dims, "collar-stand", "dim", N0, F0, P.collarStandCm);        // ② 칼라 허리
      dim(dims, "back-collar-width", "dim", F0, O0, P.backCollarWidthCm);  // 허리 위에 이어지는 뒤 칼라 폭
      dim(dims, "back-neck", "dim", N0, A, m.backNeckLenCm);           // ④ 뒤 목둘레 ×(직선 치수)
      dim(dims, "front-neck", "dim", A, B, m.frontNeckLenCm);          // ⑤ 앞 목둘레 ⊘(직선 치수)
      dim(dims, "tip-projection", "dim", B, C, P.tipProjectionCm);     // ⑦ 칼라 끝(수평)
      dim(dims, "front-collar-width", "dim", B, D, P.frontCollarWidthCm);   // ⑨ 앞 칼라 폭
      dim(dims, "guide-fold", "ref", A, Fa, null);                     // 2-① 안내선 위의 허리·폭 점
      dim(dims, "guide-outer", "ref", Fa, Oa, null);
      if (N0) labels.push({ id: "cb", at: N0, text: "CB" });
      if (A) labels.push({ id: "a", at: A, text: "A" });
      if (B) labels.push({ id: "b", at: B, text: "B" });
      if (D) labels.push({ id: "tip", at: D, text: "칼라 끝" });
    }
    var inputs = [
      { key: "riseCm", label: "올림 치수(★)", value: val(P.riseCm) },
      { key: "backCollarWidthCm", label: "뒤 칼라 폭", value: val(P.backCollarWidthCm) },
      { key: "collarStandCm", label: "칼라 허리", value: val(P.collarStandCm) },
      { key: "frontCollarWidthCm", label: "앞 칼라 폭", value: val(P.frontCollarWidthCm) },
      { key: "tipProjectionCm", label: "칼라 끝(수평)", value: val(P.tipProjectionCm) },
      { key: "attachCurveCm", label: "달림선 곡률", value: val(P.attachCurveCm) }
    ];
    if (P.attachCurveDirection === "reversed") inputs.push({ key: "attachCurveDirection", label: "앞 달림선 곡선 방향", value: null, text: "반대 방향" });
    var diff = num(m.attachDiffCm) ? m.attachDiffCm : null;
    var results = [
      { key: "backNeck", label: "몸판 뒤목(반쪽) ×", value: val(m.backNeckLenCm) },
      { key: "frontNeck", label: "몸판 앞목(반쪽) ⊘", value: val(m.frontNeckLenCm) },
      { key: "neckTarget", label: "목둘레 합(×+⊘)", value: val(m.neckTargetCm) },
      { key: "attachLen", label: "달림선 실측 길이", value: val(m.attachLenCm) },
      // 교재는 외곽 치수를 목둘레에 맞추지 않고 가봉으로 조정한다 → 차이는 정합 판정이 아니라 사실 표시.
      { key: "attachDiff", label: "달림선 − 목둘레 합", value: diff, text: diff == null ? null : (diff >= 0 ? "+" : "−") + Math.abs(diff).toFixed(2) },
      { key: "foldLen", label: "꺾임선 길이", value: val(m.foldLenCm) },
      { key: "outerLen", label: "외곽선 길이", value: val(m.outerLenCm) },
      { key: "tipRise", label: "칼라 끝 높이(파생)", value: val(m.tipRiseCm) }
    ];
    var note = cd.baseMethod === "bunka-shirt-collar-J-v1"
      ? "교재 J는 달림선을 직선에 가까운 완만한 곡선으로 설명하며 곡률 수치를 표기하지 않습니다. 0cm는 별도 볼록 오프셋을 주지 않는 구현 기준입니다."
      : cd.baseMethod === "bunka-shirt-collar-K-v1"
        ? "교재 K는 I형과 같은 치수에서 앞 달림선 곡률 0.6cm를 반대 방향으로 그려 칼라 허리 부분을 늘립니다."
        : null;
    return { recipe: cd.baseMethod, mode: "parametric", note: note, dims: dims, labels: labels, inputs: inputs, results: results };
  }

  // 오픈 칼라(교재 L, P.65 · 몸판 연동) 표시 모델. designCollar.computeOpenCollar 의 named anchors·parameters·
  //   measure 만 쓴다. ★ bodyLink(꺾임선)는 **몸판 프레임 좌표**라 카라 로컬 dims 에 넣지 않고 수치로만 보고한다.
  function lRecipe(cd) {
    var oc = cd.openCollar || null, P = (cd.parameters && cd.parameters.openCollar) || {}, m = (oc && oc.measure) || {};
    var an = (oc && oc.anchors) || null, bl = (oc && oc.bodyLink) || null;
    var dims = [], labels = [];
    if (an) {
      var O = pt(an.cbAttach), Fd = pt(an.cbFold), Ou = pt(an.cbOuter), E = pt(an.baseEnd), R = pt(an.outerEnd), F = pt(an.frontEnd), J = pt(an.foldJunction);
      dim(dims, "baseline", "ref", O, E, null);                              // ① 기초선(CB 에 직각)
      dim(dims, "collar-stand", "dim", O, Fd, P.collarStandCm);              // ② 칼라 허리
      dim(dims, "back-collar-width", "dim", Fd, Ou, P.backCollarWidthCm);    // 허리 위에 이어지는 뒤 칼라 폭
      dim(dims, "front-end-rise", "dim", E, F, P.frontEndRiseCm);            // ③ 앞 끝 올림(기초선 위)
      dim(dims, "front-straight", "dim", J, F, P.frontStraightCm);           // ④ 앞 끝 직선 구간
      dim(dims, "front-edge", "dim", R, F, val(m.frontEdgeLenCm));           // ⑦ 앞 끝선(수직)
      dim(dims, "outer-horizontal", "ref", Ou, R, null);                     // ⑥ 외곽 수평선
      if (O) labels.push({ id: "cb", at: O, text: "CB" });
      if (J) labels.push({ id: "fold-junction", at: J, text: "꺾임점" });
      if (F) labels.push({ id: "front-end", at: F, text: "앞 끝" });
    }
    var inputs = [
      { key: "backCollarWidthCm", label: "뒤 칼라 폭", value: val(P.backCollarWidthCm) },
      { key: "collarStandCm", label: "칼라 허리", value: val(P.collarStandCm) },
      { key: "frontEndRiseCm", label: "앞 끝 올림(기초선 위)", value: val(P.frontEndRiseCm) },
      { key: "frontStraightCm", label: "앞 직선 구간", value: val(P.frontStraightCm) },
      { key: "breakPointDistanceCm", label: "앞목점→꺾임 끝(직선)", value: val(P.breakPointDistanceCm) }
    ];
    var d = num(m.attachDiffCm) ? m.attachDiffCm : null;
    var results = [
      { key: "backNeck", label: "몸판 뒤목(반쪽) ×", value: val(m.backNeckLenCm) },
      { key: "frontNeck", label: "몸판 앞목(반쪽) ⊘", value: val(m.frontNeckLenCm) },
      { key: "neckTarget", label: "목둘레 합(×+⊘)", value: val(m.neckTargetCm) },
      { key: "attachLen", label: "달림선 실측 길이", value: val(m.attachLenCm) },
      // ★ L 은 길이 책임이 달림선에 있다(사용자 확정) — 차이는 사실 표시가 아니라 정합 판정이다.
      { key: "attachDiff", label: "달림선 − 목둘레 합", value: d, status: d == null ? null : (Math.abs(d) <= SEAM_MATCH_TOL ? "match" : "mismatch") },
      { key: "baseLineLen", label: "기초선 길이(파생)", value: val(m.baseLineLenCm) },
      { key: "foldLift", label: "꺾임점 들림(파생)", value: val(m.foldJunctionLiftCm) },
      { key: "foldLen", label: "칼라 꺾임선 길이", value: val(m.foldLenCm) },
      { key: "outerLen", label: "외곽선(수평) 길이", value: val(m.outerLenCm) },
      { key: "frontEdge", label: "앞 끝선 길이", value: val(m.frontEdgeLenCm) },
      { key: "breakStartArc", label: "몸판 목둘레선 위 꺾임 시작(호)", value: val(m.breakStartArcCm) },
      { key: "breakDrop", label: "앞목점 아래 꺾임 끝 내림(파생)", value: val(m.breakDropCm) },
      { key: "frontOverlap", label: "앞 여밈분(꺾임 끝 기준선)", value: val(m.frontOverlapCm) },
      { key: "breakLineLen", label: "몸판 앞 꺾임선 길이", value: val(m.breakLineLenCm) }
    ];
    var note = bl ? "몸판 앞 목둘레선·여밈 끝선에서 꺾임선을 먼저 그린 뒤 그 치수로 제도(몸판 형상은 변경하지 않음)" : null;
    return { recipe: cd.baseMethod, mode: "parametric", note: note, dims: dims, labels: labels, inputs: inputs, results: results };
  }

  function standaloneRecipe(cd) {
    var sa = cd.standalone || null, P = (cd.parameters && cd.parameters.standalone) || {}, m = (sa && sa.measure) || {};
    var C = cd.construction || {};
    var an = (sa && sa.anchors) || null, dims = [], labels = [];
    if (an) {
      var cb = pt(an.cbSeam), cbOuter = pt(an.cbOuter), A = pt(an.guideA), cf = pt(an.cfSeam);
      var cfGuide = pt(an.cfOuterGuide), cfOuter = pt(an.cfOuter);
      var frontEdgeSeam = pt(an.frontEdgeSeam), frontEdgeOuter = pt(an.frontEdgeOuter);
      dim(dims, "collar-width", "dim", cb, cbOuter, P.collarWidthCm);
      if (cb && cf) {
        var riseBase = { x: cf.x, y: cb.y };
        dim(dims, "baseline", "ref", cb, riseBase, null);
        dim(dims, "front-rise", "dim", riseBase, cf, P.frontRiseCm);
      }
      dim(dims, "top-setback", "dim", cfGuide, cfOuter, P.topSetbackCm);
      dim(dims, "front-reference", "ref", cf, cfGuide, null);
      if (frontEdgeSeam && m.frontExtensionCm > 0) dim(dims, "front-extension", "dim", cf, frontEdgeSeam, m.frontExtensionCm);
      if (cb) labels.push({ id: "cb", at: cb, text: "CB" });
      if (A) labels.push({ id: "guide-a", at: A, text: "A(2/3)" });
      if (cf) labels.push({ id: "cf", at: cf, text: "CF" });
      if (frontEdgeSeam && m.frontExtensionCm > 0) labels.push({ id: "front-edge", at: frontEdgeSeam, text: "앞끝" });
    }
    var d = val(m.attachDiffCm);
    var inputs = [
        { key: "collarWidthCm", label: "칼라 폭", value: val(P.collarWidthCm) },
        { key: "frontRiseCm", label: "앞 중심 올림", value: val(P.frontRiseCm) },
        { key: "topSetbackCm", label: "앞 윗끝 물림", value: val(P.topSetbackCm) },
        { key: "baselineReductionCm", label: "기초선 선감산", value: val(C.baselineReductionCm) },
        { key: "guideRiseCm", label: "2/3 기준점 올림", value: val(C.guideRiseCm) }
      ];
    if (C.slashSpreadCm != null) {
      inputs.push({ key: "slashSpreadCm", label: "절개 1곳 외곽 벌림", value: val(C.slashSpreadCm) });
      inputs.push({ key: "slashCount", label: "벌림 위치 수", value: val(C.slashCount), unit: "개" });
    }
    var results = [
        { key: "backNeck", label: "몸판 뒤목(반쪽) ×", value: val(m.backNeckLenCm) },
        { key: "frontNeck", label: "몸판 앞목(반쪽) ⊘", value: val(m.frontNeckLenCm) },
        { key: "neckTarget", label: "목둘레 합(×+⊘)", value: val(m.neckTargetCm) },
        { key: "drawnAttachLen", label: "보정 전 달림선", value: val(m.drawnAttachLenCm) },
        { key: "cbTrim", label: "뒤중심 길이 보정", value: val(m.cbTrimCm) },
        { key: "frontExtension", label: "몸판 앞중심→앞끝 연장", value: val(m.frontExtensionCm) },
        { key: "attachLen", label: "달림선 실측 길이", value: val(m.attachLenCm) },
        { key: "attachDiff", label: "달림선 − 목둘레 합", value: d, text: d == null ? null : (d >= 0 ? "+" : "−") + Math.abs(d).toFixed(2) },
        { key: "outerLen", label: "외곽선 길이", value: val(m.outerLenCm) },
        { key: "frontEdge", label: "앞 중심 끝선 길이", value: val(m.frontEdgeLenCm) }
      ];
    if (m.spreadEachCm != null) {
      results.push({ key: "neckOffsets", label: "F 목선 이동(뒤·SNP/앞)", value: null, text: "2.00 · 3.00 cm" });
      results.push({ key: "totalSpread", label: "외곽 총 벌림", value: val(m.totalSpreadCm) });
    }
    return { recipe: cd.baseMethod, mode: "parametric", note: null, dims: dims, labels: labels, inputs: inputs, results: results };
  }

  var RECIPES = { "bunka-band-collar-P148-v1": mRecipe, "bunka-shirt-collar-G-v1": gRecipe,
    "bunka-shirt-collar-H-v1": gRecipe,
    "bunka-shirt-collar-I-v1": gRecipe,
    "bunka-shirt-collar-J-v1": gRecipe,
    "bunka-shirt-collar-K-v1": gRecipe,
    "bunka-open-collar-L-v1": lRecipe,
    "bunka-stand-collar-A-P146-v1": standaloneRecipe,
    "bunka-stand-collar-B-P146-v1": standaloneRecipe,
    "bunka-stand-collar-C-P146-v1": standaloneRecipe,
    "bunka-stand-collar-D-P146-v1": standaloneRecipe,
    "bunka-stand-collar-E-P146-v1": standaloneRecipe,
    "bunka-stand-collar-F-P146-v1": standaloneRecipe };

  // 스탠드가 없거나(stale 숨김 포함) recipe 가 등록돼 있지 않으면 null — 이전 수치를 current 처럼 남기지 않는다.
  function buildModel(collarDraft, bodiceResult) {
    if (!collarDraft) return null;
    var onePiece = collarDraft.type === "shirt-one-piece", standalone = collarDraft.type === "stand-collar";
    var openCollar = collarDraft.type === "shirt-open-collar";
    if (onePiece ? !(collarDraft.onePiece && collarDraft.onePiece.geometry)
      : openCollar ? !(collarDraft.openCollar && collarDraft.openCollar.geometry)
        : standalone ? !(collarDraft.standalone && collarDraft.standalone.geometry) : !collarDraft.standGeometry) return null;
    var fn = RECIPES[collarDraft.baseMethod];
    return fn ? fn(collarDraft, bodiceResult || null) : null;
  }

  window.collarAnnotation = Object.freeze({ buildModel: buildModel, SEAM_MATCH_TOL: SEAM_MATCH_TOL, recipes: function () { return Object.keys(RECIPES); } });
})();
