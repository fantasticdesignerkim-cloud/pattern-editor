// ══════════════════════════════════════════════
// sleeveBodiceVariantCheck.js — 박시가 아닌 변형 몸판에서 소매 Ⓐ(와 파생 B–O) 연결 회귀(2026-10-21).
//   사용자 실패 사례: 몸판 Ⓖ(플레어) → 소매 Ⓞ 적용 실패 «armhole-underarm-mismatch» · 저장 진동 아랫점 앞 15.78 / 뒤 17.77.
//   원인: Ⓖ 는 앞 AH 다트를 «위쪽 고정·옆 조각 회전»으로 닫아(Ⓐ 판독은 «아랫점 고정·위쪽 회전» 규약) 같은 봉제 진동이 다트 각만큼 돌아 놓였고,
//         뒤 어깨 다트는 이미 Ⓐ 와 같은 규약으로 닫혀 있는데 남은 다리 자료 때문에 판독이 한 번 더 닫으려 했다(가드에 가려진 잠재 버그).
//   수정: 측정 복사본만 정규화(다리 자료로 다트 각을 읽어 같은 BP 축으로 되돌림) · 이미 닫힌 어깨 다트는 다시 닫지 않음 · 가드는 원형 등가 위치에서 비교.
//   (1) 기존 지원 몸판의 Ⓐ 결과 = 수정 전 기준선(sha256 fixture) (2) 프리셋 스윕 분류 (3) 실패 사례 재현·해결 · 독립 검산
//   (4) 몸판 불변 · 출처 hash (5) Ⓖ 에서 소매 A–O 적용·게이트·완료 · Ⓞ 물리 검증 (6) 몸판 변경 무효화 · 완료 동결 · 표시 on/off 불변
//   node test/harness/sleeveBodiceVariantCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) } };
sb.globalThis = sb; vm.createContext(sb);
sb.window.designWorkflow = { current: () => PROJECT };
const files = ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js"];
"CDEFGHIJKLMNOPQ".split("").forEach(k => files.push("designSleeve" + k + ".js", "sleeve" + k + "Apply.js"));
files.push("sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js");
files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }));
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SA = W.designSleeveA, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sleeveABodiceBaseline.json"), "utf8"));
const MK = body => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const pick = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; };
const proj = sym => { PROJECT = MK(BP.bodyParams(pick(sym))); return BC.complete(PROJECT).ok ? PROJECT : null; };
const bodiceOf = id => { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? r.result : null; };
function deepFreeze(o) { if (o && typeof o === "object") { Object.keys(o).forEach(k => deepFreeze(o[k])); Object.freeze(o); } return o; }
const rotI = (p, c, a) => { const ca = Math.cos(a), sa = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y; return { x: c.x + dx * ca - dy * sa, y: c.y + dx * sa + dy * ca }; };
const angI = (c, p) => Math.atan2(p.y - c.y, p.x - c.x);
const endsI = s => s.kind === "line" ? [s.from, s.to] : [s.commands[0].points[0], s.commands[s.commands.length - 1].points[s.commands[s.commands.length - 1].points.length - 1]];

