// ══════════════════════════════════════════════
// designSleeveOCheck.js — js/designSleeveO.js(소매 Ⓞ 턱트 슬리브, [패턴학교] P.47 하단 — 2026-10-21 김님 확정 · 화면 검토용 시안) 전용 회귀.
//   (1) API·기본값(소매길이 20 · 안쪽 절개 1.25 · 간격 2.5 · 벌림 2 · 소맷부리 박기 끝 1.5 — 책 기본 설정값 · 소매산 박음 미지정)
//   (2) 절개 위치(도해 «2.5» = 가운데 띠 폭 → ±1.25 · ±3.75) · 평행 이동(독립 역이동) · 원래 종이 5조각 · 중심선 미절개
//   (3) 턱 접기(독립 구현): 바깥쪽으로 접음 — 접은 소매산·소맷부리 = Ⓐ · 겹은 중심 쪽 조각 아래(유효한 층 겹침 ≠ 평면 자기교차) · 왕복
//   (4) 소매산·소맷부리 재단/봉제 길이 독립 실측 · 참고 W + 틈 합 구분 · 이세 = 접은 소매산 − AH (5) 박기 끝 (6) 입력 원문·결정성 (7) sweep
//   node test/harness/designSleeveOCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveO.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SO = W.designSleeveO;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presets = () => { const o = []; for (const f of BP.families()) for (const v of f.variants) o.push([v.symbol, v.presetId]); return o; };
function bodiceResultOf(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? r.result : null; }
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }

// ── 독립 측정(모듈과 다른 구현) ──
const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function cubsOf(p) { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; }
const dense = (cs, n) => { const o = []; cs.forEach((q, i) => { for (let k = i ? 1 : 0; k <= n; k++) o.push(cub(q, k / n)); }); return o; };
const polyLen = (pts) => { let t = 0; for (let i = 1; i < pts.length; i++) t += D(pts[i - 1], pts[i]); return t; };
const crossO = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
const xseg = (a, b, c, d) => ((crossO(c, d, a) > 0) !== (crossO(c, d, b) > 0)) && ((crossO(a, b, c) > 0) !== (crossO(a, b, d) > 0));
function selfX(r) { const n = r.length; for (let i = 0; i < n - 1; i++) for (let j = i + 2; j < n - 1; j++) { if (i === 0 && j === n - 2) continue; if (xseg(r[i], r[i + 1], r[j], r[j + 1])) return true; } return false; }
const seg = (g, role) => g.outline.find(s => s.role === role);
const ring = (g) => { const r = []; g.outline.forEach(s => { if (s.kind === "path") dense(cubsOf(s), 40).forEach((p, i) => { if (r.length && i === 0) return; r.push(p); }); else r.push(s.to); }); return r; };
// 독립 길이: 경로를 촘촘히 펴서 재고, 턱 입구(construction 의 접는 선·맞출 선 끝 사이)를 빼서 봉제 길이
function lensIndep(g, role, creaseRole, placeRole, end) {
  const cs = cubsOf(seg(g, role)), pts = dense(cs, 400), cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + D(pts[i - 1], pts[i]));
  const at = p => { let b = -1, bd = Infinity; pts.forEach((q, i) => { const d = D(q, p); if (d < bd) { bd = d; b = i; } }); return cum[b]; };
  let hidden = 0;
  g.construction.filter(c => c.role === creaseRole).forEach(c => { const pl = g.construction.find(x => x.role === placeRole && x.tuck === c.tuck); hidden += Math.abs(at(c[end]) - at(pl[end])); });
  return { cut: cum[cum.length - 1], sewn: cum[cum.length - 1] - hidden };
}

const BA = bodiceResultOf(presets().find(p => p[0] === "A")[1]);
const A20 = SA.draftSleeveA(BA, { sleeveLengthCm: 20 });
const r = SO.draftSleeveO(A20, {});
const m = r.meta, g = r.geometry;
const sp = A20.meta.sp, H = A20.meta.sleeveLengthCm, Wd = A20.meta.bicepCm, X0 = sp.x;
const XL = A20.geometry.outline[1].to.x, XR = A20.geometry.outline[2].to.x;
const capA = cubsOf(A20.geometry.outline[0]);
const yA = x => { const pts = dense(capA, 200); for (let i = 1; i < pts.length; i++) if ((pts[i - 1].x - x) * (pts[i].x - x) <= 0) { const t = (x - pts[i - 1].x) / (pts[i].x - pts[i - 1].x || 1); return pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t; } return NaN; };

