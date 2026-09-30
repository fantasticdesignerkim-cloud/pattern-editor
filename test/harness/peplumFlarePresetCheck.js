// ══════════════════════════════════════════════
// peplumFlarePresetCheck.js — 몸판 프리셋 Ⓝ(허리 이음선 + 페플럼 플레어, P.27 · 처리 방법 158 P.158) 회귀.
//
// 사용자 확정 해석(2026-09-29):
//   1) ●+■ = 맞댄 뒤 앞·뒤 페플럼 **각각의 완성 허리길이**.
//   2) 플레어 총량 ∅ = ●+■ × 0.9 − 1 (−1cm 는 계산값에서 차감).
//   3) 각 절개는 **허리선의 입 점을 고정**하고 밑단 끝을 ∅/절개수 씩 균등하게 벌린다(교재 도해 2곳 각 ∅/2).
//   4) 교재의 «약 5cm» 는 고정값이 아니라 참고 결과 — 우리 값은 계산이 정한다.
//   5) 밑단 fairing(접선 연속 곡선)까지가 Ⓝ 범위.
//
//   (1) 카탈로그·레코드  (2) 몸판은 Ⓜ 과 동일  (3) 플레어 산식·균등 분배·고정점·허리 이음 정합
//   (4) 물리(폐곡선·자기교차 없음·면적·G1 밑단)  (5) 원자적 거부  (6) 4조각 배치  (7) 렌더
//   (8) 체크포인트(완료·검산·stale)  (9) 소비자(목선·소매·카라 입력) 불변
//
//   node test/harness/peplumFlarePresetCheck.js
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
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const M_BODY = BP.bodyParams("bunka-bodice-M"), N_BODY = BP.bodyParams("bunka-bodice-N");
const GM = DB.computeGeometry(REF, { body: M_BODY });
const GN = DB.computeGeometry(REF, { body: N_BODY });

// ── 유틸: 평탄화·면적·자기교차·접선 ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const flatSegs = (outline) => { const out = []; T.outlinePrimsToSegs(outline).forEach(s => T.flattenLine([s]).forEach(ab => out.push(ab))); return out; };
function area(outline) {
  const pts = []; flatSegs(outline).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); });
  let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a / 2);
}
function selfIntersects(outline) {
  const e = flatSegs(outline);
  const o = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) {
    const [a, b] = e[i], [c, d] = e[j];
    if ([a, b].some(p => [c, d].some(q => D(p, q) < 1e-6))) continue;
    if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return true;
  }
  return false;
}
const closedRing = (outline) => { const s = T.outlinePrimsToSegs(outline); return s.every((g, i) => D(g.to, s[(i + 1) % s.length].from) < 1e-4); };
const unit = (v) => { const l = Math.hypot(v.x, v.y); return { x: v.x / l, y: v.y / l }; };
const ctrl = (s) => s.kind === "cubic" ? [s.from, s.c1, s.c2, s.to] : (s.commands ? s.commands.flatMap(c => c.points) : [s.from, s.to]);
const tanEnd = (s) => { const p = ctrl(s); for (let i = p.length - 2; i >= 0; i--) if (D(p[i], p[p.length - 1]) > 1e-9) return unit({ x: p[p.length - 1].x - p[i].x, y: p[p.length - 1].y - p[i].y }); return null; };
const tanStart = (s) => { const p = ctrl(s); for (let i = 1; i < p.length; i++) if (D(p[i], p[0]) > 1e-9) return unit({ x: p[i].x - p[0].x, y: p[i].y - p[0].y }); return null; };
const peplumOf = (G, k) => G[k + "Peplum"];
const wlen = (outline) => T.outlinePrimsToSegs(outline).filter(s => s.edge === "waist").reduce((L, s) => L + T.flattenLine([s]).reduce((t, ab) => t + D(ab[0], ab[1]), 0), 0);

