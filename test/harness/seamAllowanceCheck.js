// ══════════════════════════════════════════════
// seamAllowanceCheck.js — 시접 순수 기하(js/seamAllowance.js) 독립 검산 (2026-11-14 · 엔진·DOM 없음)
//   검사는 모듈의 내부 함수를 쓰지 않고 결과 점열만 본다(직접 거리·면적·교차·접기 재현).
//   §1 직선 사각형: 독립 거리 = 폭 · 모서리 = 연장 교점 · 면적 · 폭 0(골선) · 변별 다른 폭 · 입력 불변 · 방향 무관
//   §2 곡선: 정확한 시접선(완성 곡선 + 법선×폭, 2000점)과의 오차 ≤ 0.01cm · 반경 < 폭 = 거부
//   §3 모서리 거부: 급각(한도 초과) · 일직선 단차 · 오목 모서리 한쪽 0 · 짧은 변
//   §4 오목: 정상 L 자 = 교차점에서 자름 · 좁은 골 = 거부(몰래 잘라내지 않음)
//   §5 열린 다트: 접기 → 시접 → 펼침. 펼친 산을 독립적으로 다시 접으면 위 겹 시접선 위에 놓인다 · 방향 반대 = 다른 모양 ·
//      방향 없음 = 거부 · 폭 0 = 완성선 V 그대로 · 다리 길이 차 = 고치지 않고 보고
//   §6 입력 오류 거부(열린 외곽 · 폭 NaN/음수/초과 · 빠진 선)
//   node test/harness/seamAllowanceCheck.js
// ══════════════════════════════════════════════
"use strict";
const path = require("path");
const SA = require(path.join(__dirname, "..", "..", "js", "seamAllowance.js"));
let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
process.on("uncaughtException", e => { console.log("seamAllowanceCheck: 예외 — " + (e && e.stack || e).toString().split("\n").slice(0, 3).join(" | ")); fails.slice(0, 20).forEach(f => console.log("  ✗ " + f)); process.exit(1); });
const J = JSON.stringify, near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
const L = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
const C = (a, b, c, d) => ({ kind: "cubic", from: { x: a[0], y: a[1] }, c1: { x: b[0], y: b[1] }, c2: { x: c[0], y: c[1] }, to: { x: d[0], y: d[1] } });
const poly = pts => pts.map((p, i) => L(p, pts[(i + 1) % pts.length]));
const each = (ring, w) => ring.map((s, i) => ({ id: "e" + i, segs: [i], widthCm: Array.isArray(w) ? w[i] : w }));
// ── 독립 계측 ──
const cub = (s, t) => { const u = 1 - t; return { x: u * u * u * s.from.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.to.x, y: u * u * u * s.from.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.to.y }; };
const dense = (ring, n) => { const o = []; ring.forEach(s => { for (let k = 0; k < n; k++) { const t = k / n; o.push(s.kind === "cubic" ? cub(s, t) : { x: s.from.x + (s.to.x - s.from.x) * t, y: s.from.y + (s.to.y - s.from.y) * t }); } }); return o; };
const dSeg = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2)) : 0; return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t); };
const dClosed = (p, pts) => { let m = Infinity; for (let i = 0; i < pts.length; i++) m = Math.min(m, dSeg(p, pts[i], pts[(i + 1) % pts.length])); return m; };
const area = pts => { let a = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }); return Math.abs(a / 2); };
const crosses = pts => { const m = pts.length, X = (a, b, c, d) => { const r = { x: b.x - a.x, y: b.y - a.y }, q = { x: d.x - c.x, y: d.y - c.y }, den = r.x * q.y - r.y * q.x; if (Math.abs(den) < 1e-12) return false; const s = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den, u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den; return s >= 0 && s <= 1 && u >= 0 && u <= 1; };
  let n = 0; for (let a = 0; a < m; a++) for (let b = a + 2; b < m; b++) { if (a === 0 && b === m - 1) continue; if (X(pts[a], pts[(a + 1) % m], pts[b], pts[(b + 1) % m])) n++; } return n; };
const walk = (pts, step) => { const o = []; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], l = Math.hypot(q.x - p.x, q.y - p.y), n = Math.max(1, Math.ceil(l / step)); for (let k = 0; k < n; k++) o.push({ x: p.x + (q.x - p.x) * k / n, y: p.y + (q.y - p.y) * k / n }); }); return o; };
const has = (pts, x, y, e) => pts.some(p => Math.hypot(p.x - x, p.y - y) <= (e || 1e-9));
const code = r => r.refusals.map(x => x.code).join(",");

