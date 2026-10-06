// ══════════════════════════════════════════════
// sleeveAUICheck.js — 소매 Ⓐ UI/프리셋 연결(js/sleevePresets.js · js/sleeveAApply.js · ui.js/index.html 배선) 전용 회귀.
//
//   (1) 카탈로그: 소매 10종류 슬롯(P.36–37), 실행 가능 = 스트레이트 Ⓐ(`bunka-sleeve-A`) 하나. 보류 슬롯은 blockedBy 를 들고 있고
//       resolve 가 명시적으로 거부(Ⓐ·기본 소매로 폴백 없음). 레코드·목록 동결, 몸판 id(`bunka-bodice-*`)와 네임스페이스 분리.
//   (2) 적용: 완성 bodiceResult 를 읽기만 한다 — bodiceResult/hash/sourceBlock/referenceGeometry/sleeveDraft/sleeveResult 불변.
//       geometry.sleeve 는 draftSleeveA 결과와 같고, 같은 입력 → 같은 결과.
//   (3) 차단: 몸판 없음·지원 밖 몸판(Ⓖ·Ⓗ·Ⓜ·Ⓝ)·잘못된 소매길이 → 정확한 사유 문구, 이전 상태 그대로(폴백 없음).
//   (4) 재제도(refreshSleeve 훅): 새 몸판 hash 로 갱신 / 지원 밖 몸판이면 blocked 만 표시하고 geometry 는 건드리지 않음 / Ⓐ 꺼짐이면 무동작.
//   (5) 표시: 패턴명·소매산 높이·소매폭·앞뒤 AH·목표/실제 이세 줄.
//   (6) 완료 연결: Ⓐ 도 sleeveCheckpoint 로 완료된다(sleeve-preset-not-linked 차단 제거 — 완료본 상세는 sleeveAResultCheck).
//   (7) 배선: index.html 스크립트 순서·캐시 버전·DOM id, ui.js 가 기존 소매 경로 함수를 보존하고 Ⓐ 분기를 갖는다.
//   node test/harness/sleeveAUICheck.js
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
  document: { createElementNS: (ns, tag) => ({ tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); } }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "sleevePresets.js", "sleeveAApply.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SP = W.sleevePresets, SAA = W.sleeveAApply, SC = W.sleeveCheckpoint;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
function throwsReason(fn, reason, n) { try { fn(); ok(false, n + " (throw 안 함)"); } catch (e) { ok(e && e.reason === reason, n + " (reason=" + (e && e.reason) + ")"); } }

// ── 1. 카탈로그 ──
{
  const fams = SP.families();
  ok(fams.length === 10 && fams.map(f => f.page).join() === "40,41,42,43,44,46,49,50,52,54", "1: 소매 10종류 · 시작 쪽 = P036 판독표");
  ok(fams.map(f => f.symbol).join("") === "ABDFHLRTVX", "1: 표지 대표 기호 = P036 판독표");
  ok(Object.isFrozen(SP) && Object.isFrozen(fams) && Object.isFrozen(fams[0]) && Object.isFrozen(SP.get("bunka-sleeve-A")), "1: 레지스트리·레코드 동결");
  const avail = fams.filter(f => f.availability === "available");
  ok(avail.length === 2 && avail[0].id === "straight-sleeve" && avail[0].variants.length === 1 && avail[0].variants[0].presetId === "bunka-sleeve-A", "1: 실행 가능 = 스트레이트 Ⓐ + 타이트 Ⓑ(Ⓑ 는 sleeveBUICheck 가 전담)");
  ok(SP.get("bunka-sleeve-A").method === "bodice-armhole" && SP.get("bunka-sleeve-A").methodPage === 137 && SP.get("bunka-sleeve-A").inputs.length === 1 && SP.get("bunka-sleeve-A").inputs[0].key === "sleeveLengthCm", "1: 레코드 = 제도 방식·P.137·입력은 소매길이 하나(교재 수치 없음)");
  ok(SP.get("bunka-bodice-A") === null && BP.get("bunka-sleeve-A") === null, "1: 소매/몸판 id 네임스페이스 분리");
  fams.filter(f => f.availability !== "available").forEach(f => {
    ok(f.variants.every(v => v.presetId === null && typeof v.blockedBy === "string" && v.blockedBy.length > 10), "1: 보류 슬롯은 blockedBy 를 든다 · " + f.id);
    ok(SP.resolve(f.id, f.variants[0].id).reason === "sleeve-preset-unavailable", "1: 보류 슬롯 resolve 거부(폴백 없음) · " + f.id);
  });
  ok(SP.resolve("straight-sleeve", "bunka-sleeve-A").ok && SP.resolve("straight-sleeve", "bunka-sleeve-A").presetId === "bunka-sleeve-A", "1: Ⓐ resolve");
  ok(SP.resolve("nope", "x").reason === "unknown-sleeve-family" && SP.resolve("straight-sleeve", "x").reason === "unknown-sleeve-variant", "1: 모르는 라인/세부 거부");
  const t = SP.displayTitle("straight-sleeve", "bunka-sleeve-A");
  ok(t.symbol === "A" && t.page === 40 && t.familyLabel === "스트레이트 소매", "1: displayTitle");
  ok(SP.familyOptions()[0].available === true && SP.familyOptions()[1].available === true && SP.familyOptions().slice(2).every(o => !o.available), "1: familyOptions available 플래그");
  throwsReason(() => SP.validateRecord({ id: "x", familyId: "f", symbol: "A", method: "m", methodPage: 0, inputs: [] }), "invalid-page", "1: 레코드 검증 — 쪽");
  throwsReason(() => SP.validateRecord({ id: "x", familyId: "f", symbol: "A", method: "m", methodPage: 1, inputs: [{ key: 1 }] }), "invalid-inputs", "1: 레코드 검증 — 입력");
}

