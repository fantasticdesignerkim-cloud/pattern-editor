// yokeSeamSCheck.js — 요크 이음선 ② Ⓢ(P.32, «이음선을 넣고 중심에 개더 분량을 추가, 밑단에서 1cm 추가») 회귀.
//   node test/harness/yokeSeamSCheck.js
// 범위: 프리셋 Ⓢ · geometry(뒤 BL−5 수평 / 앞 CF→BP→옆선 BL−5 꺾인 선) · 앞 AH 다트 흡수 · 뒤 어깨 다트 열린 채 보존(요크 construction) ·
//       개더 폭 = 각 완성 이음선 길이×0.5(몸판에만) · 폐곡선·자기교차 0 · 체크포인트 독립 재계산·변조 거부 · 완료본/hash ·
//       표시(라벨·bbox·중복 렌더 0) · 잠금 문구 · A~Ⓡ 바이트 불변(HEAD 12202c5 에서 측정한 sha256 앞 16자 / 완료본 hash).
// 사용자 확정(2026-10-01): 뒤 어깨 다트는 도해처럼 요크에 열린 봉제 다트로 남긴다.
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

const Q_BODY = BP.bodyParams("bunka-bodice-Q"), R_BODY = BP.bodyParams("bunka-bodice-R"), S_BODY = BP.bodyParams("bunka-bodice-S");
const GQ = DB.computeGeometry(REF, { body: Q_BODY });
const GS = DB.computeGeometry(REF, { body: S_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const seamSegs = (pc) => pc.outline.filter(s => s.edge === "yoke-seam");
const seamLen = (pc) => seamSegs(pc).reduce((t, s) => t + D(s.from, s.to), 0);
const BLY = 12 / 12 * 0 + (83 / 12 + 13.7);              // 원형 BL y = B/12 + 13.7 (B=83) — draft.js yBL 공식과 독립으로 다시 계산
const YS = BLY + 5;
const edgesOf = (pc, e) => segsOf(pc.outline).filter(s => s.edge === e);

// ── 1. 프리셋 Ⓢ ──
ok(BP.resolve("yoke-seam-2", "bunka-bodice-S").ok, "1: Ⓢ 해석 성공(실행 가능)");
ok(J(S_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: "S" }), "1: Ⓢ 파라미터 = 박시 Ⓐ + 밑단 옆 +1 + yokeSeam:S");
ok(BP.family("yoke-seam-2").availability === "available" && BP.variant("yoke-seam-2", "bunka-bodice-T").availability === "pending-op" &&
   typeof BP.variant("yoke-seam-2", "bunka-bodice-T").blockedBy === "string", "1: 요크 ② 라인 available · Ⓣ 는 보류+blockedBy");
ok(J(Q_BODY) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true }) && J(R_BODY) === J(Object.assign({}, Q_BODY, { yokeGather: true })), "1: Ⓠ·Ⓡ 파라미터 불변");
ok(BP.yokeVariantSymbol(S_BODY) === "S" && BP.yokeVariantSymbol(Q_BODY) === "Q" && BP.yokeVariantSymbol(R_BODY) === "R", "1: body → 변형 기호(Q/R/S)");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, S_BODY, { waistSeam: true }) }), "yoke-seam-waist-seam-conflict", "1: 요크+허리 이음선 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, S_BODY, { flare: true }) }), "yoke-seam-flare-conflict", "1: 요크+플레어 충돌 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, S_BODY, { yokeGather: false }) }), "yoke-seam-s-gather-implied", "1: Ⓢ 의 개더는 끌 수 없다");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, S_BODY, { yokeSeam: "T" }) }), "invalid-body-yoke-seam", "1: 알 수 없는 yokeSeam 값 거부");
ok(J(DB.computeGeometry(REF, { body: S_BODY })) === J(GS), "1: 결정론(같은 입력 → 바이트 동일)");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. A~Ⓡ 바이트 불변(HEAD 12202c5 측정) ──
const FIXED = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", G: "d9a46f8358daec84",
  M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37", P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce", R: "63193d5a879a6235" };
