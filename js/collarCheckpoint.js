// ══════════════════════════════════════════════
// collarCheckpoint.js — 카라 모양 완료. bodice/sleeve 체크포인트와 같은 결의 세션 스냅샷.
//
// Design 카라 결과를 working.collarResult 로 잠근다. **아직 시접·너치·심지·윗칼라/밑칼라 차이·재단 아님.**
// ★ 형상 종속성과 작업 순서 게이트를 분리한다:
//   · 형상 source = bodiceResult(sourceBodiceHash 고정). 몸판 hash 변경 → 카라 무효.
//   · 소매 완료본은 **작업 순서 게이트일 뿐** — 스냅샷 source 에 미포함. 소매 변경은 카라 result 를
//     무효화하지 않고 "소매 단계 변경됨 · 작업 순서 확인 필요"만 표시.
//
// 완료 게이트(모두 통과): bodiceResult 존재·비스테일 / collarDraft.sourceBodiceHash===bodice.hash /
//   현재 sleeveResult 존재·비스테일(순서 게이트) / 스탠드·본체 geometry 존재·폐곡선·자기교차 없음 /
//   (오픈 칼라 L: 한 조각 폐곡선 + 달림선 실측 = ×+⊘ + 몸판 꺾임선 출처 존재) /
//   (윙 칼라 Q: 밴드·칼라 끝 폐곡선 + 달림선 = ×+⊘ + 칼라 끝 7·1.5·4.5 실측 일치) /
//   (보 칼라 X·Y·Z: 직사각형 폐곡선 + 달림선 실측 = ×+⊠ + 리본 길이·칼라 폭 실측 일치) /
//   (후드 d: 한 조각 폐곡선 + 앞·뒤 달림선 실측 = 몸판 앞목·뒤목 + 폭·길이 = 머리둘레·후드 치수 파생) /
//   (테일러드 h·i: 폐곡선 + 뒤 달림선 = 뒤 목둘레 + 칼라 허리·폭·라펠 폭 + 칼라 끝 정삼각형 + 라펠 bodyLink) /
//   body manual 이면 관리선 존재·invalid===false / gap(CB 제도 간격) 기록 / 위칼라 이음선 길이 = 밴드 기준 봉제 길이
//   (= 밴드 윗선 ⒸⒹ 전체, 앞 끝선 연장 미포함 — P.148 step 3) / 실측·파라미터 유한. 실패 시 기존 collarResult·현재 geometry 불변.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function round4(v) { return Math.round(v * 1e4) / 1e4; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); } return o; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function num(v) { return typeof v === "number" && isFinite(v); }

  // outline → 좌표 정준 문자열(형상 hash 용, line/cubic).
  function canonGeom(geom) {
    return ((geom && geom.outline) || []).map(function (s) {
      if (s.kind === "line") return "L" + [s.from.x, s.from.y, s.to.x, s.to.y].map(round4).join(",");
      if (s.kind === "cubic") return "C" + [s.from.x, s.from.y, s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y].map(round4).join(",");
      return "P" + (s.commands || []).map(function (c) { return c.type + c.points.map(function (p) { return round4(p.x) + "/" + round4(p.y); }).join(";"); }).join("|");
    });
  }
  function canonSegs(segs) {
    return (segs || []).map(function (s) {
      if (s.kind === "cubic") return "C" + [s.from.x, s.from.y, s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y].map(round4).join(",");
      return "L" + [s.from.x, s.from.y, s.to.x, s.to.y].map(round4).join(",");
    });
  }

  // 카라 종류 판별: family 2(한 장, P.147) vs family 3(밴드+위칼라 2피스). 기본은 2피스(legacy draft 호환).
  function isOnePiece(cd) { return !!(cd && cd.type === "shirt-one-piece"); }
  // family 2 안의 몸판 연동 제도(오픈 칼라 L, P.65). 한 장(G~K)과 게이트·스냅샷을 분리한다.
  function isOpenCollar(cd) { return !!(cd && cd.type === "shirt-open-collar"); }
  // family 3 안의 윙 칼라(Q, P.68): 밴드(수평 꺾임선) + 앞 위 끝 칼라 끝. 위 칼라(본체)가 없다.
  function isWing(cd) { return !!(cd && cd.type === "shirt-wing-collar"); }
  var WING_STAND_OPTIONS = { horizontalTopLine: true };   // type 계약 — collarPresets.WING_STAND_OPTIONS 와 같은 값
  // family 3 안의 밴드+위 칼라 한 장(R, P.68): 밴드 윗선을 경계로 위 칼라가 한 조각으로 이어진다.
  //   2피스(stand+body)와 달리 조각이 하나뿐이라 joined 한 섹션만 갖는다.
  function isBandOnePiece(cd) { return !!(cd && cd.type === "shirt-band-one-piece"); }
  // family 4 플랫 칼라(S, P.69): 몸판 목둘레선에 직접 그려 어깨선에서 맞댄 한 조각. 밴드·위 칼라가 없다.
  function isFlatCollar(cd) { return !!(cd && cd.type === "flat-collar"); }
  // family 4 플랫 칼라 T(P.69 하단): 어깨선을 3.5 겹쳐 한 장으로 제도하고 달림선을 0.5 올려 재작도.
  function isFlatOverlapCollar(cd) { return !!(cd && cd.type === "flat-collar-overlap"); }
  // family 5 세일러 칼라(U, P.70): 어깨를 겹쳐 그린 한 조각(네모난 뒤판 + V 앞). 몸판은 안 바꾼다.
  function isSailorCollar(cd) { return !!(cd && cd.type === "sailor-collar"); }
  // family 6 보 칼라(X·Y·Z, P.71): 목둘레 치수를 수평선에 올린 직사각형 한 장(달림선 + 리본).
  function isBowCollar(cd) { return !!(cd && cd.type === "bow-collar"); }
  // family 7 프릴 칼라(a·b·c): 개더형 또는 절개·전개형 한 조각.
  function isFrillCollar(cd) { return !!(cd && cd.type === "frill-collar"); }
  // family 8 후드(d, P.74 · 제도 방법 P.151): 앞 몸판 FNP 위에 직접 제도한 한 조각(뒤 중심 봉제).
  function isHood(cd) { return !!(cd && cd.type === "hood"); }
  // family 9 테일러드 칼라(h·i, P.78·79 · 제도 방법 P.152–153): 앞 몸판 위에 라펠 → 위 칼라.
  //   라펠·몸판 목둘레선은 bodyLink 파생이고 몸판 geometry 는 바뀌지 않는다.
  function isTailored(cd) { return !!(cd && cd.type === "tailored-collar"); }
  function isStandalone(cd) { return !!(cd && cd.type === "stand-collar"); }

  // ── 검사 ──
  function check(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, fails: ["no-project"] };
    var fails = [];
    var BC = window.bodiceCheckpoint, SC = window.sleeveCheckpoint, DC = window.designCollar;
    if (!BC || !SC || !DC) return { ok: false, fails: ["no-module"] };
    var cd = proj.working.collarDraft;
    var bodice = BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (!cd) fails.push("no-collar");
    if (cd && bodice && cd.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    // 소매: 작업 순서 게이트(스냅샷 source 아님)
    var sleeve = SC.latest(proj);
    if (!sleeve) fails.push("no-sleeve");
    else if (SC.isCurrentSleeveChanged(proj) || SC.invalidatedByBodice(proj)) fails.push("sleeve-stale");
    // ── 한 장 셔츠 칼라(family 2): 스탠드/본체가 아니라 한 조각 geometry 를 검사한다(용어·게이트 분리) ──
    if (isOnePiece(cd)) {
      var op = cd.onePiece;
      if (!(op && op.geometry)) fails.push("no-collar-piece");
      else { var vo = DC.validateClosedOutline(op.geometry.outline); if (!vo.ok) fails.push("collar-" + vo.reason); }
      var opRe = null;
      if (bodice && cd.parameters && cd.parameters.onePiece) {
        opRe = DC.computeOnePiece(bodice, cd.parameters.onePiece);
        if (!opRe.ok) fails.push("collar-recompute");
      } else fails.push("no-collar-params");
      var m = op && op.measure;
      if (!(m && num(m.attachLenCm) && num(m.neckTargetCm) && num(m.outerLenCm) && num(m.foldLenCm))) fails.push("unmeasured");
      // ★ 달림선 실측과 목둘레(뒤목+앞목)의 차이는 **측정·표시만** 한다(교재: 외곽 치수는 가봉으로 조정).
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _onePiece: opRe, _lengths: null, _stand: null };
    }
    // ── 오픈 칼라(family 2, 몸판 연동 L): 달림선 실측 = ×+⊘ 길이 책임 + 몸판 꺾임선 출처를 함께 검사 ──
    if (isOpenCollar(cd)) {
      var oc = cd.openCollar;
      if (!(oc && oc.geometry)) fails.push("no-collar-piece");
      else { var voc = DC.validateClosedOutline(oc.geometry.outline); if (!voc.ok) fails.push("collar-" + voc.reason); }
      var ocRe = null;
      if (bodice && cd.parameters && cd.parameters.openCollar) {
        ocRe = DC.computeOpenCollar(bodice, cd.parameters.openCollar);
        if (!ocRe.ok) fails.push("collar-recompute");
      } else fails.push("no-collar-params");
      var om = oc && oc.measure;
      if (!(om && num(om.attachLenCm) && num(om.neckTargetCm) && num(om.outerLenCm) && num(om.foldLenCm) && num(om.baseLineLenCm))) fails.push("unmeasured");
      // ★ 길이 책임(사용자 확정): 달림선 실측 = ×+⊘. 한 장 G~K 와 달리 차이를 표시만 하지 않고 게이트로 잡는다.
      else if (Math.abs(om.attachLenCm - om.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
      var bl = oc && oc.bodyLink;
      if (!(bl && bl.frontNeckPoint && bl.breakTop && bl.breakEnd && Array.isArray(bl.breakLine) && bl.breakLine.length)) fails.push("break-line-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _openCollar: ocRe, _lengths: null, _stand: null };
    }
    // ── 윙 칼라(family 3, Q): 밴드 달림선 = ×+⊘ + 칼라 끝 세 수치를 실제 형상에서 검증 ──
    if (isWing(cd)) {
      var wg = cd.tip;
      if (!(cd.standGeometry)) fails.push("no-stand");
      else { var vws = DC.validateClosedOutline(cd.standGeometry.outline); if (!vws.ok) fails.push("stand-" + vws.reason); }
      if (!(wg && wg.geometry)) fails.push("no-tip");
      else { var vwt = DC.validateClosedOutline(wg.geometry.outline); if (!vwt.ok) fails.push("tip-" + vwt.reason); }
      var wStand = null, wTip = null;
      if (bodice && cd.parameters && cd.parameters.stand && cd.parameters.tip) {
        wStand = DC.computeStand(bodice, cd.parameters.stand, WING_STAND_OPTIONS);
        if (!wStand.ok) fails.push("stand-recompute");
        else {
          wTip = DC.computeWingTip(wStand, cd.parameters.tip);
          if (!wTip.ok) fails.push("tip-recompute");
        }
      } else fails.push("no-collar-params");
      var wm = cd.measure, tm = wg && wg.measure;
      if (!(wm && num(wm.lowerNeckSeamLenCm) && num(wm.neckTargetCm) && num(wm.upperNeckSegmentLenCm))) fails.push("unmeasured");
      // ★ 밴드 달림선 실측 = 목둘레(×+⊘) — P.148 ⑭ 의 길이 책임
      else if (Math.abs(wm.lowerNeckSeamLenCm - wm.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
      if (!(tm && num(tm.foldBaseLenCm) && num(tm.tipEdgeLenCm) && num(tm.tipSetbackLenCm) && num(tm.tipHeightCm))) fails.push("tip-unmeasured");
      // ★ 칼라 끝 세 수치가 실제 형상에서 파라미터와 일치하는지(7·1.5·4.5)
      else if (Math.abs(tm.foldBaseLenCm - cd.parameters.tip.tipBaseCm) > 0.01
        || Math.abs(tm.tipEdgeLenCm - cd.parameters.tip.tipEdgeCm) > 0.01
        || Math.abs(tm.tipSetbackLenCm - cd.parameters.tip.tipSetbackCm) > 0.01) fails.push("tip-length-mismatch");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _wingStand: wStand, _wingTip: wTip, _lengths: null, _stand: null };
    }
    // ── 세일러 칼라(family 5, U): 겹침 · 뒤 중심 폭·외곽(직각) · 어깨 폭 · V 달림선 ──
    if (isSailorCollar(cd)) {
      var sc = cd.sailor;
      if (!(sc && sc.geometry)) fails.push("no-sailor-collar");
      else { var vsc = DC.validateClosedOutline(sc.geometry.outline); if (!vsc.ok) fails.push("sailor-" + vsc.reason); }
      var scRe = null;
      if (bodice && cd.parameters && cd.parameters.sailor) {
        scRe = DC.computeSailorCollarU(bodice, cd.parameters.sailor);
        if (!scRe.ok) fails.push("sailor-recompute");
      } else fails.push("no-collar-params");
      var sm = sc && sc.measure, sp2 = cd.parameters && cd.parameters.sailor;
      if (!(sm && sp2 && num(sm.attachLenCm) && num(sm.neckTargetCm) && num(sm.cbWidthLenCm) && num(sm.backOuterLenCm)
        && num(sm.shoulderWidthLenCm) && num(sm.backCornerAngleDeg) && num(sm.vNeckLenCm))) fails.push("unmeasured");
      else {
        // ★ 교재 계약: 달림선(재작도)은 V 목둘레보다 짧다 — 부족분은 늘려 박는다(T 와 같은 성격).
        if (!(sm.attachLenCm < sm.neckTargetCm)) fails.push("attach-not-shorter");
        if (Math.abs(sm.cbWidthLenCm - sp2.cbWidthCm) > 0.01) fails.push("collar-width-mismatch");
        if (Math.abs(sm.backOuterLenCm - sp2.backOuterCm) > 0.01) fails.push("back-outer-mismatch");
        if (Math.abs(sm.shoulderWidthLenCm - sp2.shoulderWidthCm) > 0.01) fails.push("shoulder-width-mismatch");
        // ★ 뒤 칼라 외곽은 뒤 중심선에 직각(P.150 2-③)
        if (Math.abs(sm.backCornerAngleDeg - 90) > 0.01) fails.push("back-corner-not-square");
      }
      if (!(sc && sc.geometry && Array.isArray(sc.geometry.construction)
        && sc.geometry.construction.some(function (s2) { return s2.part === "shoulder-mark"; }))) fails.push("shoulder-mark-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _sailor: scRe, _lengths: null, _stand: null };
    }
    // ── 보 칼라(family 6, X·Y·Z): 직사각형 한 장 · 달림선 = ×+⊠ · 리본 길이 · 칼라 폭 ──
    if (isBowCollar(cd)) {
      var bw = cd.bow;
      if (!(bw && bw.geometry)) fails.push("no-bow-collar");
      else { var vbw = DC.validateClosedOutline(bw.geometry.outline); if (!vbw.ok) fails.push("bow-" + vbw.reason); }
      var bwRe = null;
      if (bodice && cd.parameters && cd.parameters.bow) {
        bwRe = DC.computeBowCollar(bodice, cd.parameters.bow);
        if (!bwRe.ok) fails.push("bow-recompute");
      } else fails.push("no-collar-params");
      var bm = bw && bw.measure, bp2 = cd.parameters && cd.parameters.bow;
      if (!(bm && bp2 && num(bm.attachLenCm) && num(bm.neckTargetCm) && num(bm.ribbonLenCm)
        && num(bm.collarWidthLenCm) && num(bm.totalLenCm) && num(bm.frontAttachLenCm)
        && num(bm.bodyFrontNeckLenCm) && num(bp2.attachEndFromCfCm))) fails.push("unmeasured");
      else {
        // ★ 교재 계약: 달림선 실측 = ×+⊠ (목둘레 치수를 수평선에 그대로 올린다 — 늘려 박는 분이 없다)
        if (Math.abs(bm.attachLenCm - bm.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
        // ⊠ = 몸판 앞 목둘레 − 칼라 달림 끝(앞 중심에서 목둘레선 따라)
        if (Math.abs(bm.frontAttachLenCm - (bm.bodyFrontNeckLenCm - bp2.attachEndFromCfCm)) > 0.01) fails.push("attach-end-mismatch");
        if (Math.abs(bm.ribbonLenCm - bp2.ribbonLengthCm) > 0.01) fails.push("ribbon-length-mismatch");
        if (Math.abs(bm.collarWidthLenCm - bp2.collarWidthCm) > 0.01) fails.push("collar-width-mismatch");
        if (Math.abs(bm.totalLenCm - (bm.attachLenCm + bm.ribbonLenCm)) > 0.01) fails.push("total-length-mismatch");
      }
      // 칼라 달림 끝 표시(달림 구간과 리본 구간의 경계)
      if (!(bw && bw.geometry && Array.isArray(bw.geometry.construction)
        && bw.geometry.construction.some(function (s3) { return s3.part === "attach-end-mark"; }))) fails.push("attach-end-mark-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _bow: bwRe, _lengths: null, _stand: null };
    }
    // ── 프릴 칼라(family 7, a·b·c): 준비 길이·완성 달림선·폭·전개량을 분리 검증 ──
    if (isFrillCollar(cd)) {
      var fc = cd.frill;
      if (!(fc && fc.geometry)) fails.push("no-frill-collar");
      else { var vfc = DC.validateClosedOutline(fc.geometry.outline); if (!vfc.ok) fails.push("frill-" + vfc.reason); }
      var fcRe = null;
      if (bodice && cd.parameters && cd.parameters.frill) {
        fcRe = DC.computeFrillCollar(bodice, cd.parameters.frill);
        if (!fcRe.ok) fails.push("frill-recompute");
      } else fails.push("no-collar-params");
      var fm2 = fc && fc.measure, fp2 = cd.parameters && cd.parameters.frill;
      if (!(fm2 && fp2 && num(fm2.neckTargetCm) && num(fm2.cutAttachLenCm) && num(fm2.finishedAttachLenCm)
        && num(fm2.outerLenCm) && num(fm2.cbWidthLenCm) && num(fm2.frontWidthLenCm))) fails.push("unmeasured");
      else {
        if (Math.abs(fm2.finishedAttachLenCm - fm2.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
        if (Math.abs(fm2.cbWidthLenCm - fp2.collarWidthCm) > 0.01
          || Math.abs(fm2.frontWidthLenCm - fp2.collarWidthCm) > 0.01) fails.push("collar-width-mismatch");
        if (fp2.styleCode === 0) {
          if (Math.abs(fm2.cutAttachLenCm - fm2.neckTargetCm * fp2.gatherRatio) > 0.01) fails.push("gather-length-mismatch");
        } else {
          if (Math.abs(fm2.cutAttachLenCm - fm2.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
          if (Math.abs(fm2.spreadTotalCm - fp2.spreadCount * fp2.spreadEachCm) > 0.01) fails.push("spread-mismatch");
          if (!(fc.geometry.construction || []).some(function (s4) { return s4.part === "slash-line"; })) fails.push("slash-lines-missing");
        }
      }
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _frill: fcRe, _lengths: null, _stand: null };
    }
    // ── 후드(family 8, d): 달림선 실측 = 앞목 + 뒤목(교재 "이 제도의 포인트") · 폭·길이 파생 · 뒤 중심선 ──
    if (isHood(cd)) {
      var hd = cd.hood;
      if (!(hd && hd.geometry)) fails.push("no-hood");
      else { var vhd = DC.validateClosedOutline(hd.geometry.outline); if (!vhd.ok) fails.push("hood-" + vhd.reason); }
      var hdRe = null;
      if (bodice && cd.parameters && cd.parameters.hood) {
        hdRe = DC.computeHood(bodice, cd.parameters.hood);
        if (!hdRe.ok) fails.push("hood-recompute");
      } else fails.push("no-collar-params");
      var hm = hd && hd.measure, hp = cd.parameters && cd.parameters.hood;
      if (!(hm && hp && num(hm.attachLenCm) && num(hm.neckTargetCm) && num(hm.frontAttachLenCm)
        && num(hm.backAttachLenCm) && num(hm.hoodWidthCm) && num(hm.hoodLengthCm)
        && num(hm.snpRadiusLenCm) && num(hm.topStraightLenCm))) fails.push("unmeasured");
      else {
        // ★ 길이 책임: 앞·뒤 달림선이 각각 몸판 앞목·뒤목과 같아야 한다(늘려 박는 분 없음)
        if (Math.abs(hm.frontAttachLenCm - hm.bodyFrontNeckLenCm) > 0.01) fails.push("front-attach-mismatch");
        if (Math.abs(hm.backAttachLenCm - hm.backNeckLenCm) > 0.01) fails.push("back-attach-mismatch");
        if (Math.abs(hm.attachLenCm - hm.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
        // 폭·길이는 머리 둘레·후드 치수에서 파생된 값이어야 한다(교재 공식)
        if (Math.abs(hm.hoodWidthCm - (hp.headCircumferenceCm / 2 + hp.widthOffsetCm)) > 0.01) fails.push("hood-width-mismatch");
        if (Math.abs(hm.hoodLengthCm - (hp.hoodMeasureCm + hp.lengthOffsetCm)) > 0.01) fails.push("hood-length-mismatch");
        if (Math.abs(hm.frontEdgeLenCm - hm.hoodLengthCm) > 0.01) fails.push("hood-length-mismatch");
        if (Math.abs(hm.topStraightLenCm - hp.topStraightCm) > 0.01) fails.push("top-straight-mismatch");
        if (Math.abs(hm.snpRadiusLenCm - hp.snpRadiusCm) > 0.01) fails.push("snp-radius-mismatch");
      }
      // 1-❸ 뒤 중심 안내선 · 3-❸ 2등분점 안내선
      if (!(hd && hd.geometry && Array.isArray(hd.geometry.construction)
        && hd.geometry.construction.some(function (s4) { return s4.part === "cb-guide"; })
        && hd.geometry.construction.some(function (s5) { return s5.part === "mid-guide"; }))) fails.push("hood-guide-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _hood: hdRe, _lengths: null, _stand: null };
    }
    // ── 테일러드 칼라(family 9, h·i): 뒤 달림선 = 뒤 목둘레 · 칼라 허리·폭 · 라펠 폭 · 칼라 끝 정삼각형 ──
    if (isTailored(cd)) {
      var tl = cd.tailored;
      if (!(tl && tl.geometry)) fails.push("no-tailored-collar");
      else { var vtl = DC.validateClosedOutline(tl.geometry.outline); if (!vtl.ok) fails.push("tailored-" + vtl.reason); }
      var tlRe = null;
      if (bodice && cd.parameters && cd.parameters.tailored) {
        tlRe = DC.computeTailoredCollar(bodice, cd.parameters.tailored);
        if (!tlRe.ok) fails.push("tailored-recompute");
      } else fails.push("no-collar-params");
      var tm = tl && tl.measure, tp2 = cd.parameters && cd.parameters.tailored;
      if (!(tm && tp2 && num(tm.backAttachLenCm) && num(tm.backNeckLenCm) && num(tm.cbStandLenCm)
        && num(tm.cbWidthLenCm) && num(tm.lapelWidthLenCm) && num(tm.collarTipToLapelCm)
        && num(tm.collarTipToGorgeCm) && num(tm.lapelToGorgeCm) && num(tm.standRemainderCm))) fails.push("unmeasured");
      else {
        // ★ 길이 책임: 1-❺ 안내선이 뒤 목둘레 치수이고 3 은 그 길이를 반지름으로 회전 → 뒤 달림선 = 뒤 목둘레
        if (Math.abs(tm.backAttachLenCm - tm.backNeckLenCm) > 0.01) fails.push("back-attach-mismatch");
        if (Math.abs(tm.cbStandLenCm - tp2.collarStandCm) > 0.01) fails.push("collar-stand-mismatch");
        if (Math.abs(tm.cbWidthLenCm - tp2.collarWidthCm) > 0.01) fails.push("collar-width-mismatch");
        if (Math.abs(tm.lapelWidthLenCm - tp2.lapelWidthCm) > 0.01) fails.push("lapel-width-mismatch");
        // ★ 5-❶ Point: 라펠끝·칼라달림끝·칼라끝이 한 변 = tipRadiusCm 인 정삼각형
        if (Math.abs(tm.collarTipToLapelCm - tp2.tipRadiusCm) > 0.01
          || Math.abs(tm.collarTipToGorgeCm - tp2.tipRadiusCm) > 0.01
          || Math.abs(tm.lapelToGorgeCm - tp2.tipRadiusCm) > 0.01) fails.push("collar-tip-mismatch");
        // 1-❸ 표기 = 칼라 허리 − 어깨선 연장 0.7 (h 도해 2.3)
        if (Math.abs(tm.standRemainderCm - (tp2.collarStandCm - tm.shoulderExtensionCm)) > 0.01) fails.push("stand-remainder-mismatch");
      }
      // 몸판 파생(라펠·꺾임선)은 있어야 한다 — 몸판 geometry 는 바꾸지 않되 출처는 남긴다
      var bl = tl && tl.bodyLink;
      if (!(bl && Array.isArray(bl.breakLine) && bl.breakLine.length
        && Array.isArray(bl.lapelOutline) && bl.lapelOutline.length)) fails.push("lapel-link-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _tailored: tlRe, _lengths: null, _stand: null };
    }
    // ── 플랫 칼라 T(family 4): 겹침 3.5 · 달림선 재작도(몸판 목둘레보다 짧다) · 칼라 폭·앞 끝 ──
    if (isFlatOverlapCollar(cd)) {
      var ft = cd.flat;
      if (!(ft && ft.geometry)) fails.push("no-flat-collar");
      else { var vft = DC.validateClosedOutline(ft.geometry.outline); if (!vft.ok) fails.push("flat-" + vft.reason); }
      var ftRe = null;
      if (bodice && cd.parameters && cd.parameters.flatOverlap) {
        ftRe = DC.computeFlatCollarT(bodice, cd.parameters.flatOverlap);
        if (!ftRe.ok) fails.push("flat-recompute");
      } else fails.push("no-collar-params");
      var tm = ft && ft.measure, tp = cd.parameters && cd.parameters.flatOverlap;
      if (!(tm && tp && num(tm.attachLenCm) && num(tm.neckTargetCm) && num(tm.cbWidthLenCm) && num(tm.shoulderWidthLenCm)
        && num(tm.frontEndLenCm) && num(tm.frontEndOffsetLenCm) && num(tm.shoulderTipGapCm))) fails.push("unmeasured");
      else {
        // ★ 교재 계약: 달림선은 몸판 목둘레(×+⊘)보다 **짧다**(부족분은 늘려 박아 칼라 허리를 만든다).
        if (!(tm.attachLenCm < tm.neckTargetCm)) fails.push("attach-not-shorter");
        if (Math.abs(tm.shoulderTipGapCm - tp.shoulderOverlapCm) > 0.01) fails.push("shoulder-overlap-mismatch");
        if (Math.abs(tm.cbWidthLenCm - tp.collarWidthCm) > 0.01
          || Math.abs(tm.shoulderWidthLenCm - tp.collarWidthCm) > 0.01) fails.push("collar-width-mismatch");
        if (Math.abs(tm.frontEndLenCm - tp.frontEndFromFnpCm) > 0.01) fails.push("front-end-mismatch");
        if (Math.abs(tm.frontEndOffsetLenCm - tp.frontEndOffsetCm) > 0.01) fails.push("front-end-offset-mismatch");
      }
      if (!(ft && ft.geometry && Array.isArray(ft.geometry.construction)
        && ft.geometry.construction.some(function (s2) { return s2.part === "shoulder-mark"; }))) fails.push("shoulder-mark-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _flat: ftRe, _lengths: null, _stand: null };
    }
    // ── 플랫 칼라(family 4, S): 달림선 = 몸판 목둘레선 · 칼라 폭 · 앞 끝 · 어깨 맞댐을 실제 형상에서 검증 ──
    if (isFlatCollar(cd)) {
      var fl = cd.flat;
      if (!(fl && fl.geometry)) fails.push("no-flat-collar");
      else { var vf = DC.validateClosedOutline(fl.geometry.outline); if (!vf.ok) fails.push("flat-" + vf.reason); }
      var flRe = null;
      if (bodice && cd.parameters && cd.parameters.flat) {
        flRe = DC.computeFlatCollarS(bodice, cd.parameters.flat);
        if (!flRe.ok) fails.push("flat-recompute");
      } else fails.push("no-collar-params");
      var fm = fl && fl.measure;
      if (!(fm && num(fm.attachLenCm) && num(fm.neckTargetCm) && num(fm.cbWidthLenCm)
        && num(fm.shoulderWidthLenCm) && num(fm.frontEndLenCm) && num(fm.frontEndOffsetLenCm))) fails.push("unmeasured");
      else {
        // ★ 달림선 = 몸판 목둘레선 그대로이므로 실측이 ×+⊘ 와 같아야 한다(길이 책임).
        if (Math.abs(fm.attachLenCm - fm.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
        // ★ 칼라 폭은 뒤 중심·어깨 둘 다 같은 값이어야 어깨선에서 맞댈 수 있다.
        if (Math.abs(fm.cbWidthLenCm - cd.parameters.flat.collarWidthCm) > 0.01
          || Math.abs(fm.shoulderWidthLenCm - cd.parameters.flat.collarWidthCm) > 0.01) fails.push("collar-width-mismatch");
        if (Math.abs(fm.frontEndLenCm - cd.parameters.flat.frontEndFromFnpCm) > 0.01) fails.push("front-end-mismatch");
        if (Math.abs(fm.frontEndOffsetLenCm - cd.parameters.flat.frontEndOffsetCm) > 0.01) fails.push("front-end-offset-mismatch");
      }
      if (!(fl && fl.geometry && Array.isArray(fl.geometry.construction)
        && fl.geometry.construction.some(function (s2) { return s2.part === "shoulder-butt"; }))) fails.push("shoulder-butt-missing");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _flat: flRe, _lengths: null, _stand: null };
    }
    // ── 밴드+위 칼라 한 장(family 3, R): 한 조각의 달림선·외곽·CB 를 실제 형상에서 검증 ──
    if (isBandOnePiece(cd)) {
      var jn = cd.joined;
      if (!(jn && jn.geometry)) fails.push("no-joined");
      else { var vj = DC.validateClosedOutline(jn.geometry.outline); if (!vj.ok) fails.push("joined-" + vj.reason); }
      var jRe = null;
      if (bodice && cd.parameters && cd.parameters.stand && cd.parameters.upper) {
        jRe = DC.computeBandOnePiece(bodice, cd.parameters.stand, cd.parameters.upper);
        if (!jRe.ok) fails.push("joined-recompute");
      } else fails.push("no-collar-params");
      var jm = jn && jn.measure;
      if (!(jm && num(jm.lowerNeckSeamLenCm) && num(jm.neckTargetCm) && num(jm.outerBackLenCm)
        && num(jm.backNeckLenCm) && num(jm.frontEdgeLenCm) && num(jm.cbHeightCm))) fails.push("unmeasured");
      else {
        // ★ 밴드 달림선 실측 = 목둘레(×+⊘) — P.148 ⑭ 의 길이 책임(M~Q 와 동일)
        if (Math.abs(jm.lowerNeckSeamLenCm - jm.neckTargetCm) > 0.01) fails.push("attach-length-mismatch");
        // ★ 외곽 뒤 구간 = 뒤 목둘레 ×(도면 표기), 앞 칼라 폭·CB 전체 높이도 실제 형상에서 일치해야 한다
        if (Math.abs(jm.outerBackLenCm - jm.backNeckLenCm) > 0.01) fails.push("outer-back-mismatch");
        if (Math.abs(jm.frontEdgeLenCm - cd.parameters.upper.frontWidthCm) > 0.01) fails.push("front-width-mismatch");
        if (Math.abs(jm.cbHeightCm - (cd.parameters.stand.bandWidthCm + cd.parameters.upper.upperWidthCm)) > 0.01) fails.push("cb-height-mismatch");
      }
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _joined: jRe, _lengths: null, _stand: null };
    }
    // ── 단독 스탠드 칼라 A~F(family 1): 밴드+본체 게이트와 분리한다. ──
    if (isStandalone(cd)) {
      var sa = cd.standalone;
      if (!(sa && sa.geometry)) fails.push("no-standalone");
      else { var sva = DC.validateClosedOutline(sa.geometry.outline); if (!sva.ok) fails.push("standalone-" + sva.reason); }
      var saRe = null;
      if (bodice && cd.parameters && cd.parameters.standalone) {
        saRe = DC.computeStandaloneStand(bodice, cd.parameters.standalone, cd.construction || {});
        if (!saRe.ok) fails.push("standalone-recompute");
      } else fails.push("no-collar-params");
      var sam = sa && sa.measure;
      if (!(sam && num(sam.attachLenCm) && num(sam.neckTargetCm) && num(sam.outerLenCm))) fails.push("unmeasured");
      return { ok: fails.length === 0, fails: fails, _bodice: bodice, _standalone: saRe, _lengths: null, _stand: null };
    }
    // 스탠드·본체 geometry: 폐곡선·자기교차
    if (!(cd && cd.standGeometry)) fails.push("no-stand");
    else { var vs = DC.validateClosedOutline(cd.standGeometry.outline); if (!vs.ok) fails.push("stand-" + vs.reason); }
    if (!(cd && cd.body && cd.body.geometry)) fails.push("no-body");
    else { var vb = DC.validateClosedOutline(cd.body.geometry.outline); if (!vb.ok) fails.push("body-" + vb.reason); }
    // manual → 관리선 존재·invalid 아님
    if (cd && cd.body && cd.body.mode === "manual") {
      var line = (proj.working.patternLines || []).find(function (l) { return l.id === cd.body.lineId; });
      if (!line) fails.push("manual-line-missing");
      if (cd.body.invalid) fails.push("body-invalid");
    }
    // 위칼라 이음선(독립 곡선) 길이 = 밴드 윗선 ⒸⒹ 전체(bandAttachLen, 앞 끝선 연장 미포함 — P.148 step 3),
    //   gap(CB 제도 간격)은 양수로 기록돼 있어야 한다. 길이 차이는 위칼라 CB 수평 보정으로 이미 0 이어야 한다.
    var lengths = null, standRe = null;
    if (cd && bodice && cd.parameters && cd.parameters.stand) {
      standRe = DC.computeStand(bodice, cd.parameters.stand, cd.construction);   // 교재 O = D 방식 기초선 옵션
      if (!standRe.ok) fails.push("stand-recompute");
      else {
        lengths = { lowerNeckSeam: standRe.lowerNeckSeamLenCm, lowerExtension: standRe.lowerExtensionLenCm, upperNeckSegment: standRe.upperNeckSegmentLenCm, upperExtension: standRe.upperExtensionLenCm, upperTotal: standRe.upperTotalLenCm };
        var bp = (cd.body && cd.body.parameters) || {};
        var gapCm = bp.gapCm;
        var seamLen = (cd.body) ? cd.body.attachLenCm : NaN;
        var bandAttachLen = standRe.upperNeckSegmentLenCm;   // P.148 step 3: 위칼라 이음선 = 밴드 윗선 ⒸⒹ
        if (!num(standRe.upperNeckSegmentLenCm) || !num(seamLen)) fails.push("unmeasured");
        else if (!num(gapCm) || gapCm <= 0) fails.push("gap-missing");
        else if (Math.abs(seamLen - bandAttachLen) > 0.01) fails.push("seam-length-mismatch");
        else if (bandAttachLen > standRe.upperTotalLenCm - 1e-6 && standRe.upperExtensionLenCm > 0) fails.push("extension-included");   // 연장이 밴드 기준 길이에 포함되면 안 됨
      }
    }
    return { ok: fails.length === 0, fails: fails, _bodice: bodice, _lengths: lengths, _stand: standRe };
  }

  // 형상 전용 signature(hash): completedAt·layout·선택·snap·UI·다른 patternLines 제외.
  function signatureOf(res) {
    if (res.type === "shirt-one-piece") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        op: res.onePiece.parameters, og: canonGeom(res.onePiece.geometry), oc: canonSegs((res.onePiece.geometry || {}).construction), om: res.onePiece.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "shirt-open-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        oc: res.openCollar.parameters, og: canonGeom(res.openCollar.geometry), occ: canonSegs((res.openCollar.geometry || {}).construction),
        om: res.openCollar.measures, bl: canonSegs((res.openCollar.bodyLink || {}).breakLine),   // 몸판 연동 꺾임선도 형상 identity 에 포함
        sym: res.symmetry
      });
    }
    if (res.type === "shirt-wing-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        sp: res.stand.parameters, sg: canonGeom(res.stand.geometry), sl: res.stand.lengths,
        tp: res.tip.parameters, tg: canonGeom(res.tip.geometry), tm: res.tip.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "sailor-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        up: res.sailor.parameters, ug: canonGeom(res.sailor.geometry), uc: canonSegs((res.sailor.geometry || {}).construction),
        um: res.sailor.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "bow-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        wp: res.bow.parameters, wg: canonGeom(res.bow.geometry), wc: canonSegs((res.bow.geometry || {}).construction),
        wm: res.bow.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "frill-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        rp: res.frill.parameters, rg: canonGeom(res.frill.geometry), rc: canonSegs((res.frill.geometry || {}).construction),
        rm: res.frill.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "hood") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        hp: res.hood.parameters, hg: canonGeom(res.hood.geometry), hc: canonSegs((res.hood.geometry || {}).construction),
        hm: res.hood.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "tailored-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        tp: res.tailored.parameters, tg: canonGeom(res.tailored.geometry), tc: canonSegs((res.tailored.geometry || {}).construction),
        tm: res.tailored.measures,
        bk: canonSegs((res.tailored.bodyLink || {}).breakLine), lp: canonSegs((res.tailored.bodyLink || {}).lapelOutline),
        sym: res.symmetry
      });
    }
    if (res.type === "flat-collar-overlap") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        tp: res.flat.parameters, tg: canonGeom(res.flat.geometry), tc: canonSegs((res.flat.geometry || {}).construction),
        tm: res.flat.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "flat-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        fp: res.flat.parameters, fg: canonGeom(res.flat.geometry), fc: canonSegs((res.flat.geometry || {}).construction),
        fm: res.flat.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "shirt-band-one-piece") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        jp: res.joined.parameters, jg: canonGeom(res.joined.geometry), jc: canonSegs((res.joined.geometry || {}).construction),
        jm: res.joined.measures,
        sym: res.symmetry
      });
    }
    if (res.type === "stand-collar") {
      return JSON.stringify({
        sbh: res.sourceBodiceHash, nk: res.necklineLengths,
        sa: res.standalone.parameters, sc: res.standalone.construction, sg: canonGeom(res.standalone.geometry), sm: res.standalone.measures,
        sym: res.symmetry
      });
    }
    // ★ construction 은 **있을 때만** 서명에 넣는다(undefined 는 JSON 에서 키가 사라짐) —
    //   옵션 없는 M·N·P 의 서명 문자열·hash 를 그대로 보존하기 위한 계약이다.
    return JSON.stringify({
      sbh: res.sourceBodiceHash, nk: res.necklineLengths,
      sp: res.stand.parameters, sc: res.stand.construction || undefined, sg: canonGeom(res.stand.geometry), sl: res.stand.lengths,
      bm: res.body.mode, bp: res.body.parameters, bg: canonGeom(res.body.geometry), ba: round4(res.body.attachLenCm), bx: res.body.measures,
      ms: res.body.manualSource ? canonSegs(res.body.manualSource.segments) : null,
      sym: res.symmetry
    });
  }

  // ── 완료 ── 게이트 통과 시 working.collarResult 불변 스냅샷. 실패 시 변경 없음. 같은 형상 재완료는 idempotent.
  function complete(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, reason: "no-project" };
    var c = check(proj);
    if (!c.ok) return { ok: false, reason: c.fails[0], check: c };
    var cd = proj.working.collarDraft, sb = proj.sourceBlock || {}, bodice = c._bodice;
    if (isOnePiece(cd)) {
      var oneRes = {
        schemaVersion: 1, type: "shirt-one-piece",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        onePiece: { parameters: clone(cd.parameters.onePiece), geometry: clone(cd.onePiece.geometry), measures: clone(cd.onePiece.measure || {}) },
        symmetry: "half-cb-fold"
      };
      oneRes.hash = hashStr(signatureOf(oneRes));
      var prev = proj.working.collarResult;
      if (prev && prev.hash === oneRes.hash) return { ok: true, result: prev, idempotent: true, check: c };
      oneRes.completedAt = Date.now();
      deepFreeze(oneRes);
      proj.working.collarResult = oneRes;
      return { ok: true, result: oneRes, check: c };
    }
    if (isOpenCollar(cd)) {
      var openRes = {
        schemaVersion: 1, type: "shirt-open-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        openCollar: { parameters: clone(cd.parameters.openCollar), geometry: clone(cd.openCollar.geometry),
          measures: clone(cd.openCollar.measure || {}), bodyLink: clone(cd.openCollar.bodyLink || {}) },
        symmetry: "half-cb-fold"
      };
      openRes.hash = hashStr(signatureOf(openRes));
      var prevOpen = proj.working.collarResult;
      if (prevOpen && prevOpen.hash === openRes.hash) return { ok: true, result: prevOpen, idempotent: true, check: c };
      openRes.completedAt = Date.now(); deepFreeze(openRes);
      proj.working.collarResult = openRes;
      return { ok: true, result: openRes, check: c };
    }
    if (isWing(cd)) {
      var wingRes = {
        schemaVersion: 1, type: "shirt-wing-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        stand: { parameters: clone(cd.parameters.stand), geometry: clone(cd.standGeometry),
          lengths: { lowerNeckSeam: round4(cd.measure.lowerNeckSeamLenCm), lowerExtension: round4(cd.measure.lowerExtensionLenCm),
            foldLine: round4(cd.measure.upperNeckSegmentLenCm), upperExtension: round4(cd.measure.upperExtensionLenCm) } },
        tip: { parameters: clone(cd.parameters.tip), geometry: clone(cd.tip.geometry), measures: clone(cd.tip.measure || {}) },
        symmetry: "half-cb-fold"
      };
      wingRes.hash = hashStr(signatureOf(wingRes));
      var prevWing = proj.working.collarResult;
      if (prevWing && prevWing.hash === wingRes.hash) return { ok: true, result: prevWing, idempotent: true, check: c };
      wingRes.completedAt = Date.now(); deepFreeze(wingRes);
      proj.working.collarResult = wingRes;
      return { ok: true, result: wingRes, check: c };
    }
    if (isSailorCollar(cd)) {
      var sailorRes = {
        schemaVersion: 1, type: "sailor-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        sailor: { parameters: clone(cd.parameters.sailor), geometry: clone(cd.sailor.geometry), measures: clone(cd.sailor.measure || {}) },
        symmetry: "half-cb-fold"
      };
      sailorRes.hash = hashStr(signatureOf(sailorRes));
      var prevSailor = proj.working.collarResult;
      if (prevSailor && prevSailor.hash === sailorRes.hash) return { ok: true, result: prevSailor, idempotent: true, check: c };
      sailorRes.completedAt = Date.now(); deepFreeze(sailorRes);
      proj.working.collarResult = sailorRes;
      return { ok: true, result: sailorRes, check: c };
    }
    if (isBowCollar(cd)) {
      var bowRes = {
        schemaVersion: 1, type: "bow-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        bow: { parameters: clone(cd.parameters.bow), geometry: clone(cd.bow.geometry), measures: clone(cd.bow.measure || {}) },
        symmetry: "half-cb-fold"
      };
      bowRes.hash = hashStr(signatureOf(bowRes));
      var prevBow = proj.working.collarResult;
      if (prevBow && prevBow.hash === bowRes.hash) return { ok: true, result: prevBow, idempotent: true, check: c };
      bowRes.completedAt = Date.now(); deepFreeze(bowRes);
      proj.working.collarResult = bowRes;
      return { ok: true, result: bowRes, check: c };
    }
    if (isFrillCollar(cd)) {
      var frillRes = {
        schemaVersion: 1, type: "frill-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        frill: { parameters: clone(cd.parameters.frill), geometry: clone(cd.frill.geometry), measures: clone(cd.frill.measure || {}) },
        symmetry: "half-cb-fold"
      };
      frillRes.hash = hashStr(signatureOf(frillRes));
      var prevFrill = proj.working.collarResult;
      if (prevFrill && prevFrill.hash === frillRes.hash) return { ok: true, result: prevFrill, idempotent: true, check: c };
      frillRes.completedAt = Date.now(); deepFreeze(frillRes);
      proj.working.collarResult = frillRes;
      return { ok: true, result: frillRes, check: c };
    }
    if (isHood(cd)) {
      var hoodRes = {
        schemaVersion: 1, type: "hood",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        hood: { parameters: clone(cd.parameters.hood), geometry: clone(cd.hood.geometry), measures: clone(cd.hood.measure || {}) },
        symmetry: "half-cb-seam"   // ★ 후드는 접어 재단이 아니라 **뒤 중심 봉제**(중심에서 이어준다)
      };
      hoodRes.hash = hashStr(signatureOf(hoodRes));
      var prevHood = proj.working.collarResult;
      if (prevHood && prevHood.hash === hoodRes.hash) return { ok: true, result: prevHood, idempotent: true, check: c };
      hoodRes.completedAt = Date.now(); deepFreeze(hoodRes);
      proj.working.collarResult = hoodRes;
      return { ok: true, result: hoodRes, check: c };
    }
    if (isTailored(cd)) {
      var tailoredRes = {
        schemaVersion: 1, type: "tailored-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        // bodyLink = 라펠·꺾임선의 **몸판 프레임 파생 출처**. 몸판 geometry 는 변경하지 않는다.
        tailored: { parameters: clone(cd.parameters.tailored), geometry: clone(cd.tailored.geometry),
          measures: clone(cd.tailored.measure || {}), bodyLink: clone(cd.tailored.bodyLink || {}) },
        symmetry: "half-cb-seam"   // 위 칼라는 뒤 중심 봉제(접어 재단 아님)
      };
      tailoredRes.hash = hashStr(signatureOf(tailoredRes));
      var prevTl = proj.working.collarResult;
      if (prevTl && prevTl.hash === tailoredRes.hash) return { ok: true, result: prevTl, idempotent: true, check: c };
      tailoredRes.completedAt = Date.now(); deepFreeze(tailoredRes);
      proj.working.collarResult = tailoredRes;
      return { ok: true, result: tailoredRes, check: c };
    }
    if (isFlatOverlapCollar(cd)) {
      var flatTRes = {
        schemaVersion: 1, type: "flat-collar-overlap",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        flat: { parameters: clone(cd.parameters.flatOverlap), geometry: clone(cd.flat.geometry), measures: clone(cd.flat.measure || {}) },
        symmetry: "half-cb-fold"
      };
      flatTRes.hash = hashStr(signatureOf(flatTRes));
      var prevFlatT = proj.working.collarResult;
      if (prevFlatT && prevFlatT.hash === flatTRes.hash) return { ok: true, result: prevFlatT, idempotent: true, check: c };
      flatTRes.completedAt = Date.now(); deepFreeze(flatTRes);
      proj.working.collarResult = flatTRes;
      return { ok: true, result: flatTRes, check: c };
    }
    if (isFlatCollar(cd)) {
      var flatRes = {
        schemaVersion: 1, type: "flat-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        flat: { parameters: clone(cd.parameters.flat), geometry: clone(cd.flat.geometry), measures: clone(cd.flat.measure || {}) },
        symmetry: "half-cb-fold"
      };
      flatRes.hash = hashStr(signatureOf(flatRes));
      var prevFlat = proj.working.collarResult;
      if (prevFlat && prevFlat.hash === flatRes.hash) return { ok: true, result: prevFlat, idempotent: true, check: c };
      flatRes.completedAt = Date.now(); deepFreeze(flatRes);
      proj.working.collarResult = flatRes;
      return { ok: true, result: flatRes, check: c };
    }
    if (isBandOnePiece(cd)) {
      var joinedRes = {
        schemaVersion: 1, type: "shirt-band-one-piece",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,   // 출처 메타 — signatureOf 미포함
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        joined: { parameters: { stand: clone(cd.parameters.stand), upper: clone(cd.parameters.upper) },
          geometry: clone(cd.joined.geometry), measures: clone(cd.joined.measure || {}) },
        symmetry: "half-cb-fold"
      };
      joinedRes.hash = hashStr(signatureOf(joinedRes));
      var prevJoined = proj.working.collarResult;
      if (prevJoined && prevJoined.hash === joinedRes.hash) return { ok: true, result: prevJoined, idempotent: true, check: c };
      joinedRes.completedAt = Date.now(); deepFreeze(joinedRes);
      proj.working.collarResult = joinedRes;
      return { ok: true, result: joinedRes, check: c };
    }
    if (isStandalone(cd)) {
      var standAloneRes = {
        schemaVersion: 1, type: "stand-collar",
        baseMethod: cd.baseMethod || null, presetId: cd.presetId || null,
        sourceBodiceHash: cd.sourceBodiceHash,
        sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
        necklineLengths: clone(bodice.necklineLengths),
        standalone: { parameters: clone(cd.parameters.standalone), construction: clone(cd.construction || {}), geometry: clone(cd.standalone.geometry), measures: clone(cd.standalone.measure || {}) },
        symmetry: "half-cb-fold"
      };
      standAloneRes.hash = hashStr(signatureOf(standAloneRes));
      var oldStandalone = proj.working.collarResult;
      if (oldStandalone && oldStandalone.hash === standAloneRes.hash) return { ok: true, result: oldStandalone, idempotent: true, check: c };
      standAloneRes.completedAt = Date.now(); deepFreeze(standAloneRes);
      proj.working.collarResult = standAloneRes;
      return { ok: true, result: standAloneRes, check: c };
    }
    var manualSource = null;
    if (cd.body.mode === "manual") {
      var line = (proj.working.patternLines || []).find(function (l) { return l.id === cd.body.lineId; });
      if (line) manualSource = { lineId: line.id, segments: clone(line.segments) };   // 관리형 collar-body 선 하나만
    }
    var result = {
      schemaVersion: 1, type: "shirt-two-piece",
      baseMethod: cd.baseMethod || null,   // 정본 제도법 출처(메타) — signatureOf 에 미포함(hash 제외).
      presetId: cd.presetId || null,       // 출처 프리셋 identity(collarPresets, 메타) — signatureOf 미포함(hash 제외). legacy draft 는 null.
      sourceBodiceHash: cd.sourceBodiceHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      necklineLengths: clone(bodice.necklineLengths),
      stand: { parameters: clone(cd.parameters.stand), construction: cd.construction ? clone(cd.construction) : null, geometry: clone(cd.standGeometry), lengths: { lowerNeckSeam: round4(c._lengths.lowerNeckSeam), lowerExtension: round4(c._lengths.lowerExtension), upperNeckSegment: round4(c._lengths.upperNeckSegment), upperExtension: round4(c._lengths.upperExtension), upperTotal: round4(c._lengths.upperTotal) } },
      body: { mode: cd.body.mode === "manual" ? "manual" : "parametric", parameters: clone(cd.body.parameters), geometry: clone(cd.body.geometry), attachLenCm: round4(cd.body.attachLenCm), measures: clone(cd.body.measure || {}), manualSource: manualSource },
      symmetry: "half-cb-fold"
    };
    result.hash = hashStr(signatureOf(result));
    var existing = proj.working.collarResult;
    if (existing && existing.hash === result.hash) return { ok: true, result: existing, idempotent: true, check: c };   // 같은 형상 → 기존 참조·completedAt 유지
    result.completedAt = Date.now();
    deepFreeze(result);
    proj.working.collarResult = result;
    return { ok: true, result: result, check: c };
  }

  function latest(proj) { proj = proj || project(); return (proj && proj.working.collarResult) || null; }
  // 완료본 없음/카라 형상 깨짐 → true. **형상 signature 만 비교(소매 순서 게이트와 무관)** —
  //   소매 stale 은 카라 형상을 바꾸지 않으므로 여기서 "변경"으로 보지 않는다(sleeveStepChanged 가 따로 표시).
  function isCurrentCollarChanged(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.collarResult; if (!res) return true;
    var cd = proj.working.collarDraft;
    var BC = window.bodiceCheckpoint, DC = window.designCollar, bodice = BC && BC.latest(proj);
    if (!cd || !bodice || !DC) return true;
    if (isOnePiece(cd)) {
      if (!cd.onePiece || !cd.onePiece.geometry || !cd.parameters || !cd.parameters.onePiece) return true;
      if (res.type !== "shirt-one-piece") return true;                                  // 종류가 바뀌면 다른 형상
      var re = DC.computeOnePiece(bodice, cd.parameters.onePiece); if (!re.ok) return true;
      var curOne = { type: "shirt-one-piece", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        onePiece: { parameters: cd.parameters.onePiece, geometry: cd.onePiece.geometry, measures: cd.onePiece.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curOne)) !== res.hash;
    }
    if (isOpenCollar(cd)) {
      if (!cd.openCollar || !cd.openCollar.geometry || !cd.parameters || !cd.parameters.openCollar) return true;
      if (res.type !== "shirt-open-collar") return true;
      var openRe = DC.computeOpenCollar(bodice, cd.parameters.openCollar); if (!openRe.ok) return true;
      var curOpen = { type: "shirt-open-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        openCollar: { parameters: cd.parameters.openCollar, geometry: cd.openCollar.geometry, measures: cd.openCollar.measure || {}, bodyLink: cd.openCollar.bodyLink || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curOpen)) !== res.hash;
    }
    if (isWing(cd)) {
      if (!cd.standGeometry || !cd.tip || !cd.tip.geometry || !cd.parameters || !cd.parameters.stand || !cd.parameters.tip) return true;
      if (res.type !== "shirt-wing-collar") return true;
      var wRe = DC.computeStand(bodice, cd.parameters.stand, WING_STAND_OPTIONS); if (!wRe.ok) return true;
      var wTipRe = DC.computeWingTip(wRe, cd.parameters.tip); if (!wTipRe.ok) return true;
      var curWing = { type: "shirt-wing-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        stand: { parameters: cd.parameters.stand, geometry: cd.standGeometry,
          lengths: { lowerNeckSeam: round4(cd.measure.lowerNeckSeamLenCm), lowerExtension: round4(cd.measure.lowerExtensionLenCm),
            foldLine: round4(cd.measure.upperNeckSegmentLenCm), upperExtension: round4(cd.measure.upperExtensionLenCm) } },
        tip: { parameters: cd.parameters.tip, geometry: cd.tip.geometry, measures: cd.tip.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curWing)) !== res.hash;
    }
    if (isSailorCollar(cd)) {
      if (!cd.sailor || !cd.sailor.geometry || !cd.parameters || !cd.parameters.sailor) return true;
      if (res.type !== "sailor-collar") return true;
      var sailorRecalc = DC.computeSailorCollarU(bodice, cd.parameters.sailor); if (!sailorRecalc.ok) return true;
      var curSailor = { type: "sailor-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        sailor: { parameters: cd.parameters.sailor, geometry: cd.sailor.geometry, measures: cd.sailor.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curSailor)) !== res.hash;
    }
    if (isBowCollar(cd)) {
      if (!cd.bow || !cd.bow.geometry || !cd.parameters || !cd.parameters.bow) return true;
      if (res.type !== "bow-collar") return true;
      var bowRecalc = DC.computeBowCollar(bodice, cd.parameters.bow); if (!bowRecalc.ok) return true;
      var curBow = { type: "bow-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        bow: { parameters: cd.parameters.bow, geometry: cd.bow.geometry, measures: cd.bow.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curBow)) !== res.hash;
    }
    if (isFrillCollar(cd)) {
      if (!cd.frill || !cd.frill.geometry || !cd.parameters || !cd.parameters.frill) return true;
      if (res.type !== "frill-collar") return true;
      var frillRecalc = DC.computeFrillCollar(bodice, cd.parameters.frill); if (!frillRecalc.ok) return true;
      var curFrill = { type: "frill-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        frill: { parameters: cd.parameters.frill, geometry: cd.frill.geometry, measures: cd.frill.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curFrill)) !== res.hash;
    }
    if (isHood(cd)) {
      if (!cd.hood || !cd.hood.geometry || !cd.parameters || !cd.parameters.hood) return true;
      if (res.type !== "hood") return true;
      var hoodRecalc = DC.computeHood(bodice, cd.parameters.hood); if (!hoodRecalc.ok) return true;
      var curHood = { type: "hood", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        hood: { parameters: cd.parameters.hood, geometry: cd.hood.geometry, measures: cd.hood.measure || {} },
        symmetry: "half-cb-seam" };
      return hashStr(signatureOf(curHood)) !== res.hash;
    }
    if (isTailored(cd)) {
      if (!cd.tailored || !cd.tailored.geometry || !cd.parameters || !cd.parameters.tailored) return true;
      if (res.type !== "tailored-collar") return true;
      var tlRecalc = DC.computeTailoredCollar(bodice, cd.parameters.tailored); if (!tlRecalc.ok) return true;
      var curTl = { type: "tailored-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        tailored: { parameters: cd.parameters.tailored, geometry: cd.tailored.geometry,
          measures: cd.tailored.measure || {}, bodyLink: cd.tailored.bodyLink || {} },
        symmetry: "half-cb-seam" };
      return hashStr(signatureOf(curTl)) !== res.hash;
    }
    if (isFlatOverlapCollar(cd)) {
      if (!cd.flat || !cd.flat.geometry || !cd.parameters || !cd.parameters.flatOverlap) return true;
      if (res.type !== "flat-collar-overlap") return true;
      var flatTRecalc = DC.computeFlatCollarT(bodice, cd.parameters.flatOverlap); if (!flatTRecalc.ok) return true;
      var curFlatT = { type: "flat-collar-overlap", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        flat: { parameters: cd.parameters.flatOverlap, geometry: cd.flat.geometry, measures: cd.flat.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curFlatT)) !== res.hash;
    }
    if (isFlatCollar(cd)) {
      if (!cd.flat || !cd.flat.geometry || !cd.parameters || !cd.parameters.flat) return true;
      if (res.type !== "flat-collar") return true;
      var flatRecalc = DC.computeFlatCollarS(bodice, cd.parameters.flat); if (!flatRecalc.ok) return true;
      var curFlat = { type: "flat-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        flat: { parameters: cd.parameters.flat, geometry: cd.flat.geometry, measures: cd.flat.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curFlat)) !== res.hash;
    }
    if (isBandOnePiece(cd)) {
      if (!cd.joined || !cd.joined.geometry || !cd.parameters || !cd.parameters.stand || !cd.parameters.upper) return true;
      if (res.type !== "shirt-band-one-piece") return true;
      var jRecalc = DC.computeBandOnePiece(bodice, cd.parameters.stand, cd.parameters.upper); if (!jRecalc.ok) return true;
      var curJoined = { type: "shirt-band-one-piece", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        joined: { parameters: { stand: cd.parameters.stand, upper: cd.parameters.upper },
          geometry: cd.joined.geometry, measures: cd.joined.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curJoined)) !== res.hash;
    }
    if (isStandalone(cd)) {
      if (!cd.standalone || !cd.standalone.geometry || !cd.parameters || !cd.parameters.standalone) return true;
      if (res.type !== "stand-collar") return true;
      var standaloneRe = DC.computeStandaloneStand(bodice, cd.parameters.standalone, cd.construction || {}); if (!standaloneRe.ok) return true;
      var curStandalone = { type: "stand-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        standalone: { parameters: cd.parameters.standalone, construction: cd.construction || {}, geometry: cd.standalone.geometry, measures: cd.standalone.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curStandalone)) !== res.hash;
    }
    if (res.type === "shirt-one-piece" || res.type === "shirt-open-collar" || res.type === "shirt-wing-collar" || res.type === "shirt-band-one-piece" || res.type === "flat-collar" || res.type === "flat-collar-overlap" || res.type === "sailor-collar" || res.type === "bow-collar" || res.type === "frill-collar" || res.type === "hood" || res.type === "tailored-collar" || res.type === "stand-collar") return true;   // 2피스 draft vs 다른 종류 완료본
    if (!cd.standGeometry || !cd.body || !cd.body.geometry) return true;               // 카라 형상 없음/숨김
    if (cd.body.mode === "manual" && cd.body.invalid) return true;                     // 무효 편집
    if (!cd.parameters || !cd.parameters.stand) return true;
    var standRe = DC.computeStand(bodice, cd.parameters.stand, cd.construction); if (!standRe.ok) return true;
    var cur = {
      sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
      stand: { parameters: cd.parameters.stand, construction: cd.construction || null, geometry: cd.standGeometry, lengths: { lowerNeckSeam: round4(standRe.lowerNeckSeamLenCm), lowerExtension: round4(standRe.lowerExtensionLenCm), upperNeckSegment: round4(standRe.upperNeckSegmentLenCm), upperExtension: round4(standRe.upperExtensionLenCm), upperTotal: round4(standRe.upperTotalLenCm) } },
      body: { mode: cd.body.mode === "manual" ? "manual" : "parametric", parameters: cd.body.parameters, geometry: cd.body.geometry, attachLenCm: round4(cd.body.attachLenCm), measures: cd.body.measure || {}, manualSource: cd.body.mode === "manual" ? { segments: ((proj.working.patternLines || []).find(function (l) { return l.id === cd.body.lineId; }) || {}).segments } : null },
      symmetry: "half-cb-fold"
    };
    return hashStr(signatureOf(cur)) !== res.hash;
  }
  // 몸판 hash 변경 → 카라 무효(형상 source 종속).
  function invalidatedByBodice(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.collarResult; if (!res) return false;
    var BC = window.bodiceCheckpoint, bodice = BC && BC.latest(proj);
    if (!bodice) return true;
    return res.sourceBodiceHash !== bodice.hash;
  }
  // 소매 변경(작업 순서 상태 표시용, 카라 무효화 아님).
  function sleeveStepChanged(proj) {
    proj = proj || project(); if (!proj) return false;
    if (!proj.working.collarResult) return false;
    var SC = window.sleeveCheckpoint; if (!SC) return false;
    return !SC.latest(proj) || SC.isCurrentSleeveChanged(proj) || SC.invalidatedByBodice(proj);
  }

  window.collarCheckpoint = Object.freeze({ check: check, complete: complete, latest: latest, isCurrentCollarChanged: isCurrentCollarChanged, invalidatedByBodice: invalidatedByBodice, sleeveStepChanged: sleeveStepChanged });
})();
