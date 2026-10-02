// yokeSeamVCheck.js — 요크 이음선 ③ Ⓥ(P.35, «Ⓤ 방법 + 앞뒤에서 개더 분량을 추가») 회귀.
//   node test/harness/yokeSeamVCheck.js
// 책이 정한 공식: 뒤 개더 = ∅ × 1(Ⓤ ×0.5, ∅ = 이음선 − 2) · 앞 총 개더 = ● × 1.2(● = 앞 이음선 − 양 끝 2cm × 2) · 앞 = Ⓤ(AH 쐐기 유지) + BP→밑단 수직 절개를
//   앞중심 쪽 조각이 수평으로 평행 이동(P.162). 평행 벌림의 이음선 기여분 e = 1.2● − Ⓤ 쐐기 g(B=83 에서 ≈5.37 — 도해 «5 정도» 는 참고 결과) ·
//   수평 이동 d 는 총 초과분이 정확히 1.2● 가 되게 푼 해(≈5.45). 끊긴 이음선은 길이 보존 fairing. Ⓤ 어깨 요크·A~Ⓤ geometry 는 바이트 불변(HEAD 21f8fe5 측정).
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); } else PASS++; }
}
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));
const sha = (v) => crypto.createHash("sha256").update(J(v)).digest("hex").slice(0, 16);

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
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designBodice.js", "bodicePresets.js",
  "designLayout.js", "designRenderer.js", "bodiceCheckpoint.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool, DY = W.designYokeSeam;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const edgesOf = (pc, e) => segsOf(pc.outline).filter(s => s.edge === e);
const arcLen = (segs) => segs.reduce((t, s) => t + T.flattenLine([s]).reduce((u, ab) => u + D(ab[0], ab[1]), 0), 0);
const areaOf = (segs) => { const pts = []; T.flattenLine(segs).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };
// 방향 무관 폐곡선 순서 정렬(독립 구현)
function ringOf(outline, eps = 1e-6) {
  const segs = segsOf(outline), used = segs.map(() => false); used[0] = true; const out = [segs[0]]; let tip = segs[0].to;
  for (let k = 1; k < segs.length; k++) {
    let hit = -1, rev = false;
    for (let j = 0; j < segs.length; j++) { if (used[j]) continue; if (D(segs[j].from, tip) < eps) { hit = j; break; } if (D(segs[j].to, tip) < eps) { hit = j; rev = true; break; } }
    if (hit < 0) return null; used[hit] = true; const sg = rev ? T.reverseSeg(segs[hit]) : segs[hit]; out.push(sg); tip = sg.to;
  }
  return D(tip, out[0].from) < eps ? out : null;
}
const selfCross = (ring) => { const f = []; ring.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab)));
  for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) { if (i === 0 && j === f.length - 1) continue; if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
    const t = (a, b) => D(a, b) < 1e-6; if (t(f[i][1], f[j][0]) || t(f[j][1], f[i][0]) || t(f[i][0], f[j][0]) || t(f[i][1], f[j][1])) continue; return true; } return false; };


const V_BODY = BP.bodyParams("bunka-bodice-V"), U_BODY = BP.bodyParams("bunka-bodice-U"), Q_BODY = BP.bodyParams("bunka-bodice-Q"), B_BODY = BP.bodyParams("bunka-bodice-B");
const GV = DB.computeGeometry(REF, { body: V_BODY });
const GU = DB.computeGeometry(REF, { body: U_BODY });
const GQ = DB.computeGeometry(REF, { body: Q_BODY });
const GB = DB.computeGeometry(REF, { body: B_BODY });

// ── 1. 프리셋 Ⓥ ──
ok(BP.resolve("yoke-seam-3", "bunka-bodice-V").ok, "1: Ⓥ 해석 성공(실행 가능)");
ok(BP.variant("yoke-seam-3", "bunka-bodice-V").availability === "available" && BP.variant("yoke-seam-3", "bunka-bodice-V").page === 35, "1: Ⓥ available · P.35");
ok(J(V_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "V" }), "1: Ⓥ 파라미터 = 박시 Ⓑ + 밑단 옆 +1 + yokeSeam:V");
ok(BP.yokeVariantSymbol(V_BODY) === "V" && BP.yokeVariantSymbol(U_BODY) === "U", "1: body → 변형 기호(V/U)");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, V_BODY, { yokeGather: true }) }), "yoke-seam-u-no-gather", "1: Ⓥ 에 개더 지정 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, V_BODY, { waistSeam: true }) }), "yoke-seam-waist-seam-conflict", "1: 요크+허리 이음선 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, V_BODY, { hemSideOffsetCm: 2.5 }) }), "yoke-seam-failed", "1: 밑단 옆 +1 이 아니면 거부");
ok(J(DB.computeGeometry(REF, { body: V_BODY })) === J(GV), "1: 결정론(같은 입력 → 바이트 동일)");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. A~Ⓤ 바이트 불변(HEAD 21f8fe5 측정) ──
const FIXED = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", G: "d9a46f8358daec84",
  M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37", P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce", R: "63193d5a879a6235",
  S: "8f5a2535f192f935", T: "04de67175bdb54f3", U: "dc8c572d74324b3b" };
