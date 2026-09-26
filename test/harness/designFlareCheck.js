// ══════════════════════════════════════════════
// designFlareCheck.js — js/designFlare.js (처리 방법 161 닫는다·벌린다) 회귀.
//
// 핵심 계약: (1) 강체 회전이라 **조각 면적이 정확히 보존**되고 벌어진 쐐기만 더해진다,
// (2) 다트가 정확히 닫힌다, (3) 이등변이 아니면 잔여 sliver 를 **감추지 않고 기록**한다,
// (4) 겹치는 결과·봉제 허리다트 잔존은 **원자적 거부**(부분 반환 없음).
//
//   node test/harness/designFlareCheck.js
// ══════════════════════════════════════════════
const vm = require("vm");
const fs = require("fs");
const path = require("path");

let PASS = 0, FAIL = 0; const fails = [];
function ok(c, n) { if (c) PASS++; else { FAIL++; fails.push(n); } }
function throwsReason(fn, want, name) {
  try { fn(); FAIL++; fails.push(name + " (throw 안 됨)"); }
  catch (e) { if (want && e.reason !== want) { FAIL++; fails.push(`${name} (reason=${e.reason}, 기대=${want})`); } else PASS++; }
}
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const J = JSON.stringify;

const sandbox = { window: {}, document: {}, console: { log() {}, warn() {} }, Math, JSON, Object, Array, isFinite, structuredClone };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const js = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", f), "utf8"), sandbox, { filename: f });
js("designLineTool.js");
js("designFlare.js");
const F = sandbox.window.designFlare, T = sandbox.window.designLineTool;

ok(typeof F.closeDartSpread === "function" && Object.isFrozen(F), "0: API·frozen");

// ── 픽스처: 실제 앞판을 닮은 조각 — 다트 V 는 진동(오른쪽), 중심선은 왼쪽, 밑단 아래 ──
const L = (a, b, edge) => { const s = { kind: "line", from: { x: a[0], y: a[1] }, to: { x: b[0], y: b[1] } }; if (edge) s.edge = edge; return s; };
function fixture(o) {
  o = o || {};
  const apex = { x: 12, y: 16 }, r0 = o.r0 || 6, r1 = o.r1 || 6;   // r0≠r1 → 비이등변(뒤판형)
  const a0 = (o.a0 != null ? o.a0 : -20) * Math.PI / 180;
  const a1 = (o.a1 != null ? o.a1 : 16) * Math.PI / 180;
  const F0 = { x: apex.x + r0 * Math.cos(a0), y: apex.y + r0 * Math.sin(a0) };
  const F1 = { x: apex.x + r1 * Math.cos(a1), y: apex.y + r1 * Math.sin(a1) };
  return {
    apex, F0, F1,
    piece: {
      outline: [
        L([F0.x, F0.y], [18, 4], "armhole"),
        L([18, 4], [0, 0], "shoulder"),
        L([0, 0], [0, 40], "center"),
        L([0, 40], [20, 40], "hem"),
        L([20, 40], [F1.x, F1.y], "side-seam")
      ],
      // 다트 다리는 construction 에 있다(실제 도안과 같다): mouth1 → apex → mouth0
      construction: [
        Object.assign(L([F1.x, F1.y], [apex.x, apex.y]), { dart: { id: "bust", boundary: "armhole", apexAt: "to" } }),
        Object.assign(L([apex.x, apex.y], [F0.x, F0.y]), { dart: { id: "bust", boundary: "armhole", apexAt: "from" } })
      ].concat(o.construction || [])
    }
  };
}
const fx = fixture();
const SNAP = J(fx.piece);
const r = F.closeDartSpread(fx.piece);

// 1. 다트가 닫히고 밑단이 벌어진다
{
  ok(near(r.dartAngleRad * 180 / Math.PI, 36, 1e-9), "1: 다트각 36°(V 폭 그대로)");
  ok(r.spreadCm > 0 && near(r.spreadCm, 2 * 24 * Math.sin(Math.abs(r.dartAngleRad) / 2), 1e-9),
    "1: 밑단 벌어짐 = 2·절개길이·sin(θ/2)");
  ok(near(r.slashLenCm, 24), "1: 절개 길이 = apex→밑단 24");
  ok(near(r.residualSliverCm, 0, 1e-9), "1: 이등변이면 잔여 sliver 0");
  ok(r.rotatedSide === "B", "1: 중심선을 품은 쪽을 고정하고 반대쪽을 돌린다");
}

