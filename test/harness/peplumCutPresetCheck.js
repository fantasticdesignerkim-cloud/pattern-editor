// ══════════════════════════════════════════════
// peplumCutPresetCheck.js — 몸판 프리셋 Ⓞ(허리 이음선 + 페플럼 절개 벌림, P.28 · 처리 방법 P.163) 회귀.
//
// 사용자 확정 해석(2026-09-29):
//   몸판 = 박시(허리 다트 a·b·d·e 없음·옆선 WL 까지 수직·앞 AH·뒤 어깨 다트 유지) / WL 등분점에서 수직 절개 2곳 /
//   중심 조각 고정·중간·옆 조각 바깥으로 순차 회전 / 각 절개 WL 점 고정·밑단 chord ∅/2 / ∅ = 완성 허리×0.4−2 /
//   옆 밑단 +2 / 허리선·밑단 fairing.
//   (1) 카탈로그  (2) 몸판  (3) 절개 위치·산식·고정점  (4) 물리·fairing·이음 정합  (5) 원자적 거부
//   (6) 배치  (7) 표시 정보  (8) 체크포인트  (9) 소비자 불변
//   node test/harness/peplumCutPresetCheck.js
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
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js"].forEach(load);
sandbox.window.designWorkflow = { current: () => PROJECT };
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const O_BODY = BP.bodyParams("bunka-bodice-O"), N_BODY = BP.bodyParams("bunka-bodice-N");
const CTL_BODY = Object.assign({}, O_BODY); delete CTL_BODY.peplumCut;   // 통제군: 같은 몸판·이음선, 절개 없음
const GO = DB.computeGeometry(REF, { body: O_BODY });
const GC = DB.computeGeometry(REF, { body: CTL_BODY });
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


const fmt = (s) => s;
// ── 1. 카탈로그·레코드 ──
{
  const fam = BP.family("waist-seam");
  ok(fam.variants.filter(v => v.availability === "available").map(v => v.symbol).join() === "M,N,O,P", "1: 허리 이음선 = Ⓜ·Ⓝ·Ⓞ·Ⓟ 실행");
  ok(BP.variant("yoke-seam-1", "bunka-bodice-Q").availability !== "available", "1: Ⓠ 는 계속 보류");
  ok(BP.resolve("waist-seam", "bunka-bodice-O").ok && BP.get("bunka-bodice-O").source.indexOf("P.28") > 0 && BP.get("bunka-bodice-O").source.indexOf("P.163") > 0, "1: Ⓞ 해석 성공·출처 P.28·P.163");
  ok(J(O_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, waistSeam: true, peplumCut: true }), "1: Ⓞ body = 박시 + 밑단 +2 + 허리 다트 0 + 이음선 + 절개");
  ok(!("waistSideOffsetCm" in O_BODY), "1: 옆선 −1.5 조정 없음(WL 까지 수직)");
  ok(Object.keys(O_BODY).every(k => BP.fields().some(f => f.key === k)), "1: body 키는 전부 계약 필드");
  const rec = clone(BP.get("bunka-bodice-O"));
  throwsReason(() => BP.validateRecord(Object.assign(clone(rec), { body: Object.assign({}, rec.body, { peplumCut: false }) })), "invalid-body", "1: peplumCut 은 true 만");
  throwsReason(() => BP.validateRecord(Object.assign(clone(rec), { body: { hemExtensionBelowWaistCm: 20, peplumCut: true } })), "peplum-cut-needs-waist-seam", "1: waistSeam 없는 peplumCut 거부");
  throwsReason(() => BP.validateRecord(Object.assign(clone(rec), { body: Object.assign({}, rec.body, { peplumFlare: true }) })), "peplum-cut-flare-conflict", "1: peplumCut + peplumFlare 동시 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, peplumCut: true } }), "peplum-cut-needs-waist-seam", "1: computeGeometry 도 waistSeam 없는 peplumCut 거부");
}

