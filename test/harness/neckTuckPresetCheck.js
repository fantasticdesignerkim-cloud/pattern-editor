// ══════════════════════════════════════════════
// neckTuckPresetCheck.js — 몸판 프리셋 Ⓘ(목둘레 턱, P.22 · 처리 방법 P.161) 회귀.
//
// 확정 해석(사용자 확정, 2026-10-03 — 책 P.22 는 절개 위치·배분·깊이를 수치로 주지 않는다):
//   Ⓑ 몸판(밑단 +1 · 허리 다트 없음) · 앞 AH·뒤 어깨 다트를 닫아 목둘레 호 1/3·2/3 두 절개를 **균등(각 θ/2)** 으로 벌린다.
//   닫은 다트 전부를 쓴다(«조금 적게» 감소 없음) · 턱은 바깥쪽 · 박기 끝 = 목둘레에서 2cm(표시 전용).
//   (1) 카탈로그·계약  (2) 수치·균등·1/3·2/3  (3) 물리(면적·길이·폐곡선)  (4) 원자적 거부·입력 검사
//   (5) 기존 프리셋 바이트 불변  (6) 표시 정보  (7) 체크포인트·변조 거부  (8) 소비자 불변
//   node test/harness/neckTuckPresetCheck.js
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

const I_BODY = BP.bodyParams("bunka-bodice-I"), B_BODY = BP.bodyParams("bunka-bodice-B"), G_BODY = BP.bodyParams("bunka-bodice-G");
const GI = DB.computeGeometry(REF, { body: I_BODY });
const GB = DB.computeGeometry(REF, { body: B_BODY });
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


const ths = { front: 18.25, back: 11.38 };
const isSlit = (p) => !!(p.dart && /^neck-tuck-[12]$/.test(p.dart.id));
const slits = (pc) => pc.outline.filter(isSlit);
const gapsOf = (pc) => { const s = slits(pc); const out = []; for (let i = 0; i < 4; i += 2) { const a = segsOf([s[i]])[0], b = segsOf([s[i + 1]])[0]; out.push({ chord: D(a.from, b.to), len: D(a.from, a.to), angle: 2 * Math.asin(D(a.from, b.to) / (2 * D(a.from, a.to))) }); } return out; };
// 그린 순서대로 틈(tuck-slit) 사이의 목둘레 호를 묶는다(곡선이 둘로 나뉜 조각도 한 호로).
const neckRuns = (pc) => { const out = []; let cur = 0; pc.outline.forEach(p => { if (p.edge === "neckline") cur += lenOf(segsOf([p])); else if (cur > 0) { out.push(cur); cur = 0; } }); if (cur > 0) out.push(cur); return out; };
// 방향을 무시한 모서리별 좌표 서명(ring 정규화로 선 방향이 뒤집혀도 같은 선이면 같다).
const edgeSig = (pc, e) => J(segsOf(pc.outline.filter(p => p.edge === e)).map(s => [s.from, s.to].map(q => [Math.round(q.x * 1e9) / 1e9, Math.round(q.y * 1e9) / 1e9]).sort()).sort());
const ringAreaOf = (pc) => { const r = T.buildPieceRing(segsOf(pc.outline), pc.construction.filter(c => c.kind === "line")); if (!r.ok) throw new Error("ring"); return areaOf(r.ring.map(x => x.seg)); };

