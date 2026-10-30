// ══════════════════════════════════════════════
// sleeveUCheck.js — 소매 Ⓤ(P.51 «Ⓣ 와 같이 제도» · 소매산 높이 = 평균 어깨 길이 × 1/2, 화면 검토용 시안) 전용 회귀:
//   Ⓣ 결과 보존(hash · 기본값) · 카탈로그(보류 해제 · 같은 키) · 책 구성 기하(8 ⟂ 1.3 / 0.5 · ◉ × 1/2) · **독립 길이**(소매산 = 진동) ·
//   소맷부리(Ⓣ 방식) · SP 접속 · 옆 다트 · 원본 불변 · Ⓐ 게이트 · 해 없음/다중해 거부 · 스윕 · 완료본·입력/몸판 변경 무효화 · 표시 · 배선.
//   2026-10-30 소매산 재보완(Ⓣ·Ⓤ 같은 엔진): 모든 마디 곡률 연속(독립) · 승인 scratch 시안과 같은 형상 · 실측 차이 = 책 값 · SP 위 상승 관찰값 기록.
//   node test/harness/sleeveUCheck.js
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
  "designSleeveT.js", "sleeveTApply.js", "sleeveUApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  ST = W.designSleeveT, STA = W.sleeveTApply, SUA = W.sleeveUApply, SRA = W.sleeveRApply, SA = W.designSleeveA;
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

// ── 0. Ⓣ 결과 보존(Ⓤ 가 Ⓣ 를 바꾸지 않는다 — Ⓣ 완료본 hash · 기본값 · 수치) ──
//   기대값 변경 이력: 2026-10-29 Ⓤ 추가 때 51349f8f(폭 30.0557 · 소맷부리 21.6593 · ★ 0.6 / 0.5 · 0.8) →
//   2026-10-30 Ⓣ 소매산 재보완(김님 승인 범위 — 곡률 연속 한 곡선 · 앞뒤 동시 해 · ★ 도해 참고값 0.72 / 0.44 · 0.72)으로 49a4d2d0.
//   새 기준의 독립 근거 = sleeveTCheck 4·5(독립 길이 · 곡률 연속 · 승인 시안 주요치수). ◉ 12.7950 은 재보완과 무관해 그대로다.
{
  const P0 = projectWithBodice(A_ID); PROJECT = P0;
  const t = STA.apply(P0, { sleeveLengthCm: SL }), c = SC.complete(P0);
  ok(t.ok && c.ok && c.result.hash === "49a4d2d0" && c.result.origin.presetId === "bunka-sleeve-T", "0: Ⓣ 완료본 hash 보존(49a4d2d0 — 재보완 Ⓣ, Ⓤ 와 무관)");
  const tm = t.state.meta;
  ok(near(tm.widthCm, 31.1777, 1e-3) && near(tm.cuff.totalCm, 22.9181, 1e-3) && near(tm.capHeight.cm, 12.7950, 1e-3) && tm.rule.indexOf("p50") >= 0 && !tm.lineage, "0: Ⓣ 수치·규칙 보존(폭 31.18 · 소맷부리 22.92 · ◉ 12.80 · lineage 없음)");
  ok(J(ST.RULES.defaults) === J({ slopeRunCm: 8, backSlopeDropCm: 4, frontSlopeDropCm: 3.4, capHeightRatio: 0.75, sideDartDropCm: 3, capOutCm: 0.7, frontCapInCm: 0.5, cuffRatio: 0.75, backStar: 0.72, frontStar1: 0.44, frontStar2: 0.72 }), "0: Ⓣ 기본값(책 수치 무변경 · ★ = 도해 참고값 0.72 / 0.44 · 0.72)");
}

