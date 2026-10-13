// ══════════════════════════════════════════════
// designSleeveKCheck.js — js/designSleeveK.js(소매 Ⓚ 퍼프, [패턴학교] P.45 하단 «Ⓙ방법 + 절개선을 넣고, 소매산을 기준점으로 잘라서 벌린다» — 2026-10-13 김님 승인 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값 (2) 산식 ●·■·∅ = 1.5● − ■ · 틈 ∅/3 ↔ 실측 벌림(현) · 산식 60/36 과 실측 구분 (3) 이동: 가운데 평행 ∅/6 · 바깥만 이동한 기준점 회전(독립 역변환) · 원래 종이 4조각 강체·겹침 없음
//   (4) 소매산: 상승 · 가운데 틈·기준점 꺾임 국소 재제도(구간 밖 보존) · 상승과 개더 계수 독립 (5) 길이: Ⓐ 이세 + 추가 개더 = 최종 − AH (6) 소맷부리 fairing(변곡·S 없음 · 파임/덧댐 독립 측정) · 외곽 (7) 입력·결정성 (8) sweep
//   node test/harness/designSleeveKCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveK.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SK = W.designSleeveK, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
const symbols = () => { const o = []; for (const f of BP.families()) for (const v of f.variants) o.push(v.symbol); return o; };
function bodiceResultOf(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// ── 독립 측정(모듈과 다른 구현: 조밀 점열) ──
const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
const der = (q, t) => { const u = 1 - t; return { x: 3*u*u*(q[1].x-q[0].x) + 6*u*t*(q[2].x-q[1].x) + 3*t*t*(q[3].x-q[2].x), y: 3*u*u*(q[1].y-q[0].y) + 6*u*t*(q[2].y-q[1].y) + 3*t*t*(q[3].y-q[2].y) }; };
function cubsOf(p) { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; }
const denseLen = (cs) => { let t = 0; cs.forEach(q => { let pr = q[0]; for (let i = 1; i <= 6000; i++) { const p = cub(q, i / 6000); t += D(pr, p); pr = p; } }); return t; };
const ang = (u, v) => Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI;
const crossO = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((crossO(c, d, a) > 0) !== (crossO(c, d, b) > 0)) && ((crossO(a, b, c) > 0) !== (crossO(a, b, d) > 0));
function ringOf(g) { const r = []; cubsOf(g.outline[0]).forEach((q, i) => { for (let k = i ? 1 : 0; k <= 80; k++) r.push(cub(q, k / 80)); }); g.outline.slice(1).forEach(s => { if (s.kind === "path") cubsOf(s).forEach(q => { for (let k = 1; k <= 40; k++) r.push(cub(q, k / 40)); }); else r.push(s.to); }); return r; }
function selfX(r) { const n = r.length; for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (xseg(r[i], r[i + 1], r[j], r[j + 1])) return true; } return false; }
const seg = (g, role) => g.outline.find(s => s.role === role);

const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const ringH = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
const role = (g, r) => g.outline.find(s => s.role === r), cons = (g, r) => g.construction.find(c => c.role === r);

