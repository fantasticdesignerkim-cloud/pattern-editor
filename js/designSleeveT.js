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
// 구현 관례(책 수치 아님 · 설정값 · 김님 미확인 — meta.unconfirmed) — 2026-10-30 소매산 재보완(김님 화면 비교 «많이 좋아졌다», 제품 확정 전):
//   · 소매산 = 맞댄 한 장 전체(뒤 소매 아랫점 → SP → 앞 소매 아랫점)를 **곡률이 이어지는 곡선 하나**(C2 3차 스플라인 · 양 끝 자연)로 긋는다.
//     지나는 점 = 목표선 «몸판 진동 + 매끈한 차이 δ»를 3cm 간격으로 뽑은 점(SAMPLE_CM). δ: 첫 구간 = SP 쪽으로 기운 볼록 t(1−t)²(SP 기울기 상한 =
//     소매 중심선 직각) · 앞 아래 구간 = 안쪽 볼록(1 − cos) · 접점(★)에서 0. 볼록 크기 = 실측 최대 차이가 책 값(0.7 / 0.5)이 되게 맞춤.
//     (이전 시안: 기준점 사이 3차 조각 · SP 접선 = 중심선 직각 강제 · 핸들 현 × 1/3 — 조각 사이 곡률이 끊겨 뒤 아래가 직선 · 앞 아래가 갈고리였다.)
//     몸판 진동 자체가 SP 에서 어깨선 직각(소매 중심선 직각과 경사각만큼 어긋남)이고 cubic 사이 꺾임(뒤 5.4° · 앞 닫은 다트 입구 5.5°)이 있어 그대로 따라가지 않는다.
//   · ★(진동 접점) 위치 = 몸판 진동 호 길이 비율(뒤 0.72 · 앞 0.44 / 0.72 — P.140–141 도해 참고값 · 확정 공식 아님).
//   · 소매 아랫점 = 앞뒤 소매 폭선 위에서 «소매산 = 몸판 진동»이 동시에 되는 점(곡선이 앞뒤를 잇기 때문에 함께 푼다 · 각 쪽 해 유일 확인). 0 으로 맞추는 대상은 이세(책: 여유분 줄임 없음).
// 길이는 최종 geometry 실측(Gauss-Legendre). 소매 좌표: SP = (0,0), 중심선 = +y, 뒤 = −x, 앞 = +x(다른 소매와 같은 규약).
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var DEFAULTS = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 4, frontSlopeDropCm: 3.4, capHeightRatio: 0.75, sideDartDropCm: 3,
    capOutCm: 0.7, frontCapInCm: 0.5, cuffRatio: 0.75, backStar: 0.72, frontStar1: 0.44, frontStar2: 0.72 });
  // 소매 Ⓤ(P.51 «Ⓣ 와 같이 제도한다» · 소매산 높이 = 평균 어깨 길이 × 1/2) — 같은 키 · 같은 순서. 책 수치(F): 경사 8 ⟂ 뒤 1.3 / 앞 0.5 · 1/2 ·
  //   소매산 차이 뒤 위 0.5 · 앞 위 0.5 · 앞 아래 0.5. 나머지는 Ⓣ 승계: 옆 다트 3(P.140 «적당하게») · 소맷부리 뒤 폭 × 3/4 · 앞 = 폭 − ●(김님 지시 2026-10-29) · ★ 위치(Ⓣ 관례).
  var DEFAULTS_U = Object.freeze({ slopeRunCm: 8, backSlopeDropCm: 1.3, frontSlopeDropCm: 0.5, capHeightRatio: 0.5, sideDartDropCm: 3,
    capOutCm: 0.5, frontCapInCm: 0.5, cuffRatio: 0.75, backStar: 0.72, frontStar1: 0.44, frontStar2: 0.72 });
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

  // ── 한 쪽 소매 반쪽 제도 틀(몸판 좌표) — 경사·중심선·◉·폭선·소맷부리선(P.140 2 / P.141 5). 소매산 곡선은 아래 capJoint 가 앞뒤를 함께 그린다. ──
  // chain = SP → 진동 아랫점 cubic · shoulderFrom = 어깨선 위 SP 반대쪽 점 · drop = 경사 직각(뒤 4 / 앞 3.4) · bumps = 소매산 차이 구간(진동 호 비율 끝 · 책 차이 값)
  function frameHalf(piece, chain, shoulderFrom, drop, capH, p, bumps, centerX, sg) {
    var SP = cp(chain[0][0]), Lb = chainLen(chain);
    var us = unit(sub(SP, shoulderFrom)); if (!us) return fail("bodice-read-failed", { piece: piece, why: "shoulder" });
    var body = { x: centerX - SP.x, y: 0 }, nsh = { x: -us.y, y: us.x }; if (nsh.y < 0) nsh = mul(nsh, -1);   // 어깨선 직각 · 아래(몸 쪽)
    var K8 = add(SP, mul(us, p.slopeRunCm)), KA = add(K8, mul(nsh, drop));   // Ⓐ/Ⓑ
    var u = unit(sub(KA, SP));
    var n = { x: -u.y, y: u.x }; if (dot(n, body) < 0) n = mul(n, -1);   // 중심선 직각 · 몸판 쪽(소매 밑 쪽)
    var E = add(SP, mul(u, p.sleeveLengthCm)), W0 = add(SP, mul(u, capH));
    var inward = function (tan, pt) { var nn = { x: -tan.y, y: tan.x }; return dot(nn, { x: centerX - pt.x, y: 0 }) > 0 ? nn : mul(nn, -1); };   // 진동 법선 · 몸판 안쪽(+)
    var a0 = chainAt(chain, 0).tan, td = dot(n, a0) > 0 ? n : mul(n, -1);
    var m0 = Math.tan(Math.atan2(dot(td, inward(a0, SP)), dot(td, a0)));   // SP 에서 목표선이 소매 중심선 직각으로 떠나는 차이 기울기(상한으로만 씀)
    var stars = bumps.map(function (b) { var c = chainAt(chain, Lb * b.to); return { pt: c.pt, sCm: Lb * b.to }; });
    var dMin = Math.max(0.25, dot(sub(stars[stars.length - 1].pt, W0), n));   // 소매 아랫점은 마지막 접점보다 바깥(안쪽 해는 되돌아가는 고리)
    return { ok: true, piece: piece, SP: SP, us: us, nsh: nsh, K8: K8, KA: KA, u: u, n: n, E: E, W0: W0, chain: chain, armholeLen: Lb, inward: inward, m0: m0, stars: stars, dMin: dMin,
      bumps: bumps.map(function (b) { return { to: b.to, offsetCm: b.offsetCm, amp: b.offsetCm }; }),
      T: function (q) { var v = sub(q, SP); return { x: sg * dot(n, v), y: dot(u, v) }; },   // 몸판 → 한 장 소매(중심선 x=0 · 뒤 sg=−1 / 앞 +1 · 회전)
      Ti: function (q) { return add(SP, add(mul(n, sg * q.x), mul(u, q.y))); } };
  }

  // C2 3차 스플라인(현 길이 매듭 · 양 끝 자연) → cubic 목록. 매듭마다 위치·접선·곡률이 이어진다.
  function splineC2(P) {
    var n = P.length - 1, h = [], i;
    for (i = 0; i < n; i++) h.push(dist(P[i], P[i + 1]));
    var moments = function (y) {   // 3중 대각 연립(Thomas) — 자연 끝: M0 = Mn = 0
      var a = [], b = [], c = [], d = [], M = new Array(n + 1).fill(0);
      for (i = 1; i < n; i++) { a.push(h[i - 1]); b.push(2 * (h[i - 1] + h[i])); c.push(h[i]); d.push(6 * ((y[i + 1] - y[i]) / h[i] - (y[i] - y[i - 1]) / h[i - 1])); }
      var m = b.length;
      for (i = 1; i < m; i++) { var w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }
      for (i = m - 1; i >= 0; i--) M[i + 1] = (d[i] - (i < m - 1 ? c[i] * M[i + 2] : 0)) / b[i];
      return M;
    };
    var xs = P.map(function (q) { return q.x; }), ys = P.map(function (q) { return q.y; }), Mx = moments(xs), My = moments(ys), cs = [];
    for (i = 0; i < n; i++) {
      var d0 = { x: (xs[i + 1] - xs[i]) / h[i] - h[i] * (2 * Mx[i] + Mx[i + 1]) / 6, y: (ys[i + 1] - ys[i]) / h[i] - h[i] * (2 * My[i] + My[i + 1]) / 6 };
      var d1 = { x: (xs[i + 1] - xs[i]) / h[i] + h[i] * (Mx[i] + 2 * Mx[i + 1]) / 6, y: (ys[i + 1] - ys[i]) / h[i] + h[i] * (My[i] + 2 * My[i + 1]) / 6 };
      cs.push([cp(P[i]), add(P[i], mul(d0, h[i] / 3)), sub(P[i + 1], mul(d1, h[i] / 3)), cp(P[i + 1])]);
    }
    return cs;
  }

  // ── 소매산 해 찾기의 순수 경계(엔진이 그대로 쓰고, 회귀가 가짜 함수로 0 / 1 / 여러 해 · 수렴 실패를 직접 시험한다) ──
  // signChanges: [dMin, dMax] 를 step 간격으로 훑어 f 의 부호가 바뀌는 구간 목록(유한하지 않은 값은 그 자리를 «해 판정 불가»로 돌려준다).
  function signChanges(f, dMin, dMax, step) {
    var out = [], prev = null;
    for (var d = dMin; d <= dMax + 1e-9; d += step) {
      var v = f(d); if (!fin(v)) return { intervals: out, nonFinite: d };
      if (prev && (v > 0) !== (prev.v > 0)) out.push([prev.d, d]);
      prev = { d: d, v: v };
    }
    return { intervals: out, nonFinite: null };
  }
  // rootVerdict: 부호 변화 목록 → 해가 정확히 하나일 때만 통과(0 = 없음 · 2 이상 = 하나로 정해지지 않음 · 유한하지 않음 = 없음).
  function rootVerdict(sc) {
    if (sc.nonFinite !== null) return { ok: false, reason: "underarm-point-not-found", roots: sc.intervals.length, nonFiniteAt: sc.nonFinite };
    if (sc.intervals.length !== 1) return { ok: false, reason: sc.intervals.length ? "underarm-point-not-unique" : "underarm-point-not-found", roots: sc.intervals.length };
    return { ok: true, interval: sc.intervals[0], roots: 1 };
  }
  // settleAmplitudes: run(k) → { fail } | { pairs: [{ target, measured, scale(k) }] }. 실측이 모두 목표와 tol 안이면 settled.
  //   아니면 목표/실측 비로 크기를 고치고 다시(최대 maxIter). 실측이 유한하지 않으면 즉시 실패. 끝까지 못 맞추면 settled = false + 최대 잔차.
  function settleAmplitudes(run, maxIter, tol) {
    var last = null, residual = Infinity;
    for (var k = 0; k < maxIter; k++) {
      var r = run(k); if (r.fail) return r;
      last = r; residual = 0;
      for (var i = 0; i < r.pairs.length; i++) {
        var pr = r.pairs[i]; if (!(pr.target > 0)) continue;
        if (!fin(pr.measured)) return { fail: "cap-offset-not-converged", why: "non-finite", iterations: k + 1 };
        residual = Math.max(residual, Math.abs(pr.measured - pr.target));
      }
      if (residual <= tol) return { settled: true, iterations: k + 1, residual: residual, last: last };
      r.pairs.forEach(function (p) { if (p.target > 0 && p.measured > 1e-9) p.scale(p.target / p.measured); });
    }
    return { settled: false, iterations: maxIter, residual: residual, last: last };
  }

  // ── 소매산(맞댄 한 장 전체: 뒤 소매 아랫점 → SP → 앞 소매 아랫점)을 곡률이 이어지는 곡선 하나로 ──
  //   목표선 = 몸판 진동 + 매끈한 차이 δ(s)(«진동과 살짝만 차이»): 첫 구간 = SP 쪽으로 기운 볼록(t(1−t)² · SP 기울기 상한 = 중심선 직각) ·
  //   다음 구간(앞 아래) = 안쪽 볼록(1 − cos) · 접점(★)에서 0. 목표점(SAMPLE_CM 간격)과 SP · 소매 아랫점을 C2 스플라인으로 잇는다.
  //   소매 아랫점 = 앞뒤 «소매산 = 진동» 동시 해(폭선 위) · 볼록 크기 = 실측 최대 차이가 책 값(0.7 / 0.5)이 되게 맞춘다.
  var SAMPLE_CM = 3;   // 구현 관례(목표점 간격) — 2–3 에서 곡률 흐름이 같고 더 촘촘하면 진동 자체의 꺾임을 따라간다
  function capJoint(B, F) {
    var delta = function (S, sr) {
      var a = 0;
      for (var i = 0; i < S.bumps.length; i++) {
        var bp = S.bumps[i];
        if (sr <= bp.to + 1e-12) {
          var t = (sr - a) / (bp.to - a), bell = (1 - Math.cos(2 * Math.PI * t)) / 2;
          if (i > 0) return bp.amp * bell;
          var L0 = bp.to * S.armholeLen, al = Math.abs(bp.amp) > 1e-12 ? Math.max(0, Math.min(1, S.m0 * L0 / (6.75 * bp.amp))) : 0;
          return bp.amp * (al * 6.75 * t * (1 - t) * (1 - t) + (1 - al) * bell);
        }
        a = bp.to;
      }
      return 0;
    };
    var targets = function (S) {   // SP 다음 ~ 마지막 접점(소매 좌표)
      var sEnd = S.bumps[S.bumps.length - 1].to, N = Math.max(3, Math.round(sEnd * S.armholeLen / SAMPLE_CM)), out = [];
      for (var k = 1; k <= N; k++) { var sr = sEnd * k / N, c = chainAt(S.chain, S.armholeLen * sr); out.push(S.T(add(c.pt, mul(S.inward(c.tan, c.pt), delta(S, sr))))); }
      return out;
    };
    var tB = null, tF = null;
    var build = function (dB, dF) {
      var Ub = B.T(add(B.W0, mul(B.n, dB))), Uf = F.T(add(F.W0, mul(F.n, dF)));
      var cs = splineC2([Ub].concat(tB.slice().reverse(), [{ x: 0, y: 0 }], tF, [Uf])), iSP = tB.length + 1;
      return { back: cs.slice(0, iSP), front: cs.slice(iSP) };
    };
    var fB = function (dB, dF) { return chainLen(build(dB, dF).back) - B.armholeLen; }, fF = function (dB, dF) { return chainLen(build(dB, dF).front) - F.armholeLen; };
    var bisect = function (f, lo, hi) { var flo = f(lo); for (var it = 0; it < 80; it++) { var mm = (lo + hi) / 2, fm = f(mm); if ((fm > 0) === (flo > 0)) { lo = mm; flo = fm; } else hi = mm; } return (lo + hi) / 2; };
    var solve = function (g, sweeps) {   // 한쪽씩 1차원(다른 쪽 고정 · 해가 하나인지 확인) sweeps 회 → 2×2 Newton 마무리
      var dB = g.dB, dF = g.dF, rB = null, rF = null;
      for (var sw = 0; sw < sweeps; sw++) {
        rB = rootVerdict(signChanges(function (d) { return fB(d, dF); }, B.dMin, 2 * B.armholeLen, 0.25)); if (!rB.ok) return { fail: rB.reason, piece: "back", roots: rB.roots };
        dB = bisect(function (d) { return fB(d, dF); }, rB.interval[0], rB.interval[1]);
        rF = rootVerdict(signChanges(function (d) { return fF(dB, d); }, F.dMin, 2 * F.armholeLen, 0.25)); if (!rF.ok) return { fail: rF.reason, piece: "front", roots: rF.roots };
        dF = bisect(function (d) { return fF(dB, d); }, rF.interval[0], rF.interval[1]);
      }
      for (var it = 0; it < 30; it++) {
        var f0 = [fB(dB, dF), fF(dB, dF)]; if (Math.abs(f0[0]) < 1e-11 && Math.abs(f0[1]) < 1e-11) break;
        var e = 1e-6, fa = [fB(dB + e, dF), fF(dB + e, dF)], fb = [fB(dB, dF + e), fF(dB, dF + e)];
        var j11 = (fa[0] - f0[0]) / e, j12 = (fb[0] - f0[0]) / e, j21 = (fa[1] - f0[1]) / e, j22 = (fb[1] - f0[1]) / e, det = j11 * j22 - j12 * j21;
        if (!fin(det) || Math.abs(det) < 1e-14) break;
        dB -= (j22 * f0[0] - j12 * f0[1]) / det; dF -= (-j21 * f0[0] + j11 * f0[1]) / det;
      }
      var res = [fB(dB, dF), fF(dB, dF)];   // 마무리 검사: 유한 · 두 쪽 길이 잔차 · 마지막 접점보다 바깥
      if (!fin(dB) || !fin(dF) || !fin(res[0]) || !fin(res[1]) || Math.abs(res[0]) > 1e-8 || Math.abs(res[1]) > 1e-8 || dB < B.dMin - 1e-9 || dF < F.dMin - 1e-9)
        return { fail: "underarm-point-not-found", piece: "joint", roots: 0, why: "joint-newton-unconverged", residual: res, dB: dB, dF: dF };
      return { dB: dB, dF: dF };
    };
    var armOf = function (S) { var o = []; S.chain.forEach(function (q, i) { flatQ(q, 200).slice(i ? 1 : 0).forEach(function (x) { o.push(x); }); }); return o; };
    var armB = armOf(B), armF = armOf(F);
    var devOf = function (S, cs) {   // 소매산(SP ~ 마지막 접점, 몸판 좌표)이 진동에서 떨어진 실측: 바깥(몸판 쪽) 최대 · 안(소매 쪽) 최대 + 위치
      var armPts = S === B ? armB : armF;
      var sEnd = S.bumps[S.bumps.length - 1].to * S.armholeLen, acc = 0, o = { maxOutCm: 0, maxInCm: 0, out: null, inn: null };
      cs.forEach(function (q) {
        var l = cubicLen(q);
        flatQ(q, 80).forEach(function (x, k) {
          if (acc + l * k / 80 > sEnd + 1e-9) return;
          var best = null, bm = 0, bt = 0, bd = Infinity, nA = armPts.length;   // 최근접 진동 선분: 8 칸 간격으로 훑은 뒤 그 주변 ±16 칸을 모두 본다(진동과 1cm 안쪽이라 충분)
          var seg = function (m) {
            var a = armPts[m - 1], abx = armPts[m].x - a.x, aby = armPts[m].y - a.y, t = Math.max(0, Math.min(1, ((x.x - a.x) * abx + (x.y - a.y) * aby) / (abx * abx + aby * aby)));
            var dd = Math.hypot(a.x + abx * t - x.x, a.y + aby * t - x.y); if (dd < bd) { bd = dd; bm = m; bt = t; }
          };
          for (var m = 1; m < nA; m += 8) seg(m);
          for (var m2 = Math.max(1, bm - 16), mEnd = Math.min(nA - 1, bm + 16); m2 <= mEnd; m2++) seg(m2);
          var a1 = armPts[bm - 1], ab1 = sub(armPts[bm], a1), pr1 = add(a1, mul(ab1, bt)); best = { d: dist(x, pr1), pr: pr1, tan: unit(ab1) };
          if (dot(sub(x, best.pr), S.inward(best.tan, best.pr)) >= 0) { if (best.d > o.maxOutCm) { o.maxOutCm = best.d; o.out = { pt: cp(x), base: best.pr }; } }
          else if (best.d > o.maxInCm) { o.maxInCm = best.d; o.inn = { pt: cp(x), base: best.pr }; }
        });
        acc += l;
      });
      return o;
    };
    var g = { dB: B.dMin + 1, dF: F.dMin + 1 }, sol = null, r = null, capB = null, capF = null, dvB = null, dvF = null;
    var st = settleAmplitudes(function (k) {   // 볼록 크기 조정: 실측 최대 차이 = 책 값. 돌 때마다 목표점(tB/tF) → 해 → 곡선 → 실측을 같은 크기로 묶는다.
      tB = targets(B); tF = targets(F);
      var s1 = solve(g, k ? 0 : 2); if (s1.fail) return s1;
      sol = s1; g = s1; r = build(s1.dB, s1.dF);
      capB = r.back.map(function (q) { return revQ(q.map(B.Ti)); }).reverse(); capF = r.front.map(function (q) { return q.map(F.Ti); });
      dvB = devOf(B, capB); dvF = devOf(F, capF);
      var pairs = [];
      [[B, dvB], [F, dvF]].forEach(function (pr) { pr[0].bumps.forEach(function (bp) { pairs.push({ target: Math.abs(bp.offsetCm), measured: bp.offsetCm > 0 ? pr[1].maxOutCm : pr[1].maxInCm, scale: function (x) { bp.amp *= x; } }); }); });
      return { pairs: pairs };
    }, 12, 1e-4);
    if (st.fail) return fail(st.fail, { piece: st.piece, roots: st.roots, why: st.why, note: st.roots !== undefined ? "소매 폭선 위에서 «소매산 = 몸판 진동 길이» 해가 " + st.roots + "개" : undefined });
    if (!st.settled) return fail("cap-offset-not-converged", { iterations: st.iterations, residualCm: st.residual, note: "소매산이 진동에서 떨어진 실측 최대 차이를 책 값에 맞추지 못함" });
    var it2 = st.iterations - 1, settled = true;
    var chk = solve(sol, 1);   // 마지막 형상(같은 tB/tF — 통과한 뒤에는 크기를 더 고치지 않는다)에서 각 쪽 해가 하나인지 다시 확인(같은 해로 수렴해야 한다)
    if (chk.fail) return fail(chk.fail, { piece: chk.piece, roots: chk.roots, note: "소매 폭선 위에서 «소매산 = 몸판 진동 길이» 해가 " + chk.roots + "개" });
    if (Math.abs(chk.dB - sol.dB) > 1e-6 || Math.abs(chk.dF - sol.dF) > 1e-6) return fail("underarm-point-not-unique", { why: "joint-solution-moved", dB: [sol.dB, chk.dB], dF: [sol.dF, chk.dF] });
    return { ok: true, dB: sol.dB, dF: sol.dF, back: { cap: capB, deviation: dvB }, front: { cap: capF, deviation: dvF }, sleeveCap: r.back.concat(r.front), iterations: it2 + 1, settled: settled };
  }
  // 제도 틀 + 소매산 결과 → 반쪽(기존 출력 형태). keys: 볼록 표시점 = 실측 최대 차이 위치(책 0.7 / 0.5 의 자리) · 접점 = 진동 위 점.
  function finishHalf(H, d, res) {
    var U = add(H.W0, mul(H.n, d)), cap = res.cap, capLen = chainLen(cap);
    if (Math.abs(capLen - H.armholeLen) > LEN_TOL) return fail("cap-length-unmatched", { piece: H.piece, residual: capLen - H.armholeLen });
    var dv = res.deviation, keys = [{ pt: H.SP, kind: "SP" }];
    H.bumps.forEach(function (bp, i) {
      var at = bp.offsetCm > 0 ? dv.out : dv.inn;
      if (at) keys.push({ pt: at.pt, kind: "bump", offsetCm: (bp.offsetCm > 0 ? 1 : -1) * (bp.offsetCm > 0 ? dv.maxOutCm : dv.maxInCm), base: at.base, sCm: null, amp: bp.amp });
      keys.push({ pt: H.stars[i].pt, kind: "star", sCm: H.stars[i].sCm });
    });
    keys.forEach(function (k) { if (k.sCm === null) delete k.sCm; });
    return { ok: true, piece: H.piece, SP: H.SP, us: H.us, nsh: H.nsh, K8: H.K8, KA: H.KA, u: H.u, n: H.n, E: H.E, W0: H.W0, U: U, dU: d, G: add(H.E, mul(H.n, d)), cap: cap, capLen: capLen,
      armholeLen: H.armholeLen, keys: keys, deviation: { maxOutCm: dv.maxOutCm, maxInCm: dv.maxInCm }, chain: H.chain, amplitudes: H.bumps.map(function (b) { return b.amp; }) };
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
    var fb = frameHalf("back", bc.chain, bFrom, p.backSlopeDropCm, capH, p, [{ to: p.backStar, offsetCm: p.capOutCm }], cxB, -1); if (!fb.ok) return fb;
    var ff = frameHalf("front", mf.chain, fFrom, p.frontSlopeDropCm, capH, p, [{ to: p.frontStar1, offsetCm: p.capOutCm }, { to: p.frontStar2, offsetCm: -p.frontCapInCm }], cxF, 1); if (!ff.ok) return ff;
    var cj = capJoint(fb, ff); if (!cj.ok) return cj;
    var hb = finishHalf(fb, cj.dB, cj.back); if (!hb.ok) return hb;
    var hf = finishHalf(ff, cj.dF, cj.front); if (!hf.ok) return hf;
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
        joints: { capAtSP: g1(capB[capB.length - 1], capF[0]), capAtSPNote: "앞뒤 소매산이 SP 에서 맞닿는 각 — 맞댄 한 장 소매산 전체가 곡률 연속 곡선 하나라 0(SP 방향은 곡선이 정한다)" },
        capCurve: { method: "C2 cubic spline(chord-length knots · natural ends) through bodice armhole + smooth offset targets", sampleCm: SAMPLE_CM, pieces: cj.sleeveCap.length, amplitudes: { back: hb.amplitudes, front: hf.amplitudes }, iterations: cj.iterations, settled: cj.settled },
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
    unconfirmed: Object.freeze(["소매산 곡선 구성(맞댄 한 장 전체를 곡률 연속 곡선 하나로 · 목표선 = 진동 + 매끈한 차이(실측 최대 0.7 / 0.5) · 목표점 3cm 간격 · SP 쪽 볼록 기울기 상한 = 중심선 직각 — 구현 관례)",
      "★ 위치 = 수정 가능한 시안값(진동 호 비율 뒤 0.72 · 앞 0.44 / 0.72 — P.140–141 도해 참고값)"]) });
  // Ⓤ 출처 구분: book = P.51 에서 읽힌 확정 수치 · inherited = «Ⓣ 와 같이» 로 승계한 Ⓣ 의 책 절차 · convention = Ⓣ 시안 관례(책 수치 아님).
  //   ※ P.51 도해의 ★ 표시는 «소매 경사»(직각 1.3 / 0.5)를 가리킨다 — 이 엔진의 ★(소매산이 진동과 만나는 점, Ⓣ 관례)과 다른 기호다.
  var VARIANT_U = Object.freeze({ defaults: DEFAULTS_U, rule: "pattern-school-p51-shirt-sleeve-U(2026-10-29 draft, T engine)",
    capNote: "P.137 1·2: 다트를 닫은 봉제 상태의 SP → 진동 아랫점 수직 거리 평균 × 1/2(P.51 — 소매산을 낮춰 소매 폭을 넓힌다) — 소매 폭선 = SP 에서 중심선을 따라 ◉",
    unconfirmed: Object.freeze(["소매산 곡선 구성(Ⓣ 관례 승계 — 맞댄 한 장 전체를 곡률 연속 곡선 하나로 · 진동 + 매끈한 차이(실측 최대 0.5 / 0.5) · 목표점 3cm · SP 쪽 볼록 기울기 상한)",
      "진동 접점 위치 = Ⓣ 시안값 승계(진동 호 비율 뒤 0.72 · 앞 0.44 / 0.72) — P.51 도해에서 따로 읽지 않음",
      "관찰: B83 기본값에서 소매산 꼭대기가 SP 보다 앞쪽에서 약 0.13 높고 SP 부근이 평평하다(SP 곡률 ≈ −0.04) — P.51 도해의 0.5 차이가 SP 바로 아래라 그대로 둠",
      "소맷부리 = Ⓣ 방식 승계(뒤 폭 × 3/4 · 앞 = 폭 − ●) — P.51 에 소맷부리 수치 없음, «Ⓣ 와 같이» 로 해석(김님 지시)"]),
    lineage: Object.freeze({ sameAs: "T", page: 51,
      book: Object.freeze(["소매산 높이 = 평균 어깨 길이 × 1/2(P.137 봉제 상태)", "경사: 어깨선 연장 8 에서 직각 뒤 1.3 / 앞 0.5(도해 ★ = 소매 경사)", "소매산 차이 뒤 위 0.5 · 앞 위 0.5 · 앞 아래 0.5", "앞 AH 다트 → 옆 · 뒤 어깨 다트 그대로(도해)", "소매산 = 진동(여유분 줄임 없음 · 이세 0)"]),
      inherited: Object.freeze(["옆 다트 위치 3(P.140 «적당하게»)", "소맷부리 뒤 폭 × 3/4 · 앞 = 폭 − ●(P.141 4·7)", "앞뒤 중심선 맞대 한 장(P.157)"]),
      convention: Object.freeze(["소매산 = 맞댄 한 장 전체 곡률 연속 곡선(목표점 3cm)", "진동 접점 위치 0.72 / 0.44 · 0.72(도해 참고)", "SP 쪽 볼록 기울기 상한 = 중심선 직각"]) }) });
  function draftSleeveT(bodice, aGeometry, params) { return draftShirt(bodice, aGeometry, params, VARIANT_T); }
  function draftSleeveU(bodice, aGeometry, params) { return draftShirt(bodice, aGeometry, params, VARIANT_U); }

  window.designSleeveT = Object.freeze({ draftSleeveT: draftSleeveT, draftSleeveU: draftSleeveU, KEYS: KEYS,
    solver: Object.freeze({ signChanges: signChanges, rootVerdict: rootVerdict, settleAmplitudes: settleAmplitudes }),   // 순수 경계(엔진이 쓰는 그 함수 — 회귀가 직접 시험)
    RULES: Object.freeze({ defaults: DEFAULTS, bodicePresetId: "bunka-bodice-A" }),
    RULES_U: Object.freeze({ defaults: DEFAULTS_U, bodicePresetId: "bunka-bodice-A", lineage: VARIANT_U.lineage }) });
})();
