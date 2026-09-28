// ══════════════════════════════════════════════
// designWaistSeamCheck.js — js/designWaistSeam.js (허리 이음선 Ⓜ 순수 조합) 회귀.
//
// 입력: 실제 designBodice 출력(Ⓜ body: 엉덩이 20 · 옆선 −1.5 · 밑단 +1, B83/W64/BL38)을 얼려 둔
//   fixtures/bodiceMGeometry.json + 합성 변형. 계약:
//   (1) upper 는 a·e 유지, b·d 는 닫는다 — 닫힌 다트 흔적 0, 진동 여유 > 0.
//   (2) peplum 은 a·b·d·e 를 같은 입 너비로 잡아 designJoin.buttJoin 을 다트 수만큼 **순차** 호출,
//       각 쌍은 semantic joinPairId, 결과는 앞/뒤 각각 한 장(검산 메타 유지).
//   (3) 모든 폐곡선: 연속 · 자기교차 0 · 면적 > 0.
//   (4) upper 봉제 허리 == peplum 허리(맞댄 뒤).
//   (5) 입력 불변 · 결정론 · 원자적 거부 · 순수(document 없음).
//
//   node test/harness/designWaistSeamCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) {
    if (!e.reason) { FAIL++; fails.push(`${name} (reason 없음: ${e.message})`); }
    else if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); }
    else PASS++;
  }
}
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const J = JSON.stringify;

// 순수성 샌드박스: document 를 주지 않는다 — 접근하면 ReferenceError.
const sandbox = { window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const js = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
js("designLineTool.js"); js("designJoin.js"); js("designWaistSeam.js");
const WS = sandbox.window.designWaistSeam, T = sandbox.window.designLineTool, JN = sandbox.window.designJoin;
const REAL = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "bodiceMGeometry.json"), "utf8"));

ok(typeof WS.split === "function" && Object.isFrozen(WS), "0: API·frozen");

// ── 헬퍼 ──
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (prims) => T.outlinePrimsToSegs(prims);
const lenOf = (segs) => segs.reduce((L, s) => L + T.flattenLine([s]).reduce((t, ab) => t + D(ab[0], ab[1]), 0), 0);
function areaOf(segs) {
  const pts = [];
  segs.forEach(s => T.flattenLine([s]).forEach(ab => { if (!pts.length) pts.push(ab[0]); pts.push(ab[1]); }));
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return Math.abs(a / 2);
}
function selfX(segs) {
  const f = []; segs.forEach(s => T.flattenLine([s]).forEach(ab => f.push(ab)));
  const t = (u, v) => D(u, v) < 1e-6;
  for (let i = 0; i < f.length; i++) for (let j = i + 2; j < f.length; j++) {
    if (i === 0 && j === f.length - 1) continue;
    if (!T.segCross(f[i][0], f[i][1], f[j][0], f[j][1])) continue;
    if (t(f[i][1], f[j][0]) || t(f[j][1], f[i][0]) || t(f[i][0], f[j][0]) || t(f[i][1], f[j][1])) continue;
    return true;
  }
  return false;
}
// 조각이 폐곡선인가(순서 무관 체인) — 연속·자기교차 0·면적>0.
function closedOk(prims) {
  const R = JN.buildClosedRing(segsOf(prims));
  if (!R.ok) return false;
  for (let i = 0; i < R.chain.length; i++) if (D(R.chain[i].to, R.chain[(i + 1) % R.chain.length].from) > 1e-4) return false;
  return !selfX(R.chain) && areaOf(R.chain) > 0.01;
}
const legsOf = (piece, id) => (piece.construction || []).filter(s => s.dart && s.dart.id === id);
const ids = (piece) => (piece.construction || []).map(s => s.dart && s.dart.id).filter((v, i, a) => v && a.indexOf(v) === i);
const width = (piece, id) => { const g = legsOf(piece, id); if (g.length !== 2) return null; const m = s => (s.dart.apexAt === "to" ? s.from : s.to); return D(m(g[0]), m(g[1])); };
const SNAP = J(REAL);