// ── 1. 카탈로그·레코드 ──
{
  const fam = BP.family("waist-seam");
  ok(fam.variants.filter(v => v.availability === "available").map(v => v.symbol).join() === "M,N,O,P", "1: 허리 이음선 = Ⓜ·Ⓝ·Ⓞ·Ⓟ 실행");
  ok(BP.resolve("waist-seam", "bunka-bodice-N").ok && BP.get("bunka-bodice-N").source.indexOf("P.27") > 0 && BP.get("bunka-bodice-N").source.indexOf("P.158") > 0, "1: Ⓝ 해석 성공·출처 P.27·P.158");
  ok(J(N_BODY) === J({ hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1, waistSeam: true, peplumFlare: true }), "1: Ⓝ body = Ⓜ + peplumFlare");
  ok(Object.keys(N_BODY).every(k => BP.fields().some(f => f.key === k)), "1: body 키는 전부 계약 필드");
  ok(BP.variant("yoke-seam-1", "bunka-bodice-R").availability !== "available", "1: R~V 는 계속 보류(Q 는 실행 가능)");
  const rec = clone(BP.get("bunka-bodice-N"));
  throwsReason(() => BP.validateRecord(Object.assign(clone(rec), { body: Object.assign({}, rec.body, { peplumFlare: false }) })), "invalid-body", "1: peplumFlare 는 true 만");
  throwsReason(() => BP.validateRecord(Object.assign(clone(rec), { body: { hemExtensionBelowWaistCm: 20, peplumFlare: true } })), "peplum-flare-needs-waist-seam", "1: waistSeam 없는 peplumFlare 거부");
}

// ── 2. 몸판은 Ⓜ 과 동일하게 보존 ──
{
  ok(J(Object.keys(GN).sort()) === J(Object.keys(GM).sort()), "2: geometry 키 집합 = Ⓜ");
  ok(J(GN.front) === J(GM.front) && J(GN.back) === J(GM.back), "2: 앞·뒤 upper(몸판)가 Ⓜ 과 바이트 동일");
  ok(J(GN.shared) === J(GM.shared) && J(GN.sleeve) === J(GM.sleeve), "2: shared·sleeve 그대로");
  ["front", "back"].forEach(k => {
    const a = GN.waistSeam[k], b = GM.waistSeam[k];
    ok(J(a.closedDart) === J(b.closedDart) && J(a.keptDarts) === J(b.keptDarts) && a.upperWaistSeamCm === b.upperWaistSeamCm, "2: " + k + " 몸판 메타(닫은 다트·유지 다트·허리 이음) = Ⓜ");
    ok(a.joins.length === 2 && a.joins.every(j => j.spread) && b.joins.every(j => !j.spread), "2: " + k + " Ⓝ 은 spread 를 갖고 Ⓜ 은 갖지 않는다");
    ok(a.peplumFlare && !b.peplumFlare, "2: " + k + " 플레어 메타는 Ⓝ 에만");
    ok(J(a.peplumDarts.map(d => d.id)) === J(b.peplumDarts.map(d => d.id)), "2: " + k + " 페플럼 다트 위치(자르는 자리) = Ⓜ");
  });
  ok(J(REF) === SNAP, "2: reference 불변");
  ok(J(DB.computeGeometry(REF, { body: N_BODY })) === J(GN), "2: 결정론");
}

