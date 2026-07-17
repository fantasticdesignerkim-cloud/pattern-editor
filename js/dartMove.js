// ══════════════════════════════════════════════
// 다트이동 — 실제 앞판 패턴선 기준 cutPoint 선택 + BP 절개선
// 기준: render.js가 그리는 앞판 최종 외곽선과 같은 계산 사용
// ══════════════════════════════════════════════


// ══════════════════════════════════════════════
// 【공용】 진단 로그
// ══════════════════════════════════════════════

// ── 다트이동 진단 로그: 이 한 함수로만 나간다 (DEBUG_DART_MOVE=false면 전부 무음) ──
function dbg(...args) {
  if (typeof DEBUG_DART_MOVE !== "undefined" && DEBUG_DART_MOVE) console.log(...args);
}

// ── bake 입력 정리: 조립용 내부선(구형 dart-leg / dart-bridge)만 제거 ──
// findPhysicalSweepLimit·evaluateEndpoint·applyDartMove가 bake 직전에 쓰던 동일 필터
// 3벌을 하나로 통합한다(로직·필터 순서·반환 배열 동일). endpointEquivalence.js의 사본은
// 독립 동결 기준이라 건드리지 않는다.
function cleanForBake(segs) {
  return (segs || []).filter(s => s?.from && s?.to && s.type !== "dart-leg" && s.type !== "dart-bridge");
}


// ══════════════════════════════════════════════
// 【GEOMETRY】 점·각도·회전·교차·거리 + 세그먼트 충돌 판정.
// 대부분은 점·세그먼트만 다루는 저수준 기하지만, findSelfIntersections·
// findRotationCollisions는 물리 검사 대상을 고를 때 세그먼트 타입 정책
// (isReferenceSeg / CURVE_SAMPLED_TYPES)을 참조하므로 완전히 도메인 무관하지는 않다.
// ══════════════════════════════════════════════

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

// 곡선 스침 허용오차(GRAZE_EPS)를 적용할 대상: ~1cm 간격 폴리라인으로 샘플링된
// 곡선 타입만. 직선(다트 다리, 허리/어깨 등)은 샘플링 오차가 없으므로 교차하면
// 그대로 진짜 겹침이다 — 여기 포함시키면 진짜 과회전을 "스침"으로 놓친다.
const CURVE_SAMPLED_TYPES = new Set([
  "back-armhole", "front-armhole-lower", "front-armhole-upper",
  "back-neckline", "front-neckline",
]);

// ── 자기교차 탐지 (물리 검사 대상만: 실제 외곽선 + 현재 열린/미완전히 닫힌 다트 다리) ──
// ⚠️ 완전한 도메인-무관 geometry가 아니다: isReferenceSeg(dart-bridge)와 세그먼트 타입
// 정책(CURVE_SAMPLED_TYPES)을 참조해 물리 검사 대상을 고른다. 순수 점·선 함수가 아님.
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
// ⚠️ findSelfIntersections와 마찬가지로 순수 geometry가 아니다 — isReferenceSeg로
// 세그먼트 타입을 걸러 검사 대상을 정한다.
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


// ══════════════════════════════════════════════
// 【TOPOLOGY】 notch 추출·split·bake·normalize — 폐곡선의 위상 조작.
// "현재 형상 하나"(젤리/물 지배 모델)를 자르고 재조립해 다시 하나로 만든다.
// 각도 정책(예산·안전각·부호)은 모르고, 주어진 각도로 형상만 만든다.
// ══════════════════════════════════════════════

function debugCheckSegmentContinuity(segs, label = "segments") {
  if (!Array.isArray(segs)) return;
  const dist = (a, b) => (!a || !b) ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
  const breaks = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const gap = dist(segs[i].to, segs[i + 1].from);
    if (gap > 0.05) breaks.push({ index: i, typeA: segs[i].type, typeB: segs[i + 1].type, gap });
  }
  dbg("[continuity]", label, { count: segs.length, breaks });
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

// ── normalizeBakedSegments: bake 결과를 "현재 형상 하나"로 정리 (젤리/물 모델 1단계) ──
// 지배 원칙(CLAUDE.md 최상단): 자르고→돌리고→붙이면 결과는 현재 형상 하나다.
// 한마디로: "닫힌 흔적은 녹이고, 열린 다트는 현재 외곽선으로 남긴다."
//
// 유일 불변식 (케이스별 삭제가 아니라 이 하나로 통합):
//   제거 = pivot을 떠나 pivot으로 되돌아오되 "입"(두 바깥 끝점 거리)이 0인 다트 다리쌍.
//          = 면적 0 서브패스 = 닫힌 다트 / 폭0 다트 / pivot 왕복 스파이크 /
//            역방향 중복 다리 / 0폭으로 닫힌 과거 legOld. (전부 이 조건 하나)
//   유지 = 입이 벌어진(면적>0) 다리쌍 = 지금 열린 다트 = 현재 외곽선. 부채꼴 다중다트 포함.
// bake 출력은 이미 pivot→…→pivot 순서 루프라 이 판정이 로컬하게 성립한다.
//
// EPS_CLOSED_DART=0.05cm 근거 (2026-07-08 실측, 무작위 50런×6세대 = 다리쌍 488개):
//   닫힌 다트는 정확히 0.00cm에 응집(두 다리 완전 중첩, float drift<1e-4).
//   적용 가능한 가장 작은 정상 다트 입 ≈ 0.087cm(0.5°×짧은 다리, MIN_DART_ANGLE_RAD 하한).
//   0.05는 그 사이 빈 구간 — 닫힘만 녹이고 실제 다트는 전부 보존한다(지우는 쪽이 아니라
//   남기는 쪽으로 안전하게 치우침). 검증: normalize를 3열림 부채꼴에 적용해도 3열림 유지,
//   세대 간 refeed에서도 2열림 다중다트 도달 가능(열린 다트 파괴 0).
const EPS_CLOSED_DART = 0.05;

function normalizeBakedSegments(segs, pivot) {
  if (!Array.isArray(segs) || segs.length === 0 || !pivot) return segs;
  const isLeg = (s) => s && (s.type === "dart-leg-new" || s.type === "dart-leg-old");
  const near  = (a, b, e) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < e;

  // 1) 폭 0(퇴화) 세그먼트 먼저 제거
  let arr = segs.filter(s => s && s.from && s.to &&
    Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y) > 1e-6);

  // 2) 닫힌 다리쌍(면적 0 서브패스) 반복 제거 — 삼중 이상 겹침도 fixpoint까지 벗겨냄.
  //    루프 시작(legOut)·끝(legIn)은 현재 열린 다트라 a.to가 pivot이 아니거나 입이
  //    벌어져 있어 이 조건에 안 걸린다(제거 대상은 항상 배열 내부의 닫힌 잔재).
  let changed = true, guard = 0;
  while (changed && guard++ < 1000) {
    changed = false;
    for (let i = 0; i < arr.length; i++) {
      const iN = (i + 1) % arr.length;
      const a = arr[i], b = arr[iN];
      if (isLeg(a) && isLeg(b) &&
          near(a.to,   pivot, EPS_CLOSED_DART) &&
          near(b.from, pivot, EPS_CLOSED_DART) &&
          near(a.from, b.to,  EPS_CLOSED_DART)) {
        // 제거 전 이음새 스냅: 앞 세그먼트 끝점을 뒤 세그먼트 시작점에 정확히 맞춰
        // 연속성 보존(닫힌 다트는 실측상 정확히 0폭이라 대개 no-op, drift 방어용).
        const prev = arr[(i - 1 + arr.length) % arr.length];
        const next = arr[(iN + 1) % arr.length];
        if (prev && next && prev !== next && prev !== a && next !== b) {
          next.from = { ...prev.to };
        }
        arr = arr.filter((_, k) => k !== i && k !== iN);
        changed = true;
        break;
      }
    }
  }
  return arr;
}

