// ══════════════════════════════════════════════
// neckTuckJPresetCheck.js — 몸판 프리셋 Ⓙ(목둘레 턱 + 중심 턱 분량, P.23 · 처리 방법 P.161·P.162) 회귀.
//
// 사용자 확정(2026-10-04 — 책 P.23 은 «Ⓘ와 같이» 라고만 한다):
//   (A안) 절개 = Ⓘ 확정 규칙 그대로 — 앞·뒤 목둘레 호 1/3·2/3 두 곳 · 닫는 다트각 θ 를 각 θ/2 로 균등 분배.
//   그 뒤 앞·뒤 중심에 **평행 띠** 추가 — 폭 T = 앞 목둘레 틈 합(6.524cm)을 앞·뒤 공통으로 쓴다(도해 «6»).
//   박기 끝 = 새 중심선에서 목둘레 아래 2cm · 턱은 중심 쪽(표시 전용) · 새 CF/CB 목둘레 상단은 도해대로 수평으로 잇는다.
//   (1) 카탈로그·계약 (2) 절개·다트각 = Ⓘ (3) 띠 폭·방향·연결 (4) 물리 (5) 표시 전용 메타 (6) 원자적 거부 (7) Ⓐ~Ⓥ·Ⓘ 바이트 불변
//   (8) 표시 정보 (9) 체크포인트·변조 거부 (10) 소비자 불변
//   node test/harness/neckTuckJPresetCheck.js
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


const I_BODY = BP.bodyParams("bunka-bodice-I"), J_BODY = BP.bodyParams("bunka-bodice-J"), B_BODY = BP.bodyParams("bunka-bodice-B");
const GI = DB.computeGeometry(REF, { body: I_BODY });
const GJ = DB.computeGeometry(REF, { body: J_BODY });
const GB = DB.computeGeometry(REF, { body: B_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const bandOf = (pc) => pc.neckTuck.centerBand;
const centerPrims = (pc) => pc.outline.filter(p => p.edge === "center");
const plain = (pc) => pc.outline.filter(p => !p.edge && !p.dart);     // edge·dart 없는 선(연결선 · 뒤 sliver)
const gapSum = (pc) => pc.neckTuck.cuts.reduce((s, c) => s + c.gapChordCm, 0);
const TW = gapSum(GI.front);
const frameOf = (pc) => { const c = centerPrims(pc); return { x: c[0].from.x, y0: c[0].from.y, y1: c[c.length - 1].to.y }; };

// ── 1. 카탈로그 · 파라미터 계약 ──
{
  const v = BP.variant("neck-tuck", "bunka-bodice-J");
  ok(BP.resolve("neck-tuck", "bunka-bodice-J").ok && BP.resolve("neck-tuck", "bunka-bodice-J").presetId === "bunka-bodice-J", "1: Ⓙ 해석 성공");
  ok(v.availability === "available" && v.page === 23 && !v.blockedBy, "1: Ⓙ 슬롯 = 실행 가능 · P.23 · blockedBy 없음");
  ok(J(J_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, waistDartScales: { a: 0, b: 0, d: 0, e: 0 }, neckTuck: "J" }), "1: Ⓙ 레코드 = Ⓘ 와 같은 몸판 + neckTuck:\"J\"");
  const src = BP.get("bunka-bodice-J").source;
  ok(src.indexOf("P.23") > 0 && src.indexOf("P.162") > 0 && src.indexOf("사용자 확정") > 0, "1: 출처 = P.23·P.162 · 책 밖 규칙은 사용자 확정이라고 밝힌다");
  ok(BP.get("bunka-bodice-I").body.neckTuck === true, "1: Ⓘ 는 그대로 neckTuck:true");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, J_BODY, { neckTuck: "K" }) }), "invalid-body-neck-tuck", "1: neckTuck 는 true·\"J\" 만");
  throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, J_BODY, { neckTuck: 1 }) }), "invalid-body-neck-tuck", "1: 숫자 거부");
  ["flare", "waistSeam", "princess"].forEach(k => throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, J_BODY, { [k]: k === "princess" ? "E" : true }) }), "neck-tuck-conflict", "1: Ⓙ + " + k + " 거부"));
}

