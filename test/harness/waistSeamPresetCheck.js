// ══════════════════════════════════════════════
// waistSeamPresetCheck.js — 몸판 프리셋 Ⓜ(허리 이음선, P.26) 연결 회귀.
//
// 실제 모듈(designLineTool·designJoin·designWaistSeam·designBodice·bodicePresets·designLayout·
// designRenderer·bodiceCheckpoint)을 한 vm 에 올려 **프리셋 → computeGeometry → 배치·렌더 → 체크포인트**
// 를 잇는다. 입력은 실제 원형 reference(B83/W64/BL38) fixture.
//   (1) 카탈로그: Ⓜ 만 available+record, N~V 는 blockedBy 를 든 채 보류. preset identity 는 저장하지 않는다.
//   (2) computeGeometry: front/back = upper, frontPeplum/backPeplum + waistSeam 메타. 미적용이면 키 없음.
//   (3) 원자성·입력 불변·결정론.  (4) 4조각 배치가 겹치지 않는다.  (5) 렌더러가 페플럼을 그린다.
//   (6) 체크포인트: 페플럼 보존·hash 반영·스테일 판정, A 복귀 시 사라짐.
//
//   node test/harness/waistSeamPresetCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); }
    else PASS++;
  }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));

// ── vm: 본체와 같은 순서로 로드(designLineTool → designJoin → designWaistSeam → designBodice …) ──
let PROJECT = null;
const els = [];
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: (ns, tag) => { const e = { tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); } }; els.push(e); return e; } }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js"].forEach(load);
sandbox.window.designWorkflow = { current: () => PROJECT };
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const M_FIX = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bodiceMGeometry.json"), "utf8"));
const SNAP = J(REF);

// ── 1. 카탈로그 ──
{
  const F = BP.families(), fam = BP.family("waist-seam");
  const vs = F.flatMap(f => f.variants);
  const avail = vs.filter(v => v.availability === "available").map(v => v.symbol);
  ok(J(avail) === J(["A", "B", "C", "D", "G", "M", "N", "O", "P"]), "1: 실행 가능 = A·B·C·D·G·M·N·O·P");
  const pend = vs.filter(v => v.availability !== "available");
  ok(pend.length === 13 && pend.every(v => v.presetId === null && typeof v.blockedBy === "string" && v.blockedBy.length), "1: Q~V 등 보류 13개는 record 없음·blockedBy 보유");
  ok(["Q", "R", "S", "T", "U", "V"].every(s => pend.some(v => v.symbol === s)), "1: Q~V 계속 보류");
  ok(fam.availability === "available" && fam.variants[0].symbol === "M" && fam.variants[0].presetId === "bunka-bodice-M" && fam.variants[1].presetId === "bunka-bodice-N", "1: 허리 이음선 라인 → Ⓜ·Ⓝ 연결");
  ok(BP.resolve("waist-seam", "bunka-bodice-M").ok && BP.resolve("waist-seam", "bunka-bodice-N").ok && BP.resolve("waist-seam", "bunka-bodice-O").ok && BP.resolve("waist-seam", "bunka-bodice-P").ok && BP.resolve("yoke-seam-1", "bunka-bodice-Q").reason === "bodice-preset-unavailable", "1: Ⓜ·Ⓝ·Ⓞ·Ⓟ 해석 성공·Ⓠ 명시적 거부");
  const body = BP.bodyParams("bunka-bodice-M");
  ok(J(body) === J({ hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistSeam: true }), "1: Ⓜ body = 엉덩이 20 · 옆선 −1.5 · 밑단 +1 · waistSeam");
  ok(!("waistDartScales" in body) && !("flare" in body), "1: Ⓜ 는 다트 배율·플레어를 지정하지 않는다(원형 배율 = 몸판과 같은 분량)");
  ok(BP.get("bunka-bodice-M").source.indexOf("P.26") > 0, "1: 출처 P.26 기록");
  throwsReason(() => BP.validateRecord(Object.assign(clone(BP.get("bunka-bodice-M")), { body: { waistSeam: 1 } })), "invalid-body", "1: waistSeam 은 true 만");
  ok(!("selectedPreset" in body) && Object.keys(body).every(k => BP.fields().some(f => f.key === k)), "1: identity 는 저장 안 함 — body 키는 전부 계약 필드");
}

