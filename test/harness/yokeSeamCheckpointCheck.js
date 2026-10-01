// yokeSeamCheckpointCheck.js — 요크 이음선 Ⓠ 체크포인트/결과(bodiceCheckpoint) 연결 회귀 (커밋 2).
//   node test/harness/yokeSeamCheckpointCheck.js
// 범위: bodiceCheckpoint.check/complete/signature 만. 소매·카라·designResult 프로덕션 경로는 무변경이고,
//       요크 완료본으로 끝까지 통과하는지·armholeLengths/necklineLengths 가 전체 몸판과 같은지만 회귀한다.
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
const J = JSON.stringify;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const clone = (v) => JSON.parse(JSON.stringify(v));

let PROJECT = null;
const sandbox = {
  window: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone, Error, Date,
  c2p: (x, y) => [x * 10, y * 10],
  document: { createElementNS: () => ({ setAttribute() {}, appendChild() {} }) }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
sandbox.window.designWorkflow = { current: () => PROJECT };
// designSleeve 는 프로덕션 모듈이 UI 결합이라 cap 측정만 스텁(sleeveCheckpointCheck 와 같은 방식). 나머지는 실제 모듈.
let PRIM = null;
sandbox.window.designSleeve = { capPrimitives: () => PRIM, sleeveOutlineSelfIntersects: () => false };
["designLineTool.js", "designFlare.js", "designJoin.js", "designWaistSeam.js", "designYokeSeam.js", "designBodice.js", "bodicePresets.js",
  "bodiceCheckpoint.js", "sleeveCheckpoint.js", "designCollar.js", "collarCheckpoint.js", "designResult.js"].forEach(load);
const W = sandbox.window, DB = W.designBodice, BP = W.bodicePresets, BC = W.bodiceCheckpoint, SC = W.sleeveCheckpoint, DC = W.designCollar, CC = W.collarCheckpoint, DR = W.designResult;
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "blockReferenceGeometry.json"), "utf8"));
const SNAP = J(REF);

const YB = { hemExtensionBelowWaistCm: 20, hemSideOffsetCm: 1 };
const Q_BODY = Object.assign({ yokeSeam: true }, YB);
const mk = (body, mut) => {
  const geometry = DB.computeGeometry(REF, { body });
  if (mut) mut(geometry);
  return { sourceBlock: { id: "block-1", version: 2, schemaVersion: 8, canonicalHash: "CH" }, referenceGeometry: REF,
    working: { geometry, parameters: { neckline: { mode: "parametric", type: "original", parameters: {} }, body }, patternLines: [], designOutline: null, frontPlacket: null } };
};
const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const chk = (proj) => { PROJECT = proj; return BC.check(proj); };
const reasonOf = (proj) => { const c = chk(proj); return c.ok ? null : c.fails.filter(f => /^yoke-seam-/.test(f))[0] || c.fails[0]; };

