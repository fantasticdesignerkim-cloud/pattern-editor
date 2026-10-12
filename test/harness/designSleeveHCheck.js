// ══════════════════════════════════════════════
// designSleeveHCheck.js — js/designSleeveH.js(소매 Ⓗ 퍼프, [패턴학교] P.44 — 2026-10-11 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값 (2) EL 위 = Ⓐ(O·SP·소매산) (3) 산식 ●·■·∅·∅/3 ↔ 실측 벌림 (4) 조각 강체·★·☆ (5) 소맷부리 8 끝점 곡선·개더·S 굽이 (6) 겹침·자기교차
//   (7) 길이·이세 구분 (8) 입력·기하 가드·결정성 (9) sweep
//   node test/harness/designSleeveHCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveH.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SH = W.designSleeveH, DS = W.designSleeve;
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

const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const ringH = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
const role = (g, r) => g.outline.find(s => s.role === r), cons = (g, r) => g.construction.find(c => c.role === r);

// ── 1. API ──
{
  ok(typeof SH.draftSleeveH === "function" && Object.isFrozen(SH) && Object.isFrozen(SH.RULES), "1: API 동결");
  const R = SH.RULES;
  ok(R.elbowDefaultCm === 31.4 && R.palmDefaultCm === 21 && R.cuffAddCm === 3 && R.cuffWidthCm === 1 && R.dropDefaultCm === 3.5 && R.cuts === 3, "1: 김님 기본값(EL 31.4 · 손바닥 21 · 커프스 +3 · 폭 1 · ★ 3.5) · 절개 3");
}
const BA = bodiceResultOf("A");
const A = SA.draftSleeveA(BA, { sleeveLengthCm: 52 });
const Hh = SH.draftSleeveH(A, {});
ok(A.ok && Hh.ok, "기준: B83 SL52 기본 성공 " + (Hh.reason || ""));
const m = Hh.meta, g = Hh.geometry, aO = A.geometry.outline, SPA = A.meta.sp, Hy = A.meta.sleeveLengthCm, W0 = A.meta.bicepCm;
const Ub = aO[1].from, Uf = aO[2].from, Yel = SPA.y + 31.4;

// ── 2. EL 위 = Ⓐ ──
{
  ok(J(role(g, "cap").commands) === J(aO[0].commands), "2: 소매산 = Ⓐ 그대로(SP·O 불변)");
  ok(J(m.sp) === J(SPA) && Math.abs(m.elY - Yel) < 1e-12, "2: SP 불변 · EL = SP + 31.4");
  const fu = role(g, "side-seam-front-upper"), bu = role(g, "side-seam-back-upper");
  ok(D(fu.from, Uf) < 1e-12 && D(fu.to, { x: Uf.x, y: Yel }) < 1e-12 && D(bu.to, Ub) < 1e-12 && D(bu.from, { x: Ub.x, y: Yel }) < 1e-12, "2: 위팔~EL 옆선 = Ⓐ(☆ = EL × 옆선)");
}

// ── 3. 산식 ↔ 실측 ──
{
  const cuff = 21 + 3, sq = W0 - cuff, sp = cuff - sq, per = sp / 3;
  ok(Math.abs(m.cuff.lengthCm - cuff) < 1e-12 && m.cuff.widthCm === 1 && Math.abs(m.formula.square - sq) < 1e-12 && Math.abs(m.formula.spread - sp) < 1e-12 && Math.abs(m.formula.perCut - per) < 1e-12, "3: ● = 24 · ■ = W − ● · ∅ = ● − ■ · ∅/3 = " + per.toFixed(3));
  const P = m.hem.points; // 앞 바깥 → … → 뒤 바깥
  const oa = D(P[3], P[4]), obf = D(P[1], P[2]), obb = D(P[5], P[6]);
  ok([oa, obf, obb].every(v => Math.abs(v - per) < 1e-9), "3: 실측 벌림(소맷부리 끝점 현) a " + oa.toFixed(4) + " · b 앞 " + obf.toFixed(4) + " · 뒤 " + obb.toFixed(4));
  const poly = polyLen(P);
  ok(Math.abs(poly - 2 * cuff) < 1e-9 && Math.abs(m.hem.polylineCm - poly) < 1e-9, "3: 끝점 꺾은선 합 = W + ∅ = 2● (산식 대수 일치)");
}