Object.keys(FIXED).forEach(k => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + k) })) === FIXED[k], "2: " + k + " geometry 바이트 불변"));
ok(!("variant" in GQ.yokeSeam.front) && !("gather" in GQ.yokeSeam.front), "2: Ⓠ 메타에 Ⓢ 키 없음");

// ── 3. Ⓢ geometry ──
ok(J(GS.front) === J(GQ.front) && J(GS.back) === J(GQ.back), "3: 전체 앞/뒤판 불변(슬롯만 추가)");
{
  // 뒤: BL−5 수평
  const bs = seamSegs(GS.backBody), ys = seamSegs(GS.backYoke);
  ok(bs.length === 1 && ys.length === 1, "3: 뒤 이음선은 요크·몸판 각 1줄");
  [bs[0].from, bs[0].to, ys[0].from, ys[0].to].forEach((p, i) => ok(near(p.y, YS, 1e-9), `3: 뒤 이음선 끝점${i} y = BL+5 = ${YS}`));
  ok(near(GS.yokeSeam.back.bustLineY, BLY, 1e-9) && near(GS.yokeSeam.back.seamY, YS, 1e-9), "3: 뒤 메타 BL·이음선 y");
  const cbX = edgesOf(GS.back, "center")[0].from.x, sideX = edgesOf(GS.back, "side-seam")[0].from.x;
  ok(near(ys[0].from.x, sideX) || near(ys[0].to.x, sideX), "3: 뒤 이음선이 옆선에서 끝난다");
  ok(near(ys[0].from.x, cbX) || near(ys[0].to.x, cbX), "3: 뒤 요크 이음선이 CB 에서 시작");
}
{
  // 앞: CF→BP 수평(BL 높이) + BP→옆선 BL−5 사선
  const bs = seamSegs(GS.frontBody), ys = seamSegs(GS.frontYoke);
  ok(bs.length === 2 && ys.length === 2, "3: 앞 이음선은 요크·몸판 각 2줄(꺾인 선)");
  const wl = GS.front.construction.filter(s => s.dart && s.dart.id === "front-bust")[0];
  const apex = wl.dart.apexAt === "to" ? wl.to : wl.from;
  const cfX = edgesOf(GS.front, "center")[0].from.x, sideX = edgesOf(GS.front, "side-seam")[0].from.x;
  ok(near(apex.y, BLY, 1e-9), "3: BP(AH 다트 끝) y = BL(원형 공식)");
  const has = (segs, p) => segs.some(s => D(s.from, p) < 1e-9 || D(s.to, p) < 1e-9);
  const hor = bs.filter(s => near(s.from.y, BLY, 1e-9) && near(s.to.y, BLY, 1e-9)), sl = bs.filter(s => !(near(s.from.y, BLY, 1e-9) && near(s.to.y, BLY, 1e-9)));
  ok(hor.length === 1 && sl.length === 1, "3: 몸판 = 수평 1 + 사선 1");
  ok(has(hor, apex) && has(sl, apex), "3: 수평·사선이 BP 에서 만난다(꺾임점 = BP)");
  const far = near(sl[0].from.x, apex.x) && near(sl[0].from.y, apex.y) ? sl[0].to : sl[0].from;
  ok(near(far.x, sideX, 1e-9) && near(far.y, YS, 1e-9), `3: 사선 끝 = 옆선 BL−5 점 (${sideX}, ${YS})`);
  const gW = GS.yokeSeam.front.gather.addedCm, horFar = near(hor[0].from.x, apex.x) ? hor[0].to : hor[0].from;
  ok(near(horFar.x, cfX + gW, 1e-9) && near(horFar.y, BLY, 1e-9), "3: 몸판 수평 구간 = BP → 개더 띠 바깥(CF + 분량), BL 높이");
  // 요크 이음선: 수평 구간은 원래 CF 에서 BP 까지, 사선은 닫은 뒤 회전(길이 동일)
  const yh = ys.filter(s => near(s.from.y, BLY, 1e-9) && near(s.to.y, BLY, 1e-9));
  ok(yh.length === 1 && (near(yh[0].from.x, cfX) || near(yh[0].to.x, cfX)) && has(yh, apex), "3: 요크 수평 구간 = 원래 CF→BP(개더 없음)");
  const ysl = ys.filter(s => s !== yh[0])[0];
  ok(near(D(ysl.from, ysl.to), D(sl[0].from, sl[0].to), 1e-9), "3: 요크 사선 길이 = 몸판 사선 길이(강체 회전)");
  // 닫힌 뒤: 사선이 닫은 각만큼 회전 → meta 의 sideAfterClose
  const m = GS.yokeSeam.front;
  ok(m.absorbedDarts.length === 1 && m.absorbedDarts[0].id === "front-bust" && m.preservedDarts.length === 0, "3: 앞 메타 = AH 다트 흡수·보존 없음");
  ok(m.absorbedDarts[0].angleDeg > 17 && m.absorbedDarts[0].angleDeg < 19, "3: AH 다트각 ≈ 18.25° 로 닫힘 " + m.absorbedDarts[0].angleDeg);
}
// 다트: 앞 = 어디에도 없음 / 뒤 = 요크에 원본 그대로
{
  const hasId = (pc, id) => pc.outline.concat(pc.construction).some(s => s.dart && s.dart.id === id);
  ok(!hasId(GS.frontYoke, "front-bust") && !hasId(GS.frontBody, "front-bust"), "3: 앞 AH 다트 흡수(요크·몸판 어디에도 없음)");
  const wholeLegs = GS.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder");
  ok(wholeLegs.length === 2 && J(GS.backYoke.construction) === J(wholeLegs), "3: 뒤 어깨 다트 = 요크 construction 에 원본 다리 두 줄 그대로(바이트 동일)");
  ok(!hasId(GS.backBody, "back-shoulder") && !GS.backYoke.outline.some(s => s.dart), "3: 뒤 몸판엔 다트 없음·요크 외곽엔 다리 없음(열린 V 노치)");
  const m = GS.yokeSeam.back;
  ok(m.absorbedDarts.length === 0 && m.preservedDarts.length === 1 && m.preservedDarts[0].id === "back-shoulder" && m.preservedDarts[0].open === true, "3: 뒤 메타 = 흡수 없음·열린 다트 보존");
  ok(J(GS.backYoke.outline.filter(s => s.edge === "shoulder").map(s => [s.from, s.to])) === J(GS.back.outline.filter(s => s.edge === "shoulder").map(s => [s.from, s.to])) ||
     GS.backYoke.outline.filter(s => s.edge === "shoulder").length === 2, "3: 뒤 어깨선은 다트 입구에서 둘로 나뉜 그대로");
  ok(!GS.backYoke.outline.some(s => s.closedDart), "3: 뒤 요크에 닫힘 흔적(closedDart) 없음");
}
// 개더 분량·이음 길이
["front", "back"].forEach(side => {
  const Y = GS[side + "Yoke"], B = GS[side + "Body"], m = GS.yokeSeam[side], g = m.gather;
  const ly = seamLen(Y), lb = seamLen(B);
  ok(near(g.addedCm, 0.5 * ly, 1e-9) && g.rule === "seam-length-half", `3: ${side} 개더 분량 ${g.addedCm} = 완성 이음선 ${ly} × 0.5`);
  ok(near(lb - ly, 0.5 * ly, 1e-9), `3: ${side} 몸판 이음 − 요크 이음 = 이음선 길이×0.5`);
  ok(near(m.seamLenUpperCm, ly, 1e-9) && near(m.seamLenLowerCm, lb, 1e-9) && near(m.seamDeltaCm, -g.addedCm, 1e-9), `3: ${side} 메타 이음 길이·delta 정직 기록`);
  const cx = edgesOf(GS[side], "center")[0].from.x, bcx = edgesOf(B, "center")[0].from.x;
  ok(near(Math.abs(bcx - cx), g.addedCm, 1e-9) && near(g.newCenterX, bcx), `3: ${side} 몸판 중심선이 분량만큼 평행 이동`);
  // 요크에는 추가 없음: 요크 중심 변 x 는 원래 중심
  ok(edgesOf(Y, "center").every(s => near(s.from.x, cx) && near(s.to.x, cx)), `3: ${side} 요크 중심선은 원래 위치(개더 없음)`);
  // 옆선·밑단 길이 불변, 밑단 옆 +1 유지
  const len = (segs) => segs.reduce((t, s) => t + D(s.from, s.to), 0);
  ok(near(len(edgesOf(B, "hem")), len(edgesOf(GS[side], "hem")) + g.addedCm, 1e-9), `3: ${side} 밑단 길이 = 원래 + 분량(중심 쪽 확장만)`);
  const sb = edgesOf(B, "side-seam"), top = sb.flatMap(s => [s.from, s.to]).reduce((a, b) => b.y < a.y ? b : a), bot = sb.flatMap(s => [s.from, s.to]).reduce((a, b) => b.y > a.y ? b : a);
  ok(near((top.x >= bcx ? 1 : -1) * (bot.x - top.x), 1, 1e-9), `3: ${side} 밑단 옆 +1cm`);
  const bd = B.construction.filter(s => s.gatherBoundary);
  ok(bd.length === 1 && near(bd[0].from.x, cx) && near(bd[0].gatherCm, g.addedCm) && near(bd[0].from.y, side === "front" ? BLY : YS, 1e-9), `3: ${side} 개더 경계선(원래 중심) 1줄·윗변 = 중심 쪽 이음선 높이`);
  const botY = Math.max(...edgesOf(B, "center").flatMap(s => [s.from.y, s.to.y]));
  ok(near(g.areaAddedCm2, g.addedCm * (botY - (side === "front" ? BLY : YS)), 1e-6), `3: ${side} 면적 증가 = 분량 × 중심 이음선~밑단`);
  // 주름·턱 형상은 만들지 않는다: 몸판에 곡선·추가 선 없음
  ok(B.outline.filter(s => s.kind !== "line" && !s.edge).length === 0 && !B.construction.some(s => s.pleat || s.tuck), `3: ${side} 주름·턱 형상 없음`);
});
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
  ok(!!ring(GS.frontYoke.outline) && !!ring(GS.frontBody.outline) && !!ring(GS.backBody.outline), "3: 앞요크·앞몸판·뒤몸판 폐곡선");
  ok(ring(GS.backYoke.outline) === null, "3: 뒤요크 외곽 자체는 다트 입구가 열려 있다(다리와 합쳐야 닫힘)");
}
ok(J(REF) === SNAP, "3: reference 불변");