// ── 3. 플레어 산식 · 균등 분배 · 고정점 · 허리 이음 정합 ──
{
  ["front", "back"].forEach(k => {
    const m = GN.waistSeam[k], fl = m.peplumFlare, P = peplumOf(GN, k), PM = peplumOf(GM, k);
    const fin = wlen(P.outline);
    ok(near(fin, wlen(PM.outline), 1e-6), "3: " + k + " 페플럼 완성 허리길이(●+■)는 맞대기만 한 Ⓜ 과 같다(회전이 허리 길이를 안 바꾼다)");
    ok(near(fl.finishedWaistCm, fin, 1e-6), "3: " + k + " 메타의 ●+■ = 실제 완성 허리 " + fin.toFixed(3));
    ok(fl.ratio === 0.9 && fl.subtractCm === 1 && near(fl.totalCm, 0.9 * fin - 1, 1e-9), "3: " + k + " ∅ = (●+■)×0.9−1 = " + fl.totalCm.toFixed(3));
    ok(m.joins.length === 2 && near(fl.perCutChordCm, fl.totalCm / 2, 1e-12), "3: " + k + " 절개 2곳 각 ∅/2 = " + fl.perCutChordCm.toFixed(3));
    ok(m.joins.every(j => near(j.spread.chordCm, fl.perCutChordCm, 1e-12) && near(j.spread.bridgeChordCm, fl.perCutChordCm, 1e-9)), "3: " + k + " 절개마다 밑단 끝 벌림 = ∅/2(균등)");
    ok(near(m.joins.reduce((s, j) => s + j.spread.chordCm, 0), fl.totalCm, 1e-9), "3: " + k + " 벌림 합 = ∅");
    ok(m.joins.every(j => j.spread.angleDeg !== 0 && Math.abs(j.spread.angleDeg) < 60), "3: " + k + " 벌림각이 유한·상식 범위");
    // 고정점 = 허리선 위의 입 점: 페플럼 outline 의 허리 모서리 위에 정확히 있다.
    const waistEnds = T.outlinePrimsToSegs(P.outline).filter(s => s.edge === "waist").flatMap(s => [s.from, s.to]);
    ok(m.joins.every(j => waistEnds.some(p => D(p, j.spread.pivot) < 1e-6)), "3: " + k + " 고정점이 허리선 위(WL 포인트)에 있다");
    ok(Math.abs(m.waistSeamDeltaCm) < 1e-9 && near(m.peplumWaistSeamCm, fin, 1e-6), "3: " + k + " 허리 이음 길이 정합(상 = 하 = 완성 허리)");
    ok(near(m.upperWaistSeamCm, m.peplumWaistSeamCm, 1e-6), "3: " + k + " upper 봉제 허리 = 페플럼 허리");
  });
  // 참고: 교재 도해의 «약 5cm» 는 고정값이 아니다 — 우리 실측이 그와 달라도 위반이 아니다.
  ok(GN.waistSeam.front.peplumFlare.perCutChordCm !== 5, "3: «약 5cm» 를 고정값으로 쓰지 않는다");
  // 벌림이 클수록(허리가 길수록) 분량이 는다 — 산식이 허리 완성길이에 비례한다.
  const wide = DB.computeGeometry(REF, { body: N_BODY });
  ok(wide.waistSeam.front.peplumFlare.totalCm > wide.waistSeam.back.peplumFlare.totalCm === GN.waistSeam.front.peplumFlare.finishedWaistCm > GN.waistSeam.back.peplumFlare.finishedWaistCm, "3: ∅ 는 완성 허리길이에 비례");
}

