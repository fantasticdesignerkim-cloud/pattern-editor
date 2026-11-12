// ══════════════════════════════════════════════
// sleeveXCheck.js — 소매 Ⓧ 기모노 슬리브(P.54 · 제도 방법 P.144–145 · 닫는다·벌린다 P.161, 2026-11-04 시안) 전용 회귀:
//   카탈로그 · 승인 scratch 와 제품 비교(픽스처) · 뒤/앞 윗선·어깨 다트 닫은 봉제경로·밑선·목 다트 다리·덧천 4변 ↔ 몸판/소매 노치 4변(서로 다른 객체에서 따로 잼) ·
//   폐곡선 · 자기교차 · 원본 종이 보존(원래 진동 곡선·초승달 종이 — 김님 Q1) · 회전(면적 보존) 대 제도 증가 · 앞 Ⓕ = 뒤 ø(Q2) · 입력 스윕 · 거부 시 상태 보존 ·
//   완료본(소매산·AH 이세 «적용 안 됨») · 입력/몸판 변경 무효화 · 다른 라인 충돌 · 표시(겹침 없음) · 배선.
//   ⚠ 구성상 자명한 검사는 이름에 «구성상»을 붙여 독립 형상 검증과 구분한다. 3D 착용은 검증하지 않는다(평면 변 길이·형상만).
//   node test/harness/sleeveXCheck.js
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
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js", "designSleeveR.js", "sleeveRApply.js",
  "designSleeveT.js", "sleeveTApply.js", "sleeveUApply.js", "designSleeveV.js", "sleeveVApply.js", "designSleeveW.js", "sleeveWApply.js",
  "designSleeveX.js", "sleeveXApply.js", "sleeveAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SP = W.sleevePresets, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation,
  SX = W.designSleeveX, SXA = W.sleeveXApply, SWA = W.sleeveWApply;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const APPROVED = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveXApproved.json"), "utf8"));
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
const polyQ = (q, n = 1500) => { const a = []; for (let k = 0; k <= n; k++) a.push(cub(q, k / n)); return a; };
const polySeg = (s, n = 1500) => { let L = []; cubsOf(s).forEach((q, i) => { L = L.concat(polyQ(q, n).slice(i ? 1 : 0)); }); return L; };
const plen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const segLen = (s) => plen(polySeg(s));
const near = (a, b, t) => Math.abs(a - b) <= t;
const ptNear = (a, b, t) => D(a, b) <= t;
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d); const k = 1e-9; return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k)); };
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }
function chainLoop(segs) {   // 순서대로 이어진 외곽 → 닫힌 점열 + 최대 틈(독립 구현 — 엔진의 loopOf 와 다른 코드)
  let pts = [], gap = 0, prev = null;
  segs.forEach(s => { const p = polySeg(s, 40); if (prev) gap = Math.max(gap, D(prev, p[0])); pts = pts.concat(prev ? p.slice(1) : p); prev = p[p.length - 1]; });
  return { loop: pts, gap: Math.max(gap, D(pts[0], pts[pts.length - 1])) };
}
const area = (L) => { let s = 0; for (let i = 0; i < L.length; i++) { const a = L[i], b = L[(i + 1) % L.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; };
const inLoop = (p, L) => { let c = false; for (let i = 0, j = L.length - 1; i < L.length; j = i++) { const a = L[i], b = L[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
const dseg = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, dd = dx * dx + dy * dy, t = dd ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / dd)) : 0; return D(p, { x: a.x + dx * t, y: a.y + dy * t }); };
const dloop = (p, L) => { let m = Infinity; for (let i = 1; i < L.length; i++) m = Math.min(m, dseg(p, L[i - 1], L[i])); return m; };
const deg = r => r * 180 / Math.PI;
const rotp = (p, c, t) => { const d = sub(p, c), ca = Math.cos(t), sa = Math.sin(t); return { x: c.x + d.x * ca - d.y * sa, y: c.y + d.x * sa + d.y * ca }; };
const byRole = (segs, role) => segs.filter(s => s.role === role);
const oneRole = (segs, role) => { const a = byRole(segs, role); return a.length === 1 ? a[0] : null; };
const toP = a => ({ x: a[0], y: a[1] });
const lenOfRole = (segs, role) => byRole(segs, role).reduce((a, s) => a + segLen(s), 0);

// ── 1. 카탈로그 ──
{
  const f = SP.family("kimono-sleeve"), r = SP.get("bunka-sleeve-X");
  ok(f && f.availability === "available" && SP.resolve("kimono-sleeve", "bunka-sleeve-X").ok && f.variants.map(v => v.symbol).join() === "X,Y,Z", "1: 기모노 family = Ⓧ·Ⓨ·Ⓩ 실행 가능(Ⓨ·Ⓩ 2026-11-04 추가)");
  ok(SP.resolve("kimono-sleeve", "bunka-sleeve-Z").ok, "1: 기모노 Ⓩ 실행 가능(2026-11-04 추가)");
  ok(r && r.methodPage === 54 && J(r.inputs.map(i => i.key)) === J(SX.KEYS) && J(SXA.keys()) === J(SX.KEYS) && r.inputs.every(i => i.key === "sleeveLengthCm" ? i.defaultValue === undefined : i.defaultValue === SX.RULES.defaults[i.key]), "1: Ⓧ 레코드 입력 = 엔진 KEYS · 소매길이 기본값 없음 · 기본값 = RULES");
  ok(SX.RULES.book.slopeRunCm === 8 && SX.RULES.book.backSlopeDropCm === 1.6 && SX.RULES.book.frontSlopeDropCm === 0.7 && SX.RULES.book.cuffRatio === 0.75 && Object.keys(SX.RULES.book).length === 4, "1: 책 수치 = 8 · 1.6 / 0.7 · 3/4 (4개)");
  ok(SX.RULES.convention.neckDartRatio === 0.45 && SX.RULES.convention.spFairCm === 2 && Object.keys(SX.RULES.convention).length === 2 && SX.KEYS.length === 7, "1: 구현 관례 = 목 다트 위치 45% · SP 다듬기 2cm(책 수치와 분리) · 입력 7개");
  ok(SXA.PRESET_ID === "bunka-sleeve-X" && SP.get("bunka-sleeve-W").familyId === "raglan-sleeve" && r.familyId === "kimono-sleeve", "1: 프리셋 id · 계열 분리(Ⓦ 는 래글런 그대로)");
}

const P0 = projectWithBodice(A_ID);
const bodice0 = BC.latest(P0), bodiceJ = J(bodice0);
const bodiceB = (() => { const q = projectWithBodice(presetOf("B")); return q ? BC.latest(q) : null; })();
PROJECT = P0;
const RA = W.sleeveRApply;
const R0 = SXA.draft(P0, { sleeveLengthCm: SL });
ok(R0.ok, "2: 몸판 Ⓐ B83 · 소매길이 54 에서 제도됨(" + (R0.ok ? "" : R0.reason) + ")");
const g0 = R0.geometry, m0 = R0.meta, db0 = R0.derivedBodice, bOut = db0.back.outline, fOut = db0.front.outline;

// ── 2. 승인 scratch 와 제품 비교(서로 다른 코드로 계산한 값) ──
{
  const T = 0.01, A = APPROVED, p = m0.points;
  ok(near(m0.phiCm, A.phiCm, 0.005) && ptNear(p.back.SP, A.back.SP, T) && ptNear(p.back.B, A.back.B, T) && ptNear(p.back.C, A.back.C, T) && ptNear(p.back.D, A.back.D, T) && ptNear(p.back.E, A.back.E, T) && ptNear(p.back.E2, A.back.E2, T), "2: 뒤 SP · Ⓑ · Ⓒ · Ⓓ · E · 소맷부리 끝 = 승인 scratch(±0.01) · ø");
  ok(ptNear(p.front.SP, A.front.SP, T) && ptNear(p.front.F, A.front.F, T) && ptNear(p.front.J, A.front.J, T) && ptNear(p.front.D, A.front.D, T) && ptNear(p.front.E, A.front.E, T) && ptNear(p.front.E2, A.front.E2, T), "2: 앞 SP' · Ⓕ · Ⓙ · Ⓓ · E · 소맷부리 끝 = 승인 scratch(±0.01)");
  ok(near(m0.widthCm.back, A.back.widthCm, T) && near(m0.widthCm.front, A.front.widthCm, T) && near(m0.cuff.back, A.back.cuffHalfCm, T) && near(m0.cuff.front, A.front.cuffHalfCm, T), "2: 소매 폭 · 소맷부리 = 승인 scratch");
  const e = m0.gusset.edges;
  ok(near(e.backBody, A.gusset.sqBack, T) && near(e.frontBody, A.gusset.sqFront, T) && near(e.backSleeve, A.gusset.triBack, T) && near(e.frontSleeve, A.gusset.starFront, T) && near(m0.gusset.widthCm, A.gusset.widthCm, 0.01) && near(m0.gusset.areaCm2, A.gusset.areaCm2, 0.2), "2: 덧천 4변 · 폭선 · 넓이 = 승인 scratch");
  ok(near(m0.frontDart.angleDeg, A.frontDart.angleDeg, 0.01) && near(m0.frontDart.neckDartWidthCm, A.frontDart.neckDartWidthCm, 0.02) && near(180 - m0.slope.frontShoulderAfterDeg, A.frontDart.shoulderAfterDeg, 0.01), "2: 앞 AH 다트 닫음 각 · 목 다트 폭 · 이동 뒤 앞 어깨 기울기 = 승인 scratch");
  ok(near(m0.seams.underarm.back, A.sewn.sleeveSeam, 0.01) && near(m0.seams.sideSeam.back + segLen(bodice0.back.outline.find(s => s.boundary.root === "back/side-seam-extension")), A.sewn.sideSeam, 0.01), "2: 소매 밑선 · 옆선 Ⓓ→밑단(Ⓓ→WL + 연장) = 승인 scratch");
}

// ── 2b. 전체 외곽 형상 — 승인 scratch 점열과 제품 외곽의 Hausdorff 거리 ──
{
  const nearSeg = (pts, p) => { let m = Infinity; for (let i = 1; i < pts.length; i++) m = Math.min(m, dseg(p, pts[i - 1], pts[i])); return m; };
  const haus = (A, B) => { let m = 0; A.forEach(p => m = Math.max(m, nearSeg(B, p))); B.forEach(p => m = Math.max(m, nearSeg(A, p))); return m; };
  const hb = haus(chainLoop(bOut).loop, APPROVED.outlineBack), hf = haus(chainLoop(fOut).loop, APPROVED.outlineFront);
  ok(hb < 0.02 && hf < 0.02, "2: 뒤·앞 몸판 일체형 전체 외곽 = 승인 scratch 외곽(Hausdorff 뒤 " + hb.toFixed(4) + " / 앞 " + hf.toFixed(4) + " < 0.02)");
}

// ── 3. 책 규칙 — 최종 외곽 꼭짓점에서 독립 계측 ──
const topLine = (segs) => { const s = oneRole(segs, "sleeve-top"); return { a: s.from, b: s.to }; };
const shLine = (segs) => { const s = segs.filter(x => x.role === "shoulder" && x.kind === "line" && x.edge === "shoulder")[0]; return { a: s.from, b: s.to }; };
const lineX = (l1, l2) => { const d1 = sub(l1.b, l1.a), d2 = sub(l2.b, l2.a), den = cr(d1, d2); const t = cr(sub(l2.a, l1.a), d2) / den; return { x: l1.a.x + d1.x * t, y: l1.a.y + d1.y * t }; };
{
  const SPb = lineX(shLine(bOut), topLine(bOut)), SPf = lineX(shLine(fOut), topLine(fOut));   // SP = 어깨선 ∩ 중심선(다듬기 전 모서리)
  ok(ptNear(SPb, m0.points.back.SP, 1e-6) && ptNear(SPf, m0.points.front.SP, 1e-6), "3: 어깨선 ∩ 중심선 = SP(다듬기 전 모서리 — 외곽 직선에서 독립 재구성)");
  const ang = (segs) => { const s = shLine(segs), t = topLine(segs); const u = unitv(sub(s.b, s.a)), v = unitv(sub(t.b, t.a)); return Math.abs(Math.atan2(cr(u, v), dot(u, v))); };
  ok(near(Math.tan(ang(bOut)), 1.6 / 8, 1e-9) && near(Math.tan(ang(fOut)), 0.7 / 8, 1e-9), "3: 소매 경사 = 어깨선 연장 8 에서 직각 뒤 1.6 / 앞 0.7(외곽 직선의 사잇각)");
  [["back", bOut, SPb], ["front", fOut, SPf]].forEach(([pc, o, SPx]) => {
    const t = topLine(o), u = unitv(sub(t.b, t.a)), cuff = oneRole(o, "cuff"), und = oneRole(o, "sleeve-underarm"), gs = oneRole(o, "gusset-sleeve-edge"), gb = oneRole(o, "gusset-body-edge");
    ok(near(D(SPb === SPx ? SPb : SPx, t.b), SL, 1e-6), "3: " + pc + " 소매길이 = SP 에서 중심선을 따라 " + SL);
    ok(near(dot(sub(cuff.to, cuff.from), u), 0, 1e-9), "3: " + pc + " 소맷부리선 ⟂ 중심선");
    const B = pc === "back" ? gb.from : gb.from, hB = Math.abs(cr(sub(B, SPx), u));   // 소매 폭 ☆ = 겨드랑이 점에서 중심선까지 수직 거리
    ok(near(hB, m0.widthCm[pc], 1e-6), "3: " + pc + " 소매 폭 ☆ = 겨드랑이 점 → 중심선 수직 거리(" + hB.toFixed(3) + ")");
    const C = gs.from, along = dot(sub(C, SPx), u);
    ok(near(along, SL / 2, 1e-6) && near(Math.abs(cr(sub(C, SPx), u)), hB, 1e-6), "3: " + pc + " 덧대는 끝 = 팔꿈치(SP–소맷부리 중점)에서 직각으로 폭만큼(소매 밑 안내선 ∥ 중심선)");
    ok(near(cr(sub(gs.to, gs.from), u), 0, 1e-9), "3: " + pc + " 소매 쪽 노치 변(Ⓒ–Ⓑ) ∥ 소매 중심선");
    ok(near(D(cuff.from, cuff.to), pc === "back" ? 0.75 * hB : hB - 0.25 * m0.widthCm.back, 1e-6), "3: " + pc + " 소맷부리 = " + (pc === "back" ? "뒤 폭 × 3/4" : "앞 폭 − 뒤에서 자른 분량 ●"));
  });
  ok(near(D(oneRole(bOut, "sleeve-underarm").from, oneRole(bOut, "sleeve-underarm").to), D(oneRole(fOut, "sleeve-underarm").from, oneRole(fOut, "sleeve-underarm").to), 1e-9), "3: 소매 밑선 뒤 = 앞(구성상 같음 — 독립 검증 아님: 앞도 뒤와 같은 분량을 자르므로)");
  // 겨드랑이: 원래 진동 곡선에서 따로 잰 ø — 뒤 Ⓑ = ★선–옆선 중점 · 앞 Ⓕ = 옆선에서 같은 ø(Q2)
  const arm = polySeg(bodice0.back.outline.find(s => s.edge === "armhole"), 4000), xi = Math.min(...arm.map(p => p.x)), sideX = bodice0.back.outline.find(s => s.boundary.root === "back/side-seam").from.x, phi = (sideX - xi) / 2;
  const bB = oneRole(bOut, "gusset-body-edge").from, fF = oneRole(fOut, "gusset-body-edge").from;
  ok(near(m0.phiCm, phi, 2e-4) && near(bB.x, xi + phi, 2e-4) && near(sideX - bB.x, phi, 2e-4), "3: 뒤 Ⓑ = 진동 가장 안쪽(★선) 과 옆선의 중점 · ø = " + phi.toFixed(4) + "(원래 진동 곡선에서 따로 잼)");
  ok(near(fF.x - sideX, sideX - bB.x, 1e-3) && near(fF.y, bB.y, 1e-3), "3: 앞 Ⓕ = 옆선에서 뒤와 같은 ø(Q2 — 책 P.145 5-⑤ 명시)");
  const sd = bodice0.back.outline.find(s => s.boundary.root === "back/side-seam"), WLy = Math.max(sd.from.y, sd.to.y), BLy = Math.min(sd.from.y, sd.to.y), Dd = oneRole(bOut, "gusset-body-edge").to;
  ok(near(Dd.y, (BLy + WLy) / 2, 1e-3) && near(Dd.x, sideX, 1e-3), "3: Ⓓ = 옆선 위 BL–WL 중점(원본 몸판 옆선에서 따로 잼)");
}

// ── 4. 폐곡선 · 자기교차 · 연속 ──
{
  const lb = chainLoop(bOut), lf = chainLoop(fOut), lg = chainLoop(g0.outline);
  ok(lb.gap <= 1e-3 && lf.gap <= 1e-3 && lg.gap <= 1e-9, "4: 뒤·앞·덧천 외곽이 닫힘(틈 " + lb.gap.toExponential(1) + " / " + lf.gap.toExponential(1) + " / " + lg.gap.toExponential(1) + ")");
  ok(!selfX(lb.loop) && !selfX(lf.loop) && !selfX(lg.loop), "4: 뒤·앞·덧천 자기교차 없음(독립 판정)");
  ok(g0.outline.length === 4 && g0.integratedBodice === true && g0.pieces.join() === "gusset" && g0.centerSeam === false && g0.butted === false, "4: geometry.sleeve = 덧천 4변 한 장(몸판 일체형 표시)");
  const kinds = s => s.map(x => x.role).join();
  ok(/shoulder-dart/.test(kinds(bOut)) && /neck-dart/.test(kinds(fOut)) && !/neck-dart/.test(kinds(bOut)) && !/shoulder-dart/.test(kinds(fOut)), "4: 열린 뒤 어깨 다트·앞 목 다트가 실제 외곽(다리 2개씩)");
  ok(byRole(bOut, "shoulder-dart").length === 2 && byRole(fOut, "neck-dart").length === 2 && [bOut, fOut].every(o => o.every(s => !/dart-leg-old|old-dart/.test(JSON.stringify(s.dart || "")))), "4: 닫힌 AH 다트 흔적·옛 다리 없음(외곽 · construction 모두)");
  ok([db0.back, db0.front].every(pc => pc.construction.every(s => s.role === "original-armhole")), "4: 파생 몸판 construction = 원래 진동선(참고)만 — 닫힌 다트 다리·스파이크 없음");
  // 연속: 어깨 → SP 곡선 → 중심선 G1(접선 방향 일치)
  [["back", bOut], ["front", fOut]].forEach(([pc, o]) => {
    const i = o.findIndex(s => s.role === "sp-fair"), a = o[i - 1], c = o[i], b = o[i + 1], q = cubsOf(c)[0];
    const t1 = unitv(sub(a.to, a.from)), t2 = unitv(sub(q[1], q[0])), t3 = unitv(sub(q[3], q[2])), t4 = unitv(sub(b.to, b.from));
    ok(dot(t1, t2) > 1 - 1e-9 && dot(t3, t4) > 1 - 1e-9, "4: " + pc + " SP 다듬기 곡선이 어깨선·중심선에 접선 연속(G1)");
  });
}

// ── 5. 덧천 4변 ↔ 몸판/소매 노치 4변 — 서로 다른 객체에서 따로 잰다 ──
{
  const gl = role => segLen(oneRole(g0.outline, role));
  const nb = (o, role) => segLen(oneRole(o, role));
  ok(near(gl("gusset-back-body"), nb(bOut, "gusset-body-edge"), 1e-6) && near(gl("gusset-back-sleeve"), nb(bOut, "gusset-sleeve-edge"), 1e-6), "5: 덧천 뒤 ▣ = 뒤 몸판 Ⓑ–Ⓓ · 뒤 ▲ = 뒤 소매 Ⓑ–Ⓒ(덧천 객체 vs 파생 뒤 객체)");
  ok(near(gl("gusset-front-body"), nb(fOut, "gusset-body-edge"), 1e-6) && near(gl("gusset-front-sleeve"), nb(fOut, "gusset-sleeve-edge"), 1e-6), "5: 덧천 앞 ▣ = 앞 몸판 Ⓕ–Ⓓ · 앞 ※ = 앞 소매 Ⓕ–Ⓙ(덧천 객체 vs 파생 앞 객체)");
  ok(near(m0.seams.gusset.backSleeve, gl("gusset-back-sleeve"), 1e-6) && near(m0.seams.notch.back.sleeveEdge, nb(bOut, "gusset-sleeve-edge"), 1e-6) && near(m0.seams.notch.front.bodyEdge, nb(fOut, "gusset-body-edge"), 1e-6), "5: meta 기록값 = 각 객체에서 잰 값");
  // 덧천 폭선 ø+ø 와 위/아래 꼭짓점: 덧천 좌표에서 따로 — 폭선 = 뒤 Ⓑ ↔ 앞 Ⓕ 의 옆선 간 간격 합
  const gb = oneRole(g0.outline, "gusset-back-sleeve").from, gf = oneRole(g0.outline, "gusset-front-sleeve").to, gc = oneRole(g0.outline, "gusset-back-sleeve").to, gd = oneRole(g0.outline, "gusset-back-body").from;
  const sideX = bodice0.back.outline.find(s => s.boundary.root === "back/side-seam").from.x;
  const wBody = (sideX - oneRole(bOut, "gusset-body-edge").from.x) + (oneRole(fOut, "gusset-body-edge").from.x - sideX);
  ok(near(D(gb, gf), wBody, 1e-6) && near(gb.y, gf.y, 1e-9), "5: 덧천 폭선(뒤 Ⓑ–앞 Ⓕ) = 몸판에서 잰 ø + ø(수평)");
  ok(near(gd.x, (gb.x + gf.x) / 2, 1e-3) && gd.y > gb.y, "5: 덧천 아래 꼭짓점 Ⓓ 는 폭선 가운데 바로 아래(옆선 수직 — ▣ 두 변이 같은 길이)");
  ok(gc.y < gb.y && near(D(gc, gb), nb(bOut, "gusset-sleeve-edge"), 1e-6) && near(D(gc, gf), nb(fOut, "gusset-sleeve-edge"), 1e-6), "5: 덧천 위 꼭짓점 = ▲ · ※ 두 호의 교점");
  // 맞춤 표시 ①~④ — 방향(꼭짓점 대응)까지
  const fit = m0.fit, byId = id => fit.find(f => f.id === id);
  ok(fit.length === 4 && new Set(fit.map(f => f.id)).size === 4 && J(fit.map(f => f.id)) === J(["①", "②", "③", "④"]), "5: 맞춤 표시 ①~④ 네 개 · 서로 다른 번호");
  ok(fit.every(f => near(D(f.from, f.to), D(f.gusset.from, f.gusset.to), 1e-6)), "5: 맞춤마다 몸판 노치 변 길이 = 덧천 변 길이");
  ok(ptNear(byId("①").gusset.from, gb, 1e-9) && ptNear(byId("②").gusset.from, gb, 1e-9) && ptNear(byId("③").gusset.from, gf, 1e-9) && ptNear(byId("④").gusset.from, gf, 1e-9)
    && ptNear(byId("②").gusset.to, gc, 1e-9) && ptNear(byId("③").gusset.to, gc, 1e-9) && ptNear(byId("①").gusset.to, gd, 1e-9) && ptNear(byId("④").gusset.to, gd, 1e-9), "5: 맞춤 방향 — 뒤 Ⓑ·앞 Ⓕ 가 폭선 끝 · Ⓒ=Ⓙ 가 위 꼭짓점 · Ⓓ 가 아래 꼭짓점(오조립 방지)");
  ok(byId("①").piece === "back" && byId("②").piece === "back" && byId("③").piece === "front" && byId("④").piece === "front" && /몸판쪽/.test(byId("①").label) && /소매쪽/.test(byId("②").label) && /소매쪽/.test(byId("③").label) && /몸판쪽/.test(byId("④").label), "5: 뒤/앞 · 몸판쪽/소매쪽 표시가 올바른 변에 붙음");
  [["①", bOut, "gusset-body-edge"], ["②", bOut, "gusset-sleeve-edge"], ["③", fOut, "gusset-sleeve-edge"], ["④", fOut, "gusset-body-edge"]].forEach(([id, o, role]) => {
    const s = oneRole(o, role), f = byId(id), rev = /sleeve/.test(role);   // 외곽은 소매 밑선 → Ⓒ → Ⓑ → Ⓓ 순서라 소매쪽 변은 Ⓒ→Ⓑ(맞춤 표시는 Ⓑ→Ⓒ)
    ok(rev ? (ptNear(f.from, s.to, 1e-9) && ptNear(f.to, s.from, 1e-9)) : (ptNear(f.from, s.from, 1e-9) && ptNear(f.to, s.to, 1e-9)), "5: 맞춤 " + id + " = 파생 몸판 외곽의 " + role + " 두 끝점(방향 포함)");
  });
}

// ── 6. 어깨 다트 닫은 봉제경로 · 목 다트 다리 · 목/진동 보존(회전 대 제도 증가) ──
{
  const sh = (o) => lenOfRole(o, "shoulder"), sp = (o) => lenOfRole(o, "sp-fair"), top = (o) => lenOfRole(o, "sleeve-top");
  const topB = sh(bOut) + sp(bOut) + top(bOut), topF = sh(fOut) + sp(fOut) + top(fOut);
  ok(near(m0.seams.top.back, topB, 1e-6) && near(m0.seams.top.front, topF, 1e-6) && Math.abs(topB - topF) < 0.05, "6: 윗 봉제선(어깨 다트 닫음 + SP 곡선 + 중심선) 뒤 " + topB.toFixed(3) + " / 앞 " + topF.toFixed(3) + " — 차 " + (topB - topF).toFixed(3) + " 기록만(보정 없음)");
  const blockShoulderBack = D(bodice0.back.outline.find(s => s.boundary.root === "back/shoulder-neck").from, bodice0.back.outline.find(s => s.boundary.root === "back/shoulder-neck").to) + D(bodice0.back.outline.find(s => s.boundary.root === "back/shoulder-armhole").from, bodice0.back.outline.find(s => s.boundary.root === "back/shoulder-armhole").to);
  ok(near(blockShoulderBack, sh(bOut) + 2, 1e-3), "6: 뒤 어깨(다트 닫음) = 원래 뒤 어깨 두 조각 합 − SP 다듬기 2(원본 몸판에서 따로 잼)");
  const legsB = byRole(bOut, "shoulder-dart").map(segLen), legsF = byRole(fOut, "neck-dart").map(segLen);
  ok(near(legsF[0], legsF[1], 1e-6), "6: 목 다트 다리 둘의 길이가 같다(BP 축 회전 — 구성상 같음)");
  // 목 다트 각 = 원래 AH 다트 각(몸판 construction 에서 따로 잼)
  const lg = bodice0.front.construction.filter(s => s.kind === "line" && s.dart && s.dart.boundary === "armhole"), apex = s => s.dart.apexAt === "from" ? s.from : s.to, mouth = s => s.dart.apexAt === "from" ? s.to : s.from;
  const BPp = apex(lg[0]), v1 = sub(mouth(lg[0]), BPp), v2 = sub(mouth(lg[1]), BPp), ahDeg = deg(Math.abs(Math.atan2(cr(v1, v2), dot(v1, v2))));
  const nd = byRole(fOut, "neck-dart"), w1 = sub(nd[0].from, nd[0].to), w2 = sub(nd[1].to, nd[1].from), ndDeg = deg(Math.abs(Math.atan2(cr(w1, w2), dot(w1, w2))));
  ok(near(ndDeg, ahDeg, 1e-6) && near(m0.frontDart.angleDeg, ahDeg, 1e-6) && ptNear(nd[0].to, BPp, 1e-3) && ptNear(nd[1].from, BPp, 1e-3), "6: 목 다트 각 = 닫은 AH 다트 각 " + ahDeg.toFixed(3) + "° · 꼭짓점 = BP(몸판 construction 에서 따로 잼)");
  ok(near(D(nd[0].from, nd[1].to), 2 * legsF[0] * Math.sin(ahDeg * Math.PI / 360), 1e-5), "6: 목 다트 폭 = 2 · 다리 · sin(각/2)");
  // 목둘레·진동 길이 보존(회전은 길이를 바꾸지 않는다)
  const neckF0 = segLen(bodice0.front.outline.find(s => s.edge === "neckline")), neckFNew = lenOfRole(fOut, "neck");
  ok(near(neckF0, neckFNew, 2e-3), "6: 앞 목둘레 열린 두 조각 합 = 원래 목둘레(자르고 돌려도 길이 보존)");
  ok(near(segLen(bodice0.back.outline.find(s => s.edge === "neckline")), lenOfRole(bOut, "neck"), 1e-3), "6: 뒤 목둘레 = 원래");
  const aF0 = segLen(bodice0.front.outline.find(s => s.boundary.root === "front/armhole-upper")) + segLen(bodice0.front.outline.find(s => s.boundary.root === "front/armhole-lower"));
  ok(near(aF0, m0.armhole.frontClosedCm, 2e-3) && near(segLen(bodice0.back.outline.find(s => s.edge === "armhole")), m0.armhole.backOrigCm, 1e-3), "6: 닫은 앞 진동 길이 = 원래 위·아래 진동 합(AH 다트는 닫혀도 진동 길이 보존) · 뒤 진동 보존");
  const shF0 = D(bodice0.front.outline.find(s => s.edge === "shoulder").from, bodice0.front.outline.find(s => s.edge === "shoulder").to);
  const sf = oneRole(fOut, "shoulder");
  ok(near(shF0, D(sf.from, sf.to) + 2, 1e-3), "6: 앞 어깨선 길이 보존(회전) − SP 다듬기 2");
  // 면적: 회전은 면적 보존 — 앞 원본 다각형(열린 AH 다트 V 포함) = AH 를 닫고 목에 연 몸판만의 다각형(원본 곡선을 따로 회전해 조립)
  const ol = bodice0.front.outline, up = ol.find(s => s.boundary.root === "front/armhole-upper"), lo = ol.find(s => s.boundary.root === "front/armhole-lower");
  const upM = mouth(lg.find(s => /upper/.test(s.dart.attach.root))), loM = mouth(lg.find(s => /lower/.test(s.dart.attach.root)));
  const angR = Math.atan2(cr(sub(upM, BPp), sub(loM, BPp)), dot(sub(upM, BPp), sub(loM, BPp)));
  const N = nd[0].from;
  const shs = ol.find(s => s.edge === "shoulder"), neckPts = polySeg(ol.find(s => s.edge === "neckline"), 3000);
  const orientTo = (pts, p) => D(pts[0], p) <= D(pts[pts.length - 1], p) ? pts : pts.slice().reverse();
  const SNPo = (D(neckPts[0], shs.from) < 1e-3 || D(neckPts[neckPts.length - 1], shs.from) < 1e-3) ? shs.from : shs.to, SPo = D(SNPo, shs.from) < 1e-3 ? shs.to : shs.from;
  const np = orientTo(neckPts, SNPo);   // SNP → CF
  const iN = np.reduce((b, q, i) => D(q, N) < b.d ? { d: D(q, N), i } : b, { d: Infinity, i: -1 }).i, neckUp = np.slice(0, iN + 1), neckLo = np.slice(iN);
  const upFromSP = orientTo(polySeg(up, 3000), SPo), loFromM = orientTo(polySeg(lo, 3000), loM);
  const tailFrom = (U) => { let cur = U, out = []; ["front/side-seam", "front/side-seam-extension", "front/hem", "front/center-extension", "front/center"].forEach(r => { const p = orientTo(polySeg(ol.find(x => x.boundary.root === r), 2), cur); out = out.concat(p.slice(1)); cur = p[p.length - 1]; }); return out; };
  const Uend = loFromM[loFromM.length - 1], tail = tailFrom(Uend), R = p => rotp(p, BPp, angR);
  // 원본(열린 AH 다트 V 포함): CF → 목 → 어깨 → 위 진동 → BP → 아래 진동 → 옆선 … → CF   /   이동 후(AH 닫음 · 목 다트 열림): CF → 목(CF→N) → BP → 목(N'→SNP') → 어깨' → 위 진동'(회전) → 아래 진동 → 옆선 …
  const orig = [].concat(np.slice().reverse(), upFromSP.slice(0, 1).length ? [SPo] : [], upFromSP, [BPp], loFromM, tail);
  const after = [].concat(neckLo.slice().reverse(), [BPp], neckUp.map(R).reverse(), [R(SPo)], upFromSP.map(R), loFromM.slice(1), tail);
  const a0 = area(orig), a1 = area(after);
  ok(a0 > 100 && near(a0, a1, 0.05), "6: 앞 몸판 면적 보존(회전만) — 원본(AH 다트 V 포함) " + a0.toFixed(2) + " vs AH 닫고 목에 연 몸판 " + a1.toFixed(2) + " — 회전은 면적을 바꾸지 않는다(소매 제도 증가분과 구분)");
  const lbk = chainLoop(bOut).loop, lfr = chainLoop(fOut).loop;
  ok(area(lbk) > 1000 && area(lfr) > 1000 && m0.checks.areasCm2.back > 1000, "6: 파생 외곽 넓이(뒤 " + area(lbk).toFixed(1) + " / 앞 " + area(lfr).toFixed(1) + ")는 원본 몸판 + 소매 제도 증가분 — 회전 보존 면적과 구분해 기록");
}

// ── 7. 원본 종이 보존 — 진동 아래 초승달 종이는 깎지 않는다(김님 Q1) ──
{
  const lbk = chainLoop(bOut).loop, lfr = chainLoop(fOut).loop, SPb = m0.points.back.SP, SPf = m0.points.front.SP;
  const armB = polySeg(bodice0.back.outline.find(s => s.edge === "armhole"), 300), outB = armB.filter(p => !inLoop(p, lbk) && dloop(p, lbk) > 1e-4 && D(p, SPb) > 2);
  ok(outB.length === 0, "7: 원래 뒤 진동 곡선 전부 새 외곽 안(초승달 종이 포함 — 깎지 않음)(" + outB.length + ")");
  const armF = m0.draftLayer.front.armhole, armFp = polySeg(armF, 300), outF = armFp.filter(p => !inLoop(p, lfr) && dloop(p, lfr) > 1e-4 && D(p, SPf) > 2);
  ok(outF.length === 0, "7: 닫은 앞 진동 곡선 전부 새 외곽 안(" + outF.length + ")");
  // 원본 뒤 외곽 점 중 새 외곽 밖인 것은 옆선 위 노치 구간(BL 아래 ~ Ⓓ)뿐
  const sideX = bodice0.back.outline.find(s => s.boundary.root === "back/side-seam").from.x, Dd = oneRole(bOut, "gusset-body-edge").to, Bb = oneRole(bOut, "gusset-body-edge").from;
  const origPts = [].concat(...bodice0.back.outline.map(s => polySeg(s, 300)));
  const lost = origPts.filter(p => !inLoop(p, lbk) && dloop(p, lbk) > 1e-4 && D(p, SPb) > 2.01);   // SP 둘레 2cm 는 다듬기로 깎임(허용)
  ok(lost.length > 0 && lost.every(p => near(p.x, sideX, 1e-3) && p.y > Bb.y && p.y < Dd.y + 1e-3), "7: 원본 뒤 외곽 중 새 외곽 밖 = 옆선 위 노치 구간(" + lost.length + "점 · BL~Ⓓ)뿐 — 나머지 종이 보존");
  ok(m0.checks.armholeOutsideCount === 0 && m0.checks.selfIntersection === false && m0.checks.gussetSelfIntersection === false && m0.checks.pieces === 3 && m0.checks.gussetSeparate === true, "7: meta.checks(닫힘 · 교차 없음 · 진동 보존 · 조각 3)");
  // 겹침 없음: 소매(앞)는 앞 몸판 위로 되돌아오지 않음 — 외곽 자기교차 없음으로 대체되나, 앞 소매 중심선과 몸판 옆선이 만나지 않음 확인
  ok(!selfX(lfr), "7: 앞 소매가 몸판을 가로지르지 않음(자기교차 없음 — 독립)");
}

// ── 8. 상태 · 완료 · 무효화 ──
const Q = projectWithBodice(A_ID); PROJECT = Q;
const bodiceJQ = J(BC.latest(Q));
{
  const r = SXA.apply(Q, { sleeveLengthCm: SL });
  ok(r.ok && Q.working.sleeveX && Q.working.geometry.sleeve.integratedBodice === true && J(Q.working.geometry.sleeve) === J(g0), "8: 적용 → working.sleeveX + geometry.sleeve(덧천)");
  ok(SXA.isActive(Q) && !SXA.isBlocked(Q) && Q.working.sleeveX.derivedBodice.back.outline.length === bOut.length && J(Q.working.sleeveX.parameters) === J(Object.fromEntries(SX.KEYS.map(k => [k, k === "sleeveLengthCm" ? SL : SX.RULES.defaults[k]]))), "8: 파생 몸판·매개변수(엔진이 쓴 값) 소유");
  ok(SC.check(Q).ok === true && SC.check(Q).capLengths === null && SC.check(Q).ease === null, "8: 완료 가능 · 소매산·AH 길이/이세 없음(null — 억지로 만들지 않음)");
  const cc = SC.complete(Q);
  ok(cc.ok && cc.result.origin.presetId === "bunka-sleeve-X" && cc.result.origin.methodPage === 54 && cc.result.cap.applicable === false && cc.result.cap.lengths === null && cc.result.cap.ease === null && /적용되지 않는다/.test(cc.result.cap.note), "8: 완료본 origin = Ⓧ(P.54) · cap = 적용 안 됨(lengths · ease null)");
  const res = Q.working.sleeveResult;
  ok(res && Object.isFrozen(res) && res.derivedBodice && res.derivedBodice.back.outline.length === bOut.length && J(res.geometry) === J(g0) && res.sourceBodiceHash === BC.latest(Q).hash && typeof res.hash === "string", "8: 완료본이 파생 몸판(소매 포함 뒤·앞) + 덧천 geometry 를 소유 · 불변");
  ok(J(BC.latest(Q)) === bodiceJQ, "8: 적용·완료해도 bodiceResult(원래 원형) 무변경");
  ok(SC.isCurrentSleeveChanged(Q) === false && SC.invalidatedByBodice(Q) === false, "8: 완료 직후 변경 없음");
  const S = Q.working.sleeveX, keys = SXA.keys(); let inv = 0; const miss = [];
  keys.forEach(k => { const p = Object.assign({}, S.parameters); p[k] = +(p[k] + (k === "cuffRatio" ? -0.05 : k === "neckDartRatio" ? 0.1 : 0.1)).toFixed(4); const rr = SXA.apply(Q, p); if (rr.ok && SC.isCurrentSleeveChanged(Q)) inv++; else miss.push(k + (rr.ok ? "" : ":" + rr.reason)); SXA.apply(Q, S.parameters); });
  ok(inv === keys.length, "8: 입력 " + keys.length + "개 각각 바꾸면 «변경됨»(" + inv + "/" + keys.length + " " + miss.join(",") + ")");
  SXA.apply(Q, { sleeveLengthCm: SL });
  ok(SC.isCurrentSleeveChanged(Q) === false, "8: 같은 입력으로 되돌리면 같은 서명");
  const before = J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveX, r: Q.working.sleeveResult });
  const bad = SXA.apply(Q, { sleeveLengthCm: SL, neckDartRatio: 0.99 });
  ok(!bad.ok && bad.reason === "neck-dart-out-of-range" && J({ g: Q.working.geometry.sleeve, s: Q.working.sleeveX, r: Q.working.sleeveResult }) === before, "8: 거부된 적용(목 다트 위치 범위 밖)은 상태·geometry·완료본을 바꾸지 않음");
  SXA.reject(Q, { reason: bad.reason, text: bad.text });
  const cb = SC.check(Q), cc2 = SC.complete(Q);
  ok(SXA.isBlocked(Q) && !cb.ok && cb.fails.indexOf("sleeve-x-blocked") >= 0 && !cc2.ok && Q.working.sleeveResult === res && J(Q.working.geometry.sleeve) === J(g0), "8: 차단 표시 → 완료 불가 · 이전 완료본·형상 유지");
  SXA.apply(Q, { sleeveLengthCm: SL });
  ok(!SXA.isBlocked(Q) && SC.check(Q).ok, "8: 유효 입력 재적용으로 차단 해제");
  const gj = J(Q.working.geometry.sleeve); Q.working.geometry.sleeve.outline[0].from.x += 0.01;
  ok(SC.check(Q).fails.indexOf("sleeve-x-geometry-mismatch") >= 0, "8: 덧천 형상 위조 → geometry-mismatch");
  Q.working.geometry.sleeve = JSON.parse(gj);
  const dj = J(Q.working.sleeveX.derivedBodice); Q.working.sleeveX.derivedBodice.back.outline[0].commands[1].points[0].x += 0.01;
  ok(SC.check(Q).fails.indexOf("sleeve-x-geometry-mismatch") >= 0, "8: 파생 몸판 위조 → geometry-mismatch");
  Q.working.sleeveX.derivedBodice = JSON.parse(dj);
  Q.working.sleeveW = { presetId: "bunka-sleeve-W" };
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "8: Ⓦ · Ⓧ 동시 → 라인 충돌");
  delete Q.working.sleeveW;
  const P3 = Q; P3.working.parameters.body = BP.bodyParams(presetOf("B")); P3.working.geometry = Object.assign(DB.computeGeometry(REF, { body: P3.working.parameters.body }), { sleeve: P3.working.geometry.sleeve });
  BC.complete(P3);
  ok(SC.invalidatedByBodice(P3) === true && !SC.check(P3).ok, "8: 몸판 다시 완료 → 소매 완료본 무효(몸판 변경)");
  const rd = SXA.rederive(P3);
  ok(!rd.ok && SXA.isBlocked(P3) && rd.reason === "bodice-not-a", "8: 몸판 변경 후 재제도 → Ⓐ 게이트 차단");
}