// ── 1. 카탈로그 ──
{
  const rec = SP.get("bunka-sleeve-U"), fam = SP.families().find(f => f.id === "shirt-sleeve"), vu = fam && fam.variants.find(x => x.id === "bunka-sleeve-U");
  ok(rec && rec.methodPage === 51 && rec.inputs[0].key === "sleeveLengthCm" && rec.inputs[0].defaultValue === undefined, "1: Ⓤ 레코드 · 소매길이 기본값 없음(공용 칸)");
  ok(J(rec.inputs.map(i => i.key)) === J(SP.get("bunka-sleeve-T").inputs.map(i => i.key)) && J(ST.KEYS) === J(rec.inputs.map(i => i.key)), "1: Ⓣ 와 같은 키 · 같은 순서");
  ok(J(rec.inputs.slice(1).map(i => [i.key, i.defaultValue])) === J(Object.entries(ST.RULES_U.defaults)), "1: 레코드 기본값 = 엔진 Ⓤ 기본값");
  const d = ST.RULES_U.defaults;
  ok(d.slopeRunCm === 8 && d.backSlopeDropCm === 1.3 && d.frontSlopeDropCm === 0.5 && d.capHeightRatio === 0.5 && d.capOutCm === 0.5 && d.frontCapInCm === 0.5 && d.cuffRatio === 0.75 && d.sideDartDropCm === 3, "1: 책 P.51 수치(8 ⟂ 1.3 / 0.5 · 1/2 · 0.5 / 0.5) + Ⓣ 승계(3 · 3/4)");
  ok(vu && vu.availability === "available" && vu.presetId === "bunka-sleeve-U" && SP.resolve("shirt-sleeve", "bunka-sleeve-U").ok && !vu.blockedBy, "1: Ⓤ 실행 가능(보류 해제)");
  const lg = ST.RULES_U.lineage;
  ok(lg && lg.book.length >= 4 && lg.inherited.some(s => /3\/4/.test(s)) && lg.convention.some(s => /SP/.test(s)), "1: 출처 구분(책 / Ⓣ 승계 / 시안 관례)");
}

// ── 2. 적용 · 원본 불변 · 소유권 ──
const Q = projectWithBodice(A_ID); PROJECT = Q;
const bodice = BC.latest(Q);
const bodice0 = J(bodice), ref0 = J(Q.referenceGeometry), front0 = J(Q.working.geometry.front), back0 = J(Q.working.geometry.back), bHash0 = bodice.hash;
const ap = SUA.apply(Q, { sleeveLengthCm: SL });
const S = Q.working.sleeveU, m = S && S.meta, g = Q.working.geometry.sleeve;
ok(ap.ok && S && S.presetId === "bunka-sleeve-U" && S.bodicePresetId === "bunka-bodice-A" && !Q.working.sleeveT && !Q.working.sleeveR && !Q.working.sleeveA, "2: 적용 · Ⓣ 등 다른 소매 상태를 만들지 않음");
ok(J(BC.latest(Q)) === bodice0 && BC.latest(Q).hash === bHash0 && J(Q.referenceGeometry) === ref0 && J(Q.working.geometry.front) === front0 && J(Q.working.geometry.back) === back0, "2: 원본 불변(bodiceResult · 원형 · 작업 앞뒤)");
ok(J(S.derivedBodice.back.outline) === J(bodice.back.outline), "2: 파생 뒤판 = 원본 그대로(뒤 어깨 다트 도해 유지)");
ok(S.parameters.sleeveLengthCm === SL && SUA.keys().every(k => typeof S.parameters[k] === "number") && S.parameters.capHeightRatio === 0.5, "2: 매개변수 = 실제로 쓴 값(Ⓤ 기본값)");
ok(m.rule.indexOf("p51") >= 0 && m.lineage && m.lineage.sameAs === "T" && m.unconfirmed.length === 4 && m.unconfirmed.some(t => /관찰/.test(t) && /SP/.test(t)), "2: 규칙 이름 · 출처 구분 · 미확인 4(SP 위 상승 관찰 포함)");

