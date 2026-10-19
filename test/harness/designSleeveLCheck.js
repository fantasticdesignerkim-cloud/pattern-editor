// ══════════════════════════════════════════════
// designSleeveLCheck.js — js/designSleeveL.js(소매 Ⓛ 반소매 퍼프, [패턴학교] P.46 «소맷부리를 잘라서 벌린다» — 2026-10-13 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값(소매길이 20 · 위팔 26) (2) 산식 ● = 위팔 + 4 · ■ · ∅ = 0.5● − ■ · ⊠ = ∅/4 ↔ 실측 현(가운데 2⊠ · 양옆 ⊠) · 산식 1.5●/0.5● 와 실측 구분
//   (3) 이동(독립 역변환): 가운데 SP 대칭(전체 틈 2⊠ 에 맞춘 각) → 바깥 이동 기준점 · 원래 종이 4조각 강체·겹침 없음
//   (4) 짧은 소매의 소매산: 꺾임 3곳 국소 재제도 · SP 꺾임·곡률 실측 · 구간 밖 보존 (5) 길이: 중심선 기준 독립 적분 = 공용 측정 · 이세
//   (6) 소맷부리 fairing · 외곽 (7) 입력: 값 대체 없음 · ■ < 0 도 같은 산식 · 실제 기하 실패·수치 가드 구분 (8) sweep
//   node test/harness/designSleeveLCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const J = JSON.stringify;
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: (ns, tag) => ({ tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); } }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveL.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SL = W.designSleeveL, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presets = () => { const o = []; for (const f of BP.families()) for (const v of f.variants) o.push([v.symbol, v.presetId]); return o; };
function bodiceResultOf(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// ── 독립 측정(모듈과 다른 구현) ──
const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
const der = (q, t) => { const u = 1 - t; return { x: 3*u*u*(q[1].x-q[0].x) + 6*u*t*(q[2].x-q[1].x) + 3*t*t*(q[3].x-q[2].x), y: 3*u*u*(q[1].y-q[0].y) + 6*u*t*(q[2].y-q[1].y) + 3*t*t*(q[3].y-q[2].y) }; };
const dd2 = (q, t) => { const u = 1 - t; return { x: 6*u*(q[2].x-2*q[1].x+q[0].x) + 6*t*(q[3].x-2*q[2].x+q[1].x), y: 6*u*(q[2].y-2*q[1].y+q[0].y) + 6*t*(q[3].y-2*q[2].y+q[1].y) }; };
const kap = (q, t) => { const a = der(q, t), b = dd2(q, t), l = Math.hypot(a.x, a.y); return (a.x * b.y - a.y * b.x) / (l * l * l); };
function cubsOf(p) { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; }
const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const denseLen = (cs) => polyLen(dense(cs, 4000));
const ang = (u, v) => Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI;
const angSigned = (u, v) => Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);   // u → v 로 가는 회전각
const rot = (p, a, c) => { const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const crossO = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((crossO(c, d, a) > 0) !== (crossO(c, d, b) > 0)) && ((crossO(a, b, c) > 0) !== (crossO(a, b, d) > 0));
function selfX(r) { const n = r.length; for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (xseg(r[i], r[i + 1], r[j], r[j + 1])) return true; } return false; }
const seg = (g, role) => g.outline.find(s => s.role === role);
const ring = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
const dTo = (p, pl) => { let b = Infinity; for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], c = pl[i], vx = c.x - a.x, vy = c.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1))); b = Math.min(b, Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y)); } return b; };
// 소매산을 세로선 x = X0 에서 나눈 독립 적분
function indep(capPath, X0, N = 3000) { let back = 0, front = 0, crossed = false, prev = null, at = null;
  cubsOf(capPath).forEach(q => { for (let i = (prev ? 1 : 0); i <= N; i++) { const p = cub(q, i / N); if (prev) { const d = D(prev, p);
    if (!crossed && prev.x < X0 && p.x >= X0) { const t = (X0 - prev.x) / (p.x - prev.x); back += d * t; front += d * (1 - t); crossed = true; at = { x: X0, y: prev.y + (p.y - prev.y) * t }; } else if (crossed) front += d; else back += d; } prev = p; } });
  return { back, front, total: back + front, at }; }
