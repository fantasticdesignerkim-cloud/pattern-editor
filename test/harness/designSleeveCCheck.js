// ══════════════════════════════════════════════
// designSleeveCCheck.js — js/designSleeveC.js(소매 Ⓒ, [패턴학교] P.41 하단 — 2026-10-08 김님 확정 재해석 공정) 전용 회귀.
//
//   원문: docs/book/P041.md § Ⓒ 재해석 — 현행 권위. 확정 조건(중앙 고정·종이 강체·뒤 EL 맞댐/아래 V·앞 EL 절개·겹침만큼 소매구 연장·각 1=1cm·
//   뒤 다리끝 = Ⓐ 밑단 교점에서 수직 아래 1cm·뒤 EL 쐐기 E/F = Q∓QR/2·소매산 꺾임 양쪽 ℓ 2cm 국소 재제도)을 모듈과 다른 구현으로 다시 계산해 대조한다.
//   (1) API·상수  (2) 완성 가정선(유일 결정 값)  (3) 강체 맞댐·뒤 다트 봉제 정합  (4) 앞 EL 겹침·소매구 연장·옆선  (5) 소매산 재제도(해석적 G1·잔부 보존·변곡)·길이/이세 독립 실측
//   (6) 단일 외곽·자기교차  (7) 폐기된 가정 부재  (8) EL 파라미터·거부 사유  (9) 결정성·불변  (10) 입력 sweep
//   node test/harness/designSleeveCCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveC.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SC = W.designSleeveC, DS = W.designSleeve;
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
  ok(typeof SC.draftSleeveC === "function" && typeof SC.readSleeveA === "function" && Object.isFrozen(SC) && Object.isFrozen(SC.RULES), "1: API 동결");
  const R = SC.RULES;
  ok(R.defaultElbowLengthCm === 31.4 && R.hemRatio === 0.75 && R.dotDivisor === 4 && R.oneCm === 1 && R.legDropCm === 1, "1: 확정 상수(EL 31.4 · W×3/4 · ÷4 · 1cm)");
  ok(R.redrawEllCm === 2 && R.redrawRatio === 0.4, "1: 소매산 재제도 ℓ 2cm(임시 시작 설정) · 인접 호 40%");
  ok(!("sectionRatio" in R) && !("fairLenCm" in R) && !("maxRotationRad" in R), "1: 폐기된 상수(1:2:1 강제·fairing·전체 회전) 없음");
}

const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
const C = SC.draftSleeveC(A, { elbowLengthCm: 31.4 });
ok(A.ok && C.ok, "기준: B83 SL52 EL31.4 성공");
const m = C.meta, g = C.geometry;
// Ⓐ 값(독립)
const capA = A.geometry.outline[0], cubsA = cubsOf(capA), Ub = cubsA[0][0], Uf = cubsA[cubsA.length - 1][3], H = 52, EL = 31.4;
const Wd = Uf.x - Ub.x, cuff = Wd * 3 / 4, dot = cuff / 4, xb = Ub.x / 2, xf = Uf.x / 2;
function capXcross(x) { for (const q of cubsA) if ((q[0].x - x) * (q[3].x - x) <= 0) { let lo = 0, hi = 1; for (let i = 0; i < 100; i++) { const md = (lo + hi) / 2; (cub(q, md).x < x) ? lo = md : hi = md; } return cub(q, (lo + hi) / 2); } return null; }
const Pb = capXcross(xb), Pf = capXcross(xf);