// ── 3. 책 구성 기하(몸판 좌표 · 독립 계측) ──
{
  const bSh = bodice.back.outline.find(s => s.boundary && s.boundary.root === "back/shoulder-armhole"), fSh = bodice.front.outline.find(s => s.edge === "shoulder");
  [["back", bSh, 1.3], ["front", fSh, 0.5]].forEach(([pc, sh, drop]) => {
    const h = m[pc], SPp = h.sp, other = D(sh.from, SPp) < 1e-3 ? sh.to : sh.from, us = unitv(sub(SPp, other));
    const K8 = h.slope.run, KA = h.slope.point;
    ok(near(D(SPp, K8), 8, 1e-9) && near(cr(us, sub(K8, SPp)), 0, 1e-9) && dot(us, sub(K8, SPp)) > 0, "3: " + pc + " 어깨선 연장 8");
    ok(near(D(K8, KA), drop, 1e-9) && near(dot(us, sub(KA, K8)), 0, 1e-9), "3: " + pc + " 8 에서 직각 " + drop + "(★ 경사)");
    const u = unitv(sub(h.E, SPp));
    ok(near(cr(u, sub(KA, SPp)), 0, 1e-9) && near(D(SPp, h.E), SL, 1e-9), "3: " + pc + " 중심선 = SP·경사점 연장 · 소매길이");
    ok(near(D(SPp, h.W0), m.capHeight.cm, 1e-9) && near(dot(u, sub(h.U, h.W0)), 0, 1e-9) && dot(sub(h.U, h.W0), sub({ x: pc === "back" ? 0 : 50, y: h.W0.y }, h.W0)) > 0, "3: " + pc + " 소매 아랫점 = 폭선 위 · 몸판 쪽 가지");
    ok(near(dot(u, sub(h.G, h.E)), 0, 1e-9) && near(D(h.G, h.E), h.widthCm, 1e-9), "3: " + pc + " 소맷부리선 ⟂ 중심선");
  });
  ok(m.back.slopeDeg < 10 && m.front.slopeDeg < 4 && m.back.slopeDeg < 26.5 && m.front.slopeDeg < 23, "3: 경사가 Ⓣ 보다 완만(뒤 " + m.back.slopeDeg.toFixed(2) + "° · 앞 " + m.front.slopeDeg.toFixed(2) + "°)");
  const rb = SA.readBodiceArmhole(bodice);
  ok(near(m.capHeight.cm, (rb.back.heightCm + rb.front.heightCm) / 2 * 0.5, 1e-12), "3: ◉ = 평균 어깨 길이(P.137 봉제 상태) × 1/2");
  ok(m.capHeight.cm > 8 && m.capHeight.cm < 9.2, "3: ◉ 범위(B83 ≈ 8.53)");
}

// ── 4. 독립 길이: 소매산 = 몸판 진동(이세 0) ──
{
  const capCs = cubsOf(role(g, "cap")), back = [], front = [];
  capCs.forEach(q => { (q[0].x + q[3].x) / 2 < 0 ? back.push(q) : front.push(q); });
  const capB = back.reduce((t, q) => t + plen(polyQ(q)), 0), capF = front.reduce((t, q) => t + plen(polyQ(q)), 0);
  const ahB = bodice.back.outline.filter(s => s.edge === "armhole").reduce((t, s) => t + segLen(s), 0);
  const ahF = bodice.front.outline.filter(s => s.edge === "armhole").reduce((t, s) => t + segLen(s), 0);
  ok(near(capB, ahB, 1e-4) && near(capF, ahF, 1e-4), "4: 소매산 = 몸판 진동(독립 점열 뒤 " + capB.toFixed(4) + "/" + ahB.toFixed(4) + " · 앞 " + capF.toFixed(4) + "/" + ahF.toFixed(4) + ")");
  ok(near(m.ease.total, 0, 1e-6), "4: 이세 0");
  ok(near(m.back.deviation.maxOutCm, 0.5, 0.05) && near(m.front.deviation.maxOutCm, 0.5, 0.05) && near(m.front.deviation.maxInCm, 0.5, 0.1), "4: 진동과 차이 실측 ≈ 0.5 / 0.5 / 0.5");
  // 재보완: 0.5 = 소매산이 진동에서 떨어진 실측 최대 차이(볼록 크기를 실측이 책 값이 되게 맞춤) — 표시 기준점 = 그 최대 위치
  m.back.keys.concat(m.front.keys).filter(k => k.kind === "bump").forEach(k => ok(near(D(k.pt, k.base), Math.abs(k.offsetCm), 1e-9) && near(Math.abs(k.offsetCm), 0.5, 1e-3), "4: 기준점 차이 = 실측 최대 0.5(" + k.offsetCm.toFixed(4) + ")"));
  // 승인한 scratch 재보완 시안(2026-10-30 — 그림 승인 · 제품 확정 아님)과 같은 형상: B83 · 소매길이 54 · 기본값
  ok(near(m.widthCm, 36.95793, 1e-4) && near(m.back.widthCm, 19.09902, 1e-4) && near(m.front.widthCm, 17.85891, 1e-4) && near(m.cuff.totalCm, 27.40842, 1e-4) && near(m.seams.underarm.back, 45.71998, 1e-4) &&
    near(m.back.U.x, 19.28877, 1e-4) && near(m.back.U.y, 22.88162, 1e-4) && near(m.front.U.x, 29.27181, 1e-4) && near(m.front.U.y, 20.10821, 1e-4),
    "4: 승인 시안과 같은 주요치수(폭 " + m.widthCm.toFixed(4) + " · 소맷부리 " + m.cuff.totalCm.toFixed(4) + " · 소매 아랫점)");
}