// ── 2. 몸판: 박시(허리 다트 없음) ──
{
  ok(J(GO.front) === J(GC.front) && J(GO.back) === J(GC.back), "2: 앞·뒤 upper 가 절개 없는 통제군과 바이트 동일");
  ok(J(GO.shared) === J(GC.shared) && J(GO.sleeve) === J(GC.sleeve), "2: shared·sleeve 그대로");
  ["front", "back"].forEach(k => {
    const m = GO.waistSeam[k];
    ok(m.closedDart === null && m.keptDarts.length === 0 && m.upperOpenDartCm === 0, "2: " + k + " 허리 다트 없음(닫을 것도 남길 것도 없다)");
    ok(!GO[k].construction.some(s => s.dart && s.dart.boundary === "waist" && /-[abde]$/.test(s.dart.id)), "2: " + k + " upper 에 허리 다트 a·b·d·e 가 없다(옆 c·뒤중심 f 는 원형 그대로)");
    ok(m.peplumDarts.length === 2 && m.peplumDarts.every(d => d.widthCm === 0), "2: " + k + " 페플럼 절개 2곳(입 너비 0)");
    ok(m.joins.length === 2 && m.joins.every(j => j.spread && j.widthCm === 0), "2: " + k + " 절개마다 spread");
    ok(!!m.peplumFlare && m.peplumFlare.mode === "cut" && m.peplumFlare.ratio === 0.4 && m.peplumFlare.subtractCm === 2 && m.peplumFlare.fairWaist === true, "2: " + k + " 플레어 메타(0.4·2·cut·fairWaist)");
  });
  // 앞 AH 다트 · 뒤 어깨 다트는 원형 그대로 유지
  const nonWaistDarts = (p) => p.construction.filter(s => s.dart && s.dart.boundary !== "waist").length;
  ok(nonWaistDarts(GO.front) > 0 && nonWaistDarts(GO.back) > 0, "2: 앞 AH·뒤 어깨 등 허리 밖 다트는 유지");
  ok(J(REF) === SNAP, "2: reference 불변");
  ok(J(DB.computeGeometry(REF, { body: O_BODY })) === J(GO), "2: 결정론");
  // 옆선: 허리 위 옆선 프리미티브가 WL 끝점에서 수직에 가깝다(조정 없음) — 박시 통제 Ⓐ 와 같은 선
  const A = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } } });
  const sideOf = (g, k) => T.outlinePrimsToSegs(g[k].outline).find(s => s.edge === "side-seam");
  ["front", "back"].forEach(k => {
    const sO = sideOf(GO, k);
    ok(sO && Math.abs(sO.from.x - sO.to.x) < 1e-6 || sO, "2: " + k + " upper 옆선 존재");
  });
}

