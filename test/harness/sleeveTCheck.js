// ══════════════════════════════════════════════
// sleeveTCheck.js — 소매 Ⓣ(P.50 셔츠 슬리브 «몸판에 직접 제도» · 제도 방법 P.140–141, 화면 검토용 시안) 전용 회귀:
//   카탈로그(Ⓤ 보류 사유) · 책 구성 기하(경사 8 ⟂ 4 / 3.4 · ◉ = 평균 어깨 길이 × 3/4 · 폭선·소맷부리선 직각) · **독립 길이**(소매산 = 몸판 진동) ·
//   소맷부리(뒤 폭 × 3/4 · 앞 = 폭 − ● · 밑선 앞뒤 같음) · 앞 AH 다트 → 옆 다트(강체 회전 · 입구 닫힘 · 다리 같은 길이) ·
//   폐곡선·자기교차 · 원본 불변 · 몸판 Ⓐ 게이트 · 입력 거부 · 스윕 · 완료본 소유·무효화 · 표시 · 배선.
//   2026-10-30 소매산 재보완(맞댄 한 장 전체 곡률 연속 곡선 · 앞뒤 소매 아랫점 동시 해): 모든 마디 곡률 연속(독립) · 승인한 scratch 시안과 같은 형상 · 실측 차이 = 책 값.
//   node test/harness/sleeveTCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js", "designSleeveQ.js", "sleeveQApply.js", "designSleeveR.js", "sleeveRApply.js", "designSleeveS.js", "sleeveSApply.js",
  "designSleeveT.js", "sleeveTApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  ST = W.designSleeveT, STA = W.sleeveTApply, SRA = W.sleeveRApply, SA = W.designSleeveA;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectWithBodice(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const A_ID = presetOf("A");
const SL = 54;

// ── 독립 계측 도구(엔진 코드 미사용) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }), dot = (a, b) => a.x * b.x + a.y * b.y, cr = (a, b) => a.x * b.y - a.y * b.x;
const unitv = (a) => { const l = Math.hypot(a.x, a.y); return { x: a.x / l, y: a.y / l }; };
const cub = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
const cubsOf = (s) => { if (s.kind === "line") return [[s.from, s.from, s.to, s.to]]; const o = []; let cur = null; s.commands.forEach(c => { if (c.type === "M") cur = c.points[0]; else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; } }); return o; };
const polyQ = (q, n = 4000) => { const a = []; for (let k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; };
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const segLen = (s) => cubsOf(s).reduce((t, q) => t + plen(polyQ(q)), 0);
const near = (a, b, t) => Math.abs(a - b) <= t;
const role = (g, r) => g.outline.find(s => s.role === r);
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d); return ((e1 > 0 && e2 < 0) || (e1 < 0 && e2 > 0)) && ((e3 > 0 && e4 < 0) || (e3 < 0 && e4 > 0)); };
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }
function sleeveLoop(g) { let L = []; cubsOf(role(g, "cap")).forEach((q, i) => { L = L.concat(polyQ(q, 60).slice(i ? 1 : 0)); }); L.push(role(g, "underarm-front").to); L.push(role(g, "hem").to); L.push(role(g, "underarm-back").to); return L; }
// SP 접속(독립 계측). 2026-10-30 소매산 재보완 전에는 «SP 접선 = 중심선 직각(tin.y = 0)»을 강제·검사했다(조각마다 따로 그려 맞대므로 꺾이지 않게 하는 조건).
//   재보완 후 소매산은 맞댄 한 장 전체가 곡률 연속 곡선 하나라 SP 방향은 곡선이 정한다 → 검사 의미 «SP 에서 꺾이지 않는다»는 그대로 두고
//   직각 대신 (1) 접선 같은 직선(G1) (2) 곡률 같음(G2)로 본다. SP 방향 자체는 관찰값(B83 기본 Ⓣ 2.8° · Ⓤ 3.2° · 앞뒤 경사가 크게 다르면 5° 를 넘는다)이라 spAngleDeg 로 따로 기록한다.
const capCurv = (q, end) => {   // cubic 끝점 곡률(제어점 공식 — 엔진 미사용)
  const a = end ? sub(q[3], q[2]) : sub(q[1], q[0]), b = end ? sub(q[2], q[1]) : sub(q[2], q[1]), l = Math.hypot(a.x, a.y);
  return (end ? 2 / 3 * cr(b, a) : 2 / 3 * cr(a, b)) / (l * l * l);
};
function spTangentOk(g) {
  const c = cubsOf(role(g, "cap")), i = c.findIndex(q => D(q[3], { x: 0, y: 0 }) < 1e-9);
  if (i < 0 || i + 1 >= c.length || D(c[i + 1][0], { x: 0, y: 0 }) > 1e-9) return false;
  const tin = unitv(sub(c[i][3], c[i][2])), tout = unitv(sub(c[i + 1][1], c[i + 1][0]));
  return Math.abs(cr(tin, tout)) < 1e-9 && dot(tin, tout) > 0 && tin.x > 0 && Math.abs(capCurv(c[i], true) - capCurv(c[i + 1], false)) < 1e-6;
}
function spAngleDeg(g) { const c = cubsOf(role(g, "cap")), i = c.findIndex(q => D(q[3], { x: 0, y: 0 }) < 1e-9), t = sub(c[i][3], c[i][2]); return Math.atan2(t.y, t.x) * 180 / Math.PI; }
function capFair(g) {   // 소매산 모든 마디: 접선 같은 직선 · 곡률 같음(조각을 이은 느낌의 원인이던 곡률 끊김이 없다) — 독립 계측
  const c = cubsOf(role(g, "cap")); let worstK = 0, worstT = 0;
  for (let i = 1; i < c.length; i++) {
    const a = unitv(sub(c[i - 1][3], c[i - 1][2])), b = unitv(sub(c[i][1], c[i][0]));
    worstT = Math.max(worstT, Math.abs(cr(a, b)) + (dot(a, b) > 0 ? 0 : 2)); worstK = Math.max(worstK, Math.abs(capCurv(c[i - 1], true) - capCurv(c[i], false)));
  }
  return { ok: worstT < 1e-9 && worstK < 1e-6, worstK, worstT, pieces: c.length };
}
function chainLoop(ol) {   // 외곽 조각을 끝점으로 이어 닫힌 점열(독립 구현)
  const left = ol.slice(1); let pts = polyQ(cubsOf(ol[0])[0], 30); cubsOf(ol[0]).slice(1).forEach(q => { pts = pts.concat(polyQ(q, 30).slice(1)); });
  let gap = 0;
  while (left.length) {
    const end = pts[pts.length - 1]; let bi = -1, bd = Infinity, rev = false;
    left.forEach((s, i) => { const c = cubsOf(s), a = c[0][0], b = c[c.length - 1][3]; if (D(a, end) < bd) { bd = D(a, end); bi = i; rev = false; } if (D(b, end) < bd) { bd = D(b, end); bi = i; rev = true; } });
    gap = Math.max(gap, bd); let c = cubsOf(left[bi]); if (rev) c = c.reverse().map(q => [q[3], q[2], q[1], q[0]]);
    c.forEach(q => { pts = pts.concat(polyQ(q, 30).slice(1)); }); left.splice(bi, 1);
  }
  return { pts, gap: Math.max(gap, D(pts[0], pts[pts.length - 1])) };
}

