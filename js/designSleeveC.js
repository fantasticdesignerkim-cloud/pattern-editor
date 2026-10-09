// ══════════════════════════════════════════════
// designSleeveC.js — 소매 Ⓒ 엔진([패턴학교] P.41 하단 «소맷부리 치수를 결정하고 인체 곡선을 고려해 그린 뒤 맞댄다», 뒤 소맷부리 다트). 순수.
//
// 2026-10-08 김님 확정 재해석(docs/book/P041.md § Ⓒ 재해석 — 현행 권위)을 따른다. 이전(2026-10-07) 엔진의 1.49 계산 겹침 · 최종 곡선 호 길이 1:2:1 강제 ·
// 앞 바깥 조각 전체 회전 + 소매산 fairing · 원형 수직축 중앙 변은 «대체된 가정»으로 폐기했다. 입력은 완성 Ⓐ({geometry, meta}) 읽기 전용, 반환은 전부 새 객체.
//
// 공정(종이 조각 강체 이동 · 소매중심선 포함 중앙 조각 고정):
//   ① Ⓐ 위에 완성 가정선: 절개축 = 소매중심선과 옆선의 중점, 쐐기 꼭지 P = 절개축 × 소매산.
//      앞: EL 에서 두 굵은선 간격 1cm(확정) · 밑단에서 간격 1cm(확정)로 교차. 맞댈 두 변 길이가 같아야(강체) → EL 두 점 x_f∓0.5, 밑단 두 점 x_f±0.5 (유일).
//          EL 에서 소매중심에 가까운 선 = 중앙 조각 경계(교차점 너머까지 같은 선).
//      소맷부리: ● = 소맷부리÷4, 소맷부리 = 소매폭×3/4(책 산식). 구간은 흰 완성가정선의 두 점 거리(제도 구간): 앞 바깥 ● · 중앙 2● · 뒤 바깥 ●.
//      뒤 다리끝: 다리선이 Ⓐ 밑단과 만나는 점에서 각각 수직 아래 1cm(확정). 오른쪽 = 중앙 2● 의 끝, 왼쪽 = 다트 다리 길이 같음 + 위 변 대칭 → 뒤 절개축 대칭.
//      뒤 EL 쐐기(확정 도식): Q = 뒤 절개축 × EL, R = (P_b → 오른쪽 새 다리끝 H) 직선 × EL, D = QR. E = Q − D/2, F = Q + D/2 (EQ = FR = D/2, EF = D).
//   ② 뒤 ◎: 뒤 옆 조각을 P_b~E 변이 중앙 P_b~F 변에 닿도록 맞댐(EL 까지) → EL 아래는 자연스럽게 벌어진 V(봉제 다트, 꼭짓점 = F).
//   ③ 앞 ◎: 앞 상부 옆 조각(소매산 P_f~아랫점 · 옆선 · EL)을 P_f~(x_f+0.5) 변이 중앙 P_f~(x_f−0.5) 변에 닿도록 맞댐.
//   ④ 앞 EL 가로 절개 + 채운 ●◎: 앞 하부 옆 조각의 변((x_f+0.5,EL)→(x_f−0.5,밑단))을 중앙 변((x_f−0.5,EL)→(x_f+0.5,밑단))에 맞댐 → EL 절개선 옆선 쪽에 겹침.
//   ⑤ 겹친 길이(앞 옆선 단축)만큼 소매구 쪽 앞 옆선을 연장해 옆선을 맞춘다(종이를 늘리는 것이 아님).
//   ⑥ 소매산: Ⓐ 는 출발 소매산. 맞댐으로 P_b·P_f 에 생긴 꺾임을 양쪽 ℓ(임시 시작 2cm, 인접 호 40% 한도) 안에서 끝점·접선 고정 Hermite 로 이어 다시 그린다(D-256·D-257).
//      구간 밖 곡선은 이동한 조각의 곡선 그대로. 호 길이를 Ⓐ 로 되돌리지 않는다 — 최종 소매산 길이·이세는 최종 곡선 실측이 권위값.
//   ⑦ 소맷부리 마무리 곡선(2026-10-09 승인): 제도점은 고정하고 각 구간을 Hermite 로 바꾼다 — 앞/중앙 이음 G1, 다트 봉제 뒤 밑단 정합(다리끝 밑단 ⟂ 다리), 옆선 모서리·다트 꼭짓점·열린 뒤 V 유지.
//      최종 소맷부리 길이는 곡선 실측이 권위값(책 목표 W×3/4 와 구분해 기록, 1:2:1 강제 없음).
// 반환 { ok, geometry:{outline, construction}, meta, warnings, sourceSleeveAHash } | { ok:false, reason, detail?, outOfSupportedRange? }.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var DEFAULT_EL = 31.4;              // 팔꿈치 길이(SP → 팔꿈치선) 기본값 — params.elbowLengthCm 로 수정 가능
  var HEM_RATIO = 3 / 4;              // 소맷부리 = 소매폭 × 3/4 (책 산식)
  var DOT_DIV = 4;                    // ● = 소맷부리 ÷ 4 (책 산식)
  var ONE = 1;                        // 도해의 각 ‘1’ = 1cm (김님 확정): 앞 EL 간격 · 앞 밑단 간격 · 뒤 다리끝 수직 내림
  // 아래는 책 수치가 아니라 구현·검증 설정이다.
  var REDRAW_ELL = 2.0;               // 소매산 재제도 구간(꺾임 양쪽 호 길이) — 김님 승인 «임시 시작 설정»(D-257, 최종 고정값 아님)
  var REDRAW_RATIO = 0.4;             // 재제도 구간 ≤ 인접 호의 40% (비교 설정)
  var JOIN = 1e-9, TOL = 1e-6;
  var G1_TOL_DEG = 1e-9;              // 재제도 이음 접선 꺾임 허용(°) — 수치 반올림 수준(해석적 미분 방향)
  var KAPPA_DEAD = 0.01;              // 변곡 판정 불감대(/cm) — 수치 잡음 수준 비교 설정
  var MIN_LOWER = 1.0;                // EL → 소맷부리 최소 길이(cm)
  var MIN_UPPER = 0.5;                // 쐐기 꼭지(P_b·P_f)·아랫점이 EL 보다 위에 있어야 하는 최소 간격(cm)
  var FLAT_N = 24;                    // 자기교차 검산용 곡선 표본 수(cubic 당)
  var MAX_TURN = 150 * Math.PI / 180; // 윤곽 꼭짓점 꺾임 상한 — 스파이크 차단
  var GX = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
    0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
  var GW = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685,
    0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function finPt(p) { return !!p && fin(p.x) && fin(p.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
  function unit(a) { var l = Math.sqrt(a.x * a.x + a.y * a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function angleBetween(u, v) { return Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI; }
  function L(a, b, role) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (role) s.role = role; return s; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function cubicAt(q, t) {
    var u = 1 - t;
    return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x,
      y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y };
  }
  function cubicD1(q, t) {
    var u = 1 - t;
    return { x: 3 * u * u * (q[1].x - q[0].x) + 6 * u * t * (q[2].x - q[1].x) + 3 * t * t * (q[3].x - q[2].x),
      y: 3 * u * u * (q[1].y - q[0].y) + 6 * u * t * (q[2].y - q[1].y) + 3 * t * t * (q[3].y - q[2].y) };
  }
  function cubicD2(q, t) {
    return { x: 6 * (1 - t) * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x),
      y: 6 * (1 - t) * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) };
  }
  function kappa(q, t) { var d = cubicD1(q, t), dd = cubicD2(q, t), l = Math.sqrt(d.x * d.x + d.y * d.y); return l > 1e-15 ? cross(d, dd) / (l * l * l) : 0; }
  function cubicLen(q, t0, t1) {   // Gauss-Legendre 16점
    t0 = t0 || 0; t1 = t1 === undefined ? 1 : t1;
    var s = 0;
    for (var i = 0; i < 16; i++) { var t = t0 + (t1 - t0) * (GX[i] + 1) / 2, d = cubicD1(q, t); s += GW[i] * Math.sqrt(d.x * d.x + d.y * d.y); }
    return s * (t1 - t0) / 2;
  }
  function cubicsLen(cs) { var s = 0; cs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function splitAt(q, t) {   // De Casteljau → [왼쪽, 오른쪽]
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]), a = l(p01, p12), b = l(p12, p23), m = l(a, b);
    return [[cp(q[0]), p01, a, m], [cp(m), b, p23, cp(q[3])]];
  }
  function tAtLen(q, s) { var lo = 0, hi = 1; for (var k = 0; k < 64; k++) { var m = (lo + hi) / 2; if (cubicLen(q, 0, m) < s) lo = m; else hi = m; } return (lo + hi) / 2; }
  function splitListAtLen(cs, s) {   // 이어진 cubic 목록을 시작에서 호 길이 s 인 곳에서 둘로
    var acc = 0;
    for (var i = 0; i < cs.length; i++) {
      var l = cubicLen(cs[i]);
      if (acc + l >= s - 1e-12) {
        var t = tAtLen(cs[i], s - acc);
        if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)];
        if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(cs[i], t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))];
      }
      acc += l;
    }
    return [cs.slice(), []];
  }
  function splitListAtX(cs, x) {   // x 단조 소매산을 세로선 x 에서 둘로
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i];
      if ((q[0].x - x) * (q[3].x - x) <= 0) {
        var lo = 0, hi = 1, inc = q[3].x > q[0].x;
        for (var k = 0; k < 90; k++) { var m = (lo + hi) / 2; if ((cubicAt(q, m).x < x) === inc) lo = m; else hi = m; }
        var t = (lo + hi) / 2;
        if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)];
        if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(q, t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))];
      }
    }
    return null;
  }
  function rotP(p, a, c) { var d = sub(p, c), ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; }
  function angOf(c, p) { return Math.atan2(p.y - c.y, p.x - c.x); }
  function lineX(p1, p2, p3, p4) {
    var d = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(d) < 1e-14) return null;
    var t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / d;
    return add(p1, mul(sub(p2, p1), t));
  }
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) {
    var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function loopSelfIntersects(loop) {   // 닫힌 점열(마지막 = 처음)
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true;
    }
    return false;
  }
  function pathOf(cs, role) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (role) o.role = role; return o;
  }
  function flattenCubics(cs, n) { var out = []; cs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); }); return out; }
  function hermite(A, Ta, B, Tb) { var h = dist(A, B) / 3; return [cp(A), add(A, mul(Ta, h)), sub(B, mul(Tb, h)), cp(B)]; }   // 끝점·접선 고정, 핸들 = 현/3(길이 강제 없음)
  function inflectionCount(ks) {
    var sg = ks.map(function (k) { return k > KAPPA_DEAD ? 1 : (k < -KAPPA_DEAD ? -1 : 0); }).filter(function (v) { return v; }), n = 0;
    for (var i = 1; i < sg.length; i++) if (sg[i] !== sg[i - 1]) n++;
    return n;
  }
  function kappaOnRange(cs, s0, s1) {   // 목록의 호 길이 [s0, s1] 구간 곡률 표본
    var out = [], acc = 0;
    cs.forEach(function (q) {
      var l = cubicLen(q);
      if (acc + l >= s0 && acc <= s1) {
        var m = Math.max(16, Math.ceil(240 * l / Math.max(s1 - s0, 1e-9)));
        for (var i = 0; i <= m; i++) { var t = i / m, s = acc + cubicLen(q, 0, t); if (s >= s0 && s <= s1) out.push(kappa(q, t)); }
      }
      acc += l;
    });
    return out;
  }

  // ── Ⓐ 읽기(소매산 cubic 연쇄 · 수직 밑선 · 수평 소맷부리) ──
  function readSleeveA(a) {
    if (!a || typeof a !== "object" || a.ok === false) return { ok: false, reason: "no-sleeve-a" };
    var g = a.geometry, m = a.meta;
    if (!g || !Array.isArray(g.outline) || g.outline.length !== 4 || !m || typeof m !== "object") return { ok: false, reason: "invalid-sleeve-a" };
    var capS = g.outline[0], sB = g.outline[1], sF = g.outline[2], hm = g.outline[3];
    if (!capS || capS.kind !== "path" || !Array.isArray(capS.commands) || capS.commands.length < 3 || capS.commands[0].type !== "M") return { ok: false, reason: "invalid-sleeve-a" };
    var cubs = [], cur = capS.commands[0].points[0];
    for (var i = 1; i < capS.commands.length; i++) {
      var c = capS.commands[i];
      if (c.type !== "C" || !c.points || c.points.length !== 3) return { ok: false, reason: "invalid-sleeve-a" };
      cubs.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2];
    }
    if (!cubs.every(function (q) { return q.every(finPt); })) return { ok: false, reason: "invalid-sleeve-a" };
    if (![sB, sF, hm].every(function (s) { return s && s.kind === "line" && finPt(s.from) && finPt(s.to); })) return { ok: false, reason: "invalid-sleeve-a" };
    var Ub = cubs[0][0], Uf = cubs[cubs.length - 1][3], sp = m.sp, slen = m.sleeveLengthCm;
    if (!finPt(sp) || !fin(slen)) return { ok: false, reason: "invalid-sleeve-a" };
    var k = -1;
    for (var j = 0; j < cubs.length; j++) if (dist(cubs[j][3], sp) < JOIN) k = j;
    if (k < 0 || k === cubs.length - 1) return { ok: false, reason: "invalid-sleeve-a", detail: "sp-not-on-cap" };
    var vertical = sB.from.x === sB.to.x && sF.from.x === sF.to.x;
    var okEnds = dist(sB.from, Ub) < JOIN && dist(sF.from, Uf) < JOIN;
    var hemFlat = Math.abs(sB.to.y - sF.to.y) < JOIN && Math.abs(sB.to.y - slen) < TOL;
    if (!vertical || !okEnds || !hemFlat) return { ok: false, reason: "invalid-sleeve-a", detail: "seam-or-hem" };
    var W = Uf.x - Ub.x;
    if (!(W > 0) || !(Ub.x < 0) || !(Uf.x > 0)) return { ok: false, reason: "invalid-width" };
    if (fin(m.bicepCm) && Math.abs(m.bicepCm - W) > TOL) return { ok: false, reason: "invalid-sleeve-a", detail: "bicep-mismatch" };
    if (!(slen > Math.max(Ub.y, Uf.y))) return { ok: false, reason: "invalid-sleeve-a", detail: "hem-above-underarm" };
    for (var q2 = 0; q2 < cubs.length; q2++) for (var s2 = 1; s2 <= 64; s2++) if (!(cubicAt(cubs[q2], s2 / 64).x > cubicAt(cubs[q2], (s2 - 1) / 64).x)) return { ok: false, reason: "invalid-sleeve-a", detail: "cap-not-x-monotone" };
    return { ok: true, cubics: cubs, spIndex: k, sp: cp(sp), Ub: cp(Ub), Uf: cp(Uf), hemY: slen, W: W, armholeCm: m.armholeCm || null, sleeveLengthCm: slen };
  }

  function fail(reason, detail, out) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; if (out) o.outOfSupportedRange = true; return o; }

  // 입력: sleeveA = draftSleeveA 결과({geometry, meta}). params = { elbowLengthCm?: number (기본 31.4) }.
  function draftSleeveC(sleeveA, params) {
    params = params || {};
    var el = params.elbowLengthCm;
    var EL = (el === undefined || el === null || el === "") ? DEFAULT_EL : el;
    if (!fin(EL) || !(EL > 0)) return fail("invalid-elbow-length");
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, hemY = r.hemY, W = r.W, XL = Ub.x, XR = Uf.x;
    if (!(hemY - EL >= MIN_LOWER)) return fail("elbow-too-close-to-hem", hemY - EL, true);
    if (!(EL - Math.max(Ub.y, Uf.y) >= MIN_UPPER)) return fail("elbow-above-underarm", EL, true);
    var cuff = W * HEM_RATIO, dot = cuff / DOT_DIV, xb = XL / 2, xf = XR / 2;
    var s1 = splitListAtX(cubs, xb), s2 = s1 && splitListAtX(s1[1], xf), s3 = s2 && splitListAtX(s2[0], r.sp.x);
    if (!s3) return fail("no-cap-intersection");
    var backArc = s1[0], frontArc = s2[1], centerB = s3[0], centerF = s3[1];
    var Pb = cp(backArc[backArc.length - 1][3]), Pf = cp(frontArc[0][0]);
    if (!(EL - Math.max(Pb.y, Pf.y) >= MIN_UPPER)) return fail("elbow-above-underarm", EL, true);
    var Eb = { x: XL, y: EL }, Ef = { x: XR, y: EL };

    // ① 완성 가정선(흰 작업도)
    var fAe = { x: xf - ONE / 2, y: EL }, fBe = { x: xf + ONE / 2, y: EL }, fAh = { x: xf + ONE / 2, y: hemY }, fBh = { x: xf - ONE / 2, y: hemY };
    var F0 = { x: fBh.x + dot, y: hemY };                                       // 앞 바깥 ● (같은 밑단선 위 두 점 거리)
    var drop = ONE;
    if (!(2 * dot > drop)) return fail("cuff-chain-impossible", dot, true);
    var R0x = fAh.x - Math.sqrt(4 * dot * dot - drop * drop);                   // 중앙 2● : fA_H ~ 오른쪽 새 다리끝 두 점 거리
    var Hr = { x: R0x, y: hemY + drop }, Hl = { x: 2 * xb - R0x, y: hemY + drop };
    if (!(Hr.x > xb && Hl.x < xb)) return fail("back-leg-ends-crossed", Hr.x - xb, true);
    if (!(dot > drop)) return fail("cuff-chain-impossible", dot, true);
    var B0 = { x: Hl.x - Math.sqrt(dot * dot - drop * drop), y: hemY };        // 뒤 바깥 ●
    if (!(B0.x < XL + 0.5 * W)) return fail("cuff-chain-impossible", B0.x, true);
    // 뒤 EL 쐐기(확정 도식): Q, R(P_b→H 직선 × EL), D = QR, E/F = Q ∓ D/2
    var Q = { x: xb, y: EL }, tR = (EL - Pb.y) / (Hr.y - Pb.y), Rq = { x: Pb.x + (Hr.x - Pb.x) * tR, y: EL }, Dw = Rq.x - Q.x;
    if (!(Dw > TOL)) return fail("back-wedge-degenerate", Dw, true);
    var E = { x: Q.x - Dw / 2, y: EL }, F = { x: Q.x + Dw / 2, y: EL };

    // ②③④ 강체 맞댐(중앙 고정)
    var psiB = angOf(Pb, F) - angOf(Pb, E), psiF = angOf(Pf, fAe) - angOf(Pf, fBe), thL = angOf(fAe, fAh) - angOf(fBe, fBh);
    var RB = function (p) { return rotP(p, psiB, Pb); }, RF = function (p) { return rotP(p, psiF, Pf); };
    var RL = function (p) { return add(rotP(p, thL, fBe), sub(fAe, fBe)); };
    var rotList = function (cs, f) { return cs.map(function (q) { return q.map(f); }); };
    var backRot = rotList(backArc, RB), frontRot = rotList(frontArc, RF);
    var RAW = backRot.concat(centerB, centerF, frontRot);
    var UbM = RB(Ub), EbM = RB(Eb), B0M = RB(B0), HlM = RB(Hl), UfM = RF(Uf), Eu = RF(Ef), El2 = RL(Ef), F0M = RL(F0);
    var legC = dist(F, Hr), legO = dist(F, HlM);                                 // 다트 다리(봉제 정합)
    if (!(HlM.x < Hr.x - TOL)) return fail("back-dart-not-open", Hr.x - HlM.x, true);
    var X = lineX(UfM, Eu, El2, F0M);
    if (!X) return fail("front-seam-parallel");
    var overlapEL = Eu.y - El2.y;                                              // EL 절개선 옆선 쪽 겹침 깊이
    if (!(overlapEL > TOL)) return fail("front-no-overlap", overlapEL, true);
    var seamFw = dist(Uf, Ef) + dist(Ef, F0), seamBw = dist(Ub, Eb) + dist(Eb, B0);
    var seamFm = dist(UfM, X) + dist(X, F0M);
    var ext = seamFw - seamFm;                                                   // ⑤ 겹친 길이(앞 옆선 단축) = 소매구 연장량
    if (!(ext > 0)) return fail("front-no-overlap", ext, true);
    var dirLow = unit(sub(F0M, X)); if (!dirLow) return fail("front-seam-parallel");
    var F0e = add(F0M, mul(dirLow, ext));

    // ⑥ 소매산 국소 재제도
    var LB = cubicsLen(backRot), LcB = cubicsLen(centerB), LcF = cubicsLen(centerF), LF = cubicsLen(frontRot);
    var w1 = [Math.min(REDRAW_ELL, REDRAW_RATIO * LB), Math.min(REDRAW_ELL, REDRAW_RATIO * LcB)], w2 = [Math.min(REDRAW_ELL, REDRAW_RATIO * LcF), Math.min(REDRAW_ELL, REDRAW_RATIO * LF)];
    var sPb = LB, sPf = LB + LcB + LcF, a1 = sPb - w1[0], b1 = sPb + w1[1], a2 = sPf - w2[0], b2 = sPf + w2[1];
    if (!(a1 > 0 && b1 < sPb + LcB && a2 > sPb + LcB && b2 < sPf + LF && b1 < a2)) return fail("redraw-window-invalid");
    var p0 = splitListAtLen(RAW, a1), p1 = splitListAtLen(p0[1], b1 - a1), p2 = splitListAtLen(p1[1], a2 - b1), p3 = splitListAtLen(p2[1], b2 - a2);
    var head = p0[0], mid = p2[0], tail = p3[1];
    if (!head.length || !mid.length || !tail.length) return fail("redraw-window-invalid");
    var cA = head[head.length - 1], cB = mid[0], cC = mid[mid.length - 1], cD = tail[0];
    var tA = unit(cubicD1(cA, 1)), tB = unit(cubicD1(cB, 0)), tC = unit(cubicD1(cC, 1)), tD = unit(cubicD1(cD, 0));
    if (!tA || !tB || !tC || !tD) return fail("redraw-window-invalid");
    var h1 = hermite(cA[3], tA, cB[0], tB), h2 = hermite(cC[3], tC, cD[0], tD);
    var cap = head.concat([h1], mid, [h2], tail);
    var joins = [[cA, h1], [h1, cB], [cC, h2], [h2, cD]].map(function (pq) { return { gapCm: dist(pq[0][3], pq[1][0]), g1Deg: angleBetween(cubicD1(pq[0], 1), cubicD1(pq[1], 0)) }; });
    var joinGap = 0, joinG1 = 0; joins.forEach(function (j) { joinGap = Math.max(joinGap, j.gapCm); joinG1 = Math.max(joinG1, j.g1Deg); });
    if (!(joinGap < JOIN)) return fail("discontinuous", joinGap);
    if (!(joinG1 <= G1_TOL_DEG)) return fail("redraw-g1-break", joinG1);
    // 구간 밖 원곡선 보존(raw 와 같은 호 위치 대조) · 변곡
    var ptAt = function (cs, s) { var sp_ = splitListAtLen(cs, s); return sp_[1].length ? sp_[1][0][0] : sp_[0][sp_[0].length - 1][3]; };
    var shift1 = cubicLen(h1) - (b1 - a1), preserved = 0;
    for (var kk = 1; kk < 8; kk++) {
      preserved = Math.max(preserved, dist(ptAt(RAW, a1 * kk / 8), ptAt(cap, a1 * kk / 8)));
      var sm = b1 + (a2 - b1) * kk / 8; preserved = Math.max(preserved, dist(ptAt(RAW, sm), ptAt(cap, sm + shift1)));
    }
    var kH = function (h) { var o = []; for (var i = 0; i <= 240; i++) o.push(kappa(h, i / 240)); return o; };
    var k1 = kH(h1), k2 = kH(h2), kA1 = kappaOnRange(cubs, a1, b1), kA2 = kappaOnRange(cubs, a2, b2);   // Ⓐ 같은 호 구간(이동 전 — 강체라 곡률 같음)
    var inflExtra = Math.max(0, inflectionCount(k1) - inflectionCount(kA1)) + Math.max(0, inflectionCount(k2) - inflectionCount(kA2));
    if (inflExtra > 0) return fail("redraw-extra-inflection", inflExtra, true);
    var amax = function (a) { return a.reduce(function (m, v) { return Math.max(m, Math.abs(v)); }, 0); };

    // ── ⑦ 소맷부리 마무리 곡선(2026-10-09 김님 승인 — 직선 1차는 최종 완료가 아님) ──
    //   제도점(앞 바깥 모서리 F0e · 앞 중앙 밑단점 x_f+0.5 · 뒤 두 다리끝(1cm 내림) · 뒤 바깥 모서리)은 움직이지 않는다. 각 구간을 끝점 고정 Hermite(핸들 = 현/3)로 바꾼다.
    //   · 앞/중앙 이음(x_f+0.5): 두 직선 방향의 이등분 접선 — G1 · 뒤 다트 다리끝: 밑단이 다리에 직교 → 다트를 봉제(닫음)하면 양쪽 밑단이 한 접선으로 이어진다
    //   · 옆선 접점(앞·뒤 바깥 모서리)과 다트 꼭짓점은 의도된 모서리로 남긴다(접선 = 원래 직선 방향).
    var perpToward = function (legFrom, legTo, toward) { var u = unit(sub(legTo, legFrom)), n = { x: -u.y, y: u.x }; return (n.x * (toward.x - legTo.x) + n.y * (toward.y - legTo.y)) >= 0 ? n : { x: -n.x, y: -n.y }; };
    var tFrontLine = unit(sub(fAh, F0e)), tCenterLine = unit(sub(Hr, fAh)), tMidFC = unit(add(tFrontLine, tCenterLine));
    if (!tFrontLine || !tCenterLine || !tMidFC) return fail("cuff-curve-degenerate");
    var tHrIn = perpToward(F, Hr, fAh); tHrIn = { x: -tHrIn.x, y: -tHrIn.y };          // fAh → Hr 로 들어올 때 Hr 접선(중앙 다리에 직교)
    var tHlOut = perpToward(F, HlM, B0M);                                                 // HlM 에서 B0M 으로 나갈 때(바깥 다리에 직교)
    // 옆선 모서리 쪽(자유 끝) 접선은 반대쪽 고정 접선을 현(chord)에 대해 거울로 둔다 — 원호처럼 한 방향으로만 휘어 변곡이 생기지 않는다(모서리는 그대로 모서리).
    var mirrorStart = function (A, B, tEndDir) { var c = unit(sub(B, A)), d = Math.atan2(tEndDir.y, tEndDir.x) - Math.atan2(c.y, c.x); return rotP(c, -d, { x: 0, y: 0 }); };
    var mirrorEnd = function (A, B, tStartDir) { var c = unit(sub(B, A)), d = Math.atan2(tStartDir.y, tStartDir.x) - Math.atan2(c.y, c.x); return rotP(c, -d, { x: 0, y: 0 }); };
    var hemFrontC = hermite(F0e, mirrorStart(F0e, fAh, tMidFC), fAh, tMidFC), hemCenterC = hermite(fAh, tMidFC, Hr, tHrIn), hemBackC = hermite(HlM, tHlOut, B0M, mirrorEnd(HlM, B0M, tHlOut));
    var closeAng = angOf(F, Hr) - angOf(F, HlM);                                         // 다트를 닫는 회전(바깥 → 중앙 다리)
    var dartHemDeg = angleBetween(cubicD1(hemCenterC, 1), rotP(cubicD1(hemBackC, 0), closeAng, { x: 0, y: 0 }));
    var fcDeg = angleBetween(cubicD1(hemFrontC, 1), cubicD1(hemCenterC, 0));
    if (!(fcDeg <= G1_TOL_DEG) || !(dartHemDeg <= 1e-6)) return fail("cuff-curve-g1-break", Math.max(fcDeg, dartHemDeg));
    var cuffInfl = [hemFrontC, hemCenterC, hemBackC].map(function (q) { var k = []; for (var i = 0; i <= 120; i++) k.push(kappa(q, i / 120)); return inflectionCount(k); });
    if (cuffInfl.some(function (n) { return n > 0; })) return fail("cuff-curve-inflection", cuffInfl, true);
    var hemFrontP = pathOf([hemFrontC], "hem-front"), hemCenterP = pathOf([hemCenterC], "hem-center"), hemBackP = pathOf([hemBackC], "hem-back");

    // ── 단일 외곽 ──
    var outline = [pathOf(cap, "cap"),
      L(UfM, X, "side-seam-front"), L(X, F0e, "side-seam-front-lower"),
      hemFrontP, hemCenterP,
      L(Hr, F, "dart-leg-center"), L(F, HlM, "dart-leg-outer"),
      hemBackP, L(B0M, EbM, "side-seam-back-lower"), L(EbM, UbM, "side-seam-back")];
    outline[5].pair = "elbow-back"; outline[6].pair = "elbow-back";
    var segEnd = function (sg) { return sg.kind === "path" ? sg.commands[sg.commands.length - 1].points[2] : sg.to; };
    var segCubs = function (sg) { var o = [], cur = sg.commands[0].points[0]; sg.commands.slice(1).forEach(function (c) { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; };
    var tStart = function (sg) { return sg.kind === "path" ? unit(cubicD1(segCubs(sg)[0], 0)) : unit(sub(sg.to, sg.from)); };
    var tEnd = function (sg) { if (sg.kind !== "path") return unit(sub(sg.to, sg.from)); var cs = segCubs(sg); return unit(cubicD1(cs[cs.length - 1], 1)); };
    var loop = flattenCubics(cap, FLAT_N);
    outline.slice(1).forEach(function (sg) { if (sg.kind === "path") flattenCubics(segCubs(sg), FLAT_N).slice(1).forEach(function (p) { loop.push(p); }); else loop.push(cp(sg.to)); });
    var closeGap = dist(loop[loop.length - 1], loop[0]), segGap = 0;
    for (var gi = 1; gi < outline.length; gi++) { var pf = outline[gi].kind === "path" ? outline[gi].commands[0].points[0] : outline[gi].from; segGap = Math.max(segGap, dist(segEnd(outline[gi - 1]), pf)); }
    if (!(closeGap < JOIN) || !(segGap < JOIN)) return fail("discontinuous", Math.max(closeGap, segGap));
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    var maxTurn = 0, turns = {};
    for (var oi = 1; oi < outline.length; oi++) {
      var sa = outline[oi - 1], sbb = outline[oi], tv = angleBetween(tEnd(sa), tStart(sbb));
      turns[(sa.role || "cap") + "→" + sbb.role] = tv;
      if (sbb.role !== "dart-leg-outer") maxTurn = Math.max(maxTurn, tv);
    }
    if (maxTurn * Math.PI / 180 > MAX_TURN) return fail("spike", maxTurn);
    var construction = [
      L({ x: r.sp.x, y: r.sp.y }, { x: r.sp.x, y: hemY }, "center-line"),
      L({ x: XL, y: EL }, { x: XR, y: EL }, "elbow-line"),
      L(Pb, F, "cut-axis-back"), L(Pf, fAe, "cut-axis-front"),
      L(fAe, fAh, "front-axis-lower"), L(RL(fBe), Eu, "front-el-cut")   // front-axis-lower = 앞 EL→소매구 맞댐선(중앙 조각 경계 = 하부 조각을 맞댄 선, 표시) · front-el-cut = 맞댄 뒤 EL 절개선(내부, 표시 안 함)
    ];

    // ── 독립 실측 ──
    var capBack = cubicsLen(head) + cubicLen(h1) + (LB + LcB - b1), capTotal = cubicsLen(cap), capFront = capTotal - capBack;
    var ahc = r.armholeCm, easeNow = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: capBack - ahc.back, front: capFront - ahc.front, total: capTotal - ahc.back - ahc.front } : null;
    var seamF = dist(UfM, X) + dist(X, F0e), seamB = dist(UbM, EbM) + dist(EbM, B0M);
    var hemSeg = { backOuter: cubicLen(hemBackC), center: cubicLen(hemCenterC), frontOuter: cubicLen(hemFrontC) };
    var hemStraight = { backOuter: dist(HlM, B0M), center: dist(fAh, Hr), frontOuter: dist(F0e, fAh) };
    var extZone = [cp(F0M), cp(F0e)].concat(flattenCubics([hemFrontC], 12).slice(1));   // 연장 영역(표시용): 연장 전 모서리 → 연장 후 모서리 → 최종 앞 소맷부리 곡선 → 앞 중앙 밑단점
    var hemCm = hemSeg.backOuter + hemSeg.center + hemSeg.frontOuter;
    var am = sleeveA.meta;
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p41-tight-sleeve-C-paper(2026-10-09)",
        widthCm: W, hemRatio: HEM_RATIO, hemTargetCm: cuff, hemCm: hemCm, hemStraightCm: hemStraight.backOuter + hemStraight.center + hemStraight.frontOuter, sleeveLengthCm: r.sleeveLengthCm,
        elbowLengthCm: EL, elbowLine: { y: EL, back: cp(EbM), front: cp(Ef) }, lowerLengthCm: hemY - EL,
        sections: { unitCm: dot, measure: "흰 완성가정선 두 점 거리(제도 구간)",
          white: { backOuter: dist(B0, Hl), center: dist(fAh, Hr), frontOuter: dist(fBh, F0) },
          final: hemSeg, finalMeasure: "최종 소맷부리 곡선 호 길이(Gauss-Legendre) — 권위값", straight: hemStraight },
        derivation: {
          frontElbowPoints: [cp(fAe), cp(fBe)], frontHemPoints: [cp(fAh), cp(fBh)], frontCrossing: { x: xf, y: (EL + hemY) / 2 },
          legEnds: { center: cp(Hr), outer: cp(Hl), dropCm: drop, from: "Ⓐ 밑단 교점에서 수직 아래" },
          backWedge: { Q: cp(Q), R: cp(Rq), D: Dw, E: cp(E), F: cp(F) },
          hemWhite: { backOuterCorner: cp(B0), frontOuterCorner: cp(F0) }
        },
        axes: { back: { x: xb, cap: cp(Pb), elbow: cp(Q), hem: { x: xb, y: hemY } }, front: { x: xf, cap: cp(Pf), elbow: { x: xf, y: EL }, hem: { x: xf, y: hemY } } },
        back: { apex: cp(F), rotationDeg: psiB * 180 / Math.PI, outerCorner: cp(B0M), outerEnd: cp(HlM),
          legCenter: { to: cp(Hr), lengthCm: legC }, legOuter: { to: cp(HlM), lengthCm: legO }, legLengthDiffCm: legC - legO, dartOpenCm: dist(HlM, Hr) },
        front: { pivot: cp(Pf), upperRotationDeg: psiF * 180 / Math.PI, lowerRotationDeg: thL * 180 / Math.PI, elCut: { from: cp(RL(fBe)), to: cp(Eu), lowerOuter: cp(El2) },
          overlapCm: overlapEL, seamShortfallCm: ext, extensionCm: ext, outerCorner: cp(F0e), outerCornerBeforeExtension: cp(F0M), seamKnee: cp(X), underarm: cp(UfM),
          extension: { amountCm: ext, before: { from: cp(F0M), to: cp(fAh) }, after: cp(F0e), zone: extZone, note: "옆선 방향 연장 — 최종 shape 는 geometry 가 권위값" },
          axisLower: { from: cp(fAe), to: cp(fAh), note: "앞 EL→소매구 맞댐선(중앙 조각 경계)" } },
        seams: { backCm: seamB, frontCm: seamF, residualCm: seamF - seamB, whiteBackCm: seamBw, whiteFrontCm: seamFw },
        redraw: { ellCm: REDRAW_ELL, ratio: REDRAW_RATIO, status: "임시 시작 설정(D-257) — 책 치수·최종값 아님", windows: { Pb: w1, Pf: w2 },
          kinkDegRaw: { Pb: Math.abs(psiB) * 180 / Math.PI, Pf: Math.abs(psiF) * 180 / Math.PI }, joins: joins, preservedMaxCm: preserved, inflectionExtra: inflExtra,
          kappaMax: { Pb: amax(k1), Pf: amax(k2), PbA: amax(kA1), PfA: amax(kA2) }, continuity: "G1(곡률 연속 아님)" },
        cuffCurve: { method: "끝점 고정 Hermite(핸들=현/3) · 앞/중앙 이음 이등분 접선 · 다트 다리끝 밑단 ⟂ 다리 · 옆선 모서리·다트 꼭짓점 유지", status: "2026-10-09 김님 승인 — 마무리 곡선",
          frontCenterG1Deg: fcDeg, dartClosedHemDeg: dartHemDeg, inflections: cuffInfl, fixedPoints: [cp(F0e), cp(fAh), cp(Hr), cp(HlM), cp(B0M)], turnsDeg: turns },
        sp: cp(r.sp), capSplit: { point: cp(r.sp) },
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { back: capBack, front: capFront, total: capTotal, measure: "Gauss-Legendre(final curve)" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeNow, easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap, segGap), cuffG1Deg: Math.max(fcDeg, dartHemDeg), selfIntersection: false, singlePiece: true, maxG1BreakDeg: joinG1, maxCornerDeg: maxTurn,
          preservedMaxCm: preserved, dartLegsDiffCm: Math.abs(legC - legO), overlapMinusExtensionCm: overlapEL - ext, seamResidualCm: seamF - seamB },
        limits: { redrawEllCm: REDRAW_ELL, redrawRatio: REDRAW_RATIO, g1TolDeg: G1_TOL_DEG, kappaDeadPerCm: KAPPA_DEAD, minLowerCm: MIN_LOWER, minUpperCm: MIN_UPPER, maxTurnRad: MAX_TURN }
      },
      warnings: [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  window.designSleeveC = Object.freeze({ draftSleeveC: draftSleeveC, readSleeveA: readSleeveA,
    RULES: Object.freeze({ defaultElbowLengthCm: DEFAULT_EL, hemRatio: HEM_RATIO, dotDivisor: DOT_DIV, oneCm: ONE, legDropCm: ONE,
      redrawEllCm: REDRAW_ELL, redrawRatio: REDRAW_RATIO, g1TolDeg: G1_TOL_DEG, kappaDeadPerCm: KAPPA_DEAD, minLowerCm: MIN_LOWER, minUpperCm: MIN_UPPER, maxTurnRad: MAX_TURN }) });
})();