// Ⓐ 외곽(소매산 조밀 점열 + 옆선·소맷부리 변 + 절개선 3개)
const ABOUND = (a) => { const cs = cubsOf(a.geometry.outline[0]), ub = cs[0][0], uf = cs[cs.length - 1][3], H = a.meta.sleeveLengthCm, sp = a.meta.sp, xb = (ub.x + sp.x) / 2, xf = (uf.x + sp.x) / 2;
  const capPl = dense(cs, 300), yAt = (x) => { let b = capPl[0]; capPl.forEach(q => { if (Math.abs(q.x - x) < Math.abs(b.x - x)) b = q; }); return b.y; };
  return { cap: capPl, lines: [[ub, { x: ub.x, y: H }], [{ x: ub.x, y: H }, { x: uf.x, y: H }], [{ x: uf.x, y: H }, uf], [{ x: xb, y: yAt(xb) }, { x: xb, y: H }], [{ x: sp.x, y: sp.y }, { x: sp.x, y: H }], [{ x: xf, y: yAt(xf) }, { x: xf, y: H }]] }; };
const onA = (p, AB) => Math.min(dTo(p, AB.cap), ...AB.lines.map(l => dTo(p, l)));
// 조각별 역변환(독립): 가운데 = SP 중심 회전(각은 «SP → 조각 중심선 쪽 밑단» 과 세로 아래 방향 사이에서 다시 구함) · 바깥 = 기준점 중심 회전을 먼저 되돌린 뒤 같은 SP 회전
function unmove(M, a) { const sp = M.pivots.sp, hp = M.hemPoints, pv = M.pivots, down = { x: 0, y: a.meta.sleeveLengthCm - sp.y };
  const aB = angSigned(sub(hp.backCenterMid, sp), down), aF = angSigned(sub(hp.frontCenterMid, sp), down);
  const bB = angSigned(sub(hp.backInner, pv.back), sub(hp.backCenterOuter, pv.back)), bF = angSigned(sub(hp.frontInner, pv.front), sub(hp.frontCenterOuter, pv.front));
  return { aB, aF, bB, bF, backCenter: p => rot(p, aB, sp), frontCenter: p => rot(p, aF, sp), backOuter: p => rot(rot(p, bB, pv.back), aB, sp), frontOuter: p => rot(rot(p, bF, pv.front), aF, sp) }; }
function rigidWorst(M, a) { const AB = ABOUND(a), U = unmove(M, a); let w = 0; ["backOuter", "backCenter", "frontCenter", "frontOuter"].forEach(k => M.rigid.pieces[k].forEach(p => { w = Math.max(w, onA(U[k](p), AB)); })); return w; }
// 겹침: 세 틈의 양쪽 변(직선)에 대해 각 조각이 자기 쪽에만 있어야 한다
function overlapWorst(M) { const pc = M.rigid.pieces, sp = M.pivots.sp, pv = M.pivots, hp = M.hemPoints; let w = 0;
  const far = (o, a, pts, sign) => { const L = D(o, a); pts.forEach(p => { w = Math.max(w, sign * crossO(o, a, p) / L); }); };
  far(sp, hp.backCenterMid, pc.backCenter, -1); far(sp, hp.backCenterMid, pc.backOuter, -1); far(sp, hp.frontCenterMid, pc.frontCenter, +1); far(sp, hp.frontCenterMid, pc.frontOuter, +1);
  far(pv.back, hp.backCenterOuter, pc.backOuter, -1); far(pv.front, hp.frontCenterOuter, pc.frontOuter, +1);
  return w; }

