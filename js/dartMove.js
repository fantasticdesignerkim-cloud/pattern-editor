// ══════════════════════════════════════════════
// 다트이동 — 실제 앞판 패턴선 기준 cutPoint 선택 + BP 절개선
// 기준: render.js가 그리는 앞판 최종 외곽선과 같은 계산 사용
// ══════════════════════════════════════════════

const dartMoveState = {
  active:        false,
  side:          null,
  mode:          "idle",
  cutPoint:      null,
  cutSegIndex:   -1,
  hoverPoint:    null,
  hoverSegIndex: -1,
  pieceA:        null,
  pieceB:        null,
  baseAngle:     0,
  userAngle:     0,
  rotatePts:     null,
  fixedPts:      null,
  fixedSegs:     null,
  rotateSegs:    null,
  fixedHit:      null,
  rotateHit:     null,
  dragging:      false,
  _splitIsBaked: null,
  // ── 적용 결과 ──────────────────────────────
  appliedFront:  null,
  appliedBack:   null,
};

// ── 유틸 ──────────────────────────────────────
function closestOnSeg(pt, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const L2 = abx * abx + aby * aby;
  if (L2 < 1e-10) return { pt: { ...a }, d: Math.hypot(pt.x - a.x, pt.y - a.y) };
  const t = Math.max(0, Math.min(1, ((pt.x - a.x) * abx + (pt.y - a.y) * aby) / L2));
  const q = { x: a.x + t * abx, y: a.y + t * aby };
  return { pt: q, d: Math.hypot(pt.x - q.x, pt.y - q.y) };
}

function sampleCubic(p0, c0, c1, p1, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, mt = 1 - t;
    pts.push({
      x: mt*mt*mt*p0.x + 3*mt*mt*t*c0.x + 3*mt*t*t*c1.x + t*t*t*p1.x,
      y: mt*mt*mt*p0.y + 3*mt*mt*t*c0.y + 3*mt*t*t*c1.y + t*t*t*p1.y,
    });
  }
  return pts;
}

function addLineSegment(segments, from, to, meta = {}) {
  segments.push({ from: { ...from }, to: { ...to }, ...meta });
}

function addSampledSegments(segments, pts, meta = {}) {
  for (let i = 0; i < pts.length - 1; i++)
    addLineSegment(segments, pts[i], pts[i + 1], meta);
}

// ── BP 중심 회전 ──────────────────────────────
// ── 다트 열린 너비 계산: cutPoint ↔ cut2 직선 거리 ──
function dartOpenWidth(cutPt, pivot, angle) {
  const cut2 = rotatePt(cutPt, pivot, angle);
  return Math.hypot(cut2.x - cutPt.x, cut2.y - cutPt.y);
}

