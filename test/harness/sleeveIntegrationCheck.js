// ══════════════════════════════════════════════
// sleeveIntegrationCheck.js — 소매 Ⓐ~Ⓩ 26종 **통합** 회귀(2026-11-04 통합 점검). 소매별 전용 검사(sleeve*Check·*UICheck·*ResultCheck)를
//   복제하지 않고, 그 검사들이 따로따로는 보지 않는 «같은 조건 · 단계 사이 연결»만 본다:
//   §0 배선 — 카탈로그 26 슬롯 실행 가능 · Apply 모듈 26 · ui.js 배타 해제(clearOtherSleeveLines 원문 실행)가 26종 전부를 끔 · 체크포인트 라인 충돌 26종
//   §1 같은 조건 스윕 — B83/W64/BL38 원형(fixture) · 몸판 Ⓐ 완료 · 각 소매 **자기 기본값**(카탈로그 defaultValue, 없으면 UI 기본 소매길이 52)
//        → 적용 → 소매 완료 · 원본 불변(bodiceResult·referenceGeometry·sourceBlock) · 최종 외곽 폐합·유한·자기교차 없음(이 파일의 독립 점열)
//        · 유형별 cap 의미(일반 = 소매산 실측 · 래글런 = 달림선 · 일체형/덧천 = 적용 안 함 null — 지어내지 않음)
//   §2 소매 완료 → 카라 → designResult — 26종 전부. 소유권: designResult.bodice = 원래 bodiceResult(무변경) · sleeve = 그 소매 완료본 ·
//        Ⓡ~Ⓩ 파생 몸판은 sleeve.derivedBodice 에만(원형·bodiceResult 에 덮어쓰지 않음) · Ⓨ·Ⓩ 소매 조각 없음 · Ⓧ 덧천 한 장 ·
//        목둘레 봉제 길이 보존(파생 몸판 + 소매 목 = 원래 목둘레 — 카라가 원래 bodiceResult 목둘레에 제도돼도 길이 책임이 맞는지) · 26 hash 서로 다름
//   §3 무효화 사슬 — 입력 변경 → 소매 변경 → designResult «변경됨»(기존 결과 보존) · 같은 입력 재적용 → 결정적 복귀 ·
//        파생 형상 변조 → 변경 · 차단(reject) → 완료 불가 · 몸판 교체(Ⓑ) → 소매·카라·designResult 무효 → A–Q 재제도 / R–Z `bodice-not-a` 차단(완료 불가)
//   §4 소매 전환 — ui.js 배타 해제 원문으로 26종 순환 + 대표 교차 전환: 활성 라인 1 · 옛 조각/파생 몸판 잔상 없음(새로 적용한 것과 바이트 동일) · designResult 재완료
//   §5 몸판 호환 경계(측정한 조합만) — 몸판 Ⓐ·Ⓑ·Ⓔ·Ⓖ·Ⓗ·Ⓘ·Ⓜ·Ⓝ: A–Q 적용·완료, R–Z 는 Ⓐ 외 `bodice-not-a` 거부(상태·geometry 무변경)
//   §6 표시·안내 보완 — 계열 전환 뒤 적용 실패 안내(선택 ≠ 활성 → 실제 기호 · 완료 대상 = 활성 소매) · 작은 창 카라 자리 회피(Ⓣ~Ⓩ 설명 글자 · 설명 빠짐 없음)
//   §7 최종 몸판 · 절개선 재검증(2026-11-04 김님 승인 · 정책 변경 — 옛 «obs» 관측을 단언으로 갱신한 이유는 §7 머리말) — 최종 몸판 = sleeveResult.derivedBodice ∥ bodiceResult ·
//        원래에서만 유효한 cut = 사유 있는 완료 거부 · 작성 중 cut = 기존 계약대로 제외 · 복구(수정·삭제)·무효화·소매 전환 재검증
//   node test/harness/sleeveIntegrationCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const ROOT = path.join(__dirname, "..", "..");
const SYMS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DERIVED = "RSTUVWXYZ".split("");
const isDerived = s => DERIVED.indexOf(s) >= 0;

let PROJECT = null;
const sb = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date, c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) } };
sb.globalThis = sb; vm.createContext(sb);
sb.window.designWorkflow = { current: () => PROJECT };
const files = ["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js", "designSleeve.js", "sleeveMeasure.js", "sleeveCheckpoint.js", "sleevePresets.js"];
SYMS.forEach(k => { if (fs.existsSync(path.join(ROOT, "js", "designSleeve" + k + ".js"))) files.push("designSleeve" + k + ".js"); files.push("sleeve" + k + "Apply.js"); });
files.push("sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js");
files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, "js", f), "utf8"), sb, { filename: f }));
// ui.js 의 실제 배타 해제 함수 원문을 꺼내 같은 window 위에서 실행한다(사본을 손으로 다시 쓰지 않는다).
const UI_SRC = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
const CLEAR_SRC = (() => { const i = UI_SRC.indexOf("function clearOtherSleeveLines(project, keep) {"); if (i < 0) return null; const j = UI_SRC.indexOf("\n  }\n", i); return j < 0 ? null : UI_SRC.slice(i, j + 4); })();
if (CLEAR_SRC) vm.runInContext("var window = this.window;\n" + CLEAR_SRC + "\nthis.__clearOtherSleeveLines = clearOtherSleeveLines;", sb, { filename: "ui.js#clearOtherSleeveLines" });
const W = sb.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, SP = W.sleevePresets,
  DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult, DLT = W.designLineTool;
const clearOthers = sb.__clearOtherSleeveLines;
const API = s => W["sleeve" + s + "Apply"];
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const REF_J = J(REF);
const MK = body => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(REF_J),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const bodicePreset = sym => { for (const f of BP.families()) for (const v of f.variants) if (v.symbol === sym && v.presetId) return v.presetId; return null; };
function projectOn(bodiceSym) { PROJECT = MK(BP.bodyParams(bodicePreset(bodiceSym))); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
function setBodice(P, bodiceSym) {   // 같은 프로젝트에서 몸판을 다른 프리셋으로 바꿔 다시 완료(UI «몸판 라인 적용 → 몸판 모양 완료» 와 같은 상태 변화)
  const body = BP.bodyParams(bodicePreset(bodiceSym));
  P.working.parameters.body = body; P.working.geometry = Object.assign({}, DB.computeGeometry(REF, { body }), { sleeve: P.working.geometry.sleeve });
  return BC.complete(P);
}
// 카라: 셔츠 칼라(스탠드 + 본체) — 다른 결과 검사와 같은 기본 매개변수. 원래 bodiceResult 목둘레에서 제도된다.
const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
function setCollar(P) {
  const b = P.working.bodiceResult, stand = DC.computeStand(b, STAND_P), body = DC.computeBody(stand, BODY_P);
  P.working.collarDraft = { sourceBodiceHash: b.hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) },
    standGeometry: stand.standGeometry, body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
  P.working.collarResult = null;
}
// 각 소매 자기 기본값: 카탈로그 defaultValue · 기본값 없는 소매길이 = UI 기본(원형 소매길이 52 — updateSleevePanel 이 넣는 값). 다른 소매의 조건을 강제하지 않는다.
const UI_DEFAULT_LEN = 52;
function defaultsOf(sym) {
  const rec = SP.get("bunka-sleeve-" + sym), o = {};
  rec.inputs.forEach(i => { if (typeof i.defaultValue === "number") o[i.key] = i.defaultValue; else if (i.key === "sleeveLengthCm") o[i.key] = UI_DEFAULT_LEN; });
  return o;
}
function changedOf(sym) {   // 그 소매의 입력 하나만 조금 바꾼 값(소매길이가 있으면 소매길이)
  const p = defaultsOf(sym);
  if (p.sleeveLengthCm !== undefined) p.sleeveLengthCm += (p.sleeveLengthCm < 15 ? 1 : 2);
  else if (p.heightRatio !== undefined) p.heightRatio = 0.3;
  else if (p.spreadCm !== undefined) p.spreadCm = 10;
  return p;
}
const activeLines = P => SYMS.filter(s => !!P.working["sleeve" + s]);

