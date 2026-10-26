// ══════════════════════════════════════════════
// designSleevePCheck.js — js/designSleeveP.js(소매 Ⓟ 반소매 플레어, [패턴학교] P.48 — 2026-10-26 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값(소매길이 20 · 계수 0.7) (2) 산식 ● = W · ∅ = W × 계수 · ⊠ = ∅/10 ↔ 실측 현 1:2:4:2:1
//   (3) 이동(독립 재구성): 가운데 SP 대칭 → 중간(운반된 안쪽 기준점) → 바깥(운반된 바깥 기준점) · 원래 종이 6조각 강체 · 겹침 없음
//   (4) 소매산: 꺾임 5곳 국소 재제도(구간 밖 보존 · 국소 S 없음) · 중심선 앞/뒤 분할 = 독립 적분 · 이세 (5) 소맷부리 truing · 산식 편차(보정 없음)
//   (6) 입력·결정성·수치 가드 구분 (7) sweep(기장 × 계수 × 몸판 A·Ⓖ)
//   node test/harness/designSleevePCheck.js
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
const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) } };
sandbox.globalThis = sandbox; vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveP.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SPm = W.designSleeveP, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const pick = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; };
function bodiceOf(sym) { PROJECT = MK(BP.bodyParams(pick(sym))); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// ── 독립 측정(모듈과 다른 구현) ──
const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
const der = (q, t) => { const u = 1 - t; return { x: 3*u*u*(q[1].x-q[0].x) + 6*u*t*(q[2].x-q[1].x) + 3*t*t*(q[3].x-q[2].x), y: 3*u*u*(q[1].y-q[0].y) + 6*u*t*(q[2].y-q[1].y) + 3*t*t*(q[3].y-q[2].y) }; };
const dd2 = (q, t) => { const u = 1 - t; return { x: 6*u*(q[2].x-2*q[1].x+q[0].x) + 6*t*(q[3].x-2*q[2].x+q[1].x), y: 6*u*(q[2].y-2*q[1].y+q[0].y) + 6*t*(q[3].y-2*q[2].y+q[1].y) }; };
const kap = (q, t) => { const a = der(q, t), b = dd2(q, t), l = Math.hypot(a.x, a.y); return (a.x * b.y - a.y * b.x) / (l * l * l); };
function cubsOf(p) { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; }
const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const rot = (p, a, c) => { const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const crossO = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((crossO(c, d, a) > 0) !== (crossO(c, d, b) > 0)) && ((crossO(a, b, c) > 0) !== (crossO(a, b, d) > 0));
function selfX(r) { const n = r.length; for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (xseg(r[i], r[i + 1], r[j], r[j + 1])) return true; } return false; }
const seg = (g, role) => g.outline.find(s => s.role === role);
const ring = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
const capAtX = (cs, x) => { const pts = dense(cs, 600); for (let i = 1; i < pts.length; i++) if ((pts[i - 1].x - x) * (pts[i].x - x) <= 0) { const t = (x - pts[i - 1].x) / (pts[i].x - pts[i - 1].x || 1); return { x, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } return null; };
function splitLen(cs, X0, N = 3000) { let back = 0, front = 0, prev = null; cs.forEach(q => { for (let i = prev ? 1 : 0; i <= N; i++) { const p = cub(q, i / N); if (prev) { const d = D(prev, p); if ((prev.x + p.x) / 2 < X0) back += d; else front += d; } prev = p; } }); return { back, front }; }
function infl(cs, dead) { const sg = []; cs.forEach(q => { for (let i = 0; i <= 200; i++) { const k = kap(q, i / 200); if (k > dead) sg.push(1); else if (k < -dead) sg.push(-1); } }); let n = 0; for (let i = 1; i < sg.length; i++) if (sg[i] !== sg[i - 1]) n++; return n; }

const BA = bodiceOf("A"), A20 = SA.draftSleeveA(BA, { sleeveLengthCm: 20 });
const r = SPm.draftSleeveP(A20, {}), m = r.meta, g = r.geometry;
const capA = cubsOf(A20.geometry.outline[0]), sp = A20.meta.sp, H = A20.meta.sleeveLengthCm, Wd = A20.meta.bicepCm, X0 = sp.x;
const XL = A20.geometry.outline[1].to.x, XR = A20.geometry.outline[2].to.x;

// (1) API·기본값
ok(typeof SPm.draftSleeveP === "function" && Object.isFrozen(SPm) && Object.isFrozen(SPm.RULES) && SPm.RULES.flareRatioDefault === 0.7 && SPm.RULES.sleeveLengthDefaultCm === 20 && J(SPm.RULES.ratios) === "[1,2,4,2,1]", "1: API·기본값(계수 0.7 · 기장 20 · 1:2:4:2:1)");
ok(r.ok && m.settings.flareRatio === 0.7 && !("cuff" in m) && !("rise" in m) && /자동/.test(m.settings.note), "1: 커프스·상승 없음 · 틈 비율 자동(⊠ 독립 입력 없음)");

// (2) 산식 ↔ 실측 현
const u = Wd * 0.7 / 10, o = m.flare.openedCm;
ok(near(m.formula.widthCm, Wd) && near(m.formula.spread, Wd * 0.7, 1e-12) && near(m.formula.unit, u, 1e-12), "2: ● = W " + Wd.toFixed(2) + " · ∅ = 0.7W " + (Wd * 0.7).toFixed(2) + " · ⊠ " + u.toFixed(3));
ok([o.backOuter, o.backInner, o.center, o.frontInner, o.frontOuter].every((v, i) => near(v, [1, 2, 4, 2, 1][i] * u, 1e-9)), "2: 실측 현 = ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠");

// (3) 이동 — Ⓐ 에서 독립 재구성
const xb1 = X0 + (XL - X0) / 3, xb2 = X0 + 2 * (XL - X0) / 3, xf1 = X0 + (XR - X0) / 3, xf2 = X0 + 2 * (XR - X0) / 3;
const Pb1 = capAtX(capA, xb1), Pb2 = capAtX(capA, xb2), Pf1 = capAtX(capA, xf1), Pf2 = capAtX(capA, xf2);
const hemAt = x => ({ x, y: H });
const a0 = Math.asin(2 * u / D(sp, hemAt(X0)));
const CB = q => rot(q, a0, sp), CF = q => rot(q, -a0, sp);
const pb1 = CB(Pb1), pf1 = CF(Pf1), b1 = 2 * Math.asin(2 * u / (2 * D(pb1, CB(hemAt(xb1))))), f1 = 2 * Math.asin(2 * u / (2 * D(pf1, CF(hemAt(xf1)))));
const MBi = q => rot(CB(q), b1, pb1), MFi = q => rot(CF(q), -f1, pf1);
const pb2 = MBi(Pb2), pf2 = MFi(Pf2), b2 = 2 * Math.asin(u / (2 * D(pb2, MBi(hemAt(xb2))))), f2 = 2 * Math.asin(u / (2 * D(pf2, MFi(hemAt(xf2)))));
const OBi = q => rot(MBi(q), b2, pb2), OFi = q => rot(MFi(q), -f2, pf2);
const hp = m.hemPoints;
const exp = { backOuter: OBi(hemAt(XL)), backOuterIn: OBi(hemAt(xb2)), backMidOut: MBi(hemAt(xb2)), backMidIn: MBi(hemAt(xb1)), backCenterOut: CB(hemAt(xb1)), backCenterMid: CB(hemAt(X0)),
  frontCenterMid: CF(hemAt(X0)), frontCenterOut: CF(hemAt(xf1)), frontMidIn: MFi(hemAt(xf1)), frontMidOut: MFi(hemAt(xf2)), frontOuterIn: OFi(hemAt(xf2)), frontOuter: OFi(hemAt(XR)) };
ok(Object.keys(exp).every(k => D(exp[k], hp[k]) < 1e-4), "3: 밑단 12점 = 독립 재구성(SP 대칭 → 운반된 안쪽 → 운반된 바깥) " + Math.max(...Object.keys(exp).map(k => D(exp[k], hp[k]))).toExponential(1));
ok(D(m.pivots.backInner, pb1) < 1e-4 && D(m.pivots.backOuter, pb2) < 1e-4 && D(m.pivots.frontOuter, pf2) < 1e-4 && D(m.pivots.backOuterBefore, Pb2) < 1e-4, "3: 기준점 = 부모 변환을 따라 운반됨");
ok(near(m.rotationDeg.center, a0 * 180 / Math.PI, 1e-9) && near(m.rotationDeg.backOuterTotal, (a0 + b1 + b2) * 180 / Math.PI, 1e-4), "3: 회전각 독립 일치(가운데 " + m.rotationDeg.center.toFixed(2) + "° · 뒤 누적 " + m.rotationDeg.backOuterTotal.toFixed(2) + "°)");
const pcs = m.rigid.pieces, keys = ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"], T = [OBi, MBi, CB, CF, MFi, OFi];
ok(keys.every(k => pcs[k].length > 10), "3: 원래 종이 6조각 보존(meta.rigid)");
// 강체: 각 조각의 소맷부리 두 끝 사이 거리 = Ⓐ 의 같은 구간 폭
ok(near(D(hp.backOuter, hp.backOuterIn), xb2 - XL, 1e-9) && near(D(hp.backMidOut, hp.backMidIn), xb1 - xb2, 1e-9) && near(D(hp.backCenterOut, hp.backCenterMid), X0 - xb1, 1e-9) && near(D(hp.frontOuterIn, hp.frontOuter), XR - xf2, 1e-9), "3: 강체(조각 밑단 폭 보존)");
ok(!selfX(ring(g)), "3: 단일 외곽 · 자기교차 없음");
const pieceRings = keys.map(k => pcs[k].concat([pcs[k][0]])), touch = [m.pivots.backOuter, m.pivots.backInner, m.pivots.sp, m.pivots.frontInner, m.pivots.frontOuter];
let overlap = false; for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let i = 1; i < pieceRings[a].length; i++) for (let j = 1; j < pieceRings[b].length; j++) {
  const p0 = pieceRings[a][i - 1], p1 = pieceRings[a][i], q0 = pieceRings[b][j - 1], q1 = pieceRings[b][j];
  if ([p0, p1, q0, q1].some(p => touch.some(t => D(p, t) < 1e-6))) continue; if (xseg(p0, p1, q0, q1)) overlap = true; }
ok(!overlap, "3: 원래 종이 조각끼리 겹침 없음(독립 검사)");

// (4) 소매산
const capF = cubsOf(seg(g, "cap")), prim = DS.capPrimitives(g), lens = splitLen(capF, X0);
ok(g.capSplit && g.capSplit.x === X0 && near(prim.splitPoint.x, X0, 1e-9), "4: 앞/뒤 분할 = 소매 중심선(capSplit)");
ok(Math.abs(prim.lengths.back - lens.back) < 5e-3 && Math.abs(prim.lengths.front - lens.front) < 5e-3 && Math.abs(m.capLengths.total - (lens.back + lens.front)) < 5e-3, "4: 소매산 길이 = 독립 적분(뒤 " + lens.back.toFixed(3) + " · 앞 " + lens.front.toFixed(3) + ")");
ok(Math.abs(m.capLengths.total - A20.meta.capLengths.total) < 0.1 && near(m.easeAfter.total, m.capLengths.total - m.armholeCm.back - m.armholeCm.front, 1e-9), "4: 소매산은 늘리지 않음(개더 아님) · 이세 = 실측 − AH " + m.easeAfter.total.toFixed(2));
ok(["Pb2", "Pb1", "SP", "Pf1", "Pf2"].every(k => m.redraw.ellChosenCm[k] >= 0.5 && m.redraw.ellChosenCm[k] <= 2) && m.redraw.preservedMaxCm < 1e-6 && /잠정/.test(m.redraw.status), "4: 꺾임 5곳 국소 재제도 · 구간 밖 보존");
const capAInfl = infl(capA, 0.01), capFInfl = infl(capF, 0.01), dents = m.redraw.concaveDents;
ok(capFInfl <= capAInfl + 2 * dents.length && J(dents) === J(["Pb1"]) && m.redraw.curvatureMin.Pb1 < -0.01, "4: 국소 S 는 기록된 오목 꺾임에서만 — 최종 변곡 " + capFInfl + " ≤ Ⓐ " + capAInfl + " + 2 × " + J(dents) + "(강체 회전의 귀결 · 처리 판단 대기)");
ok(["Pb2", "Pb1", "SP", "Pf1", "Pf2"].every(k => m.redraw.originalInflections[k] === 0), "4: 재제도 구간 안 S 는 원래 호보다 많지 않음(redrawKinks 규칙)");
let g1 = 0; for (let i = 1; i < capF.length; i++) { const a = der(capF[i - 1], 1), b = der(capF[i], 0); g1 = Math.max(g1, Math.atan2(Math.abs(a.x * b.y - a.y * b.x), a.x * b.x + a.y * b.y) * 180 / Math.PI); }
ok(g1 < 1e-6, "4: 소매산 이음 G1(꺾임 없음) " + g1.toExponential(1));

// (5) 소맷부리
const hemF = cubsOf(seg(g, "hem")), hemLen = polyLen(dense(hemF, 2000));
ok(Math.abs(hemLen - m.hem.lengthCm) < 1e-3 && near(m.hem.formulaHemCm, Wd * 1.7, 1e-9) && near(m.hem.diffFromFormulaCm, m.hem.lengthCm - Wd * 1.7, 1e-12), "5: 소맷부리 실측 " + hemLen.toFixed(2) + " · 산식 1.7W " + (Wd * 1.7).toFixed(2) + " · 편차 기록(보정 없음)");
ok(infl(hemF, 0.001) === 0 && m.hem.fair.maxCutCm < 0.5 && m.hem.fair.maxOutwardCm < 0.5, "5: 소맷부리 변곡 없음 · 약간 파임/덧댐(" + m.hem.fair.maxCutCm.toFixed(2) + " / " + m.hem.fair.maxOutwardCm.toFixed(2) + ")");
ok(near(m.centerLength.inputCm, 20) && m.centerLength.spreadCm !== 20 && Math.abs(m.centerLength.spreadCm - 20) < 0.5, "5: 입력 기장 20 vs 벌린 뒤 중심 길이 " + m.centerLength.spreadCm.toFixed(2) + " — 구분");

// (6) 입력·결정성·가드
[0, -0.5, NaN, "0.7"].forEach(v => { const x = SPm.draftSleeveP(A20, { flareRatio: v }); ok(!x.ok && x.reason === "invalid-flare-ratio" && (Number.isNaN(v) ? Number.isNaN(x.detail) : x.detail === v), "6: 무효 계수 " + String(v) + " → 사유 · 원문 그대로"); });
const big = SPm.draftSleeveP(A20, { flareRatio: 1 });
ok(!big.ok && big.reason === "rotation-too-large" && big.numericGuard === true && big.detail.kind === "numeric-guard", "6: 계수 1(기장 20) → 회전 45° 수치 가드(물리 불가 판정 아님)");
const Af = deepFreeze(JSON.parse(J(A20))), r2 = SPm.draftSleeveP(Af, {});
ok(r2.ok && J(r2) === J(r), "6: 결정성 · 동결된 Ⓐ 그대로");

// (7) sweep — 기장 × 계수 × 몸판(A · Ⓖ)
let swOk = 0, swGuard = 0, swBad = [];
for (const body of ["A", "G"]) { const B = bodiceOf(body);
  for (const SL of [15, 18, 20, 25, 30, 40]) { const As = SA.draftSleeveA(B, { sleeveLengthCm: SL });
    for (const k of [0.2, 0.4, 0.5, 0.7, 0.9, 1.2]) {
      const x = SPm.draftSleeveP(As, { flareRatio: k });
      if (!x.ok) { if (x.reason === "rotation-too-large" && x.numericGuard) swGuard++; else if (!["redraw-inflection-unavoidable", "cap-top-concave", "pieces-overlap", "hem-fair-inflection"].includes(x.reason)) swBad.push([body, SL, k, x.reason]); continue; }
      const xm = x.meta, oo = xm.flare.openedCm, uu = As.meta.bicepCm * k / 10;
      const good = [oo.backOuter, oo.backInner, oo.center, oo.frontInner, oo.frontOuter].every((v, i) => near(v, [1, 2, 4, 2, 1][i] * uu, 1e-9)) && !selfX(ring(x.geometry))
        && infl(cubsOf(seg(x.geometry, "hem")), 0.001) === 0 && infl(cubsOf(seg(x.geometry, "cap")), 0.01) <= capAInfl + 2 * xm.redraw.concaveDents.length && Math.abs(xm.capLengths.total - xm.capLengthsA.total) < 0.2;
      if (good) swOk++; else swBad.push([body, SL, k, "invariant"]);
    } } }
ok(swBad.length === 0 && swOk > 30, "7: sweep 성공 " + swOk + " · 수치 가드 " + swGuard + " · 예상 밖 " + J(swBad).slice(0, 200));

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패:"); fails.forEach(f => console.log("  " + f)); }
console.log("designSleevePCheck: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
