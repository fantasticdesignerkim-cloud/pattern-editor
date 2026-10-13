// ══════════════════════════════════════════════
// designSleeveJCheck.js — js/designSleeveJ.js(소매 Ⓙ 퍼프, [패턴학교] P.45 «소매 중심선에서 평행으로 잘라서 벌린다» — 2026-10-12 김님 승인 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값 (2) 산식 ●·■·∅ = 0.7● − ■ · 소맷부리 직선 1.7● (3) 평행 이동(독립 재구성 — 회전 없음 · 재제도 밖은 원래 소매산 그대로)
//   (4) 상승·국소 재제도(G1·꼭대기 수평·변곡 없음 · 상승과 개더 계수 독립) (5) 길이: Ⓐ 이세 + 추가 개더 = 최종 − AH (6) 외곽·자기교차·조각 겹침 (7) 입력·결정성 (8) sweep
//   node test/harness/designSleeveJCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveJ.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SJ = W.designSleeveJ, DS = W.designSleeve;
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
  ok(typeof SJ.draftSleeveJ === "function" && Object.isFrozen(SJ) && Object.isFrozen(SJ.RULES), "1: API 동결");
  ok(SJ.RULES.palmDefaultCm === 21 && SJ.RULES.cuffAddCm === 3 && SJ.RULES.cuffWidthCm === 1 && SJ.RULES.gatherRatio === 0.7 && SJ.RULES.riseDefaultCm === 0.7, "1: 손바닥 21 · 커프스 +3 · 폭 1 · 개더 계수 0.7 · 상승 0.7");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const R = SJ.draftSleeveJ(A, {});
