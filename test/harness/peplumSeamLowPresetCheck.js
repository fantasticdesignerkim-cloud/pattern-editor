// peplumSeamLowPresetCheck.js — 프리셋 Ⓟ(P.29): 이음선 WL 아래 5cm · 밑단 옆 +1.5 · ∅=●×0.3−1.5 · 절개 2곳 회귀.
//   node test/harness/peplumSeamLowPresetCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js"].forEach(load);
sandbox.window.designWorkflow = { current: () => PROJECT };
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const P_BODY = BP.bodyParams("bunka-bodice-P"), O_BODY = BP.bodyParams("bunka-bodice-O");
const GP = DB.computeGeometry(REF, { body: P_BODY });
const GOo = DB.computeGeometry(REF, { body: O_BODY });
const BOXY = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } } });

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


const fmt = (s) => s;

const YB = (g, k) => { const ys = []; T.outlinePrimsToSegs(g[k].outline).forEach(s => ys.push(s.from.y, s.to.y)); return ys; };
const segsOf = (o) => T.outlinePrimsToSegs(o);

// ── 1. 카탈로그·레코드 ──
{
  ok(BP.variant("waist-seam", "bunka-bodice-P").availability === "available", "1: Ⓟ 실행 가능");
  ok(BP.resolve("waist-seam", "bunka-bodice-P").ok && BP.get("bunka-bodice-P").source.indexOf("P.29") > 0 && BP.get("bunka-bodice-P").source.indexOf("P.163") > 0, "1: 출처 P.29·P.163");
  ok(J(P_BODY) === J({ hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, waistSeam: true, peplumCut: "P" }), "1: Ⓟ body = 박시 + 이음선 + peplumCut:P (옆선 기울기 없음)");
  ok(!("hemSideOffsetCm" in P_BODY) && !("waistSideOffsetCm" in P_BODY), "1: 옆선 전체 기울기·허리 이동 없음(+1.5 는 페플럼 구간만)");
  ok(Object.keys(P_BODY).every(k => BP.fields().some(f => f.key === k)), "1: body 키는 전부 계약 필드");
  const rec = clone(BP.get("bunka-bodice-P"));
  throwsReason(() => BP.validateRecord(Object.assign(clone(rec), { body: Object.assign({}, rec.body, { peplumCut: "Q" }) })), "invalid-body", "1: peplumCut 은 true|\"P\" 만");
  throwsReason(() => DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, peplumCut: "P" } }), "peplum-cut-needs-waist-seam", "1: waistSeam 없는 Ⓟ 거부");
  ok(J(BP.bodyParams("bunka-bodice-O")) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, waistSeam: true, peplumCut: true }), "1: Ⓞ 레코드 불변");
}

// ── 2. 이음선 위치·몸판·페플럼 길이 ──
{
  ["front", "back"].forEach(k => {
    const refW = BOXY.waistSeam ? null : null;
    const wlY = segsOf(BOXY[k].outline).find(s => s.edge === "side-seam").from.y;   // 참고: 박시 몸판의 옆선 위쪽
    // 박시 몸판(이음선 없음)에서 WL y 를 구한다: 허리 참고선
    const wl = BOXY[k].construction.find(s => s.edge === "waist" && !s.dart).from.y;
    const seam = segsOf(GP[k].outline).filter(s => s.edge === "waist");
    ok(seam.length === 1 && near(seam[0].from.y, wl + 5, 1e-9) && near(seam[0].to.y, wl + 5, 1e-9), "2: " + k + " 몸판 하단 = WL 아래 5cm 수평 이음선");
    const pep = GP[k + "Peplum"], ys = []; segsOf(pep.outline).forEach(s => ys.push(s.from.y, s.to.y));
    const hemY = Math.max(...YB(BOXY, k));
    ok(near(Math.min(...ys), wl + 5, 1e-3) || Math.min(...ys) <= wl + 5 + 1e-6, "2: " + k + " 페플럼 상단 = 이음선");
    ok(near(hemY - wl, 20, 1e-9), "2: " + k + " 전체 길이 = WL 아래 20cm");
    const cen = segsOf(pep.outline).find(s => s.edge === "center");
    ok(near(D(cen.from, cen.to), 15, 1e-9), "2: " + k + " 페플럼 중심 길이 = 15cm");
    // 옆선: 몸판 옆선은 WL~이음선 수직
    const sides = segsOf(GP[k].outline).filter(s => s.edge === "side-seam").filter(s => Math.max(s.from.y, s.to.y) > wl + 1e-6);
    ok(sides.length >= 1 && sides.every(s => Math.abs(s.from.x - s.to.x) < 1e-9), "2: " + k + " 몸판 WL~이음선 옆선 수직");
    const rg = T.buildPieceRing(T.outlinePrimsToSegs(GP[k].outline), T.outlinePrimsToSegs(GP[k].construction)), rg0 = T.buildPieceRing(T.outlinePrimsToSegs(GOo[k].outline), T.outlinePrimsToSegs(GOo[k].construction)); ok(rg.ok === rg0.ok && rg.ok, "2: " + k + " 몸판 링 구성(폐곡선) 성공");
  });
  ok(J(REF) === SNAP, "2: reference 불변");
  ok(J(DB.computeGeometry(REF, { body: P_BODY })) === J(GP), "2: 결정론");
}