// ── 1. 카탈로그 ──
{
  const rec = SP.get("bunka-sleeve-T"), fam = SP.families().find(f => f.id === "shirt-sleeve");
  const vt = fam && fam.variants.find(x => x.id === "bunka-sleeve-T"), vu = fam && fam.variants.find(x => x.id === "bunka-sleeve-U");
  ok(rec && rec.methodPage === 50 && rec.inputs[0].key === "sleeveLengthCm" && rec.inputs[0].defaultValue === undefined, "1: Ⓣ 레코드 · 소매길이는 기본값 없음(공용 칸)");
  ok(J(rec.inputs.slice(1).map(i => [i.key, i.defaultValue])) === J(Object.entries(ST.RULES.defaults)), "1: 레코드 기본값 = 엔진 기본값(경사 8 · 4 / 3.4 · 3/4 · 옆 3 · 0.7 / 0.5 · 3/4 · ★)");
  const d = ST.RULES.defaults;
  ok(d.slopeRunCm === 8 && d.backSlopeDropCm === 4 && d.frontSlopeDropCm === 3.4 && d.capHeightRatio === 0.75 && d.capOutCm === 0.7 && d.frontCapInCm === 0.5 && d.cuffRatio === 0.75 && d.sideDartDropCm === 3, "1: 책 수치 설정값");
  ok(fam.availability === "available" && vt && vt.availability === "available" && vt.presetId === "bunka-sleeve-T" && SP.resolve("shirt-sleeve", "bunka-sleeve-T").ok, "1: 셔츠 계열 Ⓣ 실행 가능");
  ok(vu && vu.availability === "available" && vu.presetId === "bunka-sleeve-U" && !vu.blockedBy, "1: Ⓤ(P.51) 실행 가능 — 2026-10-29 보류 해제(전용 회귀 sleeveUCheck)");
}

// ── 2. 적용 · 원본 불변 · 소유권 ──
const Q = projectWithBodice(A_ID); PROJECT = Q;
const bodice = BC.latest(Q);
const bodice0 = J(bodice), ref0 = J(Q.referenceGeometry), front0 = J(Q.working.geometry.front), back0 = J(Q.working.geometry.back), bHash0 = bodice.hash;
const ap = STA.apply(Q, { sleeveLengthCm: SL });
const S = Q.working.sleeveT, m = S && S.meta, g = Q.working.geometry.sleeve;
ok(ap.ok && S && S.presetId === "bunka-sleeve-T" && S.bodicePresetId === "bunka-bodice-A" && !Q.working.sleeveR && !Q.working.sleeveS && !Q.working.sleeveA, "2: 적용 · 다른 소매 라인 상태를 만들지 않음");
ok(J(BC.latest(Q)) === bodice0 && BC.latest(Q).hash === bHash0 && J(Q.referenceGeometry) === ref0 && J(Q.working.geometry.front) === front0 && J(Q.working.geometry.back) === back0, "2: 원본 불변(bodiceResult · 원형 · 작업 앞뒤)");
ok(J(S.derivedBodice.back.outline) === J(bodice.back.outline), "2: 파생 뒤판 = 원본 뒤판 그대로(어깨 다트 열린 채)");
ok(S.parameters.sleeveLengthCm === SL && STA.keys().every(k => typeof S.parameters[k] === "number"), "2: 매개변수 = 실제로 쓴 값");