// ── 2. 적용(읽기 전용·불변) ──
const P = projectWithBodice("A");
ok(P && P.working.bodiceResult, "2: 실제 bodiceCheckpoint.complete 로 bodiceResult 생성");
const bodice = P.working.bodiceResult;
const snap = { bodice: J(bodice), hash: bodice.hash, src: J(P.sourceBlock), ref: J(P.referenceGeometry), body: J(P.working.parameters), refSleeve: J(P.referenceGeometry.sleeve), geom0: J(P.working.geometry.sleeve) };
ok(Object.isFrozen(bodice), "2: bodiceResult 는 동결 객체");
{
  const d = SA.draftSleeveA(bodice, { sleeveLengthCm: 52 });
  const r = SAA.apply(P, { sleeveLengthCm: 52 });
  ok(r.ok && P.working.sleeveA && P.working.sleeveA.presetId === "bunka-sleeve-A", "2: 적용 성공 · working.sleeveA.presetId");
  ok(J(P.working.geometry.sleeve) === J(d.geometry), "2: working.geometry.sleeve = draftSleeveA 결과(render 미러)");
  ok(P.working.sleeveA.sourceBodiceHash === bodice.hash && P.working.sleeveA.parameters.sleeveLengthCm === 52, "2: 출처 hash·소매길이 기록");
  ok(J(bodice) === snap.bodice && bodice.hash === snap.hash && Object.isFrozen(bodice), "2: bodiceResult·hash 불변(적용 후)");
  ok(J(P.sourceBlock) === snap.src && J(P.referenceGeometry) === snap.ref && J(P.working.parameters) === snap.body, "2: sourceBlock·referenceGeometry·몸판 파라미터 불변");
  ok(P.working.sleeveDraft === undefined && P.working.sleeveResult === undefined, "2: 기존 소매 파생(sleeveDraft)·완료본(sleeveResult) 미생성");
  ok(P.working.geometry.sleeve !== d.geometry && P.working.sleeveA.meta !== d.meta, "2: 엔진 반환 객체를 그대로 공유하지 않는다(복사)");
  ok(J(P.referenceGeometry.sleeve) === snap.refSleeve, "2: 원형 소매(referenceGeometry.sleeve) 불변");
  const r2 = SAA.apply(P, { sleeveLengthCm: 52 });
  ok(r2.ok && J(P.working.geometry.sleeve) === J(d.geometry), "2: 결정론(같은 입력 → 같은 결과)");
  const r3 = SAA.apply(P, { sleeveLengthCm: 58 });
  const g3 = P.working.geometry.sleeve, hemY3 = Math.max.apply(null, g3.outline.filter(s => s.kind === "line").map(s => Math.max(s.from.y, s.to.y)));
  ok(r3.ok && near(hemY3, 58) && P.working.sleeveA.parameters.sleeveLengthCm === 58, "2: 소매길이 변경 재적용 → 소매부리 y = 58");
  ok(near(P.working.sleeveA.meta.capLengths.total, d.meta.capLengths.total, 1e-9), "2: 소매길이는 소매산을 바꾸지 않는다");
  ok(J(bodice) === snap.bodice, "2: 재적용 후에도 bodiceResult 불변");
}

