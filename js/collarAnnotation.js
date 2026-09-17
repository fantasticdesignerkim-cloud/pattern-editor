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
      dim(dims, "band-width", "dim", cbSeam, cbTop, sp.standHeightCm);
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
      var bCb = pt(ba.bandTopCb), bCf = pt(ba.bandTopCf), G = pt(ba.upperCbSeam), O = pt(ba.cbOuter), A = pt(ba.setbackPoint), T = pt(ba.tip);
      if (bCb && G) {
        var gapTop = { x: bCb.x, y: G.y };   // gap 높이는 밴드 위선 CB 에서 수직; CB 보정은 그 높이에서 수평
        dim(dims, "gap", "dim", bCb, gapTop, bp.gapCm);
        dim(dims, "cb-correction", "ref", gapTop, G, null);
      }
      dim(dims, "cb-width", "dim", G, O, bp.cbWidthCm);
      dim(dims, "setback", "dim", bCf, A, bp.frontInsetCm);
      if (A && T) {
        var refTop = { x: A.x, y: T.y };      // setback 점의 CB 평행 수직 기준선
        dim(dims, "setback-vertical", "ref", A, refTop, null);
        dim(dims, "projection", "dim", refTop, T, bp.frontProjectionCm);
        dim(dims, "point-diagonal", "dim", A, T, bp.pointDiagonalCm);
      }
      if (A) labels.push({ id: "setback", at: A, text: "setback" });
    }

    var inputs = [
      { key: "standHeightCm", label: "밴드 폭", value: val(sp.standHeightCm) },
      { key: "frontRiseCm", label: "CF 앞끝 올림", value: val(sp.frontRiseCm) },
      { key: "gapCm", label: "위칼라 gap(CB)", value: body ? val(bp.gapCm) : null },
      { key: "cbWidthCm", label: "위칼라 CB 폭", value: body ? val(bp.cbWidthCm) : null },
      { key: "frontInsetCm", label: "setback(밴드 위선 CF→CB)", value: body ? val(bp.frontInsetCm) : null },
      { key: "frontProjectionCm", label: "수평 돌출", value: body ? val(bp.frontProjectionCm) : null },
      { key: "pointDiagonalCm", label: "끝 사선", value: body ? val(bp.pointDiagonalCm) : null },
      { key: "outerBowCm", label: "외곽 휨", value: body ? val(bp.outerBowCm) : null }
    ];
    var nl = (bodice && bodice.necklineLengths) || {};
    var diff = val(bm.seamLengthDiffCm), corr = val(bm.cbCorrectionCm);
    var actualSetback = (num(bm.bandTopNeckLenCm) && num(bm.bandAttachLenCm)) ? bm.bandTopNeckLenCm - bm.bandAttachLenCm : null;
    var results = [
      { key: "neckBack", label: "몸판 뒤목(반쪽)", value: val(nl.back) },
      { key: "neckFront", label: "몸판 앞목(반쪽)", value: val(nl.front) },
      { key: "neckHalf", label: "반패턴 목둘레 합계(앞반+뒤반)", value: val(nl.half) },
      { key: "neckFinished", label: "완성 목둘레(반패턴×2)", value: val(nl.finished) },
      { key: "lowerNeckSeam", label: "밴드 아래선 목 봉제", value: val(sm.lowerNeckSeamLenCm) },
      { key: "lowerExtension", label: "밴드 여밈 연장", value: val(sm.lowerExtensionLenCm) },
      { key: "bandTopNeck", label: "밴드 위선 기준 길이", value: val(sm.upperNeckSegmentLenCm) },
      { key: "bandAttach", label: "setback 이후 밴드 기준 봉제", value: val(bm.bandAttachLenCm) },
      { key: "upperSeam", label: "위칼라 이음선 실제 길이", value: val(bm.upperCollarSeamLenCm) },
      { key: "seamDiff", label: "이음선 길이차", value: diff, status: diff == null ? null : (Math.abs(diff) <= SEAM_MATCH_TOL ? "match" : "mismatch") },
      { key: "cbCorrection", label: "CB 길이 보정", value: corr, text: corr == null ? null : (corr >= 0 ? "앞쪽 " : "뒤쪽 ") + Math.abs(corr).toFixed(2) },
      { key: "derivedVertical", label: "파생 세로성분 √(사선²−돌출²)", value: val(bm.frontWidthCm) },
      { key: "actualCbWidth", label: "실제 CB 폭", value: val(bm.cbWidthCm) },
      { key: "actualSetback", label: "실제 setback(밴드 위선 − 기준 봉제)", value: actualSetback },
      { key: "actualProjection", label: "실제 수평 돌출", value: val(bm.frontProjectionCm) },
      { key: "actualDiagonal", label: "실제 사선", value: val(bm.pointDiagonalLenCm) }
    ];
    return { recipe: cd.baseMethod, mode: manual ? "manual" : "parametric",
      note: manual ? "직접 수정 중 · 제도 기준 치수는 참고값(본체 보조선 숨김)" : null,
      dims: dims, labels: labels, inputs: inputs, results: results };
  }

  var RECIPES = { "bunka-shirt-collar-M-v2": mRecipe };

  // 스탠드가 없거나(stale 숨김 포함) recipe 가 등록돼 있지 않으면 null — 이전 수치를 current 처럼 남기지 않는다.
  function buildModel(collarDraft, bodiceResult) {
    if (!collarDraft || !collarDraft.standGeometry) return null;
    var fn = RECIPES[collarDraft.baseMethod];
    return fn ? fn(collarDraft, bodiceResult || null) : null;
  }

  window.collarAnnotation = Object.freeze({ buildModel: buildModel, SEAM_MATCH_TOL: SEAM_MATCH_TOL, recipes: function () { return Object.keys(RECIPES); } });
})();
