// ══════════════════════════════════════════════
// designSleeveICheck.js — js/designSleeveI.js(소매 Ⓘ 퍼프, [패턴학교] P.44 하단 — 2026-10-12 김님 승인 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값 (2) 산식 ●·■·∅·∅/3 ↔ 실측 벌림(현) (3) 이동: 가운데 SP 대칭 · 바깥 = 움직인 기준점(독립 재구성) · 원래 종이 4조각 강체
//   (4) 소매산 꺾임 3곳 재제도·길이/이세 (5) 소맷부리 truing(양 끝·변곡 없음·곡률 연속·파임/덧댐 독립) (6) 외곽·자기교차 (7) 입력·결정성 (8) sweep
//   node test/harness/designSleeveICheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveI.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SI = W.designSleeveI, DS = W.designSleeve;
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
  ok(typeof SI.draftSleeveI === "function" && Object.isFrozen(SI) && Object.isFrozen(SI.RULES), "1: API 동결");
  ok(SI.RULES.palmDefaultCm === 21 && SI.RULES.cuffAddCm === 3 && SI.RULES.cuffWidthCm === 1 && SI.RULES.cuts === 3 && SI.RULES.redrawEllCm === 2 && SI.RULES.redrawMinCm === 0.5, "1: 손바닥 21 · 커프스 +3 · 폭 1 · 절개 3 · ℓ 2(잠정)");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const I = SI.draftSleeveI(A, {});
