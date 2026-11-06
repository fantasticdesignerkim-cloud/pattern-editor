// ══════════════════════════════════════════════
// sideSeamMagnet.js — 몸판 옆선 «길이 맞춤 자석» + «의도적인 여유량» (2026-11-06 김님 승인 설계 · 순수 엔진)
//
// 이 파일은 **수학만** 한다(DOM·project·render 없음). 길이 자체는 재지 않는다 — 호출자가 넘긴 길이 함수
// (= bodiceCheckpoint 의 옆선 봉제 길이 함수, 완료 게이트와 같은 계측)만 쓴다. 별도 근사 옆선 정의 없음.
//
// ① 여유 의도(봉제 의도 선언 — 실루엣을 바꾸지 않는다)
//    mode: "equal"(같은 길이 · 기본 · 저장하지 않음) | "back-ease"(뒤가 easeCm 더 김) | "front-ease"(앞이 easeCm 더 김)
//    목표 차 D = 뒤 − 앞 = +easeCm | −easeCm | 0. 완료 게이트는 |(뒤 − 앞) − D| 를 기존 0.1/0.3 기준으로 본다.
//    easeCm 범위 0 < e ≤ MAX_EASE_CM(10) — **UI 입력 상한(책 공식 아님)**: 옆선 셔링·이세로 현실적인 범위 밖 입력 거부.
//
// ② 자석(편집 중 한 점·한 핸들의 2 자유도 안에서만)
//    f(Q) = 옆선 봉제 길이(그 점/핸들이 Q 일 때). 목표 T 의 등위선 {f = T} 위에서 커서에 가장 가까운 점을
//    Newton 사영(Q ← Q − (f−T)∇f/|∇f|²)으로 찾고, 커서와의 화면 거리가 문턱 안이면 그 점에 «정확히» 붙인다.
//    문턱(px) = UI 설정값(책 공식 아님): 획득 ACQUIRE_PX · 해제 RELEASE_PX(히스테리시스 — 붙은 뒤엔 조금 더 멀어져야 떨어짐).
//    스냅 이동량 ≤ 문턱이므로 실루엣 변형은 커서 근처 몇 px 로 한정된다. 다른 점(진동점·허리점·밑단·기준판)은 건드리지 않는다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var ACQUIRE_PX = 10, RELEASE_PX = 16;   // UI 설정값: 화면 px(줌과 무관하게 손 느낌 일정) — 책 공식 아님
  var MAX_EASE_CM = 10;                   // UI 입력 상한(책 공식 아님)
  var MODES = { equal: 1, "back-ease": 1, "front-ease": 1 };
  var NEWTON_MAX = 14, SOLVE_TOL = 1e-7, GRAD_H = 1e-5;

  function round4(v) { return Math.round(v * 1e4) / 1e4; }

  // 입력 → {ok, intent|null(같은 길이 = 저장 안 함), reason}. 거부는 이유 코드와 문구를 함께.
  function normalizeIntent(input) {
    var mode = input && input.mode;
    if (!MODES[mode]) return { ok: false, reason: "intent-mode", text: "옆선 의도 선택이 올바르지 않음" };
    if (mode === "equal") return { ok: true, intent: null };
    var raw = input.easeCm;
    var e = (typeof raw === "string") ? (raw.trim() === "" ? NaN : Number(raw)) : raw;
    if (typeof e !== "number" || !isFinite(e)) return { ok: false, reason: "intent-ease-nan", text: "여유량(cm)을 숫자로 입력하세요" };
    if (e <= 0) return { ok: false, reason: "intent-ease-nonpositive", text: "여유량은 0 보다 커야 합니다(0 이면 «같은 길이»)" };
    if (e > MAX_EASE_CM) return { ok: false, reason: "intent-ease-range", text: "여유량 " + MAX_EASE_CM + "cm 초과는 받지 않습니다(입력 상한)" };
    return { ok: true, intent: { mode: mode, easeCm: round4(e) } };
  }
  // 저장된 값 검증(손상·수기 변경 방지). null/undefined = 같은 길이.
  function validStored(si) {
    if (si === null || si === undefined) return { ok: true, intent: null };
    if (typeof si !== "object") return { ok: false };
    var n = normalizeIntent(si);
    if (!n.ok || !n.intent || n.intent.easeCm !== si.easeCm || Object.keys(si).length !== 2) return { ok: false };
    return n;
  }
  function targetDiff(intent) { return !intent ? 0 : intent.mode === "back-ease" ? intent.easeCm : -intent.easeCm; }   // 뒤 − 앞
  // 편집 판(editPiece)의 목표 길이: 기준판 길이 refLen 고정.
  function targetFor(editPiece, refLen, intent) { var D = targetDiff(intent); return editPiece === "back" ? refLen + D : refLen - D; }
  function intentText(intent) {
    if (!intent) return "같은 길이(뒤 − 앞 = 0)";
    return (intent.mode === "back-ease" ? "뒤판 여유 " : "앞판 여유 ") + intent.easeCm.toFixed(2) + "cm(뒤 − 앞 = " + (targetDiff(intent) > 0 ? "+" : "−") + intent.easeCm.toFixed(2) + ")";
  }

  function grad(f, q) {
    var h = GRAD_H;
    var fx1 = f({ x: q.x + h, y: q.y }), fx0 = f({ x: q.x - h, y: q.y });
    var fy1 = f({ x: q.x, y: q.y + h }), fy0 = f({ x: q.x, y: q.y - h });
    return { x: (fx1 - fx0) / (2 * h), y: (fy1 - fy0) / (2 * h) };
  }
  // 등위선 {f = T} 위 커서 근처 점. {ok, point, value, reason}
  function projectToLevel(f, T, cursor) {
    var q = { x: cursor.x, y: cursor.y };
    for (var i = 0; i < NEWTON_MAX; i++) {
      var v = f(q) - T;
      if (!isFinite(v)) return { ok: false, reason: "invalid" };
      if (Math.abs(v) <= SOLVE_TOL) return { ok: true, point: q, value: v + T };
      var g = grad(f, q), g2 = g.x * g.x + g.y * g.y;
      if (!(g2 > 1e-12)) return { ok: false, reason: "degenerate" };
      q = { x: q.x - v * g.x / g2, y: q.y - v * g.y / g2 };
    }
    var vEnd = f(q) - T;
    return Math.abs(vEnd) <= 1e-6 ? { ok: true, point: q, value: vEnd + T } : { ok: false, reason: "no-converge" };
  }
  // 한 프레임의 자석 판정.
  //   ctx: { f(Q) → 길이, T, cursor, pxToCm, locked(직전 프레임에 붙어 있었나), valid(Q) → {ok, reason}?, minLen? }
  //   반환 { snapped, point?, value, remain(현재 커서 기준 f − T), reason?, locked }
  function decide(ctx) {
    var cur = ctx.f(ctx.cursor), remain = cur - ctx.T;
    var out = { snapped: false, value: cur, remain: remain, locked: false };
    if (typeof ctx.minLen === "number" && ctx.T < ctx.minLen - 1e-9) { out.reason = "too-short"; return out; }
    var pr = projectToLevel(ctx.f, ctx.T, ctx.cursor);
    if (!pr.ok) { out.reason = pr.reason; return out; }
    var dPx = Math.hypot(pr.point.x - ctx.cursor.x, pr.point.y - ctx.cursor.y) / ctx.pxToCm;
    var thr = ctx.locked ? RELEASE_PX : ACQUIRE_PX;
    if (dPx > thr) { out.reason = "far"; out.distancePx = dPx; return out; }
    if (ctx.valid) { var vv = ctx.valid(pr.point); if (!vv || !vv.ok) { out.reason = (vv && vv.reason) || "invalid-shape"; return out; } }
    out.snapped = true; out.locked = true; out.point = pr.point; out.value = pr.value; out.distancePx = dPx;
    return out;
  }
  var REASON_TEXT = {
    "too-short": "목표가 이 구간을 곧게 편 길이보다 짧음 — 이 점으로는 불가",
    degenerate: "이 위치에서는 점을 움직여도 길이가 변하지 않음 — 자석 없음",
    "no-converge": "이 점·핸들 자유도로 목표 길이에 닿는 해를 찾지 못함",
    invalid: "길이를 잴 수 없는 형상",
    "invalid-shape": "붙일 위치에서 선이 꼬이거나 외곽과 교차 — 스냅 안 함",
    "self-cross": "붙일 위치에서 선이 자기 자신과 교차 — 스냅 안 함",
    "kept-cross": "붙일 위치에서 선이 남은 외곽과 교차 — 스냅 안 함",
    far: "목표 길이 위치까지 멀다(가까이 가면 붙음)"
  };
  function reasonText(code) { return REASON_TEXT[code] || code || ""; }

  var api = Object.freeze({ ACQUIRE_PX: ACQUIRE_PX, RELEASE_PX: RELEASE_PX, MAX_EASE_CM: MAX_EASE_CM,
    normalizeIntent: normalizeIntent, validStored: validStored, targetDiff: targetDiff, targetFor: targetFor, intentText: intentText,
    projectToLevel: projectToLevel, decide: decide, reasonText: reasonText });
  if (typeof window !== "undefined") window.sideSeamMagnet = api;
})();