// ── 4. 체크포인트(독립 재계산·변조 거부) ──
const mk = (geometry, body) => ({ sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const chk = (p) => { PROJECT = p; return BC.check(p); };
const reasonOf = (p) => { const c = chk(p); return c.ok ? null : c.fails.filter(f => /^yoke-/.test(f))[0] || c.fails[0]; };
{
  const c = chk(mk(clone(GS), S_BODY));
  ok(c.ok, "4: Ⓢ 검사 통과: " + c.fails.join());
  ["front", "back"].forEach(k => {
    const r = c.yokeSeam[k];
    ok(r.variant === "S" && r.closed.yoke && r.closed.body && r.selfIntersects === false, "4: " + k + " 폐곡선·자기교차 0(재계산)");
    ok(near(r.gatherCm, 0.5 * r.seamLenYokeCm, 1e-3) && near(r.gatherDeltaCm, r.gatherCm, 1e-3), "4: " + k + " 개더 폭·이음 길이 차 = 이음선×½ 독립 재계산 " + r.gatherCm);
    ok(Math.abs(r.areaDeltaCm2 - r.gatherAreaCm2) < 0.05, "4: " + k + " 면적 = 전체 + 띠");
    ok(near(r.bustLineY, BLY, 1e-3) && near(r.seamYCm, YS, 1e-3), "4: " + k + " BL·이음선 y 독립 재계산");
  });
  ok(J(c.yokeSeam.front.absorbedDartIds) === J(["front-bust"]) && J(c.yokeSeam.back.absorbedDartIds) === J([]) && J(c.yokeSeam.back.preservedDartIds) === J(["back-shoulder"]), "4: 흡수 앞 AH / 보존 뒤 어깨 다트 기록");
  const cq = chk(mk(clone(GQ), Q_BODY));
  ok(cq.ok && !("variant" in cq.yokeSeam.front) && !("preservedDartIds" in cq.yokeSeam.front), "4: Ⓠ 경로는 Ⓢ 키 없음·통과");
  const tamper = (fn, body) => { const g = clone(GS); fn(g); return reasonOf(mk(g, body || S_BODY)); };
  ok(tamper(g => { g.yokeSeam.back.gather.addedCm = 9; }) === "yoke-gather-mismatch", "4: 메타 분량 위조 거부");
  ok(tamper(g => { delete g.yokeSeam.front.gather; }) === "yoke-gather-mismatch", "4: gather 메타 삭제 거부");
  ok(tamper(g => { g.backBody.outline.forEach(s => { if (s.kind === "line" && s.edge === "center") ["from", "to"].forEach(k => { s[k].x -= 0.4; }); }); }) !== null, "4: 몸판 띠 폭 변조 거부");
  ok(tamper(g => { g.backYoke.construction.pop(); }) === "yoke-seam-open" || tamper(g => { g.backYoke.construction.pop(); }) === "yoke-seam-dart-not-preserved", "4: 뒤 어깨 다트 다리 삭제 거부");
  ok(tamper(g => { g.backYoke.construction[0].to.x += 0.5; }) !== null, "4: 뒤 어깨 다트 다리 변형 거부");
  ok(tamper(g => { g.frontYoke.construction.push(clone(g.front.construction.filter(s => s.dart && s.dart.id === "front-bust")[0])); }) === "yoke-seam-dart-open", "4: 앞 AH 다트가 다시 열려 있으면 거부");
  ok(tamper(g => { g.backBody.construction.push(clone(g.back.construction.filter(s => s.dart && s.dart.id === "back-shoulder")[0])); }) === "yoke-seam-dart-not-preserved", "4: 뒤 몸판에 어깨 다트가 새면 거부");
  // 이음선 높이 변조(요크·몸판을 같이 0.3 올려도 BL−5 와 다르다)
  ok(tamper(g => { ["backYoke", "backBody"].forEach(k => g[k].outline.forEach(s => { if (s.edge === "yoke-seam") { s.from.y -= 0.3; s.to.y -= 0.3; } })); }) !== null, "4: 뒤 이음선 높이 변조 거부");
  ok(tamper(g => { g.frontBody.outline.forEach(s => { if (s.edge === "yoke-seam") { if (Math.abs(s.from.y - BLY) > 1e-6) s.from.y -= 0.3; if (Math.abs(s.to.y - BLY) > 1e-6) s.to.y -= 0.3; } }); }) !== null, "4: 앞 사선 끝점 변조 거부");
  // 파라미터가 Ⓢ 인데 geometry 가 Ⓠ 이면 거부(Ⓠ 규칙으로 Ⓢ 를 통과시키지 않는다)
  ok(reasonOf(mk(clone(GQ), S_BODY)) !== null, "4: 파라미터 Ⓢ + geometry Ⓠ 거부");
  // 완료본·hash
  const pr = mk(clone(GS), S_BODY); PROJECT = pr;
  const done = BC.complete(pr);
  ok(done.ok && pr.working.bodiceResult.yokeSeam.back.preservedDarts.length === 1 && Object.isFrozen(pr.working.bodiceResult), "4: 완료본에 Ⓢ 메타 보존·동결");
  ok(J(pr.working.bodiceResult.backYoke.construction) === J(GS.backYoke.construction) && J(pr.working.bodiceResult.frontBody.outline) === J(GS.frontBody.outline), "4: 완료본 요크 다트 다리·몸판 = 현재 geometry");
  const hS = BC.latest(pr).hash;
  const hash = (g, b) => { const p = mk(clone(g), b); PROJECT = p; const c2 = BC.complete(p); return c2.ok ? BC.latest(p).hash : "FAIL:" + c2.reason; };
  ok(hash(GS, S_BODY) === hS, "4: Ⓢ hash 결정론");
  ok(hS !== hash(GQ, Q_BODY) && hS !== hash(DB.computeGeometry(REF, { body: R_BODY }), R_BODY), "4: Ⓢ hash ≠ Ⓠ·Ⓡ hash");
  // 뒤 어깨 다트가 hash 에 반영된다(요크 외곽은 같고 다리만 다른 상태)
  const gd = clone(GS); gd.backYoke.construction[0].to.x += 0.05;
  const pd = mk(gd, S_BODY); PROJECT = pd; ok(BC.isCurrentBodiceChanged(pd) === true, "4: 완료 전 스테일(완료본 없음)");
  const pe = mk(clone(GS), S_BODY); PROJECT = pe; BC.complete(pe); pe.working.geometry.backYoke.construction[0].to.x += 0.05;
  ok(BC.isCurrentBodiceChanged(pe) === true, "4: 완료 뒤 요크 다트 다리가 바뀌면 스테일(hash 반영)");
  // Ⓠ·Ⓡ·A·M·P 완료본 hash 불변(HEAD 12202c5 측정)
  const H = { Q: "1160ab37", R: "5463eb91", A: "2779faf5", M: "d1bece2f", P: "588eb1bd" };
  Object.keys(H).forEach(k => { const b = BP.bodyParams("bunka-bodice-" + k); ok(hash(DB.computeGeometry(REF, { body: b }), b) === H[k], "4: " + k + " 완료본 hash 불변 " + H[k]); });
}

// ── 5. 표시·배치·렌더 ──
{
  const m = DL.yokeLabels(GS);
  ok(m && m.labels.length === 4 && m.seams.length === 2 && m.gathers && m.gathers.length === 2, "5: 조각명 4·이음선 2·개더 라벨 2");
  ok(m.gathers.every(l => /^개더 \+\d+(\.\d)?cm$/.test(l.text)), "5: 개더 라벨 = 분량 문자열");
  const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
  const bb = (pc) => { const pts = []; pc.outline.forEach(p => ptsOf(p, pts)); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
  const overlap = (a, b) => a.minX < b.maxX - 1e-9 && b.minX < a.maxX - 1e-9 && a.minY < b.maxY - 1e-9 && b.minY < a.maxY - 1e-9;
  const disp = { frontYoke: GS.frontYoke, backYoke: GS.backYoke, frontBody: DL.peplumDisplayPiece(GS, "frontBody"), backBody: DL.peplumDisplayPiece(GS, "backBody") };
  ok(!overlap(bb(disp.frontYoke), bb(disp.frontBody)) && !overlap(bb(disp.backYoke), bb(disp.backBody)), "5: 요크·몸판 표시 bbox 겹침 0(앞·뒤)");
  const keys = ["frontYoke", "frontBody", "backYoke", "backBody"];
  let layout; try { layout = DL.autoLayout(GS); } catch (e) { layout = null; }
  ok(!!layout, "5: autoLayout 성공");
  const union2 = (a, b) => ({ minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY) });
  if (layout) {
    const off = (pc) => layout[pc] || { dx: 0, dy: 0 };
    const place = (b, pc) => ({ minX: b.minX + off(pc).dx, maxX: b.maxX + off(pc).dx, minY: b.minY + off(pc).dy, maxY: b.maxY + off(pc).dy });
    const fb = place(union2(bb(disp.frontYoke), bb(disp.frontBody)), "front"), bk = place(union2(bb(disp.backYoke), bb(disp.backBody)), "back");
    ok(!overlap(fb, bk), "5: 자동 배치 앞·뒤 묶음 bbox 겹침 0");
  }
  // 조각 간(요크↔몸판·앞↔뒤) bbox 겹침 0 — 표시 좌표 네 조각 쌍 전부
  const four = keys.map(k => [k, bb(disp[k])]);
  const pairsOverlap = [];
  four.forEach(([ka, a], i) => four.forEach(([kb, b], j) => { if (j > i && (ka.slice(0, 1) === kb.slice(0, 1)) && overlap(a, b)) pairsOverlap.push(ka + "~" + kb); }));
  ok(pairsOverlap.length === 0, "5: 같은 쪽(앞/뒤) 조각 쌍 bbox 겹침 0 " + pairsOverlap.join());
  // 렌더러: 네 조각 모두 통과·중복 렌더 0
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontYoke: GS.frontYoke, frontBody: GS.frontBody, backYoke: GS.backYoke, backBody: GS.backBody }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "5: 렌더러 검증 통과 " + (err || ""));
  const ids = grp ? grp.kids.map(k => J(k.attrs || {})) : [];
  ok(new Set(ids).size === ids.length, "5: 중복 렌더 0");
  // 뒤 요크의 열린 다트 다리는 construction 으로 한 번만 그려진다(외곽·다트 이중 렌더 없음)
  const dartLines = (g) => g.kids.filter(k => k.attrs["data-piece"] === "backYoke" && k.attrs["data-geometry-role"] === "construction").length;
  const gNo = (() => { try { return DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontYoke: GS.frontYoke, frontBody: GS.frontBody, backYoke: Object.assign({}, GS.backYoke, { construction: [] }), backBody: GS.backBody }); } catch (e) { return null; } })();
  ok(!!gNo && dartLines(grp) === 2 && dartLines(gNo) === 0 && grp.kids.length === gNo.kids.length + 2, "5: 뒤 요크 열린 다트 다리 2줄이 construction 으로 정확히 한 번씩 렌더");
}

