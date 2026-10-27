// ══════════════════════════════════════════════
// sleeveCapSplitCheck.js — 소매산 앞/뒤 계측 분할 기준 회귀(2026-10-13 수정: Ⓙ·Ⓚ 상승 0 에서 한쪽 SP 로 쏠리던 문제).
//   명시 기준 geometry.capSplit = { x }(소매 중심선 = 틈 이등분선) → 공용 측정 designSleeve.capPrimitives 가 최종 소매산 × 그 세로선의 교점에서 나눈다.
//   (1) 독립 적분(조밀 점열 · 중심선에서 분할)과 공용 측정 일치 — 상승 0 / 0.7 / 1.5 · 손바닥 · 몸판 · 소매길이 (2) 앞 + 뒤 = 총 · Ⓐ 이세 + 추가 개더 = 총 차이
//   (3) 엔진 meta · 표시 줄 · 제작 정보 · 완료본이 같은 기준 (4) 기준 없는 소매(원형 · Ⓐ~Ⓘ)는 옛 규칙(가장 높은 앵커) 그대로 (5) 잘못된 기준은 측정 불가(null) — 조용한 폴백 없음
//   (6) 교점이 앵커가 아닐 때: 측정용으로만 나눔(geometry 불변) (7) 완료본 갱신·동결 · 표시 on/off 불변
//   node test/harness/sleeveCapSplitCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
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
  "designSleeveA.js", "designSleeveB.js", "sleevePresets.js", "sleeveAApply.js", "sleeveBApply.js", "designSleeveC.js", "sleeveCApply.js", "designSleeveD.js", "sleeveDApply.js",
  "designSleeveE.js", "sleeveEApply.js", "designSleeveF.js", "sleeveFApply.js", "designSleeveG.js", "sleeveGApply.js", "designSleeveH.js", "sleeveHApply.js",
  "designSleeveI.js", "sleeveIApply.js", "designSleeveJ.js", "sleeveJApply.js", "designSleeveK.js", "sleeveKApply.js", "sleeveAnnotation.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SA = W.designSleeveA, DS = W.designSleeve, SC = W.sleeveCheckpoint, SAN = W.sleeveAnnotation;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const MK = (body) => ({ sourceBlock: { id: "blk", version: 2, schemaVersion: 8, canonicalHash: "abc" }, referenceGeometry: JSON.parse(J(REF)),
  working: { geometry: DB.computeGeometry(REF, { body }), parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body },
    patternLines: [], designOutline: null, frontPlacket: null } });
const presets = () => { const o = []; for (const f of BP.families()) for (const v of f.variants) o.push([v.symbol, v.presetId]); return o; };
function projectWithBodice(id) { PROJECT = MK(BP.bodyParams(id)); const r = BC.complete(PROJECT); return r.ok ? PROJECT : null; }
const ID_A = presets().find(p => p[0] === "A")[1];
const f2 = v => (Math.round(v * 100) / 100).toFixed(2), sg = v => (v >= 0 ? "+" : "") + f2(v);
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ENG = { J: W.designSleeveJ.draftSleeveJ, K: W.designSleeveK.draftSleeveK }, APP = { J: W.sleeveJApply, K: W.sleeveKApply };

// ── 독립 측정(공용 모듈과 다른 구현): 소매산을 조밀 점열로 따라가며 세로선 x = X0 을 넘는 곳에서 나눈다 ──
const cubsOf = (p) => { const o = []; let cur = p.commands[0].points[0]; p.commands.slice(1).forEach(c => { o.push([cur, c.points[0], c.points[1], c.points[2]]); cur = c.points[2]; }); return o; };
const cub = (q, t) => { const u = 1 - t; return { x: u*u*u*q[0].x + 3*u*u*t*q[1].x + 3*u*t*t*q[2].x + t*t*t*q[3].x, y: u*u*u*q[0].y + 3*u*u*t*q[1].y + 3*u*t*t*q[2].y + t*t*t*q[3].y }; };
function indep(capPath, X0, N = 3000) {
  let back = 0, front = 0, crossed = false, prev = null, at = null;
  cubsOf(capPath).forEach(q => { for (let i = (prev ? 1 : 0); i <= N; i++) { const p = cub(q, i / N);
    if (prev) { const d = D(prev, p);
      if (!crossed && prev.x < X0 && p.x >= X0) { const t = (X0 - prev.x) / (p.x - prev.x); back += d * t; front += d * (1 - t); crossed = true; at = { x: X0, y: prev.y + (p.y - prev.y) * t }; }
      else if (crossed) front += d; else back += d; }
    prev = p; } });
  return { back, front, total: back + front, at };
}
const TOL = 5e-3;   // 공용 측정(꺾은선) ↔ 조밀 적분의 방법 차 허용
const sameSplit = (prim, ind) => !!prim && Math.abs(prim.lengths.back - ind.back) < TOL && Math.abs(prim.lengths.front - ind.front) < TOL;

