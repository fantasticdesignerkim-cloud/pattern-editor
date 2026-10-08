// ══════════════════════════════════════════════
// designSleeveCCheck.js — js/designSleeveC.js(소매 Ⓒ 엔진 코어, [패턴학교] P.41 하단 뒤 소맷부리 다트) 전용 회귀.
//
//   김님 확정(●:2●:● 우선 · 앞 겹침 치수별 계산 · EL 기본 31.4/수정 · EL 위 반폭 중점 · 앞 처리 후 뒤 다트 역산 · 열린 뒤 다트 · 앞 EL 절개는 겹침) +
//   2026-10-07 승인(앞 소매산 P_f 아래 강체 회전 수용 · 소매산/소맷부리 꺾임 fairing · 소매산 비트 동일 요구는 이 부분에 한해 대체, 길이·이세 보존 유지)을 **최종 geometry** 로 검증한다.
//   수치 오차(호 길이·G1·다리 정합 1e-9)와 형상 편차(raw 강체 결과 대비 fairing 편차 — 기록·한계 분리)를 구분한다.
//   (1) API·상수  (2) 최종 곡선 호 길이로 본 cuff 세 구간  (3) raw 대 최종 꺾임·보정 기록  (4) 소매산 실측·이세  (5) 앞 EL 겹침·독립 합집합  (6) 뒤 열린 다트·닫힘 상태 truing·복원
//   (7) 위상(단일 조각·연속·자기교차·변곡·단차)  (8) EL 파라미터·지원 범위 밖/입력 reason  (9) sweep 6720건
//   node test/harness/designSleeveCCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveC.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SC = W.designSleeveC;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function bodiceResultOf(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// ── 독립 측정(모듈과 다른 구현) ──
const cubicPt = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function pathCubics(cap) { const out = []; let cur = cap.commands[0].points[0]; cap.commands.slice(1).forEach(c => { out.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return out; }
const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); };
const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((cr(c, d, a) > 0) !== (cr(c, d, b) > 0)) && ((cr(a, b, c) > 0) !== (cr(a, b, d) > 0));
function ringOf(g, N = 120) {   // 독립 외곽 점열: 소매산 cubic 120분할 + 나머지 선 끝점
  const ring = []; pathCubics(g.outline[0]).forEach((q, qi) => { for (let i = qi ? 1 : 0; i <= N; i++) ring.push(cubicPt(q, i / N)); });
  g.outline.slice(1).forEach(s => { if (s.kind === "path") pathCubics(s).forEach(q => { for (let i = 1; i <= N / 2; i++) ring.push(cubicPt(q, i / (N / 2))); }); else ring.push(s.to); }); return ring;
}
function selfX(ring) { for (let i = 0; i < ring.length - 1; i++) for (let j = i + 2; j < ring.length - 1; j++) { if (i === 0 && j === ring.length - 2) continue; if (xseg(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true; } return false; }
const area = (ring) => { let s = 0; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; s += a.x * b.y - b.x * a.y; } return s / 2; };
const denseLen = (cubs) => { let t = 0; cubs.forEach(q => { let pr = q[0]; for (let i = 1; i <= 4000; i++) { const p = cubicPt(q, i / 4000); t += D(pr, p); pr = p; } }); return t; };
const byRole = (g, r) => g.outline.filter(s => s.role === r);
const hemSegs = (g) => g.outline.filter(s => /^hem-/.test(s.role || ""));
const hemSum = (g) => hemSegs(g).reduce((a, s) => a + D(s.from, s.to), 0);
// 윤곽 꼭짓점 꺾임(°) — 선↔선 이음. 다트 꼭짓점(두 다리 사이)은 따로 본다.
function turnsDeg(g) { const o = g.outline, out = []; for (let i = 2; i < o.length; i++) { const a = o[i - 1], b = o[i]; const u = { x: a.to.x - a.from.x, y: a.to.y - a.from.y }, v = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
  out.push({ at: a.role + "→" + b.role, deg: Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))))) * 180 / Math.PI }); } return out; }
const isApex = (t) => t.at === "dart-leg-center→dart-leg-outer";
// 소매산 위에서 세로선 x = X 와 만나는 점(독립: 조밀 샘플 + 이분)
function capAtX(cubs, X) { let best = null; cubs.forEach(q => { let pv = cubicPt(q, 0).x - X; for (let s = 1; s <= 2000; s++) { const t1 = s / 2000, cu = cubicPt(q, t1).x - X; if ((pv < 0) !== (cu < 0) && pv !== cu) { let lo = (s - 1) / 2000, hi = t1; for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if ((cubicPt(q, m).x - X < 0) === (pv < 0)) lo = m; else hi = m; } const p = cubicPt(q, lo); if (!best || p.y > best.y) best = p; } pv = cu; } }); return best; }