// ── 9. 입력 스윕 · 거부 사유 ──
{
  const P = projectWithBodice(A_ID); PROJECT = P; const reasons = new Set(); let okN = 0, bad = 0, thrown = 0;
  const trial = (o) => { let r; try { r = SXA.draft(P, Object.assign({ sleeveLengthCm: SL }, o)); } catch (e) { thrown++; return; }
    if (r.ok) { okN++; const lb = chainLoop(r.derivedBodice.back.outline), lf = chainLoop(r.derivedBodice.front.outline), lg = chainLoop(r.geometry.outline);
      if (lb.gap > 1e-3 || lf.gap > 1e-3 || lg.gap > 1e-9 || selfX(lb.loop) || selfX(lf.loop) || selfX(lg.loop)) bad++; }
    else reasons.add(r.reason); };
  [30, 36, 40, 44, 50, 54, 58, 62, 66, 70, 80].forEach(L => trial({ sleeveLengthCm: L }));
  [6, 7, 8, 9, 10].forEach(v => trial({ slopeRunCm: v })); [1.0, 1.3, 1.6, 2.0, 2.5].forEach(v => trial({ backSlopeDropCm: v })); [0.3, 0.7, 1.2, 2].forEach(v => trial({ frontSlopeDropCm: v }));
  [0.5, 0.65, 0.75, 0.9, 1].forEach(v => trial({ cuffRatio: v })); [0.1, 0.3, 0.45, 0.6, 0.8, 0.9].forEach(v => trial({ neckDartRatio: v })); [0.5, 1, 2, 3, 4].forEach(v => trial({ spFairCm: v }));
  ok(thrown === 0 && bad === 0 && okN > 25, "9: 입력 스윕 " + okN + "건 유효 형상(폐곡선 · 교차 없음) · 예외 " + thrown + " · 불량 " + bad);
  const bads = [{ sleeveLengthCm: 0 }, { sleeveLengthCm: -5 }, { sleeveLengthCm: NaN }, { sleeveLengthCm: "x" }, { cuffRatio: 0 }, { cuffRatio: 1.2 }, { neckDartRatio: 0.02 }, { neckDartRatio: 1 }, { spFairCm: 0 }, { slopeRunCm: -1 }, { backSlopeDropCm: 0 }, { sleeveLengthCm: 12 }, { spFairCm: 9 }];
  const rs = bads.map(o => { const r = SXA.draft(P, Object.assign({ sleeveLengthCm: SL }, o)); return r.ok ? "OK" : r.reason; });
  ok(rs.every(r => r !== "OK") && rs.every(r => typeof r === "string"), "9: 범위 밖 입력은 전부 사유와 함께 거부(" + rs.join(",") + ")");
  const r1 = SXA.draft(P, { sleeveLengthCm: undefined }); ok(!r1.ok && r1.reason === "invalid-input" && r1.text && r1.text.length > 5, "9: 소매길이 비면 거부(invalid-input · 기본값 없음)");
  ok(rs.every((r, i) => !SXA.failText({ reason: r }).startsWith("소매 Ⓧ 를 만들 수 없음(") || r === "x"), "9: 모든 거부 사유에 한국어 문구 있음");
  // 다른 몸판 거부(형상 게이트)
  const PB = projectWithBodice(presetOf("B")); PROJECT = PB; const rb = SXA.draft(PB, { sleeveLengthCm: SL }); PROJECT = P;
  ok(!rb.ok && rb.reason === "bodice-not-a", "9: 몸판 Ⓑ 는 Ⓐ 게이트에서 거부(bodice-not-a)");
  PROJECT = P; const un = { working: { geometry: {} }, referenceGeometry: REF }; ok(!SXA.draft(un, { sleeveLengthCm: SL }).ok, "9: 완료 몸판 없으면 거부");
}