// ── 3. 책 구성 기하(몸판 좌표) ──
{
  const shSeg = (pc, root) => bodice[pc].outline.find(s => s.boundary && s.boundary.root === root);
  const bSh = shSeg("back", "back/shoulder-armhole"), fSh = bodice.front.outline.find(s => s.edge === "shoulder");
  [["back", bSh, 4], ["front", fSh, 3.4]].forEach(([pc, sh, drop]) => {
    const h = m[pc], SPp = h.sp, other = D(sh.from, SPp) < 1e-3 ? sh.to : sh.from, us = unitv(sub(SPp, other));
    const K8 = h.slope.run, KA = h.slope.point;
    ok(near(D(SPp, K8), 8, 1e-9) && near(cr(us, sub(K8, SPp)), 0, 1e-9) && dot(us, sub(K8, SPp)) > 0, "3: " + pc + " 어깨선 연장 8");
    ok(near(D(K8, KA), drop, 1e-9) && near(dot(us, sub(KA, K8)), 0, 1e-9), "3: " + pc + " 8 에서 직각 " + drop);
    const u = unitv(sub(h.E, SPp));
    ok(near(cr(u, sub(KA, SPp)), 0, 1e-9) && near(D(SPp, h.E), SL, 1e-9), "3: " + pc + " 중심선 = SP·경사점 연장 · 소매길이");
    ok(near(D(SPp, h.W0), m.capHeight.cm, 1e-9) && near(cr(u, sub(h.W0, SPp)), 0, 1e-9) && near(dot(u, sub(h.U, h.W0)), 0, 1e-9), "3: " + pc + " ◉ 위치 · 소매 아랫점은 소매 폭선(직각) 위");
    ok(near(dot(u, sub(h.G, h.E)), 0, 1e-9) && near(D(h.G, h.E), h.widthCm, 1e-9) && near(cr(u, sub(h.G, h.U)), 0, 1e-9), "3: " + pc + " 소맷부리선 ⟂ 중심선 · 소매 밑 안내선 ⟂ 폭선");
  });
  const rb = SA.readBodiceArmhole(bodice);
  ok(near(m.capHeight.cm, (rb.back.heightCm + rb.front.heightCm) / 2 * 0.75, 1e-12) && near(m.capHeight.ratio, 0.75, 0), "3: ◉ = 평균 어깨 길이(P.137 봉제 상태) × 3/4");
  ok(m.capHeight.cm > 12 && m.capHeight.cm < 14, "3: ◉ 범위(B83 ≈ 12.80)");
}

// ── 4. 독립 길이: 소매산 = 몸판 진동(여유분 줄임 없음) ──
{
  const capCs = cubsOf(role(g, "cap")), back = [], front = [];
  capCs.forEach(q => { (q[0].x + q[3].x) / 2 < 0 ? back.push(q) : front.push(q); });
  const capB = back.reduce((t, q) => t + plen(polyQ(q)), 0), capF = front.reduce((t, q) => t + plen(polyQ(q)), 0);
  const ahB = bodice.back.outline.filter(s => s.edge === "armhole").reduce((t, s) => t + segLen(s), 0);
  const ahF = bodice.front.outline.filter(s => s.edge === "armhole").reduce((t, s) => t + segLen(s), 0);
  ok(near(capB, ahB, 1e-4) && near(capF, ahF, 1e-4), "4: 소매산 길이 = 몸판 진동(독립 점열 뒤 " + capB.toFixed(4) + "/" + ahB.toFixed(4) + " · 앞 " + capF.toFixed(4) + "/" + ahF.toFixed(4) + ")");
  ok(near(m.ease.total, 0, 1e-6) && near(m.cap.back, m.armhole.back, 1e-6) && near(m.cap.front, m.armhole.front, 1e-6), "4: 이세 0(엔진 실측)");
  const dF = S.derivedBodice.front.outline.filter(s => s.edge === "armhole").reduce((t, s) => t + segLen(s), 0);
  ok(near(dF, ahF, 1e-4), "4: 파생 앞판 진동 길이 = 원본(회전 불변)");
  ok(near(m.back.deviation.maxOutCm, 0.7, 0.05) && near(m.front.deviation.maxOutCm, 0.7, 0.05) && near(m.front.deviation.maxInCm, 0.5, 0.1), "4: 진동과 차이 실측 ≈ 0.7 / 0.5");
  m.back.keys.concat(m.front.keys).filter(k => k.kind === "bump").forEach(k => ok(near(D(k.pt, k.base), Math.abs(k.offsetCm), 1e-9), "4: 기준점 차이 = 설정값 " + k.offsetCm));
  // 재보완: 0.7 / 0.5 = 소매산이 진동에서 떨어진 **실측 최대** 차이(기준점 한 곳에 놓는 값이 아님) — 볼록 크기를 실측이 책 값이 되게 맞춘다
  ok(near(m.back.deviation.maxOutCm, 0.7, 1e-3) && near(m.front.deviation.maxOutCm, 0.7, 1e-3) && near(m.front.deviation.maxInCm, 0.5, 1e-3) && m.back.deviation.maxInCm < 0.15,
    "4: 실측 최대 차이 = 책 값(뒤 " + m.back.deviation.maxOutCm.toFixed(4) + " · 앞 " + m.front.deviation.maxOutCm.toFixed(4) + " / " + m.front.deviation.maxInCm.toFixed(4) + " · 뒤 안쪽 " + m.back.deviation.maxInCm.toFixed(3) + ")");
  // 승인한 scratch 재보완 시안(2026-10-30 김님 화면 비교 «많이 좋아졌다» — 그림 승인 · 제품 확정 아님)과 같은 형상: B83 · 소매길이 54 · 기본값
  ok(near(m.widthCm, 31.17766, 1e-4) && near(m.back.widthCm, 16.51906, 1e-4) && near(m.front.widthCm, 14.65860, 1e-4) && near(m.cuff.totalCm, 22.91813, 1e-4) && near(m.seams.underarm.back, 41.41139, 1e-4) &&
    near(m.back.U.x, 17.96719, 1e-4) && near(m.back.U.y, 22.74377, 1e-4) && near(m.front.U.x, 30.58244, 1e-4) && near(m.front.U.y, 19.72882, 1e-4),
    "4: 승인 시안과 같은 주요치수(폭 " + m.widthCm.toFixed(4) + " · 소맷부리 " + m.cuff.totalCm.toFixed(4) + " · 소매 아랫점)");
}