// ── 4. 물리 — 종이 위에서 성립하는가 ──
{
  ["front", "back"].forEach(k => {
    const P = peplumOf(GN, k), PM = peplumOf(GM, k), m = GN.waistSeam[k];
    ok(closedRing(P.outline), "4: " + k + " 페플럼 폐곡선(끊김 0)");
    ok(!selfIntersects(P.outline), "4: " + k + " 페플럼 자기교차 없음");
    ok(!T.outlinePrimsToSegs(P.outline).some(s => typeof s.edge === "string" && s.edge.indexOf("join:") === 0), "4: " + k + " 맞댄 다리 흔적 0");
    // 면적 = Ⓜ 페플럼 + Σ쐐기 + Σ이음 굽음(강체 회전은 조각 면적을 보존)
    const add = m.joins.reduce((s, j) => s + j.spread.wedgeAreaCm2 + j.spread.bridgeAreaCm2, 0);
    ok(near(area(P.outline), area(PM.outline) + add, 5e-3), "4: " + k + " 면적 = Ⓜ 페플럼 + 쐐기 + 이음 굽음: " + area(P.outline).toFixed(2) + " vs " + (area(PM.outline) + add).toFixed(2));
    ok(area(P.outline) > area(PM.outline), "4: " + k + " 분량이 늘었다(겹침 없음)");
    // 밑단 fairing: 직선 3 + 이음 cubic 2, 이음의 양 끝 접선이 이웃 직선과 같다(G1).
    const segs = T.outlinePrimsToSegs(P.outline), hem = segs.filter(s => s.edge === "hem");
    const cubics = hem.filter(s => s.kind === "cubic" || (s.commands && s.commands.some(c => c.type === "C")));
    ok(hem.length === 5 && cubics.length === 2, "4: " + k + " 밑단 = 직선 3 + 완만한 이음 2");
    let g1 = true, gap = 0;
    cubics.forEach(cb => {
      const before = segs.find(s => s !== cb && D(s.to, cb.from) < 1e-6), after = segs.find(s => s !== cb && D(s.from, cb.to) < 1e-6);
      if (!before || !after) { g1 = false; return; }
      const a = tanEnd(before), b = tanStart(cb), c = tanEnd(cb), d = tanStart(after);
      gap = Math.max(gap, Math.hypot(a.x - b.x, a.y - b.y), Math.hypot(c.x - d.x, c.y - d.y));
    });
    ok(g1 && gap < 1e-9, "4: " + k + " 밑단 접선 연속(G1): 최대 접선 차 " + gap.toExponential(1));
    // 이음이 옆선·중심선을 건드리지 않는다: edge 종류 보존
    ["center", "side-seam", "waist"].forEach(e => ok(segs.some(s => s.edge === e), "4: " + k + " " + e + " 모서리 보존"));
    // 허리선은 회전으로 꺾이지만 길이는 정확하다(위 3 에서 검산). 옆선 길이는 Ⓜ 과 같다.
    const sl = (P0) => T.outlinePrimsToSegs(P0.outline).filter(s => s.edge === "side-seam").reduce((L, s) => L + T.flattenLine([s]).reduce((t, ab) => t + D(ab[0], ab[1]), 0), 0);
    ok(near(sl(P), sl(PM), 1e-6), "4: " + k + " 페플럼 옆선·중심 길이 불변(강체)");
  });
}

// ── 5. 원자적 거부 ──
{
  const bad = (body, want, nm) => throwsReason(() => DB.computeGeometry(REF, { body }), want, "5: " + nm);
  bad({ hemExtensionBelowWaistCm: 20, peplumFlare: true }, "peplum-flare-needs-waist-seam", "이음선 없는 플레어 거부");
  bad(Object.assign({}, N_BODY, { peplumFlare: 1 }), "invalid-body-peplum-flare", "true 아닌 값 거부");
  bad(Object.assign({}, N_BODY, { flare: true }), "waist-seam-flare-conflict", "다트 닫는 플레어(Ⓖ)와 동시 거부");
  const shaped = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, waistSideOffsetCm: -1.5, hemSideOffsetCm: 1 } });
  const S = { front: shaped.front, back: shaped.back }, snapS = J(S);
  throwsReason(() => W.designWaistSeam.split(S, { peplumFlare: { ratio: 0, subtractCm: 1 } }), "invalid-peplum-flare", "5: ratio 0 거부");
  throwsReason(() => W.designWaistSeam.split(S, { peplumFlare: { ratio: 0.9, subtractCm: -1 } }), "invalid-peplum-flare", "5: 음수 차감 거부");
  throwsReason(() => W.designWaistSeam.split(S, { peplumFlare: { ratio: 0.01, subtractCm: 1 } }), "flare-not-positive", "5: 플레어 ≤ 0 은 부분 결과 없이 거부");
  ok(J(S) === snapS, "5: 실패해도 입력 불변");
  const ok1 = W.designWaistSeam.split(S, { peplumFlare: W.designWaistSeam.PEPLUM_FLARE });
  ok(J(S) === snapS && J(ok1.frontPeplum) === J(GN.frontPeplum), "5: 성공해도 입력 불변·프리셋 경로와 동일");
  ok(Object.isFrozen(W.designWaistSeam.PEPLUM_FLARE) && W.designWaistSeam.PEPLUM_FLARE.ratio === 0.9 && W.designWaistSeam.PEPLUM_FLARE.subtractCm === 1, "5: 상수 0.9·1 은 동결");
  // 벌림이 봉제선 길이를 넘으면 designJoin 이 거부하고, 그 사유가 join-failed 로 올라온다(부분 조각 없음).
  throwsReason(() => W.designWaistSeam.split(S, { peplumFlare: { ratio: 20, subtractCm: 0 } }), "join-failed", "5: 과도한 플레어는 join-failed 로 거부");
  // M 경로는 그대로(플레어 옵션 없음)
  ok(J(W.designWaistSeam.split(S).frontPeplum) === J(GM.frontPeplum), "5: 옵션 없으면 Ⓜ 그대로");
  const bump = W.designWaistSeam.split(S, { peplumFlare: { ratio: 0.9, subtractCm: 1 } });
  ok(J(bump.frontPeplum) === J(GN.frontPeplum), "5: 같은 옵션 = 프리셋 결과");
  // 다른 프리셋은 페플럼·플레어를 만들지 않는다
  ["A", "B", "C", "D", "G"].forEach(s => { const g = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + s) }); ok(!("frontPeplum" in g) && !("waistSeam" in g), "5: " + s + " — 페플럼 없음"); });
}

