// ══════════════════════════════════════════════
// designSleeveY.js — 소매 Ⓨ 프렌치 슬리브([패턴학교] P.55 위 «몸판에서 이어진 소매를 제도한다(소매길이 5cm)»). 순수 · 시안(2026-11-04 김님 승인 «맞아 진행시켜»).
//
// ★ 출발 = 완료 몸판 Ⓐ(P.55 서두 «아래 예는 몸판 Ⓐ(P.14)를 사용한다») — Ⓡ·Ⓣ·Ⓥ·Ⓧ 와 같은 형상 게이트(designSleeveR.gateBodiceA)를 재사용한다.
//   결과 = **몸판 일체형 뒤·앞(파생 몸판 — 소매 포함)만**. 별도 소매 조각·덧천이 없다 → 소매 geometry 는 빈 버킷(가짜 형상 없음 · sleevePiece:false),
//   소매산·AH 길이·이세는 만들지 않는다(적용 안 됨). bodiceResult 는 읽기만 한다.
//
// 책(F) — P.55 서두·Ⓨ 본문·도해:
//   서두 «앞 AH 다트를 닫아 제도에 지장이 없는 위치로 이동한다» · Ⓨ «아래 예는 앞 AH 다트를 옆으로 이동한 것» → 새 곡선이 지우는 진동 위쪽에 AH 다트 입구가 있어서다.
//     연산은 Ⓣ/Ⓥ 와 같은 «AH 다트 → 옆»(designSleeveT.parts.moveFrontDart 읽기 전용 재사용 · 옆선 위 위치 = P.140 «치수는 적당하게» 3).
//   «몸판의 어깨선을 연장해 어깨 끝을 조금만 떨어뜨려 거기부터 직각으로, 그다음 완만한 곡선으로 원래의 진동 둘레에 연결한다»(도해: 5 · 0.5 · 직각 표시).
//     ① SP 에서 어깨선(SP 쪽 어깨 조각) 방향으로 소매길이 5 → K.  ② K 에서 연장선에 직각으로 0.5 내린 점 → E(김님 확정: 연장선 직각).
//     ③ 새 어깨선 = SP–E 직선(SP 에서 방향이 약 5.7° 바뀐다 — 어깨 전체를 다시 그리지 않는다).  ④ E 에서 새 어깨선에 직각으로 출발해
//     완만한 곡선으로 원래 진동에 접선 합류(J). J 아래 겨드랑이 곡선·옆선은 원래 그대로. 뒤 어깨 다트는 도해대로 열린 채(연장은 SP 쪽 조각을 그대로 잇는다).
//
// 책 수치 = 설정값(수정 가능): 소매길이(어깨 연장) 5 · 끝 내림 0.5.
// 구현 관례(책에 수치 없음 · 설정값 · 수정 가능):
//   · 옆 다트 위치 = 진동 아랫점에서 옆선 따라 3(P.140 «적당하게» — Ⓣ/Ⓥ 와 같은 값).
//   · 합류점 J = 원래 진동 아랫점에서 진동을 따라 호 3(승인 시안값). 겨드랑이 이등분점(원형 cubic 이음점)은 원래 곡선이 거기서 5.4° 꺾여
//     접선 합류하면 원래 종이 안으로 파고든다 → 그보다 아래. 도해는 겨드랑이 아래쪽 합류만 보여 준다(수치 없음).
//   · 곡선 = 3차 베지어 한 개(E 접선 = 새 어깨선 직각 · J 접선 = 남는 진동 접선). 손잡이 길이(현 길이 × 0.05~0.90, 0.01 간격) =
//     최대 곡률이 가장 작은 것 — 단, 새 곡선이 원래 종이 안으로 들어가지 않는 것만(«완만한 곡선» · 종이는 덧붙이기만 한다).
//     (2026-11-04 승인 scratch 와 같은 계산 — 표본 수·순서까지 같게 옮겨 승인 형상을 재현한다.)
// 좌표: 몸판 좌표(y 아래 +). 길이는 점열 실측(cubic 2000 분할).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var BOOK = Object.freeze({ sleeveLengthCm: 5, dropCm: 0.5 });
  var CONVENTION = Object.freeze({ sideDartDropCm: 3, joinFromBottomCm: 3 });
  var DEFAULTS = Object.freeze(Object.assign({}, BOOK, CONVENTION));
  var KEYS = ["sleeveLengthCm", "dropCm", "sideDartDropCm", "joinFromBottomCm"];
  var GAP_TOL = 1e-3, TOUCH_TOL = 1e-3;   // GAP_TOL = 원형 데이터 잔차 허용(뒤 진동 끝점 ↔ 옆선 위 끝 ~3.6e-4 — Ⓧ 의 SAME 과 같은 값 · 원형은 고치지 않는다)

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cr(a, b) { return a.x * b.y - a.y * b.x; }
  function D(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function unit(a) { var l = Math.hypot(a.x, a.y); return l > 1e-12 ? { x: a.x / l, y: a.y / l } : null; }
  function deg(r) { return r * 180 / Math.PI; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }

  // ── cubic 도구 ──
  function cub(q, t) { var u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; }
  function d1(q, t) { var u = 1 - t; return { x: 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x)), y: 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y)) }; }
  function d2(q, t) { return { x: 6 * ((1 - t) * (q[2].x - 2 * q[1].x + q[0].x) + t * (q[3].x - 2 * q[2].x + q[1].x)), y: 6 * ((1 - t) * (q[2].y - 2 * q[1].y + q[0].y) + t * (q[3].y - 2 * q[2].y + q[1].y)) }; }
  function poly(q, n) { n = n || 2000; var a = []; for (var k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; }
  function plen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; }
  function qlen(q) { return plen(poly(q)); }
  function chainLen(c) { return c.reduce(function (s, q) { return s + qlen(q); }, 0); }
  function cubsOf(s) {
    if (s.kind === "line") return [[s.from, s.from, s.to, s.to]];
    var o = [], cur = null; s.commands.forEach(function (c) { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o;
  }
  function splitAt(q, t) {
    var l = function (a, b) { return add(a, mul(sub(b, a), t)); };
    var a = l(q[0], q[1]), b = l(q[1], q[2]), c = l(q[2], q[3]), d = l(a, b), e = l(b, c), f = l(d, e);
    return [[q[0], a, d, f], [f, e, c, q[3]]];
  }
  // chain SP→U 를 «U 에서 잰 호 길이» 위치에서 둘로 — 승인 scratch 와 같은 4000 분할 점열 탐색(t 는 1/4000 격자)
  function chainSplitFromBottom(chain, sFromBottom) {
    var L = chain.map(qlen), tot = L.reduce(function (a, b) { return a + b; }, 0), s = tot - sFromBottom, acc = 0;
    for (var i = 0; i < chain.length; i++) {
      if (s <= acc + L[i] + 1e-12) {
        var pl = poly(chain[i], 4000), a2 = 0, k = 0;
        for (; k < pl.length - 1 && a2 + D(pl[k], pl[k + 1]) < s - acc; k++) a2 += D(pl[k], pl[k + 1]);
        var sp = splitAt(chain[i], k / 4000);
        return { above: chain.slice(0, i).concat([sp[0]]), below: [sp[1]].concat(chain.slice(i + 1)) };
      }
      acc += L[i];
    }
    return null;
  }
  // 최대 곡률(1/cm) — d1/d2 와 같은 식·같은 연산 순서를 할당 없이 계산(값 동일). cap 이 있으면 곡률이 cap 이상이 되는 순간 멈춘다
  //   (호출부는 «cap 보다 작은가»만 보므로 판정이 같다).
  //   표본 401 개를 거친 간격부터 훑는다(최댓값은 순서와 무관 — 나쁜 후보를 빨리 멈추게 할 뿐).
  var BEND_N = 400, BEND_ORDER = (function () { var seen = {}, o = []; [100, 20, 5, 1].forEach(function (s) { for (var k = 0; k <= BEND_N; k += s) if (!seen[k]) { seen[k] = 1; o.push(k); } }); return o; })();
  function bend(q, cap) {
    var mx = 0, n = BEND_N;
    var ax = q[1].x - q[0].x, bx = q[2].x - q[1].x, cx = q[3].x - q[2].x, ay = q[1].y - q[0].y, by = q[2].y - q[1].y, cy = q[3].y - q[2].y;
    var s0x = q[2].x - 2 * q[1].x + q[0].x, s1x = q[3].x - 2 * q[2].x + q[1].x, s0y = q[2].y - 2 * q[1].y + q[0].y, s1y = q[3].y - 2 * q[2].y + q[1].y;
    for (var ii = 0; ii < BEND_ORDER.length; ii++) {
      var t = BEND_ORDER[ii] / n, u = 1 - t;
      var vx = 3 * (u * u * ax + 2 * u * t * bx + t * t * cx), vy = 3 * (u * u * ay + 2 * u * t * by + t * t * cy);
      var wx = 6 * ((1 - t) * s0x + t * s1x), wy = 6 * ((1 - t) * s0y + t * s1y);
      var sp = Math.hypot(vx, vy), kap = Math.abs(vx * wy - vy * wx) / (sp * sp * sp);
      if (kap > mx) { mx = kap; if (cap !== undefined && !(mx < cap)) return mx; }
    }
    return mx;
  }
  function inPoly(p, L) { var c = false; for (var i = 0, j = L.length - 1; i < L.length; j = i++) { var a = L[i], b = L[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; }
  // 같은 판정(inPoly 와 같은 변·같은 식 — 결과 동일)을 y 띠로 미리 거른 변만 보고 한다(속도용). 띠에는 y 범위가 그 띠와 겹치는 변이 전부 들어 있다.
  function polyIndex(L) {
    var y0 = Infinity, y1 = -Infinity; L.forEach(function (q) { if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; });
    var h = 0.25, n = Math.max(1, Math.ceil((y1 - y0) / h) + 1), rows = []; for (var r = 0; r < n; r++) rows.push([]);
    for (var i = 0, j = L.length - 1; i < L.length; j = i++) {
      var lo = Math.min(L[i].y, L[j].y), hi = Math.max(L[i].y, L[j].y);
      for (var k = Math.max(0, Math.floor((lo - y0) / h)); k <= Math.min(n - 1, Math.floor((hi - y0) / h)); k++) rows[k].push(i, j);
    }
    return { L: L, y0: y0, y1: y1, h: h, rows: rows };
  }
  function inPolyIdx(p, X) {
    if (!(p.y >= X.y0 && p.y <= X.y1)) return false;
    var row = X.rows[Math.floor((p.y - X.y0) / X.h)], L = X.L, c = false;
    for (var e = 0; e < row.length; e += 2) { var a = L[row[e]], b = L[row[e + 1]]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; }
    return c;
  }
  function segX(a, b, c, d) {
    var o = function (p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); };
    var e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d), k = 1e-10;
    return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k));
  }
  function selfX(L) { var n = L.length; for (var i = 0; i < n; i++) for (var j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[(i + 1) % n], L[j], L[(j + 1) % n])) return true; } return false; }
  function areaOf(L) { var s = 0; for (var i = 0; i < L.length; i++) { var a = L[i], b = L[(i + 1) % L.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; }
  function segPts(s, n) { var o = []; cubsOf(s).forEach(function (q, i) { o = o.concat(poly(q, n || 60).slice(i ? 1 : 0)); }); return o; }
  function loopOf(segs) {   // 끝점으로 이어 닫힌 점열(방향 자동) + 최대 틈 — 승인 scratch 와 같은 탐욕 연결
    var rest = segs.map(function (s) { return segPts(s); }), out = rest.shift().slice(), gap = 0;
    while (rest.length) {
      var end = out[out.length - 1], bi = -1, bd = Infinity, br = false;
      rest.forEach(function (p, i) { var a = D(end, p[0]), b = D(end, p[p.length - 1]); if (a < bd) { bd = a; bi = i; br = false; } if (b < bd) { bd = b; bi = i; br = true; } });
      var p = rest.splice(bi, 1)[0]; if (br) p = p.slice().reverse();
      gap = Math.max(gap, bd); out.push.apply(out, p.slice(1));
    }
    return { loop: out, gap: Math.max(gap, D(out[0], out[out.length - 1])) };
  }
  function Lseg(a, b, role, extra) { var s = { kind: "line", from: cp(a), to: cp(b), role: role }; if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; }); return s; }
  function Pseg(qs, role, extra) {
    var s = { kind: "path", role: role, commands: [{ type: "M", points: [cp(qs[0][0])] }].concat(qs.map(function (q) { return { type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }; })) };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; }); return s;
  }
  function withRole(s, role) { var c = clone(s); c.role = role; return c; }
  function roleOf(s) {
    if (s.dart) return s.dart.boundary === "side-seam" ? "side-dart" : "dart";
    var r = s.boundary && s.boundary.root || "";
    if (/side-seam/.test(r) || s.edge === "side-seam") return "side-seam";
    if (s.edge === "shoulder") return "shoulder";
    return s.edge || "outline";
  }

  // ── 한 쪽: 어깨 연장 → 내림 → 직각 → 곡선 합류 ──
  function draftHalf(piece, chain, shoulderFrom, p, origLoop) {
    var SP = chain[0][0], us = unit(sub(SP, shoulderFrom)); if (!us) return fail("bodice-read-failed", { piece: piece, why: "shoulder" });
    var nsh = { x: -us.y, y: us.x }; if (nsh.y < 0) nsh = mul(nsh, -1);   // 연장선 직각 · 아래(몸 쪽)
    var K = add(SP, mul(us, p.sleeveLengthCm)), E = add(K, mul(nsh, p.dropCm));
    var ue = unit(sub(E, SP)), t0 = { x: -ue.y, y: ue.x }; if (t0.y < 0) t0 = mul(t0, -1);   // 새 어깨선 직각 · 아래로
    if (!(t0.y > 1e-6)) return fail("right-angle-not-downward", { piece: piece });
    var total = chainLen(chain);
    if (!(p.joinFromBottomCm > 0 && p.joinFromBottomCm < total - 0.5)) return fail("join-out-of-range", { piece: piece, maxCm: total - 0.5 });
    var sp = chainSplitFromBottom(chain, p.joinFromBottomCm); if (!sp) return fail("join-out-of-range", { piece: piece });
    var J = sp.below[0][0], tJ = unit(sub(sp.below[0][1], sp.below[0][0])); if (!tJ) return fail("join-tangent-degenerate", { piece: piece });
    var chord = D(E, J), best = null, X = polyIndex(origLoop);
    for (var a = 0.05; a <= 0.9001; a += 0.01) for (var b = 0.05; b <= 0.9001; b += 0.01) {
      var q = [E, add(E, mul(t0, a * chord)), sub(J, mul(tJ, b * chord)), J], score = bend(q, best ? best.score : undefined);
      if (best && !(score < best.score)) continue;   // 더 나아질 수 없는 후보는 침범 검사 생략(순차 최소 — 결과 같음)
      var pts = poly(q, 200).slice(1, -1), inside = false;
      for (var k = 0; k < pts.length && !inside; k++) if (inPolyIdx(pts[k], X) && D(pts[k], J) > TOUCH_TOL) inside = true;
      if (inside) continue;
      best = { a: a, b: b, q: q, score: score };
    }
    if (!best) return fail("join-curve-infeasible", { piece: piece });
    var kink = function (u, v) { return deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(u), unit(v)))))); };
    return { ok: true, piece: piece, SP: cp(SP), K: K, E: E, J: cp(J), us: us, ue: ue, t0: t0, tJ: tJ, curve: best.q, handles: { a: best.a, b: best.b }, maxCurvature: best.score,
      above: sp.above, below: sp.below, chainLenCm: total,
      angleAtEDeg: deg(Math.acos(Math.max(-1, Math.min(1, dot(ue, unit(d1(best.q, 0))))))), kinkAtJDeg: kink(d1(best.q, 1), d1(sp.below[0], 0)),
      spTurnDeg: kink(sub(SP, shoulderFrom), sub(E, SP)) };
  }

  function draftSleeveY(bodice, aGeometry, params) {
    var SR = window.designSleeveR, ST = window.designSleeveT;
    if (!SR || !SR.gateBodiceA || !ST || !ST.parts || !ST.parts.moveFrontDart) return fail("no-module");
    var p = {}, bad = [];
    KEYS.forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (!(p.sleeveLengthCm > 0)) return fail("input-out-of-range", { key: "sleeveLengthCm", rule: "소매길이(어깨 연장) > 0" });
    if (!(p.dropCm >= 0)) return fail("input-out-of-range", { key: "dropCm", rule: "끝 내림 ≥ 0(음수 = 올림 — «떨어뜨려»와 반대)" });
    if (!(p.sideDartDropCm > 0)) return fail("input-out-of-range", { key: "sideDartDropCm", rule: "옆 다트 위치 > 0" });
    if (!(p.joinFromBottomCm > 0)) return fail("input-out-of-range", { key: "joinFromBottomCm", rule: "합류점(진동 아랫점에서 호) > 0" });
    var g = SR.gateBodiceA(bodice, aGeometry); if (!g.ok) return g;

    // 뒤: 진동 체인 SP→U · SP 쪽 어깨 조각 · 열린 어깨 다트 다리(제도선에 있음 → 외곽에 넣어 닫힌 조각으로)
    var B = bodice.back, bArm = B.outline.filter(function (s) { return s.edge === "armhole"; });
    var bShA = B.outline.filter(function (s) { return s.boundary && s.boundary.root === "back/shoulder-armhole"; });
    var bDart = (B.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "shoulder"; });
    if (bArm.length !== 1 || bShA.length !== 1 || bDart.length !== 2) return fail("bodice-read-failed", { piece: "back" });
    var bChain = cubsOf(bArm[0]);
    if (D(bChain[0][0], bShA[0].from) > 1e-6 && D(bChain[0][0], bShA[0].to) > 1e-6) return fail("bodice-read-failed", { piece: "back", why: "sp" });
    var bShFrom = D(bShA[0].from, bChain[0][0]) < 1e-6 ? bShA[0].to : bShA[0].from;
    var bDartSegs = bDart.map(function (s) { return withRole(s, "shoulder-dart"); });
    var bOrig = loopOf(B.outline.concat(bDartSegs));
    var hb = draftHalf("back", bChain, bShFrom, p, bOrig.loop); if (!hb.ok) return hb;

    // 앞: AH 다트 → 옆(Ⓣ/Ⓥ 와 같은 연산 — 읽기 전용 재사용)
    var mf = ST.parts.moveFrontDart(bodice.front, { sideDartDropCm: p.sideDartDropCm }); if (!mf.ok) return mf;
    var fSh = bodice.front.outline.filter(function (s) { return s.edge === "shoulder"; });
    if (fSh.length !== 1) return fail("bodice-read-failed", { piece: "front" });
    var fShFrom = D(fSh[0].from, mf.SP) < 1e-6 ? fSh[0].to : fSh[0].from;
    var fOrig = loopOf(mf.outline);
    var hf = draftHalf("front", mf.chain, fShFrom, p, fOrig.loop); if (!hf.ok) return hf;

    // 새 외곽(재단선): 원래 외곽 − 진동 + 어깨 연장 + 새 팔구멍 곡선 + 남긴 진동
    var tail = function (h) { return [Lseg(h.SP, h.E, "shoulder-ext", { edge: "shoulder" }), Pseg([h.curve], "sleeve-opening", { edge: "armhole" }), Pseg(h.below, "armhole-kept", { edge: "armhole" })]; };
    var bSegs = B.outline.filter(function (s) { return s.edge !== "armhole"; }).map(function (s) { return withRole(s, roleOf(s)); }).concat(bDartSegs, tail(hb));
    var fSegs = mf.outline.filter(function (s) { return s.edge !== "armhole"; }).map(function (s) { return withRole(s, roleOf(s)); }).concat(tail(hf));
    var lpB = loopOf(bSegs), lpF = loopOf(fSegs);
    if (!(lpB.gap < GAP_TOL && lpF.gap < GAP_TOL)) return fail("discontinuous", { backGapCm: lpB.gap, frontGapCm: lpF.gap });
    if (selfX(lpB.loop) || selfX(lpF.loop)) return fail("self-intersection");

    var segLen = function (s) { return cubsOf(s).reduce(function (a, q) { return a + qlen(q); }, 0); };
    var roleLen = function (segs, role) { return segs.filter(function (s) { return s.role === role; }).reduce(function (a, s) { return a + segLen(s); }, 0); };
    var seams = {
      shoulder: { back: roleLen(bSegs, "shoulder") + roleLen(bSegs, "shoulder-ext"), front: roleLen(fSegs, "shoulder") + roleLen(fSegs, "shoulder-ext") },
      shoulderExt: { back: roleLen(bSegs, "shoulder-ext"), front: roleLen(fSegs, "shoulder-ext") },
      sideSeam: { back: roleLen(bSegs, "side-seam"), front: roleLen(fSegs, "side-seam") },   // 앞 = 옆 다트 닫은 봉제 길이(다리 제외 위·아래 + 연장)
      opening: { back: roleLen(bSegs, "sleeve-opening") + roleLen(bSegs, "armhole-kept"), front: roleLen(fSegs, "sleeve-opening") + roleLen(fSegs, "armhole-kept") },
      newCurve: { back: roleLen(bSegs, "sleeve-opening"), front: roleLen(fSegs, "sleeve-opening") },
      kept: { back: roleLen(bSegs, "armhole-kept"), front: roleLen(fSegs, "armhole-kept") },
      shoulderDartLegs: bDartSegs.map(segLen), sideDartLegs: fSegs.filter(function (s) { return s.role === "side-dart"; }).map(segLen)
    };
    seams.opening.total = seams.opening.back + seams.opening.front;
    var armOrig = { back: chainLen(bChain), front: chainLen(mf.chain) };
    var fDartOld = (bodice.front.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "armhole"; });
    var draftLayer = function (h, orig) {
      var tick = 0.6, r1 = add(h.E, mul(h.ue, -tick)), r2 = add(h.E, mul(h.t0, tick));
      return { guide: Lseg(h.SP, h.K, "guide-extension"), drop: Lseg(h.K, h.E, "guide-drop"),
        rightAngle: [Lseg(r1, add(r1, mul(h.t0, tick)), "right-angle"), Lseg(add(r1, mul(h.t0, tick)), r2, "right-angle")],
        armhole: Pseg(orig, "armhole-original") };
    };
    var dlB = draftLayer(hb, bChain), dlF = draftLayer(hf, mf.chain);
    dlF.oldDart = fDartOld.map(function (s) { return Lseg(s.from, s.to, "ah-dart-original"); });
    var halfMeta = function (h) {
      return { SP: cp(h.SP), K: cp(h.K), E: cp(h.E), J: cp(h.J), U: cp(h.below[h.below.length - 1][3]), handles: [cp(h.curve[1]), cp(h.curve[2])], handleRatio: [h.handles.a, h.handles.b],
        angleAtEDeg: h.angleAtEDeg, kinkAtJDeg: h.kinkAtJDeg, spTurnDeg: h.spTurnDeg, maxCurvature: h.maxCurvature, removedArmholeCm: chainLen(h.above) };
    };
    var m = {
      rule: "pattern-school-p55-french-sleeve-Y(2026-11-04 approved draft)", sleeveLengthCm: p.sleeveLengthCm,
      settings: { inputs: clone(p), defaults: clone(DEFAULTS), book: Object.keys(BOOK), conventionChoices: Object.keys(CONVENTION),
        constants: { sleeveLengthFrom: "소매길이 = SP 에서 어깨선(SP 쪽 어깨 조각) 연장을 따라 — P.55 도해 «5»", drop: "끝 내림 = 연장선에 직각(김님 확정 2026-11-04) — 도해 «0.5»",
          rightAngle: "E 에서 새 어깨선(SP–E)에 직각 출발 — 도해 직각 표시", join: "완만한 곡선으로 원래 진동에 접선 합류 — P.55 본문(위치 수치 없음 → 구현 관례)",
          frontDart: "앞 AH 다트 → 옆(P.55 «아래 예는 앞 AH 다트를 옆으로 이동한 것») — Ⓣ/Ⓥ 와 같은 연산", backDart: "뒤 어깨 다트는 열린 채(도해)" } },
      points: { back: halfMeta(hb), front: Object.assign(halfMeta(hf), { BP: cp(mf.BP), S3: cp(mf.S3), S3r: cp(mf.S3r), upperMouth: cp(mf.upperMouth), lowerMouth: cp(mf.lowerMouth) }) },
      frontDart: { kind: "AH → 옆(P.55 · P.140)", angleDeg: mf.sideDart.angleDeg, widthCm: mf.sideDart.widthCm, mouthResidualCm: mf.mouthResidualCm, positionFromUnderarmCm: p.sideDartDropCm,
        apex: cp(mf.BP), legs: mf.sideDart.legs.map(cp), legCm: seams.sideDartLegs },
      backDart: { kind: "뒤 어깨 다트 — 열린 채(외곽 · 도해)", apex: cp(bDart[0].dart.apexAt === "from" ? bDart[0].from : bDart[0].to), legCm: seams.shoulderDartLegs },
      seams: seams,
      armhole: { backOrigCm: armOrig.back, frontOrigCm: armOrig.front, totalOrigCm: armOrig.back + armOrig.front, easeApplicable: false,
        note: "소매 달림선·별도 소매 조각이 없는 몸판 일체형 — 소매산·AH 이세는 적용 안 됨(원래 진동선은 제도 참고선)" },
      addedAreaCm2: { back: areaOf(lpB.loop) - areaOf(bOrig.loop), front: areaOf(lpF.loop) - areaOf(fOrig.loop) },
      draftLayer: { back: dlB, front: dlF },
      unconfirmed: ["합류점(진동 아랫점에서 호 3)·옆 다트 위치 3 은 책에 수치가 없는 구현 관례(설정값) — 도해는 겨드랑이 아래쪽 합류만 보여 준다",
        "곡선 손잡이 = 최대 곡률 최소(원래 종이 침범 금지) 규칙 — 앞 새 곡선은 원래 앞 AH 보다 곡률이 크다(승인 시안 그대로)",
        "소맷부리(팔구멍) 마무리(안단·바이어스)는 책에 없음 · B83 밖 치수와 3D 착용은 검증하지 않음(평면 변 길이·형상만)"],
      checks: { closed: true, connected: true, maxGapCm: Math.max(lpB.gap, lpF.gap), selfIntersection: false, curveInsideOriginal: 0, pieces: 2, sleevePiece: false,
        areasCm2: { back: areaOf(lpB.loop), front: areaOf(lpF.loop) } }
    };
    var warnings = [];
    if (p.sleeveLengthCm !== BOOK.sleeveLengthCm || p.dropCm !== BOOK.dropCm) warnings.push("책 수치(소매길이 5 · 내림 0.5) 밖 — 검토되지 않은 값(더 긴 소매는 책에서 Ⓩ 의 별도 공정)");
    // 소매 조각 없음: 렌더·배치 계약(소매 버킷 = outline/construction 배열)만 지키는 빈 버킷 — 소매 형상·길이를 만들지 않는다.
    var noSleeve = { outline: [], construction: [], pieces: [], integratedBodice: true, sleevePiece: false, centerSeam: false, butted: false };
    return { ok: true, geometry: noSleeve,
      derivedBodice: { back: { outline: bSegs, construction: [dlB.armhole] }, front: { outline: fSegs, construction: [dlF.armhole] } },
      meta: m, warnings: warnings, sourceBodiceHash: bodice.hash !== undefined ? bodice.hash : null };
  }

  window.designSleeveY = Object.freeze({ draftSleeveY: draftSleeveY, KEYS: KEYS,
    RULES: Object.freeze({ defaults: DEFAULTS, book: BOOK, convention: CONVENTION, bodicePresetId: "bunka-bodice-A" }) });
})();