// ── sumOpenDartAngle: 현재 열린 다트들의 pivot(BP) 기준 각도 합 (라디안) ──
// 다트 예산 게이트의 "used" 측정값. 반드시 각도로 계산한다 — 폭(mouthWidth)은 pivot
// 거리에 비례해 보존되지 않으므로 예산 회계에 쓰면 안 된다(2026-07-03 #5의 교훈).
// 열린 다트 = normalize를 통과한, 입(두 바깥 끝점)이 EPS_CLOSED_DART 이상 벌어진
// 인접 다리쌍. 각 쌍의 두 바깥 끝점이 pivot에서 이루는 사잇각을 더한다.
function sumOpenDartAngle(segs, pivot) {
  if (!Array.isArray(segs) || segs.length === 0 || !pivot) return 0;
  const isLeg = (s) => s && (s.type === "dart-leg-new" || s.type === "dart-leg-old");
  const near  = (a, b, e) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < e;
  let total = 0;
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i], b = segs[(i + 1) % segs.length];
    if (isLeg(a) && isLeg(b) &&
        near(a.to, pivot, EPS_CLOSED_DART) &&
        near(b.from, pivot, EPS_CLOSED_DART) &&
        Math.hypot(a.from.x - b.to.x, a.from.y - b.to.y) >= EPS_CLOSED_DART) {
      const v1x = a.from.x - pivot.x, v1y = a.from.y - pivot.y;
      const v2x = b.to.x   - pivot.x, v2y = b.to.y   - pivot.y;
      total += Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y));
    }
  }
  return total;
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

  const isNear = (a, b, eps = 1e-3) => a && b && Math.hypot(a.x-b.x, a.y-b.y) < eps;
  const isPivot = (pt) => isNear(pt, pivot);
  const segTouchesPivot = (seg) => isPivot(seg?.from) || isPivot(seg?.to);
  // 다중다트 상태에서는 dart-leg가 pivot→mouth, mouth→pivot 양방향으로 모두 존재한다.
  // segTouchesPivot 하나로는 방향을 구분 못 해 "pivot에서 출발하는" 세그먼트까지
  // 포함하고 지나쳐버릴 수 있으므로, forward/backward 각각 진행 방향 기준
  // "도착"(포함하고 정지)과 "출발"(포함하지 않고 정지)을 구분한다.

  // 1. forward: cutSegIndex 자신부터 시작해 첫 pivot 도달까지 (뒷부분, cutSegIndex 세그먼트 포함)
  const cutSeg = segments[cutSegIndex];

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

  // ── notch-instance 태깅 (2026-07 3차 재설계: 차단 대신 각 조각에 source notch 부착) ──
  // 예전(2차)엔 forward·backward가 서로 다른 notch instance에 닿으면(Case B) 둘 다
  // rest로 강제 편입해 차단했는데, 이건 과도했다. forward가 도달한 notch는 pieceA의
  // 회전에만, backward가 도달한 notch는 pieceB의 회전에만 관련이 있다 — 사용자가
  // 둘 중 하나만 회전 조각으로 선택하므로, 선택 안 된 쪽 notch는 애초에 회전과 무관
  // (선택 안 된 조각은 고정되고, 그 notch의 다리도 그 안에서 안 움직인 채 남는다).
  // 그러니 "서로 다르면 차단"할 이유가 없다 — 각 조각에 **자기 자신의** source notch만
  // 정확히 붙여주면 충분하다. Case A(forward·backward가 같은 notch)든 Case B(다름)든
  // 이 태깅 로직 자체는 동일하다: pieceA.sourceNotch = forwardNotch,
  // pieceB.sourceNotch = backwardNotch. forwardSteps/backwardSteps는 원래 위상 계산
  // (raw walk) 그대로 쓴다 — 더 이상 강제로 줄이지 않는다.
  //
  // 다른 모든 notch는 forward/backward가 애초에 도달할 수 없으므로(각 방향에서
  // 가장 가까운 다리에서 무조건 멈춤) rest에 그대로 남고, 회전과 무관해 안전하다.
  //
  // 현재 outline의 모든 notch instance 나열 (인접한 두 boundary 세그먼트가 각각
  // mouth→pivot / pivot→mouth로 만나는 지점 — sumOpenDartAngle과 동일 정의).
  // 타입은 "지금 열린 다트 입구"를 의미하는 dart-leg-new/dart-leg-old로만 제한한다
  // (isBakedBoundarySeg는 walk의 정지 판정용으로 dart-bridge/plain dart-leg도
  // 포함하는데, 이 두 타입은 현재 bake 파이프라인에서 실제로 생성되지 않는
  // 레거시/내부 연결 타입이라 "열린 aperture"로 취급하면 안 된다 — notch 판정만
  // 방어적으로 좁힌다).
  const isOpenLegType = (seg) => seg?.type === "dart-leg-new" || seg?.type === "dart-leg-old";
  const notchInstances = [];
  for (let idx = 0; idx < nn; idx++) {
    const a = segments[idx], b = segments[(idx + 1) % nn];
    if (isOpenLegType(a) && isOpenLegType(b) && isPivot(a?.to) && isPivot(b?.from)) {
      notchInstances.push({ legIdxA: idx, legIdxB: (idx + 1) % nn });
    }
  }
  const notchInstanceOf = (idx) =>
    notchInstances.find(ni => ni.legIdxA === idx || ni.legIdxB === idx) || null;

  // forward walk가 실제로 도달해 정지한 boundary 다리(있다면)
  let forwardBoundaryIdx = -1;
  if (forwardSteps > 0) {
    const idx = (cutSegIndex + forwardSteps - 1 + nn) % nn;
    if (isPivot(segments[idx]?.to)) forwardBoundaryIdx = idx;
  }
  // backward walk가 실제로 도달해 정지한 boundary 다리(있다면, 원본 인덱스 기준)
  let backwardBoundaryIdx = -1;
  if (backwardSteps > 0) {
    const idx = (backStart - backwardSteps + 1 + nn) % nn;
    if (isPivot(segments[idx]?.from)) backwardBoundaryIdx = idx;
  }

  const forwardNotch  = forwardBoundaryIdx  >= 0 ? notchInstanceOf(forwardBoundaryIdx)  : null;
  const backwardNotch = backwardBoundaryIdx >= 0 ? notchInstanceOf(backwardBoundaryIdx) : null;

  // notch instance → {apertureRad, movingMouth, targetMouth} 로 변환. pieceA(forward)는
  // legIdxA 다리(mouth→pivot, .from이 mouth)를 회전시켜 legIdxB의 mouth(.to)로 보내야
  // 닫힌다. pieceB(backward)는 legIdxB 다리(pivot→mouth, .to가 mouth)를 회전시켜
  // legIdxA의 mouth(.from)로 보내야 닫힌다. 회전은 항상 같은 pivot 중심이라 두 mouth는
  // 항상 같은 반지름이다(각도만 맞으면 정확히 겹침).
  const angleOf = (pt) => Math.atan2(pt.y - pivot.y, pt.x - pivot.x);
  const norm = (a) => { while (a > Math.PI) a -= 2*Math.PI; while (a <= -Math.PI) a += 2*Math.PI; return a; };
  function buildSourceNotch(ni, role) {
    if (!ni) return null;
    const legA = segments[ni.legIdxA], legB = segments[ni.legIdxB];
    const movingMouth = role === 'A' ? legA.from : legB.to;
    const targetMouth  = role === 'A' ? legB.to   : legA.from;
    // signedAngleRad: movingMouth를 pivot 중심으로 이 각도만큼 회전하면 정확히
    // targetMouth 방향에 도달한다(둘 다 pivot에서 항상 같은 반지름 — 이 엔진의 모든
    // 회전이 같은 pivot 중심이라 반지름이 보존됨). 부호 있는 값 그대로 저장해
    // 호출부가 회전 방향을 바로 알 수 있게 한다. apertureRad는 그 절댓값(크기)만.
    const signedAngleRad = norm(angleOf(targetMouth) - angleOf(movingMouth));
    return { movingMouth: { ...movingMouth }, targetMouth: { ...targetMouth },
      signedAngleRad, apertureRad: Math.abs(signedAngleRad) };
  }
  const forwardSourceNotch  = buildSourceNotch(forwardNotch,  'A');
  const backwardSourceNotch = buildSourceNotch(backwardNotch, 'B');

  dbg('[notchInstanceTag]', {
    notchInstanceCount: notchInstances.length,
    forwardBoundaryIdx, backwardBoundaryIdx,
    forwardApertureDeg: forwardSourceNotch ? +(forwardSourceNotch.apertureRad*180/Math.PI).toFixed(2) : null,
    backwardApertureDeg: backwardSourceNotch ? +(backwardSourceNotch.apertureRad*180/Math.PI).toFixed(2) : null,
    caseKind: (forwardNotch && backwardNotch)
      ? (forwardNotch.legIdxA === backwardNotch.legIdxA ? 'sameNotch' : 'differentNotch')
      : 'oneSidedOrNone',
  });

  const restSteps = maxBackward - backwardSteps; // 양쪽 국소 조각 사이의 "항상 고정" 영역 (더 이상 트림 없음)

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
  // maxBackward가 아니라 restSteps 기준으로 순회해야 한다: rest는 pieceA/pieceB
  // 양쪽 국소 조각 사이의 "항상 고정" 영역 전체이므로, segsBFull이 이걸 전부
  // 포함해야 fixedSegs로 쓰였을 때 루프(전체 폐곡선)가 끊기지 않는다.
  for (let step = backwardSteps; step < backwardSteps + restSteps; step++) {
    const idx = (backStart - step + nn) % nn;
    const seg = segments[idx];
    segsBFull.push({ ...seg, from: { ...seg.to }, to: { ...seg.from }, type: seg.type, disabled: !!seg.disabled });
  }

  dbg('[splitBaked] A:', segsA.length, 'B:', segsB.length, 'rest:', restSteps,
    'fwd:', forwardSteps, 'bwd:', backwardSteps, 'nn:', nn,
    '합(A+B+rest):', forwardSteps + backwardSteps + restSteps);

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

  // sourceNotch: 이 조각이 "회전 조각"으로 선택됐을 때 닫아야 할 기존 열린 notch
  // (있다면). null이면 이 방향엔 닿은 기존 다트가 없다는 뜻 — gen-0처럼 완전히
  // 새 notch를 여는 경우이므로 호출부가 rawBase(기본 다트량)를 그대로 쓴다.
  const pieceA = { pts: closePolygonPts(ptsA), segs: segsA, segsFull: segsAFull, hit: "mouthA", openPts: ptsA, sourceNotch: forwardSourceNotch };
  const pieceB = { pts: closePolygonPts(ptsB), segs: segsB, segsFull: segsBFull, hit: "mouthB", openPts: ptsB, sourceNotch: backwardSourceNotch };

  return { pieceA, pieceB };
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

  // DEBUG_DART_MOVE가 꺼져 있어도 인자 표현식(map/join/JSON.stringify)은 dbg() 호출
  // 전에 먼저 평가된다 — 무거운 로그 데이터는 이 가드 안에서만 계산한다.
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    dbg('[split] forward.hit:', forward.hit, 'pts:', forward.pts.length, 'segs:', forward.segs.length);
    dbg('[split] backward.hit:', backward.hit, 'pts:', backward.pts.length, 'segs:', backward.segs.length);
    dbg('[split] GG:', JSON.stringify(GG));
    dbg('[split] p.G:', JSON.stringify(p.G));
    dbg('[split] forward types:', forward.segs.map(s=>s.type).join(','));
    dbg('[split] backward types:', backward.segs.map(s=>s.type).join(','));
    const fS = forward.segs, bS = backward.segs;
    dbg('[check] forward  segs[0].from:', JSON.stringify(fS[0]?.from), '/ segs[last].to:', JSON.stringify(fS[fS.length-1]?.to));
    dbg('[check] backward segs[0].from:', JSON.stringify(bS[0]?.from), '/ segs[last].to:', JSON.stringify(bS[bS.length-1]?.to));
    dbg('[check] cutPoint:', JSON.stringify(cutPoint), '/ G:', JSON.stringify(p.G), '/ GG:', JSON.stringify(GG));
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

  dbg('[splitBack] forward.hit:', forward.hit, 'pts:', forward.pts.length,
    'types:', forward.segs.map(s=>s.type).join(','));
  dbg('[splitBack] backward.hit:', backward.hit, 'pts:', backward.pts.length,
    'types:', backward.segs.map(s=>s.type).join(','));

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
  // buildBackOutline은 렌더/호버마다 호출되는 hot path라, map/filter/join은
  // DEBUG_DART_MOVE가 켜져 있을 때만 계산한다(dbg() 자체는 인자를 먼저 평가하므로
  // 가드 없이 넘기면 꺼져 있어도 매번 순회 비용이 든다).
  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    dbg('[buildBackOutline] 세그먼트 수:', segments.length);
    dbg('[buildBackOutline] 타입 순서:', segments.map(s => s.type).join(' → '));
    dbg('[buildBackOutline] disabled 세그먼트:', segments.filter(s => s.disabled).map(s => s.type));
    const info = buildBackShoulderDartInfo(f, p, B);
    dbg('[buildBackOutline] 다트info:', {
      apex:        JSON.stringify(info.apex),
      dartCenter:  JSON.stringify(info.dartCenter),
      dartEnd_:    JSON.stringify(info.dartEnd_),
      dartLen:     info.dartLen.toFixed(3),
    });
  }

  return segments;
}


// ══════════════════════════════════════════════
// 【ENGINE】 다트량·회전 방향·안전각·후보 평가 — 각도 정책.
// 순수 함수 구역: DOM(n("inpB") 등)도 dartMoveState도 읽지 않는다.
// 필요한 값(pivot/budget/segments)은 전부 인자로 받는다 — UI와 테스트 하네스가
// 이 구역을 공유한다(prepareDartMoveCandidate). 향후 evaluateMove 4계층 분리의 터.
// ══════════════════════════════════════════════