// ── 5. 소맷부리(Ⓣ 방식) · 밑선 · 한 장 소매 ──
{
  const cf = m.cuff, wB = m.back.widthCm, wF = m.front.widthCm;
  ok(near(cf.back, wB * 0.75, 1e-12) && near(wF - cf.front, cf.cutCm, 1e-12) && near(wB - cf.back, cf.cutCm, 1e-12), "5: 뒤 폭 × 3/4 · 앞 = 앞 폭 − ●");
  const uf = role(g, "underarm-front"), ub = role(g, "underarm-back"), hem = role(g, "hem");
  ok(near(hem.from.y, SL, 1e-9) && near(hem.to.y, SL, 1e-9), "5: 소맷부리 = 중심선 직각 직선");
  ok(near(D(uf.from, uf.to), D(ub.from, ub.to), 1e-9), "5: 소매 밑선 앞뒤 같은 길이(독립)");
  ok(wB + wF > m.capHeight.cm * 4 && wB + wF > 30.06, "5: 소매 폭이 Ⓣ(30.06)보다 넓다 — " + (wB + wF).toFixed(2));
  const L = sleeveLoop(g);
  ok(D(L[0], L[L.length - 1]) < 1e-9 && !selfX(L), "5: 한 장 소매 폐곡선 · 자기교차 없음(독립)");
  ok(spTangentOk(g) && Math.abs(m.joints.capAtSP) < 1e-9, "5: SP 매끄러운 접속(독립 접선 같은 직선 · 곡률 같음)");
  ok(near(spAngleDeg(g), -3.23, 0.05), "5: 관찰 — SP 접선과 폭선의 각 " + spAngleDeg(g).toFixed(2) + "°(B83 기본 기록값 −3.23 · 예전 강제값 0)");
  const cf2 = capFair(g);
  ok(cf2.ok && cf2.pieces >= 8, "5: 소매산 모든 마디 곡률 연속(독립 · 최대 곡률 차 " + cf2.worstK.toExponential(1) + ")");
  // 관찰(숨기지 않음): 앞쪽 소매산이 SP 보다 조금 높다 — P.51 도해의 0.5 차이가 SP 바로 아래라 낮은 소매산에서 생긴다. 값이 커지면 알 수 있게 범위로 감시한다.
  const topY = Math.min(...cubsOf(role(g, "cap")).flatMap(q => polyQ(q, 200).map(p => p.y)));
  ok(-topY > 0.05 && -topY < 0.2, "5: 관찰 — 소매산 꼭대기가 SP 위 " + (-topY).toFixed(3) + "(B83 기본 ≈ 0.13 · 기록값)");
}

// ── 6. 앞 AH 다트 → 옆 · 파생 앞판 ──
{
  const fd = m.frontDart, fo = S.derivedBodice.front.outline, legs = fo.filter(s => s.edge === "dart-leg");
  ok(legs.length === 2 && near(D(legs[0].from, legs[0].to), D(legs[1].from, legs[1].to), 1e-9) && near(fd.angleDeg, 18.25, 0.01) && fd.mouthResidualCm < 1e-9, "6: 옆 다트(강체 · 18.25° · 입구 잔차 0)");
  const cl = chainLoop(fo);
  ok(cl.gap < 1e-6 && !selfX(cl.pts), "6: 파생 앞판 폐곡선 · 자기교차 없음(독립)");
  ok(J(S.derivedBodice) === J(Q.working.sleeveU.derivedBodice) && ["neckline", "shoulder", "center", "hem"].every(e => J(fo.filter(s => s.edge === e)) === J(bodice.front.outline.filter(s => s.edge === e))), "6: 목둘레·어깨·중심·밑단 무변경");
}

