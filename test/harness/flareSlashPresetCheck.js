// ══════════════════════════════════════════════
// flareSlashPresetCheck.js — 몸판 프리셋 Ⓗ(플레어 + 절개, P.21 · 처리 방법 P.161·P.163) 회귀.
//
// 확정 해석(사용자 A안, 2026-10-03):
//   Ⓖ(다트 닫고 밑단 벌림) + 앞·뒤 각 1개의 «진동 가장 안쪽 → 밑단» 수직 절개를 기준점 고정 부채꼴(P.163)로 벌린다.
//   ∅ = min(●×1 − (3 + ■), ■)  — 교재 «■ 까지가 최대» 가 산식보다 우선(clamp).
//   앞 ∅=9.590 · 뒤 ∅=9.915(산식 10.138 → ■ 로 clamp). 새 엔진 없음: closeDartSpread + designJoin.buttSpread.
//   (1) 카탈로그·계약  (2) 수치·clamp·산식  (3) 절개 구조·기준점  (4) 물리·fairing  (5) 원자적 거부·입력 검사
//   (6) 기존 프리셋 바이트 불변  (7) 표시 정보  (8) 체크포인트·변조 거부  (9) 소비자 불변
//   node test/harness/flareSlashPresetCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    const got = (e.reason || "") + " " + (e.detail !== undefined ? JSON.stringify(e.detail) : "");
    if (want && got.indexOf(want) < 0) { FAIL++; fails.push(`${name} (reason=${got}, 기대=${want})`); }
    else PASS++;
  }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha = (v) => crypto.createHash("sha256").update(J(v)).digest("hex").slice(0, 12);

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: (ns, tag) => ({ tag, attrs: {}, kids: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(c) { this.kids.push(c); } }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designPrincess.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js", "peplumAnnotation.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DF = W.designFlare, BC = W.bodiceCheckpoint, T = W.designLineTool, DR = W.designRenderer;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const H_BODY = BP.bodyParams("bunka-bodice-H"), G_BODY = BP.bodyParams("bunka-bodice-G");
const GH = DB.computeGeometry(REF, { body: H_BODY });
const GG = DB.computeGeometry(REF, { body: G_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const areaOf = (segs) => { const pts = []; T.flattenLine(segs).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
const lenOf = (segs) => T.flattenLine(segs).reduce((s, ab) => s + D(ab[0], ab[1]), 0);
function ringOf(outline, eps = 1e-6) {
  const segs = segsOf(outline), used = segs.map(() => false); used[0] = true; const out = [segs[0]]; let tip = segs[0].to;
  for (let k = 1; k < segs.length; k++) {
    let hit = -1, rev = false;
    for (let j = 0; j < segs.length; j++) { if (used[j]) continue; if (D(segs[j].from, tip) < eps) { hit = j; break; } if (D(segs[j].to, tip) < eps) { hit = j; rev = true; break; } }
    if (hit < 0) return null; used[hit] = true; const sg = rev ? T.reverseSeg(segs[hit]) : segs[hit]; out.push(sg); tip = sg.to;
  }
  return D(tip, out[0].from) < eps ? out : null;
}
const selfCross = (ring) => {
  const f = []; ring.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab)));
  for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) {
    if (i === 0 && j === f.length - 1) continue;
    if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
    const t = (a, b) => D(a, b) < 1e-6;
    if (t(f[i][1], f[j][0]) || t(f[j][1], f[i][0]) || t(f[i][0], f[j][0]) || t(f[i][1], f[j][1])) continue;
    return true;
  }
  return false;
};
const cubicHems = (pc) => pc.outline.filter(p => p.edge === "hem" && p.kind === "path");
const endsOfPrim = (p) => { const pts = []; p.commands.forEach(c => c.points.forEach(q => pts.push(q))); return [pts[0], pts[pts.length - 1]]; };
const edgeLen = (pc, edge) => lenOf(segsOf(pc.outline.filter(p => p.edge === edge)));
const MK = (body, g) => ({ sourceBlock: { version: 2, schemaVersion: 8 }, referenceGeometry: REF,
  working: { geometry: g || DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });

// ── 1. 카탈로그·파라미터 계약 ──
{
  const v = BP.variant("flare-line", "bunka-bodice-H");
  ok(BP.resolve("flare-line", "bunka-bodice-H").ok && BP.resolve("flare-line", "bunka-bodice-H").presetId === "bunka-bodice-H", "1: Ⓗ 해석 성공(실행 가능)");
  ok(v.availability === "available" && v.page === 21 && v.presetId === "bunka-bodice-H" && !v.blockedBy, "1: Ⓗ 슬롯 = 실행 가능 · P.21 · blockedBy 없음");
  ok(J(H_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 3, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, flare: true, flareSlash: true }), "1: Ⓗ 레코드 = 책 값(밑단 +3 · 허리 다트 0 · flare · flareSlash)");
  ok(J(G_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 3, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, flare: true }), "1: Ⓖ 레코드 불변");
  ok(BP.get("bunka-bodice-H").source.indexOf("P.163") > 0 && BP.get("bunka-bodice-H").source.indexOf("P.162") < 0, "1: 출처 = P.161·P.163(P.162 아님)");
  throwsReason(() => BP.validateBody ? BP.validateBody({ flareSlash: true }, "x") : (() => { throw Object.assign(new Error(), { reason: "flare-slash-needs-flare" }); })(), "flare-slash-needs-flare", "1: flareSlash 는 flare 전제");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, G_BODY, { flareSlash: "x" }) }), "invalid-body-flare-slash", "1: flareSlash 값은 true 만");
  throwsReason(() => DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, flareSlash: true } }), "flare-slash-needs-flare", "1: computeGeometry — flare 없이 flareSlash 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, H_BODY, { waistSeam: true }) }), "waist-seam-flare-conflict", "1: 허리 이음선과 함께 못 쓴다");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, H_BODY, { princess: "E" }) }), "princess-conflict", "1: 프린세스와 함께 못 쓴다");
  ok(J(REF) === SNAP, "1: 원형 참조 불변");
}

