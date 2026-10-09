// ══════════════════════════════════════════════
// sleeveCUICheck.js — 소매 Ⓒ(P.41 하단 타이트 + 뒤 소맷부리 다트) UI/프리셋 연결(js/sleevePresets.js · js/sleeveCApply.js · ui.js/index.html 배선) 전용 회귀.
//   sleeveBUICheck 와 같은 구조 — 엔진은 designSleeveCCheck 가 전담, 여기서는 연결·상태·표시·문구·배선을 본다.
//   (1) 카탈로그  (2) 적용(읽기 전용·불변·표시용 construction)  (3) EL 검증·사유 문구  (4) 차단(잘못된 입력은 이전 형상을 조용히 재사용하지 않는다)
//   (5) 재제도(refreshSleeve 훅)  (6) 표시 줄(앞/뒤·목표/실제·EL·뒤 다트·지배 ease = geometry 실측)  (7) 배선(정적)
//   node test/harness/sleeveCUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js"].forEach(load);
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

const SCA = W.sleeveCApply, SC = W.designSleeveC;
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);

// ── 1. 카탈로그 ──
{
  const t = SP.family("tight-sleeve");
  ok(t.variants.map(v => v.presetId).join() === "bunka-sleeve-B,bunka-sleeve-C" && t.variants[1].symbol === "C" && t.variants[1].page === 41 && t.variants[1].availability === "available", "1: 타이트 소매 = Ⓑ + Ⓒ(P.41, 실행 가능)");
  const rec = SP.get("bunka-sleeve-C");
  ok(rec.familyId === "tight-sleeve" && rec.method === "tight-back-dart-from-sleeve-A" && rec.methodPage === 41, "1: 레코드 = 제도 방식·P.41");
  ok(rec.inputs.length === 2 && rec.inputs[0].key === "sleeveLengthCm" && rec.inputs[1].key === "elbowLengthCm" && rec.inputs[1].label === "팔꿈치 길이 EL" && rec.inputs[1].defaultValue === 31.4 && !rec.inputs[1].optional, "1: 입력 = 소매길이 + 팔꿈치 길이 EL(기본 31.4, 필수)");
  ok(SP.resolve("tight-sleeve", "bunka-sleeve-C").ok && SP.resolve("tight-sleeve", "bunka-sleeve-C").presetId === "bunka-sleeve-C" && Object.isFrozen(rec), "1: Ⓒ resolve · 레코드 동결");
  ok(SP.families().filter(f => f.availability !== "available").length === 8 && SP.get("bunka-bodice-C") === null, "1: 나머지 8종 보류 유지 · 네임스페이스 분리");
  ok(SP.displayTitle("tight-sleeve", "bunka-sleeve-C").symbol === "C", "1: displayTitle Ⓒ");
}

