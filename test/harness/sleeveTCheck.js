// ══════════════════════════════════════════════
// sleeveTCheck.js — 소매 Ⓣ(P.50 셔츠 슬리브 «몸판에 직접 제도» · 제도 방법 P.140–141, 화면 검토용 시안) 전용 회귀:
//   카탈로그(Ⓤ 보류 사유) · 책 구성 기하(경사 8 ⟂ 4 / 3.4 · ◉ = 평균 어깨 길이 × 3/4 · 폭선·소맷부리선 직각) · **독립 길이**(소매산 = 몸판 진동) ·
//   소맷부리(뒤 폭 × 3/4 · 앞 = 폭 − ● · 밑선 앞뒤 같음) · 앞 AH 다트 → 옆 다트(강체 회전 · 입구 닫힘 · 다리 같은 길이) ·
//   폐곡선·자기교차 · 원본 불변 · 몸판 Ⓐ 게이트 · 입력 거부 · 스윕 · 완료본 소유·무효화 · 표시 · 배선.
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
function spTangentOk(g) {   // 소매산 cubic 중 SP(0,0) 로 들어오는 것과 나가는 것의 끝 핸들 방향(독립 계측)
  const c = cubsOf(role(g, "cap")), i = c.findIndex(q => D(q[3], { x: 0, y: 0 }) < 1e-9);
  if (i < 0 || i + 1 >= c.length || D(c[i + 1][0], { x: 0, y: 0 }) > 1e-9) return false;
  const tin = unitv(sub(c[i][3], c[i][2])), tout = unitv(sub(c[i + 1][1], c[i + 1][0]));
  return Math.abs(cr(tin, tout)) < 1e-9 && dot(tin, tout) > 0 && Math.abs(tin.y) < 1e-9 && tin.x > 0;
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
  ok(spTangentOk(g), "5: SP 접선(독립) — 앞뒤 소매산이 중심선(x = 0) 직각 같은 직선으로 이어진다(꺾임 없음)");
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
  ok(ver("sleeveTApply.js") === "2026102908" && ["sleevePresets.js", "ui.js", "sleeveCheckpoint.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026102911"), "11: 캐시 버전(sleeveTApply 2026102908 · Ⓤ 연결로 바뀐 공용 파일 2026102911)");
  ok(ver("designSleeveT.js") === "2026102911", "11: designSleeveT.js 캐시 버전 2026102911(Ⓤ 변형 추가 · Ⓣ 결과 무변경)");
  ok(html.indexOf("js/sleeveSApply.js") < html.indexOf("js/designSleeveT.js") && html.indexOf("js/designSleeveT.js") < html.indexOf("js/sleeveTApply.js") && html.indexOf("js/sleeveTApply.js") < html.indexOf("js/ui.js"), "11: 스크립트 순서");
  const rec = SP.get("bunka-sleeve-T");
  ok(/id="rowSleeveT" hidden/.test(html) && rec.inputs.slice(1).every(i => new RegExp('id="inpSleeveT_' + i.key + '" type="number" step="[0-9.]+" value="' + String(i.defaultValue).replace(".", "\\.") + '"').test(html)), "11: 입력 칸 11개 = 레코드 기본값");
  ok(/function applySleeveT\(/.test(ui) && /keep !== "T" && window\.sleeveTApply/.test(ui) && /sleeveTOn\(project\)\) \{ window\.sleeveTApply\.rederive/.test(ui) && /\|\| sleeveTOn\(project\) \|\| sleeveUOn\(project\); \}/.test(ui) && /"inpSleeveLength" : "inpSleeveT_" \+/.test(ui), "11: ui 연결(적용 · 배타 · 재제도 · 라인 켜짐 · 공용 소매길이 칸)");
  ["designSleeveT.js", "sleeveTApply.js"].forEach(f => { const t = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); ok(!/localStorage|document\.|window\.addEventListener/.test(t), "11: " + f + " DOM·storage 미접근"); });
}

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log("결과: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