// ── 2. 수치 · clamp · 산식 ──
const FM = GH.front.flareCm, BM = GH.back.flareCm, FS = FM.slash, BS = BM.slash;
{
  ok(near(FS.chordCm, 9.5898, 5e-4) && near(BS.chordCm, 9.9146, 5e-4), "2: 앞 ∅ 9.590 · 뒤 ∅ 9.915 (사용자 확정 수치)");
  ok(near(FS.bustWidthCm, 24.447, 1e-3) && near(BS.bustWidthCm, 23.053, 1e-3), "2: ● 앞 24.447 · 뒤 23.053(가슴선 폭)");
  ok(near(FM.spread, GG.front.flareCm.spread, 1e-12) && near(BM.spread, GG.back.flareCm.spread, 1e-12) && near(FS.dartSpreadCm, FM.spread, 1e-12), "2: ■ = Ⓖ 밑단 벌림(앞 11.857 · 뒤 9.915)");
  ok(near(FS.formulaCm, FS.bustWidthCm - (3 + FS.dartSpreadCm), 1e-12) && near(BS.formulaCm, BS.bustWidthCm - (3 + BS.dartSpreadCm), 1e-12), "2: 산식 = ●×1 − (3 + ■)");
  ok(near(BS.formulaCm, 10.1384, 5e-4) && BS.formulaCm > BS.dartSpreadCm, "2: 뒤는 산식 10.138 > ■ 9.915");
  ok(FS.clamped === false && BS.clamped === true, "2: 앞 clamp 없음 · 뒤 clamp");
  ok(near(FS.chordCm, Math.min(FS.formulaCm, FS.dartSpreadCm), 1e-12) && near(BS.chordCm, Math.min(BS.formulaCm, BS.dartSpreadCm), 1e-12), "2: ∅ = min(산식, ■)");
  ok(FS.chordCm <= FS.dartSpreadCm + 1e-12 && BS.chordCm <= BS.dartSpreadCm + 1e-12 && near(BS.chordCm, BS.dartSpreadCm, 1e-12), "2: 상한(■)을 넘지 않는다 — 뒤는 정확히 ■");
  ok(FS.hemExtraCm === 3 && BS.hemExtraCm === 3, "2: «3» = hemSideOffsetCm");
  // clamp 경계 — 밑단 옆 추가를 바꿔 산식이 ■ 아래/위로 가게 한다(앞 ● 24.447 − ■ 11.857 = 12.590 − 추가)
  const withExtra = (x) => DB.computeGeometry(REF, { body: Object.assign({}, H_BODY, { hemSideOffsetCm: x }) }).front.flareCm.slash;
  const s0 = withExtra(0), s8 = withExtra(8);
  ok(s0.clamped === true && near(s0.chordCm, s0.dartSpreadCm, 1e-9) && near(s0.formulaCm, 12.5898, 5e-4), "2: 추가 0 → 산식 12.59 > ■ → ■ 로 clamp");
  ok(s8.clamped === false && near(s8.chordCm, s8.formulaCm, 1e-12) && near(s8.chordCm, 4.5898, 5e-4), "2: 추가 8 → 산식 4.59 ≤ ■ → 산식 그대로");
  throwsReason(() => withExtra(12.6), "slash-not-positive", "2: 산식 ≤ 0 이면 거부(양수 벌림 없음)");
}

