// ══════════════════════════════════════════════
// sideWaistFixture.js — 테스트 fixture 전용: v8 계약의 옆허리 다트 c 반쪽을 합성 geometry 에 붙인다.
//
// v8(현재 의미) 완료 흐름은 앞·뒤 조각마다 c/2 반쪽(construction, group "side-waist-c", locked, 다리 2개,
// 생산자 선언 groupTotal)이 있어야 몸판 체크포인트를 통과한다. 다른 의미(경계 identity·다트 attachment 등)를
// 시험하는 합성 fixture 가 v8 로 완료 경로를 탈 때 **올바른** c 반쪽을 갖도록 하는 헬퍼다(계약 약화 아님).
//
// fixture 가 명시한 edge 만 쓴다: 옆선 = edge "side-seam" line 1개, 허리 = edge "waist" line 1개.
// 허리가 없는 fixture 는 center 의 아래 끝 → side-seam 의 아래 끝으로 허리를 만든다(fixture 형태 가정).
// 허리 root 는 중심(0)→옆(1) — boundary 가 있으면 그 선언 range 를 따른다.
// ══════════════════════════════════════════════
const GROUP = "side-waist-c";
function clonePt(q) { return { x: q.x, y: q.y }; }
function addSideWaistC(geometry, opts) {
  opts = opts || {};
  const half = opts.halfCm != null ? opts.halfCm : 0.5;
  ["front", "back"].forEach(pc => {
    const piece = geometry[pc];
    const side = piece.outline.find(p => p.edge === "side-seam" && p.kind === "line");
    let waist = piece.outline.concat(piece.construction).find(p => p.edge === "waist" && p.kind === "line");
    const bot = (p) => (p.from.y >= p.to.y ? p.from : p.to), top = (p) => (p.from.y >= p.to.y ? p.to : p.from);
    if (!waist) {
      const center = piece.outline.find(p => p.edge === "center" && p.kind === "line");
      waist = { kind: "line", from: clonePt(bot(center)), to: clonePt(bot(side)), edge: "waist" };
      if (side.boundary) waist.boundary = { root: pc + "/waist", ranges: [[0, 1]] };
      piece.outline.push(waist);
    }
    const S = bot(side), U = top(side);
    const C = (Math.hypot(waist.from.x - S.x, waist.from.y - S.y) < 1e-9) ? waist.to : waist.from;
    const len = Math.hypot(C.x - S.x, C.y - S.y);
    const X = { x: S.x + (C.x - S.x) / len * half, y: S.y + (C.y - S.y) / len * half };
    // 허리 root 파라미터: 선언 range 가 있으면 from→to 방향을 따른다.
    const r = (waist.boundary && waist.boundary.ranges[0]) || [0, 1];
    const tAt = (q) => { const u = Math.hypot(q.x - waist.from.x, q.y - waist.from.y) / Math.hypot(waist.to.x - waist.from.x, waist.to.y - waist.from.y); return r[0] + (r[1] - r[0]) * u; };
    const root = (waist.boundary && waist.boundary.root) || (pc + "/waist");
    [S, X].forEach(q => piece.construction.push({ kind: "line", from: clonePt(q), to: clonePt(U),
      dart: { id: pc + "-side-waist-c", boundary: "waist", apexAt: "to", attach: { root, t: tAt(q) }, group: GROUP, locked: true, groupTotal: 2 * half } }));
  });
  return geometry;
}
module.exports = { addSideWaistC, GROUP };
