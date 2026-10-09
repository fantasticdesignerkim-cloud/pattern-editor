// ══════════════════════════════════════════════
// designSleeveDCheck.js — js/designSleeveD.js(소매 Ⓓ 플레어, [패턴학교] P.42 — 2026-10-09 김님 확정) 전용 회귀.
//   (1) API·상수  (2) 강체 회전·벌림량(독립)  (3) 소맷부리 곡선(6 끝점 통과·G1·변곡·길이)  (4) 소매산 재제도·길이/이세 독립 실측  (5) 단일 외곽  (6) 결정성·불변  (7) 입력 sweep
//   node test/harness/designSleeveDCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveD.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SD = W.designSleeveD, DS = W.designSleeve;
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

// ── 1. API·상수 ──
{
  ok(typeof SD.draftSleeveD === "function" && Object.isFrozen(SD) && Object.isFrozen(SD.RULES), "1: API 동결");
  const R = SD.RULES;
  ok(R.flareRatio === 0.5 && R.cuts === 2, "1: 책 산식 — 플레어 = 소매폭×0.5 · 절개 2개");
  ok(R.redrawEllCm === 2 && R.redrawMinCm === 1 && R.redrawStepCm === 0.25 && R.redrawRatio === 0.4, "1: 소매산 재제도 잠정값(시작 2 · 최소 1 · 단계 0.25 · 40%)");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const Dd = SD.draftSleeveD(A, {});
ok(A.ok && Dd.ok, "기준: B83 SL52 성공");
const m = Dd.meta, g = Dd.geometry;
const cubsA = cubsOf(A.geometry.outline[0]), Ub = cubsA[0][0], Uf = cubsA[cubsA.length - 1][3], H = 52, Wd = Uf.x - Ub.x, xb = Ub.x / 2, xf = Uf.x / 2;
function capXcross(x) { for (const q of cubsA) if ((q[0].x - x) * (q[3].x - x) <= 0) { let lo = 0, hi = 1; for (let i = 0; i < 100; i++) { const md = (lo + hi) / 2; (cub(q, md).x < x) ? lo = md : hi = md; } return cub(q, (lo + hi) / 2); } return null; }
const Pb = capXcross(xb), Pf = capXcross(xf);

// ── 2. 강체 회전 · 벌림량 ──
{
  ok(near(m.flare.totalCm, Wd * 0.5) && near(m.flare.perCutCm, Wd * 0.25), "2: 플레어 ∅ = 소매폭×0.5 · 각 절개 ∅/2");
  ok(D(m.pivots.back, Pb) < 1e-8 && D(m.pivots.front, Pf) < 1e-8, "2: 기준점 = 반폭 중점 절개선 × 소매산(독립)");
  const hp = m.hemPoints;
  ok(near(D(hp.backInner, { x: xb, y: H }), Wd * 0.25, 1e-9) && near(D(hp.frontInner, { x: xf, y: H }), Wd * 0.25, 1e-9), "2: 각 절개 벌림(두 밑단 끝점 사이 거리) = ∅/2 (독립)");
  ok(near(D(Pb, hp.backInner), D(Pb, { x: xb, y: H }), 1e-9) && near(D(Pb, hp.backOuter), D(Pb, { x: Ub.x, y: H }), 1e-9) && near(D(Pb, m.underarm.after.back), D(Pb, Ub), 1e-9), "2: 뒤 옆 조각 강체(P_b 기준 거리 보존)");
  ok(near(D(Pf, hp.frontInner), D(Pf, { x: xf, y: H }), 1e-9) && near(D(Pf, hp.frontOuter), D(Pf, { x: Uf.x, y: H }), 1e-9) && near(D(Pf, m.underarm.after.front), D(Pf, Uf), 1e-9), "2: 앞 옆 조각 강체(P_f 기준 거리 보존)");
  ok(near(D(hp.backInner, hp.backOuter), -Ub.x / 2, 1e-9) && near(D(hp.frontInner, hp.frontOuter), Uf.x / 2, 1e-9), "2: 옆 조각 밑단 길이 불변(조각 자체 변형 없음)");
  ok(near(hp.centerBack.x, xb) && near(hp.centerFront.x, xf) && near(hp.centerBack.y, H) && near(hp.centerFront.y, H), "2: 중앙 조각 밑단 끝점 고정");
  ok(hp.backInner.x < xb && hp.frontInner.x > xf, "2: 벌림 방향 = 바깥");
  ok(Math.abs(m.flare.alternatives.arcCm.back - m.flare.perCutCm) < 0.05 && Math.abs(m.flare.alternatives.horizontalCm.back - m.flare.perCutCm) < 0.05, "2: 벌림 거리 정의(현/호/가로) 차 < 0.05cm — 결과를 좌우하지 않음");
  ok(near(m.seams.backCm, H - Ub.y, 1e-9) && near(m.seams.frontCm, H - Uf.y, 1e-9), "2: 옆선 길이 = Ⓐ 옆선(강체)");
}

// ── 3. 소맷부리 곡선 ──
{
  const hem = g.outline.find(s => s.role === "hem"), qs = cubsOf(hem), hp = m.hemPoints;
  const anchors = [qs[0][0]].concat(qs.map(q => q[3]));
  const want = [hp.frontOuter, hp.frontInner, hp.centerFront, hp.centerBack, hp.backInner, hp.backOuter];
  ok(anchors.length === 6 && anchors.every((p, i) => D(p, want[i]) < 1e-12), "3: 소맷부리 곡선이 각 조각 밑단 끝점 6점을 지난다");
  let g1 = 0; for (let i = 1; i < qs.length; i++) g1 = Math.max(g1, ang(der(qs[i - 1], 1), der(qs[i], 0)));
  ok(g1 < 1e-9, "3: 소맷부리 이음 G1(독립) " + g1.toExponential(1));
  const kap = (q, t) => { const a = der(q, t), u = 1 - t, b = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) }; return (a.x * b.y - a.y * b.x) / Math.pow(Math.hypot(a.x, a.y), 3); };
  const sg = new Set(); qs.forEach(q => { for (let i = 0; i <= 200; i++) { const k = kap(q, i / 200); if (Math.abs(k) > 0.01) sg.add(Math.sign(k)); } });
  ok(sg.size <= 1, "3: 소맷부리 곡선 변곡 없음(독립)");
  const len = denseLen(qs);
  ok(near(len, m.hemCm, 2e-5) && len > Wd + m.flare.totalCm - 0.5 && len < Wd + m.flare.totalCm + 0.5, "3: 소맷부리 길이 독립 실측 " + len.toFixed(4) + " (벌리기 전 " + Wd.toFixed(4) + " + ∅ " + m.flare.totalCm.toFixed(4) + ")");
  const mid = cub(qs[2], 0.5);
  ok(mid.y >= H - 1e-9, "3: 가운데(중앙 조각)는 처진 곡선 — 기준선보다 아래");
}