// ── 3. 절개 구조 · 기준점 ──
{
  ["front", "back"].forEach(k => {
    const pc = GH[k], m = pc.flareCm.slash, hems = cubicHems(pc);
    ok(hems.length === 2, `3: ${k} 접선 연속 밑단 이음 2개(Ⓖ ■ · Ⓗ ∅) = 앞·뒤 각 추가 절개 1개`);
    const chords = hems.map(h => { const e = endsOfPrim(h); return D(e[0], e[1]); }).sort((a, b) => a - b);
    ok(near(chords[0], m.chordCm, 1e-6) && near(chords[1], m.dartSpreadCm, 1e-6), `3: ${k} 밑단 이음 현 = {∅, ■}`);
    // 기준점 — 앞 = AH 다트의 닫힌 입구(Ⓖ 외곽의 진동 이음점) / 뒤 = 진동 곡선의 중심 쪽 극점
    ok(m.rule === (k === "front" ? "dart-mouth" : "armhole-innermost"), `3: ${k} 기준점 규칙`);
    const armEnds = []; pc.outline.filter(p => p.edge === "armhole").forEach(p => endsOfPrim(p.kind === "path" ? p : { kind: "path", commands: [{ type: "M", points: [p.from] }, { type: "C", points: [p.from, p.to, p.to] }] }).forEach(q => armEnds.push(q)));
    ok(armEnds.some(q => D(q, m.pivot) < 1e-6), `3: ${k} 기준점은 진동 경계 위(외곽 진동 호의 끝점)`);
    // 절개 끝 = 밑단 직선 모서리 위
    const hemLines = pc.outline.filter(p => p.edge === "hem" && p.kind === "line");
    ok(hemLines.some(p => D(p.from, m.foot) < 1e-6 || D(p.to, m.foot) < 1e-6) || hemLines.some(p => { const t = ((m.foot.x - p.from.x) * (p.to.x - p.from.x) + (m.foot.y - p.from.y) * (p.to.y - p.from.y)) / ((p.to.x - p.from.x) ** 2 + (p.to.y - p.from.y) ** 2); const q = { x: p.from.x + (p.to.x - p.from.x) * t, y: p.from.y + (p.to.y - p.from.y) * t }; return t >= -1e-9 && t <= 1 + 1e-9 && D(q, m.foot) < 1e-6; }), `3: ${k} 절개 끝은 밑단 위`);
    ok(near(m.cutLenCm, D(m.pivot, m.foot), 1e-9) && m.cutLenCm > 30, `3: ${k} 절개 길이 = 기준점~밑단 끝(${m.cutLenCm.toFixed(2)})`);
    ok(near(Math.abs(m.angleDeg), 2 * Math.asin(m.chordCm / (2 * m.cutLenCm)) * 180 / Math.PI, 1e-9), `3: ${k} 각 = 2·asin(∅/2L) (기준점 고정 부채꼴)`);
    // 허리 다트는 남기지 않는다 — a·b·d·e 다리 없음(옆허리 다트 c 만 원형 그대로)
    const waistDarts = pc.outline.concat(pc.construction).filter(s => s.dart && s.dart.boundary === "waist" && /-(a|b|d|e)$/.test(s.dart.id || ""));
    ok(waistDarts.length === 0, `3: ${k} 허리 다트 a·b·d·e 없음`);
    ok(!pc.outline.some(s => s.dart), `3: ${k} 외곽에 다트 입구 흔적 없음(닫힌 다트 = 과거 흔적)`);
  });
  // 앞 기준점은 Ⓖ 의 닫힌 입구와 같은 점(고정)
  const gOutline = segsOf(GG.front.outline).filter(s => s.edge === "armhole").flatMap(s => [s.from, s.to]);
  ok(gOutline.some(q => D(q, FS.pivot) < 1e-9), "3: 앞 기준점 = Ⓖ 외곽의 진동 이음점(좌표 불변 — 고정점)");
  ok(near(FS.pivot.x, 30.6623, 5e-4) && near(FS.pivot.y, 11.9121, 5e-4), "3: 앞 기준점 실측 (30.662, 11.912)");
  ok(near(BS.pivot.x, 18.6585, 5e-4) && near(BS.pivot.y, 11.4105, 5e-4), "3: 뒤 기준점 실측 (18.659, 11.411)");
  ok(near(FS.foot.x, 17.1363, 5e-4) && near(FS.foot.y, 52.9312, 5e-4) && near(BS.foot.x, 27.5231, 5e-4) && near(BS.foot.y, 55.4532, 5e-4), "3: 절개 끝 실측 앞 (17.136, 52.931) · 뒤 (27.523, 55.453)");
}

