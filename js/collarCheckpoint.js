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
//   body manual 이면 관리선 존재·invalid===false / 부착선=스탠드 윗선 subpath(attachLen=upperNeckSeg−frontInset,
//   여밈 연장 미포함) / 실측·파라미터 유한. 실패 시 기존 collarResult·현재 geometry 불변.
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
    // 부착선 = 스탠드 윗선 subpath: attachLen = upperNeckSeg − frontInset, 여밈 연장 미포함, 유한
    var lengths = null, standRe = null;
    if (cd && bodice && cd.parameters && cd.parameters.stand) {
      standRe = DC.computeStand(bodice, cd.parameters.stand);
      if (!standRe.ok) fails.push("stand-recompute");
      else {
        lengths = { lowerNeckSeam: standRe.lowerNeckSeamLenCm, lowerExtension: standRe.lowerExtensionLenCm, upperNeckSegment: standRe.upperNeckSegmentLenCm, upperExtension: standRe.upperExtensionLenCm, upperTotal: standRe.upperTotalLenCm };
        var frontInset = (cd.body && cd.body.parameters) ? cd.body.parameters.frontInsetCm : NaN;
        var attachLen = (cd.body) ? cd.body.attachLenCm : NaN;
        if (!num(standRe.upperNeckSegmentLenCm) || !num(frontInset) || !num(attachLen)) fails.push("unmeasured");
        else if (Math.abs(attachLen - (standRe.upperNeckSegmentLenCm - frontInset)) > 0.01) fails.push("attach-mismatch");
        else if (attachLen > standRe.upperTotalLenCm - 1e-6 && standRe.upperExtensionLenCm > 0) fails.push("extension-included");   // 연장이 부착에 포함되면 안 됨
      }
    }
    return { ok: fails.length === 0, fails: fails, _bodice: bodice, _lengths: lengths, _stand: standRe };
  }

  // 형상 전용 signature(hash): completedAt·layout·선택·snap·UI·다른 patternLines 제외.
  function signatureOf(res) {
    return JSON.stringify({
      sbh: res.sourceBodiceHash, nk: res.necklineLengths,
      sp: res.stand.parameters, sg: canonGeom(res.stand.geometry), sl: res.stand.lengths,
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
    var manualSource = null;
    if (cd.body.mode === "manual") {
      var line = (proj.working.patternLines || []).find(function (l) { return l.id === cd.body.lineId; });
      if (line) manualSource = { lineId: line.id, segments: clone(line.segments) };   // 관리형 collar-body 선 하나만
    }
    var result = {
      schemaVersion: 1, type: "shirt-two-piece",
      baseMethod: cd.baseMethod || null,   // 정본 제도법 출처(메타) — signatureOf 에 미포함(hash 제외).
      sourceBodiceHash: cd.sourceBodiceHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      necklineLengths: clone(bodice.necklineLengths),
      stand: { parameters: clone(cd.parameters.stand), geometry: clone(cd.standGeometry), lengths: { lowerNeckSeam: round4(c._lengths.lowerNeckSeam), lowerExtension: round4(c._lengths.lowerExtension), upperNeckSegment: round4(c._lengths.upperNeckSegment), upperExtension: round4(c._lengths.upperExtension), upperTotal: round4(c._lengths.upperTotal) } },
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
    if (!cd.standGeometry || !cd.body || !cd.body.geometry) return true;               // 카라 형상 없음/숨김
    if (cd.body.mode === "manual" && cd.body.invalid) return true;                     // 무효 편집
    if (!cd.parameters || !cd.parameters.stand) return true;
    var standRe = DC.computeStand(bodice, cd.parameters.stand); if (!standRe.ok) return true;
    var cur = {
      sourceBodiceHash: cd.sourceBodiceHash, necklineLengths: bodice.necklineLengths,
      stand: { parameters: cd.parameters.stand, geometry: cd.standGeometry, lengths: { lowerNeckSeam: round4(standRe.lowerNeckSeamLenCm), lowerExtension: round4(standRe.lowerExtensionLenCm), upperNeckSegment: round4(standRe.upperNeckSegmentLenCm), upperExtension: round4(standRe.upperExtensionLenCm), upperTotal: round4(standRe.upperTotalLenCm) } },
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