// ── 독립 계측(엔진 코드 미사용) ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cub = (q, t) => { const u = 1 - t; return { x: u * u * u * q[0].x + 3 * u * u * t * q[1].x + 3 * u * t * t * q[2].x + t * t * t * q[3].x, y: u * u * u * q[0].y + 3 * u * u * t * q[1].y + 3 * u * t * t * q[2].y + t * t * t * q[3].y }; };
function cubsOf(s) {
  if (s.kind === "line") return [[s.from, s.from, s.to, s.to]];
  if (s.kind === "cubic") return [[s.from, s.c1, s.c2, s.to]];
  const o = []; let cur = null;
  (s.commands || []).forEach(c => {
    if (c.type === "M") cur = c.points[0];
    else if (c.type === "L") { o.push([cur, cur, c.points[0], c.points[0]]); cur = c.points[0]; }
    else { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }
  });
  return o;
}
const polySeg = (s, n) => { let L = []; cubsOf(s).forEach((q, i) => { const a = []; for (let k = 0; k <= n; k++) a.push(cub(q, k / n)); L = L.concat(a.slice(i ? 1 : 0)); }); return L; };
const plen = p => { let s = 0; for (let i = 1; i < p.length; i++) s += D(p[i - 1], p[i]); return s; };
const segLen = s => plen(polySeg(s, 1500));
function loopOf(segs, n) {   // 조각 점열을 끝점으로 이어 닫는다 → { loop, gap(최대 이음 틈 + 시작·끝 틈) }
  const rest = segs.map(s => polySeg(s, n)); if (!rest.length) return { loop: [], gap: Infinity };
  let out = rest.shift(), gap = 0;
  while (rest.length) {
    const e = out[out.length - 1]; let bi = 0, bd = Infinity, br = false;
    rest.forEach((p, i) => { const a = D(e, p[0]), b = D(e, p[p.length - 1]); if (a < bd) { bd = a; bi = i; br = false; } if (b < bd) { bd = b; bi = i; br = true; } });
    const p = rest.splice(bi, 1)[0]; gap = Math.max(gap, bd); out = out.concat((br ? p.slice().reverse() : p).slice(1));
  }
  return { loop: out, gap: Math.max(gap, D(out[0], out[out.length - 1])) };
}
const segX = (a, b, c, d) => { const o = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x); const e1 = o(c, d, a), e2 = o(c, d, b), e3 = o(a, b, c), e4 = o(a, b, d), k = 1e-9;
  return ((e1 > k && e2 < -k) || (e1 < -k && e2 > k)) && ((e3 > k && e4 < -k) || (e3 < -k && e4 > k)); };
function selfX(L) { const n = L.length - 1; for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (segX(L[i], L[i + 1], L[j], L[j + 1])) return true; } return false; }
const finiteDeep = o => { let f = true; J(o, (k, v) => { if (typeof v === "number" && !isFinite(v)) f = false; return v; }); return f && !/null/.test(J(o)); };
function pieceLoops(g) {   // 소매 geometry → 조각별 외곽(V 두 장 = piece 별 · 그 밖 = 한 조각)
  const segs = (g && g.outline) || []; if (!segs.length) return [];
  if (Array.isArray(g.pieces) && g.pieces.length > 1) return g.pieces.map(pc => ({ name: pc, segs: segs.filter(s => s.piece === pc) }));
  return [{ name: (g.pieces && g.pieces[0]) || "sleeve", segs }];
}
function junctionGaps(segs) {   // 끝점 이음 틈 목록(> 1e-6) — 원래 몸판에서 물려받은 틈인지 대조용
  const E = segs.map(s => { const q = cubsOf(s); return [q[0][0], q[q.length - 1][3]]; }), out = [];
  E.forEach((a, i) => { let best = Infinity; E.forEach((b, j) => { if (i !== j) best = Math.min(best, D(a[1], b[0]), D(a[1], b[1])); }); if (best > 1e-6) out.push(best); });
  return out;
}
// 폐합: 틈 < 1e-4. 단 원래 몸판(bodiceResult)이 이미 가진 이음 틈과 **같은 값**(1e-9 안)만은 물려받은 것으로 본다 — 새 허용 기준을 만들지 않는다
//   (박시 Ⓐ 뒤판: 열린 어깨 다트 입구 1.794 — 다리는 construction 에 있음 · 진동 끝↔옆선 3.56e-4 — 원형 단계 값).
function shapeOk(segs, inherited) {
  const L = loopOf(segs, 24), extra = junctionGaps(segs).filter(g => g >= 1e-4 && !(inherited || []).some(h => Math.abs(h - g) < 1e-9));
  return { closed: L.gap < 1e-4 || (extra.length === 0 && junctionGaps(segs).length > 0), gap: L.gap, selfX: selfX(L.loop), finite: finiteDeep(segs) };
}
const isNeck = s => s.edge === "neckline" || s.role === "neck" || s.role === "neckline";
const neckLen = segs => (segs || []).filter(isNeck).reduce((a, s) => a + segLen(s), 0);

