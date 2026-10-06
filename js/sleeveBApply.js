// ══════════════════════════════════════════════
// sleeveBApply.js — 소매 Ⓑ(designSleeveB, P.41 타이트)를 design 프로젝트 상태에 연결한다. DOM·storage 미접근(ui.js 가 호출).
//
// sleeveAApply 와 같은 구조다. 완성된 bodiceResult 를 **읽기 전용으로** Ⓐ 로 제도(draftSleeveA)하고, 그 결과를 Ⓑ 의 출발 원형으로
// draftSleeveB 에 넘긴다(엔진 계약 그대로 — 입력 = draftSleeveA 반환 {geometry, meta}). 결과를
//   · working.sleeveB   (프리셋 id·출처 hash·입력(소매길이·손바닥 둘레)·확인용 meta·경고·차단 사유)
//   · working.geometry.sleeve (render/layout 미러 — fairing 된 단일 outline + construction. raw rigid 는 meta 에만 있고 그리지 않는다)
// 에 쓴다. bodiceResult·sourceBlock·referenceGeometry·working.sleeveDraft·working.sleeveResult·working.sleeveA 는 건드리지 않는다
// (Ⓐ/Ⓑ 상호 배타는 ui.js 가 맡는다).
//
// ★ 소매-몸판 연결의 지배 ease 는 **최종 geometry 를 직접 측정한 cap.ease**(sleeveCheckpoint)다. meta.easeTarget/easeAfter 는 감사 정보 —
//   여기 infoLines 도 geometry 실측을 보여 준다.
// ★ 손바닥 둘레는 선택 입력 — 비어 있으면(null) 기본 커프 W×3/4. 목표 커프 < 손바닥+3 이면 엔진 경고(hem-below-palm-allowance)만 표시하고
//   자동 보정하지 않는다.
// ★ 실패하면 이전 상태를 그대로 둔다. 추측 폴백(Ⓐ·기본 소매)을 쓰지 않고 사유만 낸다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-B";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }
  function pieceKo(p) { return p === "front" ? "앞" : p === "back" ? "뒤" : ""; }

  // Ⓑ 엔진 사유 → 한글. 코드 분기는 reason 으로, 화면용 문장만 만든다. Ⓐ 단계 사유는 sleeveAApply.failText 에 위임.
  var REASONS = {
    "invalid-palm-circumference": "손바닥 둘레 값 확인(0 보다 큰 수)",
    "no-sleeve-a": "Ⓑ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "no-cap-intersection": "절개축이 소매산 곡선과 만나지 않음",
    "ambiguous-cap-intersection": "절개축이 소매산 곡선과 여러 곳에서 만남",
    "cut-axis-degenerate": "절개축을 정할 수 없음(소매산 교점이 소맷부리에 너무 가까움)",
    "closure-exceeds-outer-width": "맞댐량이 바깥 조각 폭보다 큼",
    "closure-rotation-too-large": "맞댐 회전각이 한계(30°)를 넘음(극단 치수)",
    "closure-rotation-degenerate": "맞댐 회전각을 정할 수 없음",
    "fairing-interval-degenerate": "소매산 정리 구간을 정할 수 없음",
    "fairing-cap-length-below-chord": "소매산 정리 곡선이 호 길이에 못 미침",
    "fairing-cap-length-unreachable": "소매산 정리 곡선의 호 길이를 맞출 수 없음",
    "self-intersection": "소매 외곽이 자기 교차함",
    "fairing-cap-deviation": "소매산 정리 편차가 한계를 넘음",
    "fairing-cap-new-inflection": "소매산 정리가 새 변곡을 만듦",
    "fairing-cap-length-drift": "소매산 정리가 소매산 길이를 바꿈",
    "fairing-cuff-not-monotone": "소맷부리 곡선이 위로 올라감",
    "fairing-cuff-inflection": "소맷부리 곡선에 변곡이 생김",
    "fairing-cuff-length-drift": "소맷부리 길이가 W×3/4 와 어긋남",
    "no-module": "소매 Ⓑ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    var base = REASONS[r.reason] || ("소매 Ⓑ 를 만들 수 없음(" + r.reason + ")");
    var pc = r.piece ? pieceKo(r.piece) : "";
    var det = fin(r.detail) ? " · " + f2(r.detail) : "";
    return (pc ? pc + "판: " : "") + base + det;
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.piece) o.piece = r.piece; if (r.detail !== undefined) o.detail = r.detail; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveB); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveB && w.sleeveB.blocked); }

  // 빈 값(undefined·null·"")은 «입력 없음». 그 외는 엔진이 검증(0 이하·비수치 → invalid-palm-circumference).
  function palmOf(v) { return (v === undefined || v === null || v === "") ? null : v; }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). → { ok, geometry, meta, warnings, sourceBodiceHash, sourceSleeveAHash } | { ok:false, reason, text }
  function draft(project, sleeveLengthCm, palmCircumferenceCm) {
    var SA = window.designSleeveA, SB = window.designSleeveB, SAA = window.sleeveAApply;
    if (!SA || !SB || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var a = SAA.draft(project, sleeveLengthCm);      // 몸판 읽기 전용 → Ⓐ (실패 사유는 Ⓐ 문구 그대로)
    if (!a.ok) return fail(a, "A");
    var palm = palmOf(palmCircumferenceCm);
    var b = SB.draftSleeveB(a, palm === null ? {} : { palmCircumferenceCm: palm });
    if (!b.ok) return fail(b);
    b.sourceBodiceHash = a.sourceBodiceHash;
    return b;
  }

  function stateOf(r, sleeveLengthCm, palm) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: { sleeveLengthCm: sleeveLengthCm, palmCircumferenceCm: palmOf(palm) },
      meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }

  // 적용: 성공 시 working.sleeveB + working.geometry.sleeve 갱신. 실패 시 아무것도 바꾸지 않는다.
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var len = params && params.sleeveLengthCm, palm = params && params.palmCircumferenceCm;
    var r = draft(project, len, palm);
    if (!r.ok) return r;
    w.sleeveB = stateOf(r, len, palm);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveB };
  }

  // body apply·몸판 재완료 뒤 호출(refreshSleeve). Ⓑ 가 꺼져 있으면 아무것도 안 한다.
  //   실패 → sleeveB.blocked 에 사유를 남기고 geometry 는 건드리지 않는다(조용히 다른 소매로 바꾸지 않음).
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveB) return { ok: true, active: false };
    var len = w.sleeveB.parameters.sleeveLengthCm, palm = w.sleeveB.parameters.palmCircumferenceCm;
    var r = draft(project, len, palm);
    if (!r.ok) {
      w.sleeveB.blocked = { reason: r.reason, piece: r.piece || null, text: r.text };
      return r;
    }
    w.sleeveB = stateOf(r, len, palm);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveB };
  }

  // Ⓑ 해제. geometry.sleeve 복원은 호출부가 한다.
  function clear(project) { var w = work(project); if (w) w.sleeveB = null; }

  // 화면 표시용 줄. 패턴명 / 소매폭→소맷부리 / 소매길이 / 앞뒤 AH·소매산 / 이세(geometry 실측) / 손바닥 / 경고.
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveB; if (!s) return [];
    var P = window.sleevePresets, v = P && P.variant("tight-sleeve", PRESET_ID);
    var lines = [(v ? "타이트 소매 Ⓑ" : "소매 Ⓑ") + " · 소매 Ⓐ 에서 소맷부리 W×3/4 로 맞댐 (P.41)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text); return lines; }
    var m = s.meta;
    lines.push("소매폭 " + f2(m.widthCm) + " → 소맷부리 " + f2(m.hemCm) + " (목표 " + f2(m.hemTargetCm) + ") · 맞댐 ● " + f2(m.closeTotalCm) + " · 소매길이 " + f2(m.sleeveLengthCm) + " cm");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths) {
      var a = bodice.armholeLengths;
      lines.push("AH 앞 " + f2(a.front) + " · 뒤 " + f2(a.back) + " · 총 " + f2(a.front + a.back) + " cm");
      if (prim) {   // 지배 ease = 최종 geometry 실측(cap.ease 와 같은 계산). meta.easeTarget/easeAfter 는 감사 정보라 표시하지 않는다.
        var ef = prim.lengths.front - a.front, eb = prim.lengths.back - a.back;
        lines.push("소매산 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm");
        lines.push("이세(실측) 앞 " + sgn(ef) + " · 뒤 " + sgn(eb) + " · 총 " + sgn(ef + eb) + " cm");
      }
    }
    if (m.palm) {
      lines.push("손바닥 둘레 " + f2(m.palm.circumferenceCm) + " + 여유 " + f2(m.palm.allowanceCm) + " = 소맷부리 최소 " + f2(m.palm.minHemCm) + " cm");
    }
    if (s.warnings.indexOf("hem-below-palm-allowance") >= 0 && m.palm) {
      lines.push("⚠ 소맷부리 " + f2(m.hemTargetCm) + " 가 손바닥+3cm(" + f2(m.palm.minHemCm) + ")보다 " + f2(m.palm.shortfallCm) + "cm 작음 — 자동 보정하지 않음(입력·소매폭 확인)");
    }
    return lines;
  }

  window.sleeveBApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