// ── 1. 카탈로그·파라미터 계약 ──
{
  const v = BP.variant("neck-tuck", "bunka-bodice-I");
  ok(BP.resolve("neck-tuck", "bunka-bodice-I").ok && BP.resolve("neck-tuck", "bunka-bodice-I").presetId === "bunka-bodice-I", "1: Ⓘ 해석 성공(실행 가능)");
  ok(v.availability === "available" && v.page === 22 && v.presetId === "bunka-bodice-I" && !v.blockedBy, "1: Ⓘ 슬롯 = 실행 가능 · P.22 · blockedBy 없음");
  ok(J(I_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, neckTuck: true }), "1: Ⓘ 레코드 = Ⓑ(밑단 +1) + 허리 다트 0 + neckTuck");
  ok(BP.get("bunka-bodice-I").source.indexOf("P.161") > 0 && BP.get("bunka-bodice-I").source.indexOf("사용자 확정") > 0, "1: 출처 = P.161 · 책에 없는 규칙은 사용자 확정이라고 밝힌다");
  const j = BP.variant("neck-tuck", "bunka-bodice-J");
  ok(j.availability === "available" && j.page === 23 && j.presetId === "bunka-bodice-J" && !j.blockedBy, "1: Ⓙ 는 실행 가능(P.23 — neckTuckJPresetCheck 가 따로 검증)");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, I_BODY, { flare: true }) }), "neck-tuck-conflict", "1: 플레어와 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, I_BODY, { waistSeam: true }) }), "neck-tuck-conflict", "1: 허리 이음선과 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, I_BODY, { princess: "E" }) }), "neck-tuck-conflict", "1: 프린세스와 함께 쓰면 거부");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, I_BODY, { neckTuck: "yes" }) }), "invalid-body-neck-tuck", "1: neckTuck 는 true 만");
  throwsReason(() => BP.validateBody ? BP.validateBody({ neckTuck: 1 }, "x") : (() => { throw Object.assign(new Error(), { reason: "invalid-body" }); })(), "invalid-body", "1: 카탈로그 검증도 true 만");
}

// ── 2. 수치 · 균등 · 1/3·2/3 ──
{
  ["front", "back"].forEach(k => {
    const pc = GI[k], m = pc.neckTuck, g = gapsOf(pc), runs = neckRuns(pc);
    ok(m && m.cuts.length === 2 && slits(pc).length === 4, `2: ${k} 절개 2곳 · 틈 다리 4`);
    ok(near(Math.abs(m.dartAngleRad) * 180 / Math.PI, ths[k], 1e-3), `2: ${k} 닫는 다트각 = ${ths[k]}°`);
    ok(near(g[0].angle, g[1].angle, 1e-9) && near(g[0].angle + g[1].angle, Math.abs(m.dartAngleRad), 1e-9), `2: ${k} 두 절개 각이 같고(균등) 합 = 다트각`);
    ok(near(g[0].angle, Math.abs(m.dartAngleRad) / 2, 1e-9), `2: ${k} 각 절개 = θ/2`);
    ok(near(g[0].chord, 2 * g[0].len * Math.sin(g[0].angle / 2), 1e-9) && near(m.cuts[0].gapChordCm, g[0].chord, 1e-9) && near(m.cuts[1].gapChordCm, g[1].chord, 1e-9), `2: ${k} 틈 현 = 2·L·sin(θ/4) · 메타 일치`);
    ok(runs.length === 3, `2: ${k} 목둘레가 세 호로 나뉜다`);
    const tot = runs[0] + runs[1] + runs[2];
    ok(runs.every(r => near(r, tot / 3, 2e-3)), `2: ${k} 목둘레 호 1/3·1/3·1/3(절개 = 1/3·2/3 지점) ${runs.map(r => r.toFixed(3)).join("/")}`);
    ok(near(m.neckLenCm, tot, 1e-3) && near(pc.necklineLenCm, tot, 1e-3), `2: ${k} 봉제 목둘레 = 세 호 합(틈은 접혀 사라진다)`);
    ok(m.depthCm === 2 && m.tuckDirection === "outward", `2: ${k} 박기 끝 2cm · 바깥쪽`);
    m.cuts.forEach(c => {
      ok(near(D(c.neckBefore, c.endBefore), 2, 1e-9) && near(D(c.neckAfter, c.endAfter), 2, 1e-9), `2: ${k} 절개 ${c.index} 박기 끝 = 목둘레에서 2cm 아래`);
      // 박기 끝은 절개 다리 위(apex 방향)에 있다
      const u = { x: (m.apex.x - c.neckBefore.x) / c.lenCm, y: (m.apex.y - c.neckBefore.y) / c.lenCm };
      ok(near(c.endBefore.x, c.neckBefore.x + 2 * u.x, 1e-9) && near(c.endBefore.y, c.neckBefore.y + 2 * u.y, 1e-9), `2: ${k} 절개 ${c.index} 박기 끝이 다리 위`);
    });
  });
  ok(near(GI.front.neckTuck.cuts[0].gapChordCm, 3.4256, 5e-4) && near(GI.front.neckTuck.cuts[1].gapChordCm, 3.0978, 5e-4), "2: 앞 틈 3.426 + 3.098(절개 길이가 달라 현이 다르다)");
  ok(near(GI.back.neckTuck.cuts[0].gapChordCm, 1.0003, 5e-4) && near(GI.back.neckTuck.cuts[1].gapChordCm, 1.0883, 5e-4), "2: 뒤 틈 1.000 + 1.088");
}