// 이보다 작은 각도의 다트는 만들지 않는다 (0.5° ≈ pivot에서 20cm 거리 기준 폭
// 0.17cm). 안전각이 이 밑으로 깎였다는 건 그 위치에 회전 공간이 없다는 뜻이고,
// 그대로 적용하면 입구가 안 벌어진 퇴화 다트(같은 자리에 겹친 다리 두 개 =
// 화면에 남는 방사형 잔선)만 생긴다.
const MIN_DART_ANGLE_RAD = 0.5 * Math.PI / 180;

// 다트 예산 게이트 허용폭 (budgetMaxAngle·applyDartMove 공용). 실측 분포 이봉형
// (정상 ≤1.05× / 병리 ≥2×)의 빈 구간이라 1.15×는 임시 허용폭 — 1.25×까지 안전.
const DART_BUDGET_TOL = 1.15;

// ── 다트 다리 타입 판별 / 클릭 가능 판별 ─────────
// ── G점을 BP 중심으로 회전시켜 GG(가슴다트 닫힌 위치) 계산 ──
// buildFrontOutline의 GG 산출 공식과 동일 (B/4 - 2.5도 회전).
// ★ 이 함수는 ENGINE 구역에 있지만 TOPOLOGY(splitFrontOutline)·ENGINE(calcFrontBaseDartAngle)·
//   CONTROLLER(getFrontTargetOutline)가 함께 쓰는 Bunka 다트 공식 helper다. 구역 경계는
//   관례일 뿐이며(모듈 없는 전역 스코프) 위치는 이동하지 않는다.
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

// ══════════════════════════════════════════════
// evaluateMove 4계층 ② — findPhysicalSweepLimit (2026-07 C2)
// ══════════════════════════════════════════════
// **책임: 회전 조각이 0→θ로 움직이는 "실제 경로"의 물리적 도달 한계.**
// endpoint가 나중에 다시 안전해져도 조각 충돌을 통과할 수는 없다 — 그래서 이 한계는
// ①(evaluateEndpoint)과 독립이고, ③(findApplicableIntervals)은 반드시 이 한계
// **내부에서만** 스캔한다.
//
// 여기서 하지 않는 것(계층 계약):
//   - endpoint 검사 없음 (①의 책임)
//   - budget 검사 없음 (①의 reason)
//   - 캐시 없음
//
// blockedBy:
//   null              — 요청각까지 그대로 도달
//   'leg-barrier'     — rotationLegBarrier가 먼저 제한
//   'piece-collision' — 조각 충돌이 더 먼저 제한
//   두 제한이 ε 이내 동률이면 **기존 실행 순서(배리어 먼저)를 보존해 'leg-barrier'**.
//
// 로직은 기존 findMaxSafeAngle에서 **그대로 옮겨 왔다** — 샘플 수(60)·이분탐색
// 횟수(18)·물리 충돌 알고리즘 전부 불변. 새로 제공하는 건 blockedBy와 scan 정보뿐.
const SWEEP_TIE_EPS_RAD = 1e-6;

function findPhysicalSweepLimit(fixedSegsRaw, rotateSegsRaw, pivot, targetAngle, cutPoint) {
  // signed zero와 부호를 기존 함수와 동일하게 보존한다(targetAngle을 그대로 반환).
  if (Math.abs(targetAngle) < 1e-9) {
    return { limitRad: targetAngle, blockedBy: null, scan: null };
  }
  const fixedClean  = cleanForBake(fixedSegsRaw);
  const rotateClean = cleanForBake(rotateSegsRaw);
  if (fixedClean.length === 0 || rotateClean.length === 0) {
    return { limitRad: targetAngle, blockedBy: null, scan: null };
  }

  // 1) 각도 배리어: 회전 다리가 기존 다트 다리를 지나치지 못하게 상한을 먼저 좁힌다.
  const cut = cutPoint || rotateClean[0]?.from || fixedClean[0]?.from;
  const barrierAngle = rotationLegBarrier(fixedClean, pivot, cut, targetAngle);
  const effTarget = (Math.abs(barrierAngle) < Math.abs(targetAngle)) ? barrierAngle : targetAngle;
  const barrierLimited = Math.abs(effTarget) < Math.abs(targetAngle) - SWEEP_TIE_EPS_RAD;
  if (Math.abs(effTarget) < 1e-9) {
    dbg('[findMaxSafeAngle] 각도 배리어로 0까지 축소 (기존 다트 다리 인접)');
    return { limitRad: effTarget, blockedBy: "leg-barrier", scan: null };
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
  if (firstUnsafeStep === -1) {
    // 경로 전체가 안전 (배리어 한계까지)
    return { limitRad: effTarget, blockedBy: barrierLimited ? "leg-barrier" : null,
      scan: { steps: SCAN_STEPS, firstUnsafeStep: -1 } };
  }

  // 마지막으로 안전이 확인된 스텝과 처음 겹친 스텝 사이만 이분 탐색 — 18회면
  // 스캔 간격(effTarget/SCAN_STEPS) 기준 오차가 무시할 수준까지 좁혀진다.
  let lo = effTarget * ((firstUnsafeStep - 1) / SCAN_STEPS);
  let hi = effTarget * (firstUnsafeStep / SCAN_STEPS);
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (crossesAt(mid)) hi = mid; else lo = mid;
  }
  dbg('[findMaxSafeAngle] 축소:', (targetAngle*180/Math.PI).toFixed(2), '° →',
    (lo*180/Math.PI).toFixed(2), '° (배리어:', (effTarget*180/Math.PI).toFixed(2),
    '°, 첫 겹침 스텝:', firstUnsafeStep, '/', SCAN_STEPS, ')');
  // 충돌이 배리어 한계와 ε 이내로 동률이면 기존 실행 순서를 보존해 leg-barrier로 본다.
  const tie = barrierLimited && Math.abs(Math.abs(lo) - Math.abs(effTarget)) <= SWEEP_TIE_EPS_RAD;
  return { limitRad: lo, blockedBy: tie ? "leg-barrier" : "piece-collision",
    scan: { steps: SCAN_STEPS, firstUnsafeStep } };
}

// ── 다트이동 후보 준비 (2026-07 추출) — UI와 테스트가 함께 쓰는 순수 평가 함수 ──
//
// 조각을 선택한 시점에 "이 조각을 어느 방향으로 얼마까지 돌릴 수 있는가"를 결정하는
// 오케스트레이션. 예전엔 이 순서가 initDartMoveClickHandler와 테스트 하네스
// (test/harness/dartDriver.js)에 **각각 복제**돼 있어서 한쪽만 고치면 조용히 어긋났다.
// 이제 두 호출자가 이 함수 하나를 공유한다 — 하네스가 실제 앱 경로를 대표한다는 게
// 구조적으로 보장된다.
//
// **순수 함수**: DOM(`n("inpB")` 등)도 `dartMoveState`도 읽지 않고, 입력 객체
// (segments/rotatePiece/fixedPiece)를 변형하지 않는다. 필요한 값은 전부 인자로 받는다.
// 이것이 향후 `evaluateMove` 4계층 분리(evaluateEndpoint / findPhysicalSweepLimit /
// findApplicableIntervals / resolveRequestedAngle)의 첫 발판이다.
//
// @param {object}  pivot            회전 중심 (앞판 BP / 뒤판 E)
// @param {number}  budgetRad        이 옷 전체의 기본 다트각 "예산"(양수)
// @param {number}  rawBaseAngleRad  gen-0 경로의 시작 각도 크기(양수, calc*BaseDartAngle).
//                                   현재 budgetRad와 같은 값이지만 역할이 달라 분리해 받는다.
// @param {object}  cutPoint
// @param {object}  rotatePiece      { segs, pts, sourceNotch? }
// @param {object}  fixedPiece       { segs, segsFull? }
// @param {Array}   prevBakedSegments 이동 전 저장 형상(델타 게이트 기준선). 없으면 null.
// @param {number}  minDartAngleRad  퇴화 다트 차단 하한(기본 MIN_DART_ANGLE_RAD)
// @returns {{closeAngleRad:number, sourceNotch:object|null,
//            sourceApertureBeforeRad:number|null, selection:object, evalCtx:object,
//            valid:boolean, reason:string|null}}
//   `selection`은 `selectRotationSign`의 반환 그대로다 — 부호별 판단 근거(물리 한계·
//   도달 가능 각도·막은 이유·평가 횟수)가 전부 보인다.
//   `evalCtx`는 ①~④가 공유하는 평가 컨텍스트(자기교차 기준선까지 채워진 것)다.
//   **드래그 중 ④(resolveRequestedAngle)가 이걸 그대로 받아 쓴다** — 조각 선택이 끝난 뒤
//   같은 ctx를 다시 조립하면 기준선을 mousemove마다 다시 계산하게 된다. 호출부는 이
//   객체를 **변형하지 않는다**(불변 취급 — purityCheck가 감시).
//   **⚠️ C4에서 `limits`(physicalRad/budgetRad/applySafeRad 단계별 캡)를 대체했다.**
//   그 세 캡은 이제 존재하지 않는다 — ②가 물리 한계를 정하고, 예산·자기교차 델타·
//   연속성은 ①의 endpoint 평가 **하나**에 접혀 판정되므로 "예산 캡 통과 후 각도" 같은
//   중간 단계 자체가 없다. 없는 단계를 null로 남기는 것보다 실제 구조를 노출하는 게
//   정직하다(gen-0에서 limits가 전부 null이던 것도 이걸로 해소된다).
//   `reason`은 여전히 호출부용 차단 사유("no-room")다 — 선택 근거는 `selection.reason`.
function prepareDartMoveCandidate({
  pivot, budgetRad, rawBaseAngleRad, cutPoint, rotatePiece, fixedPiece,
  prevBakedSegments = null, minDartAngleRad = MIN_DART_ANGLE_RAD,
}) {
  // 고정 조각은 rest(항상-고정 영역)까지 포함한 전체 체인 사용 (baked 다중다트).
  // 1차(splitFront/BackOutline)는 segsFull이 없으므로 기존 segs 그대로 사용.
  const rotateSegs = rotatePiece.segs;
  const fixedSegs  = fixedPiece.segsFull || fixedPiece.segs;
  const sourceNotch = rotatePiece.sourceNotch || null;

  // ①~④가 공유하는 평가 컨텍스트. 자기교차 기준선은 `prevBakedSegments` 하나로 정해져
  // **이 조각 선택 내내 불변**이므로 여기서 한 번만 구한다 — 두 부호(C4)뿐 아니라 이어질
  // **드래그의 ④(C5)까지** 같은 값을 나눠 쓴다(mousemove마다 다시 구하면 순수 낭비).
  // selectRotationSign의 withSelfXBaseline은 이미 채워진 ctx를 그대로 통과시킨다 —
  // 값의 출처는 여전히 prevBakedSegments 하나다.
  const evalCtx = withSelfXBaseline({
    fixedSegs, rotateSegs, pivot, budgetRad, prevBakedSegments, sourceNotch,
  });

  let geomSign;
  if (sourceNotch) {
    // 회전 조각이 기존 열린 notch(source)의 다리 하나를 물고 있다. 목표는 그 notch를
    // "정확히" 닫는 것 — 부호는 그 notch에서 직접 유도한다. 반대 부호는 닫는 게 아니라
    // 더 벌리므로 후보가 아니다(그 규칙은 selectRotationSign이 갖고 있다).
    geomSign = Math.sign(sourceNotch.signedAngleRad) || 1;
  } else {
    // 닿은 기존 notch가 없음(gen-0 또는 완전히 새 위치) — 이 옷 전체의 기본 다트량을
    // 시작점으로 쓰고, 기하 판정으로 **1차 힌트**만 잡는다. 최종 부호는 선택기가 두 부호의
    // 도달 가능 각도를 비교해 정하고, 기하 부호는 동률일 때만 tie-breaker로 쓰인다.
    let baseAngle = rawBaseAngleRad;
    if (rotatePiece.pts && rotatePiece.pts.length >= 3) {
      baseAngle = choosePhysicalCloseAngle({
        pivot, cutPoint, rotatePts: rotatePiece.pts, absAngle: baseAngle,
      });
    }
    geomSign = Math.sign(baseAngle) || 1;
  }

  // ── C4: 부호와 각도를 ②→탐색 체인 하나로 결정한다 ──
  // 예전엔 부호마다 findMaxSafeAngle → budgetMaxAngle → applyTimeSafeAngle **세 스캔**을
  // 따로 돌렸다(gen-0이면 6회, bake 50회). 이제 ②가 물리 한계를 정하고
  // findMaxApplicableMagnitude가 그 안의 최대 적용 가능 각도를 위에서부터 찾는다 —
  // 예산·자기교차 델타·연속성이 ①의 endpoint 평가 하나에 접힌다.
  const selection = selectRotationSign(evalCtx, {
    baseMagRad: Math.abs(rawBaseAngleRad), cutPoint, geomSign,
  });
  const closeAngleRad = selection.selectedSign * selection.selectedMaxReachableMagRad;
  dbg('[closeAngle]', sourceNotch ? 'source notch 재분배' : 'gen-0/신규 위치',
    '— reason:', selection.reason, 'finalDeg:', (closeAngleRad*180/Math.PI).toFixed(2));

  // 회전 공간이 사실상 없으면(안전각 0.5° 미만) 호출부가 차단한다 — 이대로 적용하면
  // 겹침은 없지만 입구가 안 벌어진 퇴화 다트(다리 두 개가 같은 자리에 겹친 방사선)가
  // 남는다(실측: 무작위 재현에서 "필요없는 선" 잔선의 직접 원인이 이 케이스였음).
  const valid = Math.abs(closeAngleRad) >= minDartAngleRad;

  return {
    closeAngleRad,
    sourceNotch,
    sourceApertureBeforeRad: sourceNotch ? sourceNotch.apertureRad : null,
    selection,
    evalCtx,
    valid,
    reason: valid ? null : "no-room",
  };
}