// ── 4. 조각 강체·★·☆ ──
{
  const xb = (Ub.x + SPA.x) / 2, xf = (Uf.x + SPA.x) / 2, Hh_ = Hy - Yel;
  const sizes = { backOuter: xb - Ub.x, backInner: SPA.x - xb, frontInner: xf - SPA.x, frontOuter: Uf.x - xf };
  Object.keys(sizes).forEach(k => { const q = m.rigid[k]; ok(Math.abs(D(q[0], q[1]) - sizes[k]) < 1e-9 && Math.abs(D(q[1], q[2]) - Hh_) < 1e-9 && Math.abs(D(q[0], q[2]) - Math.hypot(sizes[k], Hh_)) < 1e-9, "4: 강체 직사각형 " + k); });
  ok(D(cons(g, "cut-a-back").from, { x: SPA.x, y: Yel + 3.5 }) < 1e-9 && D(cons(g, "cut-a-front").from, { x: SPA.x, y: Yel + 3.5 }) < 1e-9, "4: a 기준점 C″ = 중심선 위 EL + ★ (가운데 두 조각 ★ 만큼 내림)");
  ok(D(m.rigid.backOuter[0], { x: Ub.x, y: Yel }) < 1e-9 && D(m.rigid.frontOuter[1], { x: Uf.x, y: Yel }) < 1e-9, "4: 바깥 조각은 ☆ 에 붙어 회전");
  ok(["backInner", "frontInner"].every(k => m.rigid[k].every(p => p.y > Yel + 1e-9)) && ["backOuter", "frontOuter"].every(k => m.rigid[k].every(p => p.y >= Yel - 1e-9)), "4: EL 아래 조각이 EL 위(고정 영역)로 올라가지 않음");
}

// ── 5. 소맷부리(김님 2026-10-12 truing — 양 끝 고정 · 조금 파임 허용 · 변곡 없음 · 곡률 연속) ──
{
  const hc = cubsOf(role(g, "hem")), P = m.hem.points, F = m.hem.fair;
  ok(D(hc[0][0], P[0]) < 1e-12 && D(hc[hc.length - 1][3], P[7]) < 1e-12 && D(role(g, "side-seam-front-lower").to, P[0]) < 1e-12 && D(role(g, "side-seam-back-lower").from, P[7]) < 1e-12, "5: 양 끝 = 옆선 아래끝 그대로");
  const kap = (q, t) => { const a = der(q, t), u = 1 - t, b = { x: 6 * u * (q[2].x - 2 * q[1].x + q[0].x) + 6 * t * (q[3].x - 2 * q[2].x + q[1].x), y: 6 * u * (q[2].y - 2 * q[1].y + q[0].y) + 6 * t * (q[3].y - 2 * q[2].y + q[1].y) }; return (a.x * b.y - a.y * b.x) / Math.pow(Math.hypot(a.x, a.y), 3); };
  let g1 = 0, kj = 0; for (let i = 1; i < hc.length; i++) { g1 = Math.max(g1, ang(der(hc[i - 1], 1), der(hc[i], 0))); kj = Math.max(kj, Math.abs(kap(hc[i - 1], 1) - kap(hc[i], 0))); }
  const ks = []; hc.forEach(q => { for (let k = 0; k <= 400; k++) ks.push(kap(q, k / 400)); });
  ok(g1 < 1e-6 && kj < 1e-6, "5: 이음 접선 연속 + 곡률 연속(독립) g1 " + g1.toExponential(1) + " · Δκ " + kj.toExponential(1));
  ok(ks.every(k => k <= 1e-9) || ks.every(k => k >= -1e-9), "5: 변곡 없음(곡률 부호 하나, 독립)");
  const L = polyLen(dense(hc, 4000));
  ok(Math.abs(L - m.hem.lengthCm) < 1e-4 && Math.abs(m.hem.gatherCm - (m.hem.lengthCm - 24)) < 1e-12, "5: 최종 곡선 실측 = " + L.toFixed(4) + " · 개더 = 호 − ● = " + m.hem.gatherCm.toFixed(4) + "(산식 2● 와 구분)");
  // 원래 모서리 파임/덧댐(독립): 각 안쪽 모서리 x 에서 곡선 y − 모서리 y
  const yAt = x => { for (const q of hc) if ((q[0].x - x) * (q[3].x - x) <= 0) { let lo = 0, hi = 1; const inc = q[3].x > q[0].x; for (let k = 0; k < 80; k++) { const md = (lo + hi) / 2; if ((cub(q, md).x < x) === inc) lo = md; else hi = md; } return cub(q, (lo + hi) / 2).y; } };
  const dy = P.slice(1, -1).map(p => yAt(p.x) - p.y), cut = Math.max(0, -Math.min(...dy)), out = Math.max(0, Math.max(...dy));
  ok(Math.abs(cut - F.maxCutCm) < 1e-6 && Math.abs(out - F.maxOutwardCm) < 1e-6, "5: 최대 파임 " + cut.toFixed(3) + " · 바깥 덧댐 " + out.toFixed(3) + "(독립)");
  ok(cut < 0.2 && out < 0.3 && !F.largeDeviationNote, "5: 기본값은 작은 파임/덧댐(< 0.2 / < 0.3)");
  ok(F.previous8Point && Math.abs(F.changeFromPreviousCm - (m.hem.lengthCm - F.previous8PointCm)) < 1e-12 && F.areaCutCm2 >= 0 && F.areaAddedCm2 >= 0, "5: 이전 8점 곡선·면적 기록(감사)");
  // 원조각 데이터 불변: 강체 조각 아래 모서리 = 소맷부리 끝점(8점) 그대로
  ok([m.rigid.frontOuter[2], m.rigid.backInner[3]].every(c => P.some(p => D(p, c) < 1e-9)), "5: 원래 종이 데이터 불변(조각 모서리 = 끝점)");
}

