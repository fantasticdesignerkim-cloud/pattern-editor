// ══════════════════════════════════════════════
// sleeveBUICheck.js — 소매 Ⓑ(P.41 타이트) UI/프리셋 연결(js/sleevePresets.js · js/sleeveBApply.js · ui.js/index.html 배선) 전용 회귀.
//   소매 Ⓐ 연결(sleeveAUICheck)과 같은 구조로 검증한다. 엔진 자체는 designSleeveBCheck 가 전담.
//
//   (1) 카탈로그: 타이트 소매 Ⓑ(`bunka-sleeve-B`) 실행 가능 · 입력 = 소매길이 + 선택 손바닥 둘레 · Ⓒ 슬롯 없음 · 나머지 8종 보류 유지.
//   (2) 적용: 완성 bodiceResult 를 읽기만 한다(불변). geometry.sleeve = Ⓐ→Ⓑ 엔진 결과(fairing 된 단일 outline, hem-step·rigid 없음).
//       출발 Ⓐ 는 같은 몸판·소매길이의 draftSleeveA. 같은 입력 → 같은 결과.
//   (3) 손바닥 둘레: 비면 W×3/4 · 부족하면 경고만(자동 보정 없음 — hem 이 그대로 W×3/4) · 잘못된 값은 거부(이전 상태 유지).
//   (4) 차단: 몸판 없음·지원 밖 몸판(Ⓖ)·잘못된 소매길이 → 정확한 사유, 폴백 없음.
//   (5) 재제도(refreshSleeve 훅): 새 몸판 hash 로 갱신 / 지원 밖이면 blocked 만 / Ⓑ 꺼짐이면 무동작.
//   (6) 표시: 지배 ease = geometry 실측(= 완료본 cap.ease 와 같은 값). meta.easeTarget/easeAfter 는 표시하지 않는다.
//   (7) 배선: index.html 스크립트 순서·캐시 버전·DOM id, ui.js Ⓐ/Ⓑ 배타·기존 경로 보존.
//   node test/harness/sleeveBUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, SB = W.designSleeveB,
  SP = W.sleevePresets, SAA = W.sleeveAApply, SBA = W.sleeveBApply, DS = W.designSleeve;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));

