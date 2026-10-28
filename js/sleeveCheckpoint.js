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

  // 봉제(소매 제도)용 진동 길이 — 저장 AH 에서 확인된 틈 메움 직선만 뺀 값(허리 이음선 Ⓜ·Ⓝ). 그 밖의 몸판은 저장 AH 그대로(2026-10-27).
  //   designSleeveA 가 없는 맥락(소매 Ⓐ 미사용 단독 계산)에서는 빼야 할 틈 기록(waistSeam.closedDart)이 없을 때만 저장 AH 와 같다고 확정할 수 있다 — 있으면 null.
  function sewnAH(b) {
    if (!b) return null; var S = window.designSleeveA; if (S && S.sewnArmholeLengths) return S.sewnArmholeLengths(b);
    var ws = b.waistSeam; return (ws && ((ws.front && ws.front.closedDart) || (ws.back && ws.back.closedDart))) ? null : (b.armholeLengths || null);
  }
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
    var lineCount = (proj.working.sleeveA ? 1 : 0) + (proj.working.sleeveB ? 1 : 0) + (proj.working.sleeveC ? 1 : 0) + (proj.working.sleeveD ? 1 : 0) + (proj.working.sleeveE ? 1 : 0) + (proj.working.sleeveF ? 1 : 0) + (proj.working.sleeveG ? 1 : 0) + (proj.working.sleeveH ? 1 : 0) + (proj.working.sleeveI ? 1 : 0) + (proj.working.sleeveJ ? 1 : 0) + (proj.working.sleeveK ? 1 : 0) + (proj.working.sleeveL ? 1 : 0) + (proj.working.sleeveM ? 1 : 0) + (proj.working.sleeveN ? 1 : 0) + (proj.working.sleeveO ? 1 : 0) + (proj.working.sleeveP ? 1 : 0) + (proj.working.sleeveQ ? 1 : 0) + (proj.working.sleeveR ? 1 : 0);
    if (lineCount > 1) return { ok: false, fails: ["sleeve-line-conflict"], capLengths: null, ease: null };
    if (proj.working.sleeveR) return checkR(proj);
    if (proj.working.sleeveQ) return checkQ(proj);
    if (proj.working.sleeveP) return checkP(proj);
    if (proj.working.sleeveO) return checkO(proj);
    if (proj.working.sleeveN) return checkN(proj);
    if (proj.working.sleeveM) return checkM(proj);
    if (proj.working.sleeveL) return checkL(proj);
    if (proj.working.sleeveK) return checkK(proj);
    if (proj.working.sleeveJ) return checkJ(proj);
    if (proj.working.sleeveI) return checkI(proj);
    if (proj.working.sleeveH) return checkH(proj);
    if (proj.working.sleeveG) return checkG(proj);
    if (proj.working.sleeveF) return checkF(proj);
    if (proj.working.sleeveE) return checkE(proj);
    if (proj.working.sleeveD) return checkD(proj);
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
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
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
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
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
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
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
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return {
      ok: fails.length === 0, fails: fails,
      capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_C, _prim: prim, _bodice: bodice, _a: c
    };
  }
  // ── 소매 Ⓓ 분기(P.42 플레어, bunka-sleeve-D) — Ⓒ 와 같은 결: 같은 몸판·입력(소매길이)의 재제도와 geometry·meta·construction 이 같아야 서명한다 ──
  var PRESET_D = "bunka-sleeve-D";
  var D_ORIGIN = { kind: "preset", presetId: PRESET_D, method: "flare-slash-spread-from-sleeve-A", methodPage: 42 };
  function checkD(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SDA = window.sleeveDApply;
    var d = proj.working.sleeveD;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-d-blocked");
    if (d.presetId !== PRESET_D) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = d.parameters && d.parameters.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SDA || !window.designSleeveD) fails.push("no-module");
      else {
        var r = SDA.draft(proj, len);
        if (!r.ok) fails.push("sleeve-d-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-d-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_D, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsD(d) { return { sleeveLengthCm: d.parameters.sleeveLengthCm }; }
  // ── 소매 Ⓔ 분기(P.42 플레어 절개 3개, bunka-sleeve-E) — Ⓓ 와 같은 결: 같은 몸판·입력(소매길이)의 재제도와 geometry·meta·construction 이 같아야 서명한다 ──
  var PRESET_E = "bunka-sleeve-E";
  var E_ORIGIN = { kind: "preset", presetId: PRESET_E, method: "flare-3cut-symmetric-from-sleeve-A", methodPage: 42 };
  function checkE(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SEA = window.sleeveEApply;
    var d = proj.working.sleeveE;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-e-blocked");
    if (d.presetId !== PRESET_E) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = d.parameters && d.parameters.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SEA || !window.designSleeveE) fails.push("no-module");
      else {
        var r = SEA.draft(proj, len);
        if (!r.ok) fails.push("sleeve-e-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-e-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_E, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsE(d) { return { sleeveLengthCm: d.parameters.sleeveLengthCm }; }
  // ── 소매 Ⓗ 분기(P.44 퍼프, bunka-sleeve-H) — Ⓔ 와 같은 결 + 입력 EL·손바닥·★(소매산 = Ⓐ 라 capPrimitives 실측) ──
  var PRESET_H = "bunka-sleeve-H";
  var H_ORIGIN = { kind: "preset", presetId: PRESET_H, method: "puff-below-el-slash-from-sleeve-A", methodPage: 44 };
  function checkH(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SHA = window.sleeveHApply;
    var d = proj.working.sleeveH;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-h-blocked");
    if (d.presetId !== PRESET_H) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.elbowLengthCm) || !fin(pp.palmCircumferenceCm) || !fin(pp.dropCm)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SHA || !window.designSleeveH) fails.push("no-module");
      else {
        var r = SHA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-h-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-h-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_H, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsH(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, elbowLengthCm: p.elbowLengthCm, palmCircumferenceCm: p.palmCircumferenceCm, dropCm: p.dropCm }; }
  // ── 소매 Ⓘ 분기(P.44 하단 퍼프, bunka-sleeve-I) — Ⓔ 와 같은 결 + 입력 손바닥(소매산 재제도 → capPrimitives 실측) ──
  // ── 소매 Ⓞ 분기(P.47 하단 턱트 슬리브, bunka-sleeve-O) — Ⓕ 와 같은 결: ★ 소매산 길이·이세 = 턱을 접은(봉제) 길이(designSleeveO.capLengthsOf 가
  //   최종 geometry 재단선에서 턱 입구를 빼고 잰다 · 재단 길이는 cutLengths 로 따로). 소맷부리 재단/봉제도 재실측(designSleeveO.hemLengthsOf).
  //   입력 = 소매길이(기본 20) · 안쪽 절개 1.25 · 절개 간격 2.5 · 벌림 2 · 소맷부리 박기 끝 1.5(책 기본 설정값). ──
  var PRESET_O = "bunka-sleeve-O";
  var O_ORIGIN = { kind: "preset", presetId: PRESET_O, method: "short-tucked-parallel-slash-from-sleeve-A", methodPage: 47 };
  function primO(geom) {
    var SO = window.designSleeveO; if (!SO || !geom) return null;
    var lens = SO.capLengthsOf(geom); if (!lens) return null;
    var capS = geom.outline.filter(function (x) { return x.role === "cap" && x.kind === "path"; })[0];
    var cmds = capS.commands, k = lens.splitIndex;
    var back = { kind: "path", commands: [clone(cmds[0])].concat(clone(cmds.slice(1, k + 1))) };
    var front = { kind: "path", commands: [{ type: "M", points: [clone(cmds[k].points[cmds[k].points.length - 1])] }].concat(clone(cmds.slice(k + 1))) };
    return { frontPrimitives: [front], backPrimitives: [back], splitPoint: clone(lens.split), lengths: lens.sewn, cutLengths: lens.cut };
  }
  function checkO(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, SOA = window.sleeveOApply, SO = window.designSleeveO;
    var d = proj.working.sleeveO;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-o-blocked");
    if (d.presetId !== PRESET_O) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.innerOffsetCm) || !fin(pp.cutSpacingCm) || !fin(pp.spreadCm) || !fin(pp.stitchEndCm)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = primO(geom);
    if (!prim) fails.push("cap-unmeasured");
    var hl = (geom && SO) ? SO.hemLengthsOf(geom) : null;
    if (!hl) fails.push("hem-unmeasured");
    else if (d.meta && d.meta.hem && (Math.abs(hl.cut.total - d.meta.hem.cutCm) > 1e-9 || Math.abs(hl.sewn.total - d.meta.hem.sewnCm) > 1e-9)) fails.push("length-mismatch");
    if (prim && d.meta && d.meta.cap && (Math.abs(prim.lengths.total - d.meta.cap.sewnCm) > 1e-9 || Math.abs(prim.cutLengths.total - d.meta.cap.cutCm) > 1e-9)) fails.push("length-mismatch");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true || d.meta.checks.piecesOverlap !== false)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SOA || !SO) fails.push("no-module");
      else {
        var r = SOA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-o-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-o-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease, hemLengths: hl,
      lower: null, cap: null, mode: "preset", preset: PRESET_O, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsO(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, innerOffsetCm: p.innerOffsetCm, cutSpacingCm: p.cutSpacingCm, spreadCm: p.spreadCm, stitchEndCm: p.stitchEndCm }; }
  // ── 소매 Ⓝ 분기(P.47 반소매 퍼프·소맷부리 턱, bunka-sleeve-N) — Ⓛ 와 같은 결 + 소맷부리 재단/봉제 길이 재실측(designSleeveN.hemLengthsOf).
  //   입력 = 소매길이(기본 20) · 절개 위치 2.5 · 가운데 벌림 4 · 양옆 벌림 2 · 박기 끝 1.5(책 기본 설정값). 앞/뒤 분할 = geometry.capSplit(중심선). ──
  var PRESET_N = "bunka-sleeve-N";
  var N_ORIGIN = { kind: "preset", presetId: PRESET_N, method: "short-puff-hem-tuck-cap-pivot-slash-from-sleeve-A", methodPage: 47 };
  function checkN(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SNA = window.sleeveNApply, SN = window.designSleeveN;
    var d = proj.working.sleeveN;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-n-blocked");
    if (d.presetId !== PRESET_N) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.cutOffsetCm) || !fin(pp.centerTuckCm) || !fin(pp.sideTuckCm) || !fin(pp.stitchEndCm)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    var hl = (geom && SN) ? SN.hemLengthsOf(geom) : null;   // 소맷부리 재단(펼침)·봉제(턱 접음) 길이 — 최종 geometry 재실측
    if (!hl) fails.push("hem-unmeasured");
    else if (d.meta && d.meta.hem && (Math.abs(hl.cut.total - d.meta.hem.cutCm) > 1e-9 || Math.abs(hl.sewn.total - d.meta.hem.sewnCm) > 1e-9)) fails.push("hem-length-mismatch");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true || d.meta.checks.piecesOverlap !== false)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SNA || !SN) fails.push("no-module");
      else {
        var r = SNA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-n-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-n-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease, hemLengths: hl,
      lower: null, cap: null, mode: "preset", preset: PRESET_N, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsN(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, cutOffsetCm: p.cutOffsetCm, centerTuckCm: p.centerTuckCm, sideTuckCm: p.sideTuckCm, stitchEndCm: p.stitchEndCm }; }
  // ── 소매 Ⓠ 분기(P.48 하단 캡 슬리브, bunka-sleeve-Q) — Ⓟ 와 같은 결. 입력 = 소매산 높이 비율(기본 0.25). 앞/뒤 분할 = geometry.capSplit(중심선) · 이세 = 공용 실측 − AH(전체 — 구간 이세는 meta). ──
  var PRESET_Q = "bunka-sleeve-Q";
  var Q_ORIGIN = { kind: "preset", presetId: PRESET_Q, method: "cap-sleeve-horizontal-hem-on-sleeve-A-cap", methodPage: 48 };
  function checkQ(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SQA = window.sleeveQApply;
    var d = proj.working.sleeveQ;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-q-blocked");
    if (d.presetId !== PRESET_Q) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {};
    if (!fin(pp.heightRatio)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true || d.meta.checks.piecesOverlap !== false)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SQA || !window.designSleeveQ) fails.push("no-module");
      else {
        var r = SQA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-q-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-q-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      // Ⓠ: 구간 이세 = 남은 소매산 − 남은 AH(AH − 소매에서 빠진 호) — 전체 AH 와 혼동하지 않는다(김님 2026-10-26)
      var exq = d.meta && d.meta.excludedArcCm;
      var fe = exq ? prim.lengths.front - ((sewnAH(bodice) || {}).front - exq.front) : NaN, be = exq ? prim.lengths.back - ((sewnAH(bodice) || {}).back - exq.back) : NaN;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_Q, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsQ(d) { var p = d.parameters; return { heightRatio: p.heightRatio }; }
  // ── 소매 Ⓡ 분기(P.49 돌먼, bunka-sleeve-R) — 출발 = 완료 몸판 Ⓐ(형상 게이트) · 소매 Ⓐ 없음. 결과 = 한 장 소매(geometry.sleeve) + **파생 몸판**(derivedBodice).
  //   파생 몸판은 이 완료본이 소유한다(bodiceResult 는 그대로 — 2026-10-04 결정). 이세 = 공용 실측 소매산 − **새 몸판 진동**(원래 AH 아님, 강제 0 아님).
  var PRESET_R = "bunka-sleeve-R";
  var R_ORIGIN = { kind: "preset", presetId: PRESET_R, method: "dolman-drafted-on-bodice-A-one-piece-sleeve", methodPage: 49, bodicePresetId: "bunka-bodice-A" };
  function checkR(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SRA = window.sleeveRApply;
    var d = proj.working.sleeveR;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-r-blocked");
    if (d.presetId !== PRESET_R) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {};
    if (!SRA || !SRA.KEYS.every(function (k) { return fin(pp[k]); })) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.bodiceSelfIntersection !== false || d.meta.checks.singlePiece !== true || d.meta.checks.piecesOverlap !== false)) fails.push("self-intersection");
    if (!d.derivedBodice || !d.derivedBodice.front || !d.derivedBodice.back) fails.push("derived-bodice-missing");
    if (!fails.length) {
      if (!SRA || !window.designSleeveR) fails.push("no-module");
      else {
        var r = SRA.draft(proj, pp);   // 다시 제도(같은 몸판·입력) — 다른 형상이 Ⓡ 로 서명되지 않게 · 몸판이 Ⓐ 가 아니면 여기서 거부된다
        if (!r.ok) fails.push(r.reason === "bodice-not-a" ? "bodice-not-a" : "sleeve-r-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)
          || JSON.stringify(r.derivedBodice) !== JSON.stringify(d.derivedBodice)) fails.push("sleeve-r-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && d.meta && d.meta.armhole) {
      var fe = prim.lengths.front - d.meta.armhole.front, be = prim.lengths.back - d.meta.armhole.back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_R, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsR(d) { var o = {}; (window.sleeveRApply ? window.sleeveRApply.KEYS : Object.keys(d.parameters)).forEach(function (k) { o[k] = d.parameters[k]; }); return o; }
  // ── 소매 Ⓟ 분기(P.48 반소매 플레어, bunka-sleeve-P) — Ⓜ 와 같은 결. 입력 = 소매길이(기본 20) · 플레어 계수(기본 0.7). 앞/뒤 분할 = geometry.capSplit(중심선). ──
  var PRESET_P = "bunka-sleeve-P";
  var P_ORIGIN = { kind: "preset", presetId: PRESET_P, method: "short-flare-cap-pivot-five-slashes-from-sleeve-A", methodPage: 48 };
  function checkP(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SPA = window.sleevePApply;
    var d = proj.working.sleeveP;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-p-blocked");
    if (d.presetId !== PRESET_P) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.flareRatio)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true || d.meta.checks.piecesOverlap !== false)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SPA || !window.designSleeveP) fails.push("no-module");
      else {
        var r = SPA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-p-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-p-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_P, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsP(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, flareRatio: p.flareRatio }; }
  // ── 소매 Ⓜ 분기(P.46 하단 반소매 퍼프, bunka-sleeve-M) — Ⓛ 와 같은 결. 입력 = 소매길이(기본 20) · 위팔 둘레(기본 26) · 소매산 상승(기본 0.5). 앞/뒤 분할 = geometry.capSplit(중심선). ──
  var PRESET_M = "bunka-sleeve-M";
  var M_ORIGIN = { kind: "preset", presetId: PRESET_M, method: "short-puff-center-parallel-plus-two-cap-pivot-slashes-from-sleeve-A", methodPage: 46 };
  function checkM(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SMA = window.sleeveMApply;
    var d = proj.working.sleeveM;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-m-blocked");
    if (d.presetId !== PRESET_M) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.upperArmCm) || !fin(pp.riseCm)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true || d.meta.checks.piecesOverlap !== false)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SMA || !window.designSleeveM) fails.push("no-module");
      else {
        var r = SMA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-m-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-m-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_M, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsM(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, upperArmCm: p.upperArmCm, riseCm: p.riseCm }; }
  // ── 소매 Ⓛ 분기(P.46 반소매 퍼프, bunka-sleeve-L) — Ⓘ 와 같은 결. 입력 = 소매길이(기본 20) · 위팔 둘레(기본 26). 앞/뒤 분할 = geometry.capSplit(중심선). ──
  var PRESET_L = "bunka-sleeve-L";
  var L_ORIGIN = { kind: "preset", presetId: PRESET_L, method: "short-puff-cap-pivot-slash-from-sleeve-A", methodPage: 46 };
  function checkL(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SLA = window.sleeveLApply;
    var d = proj.working.sleeveL;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-l-blocked");
    if (d.presetId !== PRESET_L) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.upperArmCm)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SLA || !window.designSleeveL) fails.push("no-module");
      else {
        var r = SLA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-l-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-l-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_L, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsL(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, upperArmCm: p.upperArmCm }; }
  var PRESET_K = "bunka-sleeve-K";
  var K_ORIGIN = { kind: "preset", presetId: PRESET_K, method: "puff-center-parallel-plus-cap-pivot-slash-from-sleeve-A", methodPage: 45 };
  function checkK(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SKA = window.sleeveKApply;
    var d = proj.working.sleeveK;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-k-blocked");
    if (d.presetId !== PRESET_K) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.palmCircumferenceCm) || !(pp.riseCm == null || fin(pp.riseCm))) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SKA || !window.designSleeveK) fails.push("no-module");
      else {
        var r = SKA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-k-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준(없어지면 옛 규칙으로 재게 된다)
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-k-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_K, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsK(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, palmCircumferenceCm: p.palmCircumferenceCm, riseCm: p.riseCm }; }
  var PRESET_J = "bunka-sleeve-J";
  var J_ORIGIN = { kind: "preset", presetId: PRESET_J, method: "puff-center-parallel-spread-from-sleeve-A", methodPage: 45 };
  function checkJ(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SJA = window.sleeveJApply;
    var d = proj.working.sleeveJ;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-j-blocked");
    if (d.presetId !== PRESET_J) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.palmCircumferenceCm) || !(pp.riseCm == null || fin(pp.riseCm))) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SJA || !window.designSleeveJ) fails.push("no-module");
      else {
        var r = SJA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-j-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || JSON.stringify(r.geometry.capSplit) !== JSON.stringify(geom.capSplit)   // capSplit = 앞/뒤 계측 분할 기준(없어지면 옛 규칙으로 재게 된다)
          || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-j-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_J, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsJ(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, palmCircumferenceCm: p.palmCircumferenceCm, riseCm: p.riseCm }; }
  var PRESET_I = "bunka-sleeve-I";
  var I_ORIGIN = { kind: "preset", presetId: PRESET_I, method: "puff-cap-pivot-slash-from-sleeve-A", methodPage: 44 };
  function checkI(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, SIA = window.sleeveIApply;
    var d = proj.working.sleeveI;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-i-blocked");
    if (d.presetId !== PRESET_I) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var pp = d.parameters || {}, len = pp.sleeveLengthCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(pp.palmCircumferenceCm)) fails.push("invalid-input");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = (geom && DS) ? DS.capPrimitives(geom) : null;
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SIA || !window.designSleeveI) fails.push("no-module");
      else {
        var r = SIA.draft(proj, pp);
        if (!r.ok) fails.push("sleeve-i-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-i-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_I, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsI(d) { var p = d.parameters; return { sleeveLengthCm: p.sleeveLengthCm, palmCircumferenceCm: p.palmCircumferenceCm }; }
  // ── 소매 Ⓕ 분기(P.43 턱트 슬리브, bunka-sleeve-F) — Ⓔ 와 같은 결 + 입력 턱 분량. ★ 소매산 길이·이세 = **턱을 접은(봉제 후) 길이**(김님 ③):
  //   designSleeveF.capLengthsOf 가 최종 geometry 의 재단선에서 쐐기 입구(접혀 들어가는 두 겹)를 빼고 잰다. 재단선(펼침) 길이는 cutLengths 로 따로 남긴다.
  //   designSleeve.capPrimitives 는 쓰지 않는다 — 쐐기 위 «산 모양» 재단선이 SP 보다 높아질 수 있어(턱 >2cm) «가장 높은 앵커 = SP» 가정이 맞지 않는다.
  var PRESET_F = "bunka-sleeve-F";
  var F_ORIGIN = { kind: "preset", presetId: PRESET_F, method: "tuck-parallel-slash-from-sleeve-A", methodPage: 43 };
  function primF(geom) {
    var SF = window.designSleeveF; if (!SF || !geom) return null;
    var lens = SF.capLengthsOf(geom); if (!lens) return null;
    var capS = geom.outline.filter(function (x) { return x.role === "cap" && x.kind === "path"; })[0];
    var cmds = capS.commands, k = lens.splitIndex;   // cmds[0] = M, cmds[i] = i 번째 cubic(끝점 = anchor i)
    var back = { kind: "path", commands: [clone(cmds[0])].concat(clone(cmds.slice(1, k + 1))) };
    var front = { kind: "path", commands: [{ type: "M", points: [clone(cmds[k].points[cmds[k].points.length - 1])] }].concat(clone(cmds.slice(k + 1))) };
    return { frontPrimitives: [front], backPrimitives: [back], splitPoint: clone(lens.split), lengths: lens.sewn, cutLengths: lens.cut };
  }
  function checkF(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, SFA = window.sleeveFApply;
    var d = proj.working.sleeveF;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-f-blocked");
    if (d.presetId !== PRESET_F) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = d.parameters && d.parameters.sleeveLengthCm, tk = d.parameters && d.parameters.tuckCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(tk) || !(tk > 0) || tk > 3) fails.push("invalid-tuck");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = primF(geom);
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SFA || !window.designSleeveF) fails.push("no-module");
      else {
        var r = SFA.draft(proj, len, tk);
        if (!r.ok) fails.push("sleeve-f-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-f-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_F, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsF(d) { return { sleeveLengthCm: d.parameters.sleeveLengthCm, tuckCm: d.parameters.tuckCm }; }
  // ── 소매 Ⓖ 분기(P.43 하단, bunka-sleeve-G) — Ⓕ 와 같은 결 + 입력 ★(가운데 상승). ★ 소매산 길이·이세 = **턱을 접은(봉제 후) 길이**(김님 ③):
  //   designSleeveF.capLengthsOf 가 최종 geometry 의 재단선에서 쐐기 입구(접혀 들어가는 두 겹)를 빼고 잰다. 재단선(펼침) 길이는 cutLengths 로 따로 남긴다.
  //   designSleeve.capPrimitives 는 쓰지 않는다(Ⓕ 와 같은 이유 — 분할 = SP′ 를 construction 에서 읽는다).
  var PRESET_G = "bunka-sleeve-G";
  var G_ORIGIN = { kind: "preset", presetId: PRESET_G, method: "tuck-cap-half-slash-from-sleeve-A", methodPage: 43 };
  function primG(geom) {
    var SG = window.designSleeveG; if (!SG || !geom) return null;
    var lens = SG.capLengthsOf(geom); if (!lens) return null;
    var capS = geom.outline.filter(function (x) { return x.role === "cap" && x.kind === "path"; })[0];
    var cmds = capS.commands, k = lens.splitIndex;   // cmds[0] = M, cmds[i] = i 번째 cubic(끝점 = anchor i)
    var back = { kind: "path", commands: [clone(cmds[0])].concat(clone(cmds.slice(1, k + 1))) };
    var front = { kind: "path", commands: [{ type: "M", points: [clone(cmds[k].points[cmds[k].points.length - 1])] }].concat(clone(cmds.slice(k + 1))) };
    return { frontPrimitives: [front], backPrimitives: [back], splitPoint: clone(lens.split), lengths: lens.sewn, cutLengths: lens.cut };
  }
  function checkG(proj) {
    var fails = [];
    var BC = window.bodiceCheckpoint, SGA = window.sleeveGApply;
    var d = proj.working.sleeveG;
    var bodice = BC && BC.latest(proj);
    if (!bodice) fails.push("no-bodice");
    else if (BC.isCurrentBodiceChanged(proj)) fails.push("bodice-stale");
    if (d.blocked) fails.push("sleeve-g-blocked");
    if (d.presetId !== PRESET_G) fails.push("sleeve-preset-unsupported");
    if (bodice && d.sourceBodiceHash !== bodice.hash) fails.push("source-mismatch");
    var len = d.parameters && d.parameters.sleeveLengthCm, tk = d.parameters && d.parameters.tuckCm, st = d.parameters && d.parameters.starCm;
    if (!fin(len) || !(len > 0)) fails.push("invalid-sleeve-length");
    if (!fin(tk) || !(tk > 0) || tk > 2) fails.push("invalid-tuck");
    if (!fin(st) || !(st > 0)) fails.push("invalid-star");
    var geom = proj.working.geometry && proj.working.geometry.sleeve;
    var prim = primG(geom);
    if (!prim) fails.push("cap-unmeasured");
    if (prim && d.meta && d.meta.checks && (d.meta.checks.selfIntersection !== false || d.meta.checks.singlePiece !== true)) fails.push("self-intersection");
    if (!fails.length) {
      if (!SGA || !window.designSleeveG) fails.push("no-module");
      else {
        var r = SGA.draft(proj, len, tk, st);
        if (!r.ok) fails.push("sleeve-g-redraft-failed");
        else if (JSON.stringify(canonGeom(r.geometry)) !== JSON.stringify(canonGeom(geom)) || JSON.stringify(r.meta) !== JSON.stringify(d.meta)
          || JSON.stringify(r.geometry.construction) !== JSON.stringify(geom.construction) || r.sourceSleeveAHash !== d.sourceSleeveAHash) fails.push("sleeve-g-geometry-mismatch");
      }
    }
    var ease = null;
    if (prim && bodice) {
      var fe = prim.lengths.front - (sewnAH(bodice) || {}).front, be = prim.lengths.back - (sewnAH(bodice) || {}).back;
      if (!(fin(fe) && fin(be))) fails.push("ease-unmeasured");
      else ease = { front: fe, back: be, total: fe + be };
    }
    return { ok: fails.length === 0, fails: fails, capLengths: prim ? prim.lengths : null, ease: ease,
      lower: null, cap: null, mode: "preset", preset: PRESET_G, _prim: prim, _bodice: bodice, _a: d };
  }
  function inputsG(d) { return { sleeveLengthCm: d.parameters.sleeveLengthCm, tuckCm: d.parameters.tuckCm, starCm: d.parameters.starCm }; }
  function inputsC(c) { return { sleeveLengthCm: c.parameters.sleeveLengthCm, elbowLengthCm: c.parameters.elbowLengthCm }; }
  function inputsB(b) { return { sleeveLengthCm: b.parameters.sleeveLengthCm, palmCircumferenceCm: b.parameters.palmCircumferenceCm === undefined ? null : b.parameters.palmCircumferenceCm }; }

  // 완료본 hash 용 signature(형상 전용: geometry·parameters·cap.mode·capLengths·sourceBodiceHash.
  //   completedAt·layout·선택·snap 제외).
  function signature(sleeveResult) {
    if (sleeveResult.origin) {   // 소매 Ⓐ: 출처·입력·형상·cap 길이·몸판 hash(기본 소매의 parameters 는 없다)
      var sig = { g: canonGeom(sleeveResult.geometry), o: sleeveResult.origin.presetId, i: sleeveResult.inputs,
        m: sleeveResult.cap.mode, l: sleeveResult.cap.lengths, sbh: sleeveResult.sourceBodiceHash };
      if (sleeveResult.derivedBodice) sig.db = ["back", "front"].map(function (pc) { return canonGeom(sleeveResult.derivedBodice[pc]); });   // 돌먼 Ⓡ: 파생 몸판 형상도 서명(다른 완료본은 필드 없음 — hash 불변)
      return JSON.stringify(sig);
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
    if (proj.working.sleeveR) return completeR(proj, c);
    if (proj.working.sleeveQ) return completeQ(proj, c);
    if (proj.working.sleeveP) return completeP(proj, c);
    if (proj.working.sleeveO) return completeO(proj, c);
    if (proj.working.sleeveN) return completeN(proj, c);
    if (proj.working.sleeveM) return completeM(proj, c);
    if (proj.working.sleeveL) return completeL(proj, c);
    if (proj.working.sleeveK) return completeK(proj, c);
    if (proj.working.sleeveJ) return completeJ(proj, c);
    if (proj.working.sleeveI) return completeI(proj, c);
    if (proj.working.sleeveH) return completeH(proj, c);
    if (proj.working.sleeveG) return completeG(proj, c);
    if (proj.working.sleeveF) return completeF(proj, c);
    if (proj.working.sleeveE) return completeE(proj, c);
    if (proj.working.sleeveD) return completeD(proj, c);
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

  function completeD(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(D_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsD(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeE(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(E_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsE(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeH(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(H_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsH(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeO(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {}, cap = capBlock(c);
    cap.lengthBasis = "턱을 접은(봉제) 소매산 — 이세 기준";
    cap.cutLengths = { front: round4(c._prim.cutLengths.front), back: round4(c._prim.cutLengths.back), total: round4(c._prim.cutLengths.total) };
    var result = {
      schemaVersion: 1,
      origin: clone(O_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsO(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: cap,
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeN(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(N_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsN(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeR(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(R_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsR(dd),
      geometry: clone(proj.working.geometry.sleeve),
      derivedBodice: clone(dd.derivedBodice),   // 돌먼 파생 몸판(앞·뒤 외곽) — 이 완료본 소유 · bodiceResult 무변경
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeQ(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(Q_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsQ(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }  function completeM(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(M_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsM(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }  function completeP(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(P_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsP(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }  function completeM(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(M_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsM(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeL(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(L_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsL(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeK(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(K_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsK(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeI(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(I_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsI(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeJ(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(J_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsJ(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }
  function completeI(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {};
    var result = {
      schemaVersion: 1,
      origin: clone(I_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsI(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: capBlock(c),
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeF(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {}, cap = capBlock(c);
    cap.lengthBasis = "턱을 접은(봉제 후) 소매산 — 이세 기준(김님 확정)";
    cap.cutLengths = { front: round4(c._prim.cutLengths.front), back: round4(c._prim.cutLengths.back), total: round4(c._prim.cutLengths.total) };
    var result = {
      schemaVersion: 1,
      origin: clone(F_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsF(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: cap,
      completedAt: Date.now()
    };
    result.hash = hashStr(signature(result));
    deepFreeze(result);
    proj.working.sleeveResult = result;
    return { ok: true, result: result, check: c };
  }

  function completeG(proj, c) {
    var dd = c._a, sb = proj.sourceBlock || {}, cap = capBlock(c);
    cap.lengthBasis = "턱을 접은(봉제 후) 소매산 — 이세 기준(김님 확정)";
    cap.cutLengths = { front: round4(c._prim.cutLengths.front), back: round4(c._prim.cutLengths.back), total: round4(c._prim.cutLengths.total) };
    var result = {
      schemaVersion: 1,
      origin: clone(G_ORIGIN),
      sourceBodiceHash: dd.sourceBodiceHash,
      sourceSleeveAHash: dd.sourceSleeveAHash,
      sourceBlock: { id: sb.id || null, version: sb.version != null ? sb.version : null, canonicalHash: sb.canonicalHash || null },
      inputs: inputsG(dd),
      geometry: clone(proj.working.geometry.sleeve),
      meta: clone(dd.meta), warnings: dd.warnings.slice(),
      cap: cap,
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
    if (proj.working.sleeveR) {   // 소매 Ⓡ: 같은 signature 형식 + 파생 몸판
      return signature({ origin: R_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsR(c._a), derivedBodice: c._a.derivedBodice,
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveQ) {   // 소매 Ⓠ: 같은 signature 형식(입력 = 높이 비율)
      return signature({ origin: Q_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsQ(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveP) {   // 소매 Ⓟ: 같은 signature 형식(입력 = 소매길이·플레어 계수)
      return signature({ origin: P_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsP(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveO) {   // 소매 Ⓞ: 같은 signature 형식(입력 = 소매길이·절개·간격·벌림·박기 끝 · 소매산 = 턱 접은 길이)
      return signature({ origin: O_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsO(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveN) {   // 소매 Ⓝ: 같은 signature 형식(입력 = 소매길이·절개 위치·벌림·박기 끝)
      return signature({ origin: N_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsN(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveM) {   // 소매 Ⓜ: 같은 signature 형식(입력 = 소매길이·위팔 둘레·상승)
      return signature({ origin: M_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsM(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveL) {   // 소매 Ⓛ: 같은 signature 형식(입력 = 소매길이·위팔 둘레)
      return signature({ origin: L_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsL(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveK) {   // 소매 Ⓚ: 같은 signature 형식(입력 = 소매길이·손바닥·상승)
      return signature({ origin: K_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsK(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveJ) {   // 소매 Ⓙ: 같은 signature 형식(입력 = 소매길이·손바닥·상승)
      return signature({ origin: J_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsJ(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveI) {   // 소매 Ⓘ: 같은 signature 형식(입력 = 소매길이·손바닥)
      return signature({ origin: I_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsI(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveH) {   // 소매 Ⓗ: 같은 signature 형식(입력 = 소매길이·EL·손바닥·★)
      return signature({ origin: H_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsH(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveG) {   // 소매 Ⓖ: 같은 signature 형식(입력 = 소매길이·턱·★ — 어느 것이 바뀌어도 «변경»)
      return signature({ origin: G_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsG(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveF) {   // 소매 Ⓕ: 같은 signature 형식(입력 = 소매길이·턱 분량 — 턱 분량 변경도 «변경»)
      return signature({ origin: F_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsF(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveE) {   // 소매 Ⓔ: 같은 signature 형식(입력 = 소매길이)
      return signature({ origin: E_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsE(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
    if (proj.working.sleeveD) {   // 소매 Ⓓ: 같은 signature 형식(입력 = 소매길이)
      return signature({ origin: D_ORIGIN, sourceBodiceHash: c._a.sourceBodiceHash, inputs: inputsD(c._a),
        geometry: proj.working.geometry.sleeve, cap: { mode: "preset", lengths: { front: round4(c._prim.lengths.front), back: round4(c._prim.lengths.back), total: round4(c._prim.lengths.total) } } }) !== signature(res);
    }
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