// ── 10. 표시 ──
const P = projectWithBodice(A_ID); PROJECT = P; SXA.apply(P, { sleeveLengthCm: SL });
{
  const g = J(P.working.geometry.sleeve), md = SAN.buildModel(P);
  ok(md && md.line === "X" && /Ⓧ/.test(md.title) && /덧천/.test(md.title) && md.key === "sleeve", "10: 덧천 표시(Ⓧ 제목)");
  ok(["g-left", "g-right", "g-top", "g-bottom", "fit-1", "fit-2", "fit-3", "fit-4", "w", "name"].every(id => md.lines.some(l => l.id === id)), "10: 덧천 꼭짓점 · 맞춤 ①~④ · 폭선 글자");
  ok(md.lines.some(l => l.block !== undefined && /적용 안 됨/.test(l.text) && /3D/.test(l.text)) && md.lines.some(l => l.block !== undefined && /9\.078/.test(l.text) && /17\.893/.test(l.text)) && md.lines.some(l => /①.*뒤 몸판쪽/.test(l.text) && /Ⓑ–Ⓓ/.test(l.text)), "10: 덧천 설명(이세 적용 안 됨 · 3D 미검증 · 4변 길이 · 뒤 몸판쪽 ① 대응 변)");
  const db = SAN.dolmanBodice(P);
  ok(db && db.back.cut === P.working.sleeveX.derivedBodice.back.outline && db.front.cut === P.working.sleeveX.derivedBodice.front.outline && db.back.draft.length === 7 && db.front.draft.length === 8, "10: 몸판 위 재단선(파생 외곽) · 제도선(뒤 7 · 앞 8)");
  const ids = pc => db[pc].anno.lines.map(l => l.id);
  ok(["x1r", "x1d", "x3", "x4", "x5", "x6", "x7", "x7c", "x8", "x9", "x10", "x11", "x12", "x0b", "fit-①", "fit-②"].every(id => ids("back").indexOf(id) >= 0) && ["x0", "x0n", "x1r", "x5", "x6", "x8", "fit-③", "fit-④"].every(id => ids("front").indexOf(id) >= 0), "10: 몸판 위 제도 순서 ⓪~⑩ · 원래 진동선 · 덧천 자리 · 맞춤 ①~④ 글자");
  ok(db.back.anno.zones.length === 1 && db.back.anno.zones[0].cls === "cut" && db.front.anno.zones.length === 1 && db.back.anno.lines.some(l => l.id === "x11" && /초승달/.test(l.text) && /확정/.test(l.text)) && db.back.anno.lines.some(l => l.id === "x12" && /참고/.test(l.text)), "10: 덧천 자리(노치) 표시 · 확정 초승달 · 원래 진동선은 참고선(외곽 아님)");
  ok(db.front.anno.lines.some(l => l.id === "x0" && /옆 이동 불가/.test(l.text) && /목둘레/.test(l.text)) && db.front.anno.lines.some(l => l.id === "x0n" && /구현 관례/.test(l.text)) && db.front.anno.lines.some(l => l.id === "x5" && /뒤와 같은 ø/.test(l.text)), "10: 앞 AH 다트 → 목둘레(옆 불가) · 목 다트 위치 = 구현 관례 표기 · Ⓕ = 뒤와 같은 ø");
  const info = SXA.infoLines(P);
  ok(info.length >= 8 && info[0].indexOf("Ⓧ") >= 0 && info.some(l => /적용 안 됨/.test(l) && /이세/.test(l)) && info.some(l => /관찰값/.test(l)) && info.some(l => /출처 구분/.test(l) && /구현 관례/.test(l)) && info.some(l => /덧천 맞춤/.test(l)), "10: 정보 줄(Ⓧ · 이세 적용 안 됨 · 둘레는 관찰값 · 출처 구분 · 덧천 맞춤)");
  ok(m0.unconfirmed.some(t => /45%/.test(t) && /2cm/.test(t) && /관례/.test(t)) && m0.unconfirmed.some(t => /관찰값/.test(t) && /보편/.test(t)) && m0.unconfirmed.some(t => /3D/.test(t)), "10: 미확정 기록(관례 · 둘레 관찰값은 보편 치수 아님 · 3D 미검증)");
  ok(J(P.working.geometry.sleeve) === g, "10: 표시가 geometry 를 바꾸지 않음");
  const ex = SAN.dolmanExtents(P);
  ok(ex && ex.back && ex.front && ex.sleeveBelow === false && ex.front.minX < bodice0.front.outline.find(s => s.boundary.root === "front/side-seam").from.x - 10, "10: 배치 범위 — 앞 소매가 왼쪽으로 나옴 · 덧천은 몸판 오른쪽 줄(sleeveBelow 아님)");
}