// (1) API·기본값
ok(typeof SO.draftSleeveO === "function" && typeof SO.capLengthsOf === "function" && typeof SO.hemLengthsOf === "function" && Object.isFrozen(SO) && Object.isFrozen(SO.RULES), "1: API·RULES 동결");
ok(SO.RULES.sleeveLengthDefaultCm === 20 && SO.RULES.innerOffsetDefaultCm === 1.25 && SO.RULES.cutSpacingDefaultCm === 2.5 && SO.RULES.spreadDefaultCm === 2 && SO.RULES.stitchEndDefaultCm === 1.5 && SO.RULES.capStitchEndCm === null, "1: 책 기본 설정값 · 소매산 박음 미지정(null)");
ok(r.ok && /산식·불변 규칙 아님/.test(m.settings.note) && /가운데 띠 폭/.test(m.settings.bookDimension) && /중심→절개 2\.5 가 아니다/.test(m.settings.bookDimension), "1: 설정값 표기 · 도해 «2.5» = 가운데 띠 정정 기록");
ok(!("cuff" in m) && !("gather" in m) && !("rise" in m) && m.stitchEnd.capCm === null && /미지정/.test(m.stitchEnd.capStatus), "1: 커프스·개더·상승 없음 · 소매산 박음 미지정");

// (2) 절개 위치·평행 이동
const cx = m.cutLines.x;
ok(near(cx.backInner, X0 - 1.25) && near(cx.frontInner, X0 + 1.25) && near(cx.backOuter, X0 - 3.75) && near(cx.frontOuter, X0 + 3.75) && m.cutLines.centerStripCm === 2.5 && m.cutLines.centerCut === false, "2: 절개 ±1.25 · ±3.75 · 가운데 띠 2.5 · 중심선 미절개");
const sh = m.spread.shiftCm;
ok(sh.backOuter === -4 && sh.backInner === -2 && sh.center === 0 && sh.frontInner === 2 && sh.frontOuter === 4 && m.spread.rotationDeg === 0 && m.spread.parallel, "2: 평행 이동 0 · ±2 · ±4(회전 없음)");
const pcs = m.rigid.pieces, keys = ["backOuter", "backInner", "center", "frontInner", "frontOuter"], ranges = [[XL, X0 - 3.75], [X0 - 3.75, X0 - 1.25], [X0 - 1.25, X0 + 1.25], [X0 + 1.25, X0 + 3.75], [X0 + 3.75, XR]];
ok(keys.every((k, i) => pcs[k].every(p => { const q = { x: p.x - [-4, -2, 0, 2, 4][i], y: p.y }; return q.x >= ranges[i][0] - 1e-9 && q.x <= ranges[i][1] + 1e-9 && (Math.abs(q.y - H) < 1e-9 || Math.abs(q.y - yA(q.x)) < 0.01); })), "2: 원래 종이 5조각 = Ⓐ 띠를 평행 이동한 그대로(독립 역이동)");
ok(near(D(m.underarm.after.back, m.underarm.before.back), 4) && near(m.widthAfterCm - m.widthCm, 8) && near(m.seams.backCm, H - A20.geometry.outline[1].from.y, 1e-9), "2: 소매폭 +8 · 옆선 길이 그대로");

