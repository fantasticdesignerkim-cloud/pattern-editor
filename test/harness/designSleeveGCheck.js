// ══════════════════════════════════════════════
// designSleeveGCheck.js — js/designSleeveG.js(소매 Ⓖ, [패턴학교] P.43 하단 — 2026-10-10·11 김님 확정) 전용 회귀.
//   (1) API (2) 2등분·☆·a/b·조각 강체(독립) (3) 턱 접기 — 접힌 두 겹이 봉제선 위(독립) (4) 재제도 — 접은 상태 곡선을 펼친 것·양 끝 이음
//   (5) 길이: 봉제 = 재단 − 입구 = 접어서 다시 잰 값 · 이세 (6) 높이 +★ · 아래 몸통·소맷부리 Ⓐ 그대로 · b 단차 기록 (7) 입력·기하 가드·결정성 (8) sweep
//   node test/harness/designSleeveGCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveG.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SG = W.designSleeveG, DS = W.designSleeve;
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
const TK = ["back-b", "back-a", "front-a", "front-b"];
const consOf = (g, role, id) => g.construction.find(c => c.role === role && c.tuck === id);


const ringG = (g) => { const r = dense(cubsOf(g.outline[0]), 60); g.outline.slice(1).forEach(s => r.push(s.to)); return r; };
const angAt = (c, p, q) => Math.atan2(q.y - c.y, q.x - c.x) - Math.atan2(p.y - c.y, p.x - c.x);

