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
"CDEFGHIJKLMNO".split("").forEach(k => files.push("designSleeve" + k + ".js", "sleeve" + k + "Apply.js"));
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
  const supported = Object.keys(CLASS).filter(k => CLASS[k] === "ok").join("");
  ok(supported === "ABCDEFGIJKLOPQRSTUV", "2: 지원 = 기존 18 + 새로 Ⓖ — " + supported);
  ok(CLASS.H === "armhole-placement-unverified", "2: Ⓗ(진동 위 기준점 절개) = 배치로 설명되지 않음 → 원리 판단 필요로 멈춤");
  ok(CLASS.M === "armhole-underarm-mismatch" && CLASS.N === "armhole-underarm-mismatch", "2: Ⓜ·Ⓝ(허리 이음선 — 진동 자체 변경) = 기존 미지원 유지");
  const P = proj("H"), r = W.sleeveAApply.apply(P, { sleeveLengthCm: 52 });
  ok(!r.ok && /원리\) 판단이 필요/.test(r.text) && /BP\(가슴둘레선\) 20\.62/.test(r.text), "2: Ⓗ 사유 문구(값을 맞추지 않음): " + r.text);
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
  N: { sleeveLengthCm: 20, cutOffsetCm: 2.5, centerTuckCm: 4, sideTuckCm: 2, stitchEndCm: 1.5 }, O: { sleeveLengthCm: 20, innerOffsetCm: 1.25, cutSpacingCm: 2.5, spreadCm: 2, stitchEndCm: 1.5 } };
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

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