// ── 1. 실제 앞·뒤판: 네 조각 ──
const R1 = WS.split(REAL);
ok(J(REAL) === SNAP, "1: 입력 geometry 불변");
ok(J(Object.keys(R1).sort()) === J(["back", "backPeplum", "front", "frontPeplum", "meta"]), "1: 출력 = front/back + frontPeplum/backPeplum + meta");
["frontPeplum", "backPeplum"].forEach(k => ok(closedOk(R1[k].outline), "1: " + k + " 외곽 폐곡선(upper 는 열린 다트 입구가 있어 2 에서 링으로 검사)"));

// ── 2. upper: 폐곡선(열린 진동·어깨 다트를 construction 다리로 닫은 상태) ──
{
  const t = T;
  ["front", "back"].forEach(k => {
    const u = R1[k];
    const outS = segsOf(u.outline);
    // 열린 다트 입구는 원형과 같은 형태로 남는다 → 링(다리 포함)으로 닫혀야 한다
    const legs = u.construction.filter(s => s.dart && s.dart.boundary !== "waist" && s.kind === "line");
    const rr = t.buildPieceRing(outS, legs);
    ok(rr.ok, "2: " + k + " upper 링 구성");
    if (rr.ok) {
      const segs = rr.ring.map(r => r.seg);
      ok(!selfX(segs) && areaOf(segs) > 0.01, "2: " + k + " upper 자기교차 0·면적>0");
    }
    ok(outS.some(s => s.edge === "waist"), "2: " + k + " 허리선이 upper 외곽");
    ok(!outS.some(s => s.edge === "hem"), "2: " + k + " upper 에 밑단 없음");
    // 옆쪽 조각이 다트 apex 를 축으로 돌아 허리 옆 끝이 조금 내려간다(≪ 밑단 58) — 페플럼 영역으로 넘어가지 않는다.
    const maxY = Math.max.apply(null, outS.map(s => Math.max(s.from.y, s.to.y)));
    ok(maxY < 41, "2: " + k + " upper 는 허리 근처까지(회전으로 옆 끝 ≤ +3cm): " + maxY.toFixed(2));
  });
  // b(앞)·d(뒤) 닫힘 — 흔적 0, a·e 유지
  ok(ids(R1.front).indexOf("front-waist-b") < 0 && ids(R1.front).indexOf("front-waist-a") >= 0, "2: 앞 — b 닫힘·a 유지");
  ok(ids(R1.back).indexOf("back-waist-d") < 0 && ids(R1.back).indexOf("back-waist-e") >= 0, "2: 뒤 — d 닫힘·e 유지");
  ok(near(width(R1.front, "front-waist-a"), width(REAL.front, "front-waist-a"), 1e-9), "2: a 폭 그대로");
  ok(near(width(R1.back, "back-waist-e"), width(REAL.back, "back-waist-e"), 1e-9), "2: e 폭 그대로");
  ok(ids(R1.front).indexOf("front-side-waist-c") >= 0 && ids(R1.back).indexOf("back-waist-f") >= 0, "2: c·f 는 남는다");
  // 진동 여유: 닫은 다트의 반동
  const mf = R1.meta.front.closedDart, mb = R1.meta.back.closedDart;
  ok(mf.dartId === "front-waist-b" && mb.dartId === "back-waist-d", "2: 닫힌 다트 id");
  ok(mf.armholeEaseCm > 0 && mb.armholeEaseCm > 0, "2: 진동 여유 > 0");
  ok(near(mf.armholeEaseCm, 2 * mf.slashLenCm * Math.sin(Math.abs(mf.dartAngleRad) / 2), 1e-9), "2: 앞 여유 = 2·절개길이·sin(θ/2)");
  ok(near(mb.armholeEaseCm, 2 * mb.slashLenCm * Math.sin(Math.abs(mb.dartAngleRad) / 2), 1e-9), "2: 뒤 여유 = 2·절개길이·sin(θ/2)");
  ok(mf.residualWaistGapCm < 0.02 && mb.residualWaistGapCm < 0.02, "2: 허리 mouth 가 겹친다(잔여 < 0.02)");
  ok(Math.abs(Math.abs(mf.dartAngleRad) - 2 * Math.atan2(width(REAL.front, "front-waist-b") / 2, 23.1917)) < 0.01, "2: 앞 다트각 ≈ 입 너비/다리 길이");
  // 허리 외곽 길이 = 원래 − 닫은 입 너비(회전은 길이를 보존)
  ok(near(R1.meta.front.upperWaistEdgeCm, D(REAL.front.construction[8].from, REAL.front.construction[8].to) - width(REAL.front, "front-waist-b"), 1e-6), "2: 앞 허리 외곽 = W − b");
  ok(near(R1.meta.back.upperWaistEdgeCm, 21.5531 - width(REAL.back, "back-waist-d"), 1e-6), "2: 뒤 허리 외곽 = W − d");
}

