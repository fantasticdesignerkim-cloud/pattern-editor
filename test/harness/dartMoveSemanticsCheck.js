// ══════════════════════════════════════════════
// dartMoveSemanticsCheck.js — P0.2 보완: 다트이동 결과의 구조화 다트 선언 회귀.
//
// 부분 회전이 남기는 dart-leg-old 쌍은 새 다트가 아니라 **source 다트의 아직 열린 잔여 다리**다.
// 분할 생산자가 넘긴 source 선언(id·boundary)을 그대로 싣고 apex 는 pivot 끝으로 선언해야 하며,
// 세그먼트를 뒤집는 모든 경로는 dartApexAt 도 함께 뒤집어야 한다. capture(blockMaster)가 요구하는
// 불변식 — id 당 다리 2개, apex 선언 존재, 선언 apex 가 실제 pivot 끝 — 을 엔진 결과에서 직접 검사한다.
//
//   node test/harness/dartMoveSemanticsCheck.js
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { applyRecipe, attemptDartMove } = require("./dartDriver");
const { mulberry32 } = require("./rng");

let PASS = 0, FAIL = 0; const fails = [];
function ok(cond, name) { if (cond) PASS++; else { FAIL++; fails.push(name); } }
const dims = { B: 83, W: 64, BL: 38 };

function dartProblems(segs, pivot) {
  const groups = {}, probs = [];
  segs.forEach(s => { if (s.dartId) (groups[s.dartId] = groups[s.dartId] || []).push(s); });
  Object.keys(groups).forEach(id => {
    const legs = groups[id];
    if (legs.length !== 2) probs.push(id + ":legs=" + legs.length);
    legs.forEach(l => {
      if (l.dartApexAt !== "from" && l.dartApexAt !== "to") { probs.push(id + ":no-apex"); return; }
      const a = l[l.dartApexAt];
      if (Math.hypot(a.x - pivot.x, a.y - pivot.y) > 1e-3) probs.push(id + ":apex-not-pivot");
    });
  });
  return probs;
}
const oldLegs = (segs) => segs.filter(s => s.type === "dart-leg-old");

// 1. gen-0 부분 회전: 잔여 다리 = source 다트 선언(앞 가슴다트 / 뒤 어깨다트)
[["front", "front-waist", "front-bust", "armhole"], ["back", "back-armhole", "back-shoulder", "shoulder"]].forEach(([side, type, srcId, srcBoundary]) => {
  const { engine } = createEngine();
  const res = applyRecipe(engine, side, dims, { type, arcFraction: 0.4, piece: "A", moveFraction: 0.5 });
  ok(res.status === "applied", "1: " + side + " 부분 회전 적용");
  if (res.status !== "applied") return;
  const olds = oldLegs(res.bakedSegments);
  ok(olds.length === 2 && olds.every(l => l.dartId === srcId && l.dartBoundary === srcBoundary), "1: " + side + " 잔여 다리 = source " + srcId + "/" + srcBoundary);
  ok(olds.some(l => l.dartApexAt === "to") && olds.some(l => l.dartApexAt === "from"), "1: " + side + " 잔여 두 다리 apex 방향 선언");
  const news = res.bakedSegments.filter(s => s.type === "dart-leg-new");
  ok(news.length === 2 && news[0].dartId === news[1].dartId && news[0].dartId !== srcId, "1: " + side + " 새 다트는 별도 id 2다리");
  ok(dartProblems(res.bakedSegments, res.pivot).length === 0, "1: " + side + " capture 다트 불변식 충족");
  ok(res.bakedSegments.every(s => !("sourceDart" in s)), "1: " + side + " 전달 표식이 결과 형상에 남지 않음");
});

// 2. gen-0 완전 회전: source 가 닫혀 잔여 다리 없음(normalize) — 새 다트만
{
  const { engine } = createEngine();
  const res = applyRecipe(engine, "front", dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 1.0 });
  ok(res.status === "applied" && oldLegs(res.bakedSegments).length === 0 && dartProblems(res.bakedSegments, res.pivot).length === 0,
    "2: 완전 회전 → 닫힌 source 흔적 없음·불변식 충족");
}

// 3. 다세대(뒤집힌 조각 경유): 모든 다리의 선언 apex 가 pivot 끝
{
  const { engine } = createEngine();
  const recipes = [
    { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.5 },
    { type: "side-seam", arcFraction: 0.45, piece: "B", moveFraction: 0.4 },
    { type: "front-armhole-upper", arcFraction: 0.6, piece: "A", moveFraction: 1.0 },
  ];
  let bad = [];
  recipes.forEach((r, i) => {
    const res = applyRecipe(engine, "front", dims, r);
    if (res.status !== "applied") { bad.push("gen" + i + ":" + res.status); return; }
    dartProblems(res.bakedSegments, res.pivot).forEach(p => bad.push("gen" + i + ":" + p));
  });
  ok(bad.length === 0, "3: 앞판 3세대 체인 다트 선언 일관 " + bad.join(","));
}

// 4. 무작위 스트레스(앞·뒤, 부분·완전 혼합)
{
  let applied = 0, bad = 0;
  ["front", "back"].forEach(side => {
    for (let run = 0; run < 20; run++) {
      const { engine } = createEngine();
      const rng = mulberry32(run * 104729 + (side === "back" ? 5 : 1));
      for (let gen = 0; gen < 6; gen++) {
        const res = attemptDartMove(engine, side, dims, 0.2 + rng() * 0.8, undefined, rng);
        if (res.status !== "applied") continue;
        applied++;
        if (dartProblems(res.bakedSegments, res.pivot).length) bad++;
      }
    }
  });
  ok(applied > 100 && bad === 0, "4: 무작위 적용 " + applied + "건 다트 선언 위반 " + bad);
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
