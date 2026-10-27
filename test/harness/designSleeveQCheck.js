// ══════════════════════════════════════════════
// designSleeveQCheck.js — js/designSleeveQ.js(소매 Ⓠ 캡 슬리브, [패턴학교] P.48 하단 — 2026-10-26 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값·범위(1/4 ~ 3/4 양 끝 포함 · 중간값 · 범위 밖/NaN/문자 거부 원문 보존) (2) 수평 교점(독립 계산 · 유일성)
//   (3) 원래 소매산 곡선 보존 · SP 유지 · 단일 외곽 (4) 길이 독립 실측(빠진 호 ●/∅ · 남은 소매산 앞뒤 · 구간 이세 = 남은 소매산 − 남은 AH)
//   (5) 출발 Ⓐ 기장 무관(형상·출처 hash) (6) 몸판 달림 끝(같은 호 길이 · 몸판 무변경 · 다트 너머는 보류) (7) sweep(몸판 × 비율)
//   node test/harness/designSleeveQCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveQ.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SQ = W.designSleeveQ, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const pick = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; };
function bodiceOf(sym) { PROJECT = MK(BP.bodyParams(pick(sym))); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function cubsOf(p) { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; }
const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const dTo = (p, pl) => { let b = Infinity; for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], c = pl[i], vx = c.x - a.x, vy = c.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1))); b = Math.min(b, Math.hypot(a.x + vx * t - p.x, a.y + vy * t - p.y)); } return b; };
const seg = (g, role) => g.outline.find(s => s.role === role);
// 독립: Ⓐ 소매산 조밀 점열에서 y = yh 교점(선형 보간) · 그 점까지의 호 길이
function indepCross(capCs, yh, X0) {
  const pts = dense(capCs, 4000), out = { back: [], front: [] }; let acc = 0, cum = [0];
  for (let i = 1; i < pts.length; i++) { acc += D(pts[i - 1], pts[i]); cum.push(acc); }
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1].y - yh, b = pts[i].y - yh; if ((a > 0) !== (b > 0)) { const t = a / (a - b), p = { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: yh }; (p.x < X0 ? out.back : out.front).push({ p, arc: cum[i - 1] + D(pts[i - 1], p) }); } }
  return { ...out, total: acc };
}

const BA = bodiceOf("A"), A30 = SA.draftSleeveA(BA, { sleeveLengthCm: 30 });
const r = SQ.draftSleeveQ(A30, {}), m = r.meta, g = r.geometry;
const capA = cubsOf(A30.geometry.outline[0]), sp = A30.meta.sp, X0 = sp.x, Ub = capA[0][0], H = Ub.y - sp.y;

// (1) API·기본값·범위
ok(typeof SQ.draftSleeveQ === "function" && typeof SQ.bodiceAttachEnds === "function" && Object.isFrozen(SQ) && SQ.RULES.heightRatioDefault === 0.25 && SQ.RULES.heightRatioMin === 0.25 && SQ.RULES.heightRatioMax === 0.75, "1: API · 기본 1/4 · 범위 1/4 ~ 3/4");
ok(r.ok && m.settings.heightRatio === 0.25 && m.settings.range.inclusive === true && !("cuff" in m) && !("sleeveLengthInput" in m), "1: 기본 적용 · 입력은 비율 하나");
[0.25, 0.3, 0.5, 0.65, 0.75].forEach(v => ok(SQ.draftSleeveQ(A30, { heightRatio: v }).ok, "1: 비율 " + v + " 허용(양 끝 포함 · 중간값)"));
[[0.2499, "height-ratio-out-of-range"], [0.7501, "height-ratio-out-of-range"], [1, "height-ratio-out-of-range"], [NaN, "invalid-height-ratio"], ["0.3", "invalid-height-ratio"], [Infinity, "invalid-height-ratio"]].forEach(([v, why]) => {
  const x = SQ.draftSleeveQ(A30, { heightRatio: v });
  ok(!x.ok && x.reason === why && (why === "height-ratio-out-of-range" ? x.detail.value === v : (Number.isNaN(v) ? Number.isNaN(x.detail) : x.detail === v)), "1: " + String(v) + " → " + why + "(원문 그대로 · clamp 없음)");
});