// ══ §1 직선 사각형 ══
{
  const sq = poly([[0, 0], [10, 0], [10, 6], [0, 6]]), before = J(sq);
  const r = SA.build({ ring: sq, edges: each(sq, 1) });
  ok(r.ok && r.points.length === 4 && [[-1, -1], [11, -1], [11, 7], [-1, 7]].every(c => has(r.points, c[0], c[1])), "1: 사각형 1cm → 꼭짓점 4개 = 연장 교점(±1) (" + (r.points && r.points.length) + ")");
  ok(near(area(r.points), 12 * 8) && crosses(r.points) === 0, "1: 면적 96 · 교차 0 (독립)");
  const fin = dense(sq, 50), w = walk(r.points, 0.05).map(p => dClosed(p, fin.length ? poly([[0, 0], [10, 0], [10, 6], [0, 6]]).map(s => s.from) : []));
  ok(Math.min(...w) >= 1 - 1e-9 && near(Math.max(...w), Math.SQRT2, 1e-9), "1: 시접선 위 모든 점의 완성선 거리 ≥ 1 · 최대 = 모서리 √2 (" + Math.min(...w) + " ~ " + Math.max(...w) + ")");
  ok(J(sq) === before && r.stats.maxMiterCm === 1.414 && r.stats.minCornerDeg === 90, "1: 입력 불변 · 통계(모서리 90° · 연장 1.414)");
  const rev = poly([[0, 6], [10, 6], [10, 0], [0, 0]]), r2 = SA.build({ ring: rev, edges: each(rev, 1) });
  ok(r2.ok && near(area(r2.points), 96) && has(r2.points, -1, -1), "1: 외곽 방향이 반대여도 바깥으로(면적 96)");
  // 골선(폭 0) + 다른 폭: 왼 변 0 · 아랫변 2 · 나머지 1
  const r3 = SA.build({ ring: sq, edges: each(sq, [2, 1, 1, 0]) });   // e0 아랫변(y=0) 2 · e1 오른변 1 · e2 윗변 1 · e3 왼변 0
  ok(r3.ok && has(r3.points, 0, -2) && has(r3.points, 11, -2) && has(r3.points, 11, 7) && has(r3.points, 0, 7) && r3.points.length === 4, "1: 골선 0 = 완성선 연장 위에서 만남((0,−2)·(0,7)) · 변별 폭 2/1/1/0 (" + J(r3.points) + ")");
  ok(near(area(r3.points), 11 * 9) && r3.points.every(p => p.x >= -1e-12), "1: 골선 쪽으로는 한 점도 나가지 않음 · 면적 99");
  const r0 = SA.build({ ring: sq, edges: each(sq, 0) });
  ok(r0.ok && near(area(r0.points), 60) && r0.points.length === 4, "1: 전부 0 = 완성선 그대로");
  const one = SA.build({ ring: sq, edges: [{ id: "all", segs: [0, 1, 2, 3], widthCm: 1.5 }] });
  ok(one.ok && near(area(one.points), 13 * 9) && Object.keys(one.edgePaths).join() === "all", "1: 조각 전체 한 변(한 값 1.5) = 면적 117");
}

