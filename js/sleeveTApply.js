// ══════════════════════════════════════════════
// sleeveTApply.js — 소매 Ⓣ(designSleeveT, P.50 셔츠 슬리브 «몸판에 직접 제도»)를 design 프로젝트 상태에 연결한다. 시안(2026-10-28).
// DOM·storage 미접근(ui.js 가 호출). 입력 = 소매 길이(공용 소매길이 칸 · 기본값 없음) + 책 수치 설정값 8개 + 구현 관례 3개(★ 위치).
// ★ 출발 = 완료 몸판(bodiceResult, 읽기 전용) — 몸판 Ⓐ 인지 형상으로 확인한다(Ⓡ 와 같은 게이트 · P.51 «예는 몸판 Ⓐ»). 소매 Ⓐ·Ⓡ 결과는 쓰지 않는다.
// ★ 소유권: 파생 몸판(앞 AH 다트 → 옆 다트 · 뒤 그대로)과 한 장 소매는 working.sleeveT 가 들고 있다. working.geometry.front/back · bodiceResult 무변경.
//   working.geometry.sleeve 에는 다른 소매 라인처럼 한 장 소매만 미러링한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-T";
  var BODICE_A = "bunka-bodice-A";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "width-line": 1, "underarm-guide": 1, "cuff-guide": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }
  function keys() { return window.designSleeveT ? window.designSleeveT.KEYS.slice() : []; }

  var REASONS = {
    "no-bodice": "완료된 몸판이 없습니다",
    "bodice-not-a": "Ⓣ 은 몸판 Ⓐ(교재 A 기본 패턴, 여밈·페플럼·이음선 없음)에서만 제도합니다(P.51 «예는 몸판 Ⓐ») — 현재 완료 몸판의 형상이 Ⓐ 와 다릅니다",
    "bodice-a-reference-missing": "몸판 Ⓐ 비교 형상을 만들 수 없음",
    "bodice-read-failed": "몸판 형상을 읽을 수 없음",
    "front-ah-dart-not-found": "앞 AH 다트를 찾지 못함",
    "front-ah-dart-unclosable": "앞 AH 다트를 닫을 수 없음(입구가 맞지 않음)",
    "side-dart-out-of-range": "옆 다트 위치는 진동 아랫점 아래 0 초과 · 허리선 위만 입력할 수 있습니다",
    "invalid-input": "입력 값을 확인하세요(숫자 · 소매길이 필수)",
    "input-out-of-range": "입력 범위를 확인하세요(경사·직각·비율 > 0 · 소맷부리 비율 ≤ 1 · 소매산 차이 ≥ 0 · ★ 위치 0 < 뒤 < 1, 0 < 앞 ★1 < 앞 ★2 < 1)",
    "sleeve-length-too-short": "소매길이가 소매산 높이(◉)보다 길어야 합니다",
    "underarm-point-not-found": "소매 아랫점을 정할 수 없습니다 — 소매 폭선 위에서 소매산이 진동 둘레와 같은 길이가 되는 점이 없습니다",
    "underarm-point-not-unique": "소매 아랫점이 하나로 정해지지 않습니다(같은 길이 해가 여럿)",
    "cap-length-unmatched": "소매산을 진동 둘레와 같은 길이로 맞추지 못함(수치)",
    "front-cuff-nonpositive": "앞 소맷부리가 0 이하입니다 — 뒤에서 자른 분량 ● 이 앞 소매 폭보다 큽니다(소맷부리 비율 확인)",
    "center-butt-mismatch": "앞뒤 소매 중심선이 맞닿지 않음(기하)",
    "bodice-self-intersection": "파생 몸판 외곽이 자기 교차함(기하)",
    "self-intersection": "한 장 소매 외곽이 자기 교차함(기하)",
    "discontinuous": "외곽이 끊김",
    "no-module": "소매 Ⓣ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) { return !r ? "" : (REASONS[r.reason] || ("소매 Ⓣ 를 만들 수 없음(" + r.reason + ")")); }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveT); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveT && w.sleeveT.blocked); }
  function displayGeometry(g) { var o = clone(g); o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; }); return o; }
  function paramsOf(x) { var o = {}; keys().forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var ST = window.designSleeveT, BC = window.bodiceCheckpoint, RA = window.sleeveRApply;
    if (!ST || !BC || !RA || !window.designSleeveA || !window.designSleeveR) return fail({ reason: "no-module" });
    var bodice = BC.latest(project); if (!bodice) return fail({ reason: "no-bodice" });
    var d = ST.draftSleeveT(bodice, RA.bodiceAGeometry(project), p);
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), derivedBodice: d.derivedBodice, meta: d.meta, warnings: d.warnings, sourceBodiceHash: d.sourceBodiceHash };
  }
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function stateOf(r) {   // 매개변수 = 엔진이 실제로 쓴 값(빈 칸 → 책 기본값으로 해석된 값)
    var used = r.meta.settings.inputs, p = {}; keys().forEach(function (k) { p[k] = used[k]; });
    return { presetId: PRESET_ID, bodicePresetId: BODICE_A, sourceBodiceHash: r.sourceBodiceHash, parameters: p, meta: clone(r.meta),
      derivedBodice: clone(r.derivedBodice), derivedHash: hashOf({ b: r.derivedBodice, s: r.geometry.outline }), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) return fail({ reason: "no-project" });
    var r = draft(project, paramsOf(params));
    if (!r.ok) return r;
    w.sleeveT = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveT };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveT) return false;
    w.sleeveT.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveT) return { ok: true, active: false };
    var r = draft(project, w.sleeveT.parameters);
    if (!r.ok) { w.sleeveT.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveT = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveT };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveT = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveT; if (!s) return [];
    var lines = ["셔츠 슬리브 Ⓣ (화면 검토용 시안) · 몸판 Ⓐ 진동에 직접 제도 — 앞 AH 다트 → 옆 다트 · 한 장 소매 (P.50 · 제도 방법 P.140–141)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, p = m.settings.inputs, b = m.back, f = m.front, ch = m.capHeight;
    lines.push("경사: 어깨선 연장 " + f2(p.slopeRunCm) + " 에서 직각 뒤 " + f2(p.backSlopeDropCm) + " / 앞 " + f2(p.frontSlopeDropCm) + " → 중심선 · 소매길이 " + f2(p.sleeveLengthCm));
    lines.push("소매산 높이 ◉ " + f2(ch.cm) + " = 평균 어깨 길이 " + f2(ch.averageShoulderCm) + " (뒤 " + f2(ch.shoulderHeightsCm.back) + " · 앞 " + f2(ch.shoulderHeightsCm.front) + ", P.137 봉제 상태) × " + f2(ch.ratio));
    lines.push("소매산 = 몸판 진동(여유분 줄임 없음): 뒤 " + f2(m.cap.back) + " = " + f2(m.armhole.back) + " · 앞 " + f2(m.cap.front) + " = " + f2(m.armhole.front) + " · 이세 " + sgn(m.ease.total) + " · 진동과 차이 실측 뒤 바깥 " + f2(b.deviation.maxOutCm) + " · 앞 바깥 " + f2(f.deviation.maxOutCm) + " / 안 " + f2(f.deviation.maxInCm) + " (책 0.7 · 0.5)");
    lines.push("소매 폭 뒤 " + f2(b.widthCm) + " · 앞 " + f2(f.widthCm) + " = " + f2(m.widthCm) + " · 소맷부리 뒤 " + f2(m.cuff.back) + " (뒤 폭 × " + f2(m.cuff.ratio) + ") · ● " + f2(m.cuff.cutCm) + " · 앞 " + f2(m.cuff.front) + " (앞 폭 − ●) = " + f2(m.cuff.totalCm));
    lines.push("소매 밑선 뒤 " + f2(m.seams.underarm.back) + " · 앞 " + f2(m.seams.underarm.front) + " (차 " + sgn(m.seams.underarm.diffCm) + ") · 맞춤 표시 SP 에서 뒤 ‖ " + f2(m.notches.back.sCm) + " · 앞 | " + f2(m.notches.front.sCm) + " · SP 맞닿는 각 " + f2(m.joints.capAtSP) + "°");
    lines.push("앞 AH 다트 → 옆(진동 아랫점 아래 " + f2(m.frontDart.sideDropCm) + ") " + f2(m.frontDart.angleDeg) + "° · 입구 " + f2(m.frontDart.widthCm) + " · 뒤 어깨 다트 그대로 · 원본 몸판 완료본 무변경 · 미확인: " + m.unconfirmed.join(" / "));
    return lines;
  }

  window.sleeveTApply = Object.freeze({ PRESET_ID: PRESET_ID, keys: keys, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
