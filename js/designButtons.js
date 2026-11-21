// ══════════════════════════════════════════════
// designButtons.js — 앞여밈 단추 위치(순수 계산 · DOM/state 미접근 · 입력 불변).
//
// 기준 좌표: x = 여밈의 앞중심 단추선 cfX(designPlacket.compute 결과) · y = 앞중심 목점 T(topY)에서
//   아래로 잰 거리(cm). 사용자 입력 = 시작·끝 거리와 개수 → 균등 간격으로 위치를 낸다.
//   · 개수 1 = 시작 거리 한 곳(끝 값은 무시) · 개수 2 = 시작·끝 두 곳 · 3 이상 = 균등 분할.
//   · 개수 ≥ 2 에서 시작 < 끝 이어야 하고 0 ≤ 시작, 끝 ≤ 여밈 길이(botY−topY). 아니면 reason 거부.
//
// ⏸ 보류(blockedBy): 단추 지름·단춧구멍(위치·방향·길이) 표시 — [패턴학교]에서 단추 크기·구멍 근거 쪽을
//   아직 판독하지 않았다(docs/book 에 노트 없음). 근거 없이 수치를 만들지 않는다 → 위치 점만 낸다.
//   재단 화면·DXF 로의 전달도 단추가 designResult 에 들어간 뒤 별도 판단(이번 범위 밖).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var MAX_COUNT = 40;
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function r4(v) { return Math.round(v * 10000) / 10000; }

  // params {startCm,endCm,count} · frame {cfX,topY,botY} → {ok,parameters,marks:[{x,y}]} | {ok:false,reason}
  function compute(params, frame) {
    if (!frame || !isNum(frame.cfX) || !isNum(frame.topY) || !isNum(frame.botY) || frame.botY - frame.topY <= 0) return { ok: false, reason: "no-frame" };
    if (!params || !isNum(params.startCm) || !isNum(params.endCm)) return { ok: false, reason: "invalid-position" };
    var n = params.count;
    if (typeof n !== "number" || !isFinite(n) || Math.floor(n) !== n || n < 1 || n > MAX_COUNT) return { ok: false, reason: "invalid-count" };
    var s = params.startCm, e = params.endCm, len = frame.botY - frame.topY;
    if (s < 0 || s > len) return { ok: false, reason: "out-of-range" };
    if (n >= 2) {
      if (e < 0 || e > len) return { ok: false, reason: "out-of-range" };
      if (e === s) return { ok: false, reason: "start-equals-end" };
      if (e < s) return { ok: false, reason: "reversed" };
    }
    var marks = [], i;
    for (i = 0; i < n; i++) marks.push({ x: r4(frame.cfX), y: r4(frame.topY + (n === 1 ? s : s + (e - s) * i / (n - 1))) });
    return { ok: true, parameters: { startCm: s, endCm: n === 1 ? s : e, count: n }, marks: marks };
  }

  // 저장본 엄격 검증(고쳐 쓰지 않음). null/undefined = 단추 없음.
  function validateStored(v) {
    if (v == null) return { ok: true };
    if (typeof v !== "object" || Array.isArray(v)) return { ok: false, reason: "단추 설정 형식 오류" };
    var p = v.parameters, m = v.marks;
    if (!p || !isNum(p.startCm) || !isNum(p.endCm) || typeof p.count !== "number" || Math.floor(p.count) !== p.count || p.count < 1 || p.count > MAX_COUNT) return { ok: false, reason: "단추 설정 값 오류" };
    if (p.startCm < 0 || (p.count >= 2 && p.endCm <= p.startCm)) return { ok: false, reason: "단추 시작·끝 범위 오류" };
    if (!Array.isArray(m) || m.length !== p.count) return { ok: false, reason: "단추 위치 개수 오류" };
    for (var i = 0; i < m.length; i++) {
      if (!m[i] || !isNum(m[i].x) || !isNum(m[i].y)) return { ok: false, reason: "단추 위치 좌표 오류" };
      if (i > 0 && m[i].y <= m[i - 1].y) return { ok: false, reason: "단추 위치 순서 오류" };
    }
    return { ok: true };
  }

  window.designButtons = Object.freeze({ compute: compute, validateStored: validateStored, MAX_COUNT: MAX_COUNT });
})();