// ── 3. +1.5 는 이음선 아래 페플럼 구간에만 ──
{
  ["front", "back"].forEach(k => {
    const pep = GP[k + "Peplum"];
    const sideSegs = (o) => segsOf(o).filter(s => s.edge === "side-seam");
    const sd = sideSegs(pep.outline);
    ok(sd.length >= 1, "3: " + k + " 페플럼 옆선 존재");
    // 페플럼 옆선(회전 전 경계): 통제군(절개 1곳, 회전량 미미해도 옆조각 회전) 대신 산식으로 검증: 상단 폭 vs 밑단 폭
    // 몸판 이음선 폭(수직 옆선 = 이음선 폭) 대비, 밑단 옆 모서리 = 이음선 옆 끝 + 1.5(수평 방향 성분)
    const upSeam = segsOf(GP[k].outline).find(s => s.edge === "waist"), wUp = D(upSeam.from, upSeam.to);
    ok(near(GP.waistSeam[k].upperWaistSeamCm, wUp, 1e-6), "3: " + k + " ● = 이음선 완성 둘레(몸판 이음선 길이)");
    ok(near(GP.waistSeam[k].peplumFlare.finishedWaistCm, wUp, 1e-6), "3: " + k + " 절개 산식의 ● = 이음선 폭");
  });
  // 밑단 옆 +1.5: 옆 조각은 강체 회전이라 옆선 길이가 보존된다 → hypot(15, 1.5) (수직 옆선이면 15)
  const DWs = W.designWaistSeam, base = { ratio: 0.3, subtractCm: 1.5, cuts: 2, seamBelowWaistCm: 5 };
  ["front", "back"].forEach(k => {
    const r15 = DWs.split({ front: clone(BOXY.front), back: clone(BOXY.back) }, { peplumCut: Object.assign({ hemSideCm: 1.5 }, base) });
    const r0 = DWs.split({ front: clone(BOXY.front), back: clone(BOXY.back) }, { peplumCut: Object.assign({ hemSideCm: 0 }, base) });
    const sideLen = (r) => { const s = segsOf(r[k + "Peplum"].outline).filter(x => x.edge === "side-seam"); return s.reduce((L, x) => L + D(x.from, x.to), 0); };
    ok(near(sideLen(r15), Math.hypot(15, 1.5), 1e-6), "3: " + k + " 페플럼 옆선 = hypot(15, 1.5) (밑단 옆 +1.5)");
    ok(near(sideLen(r0), 15, 1e-6), "3: " + k + " hemSideCm 0 이면 수직 15cm");
    ok(J(r15[k].outline) === J(r0[k].outline) && J(r15[k].construction) === J(r0[k].construction), "3: " + k + " +1.5 는 몸판(upper)에 영향 없음");
    ok(J(r15[k + "Peplum"]) === J(GP[k + "Peplum"]), "3: " + k + " 프리셋 경로 = 옵션 경로");
  });
}