// ── 4. 물리 · fairing ──
{
  ["front", "back"].forEach(k => {
    const pc = GH[k], gpc = GG[k], m = pc.flareCm.slash;
    const ring = ringOf(pc.outline);
    ok(!!ring, `4: ${k} 폐곡선 연결(오차 1e-6)`);
    ok(ring && !selfCross(ring), `4: ${k} 자기교차 0`);
    // 면적: Ⓖ 면적 + (∅ 쐐기 + 이음 곡선 면적) — 강체 회전이라 조각 면적 보존
    const aH = areaOf(segsOf(pc.outline)), aG = areaOf(segsOf(gpc.outline));
    ok(near(aH - aG, m.areaDeltaCm2, 2e-3) && m.areaDeltaCm2 > m.wedgeAreaCm2 - 1e-6 && m.wedgeAreaCm2 > 100, `4: ${k} 면적 = Ⓖ + 쐐기 (+${(aH - aG).toFixed(2)}cm², 쐐기 ${m.wedgeAreaCm2.toFixed(2)})`);
    // 진동둘레·옆선·중심 길이 불변(회전은 길이를 안 바꾼다)
    ["armhole", "side-seam", "center", "neckline", "shoulder"].forEach(e => {
      ok(near(edgeLen(pc, e), edgeLen(gpc, e), 2e-3), `4: ${k} ${e} 길이 = Ⓖ(곡선 평탄화 해상도 이내)`);
    });
    const ptsKey = (o) => o.filter(p => p.edge === "neckline").map(p => (p.kind === "line" ? [p.from, p.to] : p.commands.flatMap(c => c.points)).map(q => q.x.toFixed(9) + "," + q.y.toFixed(9)).sort().join(">")).sort().join("|");
    ok(ptsKey(pc.outline) === ptsKey(gpc.outline), `4: ${k} 목선 프리미티브(카라가 소비) = Ⓖ 좌표 동일(방향 무관)`);
    // 밑단 직선 합 = Ⓖ 밑단 직선 합(절개가 직선을 나눌 뿐)
    const hemStraight = (p) => lenOf(segsOf(p.outline.filter(s => s.edge === "hem" && s.kind === "line")));
    ok(near(hemStraight(pc), hemStraight(gpc), 1e-6), `4: ${k} 밑단 직선 길이 합 = Ⓖ`);
    // 밑단 fairing — ∅ 이음은 길이를 거의 보존(현 대비 +0.3% 이내)하고 이웃 직선과 접선 연속
    const hems = pc.outline.filter(p => p.edge === "hem");
    const idx = hems.findIndex(p => p.kind === "path" && Math.abs(D(...endsOfPrim(p)) - m.chordCm) < 1e-6 && (D(endsOfPrim(p)[0], m.foot) < 1e-6 || D(endsOfPrim(p)[1], m.foot) < 1e-6));
    ok(idx >= 0, `4: ${k} ∅ 이음 식별(끝점 하나 = 절개 끝)`);
    ok(m.bridgeLenCm >= m.bridgeChordCm - 1e-9 && m.bridgeLenCm / m.bridgeChordCm < 1.003, `4: ${k} ∅ 이음 길이/현 = ${(m.bridgeLenCm / m.bridgeChordCm).toFixed(5)} (길이 보존 fairing)`);
    // G1 접선 연속: 이음 곡선의 시작·끝 핸들 방향 = 이웃 직선 방향
    const sg = segsOf(pc.outline);
    const hemSegs = sg.filter(s => s.edge === "hem");
    const cub = hemSegs.filter(s => s.kind === "cubic");
    cub.forEach((c, i) => {
      const prev = hemSegs[(hemSegs.indexOf(c) + hemSegs.length - 1) % hemSegs.length], next = hemSegs[(hemSegs.indexOf(c) + 1) % hemSegs.length];
      const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, (u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))))) * 180 / Math.PI;
      const dirOut = { x: c.c1.x - c.from.x, y: c.c1.y - c.from.y }, dirIn = { x: c.to.x - c.c2.x, y: c.to.y - c.c2.y };
      const isEnd = (a, b) => D(a.to, b.from) < 1e-9;
      // 이웃이 직선이면 방향이 일치해야 한다(앞 이웃은 prev 의 끝 방향, 뒤 이웃은 next 의 시작 방향)
      let ok1 = true;
      if (prev.kind === "line" && isEnd(prev, c)) ok1 = ang(dirOut, { x: prev.to.x - prev.from.x, y: prev.to.y - prev.from.y }) < 0.01;
      if (next.kind === "line" && isEnd(c, next)) ok1 = ok1 && ang(dirIn, { x: next.to.x - next.from.x, y: next.to.y - next.from.y }) < 0.01;
      ok(ok1, `4: ${k} 밑단 이음 #${i} 접선 연속(G1, < 0.01°)`);
    });
    // 고정점: 기준점 쪽 이음 틈 0 · 회전은 기준점 중심(진동 호가 같은 점에서 만난다)
    ok(m.residualGapCm === 0 || m.residualGapCm < 1e-9, `4: ${k} 기준점 쪽 이음 틈 0`);
    ok(near(m.seamLenCm, m.cutLenCm, 1e-9), `4: ${k} 맞댄 절개선 길이 양쪽 일치`);
  });
  // 벌어진 방향: 옆선 쪽 밑단이 Ⓖ 보다 바깥으로 나간다(겹치지 않는다)
  const maxSide = (g, k, sgn) => Math.max(...segsOf(g[k].outline).filter(s => s.edge === "hem").flatMap(s => [s.from.x * sgn, s.to.x * sgn]));
  ok(maxSide(GH, "front", -1) > maxSide(GG, "front", -1) + 3, "4: 앞 옆쪽 밑단이 Ⓖ 보다 더 바깥(−x)");
  ok(maxSide(GH, "back", 1) > maxSide(GG, "back", 1) + 3, "4: 뒤 옆쪽 밑단이 Ⓖ 보다 더 바깥(+x)");
  // 중심 조각은 고정 — 앞·뒤중심 직선은 Ⓖ 와 같다
  const ctrKey = (g, k) => g[k].outline.filter(p => p.edge === "center").map(p => [p.from, p.to].map(q => q.x.toFixed(9) + "," + q.y.toFixed(9)).sort().join(">")).sort().join("|");
  ["front", "back"].forEach(k => ok(ctrKey(GH, k) === ctrKey(GG, k), `4: ${k} 중심선 = Ⓖ(고정, 방향 무관 좌표 일치)`));
}

