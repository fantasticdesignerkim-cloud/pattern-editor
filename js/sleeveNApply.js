// ══════════════════════════════════════════════
// sleeveNApply.js — 소매 Ⓝ(designSleeveN, P.47 반소매 퍼프 «소맷부리를 잘라서 벌린다» · 소맷부리 턱)를 design 프로젝트 상태에 연결한다.
// DOM·storage 미접근(ui.js 가 호출). 입력: 소매길이(기본 20 — SP → 출발 밑단) · 절개 위치(중심선 좌우 각, 기본 2.5) · 가운데 벌림(기본 4) ·
//   양옆 벌림(각, 기본 2) · 박기 끝(소맷부리에서, 기본 1.5). 전부 책 기본 설정값 — 수정 가능, 산식·불변 규칙 아님. 커프스·위팔·손바닥·상승·개더 입력 없음.
// ★ 화면 검토용 시안. 소맷부리 재단(펼친) 길이와 봉제(턱 접은) 길이는 최종 geometry 실측(designSleeveN.hemLengthsOf) — 참고 산식 W + 가운데 + 양옆은 따로.
// ★ 멈춤 사유는 실제 기하와, 따로 표시하는 설정 한계(회전 수치 가드 45° · 이 시안 접힘 모델의 범위) — 책 규칙·물리 불가로 표현하지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";

  // 봉제(소매 제도)용 진동 길이 — 저장 AH 에서 확인된 틈 메움 직선만 뺀 값(허리 이음선 Ⓜ·Ⓝ). 그 밖의 몸판은 저장 AH 그대로(2026-10-27).
  //   designSleeveA 가 없는 맥락(소매 Ⓐ 미사용 단독 계산)에서는 빼야 할 틈 기록(waistSeam.closedDart)이 없을 때만 저장 AH 와 같다고 확정할 수 있다 — 있으면 null.
  function sewnAH(b) {
    if (!b) return null; var S = window.designSleeveA; if (S && S.sewnArmholeLengths) return S.sewnArmholeLengths(b);
    var ws = b.waistSeam; return (ws && ((ws.front && ws.front.closedDart) || (ws.back && ws.back.closedDart))) ? null : (b.armholeLengths || null);
  }
  var PRESET_ID = "bunka-sleeve-N";
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "cut-center-back": 1, "cut-center-front": 1, "cut-axis-back": 1, "cut-edge-back": 1, "cut-axis-front": 1, "cut-edge-front": 1,
    "tuck-crease": 1, "tuck-place": 1, "tuck-mid": 1, "tuck-stitch-end": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }

  var REASONS = {
    "no-sleeve-a": "Ⓝ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-cut-offset": "절개 위치(중심선 좌우 각) 값을 확인하세요(0 보다 큼)",
    "invalid-center-tuck": "가운데 벌림 값을 확인하세요(0 보다 큼)",
    "invalid-side-tuck": "양옆 벌림 값을 확인하세요(0 보다 큼)",
    "invalid-stitch-end": "박기 끝 값을 확인하세요(0 보다 큼)",
    "cut-outside-sleeve": "절개선이 소매 폭 밖에 있습니다(절개 위치가 소매 반폭보다 큼 — 기하)",
    "no-cap-intersection": "절개선이 소매산 곡선과 만나지 않음",
    "spread-too-large": "벌림 현이 기준점~소맷부리 거리의 2배를 넘어 조각을 그만큼 돌릴 수 없습니다(기하)",
    "rotation-too-large": "바깥 조각의 회전 합(가운데 + 바깥)이 설정된 수치 가드 45° 를 넘었습니다 — 책 규칙이 아닌 구현 가드이며, 물리적으로 불가능하다는 판정은 아닙니다",
    "spread-direction": "벌림 방향이 바깥이 아님",
    "redraw-inflection-unavoidable": "소매산 기준점 꺾임을 변곡 없이 다시 그릴 수 없습니다(기하)",
    "redraw-window-invalid": "소매산 재제도 구간을 잡을 수 없습니다",
    "redraw-g1-break": "소매산 재제도 이음이 매끄럽지 않습니다",
    "cap-top-concave": "소매산 꼭대기가 오목하게 꺼집니다(가운데 벌림이 커서 SP 꺾임이 큼 — 기하)",
    "stitch-end-beyond-pivot": "박기 끝이 턱 다리 길이(소맷부리 → 기준점)를 넘습니다(기하)",
    "tuck-layer-exceeds-piece": "접혀 들어간 턱 겹이 그 위 조각 폭을 넘어 다음 절개선까지 갑니다 — 이 시안의 접힘 모델 범위 밖(절개 위치가 턱 분량의 반보다 좁음). 책 규칙·물리 불가 판정은 아닙니다",
    "fold-mid-mismatch": "턱 두 겹이 접힘 중간선에서 만나지 않음",
    "fold-mismatch": "턱을 접은 소맷부리가 출발 Ⓐ 와 맞지 않음",
    "fold-layer-mismatch": "접힌 턱 겹이 소맷부리·자기 자리와 맞지 않음",
    "fold-round-trip": "접기 → 펼치기 왕복이 원래 재단선으로 돌아오지 않음",
    "folded-hem-gap": "턱을 접은 소맷부리에 빈틈·겹침이 있음",
    "hem-owner-mismatch": "소맷부리 변과 조각·겹 대응이 맞지 않음",
    "hem-unmeasured": "소맷부리 길이를 잴 수 없음",
    "cap-split-failed": "소매산 앞/뒤 분할점을 찾을 수 없음",
    "pieces-overlap": "벌린 원래 종이 조각끼리 겹칩니다(기하)",
    "self-intersection": "소매 외곽이 자기 교차함(기하)",
    "discontinuous": "소매 외곽이 끊김",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓝ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    return REASONS[r.reason] || ("소매 Ⓝ 를 만들 수 없음(" + r.reason + ")");
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
  function isActive(project) { var w = work(project); return !!(w && w.sleeveN); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveN && w.sleeveN.blocked); }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). 출발 Ⓐ = 같은 몸판 · 입력 소매길이(기본 20)로 새로 제도.
  function draft(project, p) {
    var SA = window.designSleeveA, SN = window.designSleeveN, SAA = window.sleeveAApply;
    if (!SA || !SN || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, p.sleeveLengthCm);
    if (!a.ok) return fail(a, "A");
    var d = SN.draftSleeveN(a, { cutOffsetCm: p.cutOffsetCm, centerTuckCm: p.centerTuckCm, sideTuckCm: p.sideTuckCm, stitchEndCm: p.stitchEndCm });
    if (!d.ok) return fail(d);
    return { ok: true, geometry: displayGeometry(d.geometry), meta: d.meta, warnings: d.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: d.sourceSleeveAHash };
  }
  function paramsOf(x) { return { sleeveLengthCm: x && x.sleeveLengthCm, cutOffsetCm: x && x.cutOffsetCm, centerTuckCm: x && x.centerTuckCm, sideTuckCm: x && x.sideTuckCm, stitchEndCm: x && x.stitchEndCm }; }
  function stateOf(r, p) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: paramsOf(p), meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var p = paramsOf(params), r = draft(project, p);
    if (!r.ok) return r;
    w.sleeveN = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveN };
  }
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveN) return false;
    // attemptedInputs: 거부된 그 입력(입력칸 원문) — 화면이 다른 값으로 바뀌어 다음 적용이 몰래 다른 값으로 가지 않게 ui 가 그대로 되돌려 놓는다.
    w.sleeveN.blocked = { reason: r.reason || "invalid-input", text: r.text || failText(r), attempted: true, attemptedInputs: r.attemptedInputs || null };
    return true;
  }
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveN) return { ok: true, active: false };
    var p = w.sleeveN.parameters, r = draft(project, p);
    if (!r.ok) { w.sleeveN.blocked = { reason: r.reason, text: r.text }; return r; }
    w.sleeveN = stateOf(r, p);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveN };
  }
  function clear(project) { var w = work(project); if (w) w.sleeveN = null; }

  function infoLines(project) {
    var w = work(project), s = w && w.sleeveN; if (!s) return [];
    var lines = ["반소매 퍼프·소맷부리 턱 Ⓝ (화면 검토용 시안) · 소매길이 " + f2(s.parameters.sleeveLengthCm) + " 의 소매 Ⓐ 에 절개 3개(중심선 + 좌우 각 " + f2(s.parameters.cutOffsetCm) + ") — 가운데 SP 대칭 → 바깥 조각을 함께 움직인 기준점에서 회전 (P.47)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, st = m.settings, op = m.spread.openedCm, hm = m.hem, rd = m.redraw, rt = m.rotationDeg, fo = m.folded, tk = m.tucks;
    lines.push("설정(책 기본값 — 수정 가능, 산식 아님): 절개 중심선 좌우 각 " + f2(st.cutOffsetCm) + " · 벌림(소맷부리 현) 가운데 " + f2(st.centerTuckCm) + " · 양옆 각 " + f2(st.sideTuckCm) + " · 박기 끝 " + f2(st.stitchEndCm) + " cm · 커프스·개더 없음");
    lines.push("이동: 가운데 두 조각 SP 대칭 ±" + f2(rt.center) + "° → 바깥 조각 추가 뒤 " + f2(rt.backOuterRelative) + "° · 앞 " + f2(rt.frontOuterRelative) + "°(함께 운반된 기준점 중심) · 실제 벌림(현) 뒤 " + f2(op.back) + " · 가운데 " + f2(op.center) + " · 앞 " + f2(op.front));
    lines.push("턱: 중심 쪽으로 접음 — 양옆 = 바깥 조각 절개 변을 가운데 조각 변에 얹음(겹은 바깥 조각 아래) · 가운데 = 두 반쪽이 중심선에서 맞닿음(겹은 각 조각 아래) · 겹 폭 "
      + ["back-side", "center-back", "center-front", "front-side"].map(function (k) { return f2(tk[k].layerWidthCm); }).join(" / ") + " cm");
    lines.push("박기 끝 " + f2(st.stitchEndCm) + ": 소맷부리 ~ 박기 끝 띠에서 다리가 맞붙어 접힌 채 박힘(접은 상태) · 그 위는 풀려 볼륨 · 재단선 모양은 박기 끝 길이와 무관 · 박음 모양은 책에 없어 만들지 않음");
    lines.push("소맷부리(최종 geometry 실측) 재단(펼침) " + f2(hm.cutCm) + " · 봉제(턱 접음) " + f2(hm.sewnCm) + " cm (턱에 숨는 길이 " + f2(hm.hiddenCm) + ") · 참고 산식 W + 가운데 + 양옆 = " + f2(hm.formulaCutCm) + " · W " + f2(hm.formulaSewnCm));
    lines.push("접은 상태 소맷부리 = Ⓐ 직선(정리할 꺾임 없음 · 파임 " + f2(fo.cutCm) + " · 덧댐 " + f2(fo.addedCm) + ") → 좌표 역변환으로 펼친 재단선 · 접힘 중간선 꺾임 " + hm.kinkDeg.filter(function (v) { return v > 1e-6; }).map(f2).join(" / ") + "°");
    lines.push("소매산 국소 재제도(잠정 — 책 규칙 아님): 기준점 꺾임 뒤 " + f2(rd.ellChosenCm.Pb) + " · SP " + f2(rd.ellChosenCm.SP) + " · 앞 " + f2(rd.ellChosenCm.Pf) + " cm(그 밖은 원래 소매산 그대로) · 소매산 개더 없음");
    lines.push("길이: 입력 소매길이(SP → 출발 밑단) " + f2(m.centerLength.inputCm) + " · 벌린 뒤 중심 길이(새 꼭대기 → 소맷부리, 실측) " + f2(m.centerLength.spreadCm) + " cm");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && sewnAH(bodice) && prim) {
      var ah = sewnAH(bodice), tf = prim.lengths.front - ah.front, tb = prim.lengths.back - ah.back;
      lines.push("소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm · AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back) + " · 이세 앞 " + sgn(tf) + " · 뒤 " + sgn(tb) + " · 총 " + sgn(tf + tb) + " cm");
    }
    return lines;
  }

  window.sleeveNApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