Object.keys(FIXED).forEach(k => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + k) })) === FIXED[k], "2: " + k + " geometry 바이트 불변"));

// ── 3. 모양 · 어깨 요크는 Ⓤ 와 바이트 동일 ──
const mV = GV.yokeSeam, mU = GU.yokeSeam;
ok(GV.shoulderYoke && GV.frontBody && GV.backBody && !("frontYoke" in GV) && !("backYoke" in GV), "3: 어깨 요크 한 장 + 앞·뒤 몸판(Ⓤ 와 같은 슬롯)");
ok(J(GV.shoulderYoke) === J(GU.shoulderYoke), "3: 어깨 요크(외곽·구성선)는 Ⓤ 와 바이트 동일");
ok(J(mV.shoulderYoke) === J(mU.shoulderYoke), "3: 어깨 맞댐 메타도 Ⓤ 와 동일(뒤 다트 먼저 닫기 → 앞 요크 맞댐)");
ok(J(GV.front) === J(GU.front) && J(GV.back) === J(GU.back) && J(GV.shared) === J(GU.shared) && J(GV.sleeve) === J(GU.sleeve), "3: 전체 앞/뒤판·소매는 Ⓤ 와 동일");
ok(mV.variant === "V" && mV.front.variant === "V" && mV.back.variant === "V", "3: 메타 variant V");
ok(J(mV.front.seamPoints) === J(mU.front.seamPoints) && mV.front.seamLenUpperCm === mU.front.seamLenUpperCm, "3: 앞 이음선 양 끝·1/2점·BP 는 Ⓤ 와 동일(규칙 ① 재사용)");
const ptAreaOf = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a / 2); };