// ── 2. computeGeometry ──
const M_BODY = BP.bodyParams("bunka-bodice-M");
const G = DB.computeGeometry(REF, { body: M_BODY });
ok(J(REF) === SNAP, "2: reference 불변");
{
  ok(J(Object.keys(G).sort()) === J(["back", "backPeplum", "front", "frontPeplum", "shared", "sleeve", "waistSeam"]), "2: front/back(upper)+frontPeplum/backPeplum+waistSeam+shared+sleeve");
  const plain = DB.computeGeometry(REF, { body: Object.assign({}, M_BODY, { waistSeam: undefined }) });
  ok(!("frontPeplum" in plain) && !("backPeplum" in plain) && !("waistSeam" in plain), "2: 미적용이면 페플럼 키 없음");
  // 합성 일관성: Ⓜ = (같은 body 의 shape 결과) → designWaistSeam.split
  const shaped = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1 } });
  const deq = (a, b) => (typeof a === "number" && typeof b === "number") ? Math.abs(a - b) < 2e-4
    : (a && b && typeof a === "object" && typeof b === "object") ? (Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => deq(a[k], b[k]))) : a === b;
  ok(deq(shaped.front, M_FIX.front) && deq(shaped.back, M_FIX.back), "2: shape 단계 결과 = 얼린 실측 fixture(형상 회귀 없음, 4자리 반올림 허용)");
  const sp = W.designWaistSeam.split({ front: shaped.front, back: shaped.back });
  ok(J(G.front) === J(sp.front) && J(G.back) === J(sp.back) && J(G.frontPeplum) === J(sp.frontPeplum) && J(G.backPeplum) === J(sp.backPeplum), "2: Ⓜ = shape → designWaistSeam.split(재배분 뒤 호출)");
  ok(J(G.shared) === J(shaped.shared) && J(G.sleeve) === J(shaped.sleeve), "2: shared·sleeve 그대로");
  const ids = (p) => (p.construction || []).map(s => s.dart && s.dart.id).filter((v, i, a) => v && a.indexOf(v) === i);
  ok(ids(G.front).indexOf("front-waist-b") < 0 && ids(G.front).indexOf("front-waist-a") >= 0, "2: 앞 upper — b 닫힘·a 유지");
  ok(ids(G.back).indexOf("back-waist-d") < 0 && ids(G.back).indexOf("back-waist-e") >= 0, "2: 뒤 upper — d 닫힘·e 유지(닫힌 흔적 0)");
  ok(!G.front.outline.some(s => s.edge === "hem") && G.frontPeplum.outline.some(s => s.edge === "hem"), "2: 밑단은 페플럼에만");
  ok(G.waistSeam.front.joins.length === 2 && G.waistSeam.back.joins.length === 2, "2: 다트 수만큼 join 메타 보존");
  ok(Math.abs(G.waistSeam.front.waistSeamDeltaCm) < 0.01 && Math.abs(G.waistSeam.back.waistSeamDeltaCm) < 0.01, "2: 허리 이음 길이 정합");
  ok(J(DB.computeGeometry(REF, { body: M_BODY })) === J(G), "2: 결정론");
}

