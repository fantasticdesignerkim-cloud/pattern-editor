// ══════════════════════════════════════════════
// sleeveEApply.js — 소매 Ⓔ(designSleeveE, P.42 플레어 «절개선을 3개 넣고 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다. DOM·storage 미접근(ui.js 가 호출).
//
// sleeveCApply 와 같은 구조다. 완성된 bodiceResult 를 **읽기 전용으로** Ⓐ 로 제도(draftSleeveA)하고, 그 결과를 Ⓔ 의 출발 원형으로 draftSleeveE 에 넘긴다.
//   · working.sleeveE (프리셋 id·출처 hash·입력(소매길이)·확인용 meta·경고·차단 사유)
//   · working.geometry.sleeve (render/layout 미러 — 최종 곡선 단일 outline + 표시용 construction(중심선·절개변 6))
// bodiceResult·sourceBlock·referenceGeometry·working.sleeveEraft·working.sleeveResult·working.sleeveA/B/C/D 는 건드리지 않는다(라인 배타는 ui.js).
// ★ 입력: 소매길이만(플레어 = 소매폭×1 은 책 산식). 지배 ease 는 최종 geometry 실측(cap.ease, sleeveCheckpoint).
// ★ 실패하면 이전 상태를 그대로 두고 사유만 낸다. 이미 Ⓔ 가 켜져 있을 때의 실패는 `blocked` 로 남겨 완료를 막는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-E";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "cut-center-back": 1, "cut-center-front": 1, "cut-axis-back": 1, "cut-axis-front": 1, "cut-edge-back": 1, "cut-edge-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓔ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "flare-too-large": "플레어 벌림이 기준점~소맷부리 거리보다 커서 소매 Ⓔ 지원 범위 밖입니다",
    "rotation-too-large": "옆 조각 회전각이 한계(45°)를 넘어 소매 Ⓔ 지원 범위 밖입니다 — 소매길이를 확인하세요",
    "flare-direction": "벌림 방향이 바깥이 아님",
    "redraw-inflection-unavoidable": "소매산 기준점 꺾임을 변곡 없이 다시 그릴 수 없습니다 — 소매 Ⓔ 지원 범위 밖",
    "redraw-window-invalid": "소매산 재제도 구간을 잡을 수 없습니다(꺾임이 너무 가깝거나 짧음)",
    "redraw-g1-break": "소매산 재제도 이음이 매끄럽지 않습니다",
    "hem-g1-break": "소맷부리 곡선 이음이 매끄럽지 않습니다",
    "hem-inflection": "소맷부리 곡선에 변곡이 생깁니다 — 소매 Ⓔ 지원 범위 밖",
    "self-intersection": "소매 외곽이 자기 교차함",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "cap-split-failed": "소매산 앞/뒤 분할점을 찾을 수 없음",
    "no-module": "소매 Ⓔ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓔ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveE); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveE && w.sleeveE.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, sleeveLengthCm) {
    var SA = window.designSleeveA, SE = window.designSleeveE, SAA = window.sleeveAApply;
    if (!SA || !SE || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SE.draftSleeveE(a, {});
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function stateOf(r, sleeveLengthCm) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: { sleeveLengthCm: sleeveLengthCm }, meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var len = params && params.sleeveLengthCm;
    var r = draft(project, len);
    if (!r.ok) return r;
    w.sleeveE = stateOf(r, len);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveE };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveE) return false;
    w.sleeveE.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveE) return { ok: true, active: false };
    var len = w.sleeveE.parameters.sleeveLengthCm;
    var r = draft(project, len);
    if (!r.ok) { w.sleeveE.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveE = stateOf(r, len);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveE };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveE = null; }

  // 화면 표시용 줄(패턴명 · 플레어 산식·실제 벌림 · 소맷부리 · 소매산 재제도 · AH/소매산/이세 geometry 실측).
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveE; if (!s) return [];
    var lines = ["플레어 소매 Ⓔ · 소매 Ⓐ 에서 절개 3개(가운데 SP 대칭 → 바깥)로 잘라서 벌림 (P.42)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, fl = m.flare;
    lines.push("플레어 ∅ = 소매폭 " + f2(m.widthCm) + " × 1 = " + f2(fl.totalCm) + " · 틈마다 " + f2(fl.perCutCm) + " (실제 뒤 " + f2(fl.openedCm.back) + " · 가운데 " + f2(fl.openedCm.center) + " · 앞 " + f2(fl.openedCm.front) + ")");
    lines.push("회전 가운데 ±" + f2(m.rotationDeg.center) + "°(SP 대칭) · 바깥 누적 뒤 " + f2(m.rotationDeg.backOuterTotal) + "° · 앞 " + f2(m.rotationDeg.frontOuterTotal) + "° · 소매길이 " + f2(m.sleeveLengthCm));
    lines.push("소맷부리(곡선) " + f2(m.hemCm) + " cm (벌리기 전 " + f2(m.hemBeforeCm) + ") · 옆선 앞 " + f2(m.seams.frontCm) + " / 뒤 " + f2(m.seams.backCm));
    lines.push("소매산: 꺾임 3곳(SP · 기준점)을 자연스럽게 다시 그림(잠정 구간 뒤 " + f2(m.redraw.ellChosenCm.Pb) + " · SP " + f2(m.redraw.ellChosenCm.SP) + " · 앞 " + f2(m.redraw.ellChosenCm.Pf) + "cm)");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths) {
      var ah = bodice.armholeLengths;
      lines.push("AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back) + " · 총 " + f2(ah.front + ah.back) + " cm");
      if (prim) {
        var ef = prim.lengths.front - ah.front, eb = prim.lengths.back - ah.back;
        lines.push("소매산 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm");
        lines.push("이세(실측) 앞 " + sgn(ef) + " · 뒤 " + sgn(eb) + " · 총 " + sgn(ef + eb) + " cm");
      }
    }
    return lines;
  }

  window.sleeveEApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
