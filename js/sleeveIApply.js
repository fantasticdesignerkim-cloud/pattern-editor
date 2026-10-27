// ══════════════════════════════════════════════
// sleeveIApply.js — 소매 Ⓘ(designSleeveI, P.44 하단 퍼프 «소매산부터 절개선을 넣고, 소매산을 기준점으로 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매길이 · 손바닥 둘레(기본 21 — 수정 가능). 커프스 폭 1cm 는 치수 정보만.
// ★ 화면 검토용 시안. 지배 ease = 최종 소매산 실측(capPrimitives) − AH. 소맷부리 개더는 커프스 ● 대비 따로 표시.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  // 봉제(소매 제도)용 진동 길이 — 저장 AH 에서 확인된 틈 메움 직선만 뺀 값(허리 이음선 Ⓜ·Ⓝ). 그 밖의 몸판은 저장 AH 그대로(2026-10-27).
  //   designSleeveA 가 없는 맥락(소매 Ⓐ 미사용 단독 계산)에서는 빼야 할 틈 기록(waistSeam.closedDart)이 없을 때만 저장 AH 와 같다고 확정할 수 있다 — 있으면 null.
  function sewnAH(b) {
    if (!b) return null; var S = window.designSleeveA; if (S && S.sewnArmholeLengths) return S.sewnArmholeLengths(b);
    var ws = b.waistSeam; return (ws && ((ws.front && ws.front.closedDart) || (ws.back && ws.back.closedDart))) ? null : (b.armholeLengths || null);
  }
  var PRESET_ID = "bunka-sleeve-I";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "cut-center-back": 1, "cut-center-front": 1, "cut-axis-back": 1, "cut-axis-front": 1, "cut-edge-back": 1, "cut-edge-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓘ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "invalid-palm": "손바닥 둘레 값을 확인하세요",
    "no-spread": "커프스 달림(손바닥 + 3)이 Ⓐ 소맷부리의 절반 이하라 벌릴 분량이 없습니다 — 소매 Ⓘ 지원 범위 밖(기하)",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "flare-too-large": "벌림이 기준점~소맷부리 거리보다 커서 소매 Ⓘ 지원 범위 밖입니다(기하)",
    "rotation-too-large": "조각 회전각이 한계(45°)를 넘어 소매 Ⓘ 지원 범위 밖입니다(기하)",
    "flare-direction": "벌림 방향이 바깥이 아님",
    "redraw-inflection-unavoidable": "소매산 꺾임을 변곡 없이 다시 그릴 수 없습니다 — 소매 Ⓘ 지원 범위 밖",
    "redraw-window-invalid": "소매산 재제도 구간을 잡을 수 없습니다",
    "redraw-g1-break": "소매산 재제도 이음이 매끄럽지 않습니다",
    "hem-g1-break": "소맷부리 곡선 이음이 매끄럽지 않습니다",
    "hem-fair-inflection": "소맷부리를 변곡 없이 정리할 수 없습니다 — 소매 Ⓘ 지원 범위 밖",
    "cap-split-failed": "소매산 앞/뒤 분할점을 찾을 수 없음",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓘ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓘ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveI); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveI && w.sleeveI.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SA = window.designSleeveA, SI = window.designSleeveI, SAA = window.sleeveAApply;
    if (!SA || !SI || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SI.draftSleeveI(a, { palmCircumferenceCm: p.palmCircumferenceCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, palmCircumferenceCm: x && x.palmCircumferenceCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveI = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveI };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveI) return false;
    w.sleeveI.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveI) return { ok: true, active: false };
    var p = w.sleeveI.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveI.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveI = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveI };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveI = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveI; if (!s) return [];
    var lines = ["퍼프 소매 Ⓘ (화면 검토용 시안) · 소매 Ⓐ 에 절개 3개(반폭 중점·중심선) — 가운데 SP 대칭 → 바깥 이동 기준점, 소맷부리만 벌림 (P.44)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, fo = m.formula, hm = m.hem, op = m.flare.openedCm, fr = hm.fair;
    lines.push("커프스 달림 ● = 손바닥 둘레 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " cm · 폭 " + f2(m.cuff.widthCm) + " cm (치수 정보 — 커프스 조각 없음)");
    lines.push("산식: ■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(fo.square) + " · ∅ = ● − ■ = " + f2(fo.spread) + " · 틈마다 ∅/3 " + f2(fo.perCut) + " (실제 뒤 " + f2(op.back) + " · 가운데 " + f2(op.center) + " · 앞 " + f2(op.front) + ")");
    lines.push("회전: 가운데 ±" + f2(m.rotationDeg.center) + "°(SP 대칭) · 바깥 누적 뒤 " + f2(m.rotationDeg.backOuterTotal) + "° · 앞 " + f2(m.rotationDeg.frontOuterTotal) + "° · O 는 중심선 절개로 갈라짐(기준 = SP · 이등분선)");
    lines.push("소맷부리(최종 곡선 실측 — 권위값) " + f2(hm.lengthCm) + " cm · 여유 산식 2● " + f2(hm.formulaHemCm) + " · 개더(실측) " + f2(hm.gatherCm) + " cm (커프스 ● 대비 ×" + f2(1 + hm.gatherRatio) + ")");
    lines.push("소맷부리 truing(시안): 원래 모서리 최대 파임 " + fr.maxCutCm.toFixed(2) + " · 바깥 덧댐 " + fr.maxOutwardCm.toFixed(2) + " cm · 변곡 " + fr.inflections + " · 곡률 이음 연속");
    lines.push("소매산: 꺾임 3곳 국소 재제도(잠정 구간 뒤 " + f2(m.redraw.ellChosenCm.Pb) + " · SP " + f2(m.redraw.ellChosenCm.SP) + " · 앞 " + f2(m.redraw.ellChosenCm.Pf) + "cm) · 소매길이 입력 " + f2(m.centerLength.inputCm) + " · 펼친 중심 " + (m.centerLength.spreadCm === null ? "—" : f2(m.centerLength.spreadCm)) + " cm");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && sewnAH(bodice) && prim) {
      var ah = sewnAH(bodice), ef = prim.lengths.front - ah.front, eb = prim.lengths.back - ah.back, ca = m.capLengthsA;
      lines.push("소매산(실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " cm" + (ca ? " (Ⓐ 대비 앞 " + sgn(prim.lengths.front - ca.front) + " · 뒤 " + sgn(prim.lengths.back - ca.back) + ")" : "") + " · 이세(실측) 앞 " + sgn(ef) + " · 뒤 " + sgn(eb) + " · 총 " + sgn(ef + eb) + " cm — 소맷부리 개더와 별개");
    }
    return lines;
  }

  window.sleeveIApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