// ── 3. 거부(원자성) ──
{
  const bad = (body, want, nm) => throwsReason(() => DB.computeGeometry(REF, { body }), want, "3: " + nm);
  bad({ waistSeam: true }, "waist-seam-needs-hem", "밑단 없으면 거부");
  bad(Object.assign({}, M_BODY, { flare: true }), "waist-seam-flare-conflict", "플레어와 동시 거부");
  bad(Object.assign({}, M_BODY, { waistSeam: 1 }), "invalid-body-waist-seam", "true 아닌 값 거부");
  // 모듈이 없으면 부분 결과 대신 명시 거부
  const lone = { window: {}, Math, JSON, Object, Array, isFinite, structuredClone, Error };
  lone.globalThis = lone; vm.createContext(lone);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "designBodice.js"), "utf8"), lone);
  throwsReason(() => lone.window.designBodice.computeGeometry(REF, { body: M_BODY }), "designWaistSeam-missing", "3: 연산 모듈 없으면 거부");
  // split 이 실패하면(다트 위치 어긋남 등) 부분 결과 없음
  const brk = clone(REF); brk.front.outline = brk.front.outline.filter(s => s.edge !== "center");
  let r = null; try { r = DB.computeGeometry(brk, { body: M_BODY }); } catch (e) { r = e.reason; }
  ok(typeof r === "string", "3: 형상이 깨지면 예외(부분 geometry 없음): " + r);
  ok(J(REF) === SNAP, "3: 실패해도 입력 불변");
  // 기존 프리셋(A~D·G)은 페플럼을 만들지 않는다
  ["A", "B", "C", "D", "G"].forEach(s => {
    const g = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + s) });
    ok(!("frontPeplum" in g) && !("waistSeam" in g), "3: " + s + " — 페플럼·이음 메타 없음");
  });
}

// ── 4. 4조각 배치 ──
{
  const auto = DL.autoLayout(G);
  ok(!!auto, "4: autoLayout 결과");
  const box = (k) => {
    const bb = DL.outlineBBoxOf(G, k), o = auto[k];
    return { minX: bb.minX + o.dx, maxX: bb.maxX + o.dx, minY: bb.minY + o.dy, maxY: bb.maxY + o.dy };
  };
  const rects = (k) => {                // 한 벌 = upper + 페플럼(표시 내림 반영)
    const host = DL.outlineBBoxOf({ front: G[k], back: { outline: [], construction: [] } }, "front"), o = auto[k];
    const pk = k + "Peplum", pp = DL.peplumDisplayPiece(G, pk), pts = [];
    pp.outline.forEach(p => { (p.commands ? p.commands.flatMap(c => c.points) : [p.from, p.to]).forEach(q => pts.push(q)); });
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    return [
      { name: k + "-upper", minX: host.minX + o.dx, maxX: host.maxX + o.dx, minY: host.minY + o.dy, maxY: host.maxY + o.dy },
      { name: pk, minX: Math.min(...xs) + o.dx, maxX: Math.max(...xs) + o.dx, minY: Math.min(...ys) + o.dy, maxY: Math.max(...ys) + o.dy }
    ];
  };
  const all = rects("front").concat(rects("back"));
  let overlap = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    if (a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY) { overlap++; fails.push("4: 겹침 " + a.name + " × " + b.name); FAIL++; }
  }
  ok(overlap === 0, "4: 앞·뒤 upper 와 페플럼 4조각이 서로 겹치지 않는다");
  ok(all.length === 4, "4: 4조각");
  ok(DL.peplumDrop(G, "frontPeplum") > 0 && DL.peplumDrop(G, "backPeplum") > 0, "4: 페플럼은 허리 아래로 내려 그린다");
  ok(J(DL.autoLayout(G)) === J(auto), "4: 결정론");
  ok(J(G) === J(DB.computeGeometry(REF, { body: M_BODY })), "4: 표시 내림은 geometry 좌표를 바꾸지 않는다");
  // 기존(페플럼 없는) geometry 의 배치는 그대로
  const shaped = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-D") });
  ok(DL.peplumDrop(shaped, "frontPeplum") === 0 && DL.peplumDisplayPiece(shaped, "frontPeplum") === null, "4: 페플럼 없으면 내림 0·표시 조각 없음");
  ok(J(DL.bboxOf(shaped, "front")) === J(DL.bboxOf({ front: shaped.front, shared: shaped.shared }, "front")), "4: 기존 프리셋의 bbox 불변");
}

