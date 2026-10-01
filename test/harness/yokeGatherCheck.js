// yokeGatherCheck.js — 요크 이음선 ① Ⓡ(P.31, «Ⓠ 방법 + 중심에 개더 분량을 추가») 회귀.
//   node test/harness/yokeGatherCheck.js
// 범위: 프리셋 Ⓡ · geometry(요크 Ⓠ 와 바이트 동일, 몸판만 중심 띠) · 분량 공식(뒤 10cm 고정 / 앞 = 앞중심→다트 끝 − 1cm) ·
//       이음 길이 차 · 체크포인트 독립 재계산·변조 거부 · 완료본 보존/hash · 표시(개더 라벨·배치 겹침 0) · A~Ⓠ 바이트 불변.
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
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, DL = W.designLayout, DR = W.designRenderer, BC = W.bodiceCheckpoint, T = W.designLineTool;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const Q_BODY = BP.bodyParams("bunka-bodice-Q"), R_BODY = BP.bodyParams("bunka-bodice-R");
const GQ = DB.computeGeometry(REF, { body: Q_BODY });
const GR = DB.computeGeometry(REF, { body: R_BODY });
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const segsOf = (outline) => T.outlinePrimsToSegs(outline);
const seamLen = (pc) => pc.outline.filter(s => s.edge === "yoke-seam").reduce((t, s) => t + D(s.from, s.to), 0);

// ── 1. 프리셋 Ⓡ ──
ok(BP.resolve("yoke-seam-1", "bunka-bodice-R").ok, "1: Ⓡ 해석 성공(실행 가능)");
ok(J(R_BODY) === J(Object.assign({}, Q_BODY, { yokeGather: true })), "1: Ⓡ = Ⓠ 파라미터 + yokeGather(가산 변형)");
ok(J(BP.bodyParams("bunka-bodice-Q")) === J({ hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeSeam: true }), "1: Ⓠ 파라미터 불변");
ok(BP.variant("yoke-seam-2", "bunka-bodice-T").availability === "pending-op", "1: Ⓣ 는 계속 보류(Ⓢ 는 별도 하네스)");
throwsReason(() => DB.computeGeometry(REF, { body: { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1, yokeGather: true } }), "yoke-gather-needs-yoke-seam", "1: 요크 없는 개더 거부");
throwsReason(() => DB.computeGeometry(REF, { body: Object.assign({}, R_BODY, { yokeGather: 2 }) }), "invalid-body-yoke-gather", "1: yokeGather 값 검증");
ok(J(DB.computeGeometry(REF, { body: Object.assign({}, Q_BODY, { yokeGather: false }) })) === J(GQ), "1: yokeGather:false = Ⓠ 와 동일");
ok(J(REF) === SNAP, "1: 입력 reference 불변");

// ── 2. A~Ⓠ 바이트 불변(구현 전 HEAD 1fbef50 에서 측정한 sha256 앞 16자) ──
const FIXED = { A: "f87b86b25abc508e", B: "3fade9d306cfc1b2", C: "d9ccd8ad27484d42", D: "dea05147006a3561", G: "d9a46f8358daec84",
  M: "66936c94c7ce847c", N: "6b02cf3e25969a7a", O: "d1fae91f00e58b37", P: "160d3aaee53eb5e4", Q: "76a325d296cd4fce" };
Object.keys(FIXED).forEach(k => ok(sha(DB.computeGeometry(REF, { body: BP.bodyParams("bunka-bodice-" + k) })) === FIXED[k], "2: " + k + " geometry 바이트 불변"));
ok(!("gather" in GQ.yokeSeam.front) && !("gather" in GQ.yokeSeam.back), "2: Ⓠ 메타에 gather 키 없음");