// ── 6. 패턴선 도구 잠금 문구: 현재 variant 기호를 정직하게 ──
{
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  const mMsg = src.match(/const yokeLockMsg = [^\n]*;/), mCir = src.match(/const yokeCircled = [^\n]*;/);
  ok(!!mMsg && !!mCir, "6: ui.js 에 yokeLockMsg/yokeCircled 존재");
  if (mMsg && mCir) {
    const f = new Function(mMsg[0] + mCir[0] + "return (body) => yokeLockMsg(yokeCircled(window.bodicePresets.yokeVariantSymbol(body)));");
    const msgOf = vm.runInContext("(" + f.toString() + ")()", Object.assign(sandbox, {}));
    ok(msgOf(S_BODY).includes("Ⓢ 적용 중") && !msgOf(S_BODY).includes("Ⓠ") && !msgOf(S_BODY).includes("Ⓡ"), "6: Ⓢ 문구는 Ⓢ 로 표시(Ⓠ·Ⓡ 잔존 없음)");
    ok(msgOf(Q_BODY).includes("Ⓠ 적용 중") && msgOf(R_BODY).includes("Ⓡ 적용 중"), "6: Ⓠ·Ⓡ 문구 불변");
  }
}

console.log("══════════════════════════════════════════════");
console.log(`yokeSeamSCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
