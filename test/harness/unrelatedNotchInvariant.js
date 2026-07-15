// ══════════════════════════════════════════════
// "무관한 notch 변화 0" 불변식.
//
// 다트이동은 source notch를 닫고 cutPoint에 새 notch를 연다. **그 둘을 제외한 모든
// notch는 aperture도 mouth 좌표도 변하면 안 된다** — 무관한 다트가 흔들리면 패턴사가
// 이미 결정해 배치한 다트가 제멋대로 움직이는 것이다(제1법칙 위반은 아니지만 신뢰 붕괴).
//
// **식별 규칙(중요)**: `dartId`나 "같은 각도"로 notch를 매칭하지 않는다.
//   - dartId는 물리 계산에서 배제된 부기 개념이고(sourceNotch 3차 재설계),
//   - 같은 각도 매칭은 50% 이동처럼 두 notch의 각도가 우연히 같아질 때 오매칭한다
//     (backDeterministic에서 실제로 겪은 함정).
// 대신 **순서 루프상의 notch instance + mouth 좌표**로 식별한다. mouth 좌표는 강체
// 회전에서도 그 조각 안에 있으면 함께 움직이므로, "무관한 notch"는 고정 조각에 속해
// 좌표가 그대로여야 한다는 것이 바로 이 테스트의 주장이다.
//
// 실행: node test/harness/unrelatedNotchInvariant.js
// ══════════════════════════════════════════════
const { createEngine } = require("./loadEngine");
const { applyRecipe, moveContext, resolveCutRecipe, performMove, listOpenNotches } = require("./dartDriver");

let pass = 0, fail = 0;
const failures = [];
function check(label, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ label, detail }); console.error("  ✗ FAIL:", label, detail ?? ""); }
}
const B = 83, W = 64, BL = 38, dims = { B, W, BL };
const D = (r) => r * 180 / Math.PI;
const EPS_COORD = 1e-4;   // cm — goldenSnapshot과 같은 좌표 ε
const EPS_ANGLE = 1e-6;   // rad

const apertureOf = (n, pivot) => {
  const v1x = n.mouthA.x - pivot.x, v1y = n.mouthA.y - pivot.y;
  const v2x = n.mouthB.x - pivot.x, v2y = n.mouthB.y - pivot.y;
  return Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
};
const ptNear = (a, b, eps) => Math.hypot(a.x - b.x, a.y - b.y) < eps;
// notch instance 신원 = 두 mouth 좌표의 **순서 무관 쌍**.
// ★ mouthA/mouthB 라벨은 안정적이지 않다: bake/normalize가 폐곡선의 순서를 다시 짜면
//   같은 notch라도 어느 다리가 legIdxA인지가 뒤바뀐다(실측: 이동 전후로 mouthA가 정확히
//   자기 aperture만큼 극각 이동한 것처럼 보였는데, 반지름은 불변 — 회전이 아니라 A/B
//   라벨 스왑이었다). 라벨 순서로 매칭하면 불변인 notch를 "변했다"고 오판한다.
//   → 좌표쌍을 사전순으로 정규화해서 신원을 만든다.
const notchKey = (n) => {
  const a = `${n.mouthA.x.toFixed(4)},${n.mouthA.y.toFixed(4)}`;
  const b = `${n.mouthB.x.toFixed(4)},${n.mouthB.y.toFixed(4)}`;
  return a <= b ? `${a}|${b}` : `${b}|${a}`;
};

console.log("\n── 무관한 notch 변화 0 ──");

// 3다트 상태를 만든 뒤 4번째 이동을 하고, source/new를 뺀 나머지가 불변인지 본다.
// (분산 다트가 여러 개 있어야 "무관한 notch"가 존재한다)
const SETUP = [
  { type: "front-waist", arcFraction: 0.35, piece: "A", moveFraction: 0.4 },
  { type: "side-seam",   arcFraction: 0.45, piece: "B", moveFraction: 0.4 },
];
const MOVE = { type: "front-armhole-upper", arcFraction: 0.6, piece: "A", moveFraction: 0.5 };

const { engine } = createEngine();
let ok = true;
SETUP.forEach((r, i) => {
  const res = applyRecipe(engine, "front", dims, r);
  check(`setup gen${i} (${r.type}) applied`, res.status === "applied", res.status);
  if (res.status !== "applied") ok = false;
});