// ── 3. 물리 — 종이 위: 강체 회전이라 면적·길이 불변, 닫히고 겹치지 않는다 ──
{
  ["front", "back"].forEach(k => {
    const pi = GI[k], pb = GB[k];
    // 그린 순서 그대로 닫혀 있는가
    const segs = segsOf(pi.outline); let gap = 0;
    segs.forEach((s, i) => { gap = Math.max(gap, D(s.to, segs[(i + 1) % segs.length].from)); });
    ok(gap < 1e-4, `3: ${k} 외곽이 그린 순서대로 닫힌다(최대 연결 오차 ${gap.toExponential(1)})`);
    ok(!selfCross(segs), `3: ${k} 자기교차 0`);
    ok(near(areaOf(segs), ringAreaOf(pb), k === "front" ? 1e-3 : 0.3), `3: ${k} 면적 = Ⓑ 의 열린 다트 형상(designLineTool 링)과 같다 — 강체라 보존`);
    ["shoulder", "armhole", "side-seam", "center", "hem"].forEach(e => ok(near(edgeLen(pi, e), edgeLen(pb, e), 2e-3), `3: ${k} ${e} 길이 불변`));
    ok(near(edgeLen(pi, "neckline"), edgeLen(pb, "neckline"), 2e-3), `3: ${k} 목둘레 호 길이 합 불변`);
    // 다트가 닫혔다: 열린 AH/어깨 V 가 없고 구조화 다트 입이 폭 0(앞) / 잔여 sliver(뒤)
    const dt = pi.construction.filter(p => p.dart && (p.dart.boundary === "armhole" || p.dart.boundary === "shoulder"));
    ok(dt.length === 2, `3: ${k} 닫힌 다트 다리 두 줄 보존(construction)`);
  });
  ok(GI.back.neckTuck.residualSliverCm > 0.1 && GI.back.neckTuck.residualSliverCm < 0.11, "3: 뒤 어깨 잔여 sliver 0.103cm 는 감추지 않고 기록(Ⓖ 와 같은 값)");
  ok(GI.front.neckTuck.residualSliverCm < 1e-9, "3: 앞은 이등변이라 잔여 0");
  // 어깨 길이는 두 조각으로 갈라지지 않는다 — 어깨선은 중심 쪽 조각이 아니라 회전 조각에 있다. 합이 불변이면 충분.
  ok(["front", "back"].every(k => ["side-seam", "hem", "center"].every(e => edgeSig(GI[k], e) === edgeSig(GB[k], e))), "3: 중심 조각(고정)의 옆선·밑단·중심선은 Ⓑ 와 좌표가 정확히 같다");
}