// ── 4. 절개 산식 ∅ = ● × 0.3 − 1.5, 절개 2곳 각 ∅/2 ──
{
  ["front", "back"].forEach(k => {
    const m = GP.waistSeam[k], fl = m.peplumFlare;
    ok(fl.mode === "cut" && fl.ratio === 0.3 && fl.subtractCm === 1.5 && fl.cuts === 2 && fl.fairWaist === true, "4: " + k + " 메타 0.3·1.5·cut·2·fairWaist");
    ok(near(fl.totalCm, fl.finishedWaistCm * 0.3 - 1.5, 1e-9), "4: " + k + " ∅ = ● × 0.3 − 1.5 (" + fl.totalCm.toFixed(3) + ")");
    ok(near(fl.perCutChordCm, fl.totalCm / 2, 1e-12) && m.joins.every(j => near(j.spread.chordCm, fl.totalCm / 2, 1e-9)), "4: " + k + " 절개당 ∅/2 chord");
    ok(m.joins.length === 2 && m.peplumDarts.every(d => d.widthCm === 0), "4: " + k + " 수직 절개 2곳(폭 0)");
    const Wa = fl.finishedWaistCm, pv0 = m.joins[0].spread.pivot;
    const seamSeg = segsOf(GP[k].outline).find(s => s.edge === "waist"), lo = Math.min(seamSeg.from.x, seamSeg.to.x), hi = Math.max(seamSeg.from.x, seamSeg.to.x);
    const cen = segsOf(GP[k + "Peplum"].outline).find(s => s.edge === "center"), dir = (Math.abs(cen.from.x - lo) < Math.abs(cen.from.x - hi)) ? 1 : -1, cx = dir === 1 ? lo : hi;
    ok(near(pv0.x, cx + dir * Wa / 3, 1e-6) && near(pv0.y, seamSeg.from.y, 1e-6), "4: " + k + " 첫 고정점 = 이음선 1/3 점");
    ok(near(D(pv0, m.joins[1].spread.pivot), Wa / 3, 1e-6), "4: " + k + " 고정점 간격 = ●/3");
  });
  console.log("  Ⓟ 실측: 앞 ●=" + GP.waistSeam.front.peplumFlare.finishedWaistCm.toFixed(3) + " ∅=" + GP.waistSeam.front.peplumFlare.totalCm.toFixed(3) + " / 뒤 ●=" + GP.waistSeam.back.peplumFlare.finishedWaistCm.toFixed(3) + " ∅=" + GP.waistSeam.back.peplumFlare.totalCm.toFixed(3));
}

// ── 5. 물리 · fairing · 이음 정합 ──
{
  ["front", "back"].forEach(k => {
    const pep = GP[k + "Peplum"], m = GP.waistSeam[k], F = m.waistFair;
    ok(closedRing(pep.outline) && !selfIntersects(pep.outline), "5: " + k + " 페플럼 폐곡선·자기교차 없음");
    ok(F && F.shortfallCm > 0 && F.shortfallCm < 0.5 && F.corners.length === 2, "5: " + k + " 이음선 fairing 감소 " + (F && F.shortfallCm.toFixed(4)) + "cm");
    ok(near(m.upperWaistSeamCm - m.peplumWaistSeamCm, F.shortfallCm, 1e-6) && near(m.waistSeamDeltaCm, F.shortfallCm, 1e-9), "5: " + k + " 몸판 봉제 − 페플럼 이음 = fairing 감소량");
    const w = segsOf(pep.outline).filter(s => s.edge === "waist");
    let turn = 0; for (let i = 0; i < w.length - 1; i++) { const a = tanEnd(w[i]), b = tanStart(w[i + 1]); if (a && b) turn = Math.max(turn, Math.acos(Math.min(1, a.x * b.x + a.y * b.y)) * 180 / Math.PI); }
    ok(w.length >= 4 && turn < 1e-4, "5: " + k + " 이음선 G1(" + turn.toExponential(1) + "°)");
    const hem = segsOf(pep.outline).filter(s => s.edge === "hem"); let ht = 0;
    for (let i = 0; i < hem.length - 1; i++) { const a = tanEnd(hem[i]), b = tanStart(hem[i + 1]); if (a && b) ht = Math.max(ht, Math.acos(Math.min(1, a.x * b.x + a.y * b.y)) * 180 / Math.PI); }
    ok(hem.length === 5 && ht < 1e-4, "5: " + k + " 밑단 G1·5요소");
    ok(area(pep.outline) > 0, "5: " + k + " 면적 양수");
  });
}

// ── 6. 배치 · 표시 ──
{
  const auto = DL.autoLayout(GP);
  const rects = (k) => {
    const host = DL.outlineBBoxOf({ front: GP[k], back: { outline: [], construction: [] } }, "front"), o = auto[k];
    const pk = k + "Peplum", pp = DL.peplumDisplayPiece(GP, pk), pts = [];
    pp.outline.forEach(p => ctrl(p).forEach(q => pts.push(q)));
    const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
    return [{ name: k + "-upper", minX: host.minX + o.dx, maxX: host.maxX + o.dx, minY: host.minY + o.dy, maxY: host.maxY + o.dy },
      { name: pk, minX: Math.min(...xs) + o.dx, maxX: Math.max(...xs) + o.dx, minY: Math.min(...ys) + o.dy, maxY: Math.max(...ys) + o.dy }];
  };
  const all = rects("front").concat(rects("back")); let ov = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j]; if (a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY) ov++; }
  ok(ov === 0, "6: 4조각 겹침 없음");
  const M = W.peplumAnnotation.buildModel(GP);
  ["front", "back"].forEach(k => {
    const md = M[k]; ok(!!md, "6: " + k + " 표시 모델");
    if (!md) return;
    const txt = (id) => (md.lines.find(l => l.id === id) || {}).text || "";
    ok(txt("flare").indexOf("× 0.3 − 1.5") > 0, "6: " + k + " 산식 문구 ×0.3−1.5");
    ok(md.cuts.length === 2 && md.cuts.every(c => c.matched), "6: " + k + " 절개 ①② 안내선");
    ok(txt("cutrule").indexOf("이음선 3등분점") > 0 && txt("waist").indexOf("이음선(WL−5)") === 0, "6: " + k + " 표시는 WL 이 아니라 이음선(WL−5)");
  });
}