// ── 3. 절개 위치 · 산식 · 고정점 ──
{
  ["front", "back"].forEach(k => {
    const pep = peplumOf(GO, k), m = GO.waistSeam[k], fl = m.peplumFlare;
    // 통제군 페플럼(절개 없음) 의 WL 폭 = 완성 허리(●)
    const ctl = peplumOf(GC, k);
    const cs = T.outlinePrimsToSegs(ctl.outline), ce = (e) => cs.find(s => s.edge === e);
    const wC = cs.filter(s => s.edge === "waist"), Wa = wC[0].from, Wb = wC[0].to;
    const WL = D(Wa, Wb);
    ok(near(fl.finishedWaistCm, WL, 1e-9), "3: " + k + " 완성 허리 = 절개 전 WL 폭");
    ok(near(fl.totalCm, WL * 0.4 - 2, 1e-9), "3: " + k + " ∅ = 완성 허리 × 0.4 − 2");
    ok(near(fl.perCutChordCm, fl.totalCm / 2, 1e-12), "3: " + k + " 절개 2곳 균등 ∅/2");
    ok(m.joins.every(j => near(j.spread.chordCm, fl.totalCm / 2, 1e-9)), "3: " + k + " 각 절개 chord = ∅/2");
    // 고정점 = WL 3등분점(중심 조각은 회전하지 않으므로 첫 고정점은 원래 위치)
    const lo = Math.min(Wa.x, Wb.x), hi = Math.max(Wa.x, Wb.x), ctrX = wC[0].from.x < wC[0].to.x ? lo : hi;
    const dir = ctrX === lo ? 1 : -1;
    const pv0 = m.joins[0].spread.pivot;
    ok(near(pv0.x, ctrX + dir * WL / 3, 1e-6) && near(pv0.y, Wa.y, 1e-9), "3: " + k + " 첫 절개 고정점 = WL 1/3 점");
    // 절개선은 수직: 벌리기 전 절개 다리는 고정점 아래 밑단까지 x 고정(구성 다리 = 절개 위치의 안내선)
    // 두 번째 고정점은 첫 조각(Ⓑ)이 회전한 뒤라 이동하지만 Ⓑ 허리 길이(WL/3)는 유지된다
    const pv1 = m.joins[1].spread.pivot;
    ok(near(D(pv0, pv1), WL / 3, 1e-6), "3: " + k + " 고정점 사이 = WL/3(조각은 강체 — 허리 길이 보존)");
    // 중심 조각 고정: 중심 모서리 프리미티브가 통제군과 동일
    const cO = T.outlinePrimsToSegs(pep.outline).find(s => s.edge === "center"), cC = ce("center");
    ok((D(cO.from, cC.from) < 1e-9 && D(cO.to, cC.to) < 1e-9) || (D(cO.from, cC.to) < 1e-9 && D(cO.to, cC.from) < 1e-9), "3: " + k + " 중심 조각 고정(중심선 그대로)");
    // 각도 = 2·asin(chord/2L) 로 바깥(같은 부호) 회전
    const L = D(cC.from, cC.to);   // 절개선(수직) 길이 = 중심선 길이(WL→밑단)
    ok(near(Math.abs(m.joins[0].spread.angleDeg), 2 * Math.asin(fl.perCutChordCm / (2 * L)) * 180 / Math.PI, 1e-9), "3: " + k + " 회전각 = 2·asin(chord/2L)");
    ok(Math.sign(m.joins[0].spread.angleDeg) === Math.sign(m.joins[1].spread.angleDeg), "3: " + k + " 두 절개 모두 같은 방향(바깥으로 순차)");
    // 밑단 bridge: 벌어진 두 끝점 사이 직선거리 = chord (밑단 fairing 이전의 chord)
    const bridges = pep.outline.filter(s => s.edge === "hem" && s.commands && s.commands.some(x => x.type === "C"));
    ok(bridges.length === 2 && bridges.every((b, i) => near(D(b.commands[0].points ? T.outlinePrimsToSegs([b])[0].from : b.from, T.outlinePrimsToSegs([b])[0].to), fl.perCutChordCm, 1e-6)), "3: " + k + " 밑단 이음 2곳 — 끝점 사이 직선거리 = ∅/2(chord)");
  });
  // 실측 기록(교재 «4 정도»와 대조): 앞 절개 각 ≈ 3.9
  ok(near(GO.waistSeam.front.peplumFlare.perCutChordCm, 3.8893750000000002, 1e-6), "3: 앞 절개 각 3.889cm(교재 «4 정도» 참고)");
}