// ── 3. peplum: 다트 수만큼 buttJoin 순차 · semantic pair · 한 장 ──
{
  const mf = R1.meta.front, mb = R1.meta.back;
  ok(J(mf.joins.map(j => j.joinPairId)) === J(["front-peplum-b", "front-peplum-a"]) || J(mf.joins.map(j => j.joinPairId)) === J(["front-peplum-a", "front-peplum-b"]), "3: 앞 join id = front-peplum-{a,b}");
  ok(J(mb.joins.map(j => j.joinPairId).sort()) === J(["back-peplum-d", "back-peplum-e"]), "3: 뒤 join id = back-peplum-{d,e}");
  [mf, mb].forEach((m, i) => {
    const nm = i ? "뒤" : "앞";
    ok(m.joins.length === 2, "3: " + nm + " join 2회(순차)");
    ok(m.joins.every(j => Math.abs(j.seamLenDeltaCm) < 0.01 && j.maxSeamDeviationCm < 0.01 && j.residualGapCm < 0.01), "3: " + nm + " 맞댐 검산(길이·형상·틈)");
    ok(m.joins.every(j => Math.abs(j.areaDeltaCm2) < 0.05), "3: " + nm + " 면적 = 합(겹침 없음)");
  });
  ["frontPeplum", "backPeplum"].forEach(k => {
    const p = R1[k];
    ok(closedOk(p.outline), "3: " + k + " 한 장의 폐곡선");
    ok(p.construction.length === 0, "3: " + k + " 구성선 없음");
    const s = segsOf(p.outline);
    ok(!s.some(x => /^join:/.test(x.edge || "")), "3: " + k + " 맞댄 다리는 외곽에 남지 않는다");
    ok(s.some(x => x.edge === "hem") && s.some(x => x.edge === "waist"), "3: " + k + " 허리·밑단 보존");
    ok(areaOf(s) > 100, "3: " + k + " 면적>0");
  });
  // 면적 합: 원래 페플럼(20 × 폭) − 잘려 나간 wedge 들
  const wedge = (id, side) => { const g = legsOf(REAL[side], id); const w = width(REAL[side], id); return w; };
  const origFront = D({ x: 47.5, y: 38 }, { x: 24.5531, y: 38 });
  ok(near(R1.meta.front.peplumWaistSeamCm, origFront - width(REAL.front, "front-waist-a") - width(REAL.front, "front-waist-b"), 1e-6), "3: 앞 페플럼 허리 = W − a − b");
  ok(near(R1.meta.back.peplumWaistSeamCm, 21.5531 - width(REAL.back, "back-waist-d") - width(REAL.back, "back-waist-e"), 1e-6), "3: 뒤 페플럼 허리 = W − d − e");
  // 페플럼 다트 너비 = 몸판 다트 입 너비
  ok(R1.meta.front.peplumDarts.every(d => near(d.widthCm, width(REAL.front, d.id))), "3: 앞 페플럼 다트 = 몸판과 같은 분량");
  ok(R1.meta.back.peplumDarts.every(d => near(d.widthCm, width(REAL.back, d.id))), "3: 뒤 페플럼 다트 = 몸판과 같은 분량");
  // 밑단 둘레 = 원래 밑단 길이(다트 apex 가 밑단이라 밑단은 줄지 않는다)
  const hemLen = (p) => lenOf(segsOf(p.outline).filter(s => s.edge === "hem"));
  ok(near(hemLen(R1.frontPeplum), D({ x: 47.5, y: 58 }, { x: 22.0531, y: 58 }), 1e-6), "3: 앞 밑단 길이 보존");
  ok(near(hemLen(R1.backPeplum), 24.0531, 1e-6), "3: 뒤 밑단 길이 보존");
}