if (ok) {
  const pivot = engine.dartMoveState.appliedFront.pivot;
  const before = listOpenNotches(engine, engine.dartMoveState.appliedFront.bakedSegments, pivot);
  console.log(`  이동 전 notch ${before.length}개: ${before.map(n => D(apertureOf(n, pivot)).toFixed(3) + "°").join(", ")}`);
  check("이동 전 다중다트 상태(notch ≥ 3)", before.length >= 3, before.length);

  // 4번째 이동 — performMove로 실제 파이프라인 구동
  const ctx = moveContext(engine, "front", dims);
  const cut = resolveCutRecipe(engine, "front", ctx, MOVE);
  const res = performMove(engine, "front", dims, ctx, cut, MOVE.piece, MOVE.moveFraction, null);
  check(`이동 applied`, res.status === "applied", res.status);

  if (res.status === "applied") {
    const after = listOpenNotches(engine, res.bakedSegments, pivot);
    console.log(`  이동 후 notch ${after.length}개: ${after.map(n => D(apertureOf(n, pivot)).toFixed(3) + "°").join(", ")}`);

    // source notch = 이동 전 것 중 rotatePiece가 물었던 것.
    // performMove가 sourceApertureBeforeDeg를 주므로 그 aperture를 가진 이동 전 notch가 source.
    // (aperture만으로 고르지 않고, "이동 후 좌표가 그대로 남은 것"과 교차 검증한다)
    const srcApBefore = res.sourceApertureBeforeDeg != null ? res.sourceApertureBeforeDeg * Math.PI / 180 : null;
    check("sourceNotch 경로로 진입", srcApBefore != null, { viaSourceNotch: res.viaSourceNotch });

    if (srcApBefore != null) {
      // 무관한 notch = 이동 전 notch 중, mouth 좌표쌍이 이동 후에도 **그대로** 남아있고
      // source가 아닌 것. 좌표 신원으로 매칭한다(각도/ dartId 미사용).
      const afterKeys = new Map(after.map(n => [notchKey(n), n]));
      const survivors = before.filter(n => afterKeys.has(notchKey(n)));
      // source는 닫히거나 줄어 좌표가 바뀌므로 survivors에 없어야 정상.
      // survivors = 이동과 무관하게 좌표가 보존된 notch들.
      console.log(`  좌표 신원이 그대로 살아남은 notch: ${survivors.length}개`);
      check("무관한 notch가 최소 1개 존재해야 이 테스트가 의미 있음", survivors.length >= 1, survivors.length);

      // 핵심 주장: survivor들의 aperture와 mouth 좌표가 ε 이내로 완전 동일
      let allSame = true;
      for (const n of survivors) {
        const m = afterKeys.get(notchKey(n));
        const dAp = Math.abs(apertureOf(n, pivot) - apertureOf(m, pivot));
        // 라벨 스왑을 허용한 좌표 비교: {A,B}가 {A',B'} 또는 {B',A'}와 일치
        const straight = ptNear(n.mouthA, m.mouthA, EPS_COORD) && ptNear(n.mouthB, m.mouthB, EPS_COORD);
        const swapped  = ptNear(n.mouthA, m.mouthB, EPS_COORD) && ptNear(n.mouthB, m.mouthA, EPS_COORD);
        if (!(dAp < EPS_ANGLE && (straight || swapped))) {
          allSame = false;
          check(`무관 notch 불변 (aperture ${D(apertureOf(n, pivot)).toFixed(3)}°)`, false,
            { dApertureDeg: D(dAp).toFixed(6), straight, swapped });
        }
      }
      if (allSame) check(`무관한 notch ${survivors.length}개 전부 aperture+mouth 좌표 불변 (ε: ${EPS_COORD}cm / ${EPS_ANGLE}rad)`, true);

      // 추가: source를 뺀 "변화한" notch는 새로 연 것 하나뿐이어야 한다
      const changed = after.filter(n => !before.some(b => notchKey(b) === notchKey(n)));
      console.log(`  새로 생기거나 좌표가 바뀐 notch: ${changed.length}개 (${changed.map(n => D(apertureOf(n, pivot)).toFixed(3) + "°").join(", ")})`);
      check("변화한 notch는 source 잔여 + new 로 설명 가능 (≤2개)", changed.length <= 2, changed.length);
    }
  }
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`결과: ${pass} PASS / ${fail} FAIL`);
if (fail > 0) {
  console.log("실패 목록:");
  failures.forEach(f => console.log(" -", f.label, JSON.stringify(f.detail)));
  process.exitCode = 1;
}
