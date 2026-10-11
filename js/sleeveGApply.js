// ══════════════════════════════════════════════
// sleeveGApply.js — 소매 Ⓖ(designSleeveG, P.43 «소매산 높이를 2등분해, 소매산만 절개선을 넣어 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). sleeveFApply 와 같은 구조 + 입력 ★(가운데 상승).
//   · working.sleeveG (프리셋 id·출처 hash·입력(소매길이·턱 분량·★)·meta·경고·차단 사유) · working.geometry.sleeve (재단선 + 표시 construction)
// ★ 턱(기본 1.5 · 최대 2, 책)과 ★(기본 3)는 독립 입력 — 성립하지 않는 조합은 엔진의 기하 가드 사유로 거부한다(책 규칙처럼 꾸미지 않음).
// ★ 지배 ease = 턱을 접은(봉제 후) 소매산 길이 − AH(designSleeveG.capLengthsOf, 최종 geometry 실측).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-G";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "half-line": 1, "star-lift": 1, "tuck-fold": 1, "tuck-place": 1 };   // tuck-mid(접혀 숨는 안쪽 꺾임)는 meta 에만
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓖ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "invalid-tuck": "턱 분량은 0 보다 크고 2cm 이하여야 합니다(책: 1곳 2cm 가 최대)",
    "invalid-star": "★(가운데 상승)은 0 보다 커야 합니다",
    "star-too-large": "★ 가 소매산 높이에 비해 너무 커서 소매 Ⓖ 지원 범위 밖입니다(기하)",
    "tuck-star-incompatible": "이 턱 분량과 ★ 조합으로는 b 절개를 같은 분량으로 벌릴 수 없습니다 — 소매 Ⓖ 지원 범위 밖(기하). 턱 분량이나 ★ 를 바꿔 보세요",
    "pieces-overlap": "이 조합에서는 안쪽·바깥 조각이 겹칩니다 — 소매 Ⓖ 지원 범위 밖(기하)",
    "b-apex-invalid": "b 턱의 접는 꼭짓점을 잡을 수 없습니다 — 소매 Ⓖ 지원 범위 밖(기하)",
    "cut-below-half": "절개선 위끝이 소매산 2등분 선 아래입니다 — 소매 Ⓖ 지원 범위 밖(기하)",
    "redraw-inflection": "진동밑~b 위끝 재제도가 원래 소매산보다 많이 굽이칩니다 — 소매 Ⓖ 지원 범위 밖(기하)",
    "redraw-crosses-fold": "재제도 곡선이 b 접는 선을 넘어갑니다 — 소매 Ⓖ 지원 범위 밖(기하)",
    "redraw-g1-break": "재제도 이음이 매끄럽지 않습니다",
    "width-too-narrow": "소매산 2등분 선이 좁아 ±3cm 절개선을 넣을 수 없습니다 — 소매 Ⓖ 지원 범위 밖(기하)",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "tuck-too-large": "턱 분량이 기준점~소매산 거리보다 커서 소매 Ⓖ 지원 범위 밖입니다(기하)",
    "tuck-too-deep": "접힌 턱이 이웃 조각 밖까지 들어가 소매 Ⓖ 지원 범위 밖입니다(기하)",
    "tuck-direction": "벌림 방향이 바깥이 아님",
    "cap-unmeasured": "소매산 길이를 잴 수 없음",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓖ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓖ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveG); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveG && w.sleeveG.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, sleeveLengthCm, tuckCm, starCm) {
    var SA = window.designSleeveA, SG = window.designSleeveG, SAA = window.sleeveAApply;
    if (!SA || !SG || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SG.draftSleeveG(a, { tuckCm: tuckCm, starCm: starCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: { sleeveLengthCm: p.sleeveLengthCm, tuckCm: p.tuckCm, starCm: p.starCm }, meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = { sleeveLengthCm: params && params.sleeveLengthCm, tuckCm: params && params.tuckCm, starCm: params && params.starCm };
    var r = draft(project, p.sleeveLengthCm, p.tuckCm, p.starCm);
    if (!r.ok) return r;
    w.sleeveG = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveG };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveG) return false;
    w.sleeveG.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveG) return { ok: true, active: false };
    var p = w.sleeveG.parameters;
    var r = draft(project, p.sleeveLengthCm, p.tuckCm, p.starCm);
    if (!r.ok) { w.sleeveG.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveG = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveG };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveG = null; }

  // 화면 표시용 줄(패턴명 · 턱·★ · 소매산 높이 · b 단차 · AH/봉제 소매산/재단 소매산/이세 geometry 실측).
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveG; if (!s) return [];
    var lines = ["턱 소매 Ⓖ · 소매 Ⓐ 의 소매산 높이 2등분 위만 a·b 절개 — 가운데 ★ 상승 → a 벌림 → 좌우 ☆ 기준 b 벌림 (P.43)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, tk = m.tuck.tucks, sb = m.sides.back, sf = m.sides.front;
    lines.push("턱 분량 각 " + f2(m.tuck.perTuckCm) + " × 4 (실제 a 뒤 " + f2(tk["back-a"].openedCm) + " · 앞 " + f2(tk["front-a"].openedCm) + " · b 뒤 " + f2(tk["back-b"].openedCm) + " · 앞 " + f2(tk["front-b"].openedCm) + ") · ★ " + f2(m.star.cm) + " (독립 입력)");
    lines.push("고정 중심 O(중심선 × 위팔선) · 펼친 중심 길이 SP′→소맷부리 " + f2(m.sleeveLengthCm - m.sp.y) + " cm = 입력 소매길이 " + f2(m.sleeveLengthCm) + " + ★ " + f2(m.star.cm) + " (길이 보정 안 함, 김님)");
    lines.push("소매산 높이 " + f2(m.capHeightBeforeCm) + " → " + f2(m.capHeightAfterCm) + " cm · 바깥 회전(☆) 뒤 " + f2(Math.abs(sb.betaDeg)) + "° · 앞 " + f2(Math.abs(sf.betaDeg)) + "° · 소맷부리 그대로");
    var eb = sb.underarmExtension, ef = sf.underarmExtension;
    lines.push("진동밑 연장(위팔선 따라 바깥 — 시안, 김님 확인 대기) 뒤 " + f2(eb.cm) + " · 앞 " + f2(ef.cm) + " cm → 소매폭 " + f2(m.widthCm) + " → " + f2(m.widthAfterCm) +
      " · 옆선 뒤 " + f2(m.seams.backCm) + " / 앞 " + f2(m.seams.frontCm) + " (차 " + m.seams.diffCm.toFixed(3) + ") · 연장 전 봉제 소매산 뒤 " + f2(eb.sewnBeforeCm) + " · 앞 " + f2(ef.sewnBeforeCm));
    lines.push("b 턱 단차(접을 때) 뒤 " + f2(sb.bLegs.stepCm) + " · 앞 " + f2(sf.bLegs.stepCm) + " cm → 턱 접은 상태에서 진동밑~b 위끝 재제도로 정리 · 틈은 종이 덧댐");
    lines.push("턱 방향: 바깥쪽으로 접음 · 소매 중심 쪽 천이 위 · 박기 끝 미확정(표시 안 함)");
    var BC = window.bodiceCheckpoint, SG = window.designSleeveG, bodice = BC && BC.latest(project);
    var lens = (SG && w.geometry && w.geometry.sleeve) ? SG.capLengthsOf(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths) {
      var ah = bodice.armholeLengths;
      lines.push("AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back) + " · 총 " + f2(ah.front + ah.back) + " cm");
      if (lens) {
        var ef = lens.sewn.front - ah.front, eb = lens.sewn.back - ah.back;
        lines.push("소매산(턱 접음·봉제) 앞 " + f2(lens.sewn.front) + " · 뒤 " + f2(lens.sewn.back) + " · 총 " + f2(lens.sewn.total) + " cm · 재단선(펼침) 총 " + f2(lens.cut.total) + " cm");
        lines.push("이세(턱 접은 소매산 실측) 앞 " + sgn(ef) + " · 뒤 " + sgn(eb) + " · 총 " + sgn(ef + eb) + " cm");
      }
    }
    return lines;
  }

  window.sleeveGApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