const TT = { t0: Date.now() }; const lap = k => { TT[k] = Date.now(); };
// ── §0 배선 ──
{
  const ids = []; SP.families().forEach(f => (f.variants || []).forEach(v => ids.push(v)));
  const exec = ids.filter(v => /^bunka-sleeve-[A-Z]$/.test(v.id) && v.availability !== "pending-page");
  ok(SYMS.every(s => exec.some(v => v.id === "bunka-sleeve-" + s)) && exec.length === 26, "0: 카탈로그 실행 가능 슬롯 = A~Z 26 (" + exec.length + ")");
  ok(SYMS.every(s => SP.get("bunka-sleeve-" + s) && API(s) && API(s).PRESET_ID === "bunka-sleeve-" + s && typeof API(s).apply === "function" && typeof API(s).clear === "function"),
    "0: 26 Apply 모듈 · PRESET_ID · apply/clear");
  ok(typeof clearOthers === "function", "0: ui.js clearOtherSleeveLines 원문 추출");
  // 배타 해제: 26종을 모두 켠 뒤 keep 하나만 남기는지(26 × 26)
  let exclusive = 0;
  SYMS.forEach(keep => { const P = { working: {} }; SYMS.forEach(s => { P.working["sleeve" + s] = { presetId: "x" }; }); clearOthers(P, keep); if (J(activeLines(P)) === J([keep])) exclusive++; });
  ok(exclusive === 26, "0: ui 배타 해제가 26종 각각에서 나머지 25종을 끈다 (" + exclusive + "/26)");
  // 체크포인트: 두 라인이 동시에 켜지면 어느 조합이든 sleeve-line-conflict(라인 집계 26종 포함)
  let conflict = 0;
  SYMS.forEach(s => { const o = s === "A" ? "Z" : "A"; const P = { working: {} }; P.working["sleeve" + s] = {}; P.working["sleeve" + o] = {}; const c = SC.check(P); if (!c.ok && c.fails[0] === "sleeve-line-conflict") conflict++; });
  ok(conflict === 26, "0: 체크포인트 라인 집계가 26종 전부를 센다 (" + conflict + "/26)");
}

lap("s0");
// ── §1·§2 같은 조건 스윕 + designResult 연결 ──
const SWEEP = {};   // sym → { geometry J, derived J, sleeveHash, designHash, cap }
const ORIG = (() => { const P = projectOn("A"), b = P.working.bodiceResult; return { hash: b.hash, neck: neckLen(b.back.outline) + neckLen(b.front.outline), gaps: { back: junctionGaps(b.back.outline), front: junctionGaps(b.front.outline) } }; })();
SYMS.forEach(sym => {
  const P = projectOn("A"); if (!P) { ok(false, "1 " + sym + ": 몸판 Ⓐ 완료"); return; }
  const before = { b: J(P.working.bodiceResult), ref: J(P.referenceGeometry), src: J(P.sourceBlock) };
  const p = defaultsOf(sym), r = API(sym).apply(P, p);
  ok(r && r.ok, "1 " + sym + ": 기본값 적용 (" + (r && r.reason) + ")"); if (!r || !r.ok) return;
  ok(J(activeLines(P)) === J([sym]), "1 " + sym + ": 활성 라인 = 자기 하나");
  const c = SC.complete(P);
  ok(c.ok, "1 " + sym + ": 소매 완료 (" + (c.reason || "") + ")"); if (!c.ok) return;
  const R = c.result, g = R.geometry;
  ok(R.origin && R.origin.presetId === "bunka-sleeve-" + sym && R.sourceBodiceHash === P.working.bodiceResult.hash, "1 " + sym + ": 출처 preset·몸판 hash");
  ok(J(P.working.bodiceResult) === before.b && J(P.referenceGeometry) === before.ref && J(P.sourceBlock) === before.src && P.working.bodiceResult.hash === ORIG.hash,
    "1 " + sym + ": 원본 불변(bodiceResult·referenceGeometry·sourceBlock)");
  // 최종 외곽(독립 점열)
  const loops = pieceLoops(g);
  if (sym === "Y" || sym === "Z") ok(loops.length === 0 && g.sleevePiece === false, "1 " + sym + ": 별도 소매 조각 없음(빈 버킷 · sleevePiece:false)");
  else if (sym === "X") ok(loops.length === 1 && loops[0].name === "gusset" && loops[0].segs.length === 4, "1 X: 소매 버킷 = 덧천 한 장");
  else if (sym === "V") ok(loops.length === 2 && J(loops.map(l => l.name)) === J(["back", "front"]), "1 V: 두 장 소매(뒤·앞)");
  else ok(loops.length === 1, "1 " + sym + ": 소매 한 장");
  loops.forEach(l => { const s = shapeOk(l.segs); ok(s.closed && !s.selfX && s.finite, "1 " + sym + ": 소매 " + l.name + " 폐합·자기교차 없음·유한 (틈 " + s.gap.toExponential(1) + (s.selfX ? " · 교차" : "") + ")"); });
  if (isDerived(sym)) {
    const db = R.derivedBodice;
    ok(db && db.back && db.front, "1 " + sym + ": 파생 몸판 앞·뒤 = 소매 완료본 소유");
    ["back", "front"].forEach(pc => { const segs = (db[pc] && (db[pc].outline || db[pc])) || []; const s = shapeOk(segs, ORIG.gaps[pc]); ok(segs.length > 0 && s.closed && !s.selfX && s.finite, "1 " + sym + ": 파생 몸판 " + pc + " 폐합·자기교차 없음·유한 (틈 " + s.gap.toExponential(1) + ")"); });
    ok(J(db) === J(P.working["sleeve" + sym].derivedBodice), "1 " + sym + ": 완료본 파생 몸판 = 작업 상태 그대로(복사)");
  } else ok(R.derivedBodice === undefined, "1 " + sym + ": 독립 소매는 파생 몸판 필드 없음");
  // 유형별 cap 의미(지어내지 않는다)
  const cap = R.cap;
  if (sym === "X" || sym === "Y" || sym === "Z") ok(cap.kind === "none-integrated" && cap.applicable === false && cap.lengths === null && cap.ease === null, "1 " + sym + ": 소매산·AH 이세 «적용 안 함»(null)");
  else if (sym === "V" || sym === "W") ok(cap.kind === "raglan-seam" && cap.lengths && isFinite(cap.lengths.total) && cap.lengths.total > 0, "1 " + sym + ": 래글런 달림선 길이 실측");
  else ok(cap.lengths && isFinite(cap.lengths.total) && cap.lengths.total > 0 && cap.ease && isFinite(cap.ease.total), "1 " + sym + ": 소매산 길이·이세 유한");
  // §2 카라 → designResult
  setCollar(P);
  const cc = CC.complete(P); ok(cc.ok, "2 " + sym + ": 카라 완료 (" + (cc.reason || "") + ")");
  const d = DR.complete(P); ok(d.ok, "2 " + sym + ": designResult 완료 (" + (d.reason || "") + ")"); if (!d.ok) return;
  const res = d.result;
  ok(res.bodice === BC.latest(P) && res.bodiceHash === ORIG.hash && J(res.bodice) === before.b, "2 " + sym + ": designResult.bodice = 원래 bodiceResult(파생 몸판으로 덮어쓰지 않음)");
  ok(res.sleeve === SC.latest(P) && res.sleeveHash === R.hash && res.sleeve.origin.presetId === "bunka-sleeve-" + sym, "2 " + sym + ": designResult.sleeve = 이 소매 완료본(출처 보임)");
  ok(res.collar === CC.latest(P) && res.collar.sourceBodiceHash === ORIG.hash, "2 " + sym + ": designResult.collar = 원래 몸판 기준 카라");
  if (isDerived(sym)) {
    const db = res.sleeve.derivedBodice, nk = neckLen(db.back.outline || db.back) + neckLen(db.front.outline || db.front) + neckLen((g && g.outline) || []);
    ok(Math.abs(nk - ORIG.neck) < 1e-3, "2 " + sym + ": 목둘레 봉제 길이 보존 — 파생 몸판 + 소매 목 " + nk.toFixed(4) + " = 원래 " + ORIG.neck.toFixed(4) + "(카라 길이 책임 유지)");
  }
  ok(DR.isCurrentDesignChanged(P) === false && CC.sleeveStepChanged(P) === false, "2 " + sym + ": 완료 직후 «변경됨» 아님");
  SWEEP[sym] = { P, geom: J(g), derived: isDerived(sym) ? J(R.derivedBodice) : null, sleeveHash: R.hash, designHash: res.hash, design: res, cap: cap.lengths ? cap.lengths.total : null };
});
{
  const hs = SYMS.map(s => SWEEP[s] && SWEEP[s].designHash).filter(Boolean), ss = SYMS.map(s => SWEEP[s] && SWEEP[s].sleeveHash).filter(Boolean);
  ok(hs.length === 26 && new Set(hs).size === 26 && new Set(ss).size === 26, "2: 26 소매 → 서로 다른 sleeveHash·designResult.hash (" + new Set(hs).size + ")");
}

