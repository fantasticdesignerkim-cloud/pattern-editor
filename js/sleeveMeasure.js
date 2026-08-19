// ══════════════════════════════════════════════
// sleeveMeasure.js — 소매산 봉제선 길이 순수 측정 API(읽기 전용).
//
// ⚠️ 소매 단계 진입 전 **봉제선 정합 확인**용이다 — 시접 작업이 아니고, 소매 형상도 바꾸지
//    않는다. sleeve.js 의 생성·계산식은 전혀 건드리지 않는다.
//
// 계약(사용자 확정):
//   measureSleeveCap(sleeveGeometry) => Object.freeze({ frontLength, backLength, totalLength }) | null
//   · 입력은 live draft 가 아니라 완료본에 고정된 소매 geometry(referenceGeometry.sleeve).
//   · 소매산 봉제선(cap 곡선)만 측정 — construction·라벨·시접 제외.
//   · render·state·storage 미접근, 자동 재계산 없음.
//   · 앞/뒤 규약(sleeve.js): 뒤 = 낮은 x(sx_B=sx_C−bSW), 앞 = 높은 x(sx_F=sx_C+fSW).
//     SP(소매산점) = cap 곡선의 apex(min y). back=진동밑(낮은 x)→SP, front=SP→진동밑(높은 x).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var SAMPLES = 60;   // cubic 당 샘플(apex·호길이 정밀도)
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function lerpCubic(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
             y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
  }
  // 세그먼트 → 조밀 점열(양 끝 포함). line/cubic/path 지원.
  function segToPts(seg) {
    var pts = [];
    if (seg.kind === "line") { pts.push({ x: seg.from.x, y: seg.from.y }, { x: seg.to.x, y: seg.to.y }); return pts; }
    if (seg.kind === "cubic") { for (var i = 0; i <= SAMPLES; i++) pts.push(lerpCubic(seg.from, seg.c1, seg.c2, seg.to, i / SAMPLES)); return pts; }
    if (seg.kind === "path" && Array.isArray(seg.commands)) {
      var cur = seg.commands[0] && seg.commands[0].points[0];
      if (cur) pts.push({ x: cur.x, y: cur.y });
      seg.commands.forEach(function (c) {
        if (c.type === "M") { cur = c.points[0]; return; }
        if (c.type !== "C" || !cur) return;
        for (var i = 1; i <= SAMPLES; i++) pts.push(lerpCubic(cur, c.points[0], c.points[1], c.points[2], i / SAMPLES));
        cur = c.points[2];
      });
      return pts;
    }
    return pts;
  }
  // cap 세그먼트들(곡선)을 끝점 매칭으로 한 폴리라인으로 연결. 단일 path 면 그대로.
  function chainCap(segs) {
    var polys = segs.map(segToPts).filter(function (p) { return p.length >= 2; });
    if (!polys.length) return [];
    if (polys.length === 1) return polys[0];
    var TOL = 0.05;
    var chain = polys.shift().slice();
    var guard = polys.length + 1;
    while (polys.length && guard-- > 0) {
      var tail = chain[chain.length - 1], head = chain[0], hooked = false;
      for (var i = 0; i < polys.length; i++) {
        var p = polys[i], a = p[0], b = p[p.length - 1];
        if (dist(tail, a) < TOL) { chain = chain.concat(p.slice(1)); polys.splice(i, 1); hooked = true; break; }
        if (dist(tail, b) < TOL) { chain = chain.concat(p.slice(0, -1).reverse()); polys.splice(i, 1); hooked = true; break; }
        if (dist(head, b) < TOL) { chain = p.slice(0, -1).concat(chain); polys.splice(i, 1); hooked = true; break; }
        if (dist(head, a) < TOL) { chain = p.slice(1).reverse().concat(chain); polys.splice(i, 1); hooked = true; break; }
      }
      if (!hooked) break;
    }
    return chain;
  }

  function measureSleeveCap(sleeveGeometry) {
    if (!sleeveGeometry || !Array.isArray(sleeveGeometry.outline)) return null;
    // 소매산 봉제선 = outline 의 곡선(path/cubic) 세그먼트. 옆선·밑단(직선)·construction·라벨 제외.
    var capSegs = sleeveGeometry.outline.filter(function (s) { return s.kind === "path" || s.kind === "cubic"; });
    if (!capSegs.length) return null;
    var pts = chainCap(capSegs);
    if (pts.length < 3) return null;
    // apex(SP) = min y. back = 낮은 x 쪽 끝 → apex, front = apex → 높은 x 쪽 끝.
    var apex = 0;
    for (var i = 1; i < pts.length; i++) if (pts[i].y < pts[apex].y) apex = i;
    if (apex === 0 || apex === pts.length - 1) return null;   // apex 가 끝점이면 cap 아님(퇴화)
    var arc = function (a, b) { var L = 0; for (var k = a; k < b; k++) L += dist(pts[k], pts[k + 1]); return L; };
    var startToApex = arc(0, apex), apexToEnd = arc(apex, pts.length - 1);
    var backIsStart = pts[0].x < pts[pts.length - 1].x;   // 시작 끝점이 뒤(낮은 x)인가
    var backLength = backIsStart ? startToApex : apexToEnd;
    var frontLength = backIsStart ? apexToEnd : startToApex;
    return Object.freeze({ frontLength: frontLength, backLength: backLength, totalLength: frontLength + backLength });
  }

  window.sleeveMeasure = Object.freeze({ measureSleeveCap: measureSleeveCap });
})();
