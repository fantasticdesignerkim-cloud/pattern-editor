// ══════════════════════════════════════════════
// sleeveZApply.js — 소매 Ⓩ 프렌치 슬리브(소매길이 12 · designSleeveZ, P.55 아래)를 design 프로젝트 상태에 연결한다.
// 2026-11-04 김님 구현 승인(«좋아좋아 진행시켜» · z_overview/z_zoom 형상). DOM·storage 미접근(ui.js 가 호출).
// 입력 = 소매길이(공용 소매길이 칸 · 책 기본 12) + 책 수치 4개(부풀림 뒤 0.7 / 앞 0.3 · 가이드 위 2.5 · 옆선 아래 2) + 구현 관례 1개(옆 다트 위치 3).
// ★ 출발 = 완료 몸판(bodiceResult, 읽기 전용) — 몸판 Ⓐ 인지 형상으로 확인한다(Ⓥ·Ⓦ·Ⓧ·Ⓨ 와 같은 게이트). 다른 소매 결과는 쓰지 않는다.
// ★ 소유권: 몸판 일체형 뒤·앞(파생 몸판 — 소매 포함)은 working.sleeveZ 가 들고 있다. working.geometry.front/back · bodiceResult 무변경.
//   별도 소매 조각이 없다 → working.geometry.sleeve = 빈 버킷(sleevePiece:false) — 이전 소매(Ⓧ 덧천 등)가 화면에 남지 않는다. 소매산·AH 이세는 만들지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-Z";
  var BODICE_A = "bunka-bodice-A";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function f3(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }
  function sgn(v, f) { return (v >= 0 ? "+" : "") + (f || f2)(v); }
  function keys() { return window.designSleeveZ ? window.designSleeveZ.KEYS.slice() : []; }

  var REASONS = {
    "no-bodice": "완료된 몸판이 없습니다",
    "bodice-not-a": "Ⓩ 는 몸판 Ⓐ(교재 A 기본 패턴, 여밈·페플럼·이음선 없음)에서만 제도합니다(P.55 «아래 예는 몸판 Ⓐ 를 사용») — 현재 완료 몸판의 형상이 Ⓐ 와 다릅니다",
    "bodice-a-reference-missing": "몸판 Ⓐ 비교 형상을 만들 수 없음",
    "bodice-read-failed": "몸판 형상을 읽을 수 없음",
    "front-ah-dart-not-found": "앞 AH 다트를 찾지 못함",
    "front-ah-dart-unclosable": "앞 AH 다트를 닫을 수 없음(입구가 맞지 않음)",
    "side-dart-out-of-range": "옆 다트 위치가 옆선 길이 밖입니다(진동 아랫점 ~ 허리 사이)",
    "invalid-input": "입력 값을 확인하세요(숫자)",
    "input-out-of-range": "입력 범위를 확인하세요(소매길이 > 0 · 부풀림 > 0 · 가이드 위·옆선 아래 > 0 · 옆 다트 위치 > 0)",
    "side-leg-beyond-dart": "옆선 아래 둥글림(C → H)이 옆 다트 위치보다 짧아야 합니다 — 소맷부리 끝 H 가 앞 옆 다트 위에 남아야 함(제1법칙)",
    "right-angle-not-downward": "어깨 연장선에 직각인 방향이 아래를 향하지 않습니다(몸판 형상 확인)",
    "guide-degenerate": "가이드(E → 원래 진동 아랫점)를 정할 수 없음 — 소매길이를 확인하세요",
    "chord-leg-out-of-range": "가이드 위 둥글림(C → T)이 가이드 E–C 길이보다 짧아야 합니다 — 소매길이·2.5 값을 확인하세요",
    "side-leg-out-of-range": "옆선 아래 둥글림(C → H)이 옆선 길이 안에 있어야 합니다",
    "right-angle-inward": "소매길이가 짧아 E 의 연장선 직각 방향이 가이드 E–C 보다 안쪽을 향합니다 — 책의 «직각 출발 → 가이드 바깥으로 부풂» 곡선을 그릴 수 없음(소매길이를 늘리세요 · B83 기본값 기준 약 11.5 이상)",
    "bulge-infeasible": "E 에서 직각으로 출발해 이 부풀림으로 T 에 접선으로 닿는 곡선을 그릴 수 없습니다(부풀림이 직각 출발에 비해 너무 작거나 크고, 또는 원래 종이 안으로 들어감 — 제1법칙) — 부풀림·소매길이를 확인하세요",
    "rounding-inside-original": "C 모서리 둥글림이 원래 종이 안으로 들어갑니다 — 2.5·2 값을 확인하세요(제1법칙)",
    "original-paper-cut": "새 외곽이 원래 종이를 깎습니다(제1법칙 — Ⓩ 는 덧붙이기만 한다)",
    "self-intersection": "몸판 일체형 외곽이 자기 교차함(제1법칙)",
    "discontinuous": "외곽이 끊김",
    "no-module": "소매 Ⓩ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) { return !r ? "" : (REASONS[r.reason] || ("소매 Ⓩ 를 만들 수 없음(" + r.reason + ")")); }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveZ); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveZ && w.sleeveZ.blocked); }
  function paramsOf(x) { var o = {}; keys().forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SZ = window.designSleeveZ, BC = window.bodiceCheckpoint, RA = window.sleeveRApply;
    if (!SZ || !BC || !RA || !window.designSleeveR || !window.designSleeveT) return fail({ reason: "no-module" });
    var bodice = BC.latest(project); if (!bodice) return fail({ reason: "no-bodice" });
    var d = SZ.draftSleeveZ(bodice, RA.bodiceAGeometry(project), p);
    if (!d.ok) return fail(d);
    return { ok: true, geometry: d.geometry, derivedBodice: d.derivedBodice, meta: d.meta, warnings: d.warnings, sourceBodiceHash: d.sourceBodiceHash };
  }
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function stateOf(r) {   // 매개변수 = 엔진이 실제로 쓴 값(빈 칸 → 기본값으로 해석된 값)
    var used = r.meta.settings.inputs, p = {}; keys().forEach(function (k) { p[k] = used[k]; });
    return { presetId: PRESET_ID, bodicePresetId: BODICE_A, sourceBodiceHash: r.sourceBodiceHash, parameters: p, meta: clone(r.meta),
      derivedBodice: clone(r.derivedBodice), derivedHash: hashOf({ b: r.derivedBodice }), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) return fail({ reason: "no-project" });
    var r = draft(project, paramsOf(params));
    if (!r.ok) return r;
    w.sleeveZ = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);   // 빈 소매 버킷 — 이전 소매 조각을 지운다
    return { ok: true, state: w.sleeveZ };
  }
  // 거부: 이전 형상은 그대로 두고 차단 표시만(완료 불가) — 상태·geometry 를 바꾸지 않는다.
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveZ) return false;
    w.sleeveZ.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveZ) return { ok: true, active: false };
    var r = draft(project, w.sleeveZ.parameters);
    if (!r.ok) { w.sleeveZ.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveZ = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveZ };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveZ = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveZ; if (!s) return [];
    var lines = ["프렌치 슬리브 Ⓩ (시안) · 조금 긴 프렌치 슬리브 · 몸판에서 이어진 소매가 옆선으로 이어짐 · 별도 소매 조각·덧천 없음 · 앞 AH 다트 → 옆 · 뒤 어깨 다트는 열린 채 (P.55 아래)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, p = m.settings.inputs, sc = m.seams, pb = m.points.back, pf = m.points.front, fd = m.frontDart;
    lines.push("① 어깨선 연장 " + f2(p.sleeveLengthCm) + " (SP → E · 소매길이 · 끝 내림 없음 — 소맷부리 치수 확보) → ② E 에서 연장선 직각 (뒤 " + f2(pb.angleAtEDeg) + "° / 앞 " + f2(pf.angleAtEDeg) + "°)");
    lines.push("③ 가이드 E → C(원래 진동 아랫점)에서 바깥으로 부풀림 뒤 " + f2(pb.bulgeCm) + " / 앞 " + f2(pf.bulgeCm) + " (직각 출발과 가이드의 각 뒤 " + f2(pb.t0VsGuideDeg) + "° / 앞 " + f2(pf.t0VsGuideDeg) + "°)");
    lines.push("④ C 둥글림: 가이드 위 " + f2(p.chordLegCm) + " = T (접선 꺾임 뒤 " + f2(pb.kinkAtTDeg) + "° / 앞 " + f2(pf.kinkAtTDeg) + "°) · 옆선 아래 " + f2(p.sideLegCm) + " = H 소맷부리 끝 (옆선 접선 · 봉제하면 겨드랑이 끝이 뾰족하게 모임)");
    lines.push("앞 AH 다트 → 옆: 닫음 " + f2(fd.angleDeg) + "° · 옆 다트 폭 " + f2(fd.widthCm) + " · 진동 아랫점에서 옆선 따라 " + f2(fd.positionFromUnderarmCm) + " (H 에서 다트까지 " + f2(fd.hToDartCm) + " · 입구 잔차 " + f3(fd.mouthResidualCm) + ")");
    lines.push("봉제 길이: 어깨(다트 제외 + 연장) 뒤 " + f3(sc.shoulder.back) + " / 앞 " + f3(sc.shoulder.front) + " (차 " + sgn(sc.shoulder.back - sc.shoulder.front, f3) + ") · 옆선(H 아래 · 앞 = 옆 다트 닫은 길이) 뒤 " + f3(sc.sideSeam.back) + " / 앞 " + f3(sc.sideSeam.front) + " (차 " + sgn(sc.sideSeam.back - sc.sideSeam.front, f3) + ")");
    lines.push("새 팔구멍(소맷부리 E → H) 둘레 " + f2(sc.opening.total) + " = 뒤 " + f2(sc.opening.back) + " + 앞 " + f2(sc.opening.front) + " · 원래 진동 " + f2(m.armhole.totalOrigCm) + " (참고 — 전부 새 외곽 안)");
    lines.push("소매산·AH 이세: 적용 안 됨 — 소매 달림선·별도 소매 조각이 없는 몸판 일체형(원래 진동선은 제도 참고선으로만 남음)");
    lines.push("출처 구분 — 책: 소매길이 12 · 경사 없음 · 직각 · 부풀림 뒤 0.7 / 앞 0.3 · 2.5 · 2 · 옆선에 연결 · AH 다트 → 옆 / 구현 관례(설정값): 옆 다트 위치 3 · T 손잡이 = 최대 곡률 최소 · C 둥글림 = 2차 곡선 — 일반 공식 아님 · 3D 착용은 검증하지 않음");
    s.warnings.forEach(function (t) { lines.push("⚠ " + t); });
    return lines;
  }

  window.sleeveZApply = Object.freeze({ PRESET_ID: PRESET_ID, keys: keys, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