// ── 5. 소맷부리 · 밑선 · 한 장 소매 ──
{
  const cf = m.cuff, wB = m.back.widthCm, wF = m.front.widthCm;
  ok(near(cf.back, wB * 0.75, 1e-12) && near(wB - cf.back, cf.cutCm, 1e-12) && near(wF - cf.front, cf.cutCm, 1e-12), "5: 뒤 = 뒤 폭 × 3/4 · 앞 = 앞 폭 − ●(같은 분량)");
  const uf = role(g, "underarm-front"), ub = role(g, "underarm-back"), hem = role(g, "hem");
  ok(near(hem.from.y, SL, 1e-9) && near(hem.to.y, SL, 1e-9) && near(hem.from.x, cf.front, 1e-9) && near(hem.to.x, -cf.back, 1e-9), "5: 소맷부리 = 중심선 직각 직선(y = 소매길이) · 뒤 −/앞 +");
  ok(near(D(uf.from, uf.to), D(ub.from, ub.to), 1e-9) && near(D(uf.from, uf.to), m.seams.underarm.front, 1e-9), "5: 소매 밑선 앞뒤 같은 길이(같은 분량을 자른 결과)");
  ok(near(uf.from.y, m.capHeight.cm, 1e-9) && near(ub.to.y, m.capHeight.cm, 1e-9) && near(uf.from.x, wF, 1e-9) && near(ub.to.x, -wB, 1e-9), "5: 소매 아랫점 = 폭선(y = ◉) 위 · 폭 실측");
  const L = sleeveLoop(g);
  ok(D(L[0], L[L.length - 1]) < 1e-9 && !selfX(L), "5: 한 장 소매 폐곡선 · 자기교차 없음(독립)");
  const c0 = cubsOf(role(g, "cap"));
  ok(c0.some(q => near(q[3].x, 0, 1e-9) && near(q[3].y, 0, 1e-9)) && (g.capSplit && g.capSplit.x === 0), "5: 앞뒤 중심선 x = 0 에서 맞댐(SP 마디)");
  ok(Math.abs(m.joints.capAtSP) < 1e-9, "5: SP 맞닿는 각 0(" + m.joints.capAtSP.toExponential(1) + "°)");
  ok(m.unconfirmed.every(t => !/BP/.test(t)) && m.unconfirmed.some(t => /★/.test(t) && /시안값/.test(t)), "5: 미확인 목록 — BP 제외(확정 제도점) · ★ = 수정 가능한 시안값");
  ok(spTangentOk(g), "5: SP 접속(독립) — 앞뒤 소매산이 SP 에서 꺾이지 않고(같은 직선) 곡률도 같다");
  ok(near(spAngleDeg(g), -2.77, 0.05), "5: 관찰 — SP 접선과 폭선의 각 " + spAngleDeg(g).toFixed(2) + "°(B83 기본 기록값 −2.77 · 예전 강제값 0)");
  const cf2 = capFair(g);
  ok(cf2.ok && cf2.pieces >= 8, "5: 소매산 모든 마디 곡률 연속(독립 · 마디 " + (cf2.pieces - 1) + " · 최대 곡률 차 " + cf2.worstK.toExponential(1) + ")");
  const cl = g.construction.find(c => c.role === "center-line");
  ok(cl && near(cl.to.y, SL, 1e-9) && g.construction.filter(c => c.role === "underarm-guide").length === 2 && g.construction.filter(c => c.role === "cuff-guide").length === 2, "5: 기준선(중심 · 폭선 · 안내선 · 소맷부리선)");
}