const kapI = (q, t) => { const a = der(q, t), u = 1 - t, b = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) }; return (a.x * b.y - a.y * b.x) / Math.pow(Math.hypot(a.x, a.y), 3); };
const ringI = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
// ── 1. API ──
{
  ok(typeof SK.draftSleeveK === "function" && Object.isFrozen(SK) && Object.isFrozen(SK.RULES), "1: API 동결");
  ok(SK.RULES.palmDefaultCm === 21 && SK.RULES.cuffAddCm === 3 && SK.RULES.cuffWidthCm === 1 && SK.RULES.cuts === 3 && SK.RULES.gatherRatio === 1.5 && SK.RULES.riseDefaultCm === 0.7, "1: 손바닥 21 · 커프스 +3 · 폭 1 · 절개 3 · 개더 계수 1.5 · 상승 0.7");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const R = SK.draftSleeveK(A, {});
ok(A.ok && R.ok, "기준: B83 SL52 기본 성공 " + (R.reason || ""));
const m = R.meta, g = R.geometry, W0 = A.meta.bicepCm, SPA = A.meta.sp, capA = cubsOf(A.geometry.outline[0]), HY = 52;
const kA = capA.findIndex(q => D(q[3], SPA) < 1e-9), gap = m.formula.perCut, half = gap / 2;
const capK = cubsOf(seg(g, "cap")), hemK = cubsOf(seg(g, "hem")), he = m.hemPoints;
const UbA = capA[0][0], UfA = capA[capA.length - 1][3];
const dTo = (p, pl) => { let b = Infinity; for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], c = pl[i], vx = c.x - a.x, vy = c.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1))); b = Math.min(b, Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y)); } return b; };
const rot = (p, a, c) => { const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
// Ⓐ 외곽(소매산 조밀 점열 + 옆선·소맷부리 직사각 변 + 절개선 3개)
const ABOUND = (a) => { const cs = cubsOf(a.geometry.outline[0]), ub = cs[0][0], uf = cs[cs.length - 1][3], H = a.meta.sleeveLengthCm, sp = a.meta.sp, xb = (ub.x + sp.x) / 2, xf = (uf.x + sp.x) / 2;
  const capPl = dense(cs, 300); const yAt = (x) => { let b = capPl[0]; capPl.forEach(q => { if (Math.abs(q.x - x) < Math.abs(b.x - x)) b = q; }); return b.y; };
  return { cap: capPl, lines: [[ub, { x: ub.x, y: H }], [{ x: ub.x, y: H }, { x: uf.x, y: H }], [{ x: uf.x, y: H }, uf], [{ x: xb, y: yAt(xb) }, { x: xb, y: H }], [{ x: sp.x, y: sp.y }, { x: sp.x, y: H }], [{ x: xf, y: yAt(xf) }, { x: xf, y: H }]] }; };
const onA = (p, AB) => Math.min(dTo(p, AB.cap), ...AB.lines.map(l => dTo(p, l)));
// 조각별 역변환(독립 재구성): 중심 쪽 = 평행 이동만 · 바깥 = 기준점 중심 회전 + 평행 이동 — 회전각은 틈의 두 밑단 끝점에서 다시 계산
function unmove(M) { const h = M.formula.perCut / 2, pv = M.pivots, hp = M.hemPoints;
  const bB = Math.atan2(hp.backInner.y - pv.back.y, hp.backInner.x - pv.back.x) - Math.atan2(hp.backCenterOuter.y - pv.back.y, hp.backCenterOuter.x - pv.back.x);
  const bF = Math.atan2(hp.frontInner.y - pv.front.y, hp.frontInner.x - pv.front.x) - Math.atan2(hp.frontCenterOuter.y - pv.front.y, hp.frontCenterOuter.x - pv.front.x);
  return { backCenter: p => ({ x: p.x + h, y: p.y }), frontCenter: p => ({ x: p.x - h, y: p.y }),
    backOuter: p => { const q = rot(p, -bB, pv.back); return { x: q.x + h, y: q.y }; }, frontOuter: p => { const q = rot(p, -bF, pv.front); return { x: q.x - h, y: q.y }; }, bB, bF }; }
function rigidWorst(M, a) { const AB = ABOUND(a), U = unmove(M); let w = 0; ["backOuter", "backCenter", "frontCenter", "frontOuter"].forEach(k => M.rigid.pieces[k].forEach(p => { w = Math.max(w, onA(U[k](p), AB)); })); return w; }
const side = (o, a, p) => (a.x - o.x) * (p.y - o.y) - (a.y - o.y) * (p.x - o.x);
function overlapWorst(M) { const pc = M.rigid.pieces, pv = M.pivots, hp = M.hemPoints, X0 = M.rise.top.x; let w = 0;
  pc.backCenter.forEach(p => { w = Math.max(w, p.x - (X0 - M.formula.perCut / 2)); }); pc.frontCenter.forEach(p => { w = Math.max(w, (X0 + M.formula.perCut / 2) - p.x); });
  const Lb = Math.hypot(hp.backCenterOuter.x - pv.back.x, hp.backCenterOuter.y - pv.back.y), Lf = Math.hypot(hp.frontCenterOuter.x - pv.front.x, hp.frontCenterOuter.y - pv.front.y);
  pc.backOuter.forEach(p => { w = Math.max(w, -side(pv.back, hp.backCenterOuter, p) / Lb); pc; });      // 뒤 바깥 조각은 절개선(기준점 → 중심 쪽 조각 밑단)의 바깥쪽
  pc.frontOuter.forEach(p => { w = Math.max(w, side(pv.front, hp.frontCenterOuter, p) / Lf); });
  return w; }
// ── 2. 산식 ↔ 실측 ──
{
  const cuff = 24, sq = W0 - cuff, spread = 1.5 * cuff - sq;
  ok(Math.abs(m.formula.square - sq) < 1e-12 && Math.abs(m.formula.spread - spread) < 1e-12 && Math.abs(spread - (2.5 * cuff - W0)) < 1e-12 && Math.abs(gap - spread / 3) < 1e-12 && Math.abs(m.formula.parallelEachSideCm - spread / 6) < 1e-12 && m.cuff.lengthCm === 24 && m.cuff.widthCm === 1,
    "2: ● 24 · ■ = W − ● · ∅ = 1.5● − ■ = 2.5● − W = " + spread.toFixed(3) + " · 틈 ∅/3 = " + gap.toFixed(3));
  const ob = D(he.backInner, he.backCenterOuter), oc = D(he.backCenterMid, he.frontCenterMid), of = D(he.frontCenterOuter, he.frontInner);
  ok([ob, oc, of].every(v => Math.abs(v - gap) < 1e-9), "2: 실측 벌림(현) 뒤 " + ob.toFixed(4) + " · 가운데 " + oc.toFixed(4) + " · 앞 " + of.toFixed(4));
  ok(near(he.backCenterMid.y, HY) && near(he.frontCenterMid.y, HY) && near(he.backCenterMid.x, SPA.x - half) && near(he.frontCenterMid.x, SPA.x + half), "2: 가운데 틈 = 평행(좌우 ∅/6 · 수직 변 · 틈 가운데 = 원래 중심선)");
  ok(m.hem.formulaHemCm === 60 && m.hem.formulaGatherCm === 36 && m.formula.gatherRatio === 1.5, "2: 산식 소맷부리 2.5● = 60 · 개더 1.5● = 36(실측과 따로)");
  const hl = denseLen(hemK);
  ok(Math.abs(hl - m.hem.lengthCm) < 1e-3 && Math.abs(m.hem.gatherCm - (m.hem.lengthCm - 24)) < 1e-12 && Math.abs(hl - 60) < 0.5 && hl !== 60, "2: 소맷부리 실측(권위값) " + hl.toFixed(3) + " — 산식에 맞추지 않음 · 개더(실측) " + m.hem.gatherCm.toFixed(3));
}
// ── 3. 이동(독립 재구성) ──
{
  const w = rigidWorst(m, A), U = unmove(m);
  ok(w < 2e-3, "3: 원래 종이 4조각 = Ⓐ 조각의 강체 이동(역변환하면 Ⓐ 외곽·절개선 위) 최대 " + w.toExponential(2));
  ok(Math.abs(U.bB * 180 / Math.PI - m.rotationDeg.backOuter) < 1e-6 && Math.abs(-U.bF * 180 / Math.PI - m.rotationDeg.frontOuter) < 1e-6 && m.rotationDeg.center === 0, "3: 바깥 조각 회전 뒤 " + m.rotationDeg.backOuter.toFixed(3) + "° · 앞 " + m.rotationDeg.frontOuter.toFixed(3) + "° · 중심 쪽 0°");
  ok(near(m.pivots.back.x, m.pivots.backBefore.x - half) && near(m.pivots.back.y, m.pivots.backBefore.y) && near(m.pivots.front.x, m.pivots.frontBefore.x + half) && near(m.pivots.front.y, m.pivots.frontBefore.y)
    && near(m.pivots.backBefore.x, (UbA.x + SPA.x) / 2) && near(m.pivots.frontBefore.x, (UfA.x + SPA.x) / 2) && dTo(m.pivots.backBefore, dense(capA, 400)) < 1e-3, "3: 기준점 = 반폭 중점 절개선 × Ⓐ 소매산 → ∅/6 평행 이동");
  const pcs = m.rigid.pieces, flat = (k) => pcs[k].filter(p => near(p.y, HY, 1e-9)).length;
  ok(flat("backCenter") >= 2 && flat("frontCenter") >= 2 && flat("backOuter") === 0 && flat("frontOuter") === 0, "3: 중심 쪽 조각 밑단은 수평 그대로 · 바깥 조각만 기울어짐");
  ok(overlapWorst(m) < 1e-6, "6: 원래 종이 4조각 겹침 없음(가운데 틈 · 양옆 쐐기)");
  const sb = seg(g, "side-seam-back"), sf = seg(g, "side-seam-front");
  ok(Math.abs(D(sb.from, sb.to) - (HY - UbA.y)) < 1e-9 && Math.abs(D(sf.from, sf.to) - (HY - UfA.y)) < 1e-9 && D(sb.to, m.underarm.after.back) < 1e-9 && D(sf.from, m.underarm.after.front) < 1e-9, "3: 옆선 = Ⓐ 옆선 길이 그대로(강체) · 진동밑 이동점에서 시작");
}
// ── 4. 소매산: 상승 · 국소 재제도 ──
{
  const top = m.rise.top, iT = capK.findIndex(q => D(q[3], top) < 1e-9);
  ok(near(top.x, SPA.x) && near(top.y, SPA.y - 0.7) && iT > 0, "4: 새 꼭대기 = 원래 중심선 x · 원래 높이 − 0.7");
  ok(Math.min(...dense(capK, 80).map(p => p.y)) >= top.y - 1e-9 && Math.abs(der(capK[iT], 1).y) < 1e-9 && Math.abs(der(capK[iT + 1], 0).y) < 1e-9, "4: 꼭대기가 최고점 · 접선 수평");
  let g1 = 0; for (let i = 1; i < capK.length; i++) g1 = Math.max(g1, ang(der(capK[i - 1], 1), der(capK[i], 0)));
  ok(g1 < 1e-6, "4: 소매산 전체 G1(최대 " + g1.toExponential(2) + "°)");
  const ks = []; [capK[iT], capK[iT + 1]].forEach(q => { for (let i = 0; i <= 200; i++) ks.push(kapI(q, i / 200)); });
  const sg = ks.filter(k => Math.abs(k) > 1e-6).map(Math.sign); ok(sg.every(s => s === sg[0]), "4: 가운데 재제도 구간 변곡·국소 S 없음(불감대 없이 곡률 부호 한쪽)");
  // 재제도 밖 = 원래(이동한) 소매산 그대로: 최종 소매산 점 중 원래 종이 윗변에서 벗어난 점은 세 재제도 구간 근처에만 있다
  const rigidCap = dense(cubsOf(m.rigid.cap), 200), rigidCapF = dense(cubsOf(m.rigid.capFront), 200), kk = m.redraw.kinks, ce = m.redraw.center;
  let off = 0, stray = 0, n = 0;
  dense(capK, 60).forEach(p => { n++; const d = Math.min(dTo(p, rigidCap), dTo(p, rigidCapF)); if (d > 2e-3) { off++;
    const nearB = D(p, m.pivots.back) < kk.windows.Pb[0] + kk.windows.Pb[1] + 0.5, nearF = D(p, m.pivots.front) < kk.windows.Pf[0] + kk.windows.Pf[1] + 0.5, nearC = p.x > ce.from.x - 1e-6 && p.x < ce.to.x + 1e-6;
    if (!(nearB || nearF || nearC)) stray++; } });
  ok(stray === 0 && off > 0 && off < n * 0.5, "4: 재제도 구간(가운데 · 기준점 2곳) 밖은 원래 소매산 그대로(벗어난 점 " + off + "/" + n + " · 구간 밖 0)");
  ok(ce.ellCm >= 0 && ce.ellCm <= 3 && kk.ellChosenCm.Pb <= 2 && kk.ellChosenCm.Pb >= 0.5 && kk.ellChosenCm.Pf <= 2 && kk.ellChosenCm.Pf >= 0.5, "4: 재제도 구간 가운데 " + ce.ellCm + " · 뒤 " + kk.ellChosenCm.Pb + " · 앞 " + kk.ellChosenCm.Pf + "cm(국소 · 잠정)");
  const r0 = SK.draftSleeveK(A, { riseCm: 0 }), r15 = SK.draftSleeveK(A, { riseCm: 1.5 });
  ok(r0.ok && r15.ok && r0.meta.formula.spread === m.formula.spread && J(r15.meta.hem) === J(m.hem) && J(r0.meta.hem) === J(m.hem) && r15.meta.formula.gatherRatio === 1.5
    && r0.meta.capLengths.total < m.capLengths.total && m.capLengths.total < r15.meta.capLengths.total,
    "4: 상승은 개더 계수·∅·소맷부리와 독립 · 상승↑ → 소매산↑ (0:" + r0.meta.capLengths.total.toFixed(3) + " 0.7:" + m.capLengths.total.toFixed(3) + " 1.5:" + r15.meta.capLengths.total.toFixed(3) + ")");
}
// ── 5. 길이 ──
{
  const iT = capK.findIndex(q => D(q[3], m.rise.top) < 1e-9);
  const lb = denseLen(capK.slice(0, iT + 1)), lf = denseLen(capK.slice(iT + 1)), ab = denseLen(capA.slice(0, kA + 1)), af = denseLen(capA.slice(kA + 1)), AH = BA.armholeLengths;
  ok(Math.abs(lb - m.capLengths.back) < 1e-3 && Math.abs(lf - m.capLengths.front) < 1e-3, "5: 소매산 뒤 " + lb.toFixed(3) + " · 앞 " + lf.toFixed(3) + " = meta");
  ok(Math.abs(ab - m.capLengthsA.back) < 1e-3 && Math.abs(af - m.capLengthsA.front) < 1e-3, "5: Ⓐ 소매산 뒤 " + ab.toFixed(3) + " · 앞 " + af.toFixed(3));
  ok(Math.abs(m.easeA.total - (ab + af - AH.back - AH.front)) < 1e-3 && Math.abs(m.addedGather.total - (lb + lf - ab - af)) < 1e-3, "5: Ⓐ 이세 " + m.easeA.total.toFixed(3) + " · 추가 개더 " + m.addedGather.total.toFixed(3));
  ok(Math.abs(m.totalOverAH.total - (m.easeA.total + m.addedGather.total)) < 1e-9 && Math.abs(m.totalOverAH.total - (lb + lf - AH.back - AH.front)) < 1e-3, "5: 최종 − AH = Ⓐ 이세 + 추가 개더 " + m.totalOverAH.total.toFixed(3));
  const prim = DS.capPrimitives(g); ok(prim && D(prim.splitPoint, m.rise.top) < 1e-9 && Math.abs(prim.lengths.total - m.capLengths.total) < 5e-3, "5: capPrimitives 와 일치(분할 = 새 꼭대기)");
}
// ── 6. 소맷부리 fairing · 외곽 ──
{
  ok(D(hemK[0][0], he.frontOuter) < 1e-9 && D(hemK[hemK.length - 1][3], he.backOuter) < 1e-9, "6: 소맷부리 양 끝 = 바깥 조각 밑단 끝점(고정)");
  let g1 = 0; for (let i = 1; i < hemK.length; i++) g1 = Math.max(g1, ang(der(hemK[i - 1], 1), der(hemK[i], 0)));
  const ks = []; hemK.forEach(q => { for (let i = 0; i <= 200; i++) ks.push(kapI(q, i / 200)); });
  const sg = ks.filter(k => Math.abs(k) > 0.01).map(Math.sign);
  ok(g1 < 1e-6 && sg.every(s => s === sg[0]) && m.hem.fair.inflections === 0, "6: 소맷부리 G1 · 변곡·국소 S 없음(곡률 부호 일정)");
  const pl = dense(hemK, 200).sort((a, b) => a.x - b.x), yAt = (x) => { for (let i = 1; i < pl.length; i++) if (pl[i].x >= x) { const a = pl[i - 1], b = pl[i], t = (x - a.x) / (b.x - a.x || 1); return a.y + (b.y - a.y) * t; } return pl[pl.length - 1].y; };
  let cut = 0, out = 0; [[he.frontOuter, he.frontInner], [he.frontCenterOuter, he.frontCenterMid], [he.backCenterMid, he.backCenterOuter], [he.backInner, he.backOuter]].forEach(([a, b]) => {
    for (let i = 0; i <= 400; i++) { const t = i / 400, x = a.x + (b.x - a.x) * t, d = yAt(x) - (a.y + (b.y - a.y) * t); if (d < 0) cut = Math.max(cut, -d); else out = Math.max(out, d); } });
  ok(Math.abs(cut - m.hem.fair.maxCutCm) < 5e-3 && Math.abs(out - m.hem.fair.maxOutwardCm) < 5e-3 && cut < 0.3 && out < 0.3, "6: 원래 밑단 대비 파임 최대 " + cut.toFixed(3) + " · 덧댐 최대 " + out.toFixed(3) + " cm(독립 측정 = meta)");
  const r = ringI(g); ok(D(r[0], r[r.length - 1]) < 1e-9 && !selfX(r.slice(0, -1).concat([r[0]])), "6: 단일 폐곡선 · 자기교차 없음");
  ok(g.outline.map(s => s.role).join() === "cap,side-seam-front,hem,side-seam-back" && g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front", "6: 외곽·construction 역할");
  ok(m.fill.center.length > 10, "6: 가운데 덧댐 표시 자료");
}
// ── 7. 입력·결정성 ──
{
  const bad = [[{ palmCircumferenceCm: 0 }, "invalid-palm"], [{ palmCircumferenceCm: -1 }, "invalid-palm"], [{ palmCircumferenceCm: NaN }, "invalid-palm"], [{ palmCircumferenceCm: "21" }, "invalid-palm"],
    [{ riseCm: -0.1 }, "invalid-rise"], [{ riseCm: NaN }, "invalid-rise"], [{ riseCm: "0.7" }, "invalid-rise"], [{ palmCircumferenceCm: 9 }, "no-spread"]];
  bad.forEach(([p, why]) => { const r = SK.draftSleeveK(A, p); ok(!r.ok && r.reason === why, "7: 거부 " + J(p) + " → " + why + " (" + r.reason + ")"); });
  ok(SK.draftSleeveK(A, { palmCircumferenceCm: 9 }).outOfSupportedRange === true && !SK.draftSleeveK(null, {}).ok, "7: ∅ ≤ 0 = 지원 범위 밖 표시 · Ⓐ 없음 거부");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SK.draftSleeveK(Af, {}), e2 = SK.draftSleeveK(Af, { palmCircumferenceCm: 21, riseCm: 0.7 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(R) && typeof R.sourceSleeveAHash === "string", "7: 동결 입력 · 결정성 · 기본값 21 / 0.7 · 출발 Ⓐ hash");
}
// ── 8. sweep ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { open: 0, cut: 0, outw: 0, infl: 0, g1: 0, rigid: 0, overlap: 0, bridge: 0, kinkMin: 9, rotMax: 0, hemVsFormula: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      for (const palm of [18, 21, 24]) for (const rise of [0, 0.7, 1.5]) {
        n++;
        const r = SK.draftSleeveK(a, { palmCircumferenceCm: palm, riseCm: rise }), tag = sym + SL + "/" + palm + "/" + rise;
        if (!r.ok) { out[r.reason] = (out[r.reason] || 0) + 1; if (!r.outOfSupportedRange) bad.push(tag + ":" + r.reason); continue; }
        okN++;
        const M = r.meta, h = M.hemPoints, per = M.formula.perCut, cs = cubsOf(r.geometry.outline[0]), hs = cubsOf(r.geometry.outline[2]);
        worst.open = Math.max(worst.open, Math.abs(D(h.backInner, h.backCenterOuter) - per), Math.abs(D(h.backCenterMid, h.frontCenterMid) - per), Math.abs(D(h.frontCenterOuter, h.frontInner) - per));
        worst.cut = Math.max(worst.cut, M.hem.fair.maxCutCm); worst.outw = Math.max(worst.outw, M.hem.fair.maxOutwardCm); worst.infl += M.hem.fair.inflections;
        for (let i = 1; i < cs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(cs[i - 1], 1), der(cs[i], 0)));
        for (let i = 1; i < hs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(hs[i - 1], 1), der(hs[i], 0)));
        const hk = []; hs.forEach(q => { for (let i = 0; i <= 80; i++) hk.push(kapI(q, i / 80)); }); const sg = hk.filter(k => Math.abs(k) > 0.01).map(Math.sign); if (!sg.every(s => s === sg[0])) bad.push(tag + ":hemS");
        worst.rigid = Math.max(worst.rigid, rigidWorst(M, a)); worst.overlap = Math.max(worst.overlap, overlapWorst(M));
        worst.bridge = Math.max(worst.bridge, M.redraw.center.ellCm); worst.kinkMin = Math.min(worst.kinkMin, M.redraw.kinks.ellChosenCm.Pb, M.redraw.kinks.ellChosenCm.Pf);
        worst.rotMax = Math.max(worst.rotMax, M.rotationDeg.backOuter, M.rotationDeg.frontOuter); worst.hemVsFormula = Math.max(worst.hemVsFormula, Math.abs(M.hem.lengthCm - M.hem.formulaHemCm));
        if (selfX(ringI(r.geometry))) bad.push(tag + ":selfX");
        if (Math.abs(M.totalOverAH.total - M.easeA.total - M.addedGather.total) > 1e-9) bad.push(tag + ":identity");
        if (rise > 0 && Math.min(...dense(cs, 40).map(p => p.y)) < M.rise.top.y - 1e-9) bad.push(tag + ":top");
      }
    }
  }
  Object.keys(worst).forEach(k => { worst[k] = Math.round(worst[k] * 1e4) / 1e4; });
  console.log("  sweep: " + okN + "/" + n + " 성공 · 기하 가드 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 400 && okN === n, "8: sweep 전부 성립 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "8: 표시 없는 실패·자기교차·소맷부리 S·꼭대기 넘음 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-9 && worst.infl === 0 && worst.g1 < 1e-6 && worst.rigid < 2e-3 && worst.overlap < 1e-6, "8: sweep 불변식(벌림 = ∅/3 · 소맷부리 변곡 0 · G1 · 강체 · 겹침 없음)");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
