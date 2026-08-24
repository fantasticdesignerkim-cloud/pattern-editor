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
  function cubicsOfPath(path) { var out = [], cur = path.commands[0].points[0]; path.commands.forEach(function (c) { if (c.type === "M") { cur = c.points[0]; return; } if (c.type === "C") { out.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return out; }
  // 소매산(cap) 세그먼트 = 옆선·밑단이 아닌 것. hem = 양 끝점이 최대 y(밑단), 옆선 = hem 끝점에 닿는
  //   세그먼트. cap = 나머지(kind 무관 — gentle 옆선 cubic 도 hem 접점으로 걸러짐).
  function capSegsOf(sleeve) {
    var outline = (sleeve && sleeve.outline) || [];
    var hemY = -Infinity;
    outline.forEach(function (s) { endpointsOf(s).forEach(function (p) { if (p.y > hemY) hemY = p.y; }); });
    var atHem = function (p) { return Math.abs(p.y - hemY) < 0.5; };
    var isHem = function (s) { return s.kind === "line" && endpointsOf(s).every(atHem); };
    var touchesHem = function (s) { return !isHem(s) && endpointsOf(s).some(atHem); };
    return outline.filter(function (s) { return !isHem(s) && !touchesHem(s); });
  }
  // 세그먼트 → 조밀 점열(line/cubic/path). 40 샘플/cubic.
  function flattenSeg(s) {
    var out = [];
    if (s.kind === "line") { out.push(cp(s.from), cp(s.to)); return out; }
    var cubs = s.kind === "cubic" ? [[s.from, s.c1, s.c2, s.to]] : cubicsOfPath(s);
    cubs.forEach(function (q, ci) {
      for (var i = (ci === 0 ? 0 : 1); i <= 40; i++) { var t = i / 40, u = 1 - t;
        out.push({ x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x,
                   y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }); }
    });
    return out;
  }
  // cap 곡선 체인을 조밀 점열로 잇는다(끝점 매칭). apex/봉제길이용.
  function capPolyline(capSegs) {
    var polys = capSegs.map(flattenSeg);
    if (polys.length <= 1) return polys[0] || [];
    var chain = polys.shift().slice(), guard = polys.length + 1;
    while (polys.length && guard-- > 0) {
      var tail = chain[chain.length - 1], hooked = false;
      for (var i = 0; i < polys.length; i++) { var p = polys[i];
        if (dist(tail, p[0]) < EPS) { chain = chain.concat(p.slice(1)); polys.splice(i, 1); hooked = true; break; }
        if (dist(tail, p[p.length - 1]) < EPS) { chain = chain.concat(p.slice(0, -1).reverse()); polys.splice(i, 1); hooked = true; break; }
      }
      if (!hooked) break;
    }
    return chain;
  }
  function capApex(capSegs) {
    var pts = capPolyline(capSegs), ap = pts[0];
    pts.forEach(function (p) { if (p.y < ap.y) ap = p; });
    return cp(ap);
  }
  // 변환된 cap 의 앞/뒤 봉제 길이(apex 분할). back=낮은 x 끝→apex, front=apex→높은 x 끝.
  function measureCapSeam(capSegs) {
    var pts = capPolyline(capSegs); if (pts.length < 3) return null;
    var apex = 0; for (var i = 1; i < pts.length; i++) if (pts[i].y < pts[apex].y) apex = i;
    if (apex === 0 || apex === pts.length - 1) return null;
    var arc = function (a, b) { var s = 0; for (var k = a; k < b; k++) s += dist(pts[k], pts[k + 1]); return s; };
    var s2a = arc(0, apex), a2e = arc(apex, pts.length - 1);
    var backIsStart = pts[0].x < pts[pts.length - 1].x;
    return { back: backIsStart ? s2a : a2e, front: backIsStart ? a2e : s2a, total: s2a + a2e };
  }
  // 선분 교차(끝점 공유는 교차 아님).
  function segCross(a, b, c, d) {
    var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  // 폐곡선 점열의 자기교차(비인접 선분 교차). loop=닫힌 순서.
  function loopSelfIntersects(loop) {
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;   // 시작·끝 인접(폐곡선)
      if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true;
    }
    return false;
  }
  function transformSeg(s, tf) {
    if (s.kind === "line") return { kind: "line", from: tf(s.from), to: tf(s.to) };
    if (s.kind === "cubic") return { kind: "cubic", from: tf(s.from), c1: tf(s.c1), c2: tf(s.c2), to: tf(s.to) };
    if (s.kind === "path") return { kind: "path", commands: s.commands.map(function (c) { return { type: c.type, points: c.points.map(tf) }; }) };
    return cloneSeg(s);
  }
  // S2 cap 변환: SP·grain 중심축 고정. capHeight=SP→진동밑선 수직거리, bicep=양 진동밑점 총거리.
  //   앞/뒤 폭은 원형 비율 유지(대칭 분할 아님). cap anchor·control 을 SP-local 로 옮겨 앞/뒤 x 독립
  //   스케일 + y(높이) 스케일. 반환 {ok, segs, backU, frontU, spY} | {ok:false, reason}.
  function transformCap(refSleeve, ref, capParams) {
    var bicep = capParams.bicepCircumferenceCm, capH = capParams.capHeightCm;
    if (typeof bicep !== "number" || !isFinite(bicep) || bicep <= 0) return { ok: false, reason: "invalid-bicep" };
    if (typeof capH !== "number" || !isFinite(capH) || capH <= 0) return { ok: false, reason: "invalid-cap-height" };
    var SPx = ref.spX, SPy = ref.spY;
    var refBackW = SPx - ref.backUnderarm.x, refFrontW = ref.frontUnderarm.x - SPx, refCapH = ref.backUnderarm.y - SPy;
    if (refBackW <= 0 || refFrontW <= 0 || refCapH <= 0) return { ok: false, reason: "degenerate-cap" };
    var total = refBackW + refFrontW;
    var newBackW = bicep * (refBackW / total), newFrontW = bicep * (refFrontW / total);
    var sxBack = newBackW / refBackW, sxFront = newFrontW / refFrontW, sy = capH / refCapH;
    var tf = function (p) { var dx = p.x - SPx, dy = p.y - SPy; return { x: SPx + dx * (dx >= 0 ? sxFront : sxBack), y: SPy + dy * sy }; };
    var segs = capSegsOf(refSleeve).map(function (s) { return transformSeg(s, tf); });
    return { ok: true, segs: segs, backU: { x: SPx - newBackW, y: SPy + capH }, frontU: { x: SPx + newFrontW, y: SPy + capH }, spY: SPy };
  }

  // 원형 소매의 기준 실루엣값(초기 UI). {sleeveLengthCm, cuffCircumferenceCm, hemCenterX, spX/spY, ...}.

  // 원형 소매의 기준 실루엣값(초기 UI). {sleeveLengthCm, cuffCircumferenceCm, hemCenterX, spY, bicepCm}.
  function referenceSilhouette(refSleeve) {
    if (!refSleeve || !Array.isArray(refSleeve.outline)) return null;
    var capSegs = capSegsOf(refSleeve);
    if (!capSegs.length) return null;
    var ends = capEnds(capSegs); if (!ends) return null;
    var back = ends[0].x < ends[1].x ? ends[0] : ends[1];
    var front = ends[0].x < ends[1].x ? ends[1] : ends[0];
    var apex = capApex(capSegs);
    var lines = refSleeve.outline.filter(function (s) { return s.kind === "line"; });
    var isUnderarm = function (p) { return dist(p, back) < EPS || dist(p, front) < EPS; };
    var hem = lines.find(function (s) { return !isUnderarm(s.from) && !isUnderarm(s.to); });
    if (!hem) return null;
    var hemCenterX = (hem.from.x + hem.to.x) / 2, hemWidth = Math.abs(hem.to.x - hem.from.x);
    var hemY = (hem.from.y + hem.to.y) / 2;
    return {
      sleeveLengthCm: hemY - apex.y, cuffCircumferenceCm: hemWidth, hemCenterX: hemCenterX,
      spX: apex.x, spY: apex.y, bicepCm: Math.abs(front.x - back.x),
      capHeightCm: back.y - apex.y,   // SP→진동밑선 수직거리(양 진동밑 y 동일)
      backUnderarm: cp(back), frontUnderarm: cp(front)
    };
  }

  // 파생: params = { lower:{sleeveLengthCm, cuffCircumferenceCm, sideShape}, cap?:{bicepCircumferenceCm,
  //   capHeightCm} }. cap 있으면 원형 cap 을 SP-local 스케일 변환(S2), 없으면 원형 cap 고정(S1).
  //   그 뒤 진동밑점→소매부리 옆선 재생성. 형상 안전성(측정 가능·자기교차 없음) 확인.
  //   반환 { ok, geometry, cuffCircumferenceCm, referenceCuffCm, sleeveLengthCm, capLengths{front,back,total},
  //          bicepCircumferenceCm, capHeightCm, warnings } | { ok:false, reason }.
  function computeSilhouette(refSleeve, params) {
    var ref = referenceSilhouette(refSleeve);
    if (!ref) return { ok: false, reason: "no-sleeve" };
    var lower = (params && params.lower) || null, cap = (params && params.cap) || null;
    if (!lower) return { ok: false, reason: "invalid-length" };
    var len = lower.sleeveLengthCm, cuff = lower.cuffCircumferenceCm, side = lower.sideShape || "straight";
    if (typeof len !== "number" || !isFinite(len) || len <= 0) return { ok: false, reason: "invalid-length" };
    if (typeof cuff !== "number" || !isFinite(cuff) || cuff <= 0) return { ok: false, reason: "invalid-cuff" };
    if (side !== "straight" && side !== "gentle") return { ok: false, reason: "invalid-side-shape" };

    var capSegs, backU, frontU, spY;
    if (cap) {
      var tc = transformCap(refSleeve, ref, cap);
      if (!tc.ok) return tc;
      capSegs = tc.segs; backU = tc.backU; frontU = tc.frontU; spY = tc.spY;
    } else {
      capSegs = capSegsOf(refSleeve).map(cloneSeg);
      backU = cp(ref.backUnderarm); frontU = cp(ref.frontUnderarm); spY = ref.spY;
    }
    var hemY = spY + len, half = cuff / 2;
    var backHem = { x: ref.hemCenterX - half, y: hemY }, frontHem = { x: ref.hemCenterX + half, y: hemY };
    var backSide = sideSeg(backU, backHem, side, -1);
    var frontSide = sideSeg(frontU, frontHem, side, +1);
    var outline = capSegs.concat([backSide, frontSide, L(backHem, frontHem)]);

    // 형상 안전성(S2 완료 조건): 앞/뒤 측정 가능 + 자기교차·옆선 교차 없음.
    var capLen = measureCapSeam(capSegs);
    if (!capLen) return { ok: false, reason: "cap-unmeasured" };
    // 닫힌 순서 loop: backU →(cap)→ frontU →(frontSide)→ frontHem →(hem)→ backHem →(backSide 역)→ backU.
    var loop = capPolyline(capSegs)
      .concat(flattenSeg(frontSide).slice(1))   // frontU → frontHem
      .concat([cp(backHem)])                     // hem: frontHem → backHem
      .concat(flattenSeg(backSide).reverse().slice(1));   // backHem → … → backU(폐곡선 닫힘)
    if (loopSelfIntersects(loop)) return { ok: false, reason: "self-intersection" };

    var warnings = [];
    if (cuff < ref.cuffCircumferenceCm - EPS) warnings.push("narrow-cuff");
    return {
      ok: true, geometry: { outline: outline, construction: (refSleeve.construction || []).map(cloneSeg) },
      cuffCircumferenceCm: cuff, referenceCuffCm: ref.cuffCircumferenceCm, sleeveLengthCm: len,
      capLengths: capLen, bicepCircumferenceCm: Math.abs(frontU.x - backU.x), capHeightCm: backU.y - spY, warnings: warnings
    };
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

  // 관리형 cap 선(patternLine 포맷 {kind:"line"|"cubic"})의 anchor 목록(seg from + 마지막 to).
  function anchorsOfLine(segs) {
    var a = segs.map(function (s) { return cp(s.from); });
    if (segs.length) a.push(cp(segs[segs.length - 1].to));
    return a;
  }
  // patternLine 세그먼트(line/cubic) → geometry 세그먼트(line / path[M,C]).
  function lineSegToGeom(s) {
    if (s.kind === "line") return { kind: "line", from: cp(s.from), to: cp(s.to) };
    return { kind: "path", commands: [{ type: "M", points: [cp(s.from)] }, { type: "C", points: [cp(s.c1), cp(s.c2), cp(s.to)] }] };
  }
  function arcLenSegs(segs) { var t = 0; segs.forEach(function (s) { var p = flattenSeg(s); for (var i = 0; i < p.length - 1; i++) t += dist(p[i], p[i + 1]); }); return t; }

  // S3: 관리형 cap 선(source of truth)에서 소매 재합성. cap = 편집된 선, 하부(옆선·밑단)는 lower 로
  //   재생성. 위상 재검증(뒤 endpoint → SP → 앞 endpoint) + 자기교차 검사. SP=splitAnchorIndex 로 앞/뒤
  //   봉제 분리 측정. 반환 { ok, geometry, capLengths{front,back,total}, warnings } | { ok:false, reason }.
  function computeFromCapLine(refSleeve, capLineSegs, splitAnchorIndex, lower) {
    var ref = referenceSilhouette(refSleeve);
    if (!ref) return { ok: false, reason: "no-sleeve" };
    if (!lower) return { ok: false, reason: "invalid-length" };
    var len = lower.sleeveLengthCm, cuff = lower.cuffCircumferenceCm, side = lower.sideShape || "straight";
    if (typeof len !== "number" || !isFinite(len) || len <= 0) return { ok: false, reason: "invalid-length" };
    if (typeof cuff !== "number" || !isFinite(cuff) || cuff <= 0) return { ok: false, reason: "invalid-cuff" };
    if (!Array.isArray(capLineSegs) || !capLineSegs.length) return { ok: false, reason: "no-cap-line" };
    var anchors = anchorsOfLine(capLineSegs);
    if (typeof splitAnchorIndex !== "number" || splitAnchorIndex < 1 || splitAnchorIndex > anchors.length - 2) return { ok: false, reason: "cap-split" };
    var backU = anchors[0], frontU = anchors[anchors.length - 1], SP = anchors[splitAnchorIndex];
    // 위상: 뒤(낮은 x) → SP → 앞(높은 x), SP 는 진동밑선 위(작은 y).
    if (!(backU.x < SP.x && SP.x < frontU.x)) return { ok: false, reason: "cap-order" };
    if (!(SP.y < backU.y && SP.y < frontU.y)) return { ok: false, reason: "cap-order" };

    var capGeom = capLineSegs.map(lineSegToGeom);
    var spY = SP.y, half = cuff / 2, hemY = spY + len;
    var backHem = { x: ref.hemCenterX - half, y: hemY }, frontHem = { x: ref.hemCenterX + half, y: hemY };
    var backSide = sideSeg(backU, backHem, side, -1), frontSide = sideSeg(frontU, frontHem, side, +1);
    var outline = capGeom.concat([backSide, frontSide, L(backHem, frontHem)]);
    // 자기교차: 닫힌 loop(cap 선 flatten → 앞옆선 → 밑단 → 뒤옆선).
    var capPts = []; capLineSegs.forEach(function (s, i) { var p = flattenSeg(s); capPts = capPts.concat(i === 0 ? p : p.slice(1)); });
    var loop = capPts.concat(flattenSeg(frontSide).slice(1)).concat([cp(backHem)]).concat(flattenSeg(backSide).reverse().slice(1));
    if (loopSelfIntersects(loop)) return { ok: false, reason: "self-intersection" };
    // SP 분할 봉제 측정: back = segs[0..split-1], front = segs[split..].
    var backLen = arcLenSegs(capLineSegs.slice(0, splitAnchorIndex)), frontLen = arcLenSegs(capLineSegs.slice(splitAnchorIndex));
    if (!(backLen > 0 && frontLen > 0)) return { ok: false, reason: "cap-unmeasured" };
    var warnings = [];
    if (cuff < ref.cuffCircumferenceCm - EPS) warnings.push("narrow-cuff");
    return {
      ok: true, geometry: { outline: outline, construction: (refSleeve.construction || []).map(cloneSeg) },
      capLengths: { front: frontLen, back: backLen, total: frontLen + backLen },
      cuffCircumferenceCm: cuff, sleeveLengthCm: len, warnings: warnings
    };
  }
  // 원형/변환 cap geometry(path/cubic) → 관리형 patternLine 세그먼트 + SP anchor 인덱스(apex 최근접).
  function capLineFromGeometry(sleeveGeometry) {
    if (!sleeveGeometry || !Array.isArray(sleeveGeometry.outline)) return null;
    var capSegs = capSegsOf(sleeveGeometry);
    if (!capSegs.length) return null;
    // geometry cap → patternLine 세그먼트(line/cubic), 진동밑(낮은 x)에서 시작하도록 방향 정렬.
    var lineSegs = [];
    capSegs.forEach(function (s) {
      if (s.kind === "line") lineSegs.push({ kind: "line", from: cp(s.from), to: cp(s.to) });
      else if (s.kind === "cubic") lineSegs.push({ kind: "cubic", from: cp(s.from), c1: cp(s.c1), c2: cp(s.c2), to: cp(s.to) });
      else if (s.kind === "path") { var cur = s.commands[0].points[0]; s.commands.forEach(function (c) { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { lineSegs.push({ kind: "cubic", from: cp(cur), c1: cp(c.points[0]), c2: cp(c.points[1]), to: cp(c.points[2]) }); cur = c.points[2]; } }); }
    });
    if (!lineSegs.length) return null;
    // 방향: 시작 anchor 가 뒤(낮은 x)여야. 아니면 전체 역순.
    var first = lineSegs[0].from, last = lineSegs[lineSegs.length - 1].to;
    if (first.x > last.x) lineSegs = lineSegs.reverse().map(function (s) { return s.kind === "line" ? { kind: "line", from: cp(s.to), to: cp(s.from) } : { kind: "cubic", from: cp(s.to), c1: cp(s.c2), c2: cp(s.c1), to: cp(s.from) }; });
    // SP = apex(min y) 최근접 anchor.
    var anchors = anchorsOfLine(lineSegs), sp = 0;
    for (var i = 1; i < anchors.length; i++) if (anchors[i].y < anchors[sp].y) sp = i;
    if (sp < 1 || sp > anchors.length - 2) return null;
    return { segments: lineSegs, splitAnchorIndex: sp };
  }

  // S5: 최종 유효 소매 geometry 에서 cap 앞·뒤 primitives + SP 분할점 + 봉제 길이 추출(관리형 선 아님).
  //   반환 { frontPrimitives, backPrimitives, splitPoint, lengths{front,back,total} } | null.
  function capPrimitives(sleeveGeometry) {
    var lc = capLineFromGeometry(sleeveGeometry);
    if (!lc) return null;
    var sp = lc.splitAnchorIndex, segs = lc.segments, anchors = anchorsOfLine(segs);
    var back = segs.slice(0, sp), front = segs.slice(sp);
    if (!back.length || !front.length) return null;
    var backLen = arcLenSegs(back), frontLen = arcLenSegs(front);
    if (!(isFinite(backLen) && isFinite(frontLen) && backLen > 0 && frontLen > 0)) return null;
    return { frontPrimitives: front.map(function (s) { return cloneSeg(s); }), backPrimitives: back.map(function (s) { return cloneSeg(s); }),
      splitPoint: cp(anchors[sp]), lengths: { front: frontLen, back: backLen, total: frontLen + backLen } };
  }
  // S5: 최종 소매 outline 의 연결·단순성. hem/옆선/cap 식별 후 닫힌 loop 자기교차. 실패면 true(교차/비정상).
  function sleeveOutlineSelfIntersects(sleeveGeometry) {
    var outline = (sleeveGeometry && sleeveGeometry.outline) || [];
    if (outline.length < 3) return true;
    var hemY = -Infinity; outline.forEach(function (s) { endpointsOf(s).forEach(function (p) { if (p.y > hemY) hemY = p.y; }); });
    var atHem = function (p) { return Math.abs(p.y - hemY) < 0.5; };
    var isHem = function (s) { return s.kind === "line" && endpointsOf(s).every(atHem); };
    var hem = outline.find(isHem); if (!hem) return true;
    var sides = outline.filter(function (s) { return !isHem(s) && endpointsOf(s).some(atHem); });
    if (sides.length !== 2) return true;
    var capSegs = capSegsOf(sleeveGeometry); if (!capSegs.length) return true;
    var capPts = capPolyline(capSegs); if (capPts.length < 3) return true;
    var backX = capPts[0].x < capPts[capPts.length - 1].x;
    var backU = backX ? capPts[0] : capPts[capPts.length - 1], frontU = backX ? capPts[capPts.length - 1] : capPts[0];
    var sideOf = function (u) { return sides.find(function (s) { return endpointsOf(s).some(function (p) { return dist(p, u) < 0.5; }); }); };
    var bs = sideOf(backU), fs = sideOf(frontU); if (!bs || !fs) return true;
    var flatSide = function (s, u) { var p = flattenSeg(s); return dist(p[0], u) < 0.5 ? p : p.reverse(); };   // u 에서 시작
    var frontSidePts = flatSide(fs, frontU), backSidePts = flatSide(bs, backU);
    var frontHem = frontSidePts[frontSidePts.length - 1], backHem = backSidePts[backSidePts.length - 1];
    // loop: backU →(cap)→ frontU →(frontSide)→ frontHem →(hem)→ backHem →(backSide 역)→ backU
    var loop = (backX ? capPts : capPts.slice().reverse())
      .concat(frontSidePts.slice(1)).concat([cp(backHem)]).concat(backSidePts.slice(0, -1).reverse());
    return loopSelfIntersects(loop);
  }

  window.designSleeve = Object.freeze({ computeSilhouette: computeSilhouette, referenceSilhouette: referenceSilhouette, transformCap: transformCap, measureCapSeam: measureCapSeam, computeFromCapLine: computeFromCapLine, capLineFromGeometry: capLineFromGeometry, capPrimitives: capPrimitives, sleeveOutlineSelfIntersects: sleeveOutlineSelfIntersects });
})();