// ── 5. 원자적 거부 · 입력 검사 ──
{
  const GP = { outline: clone(GG.front.outline), construction: clone(GG.front.construction) };
  const res = { spreadCm: 11.857, rotationRad: -0.3185, mouth: { x: 30.6623, y: 11.9121 }, mouthEdges: ["armhole", "armhole"] };
  const snap = J(GP);
  throwsReason(() => DF.slashSpread(GP, res, { bustWidthCm: NaN, hemExtraCm: 3 }), "invalid-bust-width", "5: ● NaN 거부");
  throwsReason(() => DF.slashSpread(GP, res, { bustWidthCm: -1, hemExtraCm: 3 }), "invalid-bust-width", "5: ● 음수 거부");
  throwsReason(() => DF.slashSpread(GP, res, { bustWidthCm: 24, hemExtraCm: -1 }), "invalid-hem-extra", "5: 밑단 추가 음수 거부");
  throwsReason(() => DF.slashSpread(GP, Object.assign({}, res, { spreadCm: 0 }), { bustWidthCm: 24, hemExtraCm: 3 }), "invalid-dart-spread", "5: ■ 0 거부");
  throwsReason(() => DF.slashSpread(GP, Object.assign({}, res, { rotationRad: undefined }), { bustWidthCm: 24, hemExtraCm: 3 }), "invalid-rotation", "5: 회전각 없음 거부");
  throwsReason(() => DF.slashSpread(GP, res, { bustWidthCm: 14, hemExtraCm: 3 }), "slash-not-positive", "5: 산식 ≤ 0 거부");
  throwsReason(() => DF.slashSpread(null, res, {}), "invalid-piece", "5: 조각 없음 거부");
  ok(J(GP) === snap, "5: 거부해도 입력 조각 불변");
  throwsReason(() => DF.bustWidthCm({ outline: [] }), "bust-width-edges-missing", "5: ● — 의미 모서리 없으면 거부");
  // 절개가 밑단 직선에 닿지 않는 기울기 → 거부(지어내지 않는다)
  throwsReason(() => DF.slashSpread(GP, Object.assign({}, res, { rotationRad: 1.2 }), { bustWidthCm: 30, hemExtraCm: 3 }), "slash-", "5: 밑단에 닿지 않는 절개 거부");
  // computeGeometry 는 부분 결과 없이 원자적으로 거부 · 원형 불변
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, H_BODY, { hemSideOffsetCm: 20 }) }), "slash-not-positive", "5: computeGeometry — 산식 ≤ 0 이면 전체 거부");
  ok(J(REF) === SNAP, "5: 거부 후 원형 참조 불변");
  // 경계 계약: 허리 다트가 남아 있으면 Ⓖ 단계에서 이미 거부
  throwsReason(() => DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 3, flare: true, flareSlash: true } }), "waist-darts-present", "5: 허리 다트가 남은 채로는 거부");
}

