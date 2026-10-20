// ══════════════════════════════════════════════
// sleeveIUICheck.js — 소매 Ⓘ(P.44 하단 퍼프, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveIApply · 표시 줄 · 완료본 · 제작 정보(원래 종이·틈·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveIUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js", "designSleeveI.js", "sleeveIApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SIA = W.sleeveIApply, SI = W.designSleeveI, SHA = W.sleeveHApply, SH = W.designSleeveH, SGA = W.sleeveGApply, SG = W.designSleeveG, SFA = W.sleeveFApply, SF = W.designSleeveF, SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 52, palmCircumferenceCm: 21 };
// ── 1. 카탈로그 ──
{
  const f = SP.family("puff-sleeve"), rec = SP.get("bunka-sleeve-I");
  ok(f.variants.map(v => v.id).slice(0, 2).join() === "bunka-sleeve-H,bunka-sleeve-I" && f.variants[1].availability === "available", "1: 퍼프 = Ⓗ + Ⓘ(실행) · 뒤에 Ⓙ");
  ok(rec && rec.methodPage === 44 && rec.inputs.map(i => i.key + "=" + (i.defaultValue === undefined ? "" : i.defaultValue)).join() === "sleeveLengthCm=,palmCircumferenceCm=21" && Object.isFrozen(rec), "1: Ⓘ 레코드 · 입력 소매길이 + 손바닥(21) — EL·★ 없음");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SIA.apply(P, IN), S = P.working.sleeveI, g = P.working.geometry.sleeve;
  const e = SI.draftSleeveI(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), { palmCircumferenceCm: 21 });
  ok(r.ok && S.presetId === "bunka-sleeve-I" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front", "2: 표시 construction");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveH === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const b = SIA.apply(projectWithBodice("A"), { sleeveLengthCm: 52, palmCircumferenceCm: 10 });
  ok(!b.ok && b.reason === "no-spread" && /기하/.test(b.text), "2: 벌릴 분량 없음 거부(사유)"); PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SIA.infoLines(P), m = P.working.sleeveI.meta, prim = DS.capPrimitives(P.working.geometry.sleeve), AH = bodice.armholeLengths;
  ok(L.length === 8 && /^퍼프 소매 Ⓘ \(화면 검토용 시안\)/.test(L[0]), "3: 표시 줄 8줄 · 시안");
  ok(/^산식: ■ = Ⓐ 소맷부리 32\.07 − ● = 8\.07 · ∅ = ● − ■ = 15\.93 · 틈마다 ∅\/3 5\.31 \(실제 뒤 5\.31 · 가운데 5\.31 · 앞 5\.31\)$/.test(L[2]), "3: 산식·실측: " + L[2]);
  ok(/O 는 중심선 절개로 갈라짐\(기준 = SP · 이등분선\)/.test(L[3]), "3: 기준점 표시");
  ok(L[4].indexOf("소맷부리(최종 곡선 실측 — 권위값) " + f2(m.hem.lengthCm) + " cm · 여유 산식 2● 48.00 · 개더(실측) " + f2(m.hem.gatherCm)) === 0, "3: 소맷부리 실측·산식·개더 구분");
  const ef = prim.lengths.front - AH.front, eb = prim.lengths.back - AH.back;
  ok(L[7].indexOf("이세(실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb)) > 0 && /Ⓐ 대비 앞/.test(L[7]), "3: 소매산·이세 실측 · Ⓐ 대비");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SIA.apply(Q, IN);
  ok(SIA.reject(Q, { reason: "invalid-palm", text: "x" }) && SC.check(Q).fails.indexOf("sleeve-i-blocked") >= 0 && SIA.rederive(Q).ok && !SIA.isBlocked(Q), "4: 차단·재제도");
  SHA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓗ·Ⓘ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-I", "5: 게이트 통과 " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && R.origin.presetId === "bunka-sleeve-I" && J(R.inputs) === J(IN) && Object.isFrozen(R) && J(R.geometry) === J(P.working.geometry.sleeve), "5: 완료본 origin·inputs·geometry 불변 복사");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SIA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 22 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 손바닥 변경 → 변경됨");
  SIA.apply(P, IN); SC.complete(P);
  const Q = projectWithBodice("A"); SHA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 }); ok(SC.complete(Q).ok, "5: Ⓗ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보(원래 종이 4조각 · 틈 · 최종선) ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveI.meta;
  ok(mOn && mOn.line === "I" && /화면 검토용 시안/.test(mOn.title), "6: Ⓘ 모델");
  const pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === "paper-backOuter,paper-backCenter,paper-frontCenter,paper-frontOuter" && ["backOuter", "backCenter", "frontCenter", "frontOuter"].every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 4조각 = 엔진 강체 자료 그대로");
  ok(mOn.zones.filter(z => /^wedge-/.test(z.id)).length === 3 && mOn.zones.map(z => z.cls).lastIndexOf("paper") < mOn.zones.findIndex(z => z.cls === "zone"), "6: 틈 3개 음영(종이 위)");
  ok(/녹색 = 원래 종이 4조각/.test(J(mOn.lines)) && /남색 실선 = 최종 재단선/.test(J(mOn.lines)), "6: 범례");
  ok(!mOff.zones.some(z => z.cls === "paper"), "6: 녹색 토글 끔");
  ok(["back", "center", "front"].every(k => T(mOn, "open-" + k) === "∅/3 " + f2(M.flare.openedCm[k])), "6: 틈 치수 = 실측");
  const before = J({ g: P.working.geometry, s: P.working.sleeveI, r: P.working.sleeveResult });
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10);
  ok(J({ g: P.working.geometry, s: P.working.sleeveI, r: P.working.sleeveResult }) === before && SC.isCurrentSleeveChanged(P) === false, "6: 표시 전용(geometry·상태·hash 불변)");
  ok(rm && rm.line === "I-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 3 && !rm.refs.some(r => r.id === "ref-el") && /SP 기준 좌우/.test(J(rm.lines)), "6: 비교 도안(Ⓘ — 절개 3개, EL 없음)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveI.js") > pos("sleeveHApply.js") && pos("sleeveIApply.js") > pos("designSleeveI.js") && pos("ui.js") > pos("sleeveIApply.js"), "7: 스크립트 순서");
  ok(["designSleeveI.js", "sleeveIApply.js"].every(f => ver(f) === "2026101303") && ["sleevePresets.js", "sleeveCheckpoint.js", "sleeveAnnotation.js", "ui.js", "render.js"].every(f => ver(f) === "2026102001"), "7: 캐시 버전 Ⓘ 2026101303 · 공용 2026102001");
  ok(/function sleeveIOn\(project\)/.test(ui) && /keep !== "I" && window\.sleeveIApply/.test(ui) && /if \(isI\) \{/.test(ui) && /window\.sleeveIApply\.rederive\(project\)/.test(ui) && /_sm\.line === "H" \|\| _sm\.line === "I"/.test(rn), "7: ui·render 배선");
  ok(/id="chkSleeveHPieces" checked/.test(html) && /id="chkSleeveHRef">/.test(html), "7: 녹색 토글 기본 켜짐 · 비교 도안 기본 꺼짐");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