// ── 2. 적용(읽기 전용·불변) ──
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult;
const snap = { bodice: J(bodice), hash: bodice.hash, src: J(P.sourceBlock), ref: J(P.referenceGeometry), body: J(P.working.parameters) };
{
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), c = SC.draftSleeveC(a, { elbowLengthCm: 31.4 });
  ok(a.ok && c.ok, "2: 엔진 기준값(Ⓐ→Ⓒ)");
  const r = SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(r.ok && P.working.sleeveC && P.working.sleeveC.presetId === "bunka-sleeve-C" && SCA.isActive(P) && !SCA.isBlocked(P), "2: 적용 성공 · working.sleeveC.presetId");
  const S = P.working.sleeveC, g = P.working.geometry.sleeve;
  ok(J(g.outline) === J(c.geometry.outline), "2: working.geometry.sleeve outline = Ⓐ→Ⓒ 엔진 결과(정리된 단일 outline)");
  ok(S.sourceBodiceHash === bodice.hash && S.sourceSleeveAHash === c.sourceSleeveAHash && J(S.parameters) === J({ sleeveLengthCm: 52, elbowLengthCm: 31.4 }) && S.blocked === null, "2: 출처 몸판 hash·출발 Ⓐ hash·입력(소매길이·EL)");
  ok(J(S.meta) === J(c.meta) && S.meta !== c.meta, "2: meta = 엔진 meta 복사(공유 참조 없음)");
  ok(J(bodice) === snap.bodice && bodice.hash === snap.hash && Object.isFrozen(bodice) && J(P.sourceBlock) === snap.src && J(P.referenceGeometry) === snap.ref && J(P.working.parameters) === snap.body, "2: bodiceResult·sourceBlock·referenceGeometry·몸판 파라미터 불변");
  ok(P.working.sleeveA === undefined && P.working.sleeveB === undefined && P.working.sleeveDraft === undefined && P.working.sleeveResult === undefined, "2: Ⓐ·Ⓑ 상태·기존 소매 파생·완료본을 만들지 않는다(Ⓐ 는 내부 제도용)");
  ok(g.outline.length === 10 && g.outline[0].kind === "path" && g.outline[0].role === "cap" && g.outline.filter(s => /^dart-leg-/.test(s.role || "")).length === 2, "2: UI geometry = 한 조각 outline 10 구간(소매산 role=cap) · 뒤 열린 다트 두 다리 포함");
  const roles = g.construction.map(s => s.role).sort().join();
  ok(roles === "center-line,cut-axis-back,cut-axis-front,elbow-line,front-axis-lower", "2: 표시용 construction 은 중심선·EL 선·앞/뒤 맞댐선·앞 EL→소매구 맞댐선(" + roles + ") — 겹침 내부선·EL 절개변은 올리지 않는다");
  ok(!deepHas(g, "rigid") && !deepHas(g, "meta") && !deepHas(g, "fairing") && !J(g).includes("front-cut-edge") && !J(g).includes("lap"), "2: geometry 에 raw rigid/meta/fairing/겹침 내부선 없음(meta 에만)");
  ok(S.meta.redraw && S.meta.derivation && S.meta.derivation.backWedge && !S.meta.rigid && !S.meta.fairing, "2: 재제도·유도 기록은 meta 에만(옛 rigid·fairing 기록 없음)");
  const aOnly = SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), prim = DS.capPrimitives(g), primA = DS.capPrimitives(aOnly.geometry);
  ok(prim && primA && near(prim.lengths.front, S.meta.capLengths.front, 1e-3) && near(prim.lengths.back, S.meta.capLengths.back, 1e-3), "2: DS.capPrimitives(Ⓒ geometry) 가 소매산 앞/뒤를 분리·측정한다(최종 곡선 실측 — Ⓐ 와 같다고 가정하지 않음)");
  const r2 = SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(r2.ok && J(P.working.geometry.sleeve.outline) === J(c.geometry.outline), "2: 결정론(같은 입력 → 같은 결과)");
  const r3 = SCA.apply(P, { sleeveLengthCm: 52 });   // EL 생략 = 기본 31.4(UI 는 항상 명시값을 넘긴다)
  ok(r3.ok && P.working.sleeveC.parameters.elbowLengthCm === 31.4 && J(P.working.geometry.sleeve.outline) === J(c.geometry.outline) && SCA.DEFAULT_ELBOW_CM === 31.4, "2: EL 생략/null = 기본 31.4(상태에는 명시값으로 저장)");
  const r4 = SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 29 }), c29 = SC.draftSleeveC(a, { elbowLengthCm: 29 });
  ok(r4.ok && P.working.sleeveC.parameters.elbowLengthCm === 29 && J(P.working.geometry.sleeve.outline) === J(c29.geometry.outline) && P.working.sleeveC.meta.back.apex.y === 29 && P.working.geometry.sleeve.construction.find(s => s.role === "elbow-line").from.y === 29, "2: EL 수정 → EL 선·다트 꼭짓점 이동");
  const r5 = SCA.apply(P, { sleeveLengthCm: 58, elbowLengthCm: 31.4 });
  ok(r5.ok && near(P.working.sleeveC.meta.sleeveLengthCm, 58) && P.working.sleeveC.parameters.sleeveLengthCm === 58 && near(P.working.sleeveC.meta.capLengths.front, S.meta.capLengths.front, 0.05), "2: 소매길이 변경 재적용 — 소맷부리 사슬·쐐기 재계산(소매산 길이는 재제도 실측)");
  SCA.apply(P, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
}

