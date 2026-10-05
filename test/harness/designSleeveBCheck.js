// ══════════════════════════════════════════════
// designSleeveBCheck.js — js/designSleeveB.js(소매 Ⓑ 엔진 코어, [패턴학교] P.41 타이트 슬리브) 전용 회귀.
//
//   Ⓑ = 완성된 Ⓐ geometry 를 읽기 전용 출발 원형으로, 소맷부리 = 소매폭 W × 3/4(총 맞댐량 W/4)가 되게 앞·뒤 절개축 2개에서 바깥 조각을 강체 회전해 닫는다.
//   (1) 수치(B83·Ⓐ 몸판): W · 3/4 소맷부리 · 양쪽 맞댐량 W/8 · 절개축 위치(앞·뒤 각 반폭의 중점 — 유일한 규칙, 옵션 없음) · 교점이 Ⓐ 소매산 위
//   (2) 보존: 앞·뒤 소매산 길이·이세 · 앞뒤 밑선 길이 · 중심 조각 불변(결 방향 수직) · 바깥 조각은 강체 회전과 일치
//   (3) 위상: 폐곡선·연속·자기교차 없음 · 폭 0 절개 흔적 없음(축은 construction/meta 로만) · 단차는 실제 윤곽
//   (4) 손바닥 둘레 선택 입력: 없으면 3/4 규칙만 · 있으면 palm+3cm 미달 시 **경고만**(형상 불변) · 잘못된 입력 거절
//   (5) 입력 불변(deep-freeze·hash) · 반환 독립(공유 참조 없음) · 명시적 실패 reason · 스윕
//   node test/harness/designSleeveBCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveB.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SB = W.designSleeveB, DS = W.designSleeve, SM = W.sleeveMeasure;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function bodiceResultOf(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }


// ── 독립 측정(모듈과 다른 조밀 샘플·다른 구현) ──
const cubicPt = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function capCubics(geom) { const cap = geom.outline[0], out = []; let cur = cap.commands[0].points[0]; cap.commands.slice(1).forEach(c => { out.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return out; }
const denseLen = (cubs) => { let t = 0; cubs.forEach(q => { let pr = q[0]; for (let i = 1; i <= 4000; i++) { const p = cubicPt(q, i / 4000); t += D(pr, p); pr = p; } }); return t; };
const densePts = (cubs, n = 800) => { const o = []; cubs.forEach(q => { for (let i = 0; i <= n; i++) o.push(cubicPt(q, i / n)); }); return o; };
const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0; return D(p, { x: a.x + t * dx, y: a.y + t * dy }); };
const minDist = (pts, P) => { let m = Infinity; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, segD(P, pts[i], pts[i + 1])); return m; };   // 점열(조밀 샘플)까지의 최소 거리
const rotP = (p, c, a) => ({ x: c.x + (p.x - c.x) * Math.cos(a) - (p.y - c.y) * Math.sin(a), y: c.y + (p.x - c.x) * Math.sin(a) + (p.y - c.y) * Math.cos(a) });
const segsRole = (g, r) => g.outline.filter(s => s.role === r);
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((cr(c, d, a) > 0) !== (cr(c, d, b) > 0)) && ((cr(a, b, c) > 0) !== (cr(a, b, d) > 0));
function ringOf(g) {   // 독립 외곽 점열: 소매산 cubic 80분할 + 나머지 선 끝점
  const ring = []; capCubics(g).forEach((q, qi) => { for (let i = qi ? 1 : 0; i <= 80; i++) ring.push(cubicPt(q, i / 80)); });
  g.outline.slice(1).forEach(s => ring.push(s.to)); return ring;
}
function selfX(ring) { for (let i = 0; i < ring.length - 1; i++) for (let j = i + 2; j < ring.length - 1; j++) { if (i === 0 && j === ring.length - 2) continue; if (xseg(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true; } return false; }

// ── 1. API ──
ok(typeof SB.draftSleeveB === "function" && typeof SB.readSleeveA === "function" && Object.isFrozen(SB) && SB.RULES.hemRatio === 0.75 && SB.RULES.palmAllowanceCm === 3, "1: API·frozen·잠긴 상수(3/4 · 손바닥+3)");

// ── 2. B83 Ⓐ → Ⓑ 수치 ──
const BA = bodiceResultOf("A");
const DA = SA.draftSleeveA(BA, { sleeveLengthCm: 52, elbowLengthCm: 31 });
ok(DA.ok, "2: 출발 Ⓐ 생성");
const A_JSON = J(DA), A_HASH = hashStr(J({ geometry: DA.geometry, meta: DA.meta }));
const AF = deepFreeze(JSON.parse(A_JSON));
const R = SB.draftSleeveB(AF);
ok(R.ok && Array.isArray(R.warnings) && R.warnings.length === 0, "2: 동결된 Ⓐ 입력으로 Ⓑ 성공(손바닥 없음 → 경고 없음)");
const M = R.meta, G = R.geometry, Wd = DA.meta.bicepCm;
ok(near(Wd, 32.066, 0.001) && near(M.widthCm, Wd, 1e-12), "2: W = Ⓐ 아랫점 사이 소매폭 = 32.066(Ⓐ 아랫점 간격에서 독립 재계산)");
{ const ub = DA.meta.underarm.after; ok(near(Wd, ub.front.x - ub.back.x, 1e-12), "2: W = 앞 아랫점 x − 뒤 아랫점 x"); }
ok(near(M.hemTargetCm, Wd * 0.75, 1e-12) && near(M.closeTotalCm, Wd / 4, 1e-12) && near(M.closePerCutCm, Wd / 8, 1e-12), "2: 목표 소맷부리 = W×3/4 · 총 맞댐량 W/4 · 절개당 W/8");
// 소맷부리 길이: 출력 윤곽의 소맷부리선 변을 독립으로 합산
const hemSegs = ["hem-front", "hem-center", "hem-back"].map(r => segsRole(G, r));
ok(hemSegs.every(a => a.length === 1), "2: 소맷부리선 변 = 앞 바깥 · 중심 · 뒤 바깥 (각 1개)");
{
  const hemLen = hemSegs.reduce((s, a) => s + D(a[0].from, a[0].to), 0);
  ok(near(hemLen, Wd * 0.75, 1e-9) && near(M.hemCm, hemLen, 1e-12), `2: 소맷부리선 변 길이 합 = W×3/4 = ${(Wd * 0.75).toFixed(4)} (독립 합산 ${hemLen.toFixed(4)})`);
  ok(near(D(hemSegs[1][0].from, hemSegs[1][0].to), Wd / 2, 1e-9), "2: 중심 조각 소맷부리 = W/2(고정 — 반폭 중점 사이 간격)");
  ok(near(M.hemChordCm, D(segsRole(G, "hem-back")[0].to, segsRole(G, "hem-front")[0].from), 1e-12) && M.hemChordCm < Wd * 0.75 && M.hemChordCm > Wd * 0.75 - 0.2, "2: 바깥 모서리 직선 간격(hemChord)은 기울기 때문에 3/4 보다 조금 작다(관찰값)");
}
// 절개: 기본 기준 = 앞·뒤 각 반폭의 중점
const cb = M.cuts.back, cf = M.cuts.front;
ok(M.axisBasis === undefined && near(cb.axisX, -8.53, 0.005) && near(cf.axisX, 7.50, 0.005) && near(cb.axisX, DA.meta.underarm.after.back.x / 2, 1e-12) && near(cf.axisX, DA.meta.underarm.after.front.x / 2, 1e-12), "2: 절개축 x = 앞·뒤 각 반폭의 중점 — B83 뒤 −8.53 / 앞 +7.50(근사)·반폭 정확히 1/2");
ok(near(cb.closeAtHemCm, Wd / 8, 1e-12) && near(cf.closeAtHemCm, Wd / 8, 1e-12) && near(cb.closeAtHemCm + cf.closeAtHemCm, Wd / 4, 1e-12), "2: 양쪽 맞댐량 각 W/8 · 합 W/4");
{
  // 교점은 Ⓐ 소매산 곡선 위 · 절개축 x 위 · 축은 소맷부리까지 수직
  const aPts = densePts(capCubics(DA.geometry), 4000);
  [["back", cb], ["front", cf]].forEach(([k, c]) => {
    ok(minDist(aPts, c.pivot) < 1e-3 && near(c.pivot.x, c.axisX, 1e-9), `2: ${k} 교점 P 는 Ⓐ 소매산 곡선 위이고 절개축 x 위`);
    ok(near(c.axisLengthCm, 52 - c.pivot.y, 1e-12) && c.pivot.y > 0 && c.pivot.y < DA.meta.capHeightCm, `2: ${k} 절개축 = P → 소맷부리 y=52 (길이 ${c.axisLengthCm.toFixed(3)}, P 는 SP 아래·아랫점 위)`);
    ok(near(Math.abs(c.wedgeHem.onLeg.x - c.wedgeHem.onAxis.x), Wd / 8, 1e-12) && c.wedgeHem.onLeg.y === 52 && c.wedgeHem.onAxis.y === 52, `2: ${k} 쐐기 = 소맷부리선 위 폭 W/8`);
    // 강체 회전각 = 쐐기 변이 절개축과 겹치는 각 → tan = (W/8)/R
    ok(near(Math.abs(c.angleRad), Math.atan((Wd / 8) / c.axisLengthCm), 1e-12), `2: ${k} 회전각 = atan((W/8)/축 길이) = ${Math.abs(c.angleDeg).toFixed(3)}°`);
    // 쐐기 변을 회전하면 절개축 위에 놓인다(닫힘)
    const leg = rotP(c.wedgeHem.onLeg, c.pivot, c.angleRad); ok(near(leg.x, c.axisX, 1e-9) && D(leg, c.wedgeLegRotated) < 1e-9, `2: ${k} 회전한 쐐기 변이 절개축과 겹친다(닫힘)`);
  });
  ok(cb.angleRad < 0 && cf.angleRad > 0, "2: 회전 방향 — 뒤 −(반시계 아님) / 앞 +, 서로 반대(바깥 조각이 중심 쪽으로)");
}
// 절개축 규칙은 하나뿐이다 — 공개 옵션 없음. 예전 axisBasis 인자는 무시되고(알 수 없는 params) 결과는 기본과 동일하다.
{
  const ignored = SB.draftSleeveB(AF, { axisBasis: "quarter-width" });
  ok(ignored.ok && J(ignored.geometry) === J(G) && near(ignored.meta.cuts.back.axisX, cb.axisX, 1e-12), "2: axisBasis 같은 선택 인자는 없다(무시 — 결과 불변, quarter-width 분기 없음)");
  ok(Math.abs(Math.abs(cb.axisX) - Wd / 4) > 0.3 && Math.abs(Math.abs(cf.axisX) - Wd / 4) > 0.3, "2: 뒤가 더 넓은 Ⓐ 라 ±W/4(±8.017)와 0.5cm 다르다 — 반폭 중점이 기준");
  ok(near(D(segsRole(G, "hem-center")[0].from, segsRole(G, "hem-center")[0].to), Wd / 2, 1e-9), "2: 반폭 중점이면 앞뒤가 달라도 중심 소맷부리는 W/2");
}

// ── 3. 보존: 소매산 길이·이세 · 밑선 · 중심 조각 · 바깥 조각 강체 ──
{
  const aCubs = capCubics(DA.geometry), oCubs = capCubics(G), sp = DA.meta.capSplit.anchorIndex;
  const aBack = denseLen(aCubs.slice(0, sp)), aFront = denseLen(aCubs.slice(sp));
  const oSp = M.capSplit.anchorIndex, oBack = denseLen(oCubs.slice(0, oSp)), oFront = denseLen(oCubs.slice(oSp));
  ok(D(oCubs[oSp - 1][3], { x: 0, y: 0 }) < 1e-12 && D(oCubs[oSp][0], { x: 0, y: 0 }) < 1e-12, "3: capSplit.anchorIndex = SP(0,0) 앵커");
  ok(near(oBack, aBack, 1e-4) && near(oFront, aFront, 1e-4), `3: 앞·뒤 소매산 길이 보존(뒤 ${aBack.toFixed(4)}→${oBack.toFixed(4)} · 앞 ${aFront.toFixed(4)}→${oFront.toFixed(4)})`);
  ok(near(M.capLengths.back, oBack, 1e-4) && near(M.capLengths.front, oFront, 1e-4), "3: meta.capLengths = 독립 조밀 측정");
  const ah = DA.meta.armholeCm;
  ok(near(oBack - ah.back, DA.meta.easeAfter.back, 1e-4) && near(oFront - ah.front, DA.meta.easeAfter.front, 1e-4), "3: 앞·뒤 이세 = Ⓐ 이세 그대로(뒤 1.268 · 앞 0.844)");
  ok(near(M.easeAfter.back, oBack - ah.back, 1e-4) && near(M.easeAfter.total, oBack + oFront - ah.back - ah.front, 1e-4), "3: meta.easeAfter = 독립 이세");
  // 밑선 길이: 앞뒤 같고 Ⓐ 와 같다
  const sb = segsRole(G, "side-seam-back")[0], sf = segsRole(G, "side-seam-front")[0];
  ok(near(D(sb.from, sb.to), 52 - DA.meta.capHeightCm, 1e-9) && near(D(sf.from, sf.to), 52 - DA.meta.capHeightCm, 1e-9) && near(D(sb.from, sb.to), D(sf.from, sf.to), 1e-12), "3: 앞·뒤 밑선 길이 = Ⓐ 밑선(52−13.648=38.352) 그대로·서로 같음");
  ok(near(M.seamLengthsCm.back, M.seamLengthsCm.backBefore, 1e-9) && near(M.seamLengthsCm.front, M.seamLengthsCm.frontBefore, 1e-9), "3: meta.seamLengthsCm 전후 동일");
  // 중심 조각 불변 — Ⓐ 소매산 중 두 교점 사이 점 전부가 출력에 그대로 있다
  const oPts = densePts(oCubs, 800), aMid = densePts(aCubs, 800).filter(p => p.x >= cb.axisX - 1e-9 && p.x <= cf.axisX + 1e-9);
  ok(aMid.length > 100 && aMid.every(p => minDist(oPts, p) < 1e-3), "3: 중심 조각(두 절개축 사이) 소매산 곡선은 Ⓐ 와 동일(고정)");
  // 바깥 조각 = Ⓐ 곡선을 P 둘레로 angle 만큼 강체 회전
  const aBackOuter = densePts(aCubs, 800).filter(p => p.x <= cb.axisX), aFrontOuter = densePts(aCubs, 800).filter(p => p.x >= cf.axisX);
  ok(aBackOuter.every(p => minDist(oPts, rotP(p, cb.pivot, cb.angleRad)) < 1e-3) && aFrontOuter.every(p => minDist(oPts, rotP(p, cf.pivot, cf.angleRad)) < 1e-3), "3: 바깥 소매산 조각 = Ⓐ 를 교점 P 둘레로 강체 회전한 것(재평활 없음)");
  ok(near(D(sb.to, sb.from), D(DA.geometry.outline[1].from, DA.geometry.outline[1].to), 1e-9) && D(sb.to, rotP(DA.meta.underarm.after.back, cb.pivot, cb.angleRad)) < 1e-9 && D(sf.from, rotP(DA.meta.underarm.after.front, cf.pivot, cf.angleRad)) < 1e-9, "3: 아랫점·소맷부리 모서리도 같은 강체 회전");
  // 결 방향: 중심선 수직 · 소매산 최고점 SP · 중심 소맷부리 수평
  const cl = G.construction.find(s => s.role === "center-line"), hc = segsRole(G, "hem-center")[0];
  ok(cl.from.x === 0 && cl.to.x === 0 && cl.from.y === 0 && cl.to.y === 52 && M.checks.centerLineVertical, "3: 결 방향 중심선 수직 (0,0)→(0,52)");
  ok(hc.from.y === 52 && hc.to.y === 52 && D(M.sp, { x: 0, y: 0 }) === 0 && oPts.every(p => p.y >= -1e-9), "3: 중심 소맷부리 수평 · SP 가 소매산 최고점");
  // 회전 부산물(관찰값): 모서리·아랫점이 내려가는 양 · 단차
  ok(cb.outerHemCornerDropCm > 0 && cf.outerHemCornerDropCm > 0 && cb.underarmDropCm > 0 && cf.underarmDropCm > 0 && cb.hemStepCm > 0 && cf.hemStepCm < 0.3, "3: 관찰값 — 바깥 모서리 ≈0.5cm·아랫점 ≈0.7cm 아래로, 단차 ≈0.17cm(강체 회전의 귀결)");
  ok(near(cb.hemStepCm, cb.axisLengthCm * (1 / Math.cos(cb.angleRad) - 1), 1e-9), "3: 단차 = R(secθ−1)");
}

// ── 4. 위상: 폐곡선 · 연속 · 자기교차 없음 · 절개 흔적 없음 ──
{
  ok(M.checks.closed && M.checks.connected && M.checks.maxGapCm < 1e-9 && !M.checks.selfIntersection, "4: meta.checks — 닫힘·연결·자기교차 없음");
  const o = G.outline, cubs = capCubics(G);
  ok(o[0].kind === "path" && o.slice(1).every(s => s.kind === "line"), "4: outline[0] = 소매산 path · 나머지 직선");
  let gapMax = 0; for (let i = 1; i < cubs.length; i++) gapMax = Math.max(gapMax, D(cubs[i - 1][3], cubs[i][0]));
  let prev = cubs[cubs.length - 1][3]; o.slice(1).forEach(s => { gapMax = Math.max(gapMax, D(prev, s.from)); prev = s.to; }); gapMax = Math.max(gapMax, D(prev, cubs[0][0]));
  ok(gapMax < 1e-9, "4: 독립 검사 — cubic 연쇄·선 연쇄가 끊김 없이 한 바퀴 닫힌다");
  ok(!selfX(ringOf(G)), "4: 독립 자기교차 검사 — 교차 없음");
  // 폭 0 절개 흔적: 길이 0 선 없음 · 서로 정확히 되돌아가는(왕복) 선 쌍 없음 · 절개 role 은 outline 에 없다
  const lines = o.slice(1);
  ok(lines.every(s => D(s.from, s.to) > 1e-9), "4: 길이 0 선 없음");
  ok(lines.every((s, i) => lines.every((t, j) => i === j || !(D(s.from, t.to) < 1e-9 && D(s.to, t.from) < 1e-9))), "4: 왕복(a→b / b→a) 중복 선 없음 — 닫힌 절개 흔적이 남지 않는다");
  ok(o.every(s => !/cut/.test(s.role || "")) && o.length === 8, "4: outline = 소매산 + 밑선 2 + 소맷부리 바깥 2 · 중심 1 · 단차 2 (절개 선 없음)");
  const cons = G.construction;
  ok(["cut-axis-back", "cut-axis-front", "cut-leg-back", "cut-leg-front", "center-line"].every(r => cons.some(s => s.role === r)), "4: 절개축·쐐기 변은 construction 으로만 보존");
  const ax = cons.find(s => s.role === "cut-axis-front"); ok(D(ax.from, cf.pivot) < 1e-12 && ax.to.y === 52 && near(ax.to.x, ax.from.x, 1e-9), "4: cut-axis-front = P → 소맷부리 수직");
  // 단차는 절개축 위의 수직선(실제 윤곽): 축 위에 있는지
  const st = segsRole(G, "hem-step-front")[0]; ok(st && Math.abs(st.from.x - cf.axisX) < 1e-9 && Math.abs(st.to.x - cf.axisX) < 1e-9 && st.to.y === 52 && st.from.y > 52, "4: hem-step 은 절개축 위 수직 짧은 선(소맷부리 윤곽)");
}

// ── 5. 손바닥 둘레(선택 입력) ──
{
  const hemT = Wd * 0.75;   // 24.0496
  const none = SB.draftSleeveB(AF), p0 = SB.draftSleeveB(AF, { palmCircumferenceCm: null }), p1 = SB.draftSleeveB(AF, { palmCircumferenceCm: "" }), p2 = SB.draftSleeveB(AF, { palmCircumferenceCm: undefined });
  ok(none.ok && p0.ok && p1.ok && p2.ok && none.meta.palm === null && J(none.geometry) === J(p0.geometry) && J(none.geometry) === J(p1.geometry) && p0.warnings.length === 0, "5: 비어 있으면(없음/null/\"\"/undefined) 3/4 규칙만 — palm=null · 경고 없음");
  const lo = SB.draftSleeveB(AF, { palmCircumferenceCm: 22 });   // 22+3 = 25 > 24.0496 → 경고
  ok(lo.ok && lo.warnings.length === 1 && lo.warnings[0] === "hem-below-palm-allowance" && lo.meta.palm.satisfied === false && near(lo.meta.palm.minHemCm, 25, 1e-12) && near(lo.meta.palm.shortfallCm, 25 - hemT, 1e-9), "5: 목표 소맷부리 < 손바닥+3cm → 경고만(shortfall 0.950)");
  ok(J(lo.geometry) === J(none.geometry) && near(lo.meta.hemCm, hemT, 1e-9) && near(lo.meta.hemTargetCm, hemT, 1e-12), "5: 경고여도 형상·소맷부리는 자동 보정하지 않는다(3/4 그대로)");
  const hi = SB.draftSleeveB(AF, { palmCircumferenceCm: 20 });   // 23 ≤ 24.0496
  ok(hi.ok && hi.warnings.length === 0 && hi.meta.palm.satisfied === true && hi.meta.palm.shortfallCm === 0 && J(hi.geometry) === J(none.geometry), "5: 충족이면 경고 없음(palm 기록만)");
  ok(SB.draftSleeveB(AF, { palmCircumferenceCm: hemT - 3 - 1e-6 }).warnings.length === 0 && SB.draftSleeveB(AF, { palmCircumferenceCm: hemT - 3 + 1e-6 }).warnings.length === 1, "5: 경계(palm+3 = 소맷부리) — 정확히 같거나 큰 쪽은 충족");
  [0, -3, NaN, Infinity, "abc", {}, [], true].forEach(v => { const r = SB.draftSleeveB(AF, { palmCircumferenceCm: v }); ok(!r.ok && r.reason === "invalid-palm-circumference", `5: 잘못된 손바닥 입력 ${J(v)} → invalid-palm-circumference`); });
}

// ── 6. 입력 불변 · 반환 독립 · ◎ 미생성 ──
{
  ok(J(AF) === A_JSON && hashStr(J({ geometry: AF.geometry, meta: AF.meta })) === A_HASH, "6: 동결 Ⓐ 입력 JSON·hash 불변");
  ok(R.sourceSleeveAHash === A_HASH, "6: sourceSleeveAHash = 입력 Ⓐ {geometry,meta} hash(복사만)");
  const clone = JSON.parse(A_JSON), r2 = SB.draftSleeveB(clone);
  r2.geometry.outline[0].commands[1].points[0].x += 99; r2.geometry.construction.length = 0; r2.meta.cuts.back.pivot.x += 5; r2.meta.sp.x += 1;
  ok(J(clone) === A_JSON, "6: 반환 객체를 변형해도 입력 Ⓐ 는 그대로(공유 참조 없음)");
  const r3 = SB.draftSleeveB(JSON.parse(A_JSON)), r4 = SB.draftSleeveB(JSON.parse(A_JSON));
  ok(J(r3) === J(r4), "6: 결정적 — 같은 입력 같은 출력");
  ok(M.fitMarks === null && !G.outline.concat(G.construction).some(s => /notch|mark|fit/.test(s.role || "")), "6: ◎ 맞춤표시는 만들지 않는다(후속 UI/표시 판단)");
}

// ── 7. 명시적 실패(폴백 없음) ──
{
  const bad = (mut, why) => { const c = JSON.parse(A_JSON); mut(c); return SB.draftSleeveB(c); };
  ok(SB.draftSleeveB(null).reason === "no-sleeve-a" && SB.draftSleeveB(undefined).reason === "no-sleeve-a" && SB.draftSleeveB({ ok: false, reason: "x" }).reason === "no-sleeve-a", "7: Ⓐ 없음/실패 → no-sleeve-a");
  ok(bad(c => { c.geometry.outline.pop(); }).reason === "invalid-sleeve-a", "7: outline 구조 불량 → invalid-sleeve-a");
  ok(bad(c => { c.meta.sp = { x: 0.5, y: 0 }; }).reason === "invalid-sleeve-a", "7: SP 가 소매산 위에 없음 → invalid-sleeve-a");
  ok(bad(c => { c.geometry.outline[1].to.x += 0.2; }).reason === "invalid-sleeve-a", "7: 밑선이 수직이 아님 → invalid-sleeve-a");
  ok(bad(c => { c.meta.sleeveLengthCm = 53; }).reason === "invalid-sleeve-a", "7: 소매길이 메타와 소맷부리 y 불일치 → invalid-sleeve-a");
  ok(bad(c => { c.meta.bicepCm += 1; }).reason === "invalid-sleeve-a", "7: 소매폭 메타 불일치 → invalid-sleeve-a");
  ok(bad(c => { c.geometry.outline[0].commands[2].points[1].x = NaN; }).reason === "invalid-sleeve-a", "7: 비유한 좌표 → invalid-sleeve-a");
  ok(bad(c => { c.meta.sleeveLengthCm = 13; c.geometry.outline[1].to.y = 13; c.geometry.outline[2].to.y = 13; c.geometry.outline[3].from.y = 13; c.geometry.outline[3].to.y = 13; }).reason === "invalid-sleeve-a", "7: 소맷부리가 아랫점보다 위 → invalid-sleeve-a");
  // 뒤 반폭을 1/10 로 줄이면 바깥 소맷부리 변이 음수(쐐기가 바깥 폭보다 큼)
  const squeeze = (c) => { const k = 0.1, bx = c.geometry.outline[0].commands; const cubsBack = c.meta.capSplit.anchorIndex;
    let idx = 0; const pts = []; bx.forEach((cm, i) => { if (i === 0) pts.push(cm.points[0]); else cm.points.forEach(p => pts.push(p)); });
    pts.forEach((p, i) => { if (i <= cubsBack * 3) p.x *= k; });
    c.geometry.outline[1].from.x *= k; c.geometry.outline[1].to.x *= k; c.meta.sp = { x: 0, y: 0 };
    c.meta.bicepCm = c.geometry.outline[2].from.x - c.geometry.outline[1].from.x; };
  const sq = SB.draftSleeveB((() => { const c = JSON.parse(A_JSON); squeeze(c); return c; })());
  ok(!sq.ok && sq.reason === "closure-exceeds-outer-width" && sq.piece === "back", `7: 바깥 폭 < 쐐기 → closure-exceeds-outer-width (실제 ${sq.reason})`);
  // 짧은 소매 + 넓은 폭 → 회전 한계(30°) 초과
  const DS = SA.draftSleeveA(BA, { sleeveLengthCm: 14.7 }), c3 = JSON.parse(J(DS));
  const wide = (o) => { if (!o) return; if (Array.isArray(o)) o.forEach(wide); else if (typeof o === "object") { if (typeof o.x === "number" && typeof o.y === "number") o.x *= 1.6; else Object.keys(o).forEach(k => wide(o[k])); } };
  wide(c3.geometry); c3.meta.bicepCm *= 1.6; c3.meta.sp = { x: 0, y: 0 };
  const lr = SB.draftSleeveB(c3);
  ok(!lr.ok && lr.reason === "closure-rotation-too-large", `7: 짧은 소매(14.7)+넓은 폭 → closure-rotation-too-large (실제 ${lr.reason})`);
  // 교점 없음/모호: 뒤 소매산 첫 cubic 이 x 방향으로 되접혀 절개축을 여러 번 지나면 모호 거절
  const am = JSON.parse(A_JSON); { const cm = am.geometry.outline[0].commands; cm[1].points[0].x = 20; cm[1].points[1].x = -40; }
  const ar = SB.draftSleeveB(am); ok(!ar.ok && ar.reason === "ambiguous-cap-intersection" && ar.piece === "back" && ar.detail === 3, `7: 소매산이 절개축을 세 번 지나면 ambiguous-cap-intersection (${ar.reason})`);
}

// ── 8. 스윕: 안전성 + 보존(여러 몸판 치수·소매길이·기준) ──
{
  let n = 0, bad = 0, firstBad = null; let maxCapD = 0, maxHemD = 0, maxSeamD = 0, maxDrop = 0, maxAng = 0;
  for (const ahb of [19.5, 20.5, 21.5, 22.5, 23.5]) for (const ahf of [18.5, 19.5, 20.5, 21.5, 22.5]) for (const hb of [16, 18.6, 20.5]) for (const hf of [14.5, 16.4, 19]) for (const sl of [42, 48, 52, 55, 60, 66]) {
    const a = SA.draftFromMeasures({ backAHCm: ahb, frontAHCm: ahf, backShoulderHeightCm: hb, frontShoulderHeightCm: hf }, { sleeveLengthCm: sl });
    if (!a.ok) continue;
    n++;
    const b = SB.draftSleeveB(deepFreeze(JSON.parse(J(a))));
    if (!b.ok) { bad++; if (!firstBad) firstBad = [ahb, ahf, hb, hf, sl, b.reason]; continue; }   // 소매 Ⓐ 가 성공한 치수는 Ⓑ 도 전부 성공해야 한다(거절 허용 없음)
    const m = b.meta, g = b.geometry, W2 = a.meta.bicepCm;
    let good = m.checks.closed && m.checks.connected && !m.checks.selfIntersection && near(m.hemCm, W2 * 0.75, 1e-9) && near(m.closeTotalCm, W2 / 4, 1e-12);
    good = good && near(m.cuts.back.closeAtHemCm + m.cuts.front.closeAtHemCm, W2 / 4, 1e-12);
    good = good && !selfX(ringOf(g));
    const co = capCubics(g), ao = capCubics(a.geometry), spi = m.capSplit.anchorIndex, spa = a.meta.capSplit.anchorIndex;
    const dB = Math.abs(denseLen(co.slice(0, spi)) - denseLen(ao.slice(0, spa))), dF = Math.abs(denseLen(co.slice(spi)) - denseLen(ao.slice(spa)));
    maxCapD = Math.max(maxCapD, dB, dF); good = good && dB < 1e-4 && dF < 1e-4;
    maxHemD = Math.max(maxHemD, Math.abs(m.hemCm - W2 * 0.75));
    const sd = Math.max(Math.abs(m.seamLengthsCm.back - m.seamLengthsCm.backBefore), Math.abs(m.seamLengthsCm.front - m.seamLengthsCm.frontBefore)); maxSeamD = Math.max(maxSeamD, sd); good = good && sd < 1e-9;
    for (let i = 1; i < co.length; i++) if (D(co[i - 1][3], co[i][0]) > 1e-9) good = false;
    if (!co.every(q => q.every(p => isFinite(p.x) && isFinite(p.y)))) good = false;
    maxDrop = Math.max(maxDrop, m.cuts.back.outerHemCornerDropCm, m.cuts.front.outerHemCornerDropCm); maxAng = Math.max(maxAng, Math.abs(m.cuts.back.angleDeg), Math.abs(m.cuts.front.angleDeg));
    if (!good) { bad++; if (!firstBad) firstBad = [ahb, ahf, hb, hf, sl, "invariant"]; }
  }
  ok(bad === 0, `8: 스윕 ${n}건 — 전부 성공 +  폐곡선·연속·자기교차 없음·소맷부리 W×3/4·밑선 길이·소매산 길이 보존 (실패 ${bad} ${firstBad ? J(firstBad) : ""})`);
  ok(n >= 1300, `8: 스윕 규모 ${n}건`);
  ok(maxCapD < 1e-4 && maxHemD < 1e-9 && maxSeamD < 1e-9, `8: 최대 오차 — 소매산 ${maxCapD.toExponential(1)} · 소맷부리 ${maxHemD.toExponential(1)} · 밑선 ${maxSeamD.toExponential(1)}`);
  ok(maxAng < 30 && maxDrop < 2.5, `8: 관찰 — 최대 회전 ${maxAng.toFixed(2)}° · 바깥 모서리 하강 ${maxDrop.toFixed(2)}cm`);
}

console.log(`\n=== designSleeveBCheck: PASS ${PASS} / FAIL ${FAIL} ===`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