// ── 독립 보조(모듈과 다른 구현) ──
const pip = (ring, p) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i], b = ring[j]; if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; } return c; };
const distToRing = (ring, p) => { let m = Infinity; for (let i = 0; i < ring.length; i++) m = Math.min(m, segD(p, ring[i], ring[(i + 1) % ring.length])); return m; };
const segD = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0; return D(p, { x: a.x + t * dx, y: a.y + t * dy }); };
const minDistPoly = (poly, p) => { let m = Infinity; for (let i = 0; i < poly.length - 1; i++) m = Math.min(m, segD(p, poly[i], poly[i + 1])); return m; };
const capDense = (aGeom, n = 800) => { const o = []; pathCubics(aGeom.outline[0]).forEach((q, qi) => { for (let i = qi ? 1 : 0; i <= n; i++) o.push(cubicPt(q, i / n)); }); return o; };
const rotAbout = (p, c, g) => ({ x: c.x + (p.x - c.x) * Math.cos(g) - (p.y - c.y) * Math.sin(g), y: c.y + (p.x - c.x) * Math.sin(g) + (p.y - c.y) * Math.cos(g) });
// 앞 바깥 조각을 회전 중심 Q(절개축 위)로 돌려 소맷부리선이 C 를 지나게 하는 각을 이분법으로 직접 푼다(해석식 γ=2atan((aF−●)/D) 를 쓰지 않는다)
function solveFront(Q, aFv, Ufx, hem, u) {
  const C = { x: u, y: hem };
  const sd = (g) => { const A = rotAbout({ x: aFv, y: hem }, Q, g), F = rotAbout({ x: Ufx, y: hem }, Q, g); return ((C.x - A.x) * (F.y - A.y) - (C.y - A.y) * (F.x - A.x)) / D(A, F); };
  let lo = 1e-9, hi = Math.PI / 4; if (sd(lo) * sd(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (sd(lo) * sd(m) <= 0) hi = m; else lo = m; }
  const g = (lo + hi) / 2, A = rotAbout({ x: aFv, y: hem }, Q, g), F = rotAbout({ x: Ufx, y: hem }, Q, g); return { g, A, F, front: D(F, C), lap: D(A, C) };
}
// 독립 합집합: 왼쪽 조각 L(뒤·중앙, 중앙은 EL 아래 사다리꼴, 뒤 다트 노치 포함) ∪ 회전한 앞 바깥 조각 O
function unionPieces(aGeom, mt, EL, g) {
  const u = mt.sections.unitCm, aFv = mt.axes.front.x, aBv = mt.axes.back.x, Ubp = mt.underarm.before.back, Ufp = mt.underarm.before.front, hem = mt.sleeveLengthCm, PFp = mt.axes.front.cap;
  const dense = capDense(aGeom, 40);
  const iSP = dense.findIndex(p => Math.abs(p.x) < 1e-12 && Math.abs(p.y) < 1e-12);
  const iP = dense.findIndex((p, i) => i > iSP && p.x >= aFv);
  const head = dense.slice(0, iP);   // Ub … SP … P_f 직전
  const tailPts = dense.slice(iP);   // P_f 직후 … Uf
  const dEnd = Ubp.x + u;            // 다트 바깥 끝 x
  const Lring = head.concat([PFp, { x: aFv, y: EL }, { x: u, y: hem }, { x: -u, y: hem }, { x: aBv, y: EL }, { x: dEnd, y: hem }, { x: Ubp.x, y: hem }]);
  const Oring = [PFp].concat(tailPts, [{ x: Ufp.x, y: hem }, { x: PFp.x, y: hem }]).map(p => rotAbout(p, PFp, g));
  return { Lring, Oring };
}

// ── 추가 독립 보조 ──
const arcQ = (q, N = 2000) => { const f = (t) => { const u = 1 - t, dx = 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x)), dy = 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y)); return Math.hypot(dx, dy); }; let s = f(0) + f(1); for (let i = 1; i < N; i++) s += f(i / N) * (i % 2 ? 4 : 2); return s / (3 * N); };   // Simpson — 모듈(Gauss-Legendre)과 다른 방법
const segArc = (s) => s.kind === "path" ? pathCubics(s).reduce((a, q) => a + arcQ(q), 0) : D(s.from, s.to);
const angDeg = (u, v) => Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y) * 180 / Math.PI;
const unitV = (a, b) => { const d = D(a, b); return { x: (b.x - a.x) / d, y: (b.y - a.y) / d }; };
const tStart = (s) => { if (s.kind === "line") return unitV(s.from, s.to); const q = pathCubics(s)[0]; return unitV(q[0], q[1]); };
const tEnd = (s) => { if (s.kind === "line") return unitV(s.from, s.to); const cs = pathCubics(s), q = cs[cs.length - 1]; return unitV(q[2], q[3]); };
const roleOf = (s) => s.role || "cap";
function joints(g) { const o = g.outline, out = {}; for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length]; out[roleOf(a) + "→" + roleOf(b)] = angDeg(tEnd(a), tStart(b)); } return out; }
const CORNERS = ["cap→side-seam-front", "side-seam-front→hem-front", "hem-center-fair→dart-leg-center", "dart-leg-center→dart-leg-outer", "dart-leg-outer→hem-back-fair", "hem-back→side-seam-back", "side-seam-back→cap"];
const mirrorV = (p, ax) => ({ x: 2 * ax - p.x, y: p.y });
const kapRuns = (cubs, flat) => { const r = []; cubs.forEach(q => { for (let i = 0; i < 120; i++) { const t = (i + 0.5) / 120, u = 1 - t, dx = 3 * (u * u * (q[1].x - q[0].x) + 2 * u * t * (q[2].x - q[1].x) + t * t * (q[3].x - q[2].x)), dy = 3 * (u * u * (q[1].y - q[0].y) + 2 * u * t * (q[2].y - q[1].y) + t * t * (q[3].y - q[2].y)); const ex = 6 * (u * (q[2].x - 2 * q[1].x + q[0].x) + t * (q[3].x - 2 * q[2].x + q[1].x)), ey = 6 * (u * (q[2].y - 2 * q[1].y + q[0].y) + t * (q[3].y - 2 * q[2].y + q[1].y)); const k = (dx * ey - dy * ex) / Math.pow(Math.hypot(dx, dy), 3), a = Math.abs(k); if (a < 1e-9) continue; const sg = k > 0 ? 1 : -1; if (!r.length || r[r.length - 1].sg !== sg) r.push({ sg, peak: a }); else r[r.length - 1].peak = Math.max(r[r.length - 1].peak, a); } }); return r.filter(x => x.peak >= flat).reduce((m, x) => { if (!m.length || m[m.length - 1].sg !== x.sg) m.push(x); return m; }, []).length - 1; };
const cuffCubics = (g) => ["hem-front-fair", "hem-center-fair", "hem-back-fair"].flatMap(r => segsOf(g, r).flatMap(pathCubics));
const segsOf = (g, role) => g.outline.filter(s => s.role === role);

// ── 1. API ──
ok(typeof SC.draftSleeveC === "function" && typeof SC.readSleeveA === "function" && Object.isFrozen(SC) && Object.isFrozen(SC.RULES), "1: API·frozen");
ok(SC.RULES.defaultElbowLengthCm === 31.4 && SC.RULES.hemRatio === 0.75 && J(SC.RULES.sectionRatio) === "[1,2,1]" && !("frontOverlapCm" in SC.RULES), "1: 상수 — EL 기본 31.4 · 3/4 · 구간 1:2:1 · 앞 겹침 고정값 없음(계산)");
ok(SC.RULES.checkTolCm === 1e-9 && SC.RULES.capLenTolCm === 1e-9 && SC.RULES.g1TolDeg === 1e-9 && SC.RULES.fairLenCm === 2 && SC.RULES.fairRatio === 0.4, "1: 수치 오차 공차 1e-9(구간·다리·길이·G1) — 형상 편차 한계(capDeviationMaxCm/cuffDeviationMaxCm)와 분리");