ok(A.ok && I.ok, "기준: B83 SL52 기본 성공 " + (I.reason || ""));
const m = I.meta, g = I.geometry, W0 = A.meta.bicepCm, SPA = A.meta.sp, capA = cubsOf(A.geometry.outline[0]);
// ── 2. 산식 ↔ 실측 ──
{
  const cuff = 24, sq = W0 - cuff, spread = cuff - sq, per = spread / 3, he = m.hemPoints;
  ok(Math.abs(m.formula.square - sq) < 1e-12 && Math.abs(m.formula.spread - spread) < 1e-12 && Math.abs(m.formula.perCut - per) < 1e-12 && m.cuff.lengthCm === 24 && m.cuff.widthCm === 1, "2: ● 24 · ■ = W − ● · ∅ = ● − ■ · ∅/3 = " + per.toFixed(3));
  const ob = D(he.backInner, he.backCenterOuter), oc = D(he.backCenterMid, he.frontCenterMid), of = D(he.frontCenterOuter, he.frontInner);
  ok([ob, oc, of].every(v => Math.abs(v - per) < 1e-9), "2: 실측 벌림(현) 뒤 " + ob.toFixed(4) + " · 가운데 " + oc.toFixed(4) + " · 앞 " + of.toFixed(4));
}
// ── 3. 이동(독립 재구성) ──
{
  const P = m.pivots, sp = P.sp, Cm = { x: SPA.x, y: 52 }, rotP = (p, c, a) => { const ca = Math.cos(a), sa = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y; return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
  ok(D(sp, SPA) < 1e-12, "3: 가운데 대칭 기준 = SP(원래 위치)");
  const al = m.rotationDeg.center * Math.PI / 180, cmB = rotP(Cm, sp, al), cmF = rotP(Cm, sp, -al);
  ok(D(cmB, m.hemPoints.backCenterMid) < 1e-9 && D(cmF, m.hemPoints.frontCenterMid) < 1e-9 && Math.abs((cmB.x + cmF.x) / 2 - SPA.x) < 1e-9, "3: 가운데 두 조각 = SP 중심 ±α 대칭(이등분선 = x = SP.x)");
  ok(D(rotP(P.backBefore, sp, al), P.back) < 1e-9 && D(rotP(P.frontBefore, sp, -al), P.front) < 1e-9, "3: 바깥 기준점 = 가운데 조각과 함께 움직인 절개선 × 소매산");
  // 원래 종이 4조각: 각 조각을 되돌리면 Ⓐ 와 같은 길이 변(강체)
  const pc = m.rigid.pieces;
  ok(["backOuter", "backCenter", "frontCenter", "frontOuter"].every(k => Array.isArray(pc[k]) && pc[k].length > 20), "3: 원래 종이 4조각 자료");
  const bc = pc.backCenter, lastTwo = bc.slice(-2);   // [.., Cm, Cb] 변환
  ok(Math.abs(D(lastTwo[0], lastTwo[1]) - Math.abs(SPA.x - A.geometry.outline[1].from.x / 2)) < 1e-9, "3: 조각 밑단 길이 보존(강체)");
  ok(D(pc.backOuter[0], m.underarm.after.back) < 1e-9 && D(pc.frontOuter[pc.frontOuter.length - 3], m.underarm.after.front) < 1e-9, "3: 바깥 조각 = 이동한 진동밑 포함");
}
// ── 4. 소매산 ──
{
  const prim = DS.capPrimitives(g), AH = A.meta.armholeCm;
  ok(D(prim.splitPoint, m.sp) < 1e-9 && Math.abs(prim.lengths.back - m.capLengths.back) < 1e-3 && Math.abs(prim.lengths.front - m.capLengths.front) < 1e-3, "4: 소매산 앞/뒤 = 최종 곡선 실측(capPrimitives 분할점 동일 · 측정법 차 < 1e-3)");
  ok(Math.abs(m.easeAfter.total - (prim.lengths.total - AH.back - AH.front)) < 1e-3, "4: 이세 = 실측 − AH " + m.easeAfter.total.toFixed(3) + "(Ⓐ " + A.meta.easeAfter.total.toFixed(3) + ")");
  ok(m.redraw.preservedMaxCm < 1e-9 && m.checks.maxG1BreakDeg < 1e-6 && ["Pb", "SP", "Pf"].every(k => m.redraw.ellChosenCm[k] >= 0.5 && m.redraw.ellChosenCm[k] <= 2), "4: 꺾임 3곳 국소 재제도(구간 밖 보존 · G1 · ℓ 0.5–2 잠정)");
}
// ── 5. 소맷부리 truing ──
{
  const hc = cubsOf(g.outline.find(s => s.role === "hem")), P8 = m.hem.points, F = m.hem.fair;
  ok(D(hc[0][0], P8[0]) < 1e-12 && D(hc[hc.length - 1][3], P8[7]) < 1e-12, "5: 양 끝 = 옆선 아래끝");
  let g1 = 0, kj = 0; for (let i = 1; i < hc.length; i++) { g1 = Math.max(g1, ang(der(hc[i - 1], 1), der(hc[i], 0))); kj = Math.max(kj, Math.abs(kapI(hc[i - 1], 1) - kapI(hc[i], 0))); }
  const ks = []; hc.forEach(q => { for (let k = 0; k <= 400; k++) ks.push(kapI(q, k / 400)); });
  ok(g1 < 1e-6 && kj < 1e-6 && (ks.every(k => k <= 1e-9) || ks.every(k => k >= -1e-9)), "5: 접선·곡률 연속 · 변곡 없음(독립)");
  const L = polyLen(dense(hc, 4000));
  ok(Math.abs(L - m.hem.lengthCm) < 1e-4 && Math.abs(m.hem.gatherCm - (m.hem.lengthCm - 24)) < 1e-12, "5: 최종 곡선 실측 " + L.toFixed(4) + " · 개더 " + m.hem.gatherCm.toFixed(4) + "(산식 2● 48 과 구분)");
  const yAt = x => { for (const q of hc) if ((q[0].x - x) * (q[3].x - x) <= 0) { let lo = 0, hi = 1; const inc = q[3].x > q[0].x; for (let k = 0; k < 80; k++) { const md = (lo + hi) / 2; if ((cub(q, md).x < x) === inc) lo = md; else hi = md; } return cub(q, (lo + hi) / 2).y; } };
  const dy = P8.slice(1, -1).map(p => yAt(p.x) - p.y);
  ok(Math.abs(Math.max(0, -Math.min(...dy)) - F.maxCutCm) < 1e-6 && Math.abs(Math.max(0, Math.max(...dy)) - F.maxOutwardCm) < 1e-6, "5: 파임 " + F.maxCutCm.toFixed(3) + " · 덧댐 " + F.maxOutwardCm.toFixed(3) + "(독립)");
}
// ── 6. 외곽 ──
{
  ok(!selfX(ringI(g)), "6: 자기교차 없음(독립)");
  ok(g.outline.map(s => s.role).join() === "cap,side-seam-front,hem,side-seam-back" && D(g.outline[0].commands[0].points[0], g.outline[3].to) < 1e-9, "6: 단일 연결 외곽");
}
// ── 7. 입력·결정성 ──
{
  ok(SI.draftSleeveI(A, { palmCircumferenceCm: 10 }).reason === "no-spread" && SI.draftSleeveI(A, { palmCircumferenceCm: -1 }).reason === "invalid-palm", "7: 가드(벌릴 분량 없음 · 입력)");
  const p25 = SI.draftSleeveI(A, { palmCircumferenceCm: 25 });
  ok(p25.ok && p25.meta.cuff.lengthCm === 28 && p25.meta.hem.lengthCm > m.hem.lengthCm, "7: 손바닥 변경 반영");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SI.draftSleeveI(Af, {}), e2 = SI.draftSleeveI(Af, { palmCircumferenceCm: 21 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(I), "7: 동결 입력 · 결정성 · 기본값 21");
}
// ── 8. sweep ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { open: 0, cut: 0, out: 0, inflect: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      for (const palm of [18, 21, 24]) {
        n++;
        const r = SI.draftSleeveI(a, { palmCircumferenceCm: palm });
        if (!r.ok) { out[r.reason] = (out[r.reason] || 0) + 1; if (!r.outOfSupportedRange) bad.push(sym + SL + "/" + palm + ":" + r.reason); continue; }
        okN++;
        const M = r.meta, h = M.hemPoints, per = M.formula.perCut;
        worst.open = Math.max(worst.open, Math.abs(D(h.backInner, h.backCenterOuter) - per), Math.abs(D(h.backCenterMid, h.frontCenterMid) - per), Math.abs(D(h.frontCenterOuter, h.frontInner) - per));
        worst.cut = Math.max(worst.cut, M.hem.fair.maxCutCm); worst.out = Math.max(worst.out, M.hem.fair.maxOutwardCm); worst.inflect += M.hem.fair.inflections;
        if (selfX(ringI(r.geometry))) bad.push(sym + SL + "/" + palm + ":selfX");
      }
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 기하 가드 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 50 && okN === n, "8: sweep 전부 성립 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "8: 표시 없는 실패·자기교차 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-9 && worst.inflect === 0, "8: sweep 불변식(벌림 = ∅/3 · 소맷부리 변곡 0) " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
