// ══════════════════════════════════════════════
// designSleeveA.js — 소매 Ⓐ 엔진 코어([패턴학교] P.137–139 「타입 4: 완성한 몸판 Ⓐ의 진동둘레를 토대로 제도」). 순수.
//
// ⚠️ 이번 묶음은 **엔진 코어만**이다 — UI·프리셋 카드·체크포인트 연결 없음(index.html 미등록).
//    designSleeve.js(computeSilhouette 등 기존 소매 파생)는 건드리지 않는 별개 모듈이다.
//
// 입력: 읽기 전용 bodiceResult(bodiceCheckpoint.complete 가 만든 동결 스냅샷). 이 모듈은 쓰지 않는다
//   (입력 변형 0 · 반환값은 전부 새 객체 · bodiceResult.hash 는 sourceBodiceHash 로 복사만 한다).
//
// 제도(P.137–139, 사용자 확정 사양):
//   소매산 높이 H = ((뒤 어깨 높이 + 앞 어깨 높이) / 2) × 4/5   — 어깨 높이 = 어깨점 → 진동 아랫점(가슴둘레선) 수직거리
//   SP(소매산점) = (0,0), 소매 아랫점 수평선 y = H. 뒤 = 낮은 x, 앞 = 높은 x(sleeve.js 규약).
//   SP 에서 뒤 AH+0.4 / 앞 AH−0.6 을 직선으로 잡아 수평선과 만나는 점 = 소매 아랫점(각 변).
//   각 직선 위 앞AH/4 지점에서 직각 바깥(위)으로 1.8 = 볼록점 P. SP 좌우 약 1cm 는 수평.
//   소매산 곡선: SP(수평 접선·핸들 1cm) → P(직선과 평행 접선) → 아랫점(수평 접선) 매끈한 cubic.
//   목표 이세 = (앞AH+뒤AH)×5%, 뒤:앞 = 3:2. 소매산선 길이 − AH = 현재 이세. Δ = 목표 이세 − 현재 이세.
//   ⑧ 조정: 소매산 높이를 바꾸지 않고 아랫점을 **수평으로 Δ** 이동(Δ<0 중심 쪽 = 곡선 끝을 수평 절단,
//     Δ>0 바깥쪽 = 끝 접선(수평)을 그대로 이어 새 아랫점까지 연장). ⑨ 새 아랫점에서 밑선 수직.
//
// ★ 진동선은 앞·뒤 모두 **다트를 박아 닫은 봉제 상태**를 쓴다(김님 확정, P.137 ③·④ — 「AH 다트를 맞대고 남은 AH」).
//    · 앞: 열린 AH 다트면 BP 를 축으로 위쪽 진동 조각과 어깨점을 회전해 닫는다(아랫점 고정).
//    · 뒤: 열린 어깨 다트면 **중심(CB) 고정, 진동 쪽을 어깨 다트 정점 축으로 회전**해 닫는다(플레어 Ⓖ 와 같은 방식) —
//      어깨점·아랫점이 함께 돌아 어깨 높이(아랫점 y − 어깨점 y)가 줄어든다. 회전이라 AH 길이는 불변.
//    이미 닫힌 몸판(진동 체인이 이어지고 다리 입구가 없음)은 보관 형상 그대로. 모든 닫힘은 파생 계산이며 bodiceResult 는 읽기만 한다.
// ★ 구현 관례(책 수치 아님): cubic 핸들 = 현 길이 × 1/3(SP 쪽 첫 핸들만 1cm), 반올림 없음.
//    책에서 미확정인 반올림·잔차·「1cm 이상 과부족」은 합격 게이트가 아니라 meta/warnings 관찰값이다.
// ══════════════════════════════════════════════
(function () {
  "use strict";
  var BACK_PLUS = 0.4, FRONT_MINUS = 0.6;   // 뒤 AH+0.4 · 앞 AH−0.6
  var BULGE = 1.8, FLAT = 1.0;              // 볼록 1.8 · SP 좌우 수평 약 1cm
  var EASE_RATE = 0.05, BACK_SHARE = 3 / 5, FRONT_SHARE = 2 / 5;   // 총 이세 5% · 뒤:앞 = 3:2
  var HANDLE = 1 / 3;
  var JOIN = 1e-3, UNDERARM_Y_TOL = 0.05, MOUTH_TOL = 0.1;
  var SHOULDER_MOUTH_TOL = 0.3;   // 뒤 어깨 다트는 두 다리 길이가 ~0.1cm 비대칭(원형 알려진 소견) — 입구 잔차를 관찰값으로 허용

  function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function cp(p) { return { x: p.x, y: p.y }; }
  function fin(v) { return typeof v === "number" && isFinite(v); }
  function L(a, b, role) { var s = { kind: "line", from: cp(a), to: cp(b) }; if (role) s.role = role; return s; }

  // ── 곡선 보조 ──
  function cubicAt(q, t) {
    var u = 1 - t;
    return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x,
             y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y };
  }
  function flattenCubics(cubs, n) {
    var out = [];
    cubs.forEach(function (q, ci) { for (var i = (ci === 0 ? 0 : 1); i <= n; i++) out.push(cubicAt(q, i / n)); });
    return out;
  }
  function polyLen(pts) { var s = 0; for (var i = 0; i < pts.length - 1; i++) s += dist(pts[i], pts[i + 1]); return s; }
  function cubicsLen(cubs) { return polyLen(flattenCubics(cubs, 400)); }
  function reverseCubic(q) { return [cp(q[3]), cp(q[2]), cp(q[1]), cp(q[0])]; }
  // De Casteljau 분할 — 왼쪽 [0,t] 조각.
  function splitLeft(q, t) {
    var l = function (a, b) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
    var p01 = l(q[0], q[1]), p12 = l(q[1], q[2]), p23 = l(q[2], q[3]);
    var p012 = l(p01, p12), p123 = l(p12, p23), p = l(p012, p123);
    return [cp(q[0]), p01, p012, p];
  }
  function crossSign(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }
  function segCross(a, b, c, d) {
    var d1 = crossSign(c, d, a), d2 = crossSign(c, d, b), d3 = crossSign(a, b, c), d4 = crossSign(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }
  function loopSelfIntersects(loop) {
    var n = loop.length;
    for (var i = 0; i < n - 1; i++) for (var j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue;
      if (segCross(loop[i], loop[i + 1], loop[j], loop[j + 1])) return true;
    }
    return false;
  }

  // ── 책 산술: 이상 이세 · 현재 이세 · Δ ────────────────────────────────────────
  // in: { capBackCm, capFrontCm, ahBackCm, ahFrontCm } → 반올림 없음(원값).
  function easeAdjustment(m) {
    var total = EASE_RATE * (m.ahBackCm + m.ahFrontCm);
    var tb = total * BACK_SHARE, tf = total * FRONT_SHARE;
    var cb = m.capBackCm - m.ahBackCm, cf = m.capFrontCm - m.ahFrontCm;
    return { target: { total: total, back: tb, front: tf }, current: { total: cb + cf, back: cb, front: cf },
             delta: { back: tb - cb, front: tf - cf } };
  }

  // ── bodiceResult 에서 진동 어깨점·아랫점 읽기 ───────────────────────────────────
  function endsOf(seg) {
    if (seg.kind === "line" || seg.kind === "cubic") return [seg.from, seg.to];
    if (seg.kind === "path" && Array.isArray(seg.commands) && seg.commands.length) {
      var pts = []; seg.commands.forEach(function (c) { c.points.forEach(function (p) { pts.push(p); }); });
      return [pts[0], pts[pts.length - 1]];
    }
    return null;
  }
  function samePt(a, b, tol) { return dist(a, b) <= (tol || JOIN); }
  function uniqPts(list, tol) { var out = []; list.forEach(function (p) { if (!out.some(function (q) { return samePt(p, q, tol); })) out.push(p); }); return out; }
  function rot(p, c, ang) {
    var dx = p.x - c.x, dy = p.y - c.y, cs = Math.cos(ang), sn = Math.sin(ang);
    return { x: c.x + dx * cs - dy * sn, y: c.y + dx * sn + dy * cs };
  }
  function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }

  function flattenArm(sg) {
    if (sg.kind === "line") return [cp(sg.from), cp(sg.to)];
    var cubs = [];
    if (sg.kind === "cubic") cubs.push([sg.from, sg.c1, sg.c2, sg.to]);
    else if (sg.kind === "path") { var cur = null; sg.commands.forEach(function (c) { if (c.type === "M") cur = c.points[0]; else if (c.type === "C") { cubs.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); }
    return flattenCubics(cubs, 24);
  }

  // 한 조각(front/back)의 진동 체인: 어깨점(SP)·아랫점·(열린 AH 다트면) 닫은 어깨점.
  //   실패 reason: no-armhole / ambiguous-shoulder-point / ambiguous-underarm / armhole-chain-unsupported /
  //     armhole-dart-missing / armhole-dart-unclosable / shoulder-dart-missing / shoulder-dart-unclosable.
  function readPiece(bodice, piece) {
    var pc = bodice[piece], arm = bodice.armhole && bodice.armhole[piece];
    if (!pc || !Array.isArray(pc.outline) || !Array.isArray(arm) || !arm.length) return { ok: false, reason: "no-armhole" };
    var prims = arm.map(function (s) { return endsOf(s); });
    if (prims.some(function (e) { return !e; })) return { ok: false, reason: "no-armhole" };
    // 의미 모서리 인접: 어깨선 끝 · 옆선 끝에 닿는 진동 끝점.
    var touching = function (edge) {
      var tips = [];
      pc.outline.forEach(function (s) {
        if (s.edge !== edge) return; var e = endsOf(s); if (!e) return;
        e.forEach(function (q) { prims.forEach(function (pe) { pe.forEach(function (p) { if (samePt(p, q)) tips.push(p); }); }); });
      });
      return uniqPts(tips);
    };
    var sh = touching("shoulder"), ua = touching("side-seam");
    if (sh.length !== 1) return { ok: false, reason: "ambiguous-shoulder-point", detail: sh.length };
    if (ua.length !== 1) return { ok: false, reason: "ambiguous-underarm", detail: ua.length };
    var SP = cp(sh[0]), U = cp(ua[0]);
    // 연결 성분(끝점 일치). 1 = 이어진 체인 / 2 = 열린 AH 다트로 끊긴 앞판.
    var comp = prims.map(function (_, i) { return i; });
    var find = function (i) { while (comp[i] !== i) i = comp[i]; return i; };
    for (var i = 0; i < prims.length; i++) for (var j = i + 1; j < prims.length; j++) {
      var hit = prims[i].some(function (a) { return prims[j].some(function (b) { return samePt(a, b); }); });
      if (hit) comp[find(j)] = find(i);
    }
    var roots = uniqPts(prims.map(function (_, i) { return { x: find(i), y: 0 }; }), 0.5);
    // underarmBlock = 다트를 연 원형 등가 위치의 아랫점(가드 비교 전용 · 측정 복사본). 배치 정규화가 없으면 보관 위치 그대로.
    var base = { ok: true, shoulderStored: SP, underarmStored: U, underarm: U, shoulder: SP, closedDart: null, closedShoulderDart: null, underarmBlock: U, placement: null };
    var placeRot = null;   // 측정 복사본 전체 회전(배치 정규화) { apex, angleRad }
    var upperIdx = null;   // 앞 AH 다트로 회전하는 위쪽 진동 조각 인덱스(없으면 null)
    if (roots.length !== 1 && roots.length !== 2) return { ok: false, reason: "armhole-chain-unsupported", detail: roots.length };
    if (roots.length === 2) {
    // 열린 AH 다트: SP 쪽 성분(위) / 아랫점 쪽 성분(아래). 다리(construction dart.boundary:"armhole") 두 줄의 공통 끝 = BP.
    var upperRoot = null, lowerRoot = null;
    prims.forEach(function (e, idx) {
      if (e.some(function (p) { return samePt(p, SP); })) upperRoot = find(idx);
      if (e.some(function (p) { return samePt(p, U); })) lowerRoot = find(idx);
    });
    if (upperRoot === null || lowerRoot === null || upperRoot === lowerRoot) return { ok: false, reason: "armhole-chain-unsupported" };
    var freeEnd = function (root, not) {
      var pts = []; prims.forEach(function (e, idx) { if (find(idx) === root) e.forEach(function (p) { pts.push(p); }); });
      var c = uniqPts(pts).filter(function (p) {
        var n = pts.filter(function (q) { return samePt(p, q); }).length; return n === 1 && !samePt(p, not);
      });
      return c.length === 1 ? cp(c[0]) : null;
    };
    var upMouth = freeEnd(upperRoot, SP), loMouth = freeEnd(lowerRoot, U);
    if (!upMouth || !loMouth) return { ok: false, reason: "armhole-chain-unsupported" };
    var legs = (pc.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "armhole"; });
    if (legs.length !== 2) return { ok: false, reason: "armhole-dart-missing", detail: legs.length };
    var apex = null;
    var cands = [legs[0].from, legs[0].to];
    cands.forEach(function (c) { if (samePt(c, legs[1].from, 1e-2) || samePt(c, legs[1].to, 1e-2)) apex = cp(c); });
    if (!apex) return { ok: false, reason: "armhole-dart-missing", detail: "no-apex" };
    var ang = wrapPi(Math.atan2(loMouth.y - apex.y, loMouth.x - apex.x) - Math.atan2(upMouth.y - apex.y, upMouth.x - apex.x));
    var closedMouth = rot(upMouth, apex, ang);
    if (dist(closedMouth, loMouth) > MOUTH_TOL) return { ok: false, reason: "armhole-dart-unclosable", detail: dist(closedMouth, loMouth) };
    base.shoulder = rot(SP, apex, ang);
    base.closedDart = { apex: apex, angleRad: ang, mouthResidualCm: dist(closedMouth, loMouth) };
    upperIdx = []; prims.forEach(function (e, idx) { if (find(idx) === upperRoot) upperIdx.push(idx); });
    }
    // 배치 정규화(2026-10-21 · 측정 복사본만): 진동 체인은 이미 닫혀 있는데 AH 다트 다리 두 줄의 입구가 서로 떨어져 있고(다리가 옮겨진 조각과 함께
    //   운반됨) 닫힌 이음점이 «아래» 다리 입구에 있으면, 몸판이 **위쪽을 고정하고 옆(아래) 조각을 BP 축으로 돌려** 다트를 닫은 것이다(플레어 Ⓖ 등).
    //   봉제선(닫힌 진동)은 Ⓐ 규약(아랫점 고정·위쪽 회전)과 같고 놓인 방향만 다르다 → 같은 BP 축으로 «위 입구 → 아래 입구» 각만큼 돌려 Ⓐ 규약에 맞춘다.
    //   몸판 geometry 는 바꾸지 않는다. 다리 attach.root(armhole-upper/lower)가 없거나 조건이 다르면 아무것도 하지 않는다(기존 동작).
    if (roots.length === 1) {
      var aLegs = (pc.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "armhole"; });
      var legRole = function (l) { var r = l.dart.attach && l.dart.attach.root; return typeof r === "string" ? (/armhole-upper$/.test(r) ? "upper" : (/armhole-lower$/.test(r) ? "lower" : null)) : null; };
      var upL = aLegs.filter(function (l) { return legRole(l) === "upper"; }), loL = aLegs.filter(function (l) { return legRole(l) === "lower"; });
      if (aLegs.length === 2 && upL.length === 1 && loL.length === 1) {
        var ap1 = null;
        [upL[0].from, upL[0].to].forEach(function (c) { if (samePt(c, loL[0].from, 1e-2) || samePt(c, loL[0].to, 1e-2)) ap1 = cp(c); });
        var mouthOf = function (l) { return samePt(l.from, ap1, 1e-2) ? cp(l.to) : cp(l.from); };
        if (ap1) {
          var upM = mouthOf(upL[0]), loM = mouthOf(loL[0]), joints = [];
          for (var a1 = 0; a1 < prims.length; a1++) for (var b1 = a1 + 1; b1 < prims.length; b1++) prims[a1].forEach(function (p) { prims[b1].forEach(function (q) { if (samePt(p, q)) joints.push(p); }); });
          var atLo = joints.some(function (p) { return dist(p, loM) <= MOUTH_TOL; }), atUp = joints.some(function (p) { return dist(p, upM) <= MOUTH_TOL; });
          if (dist(upM, loM) > MOUTH_TOL && atLo && !atUp) {
            var pAng = wrapPi(Math.atan2(loM.y - ap1.y, loM.x - ap1.x) - Math.atan2(upM.y - ap1.y, upM.x - ap1.x));
            // 검증: 다트 닫힘 회전만 되돌리면 옆 조각이 원형 자리로 돌아와 아랫점이 가슴둘레선(BP 높이 — 원형에서 BP 는 B 선 위)에 놓여야 한다.
            //   아니면 진동이 다트 닫힘 말고 다른 변형(진동 위 기준점 절개 등)으로도 움직인 것 — 배치로 설명되지 않으므로 판단을 넘긴다(값을 맞추지 않는다).
            var Un = rot(U, ap1, pAng);
            if (Math.abs(Un.y - ap1.y) > UNDERARM_Y_TOL) return { ok: false, reason: "armhole-placement-unverified", detail: { underarmBlockY: Un.y, bustPointY: ap1.y, angleDeg: pAng * 180 / Math.PI } };
            placeRot = { apex: ap1, angleRad: pAng };
            base.shoulder = rot(SP, ap1, pAng); base.underarm = rot(U, ap1, pAng); base.underarmBlock = base.underarm;
            base.placement = { kind: "front-dart-closed-by-moving-lower-side", apex: ap1, angleRad: pAng, legsApartCm: dist(upM, loM),
              note: "측정 복사본만 BP 축 회전(배치 정규화) — 몸판 geometry·진동 길이 불변" };
          }
        }
      }
    }
    // 어깨 다트(뒤판): 어깨선이 다트로 끊겨 열려 있으면 **중심(CB)을 고정하고 진동 쪽을 BP 축으로 회전**해 닫는다
    //   (플레어 Ⓖ 가 뒤 어깨 다트를 닫는 방식과 같다). 어깨점·아랫점이 함께 돈다. 이미 닫혔거나 다리가 없으면 그대로.
    var sLegs = (pc.construction || []).filter(function (s) { return s.kind === "line" && s.dart && s.dart.boundary === "shoulder"; });
    var shAng = null;
    var shSegs = pc.outline.filter(function (sg) { return sg.edge === "shoulder"; });
    if (sLegs.length !== 2 && shSegs.length >= 2) return { ok: false, reason: "shoulder-dart-missing", detail: sLegs.length };   // 어깨선이 끊겼는데 다리가 없다
    if (sLegs.length === 2) {
      var sApex = null;
      [sLegs[0].from, sLegs[0].to].forEach(function (c) { if (samePt(c, sLegs[1].from, 1e-2) || samePt(c, sLegs[1].to, 1e-2)) sApex = cp(c); });
      if (!sApex) return { ok: false, reason: "shoulder-dart-missing", detail: "no-apex" };
      var mouths = [sLegs[0], sLegs[1]].map(function (l) { return samePt(l.from, sApex, 1e-2) ? l.to : l.from; });
      // 진동 쪽 입구 M = SP 에 닿는 어깨 span 의 다른 끝점. 그것이 다리 입구와 일치할 때만 «열린 다트».
      var M = null;
      pc.outline.forEach(function (s) {
        if (s.edge !== "shoulder" || M) return; var e = endsOf(s); if (!e) return;
        if (samePt(e[0], SP)) M = cp(e[1]); else if (samePt(e[1], SP)) M = cp(e[0]);
      });
      var mi = M ? (samePt(M, mouths[0], 0.02) ? 0 : (samePt(M, mouths[1], 0.02) ? 1 : -1)) : -1;
      // 이미 닫힌 어깨 다트(2026-10-21): 어깨 두 구간이 M 에서 이어져 있고(잔차 ≤ SHOULDER_MOUTH_TOL) 다리 두 입구는 서로 떨어져 있으면
      //   (다리가 진동 쪽 조각과 함께 운반됨 — 플레어 Ⓖ 등) 몸판이 이미 **중심 고정·진동 쪽 회전**(Ⓐ 와 같은 규약)으로 닫은 것이다 → 다시 돌리지 않는다.
      //   가드 비교용 원형 등가 아랫점만, 운반된 목 쪽 다리 입구가 원래 자리(목 쪽 구간 안쪽 끝)에서 돈 각만큼 되돌려 구한다(측정 복사본).
      var neckEnd = null;
      if (M) pc.outline.forEach(function (s) {
        if (s.edge !== "shoulder" || neckEnd) return; var e = endsOf(s); if (!e || samePt(e[0], SP) || samePt(e[1], SP)) return;
        neckEnd = dist(e[0], M) < dist(e[1], M) ? cp(e[0]) : cp(e[1]);
      });
      var alreadyClosed = mi >= 0 && neckEnd && dist(neckEnd, M) <= SHOULDER_MOUTH_TOL && dist(mouths[0], mouths[1]) > SHOULDER_MOUTH_TOL;
      if (alreadyClosed) {
        var nkLeg = [sLegs[0], sLegs[1]].filter(function (l) { var r = l.dart.attach && l.dart.attach.root; return typeof r === "string" && /shoulder-neck$/.test(r); })[0];
        if (nkLeg) {
          var nkMouth = samePt(nkLeg.from, sApex, 1e-2) ? nkLeg.to : nkLeg.from;
          var carried = wrapPi(Math.atan2(nkMouth.y - sApex.y, nkMouth.x - sApex.x) - Math.atan2(neckEnd.y - sApex.y, neckEnd.x - sApex.x));
          base.underarmBlock = rot(U, sApex, -carried);
          base.placement = { kind: "back-shoulder-dart-already-closed", apex: sApex, closedAngleRad: carried, spanGapCm: dist(neckEnd, M),
            note: "이미 닫힌 어깨 다트 — 다시 닫지 않음 · 원형 등가 아랫점은 가드 비교용(측정 복사본)" };
        }
        mi = -1;
      }
      if (mi >= 0) {
        var N = mouths[1 - mi];
        shAng = wrapPi(Math.atan2(N.y - sApex.y, N.x - sApex.x) - Math.atan2(mouths[mi].y - sApex.y, mouths[mi].x - sApex.x));
        var resid = dist(rot(mouths[mi], sApex, shAng), N);
        if (resid > SHOULDER_MOUTH_TOL) return { ok: false, reason: "shoulder-dart-unclosable", detail: resid };
        base.shoulder = rot(base.shoulder, sApex, shAng);
        base.underarm = rot(base.underarm, sApex, shAng);
        base.closedShoulderDart = { apex: sApex, angleRad: shAng, mouthResidualCm: resid };
      }
    }
    // 닫힌 진동 곡선(관찰용 조밀 점열): 앞 = 위쪽 조각을 AH 다트 축으로 / 뒤 = 전체를 어깨 다트 축으로 회전. 길이는 회전 불변.
    base.armholeClosed = arm.map(function (sg, idx) {
      var pts = flattenArm(sg);
      if (upperIdx && upperIdx.indexOf(idx) >= 0) pts = pts.map(function (q) { return rot(q, base.closedDart.apex, base.closedDart.angleRad); });
      if (shAng !== null && base.closedShoulderDart) pts = pts.map(function (q) { return rot(q, base.closedShoulderDart.apex, shAng); });
      if (placeRot) pts = pts.map(function (q) { return rot(q, placeRot.apex, placeRot.angleRad); });
      return pts;
    });
    return base;
  }

  // ── 원형 등가 측정 복사본(2026-10-27 김님 확정 · 측정 복사본만 — 몸판 geometry·armholeLengths·다트량 무변경) ──────────────
  //   진동이 다트 닫힘 말고 다른 디자인 변환으로도 움직인 몸판은, 그 변환을 **완료본에 실린 기록**대로 조각별로 되돌려 원형 기준에서 잰다.
  //   · 플레어 Ⓗ(flareSlash[pc].slash — 진동 기준점 pivot · angleDeg): 진동 체인을 pivot 에서 나눠 아랫점 쪽 조각(+ 옆선)을 pivot 축 −angle 회전.
  //     → Ⓖ 와 같은 상태(다트 닫힘만 남음)가 되고, 그 뒤는 기존 판독(배치 정규화·가드)이 그대로 검증한다.
  //   · 허리 이음선 Ⓜ·Ⓝ(waistSeam[pc].closedDart — apex · dartAngleRad · slashEnd T · slashEndRotated T′ · armholeEaseCm):
  //     옆 조각(진동·옆선 «-splice» identity)을 apex 축 −dartAngle 회전 · T′→T 틈 메움 직선(진동선 위 line, 끝점 = 기록 T′·T, 길이 = 기록)은
  //     다트 입구로 보아 **봉제(소매 제도)용 진동 길이에서 뺀다**(저장 AH 는 표시 형상 길이로 그대로).
  //   기록이 없으면 원본 그대로(기존 몸판 결과 바이트 동일). 기록과 형상이 맞지 않으면 추측하지 않고 이유와 함께 멈춘다.
  var RESTORE_TOL = 1e-6;
  function round4A(v) { return Math.round(v * 10000) / 10000; }
  function rotSegA(sg, c, a) {
    var q = JSON.parse(JSON.stringify(sg));
    ["from", "to", "c1", "c2"].forEach(function (k) { if (q[k]) q[k] = rot(q[k], c, a); });
    if (Array.isArray(q.commands)) q.commands.forEach(function (cm) { cm.points = cm.points.map(function (p) { return rot(p, c, a); }); });
    return q;
  }
  function sameEnds(sg, a, b, tol) { var e = endsOf(sg); return !!e && ((samePt(e[0], a, tol) && samePt(e[1], b, tol)) || (samePt(e[0], b, tol) && samePt(e[1], a, tol))); }
  function sideTip(pc, arm) {   // 옆선 끝에 닿는 진동 끝점(readPiece 와 같은 규칙)
    var tips = [];
    pc.outline.forEach(function (s) {
      if (s.edge !== "side-seam") return; var e = endsOf(s); if (!e) return;
      e.forEach(function (q) { arm.forEach(function (a) { var ea = endsOf(a); if (ea) ea.forEach(function (p) { if (samePt(p, q)) tips.push(p); }); }); });
    });
    tips = uniqPts(tips); return tips.length === 1 ? cp(tips[0]) : null;
  }
  function restorePiece(bodice, piece) {
    var pc = bodice[piece], arm = bodice.armhole && bodice.armhole[piece];
    var fsRec = bodice.flareSlash && bodice.flareSlash[piece] && bodice.flareSlash[piece].slash;
    var wsRec = bodice.waistSeam && bodice.waistSeam[piece] && bodice.waistSeam[piece].closedDart;
    if (!fsRec && !wsRec) return { ok: true, restore: null };
    if (fsRec && wsRec) return { ok: false, reason: "armhole-restore-ambiguous", detail: { piece: piece } };
    if (!pc || !Array.isArray(pc.outline) || !Array.isArray(arm)) return { ok: false, reason: "no-armhole" };
    var bad = function (why, d) { return { ok: false, reason: "armhole-restore-unverified", detail: { piece: piece, why: why, value: d } }; };
    var outPc = { outline: pc.outline.slice(), construction: pc.construction || [] }, outArm = arm.slice(), fwd = arm.map(function () { return null; });
    if (fsRec) {
      var P = fsRec.pivot, ang = (fin(fsRec.angleDeg) ? fsRec.angleDeg : NaN) * Math.PI / 180;
      if (!P || !fin(P.x) || !fin(P.y) || !fin(ang)) return bad("flare-slash-record-invalid");
      var U = sideTip(pc, arm); if (!U) return bad("underarm-not-found");
      // 아랫점에서 체인을 따라가 pivot(이음점)에 닿을 때까지의 조각 = 절개로 함께 돈 조각
      var used = arm.map(function () { return false; }), cur = U, moved = [], hitPivot = false;
      for (var guard = 0; guard < arm.length && !hitPivot; guard++) {
        var k = -1, far = null;
        arm.forEach(function (sg, i) { if (used[i] || k >= 0) return; var e = endsOf(sg); if (samePt(e[0], cur)) { k = i; far = e[1]; } else if (samePt(e[1], cur)) { k = i; far = e[0]; } });
        if (k < 0) break;
        used[k] = true; moved.push(k); cur = far;
        if (samePt(cur, P, RESTORE_TOL)) hitPivot = true;
      }
      var pivotJoint = hitPivot && arm.some(function (sg, i) { if (used[i]) return false; var e = endsOf(sg); return samePt(e[0], P, RESTORE_TOL) || samePt(e[1], P, RESTORE_TOL); });
      if (!hitPivot || !pivotJoint) return bad("flare-slash-pivot-not-armhole-joint");
      // 옆선 조각이 진동 아래 조각과 같은 쪽(절개선 pivot→foot 기준)에 있어야 한다
      var F = fsRec.foot; if (!F || !fin(F.x) || !fin(F.y)) return bad("flare-slash-record-invalid");
      var sideOf = function (p) { return Math.sign((F.x - P.x) * (p.y - P.y) - (F.y - P.y) * (p.x - P.x)); };
      var midOf = function (sg) { var pl = flattenArm(sg); return pl[Math.floor(pl.length / 2)]; };
      var sgn = sideOf(midOf(arm[moved[0]]));
      if (!sgn || moved.some(function (i) { return sideOf(midOf(arm[i])) !== sgn; })) return bad("flare-slash-side-ambiguous");
      var sideSegs = pc.outline.filter(function (s) { return s.edge === "side-seam"; });
      if (!sideSegs.length || sideSegs.some(function (s) { var e = endsOf(s); return sideOf({ x: (e[0].x + e[1].x) / 2, y: (e[0].y + e[1].y) / 2 }) !== sgn; })) return bad("flare-slash-side-seam-not-on-moving-side");
      moved.forEach(function (i) { outArm[i] = rotSegA(arm[i], P, -ang); fwd[i] = { center: cp(P), angleRad: ang }; });
      outPc.outline = pc.outline.map(function (s) {
        if (s.edge === "side-seam") return rotSegA(s, P, -ang);
        if (s.edge === "armhole" && moved.some(function (i) { var e = endsOf(arm[i]); return sameEnds(s, e[0], e[1]); })) return rotSegA(s, P, -ang);
        return s;
      });
      return { ok: true, piece: outPc, armhole: outArm, forward: fwd, excludedCm: 0,
        restore: { kind: "flare-slash-undo", center: cp(P), angleDeg: fsRec.angleDeg, movedArmholeSegments: moved.length, excludedCm: 0, rule: fsRec.rule || null,
          note: "플레어 절개(진동 기준점 pivot)의 회전을 아랫점 쪽 조각에만 되돌림 — 다트 닫힘은 이후 기존 판독이 처리" } };
    }
    // 허리 이음선 Ⓜ·Ⓝ
    var A = wsRec.apex, th = wsRec.dartAngleRad, T = wsRec.slashEnd, Tp = wsRec.slashEndRotated, e0 = wsRec.armholeEaseCm;
    if (!A || !T || !Tp || !fin(th) || !fin(e0) || !fin(A.x) || !fin(T.x) || !fin(Tp.x)) return bad("waist-seam-record-invalid");
    if (!samePt(rot(Tp, A, -th), T, RESTORE_TOL)) return bad("waist-seam-rotation-mismatch", dist(rot(Tp, A, -th), T));
    var gaps = []; arm.forEach(function (sg, i) { if (sg.kind === "line" && sameEnds(sg, Tp, T, RESTORE_TOL)) gaps.push(i); });
    if (gaps.length !== 1) return bad("waist-seam-gap-line-not-unique", gaps.length);
    var gapLen = dist(arm[gaps[0]].from, arm[gaps[0]].to);
    if (Math.abs(gapLen - e0) > RESTORE_TOL) return bad("waist-seam-gap-length-mismatch", { measured: gapLen, recorded: e0 });
    var spliceRoot = piece + "/armhole-splice", isSplice = function (s) { return !!(s.boundary && s.boundary.root === spliceRoot); };
    var mv = []; arm.forEach(function (sg, i) { if (isSplice(sg)) mv.push(i); });
    if (!mv.length) return bad("waist-seam-moved-armhole-missing");
    outArm = []; fwd = [];
    arm.forEach(function (sg, i) {
      if (i === gaps[0]) return;
      if (isSplice(sg)) { outArm.push(rotSegA(sg, A, -th)); fwd.push({ center: cp(A), angleRad: th }); }
      else { outArm.push(sg); fwd.push(null); }
    });
    // 되돌린 옆 조각 진동이 T(원래 이음점)에 정확히 닿아야 한다
    if (!outArm.some(function (sg, j) { if (!fwd[j]) return false; var e = endsOf(sg); return samePt(e[0], T, RESTORE_TOL) || samePt(e[1], T, RESTORE_TOL); })) return bad("waist-seam-restored-armhole-not-at-T");
    outPc.outline = [];
    pc.outline.forEach(function (s) {
      if (s.kind === "line" && s.edge === "armhole" && sameEnds(s, Tp, T, RESTORE_TOL)) return;   // 틈 메움 직선 — 측정 복사본에서 뺀다
      var r = s.boundary && s.boundary.root;
      outPc.outline.push((r === spliceRoot || r === piece + "/side-seam-splice") ? rotSegA(s, A, -th) : s);
    });
    return { ok: true, piece: outPc, armhole: outArm, forward: fwd, excludedCm: gapLen,
      restore: { kind: "waist-seam-undo", center: cp(A), angleDeg: th * 180 / Math.PI, dartId: wsRec.dartId || null, movedArmholeSegments: mv.length,
        excludedCm: gapLen, gapLine: { from: cp(arm[gaps[0]].from), to: cp(arm[gaps[0]].to) },
        note: "허리 다트 닫힘 회전을 옆 조각에만 되돌림 · T′→T 틈 메움 직선은 다트 입구로 보아 봉제 진동에서 제외" } };
  }
  // 반환 { ok, bodice(측정 복사본 — 기록 없으면 원본 그대로), restore:{front,back}|null, forward:{front,back} } | { ok:false, reason, detail }
  function blockEquivalentBodice(bodiceResult) {
    if (!bodiceResult || !bodiceResult.front || !bodiceResult.back || !bodiceResult.armhole) return { ok: true, bodice: bodiceResult, restore: null, forward: null };
    var rf = restorePiece(bodiceResult, "front"); if (!rf.ok) return rf;
    var rbk = restorePiece(bodiceResult, "back"); if (!rbk.ok) return rbk;
    if (!rf.restore && !rbk.restore) return { ok: true, bodice: bodiceResult, restore: null, forward: null };
    var lens = bodiceResult.armholeLengths || {};
    var copy = { hash: bodiceResult.hash, front: rf.piece || bodiceResult.front, back: rbk.piece || bodiceResult.back,
      armhole: { front: rf.armhole || bodiceResult.armhole.front, back: rbk.armhole || bodiceResult.armhole.back },
      // 저장 AH 와 같은 정밀도(소수 4자리 — bodiceCheckpoint round4)로 남긴다: 봉제 AH 도 같은 측정 권위의 값이다.
      armholeLengths: { front: round4A(lens.front - (rf.excludedCm || 0)), back: round4A(lens.back - (rbk.excludedCm || 0)) } };
    return { ok: true, bodice: copy, restore: { front: rf.restore, back: rbk.restore },
      forward: { front: rf.forward || bodiceResult.armhole.front.map(function () { return null; }), back: rbk.forward || bodiceResult.armhole.back.map(function () { return null; }) } };
  }
  // 소매 제도·봉제 비교용 진동 길이(저장 AH − 확인된 틈 메움 직선). 복원 기록이 없으면 저장 AH 객체 그대로. 기록이 형상과 맞지 않으면 null.
  function sewnArmholeLengths(bodiceResult) {
    if (!bodiceResult || !bodiceResult.armholeLengths) return null;
    var be = blockEquivalentBodice(bodiceResult);
    return be.ok ? be.bodice.armholeLengths : null;
  }

  // 반환 { ok, back:{shoulder,shoulderStored,underarm,heightCm,heightStoredCm,armholeLengthCm,closedDart}, front:{…}, sourceBodiceHash }
  //   | { ok:false, reason, piece? }.  실패 reason 은 readPiece + no-bodice / invalid-armhole-length / armhole-underarm-mismatch / invalid-shoulder-height.
  function readBodiceArmhole(bodiceResult) {
    if (!bodiceResult || typeof bodiceResult !== "object" || !bodiceResult.front || !bodiceResult.back) return { ok: false, reason: "no-bodice" };
    var lens0 = bodiceResult.armholeLengths;
    if (!lens0 || !fin(lens0.front) || !fin(lens0.back) || lens0.front <= 0 || lens0.back <= 0) return { ok: false, reason: "invalid-armhole-length" };
    var be = blockEquivalentBodice(bodiceResult);
    if (!be.ok) return be;
    var src = be.bodice, lens = src.armholeLengths;
    var out = { ok: true, sourceBodiceHash: bodiceResult.hash !== undefined ? bodiceResult.hash : null };
    for (var k = 0; k < 2; k++) {
      var piece = k ? "front" : "back", r = readPiece(src, piece);
      if (!r.ok) { r.piece = piece; return r; }
      var rs = be.restore && be.restore[piece], fw = be.forward ? be.forward[piece] : null;
      // 보관(몸판) 좌표: 복원한 조각 위 점은 그 조각의 정변환으로 되돌린다(아랫점·어깨점)
      var toStored = function (p) {
        if (!fw) return p;
        for (var i2 = 0; i2 < src.armhole[piece].length; i2++) {
          var e2 = endsOf(src.armhole[piece][i2]);
          if (fw[i2] && (samePt(e2[0], p) || samePt(e2[1], p))) return rot(p, fw[i2].center, fw[i2].angleRad);
        }
        return p;
      };
      var uS = toStored(r.underarmStored), sS = toStored(r.shoulderStored);
      var h = r.underarm.y - r.shoulder.y, hs = uS.y - sS.y;
      if (!(h > 0)) return { ok: false, reason: "invalid-shoulder-height", piece: piece };
      var cl = 0; r.armholeClosed.forEach(function (pl) { cl += polyLen(pl); });
      out[piece] = { shoulder: r.shoulder, shoulderStored: sS, underarm: r.underarm, underarmStored: uS,
        heightCm: h, heightStoredCm: hs, armholeLengthCm: lens[piece], closedDart: r.closedDart, closedShoulderDart: r.closedShoulderDart,
        armholeClosed: r.armholeClosed, armholeClosedLengthCm: cl, underarmBlock: r.underarmBlock, placement: r.placement,
        // 측정 복사본(원형 등가) 진동 + 조각별 정변환(복사본 → 보관). 달림 끝 등 «호 길이 → 몸판 위치» 대응에 쓴다.
        armholeMeasure: src.armhole[piece], underarmMeasure: r.underarmStored, armholeForward: fw };
      if (rs) { out[piece].restore = rs; out[piece].armholeStoredCm = lens0[piece]; }
    }
    // 가슴둘레선(진동 아랫점 높이)이 앞뒤 같아야 한다 — 다트 닫기로 생긴 **순수 배치 회전**(위 정규화)만 되돌린 원형 등가 위치에서 비교한다.
    //   정규화가 없으면 보관 위치 그대로(기존 판정과 같다). 진동 자체가 디자인으로 바뀐 몸판(절개 추가·옆선 변경 등)은 여전히 여기서 멈춘다.
    if (Math.abs(out.front.underarmBlock.y - out.back.underarmBlock.y) > UNDERARM_Y_TOL) {
      return { ok: false, reason: "armhole-underarm-mismatch", detail: { front: out.front.underarmStored.y, back: out.back.underarmStored.y,
        frontBlock: out.front.underarmBlock.y, backBlock: out.back.underarmBlock.y, placement: { front: out.front.placement ? out.front.placement.kind : null, back: out.back.placement ? out.back.placement.kind : null } } };
    }
    return out;
  }

  // ── 제도 ───────────────────────────────────────────────────────────────────
  // 한 변(s = −1 뒤 / +1 앞)의 SP→아랫점 cubic 두 개 + 구성 점.
  function sideCurve(s, lineLenCm, H, tri) {
    var w = Math.sqrt(lineLenCm * lineLenCm - H * H);
    var U = { x: s * w, y: H }, d = { x: U.x / lineLenCm, y: U.y / lineLenCm };
    var T = { x: d.x * tri, y: d.y * tri };
    var n = { x: d.y, y: -d.x };               // d 의 직각, 위(−y)·바깥 방향
    if (n.y > 0) { n.x = -n.x; n.y = -n.y; }
    var P = { x: T.x + n.x * BULGE, y: T.y + n.y * BULGE };
    var h1 = dist({ x: 0, y: 0 }, P) * HANDLE, h2 = dist(P, U) * HANDLE;
    var q1 = [{ x: 0, y: 0 }, { x: s * FLAT, y: 0 }, { x: P.x - d.x * h1, y: P.y - d.y * h1 }, P];
    var q2 = [P, { x: P.x + d.x * h2, y: P.y + d.y * h2 }, { x: U.x - s * h2, y: H }, U];
    return { s: s, lineLen: lineLenCm, U: U, T: T, P: P, d: d, cubics: [q1, q2] };
  }

  // ⑧ 한 변 조정: 아랫점을 수평으로 Δ(바깥 +). 높이 불변. 반환 { cubics, U, snapDy } | { error }.
  function adjustSide(side, delta, H) {
    var s = side.s, cubs = side.cubics.map(function (q) { return q.map(cp); });
    if (!(Math.abs(delta) > 0)) return { cubics: cubs, U: cp(side.U), snapDy: 0 };
    var last = cubs[cubs.length - 1];
    if (delta > 0) {   // 연장: 끝 접선(수평) 그대로 새 아랫점까지 곧게 이어 붙인다.
      var U0 = last[3], U1 = { x: U0.x + s * delta, y: H };
      cubs.push([cp(U0), { x: U0.x + s * delta / 3, y: H }, { x: U0.x + s * delta * 2 / 3, y: H }, U1]);
      return { cubics: cubs, U: U1, snapDy: 0 };
    }
    // 절단: 곡선 끝에서 수평으로 |Δ| 만큼 떨어진 곳에서 자른다(바깥 끝 cubic 안에서 해결돼야 한다).
    var span = Math.abs(last[0].x - last[3].x), want = -delta;
    if (!(want < span * 0.95)) return { error: "adjust-exceeds-curve" };
    var xEnd = last[3].x, lo = 0, hi = 1;   // |x(t) − xEnd| 는 t 에 대해 감소(끝 쪽이 0)
    for (var it = 0; it < 80; it++) {
      var mid = (lo + hi) / 2;
      if (Math.abs(cubicAt(last, mid).x - xEnd) > want) lo = mid; else hi = mid;
    }
    var cut = splitLeft(last, (lo + hi) / 2), snapDy = H - cut[3].y;
    cut[3] = { x: cut[3].x, y: H };           // 아랫점은 수평선 위(높이 불변) — 자른 곡선의 핸들은 그대로 둔다(접선 기울기는 snapDy 수준)
    cubs[cubs.length - 1] = cut;
    return { cubics: cubs, U: cp(cut[3]), snapDy: snapDy };
  }

  // 순수 측정값 입력. m = { backAHCm, frontAHCm, backShoulderHeightCm, frontShoulderHeightCm }.
  // params = { sleeveLengthCm(필수: SP→소매부리), elbowLengthCm?(SP→팔꿈치선), adjust?(기본 true) }.
  // 반환 { ok, geometry:{outline, construction}, meta, warnings } | { ok:false, reason }.
  function draftFromMeasures(m, params) {
    params = params || {};
    if (!m || !fin(m.backAHCm) || !fin(m.frontAHCm) || m.backAHCm <= 0 || m.frontAHCm <= 0) return { ok: false, reason: "invalid-armhole-length" };
    if (!fin(m.backShoulderHeightCm) || !fin(m.frontShoulderHeightCm) || m.backShoulderHeightCm <= 0 || m.frontShoulderHeightCm <= 0) return { ok: false, reason: "invalid-shoulder-height" };
    var slen = params.sleeveLengthCm, elbow = params.elbowLengthCm;
    if (!fin(slen) || slen <= 0) return { ok: false, reason: "invalid-sleeve-length" };
    if (elbow !== undefined && elbow !== null && (!fin(elbow) || elbow <= 0)) return { ok: false, reason: "invalid-elbow-length" };
    var adjust = params.adjust !== false;

    var H = ((m.backShoulderHeightCm + m.frontShoulderHeightCm) / 2) * 4 / 5;
    var Lb = m.backAHCm + BACK_PLUS, Lf = m.frontAHCm - FRONT_MINUS, tri = m.frontAHCm / 4;
    if (!(Lb > H && Lf > H)) return { ok: false, reason: "cap-height-exceeds-line" };
    if (!(slen > H + 1)) return { ok: false, reason: "invalid-sleeve-length" };
    if (elbow && !(elbow > H && elbow < slen)) return { ok: false, reason: "invalid-elbow-length" };

    var back = sideCurve(-1, Lb, H, tri), front = sideCurve(1, Lf, H, tri);
    var capB0 = cubicsLen(back.cubics), capF0 = cubicsLen(front.cubics);
    var ea = easeAdjustment({ capBackCm: capB0, capFrontCm: capF0, ahBackCm: m.backAHCm, ahFrontCm: m.frontAHCm });

    var adjB = { cubics: back.cubics, U: back.U, snapDy: 0 }, adjF = { cubics: front.cubics, U: front.U, snapDy: 0 };
    if (adjust) {
      adjB = adjustSide(back, ea.delta.back, H); adjF = adjustSide(front, ea.delta.front, H);
      if (adjB.error) return { ok: false, reason: adjB.error, piece: "back" };
      if (adjF.error) return { ok: false, reason: adjF.error, piece: "front" };
    }
    var capB1 = cubicsLen(adjB.cubics), capF1 = cubicsLen(adjF.cubics);

    // 소매산 곡선 한 개 path: 뒤 아랫점 → SP → 앞 아랫점.
    var chain = adjB.cubics.slice().reverse().map(reverseCubic).concat(adjF.cubics);
    var cmds = [{ type: "M", points: [cp(chain[0][0])] }];
    chain.forEach(function (q) { cmds.push({ type: "C", points: [cp(q[1]), cp(q[2]), cp(q[3])] }); });
    var cap = { kind: "path", commands: cmds };
    var Ub = adjB.U, Uf = adjF.U, hemY = slen;
    var backHem = { x: Ub.x, y: hemY }, frontHem = { x: Uf.x, y: hemY };
    var outline = [cap, L(Ub, backHem), L(Uf, frontHem), L(backHem, frontHem)];

    // 닫힌 외곽 점열: 뒤 아랫점 →(소매산)→ 앞 아랫점 → 앞 소매부리 → 뒤 소매부리 → 뒤 아랫점.
    var capPts = flattenCubics(chain, 60);
    var loop = capPts.concat([frontHem, backHem, cp(capPts[0])]);
    var selfX = loopSelfIntersects(loop);
    if (selfX) return { ok: false, reason: "self-intersection" };
    // 연결(소매산 path 안은 구성상 이어짐 — 끝점이 옆선 시작과 일치).
    var connected = dist(capPts[0], Ub) < 1e-9 && dist(capPts[capPts.length - 1], Uf) < 1e-9;
    var topY = Infinity, topAt = 0; capPts.forEach(function (p, i) { if (p.y < topY) { topY = p.y; topAt = i; } });
    // 소매산 최고점은 SP 여야 한다(곡선이 SP 위로 솟으면 소매산 높이 정의가 깨진다 — 극단 치수에서만 발생).
    var apexIsSP = topAt > 0 && topAt < capPts.length - 1 && Math.abs(topY) < 1e-9;
    if (!apexIsSP) return { ok: false, reason: "cap-apex-not-sp" };

    var minX = Math.min(back.U.x, Ub.x), maxX = Math.max(front.U.x, Uf.x);
    var construction = [
      L({ x: 0, y: 0 }, { x: 0, y: hemY }, "center-line"),
      L({ x: minX, y: H }, { x: maxX, y: H }, "underarm-level"),
      L({ x: 0, y: 0 }, back.U, "back-line"), L({ x: 0, y: 0 }, front.U, "front-line"),
      L(back.T, back.P, "back-bulge"), L(front.T, front.P, "front-bulge")
    ];
    if (elbow) construction.push(L({ x: Math.min(Ub.x, minX), y: elbow }, { x: Math.max(Uf.x, maxX), y: elbow }, "elbow-line"));

    var ease1 = easeAdjustment({ capBackCm: capB1, capFrontCm: capF1, ahBackCm: m.backAHCm, ahFrontCm: m.frontAHCm });
    var warnings = [];
    if (Math.abs(ea.delta.back) >= 1 || Math.abs(ea.delta.front) >= 1) warnings.push("ease-adjust-ge-1cm");   // 책: 1cm 이상이면 치수 오측정 가능 — 관찰용
    return {
      ok: true,
      geometry: { outline: outline, construction: construction },
      meta: {
        rule: "pattern-school-p137-type4",
        capHeightCm: H, shoulderHeightsCm: { back: m.backShoulderHeightCm, front: m.frontShoulderHeightCm },
        armholeCm: { back: m.backAHCm, front: m.frontAHCm },
        lineCm: { back: Lb, front: Lf }, triangleCm: tri, bulgeCm: BULGE, flatCm: FLAT,
        sp: { x: 0, y: 0 }, capSplit: { anchorIndex: adjB.cubics.length, point: { x: 0, y: 0 } },
        bulgePoints: { back: cp(back.P), front: cp(front.P) }, guidePoints: { backTriangle: cp(back.T), frontTriangle: cp(front.T) },
        underarm: { before: { back: cp(back.U), front: cp(front.U) }, after: { back: cp(Ub), front: cp(Uf) } },
        capLengthsBefore: { back: capB0, front: capF0, total: capB0 + capF0 },
        easeTarget: ea.target, easeBefore: ea.current, delta: ea.delta,
        adjusted: adjust, shiftCm: { back: adjust ? ea.delta.back : 0, front: adjust ? ea.delta.front : 0 },
        capLengths: { back: capB1, front: capF1, total: capB1 + capF1 }, easeAfter: ease1.current,
        residualCm: { back: ease1.current.back - ea.target.back, front: ease1.current.front - ea.target.front },
        trimSnapDyCm: { back: adjB.snapDy, front: adjF.snapDy },
        bicepCm: Uf.x - Ub.x, sleeveLengthCm: slen, elbowLengthCm: elbow || null,
        checks: { closed: true, connected: connected, selfIntersection: selfX, apexIsSP: apexIsSP }
      },
      warnings: warnings
    };
  }

  // bodiceResult → 소매 Ⓐ. bodiceResult 는 읽기만 한다(동결 객체 OK).
  function draftSleeveA(bodiceResult, params) {
    var r = readBodiceArmhole(bodiceResult);
    if (!r.ok) return r;
    var d = draftFromMeasures({ backAHCm: r.back.armholeLengthCm, frontAHCm: r.front.armholeLengthCm,
      backShoulderHeightCm: r.back.heightCm, frontShoulderHeightCm: r.front.heightCm }, params);
    if (!d.ok) return d;
    d.sourceBodiceHash = r.sourceBodiceHash;
    d.meta.source = {
      back: { shoulder: cp(r.back.shoulder), shoulderStored: cp(r.back.shoulderStored), underarm: cp(r.back.underarm), underarmStored: cp(r.back.underarmStored),
        heightStoredCm: r.back.heightStoredCm, shoulderDartClosed: !!r.back.closedShoulderDart,
        shoulderDartAngleDeg: r.back.closedShoulderDart ? r.back.closedShoulderDart.angleRad * 180 / Math.PI : null },
      front: { shoulder: cp(r.front.shoulder), shoulderStored: cp(r.front.shoulderStored), underarm: cp(r.front.underarm),
        heightStoredCm: r.front.heightStoredCm, dartClosed: !!r.front.closedDart,
        dartAngleDeg: r.front.closedDart ? r.front.closedDart.angleRad * 180 / Math.PI : null }
    };
    // 배치 정규화가 쓰인 몸판에만 기록(없으면 필드 없음 — 기존 결과 바이트 동일)
    ["front", "back"].forEach(function (pc) {
      var pl = r[pc].placement; if (!pl) return;
      d.meta.source[pc].placement = { kind: pl.kind, apex: cp(pl.apex), angleDeg: (pl.angleRad !== undefined ? pl.angleRad : pl.closedAngleRad) * 180 / Math.PI,
        underarmBlock: cp(r[pc].underarmBlock), note: pl.note };
    });
    // 원형 등가 복원이 쓰인 몸판에만 기록(없으면 필드 없음 — 기존 결과 바이트 동일). 저장 AH(표시 형상)와 봉제용 AH 를 따로 남긴다.
    ["front", "back"].forEach(function (pc) {
      var rs = r[pc].restore; if (!rs) return;
      d.meta.source[pc].restore = JSON.parse(JSON.stringify(rs));
      d.meta.source[pc].armholeStoredCm = r[pc].armholeStoredCm;
      d.meta.source[pc].armholeSewnCm = r[pc].armholeLengthCm;
    });
    return d;
  }

  window.designSleeveA = Object.freeze({ draftSleeveA: draftSleeveA, draftFromMeasures: draftFromMeasures,
    readBodiceArmhole: readBodiceArmhole, easeAdjustment: easeAdjustment, blockEquivalentBodice: blockEquivalentBodice, sewnArmholeLengths: sewnArmholeLengths,
    RULES: Object.freeze({ backPlusCm: BACK_PLUS, frontMinusCm: FRONT_MINUS, bulgeCm: BULGE, flatCm: FLAT, easeRate: EASE_RATE, backShare: BACK_SHARE, frontShare: FRONT_SHARE }) });
})();