lap("s12");
// ── §3 무효화 사슬 ──
SYMS.forEach(sym => {
  const S = SWEEP[sym]; if (!S) return;
  const P = S.P; PROJECT = P;
  const keepDesign = P.working.designResult, keepCollar = P.working.collarResult;
  // ★ Ⓡ~Ⓩ 게이트는 판정마다 같은 입력으로 다시 제도한다(호출당 ~0.1–0.6 s) — 무거운 판정은 한 번씩만 부르고, 거기서 함께 읽는다.
  const heavy = isDerived(sym);
  // (a) 입력 변경 → 소매 변경 → designResult «변경됨»(기존 결과 보존)
  const ra = API(sym).apply(P, changedOf(sym));
  ok(ra && ra.ok, "3 " + sym + ": 입력 변경 적용");
  const dc = DR.check(P);   // 안에서 SC.isCurrentSleeveChanged · CC.sleeveStepChanged 를 부른다
  ok(!dc.ok && dc.fails.indexOf("sleeve-changed") >= 0 && P.working.designResult === keepDesign && P.working.collarResult === keepCollar && CC.invalidatedByBodice(P) === false,
    "3 " + sym + ": 입력 변경 → designResult «변경됨»(sleeve-changed) · 기존 designResult·카라 보존(삭제·조용한 갱신 없음) (" + dc.fails.join(",") + ")");
  if (!heavy) ok(CC.sleeveStepChanged(P) === true && DR.isCurrentDesignChanged(P) === true && DR.complete(P).ok === false && P.working.designResult === keepDesign,
    "3 " + sym + ": 카라 «소매 단계 변경됨»만 · 소매 다시 완료 전 designResult 완료 거부");
  // (b) 같은 기본값 재적용 → 결정적 복귀
  API(sym).apply(P, defaultsOf(sym));
  ok(J(P.working.geometry.sleeve) === S.geom && (!heavy || J(P.working["sleeve" + sym].derivedBodice) === S.derived) && SC.isCurrentSleeveChanged(P) === false,
    "3 " + sym + ": 같은 기본값 재적용 → 형상·파생 몸판·서명 결정적 복귀(«변경됨» 해제)");
  if (!heavy) ok(DR.isCurrentDesignChanged(P) === false, "3 " + sym + ": designResult «변경됨» 해제");
  // (c) 파생 형상 변조 → 변경 (되돌리기 = 같은 값으로 복원 — 다시 제도하지 않는다)
  if (heavy) {
    const st = P.working["sleeve" + sym], segs = st.derivedBodice.front.outline || st.derivedBodice.front, s0 = segs.find(s => s.kind === "line") || segs[0];
    const pt = s0.kind === "line" ? s0.to : s0.commands[s0.commands.length - 1].points[s0.commands[s0.commands.length - 1].points.length - 1];
    const x0 = pt.x; pt.x += 0.25;
    ok(SC.isCurrentSleeveChanged(P) === true, "3 " + sym + ": 파생 몸판 형상 변조 → 소매 «변경됨»(완료본 파생 몸판 서명)");
    pt.x = x0;
    ok(J(st.derivedBodice) === S.derived, "3 " + sym + ": 변조 복원");
  }
  // (e) 몸판 교체(Ⓑ) → 무효 → 재제도/차단
  const bb = setBodice(P, "B");
  ok(bb.ok && P.working.bodiceResult.hash !== ORIG.hash, "3 " + sym + ": 몸판 Ⓑ 로 교체·완료");
  const dcb = DR.check(P);
  ok(SC.invalidatedByBodice(P) === true && CC.invalidatedByBodice(P) === true && !dcb.ok && dcb.fails.indexOf("sleeve-bodice-mismatch") >= 0 && P.working.designResult === keepDesign,
    "3 " + sym + ": 몸판 교체 → 소매·카라 무효 · designResult 완료 불가(기존 보존) (" + dcb.fails.join(",") + ")");
  const rd = API(sym).rederive(P);
  if (heavy) {
    const keepSleeve = P.working.sleeveResult;
    ok(rd.ok === false && rd.reason === "bodice-not-a" && API(sym).isBlocked(P) && SC.complete(P).ok === false && P.working.sleeveResult === keepSleeve,
      "3 " + sym + ": Ⓑ 몸판 → `bodice-not-a` 차단 · 소매 완료 불가(원래 몸판으로 몰래 되돌리지 않음 · 기존 완료본 보존)");
  } else {
    setCollar(P);
    ok(rd.ok && SC.complete(P).ok && CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).bodiceHash === P.working.bodiceResult.hash && DR.latest(P).hash !== S.designHash,
      "3 " + sym + ": Ⓑ 몸판 기준 재제도 → 소매·카라·designResult 다시 완료(새 hash)");
  }
  // 몸판 Ⓐ 로 되돌림 → 재제도 → 원래와 같은 결과
  setBodice(P, "A"); API(sym).rederive(P); setCollar(P);
  ok(SC.complete(P).ok && CC.complete(P).ok && DR.complete(P).ok && DR.latest(P).hash === S.designHash, "3 " + sym + ": 몸판 Ⓐ 복귀 → 원래 designResult hash 재현");
  // (d) 차단(reject) → 완료 불가 — 마지막에(이 프로젝트는 여기서 끝)
  if (typeof API(sym).reject === "function") {
    API(sym).reject(P, { reason: "invalid-input", text: "검사용 차단" });
    const keepSleeve = P.working.sleeveResult, cs = SC.complete(P);
    ok(cs.ok === false && P.working.sleeveResult === keepSleeve, "3 " + sym + ": 차단 상태 → 소매 완료 불가 · 기존 완료본 보존 (" + cs.reason + ")");
  }
});