// ── 2. 완성 가정선(확정 조건만으로 유일 결정되는 값) ──
{
  const d = m.derivation;
  ok(near(m.hemTargetCm, cuff) && near(m.sections.unitCm, dot), "2: 소맷부리 = W×3/4 · ● = 소맷부리÷4");
  ok(near(d.frontElbowPoints[0].x, xf - 0.5) && near(d.frontElbowPoints[1].x, xf + 0.5) && near(d.frontElbowPoints[0].y, EL), "2: 앞 EL 두 점 = x_f∓0.5(간격 1)");
  ok(near(D(Pf, d.frontElbowPoints[0]), D(Pf, d.frontElbowPoints[1]), 1e-8), "2: 앞 EL 위 두 변 길이 같음(강체 맞댐 조건)");
  ok(near(d.frontHemPoints[0].x, xf + 0.5) && near(d.frontHemPoints[1].x, xf - 0.5) && near(d.frontHemPoints[0].y, H), "2: 앞 밑단 두 점 = x_f±0.5(간격 1, 교차)");
  ok(near(D(d.frontElbowPoints[0], d.frontHemPoints[0]), D(d.frontElbowPoints[1], d.frontHemPoints[1])), "2: 앞 EL 아래 두 변 길이 같음(채운 ●◎ 맞댐 조건)");
  const Hr = d.legEnds.center, Hl = d.legEnds.outer;
  ok(near(Hr.y, H + 1) && near(Hl.y, H + 1) && d.legEnds.dropCm === 1, "2: 뒤 다리끝 = 밑단 교점에서 수직 아래 1cm");
  ok(near(D(Hr, d.frontHemPoints[0]), 2 * dot), "2: 중앙 2● = 오른쪽 새 다리끝 ~ 앞 중앙 밑단점 두 점 거리");
  ok(near((Hr.x + Hl.x) / 2, xb), "2: 두 다리끝 뒤 절개축 대칭(∅=∅)");
  ok(near(m.sections.white.backOuter, dot) && near(m.sections.white.center, 2 * dot) && near(m.sections.white.frontOuter, dot), "2: 완성 가정선 구간 ● : 2● : ● (두 점 거리)");
  const w = d.backWedge, t = (EL - Pb.y) / (Hr.y - Pb.y), Rx = Pb.x + (Hr.x - Pb.x) * t;
  ok(near(w.Q.x, xb) && near(w.Q.y, EL) && near(w.R.x, Rx, 1e-8) && near(w.D, Rx - xb, 1e-8), "2: 뒤 쐐기 Q·R·D 독립 재계산 일치");
  ok(near(w.Q.x - w.E.x, w.D / 2, 1e-8) && near(w.R.x - w.F.x, w.D / 2, 1e-8) && near(w.F.x - w.E.x, w.D, 1e-8), "2: EQ = FR = D/2, EF = D");
  ok(near(D(Pb, w.E), D(Pb, w.F), 1e-8), "2: 뒤 쐐기 두 변 길이 같음");
}

// ── 3. 강체 맞댐 · 뒤 다트 봉제 정합 ──
{
  const bk = m.back, w = m.derivation.backWedge;
  ok(near(bk.apex.x, w.F.x) && near(bk.apex.y, EL), "3: 뒤 다트 꼭짓점 = F(EL 위, 맞댄 쐐기 끝)");
  ok(near(D(bk.apex, bk.legCenter.to), D(bk.apex, bk.legOuter.to), 1e-9) && near(bk.legLengthDiffCm, 0, 1e-9), "3: 뒤 다트 두 다리 길이 같음(봉제 정합)");
  ok(bk.legOuter.to.x < bk.legCenter.to.x && bk.dartOpenCm > 1, "3: 뒤 V 열림 보존(" + bk.dartOpenCm.toFixed(3) + ")");
  const dl = seg(g, "dart-leg-center"), do_ = seg(g, "dart-leg-outer");
  ok(dl && do_ && dl.pair === "elbow-back" && do_.pair === "elbow-back" && near(dl.to.x, bk.apex.x) && near(do_.from.x, bk.apex.x), "3: 다트 다리 outline · pair");
  ok(near(D(Pb, m.underarm.after.back), D(Pb, Ub), 1e-8) && near(D(Pb, bk.outerCorner), D(Pb, m.derivation.hemWhite.backOuterCorner), 1e-8), "3: 뒤 옆 조각 강체(P_b 기준 거리 보존)");
  ok(near(D(Pf, m.underarm.after.front), D(Pf, Uf), 1e-8), "3: 앞 상부 옆 조각 강체(P_f 기준)");
  ok(near(m.sections.straight.backOuter, dot) && near(m.sections.straight.center, 2 * dot), "3: 이동 뒤 뒤 ●·중앙 2● 두 점 거리 유지(강체)");
}