const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presetOf = (sym) => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; };
function projectWithBodice(sym) { PROJECT = MK(BP.bodyParams(presetOf(sym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const deepHas = (o, key) => !!o && typeof o === "object" && (Object.prototype.hasOwnProperty.call(o, key) || Object.keys(o).some(k => deepHas(o[k], key)));
const segRoles = (g) => g.outline.map(s => s.role || s.edge || s.kind);

// ── 1. 카탈로그 ──
{
  const fams = SP.families();
  const avail = fams.filter(f => f.availability === "available");
  ok(avail.map(f => f.id).join() === "straight-sleeve,tight-sleeve,flare-sleeve,tuck-sleeve", "1: 실행 가능 = 스트레이트 Ⓐ + 타이트 Ⓑ·Ⓒ + 플레어 Ⓓ·Ⓔ + 턱 Ⓕ");
  const t = SP.family("tight-sleeve");
  ok(t.variants.length === 2 && t.variants[0].presetId === "bunka-sleeve-B" && t.variants[0].symbol === "B" && t.variants[0].page === 41 && t.variants[1].presetId === "bunka-sleeve-C" && t.variants[1].symbol === "C", "1: 타이트 소매 = Ⓑ(P.41) + Ⓒ(뒤 소맷부리 다트, sleeveCUICheck 가 전담)");
  const rec = SP.get("bunka-sleeve-B");
  ok(rec.familyId === "tight-sleeve" && rec.method === "tight-from-sleeve-A" && rec.methodPage === 41, "1: 레코드 = 제도 방식·P.41");
  ok(rec.inputs.length === 2 && rec.inputs[0].key === "sleeveLengthCm" && rec.inputs[1].key === "palmCircumferenceCm" && rec.inputs[1].optional === true && !rec.inputs[0].optional, "1: 입력 = 소매길이 + 선택 손바닥 둘레");
  ok(Object.isFrozen(rec) && Object.isFrozen(SP.family("tight-sleeve")), "1: 레코드·가족 동결");
  ok(SP.resolve("tight-sleeve", "bunka-sleeve-B").ok && SP.resolve("tight-sleeve", "bunka-sleeve-B").presetId === "bunka-sleeve-B", "1: Ⓑ resolve");
  fams.filter(f => f.availability !== "available").forEach(f => {
    ok(SP.resolve(f.id, f.variants[0].id).reason === "sleeve-preset-unavailable" && f.variants.every(v => typeof v.blockedBy === "string" && v.blockedBy.length > 10), "1: 보류 슬롯 유지·blockedBy · " + f.id);
  });
  ok(fams.filter(f => f.availability !== "available").length === 6, "1: 나머지 6종 보류");
  ok(SP.get("bunka-bodice-B") === null && BP.get("bunka-sleeve-B") === null, "1: 소매/몸판 id 네임스페이스 분리");
  const t2 = SP.displayTitle("tight-sleeve", "bunka-sleeve-B");
  ok(t2.symbol === "B" && t2.page === 41 && t2.familyLabel === "타이트 소매", "1: displayTitle");
}

// ── 2. 적용(읽기 전용·불변) ──
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult;
const snap = { bodice: J(bodice), hash: bodice.hash, src: J(P.sourceBlock), ref: J(P.referenceGeometry), body: J(P.working.parameters) };
{
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), b = SB.draftSleeveB(a, {});
  ok(a.ok && b.ok, "2: 엔진 기준값(Ⓐ→Ⓑ)");
  const r = SBA.apply(P, { sleeveLengthCm: 52 });
  ok(r.ok && P.working.sleeveB && P.working.sleeveB.presetId === "bunka-sleeve-B", "2: 적용 성공 · working.sleeveB.presetId");
  ok(J(P.working.geometry.sleeve) === J(b.geometry), "2: working.geometry.sleeve = Ⓐ→Ⓑ 엔진 결과(render 미러)");
  const S = P.working.sleeveB;
  ok(S.sourceBodiceHash === bodice.hash && S.sourceSleeveAHash === b.sourceSleeveAHash && S.parameters.sleeveLengthCm === 52 && S.parameters.palmCircumferenceCm === null, "2: 출처 몸판 hash·출발 Ⓐ hash·입력(손바닥 없음=null)");
  ok(J(S.meta) === J(b.meta), "2: meta = 엔진 meta 복사");
  ok(J(bodice) === snap.bodice && bodice.hash === snap.hash && Object.isFrozen(bodice), "2: bodiceResult·hash 불변");
  ok(J(P.sourceBlock) === snap.src && J(P.referenceGeometry) === snap.ref && J(P.working.parameters) === snap.body, "2: sourceBlock·referenceGeometry·몸판 파라미터 불변");
  ok(P.working.sleeveA === undefined && P.working.sleeveDraft === undefined && P.working.sleeveResult === undefined, "2: Ⓐ 상태·기존 소매 파생·완료본을 만들지 않는다(Ⓐ 는 내부 제도만)");
  ok(P.working.geometry.sleeve !== b.geometry && S.meta !== b.meta, "2: 엔진 반환 객체를 그대로 공유하지 않는다(복사)");
  const g = P.working.geometry.sleeve;
  ok(g.outline.length === 4 && g.outline[0].kind === "path" && g.outline[2].kind === "path", "2: UI geometry = fairing 된 한 조각 outline [소매산 path, 옆선, 소맷부리 path, 옆선]");
  ok(!segRoles(g).some(x => /hem-step/.test(String(x))) && !g.construction.some(s => /hem-step/.test(String(s.role))), "2: hem-step 흔적 없음");
  ok(!deepHas(g, "rigid") && !deepHas(g, "meta") && !deepHas(g, "fairing"), "2: geometry 에 raw rigid/meta/fairing 이 없다(meta 에만 있음)");
  ok(S.meta.rigid && S.meta.rigid.cap && S.meta.rigid.hem, "2: rigid 는 meta(감사)에만 보존");
  ok(near(S.meta.hemCm, S.meta.widthCm * 0.75, 1.1e-3), "2: 소맷부리 = W×3/4(기본)");
  const r2 = SBA.apply(P, { sleeveLengthCm: 52 });
  ok(r2.ok && J(P.working.geometry.sleeve) === J(b.geometry), "2: 결정론(같은 입력 → 같은 결과)");
  const r3 = SBA.apply(P, { sleeveLengthCm: 58 });
  ok(r3.ok && near(P.working.sleeveB.meta.sleeveLengthCm, 58) && near(P.working.sleeveB.meta.capLengths.total, S.meta.capLengths.total, 1e-6), "2: 소매길이 변경 재적용 — 소매산 길이 불변");
  SBA.apply(P, { sleeveLengthCm: 52 });
  // 빈 문자열·undefined·null 은 «손바닥 입력 없음»
  [undefined, null, ""].forEach(v => {
    const q = SBA.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: v });
    ok(q.ok && P.working.sleeveB.parameters.palmCircumferenceCm === null && P.working.sleeveB.meta.palm === null && P.working.sleeveB.warnings.length === 0, "2: 손바닥 " + J(v) + " → 입력 없음(기본 W×3/4·경고 없음)");
  });
}

// ── 3. 손바닥 둘레: 경고만, 자동 보정 없음 ──
{
  const Q = projectWithBodice("A");
  const base = SBA.draft(Q, 52), hemTarget = base.meta.hemTargetCm;
  const okPalm = SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 18 });   // 18+3 = 21 ≤ 24.05
  ok(okPalm.ok && Q.working.sleeveB.warnings.length === 0 && Q.working.sleeveB.meta.palm.satisfied === true, "3: 손바닥 18 → 충족(경고 없음)");
  const geomOk = J(Q.working.geometry.sleeve);
  ok(geomOk === J(base.geometry), "3: 충족하는 손바닥 값은 형상을 바꾸지 않는다");
  const bad = SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 23 });       // 23+3 = 26 > 24.05
  ok(bad.ok && Q.working.sleeveB.warnings.join() === "hem-below-palm-allowance" && Q.working.sleeveB.meta.palm.satisfied === false, "3: 손바닥 23 → 경고만(적용은 성공)");
  ok(near(Q.working.sleeveB.meta.palm.shortfallCm, 26 - hemTarget, 1e-9), "3: 부족분 = 손바닥+3 − 목표 소맷부리");
  ok(J(Q.working.geometry.sleeve) === geomOk && near(Q.working.sleeveB.meta.hemCm, hemTarget, 1.1e-3) && Q.working.sleeveB.meta.hemTargetCm === hemTarget, "3: 경고여도 자동 보정 없음 — 형상·소맷부리 W×3/4 그대로");
  const lines = SBA.infoLines(Q);
  ok(lines.some(t => /^손바닥 둘레 23\.00 \+ 여유 3\.00 = 소맷부리 최소 26\.00 cm$/.test(t)) && lines.some(t => t.indexOf("⚠") === 0 && /자동 보정하지 않음/.test(t)), "3: 경고 표시 줄(자동 보정 안 함 명시)");
  const okLines = (SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 18 }), SBA.infoLines(Q));
  ok(!okLines.some(t => t.indexOf("⚠") === 0), "3: 충족하면 경고 줄 없음");
  // 잘못된 손바닥 값 → 거부, 이전 상태 유지
  const keep = J(Q.working.geometry.sleeve), keepS = J(Q.working.sleeveB);
  [0, -3, NaN, "abc", Infinity].forEach(v => {
    const x = SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: v });
    ok(!x.ok && x.reason === "invalid-palm-circumference" && /손바닥 둘레 값 확인/.test(x.text) && J(Q.working.geometry.sleeve) === keep && J(Q.working.sleeveB) === keepS, "3: 손바닥 " + J(v) + " → 거부·이전 유지");
  });
}

