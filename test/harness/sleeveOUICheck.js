// ══════════════════════════════════════════════
// sleeveOUICheck.js — 소매 Ⓞ(P.47 하단 턱트 슬리브, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveOApply · 표시 줄 · 완료본(소매산 = 턱 접은 길이) · 제작 정보(원래 종이 5조각·평행 틈·박음 띠·최종선) · 비교 도안 · 배선.
//   node test/harness/sleeveOUICheck.js
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
  "designSleeveM.js", "sleeveMApply.js", "designSleeveN.js", "sleeveNApply.js", "designSleeveO.js", "sleeveOApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, DS = W.designSleeve,
  SOA = W.sleeveOApply, SO = W.designSleeveO, SNA = W.sleeveNApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 20, innerOffsetCm: 1.25, cutSpacingCm: 2.5, spreadCm: 2, stitchEndCm: 1.5 };
const VER = "2026102102";
// ── 1. 카탈로그 ──
{
  const f = SP.family("short-sleeve"), rec = SP.get("bunka-sleeve-O");
  ok(f.variants.map(v => v.symbol).join("") === "LMNOPQ" && f.variants[3].availability === "available" && f.variants[3].presetId === "bunka-sleeve-O" && f.variants[3].page === 47
    && f.variants.every(v => v.availability === "available"), "1: 반소매 = Ⓛ~Ⓠ 모두 실행");
  ok(rec && rec.methodPage === 47 && rec.inputs.map(i => i.key + "=" + i.defaultValue).join() === "sleeveLengthCm=20,innerOffsetCm=1.25,cutSpacingCm=2.5,spreadCm=2,stitchEndCm=1.5" && Object.isFrozen(rec), "1: Ⓞ 레코드 · 책 기본 설정값 5개(소매산 박음 입력 없음)");
  ok(SP.resolve("short-sleeve", "bunka-sleeve-O").ok && SP.get("bunka-sleeve-N").inputs.length === 5, "1: resolve Ⓞ · Ⓝ 레코드 보존");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, AH = bodice.armholeLengths, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SOA.apply(P, IN), S = P.working.sleeveO, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 20 }), e = SO.draftSleeveO(a, IN);
  ok(r.ok && S.presetId === "bunka-sleeve-O" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline) && g.capSplit.x === a.meta.sp.x, "2: 적용 — 상태·geometry = 엔진 · 출발 = 소매길이 20 의 Ⓐ");
  ok(S.sourceSleeveAHash === e.sourceSleeveAHash && S.sourceBodiceHash === bodice.hash, "2: 출처 hash");
  const roles = g.construction.map(c => c.role);
  ok(roles[0] === "center-line" && ["tuck-crease-edge", "tuck-place-edge", "tuck-mid", "tuck-crease", "tuck-place", "tuck-stitch-end"].every(k => roles.filter(x => x === k).length === 4) && roles.length === 25, "2: 표시 construction = 중심선 + 턱 4 × 6");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveN === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const bad = SOA.apply(projectWithBodice("A"), Object.assign({}, IN, { innerOffsetCm: 0.9 }));
  ok(!bad.ok && bad.reason === "tuck-layer-exceeds-piece" && /접힘 모델 범위 밖/.test(bad.text) && /물리 불가 판정은 아닙니다/.test(bad.text), "2: 모델 범위 밖 — 책 규칙·물리 불가 아님을 문구로 구분");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SOA.infoLines(P), m = P.working.sleeveO.meta;
  ok(L.length === 10 && /^턱트 슬리브 Ⓞ \(화면 검토용 시안\) · 소매길이 20\.00 의 소매 Ⓐ 에 평행 절개 4개\(중심에서 ±1\.25 · ±3\.75, 중심선은 자르지 않음\)/.test(L[0]), "3: 표시 줄 10줄 · 시안 · 절개 위치");
  ok(L[1] === "설정(책 기본값 — 수정 가능, 산식 아님): 안쪽 절개 중심에서 좌우 각 1.25(가운데 띠 2.50) · 절개 간격 2.50 · 틈마다 벌림 2.00 · 소맷부리 박기 끝 1.50 cm", "3: 설정값(산식 아님) · 가운데 띠 표기");
  ok(/^이동\(평행 · 회전 없음\): 가운데 띠\(SP·중심선\) 고정 · 안쪽 띠 -2\.00 \/ \+2\.00 · 바깥 조각 -4\.00 \/ \+4\.00/.test(L[2]), "3: 평행 이동");
  ok(/바깥쪽\(소매 밑선 쪽\)/.test(L[3]) && /중심 쪽 조각 아래/.test(L[3]) && /Ⓝ 은 반대/.test(L[3]) && /소매산 쪽 박음 길이 = 미지정/.test(L[4]), "3: 턱 방향·겹 · 소매산 박음 미지정");
  ok(L[5].indexOf("소매산(최종 geometry 실측) 재단(펼침) " + f2(m.cap.cutCm) + " · 봉제(턱 접음) " + f2(m.cap.sewnCm)) === 0 && L[6] === "소맷부리(최종 geometry 실측) 재단(펼침) " + f2(m.hem.cutCm) + " · 봉제(턱 접음) " + f2(m.hem.sewnCm) + " cm · 참고 W + 틈 합 = " + f2(m.hem.formulaCutCm) + " · W " + f2(m.widthCm), "3: 소매산·소맷부리 재단/봉제 실측 · 참고값 구분");
  const tf = m.cap.sewn.front - AH.front, tb = m.cap.sewn.back - AH.back;
  ok(L[9] === "소매산(턱 접음) 앞 " + f2(m.cap.sewn.front) + " · 뒤 " + f2(m.cap.sewn.back) + " · AH 앞 " + f2(AH.front) + " · 뒤 " + f2(AH.back) + " · 이세 앞 " + sg(tf) + " · 뒤 " + sg(tb) + " · 총 " + sg(tf + tb) + " cm", "3: 이세 = 턱 접은 소매산 − AH");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SOA.apply(Q, IN);
  const raw = { sleeveLength: "20", innerOffsetCm: "0.9", cutSpacingCm: "2.5", spreadCm: "2", stitchEndCm: "1.5" };
  ok(SOA.reject(Q, { reason: "tuck-layer-exceeds-piece", text: "x", attemptedInputs: raw }) && SC.check(Q).fails.indexOf("sleeve-o-blocked") >= 0
    && J(Q.working.sleeveO.blocked.attemptedInputs) === J(raw) && J(Q.working.sleeveO.parameters) === J(IN), "4: 차단 — 거부된 입력 원문 보관 · 적용값 그대로");
  ok(SOA.infoLines(Q).length === 2 && SAN.buildModel(Q) === null && SOA.rederive(Q).ok && !SOA.isBlocked(Q), "4: 차단 표시 · 재제도로 해제");
  SNA.apply(Q, { sleeveLengthCm: 20, cutOffsetCm: 2.5, centerTuckCm: 4, sideTuckCm: 2, stitchEndCm: 1.5 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓝ·Ⓞ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P), m = P.working.sleeveO.meta;
  ok(c.ok && c.preset === "bunka-sleeve-O" && Math.abs(c.capLengths.total - m.cap.sewnCm) < 1e-9 && Math.abs(c.hemLengths.sewn.total - m.widthCm) < 1e-9, "5: 게이트 · 소매산 = 턱 접은 길이 · 소맷부리 봉제 = W " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && R.origin.presetId === "bunka-sleeve-O" && R.origin.methodPage === 47 && J(R.inputs) === J(IN) && Object.isFrozen(R) && J(R.geometry) === J(P.working.geometry.sleeve)
    && Math.abs(R.cap.lengths.total - m.cap.sewnCm) < 1e-3 && Math.abs(R.cap.cutLengths.total - m.cap.cutCm) < 1e-3 && /턱을 접은/.test(R.cap.lengthBasis), "5: 완료본 동결 · 소매산 봉제/재단 둘 다");
  const h0 = R.hash;
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SOA.apply(P, Object.assign({}, IN, { stitchEndCm: 2 })); ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "5: 박기 끝 변경 → 변경됨");
  SOA.apply(P, Object.assign({}, IN, { spreadCm: 1.5 })); ok(SC.isCurrentSleeveChanged(P) === true, "5: 벌림 변경 → 변경됨");
  SOA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0, "5: 같은 입력 재적용 → hash 불변"); SC.complete(P);
  const hemSeg = P.working.geometry.sleeve.outline.find(s => s.role === "hem"), keep = J(hemSeg.commands);
  hemSeg.commands[1].points[2].x += 0.01; ok(SC.check(P).fails.some(f => f === "length-mismatch" || f === "hem-unmeasured"), "5: 소맷부리가 바뀐 geometry 거부"); hemSeg.commands = JSON.parse(keep);
  PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveO.meta;
  ok(mOn && mOn.line === "O" && /화면 검토용 시안/.test(mOn.title) && /바깥쪽/.test(mOn.title), "6: Ⓞ 모델");
  const keys = ["backOuter", "backInner", "center", "frontInner", "frontOuter"], pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === keys.map(k => "paper-" + k).join() && keys.every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid.pieces[k])), "6: 원래 종이 5조각(녹색) = 엔진 강체 자료");
  ok(mOn.zones.filter(z => z.cls === "zone").length === 8 && mOn.refs.filter(r => /^tuck-mark-/.test(r.id)).length === 8, "6: 틈 4 + 박음 띠 4 음영 · 사선 8");
  ok(/소매산\(턱 접음\) /.test(T(mOn, "cap-back-1")) && T(mOn, "stitch-end") === "박기 끝 1.50 (소맷부리에서)" && T(mOn, "cap-stitch") === null && /소매산 쪽 박음 길이 미지정\(책에 수치 없음\)/.test(J(mOn.lines)) && /턱: 소매산·소맷부리 모두 바깥쪽/.test(J(mOn.lines)) && T(mOn, "tuck-dir") === null && T(mOn, "tuck-back-outer") === "← 2.00" && T(mOn, "tuck-front-outer") === "2.00 →", "6: 소매산(턱 접음) · 박기 끝 · 소매산 박음 미지정 · 접힘 방향");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.filter(z => z.cls === "zone").length === 8, "6: 녹색 토글 끔");
  const before = J({ g: P.working.geometry, s: P.working.sleeveO, r: P.working.sleeveResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SOA.infoLines(P);
  ok(J({ g: P.working.geometry, s: P.working.sleeveO, r: P.working.sleeveResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·상태·완료본·hash 불변)");
  ok(rm && rm.line === "O-ref" && rm.refs.filter(r => /^ref-cut-/.test(r.id)).length === 4 && /가운데 띠 2\.50/.test(J(rm.lines)), "6: 비교 도안(Ⓞ — 평행 절개 4개)");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveO.js") > pos("sleeveNApply.js") && pos("sleeveOApply.js") > pos("designSleeveO.js") && pos("ui.js") > pos("sleeveOApply.js"), "7: 스크립트 순서");
  ok(((ver("designSleeveO.js") === "2026102802") && ver("sleeveOApply.js") === "2026102802") && (ver("sleevePresets.js") === "2026103001" && ver("render.js") === "2026102906" && ver("sleeveCheckpoint.js") === "2026102911" && ver("ui.js") === "2026102911") && ver("sleeveAnnotation.js") === "2026103001" && (["designSleeveN.js"].every(f => ver(f) === "2026102101") && ver("sleeveNApply.js") === "2026102802"), "7: 캐시 버전 " + VER + " · Ⓝ 파일은 그대로");
  ok(["inpSleeveOInner\" type=\"number\" min=\"0.1\" step=\"0.05\" value=\"1.25\"", "inpSleeveOSpacing\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"2.5\"", "inpSleeveOSpread\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"2\"", "inpSleeveOStitch\" type=\"number\" min=\"0.1\" step=\"0.1\" value=\"1.5\""].every(s => html.indexOf('id="' + s) > 0)
    && ["rowSleeveOInner", "rowSleeveOSpacing", "rowSleeveOSpread", "rowSleeveOStitch"].every(id => new RegExp('id="' + id + '" hidden').test(html)), "7: 입력칸 4 · 기본값 · 숨김 시작");
  ok(/function sleeveOOn\(project\)/.test(ui) && /function applySleeveO\(project\)/.test(ui) && /keep !== "O" && window\.sleeveOApply/.test(ui) && /if \(isO\) \{/.test(ui) && /window\.sleeveOApply\.rederive\(project\)/.test(ui) && /_sm\.line === "O"/.test(rn), "7: ui·render 배선");
  ok(/nRec\.id === "bunka-sleeve-N" && nRec\.inputs/.test(ui) && /nRec\.id === "bunka-sleeve-O" && nRec\.inputs/.test(ui), "7: Ⓝ·Ⓞ 입력칸은 자기 라인에서만(같은 키 stitchEndCm 공유)");
  const fn = ui.slice(ui.indexOf("function applySleeveO(project)"), ui.indexOf("// Ⓝ 입력칸"));
  ok(/attemptedInputs: raw/.test(fn) && fn.indexOf("Math.min") < 0 && fn.indexOf("Math.max") < 0 && /readPos\(f\[1\]\)/.test(fn) && /if \(at\) SLEEVE_O_FIELDS\.forEach/.test(ui), "7: 값을 깎지 않음 · 거부 입력 원문 보관·복원");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
