// ══════════════════════════════════════════════
// sleeveXApply.js — 소매 Ⓧ 기모노 슬리브(designSleeveX, P.54 · 제도 방법 P.144–145 · 닫는다·벌린다 P.161)를 design 프로젝트 상태에 연결한다.
// 2026-11-04 시안(김님 구현 승인 · Q1/Q2 확정 — 제품 완성 승인은 검증 후 별도). DOM·storage 미접근(ui.js 가 호출).
// 입력 = 소매 길이(공용 소매길이 칸 · 기본값 없음) + 책 수치 4개(경사 8 · 직각 뒤 1.6 / 앞 0.7 · 소맷부리 3/4) + 구현 관례 2개(목 다트 위치 45% · SP 다듬기 2cm).
// ★ 출발 = 완료 몸판(bodiceResult, 읽기 전용) — 몸판 Ⓐ 인지 형상으로 확인한다(Ⓥ·Ⓦ 와 같은 게이트). 다른 소매 결과는 쓰지 않는다.
// ★ 소유권: 몸판 일체형 뒤·앞(파생 몸판 — 소매 포함)과 별도 덧천은 working.sleeveX 가 들고 있다. working.geometry.front/back · bodiceResult 무변경.
//   working.geometry.sleeve = 덧천 한 장(소매 달림선이 없으므로 소매산·AH 이세는 적용되지 않는다).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-X";
  var BODICE_A = "bunka-bodice-A";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function f3(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }
  function sgn(v, f) { return (v >= 0 ? "+" : "") + (f || f2)(v); }
  function keys() { return window.designSleeveX ? window.designSleeveX.KEYS.slice() : []; }

  var REASONS = {
    "no-bodice": "완료된 몸판이 없습니다",
    "bodice-not-a": "Ⓧ 는 몸판 Ⓐ(교재 A 기본 패턴, 여밈·페플럼·이음선 없음)에서만 제도합니다(P.55 «아래 예는 몸판 Ⓐ 를 사용») — 현재 완료 몸판의 형상이 Ⓐ 와 다릅니다",
    "bodice-a-reference-missing": "몸판 Ⓐ 비교 형상을 만들 수 없음",
    "bodice-read-failed": "몸판 형상을 읽을 수 없음",
    "back-shoulder-dart-not-found": "뒤 어깨 다트를 찾지 못함",
    "front-ah-dart-not-found": "앞 AH 다트를 찾지 못함",
    "front-ah-dart-unclosable": "앞 AH 다트를 닫을 수 없음(입구가 맞지 않음)",
    "invalid-input": "입력 값을 확인하세요(숫자 · 소매길이 필수)",
    "input-out-of-range": "입력 범위를 확인하세요(소매길이·경사·직각·SP 다듬기 > 0 · 0 < 소맷부리 비율 ≤ 1)",
    "neck-dart-out-of-range": "목 다트 위치는 목둘레의 5% ~ 95% 안에서만 입력할 수 있습니다",
    "underarm-width-nonpositive": "진동 가장 안쪽과 옆선 사이 간격(ø)이 0 이하입니다(몸판 형상 이상)",
    "sleeve-width-nonpositive": "소매 폭(☆)이 0 이하입니다 — 경사·몸판을 확인하세요",
    "elbow-before-underarm": "소매길이가 짧아 팔꿈치(SP–소맷부리 중점)가 겨드랑이 점 Ⓑ·Ⓕ 보다 앞입니다 — 소매길이를 늘리세요",
    "front-cuff-nonpositive": "앞 소맷부리가 0 이하입니다 — 뒤에서 자른 분량 ● 이 앞 소매 폭보다 큽니다",
    "gusset-unclosable": "덧천 네 변(▲ · ※ · ▣ · ▣)이 폭선 ø+ø 위에서 닫히지 않습니다 — 소매길이·경사를 확인하세요",
    "gusset-self-intersection": "덧천 외곽이 스스로 꼬입니다(기하)",
    "fair-too-wide": "SP 다듬기 폭이 어깨선·소매 중심선 길이보다 큽니다",
    "armhole-outside-pattern": "원래 진동 곡선이 새 외곽 밖으로 나갑니다 — 종이가 찢어지는 형상입니다(제1법칙)",
    "self-intersection": "몸판 일체형 외곽이 자기 교차함(제1법칙 — 소매가 몸판을 가로지름)",
    "discontinuous": "외곽이 끊김",
    "no-module": "소매 Ⓧ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) { return !r ? "" : (REASONS[r.reason] || ("소매 Ⓧ 를 만들 수 없음(" + r.reason + ")")); }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveX); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveX && w.sleeveX.blocked); }
  function paramsOf(x) { var o = {}; keys().forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SX = window.designSleeveX, BC = window.bodiceCheckpoint, RA = window.sleeveRApply;
    if (!SX || !BC || !RA || !window.designSleeveA || !window.designSleeveR) return fail({ reason: "no-module" });
    var bodice = BC.latest(project); if (!bodice) return fail({ reason: "no-bodice" });
    var d = SX.draftSleeveX(bodice, RA.bodiceAGeometry(project), p);
    if (!d.ok) return fail(d);
    return { ok: true, geometry: d.geometry, derivedBodice: d.derivedBodice, meta: d.meta, warnings: d.warnings, sourceBodiceHash: d.sourceBodiceHash };
  }
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function stateOf(r) {   // 매개변수 = 엔진이 실제로 쓴 값(빈 칸 → 기본값으로 해석된 값)
    var used = r.meta.settings.inputs, p = {}; keys().forEach(function (k) { p[k] = used[k]; });
    return { presetId: PRESET_ID, bodicePresetId: BODICE_A, sourceBodiceHash: r.sourceBodiceHash, parameters: p, meta: clone(r.meta),
      derivedBodice: clone(r.derivedBodice), derivedHash: hashOf({ b: r.derivedBodice, g: r.geometry.outline }), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) return fail({ reason: "no-project" });
    var r = draft(project, paramsOf(params));
    if (!r.ok) return r;
    w.sleeveX = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveX };
  }
  // 거부: 이전 형상은 그대로 두고 차단 표시만(완료 불가) — 상태·geometry 를 바꾸지 않는다.
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveX) return false;
    w.sleeveX.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveX) return { ok: true, active: false };
    var r = draft(project, w.sleeveX.parameters);
    if (!r.ok) { w.sleeveX.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveX = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveX };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveX = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveX; if (!s) return [];
    var lines = ["기모노 슬리브 Ⓧ (시안) · 소매 붙임선 없이 몸판에서 이어진 소매 + 겨드랑이 별도 덧천 · 앞 AH 다트 → 목둘레(옆 이동 불가) · 뒤 어깨 다트는 열린 채 (P.54 · 제도 방법 P.144–145 · 닫는다·벌린다 P.161)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, p = m.settings.inputs, sc = m.seams, fd = m.frontDart, g = m.gusset, wd = m.widthCm;
    lines.push("경사: 어깨선 연장 " + f2(p.slopeRunCm) + " 에서 직각 뒤 " + f2(p.backSlopeDropCm) + " / 앞 " + f2(p.frontSlopeDropCm) + " → 소매 중심선(소매 윗선) · 소매길이 " + f2(p.sleeveLengthCm) + " (SP 에서 중심선을 따라) · 중심선 기울기 뒤 " + f2(m.slope.backCenterDeg) + "° / 앞 " + f2(180 - m.slope.frontCenterDeg) + "°");
    lines.push("앞 AH 다트 → 목둘레: 닫음 " + f2(fd.angleDeg) + "° (입구 잔차 " + f3(fd.mouthResidualCm) + ") · 목 다트 폭 " + f2(fd.neckDartWidthCm) + " · 다리 " + f3(fd.legCm[0]) + " / " + f3(fd.legCm[1]) + " · 목 SNP 에서 " + f2(fd.positionRatio * 100) + "% (구현 관례) · 앞 어깨 기울기 " + f2(180 - m.slope.frontShoulderBeforeDeg) + "° → " + f2(180 - m.slope.frontShoulderAfterDeg) + "°");
    lines.push("겨드랑이: ★선 ~ 옆선 중점 Ⓑ → ø " + f2(m.phiCm) + " · 앞 Ⓕ = 옆선에서 뒤와 같은 ø · Ⓓ = 옆선 위 BL–WL 중점 · 소매 폭 ☆ 뒤 " + f2(wd.back) + " / 앞 " + f2(wd.front) + " · 소맷부리 뒤 " + f2(m.cuff.back) + " / 앞 " + f2(m.cuff.front) + " (● " + f2(m.cuff.cutCm) + " — 앞도 같은 분량)");
    lines.push("소매 밑선 뒤 " + f3(sc.underarm.back) + " = 앞 " + f3(sc.underarm.front) + " (구성상 같음) · 상부 봉제선(어깨 다트 닫음 + SP 곡선 + 중심선) 뒤 " + f3(sc.top.back) + " / 앞 " + f3(sc.top.front) + " (차 " + sgn(sc.top.back - sc.top.front, f3) + " — 기록만, 보정 없음) · 옆선 Ⓓ→WL " + f3(sc.sideSeam.back) + " / " + f3(sc.sideSeam.front));
    lines.push("덧천 맞춤: ① 뒤 몸판쪽 ▣ " + f3(sc.notch.back.bodyEdge) + " = 덧천 " + f3(sc.gusset.backBody) + " · ② 뒤 소매쪽 ▲ " + f3(sc.notch.back.sleeveEdge) + " = " + f3(sc.gusset.backSleeve) + " · ③ 앞 소매쪽 ※ " + f3(sc.notch.front.sleeveEdge) + " = " + f3(sc.gusset.frontSleeve) + " · ④ 앞 몸판쪽 ▣ " + f3(sc.notch.front.bodyEdge) + " = " + f3(sc.gusset.frontBody) + " · 폭선 ø+ø " + f2(g.widthCm) + " · 노치 쐐기 뒤 " + f2(m.notchWedgeDeg.back) + "° / 앞 " + f2(m.notchWedgeDeg.front) + "°");
    lines.push("소매산·AH 이세: 적용 안 됨 — 소매 달림선이 없는 몸판 일체형(원래 진동선은 제도 참고선으로만 남음) · 소맷부리 둘레 약 " + f2(m.circumference.cuffCm) + " · 팔꿈치 둘레 약 " + f2(m.circumference.elbowCm) + " 는 현 시안의 관찰값(보편 치수 아님)");
    lines.push("출처 구분 — 책: 8 · 1.6 / 0.7 · 3/4 · ★선–옆선 중점 · BL–WL 중점 · 앞 Ⓕ = 뒤 ø · 덧천 폭선 ø+ø / 구현 관례(설정값): 목 다트 위치 45% · SP 다듬기 2cm — 일반 공식 아님 · 3D 착용은 검증하지 않음(평면 변 길이·형상만)");
    return lines;
  }

  window.sleeveXApply = Object.freeze({ PRESET_ID: PRESET_ID, keys: keys, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