// ── 4. 앞 EL 겹침 · 소매구 연장 · 옆선 ──
{
  const fr = m.front, se = m.seams;
  ok(fr.overlapCm > 0 && fr.extensionCm > 0, "4: 앞 EL 겹침 > 0 · 연장 > 0");
  ok(Math.abs(fr.overlapCm - fr.extensionCm) < 2e-3, "4: EL 절개선 겹침 깊이 ≈ 옆선 단축(연장량) — 같은 ⊠ (" + (fr.overlapCm - fr.extensionCm).toExponential(1) + ")");
  ok(near(se.frontCm, se.whiteFrontCm, 1e-9), "4: 연장 뒤 앞 옆선 = 흰 도해 앞 옆선(겹친 길이만큼 정확히 보충)");
  ok(near(se.backCm, se.whiteBackCm, 1e-9), "4: 뒤 옆선 = 흰 도해 뒤 옆선(강체)");
  ok(near(se.residualCm, se.whiteFrontCm - se.whiteBackCm, 1e-9) && Math.abs(se.residualCm) < 0.02, "4: 옆선 잔차 = 흰 도해 차(숨기지 않음) " + se.residualCm.toFixed(4));
  const s1 = seg(g, "side-seam-front"), s2 = seg(g, "side-seam-front-lower");
  ok(near(D(s1.from, s1.to) + D(s2.from, s2.to), se.frontCm, 1e-9) && near(s1.to.x, s2.from.x) && near(s1.to.y, s2.from.y), "4: 앞 옆선(outline 실측) = meta");
  const b1 = seg(g, "side-seam-back"), b2 = seg(g, "side-seam-back-lower");
  ok(near(D(b1.from, b1.to) + D(b2.from, b2.to), se.backCm, 1e-9), "4: 뒤 옆선(outline 실측) = meta");
}

// ── 5. 소매산 재제도 · 길이/이세 독립 실측 ──
{
  const r = m.redraw, ck = m.checks;
  ok(r.ellCm === 2 && r.windows.Pb.every(v => v > 0 && v <= 2) && r.windows.Pf.every(v => v > 0 && v <= 2), "5: 재제도 구간 ≤ 2cm(인접 호 40% 한도)");
  ok(r.joins.length === 4 && r.joins.every(j => j.gapCm < 1e-9 && j.g1Deg <= 1e-9), "5: 이음 4곳 끝점 정합·해석적 G1");
  const cs = cubsOf(g.outline[0]); let worst = 0, gap = 0;
  for (let i = 1; i < cs.length; i++) { gap = Math.max(gap, D(cs[i - 1][3], cs[i][0])); worst = Math.max(worst, ang(der(cs[i - 1], 1), der(cs[i], 0))); }
  ok(gap < 1e-9, "5: 소매산 cubic 연속");
  ok(worst < 1e-6, "5: 소매산 전체 이음 접선 연속(독립, 최대 " + worst.toExponential(1) + "°) — 맞댄 꺾임 해소");
  ok(r.kinkDegRaw.Pb > 1 && r.kinkDegRaw.Pf > 1, "5: 맞댐 직후(raw) 꺾임이 실제로 있었음(재제도 대상)");
  ok(ck.preservedMaxCm < 1e-9, "5: 구간 밖 원래 곡선 보존");
  ok(r.inflectionExtra === 0, "5: 재제도로 늘어난 변곡 없음");
  const iSP = cs.findIndex(q => near(q[3].x, 0, 1e-9) && near(q[3].y, 0, 1e-9));
  const back = denseLen(cs.slice(0, iSP + 1)), tot = denseLen(cs);
  ok(iSP > 0 && near(back, m.capLengths.back, 2e-5) && near(tot - back, m.capLengths.front, 2e-5), "5: 소매산 길이 독립 실측 일치(뒤 " + back.toFixed(4) + " · 앞 " + (tot - back).toFixed(4) + ")");
  ok(near(m.easeAfter.back, m.capLengths.back - A.meta.armholeCm.back, 1e-12) && near(m.easeAfter.front, m.capLengths.front - A.meta.armholeCm.front, 1e-12), "5: 이세 = 최종 곡선 실측 − AH");
  ok(Math.abs(m.capLengths.back - A.meta.capLengths.back) > 1e-4 || Math.abs(m.capLengths.front - A.meta.capLengths.front) > 1e-4, "5: Ⓐ 길이로 되돌리지 않음(독립 실측값)");
  const prim = DS.capPrimitives(g);
  ok(prim && near(prim.splitPoint.x, 0, 1e-9) && near(prim.lengths.back, m.capLengths.back, 1e-3) && near(prim.lengths.front, m.capLengths.front, 1e-3), "5: designSleeve.capPrimitives 가 role=cap 소매산을 SP 에서 나눔");
}

