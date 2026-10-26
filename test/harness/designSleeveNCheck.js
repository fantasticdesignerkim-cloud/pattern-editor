// ══════════════════════════════════════════════
// designSleeveNCheck.js — js/designSleeveN.js(소매 Ⓝ 반소매 퍼프·소맷부리 턱, [패턴학교] P.47 — 2026-10-20 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값(소매길이 20 · 절개 2.5 · 가운데 4 · 양옆 2 · 박기 끝 1.5 — 책 기본 설정값) (2) 이동(독립 역변환): 가운데 SP 대칭 → 바깥(운반된 기준점) · 원래 종이 4조각 강체
//   (3) 턱 접기(독립 구현): 접은 조각 밑단 = Ⓐ 직선 · 겹은 접는 조각 아래(유효한 층 겹침 ≠ 평면 자기교차) · 접기 ↔ 펼치기 왕복
//   (4) 소맷부리 재단(펼침)·봉제(접음) 길이 독립 실측 · 참고 산식과 구분 · 중심선 앞/뒤 분할 (5) 박기 끝: 재단선 불변 · 다리보다 길면 막음
//   (6) 소매산: 꺾임 3곳 재제도 · capSplit = 중심선 · 이세 (7) 입력 원문 유지(clamp·대체 없음) · 결정성 · Ⓐ 불변 (8) sweep
//   node test/harness/designSleeveNCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveN.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SN = W.designSleeveN, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presets = () => { const o = []; for (const f of BP.families()) for (const v of f.variants) o.push([v.symbol, v.presetId]); return o; };
function bodiceResultOf(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// ── 독립 측정(모듈과 다른 구현) ──
const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function cubsOf(p) { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; }
const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const rot = (p, a, c) => { const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const ang = (u, v) => Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI;
const crossO = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((crossO(c, d, a) > 0) !== (crossO(c, d, b) > 0)) && ((crossO(a, b, c) > 0) !== (crossO(a, b, d) > 0));
function selfX(r) { const n = r.length; for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (xseg(r[i], r[i + 1], r[j], r[j + 1])) return true; } return false; }
const seg = (g, role) => g.outline.find(s => s.role === role);
const ring = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
const hemAnchors = (g) => { const cs = cubsOf(seg(g, "hem")); return [cs[0][0]].concat(cs.map(q => q[3])); };
// 독립 봉제 길이: 소맷부리 꼭짓점 열에서 턱 입구(construction tuck-crease ~ tuck-place 소맷부리 끝 사이)를 빼고 잰다
function sewnIndep(g) {
  const A = hemAnchors(g), idx = p => A.findIndex(a => D(a, p) < 1e-7), hidden = [];
  g.construction.filter(c => c.role === "tuck-crease").forEach(c => { const pl = g.construction.find(x => x.role === "tuck-place" && x.tuck === c.tuck); const a = idx(c.from), b = idx(pl.from); hidden.push([Math.min(a, b), Math.max(a, b)]); });
  let cut = 0, sewn = 0;
  for (let i = 1; i < A.length; i++) { const l = D(A[i - 1], A[i]); cut += l; if (!hidden.some(h => i - 1 >= h[0] && i <= h[1])) sewn += l; }
  return { cut, sewn, hiddenSpans: hidden };
}

const BA = bodiceResultOf(presets().find(p => p[0] === "A")[1]);
const A20 = SA.draftSleeveA(BA, { sleeveLengthCm: 20 });
const r = SN.draftSleeveN(A20, {});
const m = r.meta, g = r.geometry;
const sp = A20.meta.sp, H = A20.meta.sleeveLengthCm, Wd = A20.meta.bicepCm, X0 = sp.x;

// (1) API·기본값
ok(typeof SN.draftSleeveN === "function" && typeof SN.hemLengthsOf === "function" && Object.isFrozen(SN) && Object.isFrozen(SN.RULES), "1: API·RULES 동결");
ok(SN.RULES.sleeveLengthDefaultCm === 20 && SN.RULES.cutOffsetDefaultCm === 2.5 && SN.RULES.centerTuckDefaultCm === 4 && SN.RULES.sideTuckDefaultCm === 2 && SN.RULES.stitchEndDefaultCm === 1.5, "1: 책 기본 설정값 20 · 2.5 · 4 · 2 · 1.5");
ok(r.ok && m.settings.cutOffsetCm === 2.5 && m.settings.centerTuckCm === 4 && m.settings.sideTuckCm === 2 && m.settings.stitchEndCm === 1.5 && /산식·불변 규칙 아님/.test(m.settings.note), "1: 기본 적용 · 설정값(산식 아님) 표기");
ok(!("cuff" in m) && !("gather" in m) && !("rise" in m) && !("upperArmCm" in m.settings), "1: 커프스·개더·상승·위팔 입력 없음");

// (2) 이동 — 독립 역변환으로 원래 종이 4조각 강체 확인
const a = m.rotationDeg.center * Math.PI / 180, bB = m.rotationDeg.backOuterRelative * Math.PI / 180, bF = m.rotationDeg.frontOuterRelative * Math.PI / 180;
const hp = m.hemPoints, SPp = m.pivots.sp;
ok(near(D(hp.backCenterMid, hp.frontCenterMid), 4) && near(D(hp.backInner, hp.backCenterOuter), 2) && near(D(hp.frontInner, hp.frontCenterOuter), 2), "2: 벌림(현) 가운데 4 · 양옆 2");
ok(near(m.spread.cutX.back, X0 - 2.5) && near(m.spread.cutX.front, X0 + 2.5) && m.spread.cutX.center === X0, "2: 절개선 = 중심선 · 좌우 2.5");
const invCb = p => rot(p, -a, SPp), invCf = p => rot(p, a, SPp);
ok(near(invCb(hp.backCenterMid).x, X0, 1e-9) && near(invCb(hp.backCenterMid).y, H, 1e-9) && near(invCf(hp.frontCenterOuter).x, X0 + 2.5, 1e-9), "2: 가운데 두 조각 = SP 대칭 회전(역변환 → Ⓐ)");
const invBo = p => invCb(rot(p, -bB, m.pivots.back)), invFo = p => invCf(rot(p, bF, m.pivots.front));
ok(near(invBo(hp.backOuter).x, A20.geometry.outline[1].to.x, 1e-9) && near(invBo(hp.backOuter).y, H, 1e-9) && near(invFo(hp.frontOuter).y, H, 1e-9) && near(invFo(hp.frontInner).x, X0 + 2.5, 1e-9), "2: 바깥 조각 = 운반된 기준점 순차 회전(역변환 → Ⓐ)");
ok(D(invCb(m.pivots.back), m.pivots.backBefore) < 1e-9 && D(invCf(m.pivots.front), m.pivots.frontBefore) < 1e-9, "2: 바깥 기준점 = 가운데 조각과 함께 움직인 점");
const pcs = m.rigid.pieces;
ok(["backOuter", "backCenter", "frontCenter", "frontOuter"].every(k => Array.isArray(pcs[k]) && pcs[k].length > 10), "2: 원래 종이 4조각 보존(meta.rigid)");
const bcBack = pcs.backCenter.map(invCb);
ok(bcBack.every(p => p.x >= X0 - 2.5 - 1e-9 && p.x <= X0 + 1e-9), "2: 뒤 가운데 조각 역변환 = Ⓐ 띠 [X0−2.5, X0]");

// (3) 턱 접기 — 독립 구현
const A = hemAnchors(g);
ok(A.length === 13 && D(A[0], hp.frontOuter) < 1e-9 && D(A[12], hp.backOuter) < 1e-9 && D(A[6], { x: X0, y: H }) < 1e-9, "3: 소맷부리 꼭짓점 13 · 가운데 = Ⓐ 중심 밑단점");
// 조각 밑단 4개를 각자 역변환 → 모두 y = H, 이어 붙이면 [XL, XR] 한 줄
const XL = A20.geometry.outline[1].to.x, XR = A20.geometry.outline[2].to.x;
const pieceSegs = [[invFo, 0, 1], [invCf, 3, 4], [invCb, 8, 9], [invBo, 11, 12]].map(([f, i, j]) => [f(A[i]), f(A[j])]);
ok(pieceSegs.every(s => near(s[0].y, H, 1e-9) && near(s[1].y, H, 1e-9)), "3: 접은 조각 밑단 = Ⓐ 직선(y = H)");
const ivs = pieceSegs.map(s => [Math.min(s[0].x, s[1].x), Math.max(s[0].x, s[1].x)]).sort((p, q) => p[0] - q[0]);
ok(near(ivs[0][0], XL, 1e-9) && near(ivs[3][1], XR, 1e-9) && ivs.slice(1).every((v, i) => near(v[0], ivs[i][1], 1e-9)), "3: 접은 밑단이 빈틈·겹침 없이 한 줄");
const sewnFold = ivs.reduce((s, v) => s + v[1] - v[0], 0);
ok(near(sewnFold, Wd, 1e-9), "3: 접은(봉제) 길이 = Ⓐ 소매폭 W (독립 접기)");
// 겹: 첫 겹 = 접는 조각 역변환 후 절개선 거울 → Ⓐ 밑단 위, 접는 조각 쪽 구간(층 겹침 = 정상 접힘)
const refl = (c) => p => ({ x: 2 * c - p.x, y: p.y });
const L1 = [[p => refl(X0 + 2.5)(invFo(p)), 1, 2, [X0 + 2.5, XR]], [p => refl(X0)(invCf(p)), 4, 5, [X0, X0 + 2.5]], [p => refl(X0)(invCb(p)), 7, 8, [X0 - 2.5, X0]], [p => refl(X0 - 2.5)(invBo(p)), 10, 11, [XL, X0 - 2.5]]];
ok(L1.every(([f, i, j, rg]) => [A[i], A[j]].every(p => { const q = f(p); return near(q.y, H, 1e-9) && q.x >= rg[0] - 1e-9 && q.x <= rg[1] + 1e-9; })), "3: 첫 겹 = 접는 조각 아래(Ⓐ 밑단 위)");
ok(D(A[5], { x: X0 + m.tucks["center-front"].layerWidthCm, y: H }) < 1e-9 && D(A[7], { x: X0 - m.tucks["center-back"].layerWidthCm, y: H }) < 1e-9 && Math.abs(m.tucks["center-front"].layerWidthCm - 1) < 0.01, "3: 가운데 턱 둘째 겹 = 틈 가운데 천 제자리(중심선 양쪽 겹 폭 ≈ 1)");
ok(Object.values(m.tucks).every(t => t.direction === "중심 쪽") && /바깥 조각/.test(m.tucks["front-side"].crease) && /중심선/.test(m.tucks["center-back"].place), "3: 턱 방향 = 중심 쪽 · 양옆 접는 선 = 바깥 조각 변 · 가운데 = 중심선으로");
ok(m.folded.roundTripMaxCm < 1e-9 && m.folded.maxDevCm < 1e-9 && m.folded.layersOnHemMaxCm < 1e-9 && m.folded.tileGapCm < 1e-9, "3: 엔진 접기·왕복 검증값");
ok(!selfX(ring(g)), "3: 펼친 외곽 단일 연속 · 자기교차 없음(접힘 층 겹침은 평면 교차로 보지 않음)");
ok(m.folded.cutCm === 0 && m.folded.addedCm === 0 && /불필요/.test(m.folded.truing), "3: 접은 소맷부리 정리 = 없음(파임·덧댐 0) 명시");
const kinks = m.hem.kinkDeg.map((v, i) => [i + 1, v]).filter(k => k[1] > 1e-6).map(k => k[0]);
ok(J(kinks) === J([2, 5, 7, 10]), "3: 펼친 재단선 꺾임 = 접힘 중간선 4곳뿐(조각 밑단은 턱 안으로 그대로 이어짐)");

// (4) 길이 — 독립 실측
const si = sewnIndep(g), hl = SN.hemLengthsOf(g);
ok(near(si.cut, m.hem.cutCm, 1e-9) && near(si.sewn, m.hem.sewnCm, 1e-9) && near(hl.cut.total, si.cut, 1e-9), "4: 재단·봉제 길이 = 최종 geometry 독립 실측");
ok(near(si.sewn, Wd, 1e-9) && near(m.hem.sewnFoldedCm, Wd, 1e-9), "4: 봉제(턱 접음) = W (꼭짓점 실측 · 접기 실측 일치)");
ok(Math.abs(m.hem.cutCm - (Wd + 8)) < 0.05 && m.hem.formulaCutCm === Wd + 8 && m.hem.cutCm !== m.hem.formulaCutCm, "4: 참고 산식 W + 4 + 2 + 2 는 따로(실측과 구분)");
ok(near(hl.split.x, X0, 1e-12) && near(hl.cut.front, polyLen(A.slice(0, 7)), 1e-9) && near(hl.cut.back, polyLen(A.slice(6)), 1e-9), "4: 소맷부리 앞/뒤 분할 = 중심선");

// (5) 박기 끝
const r3 = SN.draftSleeveN(A20, { stitchEndCm: 3 });
ok(r3.ok && J(r3.geometry.outline) === J(g.outline) && J(r3.geometry.construction) !== J(g.construction), "5: 박기 끝 길이는 재단선 불변 · 표시선만 바뀜");
const se = g.construction.filter(c => c.role === "tuck-crease");
ok(se.length === 4 && se.every(c => near(D(c.from, c.to), 1.5, 1e-9)) && g.construction.filter(c => c.role === "tuck-stitch-end").length === 4, "5: 접는 선 다리 = 소맷부리에서 1.5 · 박기 끝선 4");
const rBig = SN.draftSleeveN(A20, { stitchEndCm: 25 });
ok(!rBig.ok && rBig.reason === "stitch-end-beyond-pivot" && rBig.detail.stitchEndCm === 25, "5: 박기 끝 > 다리 길이 → 막음(값 그대로 보고)");
ok(/책에 없는 박음 모양/.test(m.stitchEnd.seamShape) && /무관/.test(m.stitchEnd.effect), "5: 박음 모양 추측 없음 · 영향 명시");

// (6) 소매산
const prim = DS.capPrimitives(g);
ok(g.capSplit && g.capSplit.x === X0 && near(prim.splitPoint.x, X0, 1e-9), "6: capSplit = 중심선");
ok(Math.abs(prim.lengths.total - m.capLengths.total) < 5e-3 && Math.abs(m.capLengths.total - A20.meta.capLengths.total) < 0.05, "6: 공용 실측 ≈ 엔진(5e-3 — Ⓛ 와 같은 허용) · Ⓐ 와 거의 같음(재제도만)");
ok(near(m.easeAfter.total, m.capLengths.total - m.armholeCm.back - m.armholeCm.front, 1e-9), "6: 이세 = 소매산 − AH (개더 없음)");
ok(["Pb", "SP", "Pf"].every(k => m.redraw.ellChosenCm[k] > 0) && m.redraw.preservedMaxCm < 1e-6 && /잠정/.test(m.redraw.status), "6: 꺾임 3곳 국소 재제도 · 구간 밖 보존 · 잠정 표기");
ok(near(m.centerLength.inputCm, 20) && Math.abs(m.centerLength.spreadCm - 20) < 0.1, "6: 입력 소매길이 vs 벌린 뒤 중심 길이 따로");

// (7) 입력·결정성
[["cutOffsetCm", 0], ["cutOffsetCm", -1], ["centerTuckCm", 0], ["sideTuckCm", NaN], ["stitchEndCm", 0], ["centerTuckCm", "4"]].forEach(([k, v]) => {
  const x = SN.draftSleeveN(A20, { [k]: v });
  ok(!x.ok && /^invalid-/.test(x.reason) && (Number.isNaN(v) ? Number.isNaN(x.detail) : x.detail === v), "7: 무효 입력 " + k + "=" + String(v) + " → 사유 · 원문 그대로");
});
const rx = SN.draftSleeveN(A20, { cutOffsetCm: 1 });
ok(!rx.ok && rx.reason === "tuck-layer-exceeds-piece" && rx.outOfSupportedRange && !rx.numericGuard, "7: 겹이 조각 폭 초과 = 모델 범위 밖(수치 가드·물리 불가 아님)");
const rw = SN.draftSleeveN(A20, { cutOffsetCm: 30 });
ok(!rw.ok && rw.reason === "cut-outside-sleeve", "7: 절개 위치 > 반폭 → 막음");
const rc = SN.draftSleeveN(A20, { centerTuckCm: 8, sideTuckCm: 4 });
ok(!rc.ok && rc.reason === "cap-top-concave", "7: 큰 벌림 → 소매산 꼭대기 오목(기하)");
const Af = deepFreeze(JSON.parse(J(A20))), r2 = SN.draftSleeveN(Af, {});
ok(r2.ok && J(r2) === J(r) && r.sourceSleeveAHash === r2.sourceSleeveAHash, "7: 결정성 · 동결된 Ⓐ 그대로");

// (8) sweep
let swOk = 0, swBad = [];
for (const SL of [15, 20, 25, 30]) { const As = SA.draftSleeveA(BA, { sleeveLengthCm: SL });
  for (const off of [1.5, 2.5, 4, 6]) for (const tc of [2, 4, 6]) for (const ts of [1, 2, 3]) {
    const x = SN.draftSleeveN(As, { cutOffsetCm: off, centerTuckCm: tc, sideTuckCm: ts });
    if (!x.ok) { if (!["tuck-layer-exceeds-piece", "cap-top-concave", "redraw-inflection-unavoidable", "rotation-too-large", "pieces-overlap"].includes(x.reason)) swBad.push([SL, off, tc, ts, x.reason]); continue; }
    const s2 = sewnIndep(x.geometry);
    if (!(near(s2.sewn, As.meta.bicepCm, 1e-9) && near(s2.cut, x.meta.hem.cutCm, 1e-9) && !selfX(ring(x.geometry)) && x.meta.folded.roundTripMaxCm < 1e-9
      && Math.abs(D(x.meta.hemPoints.backCenterMid, x.meta.hemPoints.frontCenterMid) - tc) < 1e-9)) swBad.push([SL, off, tc, ts, "invariant"]);
    else swOk++;
  } }
ok(swBad.length === 0 && swOk > 100, "8: sweep " + swOk + " 성공 · 불변식 위반/예상 밖 실패 " + J(swBad).slice(0, 200));

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패:"); fails.forEach(f => console.log("  " + f)); }
console.log("designSleeveNCheck: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