// ══ §2 곡선 ══
{
  // 진동 닮은 오목 곡선(바깥에서 보아 안으로 굽음) + 직선 3변
  const cv = C([10, 0], [10, 4], [13, 8], [18, 9]), ring = [L([0, 0], [10, 0]), cv, L([18, 9], [18, 14]), L([18, 14], [0, 14]), L([0, 14], [0, 0])];
  const edges = [{ id: "a", segs: [0], widthCm: 1 }, { id: "curve", segs: [1], widthCm: 1 }, { id: "c", segs: [2], widthCm: 1 }, { id: "d", segs: [3], widthCm: 1 }, { id: "e", segs: [4], widthCm: 1 }];
  const r = SA.build({ ring, edges });
  ok(r.ok && crosses(r.points) === 0, "2: 곡선 포함 외곽 = 시접 완료 · 교차 0 (" + code(r) + ")");
  // 정확한 시접선: 완성 곡선의 점 + 단위 법선 × 폭 (해석 미분 · 모듈과 무관)
  const d1 = (s, t) => { const u = 1 - t; return { x: 3 * u * u * (s.c1.x - s.from.x) + 6 * u * t * (s.c2.x - s.c1.x) + 3 * t * t * (s.to.x - s.c2.x), y: 3 * u * u * (s.c1.y - s.from.y) + 6 * u * t * (s.c2.y - s.c1.y) + 3 * t * t * (s.to.y - s.c2.y) }; };
  const cp = r.edgePaths.curve; let worst = 0, side = 0;
  for (let k = 20; k <= 1980; k++) { const t = k / 2000, p = cub(cv, t), v = d1(cv, t), l = Math.hypot(v.x, v.y), n = { x: v.y / l, y: -v.x / l };
    const cand = [{ x: p.x + n.x, y: p.y + n.y }, { x: p.x - n.x, y: p.y - n.y }].map(q => { let m = Infinity; for (let i = 0; i + 1 < cp.length; i++) m = Math.min(m, dSeg(q, cp[i], cp[i + 1])); return m; });
    const best = Math.min(cand[0], cand[1]); if (best > worst) worst = best; side += cand[0] < cand[1] ? 1 : -1; }
  ok(worst <= 0.01, "2: 정확한 시접 곡선(2000점)과 점열의 최대 오차 ≤ 0.01cm (" + worst.toFixed(5) + ")");
  ok(Math.abs(side) === 1961, "2: 곡선 전체가 한쪽(바깥)으로만");
  const fin = dense(ring, 400), dist = cp.slice(1, -1).map(p => { let m = Infinity; for (let i = 0; i < fin.length; i++) m = Math.min(m, Math.hypot(p.x - fin[i].x, p.y - fin[i].y)); return m; });
  ok(Math.min(...dist) >= 1 - 0.01 && Math.max(...dist) <= 1 + 0.01, "2: 곡선 시접 점의 완성선 거리 = 1 ± 0.01 (" + Math.min(...dist).toFixed(4) + " ~ " + Math.max(...dist).toFixed(4) + ")");
  ok(r.stats.minConcaveRadiusCm > 1 && cp.length >= 9, "2: 가장 급한 오목 반경 보고(" + r.stats.minConcaveRadiusCm + ") · 점열 " + cp.length + "점");
  const big = SA.build({ ring, edges: edges.map(e => e.id === "curve" ? Object.assign({}, e, { widthCm: r.stats.minConcaveRadiusCm + 0.5 }) : e) });
  ok(!big.ok && big.points === null && big.refusals.some(x => x.code === "radius" && x.edgeIds.join() === "curve" && /반경/.test(x.reason)), "2: 폭 > 오목 반경 = 거부 + 사유(잘라내지 않음) (" + code(big) + ")");
  ok(!big.edgePaths.curve && !!big.edgePaths.d, "2: 거부된 변의 시접선은 내지 않고, 멀쩡한 변은 표시용으로 남김");
}

// ══ §3 모서리 거부 ══
{
  const tri = poly([[0, 0], [20, 0], [0, 2]]), r = SA.build({ ring: tri, edges: each(tri, 1) });   // 꼭짓점 (20,0) 내각 ≈ 5.7°
  ok(!r.ok && r.refusals.some(x => x.code === "sharp" && /뾰족/.test(x.reason) && x.edgeIds.length === 2), "3: 급각(5.7°) = 무한 연장 대신 거부 + 사유 (" + code(r) + ")");
  const ok60 = poly([[0, 0], [10, 0], [5, 8.66]]), r60 = SA.build({ ring: ok60, edges: each(ok60, 1) });
  ok(r60.ok && near(r60.stats.maxMiterCm, 2, 1e-3), "3: 60° 모서리 = 허용(연장 2.0 ≤ 한도 4)");
  const bar = [L([0, 0], [5, 0]), L([5, 0], [10, 0]), L([10, 0], [10, 4]), L([10, 4], [0, 4]), L([0, 4], [0, 0])];
  const st = SA.build({ ring: bar, edges: each(bar, [1, 2, 1, 1, 1]) });
  ok(!st.ok && st.refusals.some(x => x.code === "step" && /계단/.test(x.reason)), "3: 일직선으로 이어진 두 변의 폭이 다르면 거부(계단) (" + code(st) + ")");
  ok(SA.build({ ring: bar, edges: each(bar, 1) }).ok, "3: 같은 폭이면 일직선 이음 정상");
  const Lsh = poly([[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]]);   // 오목 모서리 (4,4)
  const z = SA.build({ ring: Lsh, edges: each(Lsh, [1, 1, 0, 1, 1, 1]) });
  ok(!z.ok && z.refusals.some(x => x.code === "concave-zero"), "3: 오목 모서리에서 한쪽만 0 = 거부 (" + code(z) + ")");
  const tiny = poly([[0, 0], [10, 0], [10, 4], [4, 4], [4, 4.5], [0, 4.5]]);   // 오목 뒤 변 길이 0.5 < 폭 1
  const t = SA.build({ ring: tiny, edges: each(tiny, 1) });
  ok(!t.ok && t.points === null, "3: 시접보다 짧은 변이 오목 모서리에 있으면 거부 (" + code(t) + ")");
}

