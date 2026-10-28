// ══════════════════════════════════════════════
// designSleeveR.js — 소매 Ⓡ 돌먼 슬리브([패턴학교] P.49 «몸판에 직접 제도한다»). 순수 · 시안(2026-10-27).
//
// ★ Ⓡ 는 소매 Ⓐ 에서 변형하지 않는다 — 책이 «새롭게 몸판과 소매를 제도»한다. 출발 = 완료 몸판 Ⓐ(P.14) 하나.
//   결과는 **파생 몸판(앞·뒤) + 한 장 소매**를 함께 가진 결합 파생이다(2026-10-04 결정 — bodiceResult 는 읽기만 · 절대 쓰지 않는다).
//
// 김님 확정(2026-10-27):
//   · 몸판 Ⓐ 만 지원 — 이름이 아니라 실제 형상으로 확인한다(완료본 앞·뒤 외곽·제도선 = 같은 원형의 Ⓐ 계산값, 여밈·페플럼·이음선 기록 없음).
//   · 앞 AH 다트는 박지 않고 새 진동 안쪽 여유로 흡수(다리선은 제도 참고로만 남는다).
//   · 소맷부리 아래 1.5: 소매 끝 E 에서 중심선과 직각으로 ● 만큼 내린 점 P(소매 밑선이 지나는 점) → 밑선을 따라 바깥으로 1.5 = 소맷부리 끝 C.
//   · 소매 밑점 U = 소매 폭선 위에서, 두 곡선 교차점 X 아래의 몸판 진동(X→옆선 WL 점)과 소매산(X→U) 봉제 길이가 같아지는 점(질문 A 권장안 가).
//     전체 소매산 이세는 0 으로 강제하지 않는다(교차점 위 구간은 각자 곡선 그대로 — 결과 이세는 실측 보고).
//   · 곡선(질문 B): 끝 방향을 정한 3차 곡선. 부푼 정도(핸들 = 현 × 계수)는 설정값.
//   · 팔꿈치 둘레 기본 22(P.8 참고 치수표) · 수정 가능. 커프스 달림 ● = 팔꿈치 둘레 + 4(기본 26).
// 책 수치(전부 설정값으로 수정 가능): 어깨 연장 5 · 옆 여유 뒤 3 / 앞 1.5 · 진동 아랫점 = WL · 소매 길이 26(새 SP 부터) ·
//   소매 폭선 = 새 SP 에서 중심선 따라 5 인 점의 직각선 · 소맷부리 아래 1.5.
// 구현 관례(책 수치 아님 · 설정값): 몸판 진동 핸들 0.4 · 소매산 핸들 1/3 (현재 시안 설정 — 책 확정 규칙 아님).
// 소맷부리 E→C: 두 끝 직각선(E: 중심선 직각 = 소맷부리 기준선 E→P 방향 · C: 밑선 직각)의 교점 I 를 모서리로 하는 곡선(2차 = 3차 표현,
//   제어점 E + ⅔(I−E) · C + ⅔(I−C)). 끝 방향은 그대로, 굽이는 하나(변곡 없음). 교점이 두 끝 앞쪽에 없으면 거부(2026-10-28 — 1/3 대칭 핸들의 S 굽이 보완).
//   몸판 진동의 옆선 쪽 끝 방향은 책에 없다 — 시작 접선(어깨 직각)을 현에 대해 거울로 둔 대칭 곡선(Ⓠ throughCurve 끝 규칙과 같은 관례).
//   ⚠ 이 끝 방향·기본 핸들 0.4 는 김님 미확인(1/3 이면 앞판에 교차점이 생기지 않는다) — meta.unconfirmed 에 기록.
// 길이는 최종 geometry 실측(Gauss-Legendre). 소매 좌표: 새 SP = (0,0), 중심선 = +y, 뒤 = −x, 앞 = +x(다른 소매와 같은 규약).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var DEFAULTS = Object.freeze({ shoulderExtCm: 5, backSideEaseCm: 3, frontSideEaseCm: 1.5, capHeightCm: 5, sleeveLengthCm: 26,
    elbowGirthCm: 22, cuffAddCm: 4, hemDropCm: 1.5, armholeHandle: 0.4, capHandle: 1 / 3 });
  var HANDLE_MIN = 0.2, HANDLE_MAX = 0.6;   // 구현 관례 입력 범위(양 끝 포함) — 밖은 사유와 함께 거부(clamp 없음)
  var PRESET_A = "bunka-bodice-A";
  var JOIN = 1e-9, LEN_TOL = 1e-6, NEAR_SP = 0.01;   // 교차 탐색은 새 SP 에서 양 곡선 호 1% 이후(같은 접선으로 출발하므로 SP 접점 제외)
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
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function unit(a) { var l = Math.hypot(a.x, a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function rot(p, c, a) { var d = sub(p, c), ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; }
  function angleDeg(u, v) { return Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * 180 / Math.PI; }
  function L(a, b, edge) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (edge) s.edge = edge; return s; }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return (h >>> 0).toString(16); }
  function canon(o) { return JSON.stringify(o, function (k, v) { return typeof v === "number" ? Math.round(v * 1e9) / 1e9 : v; }); }
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
  function cubicLen(q, t0, t1) {   // Gauss-Legendre 16점 · 구간을 8등분해 누적
    t0 = t0 || 0; t1 = t1 === undefined ? 1 : t1;
    var s = 0, n = 8;
    for (var k = 0; k < n; k++) {
      var a = t0 + (t1 - t0) * k / n, b = t0 + (t1 - t0) * (k + 1) / n, ss = 0;
      for (var i = 0; i < 16; i++) { var d = cubicD1(q, a + (b - a) * (GX[i] + 1) / 2); ss += GW[i] * Math.hypot(d.x, d.y); }
      s += ss * (b - a) / 2;
    }
    return s;
  }
  function tAtLen(q, s) { var lo = 0, hi = 1; for (var k = 0; k < 60; k++) { var m = (lo + hi) / 2; if (cubicLen(q, 0, m) < s) lo = m; else hi = m; } return (lo + hi) / 2; }
  // 두 끝 접선 직선의 교점 I(A + s·Ta = B − t·Tb, s·t > 0)를 모서리로 하는 곡선. 교점이 두 끝 앞쪽에 없으면 null.
  function cornerQ(A, Ta, B, Tb) {
    var D = cross(Ta, Tb), d = sub(B, A); if (Math.abs(D) < 1e-12) return null;
    var s = cross(d, Tb) / D, t = cross(Ta, d) / D; if (!(s > 0) || !(t > 0)) return null;
    var I = add(A, mul(Ta, s));
    return { q: [cp(A), add(A, mul(sub(I, A), 2 / 3)), add(B, mul(sub(I, B), 2 / 3)), cp(B)], corner: I, sCm: s, tCm: t };
  }
  function hermite(A, Ta, B, Tb, k) { var h = dist(A, B) * k; return [cp(A), add(A, mul(Ta, h)), sub(B, mul(Tb, h)), cp(B)]; }   // 끝점·접선 고정, 핸들 = 현 × k
  function mapQ(q, f) { return q.map(f); }
  function pathOf(cs, role) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (role) o.role = role; return o;
  }
  function revQ(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  function flatQ(q, n) { var o = []; for (var i = 0; i <= n; i++) o.push(cubicAt(q, i / n)); return o; }
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
  function segPts(s, n) {   // 몸판 외곽 한 조각 → 점열
    if (s.kind === "line") return [cp(s.from), cp(s.to)];
    var out = [], cur = null;
    s.commands.forEach(function (c) { if (c.type === "M") { cur = c.points[0]; out.push(cp(cur)); } else if (c.type === "C") { var q = [cur, c.points[0], c.points[1], c.points[2]]; for (var k = 1; k <= n; k++) out.push(cubicAt(q, k / n)); cur = c.points[2]; } });
    return out;
  }
  function endsOf(s) { var p = segPts(s, 1); return [p[0], p[p.length - 1]]; }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }

  // ── 몸판 Ⓐ 게이트: 이름이 아니라 형상(같은 원형에서 계산한 Ⓐ 와 외곽·제도선이 같아야 한다) ──
  function gateBodiceA(bodice, aGeometry) {
    if (!bodice || typeof bodice !== "object" || !bodice.front || !bodice.back || !bodice.armhole) return fail("no-bodice");
    if (!aGeometry || !aGeometry.front || !aGeometry.back) return fail("bodice-a-reference-missing");
    var extra = ["placket", "frontPeplum", "backPeplum", "waistSeam", "flareSlash"].filter(function (k) { return bodice[k] !== undefined && bodice[k] !== null; });
    if (extra.length) return fail("bodice-not-a", { why: "design-records", keys: extra });
    var diff = [];
    ["front", "back"].forEach(function (pc) {
      if (canon(bodice[pc].outline) !== canon(aGeometry[pc].outline)) diff.push(pc + ".outline");
      if (canon(bodice[pc].construction || []) !== canon(aGeometry[pc].construction || [])) diff.push(pc + ".construction");
    });
    if (diff.length) return fail("bodice-not-a", { why: "shape-differs-from-A", parts: diff });
    return { ok: true, presetId: PRESET_A, rule: "bodiceResult 앞·뒤 외곽·제도선 = 같은 원형 기준 Ⓐ 계산값(1e-9 반올림 비교) · 여밈·페플럼·이음선·플레어 기록 없음" };
  }

  // ── 몸판 한 쪽 읽기(Ⓐ 형상 전제 — 게이트 통과 후) ──
  function edgeSegs(pc, edge) { return pc.outline.filter(function (s) { return s.edge === edge; }); }
  function rootSegs(pc, piece, name) { return pc.outline.filter(function (s) { return s.boundary && s.boundary.root === piece + "/" + name; }); }   // 경계 identity(«-extension» 구분)
  function readPiece(bodice, piece) {
    var pc = bodice[piece], neck = edgeSegs(pc, "neckline"), side = rootSegs(pc, piece, "side-seam"), sideExt = rootSegs(pc, piece, "side-seam-extension"),
      hem = edgeSegs(pc, "hem"), center = rootSegs(pc, piece, "center").concat(rootSegs(pc, piece, "center-extension")), sh = edgeSegs(pc, "shoulder");
    if (neck.length !== 1 || side.length !== 1 || sideExt.length !== 1 || hem.length !== 1 || center.length !== 2 || !sh.length) return fail("bodice-read-failed", { piece: piece });
    var se = endsOf(side[0]), U0 = se[0].y < se[1].y ? se[0] : se[1], WP = se[0].y < se[1].y ? se[1] : se[0];
    var he = endsOf(hem[0]), hemY = he[0].y;
    if (Math.abs(he[1].y - hemY) > JOIN || Math.abs(U0.x - WP.x) > JOIN) return fail("bodice-read-failed", { piece: piece, why: "side-or-hem" });
    var cHem = Math.abs(he[0].x - WP.x) > Math.abs(he[1].x - WP.x) ? he[0] : he[1];   // 중심 쪽 밑단 끝
    var ne = endsOf(neck[0]), shPts = []; sh.forEach(function (s) { endsOf(s).forEach(function (p) { shPts.push(p); }); });
    var SNP = shPts.some(function (p) { return dist(p, ne[0]) < JOIN; }) ? ne[0] : ne[1];
    return { ok: true, neck: neck[0], center: center, SNP: cp(SNP), sideX: WP.x, waist: cp(WP), underarm0: cp(U0), hemY: hemY, centerHem: cp(cHem) };
  }

  // ── 두 cubic 의 교차(새 SP 접점 제외): 점열 후보 → Newton 정밀화 ──
  function crossingsOf(qa, qb) {
    var N = 400, A = flatQ(qa, N), B = flatQ(qb, N), skip = Math.ceil(N * NEAR_SP), out = [];
    for (var i = skip; i < N; i++) for (var j = skip; j < N; j++) {
      if (!segCross(A[i], A[i + 1], B[j], B[j + 1])) continue;
      var ta = (i + 0.5) / N, tb = (j + 0.5) / N;
      for (var it = 0; it < 40; it++) {   // qa(ta) = qb(tb)
        var F = sub(cubicAt(qa, ta), cubicAt(qb, tb)), da = cubicD1(qa, ta), db = cubicD1(qb, tb), det = -da.x * db.y + db.x * da.y;
        if (Math.abs(det) < 1e-14) break;
        var dta = (-F.x * db.y + db.x * F.y) / det, dtb = (da.x * F.y - da.y * F.x) / det;
        ta -= dta; tb -= dtb;
        if (Math.abs(dta) < 1e-15 && Math.abs(dtb) < 1e-15) break;
      }
      if (!(ta > 0 && ta < 1 && tb > 0 && tb < 1)) continue;
      if (out.some(function (o) { return Math.abs(o.ta - ta) < 1e-6; })) continue;
      out.push({ ta: ta, tb: tb, pt: cubicAt(qa, ta), angleDeg: angleDeg(cubicD1(qa, ta), cubicD1(qb, tb)) });
    }
    return out;
  }

  // ── 한 쪽(뒤/앞) 제도: 몸판 좌표 ──
  function draftHalf(bodice, piece, rb, p) {
    var r = readPiece(bodice, piece); if (!r.ok) return r;
    var R = rb[piece], out = piece === "back" ? +1 : -1;   // 옆선 바깥 방향(x) — 뒤 = +x(중심 x=0 반대), 앞 = −x
    // 뒤: 어깨 다트를 닫아 진동 쪽으로 벌린다(소매 Ⓐ 판독과 같은 닫힘 변환 — 중심 고정 · 진동 쪽 회전). 앞: AH 다트는 박지 않는다(김님 확정) — SP 보관 좌표 그대로.
    var SP, closure = null;
    if (piece === "back") {
      if (!R.closedShoulderDart) return fail("back-shoulder-dart-not-found");
      SP = cp(R.shoulder); closure = { apex: cp(R.closedShoulderDart.apex), angleRad: R.closedShoulderDart.angleRad, mouthResidualCm: R.closedShoulderDart.mouthResidualCm, shoulderStored: cp(R.shoulderStored) };
    } else {
      if (R.closedShoulderDart) return fail("bodice-read-failed", { piece: piece, why: "front-shoulder-dart" });
      SP = cp(R.shoulderStored);
    }
    var u = unit(sub(SP, r.SNP)); if (!u) return fail("bodice-read-failed", { piece: piece, why: "shoulder" });
    var n = { x: -u.y, y: u.x }; if (n.y < 0) n = mul(n, -1);   // 중심선 직각 · 몸 쪽(아래)
    var SPn = add(SP, mul(u, p.shoulderExtCm)), E = add(SPn, mul(u, p.sleeveLengthCm)), W0 = add(SPn, mul(u, p.capHeightCm));
    var S = { x: r.sideX + out * (piece === "back" ? p.backSideEaseCm : p.frontSideEaseCm), y: r.waist.y };
    // 몸판 진동: 새 SP(어깨 직각 n) → 옆선 WL 점. 끝 접선 = 시작 접선의 현 대칭(구현 관례).
    var ch = unit(sub(S, SPn)), Tend = sub(mul(ch, 2 * dot(n, ch)), n);
    var bq = hermite(SPn, n, S, Tend, p.armholeHandle);
    var capOf = function (d) { var U = add(W0, mul(n, d)); return hermite(SPn, n, U, n, p.capHandle); };   // 소매산: 새 SP(n) → U(소매 폭선 방향 n)
    var bLen = cubicLen(bq);
    var evalD = function (d) {
      var cq = capOf(d), xs = crossingsOf(bq, cq);
      if (xs.length !== 1) return { n: xs.length };
      var x = xs[0], lb = cubicLen(bq, x.ta, 1), lc = cubicLen(cq, x.tb, 1);
      return { n: 1, f: lc - lb, x: x, cq: cq, lb: lb, lc: lc };
    };
    // U 탐색: 소매 폭선 위 거리 d ∈ [0.5, 2] × |S − 새 SP| 를 0.25cm 로 훑어 부호 변화(교차 1개 구간) 하나를 찾고 이분법.
    var c0 = dist(S, SPn), roots = [], prev = null;
    for (var d = 0.5 * c0; d <= 2 * c0 + 1e-9; d += 0.25) {
      var e = evalD(d);
      if (e.n === 1 && prev && prev.e.n === 1 && (e.f > 0) !== (prev.e.f > 0)) roots.push([prev.d, d]);
      prev = { d: d, e: e };
    }
    if (roots.length !== 1) return fail(roots.length ? "underarm-point-not-unique" : "underarm-point-not-found",
      { piece: piece, note: "소매 폭선 위에서 «교차점 아래 길이 같음» 해가 " + roots.length + "개 — 교차점이 없거나(두 곡선이 새 SP 에서만 닿음) 여럿", armholeHandle: p.armholeHandle, capHandle: p.capHandle });
    var lo = roots[0][0], hi = roots[0][1], flo = evalD(lo).f;
    for (var it = 0; it < 80; it++) {
      var m = (lo + hi) / 2, em = evalD(m);
      if (em.n !== 1) return fail("underarm-point-not-found", { piece: piece, why: "crossing-lost-in-bisection" });
      if ((em.f > 0) === (flo > 0)) { lo = m; flo = em.f; } else hi = m;
    }
    var dU = (lo + hi) / 2, sol = evalD(dU);
    if (sol.n !== 1 || Math.abs(sol.f) > LEN_TOL) return fail("underarm-length-unmatched", { piece: piece, residual: sol.f });
    var U = add(W0, mul(n, dU)), cq = sol.cq;
    // 소맷부리: E 에서 n 으로 ● → P(소매 밑선이 지나는 점) · 밑선 U→P 를 바깥으로 1.5 연장 = C · 소맷부리 E→C(E: 중심선 직각, C: 밑선 직각).
    var dot0 = p.cuffCm, P = add(E, mul(n, dot0)), ua = unit(sub(P, U));
    if (!ua || !(dot(ua, u) > 0)) return fail("underarm-line-invalid", { piece: piece, note: "소매 밑선(U→P)이 소맷부리 쪽으로 가지 않음" });
    var C = add(P, mul(ua, p.hemDropCm)), tC = { x: -ua.y, y: ua.x }; if (dot(tC, sub(C, E)) < 0) tC = mul(tC, -1);
    var kc = cornerQ(E, n, C, tC);
    if (!kc) return fail("cuff-corner-conflict", { piece: piece, note: "소맷부리의 두 끝 직각선(E 중심선 직각 · C 밑선 직각)이 두 끝 앞쪽에서 만나지 않아 굽이 하나의 곡선을 만들 수 없음", hemDropCm: p.hemDropCm });
    var kq = kc.q;
    var lower = { crossing: cp(sol.x.pt), crossingAngleDeg: sol.x.angleDeg, armholeLowerCm: sol.lb, capLowerCm: sol.lc, residualCm: sol.f,
      armholeUpperCm: cubicLen(bq, 0, sol.x.ta), capUpperCm: cubicLen(cq, 0, sol.x.tb), tArmhole: sol.x.ta, tCap: sol.x.tb };
    return { ok: true, piece: piece, read: r, SP0: SP, SPn: SPn, u: u, n: n, E: E, W0: W0, U: U, dU: dU, S: S, P: P, C: C,
      armholeQ: bq, capQ: cq, cuffQ: kq, cuffCorner: kc, armholeLen: bLen, capLen: cubicLen(cq), cuffLen: cubicLen(kq), underarmLen: dist(U, C), lower: lower,
      closure: closure, tangents: { armholeStart: n, armholeEnd: Tend, capStart: n, capEnd: n } };
  }

  // 파생 몸판 한 장(몸판 좌표): 목둘레·중심선은 원형 그대로 · 어깨 = 목옆점 → 새 SP 직선 · 새 진동 · 새 옆선(WL → 밑단) · 밑단.
  function derivedPiece(h) {
    var r = h.read, hemS = { x: h.S.x, y: r.hemY };
    var cExt = r.center.filter(function (s) { var e = endsOf(s); return Math.max(e[0].y, e[1].y) > r.waist.y + JOIN; })[0], cTop = r.center.filter(function (s) { return s !== cExt; })[0];
    var neck = JSON.parse(JSON.stringify(r.neck)), arm = pathOf([h.armholeQ]); arm.edge = "armhole";
    var outline = [neck, L(r.SNP, h.SPn, "shoulder"), arm, L(h.S, hemS, "side-seam"), L(hemS, r.centerHem, "hem"), JSON.parse(JSON.stringify(cExt)), JSON.parse(JSON.stringify(cTop))];
    // 닫힌 점열: 목둘레(중심 → 목옆) → 어깨 → 진동 → 옆선 → 밑단 → 중심선(밑 → 위)
    var np = segPts(r.neck, 48); if (dist(np[np.length - 1], r.SNP) > JOIN) np.reverse();
    var loop = np.concat([cp(h.SPn)], flatQ(h.armholeQ, 64).slice(1), [cp(hemS), cp(r.centerHem)]);
    var cTopE = endsOf(cTop), top = dist(cTopE[0], np[0]) < JOIN ? cTopE[0] : cTopE[1];
    loop.push({ x: r.centerHem.x, y: r.waist.y }); loop.push(cp(top));
    var gap = dist(loop[0], loop[loop.length - 1]);
    return { outline: outline, loop: loop, closeGapCm: gap, selfIntersection: loopSelfIntersects(loop) };
  }

  // 입력: bodice = 완료 몸판(bodiceResult, 읽기 전용) · aGeometry = 같은 원형에서 계산한 몸판 Ⓐ 형상(게이트 비교용) · params(없으면 책 기본값).
  function draftSleeveR(bodice, aGeometry, params) {
    var SA = window.designSleeveA;
    if (!SA || !SA.readBodiceArmhole) return fail("no-module");
    var p = {}, bad = [];
    Object.keys(DEFAULTS).forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? DEFAULTS[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (!(p.shoulderExtCm > 0) || !(p.capHeightCm > 0) || !(p.sleeveLengthCm > p.capHeightCm) || !(p.elbowGirthCm > 0)) return fail("input-out-of-range", { rule: "어깨 연장 > 0 · 소매 폭선 위치 > 0 · 소매 길이 > 소매 폭선 위치 · 팔꿈치 둘레 > 0" });
    if (p.backSideEaseCm < 0 || p.frontSideEaseCm < 0 || p.cuffAddCm < 0 || p.hemDropCm < 0) return fail("input-out-of-range", { rule: "옆 여유 · 커프스 더하기 · 소맷부리 아래 ≥ 0" });
    if (p.armholeHandle < HANDLE_MIN || p.armholeHandle > HANDLE_MAX || p.capHandle < HANDLE_MIN || p.capHandle > HANDLE_MAX) return fail("handle-out-of-range", { min: HANDLE_MIN, max: HANDLE_MAX });
    p.cuffCm = p.elbowGirthCm + p.cuffAddCm;
    var g = gateBodiceA(bodice, aGeometry); if (!g.ok) return g;
    var rb = SA.readBodiceArmhole(bodice); if (!rb || !rb.ok) return fail("bodice-read-failed", rb && rb.reason);
    var hb = draftHalf(bodice, "back", rb, p); if (!hb.ok) return hb;
    var hf = draftHalf(bodice, "front", rb, p); if (!hf.ok) return hf;
    var db = derivedPiece(hb), df = derivedPiece(hf);
    if (db.closeGapCm > JOIN || df.closeGapCm > JOIN) return fail("discontinuous", { back: db.closeGapCm, front: df.closeGapCm });
    if (db.selfIntersection || df.selfIntersection) return fail("bodice-self-intersection", { back: db.selfIntersection, front: df.selfIntersection });
    // 한 장 소매: 뒤 반쪽 Tb(q) = (−n·v, u·v), 앞 반쪽 Tf(q) = (n·v, u·v), v = q − 새 SP — 둘 다 회전(거울 아님), 중심선이 x=0 에서 맞닿는다.
    var Tb = function (q) { var v = sub(q, hb.SPn); return { x: -dot(hb.n, v), y: dot(hb.u, v) }; };
    var Tf = function (q) { var v = sub(q, hf.SPn); return { x: dot(hf.n, v), y: dot(hf.u, v) }; };
    var capB = revQ(mapQ(hb.capQ, Tb)), capF = mapQ(hf.capQ, Tf), cufB = mapQ(hb.cuffQ, Tb), cufF = mapQ(hf.cuffQ, Tf);   // capB: U_b → SP · cufB: E → C_b
    var Ub = Tb(hb.U), Uf = Tf(hf.U), Cb = Tb(hb.C), Cf = Tf(hf.C), Es = Tb(hb.E), Ef = Tf(hf.E);
    if (dist(Es, Ef) > JOIN || Math.abs(Es.x) > JOIN) return fail("center-butt-mismatch", { back: Es, front: Ef });
    var cap = pathOf([capB, capF], "cap"), hemPath = pathOf([revQ(cufF), cufB], "hem");   // 소맷부리: C_f → E → C_b
    var outline = [cap, { kind: "line", from: cp(Uf), to: cp(Cf), role: "underarm-front" }, hemPath, { kind: "line", from: cp(Cb), to: cp(Ub), role: "underarm-back" }];
    var loop = flatQ(capB, 48).concat(flatQ(capF, 48).slice(1), [cp(Cf)], flatQ(revQ(cufF), 48).slice(1), flatQ(cufB, 48).slice(1), [cp(Ub)]);
    var sGap = dist(loop[0], loop[loop.length - 1]);
    if (sGap > JOIN) return fail("discontinuous", { sleeve: sGap });
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    var g1 = function (q1, q2) { return angleDeg(cubicD1(q1, 1), cubicD1(q2, 0)); };
    var construction = [
      { kind: "line", from: { x: 0, y: 0 }, to: cp(Es), role: "center-line" },                       // ◎ 앞뒤 중심선 맞댐(한 장 — 솔기 아님)
      { kind: "line", from: cp(Ub), to: cp(Uf), role: "width-line" },                                  // 소매 폭선(새 SP 에서 중심선 따라 소매 폭선 위치)
      { kind: "line", from: cp(Es), to: Tb(hb.P), role: "cuff-guide" }, { kind: "line", from: cp(Es), to: Tf(hf.P), role: "cuff-guide" }   // 소맷부리 직선 기준 ●
    ];
    var shoulderLen = { back: dist(hb.read.SNP, hb.SPn), front: dist(hf.read.SNP, hf.SPn) };
    var neckM1 = null;   // 뒤 어깨 직선화 관찰: 목 쪽 다트 입구가 목옆점 → 새 SP 직선에서 떨어진 거리(원형 다리 비대칭 잔여 — 보정 없음)
    var bShN = edgeSegs(bodice.back, "shoulder").filter(function (s) { var e = endsOf(s); return dist(e[0], hb.read.SNP) < JOIN || dist(e[1], hb.read.SNP) < JOIN; })[0];
    var shoulderFigure = null;   // 비교 그림(표시 전용 · 형상 보정 없음): 닫기 전 두 구간 · 닫은 뒤 진동 쪽 구간 · 최종 직선 · 목 쪽 입구의 직선 이탈
    if (bShN) {
      var e1 = endsOf(bShN), M1 = dist(e1[0], hb.read.SNP) < JOIN ? e1[1] : e1[0]; neckM1 = Math.abs(cross(hb.u, sub(M1, hb.read.SNP)));
      var SPs = hb.closure.shoulderStored, bShA = edgeSegs(bodice.back, "shoulder").filter(function (s) { var e = endsOf(s); return dist(e[0], SPs) < JOIN || dist(e[1], SPs) < JOIN; })[0];
      if (bShA && bShA !== bShN) {
        var e2 = endsOf(bShA), M2 = dist(e2[0], SPs) < JOIN ? e2[1] : e2[0], ang = hb.closure.angleRad, ap = hb.closure.apex;
        shoulderFigure = { SNP: cp(hb.read.SNP), neckMouth: cp(M1), armMouth: cp(M2), spStored: cp(SPs), apex: cp(ap),
          armMouthClosed: rot(M2, ap, ang), spClosed: rot(SPs, ap, ang), spNew: cp(hb.SPn),
          foot: add(hb.read.SNP, mul(hb.u, dot(hb.u, sub(M1, hb.read.SNP)))), neckMouthOffLineCm: neckM1 };
      }
    }
    // 맞춤 표시 자리(표시 전용): 교차점 X 아래 구간(몸판 진동 X→S · 소매산 X→U)의 길이 중점 — 이분법(엔진 길이와 같은 Gauss 측정).
    var midT = function (q, t0) { var L0 = cubicLen(q, t0, 1) / 2, lo = t0, hi = 1; for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (cubicLen(q, t0, m) < L0) lo = m; else hi = m; } return (lo + hi) / 2; };
    var matchOf = function (h, T) {
      var aMid = cubicAt(h.armholeQ, midT(h.armholeQ, h.lower.tArmhole)), cMid = cubicAt(h.capQ, midT(h.capQ, h.lower.tCap));
      return { armholeMid: aMid, capMid: cMid, sleeve: { X: T(h.lower.crossing), capMid: T(cMid) } };
    };
    var half = function (h, T) {
      return { match: matchOf(h, T), sp: cp(h.SP0), spNew: cp(h.SPn), E: cp(h.E), W0: cp(h.W0), U: cp(h.U), widthLineCm: h.dU, S: cp(h.S), P: cp(h.P), C: cp(h.C),
        armholeCm: h.armholeLen, capCm: h.capLen, easeCm: h.capLen - h.armholeLen, cuffCurveCm: h.cuffLen, cuffGuideCm: p.cuffCm, underarmCm: h.underarmLen,
        lower: h.lower, sleevePoints: { U: T(h.U), C: T(h.C), P: T(h.P), E: T(h.E), X: T(h.lower.crossing), corner: T(h.cuffCorner.corner) } };
    };
    var cuffTotal = hb.cuffLen + hf.cuffLen;
    var cuffCurveOf = function (h) {   // 소맷부리 곡선 기록: 교점 I(소맷부리 기준선 E→P 위 거리) · I→C · 현 · 현에서 몸 쪽으로 파인 최대 깊이
      var ch = sub(h.C, h.E), cl = Math.hypot(ch.x, ch.y), nr = { x: -ch.y / cl, y: ch.x / cl }, sag = 0;
      flatQ(h.cuffQ, 200).forEach(function (q) { sag = Math.max(sag, Math.abs(dot(sub(q, h.E), nr))); });
      return { corner: cp(h.cuffCorner.corner), cornerOnGuideCm: h.cuffCorner.sCm, cornerToCCm: h.cuffCorner.tCm, chordCm: cl, sagCm: sag };
    };
    var draftLayer = function (h) {   // 몸판 좌표 제도 레이어(표시 전용): 몸판 위에 그린 소매 반쪽 · 소매 폭선 · 소맷부리 기준 · 교차점
      return { armhole: pathOf([h.armholeQ]), cap: pathOf([h.capQ]), cuff: pathOf([h.cuffQ]), center: L(h.SPn, h.E), shoulderExt: L(h.SP0, h.SPn), width: L(h.W0, h.U),
        cuffGuide: L(h.E, h.P), underarm: L(h.U, h.C), cuffCorner: cp(h.cuffCorner.corner), crossing: cp(h.lower.crossing), U: cp(h.U), S: cp(h.S), spNew: cp(h.SPn), sp: cp(h.SP0), E: cp(h.E), C: cp(h.C), P: cp(h.P),
        newSide: L({ x: h.S.x, y: h.read.underarm0.y }, h.S), oldUnderarm: cp(h.read.underarm0) };
    };
    var dlB = draftLayer(hb), dlF = draftLayer(hf);
    dlB.closure = hb.closure;
    return {
      ok: true,
      geometry: { outline: outline, construction: construction, capSplit: { x: 0 } },
      derivedBodice: { back: { outline: db.outline }, front: { outline: df.outline } },
      meta: {
        rule: "pattern-school-p49-dolman-R(2026-10-27 draft)",
        settings: { inputs: JSON.parse(JSON.stringify(p)), defaults: JSON.parse(JSON.stringify(DEFAULTS)), handleRange: { min: HANDLE_MIN, max: HANDLE_MAX, inclusive: true }, cuffCurve: "tangent-corner" },
        gate: g,
        sleeveLengthCm: p.sleeveLengthCm, capHeightCm: p.capHeightCm, widthCm: hb.dU + hf.dU,
        back: half(hb, Tb), front: half(hf, Tf),
        cap: { back: hb.capLen, front: hf.capLen, total: hb.capLen + hf.capLen },
        armhole: { back: hb.armholeLen, front: hf.armholeLen, total: hb.armholeLen + hf.armholeLen },
        ease: { back: hb.capLen - hb.armholeLen, front: hf.capLen - hf.armholeLen, total: hb.capLen + hf.capLen - hb.armholeLen - hf.armholeLen,
          note: "결과 이세(소매산 − 새 몸판 진동, 실측) — 0 으로 맞추지 않음. 교차점 아래는 같은 길이(규칙), 교차점 위는 각 곡선 그대로" },
        cuff: { attachCm: p.cuffCm, gatherReferenceCm: p.cuffCm, formulaHemCm: 2 * p.cuffCm, measuredHemCm: cuffTotal, gatherActualCm: cuffTotal - p.cuffCm,
          curve: { construction: "tangent-corner", back: cuffCurveOf(hb), front: cuffCurveOf(hf), note: "E 중심선 직각 · C 밑선 직각 두 직선의 교점 I 를 모서리로 한 곡선(굽이 하나) — 시안" },
          note: "커프스 달림 ● = 팔꿈치 둘레 + 4 · 개더 참고 = ●×1(책) · 소맷부리 식 = 2● (직선 기준) · 실측 = 최종 소맷부리 곡선 · 실제 개더 = 실측 − 커프스 달림" },
        seams: {
          underarm: { back: hb.underarmLen, front: hf.underarmLen, diffCm: hb.underarmLen - hf.underarmLen, note: "소매 밑선(앞·뒤를 맞대 박는 솔기) — 길이 맞춤 강제 없음(실측)" },
          shoulder: { back: shoulderLen.back, front: shoulderLen.front, diffCm: shoulderLen.back - shoulderLen.front, note: "몸판 어깨(목옆점 → 새 SP) — 보정 없음(패턴 확정 단계 책임)" },
          side: { back: hb.read.hemY - hb.S.y, front: hf.read.hemY - hf.S.y, note: "몸판 옆선(WL → 밑단)" },
          center: { back: p.sleeveLengthCm, front: p.sleeveLengthCm, note: "앞뒤 소매 중심선 — 맞대어 한 장(솔기 아님)" }
        },
        joints: { capAtSP: g1(capB, capF), hemAtCenter: g1(revQ(cufF), cufB), cuffAtCornerBackDeg: angleDeg(cubicD1(hb.cuffQ, 1), sub(hb.C, hb.U)), cuffAtCornerFrontDeg: angleDeg(cubicD1(hf.cuffQ, 1), sub(hf.C, hf.U)) },
        backShoulder: { closure: hb.closure, neckMouthOffLineCm: neckM1, figure: shoulderFigure, note: "뒤 어깨 다트를 닫고(중심 고정 · 진동 쪽 회전) 어깨를 목옆점 → 새 SP 직선으로 — 목 쪽 입구의 직선 이탈은 관찰값" },
        frontDart: { sewn: false, apex: rb.front.closedDart ? cp(rb.front.closedDart.apex) : null, note: "앞 AH 다트는 박지 않고 새 진동 안쪽 여유로 흡수(김님 확정 2026-10-27) — 다리선은 제도 참고" },
        draftLayer: { back: dlB, front: dlF },
        unconfirmed: [
          "몸판 진동의 옆선 쪽 끝 방향(시작 접선의 현 대칭 — 구현 관례)",
          "기본 몸판 진동 핸들 0.4(1/3 이면 앞판 교차점이 생기지 않음)",
          "소맷부리 곡선 = 두 끝 직각선 교점 모서리 곡선(시안 · 2026-10-28 S 굽이 보완)"
        ],
        checks: { closed: true, connected: true, maxGapCm: Math.max(sGap, db.closeGapCm, df.closeGapCm), selfIntersection: false, bodiceSelfIntersection: false, singlePiece: true, piecesOverlap: false }
      },
      warnings: [],
      sourceBodiceHash: bodice.hash || null
    };
  }

  window.designSleeveR = Object.freeze({ draftSleeveR: draftSleeveR, gateBodiceA: gateBodiceA,
    RULES: Object.freeze({ defaults: DEFAULTS, handleMin: HANDLE_MIN, handleMax: HANDLE_MAX, bodicePresetId: PRESET_A }) });
})();