// ── 6. 4조각 배치 ──
{
  const auto = DL.autoLayout(GN);
  const rects = (k) => {
    const host = DL.outlineBBoxOf({ front: GN[k], back: { outline: [], construction: [] } }, "front"), o = auto[k];
    const pk = k + "Peplum", pp = DL.peplumDisplayPiece(GN, pk), pts = [];
    pp.outline.forEach(p => ctrl(p).forEach(q => pts.push(q)));
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
    if (a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY) { overlap++; fails.push("6: 겹침 " + a.name + " × " + b.name); FAIL++; }
  }
  ok(all.length === 4 && overlap === 0, "6: 앞·뒤 upper 와 부채꼴 페플럼 4조각이 겹치지 않는다");
  ok(DL.peplumDrop(GN, "frontPeplum") > 0 && DL.peplumDrop(GN, "backPeplum") > 0, "6: 페플럼은 허리 아래로 내려 그린다");
  ok(J(DL.autoLayout(GN)) === J(auto), "6: 결정론");
  ok(J(GN) === J(DB.computeGeometry(REF, { body: N_BODY })), "6: 표시 내림은 geometry 좌표를 바꾸지 않는다");
}

// ── 7. 렌더러 ──
{
  const pd = (k) => DL.peplumDisplayPiece(GN, k);
  const sub = { front: GN.front, back: { outline: [], construction: [] }, shared: GN.shared, sleeve: { outline: [], construction: [] }, frontPeplum: pd("frontPeplum") };
  els.length = 0;
  const g = DR.createWorkingGroup(sub);
  const pep = g.kids.filter(e => e.attrs["data-piece"] === "frontPeplum");
  ok(pep.length === GN.frontPeplum.outline.length, "7: 플레어 페플럼 outline 이 그대로 렌더(cubic 이음 포함)");
  ok(pep.filter(e => e.attrs["data-edge"] === "hem").length === 5, "7: 밑단 5 요소(직선 3 + 이음 2)가 hem 의미를 유지");
}