// ── 2. B83: 최종 곡선의 호 길이로 대조한 cuff 세 구간 ──
const BA = bodiceResultOf("A");
const DA = SA.draftSleeveA(BA, { sleeveLengthCm: 52, elbowLengthCm: 31 });
ok(DA.ok, "2: 출발 Ⓐ 생성");
const A_JSON = J(DA), A_HASH = hashStr(J({ geometry: DA.geometry, meta: DA.meta }));
const AF = deepFreeze(JSON.parse(A_JSON));
const Ub = DA.meta.underarm.after.back, Uf = DA.meta.underarm.after.front, Wd = Uf.x - Ub.x, HEM = 52, unit = Wd * 3 / 16, aF = Uf.x / 2, aB = Ub.x / 2, EL0 = 31.4, Lh0 = HEM - EL0;
const R = SC.draftSleeveC(AF);
ok(R.ok && Array.isArray(R.warnings) && R.warnings.length === 0 && J(DA) === A_JSON, "2: 동결된 Ⓐ 입력으로 Ⓒ 성공(기본 EL 31.4) · 입력 불변");
const G = R.geometry, M = R.meta;
ok(near(M.widthCm, Wd, 1e-12) && near(M.hemTargetCm, Wd * 0.75, 1e-12) && near(M.sections.unitCm, unit, 1e-12) && near(unit, 6.0124, 1e-4) && M.elbowLengthCm === 31.4, "2: W 32.066 · 목표 소맷부리 24.050 · ● 6.012 · EL 31.4(meta 기록)");
const O = G.outline, idx = (r) => O.findIndex(s => s.role === r);
ok(O.length === 11 && idx("hem-front") === 2 && idx("hem-front-fair") === 3 && idx("hem-center") === 4 && idx("hem-center-fair") === 5 && idx("dart-leg-center") === 6 && idx("dart-leg-outer") === 7 && idx("hem-back-fair") === 8 && idx("hem-back") === 9, "2: 윤곽 구성 — 소맷부리 = 직선 · 정리 곡선 · 직선 · 다트 모서리 정리 곡선 · 다리 2개 · 정리 곡선 · 직선");
// 소맷부리 체인(앞 모서리 FP → 다트 모서리 C_b')의 호 길이 / 다트 반대쪽(D_b' → 뒤 모서리 K_b)
const arcToDart = [2, 3, 4, 5].reduce((a, i) => a + segArc(O[i]), 0), arcBackOuter = segArc(O[8]) + segArc(O[9]);
// 앞 경계점: 앞 모서리에서 호 길이 ● 인 점 — 독립 이분
let Bf = null; { let acc = segArc(O[2]); const q = pathCubics(O[3])[0]; let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (acc + arcPart(q, m) < unit) lo = m; else hi = m; } Bf = cubicPt(q, (lo + hi) / 2); }
function arcPart(q, t) { let s = 0, pr = q[0]; const N = 4000; for (let i = 1; i <= N; i++) { const p = cubicPt(q, t * i / N); s += D(pr, p); pr = p; } return s; }
{ const front = unit, center = arcToDart - unit, back = arcBackOuter;
  ok(near(arcToDart, 3 * unit, 1e-9) && near(center, 2 * unit, 1e-9) && near(back, unit, 1e-9) && near(front + center + back, Wd * 0.75, 1e-9), `2: 최종 곡선 호 길이 — 앞 모서리~다트 모서리 ${arcToDart.toFixed(9)} = 3● · 중앙(앞 경계점~다트 모서리) ${center.toFixed(9)} = 2● · 뒤 바깥 ${back.toFixed(9)} = ● · 합 ${(front + center + back).toFixed(9)} = W×3/4`);
  ok(near(M.sections.actual.center, center, 1e-9) && near(M.sections.actual.backOuter, back, 1e-9) && near(arcToDart, M.sections.arcFrontToDartCornerCm, 1e-9) && M.sections.measure === "arc-length(final curve)", "2: 모듈이 기록한 구간 = 독립(Simpson) 호 길이 — 직선 거리로 대체하지 않음");
  const chord = D(O[2].from, segsOf(G, "dart-leg-center")[0].from); ok(chord < arcToDart - 1e-4, `2: 소맷부리가 곡선이다 — 앞 모서리~다트 모서리 직선 거리 ${chord.toFixed(4)} < 호 길이 ${arcToDart.toFixed(4)}(정리 곡선·다트 모서리 높이 차를 직선 거리로 쓰면 틀린다)`); }
ok(D(Bf, M.sections.boundaries.front) < 1e-6 && near(M.sections.boundaryShiftCm.front, D(Bf, { x: unit, y: HEM }), 1e-6), `2: 앞 경계점 = 앞 모서리에서 호 길이 ● 인 점(독립 이분 일치). raw 경계점(C_f)에서 ${M.sections.boundaryShiftCm.front.toFixed(4)}cm — 국소 정리 편차로 기록`);
ok(M.axes.back.x === aB && M.axes.front.x === aF && near(aB, -8.534, 1e-3) && near(aF, 7.499, 1e-3), "2: EL 위 절개축 = 앞·뒤 반폭 중점(뒤 −8.534 · 앞 +7.499)");

// ── 3. raw 강체 결과(감사)와 최종 geometry 분리 · 꺾임 제거 ──
const capCubsA = pathCubics(DA.geometry.outline[0]), PFi = capAtX(capCubsA, aF), PBi = capAtX(capCubsA, aB);
const sol = solveFront(PFi, aF, Uf.x, HEM, unit);
{
  const J1 = joints(G), nonCorner = Object.keys(J1).filter(k => !CORNERS.includes(k)), maxG1 = Math.max(...nonCorner.map(k => J1[k]));
  ok(M.rigid && M.rigid.cap && M.rigid.cap.kind === "path" && near(M.rigid.capKinkDeg, 3.68, 0.01) && near(M.rigid.capKinkDeg, M.front.angleDeg, 1e-6) && near(M.rigid.cuffFrontKinkDeg, sol.g * 180 / Math.PI, 1e-6) && near(M.rigid.cuffDartHemKinkDeg, 13.96, 0.01), `3: raw 강체 결과는 감사용 meta.rigid 로만 남는다 — 전 꺾임: 소매산 P_f ${M.rigid.capKinkDeg.toFixed(2)}° · 소맷부리 앞/중앙 ${M.rigid.cuffFrontKinkDeg.toFixed(2)}° · 다트 닫힘 소맷부리 ${M.rigid.cuffDartHemKinkDeg.toFixed(2)}°`);
  ok(maxG1 < 1e-9 && near(M.checks.maxG1BreakDeg, maxG1, 1e-9) && nonCorner.length === 4, `3: 후 꺾임 — 의도된 모서리 외 모든 이음(${nonCorner.length}곳: 소맷부리 직선↔정리 곡선↔직선 등)의 접선 꺾임 최대 ${maxG1.toExponential(1)}° (독립 atan2 측정)`);
  const capNow = pathCubics(O[0]); let capJ = 0; for (let i = 1; i < capNow.length; i++) capJ = Math.max(capJ, angDeg(unitV(capNow[i - 1][2], capNow[i - 1][3]), unitV(capNow[i][0], capNow[i][1])));
  let capA = 0; for (let i = 1; i < capCubsA.length; i++) capA = Math.max(capA, angDeg(unitV(capCubsA[i - 1][2], capCubsA[i - 1][3]), unitV(capCubsA[i][0], capCubsA[i][1])));
  ok(capJ <= capA + 1e-9 && M.rigid.capKinkDeg > 3 && capJ < 1, `3: 소매산 이음 최대 꺾임 ${capJ.toExponential(2)}° ≤ Ⓐ 자체 ${capA.toExponential(2)}°(+1e-9) — P_f 의 ${M.rigid.capKinkDeg.toFixed(2)}° 꺾임 제거`);
  ok(Object.keys(J1).filter(k => CORNERS.includes(k)).every(k => J1[k] > 60) && J1["dart-leg-center→dart-leg-outer"] > 150, "3: 의도된 모서리(소매산 끝·앞 모서리·다트 노치·뒤 모서리)는 그대로 모서리 — 다트 꼭짓점은 예각 노치");
  ok(near(J1["hem-center-fair→dart-leg-center"], 90, 1e-6) && near(J1["dart-leg-outer→hem-back-fair"], 90, 1e-6) && near(M.back.closedCuff.hemPerpendicularToLegDeg, 90, 1e-6), `3: 다트 모서리에서 소맷부리는 다리에 수직(${J1["hem-center-fair→dart-leg-center"].toFixed(6)}° · ${J1["dart-leg-outer→hem-back-fair"].toFixed(6)}°) — 닫으면 접선이 이어진다`);
  const fr = M.fairing.compensation;
  ok(Math.abs(fr.frontRotationDeltaDeg) < 0.05 && Math.abs(fr.backCornerShiftCm) < 0.5 && fr.iterations < 80 && Math.abs(fr.residualBackCm) < 1e-11 && Math.abs(fr.residualTotalCm) < 1e-11, `3: 곡선 정리가 줄이는 호 길이는 raw 의 두 자유도로 보정 — 앞 회전 ${fr.frontRotationRawDeg.toFixed(4)}° → ${fr.frontRotationDeg.toFixed(4)}°(Δ ${fr.frontRotationDeltaDeg.toExponential(1)}°) · 뒤 가상 모서리 이동 ${fr.backCornerShiftCm.toFixed(4)}cm — 형상 편차이며 수치 오차(잔차 ${fr.residualBackCm.toExponential(1)})와 구분`);
  const fc = M.fairing;
  ok(fc.cap.deviationCm < 0.05 && fc.cuffFront.deviationCm < 0.2 && fc.cuffDart.deviationCm < 0.5 && fc.cap.inflections.after <= fc.cap.inflections.before, `3: 형상 편차(raw 대비 Hausdorff) — 소매산 ${fc.cap.deviationCm.toFixed(4)} · 소맷부리 앞/중앙 ${fc.cuffFront.deviationCm.toFixed(4)} · 다트 모서리 ${fc.cuffDart.deviationCm.toFixed(4)}cm / 새 변곡 없음(소매산 ${fc.cap.inflections.before}→${fc.cap.inflections.after})`);
}

