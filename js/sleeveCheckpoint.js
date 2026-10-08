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
//
// ── 소매 Ⓐ(`working.sleeveA`, bunka-sleeve-A) 완료 ──
//   기본 소매 완료본 스키마·hash·소비자 동작은 그대로다(Ⓐ 가 꺼져 있으면 아래 Ⓐ 분기는 한 줄도 타지 않는다).
//   Ⓐ 가 켜져 있으면 완료본은 `origin`(preset 출처) · `inputs`(소매길이) · `meta`(엔진 AH·소매산·폭·목표/실제 이세)를 더 든다.
//   `parameters`(소매부리 둘레·옆선·사용자 소매산)는 기본 소매 전용이라 Ⓐ 완료본에는 없다 — 지어내지 않는다.
//   공통 필드(geometry·cap.lengths·cap.ease·cap.splitPoint·cap 조각)는 기본 소매와 똑같이 **실제 geometry 에서 측정**한다.
//   ★ 권위값(사용자 확정 2026-10-05): 재단·물리 검증의 기준은 **최종 geometry 를 직접 측정한 `cap.lengths`/`cap.ease`** 다(제1법칙 —
//     실제 종이 형상). `meta.easeTarget`/`meta.easeAfter`/`meta.capLengths` 는 엔진의 목표·제도 과정·감사용 기록으로만 유지하며,
//     두 값은 측정 방식(엔진 400분할 vs 소매산 60분할 flatten)이 달라 ~0.001cm 어긋난다 — 같게 맞추거나 반올림으로 덮어쓰지 않는다.
//   게이트 ⑧(Ⓐ 전용): Ⓐ 상태가 차단(blocked)이 아니고, 출처 hash·지원 preset 이 맞고, 현재 geometry.sleeve 가 같은 몸판·소매길이로
//   Ⓐ 를 다시 제도한 결과와 일치(= 다른 소매 형상이 Ⓐ 로 서명되지 않음).
//
// ── 소매 Ⓑ(`working.sleeveB`, bunka-sleeve-B, P.41 타이트) 완료 ──
//   Ⓐ 와 같은 구조(origin·inputs·meta·불변 geometry·실측 cap.lengths/cap.ease). 입력 = 소매길이 + 선택 손바닥 둘레(없으면 null),
//   출발 Ⓐ 의 출처 hash 는 `sourceSleeveAHash`. ★ 지배 ease 는 최종(fairing 된) geometry 를 직접 측정한 `cap.ease` — `meta.easeTarget/easeAfter`
//   는 감사 정보다. 손바닥 경고(hem-below-palm-allowance)는 `warnings` 에만 남고 완료를 막지 않는다(자동 보정 없음).
//   게이트 ⑧(Ⓑ 전용): 차단 아님 · 출처 hash · 현재 geometry·meta 가 같은 몸판·입력으로 Ⓑ 를 다시 제도한 결과와 일치.
//   Ⓐ·Ⓑ 가 동시에 켜져 있으면(ui 가 배타를 지키므로 발생하지 않는다) `sleeve-line-conflict` 로 거부한다.
//
// ── 소매 Ⓒ(`working.sleeveC`, bunka-sleeve-C, P.41 하단 타이트 + 뒤 소맷부리 다트) 완료 ──
//   Ⓑ 와 같은 구조(origin·inputs·meta·불변 geometry·실측 cap.lengths/cap.ease). 입력 = 소매길이 + 팔꿈치 길이 EL(기본 31.4), 출발 Ⓐ 출처 hash = `sourceSleeveAHash`.
//   ★ 지배 ease 는 최종(정리된) geometry 를 직접 측정한 `cap.ease`. 게이트 ⑧(Ⓒ 전용): 차단 아님 · 소매길이·EL 유효 · 출처 hash · 현재 geometry·meta 가 같은 몸판·입력으로 Ⓒ 를 다시 제도한 결과와 일치.
//   입력(소매길이·EL)이 바뀌면 signature 가 달라져 «변경됨 → 다시 완료», 몸판이 바뀌면 sourceBodiceHash 불일치로 무효.
//   Ⓐ·Ⓑ·Ⓒ 중 둘 이상이 켜져 있으면(ui 가 배타를 지키므로 발생하지 않는다) `sleeve-line-conflict` 로 거부한다.
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
    // 소매 Ⓐ 는 working.sleeveA + geometry.sleeve 만 쓰고 sleeveDraft 는 모른다 — 기본 소매 파라미터로 서명하지 않도록 별도 분기.
    var lineCount = (proj.working.sleeveA ? 1 : 0) + (proj.working.sleeveB ? 1 : 0) + (proj.working.sleeveC ? 1 : 0);
    if (lineCount > 1) return { ok: false, fails: ["sleeve-line-conflict"], capLengths: null, ease: null };
    if (proj.working.sleeveC) return checkC(proj);
    if (proj.working.sleeveB) return checkB(proj);
    if (proj.working.sleeveA) return checkA(proj);
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


  // ── 소매 Ⓐ 분기 ──
  var PRESET_A = "bunka-sleeve-A";
  var A_ORIGIN = { kind: "preset", presetId: PRESET_A, method: "bodice-armhole", methodPage: 137 };
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function kindOf(res) { return res ? (res.origin ? "preset" : "default") : null; }
  function checkA(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SAA = window.sleeveAApply;
    var a = proj.working.sleeveA;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (a.blocked) fails.push("sleeve-a-blocked");
    if (a.presetId !== PRESET_A) fails.push("sleeve-preset-unsupported");
    if (bodice && a.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = a.parameters && a.parameters.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && DS.sleeveOutlineSelfIntersects(geom)) fails.push("self-intersection");
    // 현재 geometry.sleeve·meta 가 «같은 몸판·소매길이의 Ⓐ 재제도»와 일치해야 한다(다른 형상이 Ⓐ 로 서명되는 것 방지).
    if (!fails.length) {
      if (!SAA || !window.designSleeveA) fails.push("no-module");
      else {
        var r = SAA.draft(proj, len);
        if (!r.ok) fails.push("sleeve-a-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(a.meta)) fails.push("sleeve-a-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - bodice.armholeLengths.front, be = prim.lengths.back - bodice.armholeLengths.back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return {
      ok: fails.length === 0, fails: fails,
      capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_A, _prim: prim, _bodice: bodice, _a: a
    };
  }

  // ── 소매 Ⓑ 분기 ──
  var PRESET_B = "bunka-sleeve-B";
  var B_ORIGIN = { kind: "preset", presetId: PRESET_B, method: "tight-from-sleeve-A", methodPage: 41 };
  function checkB(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SBA = window.sleeveBApply;
    var b = proj.working.sleeveB;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (b.blocked) fails.push("sleeve-b-blocked");
    if (b.presetId !== PRESET_B) fails.push("sleeve-preset-unsupported");
    if (bodice && b.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = b.parameters && b.parameters.sleeveLengthCm, palm = b.parameters ? b.parameters.palmCircumferenceCm : null;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (palm !== null && palm !== undefined && !(fin(palm) && palm > 0)) fails.push("invalid-palm-circumference");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    // ★ designSleeve.sleeveOutlineSelfIntersects 는 «소맷부리 = 직선 한 변» 을 전제로 하므로 소맷부리가 곡선(path)인 Ⓑ 에는 쓰지 않는다(항상 true 가 된다).
    //   Ⓑ 의 자기교차 검사는 엔진이 flatten 한 폐곡선 전체로 이미 했고(meta.checks.selfIntersection), 아래 «재제도 일치» 게이트가 현재 geometry 가 그 결과와 같음을 보장한다.
    if (prim && b.meta && b.meta.checks && b.meta.checks.selfIntersection !== false) fails.push("self-intersection");
    // 현재 geometry.sleeve·meta 가 «같은 몸판·입력의 Ⓑ 재제도»와 일치해야 한다(다른 형상이 Ⓑ 로 서명되는 것 방지).
    if (!fails.length) {
      if (!SBA || !window.designSleeveB) fails.push("no-module");
      else {
        var r = SBA.draft(proj, len, palm === undefined ? null : palm);
        if (!r.ok) fails.push("sleeve-b-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(b.meta)
          || r.sourceSleeveAHash !== b.sourceSleeveAHash) fails.push("sleeve-b-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - bodice.armholeLengths.front, be = prim.lengths.back - bodice.armholeLengths.back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return {
      ok: fails.length === 0, fails: fails,
      capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_B, _prim: prim, _bodice: bodice, _a: b
    };
  }
  // ── 소매 Ⓒ 분기 ──
  var PRESET_C = "bunka-sleeve-C";
  var C_ORIGIN = { kind: "preset", presetId: PRESET_C, method: "tight-back-dart-from-sleeve-A", methodPage: 41 };
  function checkC(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SCA = window.sleeveCApply;
    var c = proj.working.sleeveC;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (c.blocked) fails.push("sleeve-c-blocked");
    if (c.presetId !== PRESET_C) fails.push("sleeve-preset-unsupported");
    if (bodice && c.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = c.parameters && c.parameters.sleeveLengthCm, el = c.parameters ? c.parameters.elbowLengthCm : undefined;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(el) || !(el > 0)) fails.push("invalid-elbow-length");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    // Ⓑ 와 같은 이유로 designSleeve.sleeveOutlineSelfIntersects 는 쓰지 않는다(소맷부리가 곡선·다트 노치) — 엔진이 flatten 한 폐곡선 전체로 이미 검사했고(meta.checks), 아래 재제도 일치 게이트가 현재 geometry 가 그 결과임을 보장한다.
    if (prim && c.meta && c.meta.checks && (c.meta.checks.selfIntersection !== false || c.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    // 현재 geometry.sleeve·meta 가 «같은 몸판·입력(소매길이·EL)의 Ⓒ 재제도»와 일치해야 한다(다른 형상이 Ⓒ 로 서명되는 것 방지).
    if (!fails.length) {
      if (!SCA || !window.designSleeveC) fails.push("no-module");
      else {
        var r = SCA.draft(proj, len, el);
        if (!r.ok) fails.push("sleeve-c-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(c.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction)   // Ⓒ 는 표시용 construction(중심선·EL 선·절개축)도 재제도와 같아야 한다
          || r.sourceSleeveAHash !== c.sourceSleeveAHash) fails.push("sleeve-c-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - bodice.armholeLengths.front, be = prim.lengths.back - bodice.armholeLengths.back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return {
      ok: fails.length === 0, fails: fails,
      capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_C, _prim: prim, _bodice: bodice, _a: c
    };
  }
  function inputsC(c) { return { sleeveLengthCm: c.parameters.sleeveLengthCm, elbowLengthCm: c.parameters.elbowLengthCm }; }
  function inputsB(b) { return { sleeveLengthCm: b.parameters.sleeveLengthCm, palmCircumferenceCm: b.parameters.palmCircumferenceCm === undefined ? null : b.parameters.palmCircumferenceCm }; }

  // 완료본 hash 용 signature(형상 전용: geometry·parameters·cap.mode·capLengths·sourceBodiceHash.
  //   completedAt·layout·선택·snap 제외).
  function signature(sleeveResult) {
    if (sleeveResult.origin) {   // 소매 Ⓐ: 출처·입력·형상·cap 길이·몸판 hash(기본 소매의 parameters 는 없다)
      return JSON.stringify({ g: canonGeom(sleeveResult.geometry), o: sleeveResult.origin.presetId, i: sleeveResult.inputs,
        m: sleeveResult.cap.mode, l: sleeveResult.cap.lengths, sbh: sleeveResult.sourceBodiceHash });
    }
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
    if (proj.working.sleeveC) return completeC(proj, c);
    if (proj.working.sleeveB) return completeB(proj, c);
    if (proj.working.sleeveA) return completeA(proj, c);
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


  function capBlock(c) {
    var prim = c._prim;
    return {
      mode: "preset",
      frontPrimitives: clone(prim.frontPrimitives), backPrimitives: clone(prim.backPrimitives),
      splitPoint: clone(prim.splitPoint),
      lengths: { front: round4(prim.lengths.front), back: round4(prim.lengths.back), total: round4(prim.lengths.total) },
      ease: { front: round4(c.ease.front), back: round4(c.ease.back), total: round4(c.ease.total) },
      manualSource: null
    };
  }
  function completeA(proj, c) {
    var a = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(A_ORIGIN),
      sourceBodiceHash: a.sourceBodiceHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: { sleeveLengthCm: a.parameters.sleeveLengthCm },
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(a.meta), warnings: a.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeB(proj, c) {
    var b = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(B_ORIGIN),
      sourceBodiceHash: b.sourceBodiceHash,
      sourceSleeveAHash: b.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsB(b),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(b.meta), warnings: b.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeC(proj, c) {
    var cc = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(C_ORIGIN),
      sourceBodiceHash: cc.sourceBodiceHash,
      sourceSleeveAHash: cc.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsC(cc),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(cc.meta), warnings: cc.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function latest(proj) { proj = proj || project(); return (proj && proj.working.sleeveResult) || null; }
  // 완료본 없음 → true. 몸판 hash 가 완료본과 다르면 "몸판 변경으로 무효"(별도 함수). 여기선 소매 형상 변경.
  function isCurrentSleeveChanged(proj) {
    proj = proj || project(); if (!proj) return false;
    var res = proj.working.sleeveResult; if (!res) return true;
    var c = check(proj);
    if (!c.ok || !c._prim) return true;   // 현재 유효하지 않으면 변경으로 간주(재완료 필요)
    if (proj.working.sleeveC) {   // 소매 Ⓒ: Ⓑ 와 같은 signature 형식(입력 = 소매길이·EL — EL 변경도 «변경»)
      return signature({ origin: C_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsC(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveB) {   // 소매 Ⓑ: Ⓐ 와 같은 signature 형식(origin·inputs 가 다르면 Ⓐ↔Ⓑ 전환도 «변경»)
      return signature({ origin: B_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsB(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveA) {   // 소매 Ⓐ: 같은 signature 형식(origin 이 다르면 기본↔Ⓐ 전환도 «변경»)
      return signature({ origin: A_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: { sleeveLengthCm: c._a.parameters.sleeveLengthCm },
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
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

  window.sleeveCheckpoint = Object.freeze({ check: check, complete: complete, latest: latest, isCurrentSleeveChanged: isCurrentSleeveChanged, invalidatedByBodice: invalidatedByBodice, kindOf: kindOf });
})();
