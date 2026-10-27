// ══════════════════════════════════════════════
// sleeveOFoldStabilityCheck.js — 소매 Ⓞ 접기 검증의 수치 안정성(2026-10-28).
//   원인(재현): 바깥 앞 조각의 끝 표본이 평행 이동(+2g)·역이동(−2g)의 부동소수 왕복으로 Ⓐ 소매산 끝(Uf.x)을 1ulp(1.8e-15cm) 넘어
//   yAtX 가 NaN → foldDev = NaN → «fold-mismatch(detail NaN)». 강체 불변식 위반이 아니라 비교 정의역 문제였다.
//   수정: 접은 점의 정의역 밖 거리(넘친 x)를 편차에 그대로 넣어 판정(끝점 y 차와 넘침 중 큰 값) · 정의역 안 NaN 은 무한대로 실패.
//   (1) 재현값 고정(박시·Ⓗ/Ⓜ/Ⓝ 지원값·Ⓜ 비반올림값) (2) 섭동·매개변수 sweep (3) 독립 검산(왕복·접은 소매산/소맷부리·봉제 길이·단일 외곽)
//   (4) 기본 형상 바이트 불변 (5) 오류 주입은 여전히 차단 (6) 실제 몸판 22종 Ⓐ → Ⓞ
//   node test/harness/sleeveOFoldStabilityCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const OSRC = fs.readFileSync(path.join(ROOT, "js", "designSleeveO.js"), "utf8");

function makeO(src) {
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date };
  sb.globalThis = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "designSleeveA.js"), "utf8"), sb, { filename: "designSleeveA.js" });
  vm.runInContext(src, sb, { filename: "designSleeveO.js" });
  return sb.window;
}
const W = makeO(OSRC), SA = W.designSleeveA, SO = W.designSleeveO;
const DEF = { innerOffsetCm: 1.25, cutSpacingCm: 2.5, spreadCm: 2, stitchEndCm: 1.5 };
const A_ = (b, f, hb, hf, L) => SA.draftFromMeasures({ backAHCm: b, frontAHCm: f, backShoulderHeightCm: hb, frontShoulderHeightCm: hf }, { sleeveLengthCm: L || 20 });

// 독립 검산: 결과 외곽이 한 줄로 닫히는지 · 소매산/소맷부리 봉제 길이 · 접기 meta
const cubI = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
const ends = s => s.kind === "line" ? [s.from, s.to] : [s.commands[0].points[0], s.commands[s.commands.length - 1].points[2]];
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function physical(o, a) {
  const g = o.geometry.outline, e = g.map(ends);
  let chain = 0; for (let i = 0; i < e.length; i++) chain = Math.max(chain, D(e[i][1], e[(i + 1) % e.length][0]));
  const capA = a.meta.capLengths.total, m = o.meta;
  return { chain, fold: m.folded.maxDevCm, layer: m.folded.layersOnAMaxCm, range: m.folded.layerRangeMaxCm, rt: m.folded.roundTripMaxCm,
    capSewn: Math.abs(m.cap.sewnCm - capA), hemSewn: Math.abs(m.hem.sewnCm - m.widthCm), self: m.checks.selfIntersection };
}
const good = p => p.chain < 1e-9 && p.fold < 1e-9 && p.layer < 1e-9 && p.range < 1e-9 && p.rt < 1e-9 && p.capSewn < 5e-3 && p.hemSewn < 1e-9 && p.self === false;

