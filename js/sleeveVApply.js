// ══════════════════════════════════════════════
// sleeveVApply.js — 소매 Ⓥ 래글런(designSleeveV, P.52 · 제도 방법 P.142–143)을 design 프로젝트 상태에 연결한다. 김님 확정 시안(2026-11-01).
// DOM·storage 미접근(ui.js 가 호출). 입력 = 소매 길이(공용 소매길이 칸 · 기본값 없음) + 책 수치 7개 + 이번 시안 설정값 14개(기본 = 확정값, 일반 공식 아님).
// ★ 출발 = 완료 몸판(bodiceResult, 읽기 전용) — 몸판 Ⓐ 인지 형상으로 확인한다(Ⓡ·Ⓣ 와 같은 게이트). 다른 소매 결과는 쓰지 않는다.
// ★ 소유권: 파생 몸판(앞·뒤 — 래글런선으로 자른 몸판)과 두 장 소매(뒤·앞 · 중심 솔기)는 working.sleeveV 가 들고 있다. working.geometry.front/back · bodiceResult 무변경.
//   working.geometry.sleeve 에는 다른 소매 라인처럼 소매(두 장)만 미러링한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-V";
  var BODICE_A = "bunka-bodice-A";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function f3(v) { return (Math.round(v * 1000) / 1000).toFixed(3); }
  function sgn(v, f) { return (v >= 0 ? "+" : "") + (f || f2)(v); }
  function keys() { return window.designSleeveV ? window.designSleeveV.KEYS.slice() : []; }

  var REASONS = {
    "no-bodice": "완료된 몸판이 없습니다",
    "bodice-not-a": "Ⓥ 는 몸판 Ⓐ(교재 A 기본 패턴, 여밈·페플럼·이음선 없음)에서만 제도합니다(P.142 «예: 소매 Ⓥ» 도해 = 몸판 Ⓐ) — 현재 완료 몸판의 형상이 Ⓐ 와 다릅니다",
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
    "fair-too-wide": "다듬기 폭이 변 길이보다 큽니다(어깨 · SP · 소맷부리)",
    "sleeve-mirror": "소매 배치 회전 오류(기하)",
    "bodice-self-intersection": "파생 몸판 외곽이 자기 교차함(기하)",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "외곽이 끊김",
    "no-module": "소매 Ⓥ 모듈을 불러오지 못함",
    "no-project": "디자인 프로젝트 없음"
  };
  function failText(r) { return !r ? "" : (REASONS[r.reason] || ("소매 Ⓥ 를 만들 수 없음(" + r.reason + ")")); }
  function fail(r) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveV); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveV && w.sleeveV.blocked); }
  function paramsOf(x) { var o = {}; keys().forEach(function (k) { o[k] = x ? x[k] : undefined; }); return o; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SV = window.designSleeveV, BC = window.bodiceCheckpoint, RA = window.sleeveRApply;
    if (!SV || !BC || !RA || !window.designSleeveA || !window.designSleeveR || !window.designSleeveT) return fail({ reason: "no-module" });
    var bodice = BC.latest(project); if (!bodice) return fail({ reason: "no-bodice" });
    var d = SV.draftSleeveV(bodice, RA.bodiceAGeometry(project), p);
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
    w.sleeveV = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveV };
  }
  // 거부: 이전 형상은 그대로 두고 차단 표시만(완료 불가) — 상태·geometry 를 바꾸지 않는다.
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveV) return false;
    w.sleeveV.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveV) return { ok: true, active: false };
    var r = draft(project, w.sleeveV.parameters);
    if (!r.ok) { w.sleeveV.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveV = stateOf(r);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveV };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveV = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveV; if (!s) return [];
    var lines = ["래글런 슬리브 Ⓥ (김님 확정 시안) · 몸판 Ⓐ 에 소매 달림선을 그리고 직접 제도 · 소매 두 장(중심 = 솔기, 맞댐 아님) · 앞 AH 다트 → 옆 · 뒤 어깨 다트 소매 쪽에서 닫음 (P.52 · 제도 방법 P.142–143 · 닫는다 P.160)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면은 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, p = m.settings.inputs, rb = m.raglan.back, rf = m.raglan.front, sc = m.seams;
    lines.push("경사: 어깨선 연장 " + f2(p.slopeRunCm) + " 에서 직각 뒤 " + f2(p.backSlopeDropCm) + " / 앞 " + f2(p.frontSlopeDropCm) + " → 중심선 · 소매길이 " + f2(p.sleeveLengthCm) + " · 소매산 높이 ◉ " + f2(m.capHeight.cm) + " = 평균 어깨 길이 " + f2(m.capHeight.averageShoulderCm) + " × " + f2(m.capHeight.ratio));
    lines.push("소매 달림선(몸판 = 소매): 뒤 " + f3(rb.body.totalCm) + " = " + f3(rb.sleeve.totalCm) + " · 앞 " + f3(rf.body.totalCm) + " = " + f3(rf.sleeve.totalCm) + " · 구간 뒤 목→① " + f3(rb.body.neckToNotchCm) + " · ①→★ " + f3(rb.body.notchToStarCm) + " · ★→아랫점 " + f3(rb.body.starToUnderarmCm) + " / 앞 " + f3(rf.body.neckToNotchCm) + " · " + f3(rf.body.notchToStarCm) + " · " + f3(rf.body.starToUnderarmCm));
    lines.push("중심 솔기 뒤 " + f3(sc.center.back) + " · 앞 " + f3(sc.center.front) + " (차 " + sgn(sc.center.diffCm, f3) + " — 기록만, 보정 없음) · 소매 밑선 뒤 " + f3(sc.underarm.back) + " · 앞 " + f3(sc.underarm.front) + " · 소맷부리 뒤 " + f2(sc.cuff.back) + " · 앞 " + f2(sc.cuff.front) + " (● " + f2(m.cuff.cutCm) + ")");
    lines.push("소매 폭 뒤 " + f2(m.widthCm.back) + " · 앞 " + f2(m.widthCm.front) + " · ★ = M 위 뒤 " + f2(p.backStarAboveMCm) + " / 앞 " + f2(p.frontStarAboveMCm) + " · 진동 파임 ★→아랫점 뒤 " + f2(m.lower.back.armholeDigFromStarCm) + " / 앞 " + f2(m.lower.front.armholeDigFromStarCm) + " (M 아래 " + f2(m.lower.back.armholeDigBelowMCm) + " / " + f2(m.lower.front.armholeDigBelowMCm) + ")");
    lines.push("뒤 어깨 다트: 끝 T → Ap(이등분선 ∩ 안내선) · " + f2(m.backDart.angleDeg) + "° 닫음 · 닫은 다리 끝 차 " + f3(m.backDart.legGapCm) + " → 가운데 점 정리 · 몸판 꼬리 메움 · 앞 AH 다트 → 옆(진동 아랫점 아래 " + f2(m.frontDart.sideDropCm) + ") " + f2(m.frontDart.angleDeg) + "°");
    lines.push("다듬기(시안 설정값): 뒤 어깨 닫은 자리 " + f2(p.shoulderFairCm) + " · SP " + f2(p.spFairCm) + " · 소맷부리 모서리 " + f2(p.cuffFairCm) + "(밑선과 직각) · 원본 몸판 완료본 무변경");
    lines.push("출처 구분 — 책: 목 2/3 · 가장 안쪽 ⟂ BL · 뒤 중간점 / 앞 2/3 · 경사 8:3.4 / 8:4 · 앞 0.6 · 3/4 · 소맷부리 뒤 폭 × 3/4(앞 같은 분량) / 이번 확정 시안 설정값: ★ 위치 · 아랫점 폭 · 핸들 · 해제 곡선 · 진동 합류 · 다듬기 폭 — 일반 공식 아님");
    return lines;
  }

  window.sleeveVApply = Object.freeze({ PRESET_ID: PRESET_ID, keys: keys, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