const P0 = projectWithBodice(ID_A), BA = P0.working.bodiceResult, AH = BA.armholeLengths;
const A52 = SA.draftSleeveA(BA, { sleeveLengthCm: 52 }), X0 = A52.meta.sp.x;

// ── 1. 핵심 재현: 상승 0 — 중심선에서 나눈 독립 적분 = 공용 측정 ──
for (const e of ["J", "K"]) {
  const r = ENG[e](A52, { riseCm: 0 }), g = r.geometry, prim = DS.capPrimitives(g), ind = indep(g.outline[0], X0);
  ok(r.ok && J(Object.keys(g)) === J(["outline", "construction", "capSplit"]) && g.capSplit.x === X0, "1 " + e + ": 엔진이 분할 기준(중심선 x)을 geometry 에 명시");
  ok(sameSplit(prim, ind), "1 " + e + ": 상승 0 — 공용 측정 뒤 " + prim.lengths.back.toFixed(3) + " · 앞 " + prim.lengths.front.toFixed(3) + " = 중심선 독립 적분 뒤 " + ind.back.toFixed(3) + " · 앞 " + ind.front.toFixed(3));
  ok(Math.abs(prim.splitPoint.x - X0) < 1e-9 && Math.abs(prim.splitPoint.y - A52.meta.sp.y) < 1e-9 && D(prim.splitPoint, r.meta.rise.top) < 1e-9, "1 " + e + ": 분할점 = 틈 가운데 꼭대기(한쪽 SP 가 아님)");
  ok(Math.abs(prim.lengths.back - r.meta.capLengths.back) < TOL && Math.abs(prim.lengths.front - r.meta.capLengths.front) < TOL, "1 " + e + ": 엔진 meta 와 같은 기준");
  // 기준을 지우면 옛 규칙(가장 높은 앵커 = 왼쪽 SP)으로 돌아가 틀린 값이 된다 — 수정이 이 기준 하나에 달려 있음을 고정
  const legacy = DS.capPrimitives({ outline: g.outline, construction: g.construction }), halfGap = r.meta.formula.spread / (e === "J" ? 2 : 6);
  ok(legacy && Math.abs(legacy.splitPoint.x - (X0 - halfGap)) < 1e-9 && Math.abs((ind.back - legacy.lengths.back) - halfGap) < TOL, "1 " + e + ": 기준이 없으면 옛 규칙 = 왼쪽 SP(오차 = 틈 반폭 " + halfGap.toFixed(3) + ")");
  ok(Math.abs(legacy.lengths.total - prim.lengths.total) < 1e-9, "1 " + e + ": 총길이는 기준과 무관하게 같음");
}

