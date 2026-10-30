// ══════════════════════════════════════════════
// sleevePUICheck.js — 소매 Ⓟ(P.48 반소매 플레어, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleevePApply · 표시 줄 · 완료본 · 제작 정보(원래 종이 6조각·틈 5곳·최종선) · 비교 도안 · 배선.
//   node test/harness/sleevePUICheck.js
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
  "designSleeveM.js", "sleeveMApply.js", "designSleeveN.js", "sleeveNApply.js", "designSleeveO.js", "sleeveOApply.js", "designSleeveP.js", "sleevePApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, DS = W.designSleeve,
  SPA = W.sleevePApply, SPm = W.designSleeveP, SOA = W.sleeveOApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 20, flareRatio: 0.7 };
const VER = "2026102602";
// ── 1. 카탈로그 ──
{
  const f = SP.family("short-sleeve"), rec = SP.get("bunka-sleeve-P");
  ok(f.variants.map(v => v.symbol).join("") === "LMNOPQ" && f.variants[4].availability === "available" && f.variants[4].presetId === "bunka-sleeve-P" && f.variants[4].page === 48
    && f.variants.every(v => v.availability === "available"), "1: 반소매 = Ⓛ~Ⓠ 모두 실행");
  ok(rec && rec.methodPage === 48 && rec.inputs.map(i => i.key + "=" + i.defaultValue).join() === "sleeveLengthCm=20,flareRatio=0.7" && Object.isFrozen(rec), "1: Ⓟ 레코드 · 입력 = 기장 20 · 계수 0.7(⊠ 입력 없음)");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, AH = bodice.armholeLengths, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SPA.apply(P, IN), S = P.working.sleeveP, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 20 }), e = SPm.draftSleeveP(a, { flareRatio: 0.7 });
  ok(r.ok && S.presetId === "bunka-sleeve-P" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline) && g.capSplit.x === a.meta.sp.x, "2: 적용 — 상태·geometry = 엔진 · 출발 = 기장 20 의 Ⓐ");
  ok(S.sourceSleeveAHash === e.sourceSleeveAHash && S.sourceBodiceHash === bodice.hash, "2: 출처 hash");
  ok(g.construction.length === 11 && g.construction[0].role === "center-line", "2: 표시 construction 11(중심선 + 절개 10)");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const big = SPA.apply(projectWithBodice("A"), { sleeveLengthCm: 20, flareRatio: 1 });
  ok(!big.ok && big.reason === "rotation-too-large" && big.numericGuard === true && /설정된 수치 가드 45°/.test(big.text) && /물리적으로 불가능하다는 판정은 아닙니다/.test(big.text), "2: 계수 1 → 수치 가드(책 규칙·물리 불가 아님) 문구");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SPA.infoLines(P), m = P.working.sleeveP.meta, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(L.length === 8 && /^반소매 플레어 Ⓟ \(화면 검토용 시안\) · 소매길이 20\.00 의 소매 Ⓐ 에 절개 5개/.test(L[0]), "3: 표시 줄 8줄 · 시안");
  ok(/^산식: ● = Ⓐ 소매 폭 32\.07 · ∅ = ● × 플레어 계수 0\.7\(설정값 — 책 기본 0\.7\) = 22\.45 · ⊠ = ∅\/10 = 2\.24 · 틈\(현\) 뒤 → 앞 ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠ \(실제 2\.24 · 4\.49 · 8\.98 · 4\.49 · 2\.24\)$/.test(L[1]), "3: 산식·실측 현: " + L[1]);
  ok(/중간·바깥 함께 운반/.test(L[2]) && /O 는 중심 절개로 갈라짐/.test(L[2]), "3: 이동 순서·기준");
  ok(L[3] === "소맷부리(최종 곡선 실측 — 권위값) " + f2(m.hem.lengthCm) + " cm · 출발 폭 32.07 · 산식 W(1 + 계수) 54.51 · 편차 " + sg(m.hem.diffFromFormulaCm) + " cm(형상 보정 없음)", "3: 소맷부리 실측 · 출발 폭 · 산식 · 편차");
  ok(/잠정 — 책 규칙 아님/.test(L[5]) && /국소 오목\/S 굽이 실측\(회전의 귀결\): Pb1 — 승인 범위는 P048 참조/.test(L[5]) && !/판단 대기|승인됨/.test(L[5]), "3: 재제도 잠정 · 국소 오목/S 실측 기록(승인·대기 단정 없이 P048 참조)");
  const tf = prim.lengths.front - AH.front, tb = prim.lengths.back - AH.back;
  ok(L[7] === "소매산(최종 실측) 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm · AH 앞 " + f2(AH.front) + " · 뒤 " + f2(AH.back) + " · 이세 앞 " + sg(tf) + " · 뒤 " + sg(tb) + " · 총 " + sg(tf + tb) + " cm", "3: 소매산·AH·이세");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SPA.apply(Q, IN);
  const raw = { sleeveLength: "20", flareRatio: "1" };
  ok(SPA.reject(Q, { reason: "rotation-too-large", text: "x", attemptedInputs: raw }) && SC.check(Q).fails.indexOf("sleeve-p-blocked") >= 0 && J(Q.working.sleeveP.blocked.attemptedInputs) === J(raw) && J(Q.working.sleeveP.parameters) === J(IN), "4: 차단 — 원문 보관 · 적용값 그대로");
  ok(SPA.infoLines(Q).length === 2 && SAN.buildModel(Q) === null && SPA.rederive(Q).ok && !SPA.isBlocked(Q), "4: 차단 표시 · 재제도로 해제");
  SOA.apply(Q, { sleeveLengthCm: 20, innerOffsetCm: 1.25, cutSpacingCm: 2.5, spreadCm: 2, stitchEndCm: 1.5 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓞ·Ⓟ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-P", "5: 게이트 " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && R.origin.presetId === "bunka-sleeve-P" && R.origin.methodPage === 48 && J(R.inputs) === J(IN) && Object.isFrozen(R) && J(R.geometry) === J(P.working.geometry.sleeve), "5: 완료본 동결 복사");
  const h0 = R.hash;
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SPA.apply(P, { sleeveLengthCm: 20, flareRatio: 0.5 }); ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "5: 계수 변경 → 변경됨(완료본 그대로)");
  SPA.apply(P, { sleeveLengthCm: 25, flareRatio: 0.7 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 기장 변경 → 변경됨");
  SPA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0, "5: 같은 입력 재적용 → hash 불변"); SC.complete(P);
  const QG = projectWithBodice("G"), rg = SPA.apply(QG, IN);
  ok(rg.ok && SC.check(QG).ok && SC.complete(QG).ok, "5: 몸판 Ⓖ 에서도 적용·완료(공통 Ⓐ 보완)");
  PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveP.meta;
  ok(mOn && mOn.line === "P" && /화면 검토용 시안/.test(mOn.title), "6: Ⓟ 모델");
  const keys = ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"], pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === keys.map(k => "paper-" + k).join() && keys.every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 6조각(녹색) = 엔진 강체 자료");
  ok(mOn.zones.filter(z => z.cls === "zone").map(z => z.id).join() === "wedge-center,wedge-back-outer,wedge-back-inner,wedge-front-inner,wedge-front-outer", "6: 틈 5곳 음영");
  const o = M.flare.openedCm;
  ok(T(mOn, "open-center") === "4⊠ " + f2(o.center) && T(mOn, "open-back-outer") === "⊠ " + f2(o.backOuter) && T(mOn, "open-front-inner") === "2⊠ " + f2(o.frontInner), "6: 틈 치수 = 실측 현");
  const all = J(mOn.lines);
  ok(/녹색 = 원래 종이 6조각/.test(all) && /남색선과의 차이 = 재제도·truing/.test(all) && /산식 W\(1 \+ 계수\) 54\.51/.test(all) && /소매산 개더 없음/.test(all) && /국소 오목\/S 굽이 실측 Pb1 — 승인 범위는 P048 참조/.test(all) && !/판단 대기/.test(all), "6: 범례·차이·산식/실측·오목 꺾임 기록");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.filter(z => z.cls === "zone").length === 5, "6: 녹색 토글 끔(틈은 유지)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveP, r: P.working.sleeveResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SPA.infoLines(P);
  ok(J({ g: P.working.geometry, s: P.working.sleeveP, r: P.working.sleeveResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·완료본·hash 불변)");
  ok(rm && rm.line === "P-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 5 && /중심선\(SP 쐐기\)/.test(J(rm.lines)) && /플레어 계수 0\.7/.test(J(rm.lines)), "6: 비교 도안(Ⓟ — 절개 5개 · 가운데 SP 쐐기)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveP.js") > pos("sleeveOApply.js") && pos("sleevePApply.js") > pos("designSleeveP.js") && pos("ui.js") > pos("sleevePApply.js"), "7: 스크립트 순서");
  ok((["designSleeveP.js"].every(f => ver(f) === VER) && ver("sleevePApply.js") === "2026102802") && (ver("sleevePresets.js") === "2026103001" && ver("render.js") === "2026102906" && ver("sleeveCheckpoint.js") === "2026102911" && ver("ui.js") === "2026102911") && ver("sleeveAnnotation.js") === "2026103001" && ((ver("designSleeveO.js") === "2026102802") && ver("sleeveOApply.js") === "2026102802"), "7: 캐시 버전 " + VER + " · Ⓞ 파일은 그대로");
  ok(/id="rowSleevePFlare" hidden/.test(html) && /id="inpSleevePFlare" type="number" min="0\.05" step="0\.05" value="0\.7"/.test(html), "7: 계수 입력칸 · 기본 0.7 · 숨김 시작");
  ok(/function sleevePOn\(project\)/.test(ui) && /function applySleeveP\(project\)/.test(ui) && /keep !== "P" && window\.sleevePApply/.test(ui) && /if \(isP\) \{/.test(ui) && /window\.sleevePApply\.rederive\(project\)/.test(ui) && /_sm\.line === "P"/.test(rn), "7: ui·render 배선");
  const fn = ui.slice(ui.indexOf("function applySleeveP(project)"), ui.indexOf("// Ⓞ 입력칸"));
  ok(/attemptedInputs: raw/.test(fn) && fn.indexOf("Math.min") < 0 && fn.indexOf("Math.max") < 0 && /readPos\("inpSleevePFlare"\)/.test(fn) && /at && at\.flareRatio != null/.test(ui), "7: 값을 깎지 않음 · 거부 입력 원문 보관·복원");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