// ── 4. 원자적 거부 · 입력 검사 ──
{
  const pc = { outline: clone(GB.front.outline), construction: clone(GB.front.construction) };
  const snap = J(pc);
  DF.neckTuck(pc);
  ok(J(pc) === snap, "4: 입력 조각 불변");
  throwsReason(() => DF.neckTuck(null), "invalid-piece", "4: 조각 없음");
  throwsReason(() => DF.neckTuck({ outline: clone(GB.front.outline), construction: [] }), "ring-failed", "4: 닫을 다트 다리가 없으면 거부(외곽이 안 닫힌다)");
  throwsReason(() => DF.neckTuck(pc, { depthCm: 0 }), "invalid-tuck-depth", "4: 깊이 0 거부");
  throwsReason(() => DF.neckTuck(pc, { depthCm: "2" }), "invalid-tuck-depth", "4: 깊이 문자열 거부");
  const noNeck = { outline: clone(GB.front.outline).map(p => p.edge === "neckline" ? Object.assign({}, p, { edge: "x" }) : p), construction: clone(GB.front.construction) };
  throwsReason(() => DF.neckTuck(noNeck), "no-neckline-edge", "4: 목둘레 모서리가 없으면 거부");
  const crossing = { outline: clone(GB.front.outline), construction: clone(GB.front.construction).concat([{ kind: "line", from: { x: 39.7, y: -2 }, to: { x: 39.7, y: 14 } }]) };
  throwsReason(() => DF.neckTuck(crossing), "tuck-construction-crosses-cut", "4: 절개선을 가로지르는 construction 은 거부(조용히 틀어지지 않게)");
}

// ── 5. 기존 실행 가능 프리셋 geometry 바이트 불변 (HEAD 2abfd7f 에서 측정한 sha · Ⓘ 는 5fecd46) ──
{
  const WANT = { A: "f87b86b25abc", B: "3fade9d306cf", C: "d9ccd8ad2748", D: "dea05147006a", E: "c8445d93bfad", F: "21a011a86875", G: "d9a46f8358da", H: "c7c54c484627",
    I: "d0ecd75a37e3", M: "66936c94c7ce", N: "6b02cf3e2596", O: "d1fae91f00e5", P: "160d3aaee53e", Q: "76a325d296cd", R: "63193d5a879a", S: "8f5a2535f192", T: "04de67175bdb", U: "dc8c572d7432", V: "5237c10f1106" };
  Object.keys(WANT).forEach(sym => {
    const g = DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + sym) });
    ok(sha(g) === WANT[sym], "5: Ⓐ~Ⓥ(Ⓘ 포함) 바이트 불변 — " + sym);
  });
  ok(!("neckTuck" in GB.front) && !("neckTuck" in GB.back) && !("necklineLenCm" in GB.front), "5: Ⓑ 에는 neckTuck·necklineLenCm 키가 없다");
  ok(!("waistSeam" in GI) && !("frontPeplum" in GI) && !("princess" in GI) && !("yokeSeam" in GI), "5: Ⓘ 는 조각 분리 슬롯을 만들지 않는다(몸판 한 장)");
}

// ── 5b. 렌더러 계약 — designRenderer 의 edge 어휘는 닫혀 있다(새 edge 이름은 bad-edge 로 렌더를 깬다) ──
{
  let err = null;
  try { DR.createWorkingGroup(GI); DR.createWorkingGroup(GB); } catch (e) { err = e.message; }
  ok(err === null, "5b: Ⓘ geometry 가 렌더러 검증을 통과한다" + (err ? " — " + err : ""));
  ok(GI.front.outline.every(p => !p.edge || ["neckline", "shoulder", "armhole", "side-seam", "center", "hem", "waist"].indexOf(p.edge) >= 0) && GI.back.outline.every(p => !p.edge || ["neckline", "shoulder", "armhole", "side-seam", "center", "hem", "waist"].indexOf(p.edge) >= 0), "5b: 외곽 edge 이름이 기존 어휘만 쓴다(틈 다리는 edge 없음)");
}

