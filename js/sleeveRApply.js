// ══════════════════════════════════════════════
// sleeveRApply.js — 소매 Ⓡ(designSleeveR, P.49 돌먼 «몸판에 직접 제도»)를 design 프로젝트 상태에 연결한다. 시안(2026-10-27).
// DOM·storage 미접근(ui.js 가 호출). 입력 = 책 수치 설정값 10개(전부 기본값 있음 · 팔꿈치 둘레 기본 22).
// ★ 출발 = 완료 몸판(bodiceResult, 읽기 전용) — 몸판 Ⓐ 인지 형상으로 확인한다(같은 원형에서 계산한 Ⓐ 와 비교). 소매 Ⓐ 는 쓰지 않는다.
// ★ 소유권: 파생 몸판(앞·뒤 외곽)과 한 장 소매는 working.sleeveR 이 들고 있다. working.geometry.front/back · bodiceResult 는 바꾸지 않는다.
//   working.geometry.sleeve 에는 다른 소매 라인처럼 한 장 소매만 미러링한다(소매 피스 그리기·계측용).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-R";
  var BODICE_A = "bunka-bodice-A";
  var KEYS = ["shoulderExtCm", "backSideEaseCm", "frontSideEaseCm", "capHeightCm", "sleeveLengthCm", "elbowGirthCm", "cuffAddCm", "hemDropCm", "armholeHandle", "capHandle"];
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "width-line": 1, "cuff-guide": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-bodice": "완료된 몸판이 없습니다",
    "bodice-not-a": "Ⓡ 은 몸판 Ⓐ(교재 A 기본 패턴, 여밈·페플럼·이음선 없음)에서만 제도합니다 — 현재 완료 몸판의 형상이 Ⓐ 와 다릅니다",
    "bodice-a-reference-missing": "몸판 Ⓐ 비교 형상을 만들 수 없음",
    "bodice-read-failed": "몸판 형상을 읽을 수 없음",
    "back-shoulder-dart-not-found": "뒤 어깨 다트를 찾지 못함",
    "invalid-input": "입력 값을 확인하세요(숫자)",
    "input-out-of-range": "입력 범위를 확인하세요(어깨 연장·소매 폭선 위치·팔꿈치 둘레 > 0, 소매 길이 > 소매 폭선 위치, 나머지 ≥ 0)",
    "handle-out-of-range": "곡선 부푼 정도(핸들 계수)는 0.2 ~ 0.6 사이만 입력할 수 있습니다",
    "underarm-point-not-found": "소매 밑점을 정할 수 없습니다 — 몸판 진동과 소매산이 교차하지 않습니다(곡선 부푼 정도를 확인하세요)",
    "underarm-point-not-unique": "소매 밑점이 하나로 정해지지 않습니다(교차 · 길이 같음 해가 여럿)",
    "underarm-length-unmatched": "교차점 아래 봉제 길이를 맞추지 못함(수치)",
    "underarm-line-invalid": "소매 밑선이 소맷부리 쪽으로 가지 않습니다(입력 확인)",
    "cuff-corner-conflict": "소맷부리를 굽이 하나로 그릴 수 없습니다 — E 의 중심선 직각과 C 의 밑선 직각 두 직선이 두 끝 앞쪽에서 만나지 않습니다(소맷부리 아래 · 소매 밑선 입력 확인)",
    "center-butt-mismatch": "앞뒤 소매 중심선이 맞닿지 않음(기하)",
    "bodice-self-intersection": "파생 몸판 외곽이 자기 교차함(기하)",
    "self-intersection": "한 장 소매 외곽이 자기 교차함(기하)",
    "discontinuous": "외곽이 끊김",
    "no-module": "소매 Ⓡ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) { return !r ? "" : (REASONS[r.reason] || ("소매 Ⓡ 를 만들 수 없음(" + r.reason + ")")); }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveR); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveR && w.sleeveR.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }
  // 게이트 비교용 몸판 Ⓐ 형상: 같은 원형(referenceGeometry)에서 Ⓐ 프리셋 매개변수로 계산(읽기 전용 · 상태 변경 없음).
  function bodiceAGeometry(project) {
    var DB = window.designBodice, BP = window.bodicePresets;
    if (!DB || !BP || !project || !project.referenceGeometry) return null;
    var params = BP.bodyParams(BODICE_A); if (!params) return null;
    return DB.computeGeometry(project.referenceGeometry, { body: params });
  }
  function paramsOf(x) { var o = {}; KEYS.forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SR = window.designSleeveR, BC = window.bodiceCheckpoint;
    if (!SR || !BC || !window.designSleeveA) return fail({ reason: "no-module" });
    var bodice = BC.latest(project); if (!bodice) return fail({ reason: "no-bodice" });
    var d = SR.draftSleeveR(bodice, bodiceAGeometry(project), p);
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), derivedBodice: d.derivedBodice, meta: d.meta, warnings: d.warnings, sourceBodiceHash: d.sourceBodiceHash };
  }
  function derivedHash(r) { return hashOf({ b: r.derivedBodice, s: r.geometry.outline }); }   // 파생 몸판 + 한 장 소매 형상(완료본 signature 에 들어간다)
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function stateOf(r) {   // 매개변수 = 엔진이 실제로 쓴 값(빈 칸 → 책 기본값으로 해석된 값) — 완료본 signature·다시 제도가 같은 값을 쓴다
    var used = r.meta.settings.inputs, p = {}; KEYS.forEach(function (k) { p[k] = used[k]; });
    return { presetId: PRESET_ID, bodicePresetId: BODICE_A, sourceBodiceHash: r.sourceBodiceHash, parameters: p, meta: clone(r.meta),
      derivedBodice: clone(r.derivedBodice), derivedHash: derivedHash(r), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) return fail({ reason: "no-project" });
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveR = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveR };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveR) return false;
    w.sleeveR.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveR) return { ok: true, active: false };
    var p = w.sleeveR.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveR.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveR = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveR };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveR = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveR; if (!s) return [];
    var lines = ["돌먼 Ⓡ (화면 검토용 시안) · 몸판 Ⓐ 에 직접 제도 — 파생 몸판 + 한 장 소매 (P.49 · 팔꿈치 둘레 기본 P.8)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, p = m.settings.inputs, b = m.back, f = m.front;
    lines.push("설정: 어깨 연장 " + f2(p.shoulderExtCm) + " · 옆 여유 뒤 " + f2(p.backSideEaseCm) + " / 앞 " + f2(p.frontSideEaseCm) + " · 소매 폭선(새 SP 에서) " + f2(p.capHeightCm) + " · 소매 길이 " + f2(p.sleeveLengthCm) + " · 팔꿈치 둘레 " + f2(p.elbowGirthCm) + " + " + f2(p.cuffAddCm) + " · 소맷부리 아래 " + f2(p.hemDropCm) + " · 곡선 핸들 진동 " + f2(p.armholeHandle) + " / 소매산 " + f2(p.capHandle));
    lines.push("소매 밑점(소매 폭선 위 · 교차점 아래 같은 길이): 뒤 폭선 " + f2(b.widthLineCm) + " · 앞 " + f2(f.widthLineCm) + " cm → 소매 폭 " + f2(m.widthCm) + " cm · 교차점 아래 진동/소매산 뒤 " + f2(b.lower.armholeLowerCm) + "/" + f2(b.lower.capLowerCm) + " · 앞 " + f2(f.lower.armholeLowerCm) + "/" + f2(f.lower.capLowerCm));
    lines.push("새 몸판 진동 뒤 " + f2(m.armhole.back) + " · 앞 " + f2(m.armhole.front) + " · 소매산 뒤 " + f2(m.cap.back) + " · 앞 " + f2(m.cap.front) + " cm · 결과 이세(강제 아님) 뒤 " + sgn(m.ease.back) + " · 앞 " + sgn(m.ease.front) + " · 합 " + sgn(m.ease.total));
    lines.push("소맷부리: 직선 기준 ● " + f2(m.cuff.attachCm) + " × 2 = 식 " + f2(m.cuff.formulaHemCm) + " · 최종 곡선 실측 " + f2(m.cuff.measuredHemCm) + " · 커프스 달림 " + f2(m.cuff.attachCm) + " · 개더 참고(책 1배) " + f2(m.cuff.gatherReferenceCm) + " · 실제 개더 " + f2(m.cuff.gatherActualCm) + " cm");
    lines.push("솔기 실측(맞춤 강제 없음): 소매 밑선 뒤 " + f2(m.seams.underarm.back) + " · 앞 " + f2(m.seams.underarm.front) + " (차 " + sgn(m.seams.underarm.diffCm) + ") · 몸판 어깨 뒤 " + f2(m.seams.shoulder.back) + " · 앞 " + f2(m.seams.shoulder.front) + " (차 " + sgn(m.seams.shoulder.diffCm) + ") · 옆선 " + f2(m.seams.side.back) + " / " + f2(m.seams.side.front));
    lines.push("앞 AH 다트 박지 않음(새 진동 안쪽 여유) · 뒤 어깨 다트 닫고 진동 쪽 벌림 · 원본 몸판 완료본 무변경 · 미확인: " + m.unconfirmed.join(" / "));
    return lines;
  }

  window.sleeveRApply = Object.freeze({ PRESET_ID: PRESET_ID, KEYS: KEYS, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText, bodiceAGeometry: bodiceAGeometry });
})();
