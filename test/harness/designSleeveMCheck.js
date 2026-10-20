// ══════════════════════════════════════════════
// designSleeveMCheck.js — js/designSleeveM.js(소매 Ⓜ 반소매 퍼프, [패턴학교] P.46 하단 «소매산과 소맷부리를 잘라서 벌린다» — 2026-10-20 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값(소매길이 20 · 위팔 26 · 상승 0.5 · 개더 0.7) (2) 산식 ∅ = 0.7● − ■ = 1.7● − W · ⊠ = ∅/10 ↔ 실측 현 1:2:4:2:1 · 산식 1.7●/0.7● 와 실측 구분
//   (3) 이동(독립 역변환): 가운데 평행 2⊠ → 중간 조각(안쪽 기준점) → 바깥 조각(함께 운반된 바깥 기준점) · 원래 종이 6조각 강체 · 겹침 없음
//   (4) 소매산: 상승 · 가운데 틈 + 기준점 꺾임 4곳 국소 재제도(구간 밖 보존) · 상승과 개더 계수 독립 (5) 길이: 중심선 명시 분할 = 독립 적분 · Ⓐ 이세 + 추가 개더 = 최종 − AH
//   (6) 소맷부리 fairing · 외곽 (7) 입력·결정성 · ■ < 0 · 실제 기하 실패와 설정 한계(수치 가드·잠정 구간) 구분 (8) sweep(상승 0 포함)
//   node test/harness/designSleeveMCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveM.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SM = W.designSleeveM, DS = W.designSleeve;
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
const angSigned = (u, v) => Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y);
const rot = (p, a, c) => { const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const crossO = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((crossO(c, d, a) > 0) !== (crossO(c, d, b) > 0)) && ((crossO(a, b, c) > 0) !== (crossO(a, b, d) > 0));
function selfX(r) { const n = r.length; for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (xseg(r[i], r[i + 1], r[j], r[j + 1])) return true; } return false; }
const seg = (g, role) => g.outline.find(s => s.role === role);
const ring = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
const dTo = (p, pl) => { let b = Infinity; for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], c = pl[i], vx = c.x - a.x, vy = c.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1))); b = Math.min(b, Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y)); } return b; };
function indep(capPath, X0, N = 3000) { let back = 0, front = 0, crossed = false, prev = null, at = null;
  cubsOf(capPath).forEach(q => { for (let i = (prev ? 1 : 0); i <= N; i++) { const p = cub(q, i / N); if (prev) { const d = D(prev, p);
    if (!crossed && prev.x < X0 && p.x >= X0) { const t = (X0 - prev.x) / (p.x - prev.x); back += d * t; front += d * (1 - t); crossed = true; at = { x: X0, y: prev.y + (p.y - prev.y) * t }; } else if (crossed) front += d; else back += d; } prev = p; } });
  return { back, front, total: back + front, at }; }
// Ⓐ 외곽 + 절개선 5개(중심선 · 반폭 3등분)
const ABOUND = (a) => { const cs = cubsOf(a.geometry.outline[0]), ub = cs[0][0], uf = cs[cs.length - 1][3], H = a.meta.sleeveLengthCm, sp = a.meta.sp, X0 = sp.x;
  const capPl = dense(cs, 300), yAt = (x) => { let b = capPl[0]; capPl.forEach(q => { if (Math.abs(q.x - x) < Math.abs(b.x - x)) b = q; }); return b.y; };
  const xs = [X0 + (ub.x - X0) / 3, X0 + 2 * (ub.x - X0) / 3, X0 + (uf.x - X0) / 3, X0 + 2 * (uf.x - X0) / 3];
  return { cap: capPl, lines: [[ub, { x: ub.x, y: H }], [{ x: ub.x, y: H }, { x: uf.x, y: H }], [{ x: uf.x, y: H }, uf], [{ x: X0, y: sp.y }, { x: X0, y: H }]].concat(xs.map(x => [{ x, y: yAt(x) }, { x, y: H }])) }; };