// ── 6. 앞 AH 다트 → 옆 다트(파생 앞판) ──
{
  const fd = m.frontDart, fo = S.derivedBodice.front.outline;
  const legs = fo.filter(s => s.edge === "dart-leg");
  ok(legs.length === 2 && legs.every(l => l.dart && l.dart.id === "front-side-dart") && near(D(legs[0].from, legs[0].to), D(legs[1].from, legs[1].to), 1e-9), "6: 옆 다트 다리 2개 · 같은 길이(강체 회전)");
  const lc = bodice.front.construction.filter(s => s.dart && s.dart.boundary === "armhole"), apex = lc[0].dart.apexAt === "from" ? lc[0].from : lc[0].to;
  ok(near(D(fd.apex, apex), 0, 1e-9) && near(fd.angleDeg, 18.25, 0.01) && fd.mouthResidualCm < 1e-9, "6: BP 축 · AH 다트 각 18.25° 닫힘(입구 잔차 0)");
  ok(near(D(fd.legs[1], fd.underarmBefore), 3, 1e-9) && near(fd.legs[1].x, fd.underarmBefore.x, 1e-9), "6: 옆 다트 위치 = 진동 아랫점 아래 3(옆선 위)");
  const side = fo.filter(s => s.edge === "side-seam"), top = side.find(s => near(D(s.from, fd.underarmAfter), 0, 1e-9));
  ok(top && near(D(top.from, top.to), 3, 1e-9), "6: 회전한 옆선 위 조각 길이 3 유지");
  const cl = chainLoop(fo);
  ok(cl.gap < 1e-6 && !selfX(cl.pts), "6: 파생 앞판 폐곡선 · 자기교차 없음(독립 · 열린 옆 다트 = 현재 외곽선)");
  const keep = ["neckline", "shoulder", "center", "hem"];
  ok(keep.every(e => J(fo.filter(s => s.edge === e)) === J(bodice.front.outline.filter(s => s.edge === e))), "6: 목둘레·어깨·중심·밑단 무변경(위쪽 고정)");
}

// ── 7. 몸판 Ⓐ 게이트 · 입력 거부 ──
{
  const others = [];
  for (const f of BP.families()) for (const v of f.variants) if (v.presetId && v.presetId !== A_ID) others.push(v.presetId);
  let rej = 0, tried = 0;
  others.slice(0, 6).forEach(id => { const P2 = projectWithBodice(id); if (!P2) return; tried++; const r = STA.draft(P2, { sleeveLengthCm: SL }); if (!r.ok && r.reason === "bodice-not-a") rej++; });
  ok(tried > 0 && rej === tried, "7: Ⓐ 아닌 몸판 거부(" + rej + "/" + tried + ")");
  PROJECT = Q;
  const T = (p) => STA.draft(Q, Object.assign({ sleeveLengthCm: SL }, p));
  ok(STA.draft(Q, {}).reason === "invalid-input", "7: 소매길이 없음 → invalid-input(기본값을 지어내지 않음)");
  ok(T({ sleeveLengthCm: 10 }).reason === "sleeve-length-too-short", "7: 소매길이 ≤ ◉ → 거부");
  ok(T({ frontStar1: 0.9 }).reason === "input-out-of-range" && T({ cuffRatio: 1.2 }).reason === "input-out-of-range" && T({ capOutCm: -1 }).reason === "input-out-of-range", "7: 범위 밖 → input-out-of-range(clamp 없음)");
  ok(T({ sideDartDropCm: 30 }).reason === "side-dart-out-of-range", "7: 옆 다트 위치 허리선 아래 → 거부");
  ok(T({ slopeRunCm: NaN }).reason === "invalid-input", "7: 숫자 아님 → 거부");
  const bad = STA.apply(Q, { sleeveLengthCm: 10 });
  ok(!bad.ok && Q.working.sleeveT && Q.working.sleeveT.parameters.sleeveLengthCm === SL, "7: 거부된 적용은 이전 상태 유지");
}

// ── 8. 스윕 ──
{
  let n = 0, good = 0; const bad = [];
  [40, 48, 54, 60].forEach(sl => [0.65, 0.75, 0.85].forEach(cr2 => [2, 3, 5].forEach(sd => {
    n++; const r = STA.draft(Q, { sleeveLengthCm: sl, capHeightRatio: cr2, sideDartDropCm: sd });
    if (r.ok && Math.abs(r.meta.ease.total) < 1e-6 && Math.abs(r.meta.seams.underarm.diffCm) < 1e-9 && !selfX(sleeveLoop(r.geometry)) && spTangentOk(r.geometry)) good++; else bad.push([sl, cr2, sd, r.reason]);
  })));
  ok(good === n, "8: 스윕 " + good + "/" + n + " (소매길이 · ◉ 비율 · 옆 다트) " + J(bad.slice(0, 3)));
  let n2 = 0, g2 = 0;
  [[0.5, 0.45, 0.75], [0.7, 0.55, 0.85], [0.6, 0.4, 0.7]].forEach(([b, f1, f2]) => { n2++; const r = STA.draft(Q, { sleeveLengthCm: SL, backStar: b, frontStar1: f1, frontStar2: f2 }); if (r.ok && Math.abs(r.meta.ease.total) < 1e-6 && !selfX(sleeveLoop(r.geometry)) && spTangentOk(r.geometry)) g2++; });
  ok(g2 === n2, "8: ★ 위치 스윕 " + g2 + "/" + n2);
}