// ── 1. 정상 요크: 검사·완료 ──
{
  const p = mk(Q_BODY);
  const c = chk(p);
  ok(c.ok, "1: 요크 몸판 검사 통과: " + c.fails.join());
  ok(c.yokeSeam && c.yokeSeam.ok && c.yokeSeam.reason === null, "1: yokeSeam 상태 ok");
  ["front", "back"].forEach(k => {
    const r = c.yokeSeam[k];
    ok(r.closed.yoke && r.closed.body && r.selfIntersects === false, "1: " + k + " 폐곡선·자기교차 0(재계산)");
    ok(Math.abs(r.deltaCm) < 1e-6 && r.seamLenYokeCm > 10, "1: " + k + " 이음 길이 정합 " + r.seamLenYokeCm);
    ok(Math.abs(r.areaDeltaCm2) < 0.05 && r.areaWholeCm2 > 100, "1: " + k + " 면적 정합 Δ=" + r.areaDeltaCm2);
    ok(J(r.absorbedDartIds) === J([k === "front" ? "front-bust" : "back-shoulder"]), "1: " + k + " 흡수 다트 id 표시");
  });
  ok(c.sideSeam.status === "match" && c.armhole.ok && c.neckline.ok, "1: 전체 몸판 기존 검사(옆선·진동·목선) 그대로 통과");
  const done = BC.complete(p);
  ok(done.ok, "1: 요크 몸판 완료");
  const res = BC.latest(p);
  ["frontYoke", "frontBody", "backYoke", "backBody"].forEach(k => {
    ok(Object.isFrozen(res[k]) && Object.isFrozen(res[k].outline) && J(res[k].outline) === J(p.working.geometry[k].outline) && res[k] !== p.working.geometry[k], "1: result." + k + " 동결 복제");
  });
  ok(Object.isFrozen(res.yokeSeam) && J(res.yokeSeam) === J(p.working.geometry.yokeSeam) && res.yokeSeam !== p.working.geometry.yokeSeam, "1: result.yokeSeam 메타 동결 복제");
  ok(res.front.outline.length === p.working.geometry.front.outline.length, "1: result.front/back = 전체 몸판 그대로");
  ok(!BC.isCurrentBodiceChanged(p), "1: 같은 상태는 스테일 아님");
  // 완료 뒤 조각 변경 → 스테일
  const p2 = mk(Q_BODY); PROJECT = p2; BC.complete(p2);
  p2.working.geometry.backYoke.outline.find(s => s.kind === "line" && s.edge === "shoulder").to.x += 0.5;
  ok(BC.isCurrentBodiceChanged(p2) === true, "1: 완료 뒤 요크가 바뀌면 스테일");
  ok(J(REF) === SNAP, "1: 원형 참조 불변");
}

// ── 2. 비요크: 기존 출력·hash 바이트 동일, 새 키 없음 ──
{
  const bodies = [];
  BP.families().forEach(f => f.variants.forEach(v => { if (v.availability === "available" && BP.bodyParams(v.id).yokeSeam == null) bodies.push([v.id, BP.bodyParams(v.id)]); }));   // 요크(Ⓠ·Ⓡ·Ⓢ)는 §1·§4
  bodies.forEach(([id, body]) => {
    const p = mk(body); const c = chk(p);
    ok(!("yokeSeam" in c), "2: " + id + " check 에 yokeSeam 키 없음");
    BC.complete(p); const r = BC.latest(p);
    ok(r && !("frontYoke" in r) && !("yokeSeam" in r), "2: " + id + " bodiceResult 에 요크 키 없음");
    // yokeSeam:false 는 플래그 없음과 hash·result 필드 동일(요크 슬롯이 없으므로 signature 에 yk 가 안 든다)
    const p2 = mk(Object.assign({}, body, { yokeSeam: false })); PROJECT = p2; BC.complete(p2);
    ok(BC.latest(p2).hash === r.hash, "2: " + id + " hash 불변(yokeSeam:false)");
  });
  // 요크 hash 는 A 와 다르다, 그러나 front/back 이 같은 두 몸판이라도 요크 슬롯이 있으면 다르다
  const pq = mk(Q_BODY), pb = mk(YB); PROJECT = pq; BC.complete(pq); PROJECT = pb; BC.complete(pb);
  ok(BC.latest(pq).hash !== BC.latest(pb).hash, "2: 요크 슬롯이 hash 에 반영(같은 front/back 이어도 Ⓑ 와 다르다)");
  const pq2 = mk(Q_BODY); PROJECT = pq2; BC.complete(pq2);
  ok(BC.latest(pq2).hash === BC.latest(pq).hash, "2: 요크 hash 결정론");
}

