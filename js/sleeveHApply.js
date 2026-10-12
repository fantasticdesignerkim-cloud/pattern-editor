// ══════════════════════════════════════════════
// sleeveHApply.js — 소매 Ⓗ(designSleeveH, P.44 퍼프 «EL 아래로 절개선을 넣고, 소맷부리만 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다. DOM·storage 미접근(ui.js 가 호출).
// sleeveEApply 와 같은 구조. 입력: 소매길이 · 팔꿈치 길이 EL(기본 31.4) · 손바닥 둘레(기본 21) · ★ 가운데 내림(기본 3.5) — 김님 확정, 모두 수정 가능.
//   · working.sleeveH (프리셋·출처 hash·입력·meta·경고·차단) · working.geometry.sleeve (재단 외곽 + 표시 construction)
// ★ 화면 검토용 시안(최종 형상 승인 전). 소매산 = Ⓐ(이세 = Ⓐ, capPrimitives 실측) · 소맷부리 개더는 커프스 달림 ● 에 대해 따로 표시. 커프스 조각은 만들지 않는다(치수 정보만).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-H";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "el-line": 1, "drop": 1, "cut-a-back": 1, "cut-a-front": 1, "cut-b-inner-back": 1, "cut-b-outer-back": 1, "cut-b-inner-front": 1, "cut-b-outer-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓗ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "invalid-elbow-length": "팔꿈치 길이 EL 값을 확인하세요",
    "invalid-palm": "손바닥 둘레 값을 확인하세요",
    "invalid-drop": "★(가운데 내림) 값을 확인하세요",
    "el-out-of-range": "EL 이 위팔선 위이거나 소맷부리 아래라 EL 아래를 자를 수 없습니다 — 소매 Ⓗ 지원 범위 밖(기하)",
    "no-spread": "커프스 달림(손바닥 + 3)이 Ⓐ 소맷부리의 절반 이하라 벌릴 분량이 없습니다 — 소매 Ⓗ 지원 범위 밖(기하)",
    "spread-too-large": "벌림 분량이 EL~소맷부리 길이보다 커서 소매 Ⓗ 지원 범위 밖입니다(기하)",
    "spread-incompatible": "이 조합으로는 b 절개를 같은 분량으로 벌릴 수 없습니다 — 소매 Ⓗ 지원 범위 밖(기하)",
    "pieces-overlap": "이 조합에서는 조각이 겹칩니다(예: ★ 가 작아 가운데 조각 위끝이 EL 위로 올라감) — 소매 Ⓗ 지원 범위 밖(기하)",
    "spread-direction": "벌림 방향이 바깥이 아님",
    "hem-g1-break": "소맷부리 곡선 이음이 매끄럽지 않습니다",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓗ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓗ 를 만들 수 없음(" + r.reason + ")");
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveH); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveH && w.sleeveH.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음).
  function draft(project, p) {
    var SA = window.designSleeveA, SH = window.designSleeveH, SAA = window.sleeveAApply;
    if (!SA || !SH || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SH.draftSleeveH(a, { elbowLengthCm: p.elbowLengthCm, palmCircumferenceCm: p.palmCircumferenceCm, dropCm: p.dropCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, elbowLengthCm: x && x.elbowLengthCm, palmCircumferenceCm: x && x.palmCircumferenceCm, dropCm: x && x.dropCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveH = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveH };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveH) return false;
    w.sleeveH.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveH) return { ok: true, active: false };
    var p = w.sleeveH.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveH.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveH = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveH };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveH = null; }

  // 화면 표시용 줄(패턴명 · 커프스·산식 · 실제 벌림 · 소맷부리 곡선 실측/개더 · 길이 구분 · AH/소매산/이세 geometry 실측).
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveH; if (!s) return [];
    var lines = ["퍼프 소매 Ⓗ (화면 검토용 시안) · 소매 Ⓐ 의 EL 아래만 a(중심선)·b(반폭 중점) 절개 — 가운데 ★ 내림 → a → 바깥 ☆ 기준 b (P.44)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, fo = m.formula, hm = m.hem, op = m.openedCm;
    lines.push("커프스 달림 ● = 손바닥 둘레 " + f2(m.cuff.palmCm) + " + 3 = " + f2(m.cuff.lengthCm) + " cm · 폭 " + f2(m.cuff.widthCm) + " cm (치수 정보 — 커프스 조각 없음)");
    lines.push("산식: ■ = Ⓐ 소맷부리 " + f2(m.widthCm) + " − ● = " + f2(fo.square) + " · ∅ = ● − ■ = " + f2(fo.spread) + " · 절개마다 ∅/3 " + f2(fo.perCut) + " (실제 a " + f2(op.a) + " · b 뒤 " + f2(op.bBack) + " · 앞 " + f2(op.bFront) + ")");
    var fr2 = hm.fair;
    lines.push("소맷부리(최종 곡선 실측 — 권위값) " + f2(hm.lengthCm) + " cm · 여유 산식 2● " + f2(hm.formulaHemCm) + " · 개더(실측) " + f2(hm.gatherCm) + " cm (커프스 ● 대비 ×" + f2(1 + hm.gatherRatio) + ") · 이전 8점 곡선 대비 " + sgn(fr2.changeFromPreviousCm));
    lines.push("소맷부리 truing(시안): 원래 모서리 최대 파임 " + fr2.maxCutCm.toFixed(2) + " · 바깥 덧댐 " + fr2.maxOutwardCm.toFixed(2) + " cm · 파낸 면적 " + fr2.areaCutCm2.toFixed(2) + " · 덧댄 면적 " + fr2.areaAddedCm2.toFixed(2) + " cm² · 변곡 " + fr2.inflections + " · 곡률 이음 연속" + (fr2.largeDeviationNote ? " · " + fr2.largeDeviationNote : ""));
    lines.push("EL " + f2(m.elbowLengthCm) + " (위는 Ⓐ 그대로) · ★ 가운데 내림 " + f2(m.drop.cm) + " · 회전 가운데 ±" + f2(m.rotationDeg.inner) + "° · 바깥(☆) 뒤 " + f2(m.rotationDeg.outerBack) + "° · 앞 " + f2(m.rotationDeg.outerFront) + "°");
    lines.push("소매길이: 입력 " + f2(m.centerLength.inputCm) + " · 펼친 중심 SP→소맷부리 " + (m.centerLength.spreadCm === null ? "—" : f2(m.centerLength.spreadCm)) + " cm (★ 로 늘어남 — 보정 안 함)");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths && prim) {
      var ah = bodice.armholeLengths, ef = prim.lengths.front - ah.front, eb = prim.lengths.back - ah.back;
      lines.push("소매산(= Ⓐ) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " cm · AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back) + " · 이세(실측) 총 " + sgn(ef + eb) + " cm — 소맷부리 개더와 별개");
    }
    return lines;
  }

  window.sleeveHApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
