// ══════════════════════════════════════════════
// designCuffCheck.js — 소매 Ⓐ + 커프스(한 장 접기) + 트임 ④ 덧단(P.91 · 김님 확정 2026-11-10) 회귀. 실제 모듈 전부(스텁 없음).
//
//   (1) 기본값(손목 16 · 여밈 2 · 여유 2 · 폭 3 · 소매 52): 본체 49 + 커프스 3 · 가로 20 · 잠근 둘레 18 · 달림 20 · 펼친 폭 6 ·
//       셔링 = 소맷부리 실측 − 달림(독립 실측) · 트임 10 · 뒤 반폭 1/2 · 덧단 폭 2 · 뾰족 끝 1.
//   (2) 입력 sweep: 성공하면 불변식 성립, 실패하면 정해진 사유만.
//   (3) 불가능 값 거부(자동 보정 없음) — 상태 무변경.
//   (4) 커프스 OFF = HEAD 코드와 상태·완료본·hash 바이트 동일.
//   (5) 완료본: inputs·cuff(출처·geometry·길이)·서명 결속, 동결, designResult 포함, 변경 감지(손목·폭·트임·소매길이), 원본 0 변경.
//   (6) 위조 상태(cuff 길이 변조)는 완료 거부 · JSON 왕복(파일 저장·열기와 같은 직렬화) 뒤 같은 완료 상태.
//   (7) 레이아웃·선 도구: 커프스는 geometry.sleeve 밖 — 소매 hit bbox 불변, 표시 범위(displayExtents)에는 포함.
//   node test/harness/designCuffCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const MODS = ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js",
  "designSleeveA.js", "sleevePresets.js", "designCuff.js", "sleeveAApply.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"];
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REFSLEEVE = () => {
  const cap = { kind: "path", commands: [{ type: "M", points: [{ x: 5.53, y: 66.42 }] }, { type: "C", points: [{ x: 12, y: 56 }, { x: 18, y: 53 }, { x: 23.75, y: 53 }] }, { type: "C", points: [{ x: 29.5, y: 53 }, { x: 34, y: 57 }, { x: 39.29, y: 66.42 }] }] };
  const line = (a, b) => ({ kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } });
  return { outline: [cap, line([5.53, 66.42], [7.56, 105]), line([39.29, 66.42], [37.56, 105]), line([7.56, 105], [37.56, 105])], construction: [] };
};

// 모듈 집합(src: 파일명 → 소스)으로 독립 VM 을 만든다. HEAD 비교용으로 같은 절차를 두 번 쓴다.
function makeEnv(src) {
  const env = { PROJECT: null };
  const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
    c2p: (x, y) => [x * 10, y * 10], document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) } };
  sandbox.globalThis = sandbox; vm.createContext(sandbox);
  sandbox.window.designWorkflow = { current: () => env.PROJECT };
  Object.keys(src).forEach(f => vm.runInContext(src[f], sandbox, { filename: f }));
  env.W = sandbox.window; return env;
}
const curSrc = {}; MODS.forEach(f => { curSrc[f] = fs.readFileSync(path.join(ROOT, "js", f), "utf8"); });
const E = makeEnv(curSrc), W = E.W;
const DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SAA = W.sleeveAApply, DCF = W.designCuff,
  DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult, DL = W.designLayout;