// ── 3. 변조 → 구체적 yoke-seam-* 로 완료 차단 ──
// outline 프리미티브는 line(from/to) 또는 path(commands[].points)다 — 좌표가 같은 모든 점을 함께 옮겨 체인 연결을 유지한다.
const refsOf = (prim) => prim.kind === "path" ? prim.commands.flatMap(c => c.points) : [prim.from, prim.to].concat(prim.c1 ? [prim.c1, prim.c2] : []);
function shift(outline, target, dx, dy) {
  const t = clone(target);
  outline.forEach(pr => refsOf(pr).forEach(q => { if (D(q, t) < 1e-9) { q.x += dx; q.y += dy; } }));
}
{
  const blocked = (proj, want, name) => {
    const c = chk(proj);
    ok(!c.ok && c.fails.indexOf(want) >= 0 && BC.complete(proj).ok === false && !BC.latest(proj), "3: " + name + " → " + want + " [" + c.fails.join() + "]");
  };
  const hemOf = (piece) => piece.outline.find(s => s.kind === "line" && s.edge === "hem");
  // 조각 자체 누락/열림
  blocked(mk(Q_BODY, g => { delete g.backBody; }), "yoke-seam-missing", "뒤 몸판 슬롯 삭제");
  blocked(mk(Q_BODY, g => { delete g.yokeSeam; }), "yoke-seam-missing", "메타 삭제");
  blocked(mk(Q_BODY, g => { g.frontYoke.outline.pop(); }), "yoke-seam-open", "앞 요크 세그먼트 삭제(열림)");
  blocked(mk(Q_BODY, g => { hemOf(g.backBody).to.y += 1; }), "yoke-seam-open", "뒤 몸판 밑단 끝점 1cm 이동(연속성 끊김)");
  blocked(mk(Q_BODY, g => { hemOf(g.frontBody).from.x += 0.01; }), "yoke-seam-open", "앞 몸판 밑단 0.01cm 이동(연속성)");
  // 자기교차: 몸판 옆-밑단 모서리를 중심선 너머로 끌어 옆선이 중심선을 가로지르게 한다(체인은 연결 유지)
  {
    const p = mk(Q_BODY, g => { const c = hemOf(g.backBody).to; shift(g.backBody.outline, c, -c.x - 5, -28); });
    const c = chk(p);
    ok(!c.ok && c.yokeSeam.back.reason === "yoke-seam-self-intersection" && c.fails.indexOf("yoke-seam-self-intersection") >= 0 && BC.complete(p).ok === false, "3: 뒤 몸판 모서리를 중심선 너머로 → yoke-seam-self-intersection [" + c.fails.join() + "]");
  }
  {
    const p = mk(Q_BODY, g => { const a = g.yokeSeam.front.seamPoints.apex; shift(g.frontYoke.outline, a, -8, -28); });
    const c = chk(p);
    ok(!c.ok && c.fails.indexOf("yoke-seam-self-intersection") >= 0, "3: 앞 요크 apex 를 어깨 너머로 → yoke-seam-self-intersection [" + c.fails.join() + "]");
  }
  // 흡수 다트가 조각에 남아 있음
  blocked(mk(Q_BODY, g => { g.backYoke.construction.push({ kind: "line", from: { x: 1, y: 1 }, to: { x: 2, y: 2 }, dart: { id: "back-shoulder", apexAt: "to" } }); }), "yoke-seam-dart-open", "흡수한 뒤 어깨 다트 잔존");
  blocked(mk(Q_BODY, g => { g.frontBody.construction.push({ kind: "line", from: { x: 1, y: 30 }, to: { x: 2, y: 31 }, dart: { id: "front-bust", apexAt: "to" } }); }), "yoke-seam-dart-open", "흡수한 앞 AH 다트 잔존");
  // 이음선 수평 위반: 몸판 이음선 apex 를 아래로 0.8cm
  blocked(mk(Q_BODY, g => { shift(g.frontBody.outline, g.yokeSeam.front.seamPoints.apex, 0, 0.8); }), "yoke-seam-not-horizontal", "몸판 이음선 apex 이동");
  // 이음 길이 불일치: 요크 이음선의 옆 끝(회전 끝점)을 옆으로 0.6cm — 링은 유지, 길이만 변경
  {
    const p = mk(Q_BODY, g => { shift(g.backYoke.outline, g.yokeSeam.back.seamPoints.sideAfterClose, 0.6, 0); });
    const c = chk(p);
    ok(!c.ok && c.fails.indexOf("yoke-seam-length-mismatch") >= 0 && c.yokeSeam.back.deltaCm > 0.05, "3: 요크 이음선 옆 끝 이동 → yoke-seam-length-mismatch Δ=" + (c.yokeSeam.back.deltaCm && c.yokeSeam.back.deltaCm.toFixed(3)) + " [" + c.fails.join() + "]");
  }
  // 면적: 앞 몸판 밑단-옆선 모서리를 3cm 밖으로 — 링·이음선은 정상, 면적만 어긋남
  blocked(mk(Q_BODY, g => { shift(g.frontBody.outline, hemOf(g.frontBody).to, 3, 0); }), "yoke-seam-area-mismatch", "앞 몸판 모서리 3cm 이동(면적만)");
  // 전체 몸판이 바뀌면 요크+몸판과 면적 대조가 어긋난다
  {
    const p = mk(Q_BODY, g => { shift(g.front.outline, hemOf(g.front).from, -2, 0); });
    const c = chk(p);
    ok(!c.ok && c.fails.indexOf("yoke-seam-area-mismatch") >= 0, "3: 전체 앞 몸판 변경 → 요크 면적 대조가 어긋나 차단 [" + c.fails.join() + "]");
  }
  // 메타 미신뢰: 엉터리 메타 수치는 판정을 바꾸지 못한다(정상 조각이면 통과, 고장난 조각이면 메타를 맞춰도 차단)
  {
    const p = mk(Q_BODY, g => { g.yokeSeam.back.seamDeltaCm = 0; g.yokeSeam.back.areaInputCm2 = 1; g.yokeSeam.front.areaYokeCm2 = 1; g.yokeSeam.front.seamLenUpperCm = 999; });
    ok(chk(p).ok, "3: 정상 조각 + 엉터리 메타 수치 → 통과(메타 미신뢰)");
    const p2 = mk(Q_BODY, g => { shift(g.backYoke.outline, g.yokeSeam.back.seamPoints.sideAfterClose, 0.6, 0); g.yokeSeam.back.seamLenUpperCm = g.yokeSeam.back.seamLenLowerCm; g.yokeSeam.back.seamDeltaCm = 0; });
    ok(!chk(p2).ok, "3: 조각을 망가뜨리고 메타를 정상값으로 맞춰도 차단");
  }
}

