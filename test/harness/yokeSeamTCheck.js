// yokeSeamTCheck.js — 요크 이음선 ② Ⓣ(P.33, «이음선을 넣고 밑단에서 2.5cm 추가, 절개선을 넣어 밑단에서 플레어 분량을 잘라서 벌린다») 회귀.
//   node test/harness/yokeSeamTCheck.js
// 범위: 프리셋 Ⓣ · 요크·이음선·다트 처리가 Ⓢ 와 바이트 동일 · 몸판 절개 벌림(WL 3등분 수직 절개 2곳 · 이음선 교점 고정 · 밑단만 벌림) ·
//       ∅ = 그 면 BL 수평폭 × 0.5 − 2.5(앞·뒤 독립, 이음선 전체 길이 해석 아님) · 절개당 ∅/2 · 밑단 +2.5 · 개더·턱 없음 ·
//       이음선 길이 보존 · 밑단 fairing(G1) · 폐곡선·자기교차 0 · 체크포인트 독립 재계산·변조 거부 · 완료본/hash · 표시 · 잠금 문구 ·
//       A~Ⓢ 바이트 불변(HEAD c7230fe 에서 측정한 sha256 앞 16자).
// 사용자 확정(2026-10-01): Ⓣ 앞판의 ● 는 교재 도해·본문대로 BL 수평폭(앞 24.447 → ∅ 9.72cm). 이음선 전체 길이 해석(25.235 → 10.12)은 쓰지 않는다.
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
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool, DY = W.designYokeSeam, FL = W.designFlare;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const S_BODY = BP.bodyParams("bunka-bodice-S"), T_BODY = BP.bodyParams("bunka-bodice-T");
const GS = DB.computeGeometry(REF, { body: S_BODY });
const GT = DB.computeGeometry(REF, { body: T_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const edgesOf = (pc, e) => segsOf(pc.outline).filter(s => s.edge === e);
const arcLen = (segs) => segs.reduce((t, s) => t + T.flattenLine([s]).reduce((u, ab) => u + D(ab[0], ab[1]), 0), 0);   // line/cubic 호 길이(평탄화)
const seamLen = (pc) => arcLen(edgesOf(pc, "yoke-seam"));
const BLY = 83 / 12 + 13.7, YS = BLY + 5;                    // draft.js yBL 공식과 독립으로 다시 계산
const sideTop = (pc) => segsOf(pc.outline).filter(s => s.edge === "side-seam").flatMap(s => [s.from, s.to]).reduce((a, b) => b.y < a.y ? b : a);
const sideBot = (pc) => segsOf(pc.outline).filter(s => s.edge === "side-seam").flatMap(s => [s.from, s.to]).reduce((a, b) => b.y > a.y ? b : a);

// ── 1. 프리셋 Ⓣ ──
ok(BP.resolve("yoke-seam-2", "bunka-bodice-T").ok, "1: Ⓣ 해석 성공(실행 가능)");
ok(BP.variant("yoke-seam-2", "bunka-bodice-T").availability === "available" && BP.variant("yoke-seam-2", "bunka-bodice-T").page === 33, "1: Ⓣ available · P.33");
ok(J(T_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 2.5, yokeSeam: "T" }), "1: Ⓣ 파라미터 = 박시 Ⓐ + 밑단 옆 +2.5 + yokeSeam:T");
ok(J(S_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "S" }), "1: Ⓢ 파라미터 불변");
ok(BP.yokeVariantSymbol(T_BODY) === "T" && BP.yokeVariantSymbol(S_BODY) === "S", "1: body → 변형 기호(S/T)");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, T_BODY, { yokeGather: true }) }), "yoke-seam-t-no-gather", "1: Ⓣ 에 개더 지정 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, T_BODY, { waistSeam: true }) }), "yoke-seam-waist-seam-conflict", "1: 요크+허리 이음선 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, T_BODY, { flare: true }) }), "yoke-seam-flare-conflict", "1: 요크+플레어 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, T_BODY, { hemSideOffsetCm: 1 }) }), "yoke-seam-failed", "1: 밑단 옆 +2.5 가 아니면 거부(교재 «2.5»)");
{
  const sp = DY.split({ front: GT.front, back: GT.back }, { variant: "T", hemSideCm: 2.5 });
  ok(sp.meta.front.flare.cuts.length === 2 && sp.meta.back.flare.cuts.length === 2 && J(sp.frontBody) === J(GT.frontBody), "1: split(variant T) 직접 호출 = computeGeometry 결과");
  throwsReason(() => DY.split({ front: GT.front, back: GT.back }, { variant: "T", hemSideCm: 1 }), "hem-side-mismatch", "1: 밑단 옆이 2.5 가 아니면 split 거부(부분 결과 없음)");
}
ok(J(DB.computeGeometry(REF, { body: T_BODY })) === J(GT), "1: 결정론(같은 입력 → 바이트 동일)");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. A~Ⓢ 바이트 불변(HEAD c7230fe 측정) ──
const FIXED = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", G: "d9a46f8358daec84",
  M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37", P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce", R: "63193d5a879a6235", S: "8f5a2535f192f935" };