lap("s3");
// ── §4 소매 전환(ui.js 배타 해제 원문) ──
{
  const P = projectOn("A");
  const order = SYMS.concat(["A", "Z", "A", "X", "V", "Q"]);   // 26종 순환 + 대표 교차(독립↔일체형·덧천↔래글런·래글런↔독립)
  let prev = null;
  order.forEach((sym, i) => {
    const r = API(sym).apply(P, defaultsOf(sym)); if (r.ok) clearOthers(P, sym);
    const tag = "4 " + (prev || "∅") + "→" + sym;
    ok(r.ok && J(activeLines(P)) === J([sym]), tag + ": 활성 라인 1");
    ok(J(P.working.geometry.sleeve) === SWEEP[sym].geom, tag + ": 소매 버킷 = 새로 적용한 형상(옛 조각 잔상 없음)");
    const c = SC.complete(P);
    if (c.ok && !P.working.collarResult) { setCollar(P); CC.complete(P); }   // 카라는 첫 소매 완료 뒤 한 번만(이후 전환은 카라를 다시 완료하지 않는다 — 카라는 몸판에만 종속)
    ok(c.ok && (isDerived(sym) ? J(c.result.derivedBodice) === SWEEP[sym].derived : c.result.derivedBodice === undefined), tag + ": 완료본 파생 몸판 = 이 소매 것만(이전 소매 파생 몸판 없음)");
    const d = DR.complete(P);
    ok(d.ok && d.result.hash === SWEEP[sym].designHash, tag + ": designResult = 같은 조건 단독 결과와 같은 hash");
    prev = sym;
  });
}

lap("s4");
// ── §5 몸판 호환 경계(측정한 조합만 — 지원 확대 아님) ──
const MATRIX = {};
["B", "E", "G", "H", "I", "M", "N"].forEach(bs => {
  MATRIX[bs] = {};
  // A–Q 는 요청 대표(Ⓖ·Ⓗ·Ⓜ·Ⓝ) + 다른 계열 Ⓔ(프린세스)만 — Ⓑ 는 §3 에서 26종 재제도로 이미 쟀다 · Ⓘ 는 R–Z 거부 경계만
  SYMS.filter(sym => isDerived(sym) || "EGHMN".indexOf(bs) >= 0).forEach(sym => {
    const P = projectOn(bs); if (!P) { ok(false, "5 " + bs + ": 몸판 완료"); return; }
    const gBefore = J(P.working.geometry.sleeve), r = API(sym).apply(P, defaultsOf(sym));
    if (isDerived(sym)) {
      ok(!r.ok && r.reason === "bodice-not-a" && !P.working["sleeve" + sym] && J(P.working.geometry.sleeve) === gBefore, "5 " + bs + "×" + sym + ": 사유 있는 거부 `bodice-not-a` · 상태·소매 버킷 무변경");
      MATRIX[bs][sym] = r.ok ? "ok?" : r.reason;
    } else {
      const c = r.ok ? SC.complete(P) : { ok: false, reason: r.reason };
      let dOk = null;
      if (c.ok && "GHMN".indexOf(bs) >= 0) { setCollar(P); dOk = CC.complete(P).ok && DR.complete(P).ok; }
      ok(r.ok && c.ok && dOk !== false, "5 " + bs + "×" + sym + ": 적용·소매 완료" + (dOk === null ? "" : "·designResult") + " (" + (c.reason || "") + ")");
      MATRIX[bs][sym] = c.ok ? "ok" : c.reason;
    }
  });
});

