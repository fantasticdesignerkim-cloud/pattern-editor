// ══════════════════════════════════════════════
// sleeveOApply.js — 소매 Ⓞ(designSleeveO, P.47 하단 턱트 슬리브 «소매산과 소맷부리를 잘라서 벌린다»)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매길이(기본 20 — SP → 출발 밑단) · 안쪽 절개(중심에서 좌우 각, 기본 1.25) · 절개 간격(안쪽 → 바깥, 기본 2.5) ·
//   틈마다 벌림(기본 2) · 소맷부리 박기 끝(기본 1.5). 전부 책 기본 설정값 — 수정 가능, 산식·불변 규칙 아님. 소매산 쪽 박음 길이는 책에 없어 미지정.
// ★ 화면 검토용 시안. 소매산·소맷부리 모두 재단(펼침)과 봉제(턱 접음) 길이를 최종 geometry 에서 따로 실측(designSleeveO.capLengthsOf / hemLengthsOf).
//   이세 = 턱 접은 소매산 − AH. 참고 W + 틈 합 · W 는 따로.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-O";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "tuck-crease-edge": 1, "tuck-place-edge": 1, "tuck-mid": 1, "tuck-crease": 1, "tuck-place": 1, "tuck-stitch-end": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓞ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-inner-offset": "안쪽 절개(중심에서 좌우 각) 값을 확인하세요(0 보다 큼)",
    "invalid-cut-spacing": "절개 간격(안쪽 → 바깥) 값을 확인하세요(0 보다 큼)",
    "invalid-spread": "벌림(틈마다) 값을 확인하세요(0 보다 큼)",
    "invalid-stitch-end": "박기 끝 값을 확인하세요(0 보다 큼)",
    "cut-outside-sleeve": "바깥 절개선이 소매 폭 밖에 있습니다(안쪽 절개 + 간격이 소매 반폭보다 큼 — 기하)",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "tuck-layer-exceeds-piece": "접혀 들어간 턱 겹이 그 위 조각 폭을 넘습니다 — 이 시안의 접힘 모델 범위 밖(가운데 띠는 뒤·앞 두 턱의 겹을 함께 받는다). 책 규칙·물리 불가 판정은 아닙니다",
    "stitch-end-beyond-cap": "박기 끝이 절개 다리 길이(소맷부리 → 소매산)를 넘습니다(기하)",
    "fold-mid-mismatch": "턱 두 겹이 접힘 중간선에서 만나지 않음",
    "fold-owner-mismatch": "재단선 변과 조각·겹 대응이 맞지 않음",
    "fold-mismatch": "턱을 접은 선이 출발 Ⓐ 와 맞지 않음",
    "fold-layer-mismatch": "접힌 턱 겹이 Ⓐ 선·자기 자리와 맞지 않음",
    "fold-round-trip": "접기 → 펼치기 왕복이 원래 재단선으로 돌아오지 않음",
    "folded-gap": "턱을 접은 선에 빈틈·겹침이 있음",
    "hem-order": "소맷부리 이음점 순서가 맞지 않음",
    "hem-unmeasured": "소맷부리 길이를 잴 수 없음",
    "cap-unmeasured": "소매산 길이를 잴 수 없음",
    "pieces-overlap": "벌린 원래 종이 조각끼리 겹칩니다(기하)",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓞ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓞ 를 만들 수 없음(" + r.reason + ")");
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
  function isActive(project) { var w = work(project); return !!(w && w.sleeveO); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveO && w.sleeveO.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  function draft(project, p) {
    var SA = window.designSleeveA, SO = window.designSleeveO, SAA = window.sleeveAApply;
    if (!SA || !SO || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SO.draftSleeveO(a, { innerOffsetCm: p.innerOffsetCm, cutSpacingCm: p.cutSpacingCm, spreadCm: p.spreadCm, stitchEndCm: p.stitchEndCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, innerOffsetCm: x && x.innerOffsetCm, cutSpacingCm: x && x.cutSpacingCm, spreadCm: x && x.spreadCm, stitchEndCm: x && x.stitchEndCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveO = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveO };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveO) return false;
    w.sleeveO.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveO) return { ok: true, active: false };
    var p = w.sleeveO.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveO.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveO = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveO };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveO = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveO; if (!s) return [];
    var st0 = s.parameters;
    var lines = ["턱트 슬리브 Ⓞ (화면 검토용 시안) · 소매길이 " + f2(st0.sleeveLengthCm) + " 의 소매 Ⓐ 에 평행 절개 4개(중심에서 ±" + f2(st0.innerOffsetCm) + " · ±" + f2(st0.innerOffsetCm + st0.cutSpacingCm) + ", 중심선은 자르지 않음) — 평행 벌림 (P.47)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, st = m.settings, sh = m.spread.shiftCm, hm = m.hem, cp = m.cap, fo = m.folded;
    lines.push("설정(책 기본값 — 수정 가능, 산식 아님): 안쪽 절개 중심에서 좌우 각 " + f2(st.innerOffsetCm) + "(가운데 띠 " + f2(2 * st.innerOffsetCm) + ") · 절개 간격 " + f2(st.cutSpacingCm) + " · 틈마다 벌림 " + f2(st.spreadCm) + " · 소맷부리 박기 끝 " + f2(st.stitchEndCm) + " cm");
    lines.push("이동(평행 · 회전 없음): 가운데 띠(SP·중심선) 고정 · 안쪽 띠 " + f2(sh.backInner) + " / +" + f2(sh.frontInner) + " · 바깥 조각 " + f2(sh.backOuter) + " / +" + f2(sh.frontOuter) + " cm · 소매폭 " + f2(m.widthCm) + " → " + f2(m.widthAfterCm));
    lines.push("턱: 소매산·소맷부리 모두 바깥쪽(소매 밑선 쪽)으로 접음 — 접는 선 = 중심 쪽 조각의 절개 변 → 바깥 조각 변에 얹음 · 겹(각 " + f2(st.spreadCm / 2) + ")은 중심 쪽 조각 아래 (Ⓝ 은 반대 방향)");
    lines.push("박기 끝: 소맷부리에서 " + f2(st.stitchEndCm) + " · 소매산 쪽 박음 길이 = 미지정(책에 수치 없음 — 임의 수치·박음 모양 없음) · 재단선 모양은 박기 끝 길이와 무관");
    lines.push("소매산(최종 geometry 실측) 재단(펼침) " + f2(cp.cutCm) + " · 봉제(턱 접음) " + f2(cp.sewnCm) + " cm (턱에 숨는 길이 " + f2(cp.hidden.total) + ") · Ⓐ 소매산 " + (m.capLengthsA ? f2(m.capLengthsA.total) : "-") + " · 소매산 개더 없음");
    lines.push("소맷부리(최종 geometry 실측) 재단(펼침) " + f2(hm.cutCm) + " · 봉제(턱 접음) " + f2(hm.sewnCm) + " cm · 참고 W + 틈 합 = " + f2(hm.formulaCutCm) + " · W " + f2(hm.formulaSewnCm));
    lines.push("접은 상태 = Ⓐ 선(정리할 꺾임 없음 · 파임 " + f2(fo.cutCm) + " · 덧댐 " + f2(fo.addedCm) + ") → 거울/평행 역변환으로 펼친 재단선 · 소맷부리는 직선 · 소매산 턱 입구는 접기로 정해진 모양");
    lines.push("길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 가운데 띠 고정이라 중심 길이 " + f2(m.centerLength.spreadCm) + " cm");
    var BC = window.bodiceCheckpoint, bodice = BC && BC.latest(project);
    if (bodice && bodice.armholeLengths) {
      var ah = bodice.armholeLengths, tf = cp.sewn.front - ah.front, tb = cp.sewn.back - ah.back;
      lines.push("소매산(턱 접음) 앞 " + f2(cp.sewn.front) + " · 뒤 " + f2(cp.sewn.back) + " · AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back) + " · 이세 앞 " + sgn(tf) + " · 뒤 " + sgn(tb) + " · 총 " + sgn(tf + tb) + " cm");
    }
    return lines;
  }

  window.sleeveOApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
