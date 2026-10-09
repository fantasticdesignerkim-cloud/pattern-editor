// ══════════════════════════════════════════════
// sleeveDUICheck.js — 소매 Ⓓ(P.42 플레어) 연결 회귀: 카탈로그 · sleeveDApply(적용·차단·재제도·배타) · 표시 줄 · 완료본(sleeveCheckpoint) · 제작 정보(sleeveAnnotation) · 배선.
//   엔진은 designSleeveDCheck 가 전담한다.   node test/harness/sleeveDUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SDA = W.sleeveDApply, SD = W.designSleeveD, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

// ── 1. 카탈로그 ──
{
  const f = SP.family("flare-sleeve");
  ok(f.availability === "available" && f.variants.map(v => v.id).join() === "bunka-sleeve-D,bunka-sleeve-E", "1: 플레어 소매 = Ⓓ(실행) + Ⓔ");
  ok(f.variants[0].availability === "available" && f.variants[0].presetId === "bunka-sleeve-D" && f.variants[0].page === 42, "1: Ⓓ 실행 가능 · P.42");
  ok(f.variants[1].availability === "pending-page" && f.variants[1].presetId === null && typeof f.variants[1].blockedBy === "string" && f.variants[1].blockedBy.length > 10, "1: Ⓔ 보류 · blockedBy 보유");
  const rec = SP.get("bunka-sleeve-D");
  ok(rec && rec.method === "flare-slash-spread-from-sleeve-A" && rec.methodPage === 42 && rec.inputs.length === 1 && rec.inputs[0].key === "sleeveLengthCm" && Object.isFrozen(rec), "1: 레코드 = 제도 방식·입력 소매길이만");
  ok(SP.resolve("flare-sleeve", "bunka-sleeve-D").ok && !SP.resolve("flare-sleeve", "bunka-sleeve-E").ok, "1: resolve Ⓓ 성공 · Ⓔ 불가");
}

// ── 2. 적용(읽기 전용·불변) ──
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), src: J(P.sourceBlock), ref: J(P.referenceGeometry), body: J(P.working.parameters) };
{
  const r = SDA.apply(P, { sleeveLengthCm: 52 }), S = P.working.sleeveD, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), d = SD.draftSleeveD(a, {});
  ok(r.ok && S.presetId === "bunka-sleeve-D" && S.parameters.sleeveLengthCm === 52 && S.blocked === null && J(S.meta) === J(d.meta), "2: 적용 — 상태·meta = 엔진");
  ok(J(g.outline) === J(d.geometry.outline) && g.construction.map(c => c.role).join() === "center-line,cut-axis-back,cut-axis-front,cut-edge-back,cut-edge-front", "2: geometry 미러 · 표시 construction(중심선·절개변)");
  ok(J(bodice) === snap.bodice && J(P.sourceBlock) === snap.src && J(P.referenceGeometry) === snap.ref && J(P.working.parameters) === snap.body, "2: 몸판·원형·파라미터 불변");
  ok(P.working.sleeveA === undefined && P.working.sleeveB === undefined && P.working.sleeveC === undefined && P.working.sleeveResult === undefined, "2: 다른 라인·완료본을 만들지 않는다");
  ok(!J(g).includes('"rigid"') && !J(g).includes('"meta"'), "2: geometry 에 raw/meta 없음(meta 에만)");
  ok(SDA.isActive(P) && !SDA.isBlocked(P), "2: isActive");
}

