// ══════════════════════════════════════════════
// designSleeveFCheck.js — js/designSleeveF.js(소매 Ⓕ 턱 소매, [패턴학교] P.43 — 2026-10-10 김님 확정) 전용 회귀.
//   (1) API·상수 (2) 절개·고정·기준점·각 턱 벌림(독립 재구성) (3) 턱 접기 — 독립 역변환으로 Ⓐ 와 일치·접힌 두 겹이 봉제선 위
//   (4) 길이: 봉제(턱 접음) = Ⓐ · 재단 = 봉제 + 쐐기 입구 · 이세 = 봉제 − AH (5) 소맷부리·높이·옆선 불변 (6) 외곽·방향 (7) 입력·결정성 (8) sweep
//   node test/harness/designSleeveFCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveF.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SF = W.designSleeveF, DS = W.designSleeve;
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


const rot = (p, c, a) => { const ca = Math.cos(a), sa = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y; return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const refl = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), fx = a.x + dx * t, fy = a.y + dy * t; return { x: 2 * fx - p.x, y: 2 * fy - p.y }; };
const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const nearIdx = (pts, p) => { let b = 0, bd = Infinity; pts.forEach((q, i) => { const d = D(q, p); if (d < bd) { bd = d; b = i; } }); return b; };
const distToPoly = (pts, p) => { let m = Infinity; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy; let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t)); m = Math.min(m, Math.hypot(a.x + dx * t - p.x, a.y + dy * t - p.y)); } return m; };
const ringF = (g) => { const r = dense(cubsOf(g.outline[0]), 60); g.outline.slice(1).forEach(s => { if (s.kind === "path") dense(cubsOf(s), 60).slice(1).forEach(p => r.push(p)); else r.push(s.to); }); return r; };
const kapI = (q, t) => { const a = der(q, t), u = 1 - t, b = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) }; return (a.x * b.y - a.y * b.x) / Math.pow(Math.hypot(a.x, a.y), 3); };
const TK = ["back-outer", "back-inner", "front-inner", "front-outer"];
const consOf = (g, role, id) => g.construction.find(c => c.role === role && c.tuck === id);

