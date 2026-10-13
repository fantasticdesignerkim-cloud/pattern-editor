// ══════════════════════════════════════════════
// sleeveKUICheck.js — 소매 Ⓚ(P.45 하단 퍼프, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveKApply · 표시 줄 · 완료본 · 제작 정보(원래 종이 4조각·틈 3곳·소매산 덧댐·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveKUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js", "designSleeveI.js", "sleeveIApply.js", "designSleeveJ.js", "sleeveJApply.js", "designSleeveK.js", "sleeveKApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SKA = W.sleeveKApply, SK = W.designSleeveK, SJA = W.sleeveJApply, SJ = W.designSleeveJ, SIA = W.sleeveIApply, SI = W.designSleeveI, SHA = W.sleeveHApply, SH = W.designSleeveH, SGA = W.sleeveGApply, SG = W.designSleeveG, SFA = W.sleeveFApply, SF = W.designSleeveF, SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0.7 };
const VER = "2026101601";
// ── 1. 카탈로그 ──
{
  const f = SP.family("puff-sleeve"), rec = SP.get("bunka-sleeve-K");
  ok(f.variants.map(v => v.id).join() === "bunka-sleeve-H,bunka-sleeve-I,bunka-sleeve-J,bunka-sleeve-K" && f.variants[3].availability === "available" && f.variants[3].page === 45, "1: 퍼프 = Ⓗ + Ⓘ + Ⓙ + Ⓚ(실행 · P.45)");
  ok(rec && rec.methodPage === 45 && rec.inputs.map(i => i.key + "=" + (i.defaultValue === undefined ? "" : i.defaultValue)).join() === "sleeveLengthCm=,palmCircumferenceCm=21,riseCm=0.7" && Object.isFrozen(rec), "1: Ⓚ 레코드 · 입력 소매길이 + 손바닥(21) + 상승(0.7)");
  ok(SP.get("bunka-sleeve-J") && SP.get("bunka-sleeve-J").method === "puff-center-parallel-spread-from-sleeve-A", "1: Ⓙ 레코드 보존");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SKA.apply(P, IN), S = P.working.sleeveK, g = P.working.geometry.sleeve;
  const e = SK.draftSleeveK(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), { palmCircumferenceCm: 21, riseCm: 0.7 });
  ok(r.ok && S.presetId === "bunka-sleeve-K" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front", "2: 표시 construction");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveJ === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변 · 출발은 Ⓐ(Ⓙ 상태 없음)");
  const b = SKA.apply(projectWithBodice("A"), { sleeveLengthCm: 52, palmCircumferenceCm: 9, riseCm: 0.7 });
  ok(!b.ok && b.reason === "no-spread" && /지원 범위 밖/.test(b.text), "2: 벌릴 분량 없음 거부(사유)");
  const c = SKA.apply(projectWithBodice("A"), { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: -1 });
  ok(!c.ok && c.reason === "invalid-rise", "2: 상승 음수 거부"); PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SKA.infoLines(P), m = P.working.sleeveK.meta, prim = DS.capPrimitives(P.working.geometry.sleeve), AH = bodice.armholeLengths, ca = m.capLengthsA;
  ok(L.length === 10 && /^퍼프 소매 Ⓚ \(화면 검토용 시안\)/.test(L[0]) && /평행 이동/.test(L[0]) && /소매산 기준점에서 회전/.test(L[0]), "3: 표시 줄 10줄 · 시안");
  ok(/^산식: ■ = Ⓐ 소맷부리 32\.07 − ● = 8\.07 · ∅ = 1\.5● − ■ = 27\.93 · 틈마다 ∅\/3 9\.31 \(실제 뒤 9\.31 · 가운데 9\.31 · 앞 9\.31\) · 개더 계수 1\.5 = 책 설정\(Ⓙ 의 0\.7 과 다른 값\)$/.test(L[2]), "3: 산식·실측: " + L[2]);
  ok(/^이동: 가운데 = 두 반쪽 좌우 ∅\/6 4\.66 평행\(회전 없음\)/.test(L[3]) && /O·SP 는 중심선 절개로 갈라짐\(기준 = 틈 이등분선\)/.test(L[3]), "3: 이동·기준");
  ok(L[4].indexOf("소맷부리(최종 곡선 실측 — 권위값) " + f2(m.hem.lengthCm) + " cm · 산식 2.5● 60.00 · 개더(실측) " + f2(m.hem.gatherCm) + " cm · 산식 1.5● 36.00") === 0 && /물결 = 개더 표시\(재단선 아님\)/.test(L[4]), "3: 소맷부리 실측·산식 구분");
  ok(/^소맷부리 truing\(시안\): 원래 밑단 최대 파임 \d\.\d\d · 덧댐 \d\.\d\d cm · 면적 파임/.test(L[5]), "3: 파임·덧댐 사실 표시: " + L[5]);
  ok(/^소매산 상승 0\.70 cm\(설정값 — 개더 계수와 별개\) · 국소 재제도\(잠정\): 가운데 틈 양쪽 /.test(L[6]) && /기준점 꺾임 뒤 /.test(L[6]), "3: 상승·재제도 구간");
  const tf = prim.lengths.front - AH.front, tb = prim.lengths.back - AH.back;
  ok(L[8].indexOf("Ⓐ 실측 이세 앞 " + sg(ca.front - AH.front)) === 0 && L[8].indexOf("추가 개더(최종 − Ⓐ 소매산) 앞 " + sg(prim.lengths.front - ca.front)) > 0, "3: Ⓐ 이세 / 추가 개더 구분");
  ok(L[9] === "최종 소매산 − AH = 이세 + 개더 총량 앞 " + sg(tf) + " · 뒤 " + sg(tb) + " · 총 " + sg(tf + tb) + " cm", "3: 총량 줄");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SKA.apply(Q, IN);
  ok(SKA.reject(Q, { reason: "invalid-rise", text: "x" }) && SC.check(Q).fails.indexOf("sleeve-k-blocked") >= 0 && SKA.rederive(Q).ok && !SKA.isBlocked(Q), "4: 차단·재제도");
  SJA.apply(Q, IN);
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓙ·Ⓚ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-K", "5: 게이트 통과 " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && R.origin.presetId === "bunka-sleeve-K" && R.origin.methodPage === 45 && R.origin.method === "puff-center-parallel-plus-cap-pivot-slash-from-sleeve-A" && J(R.inputs) === J(IN) && Object.isFrozen(R) && J(R.geometry) === J(P.working.geometry.sleeve), "5: 완료본 origin·inputs·geometry 불변 복사");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  const h0 = R.hash;
  SKA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 1 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 상승 변경 → 변경됨");
  SKA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 22, riseCm: 0.7 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 손바닥 변경 → 변경됨");
  SKA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0 && Object.isFrozen(P.working.sleeveResult), "5: 같은 입력 재적용 → 변경 없음 · 완료본·hash 불변"); SC.complete(P);
  const Q = projectWithBodice("A"); SJA.apply(Q, IN); ok(SC.complete(Q).ok && Q.working.sleeveResult.origin.presetId === "bunka-sleeve-J", "5: Ⓙ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보(원래 종이 4조각 · 틈 3곳 · 소매산 덧댐 · 최종선) ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveK.meta;
  ok(mOn && mOn.line === "K" && /화면 검토용 시안/.test(mOn.title), "6: Ⓚ 모델");
  const pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === "paper-backOuter,paper-backCenter,paper-frontCenter,paper-frontOuter" && ["backOuter", "backCenter", "frontCenter", "frontOuter"].every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 4조각 = 엔진 강체 자료 그대로");
  const zs = mOn.zones.filter(z => z.cls === "zone").map(z => z.id);
  ok(zs.join() === "fill-center,wedge-back,wedge-front" && J(mOn.zones.find(z => z.id === "fill-center").pts) === J(M.fill.center) && mOn.zones.map(z => z.cls).lastIndexOf("paper") < mOn.zones.findIndex(z => z.cls === "zone"), "6: 틈 3곳(가운데 평행 + 소매산 덧댐 · 양옆 쐐기) 음영(종이 위)");
  ok(T(mOn, "rise") === "상승 0.70" && T(mOn, "open-center") === "∅/3 9.31 (평행)" && T(mOn, "open-back") === "∅/3 9.31" && T(mOn, "open-front") === "∅/3 9.31", "6: 상승·틈 치수 = 실측");
  const all = J(mOn.lines);
  ok(/녹색 = 원래 종이 4조각/.test(all) && /남색선과의 차이 = 재제도·truing/.test(all) && /남색 실선 = 최종 재단선/.test(all) && /물결 = 개더 표시\(재단선 아님\)/.test(all) && /이세\+개더 총량/.test(all) && /산식 2\.5● 60\.00/.test(all), "6: 범례·차이 설명·개더·산식/실측");
  ok(/새 꼭대기\(틈 가운데\)/.test(all) && /이세\+개더 /.test(T(mOn, "cap-back-2")) && /기준점\(뒤\) 회전/.test(all), "6: 꼭대기·이세+개더·기준점 표기");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.filter(z => z.cls === "zone").length === 3, "6: 녹색 토글 끔(틈·덧댐은 유지)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveK, r: P.working.sleeveResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SAN.overhang && SAN.overhang(P, 10, { info: true, ref: true });
  ok(J({ g: P.working.geometry, s: P.working.sleeveK, r: P.working.sleeveResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·상태·완료본·hash 불변)");
  ok(rm && rm.line === "K-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 3 && !rm.refs.some(r => r.id === "ref-el") && /평행 이동/.test(J(rm.lines)) && /바깥 조각만 기준점/.test(J(rm.lines)), "6: 비교 도안(Ⓚ — 절개 3개 · 출발 Ⓐ)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveK.js") > pos("sleeveJApply.js") && pos("sleeveKApply.js") > pos("designSleeveK.js") && pos("ui.js") > pos("sleeveKApply.js"), "7: 스크립트 순서");
  ok(["designSleeveK.js", "sleeveKApply.js", "sleevePresets.js", "sleeveCheckpoint.js", "sleeveAnnotation.js", "ui.js", "render.js"].every(f => ver(f) === VER) && ver("designSleeveJ.js") === "2026101601", "7: 캐시 버전 " + VER + " · Ⓙ 파일은 그대로");
  ok(/function sleeveKOn\(project\)/.test(ui) && /function applySleeveK\(project\)/.test(ui) && /keep !== "K" && window\.sleeveKApply/.test(ui) && /if \(isK\) \{/.test(ui) && /window\.sleeveKApply\.rederive\(project\)/.test(ui) && /_sm\.line === "K"/.test(rn), "7: ui·render 배선");
  ok(/riseRow\.hidden = !\(sleeveJOn\(project\) \|\| sleeveKOn\(project\)/.test(ui) && /id="inpSleeveRise" type="number" min="0" step="0.1" value="0\.7"/.test(html), "7: 상승 입력칸 Ⓙ·Ⓚ 공용(기본 0.7)");
  ok(/id="chkSleeveHPieces" checked/.test(html) && /id="chkSleeveHRef">/.test(html), "7: 녹색 토글 기본 켜짐 · 비교 도안 기본 꺼짐");
  ok(/const inputsOk = sleeveLineOn\(project\) \? readNum\("inpSleeveLength", 10, 90\)\.valid : readSleeveInputs\(\)\.valid;/.test(ui) && /apply\.disabled = !\(gate && inputsOk && !invalid\)/.test(ui), "7: 라인이 켜져 있으면 표시용 소맷부리 칸(60 초과)으로 적용 버튼을 잠그지 않음");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
