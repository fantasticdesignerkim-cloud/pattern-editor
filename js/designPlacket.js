// ══════════════════════════════════════════════
// designPlacket.js — 앞중심 여밈(front placket) 파생 형상.
//
// ⚠️ computeGeometry 밖의 **별도 파생 단계**다(사용자 아키텍처 확정). manual 네크라인은
//    working.geometry 가 아니라 designOutline 에 있으므로, 여밈의 위쪽 시작점은 반드시
//    **현재 유효 앞판 외곽**에서 잡아야 한다:
//      effectiveFrontOutline = working.designOutline?.front?.outline ?? working.geometry.front.outline
//    이 모듈은 그 유효 외곽만 인자로 받는 순수 함수다(DOM·state 미접근, 입력 불변).
//
// 앞중심 기준선(사용자 확정):
//   기존 CF ─ +overlap → 완성 앞단선·접힘선 ─ +facing → 안단 바깥 재단선
//   · 기존 CF (max x, 앞판): 단추 중심·맞춤 기준선 (construction)
//   · CF+overlap: 완성된 앞단선이자 접힘선 (construction)
//   · CF+overlap+facing: 컷온 안단 바깥 재단선 (outline — 최종 외곽은 안단 폭까지 확장)
//   여밈 상단은 T(neck-CF)에서 재단선까지 **수평 직각 연장**, 밑단은 B(hem-CF)에서 수평 연장.
//   ★ 상단 수평·안단은 **목둘레 길이에 미포함**(별도 플래킷 경계) — 호출부가 목선과 분리 측정.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var EPS = 0.02;   // cm. 좌표 접합 허용(designBodice/​designLineTool 와 동일 계열).

  // 세그먼트의 on-curve 끝점들(포맷 무관: line / cubic(designOutline) / path(working.geometry)).
  function endpointsOf(seg) {
    if (!seg) return [];
    if (seg.kind === "line") return [seg.from, seg.to];
    if (seg.kind === "cubic") return [seg.from, seg.to];
    if (seg.kind === "path" && Array.isArray(seg.commands)) {
      var pts = [];
      seg.commands.forEach(function (c) {
        if (c.type === "M") pts.push(c.points[0]);
        else if (c.type === "C") pts.push(c.points[c.points.length - 1]);
      });
      return pts;
    }
    return [];
  }
  function L(a, b) { return { kind: "line", from: { x: a.x, y: a.y }, to: { x: b.x, y: b.y } }; }

  // effectiveFrontOutline(현재 유효 앞판 외곽) + { overlapCm, facingWidthCm, lengthMode } → 파생 여밈.
  // 반환 { ok, outline, construction, cfX, foldX, cutX, topY, botY } | { ok:false, reason }.
  function compute(effectiveFrontOutline, params) {
    if (!Array.isArray(effectiveFrontOutline) || !effectiveFrontOutline.length) return { ok: false, reason: "no-outline" };
    var overlap = params && params.overlapCm, facing = params && params.facingWidthCm;
    if (typeof overlap !== "number" || !isFinite(overlap) || overlap < 0) return { ok: false, reason: "invalid-overlap" };
    if (typeof facing !== "number" || !isFinite(facing) || facing < 0) return { ok: false, reason: "invalid-facing" };
    if (overlap === 0 && facing === 0) return { ok: false, reason: "no-placket" };   // 정확한 0/0 = 여밈 없음(호출부가 clear)
    var lengthMode = (params && params.lengthMode) || "full";
    if (lengthMode !== "full") return { ok: false, reason: "unsupported-length-mode" };   // v1 = 전체(목~밑단)

    // CF 앞단 = 앞판 최대 x 의 수직 모서리(품·여유량은 옆선을 -x 로 넓히므로 CF 가 항상 max x).
    var pts = [];
    effectiveFrontOutline.forEach(function (s) { endpointsOf(s).forEach(function (p) { if (p && typeof p.x === "number") pts.push(p); }); });
    if (pts.length < 2) return { ok: false, reason: "no-outline" };
    var cfX = -Infinity;
    pts.forEach(function (p) { if (p.x > cfX) cfX = p.x; });
    var cfPts = pts.filter(function (p) { return Math.abs(p.x - cfX) < EPS; });
    if (cfPts.length < 2) return { ok: false, reason: "no-cf-edge" };
    var T = cfPts[0], B = cfPts[0];   // T=neck-CF(min y) · B=hem-CF(max y)
    cfPts.forEach(function (p) { if (p.y < T.y) T = p; if (p.y > B.y) B = p; });
    if (B.y - T.y < EPS) return { ok: false, reason: "degenerate-cf-edge" };

    var foldX = cfX + overlap, cutX = cfX + overlap + facing;
    var Tt = { x: cfX, y: T.y }, Bb = { x: cfX, y: B.y };
    // 폐곡선 여밈 스트립: 상단 수평 → 안단 바깥 재단선 → 밑단 수평 → CF(공유 경계) 복귀.
    var outline = [
      L(Tt, { x: cutX, y: T.y }),
      L({ x: cutX, y: T.y }, { x: cutX, y: B.y }),
      L({ x: cutX, y: B.y }, Bb),
      L(Bb, Tt)
    ];
    // 완성 앞단선·접힘선(CF+overlap) + 기존 CF·단추 중심선.
    var construction = [
      L({ x: foldX, y: T.y }, { x: foldX, y: B.y }),
      L({ x: cfX, y: T.y }, { x: cfX, y: B.y })
    ];
    return { ok: true, outline: outline, construction: construction, cfX: cfX, foldX: foldX, cutX: cutX, topY: T.y, botY: B.y };
  }

  window.designPlacket = Object.freeze({ compute: compute, endpointsOf: endpointsOf });
})();