// ── 1. API·상수 ──
{
  ok(typeof SF.draftSleeveF === "function" && typeof SF.capLengthsOf === "function" && Object.isFrozen(SF) && Object.isFrozen(SF.RULES), "1: API 동결");
  ok(J(SF.RULES.cutOffsetsCm) === J([-3, -1, 1, 3]) && SF.RULES.tuckDefaultCm === 1.5 && SF.RULES.tuckMaxCm === 3, "1: 절개 ±1·±3 · 턱 기본 1.5 · 최대 3(책·김님)");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const F = SF.draftSleeveF(A, {});
ok(A.ok && F.ok, "기준: B83 SL52 기본 턱 성공 " + (F.reason || ""));
const m = F.meta, g = F.geometry, H = A.meta.sleeveLengthCm, capA = cubsOf(A.geometry.outline[0]), denseA = dense(capA, 400), SPA = A.meta.sp;

// ── 2. 절개·고정·기준점·벌림 ──
{
  ok(m.tuck.perTuckCm === 1.5 && m.tuck.totalCm === 6 && m.tuck.count === 4, "2: 기본 턱 1.5 × 4");
  const xs = [-3, -1, 1, 3].map(o => SPA.x + o);
  TK.forEach((id, k) => {
    const f = consOf(g, "tuck-fold", id), p = consOf(g, "tuck-place", id);
    ok(f && p && D(f.to, p.to) < 1e-9, "2: 접는 선·맞출 선이 한 기준점에서 만남 " + id);
    ok(Math.abs(D(f.from, p.from) - 1.5) < 1e-9, "2: 소매산 입구 벌림 = 1.5(현) " + id + " " + D(f.from, p.from));
    ok(Math.abs(f.to.y - H) < 0.1, "2: 기준점이 소맷부리 근처(바깥은 안쪽 띠와 함께 움직인 점) " + id);
  });
  // 안쪽 두 턱의 기준점 = 원래 절개선 소맷부리 점(가운데 띠 고정)
  ok(D(consOf(g, "tuck-fold", "back-inner").to, { x: xs[1], y: H }) < 1e-12 && D(consOf(g, "tuck-fold", "front-inner").to, { x: xs[2], y: H }) < 1e-12, "2: 안쪽 기준점 = (±1, 소맷부리) 고정");
  // 가운데 띠 소매산 = Ⓐ 그대로: 안쪽 두 접는 선 위 끝 사이 재단선 표본이 Ⓐ 위
  const cut = dense(cubsOf(g.outline[0]), 200), a = nearIdx(cut, consOf(g, "tuck-fold", "back-inner").from), b = nearIdx(cut, consOf(g, "tuck-fold", "front-inner").from);
  let dev = 0; for (let i = a; i <= b; i++) dev = Math.max(dev, distToPoly(denseA, cut[i]));
  ok(a < b && dev < 1e-4, "2: 가운데 띠 소매산 = Ⓐ (최대 " + dev.toExponential(1) + ")");
  ok(Math.abs(consOf(g, "tuck-fold", "back-inner").from.x - xs[1]) < 1e-12 && Math.abs(consOf(g, "tuck-fold", "front-inner").from.x - xs[2]) < 1e-12, "2: 안쪽 절개선 위치 = 중심 ±1");
}

// ── 3. 턱 접기(독립 역변환) ──
//   각 쐐기: 첫 겹(접는 선 모서리 → 가운데)은 접는 선에 대해 거울, 둘째 겹(가운데 → 맞출 선 모서리)은 기준점 중심 −θ 회전 → 둘 다 중심 쪽 조각 소매산 위.
//   바깥 조각(맞출 선 쪽)을 기준점 중심 −θ 로 돌리면 접는 선과 맞닿아(턱 닫힘) 조각 순서대로 되돌리면 Ⓐ 와 같아야 한다.
{
  const cut = dense(cubsOf(g.outline[0]), 200);
  let layer = 0, foldA = 0;
  TK.forEach(id => {
    const f = consOf(g, "tuck-fold", id), p = consOf(g, "tuck-place", id), pv = f.to;
    const th = Math.atan2(p.from.y - pv.y, p.from.x - pv.x) - Math.atan2(f.from.y - pv.y, f.from.x - pv.x);
    const i0 = nearIdx(cut, f.from), i1 = nearIdx(cut, p.from), lo = Math.min(i0, i1), hi = Math.max(i0, i1);
    const mouth = cut.slice(lo, hi + 1); if (i0 > i1) mouth.reverse();   // 접는 선 → 맞출 선
    const iM = nearIdx(mouth, m.tuck.tucks[id].mid);
    const other = { "back-outer": consOf(g, "tuck-place", "back-inner").from, "back-inner": consOf(g, "tuck-fold", "front-inner").from,
      "front-inner": consOf(g, "tuck-fold", "back-inner").from, "front-outer": consOf(g, "tuck-place", "front-inner").from }[id];
    const j0 = nearIdx(cut, f.from), j1 = nearIdx(cut, other), centerSide = cut.slice(Math.min(j0, j1), Math.max(j0, j1) + 1);   // 중심 쪽 조각 소매산 전체
    mouth.forEach((q, i) => { const r = i <= iM ? refl(q, pv, f.from) : rot(q, pv, -th); layer = Math.max(layer, distToPoly(centerSide, r)); });
    ok(Math.abs(Math.abs(th) * 180 / Math.PI - m.tuck.tucks[id].rotationDeg) < 1e-9, "3: θ(접는 선↔맞출 선) = 회전각 " + id);
  });
  ok(layer < 1e-3, "3: 접힌 두 겹이 중심 쪽 소매산(봉제선) 위 — 최대 " + layer.toExponential(2) + "cm(표본 해상도)");
  // 접은 상태 전체 = Ⓐ: 각 조각의 재단선 표본을 바깥 → 안쪽 순서로 역회전해 Ⓐ 소매산 위에 오는지
  const piece = (from, to) => { const i0 = nearIdx(cut, from), i1 = nearIdx(cut, to); return cut.slice(Math.min(i0, i1), Math.max(i0, i1) + 1); };
  const fe = id => consOf(g, "tuck-fold", id), pe = id => consOf(g, "tuck-place", id);
  const ang = id => { const f = fe(id), p = pe(id), pv = f.to; return Math.atan2(p.from.y - pv.y, p.from.x - pv.x) - Math.atan2(f.from.y - pv.y, f.from.x - pv.x); };
  const unfold = (pts, ids) => pts.map(q => ids.reduce((r, id) => rot(r, fe(id).to, -ang(id)), q));
  const segs = [
    [piece(cubsOf(g.outline[0])[0][0], pe("back-outer").from), ["back-outer", "back-inner"]],
    [piece(fe("back-outer").from, pe("back-inner").from), ["back-inner"]],
    [piece(fe("back-inner").from, fe("front-inner").from), []],
    [piece(pe("front-inner").from, fe("front-outer").from), ["front-inner"]],
    [piece(pe("front-outer").from, cubsOf(g.outline[0]).slice(-1)[0][3]), ["front-outer", "front-inner"]]
  ];
  segs.forEach(([pts, ids]) => unfold(pts, ids).forEach(q => { foldA = Math.max(foldA, distToPoly(denseA, q)); }));
  ok(foldA < 1e-4, "3: 턱을 모두 접으면 소매산 = Ⓐ (최대 " + foldA.toExponential(1) + "cm)");
  ok(m.folded.capEqualsSleeveA === true && m.folded.maxDevCm < 1e-9 && m.folded.layersOnSeamMaxCm < 1e-9, "3: 엔진 기록 접기 일치");
}

// ── 4. 길이 ──
{
  const cut = dense(cubsOf(g.outline[0]), 600), Lcut = polyLen(cut), LA = polyLen(dense(capA, 600));
  let hidden = 0; TK.forEach(id => { const i0 = nearIdx(cut, consOf(g, "tuck-fold", id).from), i1 = nearIdx(cut, consOf(g, "tuck-place", id).from); hidden += polyLen(cut.slice(Math.min(i0, i1), Math.max(i0, i1) + 1)); });
  const lens = SF.capLengthsOf(g), sA = A.meta.capLengths;
  ok(Math.abs((Lcut - hidden) - LA) < 1e-3, "4: 봉제(턱 접음) 길이 독립 = Ⓐ " + (Lcut - hidden).toFixed(4) + " vs " + LA.toFixed(4));
  ok(Math.abs(lens.sewn.total - sA.total) < 1e-4 && Math.abs(lens.sewn.back - sA.back) < 1e-4 && Math.abs(lens.sewn.front - sA.front) < 1e-4, "4: capLengthsOf 봉제 앞/뒤 = Ⓐ 기록값(Ⓐ 측정법 차 < 1e-4)");
  ok(Math.abs(lens.cut.total - Lcut) < 1e-3 && lens.cut.total > lens.sewn.total + 4 * 1.5 - 1e-9, "4: 재단선 = 독립 실측 · > 봉제 + 턱 합");
  ok(D(lens.split, SPA) < 1e-12, "4: 앞/뒤 분할 = SP(가운데 띠 고정)");
  const AH = A.meta.armholeCm;
  ok(Math.abs(m.easeAfter.total - (lens.sewn.total - AH.back - AH.front)) < 1e-9 && Math.abs(m.easeAfter.total - A.meta.easeAfter.total) < 1e-4, "4: 이세 = 턱 접은 길이 − AH = Ⓐ 이세");
}

// ── 5. 소맷부리·높이·옆선 ──
{
  // 최종 소맷부리 = 곡선(김님 승인) · raw 강체 직선은 meta 감사용
  const hemS = g.outline.filter(s => /^hem/.test(s.role));
  ok(hemS.length === 1 && hemS[0].role === "hem" && hemS[0].kind === "path", "5: 최종 소맷부리 = 곡선 하나(raw 직선은 외곽에 없음)");
  const hc = cubsOf(hemS[0]), hl = polyLen(dense(hc, 4000)), W0 = A.meta.bicepCm;
  ok(Math.abs(hl - m.hemCm) < 1e-4 && Math.abs(m.hem.lengthCm - m.hemCm) < 1e-12, "5: 소맷부리 곡선 길이 독립 실측 = meta " + hl.toFixed(5));
  ok(Math.abs(m.hem.diffFromSleeveACm - (m.hemCm - W0)) < 1e-12 && m.hem.diffFromSleeveACm > 0 && m.hem.diffFromSleeveACm < 0.001, "5: Ⓐ 소맷부리와 차 명시(+" + m.hem.diffFromSleeveACm.toFixed(5) + "cm, 길이 맞춤 없음)");
  const rawL = m.hem.raw.lengthCm;
  ok(Math.abs(rawL - W0) < 1e-9 && m.hem.raw.kinkDeg.length === 4 && m.hem.raw.kinkDeg.every(k => k > 1 && k < 2.5), "5: raw 강체 직선 = Ⓐ 길이 · 꺾임 4곳 기록 " + m.hem.raw.kinkDeg.map(k => k.toFixed(2)).join(","));
  const sfE = g.outline.find(s => s.role === "side-seam-front").to, sbE = g.outline.find(s => s.role === "side-seam-back").from;
  ok(D(hc[0][0], sfE) < 1e-12 && D(hc[hc.length - 1][3], sbE) < 1e-12, "5: 양 끝 = 옆선 끝 그대로");
  const pivots = ["front-outer", "front-inner", "back-inner", "back-outer"].map(id => consOf(g, "tuck-fold", id).to);
  ok(hc.length === 5 && pivots.every((pv, i) => D(hc[i][3], pv) < 1e-12), "5: 기준점 4개를 그대로 지남");
  let g1 = 0; for (let i = 1; i < hc.length; i++) g1 = Math.max(g1, ang(der(hc[i - 1], 1), der(hc[i], 0)));
  const ks = []; hc.forEach(q => { for (let i = 0; i <= 400; i++) ks.push(kapI(q, i / 400)); });
  ok(g1 < 1e-6 && (ks.every(k => k <= 1e-12) || ks.every(k => k >= -1e-12)), "5: G1 · 변곡 없음(곡률 부호 하나, 독립) g1=" + g1.toExponential(1));
  ok(m.hem.maxDevFromRawCm < 0.05, "5: raw 직선에서 최대 " + m.hem.maxDevFromRawCm.toFixed(4) + "cm");
  const cut = dense(cubsOf(g.outline[0]), 200), top = Math.min(...cut.map(p => p.y));
  ok(Math.abs(top - SPA.y) < 1e-9, "5: 소매산 높이 그대로(최고점 = SP)");
  const sb = g.outline.find(s => s.role === "side-seam-back"), sf = g.outline.find(s => s.role === "side-seam-front");
  const aB = A.geometry.outline[1], aF = A.geometry.outline[2];
  ok(Math.abs(D(sb.from, sb.to) - D(aB.from, aB.to)) < 1e-9 && Math.abs(D(sf.from, sf.to) - D(aF.from, aF.to)) < 1e-9, "5: 옆선 길이 그대로(강체)");
  ok(m.widthAfterCm > m.widthCm, "5: 소매폭 넓어짐(책) " + m.widthCm.toFixed(2) + "→" + m.widthAfterCm.toFixed(2));
}

// ── 6. 외곽·방향 ──
{
  ok(!selfX(ringF(g)), "6: 자기교차 없음(독립)");
  ok(selfX([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 0 }]), "6: 독립 검사기 자체 확인");
  TK.forEach(id => {
    const f = consOf(g, "tuck-fold", id), p = consOf(g, "tuck-place", id), dir = id.indexOf("front") === 0 ? 1 : -1;
    ok((p.from.x - f.from.x) * dir > 0, "6: 접는 선 = 중심 쪽 변 · 맞출 선 = 바깥 " + id);
  });
  ok(m.tuck.direction.quote === "바깥쪽으로 접는데 소매중심이 위로 올라와야해" && m.tuck.direction.topLayer === "중심 쪽", "6: 김님 원문·위층 기록");
  ok(m.tuck.stitchEnd === null, "6: 박기 끝 만들지 않음(미확정)");
  ok(g.construction.map(c => c.role).join() === "center-line," + TK.map(() => "tuck-fold,tuck-place,tuck-mid").join(","), "6: construction");
}