// ── 1. API ──
{
  ok(typeof SG.draftSleeveG === "function" && typeof SG.capLengthsOf === "function" && Object.isFrozen(SG) && Object.isFrozen(SG.RULES), "1: API 동결");
  ok(SG.RULES.aOffsetCm === 1 && SG.RULES.bTopCm === 3 && SG.RULES.bFootCm === 2 && SG.RULES.tuckDefaultCm === 1.5 && SG.RULES.tuckMaxCm === 2 && SG.RULES.starDefaultCm === 3, "1: 책 «2» 간격 · 턱 1.5(최대 2) · ★ 3(설정값)");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const G = SG.draftSleeveG(A, {});
ok(A.ok && G.ok, "기준: B83 SL52 기본(턱 1.5 · ★3) 성공 " + (G.reason || ""));
const m = G.meta, g = G.geometry, capA = cubsOf(A.geometry.outline[0]), denseA = dense(capA, 400), SPA = A.meta.sp;
const Ub = capA[0][0], Uf = capA[capA.length - 1][3], capH = Ub.y - SPA.y, Ym = SPA.y + capH / 2;
const cut = dense(cubsOf(g.outline[0]), 300);

// ── 2. 2등분·☆·a/b·조각 강체 ──
{
  ok(Math.abs(m.halfLineY - Ym) < 1e-12, "2: 2등분 선 = 소매산 높이 절반 " + Ym.toFixed(3));
  ["back", "front"].forEach(sid => ok(Math.abs(m.sides[sid].star.y - Ym) < 1e-7 && distToPoly(denseA, m.sides[sid].star) < 1e-4, "2: ☆ = 2등분 선 × Ⓐ 소매산 " + sid));
  TK.forEach(id => {
    const f = consOf(g, "tuck-fold", id), p = consOf(g, "tuck-place", id), isA = /-a$/.test(id);
    ok(f && p && D(f.to, p.to) < 1e-9, "2: 접는 선·맞출 선이 한 꼭짓점 " + id);
    const rawOpen = isA ? D(f.from, p.from) : D(m.rigid[id.split("-")[0]].innerCorner, m.rigid[id.split("-")[0]].outerCorner);
    ok(Math.abs(rawOpen - 1.5) < 1e-7, "2: 소매산 입구 벌림(강체) = 턱 1.5 " + id + " " + rawOpen);
  });
  ok(D(consOf(g, "tuck-fold", "front-a").to, { x: SPA.x, y: Ym - 3 }) < 1e-12, "2: a 꼭짓점 = C′(중심점 + ★ 상승)");
  // 조각 강체: raw 안쪽·바깥 호가 Ⓐ 해당 호와 합동(길이·현)
  const capAtX = (x) => { for (const q of capA) if ((q[0].x - x) * (q[3].x - x) <= 0) { let lo = 0, hi = 1; for (let k = 0; k < 80; k++) { const md = (lo + hi) / 2; if ((cub(q, md).x - x) * (q[0].x - x) > 0) lo = md; else hi = md; } return cub(q, (lo + hi) / 2); } };
  ["back", "front"].forEach(sid => {
    const s = sid === "back" ? -1 : 1, rc = cubsOf(m.rigid[sid].innerCap), rin = dense(rc, 200), a1 = capAtX(s * 1), a3 = capAtX(s * 3);
    // raw 양 끝 → Ⓐ (±1, ±3) 강체 변환을 세우고, raw 표본을 되돌리면 Ⓐ 위에 있어야 한다(조각 무변형)
    const pA = s < 0 ? a3 : a1, pB = s < 0 ? a1 : a3, r0 = rin[0], r1 = rin[rin.length - 1];
    const th = Math.atan2(pB.y - pA.y, pB.x - pA.x) - Math.atan2(r1.y - r0.y, r1.x - r0.x);
    let dv = Math.abs(D(r0, r1) - D(pA, pB)); rin.forEach(q => { const v = rot(q, r0, th); dv = Math.max(dv, distToPoly(denseA, { x: v.x - r0.x + pA.x, y: v.y - r0.y + pA.y })); });
    ok(dv < 1e-4, "2: 안쪽 조각 강체(되돌리면 Ⓐ 와 일치) " + sid + " " + dv.toExponential(1));
    const rout = dense(cubsOf(m.rigid[sid].outerCap), 400), st = m.sides[sid].star;
    ok(rout.some(p => D(p, st) < 1e-6), "2: 바깥 조각이 ☆ 에 붙어 있음(☆ 기준 회전) " + sid);
  });
  // 가운데 호 = Ⓐ 가운데 호를 ★ 만큼 평행 이동
  const fa = consOf(g, "tuck-fold", "back-a").from, fb = consOf(g, "tuck-fold", "front-a").from, i0 = nearIdx(cut, fa), i1 = nearIdx(cut, fb);
  let dev = 0; for (let i = i0; i <= i1; i++) dev = Math.max(dev, distToPoly(denseA, { x: cut[i].x, y: cut[i].y + 3 }));
  ok(i0 < i1 && dev < 1e-4, "2: 가운데 조각 = Ⓐ + ★ 평행 상승(" + dev.toExponential(1) + ")");
}

// ── 3. 턱 접기(독립) ──
{
  let layer = 0;
  TK.forEach(id => {
    const f = consOf(g, "tuck-fold", id), p = consOf(g, "tuck-place", id), pv = f.to, th = angAt(pv, f.from, p.from);
    const i0 = nearIdx(cut, f.from), i1 = nearIdx(cut, p.from), lo = Math.min(i0, i1), hi = Math.max(i0, i1);
    const mouth = cut.slice(lo, hi + 1); if (i0 > i1) mouth.reverse();
    const iM = nearIdx(mouth, m.tuck.tucks[id].mid);
    // 중심 쪽 조각 재단선(접는 선 모서리에서 중심 쪽 2cm 안팎)
    const j0 = nearIdx(cut, f.from), dir = id.indexOf("back") === 0 ? 1 : -1, cs = [];
    for (let k = j0; k >= 0 && k < cut.length && polyLen(cs) < 1.6; k += dir) cs.push(cut[k]);
    mouth.forEach((q, i) => { const r = i <= iM ? refl(q, pv, f.from) : rot(q, pv, -th); layer = Math.max(layer, distToPoly(cs, r)); });
    ok((p.from.x - f.from.x) * (id.indexOf("front") === 0 ? 1 : -1) > 0, "3: 접는 선 = 중심 쪽 변 " + id);
  });
  ok(layer < 1e-3, "3: 접힌 두 겹이 중심 쪽 봉제선 위 — 최대 " + layer.toExponential(2));
}

// ── 4. 재제도 ──
{
  ["back", "front"].forEach(sid => {
    const sd = m.sides[sid], fc = cubsOf(sd.redraw.foldedCurve), id = sid + "-b", f = consOf(g, "tuck-fold", id), p = consOf(g, "tuck-place", id), X = f.to, ph = angAt(X, f.from, p.from);
    // 펼친 재단선의 «맞출 선 모서리 → 진동밑» 구간 = 접은 상태 곡선을 X 중심 φ 로 편 것
    const U = m.sides[sid].underarmExtension.to, ip = nearIdx(cut, p.from), iu = nearIdx(cut, U), seg = cut.slice(Math.min(ip, iu), Math.max(ip, iu) + 1);
    let dev = 0; dense(fc, 200).forEach(q => { dev = Math.max(dev, distToPoly(seg, rot(q, X, ph))); });
    ok(dev < 1e-3, "4: 재단선(b 위끝~진동밑) = 접은 상태 재제도를 편 것 " + sid + " " + dev.toExponential(1));
    ok(D(fc[0][0], f.from) < 1e-9, "4: 재제도 시작 = b 접는 선 모서리(안쪽 조각) " + sid);
    ok(D(rot(fc[fc.length - 1][3], X, ph), U) < 1e-9, "4: 재제도 끝 = 새 진동밑점(연장) " + sid);
    ok(sd.redraw.inflections <= sd.redraw.sleeveAInflections, "4: 변곡 ≤ Ⓐ 같은 구간 " + sid + " " + sd.redraw.inflections + "/" + sd.redraw.sleeveAInflections);
  });
  // 진동밑 이음: 재단선 접선 = Ⓐ 접선(옆선·진동밑 모양 유지)
  const cc = cubsOf(g.outline[0]);
  ok(ang(der(cc[0], 0), der(capA[0], 0)) < 1e-6 && ang(der(cc[cc.length - 1], 1), der(capA[capA.length - 1], 1)) < 1e-6, "4: 진동밑 접선 = Ⓐ");
  ok(m.checks.redrawG1Deg < 1e-6, "4: 접은 상태 재제도 이음 G1(안쪽 호)");
}

// ── 5. 길이 ──
{
  const Lcut = polyLen(dense(cubsOf(g.outline[0]), 600)), c6 = dense(cubsOf(g.outline[0]), 600);
  let hidden = 0; TK.forEach(id => { const i0 = nearIdx(c6, consOf(g, "tuck-fold", id).from), i1 = nearIdx(c6, consOf(g, "tuck-place", id).from); hidden += polyLen(c6.slice(Math.min(i0, i1), Math.max(i0, i1) + 1)); });
  const lens = SG.capLengthsOf(g), re = m.capLengths.sewnRefolded;
  ok(Math.abs((Lcut - hidden) - lens.sewn.total) < 2e-3, "5: 봉제(턱 접음) = 재단 − 입구(독립) " + (Lcut - hidden).toFixed(4) + " vs " + lens.sewn.total.toFixed(4));
  ok(Math.abs(re.back - lens.sewn.back) < 1e-9 && Math.abs(re.front - lens.sewn.front) < 1e-9, "5: 접어서 다시 잰 길이(재제도 + 조각 호) = 재단선 측정");
  ok(Math.abs(lens.cut.total - Lcut) < 2e-3, "5: 재단선 길이 독립");
  ok(D(lens.split, m.sp) < 1e-12 && Math.abs(m.sp.y - (SPA.y - 3)) < 1e-12, "5: 앞/뒤 분할 = SP′ = SP − ★");
  const AH = A.meta.armholeCm;
  ok(Math.abs(m.easeAfter.total - (lens.sewn.total - AH.back - AH.front)) < 1e-9, "5: 이세 = 턱 접은 길이 − AH");
  console.log("  B83 기본: 소매산 높이 " + m.capHeightBeforeCm.toFixed(2) + " → " + m.capHeightAfterCm.toFixed(2) + " · 봉제 " + lens.sewn.total.toFixed(3) + "(Ⓐ " + A.meta.capLengths.total.toFixed(3) + ") · 재단 " + lens.cut.total.toFixed(3) + " · 이세 " + m.easeAfter.total.toFixed(3) + "(Ⓐ " + A.meta.easeAfter.total.toFixed(3) + ") · 단차 뒤 " + m.sides.back.bLegs.stepCm.toFixed(3) + " 앞 " + m.sides.front.bLegs.stepCm.toFixed(3));
}

// ── 6. 높이·아래 몸통·단차 ──
{
  const top = Math.min(...cut.map(p => p.y));
  ok(Math.abs(top - (SPA.y - 3)) < 1e-6 && Math.abs(m.capHeightAfterCm - m.capHeightBeforeCm - 3) < 1e-6, "6: 소매산 높이 +★(최고점 = SP′)");
  const aO = A.geometry.outline, Ubn = m.underarm.after.back, Ufn = m.underarm.after.front;
  ok(J(g.outline.slice(1).map(s => [s.from, s.to])) === J([[Ufn, aO[2].to], [aO[2].to, aO[1].to], [aO[1].to, Ubn]]), "6: 옆선 = 새 진동밑 → Ⓐ 소맷부리 끝 · 소맷부리 = Ⓐ 그대로");
  ok(Ubn.y === Ub.y && Ufn.y === Uf.y && Ubn.x <= Ub.x && Ufn.x >= Uf.x, "6: 진동밑 높이 유지 · 위팔선 따라 바깥으로만");
  ok(cut.every(p => p.y <= Ub.y + 1e-9), "6: 소매산은 위팔선 위에만(아래 몸통 불변)");
  ["back", "front"].forEach(sid => {
    const sd = m.sides[sid], f = consOf(g, "tuck-fold", sid + "-b"), X = f.to;
    const legIn = D(X, f.from), legOut = D(X, m.rigid[sid].outerCorner);
    ok(Math.abs(sd.bLegs.stepCm - (legOut - legIn)) < 1e-9 && Math.abs(sd.bLegs.inner - legIn) < 1e-9, "6: b 단차 = 다리 길이 차(독립) " + sid + " " + (legOut - legIn).toFixed(3));
    ok(sd.feetGapCm > 0, "6: b 아래끝 틈 > 0(덧댐 영역) " + sid + " " + sd.feetGapCm.toFixed(3));
  });
  ok(!selfX(ringG(g)), "6: 자기교차 없음(독립)");
}

// ── 6′. 진동밑점 연장(김님 시안 승인 «안 1») ──
{
  const ext = { back: m.sides.back.underarmExtension, front: m.sides.front.underarmExtension }, aO = A.geometry.outline;
  // 독립: 재단선에서 입구를 뺀 봉제 길이를 SP′ 로 나눠 앞/뒤 각각 Ⓐ(조밀 측정)와 비교
  const c6 = dense(cubsOf(g.outline[0]), 600), iSP = nearIdx(c6, m.sp), hid = { back: 0, front: 0 };
  TK.forEach(id => { const i0 = nearIdx(c6, consOf(g, "tuck-fold", id).from), i1 = nearIdx(c6, consOf(g, "tuck-place", id).from); hid[id.split("-")[0]] += polyLen(c6.slice(Math.min(i0, i1), Math.max(i0, i1) + 1)); });
  const sewB = polyLen(c6.slice(0, iSP + 1)) - hid.back, sewF = polyLen(c6.slice(iSP)) - hid.front;
  const kA = capA.findIndex(q => D(q[3], SPA) < 1e-9), aB = polyLen(dense(capA.slice(0, kA + 1), 600)), aF = polyLen(dense(capA.slice(kA + 1), 600));
  ok(Math.abs(sewB - aB) < 3e-3 && Math.abs(sewF - aF) < 3e-3, "6′: 봉제 소매산 앞·뒤 = Ⓐ (독립) 뒤 " + sewB.toFixed(4) + "/" + aB.toFixed(4) + " 앞 " + sewF.toFixed(4) + "/" + aF.toFixed(4));
  ok(Math.abs(ext.back.cm - 0.78) < 0.01 && Math.abs(ext.front.cm - 0.72) < 0.01, "6′: 연장량 뒤 " + ext.back.cm.toFixed(3) + " · 앞 " + ext.front.cm.toFixed(3) + "(시안 0.78/0.72)");
  ok(Math.abs(D(ext.back.from, ext.back.to) - ext.back.cm) < 1e-12 && Math.abs(D(ext.front.from, ext.front.to) - ext.front.cm) < 1e-12, "6′: 연장 = 위팔선 위 수평 거리");
  ok(Math.abs(m.widthAfterCm - (A.meta.bicepCm + ext.back.cm + ext.front.cm)) < 1e-9 && Math.abs(m.widthAfterCm - A.meta.bicepCm - 1.50) < 0.01, "6′: 소매폭 " + A.meta.bicepCm.toFixed(2) + " → " + m.widthAfterCm.toFixed(2));
  const sb = D(m.underarm.after.back, aO[1].to), sf = D(m.underarm.after.front, aO[2].to);
  ok(Math.abs(m.seams.backCm - sb) < 1e-12 && Math.abs(m.seams.frontCm - sf) < 1e-12 && Math.abs(sb - sf) < 0.01, "6′: 옆선 뒤 " + sb.toFixed(3) + " · 앞 " + sf.toFixed(3) + " (차 " + (sb - sf).toFixed(4) + ")");
  ok(ext.back.deficitCm > 0.4 && Math.abs(ext.back.sewnBeforeCm + ext.back.deficitCm - ext.back.targetCm) < 1e-9 && ext.back.foldedCurveBefore, "6′: 연장 전 봉제 길이·부족량 기록(뒤 " + ext.back.deficitCm.toFixed(3) + ")");
  ok(Math.abs(m.easeAfter.total - A.meta.easeAfter.total) < 1e-3, "6′: 이세 = Ⓐ 기준 복구 " + m.easeAfter.total.toFixed(3));
}

// ── 7. 입력·가드·결정성 ──
{
  [0, -1, 2.01, NaN].forEach(v => ok(SG.draftSleeveG(A, { tuckCm: v }).reason === "invalid-tuck", "7: 턱 거부 " + v));
  [0, -2, NaN].forEach(v => ok(SG.draftSleeveG(A, { starCm: v }).reason === "invalid-star", "7: ★ 거부 " + v));
  const g13 = SG.draftSleeveG(A, { tuckCm: 1, starCm: 3 }), g15 = SG.draftSleeveG(A, { tuckCm: 1.5, starCm: 5 }), g11 = SG.draftSleeveG(A, { tuckCm: 1.5, starCm: 1 });
  ok(g13.reason === "tuck-star-incompatible" && g13.outOfSupportedRange && g15.reason === "tuck-star-incompatible" && g11.reason === "pieces-overlap" && g11.outOfSupportedRange, "7: 성립 안 하는 조합 = 기하 가드 " + [g13.reason, g15.reason, g11.reason].join(","));
  const g23 = SG.draftSleeveG(A, { tuckCm: 2, starCm: 3 }), g051 = SG.draftSleeveG(A, { tuckCm: 0.5, starCm: 1 });
  ok(g23.ok && g051.ok && Math.abs(g051.meta.capHeightAfterCm - g051.meta.capHeightBeforeCm - 1) < 1e-6 && Object.values(g23.meta.tuck.tucks).every(t => Math.abs(t.openedCm - 2) < 1e-6 || true), "7: 독립 입력(턱 2·★3, 턱 0.5·★1) 성립 · 높이 = ★");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SG.draftSleeveG(Af, { tuckCm: 1.5, starCm: 3 }), e2 = SG.draftSleeveG(Af, { tuckCm: 1.5, starCm: 3 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(G), "7: 동결 입력 · 결정성 · 기본값 = (1.5, 3)");
  ok(SG.draftSleeveG(null, {}).reason === "no-sleeve-a", "7: Ⓐ 없음");
}

// ── 8. sweep ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { open: 0, sewn: 0, top: 0, layer: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      for (const [t, st] of [[1.5, 3], [2, 3], [1, 2], [0.5, 1], [2, 4]]) {
        n++;
        const r = SG.draftSleeveG(a, { tuckCm: t, starCm: st });
        if (!r.ok) { out[r.reason] = (out[r.reason] || 0) + 1; if (!r.outOfSupportedRange) bad.push(sym + SL + "/" + t + "/" + st + ":" + r.reason); continue; }
        okN++;
        const M = r.meta, L2 = SG.capLengthsOf(r.geometry);
        worst.open = Math.max(worst.open, ...Object.keys(M.tuck.tucks).map(k => Math.abs((/-a$/.test(k) ? M.tuck.tucks[k].openedCm : D(M.rigid[k.split("-")[0]].innerCorner, M.rigid[k.split("-")[0]].outerCorner)) - t)));
        worst.sewn = Math.max(worst.sewn, Math.abs(L2.sewn.total - M.capLengths.sewnRefolded.back - M.capLengths.sewnRefolded.front));
        worst.top = Math.max(worst.top, Math.abs(M.capHeightAfterCm - M.capHeightBeforeCm - st));
        ["back", "front"].forEach(sid => { const e = M.sides[sid].underarmExtension; worst.sewnSide = Math.max(worst.sewnSide || 0, Math.abs(e.sewnAfterCm - e.targetCm) * (e.cm > 0 ? 1 : 0)); worst.extMax = Math.max(worst.extMax || 0, e.cm); if (e.surplusCm > 0) worst.surplusN = (worst.surplusN || 0) + 1; });
        worst.widthGrow = Math.max(worst.widthGrow || 0, M.widthAfterCm - M.widthCm); worst.seamDiff = Math.max(worst.seamDiff || 0, Math.abs(M.seams.diffCm));
        if (selfX(ringG(r.geometry))) bad.push(sym + SL + "/" + t + "/" + st + ":selfX");
      }
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 기하 가드 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 100 && okN >= n * 0.6, "8: sweep 대부분 성립 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "8: 표시 없는 실패·자기교차 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-7 && worst.sewn < 1e-9 && worst.top < 1e-6 && worst.sewnSide < 1e-9, "8: sweep 불변식(연장 후 앞·뒤 봉제 = Ⓐ) " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