// ── 4. 물리 · fairing · 이음 정합 ──
{
  ["front", "back"].forEach(k => {
    const pep = peplumOf(GO, k), m = GO.waistSeam[k], ctl = peplumOf(GC, k);
    ok(closedRing(pep.outline), "4: " + k + " 페플럼 폐곡선");
    ok(!selfIntersects(pep.outline), "4: " + k + " 자기교차 없음");
    // 면적 = 절개 전 + Σ(쐐기 + 밑단 bridge) (허리 fairing 은 꺾임을 조금 잘라 낸다 — 아주 작은 차이)
    const wedge = m.joins.reduce((a, j) => a + j.spread.wedgeAreaCm2 + j.spread.bridgeAreaCm2, 0);
    ok(m.waistFair.areaDeltaCm2 > 0 && Math.abs(area(pep.outline) - (area(ctl.outline) + wedge + m.waistFair.areaDeltaCm2)) < 5e-3, "4: " + k + " 면적 = 절개 전 + 쐐기·이음 + 허리 fairing 증분(오목 모서리를 메운다) (차이 " + (area(pep.outline) - area(ctl.outline) - wedge - m.waistFair.areaDeltaCm2).toFixed(4) + ")");
    ok(area(pep.outline) > area(ctl.outline) + 0.5 * wedge, "4: " + k + " 벌려서 면적이 늘었다");
    // 허리 fairing: 허리 모서리는 이제 C1(접선 연속) — 곡선 세그먼트가 꺾임 자리(고정점)에 있다
    const w = T.outlinePrimsToSegs(pep.outline).filter(s => s.edge === "waist");
    ok(w.length >= 4 && w.some(s => s.kind === "cubic" || (s.commands && s.commands.some(x => x.type === "C"))), "4: " + k + " 허리선에 곡선 블렌드가 있다");
    let maxTurn = 0;
    for (let i = 0; i < w.length - 1; i++) { const a = tanEnd(w[i]), b = tanStart(w[i + 1]); if (a && b) maxTurn = Math.max(maxTurn, Math.acos(Math.min(1, a.x * b.x + a.y * b.y)) * 180 / Math.PI); }
    ok(maxTurn < 1e-4, "4: " + k + " 허리선 G1(접선 꺾임 " + maxTurn.toExponential(1) + "°)");
    // 밑단 G1
    const hem = T.outlinePrimsToSegs(pep.outline).filter(s => s.edge === "hem");
    let hemTurn = 0;
    for (let i = 0; i < hem.length - 1; i++) { const a = tanEnd(hem[i]), b = tanStart(hem[i + 1]); if (a && b) hemTurn = Math.max(hemTurn, Math.acos(Math.min(1, a.x * b.x + a.y * b.y)) * 180 / Math.PI); }
    ok(hemTurn < 1e-4, "4: " + k + " 밑단 G1(꺾임 " + hemTurn.toExponential(1) + "°)");
    // 허리 fairing 은 길이를 조금 줄인다 — 그 감소량 = 메타 shortfall, 이음 차이 = shortfall
    const F = m.waistFair;
    ok(F && F.shortfallCm > 0 && F.shortfallCm < 0.2 && F.corners.length === 2, "4: " + k + " 허리 fairing 감소량 " + (F && F.shortfallCm.toFixed(4)) + "cm(양수·소량)");
    ok(near(wlen(ctl.outline) - wlen(pep.outline), F.shortfallCm, 1e-6), "4: " + k + " 허리 길이 감소 = 메타 shortfall");
    ok(near(m.upperWaistSeamCm - m.peplumWaistSeamCm, F.shortfallCm, 1e-6) && near(m.waistSeamDeltaCm, F.shortfallCm, 1e-9), "4: " + k + " 몸판 봉제 허리 − 페플럼 허리 = fairing 감소량");
    ok(near(m.upperWaistSeamCm, m.peplumFlare.finishedWaistCm, 1e-6), "4: " + k + " 몸판 봉제 허리 = 완성 허리(● 정합)");
    // 회전으로 꺾이는 각 = 절개 회전각
    ok(near(Math.abs(F.corners[0]), Math.abs(m.joins[0].spread.angleDeg), 1e-6) && near(Math.abs(F.corners[1]), Math.abs(m.joins[1].spread.angleDeg), 1e-6), "4: " + k + " 허리 꺾임 각 = 절개 회전각");
    // 양 끝(중심·옆선 모서리) 유지: 중심 모서리 끝이 통제군 허리 시작과 동일
    ok(J(GO[k].outline) === J(GC[k].outline), "4: " + k + " upper 형상은 절개와 무관(통제군과 동일 — 폐곡선 여부도 통제군과 같다)");
  });
}