// ══ §4 오목 ══
{
  const Lsh = poly([[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]]), r = SA.build({ ring: Lsh, edges: each(Lsh, 1) });
  ok(r.ok && has(r.points, 5, 5) && r.points.length === 6 && crosses(r.points) === 0, "4: L 자 오목 모서리 = 두 시접선의 교차점 (5,5) 에서 자름");
  ok(near(area(r.points), 12 * 6 + 6 * 6), "4: 면적 108 (독립)");
  const w = walk(r.points, 0.05).map(p => dClosed(p, Lsh.map(s => s.from)));
  ok(Math.min(...w) >= 1 - 1e-9, "4: 모든 점이 완성선에서 1 이상");
  // 폭 1.5 인 골(양옆 변이 마주 봄) — 1cm 시접은 서로 겹친다
  const U = poly([[0, 0], [10, 0], [10, 8], [5.75, 8], [5.75, 2], [4.25, 2], [4.25, 8], [0, 8]]), u = SA.build({ ring: U, edges: each(U, 1) });
  ok(!u.ok && u.points === null && u.refusals.length >= 1 && /시접/.test(u.refusals[0].reason), "4: 폭 1.5 골에 1cm = 거부 + 사유(몰래 잘라내지 않음) (" + code(u) + ")");
  ok(SA.build({ ring: U, edges: each(U, 0.5) }).ok, "4: 같은 골에 0.5cm = 정상");
  const U2 = poly([[0, 0], [10, 0], [10, 8], [6, 8], [6, 2], [4, 2], [4, 8], [0, 8]]), t2 = SA.build({ ring: U2, edges: each(U2, 1) });
  ok(!t2.ok && t2.points === null, "4: 폭 2 골에 1cm = 시접선이 맞닿음(퇴화) → 거부 (" + code(t2) + ")");
}