// ── 1. 기존 지원 몸판: 수정 전 기준선과 바이트 동일 ──
{
  const changed = [], ids = Object.keys(BASE.presets).filter(k => typeof BASE.presets[k] === "string");
  ids.forEach(id => { const res = bodiceOf(id), d = BASE.lengths.map(sl => SA.draftSleeveA(res, { sleeveLengthCm: sl }));
    if (crypto.createHash("sha256").update(J(d)).digest("hex") !== BASE.presets[id]) changed.push(id); });
  ok(ids.length === 18 && changed.length === 0, "1: 기존 지원 몸판 18개 × 소매길이 3 — Ⓐ 결과가 수정 전과 같음 " + J(changed));
}
// ── 2. 프리셋 스윕 분류(무리한 전체 지원 선언 없음) ──
const CLASS = {};
for (const f of BP.families()) for (const v of f.variants) { if (!v.presetId) continue; const rb = SA.readBodiceArmhole(bodiceOf(v.presetId)); CLASS[v.symbol] = rb.ok ? "ok" : rb.reason; }
{
  // 2026-10-27(김님 확정): Ⓗ·Ⓜ·Ⓝ 은 완료본의 변환 기록으로 원형 등가 복원해 지원 — 22종 전부. 상세는 §7.
  const supported = Object.keys(CLASS).filter(k => CLASS[k] === "ok").join("");
  ok(supported === "ABCDEFGHIJKLMNOPQRSTUV", "2: 지원 = 기존 18 + Ⓖ + 원형 등가 복원 Ⓗ·Ⓜ·Ⓝ — " + supported);
}
// ── 3. 사용자 실패 사례(Ⓖ) 재현 · 해결 · 독립 검산 ──
const RG = bodiceOf(pick("G")), RA = bodiceOf(pick("A"));
{
  const uaF = RG.front.outline.filter(s => s.edge === "side-seam").map(endsI).flat(), arm = RG.armhole.front.map(endsI).flat();
  const Uf = arm.find(p => uaF.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3)), armB = RG.armhole.back.map(endsI).flat(), uaB = RG.back.outline.filter(s => s.edge === "side-seam").map(endsI).flat();
  const Ub = armB.find(p => uaB.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3));
  ok(Uf.y.toFixed(2) === "15.78" && Ub.y.toFixed(2) === "17.77" && Math.abs(Uf.y - Ub.y) > 0.05, "3: 재현 — 저장 진동 아랫점 앞 15.78 / 뒤 17.77(Safari 보고값) · 옛 가드(보관 위치 비교)는 실패");
  const rb = SA.readBodiceArmhole(RG), ra = SA.readBodiceArmhole(RA);
  ok(rb.ok && rb.front.placement && rb.front.placement.kind === "front-dart-closed-by-moving-lower-side" && rb.back.placement && rb.back.placement.kind === "back-shoulder-dart-already-closed", "3: 해결 — 앞 배치 정규화 · 뒤 이미 닫힌 어깨 다트(다시 닫지 않음)");
  // 독립 검산: 앞 다리 두 줄에서 다트 각을 직접 읽어 저장 어깨점·아랫점을 BP 축으로 되돌린다
  const legs = RG.front.construction.filter(s => s.dart && s.dart.boundary === "armhole"), apex = l => l.dart.apexAt === "to" ? l.to : l.from, mouth = l => l.dart.apexAt === "to" ? l.from : l.to;
  const lo = legs.find(l => /lower$/.test(l.dart.attach.root)), up = legs.find(l => /upper$/.test(l.dart.attach.root)), bp = apex(lo), a = angI(bp, mouth(lo)) - angI(bp, mouth(up));
  const SPf = RG.front.outline.filter(s => s.edge === "shoulder").map(endsI).flat().find(p => arm.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3));
  const hF = rotI(Uf, bp, a).y - rotI(SPf, bp, a).y, SPb = RG.back.outline.filter(s => s.edge === "shoulder").map(endsI).flat().find(p => armB.some(q => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3)), hB = Ub.y - SPb.y;
  ok(Math.abs(a * 180 / Math.PI + 18.25) < 1e-6 && Math.abs(hF - rb.front.heightCm) < 1e-9 && Math.abs(hB - rb.back.heightCm) < 1e-9, "3: 독립 검산 — 다트 각 −18.25° · 앞 어깨 높이 " + hF.toFixed(3) + " · 뒤 " + hB.toFixed(3));
  ok(Math.abs(rb.front.heightCm - ra.front.heightCm) < 1e-3 && Math.abs(rb.back.heightCm - ra.back.heightCm) < 1e-3 && Math.abs(rotI(Uf, bp, a).y - bp.y) < 0.05, "3: 같은 봉제 진동 — 어깨 높이 ≈ 기본 몸판(차 앞 " + (rb.front.heightCm - ra.front.heightCm).toExponential(1) + " · 뒤 " + (rb.back.heightCm - ra.back.heightCm).toExponential(1) + ") · 되돌린 아랫점 = BP 높이");
  ok(Math.abs(RG.armholeLengths.front - RA.armholeLengths.front) < 1e-3 && Math.abs(RG.armholeLengths.back - RA.armholeLengths.back) < 1e-3 && Math.abs(rb.front.armholeClosedLengthCm - ra.front.armholeClosedLengthCm) < 1e-3, "3: AH(다트 닫은 봉제선) 앞 " + RG.armholeLengths.front.toFixed(4) + " · 뒤 " + RG.armholeLengths.back.toFixed(4) + " ≈ 기본 몸판 " + RA.armholeLengths.front.toFixed(4) + " · " + RA.armholeLengths.back.toFixed(4) + "(Ⓖ 경로 재표본 차)");
  const dG = SA.draftSleeveA(RG, { sleeveLengthCm: 52 }), dA = SA.draftSleeveA(RA, { sleeveLengthCm: 52 });
  ok(dG.ok && dG.meta.source.front.placement && Math.abs(dG.meta.source.front.placement.angleDeg + 18.25) < 1e-6 && Math.abs(dG.meta.source.back.placement.angleDeg + 11.38) < 0.01 && !("placement" in dA.meta.source.front) && !("placement" in dA.meta.source.back),
    "3: meta 기록 — 정규화한 몸판에만(Ⓖ 앞 −18.25° · 뒤 −11.38°) · 박시는 필드 없음");
  ok(Math.abs(dG.meta.capHeightCm - dA.meta.capHeightCm) < 0.005 && Math.abs(dG.meta.capLengths.total - dA.meta.capLengths.total) < 0.01 && dG.meta.checks.selfIntersection === false, "3: Ⓐ 소매산 높이·길이 ≈ 기본 몸판 · 자기교차 없음");
}
// ── 4. 몸판 불변 · 출처 hash ──
{
  const before = J(RG), fr = deepFreeze(JSON.parse(before)), d = SA.draftSleeveA(fr, { sleeveLengthCm: 20 });
  ok(d.ok && J(fr) === before && d.sourceBodiceHash === RG.hash, "4: 동결된 몸판 완료본으로도 동작 · 몸판 무변경 · 출처 hash");
}
// ── 5. Ⓖ 에서 소매 A–O 적용 → 게이트 → 완료 ──
const INPUTS = { A: { sleeveLengthCm: 52 }, B: { sleeveLengthCm: 52 }, C: { sleeveLengthCm: 52, elbowLengthCm: 31.4 }, D: { sleeveLengthCm: 52 }, E: { sleeveLengthCm: 52 },
  F: { sleeveLengthCm: 52, tuckCm: 1.5 }, G: { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }, H: { sleeveLengthCm: 52, elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 },
  I: { sleeveLengthCm: 52, palmCircumferenceCm: 21 }, J: { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0.7 }, K: { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0.7 },
  L: { sleeveLengthCm: 20, upperArmCm: 26 }, M: { sleeveLengthCm: 20, upperArmCm: 26, riseCm: 0.5 },
  N: { sleeveLengthCm: 20, cutOffsetCm: 2.5, centerTuckCm: 4, sideTuckCm: 2, stitchEndCm: 1.5 }, O: { sleeveLengthCm: 20, innerOffsetCm: 1.25, cutSpacingCm: 2.5, spreadCm: 2, stitchEndCm: 1.5 },
  P: { sleeveLengthCm: 20, flareRatio: 0.7 }, Q: { heightRatio: 0.25 } };
{
  const bad = [];
  "ABCDEFGHIJKLMNO".split("").forEach(k => {
    const PA = proj("A"), ra = W["sleeve" + k + "Apply"].apply(PA, INPUTS[k]), ca = SC.check(PA);
    const PG = proj("G"), rg = W["sleeve" + k + "Apply"].apply(PG, INPUTS[k]), cg = SC.check(PG), done = cg.ok ? SC.complete(PG) : null;
    if (!(ra.ok && rg.ok && ca.ok && cg.ok && done && done.ok && Object.isFrozen(PG.working.sleeveResult) && Math.abs(cg.ease.total - ca.ease.total) < 0.01)) bad.push(k + ":" + (rg.reason || cg.fails.join("/")));
  });
  ok(bad.length === 0, "5: Ⓖ 몸판에서 소매 A–O 15개 적용·게이트·완료(동결) · 이세 = 기본 몸판 " + J(bad));
  const PG = proj("G"); W.sleeveOApply.apply(PG, INPUTS.O); const m = PG.working.sleeveO.meta;
  ok(m.folded.roundTripMaxCm < 1e-9 && m.folded.maxDevCm < 1e-9 && m.checks.selfIntersection === false && Math.abs(m.hem.sewnCm - m.widthCm) < 1e-9 && Math.abs(m.cap.sewnCm - m.capLengthsA.total) < 5e-3,
    "5: Ⓖ → Ⓞ 물리 검증(접기 왕복 · 단일 외곽 · 봉제 소맷부리 = W · 접은 소매산 = Ⓐ)");
}
// ── 6. 몸판 변경 무효화 · 표시 on/off 불변 ──
{
  const P = proj("G"); W.sleeveOApply.apply(P, INPUTS.O); SC.complete(P);
  const h0 = P.working.sleeveResult.hash, g0 = J(P.working.geometry.sleeve);
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); SAN.refModel(P, 10);
  ok(J(P.working.geometry.sleeve) === g0 && P.working.sleeveResult.hash === h0 && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = geometry·완료본 hash 불변");
  const body = BP.bodyParams(pick("A")); P.working.parameters.body = body; P.working.geometry = Object.assign({}, DB.computeGeometry(REF, { body }), { sleeve: P.working.geometry.sleeve });
  BC.complete(P);
  const c = SC.check(P);
  ok(!c.ok && c.fails.indexOf("source-mismatch") >= 0 && P.working.sleeveResult.hash === h0, "6: 몸판을 바꾸면 소매 게이트가 무효(출처 불일치) · 기존 완료본은 동결 그대로 " + J(c.fails));
}