// ── 4. 앞: 공식 · 수직 절개 · 수평 평행 이동 · 쐐기 보존 ──
const f = mV.front, fu = mU.front;
const lyF = f.seamLenUpperCm, bullet = lyF - 4, E = 1.2 * bullet;
{
  const sp = f.spread, FB = GV.frontBody, UB = GU.frontBody;
  ok(near(f.gather.spanCm, bullet, 1e-12) && near(f.gather.addedCm, E, 1e-6) && f.gather.rule === "front-1.2-bullet", "4: ● = 이음선 − 2×2 = " + bullet.toFixed(4) + " · 총 개더 = 1.2● = " + E.toFixed(4));
  const seamBody = arcLen(edgesOf(FB, "yoke-seam"));
  ok(near(seamBody - lyF, E, 1e-6), "4: 몸판 이음선 − 요크 이음선 = 1.2● (Δ=" + (seamBody - lyF - E).toExponential(2) + ")");
  ok(near(f.gather.wedgeCm, fu.gather.addedCm, 1e-12), "4: 쐐기 g 는 Ⓤ 와 같다 " + f.gather.wedgeCm.toFixed(4));
  ok(near(f.gather.spreadSeamCm, E - fu.gather.addedCm, 1e-9) && Math.abs(f.gather.spreadSeamCm - 5.37) < 0.01, "4: 평행 벌림 이음선 기여분 e = 1.2● − 쐐기 = " + f.gather.spreadSeamCm.toFixed(4) + " (감사 실측 ≈5.37 · «5 정도» 는 참고 결과)");
  // 수평 이동량 d: 총 초과분 = |T″ − T′| 의 정확해
  const Tm = fu.seamPoints.cutTop, Tr = fu.seamPoints.cutTopRotated, BP0 = fu.seamPoints.bust;
  const cdx = Tm.x - Tr.x, cdy = Tm.y - Tr.y, dExact = Math.sqrt(E * E - cdy * cdy) - cdx;
  ok(near(f.gather.spreadCm, dExact, 1e-9) && near(sp.dx, dExact, 1e-9) && sp.dir === 1, "4: 수평 이동 d = 정확해 " + dExact.toFixed(4) + " (총 초과분 1.2● 를 만족하는 해)");
  ok(near(D({ x: Tm.x + sp.dx, y: Tm.y }, Tr), E, 1e-9), "4: |T″ − T′| = 1.2●");
  // 절개: BP→밑단 수직(앞중심과 평행) 두 줄, 간격 d, 수평 이동
  const stay = FB.construction.find(s => s.spreadCut === "stay"), mov = FB.construction.find(s => s.spreadCut === "moved");
  const cxF = edgesOf(GV.front, "center")[0].from.x, hemY = edgesOf(GV.front, "hem")[0].from.y;
  ok(D(stay.from, BP0) < 1e-9 && near(stay.to.x, BP0.x, 1e-9) && near(stay.to.y, hemY, 1e-9), "4: 옆 조각 가장자리 = BP 에서 밑단까지 수직");
  ok(near(mov.from.x, BP0.x + sp.dx, 1e-9) && near(mov.from.y, BP0.y, 1e-12) && near(mov.to.x, mov.from.x, 1e-12) && near(mov.to.y, hemY, 1e-9), "4: 이동 조각 가장자리 = 같은 y 구간의 수직, 수평으로 d 만");
  const cenDir = edgesOf(GV.front, "center")[0]; ok(Math.abs(cenDir.from.x - cenDir.to.x) < 1e-12 && Math.abs(stay.from.x - stay.to.x) < 1e-12, "4: 절개선은 앞중심선과 평행(수직)");
  ok(sp.dx > 0 && cxF > BP0.x, "4: 이동 방향 = 앞중심 쪽");
  // 쐐기 보존
  const rot = FB.construction.find(s => s.wedgeCut === "rotated"), fix = FB.construction.find(s => s.wedgeCut === "fixed");
  const rotU = UB.construction.find(s => s.wedgeCut === "rotated"), fixU = UB.construction.find(s => s.wedgeCut === "fixed");
  ok(J(rot) === J(rotU), "4: 회전 절개선(BP→T′)은 Ⓤ 와 바이트 동일 — 닫힌 AH 쐐기 유지");
  ok(near(fix.from.x, fixU.from.x + sp.dx, 1e-12) && near(fix.to.x, fixU.to.x + sp.dx, 1e-12) && near(fix.from.y, fixU.from.y, 1e-12) && near(fix.to.y, fixU.to.y, 1e-12), "4: 고정 절개선(BP→T)은 Ⓤ 의 것을 수평으로 +d 이동");
  ok(near(f.wedgeAngleDeg === undefined ? f.gather.wedgeAngleDeg : f.gather.wedgeAngleDeg, fu.gather.wedgeAngleDeg, 1e-12) && !FB.construction.some(s => s.dart && s.dart.id === "front-bust"), "4: 쐐기 각 = Ⓤ(원본 AH 다트 각) · 닫은 다트 흔적 0");
  // 앞중심 쪽 조각은 순수 수평 이동: 앞중심 변·목둘레 변
  const cenB = edgesOf(FB, "center"), cenW = edgesOf(GV.front, "center");
  ok(cenB.every(s => near(s.from.x, cxF + sp.dx, 1e-9) && near(s.to.x, cxF + sp.dx, 1e-9)) && near(Math.min(...cenB.flatMap(s => [s.from.y, s.to.y])), Math.min(...cenW.flatMap(s => [s.from.y, s.to.y])), 1e-9), "4: 앞중심 변이 정확히 +d 평행 이동(y 구간 동일)");
  const neckB = edgesOf(FB, "neckline"), neckU = edgesOf(UB, "neckline");
  ok(neckB.length === neckU.length && neckB.every((s, i) => near(s.from.x, neckU[i].from.x + sp.dx, 1e-9) && near(s.to.x, neckU[i].to.x + sp.dx, 1e-9) && near(s.from.y, neckU[i].from.y, 1e-9)), "4: 목둘레 변도 +d 평행 이동");
  const armB = edgesOf(FB, "armhole"), armU = edgesOf(UB, "armhole"), sideB = edgesOf(FB, "side-seam"), sideU = edgesOf(UB, "side-seam");
  ok(J(armB) === J(armU) && J(sideB) === J(sideU), "4: 옆 조각(진동·옆선)은 Ⓤ 와 그대로");
  // 밑단: 수평 · BP.x~BP.x+d 이음 변 포함
  const hems = edgesOf(FB, "hem");
  ok(hems.length === 3 && hems.every(s => near(s.from.y, hemY, 1e-9) && near(s.to.y, hemY, 1e-9)) && hems.some(s => near(Math.min(s.from.x, s.to.x), BP0.x, 1e-9) && near(Math.max(s.from.x, s.to.x), BP0.x + sp.dx, 1e-9)), "4: 밑단은 수평이고 절개 틈을 직선으로 잇는다");
  ok(near(f.hemSideExtraCm, 1, 1e-9), "4: 앞 밑단 옆 +1");
  // 이음선: 요크 쪽 앞 이음선(어깨 평행 6cm)은 Ⓤ 와 같다
  ok(near(f.seamOffsetCm, 6, 1e-12), "4: 앞 이음선 = 어깨선과 평행·6cm(Ⓤ 그대로)");
}

