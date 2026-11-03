// ══════════════════════════════════════════════
// sleeveWApply.js — 소매 Ⓦ 래글런(designSleeveW, P.53 · 제도 방법 P.142–143 · 맞댄다 P.157 · 닫는다 P.160)을 design 프로젝트 상태에 연결한다.
// 2026-11-03 시안(김님 그림 확인 — 제품 완성 승인은 검증 후 별도). DOM·storage 미접근(ui.js 가 호출).
// 입력 = 소매 길이(공용 소매길이 칸 · 기본값 없음) + 책 수치 7개 + 이번 시안 설정값 13개(폭 = Ⓦ 반전 기준 시안 · 나머지 = Ⓥ 확정값 · 일반 공식 아님).
// ★ 출발 = 완료 몸판(bodiceResult, 읽기 전용) — 몸판 Ⓐ 인지 형상으로 확인한다(Ⓥ 와 같은 게이트). 다른 소매 결과(working.sleeveV 포함)는 쓰지 않는다.
// ★ 소유권: 파생 몸판(Ⓥ 와 같은 형상)과 한 장 소매(앞뒤 맞댐 · 어깨 다트)는 working.sleeveW 가 들고 있다. working.geometry.front/back · bodiceResult 무변경.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-W";
  var BODICE_A = "bunka-bodice-A";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function f3(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }
  function sgn(v, f) { return (v >= 0 ? "+" : "") + (f || f2)(v); }
  function keys() { return window.designSleeveW ? window.designSleeveW.KEYS.slice() : []; }

  var REASONS = {
    "no-bodice": "완료된 몸판이 없습니다",
    "bodice-not-a": "Ⓦ 는 몸판 Ⓐ(교재 A 기본 패턴, 여밈·페플럼·이음선 없음)에서만 제도합니다(P.53 «아래 예는 몸판 Ⓐ 를 사용») — 현재 완료 몸판의 형상이 Ⓐ 와 다릅니다",
    "bodice-a-reference-missing": "몸판 Ⓐ 비교 형상을 만들 수 없음",
    "bodice-read-failed": "몸판 형상을 읽을 수 없음",
    "back-shoulder-dart-not-found": "뒤 어깨 다트를 찾지 못함",
    "front-ah-dart-not-found": "앞 AH 다트를 찾지 못함",
    "front-ah-dart-unclosable": "앞 AH 다트를 닫을 수 없음(입구가 맞지 않음)",
    "side-dart-out-of-range": "옆 다트 위치는 진동 아랫점 아래 0 초과 · 허리선 위만 입력할 수 있습니다",
    "invalid-input": "입력 값을 확인하세요(숫자 · 소매길이 필수)",
    "input-out-of-range": "입력 범위를 확인하세요(경사·직각·비율·시안 설정값 > 0 · 소맷부리 비율 ≤ 1 · 앞 부풂·진동 합류 위치 ≥ 0)",
    "sleeve-length-too-short": "소매길이가 소매산 높이(◉)보다 길어야 합니다",
    "raglan-guide-degenerate": "래글런 안내선(N–M)을 그을 수 없음(기하)",
    "front-bulge-unreachable": "앞 달림선 부풂(0.6)을 만들 수 없음 — 값을 줄이세요",
    "lower-join-out-of-range": "진동 합류 위치가 진동 둘레보다 깁니다",
    "raglan-leaves-bodice": "몸판 달림선이 원래 몸판 종이 밖(진동선 너머)으로 나갑니다 — 진동 합류 위치·핸들을 확인하세요(제1법칙)",
    "star-out-of-range": "★ 위치가 안내선(N–M) 길이를 넘습니다",
    "front-cuff-nonpositive": "앞 소맷부리가 0 이하입니다 — 뒤에서 자른 분량 ● 이 앞 소매 폭보다 큽니다",
    "under-curve-unreachable": "소매 아래 곡선을 몸판과 같은 치수로 소매 폭선에 이을 수 없습니다 — 소매 아랫점 위치(폭)·핸들 비를 확인하세요(P.143 «같은 치수 안에서 곡선 모양이나 소매 아랫점 위치를 변경»)",
    "under-curve-self-intersection": "소매 아래 곡선이 스스로 꼬입니다 — 핸들 비를 확인하세요",
    "back-dart-close-failed": "뒤 어깨 다트를 안내선 위에서 닫을 수 없음(이등분선이 안내선과 만나지 않음)",
    "release-beyond-star": "해제 곡선 끝(Ap 너머 거리)이 ★ 를 넘습니다",
    "release-curve-unreachable": "뒤 소매 목 쪽 해제 곡선을 원래 길이로 만들 수 없음 — 해제 설정값을 확인하세요",
    "fair-too-wide": "다듬기 폭이 변 길이보다 큽니다(뒤 어깨 · 소맷부리)",
    "butt-failed": "앞뒤 소매 중심선을 맞댈 수 없음(기하)",
    "butt-overlap": "앞뒤 소매를 맞대면 종이가 겹칩니다(제1법칙) — 경사·폭을 확인하세요",
    "sleeve-mirror": "소매 배치 회전 오류(기하)",
    "bodice-self-intersection": "파생 몸판 외곽이 자기 교차함(기하)",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "외곽이 끊김",
    "no-module": "소매 Ⓦ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) { return !r ? "" : (REASONS[r.reason] || ("소매 Ⓦ 를 만들 수 없음(" + r.reason + ")")); }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveW); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveW && w.sleeveW.blocked); }
  function paramsOf(x) { var o = {}; keys().forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SW = window.designSleeveW, BC = window.bodiceCheckpoint, RA = window.sleeveRApply;
    if (!SW || !window.designSleeveV || !BC || !RA || !window.designSleeveA || !window.designSleeveR || !window.designSleeveT) return fail({ reason: "no-module" });
    var bodice = BC.latest(project); if (!bodice) return fail({ reason: "no-bodice" });
    var d = SW.draftSleeveW(bodice, RA.bodiceAGeometry(project), p);
    if (!d.ok) return fail(d);
    return { ok: true, geometry: d.geometry, derivedBodice: d.derivedBodice, meta: d.meta, warnings: d.warnings, sourceBodiceHash: d.sourceBodiceHash };
  }
  function hashOf(o) { var s = JSON.stringify(o), h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function stateOf(r) {   // 매개변수 = 엔진이 실제로 쓴 값(빈 칸 → 기본값으로 해석된 값)
    var used = r.meta.settings.inputs, p = {}; keys().forEach(function (k) { p[k] = used[k]; });
    return { presetId: PRESET_ID, bodicePresetId: BODICE_A, sourceBodiceHash: r.sourceBodiceHash, parameters: p, meta: clone(r.meta),
      derivedBodice: clone(r.derivedBodice), derivedHash: hashOf({ b: r.derivedBodice, s: r.geometry.outline }), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) return fail({ reason: "no-project" });
    var r = draft(project, paramsOf(params));
    if (!r.ok) return r;
    w.sleeveW = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveW };
  }
  // 거부: 이전 형상은 그대로 두고 차단 표시만(완료 불가) — 상태·geometry 를 바꾸지 않는다.
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveW) return false;
    w.sleeveW.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveW) return { ok: true, active: false };
    var r = draft(project, w.sleeveW.parameters);
    if (!r.ok) { w.sleeveW.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveW = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveW };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveW = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveW; if (!s) return [];
    var lines = ["래글런 슬리브 Ⓦ (시안) · 몸판 Ⓐ 에 소매 달림선을 그리고 직접 제도 · 소매산 높이 = 평균 어깨 길이 × 1/2 · 한 장 소매(앞뒤 중심선 맞댐 — 솔기 아님) · 어깨 = 다트(끝 = SP) · 앞 AH 다트 → 옆 · 뒤 어깨 다트 소매 쪽에서 닫음 (P.53 · 제도 방법 P.142–143 · 맞댄다 P.157 · 닫는다 P.160)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, p = m.settings.inputs, rb = m.raglan.back, rf = m.raglan.front, sc = m.seams, wb = m.widthBasis;
    lines.push("경사: 어깨선 연장 " + f2(p.slopeRunCm) + " 에서 직각 뒤 " + f2(p.backSlopeDropCm) + " / 앞 " + f2(p.frontSlopeDropCm) + " → 중심선 · 소매길이 " + f2(p.sleeveLengthCm) + " · 소매산 높이 ◉ " + f2(m.capHeight.cm) + " = 평균 어깨 길이 " + f2(m.capHeight.averageShoulderCm) + " × " + f2(p.capHeightRatio));
    lines.push("소매 달림선(몸판 = 소매): 뒤 " + f3(rb.body.totalCm) + " = " + f3(rb.sleeve.totalCm) + " · 앞 " + f3(rf.body.totalCm) + " = " + f3(rf.sleeve.totalCm) + " · 구간 뒤 목→① " + f3(rb.body.neckToNotchCm) + " · ①→★ " + f3(rb.body.notchToStarCm) + " · ★→아랫점 " + f3(rb.body.starToUnderarmCm) + " / 앞 " + f3(rf.body.neckToNotchCm) + " · " + f3(rf.body.notchToStarCm) + " · " + f3(rf.body.starToUnderarmCm));
    lines.push("어깨 다트(끝 = SP): 다리 뒤 " + f3(sc.dart.back) + " · 앞 " + f3(sc.dart.front) + " (차 " + sgn(sc.dart.diffCm, f3) + " — 기록만, 보정 없음) · 각 " + f2(sc.dart.angleDeg) + "° · 목에서 벌어짐 " + f2(sc.dart.neckOpenCm) + " · 맞댄 선 SP → 소맷부리 뒤 " + f3(sc.butt.back) + " = 앞 " + f3(sc.butt.front) + " (솔기 아님)");
    lines.push("소매 밑선 뒤 " + f3(sc.underarm.back) + " · 앞 " + f3(sc.underarm.front) + " · 소맷부리 뒤 " + f2(sc.cuff.back) + " · 앞 " + f2(sc.cuff.front) + " (● " + f2(m.cuff.cutCm) + " — 앞도 같은 분량) · 소매 폭 뒤 " + f2(m.widthCm.back) + " · 앞 " + f2(m.widthCm.front) + " = " + f2(m.widthCm.total));
    lines.push("폭 근거(시안): 몸판 ★→진동 아랫점 곡선을 ★ 접선에 반전 → 같은 현 길이로 폭선 = 뒤 " + (wb.back.referenceCm == null ? "—" : f2(wb.back.referenceCm)) + " / 앞 " + (wb.front.referenceCm == null ? "—" : f2(wb.front.referenceCm)) + " (지금 입력 " + f2(wb.back.chosenCm) + " / " + f2(wb.front.chosenCm) + ") · 책 그림 폭/◉ ≈ 2.2");
    lines.push("뒤 어깨 다트: 끝 T → Ap · " + f2(m.backDart.angleDeg) + "° 닫음 · 닫은 다리 끝 차 " + f3(m.backDart.legGapCm) + " → 가운데 점 정리 · 앞 AH 다트 → 옆(진동 아랫점 아래 " + f2(m.frontDart.sideDropCm) + ") · 다듬기: 뒤 어깨 닫은 자리 " + f2(p.shoulderFairCm) + " · SP 없음(다트 끝) · 소맷부리 모서리 " + f2(p.cuffFairCm));
    lines.push("출처 구분 — 책: 1/2 · 경사 8:1.3 / 8:2 · 다트 끝 = SP · 앞뒤 맞대기 · 앞 0.6 · 소맷부리 3/4 / 시안: 폭 19.5 · 19.1(반전 기준) · ★ · 핸들 · 해제 곡선 · 진동 합류 · 다듬기(Ⓥ 확정값) — 일반 공식 아님 · 카라 단계 목둘레는 bodiceResult 그대로(어깨 다트·래글런 목 모양 미반영)");
    return lines;
  }

  window.sleeveWApply = Object.freeze({ PRESET_ID: PRESET_ID, keys: keys, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