// ── 2. 절개 · 다트각은 Ⓘ 와 같다(사용자 확정: «Ⓘ와 같이» 우선) ──
{
  ["front", "back"].forEach(k => {
    const mi = GI[k].neckTuck, mj = GJ[k].neckTuck;
    ["dartAngleRad", "perCutAngleRad", "neckLenCm", "residualSliverCm", "depthCm", "fixedSide"].forEach(f => ok(mi[f] === mj[f], `2: ${k} ${f} 가 Ⓘ 와 같다`));
    ok(J(mi.cuts) === J(mj.cuts), `2: ${k} 절개 2곳(위치·틈·각)이 Ⓘ 와 정확히 같다`);
    ok(mj.cuts.length === 2 && near(mj.cuts[0].frac, 1 / 3) && near(mj.cuts[1].frac, 2 / 3), `2: ${k} 절개 = 목둘레 호 1/3·2/3 두 곳`);
    ok(near(Math.abs(mj.perCutAngleRad) * 2, Math.abs(mj.dartAngleRad), 1e-12) && near(mj.cuts[0].angleRad, mj.cuts[1].angleRad, 1e-12), `2: ${k} 각 절개 = θ/2 균등`);
    ok(near(Math.abs(mj.dartAngleRad) * 180 / Math.PI, ths[k], 1e-3), `2: ${k} 닫는 다트각 ${ths[k]}° 보존`);
    ok(GJ[k].outline.filter(isSlit).length === 4, `2: ${k} 틈 다리 4`);
    ok(near(GJ[k].necklineLenCm, GI[k].necklineLenCm, 1e-12), `2: ${k} 봉제 목둘레 길이 = Ⓘ(띠가 목둘레 길이를 바꾸지 않는다)`);
    ok(near(edgeLen(GJ[k], "neckline"), edgeLen(GI[k], "neckline"), 1e-9), `2: ${k} neckline 모서리 길이 합 = Ⓘ`);
  });
  ok(near(TW, 6.5234, 5e-4), "2: T = 앞 틈 합 6.523cm(도해 «6»)");
}

// ── 3. 중심 평행 띠 — 폭·방향·연결 ──
{
  ["front", "back"].forEach(k => {
    const pj = GJ[k], pi = GI[k], b = bandOf(pj);
    ok(near(b.widthCm, TW, 1e-12), `3: ${k} 띠 폭 T = 앞 목둘레 틈 합(앞·뒤 공통)`);
    const fi = frameOf(pi), fj = frameOf(pj), sgn = k === "front" ? 1 : -1;
    ok(near(fj.x - fi.x, sgn * TW, 1e-9) && near(fj.y0, fi.y0, 1e-12) && near(fj.y1, fi.y1, 1e-12), `3: ${k} 중심선이 ${k === "front" ? "+x" : "−x"} 바깥으로 T 만큼 평행 이동(y 불변)`);
    ok(centerPrims(pj).every(p => near(p.from.x, fj.x, 1e-12) && near(p.to.x, fj.x, 1e-12)), `3: ${k} 이동한 중심선은 수직선 한 줄`);
    ok(centerPrims(pj).length === centerPrims(pi).length && centerPrims(pj).every((p, i) => J(p.boundary) === J(centerPrims(pi)[i].boundary) && p.edge === "center"), `3: ${k} 중심선 조각 수·edge·boundary 선언 보존`);
    const cons = plain(pj).filter(p => p.kind === "line" && near(Math.abs(p.to.x - p.from.x), TW, 1e-9) && near(p.to.y, p.from.y, 1e-12));
    ok(cons.length === 2, `3: ${k} 수평 연결선 2개(윗변·아랫변) 길이 T · edge 이름 없음`);
    ok(cons.every(c => c.edge === undefined && c.dart === undefined), `3: ${k} 연결선은 edge·dart 가 없다(렌더러 어휘를 늘리지 않는다)`);
    const ys = cons.map(c => c.from.y).sort((a, c) => a - c);
    ok(near(ys[0], fi.y0, 1e-12) && near(ys[1], fi.y1, 1e-12), `3: ${k} 윗변 = 목둘레 끝 높이(수평) · 아랫변 = 밑단 높이(수평)`);
    // 띠 말고는 Ⓘ 와 같다 — 중심선·연결선만 다르다.
    const rest = (pc) => J(pc.outline.filter(p => p.edge !== "center" && !(!p.edge && !p.dart && p.kind === "line" && near(Math.abs(p.to.x - p.from.x), TW, 1e-9) && near(p.to.y, p.from.y, 1e-12))));
    ok(rest(pj) === rest(pi), `3: ${k} 중심선·연결선을 뺀 외곽 조각은 Ⓘ 와 바이트 동일(진동·옆선·어깨·목둘레·밑단·틈)`);
    ok(J(pj.construction) === J(pi.construction), `3: ${k} construction(원래 중심 쪽 기준선 포함) 불변`);
    ["armhole", "shoulder", "side-seam", "neckline"].forEach(e => ok(near(edgeLen(pj, e), edgeLen(pi, e), 1e-9), `3: ${k} ${e} 길이 = Ⓘ`));
    ok(near(edgeLen(pj, "center"), edgeLen(pi, "center"), 1e-9), `3: ${k} 중심선 길이 불변`);
  });
}