// 2. ★ 면적 — 강체 회전이라 조각 면적은 보존되고 **쐐기만** 더해진다
//    해석값 ½·r²·sinθ 는 **직선 이음**의 값이다. 곡선 이음(기본)은 부푼 만큼 달라지므로
//    해석 검산은 직선 모드에 걸고, 곡선은 그 차이가 작다는 것만 확인한다.
{
  const rH = r.slashLenCm, theory = 0.5 * rH * rH * Math.abs(Math.sin(r.dartAngleRad));
  const rs = F.closeDartSpread(fixture().piece, { hemFairing: "straight" });
  ok(near(rs.wedgeAreaCm2, theory, 1e-6), "2: 직선 이음 추가 면적 = ½·r²·sinθ(해석값과 일치)");
  ok(near(rs.areaBeforeCm2, r.areaBeforeCm2, 1e-9), "2: 원본 면적은 이음 방식과 무관");
  ok(r.areaBeforeCm2 > 0 && r.wedgeAreaCm2 > 0, "2: 원본 면적·쐐기 둘 다 양수");
  const gapRatio = Math.abs(r.wedgeAreaCm2 - theory) / theory;
  ok(gapRatio < 0.12, "2: 곡선 이음 면적이 해석값에서 크게 벗어나지 않는다(" + (gapRatio * 100).toFixed(2) + "%)");
}

// 2b. 밑단 이음이 **각지지 않는다** — 양 접합부 접선 연속(G1)
{
  ok(r.hemFairing === "smooth", "2b: 기본은 곡선 이음");
  const bridge = r.outline.find(s => s.kind === "cubic" && !s.edge);
  ok(!!bridge, "2b: 이음이 cubic 으로 들어간다");
  const iA = r.outline.indexOf(bridge);
  const prev = r.outline[iA - 1], next = r.outline[iA + 1];
  const dot = (u, v) => u.x * v.x + u.y * v.y;
  const tPrev = F.tangentAtEnd(prev), tIn = F.tangentAtStart(bridge);
  const tOut = F.tangentAtEnd(bridge), tNext = F.tangentAtStart(next);
  ok(near(dot(tPrev, tIn), 1, 1e-9), "2b: 들어오는 접선 연속(각 0°)");
  ok(near(dot(tOut, tNext), 1, 1e-9), "2b: 나가는 접선 연속(각 0°)");
  // 직선 이음은 꺾인다 — 곡선이 실제로 고치는 것이 맞는지 대조
  const rs2 = F.closeDartSpread(fixture().piece, { hemFairing: "straight" });
  const bi = rs2.outline.findIndex(s => s.kind === "line" && !s.edge);
  const kink = dot(F.tangentAtEnd(rs2.outline[bi - 1]), F.tangentAtStart(rs2.outline[bi]));
  ok(kink < 0.999, "2b: 직선 이음은 실제로 꺾여 있다(대조군)");
  throwsReason(() => F.closeDartSpread(fixture().piece, { hemFairing: "arc" }), "invalid-hem-fairing", "2b: 모르는 이음 방식 거부");
}

// 3. 결과가 물리적으로 성립하는 폐곡선인가 (제1법칙)
{
  let maxGap = 0;
  for (let i = 0; i < r.outline.length; i++) {
    const a = r.outline[i], b = r.outline[(i + 1) % r.outline.length];
    maxGap = Math.max(maxGap, Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y));
  }
  ok(maxGap < 1e-9, "3: 폐곡선 연결 오차 0");
  const flat = []; r.outline.forEach(s => T.flattenLine([s]).forEach(ab => flat.push(ab)));
  let x = 0;
  for (let i = 0; i < flat.length; i++) for (let j = i + 2; j < flat.length; j++) {
    if (i === 0 && j === flat.length - 1) continue;
    const p = T.segCross(flat[i][0], flat[i][1], flat[j][0], flat[j][1]);
    if (!p) continue;
    const nr = (u, v) => Math.hypot(u.x - v.x, u.y - v.y) < 1e-6;
    if (!(nr(flat[i][1], flat[j][0]) || nr(flat[j][1], flat[i][0]) || nr(flat[i][0], flat[j][0]) || nr(flat[i][1], flat[j][1]))) x++;
  }
  ok(x === 0, "3: 자기교차 0");
  ok(r.outline.every(s => s.kind === "line" || s.kind === "cubic" || s.kind === "path"), "3: 세그먼트 종류 유지");
}