Object.keys(FIXED).forEach(k => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + k) })) === FIXED[k], "2: " + k + " geometry 바이트 불변"));
ok(!("flare" in GS.yokeSeam.front) && GS.yokeSeam.front.gather && GS.yokeSeam.front.variant === "S", "2: Ⓢ 메타에 Ⓣ 키 없음·개더 유지");

// ── 3. 요크·이음선·다트는 Ⓢ 와 같다 ──
ok(J(GT.frontYoke) === J(GS.frontYoke) && J(GT.backYoke) === J(GS.backYoke), "3: 앞·뒤 요크 = Ⓢ 요크와 바이트 동일(이음선·앞 AH 흡수·뒤 어깨 다트 보존)");
{
  const hasId = (pc, id) => pc.outline.concat(pc.construction).some(s => s.dart && s.dart.id === id);
  ok(!hasId(GT.frontYoke, "front-bust") && !hasId(GT.frontBody, "front-bust"), "3: 앞 AH 다트 흡수(어디에도 없음)");
  ok(J(GT.backYoke.construction) === J(GT.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder")) && !hasId(GT.backBody, "back-shoulder"), "3: 뒤 어깨 다트 = 요크 열린 다리 보존·몸판엔 없음");
  ok(GT.yokeSeam.front.absorbedDarts.length === 1 && GT.yokeSeam.back.preservedDarts.length === 1 && GT.yokeSeam.back.preservedDarts[0].open === true, "3: 메타 흡수·보존 기록");
  ok(GT.yokeSeam.front.variant === "T" && GT.yokeSeam.back.variant === "T" && GT.yokeSeam.front.gather === null && GT.yokeSeam.back.gather === null, "3: 메타 variant T · gather 없음");
  ok(near(GT.yokeSeam.back.seamY, YS, 1e-9) && near(GT.yokeSeam.front.bustLineY, BLY, 1e-9), "3: BL·이음선 높이(독립 계산)");
}

// ── 4. 몸판 절개 벌림(수치) ──
const BW = {}, FLARE = {};
["front", "back"].forEach(side => {
  const W0 = GT[side], Y = GT[side + "Yoke"], B = GT[side + "Body"], m = GT.yokeSeam[side], f = m.flare;
  const cx = edgesOf(W0, "center")[0].from.x, top = sideTop(W0), bot = sideBot(W0);
  const BLw = Math.abs(top.x - cx), total = 0.5 * BLw - 2.5;
  BW[side] = BLw; FLARE[side] = total;
  ok(near(top.y, BLY, 1e-9), `4: ${side} 옆선 위 끝 = BL`);
  ok(near(f.bustWidthCm, BLw, 1e-9) && near(f.totalCm, total, 1e-9) && near(f.perCutChordCm, total / 2, 1e-9) && f.ratio === 0.5 && f.subtractCm === 2.5, `4: ${side} ∅ = BL 수평폭 ${BLw.toFixed(3)} × 0.5 − 2.5 = ${total.toFixed(4)} · 절개당 ∅/2`);
  ok(f.cuts.length === 2 && f.strips === 3 && f.cuts.every(c => near(c.chordCm, total / 2, 1e-6)), `4: ${side} 절개 2곳·조각 3·각 chord ∅/2`);
  // 절개 위치 = WL 3등분점(독립 계산: 전체 몸판 WL 변 = 중심~옆선의 y=38)
  const WLy = 38, sideAtWL = segsOf(W0.outline).filter(s => s.edge === "side-seam").map(s => {
    const lo = Math.min(s.from.y, s.to.y), hi = Math.max(s.from.y, s.to.y); if (WLy < lo - 1e-9 || WLy > hi + 1e-9) return null;
    return s.from.x + (s.to.x - s.from.x) * (WLy - s.from.y) / (s.to.y - s.from.y);
  }).filter(v => v !== null)[0];
  const uW = Math.abs(sideAtWL - cx), dir = sideAtWL > cx ? 1 : -1;
  f.cuts.forEach((c, i) => {
    const x = cx + dir * uW * (i + 1) / 3;
    ok(near(c.seamPoint.x, x, 1e-6) && near(c.hemPoint.x, x, 1e-6), `4: ${side} 절개 ${i + 1} = WL 3등분점 x=${x.toFixed(3)} 의 수직선`);
    ok(near(c.hemPoint.y, 58, 1e-9), `4: ${side} 절개 ${i + 1} 밑단 끝 y`);
  });
  // 고정점이 이음선 위: 절개 이음선 점은 요크가 아니라 몸판 이음선 원래 모양 위(처음 ring 의 seam)에 있다
  const sy = (side === "front") ? [BLY, YS] : [YS];
  f.cuts.forEach((c, i) => ok(c.seamPoint.y >= Math.min(...sy) - 1e-9 && c.seamPoint.y <= Math.max(...sy) + 1e-9, `4: ${side} 절개 ${i + 1} 교점 y 가 이음선 범위 안`));
  // 이음선 길이 보존
  const ly = seamLen(Y), lb = seamLen(B);
  ok(near(ly, lb, 1e-6) && near(m.seamLenUpperCm, ly, 1e-9) && near(m.seamLenLowerCm, lb, 1e-6) && Math.abs(m.seamDeltaCm) < 1e-6, `4: ${side} 이음선 길이 보존 요크 ${ly.toFixed(4)} = 몸판 ${lb.toFixed(4)}`);
  // 밑단 옆 +2.5
  const bcx = cx;
  const sb = segsOf(B.outline).filter(s => s.edge === "side-seam").flatMap(s => [s.from, s.to]);
  ok(near(Math.abs(bot.x - top.x), 2.5, 1e-9) && near((top.x >= cx ? 1 : -1) * (bot.x - top.x), 2.5, 1e-9), `4: ${side} 전체 몸판 밑단 옆 +2.5cm`);
  ok(sb.length > 0, `4: ${side} 몸판 옆선 존재`);
  // 밑단 벌림: 호(곡선) 2개, 각 chord ∅/2
  const arcs = segsOf(B.outline).filter(s => s.edge === "hem" && s.kind === "cubic");
  ok(arcs.length === 2 && arcs.every(a => near(D(a.from, a.to), total / 2, 1e-4)), `4: ${side} 밑단 이음 곡선 2개 · chord ∅/2 = ${(total / 2).toFixed(4)}`);
  ok(near(arcs.reduce((t, a) => t + D(a.from, a.to), 0), total, 1e-3), `4: ${side} 밑단 chord 합 = ∅`);
  // 밑단 fairing: 곡선 양 끝이 이웃 직선과 접선 연속(G1)
  const segs = segsOf(B.outline), n = segs.length;
  const ang = (u, v) => Math.abs(Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y));
  const dirOf = (a, b) => ({ x: b.x - a.x, y: b.y - a.y });
  let g1 = true;
  segs.forEach((s, i) => {
    if (s.kind !== "cubic" || s.edge !== "hem") return;
    const prev = segs[(i - 1 + n) % n], next = segs[(i + 1) % n];
    if (prev.kind !== "line" || next.kind !== "line") { g1 = false; return; }
    if (ang(dirOf(prev.from, prev.to), dirOf(s.from, s.c1)) > 1e-3 || ang(dirOf(s.c2, s.to), dirOf(next.from, next.to)) > 1e-3) g1 = false;
  });
  ok(g1, `4: ${side} 밑단 이음 곡선이 이웃 밑단선과 접선 연속(fairing)`);
  // 개더·턱·다트 없음
  ok(m.gather === null && !B.construction.some(s => s.gatherBoundary || s.pleat || s.tuck || (s.dart && s.dart.id)), `4: ${side} 개더·턱·다트 구성선 없음`);
  ok(B.construction.every(s => s.kind === "line"), `4: ${side} 몸판 구성선은 직선(허리 참고선 조각)만`);
  // 요크는 절개와 무관(Ⓢ 요크 그대로) · 중심 조각 고정(중심선 x 불변)
  ok(edgesOf(B, "center").every(s => near(s.from.x, cx) && near(s.to.x, cx)), `4: ${side} 몸판 중심선은 원래 위치(중심 조각 고정)`);
  // 면적: 몸판 > 절개 전 몸판(벌어진 만큼 증가)
  ok(m.areaBodyCm2 > GS.yokeSeam[side].areaBodyCm2 - GS.yokeSeam[side].gather.areaAddedCm2 && f.cuts.every(c => c.wedgeAreaCm2 > 0), `4: ${side} 벌림 쐐기 면적 > 0`);
});
// 앞뒤 독립: ● 는 그 면 BL 폭 — 앞 24.447 · 뒤 23.053 (이음선 전체 길이 해석 25.235 가 아니다)
ok(near(BW.front, 24.447, 1e-3) && near(BW.back, 23.053, 1e-3), `4: BL 수평폭 앞 ${BW.front.toFixed(3)} · 뒤 ${BW.back.toFixed(3)}`);
ok(near(FLARE.front, 9.7234, 1e-3) && near(FLARE.back, 9.0266, 1e-3), `4: ∅ 앞 ${FLARE.front.toFixed(4)} · 뒤 ${FLARE.back.toFixed(4)}`);
ok(Math.abs(FLARE.front - (0.5 * seamLen(GT.frontYoke) - 2.5)) > 0.3, "4: 앞 ∅ 는 이음선 전체 길이(25.235) 기준(10.12) 값과 다르다");
ok(FLARE.front !== FLARE.back && near(GT.yokeSeam.front.flare.perCutChordCm, FLARE.front / 2, 1e-9) && near(GT.yokeSeam.back.flare.perCutChordCm, FLARE.back / 2, 1e-9), "4: 앞뒤 각각 독립 계산");

// ── 4b. 요크↔아래몸판 이음 경계(시각 회귀: 절개 교점마다 꺾이고 BP 곁에 짧은 지그재그가 생기던 문제) ──
//   절개 벌림은 조각을 이음선 교점에서 돌리므로 truing 전에는 앞 이음선이 «수평 → 7.5° 올림 → BP 18° 꺾임 → 8° 꺾임» 으로 지그재그였다.
//   종이에서 이어 붙는 봉제선이므로 몸판 이음선은 요크와 길이가 같고, 반대 방향으로 같은 두 끝점을 공유하며, 각진 모서리·왕복·틈·중복선이 없어야 한다.
["front", "back"].forEach(side => {
  const Y = GT[side + "Yoke"], B = GT[side + "Body"], m = GT.yokeSeam[side], f = m.flare;
  const ringOrder = (outline) => segsOf(outline);                      // 외곽 선언 순서 = 링 순서
  const seamIdx = (pc) => ringOrder(pc.outline).map((s, i) => s.edge === "yoke-seam" ? i : -1).filter(i => i >= 0);
  const bseg = ringOrder(B.outline), yseg = ringOrder(Y.outline), n = bseg.length;
  // (a) 몸판 이음선 세그먼트는 링에서 하나의 연속 구간(순환)이며, 이음선 선분끼리 끝점이 정확히 이어진다(틈 0)
  const bi = seamIdx(B), yi = seamIdx(Y);
  const nextOf = (i) => (i + 1) % n;
  const startIdx = bi.find(i => !bi.includes((i - 1 + n) % n));
  const run = []; for (let i = startIdx, k = 0; k < bi.length; i = nextOf(i), k++) run.push(bseg[i]);
  ok(startIdx !== undefined && run.length === bi.length && run.every(s => s.edge === "yoke-seam"), `4b: ${side} 몸판 이음선 = 링 위 연속 구간 하나`);
  ok(run.every((s, i) => i === 0 || D(run[i - 1].to, s.from) < 1e-9), `4b: ${side} 몸판 이음선 세그먼트 틈 0`);
  ok(run.every(s => arcLen([s]) > 1e-3), `4b: ${side} 길이 0 의 중복·퇴화 선분 없음`);
  // (b) 이음선 안의 모든 모서리가 접선 연속(각진 꺾임 0) — 절개 교점·BP 모두
  const leaveDir = (sg, atStart) => atStart ? (sg.kind === "cubic" ? { x: sg.c1.x - sg.from.x, y: sg.c1.y - sg.from.y } : { x: sg.to.x - sg.from.x, y: sg.to.y - sg.from.y })
    : (sg.kind === "cubic" ? { x: sg.c2.x - sg.to.x, y: sg.c2.y - sg.to.y } : { x: sg.from.x - sg.to.x, y: sg.from.y - sg.to.y });
  let maxTurn = 0;
  for (let i = 1; i < run.length; i++) {
    const ua = leaveDir(run[i - 1], false), ub = leaveDir(run[i], true);
    maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(-ua.x * ub.y + ua.y * ub.x, -ua.x * ub.x - ua.y * ub.y)));
  }
  ok(maxTurn < 1e-3, `4b: ${side} 몸판 이음선 모서리 최대 꺾임 ${(maxTurn * 180 / Math.PI).toExponential(1)}° < 0.06° (truing 전 ≈18°)`);
  ok(f.seamFairing.length === (side === "front" ? 3 : 2) && f.seamFairing.every(c => c.turnDeg > 1), `4b: ${side} truing 모서리 = 절개 교점 2${side === "front" ? " + BP 1" : ""}(각 >1°)`);
  // (c) 왕복·돌출 없음: 이음선 평탄화 점의 x 가 중심→옆선 방향으로 단조
  const pts = []; run.forEach(s => T.flattenLine([s]).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }));
  const cxB = edgesOf(B, "center")[0].from.x, xdir = Math.sign(pts[pts.length - 1].x - pts[0].x);
  ok(xdir !== 0 && pts.every((p, i) => i === 0 || (p.x - pts[i - 1].x) * xdir >= -1e-9), `4b: ${side} 몸판 이음선 x 단조(왕복·돌출 0)`);
  // (d) 요크와 정확히 같은 두 끝점·같은 길이. 두 조각은 서로 반대 방향으로 이 변을 지난다(링 방향을 고려한 통과 방향이 반대).
  const ys = yi.map(i => yseg[i]), yStart = ys[0].from, yEnd = ys[ys.length - 1].to;
  const bStart = run[0].from, bEnd = run[run.length - 1].to;
  const cfEnd = (a, b2) => Math.abs(a.x - cxB) < 1e-9 ? a : b2;
  ok(D(cfEnd(yStart, yEnd), cfEnd(bStart, bEnd)) < 1e-9, `4b: ${side} 요크·몸판 이음선이 같은 CF 점에서 시작`);
  const ringArea = (segs) => { const q = []; segs.forEach(sg => T.flattenLine([sg]).forEach(ab => { if (!q.length) q.push(ab[0]); q.push(ab[1]); })); let a2 = 0; for (let i = 0; i < q.length; i++) { const u = q[i], v = q[(i + 1) % q.length]; a2 += u.x * v.y - v.x * u.y; } return a2 / 2; };
  // 링 방향(부호 면적) × 이음선을 CF→옆으로 지나는가(+1)/옆→CF(−1): 두 조각의 곱이 서로 반대여야 같은 변을 «반대로» 공유한다
  const cfFirst = (a) => Math.abs(a.x - cxB) < 1e-9 ? 1 : -1;
  const orient = (segs, start) => Math.sign(ringArea(segs)) * cfFirst(start);
  ok(orient(yseg, yStart) === -orient(bseg, bStart), `4b: ${side} 요크와 몸판이 같은 이음선을 서로 반대 방향으로 통과`);
  ok(near(arcLen(ys), arcLen(run), 1e-6), `4b: ${side} 이음 길이 요크 = 몸판`);
  // (e) 교점·BP 위치를 옮기지 않는다: 둥글린 곡선이 각 모서리 정점에서 벗어난 거리는 미소(< 0.1cm)
  f.seamFairing.forEach(c => {
    const near2 = Math.min(...pts.map(p => D(p, c.at)));
    ok(near2 < 0.1, `4b: ${side} truing 이 모서리(${c.at.x.toFixed(2)},${c.at.y.toFixed(2)})를 ${near2.toFixed(3)}cm 이상 옮기지 않는다`);
  });
  // (f) 둥글리기 때문에 이음 길이·면적이 어긋나지 않는다(길이 보존 핸들 보정)
  ok(Math.abs(f.seamFairingAreaCm2) < 1, `4b: ${side} truing 면적 변화 ${f.seamFairingAreaCm2.toFixed(3)}cm² (미소)`);
});
// 절개 교점이 BP 에 붙지 않았다: 앞 둘째 절개(WL 3등분)는 BP 에서 떨어져 있다(스냅 없음)
{
  const bp = GT.yokeSeam.front.seamPoints.apex, c2 = GT.yokeSeam.front.flare.cuts[0].seamPoint;
  ok(D(bp, c2) > 0.5, `4b: 절개 교점이 BP 에 스냅되지 않았다(떨어진 거리 ${D(bp, c2).toFixed(3)}cm)`);
}

