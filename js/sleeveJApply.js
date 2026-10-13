// ══════════════════════════════════════════════
// sleeveJApply.js — 소매 Ⓙ(designSleeveJ, P.45 퍼프 «소매 중심선에서 평행으로 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매길이 · 손바닥 둘레(기본 21) · 소매산 상승(기본 0.7 — 개더 계수 0.7 과 별개). 커프스 폭 1cm 는 치수 정보만.
// ★ 화면 검토용 시안. 최종 소매산 − AH = 이세 + 개더 총량 — Ⓐ 실측 이세와 추가 개더(최종 − Ⓐ 소매산)를 나눠 표시한다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-J";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "cut-edge-back": 1, "cut-edge-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓙ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "invalid-palm": "손바닥 둘레 값을 확인하세요",
    "invalid-rise": "소매산 상승 값을 확인하세요(0 이상)",
    "no-spread": "∅ = 0.7● − ■ 가 0 이하라 벌릴 분량이 없습니다(커프스 달림이 Ⓐ 소맷부리에 비해 너무 작음) — 소매 Ⓙ 지원 범위 밖",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "flare-too-large": "벌림이 기준점~소맷부리 거리보다 커서 소매 Ⓙ 지원 범위 밖입니다(기하)",
    "rotation-too-large": "조각 회전각이 한계(45°)를 넘어 소매 Ⓙ 지원 범위 밖입니다(기하)",
    "flare-direction": "벌림 방향이 바깥이 아님",
    "redraw-inflection-unavoidable": "소매산 꺾임을 변곡 없이 다시 그릴 수 없습니다 — 소매 Ⓙ 지원 범위 밖",
    "redraw-window-invalid": "소매산 재제도 구간을 잡을 수 없습니다",
    "redraw-g1-break": "소매산 재제도 이음이 매끄럽지 않습니다",
    "hem-g1-break": "소맷부리 곡선 이음이 매끄럽지 않습니다",
    "hem-fair-inflection": "소맷부리를 변곡 없이 정리할 수 없습니다 — 소매 Ⓙ 지원 범위 밖",
    "cap-split-failed": "소매산 앞/뒤 분할점을 찾을 수 없음",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓙ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓙ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveJ); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveJ && w.sleeveJ.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SA = window.designSleeveA, SJ = window.designSleeveJ, SAA = window.sleeveAApply;
    if (!SA || !SJ || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SJ.draftSleeveJ(a, { palmCircumferenceCm: p.palmCircumferenceCm, riseCm: p.riseCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, palmCircumferenceCm: x && x.palmCircumferenceCm, riseCm: x && x.riseCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveJ = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveJ };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveJ) return false;
    w.sleeveJ.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveJ) return { ok: true, active: false };
    var p = w.sleeveJ.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveJ.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveJ = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveJ };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveJ = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveJ; if (!s) return [];
    var lines = ["퍼프 소매 Ⓙ (화면 검토용 시안) · 소매 Ⓐ 중심선을 잘라 두 반쪽을 좌우 ∅/2 씩 평행 이동(회전 없음) — 기준 = 틈 가운데(원래 중심선) (P.45)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, fo = m.formula, hm = m.hem;
    lines.push("커프스 달림 ● = 손바닥 둘레 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " cm · 폭 " + f2(m.cuff.widthCm) + " cm (치수 정보 — 커프스 조각 없음)");
    lines.push("산식: ■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(fo.square) + " · ∅ = 0.7● − ■ = " + f2(fo.spread) + " (좌우 ∅/2 = " + f2(fo.spread / 2) + " · 개더 계수 0.7 = 책 설정 · 책 «9 정도»는 예시)");
    lines.push("소맷부리(평행 벌림 후 직선 — 곡선화 안 함) " + f2(hm.lengthCm) + " cm = 1.7● · 개더 " + f2(hm.gatherCm) + " cm (커프스 ● 대비 ×" + f2(1 + hm.gatherRatio) + ") · 도해의 물결 = 개더 표시(재단선 아님)");
    lines.push("소매산 상승 " + f2(m.rise.cm) + " cm(설정값 — 개더 계수 0.7 과 별개) · 틈 위 국소 재제도(잠정 구간 양쪽 " + f2(m.redraw.ellCm) + " cm, 그 밖은 원래 소매산 그대로) · 소매길이 입력 " + f2(m.centerLength.inputCm) + " · 꼭대기→소맷부리 " + f2(m.centerLength.spreadCm));
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths && prim) {
      var ah = bodice.armholeLengths, ca = m.capLengthsA, tf = prim.lengths.front - ah.front, tb = prim.lengths.back - ah.back;
      lines.push("소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm · AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back));
      if (ca) {
        lines.push("Ⓐ 실측 이세 앞 " + sgn(ca.front - ah.front) + " · 뒤 " + sgn(ca.back - ah.back) + " · 총 " + sgn(ca.total - ah.front - ah.back) + " + 추가 개더(최종 − Ⓐ 소매산) 앞 " + sgn(prim.lengths.front - ca.front) + " · 뒤 " + sgn(prim.lengths.back - ca.back) + " · 총 " + sgn(prim.lengths.total - ca.total));
      }
      lines.push("최종 소매산 − AH = 이세 + 개더 총량 앞 " + sgn(tf) + " · 뒤 " + sgn(tb) + " · 총 " + sgn(tf + tb) + " cm");
    }
    return lines;
  }

  window.sleeveJApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