// ── 3. EL 검증: 기본값으로 바꾸지 않고 거부 · 사유 문구 ──
{
  const Q = projectWithBodice("A");
  SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  const keepG = J(Q.working.geometry.sleeve), keepS = J(Q.working.sleeveC);
  ["", NaN, "abc", 0, -5, Infinity].forEach(v => {
    const x = SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: v });
    ok(!x.ok && x.reason === "invalid-elbow-length" && /팔꿈치 길이 EL 값을 확인하세요/.test(x.text) && J(Q.working.geometry.sleeve) === keepG && J(Q.working.sleeveC) === keepS, "3: EL " + J(v) + " → invalid-elbow-length(기본 31.4 로 바꾸지 않음)·상태 불변");
  });
  const near1 = SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 51.5 }), far1 = SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 8 });
  ok(!near1.ok && near1.reason === "elbow-too-close-to-hem" && /EL 이 소맷부리에 너무 가깝습니다/.test(near1.text) && /EL 을 줄이세요/.test(near1.text), "3: EL 51.5 → 소맷부리에 너무 가까움(이해되는 문구)");
  ok(!far1.ok && far1.reason === "elbow-above-underarm" && /EL 이 아랫점·절개축 소매산 교점보다 위/.test(far1.text) && /EL 을 늘리세요/.test(far1.text), "3: EL 8 → 아랫점·교점보다 위(이해되는 문구)");
  ok(J(Q.working.geometry.sleeve) === keepG && J(Q.working.sleeveC) === keepS, "3: 엔진 지원 범위 오류도 상태·형상을 바꾸지 않는다");
  // 지원 범위 밖(앞 겹침 음수) 치수: 앞 반폭 중점이 ● 보다 작은 Ⓐ 는 UI 에서 만들 수 없는 몸판도 있으므로 엔진 사유 문구만 확인
  ok(/지원 범위 밖/.test(SCA.failText({ reason: "front-no-overlap", detail: -0.4 })) && /\(-0\.40cm\)/.test(SCA.failText({ reason: "front-no-overlap", detail: -0.4 })), "3: 앞 겹침 없음 → «지원 범위 밖» 문구(수치 포함)");
  ok(/다트가 벌어지지 않습니다/.test(SCA.failText({ reason: "back-dart-not-open" })) && /완성 가정선을 그릴 수 없습니다/.test(SCA.failText({ reason: "cuff-chain-impossible" })) && /변곡/.test(SCA.failText({ reason: "redraw-extra-inflection" })), "3: 뒤 다트·소맷부리 사슬·재제도 변곡 문구");
  // 정리 단계 사유는 코드를 숨기지 않고 단계 설명 + 코드
  ok(/곡선 정리 단계/.test(SCA.failText({ reason: "fairing-cuff-deviation" })) && SCA.failText({ reason: "something-new" }).indexOf("something-new") >= 0, "3: 정리 단계·모르는 사유는 단계 설명 + 코드");
  // 엔진이 실제로 내는 reason 코드는 전부 한글 문구가 있다
  const src = fs.readFileSync(path.join(ROOT, "js", "designSleeveC.js"), "utf8");
  const codes = Array.from(new Set((src.match(/(?:reason: |fail\()"([a-z0-9-]+)"/g) || []).map(m => m.replace(/^.*"([a-z0-9-]+)"$/, "$1"))));
  const missing = codes.filter(c => SCA.failText({ reason: c }).indexOf("(" + c + ")") >= 0 && !/^fairing-/.test(c));
  ok(codes.length > 15 && missing.length === 0, "3: 엔진 reason 코드 한글 문구 누락 없음(" + codes.length + "종) " + missing.join());
}

