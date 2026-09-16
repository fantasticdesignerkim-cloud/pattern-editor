// ══════════════════════════════════════════════
// waistDartCarryCheck.js — P0.3b: draft 다트이동에서 gen-0 허리다트(a,b / d,e,f) 강체 carry.
//
// 계약: 다리 attachment {root,t} 가 이번 split 의 회전 조각 경계 구간에만 속하면(선언 root·range 기준,
// 좌표 미사용) 그 이동의 pivot/angle 로 다리·apex 를 함께 회전하고, 고정 조각이면 그대로, 섞이거나
// 모호하면(절개가 intake 안·정확한 다리 t) 좌표를 건드리지 않고 unresolved 로 고정한다. payload 는
// applied state 가 소유·누적하며 attach·identity 는 보존된다. 공용 옆 다트 c 는 대상이 아니다.
//
//   node test/harness/waistDartCarryCheck.js
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { applyRecipe } = require("./dartDriver");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const dims = { B: 83, W: 64, BL: 38 };
const ATTACH_EPS = 1e-3;

const payloadOf = (engine, side) => (side === "back" ? engine.dartMoveState.appliedBack : engine.dartMoveState.appliedFront)?.waistDarts;
function gen0(engine, side) { const d = engine.createDraft(83, 64, 38); return engine.gen0WaistDartPayload(side, d.formula, d.pts, d.darts); }
// 선언 {root,t} 의 실제 점(baked 선형 세그먼트의 선언 구간) 중 다리 끝과 일치하는 후보가 있는가.
function legAligned(segs, attach, pt) {
  return segs.some(s => {
    if (s.boundaryRoot !== attach.root || typeof s.boundaryFromT !== "number" || s.boundaryFromT === s.boundaryToT) return false;
    if (attach.t < Math.min(s.boundaryFromT, s.boundaryToT) - 1e-6 || attach.t > Math.max(s.boundaryFromT, s.boundaryToT) + 1e-6) return false;
    const u = (attach.t - s.boundaryFromT) / (s.boundaryToT - s.boundaryFromT);
    const q = { x: s.from.x + (s.to.x - s.from.x) * u, y: s.from.y + (s.to.y - s.from.y) * u };
    return Math.hypot(q.x - pt.x, q.y - pt.y) <= ATTACH_EPS;
  });
}
const legsOf = (e) => e.onFold ? ["right"] : ["left", "right"];
const entryAligned = (segs, e) => legsOf(e).every(l => legAligned(segs, e.attach[l], e.dart[l]));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 불변식: unresolved 가 아니면 최종 경계와 정합 / unresolved 면 직전 payload 좌표 그대로.
function invariant(prev, next, segs) {
  const bad = [];
  Object.keys(next).forEach(k => {
    const e = next[k], p = prev[k];
    if (e.id !== p.id || !same(e.attach, p.attach)) bad.push(k + ":identity/attach changed");
    if (e.unresolved) { if (!same(e.dart, p.dart)) bad.push(k + ":unresolved moved"); }
    else if (!entryAligned(segs, e)) bad.push(k + ":misaligned");
  });
  return bad;
}
const recipe = (type, arcFraction, piece, moveFraction) => ({ type, arcFraction, piece, moveFraction });

// 0. 단일 원천·payload 구성
{
  const { engine } = createEngine();
  const f = gen0(engine, "front"), b = gen0(engine, "back");
  ok(same(Object.keys(f), ["a", "b"]) && same(Object.keys(b), ["d", "e", "f"]), "0: payload = 앞 a,b / 뒤 d,e,f (공용 c 제외)");
  ok(b.f.onFold && b.f.attach.left === null && b.f.attach.right.root === "back/waist", "0: fold f 는 오른쪽 다리만");
  const d = engine.createDraft(83, 64, 38), darts = engine.buildGen0WaistDarts(d.formula, d.pts, d.darts);
  ok(same(f.a.dart, darts.a) && same(b.e.dart, darts.e) && f.a.dart !== darts.a, "0: payload 좌표 = 단일 원천 값 복사");
}