// ── 4. 차단 ──
{
  const Q = MK(BP.bodyParams(presetOf("A")));
  const g0 = J(Q.working.geometry.sleeve);
  const r = SBA.apply(Q, { sleeveLengthCm: 52 });
  ok(!r.ok && r.reason === "no-bodice" && /몸판을 먼저 완료해야 합니다/.test(r.text) && Q.working.sleeveB === undefined && J(Q.working.geometry.sleeve) === g0, "4: 몸판 미완료 → no-bodice·불변");
  ok(!SBA.apply(null, { sleeveLengthCm: 52 }).ok && SBA.apply(null, { sleeveLengthCm: 52 }).reason === "no-project", "4: 프로젝트 없음");
  ["G", "H"].forEach(sym => {
    const U = projectWithBodice(sym), g1 = J(U.working.geometry.sleeve);
    const x = SBA.apply(U, { sleeveLengthCm: 52 });
    ok(!x.ok && x.reason === "armhole-underarm-mismatch" && x.stage === "A" && /^출발 소매 Ⓐ: 앞·뒤 진동 아랫점 높이가 달라 지원하지 않는 몸판/.test(x.text), "4: 몸판 " + sym + " → Ⓐ 단계 사유를 그대로: " + x.text);
    ok(U.working.sleeveB === undefined && J(U.working.geometry.sleeve) === g1, "4: 몸판 " + sym + " → 폴백 없음(상태·형상 불변)");
  });
  [5, 0, NaN, undefined].forEach(len => {
    const R = projectWithBodice("A"), g = J(R.working.geometry.sleeve);
    const x = SBA.apply(R, { sleeveLengthCm: len });
    ok(!x.ok && x.reason === "invalid-sleeve-length" && R.working.sleeveB === undefined && J(R.working.geometry.sleeve) === g, "4: 소매길이 " + len + " → invalid-sleeve-length · 불변");
  });
  const S = projectWithBodice("A"); SBA.apply(S, { sleeveLengthCm: 52 });
  const keep = J(S.working.geometry.sleeve), keepS = J(S.working.sleeveB);
  ok(!SBA.apply(S, { sleeveLengthCm: 3 }).ok && J(S.working.geometry.sleeve) === keep && J(S.working.sleeveB) === keepS, "4: Ⓑ 켜진 상태에서 실패 → 이전 Ⓑ 유지");
  ok(SBA.failText({ reason: "fairing-cap-deviation", piece: "back", detail: 0.12 }) === "뒤판: 소매산 정리 편차가 한계를 넘음 · 0.12", "4: Ⓑ 사유 문구(조각·수치)");
  ok(SBA.failText({ reason: "something-new" }).indexOf("something-new") >= 0, "4: 모르는 사유도 코드를 그대로 보인다");
  // 엔진이 실제로 내는 reason 코드는 전부 한글 문구가 있다(코드 그대로 노출되지 않는다)
  const src = fs.readFileSync(path.join(ROOT, "js", "designSleeveB.js"), "utf8");
  const codes = Array.from(new Set((src.match(/(?:reason: |error: )"([a-z-]+)"/g) || []).map(m => m.replace(/^[a-z]+: "|"$/g, "")))).filter(c => c !== "fairing-cap-").map(c => /^length-/.test(c) ? "fairing-cap-" + c : c);   // length-* 는 엔진이 "fairing-cap-" 접두로 낸다
  const missing = codes.filter(c => SBA.failText({ reason: c }).indexOf("(" + c + ")") >= 0);
  ok(missing.length === 0, "4: 엔진 reason 코드 한글 문구 누락 없음 " + missing.join());
}