// ── 4. 하류 소비자: 요크 완료본으로 소매·카라·designResult 끝까지 통과, 수치 = 전체 몸판 ──
{
  const pq = mk(Q_BODY), pb = mk(YB);
  PROJECT = pq; const dq = BC.complete(pq); PROJECT = pb; const db = BC.complete(pb);
  ok(dq.ok && db.ok, "4: 두 완료");
  const rq = BC.latest(pq), rb = BC.latest(pb);
  ok(J(rq.armholeLengths) === J(rb.armholeLengths), "4: armholeLengths 요크 = 전체 몸판 " + J(rq.armholeLengths));
  ok(J(rq.necklineLengths) === J(rb.necklineLengths), "4: necklineLengths 요크 = 전체 몸판 " + J(rq.necklineLengths));
  ok(J(rq.armhole) === J(rb.armhole) && J(rq.front) === J(rb.front) && J(rq.back) === J(rb.back), "4: armhole 프리미티브·front·back 동일");
  // 소매: 실제 sleeveCheckpoint(스텁은 cap 측정뿐)
  const sleeveProj = (proj, hash) => {
    PRIM = { frontPrimitives: [{ kind: "cubic", from: { x: 1, y: 1 }, c1: { x: 2, y: 0 }, c2: { x: 3, y: 0 }, to: { x: 4, y: 1 } }], backPrimitives: [{ kind: "cubic", from: { x: 0, y: 1 }, c1: { x: -1, y: 0 }, c2: { x: -2, y: 0 }, to: { x: -3, y: 1 } }],
      splitPoint: { x: 0, y: 0 }, lengths: { front: 22, back: 24, total: 46 } };
    const geom = { outline: [{ kind: "line", from: { x: 0, y: 0 }, to: { x: 24, y: 0 } }], construction: [] };
    proj.working.geometry.sleeve = proj.working.geometry.sleeve || geom;
    proj.working.sleeveDraft = { sourceBodiceHash: hash, mode: "parametric", capLineId: null, capInvalid: false, capInvalidReason: null,
      parameters: { lower: { sleeveLengthCm: 52, cuffCircumferenceCm: 30, sideShape: "straight" }, cap: null }, geometry: geom, capLengths: null };
  };
  sleeveProj(pq, rq.hash); sleeveProj(pb, rb.hash);
  PROJECT = pq; const sq = SC.check(pq); PROJECT = pb; const sb = SC.check(pb);
  ok(sq.ok && sb.ok, "4: 소매 게이트 통과(요크·전체): " + sq.fails.join() + "|" + sb.fails.join());
  ok(J(sq.ease) === J(sb.ease) && near(sq.ease.front, 22 - rq.armholeLengths.front, 1e-9), "4: 소매 이세 요크 = 전체 몸판 " + J(sq.ease));
  PROJECT = pq; const scq = SC.complete(pq); ok(scq.ok, "4: 소매 완료(요크)");
  PROJECT = pb; SC.complete(pb);
  // 카라: 실제 designCollar 로 stand·body 를 만들어 collarCheckpoint 완료
  const STAND_P = { bandWidthCm: 3, frontRiseCm: 1.5, frontEndCm: 0.5 }, BODY_P = { gapCm: 3, cbWidthCm: 4, frontProjectionCm: 1.5, pointDiagonalCm: 6, outerBowCm: 0 };
  const standQ = DC.computeStand(rq, STAND_P), standB = DC.computeStand(rb, STAND_P);
  ok(J(standQ) === J(standB), "4: 카라 stand 산출 요크 = 전체 몸판(바이트 동일)");
  const bodyQ = DC.computeBody(standQ, BODY_P), bodyB = DC.computeBody(standB, BODY_P);
  ok(J(bodyQ) === J(bodyB), "4: 카라 body 산출 동일");
  ok(J(DC.frontNecklineFromBodice(rq)) === J(DC.frontNecklineFromBodice(rb)), "4: 카라가 읽는 앞 목선 체인 동일");
  const collarProj = (proj, hash, stand, body) => {
    proj.working.collarDraft = { sourceBodiceHash: hash, type: "shirt-two-piece", parameters: { stand: Object.assign({}, STAND_P) }, standGeometry: stand.standGeometry,
      body: { parameters: Object.assign({}, BODY_P), geometry: body.bodyGeometry, attachLenCm: body.attachLenCm, measure: body.measure } };
    proj.working.collarResult = null;
  };
  collarProj(pq, rq.hash, standQ, bodyQ); collarProj(pb, rb.hash, standB, bodyB);
  PROJECT = pq; const cq = CC.check(pq); PROJECT = pb; const cb = CC.check(pb);
  ok(cq.ok && cb.ok, "4: 카라 게이트 통과(요크·전체): " + cq.fails.join() + "|" + cb.fails.join());
  PROJECT = pq; const ccq = CC.complete(pq); ok(ccq.ok, "4: 카라 완료(요크)");
  // designResult: 실제 모듈 — 요크 완료본을 통째로 담아 완료
  PROJECT = pq; const drq = DR.check(pq);
  ok(drq.ok, "4: designResult 게이트 통과(요크): " + (drq.fails || []).join());
  const fin = DR.complete(pq);
  ok(fin.ok && fin.result.bodice === BC.latest(pq) && fin.result.bodice.frontYoke && fin.result.bodice.yokeSeam, "4: designResult 완료 — bodice 에 네 조각·메타가 그대로 실린다");
  ok(DR.isCurrentDesignChanged(pq) === false, "4: designResult 스테일 아님");
  // 요크 조각이 완료 뒤 바뀌면 몸판 스테일 → designResult 도 변경으로 잡는다
  pq.working.geometry.frontYoke.outline.find(s => s.kind === "line" && s.edge === "shoulder").to.y += 0.3;
  ok(BC.isCurrentBodiceChanged(pq) === true && DR.isCurrentDesignChanged(pq) === true, "4: 요크 변경 → 몸판·designResult 스테일");
}

console.log("yokeSeamCheckpointCheck: " + PASS + " PASS / " + FAIL + " FAIL");
if (FAIL) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