// ── 1. API ──
{
  ok(typeof SL.draftSleeveL === "function" && Object.isFrozen(SL) && Object.isFrozen(SL.RULES), "1: API 동결");
  ok(SL.RULES.upperArmDefaultCm === 26 && SL.RULES.sleeveLengthDefaultCm === 20 && SL.RULES.cuffAddCm === 4 && SL.RULES.cuffWidthCm === 1 && SL.RULES.gatherRatio === 0.5 && SL.RULES.units === 4 && SL.RULES.centerUnits === 2 && SL.RULES.cuts === 3,
    "1: 위팔 26 · 소매길이 20 · 커프스 +4 · 폭 1 · 개더 0.5배 · ⊠ = ∅/4 · 가운데 2⊠ · 절개 3");
}
const ID_A = presets().find(p => p[0] === "A")[1], BA = bodiceResultOf(ID_A), AH = BA.armholeLengths, HY = 20;
const A = SA.draftSleeveA(BA, { sleeveLengthCm: HY });
const R = SL.draftSleeveL(A, {});
ok(A.ok && R.ok, "기준: B83 · 소매길이 20 · 위팔 26 기본 성공 " + (R.reason || ""));
const m = R.meta, g = R.geometry, W0 = A.meta.bicepCm, SPA = A.meta.sp, capA = cubsOf(A.geometry.outline[0]), he = m.hemPoints, unit = m.formula.unit;
const capL = cubsOf(seg(g, "cap")), hemL = cubsOf(seg(g, "hem")), UbA = capA[0][0], UfA = capA[capA.length - 1][3];
// ── 2. 산식 ↔ 실측 ──
{
  const cuff = 30, sq = W0 - cuff, spread = 0.5 * cuff - sq;
  ok(m.cuff.upperArmCm === 26 && m.cuff.lengthCm === 30 && m.cuff.widthCm === 1 && near(m.formula.square, sq, 1e-12) && near(m.formula.spread, spread, 1e-12) && near(spread, 1.5 * cuff - W0, 1e-12) && near(unit, spread / 4, 1e-12),
    "2: ● = 26 + 4 = 30 · ■ = W − ● = " + sq.toFixed(3) + " · ∅ = 0.5● − ■ = 1.5● − W = " + spread.toFixed(3) + " · ⊠ = " + unit.toFixed(3));
  const ob = D(he.backInner, he.backCenterOuter), oc = D(he.backCenterMid, he.frontCenterMid), of = D(he.frontCenterOuter, he.frontInner);
  ok(near(ob, unit) && near(of, unit) && near(oc, 2 * unit) && near(m.flare.centerCm, 2 * unit, 1e-12) && near(m.flare.sideCm, unit, 1e-12), "2: 실측 현 — 뒤 " + ob.toFixed(4) + " · 가운데 " + oc.toFixed(4) + " · 앞 " + of.toFixed(4) + " = ⊠ · 2⊠ · ⊠");
  ok(near(ob + oc + of, spread), "2: 세 틈의 현 합 = ∅");
  ok(m.hem.formulaHemCm === 45 && m.hem.formulaGatherCm === 15 && m.formula.gatherRatio === 0.5, "2: 산식 소맷부리 1.5● = 45 · 개더 0.5● = 15(실측과 따로)");
  const hl = denseLen(hemL);
  ok(Math.abs(hl - m.hem.lengthCm) < 1e-3 && near(m.hem.gatherCm, m.hem.lengthCm - 30, 1e-12) && Math.abs(hl - 45) < 0.5 && hl !== 45, "2: 소맷부리 실측(권위값) " + hl.toFixed(3) + " — 산식에 맞추지 않음 · 개더(실측) " + m.hem.gatherCm.toFixed(3));
  ok(J(m).indexOf("palm") < 0 && J(m).indexOf("rise") < 0, "2: 손바닥·상승 값은 Ⓛ 에 없음");
}
// ── 3. 이동(독립 역변환) ──
{
  const U = unmove(m, A), w = rigidWorst(m, A), Rc = HY - SPA.y;
  ok(w < 2e-3, "3: 원래 종이 4조각 = Ⓐ 조각의 강체 이동(역변환하면 Ⓐ 외곽·절개선 위) 최대 " + w.toExponential(2));
  ok(near(Math.abs(U.aB) * 180 / Math.PI, m.rotationDeg.center, 1e-6) && near(U.aB, -U.aF, 1e-9), "3: 가운데 두 조각 = SP 중심 좌우 대칭 ±" + m.rotationDeg.center.toFixed(3) + "°");
  ok(near(Rc * Math.sin(Math.abs(U.aB)), unit, 1e-9) && near(2 * Rc * Math.sin(Math.abs(U.aB)), 2 * unit, 1e-9) && Math.abs(Math.abs(U.aB) - unit / Rc) > 1e-4,
    "3: 가운데 회전각 = asin(⊠ ÷ 중심 길이) — 전체 틈 2⊠ 의 현에 맞춤(호·폭을 각도처럼 더한 값이 아님)");
  ok(near(Math.abs(U.bB) * 180 / Math.PI, m.rotationDeg.backOuterRelative, 1e-6) && near(Math.abs(U.bF) * 180 / Math.PI, m.rotationDeg.frontOuterRelative, 1e-6)
    && near(m.rotationDeg.backOuterTotal, m.rotationDeg.center + m.rotationDeg.backOuterRelative, 1e-9), "3: 바깥 추가 회전 뒤 " + m.rotationDeg.backOuterRelative.toFixed(3) + "° · 앞 " + m.rotationDeg.frontOuterRelative.toFixed(3) + "°(이동한 기준점 중심)");
  const pvB = rot(m.pivots.back, U.aB, m.pivots.sp), pvF = rot(m.pivots.front, U.aF, m.pivots.sp);
  ok(D(m.pivots.sp, SPA) < 1e-9 && near(pvB.x, (UbA.x + SPA.x) / 2, 1e-9) && near(pvF.x, (UfA.x + SPA.x) / 2, 1e-9) && D(pvB, m.pivots.backBefore) < 1e-9 && D(pvF, m.pivots.frontBefore) < 1e-9 && dTo(pvB, dense(capA, 400)) < 1e-3,
    "3: SP 고정 · 바깥 기준점 = 반폭 중점 절개선 × Ⓐ 소매산이 가운데 조각과 함께 움직인 점");
  ok(overlapWorst(m) < 1e-6, "3: 원래 종이 4조각 겹침 없음(세 틈 모두 바깥으로만 벌어짐)");
  const sb = seg(g, "side-seam-back"), sf = seg(g, "side-seam-front");
  ok(near(D(sb.from, sb.to), HY - UbA.y) && near(D(sf.from, sf.to), HY - UfA.y) && D(sb.to, m.underarm.after.back) < 1e-9 && D(sf.from, m.underarm.after.front) < 1e-9, "3: 옆선 = Ⓐ 옆선 길이 그대로(강체 · " + (HY - UbA.y).toFixed(2) + "cm)");
}
// ── 4. 짧은 소매의 소매산 ──
{
  const iT = capL.findIndex(q => Math.abs(q[3].x - SPA.x) < 1e-9 && D(q[3], m.sp) < 1e-9), kd = m.redraw.kinkDegRaw, win = m.redraw.windows, ell = m.redraw.ellChosenCm;
  ok(iT > 0 && g.capSplit && g.capSplit.x === SPA.x, "4: 최종 소매산 × 중심선에 앵커가 있고 geometry.capSplit = 중심선 x");
  ok(near(kd.SP, 2 * m.rotationDeg.center, 1e-9) && near(kd.Pb, m.rotationDeg.backOuterRelative, 1e-9) && kd.SP > 10, "4: 꺾임(재제도 전) SP " + kd.SP.toFixed(2) + "° · 뒤 " + kd.Pb.toFixed(2) + "° · 앞 " + kd.Pf.toFixed(2) + "°");
  let g1 = 0; for (let i = 1; i < capL.length; i++) g1 = Math.max(g1, ang(der(capL[i - 1], 1), der(capL[i], 0)));
  ok(g1 < 1e-6, "4: 소매산 전체 G1(최대 " + g1.toExponential(2) + "°) — 꺾임 3곳 모두 해소");
  // SP 재제도 구간(꼭대기 양쪽 두 cubic)의 곡률: 부호가 한쪽뿐(꼭대기에 국소 S·오목 없음) · 최소 곡률 반지름
  const ks = []; [capL[iT], capL[iT + 1]].forEach(q => { for (let i = 0; i <= 300; i++) ks.push(kap(q, i / 300)); });
  const kmin = Math.min(...ks), kmax = Math.max(...ks);
  ok(kmin > 1e-6 && near(kmin, m.redraw.curvatureMin.SP, 1e-3) && near(kmax, m.redraw.curvatureMax.SP, 1e-3), "4: SP 구간 곡률 " + kmin.toFixed(3) + " ~ " + kmax.toFixed(3) + " /cm(부호 한쪽 — 꼭대기에 S·오목 없음 · 최소 반지름 " + (1 / kmax).toFixed(1) + "cm)");
  const rigidCap = dense(cubsOf(m.rigid.cap), 200); let off = 0, stray = 0, n = 0;
  dense(capL, 60).forEach(p => { n++; if (dTo(p, rigidCap) > 2e-3) { off++;
    const nb = D(p, m.pivots.back) < win.Pb[0] + win.Pb[1] + 0.5, nf = D(p, m.pivots.front) < win.Pf[0] + win.Pf[1] + 0.5, ns = D(p, m.pivots.sp) < win.SP[0] + win.SP[1] + 0.5; if (!(nb || nf || ns)) stray++; } });
  ok(stray === 0 && off > 0 && off < n * 0.6, "4: 재제도 구간 3곳 밖은 원래(강체 이동한) 소매산 그대로(벗어난 점 " + off + "/" + n + " · 구간 밖 0)");
  ok([ell.Pb, ell.SP, ell.Pf].every(v => v >= 0.5 && v <= 2), "4: 재제도 구간 뒤 " + ell.Pb + " · SP " + ell.SP + " · 앞 " + ell.Pf + "cm(국소 · 잠정)");
  ok(Math.abs(m.sp.y - SPA.y) < 0.3 && Math.abs(m.sp.x - SPA.x) < 1e-9,"4: 최종 꼭대기는 원래 SP 에서 " + (SPA.y - m.sp.y).toFixed(3) + "cm(위 +) — 실측값 그대로 보고");
}
// ── 5. 길이·이세(중심선 기준 독립 적분) ──
{
  const ind = indep(seg(g, "cap"), SPA.x), indA = indep(A.geometry.outline[0], SPA.x), prim = DS.capPrimitives(g);
  ok(prim && Math.abs(prim.lengths.back - ind.back) < 5e-3 && Math.abs(prim.lengths.front - ind.front) < 5e-3 && Math.abs(prim.splitPoint.x - SPA.x) < 1e-9, "5: 공용 측정 뒤 " + prim.lengths.back.toFixed(3) + " · 앞 " + prim.lengths.front.toFixed(3) + " = 중심선 독립 적분");
  ok(Math.abs(m.capLengths.back - ind.back) < 2e-3 && Math.abs(m.capLengths.front - ind.front) < 2e-3 && near(m.capLengths.back + m.capLengths.front, m.capLengths.total, 1e-9), "5: 엔진 meta 같은 기준 · 앞 + 뒤 = 총");
  ok(Math.abs(m.easeAfter.back - (ind.back - AH.back)) < 2e-3 && Math.abs(m.easeAfter.front - (ind.front - AH.front)) < 2e-3, "5: 이세(실측) 뒤 " + m.easeAfter.back.toFixed(3) + " · 앞 " + m.easeAfter.front.toFixed(3) + " · 총 " + m.easeAfter.total.toFixed(3));
  ok(Math.abs(ind.total - indA.total) < 0.2 && Math.abs(m.capLengthsA.total - indA.total) < 5e-3, "5: 소매산은 늘리지 않음 — 최종 " + ind.total.toFixed(3) + " vs Ⓐ " + indA.total.toFixed(3) + "(차 " + (ind.total - indA.total).toFixed(3) + " = 재제도 영향)");
  const pl = dense(hemL, 400).sort((a, b) => a.x - b.x); let cy = null; for (let i = 1; i < pl.length; i++) if (pl[i].x >= SPA.x) { const a = pl[i - 1], b = pl[i]; cy = a.y + (b.y - a.y) * (SPA.x - a.x) / (b.x - a.x || 1); break; }
  ok(m.centerLength.inputCm === 20 && Math.abs(m.centerLength.spreadCm - (cy - m.sp.y)) < 2e-3 && m.centerLength.spreadCm !== 20, "5: 입력 소매길이 20 vs 벌린 뒤 중심 길이(실측) " + m.centerLength.spreadCm.toFixed(3) + " — 구분");
}
// ── 6. 소맷부리 fairing · 외곽 ──
{
  ok(D(hemL[0][0], he.frontOuter) < 1e-9 && D(hemL[hemL.length - 1][3], he.backOuter) < 1e-9, "6: 소맷부리 양 끝 = 바깥 조각 밑단 끝점(고정)");
  let g1 = 0; for (let i = 1; i < hemL.length; i++) g1 = Math.max(g1, ang(der(hemL[i - 1], 1), der(hemL[i], 0)));
  const ks = []; hemL.forEach(q => { for (let i = 0; i <= 200; i++) ks.push(kap(q, i / 200)); });
  const sg = ks.filter(k => Math.abs(k) > 0.01).map(Math.sign);
  ok(g1 < 1e-6 && sg.every(s => s === sg[0]) && m.hem.fair.inflections === 0, "6: 소맷부리 G1 · 변곡·국소 S 없음");
  const pl = dense(hemL, 200).sort((a, b) => a.x - b.x), yAt = (x) => { for (let i = 1; i < pl.length; i++) if (pl[i].x >= x) { const a = pl[i - 1], b = pl[i], t = (x - a.x) / (b.x - a.x || 1); return a.y + (b.y - a.y) * t; } return pl[pl.length - 1].y; };
  let cut = 0, out = 0; [[he.frontOuter, he.frontInner], [he.frontCenterOuter, he.frontCenterMid], [he.backCenterMid, he.backCenterOuter], [he.backInner, he.backOuter]].forEach(([a, b]) => {
    for (let i = 0; i <= 400; i++) { const t = i / 400, x = a.x + (b.x - a.x) * t, d = yAt(x) - (a.y + (b.y - a.y) * t); if (d < 0) cut = Math.max(cut, -d); else out = Math.max(out, d); } });
  ok(Math.abs(cut - m.hem.fair.maxCutCm) < 5e-3 && Math.abs(out - m.hem.fair.maxOutwardCm) < 5e-3 && cut < 0.3 && out < 0.3, "6: 원래 밑단 대비 파임 최대 " + cut.toFixed(3) + " · 덧댐 최대 " + out.toFixed(3) + " cm(변 전체 독립 측정 = meta)");
  const r = ring(g); ok(D(r[0], r[r.length - 1]) < 1e-9 && !selfX(r.slice(0, -1).concat([r[0]])), "6: 단일 폐곡선 · 자기교차 없음");
  ok(g.outline.map(s => s.role).join() === "cap,side-seam-front,hem,side-seam-back" && g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front", "6: 외곽·construction 역할");
}
// ── 7. 입력: 값 대체 없음 · ■ < 0 도 같은 산식(김님 2026-10-19) · 실제 기하 문제만 막음 · 수치 가드는 따로 표시 ──
{
  [[{ upperArmCm: 0 }, "invalid-upper-arm"], [{ upperArmCm: -1 }, "invalid-upper-arm"], [{ upperArmCm: NaN }, "invalid-upper-arm"], [{ upperArmCm: "26" }, "invalid-upper-arm"]].forEach(([p, why]) => {
    const r = SL.draftSleeveL(A, p); ok(!r.ok && r.reason === why && !r.geometry, "7: 거부 " + J(p) + " → " + why); });
  // ■ < 0 성공(B83 · 소매길이 20): 부호 있는 ■ 그대로 · ∅ = 1.5● − W · 현 2:1:1 · 출발 폭 그대로
  [28.5, 29, 30, 32].forEach(arm => {
    const r = SL.draftSleeveL(A, { upperArmCm: arm }), sq = W0 - (arm + 4), sp = 1.5 * (arm + 4) - W0;
    const h = r.ok ? r.meta.hemPoints : null, u = sp / 4;
    ok(r.ok && sq < 0 && near(r.meta.formula.square, sq, 1e-12) && near(r.meta.formula.spread, sp, 1e-12) && r.meta.cuff.upperArmCm === arm && r.meta.widthCm === W0
      && near(D(h.backInner, h.backCenterOuter), u) && near(D(h.backCenterMid, h.frontCenterMid), 2 * u) && near(D(h.frontCenterOuter, h.frontInner), u) && r.meta.redraw.curvatureMin.SP >= -0.01
      && !selfX(ring(r.geometry)) && overlapWorst(r.meta) < 1e-6,
      "7: ■ < 0 성공 — 위팔 " + arm + " · ■ " + sq.toFixed(2) + " · ∅ " + sp.toFixed(2) + " · 꼭대기 곡률 최소 " + (r.ok ? r.meta.redraw.curvatureMin.SP.toFixed(4) : "-") + (r.ok ? "" : " (" + r.reason + ")"));
  });
  // 실제 기하 실패: 소매산 꼭대기가 오목하게 꺼짐(검증 불감대 −0.01/cm 밖)
  [33, 34].forEach(arm => {
    const r = SL.draftSleeveL(A, { upperArmCm: arm });
    ok(!r.ok && r.reason === "cap-top-concave" && r.detail.curvatureMin < -0.01 && r.numericGuard !== true && !r.geometry, "7: 위팔 " + arm + " = 꼭대기 오목(곡률 " + (r.detail ? r.detail.curvatureMin.toFixed(4) : "-") + "/cm) — 실제 형상 문제로 멈춤");
  });
  // 설정된 수치 가드(회전 45° — 책 규칙 아님): 물리적 불가 판정과 구분해 표시
  const g36 = SL.draftSleeveL(A, { upperArmCm: 36 });
  ok(!g36.ok && g36.reason === "rotation-too-large" && g36.numericGuard === true && g36.detail.kind === "numeric-guard" && near(g36.detail.limitDeg, 45, 1e-9) && g36.detail.deg > 45, "7: 위팔 36 = 회전 수치 가드 45° 초과(" + (g36.detail ? g36.detail.deg.toFixed(2) : "-") + "°) — 수치 가드로 표시");
  // ■ = 0 경계 양쪽은 연속(■ 부호로 끊기지 않음)
  const eA = SL.draftSleeveL(A, { upperArmCm: W0 - 4 - 0.01 }), eB = SL.draftSleeveL(A, { upperArmCm: W0 - 4 + 0.01 });
  ok(eA.ok && eB.ok && eA.meta.formula.square > 0 && eB.meta.formula.square < 0 && Math.abs((eB.meta.hem.lengthCm - eA.meta.hem.lengthCm) - 0.03) < 0.01 && Math.abs(eB.meta.capLengths.total - eA.meta.capLengths.total) < 0.01,
    "7: ■ = 0 경계 양쪽 연속(소맷부리 차 " + (eA.ok && eB.ok ? (eB.meta.hem.lengthCm - eA.meta.hem.lengthCm).toFixed(4) : "-") + " = 1.5 × 0.02)");
  const low = SL.draftSleeveL(A, { upperArmCm: 17 });
  ok(!low.ok && low.reason === "no-spread" && low.outOfSupportedRange === true, "7: ∅ ≤ 0(위팔 둘레가 너무 작음) = 지원 범위 밖 표시");
  ok(!SL.draftSleeveL(null, {}).ok, "7: Ⓐ 없음 거부");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SL.draftSleeveL(Af, {}), e2 = SL.draftSleeveL(Af, { upperArmCm: 26 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(R) && typeof R.sourceSleeveAHash === "string" && R.sourceSleeveAHash.length > 0, "7: 동결 입력 · 결정성 · 기본값 26 · 출발 Ⓐ hash");
  const A52 = SA.draftSleeveA(BA, { sleeveLengthCm: 52 }); ok(SL.draftSleeveL(A52, {}).sourceSleeveAHash !== R.sourceSleeveAHash, "7: 소매길이가 다르면 출발 Ⓐ hash 가 다름");
}
// ── 8. sweep ──
{
  let n = 0, okN = 0, negOk = 0, guard = 0; const out = {}, bad = []; const worst = { open: 0, cut: 0, outw: 0, infl: 0, g1: 0, rigid: 0, overlap: 0, rotMax: 0, kinkSP: 0, kSPmin: 9, split: 0, topUp: 0, capVsA: 0, hemVsFormula: 0 };
  for (const [sym, id] of presets()) {
    const br = bodiceResultOf(id); if (!br) continue;
    for (const SLc of [15, 20, 25]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SLc }); if (!a.ok) continue; const x0 = a.meta.sp.x, Wd = a.meta.bicepCm, indA = indep(a.geometry.outline[0], x0);
      for (const arm of [22, 24, 26, 28, 30, 32, Wd - 4 - 0.01, Wd - 4 + 0.01]) {   // ■ ≥ 0 · ■ < 0 · ■ = 0 경계 양쪽 · 소매길이 15/20/25
        n++;
        const r = SL.draftSleeveL(a, { upperArmCm: arm }), tag = sym + SLc + "/" + arm.toFixed(2);
        if (!r.ok) {
          if (r.numericGuard) guard++;
          out[r.reason] = (out[r.reason] || 0) + 1;
          if (!r.outOfSupportedRange) bad.push(tag + ":" + r.reason);
          if (["rotation-too-large", "cap-top-concave", "pieces-overlap", "self-intersection", "no-spread", "flare-too-large", "redraw-inflection-unavoidable"].indexOf(r.reason) < 0) bad.push(tag + ":unexpected-" + r.reason);
          if (r.reason === "rotation-too-large" && !(r.numericGuard && r.detail.deg > 45)) bad.push(tag + ":guard-unlabeled");
          continue;
        }
        okN++;
        const M = r.meta, h = M.hemPoints, u = M.formula.unit, cs = cubsOf(r.geometry.outline[0]), hs = cubsOf(r.geometry.outline[2]);
        if (M.formula.square < 0) { negOk++; if (!near(M.formula.square, Wd - (arm + 4), 1e-9)) bad.push(tag + ":square-changed"); }
        if (M.cuff.upperArmCm !== arm || M.sleeveLengthCm !== SLc || M.widthCm !== Wd) bad.push(tag + ":input-changed");
        worst.open = Math.max(worst.open, Math.abs(D(h.backInner, h.backCenterOuter) - u), Math.abs(D(h.backCenterMid, h.frontCenterMid) - 2 * u), Math.abs(D(h.frontCenterOuter, h.frontInner) - u));
        worst.cut = Math.max(worst.cut, M.hem.fair.maxCutCm); worst.outw = Math.max(worst.outw, M.hem.fair.maxOutwardCm); worst.infl += M.hem.fair.inflections;
        for (let i = 1; i < cs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(cs[i - 1], 1), der(cs[i], 0)));
        for (let i = 1; i < hs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(hs[i - 1], 1), der(hs[i], 0)));
        const hk = []; hs.forEach(q => { for (let i = 0; i <= 80; i++) hk.push(kap(q, i / 80)); }); const sg = hk.filter(k => Math.abs(k) > 0.01).map(Math.sign); if (!sg.every(s => s === sg[0])) bad.push(tag + ":hemS");
        worst.rigid = Math.max(worst.rigid, rigidWorst(M, a)); worst.overlap = Math.max(worst.overlap, overlapWorst(M));
        worst.rotMax = Math.max(worst.rotMax, M.rotationDeg.backOuterTotal, M.rotationDeg.frontOuterTotal); worst.kinkSP = Math.max(worst.kinkSP, M.redraw.kinkDegRaw.SP); worst.kSPmin = Math.min(worst.kSPmin, M.redraw.curvatureMin.SP);
        if (!(M.redraw.curvatureMin.SP >= -0.01)) bad.push(tag + ":capTopConcave-accepted");
        const prim = DS.capPrimitives(r.geometry), ind = indep(r.geometry.outline[0], x0);
        if (!prim) { bad.push(tag + ":prim-null"); continue; }
        worst.split = Math.max(worst.split, Math.abs(prim.lengths.back - ind.back), Math.abs(prim.lengths.front - ind.front), Math.abs(prim.splitPoint.x - x0));
        worst.topUp = Math.max(worst.topUp, Math.abs(M.spBefore.y - M.sp.y)); worst.capVsA = Math.max(worst.capVsA, Math.abs(ind.total - indA.total)); worst.hemVsFormula = Math.max(worst.hemVsFormula, Math.abs(M.hem.lengthCm - M.hem.formulaHemCm));
        if (selfX(ring(r.geometry))) bad.push(tag + ":selfX");
      }
    }
  }
  Object.keys(worst).forEach(k => { worst[k] = Math.round(worst[k] * 1e4) / 1e4; });
  console.log("  sweep: " + n + " 경우 — 성립 " + okN + "(그중 ■ < 0 " + negOk + ") · 멈춤 " + J(out) + "(수치 가드 " + guard + ") · 최악 " + J(worst));
  ok(n >= 400 && okN + Object.values(out).reduce((a, b) => a + b, 0) === n && okN >= n * 0.6 && negOk >= 50, "8: sweep " + n + " — 성립 " + okN + "(■ < 0 " + negOk + ") · 멈춤 " + J(out));
  ok(!bad.length, "8: 표시 없는 실패·값 대체·꼭대기 오목 수용·자기교차·S·이름 없는 수치 가드 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-9 && worst.infl === 0 && worst.g1 < 1e-6 && worst.rigid < 2e-3 && worst.overlap < 1e-6 && worst.split < 5e-3, "8: sweep 불변식(현 = ⊠·2⊠·⊠ · 소맷부리 변곡 0 · G1 · 강체 · 겹침 없음 · 앞/뒤 = 중심선 독립 적분)");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