// 4. 비이등변(뒤 어깨다트형) — 잔여 sliver 를 **감추지 않고 기록**한다
{
  const asym = fixture({ r0: 9.083, r1: 8.980 });
  const ra = F.closeDartSpread(asym.piece);
  ok(ra.residualSliverCm > 1e-3, "4: 비이등변이면 잔여 sliver 가 0 이 아니다(" + ra.residualSliverCm.toFixed(4) + "cm)");
  ok(near(ra.residualSliverCm, Math.abs(9.083 - 8.980), 1e-9), "4: sliver = 두 다리 반지름 차");
  let g = 0;
  for (let i = 0; i < ra.outline.length; i++) {
    const a = ra.outline[i], b = ra.outline[(i + 1) % ra.outline.length];
    g = Math.max(g, Math.hypot(a.to.x - b.from.x, a.to.y - b.from.y));
  }
  ok(g < 1e-9, "4: sliver 를 명시 세그먼트로 이어 폐곡선은 여전히 닫힌다");
}

// 5. 원자적 거부 — 부분 결과를 내지 않는다
{
  // 봉제 허리다트가 남아 있으면 거부(절개선이 관통할 수 있다 — 먼저 배분 0 으로 지우게 한다)
  const wd = fixture({ construction: [
    Object.assign(L([11, 40], [12, 24]), { dart: { id: "a", boundary: "waist", apexAt: "to" } }),
    Object.assign(L([13, 40], [12, 24]), { dart: { id: "a", boundary: "waist", apexAt: "to" } })
  ] });
  throwsReason(() => F.closeDartSpread(wd.piece), "waist-darts-present", "5: 봉제 허리다트 잔존 거부");

  // 밑단 모서리가 없으면 벌릴 곳이 없다
  const noHem = fixture();
  noHem.piece.outline = noHem.piece.outline.map(s => s.edge === "hem" ? Object.assign({}, s, { edge: undefined }) : s);
  throwsReason(() => F.closeDartSpread(noHem.piece), "no-hem-edge", "5: 밑단 모서리 없음 거부");

  // 절개선이 다트 다리 바로 옆이면 회전할 공간이 없어 겹친다 → 거부(조용히 접힌 조각 금지)
  const tight = fixture({ a0: 135, a1: 99 });
  let reason = null;
  try { F.closeDartSpread(tight.piece); } catch (e) { reason = e.reason; }
  ok(reason === "self-intersection" || reason === "no-area-gain" || reason === "ring-failed",
    "5: 회전 공간 없는 배치 거부(" + reason + ")");

  throwsReason(() => F.closeDartSpread(null), "invalid-piece", "5: 빈 입력 거부");
  throwsReason(() => F.closeDartSpread({ outline: [] }), "invalid-piece", "5: 빈 외곽 거부");
}

// 6. 순수성 — 입력 불변 · 결정성 · 참조 분리
{
  ok(J(fx.piece) === SNAP, "6: 입력 piece 불변(성공·실패 전 구간)");
  const r2 = F.closeDartSpread(fixture().piece);
  ok(J(r2.outline) === J(r.outline), "6: 같은 입력 = 같은 출력(결정성)");
  const shares = (a, b) => { const seen = new Set();
    (function w(o) { if (o && typeof o === "object") { seen.add(o); Object.values(o).forEach(w); } })(a);
    let hit = false;
    (function w(o) { if (hit || !o || typeof o !== "object") return; if (seen.has(o)) { hit = true; return; } Object.values(o).forEach(w); })(b);
    return hit; };
  ok(!shares(fx.piece, r.outline), "6: 출력이 입력과 참조를 공유하지 않는다");
}

// 7. construction 은 회전 조각에 실린 것만 함께 돈다(안 그러면 외곽에서 떨어진다)
{
  const withC = fixture({ construction: [
    L([2, 10], [2, 30]),      // 중심 쪽 = 고정
    L([18, 30], [19, 34])     // 옆선 쪽 = 회전
  ] });
  const rc = F.closeDartSpread(withC.piece);
  const same = (a, b) => near(a.from.x, b.from.x, 1e-12) && near(a.from.y, b.from.y, 1e-12);
  ok(same(rc.construction[2], withC.piece.construction[2]), "7: 고정 조각의 참고선은 그대로");
  ok(!same(rc.construction[3], withC.piece.construction[3]), "7: 회전 조각의 참고선은 함께 회전");
  ok(rc.construction.length === 4, "7: 참고선 개수 보존(다트 다리 2 + 추가 2)");
}

console.log("══════════════════════════════════════════════");
if (FAIL) { console.log("실패 목록:"); fails.forEach(f => console.log("  ✗ " + f)); }
console.log(`결과: ${PASS} PASS / ${FAIL} FAIL`);
process.exit(FAIL ? 1 : 0);
