// ══════════════════════════════════════════════
// sleeveMApply.js — 소매 Ⓜ(designSleeveM, P.46 하단 반소매 퍼프 «소매산과 소맷부리를 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매길이(기본 20 — SP → 출발 밑단) · 위팔 둘레(기본 26) · 소매산 상승(기본 0.5). 커프스 폭 1cm 는 치수 정보만.
// ★ 화면 검토용 시안. 최종 소매산 − AH = 이세 + 개더 총량 — Ⓐ 실측 이세와 추가 개더(최종 − Ⓐ 소매산)를 나눠 표시. 소맷부리는 최종 곡선 실측이 권위값(산식 1.7●·0.7● 는 따로).
// ★ ■ < 0 도 같은 산식(Ⓛ 승인 원칙). 멈춤 사유는 실제 기하와, 따로 표시하는 설정 한계(회전 수치 가드 45° · 가운데 틈 재제도 잠정 구간 상한) — 책 규칙·물리 불가로 표현하지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-M";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "cut-center-back": 1, "cut-center-front": 1,
    "cut-axis-back-inner": 1, "cut-edge-back-inner": 1, "cut-axis-back-outer": 1, "cut-edge-back-outer": 1,
    "cut-axis-front-inner": 1, "cut-edge-front-inner": 1, "cut-axis-front-outer": 1, "cut-edge-front-outer": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓜ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-upper-arm": "위팔 둘레 값을 확인하세요",
    "invalid-rise": "소매산 상승 값을 확인하세요(0 이상)",
    "no-spread": "∅ = 0.7● − ■ = 1.7● − Ⓐ 소매폭 이 0 이하라 벌릴 분량이 없습니다(위팔 둘레가 Ⓐ 소매폭에 비해 작음)",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "flare-too-large": "벌림 현이 기준점~소맷부리 거리의 2배를 넘어 조각을 그만큼 돌릴 수 없습니다(기하)",
    "rotation-too-large": "바깥 조각의 회전 합(중간 + 바깥)이 설정된 수치 가드 45° 를 넘었습니다 — 책 규칙이 아닌 구현 가드이며, 물리적으로 불가능하다는 판정은 아닙니다(소매길이가 짧거나 위팔 둘레가 클 때)",
    "bridge-inflection-unavoidable": "가운데 틈 위 소매산을 잠정 재제도 구간 상한(중심 쪽 호의 50%) 안에서 변곡 없이 이을 수 없습니다(상승이 클 때) — 책 규칙·물리적 불가가 아닌 잠정 설정의 한계입니다",
    "flare-direction": "벌림 방향이 바깥이 아님",
    "redraw-inflection-unavoidable": "소매산 기준점 꺾임을 변곡 없이 다시 그릴 수 없습니다(기하)",
    "redraw-window-invalid": "소매산 재제도 구간을 잡을 수 없습니다",
    "redraw-g1-break": "소매산 재제도 이음이 매끄럽지 않습니다",
    "hem-g1-break": "소맷부리 곡선 이음이 매끄럽지 않습니다",
    "hem-fair-inflection": "소맷부리를 변곡 없이 정리할 수 없습니다(기하)",
    "cap-split-failed": "소매산 앞/뒤 분할점을 찾을 수 없음",
    "pieces-overlap": "벌린 원래 종이 조각끼리 겹칩니다(기하)",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓜ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓜ 를 만들 수 없음(" + r.reason + ")");
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
  function isActive(project) { var w = work(project); return !!(w && w.sleeveM); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveM && w.sleeveM.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). 출발 Ⓐ = 같은 몸판 · 입력 소매길이(기본 20)로 새로 제도.
  function draft(project, p) {
    var SA = window.designSleeveA, SM = window.designSleeveM, SAA = window.sleeveAApply;
    if (!SA || !SM || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SM.draftSleeveM(a, { upperArmCm: p.upperArmCm, riseCm: p.riseCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, upperArmCm: x && x.upperArmCm, riseCm: x && x.riseCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveM = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveM };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveM) return false;
    // attemptedInputs: 거부된 그 입력(입력칸 원문) — 화면이 다른 값으로 바뀌어 다음 적용이 몰래 다른 값으로 가지 않게 ui 가 그대로 되돌려 놓는다.
    w.sleeveM.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveM) return { ok: true, active: false };
    var p = w.sleeveM.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveM.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveM = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveM };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveM = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveM; if (!s) return [];
    var lines = ["반소매 퍼프 Ⓜ (화면 검토용 시안) · 소매길이 " + f2(s.parameters.sleeveLengthCm) + " 의 소매 Ⓐ 에 절개 5개 — 가운데 평행 → 중간 조각 → 바깥 조각 순서로 소매산 기준점에서 회전 (P.46)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, fo = m.formula, hm = m.hem, op = m.flare.openedCm, fr = hm.fair, rd = m.redraw, rt = m.rotationDeg;
    lines.push("커프스 달림 ● = 위팔 둘레 " + f2(m.cuff.upperArmCm) + " + 4 = " + f2(m.cuff.lengthCm) + " cm · 폭 " + f2(m.cuff.widthCm) + " cm (치수 정보 — 커프스 조각 없음)");
    lines.push("산식: ■ = Ⓐ 소매폭 " + f2(m.widthCm) + " − ● = " + f2(fo.square) + " · ∅ = 0.7● − ■ = " + f2(fo.spread) + " · ⊠ = ∅/10 = " + f2(fo.unit) + " · 틈(현) 뒤 → 앞 ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠ (실제 "
      + [op.backOuter, op.backInner, op.center, op.frontInner, op.frontOuter].map(f2).join(" · ") + ") · 개더 계수 0.7 = 책 설정");
    lines.push("이동: 가운데 = 두 반쪽 좌우 2⊠ " + f2(fo.parallelEachSideCm) + " 평행(회전 없음 · 중심 쪽 조각 고정) · 중간 조각 뒤 " + f2(rt.backMid) + "° · 앞 " + f2(rt.frontMid) + "° → 바깥 조각 추가 뒤 " + f2(rt.backOuterRelative) + "° · 앞 " + f2(rt.frontOuterRelative)
      + "°(함께 운반된 기준점 중심 · 합 뒤 " + f2(rt.backOuterTotal) + "° · 앞 " + f2(rt.frontOuterTotal) + "°) · O·SP 는 중심선 절개로 갈라짐(기준 = 틈 이등분선)");
    lines.push("소맷부리(최종 곡선 실측 — 권위값) " + f2(hm.lengthCm) + " cm · 산식 1.7● " + f2(hm.formulaHemCm) + " · 개더(실측) " + f2(hm.gatherCm) + " cm · 산식 0.7● " + f2(hm.formulaGatherCm) + " (커프스 ● 대비 ×" + f2(1 + hm.gatherRatio) + ") · 도해의 물결 = 개더 표시(재단선 아님)");
    lines.push("소맷부리 truing(시안): 원래 밑단 최대 파임 " + fr.maxCutCm.toFixed(2) + " · 덧댐 " + fr.maxOutwardCm.toFixed(2) + " cm · 면적 파임 " + fr.areaCutCm2.toFixed(2) + " · 덧댐 " + fr.areaAddedCm2.toFixed(2) + " cm² · 변곡 " + fr.inflections + " · 곡률 이음 연속");
    lines.push("소매산 상승 " + f2(m.rise.cm) + " cm(설정값 — 개더 계수 0.7 과 별개) · 국소 재제도(잠정 — 책 규칙 아님): 가운데 틈 양쪽 " + f2(rd.center.ellCm) + " · 기준점 꺾임 뒤 바깥 " + f2(rd.kinks.ellChosenCm.Pb2) + " · 뒤 안쪽 " + f2(rd.kinks.ellChosenCm.Pb1)
      + " · 앞 안쪽 " + f2(rd.kinks.ellChosenCm.Pf1) + " · 앞 바깥 " + f2(rd.kinks.ellChosenCm.Pf2) + " cm(그 밖은 원래 소매산 그대로)");
    lines.push("길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 길이(새 꼭대기 → 소맷부리 곡선, 실측) " + f2(m.centerLength.spreadCm) + " cm");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths && prim) {
      var ah = bodice.armholeLengths, ca = m.capLengthsA, tf = prim.lengths.front - ah.front, tb = prim.lengths.back - ah.back;
      lines.push("소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm · AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back));
      if (ca) lines.push("Ⓐ 실측 이세 앞 " + sgn(ca.front - ah.front) + " · 뒤 " + sgn(ca.back - ah.back) + " · 총 " + sgn(ca.total - ah.front - ah.back) + " + 추가 개더(최종 − Ⓐ 소매산) 앞 " + sgn(prim.lengths.front - ca.front) + " · 뒤 " + sgn(prim.lengths.back - ca.back) + " · 총 " + sgn(prim.lengths.total - ca.total));
      lines.push("최종 소매산 − AH = 이세 + 개더 총량 앞 " + sgn(tf) + " · 뒤 " + sgn(tb) + " · 총 " + sgn(tf + tb) + " cm");
    }
    return lines;
  }

  window.sleeveMApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