// ── 4. 허리 이음 길이 정합 ──
{
  ["front", "back"].forEach(k => {
    const m = R1.meta[k];
    ok(Math.abs(m.waistSeamDeltaCm) < 0.01, "4: " + k + " upper 봉제 허리 == peplum 허리");
    ok(near(m.upperWaistSeamCm, m.upperWaistEdgeCm - m.upperOpenDartCm, 1e-9), "4: " + k + " upper 봉제 허리 = 허리 외곽 − 열린 다트 입");
    const pw = lenOf(segsOf(R1[k + "Peplum"].outline).filter(s => s.edge === "waist"));
    ok(near(pw, m.peplumWaistSeamCm, 1e-9), "4: " + k + " peplum 허리 = 조각에서 잰 길이");
  });
}

// ── 5. 결정론 ──
ok(J(WS.split(REAL)) === J(R1) && J(WS.split(deepc(REAL))) === J(R1), "5: 같은 입력 → 같은 결과(결정론)");
function deepc(v) { return JSON.parse(JSON.stringify(v)); }

// ── 6. 원자적 거부 ──
{
  const S = J(REAL);
  const noHem = deepc(REAL);
  noHem.front.outline = noHem.front.outline.filter(s => !/extension/.test((s.boundary && s.boundary.root) || "") && s.edge !== "hem");
  throwsReason(() => WS.split(noHem), "no-hem-extension", "6: 밑단 없으면 거부");
  const noWaist = deepc(REAL); noWaist.back.construction = noWaist.back.construction.filter(s => s.edge !== "waist");
  throwsReason(() => WS.split(noWaist), "no-waist-edge", "6: 허리선 없으면 거부");
  throwsReason(() => WS.split({ front: REAL.front }), "invalid-geometry", "6: back 없으면 거부");
  const flared = deepc(REAL); flared.front.flareCm = { spread: 1 };
  throwsReason(() => WS.split(flared), "flare-unsupported", "6: 플레어 조각은 거부");
  // 뒤가 실패하면 앞 결과도 반환하지 않는다(원자성)
  const badBack = deepc(REAL); badBack.back.construction = badBack.back.construction.filter(s => s.edge !== "waist");
  let r = null; try { r = WS.split(badBack); } catch (e) { /* 기대 */ }
  ok(r === null, "6: 뒤 실패 시 부분 결과 없음");
  ok(J(REAL) === S && J(noHem) !== S, "6: 실패해도 입력 불변");
  // b 없음(배율 0) → 닫을 다트가 없어도 upper 는 정상, 흔적 없음
  const noB = deepc(REAL); noB.front.construction = noB.front.construction.filter(s => !(s.dart && s.dart.id === "front-waist-b"));
  const rb = WS.split(noB);
  ok(rb.meta.front.closedDart === null && ids(rb.front).indexOf("front-waist-b") < 0, "6: b 없으면 닫을 것 없음(흔적 0)");
  ok(rb.meta.front.joins.length === 1 && closedOk(rb.frontPeplum.outline), "6: b 없으면 a 하나만 맞댄다");
  ok(Math.abs(rb.meta.front.waistSeamDeltaCm) < 0.01, "6: b 없어도 허리 이음 정합");
  // 다트 전부 없음 → 페플럼은 한 장 그대로, join 0
  const none = deepc(REAL);
  none.front.construction = none.front.construction.filter(s => !(s.dart && /front-waist-[ab]$/.test(s.dart.id)));
  const rn = WS.split(none);
  ok(rn.meta.front.joins.length === 0 && closedOk(rn.frontPeplum.outline) && rn.meta.front.closedDart === null, "6: 다트 없으면 페플럼 그대로 한 장");
}

// ── 7. 순수성: DOM/storage 접근 없음(샌드박스에 document 없이 통과), 전역 오염 없음 ──
ok(Object.keys(sandbox.window).sort().join() === "designJoin,designLineTool,designWaistSeam", "7: window 에 designWaistSeam 하나만 추가");
{
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "designWaistSeam.js"), "utf8");
  ok(!/\b(document|localStorage|sessionStorage|indexedDB|innerHTML|Math\.random|Date\.now)\b/.test(src.replace(/\/\/.*$/gm, "")), "7: DOM·storage·난수·시간 미사용");
}

console.log(`designWaistSeamCheck: ${PASS} PASS, ${FAIL} FAIL`);
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