// ── 5. 길이 보존 fairing ──
{
  const FB = GV.frontBody, seamF = edgesOf(FB, "yoke-seam");
  const cub = seamF.filter(s => s.kind === "cubic"), lns = seamF.filter(s => s.kind === "line");
  ok(cub.length === 2 && lns.length === 3, "5: 몸판 이음선 = 직선 3 + 모서리 둘레 cubic 2(T″·T′)");
  const cc = f.spread.corners;
  ok(cc.length === 2 && cc.every(k => k.turnDeg > 1), "5: 모서리 2곳을 둥글린다(꺾임 " + cc.map(k => k.turnDeg.toFixed(1)).join("°, ") + "°)");
  // 모서리 점 → 직선 꺾은선(= fairing 전)의 길이 = fairing 후 길이(길이 보존)
  const sp = f.spread, Qn = f.seamPoints.neckline, Qa = f.seamPoints.armhole;
  const QnM = { x: Qn.x + sp.dx, y: Qn.y };
  const armEnds = segsOf(FB.outline).filter(x => x.edge === "armhole").flatMap(x => [x.from, x.to]), seamEnds = seamF.flatMap(x => [x.from, x.to]);
  const QaM = seamEnds.filter(p => armEnds.some(q => D(p, q) < 1e-9))[0];
  const poly = D(QnM, sp.cutTopMoved) + D(sp.cutTopMoved, sp.cutTopRotated) + D(sp.cutTopRotated, QaM);
  ok(near(arcLen(seamF), poly, 1e-6), "5: fairing 전 꺾은선 길이 = fairing 후 이음선 길이(길이 보존)");
  // cubic ↔ 직선 접선 연속(G1)
  const segs = segsOf(FB.outline), seamIdx = segs.map((s, i) => s.edge === "yoke-seam" ? i : -1).filter(i => i >= 0);
  const dirAt = (s, end) => { const a = end ? (s.kind === "line" ? s.from : s.c2) : s.to, b = end ? s.to : (s.kind === "line" ? s.to : s.c1); const p = end ? (s.kind === "line" ? s.from : s.c2) : (s.kind === "line" ? s.from : s.from); return null; };
  let g1 = true;
  for (let k = 0; k + 1 < seamIdx.length; k++) {
    const A = segs[seamIdx[k]], B = segs[seamIdx[k + 1]];
    if (seamIdx[k + 1] !== seamIdx[k] + 1) continue;
    const dA = A.kind === "line" ? { x: A.to.x - A.from.x, y: A.to.y - A.from.y } : { x: A.to.x - A.c2.x, y: A.to.y - A.c2.y };
    const dB = B.kind === "line" ? { x: B.to.x - B.from.x, y: B.to.y - B.from.y } : { x: B.c1.x - B.from.x, y: B.c1.y - B.from.y };
    const cr = (dA.x * dB.y - dA.y * dB.x) / (Math.hypot(dA.x, dA.y) * Math.hypot(dB.x, dB.y));
    if (Math.abs(cr) > 1e-6) g1 = false;
  }
  ok(g1, "5: 직선↔cubic 이음 접선 연속(G1)");
}

// ── 6. 뒤: 중심 띠 ∅×1 ──
{
  const b = mV.back, bb = GV.backBody, ub = GU.backBody, whole = GV.back;
  const lenY = b.seamLenUpperCm, W = 1 * (lenY - 2);
  ok(near(b.gather.addedCm, W, 1e-9) && near(b.gather.spanCm, lenY - 2, 1e-9) && b.gather.rule === "back-seam-minus-2-full", "6: 띠 폭 = ∅×1 = (이음선 " + lenY.toFixed(3) + " − 2) × 1 = " + W.toFixed(3));
  ok(near(b.gather.addedCm, 2 * mU.back.gather.addedCm, 1e-9), "6: Ⓤ(×0.5) 의 정확히 2배");
  ok(near(arcLen(edgesOf(bb, "yoke-seam")) - lenY, W, 1e-9), "6: 몸판 이음 길이 − 요크 이음 길이 = ∅");
  const cxW = edgesOf(whole, "center")[0].from.x, cxB = edgesOf(bb, "center")[0].from.x;
  ok(near(Math.abs(cxB - cxW), W, 1e-9), "6: 몸판 중심이 원래 CB 에서 ∅ 만큼 밀림");
  const yokeCB = GV.shoulderYoke.outline.filter(s => s.edge === "center").map(s => segsOf([s])[0].from.x);
  ok(yokeCB.length === 1 && near(yokeCB[0], cxW, 1e-9), "6: 어깨 요크의 뒤중심은 원래 CB(개더는 몸판에만)");
  ok(near(b.hemSideExtraCm, 1, 1e-9), "6: 뒤 밑단 옆 +1");
  ok(J(mV.back.seamPoints || null) === J(mU.back.seamPoints || null) && b.seamLenUpperCm === mU.back.seamLenUpperCm, "6: 뒤 이음선(다트 끝 높이 수평) 위치는 Ⓤ 와 동일");
}