const onA = (p, AB) => Math.min(dTo(p, AB.cap), ...AB.lines.map(l => dTo(p, l)));
// 조각별 역변환(독립): 각은 틈의 두 밑단 끝점에서 다시 구한다 · 평행 이동량은 가운데 두 밑단 끝점 사이 절반
function unmove(M) { const hp = M.hemPoints, pv = M.pivots, h = D(hp.backCenterMid, hp.frontCenterMid) / 2;
  const b1B = angSigned(sub(hp.backMidIn, pv.backInner), sub(hp.backCenterOut, pv.backInner)), b1F = angSigned(sub(hp.frontMidIn, pv.frontInner), sub(hp.frontCenterOut, pv.frontInner));
  const b2B = angSigned(sub(hp.backOuterIn, pv.backOuter), sub(hp.backMidOut, pv.backOuter)), b2F = angSigned(sub(hp.frontOuterIn, pv.frontOuter), sub(hp.frontMidOut, pv.frontOuter));
  const TB = p => ({ x: p.x + h, y: p.y }), TF = p => ({ x: p.x - h, y: p.y });
  return { h, b1B, b1F, b2B, b2F, backCenter: TB, frontCenter: TF, backMid: p => TB(rot(p, b1B, pv.backInner)), frontMid: p => TF(rot(p, b1F, pv.frontInner)),
    backOuter: p => TB(rot(rot(p, b2B, pv.backOuter), b1B, pv.backInner)), frontOuter: p => TF(rot(rot(p, b2F, pv.frontOuter), b1F, pv.frontInner)) }; }
const PK = ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"];
function rigidWorst(M, a) { const AB = ABOUND(a), U = unmove(M); let w = 0; PK.forEach(k => M.rigid.pieces[k].forEach(p => { w = Math.max(w, onA(U[k](p), AB)); })); return w; }
// 조각 겹침(독립 구현): 서로 다른 조각의 변이 맞닿는 기준점 밖에서 진짜로 교차하는지
function overlapCount(M) { const pv = M.pivots, touch = [pv.backInner, pv.backOuter, pv.frontInner, pv.frontOuter], nt = p => touch.some(t => D(p, t) < 1e-6); let n = 0;
  for (let i = 0; i < PK.length; i++) for (let j = i + 1; j < PK.length; j++) { const A = M.rigid.pieces[PK[i]].concat([M.rigid.pieces[PK[i]][0]]), B = M.rigid.pieces[PK[j]].concat([M.rigid.pieces[PK[j]][0]]);
    for (let a = 1; a < A.length; a++) for (let b = 1; b < B.length; b++) { if (nt(A[a - 1]) || nt(A[a]) || nt(B[b - 1]) || nt(B[b])) continue; if (xseg(A[a - 1], A[a], B[b - 1], B[b])) n++; } }
  return n; }
const opened5 = (h) => [D(h.backOuterIn, h.backMidOut), D(h.backMidIn, h.backCenterOut), D(h.backCenterMid, h.frontCenterMid), D(h.frontCenterOut, h.frontMidIn), D(h.frontMidOut, h.frontOuterIn)];