// ── 4. 차단: 몸판·소매길이·Ⓒ 켜진 상태의 실패 ──
{
  const Q = MK(BP.bodyParams(presetOf("A")));
  const g0 = J(Q.working.geometry.sleeve);
  const r = SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  ok(!r.ok && r.reason === "no-bodice" && Q.working.sleeveC === undefined && J(Q.working.geometry.sleeve) === g0, "4: 몸판 미완료 → no-bodice · 상태 불변(폴백 없음)");
  ok(SCA.apply(null, { sleeveLengthCm: 52 }).reason === "no-project", "4: 프로젝트 없음");
  ["G", "H"].forEach(sym => {
    const U = projectWithBodice(sym), g1 = J(U.working.geometry.sleeve), x = SCA.apply(U, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
    ok(!x.ok && x.reason === "armhole-underarm-mismatch" && x.stage === "A" && /^출발 소매 Ⓐ: /.test(x.text) && U.working.sleeveC === undefined && J(U.working.geometry.sleeve) === g1, "4: 몸판 " + sym + " → 출발 Ⓐ 단계 사유·폴백 없음");
  });
  [5, 0, NaN, undefined].forEach(len => { const R = projectWithBodice("A"), x = SCA.apply(R, { sleeveLengthCm: len, elbowLengthCm: 31.4 }); ok(!x.ok && x.reason === "invalid-sleeve-length" && R.working.sleeveC === undefined, "4: 소매길이 " + len + " → invalid-sleeve-length"); });
  // Ⓒ 가 켜진 뒤 입력이 틀리면: 이전 정상 형상이 현재 입력의 결과처럼 남지 않게 blocked
  const S = projectWithBodice("A"); SCA.apply(S, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  const keepG = J(S.working.geometry.sleeve);
  const bad = SCA.apply(S, { sleeveLengthCm: 52, elbowLengthCm: 51.5 });
  ok(!bad.ok && J(S.working.geometry.sleeve) === keepG && !SCA.isBlocked(S), "4: apply 실패 자체는 상태를 바꾸지 않는다");
  ok(SCA.reject(S, bad) === true && SCA.isBlocked(S) && S.working.sleeveC.blocked.reason === "elbow-too-close-to-hem" && /소맷부리에 너무 가깝습니다/.test(S.working.sleeveC.blocked.text), "4: reject → blocked(사유·문구) — 호출부(ui)가 잘못된 입력에 사용");
  ok(J(S.working.geometry.sleeve) === keepG, "4: blocked 여도 geometry 를 몰래 바꾸지 않는다");
  const lines = SCA.infoLines(S);
  ok(lines.length === 2 && lines[1].indexOf("⚠ 차단: ") === 0 && /입력·몸판을 확인한 뒤 다시 적용하세요/.test(lines[1]) && /완료할 수 없습니다/.test(lines[1]), "4: blocked 표시 — 이전 형상이 현재 입력의 결과가 아님을 안내");
  ok(SCA.apply(S, { sleeveLengthCm: 52, elbowLengthCm: 31.4 }).ok && !SCA.isBlocked(S), "4: 올바른 입력 재적용 → 차단 해제");
  ok(SCA.reject(Q, bad) === false, "4: Ⓒ 가 꺼져 있으면 reject 무동작");
}

// ── 5. 재제도(refreshSleeve 훅) ──
{
  const Q = projectWithBodice("A");
  ok(SCA.rederive(Q).active === false && Q.working.sleeveC === undefined, "5: Ⓒ 꺼짐이면 무동작");
  SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 30 });
  const ref = J(Q.working.geometry.sleeve);
  Q.working.geometry.sleeve = JSON.parse(J(Q.referenceGeometry.sleeve));   // body apply 가 덮은 상황
  const r = SCA.rederive(Q);
  ok(r.ok && r.active && J(Q.working.geometry.sleeve) === ref && Q.working.sleeveC.parameters.elbowLengthCm === 30, "5: body apply 가 덮은 소매를 Ⓒ 로 되돌린다(소매길이·EL 입력 유지)");
  const oldHash = Q.working.sleeveC.sourceBodiceHash;
  Q.working.parameters = { neckline: Q.working.parameters.neckline, body: BP.bodyParams(presetOf("I")) };
  Q.working.geometry = DB.computeGeometry(Q.referenceGeometry, { body: BP.bodyParams(presetOf("I")) });
  ok(BC.complete(Q).ok && Q.working.bodiceResult.hash !== oldHash, "5: 다른 몸판 재완료");
  const r2 = SCA.rederive(Q);
  ok(r2.ok && Q.working.sleeveC.sourceBodiceHash === Q.working.bodiceResult.hash && Q.working.sleeveC.blocked === null && Q.working.sleeveC.parameters.elbowLengthCm === 30, "5: 새 몸판 hash 로 재제도(같은 소매길이·EL)");
  Q.working.parameters = { neckline: Q.working.parameters.neckline, body: BP.bodyParams(presetOf("G")) };
  Q.working.geometry = DB.computeGeometry(Q.referenceGeometry, { body: BP.bodyParams(presetOf("G")) });
  ok(BC.complete(Q).ok, "5: Ⓖ 몸판 재완료");
  const gBefore = J(Q.working.geometry.sleeve), r3 = SCA.rederive(Q);
  ok(!r3.ok && r3.reason === "armhole-underarm-mismatch" && Q.working.sleeveC.blocked && Q.working.sleeveC.blocked.reason === "armhole-underarm-mismatch", "5: 지원 밖 몸판 → blocked 사유");
  ok(J(Q.working.geometry.sleeve) === gBefore && SCA.isActive(Q) && SCA.isBlocked(Q), "5: blocked 일 때 geometry 를 몰래 바꾸지 않는다 · Ⓒ 는 활성 유지");
  const lines = SCA.infoLines(Q);
  ok(lines.length === 2 && lines[1].indexOf("⚠ 차단: ") === 0, "5: blocked 표시 줄");
  SCA.clear(Q);
  ok(Q.working.sleeveC === null && !SCA.isActive(Q), "5: clear");
}

