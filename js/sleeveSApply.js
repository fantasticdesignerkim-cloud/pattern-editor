// ══════════════════════════════════════════════
// sleeveSApply.js — 소매 Ⓢ(designSleeveS, P.49 하단 «Ⓡ 방법 + 소매 중심에 개더 분량 추가»)를 design 프로젝트 상태에 연결한다. 시안(2026-10-28).
// DOM·storage 미접근(ui.js 가 호출). 입력 = Ⓡ 설정값 10개 + 총 벌림 G(기본 12) + 띠 바깥 소매산 개더 범위(각, 기본 6).
// ★ 출처: 같은 완료 몸판에서 Ⓡ 를 **읽기 전용으로 다시 제도**(sleeveRApply.draft — 상태 변경 없음)한 결과만 쓴다.
//   working.sleeveR 를 만들거나 고치지 않는다(Ⓢ 가 Ⓡ 인 척하지 않음). Ⓡ 의 몸판 Ⓐ 형상 게이트·거부 사유·잠정 곡선 설정을 그대로 이어받는다.
// ★ 소유권: 파생 몸판(앞·뒤)과 한 장 소매는 working.sleeveS 가 들고 있다. working.geometry.front/back · bodiceResult 무변경.
//   working.geometry.sleeve 에는 다른 소매 라인처럼 한 장 소매만 미러링한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-S";
  var BODICE_A = "bunka-bodice-A";
  var S_KEYS = ["spreadCm", "capGatherSideCm"];
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "width-line": 1, "cuff-guide": 1, "old-center-back": 1, "old-center-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }
  function rKeys() { return window.sleeveRApply ? window.sleeveRApply.KEYS.slice() : []; }
  function keys() { return rKeys().concat(S_KEYS); }

  var REASONS = {
    "invalid-input": "입력 값을 확인하세요(숫자)",
    "input-out-of-range": "총 벌림·띠 바깥 개더 범위는 0 이상만 입력할 수 있습니다",
    "gather-zone-too-long": "띠 바깥 개더 범위가 반쪽 소매산(새 SP → 소매 밑점) 길이보다 깁니다",
    "no-r-draft": "Ⓡ 제도 결과가 없음",
    "r-geometry-unreadable": "Ⓡ 한 장 소매 형상을 읽을 수 없음",
    "discontinuous": "외곽이 끊김",
    "self-intersection": "한 장 소매 외곽이 자기 교차함(기하)",
    "no-module": "소매 Ⓢ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) {
    if (!r) return "";
    if (REASONS[r.reason]) return REASONS[r.reason];
    var RA = window.sleeveRApply, t = RA && RA.failText ? RA.failText(r) : "";   // Ⓡ 단계 거부(몸판 Ⓐ 아님 · 큰 둘레 충돌 등)는 Ⓡ 사유 그대로
    return t ? "Ⓡ 단계: " + t : ("소매 Ⓢ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveS); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveS && w.sleeveS.blocked); }
  function displayGeometry(g) { var o = clone(g); o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; }); return o; }
  function paramsOf(x) { var o = {}; keys().forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 제도: Ⓡ(같은 몸판·Ⓡ 입력) → Ⓢ. 상태 변경 없음.
  function draft(project, p) {
    var RA = window.sleeveRApply, SS = window.designSleeveS;
    if (!RA || !SS) return fail({ reason: "no-module" });
    var rp = {}; rKeys().forEach(function (k) { rp[k] = p ? p[k] : undefined; });
    var r = RA.draft(project, rp);
    if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail, text: failText(r), stage: "R" };
    var d = SS.draftSleeveS(r, { spreadCm: p ? p.spreadCm : undefined, capGatherSideCm: p ? p.capGatherSideCm : undefined });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), derivedBodice: d.derivedBodice, meta: d.meta, rMeta: d.rMeta, warnings: d.warnings, sourceBodiceHash: d.sourceBodiceHash };
  }
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function stateOf(r) {   // 매개변수 = 실제로 쓴 값(빈 칸 → 책 기본값으로 해석된 값)
    var p = {}, ri = r.rMeta.settings.inputs, si = r.meta.settings.inputs;
    rKeys().forEach(function (k) { p[k] = ri[k]; }); S_KEYS.forEach(function (k) { p[k] = si[k]; });
    return { presetId: PRESET_ID, bodicePresetId: BODICE_A, sourceBodiceHash: r.sourceBodiceHash, parameters: p, meta: clone(r.meta), rMeta: clone(r.rMeta),
      derivedBodice: clone(r.derivedBodice), derivedHash: hashOf({ b: r.derivedBodice, s: r.geometry.outline }), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) return fail({ reason: "no-project" });
    var r = draft(project, paramsOf(params));
    if (!r.ok) return r;
    w.sleeveS = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveS };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveS) return false;
    w.sleeveS.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveS) return { ok: true, active: false };
    var r = draft(project, w.sleeveS.parameters);
    if (!r.ok) { w.sleeveS.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveS = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveS };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveS = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveS; if (!s) return [];
    var lines = ["돌먼 Ⓢ (화면 검토용 시안) · Ⓡ 한 장 소매를 중심선에서 나눠 평행으로 벌리고 가운데 개더 띠 추가 (P.49 하단)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, g = m.gather.cap;
    lines.push("총 벌림 G " + f2(m.spreadCm) + " (뒤 −" + f2(m.halfShiftCm) + " · 앞 +" + f2(m.halfShiftCm) + " 평행 이동 · 회전·상승 없음) · 소매 폭 " + f2(m.widthCm));
    lines.push("소매산 개더 구간 " + f2(g.zoneCm) + " = 띠 " + f2(g.addedCm) + " + 띠 바깥 양쪽 각 " + f2(g.sideCm) + "(봉제선 호 길이) · 소맷부리는 전체 둘레 개더");
    lines.push("소매산 뒤 " + f2(m.cap.back) + " · 앞 " + f2(m.cap.front) + " / 새 몸판 진동 " + f2(m.armhole.total) + " → 결과 차 " + sgn(m.ease.total) + " = Ⓡ 기본 이세 " + sgn(m.ease.baseRCm) + " + 추가 개더 " + f2(m.ease.addedGatherCm));
    lines.push("소맷부리: 커프스 달림 ● " + f2(m.cuff.attachCm) + " · 직선 산식 2● + G = " + f2(m.cuff.formulaHemCm) + " · 곡선 실측 " + f2(m.cuff.measuredHemCm) + " (Ⓡ " + f2(m.cuff.rMeasuredHemCm) + " + " + f2(m.spreadCm) + ") · 실제 개더 " + f2(m.cuff.gatherActualCm));
    lines.push("소매 밑선 뒤 " + f2(m.seams.underarm.back) + " · 앞 " + f2(m.seams.underarm.front) + " · 몸판 = Ⓡ 파생 몸판 그대로 · 원래 반쪽 = 강체 평행 이동 · 미확인(Ⓡ 계승): " + m.unconfirmed.join(" / "));
    return lines;
  }

  window.sleeveSApply = Object.freeze({ PRESET_ID: PRESET_ID, S_KEYS: S_KEYS, keys: keys, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