// ── 1. API ──
{
  ok(typeof SM.draftSleeveM === "function" && Object.isFrozen(SM) && Object.isFrozen(SM.RULES), "1: API 동결");
  ok(SM.RULES.upperArmDefaultCm === 26 && SM.RULES.sleeveLengthDefaultCm === 20 && SM.RULES.riseDefaultCm === 0.5 && SM.RULES.cuffAddCm === 4 && SM.RULES.cuffWidthCm === 1 && SM.RULES.gatherRatio === 0.7
    && SM.RULES.units === 10 && J(SM.RULES.ratios) === "[1,2,4,2,1]" && SM.RULES.cuts === 5, "1: 위팔 26 · 소매길이 20 · 상승 0.5 · 커프스 +4 · 폭 1 · 개더 0.7배 · ⊠ = ∅/10 · 1:2:4:2:1 · 절개 5");
}
const ID_A = presets().find(p => p[0] === "A")[1], BA = bodiceResultOf(ID_A), AH = BA.armholeLengths, HY = 20;
const A = SA.draftSleeveA(BA, { sleeveLengthCm: HY });
const R = SM.draftSleeveM(A, {});
ok(A.ok && R.ok, "기준: B83 · 소매길이 20 · 위팔 26 · 상승 0.5 기본 성공 " + (R.reason || ""));
const m = R.meta, g = R.geometry, W0 = A.meta.bicepCm, SPA = A.meta.sp, capA = cubsOf(A.geometry.outline[0]), he = m.hemPoints, u = m.formula.unit;
const capM = cubsOf(seg(g, "cap")), hemM = cubsOf(seg(g, "hem")), UbA = capA[0][0], UfA = capA[capA.length - 1][3];
// ── 2. 산식 ↔ 실측 ──
{
  const cuff = 30, sq = W0 - cuff, spread = 0.7 * cuff - sq;
  ok(m.cuff.upperArmCm === 26 && m.cuff.lengthCm === 30 && near(m.formula.square, sq, 1e-12) && near(m.formula.spread, spread, 1e-12) && near(spread, 1.7 * cuff - W0, 1e-12) && near(u, spread / 10, 1e-12),
    "2: ● 30 · ■ " + sq.toFixed(3) + " · ∅ = 0.7● − ■ = 1.7● − W = " + spread.toFixed(3) + " · ⊠ = " + u.toFixed(3));
  const o = opened5(he), want = [1, 2, 4, 2, 1].map(k => k * u);
  ok(o.every((v, i) => near(v, want[i])), "2: 실측 현 뒤 → 앞 " + o.map(v => v.toFixed(3)).join(" / ") + " = ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠");
  ok(near(o.reduce((a, b) => a + b, 0), spread) && near(he.backCenterMid.y, HY) && near(he.frontCenterMid.y, HY) && near(he.backCenterMid.x, SPA.x - 2 * u) && near(he.frontCenterMid.x, SPA.x + 2 * u),
    "2: 다섯 틈 합 = ∅ · 가운데 틈 = 평행(좌우 2⊠ · 틈 가운데 = 원래 중심선)");
  ok(near(m.hem.formulaHemCm, 51, 1e-9) && near(m.hem.formulaGatherCm, 21, 1e-9) && m.formula.gatherRatio === 0.7 && m.rise.cm === 0.5, "2: 산식 소맷부리 1.7● = 51 · 개더 0.7● = 21 · 상승 0.5(서로 다른 값)");
  const hl = denseLen(hemM);
  ok(Math.abs(hl - m.hem.lengthCm) < 1e-3 && near(m.hem.gatherCm, m.hem.lengthCm - 30, 1e-12) && Math.abs(hl - 51) < 0.5 && hl !== 51, "2: 소맷부리 실측(권위값) " + hl.toFixed(3) + " — 산식에 맞추지 않음 · 개더(실측) " + m.hem.gatherCm.toFixed(3));
  ok(J(m).indexOf("palm") < 0, "2: 손바닥 값 없음");
}
// ── 3. 이동(독립 역변환) ──
{
  const U = unmove(m), w = rigidWorst(m, A);
  ok(w < 2e-3, "3: 원래 종이 6조각 = Ⓐ 조각의 강체 이동(역변환하면 Ⓐ 외곽·절개선 위) 최대 " + w.toExponential(2));
  ok(near(U.h, 2 * u, 1e-9) && near(Math.abs(U.b1B) * 180 / Math.PI, m.rotationDeg.backMid, 1e-6) && near(Math.abs(U.b2B) * 180 / Math.PI, m.rotationDeg.backOuterRelative, 1e-6)
    && near(Math.abs(U.b1F) * 180 / Math.PI, m.rotationDeg.frontMid, 1e-6) && near(Math.abs(U.b2F) * 180 / Math.PI, m.rotationDeg.frontOuterRelative, 1e-6),
    "3: 평행 2⊠ · 중간 회전 뒤 " + m.rotationDeg.backMid.toFixed(2) + "° · 바깥 추가 " + m.rotationDeg.backOuterRelative.toFixed(2) + "° (합 " + m.rotationDeg.backOuterTotal.toFixed(2) + "°)");
  // 바깥 기준점 = 바깥 절개선 × Ⓐ 소매산 이 중간 조각과 함께 운반된 점(상위 회전에 같이 실려 감)
  const pvB2 = { x: rot(m.pivots.backOuter, U.b1B, m.pivots.backInner).x + U.h, y: rot(m.pivots.backOuter, U.b1B, m.pivots.backInner).y };
  const pvB1 = { x: m.pivots.backInner.x + U.h, y: m.pivots.backInner.y };
  ok(D(pvB2, m.pivots.backOuterBefore) < 1e-9 && D(pvB1, m.pivots.backInnerBefore) < 1e-9 && near(m.pivots.backInnerBefore.x, SPA.x + (UbA.x - SPA.x) / 3, 1e-9) && near(m.pivots.backOuterBefore.x, SPA.x + 2 * (UbA.x - SPA.x) / 3, 1e-9)
    && dTo(m.pivots.backOuterBefore, dense(capA, 400)) < 1e-3, "3: 안쪽 기준점 = 1/3 절개선 × 소매산(평행 이동) · 바깥 기준점 = 2/3 절개선 × 소매산(중간 조각과 함께 운반)");
  ok(overlapCount(m) === 0 && m.checks.piecesOverlap === false, "3: 원래 종이 6조각 겹침 없음");
  const pc = m.rigid.pieces, flat = k => pc[k].filter(p => near(p.y, HY, 1e-9)).length;
  ok(flat("backCenter") >= 2 && flat("frontCenter") >= 2 && flat("backMid") === 0 && flat("backOuter") === 0, "3: 중심 쪽 조각 밑단은 수평 그대로(고정) · 중간·바깥만 기울어짐");
  const sb = seg(g, "side-seam-back"); ok(near(D(sb.from, sb.to), HY - UbA.y) && D(sb.to, m.underarm.after.back) < 1e-9, "3: 옆선 = Ⓐ 옆선 길이 그대로(강체)");
}
// ── 4. 소매산 ──
{
  const top = m.rise.top, iT = capM.findIndex(q => D(q[3], top) < 1e-9), kk = m.redraw.kinks, ce = m.redraw.center;
  ok(near(top.x, SPA.x) && near(top.y, SPA.y - 0.5) && iT > 0 && g.capSplit.x === SPA.x, "4: 새 꼭대기 = 원래 중심선 x · 원래 높이 − 0.5 · 분할 기준 명시");
  ok(Math.min(...dense(capM, 80).map(p => p.y)) >= top.y - 1e-9 && Math.abs(der(capM[iT], 1).y) < 1e-9 && Math.abs(der(capM[iT + 1], 0).y) < 1e-9, "4: 꼭대기가 최고점 · 접선 수평");
  let g1 = 0; for (let i = 1; i < capM.length; i++) g1 = Math.max(g1, ang(der(capM[i - 1], 1), der(capM[i], 0)));
  ok(g1 < 1e-6, "4: 소매산 전체 G1(최대 " + g1.toExponential(2) + "°) — 가운데 틈 + 꺾임 4곳 해소");
  const ks = []; [capM[iT], capM[iT + 1]].forEach(q => { for (let i = 0; i <= 200; i++) ks.push(kap(q, i / 200)); });
  const sg = ks.filter(k => Math.abs(k) > 1e-6).map(Math.sign); ok(sg.every(s => s === sg[0]), "4: 가운데 재제도 구간 변곡·국소 S 없음(불감대 없이)");
  const rigidCap = dense(cubsOf(m.rigid.cap), 200), rigidCapF = dense(cubsOf(m.rigid.capFront), 200); let off = 0, stray = 0, n = 0;
  dense(capM, 60).forEach(p => { n++; if (Math.min(dTo(p, rigidCap), dTo(p, rigidCapF)) > 2e-3) { off++;
    const near4 = ["backInner", "backOuter", "frontInner", "frontOuter"].some((k, i) => { const w = kk.windows[["Pb1", "Pb2", "Pf1", "Pf2"][i]]; return D(p, m.pivots[k]) < w[0] + w[1] + 0.5; });
    if (!(near4 || (p.x > ce.from.x - 1e-6 && p.x < ce.to.x + 1e-6))) stray++; } });
  ok(stray === 0 && off > 0 && off < n * 0.6, "4: 재제도 구간(가운데 + 꺾임 4곳) 밖은 원래 소매산 그대로(벗어난 점 " + off + "/" + n + " · 구간 밖 0)");
  ok(ce.ellCm >= 0 && ce.ellCm <= 3 && ["Pb2", "Pb1", "Pf1", "Pf2"].every(k => kk.ellChosenCm[k] >= 0.5 && kk.ellChosenCm[k] <= 2) && /잠정/.test(m.redraw.status),
    "4: 재제도 구간(잠정) 가운데 " + ce.ellCm + " · 꺾임 " + ["Pb2", "Pb1", "Pf1", "Pf2"].map(k => kk.ellChosenCm[k]).join("/") + "cm");
  const r0 = SM.draftSleeveM(A, { riseCm: 0 }), r7 = SM.draftSleeveM(A, { riseCm: 0.7 });
  ok(r0.ok && r7.ok && J(r0.meta.hem) === J(m.hem) && J(r7.meta.hem) === J(m.hem) && r0.meta.formula.gatherRatio === 0.7 && r0.meta.capLengths.total < m.capLengths.total && m.capLengths.total < r7.meta.capLengths.total,
    "4: 상승은 개더 계수·∅·소맷부리와 독립 · 상승↑ → 소매산↑ (0:" + r0.meta.capLengths.total.toFixed(3) + " 0.5:" + m.capLengths.total.toFixed(3) + " 0.7:" + r7.meta.capLengths.total.toFixed(3) + ")");
}
// ── 5. 길이(중심선 명시 분할 · 독립 적분) ──
{
  const ind = indep(seg(g, "cap"), SPA.x), indA = indep(A.geometry.outline[0], SPA.x), prim = DS.capPrimitives(g);
  ok(prim && Math.abs(prim.lengths.back - ind.back) < 5e-3 && Math.abs(prim.lengths.front - ind.front) < 5e-3 && D(prim.splitPoint, m.rise.top) < 1e-9, "5: 공용 측정 뒤 " + prim.lengths.back.toFixed(3) + " · 앞 " + prim.lengths.front.toFixed(3) + " = 중심선 독립 적분 · 분할점 = 새 꼭대기");
  ok(Math.abs(m.capLengths.back - ind.back) < 2e-3 && Math.abs(m.capLengths.front - ind.front) < 2e-3 && near(m.capLengths.back + m.capLengths.front, m.capLengths.total, 1e-9), "5: 엔진 meta 같은 기준 · 앞 + 뒤 = 총");
  ok(Math.abs(m.capLengthsA.back - indA.back) < 2e-3 && Math.abs(m.capLengthsA.front - indA.front) < 2e-3, "5: Ⓐ 소매산(같은 중심선 분할) 뒤 " + indA.back.toFixed(3) + " · 앞 " + indA.front.toFixed(3));
  ["back", "front"].forEach(sd => ok(Math.abs((indA[sd] - AH[sd]) + (ind[sd] - indA[sd]) - (ind[sd] - AH[sd])) < 1e-12 && Math.abs(m.easeA[sd] - (indA[sd] - AH[sd])) < 2e-3 && Math.abs(m.addedGather[sd] - (ind[sd] - indA[sd])) < 2e-3,
    "5: " + sd + " Ⓐ 이세 " + m.easeA[sd].toFixed(3) + " + 추가 개더 " + m.addedGather[sd].toFixed(3) + " = 최종 − AH " + m.totalOverAH[sd].toFixed(3)));
  const pl = dense(hemM, 400).sort((a, b) => a.x - b.x); let cy = null; for (let i = 1; i < pl.length; i++) if (pl[i].x >= SPA.x) { const a = pl[i - 1], b = pl[i]; cy = a.y + (b.y - a.y) * (SPA.x - a.x) / (b.x - a.x || 1); break; }
  ok(m.centerLength.inputCm === 20 && Math.abs(m.centerLength.spreadCm - (cy - m.sp.y)) < 2e-3 && m.centerLength.spreadCm !== 20, "5: 입력 소매길이 20 vs 벌린 뒤 중심 길이(실측) " + m.centerLength.spreadCm.toFixed(3));
}
// ── 6. 소맷부리 fairing · 외곽 ──
{
  ok(D(hemM[0][0], he.frontOuter) < 1e-9 && D(hemM[hemM.length - 1][3], he.backOuter) < 1e-9, "6: 소맷부리 양 끝 = 바깥 조각 밑단 끝점(고정)");
  let g1 = 0; for (let i = 1; i < hemM.length; i++) g1 = Math.max(g1, ang(der(hemM[i - 1], 1), der(hemM[i], 0)));
  const ks = []; hemM.forEach(q => { for (let i = 0; i <= 200; i++) ks.push(kap(q, i / 200)); });
  const sg = ks.filter(k => Math.abs(k) > 0.01).map(Math.sign);
  ok(g1 < 1e-6 && sg.every(s => s === sg[0]) && m.hem.fair.inflections === 0, "6: 소맷부리 G1 · 변곡·잔물결 없음");
  const pl = dense(hemM, 200).sort((a, b) => a.x - b.x), yAt = (x) => { for (let i = 1; i < pl.length; i++) if (pl[i].x >= x) { const a = pl[i - 1], b = pl[i], t = (x - a.x) / (b.x - a.x || 1); return a.y + (b.y - a.y) * t; } return pl[pl.length - 1].y; };
  let cut = 0, out = 0; [[he.frontOuter, he.frontOuterIn], [he.frontMidOut, he.frontMidIn], [he.frontCenterOut, he.frontCenterMid], [he.backCenterMid, he.backCenterOut], [he.backMidIn, he.backMidOut], [he.backOuterIn, he.backOuter]].forEach(([a, b]) => {
    for (let i = 0; i <= 400; i++) { const t = i / 400, x = a.x + (b.x - a.x) * t, d = yAt(x) - (a.y + (b.y - a.y) * t); if (d < 0) cut = Math.max(cut, -d); else out = Math.max(out, d); } });
  ok(Math.abs(cut - m.hem.fair.maxCutCm) < 5e-3 && Math.abs(out - m.hem.fair.maxOutwardCm) < 5e-3 && cut < 0.3 && out < 0.3, "6: 원래 밑단 대비 파임 최대 " + cut.toFixed(3) + " · 덧댐 최대 " + out.toFixed(3) + " cm(변 전체 독립 측정 = meta)");
  const r = ring(g); ok(D(r[0], r[r.length - 1]) < 1e-9 && !selfX(r.slice(0, -1).concat([r[0]])), "6: 단일 폐곡선 · 자기교차 없음");
  ok(g.outline.map(s => s.role).join() === "cap,side-seam-front,hem,side-seam-back" && g.construction.length === 11 && m.fill.center.length > 10, "6: 외곽 역할 · construction 11 · 덧댐 자료");
}
// ── 7. 입력 · ■ < 0 · 실제 기하 실패와 설정 한계 구분 ──
{
  [[{ upperArmCm: 0 }, "invalid-upper-arm"], [{ upperArmCm: NaN }, "invalid-upper-arm"], [{ upperArmCm: "26" }, "invalid-upper-arm"], [{ riseCm: -0.1 }, "invalid-rise"], [{ riseCm: "0.5" }, "invalid-rise"]].forEach(([p, why]) => {
    const r = SM.draftSleeveM(A, p); ok(!r.ok && r.reason === why && !r.geometry, "7: 거부 " + J(p) + " → " + why); });
  [30, 32].forEach(arm => {
    const r = SM.draftSleeveM(A, { upperArmCm: arm }), sq = W0 - (arm + 4), o = r.ok ? opened5(r.meta.hemPoints) : [];
    ok(r.ok && sq < 0 && near(r.meta.formula.square, sq, 1e-12) && near(r.meta.formula.spread, 1.7 * (arm + 4) - W0, 1e-12) && r.meta.cuff.upperArmCm === arm && r.meta.widthCm === W0
      && o.every((v, i) => near(v, [1, 2, 4, 2, 1][i] * r.meta.formula.unit)) && overlapCount(r.meta) === 0 && !selfX(ring(r.geometry)),
      "7: ■ < 0 성공 — 위팔 " + arm + " · ■ " + sq.toFixed(2) + " (부호 그대로 · 출발 폭 그대로 · 현 1:2:4:2:1)");
  });
  const A15 = SA.draftSleeveA(BA, { sleeveLengthCm: 15 }), g30 = SM.draftSleeveM(A15, { upperArmCm: 30 });
  ok(!g30.ok && g30.reason === "rotation-too-large" && g30.numericGuard === true && g30.detail.kind === "numeric-guard" && near(g30.detail.limitDeg, 45, 1e-9) && g30.detail.deg > 45, "7: 소매길이 15 · 위팔 30 = 회전 수치 가드(45° — 책 규칙 아님) 초과 " + (g30.detail ? g30.detail.deg.toFixed(1) : "-") + "°");
  const b15 = SM.draftSleeveM(A, { riseCm: 1.5 });
  ok(!b15.ok && b15.reason === "bridge-inflection-unavoidable" && b15.provisionalLimit === true && b15.detail.kind === "provisional-limit" && b15.detail.ratio === 0.5, "7: 상승 1.5 = 가운데 틈 재제도 잠정 구간 상한(중심 쪽 호 50%) 안에서 못 이음 — 잠정 설정 한계로 표시");
  const low = SM.draftSleeveM(A, { upperArmCm: 14 });
  ok(!low.ok && low.reason === "no-spread", "7: ∅ ≤ 0(위팔 둘레가 아주 작음) = 벌릴 것 없음");
  ok(!SM.draftSleeveM(null, {}).ok, "7: Ⓐ 없음 거부");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SM.draftSleeveM(Af, {}), e2 = SM.draftSleeveM(Af, { upperArmCm: 26, riseCm: 0.5 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(R) && typeof R.sourceSleeveAHash === "string" && R.sourceSleeveAHash.length > 0, "7: 동결 입력 · 결정성 · 기본값 26 / 0.5 · 출발 Ⓐ hash");
}
// ── 8. sweep(몸판 × 소매길이 × 위팔 × 상승 0 / 0.5) ──
{
  let n = 0, okN = 0, negOk = 0; const out = {}, bad = []; const worst = { open: 0, cut: 0, outw: 0, infl: 0, g1: 0, rigid: 0, overlap: 0, rotMax: 0, split: 0, ident: 0, hemVsFormula: 0, bridge: 0 };
  for (const [sym, id] of presets()) {
    const br = bodiceResultOf(id); if (!br) continue; const ah = br.armholeLengths;
    for (const SLc of [15, 20, 25]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SLc }); if (!a.ok) continue; const x0 = a.meta.sp.x, Wd = a.meta.bicepCm, indA = indep(a.geometry.outline[0], x0);
      for (const arm of [22, 26, 30, 32]) for (const rise of [0, 0.5]) {
        n++;
        const r = SM.draftSleeveM(a, { upperArmCm: arm, riseCm: rise }), tag = sym + SLc + "/" + arm + "/" + rise;
        if (!r.ok) {
          out[r.reason] = (out[r.reason] || 0) + 1;
          if (!r.outOfSupportedRange) bad.push(tag + ":" + r.reason);
          if (r.reason === "rotation-too-large" && !(r.numericGuard && r.detail.deg > 45)) bad.push(tag + ":guard-unlabeled");
          if (r.reason === "bridge-inflection-unavoidable" && !r.provisionalLimit) bad.push(tag + ":limit-unlabeled");
          continue;
        }
        okN++;
        const M = r.meta, cs = cubsOf(r.geometry.outline[0]), hs = cubsOf(r.geometry.outline[2]);
        if (M.formula.square < 0) negOk++;
        if (M.cuff.upperArmCm !== arm || M.sleeveLengthCm !== SLc || M.widthCm !== Wd || M.rise.cm !== rise) bad.push(tag + ":input-changed");
        opened5(M.hemPoints).forEach((v, i) => { worst.open = Math.max(worst.open, Math.abs(v - [1, 2, 4, 2, 1][i] * M.formula.unit)); });
        worst.cut = Math.max(worst.cut, M.hem.fair.maxCutCm); worst.outw = Math.max(worst.outw, M.hem.fair.maxOutwardCm); worst.infl += M.hem.fair.inflections;
        for (let i = 1; i < cs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(cs[i - 1], 1), der(cs[i], 0)));
        for (let i = 1; i < hs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(hs[i - 1], 1), der(hs[i], 0)));
        const hk = []; hs.forEach(q => { for (let i = 0; i <= 80; i++) hk.push(kap(q, i / 80)); }); const sg = hk.filter(k => Math.abs(k) > 0.01).map(Math.sign); if (!sg.every(s => s === sg[0])) bad.push(tag + ":hemS");
        worst.rigid = Math.max(worst.rigid, rigidWorst(M, a)); worst.overlap = Math.max(worst.overlap, overlapCount(M));
        worst.rotMax = Math.max(worst.rotMax, M.rotationDeg.backOuterTotal, M.rotationDeg.frontOuterTotal); worst.bridge = Math.max(worst.bridge, M.redraw.center.ellCm);
        const prim = DS.capPrimitives(r.geometry), ind = indep(r.geometry.outline[0], x0);
        if (!prim) { bad.push(tag + ":prim-null"); continue; }
        worst.split = Math.max(worst.split, Math.abs(prim.lengths.back - ind.back), Math.abs(prim.lengths.front - ind.front), Math.abs(prim.splitPoint.x - x0));
        ["back", "front"].forEach(sd => { worst.ident = Math.max(worst.ident, Math.abs(M.easeA[sd] + M.addedGather[sd] - M.totalOverAH[sd]), Math.abs(M.totalOverAH[sd] - (ind[sd] - ah[sd]))); });
        worst.hemVsFormula = Math.max(worst.hemVsFormula, Math.abs(M.hem.lengthCm - M.hem.formulaHemCm));
        if (selfX(ring(r.geometry))) bad.push(tag + ":selfX");
      }
    }
  }
  Object.keys(worst).forEach(k => { worst[k] = Math.round(worst[k] * 1e4) / 1e4; });
  console.log("  sweep: " + n + " 경우 — 성립 " + okN + "(그중 ■ < 0 " + negOk + ") · 멈춤 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 300 && okN + Object.values(out).reduce((a, b) => a + b, 0) === n && okN >= n * 0.6 && negOk >= 30, "8: sweep " + n + " — 성립 " + okN + "(■ < 0 " + negOk + ") · 멈춤 " + J(out));
  ok(!bad.length, "8: 표시 없는 실패·값 대체·자기교차·소맷부리 잔물결·이름 없는 설정 한계 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-9 && worst.infl === 0 && worst.g1 < 1e-6 && worst.rigid < 2e-3 && worst.overlap === 0 && worst.split < 5e-3 && worst.ident < 5e-3,
    "8: sweep 불변식(현 1:2:4:2:1 · 소맷부리 변곡 0 · G1 · 강체 · 겹침 없음 · 앞/뒤 = 중심선 독립 적분 · 이세 + 추가 개더 = 총 차이)");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
