// ══════════════════════════════════════════════
// sleeveGUICheck.js — 소매 Ⓖ(P.43 하단) 연결 회귀: 카탈로그 · sleeveGApply · 표시 줄 · 완료본(턱 접은 길이 기준 이세) · 제작 정보 · 배선. 엔진은 designSleeveGCheck.
//   node test/harness/sleeveGUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SGA = W.sleeveGApply, SG = W.designSleeveG, SFA = W.sleeveFApply, SF = W.designSleeveF, SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

// ── 1. 카탈로그 ──
{
  const f = SP.family("tuck-sleeve");
  ok(f.variants.map(v => v.id).join() === "bunka-sleeve-F,bunka-sleeve-G" && f.variants[1].availability === "available" && f.variants[1].presetId === "bunka-sleeve-G", "1: 턱 소매 = Ⓕ + Ⓖ(실행)");
  const rec = SP.get("bunka-sleeve-G");
  ok(rec && rec.method === "tuck-cap-half-slash-from-sleeve-A" && rec.methodPage === 43 && rec.inputs.map(i => i.key).join() === "sleeveLengthCm,tuckCm,starCm" && rec.inputs[1].defaultValue === 1.5 && rec.inputs[2].defaultValue === 3 && Object.isFrozen(rec), "1: Ⓖ 레코드 · 입력 소매길이 + 턱(1.5) + ★(3)");
  ok(SP.resolve("tuck-sleeve", "bunka-sleeve-G").ok, "1: resolve Ⓖ");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SGA.apply(P, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }), S = P.working.sleeveG, g = P.working.geometry.sleeve;
  const e = SG.draftSleeveG(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), { tuckCm: 1.5, starCm: 3 });
  ok(r.ok && S.presetId === "bunka-sleeve-G" && J(S.parameters) === J({ sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line,half-line,star-lift," + [1, 2, 3, 4].map(() => "tuck-fold,tuck-place").join(","), "2: 표시 construction(중심선·2등분 선·★·턱 선, 안쪽 접힘 숨김)");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveF === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변 · 다른 라인/완료본 없음");
  const Q = projectWithBodice("A");
  const b1 = SGA.apply(Q, { sleeveLengthCm: 52, tuckCm: 2.5, starCm: 3 }), b2 = SGA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1, starCm: 3 });
  ok(!b1.ok && b1.reason === "invalid-tuck" && /2cm/.test(b1.text) && !b2.ok && b2.reason === "tuck-star-incompatible" && /기하/.test(b2.text), "2: 턱 2 초과 거부 · 성립 안 하는 조합 = 기하 가드 문구");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SGA.infoLines(P), m = P.working.sleeveG.meta, AH = bodice.armholeLengths, lens = SG.capLengthsOf(P.working.geometry.sleeve);
  ok(L.length === 10 && /^턱 소매 Ⓖ/.test(L[0]), "3: 표시 줄 10줄 " + L.length);
  const cl = P.working.geometry.sleeve.construction.find(c => c.role === "center-line"), cLen = cl.to.y - cl.from.y;
  ok(Math.abs(cLen - 55) < 1e-9 && L[2] === "고정 중심 O(중심선 × 위팔선) · 펼친 중심 길이 SP′→소맷부리 " + f2(cLen) + " cm = 입력 소매길이 52.00 + ★ 3.00 (길이 보정 안 함, 김님)", "3: 펼친 중심 길이(geometry 중심선 독립) 55 · 입력 52 구분: " + L[2]);
  ok(/^턱 분량 각 1\.50 × 4 \(실제 a 뒤 1\.50 · 앞 1\.50 · b 뒤 1\.50 · 앞 1\.50\) · ★ 3\.00 \(독립 입력\)$/.test(L[1]), "3: 턱·★: " + L[1]);
  ok(/^소매산 높이 13\.65 → 16\.65 cm/.test(L[3]), "3: 소매산 높이: " + L[3]);
  ok(/^진동밑 연장\(위팔선 따라 바깥 — 시안, 김님 확인 대기\) 뒤 0\.78 · 앞 0\.72 cm → 소매폭 32\.07 → 33\.57 · 옆선 뒤 38\.36 \/ 앞 38\.36 \(차 0\.00[0-9]\) · 연장 전 봉제 소매산 뒤 22\.38 · 앞 21\.09$/.test(L[4]), "3: 진동밑 연장 줄: " + L[4]);
  ok(L[5].indexOf("b 턱 단차(접을 때) 뒤 " + f2(m.sides.back.bLegs.stepCm) + " · 앞 " + f2(m.sides.front.bLegs.stepCm)) === 0, "3: b 단차 숫자 표시: " + L[5]);
  const ef = lens.sewn.front - AH.front, eb = lens.sewn.back - AH.back;
  ok(L[8].indexOf("소매산(턱 접음·봉제) 앞 " + f2(lens.sewn.front)) === 0 && L[9] === "이세(턱 접은 소매산 실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "3: 봉제 소매산·이세");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SGA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 });
  ok(SGA.reject(Q, { reason: "invalid-star", text: "x" }) && SGA.isBlocked(Q) && SC.check(Q).fails.indexOf("sleeve-g-blocked") >= 0, "4: 차단 중 완료 불가");
  ok(SGA.rederive(Q).ok && !SGA.isBlocked(Q) && Q.working.sleeveG.parameters.starCm === 3, "4: rederive(입력 유지)");
  SFA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1.5 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓕ·Ⓖ 동시 → 충돌(ui 가 배타 해제)");
  SGA.clear(Q); ok(!SGA.isActive(Q), "4: clear");
  PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-G", "5: 게이트 통과 " + J(c.fails));
  const r = SC.complete(P), R = r.result;
  ok(r.ok && R.origin.presetId === "bunka-sleeve-G" && R.origin.methodPage === 43 && J(R.inputs) === J({ sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }) && Object.isFrozen(R), "5: 완료본 origin·inputs·동결");
  const lens = SG.capLengthsOf(R.geometry), AH = bodice.armholeLengths;
  ok(Math.abs(R.cap.lengths.total - lens.sewn.total) < 1e-4 && Math.abs(R.cap.cutLengths.total - lens.cut.total) < 1e-4 && /턱을 접은/.test(R.cap.lengthBasis), "5: cap.lengths = 턱 접은 길이 · cutLengths = 재단선");
  ok(Math.abs(R.cap.ease.total - (lens.sewn.total - AH.front - AH.back)) < 1e-4, "5: cap.ease = 턱 접은 길이 − AH");
  ok(D(R.cap.splitPoint, P.working.sleeveG.meta.sp) < 1e-9, "5: 분할점 = SP′");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SGA.apply(P, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 2.5 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: ★ 변경 → 변경됨");
  const r2 = SC.complete(P); ok(r2.ok && r2.result.hash !== R.hash, "5: 재완료 새 hash");
  SGA.apply(P, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }); SC.complete(P);
  const Q = projectWithBodice("A"); SFA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1.5 }); ok(SC.complete(Q).ok, "5: Ⓕ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const m = SAN.buildModel(P), M = P.working.sleeveG.meta;
  ok(m && m.line === "G" && m.title === "소매 Ⓖ · 턱 소매(소매산 높이 2등분 위 a·b 절개, P.43)", "6: Ⓖ 모델");
  ok(T(m, "len") === "SP′→소맷부리 55.00 (입력 소매길이 52.00 + ★)" && m.dims.find(d => d.id === "len").to.y - m.dims.find(d => d.id === "len").from.y === 55, "6: 길이 치수선 = 펼친 중심 55(입력 52 와 구분)");
  ok(T(m, "star") === "★ 3.00" && ["back-a", "back-b", "front-a", "front-b"].every(k => T(m, "tuck-" + k) === k.slice(-1) + " 턱 " + f2(M.tuck.tucks[k].openedCm)), "6: ★·턱 라벨");
  ok(m.zones.filter(z => /^fill-/.test(z.id)).length === 2 && m.refs.filter(r => /^tuck-mark-/.test(r.id)).length === 8 && m.marks.filter(x => /^star-/.test(x.id)).length === 2, "6: 덧댐 음영 2 · 턱 사선 8 · ☆ 2");
  ok(T(m, "ext-back") === "진동밑 연장 " + f2(M.sides.back.underarmExtension.cm) + "(시안)" && m.refs.some(r => r.id === "ext-front"), "6: 진동밑 연장 표시");
  ok(T(m, "step-back") === "b 접을 때 단차 " + f2(Math.abs(M.sides.back.bLegs.stepCm)) + " → 재제도로 정리", "6: 단차 숫자 표시");
  const lens = SG.capLengthsOf(P.working.geometry.sleeve);
  ok(T(m, "cap-back-1") === "뒤 소매산(턱 접음) " + f2(lens.sewn.back), "6: 소매산 라벨 = 턱 접은 길이");
  ok(SAN.layout(m, 10).items.length > 0, "6: 배치");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f);
  ok(pos("designSleeveG.js") > pos("sleeveFApply.js") && pos("sleeveGApply.js") > pos("designSleeveG.js") && pos("ui.js") > pos("sleeveGApply.js"), "7: 스크립트 순서");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(["designSleeveG.js", "sleeveGApply.js", "sleevePresets.js", "sleeveCheckpoint.js", "sleeveAnnotation.js", "ui.js"].every(f => ver(f) === (f === "designSleeveG.js" ? "2026101102" : f === "sleeveGApply.js" ? "2026102802" : f === "sleeveAnnotation.js" ? "2026102906" : "2026102901")), "7: 캐시 버전(Ⓖ 2026101102/3 · 공용 2026101201/2)");
  ok(/id="rowSleeveStar" hidden/.test(html) && /id="inpSleeveStar" type="number" min="0.1" step="0.1" value="3"/.test(html) && !/id="inpSleeveStar"[^>]*max=/.test(html), "7: ★ 입력 행(기본 숨김, 기본 3, 책 규칙 같은 상한 없음)");
  ok(/function sleeveGOn\(project\)/.test(ui) && /keep !== "G" && window\.sleeveGApply/.test(ui) && /if \(isG\) \{/.test(ui) && /window\.sleeveGApply\.rederive\(project\)/.test(ui) && /"inpSleeveStar"/.test(ui), "7: ui 배선");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