// ── 5. 렌더러 ──
{
  const pd = (k) => DL.peplumDisplayPiece(G, k);
  const sub = { front: G.front, back: { outline: [], construction: [] }, shared: G.shared, sleeve: { outline: [], construction: [] }, frontPeplum: pd("frontPeplum") };
  els.length = 0;
  const g = DR.createWorkingGroup(sub);
  const pep = g.kids.filter(e => e.attrs["data-piece"] === "frontPeplum");
  ok(pep.length === G.frontPeplum.outline.length && pep.every(e => e.attrs["data-geometry-role"] === "outline"), "5: 페플럼 outline 이 별도 data-piece 로 렌더");
  ok(g.kids.filter(e => e.attrs["data-piece"] === "front").length === G.front.outline.length + G.front.construction.length, "5: upper 는 원래 방식 그대로");
  ok(pep.some(e => e.attrs["data-edge"] === "hem") && pep.some(e => e.attrs["data-edge"] === "waist"), "5: 페플럼 edge(허리·밑단) 검증 통과");
  // 페플럼 없는 geometry(기존)는 그대로 그려진다
  const legacy = { front: G.front, back: G.back, shared: G.shared, sleeve: G.sleeve };
  ok(DR.createWorkingGroup(legacy).kids.every(e => e.attrs["data-piece"] !== "frontPeplum"), "5: 기존 geometry — 페플럼 요소 없음");
  throwsReason(() => DR.createWorkingGroup(Object.assign({}, sub, { frontPeplum: { outline: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, edge: "nope" }], construction: [] } })), "bad-edge", "5: 페플럼 edge 도 검증");
  throwsReason(() => DR.createWorkingGroup(Object.assign({}, sub, { frontPeplum: { outline: 1 } })), "invalid-geometry", "5: 페플럼 형식 검증");
  // 페플럼 자체는 shared 처럼 edge 를 뺀 임의 위치가 아니라 앞/뒤 규칙을 따른다: neckline 등은 outline 만
  ok(sub.frontPeplum !== G.frontPeplum, "5: 표시용 사본(원본 geometry 미변형)");
}

// ── 6. 체크포인트 ──
{
  const mk = (body, geometry) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: geometry || DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  PROJECT = mk(M_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "6: Ⓜ 몸판 검사 통과: " + c.fails.join());
  ok(c.waistSeam && c.waistSeam.ok && c.waistSeam.front.joins === 2 && c.waistSeam.back.joins === 2, "6: 허리 이음 검산(닫힘·join 2·정합) 통과");
  ok(near(c.waistSeam.front.upperSeamCm, c.waistSeam.front.peplumSeamCm, 1e-6) && near(c.waistSeam.back.upperSeamCm, c.waistSeam.back.peplumSeamCm, 1e-6), "6: 상·하 허리 이음 길이 같음");
  ok(c.sideSeam.status === "match", "6: 앞·뒤 옆선 정합(upper 기준)");
  const done = BC.complete(PROJECT);
  ok(done.ok, "6: Ⓜ 몸판 완료");
  const res = BC.latest(PROJECT);
  ok(Object.isFrozen(res) && Object.isFrozen(res.frontPeplum) && Object.isFrozen(res.frontPeplum.outline) && Object.isFrozen(res.waistSeam), "6: bodiceResult 가 페플럼·메타를 동결 보존");
  ok(J(res.frontPeplum.outline) === J(PROJECT.working.geometry.frontPeplum.outline) && res.frontPeplum !== PROJECT.working.geometry.frontPeplum, "6: 페플럼을 복제해 보존(참조 공유 없음)");
  ok(res.front.outline.length === PROJECT.working.geometry.front.outline.length, "6: result.front = upper");
  ok(!BC.isCurrentBodiceChanged(PROJECT), "6: 같은 상태는 스테일 아님");
  // 페플럼만 바뀌어도 hash 가 다르다
  const p2 = mk(M_BODY); p2.working.geometry.backPeplum.outline[0] = clone(p2.working.geometry.backPeplum.outline[0]);
  const seg = p2.working.geometry.backPeplum.outline.find(s => s.kind === "line" && s.edge === "hem");
  seg.to.x += 1; PROJECT = p2;
  ok(BC.isCurrentBodiceChanged(PROJECT) === true, "6: 페플럼 변경도 스테일로 잡는다(완료본 없음 → true)");
  PROJECT = mk(M_BODY); BC.complete(PROJECT);
  PROJECT.working.geometry.backPeplum.outline.find(s => s.kind === "line" && s.edge === "hem").to.x += 1;
  ok(BC.isCurrentBodiceChanged(PROJECT) === true, "6: 완료 뒤 페플럼이 바뀌면 스테일");
  // 페플럼이 열리면 완료 차단
  const p3 = mk(M_BODY); p3.working.geometry.frontPeplum.outline.pop(); PROJECT = p3;
  const c3 = BC.check(PROJECT);
  ok(!c3.ok && c3.fails.indexOf("waist-seam-peplum-open") >= 0 && BC.complete(PROJECT).ok === false, "6: 열린 페플럼은 완료 차단");
  // 이음 길이 불일치는 완료 차단
  const p4 = mk(M_BODY); p4.working.geometry.waistSeam.back.waistSeamDeltaCm = 0.5; PROJECT = p4;
  ok(BC.check(PROJECT).fails.indexOf("waist-seam-mismatch") >= 0, "6: 허리 이음 길이 불일치는 완료 차단");
  // A 복귀 — 페플럼 없음, 기존 hash 계산 경로와 동일
  const A = BP.bodyParams("bunka-bodice-A");
  PROJECT = mk(A);
  const cA = BC.check(PROJECT);
  ok(cA.ok && cA.waistSeam === null, "6: A 복귀 — waistSeam null·검사 통과");
  BC.complete(PROJECT);
  const rA = BC.latest(PROJECT);
  ok(rA.frontPeplum === null && rA.backPeplum === null && rA.waistSeam === null, "6: A 복귀 — 페플럼 보존 필드 null");
  ok(J(BC.latest(PROJECT).front.outline.map(s => s.edge)) === J(PROJECT.working.geometry.front.outline.map(s => s.edge)), "6: A — 몸판 그대로");
  // A 의 hash 는 페플럼 도입 전과 같다(signature 에 pp 키가 없다)
  const a1 = mk(A), a2 = mk(A); PROJECT = a1; BC.complete(PROJECT); const h1 = BC.latest(PROJECT).hash; PROJECT = a2; BC.complete(PROJECT);
  ok(h1 === BC.latest(PROJECT).hash, "6: 페플럼 없는 hash 결정론");
  PROJECT = mk(M_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash !== h1, "6: Ⓜ 와 A 의 hash 가 다르다");
}

