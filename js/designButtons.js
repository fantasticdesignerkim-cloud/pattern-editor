// ══════════════════════════════════════════════
// designButtons.js — 앞여밈 단추 위치·단춧구멍(순수 계산 · DOM/state 미접근 · 입력 불변).
//
// 기준 좌표: x = 여밈의 앞중심 단추선 cfX(designPlacket.compute 결과) · y = 앞중심 목점 T(topY)에서
//   아래로 잰 거리(cm). 사용자 입력 = 시작·끝 거리와 개수 → 균등 간격으로 위치를 낸다.
//   · 개수 1 = 시작 거리 한 곳(끝 값은 무시) · 개수 2 = 시작·끝 두 곳 · 3 이상 = 균등 분할.
//   · 개수 ≥ 2 에서 시작 < 끝 이어야 하고 0 ≤ 시작, 끝 ≤ 여밈 길이(botY−topY). 아니면 reason 거부.
//
// 단추 지름 diameterCm: 이번 셔츠 사용자 확정(2026-11-23) 기본 1.15 = 11.5mm. 범위 MIN_DIAMETER~MAX_DIAMETER.
//   [패턴학교] P.120 의 1.3 은 책 예시값으로 docs/book/P120.md 에만 보존한다(기본값 아님).
//   LEGACY_DIAMETER = 1.3: 지름 키 없이 저장된 옛 단추를 열거나 다시 계산할 때 유지하는 값(소급 변경 금지).
// 단춧구멍 holeLengthCm: 사용자 확정 기본 1.3 = 13mm. **holeLengthCm 를 주었을 때만** 구멍을 만든다(생략 = 구멍 없음 · 옛 저장본 그대로).
//   구멍 = 각 단추 높이 y 에서 앞중심 cfX 를 가운데로 한 수평선 (cfX−L/2, y)→(cfX+L/2, y).
//   거부: L < 지름(hole-shorter-than-diameter) · L/2 > 완성 앞단까지의 거리 = 여밈분 overlapCm(hole-exceeds-placket).
//   (완성 앞단선 = cfX + 여밈분 · designPlacket 확정 규칙. 몸판 쪽 끝은 앞판 안이므로 따로 제한하지 않는다.)
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var MAX_COUNT = 40, DEFAULT_DIAMETER = 1.15, LEGACY_DIAMETER = 1.3, MIN_DIAMETER = 0.5, MAX_DIAMETER = 5;
  var DEFAULT_HOLE = 1.3, MAX_HOLE = 6, EPS = 1e-9, EDGE = 1e-6;
  function diamOk(d) { return isNum(d) && d >= MIN_DIAMETER && d <= MAX_DIAMETER; }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function r4(v) { return Math.round(v * 10000) / 10000; }

  // 여밈(frontPlacket) → 단추 기준틀. construction[1] = 앞중심 단추선(from = 목점 · to = 밑단점). 읽을 수 없으면 null.
  function frameFromPlacket(pk) {
    var c = pk && pk.construction && pk.construction[1];
    if (!c || !c.from || !c.to) return null;
    var ov = pk.parameters && pk.parameters.overlapCm;
    return { cfX: c.from.x, topY: c.from.y, botY: c.to.y, overlapCm: isNum(ov) ? ov : null };
  }

  // params {startCm,endCm,count,diameterCm?,holeLengthCm?} · frame {cfX,topY,botY,overlapCm?}
  //   → {ok,parameters,marks:[{x,y}],holes?:[{a,b}]} | {ok:false,reason}
  function compute(params, frame) {
    if (!frame || !isNum(frame.cfX) || !isNum(frame.topY) || !isNum(frame.botY) || frame.botY - frame.topY <= 0) return { ok: false, reason: "no-frame" };
    if (!params || !isNum(params.startCm) || !isNum(params.endCm)) return { ok: false, reason: "invalid-position" };
    var n = params.count;
    if (typeof n !== "number" || !isFinite(n) || Math.floor(n) !== n || n < 1 || n > MAX_COUNT) return { ok: false, reason: "invalid-count" };
    var d = params.diameterCm == null ? DEFAULT_DIAMETER : params.diameterCm;
    if (!diamOk(d)) return { ok: false, reason: "invalid-diameter" };
    var h = params.holeLengthCm;
    if (h != null) {
      if (!isNum(h) || h <= 0 || h > MAX_HOLE) return { ok: false, reason: "invalid-hole" };
      if (h < d - EPS) return { ok: false, reason: "hole-shorter-than-diameter" };
      if (!isNum(frame.overlapCm)) return { ok: false, reason: "no-frame" };
      if (h / 2 >= frame.overlapCm - EDGE) return { ok: false, reason: "hole-exceeds-placket" };   // 끝이 완성 앞단에 닿거나 넘으면 거부(안쪽에 남아야 한다)
    }
    var s = params.startCm, e = params.endCm, len = frame.botY - frame.topY;
    if (s < 0 || s > len) return { ok: false, reason: "out-of-range" };
    if (n >= 2) {
      if (e < 0 || e > len) return { ok: false, reason: "out-of-range" };
      if (e === s) return { ok: false, reason: "start-equals-end" };
      if (e < s) return { ok: false, reason: "reversed" };
    }
    if (h != null && (s <= EDGE || (n >= 2 ? e : s) >= len - EDGE)) return { ok: false, reason: "hole-on-edge" };   // 목선·밑단 완성 가장자리에 닿는 구멍 금지
    var marks = [], holes = [], i, y;
    for (i = 0; i < n; i++) {
      y = r4(frame.topY + (n === 1 ? s : s + (e - s) * i / (n - 1)));
      marks.push({ x: r4(frame.cfX), y: y });
      if (h != null) holes.push({ a: { x: r4(frame.cfX - h / 2), y: y }, b: { x: r4(frame.cfX + h / 2), y: y } });
    }
    var parameters = { startCm: s, endCm: n === 1 ? s : e, count: n, diameterCm: d };
    if (h != null) parameters.holeLengthCm = h;
    var out = { ok: true, parameters: parameters, marks: marks };
    if (h != null) out.holes = holes;
    return out;
  }

  // 저장본 엄격 검증(고쳐 쓰지 않음). null/undefined = 단추 없음.
  function validateStored(v) {
    if (v == null) return { ok: true };
    if (typeof v !== "object" || Array.isArray(v)) return { ok: false, reason: "단추 설정 형식 오류" };
    var p = v.parameters, m = v.marks;
    if (!p || !isNum(p.startCm) || !isNum(p.endCm) || typeof p.count !== "number" || Math.floor(p.count) !== p.count || p.count < 1 || p.count > MAX_COUNT) return { ok: false, reason: "단추 설정 값 오류" };
    if (p.diameterCm != null && !diamOk(p.diameterCm)) return { ok: false, reason: "단추 지름 범위 오류" };   // 생략 = 이전 저장본(지름 1.3 으로 표시)
    if (p.startCm < 0 || (p.count >= 2 && p.endCm <= p.startCm)) return { ok: false, reason: "단추 시작·끝 범위 오류" };
    if (!Array.isArray(m) || m.length !== p.count) return { ok: false, reason: "단추 위치 개수 오류" };
    for (var i = 0; i < m.length; i++) {
      if (!m[i] || !isNum(m[i].x) || !isNum(m[i].y)) return { ok: false, reason: "단추 위치 좌표 오류" };
      if (i > 0 && m[i].y <= m[i - 1].y) return { ok: false, reason: "단추 위치 순서 오류" };
    }
    var hasHole = p.holeLengthCm != null;
    if (!hasHole) return Object.prototype.hasOwnProperty.call(v, "holes") && v.holes != null ? { ok: false, reason: "단춧구멍 길이 없이 구멍 좌표가 있습니다" } : { ok: true };
    var h = p.holeLengthCm;
    if (!isNum(h) || h <= 0 || h > MAX_HOLE) return { ok: false, reason: "단춧구멍 길이 범위 오류" };
    if (p.diameterCm == null) return { ok: false, reason: "단춧구멍에는 단추 지름이 필요합니다" };
    if (h < p.diameterCm - EPS) return { ok: false, reason: "단춧구멍이 단추 지름보다 짧습니다" };
    if (!Array.isArray(v.holes) || v.holes.length !== m.length) return { ok: false, reason: "단춧구멍 개수 오류" };
    for (var j = 0; j < m.length; j++) {
      var q = v.holes[j];
      if (!q || !q.a || !q.b || !isNum(q.a.x) || !isNum(q.a.y) || !isNum(q.b.x) || !isNum(q.b.y)) return { ok: false, reason: "단춧구멍 좌표 오류" };
      if (Math.abs(q.a.y - m[j].y) > 1e-3 || Math.abs(q.b.y - m[j].y) > 1e-3) return { ok: false, reason: "단춧구멍 높이가 단추와 다릅니다" };
      if (Math.abs((q.a.x + q.b.x) / 2 - m[j].x) > 1e-3 || Math.abs((q.b.x - q.a.x) - h) > 1e-3) return { ok: false, reason: "단춧구멍이 앞중심·길이와 맞지 않습니다" };
    }
    return { ok: true };
  }

  // 저장된 단추를 현재 여밈에서 같은 파라미터로 다시 계산해 일치하는지 확인(구멍 있는 단추만 — 옛 단추는 건드리지 않는다).
  //   → {ok:true} | {ok:false, reason(코드), compute reason}
  function verifyAgainstPlacket(fb, pk) {
    if (!fb || !fb.parameters || fb.parameters.holeLengthCm == null) return { ok: true };
    if (!pk) return { ok: false, reason: "no-frame" };
    var r = compute(fb.parameters, frameFromPlacket(pk));
    if (!r.ok) return { ok: false, reason: r.reason };
    if (JSON.stringify(r.marks) !== JSON.stringify(fb.marks) || JSON.stringify(r.holes) !== JSON.stringify(fb.holes)) return { ok: false, reason: "mismatch" };
    return { ok: true };
  }

  // ── Design 완료본에 묶는 단춧구멍 기하(designResult.buttonholes · 주머니 패턴) ──
  //   spec = { diameterCm, holeLengthCm, marks:[{x,y}], holes:[{a,b}] } (다른 키 거부). 구멍이 없으면 null(키 자체를 두지 않는다).
  //   검증: 앞중심 가운데 · 수평 · 길이 = holeLengthCm ≥ 지름 · 높이 = 단추 높이 · 목~밑단 안쪽(가장자리에 닿지 않음) · 끝이 완성 앞단(cfX+여밈분) 안쪽.
  var SPEC_KEYS = ["diameterCm", "holeLengthCm", "marks", "holes"];
  function validateSpec(spec, pk) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) return { ok: false, reason: "단춧구멍 형식 오류" };
    var ks = Object.keys(spec), i;
    for (i = 0; i < ks.length; i++) if (SPEC_KEYS.indexOf(ks[i]) < 0) return { ok: false, reason: "단춧구멍 알 수 없는 키" };
    var d = spec.diameterCm, h = spec.holeLengthCm, m = spec.marks, hs = spec.holes;
    if (!diamOk(d) || !isNum(h) || h <= 0 || h > MAX_HOLE || h < d - EPS) return { ok: false, reason: "단춧구멍 길이·지름 오류" };
    if (!Array.isArray(m) || !m.length || m.length > MAX_COUNT || !Array.isArray(hs) || hs.length !== m.length) return { ok: false, reason: "단춧구멍 개수 오류" };
    var fr = frameFromPlacket(pk);
    if (!fr || !isNum(fr.overlapCm) || !(fr.botY - fr.topY > 0)) return { ok: false, reason: "단춧구멍을 둘 완성 앞단(여밈)을 읽을 수 없습니다" };
    if (!(h / 2 < fr.overlapCm - EDGE)) return { ok: false, reason: "단춧구멍 끝이 완성 앞단에 닿거나 넘어갑니다" };
    for (i = 0; i < m.length; i++) {
      var q = hs[i], k = m[i];
      if (!k || !isNum(k.x) || !isNum(k.y) || !q || !q.a || !q.b || !isNum(q.a.x) || !isNum(q.a.y) || !isNum(q.b.x) || !isNum(q.b.y)) return { ok: false, reason: "단춧구멍 좌표 오류" };
      if (i > 0 && k.y <= m[i - 1].y) return { ok: false, reason: "단춧구멍 순서 오류" };
      if (Math.abs(q.a.y - q.b.y) > 1e-3 || Math.abs(q.a.y - k.y) > 1e-3) return { ok: false, reason: "단춧구멍이 수평·단추 높이가 아닙니다" };
      if (Math.abs((q.a.x + q.b.x) / 2 - fr.cfX) > 1e-3 || Math.abs(Math.abs(q.b.x - q.a.x) - h) > 1e-3 || Math.abs(k.x - fr.cfX) > 1e-3) return { ok: false, reason: "단춧구멍이 앞중심 가운데·길이와 맞지 않습니다" };
      if (!(q.a.y > fr.topY + EDGE && q.a.y < fr.botY - EDGE)) return { ok: false, reason: "단춧구멍이 목·밑단 가장자리에 닿거나 벗어납니다" };
      if (!(Math.max(q.a.x, q.b.x) < fr.cfX + fr.overlapCm - EDGE)) return { ok: false, reason: "단춧구멍 끝이 완성 앞단에 닿거나 넘어갑니다" };
    }
    return { ok: true };
  }
  // 세션 단추(working.frontButtons) → 완료본 기하. 구멍 없음 = {ok,none:true}. 읽을 수 없거나 앞단과 안 맞으면 {ok:false,reason}.
  function holeSpecOf(fb, pk) {
    if (fb == null || !fb.parameters || fb.parameters.holeLengthCm == null) return { ok: true, none: true };
    var sv = validateStored(fb); if (!sv.ok) return sv;
    var spec = JSON.parse(JSON.stringify({ diameterCm: fb.parameters.diameterCm, holeLengthCm: fb.parameters.holeLengthCm, marks: fb.marks, holes: fb.holes }));
    var v = validateSpec(spec, pk);
    return v.ok ? { ok: true, spec: spec } : v;
  }

  window.designButtons = Object.freeze({ compute: compute, validateStored: validateStored, frameFromPlacket: frameFromPlacket, verifyAgainstPlacket: verifyAgainstPlacket, validateSpec: validateSpec, holeSpecOf: holeSpecOf,
    MAX_COUNT: MAX_COUNT, DEFAULT_DIAMETER: DEFAULT_DIAMETER, LEGACY_DIAMETER: LEGACY_DIAMETER, MIN_DIAMETER: MIN_DIAMETER, MAX_DIAMETER: MAX_DIAMETER,
    DEFAULT_HOLE: DEFAULT_HOLE, MAX_HOLE: MAX_HOLE });
})();
