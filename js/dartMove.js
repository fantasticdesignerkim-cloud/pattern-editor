// ══════════════════════════════════════════════
// 다트이동 — 실제 앞판 패턴선 기준 cutPoint 선택 + BP 절개선
// 기준: render.js가 그리는 앞판 최종 외곽선과 같은 계산 사용
// ══════════════════════════════════════════════

const dartMoveState = {
  active:        false,
  side:          null,   // "front" | "back" | null
  cutPoint:      null,
  cutSegIndex:   -1,
  // ── hover ──────────────────────────────────
  hoverPoint:    null,
  hoverSegIndex: -1,
  // ── 회전 상태 ──────────────────────────────
  baseAngle:   0,
  userAngle:   0,
  rotatePts:   null,
  fixedPts:    null,
  fixedSegs:   null,
  rotateSegs:  null,
  dragging:    false,
  // ── 적용 결과 ──────────────────────────────
  applied:     null,
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
function rotatePt(pt, center, angle) {
  const dx = pt.x - center.x, dy = pt.y - center.y;
  return {
    x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
  };
}

// ── 기존 가슴다트 닫힘 각도 계산 ─────────────
function calcCloseAngle(p, B) {
  const vx = p.BP.x - p.G.x, vy = p.BP.y - p.G.y;
  const len = Math.hypot(vx, vy) || 1;
  const ux = -vx / len, uy = -vy / len;
  const da = (B / 4 - 2.5) * Math.PI / 180;
  const GG = {
    x: p.BP.x + (ux * Math.cos(da) - uy * Math.sin(da)) * len,
    y: p.BP.y + (ux * Math.sin(da) + uy * Math.cos(da)) * len,
  };
  const angleG  = Math.atan2(p.G.y  - p.BP.y, p.G.x  - p.BP.x);
  const angleGG = Math.atan2(GG.y   - p.BP.y, GG.x   - p.BP.x);
  let closeAngle = angleG - angleGG;
  while (closeAngle >  Math.PI) closeAngle -= 2 * Math.PI;
  while (closeAngle < -Math.PI) closeAngle += 2 * Math.PI;
  return { closeAngle, GG };
}

// ── 항상 작은 조각이 rotate가 되도록 보장 ────
function polygonArea(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function ensureSmallPieceRotates(result) {
  // 열린 pts(closePt 추가 전)로 면적 비교 → apex/BP 왜곡 방지
  const fixedArea  = polygonArea(result.openFixedPts  || result.fixedPts);
  const rotateArea = polygonArea(result.openRotatePts || result.rotatePts);

  if (fixedArea < rotateArea) {
    return {
      ...result,
      fixedPts:      result.rotatePts,
      rotatePts:     result.fixedPts,
      fixedSegs:     result.rotateSegs,
      rotateSegs:    result.fixedSegs,
      fixedHit:      result.rotateHit,
      rotateHit:     result.fixedHit,
      fixedArea:     rotateArea,
      rotateArea:    fixedArea,
      swappedByArea: true,
    };
  }

  return {
    ...result,
    fixedArea,
    rotateArea,
    swappedByArea: false,
  };
}

// ── 앞판 외곽선을 G/GG 기준으로 두 조각 분할 ─
// fixedPts  = G를 포함하는 조각 (고정)
// rotatePts = GG를 포함하는 조각 (회전 대상)
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
  // ── 첫점/마지막점 진단 로그 (항상 출력, 확인 후 제거) ──
  {
    const fS = forward.segs, bS = backward.segs;
    console.log('[check] forward  segs[0].from:', JSON.stringify(fS[0]?.from), '/ segs[last].to:', JSON.stringify(fS[fS.length-1]?.to));
    console.log('[check] backward segs[0].from:', JSON.stringify(bS[0]?.from), '/ segs[last].to:', JSON.stringify(bS[bS.length-1]?.to));
    console.log('[check] cutPoint:', JSON.stringify(cutPoint), '/ G:', JSON.stringify(p.G), '/ GG:', JSON.stringify(GG));
  }

  let fixedPts = [], rotatePts = [], fixedSegs = [], rotateSegs = [];
  let fixedHit = "", rotateHit = "";

  // hit 성공/실패 무관하게 항상 열린 pts 면적으로 결정
  // forward/backward 중 더 작은 쪽이 rotatePts
  const fArea = polygonArea([...forward.pts,  { ...p.BP }, { ...cutPoint }]);
  const bArea = polygonArea([...backward.pts, { ...p.BP }, { ...cutPoint }]);
  if (fArea < bArea) {
    rotatePts = forward.pts;  rotateSegs = forward.segs;
    fixedPts  = backward.pts; fixedSegs  = backward.segs;
    rotateHit = forward.hit  || "G";
    fixedHit  = backward.hit || "GG";
  } else {
    rotatePts = backward.pts; rotateSegs = backward.segs;
    fixedPts  = forward.pts;  fixedSegs  = forward.segs;
    rotateHit = backward.hit || "G";
    fixedHit  = forward.hit  || "GG";
  }

  // BP·cutPoint로 닫아서 조각처럼 표시
  const rotateClosed = [...rotatePts, { ...p.BP }, { ...cutPoint }];
  const fixedClosed  = [...fixedPts,  { ...p.BP }, { ...cutPoint }];

  return ensureSmallPieceRotates({
    fixedPts: fixedClosed, rotatePts: rotateClosed,
    fixedSegs, rotateSegs, fixedHit, rotateHit,
    openFixedPts: fixedPts, openRotatePts: rotatePts,
  });
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
    if (seg.disabled) return;
    const r = closestOnSeg(clickPt, seg.from, seg.to);
    if (r.d < bestD) { bestD = r.d; best = r.pt; bestIndex = idx; }
  });
  if (bestD > 2.0) return null;

  // G / GG 근접 차단
  if (pts) {
    const B = n("inpB");
    const { GG } = calcCloseAngle(pts, B);
    const minDartEndDistance = 1.2;
    const nearG  = Math.hypot(best.x - pts.G.x, best.y - pts.G.y)  < minDartEndDistance;
    const nearGG = Math.hypot(best.x - GG.x,     best.y - GG.y)     < minDartEndDistance;
    if (nearG || nearGG) {
      return { blocked: true, reason: "dart-end", point: best, segIndex: bestIndex };
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
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
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
  dartMoveState.side          = null;
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
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
  dartMoveState.side          = null;
  dartMoveState.cutPoint      = null;
  dartMoveState.cutSegIndex   = -1;
  dartMoveState.hoverPoint    = null;
  dartMoveState.hoverSegIndex = -1;
  dartMoveState.userAngle     = 0;
  dartMoveState.baseAngle     = 0;
  dartMoveState.rotatePts     = null;
  dartMoveState.fixedPts      = null;
  dartMoveState.fixedSegs     = null;
  dartMoveState.rotateSegs    = null;
  dartMoveState.applied       = null;
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

  // 회전 중심: 앞판=BP, 뒤판=E
  const pivot = (dartMoveState.side === "back") ? p.E : p.BP;

  console.log('[apply] rotatePts.len:', dartMoveState.rotatePts.length,
    '/ fixedPts.len:', dartMoveState.fixedPts?.length,
    '/ rotateArea:', polygonArea(dartMoveState.rotatePts).toFixed(2),
    '/ fixedArea:', polygonArea(dartMoveState.fixedPts).toFixed(2));
  console.log('[apply] rotateSegs.len:', dartMoveState.rotateSegs?.length,
    '/ fixedSegs.len:', dartMoveState.fixedSegs?.length,
    '/ rotateSegs types:', dartMoveState.rotateSegs?.map(s=>s.type).join(','));

  const rotatedPts = dartMoveState.rotatePts.map(pt => rotatePt(pt, pivot, angle));
  const cut2 = rotatePt(dartMoveState.cutPoint, pivot, angle);

  // rotateSegs의 from/to를 pivot 기준으로 회전
  const rotatedSegs = (dartMoveState.rotateSegs || []).map(seg => ({
    from:     rotatePt(seg.from, pivot, angle),
    to:       rotatePt(seg.to,   pivot, angle),
    type:     seg.type,
    disabled: seg.disabled,
  }));

  // dartCenter / dartEnd_ 명시 추출
  const fixedSegsAll  = dartMoveState.fixedSegs  || [];
  const rotateSegsAll = dartMoveState.rotateSegs || [];

  // GPoint/GGPoint: 뒤판은 hit 기준, 앞판은 segs 끝점
  let GPoint, GGPoint;
  if (dartMoveState.side === "back") {
    const _Bb = n("inpB"), _Wb = n("inpW"), _BLb = n("inpBL");
    if (_Bb && _Wb && _BLb) {
      const _db   = createDraft(_Bb, _Wb, _BLb);
      const _info = buildBackShoulderDartInfo(_db.formula, _db.pts, _Bb);
      GPoint  = dartMoveState.fixedHit  === "dartCenter" ? { ..._info.dartCenter } : { ..._info.dartEnd_ };
      GGPoint = dartMoveState.rotateHit === "dartCenter" ? { ..._info.dartCenter } : { ..._info.dartEnd_ };
    } else {
      GPoint  = fixedSegsAll.length  ? { ...fixedSegsAll[fixedSegsAll.length - 1].to }   : null;
      GGPoint = rotateSegsAll.length ? { ...rotateSegsAll[rotateSegsAll.length - 1].to } : null;
    }
  } else {
    GPoint  = fixedSegsAll.length  ? { ...fixedSegsAll[fixedSegsAll.length - 1].to }   : null;
    GGPoint = rotateSegsAll.length ? { ...rotateSegsAll[rotateSegsAll.length - 1].to } : null;
  }
  const rotatedGGPoint = GGPoint ? rotatePt(GGPoint, pivot, angle) : null;

  dartMoveState.applied = {
    side:            dartMoveState.side,
    pivot:           { ...pivot },
    cutPoint:        { ...dartMoveState.cutPoint },
    cutPoint2:       { ...cut2 },
    cutSegIndex:     dartMoveState.cutSegIndex,
    fixedPts:        dartMoveState.fixedPts,
    rotatePts:       dartMoveState.rotatePts,
    rotatedPts,
    fixedSegs:       dartMoveState.fixedSegs  || [],
    rotatedSegs,
    GPoint,
    rotatedGGPoint,
    userAngle:       angle,
  };

  if(typeof DEBUG_DART_MOVE !== 'undefined' && DEBUG_DART_MOVE) console.log('[dartMove] applied 저장 완료', dartMoveState.applied);
  dartMoveState.active   = false;
  dartMoveState.dragging = false;
  setBtn("다트이동 시작", "#e07800");
  setApplyEnabled(false);
  setHint(`다트이동 적용 완료 (${(angle * 180 / Math.PI).toFixed(1)}°)`);
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

  // ── 1. cutPoint 선택 전: hover만 표시 ────────────
  if (!dartMoveState.cutPoint) {
    if (dartMoveState.hoverSegIndex >= 0) {
      const dHov = createDraft(B, W, BL);
      const segsHov = dartMoveState.side === "back"
        ? buildBackOutline(dHov.pts, dHov.formula, B)
        : buildFrontOutline(dHov.pts, dHov.formula, B);
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
      const segsHov2 = buildFrontOutline(dHov2.pts, dHov2.formula, B);
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
    ? buildBackOutline(dDraft.pts, dDraft.formula, B)
    : buildFrontOutline(dDraft.pts, dDraft.formula, B);

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

  // ── pivot→cutPoint 절개선 (주황) ──────────────
  g.appendChild(E("line", { x1: bx, y1: by, x2: cx, y2: cy, stroke: "#e07800", "stroke-width": 1.8, "stroke-dasharray": "6,3" }));

  // ── pivot→cutPoint2 새 다트 다리 (파랑) ────────
  const cut2 = rotatePt(cut, pivot, angle);
  const [cx2, cy2] = c2p(cut2.x, cut2.y);
  g.appendChild(E("line", { x1: bx, y1: by, x2: cx2, y2: cy2, stroke: "#44aaff", "stroke-width": 1.8, "stroke-dasharray": "6,3" }));

  // ── cutPoint 원 (주황, 고정) ───────────────────
  g.appendChild(E("circle", { cx, cy, r: 7, fill: "#e07800", stroke: "#fff", "stroke-width": 2 }));

  // ── 각도 표시 ─────────────────────────────────
  const degVal = (angle * 180 / Math.PI).toFixed(1);
  const [lx, ly] = c2p(pivot.x + 1.5, pivot.y - 1.5);
  g.appendChild(E("text", { x: lx, y: ly, "font-size": 11, fill: "#44aaff", "font-weight": "700", "text-anchor": "start" }, `${degVal}°`));

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

    const [cx, cy] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const d = createDraft(B, W, BL);

    // ── 뒤판 ────────────────────────────────────
    if (dartMoveState.side === "back") {
      const segsBack = buildBackOutline(d.pts, d.formula, B);
      const resultB  = findCutPointBack({ x: cx, y: cy }, segsBack, d.pts, d.formula, B);

      if (resultB?.blocked) {
        setHint("다트 끝점 근처는 선택할 수 없습니다");
        render();
        return;
      }
      if (resultB) {
        dartMoveState.cutPoint    = resultB.point;
        dartMoveState.cutSegIndex = resultB.segIndex;

        const info = buildBackShoulderDartInfo(d.formula, d.pts, B);
        const splitB = splitBackOutline(segsBack, resultB.point, resultB.segIndex, d.pts, d.formula, B);
        const { closeAngle } = calcBackCloseAngleByRotateHit(info, splitB.rotateHit);

        dartMoveState.baseAngle  = closeAngle;
        dartMoveState.userAngle  = closeAngle;
        dartMoveState.rotatePts  = splitB.rotatePts;
        dartMoveState.fixedPts   = splitB.fixedPts;
        dartMoveState.fixedSegs  = splitB.fixedSegs;
        dartMoveState.rotateSegs = splitB.rotateSegs;
        dartMoveState.fixedHit   = splitB.fixedHit;
        dartMoveState.rotateHit  = splitB.rotateHit;
        dartMoveState.hoverPoint    = null;
        dartMoveState.hoverSegIndex = -1;

        const seg = segsBack[resultB.segIndex];
        const deg = Math.abs(closeAngle * 180 / Math.PI).toFixed(1);
        setApplyEnabled(true);
        setHint(`${seg?.type || "outline"} · rotateHit=${splitB.rotateHit} · 기준각 ${deg}° · 핸들 드래그로 조절`);
      } else {
        setHint(`뒤판 외곽선 근처를 클릭하세요 x=${cx.toFixed(1)} y=${cy.toFixed(1)}`);
      }
      render();
      return;
    }

    // ── 앞판 ────────────────────────────────────
    const segments = buildFrontOutline(d.pts, d.formula, B);
    const result = findCutPoint({ x: cx, y: cy }, segments, d.pts);

    if (result?.blocked && result.reason === "dart-end") {
      setApplyEnabled(false);
      setHint("기존 다트 끝점 G/GG 근처는 선택할 수 없습니다");
      render();
      return;
    }

    if (result) {
      dartMoveState.cutPoint    = result.point;
      dartMoveState.cutSegIndex = result.segIndex;

      // 조각 분할 + rotateHit 기준 각도 계산
      const split = splitFrontOutline(
        segments, result.point, result.segIndex, d.pts, B
      );
      const { closeAngle } = calcFrontCloseAngleByRotateHit(d.pts, B, split.rotateHit);
      dartMoveState.baseAngle  = closeAngle;
      dartMoveState.userAngle  = closeAngle;
      dartMoveState.rotatePts  = split.rotatePts;
      dartMoveState.fixedPts   = split.fixedPts;
      dartMoveState.fixedSegs  = split.fixedSegs;
      dartMoveState.rotateSegs = split.rotateSegs;
      dartMoveState.fixedHit   = split.fixedHit;
      dartMoveState.rotateHit  = split.rotateHit;
      dartMoveState.hoverPoint    = null;
      dartMoveState.hoverSegIndex = -1;

      const seg = segments[result.segIndex];
      const deg = Math.abs(closeAngle * 180 / Math.PI).toFixed(1);
      setApplyEnabled(true);
      setHint(`${seg?.type || "outline"} · 기준각 ${deg}° · 핸들 드래그로 조절`);
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

  // ── hover: SVG 위 마우스 이동 시 선택 가능 외곽선 표시 ──────────
  svg.addEventListener("mousemove", e => {
    if (!dartMoveState.active) return;
    if (!dartMoveState.side) return;
    if (dartMoveState.dragging) return;
    if (dartMoveState.cutPoint) return;
    if (e.target.closest(".dart-rotate-handle")) return;

    const [mx, my] = eventToPatternPoint(e);
    const B = n("inpB"), W = n("inpW"), BL = n("inpBL");
    if (!B || !W || !BL) return;
    const dh = createDraft(B, W, BL);

    if (dartMoveState.side === "back") {
      const segsH = buildBackOutline(dh.pts, dh.formula, B);
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

    const segsH = buildFrontOutline(dh.pts, dh.formula, B);
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

    // 범위 제한: 0 ~ baseAngle (패턴 겹침 방지)
    const base = dartMoveState.baseAngle;
    // baseAngle은 양수 방향 (뒤판) 또는 음수 방향 (앞판)
    if (base >= 0) {
      userAngle = Math.max(0, Math.min(base, userAngle));
    } else {
      userAngle = Math.max(base, Math.min(0, userAngle));
    }

    dartMoveState.userAngle = userAngle;

    const deg = (userAngle * 180 / Math.PI).toFixed(1);
    setHint(`회전 중: ${deg}° (기준 ${(dartMoveState.baseAngle * 180 / Math.PI).toFixed(1)}°)`);
    render();
  });

  // ── 드래그 핸들: mouseup ──────────────────────
  window.addEventListener("mouseup", e => {
    if (!dartMoveState.dragging) return;
    dartMoveState.dragging = false;
    svg.style.cursor = "";
    const deg = (dartMoveState.userAngle * 180 / Math.PI).toFixed(1);
    setHint(`확정: ${deg}° — 적용 버튼을 눌러 완료`);
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
    if (seg.disabled) return;
    const r = closestOnSeg(clickPt, seg.from, seg.to);
    if (r.d < bestD) { bestD = r.d; best = r.pt; bestIndex = idx; }
  });
  if (bestD > 2.0) return null;

  // dartCenter / dartEnd_ 근처 차단
  const info = buildBackShoulderDartInfo(f, p, B);
  const minD = 1.2;
  const nearCenter = Math.hypot(best.x - info.dartCenter.x, best.y - info.dartCenter.y) < minD;
  const nearEnd    = Math.hypot(best.x - info.dartEnd_.x,   best.y - info.dartEnd_.y)   < minD;
  if (nearCenter || nearEnd) {
    return { blocked: true, reason: "dart-end", point: best, segIndex: bestIndex };
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

  console.log('[splitBack] forward.hit:', forward.hit, 'pts:', forward.pts.length,
    'types:', forward.segs.map(s=>s.type).join(','));
  console.log('[splitBack] backward.hit:', backward.hit, 'pts:', backward.pts.length,
    'types:', backward.segs.map(s=>s.type).join(','));

  let fixedPts = [], rotatePts = [], fixedSegs = [], rotateSegs = [];

  // hit 성공/실패 무관하게 항상 열린 pts 면적으로 결정
  // forward/backward 중 더 작은 쪽이 rotatePts
  const fArea = polygonArea([...forward.pts,  { ...info.apex }, { ...cutPoint }]);
  const bArea = polygonArea([...backward.pts, { ...info.apex }, { ...cutPoint }]);
  let fixedHit, rotateHit;
  if (fArea < bArea) {
    rotatePts = forward.pts;  rotateSegs = forward.segs;
    fixedPts  = backward.pts; fixedSegs  = backward.segs;
    rotateHit = forward.hit  === "dartCenter" ? "dartCenter" : "dartEnd";
    fixedHit  = backward.hit === "dartCenter" ? "dartCenter" : "dartEnd";
  } else {
    rotatePts = backward.pts; rotateSegs = backward.segs;
    fixedPts  = forward.pts;  fixedSegs  = forward.segs;
    rotateHit = backward.hit === "dartCenter" ? "dartCenter" : "dartEnd";
    fixedHit  = forward.hit  === "dartCenter" ? "dartCenter" : "dartEnd";
  }

  // E점(apex)으로 닫아서 조각처럼 표시
  const rotateClosed = [...rotatePts, { ...info.apex }, { ...cutPoint }];
  const fixedClosed  = [...fixedPts,  { ...info.apex }, { ...cutPoint }];

  return ensureSmallPieceRotates({
    fixedPts: fixedClosed, rotatePts: rotateClosed,
    fixedSegs, rotateSegs, fixedHit, rotateHit,
    openFixedPts: fixedPts, openRotatePts: rotatePts,
  });
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