// ── 11. 설명 글자·리더선이 다른 피스에 놓이지 않음 · 피스끼리 겹침 없음 ──
{
  const DLY = W.designLayout, gg = P.working.geometry, LA = DLY.autoLayout(gg, SAN.dolmanExtents(P));
  P.working.layout = { back: LA.back, front: LA.front, sleeve: LA.sleeve, collar: { dx: 0, dy: 0 }, placement: { back: "auto", front: "auto", sleeve: "auto", collar: "auto" } };
  const FSZ = { title: 12, side: 13, note: 8.5 }, fz = c => FSZ[c] || 9;
  const box = (x, y, an, t, c) => { const f = fz(c); let w = 0; for (let i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1 : 0.58) * f; const x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85 - 1, y1: y + f * 0.2 + 1 }; };
  const ov = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  const ub = (a, b) => b ? { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) } : a;
  const ex = SAN.dolmanExtents(P), ar = k => k === "sleeve" ? DLY.outlineBBoxOf(gg, k) : ub(DLY.outlineBBoxOf(gg, k), ex[k]);
  const pcs = ["back", "front", "sleeve"], b3 = {}; pcs.forEach(k => { const b = ar(k); b3[k] = { minX: b.minX + LA[k].dx, maxX: b.maxX + LA[k].dx, minY: b.minY + LA[k].dy, maxY: b.maxY + LA[k].dy }; });
  ok(b3.back.maxX < b3.front.minX && b3.front.maxX < b3.sleeve.minX, "11: 배치 — 뒤 | 앞 | 덧천 가로로 나뉘어 피스 범위가 겹치지 않음(앞 소매 포함)");
  const db2 = SAN.dolmanBodice(P), sm = SAN.buildModel(P, { pieces: true }), bad = [];
  [1.5, 2.2, 3, 4.5, 6, 9].forEach(s => [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([pc, model]) => {
    const others = pcs.filter(k => k !== pc).map(k => { const b = ar(k), dx = LA[k].dx - LA[pc].dx, dy = LA[k].dy - LA[pc].dy; return { k, x0: (b.minX + dx) * s, x1: (b.maxX + dx) * s, y0: (b.minY + dy) * s, y1: (b.maxY + dy) * s }; });
    const LY = SAN.layout(model, s);
    LY.items.forEach(it => { const b = box(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, it.cls); others.forEach(o => { if (ov(b, o)) bad.push(s + " " + pc + "→" + o.k + " «" + it.text.slice(0, 10) + "»"); }); });
  }));
  ok(bad.length === 0 && db2.front.anno.keepOutCm && sm.keepOutCm, "11: Ⓧ 설명 글자가 다른 피스 위에 없음 — 배율 6단계(" + [...new Set(bad)].slice(0, 3).join(" · ") + ")");
  const cross = [];
  [1.25, 1.56, 3, 6].forEach(s => {
    const Bx = {}; [["back", db2.back.anno], ["front", db2.front.anno], ["sleeve", sm]].forEach(([k, m]) => { const LY = SAN.layout(m, s), dx = LA[k].dx, dy = LA[k].dy; Bx[k] = LY.items.map(it => ({ b: box((it.at.x + dx) * s + it.dx, (it.at.y + dy) * s + it.dy, it.anchor, it.text, it.cls), t: it.text.slice(0, 8) })); });
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) Bx[pcs[i]].forEach(a => Bx[pcs[j]].forEach(b => { if (ov(a.b, b.b)) cross.push(s + " " + pcs[i] + "«" + a.t + "»×" + pcs[j] + "«" + b.t + "»"); }));
  });
  ok(cross.length === 0, "11: Ⓧ 피스끼리 설명 글자가 겹치지 않음 — 배율 4단계(" + cross.slice(0, 3).join(" · ") + ")");
}