// ── 3. Ⓡ geometry ──
ok(J(GR.front) === J(GQ.front) && J(GR.back) === J(GQ.back), "3: 전체 앞/뒤판 불변");
ok(J(GR.frontYoke) === J(GQ.frontYoke) && J(GR.backYoke) === J(GQ.backYoke), "3: 요크 geometry 는 Ⓠ 와 바이트 동일");
ok(J(GR.frontYoke.outline.filter(s => s.edge === "yoke-seam")) === J(GQ.frontYoke.outline.filter(s => s.edge === "yoke-seam")), "3: 요크 이음선 Ⓠ 동일");
["front", "back"].forEach(side => {
  const Yq = GQ[side + "Yoke"], Bq = GQ[side + "Body"], Br = GR[side + "Body"], m = GR.yokeSeam[side], g = m.gather;
  ok(!!g, "3: " + side + " gather 메타");
  // 분량 공식(독립 계산)
  const cx = segsOf(GQ[side].outline).filter(s => s.edge === "center")[0].from.x;
  const apexX = m.seamPoints.apex.x;
  const want = side === "back" ? 10 : Math.abs(apexX - cx) - 1;
  ok(near(g.addedCm, want, 1e-9), `3: ${side} 개더 분량 ${g.addedCm} = ${want}`);
  if (side === "back") ok(g.addedCm === 10 && g.rule === "back-fixed-10", "3: 뒤 = 고정 10cm");
  else ok(near(g.addedCm, Math.abs(apexX - cx) - 1, 1e-12) && g.rule === "front-apex-distance-minus-1" && g.addedCm > 0, "3: 앞 = 앞중심→다트 끝 − 1cm");
  // 이음 길이 차
  ok(near(seamLen(Br) - seamLen(Yq), g.addedCm, 1e-9), `3: ${side} 몸판 이음 − 요크 이음 = 개더 분량`);
  ok(near(seamLen(Br) - seamLen(Bq), g.addedCm, 1e-9) && near(g.seamExcessCm, g.addedCm, 1e-9), "3: Ⓠ 몸판 대비 정확히 분량만큼 긺");
  ok(near(m.seamLenLowerCm, seamLen(Br), 1e-9) && near(m.seamDeltaCm, -g.addedCm, 1e-9), "3: 메타 이음 길이·delta 정직 기록");
  // 폐곡선·자기교차 0
  const segs = segsOf(Br.outline);
  const ring = (() => { const ss = segs.map(s => Object.assign({}, s)), used = ss.map(() => false), out = [ss[0]]; used[0] = true; let tip = ss[0].to;
    for (let k = 1; k < ss.length; k++) { let f = -1, rev = false; for (let j = 0; j < ss.length; j++) { if (used[j]) continue; if (D(ss[j].from, tip) < 1e-6) { f = j; break; } if (D(ss[j].to, tip) < 1e-6) { f = j; rev = true; break; } }
      if (f < 0) return null; used[f] = true; out.push(rev ? T.reverseSeg(ss[f]) : ss[f]); tip = out[out.length - 1].to; } return D(tip, out[0].from) < 1e-6 ? out : null; })();
  ok(!!ring, "3: " + side + " 몸판 폐곡선");
  // 중심 띠: center 변 이동, 옆선·밑단 길이 불변
  const cxNew = segsOf(Br.outline).filter(s => s.edge === "center")[0].from.x;
  ok(near(cxNew, g.newCenterX) && near(Math.abs(cxNew - cx), g.addedCm, 1e-9), "3: " + side + " 중심선이 중심 쪽으로 분량만큼 평행 이동");
  const sideSeg = (pc) => J(segsOf(pc.outline).filter(s => s.edge === "side-seam"));
  ok(sideSeg(Br) === sideSeg(Bq), "3: " + side + " 옆선 불변(밑단 옆 +1 유지)");
  const cnt = (pc, e) => pc.outline.filter(s => s.edge === e).length;
  ok(cnt(Br, "center") === cnt(Bq, "center") && cnt(Br, "hem") === 1 && cnt(Br, "yoke-seam") === 2, "3: 변 구성 동일");
  // 개더 경계선(원래 중심) 표시선
  const bd = Br.construction.filter(s => s.gatherBoundary);
  ok(bd.length === 1 && near(bd[0].from.x, cx) && near(bd[0].to.x, cx) && near(bd[0].gatherCm, g.addedCm), "3: " + side + " 개더 경계(원래 중심) 1줄·분량 표기");
  const wl = Br.construction.filter(s => s.edge === "waist")[0];
  ok(near(wl.from.x, cxNew) || near(wl.to.x, cxNew), "3: 허리선이 띠 끝까지 연장");
  // 면적
  const botY = Math.max(...segsOf(Br.outline).filter(s => s.edge === "center").flatMap(s => [s.from.y, s.to.y]));
  ok(near(g.areaAddedCm2, g.addedCm * (botY - m.seamY), 1e-6), "3: 면적 증가 = 분량 × 이음선~밑단 높이");
});
// 조각 겹침 0: 몸판 bbox 와 요크 bbox 는 표시에서 분리(레이아웃 검증은 5)
ok(sha(GR.frontYoke) === sha(GQ.frontYoke), "3: 앞 요크 hash 동일");
ok(J(REF) === SNAP, "3: reference 불변(재확인)");

// ── 4. 체크포인트 ──
const mk = (geometry, body) => ({ sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
  working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } });
const chk = (p) => { PROJECT = p; return BC.check(p); };
const yokeReason = (p) => { const c = chk(p); return c.ok ? null : c.fails.filter(f => /^yoke-/.test(f))[0] || c.fails[0]; };
{
  const c = chk(mk(clone(GR), R_BODY));
  ok(c.ok, "4: Ⓡ 검사 통과: " + c.fails.join());
  ["front", "back"].forEach(k => {
    const r = c.yokeSeam[k];
    ok(r.closed.yoke && r.closed.body && r.selfIntersects === false, "4: " + k + " 폐곡선·자기교차 0(재계산)");
    ok(near(r.gatherCm, GR.yokeSeam[k].gather.addedCm, 1e-3) && near(r.gatherDeltaCm, r.gatherCm, 1e-3), "4: " + k + " 개더 분량·이음 길이 차 독립 재계산 " + r.gatherCm);
    ok(Math.abs(r.areaDeltaCm2 - r.gatherAreaCm2) < 0.05, "4: " + k + " 면적 = 전체 + 띠");
  });
  const cq = chk(mk(clone(GQ), Q_BODY));
  ok(cq.ok && !("gatherCm" in cq.yokeSeam.front) && cq.yokeSeam.front.reason === null, "4: Ⓠ 경로 출력에 개더 키 없음·통과");
  // 변조 거부
  const tamper = (fn) => { const g = clone(GR); fn(g); return yokeReason(mk(g, R_BODY)); };
  const shiftCenter = (pc, dx) => { pc.outline.forEach(s => { if (s.kind === "line") ["from", "to"].forEach(k => { if (Math.abs(s[k].x - GR.yokeSeam.back.gather.newCenterX) < 1e-6 && pc === pc) s[k].x += dx; }); }); };
  ok(tamper(g => { g.yokeSeam.back.gather.addedCm = 9; }) === "yoke-gather-mismatch", "4: 메타 분량 위조 거부");
  ok(tamper(g => { delete g.yokeSeam.back.gather; }) === "yoke-seam-length-mismatch", "4: gather 메타 삭제(길이 차 남음) 거부");
  ok(tamper(g => { shiftCenter(g.backBody, -0.5); }) === "yoke-gather-mismatch", "4: 몸판 중심 띠 폭 변조 거부");
  ok(tamper(g => { g.yokeSeam.front.gather.addedCm += 1; }) === "yoke-gather-mismatch", "4: 앞 메타 위조 거부");
  // 완료본·hash
  const pr = mk(clone(GR), R_BODY); PROJECT = pr;
  const done = BC.complete(pr);
  ok(done.ok && pr.working.bodiceResult.yokeSeam.front.gather && Object.isFrozen(pr.working.bodiceResult), "4: 완료본에 gather 메타 보존·동결");
  ok(J(pr.working.bodiceResult.frontBody.outline) === J(GR.frontBody.outline), "4: 완료본 몸판 = 현재 geometry");
  const hR = BC.latest(pr).hash;
  const pq = mk(clone(GQ), Q_BODY); PROJECT = pq; BC.complete(pq); const hQ = BC.latest(pq).hash;
  ok(hR !== hQ, "4: Ⓡ hash ≠ Ⓠ hash(몸판이 달라 정직 반영)");
  const pr2 = mk(clone(GR), R_BODY); PROJECT = pr2; BC.complete(pr2);
  ok(BC.latest(pr2).hash === hR, "4: hash 결정론");
  const pq2 = mk(clone(GQ), Q_BODY); PROJECT = pq2; BC.complete(pq2);
  ok(BC.latest(pq2).hash === hQ, "4: Ⓠ 완료·hash 불변");
}