// ── 7. 폐곡선·자기교차 0 · 면적 · 구성선 ──
{
  ["shoulderYoke", "frontBody", "backBody"].forEach(k => {
    const r = ringOf(GV[k].outline);
    ok(r && !selfCross(r) && areaOf(r) > 10, "7: " + k + " 폐곡선·자기교차 0·면적>0");
  });
  const sp = f.spread, FB = GV.frontBody;
  const aF = areaOf(ringOf(FB.outline));
  ok(near(aF, f.areaBodyCm2, 1e-6), "7: 메타 몸판 면적 = 재계산");
  // fairing 전 면적 = Ⓤ 몸판 링(쐐기 포함) − 쐐기 W + 틈 다각형 G
  const Gpts = [sp.cutTopRotated, sp.cutTopMoved, sp.bustMoved, { x: sp.hemRight.x, y: sp.hemRight.y }, sp.hemLeft, sp.bust];
  const aG = ptAreaOf(Gpts), W = 0.5 * D(sp.bust, fu.seamPoints.cutTop) * D(sp.bust, fu.seamPoints.cutTopRotated) * Math.sin(f.gather.wedgeAngleDeg * Math.PI / 180);
  ok(near(sp.areaGapCm2, aG, 1e-9), "7: 틈 다각형 G 면적 " + aG.toFixed(3));
  ok(near(sp.areaBodyUnfairedCm2, areaOf(ringOf(GU.frontBody.outline)) - W + aG, 0.05), "7: fairing 전 몸판 면적 = Ⓤ 몸판 − 쐐기 + 틈 G (Δ=" + (sp.areaBodyUnfairedCm2 - (areaOf(ringOf(GU.frontBody.outline)) - W + aG)).toExponential(2) + ")");
  const bandA = mV.back.gather.addedCm * D(GV.backBody.construction.find(s => s.gatherBoundary).from, GV.backBody.construction.find(s => s.gatherBoundary).to);
  const ringW = (pc, id) => areaOf(ringOf(pc.outline.concat(pc.construction.filter(s => s.dart && s.kind === "line" && s.dart.id === id).map(l => ({ kind: "line", from: l.from, to: l.to }))), 0.03));
  const dArea = areaOf(ringOf(GV.shoulderYoke.outline)) + sp.areaBodyUnfairedCm2 + areaOf(ringOf(GV.backBody.outline)) - ringW(GV.front, "front-bust") - ringW(GV.back, "back-shoulder") - mV.shoulderYoke.gapAreaCm2 - bandA - aG;
  ok(Math.abs(dArea) < 0.1, "7: 면적 정산 = 원본 앞+뒤 + 어깨 틈 + 뒤 띠 + 틈 G (Δ=" + dArea.toFixed(4) + ")");
  // 구성선: 소속 조각과 같은 변환, 외곽 승격·삭제 없음
  const kU = GU.frontBody.construction, kV = FB.construction;
  const dartsU = kU.filter(s => s.dart), dartsV = kV.filter(s => s.dart);
  ok(dartsV.length === dartsU.length && dartsU.every(u => { const v = dartsV.find(q => q.dart.id === u.dart.id && Math.abs((q.from.y - u.from.y)) < 1e-9 && Math.abs((q.to.y - u.to.y)) < 1e-9 && (Math.abs(q.from.x - u.from.x) < 1e-9 || Math.abs(q.from.x - u.from.x - sp.dx) < 1e-9)); return !!v; }), "7: 허리 다트 구성선은 전부 보존(소속 조각 따라 이동 또는 제자리)");
  const dA = (id, which) => dartsV.filter(s => s.dart.id === id);
  const aLegsU = dartsU.filter(s => s.dart.id === "front-waist-a"), aLegsV = dA("front-waist-a");
  ok(aLegsV.some(v => aLegsU.some(u => D(v.from, u.from) < 1e-9 && D(v.to, u.to) < 1e-9)) && aLegsV.some(v => aLegsU.some(u => near(v.from.x, u.from.x + sp.dx, 1e-9) && near(v.to.x, u.to.x + sp.dx, 1e-9))), "7: 절개 위의 다트 a — 왼 다리는 제자리, 오른 다리는 +d (같은 변환)");
  const wl = kV.filter(s => s.edge === "waist"), wlU = kU.filter(s => s.edge === "waist")[0];
  ok(wl.length === 2 && wl.every(s => s.spreadSplit) && near(wl.reduce((t, s) => t + D(s.from, s.to), 0), D(wlU.from, wlU.to), 1e-9), "7: 절개를 가로지르는 WL 참고선은 절개에서 나뉘어 각자 변환 — 길이 합 보존");
  ok(wl.some(s => near(Math.max(s.from.x, s.to.x), wlU.from.x + sp.dx, 1e-9)) && wl.some(s => near(Math.min(s.from.x, s.to.x), wlU.to.x, 1e-9)), "7: WL 오른쪽 조각 +d · 왼쪽 조각 제자리");
  ok(kV.length === kU.length + 3, "7: 구성선 수 = Ⓤ + WL 분할 1 + 수직 절개 2 (삭제 0)");
  ok(!FB.outline.some(s => s.dart || s.spreadCut || s.wedgeCut) && !edgesOf(FB, "waist").length, "7: 구성선이 외곽선으로 승격되지 않았다");
  ok(!mV.front.droppedConstruction.some(x => /waist|side-waist/.test(x)) && J(f.droppedConstruction) === J(fu.droppedConstruction), "7: 임의 삭제 없음(droppedConstruction 은 Ⓤ 와 같다)");
}