// ── 2. sweep: 몸판 × 소매길이 × 손바닥 × 상승 ──
{
  let n = 0, worst = { split: 0, sum: 0, meta: 0, ident: 0, at: 0 }; const bad = [];
  for (const [sym, id] of presets()) {
    const pj = projectWithBodice(id); if (!pj) continue; const br = pj.working.bodiceResult, ah = sandbox.window.designSleeveA.sewnArmholeLengths(br);   // 봉제용 AH(Ⓜ·Ⓝ 틈 메움 직선 제외 — 2026-10-27)
    for (const SL of [40, 52, 64]) {
      const a = SA.draftSleeveA(br, { sleeveLengthCm: SL }); if (!a.ok) continue; const x0 = a.meta.sp.x, capA = indep(a.geometry.outline[0], x0);
      for (const palm of [18, 21, 24]) for (const rise of [0, 0.7, 1.5]) for (const e of ["J", "K"]) {
        const r = ENG[e](a, { palmCircumferenceCm: palm, riseCm: rise }), tag = [e, sym, SL, palm, rise].join("/");
        if (!r.ok) { bad.push(tag + ":" + r.reason); continue; }
        n++;
        const prim = DS.capPrimitives(r.geometry), ind = indep(r.geometry.outline[0], x0);
        if (!prim) { bad.push(tag + ":null"); continue; }
        worst.split = Math.max(worst.split, Math.abs(prim.lengths.back - ind.back), Math.abs(prim.lengths.front - ind.front));
        worst.sum = Math.max(worst.sum, Math.abs(prim.lengths.back + prim.lengths.front - prim.lengths.total));
        worst.meta = Math.max(worst.meta, Math.abs(r.meta.capLengths.back - ind.back), Math.abs(r.meta.capLengths.front - ind.front));
        worst.at = Math.max(worst.at, Math.abs(prim.splitPoint.x - x0), D(prim.splitPoint, ind.at));
        // Ⓐ 실측 이세 + 추가 개더 = 최종 − AH (앞·뒤 각각, 독립 측정값으로)
        for (const side of ["back", "front"]) worst.ident = Math.max(worst.ident, Math.abs((capA[side] - ah[side]) + (prim.lengths[side] - capA[side]) - (ind[side] - ah[side])),
          Math.abs(r.meta.easeA[side] - (capA[side] - ah[side])), Math.abs(r.meta.addedGather[side] - (ind[side] - capA[side])));
      }
    }
  }
  console.log("  sweep: " + n + " 경우 · 최악 " + J({ split: +worst.split.toFixed(5), sum: worst.sum, meta: +worst.meta.toFixed(5), ident: +worst.ident.toFixed(5), at: +worst.at.toFixed(6) }));
  ok(n >= 900 && !bad.length, "2: sweep 전부 측정됨 " + n + " " + bad.slice(0, 3).join(" "));
  ok(worst.split < TOL && worst.at < 1e-3, "2: 앞/뒤 = 중심선 독립 적분(상승 0 포함) 최대 차 " + worst.split.toExponential(2));
  ok(worst.sum < 1e-12, "2: 앞 + 뒤 = 총길이");
  ok(worst.meta < 2e-3 && worst.ident < TOL, "2: 엔진 meta 같은 기준 · Ⓐ 이세 + 추가 개더 = 최종 − AH(앞·뒤 각각)");
}

// ── 3. 기준 없는 소매는 옛 규칙 그대로(원형 소매 · Ⓐ~Ⓘ) ──
{
  const legacyRule = (geom) => { const cs = cubsOf(geom.outline.find(s => s.role === "cap" && s.kind === "path") || geom.outline[0]); let best = null, bi = -1;
    cs.forEach((q, i) => { if (i < cs.length - 1 && (best === null || q[3].y < best.y)) { best = q[3]; bi = i; } }); return best; };
  const lines = [["A", W.sleeveAApply, { sleeveLengthCm: 52 }, true], ["D", W.sleeveDApply, { sleeveLengthCm: 52 }], ["E", W.sleeveEApply, { sleeveLengthCm: 52 }],
    ["H", W.sleeveHApply, { sleeveLengthCm: 52, elbowLengthCm: 31.4, palmCircumferenceCm: 21, dropCm: 3.5 }], ["I", W.sleeveIApply, { sleeveLengthCm: 52, palmCircumferenceCm: 21 }]];
  lines.forEach(([sym, api, inp, lenOnly]) => {
    const P = projectWithBodice(ID_A), r = lenOnly ? api.apply(P, inp) : api.apply(P, inp), g = P.working.geometry.sleeve, prim = DS.capPrimitives(g);
    ok(r.ok && g.capSplit === undefined && prim && g.outline[0].kind === "path" && D(prim.splitPoint, legacyRule(g)) < 1e-9, "3 " + sym + ": 기준 없음 → 옛 규칙(가장 높은 앵커) 그대로");
  });
  // 원형(일반) 소매: 이 하네스의 고정 자료는 소매 외곽이 비어 있어 여기서는 잴 수 없다(수정 전에도 null) — 일반 소매 계측은 기존 designSleeve·sleeveCheckpoint 스위트가 검증한다.
  //   여기서는 «기준 필드가 없으면 새 분기를 타지 않는다»만 고정한다: 같은 Ⓐ geometry 에 capSplit: undefined/null 을 줘도 결과가 같다.
  const PA = projectWithBodice(ID_A); W.sleeveAApply.apply(PA, { sleeveLengthCm: 52 }); const ga = PA.working.geometry.sleeve, p0 = DS.capPrimitives(ga);
  ok(J(DS.capPrimitives({ outline: ga.outline, construction: ga.construction, capSplit: undefined })) === J(p0) && J(DS.capPrimitives({ outline: ga.outline, construction: ga.construction, capSplit: null })) === J(p0), "3: 기준 필드가 없거나 비어 있으면 옛 경로 결과와 완전히 같음");
}