// ── 6. 겹침·자기교차 ──
{
  ok(!selfX(ringH(g)), "6: 자기교차 없음(독립)");
  ok(selfX([{ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 0, y: 0 }]), "6: 독립 검사기 자체 확인");
  const segs = q => [[q[0], q[1]], [q[1], q[2]], [q[2], q[3]], [q[3], q[0]]], keys = ["backOuter", "backInner", "frontInner", "frontOuter"];
  let cross = 0; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) segs(m.rigid[keys[i]]).forEach(a => segs(m.rigid[keys[j]]).forEach(b => { if (D(a[0], b[0]) > 1e-9 && D(a[0], b[1]) > 1e-9 && D(a[1], b[0]) > 1e-9 && D(a[1], b[1]) > 1e-9 && xseg(a[0], a[1], b[0], b[1])) cross++; }));
  ok(cross === 0, "6: 강체 조각끼리 겹침 없음(변 교차 " + cross + ")");
}

// ── 7. 길이·이세 ──
{
  const hc = cubsOf(role(g, "hem")); let yC = null;
  for (const q of hc) if ((q[0].x - SPA.x) * (q[3].x - SPA.x) <= 0) { let lo = 0, hi = 1; const inc = q[3].x > q[0].x; for (let k = 0; k < 80; k++) { const md = (lo + hi) / 2; if ((cub(q, md).x < SPA.x) === inc) lo = md; else hi = md; } yC = cub(q, (lo + hi) / 2).y; break; }
  ok(Math.abs((yC - SPA.y) - m.centerLength.spreadCm) < 1e-9 && m.centerLength.inputCm === 52 && m.centerLength.spreadCm > 52, "7: 입력 52 vs 펼친 중심 " + (yC - SPA.y).toFixed(3) + "(구분)");
  const prim = DS.capPrimitives(g), primA = DS.capPrimitives(A.geometry);
  ok(Math.abs(prim.lengths.total - primA.lengths.total) < 1e-12, "7: 소매산 길이·이세 = Ⓐ(소맷부리 개더와 별개)");
}