// ── 9. 완료본 · 무효화 · 배타 ──
{
  STA.apply(Q, { sleeveLengthCm: SL });
  const c = SC.check(Q);
  ok(c.ok && Math.abs(c.ease.total) < 1e-3, "9: 체크 통과 · 공용 계측 이세 ≈ 0 (" + (c.ease ? c.ease.total.toFixed(5) : "-") + ")");
  const r = SC.complete(Q);
  ok(r.ok && r.result.origin.presetId === "bunka-sleeve-T" && r.result.origin.methodPage === 50 && J(r.result.derivedBodice) === J(Q.working.sleeveT.derivedBodice) && r.result.inputs.sleeveLengthCm === SL, "9: 완료본(origin Ⓣ · 파생 몸판 소유 · 입력)");
  ok(BC.latest(Q).hash === bHash0 && J(BC.latest(Q)) === bodice0, "9: 완료 후에도 bodiceResult 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false, "9: 완료 직후 변경 없음");
  STA.apply(Q, { sleeveLengthCm: SL + 2 });
  ok(SC.isCurrentSleeveChanged(Q) === true, "9: 입력 변경 → 완료본과 다름");
  Q.working.sleeveR = { presetId: "bunka-sleeve-R" };
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "9: 다른 소매 라인과 동시 활성 → 충돌");
  Q.working.sleeveR = null;
  const ex = J(Q.working.sleeveT.meta); Q.working.sleeveT.meta.cap.back += 1;
  ok(SC.check(Q).fails.indexOf("sleeve-t-geometry-mismatch") >= 0, "9: 상태 변조 → 재제도 불일치");
  Q.working.sleeveT.meta = JSON.parse(ex);
  STA.reject(Q, { reason: "invalid-input", text: "x" });
  ok(SC.check(Q).fails.indexOf("sleeve-t-blocked") >= 0 && STA.infoLines(Q).some(l => l.indexOf("차단") >= 0), "9: 차단 상태 → 완료 불가 · 정보 줄");
  STA.apply(Q, { sleeveLengthCm: SL });
  ok(STA.rederive(Q).ok && SC.check(Q).ok, "9: 재제도");
}

// ── 10. 표시 ──
{
  const md = SAN.buildModel(Q);
  ok(md && md.line === "T" && ["back", "front", "len", "cap-h", "width", "cuff-back", "cuff-front", "cut-back", "cut-front", "n-back", "n-front"].every(id => md.lines.some(l => l.id === id) || md.dims.some(d => d.id === id)), "10: 한 장 소매 표시(앞뒤 · 소매길이 · ◉ · 폭 · 소맷부리 · ● · 맞춤)");
  const db = SAN.dolmanBodice(Q);
  ok(db && db.back && db.front && db.back.cut === Q.working.sleeveT.derivedBodice.back.outline && db.front.draft.length === 8 && !db.back.shoulder, "10: 몸판 위 표시(재단선 · 제도선 8)");
  const ids = (pc) => db[pc].anno.lines.map(l => l.id);
  ok(["t1", "t1s", "t2r", "t2d", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t9c", "t10"].every(id => ids("front").indexOf(id) >= 0) && ids("back").indexOf("t1") < 0 && ids("back").indexOf("t9") >= 0, "10: 제도 공정 번호(앞 ①~⑩ · 뒤 ②~⑩)");
  ok(db.front.anno.marks.filter(k => k.cls === "notch").length >= 4 && db.back.anno.lines.some(l => l.text === "‖") && db.front.anno.lines.some(l => l.text === "|"), "10: ★ · 맞춤 ‖ | 표시");
  const ex = SAN.dolmanExtents(Q);
  ok(ex && ex.sleeveBelow === false && ex.back.maxX > Math.max(...bodice.back.outline.map(s => s.kind === "line" ? Math.max(s.from.x, s.to.x) : 0)), "10: 표시 범위(제도선 포함) · 소매는 기존 자리");
  const info = STA.infoLines(Q);
  ok(info.length >= 6 && info.some(l => l.indexOf("◉") >= 0) && info.some(l => l.indexOf("미확인") >= 0), "10: 정보 줄(◉ · 미확인 관례)");
  ok(J(g) === J(Q.working.geometry.sleeve), "10: 표시가 geometry 를 바꾸지 않음");
}

// ── 11. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const ver = (f) => { const mm = html.match(new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)")); return mm ? mm[1] : null; };
  // 이력: 2026102911 = Ⓤ 연결 · 2026103001 = 소매산 재보완(엔진 · ★ 기본값 · 표시 문구)
  ok(["ui.js", "sleeveCheckpoint.js"].every(f => ver(f) === "2026102911") && ["sleeveTApply.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026103001"), "11: 캐시 버전(Ⓤ 연결 2026102911 · 재보완으로 바뀐 적용 사유·프리셋·표시 2026103001 — sleeveTApply 는 2026102908 에서 올림)");
  ok(ver("designSleeveT.js") === "2026103001", "11: designSleeveT.js 캐시 버전 2026103001(소매산 재보완 — Ⓣ·Ⓤ 결과 의도적 변경)");
  ok(html.indexOf("js/sleeveSApply.js") < html.indexOf("js/designSleeveT.js") && html.indexOf("js/designSleeveT.js") < html.indexOf("js/sleeveTApply.js") && html.indexOf("js/sleeveTApply.js") < html.indexOf("js/ui.js"), "11: 스크립트 순서");
  const rec = SP.get("bunka-sleeve-T");
  ok(/id="rowSleeveT" hidden/.test(html) && rec.inputs.slice(1).every(i => new RegExp('id="inpSleeveT_' + i.key + '" type="number" step="[0-9.]+" value="' + String(i.defaultValue).replace(".", "\\.") + '"').test(html)), "11: 입력 칸 11개 = 레코드 기본값");
  ok(/function applySleeveT\(/.test(ui) && /keep !== "T" && window\.sleeveTApply/.test(ui) && /sleeveTOn\(project\)\) \{ window\.sleeveTApply\.rederive/.test(ui) && /\|\| sleeveTOn\(project\) \|\| sleeveUOn\(project\); \}/.test(ui) && /"inpSleeveLength" : "inpSleeveT_" \+/.test(ui), "11: ui 연결(적용 · 배타 · 재제도 · 라인 켜짐 · 공용 소매길이 칸)");
  ["designSleeveT.js", "sleeveTApply.js"].forEach(f => { const t = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); ok(!/localStorage|document\.|window\.addEventListener/.test(t), "11: " + f + " DOM·storage 미접근"); });
}