// ── 4. 물리 — 종이 위: 닫히고 겹치지 않고 면적 = Ⓘ + T×중심선 ──
{
  ["front", "back"].forEach(k => {
    const segs = segsOf(GJ[k].outline); let gap = 0;
    segs.forEach((s, i) => { gap = Math.max(gap, D(s.to, segs[(i + 1) % segs.length].from)); });
    ok(gap < 1e-4, `4: ${k} 외곽이 그린 순서대로 닫힌다(${gap.toExponential(1)})`);
    ok(!selfCross(segs), `4: ${k} 자기교차 0`);
    const cl = D(centerPrims(GI[k])[0].from, centerPrims(GI[k]).slice(-1)[0].to);
    ok(near(areaOf(segs) - areaOf(segsOf(GI[k].outline)), TW * cl, 1e-6), `4: ${k} 면적 증가 = T × 중심선 길이(${(TW * cl).toFixed(2)}cm²)`);
    ok(near(bandOf(GJ[k]).addedAreaCm2, TW * cl, 1e-9) && near(bandOf(GJ[k]).areaAfterCm2 - bandOf(GJ[k]).areaBeforeCm2, TW * cl, 1e-6), `4: ${k} 메타 면적 일관`);
    // 틈(열린 다트 V)은 띠와 겹치지 않는다 — 틈 다리의 x 가 띠 안쪽에 머문다.
    const sx = k === "front" ? 1 : -1, cx = frameOf(GJ[k]).x;
    ok(GJ[k].outline.filter(isSlit).every(p => { const e = segsOf([p])[0]; return sx * (e.from.x - cx) < 0 && sx * (e.to.x - cx) < 0; }), `4: ${k} 틈 다리가 모두 새 중심선 안쪽`);
  });
}

// ── 5. 표시 전용 메타 — 박기 끝 · 턱 방향 ──
{
  ["front", "back"].forEach(k => {
    const m = GJ[k].neckTuck, b = bandOf(GJ[k]), f = frameOf(GJ[k]);
    ok(m.tuckDirection === "center" && b.tuckDirection === "center", `5: ${k} 턱 방향 = 중심 쪽`);
    ok(near(b.stitchEnd.x, f.x, 1e-9) && near(b.stitchEnd.y, f.y0 + 2, 1e-9) && b.stitchEndCm === 2, `5: ${k} 박기 끝 = 새 중심선 위, 목둘레 아래 2cm (${b.stitchEnd.x.toFixed(3)}, ${b.stitchEnd.y.toFixed(3)})`);
    ok(!GJ[k].outline.some(p => p.stitchEnd) && J(GJ[k].outline).indexOf("stitch") < 0, `5: ${k} 박기 끝·턱 방향은 geometry 에 만들어 넣지 않는다`);
  });
  ok(GI.front.neckTuck.tuckDirection === "outward" && !("centerBand" in GI.front.neckTuck) && !("centerBand" in GI.back.neckTuck), "5: Ⓘ 는 바깥쪽 · centerBand 키 없음");
}