// ── 7. 게이트 · 입력 거부 · 해 가지 ──
{
  const others = [];
  for (const f of BP.families()) for (const v of f.variants) if (v.presetId && v.presetId !== A_ID) others.push(v.presetId);
  let rej = 0, tried = 0;
  others.slice(0, 4).forEach(id => { const P2 = projectWithBodice(id); if (!P2) return; tried++; const r = SUA.draft(P2, { sleeveLengthCm: SL }); if (!r.ok && r.reason === "bodice-not-a") rej++; });
  ok(tried > 0 && rej === tried, "7: Ⓐ 아닌 몸판 거부(" + rej + "/" + tried + ")");
  PROJECT = Q;
  const U = (p) => SUA.draft(Q, Object.assign({ sleeveLengthCm: SL }, p));
  ok(SUA.draft(Q, {}).reason === "invalid-input" && U({ sleeveLengthCm: 8 }).reason === "sleeve-length-too-short" && U({ cuffRatio: 1.2 }).reason === "input-out-of-range", "7: 입력 거부(소매길이 없음 · ≤ ◉ · 범위)");
  // 해가 없거나(높은 소매산 + 완만한 경사) 여럿이면 거부 — 소매 아랫점을 억지로 정하지 않는다
  // 2026-10-30 재보완 후: 예전 다중해 입력(◉ 0.6 · 뒤 경사 0.5)은 해 0개가 됐고, ◉ 0.55–0.85 × 뒤 0.3–5 × 앞 0.2–3.4 (Ⓣ·Ⓤ 96개)에서 다중해 입력을 찾지 못했다.
  //   다중해 거부 경로(각 쪽 1차원 부호 변화 ≠ 1 → underarm-point-not-unique)는 엔진에 그대로 있고, 문구는 사유 객체로 확인한다.
  const nf = U({ capHeightRatio: 0.8 }), nf2 = U({ capHeightRatio: 0.6, backSlopeDropCm: 0.5 });
  ok(nf.reason === "underarm-point-not-found" && nf2.reason === "underarm-point-not-found" && nf.detail && nf.detail.roots === 0, "7: 해 없음 → 거부(clamp·선택 없음 · 예전 다중해 입력도 해 0개)");
  // 거부 동작은 엔진이 쓰는 순수 경계(designSleeveT.solver)로 0 / 1 / 복수해를 직접 판정한다(문구 확인만으로 대신하지 않는다).
  const SV = ST.solver, vd = (f) => SV.rootVerdict(SV.signChanges(f, 0, 12, 0.25));
  const r0 = vd(d => d + 2), r1 = vd(d => 5.3 - d), r2 = vd(d => Math.sin(d) - 0.1);
  ok(!r0.ok && r0.reason === "underarm-point-not-found" && r1.ok && r1.roots === 1 && !r2.ok && r2.reason === "underarm-point-not-unique" && r2.roots > 1, "7: 해 판정 경계 0 / 1 / 복수(" + r2.roots + ") → 없음 / 통과 / 거부");
  ok(SUA.failText({ reason: r2.reason }).indexOf("여럿") >= 0 && SUA.failText({ reason: "cap-offset-not-converged" }).indexOf("맞추지 못했습니다") >= 0, "7: 다중해 · 수렴 실패 사유 문구");
  const sm = U({ capOutCm: 0.05 });
  ok(sm.reason === "cap-offset-not-converged" && sm.detail.residualCm > 0.01, "7: 소매산 차이 0.05 → cap-offset-not-converged(맞출 수 없는 값을 통과시키지 않음)");
  const bad = SUA.apply(Q, { sleeveLengthCm: SL, capHeightRatio: 0.8 });
  ok(!bad.ok && Q.working.sleeveU.parameters.capHeightRatio === 0.5, "7: 거부된 적용은 이전 상태 유지");
}