// 1. 앞목·앞허리·뒤허리 이동: 회전 조각 다트는 정합, 고정 쪽은 byte 불변
[["front", recipe("front-neckline", 0.4, "A", 1.0)], ["front", recipe("front-neckline", 0.4, "A", 0.5)],
 ["front", recipe("front-neckline", 0.4, "B", 1.0)],
 ["front", recipe("front-waist", 0.6, "A", 0.5)], ["front", recipe("front-waist", 0.6, "B", 1.0)],
 ["back", recipe("back-waist", 0.55, "A", 0.5)], ["back", recipe("back-waist", 0.55, "B", 1.0)],
 ["back", recipe("back-armhole", 0.4, "A", 0.6)]].forEach(([side, r]) => {
  const { engine } = createEngine();
  const base = gen0(engine, side);
  const res = applyRecipe(engine, side, dims, r);
  const name = side + " " + r.type + "@" + r.arcFraction + " " + r.piece + " ×" + r.moveFraction;
  ok(res.status === "applied", "1: " + name + " 적용");
  if (res.status !== "applied") return;
  const pl = payloadOf(engine, side);
  const bad = invariant(base, pl, res.bakedSegments);
  ok(bad.length === 0, "1: " + name + " 불변식 " + bad.join(","));
  const moved = Object.keys(pl).filter(k => !pl[k].unresolved && !same(pl[k].dart, base[k].dart));
  const fixed = Object.keys(pl).filter(k => !pl[k].unresolved && same(pl[k].dart, base[k].dart));
  ok(moved.length + fixed.length === Object.keys(pl).length, "1: " + name + " 전부 회전/고정으로 판정(미해결 없음) moved=" + moved + " fixed=" + fixed);
  ok(moved.every(k => entryAligned(res.bakedSegments, pl[k])) && fixed.every(k => entryAligned(res.bakedSegments, pl[k])), "1: " + name + " 회전·고정 모두 최종 경계와 정합");
});
// 앞목 A 는 허리를 포함한 조각을 돌린다 → a,b 가 실제로 회전(가짜 통과 방지)
{
  const { engine } = createEngine();
  const base = gen0(engine, "front");
  applyRecipe(engine, "front", dims, recipe("front-neckline", 0.4, "A", 1.0));
  const pl = payloadOf(engine, "front");
  ok(!same(pl.a.dart, base.a.dart) && !same(pl.b.dart, base.b.dart) && same(pl.a.attach, base.a.attach), "1: 앞목 A → a,b 회전·attach 보존");
}

// 2. 3세대 체인: 최신 payload 가 다음 split 으로 들어가 누적 변환
{
  const { engine } = createEngine();
  let prev = gen0(engine, "front"); const bad = [];
  [recipe("front-neckline", 0.4, "A", 0.5), recipe("front-armhole-upper", 0.5, "B", 0.4), recipe("front-neckline", 0.3, "A", 0.6)].forEach((r, i) => {
    const res = applyRecipe(engine, "front", dims, r);
    if (res.status !== "applied") { bad.push("gen" + i + ":" + res.status); return; }
    const pl = payloadOf(engine, "front");
    invariant(prev, pl, res.bakedSegments).forEach(x => bad.push("gen" + i + ":" + x));
    if (pl === prev || (prev.a && pl.a === prev.a)) bad.push("gen" + i + ":shared ref");
    prev = pl;
  });
  ok(bad.length === 0, "2: 3세대 체인 누적 정합·값 복사 " + bad.join(","));
  ok(!prev.a.unresolved && entryAligned(engine.dartMoveState.appliedFront.bakedSegments, prev.a), "2: 최종 세대에도 a 정합");
}
{
  const { engine } = createEngine();
  let prev = gen0(engine, "back"); const bad = [];
  [recipe("back-waist", 0.55, "A", 0.5), recipe("back-armhole", 0.4, "A", 0.6), recipe("back-neckline", 0.5, "B", 0.5)].forEach((r, i) => {
    const res = applyRecipe(engine, "back", dims, r);
    if (res.status !== "applied") { bad.push("gen" + i + ":" + res.status); return; }
    invariant(prev, payloadOf(engine, "back"), res.bakedSegments).forEach(x => bad.push("gen" + i + ":" + x));
    prev = payloadOf(engine, "back");
  });
  ok(bad.length === 0, "2: 뒤 3세대 체인 누적 정합 " + bad.join(","));
}