// ── 4. 소매산 재제도 · 길이/이세 독립 실측 ──
{
  const r = m.redraw;
  ok(r.joins.length === 4 && r.joins.every(j => j.gapCm < 1e-9 && j.g1Deg <= 1e-9), "4: 이음 4곳 끝점·해석적 G1");
  const cs = cubsOf(g.outline[0]); let worst = 0, gap = 0;
  for (let i = 1; i < cs.length; i++) { gap = Math.max(gap, D(cs[i - 1][3], cs[i][0])); worst = Math.max(worst, ang(der(cs[i - 1], 1), der(cs[i], 0))); }
  ok(gap < 1e-9 && worst < 1e-6, "4: 소매산 전체 접선 연속(독립) " + worst.toExponential(1) + "°");
  ok(r.kinkDegRaw.Pb > 5 && r.kinkDegRaw.Pf > 5 && near(r.kinkDegRaw.Pb, m.rotationDeg.back), "4: raw 꺾임 = 회전각(재제도 대상이 실제로 있음)");
  ok(m.checks.preservedMaxCm < 1e-9, "4: 구간 밖 곡선 보존");
  ok(r.ellChosenCm.Pb >= 1 && r.ellChosenCm.Pb <= 2 && r.ellChosenCm.Pf >= 1 && r.ellChosenCm.Pf <= 2, "4: 재제도 구간 ℓ 잠정 범위 1~2cm (Pb " + r.ellChosenCm.Pb + " · Pf " + r.ellChosenCm.Pf + ")");
  ok(r.concave.Pb === true && r.concave.Pf === true, "4: 바깥 회전 꺾임은 오목 — 다시 그린 구간 오목 호로 기록");
  const iSP = cs.findIndex(q => near(q[3].x, 0, 1e-9) && near(q[3].y, 0, 1e-9));
  const back = denseLen(cs.slice(0, iSP + 1)), tot = denseLen(cs);
  ok(iSP > 0 && near(back, m.capLengths.back, 2e-5) && near(tot - back, m.capLengths.front, 2e-5), "4: 소매산 길이 독립 실측 " + back.toFixed(4) + " / " + (tot - back).toFixed(4));
  ok(near(m.easeAfter.back, m.capLengths.back - A.meta.armholeCm.back, 1e-12) && near(m.easeAfter.front, m.capLengths.front - A.meta.armholeCm.front, 1e-12), "4: 이세 = 최종 곡선 실측 − AH");
  const prim = DS.capPrimitives(g);
  ok(prim && near(prim.lengths.back, m.capLengths.back, 1e-3) && near(prim.lengths.front, m.capLengths.front, 1e-3), "4: capPrimitives 가 role=cap 소매산을 SP 에서 나눔");
  ok(m.rigid && m.rigid.cap && m.rigid.cap.kind === "path" && m.rigid.hemPoints.length === 6, "4: raw 강체 결과는 meta.rigid(감사) — geometry 는 최종 곡선");
}