// ── 5. 폐곡선·자기교차·겹침 ──
{
  const ring = (outline) => {
    const ss = segsOf(outline).map(s => Object.assign({}, s)), used = ss.map(() => false), out = [ss[0]]; used[0] = true; let tip = ss[0].to;
    for (let k = 1; k < ss.length; k++) {
      let f = -1, rev = false;
      for (let j = 0; j < ss.length; j++) { if (used[j]) continue; if (D(ss[j].from, tip) < 1e-6) { f = j; break; } if (D(ss[j].to, tip) < 1e-6) { f = j; rev = true; break; } }
      if (f < 0) return null; used[f] = true; out.push(rev ? T.reverseSeg(ss[f]) : ss[f]); tip = out[out.length - 1].to;
    }
    return D(tip, out[0].from) < 1e-6 ? out : null;
  };
  const flat = (r) => { const pts = []; r.forEach(s => { T.flattenLine([s]).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }); }); return pts; };
  const selfX = (r) => {
    const f = []; r.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab)));
    for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) {
      if (i === 0 && j === f.length - 1) continue;
      if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
      if (D(f[i][1], f[j][0]) < 1e-6 || D(f[j][1], f[i][0]) < 1e-6 || D(f[i][0], f[j][0]) < 1e-6 || D(f[i][1], f[j][1]) < 1e-6) continue;
      return true;
    }
    return false;
  };
  ["frontBody", "backBody", "frontYoke"].forEach(k => { const r = ring(GT[k].outline); ok(!!r && !selfX(r), `5: ${k} 폐곡선·자기교차 0`); });
  // 몸판 윤곽이 단순 폐곡선 = 세 조각이 서로 겹치지 않는다. 면적 보존: (몸판) = (절개 전 조각 합) + 쐐기·밑단 호
  ["front", "back"].forEach(side => {
    const m = GT.yokeSeam[side], B = GT[side + "Body"];
    const pts = flat(ring(B.outline)); let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
    ok(near(Math.abs(a / 2), m.areaBodyCm2, 1e-6), `5: ${side} 메타 몸판 면적 = 윤곽 재계산`);
  });
}