// ── 6. 표시 줄: 앞/뒤 · 소맷부리 목표/실제 · EL · 뒤 다트 · 지배 ease = geometry 실측 ──
{
  const Q = projectWithBodice("A"); SCA.apply(Q, { sleeveLengthCm: 52, elbowLengthCm: 31.4 });
  const L = SCA.infoLines(Q), m = Q.working.sleeveC.meta;
  const AH = Q.working.bodiceResult.armholeLengths, prim = DS.capPrimitives(Q.working.geometry.sleeve);
  ok(L.length === 10, "6: 표시 줄 10줄(디버그 값을 늘어놓지 않음): " + L.length);
  ok(L[0] === "타이트 소매 Ⓒ · 소매 Ⓐ 에서 소맷부리 W×3/4 + 뒤 소맷부리 다트 (P.41)", "6: 패턴명 줄");
  ok(L[1] === "소맷부리 목표 W×3/4 " + f2(m.hemTargetCm) + " · 실측(마무리 곡선) " + f2(m.hemCm) + " cm · 소매폭 " + f2(m.widthCm) + " · 소매길이 52.00" && near(m.hemTargetCm, 24.05, 0.01), "6: 소맷부리 목표·실측: " + L[1]);
  ok(/^● = 소맷부리÷4 = 6\.01 · 완성 가정선 구간 뒤 6\.01 : 중앙 12\.02 : 앞 6\.01 \(앞 최종 \d+\.\d\d — 소매구 연장 반영\)$/.test(L[2]), "6: ● · 완성 가정선 구간: " + L[2]);
  ok(L[3] === "팔꿈치 EL 31.40 cm (SP 기준) · EL 아래 " + f2(m.lowerLengthCm) + " cm", "6: EL 줄: " + L[3]);
  ok(/^뒤: EL 까지 맞대고 아래는 열린 봉제 다트 · EL 쐐기 폭 \d+\.\d\d · 다리 \d+\.\d\d · 벌어짐 \d+\.\d\d · 다리끝 소맷부리선 아래 1$/.test(L[4]) && L[4].indexOf(f2(m.back.dartOpenCm)) > 0, "6: 뒤 다트 줄: " + L[4]);
  ok(/^앞: EL 가로 절개 · 겹침 0\.9\d → 소매구 연장 0\.9\d · 옆선 앞 \d+\.\d\d \/ 뒤 \d+\.\d\d cm$/.test(L[5]), "6: 앞 EL 절개·연장·옆선 줄: " + L[5]);
  ok(L[6] === "소매산: 맞댄 뒤 꺾임 양쪽 2.00cm 국소 재제도(임시 시작 설정)", "6: 소매산 재제도 줄: " + L[6]);
  ok(L[7] === "AH 앞 " + f2(AH.front) + " · 뒤 " + f2(AH.back) + " · 총 " + f2(AH.front + AH.back) + " cm", "6: AH 줄(= 몸판 armholeLengths)");
  ok(L[8] === "소매산 앞 " + f2(prim.lengths.front) + " · 뒤 " + f2(prim.lengths.back) + " · 총 " + f2(prim.lengths.total) + " cm", "6: 소매산 길이(geometry 실측)");
  const ef = prim.lengths.front - AH.front, eb = prim.lengths.back - AH.back;
  ok(L[9] === "이세(실측) 앞 " + sg(ef) + " · 뒤 " + sg(eb) + " · 총 " + sg(ef + eb) + " cm", "6: 이세 줄 = geometry 실측(지배 ease): " + L[8]);
  ok(!L.some(t => /rigid|raw|fairing|compensation|iterations|residual/i.test(t)) && !L.some(t => /easeAfter|easeTarget/.test(t)), "6: 내부 디버그 값(raw·정리 보정·잔차)을 UI 에 올리지 않는다");
  ok(near(m.easeAfter.total, ef + eb, 5e-3), "6: 엔진 meta.easeAfter(최종 곡선 GL 실측)와 표시 이세는 샘플링 차 안");
  ok(SCA.infoLines({ working: {} }).length === 0 && SCA.infoLines(null).length === 0, "6: Ⓒ 꺼짐 → 빈 목록");
}

