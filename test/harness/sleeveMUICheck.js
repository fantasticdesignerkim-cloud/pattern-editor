// ══════════════════════════════════════════════
// sleeveMUICheck.js — 소매 Ⓜ(P.46 하단 반소매 퍼프, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveMApply · 표시 줄 · 완료본 · 제작 정보(원래 종이 6조각·틈 5곳·소매산 덧댐·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveMUICheck.js
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
  "designSleeveM.js", "sleeveMApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, DS = W.designSleeve,
  SMA = W.sleeveMApply, SM = W.designSleeveM, SLA = W.sleeveLApply, SKA = W.sleeveKApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 20, upperArmCm: 26, riseCm: 0.5 };
const VER = "2026102001";
// ── 1. 카탈로그 ──
{
  const f = SP.family("short-sleeve"), rec = SP.get("bunka-sleeve-M");
  ok(f.variants.map(v => v.symbol).join("") === "LMNOPQ" && f.variants[1].availability === "available" && f.variants[1].presetId === "bunka-sleeve-M" && f.variants[1].page === 46
    && f.variants.every(v => v.availability === "available"), "1: 반소매 = Ⓛ~Ⓠ 모두 실행");
  ok(rec && rec.methodPage === 46 && rec.inputs.map(i => i.key + "=" + i.defaultValue).join() === "sleeveLengthCm=20,upperArmCm=26,riseCm=0.5" && Object.isFrozen(rec), "1: Ⓜ 레코드 · 입력 소매길이 20 · 위팔 26 · 상승 0.5 — 손바닥 없음");
  ok(SP.get("bunka-sleeve-K").inputs.find(i => i.key === "riseCm").defaultValue === 0.7 && SP.get("bunka-sleeve-L").inputs.length === 2, "1: Ⓚ 상승 0.7 · Ⓛ 레코드 보존");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, AH = bodice.armholeLengths, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SMA.apply(P, IN), S = P.working.sleeveM, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 20 }), e = SM.draftSleeveM(a, { upperArmCm: 26, riseCm: 0.5 });
  ok(r.ok && S.presetId === "bunka-sleeve-M" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline) && J(g.capSplit) === J(e.geometry.capSplit) && g.capSplit.x === a.meta.sp.x,
    "2: 적용 — 상태·geometry(분할 기준 포함) = 엔진 · 출발 = 소매길이 20 의 Ⓐ");
  ok(S.sourceSleeveAHash === e.sourceSleeveAHash && S.sourceBodiceHash === bodice.hash, "2: 출처 hash(몸판 · 출발 Ⓐ)");
  ok(g.construction.map(c => c.role).join() === "center-line,cut-center-back,cut-center-front,cut-axis-back-inner,cut-edge-back-inner,cut-axis-back-outer,cut-edge-back-outer,cut-axis-front-inner,cut-edge-front-inner,cut-axis-front-outer,cut-edge-front-outer", "2: 표시 construction 11");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveL === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const PN = projectWithBodice("A"), neg = SMA.apply(PN, { sleeveLengthCm: 20, upperArmCm: 30, riseCm: 0.5 });
  ok(neg.ok && PN.working.sleeveM.meta.formula.square < 0 && SC.check(PN).ok && SC.complete(PN).ok && PN.working.sleeveResult.inputs.upperArmCm === 30, "2: ■ < 0(위팔 30) 같은 산식 → 게이트 → 완료");
  const g15 = SMA.apply(projectWithBodice("A"), { sleeveLengthCm: 15, upperArmCm: 30, riseCm: 0.5 });
  ok(!g15.ok && g15.reason === "rotation-too-large" && g15.numericGuard === true && /설정된 수치 가드 45°/.test(g15.text) && /물리적으로 불가능하다는 판정은 아닙니다/.test(g15.text), "2: 회전 수치 가드 — 책 규칙·물리 불가가 아님을 문구로 구분");
  const b15 = SMA.apply(projectWithBodice("A"), { sleeveLengthCm: 20, upperArmCm: 26, riseCm: 1.5 });
  ok(!b15.ok && b15.reason === "bridge-inflection-unavoidable" && b15.provisionalLimit === true && /잠정 설정의 한계/.test(b15.text), "2: 상승 1.5 — 잠정 재제도 구간 상한 한계로 표시");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SMA.infoLines(P), m = P.working.sleeveM.meta, prim = DS.capPrimitives(P.working.geometry.sleeve), ca = m.capLengthsA;
  ok(L.length === 11 && /^반소매 퍼프 Ⓜ \(화면 검토용 시안\) · 소매길이 20\.00 의 소매 Ⓐ 에 절개 5개/.test(L[0]), "3: 표시 줄 11줄 · 시안");
  ok(L[1] === "커프스 달림 ● = 위팔 둘레 26.00 + 4 = 30.00 cm · 폭 1.00 cm (치수 정보 — 커프스 조각 없음)", "3: 커프스");
  ok(/^산식: ■ = Ⓐ 소매폭 32\.07 − ● = 2\.07 · ∅ = 0\.7● − ■ = 18\.93 · ⊠ = ∅\/10 = 1\.89 · 틈\(현\) 뒤 → 앞 ⊠ · 2⊠ · 4⊠ · 2⊠ · ⊠ \(실제 1\.89 · 3\.79 · 7\.57 · 3\.79 · 1\.89\) · 개더 계수 0\.7 = 책 설정$/.test(L[2]), "3: 산식·실측: " + L[2]);
  ok(/^이동: 가운데 = 두 반쪽 좌우 2⊠ 3\.79 평행/.test(L[3]) && /중간 조각 뒤 /.test(L[3]) && /함께 운반된 기준점 중심/.test(L[3]) && /기준 = 틈 이등분선/.test(L[3]), "3: 이동 순서·기준");
  ok(L[4].indexOf("소맷부리(최종 곡선 실측 — 권위값) " + f2(m.hem.lengthCm) + " cm · 산식 1.7● 51.00 · 개더(실측) " + f2(m.hem.gatherCm) + " cm · 산식 0.7● 21.00") === 0, "3: 소맷부리 실측·산식 구분");
  ok(/^소매산 상승 0\.50 cm\(설정값 — 개더 계수 0\.7 과 별개\) · 국소 재제도\(잠정 — 책 규칙 아님\)/.test(L[6]) && L[7] === "길이: 입력 소매길이(SP → 출발 밑단) 20.00 · 벌린 뒤 중심 길이(새 꼭대기 → 소맷부리 곡선, 실측) " + f2(m.centerLength.spreadCm) + " cm", "3: 상승·재제도 잠정 · 길이 구분");
  const tf = prim.lengths.front - AH.front, tb = prim.lengths.back - AH.back;
  ok(L[9].indexOf("Ⓐ 실측 이세 앞 " + sg(ca.front - AH.front)) === 0 && L[9].indexOf("추가 개더(최종 − Ⓐ 소매산) 앞 " + sg(prim.lengths.front - ca.front)) > 0 && L[10] === "최종 소매산 − AH = 이세 + 개더 총량 앞 " + sg(tf) + " · 뒤 " + sg(tb) + " · 총 " + sg(tf + tb) + " cm", "3: Ⓐ 이세 / 추가 개더 / 총량 분리");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SMA.apply(Q, IN);
  ok(SMA.reject(Q, { reason: "invalid-rise", text: "x", attemptedInputs: { sleeveLength: "20", upperArm: "26", rise: "-1" } }) && SC.check(Q).fails.indexOf("sleeve-m-blocked") >= 0
    && J(Q.working.sleeveM.blocked.attemptedInputs) === J({ sleeveLength: "20", upperArm: "26", rise: "-1" }) && J(Q.working.sleeveM.parameters) === J(IN), "4: 차단 — 거부된 입력 원문 보관 · 적용값 그대로");
  ok(SMA.rederive(Q).ok && !SMA.isBlocked(Q), "4: 재제도로 차단 해제");
  SLA.apply(Q, { sleeveLengthCm: 20, upperArmCm: 26 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓛ·Ⓜ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-M", "5: 게이트 통과 " + J(c.fails));
  const R = SC.complete(P).result, prim = DS.capPrimitives(P.working.geometry.sleeve);
  ok(R && R.origin.presetId === "bunka-sleeve-M" && R.origin.methodPage === 46 && J(R.inputs) === J(IN) && Object.isFrozen(R) && Object.isFrozen(R.cap) && J(R.geometry) === J(P.working.geometry.sleeve) && R.geometry.capSplit.x === P.working.sleeveM.meta.rise.top.x,
    "5: 완료본 origin·inputs·geometry(분할 기준 포함) 동결 복사");
  ok(Math.abs(R.cap.lengths.back - prim.lengths.back) < 1e-3 && Math.abs(R.cap.splitPoint.x - R.geometry.capSplit.x) < 1e-9 && R.sourceSleeveAHash === P.working.sleeveM.sourceSleeveAHash, "5: 완료본 계측 = 중심선 기준 · 출처 hash");
  const h0 = R.hash;
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SMA.apply(P, { sleeveLengthCm: 20, upperArmCm: 26, riseCm: 0 }); ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "5: 상승 변경(0) → 변경됨(완료본 그대로)");
  SMA.apply(P, { sleeveLengthCm: 22, upperArmCm: 26, riseCm: 0.5 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 소매길이 변경 → 변경됨");
  SMA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0, "5: 같은 입력 재적용 → 변경 없음 · hash 불변"); SC.complete(P);
  delete P.working.geometry.sleeve.capSplit; ok(SC.check(P).fails.indexOf("sleeve-m-geometry-mismatch") >= 0, "5: 분할 기준이 사라진 geometry 는 게이트에서 거부"); SMA.apply(P, IN);
  const Q = projectWithBodice("A"); SLA.apply(Q, { sleeveLengthCm: 20, upperArmCm: 26 }); ok(SC.complete(Q).ok && Q.working.sleeveResult.origin.presetId === "bunka-sleeve-L", "5: Ⓛ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveM.meta;
  ok(mOn && mOn.line === "M" && /화면 검토용 시안/.test(mOn.title) && /절개 5개/.test(mOn.title), "6: Ⓜ 모델");
  const pz = mOn.zones.filter(z => z.cls === "paper"), keys = ["backOuter", "backMid", "backCenter", "frontCenter", "frontMid", "frontOuter"];
  ok(pz.map(z => z.id).join() === keys.map(k => "paper-" + k).join() && keys.every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 6조각 = 엔진 강체 자료 그대로");
  ok(mOn.zones.filter(z => z.cls === "zone").map(z => z.id).join() === "fill-center,wedge-back-outer,wedge-back-inner,wedge-front-inner,wedge-front-outer" && mOn.zones.map(z => z.cls).lastIndexOf("paper") < mOn.zones.findIndex(z => z.cls === "zone"), "6: 틈 5곳(가운데 평행 + 소매산 덧댐 · 쐐기 4) 음영(종이 위)");
  const o = M.flare.openedCm;
  ok(T(mOn, "rise") === "상승 0.50" && T(mOn, "open-center") === "4⊠ " + f2(o.center) + " (평행)" && T(mOn, "open-back-inner") === "2⊠ " + f2(o.backInner) && T(mOn, "open-front-outer") === "⊠ " + f2(o.frontOuter), "6: 상승·틈 치수 = 실측");
  const all = J(mOn.lines);
  ok(/녹색 = 원래 종이 6조각/.test(all) && /남색선과의 차이 = 재제도·truing/.test(all) && /남색 실선 = 최종 재단선/.test(all) && /산식 1\.7● 51\.00/.test(all) && /이세\+개더 총량/.test(all) && /물결 = 개더 표시\(재단선 아님\)/.test(all), "6: 범례·차이·산식/실측·총량");
  ok(/새 꼭대기\(틈 가운데\)/.test(all) && /이세\+개더 /.test(T(mOn, "cap-back-2")) && /꼭대기→소맷부리\(중심\) /.test(T(mOn, "len")), "6: 꼭대기·이세+개더·중심 길이 표기");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.filter(z => z.cls === "zone").length === 5, "6: 녹색 토글 끔(틈·덧댐은 유지)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveM, r: P.working.sleeveResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SMA.infoLines(P);
  ok(J({ g: P.working.geometry, s: P.working.sleeveM, r: P.working.sleeveResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·상태·완료본·hash 불변)");
  ok(rm && rm.line === "M-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 5 && /중간 조각을 안쪽 기준점에서/.test(J(rm.lines)) && /소매산 상승 0\.50/.test(J(rm.lines)), "6: 비교 도안(Ⓜ — 절개 5개)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveM.js") > pos("sleeveLApply.js") && pos("sleeveMApply.js") > pos("designSleeveM.js") && pos("ui.js") > pos("sleeveMApply.js"), "7: 스크립트 순서");
  ok((["designSleeveM.js"].every(f => ver(f) === VER) && ver("sleeveMApply.js") === "2026102802") && (ver("sleevePresets.js") === "2026102911" && ver("render.js") === "2026102906" && ver("sleeveCheckpoint.js") === "2026102911" && ver("ui.js") === "2026102911") && ver("sleeveAnnotation.js") === "2026102911", "7: 캐시 버전 " + VER);
  ok(/function sleeveMOn\(project\)/.test(ui) && /function applySleeveM\(project\)/.test(ui) && /keep !== "M" && window\.sleeveMApply/.test(ui) && /if \(isM\) \{/.test(ui) && /window\.sleeveMApply\.rederive\(project\)/.test(ui) && /_sm\.line === "M"/.test(rn), "7: ui·render 배선");
  ok(/riseRow\.hidden = !\(sleeveJOn\(project\) \|\| sleeveKOn\(project\) \|\| sleeveMOn\(project\)/.test(ui) && /armRow\.hidden = !\(sleeveLOn\(project\) \|\| sleeveMOn\(project\)/.test(ui), "7: 상승·위팔 입력칸 Ⓜ 에서 보임");
  ok(/sleeveRiseAuto = step\("riseCm", "inpSleeveRise", sleeveRiseAuto\)/.test(ui) && /sleeveLenAuto = step\("sleeveLengthCm", "inpSleeveLength", sleeveLenAuto\)/.test(ui), "7: 선택한 제도의 기본값(소매길이 20 · 상승 0.5)을 고르는 순간 입력칸에(수정 가능)");
  const fn = ui.slice(ui.indexOf("function applySleeveM(project)"), ui.indexOf("function applySleeveL(project)"));
  ok(/attemptedInputs: raw/.test(fn) && fn.indexOf("inpSleeveHPalm") < 0 && fn.indexOf("Math.min") < 0 && fn.indexOf("Math.max") < 0 && /rise < 0/.test(fn), "7: Ⓜ 적용은 손바닥을 읽지 않고 값을 깎지 않는다 · 거부 입력 원문 보관");
  ok(/at && at\.rise != null/.test(ui), "7: 차단 중 상승 입력칸도 원문 유지");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