// (2) 수평 교점 — 독립 계산 · 유일성
const yh = Ub.y - H * 0.25, ic = indepCross(capA, yh, X0);
ok(ic.back.length === 1 && ic.front.length === 1, "2: 수평선이 소매산과 뒤·앞 각 한 점에서 만남(독립 유일성)");
ok(D(ic.back[0].p, m.hemPoints.back) < 1e-5 && D(ic.front[0].p, m.hemPoints.front) < 1e-5 && near(m.hemPoints.back.y, yh, 1e-9) && near(m.hemPoints.front.y, yh, 1e-9), "2: 교점 = 독립 계산 · y = 위팔선 − H × r");
ok(near(m.capHeightCm, H, 1e-12) && near(m.bicepY, Ub.y, 1e-12) && m.hem.horizontal === true, "2: H = 위팔선 − SP · 소맷부리 수평");

// (3) 원래 곡선 보존 · 단일 외곽
const capF = cubsOf(seg(g, "cap")), plA = dense(capA, 4000), fpts = dense(capF, 200);
ok(Math.max(...fpts.map(p => dTo(p, plA))) < 1e-6, "3: 남은 소매산 = 원래 Ⓐ 곡선 그대로(최대 편차 " + Math.max(...fpts.map(p => dTo(p, plA))).toExponential(1) + ")");
ok(Math.min(...fpts.map(p => p.y)) === Math.min(...plA.map(p => p.y)) || Math.abs(Math.min(...fpts.map(p => p.y)) - sp.y) < 1e-9, "3: SP 높이 유지");
ok(g.outline.length === 2 && g.outline[1].role === "hem" && g.outline[1].kind === "line" && D(g.outline[1].to, capF[0][0]) < 1e-12 && D(g.outline[1].from, capF[capF.length - 1][3]) < 1e-12, "3: 외곽 = 소매산 + 직선 소맷부리(옆선 없음) · 닫힘");
ok(r.meta.checks.selfIntersection === false && r.meta.checks.intersectionsUnique === true, "3: 자기교차 없음 · 교점 유일");

// (4) 길이 — 독립
const remB = ic.total - 0, splitArc = (() => { const pts = plA; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += D(pts[i - 1], pts[i]); if (pts[i].x >= X0) return acc; } })();
ok(Math.abs(m.excludedArcCm.back - ic.back[0].arc) < 1e-3 && Math.abs(m.excludedArcCm.front - (ic.total - ic.front[0].arc)) < 1e-3, "4: 빠진 호 ● " + m.excludedArcCm.back.toFixed(3) + " · ∅ " + m.excludedArcCm.front.toFixed(3) + " = 독립 적분");
ok(Math.abs(m.capLengths.back - (splitArc - ic.back[0].arc)) < 2e-3 && Math.abs(m.capLengths.front - (ic.front[0].arc - splitArc)) < 2e-3, "4: 남은 소매산 앞뒤 = 독립 적분(중심선 분할)");
const prim = DS.capPrimitives(g);
ok(Math.abs(prim.lengths.back - m.capLengths.back) < 2e-3 && Math.abs(prim.lengths.front - m.capLengths.front) < 2e-3 && near(prim.splitPoint.x, X0, 1e-9), "4: 공용 측정(capSplit) 일치");
const AH = m.armholeCm;
ok(near(m.sewnArmholeCm.back, AH.back - m.excludedArcCm.back, 1e-12) && near(m.easeAfter.back, m.capLengths.back - m.sewnArmholeCm.back, 1e-12) && near(m.easeAfter.front, m.capLengths.front - m.sewnArmholeCm.front, 1e-12), "4: 구간 이세 = 남은 소매산 − 남은 AH(앞뒤 각각)");
ok(Math.abs(m.easeAfter.back - (A30.meta.capLengths.back - AH.back)) < 2e-3 && Math.abs(m.easeAfter.front - (A30.meta.capLengths.front - AH.front)) < 2e-3, "4: 같은 호를 양쪽에서 빼므로 구간 이세 = Ⓐ 이세(앞뒤) — 전체 AH 이세와 혼동 없음");
ok(near(m.centerLength.spreadCm, H * 0.75, 1e-9) && near(m.hem.lengthCm, D(m.hemPoints.back, m.hemPoints.front), 1e-12) && m.centerLength.inputCm === null, "4: 중심 길이 = H × (1 − r) " + m.centerLength.spreadCm.toFixed(3) + " · 소맷부리 직선 실측");

