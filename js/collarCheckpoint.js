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
    if (isStandalone(cd)) {
      if (!cd.standalone || !cd.standalone.geometry || !cd.parameters || !cd.parameters.standalone) return true;
      if (res.type !== "stand-collar") return true;
      var standaloneRe = DC.computeStandaloneStand(bodice, cd.parameters.standalone, cd.construction || {}); if (!standaloneRe.ok) return true;
      var curStandalone = { type: "stand-collar", sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
        standalone: { parameters: cd.parameters.standalone, construction: cd.construction || {}, geometry: cd.standalone.geometry, measures: cd.standalone.measure || {} },
        symmetry: "half-cb-fold" };
      return hashStr(signatureOf(curStandalone)) !== res.hash;
    }
    if (res.type === "shirt-one-piece" || res.type === "shirt-open-collar" || res.type === "shirt-wing-collar" || res.type === "stand-collar") return true;   // 2피스 draft vs 다른 종류 완료본
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