// ══ §5 열린 다트 ══
{
  // 윗변에 다트. 중심 = x 0 쪽. 윗변은 중심 쪽으로 올라간다(어깨처럼). 다리 길이는 같게 잡는다.
  const apex = [5, 4], mT = [4, 10], lenT = Math.hypot(1, 6), ang = Math.atan2(6, 1), mU = [5 + lenT * Math.cos(ang - 0), 0];
  const dU = [1 / lenT, 6 / lenT]; mU[0] = 5 + dU[0] * lenT; mU[1] = 4 + dU[1] * lenT;   // (6,10)
  const ring = [L([0, 0], [10, 0]), L([10, 0], [10, 9]), L([10, 9], mU), L(mU, apex), L(apex, mT), L(mT, [0, 11]), L([0, 11], [0, 0])];
  const mk = (top, w) => [{ id: "bottom", segs: [0], widthCm: 1 }, { id: "side", segs: [1], widthCm: 1 }, { id: "top", segs: [2, 3, 4, 5], widthCm: w == null ? 1 : w, darts: [{ legs: [3, 4], topFirst: top }] }, { id: "center", segs: [6], widthCm: 0 }];
  const r = SA.build({ ring, edges: mk(false) });   // 위 겹 = 뒤쪽 run(mT 쪽 = 중심 쪽)
  ok(r.ok && r.darts.length === 1 && crosses(r.points) === 0, "5: 다트 있는 변 = 시접 완료 (" + code(r) + ")");
  const D = r.darts[0], A = { x: 5, y: 4 };
  // 독립 접기: 다트 분량을 중심 쪽 다리선 너머로 눕힌다(중심 쪽 반 = 다리선 반사 · 바깥쪽 반 = 다트 각만큼 회전)
  const vT = { x: (mT[0] - 5) / lenT, y: (mT[1] - 4) / lenT }, vU = { x: dU[0], y: dU[1] }, th = Math.atan2(vU.x * vT.y - vU.y * vT.x, vU.x * vT.x + vU.y * vT.y);
  const rotP = (p, a) => ({ x: A.x + (p.x - A.x) * Math.cos(a) - (p.y - A.y) * Math.sin(a), y: A.y + (p.x - A.x) * Math.sin(a) + (p.y - A.y) * Math.cos(a) });
  const refl = p => { const v = { x: p.x - A.x, y: p.y - A.y }, k = v.x * vT.x + v.y * vT.y; return { x: A.x + 2 * k * vT.x - v.x, y: A.y + 2 * k * vT.y - v.y }; };
  const angOf = p => Math.atan2(vT.x * (p.y - A.y) - vT.y * (p.x - A.x), vT.x * (p.x - A.x) + vT.y * (p.y - A.y));   // 중심 쪽 다리에서 잰 각(+ = 다트 안쪽)
  const top = r.edgePaths.top, iU = top.findIndex(p => Math.hypot(p.x - D.onLegU.x, p.y - D.onLegU.y) < 1e-9), iT = top.findIndex(p => Math.hypot(p.x - D.onLegT.x, p.y - D.onLegT.y) < 1e-9);
  const cap = top.slice(Math.min(iU, iT), Math.max(iU, iT) + 1), half = Math.abs(th) / 2, sgn = th > 0 ? -1 : 1;
  ok(iU >= 0 && iT >= 0 && cap.length >= 3 && cap.every(p => { const a = angOf(p) * sgn; return a >= -1e-9 && a <= Math.abs(th) + 1e-9; }), "5: 산의 모든 점이 두 다리 사이(다트 분량 위)에 있음 (" + cap.length + "점)");
  // 위 겹(중심 쪽) 시접선 = 직선 (mT → (0,11)) 을 바깥으로 1
  const a0 = { x: mT[0], y: mT[1] }, dir = { x: -4 / Math.hypot(4, 1), y: 1 / Math.hypot(4, 1) }, nOut = { x: dir.y, y: -dir.x }, sideSign = (nOut.y > 0 ? 1 : -1);
  const offDist = p => ((p.x - a0.x) * nOut.x + (p.y - a0.y) * nOut.y) * sideSign;   // 중심 쪽 윗변에서 바깥으로 잰 거리(위쪽 +)
  const folded = cap.map(p => { const a = angOf(p) * sgn; return a <= half + 1e-9 ? refl(p) : rotP(p, th); });
  const errs = folded.map(p => Math.abs(Math.abs(offDist(p)) - 1));
  ok(Math.max(...errs) < 1e-9, "5: 펼친 산을 다시 접으면 전부 위 겹 시접선(중심 쪽 윗변에서 1cm) 위 — 접기→시접→펼침 복원 (최대 오차 " + Math.max(...errs).toExponential(1) + ")");
  ok(folded.every(p => angOf(p) * sgn <= 1e-9), "5: 접힌 다트 분량은 전부 중심 쪽 다리선 너머(중심 쪽 겹 아래)에 눕는다");
  const pk = D.peak, bis = angOf(pk) * sgn;
  const rad = p => Math.hypot(p.x - A.x, p.y - A.y);
  ok(near(bis, half, 1e-9) && near(D.legMismatchCm, 0, 1e-9) && near(rad(D.onLegT), rad(D.onLegU), 1e-9), "5: 산 꼭대기는 다트 중심선 위 · 두 다리 연장선 위 끝점은 꼭짓점에서 같은 거리(접으면 한 점)");
  const naive = { x: (D.onLegT.x + D.onLegU.x) / 2, y: (D.onLegT.y + D.onLegU.y) / 2 };
  ok(Math.hypot(pk.x - naive.x, pk.y - naive.y) > 0.05 && pk.y > Math.max(D.onLegT.y, D.onLegU.y), "5: 단순히 두 끝을 이은 선이 아니라 산 모양(꼭대기가 양 끝보다 바깥)");
  // 방향 반대 → 다른 모양(바깥쪽 윗변의 기울기를 닮는다)
  const r2 = SA.build({ ring, edges: mk(true) });
  ok(r2.ok && Math.hypot(r2.darts[0].peak.x - pk.x, r2.darts[0].peak.y - pk.y) > 0.05, "5: 접는 방향을 바꾸면 산 모양이 달라진다(방향이 결과를 정함) (" + J([pk, r2.darts[0].peak].map(p => [+p.x.toFixed(3), +p.y.toFixed(3)])) + ")");
  ok(pk.y > r2.darts[0].peak.y, "5: 중심 쪽 겹이 위 = 중심 쪽으로 올라가는 윗변을 닮아 산이 더 높다");
  const rn = SA.build({ ring, edges: mk(null) });
  ok(!rn.ok && rn.points === null && rn.refusals.some(x => x.code === "dart-direction" && x.edgeIds.join() === "top") && !rn.edgePaths.top && !!rn.edgePaths.bottom, "5: 접는 방향 없음 = 그 변만 거부 + 사유 · 다른 변은 표시");
  const r0 = SA.build({ ring, edges: mk(false, 0) });
  ok(r0.ok && has(r0.points, 5, 4) && has(r0.points, mT[0], mT[1]) && has(r0.points, mU[0], mU[1]), "5: 폭 0 = 완성선 그대로(다트 V 유지)");
  // 다리 길이가 다른 다트(실제 뒤 어깨 다트처럼) — 완성선은 고치지 않고 길이 차를 보고한다. 시접선은 끊기지 않는다.
  const ring2 = ring.map(s => J(s)).map(s => JSON.parse(s)); ring2[2].to = { x: 6.05, y: 10.3 }; ring2[3].from = { x: 6.05, y: 10.3 };
  const rm = SA.build({ ring: ring2, edges: mk(false) });
  ok(rm.ok && rm.darts[0].legMismatchCm > 0.2 && crosses(rm.points) === 0 && dClosed(rm.darts[0].onLegT, rm.points) < 1e-9 && dClosed(rm.darts[0].onLegU, rm.points) < 1e-9 && J(ring2[2].to) === J({ x: 6.05, y: 10.3 }),
    "5: 다리 길이 차 " + (rm.darts[0] && rm.darts[0].legMismatchCm.toFixed(3)) + "cm 보고 · 완성선 불변 · 시접 외곽 닫힘");
}