// ── 8. 입력·가드·결정성 ──
{
  ok(SH.draftSleeveH(A, { dropCm: 1 }).reason === "pieces-overlap", "8: ★ 1 → 가운데 조각이 EL 위로(겹침) 거부");
  ok(SH.draftSleeveH(A, { elbowLengthCm: 5 }).reason === "el-out-of-range" && SH.draftSleeveH(A, { elbowLengthCm: 60 }).reason === "el-out-of-range", "8: EL 범위 밖(기하)");
  ok(SH.draftSleeveH(A, { palmCircumferenceCm: 10 }).reason === "no-spread", "8: 커프스 ≤ 소맷부리/2 → 벌릴 분량 없음");
  [["elbowLengthCm", 0], ["palmCircumferenceCm", -1], ["dropCm", NaN]].forEach(([k, v]) => ok(/^invalid-/.test(SH.draftSleeveH(A, { [k]: v }).reason), "8: 거부 " + k + "=" + v));
  const pA = SH.draftSleeveH(A, { palmCircumferenceCm: 25 }), dA = SH.draftSleeveH(A, { dropCm: 6 });
  ok(pA.ok && Math.abs(pA.meta.cuff.lengthCm - 28) < 1e-12 && dA.ok && dA.meta.centerLength.spreadCm > m.centerLength.spreadCm, "8: 손바닥·★ 변경 반영");
  const Af = deepFreeze(JSON.parse(J(A))), before = J(Af), e1 = SH.draftSleeveH(Af, {}), e2 = SH.draftSleeveH(Af, { elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 });
  ok(e1.ok && J(e1) === J(e2) && J(Af) === before && J(e1) === J(Hh), "8: 동결 입력 · 결정성 · 기본값");
  ok(SH.draftSleeveH(null, {}).reason === "no-sleeve-a", "8: Ⓐ 없음");
}

// ── 9. sweep ──
{
  let n = 0, okN = 0; const out = {}, bad = []; const worst = { open: 0, poly: 0, hemLen: 0, sMax: 0 };
  for (const sym of symbols()) {
    const br = bodiceResultOf(sym); if (!br) continue;
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue;
      for (const [el, palm, drop] of [[31.4, 21, 3.5], [28, 19, 3], [31.4, 24, 5], [25, 21, 2.5]]) {
        n++;
        const r = SH.draftSleeveH(a, { elbowLengthCm: el, palmCircumferenceCm: palm, dropCm: drop });
        if (!r.ok) { out[r.reason] = (out[r.reason] || 0) + 1; if (!r.outOfSupportedRange) bad.push(sym + SL + "/" + el + "/" + palm + "/" + drop + ":" + r.reason); continue; }
        okN++;
        const M = r.meta, P = M.hem.points;
        worst.open = Math.max(worst.open, Math.abs(D(P[3], P[4]) - M.formula.perCut), Math.abs(D(P[1], P[2]) - M.formula.perCut), Math.abs(D(P[5], P[6]) - M.formula.perCut));
        worst.poly = Math.max(worst.poly, Math.abs(M.hem.polylineCm - 2 * M.cuff.lengthCm));
        worst.hemLen = Math.max(worst.hemLen, M.hem.lengthCm - M.hem.polylineCm);
        worst.sMax = Math.max(worst.sMax, M.hem.fair.maxCutCm, M.hem.fair.maxOutwardCm); if (M.hem.fair.largeDeviationNote) { worst.flagged = (worst.flagged || 0) + 1; if (!/김님 2026-10-12 Ⓗ 검토 범위 승인/.test(M.hem.fair.largeDeviationNote) || !(Math.max(M.hem.fair.maxCutCm, M.hem.fair.maxOutwardCm) > 1)) bad.push(sym + SL + ":note"); }
        if (M.hem.fair.inflections !== 0) bad.push(sym + SL + ":hemInfl");
        if (selfX(ringH(r.geometry))) bad.push(sym + SL + ":selfX");
        if (J(r.geometry.outline[0].commands) !== J(a.geometry.outline[0].commands)) bad.push(sym + SL + ":cap");
      }
    }
  }
  console.log("  sweep: " + okN + "/" + n + " 성공 · 기하 가드 " + J(out) + " · 최악 " + J(worst));
  ok(n >= 80 && okN >= n * 0.8, "9: sweep 대부분 성립 " + okN + "/" + n + " " + J(out));
  ok(!bad.length, "9: 표시 없는 실패·자기교차·소매산 변경 없음 " + bad.slice(0, 4).join(" "));
  ok(worst.open < 1e-9 && worst.poly < 1e-9, "9: sweep 불변식(벌림 = ∅/3 · 꺾은선 = 2● · 소맷부리 변곡 0) " + J(worst));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
