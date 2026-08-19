// ══════════════════════════════════════════════
// bodiceCheckpointCheck.js — js/bodiceCheckpoint.js 검사·스냅샷·스테일 판정 회귀.
// 실제 모듈을 vm 으로 실행하고, designWorkflow/designLineTool 은 스텁으로 최소 제공한다
// (진동/옆선/목둘레 측정과 완료 게이트·불변 스냅샷·스테일 비교가 대상).
//   node test/harness/bodiceCheckpointCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "bodiceCheckpoint.js"), "utf8");
let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const near = (a, b, e = 1e-3) => Math.abs(a - b) < e;

// 스텁 상태
let RING_OK = true;
const sandbox = { window: {}, Math, JSON, Object, Array, isFinite, Date };
sandbox.window.designLineTool = { buildPieceRing: () => ({ ok: RING_OK }) };
let PROJECT = null;
sandbox.window.designWorkflow = { current: () => PROJECT };
vm.createContext(sandbox);
vm.runInContext(SRC, sandbox, { filename: "bodiceCheckpoint.js" });
const BC = sandbox.window.bodiceCheckpoint;

const cpath = (a, b, c, d) => ({ kind: "path", commands: [{ type: "M", points: [{ x: a[0], y: a[1] }] }, { type: "C", points: [{ x: b[0], y: b[1] }, { x: c[0], y: c[1] }, { x: d[0], y: d[1] }] }] });
const line = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
// piece: center(top y=3/0) + side-seam(길이 지정) + neckline(목점 접 곡선) + shoulder(직선) + armhole(곡선, 목점 미접)
function piece(cx, topY, sideTopY, sideBotY) {
  return {
    outline: [
      line([cx, topY], [cx, sideBotY], "center"),
      line([cx - 24, sideTopY], [cx - 24, sideBotY], "side-seam"),
      cpath([cx, topY], [cx - 3, topY - 2], [cx - 6, topY - 6], [cx - 7, topY - 7]),      // neckline(목점 접)
      line([cx - 7, topY - 7], [cx - 18, topY - 3]),                                       // shoulder(직선)
      cpath([cx - 18, topY - 3], [cx - 22, sideTopY - 8], [cx - 24, sideTopY - 3], [cx - 24, sideTopY]) // armhole(곡선, 목점 미접)
    ],
    construction: [line([cx - 4, 20], [cx - 2, sideBotY])]
  };
}
function fakeProject(backSideTopY, opts) {
  opts = opts || {};
  return {
    sourceBlock: { version: 2 },
    working: {
      geometry: { front: piece(47.5, 3, 20, 38), back: piece(0 + 24, 0, backSideTopY, 38), shared: { construction: [] }, sleeve: { outline: [], construction: [] } },
      parameters: { neckline: opts.neckline || { mode: "parametric", type: "round", parameters: {} } },
      designOutline: opts.designOutline || null,
      frontPlacket: opts.frontPlacket || null,
      patternLines: opts.patternLines || []
    }
  };
}

// 1. 정합(옆선 차 ≤0.1) → 완료 가능, 진동·목둘레 측정
{
  RING_OK = true; PROJECT = fakeProject(20);   // 앞 side 18(20→38) · 뒤 side 18 → diff 0
  const c = BC.check();
  ok(c.ok && c.sideSeam.status === "match" && near(c.sideSeam.diff, 0), "1: 옆선 정합(diff 0)");
  ok(c.armhole.ok && c.armhole.front > 0 && c.armhole.back > 0, "1: 진동둘레 앞·뒤 측정");
  ok(c.neckline.ok && c.neckline.half > 0 && near(c.neckline.finished, 2 * c.neckline.half), "1: 목둘레 반패턴·완성(×2)");
}
// 2. 확인(0.1<diff≤0.3) → 완료 가능
{
  PROJECT = fakeProject(20.2);   // 뒤 side 17.8 → diff 0.2
  const c = BC.check();
  ok(c.sideSeam.status === "check" && c.ok, "2: 옆선 확인(0.2) → 완료 가능");
}
// 3. 불일치(diff>0.3) → 완료 차단
{
  PROJECT = fakeProject(20.5);   // 뒤 side 17.5 → diff 0.5
  const c = BC.check();
  ok(c.sideSeam.status === "mismatch" && !c.ok && c.fails.indexOf("side-seam-mismatch") >= 0, "3: 옆선 불일치(0.5) → 차단");
  const r = BC.complete();
  ok(!r.ok && r.reason === "side-seam-mismatch" && !PROJECT.working.bodiceResult, "3: complete 거부 · bodiceResult 없음");
}
// 4. 외곽 미연결 → 차단
{
  RING_OK = false; PROJECT = fakeProject(20);
  const c = BC.check();
  ok(!c.ok && c.fails.indexOf("front-outline-not-connected") >= 0, "4: 외곽 미연결 → 차단");
  RING_OK = true;
}
// 5. manual 인데 designOutline 없음 → preview 무효 차단
{
  PROJECT = fakeProject(20, { neckline: { mode: "manual", type: "v", parameters: {}, boundaryLineIds: { front: "l1", back: "l2" } }, designOutline: null });
  const c = BC.check();
  ok(!c.ok && c.fails.indexOf("neckline-preview-invalid") >= 0, "5: manual+designOutline null → 차단");
}
// 6. 완료 → 불변 스냅샷(spec 필드) + reference 무관
{
  RING_OK = true; PROJECT = fakeProject(20);
  const r = BC.complete();
  ok(r.ok, "6: 완료 성공");
  const res = PROJECT.working.bodiceResult;
  ok(res && res.sourceVersion === 2 && res.front && res.back && res.armholeLengths && res.necklineLengths && typeof res.completedAt === "number", "6: bodiceResult spec 필드");
  ok(Object.isFrozen(res) && Object.isFrozen(res.front) && Object.isFrozen(res.armholeLengths), "6: deepFrozen");
  ok(res.placket === null, "6: placket 없으면 null");
  ok(BC.latest() === res, "6: latest = bodiceResult");
}
// 7. 스테일: 완료 직후 unchanged, 몸판 변경 시 changed
{
  PROJECT = fakeProject(20);
  BC.complete();
  ok(BC.isCurrentBodiceChanged() === false, "7: 완료 직후 unchanged");
  // 옆선 이동(외곽 변경) → changed
  PROJECT.working.geometry.front.outline[1].to.y = 40;
  ok(BC.isCurrentBodiceChanged() === true, "7: 외곽 변경 → changed");
}
// 8. 완료본 없으면 isCurrentBodiceChanged=true
{
  PROJECT = fakeProject(20);
  ok(BC.isCurrentBodiceChanged() === true, "8: 완료본 없음 → changed(true)");
}
// 9. placket 포함 완료 → 스냅샷에 placket 복사(파라미터)
{
  PROJECT = fakeProject(20, { frontPlacket: { parameters: { overlapCm: 1.75, facingWidthCm: 4, lengthMode: "full" }, outline: [], construction: [] } });
  const r = BC.complete();
  ok(r.ok && r.result.placket && r.result.placket.parameters.overlapCm === 1.75, "9: placket 스냅샷 복사");
  // 여밈 파라미터 변경 → changed
  PROJECT.working.frontPlacket.parameters.overlapCm = 2.5;
  ok(BC.isCurrentBodiceChanged() === true, "9: 여밈 파라미터 변경 → changed");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
