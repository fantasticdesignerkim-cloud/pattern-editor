// ══════════════════════════════════════════════
// sleeveLApply.js — 소매 Ⓛ(designSleeveL, P.46 반소매 퍼프 «소맷부리를 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매길이(기본 20 — SP → 출발 밑단) · 위팔 둘레(기본 26). 커프스 폭 1cm 는 치수 정보만.
// ★ 화면 검토용 시안. 소매산을 늘리지 않으므로 최종 소매산 − AH = 이세(개더 아님). 소맷부리는 최종 곡선 실측이 권위값(산식 1.5●·0.5● 는 따로 표시).
// ★ ■ < 0(커프스 달림 > Ⓐ 소매폭)도 같은 산식으로 제도한다(김님 2026-10-19). 막는 것은 실제 기하 문제(조각 겹침·자기교차·꼭대기 오목·연속성)와,
//   그것과 구분해 표시하는 설정된 수치 가드(회전 45° — 책 규칙 아님)뿐이다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  // 봉제(소매 제도)용 진동 길이 — 저장 AH 에서 확인된 틈 메움 직선만 뺀 값(허리 이음선 Ⓜ·Ⓝ). 그 밖의 몸판은 저장 AH 그대로(2026-10-27).
  //   designSleeveA 가 없는 맥락(소매 Ⓐ 미사용 단독 계산)에서는 빼야 할 틈 기록(waistSeam.closedDart)이 없을 때만 저장 AH 와 같다고 확정할 수 있다 — 있으면 null.
  function sewnAH(b) {
    if (!b) return null; var S = window.designSleeveA; if (S && S.sewnArmholeLengths) return S.sewnArmholeLengths(b);
    var ws = b.waistSeam; return (ws && ((ws.front && ws.front.closedDart) || (ws.back && ws.back.closedDart))) ? null : (b.armholeLengths || null);
  }
  var PRESET_ID = "bunka-sleeve-L";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "cut-center-back": 1, "cut-center-front": 1, "cut-axis-back": 1, "cut-axis-front": 1, "cut-edge-back": 1, "cut-edge-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓛ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "invalid-upper-arm": "위팔 둘레 값을 확인하세요",
    "no-spread": "∅ = 0.5● − ■ = 1.5● − Ⓐ 소매폭 이 0 이하라 벌릴 분량이 없습니다(위팔 둘레가 Ⓐ 소매폭에 비해 작음)",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "flare-too-large": "벌림 현이 기준점~소맷부리 거리의 2배를 넘어 조각을 그만큼 돌릴 수 없습니다(기하)",
    "rotation-too-large": "바깥 조각의 회전 합이 설정된 수치 가드 45° 를 넘었습니다 — 책 규칙이 아닌 구현 가드이며, 물리적으로 불가능하다는 판정은 아닙니다(소매길이가 짧거나 위팔 둘레가 클 때)",
    "cap-top-concave": "벌린 뒤 소매산 꼭대기(SP 재제도 구간)가 오목하게 꺼집니다(곡률이 검증 불감대 −0.01/cm 보다 작음) — 소매산 형상 문제로 제도를 멈춥니다",
    "pieces-overlap": "벌린 원래 종이 조각끼리 겹칩니다(기하)",
    "flare-direction": "벌림 방향이 바깥이 아님",
    "redraw-inflection-unavoidable": "소매산 꺾임을 변곡 없이 다시 그릴 수 없습니다 — 소매 Ⓛ 지원 범위 밖",
    "redraw-window-invalid": "소매산 재제도 구간을 잡을 수 없습니다",
    "redraw-g1-break": "소매산 재제도 이음이 매끄럽지 않습니다",
    "hem-g1-break": "소맷부리 곡선 이음이 매끄럽지 않습니다",
    "hem-fair-inflection": "소맷부리를 변곡 없이 정리할 수 없습니다 — 소매 Ⓛ 지원 범위 밖",
    "cap-split-failed": "소매산 앞/뒤 분할점을 찾을 수 없음",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓛ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓛ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) {
    var o = { ok: false, reason: r.reason };
    if (r.detail !== undefined) o.detail = r.detail;
    if (r.outOfSupportedRange) o.outOfSupportedRange = true;
    if (r.numericGuard) o.numericGuard = true;
    if (stage) o.stage = stage;
    o.text = failText(o);
    return o;
  }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveL); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveL && w.sleeveL.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). 출발 Ⓐ = 같은 몸판 · 입력 소매길이(기본 20)로 새로 제도.
  function draft(project, p) {
    var SA = window.designSleeveA, SL = window.designSleeveL, SAA = window.sleeveAApply;
    if (!SA || !SL || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SL.draftSleeveL(a, { upperArmCm: p.upperArmCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, upperArmCm: x && x.upperArmCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveL = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveL };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveL) return false;
    // attemptedInputs: 거부된 그 입력(입력칸 원문) — 화면이 다른 값(원형 기본 소매길이 등)으로 바뀌어 다음 적용이 몰래 다른 값으로 가지 않게 ui 가 그대로 되돌려 놓는다.
    w.sleeveL.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveL) return { ok: true, active: false };
    var p = w.sleeveL.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveL.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveL = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveL };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveL = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveL; if (!s) return [];
    var lines = ["반소매 퍼프 Ⓛ (화면 검토용 시안) · 소매길이 " + f2(s.parameters.sleeveLengthCm) + " 의 소매 Ⓐ 에 절개 3개(반폭 중점·중심선) — 가운데 SP 대칭 → 바깥 이동 기준점, 소맷부리만 벌림 (P.46)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, fo = m.formula, hm = m.hem, op = m.flare.openedCm, fr = hm.fair, rd = m.redraw;
    lines.push("커프스 달림 ● = 위팔 둘레 " + f2(m.cuff.upperArmCm) + " + 4 = " + f2(m.cuff.lengthCm) + " cm · 폭 " + f2(m.cuff.widthCm) + " cm (치수 정보 — 커프스 조각 없음)");
    lines.push("산식: ■ = Ⓐ 소매폭 " + f2(m.widthCm) + " − ● = " + f2(fo.square) + " · ∅ = 0.5● − ■ = " + f2(fo.spread) + " · ⊠ = ∅/4 = " + f2(fo.unit) + " · 틈(현) 가운데 2⊠ " + f2(m.flare.centerCm) + " · 양옆 ⊠ " + f2(m.flare.sideCm) + " (실제 뒤 " + f2(op.back) + " · 가운데 " + f2(op.center) + " · 앞 " + f2(op.front) + ")");
    lines.push("회전: 가운데 ±" + f2(m.rotationDeg.center) + "°(SP 대칭 — 전체 틈 2⊠ 에 맞춤) · 바깥 추가 뒤 " + f2(m.rotationDeg.backOuterRelative) + "° · 앞 " + f2(m.rotationDeg.frontOuterRelative) + "°(이동한 기준점 중심) · O 는 중심선 절개로 갈라짐(기준 = SP · 틈 이등분선)");
    lines.push("소맷부리(최종 곡선 실측 — 권위값) " + f2(hm.lengthCm) + " cm · 산식 1.5● " + f2(hm.formulaHemCm) + " · 개더(실측) " + f2(hm.gatherCm) + " cm · 산식 0.5● " + f2(hm.formulaGatherCm) + " (커프스 ● 대비 ×" + f2(1 + hm.gatherRatio) + ")");
    lines.push("소맷부리 truing(시안): 원래 밑단 최대 파임 " + fr.maxCutCm.toFixed(2) + " · 덧댐 " + fr.maxOutwardCm.toFixed(2) + " cm · 면적 파임 " + fr.areaCutCm2.toFixed(2) + " · 덧댐 " + fr.areaAddedCm2.toFixed(2) + " cm² · 변곡 " + fr.inflections + " · 곡률 이음 연속");
    lines.push("소매산: 꺾임 3곳 국소 재제도(잠정 구간 뒤 " + f2(rd.ellChosenCm.Pb) + " · SP " + f2(rd.ellChosenCm.SP) + " · 앞 " + f2(rd.ellChosenCm.Pf) + " cm · 꺾임 뒤 " + f2(rd.kinkDegRaw.Pb) + "° · SP " + f2(rd.kinkDegRaw.SP) + "° · 앞 " + f2(rd.kinkDegRaw.Pf) + "°) · 최종 꼭대기는 원래 SP 보다 " + f2(m.spBefore.y - m.sp.y) + " cm 위");
    lines.push("길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 길이(최종 꼭대기 → 소맷부리 곡선, 실측) " + f2(m.centerLength.spreadCm) + " cm");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && sewnAH(bodice) && prim) {
      var ah = sewnAH(bodice), ef = prim.lengths.front - ah.front, eb = prim.lengths.back - ah.back, ca = m.capLengthsA;
      lines.push("소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm" + (ca ? " (Ⓐ 대비 앞 " + sgn(prim.lengths.front - ca.front) + " · 뒤 " + sgn(prim.lengths.back - ca.back) + ")" : "") + " · AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back));
      lines.push("이세(실측 = 최종 소매산 − AH · 소매산 개더 없음) 앞 " + sgn(ef) + " · 뒤 " + sgn(eb) + " · 총 " + sgn(ef + eb) + " cm");
    }
    return lines;
  }

  window.sleeveLApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