ok(A.ok && R.ok, "기준: B83 SL52 기본 성공 " + (R.reason || ""));
const m = R.meta, g = R.geometry, W0 = A.meta.bicepCm, SPA = A.meta.sp, capA = cubsOf(A.geometry.outline[0]), HY = 52;
const kA = capA.findIndex(q => D(q[3], SPA) < 1e-9), half = m.formula.spread / 2;
const capJ = cubsOf(seg(g, "cap"));
// ── 2. 산식 ──
{
  const cuff = 24, sq = W0 - cuff, spread = 0.7 * cuff - sq;
  ok(Math.abs(m.formula.square - sq) < 1e-12 && Math.abs(m.formula.spread - spread) < 1e-12 && Math.abs(spread - (1.7 * cuff - W0)) < 1e-12 && m.cuff.lengthCm === 24 && m.cuff.widthCm === 1, "2: ● 24 · ■ = W − ● · ∅ = 0.7● − ■ = 1.7● − W = " + spread.toFixed(3));
  const hm = seg(g, "hem");
  ok(hm.kind === "line" && near(hm.from.y, HY) && near(hm.to.y, HY) && Math.abs(D(hm.from, hm.to) - 1.7 * cuff) < 1e-9 && Math.abs(m.hem.lengthCm - 40.8) < 1e-9, "2: 소맷부리 = 직선 1.7● " + D(hm.from, hm.to).toFixed(4));
  ok(Math.abs(m.hem.gatherCm - (40.8 - 24)) < 1e-9 && m.hem.straight === true, "2: 개더 = 소맷부리 − ● " + m.hem.gatherCm.toFixed(3));
}
// ── 3. 평행 이동(독립 재구성) ──
{
  const back = dense(capA.slice(0, kA + 1), 400).map(p => ({ x: p.x - half, y: p.y })), front = dense(capA.slice(kA + 1), 400).map(p => ({ x: p.x + half, y: p.y }));
  const dTo = (p, pl) => { let b = Infinity; for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], c = pl[i], vx = c.x - a.x, vy = c.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy))); b = Math.min(b, Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y)); } return b; };
  const fx = m.redraw.from.x, tx = m.redraw.to.x; let worst = 0, nOut = 0;
  dense(capJ, 60).forEach(p => { if (p.x < fx - 1e-9) { worst = Math.max(worst, dTo(p, back)); nOut++; } else if (p.x > tx + 1e-9) { worst = Math.max(worst, dTo(p, front)); nOut++; } });
  ok(nOut > 100 && worst < 2e-3, "3: 재제도 밖 소매산 = Ⓐ 평행 이동 그대로(회전 없음) 최대 " + worst.toExponential(2));
  const sb = seg(g, "side-seam-back"), sf = seg(g, "side-seam-front"), Ub = capA[0][0], Uf = capA[capA.length - 1][3];
  ok(near(sb.from.x, Ub.x - half) && near(sb.to.x, Ub.x - half) && near(sf.from.x, Uf.x + half) && near(sf.to.x, Uf.x + half) && near(sb.to.y, Ub.y) && near(sf.from.y, Uf.y), "3: 옆선 = Ⓐ 옆선 ±∅/2 수평 이동(수직 유지)");
  ok(Math.abs(m.widthAfterCm - (W0 + 2 * half)) < 1e-9, "3: 소매폭 = W + ∅ " + m.widthAfterCm.toFixed(3));
  const pb = m.rigid.pieces.back, pf = m.rigid.pieces.front;
  ok(Math.max(...pb.map(p => p.x)) <= SPA.x - half + 1e-9 && Math.min(...pf.map(p => p.x)) >= SPA.x + half - 1e-9, "6: 원래 종이 두 조각 겹침 없음(틈 ∅)");
  ok(near(m.rigid.gap[1].x - m.rigid.gap[0].x, 2 * half) && near(m.rigid.gap[0].x + half, SPA.x), "3: 틈 가운데 = 원래 중심선 x");
}
// ── 4. 상승·국소 재제도 ──
{
  const top = m.rise.top;
  ok(near(top.x, SPA.x) && near(top.y, SPA.y - 0.7), "4: 새 꼭대기 = 원래 중심선 x · 원래 높이 − 0.7");
  const ys = dense(capJ, 80).map(p => p.y); ok(Math.min(...ys) >= top.y - 1e-9, "4: 꼭대기가 소매산 최고점");
  const iT = capJ.findIndex(q => D(q[3], top) < 1e-9);
  ok(iT >= 0 && Math.abs(der(capJ[iT], 1).y) < 1e-9 && Math.abs(der(capJ[iT + 1], 0).y) < 1e-9, "4: 꼭대기 접선 수평");
  let g1 = 0; for (let i = 1; i < capJ.length; i++) g1 = Math.max(g1, ang(der(capJ[i - 1], 1), der(capJ[i], 0)));
  ok(g1 < 1e-6, "4: 소매산 G1 연속(최대 " + g1.toExponential(2) + "°)");
  const ks = []; [capJ[iT], capJ[iT + 1]].forEach(q => { for (let i = 0; i <= 200; i++) ks.push(kapI(q, i / 200)); });
  const sgn = ks.filter(k => Math.abs(k) > 1e-9).map(Math.sign); ok(sgn.every(s => s === sgn[0]), "4: 재제도 구간 변곡 없음");
  ok(m.redraw.ellCm >= 0 && m.redraw.ellCm <= 3, "4: 재제도 구간 양쪽 " + m.redraw.ellCm + "cm(국소)");
  const r0 = SJ.draftSleeveJ(A, { riseCm: 0 }), r15 = SJ.draftSleeveJ(A, { riseCm: 1.5 });
  ok(r0.ok && r15.ok && r0.meta.formula.spread === m.formula.spread && r15.meta.hem.lengthCm === m.hem.lengthCm && r15.meta.formula.gatherRatio === 0.7 && r0.meta.capLengths.total < m.capLengths.total && m.capLengths.total < r15.meta.capLengths.total,
    "4: 상승은 개더 계수·∅·소맷부리와 독립 · 상승↑ → 소매산↑ (0:" + r0.meta.capLengths.total.toFixed(3) + " 0.7:" + m.capLengths.total.toFixed(3) + " 1.5:" + r15.meta.capLengths.total.toFixed(3) + ")");
}
// ── 5. 길이 ──
{
  const iT = capJ.findIndex(q => D(q[3], m.rise.top) < 1e-9);
  const lb = denseLen(capJ.slice(0, iT + 1)), lf = denseLen(capJ.slice(iT + 1)), ab = denseLen(capA.slice(0, kA + 1)), af = denseLen(capA.slice(kA + 1));
  ok(Math.abs(lb - m.capLengths.back) < 1e-3 && Math.abs(lf - m.capLengths.front) < 1e-3, "5: 소매산 뒤 " + lb.toFixed(3) + " · 앞 " + lf.toFixed(3) + " = meta");
  ok(Math.abs(ab - m.capLengthsA.back) < 1e-3 && Math.abs(af - m.capLengthsA.front) < 1e-3, "5: Ⓐ 소매산 뒤 " + ab.toFixed(3) + " · 앞 " + af.toFixed(3));
  const AH = BA.armholeLengths;
  ok(Math.abs(m.easeA.total - (ab + af - AH.back - AH.front)) < 1e-3 && Math.abs(m.addedGather.total - (lb + lf - ab - af)) < 1e-3, "5: Ⓐ 이세 " + m.easeA.total.toFixed(3) + " · 추가 개더 " + m.addedGather.total.toFixed(3));
  ok(Math.abs(m.totalOverAH.total - (m.easeA.total + m.addedGather.total)) < 1e-9 && Math.abs(m.totalOverAH.total - (lb + lf - AH.back - AH.front)) < 1e-3, "5: 최종 − AH = Ⓐ 이세 + 추가 개더 " + m.totalOverAH.total.toFixed(3));
  const prim = DS.capPrimitives(g); ok(prim && D(prim.splitPoint, m.rise.top) < 1e-9 && Math.abs(prim.lengths.total - m.capLengths.total) < 5e-3, "5: capPrimitives 와 일치(분할 = 새 꼭대기 · 꺾은선 측정 차 " + (prim ? Math.abs(prim.lengths.total - m.capLengths.total).toExponential(1) : "") + ")");
}
// ── 6. 외곽 ──
{
  const r = ringI(g); ok(D(r[0], r[r.length - 1]) < 1e-9 && !selfX(r.slice(0, -1).concat([r[0]])), "6: 단일 폐곡선 · 자기교차 없음");
  ok(g.outline.map(s => s.role).join() === "cap,side-seam-front,hem,side-seam-back", "6: 외곽 = 소매산·앞 옆선·소맷부리·뒤 옆선");
  ok(m.fill.pts.length > 10 && m.originalCap.back.length > 2 && m.originalCap.front.length > 2, "6: 덧댐·원래 소매산 표시 자료");
}
// ── 7. 입력·결정성 ──
{
  const bad = [[{ palmCircumferenceCm: 0 }, "invalid-palm"], [{ palmCircumferenceCm: -1 }, "invalid-palm"], [{ palmCircumferenceCm: NaN }, "invalid-palm"], [{ palmCircumferenceCm: "21" }, "invalid-palm"],
    [{ riseCm: -0.1 }, "invalid-rise"], [{ riseCm: NaN }, "invalid-rise"], [{ riseCm: "0.7" }, "invalid-rise"], [{ palmCircumferenceCm: 10 }, "no-spread"]];
  bad.forEach(([p, why]) => { const r = SJ.draftSleeveJ(A, p); ok(!r.ok && r.reason === why, "7: 거부 " + J(p) + " → " + why + " (" + r.reason + ")"); });
  ok(SJ.draftSleeveJ(A, { palmCircumferenceCm: 10 }).outOfSupportedRange === true, "7: ∅ ≤ 0 = 지원 범위 밖 표시");
  ok(!SJ.draftSleeveJ(null, {}).ok, "7: Ⓐ 없음 거부");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SJ.draftSleeveJ(Af, {}), e2 = SJ.draftSleeveJ(Af, { palmCircumferenceCm: 21, riseCm: 0.7 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(R), "7: 동결 입력 · 결정성 · 기본값 21 / 0.7");
  ok(typeof R.sourceSleeveAHash === "string" && R.sourceSleeveAHash.length > 0, "7: 출발 Ⓐ hash");
}
// ── 8. sweep ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { ell: 0, g1: 0, hem: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      for (const palm of [18, 21, 24]) for (const rise of [0, 0.7, 1.5]) {
        n++;
        const r = SJ.draftSleeveJ(a, { palmCircumferenceCm: palm, riseCm: rise });
        if (!r.ok) { out[r.reason] = (out[r.reason] || 0) + 1; if (!r.outOfSupportedRange) bad.push(sym + SL + "/" + palm + "/" + rise + ":" + r.reason); continue; }
        okN++;
        const M = r.meta, cs = cubsOf(r.geometry.outline[0]);
        worst.ell = Math.max(worst.ell, M.redraw.ellCm);
        for (let i = 1; i < cs.length; i++) worst.g1 = Math.max(worst.g1, ang(der(cs[i - 1], 1), der(cs[i], 0)));
        worst.hem = Math.max(worst.hem, Math.abs(M.hem.lengthCm - 1.7 * (palm + 3)));
        if (selfX(ringI(r.geometry))) bad.push(sym + SL + "/" + palm + "/" + rise + ":selfX");
        if (Math.abs(M.totalOverAH.total - M.easeA.total - M.addedGather.total) > 1e-9) bad.push(sym + SL + ":identity");
      }
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 기하 가드 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 50 && okN === n, "8: sweep 전부 성립 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "8: 표시 없는 실패·자기교차 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.g1 < 1e-6 && worst.hem < 1e-9, "8: sweep 불변식(G1 · 소맷부리 = 1.7●) " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