// ── 4. 소매산 실측·이세 ──
{
  const co = pathCubics(O[0]), spi = M.capSplit.anchorIndex;
  ok(J(co.slice(0, spi)) === J(capCubsA.slice(0, spi)) && J(M.sp) === J(DA.meta.sp) && D(co[spi - 1][3], { x: 0, y: 0 }) === 0 && D(co[0][0], Ub) === 0, "4: 뒤 소매산 cubic 전부 · SP(0,0) · 뒤 아랫점은 Ⓐ 와 비트 동일(정리는 앞 P_f 주변만)");
  const sideBack = co.slice(0, spi).reduce((a, q) => a + arcQ(q), 0), sideBackA = capCubsA.slice(0, spi).reduce((a, q) => a + arcQ(q), 0);
  const frontNow = co.slice(spi).reduce((a, q) => a + arcQ(q), 0), frontA = capCubsA.slice(spi).reduce((a, q) => a + arcQ(q), 0);
  ok(near(sideBack, sideBackA, 1e-9) && near(frontNow, frontA, 1e-9), `4: 독립(Simpson) 실측 — 뒤 소매산 ${sideBack.toFixed(9)} = 원본 · 앞 소매산 ${frontNow.toFixed(9)} = 원본 ${frontA.toFixed(9)} (차 ${Math.abs(frontNow - frontA).toExponential(1)})`);
  const ah = DA.meta.armholeCm, easeMeas = { back: sideBack - ah.back, front: frontNow - ah.front, total: sideBack + frontNow - ah.back - ah.front }, easeOrig = { back: sideBackA - ah.back, front: frontA - ah.front, total: sideBackA + frontA - ah.back - ah.front };
  ok(near(easeMeas.total, easeOrig.total, 1e-9) && near(easeMeas.back, easeOrig.back, 1e-9) && near(easeMeas.front, easeOrig.front, 1e-9) && near(M.easeAfter.total, easeMeas.total, 1e-9) && near(M.easeAfter.front, easeMeas.front, 1e-9), `4: 이세 = 최종 곡선 실측(총 ${easeMeas.total.toFixed(6)} · 뒤 ${easeMeas.back.toFixed(6)} · 앞 ${easeMeas.front.toFixed(6)}) — 원본 곡선 실측과 1e-9 이내, meta.easeAfter 는 복사가 아니라 최종 곡선 실측`);
  const vsA = Math.abs(M.easeAfter.total - DA.meta.easeAfter.total);
  ok(vsA <= 5e-5 && near(M.easeCheck.vsSleeveARecordCm, Math.max(Math.abs(M.easeAfter.back - DA.meta.easeAfter.back), Math.abs(M.easeAfter.front - DA.meta.easeAfter.front), vsA), 1e-12) && J(M.easeSourceA) === J(DA.meta.easeAfter), `4: Ⓐ 기록 easeAfter 와의 차 ${vsA.toExponential(1)} — Ⓐ 쪽 표본 길이 측정 오차 수준(수치 오차, 한계 5e-5)이고 Ⓐ 기록은 easeSourceA 로 따로 보존`);
  const f = M.front, rot = rotAbout(Uf, PFi, f.angleRad);
  ok(D(rot, f.underarm) < 1e-9 && D(co[co.length - 1][3], f.underarm) === 0 && near(D(PFi, f.underarm), D(PFi, Uf), 1e-9), "4: 회전 후 앞 아랫점 = Ⓐ 아랫점을 P_f 중심 보정 회전각만큼 돌린 점 — 정리 후에도 그대로(소매산 끝)");
  ok(near(f.seamLengthCm, f.seamLengthBeforeCm, 1e-9) && D(O[1].from, f.underarm) === 0 && D(O[1].to, f.outerCorner) === 0, "4: 앞 옆선은 강체 이동한 한 직선(길이 불변, 재작도 없음)");
}