// ── 1. 재현값 고정 ──
{
  const cases = [["Ⓗ/Ⓜ/Ⓝ 지원값 · 높이 반올림", 21.5865, 20.6269, 17.7394, 16.38], ["Ⓜ 비반올림 AH", 21.586459197203904, 20.626926955400037, 17.7394, 16.38],
    ["박시 + 앞 1e-7", 21.5852, 20.6271 + 1e-7, 17.7398, 16.3804], ["Ⓗ 값 + 뒤 1e-6(보고 재현)", 21.5865 + 1e-6, 20.6269, 17.7394, 16.38]];
  cases.forEach(([nm, b, f, hb, hf]) => { const a = A_(b, f, hb, hf), o = SO.draftSleeveO(a, DEF);
    ok(a.ok && o.ok && good(physical(o, a)), "1: " + nm + " → 성립 · 물리 검산 " + (o.ok ? J(physical(o, a)) : o.reason)); });
}
// ── 2. 섭동 · 매개변수 sweep ──
{
  const bases = [[21.5852, 20.6271, 17.7398, 16.3804], [21.5865, 20.6269, 17.7394, 16.38], [21.586459197203904, 20.626926955400037, 17.7394, 16.38], [21.0, 21.0, 17.2, 17.2]];
  const eps = [0, 1e-8, -1e-8, 1e-7, -1e-7, 1e-6, -1e-6, 1e-5, -1e-5];
  const params = [{}, { innerOffsetCm: 1.0 }, { innerOffsetCm: 1.5 }, { cutSpacingCm: 2.0 }, { cutSpacingCm: 3.0 }, { spreadCm: 1.5 }, { spreadCm: 2.5 }, { stitchEndCm: 1.0 }];
  let n = 0, bad = [];
  bases.forEach(([b, f, hb, hf], bi) => eps.forEach(eb => [0, 1e-7, -1e-6].forEach(ef => [15, 20, 25].forEach(L => params.forEach(P => {
    const a = A_(b + eb, f + ef, hb, hf, L); if (!a.ok) { bad.push([bi, eb, ef, L, "A:" + a.reason]); return; }
    const o = SO.draftSleeveO(a, Object.assign({}, DEF, P)); n++;
    if (!o.ok || !good(physical(o, a))) bad.push([bi, eb, ef, L, J(P), o.ok ? "phys" : o.reason]);
  })))));
  ok(n === 4 * 9 * 3 * 3 * 8 && bad.length === 0, "2: 섭동 ±1e-8~1e-5 · 대칭/비대칭 AH · 기장 15/20/25 · 절개 위치·간격·벌림 sweep " + n + "건 전부 성립 " + J(bad.slice(0, 4)));
}
// ── 3. 기본 형상 바이트 불변(수정 전 HEAD 와 같은 값 — 통과하던 입력은 결과가 바뀌지 않는다) ──
{
  const o = SO.draftSleeveO(A_(21.5852, 20.6271, 17.7398, 16.3804, 20), {});
  ok(o.ok && crypto.createHash("sha256").update(J(o)).digest("hex") === "09dae41262661b0aed40cf57f407900bfe39d755a05ae73286ee8b44a230b7b1", "3: 박시 기본 Ⓞ 결과 바이트 = 수정 전");
}
// ── 4. 오류 주입 — 연속성은 유지한 채 접기 검사만 겨냥(소매산 조립 직후 주입): 실제 종이 어긋남·종이 밖은 여전히 차단 ──
{
  const anchor = "for (var j2 = 1; j2 < cap.length; j2++) cap[j2][0] = cp(cap[j2 - 1][3]);";
  const inj = add => { if (OSRC.indexOf(anchor) < 0) throw new Error("inject anchor missing"); return makeO(OSRC.replace(anchor, anchor + "\n" + add)).designSleeveO; };
  const run = Ox => Ox.draftSleeveO(A_(21.5852, 20.6271, 17.7398, 16.3804, 20), DEF);
  const r0 = run(inj("")); ok(r0.ok, "4: 주입 장치 자체는 무해(빈 주입 = 성립)");
  const r1 = run(inj("cap = cap.map(function (q) { return q.map(function (p) { return { x: p.x, y: p.y + 1e-5 }; }); });"));
  ok(!r1.ok && r1.reason === "fold-mismatch" && r1.detail > 9e-6, "4: 소매산 전체 1e-5 위로(이어진 채) → fold-mismatch " + (r1.reason || "") + " " + r1.detail);
  const r2 = run(inj("var zq = cap[cap.length - 1]; zq[2] = { x: zq[2].x + 1e-6, y: zq[2].y }; zq[3] = { x: zq[3].x + 1e-6, y: zq[3].y };"));
  ok(!r2.ok && r2.reason === "fold-mismatch" && r2.detail >= 1e-6 - 1e-12, "4: 바깥 앞 끝이 Ⓐ 끝을 1e-6 넘음(종이 밖 — 정의역 넘침) → fold-mismatch " + (r2.reason || "") + " " + r2.detail);
  const r3 = run(inj("var mq = cap[0]; mq[1] = { x: mq[1].x, y: mq[1].y - 1e-4 }; mq[2] = { x: mq[2].x, y: mq[2].y - 1e-4 };"));
  ok(!r3.ok && r3.reason === "fold-mismatch", "4: 바깥 뒤 조각 곡선이 1e-4 부풀음(끝점 고정) → fold-mismatch " + (r3.reason || ""));
  const r4 = run(inj("var lq = cap[pieceArcs[0].length]; lq[1] = { x: lq[1].x, y: lq[1].y + 1e-4 };"));
  ok(!r4.ok && /fold-(layer-)?mismatch/.test(r4.reason), "4: 턱 겹(입구) 곡선 1e-4 어긋남 → 차단(" + (r4.reason || "") + ")");
}
// ── 5. 실제 몸판 22종 Ⓐ → Ⓞ(기본값) ──
{
  let PROJECT = null;
  const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, c2p: (x, y) => [x * 10, y * 10],
    document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) } };
  sb.globalThis = sb; vm.createContext(sb); sb.window.designWorkflow = { current: () => PROJECT };
  ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
    "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "designSleeveA.js", "designSleeveO.js"]
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }));
  const X = sb.window, REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
  const bad = [];
  for (const f of X.bodicePresets.families()) for (const v of f.variants) {
    if (!v.presetId) continue; const body = X.bodicePresets.bodyParams(v.presetId);
    PROJECT = { sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF, working: { geometry: X.designBodice.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
    const r = X.bodiceCheckpoint.complete(PROJECT); if (!r.ok) { bad.push(v.symbol + ":bodice"); continue; }
    const a = X.designSleeveA.draftSleeveA(r.result, { sleeveLengthCm: 20 }), o = a.ok ? X.designSleeveO.draftSleeveO(a, DEF) : null;
    if (!o || !o.ok || !good(physical(o, a))) bad.push(v.symbol + ":" + (o ? o.reason || "phys" : a.reason));
  }
  ok(bad.length === 0, "5: 몸판 22종 Ⓐ(소매길이 20) → Ⓞ 기본값 전부 성립 · 물리 검산 " + J(bad));
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
