// ══════════════════════════════════════════════
// sleeveCApply.js — 소매 Ⓒ(designSleeveC, P.41 하단 타이트 + 뒤 소맷부리 다트)를 design 프로젝트 상태에 연결한다. DOM·storage 미접근(ui.js 가 호출).
//
// sleeveBApply 와 같은 구조다. 완성된 bodiceResult 를 **읽기 전용으로** Ⓐ 로 제도(draftSleeveA)하고, 그 결과를 Ⓒ 의 출발 원형으로
// draftSleeveC 에 넘긴다(엔진 계약 그대로). 결과를
//   · working.sleeveC   (프리셋 id·출처 hash·입력(소매길이·EL)·확인용 meta·경고·차단 사유)
//   · working.geometry.sleeve (render/layout 미러 — 정리(fairing)된 단일 outline + 표시용 construction)
// 에 쓴다. bodiceResult·sourceBlock·referenceGeometry·working.sleeveDraft·working.sleeveResult·working.sleeveA/B 는 건드리지 않는다
// (기본/Ⓐ/Ⓑ/Ⓒ 상호 배타는 ui.js 가 맡는다).
//
// ★ 입력: 소매길이 + 팔꿈치 길이 EL(SP→팔꿈치선, 기본 31.4). EL 은 엔진이 검증한다 — 빈 값("")·비수치는 **기본값으로 바꾸지 않고** 거부한다.
// ★ 표시용 construction 은 중심선·EL 선·뒤/앞 절개축만 남긴다(겹침 내부 경계·절개변 같은 엔진 내부선은 outline 에도 UI 에도 올리지 않는다).
// ★ 소매-몸판 연결의 지배 ease 는 **최종 geometry 를 직접 측정한 cap.ease**(sleeveCheckpoint)다. 여기 infoLines 도 geometry 실측을 보여 준다.
// ★ 실패하면 이전 상태를 그대로 두고 사유만 낸다(추측 폴백 없음). 이미 Ⓒ 가 켜져 있을 때의 실패(rederive·잘못된 EL)는 `blocked` 로 남겨
//   기존 정상 형상이 조용히 «현재 입력의 결과»처럼 쓰이지 않게 한다(완료 차단·경고 표시).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-C";
  var DEFAULT_EL = 31.4;
  var DISPLAY_CONSTRUCTION = { "center-line": 1, "elbow-line": 1, "cut-axis-back": 1, "cut-axis-front": 1 };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }
  function pieceKo(p) { return p === "front" ? "앞" : p === "back" ? "뒤" : ""; }

  // Ⓒ 엔진 사유 → 사용자 문구. 코드 분기는 reason 으로, 화면용 문장만 만든다. Ⓐ 단계 사유는 sleeveAApply.failText 에 위임.
  var REASONS = {
    "invalid-elbow-length": "팔꿈치 길이 EL 값을 확인하세요(0 보다 큰 수)",
    "elbow-too-close-to-hem": "EL 이 소맷부리에 너무 가깝습니다(EL 아래 길이 1cm 이상 필요) — EL 을 줄이세요",
    "elbow-above-underarm": "EL 이 아랫점·절개축 소매산 교점보다 위에 있습니다 — EL 을 늘리세요",
    "front-overlap-negative": "이 치수는 앞 겹침이 음수라(앞 반폭 중점이 소맷부리 구간 ● 보다 작음) 소매 Ⓒ 지원 범위 밖입니다",
    "front-overlap-zero": "이 치수는 앞 겹침이 0 이라 소매 Ⓒ 지원 범위 밖입니다",
    "front-rotation-too-large": "앞 회전각이 한계(30°)를 넘습니다 — 소매길이·EL 확인",
    "dart-negative": "뒤 다트 폭이 음수라 소매 Ⓒ 지원 범위 밖입니다",
    "dart-degenerate": "뒤 다트 폭이 너무 좁아(0.1cm 미만) 소매 Ⓒ 지원 범위 밖입니다",
    "dart-angle-too-large": "뒤 다트 꼭짓점각이 한계(45°)를 넘습니다 — EL 아래 길이가 짧습니다. EL 을 줄이거나 소매길이를 늘리세요",
    "dart-legs-unequal": "뒤 다트 두 다리 길이가 어긋남",
    "no-sleeve-a": "Ⓒ 의 출발 소매 Ⓐ 를 만들 수 없음",
    "invalid-sleeve-a": "Ⓐ 소매 형상을 읽을 수 없음",
    "invalid-width": "소매폭을 읽을 수 없음",
    "no-cap-intersection": "절개축이 소매산 곡선과 만나지 않음",
    "self-intersection": "소매 외곽이 자기 교차함",
    "discontinuous": "소매 외곽이 끊김",
    "spike": "소매 외곽에 뾰족한 꺾임이 생김",
    "cuff-sections-not-1-2-1": "소맷부리 세 구간이 ●:2●:● 와 어긋남",
    "cap-length-drift": "소매산 길이가 바뀜",
    "ease-mismatch": "이세가 출발 소매 Ⓐ 와 어긋남",
    "invalid-input": "입력 값을 확인하세요",
    "no-module": "소매 Ⓒ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var SAA = window.sleeveAApply;
    if (r.stage === "A" && SAA) return "출발 소매 Ⓐ: " + SAA.failText(r);
    var base = REASONS[r.reason];
    if (!base) base = /^fairing-/.test(r.reason || "") ? "소매 곡선 정리 단계에서 조건을 만족하지 못함(" + r.reason + ")" : ("소매 Ⓒ 를 만들 수 없음(" + r.reason + ")");
    var pc = r.piece ? pieceKo(r.piece) : "";
    var det = (r.reason === "front-overlap-negative" && fin(r.detail)) ? " (" + f2(r.detail) + "cm)" : "";
    return (pc ? pc + "판: " : "") + base + det;
  }
  function fail(r, stage) { var o = { ok: false, reason: r.reason }; if (r.piece) o.piece = r.piece; if (r.detail !== undefined) o.detail = r.detail; if (r.outOfSupportedRange) o.outOfSupportedRange = true; if (stage) o.stage = stage; o.text = failText(o); return o; }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveC); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveC && w.sleeveC.blocked); }

  // EL: undefined/null → 기본 31.4. ""(빈 입력)·비수치는 기본값으로 바꾸지 않고 엔진이 거부하도록 그대로 넘긴다("" 만 여기서 거부 — 엔진은 ""를 기본값으로 본다).
  function elbowOf(v) { return (v === undefined || v === null) ? DEFAULT_EL : v; }
  function displayGeometry(g) {
    var o = clone(g);
    o.construction = (o.construction || []).filter(function (s) { return DISPLAY_CONSTRUCTION[s.role]; });
    return o;
  }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). → { ok, geometry, meta, warnings, sourceBodiceHash, sourceSleeveAHash } | { ok:false, reason, text }
  function draft(project, sleeveLengthCm, elbowLengthCm) {
    var SA = window.designSleeveA, SC = window.designSleeveC, SAA = window.sleeveAApply;
    if (!SA || !SC || !SAA) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var el = elbowOf(elbowLengthCm);
    if (el === "" || typeof el !== "number" || !isFinite(el) || !(el > 0)) return fail({ reason: "invalid-elbow-length" });
    var a = SAA.draft(project, sleeveLengthCm);      // 몸판 읽기 전용 → Ⓐ (실패 사유는 Ⓐ 문구 그대로)
    if (!a.ok) return fail(a, "A");
    var c = SC.draftSleeveC(a, { elbowLengthCm: el });
    if (!c.ok) return fail(c);
    return { ok: true, geometry: displayGeometry(c.geometry), meta: c.meta, warnings: c.warnings, sourceBodiceHash: a.sourceBodiceHash, sourceSleeveAHash: c.sourceSleeveAHash };
  }

  function stateOf(r, sleeveLengthCm, elbowLengthCm) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, sourceSleeveAHash: r.sourceSleeveAHash,
      parameters: { sleeveLengthCm: sleeveLengthCm, elbowLengthCm: elbowOf(elbowLengthCm) },
      meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }

  // 적용: 성공 시 working.sleeveC + working.geometry.sleeve 갱신. 실패 시 아무것도 바꾸지 않는다(이미 Ⓒ 가 켜져 있으면 reject 로 차단 표시는 호출부 몫).
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = "디자인 프로젝트 없음"; return e; }
    var len = params && params.sleeveLengthCm, el = params ? params.elbowLengthCm : undefined;
    var r = draft(project, len, el);
    if (!r.ok) return r;
    w.sleeveC = stateOf(r, len, el);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveC };
  }

  // 입력·적용 실패를 Ⓒ 가 켜져 있는 상태에 반영한다 — 이전(정상) geometry 가 현재 입력의 결과처럼 남지 않게 blocked 로 표시(완료 차단).
  function reject(project, r) {
    var w = work(project); if (!w || !w.sleeveC) return false;
    w.sleeveC.blocked = { reason: r.reason || "invalid-input", piece: r.piece || null, text: r.text || failText(r), attempted: true };
    return true;
  }

  // body apply·몸판 재완료 뒤 호출(refreshSleeve). Ⓒ 가 꺼져 있으면 아무것도 안 한다.
  //   실패 → sleeveC.blocked 에 사유를 남기고 geometry 는 건드리지 않는다(조용히 다른 소매로 바꾸지 않음).
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveC) return { ok: true, active: false };
    var len = w.sleeveC.parameters.sleeveLengthCm, el = w.sleeveC.parameters.elbowLengthCm;
    var r = draft(project, len, el);
    if (!r.ok) {
      w.sleeveC.blocked = { reason: r.reason, piece: r.piece || null, text: r.text };
      return r;
    }
    w.sleeveC = stateOf(r, len, el);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveC };
  }

  // Ⓒ 해제. geometry.sleeve 복원은 호출부가 한다.
  function clear(project) { var w = work(project); if (w) w.sleeveC = null; }

  // 화면 표시용 줄(앞/뒤 구분 · 소맷부리 목표/실제 · EL · 뒤 다트 · 앞 겹침 · 소매산/이세 geometry 실측). 내부 디버그 값은 올리지 않는다.
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveC; if (!s) return [];
    var lines = ["타이트 소매 Ⓒ · 소매 Ⓐ 에서 소맷부리 W×3/4 + 뒤 소맷부리 다트 (P.41)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text + " · 화면의 소매는 이전 입력·몸판의 형상이라 완료할 수 없습니다 — 입력·몸판을 확인한 뒤 다시 적용하세요"); return lines; }
    var m = s.meta, sec = m.sections, a = sec.actual;
    lines.push("소맷부리 목표 " + f2(m.hemTargetCm) + " · 실제(호 길이) " + f2(m.hemCm) + " cm · 소매폭 " + f2(m.widthCm) + " · 소매길이 " + f2(m.sleeveLengthCm));
    lines.push("소맷부리 구간 뒤 " + f2(a.backOuter) + " : 중앙 " + f2(a.center) + " : 앞 " + f2(a.frontOuter) + " cm (목표 ● " + f2(sec.unitCm) + " : 2● : ●)");
    lines.push("팔꿈치 EL " + f2(m.elbowLengthCm) + " cm (SP 기준) · EL 아래 " + f2(m.lowerLengthCm) + " cm");
    lines.push("뒤: 열린 봉제 다트 · EL 꼭짓점 → 소맷부리 · 폭 " + f2(m.back.dartWidthAtHemCm) + " · 다리 " + f2(m.back.legCenter.lengthCm) + " cm");
    lines.push("앞: 겹침 " + f2(m.front.overlapCm) + " cm(계산) · 회전 " + f2(m.front.angleDeg) + "° · EL 쪽 벌어짐 없음");
    var BC = window.bodiceCheckpoint, DS = window.designSleeve, bodice = BC && BC.latest(project);
    var prim = (DS && w.geometry && w.geometry.sleeve) ? DS.capPrimitives(w.geometry.sleeve) : null;
    if (bodice && bodice.armholeLengths) {
      var ah = bodice.armholeLengths;
      lines.push("AH 앞 " + f2(ah.front) + " · 뒤 " + f2(ah.back) + " · 총 " + f2(ah.front + ah.back) + " cm");
      if (prim) {   // 지배 ease = 최종 geometry 실측(cap.ease 와 같은 계산)
        var ef = prim.lengths.front - ah.front, eb = prim.lengths.back - ah.back;
        lines.push("소매산 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm");
        lines.push("이세(실측) 앞 " + sgn(ef) + " · 뒤 " + sgn(eb) + " · 총 " + sgn(ef + eb) + " cm");
      }
    }
    return lines;
  }

  window.sleeveCApply = Object.freeze({ PRESET_ID: PRESET_ID, DEFAULT_ELBOW_CM: DEFAULT_EL, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    reject: reject, rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