// ── 8. 스윕(기본값 주변) ──
{
  let n = 0, good = 0; const bad = [];
  [0.4, 0.45, 0.5, 0.55].forEach(c2 => [0.8, 1.3, 2].forEach(bd => [0.2, 0.5, 1].forEach(fd => [44, 54, 60].forEach(sl => {
    n++; const r = SUA.draft(Q, { sleeveLengthCm: sl, capHeightRatio: c2, backSlopeDropCm: bd, frontSlopeDropCm: fd });
    if (r.ok && Math.abs(r.meta.ease.total) < 1e-6 && Math.abs(r.meta.seams.underarm.diffCm) < 1e-9 && !selfX(sleeveLoop(r.geometry)) && spTangentOk(r.geometry)) good++; else bad.push([c2, bd, fd, sl, r.reason]);
  }))));
  ok(good === n, "8: 스윕 " + good + "/" + n + " (◉ 비율 · 뒤/앞 경사 · 소매길이) " + J(bad.slice(0, 3)));
  let n2 = 0, g2 = 0;
  [[2, 0.5], [3, 1], [5, 0]].forEach(([sd, co]) => { n2++; const r = SUA.draft(Q, { sleeveLengthCm: SL, sideDartDropCm: sd, capOutCm: co }); if (r.ok && Math.abs(r.meta.ease.total) < 1e-6 && !selfX(sleeveLoop(r.geometry))) g2++; });
  ok(g2 === n2, "8: 옆 다트 · 소매산 차이 스윕 " + g2 + "/" + n2);
}

// ── 9. 완료본 · 무효화 · 배타 ──
{
  SUA.apply(Q, { sleeveLengthCm: SL });
  const c = SC.check(Q);
  ok(c.ok && Math.abs(c.ease.total) < 1e-3, "9: 체크 통과 · 공용 계측 이세 ≈ 0 (" + (c.ease ? c.ease.total.toFixed(5) : "-") + ")");
  const r = SC.complete(Q);
  ok(r.ok && r.result.origin.presetId === "bunka-sleeve-U" && r.result.origin.methodPage === 51 && r.result.origin.sameAsPresetId === "bunka-sleeve-T" && J(r.result.derivedBodice) === J(Q.working.sleeveU.derivedBodice), "9: 완료본(origin Ⓤ · 파생 몸판 소유)");
  ok(r.result.hash !== "51349f8f" && r.result.meta.lineage.sameAs === "T", "9: Ⓤ hash ≠ Ⓣ hash · 출처 구분 동봉");
  ok(BC.latest(Q).hash === bHash0 && J(BC.latest(Q)) === bodice0, "9: 완료 후에도 bodiceResult 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false, "9: 완료 직후 변경 없음");
  const keys = ["sleeveLengthCm", "capHeightRatio", "backSlopeDropCm", "frontSlopeDropCm", "capOutCm", "cuffRatio"], delta = { sleeveLengthCm: 2, capHeightRatio: 0.02, backSlopeDropCm: 0.2, frontSlopeDropCm: 0.2, capOutCm: 0.1, cuffRatio: -0.05 };
  let inv = 0;
  keys.forEach(k => { const p = Object.assign({}, S.parameters); p[k] += delta[k]; SUA.apply(Q, p); if (SC.isCurrentSleeveChanged(Q) === true) inv++; });
  ok(inv === keys.length, "9: 입력 변경 → 완료본 무효(" + inv + "/" + keys.length + ")");
  SUA.apply(Q, { sleeveLengthCm: SL });
  ok(SC.isCurrentSleeveChanged(Q) === false, "9: 같은 입력으로 되돌리면 같은 서명");
  Q.working.sleeveT = { presetId: "bunka-sleeve-T" };
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "9: Ⓣ 와 동시 활성 → 충돌");
  Q.working.sleeveT = null;
  const ex = J(Q.working.sleeveU.meta); Q.working.sleeveU.meta.cap.back += 1;
  ok(SC.check(Q).fails.indexOf("sleeve-u-geometry-mismatch") >= 0, "9: 상태 변조 → 재제도 불일치");
  Q.working.sleeveU.meta = JSON.parse(ex);
  Q.working.sleeveU.presetId = "bunka-sleeve-T";
  ok(SC.check(Q).fails.indexOf("sleeve-preset-unsupported") >= 0, "9: Ⓣ 로 위장한 Ⓤ 상태 거부");
  Q.working.sleeveU.presetId = "bunka-sleeve-U";
  SUA.reject(Q, { reason: "invalid-input", text: "x" });
  ok(SC.check(Q).fails.indexOf("sleeve-u-blocked") >= 0 && SUA.infoLines(Q).some(l => l.indexOf("차단") >= 0), "9: 차단 → 완료 불가 · 정보 줄");
  SUA.apply(Q, { sleeveLengthCm: SL });
  ok(SUA.rederive(Q).ok && SC.check(Q).ok, "9: 재제도");
  // 몸판 변경 → 출발 몸판 hash 불일치 · 재제도는 Ⓐ 게이트로 차단(다른 몸판으로 바꾸지 않음)
  const P3 = projectWithBodice(A_ID); PROJECT = P3;
  SUA.apply(P3, { sleeveLengthCm: SL }); SC.complete(P3);
  P3.working.parameters.body = Object.assign({}, P3.working.parameters.body, { hemExtensionBelowWaistCm: 25 });
  P3.working.geometry = DB.computeGeometry(P3.referenceGeometry, { body: P3.working.parameters.body });
  const rc = BC.complete(P3);
  ok(rc.ok && BC.latest(P3).hash !== bHash0 && !SC.check(P3).ok, "9: 몸판 재완료 → 소매 체크 실패(" + SC.check(P3).fails[0] + ")");
  const rd = SUA.rederive(P3);
  ok(!rd.ok && SUA.isBlocked(P3) && rd.reason === "bodice-not-a", "9: 몸판 변경 후 재제도 → Ⓐ 게이트 차단");
  PROJECT = Q;
}