// ── 7. 몸판 Ⓗ·Ⓜ·Ⓝ — 원형 등가 복원(2026-10-27 김님 확정: Ⓗ 는 되돌린 원형 기준 · Ⓜ·Ⓝ 틈 메움 직선은 봉제 진동에서 제외) ──
{
  const RH = bodiceOf(pick("H")), RM = bodiceOf(pick("M")), RN = bodiceOf(pick("N")), RAx = bodiceOf(pick("A"));
  const cubI = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
  const polyI = sg => { if (sg.kind === "line") { const o = []; for (let k = 0; k <= 64; k++) o.push({ x: sg.from.x + (sg.to.x - sg.from.x) * k / 64, y: sg.from.y + (sg.to.y - sg.from.y) * k / 64 }); return o; }
    const o = []; let cur = null; sg.commands.forEach(c => { if (c.type === "M") { cur = c.points[0]; o.push(cur); } else { const q = [cur, ...c.points]; for (let k = 1; k <= 400; k++) o.push(cubI(q, k / 400)); cur = c.points[2]; } }); return o; };
  const lenP = P => { let s = 0; for (let i = 1; i < P.length; i++) s += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); return s; };
  const segD = (p, a, b) => { const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy; let t = l2 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2 : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t); };
  const toPolys = segs => segs.map(polyI), dTo = (p, polys) => { let m = Infinity; polys.forEach(P => { for (let i = 1; i < P.length; i++) m = Math.min(m, segD(p, P[i - 1], P[i])); }); return m; };
  const haus = (sa, sbb) => { const A = toPolys(sa), B = toPolys(sbb); let m = 0; A.forEach(P => P.forEach((p, i) => { if (i % 8 === 0) m = Math.max(m, dTo(p, B)); })); return m; };
  const D2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  // 7a. 완료본 기록: 절개 기록은 Ⓗ 에만(다른 몸판은 키 없음 — 기존 완료본 바이트 동일) · 형상 hash 미포함
  ok(RH.flareSlash && RH.flareSlash.front.slash && RH.flareSlash.back.slash && !("flareSlash" in RG) && !("flareSlash" in RAx) && !("flareSlash" in RM), "7: 완료본 절개 기록은 Ⓗ 에만(Ⓐ·Ⓖ·Ⓜ 키 없음)");
  { PROJECT = proj("H"); const h1 = PROJECT.working.bodiceResult.hash; const cpy = JSON.parse(J(PROJECT.working.bodiceResult)); delete cpy.flareSlash; ok(h1 === RH.hash && BC.isCurrentBodiceChanged(PROJECT) === false, "7: Ⓗ 완료본 hash 재현 · 기록은 hash 와 무관"); }
  // 7b. Ⓗ — 독립 복원: 기록 pivot·각으로 아랫점 쪽 진동 조각만 되돌리면 Ⓖ 의 진동과 겹친다(조각별 강체 합동)
  ["front", "back"].forEach(pc => {
    const rec = RH.flareSlash[pc].slash, Pv = rec.pivot, F = rec.foot, a = rec.angleDeg * Math.PI / 180;
    // 독립 분할: 저장 아랫점에서 진동 체인을 따라 pivot(이음점)에 닿을 때까지가 절개로 돈 조각
    const segs = RH.armhole[pc], arm = segs.map(endsI).flat(), ua = RH[pc].outline.filter(s => s.edge === "side-seam").map(endsI).flat();
    let cur = arm.find(p => ua.some(q => D2(p, q) < 1e-3)); const moved = new Set();
    for (let g = 0; g < segs.length && D2(cur, Pv) > 1e-6; g++) { const k = segs.findIndex((sg, i) => !moved.has(i) && endsI(sg).some(e => D2(e, cur) < 1e-6)); if (k < 0) break; moved.add(k); const e = endsI(segs[k]); cur = D2(e[0], cur) < 1e-6 ? e[1] : e[0]; }
    const restored = segs.map((sg, i) => ({ _pts: moved.has(i) ? polyI(sg).map(q => rotI(q, Pv, -a)) : polyI(sg) }));
    const asSeg = r => r._pts; const A = restored.map(asSeg), B = toPolys(RG.armhole[pc]);
    let m = 0; A.forEach(P => P.forEach((p, i) => { if (i % 8 === 0) m = Math.max(m, dTo(p, B)); }));
    const eng = SA.blockEquivalentBodice(RH).bodice.armhole[pc];
    ok(m < 1e-4 && haus(eng, RG.armhole[pc]) < 1e-4 && haus(RG.armhole[pc], eng) < 1e-4 && haus(RH.armhole[pc], RG.armhole[pc]) > 1, "7: Ⓗ " + pc + " — 기록 pivot·" + rec.angleDeg.toFixed(3) + "° 로 되돌린 진동 = Ⓖ 진동(독립 " + m.toExponential(1) + ") · 저장 형상은 다름");
  });
  // 7c. Ⓜ·Ⓝ — 틈 메움 직선(기록 T′→T)·옆 조각(-splice) 식별, 되돌리면 기본 몸판 진동과 겹친다(허리 이음 조립 snap ≤ 1e-3)
  [["M", RM], ["N", RN]].forEach(([sym, R]) => ["front", "back"].forEach(pc => {
    const rec = R.waistSeam[pc].closedDart, gaps = R.armhole[pc].filter(sg => sg.kind === "line" && ((D2(sg.from, rec.slashEndRotated) < 1e-9 && D2(sg.to, rec.slashEnd) < 1e-9) || (D2(sg.to, rec.slashEndRotated) < 1e-9 && D2(sg.from, rec.slashEnd) < 1e-9)));
    const gl = gaps.length === 1 ? D2(gaps[0].from, gaps[0].to) : NaN;
    const eng = SA.blockEquivalentBodice(R).bodice.armhole[pc];
    ok(gaps.length === 1 && Math.abs(gl - rec.armholeEaseCm) < 1e-12 && eng.length === R.armhole[pc].length - 1 && haus(eng, RAx.armhole[pc]) < 1e-3 && haus(RAx.armhole[pc], eng) < 1e-3,
      "7: " + sym + " " + pc + " — 틈 직선 1개(" + gl.toFixed(4) + " = 기록) · 되돌린 진동 = 기본 몸판 진동");
  }));
  // 7d. 봉제용 AH = 저장 AH − 틈 직선(독립 적분) · 저장 AH 는 그대로 · 다른 몸판은 같은 객체
  [["M", RM], ["N", RN]].forEach(([sym, R]) => {
    const sw = SA.sewnArmholeLengths(R), ex = { front: R.waistSeam.front.closedDart.armholeEaseCm, back: R.waistSeam.back.closedDart.armholeEaseCm };
    const integ = pc => R.armhole[pc].reduce((s, sg) => s + lenP(polyI(sg)), 0);
    ok(Math.abs(integ("front") - R.armholeLengths.front) < 2e-3 && Math.abs(integ("back") - R.armholeLengths.back) < 2e-3 && sw.front === Math.round((R.armholeLengths.front - ex.front) * 1e4) / 1e4 && sw.back === Math.round((R.armholeLengths.back - ex.back) * 1e4) / 1e4
      && Math.abs(ex.front - 0.1212) < 1e-4 && Math.abs(ex.back - 0.2192) < 1e-4 && Math.abs(sw.front - RAx.armholeLengths.front) < 2e-3 && Math.abs(sw.back - RAx.armholeLengths.back) < 2e-3,
      "7: " + sym + " 봉제 AH 앞 " + sw.front.toFixed(4) + " / 뒤 " + sw.back.toFixed(4) + " = 저장 " + R.armholeLengths.front + " / " + R.armholeLengths.back + " − 틈 " + ex.front.toFixed(4) + " / " + ex.back.toFixed(4));
  });
  ok([RAx, RG].every(R => SA.sewnArmholeLengths(R) === R.armholeLengths) && SA.sewnArmholeLengths(RH).front === RH.armholeLengths.front && SA.sewnArmholeLengths(RH).back === RH.armholeLengths.back, "7: 틈 기록 없는 몸판의 봉제 AH = 저장 AH(복원 없는 몸판은 같은 객체 · Ⓗ 는 같은 값)");
  // 7e. 어깨 높이(원형 기준) · Ⓐ meta · 몸판 불변 · 출처 hash
  const rA = SA.readBodiceArmhole(RAx);
  [["H", RH], ["M", RM], ["N", RN]].forEach(([sym, R]) => {
    const before = J(R), fr = deepFreeze(JSON.parse(before)), rb = SA.readBodiceArmhole(fr), d = SA.draftSleeveA(fr, { sleeveLengthCm: 52 }), dA = SA.draftSleeveA(RAx, { sleeveLengthCm: 52 });
    const sw = SA.sewnArmholeLengths(R);
    ok(rb.ok && Math.abs(rb.front.heightCm - rA.front.heightCm) < 1e-3 && Math.abs(rb.back.heightCm - rA.back.heightCm) < 1e-3 && rb.front.restore && rb.back.restore,
      "7: " + sym + " 어깨 높이(원형 기준) 앞 " + (rb.ok ? rb.front.heightCm.toFixed(3) : "-") + " / 뒤 " + (rb.ok ? rb.back.heightCm.toFixed(3) : "-") + " = 박시");
    ok(d.ok && d.meta.armholeCm.front === sw.front && d.meta.armholeCm.back === sw.back && d.meta.source.front.armholeStoredCm === R.armholeLengths.front && d.meta.source.front.armholeSewnCm === sw.front
      && d.meta.source.front.restore.kind === (sym === "H" ? "flare-slash-undo" : "waist-seam-undo") && Math.abs(d.meta.capHeightCm - dA.meta.capHeightCm) < 2e-3 && d.meta.checks.closed && d.meta.checks.connected && d.meta.checks.selfIntersection === false,
      "7: " + sym + " Ⓐ — 봉제 AH 로 제도 · 저장/봉제 AH 따로 기록 · 소매산 높이 ≈ 박시 · 단일 외곽");
    ok(J(fr) === before && d.sourceBodiceHash === R.hash, "7: " + sym + " 몸판 불변(동결) · 출처 hash");
    // 보관 좌표 아랫점 = 실제 몸판 아랫점
    const tip = pc => { const arm = R.armhole[pc].map(endsI).flat(), ua = R[pc].outline.filter(s => s.edge === "side-seam").map(endsI).flat(); return arm.find(p => ua.some(q => D2(p, q) < 1e-3)); };
    ok(D2(rb.front.underarmStored, tip("front")) < 1e-9 && D2(rb.back.underarmStored, tip("back")) < 1e-9, "7: " + sym + " 보관 아랫점 = 몸판 위 실제 아랫점(조각 정변환)");
  });
  // 7f. Ⓠ 달림 끝 — 몸판 실제 진동 위 · 틈 직선 위가 아님 · 보관 진동을 틈 직선 없이 독립 보행한 호 = 빠진 호
  const SQ = W.designSleeveQ;
  const walk = (R, pc, arc, skipGap) => {   // 보관 진동 독립 보행(아랫점 → ), 틈 직선(T′→T)은 길이 0 으로 건너뛴다
    const rec = R.waistSeam && R.waistSeam[pc] && R.waistSeam[pc].closedDart, polys = R.armhole[pc].map(polyI), used = polys.map(() => false);
    const arm = R.armhole[pc].map(endsI).flat(), ua = R[pc].outline.filter(s => s.edge === "side-seam").map(endsI).flat();
    let cur = arm.find(p => ua.some(q => D2(p, q) < 1e-3)), w = 0;
    for (let g = 0; g < polys.length; g++) {
      let k = -1, rev = false; polys.forEach((P, i) => { if (used[i] || k >= 0) return; if (D2(P[0], cur) < 1e-6) { k = i; } else if (D2(P[P.length - 1], cur) < 1e-6) { k = i; rev = true; } });
      if (k < 0) return null; used[k] = true; const P = rev ? polys[k].slice().reverse() : polys[k];
      const isGap = rec && R.armhole[pc][k].kind === "line" && (D2(P[0], rec.slashEndRotated) < 1e-9 || D2(P[0], rec.slashEnd) < 1e-9) && (D2(P[P.length - 1], rec.slashEnd) < 1e-9 || D2(P[P.length - 1], rec.slashEndRotated) < 1e-9);
      if (isGap && skipGap) { cur = P[P.length - 1]; continue; }
      for (let j = 1; j < P.length; j++) { const dd = D2(P[j - 1], P[j]); if (w + dd >= arc) { const u = (arc - w) / dd; return { x: P[j - 1].x + (P[j].x - P[j - 1].x) * u, y: P[j - 1].y + (P[j].y - P[j - 1].y) * u }; } w += dd; }
      cur = P[P.length - 1];
    }
    return null;
  };
  const bad = [];
  [["H", RH], ["M", RM], ["N", RN]].forEach(([sym, R]) => {
    const A = SA.draftSleeveA(R, { sleeveLengthCm: 30 });
    [0.25, 0.4, 0.75].forEach(r => {
      const q = SQ.draftSleeveQ(A, { heightRatio: r }); if (!q.ok) { bad.push(sym + r + ":" + q.reason); return; }
      const at = SQ.bodiceAttachEnds(R, q.meta.excludedArcCm);
      ["back", "front"].forEach(pc => {
        const e = at[pc]; if (e.status !== "ok") { bad.push(sym + r + pc + ":" + e.status); return; }
        const onArm = dTo(e.point, toPolys(R.armhole[pc]));
        const rec = R.waistSeam && R.waistSeam[pc] && R.waistSeam[pc].closedDart;
        const onGap = rec ? segD(e.point, rec.slashEndRotated, rec.slashEnd) < 1e-6 && D2(e.point, rec.slashEnd) > 1e-6 && D2(e.point, rec.slashEndRotated) > 1e-6 : false;
        if (!(onArm < 1e-3) || onGap) bad.push(sym + r + pc + ":off-armhole " + onArm.toExponential(1));
        if (!e.acrossClosedDart) {   // 다트를 건너지 않은 점은 보관 진동 독립 보행(틈 제외)과 같아야 한다
          const ind = walk(R, pc, q.meta.excludedArcCm[pc], true);
          if (!ind || D2(ind, e.point) > 0.02) bad.push(sym + r + pc + ":walk " + (ind ? D2(ind, e.point).toFixed(4) : "none"));
        }
      });
    });
  });
  ok(bad.length === 0, "7: Ⓗ·Ⓜ·Ⓝ × Ⓠ 0.25/0.4/0.75 — 달림 끝 앞·뒤 표시 · 실제 몸판 진동 위 · 틈 직선 위 아님 · 독립 보행 일치 " + J(bad));
  { const A = SA.draftSleeveA(RM, { sleeveLengthCm: 30 }), q = SQ.draftSleeveQ(A, { heightRatio: 0.4 }), e = SQ.bodiceAttachEnds(RM, q.meta.excludedArcCm).back, withGap = walk(RM, "back", q.meta.excludedArcCm.back, false);
    ok(withGap && D2(withGap, e.point) > 0.1, "7: Ⓜ 뒤 0.4 — 틈 직선을 진동 호에 넣으면 다른 점(" + (withGap ? D2(withGap, e.point).toFixed(3) : "-") + "cm) → 넣지 않음 확인"); }
  // 7g. 소매 A–Q 전체 적용·게이트·완료 · 이세 = 박시(봉제 AH 일관) · Ⓞ 물리
  const bad2 = [];
  ["H", "M", "N"].forEach(sym => "ABCDEFGHIJKLMNOPQ".split("").forEach(k => {
    const PA = proj("A"), ra = W["sleeve" + k + "Apply"].apply(PA, INPUTS[k]), ca = SC.check(PA);
    const PX = proj(sym), rx = W["sleeve" + k + "Apply"].apply(PX, INPUTS[k]), cx = SC.check(PX), done = cx.ok ? SC.complete(PX) : null;
    if (!(ra.ok && rx.ok && ca.ok && cx.ok && done && done.ok && Object.isFrozen(PX.working.sleeveResult) && cx.ease && ca.ease && Math.abs(cx.ease.total - ca.ease.total) < 0.01)) bad2.push(sym + k + ":" + (rx.reason || (cx.fails || []).join("/")));
  }));
  ok(bad2.length === 0, "7: Ⓗ·Ⓜ·Ⓝ 몸판에서 소매 A–Q 17개 적용·게이트·완료 · 이세 = 박시 " + J(bad2));
  ["H", "M"].forEach(sym => { const PX = proj(sym), ro = W.sleeveOApply.apply(PX, INPUTS.O); if (!ro.ok || !PX.working.sleeveO) { ok(false, "7: " + sym + " → Ⓞ 적용 실패 " + (ro.reason || "")); return; } const m = PX.working.sleeveO.meta;
    ok(m.folded.roundTripMaxCm < 1e-9 && m.folded.maxDevCm < 1e-9 && m.checks.selfIntersection === false && Math.abs(m.hem.sewnCm - m.widthCm) < 1e-9, "7: " + sym + " → Ⓞ 물리(접기 왕복 · 단일 외곽 · 봉제 소맷부리 = W)"); });
  { const PM = proj("M"); W.sleeveAApply.apply(PM, INPUTS.A); const L = W.sleeveAApply.infoLines(PM).join("\n"); const PA = proj("A"); W.sleeveAApply.apply(PA, INPUTS.A);
    ok(/원형 기준 측정: 허리 이음 다트 닫힘 회전 되돌림 · 진동 틈 메움 직선 제외 · 저장 AH 앞 20\.75 \/ 뒤 21\.81 → 봉제 AH 앞 20\.63 \/ 뒤 21\.59/.test(L) && /AH 앞 20\.63 · 뒤 21\.59/.test(L) && !/원형 기준 측정/.test(W.sleeveAApply.infoLines(PA).join()), "7: Ⓜ 표시 줄 — 저장 AH / 봉제 AH 나란히(박시는 줄 없음)"); }
  // 7h. 몸판 변경 무효화(Ⓜ → Ⓗ) · 완료본 동결
  { const P = proj("M"); W.sleeveQApply.apply(P, INPUTS.Q); SC.complete(P); const h0 = P.working.sleeveResult.hash;
    const body = BP.bodyParams(pick("H")); P.working.parameters.body = body; P.working.geometry = Object.assign({}, DB.computeGeometry(REF, { body }), { sleeve: P.working.geometry.sleeve }); BC.complete(P);
    const c = SC.check(P); ok(!c.ok && c.fails.indexOf("source-mismatch") >= 0 && P.working.sleeveResult.hash === h0, "7: Ⓜ→Ⓗ 몸판 변경 → 소매 무효 · 완료본 동결 " + J(c.fails)); }
  // 7i. 기록이 없거나 형상과 맞지 않으면 추측하지 않고 멈춤
  const noRec = R => { const c = JSON.parse(J(R)); delete c.flareSlash; c.waistSeam = null; return c; };
  ok(SA.readBodiceArmhole(noRec(RM)).reason === "armhole-underarm-mismatch" && SA.readBodiceArmhole(noRec(RH)).reason === "armhole-placement-unverified", "7: 기록 없는 완료본(합성) → 예전 사유로 멈춤");
  { const t = JSON.parse(J(RM)); t.waistSeam.front.closedDart.armholeEaseCm += 0.01; const r = SA.readBodiceArmhole(t);
    ok(!r.ok && r.reason === "armhole-restore-unverified" && r.detail.why === "waist-seam-gap-length-mismatch" && SA.sewnArmholeLengths(t) === null, "7: Ⓜ 틈 길이 기록 불일치 → 멈춤 · 봉제 AH 없음"); }
  { const t = JSON.parse(J(RH)); t.flareSlash.back.slash.pivot.x += 0.01; const r = SA.readBodiceArmhole(t);
    ok(!r.ok && r.reason === "armhole-restore-unverified" && r.detail.why === "flare-slash-pivot-not-armhole-joint", "7: Ⓗ pivot 기록이 진동 이음점이 아님 → 멈춤"); }
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