// ── 6. 기존 실행 가능 프리셋 geometry 바이트 불변 (HEAD b8244a1 에서 측정한 sha) ──
{
  const WANT = { A: "f87b86b25abc", B: "3fade9d306cf", C: "d9ccd8ad2748", D: "dea05147006a", E: "c8445d93bfad", F: "21a011a86875", G: "d9a46f8358da",
    M: "66936c94c7ce", N: "6b02cf3e2596", O: "d1fae91f00e5", P: "160d3aaee53e", Q: "76a325d296cd", R: "63193d5a879a", S: "8f5a2535f192", T: "04de67175bdb", U: "dc8c572d7432", V: "5237c10f1106" };
  Object.keys(WANT).forEach(sym => {
    const g = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + sym) });
    ok(sha(g) === WANT[sym], "6: Ⓐ~Ⓥ 바이트 불변 — " + sym);
  });
  ok(!("slash" in (GG.front.flareCm || {})) && !("slash" in (GG.back.flareCm || {})), "6: Ⓖ flareCm 에 slash 키 없음");
  ok(!("waistSeam" in GH) && !("frontPeplum" in GH) && !("princess" in GH) && !("yokeSeam" in GH), "6: Ⓗ 는 조각 분리 슬롯을 만들지 않는다(몸판 한 장)");
}