function presetOf(env, sym) { for (const f of env.W.bodicePresets.families()) for (const v of f.variants) if (v.symbol === sym) return v.presetId; return null; }
function mkProject(env, sym) {
  const P = { sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: Object.assign(JSON.parse(J(REF)), { sleeve: REFSLEEVE() }),
    working: { geometry: null, parameters: null, patternLines: [], designOutline: null, frontPlacket: null } };
  const body = env.W.bodicePresets.bodyParams(presetOf(env, sym));
  P.working.parameters = { neckline: { mode: "parametric", type: "original", parameters: {} }, body };
  P.working.geometry = env.W.designBodice.computeGeometry(REF, { body });
  env.PROJECT = P; const c = env.W.bodiceCheckpoint.complete(P); if (!c.ok) throw new Error("bodice " + sym);
  return P;
}
const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
function setCollar(P) {
  const b = P.working.bodiceResult, stand = DC.computeStand(b, STAND_P), body = DC.computeBody(stand, BODY_P);
  P.working.collarDraft = { sourceBodiceHash: b.hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
    standGeometry: stand.standGeometry, body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
  P.working.collarResult = null;
}
const deepFrozen = (o) => { if (!o || typeof o !== "object") return true; return Object.isFrozen(o) && Object.keys(o).every(k => deepFrozen(o[k])); };
const near = (a, b, t) => Math.abs(a - b) <= (t || 1e-9);
const cuffDefault = () => DCF.defaults();

// ── 1. 기본값 ──
const P = mkProject(E, "A");
E.PROJECT = P;
const before = { b: J(P.working.bodiceResult), ref: J(P.referenceGeometry), src: J(P.sourceBlock), body: J(P.working.geometry.front) + J(P.working.geometry.back) };
{
  const cf = cuffDefault();
  ok(cf.wristCm === 16 && cf.overlapCm === 2 && cf.easeCm === 2 && cf.widthCm === 3 && cf.construction === "fold-one" && cf.attach === "with-overlap" && cf.includeInSleeveLength === true, "1: 기본값 16/2/2/3 · 한 장 접기 · 방법 A · 커프스 포함 길이");
  ok(cf.vent.type === "placket-pointed" && cf.vent.lengthCm === 10 && cf.vent.placketWidthCm === 2 && cf.vent.tipCm === 1 && cf.vent.position === "back-half-mid", "1: 트임 ④ 덧단 10 · 폭 2 · 끝 1 · 뒤 반폭 1/2");
  const a = SAA.apply(P, { sleeveLengthCm: 52, cuff: cf });
  ok(a.ok, "1: Ⓐ + 커프스 적용 " + (a.text || ""));
  const s = P.working.sleeveA, g = P.working.geometry.sleeve, c = s.cuff, ln = c.lengths;
  ok(s.parameters.sleeveLengthCm === 52 && s.meta.sleeveLengthCm === 49, "1: 입력 52(커프스 포함) → 본체 49");
  const hem = g.outline[3];
  ok(hem.from.y === 49 && hem.to.y === 49, "1: 소맷부리 y = 49");
  const plain = SAA.draft(P, 49);
  ok(plain.ok && J(plain.geometry) === J(g), "1: 본체 = 커프스 없는 Ⓐ 49 와 같은 geometry(Ⓐ 엔진 무변경)");
  ok(ln.cuffLengthCm === 20 && ln.closedCircumferenceCm === 18 && ln.attachLengthCm === 20 && ln.overlapCm === 2 && ln.easeCm === 2, "1: 가로 20 · 잠근 둘레 18 · 달림 20(여밈 포함)");
  ok(ln.finishedWidthCm === 3 && ln.openWidthCm === 6, "1: 완성 폭 3 · 펼친 폭 6");
  const hemLen = Math.hypot(hem.to.x - hem.from.x, hem.to.y - hem.from.y);
  ok(near(ln.sleeveHemCm, hemLen) && near(ln.shirringCm, hemLen - 20), "1: 셔링 = 소맷부리 실측 " + hemLen.toFixed(4) + " − 20 = " + ln.shirringCm.toFixed(4));
  ok(near(hemLen, s.meta.bicepCm, 1e-9), "1: Ⓐ 소맷부리 = 소매폭(P.40 수직 소매 밑선)");
  // 커프스 조각: 독립 폐곡선 4변 · 접는선 · 여밈선
  const o = c.piece.outline, closed = o.every((sg, i) => J(sg.to) === J(o[(i + 1) % o.length].from));
  ok(o.length === 4 && closed, "1: 커프스 = 닫힌 독립 외곽 4변");
  ok(J(o.map(x => x.role)) === J(["attach-edge", "end-overlap", "outer-edge", "end-plain"]), "1: 외곽 역할(소매 달림·여밈 끝·바깥·끝)");
  const fold = c.piece.construction.find(x => x.role === "fold-line"), ovl = c.piece.construction.find(x => x.role === "overlap-line");
  ok(fold && fold.from.y === 3 && fold.to.y === 3 && fold.to.x === 20, "1: 접는선 y = 3(완성 폭)");
  ok(ovl && ovl.from.x === 18 && ovl.to.x === 18 && ovl.to.y === 6, "1: 여밈선 x = 18(가로 − 여밈 2)");
  ok(o[0].from.x === 0 && o[0].to.x === 20 && o[2].from.y === 6, "1: 가로 20 × 펼친 폭 6");
  // 트임
  const v = c.vent, back = hem.from;
  ok(near(v.at.x, back.x / 2) && v.at.y === 49 && near(v.position.fromCenterCm, Math.abs(back.x) / 2) && near(v.position.backHalfCm, Math.abs(back.x)) && v.position.ratio === 0.5, "1: 트임 = 소매 중심→뒤 옆선 1/2(" + v.at.x.toFixed(3) + ")");
  ok(back.x < 0 && v.toCenter === 1, "1: 뒤 = 음의 x · 덧단은 중심 쪽");
  const ys = v.placket.flatMap(sg => [sg.from.y, sg.to.y]), xs = v.placket.flatMap(sg => [sg.from.x, sg.to.x]);
  ok(near(Math.min(...ys), 39) && near(Math.max(...ys), 49), "1: 덧단 소맷부리 → 끝 10");
  ok(near(Math.max(...xs) - Math.min(...xs), 2) && near(Math.min(...xs), v.at.x), "1: 덧단 폭 2(트임선에서 중심 쪽)");
  ok(v.placket.filter(x => x.role === "placket-tip").every(sg => near(Math.min(sg.from.y, sg.to.y), 39) && near(Math.max(sg.from.y, sg.to.y), 40)), "1: 뾰족 끝 높이 1");
  ok(v.slitEnd === null, "1: 가위집 끝은 지어내지 않는다(책 표기 없음)");
  ok(c.source.page === 91 && c.source.method === "placket-pointed(④)" && c.source.attachMethod === "A", "1: 출처 P.91 ④ · 방법 A");
  ok(J(c.inputs) === J(cf) && J(s.parameters.cuff) === J(cf), "1: 입력 보존");
  const info = SAA.infoLines(P).join("\n");
  ok(/가로 20\.00 = 손목 16\.00\(책 참고값 P\.8 · 실측 아님\) \+ 여밈 2\.00 \+ 여유 2\.00/.test(info) && /잠근 둘레 18\.00/.test(info) && /소매 달림 20\.00\(여밈 포함/.test(info), "1: 정보 줄 — 가로·잠근 둘레·달림 구분");
  ok(/52\.00\(커프스 포함\) = 본체 49\.00 \+ 커프스 3\.00/.test(info) && /재단 조각: 책에 재단 치수 없음/.test(info), "1: 정보 줄 — 소매길이 분해 · 덧단 조각 미생성 명시");
}

// ── 2. 입력 sweep ──
{
  const REASONS = new Set(["cuff-no-shirring", "cuff-vent-too-long", "cuff-placket-crosses-center", "invalid-sleeve-length", "cuff-body-length-nonpositive"]);
  let n = 0, good = 0, bad = 0, badReason = [];
  for (const len of [30, 45, 52, 60]) for (const wrist of [12, 16, 22, 30]) for (const ov of [1, 2, 3]) for (const ea of [0, 2, 4]) for (const wd of [2, 3, 5]) for (const vl of [5, 10, 25]) for (const pw of [1, 2, 9]) {
    const cf = Object.assign(cuffDefault(), { wristCm: wrist, overlapCm: ov, easeCm: ea, widthCm: wd }); cf.vent = Object.assign({}, cf.vent, { lengthCm: vl, placketWidthCm: pw });
    const d = SAA.draftWith(P, { sleeveLengthCm: len, cuff: cf }); n++;
    if (!d.ok) { bad++; if (!REASONS.has(d.reason)) badReason.push(d.reason); continue; }
    good++;
    const L = d.cuff.lengths, hem = d.sleeve.geometry.outline[3];
    const inv = L.cuffLengthCm === wrist + ov + ea && L.closedCircumferenceCm === wrist + ea && L.attachLengthCm === L.cuffLengthCm && L.openWidthCm === 2 * wd &&
      near(L.shirringCm, Math.hypot(hem.to.x - hem.from.x, 0) - L.attachLengthCm) && L.shirringCm > 0 && d.sleeve.meta.sleeveLengthCm === len - wd &&
      near(d.cuff.vent.at.x, hem.from.x / 2) && d.cuff.vent.lengthCm === vl;
    if (!inv) badReason.push("invariant@" + [len, wrist, ov, ea, wd, vl, pw].join("/"));
  }
  ok(badReason.length === 0, "2: sweep " + n + "건(성공 " + good + " · 거부 " + bad + ") — 불변식·사유 " + badReason.slice(0, 3).join());
  ok(good > 0 && bad > 0, "2: sweep 이 성공·거부 둘 다 포함");
}

// ── 3. 불가능 값 거부(자동 보정 없음 · 상태 무변경) ──
{
  const snap = J(P.working.sleeveA) + J(P.working.geometry.sleeve);
  const mut = (f) => { const c = cuffDefault(); f(c); return c; };
  const cases = [
    ["손목 0", mut(c => c.wristCm = 0), "cuff-invalid-wrist"], ["손목 NaN", mut(c => c.wristCm = NaN), "cuff-invalid-wrist"],
    ["여밈 0", mut(c => c.overlapCm = 0), "cuff-invalid-overlap"], ["여유 −1", mut(c => c.easeCm = -1), "cuff-invalid-ease"],
    ["폭 0", mut(c => c.widthCm = 0), "cuff-invalid-width"], ["두 장", mut(c => c.construction = "two-piece"), "cuff-unsupported-construction"],
    ["방법 B", mut(c => c.attach = "without-overlap"), "cuff-unsupported-attach"], ["기장 미포함", mut(c => c.includeInSleeveLength = false), "cuff-unsupported-length-mode"],
    ["트임 종류", mut(c => c.vent.type = "slash-bias"), "cuff-unsupported-vent"], ["트임 0", mut(c => c.vent.lengthCm = 0), "cuff-invalid-vent-length"],
    ["끝 ≥ 트임", mut(c => c.vent.tipCm = 10), "cuff-invalid-tip"], ["덧단 0", mut(c => c.vent.placketWidthCm = 0), "cuff-invalid-placket-width"],
    ["트임 40", mut(c => c.vent.lengthCm = 40), "cuff-vent-too-long"], ["덧단 9", mut(c => c.vent.placketWidthCm = 9), "cuff-placket-crosses-center"],
    ["손목 40(셔링 없음)", mut(c => c.wristCm = 40), "cuff-no-shirring"]
  ];
  cases.forEach(([nm, cf, why]) => { const r = SAA.apply(P, { sleeveLengthCm: 52, cuff: cf }); ok(!r.ok && r.reason === why && /^커프스: /.test(r.text), "3: 거부 " + nm + " → " + why + " (" + r.reason + ")"); });
  const r0 = SAA.apply(P, { sleeveLengthCm: 3, cuff: cuffDefault() });
  ok(!r0.ok && r0.reason === "cuff-body-length-nonpositive", "3: 소매길이 3 ≤ 폭 → 거부");
  const r1 = SAA.apply(P, { sleeveLengthCm: 12, cuff: cuffDefault() });
  ok(!r1.ok && r1.reason === "invalid-sleeve-length", "3: 본체가 소매산보다 짧음 → Ⓐ 사유 그대로");
  ok(J(P.working.sleeveA) + J(P.working.geometry.sleeve) === snap, "3: 거부는 상태를 바꾸지 않는다");
}

// ── 4. 커프스 OFF = HEAD 코드와 바이트 동일 ──
{
  const headSrc = {}; let headOk = true;
  MODS.filter(f => f !== "designCuff.js").forEach(f => {
    try { headSrc[f] = cp.execSync("git show HEAD:js/" + f, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 }); } catch (e) { headOk = false; }
  });
  ok(headOk, "4: HEAD 모듈 로드");
  if (headOk) {
    const H = makeEnv(headSrc), PH = mkProject(H, "A"), PC = mkProject(E, "A");
    H.PROJECT = PH; const ah = H.W.sleeveAApply.apply(PH, { sleeveLengthCm: 52 });
    E.PROJECT = PC; const ac = SAA.apply(PC, { sleeveLengthCm: 52 });
    ok(ah.ok && ac.ok && J(PH.working.sleeveA) === J(PC.working.sleeveA) && J(PH.working.geometry.sleeve) === J(PC.working.geometry.sleeve), "4: OFF 적용 상태·geometry 동일");
    ok(!("cuff" in PC.working.sleeveA) && J(Object.keys(PC.working.sleeveA.parameters)) === J(["sleeveLengthCm"]), "4: OFF 상태에 cuff 키 없음");
    H.PROJECT = PH; const ch = H.W.sleeveCheckpoint.complete(PH); E.PROJECT = PC; const cc = SC.complete(PC);
    const strip = (r) => { const o = JSON.parse(J(r)); delete o.completedAt; return J(o); };
    ok(ch.ok && cc.ok && ch.result.hash === cc.result.hash && strip(ch.result) === strip(cc.result), "4: OFF 완료본·hash 동일(" + (cc.result && cc.result.hash) + ")");
    H.PROJECT = PH; const hc = H.W.sleeveCheckpoint.isCurrentSleeveChanged(PH); E.PROJECT = PC;
    ok(hc === false && SC.isCurrentSleeveChanged(PC) === false, "4: OFF 변경 판정 동일");
  }
  E.PROJECT = P;
}

// ── 5. 완료본 결속 · 변경 감지 · 원본 0 변경 ──
let RES = null;
{
  E.PROJECT = P;
  ok(SAA.apply(P, { sleeveLengthCm: 52, cuff: cuffDefault() }).ok, "5: 기본 커프스 재적용");
  const c = SC.check(P);
  ok(c.ok, "5: 완료 게이트 통과 " + c.fails.join());
  const r = SC.complete(P); RES = r.result;
  ok(r.ok && RES.cuff && J(RES.inputs) === J({ sleeveLengthCm: 52, cuff: cuffDefault() }), "5: inputs = 소매길이(커프스 포함) + 커프스 입력");
  ok(J(RES.cuff) === J(P.working.sleeveA.cuff) && RES.cuff.piece.outline.length === 4 && RES.cuff.vent.placket.length === 4, "5: 완료본에 독립 커프스 geometry·트임");
  ok(deepFrozen(RES), "5: 완료본 깊은 동결");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 아님");
  ok(J(P.working.bodiceResult) === before.b && J(P.referenceGeometry) === before.ref && J(P.sourceBlock) === before.src && J(P.working.geometry.front) + J(P.working.geometry.back) === before.body, "5: 몸판·원형·몸판 geometry 0 변경");
  // 변경 감지
  const tryChange = (nm, params) => {
    ok(SAA.apply(P, params).ok, "5: 변경 적용 " + nm);
    const changed = SC.isCurrentSleeveChanged(P);
    ok(changed === true, "5: " + nm + " → 소매 변경됨");
    ok(SAA.apply(P, { sleeveLengthCm: 52, cuff: cuffDefault() }).ok && SC.isCurrentSleeveChanged(P) === false, "5: " + nm + " 되돌림 → 변경 아님");
  };
  tryChange("손목 17", { sleeveLengthCm: 52, cuff: Object.assign(cuffDefault(), { wristCm: 17 }) });
  tryChange("여밈 2.5", { sleeveLengthCm: 52, cuff: Object.assign(cuffDefault(), { overlapCm: 2.5 }) });
  tryChange("여유 1.5", { sleeveLengthCm: 52, cuff: Object.assign(cuffDefault(), { easeCm: 1.5 }) });
  tryChange("폭 4", { sleeveLengthCm: 52, cuff: Object.assign(cuffDefault(), { widthCm: 4 }) });
  tryChange("트임 12", { sleeveLengthCm: 52, cuff: (() => { const q = cuffDefault(); q.vent.lengthCm = 12; return q; })() });
  tryChange("소매길이 54", { sleeveLengthCm: 54, cuff: cuffDefault() });
  tryChange("커프스 끔", { sleeveLengthCm: 52 });
  // 같은 입력 재적용 → 같은 hash
  const r2 = SC.complete(P); ok(r2.ok && r2.result.hash === RES.hash, "5: 같은 입력 → 같은 hash");
  // 커프스 OFF 완료본과 hash 다름
  ok(SAA.apply(P, { sleeveLengthCm: 52 }).ok, "5: OFF 적용");
  const off = SC.complete(P); ok(off.ok && off.result.hash !== RES.hash && !off.result.cuff, "5: OFF 완료본은 cuff 없음 · hash 다름");
  ok(SAA.apply(P, { sleeveLengthCm: 52, cuff: cuffDefault() }).ok && SC.complete(P).result.hash === RES.hash, "5: 다시 ON → 같은 hash");
  RES = SC.latest(P);
  // 몸판 재완료(같은 몸판) → rederive 가 커프스 유지
  ok(SAA.rederive(P).ok && P.working.sleeveA.parameters.cuff && J(P.working.sleeveA.cuff) === J(RES.cuff), "5: rederive 가 커프스 입력·결과 유지");
  // Design 통합
  setCollar(P); const cr = CC.complete(P); ok(cr.ok, "5: 카라 완료");
  const dr = DR.complete(P); ok(dr.ok && dr.result.sleeve === SC.latest(P) && dr.result.sleeve.cuff, "5: designResult.sleeve 가 커프스 완료본을 그대로 담음");
  ok(SAA.apply(P, { sleeveLengthCm: 52, cuff: Object.assign(cuffDefault(), { wristCm: 17 }) }).ok && DR.isCurrentDesignChanged(P) === true, "5: 커프스 변경 → Design 변경됨");
  ok(SAA.apply(P, { sleeveLengthCm: 52, cuff: cuffDefault() }).ok && SC.isCurrentSleeveChanged(P) === false && DR.isCurrentDesignChanged(P) === false, "5: 되돌리면 Design 도 현재");
}

// ── 6. 위조 거부 · JSON 왕복 ──
{
  E.PROJECT = P;
  const keep = J(P.working.sleeveA.cuff);
  P.working.sleeveA.cuff.lengths.shirringCm = 99;
  const c = SC.check(P); ok(!c.ok && c.fails.indexOf("cuff-mismatch") >= 0, "6: 변조된 cuff 길이 → cuff-mismatch");
  P.working.sleeveA.cuff = JSON.parse(keep);
  const pc = P.working.sleeveA.parameters.cuff; delete P.working.sleeveA.parameters.cuff;
  const c2 = SC.check(P); ok(!c2.ok, "6: 입력 없이 결과만 있는 cuff → 거부(" + c2.fails.join() + ")");
  P.working.sleeveA.parameters.cuff = pc;
  ok(SC.check(P).ok, "6: 복구 후 통과");
  const Q = JSON.parse(J(P)); E.PROJECT = Q;
  ok(SC.check(Q).ok && SC.isCurrentSleeveChanged(Q) === false && DR.isCurrentDesignChanged(Q) === false, "6: JSON 왕복 뒤 같은 완료 상태(소매·Design 현재)");
  ok(SC.latest(Q).hash === RES.hash && J(Q.working.sleeveResult.cuff) === J(RES.cuff), "6: 왕복 뒤 hash·커프스 동일");
  ok(SAA.apply(Q, { sleeveLengthCm: 52, cuff: Object.assign(cuffDefault(), { easeCm: 3 }) }).ok && SC.isCurrentSleeveChanged(Q) === true, "6: 왕복 뒤 후속 편집 → 변경 감지");
  E.PROJECT = P;
}

// ── 7. 레이아웃·선 도구 경계 ──
{
  E.PROJECT = P;
  const g = P.working.geometry, bb = DL.bboxOf(g, "sleeve");
  ok(J(Object.keys(g.sleeve)) === J(["outline", "construction"]) && !("sleeveCuff" in g), "7: 커프스는 geometry.sleeve·geometry 키에 없다(선 도구·hit 가 소매로 오인하지 않음)");
  const hemY = g.sleeve.outline[3].from.y;
  ok(bb.maxY === hemY, "7: 소매 hit bbox 아래 끝 = 소맷부리(커프스 미포함)");
  const ext = DL.displayExtents ? DL.displayExtents(P) : null;
  const cb = DCF.displayBBox(g.sleeve, P.working.sleeveA.cuff);
  ok(cb && near(cb.minY, hemY + DCF.DISPLAY_GAP_CM) && near(cb.maxY - cb.minY, 6) && near(cb.maxX - cb.minX, 20), "7: 표시 bbox = 소맷부리 아래 · 20 × 6");
  ok(ext && ext.sleeve && ext.sleeve.maxY >= cb.maxY, "7: displayExtents.sleeve 가 커프스를 포함(fit)");
  ok(cb.minX >= bb.minX && cb.maxX <= bb.maxX, "7: 커프스가 소매 가로 범위 안(가로 배치 간격 불변)");
}

console.log("designCuffCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