// ── 5. 앞 EL 겹침 · 내부 경계 · 독립 합집합 ──
{
  const f = M.front, fr = M.fairing.compensation;
  ok(Math.abs(f.pivot.x - aF) < 1e-12 && D(f.pivot, PFi) < 1e-9 && f.overlapSource.indexOf("computed(Of−●)") === 0, "5: 회전 중심 = 앞 절개축 위 끝(소매산 교점), 겹침은 계산값(고정 1cm 아님)");
  ok(near(f.angleRawRad, sol.g, 1e-9) && f.hemLineThroughBoundaryRawCm < 1e-9 && Math.abs(f.angleRad - f.angleRawRad) < 1e-3, `5: raw 회전각 = 독립 수치해(${(sol.g * 180 / Math.PI).toFixed(4)}°) · raw 소맷부리선이 C 를 지남(${f.hemLineThroughBoundaryRawCm.toExponential(1)}) · 정리 보정 후 ${f.angleDeg.toFixed(4)}°`);
  ok(f.lap.gap === false && f.lap.minCm > -1e-9 && f.lap.atElbowXCm > 1.5, `5: 앞 절개축 위 끝~소맷부리 전 구간 겹침(틈 없음) — 최소 ${f.lap.minCm.toExponential(1)} · EL ${f.lap.atElbowXCm.toFixed(3)}cm · 소맷부리 ${f.lap.atHemXCm.toFixed(3)}cm`);
  const ring = ringOf(G), { Lring, Oring } = unionPieces(DA.geometry, M, EL0, sol.g);
  const band = Math.max(M.fairing.cap.deviationCm, M.fairing.cuffFront.deviationCm, M.fairing.cuffDart.deviationCm, M.sections.boundaryShiftCm.front, M.sections.boundaryShiftCm.back, Math.abs(fr.backCornerShiftCm)) + 0.05;
  let n = 0, bad = 0, inN = 0; const bb = ring.reduce((a, p) => ({ x0: Math.min(a.x0, p.x), x1: Math.max(a.x1, p.x), y0: Math.min(a.y0, p.y), y1: Math.max(a.y1, p.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
  for (let x = bb.x0 - 0.5 + 0.0371; x < bb.x1 + 0.5; x += 0.2) for (let y = bb.y0 - 0.5 + 0.0293; y < bb.y1 + 0.5; y += 0.2) {
    const p = { x, y }; if (Math.min(distToRing(Lring, p), distToRing(Oring, p)) < band || distToRing(ring, p) < band) continue;
    n++; const a = pip(ring, p), b = pip(Lring, p) || pip(Oring, p); if (a) inN++; if (a !== b) bad++; }
  ok(bad === 0 && inN > 1000, `5: 정리된 윤곽 = (왼쪽 조각 ∪ 회전한 앞 바깥 조각) — 경계 ${band.toFixed(2)}cm(= 기록된 최대 정리 편차+0.05) 밖 격자 ${n}점(안쪽 ${inN}) 불일치 ${bad}: 종이를 더하거나 빼지 않았다`);
  const cutEdge = G.construction.find(s => s.role === "front-cut-edge-rotated"), cenEdge = G.construction.find(s => s.role === "cut-axis-front-lower");
  const mids = [cutEdge, cenEdge].map(s => ({ x: (s.from.x + s.to.x) / 2, y: (s.from.y + s.to.y) / 2 }));
  ok(mids.every(p => distToRing(ring, p) > 0.5 && pip(ring, p)) && !O.some(s => /lap|cut-edge|overlap/.test(s.role || "")), "5: 겹침 내부 경계(회전한 절개변 · 중앙 조각 앞 변)는 윤곽 안쪽(construction)에만 있고 최종 outline 에 남지 않는다");
}

// ── 6. 뒤 열린 다트 · 닫힘 상태 cuff truing · 열린 평면 복원 ──
{
  const b = M.back, legC = segsOf(G, "dart-leg-center")[0], legO = segsOf(G, "dart-leg-outer")[0], apex = legC.to;
  ok(legC.pair === "elbow-back" && legO.pair === "elbow-back" && O.indexOf(legO) === O.indexOf(legC) + 1 && D(apex, legO.from) === 0 && apex.x === aB && apex.y === EL0, "6: 열린 뒤 다트 두 다리가 윤곽에 연속으로 남는다 — 꼭짓점 = 뒤 절개축 위 EL 점");
  const l1 = D(apex, legC.from), l2 = D(apex, legO.to);
  ok(Math.abs(l1 - l2) <= 1e-9 && near(b.legCenter.lengthCm, l1, 1e-12), `6: 두 다리 길이 같음(차 ${(l1 - l2).toExponential(1)}, 길이 ${l1.toFixed(6)}) — 이세·허용치 불필요`);
  // 평면 열린 다트: 뒤쪽 정리 곡선 = 중앙쪽 정리 곡선의 다트축(x=aB) 거울상
  const cC = pathCubics(O[5])[0], cO = pathCubics(O[8])[0];
  const mirrored = [cC[3], cC[2], cC[1], cC[0]].map(p => mirrorV(p, aB));
  ok(mirrored.every((p, i) => D(p, cO[i]) < 1e-9) && D(legO.to, mirrorV(legC.from, aB)) < 1e-9, "6: 열린 평면에서 뒤쪽 소맷부리 곡선은 중앙쪽의 다트축 거울상(복원 형상 확인)");
  // 닫힘: 뒤 바깥 조각(뒤 소맷부리·뒤 옆선·뒤쪽 소매산 일부)을 꼭짓점 E 중심으로 돌려 다리 2 를 다리 1 에 얹는다
  const ang = angDeg(unitV(apex, legC.from), unitV(apex, legO.to)) * Math.PI / 180;
  const rr = (p, sg) => rotAbout(p, apex, sg * ang); const sg = D(rr(legO.to, 1), legC.from) < D(rr(legO.to, -1), legC.from) ? 1 : -1;
  const closedEnd = rr(legO.to, sg), legDev = Math.max(...[0.25, 0.5, 0.75, 1].map(t => { const q = { x: apex.x + (legO.to.x - apex.x) * t, y: apex.y + (legO.to.y - apex.y) * t }, tc = { x: apex.x + (legC.from.x - apex.x) * t, y: apex.y + (legC.from.y - apex.y) * t }; return D(rr(q, sg), tc); }));
  ok(D(closedEnd, legC.from) <= 1e-9 && legDev <= 1e-9 && near(ang, b.apexAngleRad, 1e-9), `6: 다트 닫힘 — 다리 2 를 ${(ang * 180 / Math.PI).toFixed(4)}° 돌리면 끝점 ${D(closedEnd, legC.from).toExponential(1)} · 다리 전체 ${legDev.toExponential(1)}cm 로 겹쳐 봉제 정합`);
  const outerClosed = pathCubics(O[8]).map(q => q.map(p => rr(p, sg))), centerHalf = pathCubics(O[5]);
  const tc = unitV(centerHalf[0][2], centerHalf[0][3]), to = unitV(outerClosed[0][0], outerClosed[0][1]);
  ok(D(outerClosed[0][0], centerHalf[0][3]) <= 1e-9 && angDeg(tc, to) <= 1e-9, `6: 닫힌 소맷부리 — 중앙쪽·뒤쪽 정리 곡선이 위치 연속(${D(outerClosed[0][0], centerHalf[0][3]).toExponential(1)}) · 접선 꺾임 ${angDeg(tc, to).toExponential(1)}°(raw 닫힘 꺾임 ${M.rigid.cuffDartHemKinkDeg.toFixed(2)}°)`);
  const closedCurve = centerHalf.concat(outerClosed);
  const hemOuterClosed = [segsOf(G, "hem-back")[0]].map(s => ({ from: rr(s.from, sg), to: rr(s.to, sg) }))[0];
  ok(kapRuns(closedCurve, 0) === 0 && angDeg(unitV(outerClosed[0][2], outerClosed[0][3]), unitV(hemOuterClosed.from, hemOuterClosed.to)) <= 1e-9, "6: 닫힌 소맷부리 정리 곡선(두 반쪽)은 변곡 없이 한쪽으로만 휘고 뒤 소맷부리 직선으로 접선 연속");
  ok(M.back.dartWidthAtHemCm > 0.1 && near(M.back.dartWidthAtHemCm, legC.from.x - legO.to.x, 1e-12) && M.back.raw.dartWidthAtHemCm > 0.1, `6: 열린 다트 폭 ${M.back.dartWidthAtHemCm.toFixed(4)}cm(raw ${M.back.raw.dartWidthAtHemCm.toFixed(4)}) > 0 — 닫혀 사라지는 흔적이 아니다`);
  const sneak = SC.draftSleeveC(JSON.parse(A_JSON), { dartWidthCm: 0.3, backDartCm: 9, frontOverlapCm: 3 });
  ok(J(sneak) === J(R), "6: 다트 폭·앞 겹침을 params 로 직접 줄 수 없다(무시 — 계산 전용)");
}

// ── 7. 위상: 단일 조각 · 연속 · 자기교차 · 단차/스파이크/이상 굴곡 ──
{
  let cont = true; for (let i = 1; i < O.length; i++) { const pe = O[i - 1].kind === "path" ? pathCubics(O[i - 1]).slice(-1)[0][3] : O[i - 1].to, st = O[i].kind === "path" ? pathCubics(O[i])[0][0] : O[i].from; if (D(pe, st) !== 0) cont = false; }
  ok(cont && D(O[O.length - 1].to, O[0].commands[0].points[0]) === 0 && M.checks.closed && M.checks.maxGapCm < 1e-9, "7: 폐곡선·끊김 없음(모든 이음 비트 연속, 소매산 시작으로 닫힘)");
  const ring = ringOf(G);
  ok(!selfX(ring) && M.checks.selfIntersection === false && M.checks.singlePiece === true && O[0].kind === "path", "7: 자기교차 없음(독립 점열 검사) · 외곽선 하나(한 조각)");
  ok(O.slice(1).every(s => segArc(s) > 1e-6), "7: 길이 0 선분 없음");
  const cuff = cuffCubics(G); ok(kapRuns(pathCubics(O[3]), 0) === 0 && kapRuns(pathCubics(O[5]), 0) === 0 && kapRuns(pathCubics(O[8]), 0) === 0 && cuff.length === 3, "7: 소맷부리 정리 곡선 3개 모두 변곡 없음(굴곡이 한쪽으로만 — 이상 굴곡 없음)");
  const yMax = Math.max(...cuff.flatMap(q => Array.from({ length: 101 }, (_, i) => cubicPt(q, i / 100).y))); const yMin = Math.min(...cuff.flatMap(q => Array.from({ length: 101 }, (_, i) => cubicPt(q, i / 100).y)));
  ok(yMax <= HEM + 0.5 && yMin >= HEM - 0.5, `7: 소맷부리 정리 곡선의 높이 변화 ${(yMin - HEM).toFixed(3)}~${(yMax - HEM).toFixed(3)}cm — 단차 없음(소맷부리선 ±0.5cm 이내)`);
  const J1 = joints(G); ok(Object.keys(J1).filter(k => CORNERS.includes(k) && k !== "dart-leg-center→dart-leg-outer").every(k => J1[k] <= 150), "7: 의도된 모서리 최대 꺾임 ≤ 150°(다트 꼭짓점 제외) — 스파이크 없음");
  const ringA = capDense(DA.geometry, 120).concat([{ x: Uf.x, y: HEM }, { x: Ub.x, y: HEM }]);
  ok(Math.sign(area(ring)) === Math.sign(area(ringA)) && Math.abs(area(ring)) < Math.abs(area(ringA)) && Math.abs(area(ring)) > 0.7 * Math.abs(area(ringA)), `7: 면적 부호가 Ⓐ 와 같고 Ⓐ 보다 작다(좁아짐·다트) — ${Math.abs(area(ring)).toFixed(1)} vs ${Math.abs(area(ringA)).toFixed(1)}`);
  ok(J(DA) === A_JSON && hashStr(J({ geometry: DA.geometry, meta: DA.meta })) === A_HASH && R.sourceSleeveAHash === A_HASH, "7: 입력 Ⓐ 불변(deep-freeze 통과·hash 동일) · sourceSleeveAHash = 입력 hash(독립 계산 일치)");
  const r2 = SC.draftSleeveC(JSON.parse(A_JSON)); ok(J(r2) === J(R), "7: 결정적(같은 입력 → 같은 출력)");
  const mut = SC.draftSleeveC(JSON.parse(A_JSON)); mut.geometry.outline[0].commands[1].points[0].x = 999; mut.meta.rigid.cap.commands[1].points[0].x = 999; mut.meta.axes.back.x = 999;
  ok(J(SC.draftSleeveC(JSON.parse(A_JSON))) === J(R) && J(DA) === A_JSON, "7: 반환 변경이 입력/다음 결과에 영향 없음(공유 참조 없음)");
}

// ── 8. EL 파라미터 · 지원 범위 밖 · 입력 reason ──
{
  const rs = (p) => SC.draftSleeveC(JSON.parse(A_JSON), p);
  for (const el of [29, 30, 33]) { const r = rs({ elbowLengthCm: el }); let okc = r.ok;
    if (okc) { const g = r.geometry, o = g.outline, a2 = [2, 3, 4, 5].reduce((a, i) => a + segArc(o[i]), 0), ab = segArc(o[8]) + segArc(o[9]); okc = near(a2, 3 * unit, 1e-9) && near(ab, unit, 1e-9) && !selfX(ringOf(g)) && r.meta.axes.back.elbow.y === el && g.construction.find(s => s.role === "elbow-line").from.y === el && Math.abs(segsOf(g, "dart-leg-center")[0].to.y - el) < 1e-12 && Math.abs(D(segsOf(g, "dart-leg-center")[0].to, segsOf(g, "dart-leg-center")[0].from) - D(segsOf(g, "dart-leg-outer")[0].from, segsOf(g, "dart-leg-outer")[0].to)) <= 1e-9; }
    ok(okc, `8: EL ${el} — 호 길이 구간(3● · ●)·자기교차 없음·다리 길이 같음·EL 선/다트 꼭짓점 이동`); }
  ok(J(rs({ elbowLengthCm: null })) === J(R) && J(rs({ elbowLengthCm: 31.4 })) === J(R) && J(rs({})) === J(R), "8: EL 생략/null/31.4 는 같은 기본값");
  ok(["abc", NaN, -1, 0, Infinity].every(v => rs({ elbowLengthCm: v }).reason === "invalid-elbow-length"), "8: 잘못된 EL(비수치·NaN·≤0·∞) → invalid-elbow-length");
  ok(rs({ elbowLengthCm: 51.5 }).reason === "elbow-too-close-to-hem" && rs({ elbowLengthCm: 8 }).reason === "elbow-above-underarm", "8: EL 소맷부리에 근접 / 아랫점·소매산 교점 위 → 각각 명시 reason");
  const bad = (mut) => { const c = JSON.parse(A_JSON); mut(c); return SC.draftSleeveC(c); };
  ok(SC.draftSleeveC(null).reason === "no-sleeve-a" && SC.draftSleeveC({ ok: false, reason: "x" }).reason === "no-sleeve-a", "8: Ⓐ 없음/실패 → no-sleeve-a");
  ok(bad(c => { c.geometry.outline.pop(); }).reason === "invalid-sleeve-a" && bad(c => { c.meta.sp = { x: 0.5, y: 0 }; }).reason === "invalid-sleeve-a" && bad(c => { c.geometry.outline[1].to.x += 0.2; }).reason === "invalid-sleeve-a" && bad(c => { c.meta.bicepCm += 1; }).reason === "invalid-sleeve-a", "8: Ⓐ 구조 불량 → invalid-sleeve-a");
  const frontScale = (k) => { const c = JSON.parse(A_JSON), sp = c.meta.capSplit.anchorIndex, cm = c.geometry.outline[0].commands;
    cm.forEach((q, i) => { if (i > sp) q.points.forEach(p => { p.x *= k; }); });
    c.geometry.outline[2].from.x *= k; c.geometry.outline[2].to.x *= k; c.meta.bicepCm = c.geometry.outline[2].from.x - c.geometry.outline[1].from.x; return c; };
  const neg = SC.draftSleeveC(frontScale(0.5));
  ok(!neg.ok && neg.reason === "front-overlap-negative" && neg.outOfSupportedRange === true && neg.detail < 0 && !("geometry" in neg), `8: 겹침 계산이 음수(${neg.detail !== undefined ? neg.detail.toFixed(3) : "?"}cm)인 치수 → front-overlap-negative(지원 범위 밖) — 벌림으로 자동 변환 없음·윤곽 없음`);
}

// ── 9. sweep ──
{
  const OUT = ["front-overlap-negative", "front-overlap-zero", "front-rotation-too-large", "dart-negative", "dart-degenerate", "dart-angle-too-large"];
  let n = 0, okN = 0, bad = 0, firstBad = null, gridN = 0, gridBad = 0; const outReasons = {};
  const mx = { g: 0, ap: 0, lapMin: Infinity, lapMax: 0, minLapProfile: Infinity, secErr: 0, backErr: 0, legErr: 0, closeErr: 0, perpErr: 0, g1: 0, capDev: 0, fDev: 0, dDev: 0, shF: 0, shB: 0, dGam: 0, easeA: 0, easeSelf: 0, capLen: 0, seamErr: 0, dartMin: Infinity, dartMax: 0, corner: 0, yDev: 0 };
  for (const ahb of [19.5, 20.5, 21.5, 22.5, 23.5]) for (const ahf of [18.5, 19.5, 20.5, 21.5, 22.5]) for (const hb of [16, 18.6, 20.5]) for (const hf of [14.5, 16.4, 19]) for (const sl of [42, 48, 52, 55, 60, 66]) {
    const a = SA.draftFromMeasures({ backAHCm: ahb, frontAHCm: ahf, backShoulderHeightCm: hb, frontShoulderHeightCm: hf }, { sleeveLengthCm: sl });
    if (!a.ok) continue;
    const aj = J(a), ah = hashStr(J({ geometry: a.geometry, meta: a.meta })), af = deepFreeze(JSON.parse(aj));
    for (const el of [28, 29.5, 31.4, 33, 35]) {
      n++;
      const c = SC.draftSleeveC(af, { elbowLengthCm: el });
      if (!c.ok) { outReasons[c.reason] = (outReasons[c.reason] || 0) + 1; if (!OUT.includes(c.reason) || c.outOfSupportedRange !== true && /overlap|dart-(neg|deg|angle)/.test(c.reason) || "geometry" in c) { bad++; if (!firstBad) firstBad = [ahb, ahf, hb, hf, sl, el, c.reason, c.detail]; } continue; }
      okN++;
      const ub = a.meta.underarm.after.back, uf = a.meta.underarm.after.front, W2 = uf.x - ub.x, u = W2 * 3 / 16, aFv = uf.x / 2, aBv = ub.x / 2, g = c.geometry, m = c.meta, o = g.outline;
      let good = J(a) === aj && c.sourceSleeveAHash === ah && J(m.easeSourceA) === J(a.meta.easeAfter);
      const capA = pathCubics(a.geometry.outline[0]), Pf = capAtX(capA, aFv), s = solveFront(Pf, aFv, uf.x, sl, u); good = good && !!s;
      if (s) { mx.solveErr = Math.max(mx.solveErr || 0, Math.abs(s.g - m.front.angleRawRad)); good = good && Math.abs(s.g - m.front.angleRawRad) < 1e-9; mx.dGam = Math.max(mx.dGam, Math.abs(m.front.angleRad - m.front.angleRawRad)); }
      // cuff 세 구간(최종 곡선 호 길이, 독립 Simpson)
      const a3 = [2, 3, 4, 5].reduce((q, i) => q + segArc(o[i]), 0), ab = segArc(o[8]) + segArc(o[9]);
      mx.secErr = Math.max(mx.secErr, Math.abs(a3 - 3 * u), Math.abs(ab - u), Math.abs(a3 + ab - W2 * 0.75)); good = good && Math.abs(a3 - 3 * u) <= 1e-9 && Math.abs(ab - u) <= 1e-9 && Math.abs(a3 + ab - W2 * 0.75) <= 1e-9;
      const lc = segsOf(g, "dart-leg-center")[0], lo = segsOf(g, "dart-leg-outer")[0], l1 = D(lc.to, lc.from), l2 = D(lo.from, lo.to);
      mx.legErr = Math.max(mx.legErr, Math.abs(l1 - l2)); mx.closeErr = Math.max(mx.closeErr, m.back.closeGapCm); mx.perpErr = Math.max(mx.perpErr, Math.abs(m.back.closedCuff.hemPerpendicularToLegDeg - 90));
      const dw = lc.from.x - lo.to.x; mx.dartMin = Math.min(mx.dartMin, dw); mx.dartMax = Math.max(mx.dartMax, dw);
      good = good && Math.abs(l1 - l2) <= 1e-9 && m.back.closeGapCm <= 1e-9 && Math.abs(m.back.closedCuff.hemPerpendicularToLegDeg - 90) <= 1e-6 && m.back.closedCuff.hemKinkAfterDeg <= 1e-9 && lc.to.x === aBv && lc.to.y === el && dw > 0.1;
      const cC = pathCubics(o[5])[0], cO = pathCubics(o[8])[0], mir = [cC[3], cC[2], cC[1], cC[0]].map(p => mirrorV(p, aBv)); good = good && mir.every((p, i) => D(p, cO[i]) < 1e-9);
      // G1 / 코너
      const J1 = joints(g), mg1 = Math.max(...Object.keys(J1).filter(k => !CORNERS.includes(k)).map(k => J1[k])); mx.g1 = Math.max(mx.g1, mg1); good = good && mg1 < 1e-9;
      const cn = Math.max(...Object.keys(J1).filter(k => CORNERS.includes(k) && k !== "dart-leg-center→dart-leg-outer").map(k => J1[k])); mx.corner = Math.max(mx.corner, cn); good = good && cn <= 150;
      // 소매산 길이·이세(독립)
      const co = pathCubics(o[0]), spi = m.capSplit.anchorIndex, bN = co.slice(0, spi).reduce((q, x) => q + arcQ(x), 0), fN = co.slice(spi).reduce((q, x) => q + arcQ(x), 0), bA = capA.slice(0, spi).reduce((q, x) => q + arcQ(x), 0), fA = capA.slice(spi).reduce((q, x) => q + arcQ(x), 0);
      mx.capLen = Math.max(mx.capLen, Math.abs(bN - bA), Math.abs(fN - fA)); good = good && Math.abs(bN - bA) < 1e-9 && Math.abs(fN - fA) < 1e-9 && J(co.slice(0, spi)) === J(capA.slice(0, spi));
      const ahm = a.meta.armholeCm, eN = bN + fN - ahm.back - ahm.front; mx.easeSelf = Math.max(mx.easeSelf, Math.abs(eN - m.easeAfter.total), Math.abs(eN - (bA + fA - ahm.back - ahm.front))); good = good && Math.abs(eN - m.easeAfter.total) < 1e-9 && Math.abs(eN - (bA + fA - ahm.back - ahm.front)) < 1e-9;
      mx.easeA = Math.max(mx.easeA, m.easeCheck.vsSleeveARecordCm); good = good && m.easeCheck.vsSleeveARecordCm <= 5e-5;
      mx.seamErr = Math.max(mx.seamErr, Math.abs(m.front.seamLengthCm - (sl - uf.y))); good = good && Math.abs(m.front.seamLengthCm - (sl - uf.y)) < 1e-9;
      mx.minLapProfile = Math.min(mx.minLapProfile, m.front.lap.minCm); good = good && m.front.lap.gap === false && m.front.lap.minCm > -1e-9 && m.front.overlapCm > 0;
      // 형상 편차(raw 대비) — 수치 오차와 분리해 기록
      mx.capDev = Math.max(mx.capDev, m.fairing.cap.deviationCm); mx.fDev = Math.max(mx.fDev, m.fairing.cuffFront.deviationCm); mx.dDev = Math.max(mx.dDev, m.fairing.cuffDart.deviationCm); mx.shF = Math.max(mx.shF, m.sections.boundaryShiftCm.front); mx.shB = Math.max(mx.shB, m.sections.boundaryShiftCm.back);
      mx.lapMin = Math.min(mx.lapMin, m.front.overlapCm); mx.lapMax = Math.max(mx.lapMax, m.front.overlapCm); mx.g = Math.max(mx.g, m.front.angleDeg); mx.ap = Math.max(mx.ap, m.back.raw.apexAngleDeg);
      const ring = ringOf(g, 40); good = good && !selfX(ring) && m.checks.singlePiece === true && o.length === 11;
      for (let i = 1; i < o.length; i++) { const pe = o[i - 1].kind === "path" ? pathCubics(o[i - 1]).slice(-1)[0][3] : o[i - 1].to, st = o[i].kind === "path" ? pathCubics(o[i])[0][0] : o[i].from; if (D(pe, st) !== 0) good = false; }
      good = good && o.slice(1).every(x => segArc(x) > 1e-6) && kapRuns(pathCubics(o[3]), 0) === 0 && kapRuns(pathCubics(o[5]), 0) === 0 && kapRuns(pathCubics(o[8]), 0) === 0;
      const cuff = cuffCubics(g), ys = cuff.flatMap(q => [0, 0.25, 0.5, 0.75, 1].map(t => cubicPt(q, t).y)); mx.yDev = Math.max(mx.yDev, Math.max(...ys) - sl, sl - Math.min(...ys)); good = good && Math.max(...ys) - sl <= 0.6 && sl - Math.min(...ys) <= 0.6;
      if (s && okN % 211 === 0) {   // 합집합 격자 대조(결정적 부분집합)
        const { Lring, Oring } = unionPieces(a.geometry, m, el, s.g); let gb = 0, gn = 0; const band = Math.max(m.fairing.cap.deviationCm, m.fairing.cuffFront.deviationCm, m.fairing.cuffDart.deviationCm, m.sections.boundaryShiftCm.front, m.sections.boundaryShiftCm.back, Math.abs(m.fairing.compensation.backCornerShiftCm)) + 0.05;
        const bb = ring.reduce((q, p) => ({ x0: Math.min(q.x0, p.x), x1: Math.max(q.x1, p.x), y0: Math.min(q.y0, p.y), y1: Math.max(q.y1, p.y) }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });
        for (let x = bb.x0 - 0.4 + 0.0371; x < bb.x1 + 0.4; x += 0.5) for (let y = bb.y0 - 0.4 + 0.0293; y < bb.y1 + 0.4; y += 0.5) { const p = { x, y }; if (Math.min(distToRing(Lring, p), distToRing(Oring, p)) < band || distToRing(ring, p) < band) continue; gn++; if (pip(ring, p) !== (pip(Lring, p) || pip(Oring, p))) gb++; }
        gridN += gn; gridBad += gb; good = good && gb === 0;
      }
      if (!good) { bad++; if (!firstBad) firstBad = [ahb, ahf, hb, hf, sl, el, "invariant"]; }
    }
  }
  ok(n >= 6000, `9: 스윕 규모 ${n}건(AH 5×5 · 어깨높이 3×3 · 소매 42~66 6종 · EL 28~35 5종)`);
  ok(bad === 0, `9: 성공 ${okN}건 전부 — 최종 곡선 호 길이 cuff 구간(3● · ●)·합 W×3/4 1e-9 · raw 회전각 = 독립 수치해 · 뒤 다리 길이 같음·닫힘 연결·소맷부리 다리 수직 · 열린 다트 거울 · G1(모서리 외 이음) · 소매산 길이·이세 불변(독립 실측) · 앞 겹침 틈 없음 · 단일 조각·연속·자기교차·변곡·단차 없음 · 입력/Ⓐ ease 기록 불변 · 합집합 격자 ${gridN}점 불일치 ${gridBad} / 나머지는 지원 범위 밖 reason(${OUT.join("/")}) (이상 ${bad}${firstBad ? " 첫 사례 " + J(firstBad) : ""})`);
  ok(gridN > 5000, `9: 합집합 격자 대조 실행(${gridN}점)`);
  ok(mx.secErr <= 1e-9 && mx.legErr <= 1e-9 && mx.closeErr <= 1e-9 && mx.g1 < 1e-9 && mx.capLen < 1e-9 && mx.easeSelf < 1e-9 && mx.seamErr < 1e-9 && mx.perpErr <= 1e-6 && mx.easeA <= 5e-5, `9: 수치 오차 최대 — cuff 구간 ${mx.secErr.toExponential(1)} · 다리 ${mx.legErr.toExponential(1)} · 닫힘 ${mx.closeErr.toExponential(1)} · G1 ${mx.g1.toExponential(1)}° · 소매산 길이 ${mx.capLen.toExponential(1)} · 이세 ${mx.easeSelf.toExponential(1)} · 옆선 ${mx.seamErr.toExponential(1)} (공차 1e-9) · Ⓐ 기록 대비 이세 ${mx.easeA.toExponential(1)}(≤5e-5)`);
  ok(mx.capDev <= 0.05 && mx.fDev <= 0.2 && mx.dDev <= 0.5 && mx.shF < 0.2 && mx.shB < 0.5 && mx.dGam < 0.05 && mx.yDev <= 0.6, `9: 형상 편차 최대(raw 대비, 수치 오차 아님) — 소매산 ${mx.capDev.toFixed(4)} · 앞/중앙 ${mx.fDev.toFixed(4)} · 다트 모서리 ${mx.dDev.toFixed(4)}cm · 경계점 이동 앞 ${mx.shF.toFixed(4)} 뒤 ${mx.shB.toFixed(4)} · 회전 보정 ${mx.dGam.toFixed(5)}° · 소맷부리 높이 ${mx.yDev.toFixed(3)}`);
  ok(mx.lapMin > 0 && mx.minLapProfile > -1e-9 && (outReasons["front-overlap-negative"] || 0) > 0, `9: 성공 입력 겹침 전부 양수(${mx.lapMin.toFixed(3)}~${mx.lapMax.toFixed(3)}cm) · 틈 없음 · 음수 치수 ${outReasons["front-overlap-negative"] || 0}건은 지원 범위 밖으로 분리`);
  console.log(`  [보고] 수치 오차 최대 — cuff 구간 ${mx.secErr.toExponential(1)} · 다리 ${mx.legErr.toExponential(1)} · G1 ${mx.g1.toExponential(1)}° · 소매산 길이 ${mx.capLen.toExponential(1)} · 이세 ${mx.easeSelf.toExponential(1)} · Ⓐ 기록 대비 이세 ${mx.easeA.toExponential(1)} / 형상 편차 최대 — 소매산 ${mx.capDev.toFixed(4)} · 앞/중앙 ${mx.fDev.toFixed(4)} · 다트 모서리 ${mx.dDev.toFixed(4)}cm · 경계점 이동 앞 ${mx.shF.toFixed(4)} 뒤 ${mx.shB.toFixed(4)} · 앞 회전 보정 ${mx.dGam.toFixed(5)}° · 소맷부리 높이 ${mx.yDev.toFixed(3)}`);
  console.log(`  [보고] 성공 ${okN}/${n} · 지원 범위 밖 ${J(outReasons)} · 앞 회전 ≤ ${mx.g.toFixed(2)}° · raw 다트 꼭짓점각 ≤ ${mx.ap.toFixed(2)}° · 다트 폭 ${mx.dartMin.toFixed(2)}~${mx.dartMax.toFixed(2)}cm · 모서리 최대 ${mx.corner.toFixed(1)}°`);
}

console.log(`\n=== designSleeveCCheck: PASS ${PASS} / FAIL ${FAIL} ===`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