// ── 5. 재제도(refreshSleeve 훅) ──
{
  const Q = projectWithBodice("A");
  ok(SBA.rederive(Q).active === false && Q.working.sleeveB === undefined, "5: Ⓑ 꺼짐이면 무동작");
  SBA.apply(Q, { sleeveLengthCm: 52, palmCircumferenceCm: 18 });
  const ref = J(Q.working.geometry.sleeve);
  Q.working.geometry.sleeve = JSON.parse(J(Q.referenceGeometry.sleeve));   // body apply 가 덮은 상황
  const r = SBA.rederive(Q);
  ok(r.ok && r.active && J(Q.working.geometry.sleeve) === ref && Q.working.sleeveB.parameters.palmCircumferenceCm === 18, "5: body apply 가 덮은 소매를 Ⓑ 로 되돌린다(손바닥 입력 유지)");
  const oldHash = Q.working.sleeveB.sourceBodiceHash;
  Q.working.parameters = { neckline: Q.working.parameters.neckline, body: BP.bodyParams(presetOf("I")) };
  Q.working.geometry = DB.computeGeometry(Q.referenceGeometry, { body: BP.bodyParams(presetOf("I")) });
  ok(BC.complete(Q).ok && Q.working.bodiceResult.hash !== oldHash, "5: 다른 몸판 재완료");
  const r2 = SBA.rederive(Q);
  ok(r2.ok && Q.working.sleeveB.sourceBodiceHash === Q.working.bodiceResult.hash && Q.working.sleeveB.blocked === null, "5: 새 몸판 hash 로 재제도");
  Q.working.parameters = { neckline: Q.working.parameters.neckline, body: BP.bodyParams(presetOf("G")) };
  Q.working.geometry = DB.computeGeometry(Q.referenceGeometry, { body: BP.bodyParams(presetOf("G")) });
  ok(BC.complete(Q).ok, "5: Ⓖ 몸판 재완료");
  const gBefore = J(Q.working.geometry.sleeve);
  const r3 = SBA.rederive(Q);
  ok(!r3.ok && r3.reason === "armhole-underarm-mismatch" && Q.working.sleeveB.blocked && Q.working.sleeveB.blocked.reason === "armhole-underarm-mismatch", "5: 지원 밖 몸판 → blocked 사유");
  ok(J(Q.working.geometry.sleeve) === gBefore && SBA.isActive(Q) && SBA.isBlocked(Q), "5: blocked 일 때 geometry 를 몰래 바꾸지 않는다 · Ⓑ 는 활성 유지");
  const lines = SBA.infoLines(Q);
  ok(lines.length === 2 && lines[1].indexOf("⚠ 차단: ") === 0, "5: blocked 표시 줄");
  SBA.clear(Q);
  ok(Q.working.sleeveB === null && !SBA.isActive(Q), "5: clear");
}

