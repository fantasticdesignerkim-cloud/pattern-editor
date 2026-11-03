// ══════════════════════════════════════════════
// designSleeveV.js — 소매 Ⓥ 래글런 슬리브([패턴학교] P.52 «몸판에 소매 달림선을 그리고 직접 제도한다(소매산 높이 = 평균 어깨 길이의 3/4)» ·
//   제도 방법 P.142–143 · 닫는다 P.160). 순수(DOM·storage 미접근). 김님 화면 확정 2026-11-01(«오키 확정» — 몸판 Ⓐ B83 · 소매길이 54 시안).
//
// ★ 출발 = 완료 몸판 Ⓐ(P.142 «예: 소매 Ⓥ» 도해 = 몸판 Ⓐ) — Ⓡ·Ⓣ 와 같은 형상 게이트(designSleeveR.gateBodiceA)를 재사용한다.
//   결과 = **파생 몸판(앞·뒤) + 두 장 소매(뒤 소매·앞 소매)**. 소매 중심선은 **솔기**다(P.52 «어깨부터 경사가 가파르기 때문에 소매 중심선을
//   솔기로 처리한다») — 한 장 맞댐이 아니다. bodiceResult 는 읽기만 한다(파생 몸판은 이 결과가 소유).
//
// 책(F) — P.52 도해 · P.142–143 단계:
//   P.142 1  앞 몸판 AH 다트를 옆으로 이동(옆선 위 «치수는 적당하게» 3 · BP 와 연결) — Ⓣ 와 같은 연산(designSleeveT.parts.moveFrontDart 재사용).
//   P.142 2  뒤 소매 달림선: ① 목둘레를 3등분해 중심에서 2/3 = N · ② 진동 둘레 곡선의 가장 안쪽에서 BL 에 직각 · ③ 그 중간점 = M · ④ N–M 안내선.
//   P.143 5  앞: ① 앞 목둘레 3등분 중심에서 2/3 = N · ② 가장 안쪽에서 BL 직각 · ③ BL 에서 2/3 = M · ④ N–M 안내선.
//   P.142 3 / P.143 6  ① 진동 둘레 아래쪽 몸판 소매 달림선(완만한 곡선) · ② 어깨선 연장 · ③ 8 에서 직각 뒤 3.4 / 앞 4 · ④ 소매 중심선(SP 와 이어 연장 · 소매길이)
//     · ⑤ 소맷부리선(④ 에 직각). 앞 달림선은 안내선에서 SP 쪽으로 0.6 부푼다(P.52 앞 도해 0.6).
//   P.143 4 / 7  ① 소매산 높이(P.137 1·2 — 평균 어깨 길이 × 3/4) · ② 소매 폭선(④ 직각) · ③ 소매 달림선 = 몸판 곡선을 ★ 에서 반전해 소매 폭선에 잇는다
//     (소매 달림 치수가 같도록 · ★ 위치는 적당히 · 매끄럽지 않으면 같은 치수 안에서 곡선 모양이나 소매 아랫점 위치를 바꿔 조정) · ④ 소매 밑 안내선(② 직각)
//     · ⑤ 소맷부리 폭 = 소매 폭의 3/4(앞은 뒤와 같은 분량을 자른다) · ⑥ 소매 밑선 · ⑦ SP 가 각지지 않도록 완만하게 · ⑧ (뒤) 닫는 선을 그린다(P.160).
//
// 이번 확정 시안의 선택(김님 «오키 확정» — **일반 공식이 아니라 이 시안의 설정값**, 전부 수정 가능 · meta.settings.draftChoices 에 출처 구분):
//   · 뒤 어깨 다트: 다트 끝을 원래 끝 T 에서 Ap(= 다트 이등분선 ∩ 래글런 안내선)로 옮겨 소매 쪽에서 닫는다 · 안내선 아래 몸판에 남는 다트 꼬리는 메운다.
//   · 뒤 소매 목 쪽: 닫은 직후의 꺾임(N′→Ap→안내선)을 Ap 강제 통과 없이 푼 곡선(N′ 끝 방향 = N′→Ap · Q = Ap 너머 4 에서 안내선 접선 · 길이 = 원래 경로)으로.
//   · ★ = M 에서 위로 뒤 2 / 앞 3.5(달림선 호 길이) · 앞 0.6 = 안내선에서 SP 쪽 최대 거리(N 쪽 핸들만 부풂, M 에서 안내선 접선).
//   · 몸판 아래 곡선 = M 에서 안내선 접선 · 진동 아랫점 위 뒤 1 / 앞 2 에서 진동에 접선 합류 · 핸들 0.45(진동선 바깥으로 나가면 거부 — 제1법칙).
//   · 소매 아래 곡선 = ★ 에서 몸판 달림선 접선 · 소매 아랫점 = 폭선 위 중심에서 뒤 16.75 / 앞 16.25 · 끝 방향 = 봉제 상태 겨드랑이 연결(180° − 몸판 진동 아랫점 각)
//     · 핸들 비 뒤 1.4 / 앞 0.35 · 길이 = 몸판 ★→진동 아랫점(같은 치수).
//   · 다듬기 폭: 뒤 어깨 닫은 자리 2 · SP 3 · 소맷부리 모서리 3(밑선과 직각) — 닫은 다리 끝 L1′·L2 가운데 점으로 정리(되돌아감 0.103 제거).
//   · 결과 관찰(기록만, 보정 없음): 중심 솔기 뒤 66.175 / 앞 66.159 — 차 0.016cm(0.16mm)는 그대로 둔다(억지 보정·새 허용오차 없음).
// 길이는 Gauss-Legendre 실측. 소매 좌표: 각 조각을 SP = (∓gap/2, 0) · 중심 솔기 = 세로(+y) · 뒤 = 왼쪽 · 앞 = 오른쪽(회전 — 거울 아님)으로 놓는다.
//   두 조각 사이 gap 은 표시 배치일 뿐이다(맞대지 않는다 — 솔기).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  // 책 수치(P.52 · P.142–143 — 설정값) + 이번 확정 시안 설정값(김님 확정 2026-11-01 · 일반 공식 아님).
  var BOOK = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 3.4, frontSlopeDropCm: 4, capHeightRatio: 0.75, sideDartDropCm: 3, frontBulgeCm: 0.6, cuffRatio: 0.75 });
  var DRAFT = Object.freeze({ backStarAboveMCm: 2, frontStarAboveMCm: 3.5, backLowerJoinCm: 1, frontLowerJoinCm: 2, lowerHandleRatio: 0.45,
    backUnderarmWidthCm: 16.75, frontUnderarmWidthCm: 16.25, backUnderHandleRatio: 1.4, frontUnderHandleRatio: 0.35,
    releaseBeyondApCm: 4, releaseHandleRatio: 0.5, shoulderFairCm: 2, spFairCm: 3, cuffFairCm: 3 });
  var DEFAULTS = Object.freeze(Object.assign({}, BOOK, DRAFT));
  var KEYS = ["sleeveLengthCm"].concat(Object.keys(DEFAULTS));
  var FAIR_HANDLE = 0.55, CUFF_HANDLE = 0.45, PIECE_GAP_CM = 4;   // 다듬기 곡선 제어점 비(모서리 쪽) · 소맷부리 다듬기 핸들(폭 ×) · 소매 두 조각 표시 간격
  var JOIN = 1e-9, SAME = 1e-3, ARM_TOL = 1e-4;
  var GX = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
    0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
  var GW = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685,
    0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function unit(a) { var l = Math.hypot(a.x, a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function perp(a) { return { x: -a.y, y: a.x }; }
  function rot(p, c, a) { var d = sub(p, c), ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; }
  function angOf(u, v) { return Math.atan2(cross(u, v), dot(u, v)); }
  function deg(r) { return r * 180 / Math.PI; }
  function lineX(a, ta, b, tb) { var den = cross(ta, tb); if (Math.abs(den) < 1e-12) return null; return add(a, mul(ta, cross(sub(b, a), tb) / den)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }

  // ── 3차 곡선 ──
  function cubicAt(q, t) { var u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; }
  function cubicD1(q, t) { var u = 1 - t; return { x: 3 * u * u * (q[1].x - q[0].x) + 6 * u * t * (q[2].x - q[1].x) + 3 * t * t * (q[3].x - q[2].x), y: 3 * u * u * (q[1].y - q[0].y) + 6 * u * t * (q[2].y - q[1].y) + 3 * t * t * (q[3].y - q[2].y) }; }
  function cubicLen(q, t0, t1) {   // Gauss-Legendre 16점 · 구간 8등분
    if (t0 === undefined) { t0 = 0; t1 = 1; }
    var s = 0, n = 8, h = (t1 - t0) / n;
    for (var k = 0; k < n; k++) { var a = t0 + k * h, b = a + h; for (var i = 0; i < 16; i++) { var d = cubicD1(q, (a + b) / 2 + (b - a) / 2 * GX[i]); s += GW[i] * (b - a) / 2 * Math.hypot(d.x, d.y); } }
    return s;
  }
  function tAtLen(q, s) { var lo = 0, hi = 1; for (var k = 0; k < 60; k++) { var m = (lo + hi) / 2; if (cubicLen(q, 0, m) < s) lo = m; else hi = m; } return (lo + hi) / 2; }
  function splitQ(q, t) {   // de Casteljau
    var a = add(q[0], mul(sub(q[1], q[0]), t)), b = add(q[1], mul(sub(q[2], q[1]), t)), c = add(q[2], mul(sub(q[3], q[2]), t));
    var d = add(a, mul(sub(b, a), t)), e = add(b, mul(sub(c, b), t)), f = add(d, mul(sub(e, d), t));
    return [[cp(q[0]), a, d, f], [cp(f), e, c, cp(q[3])]];
  }
  function lineQ(a, b) { return [cp(a), add(a, mul(sub(b, a), 1 / 3)), add(a, mul(sub(b, a), 2 / 3)), cp(b)]; }
  function revQ(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  function revChain(cs) { return cs.slice().reverse().map(revQ); }
  function mapChain(cs, f) { return cs.map(function (q) { return q.map(f); }); }
  function chainLen(cs) { var s = 0; cs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function flatQ(q, n) { var o = []; for (var i = 0; i <= n; i++) o.push(cubicAt(q, i / n)); return o; }
  function flatChain(cs, n) { var o = []; cs.forEach(function (q, i) { flatQ(q, n).slice(i ? 1 : 0).forEach(function (x) { o.push(x); }); }); return o; }
  // 체인 위 호 길이 s → 점·접선·(조각 번호, t)
  function chainAt(cs, s) {
    var acc = 0;
    for (var i = 0; i < cs.length; i++) {
      var l = cubicLen(cs[i]);
      if (s <= acc + l || i === cs.length - 1) { var t = tAtLen(cs[i], Math.max(0, Math.min(l, s - acc))); return { pt: cubicAt(cs[i], t), tan: unit(cubicD1(cs[i], t)), i: i, t: t }; }
      acc += l;
    }
    return null;
  }
  function chainSplit(cs, s) {   // 호 길이 s 에서 둘로
    var a = chainAt(cs, s), parts = splitQ(cs[a.i], a.t);
    var left = cs.slice(0, a.i), right = cs.slice(a.i + 1);
    if (a.t > 1e-12) left.push(parts[0]);
    if (a.t < 1 - 1e-12) right.unshift(parts[1]);
    return [left, right];
  }
  function chainSlice(cs, s0, s1) { return chainSplit(chainSplit(cs, s1)[0], s0)[1]; }
  function cubicsOf(s) {   // 외곽 조각 → cubic 목록(직선은 같은 직선의 cubic)
    if (s.kind === "line") return [lineQ(s.from, s.to)];
    var out = [], cur = null;
    s.commands.forEach(function (c) {
      if (c.type === "M") cur = cp(c.points[0]);
      else if (c.type === "C") { out.push([cur, cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = cp(c.points[2]); }
      else if (c.type === "L") { var p = cp(c.points[0]); out.push(lineQ(cur, p)); cur = p; }
    });
    return out;
  }
  function endsOf(s) { var c = cubicsOf(s); return [c[0][0], c[c.length - 1][3]]; }
  function pathOf(cs, extra) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; }); return o;
  }
  function L(a, b, extra) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; }); return s; }
  function orient(cs, start) { return dist(cs[0][0], start) <= dist(cs[cs.length - 1][3], start) ? cs : revChain(cs); }   // start 쪽에서 시작하게

  // ── 닫힌 점열 검사 ──
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) { var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d); return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)); }
  function loopSelfIntersects(loop) {   // 마지막 = 처음
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true;
    }
    return false;
  }
  function pointInLoop(p, loop) { var c = false; for (var i = 0, j = loop.length - 1; i < loop.length; j = i++) { var a = loop[i], b = loop[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; }
  function nearestOn(pts, p) { var best = Infinity; for (var i = 1; i < pts.length; i++) { var a = pts[i - 1], d = sub(pts[i], a), dd = dot(d, d), t = dd > 0 ? Math.max(0, Math.min(1, dot(sub(p, a), d) / dd)) : 0; best = Math.min(best, dist(p, add(a, mul(d, t)))); } return best; }
  // 외곽 조각들을 끝점으로 이어 닫힌 점열로(조각마다 한 번, 필요하면 뒤집음)
  function orderLoop(segs) {
    var left = segs.slice(1), pts = flatChain(cubicsOf(segs[0]), 24), gap = 0;
    while (left.length) {
      var end = pts[pts.length - 1], bi = -1, bd = Infinity, rv = false;
      left.forEach(function (s, i) { var e = endsOf(s), d0 = dist(e[0], end), d1 = dist(e[1], end); if (d0 < bd) { bd = d0; bi = i; rv = false; } if (d1 < bd) { bd = d1; bi = i; rv = true; } });
      gap = Math.max(gap, bd);
      var cs = cubicsOf(left[bi]); if (rv) cs = revChain(cs);
      flatChain(cs, 24).slice(1).forEach(function (x) { pts.push(x); });
      left.splice(bi, 1);
    }
    gap = Math.max(gap, dist(pts[0], pts[pts.length - 1]));
    return { ok: gap <= 1e-6, loop: pts, gapCm: gap };
  }

  // ── 몸판 읽기 ──
  function byRoot(outline, root) { return outline.filter(function (s) { return s.boundary && s.boundary.root === root; }); }
  function readBack(back) {
    var ol = back.outline, neck = ol.filter(function (s) { return s.edge === "neckline"; }), sn = byRoot(ol, "back/shoulder-neck"), sa = byRoot(ol, "back/shoulder-armhole"),
      arm = ol.filter(function (s) { return s.edge === "armhole"; }), side = byRoot(ol, "back/side-seam"), center = byRoot(ol, "back/center");
    if (neck.length !== 1 || sn.length !== 1 || sa.length !== 1 || arm.length !== 1 || side.length !== 1 || center.length !== 1) return fail("bodice-read-failed", { piece: "back" });
    var se = endsOf(side[0]), U = se[0].y < se[1].y ? se[0] : se[1], WL = se[0].y < se[1].y ? se[1] : se[0];
    var armC = cubicsOf(arm[0]); armC = orient(armC, dist(armC[0][0], U) < SAME ? armC[armC.length - 1][3] : armC[0][0]);   // SP → 진동 아랫점
    if (dist(armC[armC.length - 1][3], U) > SAME) return fail("bodice-read-failed", { piece: "back", why: "armhole-ends" });
    var SP = cp(armC[0][0]), ae = endsOf(sa[0]), L2 = dist(ae[0], SP) < SAME ? ae[1] : ae[0];
    if (dist(ae[0], SP) > SAME && dist(ae[1], SP) > SAME) return fail("bodice-read-failed", { piece: "back", why: "shoulder-sp" });
    var ne = endsOf(sn[0]), nk = cubicsOf(neck[0]), nkE = endsOf(neck[0]);
    var SNP = (dist(ne[0], nkE[0]) < SAME || dist(ne[0], nkE[1]) < SAME) ? ne[0] : ne[1], L1 = dist(SNP, ne[0]) < SAME ? ne[1] : ne[0];
    if (!(dist(SNP, nkE[0]) < SAME || dist(SNP, nkE[1]) < SAME)) return fail("bodice-read-failed", { piece: "back", why: "neck-snp" });
    nk = orient(nk, dist(nkE[0], SNP) < SAME ? nkE[1] : nkE[0]);   // 뒤 중심 → SNP
    var legs = (back.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.id === "back-shoulder"; });
    if (legs.length !== 2) return fail("back-shoulder-dart-not-found", { legs: legs.length });
    var apex = function (l) { return l.dart.apexAt === "from" ? cp(l.from) : cp(l.to); }, T = apex(legs[0]);
    if (dist(T, apex(legs[1])) > 1e-6) return fail("back-shoulder-dart-not-found", { why: "apex" });
    var cx = center[0].from.x, Ua = cp(armC[armC.length - 1][3]);   // 진동 아랫점 = 진동 끝점(옆선 위 끝과 ~1e-4 원형 데이터 잔차 — 파생 몸판 옆선은 이 점에서 다시 긋는다, Ⓣ 앞판과 같은 처리)
    return { ok: true, side: "back", neck: nk, arm: armC, SP: SP, SNP: cp(SNP), L1: cp(L1), L2: cp(L2), T: T, U: Ua, WL: cp(WL), BLY: U.y, centerX: cx, shoulderFrom: cp(L2), outline: ol, sideSeg: side[0] };
  }
  function readFront(front, mf) {
    var ol = front.outline, neck = ol.filter(function (s) { return s.edge === "neckline"; }), sh = ol.filter(function (s) { return s.edge === "shoulder"; }), center = byRoot(ol, "front/center");
    if (neck.length !== 1 || sh.length !== 1 || center.length !== 1) return fail("bodice-read-failed", { piece: "front" });
    var he = endsOf(sh[0]), SNP = dist(he[0], mf.SP) < SAME ? he[1] : he[0];
    if (dist(he[0], mf.SP) > SAME && dist(he[1], mf.SP) > SAME) return fail("bodice-read-failed", { piece: "front", why: "shoulder-sp" });
    var nkE = endsOf(neck[0]);
    if (!(dist(SNP, nkE[0]) < SAME || dist(SNP, nkE[1]) < SAME)) return fail("bodice-read-failed", { piece: "front", why: "neck-snp" });
    var nk = orient(cubicsOf(neck[0]), dist(nkE[0], SNP) < SAME ? nkE[1] : nkE[0]);   // 앞 중심 → SNP
    return { ok: true, side: "front", neck: nk, arm: mf.chain.map(function (q) { return q.map(cp); }), SP: cp(mf.SP), SNP: cp(SNP), U: cp(mf.U1), BLY: mf.U0.y,
      centerX: center[0].from.x, shoulderFrom: cp(SNP), outline: mf.outline, sideOutTo: cp(mf.S3r) };
  }
  // 진동 둘레 곡선의 가장 안쪽(뒤 = 최소 x · 앞 = 최대 x) — 촘촘히 뽑은 뒤 조각 안에서 3분 탐색
  function innermost(arm, sgn) {
    var best = null;
    arm.forEach(function (q, i) { for (var k = 0; k <= 200; k++) { var t = k / 200, p = cubicAt(q, t); if (!best || sgn * p.x > sgn * best.p.x) best = { p: p, i: i, t: t }; } });
    var q = arm[best.i], lo = Math.max(0, best.t - 0.005), hi = Math.min(1, best.t + 0.005);
    for (var it = 0; it < 80; it++) { var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (sgn * cubicAt(q, m1).x < sgn * cubicAt(q, m2).x) lo = m1; else hi = m2; }
    return cubicAt(q, (lo + hi) / 2);
  }

  // ── 몸판 소매 달림선(N → M → 진동 합류 → 진동 아랫점) ──
  function bodiceSeam(b, p, bodyLoop) {
    var nl = chainLen(b.neck), N = chainAt(b.neck, nl * 2 / 3).pt, nsplit = chainSplit(b.neck, nl * 2 / 3);
    var inner = innermost(b.arm, b.side === "back" ? -1 : 1);
    var M = b.side === "back" ? { x: inner.x, y: (inner.y + b.BLY) / 2 } : { x: inner.x, y: b.BLY - (b.BLY - inner.y) * 2 / 3 };
    var tg = unit(sub(M, N)); if (!tg) return fail("raglan-guide-degenerate", { piece: b.side });
    var upper;
    if (b.side === "back") upper = [lineQ(N, M)];
    else {   // 앞: 안내선에서 SP 쪽으로 최대 0.6(N 쪽 핸들만 부풂 · M 에서 안내선 접선)
      var Lg = dist(N, M), nn = perp(tg); if (dot(sub(b.SP, N), nn) < 0) nn = mul(nn, -1);
      var mk = function (k) { return [cp(N), add(add(N, mul(tg, Lg / 3)), mul(nn, k)), sub(M, mul(tg, Lg / 3)), cp(M)]; };
      var off = function (k) { var q = mk(k), m = -Infinity; for (var i = 0; i <= 600; i++) m = Math.max(m, dot(sub(cubicAt(q, i / 600), N), nn)); return m; };
      var lo = 0, hi = 5;
      if (p.frontBulgeCm > 0) { if (off(hi) < p.frontBulgeCm) return fail("front-bulge-unreachable"); for (var i2 = 0; i2 < 60; i2++) { var md = (lo + hi) / 2; if (off(md) < p.frontBulgeCm) lo = md; else hi = md; } }
      upper = [mk(p.frontBulgeCm > 0 ? lo : 0)];
    }
    // 아래 곡선: 진동 아랫점에서 d 위(호 길이)의 J 에서 진동에 접선 합류 · M 에서 안내선 접선 · 핸들 = 현 × k
    var d = b.side === "back" ? p.backLowerJoinCm : p.frontLowerJoinCm, AL = chainLen(b.arm);
    if (!(d >= 0 && d < AL)) return fail("lower-join-out-of-range", { piece: b.side, maxCm: AL });
    var Jat = chainAt(b.arm, AL - d), tail = d > 0 ? chainSplit(b.arm, AL - d)[1] : [], chJ = dist(M, Jat.pt), k = p.lowerHandleRatio;
    var lowQ = [cp(M), add(M, mul(tg, chJ * k)), sub(Jat.pt, mul(Jat.tan, chJ * k)), cp(Jat.pt)];
    // 제1법칙: 새 달림선이 원래 몸판 종이 밖(진동선 너머)으로 나가면 안 된다 — 원래 외곽 점-다각형 판정(진동선 위 ARM_TOL 이내 허용)
    var armPts = flatChain(b.arm, 200), outMax = 0;
    flatQ(lowQ, 300).forEach(function (q) { if (nearestOn(armPts, q) < ARM_TOL) return; if (!pointInLoop(q, bodyLoop)) outMax = Math.max(outMax, nearestOn(armPts, q)); });
    if (outMax > 0) return fail("raglan-leaves-bodice", { piece: b.side, outCm: outMax });
    var lower = [lowQ].concat(tail), path = upper.concat(lower);
    return { ok: true, N: N, M: M, inner: inner, tg: tg, upper: upper, lower: lower, path: path, upperLen: chainLen(upper), len: chainLen(path), J: Jat.pt, joinAboveUCm: d,
      neckBody: nsplit[0], neckSleeve: nsplit[1], neckLen: nl };
  }

  // ── 소매 틀(몸판 좌표): 어깨선 연장 8 ⟂ 직각 → 중심선 u · 소매 폭선(◉) · 소맷부리선 ──
  function frame(b, drop, capH, p) {
    var sd = unit(sub(b.SP, b.shoulderFrom)), K = add(b.SP, mul(sd, p.slopeRunCm)), pr = perp(sd); if (pr.y < 0) pr = mul(pr, -1);
    var A = add(K, mul(pr, drop)), u = unit(sub(A, b.SP)), n = perp(u); if (dot(n, sub(b.U, b.SP)) < 0) n = mul(n, -1);
    return { K: K, A: A, u: u, n: n, W0: add(b.SP, mul(u, capH)), E: add(b.SP, mul(u, p.sleeveLengthCm)) };
  }
  // 소매 아래 곡선: ★ 에서 몸판 달림선 접선 → 폭선 위 아랫점 U*. 끝 방향 = 봉제 상태에서 겨드랑이가 이어지는 방향(소매 아랫점 각 = 180° − 몸판 진동 아랫점 각).
  function underCurve(seam, b, F, s, w, cut, r) {
    var a = chainAt(seam.path, s), target = seam.len - s;
    var lastQ = seam.path[seam.path.length - 1], tU = unit(cubicD1(lastQ, 1));
    var sideOut = b.side === "back" ? unit(sub(b.WL, b.U)) : unit(sub(b.sideOutTo, b.U));
    var bodyAng = Math.abs(angOf(mul(tU, -1), sideOut));
    var Uw = add(F.W0, mul(F.n, w)), C = add(F.E, mul(F.n, w - cut)), us = unit(sub(C, Uw));
    var sg = Math.sign(cross(us, sub(a.pt, Uw))) || 1, t3 = mul(unit(rot(us, { x: 0, y: 0 }, sg * (Math.PI - bodyAng))), -1);
    var ch = dist(a.pt, Uw), qq = function (c) { return [cp(a.pt), add(a.pt, mul(a.tan, c * ch * r / (1 + r))), sub(Uw, mul(t3, c * ch / (1 + r))), cp(Uw)]; };
    var lo = 0.02, hi = 2.5;
    if (cubicLen(qq(hi)) < target || cubicLen(qq(lo)) > target) return fail("under-curve-unreachable", { piece: b.side, targetCm: target, chordCm: ch });
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (cubicLen(qq(m)) < target) lo = m; else hi = m; }
    var q = qq((lo + hi) / 2);
    if (loopSelfIntersects(flatQ(q, 120).concat([cp(a.pt)]))) return fail("under-curve-self-intersection", { piece: b.side });
    return { ok: true, q: q, star: a.pt, tan: a.tan, s: s, target: target, Ustar: Uw, C: C, bodyAngDeg: deg(bodyAng), sleeveAngDeg: deg(Math.abs(angOf(mul(t3, -1), us))), handleScale: (lo + hi) / 2 };
  }
  // 꺾은선의 지정 꼭짓점을 다듬는다: 모서리 양쪽 t 의 두 점을 3차로 잇고 제어점 = 각 점에서 모서리 쪽 FAIR_HANDLE(끝 접선 연속).
  function fairPolyline(pts, corners) {
    var cs = [], start = pts[0];
    for (var i = 1; i < pts.length - 1; i++) {
      var c = corners[i]; if (!c) continue;
      var Cn = pts[i], A = add(Cn, mul(unit(sub(pts[i - 1], Cn)), c)), B = add(Cn, mul(unit(sub(pts[i + 1], Cn)), c));
      cs.push(lineQ(start, A)); cs.push([cp(A), add(A, mul(sub(Cn, A), FAIR_HANDLE)), add(B, mul(sub(Cn, B), FAIR_HANDLE)), cp(B)]); start = B;
    }
    cs.push(lineQ(start, pts[pts.length - 1]));
    return cs;
  }
  // 소맷부리: 모서리 C 는 고정 · 소맷부리선이 밑선과 직각으로 C 에 닿도록 C 근처 t 만 굽힌다.
  function cuffTrue(E, C, Us, t) {
    var us = unit(sub(C, Us)), cd = unit(sub(C, E)), pp = perp(us); if (dot(pp, cd) < 0) pp = mul(pp, -1);
    var A = add(E, mul(cd, dist(E, C) - t)), h = t * CUFF_HANDLE;
    return [lineQ(E, A), [cp(A), add(A, mul(cd, h)), sub(C, mul(pp, h)), cp(C)]];
  }
  function cornerDeg(prev, at, next) { return deg(Math.abs(angOf(sub(prev, at), sub(next, at)))); }   // 내부각(°)

  function draftSleeveV(bodice, aGeometry, params) {
    var SA = window.designSleeveA, SR = window.designSleeveR, ST = window.designSleeveT;
    if (!SA || !SA.readBodiceArmhole || !SR || !SR.gateBodiceA || !ST || !ST.parts || !ST.parts.moveFrontDart) return fail("no-module");
    var p = {}, bad = [];
    KEYS.forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (!(p.slopeRunCm > 0 && p.backSlopeDropCm > 0 && p.frontSlopeDropCm > 0 && p.capHeightRatio > 0 && p.cuffRatio > 0 && p.cuffRatio <= 1 && p.frontBulgeCm >= 0))
      return fail("input-out-of-range", { rule: "경사 > 0 · 직각 > 0 · 소매산 높이 비율 > 0 · 0 < 소맷부리 비율 ≤ 1 · 앞 부풂 ≥ 0" });
    if (!(p.backStarAboveMCm > 0 && p.frontStarAboveMCm > 0 && p.backLowerJoinCm >= 0 && p.frontLowerJoinCm >= 0 && p.lowerHandleRatio > 0 && p.backUnderarmWidthCm > 0 && p.frontUnderarmWidthCm > 0
      && p.backUnderHandleRatio > 0 && p.frontUnderHandleRatio > 0 && p.releaseBeyondApCm > 0 && p.releaseHandleRatio > 0 && p.shoulderFairCm > 0 && p.spFairCm > 0 && p.cuffFairCm > 0))
      return fail("input-out-of-range", { rule: "시안 설정값은 > 0(진동 합류 위치는 ≥ 0)" });
    var g = SR.gateBodiceA(bodice, aGeometry); if (!g.ok) return g;
    var rb = SA.readBodiceArmhole(bodice); if (!rb || !rb.ok) return fail("bodice-read-failed", rb && rb.reason);
    var avg = (rb.back.heightCm + rb.front.heightCm) / 2, capH = avg * p.capHeightRatio;   // ◉ = 평균 어깨 길이 × 3/4 (P.137 1·2)
    if (!(p.sleeveLengthCm > capH)) return fail("sleeve-length-too-short", { capHeightCm: capH });
    var mf = ST.parts.moveFrontDart(bodice.front, { sideDartDropCm: p.sideDartDropCm }); if (!mf.ok) return mf;
    var bb = readBack(bodice.back); if (!bb.ok) return bb;
    var bf = readFront(bodice.front, mf); if (!bf.ok) return bf;
    var lbB = orderLoop(bodice.back.outline.concat([L(bb.L1, bb.T), L(bb.T, bb.L2)])), lbF = orderLoop(mf.outline);   // 원래 뒤 종이 = 외곽 + 열린 어깨 다트 다리
    if (!(lbB.gapCm <= SAME) || !(lbF.gapCm <= SAME)) return fail("bodice-read-failed", { why: "loop", back: lbB.gapCm, front: lbF.gapCm });
    var sB = bodiceSeam(bb, p, lbB.loop); if (!sB.ok) return sB;
    var sF = bodiceSeam(bf, p, lbF.loop); if (!sF.ok) return sF;
    var FB = frame(bb, p.backSlopeDropCm, capH, p), FF = frame(bf, p.frontSlopeDropCm, capH, p);
    // ★ = M 에서 위로(달림선 호 길이)
    var starB = sB.upperLen - p.backStarAboveMCm, starF = sF.upperLen - p.frontStarAboveMCm;
    if (!(starB > 0) || !(starF > 0)) return fail("star-out-of-range", { backMaxCm: sB.upperLen, frontMaxCm: sF.upperLen });
    var cut = p.backUnderarmWidthCm * (1 - p.cuffRatio);   // ● = 뒤 소매 폭 − 뒤 소맷부리(앞은 같은 분량)
    if (!(p.frontUnderarmWidthCm - cut > 0)) return fail("front-cuff-nonpositive", { frontWidthCm: p.frontUnderarmWidthCm, cutCm: cut });
    var uB = underCurve(sB, bb, FB, starB, p.backUnderarmWidthCm, cut, p.backUnderHandleRatio); if (!uB.ok) return uB;
    var uF = underCurve(sF, bf, FF, starF, p.frontUnderarmWidthCm, cut, p.frontUnderHandleRatio); if (!uF.ok) return uF;

    // ── 뒤 어깨 다트: 끝 T → Ap(이등분선 ∩ 안내선)로 옮겨 소매 쪽 목 조각을 Ap 축으로 돌려 닫는다(P.143 4-⑧ · P.160) · 몸판 쪽 꼬리는 메움 ──
    var u1 = unit(sub(bb.L1, bb.T)), u2 = unit(sub(bb.L2, bb.T)), Ap = lineX(bb.T, add(u1, u2), sB.N, sB.tg);
    if (!Ap) return fail("back-dart-close-failed", { why: "bisector-parallel" });
    var sAp = dist(sB.N, Ap);
    if (!(sAp > 0 && sAp < starB)) return fail("back-dart-close-failed", { why: "ap-not-on-upper-guide", sApCm: sAp });
    var closeA = angOf(sub(bb.L1, Ap), sub(bb.L2, Ap)), R = function (q) { return rot(q, Ap, closeA); };
    var Nr = R(sB.N), SNPr = R(bb.SNP), L1r = R(bb.L1), neckSlvB = mapChain(sB.neckSleeve, R);
    // Ap 강제 통과 해제 곡선: N′ → Q(안내선 위 Ap 너머) · N′ 끝 방향 = N′→Ap · Q 에서 안내선 접선 · 길이 = 원래 경로(|N′Ap| + |Ap Q|)
    var sQ = sAp + p.releaseBeyondApCm;
    if (!(sQ <= starB)) return fail("release-beyond-star", { sQCm: sQ, starCm: starB });
    var Q = chainAt(sB.path, sQ).pt, t0 = unit(sub(Ap, Nr)), relTarget = dist(Nr, Ap) + (sQ - sAp), rr = p.releaseHandleRatio, chR = dist(Nr, Q);
    var tgQ = chainAt(sB.path, sQ).tan;
    var rq = function (c) { return [cp(Nr), add(Nr, mul(t0, c * chR * rr / (1 + rr))), sub(Q, mul(tgQ, c * chR / (1 + rr))), cp(Q)]; };
    var rlo = 0.02, rhi = 4;
    if (cubicLen(rq(rhi)) < relTarget || cubicLen(rq(rlo)) > relTarget) return fail("release-curve-unreachable", { targetCm: relTarget });
    for (var ri = 0; ri < 60; ri++) { var rm = (rlo + rhi) / 2; if (cubicLen(rq(rm)) < relTarget) rlo = rm; else rhi = rm; }
    var relQ = rq((rlo + rhi) / 2);

    // ── 달림선 조각(몸판 쪽 · 소매 쪽) ──
    var bodyUpB = chainSplit(sB.path, starB)[0], bodyLowB = chainSplit(sB.path, starB)[1];
    var bodyUpF = chainSplit(sF.path, starF)[0], bodyLowF = chainSplit(sF.path, starF)[1];
    var slvUpB = [relQ].concat(chainSlice(sB.path, sQ, starB)), slvUpF = bodyUpF.map(function (q) { return q.map(cp); });
    var slvLowB = [uB.q], slvLowF = [uF.q];

    // ── 다듬기(시안 설정값): 뒤 = 닫은 다리 끝 L1′·L2 가운데 Dm 으로 정리 → 어깨 2 · SP 3 / 앞 = SP 3 / 소맷부리 3(밑선과 직각) ──
    var Dm = mid(L1r, bb.L2);
    var chkFair = function (pts, corners) { for (var i = 1; i < pts.length - 1; i++) { var c = corners[i]; if (!c) continue; var prevRoom = dist(pts[i - 1], pts[i]) - (corners[i - 1] || 0), nextRoom = dist(pts[i], pts[i + 1]) - (corners[i + 1] || 0); if (!(c < prevRoom && c < nextRoom)) return false; } return true; };
    var topPtsB = [SNPr, Dm, bb.SP, FB.E], topCB = { 1: p.shoulderFairCm, 2: p.spFairCm }, topPtsF = [bf.SNP, bf.SP, FF.E], topCF = { 1: p.spFairCm };
    if (!chkFair(topPtsB, topCB) || !chkFair(topPtsF, topCF)) return fail("fair-too-wide");
    var CB = add(FB.E, mul(FB.n, p.backUnderarmWidthCm - cut)), CF = add(FF.E, mul(FF.n, p.frontUnderarmWidthCm - cut));
    if (!(p.cuffFairCm < dist(FB.E, CB) && p.cuffFairCm < dist(FF.E, CF))) return fail("fair-too-wide", { cuff: true });
    var topB = fairPolyline(topPtsB, topCB), topF = fairPolyline(topPtsF, topCF);
    var cuffB = cuffTrue(FB.E, CB, uB.Ustar, p.cuffFairCm), cuffF = cuffTrue(FF.E, CF, uF.Ustar, p.cuffFairCm);

    // ── 조각 외곽(몸판 좌표 · 반시계/시계 무관 — 닫힌 순서) ──
    var slvSegsBody = function (side, up, neck, top, cuff, Cc, Us, low) {
      return [pathOf(up.concat(low), { role: "raglan", piece: side }),   // 목 → ★ → 소매 아랫점(소매 달림선)
        pathOf(neck, { role: "neck", piece: side }), pathOf(top, { role: "center-seam", piece: side }),
        pathOf(cuff, { role: "hem", piece: side }), L(Cc, Us, { role: "underarm", piece: side })];
    };
    var sleeveBodice = { back: slvSegsBody("back", slvUpB, neckSlvB, topB, cuffB, CB, uB.Ustar, slvLowB), front: slvSegsBody("front", slvUpF, sF.neckSleeve, topF, cuffF, CF, uF.Ustar, slvLowF) };
    // 파생 몸판: 뒤 = 목(중심~N) + 달림선 + 원래 옆·밑단·중심(다트 꼬리 메움) / 앞 = 목 + 달림선 + 옆 다트(Ⓣ 이동) + 나머지
    var keepB = bodice.back.outline.filter(function (s) { return s.edge !== "neckline" && s.edge !== "shoulder" && s.edge !== "armhole" && s !== bb.sideSeg; }).map(clone)
      .concat([L(bb.U, bb.WL, { edge: "side-seam", boundary: clone(bb.sideSeg.boundary) })]);
    var keepF = mf.outline.filter(function (s) { return s.edge !== "neckline" && s.edge !== "shoulder" && s.edge !== "armhole"; }).map(clone);
    var derivedBodice = {
      back: { outline: [pathOf(sB.neckBody, { edge: "neckline", boundary: { root: "back/neckline", raglan: "body" } }), pathOf(sB.path, { edge: "raglan", boundary: { root: "back/raglan" } })].concat(keepB) },
      front: { outline: [pathOf(sF.neckBody, { edge: "neckline", boundary: { root: "front/neckline", raglan: "body" } }), pathOf(sF.path, { edge: "raglan", boundary: { root: "front/raglan" } })].concat(keepF) }
    };
    var dB = orderLoop(derivedBodice.back.outline), dF = orderLoop(derivedBodice.front.outline);
    if (!dB.ok || !dF.ok) return fail("discontinuous", { back: dB.gapCm, front: dF.gapCm });
    if (loopSelfIntersects(dB.loop) || loopSelfIntersects(dF.loop)) return fail("bodice-self-intersection");
    var lsB = orderLoop(sleeveBodice.back), lsF = orderLoop(sleeveBodice.front);
    if (!lsB.ok || !lsF.ok) return fail("discontinuous", { sleeveBack: lsB.gapCm, sleeveFront: lsF.gapCm });
    if (loopSelfIntersects(lsB.loop) || loopSelfIntersects(lsF.loop)) return fail("self-intersection");

    // ── 소매 좌표(두 장 · 중심 솔기 세로): 뒤 Tb(q) = (−n·v − gap/2, u·v) · 앞 Tf(q) = (n·v + gap/2, u·v) — 회전(거울 아님) ──
    var Tb = function (q) { var v = sub(q, bb.SP); return { x: -dot(FB.n, v) - PIECE_GAP_CM / 2, y: dot(FB.u, v) }; };
    var Tf = function (q) { var v = sub(q, bf.SP); return { x: dot(FF.n, v) + PIECE_GAP_CM / 2, y: dot(FF.u, v) }; };
    if (!(cross(FB.u, FB.n) > 0.999999) || !(cross(FF.n, FF.u) > 0.999999)) return fail("sleeve-mirror", { why: "sleeve placement must be a rotation" });
    var mapSeg = function (s, T) { var o = clone(s); if (o.kind === "line") { o.from = T(o.from); o.to = T(o.to); } else o.commands.forEach(function (c) { c.points = c.points.map(T); }); return o; };
    var outline = sleeveBodice.back.map(function (s) { return mapSeg(s, Tb); }).concat(sleeveBodice.front.map(function (s) { return mapSeg(s, Tf); }));
    var gb = function (side, T, F, Us, w) {
      var G = add(F.E, mul(F.n, w));
      return [L(T(F.W0), T(Us), { role: "width-line", piece: side }), L(T(Us), T(G), { role: "underarm-guide", piece: side }), L(T(F.E), T(G), { role: "cuff-guide", piece: side })];
    };
    var construction = gb("back", Tb, FB, uB.Ustar, p.backUnderarmWidthCm).concat(gb("front", Tf, FF, uF.Ustar, p.frontUnderarmWidthCm));

    // ── 실측(독립 계산 — 각 재단선을 따로 잰다) ──
    var nB = sAp, nF = chainLen(bodyUpF) / 2;   // 맞춤 ①: 뒤 = 목에서 |N Ap| · 앞 = 목~★ 의 가운데
    var segs = function (up, low, notch) { var a = chainSplit(up, notch); return { neckToNotchCm: chainLen(a[0]), notchToStarCm: chainLen(a[1]), starToUnderarmCm: chainLen(low), totalCm: chainLen(up) + chainLen(low), notch: chainAt(up, notch).pt }; };
    var rgB = { body: segs(bodyUpB, bodyLowB, nB), sleeve: segs(slvUpB, slvLowB, nB) }, rgF = { body: segs(bodyUpF, bodyLowF, nF), sleeve: segs(slvUpF, slvLowF, nF) };
    var centerB = chainLen(topB), centerF = chainLen(topF), cuffLB = chainLen(cuffB), cuffLF = chainLen(cuffF), uaB = dist(CB, uB.Ustar), uaF = dist(CF, uF.Ustar);
    var lowGap = function (low, arm) { var ap = flatChain(arm, 200), m = 0; flatChain(low, 120).forEach(function (q) { m = Math.max(m, nearestOn(ap, q)); }); return m; };   // 몸판 ★ → 진동 아랫점 vs 원래 진동선(파임)
    // 봉제 상태 연결각(°): 목(몸판 목 끝 내부각 + 소매 목 끝 내부각 − 180 = 0 이면 목선이 이어짐) · 겨드랑이(몸판 + 소매 = 180) · 소맷부리(뒤 C + 앞 C = 180) · 목 SNP(뒤 + 앞)
    var endTan = function (cs, atEnd) { var q = atEnd ? cs[cs.length - 1] : cs[0]; return unit(atEnd ? mul(cubicD1(q, 1), -1) : cubicD1(q, 0)); };
    var neckJoin = function (neckBody, bodyUp, neckSl, slvUp) { var a = deg(Math.abs(angOf(endTan(neckBody, true), endTan(bodyUp, false)))), c = deg(Math.abs(angOf(endTan(neckSl, false), endTan(slvUp, false)))); return { bodyDeg: a, sleeveDeg: c, kinkDeg: a + c - 180 }; };
    var cuffAt = function (cuff, C, Us) { var q = cuff[cuff.length - 1]; return cornerDeg(q[2], C, Us); };
    var snpAt = function (neck, top, at) { return cornerDeg(neck[neck.length - 1][2], at, top[0][1]); };
    var spCorner = function (pts) { return 180 - cornerDeg(pts[0], pts[1], pts[2]); };
    var shoulderGap = dist(L1r, bb.L2);

    var dl = function (side, b, s, F, u, up, low, neck, top, cuff, Cc) {   // 몸판 좌표 제도 레이어(표시 전용)
      var G = add(F.E, mul(F.n, side === "back" ? p.backUnderarmWidthCm : p.frontUnderarmWidthCm));
      return { armhole: pathOf(b.arm), guide: L(s.N, s.M), innerToBL: L(s.inner, { x: s.inner.x, y: b.BLY }), bodySeam: pathOf(s.path),
        shoulderExt: L(b.SP, F.K), slopeDrop: L(F.K, F.A), center: L(b.SP, F.E), width: L(F.W0, u.Ustar), underarmGuide: L(u.Ustar, G), cuffLine: L(F.E, G),
        sleeveRaglan: pathOf(up.concat(low)), sleeveNeck: pathOf(neck), sleeveTop: pathOf(top), sleeveCuff: pathOf(cuff), sleeveUnderarm: L(Cc, u.Ustar),
        N: cp(s.N), M: cp(s.M), inner: cp(s.inner), BL: { x: s.inner.x, y: b.BLY }, J: cp(s.J), SP: cp(b.SP), K: cp(F.K), A: cp(F.A), W0: cp(F.W0), E: cp(F.E), U: cp(b.U),
        Ustar: cp(u.Ustar), C: cp(Cc), G: G, star: cp(u.star) };
    };
    var out = {
      ok: true,
      geometry: { outline: outline, construction: construction, pieces: ["back", "front"], centerSeam: true, layoutGapCm: PIECE_GAP_CM },
      derivedBodice: derivedBodice,
      meta: {
        rule: "pattern-school-p52-raglan-sleeve-V(2026-11-01 confirmed draft)",
        settings: { inputs: clone(p), defaults: clone(DEFAULTS), book: Object.keys(BOOK), draftChoices: Object.keys(DRAFT),
          constants: { fairHandle: FAIR_HANDLE, cuffHandle: CUFF_HANDLE, pieceGapCm: PIECE_GAP_CM } },
        gate: g,
        sleeveLengthCm: p.sleeveLengthCm,
        capHeight: { averageShoulderCm: avg, ratio: p.capHeightRatio, cm: capH, shoulderHeightsCm: { back: rb.back.heightCm, front: rb.front.heightCm },
          note: "P.137 1·2: 다트를 닫은 봉제 상태의 SP → 진동 아랫점 수직 거리 평균 × 3/4 — 소매 폭선 = SP 에서 중심선을 따라 ◉" },
        widthCm: { back: p.backUnderarmWidthCm, front: p.frontUnderarmWidthCm, total: p.backUnderarmWidthCm + p.frontUnderarmWidthCm },
        raglan: {
          back: { body: rgB.body, sleeve: rgB.sleeve, diffCm: rgB.sleeve.totalCm - rgB.body.totalCm, notchFromNeckCm: nB, notchRule: "목에서 |N Ap|(닫는 축 Ap 와 같은 거리 — 축 자체 아님)" },
          front: { body: rgF.body, sleeve: rgF.sleeve, diffCm: rgF.sleeve.totalCm - rgF.body.totalCm, notchFromNeckCm: nF, notchRule: "목 ~ ★ 의 가운데" },
          note: "소매 달림선(몸판 ↔ 소매) — 같은 치수(P.143 «소매 달림 치수가 같도록»)"
        },
        seams: {
          center: { back: centerB, front: centerF, diffCm: centerB - centerF, note: "중심 솔기(목옆점 → 어깨 → SP → 소맷부리) — 뒤 − 앞 차는 이 시안의 결과로 기록만 한다(보정·허용오차 없음)" },
          underarm: { back: uaB, front: uaF, diffCm: uaB - uaF, note: "소매 밑선(앞·뒤를 맞대 박는 솔기)" },
          cuff: { back: cuffLB, front: cuffLF, totalCm: cuffLB + cuffLF, straight: { back: p.backUnderarmWidthCm - cut, front: p.frontUnderarmWidthCm - cut } }
        },
        cuff: { ratio: p.cuffRatio, cutCm: cut, back: p.backUnderarmWidthCm - cut, front: p.frontUnderarmWidthCm - cut,
          note: "뒤 소맷부리 = 뒤 소매 폭 × 3/4 · ● = 잘라 낸 분량 · 앞 = 앞 소매 폭 − ●(뒤와 같은 분량) · 모서리는 밑선과 직각으로 다듬음" },
        backDart: { tip: cp(bb.T), apex: cp(Ap), angleDeg: deg(Math.abs(closeA)), sApCm: sAp, legGapCm: shoulderGap, Dm: cp(Dm), L1: cp(bb.L1), L2: cp(bb.L2), L1r: cp(L1r), SNP: cp(bb.SNP), SNPr: cp(SNPr),
          shoulderOrigCm: dist(SNPr, L1r) + dist(bb.L2, bb.SP), shoulderTrueCm: dist(SNPr, Dm) + dist(Dm, bb.SP),
          note: "다트 끝 T → Ap(이등분선 ∩ 래글런 안내선) · 소매 쪽 목 조각을 Ap 축으로 돌려 닫음 · 닫은 다리 끝 L1′·L2 의 되돌아감은 가운데 점 Dm 으로 정리 · 몸판 쪽 다트 꼬리는 메움" },
        release: { Q: cp(Q), sQCm: sQ, beyondApCm: p.releaseBeyondApCm, handleRatio: rr, lengthCm: chainLen([relQ]), targetCm: relTarget, notchOffApCm: dist(rgB.sleeve.notch, Ap),
          note: "닫은 직후 꺾임(N′ → Ap → 안내선)을 Ap 강제 통과 없이 푼 곡선 · 길이 = 원래 경로" },
        frontDart: { moved: "side", apex: cp(mf.BP), angleDeg: mf.sideDart.angleDeg, sideDropCm: p.sideDartDropCm, legs: mf.sideDart.legs.map(cp), widthCm: mf.sideDart.widthCm,
          underarmBefore: cp(mf.U0), underarmAfter: cp(mf.U1), note: "앞 AH 다트를 닫아 옆(진동 아랫점 아래 3 — P.142 «치수는 적당하게»)으로 이동 · Ⓣ 와 같은 연산" },
        star: { back: { aboveMCm: p.backStarAboveMCm, sCm: starB, pt: cp(uB.star) }, front: { aboveMCm: p.frontStarAboveMCm, sCm: starF, pt: cp(uF.star) } },
        under: { back: { widthCm: p.backUnderarmWidthCm, handleRatio: p.backUnderHandleRatio, handleScale: uB.handleScale, bodyAngDeg: uB.bodyAngDeg, sleeveAngDeg: uB.sleeveAngDeg },
          front: { widthCm: p.frontUnderarmWidthCm, handleRatio: p.frontUnderHandleRatio, handleScale: uF.handleScale, bodyAngDeg: uF.bodyAngDeg, sleeveAngDeg: uF.sleeveAngDeg } },
        lower: { back: { joinAboveUCm: sB.joinAboveUCm, handleRatio: p.lowerHandleRatio, armholeDigFromStarCm: lowGap(bodyLowB, bb.arm), armholeDigBelowMCm: lowGap(sB.lower, bb.arm) },
          front: { joinAboveUCm: sF.joinAboveUCm, handleRatio: p.lowerHandleRatio, armholeDigFromStarCm: lowGap(bodyLowF, bf.arm), armholeDigBelowMCm: lowGap(sF.lower, bf.arm) },
          note: "몸판 달림선과 원래 진동선(앞 = AH 다트를 옮긴 진동)의 최대 거리(파임) — ★ → 진동 아랫점(최대는 ★ 에서) / M → 진동 아랫점 두 구간을 따로 잰다" },
        neck: { back: { body: chainLen(sB.neckBody), sleeve: chainLen(neckSlvB), original: sB.neckLen }, front: { body: chainLen(sF.neckBody), sleeve: chainLen(sF.neckSleeve), original: sF.neckLen },
          note: "목둘레 = 몸판 목(중심 ~ N) + 소매 목(N ~ SNP). 뒤 소매 목은 Ap 축 회전(길이 불변)" },
        joints: {
          neck: { back: neckJoin(sB.neckBody, bodyUpB, neckSlvB, [relQ]), front: neckJoin(sF.neckBody, bodyUpF, sF.neckSleeve, slvUpF) },
          underarm: { back: uB.bodyAngDeg + uB.sleeveAngDeg, front: uF.bodyAngDeg + uF.sleeveAngDeg },
          cuffJoinDeg: cuffAt(cuffB, CB, uB.Ustar) + cuffAt(cuffF, CF, uF.Ustar),
          neckSNPDeg: snpAt(neckSlvB, topB, SNPr) + snpAt(sF.neckSleeve, topF, bf.SNP),
          spCornerBeforeDeg: { back: spCorner([bb.L2, bb.SP, FB.E]), front: spCorner([bf.SNP, bf.SP, FF.E]) },
          backShoulderKinkBeforeDeg: deg(angOf(sub(L1r, SNPr), sub(bb.SP, bb.L2))),
          note: "봉제 상태 연결각 — 목 꺾임 0 · 겨드랑이 180 · 소맷부리 180 이면 이어짐(실측 기록)"
        },
        fairing: { shoulderCm: p.shoulderFairCm, spCm: p.spFairCm, cuffCm: p.cuffFairCm, handle: FAIR_HANDLE, cuffHandle: CUFF_HANDLE,
          before: { centerBackCm: dist(SNPr, L1r) + dist(L1r, bb.L2) + dist(bb.L2, bb.SP) + dist(bb.SP, FB.E), centerBackTrueCm: dist(SNPr, Dm) + dist(Dm, bb.SP) + dist(bb.SP, FB.E), centerFrontCm: dist(bf.SNP, bf.SP) + dist(bf.SP, FF.E),
            cuffBackCm: dist(FB.E, CB), cuffFrontCm: dist(FF.E, CF) } },
        notches: { back: { neckCm: nB, mark: "‖" }, front: { neckCm: nF, mark: "|" }, note: "맞춤 ① = 목에서 같은 호 길이(몸판·소매) · ★ = 몸판/소매 곡선이 갈리는 점" },
        draftLayer: { back: dl("back", bb, sB, FB, uB, slvUpB, slvLowB, neckSlvB, topB, cuffB, CB), front: dl("front", bf, sF, FF, uF, slvUpF, slvLowF, sF.neckSleeve, topF, cuffF, CF),
          backDart: { T: cp(bb.T), Ap: cp(Ap), L1: cp(bb.L1), L2: cp(bb.L2), L1r: cp(L1r), SNPr: cp(SNPr), Nr: cp(Nr), Q: cp(Q), Dm: cp(Dm), oldLegs: [L(bb.L1, bb.T), L(bb.T, bb.L2)], cornerBefore: [L(Nr, Ap), L(Ap, Q)] },
          frontDart: { BP: cp(mf.BP), legs: [cp(mf.S3r), cp(mf.S3)], oldLegs: [cp(mf.upperMouth), cp(mf.lowerMouth)], oldUnderarm: cp(mf.U0) },
          notches: { back: { body: cp(rgB.body.notch), sleeve: cp(rgB.sleeve.notch) }, front: { body: cp(rgF.body.notch), sleeve: cp(rgF.sleeve.notch) } } },
        sleevePoints: {   // 소매 좌표(두 장) 주요 점 — 설명 배치용
          back: { SP: Tb(bb.SP), E: Tb(FB.E), C: Tb(CB), U: Tb(uB.Ustar), star: Tb(uB.star), notch: Tb(rgB.sleeve.notch), neck: Tb(Nr), SNP: Tb(SNPr), W0: Tb(FB.W0), Dm: Tb(Dm) },
          front: { SP: Tf(bf.SP), E: Tf(FF.E), C: Tf(CF), U: Tf(uF.Ustar), star: Tf(uF.star), notch: Tf(rgF.sleeve.notch), neck: Tf(sF.N), SNP: Tf(bf.SNP), W0: Tf(FF.W0) } },
        unconfirmed: ["이 시안의 선택(★ 위치 · 아랫점 폭 · 핸들 비 · 해제 곡선 · 몸판 아래 곡선 합류 · 다듬기 폭)은 B83 · 소매길이 54 에서 김님이 확정한 설정값 — 다른 치수에서의 기본값 타당성은 미검토",
          "중심 솔기 뒤 − 앞 차(B83 0.016cm)는 기록만 — 보정하지 않는다", "카라 단계는 bodiceResult 목둘레를 그대로 쓴다(래글런 목 분할·뒤 소매 목 회전 미반영 — 목둘레 길이는 같음)"],
        checks: { closed: true, connected: true, maxGapCm: Math.max(dB.gapCm, dF.gapCm, lsB.gapCm, lsF.gapCm), selfIntersection: false, bodiceSelfIntersection: false, pieces: 2, centerSeam: true }
      },
      warnings: [],
      sourceBodiceHash: bodice.hash || null
    };
    return out;
  }

  window.designSleeveV = Object.freeze({ draftSleeveV: draftSleeveV, KEYS: KEYS,
    RULES: Object.freeze({ defaults: DEFAULTS, book: BOOK, draft: DRAFT, bodicePresetId: "bunka-bodice-A", pieceGapCm: PIECE_GAP_CM }) });
})();