// ── 12. 배선 ──
{
  const ui = fs.readFileSync(path.join(ROOT, "js/ui.js"), "utf8"), html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), apply = fs.readFileSync(path.join(ROOT, "js/sleeveXApply.js"), "utf8");
  const ver = f => { const m = new RegExp("js/" + f.replace(".", "\\.") + "\\?v=(\\d+)").exec(html); return m ? m[1] : null; };
  ok(/function sleeveXOn/.test(ui) && /function applySleeveX/.test(ui) && /readSleeveTInputs\("X"\)/.test(ui) && /clearOtherSleeveLines\(project, "X"\)/.test(ui) && /keep !== "X" && window\.sleeveXApply/.test(ui) && /window\.sleeveXApply\.rederive\(project\)/.test(ui), "12: ui 연결(적용 · 배타 · 재제도 · 입력)");
  ok(/sleeveXOn\(project\) \? "Ⓧ"/.test(ui) && /id === "bunka-sleeve-X" \? "Ⓧ"/.test(ui) && /getElementById\("rowSleeveX"\)/.test(ui) && /inpSleeveX_/.test(ui) && /isX \? "Ⓧ"/.test(ui), "12: 기호 · 칸 표시 · 입력칸 동기화");
  ok(SX.KEYS.filter(k => k !== "sleeveLengthCm").every(k => html.indexOf('id="inpSleeveX_' + k + '"') >= 0) && html.indexOf('id="rowSleeveX"') >= 0, "12: index.html 입력칸 6개 + 행(rowSleeveX) · id 일치");
  ok(html.indexOf('src="js/designSleeveX.js?v=') > 0 && html.indexOf('src="js/sleeveXApply.js?v=') > html.indexOf('src="js/designSleeveX.js?v=') && html.indexOf('src="js/designSleeveX.js?v=') < html.indexOf('src="js/ui.js?v=') && html.indexOf('src="js/sleeveXApply.js?v=') > html.indexOf('src="js/sleeveWApply.js?v='), "12: 스크립트 순서(Ⓦ 뒤 · ui 앞)");
  ok(["designSleeveX.js", "sleeveXApply.js"].every(f => ver(f) === "2026110401") && ["ui.js", "sleeveCheckpoint.js", "sleevePresets.js", "sleeveAnnotation.js"].every(f => ver(f) === (f === "ui.js" ? "2026111203" : f === "sleeveCheckpoint.js" ? "2026111001" : f === "sleeveAnnotation.js" ? "2026110404" : "2026110403")) && ["designSleeveW.js", "sleeveWApply.js", "designSleeveV.js"].every(f => ver(f) === "2026110301"), "12: 변경 파일 캐시 버전 2026110401(바뀌지 않은 Ⓥ·Ⓦ 파일은 그대로) · Ⓨ 연결로 공용 파일 2026110403");
  ok(!/bodiceResult\s*=/.test(apply) && !/sleeveResult\s*=/.test(apply) && !/localStorage|document\./.test(apply) && !/window\.sleeve[A-WYZ]Apply\.(apply|clear)/.test(apply), "12: sleeveXApply 는 bodiceResult·sleeveResult 를 쓰지 않고 DOM·storage 미접근 · 다른 소매 라인을 건드리지 않음");
  const eng = fs.readFileSync(path.join(ROOT, "js/designSleeveX.js"), "utf8");
  ok(!/localStorage|document\.|bodiceResult\s*=|designSleeveV|designSleeveW|designSleeveT\b/.test(eng) , "12: 엔진은 순수(DOM·storage·bodiceResult 쓰기 없음) · Ⓥ/Ⓦ/Ⓣ 엔진을 재사용하지 않음(다트 엔진·다른 결과 무변경)");
  const cp = fs.readFileSync(path.join(ROOT, "js/sleeveCheckpoint.js"), "utf8");
  ok(/proj\.working\.sleeveX \? 1 : 0/.test(cp) && /checkX\(proj\)/.test(cp) && /completeX\(proj, c\)/.test(cp) && /sleeveX/.test(fs.readFileSync(path.join(ROOT, "js/sleeveAnnotation.js"), "utf8")), "12: 체크포인트(충돌 · check · complete) · 표시 연결");
}

console.log(fails.map(f => "  ✗ " + f).join("\n"));
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