// ══════════════════════════════════════════════
// evaluateMove 4계층 ① — evaluateEndpoint (2026-07 C1)
// ══════════════════════════════════════════════
// **책임: 특정 각도로 bake→normalize한 "최종 형상"만 평가한다.** 그 외 전부 남의 일:
//   - `piece-collision`은 ②(findPhysicalSweepLimit)의 책임 — 여기서 검사하지 않는다.
//     같은 검사를 양쪽에 중복시키는 건 "no part" 위반이다.
//   - 로그/사용자 문구는 controller의 책임 — 이 함수는 **조용하다**(60스텝×양쪽 부호로
//     불릴 것이라 여기서 로그를 찍으면 느리고 로그가 폭발한다).
//   - DOM(`n("inpB")` 등)도 `dartMoveState`도 읽지 않고, 입력을 변형하지 않는다.
//   - source 보존은 `metrics.conservationErrRad`로 **측정만** 한다 — 차단하지 않는다.
//     (게이트화는 동작 변경이므로 별도 기능 변경으로 검토)
//
// reasons는 이 넷으로 제한한다(확정된 계층 계약):
//   'discontinuous'      — 세그먼트 체인이 끊김(연속성)
//   'loop-open'          — 폐곡선이 안 닫힘(마지막 to ≠ 첫 from)
//   'self-intersection'  — 이동 전 형상 대비 자기교차가 늘어남(델타)
//   'budget-exceeded'    — 열린 다트각 합 > budget×DART_BUDGET_TOL
//
// @param ctx {{ fixedSegs, rotateSegs, pivot, budgetRad, prevBakedSegments, sourceNotch,
//               baselineSelfXCount? }}
//   fixedSegs/rotateSegs는 cleanForBake를 이미 통과한 것으로 간주하지 않는다 —
//   여기서 동일 기준으로 필터한다(호출부가 잊어도 안전하도록).
//   `baselineSelfXCount`는 **선택적 최적화 입력**이다(생략하면 prevBakedSegments에서
//   직접 계산 — 동작은 완전히 동일하다). 자기교차 델타의 기준선은 `prevBakedSegments`
//   하나로 정해지므로 **스캔 내내 불변**인데, 예전엔 매 호출마다 다시 계산했다(③의
//   60스텝 스캔이면 115회 중 114회가 순수 낭비 — C3 실측). 스캔하는 쪽이 한 번 구해
//   넘기면 캐시(Map) 없이 구조로 사라진다. **값의 출처는 여전히 prevBakedSegments
//   하나이고, 넘기든 안 넘기든 결과는 같아야 한다**(harness가 동치를 상시 검증).
// @returns {{ angleRad, shape, valid, reasons, metrics }}
//   shape는 **불변 스냅샷으로 취급**한다 — 호출부가 좌표를 고치면 안 된다(preview와
//   apply가 같은 객체를 공유하게 될 C6의 전제).
const EVAL_BREAK_EPS = 0.05;   // cm — debugCheckSegmentContinuity와 같은 기준
const EVAL_LOOP_EPS  = 0.05;   // cm — 폐곡선 닫힘 허용오차

function evaluateEndpoint(ctx, angleRad) {
  const fixedClean  = cleanForBake(ctx.fixedSegs);
  const rotateClean = cleanForBake(ctx.rotateSegs);
  const pivot = ctx.pivot;

  const shape = normalizeBakedSegments(
    bakeFromSplitPieces({ fixedSegs: fixedClean, rotateSegs: rotateClean, pivot, angle: angleRad }),
    pivot);

  const reasons = [];

  // 연속성: 인접 세그먼트가 끊기지 않았는가
  let breaks = 0;
  for (let i = 0; i < shape.length - 1; i++) {
    const a = shape[i].to, b = shape[i + 1].from;
    const gap = (!a || !b) ? Infinity : Math.hypot(a.x - b.x, a.y - b.y);
    if (gap > EVAL_BREAK_EPS) breaks++;
  }
  if (breaks > 0) reasons.push("discontinuous");

  // 폐곡선: 마지막 to가 첫 from으로 돌아오는가
  const first = shape[0]?.from, last = shape[shape.length - 1]?.to;
  const loopGap = (first && last) ? Math.hypot(last.x - first.x, last.y - first.y) : Infinity;
  if (!(loopGap <= EVAL_LOOP_EPS)) reasons.push("loop-open");

  // 자기교차 델타: 이동 전 저장 형상이 기준선(각도0 재조립이 아님 — 그건 항등이 아니라
  // 예전에 게이트를 오염시켰다). 기준선은 이 ctx에서 불변이므로 호출부가 미리 구해
  // 넘겼으면 그대로 쓴다(?? 이므로 0도 정상적으로 재사용된다 — || 였다면 0을 놓친다).
  const baselineSelfXCount = ctx.baselineSelfXCount ?? (ctx.prevBakedSegments
    ? findSelfIntersections(ctx.prevBakedSegments, pivot).length : 0);
  const selfXCount = findSelfIntersections(shape, pivot).length;
  if (selfXCount > baselineSelfXCount) reasons.push("self-intersection");

  // 예산: 열린 다트각 합이 예산×허용폭을 넘는가
  const openDartSumRad = sumOpenDartAngle(shape, pivot);
  const budgetRatio = ctx.budgetRad > 1e-6 ? openDartSumRad / ctx.budgetRad : 0;
  if (ctx.budgetRad > 1e-6 && openDartSumRad > ctx.budgetRad * DART_BUDGET_TOL) reasons.push("budget-exceeded");

  // ── 측정만 (차단하지 않음) ──
  // source 보존: source notch가 |angle|만큼 줄고 새 notch가 |angle|만큼 열려야 한다.
  // conservationErrRad = |(sourceBefore − |angle|) − sourceAfter| 의 근사.
  // sourceAfter는 "이동 후 notch 중 기대 잔여각에 가장 가까운 것"으로 추정한다 —
  // 정확한 신원 추적은 테스트(unrelatedNotchInvariant)가 좌표쌍으로 하고, 여기선
  // 값만 노출한다(차단에 쓰지 않으므로 근사로 충분).
  let conservationErrRad = null, sourceApertureAfterRad = null, newNotchRad = null;
  if (ctx.sourceNotch) {
    const expectedSourceAfter = Math.max(0, ctx.sourceNotch.apertureRad - Math.abs(angleRad));
    const isLeg = (s) => s && (s.type === "dart-leg-new" || s.type === "dart-leg-old");
    const near = (a, b, e) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < e;
    const aps = [];
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i], b = shape[(i + 1) % shape.length];
      if (isLeg(a) && isLeg(b) && near(a.to, pivot, EPS_CLOSED_DART) && near(b.from, pivot, EPS_CLOSED_DART) &&
          Math.hypot(a.from.x - b.to.x, a.from.y - b.to.y) >= EPS_CLOSED_DART) {
        const v1x = a.from.x - pivot.x, v1y = a.from.y - pivot.y;
        const v2x = b.to.x - pivot.x, v2y = b.to.y - pivot.y;
        aps.push(Math.abs(Math.atan2(v1x * v2y - v1y * v2x, v1x * v2x + v1y * v2y)));
      }
    }
    if (aps.length) {
      sourceApertureAfterRad = aps.reduce((best, a) =>
        Math.abs(a - expectedSourceAfter) < Math.abs(best - expectedSourceAfter) ? a : best, aps[0]);
      newNotchRad = aps.reduce((best, a) =>
        Math.abs(a - Math.abs(angleRad)) < Math.abs(best - Math.abs(angleRad)) ? a : best, aps[0]);
      conservationErrRad = Math.abs(sourceApertureAfterRad - expectedSourceAfter);
    }
  }

  return {
    angleRad,
    shape,
    valid: reasons.length === 0,
    reasons,
    metrics: {
      selfXCount, baselineSelfXCount, breaks, loopGap,
      openDartSumRad, budgetRatio,
      sourceApertureBeforeRad: ctx.sourceNotch ? ctx.sourceNotch.apertureRad : null,
      sourceApertureAfterRad, newNotchRad, conservationErrRad,
    },
  };
}