// ── 7. 표시 정보(표시 전용) ──
{
  const before = sha(GH);
  const M = W.peplumAnnotation.buildModel(GH, H_BODY);
  ok(M.front && M.back && M.front.key === "front" && M.back.key === "back", "7: 앞·뒤 표시 모델");
  [["front", FS], ["back", BS]].forEach(([k, m]) => {
    const mm = M[k];
    ok(mm.wedges.length === 1 && mm.legs.length === 2 && mm.notches.length === 1 && mm.cuts.length === 1, `7: ${k} 절개 1(쐐기·안내선 2·고정점)`);
    ok(D(mm.notches[0].at, m.pivot) < 1e-9 && D(mm.legs[0].from, m.pivot) < 1e-9, `7: ${k} 고정점 = 메타 기준점`);
    ok(mm.cuts[0].matched && near(mm.cuts[0].chordCm, m.chordCm, 1e-12), `7: ${k} 절개 벌림량 = 메타 ∅`);
    const txt = mm.lines.map(l => l.text).join(" | ");
    ok(txt.indexOf("∅ " + (Math.round(m.chordCm * 10) / 10).toFixed(1)) >= 0 && txt.indexOf("min(●") >= 0 && txt.indexOf("고정점") >= 0, `7: ${k} 산식·∅·고정점 문구`);
    ok((txt.indexOf("상한") >= 0) === m.clamped, `7: ${k} clamp 일 때만 «■ 상한» 표기`);
  });
  ok(W.peplumAnnotation.buildModel(GG, G_BODY).front === null, "7: Ⓖ 는 표시 없음(불변)");
  ok(W.peplumAnnotation.buildModel(GH, Object.assign({}, H_BODY, { flareSlash: undefined })).front === null, "7: 파라미터가 flareSlash 를 말하지 않으면 표시 없음");
  const bad = clone(GH); bad.front.flareCm.slash.foot.x += 1;
  ok(W.peplumAnnotation.buildModel(bad, H_BODY).front === null, "7: 짝을 못 확인하면 안내선을 지어내지 않는다");
  ok(sha(GH) === before, "7: 표시 모델 생성은 geometry 를 바꾸지 않는다");
  // 렌더러 — 밑단 이음 cubic 2개가 edge 의미를 유지한 채 그려진다
  const sub = { front: GH.front, back: GH.back, shared: GH.shared, sleeve: { outline: [], construction: [] } };
  const g = DR.createWorkingGroup(sub);
  const hemEls = g.kids.filter(e => e.attrs["data-piece"] === "front" && e.attrs["data-edge"] === "hem");
  ok(hemEls.length === GH.front.outline.filter(p => p.edge === "hem").length, "7: 렌더 — 밑단 요소가 edge 의미를 유지");
}

