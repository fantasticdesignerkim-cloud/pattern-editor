// ══════════════════════════════════════════════
// sleeveFApply.js — 소매 Ⓕ(designSleeveF, P.43 턱트 슬리브 «소매 중심선과 평행으로 절개선을 넣고 소맷부리를 기준점으로 잘라서 벌린다»)를
// design 프로젝트 상태에 연결한다. DOM·storage 미접근(ui.js 가 호출).
//
// sleeveEApply 와 같은 구조다. 완성된 bodiceResult 를 **읽기 전용으로** Ⓐ 로 제도(draftSleeveA)하고, 그 결과를 Ⓕ 의 출발 원형으로 draftSleeveF 에 넘긴다.
//   · working.sleeveF (프리셋 id·출처 hash·입력(소매길이·턱 분량)·확인용 meta·경고·차단 사유)
//   · working.geometry.sleeve (render/layout 미러 — 재단선 outline + 표시용 construction(중심선·턱 접는 선·맞출 선))
// bodiceResult·sourceBlock·referenceGeometry·working.sleeveDraft·working.sleeveResult·working.sleeveA~E 는 건드리지 않는다(라인 배타는 ui.js).
// ★ 입력: 소매길이 + 턱 분량(각 턱, 기본 1.5 · 최대 3cm — 김님 확정). 지배 ease = **턱을 접은(봉제 후) 소매산 길이** − AH(김님 ③),
//   최종 geometry 에서 designSleeveF.capLengthsOf 로 실측한다(재단선 길이와 구분).
// ★ 실패하면 이전 상태를 그대로 두고 사유만 낸다. 이미 Ⓕ 가 켜져 있을 때의 실패는 `blocked` 로 남겨 완료를 막는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-F";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "tuck-fold": 1, "tuck-place": 1 };   // tuck-mid(접혀 숨는 안쪽 꺾임)는 meta 에만
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓕ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "invalid-tuck": "턱 분량은 0 보다 크고 3cm 이하여야 합니다(책: 1곳 3cm 가 최대)",
    "width-too-narrow": "소매폭이 좁아 중심 ±3cm 절개선을 넣을 수 없습니다 — 소매 Ⓕ 지원 범위 밖",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "tuck-too-large": "턱 분량이 기준점~소매산 거리보다 커서 소매 Ⓕ 지원 범위 밖입니다",
    "tuck-too-deep": "접힌 턱이 이웃 조각 밖까지 들어가 소매 Ⓕ 지원 범위 밖입니다",
    "tuck-direction": "벌림 방향이 바깥이 아님",
    "fold-mismatch": "턱을 접은 형상이 소매 Ⓐ 와 맞지 않음",
    "fold-layer-mismatch": "접힌 턱 천이 소매산 봉제선에 놓이지 않음",
    "folded-cap-kink": "턱을 접은 소매산에 꺾임이 있음 — 소매 Ⓕ 지원 범위 밖",
    "hem-opened": "소맷부리가 기준점에서 벌어짐",
    "cap-unmeasured": "소매산 길이를 잴 수 없음",
    "self-intersection": "소매 외곽이 자기 교차함",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓕ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓕ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveF); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveF && w.sleeveF.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, sleeveLengthCm, tuckCm) {
    var SA = window.designSleeveA, SF = window.designSleeveF, SAA = window.sleeveAApply;
    if (!SA || !SF || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SF.draftSleeveF(a, { tuckCm: tuckCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function stateOf(r, sleeveLengthCm, tuckCm) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: { sleeveLengthCm: sleeveLengthCm, tuckCm: tuckCm }, meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var len = params && params.sleeveLengthCm, tk = params && params.tuckCm;
    var r = draft(project, len, tk);
    if (!r.ok) return r;
    w.sleeveF = stateOf(r, len, tk);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveF };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveF) return false;
    w.sleeveF.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveF) return { ok: true, active: false };
    var p = w.sleeveF.parameters;
    var r = draft(project, p.sleeveLengthCm, p.tuckCm);
    if (!r.ok) { w.sleeveF.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveF = stateOf(r, p.sleeveLengthCm, p.tuckCm);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveF };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveF = null; }

  // 화면 표시용 줄(패턴명 · 턱 분량·실제 벌림 · 턱 방향 · 소매폭/소맷부리 · AH/봉제 소매산/재단 소매산/이세 geometry 실측).
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveF; if (!s) return [];
    var lines = ["턱 소매 Ⓕ · 소매 Ⓐ 에서 중심선과 평행한 절개 4개(±1·±3cm)를 소맷부리 기준점으로 잘라서 소매산을 벌림 (P.43)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, tk = m.tuck, op = tk.tucks;
    lines.push("턱 분량 각 " + f2(tk.perTuckCm) + " × 4 = " + f2(tk.totalCm) + " cm (실제 뒤 바깥 " + f2(op["back-outer"].openedCm) + " · 뒤 안 " + f2(op["back-inner"].openedCm) + " · 앞 안 " + f2(op["front-inner"].openedCm) + " · 앞 바깥 " + f2(op["front-outer"].openedCm) + ")");
    lines.push("턱 방향: 바깥쪽으로 접음 · 소매 중심 쪽 천이 위 · 박기 끝 미확정(표시 안 함)");
    lines.push("소매폭 " + f2(m.widthCm) + " → " + f2(m.widthAfterCm) + " cm · 소매산 높이 그대로 · 소매길이 " + f2(m.sleeveLengthCm));
    lines.push("소맷부리(자연 곡선, 기준점·양 끝 그대로) " + f2(m.hemCm) + " cm · Ⓐ " + f2(m.hem.sleeveACm) + " · 차 " + (m.hem.diffFromSleeveACm >= 0 ? "+" : "") + m.hem.diffFromSleeveACm.toFixed(4) + " cm");
    if (s.warnings.indexOf("inner-tuck-layers-overlap") >= 0) lines.push("⚠ 턱 분량이 2cm 를 넘어 안쪽 두 턱의 접힌 천이 가운데 띠 아래에서 겹칩니다(두께 확인)");
    var BC = window.bodiceCheckpoint, SF = window.designSleeveF, bodice = BC && BC.latest(project);
    var lens = (SF && w.geometry && w.geometry.sleeve) ? SF.capLengthsOf(w.geometry.sleeve) : null;
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

  window.sleeveFApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