// ── 4. 잘못된 기준 = 측정 불가(조용한 폴백 없음) · 5. 앵커가 아닌 교점 ──
{
  const r = ENG.J(A52, {}), g = r.geometry, base = DS.capPrimitives(g), xs = cubsOf(g.outline[0]).flatMap(q => [q[0].x, q[3].x]), xmin = Math.min(...xs), xmax = Math.max(...xs);
  [[{ x: NaN }, "NaN"], [{ x: "0" }, "문자열"], [{}, "x 없음"], [{ x: xmin - 5 }, "소매산 왼쪽 밖"], [{ x: xmax + 5 }, "소매산 오른쪽 밖"], [{ x: xmin }, "끝점(진동밑)"]].forEach(([cs, why]) => {
    ok(DS.capPrimitives({ outline: g.outline, construction: g.construction, capSplit: cs }) === null && DS.capLineFromGeometry({ outline: g.outline, capSplit: cs }) === null, "4: 잘못된 기준(" + why + ") → null"); });
  const before = J(g), xq = X0 + 1.0, q = DS.capPrimitives({ outline: g.outline, construction: g.construction, capSplit: { x: xq } }), ind = indep(g.outline[0], xq);
  ok(q && Math.abs(q.splitPoint.x - xq) < 1e-9 && sameSplit(q, ind) && Math.abs(q.lengths.total - base.lengths.total) < 1e-3, "5: 앵커가 아닌 교점에서도 정확히 나눔(뒤 " + q.lengths.back.toFixed(3) + " = 독립 " + ind.back.toFixed(3) + ")");
  ok(J(g) === before && q.backPrimitives.length + q.frontPrimitives.length === base.backPrimitives.length + base.frontPrimitives.length + 1, "5: 측정용 세그먼트만 나눔 — geometry 불변");
}