// ══════════════════════════════════════════════
// evaluateMove 4계층 — 각도 스캔 공용 인프라 (2026-07 C3~C5)
// ══════════════════════════════════════════════
// ②의 물리 한계 안에서 ①(evaluateEndpoint)을 격자로 스캔하는 함수들(③ 부호 선택의
// findMaxApplicableMagnitude, ④ resolveRequestedAngle)이 공유하는 상수와 헬퍼.
//
// **비단조 주의**: endpoint 유효성은 단조롭지 않다 — 9°는 막혔는데 10°는 다시 가능할 수
// 있다(실측 `test/harness/nonMonotonicIntervals.js` 케이스1 `[0,9.148]∪[9.369,10.494]`).
// 그래서 "0이 안전하면 그 위는 단조"라는 단순 이분탐색은 금지다(0.752°만 찾고 18.06°를
// 놓쳤던 전례). 격자로 구간을 발견하고 경계만 이분탐색으로 정밀화한다.
//
// ⚠️ **격자 스캔은 최종 안전 판정 기관이 아니다.** 원리적으로 스텝보다 좁은 금지구간을
// 보장 탐지할 수 없다(케이스2의 0.049°는 60스텝 간격 0.162°보다 3.3배 좁다). 반드시
// 확정된 각도를 evaluateEndpoint로 재평가해 valid일 때만 preview/commit한다 — ④가
// resolved 각도의 evaluation을 함께 반환하는 이유다. 이 단일 실제 차단은 **C7에서도 제거 금지**.
const INTERVAL_SCAN_STEPS   = 60;   // C0 실측: 60은 3케이스 전부 탐지, 40은 케이스2/3을 놓친다
const INTERVAL_BISECT_ITERS = 18;   // 격자는 "구간 발견"만, 경계 정밀도는 이분탐색이 담당

// 자기교차 델타의 기준선은 prevBakedSegments 하나로 정해져 이 ctx 내내 불변이다 —
// 스캔 전에 한 번만 구해 파생 ctx에 실어 넘긴다(캐시가 아니라 상수를 상수로 다루는 것).
// **입력 ctx는 변형하지 않는다**(순수성 — purityCheck가 검증). 이미 있으면 그대로 쓴다.
function withSelfXBaseline(ctx) {
  if (ctx.baselineSelfXCount != null) return ctx;
  return {
    ...ctx,
    baselineSelfXCount: ctx.prevBakedSegments
      ? findSelfIntersections(ctx.prevBakedSegments, ctx.pivot).length : 0,
  };
}

// ══════════════════════════════════════════════
// 최대 적용 가능 각도 탐색 (2026-07 C4)
// ══════════════════════════════════════════════
// **책임: ②가 정한 한계 안에서 "실제로 적용 가능한 가장 큰 각도" 하나를 찾는다.**
//
// **왜 findApplicableIntervals를 쓰지 않는가 (C4 실측 근거)**: 부호 선택에 필요한 건
// `maxReachable` **한 값**뿐인데, 구간 목록 전체를 만들면 격자 61점을 **무조건** 다 돈다.
// 실측: 그렇게 배선하니 gen-0 bake 50→122(2.44×), 시간 81→316ms(3.9×)로 합의된 1.2×
// 게이트를 넘었다. 반면 legacy는 부호당 25 bake였다(budgetMaxAngle 24회 + applyTimeSafeAngle
// 1회 — applyTimeSafeAngle은 끝점이 안전하면 즉시 반환한다). **CLAUDE.md가 예상했던
// "두 그리드가 따로 bake하는 중복"은 실재하지 않았다** — 정상 경로에서 두 번째 그리드는
// 아예 열리지 않기 때문이다. 즉 흡수할 중복이 없었고, 늘어난 비용은 전부 "새로 하는 일"
// (더 조밀한 격자 + 격자점마다 자기교차 검사)이었다.
//
// **해법: 위에서 아래로 훑는다.** 우리가 원하는 건 "가장 높은 valid"이므로 한계각부터
// 내려오면 정상 경로(한계각이 그대로 적용 가능)는 **평가 1회**로 끝난다. 스텝을 줄이지도
// (SCAN_STEPS=60 유지), 캐시를 넣지도 않는다 — **탐색 방향만 바꾼다.**
//
// ⚠️ **아래에서 위로 올라가면 안 된다**: 0 근처의 좁은 안전구간에서 멈춰 더 높은 구간을
// 통째로 놓친다 — `applyTimeSafeAngle` 1차 구현이 정확히 그 실수를 했다(0.752°만 찾고
// 18.06°를 놓침). 위에서 내려오면 비단조여도 **가장 높은 valid를 먼저** 만난다.
//
// **MIN_DART_ANGLE_RAD를 적용하지 않는다** — ④(C5)의 책임이다.
//
// @param ctx      evaluateEndpoint와 동일한 컨텍스트
// @param limitRad ②(findPhysicalSweepLimit)가 돌려준 **부호 있는** 한계각.
//   (이름은 Magnitude지만 입력은 부호가 있어야 한다 — evaluateEndpoint가 부호 있는 각도를
//    받기 때문이고, ③ findApplicableIntervals와 같은 관례다. 반환은 크기다.)
// @returns {{ maxMagRad, valid, reason, scan:{steps, evaluated, refined} }}
//   reason: 'limit-valid'   — 한계각이 그대로 적용 가능(정상 경로, 평가 1회)
//           'scan-boundary' — 한계각은 막혔고, 아래로 훑어 찾은 경계
//           'none-valid'    — 격자 전체에 valid가 없음(maxMagRad 0)
//           'zero-limit'    — ②가 0으로 막음(평가 0회)
//   scan.evaluated = 격자/끝점 평가 횟수, scan.refined = 경계 이분탐색 평가 횟수.
function findMaxApplicableMagnitude(ctx, limitRad) {
  const limitMagRad = Math.abs(limitRad);
  const steps = INTERVAL_SCAN_STEPS;
  if (!(limitMagRad > 1e-9)) {
    return { maxMagRad: 0, valid: false, reason: "zero-limit", scan: { steps: 0, evaluated: 0, refined: 0 } };
  }
  const sign = Math.sign(limitRad);
  const scanCtx = withSelfXBaseline(ctx);

  let evaluated = 0, refined = 0;
  const validAt = (magRad) => { evaluated++; return evaluateEndpoint(scanCtx, sign * magRad).valid; };

  // 정상 경로: 한계각을 **정확히** 평가해서 통과하면 그대로 끝. (평가 1회)
  if (validAt(limitMagRad)) {
    return { maxMagRad: limitMagRad, valid: true, reason: "limit-valid", scan: { steps, evaluated, refined } };
  }

  // 한계각이 막혔다 — 격자를 위에서 아래로 훑어 **가장 높은 valid 샘플**을 찾는다.
  for (let i = steps - 1; i >= 0; i--) {
    const magRad = limitMagRad * (i / steps);
    if (!validAt(magRad)) continue;
    // 바로 위 샘플은 방금 invalid로 확인됐다(i+1 샘플, i=steps-1이면 한계각 자신).
    // 그 사이만 이분탐색해 경계를 정밀화한다 — 격자는 "발견", 정밀도는 이분탐색 담당.
    let lo = magRad, hi = limitMagRad * ((i + 1) / steps);
    for (let k = 0; k < INTERVAL_BISECT_ITERS; k++) {
      const mid = (lo + hi) / 2;
      refined++;
      if (evaluateEndpoint(scanCtx, sign * mid).valid) lo = mid; else hi = mid;
    }
    return { maxMagRad: lo, valid: true, reason: "scan-boundary", scan: { steps, evaluated, refined } };
  }

  // 0을 포함해 어떤 격자점도 통과하지 못했다 — 진짜로 적용 가능한 각도가 없다.
  return { maxMagRad: 0, valid: false, reason: "none-valid", scan: { steps, evaluated, refined } };
}

// ══════════════════════════════════════════════
// evaluateMove 4계층 — 부호 선택 (2026-07 C4)
// ══════════════════════════════════════════════
// **책임: 어느 방향으로 도는 것이 실제로 가장 멀리 갈 수 있는가를 ②→탐색 체인으로 고른다.**
//
// 예전 `chooseSignedBaseAngle`은 부호마다 `findMaxSafeAngle → budgetMaxAngle →
// applyTimeSafeAngle` **세 스캔**을 따로 돌려 나온 단일 각도로 비교했다. 이제 ②가 물리
// 한계를 정하고 `findMaxApplicableMagnitude`가 그 안의 최대 적용 가능 각도를 찾는다 —
// 예산·자기교차 델타·연속성이 전부 ①의 endpoint 평가 한 번에 접힌다.
//
// 선택 기준(사용자 확정): **각 부호의 `maxMagRad`가 큰 쪽.** 두 부호가 `SIGN_TIE_EPS_RAD`
// 이내로 동률이면 기하 부호(`choosePhysicalCloseAngle`)를 **tie-breaker로만** 쓴다.
//
// **sourceNotch 이동은 부호를 비교하지 않는다**: `signedAngleRad`가 "그 notch를 닫는
// 방향"을 해석적으로 정한다 — 반대 부호는 닫는 게 아니라 더 벌리므로 애초에 후보가
// 아니다(후보로 만들면 "여는 쪽"이 더 멀리 간다고 이겨버린다).
//
// **이 계층이 하지 않는 것**: MIN_DART_ANGLE_RAD 적용과 마우스 요청각 해석은 ④(C5)의 몫.
//
// @param ctx   evaluateEndpoint와 동일한 컨텍스트 (sourceNotch 포함 여부가 분기를 정한다)
// @param opts  { baseMagRad, cutPoint, geomSign }
//   baseMagRad = gen-0 경로에서 탐색할 각도 크기(양수, calc*BaseDartAngle).
//                sourceNotch 경로는 notch에서 직접 유도하므로 이 값을 쓰지 않는다.
//   geomSign   = choosePhysicalCloseAngle의 기하 부호 — **동률일 때만** 쓰는 tie-breaker.
// @returns {{ selectedSign, selectedMaxReachableMagRad, candidates, reason }}
//   candidates = [{ sign, physicalLimitMagRad, maxReachableMagRad, blockedBy, foundBy, scan }]
//     — 부호별 판단 근거를 그대로 노출한다(왜 그 부호가 이겼는지 밖에서 보이도록).
//       gen-0은 [기하부호, 반대부호] 2개, sourceNotch는 1개.
//   reason: 'source-notch'   — notch가 부호를 해석적으로 결정(비교 없음)
//           'max-reachable'  — 도달 가능 각도가 큰 쪽을 선택
//           'tie-geometric'  — 동률이라 기하 부호 유지
//           'no-room'        — 양쪽 다 적용 가능한 각도 없음(④가 차단)
const SIGN_TIE_EPS_RAD = 1e-4;   // 두 부호 도달각이 이 폭 이내면 동률로 보고 기하 부호 유지