// ── 6. 단일 외곽 ──
{
  const roles = g.outline.map(s => s.role).join(",");
  ok(roles === "cap,side-seam-front,side-seam-front-lower,hem-front,hem-center,dart-leg-center,dart-leg-outer,hem-back,side-seam-back-lower,side-seam-back", "6: outline 순서·역할");
  ok(g.outline.filter(s => /^hem-/.test(s.role)).every(s => s.kind === "path") && g.outline.filter(s => /^(side-seam|dart-leg)/.test(s.role)).every(s => s.kind === "line"), "6: 소맷부리 = 마무리 곡선(path) · 옆선·다트 다리 = 직선");
  const ring = ringOf(g);
  ok(D(ring[0], ring[ring.length - 1]) < 1e-9, "6: 닫힘");
  ok(!selfX(ring), "6: 자기교차 없음(독립)");
  ok(selfX([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 0 }]), "6: 독립 자기교차 검사기 자체 확인(8자 검출)");
  ok(m.checks.singlePiece === true && m.checks.selfIntersection === false, "6: meta.checks 단일 조각");
  ok(g.construction.map(c => c.role).join() === "center-line,elbow-line,cut-axis-back,cut-axis-front,front-axis-lower,front-el-cut", "6: construction 역할(앞 EL→소매구 맞댐선 포함)");
}

// ── 7. 폐기된 가정 부재 ──
{
  ok(!("fairing" in m) && !("rigid" in m) && !J(m).includes("compensation") && !/1:2:1|arc-length\(final curve\)/.test(J(m)), "7: fairing·raw 보정·최종 호 길이 1:2:1 강제 기록 없음");
  ok(Math.abs(m.front.overlapCm - 1.487) > 0.1, "7: 옛 계산 겹침 1.49 재사용 아님(" + m.front.overlapCm.toFixed(3) + ")");
  ok(!near(m.sections.final.frontOuter, dot, 1e-6), "7: 앞 최종 구간을 ● 로 강제하지 않음(연장 반영 실측)");
  ok(!g.construction.some(c => c.role === "cut-axis-front-lower"), "7: 원형 수직축 중앙 변 없음");
}