// ── 6. 원자적 거부 · 입력 검사 (designFlare.centerBand) ──
{
  const piece = { outline: clone(GI.front.outline), construction: clone(GI.front.construction) };
  const snap = J(piece);
  DF.centerBand(piece, { widthCm: 2 });
  ok(J(piece) === snap, "6: 입력 조각 불변");
  throwsReason(() => DF.centerBand(null, { widthCm: 2 }), "invalid-piece", "6: 조각 없음");
  [0, -1, NaN, "2", null, undefined].forEach(w => throwsReason(() => DF.centerBand(piece, { widthCm: w }), "invalid-band-width", "6: 폭 " + String(w) + " 거부"));
  throwsReason(() => DF.centerBand(piece, { widthCm: 2, stitchEndCm: 0 }), "invalid-stitch-end", "6: 박기 끝 0 거부");
  const noC = { outline: clone(GI.front.outline).map(p => p.edge === "center" ? Object.assign({}, p, { edge: "x" }) : p), construction: [] };
  throwsReason(() => DF.centerBand(noC, { widthCm: 2 }), "no-center-edge", "6: 중심 모서리 없음 거부");
  const split = clone(GI.front.outline); split.splice(split.findIndex(p => p.edge === "center") + 1, 0, split.splice(split.findIndex(p => p.edge === "hem"), 1)[0]);
  throwsReason(() => DF.centerBand({ outline: split, construction: [] }, { widthCm: 2 }), "", "6: 중심선이 끊기면 거부");
  const bent = clone(GI.front.outline); bent.filter(p => p.edge === "center")[0].to.x += 0.5;
  throwsReason(() => DF.centerBand({ outline: bent, construction: [] }, { widthCm: 2 }), "", "6: 휜 중심선 거부");
  const huge = DF.centerBand(piece, { widthCm: 2 }); ok(huge.outline.length === piece.outline.length + 2, "6: 연결선 2개만 늘어난다");
  const asym = DB.computeGeometry(REF, { body: Object.assign({}, J_BODY, { neckTuck: true }) });
  ok(J(asym) === J(GI), "6: neckTuck:true 는 여전히 Ⓘ(띠 없음)");
}

// ── 7. 기존 실행 가능 프리셋 geometry 바이트 불변 ──
{
  const WANT = { A: "f87b86b25abc", B: "3fade9d306cf", C: "d9ccd8ad2748", D: "dea05147006a", E: "c8445d93bfad", F: "21a011a86875", G: "d9a46f8358da", H: "c7c54c484627", I: "d0ecd75a37e3",
    M: "66936c94c7ce", N: "6b02cf3e2596", O: "d1fae91f00e5", P: "160d3aaee53e", Q: "76a325d296cd", R: "63193d5a879a", S: "8f5a2535f192", T: "04de67175bdb", U: "dc8c572d7432", V: "5237c10f1106" };
  Object.keys(WANT).forEach(sym => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + sym) })) === WANT[sym], "7: Ⓐ~Ⓥ(Ⓘ 포함) 바이트 불변 — " + sym + " (HEAD 5fecd46 에서 측정)"));
  ok(!("neckTuck" in GB.front) && !("waistSeam" in GJ) && !("frontPeplum" in GJ) && !("princess" in GJ), "7: Ⓙ 는 몸판 한 장(조각 분리 슬롯 없음)");
}

// ── 7b. 렌더러 계약 ──
{
  let err = null; try { DR.createWorkingGroup(GJ); } catch (e) { err = e.message; }
  ok(err === null, "7b: Ⓙ geometry 가 렌더러 검증을 통과한다" + (err ? " — " + err : ""));
  const vocab = ["neckline", "shoulder", "armhole", "side-seam", "center", "hem", "waist"];
  ok(["front", "back"].every(k => GJ[k].outline.every(p => !p.edge || vocab.indexOf(p.edge) >= 0)), "7b: 외곽 edge 이름이 기존 어휘만 쓴다");
}

// ── 8. 표시 정보(표시 전용) ──
{
  const before = sha(GJ), A = W.peplumAnnotation, m = A.buildModel(GJ, J_BODY);
  ok(m.front && m.back, "8: 앞·뒤 표시 모델 생성");
  ["front", "back"].forEach(k => {
    const mm = m[k];
    ok(mm.lines.some(l => l.id === "title" && l.text.indexOf("목둘레 턱 Ⓙ") > 0), `8: ${k} 제목 Ⓙ`);
    ok(mm.lines.some(l => l.id === "amount" && l.text.indexOf("중심 평행 띠 6.5cm") > 0), `8: ${k} 띠 폭 6.5cm 표기`);
    ok(mm.lines.some(l => l.id === "basis" && l.text.indexOf("중심 쪽") > 0 && l.text.indexOf("2.0cm") > 0), `8: ${k} 턱 방향(중심 쪽)·박기 끝 2.0cm 문구`);
    ok(mm.wedges.some(w => w.id === "band" && w.pts.length === 4) && mm.wedges.length === 3, `8: ${k} 띠 사각형 + 틈 2`);
    ok(mm.lines.filter(l => l.text === "박기 끝").length === 3 && mm.notches.some(n => n.id === "band-stitch-end"), `8: ${k} 박기 끝 표기 3곳(틈 2 + 띠 1)`);
    ok(near(mm.notches.find(n => n.id === "band-stitch-end").at.y, bandOf(GJ[k]).stitchEnd.y, 1e-12), `8: ${k} 박기 끝 표시 위치 = 메타`);
  });
  ok(sha(GJ) === before, "8: 표시 모델 생성은 geometry 를 바꾸지 않는다");
  const bad = clone(GJ); delete bad.front.neckTuck.centerBand.stitchEnd;
  ok(A.buildModel(bad, J_BODY).front === null, "8: 띠 메타가 모자라면 안내선을 지어내지 않는다");
  const mi = A.buildModel(GI, I_BODY);
  ok(mi.front.wedges.length === 2 && !mi.front.lines.some(l => l.text.indexOf("Ⓙ") > 0), "8: Ⓘ 표시는 그대로(띠 없음)");
}