// ── 7. 목선 보존 — M 적용 전후 앞·뒤 목선 길이가 같다(소매·카라 소비자 보존 계약) ──
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  const nk = (body) => { PROJECT = mk(body); return BC.check(PROJECT).neckline; };
  const a = nk(BP.bodyParams("bunka-bodice-A")), m = nk(M_BODY);
  ok(a.front > 11 && a.front < 11.2 && a.back > 7.6 && a.back < 7.8, "7: A 목선 = 앞 11.1 · 뒤 7.7cm: " + a.front.toFixed(3) + "/" + a.back.toFixed(3));
  ok(near(m.front, a.front, 1e-9) && near(m.back, a.back, 1e-9), "7: M 적용 뒤 앞·뒤 목선 길이 = A 와 같다(앞이 절반으로 줄던 결함 회귀)");
  ok(near(m.half, a.half, 1e-9) && near(m.finished, a.finished, 1e-9) && near(m.finished, 37.6, 0.1) && near(m.half, 18.8, 0.05), "7: 합계 18.8 · 완성 37.6cm");
  // 의미·형상: 목선 프리미티브가 원래 그대로(쪼개지지 않음)
  const necks = (g, k) => g[k].outline.filter(s => s.edge === "neckline");
  ["front", "back"].forEach(k => {
    const gA = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-A") }), gM = DB.computeGeometry(REF, { body: M_BODY });
    ok(necks(gM, k).length === necks(REF, k).length && necks(gM, k).length === 1, "7: " + k + " 목선은 하나의 프리미티브(edge·boundary 유지)");
    ok(J(necks(gM, k)[0].boundary) === J(necks(gA, k)[0].boundary) && J(necks(gM, k)[0].commands) === J(necks(gA, k)[0].commands), "7: " + k + " 목선 geometry·boundary 가 A 와 동일");
  });
  // 목선 파라미터(necklineLenCm)가 있는 경우도 upper 로 실린다
  const g2 = DB.computeGeometry(REF, { body: M_BODY, neckline: { mode: "parametric", type: "round", parameters: { neckWidthCm: 1, frontDepthCm: 1, backDepthCm: 0 } } });
  const g2A = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-A"), neckline: { mode: "parametric", type: "round", parameters: { neckWidthCm: 1, frontDepthCm: 1, backDepthCm: 0 } } });
  ok(typeof g2.front.necklineLenCm === "number" && g2.front.necklineLenCm === g2A.front.necklineLenCm && g2.back.necklineLenCm === g2A.back.necklineLenCm, "7: necklineLenCm 이 upper 에 그대로 실린다");
}

