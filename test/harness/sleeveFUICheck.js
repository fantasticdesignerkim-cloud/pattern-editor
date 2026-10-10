// ══════════════════════════════════════════════
// sleeveFUICheck.js — 소매 Ⓕ(P.43 턱 소매) 연결 회귀: 카탈로그 · sleeveFApply · 표시 줄 · 완료본(턱 접은 길이 기준 이세) · 제작 정보 · 배선. 엔진은 designSleeveFCheck.
//   node test/harness/sleeveFUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SFA = W.sleeveFApply, SF = W.designSleeveF, SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

// ── 1. 카탈로그 ──
{
  const f = SP.family("tuck-sleeve");
  ok(f && f.availability === "available" && f.order === 4 && f.variants.map(v => v.id).join() === "bunka-sleeve-F" && f.variants[0].presetId === "bunka-sleeve-F", "1: 턱 소매 = Ⓕ(실행) — Ⓖ 슬롯 없음(범위 밖)");
  const rec = SP.get("bunka-sleeve-F");
  ok(rec && rec.method === "tuck-parallel-slash-from-sleeve-A" && rec.methodPage === 43 && rec.inputs.map(i => i.key).join() === "sleeveLengthCm,tuckCm" && rec.inputs[1].defaultValue === 1.5 && Object.isFrozen(rec), "1: Ⓕ 레코드 · 입력 소매길이 + 턱 분량(기본 1.5)");
  ok(SP.resolve("tuck-sleeve", "bunka-sleeve-F").ok && SP.family("puff-sleeve").availability !== "available", "1: resolve Ⓕ · 다음 라인은 계속 보류");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SFA.apply(P, { sleeveLengthCm: 52, tuckCm: 1.5 }), S = P.working.sleeveF, g = P.working.geometry.sleeve;
  const e = SF.draftSleeveF(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), { tuckCm: 1.5 });
  ok(r.ok && S.presetId === "bunka-sleeve-F" && J(S.parameters) === J({ sleeveLengthCm: 52, tuckCm: 1.5 }) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line," + [1, 2, 3, 4].map(() => "tuck-fold,tuck-place").join(","), "2: 표시 construction(중심선·접는 선/맞출 선 4쌍, 안쪽 접힘 숨김)");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveE === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변 · 다른 라인/완료본 없음");
  const bad = SFA.apply(projectWithBodice("A"), { sleeveLengthCm: 52, tuckCm: 3.5 });
  ok(!bad.ok && bad.reason === "invalid-tuck" && /3cm/.test(bad.text), "2: 턱 3cm 초과 거부(사유 문구)");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SFA.infoLines(P), m = P.working.sleeveF.meta, AH = bodice.armholeLengths, lens = SF.capLengthsOf(P.working.geometry.sleeve);
  ok(L.length === 8 && /^턱 소매 Ⓕ/.test(L[0]), "3: 표시 줄 8줄 " + L.length);
  ok(/^턱 분량 각 1\.50 × 4 = 6\.00 cm \(실제 뒤 바깥 1\.50 · 뒤 안 1\.50 · 앞 안 1\.50 · 앞 바깥 1\.50\)$/.test(L[1]), "3: 턱 분량·실제: " + L[1]);
  ok(/바깥쪽으로 접음 · 소매 중심 쪽 천이 위 · 박기 끝 미확정/.test(L[2]), "3: 턱 방향(김님)·박기 끝 미확정");
  ok(/^소매폭 32\.07 → 36\.48 cm · 소매산 높이 그대로/.test(L[3]), "3: 소매폭: " + L[3]);
  ok(L[4] === "소맷부리(자연 곡선, 기준점·양 끝 그대로) " + f2(m.hemCm) + " cm · Ⓐ 32.07 · 차 +" + m.hem.diffFromSleeveACm.toFixed(4) + " cm" && /\+0\.000[0-9]/.test(L[4]), "3: 소맷부리 곡선·Ⓐ 와 차 표시: " + L[4]);
  const ef = lens.sewn.front - AH.front, eb = lens.sewn.back - AH.back;
  ok(L[6].indexOf("소매산(턱 접음·봉제) 앞 " + f2(lens.sewn.front)) === 0 && L[6].indexOf("재단선(펼침) 총 " + f2(lens.cut.total)) > 0, "3: 봉제·재단 소매산 구분: " + L[6]);
  ok(L[7] === "이세(턱 접은 소매산 실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "3: 이세 = 턱 접은 길이 − AH");
  const Q = projectWithBodice("A"); SFA.apply(Q, { sleeveLengthCm: 52, tuckCm: 2.5 });
  ok(SFA.infoLines(Q).some(t => /안쪽 두 턱의 접힌 천이/.test(t)), "3: 2cm 초과 경고 줄"); PROJECT = P;
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SFA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1.5 });
  ok(SFA.reject(Q, { reason: "invalid-tuck", text: "x" }) && SFA.isBlocked(Q) && !SC.check(Q).ok && SC.check(Q).fails.indexOf("sleeve-f-blocked") >= 0, "4: 차단 중 완료 불가");
  ok(SFA.rederive(Q).ok && !SFA.isBlocked(Q) && Q.working.sleeveF.parameters.tuckCm === 1.5, "4: rederive(턱 분량 유지)");
  SEA.apply(Q, { sleeveLengthCm: 52 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓔ·Ⓕ 동시 → 충돌(ui 가 배타 해제)");
  SFA.clear(Q); ok(!SFA.isActive(Q), "4: clear");
  PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-F", "5: 게이트 통과 " + J(c.fails));
  const r = SC.complete(P), R = r.result;
  ok(r.ok && R.origin.presetId === "bunka-sleeve-F" && R.origin.methodPage === 43 && J(R.inputs) === J({ sleeveLengthCm: 52, tuckCm: 1.5 }) && Object.isFrozen(R), "5: 완료본 origin·inputs·동결");
  const lens = SF.capLengthsOf(R.geometry), AH = bodice.armholeLengths;
  ok(Math.abs(R.cap.lengths.total - lens.sewn.total) < 1e-4 && Math.abs(R.cap.cutLengths.total - lens.cut.total) < 1e-4 && /턱을 접은/.test(R.cap.lengthBasis), "5: cap.lengths = 턱 접은 길이 · cutLengths = 재단선");
  ok(Math.abs(R.cap.ease.front - (lens.sewn.front - AH.front)) < 1e-4 && Math.abs(R.cap.ease.back - (lens.sewn.back - AH.back)) < 1e-4, "5: cap.ease = 턱 접은 길이 − AH(완료본 geometry 실측)");
  const prim = DS.capPrimitives(R.geometry);
  ok(!prim || Math.abs(prim.lengths.total - R.cap.lengths.total) > 1, "5: 일반 capPrimitives(재단선 전체)와 구분됨");
  ok(D(R.cap.splitPoint, P.working.sleeveF.meta.sp) < 1e-9, "5: 분할점 = SP");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SFA.apply(P, { sleeveLengthCm: 52, tuckCm: 2 }); ok(SC.isCurrentSleeveChanged(P) === true, "5: 턱 분량 변경 → 변경됨");
  const r2 = SC.complete(P); ok(r2.ok && r2.result.hash !== R.hash, "5: 재완료 새 hash");
  SFA.apply(P, { sleeveLengthCm: 52, tuckCm: 1.5 }); SC.complete(P);
  // Ⓐ~Ⓔ 완료본 경로는 그대로(Ⓔ 완료 가능)
  const Q = projectWithBodice("A"); SEA.apply(Q, { sleeveLengthCm: 52 }); ok(SC.complete(Q).ok, "5: Ⓔ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const m = SAN.buildModel(P), M = P.working.sleeveF.meta;
  ok(m && m.line === "F" && m.title === "소매 Ⓕ · 턱 소매(평행 절개 4개 · 소맷부리 기준점, P.43)", "6: Ⓕ 모델");
  ok(["back-outer", "back-inner", "front-inner", "front-outer"].every(k => T(m, "tuck-" + k) === "턱 " + f2(M.tuck.tucks[k].openedCm)), "6: 턱 라벨 = 실제 벌림");
  ok(m.zones.filter(z => /^tuck-/.test(z.id)).length === 4 && m.refs.filter(r => /^tuck-mark-/.test(r.id)).length === 8 && m.marks.filter(x => /^pivot-/.test(x.id)).length === 4, "6: 턱 음영 4 · 턱 표시 사선 8 · 기준점 4");
  // 사선: 접는 선(중심 쪽) 끝이 높다(y 작음)
  ok(m.refs.filter(r => /^tuck-mark-/.test(r.id)).every(r => r.from.y < r.to.y), "6: 사선 높은 쪽 = 중심 쪽(위층)");
  const lens = SF.capLengthsOf(P.working.geometry.sleeve);
  ok(T(m, "cap-back-1") === "뒤 소매산(턱 접음) " + f2(lens.sewn.back) && T(m, "cap-front-1") === "앞 소매산(턱 접음) " + f2(lens.sewn.front), "6: 소매산 라벨 = 턱 접은 길이");
  ok(!/stitchEnd|provisional|박기 끝 [0-9]/.test(J(m.lines)), "6: 박기 끝 수치·감사 값 미표시");
  ok(T(m, "hem") === "소맷부리(곡선) " + f2(M.hemCm) + " · Ⓐ 대비 +" + M.hem.diffFromSleeveACm.toFixed(4), "6: 소맷부리 치수 = 곡선 실측·Ⓐ 대비");
  ok(SAN.layout(m, 10).items.length > 0, "6: 배치");
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f);
  ok(pos("designSleeveF.js") > pos("sleeveEApply.js") && pos("sleeveFApply.js") > pos("designSleeveF.js") && pos("ui.js") > pos("sleeveFApply.js") && pos("sleeveCheckpoint.js") > 0, "7: 스크립트 순서");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(["designSleeveF.js", "sleeveFApply.js", "sleeveAnnotation.js"].every(f => ver(f) === "2026101003") && ["sleevePresets.js", "sleeveCheckpoint.js", "ui.js"].every(f => ver(f) === "2026101002"), "7: 캐시 버전(소맷부리 곡선 2026101003 · Ⓕ 연결 2026101002)");
  ok(/id="rowSleeveTuck" hidden/.test(html) && /id="inpSleeveTuck" type="number" min="0.1" max="3" step="0.1" value="1.5"/.test(html), "7: 턱 분량 입력 행(기본 숨김, 0.1–3, 기본 1.5)");
  ok(/function sleeveFOn\(project\)/.test(ui) && /keep !== "F" && window\.sleeveFApply/.test(ui) && /if \(isF\) \{/.test(ui) && /window\.sleeveFApply\.rederive\(project\)/.test(ui) && /"inpSleeveTuck"\]\.forEach/.test(ui), "7: ui 배선");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
