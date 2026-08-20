// ══════════════════════════════════════════════
// designSleeve.js — 소매 모양 단계 파생(순수). S1: 기본 긴팔 하부 실루엣.
//
// ⚠️ S1 은 **소매산(cap) 곡선과 진동밑점(양쪽)을 고정하고 아래쪽(옆선·밑단)만 변형**한다 →
//    소매산·앞뒤 이세 관계 불변(몸판 진동 정합을 안 깬다). computeGeometry(몸판) 과 무관한
//    별도 파생이고, 결과는 working.sleeveGeometry 에 저장한다. sleeve.js 는 건드리지 않는다.
//
// 입력은 live draft 가 아니라 **완료본에 고정된 소매 geometry**(referenceGeometry.sleeve).
// 기준값(초기 UI)은 임의 숫자가 아니라 원형 소매에서 파생한다(referenceSilhouette).
//
// 착용 제약(v1): 손둘레 측정이 없으므로 **원형 소매부리보다 좁아지면 경고만**(하드 차단 없음).
//   손둘레가 생기면 `손둘레 + 여유` 미만 차단으로 확장. 이번 v1 은 트임 필요한 좁은 손목형 미생성.
//
// 앞/뒤 규약(sleeve.js): 뒤 = 낮은 x(sx_B), 앞 = 높은 x(sx_F). SP = cap apex(min y).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var EPS = 0.05;   // cm
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function cp(p) { return { x: p.x, y: p.y }; }
  function L(a, b) { return { kind: "line", from: cp(a), to: cp(b) }; }

  function endpointsOf(seg) {
    if (seg.kind === "line") return [seg.from, seg.to];
    if (seg.kind === "cubic") return [seg.from, seg.to];
    if (seg.kind === "path" && Array.isArray(seg.commands)) {
      var pts = [];
      seg.commands.forEach(function (c) { if (c.type === "M") pts.push(c.points[0]); else if (c.type === "C") pts.push(c.points[c.points.length - 1]); });
      return pts;
    }
    return [];
  }
  // cap(곡선) 세그먼트들의 체인 양 끝점(진동밑). 단일 path 면 [from, to].
  function capEnds(capSegs) {
    var pts = [];
    capSegs.forEach(function (s) { endpointsOf(s).forEach(function (p) { pts.push(p); }); });
    if (pts.length < 2) return null;
    // 체인 끝 = 다른 세그먼트 끝점과 안 겹치는 점. 단일 path 는 첫/끝.
    var ends = pts.filter(function (p) { return pts.filter(function (q) { return dist(p, q) < EPS; }).length === 1; });
    if (ends.length >= 2) return [ends[0], ends[ends.length - 1]];
    return [pts[0], pts[pts.length - 1]];
  }
  function capApexY(capSegs) {
    var minY = Infinity;
    capSegs.forEach(function (s) {
      if (s.kind === "line") { minY = Math.min(minY, s.from.y, s.to.y); return; }
      var segs = s.kind === "cubic" ? [[s.from, s.c1, s.c2, s.to]] : cubicsOfPath(s);
      segs.forEach(function (q) {
        for (var i = 0; i <= 40; i++) { var t = i / 40, u = 1 - t;
          var y = u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y;
          if (y < minY) minY = y;
        }
      });
    });
    return minY;
  }
  function cubicsOfPath(path) { var out = [], cur = path.commands[0].points[0]; path.commands.forEach(function (c) { if (c.type === "M") { cur = c.points[0]; return; } if (c.type === "C") { out.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return out; }

  // 원형 소매의 기준 실루엣값(초기 UI). {sleeveLengthCm, cuffCircumferenceCm, hemCenterX, spY, bicepCm}.
  function referenceSilhouette(refSleeve) {
    if (!refSleeve || !Array.isArray(refSleeve.outline)) return null;
    var capSegs = refSleeve.outline.filter(function (s) { return s.kind === "path" || s.kind === "cubic"; });
    if (!capSegs.length) return null;
    var ends = capEnds(capSegs); if (!ends) return null;
    var back = ends[0].x < ends[1].x ? ends[0] : ends[1];
    var front = ends[0].x < ends[1].x ? ends[1] : ends[0];
    var spY = capApexY(capSegs);
    var lines = refSleeve.outline.filter(function (s) { return s.kind === "line"; });
    var isUnderarm = function (p) { return dist(p, back) < EPS || dist(p, front) < EPS; };
    var hem = lines.find(function (s) { return !isUnderarm(s.from) && !isUnderarm(s.to); });
    if (!hem) return null;
    var hemCenterX = (hem.from.x + hem.to.x) / 2, hemWidth = Math.abs(hem.to.x - hem.from.x);
    var hemY = (hem.from.y + hem.to.y) / 2;
    return { sleeveLengthCm: hemY - spY, cuffCircumferenceCm: hemWidth, hemCenterX: hemCenterX, spY: spY, bicepCm: Math.abs(front.x - back.x), backUnderarm: cp(back), frontUnderarm: cp(front) };
  }

  // S1 파생: cap 고정 + 하부(옆선·밑단) 재생성. sideShape "straight"(직선)|"gentle"(완만 곡선).
  //   반환 { ok, geometry:{outline,construction}, cuffCircumferenceCm, referenceCuffCm, sleeveLengthCm,
  //          warnings:[...] } | { ok:false, reason }.
  function computeSilhouette(refSleeve, params) {
    var ref = referenceSilhouette(refSleeve);
    if (!ref) return { ok: false, reason: "no-sleeve" };
    var len = params && params.sleeveLengthCm, cuff = params && params.cuffCircumferenceCm;
    var side = (params && params.sideShape) || "straight";
    if (typeof len !== "number" || !isFinite(len) || len <= 0) return { ok: false, reason: "invalid-length" };
    if (typeof cuff !== "number" || !isFinite(cuff) || cuff <= 0) return { ok: false, reason: "invalid-cuff" };
    if (side !== "straight" && side !== "gentle") return { ok: false, reason: "invalid-side-shape" };

    var capSegs = refSleeve.outline.filter(function (s) { return s.kind === "path" || s.kind === "cubic"; });
    var hemY = ref.spY + len, half = cuff / 2;
    var backHem = { x: ref.hemCenterX - half, y: hemY }, frontHem = { x: ref.hemCenterX + half, y: hemY };
    var backSide = sideSeg(ref.backUnderarm, backHem, side, -1);   // 뒤(왼쪽): 안쪽 = +x
    var frontSide = sideSeg(ref.frontUnderarm, frontHem, side, +1); // 앞(오른쪽): 안쪽 = -x
    var outline = capSegs.map(cloneSeg).concat([backSide, frontSide, L(backHem, frontHem)]);
    var warnings = [];
    if (cuff < ref.cuffCircumferenceCm - EPS) warnings.push("narrow-cuff");   // 원형보다 좁음(트임 없는 긴팔 착용 주의)
    return { ok: true, geometry: { outline: outline, construction: (refSleeve.construction || []).map(cloneSeg) },
      cuffCircumferenceCm: cuff, referenceCuffCm: ref.cuffCircumferenceCm, sleeveLengthCm: len, warnings: warnings };
  }
  // 옆선: 직선 = line. 완만 곡선 = 진동밑→밑단 cubic(중간을 안쪽으로 살짝 오목, 끝점은 정확).
  //   inwardSign = 안쪽 방향(뒤 −1: +x 가 안쪽 / 앞 +1: −x 가 안쪽). bow 는 길이에 비례해 작게.
  function sideSeg(u, h, side, inwardSign) {
    if (side === "straight") return L(u, h);
    var bow = -inwardSign * Math.min(1.2, dist(u, h) * 0.04);   // 안쪽으로 x 이동(오목)
    var c1 = { x: u.x + (h.x - u.x) * 0.33 + bow, y: u.y + (h.y - u.y) * 0.33 };
    var c2 = { x: u.x + (h.x - u.x) * 0.66 + bow, y: u.y + (h.y - u.y) * 0.66 };
    return { kind: "cubic", from: cp(u), c1: c1, c2: c2, to: cp(h) };
  }
  function cloneSeg(s) {
    if (s.kind === "line") return { kind: "line", from: cp(s.from), to: cp(s.to) };
    if (s.kind === "cubic") return { kind: "cubic", from: cp(s.from), c1: cp(s.c1), c2: cp(s.c2), to: cp(s.to) };
    if (s.kind === "path") return { kind: "path", commands: s.commands.map(function (c) { return { type: c.type, points: c.points.map(cp) }; }) };
    return s;
  }

  window.designSleeve = Object.freeze({ computeSilhouette: computeSilhouette, referenceSilhouette: referenceSilhouette });
})();