// sourceNotch 이동에서 "얼마를 요청하는가" — 규칙이 selectRotationSign과 호출부 양쪽에
// 필요하므로 한 곳에 둔다(복제하면 한쪽만 고쳐도 조용히 어긋난다). notch를 닫는 데 필요한
// 각도를 넘지 않고(넘으면 지나쳐서 반대로 벌린다), 이 옷의 예산도 넘지 않는다.
function sourceNotchRequestMagRad(sourceNotch, budgetRad) {
  return Math.min(Math.abs(sourceNotch.signedAngleRad), sourceNotch.apertureRad, budgetRad);
}

function selectRotationSign(ctx, { baseMagRad, cutPoint, geomSign }) {
  // 두 부호가 같은 기준선을 공유하므로 여기서 한 번만 구한다(부호마다 다시 구하면 같은
  // 상수를 두 번 계산하게 된다).
  const scanCtx = withSelfXBaseline(ctx);

  const evalOne = (sign, magRad) => {
    const sweep = findPhysicalSweepLimit(scanCtx.fixedSegs, scanCtx.rotateSegs, scanCtx.pivot,
      sign * magRad, cutPoint);
    const found = findMaxApplicableMagnitude(scanCtx, sweep.limitRad);
    return {
      sign,
      physicalLimitMagRad: Math.abs(sweep.limitRad),
      maxReachableMagRad: found.maxMagRad,
      blockedBy: sweep.blockedBy,
      foundBy: found.reason,
      scan: found.scan,
    };
  };

  // ── sourceNotch: 닫는 부호 하나만 평가한다(반대는 후보가 아니다) ──
  if (ctx.sourceNotch) {
    const sign = Math.sign(ctx.sourceNotch.signedAngleRad) || 1;
    const cand = evalOne(sign, sourceNotchRequestMagRad(ctx.sourceNotch, ctx.budgetRad));
    return {
      selectedSign: sign,
      selectedMaxReachableMagRad: cand.maxReachableMagRad,
      candidates: [cand],
      reason: "source-notch",
    };
  }

  // ── gen-0/신규 위치: 두 부호를 ②→탐색 전체 체인으로 평가해 비교한다 ──
  const sign0 = Math.sign(geomSign) || 1;
  const candGeom = evalOne(sign0, baseMagRad);
  const candOpp  = evalOne(-sign0, baseMagRad);
  const candidates = [candGeom, candOpp];   // [기하부호, 반대부호]

  const delta = candGeom.maxReachableMagRad - candOpp.maxReachableMagRad;
  let selected, reason;
  if (candGeom.maxReachableMagRad <= 0 && candOpp.maxReachableMagRad <= 0) {
    // 양쪽 다 갈 곳이 없다 — 진짜 no-room. 부호는 기하 판정을 유지하고 ④가 차단한다.
    selected = candGeom; reason = "no-room";
  } else if (Math.abs(delta) < SIGN_TIE_EPS_RAD) {
    selected = candGeom; reason = "tie-geometric";
  } else {
    selected = (delta > 0) ? candGeom : candOpp; reason = "max-reachable";
  }

  return {
    selectedSign: selected.sign,
    selectedMaxReachableMagRad: selected.maxReachableMagRad,
    candidates,
    reason,
  };
}

// ══════════════════════════════════════════════
// evaluateMove 4계층 ④ — resolveRequestedAngle (2026-07 C5)
// ══════════════════════════════════════════════
// **책임: 마우스가 요청한 각도를 "실제로 적용 가능한 각도" 하나로 확정한다.**
//
// 예전엔 mousemove의 `userAngle = clamp(0, baseAngle)` 한 줄이었다. 그건 **[0, baseAngle]
// 사이가 전부 안전하다고 가정**한 것인데 endpoint 유효성은 비단조라 그 가정이 성립하지
// 않는다(C0 실측 `[0, 9.148] ∪ [9.369, 10.494]` — 9.2°는 막혔는데 10.4°는 다시 가능).
// 요청각이 금지구간에 떨어지면 가장 가까운 경계로 스냅한다.
//
// **왜 ③ findApplicableIntervals를 쓰지 않는가 (C5 확정)**: 이 함수는 **mousemove마다**
// 돈다. ③는 구간 목록을 만들려고 격자 61점을 **무조건** 다 돌아 C3 실측 115평가(~265ms)가
// 든다 — 드래그가 ~4fps로 죽는다. 반면 정상 경로(요청각이 그대로 valid)는 **평가 1회**로
// 끝난다. C4가 부호 선택에서 "열거하지 말고 탐색"으로 얻은 결론과 같은 이유다.
// (그래서 ③는 프로덕션 소비자가 영원히 없다 — C5d에서 삭제.)
//
// **⚠️ 경계 탐색은 스냅 보조일 뿐 안전 판정 기관이 아니다 (사용자 확정)**: 유한 격자는
// 스텝보다 좁은 valid island를 놓칠 수 있어 "항상 수학적으로 가장 가까운 경계"를 보장하지
// 못한다(③도 같은 한계였다 — C0 케이스2의 금지구간 0.038°는 스텝 0.162°의 4배 좁고,
// 잡힌 건 샘플이 우연히 안에 떨어져서였다). **안전 판정은 오직 반환된 `evaluation.valid`**
// 하나다. 이 단일 차단은 **C7에서도 제거 금지.**
//
// **중복 평가 금지 (사용자 확정)**: 호출부가 resolved 각도를 다시 평가하면 안 된다 —
// 탐색 중 그 각도를 이미 정확히 평가했으므로 결과를 `evaluation`으로 함께 돌려준다.
// **계약: `evaluation.angleRad === resolvedAngleRad`** — 요청각의 평가가 아니라 **확정된
// 각도의** 평가다(스냅했으면 스냅한 각도의 것). resolved가 0이면 회전이 없어 형상이 원본
// 그대로이므로 `evaluation`은 null이다 — 적용 차단은 applyDartMove의 MIN 게이트가 한다.
//
// **순수하다**: `dartMoveState`도 DOM도 읽지 않고 입력을 변형하지 않는다. **드래그 방향
// 이력을 보지 않는다** — 같은 요청각은 항상 같은 결과를 낸다(히스테리시스 금지: preview
// 재현성이 깨진다). 로그도 찍지 않는다(controller 책임).
//
// @param ctx          evaluateEndpoint와 동일한 컨텍스트
// @param requestedRad 사용자가 요청한 **부호 있는** 각도(마우스에서 유도)
// @param limitRad     드래그 상한 = C4가 고른 **부호 있는** 최대 적용 가능 각도
//                     (`selectedSign * selectedMaxReachableMagRad`). 그 바깥은 협상 대상이
//                     아니다 — ②/C4가 이미 막았다.
// @returns {{ resolvedAngleRad, evaluation, reason, scan:{steps, evaluated, refined} }}
//   reason: 'request-valid' — 요청각이 그대로 적용 가능(정상 경로, 평가 1회)
//           'zero-request'  — 요청이 0이거나 MIN 미만 → 중립 0°(평가 0회)
//           'snap-boundary' — 요청각이 금지구간 → 가장 가까운 경계로 스냅
//           'none-valid'    — MIN~한계 안에 적용 가능한 각도가 없음 → 0°
//           'zero-limit'    — 상한이 0(평가 0회)
const RESOLVE_TIE_EPS_RAD = 1e-9;   // 양쪽 경계가 사실상 같은 거리일 때만 동률로 본다

