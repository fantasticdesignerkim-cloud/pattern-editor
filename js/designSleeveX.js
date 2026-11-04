// ══════════════════════════════════════════════
// designSleeveX.js — 소매 Ⓧ 기모노 슬리브([패턴학교] P.54 «몸판에서 이어진 소매와 덧천을 제도한다» · 제도 방법 P.144–145 · 닫는다·벌린다 P.161).
//   순수 · 시안(2026-11-04 — 김님 구현 승인 · Q1/Q2 확정). DOM·storage 미접근.
//
// ★ Ⓧ 는 소매 붙임선이 없다 — 소매가 몸판에서 그대로 이어진다(P.55 «기모노 슬리브는 소매의 붙임선이 없이 몸판에서 이어진 소매»).
//   결과 = **몸판 일체형 뒤·앞(파생 몸판 · 소매 포함)** + **별도 덧천 한 장**. 출발 = 완료 몸판 Ⓐ 하나(bodiceResult 는 읽기만).
//   소매 달림선이 없으므로 기존 소매산·AH 이세는 이 라인에 적용되지 않는다(meta.armhole.easeApplicable = false).
//
// 책(P.54 · P.144–145)과 김님 확정:
//   · 앞 AH 다트는 닫아 **목둘레로 이동**(예시) — 어깨·밑단도 가능하나 **옆 이동은 불가**(P.144 1). 이동 위치(목둘레 지점)는 책에 수치가 없다.
//   · 뒤: 어깨선 연장 8 에서 직각 1.6 → 소매 중심선(SP–Ⓐ 연장 · 소매길이) · 소맷부리선 ⟂ 중심선. 앞: 직각 0.7(P.145 5).
//   · ★ = 진동 둘레 가장 안쪽 ⟂ BL → Ⓑ = ★선과 옆선의 중간점(BL 위) · ø = 그 간격. 앞 Ⓕ = 옆선에서 **뒤와 같은 ø**(P.145 5-⑤ · 김님 확정 Q2).
//   · ☆ = Ⓑ(앞 Ⓕ)에서 중심선에 직각 = 소매 폭 · 소매 밑 안내선 = Ⓑ(Ⓕ)에서 중심선과 평행.
//   · 팔꿈치 = SP–소맷부리 중점 → 중심선 직각선 ∩ 소매 밑 안내선 = Ⓒ(앞 Ⓙ) = 덧대는 끝. 소맷부리 = 소매 폭 × 3/4 (앞은 뒤와 같은 분량을 자른다).
//   · Ⓓ = 옆선 위 BL–WL 중점 · 몸판 덧대는 선 = Ⓑ(Ⓕ)–Ⓓ. 외곽 = … → 소매 밑선 → **Ⓒ → Ⓑ → Ⓓ**(김님 확정 Q1: 진동 아래 초승달 종이는 깎지 않고 남긴다).
//   · 덧천(P.145 7): 폭선 ø+ø(수평) · 옆선(수직) · 몸판쪽 ▣ 두 변 · 소매쪽 ▲(뒤 Ⓑ–Ⓒ) · ※(앞 Ⓕ–Ⓙ) — ▲ 와 ※ 의 두 호가 만나는 점이 위 꼭짓점.
// 구현 관례(책에 수치 없음 · 설정값 · 수정 가능): 목 다트 위치 = 목둘레 곡선 SNP 에서 45%(도해 실측) · SP 다듬기 폭 2cm(2차 베지어 · «SP 가 각지지 않도록»).
// 길이는 최종 geometry 실측(조각 수 많은 호는 점열 800 분할). 좌표: 몸판 좌표(뒤 왼쪽 · 앞 오른쪽 · 옆선 공유) · 덧천은 자기 좌표.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var BOOK = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 1.6, frontSlopeDropCm: 0.7, cuffRatio: 0.75 });
  var CONVENTION = Object.freeze({ neckDartRatio: 0.45, spFairCm: 2 });
  var DEFAULTS = Object.freeze(Object.assign({}, BOOK, CONVENTION));
  var KEYS = ["sleeveLengthCm"].concat(Object.keys(DEFAULTS));
  var SAME = 1e-3, CROSS_EPS = 1e-9, MOUTH_TOL = 0.1;   // 원형 데이터 잔차(진동 끝점 ~3e-4 · 다트 입구 ~0.1 이하 — Ⓣ·Ⓥ 와 같은 허용)

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function unit(a) { var l = Math.hypot(a.x, a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function perp(a) { return { x: -a.y, y: a.x }; }
  function rot(p, c, a) { var d = sub(p, c), ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; }
  function deg(r) { return r * 180 / Math.PI; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }

  // ── cubic 도구 ──
  function cubicAt(q, t) { var u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; }
  function qLen(q, t0, t1) { var n = Math.max(2, Math.ceil(800 * (t1 - t0))), s = 0, p = cubicAt(q, t0); for (var i = 1; i <= n; i++) { var c = cubicAt(q, t0 + (t1 - t0) * i / n); s += dist(p, c); p = c; } return s; }
  function splitQ(q, t) {
    var p01 = add(mul(q[0], 1 - t), mul(q[1], t)), p12 = add(mul(q[1], 1 - t), mul(q[2], t)), p23 = add(mul(q[2], 1 - t), mul(q[3], t));
    var a = add(mul(p01, 1 - t), mul(p12, t)), b = add(mul(p12, 1 - t), mul(p23, t)), m = add(mul(a, 1 - t), mul(b, t));
    return [[cp(q[0]), p01, a, m], [m, b, p23, cp(q[3])]];
  }
  function revQ(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  function revChain(cs) { return cs.slice().reverse().map(revQ); }
  function chainLen(cs) { var s = 0; cs.forEach(function (q) { s += qLen(q, 0, 1); }); return s; }
  function mapChain(cs, f) { return cs.map(function (q) { return q.map(f); }); }
  function flat(cs, n) { var o = []; cs.forEach(function (q, i) { for (var k = i ? 1 : 0; k <= n; k++) o.push(cubicAt(q, k / n)); }); return o; }
  function chainSplit(cs, s) {   // 호 길이 s 에서 둘로
    var acc = 0;
    for (var i = 0; i < cs.length; i++) {
      var l = qLen(cs[i], 0, 1);
      if (s <= acc + l || i === cs.length - 1) {
        var lo = 0, hi = 1, want = Math.max(0, Math.min(l, s - acc));
        for (var k = 0; k < 50; k++) { var m = (lo + hi) / 2; if (qLen(cs[i], 0, m) < want) lo = m; else hi = m; }
        var sp = splitQ(cs[i], (lo + hi) / 2);
        return [cs.slice(0, i).concat([sp[0]]), [sp[1]].concat(cs.slice(i + 1))];
      }
      acc += l;
    }
    return null;
  }
  function innermost(cs, sgn) {   // 진동 둘레의 가장 안쪽 점(뒤 = 최소 x · 앞 = 최대 x)
    var best = null;
    cs.forEach(function (q, i) { for (var k = 0; k <= 400; k++) { var t = k / 400, p = cubicAt(q, t); if (!best || sgn * p.x > sgn * best.p.x) best = { p: p, i: i, t: t }; } });
    var q = cs[best.i], lo = Math.max(0, best.t - 0.003), hi = Math.min(1, best.t + 0.003);
    for (var it = 0; it < 80; it++) { var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (sgn * cubicAt(q, m1).x < sgn * cubicAt(q, m2).x) lo = m1; else hi = m2; }
    return cubicAt(q, (lo + hi) / 2);
  }
  // ── 외곽 조각 ──
  function cubicsOf(s) {
    if (s.kind === "line") return [[cp(s.from), cp(s.from), cp(s.to), cp(s.to)]];
    var o = [], cur = null;
    s.commands.forEach(function (c) { if (c.type === "M") cur = cp(c.points[0]); else { o.push([cur, cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = cp(c.points[2]); } });
    return o;
  }
  function endsOf(s) { var c = cubicsOf(s); return [c[0][0], c[c.length - 1][3]]; }
  function pathOf(cs, extra) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); return o;
  }
  function L(a, b, extra) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; }); return s; }
  function extraOf(s) { var o = {}; Object.keys(s).forEach(function (k) { if (k !== "kind" && k !== "commands" && k !== "from" && k !== "to") o[k] = clone(s[k]); }); return o; }
  function reverseSeg(s) { if (s.kind === "line") { var o = clone(s); o.from = cp(s.to); o.to = cp(s.from); return o; } return pathOf(revChain(cubicsOf(s)), extraOf(s)); }
  function orientSeg(s, p) { var e = endsOf(s); return dist(e[0], p) <= dist(e[1], p) ? clone(s) : reverseSeg(s); }
  function orientCs(cs, p) { return dist(cs[0][0], p) <= dist(cs[cs.length - 1][3], p) ? cs : revChain(cs); }
  function byRoot(ol, root) { return ol.filter(function (s) { return s.boundary && s.boundary.root === root; }); }
  function fairCubic(a, c, b, d) {   // 모서리 c 를 두 변에서 d 만큼 잘라 2차 베지어(= 3차 표현)로 다듬는다 — 끝 방향 = 두 변 그대로(G1)
    var p1 = add(c, mul(unit(sub(a, c)), d)), p2 = add(c, mul(unit(sub(b, c)), d));
    return { p1: p1, p2: p2, q: [p1, add(p1, mul(sub(c, p1), 2 / 3)), add(p2, mul(sub(c, p2), 2 / 3)), p2] };
  }
  // ── 교차 · 내부 판정 ──
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) { var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d), e = CROSS_EPS; return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e)); }
  function loopSelfIntersects(loop) { var n = loop.length; for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true; } return false; }
  function pointInLoop(p, loop) { var c = false; for (var i = 0, j = loop.length - 1; i < loop.length; j = i++) { var a = loop[i], b = loop[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; }
  function distSeg(p, a, b) { var ab = sub(b, a), dd = dot(ab, ab), t = dd > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / dd)) : 0; return dist(p, add(a, mul(ab, t))); }
  function distLoop(p, loop) { var m = Infinity; for (var i = 1; i < loop.length; i++) m = Math.min(m, distSeg(p, loop[i - 1], loop[i])); return m; }
  function loopOf(segs) {   // 순서대로 이어진 외곽 → 점열 + 최대 틈(끝점 = 다음 시작점)
    var pts = [], gap = 0, prev = null;
    segs.forEach(function (s) { var cs = cubicsOf(s); if (prev) gap = Math.max(gap, dist(prev, cs[0][0])); flat(cs, 24).forEach(function (q, i) { if (pts.length && i === 0) return; pts.push(q); }); prev = cs[cs.length - 1][3]; });
    gap = Math.max(gap, dist(prev, pts[0]));
    return { ok: gap <= SAME, loop: pts, gapCm: gap };
  }
  function areaOf(pts) { var s = 0; for (var i = 0; i < pts.length; i++) { var a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; }
  function circleX(A, ra, B, rb, sgn) {   // 두 원(중심 A·B)의 교점 — sgn 쪽(AB 의 왼쪽 법선 방향 ×sgn). 안 만나면 null
    var d = dist(A, B); if (d < 1e-12 || d > ra + rb + 1e-12 || d < Math.abs(ra - rb) - 1e-12) return null;
    var a = (ra * ra - rb * rb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, ra * ra - a * a)), e = unit(sub(B, A)), m = add(A, mul(e, a));
    return add(m, mul(perp(e), sgn * h));
  }
  function angleAt(o, a, b) { var u = sub(a, o), v = sub(b, o); return deg(Math.abs(Math.atan2(cross(u, v), dot(u, v)))); }

  // ── 몸판 읽기 ──
  function readBack(back) {
    var ol = back.outline, neck = byRoot(ol, "back/neckline"), sn = byRoot(ol, "back/shoulder-neck"), sa = byRoot(ol, "back/shoulder-armhole"), arm = ol.filter(function (s) { return s.edge === "armhole"; }),
      side = byRoot(ol, "back/side-seam"), sideX = byRoot(ol, "back/side-seam-extension"), center = byRoot(ol, "back/center"), centerX = byRoot(ol, "back/center-extension"), hem = byRoot(ol, "back/hem");
    if (neck.length !== 1 || sn.length !== 1 || sa.length !== 1 || arm.length !== 1 || side.length !== 1 || sideX.length !== 1 || center.length !== 1 || centerX.length !== 1 || hem.length !== 1) return fail("bodice-read-failed", { piece: "back" });
    var se = endsOf(side[0]), U = se[0].y < se[1].y ? se[0] : se[1], WL = se[0].y < se[1].y ? se[1] : se[0];
    var armC = cubicsOf(arm[0]); armC = orientCs(armC, dist(armC[0][0], U) < SAME ? armC[armC.length - 1][3] : armC[0][0]);   // SP → 진동 아랫점
    if (dist(armC[armC.length - 1][3], U) > SAME) return fail("bodice-read-failed", { piece: "back", why: "armhole-ends" });
    var SP = cp(armC[0][0]), ae = endsOf(sa[0]);
    if (dist(ae[0], SP) > SAME && dist(ae[1], SP) > SAME) return fail("bodice-read-failed", { piece: "back", why: "shoulder-sp" });
    var L2 = dist(ae[0], SP) < SAME ? ae[1] : ae[0], ne = endsOf(sn[0]), nkE = endsOf(neck[0]);
    var SNP = (dist(ne[0], nkE[0]) < SAME || dist(ne[0], nkE[1]) < SAME) ? ne[0] : ne[1], L1 = dist(SNP, ne[0]) < SAME ? ne[1] : ne[0];
    if (!(dist(SNP, nkE[0]) < SAME || dist(SNP, nkE[1]) < SAME)) return fail("bodice-read-failed", { piece: "back", why: "neck-snp" });
    var legs = (back.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.id === "back-shoulder"; });
    if (legs.length !== 2) return fail("back-shoulder-dart-not-found", { legs: legs.length });
    var apex = function (l) { return l.dart.apexAt === "from" ? cp(l.from) : cp(l.to); }, T = apex(legs[0]);
    if (dist(T, apex(legs[1])) > 1e-6) return fail("back-shoulder-dart-not-found", { why: "apex" });
    return { ok: true, neck: neck[0], sn: sn[0], sa: sa[0], armC: armC, SP: SP, SNP: cp(SNP), L1: cp(L1), L2: cp(L2), T: T, U: cp(U), WL: cp(WL), side: side[0], sideExt: sideX[0], hem: hem[0], centerExt: centerX[0], center: center[0] };
  }
  function readFront(front) {
    var ol = front.outline, neck = ol.filter(function (s) { return s.edge === "neckline"; }), sh = ol.filter(function (s) { return s.edge === "shoulder"; });
    var aUp = byRoot(ol, "front/armhole-upper"), aLo = byRoot(ol, "front/armhole-lower"), side = byRoot(ol, "front/side-seam"), sideX = byRoot(ol, "front/side-seam-extension"),
      center = byRoot(ol, "front/center"), centerX = byRoot(ol, "front/center-extension"), hem = byRoot(ol, "front/hem");
    if (neck.length !== 1 || sh.length !== 1 || aUp.length !== 1 || aLo.length !== 1 || side.length !== 1 || sideX.length !== 1 || center.length !== 1 || centerX.length !== 1 || hem.length !== 1) return fail("bodice-read-failed", { piece: "front" });
    var legs = (front.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "armhole"; });
    if (legs.length !== 2) return fail("front-ah-dart-not-found", { legs: legs.length });
    var role = function (l) { var r = l.dart.attach && l.dart.attach.root; return /armhole-upper$/.test(r) ? "upper" : /armhole-lower$/.test(r) ? "lower" : null; };
    var up = legs.filter(function (l) { return role(l) === "upper"; })[0], lo = legs.filter(function (l) { return role(l) === "lower"; })[0];
    if (!up || !lo) return fail("front-ah-dart-not-found", { why: "leg-roles" });
    var apexOf = function (l) { return l.dart.apexAt === "from" ? cp(l.from) : cp(l.to); }, mouthOf = function (l) { return l.dart.apexAt === "from" ? cp(l.to) : cp(l.from); };
    var BP = apexOf(up); if (dist(BP, apexOf(lo)) > 1e-6) return fail("front-ah-dart-not-found", { why: "apex" });
    var upM = mouthOf(up), loM = mouthOf(lo), upE = endsOf(aUp[0]), loE = endsOf(aLo[0]), se = endsOf(side[0]);
    var Us = se[0].y < se[1].y ? se[0] : se[1], WL = se[0].y < se[1].y ? se[1] : se[0];
    if (!(dist(upE[0], upM) < MOUTH_TOL || dist(upE[1], upM) < MOUTH_TOL)) return fail("bodice-read-failed", { piece: "front", why: "upper-mouth" });
    var SP = dist(upE[0], upM) < MOUTH_TOL ? upE[1] : upE[0];
    if (!(dist(loE[0], Us) < SAME || dist(loE[1], Us) < SAME)) return fail("bodice-read-failed", { piece: "front", why: "armhole-ends" });
    var he = endsOf(sh[0]);
    if (dist(he[0], SP) > SAME && dist(he[1], SP) > SAME) return fail("bodice-read-failed", { piece: "front", why: "shoulder-sp" });
    var SNP = dist(he[0], SP) < SAME ? he[1] : he[0], nkE = endsOf(neck[0]);
    if (!(dist(SNP, nkE[0]) < SAME || dist(SNP, nkE[1]) < SAME)) return fail("bodice-read-failed", { piece: "front", why: "neck-snp" });
    return { ok: true, neck: neck[0], sh: sh[0], aUp: aUp[0], aLo: aLo[0], BP: BP, upM: upM, loM: loM, SP: cp(SP), SNP: cp(SNP), U: dist(loE[0], Us) < SAME ? cp(loE[0]) : cp(loE[1]), WL: cp(WL),
      side: side[0], sideExt: sideX[0], hem: hem[0], centerExt: centerX[0], center: center[0] };
  }

  // 앞 AH 다트를 닫아 목둘레로 옮긴다(P.144 1 · 닫는다·벌린다 P.161): 컷 BP → N(목둘레 위) · 위 조각(목 N ~ SNP · 어깨 · 위 진동)을 BP 축으로 돌려 AH 입구를 닫는다 → 목에 열린 V.
  function moveFrontDartToNeck(rf, ratio) {
    var a0 = sub(rf.upM, rf.BP), a1 = sub(rf.loM, rf.BP), ang = Math.atan2(cross(a0, a1), dot(a0, a1)), R = function (q) { return rot(q, rf.BP, ang); };
    var resid = dist(R(rf.upM), rf.loM); if (resid > MOUTH_TOL) return fail("front-ah-dart-unclosable", { residualCm: resid });
    var nk = orientCs(cubicsOf(rf.neck), rf.SNP), nl = chainLen(nk), arc = nl * ratio, sp = chainSplit(nk, arc);
    if (!sp) return fail("neck-dart-out-of-range");
    var N = cp(sp[0][sp[0].length - 1][3]);   // SNP → N(돌리는 쪽) · N → CF(고정)
    var upC = orientCs(cubicsOf(rf.aUp), rf.SP), loC = cubicsOf(rf.aLo); loC = orientCs(loC, rf.loM);   // SP → 위 입구 · 아래 입구 → 진동 아랫점
    var upR = mapChain(upC, R); loC = loC.map(function (q) { return q.map(cp); }); loC[0][0] = cp(upR[upR.length - 1][3]);   // 닫힌 입구 잔차(관찰값)는 위 입구로 붙인다
    return { ok: true, angRad: ang, angleDeg: deg(Math.abs(ang)), residualCm: resid, neckLen: nl, neckArc: arc, N: N, Nr: R(N), SNPr: R(rf.SNP), SPr: R(rf.SP),
      neckUp: sp[0], neckLo: sp[1], neckUpR: mapChain(sp[0], R), armhole: upR.concat(loC), armholeOrig: upC.concat(orientCs(cubicsOf(rf.aLo), rf.loM)), R: R };
  }

  // 한 쪽 소매 틀(P.144 2 · P.145 5): SP · 어깨선(몸 안쪽 = body 쪽) → 8 ⟂ drop → 중심선 u · 몸 쪽 법선 n
  function frame(SP, shoulderFrom, bodyRef, p, drop) {
    var us = unit(sub(SP, shoulderFrom)); if (!us) return null;
    var ns = perp(us); if (dot(ns, sub(bodyRef, SP)) < 0) ns = mul(ns, -1);
    var K8 = add(SP, mul(us, p.slopeRunCm)), A = add(K8, mul(ns, drop)), u = unit(sub(A, SP));
    var n = perp(u); if (dot(n, sub(bodyRef, SP)) < 0) n = mul(n, -1);
    return { us: us, ns: ns, K8: K8, A: A, u: u, n: n };
  }

  function draftSleeveX(bodice, aGeometry, params) {
    var SA = window.designSleeveA, SR = window.designSleeveR;
    if (!SA || !SR || !SR.gateBodiceA) return fail("no-module");
    var p = {}, bad = [];
    KEYS.forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (!(p.sleeveLengthCm > 0 && p.slopeRunCm > 0 && p.backSlopeDropCm > 0 && p.frontSlopeDropCm > 0 && p.cuffRatio > 0 && p.cuffRatio <= 1 && p.spFairCm > 0))
      return fail("input-out-of-range", { rule: "소매길이 > 0 · 경사 > 0 · 직각 > 0 · 0 < 소맷부리 비율 ≤ 1 · SP 다듬기 > 0" });
    if (!(p.neckDartRatio > 0.05 && p.neckDartRatio < 0.95)) return fail("neck-dart-out-of-range", { rule: "목 다트 위치 = 목둘레의 5% ~ 95%" });
    var g = SR.gateBodiceA(bodice, aGeometry); if (!g.ok) return g;
    var bb = readBack(bodice.back); if (!bb.ok) return bb;
    var rf = readFront(bodice.front); if (!rf.ok) return rf;
    var md = moveFrontDartToNeck(rf, p.neckDartRatio); if (!md.ok) return md;
    var Lc = p.sleeveLengthCm, sideX = bb.U.x;
    if (Math.abs(rf.U.x - sideX) > 1e-3 || Math.abs(bb.WL.x - sideX) > 1e-3) return fail("bodice-read-failed", { why: "side-seam-x" });

    // ═══ 뒤 ═══
    var inner = innermost(bb.armC, -1), BLy = bb.U.y, phi = (sideX - inner.x) / 2;
    if (!(phi > 0)) return fail("underarm-width-nonpositive", { phiCm: phi });
    var Bb = { x: inner.x + phi, y: BLy }, Db = { x: sideX, y: (BLy + bb.WL.y) / 2 };
    var fb = frame(bb.SP, bb.L2, bb.U, p, p.backSlopeDropCm); if (!fb) return fail("bodice-read-failed", { piece: "back", why: "shoulder" });
    var Eb = add(bb.SP, mul(fb.u, Lc)), Mb = add(bb.SP, mul(fb.u, Lc / 2)), hB = dot(sub(Bb, bb.SP), fb.n), sB = dot(sub(Bb, bb.SP), fb.u);
    if (!(hB > 0)) return fail("sleeve-width-nonpositive", { piece: "back", widthCm: hB });
    if (!(sB < Lc / 2)) return fail("elbow-before-underarm", { piece: "back", underarmAlongCm: sB, elbowAlongCm: Lc / 2 });
    var cutB = (1 - p.cuffRatio) * hB, E2b = add(Eb, mul(fb.n, p.cuffRatio * hB)), Cb = add(Mb, mul(fb.n, hB));

    // ═══ 앞 ═══
    var ff = frame(md.SPr, md.SNPr, rf.BP, p, p.frontSlopeDropCm); if (!ff) return fail("bodice-read-failed", { piece: "front", why: "shoulder" });
    var Ff = { x: sideX + phi, y: rf.U.y }, Df = { x: sideX, y: (rf.U.y + rf.WL.y) / 2 };   // 앞 Ⓕ = 옆선에서 뒤와 같은 ø(P.145 5-⑤)
    var Ef = add(md.SPr, mul(ff.u, Lc)), Mf = add(md.SPr, mul(ff.u, Lc / 2)), hF = dot(sub(Ff, md.SPr), ff.n), sF = dot(sub(Ff, md.SPr), ff.u);
    if (!(hF > 0)) return fail("sleeve-width-nonpositive", { piece: "front", widthCm: hF });
    if (!(sF < Lc / 2)) return fail("elbow-before-underarm", { piece: "front", underarmAlongCm: sF, elbowAlongCm: Lc / 2 });
    var cuffF = hF - cutB; if (!(cuffF > 0)) return fail("front-cuff-nonpositive", { frontWidthCm: hF, cutCm: cutB });
    var E2f = add(Ef, mul(ff.n, cuffF)), Cf = add(Mf, mul(ff.n, hF));

    // ═══ 덧천(P.145 7) — 폭선 ø+ø 위 두 끝 = 뒤 Ⓑ · 앞 Ⓕ, 아래 꼭짓점 = ▣ 두 변, 위 꼭짓점 = ▲ · ※ 두 호의 교점 ═══
    var sqB = dist(Bb, Db), sqF = dist(Ff, Df), triB = dist(Bb, Cb), starF = dist(Ff, Cf), Wg = 2 * phi;   // 폭선 = ø + ø
    var G0 = { x: 0, y: 0 }, G1 = { x: Wg, y: 0 };
    var Gd = circleX(G0, sqB, G1, sqF, 1), Gc = circleX(G0, triB, G1, starF, -1);
    if (!Gd || !Gc) return fail("gusset-unclosable", { sqBack: sqB, sqFront: sqF, triBack: triB, starFront: starF, widthCm: Wg });
    var gs = { x: 0, y: -Gc.y };   // 위 꼭짓점이 y = 0 이 되게 평행이동
    var gB = add(G0, gs), gF = add(G1, gs), gD = add(Gd, gs), gC = add(Gc, gs);

    // ═══ 외곽 조립 ═══
    var spB = fairCubic(bb.L2, bb.SP, Eb, p.spFairCm), spF = fairCubic(md.SNPr, md.SPr, Ef, p.spFairCm);
    if (!(p.spFairCm < dist(bb.L2, bb.SP) && p.spFairCm < Lc && p.spFairCm < dist(md.SNPr, md.SPr))) return fail("fair-too-wide");
    var bSegs = [], fSegs = [];
    var nkBE = endsOf(bb.neck), CBtop = dist(nkBE[0], bb.SNP) < SAME ? nkBE[1] : nkBE[0], neckB = orientSeg(bb.neck, CBtop);   // 뒤 중심 위 끝 → SNP
    bSegs.push(Object.assign(neckB, { role: "neck", piece: "back" }));
    bSegs.push(Object.assign(orientSeg(bb.sn, bb.SNP), { role: "shoulder", piece: "back" }));
    bSegs.push(L(bb.L1, bb.T, { role: "shoulder-dart", piece: "back", dart: { id: "back-shoulder", apexAt: "to", open: true } }));
    bSegs.push(L(bb.T, bb.L2, { role: "shoulder-dart", piece: "back", dart: { id: "back-shoulder", apexAt: "from", open: true } }));
    bSegs.push(L(bb.L2, spB.p1, { role: "shoulder", piece: "back", edge: "shoulder" }));
    bSegs.push(pathOf([spB.q], { role: "sp-fair", piece: "back" }));
    bSegs.push(L(spB.p2, Eb, { role: "sleeve-top", piece: "back" }));
    bSegs.push(L(Eb, E2b, { role: "cuff", piece: "back" }));
    bSegs.push(L(E2b, Cb, { role: "sleeve-underarm", piece: "back" }));
    bSegs.push(L(Cb, Bb, { role: "gusset-sleeve-edge", piece: "back", gusset: "back-sleeve" }));
    bSegs.push(L(Bb, Db, { role: "gusset-body-edge", piece: "back", gusset: "back-body" }));
    bSegs.push(L(Db, bb.WL, { role: "side-seam", piece: "back", edge: "side-seam" }));
    var sx = orientSeg(bb.sideExt, bb.WL); bSegs.push(sx);
    var hmB = orientSeg(bb.hem, endsOf(sx)[1]); bSegs.push(hmB);
    var cxB = orientSeg(bb.centerExt, endsOf(hmB)[1]); bSegs.push(cxB);
    bSegs.push(orientSeg(bb.center, endsOf(cxB)[1]));

    var nkF = md.neckLo, CFtop = nkF[nkF.length - 1][3];
    fSegs.push(Object.assign(pathOf(revChain(nkF), {}), { role: "neck", piece: "front", edge: "neckline" }));   // CF → N
    fSegs.push(L(md.N, rf.BP, { role: "neck-dart", piece: "front", dart: { id: "front-neck", apexAt: "to", open: true } }));
    fSegs.push(L(rf.BP, md.Nr, { role: "neck-dart", piece: "front", dart: { id: "front-neck", apexAt: "from", open: true } }));
    fSegs.push(Object.assign(pathOf(revChain(md.neckUpR), {}), { role: "neck", piece: "front", edge: "neckline" }));   // N' → SNP'
    fSegs.push(L(md.SNPr, spF.p1, { role: "shoulder", piece: "front", edge: "shoulder" }));
    fSegs.push(pathOf([spF.q], { role: "sp-fair", piece: "front" }));
    fSegs.push(L(spF.p2, Ef, { role: "sleeve-top", piece: "front" }));
    fSegs.push(L(Ef, E2f, { role: "cuff", piece: "front" }));
    fSegs.push(L(E2f, Cf, { role: "sleeve-underarm", piece: "front" }));
    fSegs.push(L(Cf, Ff, { role: "gusset-sleeve-edge", piece: "front", gusset: "front-sleeve" }));
    fSegs.push(L(Ff, Df, { role: "gusset-body-edge", piece: "front", gusset: "front-body" }));
    fSegs.push(L(Df, rf.WL, { role: "side-seam", piece: "front", edge: "side-seam" }));
    var sxF = orientSeg(rf.sideExt, rf.WL); fSegs.push(sxF);
    var hmF = orientSeg(rf.hem, endsOf(sxF)[1]); fSegs.push(hmF);
    var cxF = orientSeg(rf.centerExt, endsOf(hmF)[1]); fSegs.push(cxF);
    fSegs.push(orientSeg(rf.center, endsOf(cxF)[1]));

    var lpB = loopOf(bSegs), lpF = loopOf(fSegs);
    if (!lpB.ok || !lpF.ok) return fail("discontinuous", { back: lpB.gapCm, front: lpF.gapCm });
    if (loopSelfIntersects(lpB.loop) || loopSelfIntersects(lpF.loop)) return fail("self-intersection", { back: loopSelfIntersects(lpB.loop), front: loopSelfIntersects(lpF.loop) });
    // 종이 보존: 원래 진동 곡선이 새 외곽 안(또는 선 위)에 전부 남는다 — 진동 아래 초승달 종이를 깎지 않는다(김님 확정 Q1)
    var outside = function (cs, loop, sp) { var n = 0; flat(cs, 200).forEach(function (q) { if (!pointInLoop(q, loop) && distLoop(q, loop) > 1e-4 && dist(q, sp) > p.spFairCm) n++; }); return n; };   // SP 둘레는 다듬기로 깎인다(허용)
    var outB = outside(bb.armC, lpB.loop, bb.SP), outF = outside(md.armhole, lpF.loop, md.SPr);
    if (outB || outF) return fail("armhole-outside-pattern", { back: outB, front: outF });
    var gSegs = [L(gB, gC, { role: "gusset-back-sleeve", piece: "gusset", gusset: "back-sleeve" }), L(gC, gF, { role: "gusset-front-sleeve", piece: "gusset", gusset: "front-sleeve" }),
      L(gF, gD, { role: "gusset-front-body", piece: "gusset", gusset: "front-body" }), L(gD, gB, { role: "gusset-back-body", piece: "gusset", gusset: "back-body" })];
    var lpG = loopOf(gSegs);
    if (!lpG.ok || loopSelfIntersects(lpG.loop)) return fail("gusset-self-intersection");
    var gMid = { x: (gB.x + gF.x) / 2, y: gB.y };

    // ═══ 제도선(몸판 위 표시용 · 재단선 아님) ═══
    var C0 = function (a, b, role) { return L(a, b, { role: role }); };
    var starFootB = { x: inner.x, y: BLy };
    var dlB = { shoulderExt: C0(bb.SP, fb.K8, "shoulder-ext"), slopeDrop: C0(fb.K8, fb.A, "slope-drop"), star: C0(inner, starFootB, "star"), bl: C0(starFootB, { x: sideX, y: BLy }, "bl-gap"),
      guide: C0(Bb, add(bb.SP, mul(fb.u, dot(sub(Bb, bb.SP), fb.u))), "width-guide"), elbow: C0(Mb, Cb, "elbow-guide"),
      armhole: pathOf(bb.armC, { role: "original-armhole" }), notch: [Bb, Cb, Db] };
    var dlF = { shoulderExt: C0(md.SPr, ff.K8, "shoulder-ext"), slopeDrop: C0(ff.K8, ff.A, "slope-drop"), bl: C0({ x: sideX, y: rf.U.y }, Ff, "bl-gap"),
      guide: C0(Ff, add(md.SPr, mul(ff.u, dot(sub(Ff, md.SPr), ff.u))), "width-guide"), elbow: C0(Mf, Cf, "elbow-guide"), armhole: pathOf(md.armhole, { role: "original-armhole" }),
      originalShoulder: C0(rf.SNP, rf.SP, "original-shoulder"), originalNeck: pathOf(md.neckUp, { role: "original-neck" }), notch: [Ff, Cf, Df] };

    // ═══ 실측(최종 외곽에서 따로 잰다 — 구성 변수 재사용 없음) ═══
    var roleLen = function (segs, role) { var s = 0; segs.forEach(function (x) { if (x.role === role) s += chainLen(cubicsOf(x)); }); return s; };
    var legLens = function (segs, role) { return segs.filter(function (x) { return x.role === role; }).map(function (x) { return chainLen(cubicsOf(x)); }); };
    var topSeam = function (segs) { return roleLen(segs, "shoulder") + roleLen(segs, "sp-fair") + roleLen(segs, "sleeve-top"); };   // 어깨(다트 제외) + SP 곡선 + 중심선
    var seams = {
      top: { back: topSeam(bSegs), front: topSeam(fSegs) }, sleeveTop: { back: roleLen(bSegs, "sleeve-top"), front: roleLen(fSegs, "sleeve-top") }, shoulder: { back: roleLen(bSegs, "shoulder"), front: roleLen(fSegs, "shoulder") },
      underarm: { back: roleLen(bSegs, "sleeve-underarm"), front: roleLen(fSegs, "sleeve-underarm") }, cuff: { back: roleLen(bSegs, "cuff"), front: roleLen(fSegs, "cuff") },
      sideSeam: { back: roleLen(bSegs, "side-seam"), front: roleLen(fSegs, "side-seam") },
      notch: { back: { sleeveEdge: roleLen(bSegs, "gusset-sleeve-edge"), bodyEdge: roleLen(bSegs, "gusset-body-edge") }, front: { sleeveEdge: roleLen(fSegs, "gusset-sleeve-edge"), bodyEdge: roleLen(fSegs, "gusset-body-edge") } },
      gusset: { backSleeve: roleLen(gSegs, "gusset-back-sleeve"), frontSleeve: roleLen(gSegs, "gusset-front-sleeve"), frontBody: roleLen(gSegs, "gusset-front-body"), backBody: roleLen(gSegs, "gusset-back-body") },
      shoulderDart: legLens(bSegs, "shoulder-dart"), neckDart: legLens(fSegs, "neck-dart")
    };
    seams.sideSeam.back = roleLen(bSegs, "side-seam");
    var m = {
      rule: "pattern-school-p54-kimono-sleeve-X(2026-11-04 draft)", sleeveLengthCm: Lc,
      settings: { inputs: clone(p), defaults: clone(DEFAULTS), book: Object.keys(BOOK), conventionChoices: Object.keys(CONVENTION),
        constants: { underarmPoint: "Ⓑ = ★선과 옆선의 중점(BL 위) — P.144 2-⑥", frontUnderarm: "앞 Ⓕ = 옆선에서 뒤와 같은 ø — P.145 5-⑤(김님 확정 Q2)", gussetEnd: "Ⓓ = 옆선 위 BL–WL 중점 — P.144 3-②", elbow: "팔꿈치 = SP–소맷부리 중점 — P.145 4-②",
          cuffFront: "앞 소맷부리 = 앞 폭 − 뒤에서 자른 분량 ● — P.145 6-④", outline: "외곽 … → 소매 밑선 → Ⓒ → Ⓑ → Ⓓ(진동 아래 초승달 종이는 남긴다 — 김님 확정 Q1)", sleeveLengthFrom: "소매길이 = SP 에서 중심선을 따라(도해의 호 표시)" } },
      phiCm: phi, widthCm: { back: hB, front: hF, total: hB + hF }, cuff: { back: p.cuffRatio * hB, front: cuffF, ratio: p.cuffRatio, cutCm: cutB }, seams: seams,
      slope: { backCenterDeg: deg(Math.atan2(fb.u.y, fb.u.x)), frontCenterDeg: deg(Math.atan2(ff.u.y, ff.u.x)), backShoulderDeg: deg(Math.atan2(fb.us.y, fb.us.x)), frontShoulderBeforeDeg: deg(Math.atan2(rf.SP.y - rf.SNP.y, rf.SP.x - rf.SNP.x)),
        frontShoulderAfterDeg: deg(Math.atan2(md.SPr.y - md.SNPr.y, md.SPr.x - md.SNPr.x)) },
      frontDart: { kind: "AH → 목둘레(옆 이동 불가 — P.144 1)", angleDeg: md.angleDeg, mouthResidualCm: md.residualCm, neckDartWidthCm: dist(md.N, md.Nr), legCm: seams.neckDart, positionRatio: p.neckDartRatio, neckArcFromSnpCm: md.neckArc, neckLenCm: md.neckLen,
        apex: cp(rf.BP), N: cp(md.N), Nr: cp(md.Nr), note: "목 다트 위치(45%)는 책에 수치 없는 구현 관례(도해 실측) — 소매 경사에는 영향이 없다(BP 축 회전)" },
      backDart: { kind: "뒤 어깨 다트 — 닫지 않고 열린 채(외곽)", apex: cp(bb.T), legCm: seams.shoulderDart },
      points: { back: { SP: cp(bb.SP), K8: cp(fb.K8), A: cp(fb.A), innermost: cp(inner), starFoot: cp(starFootB), B: cp(Bb), C: cp(Cb), D: cp(Db), E: cp(Eb), E2: cp(E2b), M: cp(Mb), Fstar: cp(dlB.guide.to), L1: cp(bb.L1), L2: cp(bb.L2), T: cp(bb.T), SNP: cp(bb.SNP) },
        front: { SP: cp(md.SPr), SNP: cp(md.SNPr), K8: cp(ff.K8), A: cp(ff.A), F: cp(Ff), J: cp(Cf), D: cp(Df), E: cp(Ef), E2: cp(E2f), M: cp(Mf), BP: cp(rf.BP), N: cp(md.N), Nr: cp(md.Nr), Fstar: cp(dlF.guide.to) } },
      notchWedgeDeg: { back: angleAt(Bb, Cb, Db), front: angleAt(Ff, Cf, Df) },
      gusset: { widthCm: Wg, edges: seams.gusset, top: cp(gC), bottom: cp(gD), left: cp(gB), right: cp(gF), mid: gMid, areaCm2: areaOf(lpG.loop), note: "▲(뒤 소매쪽) · ※(앞 소매쪽) · ▣ 두 변(몸판쪽) — 폭선 ø+ø" },
      armhole: { backOrigCm: chainLen(bb.armC), frontOrigCm: chainLen(md.armholeOrig), frontClosedCm: chainLen(md.armhole), easeApplicable: false,
        note: "소매 달림선이 없는 몸판 일체형 — 소매산·AH 이세는 적용 안 됨(원래 진동선은 제도 참고선으로만 남는다)" },
      circumference: { cuffCm: 2 * (p.cuffRatio * hB + cuffF), elbowCm: 2 * (hB + hF), note: "현재 시안의 관찰값(B83 · 소매길이 54 부근) — 보편 치수·판정 기준 아님" },
      fit: [
        { id: "①", label: "뒤 몸판쪽 ▣", piece: "back", edge: "gusset-body-edge", from: cp(Bb), to: cp(Db), gusset: { from: cp(gB), to: cp(gD) } },
        { id: "②", label: "뒤 소매쪽 ▲", piece: "back", edge: "gusset-sleeve-edge", from: cp(Bb), to: cp(Cb), gusset: { from: cp(gB), to: cp(gC) } },
        { id: "③", label: "앞 소매쪽 ※", piece: "front", edge: "gusset-sleeve-edge", from: cp(Ff), to: cp(Cf), gusset: { from: cp(gF), to: cp(gC) } },
        { id: "④", label: "앞 몸판쪽 ▣", piece: "front", edge: "gusset-body-edge", from: cp(Ff), to: cp(Df), gusset: { from: cp(gF), to: cp(gD) } }],
      draftLayer: { back: dlB, front: dlF },
      unconfirmed: ["목 다트 위치 45% · SP 다듬기 2cm 는 책에 수치가 없는 구현 관례(설정값) — 김님 미확정",
        "소맷부리 둘레(현 시안 약 " + (2 * (p.cuffRatio * hB + cuffF)).toFixed(1) + ")·팔꿈치 둘레(약 " + (2 * (hB + hF)).toFixed(1) + ")는 이 시안의 관찰값 — 보편 치수 아님",
        "B83 · 소매길이 54 밖의 기본값 적합성은 미검토 · 덧천 3D 착용 검증은 하지 않음(평면 변 길이·형상만)",
        "앞 AH 다트는 목둘레로만 이동 — 어깨·밑단 이동은 이번 범위 밖(옆 이동은 책에서도 불가)"],
      checks: { closed: true, connected: true, maxGapCm: Math.max(lpB.gapCm, lpF.gapCm, lpG.gapCm), selfIntersection: false, gussetSelfIntersection: false, armholeOutsideCount: 0, pieces: 3, gussetSeparate: true,
        areasCm2: { back: areaOf(lpB.loop), front: areaOf(lpF.loop), gusset: areaOf(lpG.loop) } }
    };
    var gussetGeom = { outline: gSegs, construction: [L(gB, gF, { role: "gusset-width", piece: "gusset" }), L(gMid, gD, { role: "side-axis", piece: "gusset" })], pieces: ["gusset"], centerSeam: false, butted: false, integratedBodice: true, layoutGapCm: 0 };
    return { ok: true, geometry: gussetGeom, derivedBodice: { back: { outline: bSegs, construction: [dlB.armhole] }, front: { outline: fSegs, construction: [dlF.armhole] } },
      meta: m, warnings: [], sourceBodiceHash: bodice.hash !== undefined ? bodice.hash : null };
  }

  window.designSleeveX = Object.freeze({ draftSleeveX: draftSleeveX, KEYS: KEYS,
    RULES: Object.freeze({ defaults: DEFAULTS, book: BOOK, convention: CONVENTION, bodicePresetId: "bunka-bodice-A" }) });
})();