// ── 8. 원자성·입력 불변 ──
{
  const inF = clone(GB.front), inB = clone(GB.back);
  throwsReason(() => DY.split({ front: GB.front, back: GB.back }, { variant: "V", hemSideCm: 2.5 }), "hem-side-mismatch", "8: 밑단 옆이 1 이 아니면 거부(부분 결과 없음)");
  const noDartFront = clone(GB.front); noDartFront.construction = noDartFront.construction.filter(s => !(s.dart && s.dart.id === "front-bust"));
  throwsReason(() => DY.split({ front: noDartFront, back: GB.back }, { variant: "V", hemSideCm: 1 }), "dart-missing", "8: 앞 AH 다트 없으면 거부");
  const slantHem = clone(GB.front); const hemSeg = slantHem.outline.find(s => s.edge === "hem"), oldTo = { x: hemSeg.to.x, y: hemSeg.to.y };
  slantHem.outline.forEach(s => { if (s.kind === "line") { if (Math.abs(s.from.x - oldTo.x) < 1e-9 && Math.abs(s.from.y - oldTo.y) < 1e-9) s.from.y += 0.5; if (Math.abs(s.to.x - oldTo.x) < 1e-9 && Math.abs(s.to.y - oldTo.y) < 1e-9) s.to.y += 0.5; } });
  throwsReason(() => DY.split({ front: slantHem, back: GB.back }, { variant: "V", hemSideCm: 1 }), "spread-v-hem-not-horizontal", "8: 밑단이 수평이 아니면 거부(수직 절개 끝 정의 불가)");
  ok(J(GB.front) === J(inF) && J(GB.back) === J(inB), "8: 입력 몸판 불변");
}