// ── 6. 표시 줄 · 제작 정보 · 완료본이 같은 기준(상승 0) · 7. 완료본 갱신·동결 · 표시 on/off 불변 ──
for (const e of ["J", "K"]) {
  const P = projectWithBodice(ID_A), IN0 = { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0 }, api = APP[e], key = "sleeve" + e;
  const ap = api.apply(P, IN0), g = P.working.geometry.sleeve, ind = indep(g.outline[0], X0), prim = DS.capPrimitives(g), ca = P.working[key].meta.capLengthsA;
  ok(ap.ok && g.capSplit && g.capSplit.x === X0 && sameSplit(prim, ind), "6 " + e + ": 적용된 geometry 에 기준 보존 · 공용 측정 = 독립 적분");
  const L = api.infoLines(P).join("\n");
  ok(L.indexOf("소매산(최종 실측) 앞 " + f2(ind.front) + " · 뒤 " + f2(ind.back)) >= 0, "6 " + e + ": 표시 줄 앞/뒤 = 중심선 기준 실측(" + f2(ind.front) + " / " + f2(ind.back) + ")");
  ok(L.indexOf("Ⓐ 실측 이세 앞 " + sg(ca.front - AH.front) + " · 뒤 " + sg(ca.back - AH.back)) >= 0 && L.indexOf("추가 개더(최종 − Ⓐ 소매산) 앞 " + sg(prim.lengths.front - ca.front) + " · 뒤 " + sg(prim.lengths.back - ca.back)) >= 0
    && L.indexOf("이세 + 개더 총량 앞 " + sg(prim.lengths.front - AH.front) + " · 뒤 " + sg(prim.lengths.back - AH.back)) >= 0, "6 " + e + ": Ⓐ 이세 · 추가 개더 · 총량 줄이 같은 분할");
  ok(Math.abs((ca.front - AH.front) + (prim.lengths.front - ca.front) - (ind.front - AH.front)) < TOL && Math.abs((ca.back - AH.back) + (prim.lengths.back - ca.back) - (ind.back - AH.back)) < TOL, "6 " + e + ": 이세 + 추가 개더 = 총 차이(독립값)");
  const mdl = SAN.buildModel(P), txt = (id) => (mdl.lines.find(l => l.id === id) || {}).text;
  ok(txt("cap-back-1").indexOf(f2(ind.back)) >= 0 && txt("cap-front-1").indexOf(f2(ind.front)) >= 0 && txt("cap-back-2").indexOf(sg(ind.back - AH.back)) >= 0, "6 " + e + ": 제작 정보의 앞/뒤 길이·차이도 같은 기준");
  const c = SC.check(P); ok(c.ok && Math.abs(c.capLengths.back - ind.back) < TOL && Math.abs(c.ease.front - (ind.front - AH.front)) < TOL, "6 " + e + ": 게이트 계측 = 독립 적분 " + J(c.fails));
  const R = SC.complete(P).result;
  ok(R && Object.isFrozen(R) && Object.isFrozen(R.cap) && Math.abs(R.cap.lengths.back - ind.back) < TOL && Math.abs(R.cap.lengths.front - ind.front) < TOL && Math.abs(R.cap.splitPoint.x - X0) < 1e-9 && J(R.geometry) === J(g) && R.geometry.capSplit.x === X0,
    "7 " + e + ": 완료본(동결) 앞/뒤 = 중심선 기준 · 분할점 = 꼭대기 · geometry(기준 포함) 복사");
  ok(SC.isCurrentSleeveChanged(P) === false, "7 " + e + ": 완료 직후 변경 없음");
  const snap = J({ g: P.working.geometry, s: P.working[key], r: P.working.sleeveResult }), h0 = R.hash;
  SAN.buildModel(P); SAN.buildModel(P, { pieces: false }); SAN.refModel(P, 10); api.infoLines(P); DS.capPrimitives(P.working.geometry.sleeve);
  ok(J({ g: P.working.geometry, s: P.working[key], r: P.working.sleeveResult }) === snap && P.working.sleeveResult.hash === h0 && SC.isCurrentSleeveChanged(P) === false, "7 " + e + ": 표시 on/off·측정 호출 = 상태·완료본·hash 불변");
  api.apply(P, { sleeveLengthCm: 52, palmCircumferenceCm: 21, riseCm: 0.7 });
  ok(SC.isCurrentSleeveChanged(P) === true && P.working.sleeveResult.hash === h0, "7 " + e + ": 상승 변경 → 변경됨(완료본은 다시 완료하기 전까지 그대로)");
  const R2 = SC.complete(P).result, ind2 = indep(P.working.geometry.sleeve.outline[0], X0);
  ok(R2.hash !== h0 && Object.isFrozen(R2) && Math.abs(R2.cap.lengths.back - ind2.back) < TOL && SC.isCurrentSleeveChanged(P) === false, "7 " + e + ": 다시 완료 → 완료본 갱신(새 hash · 동결)");
  api.apply(P, IN0); const R3 = SC.complete(P).result; ok(R3.hash === h0, "7 " + e + ": 같은 입력으로 돌아오면 같은 hash(결정적)");
  delete P.working.geometry.sleeve.capSplit; ok(SC.check(P).fails.indexOf("sleeve-" + e.toLowerCase() + "-geometry-mismatch") >= 0, "7 " + e + ": 기준이 사라진 geometry 는 게이트에서 거부");
}

console.log("\n══════════════════════════════════════════════");
if (fails.length) console.log("실패:\n  " + fails.join("\n  "));
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
