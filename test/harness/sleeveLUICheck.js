// ══════════════════════════════════════════════
// sleeveLUICheck.js — 소매 Ⓛ(P.46 반소매 퍼프, 화면 검토용 시안) 연결 회귀: 카탈로그(반소매 계열) · sleeveLApply · 표시 줄 · 완료본 · 제작 정보(원래 종이 4조각·틈 3곳·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveLUICheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js",
  "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js",
  "designSleeveI.js", "sleeveIApply.js", "designSleeveJ.js", "sleeveJApply.js", "designSleeveK.js", "sleeveKApply.js", "designSleeveL.js", "sleeveLApply.js",
  "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, DS = W.designSleeve,
  SLA = W.sleeveLApply, SL = W.designSleeveL, SKA = W.sleeveKApply, SIA = W.sleeveIApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 20, upperArmCm: 26 };
const VER = "2026102001";
// ── 1. 카탈로그 ──
{
  const f = SP.family("short-sleeve"), rec = SP.get("bunka-sleeve-L");
  ok(f && f.availability === "available" && f.order === 6 && f.symbol === "L" && f.page === 46 && f.variants.map(v => v.symbol).join("") === "LMNOPQ", "1: 반소매 계열 = Ⓛ·Ⓜ·Ⓝ·Ⓞ·Ⓟ·Ⓠ(P.46–48) · 대표 Ⓛ");
  ok(f.variants[0].availability === "available" && f.variants[0].presetId === "bunka-sleeve-L" && f.variants.every(v => v.availability === "available"), "1: Ⓛ·Ⓜ·Ⓝ·Ⓞ·Ⓟ 실행 · Ⓠ 는 보류(blockedBy 보유)");
  ok(f.variants.map(v => v.page).join() === "46,46,47,47,48,48" && SP.resolve("short-sleeve", "bunka-sleeve-L").ok && SP.resolve("short-sleeve", "bunka-sleeve-N").ok && SP.resolve("short-sleeve", "bunka-sleeve-Q").ok, "1: 쪽 · resolve");
  ok(rec && rec.methodPage === 46 && rec.inputs.map(i => i.key + "=" + (i.defaultValue === undefined ? "" : i.defaultValue)).join() === "sleeveLengthCm=20,upperArmCm=26" && Object.isFrozen(rec), "1: Ⓛ 레코드 · 입력 소매길이(기본 20) + 위팔 둘레(기본 26) — 손바닥·상승 없음");
  ok(SP.get("bunka-sleeve-K").inputs[0].defaultValue === undefined && SP.family("dolman-sleeve").availability !== "available", "1: 다른 라인의 소매길이 기본값 없음 · 다음 계열(돌먼)은 보류");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, AH = bodice.armholeLengths, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SLA.apply(P, IN), S = P.working.sleeveL, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 20 }), e = SL.draftSleeveL(a, { upperArmCm: 26 });
  ok(r.ok && S.presetId === "bunka-sleeve-L" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline) && J(g.capSplit) === J(e.geometry.capSplit) && g.capSplit.x === a.meta.sp.x, "2: 적용 — 상태·geometry(분할 기준 포함) = 엔진 · 출발 = 소매길이 20 의 Ⓐ");
  ok(S.sourceSleeveAHash === e.sourceSleeveAHash && S.sourceBodiceHash === bodice.hash, "2: 출처 hash(몸판 · 출발 Ⓐ)");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back,cut-edge-back,cut-axis-front,cut-edge-front", "2: 표시 construction");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveK === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const PN = projectWithBodice("A"), neg = SLA.apply(PN, { sleeveLengthCm: 20, upperArmCm: 29 }), NM = neg.ok ? PN.working.sleeveL.meta : null;
  ok(neg.ok && NM.formula.square < 0 && Math.abs(NM.formula.square - (NM.widthCm - 33)) < 1e-12 && NM.cuff.upperArmCm === 29 && J(PN.working.sleeveL.parameters) === J({ sleeveLengthCm: 20, upperArmCm: 29 })
    && SC.check(PN).ok && SC.complete(PN).ok && Object.isFrozen(PN.working.sleeveResult) && PN.working.sleeveResult.inputs.upperArmCm === 29, "2: ■ < 0(위팔 29) 도 같은 산식으로 적용 → 게이트 → 완료(■ " + (NM ? NM.formula.square.toFixed(2) : "-") + " 그대로)");
  const PC = projectWithBodice("A"), cav = SLA.apply(PC, { sleeveLengthCm: 20, upperArmCm: 34 });
  ok(!cav.ok && cav.reason === "cap-top-concave" && /오목/.test(cav.text) && !cav.numericGuard && PC.working.sleeveL === undefined, "2: 위팔 34 → 소매산 꼭대기 오목(실제 형상 문제)으로 거부");
  const big = SLA.apply(projectWithBodice("A"), { sleeveLengthCm: 20, upperArmCm: 36 });
  ok(!big.ok && big.reason === "rotation-too-large" && big.numericGuard === true && /설정된 수치 가드 45°/.test(big.text) && /물리적으로 불가능하다는 판정은 아닙니다/.test(big.text), "2: 위팔 36 → 회전 수치 가드(책 규칙 아님) — 물리적 불가 판정과 구분된 문구");
  ok(J(Object.keys(SLA)).indexOf("pending") < 0 && SLA.failText({ reason: "cuff-exceeds-sleeve-width" }).indexOf("김님 판단") < 0, "2: «결정 대기» 사유·문구 없음");
  const low = SLA.apply(projectWithBodice("A"), { sleeveLengthCm: 20, upperArmCm: 17 });
  ok(!low.ok && low.reason === "no-spread", "2: 벌릴 분량 없음 거부"); PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SLA.infoLines(P), m = P.working.sleeveL.meta, prim = DS.capPrimitives(P.working.geometry.sleeve), ca = m.capLengthsA;
  ok(L.length === 10 && /^반소매 퍼프 Ⓛ \(화면 검토용 시안\) · 소매길이 20\.00 의 소매 Ⓐ/.test(L[0]), "3: 표시 줄 10줄 · 시안 · 소매길이 20");
  ok(L[1] === "커프스 달림 ● = 위팔 둘레 26.00 + 4 = 30.00 cm · 폭 1.00 cm (치수 정보 — 커프스 조각 없음)", "3: 커프스 = 위팔 둘레 + 4");
  ok(/^산식: ■ = Ⓐ 소매폭 32\.07 − ● = 2\.07 · ∅ = 0\.5● − ■ = 12\.93 · ⊠ = ∅\/4 = 3\.23 · 틈\(현\) 가운데 2⊠ 6\.47 · 양옆 ⊠ 3\.23 \(실제 뒤 3\.23 · 가운데 6\.47 · 앞 3\.23\)$/.test(L[2]), "3: 산식·실측: " + L[2]);
  ok(/^회전: 가운데 ±9\.30°\(SP 대칭 — 전체 틈 2⊠ 에 맞춤\)/.test(L[3]) && /O 는 중심선 절개로 갈라짐\(기준 = SP · 틈 이등분선\)/.test(L[3]), "3: 회전·기준");
  ok(L[4].indexOf("소맷부리(최종 곡선 실측 — 권위값) " + f2(m.hem.lengthCm) + " cm · 산식 1.5● 45.00 · 개더(실측) " + f2(m.hem.gatherCm) + " cm · 산식 0.5● 15.00") === 0, "3: 소맷부리 실측·산식 구분");
  ok(/^소맷부리 truing\(시안\): 원래 밑단 최대 파임 \d\.\d\d · 덧댐 \d\.\d\d cm/.test(L[5]) && /^소매산: 꺾임 3곳 국소 재제도\(잠정 구간 뒤 /.test(L[6]) && /SP 18\.\d\d°/.test(L[6]) && /최종 꼭대기는 원래 SP 보다 /.test(L[6]), "3: 파임·덧댐 · 재제도 구간·꺾임각 · 꼭대기 위치");
  ok(L[7] === "길이: 입력 소매길이(SP → 출발 밑단) 20.00 · 벌린 뒤 중심 길이(최종 꼭대기 → 소맷부리 곡선, 실측) " + f2(m.centerLength.spreadCm) + " cm", "3: 입력 길이 / 벌린 뒤 길이 구분");
  const ef = prim.lengths.front - AH.front, eb = prim.lengths.back - AH.back;
  ok(L[8].indexOf("소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back)) === 0 && L[8].indexOf("Ⓐ 대비 앞 " + sg(prim.lengths.front - ca.front)) > 0 && L[9] === "이세(실측 = 최종 소매산 − AH · 소매산 개더 없음) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "3: 소매산·AH·이세 실측");
  ok(L.join("\n").indexOf("손바닥") < 0 && L.join("\n").indexOf("상승") < 0, "3: 손바닥·상승 문구 없음");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SLA.apply(Q, IN);
  ok(SLA.reject(Q, { reason: "invalid-upper-arm", text: "x", attemptedInputs: { sleeveLength: "20", upperArm: "29" } }) && SC.check(Q).fails.indexOf("sleeve-l-blocked") >= 0
    && J(Q.working.sleeveL.blocked.attemptedInputs) === J({ sleeveLength: "20", upperArm: "29" }) && J(Q.working.sleeveL.parameters) === J(IN), "4: 차단 — 거부된 입력 원문 보관 · 적용값은 그대로(값 대체 없음)");
  ok(SLA.rederive(Q).ok && !SLA.isBlocked(Q), "4: 재제도로 차단 해제");
  SIA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 21 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓘ·Ⓛ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-L", "5: 게이트 통과 " + J(c.fails));
  const R = SC.complete(P).result, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(R && R.origin.presetId === "bunka-sleeve-L" && R.origin.methodPage === 46 && J(R.inputs) === J(IN) && Object.isFrozen(R) && Object.isFrozen(R.cap) && J(R.geometry) === J(P.working.geometry.sleeve) && R.geometry.capSplit.x === P.working.sleeveL.meta.pivots.sp.x, "5: 완료본 origin·inputs·geometry(분할 기준 포함) 동결 복사");
  ok(Math.abs(R.cap.lengths.back - prim.lengths.back) < 1e-3 && Math.abs(R.cap.splitPoint.x - R.geometry.capSplit.x) < 1e-9 && R.sourceSleeveAHash === P.working.sleeveL.sourceSleeveAHash, "5: 완료본 계측 = 중심선 기준 · 출처 hash");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  const h0 = R.hash;
  SLA.apply(P, { sleeveLengthCm: 22, upperArmCm: 26 }); ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "5: 소매길이 변경 → 변경됨(완료본은 그대로)");
  SLA.apply(P, { sleeveLengthCm: 20, upperArmCm: 25 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 위팔 둘레 변경 → 변경됨");
  SLA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0, "5: 같은 입력 재적용 → 변경 없음 · hash 불변"); SC.complete(P);
  delete P.working.geometry.sleeve.capSplit; ok(SC.check(P).fails.indexOf("sleeve-l-geometry-mismatch") >= 0, "5: 분할 기준이 사라진 geometry 는 게이트에서 거부"); SLA.apply(P, IN);
  const Q = projectWithBodice("A"); SKA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0.7 }); ok(SC.complete(Q).ok && Q.working.sleeveResult.origin.presetId === "bunka-sleeve-K", "5: Ⓚ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보(원래 종이 4조각 · 틈 3곳 · 최종선) ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveL.meta;
  ok(mOn && mOn.line === "L" && /화면 검토용 시안/.test(mOn.title) && /반소매 퍼프/.test(mOn.title), "6: Ⓛ 모델");
  const pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === "paper-backOuter,paper-backCenter,paper-frontCenter,paper-frontOuter" && ["backOuter", "backCenter", "frontCenter", "frontOuter"].every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 4조각 = 엔진 강체 자료 그대로");
  ok(mOn.zones.filter(z => z.cls === "zone").map(z => z.id).join() === "wedge-center,wedge-back,wedge-front" && mOn.zones.map(z => z.cls).lastIndexOf("paper") < mOn.zones.findIndex(z => z.cls === "zone"), "6: 틈 3곳 음영(종이 위)");
  ok(T(mOn, "open-center") === "2⊠ " + f2(M.flare.openedCm.center) && T(mOn, "open-back") === "⊠ " + f2(M.flare.openedCm.back) && T(mOn, "open-front") === "⊠ " + f2(M.flare.openedCm.front), "6: 틈 치수 = 실측(2⊠ · ⊠ · ⊠)");
  const all = J(mOn.lines);
  ok(/녹색 = 원래 종이 4조각/.test(all) && /남색선과의 차이 = 재제도·truing/.test(all) && /남색 실선 = 최종 재단선/.test(all) && /산식 1\.5● 45\.00/.test(all) && /입력 소매길이\(SP → 출발 밑단\) 20\.00/.test(all) && /SP 기준\(가운데 대칭/.test(all), "6: 범례·차이 설명·산식/실측·길이 구분");
  ok(/꼭대기→소맷부리\(중심\) /.test(T(mOn, "len")) && /입력 소매길이 20\.00/.test(T(mOn, "len")) && / · 이세 /.test(T(mOn, "cap-back-2")) && T(mOn, "cap-back-2").indexOf("이세+개더") < 0, "6: 중심 길이 치수 · 소매산은 이세(개더 아님)");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.filter(z => z.cls === "zone").length === 3, "6: 녹색 토글 끔(틈은 유지)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveL, r: P.working.sleeveResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SLA.infoLines(P);
  ok(J({ g: P.working.geometry, s: P.working.sleeveL, r: P.working.sleeveResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·상태·완료본·hash 불변)");
  ok(rm && rm.line === "L-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 3 && !rm.refs.some(r => r.id === "ref-el") && /소매길이 20\.00 · 위팔 둘레 26\.00/.test(J(rm.lines)) && /전체 틈 2⊠/.test(J(rm.lines)), "6: 비교 도안(Ⓛ — 절개 3개 · 출발 = 소매길이 20 의 Ⓐ)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveL.js") > pos("sleeveKApply.js") && pos("sleeveLApply.js") > pos("designSleeveL.js") && pos("ui.js") > pos("sleeveLApply.js"), "7: 스크립트 순서");
  ok((["designSleeveL.js"].every(f => ver(f) === VER) && ver("sleeveLApply.js") === "2026102802") && (["sleevePresets.js", "render.js"].every(f => ver(f) === "2026102703") && ver("sleeveCheckpoint.js") === "2026102802" && ver("ui.js") === "2026102802") && ver("sleeveAnnotation.js") === "2026102802", "7: 캐시 버전 " + VER);
  ok(/function sleeveLOn\(project\)/.test(ui) && /function applySleeveL\(project\)/.test(ui) && /keep !== "L" && window\.sleeveLApply/.test(ui) && /if \(isL\) \{/.test(ui) && /window\.sleeveLApply\.rederive\(project\)/.test(ui) && /_sm\.line === "L"/.test(rn), "7: ui·render 배선");
  ok(/id="rowSleeveUpperArm" hidden/.test(html) && /id="inpSleeveUpperArm" type="number" min="0\.1" step="0\.1" value="26"/.test(html) && /armRow\.hidden = !\(sleeveLOn\(project\)/.test(ui) && /"inpSleeveUpperArm"\]\.forEach/.test(ui), "7: 위팔 둘레 입력칸(기본 26) — Ⓛ 에서만 보임");
  ok(/function applySleeveLengthDefault\(\)/.test(ui) && /sleeveVarSel\.addEventListener\("change", \(\) => \{ applySleeveLengthDefault\(\); syncSleeveLineUI\(\); \}\)/.test(ui) && /rebuildSleeveVariantOptions\(\); applySleeveLengthDefault\(\); syncSleeveLineUI\(\);/.test(ui), "7: 소매길이 기본 20 — 선택한 순간 입력칸에 넣음(수정 가능)");
  const fn = ui.slice(ui.indexOf("function applySleeveL(project)"), ui.indexOf("let sleeveLenAuto"));
  ok(fn.indexOf("inpSleeveHPalm") < 0 && fn.indexOf("inpSleeveRise") < 0 && /readPos\("inpSleeveUpperArm"\)/.test(fn) && fn.indexOf("Math.min") < 0 && fn.indexOf("Math.max") < 0, "7: Ⓛ 적용은 손바닥·상승 입력을 읽지 않고 값을 깎지 않는다");
  ok(/attemptedInputs: raw/.test(ui) && /at && at\.sleeveLength != null \? at\.sleeveLength : sl\.parameters\.sleeveLengthCm/.test(ui), "7: 차단 중에도 소매길이 칸은 거부된 입력 원문 유지(원형 기본값으로 몰래 바뀌지 않음)");
  ok(/id="chkSleeveHPieces" checked/.test(html) && /id="chkSleeveHRef">/.test(html), "7: 녹색 토글 기본 켜짐 · 비교 도안 기본 꺼짐");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
