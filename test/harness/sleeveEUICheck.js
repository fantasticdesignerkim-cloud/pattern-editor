// ══════════════════════════════════════════════
// sleeveEUICheck.js — 소매 Ⓔ(P.42 플레어 절개 3개) 연결 회귀: 카탈로그 · sleeveEApply · 표시 줄 · 완료본 · 제작 정보 · 배선. 엔진은 designSleeveECheck.
//   node test/harness/sleeveEUICheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SB = W.designSleeveB,
  SP = W.sleevePresets, SAA = W.sleeveAApply, SBA = W.sleeveBApply, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

// ── 1. 카탈로그 ──
{
  const f = SP.family("flare-sleeve");
  ok(f.variants.map(v => v.id).join() === "bunka-sleeve-D,bunka-sleeve-E" && f.variants[1].availability === "available" && f.variants[1].presetId === "bunka-sleeve-E", "1: 플레어 소매 = Ⓓ + Ⓔ(실행)");
  const rec = SP.get("bunka-sleeve-E");
  ok(rec && rec.method === "flare-3cut-symmetric-from-sleeve-A" && rec.methodPage === 42 && rec.inputs.length === 1 && rec.inputs[0].key === "sleeveLengthCm" && Object.isFrozen(rec), "1: Ⓔ 레코드 · 입력 소매길이만");
  ok(SP.resolve("flare-sleeve", "bunka-sleeve-E").ok, "1: resolve Ⓔ");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SEA.apply(P, { sleeveLengthCm: 52 }), S = P.working.sleeveE, g = P.working.geometry.sleeve;
  const e = SE.draftSleeveE(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), {});
  ok(r.ok && S.presetId === "bunka-sleeve-E" && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front", "2: 표시 construction(중심선·절개변 6)");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveD === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변 · 다른 라인/완료본 없음");
}
// ── 3. 표시 줄 ──
{
  const L = SEA.infoLines(P), m = P.working.sleeveE.meta, AH = bodice.armholeLengths, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(L.length === 8 && /^플레어 소매 Ⓔ/.test(L[0]), "3: 표시 줄 8줄");
  ok(/^플레어 ∅ = 소매폭 32\.07 × 1 = 32\.07 · 틈마다 10\.69 \(실제 뒤 10\.69 · 가운데 10\.69 · 앞 10\.69\)$/.test(L[1]), "3: 산식·실제 세 틈: " + L[1]);
  ok(/^회전 가운데 ±5\.90°\(SP 대칭\) · 바깥 누적 뒤 19\.16° · 앞 19\.15°/.test(L[2]), "3: 회전: " + L[2]);
  ok(/^소매산: 꺾임 3곳/.test(L[4]), "3: 소매산 재제도 줄");
  const ef = prim.lengths.front - AH.front, eb = prim.lengths.back - AH.back;
  ok(L[7] === "이세(실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "3: 이세 = geometry 실측");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SEA.apply(Q, { sleeveLengthCm: 52 });
  ok(SEA.reject(Q, { reason: "invalid-sleeve-length", text: "x" }) && SEA.isBlocked(Q) && !SC.check(Q).ok && SC.check(Q).fails.indexOf("sleeve-e-blocked") >= 0, "4: 차단 중 완료 불가");
  ok(SEA.rederive(Q).ok && !SEA.isBlocked(Q), "4: rederive");
  SDA.apply(Q, { sleeveLengthCm: 52 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓓ·Ⓔ 동시 → 충돌(ui 가 배타 해제)");
  SEA.clear(Q); ok(!SEA.isActive(Q), "4: clear");
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-E", "5: 게이트 통과 " + J(c.fails));
  const r = SC.complete(P), R = r.result;
  ok(r.ok && R.origin.presetId === "bunka-sleeve-E" && R.origin.methodPage === 42 && J(R.inputs) === J({ sleeveLengthCm: 52 }) && Object.isFrozen(R), "5: 완료본 origin·inputs·동결");
  const prim = DS.capPrimitives(R.geometry), AH = bodice.armholeLengths;
  ok(Math.abs(R.cap.ease.front - (prim.lengths.front - AH.front)) < 1e-4 && Math.abs(R.cap.ease.back - (prim.lengths.back - AH.back)) < 1e-4, "5: cap.ease = 완료본 geometry 실측 − AH");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SEA.apply(P, { sleeveLengthCm: 56 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 소매길이 변경 → 변경됨");
  const r2 = SC.complete(P); ok(r2.ok && r2.result.hash !== R.hash, "5: 재완료 새 hash");
  SEA.apply(P, { sleeveLengthCm: 52 }); SC.complete(P);
}
// ── 6. 제작 정보 ──
{
  const m = SAN.buildModel(P), M = P.working.sleeveE.meta;
  ok(m && m.line === "E" && m.title === "소매 Ⓔ · 플레어(절개 3개 잘라서 벌림, P.42)", "6: Ⓔ 모델");
  ok(["back", "center", "front"].every(k => T(m, "open-" + k) === "∅/3 " + f2(M.flare.openedCm[k])), "6: 세 틈 치수 = 실제 거리");
  ok(m.zones.filter(z => /^open-/.test(z.id)).length === 3 && m.marks.some(x => x.id === "pivot-sp"), "6: 틈 음영 3 · SP 기준점 표식");
  ok(!/rigid|provisional/.test(J(m)), "6: 감사 값 미표시");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f);
  ok(pos("designSleeveE.js") > pos("sleeveDApply.js") && pos("sleeveEApply.js") > pos("designSleeveE.js") && pos("ui.js") > pos("sleeveEApply.js"), "7: 스크립트 순서");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(["designSleeveE.js", "sleeveEApply.js", "sleevePresets.js", "sleeveCheckpoint.js", "sleeveAnnotation.js", "ui.js"].every(f => ver(f) === "2026101001"), "7: 캐시 버전 2026101001");
  ok(/function sleeveEOn\(project\)/.test(ui) && /keep !== "E" && window\.sleeveEApply/.test(ui) && /if \(isE\) \{/.test(ui) && /window\.sleeveEApply\.rederive\(project\)/.test(ui), "7: ui 배선");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