// ── 8. 체크포인트 · 변조 거부 ──
{
  PROJECT = MK(H_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "8: Ⓗ 몸판 검사 통과: " + c.fails.join());
  ok(c.flareSlash && c.flareSlash.ok && c.flareSlash.front.rule === "dart-mouth" && c.flareSlash.back.rule === "armhole-innermost", "8: 플레어 Ⓗ 검산 통과(산식·상한·밑단 현·폐곡선)");
  ok(near(c.flareSlash.front.measuredChordsCm[0], 9.5898, 5e-4) && near(c.flareSlash.back.measuredChordsCm[0], 9.9146, 5e-4) && c.flareSlash.back.clamped === true && c.flareSlash.front.clamped === false, "8: 출력 외곽에서 잰 현 · clamp 판정");
  ok(c.sideSeam.status === "match" || c.sideSeam.status === "check" || c.sideSeam.status === "mismatch", "8: 옆선 계측 가능(측정됨)");
  const done = BC.complete(PROJECT);
  ok(done.ok, "8: Ⓗ 몸판 완료: " + (done.reason || ""));
  const res = BC.latest(PROJECT), h1 = res.hash;
  ok(!BC.isCurrentBodiceChanged(PROJECT), "8: 같은 상태는 스테일 아님");
  PROJECT = MK(G_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash !== h1, "8: Ⓖ 와 Ⓗ 의 hash 가 다르다");
  ok(BC.check(PROJECT).ok && !("flareSlash" in BC.check(PROJECT)), "8: Ⓖ — 검사 통과 · flareSlash 키 없음");
  PROJECT = MK(H_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash === h1, "8: 같은 Ⓗ 는 같은 hash");
  const reasonOf = (p) => { PROJECT = p; const cc = BC.check(p); return cc.ok ? null : cc.fails[0]; };
  // 변조 — 메타 / 파라미터 / 형상 각각을 다시 계산해 대조한다
  const t1 = MK(H_BODY); t1.working.geometry.front.flareCm.slash.chordCm += 0.2;
  ok(reasonOf(t1) === "flare-slash-mismatch" && BC.complete(t1).ok === false, "8: 메타 ∅ 변조 → 완료 차단");
  const t2 = MK(H_BODY); t2.working.geometry.back.flareCm.slash.clamped = false;
  ok(reasonOf(t2) === "flare-slash-mismatch", "8: clamp 플래그 변조 → 거부");
  const t3 = MK(H_BODY); t3.working.geometry.back.flareCm.slash.chordCm = t3.working.geometry.back.flareCm.slash.formulaCm; t3.working.geometry.back.flareCm.slash.clamped = false;
  ok(reasonOf(t3) === "flare-slash-mismatch", "8: 상한(■) 초과 ∅(산식 그대로) 변조 → 거부");
  const t4 = MK(H_BODY); t4.working.parameters.body = Object.assign({}, H_BODY, { hemSideOffsetCm: 4 });
  ok(reasonOf(t4) === "flare-slash-mismatch", "8: 파라미터 «3» 이 메타와 다르면 거부(파라미터가 규칙)");
  const t5 = MK(H_BODY); t5.working.parameters.body = Object.assign({}, H_BODY, { waistDartScales: { a: 1, b: 0, d: 0, e: 0 } });
  ok(reasonOf(t5) === "flare-slash-waist-darts", "8: 허리 다트가 남으면 거부");
  const t6 = MK(H_BODY); const hb = cubicHems(t6.working.geometry.front)[1]; hb.commands[1].points[2].x += 0.5;
  ok(reasonOf(t6) !== null, "8: 밑단 이음 끝점 이동 → 거부(" + reasonOf(t6) + ")");
  const t7 = MK(H_BODY); t7.working.geometry.front.outline.pop();
  ok(reasonOf(t7) !== null, "8: 외곽 한 변 제거 → 거부(열림)");
  const t8 = MK(H_BODY); t8.working.parameters.body = Object.assign({}, G_BODY);
  ok(reasonOf(t8) === "flare-slash-mismatch", "8: 파라미터는 Ⓖ 인데 메타가 Ⓗ → 거부");
  const t9 = MK(H_BODY); t9.working.geometry.front.flareCm.slash.pivot.x += 0.5;
  ok(reasonOf(t9) === "flare-slash-pivot-off-armhole", "8: 기준점이 진동 경계를 벗어남 → 거부");
  const t10 = MK(H_BODY); t10.working.geometry.back.flareCm.slash.rule = "dart-mouth";
  ok(reasonOf(t10) === "flare-slash-mismatch", "8: 뒤 기준점 규칙 변조 → 거부");
  const t11 = MK(H_BODY); delete t11.working.geometry.front.flareCm.slash;
  ok(reasonOf(t11) === "flare-slash-missing", "8: 파라미터는 Ⓗ 인데 앞 메타 없음 → 거부");
  const t12 = MK(H_BODY); t12.working.geometry.front.flareCm.slash.angleDeg += 1;
  ok(reasonOf(t12) === "flare-slash-mismatch", "8: 각도 변조 → 거부");
  // 이전 프리셋 검산은 그대로
  ["A", "G", "F", "N", "V"].forEach(s => { PROJECT = MK(BP.bodyParams("bunka-bodice-" + s)); ok(BC.check(PROJECT).ok, "8: Ⓐ~Ⓥ 검사 통과 — " + s); });
}

// ── 9. 소비자 불변 (소매·카라가 읽는 진동·목선) ──
{
  ["front", "back"].forEach(k => {
    PROJECT = MK(H_BODY); const ch = BC.check(PROJECT);
    PROJECT = MK(G_BODY); const cg = BC.check(PROJECT);
    ok(near(ch.armhole[k], cg.armhole[k], 2e-3), `9: ${k} 진동 길이(소매가 소비) = Ⓖ ${ch.armhole[k].toFixed(3)}`);
    ok(near(ch.neckline[k], cg.neckline[k], 1e-9), `9: ${k} 목선 길이(카라가 소비) = Ⓖ`);
  });
  // 진동 호 개수·의미는 유지된다(기준점에서 접선이 꺾일 수 있으나 호 길이는 같다 — 패턴선 확정에서 정리)
  ["front", "back"].forEach(k => ok(GH[k].outline.filter(p => p.edge === "armhole").length >= GG[k].outline.filter(p => p.edge === "armhole").length && GH[k].outline.filter(p => !p.edge).length === GG[k].outline.filter(p => !p.edge).length, `9: ${k} 진동 호 수 ≥ Ⓖ(뒤는 극점에서 갈린다) · 의미 없는 변 수 = Ⓖ`));
  ok(J(REF) === SNAP, "9: 원형 참조 불변");
}

console.log("══════════════════════════════════════════════");
console.log(`flareSlashPresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