lap("s5");
// §7 최종 몸판 · 절개선 재검증(2026-11-04 김님 승인 «오키오키» — 정책 변경 · designResult.finalBodiceOf / cut-invalid-on-final-bodice)
//   ★ 정책 변경 기록: 이전 «obs» 단언 «원래 몸판에서 유효한 절개선 → Ⓥ designResult.structuralLines 에 포함» 은 승인 전 옛 동작(원래 몸판만 보고
//     파생 몸판 위에 없는 선을 그대로 싣던 것)을 기대했다. 승인된 정책(재단이 읽을 현재 몸판 = 소매까지 반영한 최종 형상 · 그 위에서 재검증 ·
//     맞지 않으면 사유와 함께 완료 거부)으로 같은 선·같은 Ⓥ 를 **더 엄격히** 보도록 갱신했다(삭제·완화 아님). 관측 출력만이던 T~Z 사례도 단언으로 고정.
//   선 3개(모두 몸판 Ⓐ 에서 그린다): 앞 어깨 중점 → 밑단(보고한 사례) · 뒤 어깨 중점 → 밑단 · 앞 작성 중 선(끝이 외곽에 닿지 않음 — 원래·최종 모두 무효)
const CUT_RES = [];
{
  const ends = s => s.kind === "line" ? [s.from, s.to] : [s.commands[0].points[0], s.commands[s.commands.length - 1].points[s.commands[s.commands.length - 1].points.length - 1]];
  const vline = (b, pc, id) => {
    const sh = b[pc].outline.find(s => s.edge === "shoulder"), hem = b[pc].outline.find(s => s.edge === "hem");
    const [s0, s1] = ends(sh), mid = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 }, [h0, h1] = ends(hem), hy = h0.y + (h1.y - h0.y) * ((mid.x - h0.x) / (h1.x - h0.x));
    return { id: id, piece: pc, role: "cut", segments: [{ kind: "line", from: mid, to: { x: mid.x, y: hy } }] };
  };
  const B0 = projectOn("A").working.bodiceResult;
  const LF = vline(B0, "front", "cut-front"), LB = vline(B0, "back", "cut-back");
  // 작성 중 선: 앞 밑단 위 한 점(앞 선과 떨어진 곳)에서 위로 4cm — 끝이 외곽에 닿지 않는다(원래·최종 모두 무효 · 다른 선과 닿지 않게 떨어뜨린다)
  const LD = (() => { const hem = B0.front.outline.find(s => s.edge === "hem"), [h0, h1] = ends(hem), mx = LF.segments[0].from.x;
    let u = 0.25, p = { x: h0.x + (h1.x - h0.x) * u, y: h0.y + (h1.y - h0.y) * u }; if (Math.abs(p.x - mx) < 3) { u = 0.75; p = { x: h0.x + (h1.x - h0.x) * u, y: h0.y + (h1.y - h0.y) * u }; }
    const up = Math.sign(LF.segments[0].from.y - LF.segments[0].to.y) || -1;
    return { id: "cut-draft", piece: "front", role: "cut", segments: [{ kind: "line", from: p, to: { x: p.x, y: p.y + up * 4 } }] }; })();
  const LINES = () => JSON.parse(J([LF, LB, LD]));
  const keyOf = c => c.piece + ":" + J(c.segments);
  { const v = DLT.gatherValidCuts([LF, LB, LD], B0).map(c => c.piece + ":" + J(c.segments)); ok(v.length === 2 && v.indexOf("front:" + J(LF.segments)) >= 0 && v.indexOf("back:" + J(LB.segments)) >= 0, "7: 원래 몸판 Ⓐ 에서 앞·뒤 선은 유효 · 작성 중 선은 무효(전제 · " + v.length + ")"); }
  const done = P => { SC.complete(P); setCollar(P); return CC.complete(P).ok; };
  let refOk = true, draftNeverRejected = true, origUnchanged = true;
  SYMS.forEach(sym => {
    const P = projectOn("A"); P.working.patternLines = LINES();
    const bJ = J(P.working.bodiceResult), rJ = J(P.referenceGeometry);
    API(sym).apply(P, defaultsOf(sym)); const cOk = done(P);
    const c = DR.check(P), fin = c._finalBodice, sres = SC.latest(P);
    // 기대값: 최종 몸판(파생이면 sleeveResult.derivedBodice) 위에서 독립 판정한 유효 목록 · 원래에서만 유효한 선 = 거부
    const finExp = isDerived(sym) ? { front: sres.derivedBodice.front, back: sres.derivedBodice.back } : P.working.bodiceResult;
    const vFin = DLT.gatherValidCuts(P.working.patternLines, finExp).map(keyOf), vOrig = DLT.gatherValidCuts(P.working.patternLines, P.working.bodiceResult).map(keyOf);
    const expRej = vOrig.filter(k => vFin.indexOf(k) < 0);
    const gotRej = (c.cutRejects || []).map(r => r.lineId).sort();
    ok(cOk && fin && fin.source === (isDerived(sym) ? "sleeve-derived" : "bodice"), "7 " + sym + ": 최종 몸판 출처 " + (fin && fin.source));
    if (fin && (fin.front !== finExp.front || fin.back !== finExp.back)) refOk = false;   // 복제 아님(frozen result 의 조각 그대로)
    ok(J(c._cuts.map(keyOf).sort()) === J(vFin.slice().sort()) && gotRej.length === expRej.length && c.ok === (expRej.length === 0), "7 " + sym + ": 유효 " + vFin.length + " · 거부 " + gotRej.join(",") + " · ok=" + c.ok);
    if (gotRej.indexOf("cut-draft") >= 0) draftNeverRejected = false;
    (c.cutRejects || []).forEach(r => ok(typeof r.reason === "string" && r.reason.length > 0 && (r.piece === "front" || r.piece === "back"), "7 " + sym + ": 거부 사유 구체(" + r.lineId + ": " + r.reason + ")"));
    if (!c.ok) {
      const before = P.working.designResult, r = DR.complete(P);
      ok(!r.ok && r.reason === "cut-invalid-on-final-bodice" && P.working.designResult === before, "7 " + sym + ": designResult 완료 거부(기존 완료본 그대로)");
    } else ok(DR.complete(P).ok, "7 " + sym + ": designResult 완료");
    if (J(P.working.bodiceResult) !== bJ || J(P.referenceGeometry) !== rJ) origUnchanged = false;
    CUT_RES.push(sym + ":" + (c.ok ? "ok" : "거부[" + gotRej.join(",") + "]"));
  });
  ok(refOk, "7: finalBodiceOf 는 bodiceResult / sleeveResult.derivedBodice 조각을 그대로 가리킨다(복제·새 권위 없음)");
  ok(draftNeverRejected, "7: 작성 중(원래 몸판에서도 무효) 선은 거부 사유가 되지 않는다(기존 계약 — 제외)");
  ok(origUnchanged, "7: 원형·bodiceResult 불변(26종)");
  // 보고한 사례 고정: 앞 어깨 중점 → 밑단 — Ⓐ~Ⓢ 통과 · Ⓣ~Ⓩ 사유 있는 거부 / 뒤 선은 Ⓣ·Ⓤ(뒤판 원형 그대로 — 뒤 어깨 다트는 construction) 에서 통과
  const res = Object.fromEntries(CUT_RES.map(s => s.split(":")));
  ok("ABCDEFGHIJKLMNOPQ".split("").every(s => res[s] === "ok") && ["R", "S"].every(s => !/cut-front/.test(res[s])), "7: 앞 어깨 중점→밑단 — Ⓐ~Ⓢ 통과(Ⓐ~Ⓠ 는 최종 = 원래 몸판이라 선 전부 통과)");
  ok("TUVWXYZ".split("").every(s => /^거부\[.*cut-front/.test(res[s])), "7: 앞 어깨 중점→밑단 — Ⓣ~Ⓩ 사유 있는 거부");
  ok(["T", "U"].every(s => !/cut-back/.test(res[s])), "7: 뒤 어깨 중점→밑단 — Ⓣ·Ⓤ 는 통과(파생 뒤판 = 원래 뒤판 · 다트 다리 construction 을 같은 외곽 유틸로 읽음)");

  // 복구 · 무효화 · 소매 전환(대표 Ⓣ — 뒤판은 원형 그대로라 «통과 cut + 거부 cut» 이 함께 있는 경우)
  const P = projectOn("A"); API("T").apply(P, defaultsOf("T")); done(P);
  const d0 = DR.complete(P); ok(d0.ok && d0.result.structuralLines.cut.length === 0, "7 복구: 절개선 없이 Design 완료");
  P.working.patternLines = LINES();
  ok(DR.isCurrentDesignChanged(P) === true && DR.check(P).fails.indexOf("cut-invalid-on-final-bodice") >= 0, "7 복구: 맞지 않는 선 추가 → Design 변경됨 + 같은 기준 거부");
  ok(!DR.complete(P).ok && P.working.designResult === d0.result, "7 복구: 거부 시 기존 완료본 그대로(참조 동일)");
  // 사용자 복구 1 — 거부된 선 수정(UI 앵커 이동과 같은 상태 변화 · 엔진은 옮기지 않음): 같은 선 cut-front 의 두 앵커를 원래·파생 앞판에 **함께 있는**
  //   외곽(목둘레 30% 지점 → 같은 x 의 밑단)으로 옮긴다 — 기존 편집 화면의 외곽 snap(원래 몸판 외곽)으로도 닿는 자리.
  const nk = B0.front.outline.find(s => s.edge === "neckline"), nkFlat = DLT.flattenLine(DLT.outlinePrimsToSegs([nk])), np = nkFlat[Math.floor(nkFlat.length * 0.3)][0];
  const hm = B0.front.outline.find(s => s.edge === "hem"), [m0, m1] = ends(hm), my = m0.y + (m1.y - m0.y) * ((np.x - m0.x) / (m1.x - m0.x));
  const pl = P.working.patternLines.find(l => l.id === "cut-front");
  pl.segments[0].from = { x: np.x, y: np.y }; pl.segments[0].to = { x: np.x, y: my };
  const cFix = DR.check(P);
  ok(cFix.ok && cFix._cuts.length === 2 && (cFix.cutRejects || []).length === 0, "7 복구: 거부된 앞 선을 원래·파생 공통 외곽(목둘레 → 밑단)으로 고치면 재검증 통과 · 앞·뒤 2 (" + cFix.fails.join(",") + ")");
  const dFix = DR.complete(P);
  ok(dFix.ok && dFix.result.hash !== d0.result.hash && dFix.result.structuralLines.cut.length === 2 && DR.isCurrentDesignChanged(P) === false, "7 복구: 고친 선으로 재완료(새 hash · 변경 표시 해제)");
  // 사용자 복구 2 — 삭제: 거부 선을 지우면 완료 · hash 는 남은 유효 선 기준 · 변경 표시 해제
  P.working.patternLines = LINES().filter(l => l.id !== "cut-front");
  const d1 = DR.complete(P);
  ok(d1.ok && d1.result.hash !== d0.result.hash && d1.result.structuralLines.cut.length === 1 && d1.result.structuralLines.cut[0].piece === "back" && DR.isCurrentDesignChanged(P) === false, "7 복구: 거부 선 삭제 → 재완료(남은 뒤 선 1 · 새 hash · 변경 표시 해제)");
  P.working.patternLines = [];
  const d2 = DR.complete(P); ok(d2.ok && d2.result.hash === d0.result.hash, "7 복구: 선을 모두 지우면 처음 완료본과 같은 hash(결정적)");
  // 소매 전환 → 새 기준으로 재검증: Ⓣ → Ⓐ(최종 = bodiceResult · 앞 선 통과) → Ⓣ(다시 거부)
  P.working.patternLines = LINES();
  clearOthers(P, "A"); API("A").apply(P, defaultsOf("A")); done(P);
  const cA = DR.check(P);
  ok(cA.ok && cA._finalBodice.source === "bodice" && cA._cuts.length === 2, "7 전환: Ⓣ→Ⓐ — 최종 몸판 = bodiceResult · 앞·뒤 선 통과");
  ok(DR.complete(P).ok, "7 전환: Ⓐ 로 Design 완료");
  API("T").apply(P, defaultsOf("T")); clearOthers(P, "T");
  ok(DR.isCurrentDesignChanged(P) === true, "7 전환: Ⓐ→Ⓣ 적용 직후 Design 변경됨");
  done(P);
  const cT = DR.check(P);
  ok(!cT.ok && cT.fails.indexOf("cut-invalid-on-final-bodice") >= 0 && cT.cutRejects.map(r => r.lineId).join() === "cut-front", "7 전환: Ⓐ→Ⓣ 재완료 후 새 기준(파생 몸판)으로 다시 거부");
}