// ── 3. 표시 줄(지배 ease = geometry 실측) ──
{
  const L = SDA.infoLines(P), m = P.working.sleeveD.meta, AH = bodice.armholeLengths, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(L.length === 8 && L[0] === "플레어 소매 Ⓓ · 소매 Ⓐ 에서 절개 2개를 기준점 중심으로 잘라서 벌림 (P.42)", "3: 표시 줄 8줄 · 패턴명");
  ok(L[1] === "플레어 ∅ = 소매폭 " + f2(m.widthCm) + " × 0.5 = " + f2(m.flare.totalCm) + " · 절개마다 " + f2(m.flare.perCutCm) + " (실제 뒤 " + f2(m.flare.openedCm.back) + " · 앞 " + f2(m.flare.openedCm.front) + ")" && /16\.03/.test(L[1]), "3: 플레어 산식·실제 벌림: " + L[1]);
  ok(/^소맷부리\(곡선\) 48\.\d\d cm \(벌리기 전 32\.07\)/.test(L[3]) && /^소매산: 기준점 꺾임을 자연스럽게 다시 그림/.test(L[4]), "3: 소맷부리·소매산 줄");
  const ef = prim.lengths.front - AH.front, eb = prim.lengths.back - AH.back;
  ok(L[7] === "이세(실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "3: 이세 = geometry 실측");
  ok(!L.some(t => /rigid|raw|provisional/.test(t)), "3: 내부 감사 값 미노출");
}

// ── 4. 차단·재제도·배타 ──
{
  const Q = projectWithBodice("A"); SDA.apply(Q, { sleeveLengthCm: 52 });
  const keep = J(Q.working.geometry.sleeve);
  ok(SDA.reject(Q, { reason: "invalid-sleeve-length", text: "소매길이 확인" }) && SDA.isBlocked(Q) && J(Q.working.geometry.sleeve) === keep && SDA.infoLines(Q)[1].indexOf("⚠ 차단: ") === 0, "4: 차단 — 형상 유지·표시");
  ok(!SC.check(Q).ok && SC.check(Q).fails.indexOf("sleeve-d-blocked") >= 0, "4: 차단 중 완료 불가");
  const rr = SDA.rederive(Q);
  ok(rr.ok && !SDA.isBlocked(Q), "4: rederive 로 해제");
  const x = SDA.apply(Q, { sleeveLengthCm: "abc" });
  ok(!x.ok && typeof x.text === "string", "4: 잘못된 소매길이 → 실패(이전 상태 유지)");
  SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(!SC.check(Q).ok && SC.check(Q).fails[0] === "sleeve-line-conflict", "4: 두 라인이 동시에 켜지면 충돌(ui.js 가 배타 해제)");
  SDA.clear(Q); ok(!SDA.isActive(Q) && Q.working.sleeveD === null, "4: clear");
}

// ── 5. 완료본 ──
let RES = null;
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-D", "5: 게이트 통과 " + J(c.fails));
  const r = SC.complete(P); RES = r.result;
  ok(r.ok && RES.origin.presetId === "bunka-sleeve-D" && RES.origin.methodPage === 42 && J(RES.inputs) === J({ sleeveLengthCm: 52 }) && Object.isFrozen(RES), "5: 완료본 origin·inputs·동결");
  ok(J(RES.geometry) === J(P.working.geometry.sleeve) && J(RES.meta) === J(P.working.sleeveD.meta) && typeof RES.hash === "string", "5: geometry·meta 스냅샷 · hash");
  const prim = DS.capPrimitives(RES.geometry), AH = bodice.armholeLengths;
  ok(Math.abs(RES.cap.ease.front - (prim.lengths.front - AH.front)) < 1e-4 && Math.abs(RES.cap.ease.back - (prim.lengths.back - AH.back)) < 1e-4, "5: cap.ease = 완료본 geometry 실측 − AH");
  ok(SC.isCurrentSleeveChanged(P) === false && SC.invalidatedByBodice(P) === false, "5: 완료 직후 변경 없음");
  SDA.apply(P, { sleeveLengthCm: 56 });
  ok(SC.isCurrentSleeveChanged(P) === true, "5: 소매길이 변경 → «변경됨»");
  const r2 = SC.complete(P);
  ok(r2.ok && r2.result.hash !== RES.hash && r2.result.inputs.sleeveLengthCm === 56, "5: 재완료 — 새 hash");
  SDA.apply(P, { sleeveLengthCm: 52 }); SC.complete(P);
  // 몸판 다시 완료(같은 몸판) → hash 같음, 다른 몸판 → 무효
  const Q = projectWithBodice("A"); SDA.apply(Q, { sleeveLengthCm: 52 }); SC.complete(Q);
  Q.working.parameters = JSON.parse(J(Q.working.parameters)); BC.complete(Q);
  ok(SC.invalidatedByBodice(Q) === false, "5: 같은 몸판 재완료 → 유효");
}

// ── 6. 제작 정보(설명) ──
{
  const m = SAN.buildModel(P), M = P.working.sleeveD.meta;
  ok(m && m.line === "D" && m.title === "소매 Ⓓ · 플레어(절개 2개 잘라서 벌림, P.42)", "6: Ⓓ 모델 · 패턴명");
  ok(T(m, "open-back") === "∅/2 " + f2(M.flare.openedCm.back) && T(m, "open-front") === "∅/2 " + f2(M.flare.openedCm.front), "6: 벌림 치수선 = 실제 벌림");
  const db = m.dims.find(d => d.id === "open-back");
  ok(D(db.from, M.hemPoints.backInner) === 0 && D(db.to, M.hemPoints.centerBack) === 0, "6: 벌림 치수선 끝점 = 실제 밑단 끝점");
  ok(m.zones.filter(z => /^open-/.test(z.id)).length === 2 && m.zones.every(z => z.cls === "zone"), "6: 벌린 틈 음영(처리 과정)");
  ok(/^기준점\(뒤\) 회전 9\.\d\d°$/.test(T(m, "pivot-back")) && m.marks.some(x => x.id === "pivot-front"), "6: 기준점 표식·회전각");
  ok(m.lines.find(l => l.id === "block-1").text === "플레어 ∅ = 소매폭 " + f2(M.widthCm) + " × 0.5 = " + f2(M.flare.totalCm) + " · 절개마다 ∅/2 " + f2(M.flare.perCutCm), "6: 산식 줄");
  ok(!/rigid|provisional|compensation/.test(J(m)), "6: 내부 감사 값 미표시");
}

// ── 7. 배선(정적) ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f);
  ok(pos("sleeveCApply.js") > 0 && pos("designSleeveD.js") > pos("sleeveCApply.js") && pos("sleeveDApply.js") > pos("designSleeveD.js") && pos("ui.js") > pos("sleeveDApply.js"), "7: 스크립트 등록·순서(Ⓒ → 엔진 Ⓓ → 연결 Ⓓ → ui.js)");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(["designSleeveD.js", "sleeveDApply.js", "sleevePresets.js", "sleeveCheckpoint.js", "sleeveAnnotation.js", "ui.js"].every(f => ver(f) === "2026100903"), "7: 캐시 버전(2026100903)");
  ok(/function sleeveDOn\(project\)/.test(ui) && /keep !== "D" && window\.sleeveDApply/.test(ui) && /if \(sleeveDOn\(project\)\) \{ window\.sleeveDApply\.rederive\(project\)/.test(ui) && /if \(isD\) \{/.test(ui), "7: ui — 라인 슬롯·배타·재제도 훅·라인 적용 분기");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