// ── 8. 잠긴 설계 결정(2026-09-29, 사용자 확정) — 명시 불변식 ──
//   (1) 페플럼 다트는 밑단점을 apex 로 삼아 맞댄다.
//   (2) 몸판 b·d 는 다트 apex 에서 진동 쪽으로 수평 절개해 닫는다.
//
// ★ (1)의 올바른 판정 기준: **분할 직전(원본) 밑단선.** 순차 buttJoin 은 먼저 합친 다트의 조각을
//   강체 회전시키므로, 두 번째 이후 join 을 거친 다트의 apex 는 **최종 합쳐진 페플럼 안에서는
//   회전한 좌표**로 나타난다(그래도 그 조각의 밑단 변과는 정확히 맞물려 있다 — buttJoin 이 강체
//   변환이라 "밑단 위에 있다"는 성질 자체는 보존된다). 따라서 "apex 가 밑단 위"라는 설계는 **자른
//   시점**(아직 어느 join 도 거치지 않은, `designBodice.computeGeometry` 가 만드는 분할 전 조각)
//   기준으로 검증해야 한다 — 그게 이 결정이 실제로 거는 제약이다. 최종 합쳐진 페플럼의 밑단은
//   조각마다 회전 각도가 달라 더 이상 하나의 직선이 아니다(교재의 «완만한 곡선 재작도» 대상 —
//   아직 미구현, docs/STATUS.md 기록).
{
  const shaped = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1 } });
  const t = W.designLineTool;
  const onHemChord = (p, hemSeg) => {
    const vx = hemSeg.to.x - hemSeg.from.x, vy = hemSeg.to.y - hemSeg.from.y, L = Math.hypot(vx, vy);
    const cross = Math.abs((p.x - hemSeg.from.x) * vy - (p.y - hemSeg.from.y) * vx) / L;
    const u = ((p.x - hemSeg.from.x) * vx + (p.y - hemSeg.from.y) * vy) / (L * L);
    return cross < 1e-6 && u > -1e-6 && u < 1 + 1e-6;
  };
  ["front", "back"].forEach(k => {
    const meta = G.waistSeam[k];
    const hemSegs = t.outlinePrimsToSegs(shaped[k].outline).filter(s => s.edge === "hem");
    ok(hemSegs.length === 1 && hemSegs[0].kind === "line", "8: " + k + " 분할 전 밑단은 단일 직선(판정 기준)");
    ok(meta.peplumDarts.length > 0, "8: " + k + " 페플럼 다트 존재");
    meta.peplumDarts.forEach(d => {
      ok(!!d.apex && onHemChord(d.apex, hemSegs[0]), "8: [결정1] " + k + " 페플럼 다트 " + d.id + " 의 apex 가 분할 전 밑단선 위에 있다(밑단점을 apex 로 맞댐)");
    });
    // 결정 1 을 최종 합쳐진 페플럼에서도 확인: 그 조각의 hem 변은 numDarts+1 개로 나뉘고, 각
    // interior 이음점(=다트 apex 의 상)이 인접한 두 hem 세그먼트의 공유 끝점이어야 한다(강체
    // 변환이 "apex 가 자기 조각의 밑단 위에 있다"를 보존한다는 사실 자체를 확인).
    // hem 은 원본 outline 배열 순서로는 ring 끝-처음 wrap 때문에 끊겨 보일 수 있다(예: [7,0,1]) —
    // 공유 끝점으로 다시 이어 붙여 실제 기하 체인 순서를 복원한 뒤 이음점을 검사한다.
    const rawHem = t.outlinePrimsToSegs(G[k + "Peplum"].outline).filter(s => s.edge === "hem");
    ok(rawHem.length === meta.peplumDarts.length + 1, "8: [결정1] " + k + " 최종 페플럼 밑단이 다트 수+1 개 변으로(각 이음점 = 다트 apex)");
    const chainHem = (segs) => {
      const pool = segs.slice(), near2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-4;
      // 체인의 진짜 끝(다른 어느 세그먼트의 끝점과도 안 닿는 쪽)에서 시작한다 — filter 순서는 ring
      // wrap 때문에 임의적이라, 중간 세그먼트에서 출발하면 진짜 체인이어도 헛되이 끊겨 보인다.
      const touchesOther = (p, self) => pool.some(s => s !== self && (near2(s.from, p) || near2(s.to, p)));
      let start = pool.find(s => !touchesOther(s.from, s));
      let startReversed = false;
      if (!start) { start = pool.find(s => !touchesOther(s.to, s)); startReversed = true; }
      if (!start) return null;
      pool.splice(pool.indexOf(start), 1);
      const chain = [startReversed ? { from: start.to, to: start.from } : { from: start.from, to: start.to }];
      while (pool.length) {
        const tail = chain[chain.length - 1].to;
        const i = pool.findIndex(s => near2(s.from, tail) || near2(s.to, tail));
        if (i < 0) return null;
        const s = pool.splice(i, 1)[0];
        chain.push(near2(s.from, tail) ? { from: s.from, to: s.to } : { from: s.to, to: s.from });
      }
      return chain;
    };
    const finalHem = chainHem(rawHem);
    ok(!!finalHem, "8: [결정1] " + k + " 최종 밑단이 하나의 연속 체인으로 이어진다");
    if (finalHem) for (let i = 0; i < finalHem.length - 1; i++) {
      ok(near(finalHem[i].to.x, finalHem[i + 1].from.x, 1e-6) && near(finalHem[i].to.y, finalHem[i + 1].from.y, 1e-6),
        "8: [결정1] " + k + " 최종 밑단 이음점 " + i + " 이 정확히 맞물림(회전해도 apex-on-hem 보존)");
    }

    // (2) 몸판 b/d — 절개선(apex→T)이 수평이고, T 는 apex 에서 진동(옆선) 쪽으로 나아간 점이다.
    //   T 는 곡선(진동) 경계에 스냅되므로(projectOntoRing) 최대 0.05cm 슬랙 안에서 곡선을 따라
    //   미세 이탈할 수 있다 — 그래도 봉제 정밀도(≪1mm)로는 "수평"이다. 1e-3cm 로 판정한다.
    const cd = meta.closedDart;
    ok(!!cd, "8: " + k + " 닫힌 다트(b/d) 메타 존재");
    ok(Math.abs(cd.apex.y - cd.slashEnd.y) < 1e-3, "8: [결정2] " + k + " 절개선(apex→T)이 수평(Δy<0.001cm): " + Math.abs(cd.apex.y - cd.slashEnd.y).toExponential(2));
    const armSegs = t.outlinePrimsToSegs(G[k].outline).filter(s => s.edge === "armhole" || s.edge === "side-seam");
    ok(armSegs.some(s => t.projectOntoSeg(cd.slashEnd, s).dist < 0.05), "8: [결정2] " + k + " 절개선이 진동/옆선 경계에서 끝난다(중심 쪽이 아니다)");
    const centerSeg = t.outlinePrimsToSegs(G[k].outline).find(s => s.edge === "center");
    ok(near(centerSeg.from.x, centerSeg.to.x, 1e-6), "8: " + k + " 중심선은 수직(단일 x)");
    const cx = centerSeg.from.x;
    ok(Math.abs(cd.slashEnd.x - cx) > Math.abs(cd.apex.x - cx), "8: [결정2] " + k + " 절개가 중심에서 멀어지는(진동 쪽) 방향");
  });
  // 결정이 두 조각(앞·뒤) 모두에 같은 규칙으로 적용됨(대칭적 잠긴 규칙, 조각마다 다르게 하지 않는다)
  ok(J(Object.keys(G.waistSeam.front.closedDart).sort()) === J(Object.keys(G.waistSeam.back.closedDart).sort()), "8: 앞·뒤 closedDart 메타 형태 동일(같은 규칙)");
}