// ── 9. 체크포인트 · 변조 거부 ──
{
  PROJECT = MK(J_BODY);
  const c = BC.check(PROJECT);
  ok(c.ok, "9: Ⓙ 몸판 검사 통과: " + c.fails.join());
  ok(c.neckTuck && c.neckTuck.ok && near(c.neckTuck.front.bandWidthCm, TW, 1e-4) && near(c.neckTuck.back.bandWidthCm, TW, 1e-4), "9: 띠 폭을 출력 외곽에서 재 앞·뒤 모두 T");
  ok(near(c.neckTuck.front.dartAngleDeg, 18.25, 1e-3) && near(c.neckTuck.back.dartAngleDeg, 11.38, 1e-3) && c.neckTuck.front.gapChordsCm.length === 2, "9: 다트각·틈 현도 같이 검산");
  ok(near(c.neckTuck.front.bandAreaCm2, TW * 54.925, 1e-3), "9: 띠 면적 = T × 중심선 길이");
  PROJECT = MK(I_BODY); const ci = BC.check(PROJECT);
  ok(ci.ok && !("bandWidthCm" in ci.neckTuck.front), "9: Ⓘ 검사는 띠 항목 없이 통과");
  PROJECT = MK(J_BODY);
  const done = BC.complete(PROJECT); ok(done.ok, "9: Ⓙ 몸판 완료: " + (done.reason || ""));
  const hJ = BC.latest(PROJECT).hash;
  PROJECT = MK(I_BODY); BC.complete(PROJECT); const hI = BC.latest(PROJECT).hash;
  PROJECT = MK(J_BODY); BC.complete(PROJECT);
  ok(hJ !== hI && BC.latest(PROJECT).hash === hJ, "9: Ⓙ hash ≠ Ⓘ hash · 같은 Ⓙ 는 같은 hash");
  const reasonOf = (p) => { PROJECT = p; const cc = BC.check(p); return cc.ok ? null : cc.fails[0]; };
  const mod = (fn) => { const p = MK(J_BODY); fn(p.working.geometry); return p; };
  const frontCenters = (g) => g.front.outline.filter(p => p.edge === "center");
  ok(reasonOf(mod(g => { g.front.neckTuck.centerBand.widthCm += 0.2; })) === "neck-tuck-band-width", "9: 메타 띠 폭 변조 → 거부");
  ok(reasonOf(mod(g => { frontCenters(g).forEach(p => { p.from.x += 0.3; p.to.x += 0.3; }); })) !== null, "9: 중심선만 더 밀기(연결선 불변) → 거부(" + reasonOf(mod(g => { frontCenters(g).forEach(p => { p.from.x += 0.3; p.to.x += 0.3; }); })) + ")");
  ok(reasonOf(mod(g => { g.back.outline.filter(p => p.edge === "center").forEach(p => { p.from.x -= 0.4; p.to.x -= 0.4; }); })) !== null, "9: 뒤 중심선 이동 → 거부");
  const lone = mod(g => { const t = g.front.outline.find(p => !p.edge && !p.dart && p.kind === "line" && Math.abs(p.to.x - p.from.x) > 1); t.edge = "hem"; });
  ok(reasonOf(lone) === "neck-tuck-band-connector", "9: 연결선에 edge 를 붙이면 거부");
  ok(reasonOf(mod(g => { delete g.front.neckTuck.centerBand; })) === "neck-tuck-mismatch", "9: 파라미터는 Ⓙ 인데 앞 띠 메타 없음 → 거부");
  ok(reasonOf(mod(g => { delete g.back.neckTuck.centerBand; })) === "neck-tuck-mismatch", "9: 뒤 띠 메타 없음 → 거부");
  ok(reasonOf(mod(g => { g.back.neckTuck.centerBand.widthCm = 2; })) === "neck-tuck-band-width", "9: 뒤 띠 폭이 앞 틈 합과 다르면 거부");
  ok(reasonOf(mod(g => { g.front.neckTuck.centerBand.centerLenCm += 1; })) === "neck-tuck-band-area", "9: 중심선 길이 메타 변조 → 거부");
  ok(reasonOf(mod(g => { g.front.neckTuck.cuts[0].gapChordCm += 0.2; })) === "neck-tuck-gap-mismatch", "9: 틈 현 변조 → 거부(Ⓘ 검사 유지)");
  ok(reasonOf(mod(g => { g.back.neckTuck.dartAngleRad *= 1.1; })) === "neck-tuck-angle-mismatch", "9: 다트각 변조 → 거부");
  const inward = mod(g => { const f = g.front.outline; const cs = f.filter(p => p.edge === "center"); cs.forEach(p => { p.from.x -= 2 * TW; p.to.x -= 2 * TW; }); const t = f.find(p => !p.edge && !p.dart && p.kind === "line" && Math.abs(p.to.x - p.from.x) > 1 && p.from.y < 10), u = f.filter(p => !p.edge && !p.dart && p.kind === "line" && Math.abs(p.to.x - p.from.x) > 1 && p.from.y > 10)[0]; t.to.x -= 2 * TW; u.from.x -= 2 * TW; });
  ok(reasonOf(inward) !== null, "9: 띠를 안쪽(반대 방향)으로 접으면 거부(" + reasonOf(inward) + ")");
  ok(reasonOf(mod(g => { g.front.outline.pop(); })) !== null, "9: 외곽 한 변 제거 → 거부");
  const pJ = MK(J_BODY); pJ.working.parameters.body = Object.assign({}, I_BODY);
  ok(reasonOf(pJ) === "neck-tuck-mismatch", "9: 파라미터는 Ⓘ 인데 Ⓙ 형상 → 거부");
  const pI = MK(I_BODY, GJ); pI.working.parameters.body = Object.assign({}, I_BODY);
  ok(reasonOf(pI) === "neck-tuck-mismatch", "9: 파라미터 Ⓘ + Ⓙ geometry → 거부(띠가 메타로 신고됨)");
  const pF = MK(J_BODY); pF.working.parameters.body = Object.assign({}, J_BODY, { flare: true });
  ok(reasonOf(pF) === "neck-tuck-mismatch", "9: 플레어가 섞이면 거부");
  const pW = MK(J_BODY); pW.working.parameters.body = Object.assign({}, J_BODY, { waistDartScales: { a: 1, b: 0, d: 0, e: 0 } });
  ok(reasonOf(pW) === "neck-tuck-waist-darts", "9: 허리 다트가 남으면 거부");
  ["A", "G", "H", "I", "N", "V"].forEach(s => { PROJECT = MK(BP.bodyParams("bunka-bodice-" + s)); const cc = BC.check(PROJECT); ok(cc.ok && (s === "I" ? !("bandWidthCm" in cc.neckTuck.front) : !("neckTuck" in cc)), "9: 다른 프리셋 검사 통과 · 띠 항목 없음 — " + s); });
}

// ── 10. 소비자 불변 ──
{
  PROJECT = MK(J_BODY); const cj = BC.check(PROJECT);
  PROJECT = MK(I_BODY); const ci = BC.check(PROJECT);
  ["front", "back"].forEach(k => {
    ok(near(cj.armhole[k], ci.armhole[k], 1e-9), `10: ${k} 진동 길이(소매가 소비) = Ⓘ ${cj.armhole[k].toFixed(3)}`);
    ok(near(cj.neckline[k], ci.neckline[k], 1e-9), `10: ${k} 목선 길이(카라가 소비) = Ⓘ ${cj.neckline[k].toFixed(3)}`);
  });
  ok(near(cj.sideSeam.front, ci.sideSeam.front, 1e-9) && cj.sideSeam.status === "match", "10: 옆선 길이 불변·앞뒤 일치");
  ok(J(REF) === SNAP, "10: 원형 참조 불변");
}

console.log("══════════════════════════════════════════════");
console.log(`neckTuckJPresetCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