// ── 5. 표시·배치 ──
{
  const m = DL.yokeLabels(GR);
  ok(m && m.gathers && m.gathers.length === 2, "5: 개더 라벨 2개(앞·뒤)");
  ok(m.gathers.every(l => /^개더 \+\d+(\.\d)?cm$/.test(l.text)) && m.gathers.find(l => l.piece === "back").text === "개더 +10cm", "5: 라벨 = 분량 문자열");
  ok(!DL.yokeLabels(GQ).gathers && m.labels.length === 4 && m.seams.length === 2, "5: Ⓠ 라벨엔 gathers 없음·조각명/이음선 유지");
  const ptsOf = (p, out) => { if (p.kind === "line") out.push(p.from, p.to); else if (p.kind === "cubic") out.push(p.from, p.c1, p.c2, p.to); else p.commands.forEach(c => c.points.forEach(q => out.push(q))); };
  const bb = (pc) => { const pts = []; pc.outline.forEach(p => ptsOf(p, pts)); return { minX: Math.min(...pts.map(q => q.x)), maxX: Math.max(...pts.map(q => q.x)), minY: Math.min(...pts.map(q => q.y)), maxY: Math.max(...pts.map(q => q.y)) }; };
  const overlap = (a, b) => a.minX < b.maxX - 1e-9 && b.minX < a.maxX - 1e-9 && a.minY < b.maxY - 1e-9 && b.minY < a.maxY - 1e-9;
  const disp = { frontYoke: GR.frontYoke, backYoke: GR.backYoke, frontBody: DL.peplumDisplayPiece(GR, "frontBody"), backBody: DL.peplumDisplayPiece(GR, "backBody") };
  ok(!overlap(bb(disp.frontYoke), bb(disp.frontBody)) && !overlap(bb(disp.backYoke), bb(disp.backBody)), "5: 요크·몸판 표시 bbox 겹침 0(앞·뒤)");
  const gm = m.gathers.find(l => l.piece === "back");
  const bbB = bb(disp.backBody);
  ok(gm.at.y === bbB.minY && gm.at.x > bbB.minX && gm.at.x < bbB.minX + 10 + 1e-9, "5: 뒤 라벨이 띠 구간 위(몸판 윗변)");
  // 자동 배치: 네 조각 겹침 0
  const keys = ["frontYoke", "frontBody", "backYoke", "backBody"];
  let layout; try { layout = DL.autoLayout(GR); } catch (e) { layout = null; }
  ok(!!layout, "5: autoLayout 성공");
  if (layout) {
    const off = (pc) => layout[pc] || { dx: 0, dy: 0 };
    const place = (b, pc) => ({ minX: b.minX + off(pc).dx, maxX: b.maxX + off(pc).dx, minY: b.minY + off(pc).dy, maxY: b.maxY + off(pc).dy });
    const fb = place(union2(bb(disp.frontYoke), bb(disp.frontBody)), "front"), bk = place(union2(bb(disp.backYoke), bb(disp.backBody)), "back");
    ok(!overlap(fb, bk), "5: 자동 배치 앞·뒤 묶음 bbox 겹침 0");
  }
  function union2(a, b) { return { minX: Math.min(a.minX, b.minX), maxX: Math.max(a.maxX, b.maxX), minY: Math.min(a.minY, b.minY), maxY: Math.max(a.maxY, b.maxY) }; }
  // 렌더러 검증: 네 조각 모두 통과·중복 렌더 0(그룹 안 조각 그룹 수 = 요소 키 유일)
  const EMPTY = { outline: [], construction: [] };
  let grp = null, err = null;
  try { grp = DR.createWorkingGroup({ front: EMPTY, back: EMPTY, shared: EMPTY, sleeve: EMPTY, frontYoke: GR.frontYoke, frontBody: GR.frontBody, backYoke: GR.backYoke, backBody: GR.backBody }); } catch (e) { err = e.reason || e.message; }
  ok(!err && grp && grp.kids.length > 0, "5: 렌더러 검증 통과 " + (err || ""));
  const ids = grp ? grp.kids.map(k => J(k.attrs || {})) : [];
  ok(new Set(ids).size === ids.length, "5: 중복 렌더 0");
}

// ── 6. 패턴선 도구 잠금 문구: 현재 variant 로 분기(Ⓠ 문구는 기존과 바이트 동일) ──
{
  ok(BP.yokeVariantSymbol(Q_BODY) === "Q" && BP.yokeVariantSymbol(R_BODY) === "R", "6: body → 변형 기호(Q/R)");
  ok(BP.yokeVariantSymbol(BP.bodyParams("bunka-bodice-A")) === null && BP.yokeVariantSymbol(null) === null, "6: 요크 아니면 null");
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "ui.js"), "utf8");
  const mMsg = src.match(/const yokeLockMsg = [^\n]*;/), mCir = src.match(/const yokeCircled = [^\n]*;/);
  ok(!!mMsg && !!mCir, "6: ui.js 에 yokeLockMsg/yokeCircled 존재");
  if (mMsg && mCir) {
    const f = new Function(mMsg[0] + mCir[0] + "return (body) => yokeLockMsg(yokeCircled(window.bodicePresets.yokeVariantSymbol(body)));");
    const msgOf = vm.runInContext("(" + f.toString() + ")()", Object.assign(sandbox, {})) ;
    const OLD_Q = "요크 이음선 Ⓠ 적용 중에는 패턴선 도구를 쓸 수 없습니다(화면이 요크·몸판 조각이라 전체 몸판 좌표와 다릅니다) — 다른 몸판 라인을 적용하면 다시 켜집니다";
    ok(msgOf(Q_BODY) === OLD_Q, "6: Ⓠ 문구 기존과 바이트 동일");
    ok(msgOf(R_BODY) === OLD_Q.replace("Ⓠ", "Ⓡ") && msgOf(R_BODY).includes("Ⓡ 적용 중") && !msgOf(R_BODY).includes("Ⓠ"), "6: Ⓡ 문구는 Ⓡ 로 표시(Ⓠ 잔존 없음)");
  }
}

console.log("══════════════════════════════════════════════");
console.log(`yokeGatherCheck: ${PASS} PASS / ${FAIL} FAIL`);
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
console.log("전부 통과 ✓");