// ── 6. 표시 정보(표시 전용) ──
{
  const before = sha(GI);
  const A = W.peplumAnnotation;
  const m = A.buildModel(GI, I_BODY);
  ok(m.front && m.back && m.front.cuts.length === 2 && m.front.wedges.length === 2 && m.front.legs.length === 4, "6: 앞 표시 모델 = 틈 2 · 박기 끝 다리 4");
  ok(m.front.lines.some(l => l.id === "title" && l.text.indexOf("목둘레 턱 Ⓘ") > 0), "6: 제목");
  ok(m.front.lines.some(l => l.id === "amount" && l.text.indexOf("3.4 + 3.1 = 6.5cm") > 0), "6: 앞 총 벌림 3.4 + 3.1 = 6.5cm");
  ok(m.front.lines.some(l => l.id === "rule" && l.text.indexOf("18.25°") > 0 && l.text.indexOf("각 9.1") > 0), "6: 산식 문구(다트각·균등 분배)");
  ok(m.front.lines.some(l => l.id === "basis" && l.text.indexOf("바깥쪽") > 0 && l.text.indexOf("2.0cm") > 0), "6: 턱 방향·박기 끝 깊이 문구");
  ok(m.front.lines.filter(l => l.text === "박기 끝").length === 2, "6: 박기 끝 표기 2곳");
  ok(sha(GI) === before, "6: 표시 모델 생성은 geometry 를 바꾸지 않는다");
  const bad = clone(GI); bad.front.neckTuck.cuts.pop();
  ok(A.buildModel(bad, I_BODY).front === null, "6: 메타가 모자라면 안내선을 지어내지 않는다");
}