// ── 7. 배선(정적) ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const order = ["js/designSleeve.js", "js/sleeveCheckpoint.js", "js/designSleeveA.js", "js/sleevePresets.js", "js/sleeveAApply.js", "js/designSleeveB.js", "js/sleeveBApply.js", "js/designSleeveC.js", "js/sleeveCApply.js", "js/ui.js"].map(f => html.indexOf('src="' + f));
  ok(order.every(i => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]), "7: index.html 스크립트 등록·순서(Ⓐ → Ⓑ → 엔진 Ⓒ → 연결 Ⓒ → ui.js)");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok(ver("ui.js") === "2026100902" && ["designSleeveC.js", "sleeveCApply.js"].every(f => ver(f) === "2026100901") && ver("sleevePresets.js") === "2026100801" && ver("sleeveCheckpoint.js") === "2026100701", "7: 캐시 버전 갱신(Ⓒ 엔진·연결 2026100901)");
  ok(/id="rowSleeveElbow"[^>]*hidden/.test(html) && /id="inpSleeveElbow"[^>]*type="number"[^>]*value="31\.4"/.test(html) && />팔꿈치 길이 EL \(cm\)</.test(html), "7: EL 입력(라벨 «팔꿈치 길이 EL (cm)»·기본 31.4·기본 숨김)");
  ok(html.indexOf('id="rowSleeveElbow"') > html.indexOf('id="rowSleevePalm"') && html.indexOf('id="rowSleeveElbow"') < html.indexOf('id="inpSleeveCuff"'), "7: EL 입력은 소매길이·손바닥 다음 줄");
  ["selSleeveFamily", "selSleevePreset", "btnApplySleevePreset", "designSleeveLineNote", "designSleeveAInfo", "btnApplySleeve", "btnResetSleeve", "btnCompleteSleeve", "inpSleeveLength", "inpSleeveCuff", "inpSleevePalm", "rowSleevePalm", "designSleeveCheckNote", "designSleeveStatusNote"]
    .forEach(id => ok(new RegExp('id="' + id + '"').test(html), "7: 기존 DOM id 보존 " + id));
  ok(/if \(sleeveAOn\(project\)\) \{ window\.sleeveAApply\.rederive\(project\)/.test(ui) && /if \(sleeveBOn\(project\)\) \{ window\.sleeveBApply\.rederive\(project\)/.test(ui) && /if \(sleeveCOn\(project\)\) \{ window\.sleeveCApply\.rederive\(project\); relayoutSleeve\(\); return; \}/.test(ui), "7: refreshSleeve 훅에 Ⓐ·Ⓑ·Ⓒ 재제도");
  ok(/clearOtherSleeveLines\(project, "C"\);\s*\/\/ 기본\/Ⓐ\/Ⓑ\/Ⓒ 배타/.test(ui) && /function clearOtherSleeveLines\(project, keep\)/.test(ui) && /keep !== "A"[^;]*sleeveAApply\.clear/.test(ui) && /keep !== "B"[^;]*sleeveBApply\.clear/.test(ui) && /keep !== "C"[^;]*sleeveCApply\.clear/.test(ui), "7: 적용 성공 시 상대 라인 해제(기본/Ⓐ/Ⓑ/Ⓒ 배타)");
  ok(/function readElbow\(\)/.test(ui) && /raw === ""\) return \{ v: null, valid: false/.test(ui) && /sleeveCApply\.reject\(project/.test(ui), "7: EL 읽기는 빈 값 거부 · Ⓒ 켜진 상태의 잘못된 입력은 reject(차단 표시)");
  ok(/function deriveSleeve\(project, lower, cap\)/.test(ui) && /computeSilhouette\(project\.referenceGeometry/.test(ui), "7: 기존 소매 파생 경로 보존");
  ok(!/\.innerHTML\s*=/.test(ui.slice(ui.indexOf("function sleeveCOn"), ui.indexOf("function applySleeveB"))), "7: 새 UI 함수는 innerHTML 재생성을 쓰지 않는다");
  ok(!/sleeveCApply\.[a-z]+\(project\.working/.test(ui), "7: ui.js 는 sleeveCApply 를 통해서만 상태를 쓴다");
  const sc = fs.readFileSync(path.join(ROOT, "js", "sleeveCApply.js"), "utf8");
  ok(!/document\.|localStorage|sessionStorage/.test(sc) && !/bodiceResult\s*=[^=]/.test(sc) && !/working\.sleeve[AB]\s*=|\.sleeve[AB]\s*=[^=]/.test(sc.replace(/\/\/.*$/gm, "")), "7: sleeveCApply 는 DOM·storage 미접근 · 몸판/Ⓐ/Ⓑ 상태를 쓰지 않는다");
  const rr = fs.readFileSync(path.join(ROOT, "js", "designRenderer.js"), "utf8") + fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  ok(!/sleeveC|\.rigid\b|meta\.rigid|meta\.fairing/.test(rr), "7: 렌더러는 Ⓒ meta/rigid/fairing 을 참조하지 않는다");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