// ── 6. 체크포인트(독립 재계산·변조 거부) ──
const mk = (geometry, body) => ({ sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const chk = (p) => { PROJECT = p; return BC.check(p); };
const reasonOf = (p) => { const c = chk(p); return c.ok ? null : c.fails.filter(f => /^yoke-/.test(f))[0] || c.fails[0]; };
{
  const c = chk(mk(clone(GT), T_BODY));
  ok(c.ok, "6: Ⓣ 검사 통과: " + c.fails.join());
  ["front", "back"].forEach(k => {
    const r = c.yokeSeam[k];
    ok(r.variant === "T" && r.closed.yoke && r.closed.body && r.selfIntersects === false, "6: " + k + " 폐곡선·자기교차 0(재계산)");
    ok(near(r.bustWidthCm, BW[k], 1e-3) && near(r.flareWantCm, FLARE[k], 1e-3) && near(r.flareCm, FLARE[k], 1e-3) && r.flareCuts === 2, "6: " + k + " ∅ = BL 폭×½−2.5 독립 재계산 " + r.flareCm);
    ok(near(r.deltaCm, 0, 1e-4) && near(r.hemSideExtraCm, 2.5, 1e-6) && r.areaDeltaCm2 > 0, "6: " + k + " 이음 길이 보존·밑단 옆 +2.5·쐐기 면적 양수");
    ok(near(r.bustLineY, BLY, 1e-3) && near(r.seamYCm, YS, 1e-3), "6: " + k + " BL·이음선 y 독립 재계산");
  });
  ok(J(c.yokeSeam.front.absorbedDartIds) === J(["front-bust"]) && J(c.yokeSeam.back.preservedDartIds) === J(["back-shoulder"]), "6: 흡수 앞 AH / 보존 뒤 어깨 다트 기록");
  const cs = chk(mk(clone(GS), S_BODY));
  ok(cs.ok && cs.yokeSeam.front.variant === "S" && !("flareCm" in cs.yokeSeam.front), "6: Ⓢ 경로는 Ⓣ 키 없음·통과");
  const tamper = (fn, body) => { const g = clone(GT); fn(g); return reasonOf(mk(g, body || T_BODY)); };
  ok(tamper(g => { g.yokeSeam.front.flare.totalCm += 0.5; }) === "yoke-flare-mismatch", "6: 메타 ∅ 위조 거부");
  ok(tamper(g => { delete g.yokeSeam.back.flare; }) === "yoke-flare-mismatch", "6: flare 메타 삭제 거부");
  ok(tamper(g => { g.frontBody.outline.forEach(s => { if (s.kind === "path" && s.edge === "hem") s.commands[1].points[2].x += 0.6; }); }) !== null, "6: 밑단 호 끝점 변조 거부");
  ok(tamper(g => { g.backBody.outline = g.backBody.outline.filter(s => !(s.kind === "path" && s.edge === "hem")); }) !== null, "6: 밑단 이음 호 삭제 거부");
  ok(tamper(g => { g.backBody.outline.some(s => { if (s.edge === "yoke-seam" && s.kind === "line") { s.from.y += 0.3; return true; } return false; }); }) !== null, "6: 몸판 이음선 변조 거부");
  ok(tamper(g => { g.frontBody.outline.forEach(s => { if (s.edge === "center") ["from", "to"].forEach(k => { s[k].x += 0.4; }); }); }) !== null, "6: 중심선 이동(고정 조각 변조) 거부");
  ok(tamper(g => { g.backYoke.construction.pop(); }) !== null, "6: 뒤 어깨 다트 다리 삭제 거부");
  ok(tamper(g => { g.frontYoke.construction.push(clone(g.front.construction.filter(s => s.dart && s.dart.id === "front-bust")[0])); }) === "yoke-seam-dart-open", "6: 앞 AH 다트가 열려 있으면 거부");
  ok(tamper(g => { g.yokeSeam.front.flare.cuts[0].areaDeltaCm2 += 1; }) === "yoke-seam-area-mismatch", "6: 면적 메타 위조 거부");
  ok(reasonOf(mk(clone(GS), T_BODY)) !== null && reasonOf(mk(clone(GT), S_BODY)) !== null, "6: 파라미터·geometry 가 Ⓢ/Ⓣ 서로 어긋나면 거부");
  // 완료본·hash
  const pr = mk(clone(GT), T_BODY); PROJECT = pr;
  const done = BC.complete(pr);
  ok(done.ok && pr.working.bodiceResult.yokeSeam.front.flare.cuts.length === 2 && Object.isFrozen(pr.working.bodiceResult), "6: 완료본에 Ⓣ 메타 보존·동결");
  ok(!!pr.working.bodiceResult && J(pr.working.bodiceResult.frontBody.outline) === J(GT.frontBody.outline), "6: 완료본 몸판 = 현재 geometry");
  const hash = (g, b) => { const p = mk(clone(g), b); PROJECT = p; const c2 = BC.complete(p); return c2.ok ? BC.latest(p).hash : "FAIL:" + c2.reason; };
  const hT = hash(GT, T_BODY);
  ok(hT === hash(GT, T_BODY) && !hT.startsWith("FAIL") && hT !== hash(GS, S_BODY), "6: Ⓣ hash 결정론 · Ⓢ hash 와 다름");
  const pe = mk(clone(GT), T_BODY); PROJECT = pe; BC.complete(pe);
  pe.working.geometry.frontBody.outline.some(s => { if (s.kind === "line" && s.edge === "hem") { s.to.y += 0.05; return true; } return false; });   // hash 는 끝점 기준(canonOutline)
  ok(BC.isCurrentBodiceChanged(pe) === true, "6: 완료 뒤 몸판 밑단이 바뀌면 스테일(hash 반영)");
  // A~Ⓢ 완료본 hash 불변(HEAD c7230fe 측정)
  const H = { Q: "1160ab37", R: "5463eb91", A: "2779faf5", M: "d1bece2f", P: "588eb1bd" };
  Object.keys(H).forEach(k => { const b = BP.bodyParams("bunka-bodice-" + k); ok(hash(DB.computeGeometry(REF, { body: b }), b) === H[k], "6: " + k + " 완료본 hash 불변 " + H[k]); });
}

// ── 7. 표시·배치·렌더 ──
{
  const m = DL.yokeLabels(GT);
  ok(m && m.labels.length === 4 && m.seams.length === 2 && !m.gathers, "7: 조각명 4·이음선 2·개더 라벨 없음");
  const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
  const bb = (pc) => { const pts = []; pc.outline.forEach(p => ptsOf(p, pts)); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
  const overlap = (a, b) => a.minX < b.maxX - 1e-9 && b.minX < a.maxX - 1e-9 && a.minY < b.maxY - 1e-9 && b.minY < a.maxY - 1e-9;
  const disp = { frontYoke: GT.frontYoke, backYoke: GT.backYoke, frontBody: DL.peplumDisplayPiece(GT, "frontBody"), backBody: DL.peplumDisplayPiece(GT, "backBody") };
  ok(!overlap(bb(disp.frontYoke), bb(disp.frontBody)) && !overlap(bb(disp.backYoke), bb(disp.backBody)), "7: 요크·몸판 표시 bbox 겹침 0(앞·뒤)");
  let layout; try { layout = DL.autoLayout(GT); } catch (e) { layout = null; }
  ok(!!layout, "7: autoLayout 성공");
  if (layout) {
    const off = (pc) => layout[pc] || { dx: 0, dy: 0 };
    const union2 = (a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY) });
    const place = (b, pc) => ({ minX: b.minX + off(pc).dx, maxX: b.maxX + off(pc).dx, minY: b.minY + off(pc).dy, maxY: b.maxY + off(pc).dy });
    ok(!overlap(place(union2(bb(disp.frontYoke), bb(disp.frontBody)), "front"), place(union2(bb(disp.backYoke), bb(disp.backBody)), "back")), "7: 자동 배치 앞·뒤 묶음 bbox 겹침 0");
  }
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontYoke: GT.frontYoke, frontBody: GT.frontBody, backYoke: GT.backYoke, backBody: GT.backBody }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "7: 렌더러 검증 통과(밑단 곡선 포함) " + (err || ""));
  const ids = grp ? grp.kids.map(k => J(k.attrs || {})) : [];
  ok(new Set(ids).size === ids.length, "7: 중복 렌더 0");
}

// ── 8. UI: 잠금 문구·pending 수용 ──
{
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  ok(/body\.yokeSeam === "T"/.test(src), "8: ui.js 가 yokeSeam \"T\" 를 라인 적용에 싣는다");
  const mMsg = src.match(/const yokeLockMsg = [^\n]*;/), mCir = src.match(/const yokeCircled = [^\n]*;/);
  if (mMsg && mCir) {
    const f = new Function(mMsg[0] + mCir[0] + "return (body) => yokeLockMsg(yokeCircled(window.bodicePresets.yokeVariantSymbol(body)));");
    const msgOf = vm.runInContext("(" + f.toString() + ")()", sandbox);
    ok(msgOf(T_BODY).includes("Ⓣ 적용 중") && !msgOf(T_BODY).includes("Ⓢ"), "8: Ⓣ 잠금 문구는 Ⓣ 로 표시");
    ok(msgOf(S_BODY).includes("Ⓢ 적용 중"), "8: Ⓢ 문구 불변");
  } else ok(false, "8: ui.js 에 yokeLockMsg/yokeCircled 존재");
}
ok(J(REF) === SNAP, "9: reference 불변");

console.log("══════════════════════════════════════════════");
console.log(`yokeSeamTCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
