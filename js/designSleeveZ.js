// ══════════════════════════════════════════════
// designSleeveZ.js — 소매 Ⓩ 프렌치 슬리브(소매길이 12)([패턴학교] P.55 아래 «몸판에서 이어진 소매를 제도한다(소매길이 12cm)»). 순수 · 시안(2026-11-04 김님 승인 «좋아좋아 진행시켜»).
//
// ★ 출발 = 완료 몸판 Ⓐ(P.55 서두 «아래 예는 몸판 Ⓐ(P.14)를 사용한다») — Ⓡ·Ⓣ·Ⓥ·Ⓧ·Ⓨ 와 같은 형상 게이트(designSleeveR.gateBodiceA)를 재사용한다.
//   결과 = **몸판 일체형 뒤·앞(파생 몸판 — 소매 포함)만**. 별도 소매 조각·덧천이 없다 → 소매 geometry 는 빈 버킷(가짜 형상 없음 · sleevePiece:false),
//   소매산·AH 길이·이세는 만들지 않는다(적용 안 됨). bodiceResult 는 읽기만 한다. Ⓨ 엔진·결과는 건드리지 않는다(공정이 다르다 — 원래 진동에 합류하지 않는다).
//
// 책(F) — P.55 Ⓩ 본문·도해:
//   «조금 긴 프렌치 슬리브. 몸판의 어깨선을 연장해 거기부터 직각으로, 그다음 완만한 곡선으로 옆선에 연결한다.
//    소맷부리 치수를 확보하기 위해, 어깨 끝 경사는 두지 않는다. 아래 예는 앞 AH 다트를 옆으로 이동.»
//   도해: 12(SP 에서 어깨선 연장) · E 직각 표시 · 뒤 0.7 / 앞 0.3 · 2.5 · 2 · «소맷부리 끝» 화살표.
//   판독(2026-11-04 scratch · 김님 승인):
//     ① 앞 AH 다트 → 옆(Ⓣ/Ⓥ/Ⓨ 와 같은 연산 designSleeveT.parts.moveFrontDart 읽기 전용 재사용 · 옆선 위 위치 3 = 구현 관례).
//     ② SP 에서 어깨선(SP 쪽 어깨 조각) 방향으로 12 → E. 끝 내림 없음(«경사는 두지 않는다» — Ⓨ 의 0.5 와 다름).
//     ③ 가이드(현) = E → C(원래 진동 아랫점 · 앞은 다트 이동 뒤의 아랫점).
//     ④ E 에서 연장선에 **직각**으로 출발한 곡선이 가이드에서 바깥으로 최대 **뒤 0.7 / 앞 0.3** 부풀어 T 에서 가이드에 접선으로 닿는다.
//        (근거: 직각 출발 방향과 가이드의 각 = 몸판 Ⓐ B83 에서 뒤 12.55° · 앞 5.47° — 도해의 뒤가 크게 부푼 이유.)
//     ⑤ C 모서리를 둥글린다: 가이드 위 C 에서 **2.5** = T, 옆선 아래 C 에서 **2** = H(소맷부리 끝). 곡선은 H 에서 옆선에 접선.
//        → 봉제하면 겨드랑이 끝이 뾰족하게 모인다(뒤 180° + 앞 180° = 360° — 김님 승인 형상 · 사진도 같다).
//   원래 진동 전체와 옆선 위 C→H(2) 는 새 외곽 안으로 들어간다(덧붙이기만 — 원래 종이를 깎지 않는다).
//
// 책 수치 = 설정값(수정 가능): 소매길이(어깨 연장) 12 · 부풀림 뒤 0.7 / 앞 0.3 · 가이드 위 2.5 · 옆선 아래 2.
// 구현 관례(책에 수치 없음 · 설정값 · 수정 가능):
//   · 옆 다트 위치 = 진동 아랫점에서 옆선 따라 3(P.140 «적당하게» — Ⓣ/Ⓥ/Ⓨ 와 같은 값). 2 < 3 이어야 H 가 다트 위에 남는다.
//   · C 모서리 둥글림 = 2차 곡선(제어점 C) — T 접선 = 가이드, H 접선 = 옆선(자유도 없음).
//   · E→T 곡선 = 3차 베지어 한 개(E 접선 = 연장선 직각 · T 접선 = 가이드). 부풀림(책 수치)이 E 손잡이를 정하고,
//     T 손잡이(현 E–T × 0.05~0.90, 0.01 간격)는 최대 곡률이 가장 작은 것 — 원래 종이 안으로 들어가지 않는 것만.
//     (2026-11-04 승인 scratch 와 같은 계산 — 표본 수·순서까지 같게 옮겨 승인 형상을 재현한다.)
// 좌표: 몸판 좌표(y 아래 +). 길이는 점열 실측(cubic 2000 분할).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var MM = Math;   // 전역 Math 1회 조회(Node vm 샌드박스의 전역 조회가 느려 회귀가 오래 걸린다 — 같은 함수 · 같은 값)
  var BOOK = Object.freeze({ sleeveLengthCm: 12, bulgeBackCm: 0.7, bulgeFrontCm: 0.3, chordLegCm: 2.5, sideLegCm: 2 });
  var CONVENTION = Object.freeze({ sideDartDropCm: 3 });
  var DEFAULTS = Object.freeze(Object.assign({}, BOOK, CONVENTION));
  var KEYS = ["sleeveLengthCm", "bulgeBackCm", "bulgeFrontCm", "chordLegCm", "sideLegCm", "sideDartDropCm"];
  var GAP_TOL = 1e-3, TOUCH_TOL = 1e-3;   // GAP_TOL = 원형 데이터 잔차 허용(뒤 진동 끝점 ↔ 옆선 위 끝 ~3.6e-4 — Ⓧ·Ⓨ 와 같은 값 · 원형은 고치지 않는다)

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cr(a, b) { return a.x * b.y - a.y * b.x; }
  function D(a, b) { return MM.hypot(a.x - b.x, a.y - b.y); }
  function unit(a) { var l = MM.hypot(a.x, a.y); return l > 1e-12 ? { x: a.x / l, y: a.y / l } : null; }
  function deg(r) { return r * 180 / MM.PI; }
  function angDeg(u, v) { return deg(MM.acos(MM.max(-1, MM.min(1, dot(unit(u), unit(v)))))); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }

  // ── 3차 베지어 ──
  function cub(q, t) { var u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; }
  function d1(q, t) { var u = 1 - t; return { x: 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x)), y: 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y)) }; }
  function d2(q, t) { return { x: 6 * ((1 - t) * (q[2].x - 2 * q[1].x + q[0].x) + t * (q[3].x - 2 * q[2].x + q[1].x)), y: 6 * ((1 - t) * (q[2].y - 2 * q[1].y + q[0].y) + t * (q[3].y - 2 * q[2].y + q[1].y)) }; }
  function curvAt(q, t) { var a = d1(q, t), b = d2(q, t); return MM.abs(cr(a, b)) / MM.pow(MM.hypot(a.x, a.y), 3); }
  function maxCurv(q) { var m = 0; for (var k = 0; k <= 200; k++) m = MM.max(m, curvAt(q, k / 200)); return m; }
  function polyQ(q, n) { var a = []; for (var k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; }
  function plen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; }
  function qlen(q) { return plen(polyQ(q, 2000)); }
  function chainLen(c) { return c.reduce(function (s, q) { return s + qlen(q); }, 0); }
  function cubsOf(s) {
    if (s.kind === "line") return [[s.from, s.from, s.to, s.to]];
    var o = [], cur = null; s.commands.forEach(function (c) { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o;
  }
  function segPts(s, n) { var L = []; cubsOf(s).forEach(function (q, i) { L = L.concat(polyQ(q, n).slice(i ? 1 : 0)); }); return L; }
  function lineDist(p, a, b) { return cr(sub(b, a), sub(p, a)) / D(a, b); }   // 부호 있는 거리
  function quadToCub(P0, C, P2) { return [P0, add(P0, mul(sub(C, P0), 2 / 3)), add(P2, mul(sub(C, P2), 2 / 3)), P2]; }

  // ── 다각형 ──
  function loopPts(polys) {   // 끝점으로 이어 닫힌 점열(방향 자동) + 최대 틈 — 승인 scratch 와 같은 탐욕 연결
    var rest = polys.map(function (p) { return p.slice(); }), out = rest.shift(), gap = 0;
    while (rest.length) {
      var e = out[out.length - 1], bi = 0, bd = Infinity, br = false;
      rest.forEach(function (p, i) { var a = D(e, p[0]), b = D(e, p[p.length - 1]); if (a < bd) { bd = a; bi = i; br = false; } if (b < bd) { bd = b; bi = i; br = true; } });
      var p = rest.splice(bi, 1)[0]; if (br) p = p.reverse(); gap = MM.max(gap, bd); out = out.concat(p.slice(1));
    }
    return { loop: out, gap: MM.max(gap, D(out[0], out[out.length - 1])) };
  }
  function loopOf(segs) { return loopPts(segs.map(function (s) { return segPts(s, 80); })); }
  function inLoop(p, L) { var c = false; for (var i = 0, j = L.length - 1; i < L.length; j = i++) { var a = L[i], b = L[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; }
  function dseg(p, a, b) { var dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy, t = dd ? MM.max(0, MM.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / dd)) : 0; return D(p, { x: a.x + dx * t, y: a.y + dy * t }); }
  function dPoly(p, L) { var m = Infinity; for (var i = 1; i < L.length; i++) m = MM.min(m, dseg(p, L[i - 1], L[i])); return m; }
  function strictlyInside(p, L) { return inLoop(p, L) && dPoly(p, L) > TOUCH_TOL; }
  function segX(a, b, c, d) {
    var o = function (p, q, r) { return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); };
    var e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d), k = 1e-9;
    return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k));
  }
  function selfX(L) { var n = L.length; for (var i = 0; i < n; i++) for (var j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[(i + 1) % n], L[j], L[(j + 1) % n])) return true; } return false; }
  function areaOf(L) { var s = 0; for (var i = 0; i < L.length; i++) { var a = L[i], b = L[(i + 1) % L.length]; s += a.x * b.y - b.x * a.y; } return MM.abs(s) / 2; }

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

  // ── 한 쪽: 어깨 연장 12 → E 직각 → 가이드 E–C 에서 부풀림 → T(2.5) → C 둥글림 → H(2, 옆선 접선) ──
  function draftHalf(piece, chain, shoulderFrom, C, sideEnd, sideDir, bulge, p, paperLoop) {
    var SP = chain[0][0], us = unit(sub(SP, shoulderFrom)); if (!us) return fail("bodice-read-failed", { piece: piece, why: "shoulder" });
    var E = add(SP, mul(us, p.sleeveLengthCm));
    var t0 = { x: -us.y, y: us.x }; if (t0.y < 0) t0 = mul(t0, -1);   // 연장선 직각 · 아래(몸 쪽)
    if (!(t0.y > 1e-6)) return fail("right-angle-not-downward", { piece: piece });
    var EC = D(E, C); if (!(EC > 1e-6)) return fail("guide-degenerate", { piece: piece });
    if (!(p.chordLegCm < EC)) return fail("chord-leg-out-of-range", { piece: piece, maxCm: EC });
    var sideLen = D(C, sideEnd); if (!(p.sideLegCm < sideLen)) return fail("side-leg-out-of-range", { piece: piece, maxCm: sideLen });
    var uc = unit(sub(C, E));
    var T = add(C, mul(unit(sub(E, C)), p.chordLegCm)), H = add(C, mul(sideDir, p.sideLegCm));
    var low = quadToCub(T, C, H);
    var sgn = MM.sign(lineDist(add(E, t0), E, C)), outSide = MM.sign(lineDist(add(C, sideDir), E, C));
    if (!(sgn !== 0 && sgn === outSide)) return fail("right-angle-inward", { piece: piece, t0VsGuideDeg: angDeg(t0, uc) });   // 직각 출발이 가이드 안쪽 → 부풀림이 종이 안으로
    var chord = D(E, T), best = null, ecv = sub(C, E), ecl = D(E, C);
    for (var b = 0.05; b <= 0.9001; b += 0.01) {
      var mk = (function (bb) { return function (a) { return [E, add(E, mul(t0, a * chord)), sub(T, mul(uc, bb * chord)), T]; }; })(b);
      var dev = function (a) {   // = max |lineDist(cub(q, k/400), E, C)| — cub·sub·cr 와 같은 식을 객체 없이 펼쳤을 뿐(같은 연산 순서 → 같은 값)
        var q = mk(a), m = 0, x0 = q[0].x, x1 = q[1].x, x2 = q[2].x, x3 = q[3].x, y0 = q[0].y, y1 = q[1].y, y2 = q[2].y, y3 = q[3].y;
        for (var k = 0; k <= 400; k++) {
          var t = k / 400, u = 1 - t;
          var px = (u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3) - E.x, py = (u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3) - E.y;
          m = MM.max(m, MM.abs((ecv.x * py - ecv.y * px) / ecl));
        }
        return m;
      };
      var lo = 0.0, hi = 1.5, flo = dev(lo); if (!((flo - bulge) * (dev(hi) - bulge) <= 0)) continue;
      for (var it = 0; it < 60; it++) { var mid = (lo + hi) / 2, fm = dev(mid); if ((flo - bulge) * (fm - bulge) <= 0) hi = mid; else { lo = mid; flo = fm; } }   // dev 는 결정적 — f(lo) 재사용은 결과 같음
      var a = (lo + hi) / 2, q = mk(a), s = MM.max(maxCurv(q), maxCurv(low));
      if (best && !(s < best.s)) continue;   // 더 나아질 수 없는 후보는 침범 검사 생략(순차 최소 — 결과 같음)
      var inside = false, pts = polyQ(q, 200).slice(1);
      for (var k = 0; k < pts.length && !inside; k++) if (strictlyInside(pts[k], paperLoop)) inside = true;
      if (inside) continue;
      best = { a: a, b: b, q: q, s: s };
    }
    if (!best) return fail("bulge-infeasible", { piece: piece });
    var lp = polyQ(low, 200).slice(1, -1);
    for (var j = 0; j < lp.length; j++) if (strictlyInside(lp[j], paperLoop)) return fail("rounding-inside-original", { piece: piece });
    var up = best.q, dm = 0, at = 0;
    for (var i = 0; i <= 400; i++) { var dd = MM.abs(lineDist(cub(up, i / 400), E, C)); if (dd > dm) { dm = dd; at = i / 400; } }
    var bp = cub(up, at), foot = add(E, mul(uc, dot(sub(bp, E), uc)));
    return { ok: true, piece: piece, SP: cp(SP), E: E, C: cp(C), T: T, H: H, us: us, t0: t0, uc: uc, sideDir: sideDir, up: up, low: low,
      handles: { a: best.a, b: best.b }, maxCurvature: best.s, chainLenCm: chainLen(chain),
      bulgeMaxCm: dm, bulgePoint: bp, bulgeFoot: foot, t0VsGuideDeg: angDeg(t0, uc),
      angleAtEDeg: angDeg(sub(SP, E), d1(up, 0)), kinkAtTDeg: angDeg(d1(up, 1), d1(low, 0)), tangentAtHDeg: angDeg(d1(low, 1), sideDir),
      spTurnDeg: angDeg(sub(SP, shoulderFrom), sub(E, SP)) };
  }

  function draftSleeveZ(bodice, aGeometry, params) {
    var SR = window.designSleeveR, ST = window.designSleeveT;
    if (!SR || !SR.gateBodiceA || !ST || !ST.parts || !ST.parts.moveFrontDart) return fail("no-module");
    var p = {}, bad = [];
    KEYS.forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (!(p.sleeveLengthCm > 0)) return fail("input-out-of-range", { key: "sleeveLengthCm", rule: "소매길이(어깨 연장) > 0" });
    if (!(p.bulgeBackCm > 0)) return fail("input-out-of-range", { key: "bulgeBackCm", rule: "뒤 부풀림 > 0(E 직각 출발이면 가이드에서 반드시 부푼다)" });
    if (!(p.bulgeFrontCm > 0)) return fail("input-out-of-range", { key: "bulgeFrontCm", rule: "앞 부풀림 > 0" });
    if (!(p.chordLegCm > 0)) return fail("input-out-of-range", { key: "chordLegCm", rule: "가이드 위 둥글림(C → T) > 0" });
    if (!(p.sideLegCm > 0)) return fail("input-out-of-range", { key: "sideLegCm", rule: "옆선 아래 둥글림(C → H) > 0" });
    if (!(p.sideDartDropCm > 0)) return fail("input-out-of-range", { key: "sideDartDropCm", rule: "옆 다트 위치 > 0" });
    if (!(p.sideLegCm < p.sideDartDropCm)) return fail("side-leg-beyond-dart", { sideLegCm: p.sideLegCm, sideDartDropCm: p.sideDartDropCm });
    var g = SR.gateBodiceA(bodice, aGeometry); if (!g.ok) return g;

    // 뒤: 진동 체인 SP→U · SP 쪽 어깨 조각 · 열린 어깨 다트 다리(제도선에 있음 → 외곽에 넣어 닫힌 조각으로) · 옆선
    var B = bodice.back, bArm = B.outline.filter(function (s) { return s.edge === "armhole"; });
    var bShA = B.outline.filter(function (s) { return s.boundary && s.boundary.root === "back/shoulder-armhole"; });
    var bSide = B.outline.filter(function (s) { return s.boundary && s.boundary.root === "back/side-seam"; });
    var bDart = (B.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "shoulder"; });
    if (bArm.length !== 1 || bShA.length !== 1 || bSide.length !== 1 || bDart.length !== 2) return fail("bodice-read-failed", { piece: "back" });
    var bChain = cubsOf(bArm[0]);
    if (D(bChain[0][0], bShA[0].from) > 1e-6 && D(bChain[0][0], bShA[0].to) > 1e-6) return fail("bodice-read-failed", { piece: "back", why: "sp" });
    var bShFrom = D(bShA[0].from, bChain[0][0]) < 1e-6 ? bShA[0].to : bShA[0].from;
    var bSE = [bSide[0].from, bSide[0].to].sort(function (u, v) { return u.y - v.y; }), bU = bChain[bChain.length - 1][3], bWP = bSE[1];
    if (D(bU, bSE[0]) > GAP_TOL) return fail("bodice-read-failed", { piece: "back", why: "armhole-ends" });
    var bDartSegs = bDart.map(function (s) { return withRole(s, "shoulder-dart"); });
    var bOrig = loopOf(B.outline.concat(bDartSegs));
    var hb = draftHalf("back", bChain, bShFrom, bU, bWP, unit(sub(bWP, bSE[0])), p.bulgeBackCm, p, bOrig.loop); if (!hb.ok) return hb;

    // 앞: AH 다트 → 옆(Ⓣ/Ⓥ/Ⓨ 와 같은 연산 — 읽기 전용 재사용) · C = 다트 이동 뒤 진동 아랫점 U1 · 옆선 위 조각 U1→S3r
    var mf = ST.parts.moveFrontDart(bodice.front, { sideDartDropCm: p.sideDartDropCm }); if (!mf.ok) return mf;
    var fSh = bodice.front.outline.filter(function (s) { return s.edge === "shoulder"; });
    if (fSh.length !== 1) return fail("bodice-read-failed", { piece: "front" });
    var fShFrom = D(fSh[0].from, mf.SP) < 1e-6 ? fSh[0].to : fSh[0].from;
    var fSideTop = mf.outline.filter(function (s) { return s.kind === "line" && D(s.from, mf.U1) < 1e-9 && D(s.to, mf.S3r) < 1e-9; });
    if (fSideTop.length !== 1) return fail("bodice-read-failed", { piece: "front", why: "side-top" });
    var fOrig = loopOf(mf.outline);
    var hf = draftHalf("front", mf.chain, fShFrom, mf.U1, mf.S3r, unit(sub(mf.S3r, mf.U1)), p.bulgeFrontCm, p, fOrig.loop); if (!hf.ok) return hf;

    // 새 외곽(재단선): 원래 외곽 − 진동 − 옆선 위 C→H + 어깨 연장 SP–E + 소맷부리 E→T→H + 옆선 H→
    var tail = function (h) { return [Lseg(h.SP, h.E, "shoulder-ext", { edge: "shoulder" }), Pseg([h.up, h.low], "sleeve-opening", { edge: "armhole" })]; };
    var bSegs = B.outline.filter(function (s) { return s.edge !== "armhole" && s !== bSide[0]; }).map(function (s) { return withRole(s, roleOf(s)); })
      .concat(bDartSegs, [Lseg(hb.H, bWP, "side-seam", { edge: "side-seam" })], tail(hb));
    var fSegs = mf.outline.filter(function (s) { return s.edge !== "armhole" && s !== fSideTop[0]; }).map(function (s) { return withRole(s, roleOf(s)); })
      .concat([Lseg(hf.H, mf.S3r, "side-seam", { edge: "side-seam" })], tail(hf));
    var lpB = loopOf(bSegs), lpF = loopOf(fSegs);
    if (!(lpB.gap < GAP_TOL && lpF.gap < GAP_TOL)) return fail("discontinuous", { backGapCm: lpB.gap, frontGapCm: lpF.gap });
    if (selfX(lpB.loop) || selfX(lpF.loop)) return fail("self-intersection");
    // 원래 종이는 새 외곽 안에 그대로 있어야 한다(덧붙이기만 — 깎지 않는다)
    var cutB = bOrig.loop.filter(function (q) { return !inLoop(q, lpB.loop) && dPoly(q, lpB.loop) > TOUCH_TOL; }).length;
    var cutF = fOrig.loop.filter(function (q) { return !inLoop(q, lpF.loop) && dPoly(q, lpF.loop) > TOUCH_TOL; }).length;
    if (cutB || cutF) return fail("original-paper-cut", { back: cutB, front: cutF });

    var segLen = function (s) { return cubsOf(s).reduce(function (a, q) { return a + qlen(q); }, 0); };
    var roleLen = function (segs, role) { return segs.filter(function (s) { return s.role === role; }).reduce(function (a, s) { return a + segLen(s); }, 0); };
    var seams = {
      shoulder: { back: roleLen(bSegs, "shoulder") + roleLen(bSegs, "shoulder-ext"), front: roleLen(fSegs, "shoulder") + roleLen(fSegs, "shoulder-ext") },
      shoulderExt: { back: roleLen(bSegs, "shoulder-ext"), front: roleLen(fSegs, "shoulder-ext") },
      sideSeam: { back: roleLen(bSegs, "side-seam"), front: roleLen(fSegs, "side-seam") },   // 앞 = 옆 다트 닫은 봉제 길이(다리 제외 H→다트 + 다트→아래)
      opening: { back: roleLen(bSegs, "sleeve-opening"), front: roleLen(fSegs, "sleeve-opening") },
      upperCurve: { back: qlen(hb.up), front: qlen(hf.up) }, rounding: { back: qlen(hb.low), front: qlen(hf.low) },
      shoulderDartLegs: bDartSegs.map(segLen), sideDartLegs: fSegs.filter(function (s) { return s.role === "side-dart"; }).map(segLen)
    };
    seams.opening.total = seams.opening.back + seams.opening.front;
    var armOrig = { back: chainLen(bChain), front: chainLen(mf.chain) };
    var fDartOld = (bodice.front.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "armhole"; });
    var draftLayer = function (h, chain) {
      var tick = 0.6, r1 = add(h.E, mul(h.us, -tick)), r2 = add(h.E, mul(h.t0, tick));
      return { guide: Lseg(h.E, h.C, "guide-chord"), sideOriginal: Lseg(h.C, h.H, "side-original"), bulge: Lseg(h.bulgeFoot, h.bulgePoint, "bulge-offset"),
        rightAngle: [Lseg(r1, add(r1, mul(h.t0, tick)), "right-angle"), Lseg(add(r1, mul(h.t0, tick)), r2, "right-angle")],
        armhole: Pseg(chain, "armhole-original") };
    };
    var dlB = draftLayer(hb, bChain), dlF = draftLayer(hf, mf.chain);
    dlF.oldDart = fDartOld.map(function (s) { return Lseg(s.from, s.to, "ah-dart-original"); });
    var halfMeta = function (h) {
      return { SP: cp(h.SP), E: cp(h.E), C: cp(h.C), T: cp(h.T), H: cp(h.H), handles: [cp(h.up[1]), cp(h.up[2])], handleRatio: [h.handles.a, h.handles.b],
        rounding: [cp(h.low[1]), cp(h.low[2])], bulgeCm: h.bulgeMaxCm, bulgePoint: cp(h.bulgePoint), bulgeFoot: cp(h.bulgeFoot), t0VsGuideDeg: h.t0VsGuideDeg,
        angleAtEDeg: h.angleAtEDeg, kinkAtTDeg: h.kinkAtTDeg, tangentAtHDeg: h.tangentAtHDeg, paperAngleAtHDeg: 180 - h.tangentAtHDeg,
        spTurnDeg: h.spTurnDeg, maxCurvature: h.maxCurvature, guideCm: D(h.E, h.C) };
    };
    var m = {
      rule: "pattern-school-p55-french-sleeve-Z(2026-11-04 approved draft)", sleeveLengthCm: p.sleeveLengthCm,
      settings: { inputs: clone(p), defaults: clone(DEFAULTS), book: Object.keys(BOOK), conventionChoices: Object.keys(CONVENTION),
        constants: { sleeveLengthFrom: "소매길이 = SP 에서 어깨선(SP 쪽 어깨 조각) 연장을 따라 — P.55 도해 «12» · 끝 내림 없음(«어깨 끝 경사는 두지 않는다»)",
          rightAngle: "E 에서 연장선에 직각 출발 — 도해 직각 표시", guide: "가이드 = E → C(원래 진동 아랫점) — 도해 가는 선",
          bulge: "가이드에서 바깥으로 최대 부풀림 — 도해 뒤 0.7 / 앞 0.3", rounding: "C 모서리 둥글림: 가이드 위 2.5 = T · 옆선 아래 2 = H(소맷부리 끝) · H 에서 옆선 접선 — 도해",
          frontDart: "앞 AH 다트 → 옆(P.55 «아래 예는 앞 AH 다트를 옆으로 이동») — Ⓣ/Ⓥ/Ⓨ 와 같은 연산", backDart: "뒤 어깨 다트는 열린 채(도해)" } },
      points: { back: halfMeta(hb), front: Object.assign(halfMeta(hf), { BP: cp(mf.BP), S3: cp(mf.S3), S3r: cp(mf.S3r), upperMouth: cp(mf.upperMouth), lowerMouth: cp(mf.lowerMouth) }) },
      frontDart: { kind: "AH → 옆(P.55 · P.140)", angleDeg: mf.sideDart.angleDeg, widthCm: mf.sideDart.widthCm, mouthResidualCm: mf.mouthResidualCm, positionFromUnderarmCm: p.sideDartDropCm,
        hToDartCm: D(hf.H, mf.S3r), apex: cp(mf.BP), legs: mf.sideDart.legs.map(cp), legCm: seams.sideDartLegs },
      backDart: { kind: "뒤 어깨 다트 — 열린 채(외곽 · 도해)", apex: cp(bDart[0].dart.apexAt === "from" ? bDart[0].from : bDart[0].to), legCm: seams.shoulderDartLegs },
      seams: seams,
      armhole: { backOrigCm: armOrig.back, frontOrigCm: armOrig.front, totalOrigCm: armOrig.back + armOrig.front, easeApplicable: false,
        note: "소매 달림선·별도 소매 조각이 없는 몸판 일체형 — 소매산·AH 이세는 적용 안 됨(원래 진동선은 제도 참고선 · 전부 새 외곽 안)" },
      underarm: { paperAngleSumDeg: (180 - hb.tangentAtHDeg) + (180 - hf.tangentAtHDeg), note: "H 에서 옆선 접선 — 봉제하면 겨드랑이 끝이 뾰족하게 모인다(김님 승인 형상)" },
      addedAreaCm2: { back: areaOf(lpB.loop) - areaOf(bOrig.loop), front: areaOf(lpF.loop) - areaOf(fOrig.loop) },
      draftLayer: { back: dlB, front: dlF },
      unconfirmed: ["옆 다트 위치 3 은 책에 수치가 없는 구현 관례(설정값) — H(2) 와 다트 위 다리 사이가 1 남는다(도해도 H 바로 아래)",
        "E→T 곡선의 T 손잡이 = 최대 곡률 최소(원래 종이 침범 금지) · C 둥글림 = 2차 곡선(제어점 C) — 책에 수치 없는 구현 관례",
        "소맷부리(팔구멍) 마무리(안단·바이어스)는 책에 없음 · B83 밖 치수와 3D 착용은 검증하지 않음(평면 변 길이·형상만)"],
      checks: { closed: true, connected: true, maxGapCm: MM.max(lpB.gap, lpF.gap), selfIntersection: false, curveInsideOriginal: 0, originalPaperCut: 0, pieces: 2, sleevePiece: false,
        areasCm2: { back: areaOf(lpB.loop), front: areaOf(lpF.loop) } }
    };
    var warnings = [];
    if (KEYS.some(function (k) { return BOOK[k] !== undefined && p[k] !== BOOK[k]; })) warnings.push("책 수치(소매길이 12 · 부풀림 뒤 0.7 / 앞 0.3 · 2.5 · 2) 밖 — 검토되지 않은 값");
    // 소매 조각 없음: 렌더·배치 계약(소매 버킷 = outline/construction 배열)만 지키는 빈 버킷 — 소매 형상·길이를 만들지 않는다.
    var noSleeve = { outline: [], construction: [], pieces: [], integratedBodice: true, sleevePiece: false, centerSeam: false, butted: false };
    return { ok: true, geometry: noSleeve,
      derivedBodice: { back: { outline: bSegs, construction: [dlB.armhole] }, front: { outline: fSegs, construction: [dlF.armhole] } },
      meta: m, warnings: warnings, sourceBodiceHash: bodice.hash !== undefined ? bodice.hash : null };
  }

  window.designSleeveZ = Object.freeze({ draftSleeveZ: draftSleeveZ, KEYS: KEYS,
    RULES: Object.freeze({ defaults: DEFAULTS, book: BOOK, convention: CONVENTION, bodicePresetId: "bunka-bodice-A" }) });
})();