// (3) 턱 접기 — 독립 구현(평행 역이동 · 거울)
const capCs = cubsOf(seg(g, "cap")), hemCs = cubsOf(seg(g, "hem"));
const tk = m.tucks;
ok(Object.values(tk).every(t => /바깥쪽/.test(t.direction) && /중심 쪽/.test(t.crease) && /바깥/.test(t.place)), "3: 턱 방향 = 바깥쪽 · 접는 선 = 중심 쪽 조각 변 · 맞출 선 = 바깥 조각 변");
ok(tk["back-inner"].topLayer === "center" && tk["front-inner"].topLayer === "center" && tk["back-outer"].topLayer === "backInner" && tk["front-outer"].topLayer === "frontInner", "3: 위층 = 중심 쪽 조각(Ⓝ 과 반대)");
// 각 소매산 표본점을 소속 조각/겹으로 접어 Ⓐ 소매산 위인지(독립): 조각 구간이면 역이동, 턱 입구면 맞출 조각 역이동(둘째 겹) 또는 거울 ∘ 접는 조각 역이동(첫 겹)
const shifts = { backOuter: -4, backInner: -2, center: 0, frontInner: 2, frontOuter: 4 };
let capFoldDev = 0;
dense(capCs, 30).forEach(p => {
  let best = Infinity;
  keys.forEach(k => { const q = { x: p.x - shifts[k], y: p.y }; if (q.x >= ranges[keys.indexOf(k)][0] - 1e-9 && q.x <= ranges[keys.indexOf(k)][1] + 1e-9) best = Math.min(best, Math.abs(q.y - yA(q.x))); });
  Object.values(tk).forEach(t => {
    const c = t.cutX, side = t.cap.crease.x > t.cap.place.x ? 1 : -1, lo = Math.min(c, c + side), hi = Math.max(c, c + side);
    const crK = t.topLayer, plK = keys[keys.indexOf(crK) - side];
    const q2 = { x: p.x - shifts[plK], y: p.y }; if (q2.x >= lo - 1e-9 && q2.x <= hi + 1e-9) best = Math.min(best, Math.abs(q2.y - yA(q2.x)));
    const q1 = { x: 2 * c - (p.x - shifts[crK]), y: p.y }; if (q1.x >= lo - 1e-9 && q1.x <= hi + 1e-9) best = Math.min(best, Math.abs(q1.y - yA(q1.x)));
  });
  capFoldDev = Math.max(capFoldDev, best);
});
ok(capFoldDev < 0.01, "3: 펼친 소매산의 모든 점이 접으면 Ⓐ 소매산 위(독립 접기 · 표본 보간 오차 " + capFoldDev.toExponential(1) + ")");
ok(hemCs.every(q => [0, 0.5, 1].every(t => near(cub(q, t).y, H, 1e-12))) && m.hem.straight, "3: 소맷부리 = 직선(턱 입구 포함)");
ok(m.folded.maxDevCm < 1e-9 && m.folded.layersOnAMaxCm < 1e-9 && m.folded.layerRangeMaxCm < 1e-9 && m.folded.roundTripMaxCm < 1e-9 && m.folded.tileGapCm.cap < 1e-9 && m.folded.tileGapCm.hem < 1e-9, "3: 엔진 접기·왕복·이음 검증값");
ok(m.folded.cutCm === 0 && m.folded.addedCm === 0 && /불필요/.test(m.folded.truing), "3: 접은 상태 정리 없음(파임·덧댐 0) 명시");
ok(!selfX(ring(g)), "3: 펼친 외곽 단일 연속 · 자기교차 없음(접힘 층 겹침은 평면 교차로 보지 않음)");
ok(Object.values(tk).every(t => Math.min(t.cap.crease.y, t.cap.place.y) - t.cap.mid.y > 0 && t.cap.crease.y === t.cap.place.y), "3: 소매산 턱 입구 = 접기로 정해진 산(양 모서리 같은 높이 · 가운데가 높다)");

// (4) 길이 — 독립 실측
const capI = lensIndep(g, "cap", "tuck-crease-edge", "tuck-place-edge", "from"), hemI = lensIndep(g, "hem", "tuck-crease", "tuck-place", "from");
ok(Math.abs(capI.cut - m.cap.cutCm) < 1e-3 && Math.abs(capI.sewn - m.cap.sewnCm) < 1e-3 && Math.abs(hemI.cut - m.hem.cutCm) < 1e-6 && Math.abs(hemI.sewn - m.hem.sewnCm) < 1e-6, "4: 소매산·소맷부리 재단/봉제 = 최종 geometry 독립 실측");
const capATotal = polyLen(dense(capA, 400));
ok(Math.abs(m.cap.sewnCm - capATotal) < 1e-3 && Math.abs(m.folded.capSewnCm - m.cap.sewnCm) < 1e-6 && m.cap.cutCm > m.cap.sewnCm + 8, "4: 소매산 봉제(턱 접음) = Ⓐ 소매산 · 재단 > 봉제 + 8");
ok(near(m.hem.cutCm, Wd + 8, 1e-9) && near(m.hem.sewnCm, Wd, 1e-9) && m.hem.formulaCutCm === Wd + 8, "4: 소맷부리 재단 W + 8 · 봉제 W(참고 산식과 같음 — 직선)");
ok(near(m.easeAfter.total, m.cap.sewnCm - m.armholeCm.back - m.armholeCm.front, 1e-9) && near(m.cap.sewn.back + m.cap.sewn.front, m.cap.sewnCm, 1e-9) && near(m.cap.cut.back + m.cap.cut.front, m.cap.cutCm, 1e-9), "4: 이세 = 접은 소매산 − AH · 앞 + 뒤 = 총");
const cl = SO.capLengthsOf(g);
ok(cl && near(cl.split.x, X0, 1e-12) && near(cl.split.y, sp.y, 1e-12) && g.capSplit.x === X0, "4: 소매산 앞/뒤 분할 = SP(중심선)");