// ── 7. 체크포인트 · 변조 거부 ──
{
  PROJECT = MK(I_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "7: Ⓘ 몸판 검사 통과: " + c.fails.join());
  ok(c.neckTuck && c.neckTuck.ok && near(c.neckTuck.front.dartAngleDeg, 18.25, 1e-3) && near(c.neckTuck.back.dartAngleDeg, 11.38, 1e-3), "7: 목둘레 턱 검산 통과(출력 외곽에서 재계산)");
  ok(near(c.neckTuck.front.perCutAngleDeg, 9.125, 1e-3) && c.neckTuck.front.gapChordsCm.length === 2, "7: 절개별 각·현을 출력 외곽에서 직접 잰다");
  ok(near(c.neckline.front, GI.front.neckTuck.neckLenCm, 1e-6) && near(c.neckline.back, GI.back.neckTuck.neckLenCm, 1e-6), "7: 목선 계측 = 세 호의 합(카라가 소비하는 값)");
  const cb = (PROJECT = MK(B_BODY), BC.check(PROJECT));
  ok(near(c.neckline.front, cb.neckline.front, 2e-3) && near(c.neckline.back, cb.neckline.back, 2e-3), "7: 목선 길이 = Ⓑ(원형 목선)와 같다 — 턱이 길이를 바꾸지 않는다");
  ok(!("neckTuck" in cb), "7: Ⓑ — neckTuck 키 없음");
  PROJECT = MK(I_BODY);
  const done = BC.complete(PROJECT);
  ok(done.ok, "7: Ⓘ 몸판 완료: " + (done.reason || ""));
  const h1 = BC.latest(PROJECT).hash;
  ok(!BC.isCurrentBodiceChanged(PROJECT), "7: 같은 상태는 스테일 아님");
  PROJECT = MK(B_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash !== h1, "7: Ⓑ 와 Ⓘ 의 hash 가 다르다");
  PROJECT = MK(I_BODY); BC.complete(PROJECT);
  ok(BC.latest(PROJECT).hash === h1, "7: 같은 Ⓘ 는 같은 hash");
  const reasonOf = (p) => { PROJECT = p; const cc = BC.check(p); return cc.ok ? null : cc.fails[0]; };
  const t1 = MK(I_BODY); t1.working.geometry.front.neckTuck.cuts[0].gapChordCm += 0.2;
  ok(reasonOf(t1) === "neck-tuck-gap-mismatch" && BC.complete(t1).ok === false, "7: 메타 틈 변조 → 완료 차단");
  const t2 = MK(I_BODY); t2.working.geometry.back.neckTuck.dartAngleRad *= 1.1;
  ok(reasonOf(t2) === "neck-tuck-angle-mismatch", "7: 닫는 다트각 변조 → 거부(합 ≠ 다트각)");
  const t3 = MK(I_BODY); t3.working.parameters.body = Object.assign({}, I_BODY, { waistDartScales: { a: 1, b: 0, d: 0, e: 0 } });
  ok(reasonOf(t3) === "neck-tuck-waist-darts", "7: 허리 다트가 남으면 거부");
  const t4 = MK(I_BODY); t4.working.parameters.body = Object.assign({}, B_BODY);
  ok(reasonOf(t4) === "neck-tuck-mismatch", "7: 파라미터는 Ⓑ 인데 메타가 Ⓘ → 거부");
  const t5 = MK(I_BODY); delete t5.working.geometry.front.neckTuck;
  ok(reasonOf(t5) === "neck-tuck-missing", "7: 파라미터는 Ⓘ 인데 앞 메타 없음 → 거부");
  const t6 = MK(I_BODY); const sl = t6.working.geometry.front.outline.filter(isSlit)[1]; sl.to.x += 0.5;
  ok(reasonOf(t6) !== null, "7: 틈 다리 끝점 이동 → 거부(" + reasonOf(t6) + ")");
  const t7 = MK(I_BODY); t7.working.geometry.front.outline.pop();
  ok(reasonOf(t7) !== null, "7: 외곽 한 변 제거 → 거부(열림)");
  const t8 = MK(I_BODY); t8.working.geometry.front.outline.forEach(p => { if (isSlit(p)) delete p.dart; });
  ok(reasonOf(t8) !== null, "7: 틈 다리 선언(dart) 제거 → 거부");
  const t9 = MK(I_BODY); t9.working.geometry.back.neckTuck.neckLenCm += 0.5;
  ok(reasonOf(t9) === "neck-tuck-neckline-length", "7: 목둘레 호 길이 변조 → 거부");
  const t10 = MK(I_BODY); t10.working.parameters.body = Object.assign({}, I_BODY, { flare: true });
  ok(reasonOf(t10) === "neck-tuck-mismatch", "7: 플레어가 섞이면 거부");
  ["A", "G", "H", "F", "N", "V"].forEach(s => { PROJECT = MK(BP.bodyParams("bunka-bodice-" + s)); ok(BC.check(PROJECT).ok && !("neckTuck" in BC.check(PROJECT)), "7: Ⓐ~Ⓥ 검사 통과 · neckTuck 키 없음 — " + s); });
}

// ── 8. 소비자 불변 (소매·카라가 읽는 진동·목선) ──
{
  PROJECT = MK(I_BODY); const ci = BC.check(PROJECT);
  PROJECT = MK(B_BODY); const cb = BC.check(PROJECT);
  ["front", "back"].forEach(k => {
    ok(near(ci.armhole[k], cb.armhole[k], 2e-3), `8: ${k} 진동 길이(소매가 소비) = Ⓑ ${ci.armhole[k].toFixed(3)}`);
    ok(near(ci.neckline[k], cb.neckline[k], 2e-3), `8: ${k} 목선 길이(카라가 소비) = Ⓑ`);
  });
  ok(near(ci.sideSeam.front, cb.sideSeam.front, 1e-9) && ci.sideSeam.status === "match", "8: 옆선 길이 불변·앞뒤 일치");
  const g = BC.girthMeasure(MK(I_BODY)), gb = BC.girthMeasure(MK(B_BODY));
  ok(g.bust.outlineCm === gb.bust.outlineCm && g.waist.outlineCm === gb.waist.outlineCm, "8: 가슴·허리 외곽 둘레는 Ⓑ 와 같다(중심 조각이 고정)");
  ok(J(REF) === SNAP, "8: 원형 참조 불변");
}

console.log("══════════════════════════════════════════════");
console.log(`neckTuckPresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
