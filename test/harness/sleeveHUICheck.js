// ══════════════════════════════════════════════
// sleeveHUICheck.js — 소매 Ⓗ(P.44 퍼프, 화면 검토용 시안) 연결 회귀: 카탈로그 · sleeveHApply · 표시 줄 · 완료본 · 제작 정보 · 배선. 엔진은 designSleeveHCheck.
//   node test/harness/sleeveHUICheck.js
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js", "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
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
const SHA = W.sleeveHApply, SH = W.designSleeveH, SGA = W.sleeveGApply, SG = W.designSleeveG, SFA = W.sleeveFApply, SF = W.designSleeveF, SEA = W.sleeveEApply, SE = W.designSleeveE, SDA = W.sleeveDApply, SCA = W.sleeveCApply, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const T = (m, id) => { const l = m.lines.find(x => x.id === id) || m.dims.find(x => x.id === id); return l ? l.text : null; };

const IN = { sleeveLengthCm: 52, elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 };
// ── 1. 카탈로그 ──
{
  const f = SP.family("puff-sleeve");
  ok(f && f.availability === "available" && f.order === 5 && f.variants.map(v => v.id).slice(0, 2).join() === "bunka-sleeve-H,bunka-sleeve-I", "1: 퍼프 소매 = Ⓗ + Ⓘ(실행) · 뒤에 Ⓙ");
  const rec = SP.get("bunka-sleeve-H");
  ok(rec && rec.methodPage === 44 && rec.inputs.map(i => i.key + "=" + (i.defaultValue === undefined ? "" : i.defaultValue)).join() === "sleeveLengthCm=,elbowLengthCm=31.4,palmCircumferenceCm=21,dropCm=3.5" && Object.isFrozen(rec), "1: Ⓗ 레코드 · 김님 기본값");
  ok(SP.resolve("puff-sleeve", "bunka-sleeve-H").ok && SP.family("raglan-sleeve").availability !== "available", "1: resolve Ⓗ · 다음 라인(래글런) 보류 유지 — 셔츠 Ⓣ 는 실행 가능");
}
const P = projectWithBodice("A");
const bodice = P.working.bodiceResult, snap = { bodice: J(bodice), ref: J(P.referenceGeometry) };
// ── 2. 적용 ──
{
  const r = SHA.apply(P, IN), S = P.working.sleeveH, g = P.working.geometry.sleeve;
  const e = SH.draftSleeveH(SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), { elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 });
  ok(r.ok && S.presetId === "bunka-sleeve-H" && J(S.parameters) === J(IN) && J(S.meta) === J(e.meta) && J(g.outline) === J(e.geometry.outline), "2: 적용 — 상태·geometry = 엔진");
  ok(g.construction.map(c => c.role).join() === "center-line,el-line,drop,cut-a-back,cut-a-front,cut-b-inner-back,cut-b-outer-back,cut-b-inner-front,cut-b-outer-front", "2: 표시 construction");
  ok(J(bodice) === snap.bodice && J(P.referenceGeometry) === snap.ref && P.working.sleeveG === undefined && P.working.sleeveResult === undefined, "2: 몸판·원형 불변");
  const Q = projectWithBodice("A"), b = SHA.apply(Q, Object.assign({}, IN, { dropCm: 1 }));
  ok(!b.ok && b.reason === "pieces-overlap" && /기하/.test(b.text), "2: 겹침 조합 거부(사유 문구)");
  PROJECT = P;
}
// ── 3. 표시 줄 ──
{
  const L = SHA.infoLines(P), m = P.working.sleeveH.meta, prim = DS.capPrimitives(P.working.geometry.sleeve), AH = bodice.armholeLengths;
  ok(L.length === 8 && /^퍼프 소매 Ⓗ \(화면 검토용 시안\)/.test(L[0]), "3: 표시 줄 8줄 · 시안 표시");
  ok(L[1] === "커프스 달림 ● = 손바닥 둘레 21.00 + 3 = 24.00 cm · 폭 1.00 cm (치수 정보 — 커프스 조각 없음)", "3: 커프스: " + L[1]);
  ok(/^산식: ■ = Ⓐ 소맷부리 32\.07 − ● = 8\.07 · ∅ = ● − ■ = 15\.93 · 절개마다 ∅\/3 5\.31 \(실제 a 5\.31 · b 뒤 5\.31 · 앞 5\.31\)$/.test(L[2]), "3: 산식·실측: " + L[2]);
  ok(L[3] === "소맷부리(최종 곡선 실측 — 권위값) " + f2(m.hem.lengthCm) + " cm · 여유 산식 2● 48.00 · 개더(실측) " + f2(m.hem.gatherCm) + " cm (커프스 ● 대비 ×" + f2(1 + m.hem.gatherRatio) + ") · 이전 8점 곡선 대비 " + sg(m.hem.fair.changeFromPreviousCm), "3: 곡선 실측(권위)·산식 구분·개더·이전 대비: " + L[3]);
  ok(/^소맷부리 truing\(시안\): 원래 모서리 최대 파임 0\.\d\d · 바깥 덧댐 0\.\d\d cm · 파낸 면적 .* · 덧댄 면적 .* cm² · 변곡 0 · 곡률 이음 연속$/.test(L[4]), "3: truing 수치: " + L[4]);
  ok(/^소매길이: 입력 52\.00 · 펼친 중심 SP→소맷부리 55\.\d\d cm/.test(L[6]), "3: 길이 구분: " + L[6]);
  const ee = prim.lengths.total - AH.front - AH.back;
  ok(L[7].indexOf("이세(실측) 총 " + sg(ee)) > 0 && /소맷부리 개더와 별개/.test(L[7]), "3: 이세 = 소매산 실측(개더와 별개)");
}
// ── 4. 차단·배타 ──
{
  const Q = projectWithBodice("A"); SHA.apply(Q, IN);
  ok(SHA.reject(Q, { reason: "invalid-drop", text: "x" }) && SHA.isBlocked(Q) && SC.check(Q).fails.indexOf("sleeve-h-blocked") >= 0, "4: 차단 중 완료 불가");
  ok(SHA.rederive(Q).ok && !SHA.isBlocked(Q) && J(Q.working.sleeveH.parameters) === J(IN), "4: rederive(입력 유지 = 재제도 복원)");
  SGA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 });
  ok(SC.check(Q).fails[0] === "sleeve-line-conflict", "4: Ⓖ·Ⓗ 동시 → 충돌(ui 가 배타 해제)");
  SHA.clear(Q); ok(!SHA.isActive(Q), "4: clear");
  PROJECT = P;
}
// ── 5. 완료본(세션 저장) ──
{
  const c = SC.check(P);
  ok(c.ok && c.preset === "bunka-sleeve-H", "5: 게이트 통과 " + J(c.fails));
  const r = SC.complete(P), R = r.result;
  ok(r.ok && R.origin.presetId === "bunka-sleeve-H" && R.origin.methodPage === 44 && J(R.inputs) === J(IN) && Object.isFrozen(R) && R.meta.hem.status.indexOf("시안") >= 0, "5: 완료본 origin·inputs·동결·시안 표시");
  const prim = DS.capPrimitives(R.geometry), AH = bodice.armholeLengths;
  ok(Math.abs(R.cap.ease.total - (prim.lengths.total - AH.front - AH.back)) < 1e-4, "5: cap.ease = 소매산 실측 − AH");
  ok(SC.isCurrentSleeveChanged(P) === false, "5: 완료 직후 변경 없음");
  SHA.apply(P, Object.assign({}, IN, { palmCircumferenceCm: 22 })); ok(SC.isCurrentSleeveChanged(P) === true, "5: 손바닥 변경 → 변경됨");
  const r2 = SC.complete(P); ok(r2.ok && r2.result.hash !== R.hash, "5: 재완료 새 hash");
  SHA.apply(P, IN); SC.complete(P);
  const Q = projectWithBodice("A"); SGA.apply(Q, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }); ok(SC.complete(Q).ok, "5: Ⓖ 완료 경로 유지"); PROJECT = P;
}
// ── 6. 제작 정보 ──
{
  const m = SAN.buildModel(P), M = P.working.sleeveH.meta;
  ok(m && m.line === "H" && /화면 검토용 시안/.test(m.title), "6: Ⓗ 모델 · 시안 표시");
  ok(T(m, "drop") === "★ 3.50" && T(m, "len") === "SP→소맷부리(중심) " + f2(M.centerLength.spreadCm) + " (입력 소매길이 52.00)", "6: ★ · 길이 구분 치수");
  ok(["open-a", "open-b-back", "open-b-front"].every(k => T(m, k) === "∅/3 " + f2(M.formula.perCut)), "6: 벌림 라벨");
  ok(m.zones.some(z => z.id === "fill-center") && m.zones.filter(z => /^wedge-/.test(z.id)).length === 3 && m.marks.filter(x => /^star-/.test(x.id)).length === 2, "6: 덧댐·쐐기 음영 · ☆");
  ok(SAN.layout(m, 10).items.length > 0, "6: 배치");
}
// ── 6″. 원래 종이 조각(책 P.44 «절개 그림» 녹색, 표시 전용) ──
{
  const mOn = SAN.buildModel(P), mOff = SAN.buildModel(P, { pieces: false }), M = P.working.sleeveH.meta, g = P.working.geometry.sleeve;
  const pz = mOn.zones.filter(z => z.cls === "paper");
  ok(pz.map(z => z.id).join() === "paper-upper,paper-backOuter,paper-backInner,paper-frontInner,paper-frontOuter", "6″: 원래 종이 5조각(EL 위 고정 + 아래 4)");
  ok(["backOuter", "backInner", "frontInner", "frontOuter"].every(k => J(pz.find(z => z.id === "paper-" + k).pts) === J(M.rigid[k])), "6″: 아래 4조각 = 엔진 강체 변환 자료(meta.rigid) 그대로");
  const up = pz[0].pts, capC = g.outline.find(s => s.role === "cap").commands, last = capC[capC.length - 1].points[2];
  ok(D(up[0], capC[0].points[0]) < 1e-12 && D(up[up.length - 3], last) < 1e-12 && D(up[up.length - 2], M.sides.front.star) < 1e-12 && D(up[up.length - 1], M.sides.back.star) < 1e-12 && up.every(p => p.y <= M.elY + 1e-9), "6″: EL 위 조각 = 소매산 + 옆선 + EL(EL 아래로 안 내려감)");
  // 원래 밑단(조각 아래변) ≠ 최종 곡선: 조각 아래 모서리는 곡선 끝점과 같고, 아래변 중간은 곡선과 떨어져 있을 수 있다(사실대로)
  const P8 = M.hem.points;
  ok([M.rigid.frontOuter[2], M.rigid.frontOuter[3], M.rigid.backInner[2], M.rigid.backInner[3]].every(c => P8.some(p => D(p, c) < 1e-9)), "6″: 조각 아래 모서리 = 소맷부리 곡선 끝점(절삭·변형 없음)");
  const zi = mOn.zones.findIndex(z => z.cls === "zone"), pi = mOn.zones.map(z => z.cls).lastIndexOf("paper");
  ok(pi < zi && mOn.zones.some(z => z.id === "fill-center") && mOn.zones.filter(z => /^wedge-/.test(z.id)).length === 3, "6″: 틈(덧댄 종이) 음영이 종이 위에 따로");
  ok(/녹색 = 원래 종이/.test(J(mOn.lines)) && /음영 = 벌어진 틈\(덧댄 종이\)/.test(J(mOn.lines)) && /남색 실선 = 최종 재단선/.test(J(mOn.lines)), "6″: 범례(녹색·틈·남색)");
  ok(!mOff.zones.some(z => z.cls === "paper") && mOff.zones.length === mOn.zones.length - 5, "6″: 토글 끔 → 조각 없음");
  const before = J({ g: P.working.geometry, s: P.working.sleeveH, r: P.working.sleeveResult });
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false });
  ok(J({ g: P.working.geometry, s: P.working.sleeveH, r: P.working.sleeveResult }) === before && SC.isCurrentSleeveChanged(P) === false && J(g.outline).indexOf("paper") < 0, "6″: 표시 전용(geometry·상태·hash 불변, 외곽에 없음)");
  const Z = projectWithBodice("A"); SGA.apply(Z, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }); ok(!SAN.buildModel(Z).zones.some(z => z.cls === "paper"), "6″: Ⓗ 외 라인에는 없음"); PROJECT = P;
}
// ── 6′. 벌리기 전 절개 도안(참고, 표시 전용) ──
{
  const SC2 = 10, rm = SAN.refModel(P, SC2), M = P.working.sleeveH.meta, g = P.working.geometry.sleeve;
  ok(rm && rm.key === "sleeveRef" && /벌리기 전 절개 도안\(참고\)/.test(rm.title), "6′: 참고 도안 모델");
  const gx = []; g.outline.forEach(s => (s.kind === "path" ? s.commands.flatMap(c => c.points) : [s.from, s.to]).forEach(q => gx.push(q.x)));
  ok(rm.bbox.minX > Math.max(...gx), "6′: 완성 Ⓗ 오른쪽에 분리(겹치지 않음)");
  const a = SA.draftSleeveA(bodice, { sleeveLengthCm: 52 }), W0 = a.meta.bicepCm;
  ok(Math.abs((rm.bbox.maxX - rm.bbox.minX) - W0) < 1e-9 && Math.abs(rm.bbox.maxY - 52) < 1e-9, "6′: 출발 Ⓐ = 현재 몸판·소매길이(폭 " + W0.toFixed(2) + ")");
  const el = rm.refs.find(r => r.id === "ref-el"), ra = rm.refs.find(r => r.id === "ref-a"), rb = rm.refs.filter(r => /^ref-b-/.test(r.id));
  ok(el && Math.abs(el.from.y - (a.meta.sp.y + 31.4)) < 1e-9 && ra && Math.abs(ra.from.x - (a.meta.sp.x + rm.offsetCm)) < 1e-9 && rb.length === 2 && rm.marks.filter(x => /^ref-star-/.test(x.id)).length === 2, "6′: EL·a·b·☆ 표시");
  const T2 = id => (rm.lines.find(l => l.id === id) || {}).text;
  ok(/★ 3\.50 아래로/.test(T2("ref-block-2")) && /∅\/3 5\.31/.test(T2("ref-block-2")) && /③ 바깥 두 조각을 ☆ 에서 돌려 b 벌림/.test(T2("ref-block-3")) && /재단선 아님/.test(T2("ref-block-4")), "6′: 벌림 순서·참고 표시");
  ok(rm.refs.filter(r => /^ref-outline-/.test(r.id)).every(r => r.cls === "past") && [el, ra].concat(rb).every(r => r.cls === "tick"), "6′: 선 스타일(참고 외곽 점선 · 절개선 가는 실선)");
  // 최신 입력 추종
  const Q = projectWithBodice("A"); SHA.apply(Q, Object.assign({}, IN, { sleeveLengthCm: 56, elbowLengthCm: 28, palmCircumferenceCm: 22, dropCm: 4 }));
  const rq = SAN.refModel(Q, SC2), elq = rq.refs.find(r => r.id === "ref-el");
  ok(Math.abs(rq.bbox.maxY - 56) < 1e-9 && Math.abs(elq.from.y - 28) < 1e-9 && /손바닥 22\.00 · ★ 4\.00/.test(rq.lines.find(l => l.id === "ref-block-1").text), "6′: 입력 변경(SL 56 · EL 28 · 손바닥 22 · ★ 4) 추종");
  PROJECT = P;
  // 다른 라인에서는 없음
  const Z = projectWithBodice("A"); SGA.apply(Z, { sleeveLengthCm: 52, tuckCm: 1.5, starCm: 3 }); ok(SAN.refModel(Z, SC2) === null, "6′: Ⓗ 외 라인 = 참고 도안 없음"); PROJECT = P;
  // 표시 전용: 모델·overhang 계산 전후 geometry·상태·완료본 hash 동일
  const before = J({ g: P.working.geometry, s: P.working.sleeveH, r: P.working.sleeveResult });
  SAN.refModel(P, 5); SAN.refModel(P, 20, { mainVisible: false }); SAN.overhang(P, 10, { info: true, ref: true });
  ok(J({ g: P.working.geometry, s: P.working.sleeveH, r: P.working.sleeveResult }) === before && SC.isCurrentSleeveChanged(P) === false, "6′: 표시 전용(geometry·상태·완료본 hash 불변)");
  const o0 = SAN.overhang(P, SC2, { info: true, ref: false }), o1 = SAN.overhang(P, SC2, { info: true, ref: true });
  ok(o1.right > o0.right + (rm.bbox.maxX - rm.bbox.minX) * SC2 * 0.9, "6′: 화면 맞춤(fit)이 참고 도안을 포함");
  // 글자 겹침: 두 모델의 배치 글자 상자 + 참고 도안 영역이 서로 겹치지 않음(여러 배율)
  const FS = { title: 12, side: 13, note: 8.5 }, fsOf = c => FS[c] || 9, tw = (t, f) => { let w = 0; for (let i = 0; i < t.length; i++) w += (t.charCodeAt(i) > 255 ? 1.0 : 0.58) * f; return w; };
  const boxes = (ly) => ly.items.map(it => { const f = fsOf(it.cls), w = tw(it.text, f), x = it.at.x * ly.scale + it.dx, y = it.at.y * ly.scale + it.dy, x0 = it.anchor === "end" ? x - w : it.anchor === "middle" ? x - w / 2 : x; return { x0, x1: x0 + w, y0: y - f * 0.85, y1: y + f * 0.2, t: it.text }; });
  const hit = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;
  let clash = [];
  [6, 10, 16].forEach(sc => {
    const mm = SAN.buildModel(P), r2 = SAN.refModel(P, sc), lyM = SAN.layout(mm, sc), lyR = SAN.layout(r2, sc);
    const bm = boxes(lyM), br = boxes(lyR), area = { x0: r2.bbox.minX * sc, x1: r2.bbox.maxX * sc, y0: r2.bbox.minY * sc, y1: r2.bbox.maxY * sc };
    bm.forEach(b => { if (hit(b, area)) clash.push(sc + ":main-over-ref:" + b.t.slice(0, 12)); br.forEach(c => { if (hit(b, c)) clash.push(sc + ":" + b.t.slice(0, 10) + "|" + c.t.slice(0, 10)); }); });
  });
  ok(!clash.length, "6′: 설명 글자와 참고 도안 겹침 없음(배율 6·10·16) " + clash.slice(0, 3).join(" "));
}
// ── 7. 배선 ──
{
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), ui = fs.readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const pos = f => html.indexOf('src="js/' + f);
  ok(pos("designSleeveH.js") > pos("sleeveGApply.js") && pos("sleeveHApply.js") > pos("designSleeveH.js") && pos("ui.js") > pos("sleeveHApply.js"), "7: 스크립트 순서");
  const ver = f => (html.match(new RegExp('src="js/' + f.replace(".", "\\.") + '\\?v=(\\d+)"')) || [])[1];
  ok((["sleevePresets.js"].every(f => ver(f) === "2026102911") && ver("sleeveCheckpoint.js") === "2026102911") && (["render.js"].every(f => ver(f) === "2026102906") && ver("ui.js") === "2026102911") && (["designSleeveH.js"].every(f => ver(f) === "2026101302") && ver("sleeveHApply.js") === "2026102802") && ver("sleeveAnnotation.js") === "2026102911", "7: 캐시 버전(소맷부리 truing 2026101301)");
  ok(/id="rowSleeveHRef" hidden><label><input type="checkbox" id="chkSleeveHRef"> 비교: 벌리기 전 도안\(참고\)/.test(html) && /chkSleeveHRef/.test(fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8")), "7: 비교용 벌리기 전 도안 토글(기본 꺼짐 — 의도 정정) · render 연결");
  ok(/id="rowSleeveHPieces" hidden><label><input type="checkbox" id="chkSleeveHPieces" checked> 원래 종이 조각\(녹색\)/.test(html) && /chkSleeveHPieces/.test(fs.readFileSync(path.join(ROOT, "js", "render.js"), "utf8")) && /\.sleeve-anno-paper\{/.test(fs.readFileSync(path.join(ROOT, "css", "style.css"), "utf8")), "7: 원래 종이 조각 토글(기본 켜짐) · render · css");
  ok(/id="rowSleeveHPalm" hidden/.test(html) && /id="inpSleeveHPalm" type="number" min="0\.1" step="0\.1" value="21"/.test(html) && /id="inpSleeveDrop" type="number" min="0\.1" step="0\.1" value="3\.5"/.test(html), "7: 손바닥(21)·★(3.5) 입력 행");
  ok(/function sleeveHOn\(project\)/.test(ui) && /keep !== "H" && window\.sleeveHApply/.test(ui) && /if \(isH\) \{/.test(ui) && /window\.sleeveHApply\.rederive\(project\)/.test(ui) && /"inpSleeveHPalm", "inpSleeveDrop"(, "inpSleeveRise")?(, "inpSleeveUpperArm")?\]\.forEach/.test(ui) && /rec\.id !== "bunka-sleeve-H"/.test(ui), "7: ui 배선 · Ⓑ 손바닥 행과 분리");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