// (5) 박기 끝
const r3 = SO.draftSleeveO(A20, { stitchEndCm: 3 });
ok(r3.ok && J(r3.geometry.outline) === J(g.outline) && J(r3.geometry.construction) !== J(g.construction), "5: 박기 끝 길이는 재단선 불변 · 표시선만");
ok(g.construction.filter(c => c.role === "tuck-crease").every(c => near(D(c.from, c.to), 1.5, 1e-9)) && g.construction.filter(c => c.role === "tuck-stitch-end").length === 4, "5: 소맷부리 박음 다리 1.5 · 박기 끝선 4 · 소매산 박음선 없음");
const rB = SO.draftSleeveO(A20, { stitchEndCm: 25 });
ok(!rB.ok && rB.reason === "stitch-end-beyond-cap" && rB.detail.stitchEndCm === 25, "5: 박기 끝 > 다리 → 막음(값 그대로)");

// (6) 입력·결정성
[["innerOffsetCm", 0], ["cutSpacingCm", -1], ["spreadCm", NaN], ["stitchEndCm", 0], ["spreadCm", "2"]].forEach(([k, v]) => {
  const x = SO.draftSleeveO(A20, { [k]: v });
  ok(!x.ok && /^invalid-/.test(x.reason) && (Number.isNaN(v) ? Number.isNaN(x.detail) : x.detail === v), "6: 무효 입력 " + k + "=" + String(v) + " → 사유 · 원문 그대로");
});
const rx = SO.draftSleeveO(A20, { innerOffsetCm: 0.9 });
ok(!rx.ok && rx.reason === "tuck-layer-exceeds-piece" && rx.outOfSupportedRange && rx.detail.tuck === "back-inner", "6: 가운데 띠가 두 겹을 못 받음 = 모델 범위 밖(물리 불가 판정 아님)");
const rw = SO.draftSleeveO(A20, { cutSpacingCm: 20 });
ok(!rw.ok && rw.reason === "cut-outside-sleeve", "6: 바깥 절개 > 반폭 → 막음");
const Af = deepFreeze(JSON.parse(J(A20))), r2 = SO.draftSleeveO(Af, {});
ok(r2.ok && J(r2) === J(r) && r.sourceSleeveAHash === r2.sourceSleeveAHash, "6: 결정성 · 동결된 Ⓐ 그대로");

// (7) sweep
let swOk = 0, swBad = [];
for (const SL of [15, 20, 30]) { const As = SA.draftSleeveA(BA, { sleeveLengthCm: SL });
  for (const a of [1, 1.25, 2]) for (const s of [1.5, 2.5, 4]) for (const g2 of [1, 2, 2.5]) for (const se of [0.5, 1.5]) {
    const x = SO.draftSleeveO(As, { innerOffsetCm: a, cutSpacingCm: s, spreadCm: g2, stitchEndCm: se });
    if (!x.ok) { if (!["tuck-layer-exceeds-piece", "cut-outside-sleeve", "pieces-overlap"].includes(x.reason)) swBad.push([SL, a, s, g2, x.reason]); continue; }
    const hI = lensIndep(x.geometry, "hem", "tuck-crease", "tuck-place", "from");
    if (!(near(x.meta.hem.sewnCm, As.meta.bicepCm, 1e-9) && near(x.meta.hem.cutCm, As.meta.bicepCm + 4 * g2, 1e-9) && Math.abs(hI.sewn - As.meta.bicepCm) < 1e-6
      && Math.abs(x.meta.cap.sewnCm - x.meta.capLengthsA.total) < 5e-3 && !selfX(ring(x.geometry)) && x.meta.folded.roundTripMaxCm < 1e-9)) swBad.push([SL, a, s, g2, "invariant"]);
    else swOk++;
  } }
ok(swBad.length === 0 && swOk > 80, "7: sweep " + swOk + " 성공 · 불변식 위반/예상 밖 실패 " + J(swBad).slice(0, 200));

console.log("══════════════════════════════════════════════");
if (fails.length) { console.log("실패:"); fails.forEach(f => console.log("  " + f)); }
console.log("designSleeveOCheck: " + PASS + " PASS / " + FAIL + " FAIL");
process.exitCode = FAIL ? 1 : 0;