// ── 8. EL 파라미터 · 거부 사유 ──
{
  const c28 = SC.draftSleeveC(A, { elbowLengthCm: 28 }), c34 = SC.draftSleeveC(A, { elbowLengthCm: 34 });
  ok(c28.ok && c34.ok && c28.meta.elbowLengthCm === 28 && c34.meta.elbowLengthCm === 34 && c28.meta.derivation.backWedge.D !== c34.meta.derivation.backWedge.D, "8: EL 편집 → 쐐기·형상 재계산");
  ok(SC.draftSleeveC(A, {}).meta.elbowLengthCm === 31.4 && SC.draftSleeveC(A, null).ok, "8: EL 미지정 → 기본 31.4");
  ok(SC.draftSleeveC(A, { elbowLengthCm: -3 }).reason === "invalid-elbow-length" && SC.draftSleeveC(A, { elbowLengthCm: NaN }).reason === "invalid-elbow-length", "8: EL 음수·NaN 거부");
  const nr = SC.draftSleeveC(A, { elbowLengthCm: 51.5 }); ok(!nr.ok && nr.reason === "elbow-too-close-to-hem" && nr.outOfSupportedRange === true, "8: EL 이 밑단에 너무 가까움 → 지원 밖");
  const hi = SC.draftSleeveC(A, { elbowLengthCm: 10 }); ok(!hi.ok && hi.reason === "elbow-above-underarm", "8: EL 이 아랫점 위 → 지원 밖");
  ok(SC.draftSleeveC(null, {}).reason === "no-sleeve-a" && SC.draftSleeveC({ ok: true, geometry: {}, meta: {} }, {}).reason === "invalid-sleeve-a", "8: Ⓐ 없음/형식 오류");
}

// ── 9. 결정성 · 불변 ──
{
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af);
  const c1 = SC.draftSleeveC(Af, { elbowLengthCm: 31.4 }), c2 = SC.draftSleeveC(Af, { elbowLengthCm: 31.4 });
  ok(c1.ok && J(c1) === J(c2) && J(Af) === before, "9: 동결 입력 · 결정성 · Ⓐ 불변");
  ok(c1.sourceSleeveAHash === C.sourceSleeveAHash, "9: 출처 hash");
}

// ── 11. 소맷부리 마무리 곡선(2026-10-09) — 독립 검증 ──
{
  const hf = seg(g, "hem-front"), hc = seg(g, "hem-center"), hb = seg(g, "hem-back"), qf = cubsOf(hf), qc = cubsOf(hc), qb = cubsOf(hb);
  const d = m.derivation, fr = m.front, bk = m.back, st = (sg) => sg.commands[0].points[0], en = (sg) => sg.commands[sg.commands.length - 1].points[2];
  ok(D(st(hf), fr.outerCorner) < 1e-12 && D(en(hf), d.frontHemPoints[0]) < 1e-12 && D(st(hc), d.frontHemPoints[0]) < 1e-12 && D(en(hc), bk.legCenter.to) < 1e-12 && D(st(hb), bk.legOuter.to) < 1e-12 && D(en(hb), bk.outerCorner) < 1e-12, "11: 제도점 고정(앞 모서리·앞 중앙 밑단점·두 다리끝·뒤 모서리)");
  ok(near(bk.legCenter.to.y, H + 1) && near(d.legEnds.center.y, H + 1), "11: 1cm 내린 다리끝을 길이 맞추려고 옮기지 않음");
  ok(ang(der(qf[qf.length - 1], 1), der(qc[0], 0)) < 1e-9, "11: 앞/중앙 이음 G1(독립)");
  const apex = bk.apex, closeA = Math.atan2(bk.legCenter.to.y - apex.y, bk.legCenter.to.x - apex.x) - Math.atan2(bk.legOuter.to.y - apex.y, bk.legOuter.to.x - apex.x);
  const rv = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });
  ok(ang(der(qc[qc.length - 1], 1), rv(der(qb[0], 0), closeA)) < 1e-6, "11: 뒤 다트를 닫으면(봉제) 양쪽 소맷부리가 한 접선으로 이어진다(독립)");
  const legC = { x: bk.legCenter.to.x - apex.x, y: bk.legCenter.to.y - apex.y }, legO = { x: bk.legOuter.to.x - apex.x, y: bk.legOuter.to.y - apex.y };
  ok(Math.abs(ang(der(qc[qc.length - 1], 1), legC) - 90) < 1e-6 && Math.abs(ang(der(qb[0], 0), legO) - 90) < 1e-6, "11: 다리끝에서 밑단 ⟂ 다리");
  const kap = (q, t) => { const a = der(q, t), u = 1 - t, b = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) }; return (a.x * b.y - a.y * b.x) / Math.pow(Math.hypot(a.x, a.y), 3); };
  const signs = (q) => { const sg = []; for (let i = 0; i <= 200; i++) { const k = kap(q, i / 200); if (Math.abs(k) > 0.01) sg.push(Math.sign(k)); } return new Set(sg).size; };
  ok([qf[0], qc[0], qb[0]].every(q => signs(q) <= 1), "11: 소맷부리 곡선에 변곡 없음(독립 곡률 부호)");
  const hemLen = denseLen(qf) + denseLen(qc) + denseLen(qb);
  ok(near(hemLen, m.hemCm, 2e-5), "11: 소맷부리 곡선 길이 독립 실측 = meta.hemCm " + hemLen.toFixed(4) + " (책 목표 W×3/4 " + m.hemTargetCm.toFixed(4) + " · 직선 " + m.hemStraightCm.toFixed(4) + ")");
  ok(Math.abs(m.hemCm - m.hemTargetCm) < 0.05, "11: 곡선 정리로 큰 변형 없음(목표와 차 " + (m.hemCm - m.hemTargetCm).toFixed(4) + ")");
  const turnF = ang(der(qf[0], 0), { x: st(hf).x - seg(g, "side-seam-front-lower").from.x, y: st(hf).y - seg(g, "side-seam-front-lower").from.y });
  ok(turnF > 45, "11: 앞 옆선 접점은 의도된 모서리로 남는다(" + turnF.toFixed(1) + "°)");
  ok(bk.legOuter.to.x < bk.legCenter.to.x && near(D(apex, bk.legCenter.to), D(apex, bk.legOuter.to), 1e-9), "11: 열린 뒤 V · 두 다리 길이 같음 유지");
  ok(fr.extension && fr.extension.zone.length > 3 && near(fr.extension.amountCm, fr.extensionCm) && D(fr.extension.before.from, fr.outerCornerBeforeExtension) < 1e-12, "11: 소매구 연장 영역·연장 전 기준선 meta(표시용)");
  ok(m.cuffCurve.frontCenterG1Deg <= 1e-9 && m.cuffCurve.dartClosedHemDeg <= 1e-6 && m.checks.cuffG1Deg <= 1e-6, "11: meta 소맷부리 G1 기록");
}