function rotatePt(pt, center, angle) {
  const dx = pt.x - center.x, dy = pt.y - center.y;
  return {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

// ── 점이 폴리곤 내부에 있는지 판별 (ray casting) ──
// ── 폴리곤 면적 (Shoelace formula) ──
function polygonArea(pts) {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

function pointInPolygon(pt, polygon) {
  if (!pt || !polygon || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── 두 세그먼트가 내부에서 실제로 교차하는지 (엄격 교차만, 끝점 공유/collinear는 제외) ──
function segmentsCross(segA, segB) {
  const o = (a, b, c) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
  const p1 = segA.from, p2 = segA.to, p3 = segB.from, p4 = segB.to;
  const o1 = o(p1, p2, p3), o2 = o(p1, p2, p4), o3 = o(p3, p4, p1), o4 = o(p3, p4, p2);
  return o1 !== o2 && o1 !== 0 && o2 !== 0 && o3 !== o4 && o3 !== 0 && o4 !== 0;
}

// ── 위상 순서 보존 bake ───────────────────────────────
// ── split 결과로 bakedSegments 생성 ─────────────
// 다트 입구 = cutPoint / rotatedCutPoint, 꼭지점 = pivot
// 폐곡선: pivot → cutA → segsA → endA → bridge → endB → reversed(segsB) → cutB → pivot
// ── 타겟 외곽선 공급 ─────────────────────────────
function getFrontTargetOutline(p, f, B) {
  const baked = dartMoveState.appliedFront?.bakedSegments;
  if (Array.isArray(baked) && baked.length > 0) return baked;
  return buildFrontOutline(p, f, B);
}
function getBackTargetOutline(p, f, B) {
  const baked = dartMoveState.appliedBack?.bakedSegments;
  if (Array.isArray(baked) && baked.length > 0) return baked;
  return buildBackOutline(p, f, B);
}

function debugCheckSegmentContinuity(segs, label = "segments") {
  if (typeof DEBUG_DART_MOVE === "undefined" || !DEBUG_DART_MOVE || !Array.isArray(segs)) return;
  const dist = (a, b) => (!a || !b) ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
  const breaks = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const gap = dist(segs[i].to, segs[i + 1].from);
    if (gap > 0.05) breaks.push({ index: i, typeA: segs[i].type, typeB: segs[i + 1].type, gap });
  }
  console.log("[continuity]", label, { count: segs.length, breaks });
}

// ── 참고선 판별: 물리 검사에서 제외할 순수 내부 연결선 ──
// dart-bridge만 조립용 내부 연결선(실제 재단 경계가 아님)이라 제외한다.
// old-dart/back-shoulder-dart/dart-leg-old는 "옛 흔적"이 아니라 현재 baked
// 결과에 남아있는 실제 패턴 경계일 수 있다(다트를 끝까지 안 닫으면 그 자리에
// 진짜로 벌어진 틈이 남는다) — 물리 검사에서 제외하면 그 틈과 겹치는 다음
// 회전을 놓친다. 그래서 더 이상 통째로 빼지 않는다.
function isReferenceSeg(seg) {
  return seg?.type === "dart-bridge";
}

// 이보다 작은 각도의 다트는 만들지 않는다 (0.5° ≈ pivot에서 20cm 거리 기준 폭
// 0.17cm). 안전각이 이 밑으로 깎였다는 건 그 위치에 회전 공간이 없다는 뜻이고,
// 그대로 적용하면 입구가 안 벌어진 퇴화 다트(같은 자리에 겹친 다리 두 개 =
// 화면에 남는 방사형 잔선)만 생긴다.
const MIN_DART_ANGLE_RAD = 0.5 * Math.PI / 180;

// 곡선 스침 허용오차(GRAZE_EPS)를 적용할 대상: ~1cm 간격 폴리라인으로 샘플링된
// 곡선 타입만. 직선(다트 다리, 허리/어깨 등)은 샘플링 오차가 없으므로 교차하면
// 그대로 진짜 겹침이다 — 여기 포함시키면 진짜 과회전을 "스침"으로 놓친다.
const CURVE_SAMPLED_TYPES = new Set([
  "back-armhole", "front-armhole-lower", "front-armhole-upper",
  "back-neckline", "front-neckline",
]);

// ── 자기교차 탐지 (물리 검사 대상만: 실제 외곽선 + 현재 열린/미완전히 닫힌 다트 다리) ──
// DEBUG 플래그와 무관하게 항상 동작 — applyDartMove에서 적용 차단 판단에도 쓰인다.
// dart-leg-new/dart-leg-old는 종이가 실제로 벌어질 수 있는 경계이므로 검사에
// 포함한다 — 빼면 다리가 외곽선(또는 다른 다트의 다리)을 관통하는 진짜 겹침을
// 못 잡는다. dart-bridge(isReferenceSeg)만 순수 조립용 내부선이라 제외한다.
// "배열 인접"이 아니라 "좌표상 끝점을 실제로 공유하는지"로 정상 연결(같은
// pivot에서 만나는 여러 다리)을 걸러낸다.
// pivot을 주면(front=BP, back=E) "기준점 앵커" 방식으로 스침을 판정한다: 다트
// 다리(dart-leg-new/dart-leg-old)의 pivot 반대쪽 끝점은 정의상 G/GG/cutPoint
// 같은 "원래 곡선과 만나도록 설계된 기준점"이다. 그 좌표들을 junctionPoints로
// 모아두면, 교차점이 "두 세그먼트 중 아무 끝점"이 아니라 "실제로 설계된 접점"
// 근처인지를 정확히 볼 수 있다 — G/GG처럼 서로 다른 곡선이 한 점에서 만나도록
// 만들어진 경우(폴리라인 샘플링으로 그 접점 자체가 흔들리는 경우)와, 전혀
// 무관한 두 곡선이 엉뚱한 곳에서 진짜로 겹친 경우(2026-07-07 실측: 부채꼴
// 다중다트 3차 이후 "필요없는 선"/"가슴다트 방향 과회전"의 원인이었음)를
// 구분해준다. pivot이 없으면(옛 호출부 호환) 예전처럼 "아무 끝점이나 가까우면
// 스침"으로 판정한다.
function findSelfIntersections(segs, pivot) {
  if (!Array.isArray(segs)) return [];
  const real = segs.filter(s => s?.from && s?.to && !isReferenceSeg(s));
  const sharesEndpoint = (a, b) => {
    const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3;
    return near(a.from, b.from) || near(a.from, b.to) || near(a.to, b.from) || near(a.to, b.to);
  };
  // 교차점이 실제 기준점(junctionPoints) 근처면 "스침"으로 보고 무시한다.
  // 곡선은 ~1cm 간격 폴리라인 샘플이라 cutPoint/G/GG가 실제 곡선 샘플보다 살짝
  // 어긋나 있고, 그 이산화 오차만으로 가짜 교차가 생긴다(실측). 이 허용오차는
  // CURVE_SAMPLED_TYPES(폴리라인 샘플 곡선)가 관련된 교차에만 적용한다 — 직선
  // 끼리의 교차는 샘플링 노이즈가 있을 수 없으므로 항상 진짜 겹침으로 취급한다.
  //
  // 두 임계값을 구분해서 쓴다: junctionPoints(기준점) 기반 판정은 pivot이 있어야
  // 가능한 더 정확한 방식이라 허용폭을 넓게(GRAZE_EPS_JUNCTION) 잡아도 안전하고,
  // pivot이 없는 옛 호출부 호환 경로("아무 끝점이나 가까우면 스침")는 오탐 폭을
  // 좁게 유지해야 하므로 그대로 GRAZE_EPS를 쓴다.
  // GRAZE_EPS_JUNCTION=0.7 근거(2026-07-07 무작위 4연속 다트 스윕 실측, 총 214건
  // 교차 샘플): 정상적으로 스쳐야 하는 경우(다트다리-곡선이 원래 만나도록 설계된
  // G/GG/cutPoint 부근)는 전부 기준점에서 0.19~0.59cm 안에 몰려 있었고, 실제
  // 겹침(예: front-armhole-lower×side-seam, 서로 다른 곡선이 엉뚱한 곳에서 교차)은
  // 전부 1.5cm 이상이었다 — 그 사이에 값이 하나도 없어 0.7cm면 안전하게 갈린다.
  const GRAZE_EPS = 0.2;
  const GRAZE_EPS_JUNCTION = 0.7;
  const DART_LEG_TYPES = new Set(["dart-leg-new", "dart-leg-old"]);
  let junctionPoints = null;
  if (pivot) {
    junctionPoints = real
      .filter(s => DART_LEG_TYPES.has(s.type))
      .map(s => {
        const dFrom = Math.hypot(s.from.x - pivot.x, s.from.y - pivot.y);
        const dTo   = Math.hypot(s.to.x   - pivot.x, s.to.y   - pivot.y);
        return dFrom > dTo ? s.from : s.to; // pivot 반대쪽(먼) 끝 = G/GG/cutPoint
      });
  }
  const intersectionPoint = (a, b) => {
    const r = { x: a.to.x - a.from.x, y: a.to.y - a.from.y };
    const s = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < 1e-12) return null;
    const t = ((b.from.x - a.from.x) * s.y - (b.from.y - a.from.y) * s.x) / denom;
    return { x: a.from.x + t * r.x, y: a.from.y + t * r.y };
  };
  const isGraze = (a, b) => {
    if (!CURVE_SAMPLED_TYPES.has(a.type) && !CURVE_SAMPLED_TYPES.has(b.type)) return false;
    const pt = intersectionPoint(a, b);
    if (!pt) return false;
    const d = (q) => Math.hypot(pt.x - q.x, pt.y - q.y);
    if (junctionPoints) return junctionPoints.some(jp => d(jp) < GRAZE_EPS_JUNCTION);
    return d(a.from) < GRAZE_EPS || d(a.to) < GRAZE_EPS ||
           d(b.from) < GRAZE_EPS || d(b.to) < GRAZE_EPS;
  };
  const crossings = [];
  for (let i = 0; i < real.length; i++) {
    for (let j = i + 1; j < real.length; j++) {
      if (sharesEndpoint(real[i], real[j])) continue;
      if (segmentsCross(real[i], real[j]) && !isGraze(real[i], real[j])) {
        crossings.push({ i, j, typeA: real[i].type, typeB: real[j].type });
      }
    }
  }
  return crossings;
}

// ── 회전 충돌 검사: "회전으로 새로 생기는" 겹침만 본다 ──────────────
// 강체 회전은 같은 조각 내부의 상대 기하를 보존하므로, 조각 내부끼리의 교차
// 상태는 회전으로 절대 바뀌지 않는다 — 내부 교차는 전부 원본부터 있던 것이거나
// 접선 상태의 부동소수점 노이즈다(실측: 저장된 진동하부 곡선이 옆선과 거의
// 접해 있어, 같은 조각인 두 선의 "교차 여부"가 회전 각도에 따라 FP 노이즈로
// 나타났다 사라졌다 하며 안전각을 0으로 오판 → 멀쩡한 1차 다트까지 차단됐던
// 회귀). 그래서 회전 한계/적용 차단 판단은 [고정 조각 ∪ 고정쪽 다트다리] ×
// [회전 조각 ∪ 회전쪽 다트다리] 쌍만 검사한다. 스침(graze) 판정은
// findSelfIntersections와 동일한 기준점(junction) 방식.
function findRotationCollisions(fixedSegsIn, rotateSegsIn, pivot, angle) {
  const clean = (arr) => (arr || []).filter(s => s?.from && s?.to && !isReferenceSeg(s));
  const fixedC  = clean(fixedSegsIn);
  const rotateC = clean(rotateSegsIn);
  if (fixedC.length === 0 || rotateC.length === 0) return [];

  const rotP = (pt) => rotatePt(pt, pivot, angle);
  const fix = fixedC.map(s => ({ ...s }));
  const rot = rotateC.map(s => ({ ...s, from: rotP(s.from), to: rotP(s.to) }));

  // 다트 입구의 두 변(고정쪽: pivot→cutPoint, 회전쪽: pivot→회전된 cutPoint)도
  // 실제 종이 경계이므로 상대편 조각과의 충돌 검사에 포함한다.
  const cutFixed = fixedC[0].from;
  const cutRot   = rotP(rotateC[0].from);
  fix.push({ type: "dart-leg-new", from: { ...pivot }, to: { ...cutFixed } });
  rot.push({ type: "dart-leg-new", from: { ...pivot }, to: { ...cutRot } });

  // 기준점(junction): 양쪽의 다트다리 mouth + 입구 양끝 — 여기 근처의 곡선 스침은
  // 설계상 만나는 점의 샘플링 오차이므로 무시(findSelfIntersections와 동일 기준).
  const DL = new Set(["dart-leg-new", "dart-leg-old"]);
  const junctions = [];
  for (const s of [...fix, ...rot]) {
    if (!DL.has(s.type)) continue;
    const dFrom = Math.hypot(s.from.x - pivot.x, s.from.y - pivot.y);
    const dTo   = Math.hypot(s.to.x   - pivot.x, s.to.y   - pivot.y);
    junctions.push(dFrom > dTo ? s.from : s.to);
  }

  const GRAZE_EPS_J = 0.7;
  const sharesEndpoint = (a, b) => {
    const near = (p, q) => Math.hypot(p.x - q.x, p.y - q.y) < 1e-3;
    return near(a.from, b.from) || near(a.from, b.to) || near(a.to, b.from) || near(a.to, b.to);
  };
  const intersectionPoint = (a, b) => {
    const r = { x: a.to.x - a.from.x, y: a.to.y - a.from.y };
    const s = { x: b.to.x - b.from.x, y: b.to.y - b.from.y };
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < 1e-12) return null;
    const t = ((b.from.x - a.from.x) * s.y - (b.from.y - a.from.y) * s.x) / denom;
    return { x: a.from.x + t * r.x, y: a.from.y + t * r.y };
  };
  const isGraze = (a, b) => {
    if (!CURVE_SAMPLED_TYPES.has(a.type) && !CURVE_SAMPLED_TYPES.has(b.type)) return false;
    const pt = intersectionPoint(a, b);
    if (!pt) return false;
    return junctions.some(jp => Math.hypot(pt.x - jp.x, pt.y - jp.y) < GRAZE_EPS_J);
  };

  const collisions = [];
  for (const a of fix) {
    for (const b of rot) {
      if (sharesEndpoint(a, b)) continue;
      if (segmentsCross(a, b) && !isGraze(a, b)) {
        collisions.push({ typeA: a.type, typeB: b.type });
      }
    }
  }
  return collisions;
}

// ── 2단 검증 구조 ──────────────────────────────
// 1층: 전체 세그먼트 연결성 (아래 1~4번) — dart-bridge를 포함한 전체를 본다.
//   이 선들은 평면 패턴 상태의 진짜 절개선(닫히기 전 다트는 실제로 그 지점까지
//   잘려 들어가 있음)이라 폐곡선 조립(bakeFromSplitPieces)에서 빠지면 안 되고,
//   여기서도 빠지면 안 된다 — 데이터가 실제로 하나의 닫힌 체인인지 확인하는 층.
// 2층: 물리 외곽선 검증 (findSelfIntersections, 5번) — dart-bridge만 뺀 진짜
//   절개 외곽선(+ 다트 다리 전부)의 자기교차를 본다. 노치가 근처 곡선을 스치는
//   건 정상 기하이지 겹침이 아니므로, "이어져 있는가"(1층)와 "물리적으로
//   겹치는가"(2층)를 다른 세그먼트 집합으로 따로 판단해야 한다.
function validateBakedSegments(segs, label, pivot) {
  if (typeof DEBUG_DART_MOVE === 'undefined' || !DEBUG_DART_MOVE) return;
  if (!Array.isArray(segs)) {
    console.warn(`[validate] ${label} 검증 실패: segs가 배열이 아님`, segs);
    return;
  }
  console.log(`\n[validate] ${label} 적용 검증`);

  // 1. 연속성 (1층 — 참고선 포함 전체)
  let breaks = 0;
  for (let i = 0; i < segs.length - 1; i++) {
    if (!segs[i]?.to || !segs[i+1]?.from) { breaks++; continue; }
    const d = Math.hypot(segs[i].to.x - segs[i+1].from.x, segs[i].to.y - segs[i+1].from.y);
    if (d > 1e-2) breaks++;
  }
  console.log(`  ${breaks === 0 ? '✅' : '❌'} 연속성 (breaks: ${breaks})`);

  // 2. 전체 루프 완결성
  if (segs.length > 0) {
    const first = segs[0].from;
    const last  = segs[segs.length - 1].to;
    const gap   = (first && last) ? Math.hypot(first.x - last.x, first.y - last.y) : Infinity;
    console.log(`  ${gap < 1e-2 ? '✅' : '❌'} 전체 루프 완결성 (gap: ${gap.toFixed(2)}cm)`);
  } else {
    console.log(`  ❌ 전체 루프 완결성 검사 불가: segs 없음`);
  }

  // 3. dart-leg-new 개수 (2개 이상 + 2의 배수)
  const legCount = segs.filter(s => s.type === 'dart-leg-new').length;
  const legOK = legCount >= 2 && legCount % 2 === 0;
  console.log(`  ${legOK ? '✅' : '❌'} dart-leg-new: ${legCount}개 (다트 ${legCount/2}개)`);

  // 4. dartId별 다리쌍
  const byId = {};
  segs.filter(s => s.type === 'dart-leg-new' && s.dartId)
      .forEach(s => byId[s.dartId] = (byId[s.dartId] || 0) + 1);
  const idEntries = Object.entries(byId);
  if (idEntries.length > 0) {
    const allPairs = idEntries.every(([, c]) => c === 2);
    console.log(`  ${allPairs ? '✅' : '❌'} dartId별 다리쌍 (${idEntries.map(([id,c]) => c).join(',')})`);
  }

  // 5. 자기교차
  const crossings = findSelfIntersections(segs, pivot);
  console.log(`  ${crossings.length === 0 ? '✅' : '❌'} 자기교차 없음 (${crossings.length}건)`,
    crossings.length ? crossings.slice(0, 5) : '');
}

function bakeFromSplitPieces({ fixedSegs, rotateSegs, pivot, angle }) {
  // 외곽선 판별 (다트선 제외)
  const _isOutlineSeg = (s) => s?.from && s?.to &&
    s.type !== "dart-leg" && s.type !== "dart-leg-new" &&
    s.type !== "dart-leg-old" && s.type !== "dart-bridge";

  const safeFixedAll  = (Array.isArray(fixedSegs)  ? fixedSegs  : []).filter(s => s?.from && s?.to);
  const safeRotateAll = (Array.isArray(rotateSegs) ? rotateSegs : []).filter(s => s?.from && s?.to);

  if (safeFixedAll.length === 0 || safeRotateAll.length === 0) {
    console.warn("[bakeFromSplitPieces] invalid input", {
      fixedLen: safeFixedAll.length, rotateLen: safeRotateAll.length,
    });
    return [];
  }

  const rotPt = (pt) => {
    if (!pt) return null;
    if (Math.abs(angle) < 1e-8) return { ...pt };
    const dx = pt.x - pivot.x, dy = pt.y - pivot.y;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    return { x: pivot.x + dx*cos - dy*sin, y: pivot.y + dx*sin + dy*cos };
  };
  const cloneCleanSeg = (seg) => ({ ...seg, from: { ...seg.from }, to: { ...seg.to } });
  const rotateSeg     = (seg) => ({ ...seg, from: rotPt(seg.from), to: rotPt(seg.to) });
  const reverseSegL   = (seg) => ({ ...seg, from: { ...seg.to }, to: { ...seg.from } });

  // 시퀀스 전체(기존 다트선 포함)를 순서 그대로 처리 — fixed는 그대로, rotate는 통째로 회전
  const segsAFull = safeFixedAll.map(cloneCleanSeg);
  const segsBFull = safeRotateAll.map(rotateSeg);

  const cutA = segsAFull[0].from;
  const cutB = segsBFull[0].from;

  // 각 조각의 "외곽선 마지막 인덱스" 찾기 (그 뒤에 붙은 다트선은 trailing dart로 분리)
  let outlineEndIdxA = -1;
  for (let i = segsAFull.length - 1; i >= 0; i--) { if (_isOutlineSeg(segsAFull[i])) { outlineEndIdxA = i; break; } }
  let outlineEndIdxB = -1;
  for (let i = segsBFull.length - 1; i >= 0; i--) { if (_isOutlineSeg(segsBFull[i])) { outlineEndIdxB = i; break; } }

  // trailing은 "꼬리의 다트선 뭉치가 실제로 pivot에 닿아서 끝나는" 경우에만 유효하다
  // (이미 열린 다트 입구로 자연스럽게 이어지는 경우). splitBakedOutline의 dartId 보정으로
  // rest에 편입된, 이 bake와 무관한 과거 다트 쌍이 배열 꼬리에 붙어 있을 수 있는데 그건
  // pivot에 닿지 않고 끝난다 — 그런 경우 trailing으로 착각해 떼어내면 그 뒤에 이 bake
  // 자신의 새 legOld를 이어붙이면서 서로 무관한 두 다트가 연결점 없이 맞닿아 끊김/자기교차가
  // 생긴다. pivot에 안 닿으면 trailing이 아니라 그냥 이 조각의 일반 외곽선 내용으로 본다.
  const _tailReachesPivot = (fullArr) => {
    const last = fullArr[fullArr.length - 1]?.to;
    return last && Math.hypot(last.x - pivot.x, last.y - pivot.y) < 1e-3;
  };
  if (outlineEndIdxA >= 0 && outlineEndIdxA < segsAFull.length - 1 && !_tailReachesPivot(segsAFull)) {
    outlineEndIdxA = segsAFull.length - 1;
  }
  if (outlineEndIdxB >= 0 && outlineEndIdxB < segsBFull.length - 1 && !_tailReachesPivot(segsBFull)) {
    outlineEndIdxB = segsBFull.length - 1;
  }

  if (outlineEndIdxA < 0 || outlineEndIdxB < 0) {
    console.warn("[bakeFromSplitPieces] no outline segment found", { outlineEndIdxA, outlineEndIdxB });
    return [...segsAFull, ...segsBFull];
  }

  const endA = segsAFull[outlineEndIdxA].to;
  const endB = segsBFull[outlineEndIdxB].to;

  // 외곽선 구간 / 그 뒤에 자연스럽게 붙어있던 기존 다트선(trailing) 분리
  const segsA_outline = segsAFull.slice(0, outlineEndIdxA + 1);
  const segsA_trailing = segsAFull.slice(outlineEndIdxA + 1);
  const segsB_outline = segsBFull.slice(0, outlineEndIdxB + 1);
  const segsB_trailing = segsBFull.slice(outlineEndIdxB + 1);

  // ── TEMP DEBUG: old-leg fallback 진단 (원인 확정되면 제거) ──
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log("[bake old-leg check]", {
      outlineEndIdxA,
      outlineEndIdxB,
      endA: { x: +endA.x.toFixed(3), y: +endA.y.toFixed(3) },
      endB: { x: +endB.x.toFixed(3), y: +endB.y.toFixed(3) },
      endAType: segsAFull[outlineEndIdxA]?.type,
      endBType: segsBFull[outlineEndIdxB]?.type,
      trailingA: segsA_trailing.map(s => s.type),
      trailingB: segsB_trailing.map(s => s.type),
      willCreateLegOldA: segsA_trailing.length === 0 && Math.hypot(endA.x - pivot.x, endA.y - pivot.y) > 1e-3,
      willCreateLegOldB: segsB_trailing.length === 0 && Math.hypot(endB.x - pivot.x, endB.y - pivot.y) > 1e-3,
    });
  }

  const dartId = `dart-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 새 V자 다트: pivot → cutA, cutB → pivot (입구=cut*, 꼭지점=pivot)
  const legOut = { type: "dart-leg-new", role: "dart-leg", dartId, pair: "A",
                   from: { ...pivot }, to: { ...cutA }, disabled: true };
  const legIn  = { type: "dart-leg-new", role: "dart-leg", dartId, pair: "B",
                   from: { ...cutB }, to: { ...pivot }, disabled: true };

  // 기존 다트 잔여선: trailing이 없을 때만 새로 생성 (있으면 원래 다트선을 그대로 사용)
  const legOldA = { type: "dart-leg-old", role: "dart-leg-old", dartId, pair: "oldA",
                    from: { ...endA }, to: { ...pivot }, disabled: true };
  const legOldB = { type: "dart-leg-old", role: "dart-leg-old", dartId, pair: "oldB",
                    from: { ...pivot }, to: { ...endB }, disabled: true };

  // 폐곡선: pivot → cutA → segsA_outline → endA → (trailing 또는 legOldA) →
  //         (trailing 또는 legOldB) → endB → reversed(segsB_outline) → cutB → pivot
  const finalSegments = [legOut, ...segsA_outline];

  if (segsA_trailing.length > 0) {
    finalSegments.push(...segsA_trailing);
  } else if (Math.hypot(endA.x - pivot.x, endA.y - pivot.y) > 1e-3) {
    finalSegments.push(legOldA);
  }

  if (segsB_trailing.length > 0) {
    finalSegments.push(...segsB_trailing.slice().reverse().map(reverseSegL));
  } else if (Math.hypot(endB.x - pivot.x, endB.y - pivot.y) > 1e-3) {
    finalSegments.push(legOldB);
  }

  finalSegments.push(...segsB_outline.slice().reverse().map(reverseSegL), legIn);

  return finalSegments;
}

// ── 다트 다리 타입 판별 / 클릭 가능 판별 ─────────
// ── G점을 BP 중심으로 회전시켜 GG(가슴다트 닫힌 위치) 계산 ──
// buildFrontOutline의 GG 산출 공식과 동일 (B/4 - 2.5도 회전)
function calcCloseAngle(p, B) {
  const vx = p.BP.x - p.G.x, vy = p.BP.y - p.G.y;
  const len = Math.hypot(vx, vy) || 1;
  const ux = -vx / len, uy = -vy / len;
  const da = (B / 4 - 2.5) * Math.PI / 180;
  const GG = {
    x: p.BP.x + (ux * Math.cos(da) - uy * Math.sin(da)) * len,
    y: p.BP.y + (ux * Math.sin(da) + uy * Math.cos(da)) * len,
  };
  return { GG };
}

function isDartLegType(seg) {
  return seg?.type === "dart-leg" || seg?.type === "dart-leg-new" || seg?.type === "dart-leg-old";
}
function isClickableSeg(seg) {
  return !seg.disabled && !isDartLegType(seg) && seg.type !== "dart-bridge";
}

// ── bakedSegments용 split ────────────────────
function isBakedBoundarySeg(seg) {
  return seg?.type === "dart-leg" ||
         seg?.type === "dart-leg-new" ||
         seg?.type === "dart-leg-old" ||
         seg?.type === "dart-bridge";
}

function splitBakedOutline(segments, cutPoint, cutSegIndex, pivot) {
  const nn = segments.length;
  if (nn === 0) return { pieceA: null, pieceB: null };

  // ── TEMP DEBUG: pivot 접점 진단 (원인 확정되면 제거) ──
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log(`[pivotCheck] cutSegIndex:${cutSegIndex} nn:${nn} pivot:`, JSON.stringify(pivot));
    segments.forEach((s, i) => {
      if (!s?.from || !s?.to) return;
      const dFrom = Math.hypot(s.from.x - pivot.x, s.from.y - pivot.y);
      const dTo   = Math.hypot(s.to.x   - pivot.x, s.to.y   - pivot.y);
      if (dFrom < 0.5 || dTo < 0.5) {
        console.log(`[pivotCheck] idx${i} ${s.type} disabled:${!!s.disabled} dFrom:${dFrom.toFixed(4)} dTo:${dTo.toFixed(4)}`);
      }
    });
  }

  const isNear = (a, b, eps = 1e-3) => a && b && Math.hypot(a.x-b.x, a.y-b.y) < eps;
  const isPivot = (pt) => isNear(pt, pivot);
  const segTouchesPivot = (seg) => isPivot(seg?.from) || isPivot(seg?.to);
  // 다중다트 상태에서는 dart-leg가 pivot→mouth, mouth→pivot 양방향으로 모두 존재한다.
  // segTouchesPivot 하나로는 방향을 구분 못 해 "pivot에서 출발하는" 세그먼트까지
  // 포함하고 지나쳐버릴 수 있으므로, forward/backward 각각 진행 방향 기준
  // "도착"(포함하고 정지)과 "출발"(포함하지 않고 정지)을 구분한다.

  // 1. forward: cutSegIndex 자신부터 시작해 첫 pivot 도달까지 (뒷부분, cutSegIndex 세그먼트 포함)
  // ── TEMP DEBUG: cutSegIndex 세그먼트 확인 (ChatGPT 지시서, 확인 후 제거) ──
  const cutSeg = segments[cutSegIndex];
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE && cutSeg) {
    const dFrom = Math.hypot(cutPoint.x - cutSeg.from.x, cutPoint.y - cutSeg.from.y);
    const dTo   = Math.hypot(cutPoint.x - cutSeg.to.x,   cutPoint.y - cutSeg.to.y);
    const segLen = Math.hypot(cutSeg.to.x - cutSeg.from.x, cutSeg.to.y - cutSeg.from.y);
    console.log("[cutSegCheck]", {
      cutSegIndex,
      type: cutSeg.type,
      disabled: !!cutSeg.disabled,
      from: { x: +cutSeg.from.x.toFixed(3), y: +cutSeg.from.y.toFixed(3) },
      to:   { x: +cutSeg.to.x.toFixed(3),   y: +cutSeg.to.y.toFixed(3) },
      cutPoint: { x: +cutPoint.x.toFixed(3), y: +cutPoint.y.toFixed(3) },
      dFrom: +dFrom.toFixed(3),
      dTo: +dTo.toFixed(3),
      segLen: +segLen.toFixed(3),
      ratioFrom: segLen > 1e-6 ? +(dFrom / segLen).toFixed(3) : null,
      ratioTo:   segLen > 1e-6 ? +(dTo / segLen).toFixed(3) : null,
    });
  }

  let forwardSteps = 0;
  for (let step = 0; step < nn; step++) {
    const idx = (cutSegIndex + step) % nn;
    const seg = segments[idx];
    // seg.from이 pivot이면 이전 세그먼트 끝에서 이미 pivot에 도착한 것 —
    // 이 세그먼트(pivot→mouth, 출발)는 포함하지 않고 여기서 멈춘다.
    if (isPivot(seg?.from)) break;
    forwardSteps++;
    // seg.to가 pivot이면 이 세그먼트(mouth→pivot, 도착)에서 정지 — 포함하고 멈춘다.
    if (isPivot(seg?.to)) break;
  }

  // 3. backward: 독립 탐색 — cutSegIndex 세그먼트의 from쪽 절반(cutPoint→seg.from)부터
  //    역방향으로 걸으며 첫 pivot 접점 세그먼트에서 정지 (forward와 대칭).
  //    forward는 cutSegIndex의 to쪽 절반(cutPoint→seg.to)을 담으므로,
  //    backward가 from쪽 절반을 담아야 cutPoint가 두 조각의 공유 꼭짓점이 되고 빈틈이 없다.
  //    (1차 splitFrontOutline의 walkBackward 555행과 동일한 원리)
  //    단, cutSegIndex 세그먼트가 boundary(dart-leg)면 반쪽 분할이 무의미하므로
  //    cutSegIndex를 forward에만 두고 backward는 cutSegIndex-1부터 시작한다.
  const cutSegIsBoundary = isBakedBoundarySeg(segments[cutSegIndex]);
  const backStart = cutSegIsBoundary ? cutSegIndex - 1 : cutSegIndex;
  const maxBackward = cutSegIsBoundary ? (nn - forwardSteps) : (nn - forwardSteps + 1);
  let backwardSteps = 0;
  for (let step = 0; step < maxBackward; step++) {
    const idx = (backStart - step + nn) % nn;
    const seg = segments[idx];
    // cutSegIndex 세그먼트(backward 첫 스텝, non-boundary)는 pivot 정지 판정에서 제외
    // (cutPoint→seg.from 반쪽이라 pivot에 안 닿음)
    const skipPivotCheck = (step === 0 && !cutSegIsBoundary);
    // backward는 원본 세그먼트를 reverse해서 쓰므로 방향이 뒤집힌다:
    // 원본 seg.to가 pivot이면 reverse 시 pivot에서 출발하는 세그먼트 — 포함하지 않고 멈춘다.
    if (!skipPivotCheck && isPivot(seg?.to)) break;
    backwardSteps++;
    // 원본 seg.from이 pivot이면 reverse 시 pivot에 도착하는 세그먼트 — 포함하고 멈춘다.
    if (!skipPivotCheck && isPivot(seg?.from)) break;
  }

  // ── dartId 짝 보정: forward/backward가 같은 dartId의 다리를 서로 다른 영역으로
  // 쪼개면(한쪽만 로컬 조각 segsA/segsB에, 나머지는 rest에) 그 다트의 노치가
  // 물리적으로 찢어진다 (한쪽만 회전하고 반대쪽은 고정된 채 남음).
  // → 쪼개진 dartId 그룹은 통째로 rest(항상-고정 영역)로 넘긴다. 절대 반대 방향
  //   (rest → segsA/segsB로 끌어올림)으로는 확장하지 않는다 — 예전에 그 방식으로
  //   시도했다가 restSteps 회계가 깨져 외곽선이 중복 생성된 적이 있음.
  //
  // 단, "가장 최근에 생긴 dartId"는 이 보정에서 제외한다. dart-leg-new(pair A/B)는
  // "이미 닫힌 노치"가 아니라 지금 열려 있는 다트 입구이고, 다음 세대가 한쪽은
  // 회전·한쪽은 고정시켜 서로 붙게 만드는 것 자체가 "다트를 닫는" 동작이다.
  // 최신 dartId까지 강제로 rest에 묶으면 그 다트를 영영 닫을 방법이 없어지고,
  // bakeFromSplitPieces가 억지로 만들어내는 가짜 봉합선(불필요한 선/갈 수 없는
  // 위치로의 이동)의 원인이 된다. dartId에 타임스탬프가 박혀 있으므로 최댓값을
  // "현재 진행 중인 다트"로 보고 보정 대상에서 뺀다.
  let forwardStepsBeforeFix = forwardSteps;
  {
    const regionOf = new Array(nn).fill('rest');
    for (let step = 0; step < forwardSteps; step++) regionOf[(cutSegIndex + step) % nn] = 'A';
    for (let step = 0; step < backwardSteps; step++) regionOf[(backStart - step + nn) % nn] = 'B';

    const dartGroups = {};
    segments.forEach((seg, idx) => {
      if (!seg?.dartId || !isBakedBoundarySeg(seg)) return;
      (dartGroups[seg.dartId] ||= []).push(idx);
    });

    let latestDartId = null, latestTs = -Infinity;
    for (const id of Object.keys(dartGroups)) {
      const ts = parseInt(id.split('-')[1], 10);
      if (!isNaN(ts) && ts > latestTs) { latestTs = ts; latestDartId = id; }
    }

    const forceRest = new Set();
    for (const [dartId, idxs] of Object.entries(dartGroups)) {
      if (dartId === latestDartId) continue; // 방금 만든 다트는 쪼개져서 닫히는 게 정상 동작
      const regionSet = new Set(idxs.map(i => regionOf[i]));
      if (regionSet.size > 1) idxs.forEach(i => forceRest.add(i));
    }

    if (forceRest.size > 0) {
      let trimmedForward = 0;
      for (let step = 0; step < forwardSteps; step++) {
        if (forceRest.has((cutSegIndex + step) % nn)) break;
        trimmedForward++;
      }
      let trimmedBackward = 0;
      for (let step = 0; step < backwardSteps; step++) {
        if (forceRest.has((backStart - step + nn) % nn)) break;
        trimmedBackward++;
      }
      if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
        console.log('[dartGroupFix] 갈라진 dartId 발견 → rest로 편입', {
          forceRest: [...forceRest],
          forwardSteps: `${forwardSteps} → ${trimmedForward}`,
          backwardSteps: `${backwardSteps} → ${trimmedBackward}`,
        });
      }
      forwardSteps  = trimmedForward;
      backwardSteps = trimmedBackward;
    }
  }
  const forwardTrimDelta = forwardStepsBeforeFix - forwardSteps; // restSteps 회계 보정용
  const restSteps = (maxBackward - backwardSteps) + forwardTrimDelta; // 양쪽 국소 조각 사이의 "항상 고정" 영역

  // 2. pieceA: forward 구간 (dartId 보정이 끝난 forwardSteps 기준으로 구성)
  // segs: 외곽선 + boundary(다트선) 모두 순서대로 포함 (bakeFromSplitPieces가 trailing dart로 인식)
  const segsA = [], ptsA = [{ ...cutPoint }];
  for (let step = 0; step < forwardSteps; step++) {
    const idx = (cutSegIndex + step) % nn;
    const seg = segments[idx];
    if (isBakedBoundarySeg(seg)) {
      segsA.push({ ...seg, from: { ...seg.from }, to: { ...seg.to }, type: seg.type, disabled: !!seg.disabled });
      ptsA.push({ ...seg.to });
      continue;
    }
    const fromPt = segsA.length === 0 ? { ...cutPoint } : { ...seg.from };
    segsA.push({ ...seg, from: fromPt, to: { ...seg.to }, type: seg.type, disabled: !!seg.disabled });
    ptsA.push({ ...seg.to });
  }

  const segsB = [], ptsB = [{ ...cutPoint }];
  for (let step = 0; step < backwardSteps; step++) {
    const idx = (backStart - step + nn) % nn;
    const seg = segments[idx];
    const revSeg = { from: { ...seg.to }, to: { ...seg.from }, type: seg.type };
    // 첫 스텝: from을 cutPoint로 교체. non-boundary cutSegIndex면 to=seg.from(반쪽),
    //          boundary거나 이후 스텝이면 revSeg 그대로.
    const fromPt = segsB.length === 0 ? { ...cutPoint } : { ...revSeg.from };
    segsB.push({ ...seg, from: fromPt, to: { ...revSeg.to }, type: seg.type, disabled: !!seg.disabled });
    ptsB.push({ ...revSeg.to });
  }

  // 4. segsFull: bake용 전체 체인 (국소 조각 + rest 영역)
  // 회전 조각은 국소(segs)만 돌고, 고정 조각은 rest까지 포함한 전체(segsFull)를 사용해야
  // 루프 완결성이 유지된다. rest는 어느 조각을 돌리든 절대 움직이지 않는 영역.
  const segsAFull = segsA.map(s => ({ ...s, from: { ...s.from }, to: { ...s.to }, type: s.type, disabled: !!s.disabled }));
  for (let step = forwardSteps; step < forwardSteps + restSteps; step++) {
    const idx = (cutSegIndex + step) % nn;
    const seg = segments[idx];
    segsAFull.push({ ...seg, from: { ...seg.from }, to: { ...seg.to }, type: seg.type, disabled: !!seg.disabled });
  }
  const segsBFull = segsB.map(s => ({ ...s, from: { ...s.from }, to: { ...s.to }, type: s.type, disabled: !!s.disabled }));
  // maxBackward가 아니라 restSteps 기준으로 순회해야 한다: dartId 보정으로
  // forward 쪽에서 rest로 밀려난 분량(forwardTrimDelta)까지 segsBFull이 놓치지 않고
  // 포함해야 fixedSegs로 쓰였을 때 루프가 끊기지 않는다.
  for (let step = backwardSteps; step < backwardSteps + restSteps; step++) {
    const idx = (backStart - step + nn) % nn;
    const seg = segments[idx];
    segsBFull.push({ ...seg, from: { ...seg.to }, to: { ...seg.from }, type: seg.type, disabled: !!seg.disabled });
  }

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log('[splitBaked] A:', segsA.length, 'B:', segsB.length, 'rest:', restSteps,
      'fwd:', forwardSteps, 'bwd:', backwardSteps, 'nn:', nn,
      '합(A+B+rest):', forwardSteps + backwardSteps + restSteps);
  }

  // pts polygon 닫기: openPts가 이미 boundary(dart-leg)를 따라 pivot에 도달했으면
  // pivot을 중복으로 덧붙이지 않는다. (덧붙이면 실제 종이 조각과 어긋난 삼각형이 생김)
  // boundary를 못 만나고 끝난 경우에만 pivot으로 직접 닫는다.
  const closePolygonPts = (openPts) => {
    const last = openPts[openPts.length - 1];
    const reachedPivot = last && Math.hypot(last.x - pivot.x, last.y - pivot.y) < 1e-3;
    return reachedPivot
      ? [...openPts, { ...cutPoint }]
      : [...openPts, { ...pivot }, { ...cutPoint }];
  };

  const pieceA = { pts: closePolygonPts(ptsA), segs: segsA, segsFull: segsAFull, hit: "mouthA", openPts: ptsA };
  const pieceB = { pts: closePolygonPts(ptsB), segs: segsB, segsFull: segsBFull, hit: "mouthB", openPts: ptsB };

  // ── TEMP DEBUG: piece polygon 진단 (ChatGPT 지시서, 원인 확정되면 제거) ──
  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    const fmtPt = p => p ? { x: +p.x.toFixed(2), y: +p.y.toFixed(2) } : null;
    console.log("[splitBaked piece summary]", {
      cutSegIndex,
      nn,
      pivot: fmtPt(pivot),
      cutPoint: fmtPt(cutPoint),
      pieceA_len: ptsA.length,
      pieceB_len: ptsB.length,
      pieceA_area: polygonArea(pieceA.pts).toFixed(2),
      pieceB_area: polygonArea(pieceB.pts).toFixed(2),
      pieceA_last: fmtPt(ptsA[ptsA.length - 1]),
      pieceB_last: fmtPt(ptsB[ptsB.length - 1]),
      rest: restSteps,
      segsAFull_len: segsAFull.length,
      segsBFull_len: segsBFull.length,
      segsA_types: segsA.map(s => s.type).join(" → "),
      segsB_types: segsB.map(s => s.type).join(" → "),
    });
    console.log("[splitBaked pieceA pts]", pieceA.pts.map(fmtPt));
    console.log("[splitBaked pieceB pts]", pieceB.pts.map(fmtPt));
  }

  return { pieceA, pieceB };
}

// ── 물리적 닫힘 부호 결정 ───────────────────────
// 결정적 기하 판정: rotatePts는 cutPoint에서 시작해 회전 조각의 외곽선을 따라
// 걷는 점들이므로, cutPoint 직후의 점이 pivot 기준 어느 각도 방향에 있는지
// (외적 부호)가 곧 "조각 본체가 있는 쪽"이다. 잘린 변이 자기 본체 쪽으로 쓸려
// 들어가는 방향으로 회전해야 고정 조각과의 사이가 벌어진다(다트 열림).
//
// 예전 방식(cutPoint를 ±0.01rad 돌린 샘플 점의 pointInPolygon 검사)은 얇은
// 부채꼴 조각에서 두 방향 모두 폴리곤 밖으로 나가 무게중심 거리 추측으로
// 떨어졌고(실측: 다중다트 3차 이후 무작위 108건 중 상당수가 이 CENTROID 분기),
// 그 추측이 틀리면 회전이 몸판 쪽으로 파고들었다 — "어쩔 때는 맞고 어쩔 때는
// 틀리다"로 관측된 간헐 오류의 직접 원인.
function choosePhysicalCloseAngle({ pivot, cutPoint, rotatePts, absAngle }) {
  const a = Math.abs(absAngle);
  if (a < 1e-9 || !rotatePts || rotatePts.length < 3 || !cutPoint) return a;
  const vx = cutPoint.x - pivot.x, vy = cutPoint.y - pivot.y;
  // cutPoint(=rotatePts[0]) 이후의 점들 중, cut 방사선과 유의미하게 벌어진 첫
  // 점을 찾는다 (초반 점들이 방사선과 거의 평행하면 부호 판정이 불안정하므로 skip).
  for (let k = 1; k < rotatePts.length; k++) {
    const wx = rotatePts[k].x - pivot.x, wy = rotatePts[k].y - pivot.y;
    const cross = vx * wy - vy * wx;
    const scale = Math.hypot(vx, vy) * Math.hypot(wx, wy);
    if (scale > 1e-12 && Math.abs(cross) > 1e-4 * scale) {
      // rotatePt의 양(+)의 각도는 cross>0 쪽으로 움직인다 (좌표계 무관, 정의상 일치)
      return cross > 0 ? a : -a;
    }
  }
  // 퇴화(외곽선 전체가 cut 방사선상에 놓임): 기존 샘플 방식으로 폴백
  const testPlus  = rotatePt(cutPoint, pivot,  0.01);
  const testMinus = rotatePt(cutPoint, pivot, -0.01);
  const inPlus  = pointInPolygon(testPlus,  rotatePts);
  const inMinus = pointInPolygon(testMinus, rotatePts);
  if (inPlus && !inMinus) return a;
  if (!inPlus && inMinus) return -a;
  let cx = 0, cy = 0;
  for (const pt of rotatePts) { cx += pt.x; cy += pt.y; }
  cx /= rotatePts.length; cy /= rotatePts.length;
  const dPlus  = Math.hypot(testPlus.x  - cx, testPlus.y  - cy);
  const dMinus = Math.hypot(testMinus.x - cx, testMinus.y - cy);
  return dPlus < dMinus ? a : -a;
}

// ── 회전 가능한 최대 각도: 기본 다트량 각도와 "자기교차 없이 가능한 최대각" 중 작은 쪽 ──
// 사용자는 손으로 정확한 지점을 맞출 필요가 없어야 한다 — 끝까지 밀면 시스템이
// 물리적으로 가능한 위치에서 알아서 멈춰야 한다. targetAngle(부호 검증된 기본
// 다트량 각도)까지 겹치지 않으면 그대로 반환하고, 겹치면 0(항상 안전, 회전 없음)과
// targetAngle 사이에서 겹치기 직전 각도를 찾는다.
//
// 끝점(0°/targetAngle)만 보고 이분탐색하면 안 된다 — 실측(2026-07-07, 부채꼴
// 다중다트 3~4차)으로 회전 경로 중간에서만 자기교차가 생겼다 사라지는(비단조)
// 경우를 확인했다: 0%/40%/... 지점은 안전한데 10%, 65~75% 지점에서만 진짜로
// 겹쳤다. 끝점만 확인하는 이분탐색은 이런 "중간에서만 겹침"을 완전히 놓치고
// targetAngle 전체를 안전하다고 잘못 반환한다 — 이게 "가슴다트 방향으로 회전할
// 때만 오버해서 회전한다"는 증상의 실제 원인이었다. 그래서 경로 전체를 촘촘히
// 스캔해서 "처음 겹치는 각도"를 찾은 뒤, 그 직전 구간에서만 이분탐색으로
// 정밀도를 높인다.
// ── 회전 다리의 각도 배리어 ────────────────────────────────
// 회전하는 조각의 mouth 다리(pivot→cutPoint)가 회전 방향으로 스윕하다가 "가장
// 가까운 고정쪽 다트 다리(pivot→mouth)"를 만나면 그 앞에서 멈춰야 한다. 이
// 배리어는 segmentsCross로는 절대 못 잡는다 — 두 다리가 pivot을 공유하므로
// 교차검사에서 sharesEndpoint로 제외되고, 그래서 회전 다리가 기존 다트가 열어놓은
// "빈 웨지"를 그대로 통과해버린다(실측 2026-07-07: "가슴다트 방향으로만 오버해서
// 회전한다"는 증상의 진짜 원인. pivot 근처 point-in-polygon 겹침판정은 gen-0
// 정상 다트에서도 오탐이 나 못 쓴다 — 순수 각도 계산만이 강건함).
// 배리어 대상은 dart-leg-new/old만이다. 원본 가슴다트(old-dart)는 배리어에 넣지
// 않는다 — 1차 다트는 그 가슴다트를 "닫는" 동작이고 targetAngle 자체가 이미 G→GG
// 각도라, min(target, ...)이 알아서 그 값에서 멈춘다(1차 풀클로징 보존, 실측 확인).
function rotationLegBarrier(fixedClean, pivot, cutPoint, signedTarget) {
  if (!cutPoint) return signedTarget;
  const dir = Math.sign(signedTarget) || 1;
  const margin = 0.3 * Math.PI / 180;   // 기존 다리와 정확히 겹쳐 합쳐지지 않도록 살짝 앞에서 멈춤
  const angleOf = (pt) => Math.atan2(pt.y - pivot.y, pt.x - pivot.x);
  const norm = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a <= -Math.PI) a += 2*Math.PI; return a; };
  const cutAng = angleOf(cutPoint);
  let best = Math.abs(signedTarget);
  for (const s of fixedClean) {
    if (s.type !== "dart-leg-new" && s.type !== "dart-leg-old") continue;
    const dF = Math.hypot(s.from.x - pivot.x, s.from.y - pivot.y);
    const dT = Math.hypot(s.to.x   - pivot.x, s.to.y   - pivot.y);
    if (Math.max(dF, dT) < 1e-3) continue;            // 퇴화(길이 0) 다리는 무시
    const mouth = dF > dT ? s.from : s.to;            // pivot에서 먼 끝 = mouth
    const rel = norm(angleOf(mouth) - cutAng);
    const gapInDir = dir > 0 ? rel : -rel;            // 회전 방향으로 얼마나 앞에 있나
    if (gapInDir > 1e-3) best = Math.min(best, Math.max(0, gapInDir - margin));
  }
  return dir * best;
}

function findMaxSafeAngle(fixedSegsRaw, rotateSegsRaw, pivot, targetAngle, cutPoint) {
  if (Math.abs(targetAngle) < 1e-9) return targetAngle;
  const cleanForBake = (segsArr) => (segsArr || []).filter(s =>
    s?.from && s?.to && s.type !== "dart-leg" && s.type !== "dart-bridge");
  const fixedClean  = cleanForBake(fixedSegsRaw);
  const rotateClean = cleanForBake(rotateSegsRaw);
  if (fixedClean.length === 0 || rotateClean.length === 0) return targetAngle;

  // 1) 각도 배리어: 회전 다리가 기존 다트 다리를 지나치지 못하게 상한을 먼저 좁힌다.
  const cut = cutPoint || rotateClean[0]?.from || fixedClean[0]?.from;
  const barrierAngle = rotationLegBarrier(fixedClean, pivot, cut, targetAngle);
  const effTarget = (Math.abs(barrierAngle) < Math.abs(targetAngle)) ? barrierAngle : targetAngle;
  if (Math.abs(effTarget) < 1e-9) {
    if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE)
      console.log('[findMaxSafeAngle] 각도 배리어로 0까지 축소 (기존 다트 다리 인접)');
    return effTarget;
  }

  // 2) 회전으로 새로 생기는 겹침(고정×회전 조각 간)만 회전 한계를 결정한다 —
  // bake 결과 전체의 자기교차를 보면 같은 조각 내부의 접선 노이즈(원본부터
  // 있던 것)까지 걸려서 멀쩡한 회전을 0으로 오판한다.
  const crossesAt = (angle) => {
    return findRotationCollisions(fixedClean, rotateClean, pivot, angle).length > 0;
  };

  // 0°부터 effTarget까지 촘촘히 스캔해서 "처음으로 겹치는 지점"을 찾는다.
  const SCAN_STEPS = 60;
  let firstUnsafeStep = -1;
  for (let i = 1; i <= SCAN_STEPS; i++) {
    if (crossesAt(effTarget * (i / SCAN_STEPS))) { firstUnsafeStep = i; break; }
  }
  if (firstUnsafeStep === -1) return effTarget; // 경로 전체가 안전 (배리어 한계까지)

  // 마지막으로 안전이 확인된 스텝과 처음 겹친 스텝 사이만 이분 탐색 — 18회면
  // 스캔 간격(effTarget/SCAN_STEPS) 기준 오차가 무시할 수준까지 좁혀진다.
  let lo = effTarget * ((firstUnsafeStep - 1) / SCAN_STEPS);
  let hi = effTarget * (firstUnsafeStep / SCAN_STEPS);
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (crossesAt(mid)) hi = mid; else lo = mid;
  }
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log('[findMaxSafeAngle] 축소:', (targetAngle*180/Math.PI).toFixed(2), '° →',
      (lo*180/Math.PI).toFixed(2), '° (배리어:', (effTarget*180/Math.PI).toFixed(2),
      '°, 첫 겹침 스텝:', firstUnsafeStep, '/', SCAN_STEPS, ')');
  }
  return lo;
}

// ── 조각의 mouth 끝점 추출 ──
function pieceMouthPoint(piece, pivot) {
  if (piece?.openPts?.length) {
    const last = piece.openPts[piece.openPts.length - 1];
    return last ? { ...last } : null;
  }
  if (piece?.segs?.length) {
    const last = piece.segs[piece.segs.length - 1];
    return last?.to ? { ...last.to } : null;
  }
  return null;
}

function calcFrontCloseAngleByRotateHit(p, B, rotateHit) {
  const { GG } = calcCloseAngle(p, B);
  const pivot = p.BP;
  const angleG  = Math.atan2(p.G.y  - pivot.y, p.G.x  - pivot.x);
  const angleGG = Math.atan2(GG.y   - pivot.y, GG.x   - pivot.x);

  let closeAngle;
  if (rotateHit === "G") {
    // G 조각이 움직이면 G를 GG 방향으로 닫는다
    closeAngle = angleGG - angleG;
  } else {
    // GG 조각이 움직이면 GG를 G 방향으로 닫는다 (기존 방향)
    closeAngle = angleG - angleGG;
  }
  while (closeAngle >  Math.PI) closeAngle -= 2 * Math.PI;
  while (closeAngle < -Math.PI) closeAngle += 2 * Math.PI;
  return { closeAngle, GG };
}

// ── 이 옷 전체의 "기본 다트량" 각도 크기 (몇 차 다트이동이든 항상 동일) ──
// 부호는 신경 쓰지 않는다 — choosePhysicalCloseAngle이 최종 결정한다.
function calcFrontBaseDartAngle(p, B) {
  const { GG } = calcCloseAngle(p, B);
  const pivot = p.BP;
  const angleG  = Math.atan2(p.G.y  - pivot.y, p.G.x  - pivot.x);
  const angleGG = Math.atan2(GG.y   - pivot.y, GG.x   - pivot.x);
  let a = angleGG - angleG;
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return Math.abs(a);
}

function splitFrontOutline(segments, cutPoint, cutSegIndex, p, B) {
  const { GG } = calcCloseAngle(p, B);

  const isNear = (a, b, eps = 0.05) => {
    if (!a || !b) return false;
    return Math.hypot(a.x - b.x, a.y - b.y) < eps;
  };

  const isG  = pt => isNear(pt, p.G);
  const isGG = pt => isNear(pt, GG);
  const nn = segments.length;

  function walkForward() {
    // cutSegIndex segment: cutPoint → seg.to (cutPoint 이후 부분만)
    // 이후 segments: 원본 그대로
    const pts  = [{ ...cutPoint }];
    const segs = [];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex + step) % nn;
      const seg = segments[idx];
      const next = { ...seg.to };
      if (seg.disabled && !isG(next) && !isGG(next)) continue;
      // cutSegIndex segment는 from을 cutPoint로 교체 (cutPoint 이전 구간 제거)
      const fromPt = (step === 0) ? { ...cutPoint } : { ...seg.from };
      segs.push({ from: fromPt, to: { ...seg.to }, type: seg.type, disabled: !!seg.disabled });
      pts.push(next);
      if (isG(next))  { hit = "G";  break; }
      if (isGG(next)) { hit = "GG"; break; }
    }
    return { pts, segs, hit };
  }

  function walkBackward() {
    const rawSegs = [];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex - step + nn) % nn;
      const seg = segments[idx];
      const prev = seg.from;
      if (seg.disabled && !isG(prev) && !isGG(prev)) continue;
      rawSegs.push(seg);
      if (isG(prev))  { hit = "G";  break; }
      if (isGG(prev)) { hit = "GG"; break; }
    }
    const segs = rawSegs.map(seg => ({
      from: { ...seg.to },
      to:   { ...seg.from },
      type: seg.type,
      disabled: !!seg.disabled,
    }));
    if (segs.length > 0) segs[0].from = { ...cutPoint };
    const pts = [{ ...cutPoint }];
    for (const seg of segs) pts.push({ ...seg.to });
    return { pts, segs, hit };
  }
  const forward  = walkForward();
  const backward = walkBackward();

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE){
    console.log('[split] forward.hit:', forward.hit, 'pts:', forward.pts.length, 'segs:', forward.segs.length);
    console.log('[split] backward.hit:', backward.hit, 'pts:', backward.pts.length, 'segs:', backward.segs.length);
    console.log('[split] GG:', JSON.stringify(GG));
    console.log('[split] p.G:', JSON.stringify(p.G));
    console.log('[split] forward types:', forward.segs.map(s=>s.type).join(','));
    console.log('[split] backward types:', backward.segs.map(s=>s.type).join(','));
  }
  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    const fS = forward.segs, bS = backward.segs;
    console.log('[check] forward  segs[0].from:', JSON.stringify(fS[0]?.from), '/ segs[last].to:', JSON.stringify(fS[fS.length-1]?.to));
    console.log('[check] backward segs[0].from:', JSON.stringify(bS[0]?.from), '/ segs[last].to:', JSON.stringify(bS[bS.length-1]?.to));
    console.log('[check] cutPoint:', JSON.stringify(cutPoint), '/ G:', JSON.stringify(p.G), '/ GG:', JSON.stringify(GG));
  }

  const pathA = [...forward.pts,  { ...p.BP }, { ...cutPoint }];
  const pathB = [...backward.pts, { ...p.BP }, { ...cutPoint }];
  return {
    pieceA: { pts: pathA, segs: forward.segs,  hit: forward.hit  || "G",  openPts: forward.pts  },
    pieceB: { pts: pathB, segs: backward.segs, hit: backward.hit || "GG", openPts: backward.pts },
  };
}

// ── 앞판 실제 패턴선 기준 외곽선 ───────────────
function buildFrontOutline(p, f, B) {
  const segments = [];

  const circ = f.fnw(), fnd = f.fnd();
  const nTR = { x: f.sw(),        y: f.yB()        };
  const nTL = { x: f.sw() - circ, y: f.yB()        };
  const nBR = { x: f.sw(),        y: f.yB() + fnd  };
  const nBL = { x: f.sw() - circ, y: f.yB() + fnd  };

  const deg22 = 22 * Math.PI / 180;
  const shLen = (nTL.x - (f.sw() - f.fw())) / Math.cos(deg22);
  const FSP = {
    x: nTL.x - (shLen + 1.8) * Math.cos(deg22),
    y: nTL.y + (shLen + 1.8) * Math.sin(deg22),
  };

  const vx = p.BP.x - p.G.x, vy = p.BP.y - p.G.y;
  const len = Math.hypot(vx, vy) || 1;
  const ux = -vx / len, uy = -vy / len;
  const da = (B / 4 - 2.5) * Math.PI / 180;
  const GG = {
    x: p.BP.x + (ux * Math.cos(da) - uy * Math.sin(da)) * len,
    y: p.BP.y + (ux * Math.sin(da) + uy * Math.cos(da)) * len,
  };

  const diagLen = Math.hypot(nBL.x - nTR.x, nBL.y - nTR.y) || 1;
  const diagUx = (nBL.x - nTR.x) / diagLen, diagUy = (nBL.y - nTR.y) / diagLen;
  const div2   = { x: nTR.x + (nBL.x - nTR.x) * (2/3), y: nTR.y + (nBL.y - nTR.y) * (2/3) };
  const guideP = { x: div2.x + diagUx * 0.5,            y: div2.y + diagUy * 0.5            };

  const FN = state.fNeckH || { h0: { x: nBR.x, y: nBR.y }, h1: { x: nTL.x, y: nTL.y } };

  const tgx = -(guideP.y - nTR.y), tgy = guideP.x - nTR.x;
  const tgLen = Math.hypot(tgx, tgy) || 1;
  const tx = tgx / tgLen, ty = tgy / tgLen;
  const d1 = Math.hypot(guideP.x - nBR.x, guideP.y - nBR.y) * 0.25;
  const d2 = Math.hypot(nTL.x - guideP.x, nTL.y - guideP.y) * 0.25;
  const c2 = { x: guideP.x - tx * d1, y: guideP.y - ty * d1 };
  const c3 = { x: guideP.x + tx * d2, y: guideP.y + ty * d2 };

  const neck1 = sampleCubic(nBR, FN.h0, c2, guideP, 10);
  const neck2 = sampleCubic(guideP, c3, FN.h1, nTL, 10);
  const neckAll = [...neck1, ...neck2.slice(1)];

  const FH = state.fArmH || { hFa: { x: GG.x, y: GG.y }, hFb: { x: FSP.x, y: FSP.y } };
  // 앞진동 상부: GG → FSP
  // SIDE_TOP → G 하부 구간은 drawArmhole의 뒤/앞 진동 구조에서 담당한다.
  const frontArm = sampleCubic(GG, FH.hFa, FH.hFb, FSP, 16);

  addLineSegment(segments, nBR,        p.FRONT_WL,  { type: "front-center"   });
  addLineSegment(segments, p.FRONT_WL, p.SIDE_BTM,  { type: "front-waist"    });
  addLineSegment(segments, p.SIDE_BTM, p.SIDE_TOP,  { type: "side-seam"      });
  // 앞암홀 하부: SIDE_TOP → G 곡선 (state.armH 핸들 사용, 직선 금지)
  {
    const H = state.armH;
    if (H && H.h2b && H.h3a && H.a3 && H.h3b && H.h4) {
      // render.js drawArmhole과 동일한 두 구간 cubic
      const lower1 = sampleCubic(p.SIDE_TOP, H.h2b, H.h3a, H.a3, 8);
      const lower2 = sampleCubic(H.a3,       H.h3b, H.h4,  p.G,   8);
      const lowerFrontArm = [...lower1, ...lower2.slice(1)];
      addSampledSegments(segments, lowerFrontArm, { type: "front-armhole-lower" });
    } else {
      // fallback: SIDE_TOP → G 단순 cubic 근사 (직선 회피)
      const midX = (p.SIDE_TOP.x + p.G.x) / 2;
      const midY = Math.min(p.SIDE_TOP.y, p.G.y) - 2; // 약간 위로 들어올린 제어점
      const c1 = { x: p.SIDE_TOP.x, y: midY };
      const c2 = { x: midX,         y: midY };
      const fallbackArm = sampleCubic(p.SIDE_TOP, c1, c2, p.G, 16);
      addSampledSegments(segments, fallbackArm, { type: "front-armhole-lower" });
    }
  }
  addLineSegment(segments, p.G,        p.BP,        { type: "old-dart", disabled: true });
  addLineSegment(segments, p.BP,       GG,          { type: "old-dart", disabled: true });
  addSampledSegments(segments, frontArm,             { type: "front-armhole-upper" });
  addLineSegment(segments, FSP,        nTL,         { type: "front-shoulder" });
  addSampledSegments(segments, [...neckAll].reverse(),{ type: "front-neckline" });

  return segments;
}

function findCutPoint(clickPt, segments, pts) {
  let best = null, bestD = Infinity, bestIndex = -1;
  segments.forEach((seg, idx) => {
    if (!isClickableSeg(seg)) return;
    const r = closestOnSeg(clickPt, seg.from, seg.to);
    if (r.d < bestD) { bestD = r.d; best = r.pt; bestIndex = idx; }
  });
  if (bestD > 2.0) return null;

  const minDartEndDistance = 1.2;

  // G / GG 근접 차단 (원본 도안 다트 끝점)
  if (pts) {
    const B = n("inpB");
    const { GG } = calcCloseAngle(pts, B);
    const nearG  = Math.hypot(best.x - pts.G.x, best.y - pts.G.y)  < minDartEndDistance;
    const nearGG = Math.hypot(best.x - GG.x,     best.y - GG.y)     < minDartEndDistance;
    if (nearG || nearGG) {
      return { blocked: true, reason: "dart-end", point: best, segIndex: bestIndex };
    }
  }

  // baked 다트 mouth / pivot 근접 차단
  // 다중 다트 이동 시, 이미 열린 다트 입구(dart-leg-new/old mouth) 바로 옆이나
  // pivot(BP) 코앞을 클릭하면 splitBakedOutline이 극단적으로 작은/거대한 조각으로
  // 나누게 되므로, 물리적으로 무의미한 위치는 애초에 선택 불가로 막는다.
  if (pts?.BP) {
    const pivot = pts.BP;
    const nearPivot = Math.hypot(best.x - pivot.x, best.y - pivot.y) < minDartEndDistance;
    if (nearPivot) {
      return { blocked: true, reason: "baked-dart-mouth", point: best, segIndex: bestIndex };
    }
    for (const seg of segments) {
      if (!isDartLegType(seg)) continue;
      const dFrom = Math.hypot(seg.from.x - pivot.x, seg.from.y - pivot.y);
      const dTo   = Math.hypot(seg.to.x   - pivot.x, seg.to.y   - pivot.y);
      const mouthDist = Math.max(dFrom, dTo);
      if (mouthDist < minDartEndDistance) continue; // 퇴화(길이 0) 다리엔 mouth 없음
      const mouth = dFrom > dTo ? seg.from : seg.to; // pivot에서 먼 쪽 = mouth
      const nearMouth = Math.hypot(best.x - mouth.x, best.y - mouth.y) < minDartEndDistance;
      if (nearMouth) {
        return { blocked: true, reason: "baked-dart-mouth", point: best, segIndex: bestIndex };
      }
    }
  }

  return { point: best, segIndex: bestIndex, distance: bestD };
}

// ── UI ────────────────────────────────────────
function toggleDartMove() {
  if (dartMoveState.active) cancelDartMove(); else startDartMove();
}

function startDartMove() {
  dartMoveState.active        = true;
  dartMoveState.side          = null;   // 아직 앞/뒤 미선택
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
  dartMoveState.rotatePts     = null;
  dartMoveState.fixedPts      = null;
  setBtn("취소", "#cc3333");
  setApplyEnabled(false);
  setHint("앞판 / 뒤판을 선택하세요");
  setSideRowVisible(true);
  setSideActive(null);
  render();
}

// 앞판 / 뒤판 선택
function selectDartSide(side) {
  dartMoveState.side          = side;
  dartMoveState.mode          = "selectCut";
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
  dartMoveState.pieceA        = null;
  dartMoveState.pieceB        = null;
  dartMoveState.rotatePts     = null;
  dartMoveState.fixedPts      = null;
  setApplyEnabled(false);
  setSideActive(side);
  const label = side === "front" ? "앞판" : "뒤판";
  setHint(`${label} 외곽선을 클릭하세요`);
  render();
}

function cancelDartMove() {
  dartMoveState.active        = false;
  dartMoveState.mode          = "idle";
  dartMoveState.side          = null;
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
  dartMoveState.pieceA        = null;
  dartMoveState.pieceB        = null;
  dartMoveState.rotatePts     = null;
  dartMoveState.fixedPts      = null;
  setBtn("다트이동 시작", "#e07800");
  setApplyEnabled(false);
  setHint("");
  setSideRowVisible(false);
  setSideActive(null);
  render();
}

function resetDartMove() {
  dartMoveState.active        = false;
  dartMoveState.mode          = "idle";
  dartMoveState.side          = null;
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
  dartMoveState.pieceA        = null;
  dartMoveState.pieceB        = null;
  dartMoveState.rotatePts     = null;
  dartMoveState.fixedPts      = null;
  dartMoveState.fixedSegs     = null;
  dartMoveState.rotateSegs    = null;
  dartMoveState.fixedHit      = null;
  dartMoveState.rotateHit     = null;
  dartMoveState._splitIsBaked = null;
  dartMoveState.appliedFront  = null;
  dartMoveState.appliedBack   = null;
  setBtn("다트이동 시작", "#e07800");
  setApplyEnabled(false);
  setHint("다트이동 결과를 초기화했습니다");
  setSideRowVisible(false);
  setSideActive(null);
  render();
}

function applyDartMove() {
  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) console.log('[dartMove] applyDartMove 실행', { cutPoint: dartMoveState.cutPoint, rotateSegs: dartMoveState.rotateSegs?.length, fixedSegs: dartMoveState.fixedSegs?.length });
  if (!dartMoveState.cutPoint || dartMoveState.cutSegIndex < 0) {
    setHint("먼저 외곽선 위에서 다트 이동 위치를 선택하세요");
    return;
  }
  if (!dartMoveState.rotatePts) {
    setHint("회전 조각이 준비되지 않았습니다");
    return;
  }

  const angle = dartMoveState.userAngle;
  const p = _getDraftPts();
  if (!p) return;

  // 퇴화 다트 차단: 회전량이 사실상 0이면 적용해도 입구가 안 벌어진 다리 두 개가
  // 같은 자리에 겹쳐 방사형 잔선만 남는다 — 적용 자체를 막는다.
  if (Math.abs(angle) < MIN_DART_ANGLE_RAD) {
    setHint("회전량이 너무 작습니다 — 핸들을 드래그해서 다트를 벌린 뒤 적용하세요");
    return;
  }

  // 회전 중심: 앞판=BP, 뒤판=E
  const pivot = (dartMoveState.side === "back") ? p.E : p.BP;

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log('[apply] rotatePts.len:', dartMoveState.rotatePts.length,
      '/ fixedPts.len:', dartMoveState.fixedPts?.length,
      '/ rotateArea:', polygonArea(dartMoveState.rotatePts).toFixed(2),
      '/ fixedArea:', polygonArea(dartMoveState.fixedPts).toFixed(2));
    console.log('[apply] rotateSegs.len:', dartMoveState.rotateSegs?.length,
      '/ fixedSegs.len:', dartMoveState.fixedSegs?.length,
      '/ rotateSegs types:', dartMoveState.rotateSegs?.map(s=>s.type).join(','));
  }

  const side = dartMoveState.side;

  // 안전장치: split에서 놓쳐도 bake 직전 한 번 더 다트선 제거
  // cleanForBake: dart-leg(구형)과 bridge만 제거
  // dart-leg-new/old는 bakeFromSplitPieces 입구의 safeFixed/safeRotate 필터에서 처리
  const cleanForBake = (segs) =>
    (segs || []).filter(s =>
      s?.from && s?.to &&
      s.type !== "dart-leg" &&
      s.type !== "dart-bridge"
    );

  const _rawFixedLen  = dartMoveState.fixedSegs?.length  || 0;
  const _rawRotateLen = dartMoveState.rotateSegs?.length || 0;
  const _cleanFixed  = cleanForBake(dartMoveState.fixedSegs);
  const _cleanRotate = cleanForBake(dartMoveState.rotateSegs);

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log('[apply] cleanForBake fixed:', _rawFixedLen, '→', _cleanFixed.length,
      _rawFixedLen !== _cleanFixed.length ? '⚠️ 다트선 혼입 제거됨' : '');
    console.log('[apply] cleanForBake rotate:', _rawRotateLen, '→', _cleanRotate.length,
      _rawRotateLen !== _cleanRotate.length ? '⚠️ 다트선 혼입 제거됨' : '');

    const _dist = (a, b) => (a && b) ? Math.hypot(a.x-b.x, a.y-b.y) : Infinity;
    const _fixedGap  = _dist(_cleanFixed[0]?.from,  dartMoveState.cutPoint);
    const _rotateGap = _dist(_cleanRotate[0]?.from, dartMoveState.cutPoint);
    console.log('[preBake] fixed start gap:',  _fixedGap.toFixed(3),  _fixedGap  < 1e-2 ? '✅' : '❌');
    console.log('[preBake] rotate start gap:', _rotateGap.toFixed(3), _rotateGap < 1e-2 ? '✅' : '❌');
    console.log('[preBake] fixed types:',  _cleanFixed.map(s=>s.type).join(','));
    console.log('[preBake] rotate types:', _cleanRotate.map(s=>s.type).join(','));
  }

  // split 결과로 직접 bake (fixedSegs 그대로, rotateSegs만 회전)
  const bakedSegments = bakeFromSplitPieces({
    fixedSegs:  _cleanFixed,
    rotateSegs: _cleanRotate,
    pivot,
    angle:      dartMoveState.userAngle,
  });

  debugCheckSegmentContinuity(bakedSegments, `${side} bakedSegments`);
  validateBakedSegments(bakedSegments, side, pivot);

  // ── 겹침은 판단이 아니라 차단 대상이다: 겹치는 결과는 애초에 적용되지 않는다.
  // 검사 기준은 findMaxSafeAngle과 동일하게 "회전으로 새로 생기는 겹침"(고정×회전
  // 조각 간)만 본다 — bake 전체의 자기교차를 보면 같은 조각 내부의 접선 노이즈
  // (원본부터 있던 것)까지 걸려 멀쩡한 적용을 차단한다. 드래그 상태(mode/
  // rotateSegs/cutPoint 등)는 그대로 유지해 사용자가 각도나 조각을 바꿔서 다시
  // 시도할 수 있게 한다.
  const _crossings = findRotationCollisions(_cleanFixed, _cleanRotate, pivot, dartMoveState.userAngle);
  if (_crossings.length > 0) {
    if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
      console.warn('[apply] 조각 간 겹침으로 적용 차단', _crossings);
    }
    setHint(`이 위치/각도는 패턴이 겹칩니다 (${_crossings.length}건) — 각도를 줄이거나 다른 조각/위치를 선택하세요`);
    return;
  }

  // ── 델타 안전망: 이 이동이 회전 전(각도 0) 대비 자기교차를 "새로" 늘리면 거부.
  // findRotationCollisions는 조각 본체 간 겹침은 잡지만, bake가 새로 만들어내는
  // 잔여벽(legOld) 등이 본체를 관통하는 경우는 검사 대상에 없어 놓친다. 각도 0의
  // 재조립(baked0)을 기준선으로 삼아 교차 수를 비교하면, 원본부터 있던 접선
  // 노이즈는 양쪽에 똑같이 있어 상쇄되고 이 회전이 "새로" 만든 겹침만 남는다
  // (실측 2026-07-07: 실제 순차 다트이동은 새 겹침 0건이라 오차단 없음, 비현실적
  // 조각 선택에서만 걸림). 제1법칙 — 물리적으로 겹치는 결과는 종이가 될 수 없다.
  const _baked0 = bakeFromSplitPieces({ fixedSegs: _cleanFixed, rotateSegs: _cleanRotate, pivot, angle: 0 });
  const _cross0 = findSelfIntersections(_baked0, pivot).length;
  const _crossNow = findSelfIntersections(bakedSegments, pivot).length;
  if (_crossNow > _cross0) {
    if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
      console.warn('[apply] 회전이 새 겹침을 만들어 적용 차단 (baseline:', _cross0, '→', _crossNow, ')');
    }
    setHint(`이 위치/각도는 패턴이 겹칩니다 — 각도를 줄이거나 다른 조각/위치를 선택하세요`);
    return;
  }

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    const DART_TYPES = ["dart-leg-new","dart-leg-old","dart-bridge"];
    const outerTypes = bakedSegments.filter(s=>!DART_TYPES.includes(s.type)).map(s=>s.type);
    console.log('[afterBake] 외곽선 타입:', outerTypes.join(' → '));
    console.log('[afterBake] 외곽선 수:', outerTypes.length, '/ 전체:', bakedSegments.length);
  }

  if (side === "front") {
    dartMoveState.appliedFront = {
      side: "front", bakedSegments,
      cutPoint: { ...dartMoveState.cutPoint },
      pivot:    { ...pivot },
      angle:    dartMoveState.userAngle,
    };
  } else {
    dartMoveState.appliedBack = {
      side: "back", bakedSegments,
      cutPoint: { ...dartMoveState.cutPoint },
      pivot:    { ...pivot },
      angle:    dartMoveState.userAngle,
    };
  }

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE)
    console.log('[apply] bakedSegments:', bakedSegments.length, 'side:', side,
      'dartLegs:', bakedSegments.filter(s=>s.type==="dart-leg-new").length);

  // 적용 후: active 유지, 앞/뒤 재선택 대기 상태로 복귀
  const appliedSide = side;
  const appliedCutPoint = { ...dartMoveState.cutPoint };
  dartMoveState.active        = true;
  dartMoveState.mode          = "idle";
  dartMoveState.dragging      = false;
  dartMoveState.side          = null;
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
  dartMoveState.pieceA        = null;
  dartMoveState.pieceB        = null;
  dartMoveState.rotatePts     = null;
  dartMoveState.fixedPts      = null;
  dartMoveState.rotateSegs    = null;
  dartMoveState.fixedSegs     = null;
  dartMoveState.fixedHit      = null;
  dartMoveState.rotateHit     = null;
  const sideLabel = appliedSide === "back" ? "뒤판" : "앞판";
  setBtn("취소", "#cc3333");
  setApplyEnabled(false);
  setSideRowVisible(true);
  setSideActive(null);
  const appliedW = dartOpenWidth(appliedCutPoint, pivot, angle);
  setHint(`${sideLabel} 적용 완료 (${appliedW.toFixed(1)}cm) · 앞판 / 뒤판을 선택하세요`);
  render();
}

function setDartTheta()  {}
function applyDartMoveToPoint(key, orig) { return orig; }

// ── 드래프트 pts 헬퍼 (중복 방지) ─────────────
function _getDraftPts() {
  const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
  if (!B || !W || !BL) return null;
  return createDraft(B, W, BL).pts;
}

// ── 점 배열 → SVG polyline points 문자열 ──────
function ptsToSvgPoints(pts) {
  return pts.map(pt => { const [x, y] = c2p(pt.x, pt.y); return `${x},${y}`; }).join(" ");
}

// ── 오버레이 ──────────────────────────────────
function drawDartMoveOverlay(svgEl, p) {
  // applied 상태에서는 render.js의 drawDartMoveApplied()가 패턴선을 그린다.
  // overlay에서는 추가 표시 없음.
  if (!dartMoveState.active) return;

  const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
  if (!B || !W || !BL) return;

  const g = E("g", { "pointer-events": "none" });

  // ── 0. selectPiece 모드: 두 조각 반투명 표시 ──────
  if (dartMoveState.mode === "selectPiece") {
    const pieceA = dartMoveState.pieceA;
    const pieceB = dartMoveState.pieceB;
    if (pieceA?.pts?.length > 1) {
      const ptsSvgA = pieceA.pts.map(pt => { const [x,y] = c2p(pt.x, pt.y); return `${x},${y}`; }).join(" ");
      g.appendChild(E("polygon", { points: ptsSvgA,
        fill: "#44aaff", "fill-opacity": "0.25",
        stroke: "#44aaff", "stroke-width": "1.5", "stroke-dasharray": "4 2" }));
      // 중심에 라벨
      const cxA = pieceA.pts.reduce((s,p)=>s+p.x,0)/pieceA.pts.length;
      const cyA = pieceA.pts.reduce((s,p)=>s+p.y,0)/pieceA.pts.length;
      const [lxA, lyA] = c2p(cxA, cyA);
      g.appendChild(E("text", { x: lxA, y: lyA, "font-size": 13, fill: "#1177cc",
        "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "middle" }, "▶ 클릭"));
    }
    if (pieceB?.pts?.length > 1) {
      const ptsSvgB = pieceB.pts.map(pt => { const [x,y] = c2p(pt.x, pt.y); return `${x},${y}`; }).join(" ");
      g.appendChild(E("polygon", { points: ptsSvgB,
        fill: "#ff8800", "fill-opacity": "0.25",
        stroke: "#ff8800", "stroke-width": "1.5", "stroke-dasharray": "4 2" }));
      const cxB = pieceB.pts.reduce((s,p)=>s+p.x,0)/pieceB.pts.length;
      const cyB = pieceB.pts.reduce((s,p)=>s+p.y,0)/pieceB.pts.length;
      const [lxB, lyB] = c2p(cxB, cyB);
      g.appendChild(E("text", { x: lxB, y: lyB, "font-size": 13, fill: "#cc5500",
        "font-weight": "700", "text-anchor": "middle", "dominant-baseline": "middle" }, "▶ 클릭"));
    }
    svgEl.appendChild(g);
    return;
  }

  // ── 1. cutPoint 선택 전: hover만 표시 ────────────
  if (!dartMoveState.cutPoint) {
    if (dartMoveState.hoverSegIndex >= 0) {
      const dHov = createDraft(B, W, BL);
      const segsHov = dartMoveState.side === "back"
        ? getBackTargetOutline(dHov.pts, dHov.formula, B)
        : getFrontTargetOutline(dHov.pts, dHov.formula, B);
      const hSeg = segsHov[dartMoveState.hoverSegIndex];
      if (hSeg) {
        const [hx1, hy1] = c2p(hSeg.from.x, hSeg.from.y);
        const [hx2, hy2] = c2p(hSeg.to.x,   hSeg.to.y);
        g.appendChild(E("line", { x1: hx1, y1: hy1, x2: hx2, y2: hy2,
          stroke: "#ffcc00", "stroke-width": 3, opacity: 0.85 }));
      }
    }
    if (dartMoveState.hoverPoint) {
      const hp = dartMoveState.hoverPoint;
      const [hpx, hpy] = c2p(hp.x, hp.y);
      g.appendChild(E("circle", { cx: hpx, cy: hpy, r: 5,
        fill: "#ffcc00", stroke: "#fff", "stroke-width": 1.5, opacity: 0.9 }));

      // ── a→c, c→b 거리 표시 ──────────────────────
      const dHov2 = createDraft(B, W, BL);
      const segsHov2 = dartMoveState.side === "back"
        ? getBackTargetOutline(dHov2.pts, dHov2.formula, B)
        : getFrontTargetOutline(dHov2.pts, dHov2.formula, B);
      const hSeg2 = segsHov2[dartMoveState.hoverSegIndex];
      if (hSeg2) {
        const dA = Math.hypot(hp.x - hSeg2.from.x, hp.y - hSeg2.from.y);
        const dB = Math.hypot(hp.x - hSeg2.to.x,   hp.y - hSeg2.to.y);
        const [tx, ty] = c2p(hp.x, hp.y);
        g.appendChild(E("text", {
          x: tx + 10, y: ty - 8,
          "font-size": 11, fill: "#ffcc00", "font-weight": "700",
          "text-anchor": "start", stroke: "#333", "stroke-width": 0.3,
        }, `↑${dA.toFixed(1)}cm`));
        g.appendChild(E("text", {
          x: tx + 10, y: ty + 6,
          "font-size": 11, fill: "#ffcc00", "font-weight": "700",
          "text-anchor": "start", stroke: "#333", "stroke-width": 0.3,
        }, `↓${dB.toFixed(1)}cm`));
      }
    }
    svgEl.appendChild(g);
    return;
  }

  // ── 2. cutPoint 확정 후: 선택 세그먼트 강조 + 회전 미리보기 ────
  const cut = dartMoveState.cutPoint;
  const [cx, cy] = c2p(cut.x, cut.y);

  // 회전 중심: 앞판=BP, 뒤판=E
  const pivot = (dartMoveState.side === "back") ? p.E : p.BP;
  const [bx, by] = c2p(pivot.x, pivot.y);

  const dDraft = createDraft(B, W, BL);
  const segs = dartMoveState.side === "back"
    ? getBackTargetOutline(dDraft.pts, dDraft.formula, B)
    : getFrontTargetOutline(dDraft.pts, dDraft.formula, B);

  // 선택된 세그먼트 강조
  const seg = segs[dartMoveState.cutSegIndex];
  if (seg) {
    const [sx1, sy1] = c2p(seg.from.x, seg.from.y);
    const [sx2, sy2] = c2p(seg.to.x, seg.to.y);
    g.appendChild(E("line", { x1: sx1, y1: sy1, x2: sx2, y2: sy2,
      stroke: "#ffcc00", "stroke-width": 3, opacity: 0.85 }));
  }

  // rotatePts가 아직 없으면 표시만
  const rotatePts = dartMoveState.rotatePts;
  if (!rotatePts) { svgEl.appendChild(g); return; }

  const angle = dartMoveState.userAngle;

  // ── 회전 미리보기 polyline ─────────────────────
  const rotated = rotatePts.map(pt => rotatePt(pt, pivot, angle));
  if (rotated.length >= 2) {
    g.appendChild(E("polyline", {
      points: ptsToSvgPoints(rotated),
      fill: "none", stroke: "#44aaff",
      "stroke-width": 2, opacity: 0.8,
      "stroke-dasharray": "5,3",
    }));
  }

  // ── 고정 조각 polyline (움직이지 않는 나머지 조각) ──
  const fixedPts = dartMoveState.fixedPts;
  if (fixedPts?.length >= 2) {
    g.appendChild(E("polyline", {
      points: ptsToSvgPoints(fixedPts),
      fill: "none", stroke: "#ff8800",
      "stroke-width": 2, opacity: 0.8,
      "stroke-dasharray": "5,3",
    }));
  }

  // ── pivot→cutPoint 절개선 (주황) ──────────────
  g.appendChild(E("line", { x1: bx, y1: by, x2: cx, y2: cy, stroke: "#e07800", "stroke-width": 1.8, "stroke-dasharray": "6,3" }));

  // ── pivot→cutPoint2 새 다트 다리 (파랑) ────────
  const cut2 = rotatePt(cut, pivot, angle);
  const [cx2, cy2] = c2p(cut2.x, cut2.y);
  g.appendChild(E("line", { x1: bx, y1: by, x2: cx2, y2: cy2, stroke: "#44aaff", "stroke-width": 1.8, "stroke-dasharray": "6,3" }));

  // ── cutPoint 원 (주황, 고정) ───────────────────
  g.appendChild(E("circle", { cx, cy, r: 7, fill: "#e07800", stroke: "#fff", "stroke-width": 2 }));

  // ── 열린 너비 표시 (cutPoint ↔ cut2 직선 거리) ──
  const openW = dartOpenWidth(cut, pivot, angle);
  const [lx, ly] = c2p(pivot.x + 1.5, pivot.y - 1.5);
  g.appendChild(E("text", { x: lx, y: ly, "font-size": 11, fill: "#44aaff", "font-weight": "700", "text-anchor": "start" }, `${openW.toFixed(1)}cm`));

  svgEl.appendChild(g);

  // ── 드래그 핸들 (cutPoint2 위치, pointer-events 활성) ──
  const hg = E("g", {
    class: "dart-rotate-handle",
    "pointer-events": "auto",
    style: "cursor:grab",
  });
  hg.appendChild(E("circle", {
    cx: cx2, cy: cy2, r: 10,
    fill: "#44aaff", stroke: "#fff", "stroke-width": 2, opacity: 0.9,
  }));
  hg.appendChild(E("circle", { cx: cx2, cy: cy2, r: 3, fill: "#fff" }));
  svgEl.appendChild(hg);
}

// ── 드래그 핸들 이벤트 ────────────────────────
function initDartMoveClickHandler() {
  if (window.__dartMoveClickHandlerReady) return;
  window.__dartMoveClickHandlerReady = true;

  // ── 외곽선 클릭 → cutPoint 선택 ──────────────
  svg.addEventListener("click", e => {
    if (!dartMoveState.active) return;
    if (!dartMoveState.side) return;          // 앞/뒤 선택 전엔 무시
    // 드래그 핸들 위 클릭은 cutPoint 선택 무시
    if (e.target.closest(".dart-rotate-handle")) return;

    // ── selectPiece 모드: 조각 클릭으로 rotatePts 확정 ──
    if (dartMoveState.mode === "selectPiece") {
      const [px, py] = eventToPatternPoint(e);
      const clickPt = { x: px, y: py };
      const inA = pointInPolygon(clickPt, dartMoveState.pieceA?.pts || []);
      const inB = pointInPolygon(clickPt, dartMoveState.pieceB?.pts || []);
      const chosen = inA ? "A" : inB ? "B" : null;
      if (!chosen) { setHint("조각 안쪽을 클릭하세요"); return; }

      const rotatePiece = chosen === "A" ? dartMoveState.pieceA : dartMoveState.pieceB;
      const fixedPiece  = chosen === "A" ? dartMoveState.pieceB : dartMoveState.pieceA;
      const _B = n("inpB"), _W = n("inpW"), _BL = n("inpBL");
      const _d = createDraft(_B, _W, _BL);
      const pivot2 = dartMoveState.side === "back" ? _d.pts.E : _d.pts.BP;

      // closeAngle 크기: 몇 차 다트이동이든 항상 이 옷 전체의 기본 다트량(B 공식 기준
      // G/GG, 혹은 뒤판 dartCenter/dartEnd_) 크기를 그대로 쓴다. 새로 자르는 위치는
      // 직전 다트와 무관해도 되고, 직전 다트는 그대로 열린 채 남아있는 게 정상 동작이다
      // (여유분을 여러 군데에 나눠 배치하는 것 — 패턴사가 결정할 몫).
      // 예전에는 baked(2차 이상) 상태에서 "직전 다트의 현재 벌어진 폭"을 역산해서 각도로
      // 썼는데, 그 폭이 이미 커져 있으면 새 절개 위치가 pivot에서 멀수록 다트가 폭발적으로
      // 커지는 버그가 있었다(예: 30cm 다트). 부호는 지금처럼 choosePhysicalCloseAngle이
      // 최종 검증한다.
      let closeAngle;
      if (dartMoveState.side === "back") {
        const _info = buildBackShoulderDartInfo(_d.formula, _d.pts, _B);
        closeAngle = calcBackBaseDartAngle(_info);
      } else {
        closeAngle = calcFrontBaseDartAngle(_d.pts, _B);
      }

      // ── 부호 물리 검증: cutPoint를 미세 회전해서 회전 조각 안으로 들어가는 방향 선택 ──
      const _pivotSign = dartMoveState.side === "back" ? _d.pts.E : _d.pts.BP;
      if (rotatePiece.pts && rotatePiece.pts.length >= 3) {
        closeAngle = choosePhysicalCloseAngle({
          pivot:      _pivotSign,
          cutPoint:   dartMoveState.cutPoint,
          rotatePts:  rotatePiece.pts,
          absAngle:   closeAngle,
        });
      }

      if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE)
        console.log('[closeAngle] 부호검증 후 baseAngle:', closeAngle.toFixed(4),
          'pivot:', JSON.stringify(_pivotSign), 'cutPoint:', JSON.stringify(dartMoveState.cutPoint));

      // 고정 조각은 rest(항상-고정 영역)까지 포함한 전체 체인 사용 (baked 다중다트).
      // 1차(splitFront/BackOutline)는 segsFull이 없으므로 기존 segs 그대로 사용.
      const _rotateSegs = rotatePiece.segs;
      const _fixedSegs  = fixedPiece.segsFull || fixedPiece.segs;

      // ── 최대 회전각 = min(기본 다트량 각도, 자기교차 없이 가능한 최대각) ──
      // 사용자가 손으로 딱 맞는 지점을 찾을 필요가 없어야 한다: 끝까지 드래그하면
      // 시스템이 물리적으로 가능한 한계에서 알아서 멈춰야 한다.
      closeAngle = findMaxSafeAngle(_fixedSegs, _rotateSegs, _pivotSign, closeAngle, dartMoveState.cutPoint);

      // 회전 공간이 사실상 없으면(안전각 0.5° 미만) 여기서 차단하고 조각 선택
      // 상태를 유지한다 — 이대로 적용하면 겹침은 없지만 입구가 안 벌어진 퇴화
      // 다트(다리 두 개가 같은 자리에 겹친 방사선)가 남는다(실측: 무작위 재현에서
      // "필요없는 선" 잔선의 직접 원인이 이 케이스였음).
      if (Math.abs(closeAngle) < MIN_DART_ANGLE_RAD) {
        setHint("이 위치/조각은 회전할 공간이 없습니다 — 다른 조각이나 위치를 선택하세요");
        render();
        return;
      }

      dartMoveState.mode          = "drag";
      dartMoveState.baseAngle     = closeAngle;   // 드래그 최대 한계 (부호 검증 + 겹침 없는 한계)
      dartMoveState.userAngle     = 0;             // 항상 0에서 시작
      dartMoveState.rotatePts     = rotatePiece.pts;
      dartMoveState.fixedPts      = fixedPiece.pts;
      dartMoveState.rotateSegs    = _rotateSegs;
      dartMoveState.fixedSegs     = _fixedSegs;
      dartMoveState.rotateHit     = rotatePiece.hit;
      dartMoveState.fixedHit      = fixedPiece.hit;
      dartMoveState._splitIsBaked = null;
      dartMoveState.pieceA        = null;
      dartMoveState.pieceB        = null;
      const _baseW = dartOpenWidth(dartMoveState.cutPoint, pivot2, closeAngle);
      setApplyEnabled(true);
      setHint(`조각 선택됨 · 드래그로 최대 ${_baseW.toFixed(1)}cm 벌릴 수 있습니다`);
      render();
      return;
    }

    const [cx, cy] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const d = createDraft(B, W, BL);

    // ── 뒤판 ────────────────────────────────────
    if (dartMoveState.side === "back") {
      const segsBack = getBackTargetOutline(d.pts, d.formula, B);
      const resultB  = findCutPointBack({ x: cx, y: cy }, segsBack, d.pts, d.formula, B);

      if (resultB?.blocked) {
        setHint("다트 끝점 근처는 선택할 수 없습니다");
        render();
        return;
      }
      if (resultB) {
        dartMoveState.cutPoint    = resultB.point;
        dartMoveState.cutSegIndex = resultB.segIndex;

        const _isBakedB = !!dartMoveState.appliedBack?.bakedSegments;
        const splitB = _isBakedB
          ? splitBakedOutline(segsBack, resultB.point, resultB.segIndex, d.pts.E)
          : splitBackOutline(segsBack, resultB.point, resultB.segIndex, d.pts, d.formula, B);
        if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE)
          console.log('[splitBack] isBaked:', _isBakedB, 'A.hit:', splitB.pieceA?.hit, 'B.hit:', splitB.pieceB?.hit);
        dartMoveState.mode          = "selectPiece";
        dartMoveState.pieceA        = splitB.pieceA;
        dartMoveState.pieceB        = splitB.pieceB;
        dartMoveState._splitIsBaked = _isBakedB;
        dartMoveState.hoverPoint    = null;
        dartMoveState.hoverSegIndex = -1;
        setApplyEnabled(false);
        setHint("회전할 조각을 클릭하세요 (하늘색 또는 주황색)");
      } else {
        setHint(`뒤판 외곽선 근처를 클릭하세요 x=${cx.toFixed(1)} y=${cy.toFixed(1)}`);
      }
      render();
      return;
    }

    // ── 앞판 ────────────────────────────────────
    const segments = getFrontTargetOutline(d.pts, d.formula, B);
    const result = findCutPoint({ x: cx, y: cy }, segments, d.pts);

    if (result?.blocked) {
      setApplyEnabled(false);
      setHint(result.reason === "baked-dart-mouth"
        ? "이미 열린 다트 입구 근처는 선택할 수 없습니다"
        : "기존 다트 끝점 G/GG 근처는 선택할 수 없습니다");
      render();
      return;
    }

    if (result) {
      dartMoveState.cutPoint    = result.point;
      dartMoveState.cutSegIndex = result.segIndex;

      // bakedSegments가 있으면 splitBakedOutline, 없으면 splitFrontOutline
      const _isBakedF = !!dartMoveState.appliedFront?.bakedSegments;
      const split = _isBakedF
        ? splitBakedOutline(segments, result.point, result.segIndex, d.pts.BP)
        : splitFrontOutline(segments, result.point, result.segIndex, d.pts, B);
      if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE)
        console.log('[split] isBaked:', _isBakedF, 'A.hit:', split.pieceA?.hit, 'B.hit:', split.pieceB?.hit);
      dartMoveState.mode          = "selectPiece";
      dartMoveState.pieceA        = split.pieceA;
      dartMoveState.pieceB        = split.pieceB;
      dartMoveState._splitIsBaked = _isBakedF;
      dartMoveState.hoverPoint    = null;
      dartMoveState.hoverSegIndex = -1;
      setApplyEnabled(false);
      setHint("회전할 조각을 클릭하세요 (하늘색 또는 주황색)");
    } else {
      setApplyEnabled(false);
      setHint(`앞판 외곽선 근처를 클릭하세요 x=${cx.toFixed(1)} y=${cy.toFixed(1)}`);
    }
    render();
  });

  // ── 드래그 핸들: mousedown ────────────────────
  svg.addEventListener("mousedown", e => {
    if (!dartMoveState.active) return;
    const handle = e.target.closest(".dart-rotate-handle");
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    dartMoveState.dragging = true;
    svg.style.cursor = "grabbing";
  });

  // ── 드래그 핸들: 더블클릭 = 끝까지 이동 (userAngle = baseAngle, 이미 겹침 없는 한계로 clamp됨) ──
  svg.addEventListener("dblclick", e => {
    if (!dartMoveState.active) return;
    const handle = e.target.closest(".dart-rotate-handle");
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    dartMoveState.dragging = false;
    dartMoveState.userAngle = dartMoveState.baseAngle;
    const pivot = (dartMoveState.side === "back") ? _getDraftPts()?.E : _getDraftPts()?.BP;
    if (pivot && dartMoveState.cutPoint) {
      const openW = dartOpenWidth(dartMoveState.cutPoint, pivot, dartMoveState.userAngle);
      setHint(`끝까지 이동: ${openW.toFixed(1)}cm`);
    }
    render();
  });

  // ── hover: SVG 위 마우스 이동 시 선택 가능 외곽선 표시 ──────────
  svg.addEventListener("mousemove", e => {
    if (!dartMoveState.active) return;
    if (!dartMoveState.side) return;
    if (dartMoveState.dragging) return;
    if (dartMoveState.mode === "selectPiece") return;
    if (dartMoveState.cutPoint) return;
    if (e.target.closest(".dart-rotate-handle")) return;

    const [mx, my] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const dh = createDraft(B, W, BL);

    if (dartMoveState.side === "back") {
      const segsH = getBackTargetOutline(dh.pts, dh.formula, B);
      const hr = findCutPointBack({ x: mx, y: my }, segsH, dh.pts, dh.formula, B);
      if (hr && !hr.blocked) {
        dartMoveState.hoverPoint    = hr.point;
        dartMoveState.hoverSegIndex = hr.segIndex;
      } else {
        dartMoveState.hoverPoint    = null;
        dartMoveState.hoverSegIndex = -1;
      }
      render();
      return;
    }

    const segsH = getFrontTargetOutline(dh.pts, dh.formula, B);
    const hr = findCutPoint({ x: mx, y: my }, segsH, dh.pts);

    if (hr && !hr.blocked) {
      dartMoveState.hoverPoint    = hr.point;
      dartMoveState.hoverSegIndex = hr.segIndex;
    } else {
      dartMoveState.hoverPoint    = null;
      dartMoveState.hoverSegIndex = -1;
    }
    render();
  });

  // ── 드래그 핸들: mousemove ────────────────────
  window.addEventListener("mousemove", e => {
    if (!dartMoveState.active || !dartMoveState.dragging) return;
    if (!dartMoveState.cutPoint) return;

    const [mx, my] = eventToPatternPoint(e);
    const p = _getDraftPts();
    if (!p) return;

    // 회전 중심: 앞판=BP, 뒤판=E
    const pivot = (dartMoveState.side === "back") ? p.E : p.BP;

    // 마우스 방향각 - cutPoint 방향각 = userAngle
    const angleMouse = Math.atan2(my - pivot.y, mx - pivot.x);
    const angleCut   = Math.atan2(dartMoveState.cutPoint.y - pivot.y, dartMoveState.cutPoint.x - pivot.x);
    let userAngle = angleMouse - angleCut;

    // -π ~ π 정규화
    while (userAngle >  Math.PI) userAngle -= 2 * Math.PI;
    while (userAngle < -Math.PI) userAngle += 2 * Math.PI;

    // 드래그 범위 제한: 0 ~ baseAngle (겹침 방지)
    const base = dartMoveState.baseAngle;
    if (base >= 0) {
      userAngle = Math.max(0, Math.min(base, userAngle));
    } else {
      userAngle = Math.max(base, Math.min(0, userAngle));
    }

    dartMoveState.userAngle = userAngle;

    const openW = dartOpenWidth(dartMoveState.cutPoint, pivot, userAngle);
    const baseW = dartOpenWidth(dartMoveState.cutPoint, pivot, base);
    setHint(`다트 벌림: ${openW.toFixed(1)}cm / 최대 ${baseW.toFixed(1)}cm`);
    render();
  });

  // ── 드래그 핸들: mouseup ──────────────────────
  window.addEventListener("mouseup", e => {
    if (!dartMoveState.dragging) return;
    dartMoveState.dragging = false;
    svg.style.cursor = "";
    const _p = _getDraftPts();
    const _pivot = (dartMoveState.side === "back") ? _p?.E : _p?.BP;
    const finalW = (_p && _pivot && dartMoveState.cutPoint)
      ? dartOpenWidth(dartMoveState.cutPoint, _pivot, dartMoveState.userAngle).toFixed(1)
      : "?";
    setHint(`확정: ${finalW}cm — 적용 버튼을 눌러 완료`);
  });
}

// ── UI 헬퍼 ───────────────────────────────────
function setApplyEnabled(enabled) {
  const b = document.getElementById("btnDartApply");
  if (b) b.disabled = !enabled;
}

function setBtn(txt, bg) {
  const b = document.getElementById("btnDartMove");
  if (b) { b.textContent = txt; b.style.background = bg; }
}

function setHint(txt) {
  const h = document.getElementById("dartMoveHint");
  if (h) h.textContent = txt;
}

// 앞판/뒤판 선택 버튼 행 표시/숨김
function setSideRowVisible(visible) {
  const row = document.getElementById("dartSideRow");
  if (row) row.style.display = visible ? "" : "none";
}

// 앞판/뒤판 선택 버튼 활성 표시
function setSideActive(side) {
  const btnF = document.getElementById("btnDartSideFront");
  const btnB = document.getElementById("btnDartSideBack");
  if (btnF) btnF.style.background = side === "front" ? "#c05000" : "#e07800";
  if (btnB) btnB.style.background = side === "back"  ? "#c05000" : "#e07800";
}

// ══════════════════════════════════════════════
// 뒤판 어깨 다트이동 — Stage 2: 클릭/분할
// ══════════════════════════════════════════════

// ── 뒤판 cutPoint 탐색 (다트 끝점 근처 차단) ──
function findCutPointBack(clickPt, segments, p, f, B) {
  let best = null, bestD = Infinity, bestIndex = -1;
  segments.forEach((seg, idx) => {
    if (!isClickableSeg(seg)) return;
    const r = closestOnSeg(clickPt, seg.from, seg.to);
    if (r.d < bestD) { bestD = r.d; best = r.pt; bestIndex = idx; }
  });
  if (bestD > 2.0) return null;

  // dartCenter / dartEnd_ 근처 차단 (원본 도안 다트 끝점)
  const info = buildBackShoulderDartInfo(f, p, B);
  const minD = 1.2;
  const nearCenter = Math.hypot(best.x - info.dartCenter.x, best.y - info.dartCenter.y) < minD;
  const nearEnd    = Math.hypot(best.x - info.dartEnd_.x,   best.y - info.dartEnd_.y)   < minD;
  if (nearCenter || nearEnd) {
    return { blocked: true, reason: "dart-end", point: best, segIndex: bestIndex };
  }

  // baked 다트 mouth / pivot(E) 근접 차단 — 앞판과 동일한 이유
  if (p?.E) {
    const pivot = p.E;
    const nearPivot = Math.hypot(best.x - pivot.x, best.y - pivot.y) < minD;
    if (nearPivot) {
      return { blocked: true, reason: "baked-dart-mouth", point: best, segIndex: bestIndex };
    }
    for (const seg of segments) {
      if (!isDartLegType(seg)) continue;
      const dFrom = Math.hypot(seg.from.x - pivot.x, seg.from.y - pivot.y);
      const dTo   = Math.hypot(seg.to.x   - pivot.x, seg.to.y   - pivot.y);
      const mouthDist = Math.max(dFrom, dTo);
      if (mouthDist < minD) continue;
      const mouth = dFrom > dTo ? seg.from : seg.to;
      const nearMouth = Math.hypot(best.x - mouth.x, best.y - mouth.y) < minD;
      if (nearMouth) {
        return { blocked: true, reason: "baked-dart-mouth", point: best, segIndex: bestIndex };
      }
    }
  }

  return { point: best, segIndex: bestIndex, distance: bestD };
}

// ── 뒤판 다트 닫힘 각도 계산 ──────────────────
// E점 기준: dartEnd_ → dartCenter 방향으로 닫힘 (음수)
function calcBackCloseAngle(info) {
  const angleCenter = Math.atan2(info.dartCenter.y - info.apex.y, info.dartCenter.x - info.apex.x);
  const angleEnd    = Math.atan2(info.dartEnd_.y   - info.apex.y, info.dartEnd_.x   - info.apex.x);
  let closeAngle = angleCenter - angleEnd;  // 음수: dartEnd_ → dartCenter 방향
  while (closeAngle >  Math.PI) closeAngle -= 2 * Math.PI;
  while (closeAngle < -Math.PI) closeAngle += 2 * Math.PI;
  return { closeAngle };
}

function calcBackCloseAngleByRotateHit(info, rotateHit) {
  const angleCenter = Math.atan2(
    info.dartCenter.y - info.apex.y,
    info.dartCenter.x - info.apex.x
  );
  const angleEnd = Math.atan2(
    info.dartEnd_.y - info.apex.y,
    info.dartEnd_.x - info.apex.x
  );

  let closeAngle;
  if (rotateHit === "dartEnd") {
    // dartEnd_ 쪽이 움직이면 dartEnd_를 dartCenter 방향으로 닫는다
    closeAngle = angleCenter - angleEnd;
  } else if (rotateHit === "dartCenter") {
    // dartCenter 쪽이 움직이면 dartCenter를 dartEnd_ 방향으로 닫는다
    closeAngle = angleEnd - angleCenter;
  } else {
    closeAngle = angleCenter - angleEnd;
  }
  while (closeAngle >  Math.PI) closeAngle -= 2 * Math.PI;
  while (closeAngle < -Math.PI) closeAngle += 2 * Math.PI;
  return { closeAngle };
}

// ── 뒤판 "기본 다트량" 각도 크기 (몇 차 다트이동이든 항상 동일) ──
function calcBackBaseDartAngle(info) {
  const angleCenter = Math.atan2(info.dartCenter.y - info.apex.y, info.dartCenter.x - info.apex.x);
  const angleEnd    = Math.atan2(info.dartEnd_.y   - info.apex.y, info.dartEnd_.x   - info.apex.x);
  let a = angleCenter - angleEnd;
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return Math.abs(a);
}

// ── 뒤판 외곽선을 dartCenter/dartEnd_ 기준으로 두 조각 분할 ──
// fixedSegs  = dartCenter 포함 (고정)
// rotateSegs = dartEnd_   포함 (회전 대상)
function splitBackOutline(segments, cutPoint, cutSegIndex, p, f, B) {
  const info = buildBackShoulderDartInfo(f, p, B);

  const isNear = (a, b, eps = 0.05) => {
    if (!a || !b) return false;
    return Math.hypot(a.x - b.x, a.y - b.y) < eps;
  };

  const isDartCenter = pt => isNear(pt, info.dartCenter);
  const isDartEnd    = pt => isNear(pt, info.dartEnd_);
  const nn = segments.length;

  const isDartRelated = seg => seg.type === "back-shoulder-dart";

  function walkForward() {
    const pts  = [{ ...cutPoint }];
    const segs = [];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex + step) % nn;
      const seg = segments[idx];
      const next = { ...seg.to };
      if (seg.disabled && !isDartRelated(seg)) continue;
      const fromPt = (step === 0) ? { ...cutPoint } : { ...seg.from };
      segs.push({ from: fromPt, to: { ...seg.to }, type: seg.type, disabled: !!seg.disabled });
      pts.push(next);
      if (isDartCenter(next)) { hit = "dartCenter"; break; }
      if (isDartEnd(next))    { hit = "dartEnd";    break; }
    }
    return { pts, segs, hit };
  }

  function walkBackward() {
    const rawSegs = [];
    let hit = null;
    for (let step = 0; step < nn; step++) {
      const idx = (cutSegIndex - step + nn) % nn;
      const seg = segments[idx];
      const prev = seg.from;
      if (seg.disabled && !isDartRelated(seg)) continue;
      rawSegs.push(seg);
      if (isDartCenter(prev)) { hit = "dartCenter"; break; }
      if (isDartEnd(prev))    { hit = "dartEnd";    break; }
    }
    const segs = rawSegs.map(seg => ({
      from: { ...seg.to },
      to:   { ...seg.from },
      type: seg.type,
      disabled: !!seg.disabled,
    }));
    if (segs.length > 0) segs[0].from = { ...cutPoint };
    const pts = [{ ...cutPoint }];
    for (const seg of segs) pts.push({ ...seg.to });
    return { pts, segs, hit };
  }
  const forward  = walkForward();
  const backward = walkBackward();

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log('[splitBack] forward.hit:', forward.hit, 'pts:', forward.pts.length,
      'types:', forward.segs.map(s=>s.type).join(','));
    console.log('[splitBack] backward.hit:', backward.hit, 'pts:', backward.pts.length,
      'types:', backward.segs.map(s=>s.type).join(','));
  }

  const pathA = [...forward.pts,  { ...info.apex }, { ...cutPoint }];
  const pathB = [...backward.pts, { ...info.apex }, { ...cutPoint }];
  return {
    pieceA: { pts: pathA, segs: forward.segs,  hit: forward.hit  || "dartCenter", openPts: forward.pts  },
    pieceB: { pts: pathB, segs: backward.segs, hit: backward.hit || "dartEnd",    openPts: backward.pts },
  };
}

// ── 뒤판 어깨 다트 기하 정보 ──────────────────
// render.js drawBackShoulder()와 완전히 동일한 공식 사용
function buildBackShoulderDartInfo(f, p, B) {
  const deg18  = 18 * Math.PI / 180;
  const deg22  = 22 * Math.PI / 180;

  const bND = { x: f.bnw(), y: -f.bnd() };

  const fSNP_x2 = f.sw() - f.fnw();
  const armX2   = f.sw() - f.fw();
  const fShLen2 = (fSNP_x2 - armX2) / Math.cos(deg22) + 1.8;
  const bShLen2 = fShLen2 + B / 32 - 0.8;

  // bSP: render.js drawBackShoulder와 동일
  // (bND 기준이 아닌 bND에서 시작 — render.js는 bND에서 계산)
  const bSP = {
    x: bND.x + bShLen2 * Math.cos(deg18),
    y: bND.y + bShLen2 * Math.sin(deg18),
  };

  const shDx = Math.cos(deg18);
  const shDy = Math.sin(deg18);

  // E점이 어깨선 위 어느 t 위치에 있는지
  const t = (p.E.x - bND.x) / shDx;
  const dartCenterT = t + 1.5;

  const dartCenter = {
    x: bND.x + dartCenterT * shDx,
    y: bND.y + dartCenterT * shDy,
  };

  const dartLen = B / 32 - 0.8;

  const dartEnd_ = {
    x: dartCenter.x + dartLen * shDx,
    y: dartCenter.y + dartLen * shDy,
  };

  return { apex: p.E, dartCenter, dartEnd_, dartLen };
}

// ── 뒤판 외곽선 세그먼트 배열 ─────────────────
// 순서: A → BACK_WL → SIDE_BTM → SIDE_TOP
//       → [진동곡선: SIDE_TOP→bSP]
//       → dartEnd_ → E(꼭지점) → dartCenter
//       → bND → [목곡선: bND→A]
function buildBackOutline(p, f, B) {
  const segments = [];

  const deg18 = 18 * Math.PI / 180;
  const deg22 = 22 * Math.PI / 180;

  // ── 뒤판 기하 재계산 (render.js와 동일) ────
  const bND = { x: f.bnw(), y: -f.bnd() };

  const fSNP_x2 = f.sw() - f.fnw();
  const armX2   = f.sw() - f.fw();
  const fShLen2 = (fSNP_x2 - armX2) / Math.cos(deg22) + 1.8;
  const bShLen2 = fShLen2 + B / 32 - 0.8;

  const bSP = {
    x: bND.x + bShLen2 * Math.cos(deg18),
    y: bND.y + bShLen2 * Math.sin(deg18),
  };

  const { dartCenter, dartEnd_ } = buildBackShoulderDartInfo(f, p, B);

  // ── 고정 조각: dartCenter → bND → [목선] → A → BACK_WL → SIDE_BTM → SIDE_TOP → [진동] → bSP → dartEnd_ ──
  // 순서 설명:
  //   고정(dartCenter 포함): dartCenter → bND → 목선 → A → 뒤중심 → 허리 → 옆선 → 진동 → bSP → dartEnd_
  //   회전(dartEnd_ 포함):   dartEnd_ → [dart disabled] → dartCenter

  // ── 어깨선: dartCenter → bND ────────────────
  addLineSegment(segments, dartCenter, bND,      { type: "back-shoulder" });

  // ── 뒤목선 곡선: bND → A ────────────────────
  {
    const NH = state.bNeckH;
    if (NH && NH.h0 && NH.h1) {
      const neckPts = sampleCubic(bND, NH.h1, NH.h0, p.A, 10);
      addSampledSegments(segments, neckPts, { type: "back-neckline" });
    } else {
      addLineSegment(segments, bND, p.A, { type: "back-neckline" });
    }
  }

  // ── 뒤중심/허리/옆선 직선 ────────────────────
  addLineSegment(segments, p.A,        p.BACK_WL,  { type: "back-center" });
  addLineSegment(segments, p.BACK_WL,  p.SIDE_BTM, { type: "back-waist"  });
  addLineSegment(segments, p.SIDE_BTM, p.SIDE_TOP, { type: "side-seam"   });

  // ── 뒤진동 곡선: SIDE_TOP → bSP ─────────────
  {
    const H = state.armH;
    if (H && H.h2a && H.h1b && H.a1 && H.h1a && H.h0) {
      const back1 = sampleCubic(p.SIDE_TOP, H.h2a, H.h1b, H.a1, 8);
      const back2 = sampleCubic(H.a1,       H.h1a, H.h0,  bSP,  8);
      const backArmPts = [...back1, ...back2.slice(1)];
      addSampledSegments(segments, backArmPts, { type: "back-armhole" });
    } else {
      addLineSegment(segments, p.SIDE_TOP, bSP, { type: "back-armhole" });
    }
  }

  // ── 어깨선: bSP → dartEnd_ ──────────────────
  addLineSegment(segments, bSP,      dartEnd_,  { type: "back-shoulder" });

  // ── 어깨 다트 (disabled): dartEnd_ → E → dartCenter ──
  addLineSegment(segments, dartEnd_,  p.E,        { type: "back-shoulder-dart", disabled: true });
  addLineSegment(segments, p.E,       dartCenter, { type: "back-shoulder-dart", disabled: true });

  // ── DEBUG 검증 ──────────────────────────────
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    console.log('[buildBackOutline] 세그먼트 수:', segments.length);
    console.log('[buildBackOutline] 타입 순서:', segments.map(s => s.type).join(' → '));
    console.log('[buildBackOutline] disabled 세그먼트:', segments.filter(s => s.disabled).map(s => s.type));
    const info = buildBackShoulderDartInfo(f, p, B);
    console.log('[buildBackOutline] 다트info:', {
      apex:        JSON.stringify(info.apex),
      dartCenter:  JSON.stringify(info.dartCenter),
      dartEnd_:    JSON.stringify(info.dartEnd_),
      dartLen:     info.dartLen.toFixed(3),
    });
  }

  return segments;
}
