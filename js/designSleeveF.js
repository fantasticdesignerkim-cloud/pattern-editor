// ══════════════════════════════════════════════
// designSleeveF.js — 소매 Ⓕ 턱트 슬리브([패턴학교] P.43 «소매 중심선과 평행으로 절개선을 넣고 소맷부리를 기준점으로 잘라서 벌린다»). 순수.
//
// 김님 확정(2026-10-10, docs/book/P043.md § Ⓕ 김님 확정):
//   · 출발 = 완성 소매 Ⓐ(읽기 전용). 절개선 4개 = 소매 중심선 ±1 · ±3cm(선 사이 2cm, 책 «2»), 소매 중심선과 평행.
//   · 가운데 2cm 띠 고정. 안쪽 띠 → 바깥 조각 순서로, 각 절개의 **소맷부리 점을 기준점**으로 강체 회전해 소매산에서 벌린다
//     (바깥 조각은 함께 움직인 안쪽 띠에 붙은 기준점 — 부모 변환). 소맷부리는 벌어지지 않는다(책: 소맷부리 치수·소매산 높이 불변).
//   · 각 턱 분량 기본 1.5cm(책 도해), 최대 3cm(책) — 사용자 수정 가능. 벌림 = 소매산 위 두 모서리 사이 직선 거리(잠정 정의, Ⓓ·Ⓔ 와 같은 결).
//   · 턱 방향(김님 원문 «바깥쪽으로 접는데 소매중심이 위로 올라와야해»): 접는 선(주름 꺾임) = 각 쐐기의 **중심 쪽 변**,
//     중심 쪽 천이 위층으로 바깥쪽을 덮는다. 쐐기 천은 중심 쪽 조각 아래로 두 겹(반씩) 접혀 들어간다(P043 § 물리 단면).
//   · 재단선 = 턱을 접은 상태에서 소매산을 정리한 뒤 펼친 선. 접은 상태의 소매산은 Ⓐ 소매산과 같아(조각이 원위치) 꺾임이 없으므로
//     다시 그릴 곳이 없고, 쐐기 위 재단선은 그 소매산을 접힌 두 겹에 옮겨 펼친 «산 모양»이 된다(책 도해 ⑧).
//   · 이세(김님 ③) = **턱을 접은(봉제 후) 소매산 길이** − AH. 재단(펼친) 소매산 길이는 따로 기록한다.
// 박기 끝(턱 박음 길이)은 책에 없고 미확정 — 만들지 않는다(표시 기호만 소매산 입구에).
// 소맷부리(김님 2026-10-10 «자연스러운 곡선으로 처리해죠»): 강체 직선(기준점마다 조각 회전각만큼 꺾임)은 meta.hem.raw 감사용으로 남기고,
//   최종 외곽은 양 끝(옆선 끝)·기준점 4를 그대로 지나는 G1 곡선. 길이는 맞추지 않고 실측해 Ⓐ 와의 차를 기록한다(B83 t1.5 ≈ +0.0004cm).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var CUT_OFFSETS = [-3, -1, 1, 3];   // 소매 중심선 기준 절개선 x(cm) — 책 «2» 간격, 김님 확정
  var TUCK_DEFAULT = 1.5, TUCK_MAX = 3.0;   // 책 도해 1.5 · 본문 «1곳 3cm 가 최대»
  var JOIN = 1e-9, TOL = 1e-6;
  var FOLD_TOL = 1e-7;               // 접은 상태 ↔ Ⓐ 일치 허용(cm)
  var G1_TOL_DEG = 1e-6;
  var KAPPA_DEAD = 0.001;            // 소맷부리 변곡 판정 불감대(/cm) — 꺾임이 작아 곡률도 작다(Ⓔ 0.01 보다 엄격)
  var FLAT_N = 24;
  var GX = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
    0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
  var GW = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685,
    0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function finPt(p) { return !!p && fin(p.x) && fin(p.y); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function dist(a, b) { var dx = b.x - a.x, dy = b.y - a.y; return Math.sqrt(dx * dx + dy * dy); }
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
  function cubicLen(q) {   // Gauss-Legendre 16점
    var s = 0;
    for (var i = 0; i < 16; i++) { var d = cubicD1(q, (GX[i] + 1) / 2); s += GW[i] * Math.sqrt(d.x * d.x + d.y * d.y); }
    return s / 2;
  }
  function kappa(q, t) {
    var d = cubicD1(q, t), u = 1 - t, dd = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) };
    var l = Math.sqrt(d.x * d.x + d.y * d.y); return l > 1e-15 ? (d.x * dd.y - d.y * dd.x) / (l * l * l) : 0;
  }
  function inflectionCount(ks) {   // 부호 바뀜 수(불감대 KAPPA_DEAD)
    var sg = ks.map(function (k) { return k > KAPPA_DEAD ? 1 : (k < -KAPPA_DEAD ? -1 : 0); }).filter(function (v) { return v; }), n = 0;
    for (var i = 1; i < sg.length; i++) if (sg[i] !== sg[i - 1]) n++;
    return n;
  }
  function unit(a) { var l = Math.sqrt(a.x * a.x + a.y * a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function hermite(A, Ta, B, Tb) { var h = dist(A, B) / 3; return [cp(A), { x: A.x + Ta.x * h, y: A.y + Ta.y * h }, { x: B.x - Tb.x * h, y: B.y - Tb.y * h }, cp(B)]; }
  // 이어진 점열을 지나는 G1 Hermite 사슬: 내부 접선 = 이웃 두 점 방향, 양 끝 접선 = 이웃 접선을 현에 대해 거울(한 방향으로 휨). Ⓔ 와 같은 규칙.
  function throughCurve(pts) {
    var n = pts.length, T = [];
    for (var i = 1; i < n - 1; i++) T[i] = unit(sub(pts[i + 1], pts[i - 1]));
    var mirror = function (A, B, t) { var c = unit(sub(B, A)), d = Math.atan2(t.y, t.x) - Math.atan2(c.y, c.x), ca = Math.cos(-d), sa = Math.sin(-d); return { x: c.x * ca - c.y * sa, y: c.x * sa + c.y * ca }; };
    T[0] = mirror(pts[0], pts[1], T[1]);
    var tl = mirror(pts[n - 1], pts[n - 2], { x: -T[n - 2].x, y: -T[n - 2].y }); T[n - 1] = { x: -tl.x, y: -tl.y };
    var cs = [];
    for (var j = 0; j < n - 1; j++) cs.push(hermite(pts[j], T[j], pts[j + 1], T[j + 1]));
    return cs;
  }
  function cubicsLen(cs) { var s = 0; cs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function splitAt(q, t) {   // De Casteljau → [왼쪽, 오른쪽]
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]), a = l(p01, p12), b = l(p12, p23), m = l(a, b);
    return [[cp(q[0]), p01, a, m], [cp(m), b, p23, cp(q[3])]];
  }
  // 이어진 cubic 목록을 부호 함수 f(점) 가 0 이 되는 곳(단조 교차 1회)에서 둘로.
  function splitListBy(cs, f) {
    for (var i = 0; i < cs.length; i++) {
      var q = cs[i], f0 = f(q[0]), f3 = f(q[3]);
      if (f0 === 0 && i > 0) return [cs.slice(0, i), cs.slice(i)];
      if (f0 * f3 <= 0 && f3 !== 0) {
        var lo = 0, hi = 1, neg0 = f0 < 0;
        for (var k = 0; k < 90; k++) { var m = (lo + hi) / 2; if ((f(cubicAt(q, m)) < 0) === neg0) lo = m; else hi = m; }
        var t = (lo + hi) / 2;
        if (t < 1e-12) return [cs.slice(0, i), cs.slice(i)];
        if (t > 1 - 1e-12) return [cs.slice(0, i + 1), cs.slice(i + 1)];
        var p = splitAt(q, t); return [cs.slice(0, i).concat([p[0]]), [p[1]].concat(cs.slice(i + 1))];
      }
      if (f3 === 0) return [cs.slice(0, i + 1), cs.slice(i + 1)];
    }
    return null;
  }
  function splitListAtX(cs, x) { return splitListBy(cs, function (p) { return p.x - x; }); }
  // 강체 변환 {c, s, tx, ty}: p → R·p + t
  var ID = { c: 1, s: 0, tx: 0, ty: 0 };
  function app(T, p) { return { x: T.c * p.x - T.s * p.y + T.tx, y: T.s * p.x + T.c * p.y + T.ty }; }
  function rotAbout(c, a) { var ca = Math.cos(a), sa = Math.sin(a); return { c: ca, s: sa, tx: c.x - ca * c.x + sa * c.y, ty: c.y - sa * c.x - ca * c.y }; }
  function compose(A, B) { return { c: A.c * B.c - A.s * B.s, s: A.s * B.c + A.c * B.s, tx: A.c * B.tx - A.s * B.ty + A.tx, ty: A.s * B.tx + A.c * B.ty + A.ty }; }   // A∘B
  function inverse(T) { return { c: T.c, s: -T.s, tx: -(T.c * T.tx + T.s * T.ty), ty: -(-T.s * T.tx + T.c * T.ty) }; }
  function mapList(cs, f) { return cs.map(function (q) { return q.map(f); }); }
  function revList(cs) { return cs.slice().reverse().map(function (q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }); }
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
  function cubicsOfPath(p) { var o = [], cur = p.commands[0].points[0]; p.commands.slice(1).forEach(function (c) { o.push([cp(cur), cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = c.points[2]; }); return o; }
  function flattenCubics(cs, n) { var out = []; cs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); }); return out; }
  function maxDevList(a, b) {   // 같은 매개화의 두 cubic 목록 표본 최대 거리
    if (a.length !== b.length) return Infinity;
    var m = 0; for (var i = 0; i < a.length; i++) for (var k = 0; k <= 8; k++) m = Math.max(m, dist(cubicAt(a[i], k / 8), cubicAt(b[i], k / 8)));
    return m;
  }

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
  function tuckOf(params) {
    var t = params && params.tuckCm;
    if (t === undefined || t === null) return TUCK_DEFAULT;
    return t;
  }

  function draftSleeveF(sleeveA, params) {
    var t = tuckOf(params);
    if (!fin(t) || !(t > 0) || t > TUCK_MAX + 1e-12) return fail("invalid-tuck", t);
    var r = readSleeveA(sleeveA);
    if (!r.ok) return r;
    var cubs = r.cubics, Ub = r.Ub, Uf = r.Uf, H = r.hemY, W = r.W, SP = cp(r.sp), X0 = SP.x;
    var xs = CUT_OFFSETS.map(function (o) { return X0 + o; });
    if (!(Ub.x < xs[0] - TOL && Uf.x > xs[3] + TOL)) return fail("width-too-narrow", W, true);
    // Ⓐ 소매산을 절개선 4개에서 다섯 호로 — 뒤 바깥 · 뒤 안쪽 띠 · 가운데 띠 · 앞 안쪽 띠 · 앞 바깥
    var arcs = [], rest = cubs;
    for (var i = 0; i < 4; i++) { var s = splitListAtX(rest, xs[i]); if (!s || !s[0].length || !s[1].length) return fail("no-cap-intersection", xs[i]); arcs.push(s[0]); rest = s[1]; }
    arcs.push(rest);
    var Pc = xs.map(function (x, k) { return cp(arcs[k + 1][0][0]); });   // 절개선 × 소매산
    var Hc = xs.map(function (x) { return { x: x, y: H }; });             // 절개선 × 소맷부리 = 기준점
    if (!(dist(SP, arcs[2][0][0]) > TOL && dist(SP, arcs[2][arcs[2].length - 1][3]) > TOL)) return fail("no-cap-intersection", "sp-on-cut");
    // 강체 회전: 앞(+x) = 양의 각, 뒤(−x) = 음의 각(y 아래 좌표에서 위쪽 끝이 바깥으로). 벌림 = 소매산 모서리 사이 현 t → θ = 2·asin(t / 2R).
    var R = Pc.map(function (p, k) { return dist(p, Hc[k]); });
    if (!R.every(function (v) { return t < 2 * v; })) return fail("tuck-too-large", t, true);
    var th = R.map(function (v) { return 2 * Math.asin(t / (2 * v)); });
    var T = [null, null, ID, null, null];
    T[3] = rotAbout(Hc[2], +th[2]);
    T[4] = compose(rotAbout(app(T[3], Hc[3]), +th[3]), T[3]);
    T[1] = rotAbout(Hc[1], -th[1]);
    T[0] = compose(rotAbout(app(T[1], Hc[0]), -th[0]), T[1]);
    // 각 턱: 중심 쪽 조각 cs · 바깥 조각 out · 바깥 방향 dir(+1 앞 / −1 뒤)
    var tucks = [
      { id: "back-outer", k: 0, cs: 1, out: 0, dir: -1 }, { id: "back-inner", k: 1, cs: 2, out: 1, dir: -1 },
      { id: "front-inner", k: 2, cs: 2, out: 3, dir: +1 }, { id: "front-outer", k: 3, cs: 3, out: 4, dir: +1 }
    ];
    var opened = {}, wedges = {};
    for (var w = 0; w < tucks.length; w++) {
      var tk = tucks[w], c = xs[tk.k], h = Hc[tk.k], P = Pc[tk.k], Tcs = T[tk.cs], Tout = T[tk.out], a = th[tk.k];
      var cornerIn = app(Tcs, P), cornerOut = app(Tout, P);
      opened[tk.id] = dist(cornerIn, cornerOut);
      if (!((cornerOut.x - cornerIn.x) * tk.dir > 0)) return fail("tuck-direction", tk.id);
      // 접힌 두 겹이 놓이는 중심 쪽 경계 M' = 기준점을 지나는 세로선을 중심 쪽으로 θ/2 돌린 선(Ⓐ 좌표)
      var Rm = rotAbout(h, -tk.dir * a / 2), mTop = app(Rm, { x: c, y: h.y - 1 });
      var fM = function (p) { return crossSign(h, mTop, p); };
      // 중심 쪽 조각의 Ⓐ 소매산 중 [M', 절개선] 부분 — 절개선 모서리에서 중심 쪽으로
      var csArc = arcs[tk.cs], sp1 = splitListBy(csArc, fM);
      if (!sp1) return fail("tuck-too-deep", tk.id, true);
      var portion = tk.dir > 0 ? sp1[1] : sp1[0];
      var pc2m = tk.dir > 0 ? revList(portion) : portion;   // P 에서 시작해 중심 쪽으로
      if (dist(pc2m[0][0], P) > JOIN) return fail("discontinuous", tk.id);
      var refl = function (p) { return { x: 2 * c - p.x, y: p.y }; };
      var half1 = mapList(pc2m, function (p) { return app(Tcs, refl(p)); });   // 접는 선(중심 쪽 변)을 거울로 펼친 첫 겹
      var half2 = mapList(revList(pc2m), function (p) { return app(Tout, p); });   // 바깥 조각과 같이 움직인 둘째 겹
      var Mjoin = dist(half1[half1.length - 1][3], half2[0][0]);
      if (!(Mjoin < 1e-7)) return fail("discontinuous", { tuck: tk.id, gap: Mjoin });
      half2[0][0] = cp(half1[half1.length - 1][3]);
      var mouth = half1.concat(half2);   // 중심 쪽 모서리 → 바깥 모서리
      wedges[tk.id] = { mouth: mouth, half1Len: cubicsLen(half1), half2Len: cubicsLen(half2), fold: cp(cornerIn), place: cp(cornerOut), mid: cp(half2[0][0]),
        pivot: app(Tcs, h), portionAEnd: cp(pc2m[pc2m.length - 1][3]), layerWidthCm: Math.abs(pc2m[pc2m.length - 1][3].x - c), angleDeg: a * 180 / Math.PI };
    }
    var pieceArcs = arcs.map(function (cs, k) { return mapList(cs, function (p) { return app(T[k], p); }); });
    var cap = [].concat(pieceArcs[0], revList(wedges["back-outer"].mouth), pieceArcs[1], revList(wedges["back-inner"].mouth),
      pieceArcs[2], wedges["front-inner"].mouth, pieceArcs[3], wedges["front-outer"].mouth, pieceArcs[4]);
    var joinGap = 0; for (var j2 = 1; j2 < cap.length; j2++) joinGap = Math.max(joinGap, dist(cap[j2 - 1][3], cap[j2][0]));
    if (!(joinGap < 1e-7)) return fail("discontinuous", joinGap);
    for (var j3 = 1; j3 < cap.length; j3++) cap[j3][0] = cp(cap[j3 - 1][3]);

    // ── 접은 상태(봉제 후) 확인: 조각 호를 역변환하면 Ⓐ 와 같고, 접힌 두 겹이 그 소매산 위에 놓인다 ──
    var foldDev = 0, layerDev = 0, foldG1 = 0;
    pieceArcs.forEach(function (cs, k) { foldDev = Math.max(foldDev, maxDevList(mapList(cs, function (p) { return app(inverse(T[k]), p); }), arcs[k])); });
    tucks.forEach(function (tk) {
      var wd = wedges[tk.id], c = xs[tk.k], h1n = Math.round(wd.mouth.length / 2), half1 = wd.mouth.slice(0, h1n), half2 = wd.mouth.slice(h1n);
      var invCs = inverse(T[tk.cs]), invOut = inverse(T[tk.out]);
      var csA = arcs[tk.cs], onA = function (p) {   // Ⓐ 중심 쪽 호까지 거리(표본 후 국소 이분 정밀화)
        var m = Infinity;
        csA.forEach(function (q) {
          var bi = 0, bd = Infinity;
          for (var i2 = 0; i2 <= 64; i2++) { var d0 = dist(p, cubicAt(q, i2 / 64)); if (d0 < bd) { bd = d0; bi = i2; } }
          var lo = Math.max(0, (bi - 1) / 64), hi = Math.min(1, (bi + 1) / 64);
          for (var it = 0; it < 60; it++) { var m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (dist(p, cubicAt(q, m1)) < dist(p, cubicAt(q, m2))) hi = m2; else lo = m1; }
          m = Math.min(m, bd, dist(p, cubicAt(q, (lo + hi) / 2)));
        });
        return m;
      };
      half1.forEach(function (q) { for (var k2 = 0; k2 <= 4; k2++) { var p = app(invCs, cubicAt(q, k2 / 4)); layerDev = Math.max(layerDev, onA({ x: 2 * c - p.x, y: p.y })); } });
      half2.forEach(function (q) { for (var k2 = 0; k2 <= 4; k2++) layerDev = Math.max(layerDev, onA(app(invOut, cubicAt(q, k2 / 4)))); });
      // 접은 상태 이음(절개선 모서리)의 G1 = Ⓐ 의 이음
      var left = arcs[tk.k], right = arcs[tk.k + 1];
      foldG1 = Math.max(foldG1, angleBetween(cubicD1(left[left.length - 1], 1), cubicD1(right[0], 0)));
    });
    if (!(foldDev < FOLD_TOL)) return fail("fold-mismatch", foldDev);
    if (!(foldG1 <= G1_TOL_DEG)) return fail("folded-cap-kink", foldG1, true);
    if (!(layerDev < FOLD_TOL)) return fail("fold-layer-mismatch", layerDev);

    // ── 외곽: 소매산(재단선) → 앞 옆선 → 소맷부리(조각별 강체 직선 5개) → 뒤 옆선 ──
    var B0 = { x: Ub.x, y: H }, F0 = { x: Uf.x, y: H };
    var UbM = app(T[0], Ub), UfM = app(T[4], Uf), B0M = app(T[0], B0), F0M = app(T[4], F0);
    var hemPts = [F0M, app(T[4], Hc[3]), app(T[3], Hc[2]), cp(Hc[1]), app(T[1], Hc[0]), B0M];
    // 기준점 공유 확인(같은 기준점에서 두 조각이 만난다 — 소맷부리는 벌어지지 않음)
    var hemShare = Math.max(dist(app(T[4], Hc[3]), app(T[3], Hc[3])), dist(app(T[3], Hc[2]), Hc[2]), dist(app(T[1], Hc[1]), Hc[1]), dist(app(T[1], Hc[0]), app(T[0], Hc[0])));
    if (!(hemShare < 1e-9)) return fail("hem-opened", hemShare);
    // 강체 직선(raw, 감사용): 기준점마다 조각 회전각만큼 꺾인다.
    var hemKinkDeg = []; for (var hk = 1; hk < 5; hk++) hemKinkDeg.push(angleBetween(sub(hemPts[hk], hemPts[hk - 1]), sub(hemPts[hk + 1], hemPts[hk])));
    var hemRawCm = 0; for (var hl = 0; hl < 5; hl++) hemRawCm += dist(hemPts[hl], hemPts[hl + 1]);
    // 최종 소맷부리(김님 2026-10-10 «자연스러운 곡선으로 처리해죠»): 6점(양 끝 옆선 끝 + 기준점 4)을 그대로 지나는 G1 곡선 — 점 이동·길이 맞춤 없음.
    var hemCs = throughCurve(hemPts);
    var hemG1 = 0; for (var hg = 1; hg < hemCs.length; hg++) hemG1 = Math.max(hemG1, angleBetween(cubicD1(hemCs[hg - 1], 1), cubicD1(hemCs[hg], 0)));
    if (!(hemG1 <= G1_TOL_DEG)) return fail("hem-g1-break", hemG1);
    var hk2 = []; hemCs.forEach(function (q) { for (var i3 = 0; i3 <= 120; i3++) hk2.push(kappa(q, i3 / 120)); });
    var hemInfl = inflectionCount(hk2);
    if (hemInfl > 0) return fail("hem-inflection", hemInfl, true);
    var hemCm = cubicsLen(hemCs), hemDev = 0;
    hemCs.forEach(function (q, j4) { var a4 = hemPts[j4], b4 = hemPts[j4 + 1], dd = sub(b4, a4), l4 = Math.sqrt(dd.x * dd.x + dd.y * dd.y);
      for (var i4 = 0; i4 <= 32; i4++) { var r4 = cubicAt(q, i4 / 32); hemDev = Math.max(hemDev, Math.abs(((r4.x - a4.x) * dd.y - (r4.y - a4.y) * dd.x) / l4)); } });
    var outline = [pathOf(cap, "cap"), L(UfM, F0M, "side-seam-front"), pathOf(hemCs, "hem"), L(B0M, UbM, "side-seam-back")];
    var loop = flattenCubics(cap, FLAT_N);
    flattenCubics(hemCs, FLAT_N).forEach(function (p) { loop.push(p); }); loop.push(cp(UbM));
    var closeGap = dist(loop[loop.length - 1], loop[0]);
    if (!(closeGap < JOIN)) return fail("discontinuous", closeGap);
    if (loopSelfIntersects(loop)) return fail("self-intersection");

    var construction = [L(SP, { x: X0, y: H }, "center-line")];
    tucks.forEach(function (tk) {
      var wd = wedges[tk.id];
      var f = L(wd.fold, wd.pivot, "tuck-fold"); f.tuck = tk.id; construction.push(f);     // 접는 선(중심 쪽 변) — 위층이 바깥으로 넘어간다
      var p = L(wd.place, wd.pivot, "tuck-place"); p.tuck = tk.id; construction.push(p);   // 맞출 선(바깥 변)
      var m2 = L(wd.mid, wd.pivot, "tuck-mid"); m2.tuck = tk.id; construction.push(m2);    // 안쪽 접힘(두 겹 사이) — 감사·표시용
    });

    var lens = capLengthsOf({ outline: outline, construction: construction });
    if (!lens) return fail("cap-unmeasured");
    var ahc = r.armholeCm, easeSewn = (ahc && fin(ahc.back) && fin(ahc.front)) ? { back: lens.sewn.back - ahc.back, front: lens.sewn.front - ahc.front, total: lens.sewn.total - ahc.back - ahc.front } : null;
    var am = sleeveA.meta, tuckMeta = {};
    tucks.forEach(function (tk) {
      var wd = wedges[tk.id];
      tuckMeta[tk.id] = { cutX: xs[tk.k], openedCm: opened[tk.id], rotationDeg: wd.angleDeg, pivot: cp(wd.pivot), fold: wd.fold, place: wd.place, mid: wd.mid,
        mouthCutCm: wd.half1Len + wd.half2Len, layerWidthCm: wd.layerWidthCm };
    });
    var bicepAfter = dist(UbM, UfM);
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p43-tucked-sleeve-F(2026-10-10)",
        widthCm: W, widthAfterCm: bicepAfter, sleeveLengthCm: r.sleeveLengthCm, hemCm: hemCm, hemBeforeCm: W,
        tuck: { perTuckCm: t, defaultCm: TUCK_DEFAULT, maxCm: TUCK_MAX, count: 4, totalCm: 4 * t, cutOffsetsCm: CUT_OFFSETS.slice(),
          measure: "소매산 위 두 모서리 사이 직선 거리 — 잠정 정의", order: "가운데 띠 고정 → 안쪽 띠(안쪽 기준점) → 바깥 조각(움직인 바깥 기준점)",
          direction: { quote: "바깥쪽으로 접는데 소매중심이 위로 올라와야해", fold: "중심 쪽 변", topLayer: "중심 쪽", underLayers: "중심 쪽 조각 아래 두 겹(각 반)" },
          stitchEnd: null, stitchEndStatus: "미확정(책에 없음) — 만들지 않음", tucks: tuckMeta },
        rotationDeg: { backInner: th[1] * 180 / Math.PI, backOuterRelative: th[0] * 180 / Math.PI, frontInner: th[2] * 180 / Math.PI, frontOuterRelative: th[3] * 180 / Math.PI,
          backOuterTotal: (th[0] + th[1]) * 180 / Math.PI, frontOuterTotal: (th[2] + th[3]) * 180 / Math.PI },
        folded: { capEqualsSleeveA: true, maxDevCm: foldDev, layersOnSeamMaxCm: layerDev, g1MaxDeg: foldG1,
          redraw: "불필요 — 턱을 접으면 조각이 Ⓐ 위치로 돌아가 소매산이 Ⓐ 와 같다(꺾임 없음)" },
        hem: { points: hemPts.map(cp), method: "6점(옆선 끝 2 + 기준점 4) 통과 G1 곡선 — 내부 접선 = 이웃 두 점 방향, 양 끝 = 현 대칭, 핸들 = 현/3(Ⓓ·Ⓔ 와 같은 결, 길이 맞춤 없음)",
          approvedBy: "김님 2026-10-10 «자연스러운 곡선으로 처리해죠»", g1MaxDeg: hemG1, inflections: hemInfl, maxDevFromRawCm: hemDev,
          lengthCm: hemCm, sleeveACm: W, diffFromSleeveACm: hemCm - W,
          raw: { kinkDeg: hemKinkDeg, lengthCm: hemRawCm, note: "강체 직선 5개(기준점 공유, 길이 = Ⓐ) — 감사용, 최종 외곽 아님" } },
        seams: { backCm: dist(UbM, B0M), frontCm: dist(UfM, F0M) },
        sp: cp(SP), capSplit: { point: cp(SP), rule: "가운데 띠 고정 — SP 그대로" },
        capHeightUnchanged: true,
        underarm: { before: { back: cp(Ub), front: cp(Uf) }, after: { back: cp(UbM), front: cp(UfM) } },
        capLengths: { sewn: lens.sewn, cut: lens.cut, measure: "Gauss-Legendre(final curve) · 봉제 = 쐐기 입구(접혀 들어가는 두 겹) 제외 · 앞/뒤 분할 = SP" },
        capLengthsA: am.capLengths ? JSON.parse(JSON.stringify(am.capLengths)) : null,
        armholeCm: ahc ? { back: ahc.back, front: ahc.front } : null,
        easeAfter: easeSewn, easeBasis: "턱을 접은(봉제 후) 소매산 길이 − AH (김님 확정)",
        easeSourceA: am.easeAfter ? JSON.parse(JSON.stringify(am.easeAfter)) : null,
        provisional: { tuckMeasure: "현(chord)", hemCurve: "끝점 통과 Hermite(접선 규칙·핸들 현/3)" },
        checks: { closed: true, connected: true, maxGapCm: Math.max(joinGap, closeGap), selfIntersection: false, singlePiece: true, hemSharedPivotsCm: hemShare, maxG1BreakDeg: hemG1 }
      },
      warnings: t > 2 ? ["inner-tuck-layers-overlap"] : [],
      sourceSleeveAHash: hashStr(JSON.stringify({ geometry: sleeveA.geometry, meta: sleeveA.meta }))
    };
  }

  // 최종 geometry 에서 소매산 길이 실측 — 재단(펼친 재단선 전체)과 봉제(턱 접음: 쐐기 입구 = 접는 선 모서리 ~ 맞출 선 모서리 제외).
  //   쐐기 입구 모서리 = construction tuck-fold / tuck-place 의 위 끝, 앞/뒤 분할 = center-line 위 끝(SP). 반환 {cut, sewn, split} | null.
  function capLengthsOf(geometry) {
    if (!geometry || !Array.isArray(geometry.outline) || !Array.isArray(geometry.construction)) return null;
    var capS = geometry.outline.filter(function (s) { return s && s.role === "cap" && s.kind === "path"; })[0];
    var cl = geometry.construction.filter(function (s) { return s.role === "center-line"; })[0];
    var folds = geometry.construction.filter(function (s) { return s.role === "tuck-fold"; }), places = geometry.construction.filter(function (s) { return s.role === "tuck-place"; });
    if (!capS || !cl || folds.length !== 4 || places.length !== 4) return null;
    var cs = cubicsOfPath(capS);
    // 이음점(anchor) 목록과 누적 길이
    var anchors = [cs[0][0]], acc = [0];
    cs.forEach(function (q) { anchors.push(q[3]); acc.push(acc[acc.length - 1] + cubicLen(q)); });
    var idxOf = function (p) { var best = -1, bd = Infinity; anchors.forEach(function (a, i) { var d = dist(a, p); if (d < bd) { bd = d; best = i; } }); return bd < 1e-6 ? best : -1; };
    var iSP = idxOf(cl.from);
    if (iSP <= 0 || iSP >= anchors.length - 1) return null;
    var total = acc[acc.length - 1], back = acc[iSP], front = total - back;
    var hidden = { back: 0, front: 0 };
    for (var k = 0; k < 4; k++) {
      var tk = folds[k].tuck, pl = places.filter(function (s) { return s.tuck === tk; })[0];
      if (!pl) return null;
      var a = idxOf(folds[k].from), b = idxOf(pl.from);
      if (a < 0 || b < 0 || a === b) return null;
      var lo = Math.min(a, b), hi = Math.max(a, b), seg = acc[hi] - acc[lo];
      if (hi <= iSP) hidden.back += seg; else if (lo >= iSP) hidden.front += seg; else return null;
    }
    return { cut: { back: back, front: front, total: total },
      sewn: { back: back - hidden.back, front: front - hidden.front, total: total - hidden.back - hidden.front }, split: cp(anchors[iSP]), splitIndex: iSP };
  }

  window.designSleeveF = Object.freeze({ draftSleeveF: draftSleeveF, readSleeveA: readSleeveA, capLengthsOf: capLengthsOf,
    RULES: Object.freeze({ cutOffsetsCm: Object.freeze(CUT_OFFSETS.slice()), tuckDefaultCm: TUCK_DEFAULT, tuckMaxCm: TUCK_MAX, foldTolCm: FOLD_TOL }) });
})();