// ── 10. 입력 sweep(몸판 프리셋 × SL × EL) ──
{
  let n = 0, okN = 0; const out = {}, bad = [];
  const worst = { g1: 0, legs: 0, seam: 0, pres: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [44, 48, 52, 56, 60]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL, elbowLengthCm: 31.4 }); if (!a.ok) continue;
      for (const el of [26, 28, 31.4, 34, 36]) {
        n++;
        const c = SC.draftSleeveC(a, { elbowLengthCm: el });
        if (!c.ok) { out[c.reason] = (out[c.reason] || 0) + 1; if (!c.outOfSupportedRange) bad.push(sym + SL + "/" + el + ":" + c.reason); continue; }
        okN++;
        const k = c.meta.checks;
        worst.g1 = Math.max(worst.g1, k.maxG1BreakDeg); worst.legs = Math.max(worst.legs, k.dartLegsDiffCm); worst.pres = Math.max(worst.pres, k.preservedMaxCm);
        worst.seam = Math.max(worst.seam, Math.abs(c.meta.seams.frontCm - c.meta.seams.whiteFrontCm));
        if (selfX(ringOf(c.geometry))) bad.push(sym + SL + "/" + el + ":selfX");
      }
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 지원 밖 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 100 && okN > 0.8 * n, "10: sweep " + okN + "/" + n + " 성공 · 지원 밖 " + J(out));
  ok(!bad.length, "10: 지원 밖 표시 없는 실패·자기교차 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.g1 <= 1e-9 && worst.legs <= 1e-9 && worst.pres <= 1e-9 && worst.seam <= 1e-9, "10: sweep 불변식(G1·다리·보존·옆선 보충) 최악 " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