// ── 10. 표시 ──
{
  const md = SAN.buildModel(Q);
  ok(md && md.line === "U" && md.title.indexOf("Ⓤ") >= 0 && md.lines.some(l => /책 P\.51/.test(l.text)), "10: 한 장 소매 표시(Ⓤ 제목 · 출처 구분 줄)");
  ok(["back", "front", "len", "cap-h", "width", "cuff-back", "cuff-front", "cut-back", "n-back", "n-front"].every(id => md.lines.some(l => l.id === id) || md.dims.some(d => d.id === id)), "10: 앞뒤 · 소매길이 · ◉ · 폭 · 소맷부리 · ● · 맞춤");
  const db = SAN.dolmanBodice(Q);
  ok(db && db.front && db.back.cut === Q.working.sleeveU.derivedBodice.back.outline && db.front.draft.length === 8, "10: 몸판 위 재단선 · 제도선 8");
  const ids = (pc) => db[pc].anno.lines.map(l => l.id);
  ok(["t1", "t2r", "t2d", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t9c", "t10"].every(id => ids("front").indexOf(id) >= 0) && ids("back").indexOf("t1") < 0, "10: 제도 순서 ①~⑩(앞) · 뒤 ②~⑩");
  ok(db.back.anno.lines.some(l => l.id === "t2d" && /1\.30 \(★ 경사\)/.test(l.text)) && db.front.anno.lines.some(l => l.id === "t2d" && /0\.50 \(★ 경사\)/.test(l.text)) && db.back.anno.lines.filter(l => /^star/.test(l.id)).every(l => l.text === "접점"), "10: ★ = 경사(책 기호) · 진동 접점은 «접점»");
  ok(SAN.dolmanExtents(Q).sleeveBelow === false, "10: 소매 배치 = Ⓣ 와 같은 자리");
  const info = SUA.infoLines(Q);
  ok(info.length >= 7 && info[0].indexOf("Ⓤ") >= 0 && info.some(l => l.indexOf("출처 구분") >= 0) && info.some(l => l.indexOf("책 0.5") >= 0), "10: 정보 줄(Ⓤ · 출처 구분 · 책 0.5)");
  ok(J(g) === J(Q.working.geometry.sleeve), "10: 표시가 geometry 를 바꾸지 않음");
}

// ── 11. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const ver = (f) => { const mm = html.match(new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)")); return mm ? mm[1] : null; };
  // 이력: Ⓤ 연결 때 6 파일 2026102911 → 2026-10-30 소매산 재보완으로 엔진·프리셋·표시 3 파일 2026103001
  ok(["ui.js", "sleeveCheckpoint.js"].every(f => ver(f) === "2026102911") && ["sleeveUApply.js", "designSleeveT.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026103001"), "11: 변경 파일 캐시 버전(Ⓤ 연결 2026102911 · 재보완 2026103001 — sleeveUApply 는 수렴 실패 사유 추가로 올림)");
  ok(html.indexOf("js/designSleeveT.js") < html.indexOf("js/sleeveUApply.js") && html.indexOf("js/sleeveUApply.js") < html.indexOf("js/ui.js"), "11: 스크립트 순서");
  const rec = SP.get("bunka-sleeve-U");
  ok(/id="rowSleeveU" hidden/.test(html) && rec.inputs.slice(1).every(i => new RegExp('id="inpSleeveU_' + i.key + '" type="number" step="[0-9.]+" value="' + String(i.defaultValue).replace(".", "\\.") + '"').test(html)), "11: Ⓤ 입력 칸 11개 = 레코드 기본값");
  ok(/function applySleeveU\(/.test(ui) && /keep !== "U" && window\.sleeveUApply/.test(ui) && /sleeveUOn\(project\)\) \{ window\.sleeveUApply\.rederive/.test(ui) && /\|\| sleeveUOn\(project\); \}/.test(ui) && /readSleeveTInputs\("U"\)/.test(ui) && /id === "bunka-sleeve-U" \? "Ⓤ"/.test(ui), "11: ui 연결(적용 · 배타 · 재제도 · 라인 켜짐 · 입력 · 기호)");
  ["designSleeveT.js", "sleeveUApply.js"].forEach(f => { const t = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); ok(!/localStorage|document\.|window\.addEventListener/.test(t), "11: " + f + " DOM·storage 미접근"); });
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
  ok(bad.length === 0 && db2.front.anno.keepOutCm.length === 2 && sm.keepOutCm.length === 2, "13: Ⓤ 설명 글자·리더선이 다른 피스(외곽 ∪ 몸판 제도 범위) 위에 없음 — 배율 6단계(" + [...new Set(bad)].slice(0, 3).join(" · ") + ")");
  // 피스끼리 설명 글자(설명 줄 포함)가 서로 겹치지 않음 — 공통 좌표(배치 offset 반영)에서 세 피스 글자 상자를 맞대 본다
  const cross = [];
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([k, m]) => { const LY = SAN.layout(m, s); Bx[k] = LY.items.map(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); return { t: it.text, b: { x0: b.x0 + LA[k].dx * s, x1: b.x1 + LA[k].dx * s, y0: b.y0 + LA[k].dy * s, y1: b.y1 + LA[k].dy * s } }; }); });
    const ks = ["back", "front", "sleeve"]; for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) Bx[ks[i]].forEach(a => Bx[ks[j]].forEach(b => { if (ov(a.b, b.b)) cross.push(s + " " + ks[i] + "«" + a.t.slice(0, 8) + "»×" + ks[j] + "«" + b.t.slice(0, 8) + "»"); }));
  });
  ok(cross.length === 0, "13: Ⓤ 피스끼리 설명 글자·설명 줄이 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
  ok(db2.front.anno.keepOutCm.every(b => b.side === "left" || b.side === "right") && db2.back.anno.keepOutCm.every(b => b.side === "right"), "13: 피스마다 가로 띠(간격 한가운데 경계) — 뒤 = 오른쪽만 · 앞 = 양쪽");
  Q.working.layout = undefined; const noL = SAN.dolmanBodice(Q);
  ok(!noL.front.anno.keepOutCm, "13: 배치 정보가 없으면 피할 자리 없음(이전 배치 규칙 그대로)");
  Q.working.layout = keepLayout;
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
