// ══════════════════════════════════════════════
// sleeveAApply.js — 소매 Ⓐ(designSleeveA)를 design 프로젝트 상태에 연결한다. DOM·storage 미접근(ui.js 가 호출).
//
// 한 가지만 한다: 완성된 bodiceResult 를 **읽기 전용으로** draftSleeveA 에 넘기고, 결과를
//   · working.sleeveA   (프리셋 id·출처 hash·소매길이·확인용 meta·차단 사유)
//   · working.geometry.sleeve (render/layout 미러 — render.js 무변경, 기존 소매와 같은 자리)
// 에 쓴다. bodiceResult·sourceBlock·referenceGeometry·working.sleeveDraft·working.sleeveResult 는 건드리지 않는다.
//
// ★ 기존 소매 경로(designSleeve 파생·소매산 편집)와 **별개**다. 소매 모양 완료는 sleeveCheckpoint 가 `working.sleeveA` 를 보고
//   Ⓐ 전용 분기(origin·inputs·meta 를 든 완료본)로 처리하고, 거기서 `draft()` 로 현재 geometry 를 재검증한다.
// ★ 실패하면 이전 상태를 그대로 둔다. 지원하지 않는 몸판에 추측 폴백(기본 소매·다른 규칙)을 쓰지 않고 사유만 낸다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var PRESET_ID = "bunka-sleeve-A";
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sgn(v) { return (v >= 0 ? "+" : "") + f2(v); }
  function pieceKo(p) { return p === "front" ? "앞" : p === "back" ? "뒤" : ""; }

  // 사유 → 한글. 엔진 reason 을 그대로 두고(코드 분기용) 화면용 문장만 만든다.
  var REASONS = {
    "no-project": "디자인 프로젝트 없음",
    "no-bodice": "몸판을 먼저 완료해야 합니다",
    "invalid-armhole-length": "몸판 진동둘레(앞·뒤 AH)를 읽을 수 없음",
    "no-armhole": "몸판 진동선을 찾을 수 없음",
    "ambiguous-shoulder-point": "진동 어깨점을 하나로 정할 수 없음",
    "ambiguous-underarm": "진동 아랫점(옆선 끝)을 하나로 정할 수 없음",
    "armhole-chain-unsupported": "진동선이 이어지지 않아 지원하지 않는 형태",
    "armhole-dart-missing": "열린 AH 다트의 다리를 찾을 수 없음",
    "armhole-dart-unclosable": "AH 다트를 닫아도 입구가 맞지 않음",
    "shoulder-dart-missing": "어깨선이 끊겼는데 어깨 다트 다리가 없음",
    "shoulder-dart-unclosable": "어깨 다트를 닫아도 입구가 맞지 않음",
    "armhole-underarm-mismatch": "앞·뒤 진동 아랫점 높이가 달라 지원하지 않는 몸판(진동이 회전·이동된 몸판)",
    "invalid-shoulder-height": "어깨 높이(어깨점→진동 아랫점)가 0 이하",
    "invalid-sleeve-length": "소매길이 값 확인(소매산 높이+1cm 이상이어야 함)",
    "invalid-elbow-length": "팔꿈치 길이 값 확인",
    "cap-height-exceeds-line": "소매산 높이가 SP→소매 아랫점 직선보다 큼",
    "adjust-exceeds-curve": "이세 조정량이 소매산 곡선 끝 구간을 넘음",
    "self-intersection": "소매 외곽이 자기 교차함",
    "cap-apex-not-sp": "소매산 곡선이 SP 위로 솟음",
    "no-module": "소매 Ⓐ 모듈을 불러오지 못함"
  };
  function failText(r) {
    if (!r) return "";
    var base = REASONS[r.reason] || ("소매 Ⓐ 를 만들 수 없음(" + r.reason + ")");
    var pc = r.piece ? pieceKo(r.piece) : "";
    var det = "";
    if (fin(r.detail)) det = " · " + f2(r.detail);
    else if (r.reason === "armhole-underarm-mismatch" && r.detail && fin(r.detail.front) && fin(r.detail.back)) det = " · 앞 " + f2(r.detail.front) + " / 뒤 " + f2(r.detail.back);
    return (pc ? pc + "판: " : "") + base + det;
  }

  function work(project) { return project && project.working ? project.working : null; }
  function isActive(project) { var w = work(project); return !!(w && w.sleeveA); }
  function isBlocked(project) { var w = work(project); return !!(w && w.sleeveA && w.sleeveA.blocked); }

  // 읽기 전용 입력으로 제도만 한다(상태 변경 없음). → draftSleeveA 결과 | { ok:false, reason, text }
  function draft(project, sleeveLengthCm) {
    var SA = (typeof window !== "undefined") && window.designSleeveA, BC = window.bodiceCheckpoint;
    if (!SA || !BC) { var m = { ok: false, reason: "no-module" }; m.text = failText(m); return m; }
    var bodice = project && BC.latest(project);
    if (!bodice) { var n = { ok: false, reason: "no-bodice" }; n.text = failText(n); return n; }
    var r = SA.draftSleeveA(bodice, { sleeveLengthCm: sleeveLengthCm });
    if (!r.ok) r.text = failText(r);
    return r;
  }

  function stateOf(r, sleeveLengthCm) {
    return { presetId: PRESET_ID, sourceBodiceHash: r.sourceBodiceHash, parameters: { sleeveLengthCm: sleeveLengthCm },
      meta: clone(r.meta), warnings: r.warnings.slice(), blocked: null };
  }

  // 적용: 성공 시 working.sleeveA + working.geometry.sleeve 갱신. 실패 시 아무것도 바꾸지 않는다.
  function apply(project, params) {
    var w = work(project);
    if (!w || !w.geometry) { var e = { ok: false, reason: "no-project" }; e.text = failText(e); return e; }
    var len = params && params.sleeveLengthCm;
    var r = draft(project, len);
    if (!r.ok) return r;
    w.sleeveA = stateOf(r, len);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, state: w.sleeveA };
  }

  // body apply·몸판 재완료 뒤 호출(refreshSleeve). Ⓐ 가 꺼져 있으면 아무것도 안 한다.
  //   성공 → 새 몸판 기준으로 재제도. 실패 → sleeveA.blocked 에 사유를 남기고 geometry 는 건드리지 않는다
  //   (body apply 가 덮어 둔 원형 소매가 그대로 보이지만 «차단»으로 표시된다 — 조용히 다른 소매로 바꾸지 않음).
  function rederive(project) {
    var w = work(project); if (!w || !w.sleeveA) return { ok: true, active: false };
    var len = w.sleeveA.parameters.sleeveLengthCm;
    var r = draft(project, len);
    if (!r.ok) {
      w.sleeveA.blocked = { reason: r.reason, piece: r.piece || null, text: r.text };
      return r;
    }
    w.sleeveA = stateOf(r, len);
    w.geometry.sleeve = clone(r.geometry);
    return { ok: true, active: true, state: w.sleeveA };
  }

  // Ⓐ 해제. geometry.sleeve 복원은 호출부(기존 소매 파생 경로)가 한다.
  function clear(project) { var w = work(project); if (w) w.sleeveA = null; }

  // 화면 표시용 줄. 패턴명 / 소매산·소매폭·소매길이 / 앞뒤 AH / 목표·실제 이세 / 몸판 다트 닫음 / 경고.
  function infoLines(project) {
    var w = work(project), s = w && w.sleeveA; if (!s) return [];
    var P = window.sleevePresets, v = P && P.variant("straight-sleeve", PRESET_ID);
    var lines = [(v ? "스트레이트 소매 Ⓐ" : "소매 Ⓐ") + " · 완성 몸판 진동둘레 기준 (P.137)"];
    if (s.blocked) { lines.push("⚠ 차단: " + s.blocked.text); return lines; }
    var m = s.meta, a = m.armholeCm, et = m.easeTarget, ea = m.easeAfter;
    lines.push("소매산 높이 " + f2(m.capHeightCm) + " · 소매폭 " + f2(m.bicepCm) + " · 소매길이 " + f2(m.sleeveLengthCm) + " cm");
    lines.push("AH 앞 " + f2(a.front) + " · 뒤 " + f2(a.back) + " · 총 " + f2(a.front + a.back) + " cm");
    lines.push("목표 이세 앞 " + f2(et.front) + " · 뒤 " + f2(et.back) + " · 총 " + f2(et.total) + " cm");
    lines.push("실제 이세 앞 " + sgn(ea.front) + " · 뒤 " + sgn(ea.back) + " · 총 " + sgn(ea.total) + " cm");
    var closed = [];
    if (m.source.front.dartClosed) closed.push("앞 AH 다트");
    if (m.source.back.shoulderDartClosed) closed.push("뒤 어깨 다트");
    if (closed.length) lines.push("진동선 계산: " + closed.join("·") + " 닫은 봉제 상태");
    if (s.warnings.indexOf("ease-adjust-ge-1cm") >= 0) lines.push("⚠ 이세 조정이 1cm 이상 — 책: 치수 오측정 가능, 확인 필요");
    return lines;
  }

  window.sleeveAApply = Object.freeze({ PRESET_ID: PRESET_ID, isActive: isActive, isBlocked: isBlocked, draft: draft, apply: apply,
    rederive: rederive, clear: clear, infoLines: infoLines, failText: failText });
})();
