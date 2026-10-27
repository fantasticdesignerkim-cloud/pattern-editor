// ══════════════════════════════════════════════
// sleeveQApply.js — 소매 Ⓠ(designSleeveQ, P.48 하단 캡 슬리브 «소맷부리선을 그린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매산 높이 비율 하나(기본 1/4 = 0.25, 1/4 ~ 3/4). 기장·앞뒤 호 길이는 입력하지 않는다.
// ★ 출발 Ⓐ 는 같은 완료 몸판에서 고정 내부 기장(SOURCE_A_LENGTH)으로 제도해 소매산만 쓴다 — Ⓐ 기장은 Ⓠ 형상·출처 hash 와 무관(엔진 보장).
// ★ 몸판 달림 끝(뒤·앞) = 같은 몸판 보관 진동에서 진동 아랫점부터 소매에서 빠진 호(● · ∅) 만큼 잰 점 — 표시용. 몸판 geometry 는 읽기만 한다.
//   이어진 진동선(다트 입구 전)보다 호가 길면 위치를 정하지 않고 상태만 남긴다(임의 보정 없음 — 판단 필요).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-Q";
  var SOURCE_A_LENGTH = 30;   // 출발 Ⓐ 제도용 내부 기장(소매산만 쓰므로 결과와 무관 — 사용자 입력 아님)
  var DISPLAY_CONSTRUCTION = { "center-line": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓠ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-height-ratio": "소매산 높이 비율 값을 확인하세요(숫자)",
    "height-ratio-out-of-range": "소매산 높이 비율은 1/4 ~ 3/4(0.25 ~ 0.75, 양 끝 포함) 사이만 입력할 수 있습니다",
    "hem-intersection-not-unique": "소맷부리 수평선이 소매산과 앞·뒤 각각 한 점에서 만나지 않습니다(기하)",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓠ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓠ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) {
    var o = { ok: false, reason: r.reason };
    if (r.detail !== undefined) o.detail = r.detail;
    if (r.outOfSupportedRange) o.outOfSupportedRange = true;
    if (r.numericGuard) o.numericGuard = true;
    if (r.provisionalLimit) o.provisionalLimit = true;
    if (stage) o.stage = stage;
    o.text = failText(o);
    return o;
  }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveQ); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveQ && w.sleeveQ.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). 출발 Ⓐ = 같은 몸판 · 입력 소매길이(기본 20)로 새로 제도.
  function draft(project, p) {
    var SA = window.designSleeveA, SQ = window.designSleeveQ, SAA = window.sleeveAApply, BC = window.bodiceCheckpoint;
    if (!SA || !SQ || !SAA || !BC) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, SOURCE_A_LENGTH);
    if (!a.ok) return fail(a, "A");
    var d = SQ.draftSleeveQ(a, { heightRatio: p.heightRatio });
    if (!d.ok) return fail(d);
    d.meta.attach = SQ.bodiceAttachEnds(BC.latest(project), d.meta.excludedArcCm);   // 몸판 달림 끝(표시용 · 몸판 무변경)
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { heightRatio: x && x.heightRatio }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveQ = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveQ };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveQ) return false;
    // attemptedInputs: 거부된 그 입력(입력칸 원문) — 화면이 다른 값으로 바뀌어 다음 적용이 몰래 다른 값으로 가지 않게 ui 가 그대로 되돌려 놓는다.
    w.sleeveQ.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveQ) return { ok: true, active: false };
    var p = w.sleeveQ.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveQ.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveQ = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveQ };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveQ = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveQ; if (!s) return [];
    var lines = ["캡 슬리브 Ⓠ (화면 검토용 시안) · 소매 Ⓐ 소매산에서 위팔선 위 H × " + s.parameters.heightRatio + " 높이에 수평 소맷부리선 — 직선 소맷부리 (P.48)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, ex = m.excludedArcCm, at = m.attach;
    lines.push("높이 비율 " + m.settings.heightRatio + "(기본 1/4 · 허용 1/4 ~ 3/4) · 소매산 높이 H " + f2(m.capHeightCm) + " · 위팔선 위 " + f2(m.capHeightCm * m.settings.heightRatio) + " cm · 기장 입력 없음(출발 Ⓐ 기장과 무관)");
    lines.push("결과 중심 길이 SP → 소맷부리 = H × (1 − r) " + f2(m.centerLength.spreadCm) + " cm · 직선 소맷부리 " + f2(m.hem.lengthCm) + " cm(수평)");
    lines.push("소매에서 빠진 호(Ⓐ 아랫점 → 끝점): 뒤 ● " + f2(ex.back) + " · 앞 ∅ " + f2(ex.front) + " cm · 남은 소매산(실측) 뒤 " + f2(m.capLengths.back) + " · 앞 " + f2(m.capLengths.front) + " cm");
    if (m.armholeCm) {
      lines.push("몸판 달림 구간(AH − 빠진 호) 뒤 " + f2(m.sewnArmholeCm.back) + " · 앞 " + f2(m.sewnArmholeCm.front) + " cm · 구간 이세(남은 소매산 − 남은 AH) 뒤 " + sgn(m.easeAfter.back) + " · 앞 " + sgn(m.easeAfter.front) + " cm (전체 AH 앞 " + f2(m.armholeCm.front) + " · 뒤 " + f2(m.armholeCm.back) + " 과 다름)");
    }
    var stTxt = function (e) { return !e ? "-" : e.status === "ok" ? (e.acrossClosedDart ? "표시(다트를 닫은 봉제 진동 기준 — 위쪽 조각 위)" : "표시") : "표시 보류(진동 아랫점에서 이어진 진동선 " + f2(e.reachedCm) + " cm 보다 호가 김 — 다트 너머 위치는 판단 필요)"; };
    lines.push("몸판 달림 끝(진동 아랫점부터 같은 호 길이): 뒤 " + stTxt(at && at.back) + " · 앞 " + stTxt(at && at.front) + " · 몸판 geometry 무변경");
    lines.push("중심선 점선 고리(책 기호) — 의미 미확정, 형상 계산에 쓰지 않음");
    return lines;
  }

  window.sleeveQApply = Object.freeze({ PRESET_ID: PRESET_ID, SOURCE_A_LENGTH: SOURCE_A_LENGTH, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