// ── 9. 회전된 세그먼트의 stale boundary 수정(2026-09-29) — semantics.issues 가 A 와 같은 빈 배열 ──
//   원인: b/d 를 닫으며 옆쪽 조각을 강체 회전할 때, 회전된 세그먼트가 **회전 전 원본 좌표계의
//   boundary root+t 선언을 그대로** 들고 나가 bodiceCheckpoint 의 dart-attachment 판정이 깨졌다
//   (front-bust 의 mouth 가 우연히 dart-b 의 절개 끝점 T 와 같은 자리라 재현됨). 고정:
//   (a) armhole/side-seam 역할로 회전된 세그먼트는 "<piece>/armhole-splice" 같은 새 identity 로
//       재선언(edge 는 그대로 — armholeLen 등 edge 태그 계측 보존), (b) T'→T 이음선(chord)이
//   원래 root 의 t=trueT 를 그대로 承繼해 그 지점에 닿는 다른 다트(front-bust)의 attach 가 유효하게.
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  const projA = mk(BP.bodyParams("bunka-bodice-A")), projM = mk(M_BODY);
  const semA = BC.check(projA).semantics, semM = BC.check(projM).semantics;
  ok(J(semA.issues) === J([]), "9: A 기준선 자체가 issues 없음(비교 기준 확인)");
  ok(J(semM.issues) === J([]), "9: [수정] M 적용 후 semantics.issues 가 A 와 같은 빈 배열(dart-attachment-misaligned·boundary-identity-missing 모두 사라짐)");
  ok(semM.darts.front.find(d => d.id === "front-bust").attachment === "complete", "9: front-bust attachment complete(회전 안 한 다트가 계속 armhole-lower/upper 에 정확히 닿는다)");
  ok(semM.darts.front.find(d => d.id === "front-waist-a").attachment === "complete"
    && semM.darts.back.find(d => d.id === "back-waist-e").attachment === "complete", "9: 유지된 봉제 허리다트(a·e) attachment 도 complete");
  ok(semM.darts.front.find(d => d.id === "front-side-waist-c").attachment === "complete"
    && semM.darts.back.find(d => d.id === "back-side-waist-c").attachment === "complete", "9: 회전된 옆 다트 c(같은 회전으로 함께 옮겨감) attachment 계속 complete — waist 계열은 relabel 대상 아님");
  // 회전된 armhole 조각은 원래 root 를 더 이상 주장하지 않는다(정직한 새 identity).
  ["front", "back"].forEach(k => {
    const armPrims = projM.working.geometry[k].outline.filter(s => s.edge === "armhole");
    const spliced = armPrims.filter(s => s.boundary && /-splice$/.test(s.boundary.root));
    ok(spliced.length > 0, "9: " + k + " 회전된 armhole 조각이 splice identity 를 받는다");
    ok(spliced.every(s => s.boundary.root === k + "/armhole-splice"), "9: " + k + " splice root 이름이 일관됨");
  });
  // 측정값 보존(목선·허리 이음·진동) — 이번 수정으로 바뀌면 안 된다.
  const cA = BC.check(projA), cM = BC.check(projM);
  ok(near(cM.neckline.front, cA.neckline.front, 1e-6) && near(cM.neckline.back, cA.neckline.back, 1e-6), "9: 목선 보존");
  ok(cM.waistSeam.ok && cM.waistSeam.front.joins === 2 && cM.waistSeam.back.joins === 2
    && Math.abs(cM.waistSeam.front.deltaCm) < 0.01 && Math.abs(cM.waistSeam.back.deltaCm) < 0.01, "9: 허리 이음·페플럼 보존");
  ok(cM.armhole.ok, "9: 진동 계측 보존");
  const done = BC.complete(projM);
  ok(done.ok, "9: 수정 후에도 몸판 완료 정상");
}

console.log(`waistSeamPresetCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