// ── 3. 차단: 몸판 없음 · 지원 밖 · 잘못된 입력 → 사유 + 이전 상태 유지(폴백 없음) ──
{
  const Q = MK(BP.bodyParams(presetOf("A")));       // bodiceResult 없음
  const g0 = J(Q.working.geometry.sleeve);
  const r = SAA.apply(Q, { sleeveLengthCm: 52 });
  ok(!r.ok && r.reason === "no-bodice" && r.text === "몸판을 먼저 완료해야 합니다", "3: 몸판 미완료 → no-bodice 문구");
  ok(Q.working.sleeveA === undefined && J(Q.working.geometry.sleeve) === g0, "3: 몸판 미완료 → 상태·형상 불변");
  ok(!SAA.apply(null, { sleeveLengthCm: 52 }).ok && SAA.apply(null, { sleeveLengthCm: 52 }).reason === "no-project", "3: 프로젝트 없음");

  ["G", "H", "M", "N"].forEach(sym => {
    const U = projectWithBodice(sym), g1 = J(U.working.geometry.sleeve);
    const x = SAA.apply(U, { sleeveLengthCm: 52 });
    ok(!x.ok && x.reason === "armhole-underarm-mismatch", "3: 몸판 " + sym + " → armhole-underarm-mismatch");
    ok(/^앞·뒤 진동 아랫점 높이가 달라 지원하지 않는 몸판/.test(x.text) && /앞 \d+\.\d\d \/ 뒤 \d+\.\d\d$/.test(x.text), "3: 몸판 " + sym + " → 정확한 사유 문구(앞/뒤 아랫점 y 포함): " + x.text);
    ok(U.working.sleeveA === undefined && J(U.working.geometry.sleeve) === g1 && U.working.sleeveDraft === undefined, "3: 몸판 " + sym + " → 추측 폴백 없음(상태·형상 불변)");
  });
  [[5, "invalid-sleeve-length"], [0, "invalid-sleeve-length"], [NaN, "invalid-sleeve-length"], [undefined, "invalid-sleeve-length"]].forEach(([len, reason]) => {
    const R = projectWithBodice("A"), g = J(R.working.geometry.sleeve);
    const x = SAA.apply(R, { sleeveLengthCm: len });
    ok(!x.ok && x.reason === reason && R.working.sleeveA === undefined && J(R.working.geometry.sleeve) === g, "3: 소매길이 " + len + " → " + reason + " · 불변");
  });
  // 이미 Ⓐ 가 켜져 있을 때 잘못된 입력 → 이전 Ⓐ 그대로
  const S = projectWithBodice("A"); SAA.apply(S, { sleeveLengthCm: 52 });
  const keep = J(S.working.geometry.sleeve), keepSA = J(S.working.sleeveA);
  const bad = SAA.apply(S, { sleeveLengthCm: 3 });
  ok(!bad.ok && J(S.working.geometry.sleeve) === keep && J(S.working.sleeveA) === keepSA, "3: Ⓐ 켜진 상태에서 실패 → 이전 Ⓐ 유지");
  ok(SAA.failText({ reason: "shoulder-dart-unclosable", piece: "back", detail: 0.41 }) === "뒤판: 어깨 다트를 닫아도 입구가 맞지 않음 · 0.41", "3: 사유 문구(조각·수치)");
  ok(SAA.failText({ reason: "something-new" }).indexOf("something-new") >= 0, "3: 모르는 사유도 코드를 그대로 보인다(삼키지 않음)");
}