function resolveRequestedAngle(ctx, requestedRad, limitRad) {
  const steps = INTERVAL_SCAN_STEPS;
  const limitMagRad = Math.abs(limitRad);
  const neutral = (reason, evaluated = 0, refined = 0) => ({
    resolvedAngleRad: 0, evaluation: null, reason, scan: { steps, evaluated, refined },
  });
  if (!(limitMagRad > 1e-9)) return neutral("zero-limit");

  const sign = Math.sign(limitRad);
  // 요청각을 상한 방향으로 투영하고 [0, limitMag]로 자른다. 반대 부호 요청은 0이 된다
  // (예전 clamp `base>=0 ? max(0,min(base,u)) : max(base,min(0,u))`와 같은 의미).
  const reqMag = Math.max(0, Math.min(limitMagRad, requestedRad * sign));

  // 0° 보존: 드래그 시작점 0이 MIN(0.5°)으로 튀면 안 된다. ②/③/C4가 일부러 안 자른 것을
  // 여기서 자른다 — MIN 적용은 ④의 책임이다.
  if (reqMag < MIN_DART_ANGLE_RAD) return neutral("zero-request");

  const scanCtx = withSelfXBaseline(ctx);
  let evaluated = 0, refined = 0;
  const evalAt = (magRad) => { evaluated++; return evaluateEndpoint(scanCtx, sign * magRad); };

  // 정상 경로: 요청각을 **정확히** 평가해 통과하면 그대로 끝(평가 1회).
  const reqEv = evalAt(reqMag);
  if (reqEv.valid) {
    return {
      resolvedAngleRad: sign * reqMag, evaluation: reqEv,
      reason: "request-valid", scan: { steps, evaluated, refined },
    };
  }

  // 요청각이 금지구간 안이다 — 격자 간격으로 **양쪽을 동시에** 벌려 나가며 가장 가까운
  // valid 샘플을 찾는다. 한쪽씩 끝까지 훑으면 반대쪽의 더 가까운 경계를 놓친다.
  // 탐색 하한은 MIN이다 — 그 아래로 스냅해봐야 적용이 거부되는 퇴화 다트다.
  const stepMag = limitMagRad / steps;
  // (valid, invalid) 쌍 사이를 이분탐색해 valid 쪽 끝을 좁힌다. **valid로 확정된 각도와
  // 그 평가를 함께** 돌려준다 — 호출부가 다시 평가하지 않도록.
  const refineToward = (validMag, validEv, invalidMag) => {
    let vm = validMag, vEv = validEv, im = invalidMag;
    for (let k = 0; k < INTERVAL_BISECT_ITERS; k++) {
      const mid = (vm + im) / 2;
      refined++;
      const ev = evaluateEndpoint(scanCtx, sign * mid);
      if (ev.valid) { vm = mid; vEv = ev; } else { im = mid; }
    }
    return { mag: vm, ev: vEv };
  };

  for (let k = 1; k <= steps; k++) {
    // 직전 링의 앵커가 아직 범위 안이어야 이번 링을 볼 의미가 있다. 상한/하한에 닿으면
    // 그 값을 한 번만 보고 그 방향은 닫는다(같은 각도를 두 번 평가하지 않는다).
    const dAnchor = reqMag - (k - 1) * stepMag;
    const uAnchor = reqMag + (k - 1) * stepMag;
    const dOpen = dAnchor > MIN_DART_ANGLE_RAD;
    const uOpen = uAnchor < limitMagRad;
    if (!dOpen && !uOpen) break;

    let down = null, up = null;
    if (dOpen) {
      const dMag = Math.max(MIN_DART_ANGLE_RAD, reqMag - k * stepMag);
      const ev = evalAt(dMag);
      if (ev.valid) down = refineToward(dMag, ev, dAnchor);   // dAnchor는 invalid로 확인됨
    }
    if (uOpen) {
      const uMag = Math.min(limitMagRad, reqMag + k * stepMag);
      const ev = evalAt(uMag);
      if (ev.valid) up = refineToward(uMag, ev, uAnchor);     // uAnchor도 invalid로 확인됨
    }
    if (!down && !up) continue;

    // 가장 가까운 경계. **동률이면 작은 각도**(사용자 확정) — 위쪽이 EPS보다 확실히
    // 가까울 때만 위쪽을 고른다.
    let pick;
    if (down && up) {
      const dDist = reqMag - down.mag, uDist = up.mag - reqMag;
      pick = (uDist < dDist - RESOLVE_TIE_EPS_RAD) ? up : down;
    } else {
      pick = down || up;
    }
    return {
      resolvedAngleRad: sign * pick.mag, evaluation: pick.ev,
      reason: "snap-boundary", scan: { steps, evaluated, refined },
    };
  }

  // MIN~한계 어디에도 valid가 없다 — 중립 0°로 두고 적용은 MIN 게이트가 막는다.
  return neutral("none-valid", evaluated, refined);
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

// ── 뒤판 "기본 다트량" 각도 크기 (몇 차 다트이동이든 항상 동일) ──
function calcBackBaseDartAngle(info) {
  const angleCenter = Math.atan2(info.dartCenter.y - info.apex.y, info.dartCenter.x - info.apex.x);
  const angleEnd    = Math.atan2(info.dartEnd_.y   - info.apex.y, info.dartEnd_.x   - info.apex.x);
  let a = angleCenter - angleEnd;
  while (a >  Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return Math.abs(a);
}


// ══════════════════════════════════════════════
// 【CONTROLLER】 UI 상태·클릭·드래그·적용·렌더 연결.
// dartMoveState / DOM 입력값을 읽는 곳은 전부 여기다. get*TargetOutline과
// findCutPoint(Back)도 상태·DOM을 읽으므로 engine이 아니라 이 구역에 둔다.
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
  // ④(resolveRequestedAngle)가 드래그 중 쓰는 평가 컨텍스트. 조각 선택 때
  // prepareDartMoveCandidate가 만든 것(자기교차 기준선까지 채워진)을 그대로 들고 있는다 —
  // mousemove마다 다시 조립하면 그 기준선을 매번 다시 계산하게 된다. **불변 취급**.
  evalCtx:       null,
  // (C6) 마지막 mousemove/더블클릭이 확정한 각도의 evaluation(shape 포함). preview가
  // 이 shape를 그리고, apply가 같은 shape를 재사용한다(재bake 제거). 재사용 계약:
  // evaluation.angleRad === userAngle && evaluation.valid. 불변 스냅샷 — 변형 금지.
  evaluation:    null,
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
  dartMoveState.evalCtx       = null;   // 스냅샷 폐기 — 옛 세그먼트를 붙들고 있지 않는다
  dartMoveState.evaluation    = null;   // (C6) 평가 스냅샷도 함께 폐기 (stale 재사용 방지)
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
  dartMoveState.evalCtx       = null;   // 스냅샷 폐기 — 옛 세그먼트를 붙들고 있지 않는다
  dartMoveState.evaluation    = null;   // (C6) 평가 스냅샷도 함께 폐기 (stale 재사용 방지)
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
  dartMoveState.evalCtx       = null;   // 스냅샷 폐기 — 옛 세그먼트를 붙들고 있지 않는다
  dartMoveState.evaluation    = null;   // (C6) 평가 스냅샷도 함께 폐기 (stale 재사용 방지)
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
  dartMoveState.evalCtx       = null;   // 스냅샷 폐기 — 옛 세그먼트를 붙들고 있지 않는다
  dartMoveState.evaluation    = null;   // (C6) 평가 스냅샷도 함께 폐기 (stale 재사용 방지)
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

// (C6/C7) apply와 preview가 공유하는 **단일** 조회 — "현재 각도와 일치하는 evaluation"을
// 반환한다. "두 코드가 항상 같아야 한다"면 조건식을 두 벌 관리할 게 아니라 한 벌만 존재해야
// 한다 — 복제하면 한쪽만 고쳐도 조용히 갈라지고, preview는 헤드리스 테스트가 불가능해 더 위험하다.
//
// **valid 여부는 보지 않는다(C7).** valid는
// endpoint 안전성의 단일 진실이므로 호출부가 직접 `.valid`로 분기한다 — apply는 invalid면
// reasons로 거부, preview는 invalid면 폴리라인 fallback. 여기서 valid까지 섞으면 "일치하는데
// invalid"와 "애초에 일치 안 함"을 구분 못 해 apply가 정확한 사유를 못 낸다.
// 계약: evalCtx 존재 / evaluation 존재 / angleRad===userAngle(정확 비교) /
//       shape가 배열이고 비어있지 않음. 하나라도 어긋나면 null.
function getCurrentDartEvaluation() {
  const ev = dartMoveState.evaluation;
  if (!dartMoveState.evalCtx) return null;
  if (!ev) return null;
  if (ev.angleRad !== dartMoveState.userAngle) return null;
  if (!Array.isArray(ev.shape) || ev.shape.length === 0) return null;
  return ev;
}

function applyDartMove() {
  dbg('[dartMove] applyDartMove 실행', { cutPoint: dartMoveState.cutPoint, rotateSegs: dartMoveState.rotateSegs?.length, fixedSegs: dartMoveState.fixedSegs?.length });
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

  dbg('[apply] rotatePts.len:', dartMoveState.rotatePts.length,
    '/ fixedPts.len:', dartMoveState.fixedPts?.length,
    '/ rotateArea:', polygonArea(dartMoveState.rotatePts).toFixed(2),
    '/ fixedArea:', polygonArea(dartMoveState.fixedPts).toFixed(2));
  dbg('[apply] rotateSegs.len:', dartMoveState.rotateSegs?.length,
    '/ fixedSegs.len:', dartMoveState.fixedSegs?.length,
    '/ rotateSegs types:', dartMoveState.rotateSegs?.map(s=>s.type).join(','));

  const side = dartMoveState.side;

  // 안전장치: split에서 놓쳐도 bake 직전 한 번 더 다트선 제거(공용 cleanForBake).
  // dart-leg(구형)·dart-bridge만 제거 — dart-leg-new/old는 bakeFromSplitPieces 입구의
  // safeFixed/safeRotate 필터에서 처리.

  const _rawFixedLen  = dartMoveState.fixedSegs?.length  || 0;
  const _rawRotateLen = dartMoveState.rotateSegs?.length || 0;
  const _cleanFixed  = cleanForBake(dartMoveState.fixedSegs);
  const _cleanRotate = cleanForBake(dartMoveState.rotateSegs);

  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    dbg('[apply] cleanForBake fixed:', _rawFixedLen, '→', _cleanFixed.length,
      _rawFixedLen !== _cleanFixed.length ? '⚠️ 다트선 혼입 제거됨' : '');
    dbg('[apply] cleanForBake rotate:', _rawRotateLen, '→', _cleanRotate.length,
      _rawRotateLen !== _cleanRotate.length ? '⚠️ 다트선 혼입 제거됨' : '');
    const _dist = (a, b) => (a && b) ? Math.hypot(a.x-b.x, a.y-b.y) : Infinity;
    const _fixedGap  = _dist(_cleanFixed[0]?.from,  dartMoveState.cutPoint);
    const _rotateGap = _dist(_cleanRotate[0]?.from, dartMoveState.cutPoint);
    dbg('[preBake] fixed start gap:',  _fixedGap.toFixed(3),  _fixedGap  < 1e-2 ? '✅' : '❌');
    dbg('[preBake] rotate start gap:', _rotateGap.toFixed(3), _rotateGap < 1e-2 ? '✅' : '❌');
    dbg('[preBake] fixed types:',  _cleanFixed.map(s=>s.type).join(','));
    dbg('[preBake] rotate types:', _cleanRotate.map(s=>s.type).join(','));
  }

  // (C7) 단일 진실: apply가 커밋하는 형상은 항상 evaluateEndpoint 결과(evaluation.shape)다.
  // C6에서 preview·apply가 같은 shape를 공유하므로 여기서 재bake하지 않는다. mousemove/
  // 더블클릭이 확정한 각도의 evaluation을 조회하고(각도 일치 — valid는 아래서 분기),
  // 없으면 재bake·재평가하지 않고 정상 거부한다(단일 소스 유지, 상태는 그대로).
  const _ev = getCurrentDartEvaluation();
  if (!_ev) {
    setHint("평가 결과가 없습니다 — 핸들을 다시 드래그해 주세요");
    return;   // mode/userAngle/evaluation/evalCtx 미변경 (드래그 유지)
  }

  // ── piece-collision (②의 책임 — evaluation.valid에 없다). bake 없이 각도만으로 검사한다.
  //    resolved ≤ sweepLimit이면 발화하지 않지만(실측), resolver 상한의 apply-time 재확인
  //    이다. ①에 합치지 않고 별도 게이트로 유지한다. 드래그 상태(mode/userAngle 등)는 그대로.
  const _crossings = findRotationCollisions(_cleanFixed, _cleanRotate, pivot, dartMoveState.userAngle);
  if (_crossings.length > 0) {
    dbg('[apply] 조각 간 겹침으로 적용 차단', _crossings);
    setHint(`이 위치/각도는 패턴이 겹칩니다 (${_crossings.length}건) — 각도를 줄이거나 다른 조각/위치를 선택하세요`);
    return;
  }

  // ── endpoint 안전성의 단일 진실 = evaluation.valid. legacy self-intersection/budget
  //    게이트와 C1 이중검증이 전부 이 한 판정으로 접혔다(동치는 endpointEquivalence.js가
  //    하네스에서 legacyGates 독립 재구현으로 강제). 격자가 스텝보다 좁은 금지구간을 놓쳐도
  //    정확 요청각의 evaluateEndpoint가 마지막에 잡는다(C5/C6 원칙) — 이 차단은 제거 금지.
  if (!_ev.valid) {
    const _r = _ev.reasons || [];
    const _m = _ev.metrics || {};
    if (_r.includes("budget-exceeded")) {
      const _usedDeg = ((_m.openDartSumRad || 0) * 180 / Math.PI).toFixed(0);
      const _budDeg = (_m.budgetRatio > 1e-9)
        ? ((_m.openDartSumRad / _m.budgetRatio) * 180 / Math.PI).toFixed(0) : "?";
      setHint(`이 위치/조각은 가슴다트를 복제합니다 (열린 다트 합 ${_usedDeg}° > 예산 ${_budDeg}°) — 다른 조각/위치를 선택하세요`);
    } else if (_r.includes("self-intersection")) {
      setHint(`이 위치/각도는 패턴이 겹칩니다 — 각도를 줄이거나 다른 조각/위치를 선택하세요`);
    } else if (_r.includes("discontinuous") || _r.includes("loop-open")) {
      setHint(`형상이 제대로 연결되지 않았습니다 — 다른 조각/위치를 선택하세요`);
    } else {
      setHint(`이 위치/각도는 적용할 수 없습니다 — 다른 조각/위치를 선택하세요`);
    }
    dbg('[apply] evaluation invalid로 차단', _r);
    return;   // mode/userAngle/evaluation/evalCtx 미변경 (드래그 유지)
  }

  // valid — commit. 커밋 형상은 evaluation.shape(재사용) 그 자체다(재bake 0).
  const bakedSegments = _ev.shape;
  debugCheckSegmentContinuity(bakedSegments, `${side} bakedSegments`);
  validateBakedSegments(bakedSegments, side, pivot);   // DEBUG 진단(프로덕션 no-op)

  if (typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) {
    const DART_TYPES = ["dart-leg-new","dart-leg-old","dart-bridge"];
    const outerTypes = bakedSegments.filter(s=>!DART_TYPES.includes(s.type)).map(s=>s.type);
    dbg('[afterBake] 외곽선 타입:', outerTypes.join(' → '));
    dbg('[afterBake] 외곽선 수:', outerTypes.length, '/ 전체:', bakedSegments.length);
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

  dbg('[apply] bakedSegments:', bakedSegments.length, 'side:', side,
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
  dartMoveState.evalCtx       = null;   // 스냅샷 폐기 — 옛 세그먼트를 붙들고 있지 않는다
  dartMoveState.evaluation    = null;   // (C6) 평가 스냅샷도 함께 폐기 (stale 재사용 방지)
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

  // ── 회전 미리보기 (C6: preview는 apply와 같은 evaluation.shape를 그린다) ──
  // 마지막 mousemove가 확정한 evaluation.shape가 있으면 그걸 apply와 동일한 렌더러
  // (drawAppliedSegments)로 그린다 → "preview 결과 = apply 결과"가 화면에서도 성립.
  // 반투명·점선 래퍼로 "아직 미확정(드래그 중)"임을 표시(stroke-dasharray는 자식에 상속).
  //
  // ★ 각도-일치 조회는 apply와 **같은 함수**(getCurrentDartEvaluation)를 쓴다 — 조건식을
  //   복제하지 않으므로 preview가 그린 shape와 apply가 커밋하는 shape가 구조적으로 갈릴 수
  //   없다. valid는 여기서 직접 본다(C7: 함수는 valid를 안 봄) — invalid면 apply가 거부할
  //   형상이므로 preview로 그리지 않고 폴리라인 근사로 fallback한다.
  const _previewEval = getCurrentDartEvaluation();
  if (_previewEval && _previewEval.valid && typeof drawAppliedSegments === "function") {
    const sg = E("g", { opacity: 0.7, "stroke-dasharray": "5,3", "pointer-events": "none" });
    drawAppliedSegments(sg, _previewEval.shape, "pattern", "#44aaff", dartMoveState.side);
    g.appendChild(sg);
  } else {
    // fallback: 회전 조각 + 고정 조각 폴리라인 근사
    const rotated = rotatePts.map(pt => rotatePt(pt, pivot, angle));
    if (rotated.length >= 2) {
      g.appendChild(E("polyline", {
        points: ptsToSvgPoints(rotated),
        fill: "none", stroke: "#44aaff",
        "stroke-width": 2, opacity: 0.8,
        "stroke-dasharray": "5,3",
      }));
    }
    const fixedPts = dartMoveState.fixedPts;
    if (fixedPts?.length >= 2) {
      g.appendChild(E("polyline", {
        points: ptsToSvgPoints(fixedPts),
        fill: "none", stroke: "#ff8800",
        "stroke-width": 2, opacity: 0.8,
        "stroke-dasharray": "5,3",
      }));
    }
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

      // ── closeAngle 결정: UI와 테스트 하네스가 공유하는 순수 평가 함수에 위임 ──
      // (2026-07 추출. 예전엔 이 오케스트레이션이 여기와 test/harness/dartDriver.js에
      //  각각 복제돼 있었다 — 이제 prepareDartMoveCandidate 한 곳뿐.)
      const _pivotSign = dartMoveState.side === "back" ? _d.pts.E : _d.pts.BP;
      // 고정 조각은 rest(항상-고정 영역)까지 포함한 전체 체인 사용 (baked 다중다트).
      // 1차(splitFront/BackOutline)는 segsFull이 없으므로 기존 segs 그대로 사용.
      const _rotateSegs = rotatePiece.segs;
      const _fixedSegs  = fixedPiece.segsFull || fixedPiece.segs;
      // calc*BaseDartAngle은 Math.abs()를 반환하므로 예산과 gen-0 시작각이 같은 값이다.
      // 역할이 다르므로 prepareDartMoveCandidate에는 각각의 이름으로 전달한다.
      const _baseDartAngle = (dartMoveState.side === "back")
        ? calcBackBaseDartAngle(buildBackShoulderDartInfo(_d.formula, _d.pts, _B))
        : calcFrontBaseDartAngle(_d.pts, _B);
      const _prevBakedForSide = (dartMoveState.side === "back")
        ? dartMoveState.appliedBack?.bakedSegments
        : dartMoveState.appliedFront?.bakedSegments;

      const _candidate = prepareDartMoveCandidate({
        pivot: _pivotSign,
        budgetRad: Math.abs(_baseDartAngle),
        rawBaseAngleRad: _baseDartAngle,
        cutPoint: dartMoveState.cutPoint,
        rotatePiece, fixedPiece,
        prevBakedSegments: _prevBakedForSide,
      });
      const closeAngle = _candidate.closeAngleRad;

      // 회전 공간이 사실상 없으면(안전각 0.5° 미만) 여기서 차단하고 조각 선택
      // 상태를 유지한다 — 이대로 적용하면 겹침은 없지만 입구가 안 벌어진 퇴화
      // 다트(다리 두 개가 같은 자리에 겹친 방사선)가 남는다(실측: 무작위 재현에서
      // "필요없는 선" 잔선의 직접 원인이 이 케이스였음).
      if (!_candidate.valid) {
        setHint("이 위치/조각은 회전할 공간이 없습니다 — 다른 조각이나 위치를 선택하세요");
        render();
        return;
      }

      dartMoveState.mode          = "drag";
      dartMoveState.baseAngle     = closeAngle;   // 드래그 상한 = C4가 고른 최대 적용 가능 각도
      dartMoveState.userAngle     = 0;             // 항상 0에서 시작
      // ④가 드래그 내내 쓸 평가 컨텍스트(자기교차 기준선 포함)를 그대로 넘겨받는다.
      dartMoveState.evalCtx       = _candidate.evalCtx;
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
        dbg('[splitBack] isBaked:', _isBakedB, 'A.hit:', splitB.pieceA?.hit, 'B.hit:', splitB.pieceB?.hit);
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
      dbg('[split] isBaked:', _isBakedF, 'A.hit:', split.pieceA?.hit, 'B.hit:', split.pieceB?.hit);
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

  // ── 드래그 핸들: 더블클릭 = 끝까지 이동 ──
  // baseAngle은 C4가 valid로 확인한 각도지만 **그래도 ④를 통과시킨다** — 드래그와
  // 더블클릭이 서로 다른 경로로 각도를 정하면 같은 각도가 두 경로에서 다르게 나올 수
  // 있다. 정상 경로라 평가 1회로 끝난다.
  svg.addEventListener("dblclick", e => {
    if (!dartMoveState.active) return;
    const handle = e.target.closest(".dart-rotate-handle");
    if (!handle) return;
    e.preventDefault();
    e.stopPropagation();
    dartMoveState.dragging = false;
    const resolved = resolveRequestedAngle(
      dartMoveState.evalCtx, dartMoveState.baseAngle, dartMoveState.baseAngle);
    dartMoveState.userAngle = resolved.resolvedAngleRad;
    dartMoveState.evaluation = resolved.evaluation;   // (C6) preview·apply 공유
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

    // ④(C5): 요청각을 실제 적용 가능한 각도로 확정한다. 예전엔 `clamp(0, baseAngle)`
    // 한 줄이었는데, 그건 [0, baseAngle] 사이가 전부 안전하다는 가정이었다 — endpoint
    // 유효성은 비단조라 성립하지 않는다. 금지구간에 떨어지면 ④가 가장 가까운 경계로
    // 스냅하고, **resolved 각도의 평가**를 함께 돌려준다(호출부가 다시 평가하지 않는다).
    const base = dartMoveState.baseAngle;
    const resolved = resolveRequestedAngle(dartMoveState.evalCtx, userAngle, base);
    dartMoveState.userAngle = resolved.resolvedAngleRad;
    dartMoveState.evaluation = resolved.evaluation;   // (C6) 이 shape를 preview가 그리고 apply가 재사용

    const openW = dartOpenWidth(dartMoveState.cutPoint, pivot, resolved.resolvedAngleRad);
    const baseW = dartOpenWidth(dartMoveState.cutPoint, pivot, base);
    // 스냅됐다는 걸 숨기지 않는다 — 마우스를 따라오지 않는 이유가 보여야 한다.
    const snapped = (resolved.reason === "snap-boundary");
    setHint(`다트 벌림: ${openW.toFixed(1)}cm / 최대 ${baseW.toFixed(1)}cm`
      + (snapped ? " — 이 각도는 겹쳐서 가장 가까운 가능 위치로 맞췄습니다" : ""));
    dbg('[resolve]', resolved.reason, 'deg:', (resolved.resolvedAngleRad*180/Math.PI).toFixed(2),
      'eval:', resolved.scan.evaluated, 'refine:', resolved.scan.refined);
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