// ── 6. 표시 줄: 지배 ease = geometry 실측 ──
{
  const Q = projectWithBodice("A"); SBA.apply(Q, { sleeveLengthCm: 52 });
  const L = SBA.infoLines(Q), m = Q.working.sleeveB.meta, f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
  const AH = Q.working.bodiceResult.armholeLengths, prim = DS.capPrimitives(Q.working.geometry.sleeve);
  ok(L[0] === "타이트 소매 Ⓑ · 소매 Ⓐ 에서 소맷부리 W×3/4 로 맞댐 (P.41)", "6: 패턴명 줄: " + L[0]);
  ok(L[1] === "소매폭 " + f2(m.widthCm) + " → 소맷부리 " + f2(m.hemCm) + " (목표 " + f2(m.hemTargetCm) + ") · 맞댐 ● " + f2(m.closeTotalCm) + " · 소매길이 52.00 cm", "6: 소매폭·소맷부리 줄: " + L[1]);
  ok(L[2] === "AH 앞 " + f2(AH.front) + " · 뒤 " + f2(AH.back) + " · 총 " + f2(AH.front + AH.back) + " cm", "6: AH 줄(= 몸판 armholeLengths)");
  ok(L[3] === "소매산 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm", "6: 소매산 길이(geometry 실측)");
  const ef = prim.lengths.front - AH.front, eb = prim.lengths.back - AH.back;
  ok(L[4] === "이세(실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "6: 이세 줄 = geometry 실측(지배 ease): " + L[4]);
  ok(!L.some(t => /목표 이세|실제 이세/.test(t)), "6: meta.easeTarget/easeAfter(감사 정보)는 표시하지 않는다");
  ok(near(prim.lengths.total, m.capLengths.total, 5e-3) && near(ef + eb, m.easeAfter.total, 5e-3), "6: 실측 ease 와 meta.easeAfter 는 샘플링 차이 안(감사 정보로만 비교)");
  ok(!L.some(t => t.indexOf("손바닥") >= 0), "6: 손바닥 입력 없으면 손바닥 줄 없음");
  ok(SBA.infoLines({ working: {} }).length === 0 && SBA.infoLines(null).length === 0, "6: Ⓑ 꺼짐 → 빈 목록");
}

// ── 7. 배선(정적) ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const order = ["js/designSleeve.js", "js/sleeveCheckpoint.js", "js/designSleeveA.js", "js/sleevePresets.js", "js/sleeveAApply.js", "js/designSleeveB.js", "js/sleeveBApply.js", "js/ui.js"].map(f => html.indexOf('src="' + f + "?v="));
  ok(order.every(i => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "7: index.html 스크립트 등록·순서(Ⓐ 모듈 → 엔진 Ⓑ → 연결 Ⓑ → ui.js)");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(["designSleeveB.js", "sleeveBApply.js"].every(f => ver(f) === "2026100601") && ver("ui.js") === "2026101002" && ver("sleevePresets.js") === "2026101002" && ver("sleeveCheckpoint.js") === "2026101002", "7: 캐시 버전 갱신(Ⓑ 파일 2026100601 · Ⓕ 연결로 변경된 공용 파일 2026101002)");
  ok(/id="rowSleevePalm"[^>]*hidden/.test(html) && /id="inpSleevePalm"[^>]*type="number"/.test(html) && ui.indexOf('"inpSleevePalm"') > 0 && ui.indexOf('"rowSleevePalm"') > 0, "7: 손바닥 둘레 입력(DOM id·기본 숨김·ui.js 사용)");
  ok(html.indexOf('id="rowSleevePalm"') > html.indexOf('id="inpSleeveLength"') && html.indexOf('id="rowSleevePalm"') < html.indexOf('id="inpSleeveCuff"'), "7: 손바닥 입력은 소매길이 다음 줄");
  ["selSleeveFamily", "selSleevePreset", "btnApplySleevePreset", "designSleeveLineNote", "designSleeveAInfo", "btnApplySleeve", "btnResetSleeve", "btnCompleteSleeve", "inpSleeveLength", "inpSleeveCuff", "designSleeveStatusNote"]
    .forEach(id => ok(new RegExp('id="' + id + '"').test(html), "7: 기존 DOM id 보존 " + id));
  ok(/if \(sleeveAOn\(project\)\) \{ window\.sleeveAApply\.rederive\(project\); relayoutSleeve\(\); return; \}/.test(ui) && /if \(sleeveBOn\(project\)\) \{ window\.sleeveBApply\.rederive\(project\); relayoutSleeve\(\); return; \}/.test(ui), "7: refreshSleeve 가 Ⓐ/Ⓑ 켜짐일 때만 각자 재제도로 분기");
  ok(/clearOtherSleeveLines\(project, "B"\);\s*\/\/ 기본\/Ⓐ\/Ⓑ\/Ⓒ 배타/.test(ui) && /clearOtherSleeveLines\(project, "A"\);\s*\/\/ 기본\/Ⓐ\/Ⓑ\/Ⓒ 배타/.test(ui), "7: 적용 성공 시 상대 라인 해제(기본/Ⓐ/Ⓑ/Ⓒ 배타 — clearOtherSleeveLines)");
  ok(/function deriveSleeve\(project, lower, cap\)/.test(ui) && /computeSilhouette\(project\.referenceGeometry/.test(ui), "7: 기존 소매 파생 경로 보존");
  ok(!/\.innerHTML\s*=/.test(ui.slice(ui.indexOf("function sleeveBOn"), ui.indexOf("function applySleeveB"))) && !/\.innerHTML\s*=/.test(ui.slice(ui.indexOf("function rebuildSleeveFamilyOptions"), ui.indexOf("function onApplySleevePreset"))), "7: 소매 라인 UI 블록은 innerHTML 을 쓰지 않는다");
  ok(!/sleeveBApply\.[a-z]+\(project\.working/.test(ui), "7: ui.js 는 sleeveBApply 를 통해서만 상태를 쓴다");
  const sb = fs.readFileSync(path.join(ROOT, "js", "sleeveBApply.js"), "utf8");
  ok(!/document\.|localStorage|sessionStorage/.test(sb) && !/bodiceResult\s*=[^=]/.test(sb) && !/working\.sleeveA\s*=|\.sleeveA\s*=[^=]/.test(sb.replace(/\/\/.*$/gm, "")), "7: sleeveBApply 는 DOM·storage 미접근, bodiceResult·sleeveA 에 쓰지 않는다");
  // render 경로는 working.geometry.sleeve 만 읽는다 — rigid/meta 를 그리는 코드가 없다
  const rr = fs.readFileSync(path.join(ROOT, "js", "designRenderer.js"), "utf8") + fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  ok(!/sleeveB|\.rigid\b|meta\.rigid/.test(rr), "7: 렌더러는 Ⓑ meta/rigid 를 참조하지 않는다");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