// ── 7. 입력·결정성 ──
{
  ["0", "-1", "3.01", "NaN"].forEach(v => ok(SF.draftSleeveF(A, { tuckCm: Number(v) }).reason === "invalid-tuck", "7: 거부 " + v));
  ok(SF.draftSleeveF(A, { tuckCm: "1.5" }).reason === "invalid-tuck", "7: 문자열 거부");
  const F3 = SF.draftSleeveF(A, { tuckCm: 3 });
  ok(F3.ok && F3.warnings.indexOf("inner-tuck-layers-overlap") >= 0 && F.warnings.length === 0, "7: 3cm 허용 · 2cm 초과 경고(안쪽 접힌 천 겹침)");
  const F15 = SF.draftSleeveF(A, { tuckCm: 1.5 });
  ok(J(F15) === J(F), "7: 기본값 = 1.5");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af);
  const e1 = SF.draftSleeveF(Af, { tuckCm: 2 }), e2 = SF.draftSleeveF(Af, { tuckCm: 2 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before, "7: 동결 입력 · 결정성 · Ⓐ 불변");
  ok(SF.draftSleeveF(null, {}).reason === "no-sleeve-a", "7: Ⓐ 없음");
}

// ── 8. sweep ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { open: 0, sewn: 0, hem: 0, fold: 0, top: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      for (const t of [0.5, 1.5, 3]) {
        n++;
        const f = SF.draftSleeveF(a, { tuckCm: t });
        if (!f.ok) { out[f.reason] = (out[f.reason] || 0) + 1; if (!f.outOfSupportedRange) bad.push(sym + SL + "/" + t + ":" + f.reason); continue; }
        okN++;
        const M = f.meta, L2 = SF.capLengthsOf(f.geometry);
        worst.open = Math.max(worst.open, ...TK.map(id => Math.abs(M.tuck.tucks[id].openedCm - t)));
        worst.sewn = Math.max(worst.sewn, Math.abs(L2.sewn.total - a.meta.capLengths.total));
        worst.hem = Math.max(worst.hem, Math.abs(M.hem.raw.lengthCm - a.meta.bicepCm)); worst.hemDiff = Math.max(worst.hemDiff || 0, M.hem.diffFromSleeveACm);
        if (!(M.hem.inflections === 0 && M.hem.g1MaxDeg < 1e-6 && M.hem.diffFromSleeveACm > 0)) bad.push(sym + SL + "/" + t + ":hem");
        worst.fold = Math.max(worst.fold, M.folded.maxDevCm, M.folded.layersOnSeamMaxCm);
        worst.top = Math.max(worst.top, a.meta.sp.y - Math.min(...dense(cubsOf(f.geometry.outline[0]), 40).map(p => p.y)));
        if (selfX(ringF(f.geometry))) bad.push(sym + SL + "/" + t + ":selfX");
      }
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 지원 밖 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 60 && okN === n, "8: sweep 전부 성공 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "8: 자기교차·표시 없는 실패 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-9 && worst.sewn < 1e-4 && worst.hem < 1e-9 && worst.fold < 1e-7 && worst.top < 1e-9, "8: sweep 불변식 " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
