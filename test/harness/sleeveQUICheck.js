// ══════════════════════════════════════════════
// sleeveQUICheck.js — 소매 Ⓠ(P.48 하단 캡 슬리브, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveQApply · 표시 줄 · 완료본(구간 이세) · 제작 정보(출발 Ⓐ 윗부분·잘라내는 영역·최종선·달림 끝) · 비교 도안 · 배선.
//   node test/harness/sleeveQUICheck.js
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
  "designSleeveM.js", "sleeveMApply.js", "designSleeveN.js", "sleeveNApply.js", "designSleeveO.js", "sleeveOApply.js", "designSleeveP.js", "sleevePApply.js", "designSleeveQ.js", "sleeveQApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, DS = W.designSleeve,
  SQA = W.sleeveQApply, SQ = W.designSleeveQ, SPA = W.sleevePApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const IN = { heightRatio: 0.25 };
const VER = "2026102801";
// ── 1. 카탈로그 ──
{
  const f = SP.family("short-sleeve"), rec = SP.get("bunka-sleeve-Q");
  ok(f.variants.map(v => v.symbol).join("") === "LMNOPQ" && f.variants[5].availability === "available" && f.variants[5].presetId === "bunka-sleeve-Q" && f.variants[5].page === 48, "1: 반소매 = Ⓛ~Ⓠ 모두 실행");
  ok(rec && rec.methodPage === 48 && rec.inputs.map(i => i.key + "=" + i.defaultValue).join() === "heightRatio=0.25" && Object.isFrozen(rec), "1: Ⓠ 레코드 · 입력 = 높이 비율 하나(기장·호 길이 입력 없음)");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, AH = bodice.armholeLengths, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SQA.apply(P, IN), S = P.working.sleeveQ, g = P.working.geometry.sleeve;
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: SQA.SOURCE_A_LENGTH }), e = SQ.draftSleeveQ(a, IN);
  ok(r.ok && S.presetId === "bunka-sleeve-Q" && J(S.parameters) === J(IN) && J(g.outline) === J(e.geometry.outline) && g.capSplit.x === a.meta.sp.x && S.sourceSleeveAHash === e.sourceSleeveAHash, "2: 적용 — geometry = 엔진 · 출처 hash");
  ok(S.meta.attach && S.meta.attach.back.status === "ok" && S.meta.attach.front.status === "ok", "2: 몸판 달림 끝(뒤·앞) 자동 결정(표시용)");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const bad = SQA.apply(projectWithBodice("A"), { heightRatio: 0.8 });
  ok(!bad.ok && bad.reason === "height-ratio-out-of-range" && /1\/4 ~ 3\/4\(0\.25 ~ 0\.75, 양 끝 포함\)/.test(bad.text), "2: 범위 밖 0.8 → 사유(clamp 없음)");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SQA.infoLines(P), m = P.working.sleeveQ.meta;
  ok(L.length === 7 && /^캡 슬리브 Ⓠ \(화면 검토용 시안\)/.test(L[0]), "3: 표시 줄 7줄 · 시안");
  ok(/^높이 비율 0\.25\(기본 1\/4 · 허용 1\/4 ~ 3\/4\)/.test(L[1]) && /기장 입력 없음/.test(L[1]), "3: 비율·범위 · 기장 입력 없음");
  ok(L[2] === "결과 중심 길이 SP → 소맷부리 = H × (1 − r) " + f2(m.centerLength.spreadCm) + " cm · 직선 소맷부리 " + f2(m.hem.lengthCm) + " cm(수평)", "3: 중심 길이 · 소맷부리");
  ok(/구간 이세\(남은 소매산 − 남은 AH\) 뒤 [+-]\d+\.\d\d · 앞 [+-]\d+\.\d\d cm \(전체 AH/.test(L[4]), "3: 구간 이세(전체 AH 와 구분)");
  ok(/몸판 달림 끝.*뒤 표시 · 앞 표시/.test(L[5]) && /의미 미확정, 형상 계산에 쓰지 않음/.test(L[6]), "3: 달림 끝 · 중심 기호 미확정");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SQA.apply(Q, IN);
  ok(SQA.reject(Q, { reason: "height-ratio-out-of-range", text: "x", attemptedInputs: { heightRatio: "0.9" } }) && SC.check(Q).fails.indexOf("sleeve-q-blocked") >= 0 && J(Q.working.sleeveQ.blocked.attemptedInputs) === J({ heightRatio: "0.9" }) && J(Q.working.sleeveQ.parameters) === J(IN), "4: 차단 — 원문 보관 · 적용값 그대로");
  ok(SQA.infoLines(Q).length === 2 && SAN.buildModel(Q) === null && SAN.bodiceMarks(Q) === null && SQA.rederive(Q).ok && !SQA.isBlocked(Q), "4: 차단 표시 · 달림 끝 표시 없음 · 재제도로 해제");
  SPA.apply(Q, { sleeveLengthCm: 20, flareRatio: 0.7 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓟ·Ⓠ 동시 → 충돌(ui 배타)"); PROJECT = P;
}
// ── 5. 완료본 ──
{
  const c = SC.check(P), m = P.working.sleeveQ.meta;
  ok(c.ok && c.preset === "bunka-sleeve-Q" && Math.abs(c.ease.back - m.easeAfter.back) < 2e-3 && Math.abs(c.ease.front - m.easeAfter.front) < 2e-3, "5: 게이트 · 이세 = 구간 이세(남은 AH 기준) " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && R.origin.presetId === "bunka-sleeve-Q" && R.origin.methodPage === 48 && J(R.inputs) === J(IN) && Object.isFrozen(R) && J(R.geometry) === J(P.working.geometry.sleeve), "5: 완료본 동결 복사");
  const h0 = R.hash;
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SQA.apply(P, { heightRatio: 0.5 }); ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "5: 비율 변경 → 변경됨(완료본 그대로)");
  SQA.apply(P, IN); ok(SC.isCurrentSleeveChanged(P) === false && P.working.sleeveResult.hash === h0, "5: 같은 입력 재적용 → hash 불변"); SC.complete(P);
  const QG = projectWithBodice("G"); ok(SQA.apply(QG, { heightRatio: 0.75 }).ok && SC.check(QG).ok && SC.complete(QG).ok, "5: 몸판 Ⓖ 에서 비율 0.75 적용·완료");
  PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveQ.meta;
  ok(mOn && mOn.line === "Q" && /화면 검토용 시안/.test(mOn.title), "6: Ⓠ 모델");
  ok(J(mOn.zones.map(z => z.id + ":" + z.cls)) === J(["keep:keep", "cut-away:cut"]), "6: 녹색 = 남기는 Ⓠ · 회색 사선 = 잘라내는 부분(별도 폴리곤 · 원래 Ⓐ 윗부분 전체 녹색 없음)");
  { const kp = mOn.zones[0].pts, cz = mOn.zones[1].pts, capQ = P.working.geometry.sleeve.outline[0], c0 = capQ.commands[0].points[0], cN = capQ.commands[capQ.commands.length - 1].points[2];
    ok(D(kp[0], c0) < 1e-12 && D(kp[kp.length - 1], cN) < 1e-12 && kp.every(p => p.y <= M.hemY + 1e-9) && cz.every(p => p.y >= M.hemY - 1e-9), "6: 남기는 영역 = 최종 소매산 + 소맷부리(최종 geometry) · 잘라내는 영역과 겹치지 않음(소맷부리선에서 나뉨)"); }
  ok(/녹색 = 남기는 Ⓠ\(소매산 \+ 새 소맷부리 안쪽\)/.test(J(mOn.lines)) && /회색 사선 = 잘라내는 부분/.test(J(mOn.lines)) && /남색 실선 = 최종 재단선/.test(J(mOn.lines)) && T(mOn, "cut-label") === "잘라냄", "6: 범례 정정 · «잘라냄» 라벨");
  ok(/^H × 0\.25 = /.test(T(mOn, "ratio")) && /^소맷부리\(직선\) /.test(T(mOn, "hem-q")) && /^뒤 끝 · ● /.test(T(mOn, "end-back")) && /^앞 끝 · ∅ /.test(T(mOn, "end-front")), "6: 비율 높이 · 소맷부리 · 앞뒤 끝 표시");
  ok(/^남은 AH /.test(T(mOn, "cap-back-2")) && / · 이세 /.test(T(mOn, "cap-back-2")) && /남은 AH 총/.test(J(mOn.lines)) && /구간 이세\(실측\)/.test(J(mOn.lines)), "6: 이세 = 남은 AH 기준 표기");
  const bm = SAN.bodiceMarks(P);
  ok(bm && bm.back && bm.front && /^소매 달림 끝 · ● /.test(bm.back.text) && D(bm.back.at, M.attach.back.point) < 1e-12, "6: 몸판 달림 끝 표시 모델");
  ok(!mOff.zones.some(z => z.cls === "keep" || z.cls === "paper") && J(mOff.zones.map(z => z.cls)) === J(["cut"]), "6: 녹색 토글 끔 = 남기는 녹색만 꺼짐(잘라내는 표시는 정보 토글 소관)");
  const before = J({ g: P.working.geometry, s: P.working.sleeveQ, r: P.working.sleeveResult, b: P.working.bodiceResult }), hb = P.working.sleeveResult.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); const rm = SAN.refModel(P, 10); SQA.infoLines(P); SAN.bodiceMarks(P);
  ok(J({ g: P.working.geometry, s: P.working.sleeveQ, r: P.working.sleeveResult, b: P.working.bodiceResult }) === before && P.working.sleeveResult.hash === hb && SC.isCurrentSleeveChanged(P) === false, "6: 표시 on/off = 표시 전용(geometry·몸판·완료본·hash 불변)");
  ok(rm && rm.line === "Q-ref" && rm.refs.some(r => r.id === "ref-ratio") && /H × 비율/.test(J(rm.lines)), "6: 비교 도안(Ⓠ — 비율 수평선)");
  const PA = projectWithBodice("A"); SQA.apply(PA, { heightRatio: 0.5 }); const bm5 = SAN.bodiceMarks(PA);
  ok(bm5 && bm5.back && bm5.front && D(bm5.front.at, PA.working.sleeveQ.meta.attach.front.point) < 1e-12 && /앞 표시\(다트를 닫은 봉제 진동 기준 — 위쪽 조각 위\)/.test(SQA.infoLines(PA)[5]), "6: 박시 A · 0.5 — 앞 달림 끝 = 다트 닫은 봉제 진동 기준 위쪽 조각 위 표시"); PROJECT = P;
}
// ── 6b. 완료 회귀 22종 × 비율 7 — 적용·게이트·완료·몸판 달림 끝 표시(2026-10-27: 원형 등가 복원 Ⓗ·Ⓜ·Ⓝ 포함) ──
{
  const bad = []; let n = 0;
  for (const sym of "ABCDEFGHIJKLMNOPQRSTUV".split("")) for (const rr of [0.25, 0.3, 0.4, 0.5, 0.6, 0.65, 0.75]) {
    const X = projectWithBodice(sym); if (!X) { bad.push(sym + ":bodice"); continue; }
    const b0 = J(X.working.bodiceResult), r = SQA.apply(X, { heightRatio: rr }), c = SC.check(X), d = c.ok ? SC.complete(X) : null, bm = SAN.bodiceMarks(X);
    const at = X.working.sleeveQ && X.working.sleeveQ.meta.attach;
    const good = r.ok && c.ok && d && d.ok && Object.isFrozen(X.working.sleeveResult) && at && at.back.status === "ok" && at.front.status === "ok" && bm && bm.back && bm.front
      && D(bm.front.at, at.front.point) < 1e-12 && D(bm.back.at, at.back.point) < 1e-12 && J(X.working.bodiceResult) === b0;
    if (good) n++; else bad.push(sym + rr + ":" + (r.reason || (c.fails || []).join("/") || "display"));
  }
  ok(n === 22 * 7 && bad.length === 0, "6b: 22종 × 7비율 = " + n + " 적용·게이트·완료 · 몸판 달림 끝 앞·뒤 표시 · 몸판 불변 " + J(bad).slice(0, 200));
}

// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8"), rn = fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f), ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(pos("designSleeveQ.js") > pos("sleevePApply.js") && pos("sleeveQApply.js") > pos("designSleeveQ.js") && pos("ui.js") > pos("sleeveQApply.js"), "7: 스크립트 순서");
  ok((ver("designSleeveQ.js") === "2026102802" && ver("sleeveQApply.js") === "2026102802") && (ver("sleevePresets.js") === "2026103001" && ver("render.js") === "2026102906" && ver("sleeveCheckpoint.js") === "2026102911" && ver("ui.js") === "2026102911") && ver("sleeveAnnotation.js") === "2026103001" && (["designSleeveP.js"].every(f => ver(f) === "2026102602") && ver("sleevePApply.js") === "2026102802"), "7: 캐시 버전 " + VER + " · Ⓟ 파일은 그대로");
  ok(/id="rowSleeveQRatio" hidden/.test(html) && /id="inpSleeveQRatio" type="number" min="0\.25" max="0\.75" step="0\.05" value="0\.25"/.test(html) && /기본 1\/4 · 1\/4 ~ 3\/4/.test(html), "7: 비율 입력칸 · 기본 0.25 · 범위 표시 · 숨김 시작");
  ok(/function sleeveQOn\(project\)/.test(ui) && /function applySleeveQ\(project\)/.test(ui) && /keep !== "Q" && window\.sleeveQApply/.test(ui) && /if \(isQ\) \{/.test(ui) && /window\.sleeveQApply\.rederive\(project\)/.test(ui) && /_sm\.line === "Q"/.test(rn) && /bodiceMarks/.test(rn), "7: ui·render 배선(몸판 달림 끝 포함)");
  const fn = ui.slice(ui.indexOf("function applySleeveQ(project)"), ui.indexOf("// Ⓟ 입력칸"));
  ok(/attemptedInputs: raw/.test(fn) && fn.indexOf("Math.min") < 0 && fn.indexOf("Math.max") < 0 && fn.indexOf("inpSleeveLength") < 0 && /lenEl\.disabled = sleeveQOn\(project\)/.test(ui), "7: 값을 깎지 않음 · 기장 칸을 읽지 않고 Ⓠ 에서는 잠금");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
