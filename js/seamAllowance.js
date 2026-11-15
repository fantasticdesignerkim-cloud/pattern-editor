// ══════════════════════════════════════════════
// seamAllowance.js — 시접 외곽 순수 기하(2026-11-14 · DOM/상태/저장 없음 · 입력을 바꾸지 않는다)
//   입력: 닫힌 완성선 ring(line·cubic, 이어진 순서) + 변(edge)별 폭. 출력: 시접 외곽 점열 또는 «거부 + 사유».
//   · 직선 = 정확한 평행 이동. 곡선 = 정확한 법선 위 점을 잇는 점열(현 오차 ≤ TOL_CM — **엔지니어 검증 기준이지 교재 공식이 아니다**).
//   · 모서리 = 이웃 두 시접선의 연장 교점(miter). 너무 뾰족하면(MITER_LIMIT) 거부. 오목 모서리 = 두 시접선의 교차점에서 자름.
//   · 열린 다트 = 접기(위 겹 쪽으로 다트 분량을 눕힘) → 접힌 봉제선에 시접 → 펼침(반사·회전 복원). 접는 방향이 없으면 거부.
//   · 곡률 반경 < 폭 · 자기교차 · 맞닿음 · 다른 변 침범 = **몰래 잘라내지 않고 거부**(사유를 돌려준다).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var TOL_CM = 0.01, MITER_LIMIT = 4, EPS = 1e-9, STRAIGHT = Math.sin(Math.PI / 180), MAX_WIDTH_CM = 10;

  function V(x, y) { return { x: x, y: y }; }
  function sub(a, b) { return V(a.x - b.x, a.y - b.y); }
  function add(a, b) { return V(a.x + b.x, a.y + b.y); }
  function mul(a, k) { return V(a.x * k, a.y * k); }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function len(a) { return Math.hypot(a.x, a.y); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function unit(a) { var l = len(a); return l > EPS ? V(a.x / l, a.y / l) : null; }
  function rot(v, a) { var c = Math.cos(a), s = Math.sin(a); return V(v.x * c - v.y * s, v.x * s + v.y * c); }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  function cubicAt(s, t) { var u = 1 - t; return V(u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y); }
  function cubicD1(s, t) { var u = 1 - t; return V(3 * u * u * (s.c1.x - s.from.x) + 6 * u * t * (s.c2.x - s.c1.x) + 3 * t * t * (s.to.x - s.c2.x), 3 * u * u * (s.c1.y - s.from.y) + 6 * u * t * (s.c2.y - s.c1.y) + 3 * t * t * (s.to.y - s.c2.y)); }
  function pointAt(s, t) { return s.kind === "cubic" ? cubicAt(s, t) : V(s.from.x + (s.to.x - s.from.x) * t, s.from.y + (s.to.y - s.from.y) * t); }
  function tangentAt(s, t) {
    if (s.kind !== "cubic") return unit(sub(s.to, s.from));
    var d = unit(cubicD1(s, t)); if (d) return d;
    var h = 1e-3, a = Math.max(0, t - h), b = Math.min(1, t + h); return unit(sub(cubicAt(s, b), cubicAt(s, a)));   // 끝 조절점이 끝점과 겹친 곡선
  }
  function flat(s, n) { if (s.kind !== "cubic") return [V(s.from.x, s.from.y), V(s.to.x, s.to.y)]; var o = []; for (var k = 0; k <= n; k++) o.push(cubicAt(s, k / n)); return o; }
  function validSeg(s) {
    if (!s || (s.kind !== "line" && s.kind !== "cubic")) return false;
    var ps = s.kind === "cubic" ? [s.from, s.c1, s.c2, s.to] : [s.from, s.to];
    return ps.every(function (p) { return p && isFinite(p.x) && isFinite(p.y); });
  }
  function signedArea(pts) { var a = 0; for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }

  // 두 직선 p + s·d , q + u·e 의 교점
  function lineX(p, d, q, e) { var c = cross(d, e); if (Math.abs(c) < EPS) return null; var w = sub(q, p), s = cross(w, e) / c, u = cross(w, d) / c; return { s: s, u: u, pt: add(p, mul(d, s)) }; }
  // 두 선분의 교점(끝점 포함)
  function segX(a, b, c, d) {
    var r = sub(b, a), q = sub(d, c), den = cross(r, q); if (Math.abs(den) < EPS) return null;
    var w = sub(c, a), s = cross(w, q) / den, u = cross(w, r) / den;
    if (s < -1e-9 || s > 1 + 1e-9 || u < -1e-9 || u > 1 + 1e-9) return null;
    return { s: s, u: u, pt: add(a, mul(r, s)) };
  }
  function distToSeg(p, a, b) { var ab = sub(b, a), l2 = dot(ab, ab); if (l2 < EPS) return dist(p, a); var t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2)); return dist(p, add(a, mul(ab, t))); }
  function distToPoly(p, poly) { var m = Infinity; for (var i = 0; i + 1 < poly.length; i++) { var d = distToSeg(p, poly[i], poly[i + 1]); if (d < m) m = d; } return m; }
  function inPolygon(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) { var a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside; }
    return inside;
  }

  // 한 선의 시접선. 곡선은 정확한 법선 위 점(현 오차 ≤ TOL/2 될 때까지 나눔). ratio = 시접선 속도/완성선 속도(≤0 이면 곡률 반경 < 폭 → 꼬임)
  function offsetSeg(s, w, sg) {
    var nrm = function (t) { var tg = tangentAt(s, t); return tg ? V(tg.y * sg, -tg.x * sg) : null; };
    var off = function (t) { var n = nrm(t); return n ? add(pointAt(s, t), mul(n, w)) : null; };
    if (s.kind !== "cubic") { var a = off(0), b = off(1); return a && b ? { pts: [a, b], minRatio: 1 } : null; }
    var minRatio = 1, N = 48, h = 1e-4;
    if (w > 0) for (var k = 0; k <= N; k++) {
      var t = k / N, t0 = Math.max(0, t - h), t1 = Math.min(1, t + h), o0 = off(t0), o1 = off(t1), p0 = pointAt(s, t0), p1 = pointAt(s, t1);
      if (!o0 || !o1) return null;
      var dv = sub(p1, p0), l2 = dot(dv, dv); if (l2 < 1e-18) continue;
      var ratio = dot(sub(o1, o0), dv) / l2; if (ratio < minRatio) minRatio = ratio;
    }
    var pts = [], bad = false;
    (function rec(ta, pa, tb, pb, depth) {
      var tm = (ta + tb) / 2, pm = off(tm); if (!pm) { bad = true; return; }
      var cm = mul(add(pa, pb), 0.5);
      if (depth < 3 || (dist(pm, cm) > TOL_CM / 2 && depth < 14)) { rec(ta, pa, tm, pm, depth + 1); rec(tm, pm, tb, pb, depth + 1); }
      else pts.push(pb);
    })(0, off(0), 1, off(1), 0);
    var first = off(0); if (bad || !first) return null;
    return { pts: [first].concat(pts), minRatio: minRatio };
  }

  // 모서리 이음: A 의 끝과 B 의 시작. 두 시접선(끝을 한도만큼 연장)의 교차점 중 모서리에 가장 가까운 것에서 만난다.
  //   볼록 = 연장끼리 만남(연장 교점) · 오목 = 선끼리 만나 자름 · 폭이 다르면 한쪽 연장과 다른 쪽 선이 만날 수 있다. 거의 일직선 = 같은 폭만.
  //   keepStep = 접힌 다트처럼 두 선이 한 꼭짓점을 공유하지 않을 때: 일직선이면 합치지 않고 단차를 그대로 둔다.
  function join(A, B, tA, tB, wA, wB, Vx, sg, keepStep) {
    var a = A[A.length - 1], b = B[0];
    if (dist(a, b) <= 1e-7) { B[0] = V(a.x, a.y); return null; }
    var c = cross(tA, tB) * sg, d = dot(tA, tB), wm = Math.max(wA, wB), ang = Math.acos(Math.max(-1, Math.min(1, -d))) * 180 / Math.PI;
    if (Math.abs(c) < STRAIGHT) {
      if (d < 0) return { code: "cusp", reason: "선이 제자리에서 되돌아 꺾여 시접 모서리를 만들 수 없습니다" };
      if (Math.abs(wA - wB) > 1e-9) return { code: "step", reason: "거의 일직선으로 이어진 두 변의 폭이 달라(" + wA + " · " + wB + "cm) 계단이 생깁니다 — 같은 폭으로 맞추세요" };
      if (keepStep) return null;
      var m = mul(add(a, b), 0.5); A[A.length - 1] = m; B[0] = V(m.x, m.y); return null;
    }
    if (c < 0 && (wA === 0) !== (wB === 0)) return { code: "concave-zero", reason: "오목 모서리에서 한쪽 변만 시접 0 입니다 — 다른 변의 시접이 이 변을 덮습니다" };
    var K = MITER_LIMIT * wm + 1e-6, Ax = A.concat([add(a, mul(tA, K))]), Bx = [sub(b, mul(tB, K))].concat(B), na = Ax.length - 1, nb = Bx.length - 1;
    for (var k = 0; k <= na + nb - 2; k++) for (var ka = 0; ka <= k; ka++) {
      var i = na - 1 - ka, j = k - ka; if (i < 0 || j > nb - 1) continue;
      var hit = segX(Ax[i], Ax[i + 1], Bx[j], Bx[j + 1]); if (!hit) continue;
      var ml = dist(hit.pt, Vx);
      if (c > 0 && ml > MITER_LIMIT * wm + 1e-9) break;
      var keepA = Ax.slice(0, Math.min(i + 1, A.length)), keepB = Bx.slice(Math.max(j + 1, 1));
      A.length = 0; keepA.forEach(function (q) { A.push(q); }); A.push(hit.pt);
      B.length = 0; B.push(V(hit.pt.x, hit.pt.y)); keepB.forEach(function (q) { B.push(q); });
      return c > 0 ? { miterCm: ml, angleDeg: ang } : { concave: true };
    }
    if (c > 0) { var x = lineX(a, tA, b, tB), far = x ? dist(x.pt, Vx) : Infinity;
      return { code: "sharp", reason: "모서리가 너무 뾰족합니다(내각 " + r3(ang) + "°) — 연장 교점이 완성선 모서리에서 " + (isFinite(far) ? r3(far) + "cm" : "무한히 먼 곳으") + "로, 허용 한도(폭의 " + MITER_LIMIT + "배) 초과" }; }
    return { code: "concave-nomeet", reason: "오목 모서리에서 두 시접선이 만나지 않습니다(변이 시접 폭보다 짧음)" };
  }

  // 점열(끝이 다트 입구 쪽)과 반직선(origin + s·dir, s>0)의 교점을 끝에서부터 찾는다
  function hitBack(poly, origin, dir) {
    for (var i = poly.length - 2; i >= 0; i--) {
      var a = poly[i], b = poly[i + 1], x = lineX(a, sub(b, a), origin, dir);
      if (x && x.s >= -1e-9 && x.s <= 1 + 1e-9 && x.u > 1e-9) return { i: i, pt: x.pt };
    }
    return null;
  }
  // 열린 다트의 시접 산. OT = 위 겹 쪽 변의 시접선(끝 = 입구) · OU = 아래 겹 쪽 변의 시접선(시작 = 입구).
  //   ① 접기: 아래 겹 쪽을 다트 각만큼 돌려 두 다리를 맞붙인다 → 접힌 봉제선(위 겹 변 + 돌린 아래 겹 변).
  //   ② 시접: 접힌 봉제선의 시접선 F = 두 시접선을 모서리 이음(종이를 접은 채 한 번에 자르는 선).
  //   ③ 펼침: 접힌 다트 분량 두 겹은 위 겹 쪽 다리선 너머(다리선 ~ 접힌 선)에 누워 F 로 함께 잘린다 →
  //      위 겹 쪽 반 = 그 구간을 다리선에 대해 반사 · 아래 겹 쪽 반 = 다트 각만큼 되돌려 회전. 두 반은 다트 중심선에서 만난다.
  function dartCap(OT, OU, apex, mouthT, mouthU, tEndT, tStartU, w, sg) {
    var dT = unit(sub(mouthT, apex)), dU = unit(sub(mouthU, apex));
    if (!dT || !dU) return { code: "dart-shape", reason: "다트 다리 길이가 0 입니다" };
    var th = Math.atan2(cross(dU, dT), dot(dU, dT));   // 아래 겹 다리 → 위 겹 다리로 가는 회전(접기)
    if (Math.abs(th) < 1e-6 || Math.abs(th) > Math.PI / 2) return { code: "dart-shape", reason: "다트 각이 0 이거나 90°를 넘어 접을 수 없습니다" };
    var fwd = function (p) { return add(apex, rot(sub(p, apex), th)); }, back = function (p) { return add(apex, rot(sub(p, apex), -th)); };
    var refl = function (p) { var v = sub(p, apex), k = dot(v, dT); return add(apex, sub(mul(dT, 2 * k), v)); };
    var dC = rot(dT, th / 2), T = OT.slice(), Uf = OU.map(fwd), tUf = rot(tStartU, th);
    var jr = join(T, Uf, tEndT, tUf, w, w, mouthT, sg, true);
    if (jr && jr.code) return { code: jr.code, reason: "다트를 접은 봉제선의 모서리: " + jr.reason };
    var F = T.slice(); Uf.forEach(function (p) { if (dist(F[F.length - 1], p) > 1e-9) F.push(p); });
    var best = null;   // F 와 위 겹 다리선(연장)의 교점 — 입구에 가장 가까운 것
    for (var i = 0; i + 1 < F.length; i++) { var x = lineX(F[i], sub(F[i + 1], F[i]), apex, dT); if (x && x.s >= -1e-9 && x.s <= 1 + 1e-9 && x.u > 1e-9) { var dd = dist(x.pt, mouthT); if (!best || dd < best.d) best = { i: i, pt: x.pt, d: dd }; } }
    if (!best) return { code: "dart-shape", reason: "접힌 봉제선의 시접선이 다트 다리 연장선과 만나지 않습니다" };
    var top = F.slice(0, best.i + 1); if (dist(top[top.length - 1], best.pt) > 1e-9) top.push(best.pt);
    var rest = [best.pt].concat(F.slice(best.i + 1).filter(function (p) { return dist(p, best.pt) > 1e-9; }));
    var q = hitBack(top, apex, dC);
    if (!q) return { code: "dart-shape", reason: "접힌 다트 분량이 이 변의 시접선을 벗어납니다(변이 다트 반 폭보다 짧음)" };
    var L = [best.pt]; for (var k = top.length - 2; k > q.i; k--) L.push(top[k]); if (dist(L[L.length - 1], q.pt) > 1e-9) L.push(q.pt);   // 다리선 → … → 접힌 선(시접선을 거슬러)
    var cap = L.slice(1).map(refl), peak = cap.length ? cap[cap.length - 1] : best.pt;
    for (var j = L.length - 2; j >= 0; j--) cap.push(back(L[j]));
    return { T: top, U: rest.map(back), cap: cap, info: { apex: V(apex.x, apex.y), angleDeg: Math.abs(th) * 180 / Math.PI, peak: peak, onLegT: best.pt, onLegU: back(best.pt),
      foldedKinkDeg: Math.acos(Math.max(-1, Math.min(1, dot(tEndT, tUf)))) * 180 / Math.PI, legMismatchCm: Math.abs(dist(mouthT, apex) - dist(mouthU, apex)) } };
  }

  function refuse(list, edgeIds, r) { list.push({ edgeIds: edgeIds, code: r.code, reason: r.reason }); }

  // input = { ring:[seg…], edges:[{ id, segs:[ring index…], widthCm, darts:[{ legs:[i,j], topFirst:true|false|null }] }] }
  function build(input) {
    var ring = input && input.ring, edges = input && input.edges, out = { ok: false, points: null, edgePaths: {}, refusals: [], darts: [], stats: {} };
    if (!Array.isArray(ring) || ring.length < 2 || !ring.every(validSeg)) { refuse(out.refusals, [], { code: "input", reason: "완성선을 읽을 수 없습니다" }); return out; }
    var n = ring.length, i, owner = new Array(n), role = new Array(n), dartOf = new Array(n);
    for (i = 0; i < n; i++) if (dist(ring[i].to, ring[(i + 1) % n].from) > 1e-6) { refuse(out.refusals, [], { code: "input", reason: "완성선이 닫혀 있지 않습니다" }); return out; }
    if (!Array.isArray(edges) || !edges.length) { refuse(out.refusals, [], { code: "input", reason: "변 정보가 없습니다" }); return out; }
    var bad = null;
    edges.forEach(function (e) {
      if (!e || typeof e.id !== "string" || !Array.isArray(e.segs) || !e.segs.length) { bad = "변 형식 오류"; return; }
      if (!(typeof e.widthCm === "number" && isFinite(e.widthCm) && e.widthCm >= 0 && e.widthCm <= MAX_WIDTH_CM)) { bad = "시접 폭은 0~" + MAX_WIDTH_CM + "cm 의 숫자여야 합니다(" + e.id + ")"; return; }
      e.segs.forEach(function (k) { if (!(k >= 0 && k < n) || owner[k]) bad = "변 구간이 겹치거나 범위를 벗어납니다"; else { owner[k] = e; role[k] = "run"; } });
      (e.darts || []).forEach(function (d) {
        var a = d.legs && d.legs[0], b = d.legs && d.legs[1];
        if (!(owner[a] === e && owner[b] === e && b === (a + 1) % n && ring[a].kind === "line" && ring[b].kind === "line")) { bad = "다트 다리 지정 오류(" + e.id + ")"; return; }
        role[a] = "legA"; role[b] = "legB"; dartOf[a] = d;
      });
    });
    for (i = 0; i < n && !bad; i++) if (!owner[i]) bad = "변에 속하지 않은 선이 있습니다";
    if (bad) { refuse(out.refusals, [], { code: "input", reason: bad }); return out; }

    var fin = ring.map(function (s) { return flat(s, 48); }), all = []; fin.forEach(function (f) { for (var k = 0; k + 1 < f.length; k++) all.push(f[k]); });
    var sg = signedArea(all) > 0 ? 1 : -1;
    var off = new Array(n), failed = {}, minRadius = Infinity, maxMiter = 0, minAngle = 180;
    var fail = function (ids, r) { refuse(out.refusals, ids, r); ids.forEach(function (id) { failed[id] = true; }); };
    for (i = 0; i < n; i++) {
      if (role[i] !== "run") continue;
      var e = owner[i], o = offsetSeg(ring[i], e.widthCm, sg);
      if (!o) { fail([e.id], { code: "degenerate", reason: "방향을 정할 수 없는 선(길이 0)이 있습니다" }); continue; }
      if (e.widthCm > 0 && o.minRatio < 1) { var rho = e.widthCm / (1 - o.minRatio); if (rho < minRadius) minRadius = rho; }
      if (e.widthCm > 0 && o.minRatio <= 1e-3) { fail([e.id], { code: "radius", reason: "오목 곡선의 가장 급한 반경(" + r3(e.widthCm / (1 - o.minRatio)) + "cm)이 시접 폭(" + e.widthCm + "cm)보다 작아 시접선이 꼬입니다 — 폭을 줄이세요" }); continue; }
      off[i] = o.pts;
    }
    // 모서리(선-선) · 다트
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      if (role[i] === "run" && role[j] === "run") {
        if (!off[i] || !off[j]) continue;
        var ea = owner[i], eb = owner[j], r = join(off[i], off[j], tangentAt(ring[i], 1), tangentAt(ring[j], 0), ea.widthCm, eb.widthCm, ring[i].to, sg);
        if (r && r.code) fail(ea === eb ? [ea.id] : [ea.id, eb.id], r);
        else if (r && r.miterCm != null) { if (r.miterCm > maxMiter) maxMiter = r.miterCm; if (r.angleDeg < minAngle) minAngle = r.angleDeg; }
      } else if (role[i] === "legA") {
        var ed = owner[i], d = dartOf[i], p = (i + n - 1) % n, q = (i + 2) % n;
        if (role[p] !== "run" || role[q] !== "run" || owner[p] !== ed || owner[q] !== ed) { fail([ed.id], { code: "dart-shape", reason: "다트 양옆이 같은 변이 아닙니다" }); continue; }
        if (!off[p] || !off[q]) continue;
        if (ed.widthCm === 0) { off[i] = [V(ring[i].from.x, ring[i].from.y), V(ring[i].to.x, ring[i].to.y), V(ring[j].to.x, ring[j].to.y)]; continue; }   // 폭 0 = 완성선(V 그대로)
        if (d.topFirst !== true && d.topFirst !== false) { fail([ed.id], { code: "dart-direction", reason: "이 다트는 어느 쪽 겹이 위로 오는지(접는 방향)가 정해지지 않았습니다" }); continue; }
        var apex = ring[i].to, mA = ring[i].from, mB = ring[j].to, c;
        if (d.topFirst) c = dartCap(off[p], off[q], apex, mA, mB, tangentAt(ring[p], 1), tangentAt(ring[q], 0), ed.widthCm, sg);
        else {
          c = dartCap(off[q].slice().reverse(), off[p].slice().reverse(), apex, mB, mA, mul(tangentAt(ring[q], 0), -1), mul(tangentAt(ring[p], 1), -1), ed.widthCm, -sg);
          if (!c.code) c = { T: c.U.reverse(), U: c.T.reverse(), cap: c.cap.reverse(), info: c.info };
        }
        if (c.code) { fail([ed.id], c); continue; }
        off[p] = c.T; off[q] = c.U; off[i] = c.cap;
        out.darts.push(Object.assign({ edgeId: ed.id, topFirst: d.topFirst }, c.info));
      }
    }
    // 변별 경로(끊긴 변은 빼고 표시용으로 남긴다)
    var start = 0; for (i = 0; i < n; i++) if (owner[i] !== owner[(i + n - 1) % n]) { start = i; break; }
    var pts = [], push = function (arr, p) { var l = arr[arr.length - 1]; if (!l || dist(l, p) > 1e-9) arr.push(p); };
    for (var k = 0; k < n; k++) {
      var idx = (start + k) % n, own = owner[idx]; if (role[idx] === "legB" || !off[idx]) continue;
      if (!failed[own.id]) { var path = out.edgePaths[own.id] || (out.edgePaths[own.id] = []); off[idx].forEach(function (pp) { push(path, pp); }); }
      off[idx].forEach(function (pp) { push(pts, pp); });
    }
    Object.keys(failed).forEach(function (id) { delete out.edgePaths[id]; });
    out.stats = { minConcaveRadiusCm: isFinite(minRadius) ? r3(minRadius) : null, maxMiterCm: r3(maxMiter), minCornerDeg: r3(minAngle) };
    if (out.refusals.length) return out;
    if (pts.length > 2 && dist(pts[0], pts[pts.length - 1]) <= 1e-9) pts.pop();
    for (var ci = 0; ci < pts.length && pts.length > 3;) {   // 한 직선 위에 겹쳐 놓인 중간 점 정리(모양은 같다)
      var pa = pts[(ci + pts.length - 1) % pts.length], pb = pts[ci], pc = pts[(ci + 1) % pts.length], ab = sub(pb, pa), bc = sub(pc, pb);
      if (Math.abs(cross(ab, bc)) <= 1e-10 * Math.max(1, len(ab) * len(bc)) && dot(ab, bc) > 0) pts.splice(ci, 1); else ci++;
    }
    if (pts.length < 3) { refuse(out.refusals, [], { code: "input", reason: "시접 외곽을 만들 수 없습니다" }); return out; }

    // ── 독립 검사(결과 점열만 본다) ──
    var m = pts.length, a, b;
    for (a = 0; a < m && !out.refusals.length; a++) {   // 변이 시접에 먹혀 뒤집힘
      if (dist(pts[a], pts[(a + 1) % m]) < 1e-9) refuse(out.refusals, [], { code: "touch", reason: "시접선이 한 점으로 줄어든 곳이 있습니다" });
    }
    for (a = 0; a < m && !out.refusals.length; a++) for (b = a + 2; b < m; b++) {
      if (a === 0 && b === m - 1) continue;
      var hit = segX(pts[a], pts[(a + 1) % m], pts[b], pts[(b + 1) % m]);
      if (hit) { refuse(out.refusals, [], { code: "self-cross", reason: "시접선이 서로 닿거나 엇갈립니다(" + r3(hit.pt.x) + ", " + r3(hit.pt.y) + " 부근) — 폭이 이 형상에 비해 큽니다" }); break; }
    }
    if (!out.refusals.length) {   // 다른 변 침범: 각 변 시접선의 점은 모든 완성선에서 (두 변 중 좁은 폭) 이상 떨어져야 한다
      var finE = {}; for (i = 0; i < n; i++) if (role[i] === "run") { (finE[owner[i].id] || (finE[owner[i].id] = [])).push(fin[i]); }
      for (i = 0; i < n && !out.refusals.length; i++) {
        if (role[i] !== "run") continue;
        var oe = owner[i], poly = off[i], probes = []; poly.forEach(function (pp, t) { probes.push(pp); if (t + 1 < poly.length) probes.push(mul(add(pp, poly[t + 1]), 0.5)); });
        for (var ei = 0; ei < edges.length && !out.refusals.length; ei++) {
          var fe = edges[ei], need = Math.min(fe.widthCm, oe.widthCm); if (need <= 0) continue;   // 모서리에서는 좁은 쪽 폭까지가 정상
          var polys = fe === oe ? (fe.darts && fe.darts.length ? [fin[i]] : finE[fe.id]) : finE[fe.id];
          for (var pi = 0; pi < probes.length; pi++) {
            var dm = Infinity; polys.forEach(function (f) { var dd = distToPoly(probes[pi], f); if (dd < dm) dm = dd; });
            if (dm < need - TOL_CM) { refuse(out.refusals, fe === oe ? [oe.id] : [oe.id, fe.id], { code: "interference", reason: "시접선이 완성선에 " + r3(dm) + "cm 까지 가까워집니다(폭 " + need + "cm 보다 좁음) — 오목한 곳에서 시접이 겹칩니다" }); break; }
          }
        }
      }
    }
    if (!out.refusals.length) {   // 안/밖: 완성선 전체가 시접 외곽 안(또는 그 위)에 있어야 한다
      var closed = pts.concat([pts[0]]);
      for (a = 0; a < all.length; a += 3) if (!inPolygon(all[a], pts) && distToPoly(all[a], closed) > 1e-6) { refuse(out.refusals, [], { code: "outside", reason: "완성선 일부가 시접 외곽 밖으로 나갑니다" }); break; }
      if (!out.refusals.length && Math.abs(signedArea(pts)) < Math.abs(signedArea(all)) - 1e-6) refuse(out.refusals, [], { code: "outside", reason: "시접 외곽이 완성선보다 작습니다" });
    }
    if (out.refusals.length) return out;
    out.ok = true; out.points = pts;
    return out;
  }

  var api = Object.freeze({ build: build, TOL_CM: TOL_CM, MITER_LIMIT: MITER_LIMIT, MAX_WIDTH_CM: MAX_WIDTH_CM });
  if (typeof window !== "undefined") window.seamAllowance = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