// ── 4. 재제도 훅(refreshSleeve) ──
{
  const Q = projectWithBodice("A");
  ok(SAA.rederive(Q).active === false && Q.working.sleeveA === undefined, "4: Ⓐ 꺼짐이면 무동작");
  SAA.apply(Q, { sleeveLengthCm: 52 });
  const ref = J(Q.working.geometry.sleeve);
  // body apply 가 소매를 원형 clone 으로 덮은 상황 재현
  Q.working.geometry.sleeve = JSON.parse(J(Q.referenceGeometry.sleeve));
  const r = SAA.rederive(Q);
  ok(r.ok && r.active && J(Q.working.geometry.sleeve) === ref, "4: body apply 가 덮은 소매를 Ⓐ 로 되돌린다(같은 몸판 → 같은 형상)");
  // 몸판을 다시 완료(다른 몸판 Ⓘ) → hash 가 바뀌면 새 hash 로 재제도
  const oldHash = Q.working.sleeveA.sourceBodiceHash;
  Q.working.parameters = { neckline: Q.working.parameters.neckline, body: BP.bodyParams(presetOf("I")) };
  Q.working.geometry = DB.computeGeometry(Q.referenceGeometry, { body: BP.bodyParams(presetOf("I")) });
  const c = BC.complete(Q);
  ok(c.ok && Q.working.bodiceResult.hash !== oldHash, "4: 다른 몸판으로 재완료 → hash 변경");
  const r2 = SAA.rederive(Q);
  ok(r2.ok && Q.working.sleeveA.sourceBodiceHash === Q.working.bodiceResult.hash && Q.working.sleeveA.blocked === null, "4: 새 몸판 hash 로 재제도(출처 갱신)");
  // 지원 밖 몸판으로 재완료 → blocked 표시, geometry 불변
  Q.working.parameters = { neckline: Q.working.parameters.neckline, body: BP.bodyParams(presetOf("G")) };
  Q.working.geometry = DB.computeGeometry(Q.referenceGeometry, { body: BP.bodyParams(presetOf("G")) });
  ok(BC.complete(Q).ok, "4: Ⓖ 몸판 재완료");
  const gBefore = J(Q.working.geometry.sleeve), prevSA = Q.working.sleeveA;
  const r3 = SAA.rederive(Q);
  ok(!r3.ok && r3.reason === "armhole-underarm-mismatch" && Q.working.sleeveA.blocked && Q.working.sleeveA.blocked.reason === "armhole-underarm-mismatch", "4: 지원 밖 몸판 재완료 → blocked 사유");
  ok(J(Q.working.geometry.sleeve) === gBefore, "4: blocked 일 때 geometry 를 몰래 바꾸지 않는다");
  ok(SAA.isActive(Q) && SAA.isBlocked(Q), "4: blocked 도 Ⓐ 활성 상태(완료 차단 유지)");
  const lines = SAA.infoLines(Q);
  ok(lines.length === 2 && lines[1].indexOf("⚠ 차단: ") === 0 && /지원하지 않는 몸판/.test(lines[1]), "4: blocked 표시 줄");
  SAA.clear(Q);
  ok(Q.working.sleeveA === null && !SAA.isActive(Q), "4: clear");
}

// ── 5. 표시 줄 ──
{
  const Q = projectWithBodice("A"); SAA.apply(Q, { sleeveLengthCm: 52 });
  const L = SAA.infoLines(Q), m = Q.working.sleeveA.meta, f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
  ok(L[0] === "스트레이트 소매 Ⓐ · 완성 몸판 진동둘레 기준 (P.137)", "5: 패턴명 줄");
  ok(L[1] === "소매산 높이 " + f2(m.capHeightCm) + " · 소매폭 " + f2(m.bicepCm) + " · 소매길이 52.00 cm", "5: 소매산 높이·소매폭·소매길이 줄: " + L[1]);
  ok(L[2] === "AH 앞 " + f2(Q.working.bodiceResult.armholeLengths.front) + " · 뒤 " + f2(Q.working.bodiceResult.armholeLengths.back) + " · 총 " + f2(Q.working.bodiceResult.armholeLengths.front + Q.working.bodiceResult.armholeLengths.back) + " cm", "5: 앞뒤 AH 줄(= 몸판 armholeLengths): " + L[2]);
  ok(L[3] === "목표 이세 앞 " + f2(m.easeTarget.front) + " · 뒤 " + f2(m.easeTarget.back) + " · 총 " + f2(m.easeTarget.total) + " cm", "5: 목표 이세 줄: " + L[3]);
  ok(L[4] === "실제 이세 앞 " + sg(m.easeAfter.front) + " · 뒤 " + sg(m.easeAfter.back) + " · 총 " + sg(m.easeAfter.total) + " cm", "5: 실제 이세 줄: " + L[4]);
  ok(near(m.easeTarget.total, 0.05 * (m.armholeCm.front + m.armholeCm.back), 1e-9) && near(m.easeTarget.back / m.easeTarget.total, 0.6, 1e-9), "5: 목표 이세 = 총 AH 5% · 뒤:앞 = 3:2");
  ok(near(m.easeAfter.back, m.easeTarget.back, 0.02) && near(m.easeAfter.front, m.easeTarget.front, 0.02), "5: 실제 이세가 목표에 맞는다(⑧ 조정 후)");
  ok(L.some(t => /^진동선 계산: .*다트.* 닫은 봉제 상태$/.test(t)), "5: 몸판 다트 닫음 안내(Ⓐ 몸판은 앞 AH·뒤 어깨 다트가 열려 있다)");
  ok(L.length <= 7, "5: 과하지 않다(줄 수 " + L.length + ")");
  ok(SAA.infoLines({ working: {} }).length === 0 && SAA.infoLines(null).length === 0, "5: Ⓐ 꺼짐 → 빈 목록");
}