// ══ §6 입력 오류 ══
{
  const sq = poly([[0, 0], [10, 0], [10, 6], [0, 6]]);
  const open = sq.slice(0, 3), bad = (inp, re) => { const r = SA.build(inp); return !r.ok && r.points === null && r.refusals.length === 1 && r.refusals[0].code === "input" && re.test(r.refusals[0].reason); };
  ok(bad({ ring: open, edges: each(open, 1) }, /닫혀/), "6: 열린 외곽 거부");
  ok(bad({ ring: sq, edges: each(sq, NaN) }, /숫자/) && bad({ ring: sq, edges: each(sq, -1) }, /숫자/) && bad({ ring: sq, edges: each(sq, Infinity) }, /숫자/) && bad({ ring: sq, edges: each(sq, SA.MAX_WIDTH_CM + 0.1) }, /숫자/), "6: 폭 NaN·음수·무한·한도 초과 거부");
  ok(bad({ ring: sq, edges: each(sq, 1).slice(0, 3) }, /속하지 않은/) && bad({ ring: sq, edges: each(sq, 1).concat([{ id: "dup", segs: [0], widthCm: 1 }]) }, /겹치/), "6: 빠진 선 · 겹친 변 거부");
  ok(bad({ ring: null, edges: [] }, /읽을 수 없/) && bad({ ring: sq, edges: [] }, /변 정보/), "6: 빈 입력 거부");
  ok(SA.TOL_CM === 0.01 && SA.MITER_LIMIT === 4 && Object.isFrozen(SA), "6: 검증 기준 상수 공개(오차 0.01 · 모서리 한도 4배) · API 동결");
}

console.log("seamAllowanceCheck: " + PASS + " passed, " + FAIL + " failed");
fails.forEach(f => console.log("  FAIL " + f));
process.exit(FAIL ? 1 : 0);
