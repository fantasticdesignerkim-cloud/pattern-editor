// ══════════════════════════════════════════════
// designSleeveT.js — 소매 Ⓣ 셔츠 슬리브([패턴학교] P.50 «몸판에 직접 제도한다(소매산 높이 = 평균 어깨 길이의 3/4)» · 제도 방법 P.140–141). 순수 · 시안(2026-10-28).
//
// ★ Ⓣ 는 소매 Ⓐ 공식(뒤 AH+0.4 / 앞 AH−0.6 · 볼록 1.8 · 이세 5%)도, Ⓡ 파생 몸판(어깨 연장·옆 여유·WL 진동)도 쓰지 않는다.
//   출발 = 완료 몸판 Ⓐ(P.51 «아래 예는 몸판 Ⓐ(P.14)를 사용한다») — Ⓡ 와 같은 형상 게이트(designSleeveR.gateBodiceA)를 재사용한다.
//   결과 = **파생 몸판(앞 AH 다트 → 옆 다트) + 한 장 소매**(결합 파생 · bodiceResult 는 읽기만).
//
// 책(F) — P.50 본문·도해 · P.140–141 단계:
//   1 앞 몸판의 AH 다트를 이동한다: 옆선 위 점(진동 아랫점에서 3 — «치수는 적당하게»)과 BP 를 잇고, AH 다트를 닫아 그 위치를 벌린다(옆 다트).
//     P.140 ② · P.50 도해: 위(어깨) 쪽은 그대로, 아래 옆 조각(진동 아래 · 옆선 위 3)이 BP 를 축으로 돈다.
//   2 경사: 몸판 어깨선을 SP 에서 연장 → 8 인 점에서 직각으로 뒤 4 / 앞 3.4 → Ⓐ/Ⓑ. 소매 중심선 = SP 와 Ⓐ/Ⓑ 를 이어 연장(소매길이).
//     소매산 높이 ◉ = SP 에서 중심선을 따라 · 소매 폭선 = ◉ 에서 중심선 직각 · 소맷부리선 = 소매길이 끝에서 중심선 직각.
//     ◉ = 평균 어깨 길이 × 3/4 — 평균 어깨 길이는 P.137 «소매산 높이 결정하는 법» 1·2(Ⓣ~Ⓦ 도 같은 방법, 비율만 다름):
//     앞뒤 진동 둘레를 다트를 닫은 봉제 상태로 베껴 진동 아랫점에서 SP 까지의 수직 거리 평균. 측정은 같은 P.137 판독기(designSleeveA.readBodiceArmhole)를 쓴다.
//   3 소매산: SP 부터 자연스러운 곡선으로 몸판 진동 둘레와 **같은 치수**가 되도록 소매 폭선에 잇는다 → 그 점 = 소매 아랫점.
//     몸판 진동과 «살짝만» 차이: 위쪽 0.7(뒤·앞) · 앞 아래 0.5 · 진동 둘레와 만나는 위치(★)는 «적절히» 찾는다.
//     소매 밑의 안내선 = 소매 아랫점에서 소매 폭선에 직각.
//   4 소맷부리 폭 = 소매 폭의 3/4(뒤) → 안내선 끝에서 ● 만큼 잘라 소매 밑선(소매 아랫점 ↔ 소맷부리)을 긋는다.
//   7 앞 소맷부리: «뒤 소매와 같은 분량(●)을 자른다».
//   마지막에 앞뒤 중심선을 맞댄다(P.157) → 한 장 소매. 소매산에 여유분 줄임 없음(P.51 서두).
//
// 책 수치 = 설정값(수정 가능): 경사 8 · 뒤 4 · 앞 3.4 · 소매산 높이 비율 3/4 · 옆 다트 위치 3 · 소매산 차이 0.7 / 앞 0.5 · 소맷부리 비율 3/4.
// 구현 관례(책 수치 아님 · 설정값 · 김님 미확인 — meta.unconfirmed):
//   · 소매산 곡선 = 몸판 진동 둘레 위 기준점을 지나는 3차 곡선 이음: SP → (★ 앞 구간 가운데에서 진동 법선으로 +0.7, 몸판 안쪽) → ★1
//     [→ (★1–★2 가운데에서 −0.5, 소매 쪽) → ★2] → 소매 아랫점. 가운데 점의 접선 = 그 자리 진동 접선(진동과 평행) · ★ 접선 = 앞뒤 점 방향(교차) ·
//     SP 접선 = 소매 중심선 직각(앞뒤 공통 직선 — 맞댄 한 장 소매가 SP 에서 꺾이지 않는 조건) · 소매 아랫점 접선 = 이웃 접선의 현 대칭 · 핸들 = 현 × 1/3.
//   · ★ 위치 = 몸판 진동 호 길이 비율(뒤 ★1 0.6 · 앞 ★1 0.5 · ★2 0.8 — 도해 눈대중).
//   · 소매 아랫점 = 소매 폭선 위에서 «소매산 길이 = 몸판 진동 길이»가 되는 점(유일 해 · 이분법). 0 으로 맞추는 대상은 이세(책: 여유분 줄임 없음).
// 길이는 최종 geometry 실측(Gauss-Legendre). 소매 좌표: SP = (0,0), 중심선 = +y, 뒤 = −x, 앞 = +x(다른 소매와 같은 규약).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var DEFAULTS = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 4, frontSlopeDropCm: 3.4, capHeightRatio: 0.75, sideDartDropCm: 3,
    capOutCm: 0.7, frontCapInCm: 0.5, cuffRatio: 0.75, backStar: 0.6, frontStar1: 0.5, frontStar2: 0.8 });
  // 소매 Ⓤ(P.51 «Ⓣ 와 같이 제도한다» · 소매산 높이 = 평균 어깨 길이 × 1/2) — 같은 키 · 같은 순서. 책 수치(F): 경사 8 ⟂ 뒤 1.3 / 앞 0.5 · 1/2 ·
  //   소매산 차이 뒤 위 0.5 · 앞 위 0.5 · 앞 아래 0.5. 나머지는 Ⓣ 승계: 옆 다트 3(P.140 «적당하게») · 소맷부리 뒤 폭 × 3/4 · 앞 = 폭 − ●(김님 지시 2026-10-29) · ★ 위치(Ⓣ 관례).
  var DEFAULTS_U = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 1.3, frontSlopeDropCm: 0.5, capHeightRatio: 0.5, sideDartDropCm: 3,
    capOutCm: 0.5, frontCapInCm: 0.5, cuffRatio: 0.75, backStar: 0.6, frontStar1: 0.5, frontStar2: 0.8 });
  var KEYS = ["sleeveLengthCm"].concat(Object.keys(DEFAULTS));
  var JOIN = 1e-9, SAME = 1e-3, LEN_TOL = 1e-6, MOUTH_TOL = 0.1;
  var GX = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374,
    0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
  var GW = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685,
    0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function dot(a, b) { return a.x * b.x + a.y * b.y; }
  function cross(a, b) { return a.x * b.y - a.y * b.x; }
  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function unit(a) { var l = Math.hypot(a.x, a.y); return l > 1e-15 ? { x: a.x / l, y: a.y / l } : null; }
  function rot(p, c, a) { var d = sub(p, c), ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; }
  function angleDeg(u, v) { return Math.atan2(Math.abs(cross(u, v)), dot(u, v)) * 180 / Math.PI; }
  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function L(a, b, edge) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (edge) s.edge = edge; return s; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function fail(reason, detail) { var o = { ok: false, reason: reason }; if (detail !== undefined) o.detail = detail; return o; }
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
  function chainLen(cs) { var s = 0; cs.forEach(function (q) { s += cubicLen(q); }); return s; }
  function revQ(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  function mapQ(q, f) { return q.map(f); }
  function flatQ(q, n) { var o = []; for (var i = 0; i <= n; i++) o.push(cubicAt(q, i / n)); return o; }
  function pathOf(cs, role) {
    var cmds = [{ type: "M", points: [cp(cs[0][0])] }];
    cs.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var o = { kind: "path", commands: cmds }; if (role) o.role = role; return o;
  }
  function cubicsOf(s) {   // 몸판 외곽 한 조각 → cubic 목록(직선은 같은 직선의 cubic)
    if (s.kind === "line") return [[cp(s.from), add(s.from, mul(sub(s.to, s.from), 1 / 3)), add(s.from, mul(sub(s.to, s.from), 2 / 3)), cp(s.to)]];
    var out = [], cur = null;
    s.commands.forEach(function (c) {
      if (c.type === "M") cur = cp(c.points[0]);
      else if (c.type === "C") { out.push([cur, cp(c.points[0]), cp(c.points[1]), cp(c.points[2])]); cur = cp(c.points[2]); }
      else if (c.type === "L") { var p = cp(c.points[0]); out.push([cur, add(cur, mul(sub(p, cur), 1 / 3)), add(cur, mul(sub(p, cur), 2 / 3)), p]); cur = p; }
    });
    return out;
  }
  function endsOf(s) { var c = cubicsOf(s); return [c[0][0], c[c.length - 1][3]]; }
  function mapSeg(s, f) {   // 외곽 조각의 모든 점을 f 로 옮긴 사본(속성 유지)
    var o = clone(s);
    if (o.kind === "line") { o.from = f(o.from); o.to = f(o.to); } else o.commands.forEach(function (c) { c.points = c.points.map(f); });
    return o;
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

  // 외곽 조각들을 끝점으로 이어 닫힌 점열(마지막 = 처음)로 — 조각마다 한 번, 방향은 필요하면 뒤집는다.
  function orderLoop(ol) {
    var left = ol.slice(1), pts = [], first = cubicsOf(ol[0]), gap = 0;
    first.forEach(function (q, i) { flatQ(q, 24).slice(i ? 1 : 0).forEach(function (x) { pts.push(x); }); });
    while (left.length) {
      var end = pts[pts.length - 1], bi = -1, bd = Infinity, rev = false;
      left.forEach(function (s, i) { var e = endsOf(s), d0 = dist(e[0], end), d1 = dist(e[1], end); if (d0 < bd) { bd = d0; bi = i; rev = false; } if (d1 < bd) { bd = d1; bi = i; rev = true; } });
      gap = Math.max(gap, bd);
      var cs = cubicsOf(left[bi]); if (rev) cs = cs.reverse().map(revQ);
      cs.forEach(function (q) { flatQ(q, 24).slice(1).forEach(function (x) { pts.push(x); }); });
      left.splice(bi, 1);
    }
    gap = Math.max(gap, dist(pts[0], pts[pts.length - 1]));
    return { ok: gap <= 1e-6, loop: pts, gapCm: gap };
  }

  // ── 진동 체인(SP → 진동 아랫점) 위 호 길이 위치 → 점·접선 ──
  function chainAt(cs, s) {
    var acc = 0;
    for (var i = 0; i < cs.length; i++) {
      var l = cubicLen(cs[i]);
      if (s <= acc + l || i === cs.length - 1) { var t = tAtLen(cs[i], Math.max(0, Math.min(l, s - acc))); return { pt: cubicAt(cs[i], t), tan: unit(cubicD1(cs[i], t)) }; }
      acc += l;
    }
    return null;
  }
  function reflectAcross(T, ch) { return unit(sub(mul(ch, 2 * dot(T, ch)), T)); }   // 접선 T 를 현 방향 ch 에 대해 거울(현 대칭)

  // ── 앞 몸판: AH 다트를 닫아 옆으로 이동(P.140 1) ──
  function moveFrontDart(front, p) {
    var legs = (front.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "armhole"; });
    if (legs.length !== 2) return fail("front-ah-dart-not-found", { legs: legs.length });
    var role = function (l) { var r = l.dart.attach && l.dart.attach.root; return /armhole-upper$/.test(r) ? "upper" : /armhole-lower$/.test(r) ? "lower" : null; };
    var up = legs.filter(function (l) { return role(l) === "upper"; })[0], lo = legs.filter(function (l) { return role(l) === "lower"; })[0];
    if (!up || !lo) return fail("front-ah-dart-not-found", { why: "leg-roles" });
    var apexOf = function (l) { return l.dart.apexAt === "from" ? cp(l.from) : cp(l.to); }, mouthOf = function (l) { return l.dart.apexAt === "from" ? cp(l.to) : cp(l.from); };
    var BP = apexOf(up); if (dist(BP, apexOf(lo)) > 1e-6) return fail("front-ah-dart-not-found", { why: "apex" });
    var upM = mouthOf(up), loM = mouthOf(lo);
    var seg = function (root) { return front.outline.filter(function (s) { return s.boundary && s.boundary.root === "front/" + root; }); };
    var aUp = seg("armhole-upper"), aLo = seg("armhole-lower"), side = seg("side-seam"), sh = front.outline.filter(function (s) { return s.edge === "shoulder"; });
    if (aUp.length !== 1 || aLo.length !== 1 || side.length !== 1 || sh.length !== 1) return fail("bodice-read-failed", { piece: "front" });
    var se = endsOf(side[0]), Us = se[0].y < se[1].y ? se[0] : se[1], WP = se[0].y < se[1].y ? se[1] : se[0];
    var upE = endsOf(aUp[0]), loE = endsOf(aLo[0]);
    var SP = dist(upE[0], upM) < MOUTH_TOL ? upE[1] : upE[0];
    if (!(dist(loE[0], Us) < SAME || dist(loE[1], Us) < SAME) || !(dist(upE[0], upM) < MOUTH_TOL || dist(upE[1], upM) < MOUTH_TOL)) return fail("bodice-read-failed", { piece: "front", why: "armhole-ends" });
    var U0 = dist(loE[0], Us) < SAME ? cp(loE[0]) : cp(loE[1]);   // 진동 아랫점 = 진동 끝점(옆선 위 끝과 ~3e-4 원형 데이터 잔차 — 새 옆선은 이 점에서 다시 긋는다)
    if (!(p.sideDartDropCm > 0) || !(p.sideDartDropCm < WP.y - U0.y)) return fail("side-dart-out-of-range", { maxCm: WP.y - U0.y });
    var S3 = { x: U0.x, y: U0.y + p.sideDartDropCm };
    // 아래 옆 조각(진동 아래 · 옆선 위 3)을 BP 축으로 돌려 아래 입구를 위 입구에 맞춘다(위쪽 고정).
    var ang = wrapPi(Math.atan2(upM.y - BP.y, upM.x - BP.x) - Math.atan2(loM.y - BP.y, loM.x - BP.x));
    var R = function (q) { return rot(q, BP, ang); };
    var resid = dist(R(loM), upM); if (resid > MOUTH_TOL) return fail("front-ah-dart-unclosable", { residualCm: resid });
    var lowerArm = mapSeg(aLo[0], R), U1 = R(U0), S3r = R(S3);
    // 진동 체인 SP → 위 입구 → (닫힌) 아래 조각 → 새 진동 아랫점 U1
    var upC = cubicsOf(aUp[0]); if (dist(upC[0][0], SP) > SAME) upC = upC.reverse().map(revQ);
    var loC = cubicsOf(lowerArm); if (dist(loC[0][0], U1) < SAME) loC = loC.reverse().map(revQ);
    loC[0][0] = cp(upC[upC.length - 1][3]);   // 닫힌 입구 잔차(관찰값 resid)는 위 입구로 붙인다 — 같은 점으로 이어진 체인
    var neck = front.outline.filter(function (s) { return s.edge === "neckline"; })[0], hem = front.outline.filter(function (s) { return s.edge === "hem"; })[0];
    var rest = front.outline.filter(function (s) { return s !== aLo[0] && s !== side[0]; }).map(clone);
    var outline = rest.concat([pathOf(loC.slice().reverse().map(revQ)), L(U1, S3r, "side-seam"), L(S3r, BP, "dart-leg"), L(BP, S3, "dart-leg"), L(S3, WP, "side-seam")]);
    var armIdx = rest.length; outline[armIdx].edge = "armhole"; outline[armIdx].boundary = clone(aLo[0].boundary);
    outline[armIdx + 2].dart = outline[armIdx + 3].dart = { id: "front-side-dart", boundary: "side-seam", from: "front-bust" };
    return { ok: true, outline: outline, chain: upC.concat(loC), SP: cp(SP), BP: BP, angleRad: ang, mouthResidualCm: resid, U0: cp(U0), U1: U1, S3: S3, S3r: S3r, WP: cp(WP),
      upperMouth: upM, lowerMouth: loM, sideDart: { apex: BP, legs: [S3r, S3], widthCm: dist(S3r, S3), angleDeg: Math.abs(ang) * 180 / Math.PI },
      neck: neck, hem: hem };
  }
  function backChain(back) {
    var arm = back.outline.filter(function (s) { return s.edge === "armhole"; }), side = back.outline.filter(function (s) { return s.boundary && s.boundary.root === "back/side-seam"; });
    var sh = back.outline.filter(function (s) { return s.boundary && s.boundary.root === "back/shoulder-armhole"; });
    if (arm.length !== 1 || side.length !== 1 || sh.length !== 1) return fail("bodice-read-failed", { piece: "back" });
    var se = endsOf(side[0]), Us = se[0].y < se[1].y ? se[0] : se[1];
    var c = cubicsOf(arm[0]); if (dist(c[0][0], Us) < SAME) c = c.reverse().map(revQ);
    if (dist(c[c.length - 1][3], Us) > SAME) return fail("bodice-read-failed", { piece: "back", why: "armhole-ends" });
    return { ok: true, chain: c, SP: cp(c[0][0]), U0: cp(c[c.length - 1][3]), shoulderSeg: sh[0] };
  }

  // ── 한 쪽 소매 반쪽(몸판 좌표) ──
  // chain = SP → 진동 아랫점 cubic · shoulderFrom = 어깨선 위 SP 반대쪽 점 · drop = 경사 직각(뒤 4 / 앞 3.4) · stars/bumps = 소매산 기준(관례)
  function draftHalf(piece, chain, shoulderFrom, drop, capH, p, bumps, centerX) {
    var SP = cp(chain[0][0]), Lb = chainLen(chain);
    var us = unit(sub(SP, shoulderFrom)); if (!us) return fail("bodice-read-failed", { piece: piece, why: "shoulder" });
    var body = { x: centerX - SP.x, y: 0 }, nsh = { x: -us.y, y: us.x }; if (nsh.y < 0) nsh = mul(nsh, -1);   // 어깨선 직각 · 아래(몸 쪽)
    var K8 = add(SP, mul(us, p.slopeRunCm)), KA = add(K8, mul(nsh, drop));   // Ⓐ/Ⓑ
    var u = unit(sub(KA, SP));
    var n = { x: -u.y, y: u.x }; if (dot(n, body) < 0) n = mul(n, -1);   // 중심선 직각 · 몸판 쪽(소매 밑 쪽)
    var E = add(SP, mul(u, p.sleeveLengthCm)), W0 = add(SP, mul(u, capH));
    // 소매산 기준점: 가운데 점 = 진동 위 점 + 법선 × 차이(+ = 몸판 안쪽), ★ = 진동 위 점
    var inward = function (tan, pt) { var nn = { x: -tan.y, y: tan.x }; return dot(nn, { x: centerX - pt.x, y: 0 }) > 0 ? nn : mul(nn, -1); };
    var keys = [{ pt: SP, tan: null, kind: "SP" }], s0 = 0;
    bumps.forEach(function (b) {
      var mid = chainAt(chain, Lb * (s0 + b.to) / 2), star = chainAt(chain, Lb * b.to);
      keys.push({ pt: add(mid.pt, mul(inward(mid.tan, mid.pt), b.offsetCm)), tan: mid.tan, kind: "bump", offsetCm: b.offsetCm, base: mid.pt, sCm: Lb * (s0 + b.to) / 2 });
      keys.push({ pt: star.pt, tan: null, kind: "star", sCm: Lb * b.to });
      s0 = b.to;
    });
    var build = function (U) {
      var ks = keys.concat([{ pt: U, tan: null, kind: "U" }]), T = ks.map(function (k) { return k.tan; });
      for (var i = 1; i < ks.length - 1; i++) if (!T[i]) T[i] = unit(sub(ks[i + 1].pt, ks[i - 1].pt));   // ★: 앞뒤 점 방향
      T[0] = cp(n);   // SP 접선 = 소매 중심선 직각(소매 폭선과 평행) — 앞뒤를 맞댄 한 장 소매에서 SP 가 꺾이지 않는다(앞뒤 같은 직선)
      var m = ks.length - 1; T[m] = reflectAcross(T[m - 1], unit(sub(ks[m].pt, ks[m - 1].pt)));
      var cs = [];
      for (var j = 0; j < m; j++) { var h = dist(ks[j].pt, ks[j + 1].pt) / 3; cs.push([cp(ks[j].pt), add(ks[j].pt, mul(T[j], h)), sub(ks[j + 1].pt, mul(T[j + 1], h)), cp(ks[j + 1].pt)]); }
      return cs;
    };
    // 소매 아랫점: 소매 폭선 위 d 를 0.25cm 로 훑어 «소매산 − 진동 = 0» 부호 변화 하나 → 이분법.
    //   탐색 범위는 마지막 ★ 보다 바깥(폭선 방향 투영) — 그 안쪽 해는 소매산이 중심 쪽으로 되돌아가는 고리(종이 위에서 불가능)라 후보가 아니다.
    var f = function (d) { return chainLen(build(add(W0, mul(n, d)))) - Lb; };
    var dMin = Math.max(0.25, dot(sub(keys[keys.length - 1].pt, W0), n)), roots = [], prev = null, dMax = 2 * Lb;
    for (var d = dMin; d <= dMax + 1e-9; d += 0.25) { var v = f(d); if (prev && (v > 0) !== (prev.v > 0)) roots.push([prev.d, d]); prev = { d: d, v: v }; }
    if (roots.length !== 1) return fail(roots.length ? "underarm-point-not-unique" : "underarm-point-not-found", { piece: piece, roots: roots.length, intervals: roots, note: "소매 폭선 위에서 «소매산 = 몸판 진동 길이» 해가 " + roots.length + "개" });
    var lo = roots[0][0], hi = roots[0][1], flo = f(lo);
    for (var it = 0; it < 80; it++) { var mm = (lo + hi) / 2, fm = f(mm); if ((fm > 0) === (flo > 0)) { lo = mm; flo = fm; } else hi = mm; }
    var dU = (lo + hi) / 2, U = add(W0, mul(n, dU)), cap = build(U), capLen = chainLen(cap);
    if (Math.abs(capLen - Lb) > LEN_TOL) return fail("cap-length-unmatched", { piece: piece, residual: capLen - Lb });
    var G = add(E, mul(n, dU));   // 소매 밑 안내선(소매 아랫점에서 폭선 직각 = 중심선 평행) 끝
    var dev = { maxOutCm: 0, maxInCm: 0 };   // 소매산이 진동에서 떨어진 실측(진동 점열 최근접 거리 · 부호 = 몸판 안쪽 +)
    var armPts = []; chain.forEach(function (q, i) { flatQ(q, 200).slice(i ? 1 : 0).forEach(function (x) { armPts.push(x); }); });
    cap.slice(0, cap.length - 1).forEach(function (q) {
      flatQ(q, 120).forEach(function (x) {
        var best = null; for (var k = 1; k < armPts.length; k++) { var a = armPts[k - 1], b = armPts[k], ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(x, a), ab) / dot(ab, ab))), pr = add(a, mul(ab, t)), dd = dist(x, pr); if (!best || dd < best.d) best = { d: dd, pr: pr, tan: unit(ab) }; }
        var sg = dot(sub(x, best.pr), inward(best.tan, best.pr)) >= 0 ? 1 : -1;
        if (sg > 0) dev.maxOutCm = Math.max(dev.maxOutCm, best.d); else dev.maxInCm = Math.max(dev.maxInCm, best.d);
      });
    });
    return { ok: true, piece: piece, SP: SP, us: us, nsh: nsh, K8: K8, KA: KA, u: u, n: n, E: E, W0: W0, U: U, dU: dU, G: G, cap: cap, capLen: capLen, armholeLen: Lb, keys: keys, deviation: dev, chain: chain };
  }

  // 입력: bodice = 완료 몸판(bodiceResult, 읽기 전용) · aGeometry = 같은 원형에서 계산한 몸판 Ⓐ 형상(게이트 비교용) · params(sleeveLengthCm 필수, 나머지는 책 기본값).
  // V = 라인 설정(기본값 · 규칙 이름 · 문구) — Ⓣ 와 Ⓤ 가 같은 기하 절차를 쓴다(P.51 «Ⓣ 와 같이»).
  function draftShirt(bodice, aGeometry, params, V) {
    var SA = window.designSleeveA, SR = window.designSleeveR;
    if (!SA || !SA.readBodiceArmhole || !SR || !SR.gateBodiceA) return fail("no-module");
    var p = {}, bad = [];
    KEYS.forEach(function (k) { var v = params && params[k]; p[k] = (v === undefined || v === null) ? V.defaults[k] : v; if (!fin(p[k])) bad.push(k); });
    if (bad.length) return fail("invalid-input", { keys: bad });
    if (!(p.slopeRunCm > 0) || !(p.backSlopeDropCm > 0) || !(p.frontSlopeDropCm > 0) || !(p.capHeightRatio > 0) || !(p.cuffRatio > 0) || !(p.cuffRatio <= 1)) return fail("input-out-of-range", { rule: "경사 8 · 뒤/앞 직각 > 0 · 소매산 높이 비율 > 0 · 0 < 소맷부리 비율 ≤ 1" });
    if (p.capOutCm < 0 || p.frontCapInCm < 0) return fail("input-out-of-range", { rule: "소매산 차이 ≥ 0" });
    if (!(p.backStar > 0 && p.backStar < 1 && p.frontStar1 > 0 && p.frontStar1 < p.frontStar2 && p.frontStar2 < 1)) return fail("input-out-of-range", { rule: "★ 위치(진동 호 비율): 0 < 뒤 ★ < 1 · 0 < 앞 ★1 < 앞 ★2 < 1" });
    var g = SR.gateBodiceA(bodice, aGeometry); if (!g.ok) return g;
    var rb = SA.readBodiceArmhole(bodice); if (!rb || !rb.ok) return fail("bodice-read-failed", rb && rb.reason);
    // ◉ = 평균 어깨 길이 × 3/4 (P.137 1·2 — 다트를 닫은 봉제 상태의 SP → 진동 아랫점 수직 거리)
    var avg = (rb.back.heightCm + rb.front.heightCm) / 2, capH = avg * p.capHeightRatio;
    if (!(p.sleeveLengthCm > capH)) return fail("sleeve-length-too-short", { capHeightCm: capH });
    var mf = moveFrontDart(bodice.front, p); if (!mf.ok) return mf;
    var bc = backChain(bodice.back); if (!bc.ok) return bc;
    var fShoulder = bodice.front.outline.filter(function (s) { return s.edge === "shoulder"; })[0], fe = endsOf(fShoulder), fFrom = dist(fe[0], mf.SP) < SAME ? fe[1] : fe[0];
    var be = endsOf(bc.shoulderSeg), bFrom = dist(be[0], bc.SP) < SAME ? be[1] : be[0];
    if (dist(be[0], bc.SP) > SAME && dist(be[1], bc.SP) > SAME) return fail("bodice-read-failed", { piece: "back", why: "shoulder-sp" });
    var cxB = 0, cxF = bodice.front.outline.filter(function (s) { return s.boundary && s.boundary.root === "front/center"; }).map(function (s) { return s.from.x; })[0];
    if (!fin(cxF)) return fail("bodice-read-failed", { piece: "front", why: "center" });
    var hb = draftHalf("back", bc.chain, bFrom, p.backSlopeDropCm, capH, p, [{ to: p.backStar, offsetCm: p.capOutCm }], cxB); if (!hb.ok) return hb;
    var hf = draftHalf("front", mf.chain, fFrom, p.frontSlopeDropCm, capH, p, [{ to: p.frontStar1, offsetCm: p.capOutCm }, { to: p.frontStar2, offsetCm: -p.frontCapInCm }], cxF); if (!hf.ok) return hf;
    // 소맷부리: 뒤 = 뒤 소매 폭 × 3/4 · ● = 뒤 소매 폭 − 뒤 소맷부리 · 앞 = 앞 소매 폭 − ●(뒤와 같은 분량을 자른다)
    var cut = hb.dU * (1 - p.cuffRatio), cB = hb.dU - cut, cF = hf.dU - cut;
    if (!(cF > 0)) return fail("front-cuff-nonpositive", { frontWidthCm: hf.dU, cutCm: cut });
    var Cb = add(hb.E, mul(hb.n, cB)), Cf = add(hf.E, mul(hf.n, cF));
    // 한 장 소매: 뒤 Tb(q) = (−n·v, u·v) · 앞 Tf(q) = (n·v, u·v), v = q − SP(회전 — 거울 아님). 중심선이 x=0 에서 맞닿는다(P.157 맞댄다).
    var Tb = function (q) { var v = sub(q, hb.SP); return { x: -dot(hb.n, v), y: dot(hb.u, v) }; };
    var Tf = function (q) { var v = sub(q, hf.SP); return { x: dot(hf.n, v), y: dot(hf.u, v) }; };
    var capB = hb.cap.map(function (q) { return revQ(mapQ(q, Tb)); }).reverse(), capF = hf.cap.map(function (q) { return mapQ(q, Tf); });   // capB: U_b → SP
    var Ub = Tb(hb.U), Uf = Tf(hf.U), Cbs = Tb(Cb), Cfs = Tf(Cf), Eb = Tb(hb.E), Ef = Tf(hf.E);
    if (dist(Eb, Ef) > JOIN || Math.abs(Eb.x) > JOIN) return fail("center-butt-mismatch", { back: Eb, front: Ef });
    var cap = pathOf(capB.concat(capF), "cap");
    var outline = [cap, { kind: "line", from: cp(Uf), to: cp(Cfs), role: "underarm-front" }, { kind: "line", from: cp(Cfs), to: cp(Cbs), role: "hem" }, { kind: "line", from: cp(Cbs), to: cp(Ub), role: "underarm-back" }];
    var loop = []; capB.concat(capF).forEach(function (q, i) { flatQ(q, 48).slice(i ? 1 : 0).forEach(function (x) { loop.push(x); }); });
    loop.push(cp(Cfs)); loop.push(cp(Cbs)); loop.push(cp(Ub));
    var sGap = dist(loop[0], loop[loop.length - 1]);
    if (sGap > JOIN) return fail("discontinuous", { sleeve: sGap });
    if (loopSelfIntersects(loop)) return fail("self-intersection");
    // 파생 몸판: 뒤 = 원본 그대로(어깨 다트 열린 채 — 도해) · 앞 = AH 다트를 옆으로(열린 옆 다트 = 현재 외곽선)
    var derivedBodice = { back: { outline: bodice.back.outline.map(clone) }, front: { outline: mf.outline } };
    var fl = orderLoop(mf.outline);
    if (!fl.ok) return fail("discontinuous", { front: fl.gapCm });
    if (loopSelfIntersects(fl.loop)) return fail("bodice-self-intersection", { front: true });
    var construction = [
      { kind: "line", from: { x: 0, y: 0 }, to: cp(Eb), role: "center-line" },                       // ◎ 앞뒤 중심선 맞댐(한 장 — 솔기 아님)
      { kind: "line", from: cp(Ub), to: cp(Uf), role: "width-line" },                                  // 소매 폭선(SP 에서 ◉)
      { kind: "line", from: cp(Ub), to: Tb(hb.G), role: "underarm-guide" }, { kind: "line", from: cp(Uf), to: Tf(hf.G), role: "underarm-guide" },   // 소매 밑 안내선(폭선 직각)
      { kind: "line", from: cp(Eb), to: Tb(hb.G), role: "cuff-guide" }, { kind: "line", from: cp(Ef), to: Tf(hf.G), role: "cuff-guide" }   // 소맷부리선(중심선 직각) · ● 잘라 냄
    ];
    // 맞춤 표시: 마지막 ★ 의 진동 호 위치를 기준으로 진동·소매산 모두 SP 에서 같은 호 길이(봉제 순서 그대로 · 앞 | · 뒤 ‖)
    var notchOf = function (h, T, kStar) {
      var s = h.keys.filter(function (k) { return k.kind === "star"; }).slice(-1)[0].sCm, a = chainAt(h.chain, s), c = chainAt(h.cap, s);
      return { sCm: s, armhole: a.pt, cap: c.pt, offsetCm: dist(a.pt, c.pt), sleeve: T(c.pt), mark: kStar };
    };
    var nB = notchOf(hb, Tb, "‖"), nF = notchOf(hf, Tf, "|");
    var g1 = function (q1, q2) { return angleDeg(cubicD1(q1, 1), cubicD1(q2, 0)); };
    var half = function (h, T, cuffCm, notch) {
      return { sp: cp(h.SP), slope: { run: cp(h.K8), point: cp(h.KA), runCm: p.slopeRunCm, dropCm: dist(h.K8, h.KA) }, E: cp(h.E), W0: cp(h.W0), U: cp(h.U), G: cp(h.G),
        widthCm: h.dU, cuffCm: cuffCm, armholeCm: h.armholeLen, capCm: h.capLen, easeCm: h.capLen - h.armholeLen, underarmCm: dist(h.U, add(h.E, mul(h.n, cuffCm))),
        slopeDeg: Math.atan2(dist(h.K8, h.KA), p.slopeRunCm) * 180 / Math.PI, deviation: h.deviation, notch: notch,
        keys: h.keys.map(function (k) { var o = { kind: k.kind, pt: cp(k.pt) }; if (k.sCm !== undefined) o.sCm = k.sCm; if (k.offsetCm !== undefined) o.offsetCm = k.offsetCm; if (k.base) o.base = cp(k.base); return o; }),
        sleevePoints: { U: T(h.U), E: T(h.E), G: T(h.G), W0: T(h.W0), notch: notch.sleeve } };
    };
    var draftLayer = function (h, cuffCm, notch) {   // 몸판 좌표 제도 레이어(표시 전용)
      var C = add(h.E, mul(h.n, cuffCm));
      return { armhole: pathOf(h.chain), cap: pathOf(h.cap), center: L(h.SP, h.E), shoulderExt: L(h.SP, h.K8), slopeDrop: L(h.K8, h.KA), width: L(h.W0, h.U),
        underarmGuide: L(h.U, h.G), cuffLine: L(h.E, h.G), underarm: L(h.U, C), sp: cp(h.SP), K8: cp(h.K8), KA: cp(h.KA), W0: cp(h.W0), U: cp(h.U), E: cp(h.E), G: cp(h.G), C: C,
        stars: h.keys.filter(function (k) { return k.kind === "star"; }).map(function (k) { return cp(k.pt); }),
        bumps: h.keys.filter(function (k) { return k.kind === "bump"; }).map(function (k) { return { base: cp(k.base), pt: cp(k.pt), offsetCm: k.offsetCm }; }),
        notch: { armhole: cp(notch.armhole), cap: cp(notch.cap), mark: notch.mark } };
    };
    var cuffTotal = cB + cF;
    var out = {
      ok: true,
      geometry: { outline: outline, construction: construction, capSplit: { x: 0 } },
      derivedBodice: derivedBodice,
      meta: {
        rule: V.rule,
        settings: { inputs: clone(p), defaults: clone(V.defaults) },
        gate: g,
        sleeveLengthCm: p.sleeveLengthCm, widthCm: hb.dU + hf.dU,
        capHeight: { averageShoulderCm: avg, ratio: p.capHeightRatio, cm: capH, shoulderHeightsCm: { back: rb.back.heightCm, front: rb.front.heightCm },
          note: V.capNote },
        back: half(hb, Tb, cB, nB), front: half(hf, Tf, cF, nF),
        cap: { back: hb.capLen, front: hf.capLen, total: hb.capLen + hf.capLen },
        armhole: { back: hb.armholeLen, front: hf.armholeLen, total: hb.armholeLen + hf.armholeLen, note: "몸판 진동(봉제 길이 — 앞은 AH 다트를 닫은 상태 · 뒤는 진동 그대로)" },
        ease: { back: hb.capLen - hb.armholeLen, front: hf.capLen - hf.armholeLen, total: hb.capLen + hf.capLen - hb.armholeLen - hf.armholeLen, note: "책: 소매산에 여유분 줄임 없음 — 소매산 = 진동(규칙)" },
        cuff: { ratio: p.cuffRatio, cutCm: cut, back: cB, front: cF, totalCm: cuffTotal,
          note: "뒤 소맷부리 = 뒤 소매 폭 × 3/4 · ● = 뒤 소매 폭 − 뒤 소맷부리 · 앞 = 앞 소매 폭 − ●(뒤와 같은 분량을 자른다) · 소맷부리선 직선(중심선 직각)" },
        seams: {
          underarm: { back: dist(hb.U, Cb), front: dist(hf.U, Cf), diffCm: dist(hb.U, Cb) - dist(hf.U, Cf), note: "소매 밑선(앞·뒤를 맞대 박는 솔기) — 길이 맞춤 강제 없음(실측)" },
          center: { back: p.sleeveLengthCm, front: p.sleeveLengthCm, note: "앞뒤 소매 중심선 — 맞대어 한 장(솔기 아님)" }
        },
        frontDart: { moved: "side", apex: cp(mf.BP), angleDeg: mf.sideDart.angleDeg, mouthResidualCm: mf.mouthResidualCm, sideDropCm: p.sideDartDropCm, legs: mf.sideDart.legs.map(cp), widthCm: mf.sideDart.widthCm,
          underarmBefore: cp(mf.U0), underarmAfter: cp(mf.U1), note: "앞 AH 다트를 닫아 옆선(진동 아랫점 아래 3 — «치수는 적당하게»)으로 이동 · 위쪽 고정 · 아래 옆 조각이 BP 축으로 회전 · 다트 끝 = BP(확정 제도점 — 박음 끝 후퇴 없음)" },
        backDart: { moved: false, note: "뒤 어깨 다트는 그대로(도해) — 소매는 원래 SP 에서 제도. 소매산 높이 측정만 P.137 봉제 상태(다트를 닫은 SP)를 쓴다" },
        joints: { capAtSP: g1(capB[capB.length - 1], capF[0]), capAtSPNote: "앞뒤 소매산이 SP 에서 맞닿는 각 — SP 접선을 앞뒤 모두 소매 중심선 직각으로 두어 0(매끄러운 한 장 소매산)" },
        notches: { back: { sCm: nB.sCm, offsetCm: nB.offsetCm, mark: "‖" }, front: { sCm: nF.sCm, offsetCm: nF.offsetCm, mark: "|" },
          note: "맞춤 표시 = 마지막 ★ 의 진동 호 위치 — 진동·소매산 모두 SP 에서 같은 호 길이(봉제 맞춤)" },
        draftLayer: { back: draftLayer(hb, cB, nB), front: draftLayer(hf, cF, nF), frontDart: { BP: cp(mf.BP), legs: [cp(mf.S3r), cp(mf.S3)], oldLegs: [cp(mf.upperMouth), cp(mf.lowerMouth)], oldUnderarm: cp(mf.U0), oldSide: L(mf.U0, mf.S3) } },
        unconfirmed: V.unconfirmed.slice(),
        checks: { closed: true, connected: true, maxGapCm: Math.max(sGap, fl.gapCm), selfIntersection: false, frontBodiceSelfIntersection: false, singlePiece: true }
      },
      warnings: [],
      sourceBodiceHash: bodice.hash || null
    };
    if (V.lineage) out.meta.lineage = clone(V.lineage);
    return out;
  }
  var VARIANT_T = Object.freeze({ defaults: DEFAULTS, rule: "pattern-school-p50-shirt-sleeve-T(2026-10-28 draft)",
    capNote: "P.137 1·2: 다트를 닫은 봉제 상태의 SP → 진동 아랫점 수직 거리 평균 × 3/4 — 소매 폭선 = SP 에서 중심선을 따라 ◉",
    unconfirmed: Object.freeze(["소매산 곡선 구성(진동 위 기준점 3차 이음 · 가운데 점 = 진동 법선 0.7 / 0.5 · SP 접선 = 중심선 직각 · 소매 아랫점 접선 현 대칭 — 구현 관례)",
      "★ 위치 = 수정 가능한 시안값(진동 호 비율 뒤 0.6 · 앞 0.5 / 0.8 — 도해 눈대중)"]) });
  // Ⓤ 출처 구분: book = P.51 에서 읽힌 확정 수치 · inherited = «Ⓣ 와 같이» 로 승계한 Ⓣ 의 책 절차 · convention = Ⓣ 시안 관례(책 수치 아님).
  //   ※ P.51 도해의 ★ 표시는 «소매 경사»(직각 1.3 / 0.5)를 가리킨다 — 이 엔진의 ★(소매산이 진동과 만나는 점, Ⓣ 관례)과 다른 기호다.
  var VARIANT_U = Object.freeze({ defaults: DEFAULTS_U, rule: "pattern-school-p51-shirt-sleeve-U(2026-10-29 draft, T engine)",
    capNote: "P.137 1·2: 다트를 닫은 봉제 상태의 SP → 진동 아랫점 수직 거리 평균 × 1/2(P.51 — 소매산을 낮춰 소매 폭을 넓힌다) — 소매 폭선 = SP 에서 중심선을 따라 ◉",
    unconfirmed: Object.freeze(["소매산 곡선 구성(Ⓣ 관례 승계 — 진동 위 기준점 3차 이음 · 가운데 점 = 진동 법선 0.5 / 0.5 · SP 접선 = 중심선 직각 · 소매 아랫점 접선 현 대칭)",
      "진동 접점 위치 = Ⓣ 시안값 승계(진동 호 비율 뒤 0.6 · 앞 0.5 / 0.8) — P.51 도해에서 따로 읽지 않음",
      "소맷부리 = Ⓣ 방식 승계(뒤 폭 × 3/4 · 앞 = 폭 − ●) — P.51 에 소맷부리 수치 없음, «Ⓣ 와 같이» 로 해석(김님 지시)"]),
    lineage: Object.freeze({ sameAs: "T", page: 51,
      book: Object.freeze(["소매산 높이 = 평균 어깨 길이 × 1/2(P.137 봉제 상태)", "경사: 어깨선 연장 8 에서 직각 뒤 1.3 / 앞 0.5(도해 ★ = 소매 경사)", "소매산 차이 뒤 위 0.5 · 앞 위 0.5 · 앞 아래 0.5", "앞 AH 다트 → 옆 · 뒤 어깨 다트 그대로(도해)", "소매산 = 진동(여유분 줄임 없음 · 이세 0)"]),
      inherited: Object.freeze(["옆 다트 위치 3(P.140 «적당하게»)", "소맷부리 뒤 폭 × 3/4 · 앞 = 폭 − ●(P.141 4·7)", "앞뒤 중심선 맞대 한 장(P.157)"]),
      convention: Object.freeze(["SP 접선 = 소매 중심선 직각(맞댄 SP 매끄러운 접속)", "진동 접점 ★ 위치 0.6 / 0.5 · 0.8", "소매산 3차 이음 · 핸들 현 × 1/3"]) }) });
  function draftSleeveT(bodice, aGeometry, params) { return draftShirt(bodice, aGeometry, params, VARIANT_T); }
  function draftSleeveU(bodice, aGeometry, params) { return draftShirt(bodice, aGeometry, params, VARIANT_U); }

  window.designSleeveT = Object.freeze({ draftSleeveT: draftSleeveT, draftSleeveU: draftSleeveU, KEYS: KEYS,
    RULES: Object.freeze({ defaults: DEFAULTS, bodicePresetId: "bunka-bodice-A" }),
    RULES_U: Object.freeze({ defaults: DEFAULTS_U, bodicePresetId: "bunka-bodice-A", lineage: VARIANT_U.lineage }) });
})();