// ── 6. 완료 연결(Ⓐ 완료본은 sleeveAResultCheck 가 전담 — 여기선 차단이 풀렸는지만) ──
{
  const Q = projectWithBodice("A");
  const before = SC.check(Q);
  ok(!before.fails.includes("sleeve-preset-not-linked"), "6: Ⓐ 없음 → 기존 판정 그대로(" + before.fails.join(",") + ")");
  SAA.apply(Q, { sleeveLengthCm: 52 });
  const c = SC.check(Q);
  ok(c.ok && !c.fails.includes("sleeve-preset-not-linked"), "6: Ⓐ 켜짐 → 더는 sleeve-preset-not-linked 로 막지 않는다");
  const done = SC.complete(Q);
  ok(done.ok && Q.working.sleeveResult === done.result && done.result.origin.presetId === "bunka-sleeve-A", "6: Ⓐ 완료 → origin 이 bunka-sleeve-A 인 sleeveResult");
  SAA.clear(Q);
  ok(!SC.check(Q).ok && SC.check(Q).fails.includes("no-sleeve"), "6: Ⓐ 해제(기본 소매 없음) → 기존 판정(no-sleeve)");
}

// ── 7. 배선(정적) ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const order = ["js/designSleeve.js", "js/sleeveCheckpoint.js", "js/designSleeveA.js", "js/sleevePresets.js", "js/sleeveAApply.js", "js/ui.js"].map(f => html.indexOf('src="' + f + "?v="));
  ok(order.every(i => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "7: index.html 스크립트 등록·순서(엔진 → 카탈로그 → 연결 → ui.js)");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(ver("designSleeveA.js") === "2026100501" && ver("sleeveAApply.js") === "2026100502" && ["sleevePresets.js", "sleeveCheckpoint.js", "ui.js"].every(f => ver(f) === "2026100601"), "7: 캐시 버전 갱신(Ⓑ 연결로 변경된 파일 2026100601)");
  ok(/css\/style\.css\?v=2026100501/.test(html), "7: css 캐시 버전 갱신");
  ["selSleeveFamily", "selSleevePreset", "btnApplySleevePreset", "designSleeveLineNote", "designSleeveAInfo"].forEach(id => ok(new RegExp('id="' + id + '"').test(html) && ui.indexOf('"' + id + '"') > 0, "7: DOM id " + id + " 존재·ui.js 사용"));
  ["btnApplySleeve", "btnResetSleeve", "btnApplyCap", "btnSleeveCapManual", "btnSleeveCapRevert", "btnCompleteSleeve", "inpSleeveLength", "inpSleeveCuff", "selSleeveSide", "inpSleeveBicep", "inpSleeveCapHeight", "designSleeveNote", "designSleeveEaseNote", "designSleeveCheckNote", "designSleeveStatusNote"]
    .forEach(id => ok(new RegExp('id="' + id + '"').test(html), "7: 기존 DOM id 보존 " + id));
  ok(/function deriveSleeve\(project, lower, cap\)/.test(ui) && /computeSilhouette\(project\.referenceGeometry/.test(ui), "7: 기존 소매 파생 경로(deriveSleeve → computeSilhouette) 보존");
  ok(/if \(sleeveAOn\(project\)\) \{ window\.sleeveAApply\.rederive\(project\); relayoutSleeve\(\); return; \}/.test(ui), "7: refreshSleeve 가 Ⓐ 켜짐일 때만 재제도로 분기");
  ok(!/\.innerHTML\s*=/.test(ui.slice(ui.indexOf("function rebuildSleeveFamilyOptions"), ui.indexOf("function onApplySleevePreset"))), "7: Ⓐ UI 블록은 innerHTML 을 쓰지 않는다");
  ok(/window\.sleeveAApply\.apply\(project/.test(ui) && !/sleeveAApply\.[a-z]+\(project\.working/.test(ui), "7: ui.js 는 sleeveAApply 를 통해서만 상태를 쓴다");
  const sa = fs.readFileSync(path.join(ROOT, "js", "sleeveAApply.js"), "utf8");
  ok(!/document\.|localStorage|sessionStorage/.test(sa) && !/bodiceResult\s*=[^=]/.test(sa), "7: sleeveAApply 는 DOM·storage 미접근, bodiceResult 에 쓰지 않는다");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