// ── 8. 체크포인트 ──
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  PROJECT = mk(N_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "8: Ⓝ 몸판 검사 통과: " + c.fails.join());
  const ws = c.waistSeam;
  ok(ws && ws.ok && ws.front.joins === 2 && ws.back.joins === 2, "8: 허리 이음·닫힘 검산 통과");
  ok(ws.front.flare && ws.front.flare.ok && ws.back.flare && ws.back.flare.ok && ws.front.flare.cuts === 2, "8: 플레어 검산(합 = 완성 허리×0.9−1·균등) 통과");
  ok(near(ws.front.flare.totalCm, GN.waistSeam.front.peplumFlare.totalCm, 1e-4), "8: 플레어 총량이 메타와 일치");
  ok(c.sideSeam.status === "match", "8: 앞·뒤 옆선 정합(upper 기준)");
  const done = BC.complete(PROJECT);
  ok(done.ok, "8: Ⓝ 몸판 완료");
  const res = BC.latest(PROJECT);
  ok(Object.isFrozen(res.frontPeplum) && J(res.frontPeplum.outline) === J(PROJECT.working.geometry.frontPeplum.outline) && res.frontPeplum !== PROJECT.working.geometry.frontPeplum, "8: 플레어 페플럼을 복제해 동결 보존");
  ok(J(res.waistSeam.front.peplumFlare) === J(GN.waistSeam.front.peplumFlare), "8: 플레어 메타 보존");
  ok(!BC.isCurrentBodiceChanged(PROJECT), "8: 같은 상태는 스테일 아님");
  const hN = res.hash;
  PROJECT = mk(M_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash !== hN, "8: Ⓜ 과 Ⓝ 의 hash 가 다르다(플레어 반영)");
  // 완료 뒤 밑단 이음이 바뀌면 스테일
  PROJECT = mk(N_BODY); BC.complete(PROJECT);
  const cub = PROJECT.working.geometry.backPeplum.outline.find(s => s.edge === "hem" && s.commands && s.commands.some(x => x.type === "C"));
  cub.commands.find(x => x.type === "C").points[2].x += 0.5;   // signature 는 끝점 규약(곡선 제어점은 모든 곡선에서 미포함)
  ok(BC.isCurrentBodiceChanged(PROJECT) === true, "8: 완료 뒤 밑단 이음 끝점 변경은 스테일");
  // 메타가 어긋나면 완료 차단(다시 계산해 대조한다)
  const p2 = mk(N_BODY); p2.working.geometry.waistSeam.front.joins[0].spread.chordCm += 0.5; PROJECT = p2;
  ok(BC.check(PROJECT).fails.indexOf("waist-seam-flare-mismatch") >= 0 && BC.complete(PROJECT).ok === false, "8: 플레어 메타 불일치는 완료 차단");
  const p3 = mk(N_BODY); p3.working.geometry.frontPeplum.outline.pop(); PROJECT = p3;
  ok(BC.check(PROJECT).fails.indexOf("waist-seam-peplum-open") >= 0, "8: 열린 페플럼은 완료 차단");
  // Ⓜ 검산은 플레어 항이 없다
  PROJECT = mk(M_BODY);
  ok(BC.check(PROJECT).waistSeam.front.flare === null && BC.check(PROJECT).ok, "8: Ⓜ — 플레어 항 null·검사 통과");
  // A 복귀
  PROJECT = mk(BP.bodyParams("bunka-bodice-A"));
  ok(BC.check(PROJECT).waistSeam === null && BC.check(PROJECT).ok, "8: A 복귀 — 이음선·플레어 없음");
}

// ── 9. 소비자 불변 — 목선·소매·카라가 읽는 front/back/shared/sleeve 는 Ⓜ 과 바이트 동일 ──
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  const nk = (body) => { PROJECT = mk(body); return BC.check(PROJECT).neckline; };
  const a = nk(BP.bodyParams("bunka-bodice-A")), m = nk(M_BODY), n = nk(N_BODY);
  ok(near(n.front, a.front, 1e-9) && near(n.back, a.back, 1e-9) && near(n.front, m.front, 1e-9), "9: Ⓝ 목선 길이 = A = Ⓜ");
  ["front", "back"].forEach(k => {
    const necks = (g) => g[k].outline.filter(s => s.edge === "neckline");
    ok(necks(GN).length === 1 && J(necks(GN)[0]) === J(necks(GM)[0]), "9: " + k + " 목선 프리미티브(edge·boundary) = Ⓜ");
    const arm = (g) => g[k].outline.filter(s => s.edge === "armhole");
    ok(J(arm(GN)) === J(arm(GM)), "9: " + k + " 진동선(소매가 소비) = Ⓜ");
  });
  ok(J(GN.front.necklineLenCm) === J(GM.front.necklineLenCm) && J(GN.back.necklineLenCm) === J(GM.back.necklineLenCm), "9: necklineLenCm(카라가 소비) = Ⓜ");
  ok(BC.check(PROJECT = mk(N_BODY)).armhole === undefined || J(BC.check(PROJECT).armhole) === J((PROJECT = mk(M_BODY), BC.check(PROJECT).armhole)), "9: 체크포인트 진동 측정 = Ⓜ");
}

console.log("══════════════════════════════════════════════");
console.log(`peplumFlarePresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