// ── 12. 해 찾기 순수 경계 · 수렴 실패(2026-10-30 Codex 검토 보완) ──
//   엔진이 쓰는 그 함수(designSleeveT.solver)를 가짜 함수로 직접 시험한다 — 실제 입력 스윕에서는 복수해 입력을 찾지 못했기 때문(한계는 sleeveUCheck 7 에 기록).
{
  const SV = ST.solver;
  const v = (f) => SV.rootVerdict(SV.signChanges(f, 0, 10, 0.25));
  const one = v(d => d - 3.1), none = v(d => d + 1), two = v(d => (d - 2.1) * (d - 6.1)), three = v(d => (d - 1.1) * (d - 4.1) * (d - 7.1)), nan = v(d => d > 5 ? NaN : d - 8);
  ok(one.ok && one.roots === 1 && one.interval[0] <= 3.1 && one.interval[1] >= 3.1, "12: 해 1개 → 통과(구간 " + J(one.interval) + ")");
  ok(!none.ok && none.reason === "underarm-point-not-found" && none.roots === 0, "12: 해 0개 → underarm-point-not-found");
  ok(!two.ok && two.reason === "underarm-point-not-unique" && two.roots === 2 && !three.ok && three.reason === "underarm-point-not-unique" && three.roots === 3, "12: 해 2 · 3개 → underarm-point-not-unique(골라 쓰지 않음)");
  ok(!nan.ok && nan.reason === "underarm-point-not-found" && nan.nonFiniteAt > 5, "12: 유한하지 않은 길이 → 해 판정 불가(거부)");
  // 크기 조정: 실측이 크기에 비례하면 수렴 · 실측이 크기와 무관하게 목표보다 크면(곡선이 이미 그만큼 떨어져 있음) 끝까지 못 맞춘다 → settled false
  let amp = 1; const conv = SV.settleAmplitudes(() => ({ pairs: [{ target: 0.7, measured: 0.9 * amp, scale: x => { amp *= x; } }] }), 12, 1e-4);
  const stuck = SV.settleAmplitudes(() => ({ pairs: [{ target: 0.05, measured: 0.21, scale: () => {} }] }), 12, 1e-4);
  const nf = SV.settleAmplitudes(() => ({ pairs: [{ target: 0.7, measured: NaN, scale: () => {} }] }), 12, 1e-4);
  const pass = SV.settleAmplitudes(() => ({ fail: "underarm-point-not-found", roots: 0 }), 12, 1e-4);
  ok(conv.settled && conv.residual <= 1e-4 && near(0.9 * amp, 0.7, 1e-4), "12: 크기 조정 수렴(실측 = 목표 " + (0.9 * amp).toFixed(5) + " · " + conv.iterations + "회)");
  ok(stuck.settled === false && stuck.iterations === 12 && near(stuck.residual, 0.16, 1e-9), "12: 크기 조정 수렴 실패 → settled false · 잔차 보고(성공으로 넘기지 않음)");
  ok(nf.fail === "cap-offset-not-converged" && nf.why === "non-finite" && pass.fail === "underarm-point-not-found", "12: 실측 유한하지 않음 → 실패 · 해 실패는 그대로 전달");
  // 실제 입력: 매끈한 소매산이 SP 모서리를 둥글리며 이미 0.2 남짓 떨어지므로, 그보다 작은 차이는 맞출 수 없다 → 이유를 달아 거부(이전엔 실측 0.21 을 0.05 라 하고 통과했다)
  PROJECT = Q;
  const before = J(Q.working.sleeveT.parameters), sm = STA.draft(Q, { sleeveLengthCm: SL, capOutCm: 0.05 });
  ok(!sm.ok && sm.reason === "cap-offset-not-converged" && sm.detail.iterations === 12 && sm.detail.residualCm > 0.1 && /맞추지 못했습니다/.test(sm.text), "12: 소매산 차이 0.05 → cap-offset-not-converged(잔차 " + (sm.detail ? sm.detail.residualCm.toFixed(3) : "?") + ")");
  const ap = STA.apply(Q, { sleeveLengthCm: SL, capOutCm: 0.05 });
  ok(!ap.ok && J(Q.working.sleeveT.parameters) === before, "12: 수렴 실패 적용은 거부 · 이전 상태 유지");
  const z = STA.draft(Q, { sleeveLengthCm: SL, capOutCm: 0 }), dflt = STA.draft(Q, { sleeveLengthCm: SL });
  ok(z.ok && dflt.ok && dflt.meta.capCurve.settled === true && dflt.meta.capCurve.iterations <= 12, "12: 차이 0 = 크기 조정 없음(통과 · 실측 " + (z.ok ? z.meta.back.deviation.maxOutCm.toFixed(2) : "?") + " 보고) · 기본값은 수렴(" + dflt.meta.capCurve.iterations + "회)");
}