lap("s7");
// §6 표시·안내 보완(2026-11-04 Codex 1차 검토 — 표시 전용 · geometry/hash/기장/완료 대상 무변경)
//   6a 계열 전환 뒤 적용 실패 안내: 선택 ≠ 활성이면 «선택한 Ⓧ 적용 실패 · 현재 소매 Ⓨ 유지 · 완료 대상 소매 Ⓨ» — ui.js 원문 함수 실행 + 배선 + 실제 완료 대상과 일치
//   6b 작은 창 카라 겹침: 카라를 몸판·소매 아래 줄/오른쪽(designLayout.collarAutoOffset 두 규칙)에 둔 배치에서 Ⓣ~Ⓩ 설명 글자가 카라 자리(+12px)를 밟지 않음 ·
//      설명은 빠지지 않음(카라 몫을 뺀 같은 배치와 비교해 제자리/번호 설명 어디에도 없는 항목 0) · 카라가 없으면 keep-out 은 이전과 같음
{
  const sufSrc = (() => { const i = UI_SRC.indexOf("function sleeveKeptSuffix(selSym, keptSym) {"); if (i < 0) return null; const j = UI_SRC.indexOf("\n  }\n", i); return j < 0 ? null : UI_SRC.slice(i, j + 4); })();
  ok(!!sufSrc, "6a: ui.js sleeveKeptSuffix 원문");
  if (sufSrc) vm.runInContext(sufSrc + "\nthis.__sleeveKeptSuffix = sleeveKeptSuffix;", sb, { filename: "ui.js#sleeveKeptSuffix" });
  const suf = sb.__sleeveKeptSuffix || (() => "");
  ok(suf("Ⓐ", "Ⓩ") === " — 선택한 Ⓐ 적용 실패 · 현재 소매 Ⓩ 유지 · 완료 대상 소매 Ⓩ", "6a: 선택 Ⓐ ≠ 활성 Ⓩ → 실제 기호 안내");
  ok(suf("Ⓩ", "Ⓩ") === "" && suf("", "Ⓩ") === "", "6a: 같은 계열 실패(차단 표시)는 기존 문구 그대로");
  ok(suf("Ⓥ", null) === " — 선택한 Ⓥ 적용 실패 · 현재 원형 소매 기준 유지 · 완료 대상 원형 소매 기준", "6a: 활성 라인 없음 → 원형 소매 기준");
  const a = UI_SRC.indexOf("  function onApplySleevePreset() {"), b = UI_SRC.indexOf("  // Ⓐ 해제 뒤 기존 경로의 소매 형상으로 복원"), body = a > 0 && b > a ? UI_SRC.slice(a, b) : "";
  const branches = body.match(/if \(applySleeve[A-Z]\(project\)\) \{[^\n]*\n/g) || [];
  ok(branches.length === 25 && branches.every(l => /\} else noteSleeveKept\(project, selSym\);\n$/.test(l)), "6a: Ⓑ~Ⓩ 25 분기 전부 실패 시 안내(" + branches.length + ")");
  ok((body.match(/setSleeveNote\([^\n]*\); noteSleeveKept\(project, selSym\); return; \}/g) || []).length === 2, "6a: Ⓐ 경로(소매길이 범위·엔진 차단) 실패 안내 2");
  ok(/const selSym = presetSymbolOfResult\(\{ origin: \{ presetId: r\.presetId \} \}\);/.test(body) && !/clearOtherSleeveLines[^\n]*noteSleeveKept|noteSleeveKept[^\n]*(clear|complete|reject)\(/.test(body), "6a: 안내는 표시만(해제·완료·차단 호출 없음)");
  // 실제 상태: Ⓩ(13) 활성 → Ⓐ(13) 적용 실패 → 활성은 그대로 Ⓩ, «소매 모양 완료» = Ⓩ 완료본(안내의 «완료 대상» 과 일치)
  const P = projectOn("A"), zIn = Object.assign(defaultsOf("Z"), { sleeveLengthCm: 13 });
  const rz = API("Z").apply(P, zIn), ra = API("A").apply(P, { sleeveLengthCm: 13 });
  const act = SYMS.filter(s => API(s).isActive(P));
  const cz = SC.complete(P);
  ok(rz.ok && !ra.ok && act.length === 1 && act[0] === "Z" && cz.ok && cz.result.origin.presetId === "bunka-sleeve-Z", "6a: Ⓩ13 활성에서 Ⓐ13 실패 → 활성 Ⓩ 유지 · 완료본 Ⓩ (" + (ra.reason || "ok") + " · " + act.join("") + ")");

  const SA = W.sleeveAnnotation, DLy = W.designLayout, FSZ = { title: 12, side: 13, note: 8.5 };
  const tbox = (x, y, an, t, f) => { let w = 0; for (const ch of t) w += (ch.charCodeAt(0) > 255 ? 1.0 : 0.58) * f; const x0 = an === "end" ? x - w : an === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85, y1: y + f * 0.2 }; };
  const hitB = (p, q) => p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
  const cover = (m, LY) => { const s = new Set(); LY.items.forEach(it => s.add(String(it.id).replace(/-\d+$/, ""))); LY.legend.forEach(e => { m.lines.forEach(l => { if (l.group === e.group) s.add(l.id); }); m.dims.forEach(d => { if (d.id === e.group) s.add(d.id); }); }); return s; };
  let nCase = 0, nHit = 0, nLost = 0, nKo = 0, noCollarSame = true;
  ["T", "U", "V", "W", "X", "Y", "Z"].forEach(sym => {
    const Q = projectOn("A"); API(sym).apply(Q, defaultsOf(sym));
    const g = Q.working.geometry, L = DLy.autoLayout(g, SA.dolmanExtents(Q));
    Q.working.layout = Object.assign({}, L, { collar: { dx: 0, dy: 0 } });
    const koNo = {}; ["back", "front", "sleeve"].forEach(pc => { koNo[pc] = J(SA.shirtKeepOut(Q, pc, SA.dolmanExtents(Q))); });
    SC.complete(Q); setCollar(Q);
    const cd = Q.working.collarDraft; let cbb = null;
    [cd.standGeometry, cd.body && cd.body.geometry].forEach(gg => { const q = gg && DLy.bboxOfStand(gg); if (q) cbb = cbb ? { minX: Math.min(cbb.minX, q.minX), minY: Math.min(cbb.minY, q.minY), maxX: Math.max(cbb.maxX, q.maxX), maxY: Math.max(cbb.maxY, q.maxY) } : q; });
    let bs = null; ["front", "back", "sleeve"].forEach(k => { const o = DLy.outlineBBoxOf(g, k); if (!o) return; const q = { minX: o.minX + L[k].dx, minY: o.minY + L[k].dy, maxX: o.maxX + L[k].dx, maxY: o.maxY + L[k].dy }; bs = bs ? { minX: Math.min(bs.minX, q.minX), minY: Math.min(bs.minY, q.minY), maxX: Math.max(bs.maxX, q.maxX), maxY: Math.max(bs.maxY, q.maxY) } : q; });
    ["below", "right"].forEach(place => {
      Q.working.layout = Object.assign({}, L, { collar: DLy.collarAutoOffset(bs, cbb, place), placement: { front: "auto", back: "auto", sleeve: "auto", collar: "auto" } });
      const LQ = Q.working.layout, ext = SA.dolmanExtents(Q);
      ["back", "front", "sleeve"].forEach(pc => {
        const ko0 = SA.shirtKeepOut(Q, pc, ext); if (ko0 === null && koNo[pc] === "null") return;   // 그 피스가 없음(Ⓨ·Ⓩ 소매 조각 없음) — 카라 유무와 무관하게 null
        const ko = ko0 || [], col = ko.filter(k => k.piece === "collar");
        if (!(col.length === 1 && col[0].side === "overlap")) nKo++;
        if (J(ko.filter(k => k.piece !== "collar")) !== koNo[pc]) noCollarSame = false;
      });
      const db = SA.dolmanBodice(Q), models = [];
      ["back", "front"].forEach(pc => { if (db && db[pc] && db[pc].anno) models.push([pc, db[pc].anno]); });
      const sm = SA.buildModel(Q, { pieces: true }); if (sm) models.push(["sleeve", sm]);
      [2.4, 3.05, 4, 6].forEach(s => models.forEach(([pc, m]) => {
        nCase++;
        const LY = SA.layout(m, s), cdx = LQ.collar.dx - LQ[pc].dx, cdy = LQ.collar.dy - LQ[pc].dy;
        const cb = { x0: (cbb.minX + cdx) * s - 12, x1: (cbb.maxX + cdx) * s + 12, y0: (cbb.minY + cdy) * s - 12, y1: (cbb.maxY + cdy) * s + 12 };
        LY.items.forEach(it => { if (hitB(tbox(it.at.x * s + it.dx, it.at.y * s + it.dy, it.anchor, it.text, FSZ[it.cls] || 9), cb)) nHit++; });
        const m0 = Object.assign({}, m, { keepOutCm: (m.keepOutCm || []).filter(k => k.piece !== "collar") }), c0 = cover(m0, SA.layout(m0, s)), c1 = cover(m, LY);
        c0.forEach(id => { if (!c1.has(id)) nLost++; });
      }));
    });
  });
  ok(nKo === 0, "6b: 카라 초안이 있으면 keep-out 에 카라 «overlap» 상자 1개(띠 경계로 쓰지 않음) (" + nKo + ")");
  ok(noCollarSame, "6b: 카라 몫을 빼면 keep-out 은 카라가 없을 때와 같음(기존 피스 띠 무변경)");
  ok(nCase === 7 * 2 * 4 * 3 - 2 * 2 * 4 && nHit === 0, "6b: Ⓣ~Ⓩ × 카라 아래/오른쪽 × 배율 4 — 설명 글자가 카라 자리(+12px)에 0 (" + nHit + "/" + nCase + " 모델)");
  ok(nLost === 0, "6b: 카라를 피해도 설명이 빠지지 않음(제자리·번호 설명 어디에도 없는 항목 " + nLost + ")");
}
lap("s6");
console.log("sleeveIntegrationCheck: " + PASS + " passed, " + FAIL + " failed");
console.log("  cap 길이(기본값·몸판 Ⓐ): " + SYMS.map(s => s + "=" + (SWEEP[s] && SWEEP[s].cap !== null ? SWEEP[s].cap.toFixed(2) : "—")).join(" "));
console.log("  몸판 호환(측정): " + Object.keys(MATRIX).map(bs => bs + "[" + SYMS.filter(s => MATRIX[bs][s] === "ok").length + " ok / " + SYMS.filter(s => MATRIX[bs][s] === "bodice-not-a").length + " bodice-not-a]").join(" "));
console.log("  절개선 3개(앞·뒤 어깨 중점→밑단 + 작성 중) — 최종 몸판 재검증: " + CUT_RES.join(" "));
if (process.env.SIC_TIME) console.log("  시간(ms): " + ["s0", "s12", "s3", "s4", "s5", "s7", "s6"].map((k, i, a) => k + "=" + (TT[k] - (i ? TT[a[i - 1]] : TT.t0))).join(" "));
if (FAIL) { fails.slice(0, 40).forEach(f => console.log("  FAIL " + f)); process.exit(1); }