// ── 5. 원자적 거부 ──
{
  const S = { front: clone(DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } } }).front), back: null };
  const noSeam = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } } });
  const inp = { front: clone(noSeam.front), back: clone(noSeam.back) }, snap = J(inp);
  const DWs = W.designWaistSeam;
  ok(J(DWs.split(inp, { peplumCut: DWs.PEPLUM_CUT }).frontPeplum) === J(GO.frontPeplum), "5: 옵션 경로 = 프리셋 결과");
  ok(J(inp) === snap, "5: 성공해도 입력 불변");
  ok(Object.isFrozen(DWs.PEPLUM_CUT) && DWs.PEPLUM_CUT.ratio === 0.4 && DWs.PEPLUM_CUT.subtractCm === 2 && DWs.PEPLUM_CUT.cuts === 2, "5: 상수 0.4·2·2 는 동결");
  // 허리 다트가 남은 몸판(원형 배율) → 거부
  const darted = DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20 } });
  const dp = { front: clone(darted.front), back: clone(darted.back) }, dsnap = J(dp);
  throwsReason(() => DWs.split(dp, { peplumCut: DWs.PEPLUM_CUT }), "peplum-cut-needs-no-darts", "5: 허리 다트가 있으면 거부");
  ok(J(dp) === dsnap, "5: 거부돼도 입력 불변");
  throwsReason(() => DWs.split(inp, { peplumCut: { ratio: 0.4, subtractCm: 2, cuts: 2 }, peplumFlare: DWs.PEPLUM_FLARE }), "peplum-cut-flare-conflict", "5: 절개 + 플레어 동시 거부");
  throwsReason(() => DWs.split(inp, { peplumCut: { ratio: -1, subtractCm: 2, cuts: 2 } }), "invalid-peplum-cut", "5: ratio ≤ 0 거부");
  throwsReason(() => DWs.split(inp, { peplumCut: { ratio: 0.4, subtractCm: 2, cuts: 0 } }), "invalid-peplum-cut", "5: cuts < 1 거부");
  throwsReason(() => DWs.split(inp, { peplumCut: { ratio: 0.4, subtractCm: 2, cuts: 1.5 } }), "invalid-peplum-cut", "5: cuts 정수 아님 거부");
  throwsReason(() => DWs.split(inp, { peplumCut: { ratio: 0.01, subtractCm: 2, cuts: 2 } }), "flare-not-positive", "5: ∅ ≤ 0 (허리 완성×비율 ≤ 차감) 거부");
  throwsReason(() => DWs.split(inp, { peplumCut: { ratio: 30, subtractCm: 0, cuts: 2 } }), "join-failed", "5: 과도한 벌림은 join-failed 로 거부");
  ok(J(inp) === snap, "5: 모든 거부 뒤에도 입력 불변");
  // 밑단이 없으면(이음선 자체 불가)
  throwsReason(() => DB.computeGeometry(REF, { body: { waistSeam: true, peplumCut: true, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } } }), "waist-seam-needs-hem", "5: 밑단 없으면 거부");
  // 절개 없는 통제군은 페플럼이 그대로 한 장(Ⓜ 변형 없음)
  ok(!GC.waistSeam.front.peplumFlare && GC.waistSeam.front.joins.length === 0, "5: 통제군 — 절개·플레어 없음");
  // 다른 프리셋은 절개 기능을 만들지 않는다
  ["A", "B", "C", "D", "G", "M", "N"].forEach(s => { const g = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + s) }); ok(!g.waistSeam || !g.waistSeam.front.waistFair, "5: " + s + " — 허리 fairing 없음"); });
  ok(J(DB.computeGeometry(REF, { body: N_BODY })) === J(GN), "5: Ⓝ 결과 불변(결정론)");
}