// ── 9. 체크포인트(독립 재계산·변조 거부) ──
const mk = (geometry, body) => ({ sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const chk = (p) => { PROJECT = p; return BC.check(p); };
const reasonOf = (p) => { const c = chk(p); return c.ok ? null : c.fails.filter(f => /^yoke-/.test(f))[0] || c.fails[0]; };
{
  const c = chk(mk(clone(GV), V_BODY));
  ok(c.ok, "9: Ⓥ 검사 통과: " + c.fails.join());
  const ys = c.yokeSeam;
  ok(ys && ys.ok && ys.variant === "V" && ys.shoulderYoke.closed && ys.front.closed && ys.back.closed, "9: yokeSeam 상태 ok · variant V · 세 조각 폐곡선");
  ok(ys.shoulderYoke.selfIntersects === false && ys.front.selfIntersects === false && ys.back.selfIntersects === false, "9: 자기교차 0(재계산)");
  ok(near(ys.back.gatherCm, ys.back.seamLenYokeCm - 2, 1e-3) && near(ys.back.gatherDeltaCm, ys.back.gatherCm, 1e-3), "9: 뒤 개더 ∅×1 독립 재계산·몸판−요크 이음 = ∅");
  ok(near(ys.front.gatherTargetCm, 1.2 * (ys.front.seamLenYokeCm - 4), 1e-3) && near(ys.front.gatherDeltaCm, ys.front.gatherTargetCm, 2e-3), "9: 앞 총 개더 = 1.2● 독립 재계산·몸판−요크 이음 = 1.2●");
  ok(near(ys.front.spreadSeamCm, ys.front.gatherTargetCm - ys.front.wedgeChordCm, 1e-3) && Math.abs(ys.front.spreadSeamCm - 5.37) < 0.01, "9: 평행 벌림 기여분 = 1.2● − 쐐기 = " + ys.front.spreadSeamCm + " · 수평 이동 d = " + ys.front.spreadCm);
  ok(near(ys.front.wedgeDeg, ys.front.dartDeg, 1e-3), "9: 쐐기각 = AH 다트각 (쐐기 보존)");
  ok(Math.abs(ys.shoulderYoke.areaDeltaCm2) < 0.1 && ys.shoulderYoke.gapAreaCm2 > 1, "9: 면적 정합 Δ=" + ys.shoulderYoke.areaDeltaCm2 + " (fairing 면적 차 " + ys.front.areaFairDeltaCm2 + ")");
  ok(c.sideSeam.status === "match" && c.armhole.ok && c.neckline.ok, "9: 전체 몸판 기존 검사(옆선·진동·목선) 그대로 통과");
  const uc = chk(mk(clone(GU), U_BODY)); ok(uc.ok && uc.yokeSeam.variant === "U", "9: Ⓤ 검사는 그대로 통과(variant U)");

  const tamper = (fn, body) => { const g = clone(GV); fn(g); return reasonOf(mk(g, body || V_BODY)); };
  const FBc = (g, pred) => g.frontBody.construction.find(pred);
  ok(tamper(g => { g.yokeSeam.back.gather.addedCm += 0.5; }) === "yoke-gather-mismatch", "9: 뒤 개더 메타 위조 거부");
  ok(tamper(g => { g.yokeSeam.front.gather.addedCm += 0.5; }) === "yoke-gather-mismatch", "9: 앞 개더 메타 위조 거부");
  ok(tamper(g => { g.backBody.outline.forEach(s => { if (s.edge === "center" && s.kind === "line") { s.from.x -= 0.4; s.to.x -= 0.4; } }); }) !== null, "9: 뒤 몸판 중심 이동 거부(∅×0.5 로 되돌려도 거부)");
  ok(reasonOf(mk(clone(GU), V_BODY)) === "yoke-seam-variant-mismatch" && reasonOf(mk(clone(GV), U_BODY)) === "yoke-seam-variant-mismatch", "9: 파라미터와 geometry 의 Ⓤ/Ⓥ 불일치 거부");
  ok(reasonOf(mk(clone(GV), Q_BODY)) === "yoke-seam-variant-mismatch", "9: Ⓠ 파라미터에 Ⓥ geometry 거부");
  ok(tamper(g => { FBc(g, s => s.spreadCut === "moved").from.x += 0.3; FBc(g, s => s.spreadCut === "moved").to.x += 0.3; }) !== null, "9: 이동 절개선 위치(d) 변조 거부");
  ok(tamper(g => { FBc(g, s => s.spreadCut === "moved").to.x += 0.3; }) === "yoke-spread-cut", "9: 이동 절개선이 수직이 아니면 거부");
  ok(tamper(g => { FBc(g, s => s.spreadCut === "stay").to.x += 0.3; }) === "yoke-spread-cut", "9: 옆 절개선이 수직이 아니면 거부");
  ok(tamper(g => { g.frontBody.construction = g.frontBody.construction.filter(s => s.spreadCut !== "stay"); }) === "yoke-spread-cut", "9: 수직 절개선 삭제 거부");
  ok(tamper(g => { FBc(g, s => s.wedgeCut === "rotated").to.x += 0.3; }) !== null, "9: 회전 절개선(쐐기) 변조 거부");
  ok(tamper(g => { FBc(g, s => s.wedgeCut === "fixed").to.x += 0.3; }) !== null, "9: 이동한 고정 절개선 끝(T″) 변조 거부");
  ok(tamper(g => { g.frontBody.outline.forEach(s => { if (s.edge === "center") { s.from.x += 0.2; s.to.x += 0.2; } }); }) !== null, "9: 앞중심 변만 어긋나면(순수 평행 이동 아님) 거부");
  ok(tamper(g => { g.frontBody.outline.forEach(s => { if (s.edge === "hem" && s.spreadBridge) { s.to.x += 0.1; } }); }) !== null, "9: 밑단 이음 변 변조 거부");
  ok(tamper(g => { const s0 = g.frontBody.outline.find(s => s.edge === "yoke-seam" && s.kind === "path"); s0.commands.find(c => c.type === "C").points[0].y += 0.5; }) !== null, "9: fairing cubic 변조(길이 보존 위반) 거부");
  ok(tamper(g => { g.shoulderYoke.outline.some(s => { if (s.edge === "yoke-seam" && s.kind === "line") { s.to.y += 0.4; return true; } return false; }); }) !== null, "9: 요크 이음선 변조 거부");
  ok(tamper(g => { g.shoulderYoke.construction = g.shoulderYoke.construction.filter(s => s.shoulderJoin !== "front"); }) === "yoke-seam-shoulder-missing", "9: 앞 어깨 구성선 삭제 거부");
  ok(tamper(g => { g.shoulderYoke.construction.push(clone(g.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder")[0])); }) === "yoke-seam-dart-open", "9: 뒤 어깨 다트가 열려 있으면 거부");
  ok(tamper(g => { g.frontBody.construction.push(clone(g.front.construction.filter(s => s.dart && s.dart.id === "front-bust")[0])); }) === "yoke-seam-dart-open", "9: 앞 AH 다트가 몸판에 열려 있으면 거부");
  ok(tamper(g => { g.frontBody.outline = g.frontBody.outline.slice(1); }) !== null, "9: 앞 몸판 외곽 끊김 거부");
  // 완료본·hash
  const pr = mk(clone(GV), V_BODY); PROJECT = pr;
  const done = BC.complete(pr);
  const res = BC.latest(pr); if (!done.ok) console.log('COMPLETE FAIL', J(done).slice(0, 400));
  ok(done.ok && Object.isFrozen(res) && Object.isFrozen(res.shoulderYoke) && res.yokeSeam.variant === "V", "9: 완료본에 Ⓥ 메타 보존·동결");
  ["shoulderYoke", "frontBody", "backBody"].forEach(k => ok(J(res[k].outline) === J(GV[k].outline) && J(res[k].construction) === J(GV[k].construction) && res[k] !== pr.working.geometry[k], "9: result." + k + " = 현재 geometry 동결 복제"));
  const hash = (g, b) => { const p = mk(clone(g), b); PROJECT = p; const c2 = BC.complete(p); return c2.ok ? BC.latest(p).hash : "FAIL:" + c2.reason; };
  const hV = hash(GV, V_BODY), hUU = hash(GU, U_BODY);
  ok(hV === hash(GV, V_BODY) && !hV.startsWith("FAIL") && hV !== hUU, "9: Ⓥ hash 결정론 · Ⓤ hash 와 다름");
  const pe = mk(clone(GV), V_BODY); PROJECT = pe; BC.complete(pe);
  pe.working.geometry.frontBody.construction.find(s => s.spreadCut === "moved").from.x += 0.05;
  ok(BC.isCurrentBodiceChanged(pe) === true, "9: 완료 뒤 앞 몸판 구성선이 바뀌면 스테일(hash 반영)");
  const pn = mk(clone(GV), V_BODY); PROJECT = pn; BC.complete(pn);
  ok(BC.isCurrentBodiceChanged(pn) === false, "9: 같은 상태는 스테일 아님");
  const H = { A: "2779faf5", Q: "1160ab37", R: "5463eb91", S: "cc4dbdc", T: "deee08ee", M: "d1bece2f", P: "588eb1bd" };
  Object.keys(H).forEach(k => { const b = BP.bodyParams("bunka-bodice-" + k); ok(hash(DB.computeGeometry(REF, { body: b }), b) === H[k], "9: " + k + " 완료본 hash 불변 " + H[k]); });
  ok(hUU === (() => { return hash(GU, U_BODY); })(), "9: Ⓤ 완료본 hash 결정론");
}

// ── 10. 표시·배치·렌더 ──
{
  const m = DL.yokeLabels(GV);
  ok(m && m.labels.length === 3 && m.labels.some(l => l.key === "shoulderYoke" && l.text === "어깨 요크") && m.seams.length === 3 && m.gathers.length === 2, "10: 조각명 3·이음선 3·개더 라벨 2(앞·뒤)");
  const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
  const bb = (pc) => { const pts = []; pc.outline.forEach(p => ptsOf(p, pts)); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
  const overlap = (a, b) => a.minX < b.maxX - 1e-9 && b.minX < a.maxX - 1e-9 && a.minY < b.maxY - 1e-9 && b.minY < a.maxY - 1e-9;
  const dispF = DL.peplumDisplayPiece(GV, "frontBody"), dispB = DL.peplumDisplayPiece(GV, "backBody");
  ok(!overlap(bb(GV.shoulderYoke), bb(dispB)), "10: 어깨 요크·뒤 몸판 표시 bbox 겹침 0");
  ok(dispF && bb(dispF).minY > bb(GV.shoulderYoke).maxY, "10: 앞 몸판 표시는 어깨 요크 아래(geometry 불변)");
  ok(J(GV.frontBody) === J(DB.computeGeometry(REF, { body: V_BODY }).frontBody), "10: 표시 계산이 geometry 를 바꾸지 않는다");
  let layout; try { layout = DL.autoLayout(GV); } catch (e) { layout = null; }
  ok(!!layout, "10: autoLayout 성공");
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, shoulderYoke: GV.shoulderYoke, frontBody: GV.frontBody, backBody: GV.backBody }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "10: 렌더러 검증 통과 " + (err || ""));
  const ids = grp ? grp.kids.map(k => J(k.attrs || {})) : [];
  ok(new Set(ids).size === ids.length, "10: 중복 렌더 0");
  const usrc = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  ok(/body\.yokeSeam === "V"/.test(usrc), "10: ui.js 가 yokeSeam \"V\" 를 라인 적용에 싣는다");
  const mMsg = usrc.match(/const yokeLockMsg = [^\n]*;/), mCir = usrc.match(/const yokeCircled = [^\n]*;/);
  if (mMsg && mCir) {
    const fn = new Function(mMsg[0] + mCir[0] + "return (body) => yokeLockMsg(yokeCircled(window.bodicePresets.yokeVariantSymbol(body)));");
    const msgOf = vm.runInContext("(" + fn.toString() + ")()", sandbox);
    ok(msgOf(V_BODY).includes("Ⓥ 적용 중") && msgOf(U_BODY).includes("Ⓤ 적용 중"), "10: 잠금 문구는 Ⓥ/Ⓤ 로 표시");
  } else ok(false, "10: ui.js 에 yokeLockMsg/yokeCircled 존재");
}
ok(J(REF) === SNAP, "11: reference 불변");

console.log("══════════════════════════════════════════════");
console.log(`yokeSeamVCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