// ── 13. 설명 글자·리더선이 다른 피스에 놓이지 않음(2026-10-30 보완 — 5b00d15 에도 있던 겹침: 글자는 화면 px 고정이라 작은 배율에서 이웃 피스로 넘쳤다) ──
//   배치 = designLayout.autoLayout(표시 범위 포함) · 화면 배율 1.5–9 px/cm(맞춤 화면 ~ 확대) · 상자 크기는 sleeveAnnotation 과 같은 글자 폭 규칙을 여기서 다시 계산.
{
  const DLY = W.designLayout, g0 = Q.working.geometry, ex0 = SAN.dolmanExtents(Q), LA = DLY.autoLayout(g0, ex0);
  const keepLayout = Q.working.layout; Q.working.layout = { back: LA.back, front: LA.front, sleeve: LA.sleeve, collar: { dx: 0, dy: 0 }, placement: { back: "auto", front: "auto", sleeve: "auto", collar: "auto" } };
  const FSZ = { title: 12, side: 13, note: 8.5 }, fz = c => FSZ[c] || 9;
  const box = (x, y, an, t, c) => { const f = fz(c); let w = 0; for (let i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1 : 0.58) * f; const x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85 - 1, y1: y + f * 0.2 + 1 }; };
  const ov = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  const ub = (a, b) => b ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) } : a;
  const ex = SAN.dolmanExtents(Q), area = k => k === "sleeve" ? DLY.outlineBBoxOf(g0, k) : ub(DLY.outlineBBoxOf(g0, k), ex[k]);
  const db2 = SAN.dolmanBodice(Q), sm = SAN.buildModel(Q, { pieces: true }), bad = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([pc, model]) => {
    const others = ["back", "front", "sleeve"].filter(k => k !== pc).map(k => { const b = area(k), dx = LA[k].dx - LA[pc].dx, dy = LA[k].dy - LA[pc].dy; return { k, x0: (b.minX + dx) * s, x1: (b.maxX + dx) * s, y0: (b.minY + dy) * s, y1: (b.maxY + dy) * s }; });
    const LY = SAN.layout(model, s);
    LY.items.forEach(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); others.forEach(o => { if (ov(b, o)) bad.push(s + " " + pc + "→" + o.k + " «" + it.text.slice(0, 12) + "»"); }); });
    LY.leaders.forEach(ld => { const ax = ld.at.x * s, ay = ld.at.y * s; for (let q = 0; q <= 24; q++) { const x = ax + ld.toPx.dx * q / 24, y = ay + ld.toPx.dy * q / 24; others.forEach(o => { if (x > o.x0 && x < o.x1 && y > o.y0 && y < o.y1) bad.push(s + " " + pc + " 리더→" + o.k); }); } });
  }));
  ok(bad.length === 0 && db2.front.anno.keepOutCm.length === 2 && sm.keepOutCm.length === 2, "13: Ⓣ 설명 글자·리더선이 다른 피스(외곽 ∪ 몸판 제도 범위) 위에 없음 — 배율 6단계(" + [...new Set(bad)].slice(0, 3).join(" · ") + ")");
  // 피스끼리 설명 글자(설명 줄 포함)가 서로 겹치지 않음 — 공통 좌표(배치 offset 반영)에서 세 피스 글자 상자를 맞대 본다
  const cross = [];
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([k, m]) => { const LY = SAN.layout(m, s); Bx[k] = LY.items.map(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); return { t: it.text, b: { x0: b.x0 + LA[k].dx * s, x1: b.x1 + LA[k].dx * s, y0: b.y0 + LA[k].dy * s, y1: b.y1 + LA[k].dy * s } }; }); });
    const ks = ["back", "front", "sleeve"]; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) Bx[ks[i]].forEach(a => Bx[ks[j]].forEach(b => { if (ov(a.b, b.b)) cross.push(s + " " + ks[i] + "«" + a.t.slice(0, 8) + "»×" + ks[j] + "«" + b.t.slice(0, 8) + "»"); }));
  });
  ok(cross.length === 0, "13: Ⓣ 피스끼리 설명 글자·설명 줄이 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
  ok(db2.front.anno.keepOutCm.every(b => b.side === "left" || b.side === "right") && db2.back.anno.keepOutCm.every(b => b.side === "right"), "13: 피스마다 가로 띠(간격 한가운데 경계) — 뒤 = 오른쪽만 · 앞 = 양쪽");
  Q.working.layout = undefined; const noL = SAN.dolmanBodice(Q);
  ok(!noL.front.anno.keepOutCm, "13: 배치 정보가 없으면 피할 자리 없음(이전 배치 규칙 그대로)");
  Q.working.layout = keepLayout;
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