// (5) 출발 Ⓐ 기장 무관
const inv = [15, 20, 52].map(L => SQ.draftSleeveQ(SA.draftSleeveA(BA, { sleeveLengthCm: L }), {}));
ok(inv.every(x => J(x) === J(r)), "5: 출발 Ⓐ 기장 15·20·52 → Ⓠ 형상·meta·출처 hash 동일");
const Af = deepFreeze(JSON.parse(J(A30)));
ok(J(SQ.draftSleeveQ(Af, {})) === J(r), "5: 결정성 · 동결된 Ⓐ 그대로");

// (6) 몸판 달림 끝
const BG = bodiceOf("G");
const walk = (segs, start, arc) => {   // 독립: 보관 진동을 아랫점에서 이어 걷기
  const polys = segs.map(sg => sg.kind === "line" ? [sg.from, sg.to] : (() => { const o = []; let cur = null; sg.commands.forEach(c => { if (c.type === "M") { cur = c.points[0]; o.push(cur); } else { const q = [cur, ...c.points]; for (let k = 1; k <= 200; k++) o.push(cub(q, k / 200)); cur = c.points[2]; } }); return o; })());
  const used = new Set(); let cur = start, acc = 0;
  for (;;) { let k = -1, rv = false; polys.forEach((p, i) => { if (used.has(i) || k >= 0) return; if (D(p[0], cur) < 1e-3) k = i; else if (D(p[p.length - 1], cur) < 1e-3) { k = i; rv = true; } });
    if (k < 0) return null; used.add(k); const pts = rv ? polys[k].slice().reverse() : polys[k];
    for (let i = 1; i < pts.length; i++) { const d = D(pts[i - 1], pts[i]); if (acc + d >= arc) { const t = (arc - acc) / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; } cur = pts[pts.length - 1]; } };
[["A", BA, 0.25], ["G", BG, 0.25], ["G", BG, 0.75]].forEach(([nm, B, rr]) => {
  const before = J(B), x = SQ.draftSleeveQ(SA.draftSleeveA(B, { sleeveLengthCm: 30 }), { heightRatio: rr }), at = SQ.bodiceAttachEnds(B, x.meta.excludedArcCm), rb = SA.readBodiceArmhole(B);
  const okSide = pc => at[pc].status === "ok" && D(at[pc].point, walk(B.armhole[pc], rb[pc].underarmStored, x.meta.excludedArcCm[pc])) < 0.02;
  ok(okSide("back") && okSide("front") && J(B) === before, "6: 몸판 " + nm + " · r " + rr + " — 달림 끝 = 진동 아랫점부터 같은 호(독립 걷기) · 몸판 무변경");
});
// 열린 앞 AH 다트 너머(2026-10-27 김님 승인): 다트를 닫은 봉제 진동선(Ⓐ 판독 armholeClosed — 독립 걷기)에서 같은 호 길이 점 = 표시 점의 닫힘 회전 상
const rbA = SA.readBodiceArmhole(BA), rotI = (p, c, a) => { const dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(a), sa = Math.sin(a); return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const closedWalk = (arc) => {   // armholeClosed 점열들을 진동 아랫점에서 이어 걷기(조각 끝 일치로 연결)
  const pls = rbA.front.armholeClosed.map(pl => pl.slice()), used = new Set(); let cur = rbA.front.underarm, acc = 0;
  for (;;) { let k = -1, rv = false; pls.forEach((pl, i) => { if (used.has(i) || k >= 0) return; if (D(pl[0], cur) < 1e-2) k = i; else if (D(pl[pl.length - 1], cur) < 1e-2) { k = i; rv = true; } });
    if (k < 0) return null; used.add(k); const pts = rv ? pls[k].reverse() : pls[k];
    for (let i = 1; i < pts.length; i++) { const d = D(pts[i - 1], pts[i]); if (acc + d >= arc) { const t = (arc - acc) / d; return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }; } acc += d; } cur = pts[pts.length - 1]; } };
[0.4, 0.5, 0.75].forEach(rr => {
  const xq = SQ.draftSleeveQ(A30, { heightRatio: rr }), at = SQ.bodiceAttachEnds(BA, xq.meta.excludedArcCm), f = at.front, cw = closedWalk(xq.meta.excludedArcCm.front);
  const onUpper = f.point && (() => { const up = BA.armhole.front.find(sg => sg.boundary && /armhole-upper$/.test(sg.boundary.root)); return up; })();
  ok(at.back.status === "ok" && f.status === "ok" && f.acrossClosedDart === true && f.closure.mouthResidualCm < 1e-9 && near(f.closure.angleDeg, rbA.front.closedDart.angleRad * 180 / Math.PI, 1e-12)
    && D(rotI(f.point, f.closure.apex, f.closure.angleDeg * Math.PI / 180), f.closedPoint) < 1e-9 && cw && D(f.closedPoint, cw) < 0.02 && f.closure.lowerArcCm < xq.meta.excludedArcCm.front,
    "6: 박시 A · r " + rr + " 앞 — 다트 닫은 봉제 진동 위 같은 호(독립 걷기 편차 " + (cw ? D(f.closedPoint, cw).toExponential(1) : "-") + ") · 표시 = 위쪽 조각으로 역회전 · 다트 입구 빈 공간/다리 미포함");
});
{ const x25 = SQ.draftSleeveQ(A30, { heightRatio: 0.25 }), a25 = SQ.bodiceAttachEnds(BA, x25.meta.excludedArcCm);
  ok(a25.front.status === "ok" && !a25.front.acrossClosedDart && !a25.front.closedPoint, "6: 박시 A · r 0.25 앞 — 다트 입구 전(아래 조각 위, 닫힘 변환 없음)"); }
{ const lowerLen = SQ.bodiceAttachEnds(BA, { back: 1, front: 1e9 }).front;   // 다트 입구 경계(아래 조각 끝) 확인용 — 전체 진동보다 긴 호는 보류
  ok(lowerLen.status === "beyond-continuous-armhole", "6: 봉제 진동 전체보다 긴 호 → 보류(허구 점 없음)"); }

// (7) sweep — 지원 몸판 × 비율 (2026-10-27: 원형 등가 복원으로 Ⓗ·Ⓜ·Ⓝ 추가 — 22종)
let swOk = 0, swBad = [], held = 0, sameMeasure = 0;
for (const sym of "ABCDEFGHIJKLMNOPQRSTUV".split("")) { const B = bodiceOf(sym); if (!B) { swBad.push([sym, "bodice"]); continue; } const As = SA.draftSleeveA(B, { sleeveLengthCm: 30 });
  for (const rr of [0.25, 0.3, 0.4, 0.5, 0.6, 0.65, 0.75]) {
    const x = SQ.draftSleeveQ(As, { heightRatio: rr });
    if (!x.ok) { swBad.push([sym, rr, x.reason]); continue; }
    const xm = x.meta, at = SQ.bodiceAttachEnds(B, xm.excludedArcCm);
    if (at.front.status !== "ok" || at.back.status !== "ok") held++;
    if (rr === 0.25 && "HMN".indexOf(sym) < 0) { const rb = SA.readBodiceArmhole(B); if (rb.front.armholeMeasure === B.armhole.front && rb.back.armholeMeasure === B.armhole.back && !rb.front.armholeForward && !rb.back.armholeForward && !at.front.restoreOwner && !at.back.restoreOwner) sameMeasure++; }
    const good = near(xm.centerLength.spreadCm, xm.capHeightCm * (1 - rr), 1e-9) && xm.hem.horizontal && near(xm.excludedArcCm.back + xm.excludedArcCm.front + xm.capLengths.total, As.meta.capLengths.total, 5e-3) && xm.checks.selfIntersection === false;
    if (good) swOk++; else swBad.push([sym, rr, "invariant"]);
  } }
ok(sameMeasure === 19, "7: 기존 19종은 측정 복사본 = 보관 진동 그대로(복원·역대응 없음 — 달림 끝 기존과 같음) " + sameMeasure);
ok(swBad.length === 0 && swOk === 22 * 7 && held === 0, "7: sweep 몸판 22 × 비율 7 = " + swOk + " 성공 · 달림 끝 표시 보류 " + held + "건(다트 너머 포함 전부 표시) · 예상 밖 " + J(swBad).slice(0, 160));

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패:"); fails.forEach(f => console.log("  " + f)); }
console.log("designSleeveQCheck: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