// 3. reset 후 원복 · 반복 결정론
{
  const { engine } = createEngine();
  applyRecipe(engine, "front", dims, recipe("front-neckline", 0.4, "A", 1.0));
  engine.resetDartMove();
  ok(engine.dartMoveState.appliedFront === null, "3: reset → payload 폐기");
  const res = applyRecipe(engine, "front", dims, recipe("front-armhole-upper", 0.5, "B", 0.4));
  const pl = payloadOf(engine, "front"), base = gen0(engine, "front");
  ok(res.status === "applied" && invariant(base, pl, res.bakedSegments).length === 0, "3: reset 후 새 이동은 gen-0 원천에서 시작");
  const run = () => { const { engine: e2 } = createEngine(); applyRecipe(e2, "front", dims, recipe("front-neckline", 0.4, "A", 0.5)); applyRecipe(e2, "front", dims, recipe("front-armhole-upper", 0.5, "B", 0.4)); return JSON.stringify(payloadOf(e2, "front")); };
  ok(run() === run(), "3: 같은 이동 반복 → 동일 payload");
}

// 4. 자동 carry 금지: cut 이 intake 안 / 정확한 다리 t / 모호한 소유권 / 공용 c
{
  const { engine } = createEngine();
  const base = gen0(engine, "front");
  const mid = (base.a.attach.left.t + base.a.attach.right.t) / 2;   // 앞 허리 run 은 단일 직선 → arcFraction = root t
  const res = applyRecipe(engine, "front", dims, recipe("front-waist", mid, "A", 0.5));
  const pl = payloadOf(engine, "front");
  ok(res.status === "applied" && pl.a.unresolved === true && same(pl.a.dart, base.a.dart), "4: cut 이 a intake 안 → carry 안 함(좌표 그대로·unresolved)");
  ok(!entryAligned(res.bakedSegments, pl.a), "4: intake 분할 다트는 정합으로 위장되지 않음");
  ok(!pl.b.unresolved && entryAligned(res.bakedSegments, pl.b), "4: 영향 없는 b 는 정상 처리");
  // unresolved 는 이후 이동에서도 다시 carry 하지 않는다
  applyRecipe(engine, "front", dims, recipe("front-neckline", 0.4, "A", 0.5));
  ok(payloadOf(engine, "front").a.unresolved === true && same(payloadOf(engine, "front").a.dart, base.a.dart), "4: unresolved 는 다음 세대에서도 좌표 유지");
}
{
  const { engine } = createEngine();
  const base = gen0(engine, "front");
  const res = applyRecipe(engine, "front", dims, recipe("front-waist", base.b.attach.right.t, "B", 0.5));
  const pl = payloadOf(engine, "front");
  ok(res.status === "applied" && pl.b.unresolved === true && same(pl.b.dart, base.b.dart), "4: cut 이 정확히 다리 t → 양 조각 포함 → unresolved");
}
{
  const { engine } = createEngine();
  const seg = (root, a, b) => ({ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, boundaryRoot: root, boundaryFromT: a, boundaryToT: b });
  const at = { root: "front/waist", t: 0.5 };
  ok(engine.waistLegOwner(at, [seg("front/waist", 0, 0.6)], [seg("front/waist", 0.4, 1)]) === "unresolved", "4: 양 조각 중복 포함 → unresolved");
  ok(engine.waistLegOwner(at, [seg("front/center", 0, 1)], [seg("back/waist", 0, 1)]) === "unresolved", "4: 어느 조각에도 없음 → unresolved");
  ok(engine.waistLegOwner(at, [seg("front/waist", 0, 0.4)], [seg("front/waist", 0.4, 0.45), seg("front/waist", 0.45, 1)]) === "rotate", "4: 같은 조각 안 여러 구간은 모호함 아님");
  ok(engine.waistLegOwner(null, [], []) === "unresolved" && engine.waistLegOwner({ root: "front/waist", t: NaN }, [], []) === "unresolved", "4: 선언 없음 → unresolved");
  const pl = gen0(engine, "front"), pb = gen0(engine, "back");
  ok(!("c" in pl) && !("c" in pb), "4: 공용 c 는 carry payload 대상 아님");
}

// 5. 기존 baked 의미·다트 선언 불변(허리다트 carry 는 bake 결과를 바꾸지 않는다)
{
  const { engine } = createEngine();
  const res = applyRecipe(engine, "front", dims, recipe("front-neckline", 0.4, "A", 0.5));
  ok(res.bakedSegments.every(s => !("waistDarts" in s)) && res.bakedSegments.filter(s => s.dartId).every(s => typeof s.dartAttachRoot === "string"), "5: baked 세그먼트·다트 선언은 carry 와 무관");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
