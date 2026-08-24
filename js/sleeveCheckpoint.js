// ══════════════════════════════════════════════
// sleeveCheckpoint.js — 소매 모양 완료(S5). bodiceCheckpoint 와 같은 결의 세션 스냅샷.
//
// Design 소매 결과를 working.sleeveResult 로 잠근다. **아직 시접·너치·커프스·트임·재단선 아님.**
// 완료본은 특정 몸판 완료본(sourceBodiceHash)에 종속. 몸판/소매 변경 시 조용히 갱신하지 않고
// stale/무효 처리 → 사용자가 명시적으로 다시 완료해야 교체.
//
// 완료 게이트(사용자 확정, 모두 통과해야 완료):
//   ① bodiceResult 존재·비스테일  ② sleeveDraft.sourceBodiceHash === bodiceResult.hash
//   ③ capInvalid === false        ④ 최종 outline 연결·단순(자기교차 없음)
//   ⑤ cap SP 기준 앞/뒤 분리 가능  ⑥ 앞·뒤 cap 길이·이세 유한값
//   ⑦ manual 이면 관리형 cap 선과 최종 geometry 일치(capInvalid=false + 선 존재로 보장)
//   · narrow-cuff 는 경고일 뿐 차단 안 함. 이세량은 합격 기준 아님(사실값).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  function project() { return (window.designWorkflow && window.designWorkflow.current()) || null; }
  function round4(v) { return Math.round(v * 1e4) / 1e4; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(function (k) { deepFreeze(o[k]); }); Object.freeze(o); } return o; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }

  // ── 검사 ──
  function check(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, fails: ["no-project"] };
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    var d = proj.working.sleeveDraft;
    if (!d) fails.push("no-sleeve");
    if (d && bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    if (d && d.capInvalid) fails.push("cap-invalid");
    if (d && d.mode === "manual") {
      var line = (proj.working.patternLines || []).find(function (l) { return l.id === d.capLineId; });
      if (!line) fails.push("manual-line-missing");
    }
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (d && geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (d && geom && DS && DS.sleeveOutlineSelfIntersects(geom)) fails.push("self-intersection");
    // 이세(사실값)
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - bodice.armholeLengths.front, be = prim.lengths.back - bodice.armholeLengths.back;
      if (!(isFinite(fe) && isFinite(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return {
      ok: fails.length === 0, fails: fails,
      capLengths: prim ? prim.lengths : null, ease: ease,
      lower: d ? d.parameters.lower : null, cap: d ? d.parameters.cap : null,
      mode: d ? d.mode : null, _prim: prim, _bodice: bodice
    };
  }

  // 완료본 hash 용 signature(형상 전용: geometry·parameters·cap.mode·capLengths·sourceBodiceHash.
  //   completedAt·layout·선택·snap 제외).
  function signature(sleeveResult) {
    return JSON.stringify({
      g: canonGeom(sleeveResult.geometry), p: sleeveResult.parameters,
      m: sleeveResult.cap.mode, l: sleeveResult.cap.lengths, sbh: sleeveResult.sourceBodiceHash
    });
  }
  function canonGeom(geom) {
    return (geom.outline || []).map(function (s) {
      if (s.kind === "line") return "L" + [s.from.x, s.from.y, s.to.x, s.to.y].map(round4).join(",");
      if (s.kind === "cubic") return "C" + [s.from.x, s.from.y, s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y].map(round4).join(",");
      return "P" + (s.commands || []).map(function (c) { return c.type + c.points.map(function (p) { return round4(p.x) + "/" + round4(p.y); }).join(";"); }).join("|");
    });
  }

  // ── 완료 ── 게이트 통과 시 working.sleeveResult 불변 스냅샷. 실패 시 변경 없음.
  function complete(proj) {
    proj = proj || project();
    if (!proj) return { ok: false, reason: "no-project" };
    var c = check(proj);
    if (!c.ok) return { ok: false, reason: c.fails[0], check: c };
    var d = proj.working.sleeveDraft, geom = proj.working.geometry.sleeve, prim = c._prim, bodice = c._bodice;
    var sb = proj.sourceBlock || {};
    var manualSource = null;
    if (d.mode === "manual") {
      var line = (proj.working.patternLines || []).find(function (l) { return l.id === d.capLineId; });
      if (line) manualSource = { lineId: line.id, splitAnchorIndex: line.splitAnchorIndex, segments: clone(line.segments) };
    }
    var result = {
      schemaVersion: 1,
      sourceBodiceHash: d.sourceBodiceHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      geometry: clone(geom),
      parameters: { lower: clone(d.parameters.lower), cap: d.parameters.cap ? clone(d.parameters.cap) : null },
      cap: {
        mode: d.mode,
        frontPrimitives: clone(prim.frontPrimitives), backPrimitives: clone(prim.backPrimitives),
        splitPoint: clone(prim.splitPoint),
        lengths: { front: round4(prim.lengths.front), back: round4(prim.lengths.back), total: round4(prim.lengths.total) },
        ease: { front: round4(c.ease.front), back: round4(c.ease.back), total: round4(c.ease.total) },
        manualSource: manualSource
      },
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;   // 세션 전용(reload 소멸). reference·bodiceResult 불변.
    return { ok: true, result: result, check: c };
  }

  function latest(proj) { proj = proj || project(); return (proj && proj.working.sleeveResult) || null; }
  // 완료본 없음 → true. 몸판 hash 가 완료본과 다르면 "몸판 변경으로 무효"(별도 함수). 여기선 소매 형상 변경.
  function isCurrentSleeveChanged(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.sleeveResult; if (!res) return true;
    var c = check(proj);
    if (!c.ok || !c._prim) return true;   // 현재 유효하지 않으면 변경으로 간주(재완료 필요)
    var cur = {
      schemaVersion: 1, sourceBodiceHash: proj.working.sleeveDraft.sourceBodiceHash,
      geometry: proj.working.geometry.sleeve,
      parameters: { lower: proj.working.sleeveDraft.parameters.lower, cap: proj.working.sleeveDraft.parameters.cap || null },
      cap: { mode: proj.working.sleeveDraft.mode, lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } }
    };
    return signature(cur) !== signature(res);
  }
  // 몸판 완료본 hash 가 소매 완료본의 sourceBodiceHash 와 다르면 "몸판 변경으로 소매 무효".
  function invalidatedByBodice(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.sleeveResult; if (!res) return false;
    var BC = window.bodiceCheckpoint, bodice = BC && BC.latest(proj);
    if (!bodice) return true;
    return res.sourceBodiceHash !== bodice.hash;
  }

  window.sleeveCheckpoint = Object.freeze({ check: check, complete: complete, latest: latest, isCurrentSleeveChanged: isCurrentSleeveChanged, invalidatedByBodice: invalidatedByBodice });
})();