// ── 5. 단일 외곽 ──
{
  ok(g.outline.map(s => s.role).join() === "cap,side-seam-front,hem,side-seam-back", "5: outline 역할 순서");
  const ring = ringOf(g);
  ok(D(ring[0], ring[ring.length - 1]) < 1e-9 && !selfX(ring), "5: 닫힘 · 자기교차 없음(독립)");
  ok(selfX([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 0 }]), "5: 독립 검사기 자체 확인");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-axis-back,cut-axis-front,cut-edge-back,cut-edge-front", "5: construction(중심선·절개변)");
}

// ── 6. 결정성 · 불변 ──
{
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af);
  const d1 = SD.draftSleeveD(Af, {}), d2 = SD.draftSleeveD(Af, {});
  ok(d1.ok && J(d1) === J(d2) && J(Af) === before && d1.sourceSleeveAHash === Dd.sourceSleeveAHash, "6: 동결 입력 · 결정성 · Ⓐ 불변 · 출처 hash");
  ok(SD.draftSleeveD(null, {}).reason === "no-sleeve-a" && SD.draftSleeveD({ ok: true, geometry: {}, meta: {} }, {}).reason === "invalid-sleeve-a", "6: Ⓐ 없음/형식 오류");
}

// ── 7. 입력 sweep(몸판 프리셋 × 소매길이) ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { g1: 0, pres: 0, open: 0 }; const ells = {};
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 44, 48, 52, 56, 60, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      n++;
      const d = SD.draftSleeveD(a, {});
      if (!d.ok) { out[d.reason] = (out[d.reason] || 0) + 1; if (!d.outOfSupportedRange) bad.push(sym + SL + ":" + d.reason); continue; }
      okN++;
      const k = d.meta.checks; worst.g1 = Math.max(worst.g1, k.maxG1BreakDeg); worst.pres = Math.max(worst.pres, k.preservedMaxCm);
      worst.open = Math.max(worst.open, Math.abs(d.meta.flare.openedCm.back - d.meta.flare.perCutCm), Math.abs(d.meta.flare.openedCm.front - d.meta.flare.perCutCm));
      const e = d.meta.redraw.ellChosenCm.Pb + "/" + d.meta.redraw.ellChosenCm.Pf; ells[e] = (ells[e] || 0) + 1;
      if (selfX(ringOf(d.geometry))) bad.push(sym + SL + ":selfX");
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 지원 밖 " + J(out) + " · 최악 " + J(worst) + " · ℓ 분포 " + J(ells));
  ok(n >= 30 && okN === n, "7: sweep 전부 성공 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "7: 자기교차·표시 없는 실패 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.g1 <= 1e-9 && worst.pres <= 1e-9 && worst.open <= 1e-9, "7: sweep 불변식 " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
