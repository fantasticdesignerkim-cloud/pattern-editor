// ══════════════════════════════════════════════
// sleeveJUICheck.js — 소매 Ⓙ(P.45 퍼프 중심선 평행 벌림, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveJApply · 표시 줄 · 완료본 · 제작 정보(원래 종이 2조각·덧댐·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveJUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js", "designSleeveI.js", "sleeveIApply.js", "designSleeveJ.js", "sleeveJApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SJA = W.sleeveJApply, SJ = W.designSleeveJ, SIA = W.sleeveIApply, SI = W.designSleeveI, SHA = W.sleeveHApply, SH = W.designSleeveH, SGA = W.sleeveGApply, SG = W.designSleeveG, SFA = W.sleeveFApply, SF = W.designSleeveF, SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0.7 };
const VER = "2026102001";
// ── 1. 카탈로그 ──
{
  const f = SP.family("puff-sleeve"), rec = SP.get("bunka-sleeve-J");
  ok(f.variants.map(v => v.id).slice(0, 3).join() === "bunka-sleeve-H,bunka-sleeve-I,bunka-sleeve-J" && f.variants[2].availability === "available" && f.variants[2].page === 45, "1: 퍼프 = Ⓗ + Ⓘ + Ⓙ(실행 · P.45)");
  ok(rec && rec.methodPage === 45 && rec.inputs.map(i => i.key + "=" + (i.defaultValue === undefined ? "" : i.defaultValue)).join() === "sleeveLengthCm=,palmCircumferenceCm=21,riseCm=0.7" && Object.isFrozen(rec), "1: Ⓙ 레코드 · 입력 소매길이 + 손바닥(21) + 상승(0.7)");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SJA.apply(P, IN), S = P.working.sleeveJ, g = P.working.geometry.sleeve;
  const e = SJ.draftSleeveJ(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), { palmCircumferenceCm: 21, riseCm: 0.7 });
  ok(r.ok && S.presetId === "bunka-sleeve-J" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-edge-back,cut-edge-front", "2: 표시 construction");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveI === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const b = SJA.apply(projectWithBodice("A"), { sleeveLengthCm: 52, palmCircumferenceCm: 10, riseCm: 0.7 });
  ok(!b.ok && b.reason === "no-spread" && /지원 범위 밖/.test(b.text), "2: 벌릴 분량 없음 거부(사유)");
  const c = SJA.apply(projectWithBodice("A"), { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: -1 });
  ok(!c.ok && c.reason === "invalid-rise", "2: 상승 음수 거부"); PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SJA.infoLines(P), m = P.working.sleeveJ.meta, prim = DS.capPrimitives(P.working.geometry.sleeve), AH = bodice.armholeLengths, ca = m.capLengthsA;
  ok(L.length === 8 && /^퍼프 소매 Ⓙ \(화면 검토용 시안\)/.test(L[0]) && /평행 이동\(회전 없음\)/.test(L[0]), "3: 표시 줄 8줄 · 시안 · 평행 이동");
  ok(/^산식: ■ = Ⓐ 소맷부리 32\.07 − ● = 8\.07 · ∅ = 0\.7● − ■ = 8\.73 \(좌우 ∅\/2 = 4\.37/.test(L[2]), "3: 산식: " + L[2]);
  ok(L[3].indexOf("소맷부리(평행 벌림 후 직선 — 곡선화 안 함) 40.80 cm = 1.7● · 개더 16.80 cm") === 0 && /물결 = 개더 표시\(재단선 아님\)/.test(L[3]), "3: 소맷부리 직선·개더·물결 설명");
  ok(/^소매산 상승 0\.70 cm\(설정값 — 개더 계수 0\.7 과 별개\)/.test(L[4]), "3: 상승 = 별개 설정값");
  const tf = prim.lengths.front - AH.front, tb = prim.lengths.back - AH.back;
  ok(L[6].indexOf("Ⓐ 실측 이세 앞 " + sg(ca.front - AH.front)) === 0 && L[6].indexOf("추가 개더(최종 − Ⓐ 소매산) 앞 " + sg(prim.lengths.front - ca.front)) > 0, "3: Ⓐ 이세 / 추가 개더 구분");
  ok(L[7] === "최종 소매산 − AH = 이세 + 개더 총량 앞 " + sg(tf) + " · 뒤 " + sg(tb) + " · 총 " + sg(tf + tb) + " cm", "3: 총량 줄");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SJA.apply(Q, IN);
  ok(SJA.reject(Q, { reason: "invalid-rise", text: "x" }) && SC.check(Q).fails.indexOf("sleeve-j-blocked") >= 0 && SJA.rederive(Q).ok && !SJA.isBlocked(Q), "4: 차단·재제도");
  SIA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 21 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓘ·Ⓙ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-J", "5: 게이트 통과 " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && R.origin.presetId === "bunka-sleeve-J" && R.origin.methodPage === 45 && J(R.inputs) === J(IN) && Object.isFrozen(R) && J(R.geometry) === J(P.working.geometry.sleeve), "5: 완료본 origin·inputs·geometry 불변 복사");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SJA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 1 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 상승 변경 → 변경됨");
  SJA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 22, riseCm: 0.7 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 손바닥 변경 → 변경됨");
  SJA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false, "5: 같은 입력 재적용 → 변경 없음"); SC.complete(P);
  const Q = projectWithBodice("A"); SIA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 21 }); ok(SC.complete(Q).ok, "5: Ⓘ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보(원래 종이 2조각 · 덧댐 · 원래 소매산 · 최종선) ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveJ.meta;
  ok(mOn && mOn.line === "J" && /화면 검토용 시안/.test(mOn.title), "6: Ⓙ 모델");
  const pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === "paper-back,paper-front" && ["back", "front"].every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 2조각 = 엔진 강체 자료 그대로");
  const fz = mOn.zones.find(z => z.id === "fill-gap");
  ok(fz && J(fz.pts) === J(M.fill.pts) && mOn.zones.map(z => z.cls).lastIndexOf("paper") < mOn.zones.findIndex(z => z.cls === "zone"), "6: 덧댄 종이 음영(종이 위)");
  ok(mOn.refs.filter(r => /^orig-cap-/.test(r.id)).length === M.originalCap.back.length + M.originalCap.front.length - 2, "6: 원래 소매산(점선) = 대체 구간");
  ok(T(mOn, "rise") === "상승 0.70" && T(mOn, "open-gap") === "∅ 8.73 (좌우 ∅/2 4.37)", "6: 상승·벌림 치수");
  const all = J(mOn.lines);
  ok(/녹색 = 원래 종이 2조각/.test(all) && /남색 실선 = 최종 재단선/.test(all) && /물결 = 개더 표시\(재단선 아님\)/.test(all) && /이세\+개더 총량/.test(all), "6: 범례·개더 설명·총량");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.some(z => z.id === "fill-gap"), "6: 녹색 토글 끔(덧댐은 유지)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveJ, r: P.working.sleeveResult });
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10);
  ok(J({ g: P.working.geometry, s: P.working.sleeveJ, r: P.working.sleeveResult }) === before && SC.isCurrentSleeveChanged(P) === false, "6: 표시 전용(geometry·상태·hash 불변)");
  ok(rm && rm.line === "J-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 1 && !rm.refs.some(r => r.id === "ref-el") && /평행 이동\(회전 없음\)/.test(J(rm.lines)), "6: 비교 도안(Ⓙ — 중심선 절개 1개)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveJ.js") > pos("sleeveIApply.js") && pos("sleeveJApply.js") > pos("designSleeveJ.js") && pos("ui.js") > pos("sleeveJApply.js"), "7: 스크립트 순서");
  ok((["designSleeveJ.js"].every(f => ver(f) === VER) && ver("sleeveJApply.js") === "2026102802") && (ver("sleevePresets.js") === "2026102901" && ver("render.js") === "2026102906" && ver("sleeveCheckpoint.js") === "2026102901" && ver("ui.js") === "2026102901") && ver("sleeveAnnotation.js") === "2026102906", "7: 캐시 버전 Ⓙ " + VER + " · 공용 2026102703");
  ok(/function sleeveJOn\(project\)/.test(ui) && /keep !== "J" && window\.sleeveJApply/.test(ui) && /if \(isJ\) \{/.test(ui) && /window\.sleeveJApply\.rederive\(project\)/.test(ui) && /_sm\.line === "J"/.test(rn), "7: ui·render 배선");
  ok(/id="rowSleeveRise" hidden/.test(html) && /id="inpSleeveRise" type="number" min="0" step="0.1" value="0\.7"/.test(html) && /"inpSleeveRise"(, "inpSleeveUpperArm")?\]\.forEach/.test(ui), "7: 상승 입력칸(기본 0.7 · 0 허용)");
  ok(/id="chkSleeveHPieces" checked/.test(html) && /id="chkSleeveHRef">/.test(html), "7: 녹색 토글 기본 켜짐 · 비교 도안 기본 꺼짐");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
