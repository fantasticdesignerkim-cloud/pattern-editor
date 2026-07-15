// ══════════════════════════════════════════════
// 성능 기준선 — 순서 ③ C3의 `≤1.2×` 게이트에 쓸 **결정적** 지표.
//
// ★ 벽시계 시간은 PC 상태에 따라 달라지므로 **테스트 실패 조건으로 쓰지 않는다**.
//   실패 조건은 아래 세 가지 호출 횟수뿐이고, 시간은 정보용으로만 출력한다.
//     - bake / normalize 호출 횟수
//     - collision 검사(findRotationCollisions) 횟수
//     - self-intersection 검사(findSelfIntersections) 횟수
//   C3 구현 후 **같은 환경에서** 이 숫자를 다시 재서 비교한다.
//
// 계측은 vm 컨텍스트 **내부**에서 전역 바인딩을 감싸야 한다 — loadEngine이 export한
// 참조만 바꾸면 내부 호출(bakeFromSplitPieces → normalizeBakedSegments 등)이 안 잡힌다.
//
// 실행: node test/harness/perfBaseline.js [--update "reason"]
// ══════════════════════════════════════════════
const vm = require("vm");
const path = require("path");
const { createEngine } = require("./loadEngine");
const { applyRecipe, moveContext, resolveCutRecipe, budgetRadOf } = require("./dartDriver");
const { GoldenFile } = require("./goldenSnapshot");

const golden = new GoldenFile(path.join(__dirname, "golden", "perf-baseline.json"));

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
const B = 83, W = 64, BL = 38, dims = { B, W, BL };

function instrument(context) {
  vm.runInContext(`
    globalThis.__counts = { bake: 0, normalize: 0, rotColl: 0, selfX: 0 };
    var _bake = bakeFromSplitPieces;
    bakeFromSplitPieces = function (...a) { __counts.bake++; return _bake(...a); };
    var _norm = normalizeBakedSegments;
    normalizeBakedSegments = function (...a) { __counts.normalize++; return _norm(...a); };
    var _rc = findRotationCollisions;
    findRotationCollisions = function (...a) { __counts.rotColl++; return _rc(...a); };
    var _sx = findSelfIntersections;
    findSelfIntersections = function (...a) { __counts.selfX++; return _sx(...a); };
  `, context);
}
const readCounts = (context) => JSON.parse(vm.runInContext("JSON.stringify(__counts)", context));

// 조각 선택 1회(prepareDartMoveCandidate)의 비용을 잰다.
function measure(label, buildFn) {
  const { engine, context } = createEngine();
  const args = buildFn(engine);
  instrument(context);
  const t0 = Date.now();
  context.__args = args;
  vm.runInContext("globalThis.__r = prepareDartMoveCandidate(globalThis.__args)", context);
  const ms = Date.now() - t0;
  const counts = readCounts(context);
  console.log(`  ${label.padEnd(28)} bake:${String(counts.bake).padStart(3)} normalize:${String(counts.normalize).padStart(3)} ` +
    `rotColl:${String(counts.rotColl).padStart(3)} selfX:${String(counts.selfX).padStart(2)}   (${ms}ms · 정보용)`);
  return counts;
}

console.log("\n── 조각 선택 1회 비용 (결정적 호출 횟수) ──");

// gen-0: 부호 후보 2개 → 파이프라인 ×2
const gen0 = measure("gen-0 (양쪽 부호)", (engine) => {
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, { type: "front-waist", arcFraction: 0.35 });
  const split = engine.splitFrontOutline(ctx.segs, cut.point, cut.segIndex, ctx.d.pts, B);
  const base = engine.calcFrontBaseDartAngle(ctx.d.pts, B);
  return { pivot: ctx.pivot, budgetRad: Math.abs(base), rawBaseAngleRad: base,
    cutPoint: cut.point, rotatePiece: split.pieceA, fixedPiece: split.pieceB, prevBakedSegments: null };
});

// sourceNotch: 부호 확정 → 파이프라인 ×1
const srcNotch = measure("sourceNotch (단일 부호)", (engine) => {
  applyRecipe(engine, "front", dims, { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.3 });
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, { type: "side-seam", arcFraction: 0.45 });
  const split = engine.splitBakedOutline(ctx.segs, cut.point, cut.segIndex, ctx.pivot);
  const base = engine.calcFrontBaseDartAngle(ctx.d.pts, B);
  return { pivot: ctx.pivot, budgetRad: Math.abs(base), rawBaseAngleRad: base,
    cutPoint: cut.point, rotatePiece: split.pieceB, fixedPiece: split.pieceA,
    prevBakedSegments: engine.dartMoveState.appliedFront.bakedSegments };
});

// 구조 불변식: gen-0은 부호 2개라 sourceNotch의 대략 2배 bake를 쓴다.
check("gen-0 bake ≈ sourceNotch bake × 2 (부호 후보 2개)",
  gen0.bake === srcNotch.bake * 2, { gen0: gen0.bake, srcNotch: srcNotch.bake });
check("bake와 normalize 호출 수 일치 (파이프라인상 항상 짝)",
  gen0.bake === gen0.normalize && srcNotch.bake === srcNotch.normalize,
  { gen0: [gen0.bake, gen0.normalize], srcNotch: [srcNotch.bake, srcNotch.normalize] });

// 골든: 호출 횟수만 고정(시간 제외 — 결정적이지 않다)
const g1 = golden.check("perf_gen0_counts", gen0);
check("perf_gen0_counts 골든 일치", g1.length === 0, g1.length ? g1.slice(0, 2) : undefined);
const g2 = golden.check("perf_sourceNotch_counts", srcNotch);
check("perf_sourceNotch_counts 골든 일치", g2.length === 0, g2.length ? g2.slice(0, 2) : undefined);

console.log("\n  ※ 시간은 정보용. C3의 ≤1.2× 게이트는 위 호출 횟수를 같은 환경에서 재비교해 판정한다.");

if (golden.update) {
  const reason = process.argv.slice(2).filter(a => !a.startsWith("--")).join(" ") || "perf call-count baseline (pre step-3)";
  golden.save(reason);
  console.log(`\n[golden] ${golden.filePath} 갱신 (사유: ${reason})`);
}
console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL${golden.update ? "  (--update 모드)" : ""}`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