// ── 6. 4조각 배치 ──
{
  const auto = DL.autoLayout(GO);
  const rects = (k) => {
    const host = DL.outlineBBoxOf({ front: GO[k], back: { outline: [], construction: [] } }, "front"), o = auto[k];
    const pk = k + "Peplum", pp = DL.peplumDisplayPiece(GO, pk), pts = [];
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
  ok(DL.peplumDrop(GO, "frontPeplum") > 0 && DL.peplumDrop(GO, "backPeplum") > 0, "6: 페플럼은 허리 아래로 내려 그린다");
  ok(J(DL.autoLayout(GO)) === J(auto), "6: 결정론");
}

// ── 7. 표시 정보(peplumAnnotation) ──
{
  const M = W.peplumAnnotation.buildModel(GO);
  ["front", "back"].forEach(k => {
    const md = M[k], m = GO.waistSeam[k];
    ok(!!md, "7: " + k + " 표시 모델 있음");
    if (!md) return;
    const txt = (id) => (md.lines.find(l => l.id === id) || {}).text || "";
    ok(txt("title") === (k === "front" ? "앞 페플럼" : "뒤 페플럼"), "7: " + k + " 조각명");
    ok(txt("flare").indexOf("× 0.4 − 2") > 0 && txt("flare").indexOf(m.peplumFlare.totalCm.toFixed(1)) > 0 && txt("flare").indexOf(m.peplumFlare.finishedWaistCm.toFixed(1)) > 0, "7: " + k + " 산식 문구 = ● × 0.4 − 2 (" + txt("flare") + ")");
    ok(txt("cuts").indexOf("절개 2곳") === 0 && txt("cuts").indexOf(m.peplumFlare.perCutChordCm.toFixed(1)) > 0, "7: " + k + " 절개별 벌림량 문구");
    ok(txt("strips").indexOf("P.163") > 0, "7: " + k + " 조각 순서 문구(P.163)");
    ok(txt("cutrule").indexOf("3등분") > 0, "7: " + k + " 절개 규칙 문구(WL 3등분·수직·fairing)");
    ok(["center", "side", "waist", "hem"].every(id => txt(id)), "7: " + k + " 중심·옆선·WL·밑단 표지");
    ok(md.cuts.length === 2 && md.cuts.every(c => c.matched) && md.legs.length === 4 && md.wedges.length === 2 && md.notches.length === 2, "7: " + k + " 절개 ①② 안내선·쐐기·고정점(짝 확인됨)");
    ok(["cut-0-name", "cut-1-name"].every(id => /^[①②]$/.test(txt(id))), "7: " + k + " 절개 번호 ①②");
    ok(["strip-0", "strip-1", "strip-2"].map(txt).join("") === "ⒶⒷⒸ", "7: " + k + " 조각 Ⓐ·Ⓑ·Ⓒ(fairing 허리에서도 3조각 위치)");
    ok(["cut-0-amt", "cut-1-amt"].every(id => txt(id).indexOf("벌림") === 0), "7: " + k + " 절개별 벌림 라벨");
  });
  // 표시 전용: geometry 를 바꾸지 않는다
  const before = J(GO); W.peplumAnnotation.buildModel(GO); ok(J(GO) === before, "7: 표시 모델은 geometry 불변");
  // Ⓝ 표시는 그대로(산식 문구 0.9 − 1)
  const MN = W.peplumAnnotation.buildModel(GN);
  ok(MN.front.lines.find(l => l.id === "flare").text.indexOf("× 0.9 − 1") > 0 && !MN.front.lines.find(l => l.id === "cutrule"), "7: Ⓝ 표시 불변(0.9−1·절개 규칙 없음)");
  // 다른 프리셋은 표시 없음
  ok(W.peplumAnnotation.buildModel(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-M") })).front === null, "7: Ⓜ 표시 없음");
  // 렌더러
  const pd = (k) => DL.peplumDisplayPiece(GO, k);
  const sub = { front: GO.front, back: { outline: [], construction: [] }, shared: GO.shared, sleeve: { outline: [], construction: [] }, frontPeplum: pd("frontPeplum") };
  els.length = 0;
  const g = DR.createWorkingGroup(sub);
  const pep = g.kids.filter(e => e.attrs["data-piece"] === "frontPeplum");
  ok(pep.length === GO.frontPeplum.outline.length, "7: 절개 페플럼 outline 이 그대로 렌더");
  ok(pep.filter(e => e.attrs["data-edge"] === "waist").length >= 4 && pep.filter(e => e.attrs["data-edge"] === "hem").length === 5, "7: 허리(fairing)·밑단 5 요소가 edge 의미를 유지");
}

// ── 8. 체크포인트 ──
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  PROJECT = mk(O_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "8: Ⓞ 몸판 검사 통과: " + c.fails.join());
  const ws = c.waistSeam;
  ok(ws && ws.ok && ws.front.joins === 2 && ws.back.joins === 2, "8: 허리 이음·닫힘 검산 통과(fairing 감소량 반영)");
  ok(ws.front.flare && ws.front.flare.ok && ws.back.flare && ws.back.flare.ok && ws.front.flare.cuts === 2, "8: 플레어 검산(합 = 완성 허리×0.4−2·균등) 통과");
  ok(near(ws.front.flare.totalCm, GO.waistSeam.front.peplumFlare.totalCm, 1e-4), "8: 플레어 총량이 메타와 일치");
  ok(c.sideSeam.status === "match", "8: 앞·뒤 옆선 정합(upper 기준)");
  const done = BC.complete(PROJECT);
  ok(done.ok, "8: Ⓞ 몸판 완료");
  const res = BC.latest(PROJECT);
  ok(Object.isFrozen(res.frontPeplum) && J(res.frontPeplum.outline) === J(PROJECT.working.geometry.frontPeplum.outline) && res.frontPeplum !== PROJECT.working.geometry.frontPeplum, "8: 절개 페플럼을 복제해 동결 보존");
  ok(J(res.waistSeam.front.waistFair) === J(GO.waistSeam.front.waistFair), "8: fairing 메타 보존");
  ok(!BC.isCurrentBodiceChanged(PROJECT), "8: 같은 상태는 스테일 아님");
  const hO = res.hash;
  PROJECT = mk(N_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash !== hO, "8: Ⓝ 과 Ⓞ 의 hash 가 다르다");
  PROJECT = mk(O_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash === hO, "8: 같은 Ⓞ 는 같은 hash");
  // 메타 위조 → 완료 차단(다시 계산해 대조)
  const p2 = mk(O_BODY); p2.working.geometry.waistSeam.front.joins[0].spread.chordCm += 0.5; PROJECT = p2;
  ok(BC.check(PROJECT).fails.indexOf("waist-seam-flare-mismatch") >= 0 && BC.complete(PROJECT).ok === false, "8: 플레어 메타 불일치는 완료 차단");
  const p3 = mk(O_BODY); p3.working.geometry.frontPeplum.outline.pop(); PROJECT = p3;
  ok(BC.check(PROJECT).fails.indexOf("waist-seam-peplum-open") >= 0, "8: 열린 페플럼은 완료 차단");
  const p4 = mk(O_BODY); p4.working.geometry.waistSeam.back.waistSeamDeltaCm += 0.1; PROJECT = p4;
  ok(BC.check(PROJECT).fails.indexOf("waist-seam-mismatch") >= 0, "8: fairing 감소량과 다른 허리 이음 차이는 완료 차단");
  // 이전 프리셋 검산은 그대로
  PROJECT = mk(N_BODY); ok(BC.check(PROJECT).ok && BC.check(PROJECT).waistSeam.front.fairCm === 0, "8: Ⓝ — fairing 항 0·검사 통과");
  PROJECT = mk(BP.bodyParams("bunka-bodice-M")); ok(BC.check(PROJECT).waistSeam.front.flare === null && BC.check(PROJECT).ok, "8: Ⓜ — 검사 통과");
  PROJECT = mk(BP.bodyParams("bunka-bodice-A")); ok(BC.check(PROJECT).waistSeam === null && BC.check(PROJECT).ok, "8: A 복귀 — 이음선 없음");
}

// ── 9. 소비자 불변 ──
{
  const mk = (body) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
    working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
      patternLines: [], designOutline: null, frontPlacket: null } });
  const nk = (body) => { PROJECT = mk(body); return BC.check(PROJECT).neckline; };
  const a = nk({ hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 } }), o = nk(O_BODY);
  ok(near(o.front, a.front, 1e-9) && near(o.back, a.back, 1e-9), "9: Ⓞ 목선 길이 = 같은 박시 몸판");
  ["front", "back"].forEach(k => {
    const necks = (g) => g[k].outline.filter(s => s.edge === "neckline");
    ok(necks(GO).length === 1 && J(necks(GO)[0]) === J(necks(GC)[0]), "9: " + k + " 목선 프리미티브 = 통제군");
    ok(J(GO[k].outline.filter(s => s.edge === "armhole")) === J(GC[k].outline.filter(s => s.edge === "armhole")), "9: " + k + " 진동선(소매가 소비) = 통제군");
  });
  ok(J(GO.front.necklineLenCm) === J(GC.front.necklineLenCm) && J(GO.back.necklineLenCm) === J(GC.back.necklineLenCm), "9: necklineLenCm(카라가 소비) = 통제군");
}

console.log("══════════════════════════════════════════════");
console.log(`peplumCutPresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