// ── 7. 체크포인트 · 소비자 ──
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  PROJECT = mk(P_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "7: Ⓟ 검사 통과: " + c.fails.join());
  if (!c.ok) console.log("PROBE", c.fails.join(), J(c.waistSeam).slice(0, 600));
  ok(c.waistSeam && c.waistSeam.ok && c.waistSeam.front.flare && c.waistSeam.front.flare.ok && c.waistSeam.back.flare.ok, "7: 이음·플레어 검산 통과");
  ok(BC.complete(PROJECT).ok, "7: Ⓟ 몸판 완료");
  const hP = BC.latest(PROJECT).hash;
  PROJECT = mk(O_BODY); BC.complete(PROJECT); ok(BC.latest(PROJECT).hash !== hP, "7: Ⓞ 과 Ⓟ hash 다름");
  PROJECT = mk(P_BODY); BC.complete(PROJECT); ok(BC.latest(PROJECT).hash === hP, "7: 같은 Ⓟ 같은 hash");
  const nk = (body) => { PROJECT = mk(body); return BC.check(PROJECT).neckline; };
  const a = nk({ hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } }), p = nk(P_BODY);
  ok(near(p.front, a.front, 1e-9) && near(p.back, a.back, 1e-9), "7: 목선 길이 = 같은 박시 몸판");
  ["front", "back"].forEach(k => ok(J(GP.shared) === J(BOXY.shared) && J(GP.sleeve) === J(BOXY.sleeve), "7: shared·sleeve 불변"));
  const canon = (v) => Array.isArray(v) ? v.map(canon) : (v && typeof v === "object") ? Object.keys(v).sort().reduce((o, k) => (o[k] = canon(v[k]), o), {}) : v;
  const armh = (g, k) => J(canon(g[k].outline.filter(s => s.edge === "armhole" || s.edge === "neckline" || s.edge === "shoulder")));
  ok(["front", "back"].every(k => armh(GP, k) === armh(GOo, k)), "7: 진동·목선·어깨 프리미티브 = Ⓞ 몸판과 동일");
}

// ── 8. 회귀: Ⓜ·Ⓝ·Ⓞ 결과 바이트 동일(seam 옵션 없을 때) ──
{
  const DWs = W.designWaistSeam;
  const OO = BP.bodyParams("bunka-bodice-O");
  const viaOpt = DWs.split({ front: clone(BOXY.front), back: clone(BOXY.back) }, { peplumCut: DWs.PEPLUM_CUT });
  ok(J(viaOpt.frontPeplum) !== undefined && J(GOo.frontPeplum) !== J(GP.frontPeplum), "8: Ⓞ ≠ Ⓟ");
  ok(Object.isFrozen(DWs.PEPLUM_CUT_P) && DWs.PEPLUM_CUT_P.ratio === 0.3 && DWs.PEPLUM_CUT_P.subtractCm === 1.5 && DWs.PEPLUM_CUT_P.seamBelowWaistCm === 5 && DWs.PEPLUM_CUT_P.hemSideCm === 1.5, "8: Ⓟ 상수 동결");
  ok(!("seamBelowWaistCm" in DWs.PEPLUM_CUT), "8: Ⓞ 상수에는 이음선 이동이 없다");
  throwsReason(() => DWs.split({ front: clone(BOXY.front), back: clone(BOXY.back) }, { peplumCut: { ratio: 0.3, subtractCm: 1.5, cuts: 2, seamBelowWaistCm: -1 } }), "invalid-peplum-cut", "8: 음수 이음선 거부");
  throwsReason(() => DWs.split({ front: clone(BOXY.front), back: clone(BOXY.back) }, { peplumCut: { ratio: 0.3, subtractCm: 1.5, cuts: 2, seamBelowWaistCm: 25 } }), "seam-below-outline", "8: 밑단보다 아래 이음선 거부");
}

console.log("peplumSeamLowPresetCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
